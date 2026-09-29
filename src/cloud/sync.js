// Cloud save: one copy of the shelf per account, pushed with optimistic
// concurrency (push_save only writes when the caller saw the latest rev).
//
// The server copy is the plain save JSON, the same thing a backup file holds,
// so it can always be restored. Two rules keep it from ever costing a shelf:
//   * a cloud copy is only applied through normalizeState, and a copy that
//     fails it is refused while the local shelf carries on untouched;
//   * when this device and the cloud have both moved on, nothing is merged or
//     picked quietly. The player chooses, and the losing shelf is kept on this
//     device (shelflife.v4.beforecloud) so the choice can be swapped back.
//
// Refinements to the plain "debounce and push" design, each for a reason:
//   * Background pushes only follow something the player did (a pointer, key
//     or form input since the last sync). The game saves on every 30 s tick, so
//     pushing on every save would upload the whole shelf twice a minute from a
//     tab nobody is looking at, and two idle devices would fight each other.
//   * A newer cloud copy is applied without asking when this device has had
//     no player input since it last synced: that is someone switching devices,
//     not a disagreement.
//   * A cloud copy written by this very device (a reply lost as the page
//     closed) is treated as ours, not as a conflict.
//   * The 20 s debounce has a 2 minute ceiling during continuous play and a
//     1 minute floor between background pushes.
import { normalizeState } from '../state.js';
import { CloudError, browserStorage } from './client.js';

export const SAFETY_KEY = 'shelflife.v4.beforecloud';
export const DEBOUNCE_MS = 20000;
export const MAX_WAIT_MS = 120000;
export const MIN_GAP_MS = 60000;
export const RECHECK_MS = 60000;
export const SAFETY_MS = 7 * 86400000;
// The server refuses 6,000,000 bytes of jsonb text; jsonb adds spaces, so the
// client stops a little short rather than uploading a copy that will bounce.
export const MAX_SAVE_CHARS = 5500000;
const KEEPALIVE_LIMIT = 60000;
const RETRY_FIRST = 30000, RETRY_MAX = 600000;
const INPUT_EVENTS = ['pointerdown', 'keydown', 'click', 'input', 'change'];

// FNV-1a over the JSON, plus its length. Cheap, and only ever compared with
// itself, so collisions merely cost one skipped push until the next change.
export function saveHash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return text.length.toString(36) + '.' + (h >>> 0).toString(36);
}

export function shelfSummary(data) {
  const pets = Array.isArray(data?.pets) ? data.pets : [];
  return {
    residents: pets.length,
    names: pets.slice(0, 3).map(p => typeof p?.name === 'string' && p.name.trim() ? p.name.trim().slice(0, 22) : 'Someone'),
    souls: Math.max(0, Math.floor(Number(data?.mayhem?.souls) || 0)),
    lastSaved: Number.isFinite(data?.lastTick) ? data.lastTick : 0
  };
}

// Device ids start with a rough kind so the conflict card can say where the
// other shelf came from without storing anything identifying.
export function deviceKind(value = globalThis.navigator?.userAgent || '') {
  const known = String(value).match(/^(android|iphone|ipad|mac|windows|chromebook|linux|device)-/);
  if (known) return known[1];
  const ua = String(value);
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPod/i.test(ua)) return 'iphone';
  if (/iPad/i.test(ua)) return 'ipad';
  if (/CrOS/i.test(ua)) return 'chromebook';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'mac';
  if (/Windows/i.test(ua)) return 'windows';
  if (/Linux/i.test(ua)) return 'linux';
  return 'device';
}
function randomPart() {
  const bytes = new Uint8Array(8);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else bytes.forEach((_, i) => { bytes[i] = Math.floor(Math.random() * 256); });
  return [...bytes].map(b => (b % 36).toString(36)).join('');
}

// Key order is irrelevant to jsonb, so equality is judged on sorted keys.
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value ?? null);
}

export function createSync({
  cloud, getState, applyRemote, exportState = state => JSON.stringify(state), events = globalThis,
  normalize = normalizeState, canApply = () => true, storage = browserStorage(), now = Date.now,
  timers = globalThis, hidden = () => !!globalThis.document?.hidden, userAgent
} = {}) {
  let status = 'off', error = null, pending = null, safetyFailed = false;
  let started = false, timer = null, firstWaitAt = 0, lastPushAt = 0, lastCheckAt = 0;
  let retryMs = 0, needsCheck = true, pushQueued = false, dirtyHint = false, sessionCheck = null;
  let chain = Promise.resolve(), unsubscribe = null;
  const listeners = new Set();

  // ---- status ----
  function info() {
    const m = cloud.meta(), uid = cloud.userId();
    const safe = m.safetyCopyAt && now() - m.safetyCopyAt < SAFETY_MS
      ? { at: m.safetyCopyAt, until: m.safetyCopyAt + SAFETY_MS, ...(m.safetySummary || { residents: 0, names: [] }) } : null;
    return {
      status, error, lastSyncedAt: uid && m.syncUser === uid ? m.lastSyncedAt || 0 : 0,
      conflict: pending?.kind === 'conflict' ? { local: shelfSummary(getState()), remote: pending.remote } : null,
      repairable: pending?.kind === 'corrupt', safetyCopy: safe, safetyCopyFailed: safetyFailed,
      signedIn: cloud.signedIn(), anonymous: cloud.isAnonymous(), email: cloud.email(), pendingEmail: m.pending?.email || ''
    };
  }
  function notify() { const snapshot = info(); listeners.forEach(fn => { try { fn(snapshot); } catch { /* the UI's problem */ } }); }
  function setStatus(next, problem = null) { status = next; error = problem; notify(); }
  function settle() { setStatus(pending ? (pending.kind === 'conflict' ? 'conflict' : 'error') : cloud.signedIn() ? 'idle' : 'off', pending?.error || null); }
  // A cloud copy that fails normalizeState is never applied. The shelf here
  // carries on, and the player may choose to overwrite the broken copy.
  function refuse(rev) {
    pending = { kind: 'corrupt', rev, error: { code: 'corrupt_remote', message: 'The cloud copy could not be read.' } };
    return settle();
  }

  function deviceId() {
    const id = cloud.meta().deviceId;
    if (typeof id === 'string' && /^[a-z]+-[a-z0-9]{6,16}$/.test(id)) return id;
    return cloud.setMeta({ deviceId: deviceKind(userAgent) + '-' + randomPart() }).deviceId;
  }

  // ---- what the player did since the last sync ----
  function markDirty() {
    if (dirtyHint || !started) return;
    const m = cloud.meta();
    if (!m.syncUser) return;
    dirtyHint = true;
    if (!m.dirty) cloud.setMeta({ dirty: true });
  }
  function clean(patch = {}) { dirtyHint = false; cloud.setMeta({ ...patch, dirty: false }); }

  // Never two requests in flight: every exchange waits for the one before.
  function exclusive(task) {
    const next = chain.then(task);
    chain = next.catch(() => {});
    return next;
  }

  function fail(problem) {
    const e = problem instanceof CloudError ? problem : new CloudError(String(problem?.message || problem), { code: 'unexpected' });
    if (!cloud.signedIn()) { stopTimer(); return setStatus('off', e.code === 'session_expired' ? { code: e.code, message: e.message } : null); }
    const code = e.code === '23514' ? 'too_large' : e.code;
    setStatus(e.offline ? 'offline' : 'error', { code, message: e.message, status: e.status });
    if (code !== 'too_large' && code !== 'corrupt_remote') retryLater();
  }
  function stopTimer() { if (timer) timers.clearTimeout(timer); timer = null; firstWaitAt = 0; }
  function retryLater() {
    stopTimer();
    retryMs = Math.min(retryMs ? retryMs * 2 : RETRY_FIRST, RETRY_MAX);
    timer = timers.setTimeout(() => { timer = null; run(); }, retryMs);
  }
  function run() { return needsCheck ? check() : push({ requireDirty: true }); }

  // ---- the safety copy ----
  function keepSafetyCopy(text, summary) {
    try { storage.removeItem(SAFETY_KEY); } catch { /* nothing there */ }
    try {
      storage.setItem(SAFETY_KEY, text);
      safetyFailed = false;
      cloud.setMeta({ safetyCopyAt: now(), safetySummary: summary });
      return true;
    } catch {
      // Usually a full quota. The choice still goes ahead; the UI says no spare was kept.
      safetyFailed = true;
      cloud.setMeta({ safetyCopyAt: 0, safetySummary: undefined });
      return false;
    }
  }
  function dropSafetyCopy() {
    const had = !!cloud.meta().safetyCopyAt;
    try { storage.removeItem(SAFETY_KEY); } catch { /* already gone */ }
    if (had) cloud.setMeta({ safetyCopyAt: 0, safetySummary: undefined });
    return had;
  }

  // ---- pushing ----
  async function pushNow({ base, force = false, keepalive = false, requireDirty = false, depth = 0 } = {}) {
    if (!cloud.signedIn() || pending) return settle();
    stopTimer();
    const m = cloud.meta(), uid = cloud.userId();
    const known = m.syncUser === uid;
    const rev = base ?? (known ? m.baseRev || 0 : 0);
    if (requireDirty && !m.dirty) return settle();
    const text = exportState(getState());
    if (text.length > MAX_SAVE_CHARS) throw new CloudError('This shelf is too large for cloud save.', { code: 'too_large' });
    const hash = saveHash(text);
    if (!force && known && rev === m.baseRev && hash === m.lastPushHash) { clean(); return settle(); }
    const wasDirty = !!m.dirty;
    clean();
    setStatus('syncing');
    lastPushAt = now();
    let result;
    try {
      result = await cloud.rpc('push_save', { p_base_rev: rev, p_data: JSON.parse(text), p_device: deviceId() },
        { keepalive: keepalive && text.length < KEEPALIVE_LIMIT });
    } catch (e) {
      if (wasDirty || force) cloud.setMeta({ dirty: true });
      throw e;
    }
    if (result?.ok === true && Number.isFinite(Number(result.rev))) {
      cloud.setMeta({ syncUser: uid, baseRev: Number(result.rev), lastPushHash: hash, lastSyncedAt: now() });
      retryMs = 0;
      return settle();
    }
    if (result?.conflict) {
      // Someone else wrote first. Look at what they wrote before deciding anything.
      if (wasDirty) cloud.setMeta({ dirty: true });
      return decide(await cloud.rpc('pull_save'), { depth: depth + 1 });
    }
    throw new CloudError('The cloud gave an unexpected answer.', { code: 'bad_reply' });
  }

  function push(options = {}) {
    if (!cloud.signedIn()) { settle(); return Promise.resolve(info()); }
    if (needsCheck) return check();
    if (pushQueued) return chain.then(info);
    pushQueued = true;
    return exclusive(() => { pushQueued = false; return pushNow(options); }).catch(fail).then(info);
  }

  function schedule() {
    const t = now();
    if (!firstWaitAt) firstWaitAt = t;
    let wait = Math.min(DEBOUNCE_MS, Math.max(0, firstWaitAt + MAX_WAIT_MS - t));
    wait = Math.max(wait, lastPushAt + MIN_GAP_MS - t, 0);
    if (timer) timers.clearTimeout(timer);
    timer = timers.setTimeout(() => { timer = null; push({ requireDirty: true }); }, wait);
  }

  // ---- reading the cloud and deciding ----
  function adopt(normalized, remote, reason) {
    // A game or sheet is open. Leave the shelf alone and look again later.
    const later = () => { needsCheck = true; return settle(); };
    if (!canApply()) return later();
    const uid = cloud.userId();
    if (applyRemote(normalized, { reason, device: deviceKind(remote.device || '') }) === false) return later();
    clean({ syncUser: uid, baseRev: Number(remote.rev) || 0, lastPushHash: saveHash(exportState(getState())), lastSyncedAt: now() });
    return settle();
  }

  async function decide(remote, { depth = 0, manual = false } = {}) {
    if (depth > 3) throw new CloudError('The cloud copy keeps changing. Try again in a minute.', { code: 'busy' });
    const m = cloud.meta(), uid = cloud.userId();
    const state = getState();
    needsCheck = false;
    if (!remote) return pushNow({ base: 0, force: true, depth });                                   // (a) nothing there yet
    const rev = Number(remote.rev) || 0;
    const known = m.syncUser === uid && m.baseRev > 0 && rev >= m.baseRev;
    if (known && rev === m.baseRev) {
      cloud.setMeta({ lastSyncedAt: now() });
      return pushNow({ base: rev, requireDirty: !manual, depth });
    }
    if (known && remote.device === deviceId()) {                                                     // our own last write
      cloud.setMeta({ baseRev: rev, lastPushHash: '', lastSyncedAt: now() });
      return pushNow({ base: rev, requireDirty: !manual, depth });
    }
    const normalized = normalize(remote.data);
    if (!normalized) return refuse(rev);
    const here = shelfSummary(state), there = shelfSummary(normalized);
    if (known && !m.dirty) return adopt(normalized, remote, 'newer');                               // another device moved on
    if (!here.residents && there.residents) return adopt(normalized, remote, 'arrived');            // (b)
    if (!there.residents) return pushNow({ base: rev, force: true, depth });
    if (canonical(state) === canonical(remote.data)) {
      clean({ syncUser: uid, baseRev: rev, lastPushHash: saveHash(exportState(state)), lastSyncedAt: now() });
      return settle();
    }
    pending = { kind: 'conflict', rev, data: remote.data,                                             // (c)
      remote: { ...there, lastSaved: Date.parse(remote.updated_at) || there.lastSaved, device: deviceKind(remote.device || '') } };
    return setStatus('conflict');
  }

  function check({ manual = false } = {}) {
    if (!cloud.signedIn()) { settle(); return Promise.resolve(info()); }
    return exclusive(async () => {
      if (!cloud.signedIn()) return settle();
      if (pending?.kind === 'conflict' && !manual) return settle();
      stopTimer();
      lastCheckAt = now();
      needsCheck = true;
      setStatus('syncing');
      // Peek at the rev first: a whole shelf can be megabytes, and usually
      // nothing has changed since this device last looked.
      const rows = await cloud.select('saves', 'select=rev,device_id');
      const row = Array.isArray(rows) ? rows[0] : null;
      const m = cloud.meta();
      const unchanged = row && m.syncUser === cloud.userId() && m.baseRev > 0 && Number(row.rev) === m.baseRev;
      const remote = !row ? null : unchanged ? { rev: Number(row.rev), device: row.device_id } : await cloud.rpc('pull_save');
      pending = null;
      await decide(remote, { manual });
      retryMs = 0;
    }).catch(fail).then(info);
  }

  // ---- the player's choices ----
  function resolve(choice) {
    return exclusive(async () => {
      const p = pending;
      if (!p || !cloud.signedIn()) return settle();
      const uid = cloud.userId();
      if (choice === 'cloud') {
        if (p.kind !== 'conflict') return settle();
        let rev = p.rev, data = p.data;
        // "The cloud copy" means the latest one, if the network allows a look.
        try { const latest = await cloud.rpc('pull_save'); if (latest?.data && normalize(latest.data)) ({ rev, data } = latest); } catch { /* use the copy already shown */ }
        const normalized = normalize(data);
        if (!normalized) return refuse(rev);
        keepSafetyCopy(exportState(getState()), shelfSummary(getState()));
        pending = null;
        applyRemote(normalized, { reason: 'chosen', device: p.remote.device });
        clean({ syncUser: uid, baseRev: Number(rev) || 0, lastPushHash: saveHash(exportState(getState())), lastSyncedAt: now() });
        return settle();
      }
      if (choice !== 'local') return settle();
      if (p.kind === 'conflict') keepSafetyCopy(JSON.stringify(p.data), shelfSummary(p.data));
      pending = null;
      // Recorded before the push, so a dropped connection retries this choice
      // rather than asking the question again.
      cloud.setMeta({ syncUser: uid, baseRev: p.rev, lastPushHash: '', dirty: true });
      needsCheck = false;
      await pushNow({ base: p.rev, force: true });
    }).catch(fail).then(info);
  }

  // Swap the current shelf with the one kept aside, here and in the cloud.
  function undo() {
    return exclusive(async () => {
      let text = null, normalized = null;
      try { text = storage.getItem(SAFETY_KEY); normalized = text ? normalize(JSON.parse(text)) : null; } catch { normalized = null; }
      if (!normalized) { dropSafetyCopy(); throw new CloudError('The other shelf could not be read back.', { code: 'safety_missing' }); }
      keepSafetyCopy(exportState(getState()), shelfSummary(getState()));
      applyRemote(normalized, { reason: 'undo' });
      const m = cloud.meta();
      cloud.setMeta({ lastPushHash: '', dirty: !!m.syncUser });
      if (cloud.signedIn() && m.syncUser === cloud.userId() && !pending) await pushNow({ force: true });
      else settle();
    }).catch(fail).then(info);
  }

  async function enable() {
    sessionCheck = null;
    await cloud.signInAnonymously();
    return sessionCheck || check();
  }

  async function signOut() {
    stopTimer();
    pending = null;
    await cloud.signOut();
    setStatus('off');
    return info();
  }

  async function deleteAccount() {
    await exclusive(() => cloud.deleteAccount());
    stopTimer();
    pending = null;
    dropSafetyCopy();
    clean({ syncUser: undefined, baseRev: 0, lastPushHash: '', lastSyncedAt: 0 });
    setStatus('off');
    return info();
  }

  // ---- triggers ----
  function onStored() {
    if (!cloud.signedIn() || pending || !cloud.meta().dirty) return;
    schedule();
  }
  function onHidden() {
    if (!cloud.signedIn() || pending) return;
    if (cloud.meta().dirty) push({ keepalive: true, requireDirty: true });
  }
  function onVisibility() {
    if (hidden()) return onHidden();
    if (cloud.signedIn() && now() - lastCheckAt > RECHECK_MS) check();
  }
  function onOnline() { if (cloud.signedIn() && (status === 'offline' || status === 'error')) { retryMs = 0; run(); } }
  function onSession(change) {
    if (change.signedOut) { stopTimer(); pending = null; needsCheck = true; return settle(); }
    if (change.userChanged) { pending = null; needsCheck = true; sessionCheck = check(); }
    else notify();
  }

  function start() {
    if (started || !cloud.configured) return api;
    started = true;
    events.addEventListener('shelflife:storage', onStored);
    events.addEventListener('visibilitychange', onVisibility);
    events.addEventListener('pagehide', onHidden);
    events.addEventListener('online', onOnline);
    INPUT_EVENTS.forEach(type => events.addEventListener(type, markDirty, true));
    unsubscribe = cloud.subscribe(onSession);
    const m = cloud.meta();
    if (m.safetyCopyAt && now() - m.safetyCopyAt >= SAFETY_MS) dropSafetyCopy();
    dirtyHint = !!m.dirty;
    if (cloud.signedIn()) check(); else settle();
    return api;
  }
  function stop() {
    if (!started) return;
    started = false;
    stopTimer();
    events.removeEventListener('shelflife:storage', onStored);
    events.removeEventListener('visibilitychange', onVisibility);
    events.removeEventListener('pagehide', onHidden);
    events.removeEventListener('online', onOnline);
    INPUT_EVENTS.forEach(type => events.removeEventListener(type, markDirty, true));
    unsubscribe?.();
  }

  const api = {
    start, stop, enable, check, syncNow: () => check({ manual: true }), push, resolve, undo, signOut, deleteAccount,
    dropSafetyCopy, markDirty, deviceId, info, status: () => status,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };
  return api;
}

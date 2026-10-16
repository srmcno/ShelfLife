// A small Supabase client over plain fetch: GoTrue (/auth/v1) for the session,
// PostgREST (/rest/v1) for everything else. No SDK, no dependencies.
//
// Nothing here runs by itself. Every network request starts from a method call,
// and an unconfigured client refuses before fetch is ever touched.
import { cloudConfig, cloudConfigured } from './config.js';

// The session and sync bookkeeping live under their own key, never inside the
// game save or its backups.
export const CLOUD_KEY = 'shelflife.cloud';
const TIMEOUT_MS = 15000;
const REFRESH_EARLY = 60;   // seconds before expiry that a token is renewed
const NAME = /^[a-z_][a-z0-9_]{0,62}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class CloudError extends Error {
  constructor(message, { status = 0, code = '', offline = false } = {}) {
    super(message);
    this.name = 'CloudError';
    this.status = status;
    this.code = code;
    this.offline = offline;
  }
}

function memoryStorage() {
  const items = new Map();
  return { getItem: k => items.has(k) ? items.get(k) : null, setItem: (k, v) => { items.set(k, String(v)); }, removeItem: k => { items.delete(k); } };
}
export function browserStorage() {
  try { return globalThis.localStorage || memoryStorage(); } catch { return memoryStorage(); }
}

// GoTrue answers { error_code, msg }, its token endpoint { error, error_description }
// and PostgREST { code, message }. Callers get one shape.
function failure(status, body) {
  const b = body && typeof body === 'object' ? body : {};
  const code = String(b.error_code || (typeof b.code === 'string' && b.code) || b.error || 'http_' + status);
  const message = b.msg || b.message || b.error_description || (typeof body === 'string' && body) || 'The cloud refused (' + status + ').';
  return new CloudError(String(message).slice(0, 300), { status, code });
}

function pickUser(user) {
  return { id: String(user.id), email: typeof user.email === 'string' ? user.email : '', is_anonymous: user.is_anonymous === true };
}

export function createCloud({ config = cloudConfig(), fetch = (...args) => globalThis.fetch(...args), storage = browserStorage(), now = Date.now, timeoutMs = TIMEOUT_MS } = {}) {
  const configured = cloudConfigured(config);
  const base = configured ? config.url.trim().replace(/\/+$/, '') : '';
  const anonKey = configured ? config.anonKey.trim() : '';
  const listeners = new Set();
  let memo = {}, persisted = true, refreshing = null, authEpoch = 0;

  // ---- local bookkeeping ----
  function meta() {
    if (!persisted) return { ...memo };
    try {
      const value = JSON.parse(storage.getItem(CLOUD_KEY) || '{}');
      memo = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch { /* unreadable or blocked: keep what this page already knows */ }
    return { ...memo };
  }
  function setMeta(patch) {
    const next = { ...meta(), ...patch };
    Object.keys(next).forEach(key => { if (next[key] === undefined) delete next[key]; });
    memo = next;
    try { storage.setItem(CLOUD_KEY, JSON.stringify(next)); persisted = true; } catch { persisted = false; }
    return { ...next };
  }
  function emit(change) { listeners.forEach(fn => { try { fn(change); } catch { /* a listener's problem, not the session's */ } }); }

  // ---- the session ----
  function session() {
    if (!configured) return null;
    const s = meta().session;
    return s && typeof s.access_token === 'string' && typeof s.refresh_token === 'string' && s.user && typeof s.user.id === 'string' ? s : null;
  }
  const signedIn = () => !!session();
  const userId = () => session()?.user.id || null;
  const email = () => session()?.user.email || '';
  const isAnonymous = () => { const s = session(); return !!s && !s.user.email; };
  const fresh = s => s && s.expires_at - now() / 1000 > REFRESH_EARLY;
  const accountChanged = () => new CloudError('The cloud account changed. Try again for this account.', { status: 401, code: 'session_changed' });
  function requireAccount(uid) {
    const current = session();
    if (!current || current.user.id !== uid) throw accountChanged();
    return current;
  }
  const authSnapshot = () => ({ epoch: authEpoch, intent: meta().authIntent });
  function beginAuthIntent() {
    authEpoch += 1;
    // A unique cancellation marker shared by tabs, including signed-out tabs.
    // This is bookkeeping, never a credential or an authorization token.
    if (configured) setMeta({ authIntent: authEpoch + ':' + now() + ':' + Math.random().toString(36).slice(2) });
    return authSnapshot();
  }
  function requireAuthEpoch(snapshot) {
    if (snapshot.epoch !== authEpoch || snapshot.intent !== meta().authIntent) throw accountChanged();
  }
  function requireSessionOwner(owner) { if (userId() !== owner) throw accountChanged(); }

  function keep(data, previous) {
    const user = data?.user && typeof data.user === 'object' && data.user.id ? data.user : previous?.user;
    if (typeof data?.access_token !== 'string' || typeof data?.refresh_token !== 'string' || !user?.id) {
      throw new CloudError('The sign-in reply was incomplete.', { code: 'bad_session' });
    }
    // Expiry is counted on this device's clock, so a skewed clock cannot make a
    // new token look expired.
    const lifetime = Number.isFinite(data.expires_in) ? data.expires_in : 3600;
    const s = { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: Math.floor(now() / 1000) + lifetime, user: pickUser(user) };
    setMeta({ session: s });
    emit({ type: 'session', userChanged: previous?.user.id !== s.user.id });
    return s;
  }
  function forget() {
    const m = meta();
    if (!m.session && !m.pending) return;
    setMeta({ session: undefined, pending: undefined });
    if (m.session) emit({ type: 'session', signedOut: true });
  }

  // ---- transport ----
  async function send(path, { method = 'GET', body, token, keepalive = false } = {}) {
    if (!configured) throw new CloudError('Cloud save is not set up.', { code: 'not_configured' });
    const headers = { apikey: anonKey, Accept: 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller?.abort(); }, timeoutMs);
    const lost = () => new CloudError(timedOut ? 'The cloud took too long to answer.' : 'Could not reach the cloud.', { code: timedOut ? 'timeout' : 'offline', offline: true });
    try {
      let response, text = '';
      try {
        response = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller?.signal, keepalive, cache: 'no-store', credentials: 'omit' });
        text = await response.text();
      } catch { throw lost(); }
      let data = null;
      if (text) { try { data = JSON.parse(text); } catch { data = text; } }
      if (!response.ok) throw failure(response.status, data);
      return data;
    } finally { clearTimeout(timer); }
  }

  // One refresh at a time. Refresh tokens rotate, so two at once would spend
  // the same token twice and the second would be refused.
  function refresh() {
    const current = session();
    if (refreshing?.userId === current?.user.id) return refreshing.promise;
    const epoch = authSnapshot(), entry = { userId: current?.user.id, promise: null };
    entry.promise = (async () => {
      if (!current) throw new CloudError('Not signed in.', { status: 401, code: 'no_session' });
      try {
        const data = await send('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: current.refresh_token } });
        requireAuthEpoch(epoch);
        const latest = requireAccount(current.user.id);
        if (data?.user?.id && data.user.id !== current.user.id) throw accountChanged();
        if (latest.refresh_token !== current.refresh_token && fresh(latest)) return latest;
        return keep(data, current);
      } catch (error) {
        requireAuthEpoch(epoch);
        const latest = requireAccount(current.user.id);
        if (error.code === 'session_changed') throw error;
        if (error.offline || error.status >= 500 || error.status === 429) throw error;
        // Another tab may have rotated the token first. Theirs is as good as ours.
        if (latest.refresh_token !== current.refresh_token) return latest;
        forget();
        throw new CloudError('This device has been signed out of cloud save.', { status: 401, code: 'session_expired' });
      }
    })().finally(() => { if (refreshing === entry) refreshing = null; });
    refreshing = entry;
    return entry.promise;
  }

  async function authed(path, options = {}) {
    let s = session();
    if (!s) throw new CloudError('Not signed in.', { status: 401, code: 'no_session' });
    const uid = s.user.id;
    if (!fresh(s)) s = await refresh();
    requireAccount(uid);
    if (s.user.id !== uid) throw accountChanged();
    try {
      const data = await send(path, { ...options, token: s.access_token });
      requireAccount(uid);
      return data;
    } catch (error) {
      if (error.status !== 401 || error.code === 'session_changed') throw error;
      const latest = requireAccount(uid);
      const next = latest.access_token !== s.access_token && fresh(latest) ? latest : await refresh();
      requireAccount(uid);
      if (next.user.id !== uid) throw accountChanged();
      const data = await send(path, { ...options, token: next.access_token });
      requireAccount(uid);
      return data;
    }
  }

  // ---- accounts ----
  async function signInAnonymously() {
    const existing = session();
    if (existing) return existing;
    const epoch = beginAuthIntent();
    const data = await send('/auth/v1/signup', { method: 'POST', body: {} });
    requireAuthEpoch(epoch);
    requireSessionOwner(null);
    return keep(data, null);
  }
  function cleanEmail(value) {
    const address = String(value || '').trim().toLowerCase();
    if (address.length > 254 || !EMAIL.test(address)) throw new CloudError('That does not look like an email address.', { code: 'invalid_email' });
    return address;
  }
  // 'link' adds the email to the current (anonymous) account; 'signin' reaches
  // an existing account, or makes one, from a signed-out or different session.
  // create: false only reaches an account that already exists (the account
  // deletion page must never make one).
  async function requestEmailCode(address, { mode, create = true } = {}) {
    const target = cleanEmail(address);
    const epoch = beginAuthIntent(), owner = userId();
    let how = mode === 'link' || mode === 'signin' ? mode : isAnonymous() ? 'link' : 'signin';
    if (how === 'link') {
      // GoTrue automatically attaches an anonymous user's email, without
      // sending a code, when confirmation is disabled. This UI requires proof
      // of inbox ownership before attaching it, so check before mutating.
      const settings = await send('/auth/v1/settings');
      requireAuthEpoch(epoch); requireSessionOwner(owner);
      if (settings?.mailer_autoconfirm !== false) {
        throw new CloudError('Email confirmation is not enabled on the server.', { code: 'email_confirmation_disabled' });
      }
      const user = await authed('/auth/v1/user', { method: 'PUT', body: { email: target } });
      // A browser can retain its old guest session after the email was already
      // confirmed. Updating an unchanged address succeeds without emailing.
      // Request a sign-in code instead, keeping the account until it is verified.
      if (user?.is_anonymous === false && user.email?.toLowerCase() === target) {
        how = 'signin';
        await send('/auth/v1/otp', { method: 'POST', body: { email: target, create_user: false } });
      }
    }
    else await send('/auth/v1/otp', { method: 'POST', body: { email: target, create_user: create !== false } });
    requireAuthEpoch(epoch);
    requireSessionOwner(owner);
    setMeta({ pending: { email: target, mode: how, at: now() } });
    return { email: target, mode: how };
  }
  async function verifyEmailCode(address, code) {
    const target = cleanEmail(address);
    const token = String(code || '').replace(/\s+/g, '');
    if (!/^\d{6,10}$/.test(token)) throw new CloudError('The code is the digits from the email.', { code: 'invalid_code' });
    const epoch = beginAuthIntent();
    const pending = meta().pending;
    const how = pending?.email === target ? pending.mode : 'signin';
    const previous = session();
    const data = await send('/auth/v1/verify', { method: 'POST', body: { type: how === 'link' ? 'email_change' : 'email', email: target, token } });
    requireAuthEpoch(epoch);
    requireSessionOwner(previous?.user.id || null);
    let s;
    if (typeof data?.access_token === 'string') s = keep(data, previous);
    else if (how === 'link' && previous) {
      // Some servers confirm an email change without issuing a new session.
      const user = await authed('/auth/v1/user');
      requireAuthEpoch(epoch);
      s = setMeta({ session: { ...session(), user: pickUser(user) } }).session;
      emit({ type: 'session', userChanged: false });
    } else throw new CloudError('The sign-in reply was incomplete.', { code: 'bad_session' });
    setMeta({ pending: undefined });
    return { userId: s.user.id, email: s.user.email, switched: !!previous && previous.user.id !== s.user.id };
  }
  async function signOut() {
    const s = session();
    beginAuthIntent();
    // Signing out of this device never waits on the network to agree.
    forget();
    if (s) { try { await send('/auth/v1/logout?scope=local', { method: 'POST', token: s.access_token }); } catch { /* local sign-out still happens */ } }
  }

  // ---- data ----
  function rpc(name, args = {}, { keepalive = false } = {}) {
    if (!NAME.test(name)) return Promise.reject(new CloudError('Unknown cloud function.', { code: 'bad_name' }));
    return authed('/rest/v1/rpc/' + name, { method: 'POST', body: args || {}, keepalive });
  }
  function select(table, query = 'select=*') {
    if (!NAME.test(table)) return Promise.reject(new CloudError('Unknown cloud table.', { code: 'bad_name' }));
    const q = String(query || '').replace(/^\?/, '');
    return authed('/rest/v1/' + table + (q ? '?' + q : ''));
  }
  async function deleteAccount() {
    await rpc('delete_my_account');
    forget();
  }

  return {
    configured, session, signedIn, isAnonymous, email, userId,
    signInAnonymously, requestEmailCode, verifyEmailCode, pendingEmail: () => meta().pending || null,
    signOut, rpc, select, deleteAccount, refresh, meta, setMeta,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };
}

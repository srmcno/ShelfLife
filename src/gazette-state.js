// A compact, non-save journal. A fresh session starts with a baseline, so a
// restored shelf and old achievements are never treated as new news.
import { CURIOS } from './content/mayhem.js';
import { SEASONAL_CURIOS } from './content/seasons.js';
import { TIERS } from './content/almanac.js';
import { SCORE_CAPS } from './cloud/social.js';

const notable = new Set([...CURIOS.filter(c => ['rare', 'cursed', 'unholy'].includes(c.rarity)), ...SEASONAL_CURIOS].map(c => c.id));
const safeId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
const count = value => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
const records = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
export function gazetteSummary(state) {
  return {
    pets: Object.fromEntries((Array.isArray(state?.pets) ? state.pets : []).filter(p => safeId(p?.id)).map(p => [p.id, count(p.bond)])),
    curios: Object.keys(records(state?.mayhem?.curios)).filter(id => notable.has(id) && count(state.mayhem.curios[id]) > 0),
    coffins: count(state?.mayhem?.coffins),
    episodes: count(state?.courtroom?.episodes), caseId: String(state?.courtroom?.last || ''),
    best: Object.fromEntries(Object.entries(SCORE_CAPS).map(([id, cap]) => [id, Math.min(cap, count(state?.arcade?.best?.[id]))])),
    collections: (Array.isArray(state?.collections?.claimed) ? state.collections.claimed : []).filter(x => typeof x === 'string' && /^[a-z0-9_-]{1,40}$/.test(x)),
    tiers: Object.fromEntries(Object.entries(records(state?.almanac?.chapters)).map(([id, chapter]) => [id, count(chapter?.claimed)]))
  };
}
export function gazetteChanges(before, after) {
  if (!before || !after) return [];
  const events = [];
  for (const [id, bond] of Object.entries(after.pets)) {
    if (!(id in before.pets)) events.push({ kind: 'adopted', data: { resident: id } });
    else for (const level of [5, 10, 15, 20, 25]) if (bond >= level && before.pets[id] < level) events.push({ kind: 'bond', data: { resident: id, level } });
  }
  if (after.coffins > before.coffins) for (const id of after.curios) if (!before.curios.includes(id)) events.push({ kind: 'coffin', data: { item: id } });
  if (after.episodes > before.episodes && /^[a-z0-9_-]{1,40}$/.test(after.caseId)) events.push({ kind: 'verdict', data: { item: after.caseId } });
  for (const [game, score] of Object.entries(after.best)) if (score > 0 && score > (before.best[game] || 0)) events.push({ kind: 'arcade_best', data: { game, score } });
  for (const id of after.collections) if (!before.collections.includes(id)) events.push({ kind: 'collection', data: { item: id } });
  for (const [chapter, bits] of Object.entries(after.tiers)) for (let tier = 1; tier <= TIERS; tier++) {
    const bit = 1 << (tier - 1);
    if ((bits & bit) && !((before.tiers[chapter] || 0) & bit)) events.push({ kind: 'almanac', data: { tier } });
  }
  return events;
}

function availableStorage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}
export function createGazetteJournal({ cloud, getState, storage = availableStorage(), keygen = () => globalThis.crypto?.randomUUID?.(), canTrack = () => cloud.signedIn() }) {
  let owner = null, baseline = null, generation = 0, pending = null;
  const storageKey = id => 'shelflife.gazette.' + id;
  const sharingKey = id => 'shelflife.gazette-sharing.' + id;
  const validGeneration = n => Number.isInteger(n) && n >= 0 && n <= 2147483647;
  const read = id => { try { const x = JSON.parse(storage?.getItem(storageKey(id)) || '[]'); return Array.isArray(x) ? x.filter(e => e && typeof e.key === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(e.key) && e.data && e.kind && validGeneration(e.generation)).slice(-200) : []; } catch { return []; } };
  const write = (id, queue) => { try { storage.setItem(storageKey(id), JSON.stringify(queue)); return true; } catch { return false; } };
  const setting = id => {
    try {
      const raw = storage?.getItem(sharingKey(id));
      if (!raw || raw === 'on') return { sharing: true, generation: 0 };
      if (raw === 'off') return { sharing: false, generation: 0 };
      const value = JSON.parse(raw);
      if (typeof value?.sharing === 'boolean' && validGeneration(value.generation)) return value;
    } catch { /* Unreadable storage cannot authorize sending news. */ }
    return { sharing: false, generation: 0 };
  };
  function setSharing(on, nextGeneration) {
    if (!owner || owner !== cloud.userId()) return false;
    if (typeof on !== 'boolean' || !validGeneration(nextGeneration)) return false;
    const current = setting(owner);
    if (nextGeneration < current.generation) return false;
    try { storage?.setItem(sharingKey(owner), JSON.stringify({ sharing: on, generation: nextGeneration })); } catch { return false; }
    write(owner, on ? read(owner).filter(event => event.generation === nextGeneration) : []);
    return true;
  }
  function reset() { owner = cloud.userId(); baseline = gazetteSummary(getState()); generation++; pending = null; }
  function enqueue(event, key = keygen()) {
    if (!owner || owner !== cloud.userId() || !canTrack() || !key) return;
    const preference = setting(owner);
    if (!preference.sharing) return;
    const queue = read(owner);
    if (queue.some(item => item.key === key)) return;
    queue.push({ key, ...event, generation: preference.generation });
    write(owner, queue.slice(-200));
  }
  function capture() {
    if (owner !== cloud.userId() || !baseline) { reset(); return; }
    const next = gazetteSummary(getState());
    const events = canTrack() && owner && setting(owner).sharing ? gazetteChanges(baseline, next) : [];
    baseline = next;
    for (const event of events) enqueue(event);
  }
  async function refreshSettings() {
    const id = owner, version = generation;
    if (!id || id !== cloud.userId() || !canTrack()) return null;
    const status = await cloud.rpc('gazette_status');
    if (id !== cloud.userId() || version !== generation) return null;
    return setSharing(status?.sharing, status?.generation) ? status : null;
  }
  async function flush() {
    if (!owner || owner !== cloud.userId() || !canTrack() || pending) return;
    const id = owner, version = generation, queue = read(id), batch = queue.slice(0, 10);
    if (!batch.length) return;
    const promise = (async () => {
      try {
        const result = await cloud.rpc('gazette_post', { p_events: batch });
        if (id !== cloud.userId() || version !== generation) return;
        const sent = new Set(batch.map(e => e.key));
        if (typeof result?.sharing !== 'boolean' || !validGeneration(result?.generation)) return;
        setSharing(result.sharing, result.generation);
        if (!result.stale && result.sharing) write(id, read(id).filter(e => !sent.has(e.key)));
      } catch { /* Offline or refused: retain the batch for a later attempt. */ }
      finally { if (pending === promise) pending = null; }
    })();
    pending = promise;
    await promise;
  }
  reset();
  return { reset, capture, enqueue, flush, refreshSettings, setSharing, queued: () => owner ? read(owner) : [] };
}

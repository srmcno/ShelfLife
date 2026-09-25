import { EMERGENCIES, CURIOS, CHORES, OMENS, RANKS } from './content/mayhem.js';

/* Save data for the mayhem loop (engine/mayhem.js). Everything here is bounded
   and validated so a hand-edited or older backup can never break the shelf. */
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const finite = (value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
const safeId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value)
  && !['__proto__', 'prototype', 'constructor'].includes(value);

export const QUEUE_MAX = 4;
export const LOG_MAX = 16;
const EMERGENCY_IDS = new Set(EMERGENCIES.map(e => e.id));
const CURIO_IDS = new Set(CURIOS.map(c => c.id));
const CHORE_IDS = new Set(CHORES.map(c => c.id));
const OMEN_IDS = new Set(OMENS.map(o => o.id));
const TONES = new Set(['good', 'bad', 'weird']);

export function blankMayhem() {
  return {
    v: 1, souls: 0, lifetime: 0, resolved: 0, coffins: 0, rank: 0,
    queue: [], nextAt: 0, serial: 0, recent: [], curios: {},
    omen: { day: '', id: '', streak: 0, lastDay: '' },
    chores: { day: '', list: [], bonus: false },
    log: [], gameDay: '', gameSouls: 0
  };
}

export function normalizeMayhem(raw, state = {}, now = Date.now()) {
  const out = blankMayhem();
  if (!object(raw)) return out;
  const petIds = new Set((Array.isArray(state.pets) ? state.pets : []).map(p => p && p.id).filter(safeId));
  out.souls = Math.floor(finite(raw.souls, 0, 0, 1e7));
  out.lifetime = Math.max(out.souls, Math.floor(finite(raw.lifetime, 0, 0, 1e8)));
  out.resolved = Math.floor(finite(raw.resolved, 0, 0, 1e7));
  out.coffins = Math.floor(finite(raw.coffins, 0, 0, 1e7));
  out.rank = Math.floor(finite(raw.rank, 0, 0, RANKS.length - 1));
  out.serial = Math.floor(finite(raw.serial, 0, 0, 1e9));
  out.nextAt = finite(raw.nextAt, 0, 0, now + 7 * 86400000);
  out.queue = (Array.isArray(raw.queue) ? raw.queue : []).filter(item => object(item)
    && EMERGENCY_IDS.has(item.id) && petIds.has(item.a) && (item.b == null || (petIds.has(item.b) && item.b !== item.a)))
    .slice(0, QUEUE_MAX)
    .map(item => ({ uid: Math.floor(finite(item.uid, 0, 0, 1e9)), id: item.id, a: item.a, ...(item.b ? { b: item.b } : {}), at: finite(item.at, now, 0, now) }));
  out.recent = (Array.isArray(raw.recent) ? raw.recent : []).filter(id => EMERGENCY_IDS.has(id)).slice(0, 24);
  if (object(raw.curios)) {
    for (const [id, count] of Object.entries(raw.curios)) {
      if (CURIO_IDS.has(id) && Number.isFinite(count) && count > 0) out.curios[id] = Math.floor(Math.min(count, 999));
    }
  }
  if (object(raw.omen)) {
    out.omen = {
      day: typeof raw.omen.day === 'string' ? raw.omen.day.slice(0, 20) : '',
      id: OMEN_IDS.has(raw.omen.id) ? raw.omen.id : '',
      streak: Math.floor(finite(raw.omen.streak, 0, 0, 100000)),
      lastDay: typeof raw.omen.lastDay === 'string' ? raw.omen.lastDay.slice(0, 20) : ''
    };
    if (!out.omen.id) out.omen.day = '';
  }
  if (object(raw.chores) && Array.isArray(raw.chores.list)) {
    const list = raw.chores.list.filter(c => object(c) && CHORE_IDS.has(c.id)).slice(0, 3)
      .map(c => ({ id: c.id, have: Math.floor(finite(c.have, 0, 0, 999)), done: c.done === true }));
    out.chores = { day: typeof raw.chores.day === 'string' ? raw.chores.day.slice(0, 20) : '', list, bonus: raw.chores.bonus === true };
    if (!list.length) out.chores.day = '';
  }
  out.gameDay = typeof raw.gameDay === 'string' ? raw.gameDay.slice(0, 20) : '';
  out.gameSouls = Math.floor(finite(raw.gameSouls, 0, 0, 1e6));
  out.log = (Array.isArray(raw.log) ? raw.log : []).filter(entry => object(entry) && typeof entry.text === 'string')
    .slice(0, LOG_MAX)
    .map(entry => ({
      at: finite(entry.at, now, 0, now),
      title: String(entry.title || '').slice(0, 200),
      stamp: String(entry.stamp || '').slice(0, 40),
      tone: TONES.has(entry.tone) ? entry.tone : 'weird',
      text: entry.text.slice(0, 400),
      souls: Math.floor(finite(entry.souls, 0, 0, 999))
    }));
  return out;
}

export function mayhemState(state) {
  if (!object(state.mayhem)) state.mayhem = blankMayhem();
  return state.mayhem;
}

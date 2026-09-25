import { EMERGENCIES, CURIOS, RARITIES, RANKS, OMENS, CHORES, DUPLICATE_LINES } from '../content/mayhem.js';
import { mayhemState, QUEUE_MAX, LOG_MAX } from '../mayhem-state.js';
import { addNote, clamp, grantBonusTrust, localDayKey, petById } from '../state.js';
import { fileGrudge } from './achievements.js';

/* ================= THE MAYHEM LOOP =================
   A short loop layered over the slow one. The slow loop (needs, trust, notes)
   rewards patience; this one rewards opening the game at all:

     emergencies pile up while you are away   -> a reason to come back
     each one is a choice with a random result -> a reason to press the button
     results pay souls, sometimes a curio      -> a reason to keep going
     souls buy coffins, coffins hold curios    -> something to spend on
     lifetime souls raise the household rank   -> something to climb
     one omen and three chores per day         -> a reason to come back tomorrow

   Nothing here can be lost. Souls only go down when you spend them. */

export const EMERGENCY_EVERY_MS = 12 * 60 * 1000;
export const COFFIN_COST = 40;
export const CHORE_SOULS = 15;
export const CARE_SOULS = 2;
export const ROUNDS_SOULS = 3;
export const GAME_SOULS = 10;
export const BONUS_CURIO_CHANCE = 0.14;
export const FALLOUT = 22;
const RECENT_MAX = 14;

const listeners = [];
export function onMayhem(listener) { listeners.push(listener); return () => { const i = listeners.indexOf(listener); if (i >= 0) listeners.splice(i, 1); }; }
function emit(event) { for (const fn of listeners.slice()) { try { fn(event); } catch { /* a broken listener must not break the game */ } } }

export const CURIO_BY_ID = Object.fromEntries(CURIOS.map(c => [c.id, c]));
export const RARITY_BY_ID = Object.fromEntries(RARITIES.map(r => [r.id, r]));
export const EMERGENCY_BY_ID = Object.fromEntries(EMERGENCIES.map(e => [e.id, e]));
const OMEN_BY_ID = Object.fromEntries(OMENS.map(o => [o.id, o]));
const CHORE_BY_ID = Object.fromEntries(CHORES.map(c => [c.id, c]));

function seeded(text) {
  let h = 2166136261;
  for (const c of String(text)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}
const choose = (list, rnd = Math.random) => list[Math.floor(rnd() * list.length) % list.length];

/* ---------- rank ---------- */
export function rankIndexFor(lifetime) {
  let index = 0;
  RANKS.forEach((rank, i) => { if (lifetime >= rank.at) index = i; });
  return index;
}
export function rankInfo(state) {
  const m = mayhemState(state);
  const index = rankIndexFor(m.lifetime);
  const rank = RANKS[index], next = RANKS[index + 1] || null;
  const span = next ? next.at - rank.at : 1;
  const progress = next ? clamp((m.lifetime - rank.at) / span, 0, 1) : 1;
  return { index, rank, next, progress, toNext: next ? next.at - m.lifetime : 0 };
}

/* ---------- omen of the day ---------- */
export function todaysOmen(state, now = Date.now()) {
  const m = mayhemState(state);
  return m.omen.day === localDayKey(now) ? OMEN_BY_ID[m.omen.id] || null : null;
}
export function omenPending(state, now = Date.now()) {
  return (state.pets || []).length > 0 && mayhemState(state).omen.day !== localDayKey(now);
}
function omenEffect(state, effect, now) { return todaysOmen(state, now)?.effect === effect; }

export function omenGift(streak) { return 15 + 5 * Math.min(Math.max(streak, 1) - 1, 6); }

export function drawOmen(state, now = Date.now(), rnd = Math.random) {
  const m = mayhemState(state);
  const day = localDayKey(now);
  if (m.omen.day === day) return null;
  const yesterday = localDayKey(now - 86400000);
  const streak = m.omen.lastDay === yesterday ? m.omen.streak + 1 : 1;
  const omen = choose(OMENS.filter(o => o.id !== m.omen.id), rnd);
  m.omen = { day, id: omen.id, streak, lastDay: day };
  const gift = omenGift(streak);
  const rankUp = addSouls(state, gift);
  // Every seventh night in a row the house leaves something rarer on the step.
  const bonus = streak % 7 === 0 ? rollCurio(state, rnd, true) : null;
  ensureChores(state, now, rnd);
  return { omen, streak, gift, bonus, rankUp };
}

/* ---------- souls ---------- */
export function addSouls(state, amount) {
  const m = mayhemState(state);
  const n = Math.max(0, Math.floor(amount || 0));
  if (!n) return null;
  m.souls += n; m.lifetime += n;
  const index = rankIndexFor(m.lifetime);
  if (index > m.rank) {
    m.rank = index;
    const rankUp = { index, rank: RANKS[index] };
    emit({ type: 'rank', ...rankUp });
    return rankUp;
  }
  emit({ type: 'souls', amount: n });
  return null;
}

/* ---------- curios ---------- */
export function rollCurio(state, rnd = Math.random, lucky = false) {
  const m = mayhemState(state);
  const luck = lucky || omenEffect(state, 'luck');
  const weights = RARITIES.map(r => r.weight * (luck && r.id !== 'common' ? (r.id === 'uncommon' ? 1.4 : 2.6) : 1));
  let roll = rnd() * weights.reduce((a, b) => a + b, 0), rarity = RARITIES[0];
  for (let i = 0; i < RARITIES.length; i++) { roll -= weights[i]; if (roll <= 0) { rarity = RARITIES[i]; break; } }
  const pool = CURIOS.filter(c => c.rarity === rarity.id);
  // Prefer something new within the rolled rarity, so a lucky roll is not wasted on a repeat.
  const fresh = pool.filter(c => !m.curios[c.id]);
  const curio = choose(fresh.length && rnd() < 0.7 ? fresh : pool, rnd);
  const duplicate = !!m.curios[curio.id];
  m.curios[curio.id] = (m.curios[curio.id] || 0) + 1;
  let refund = 0, rankUp = null;
  if (duplicate) { refund = rarity.refund; rankUp = addSouls(state, refund); }
  return { curio, rarity, duplicate, refund, rankUp, quip: duplicate ? choose(DUPLICATE_LINES, rnd) : '' };
}
export function curioCount(state) { return Object.keys(mayhemState(state).curios).length; }

export function coffinCost(state, now = Date.now()) { return omenEffect(state, 'coffin', now) ? COFFIN_COST / 2 : COFFIN_COST; }
export function openCoffin(state, now = Date.now(), rnd = Math.random) {
  const m = mayhemState(state);
  const cost = coffinCost(state, now);
  if (m.souls < cost) return null;
  m.souls -= cost;
  m.coffins += 1;
  const result = rollCurio(state, rnd);
  const chores = deed(state, 'coffin', 1, now, rnd);
  return { ...result, cost, chores };
}

/* ---------- emergencies ---------- */
export function queueCap(state, now = Date.now()) { return omenEffect(state, 'extra', now) ? QUEUE_MAX : QUEUE_MAX - 1; }

function spawn(state, now, rnd) {
  const m = mayhemState(state);
  const pets = state.pets || [];
  if (!pets.length) return null;
  const taken = new Set(m.queue.map(q => q.id));
  const eligible = EMERGENCIES.filter(e => (!e.pair || pets.length >= 2) && !taken.has(e.id));
  const fresh = eligible.filter(e => !m.recent.includes(e.id));
  const template = choose(fresh.length ? fresh : eligible, rnd);
  if (!template) return null;
  // Spread the trouble around: residents already in the tray are chosen last.
  const busy = new Set(m.queue.flatMap(q => [q.a, q.b]));
  const idle = pets.filter(p => !busy.has(p.id));
  const a = choose(idle.length ? idle : pets, rnd);
  const others = pets.filter(p => p.id !== a.id);
  const b = template.pair ? choose(others, rnd) : null;
  const entry = { uid: ++m.serial, id: template.id, a: a.id, ...(b ? { b: b.id } : {}), at: now };
  m.queue.push(entry);
  m.recent.unshift(template.id);
  if (m.recent.length > RECENT_MAX) m.recent.length = RECENT_MAX;
  return entry;
}

// Called on every tick and on return. Emergencies arrive on a steady clock and
// pile up to the cap; a full tray stops the clock so nothing is wasted.
export function accrueMayhem(state, now = Date.now(), rnd = Math.random) {
  const m = mayhemState(state);
  const pets = state.pets || [];
  // Rehomed residents take their emergencies with them.
  m.queue = m.queue.filter(q => petById(state, q.a) && (!q.b || petById(state, q.b)));
  if (!pets.length) return 0;
  const cap = queueCap(state, now);
  let added = 0;
  // A brand new household starts with two things already going wrong.
  if (!m.nextAt) {
    for (let i = 0; i < 2 && m.queue.length < cap; i++) if (spawn(state, now, rnd)) added++;
    m.nextAt = now + EMERGENCY_EVERY_MS;
    return added;
  }
  while (m.queue.length < cap && now >= m.nextAt) {
    if (!spawn(state, m.nextAt, rnd)) break;
    added++;
    m.nextAt += EMERGENCY_EVERY_MS;
  }
  if (m.queue.length >= cap && m.nextAt < now) m.nextAt = now + EMERGENCY_EVERY_MS;
  return added;
}
// Impatience has a price. Poking the drawer costs more than an emergency
// usually pays, so it is for curio hunting rather than farming.
export const POKE_COST = 25;
export function pokeDrawer(state, now = Date.now(), rnd = Math.random) {
  const m = mayhemState(state);
  if (!(state.pets || []).length || m.souls < POKE_COST || m.queue.length >= queueCap(state, now)) return null;
  m.souls -= POKE_COST;
  return spawn(state, now, rnd);
}
export function nextEmergencyIn(state, now = Date.now()) {
  const m = mayhemState(state);
  if (m.queue.length >= queueCap(state, now)) return 0;
  return Math.max(0, m.nextAt - now);
}

export function fill(text, a, b) {
  return String(text).replace(/\{a\}/g, a ? a.name : 'Someone').replace(/\{b\}/g, b ? b.name : 'someone else');
}

export function describeEmergency(state, entry) {
  const template = EMERGENCY_BY_ID[entry?.id];
  if (!template) return null;
  const a = petById(state, entry.a), b = entry.b ? petById(state, entry.b) : null;
  if (!a || (template.pair && !b)) return null;
  return { entry, template, a, b, title: fill(template.title, a, b), choices: template.choices.map(c => fill(c.label, a, b)) };
}

function applyNeeds(pet, delta) {
  if (!pet || !delta) return;
  for (const need of ['food', 'fuss', 'clean']) {
    if (Number.isFinite(delta[need]) && pet.needs) pet.needs[need] = clamp((pet.needs[need] || 0) + delta[need], 0, 100);
  }
}

export function resolveEmergency(state, uid, choiceIndex, now = Date.now(), rnd = Math.random) {
  const m = mayhemState(state);
  const at = m.queue.findIndex(q => q.uid === uid);
  if (at < 0) return null;
  const info = describeEmergency(state, m.queue[at]);
  m.queue.splice(at, 1);
  // A tray that was full kept its clock stopped; restart it from now rather
  // than refilling the moment a card is cleared.
  if (m.nextAt < now) m.nextAt = now + EMERGENCY_EVERY_MS;
  if (!info) return null;
  const choice = info.template.choices[choiceIndex];
  if (!choice) return null;
  const outcome = choose(choice.outcomes, rnd);
  const { a, b } = info;
  const text = fill(outcome.text, a, b);
  const souls = (outcome.souls || 0) * (omenEffect(state, 'mayhem', now) ? 2 : 1);
  applyNeeds(a, outcome.a);
  applyNeeds(b, outcome.b);
  // Bad endings leave a mess, so the slow loop has something to do afterwards.
  let fallout = null;
  if (outcome.tone === 'bad' && !outcome.a) {
    const need = ['food', 'fuss', 'clean'][Math.floor(rnd() * 3) % 3];
    applyNeeds(a, { [need]: -FALLOUT });
    fallout = { name: a.name, need };
  }
  let trust = 0;
  if (outcome.bond === 'a') trust = grantBonusTrust(a, 1, now);
  let grudge = null;
  const grudger = outcome.grudge === 'a' ? a : outcome.grudge === 'b' ? b : null;
  if (grudger && fileGrudge(state, grudger, info.title.slice(0, 70), now)) grudge = grudger.name;
  const rankUp = addSouls(state, souls);
  let curio = null;
  if (outcome.curio || rnd() < BONUS_CURIO_CHANCE) curio = rollCurio(state, rnd);
  m.resolved += 1;
  m.log.unshift({ at: now, title: info.title, stamp: outcome.stamp, tone: outcome.tone, text, souls });
  if (m.log.length > LOG_MAX) m.log.length = LOG_MAX;
  addNote(state, outcome.stamp + '. ' + text, 'the incident report', 'note');
  const chores = deed(state, 'mayhem', 1, now, rnd);
  return { title: info.title, choice: fill(choice.label, a, b), stamp: outcome.stamp, tone: outcome.tone, text, souls, trust, grudge, curio, fallout, rankUp: rankUp || curio?.rankUp || null, chores, a, b };
}

/* ---------- daily chores ---------- */
export function ensureChores(state, now = Date.now(), rnd = Math.random) {
  const m = mayhemState(state);
  const day = localDayKey(now);
  if (m.chores.day === day && m.chores.list.length) return m.chores;
  // The day's chores are the same however many times the page loads today.
  rnd = seeded(day);
  const picked = [], deeds = new Set();
  const pool = CHORES.slice();
  while (picked.length < 3 && pool.length) {
    const chore = pool.splice(Math.floor(rnd() * pool.length) % pool.length, 1)[0];
    const family = chore.deed.split(':')[0];
    if (deeds.has(chore.deed) || (family === 'mayhem' && deeds.has('mayhem'))) continue;
    deeds.add(chore.deed); deeds.add(family);
    picked.push({ id: chore.id, have: 0, done: false });
  }
  m.chores = { day, list: picked, bonus: false };
  return m.chores;
}
export function choreInfo(entry) {
  const chore = CHORE_BY_ID[entry.id];
  return chore ? { ...chore, have: Math.min(entry.have, chore.need), done: entry.done } : null;
}

// Every countable act in the game passes through here. `kind` is specific
// ('care:food'); a chore on the general family ('care') also counts it.
export function deed(state, kind, amount = 1, now = Date.now(), rnd = Math.random) {
  if (!state || !(state.pets || []).length) return [];
  const chores = ensureChores(state, now, rnd);
  const family = String(kind).split(':')[0];
  const completed = [];
  for (const entry of chores.list) {
    const chore = CHORE_BY_ID[entry.id];
    if (!chore || entry.done || (chore.deed !== kind && chore.deed !== family)) continue;
    entry.have = Math.min(chore.need, entry.have + amount);
    if (entry.have >= chore.need) {
      entry.done = true;
      const souls = CHORE_SOULS * (omenEffect(state, 'chores', now) ? 2 : 1);
      addSouls(state, souls);
      completed.push({ chore, souls });
      emit({ type: 'chore', chore, souls });
    }
  }
  if (!chores.bonus && chores.list.length && chores.list.every(c => c.done)) {
    chores.bonus = true;
    const prize = rollCurio(state, rnd);
    completed.push({ bonus: true, prize });
    emit({ type: 'chores-complete', prize });
  }
  return completed;
}

// Small, steady pay for the ordinary acts, so the slow loop feeds the fast one.
export function rewardCare(state, need, gained, now = Date.now()) {
  if (!(gained > 0)) return 0;
  const souls = CARE_SOULS * (omenEffect(state, 'care', now) ? 2 : 1);
  addSouls(state, souls);
  deed(state, 'care:' + need, 1, now);
  return souls;
}
export function rewardRounds(state, now = Date.now()) { addSouls(state, ROUNDS_SOULS); deed(state, 'rounds', 1, now); return ROUNDS_SOULS; }
export function rewardGame(state, now = Date.now()) { addSouls(state, GAME_SOULS); deed(state, 'game', 1, now); return GAME_SOULS; }
export function rewardCheck(state, now = Date.now()) { deed(state, 'check', 1, now); }

import {
  SETS, SET_BY_ID, CABINET_FRAMES, FRAME_BY_ID, PORTRAIT_FRAMES, PORTRAIT_BY_ID, COMMISSIONS, COMMISSION_BY_ID,
  EXCHANGE_DECOR, titleText, CURIO_NAMES
} from '../content/collections.js';
import { RELICS } from '../content/life.js';
import { VISITORS } from '../content/stories.js';
import { NEW_DECOR } from '../content/decor.js';
import { ALMANAC_CURIO_BY_ID } from '../content/almanac.js';
import { SEASONAL_CURIOS } from '../content/seasons.js';
import { collectionsState, exchangeState } from '../almanac-state.js';
import { mayhemState } from '../mayhem-state.js';
import { addSouls } from './mayhem.js';
import { spendSouls } from './almanac.js';
import { legacyTitleIds, spendTokens, tokenBalance } from './legacy.js';
import { addNote, petById } from '../state.js';

/* ================= COLLECTIONS =================
   Sets group things the game already hands out. Whether a thing is owned is read
   straight from where the game keeps it (the cabinet, the expedition keepsakes,
   the visitors’ souvenirs), so a set can never disagree with the shelf. */

const RELIC_BY_ID = Object.fromEntries(RELICS.map(r => [r.id, r]));
const VISITOR_BY_ID = Object.fromEntries(VISITORS.map(v => [v.id, v]));
const SEASONAL_BY_ID = Object.fromEntries(SEASONAL_CURIOS.map(c => [c.id, c]));

export function memberInfo(state, ref) {
  const kind = ref[0], id = ref.slice(2);
  if (kind === 'c') {
    const have = (mayhemState(state).curios[id] || 0) > 0;
    const curio = ALMANAC_CURIO_BY_ID[id] || SEASONAL_BY_ID[id];
    return { ref, kind: 'curio', id, owned: have, name: curio ? curio.name : CURIO_NAMES[id] || id, curio };
  }
  if (kind === 'r') return { ref, kind: 'relic', id, owned: !!state.life?.relics?.includes(id), name: RELIC_BY_ID[id]?.name || id };
  return { ref, kind: 'souvenir', id, owned: !!state.stories?.collection?.some(c => c.id === id), name: VISITOR_BY_ID[id]?.gift || id };
}

export function setProgress(state, set) {
  const members = set.members.map(ref => memberInfo(state, ref));
  const have = members.filter(m => m.owned).length;
  const complete = have === members.length;
  const claimed = collectionsState(state).claimed.includes(set.id);
  return { set, members, have, total: members.length, complete, claimed, claimable: complete && !claimed };
}
export const allSets = state => SETS.map(set => setProgress(state, set));
export const completedSetCount = state => allSets(state).filter(p => p.complete).length;
export const claimableSets = state => allSets(state).filter(p => p.claimable);

export function titlesOwned(state) {
  return [...new Set([...exchangeState(state).titles, ...legacyTitleIds(state)])];
}
export function activeTitle(state) {
  const ex = exchangeState(state);
  return ex.title && titlesOwned(state).includes(ex.title) ? ex.title : '';
}
export function equipTitle(state, id) {
  const ex = exchangeState(state);
  if (id && !titlesOwned(state).includes(id)) return false;
  ex.title = id || '';
  return true;
}

// Finish a set and take the prize: souls, a title, and for some sets a display frame.
export function claimSet(state, setId) {
  const set = SET_BY_ID[setId], p = set && setProgress(state, set);
  if (!p || !p.claimable) return null;
  collectionsState(state).claimed.push(set.id);
  const ex = exchangeState(state);
  const rankUp = addSouls(state, set.souls);
  let title = '', frame = '';
  if (set.title && !ex.titles.includes('set:' + set.id)) { ex.titles.push('set:' + set.id); title = set.title; }
  if (set.frame && !ex.frames.includes(set.frame)) { ex.frames.push(set.frame); frame = FRAME_BY_ID[set.frame].name; }
  return { set, souls: set.souls, title, frame, rankUp };
}

/* ================= THE COLLECTOR’S EXCHANGE =================
   Where souls and Legacy Tokens go once the cabinet is full. Every price is
   fixed, nothing is limited-time, and nothing here pays anything back: it is a
   sink on purpose. Ownership of rooms, woods, walls and accents is the
   `decor.owned` list; the rest lives in `state.exchange`. */

const priced = (item) => ({ cost: item.cost || 0, tokens: item.tokens || 0 });
export function canAfford(state, item) {
  return mayhemState(state).souls >= (item.cost || 0) && tokenBalance(state) >= (item.tokens || 0);
}
function pay(state, item) {
  if (!canAfford(state, item)) return false;
  if (item.cost && !spendSouls(state, item.cost)) return false;
  if (item.tokens && !spendTokens(state, item.tokens)) return false;
  return true;
}

export function frameOwned(state, id) { return id === 'plain' || exchangeState(state).frames.includes(id); }
export function activeFrame(state) { const f = exchangeState(state).frame; return frameOwned(state, f) ? f : 'plain'; }
export function buyFrame(state, id) {
  const f = FRAME_BY_ID[id];
  if (!f || f.reward || frameOwned(state, id) || !pay(state, f)) return null;
  exchangeState(state).frames.push(id);
  return f;
}
export function equipFrame(state, id) {
  if (!FRAME_BY_ID[id] || !frameOwned(state, id)) return false;
  exchangeState(state).frame = id;
  return true;
}

export function portraitOwned(state, id) { return id === 'plain' || exchangeState(state).portraits.includes(id); }
export function portraitFor(state, petId) { const ex = exchangeState(state); return ex.portrait[petId] && portraitOwned(state, ex.portrait[petId]) ? ex.portrait[petId] : 'plain'; }
export function buyPortraitFrame(state, id) {
  const f = PORTRAIT_BY_ID[id];
  if (!f || portraitOwned(state, id) || !pay(state, f)) return null;
  exchangeState(state).portraits.push(id);
  return f;
}
export function equipPortraitFrame(state, petId, id) {
  const ex = exchangeState(state);
  if (!petById(state, petId) || !PORTRAIT_BY_ID[id] || !portraitOwned(state, id)) return false;
  if (id === 'plain') delete ex.portrait[petId]; else ex.portrait[petId] = id;
  return true;
}

export function decorOwned(state, key) {
  const owned = state.decor?.owned;
  // Anything that was never sold is owned by everybody, whatever the save says.
  return !NEW_DECOR[key] || (Array.isArray(owned) && owned.includes(key));
}
export function buyDecor(state, key) {
  const item = NEW_DECOR[key];
  if (!item || item.source !== 'exchange' || decorOwned(state, key) || !pay(state, item)) return null;
  state.decor.owned = [...(state.decor.owned || []), key];
  return item;
}

export function commissionDone(state, id) { return exchangeState(state).commissions.includes(id); }
// Place a commission. It costs souls, leaves a document on the note board and a title.
export function placeCommission(state, id, now = Date.now()) {
  const c = COMMISSION_BY_ID[id], ex = exchangeState(state);
  if (!c || commissionDone(state, id) || !pay(state, c)) return null;
  ex.commissions.push(id);
  if (!ex.titles.includes('cm:' + id)) ex.titles.push('cm:' + id);
  addNote(state, c.done, 'the commissions office', 'arrival');
  return c;
}

/* What the Exchange offers right now, for the screen. */
export function exchangeCatalog(state) {
  const souls = mayhemState(state).souls, tokens = tokenBalance(state);
  const row = (item, owned, extra = {}) => ({ ...item, ...priced(item), owned, can: !owned && souls >= (item.cost || 0) && tokens >= (item.tokens || 0), ...extra });
  return {
    souls, tokens,
    frames: CABINET_FRAMES.map(f => row(f, frameOwned(state, f.id), { active: activeFrame(state) === f.id, locked: !!f.reward && !frameOwned(state, f.id) })),
    portraits: PORTRAIT_FRAMES.map(f => row(f, portraitOwned(state, f.id))),
    decor: ['room', 'wood', 'wall', 'accent'].flatMap(kind => EXCHANGE_DECOR[kind].map(item => row({ ...item, key: kind + ':' + item.id, kind }, decorOwned(state, kind + ':' + item.id)))),
    commissions: COMMISSIONS.map(c => row(c, commissionDone(state, c.id)))
  };
}

export { titleText };

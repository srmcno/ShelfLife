// Trading with friends, on the save: spares, the wishlist, escrow, and
// applying a sealed trade exactly once.
//
// Nothing here touches the network. src/cloud/trades.js talks to the server,
// src/cloud/trade-sync.js decides what to apply, and src/ui/trades.js draws it.
//
// Escrow, in plain words. Offering something puts it on hold here (curios are
// held aside and stop counting as spare; a resident is "packing to leave" and
// cannot be offered again) while it stays on the shelf. The server decides
// whether the offer is accepted. When it is, each side applies it on its next
// look at the trade: the sender's things leave, the receiver's arrive. The
// trade id goes into `applied`, so a replay, a second device or a restored
// backup finds it there and changes nothing. A declined, cancelled, countered
// or expired offer just comes off hold.
import { tradesState, TRADE_CURIO_IDS, WISHLIST_MAX, APPLIED_MAX, PORTRAIT_MAX, WAITING_MAX, NOTICE_MAX, MAX_ART_CHARS, tradeArt } from '../trade-state.js';
import { mayhemState } from '../mayhem-state.js';
import { addNote, defaultNeeds, normalizePetArt, clamp } from '../state.js';
import { CURIO_BY_ID } from './mayhem.js';
import { storyState, remember } from './stories.js';
import { recordScene } from './life.js';
import { residentMemories } from './resident-memory.js';
import { TRAIT_BY_ID } from '../content/traits.js';
import { LAST_LINES, FIRST_LINES, WELCOME_LINES, FAREWELL_LINES } from '../content/trades.js';

export const TRADE_LOCK_MS = 7 * 86400000;
export const CURIOS_PER_SIDE = 3;
const DAY = 86400000;
const PNG = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;

// ---------------------------------------------------------------------------
// Words picked from the trade id, the same everywhere
// ---------------------------------------------------------------------------
function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
export const fill = (template, vars) => template.replace(/\{(\w+)\}/g, (m, key) => vars[key] ?? m);
export function tradeLine(pool, key, vars) { return fill(pool[hash(key) % pool.length], vars); }
export const lastLineFor = (tradeId, name, to) => tradeLine(LAST_LINES, tradeId + ':last', { name, to: to || 'them' });
export const firstLineFor = (tradeId, name, from) => tradeLine(FIRST_LINES, tradeId + ':first', { name, from: from || 'The old shelf' });
export const curioName = id => CURIO_BY_ID[id]?.name || 'An unknown curio';
export function curioList(items) {
  const parts = items.map(({ id, n }) => (n > 1 ? n + ' × ' : '') + curioName(id));
  return parts.length < 2 ? parts.join('') : parts.slice(0, -1).join(', ') + ' and ' + parts.at(-1);
}
export const shortDate = ms => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

// ---------------------------------------------------------------------------
// Curios: what is owned, held and spare
// ---------------------------------------------------------------------------
export const owned = (state, id) => Math.max(0, Math.floor(mayhemState(state).curios[id] || 0));
export function heldCurios(state) {
  const held = {};
  for (const e of Object.values(tradesState(state).escrow)) for (const [id, n] of Object.entries(e.curios)) held[id] = (held[id] || 0) + n;
  return held;
}
// A spare is a copy beyond the first that no offer is holding. The last copy
// of anything never leaves the cabinet.
export function spareCount(state, id, held = heldCurios(state)) { return Math.max(0, owned(state, id) - 1 - (held[id] || 0)); }
export function spares(state) {
  const held = heldCurios(state), out = {};
  for (const id of Object.keys(mayhemState(state).curios)) {
    const n = spareCount(state, id, held);
    if (n > 0 && TRADE_CURIO_IDS.has(id)) out[id] = Math.min(n, 99);
  }
  return out;
}
// What friends see: the wishlist and the spares, small and sorted so an
// unchanged book hashes the same.
export function tradeBook(state) {
  const s = spares(state);
  return { wishlist: [...tradesState(state).wishlist], spares: Object.fromEntries(Object.keys(s).sort().slice(0, 60).map(id => [id, s[id]])) };
}
export function toggleWish(state, id) {
  const t = tradesState(state);
  if (!TRADE_CURIO_IDS.has(id)) return false;
  const at = t.wishlist.indexOf(id);
  if (at >= 0) { t.wishlist.splice(at, 1); return 'removed'; }
  if (t.wishlist.length >= WISHLIST_MAX) return 'full';
  t.wishlist.push(id);
  return 'added';
}
export const onWishlist = (state, id) => tradesState(state).wishlist.includes(id);

// ---------------------------------------------------------------------------
// Residents: who may leave
// ---------------------------------------------------------------------------
export function packingFor(state, petId) {
  const t = state?.trades;
  if (!t || !t.escrow || !petId) return null;
  for (const [id, e] of Object.entries(t.escrow)) if (e.residentId === petId) return { id, ...e };
  return null;
}
export const stayers = state => (state.pets || []).filter(p => !packingFor(state, p.id));
export const lockedUntil = pet => pet?.arrivedByTrade ? (pet.arrivedByTrade.at || 0) + TRADE_LOCK_MS : 0;
export const freeSlot = state => (state.slots || []).indexOf(null);
export function drawingFits(pet) {
  const body = pet?.art?.creature ? '' : pet?.art?.body || '';
  return !body || (body.length <= MAX_ART_CHARS && PNG.test(body));
}
// '' when this resident may be offered (or given in a swap), otherwise why not.
export function residentBlock(state, pet, now = Date.now()) {
  if (!pet) return 'That resident is not on this shelf.';
  const packing = packingFor(state, pet.id);
  if (packing) return pet.name + ' is already packed for an offer to ' + (packing.toName || 'a friend') + '.';
  if (lockedUntil(pet) > now) {
    const days = Math.max(1, Math.ceil((lockedUntil(pet) - now) / DAY));
    return pet.name + ' only just arrived. It can move again in ' + days + (days === 1 ? ' day.' : ' days.');
  }
  if (stayers(state).length <= 1) return pet.name + ' is the last resident here. Someone has to stay and complain.';
  if (!drawingFits(pet)) return pet.name + '’s drawing is too large to post. Redraw it smaller to send it.';
  return '';
}

// ---------------------------------------------------------------------------
// Escrow
// ---------------------------------------------------------------------------
// `side` is what this player gives: { curios: [{ id, n }], resident: { id } | null }.
export function holdOffer(state, trade, { me, side, accepting = false } = {}) {
  const t = tradesState(state);
  const curios = {};
  for (const { id, n } of side.curios || []) if (TRADE_CURIO_IDS.has(id)) curios[id] = Math.min(3, (curios[id] || 0) + n);
  t.escrow[trade.id] = { user: me || '', to: (trade.from === me ? trade.to : trade.from) || '', toName: (trade.from === me ? trade.toName : trade.fromName) || '',
    curios, residentId: side.resident?.id || '', at: trade.createdAt || Date.now(), ...(accepting ? { accepting: true } : {}) };
  return t.escrow[trade.id];
}
export function releaseOffer(state, id) {
  const t = tradesState(state);
  if (!t.escrow[id]) return false;
  delete t.escrow[id];
  return true;
}
export const isApplied = (state, id) => tradesState(state).applied.some(a => a.id === id);
export function notice(state, n) {
  const t = tradesState(state);
  t.notices = [n, ...t.notices.filter(x => !(x.id === n.id && x.kind === n.kind))].slice(0, NOTICE_MAX);
}
export function dismissNotice(state, id) {
  const t = tradesState(state), before = t.notices.length;
  t.notices = t.notices.filter(n => n.id !== id);
  return before !== t.notices.length;
}

// ---------------------------------------------------------------------------
// The framed portrait: what a departing resident leaves behind
// ---------------------------------------------------------------------------
const pairKey = (a, b) => [a, b].sort().join('|');
export function residentSummary(state, pet, now = Date.now()) {
  const lines = [];
  const days = Math.max(0, Math.floor((now - (pet.born || now)) / DAY));
  const names = (pet.names || []).map(n => n.name).filter(Boolean);
  lines.push('Lived here ' + (days === 1 ? 'one day' : days + ' days') + (names.length > 1 ? ', as ' + [...new Set(names)].join(', then ') : '') + '.');
  lines.push('Trust ' + (pet.bond || 0) + ' of 25. ' + (pet.grudges ? pet.grudges + (pet.grudges === 1 ? ' grievance' : ' grievances') + ' on file, all still open.' : 'No grievances on file, which is suspicious.'));
  const rel = state.stories?.relationships || {}, friction = state.friction || {};
  const others = (state.pets || []).filter(o => o.id !== pet.id).map(o => {
    const r = rel[pairKey(pet.id, o.id)] || {}, f = friction[pairKey(pet.id, o.id)] || {};
    return { o, warmth: (r.time || 0) / 60000 + (r.plots || 0) * 30, fights: f.n || 0 };
  });
  const close = others.filter(x => x.warmth >= 5).sort((a, b) => b.warmth - a.warmth)[0];
  if (close) lines.push('Closest to ' + close.o.name + '. They will be told gently, by someone else.');
  const foe = others.filter(x => x.fights >= 2).sort((a, b) => b.fights - a.fights)[0];
  if (foe && foe !== close) lines.push('Never resolved things with ' + foe.o.name + '. Neither intends to.');
  // In its own words: the memories the card shows, kept as it said them.
  for (const m of residentMemories(state, pet, now).slice(0, 2)) lines.push('“' + m.text + '”');
  return lines.slice(0, 6).map(l => l.slice(0, 240));
}
function portraitFor(state, pet, snapshot, trade, partner, now) {
  const source = pet || snapshot || {};
  return {
    id: trade.id, petId: source.id || '', name: (source.name || 'Someone').slice(0, 22), to: partner, at: trade.closedAt || now,
    art: tradeArt(source.art), lastLine: lastLineFor(trade.id, source.name || 'Someone', partner),
    lines: pet ? residentSummary(state, pet, now) : ['Left by bill of sale before this copy of the shelf could say goodbye.']
  };
}

// ---------------------------------------------------------------------------
// The arriving resident: same name, look, traits and personality; fresh needs
// ---------------------------------------------------------------------------
export function arrivalFor(snapshot, trade, from, now = Date.now()) {
  const stats = {};
  for (const k of ['cute', 'menace', 'damp', 'mystique']) stats[k] = clamp(Number.isFinite(snapshot.stats?.[k]) ? Math.round(snapshot.stats[k]) : 5, 1, 10);
  const name = (typeof snapshot.name === 'string' && snapshot.name.trim() ? snapshot.name.trim() : 'Someone').slice(0, 22);
  return {
    id: 'tr-' + trade.id, name, art: normalizePetArt(tradeArt(snapshot.art)),
    traits: (Array.isArray(snapshot.traits) ? snapshot.traits : []).filter(t => Object.hasOwn(TRAIT_BY_ID, t)).slice(0, 6),
    stats, bio: typeof snapshot.bio === 'string' && snapshot.bio.trim() ? snapshot.bio.slice(0, 600) : 'It arrived by bill of sale, without references.',
    born: now, needs: defaultNeeds(), bond: 0, cared: 0, grudges: 0, grudgeStage: 0,
    names: [{ name, at: now }], arrivedByTrade: { id: trade.id, at: trade.closedAt || now, from: (from || '').slice(0, 24) }
  };
}
function seat(state, pet, now) {
  const slot = freeSlot(state);
  if (slot < 0 || (state.pets || []).some(p => p.id === pet.id)) return false;
  state.pets.push(pet);
  state.slots[slot] = pet.id;
  return true;
}
// Residents who arrived to a full shelf move in as soon as there is room.
export function seatWaiting(state, now = Date.now()) {
  const t = tradesState(state), seated = [];
  t.waiting = t.waiting.filter(w => {
    if (state.pets.some(p => p.id === w.pet.id)) return false;
    if (!seat(state, w.pet, now)) return true;
    addNote(state, w.pet.name + ' has been let in from the doorstep, where it was waiting with its box and its opinions.', 'the shelf', 'arrival');
    seated.push(w.pet);
    return false;
  });
  return seated;
}

// ---------------------------------------------------------------------------
// Applying a sealed trade, once
// ---------------------------------------------------------------------------
function removeResident(state, pet, now) {
  const memories = storyState(state);
  memories.residents.unshift({ id: pet.id, name: pet.name, at: now, names: pet.names || [], grudges: pet.grudges, bond: pet.bond });
  memories.residents = memories.residents.slice(0, 36);
  state.pets = state.pets.filter(p => p.id !== pet.id);
  state.slots = state.slots.map(s => s === pet.id ? null : s);
  const m = state.mayhem;
  if (m && Array.isArray(m.queue)) m.queue = m.queue.filter(q => q.a !== pet.id && q.b !== pet.id);
}

/* `trade` is a read trade (src/cloud/trades.js readTrade) with its snapshots.
   Returns what happened, or null if this shelf already has it. `fresh` means
   this device just made the change (an accept here), so there is nothing to
   explain; otherwise a departure without escrow on this copy is explained. */
export function applyTrade(state, trade, { me, now = Date.now(), fresh = false } = {}) {
  if (!trade || trade.status !== 'accepted' || isApplied(state, trade.id)) return null;
  if (trade.from !== me && trade.to !== me) return null;
  const t = tradesState(state), m = mayhemState(state);
  const sender = trade.from === me;
  const mine = sender ? trade.give : trade.want, theirs = sender ? trade.want : trade.give;
  const partner = (sender ? trade.toName : trade.fromName) || 'a friend';
  const hadEscrow = !!t.escrow[trade.id];
  const result = { id: trade.id, partner, kind: trade.kind, curiosOut: [], curiosIn: [], departed: null, arrived: null, restored: false };

  for (const { id, n } of mine.curios) {
    const have = Math.max(0, Math.floor(m.curios[id] || 0));
    const out = Math.min(have, n);
    if (have - n > 0) m.curios[id] = have - n; else delete m.curios[id];
    if (out) result.curiosOut.push({ id, n: out });
  }
  for (const { id, n } of theirs.curios) {
    if (!TRADE_CURIO_IDS.has(id)) continue;
    m.curios[id] = Math.min(999, Math.max(0, Math.floor(m.curios[id] || 0)) + n);
    result.curiosIn.push({ id, n });
  }
  if (mine.resident) {
    const pet = state.pets.find(p => p.id === mine.resident.id) || null;
    const portrait = portraitFor(state, pet, mine.resident, trade, partner, now);
    if (!t.portraits.some(p => p.id === trade.id)) t.portraits = [portrait, ...t.portraits].slice(0, PORTRAIT_MAX);
    if (pet) {
      removeResident(state, pet, now);
      result.restored = !hadEscrow && !fresh;
    }
    result.departed = { name: portrait.name, lastLine: portrait.lastLine, present: !!pet };
  }
  if (theirs.resident) {
    const snapshot = theirs.resident;
    if (!snapshot.placeholder) {
      const pet = arrivalFor(snapshot, trade, partner, now);
      const firstLine = firstLineFor(trade.id, pet.name, partner);
      let waiting = false;
      if (!state.pets.some(p => p.id === pet.id)) {
        if (!seat(state, pet, now)) {
          waiting = true;
          if (!t.waiting.some(w => w.trade === trade.id)) t.waiting = [...t.waiting, { trade: trade.id, pet, at: now }].slice(-WAITING_MAX);
        }
        addNote(state, tradeLine(WELCOME_LINES, trade.id + ':welcome', { name: pet.name, from: partner }), 'the shelf', 'arrival');
        addNote(state, firstLine, pet.name, 'note');
        if (!waiting) recordScene(state, 'trade', 'Moved in by bill of sale', pet.name + ' arrived from ' + partner + '’s shelf with fresh needs and old opinions. Its first words here: ' + firstLine, [pet.id], now);
      }
      result.arrived = { pet, firstLine, waiting };
    } else {
      // Snapshots are kept for 90 days. After that only the record of the trade remains.
      result.arrived = { pet: null, lost: true, name: snapshot.name || 'Someone' };
    }
  }

  // Notes, the museum archive, and the postbox notice.
  if (result.departed?.present) {
    addNote(state, result.departed.name + ' has gone to live on ' + partner + '’s shelf. Last words: ' + result.departed.lastLine, 'the undertaker', 'note');
    if (state.pets.length) addNote(state, tradeLine(FAREWELL_LINES, trade.id + ':farewell', { name: result.departed.name, to: partner }), 'the shelf', 'angry');
  }
  if (result.curiosOut.length) addNote(state, curioList(result.curiosOut) + ' left the cabinet for ' + partner + '’s shelf, wrapped in yesterday’s obituaries.', 'the undertaker', 'note');
  if (result.curiosIn.length) addNote(state, curioList(result.curiosIn) + ' arrived from ' + partner + '’s shelf. The cabinet has made room by sulking.', 'the undertaker', 'note');
  const summary = [
    result.departed ? result.departed.name + ' went to ' + partner + '.' : '',
    result.curiosOut.length ? curioList(result.curiosOut) + ' went to ' + partner + '.' : '',
    result.arrived?.pet ? result.arrived.pet.name + ' came from ' + partner + '.' : result.arrived?.lost ? result.arrived.name + ' was lost in the post. Only the paperwork arrived.' : '',
    result.curiosIn.length ? curioList(result.curiosIn) + ' came from ' + partner + '.' : ''
  ].filter(Boolean).join(' ');
  remember(state, 'A bill of sale', summary || 'A trade with ' + partner + ' was sealed.', now, 'trade');
  if (result.restored) {
    const name = result.departed.name;
    notice(state, { id: trade.id, kind: 'restored', at: now, title: name + ' lives on ' + partner + '’s shelf now',
      text: 'This copy of the shelf still had ' + name + ', but ' + name + ' has lived on ' + partner + '’s shelf since ' + shortDate(trade.closedAt || now) +
        ', by bill of sale. ' + name + ' cannot be in two places, so the portrait is in the Memory museum instead.' });
  } else {
    notice(state, { id: trade.id, kind: 'sealed', at: now, title: 'Sealed with ' + partner, text: summary,
      ...(result.departed ? { last: result.departed.lastLine } : {}), ...(result.arrived?.firstLine ? { first: result.arrived.firstLine } : {}) });
  }
  if (result.arrived?.waiting) notice(state, { id: trade.id, kind: 'arrived-waiting', at: now, title: result.arrived.pet.name + ' is waiting on the doorstep',
    text: 'The shelf is full. ' + result.arrived.pet.name + ' moves in as soon as a slot is free.' });

  delete t.escrow[trade.id];
  t.applied = [{ id: trade.id, at: trade.closedAt || now }, ...t.applied].slice(0, APPLIED_MAX);
  return result;
}

// Forget applied records the server has long since forgotten too (it keeps
// sealed trades in its sync window for 60 days). Measured on the server's clock.
export function pruneApplied(state, serverNow) {
  if (!Number.isFinite(serverNow) || serverNow <= 0) return;
  const t = tradesState(state);
  t.applied = t.applied.filter(a => !a.at || a.at > serverNow - 75 * DAY);
}

const RELEASE_TEXT = {
  declined: (to) => to + ' declined your offer. Everything you offered is back where it was.',
  expired: (to) => 'Your offer to ' + to + ' went unanswered for seven days and expired. Everything is back on the shelf, slightly dustier.',
  cancelled: (to) => 'Your offer to ' + to + ' was withdrawn. Everything is back where it was.',
  countered: (to) => to + ' answered your offer with a counter-offer. Your side is released until you decide.'
};
// Takes something off hold, and tells the player why when they did not do it themselves.
export function releaseWithNotice(state, id, kind, now = Date.now()) {
  const e = tradesState(state).escrow[id];
  if (!e) return false;
  releaseOffer(state, id);
  if (!e.accepting && RELEASE_TEXT[kind]) notice(state, { id, kind, at: now, title: ({ declined: 'Declined', expired: 'Expired', cancelled: 'Withdrawn', countered: 'Countered' })[kind] + ': ' + (e.toName || 'a friend'), text: RELEASE_TEXT[kind](e.toName || 'Your friend') });
  return true;
}

// ---------------------------------------------------------------------------
// Before asking the server: can this offer be made, can this one be accepted?
// Both answer '' or a sentence for the player. The server checks again.
// ---------------------------------------------------------------------------
const total = map => Object.values(map || {}).reduce((n, v) => n + v, 0);
// draft: { mode: 'curio' | 'resident', give: { id: n }, want: { id: n }, giveResident: petId, wantResident: { id, name } | null }
export function offerBlock(state, draft, now = Date.now()) {
  if (draft.mode === 'resident') {
    const pet = (state.pets || []).find(p => p.id === draft.giveResident);
    if (!pet) return 'Choose which of your residents would go.';
    return residentBlock(state, pet, now);
  }
  if (!total(draft.give)) return 'Choose at least one of your spares to offer.';
  if (total(draft.give) > CURIOS_PER_SIDE || total(draft.want) > CURIOS_PER_SIDE) return 'Three curios each way at most. The undertaker has small hands.';
  const held = heldCurios(state);
  for (const [id, n] of Object.entries(draft.give)) {
    if (n > spareCount(state, id, held)) return 'You do not have ' + (n > 1 ? n + ' spare ' : 'a spare ') + curioName(id) + ' to offer.';
  }
  return '';
}
export function acceptBlock(state, trade, me, now = Date.now()) {
  if (!trade || trade.status !== 'open') return 'That offer has already been settled.';
  if (trade.to !== me) return 'That offer is not yours to answer.';
  if (trade.unknown) return 'This offer includes a curio your edition of the game does not know yet. Update the game, then come back to it.';
  const held = heldCurios(state);
  for (const { id, n } of trade.want.curios) {
    if (n > spareCount(state, id, held)) return 'You no longer have ' + (n > 1 ? n + ' spare ' : 'a spare ') + curioName(id) + '. Decline it, or counter with something you do have.';
  }
  if (trade.want.resident) {
    const pet = (state.pets || []).find(p => p.id === trade.want.resident.id);
    if (!pet) return trade.want.resident.name + ' is not on your shelf any more.';
    const why = residentBlock(state, pet, now);
    if (why) return why;
  } else if (trade.give.resident && freeSlot(state) < 0) {
    return 'Your shelf is full. Make room before you take in a resident.';
  }
  return '';
}
// What this player gives in a trade, for escrow.
export const mySide = (trade, me) => trade.from === me ? trade.give : trade.want;

// Trading with friends, on screen. Plugs into the Friends sheet only through
// src/ui/social-registry.js:
//   * a friend action, "Propose a trade";
//   * a postbox source: offers, counter-offers, and news of sealed, declined
//     and expired trades;
//   * a section on a friend's profile (their wishlist and spares, marked
//     against yours) and one on Friends home (your own trading book);
//   * views: compose, review, an offer (the bill of sale), sealed, the wishlist.
// It also keeps the shelf in step in the background (src/cloud/trade-sync.js)
// and draws framed portraits in the Memory museum.
//
// Everything a friend sent arrives through src/cloud/trades.js readers and is
// printed through esc(). Nothing from the server is ever markup.
import { registerFriendAction, registerPostboxSource, registerFriendsSection, registerSocialView } from './social-registry.js';
import { createTrades, tradeText } from '../cloud/trades.js';
import { createTradeSync } from '../cloud/trade-sync.js';
import { guestPet } from '../cloud/social.js';
import { tradesState, TRADE_CURIO_IDS, WISHLIST_MAX } from '../trade-state.js';
import {
  spares, spareCount, owned, toggleWish, packingFor, residentBlock, offerBlock, acceptBlock, curioName, curioList,
  dismissNotice, shortDate, lockedUntil, stayers, CURIOS_PER_SIDE
} from '../engine/trades.js';
import { CURIO_BY_ID, RARITY_BY_ID } from '../engine/mayhem.js';
import { glyph } from '../art/mayhem-glyphs.js';
import { renderPetSprite } from '../art/sprite.js';
import { TRADE_LINES, TRADE_LINE_BY_ID } from '../content/trades.js';
import { TRAIT_BY_ID } from '../content/traits.js';
import { loadingState } from './fx.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const MISSING_ART = '<svg class="tr-missing" viewBox="0 0 60 60" aria-hidden="true"><path d="M14 52V27a16 16 0 0 1 32 0v25l-5-4-5 4-5-4-5 4-5-4z" fill="currentColor" opacity=".3"/><circle cx="24" cy="27" r="3" fill="currentColor" opacity=".7"/><circle cx="36" cy="27" r="3" fill="currentColor" opacity=".7"/></svg>';
const REPORT_REASONS = ['A rude name', 'A rude drawing', 'Bothering me', 'Something else'];
const STAMPS = { accepted: 'Sealed', declined: 'Declined', cancelled: 'Withdrawn', countered: 'Countered', expired: 'Expired' };
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'cursed', 'unholy', 'season', 'edition'];

let deps = null, lastCtx = null;
const books = new Map(), shelves = new Map();
let draft = null, viewing = null, busy = false, moderate = null;

/* ---------------- small pieces ---------------- */
const me = () => deps?.cloud?.userId?.() || null;
const state = () => deps?.state;
function nameOf(userId, fallback = '') {
  const f = lastCtx?.friend?.(userId);
  return f?.name || fallback || (f?.code ? 'Code ' + f.code.slice(0, 4) + ' ' + f.code.slice(4) : 'A friend');
}
const possessive = name => name + '’s';
const total = map => Object.values(map || {}).reduce((n, v) => n + v, 0);
function curioArt(id) { const c = CURIO_BY_ID[id]; return '<span class="tr-curio-art rarity-' + esc(c?.rarity || 'common') + '">' + glyph(c?.glyph || 'skull') + '</span>'; }
const rarityLabel = id => RARITY_BY_ID[CURIO_BY_ID[id]?.rarity]?.label || '';
function spriteFor(resident, { local = false } = {}) {
  try {
    if (local) return renderPetSprite({ ...resident, id: 'tr-view-' + resident.id }).outerHTML;
    const pet = resident?.art ? guestPet({ id: resident.id, name: resident.name, traits: resident.traits, mood: 'fine', bond: 0, art: resident.art }) : null;
    return pet && !pet.artMissing ? renderPetSprite(pet).outerHTML : MISSING_ART;
  } catch { return MISSING_ART; }
}
const traitLine = traits => (traits || []).map(t => TRAIT_BY_ID[t]?.name).filter(Boolean).join(', ');
function residentTile(r, { local = false, action = '', selected = false, note = '', disabled = false } = {}) {
  const tag = action ? 'button' : 'div';
  const attrs = action ? ' type="button" data-sx="' + action + '" data-sx-id="' + esc(r.id) + '" aria-pressed="' + selected + '"' + (disabled ? ' aria-disabled="true"' : '') : '';
  return '<' + tag + ' class="tr-res' + (selected ? ' is-picked' : '') + (disabled ? ' is-blocked' : '') + '"' + attrs + '><span class="tr-res-art">' + spriteFor(r, { local }) + '</span>' +
    '<b>' + esc(r.name) + '</b>' + (r.traits?.length ? '<small>' + esc(traitLine(r.traits)) + '</small>' : '') + (note ? '<em>' + esc(note) + '</em>' : '') + '</' + tag + '>';
}
function itemList(side, { local = false } = {}) {
  const rows = side.curios.map(({ id, n }) => '<li class="tr-item">' + curioArt(id) + '<span><b>' + esc(curioName(id)) + '</b><small>' + (n > 1 ? n + ' copies · ' : '') + esc(rarityLabel(id)) + '</small></span></li>');
  if (side.resident) rows.push('<li class="tr-item tr-item-res"><span class="tr-res-art">' + spriteFor(side.resident, { local }) + '</span><span><b>' + esc(side.resident.name) + '</b><small>' +
    esc(side.resident.traits?.length ? traitLine(side.resident.traits) : 'A resident') + '</small></span></li>');
  return rows.length ? '<ul class="tr-items">' + rows.join('') + '</ul>' : '<p class="tr-nothing">Nothing. A gift, and so recorded.</p>';
}
const billNumber = id => id ? 'No. ' + id.replace(/-/g, '').slice(0, 4).toUpperCase() + '·' + id.replace(/-/g, '').slice(-4).toUpperCase() : 'No. pending';

/* The bill of sale. model: { id, fromName, toName, give, want, line, expiresAt, status, localGive, localWant } */
function billMarkup(m, { lines = null } = {}) {
  const stamp = STAMPS[m.status];
  const terms = m.status === 'open' || !m.status
    ? 'Stands for seven days' + (m.expiresAt ? ', until ' + shortDate(m.expiresAt) : '') + '. Everything offered is held aside until then and stays on its shelf. No returns, no refunds, no haunting.'
    : m.status === 'accepted' ? 'Sealed and binding. Everything has changed hands, or will the moment each shelf next looks.' : 'Void. Everything offered went back where it came from.';
  const quote = TRADE_LINE_BY_ID[m.line]?.text;
  return '<article class="tr-bill' + (stamp ? ' is-' + esc(m.status) : '') + '" aria-label="Bill of sale">' +
    '<header class="tr-bill-head"><span class="tr-bill-kicker">Bill of sale</span><span class="tr-bill-no">' + esc(billNumber(m.id)) + '</span></header>' +
    '<p class="tr-bill-firm">Drawn up by the shelf’s undertaker, who was not asked.</p>' +
    '<p class="tr-bill-parties">Between <b>' + esc(m.fromName) + '</b>, of one shelf, and <b>' + esc(m.toName) + '</b>, of another.</p>' +
    '<div class="tr-bill-cols"><section><h4>' + esc(m.fromName) + ' hands over</h4>' + itemList(m.give, { local: m.localGive }) + '</section>' +
    '<section><h4>' + esc(m.toName) + ' hands over</h4>' + itemList(m.want, { local: m.localWant }) + '</section></div>' +
    (quote ? '<blockquote class="tr-bill-line">“' + esc(quote) + '”<cite>' + esc(m.fromName) + '</cite></blockquote>' : '') +
    (lines?.last ? '<p class="tr-bill-words"><span>Last words on leaving</span>' + esc(lines.last) + '</p>' : '') +
    (lines?.first ? '<p class="tr-bill-words"><span>First words on arriving</span>' + esc(lines.first) + '</p>' : '') +
    '<p class="tr-bill-terms">' + esc(terms) + '</p>' +
    '<footer class="tr-bill-sign"><span>' + esc(m.fromName) + '</span><span>' + esc(m.toName) + '</span></footer>' +
    (stamp ? '<span class="tr-stamp" aria-hidden="true">' + esc(stamp) + '</span><p class="sr-only">' + esc(stamp) + '.</p>' : '') + '</article>';
}
function tradeModel(t) {
  const mine = t.from === me();
  return { id: t.id, fromName: mine ? 'You' : nameOf(t.from, t.fromName), toName: mine ? nameOf(t.to, t.toName) : 'You', give: t.give, want: t.want,
    line: t.line, expiresAt: t.expiresAt, status: t.status };
}
function summary(t) {
  const give = t.give.resident ? t.give.resident.name : curioList(t.give.curios);
  const want = t.want.resident ? t.want.resident.name : curioList(t.want.curios);
  return want ? give + ' for ' + want : 'A gift: ' + give;
}

/* ---------------- loading a friend's book and shelf ---------------- */
function loadBook(userId, ctx) {
  const entry = books.get(userId);
  if (entry && (entry.loading || Date.now() - entry.at < 60000)) return entry;
  const next = { loading: true, at: Date.now(), book: entry?.book || null, error: '' };
  books.set(userId, next);
  deps.sync.book(userId).then(book => { books.set(userId, { loading: false, at: Date.now(), book, error: '' }); })
    .catch(error => { books.set(userId, { loading: false, at: Date.now(), book: null, error: tradeText(error) }); })
    .finally(() => { try { ctx?.refresh?.(); if (draft?.friendId === userId) rerender(ctx); } catch { /* the sheet closed */ } });
  return next;
}
function loadShelf(userId, ctx) {
  const entry = shelves.get(userId);
  if (entry && (entry.loading || Date.now() - entry.at < 60000)) return entry;
  shelves.set(userId, { loading: true, at: Date.now(), residents: entry?.residents || [], error: '' });
  deps.social.shelf(userId).then(r => { shelves.set(userId, { loading: false, at: Date.now(), residents: r?.shelf?.residents || [], error: '' }); })
    .catch(error => { shelves.set(userId, { loading: false, at: Date.now(), residents: [], error: tradeText(error) }); })
    .finally(() => { try { if (draft?.friendId === userId) rerender(ctx); } catch { /* the sheet closed */ } });
  return shelves.get(userId);
}

/* ---------------- compose ---------------- */
function startDraft(friend, { counterOf = null } = {}) {
  draft = {
    friendId: friend.userId, friendName: nameOf(friend.userId, friend.name), mode: counterOf?.kind || 'curio', give: {}, want: {},
    giveResident: '', wantResident: null, line: counterOf ? 'counter' : 'fair', counterOf, step: 'compose', confirm: false, note: ''
  };
  if (counterOf) {
    // Prefilled the other way round; the player changes what they like.
    counterOf.want.curios.forEach(({ id, n }) => { if (spareCount(state(), id) > 0) draft.give[id] = Math.min(n, spareCount(state(), id)); });
    counterOf.give.curios.forEach(({ id, n }) => { draft.want[id] = n; });
    if (counterOf.want.resident) draft.giveResident = counterOf.want.resident.id;
    if (counterOf.give.resident) draft.wantResident = { id: counterOf.give.resident.id, name: counterOf.give.resident.name };
  }
}
function stepper(kind, id, n, max) {
  const name = curioName(id);
  return '<span class="tr-step" role="group" aria-label="' + esc(name) + '">' +
    '<button class="btn btn-sm" type="button" data-sx="' + kind + '" data-sx-id="' + esc(id) + '" data-delta="-1"' + (n <= 0 ? ' disabled' : '') + ' aria-label="One fewer ' + esc(name) + '">−</button>' +
    '<output aria-live="polite">' + n + '</output>' +
    '<button class="btn btn-sm" type="button" data-sx="' + kind + '" data-sx-id="' + esc(id) + '" data-delta="1"' + (n >= max ? ' disabled' : '') + ' aria-label="One more ' + esc(name) + '">+</button></span>';
}
function curioPickRow(kind, id, n, max, tags) {
  return '<li class="tr-pick' + (n ? ' is-picked' : '') + '">' + curioArt(id) + '<span class="tr-pick-name"><b>' + esc(curioName(id)) + '</b><small>' +
    esc([rarityLabel(id), max + ' spare'].filter(Boolean).join(' · ')) + '</small>' + tags.map(t => '<i class="tr-tag tr-tag-' + t[0] + '">' + esc(t[1]) + '</i>').join('') + '</span>' + stepper(kind, id, n, max) + '</li>';
}
function composeMarkup() {
  const d = draft, s = state(), who = d.friendName;
  const book = books.get(d.friendId), theirShelf = shelves.get(d.friendId);
  const mine = spares(s), wishMine = tradesState(s).wishlist, theirWish = book?.book?.wishlist || [];
  const modes = d.counterOf ? '' : '<div class="tr-modes" role="group" aria-label="What kind of trade">' +
    [['curio', 'Curios'], ['resident', 'A resident']].map(([m, label]) => '<button class="btn' + (d.mode === m ? ' btn-primary' : '') + '" type="button" data-sx="tr-mode" data-mode="' + m + '" aria-pressed="' + (d.mode === m) + '">' + label + '</button>').join('') + '</div>';
  let body = '';
  if (d.mode === 'curio') {
    const giveIds = Object.keys(mine).sort((a, b) => Number(theirWish.includes(b)) - Number(theirWish.includes(a)) || curioName(a).localeCompare(curioName(b)));
    body += '<section class="tr-part"><h3>You give <small>' + total(d.give) + ' of ' + CURIOS_PER_SIDE + '</small></h3>' +
      (giveIds.length ? '<ul class="tr-picks">' + giveIds.map(id => curioPickRow('tr-give', id, d.give[id] || 0, Math.min(mine[id], CURIOS_PER_SIDE), theirWish.includes(id) ? [['want', 'On ' + possessive(who) + ' wishlist']] : [])).join('') + '</ul>'
        : '<p class="tr-empty">You have no spares. A curio you own twice turns up here; the first copy never leaves the cabinet.</p>') + '</section>';
    const theirs = book?.book?.spares || {};
    const wantIds = Object.keys(theirs).sort((a, b) => Number(wishMine.includes(b)) - Number(wishMine.includes(a)) || curioName(a).localeCompare(curioName(b)));
    body += '<section class="tr-part"><h3>You ask for <small>' + (total(d.want) ? total(d.want) + ' of ' + CURIOS_PER_SIDE : 'nothing yet, which makes it a gift') + '</small></h3>' +
      (book?.loading && !book.book ? loadingState('Reading ' + possessive(who) + ' trading book.')
        : book?.error ? '<p class="tr-empty">' + esc(book.error) + '</p>'
        : wantIds.length ? '<ul class="tr-picks">' + wantIds.map(id => curioPickRow('tr-want', id, d.want[id] || 0, Math.min(theirs[id], CURIOS_PER_SIDE),
          [wishMine.includes(id) ? ['wish', 'On your wishlist'] : null, !owned(s, id) ? ['new', 'New to you'] : null].filter(Boolean))).join('') + '</ul>'
        : '<p class="tr-empty">' + esc(who) + ' has nothing spare on record. You can still send a gift.</p>') + '</section>';
  } else {
    body += '<section class="tr-part"><h3>Who goes</h3><p class="tr-hint">A resident trade is permanent. Each shelf may trade two residents a week.</p><div class="tr-res-grid">' +
      s.pets.map(p => { const why = residentBlock(s, p); return residentTile(p, { local: true, action: 'tr-give-res', selected: d.giveResident === p.id, note: why ? (packingFor(s, p.id) ? 'Packed for another offer' : lockedUntil(p) > Date.now() ? 'Only just arrived' : stayers(s).length <= 1 ? 'The last one here' : 'Cannot travel') : '', disabled: !!why }); }).join('') + '</div></section>';
    const residents = theirShelf?.residents || [];
    body += '<section class="tr-part"><h3>Who comes back <small>optional</small></h3>' +
      (theirShelf?.loading && !residents.length ? loadingState('Looking along ' + possessive(who) + ' shelf.')
        : '<div class="tr-res-grid"><button class="tr-res tr-res-none' + (d.wantResident ? '' : ' is-picked') + '" type="button" data-sx="tr-want-res" data-sx-id="" aria-pressed="' + !d.wantResident + '"><span class="tr-res-art">' + MISSING_ART + '</span><b>Nobody</b><small>A gift</small></button>' +
          residents.map(r => residentTile(r, { action: 'tr-want-res', selected: d.wantResident?.id === r.id })).join('') + '</div>' +
          (theirShelf?.error ? '<p class="tr-empty">' + esc(theirShelf.error) + '</p>' : '')) + '</section>';
  }
  const lines = '<fieldset class="tr-lines"><legend>A line for the paperwork</legend><div class="tr-line-list">' + TRADE_LINES.map(l =>
    '<button class="tr-line' + (d.line === l.id ? ' is-picked' : '') + '" type="button" data-sx="tr-line" data-sx-id="' + l.id + '" aria-pressed="' + (d.line === l.id) + '">“' + esc(l.text) + '”</button>').join('') + '</div></fieldset>';
  const why = offerBlock(s, draftForEngine());
  return '<div class="tr-view" data-trade-view="compose">' + (d.counterOf ? '<p class="tr-hint">A counter-offer replaces ' + possessive(esc(who)) + ' offer. They can accept it or decline it, but not counter it again.</p>' : '') +
    modes + body + lines + (d.note ? '<p class="tr-note" role="status">' + esc(d.note) + '</p>' : '') +
    '<div class="tr-actions"><button class="btn btn-primary" type="button" data-sx="tr-review"' + (why ? ' aria-describedby="trWhy"' : '') + '>Draw up the bill of sale</button></div>' +
    (why ? '<p class="tr-why" id="trWhy">' + esc(why) + '</p>' : '') + '</div>';
}
function draftForEngine() {
  return { mode: draft.mode, give: draft.give, want: draft.want, giveResident: draft.giveResident, wantResident: draft.wantResident };
}
function draftSides() {
  const s = state();
  if (draft.mode === 'resident') {
    const pet = s.pets.find(p => p.id === draft.giveResident);
    const theirs = draft.wantResident ? (shelves.get(draft.friendId)?.residents || []).find(r => r.id === draft.wantResident.id) || { ...draft.wantResident, traits: [] } : null;
    return { give: { curios: [], resident: pet || null }, want: { curios: [], resident: theirs } };
  }
  const list = map => Object.entries(map).filter(([, n]) => n > 0).map(([id, n]) => ({ id, n }));
  return { give: { curios: list(draft.give), resident: null }, want: { curios: list(draft.want), resident: null } };
}
function reviewMarkup() {
  const d = draft, sides = draftSides(), who = d.friendName;
  const bill = billMarkup({ fromName: 'You', toName: who, give: sides.give, want: sides.want, line: d.line, localGive: true }, {});
  let confirm = '';
  if (d.mode === 'resident' && sides.give.resident) {
    const goes = sides.give.resident.name, comes = sides.want.resident?.name;
    const said = goes + ' will live on ' + possessive(who) + ' shelf. You will not get ' + goes + ' back unless ' + who + ' trades it back.' +
      (comes ? ' ' + comes + ' will move onto your shelf, if ' + who + ' accepts.' : ' Nobody comes back: this is a gift.');
    confirm = d.confirm
      ? '<div class="tr-confirm" role="alertdialog" aria-labelledby="trConfirmText"><p id="trConfirmText"><b>' + esc(said) + '</b></p><p>' + esc(goes) + ' packs now and waits on the shelf until ' + esc(who) + ' answers, for seven days at most. A framed portrait stays in your Memory museum.</p>' +
        '<div class="tr-actions"><button class="btn btn-primary tr-danger" type="button" data-sx="tr-send">Yes, send ' + esc(goes) + '</button><button class="btn btn-ghost" type="button" data-sx="tr-unconfirm">Not yet</button></div></div>'
      : '<p class="tr-hint">' + esc(said) + '</p>';
  }
  const send = d.mode === 'resident' ? (d.confirm ? '' : '<button class="btn btn-primary" type="button" data-sx="tr-send">Send the offer</button>')
    : '<button class="btn btn-primary" type="button" data-sx="tr-send">Seal and send</button>';
  return '<div class="tr-view" data-trade-view="review">' + bill + confirm + (d.note ? '<p class="tr-note" role="status">' + esc(d.note) + '</p>' : '') +
    '<div class="tr-actions">' + send + '<button class="btn btn-ghost" type="button" data-sx="tr-edit">Change something</button></div></div>';
}

/* ---------------- an offer ---------------- */
function offerMarkup() {
  const v = viewing, t = v.trade, uid = me(), s = state();
  const incoming = t.to === uid, open = t.status === 'open';
  const other = incoming ? nameOf(t.from, t.fromName) : nameOf(t.to, t.toName);
  const m = { ...tradeModel(t), localGive: !incoming && !!t.give.resident && s.pets.some(p => p.id === t.give.resident.id), localWant: incoming && !!t.want.resident && s.pets.some(p => p.id === t.want.resident.id) };
  if (m.localGive) m.give = { ...t.give, resident: s.pets.find(p => p.id === t.give.resident.id) };
  if (m.localWant) m.want = { ...t.want, resident: s.pets.find(p => p.id === t.want.resident.id) };
  let actions = '';
  if (open && incoming) {
    const why = acceptBlock(s, t, uid);
    const leaves = t.want.resident?.name, arrives = t.give.resident?.name;
    if (v.confirm && t.kind === 'resident') {
      const said = (leaves ? leaves + ' will live on ' + possessive(other) + ' shelf. You will not get ' + leaves + ' back unless ' + other + ' trades it back. ' : '') +
        arrives + ' will move onto your shelf with fresh needs and its old opinions.';
      actions = '<div class="tr-confirm" role="alertdialog" aria-labelledby="trConfirmText"><p id="trConfirmText"><b>' + esc(said) + '</b></p>' +
        (leaves ? '<p>' + esc(leaves) + '’s memories and bonds here are kept in a framed portrait in your Memory museum.</p>' : '') +
        '<div class="tr-actions"><button class="btn btn-primary tr-danger" type="button" data-sx="tr-accept">' + esc(leaves ? 'Yes, swap ' + leaves + ' for ' + arrives : 'Yes, take in ' + arrives) + '</button>' +
        '<button class="btn btn-ghost" type="button" data-sx="tr-unconfirm">Not yet</button></div></div>';
    } else {
      actions = '<div class="tr-actions"><button class="btn btn-primary" type="button" data-sx="tr-accept"' + (why ? ' disabled aria-describedby="trWhy"' : '') + '>Accept and seal</button>' +
        (t.parent ? '' : '<button class="btn" type="button" data-sx="tr-counter">Counter once</button>') +
        '<button class="btn btn-ghost" type="button" data-sx="tr-decline">Decline</button></div>' + (why ? '<p class="tr-why" id="trWhy">' + esc(why) + '</p>' : '');
    }
  } else if (open) {
    actions = '<p class="tr-hint">Waiting for ' + esc(other) + '. ' + esc(t.give.resident ? t.give.resident.name + ' is packed and waiting by the door.' : 'Your side is held aside.') + '</p>' +
      '<div class="tr-actions"><button class="btn" type="button" data-sx="tr-cancel">Withdraw the offer</button></div>';
  }
  const mod = moderate?.userId === (incoming ? t.from : t.to) ? moderateMarkup(other) : '';
  const fromId = incoming ? t.from : t.to;
  return '<div class="tr-view" data-trade-view="offer">' + (t.parent && incoming ? '<p class="tr-hint">' + esc(other) + ' answered your offer with this counter-offer. It cannot be countered again.</p>' : '') +
    billMarkup(m, { lines: v.lines }) + (v.note ? '<p class="tr-note" role="status">' + esc(v.note) + '</p>' : '') + actions +
    (incoming || !open ? '<div class="tr-moderate"><button class="btn btn-ghost btn-sm" type="button" data-sx="tr-block" data-sx-id="' + esc(fromId) + '">Block ' + esc(other) + '</button>' +
      '<button class="btn btn-ghost btn-sm" type="button" data-sx="tr-report" data-sx-id="' + esc(fromId) + '">Report ' + esc(other) + '</button></div>' + mod : '') + '</div>';
}
function moderateMarkup(who) {
  if (moderate.kind === 'block') return '<div class="tr-confirm" role="group" aria-label="Block ' + esc(who) + '"><p><b>Block ' + esc(who) + '?</b> They are removed, any offers between you are torn up, and your code stops working for them. They are not told.</p>' +
    '<div class="tr-actions"><button class="btn tr-danger" type="button" data-sx="tr-block-yes">Block</button><button class="btn btn-ghost" type="button" data-sx="tr-mod-cancel">Cancel</button></div></div>';
  return '<div class="tr-confirm" role="group" aria-label="Report ' + esc(who) + '"><p><b>Report ' + esc(who) + '?</b> A person reads every report. They are not told who sent it.</p><div class="tr-reasons">' +
    REPORT_REASONS.map(r => '<button class="tr-line' + (moderate.reason === r ? ' is-picked' : '') + '" type="button" data-sx="tr-reason" data-sx-id="' + esc(r) + '" aria-pressed="' + (moderate.reason === r) + '">' + esc(r) + '</button>').join('') +
    '</div><div class="tr-actions"><button class="btn tr-danger" type="button" data-sx="tr-report-yes">Send report</button><button class="btn btn-ghost" type="button" data-sx="tr-mod-cancel">Cancel</button></div></div>';
}

/* ---------------- the wishlist ---------------- */
function bookMarkup() {
  const s = state(), t = tradesState(s);
  const ids = [...TRADE_CURIO_IDS].filter(id => CURIO_BY_ID[id]);
  const chip = id => { const on = t.wishlist.includes(id); return '<li><button class="tr-wish' + (on ? ' is-picked' : '') + '" type="button" data-sx="tr-wish" data-sx-id="' + esc(id) + '" aria-pressed="' + on + '">' + curioArt(id) + '<span><b>' + esc(curioName(id)) + '</b><small>' + esc(rarityLabel(id)) + (on ? ' · wanted' : '') + '</small></span></button></li>'; };
  const byRarity = list => RARITY_ORDER.map(r => [r, list.filter(id => CURIO_BY_ID[id].rarity === r)]).filter(([, l]) => l.length);
  const missing = ids.filter(id => !owned(s, id)), have = ids.filter(id => owned(s, id));
  const mine = spares(s);
  return '<div class="tr-view" data-trade-view="book"><p class="tr-hint">Friends see your wishlist and your spares on your profile. Tap a curio to want it. <b>' + t.wishlist.length + ' of ' + WISHLIST_MAX + '</b> chosen.</p>' +
    '<section class="tr-part"><h3>Your spares <small>' + Object.keys(mine).length + '</small></h3>' + (Object.keys(mine).length ? '<ul class="tr-chips">' + Object.keys(mine).map(id => '<li class="tr-chip">' + curioArt(id) + '<span>' + esc(curioName(id)) + (mine[id] > 1 ? ' ×' + mine[id] : '') + '</span></li>').join('') + '</ul>' : '<p class="tr-empty">No spares yet. A curio you own twice turns up here.</p>') + '</section>' +
    '<section class="tr-part"><h3>Not in your cabinet yet</h3>' + byRarity(missing).map(([r, list]) => '<h4 class="tr-rarity">' + esc(RARITY_BY_ID[r]?.label || r) + '</h4><ul class="tr-wishes">' + list.map(chip).join('') + '</ul>').join('') + '</section>' +
    (have.length ? '<details class="tr-part"><summary>Already in your cabinet <small>' + have.length + '</small></summary><ul class="tr-wishes">' + have.map(chip).join('') + '</ul></details>' : '') + '</div>';
}

/* ---------------- views ---------------- */
function show(ctx, id, { kicker, title, html, back }) {
  lastCtx = ctx || lastCtx;
  lastCtx?.show?.({ id, kicker, title, html, back });
}
function rerender(ctx = lastCtx) {
  if (!ctx || !deps) return;
  if (draft?.step === 'compose') showCompose(ctx);
  else if (draft?.step === 'review') showReview(ctx);
}
function showCompose(ctx) {
  draft.step = 'compose';
  show(ctx, 'trade-compose', { kicker: draft.counterOf ? 'Counter-offer' : 'A trade', title: (draft.counterOf ? 'Counter ' : 'Trade with ') + draft.friendName, html: composeMarkup(),
    back: draft.counterOf ? 'postbox' : 'friend:' + draft.friendId });
}
function showReview(ctx) {
  draft.step = 'review';
  show(ctx, 'trade-review', { kicker: 'Read before signing', title: 'The bill of sale', html: reviewMarkup(), back: draft.counterOf ? 'postbox' : 'friend:' + draft.friendId });
}
function showOffer(ctx) {
  const t = viewing.trade, incoming = t.to === me();
  const other = incoming ? nameOf(t.from, t.fromName) : nameOf(t.to, t.toName);
  const kicker = t.status === 'open' ? (incoming ? (t.parent ? 'A counter-offer' : 'An offer') : 'Your offer') : STAMPS[t.status] || 'A trade';
  show(ctx, 'trade-offer', { kicker, title: incoming ? 'From ' + other : 'To ' + other, html: offerMarkup(), back: viewing.back || 'postbox' });
}
function showSealed(ctx, t, lines) {
  viewing = { trade: t, lines, back: 'postbox' };
  show(ctx, 'trade-offer', { kicker: 'Sealed', title: 'Signed, sealed, regretted', html: offerMarkup(), back: 'postbox' });
  setTimeout(() => {
    const stamp = document.querySelector('.tr-bill.is-accepted .tr-stamp');
    if (!stamp) return;
    try { window.shelfFx?.celebrate?.('resident', { at: stamp }); window.shelfFx?.burst?.(stamp, 'confetti'); } catch { /* decoration only */ }
  }, 60);
}
function showBook(ctx) { show(ctx, 'trade-book', { kicker: 'Your trading book', title: 'Wishlist and spares', html: bookMarkup(), back: 'main' }); }
async function openOffer(ctx, trade, back = 'postbox') {
  viewing = { trade, confirm: false, note: '', back };
  moderate = null;
  showOffer(ctx);
  // Lists leave drawings at home; fetch them for a resident offer.
  if (trade.kind === 'resident' && ['open', 'accepted'].includes(trade.status) && (trade.give.resident?.artPending || trade.want.resident?.artPending || !trade.give.resident?.art)) {
    try {
      const full = await deps.sync.payload(trade.id);
      if (viewing?.trade.id === trade.id) { viewing.trade = { ...trade, give: full.give, want: trade.status === 'open' ? trade.want : full.want }; showOffer(ctx); }
    } catch { /* the bill still reads without pictures */ }
  }
}

async function guarded(ctx, work) {
  if (busy) return;
  busy = true;
  document.querySelectorAll('[data-trade-view] button').forEach(b => { b.disabled = true; });
  try { await work(); }
  finally { busy = false; }
}

registerSocialView('trade-compose', {
  onClick(action, el, ctx) {
    if (!draft) return;
    const id = el.dataset.sxId || '';
    draft.note = '';
    if (action === 'tr-mode') { draft.mode = el.dataset.mode === 'resident' ? 'resident' : 'curio'; if (draft.mode === 'resident') loadShelf(draft.friendId, ctx); }
    else if (action === 'tr-give' || action === 'tr-want') {
      const map = action === 'tr-give' ? draft.give : draft.want;
      const cap = action === 'tr-give' ? spareCount(state(), id) : (books.get(draft.friendId)?.book?.spares?.[id] || 0);
      const next = Math.max(0, Math.min(cap, CURIOS_PER_SIDE, (map[id] || 0) + (Number(el.dataset.delta) || 0)));
      if (next > (map[id] || 0) && total(map) >= CURIOS_PER_SIDE) draft.note = 'Three curios each way at most. The undertaker has small hands.';
      else if (next) map[id] = next; else delete map[id];
    }
    else if (action === 'tr-give-res') { const why = residentBlock(state(), state().pets.find(p => p.id === id)); if (why) draft.note = why; else draft.giveResident = id; }
    else if (action === 'tr-want-res') { const r = (shelves.get(draft.friendId)?.residents || []).find(x => x.id === id); draft.wantResident = r ? { id: r.id, name: r.name } : null; }
    else if (action === 'tr-line') { if (TRADE_LINE_BY_ID[id]) draft.line = id; }
    else if (action === 'tr-review') {
      const why = offerBlock(state(), draftForEngine());
      if (why) { draft.note = why; } else { draft.confirm = false; showReview(ctx); return; }
    }
    showCompose(ctx);
    if (['tr-give', 'tr-want', 'tr-give-res', 'tr-want-res', 'tr-line', 'tr-mode'].includes(action)) refocus(action, id, el.dataset.delta || el.dataset.mode);
  }
});
// Redraws keep the focus on the control that was pressed, where it still exists.
function refocus(action, id, extra) {
  const sel = '[data-sx="' + action + '"]' + (id ? '[data-sx-id="' + CSS.escape(id) + '"]' : '') + (extra && action !== 'tr-mode' ? '[data-delta="' + CSS.escape(extra) + '"]' : '') + (action === 'tr-mode' ? '[data-mode="' + CSS.escape(extra || '') + '"]' : '');
  const target = document.querySelector('[data-trade-view] ' + sel);
  if (target && !target.disabled) target.focus({ preventScroll: true });
  else if (target) target.parentElement?.querySelector('button:not([disabled])')?.focus({ preventScroll: true });
}

registerSocialView('trade-review', {
  onClick(action, el, ctx) {
    if (!draft) return;
    draft.note = '';
    if (action === 'tr-edit') { showCompose(ctx); return; }
    if (action === 'tr-unconfirm') { draft.confirm = false; showReview(ctx); return; }
    if (action !== 'tr-send') return;
    if (draft.mode === 'resident' && !draft.confirm) { draft.confirm = true; showReview(ctx); document.querySelector('[data-sx="tr-send"]')?.focus({ preventScroll: true }); return; }
    guarded(ctx, async () => {
      const d = draft;
      try {
        const sides = draftSides();
        const trade = d.counterOf
          ? await deps.sync.counter(d.counterOf, { draft: draftForEngine(), line: d.line })
          : await deps.sync.propose({ to: d.friendId, toName: d.friendName, draft: draftForEngine(), line: d.line });
        draft = null;
        deps.renderAll?.();
        const said = sides.give.resident ? sides.give.resident.name + ' has packed. ' + d.friendName + ' has seven days to answer.' : 'Sealed in an envelope. ' + d.friendName + ' has seven days to answer.';
        ctx?.toast?.(said);
        viewing = { trade, confirm: false, note: said, back: d.counterOf ? 'postbox' : 'friend:' + d.friendId };
        showOffer(ctx);
        ctx?.refresh?.();
      } catch (error) {
        d.note = error.code === 'blocked_locally' ? error.message : tradeText(error);
        if (draft === d) showReview(ctx);
      }
    });
  }
});

registerSocialView('trade-offer', {
  onClick(action, el, ctx) {
    if (!viewing) return;
    const t = viewing.trade;
    viewing.note = '';
    if (action === 'tr-unconfirm') { viewing.confirm = false; showOffer(ctx); return; }
    if (action === 'tr-counter') {
      const friend = lastCtx?.friend?.(t.from) || { userId: t.from, name: t.fromName };
      startDraft(friend, { counterOf: t });
      loadBook(t.from, ctx);
      if (t.kind === 'resident') loadShelf(t.from, ctx);
      showCompose(ctx);
      return;
    }
    if (action === 'tr-block' || action === 'tr-report') { moderate = { kind: action === 'tr-block' ? 'block' : 'report', userId: el.dataset.sxId, reason: REPORT_REASONS[0] }; showOffer(ctx); return; }
    if (action === 'tr-mod-cancel') { moderate = null; showOffer(ctx); return; }
    if (action === 'tr-reason') { if (moderate) moderate.reason = el.dataset.sxId; showOffer(ctx); return; }
    if (action === 'tr-block-yes' && moderate) {
      const who = moderate.userId;
      guarded(ctx, async () => {
        try { await deps.social.block(who); moderate = null; ctx?.say?.('Blocked. Offers between you are torn up. They are not told.'); deps.sync.sync({ force: true }).catch(() => {}); ctx?.back?.(); }
        catch (error) { viewing.note = tradeText(error); showOffer(ctx); }
      });
      return;
    }
    if (action === 'tr-report-yes' && moderate) {
      const who = moderate.userId, reason = moderate.reason + ': a trade offer';
      guarded(ctx, async () => {
        try { await deps.social.report(who, reason); moderate = null; viewing.note = 'Reported. Block them too if you would rather not hear from them.'; }
        catch (error) { viewing.note = tradeText(error); }
        showOffer(ctx);
      });
      return;
    }
    if (action === 'tr-accept') {
      if (t.kind === 'resident' && !viewing.confirm) { viewing.confirm = true; showOffer(ctx); document.querySelector('[data-sx="tr-accept"]')?.focus({ preventScroll: true }); return; }
      guarded(ctx, async () => {
        try {
          const { trade, result } = await deps.sync.accept(t);
          deps.renderAll?.();
          const lines = { last: result?.departed?.lastLine || '', first: result?.arrived?.firstLine || '' };
          // The postbox already shows this one: the player is looking at it.
          if (dismissNotice(state(), trade.id)) deps.save?.();
          showSealed(ctx, trade, lines);
          ctx?.refresh?.();
          celebrateArrival(result);
        } catch (error) {
          viewing.confirm = false;
          viewing.note = error.code === 'blocked_locally' ? error.message : tradeText(error);
          showOffer(ctx);
        }
      });
      return;
    }
    if (action === 'tr-decline' || action === 'tr-cancel') {
      guarded(ctx, async () => {
        try {
          if (action === 'tr-decline') await deps.sync.decline(t); else await deps.sync.cancel(t);
          viewing.trade = { ...t, status: action === 'tr-decline' ? 'declined' : 'cancelled', closedAt: Date.now() };
          viewing.note = action === 'tr-decline' ? 'Declined. ' + nameOf(t.from, t.fromName) + ' gets everything back.' : 'Withdrawn. Everything you offered is back where it was.';
          deps.renderAll?.();
          ctx?.refresh?.();
        } catch (error) { viewing.note = tradeText(error); }
        showOffer(ctx);
      });
    }
  }
});

registerSocialView('trade-book', {
  onClick(action, el, ctx) {
    if (action !== 'tr-wish') return;
    const id = el.dataset.sxId, r = toggleWish(state(), id);
    if (r === 'full') ctx?.say?.('Twelve is the limit. Wanting more is how this shelf started.');
    else if (r) { deps.save?.(); deps.sync.publishBook().catch(() => {}); }
    showBook(ctx);
    refocus('tr-wish', id);
  }
});

/* ---------------- registrations ---------------- */
registerFriendAction({
  id: 'trade', label: 'Propose a trade', order: 30,
  available(friend, ctx) {
    if (!deps) return false;
    if (!ctx?.social?.active?.() && !deps.social.active()) return 'Open Friends to trade';
    return true;
  },
  run(friend, ctx) {
    lastCtx = ctx;
    startDraft(friend);
    loadBook(friend.userId, ctx);
    showCompose(ctx);
  }
});

registerFriendsSection({
  id: 'trade-book', where: 'friend', order: 40,
  render(ctx, friend) {
    if (!deps || !friend) return '';
    lastCtx = ctx;
    const entry = loadBook(friend.userId, ctx), s = state(), mine = spares(s), wish = tradesState(s).wishlist;
    const who = nameOf(friend.userId, friend.name);
    const theirWish = entry.book?.wishlist || [], theirSpares = entry.book?.spares || {};
    const chip = (id, mark) => '<li class="tr-chip' + (mark ? ' is-marked' : '') + '">' + curioArt(id) + '<span>' + esc(curioName(id)) + (mark ? '<i class="tr-mark">' + esc(mark) + '</i>' : '') + '</span></li>';
    const open = deps.sync.cache().trades.filter(t => t.status === 'open' && [t.from, t.to].includes(friend.userId));
    return '<section class="tr-section" aria-labelledby="trSectionTitle"><h3 id="trSectionTitle">Trading</h3>' +
      (entry.loading && !entry.book ? loadingState('Reading ' + possessive(who) + ' trading book.') : entry.error ? '<p class="tr-empty">' + esc(entry.error) + '</p>' :
        '<h4>' + esc(possessive(who)) + ' wishlist</h4>' + (theirWish.length ? '<ul class="tr-chips">' + theirWish.map(id => chip(id, mine[id] ? 'You have a spare' : '')).join('') + '</ul>' : '<p class="tr-empty">Nothing wished for. Either content or hiding something.</p>') +
        '<h4>' + esc(possessive(who)) + ' spares</h4>' + (Object.keys(theirSpares).length ? '<ul class="tr-chips">' + Object.keys(theirSpares).map(id => chip(id, wish.includes(id) ? 'On your wishlist' : !owned(s, id) ? 'New to you' : '')).join('') + '</ul>' : '<p class="tr-empty">No spares on record.</p>')) +
      (open.length ? '<ul class="tr-open">' + open.map(t => '<li><span>' + esc(t.from === me() ? 'Your offer: ' : 'Their offer: ') + esc(summary(t)) + '</span><button class="btn btn-sm" type="button" data-sx="tr-open" data-sx-id="' + esc(t.id) + '">Read</button></li>').join('') + '</ul>' : '') +
      '<div class="tr-actions"><button class="btn btn-primary" type="button" data-sx="tr-propose">Propose a trade</button></div></section>';
  },
  onClick(action, el, ctx, friend) {
    if (!deps || !friend) return;
    lastCtx = ctx;
    if (action === 'tr-propose') { startDraft(friend); loadBook(friend.userId, ctx); showCompose(ctx); }
    if (action === 'tr-open') { const t = deps.sync.cache().trades.find(x => x.id === el.dataset.sxId); if (t) openOffer(ctx, t, 'friend:' + friend.userId); }
  }
});

registerFriendsSection({
  id: 'trade-mine', where: 'home', order: 60,
  render(ctx) {
    if (!deps) return '';
    lastCtx = ctx;
    const s = state(), t = tradesState(s), mine = spares(s);
    const packing = s.pets.filter(p => packingFor(s, p.id));
    return '<section class="tr-section tr-home" aria-labelledby="trHomeTitle"><h3 id="trHomeTitle">Your trading book</h3><p class="tr-hint">' +
      esc(t.wishlist.length + ' of ' + WISHLIST_MAX + ' on your wishlist · ' + Object.keys(mine).length + (Object.keys(mine).length === 1 ? ' spare' : ' spares') + ' · ' + Object.keys(t.escrow).length + ' held for offers') + '</p>' +
      (packing.length ? '<p class="tr-hint">' + esc(packing.map(p => p.name).join(', ') + (packing.length === 1 ? ' is' : ' are') + ' packed and waiting by the door.') + '</p>' : '') +
      '<div class="tr-actions"><button class="btn" type="button" data-sx="tr-book">Edit wishlist</button></div></section>';
  },
  onClick(action, el, ctx) { if (action === 'tr-book') showBook(ctx); }
});

registerPostboxSource({
  id: 'trades', label: 'Trades', order: 30, poll: true,
  count() { return deps ? deps.sync.waiting() + tradesState(state()).notices.length : 0; },
  async load(ctx) {
    if (!deps) return [];
    lastCtx = ctx;
    try { await deps.sync.sync({ force: true }); } catch { /* show what the last look found */ }
    const uid = me(), c = deps.sync.cache();
    const items = c.trades.filter(t => t.status === 'open').map(t => ({ id: t.id, at: t.createdAt, kind: t.to === uid ? 'incoming' : 'outgoing', trade: t,
      title: t.to === uid ? nameOf(t.from, t.fromName) + (t.parent ? ' counters your offer' : ' proposes a trade') : 'Waiting on ' + nameOf(t.to, t.toName),
      line: summary(t) + '. Stands until ' + shortDate(t.expiresAt) + '.' }));
    for (const n of tradesState(state()).notices) items.push({ id: 'notice:' + n.id + ':' + n.kind, at: n.at, kind: 'notice', notice: n, title: n.title, line: n.text });
    return items.sort((a, b) => b.at - a.at);
  },
  render(item) {
    const cls = 'tr-mail tr-mail-' + item.kind;
    if (item.kind === 'notice') {
      return '<div class="' + cls + '"><p><b>' + esc(item.title) + '</b> ' + esc(item.line) + '</p>' + (item.notice.last ? '<p class="tr-mail-quote">' + esc(item.notice.last) + '</p>' : '') +
        (item.notice.first ? '<p class="tr-mail-quote">' + esc(item.notice.first) + '</p>' : '') +
        '<div class="tr-actions">' + (item.notice.kind === 'sealed' ? '<button class="btn btn-sm" type="button" data-sx="tr-read-sealed" data-sx-id="' + esc(item.notice.id) + '">Read the bill</button>' : '') +
        '<button class="btn btn-sm btn-ghost" type="button" data-sx="tr-dismiss" data-sx-id="' + esc(item.notice.id) + '">Noted</button></div></div>';
    }
    return '<div class="' + cls + '"><p><b>' + esc(item.title) + '</b> ' + esc(item.line) + '</p><div class="tr-actions">' +
      '<button class="btn btn-sm' + (item.kind === 'incoming' ? ' btn-primary' : '') + '" type="button" data-sx="tr-open" data-sx-id="' + esc(item.id) + '">Read the bill of sale</button>' +
      (item.kind === 'outgoing' ? '<button class="btn btn-sm btn-ghost" type="button" data-sx="tr-withdraw" data-sx-id="' + esc(item.id) + '">Withdraw</button>' : '') + '</div></div>';
  },
  async onClick(action, itemId, ctx) {
    if (!deps) return;
    lastCtx = ctx;
    const c = deps.sync.cache(), t = c.trades.find(x => x.id === itemId);
    if (action === 'tr-open' && t) { await openOffer(ctx, t); return; }
    if (action === 'tr-withdraw' && t) {
      try { await deps.sync.cancel(t); ctx?.say?.('Withdrawn. Everything you offered is back where it was.'); deps.renderAll?.(); }
      catch (error) { ctx?.say?.(tradeText(error)); }
      ctx?.refresh?.();
      return;
    }
    if (action === 'tr-read-sealed') {
      const n = tradesState(state()).notices.find(x => x.id === itemId && x.kind === 'sealed');
      try { const full = await deps.sync.payload(itemId); showSealed(ctx, full, { last: n?.last || '', first: n?.first || '' }); }
      catch (error) { ctx?.say?.(tradeText(error)); }
      if (dismissNotice(state(), itemId)) deps.save?.();
      return;
    }
    if (action === 'tr-dismiss') { if (dismissNotice(state(), itemId)) deps.save?.(); ctx?.refresh?.(); }
  }
});

/* ---------------- on the shelf, the card and the museum ---------------- */
function celebrateArrival(result) {
  const id = result?.arrived?.pet?.id;
  if (!id || result.arrived.waiting) return;
  setTimeout(() => {
    const piece = document.querySelector('#cabinet .piece.pet[data-id="' + CSS.escape(id) + '"]');
    try { if (piece) window.shelfFx?.celebrate?.('resident', { at: piece }); } catch { /* decoration only */ }
  }, 400);
}
function announce(results) {
  for (const r of results) {
    if (r.restored) deps.toast?.(r.departed.name + ' lives on ' + possessive(r.partner) + ' shelf now. The postbox explains.');
    else if (r.departed?.present) deps.toast?.(r.departed.name + ' has gone to ' + possessive(r.partner) + ' shelf. ' + r.departed.lastLine);
    if (r.arrived?.pet && !r.arrived.waiting) { deps.toast?.(r.arrived.pet.name + ' has arrived from ' + possessive(r.partner) + ' shelf. ' + r.arrived.firstLine); celebrateArrival(r); }
    else if (r.arrived?.waiting) deps.toast?.(r.arrived.pet.name + ' is waiting on the doorstep. Make room on the shelf.');
    if (!r.departed && !r.arrived && (r.curiosIn.length || r.curiosOut.length)) deps.toast?.('A trade with ' + r.partner + ' is sealed. The cabinet has been rearranged.');
  }
}

// A line for the resident card: packing for an offer, or arrived by trade.
export function tradeCardNote(state, pet) {
  const packing = packingFor(state, pet?.id);
  if (packing) return '<p class="tr-card-note"><b>Packing to leave.</b> ' + esc(pet.name) + ' is offered to ' + esc(packing.toName || 'a friend') + ' and waits by the door until they answer. If they decline, it unpacks and pretends it was never going.</p>';
  if (pet?.arrivedByTrade) return '<p class="tr-card-note">Arrived by bill of sale from ' + esc(pet.arrivedByTrade.from || 'a friend') + '’s shelf' + (pet.arrivedByTrade.at ? ' on ' + esc(shortDate(pet.arrivedByTrade.at)) : '') + '.</p>';
  return '';
}
// Rehoming a resident who is packed, or the last one staying, would break a promise.
export function rehomeBlock(state, pet) {
  const packing = packingFor(state, pet?.id);
  if (packing) return pet.name + ' is packed for an offer to ' + (packing.toName || 'a friend') + '. Withdraw the offer first.';
  if (Object.keys(state.trades?.escrow || {}).length && stayers(state).length <= 1) return pet.name + ' is the only resident not packed to leave. Someone has to stay.';
  return '';
}
// Framed portraits of residents who left by trade, after "Former residents".
export function renderTradePortraits(host, state) {
  const list = state?.trades?.portraits || [];
  if (!host || !list.length) return;
  const section = document.createElement('section');
  section.className = 'tr-portraits';
  section.innerHTML = '<h3>Framed portraits <small>Traded away, never forgotten</small></h3><div class="tr-frames">' + list.map((p, i) =>
    '<figure class="tr-frame"><div class="tr-frame-art" data-frame="' + i + '"></div><figcaption><b>' + esc(p.name) + '</b><small>Lives on ' + esc(possessive(p.to || 'a friend')) + ' shelf since ' + esc(shortDate(p.at)) + '</small>' +
    (p.lastLine ? '<q>' + esc(p.lastLine.replace(/^“|”$/g, '')) + '</q>' : '') + '<ul>' + p.lines.map(l => '<li>' + esc(l) + '</li>').join('') + '</ul></figcaption></figure>').join('') + '</div>';
  const after = host.querySelector('.memorials');
  if (after) after.after(section); else host.appendChild(section);
  list.forEach((p, i) => {
    const art = section.querySelector('[data-frame="' + i + '"]');
    try { art.appendChild(renderPetSprite({ id: 'portrait-' + p.id, name: p.name, art: p.art, traits: [], needs: { food: 80, fuss: 80, clean: 80 } })); }
    catch { art.innerHTML = MISSING_ART; }
  });
}

/* ---------------- start ---------------- */
export function initTrades({ state: live, cloud, social, save, renderAll, toast }) {
  if (!cloud?.configured || !social) return null;
  const trades = createTrades({ cloud });
  const sync = createTradeSync({ cloud, social, trades, getState: () => live, save });
  deps = { state: live, cloud, social, trades, sync, save, renderAll, toast };
  sync.subscribe(info => {
    if (info.results?.length) announce(info.results);
    if (info.changed) renderAll?.();
    try { lastCtx?.refresh?.(); } catch { /* the sheet is closed */ }
  });
  const kick = force => { if (social.active() && !document.hidden) sync.sync({ force }).catch(() => { /* offline: the next look catches up */ }); };
  setTimeout(() => kick(true), 1500);
  setInterval(() => kick(false), 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(false); });
  window.addEventListener('online', () => kick(true));
  // A restored backup or a chosen cloud copy may predate a trade: settle it now.
  window.addEventListener('shelflife:restored', () => kick(true));
  social.subscribe(() => kick(false));
  return { sync, trades };
}
// For tests and the integrator: the running sync, if any.
export const tradeRuntime = () => deps;

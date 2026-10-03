import {
  SETS, SET_GROUPS, CABINET_FRAMES, PORTRAIT_FRAMES, BACK_ISSUE_COST, titleText, FRAME_BY_ID
} from '../content/collections.js';
import { CHAPTERS, CHAPTER_BY_ID } from '../content/almanac.js';
import { ROOMS, WOODS, ACCENTS, NEW_DECOR } from '../content/decor.js';
import {
  allSets, claimSet, completedSetCount, exchangeCatalog, buyFrame, equipFrame, activeFrame, buyPortraitFrame, equipPortraitFrame,
  portraitFor, buyDecor, placeCommission, activeTitle, memberInfo
} from '../engine/collections.js';
import { backIssues, buyBackIssue, pastChapters } from '../engine/almanac.js';
import { legacyInfo } from '../engine/legacy.js';
import { checkAchievements } from '../engine/achievements.js';
import { almanacCurioSVG } from '../art/almanac-art.js';
import { glyph } from '../art/mayhem-glyphs.js';
import { mayhemState } from '../mayhem-state.js';
import { LEGACY_RANKS } from '../content/legacy.js';
import { save, petById } from '../state.js';
import { esc, plural, byId, num, say, celebrate, chime, openSheet, closeSheet } from './retention-kit.js';

/* ================= COLLECTIONS AND THE COLLECTOR'S EXCHANGE: SCREENS =================
   Sets live in the Cabinet, under the curios. The Exchange is its own sheet, for
   what souls and Legacy Tokens buy once the cabinet is full. Big purchases ask twice. */

let S = null, refresh = () => {};
let tab = 'back', notice = '', armed = null;
const CONFIRM_AT = 1500;

/* ---------- the Cabinet's extras ---------- */
function memberChip(m) {
  return '<li class="' + (m.owned ? 'got' : 'missing') + '">' + (m.owned ? esc(m.name) : '???') + '</li>';
}
function setCard(p) {
  const prize = '+' + p.set.souls + ' souls' + (p.set.title ? ' · title' : '') + (p.set.frame ? ' · frame' : '');
  return '<article class="col-set' + (p.complete ? ' complete' : '') + (p.claimed ? ' claimed' : '') + '"><header><b>' + esc(p.set.name) + '</b><small>' + p.have + '/' + p.total + '</small></header>' +
    '<span class="mh-meter"><i style="width:' + Math.round(p.have / p.total * 100) + '%"></i></span>' +
    '<ul class="col-members">' + p.members.map(memberChip).join('') + '</ul>' +
    '<footer>' + (p.claimable ? '<button class="btn btn-primary btn-sm" type="button" data-col="claim" data-id="' + esc(p.set.id) + '">Claim ' + esc(prize) + '</button>' :
      p.claimed ? '<span class="col-claimed">Complete and claimed</span>' : '<span class="col-prize">' + esc(prize) + '</span>') + '</footer></article>';
}
function setsHTML(state) {
  const sets = allSets(state), done = sets.filter(p => p.complete).length, ready = sets.filter(p => p.claimable).length;
  const groups = SET_GROUPS.map(g => {
    const items = sets.filter(p => p.set.group === g.id), have = items.filter(p => p.complete).length;
    const open = g.id === 'cabinet' || items.some(p => p.claimable);
    return '<details class="col-group"' + (open ? ' open' : '') + '><summary>' + esc(g.title) + ' <small>' + have + '/' + items.length + '</small></summary><div class="col-cards">' + items.map(setCard).join('') + '</div></details>';
  }).join('');
  return '<section class="col-block" id="colSets"><h3>Collections <small>' + done + '/' + sets.length + ' complete' + (ready ? ' · ' + ready + ' to claim' : '') + '</small></h3>' +
    '<p class="hint">Finish a set to take its prize: souls, a title and, for some, a display frame for this cabinet.</p>' + groups + '</section>';
}
function legacyHTML(state) {
  const l = legacyInfo(state), life = mayhemState(state).lifetime;
  if (life < LEGACY_RANKS[0].at - 3000 && !l.level) return '';
  const next = l.next;
  return '<section class="col-block col-legacy"><h3>' + (l.level ? 'Legacy ' + l.level : 'Past Unspeakable') + '</h3>' +
    (l.rank ? '<p class="col-legacy-title">' + esc(l.rank.short) + '</p><p>' + esc(l.rank.line) + '</p>' : '<p>One more rank and the ladder goes on, past the last word the neighbours had for you.</p>') +
    (next ? '<span class="mh-meter big"><i style="width:' + Math.round(l.progress * 100) + '%"></i></span><small>' + num(Math.max(0, l.toNext)) + ' more souls until Legacy ' + next.legacy + ', “' + esc(next.short) + '”.</small>' : '<small>The last rank. There is nothing left to be called.</small>') +
    '<div class="col-legacy-row"><span class="col-token"><b>' + l.balance + '</b> Legacy ' + (l.balance === 1 ? 'Token' : 'Tokens') + '</span><button class="btn btn-sm" type="button" data-col="exchange" data-tab="legacy">Spend them</button></div></section>';
}
function editionsHTML(state) {
  const m = mayhemState(state);
  const groups = CHAPTERS.map(c => ({ c, got: c.curios.filter(k => (m.curios[k.id] || 0) > 0) })).filter(g => g.got.length);
  if (!groups.length) return '';
  return '<section class="col-block"><h3>Almanac editions <small>' + groups.reduce((n, g) => n + g.got.length, 0) + ' of 60</small></h3>' +
    groups.map(({ c, got }) => '<div class="col-edition"><h4>' + esc(c.name) + ' <small>' + got.length + '/4</small></h4><ul class="col-edition-grid">' +
      c.curios.map(k => (m.curios[k.id] || 0) > 0
        ? '<li><button type="button" class="col-edition-item" data-col="curio" data-id="' + esc(k.id) + '" style="--rc:' + esc(c.colors.glow) + '"><span class="col-edition-art">' + almanacCurioSVG(k, c) + '</span><b>' + esc(k.name) + '</b></button></li>'
        : '<li class="missing"><span class="col-edition-art">' + almanacCurioSVG(k, c, { locked: true }) + '</span><b>???</b></li>').join('') + '</ul></div>').join('') +
    '<div class="col-curio-detail" id="colCurioDetail" hidden></div></section>';
}
function frameRow(state) {
  const f = FRAME_BY_ID[activeFrame(state)], t = activeTitle(state);
  return '<p class="col-frame-row">Frame: <b>' + esc(f.name) + '</b>' + (t ? ' · Title: <b>' + esc(titleText(t)) + '</b>' : '') + ' <button class="btn btn-ghost btn-sm" type="button" data-col="exchange" data-tab="frames">Change</button></p>';
}
// Everything the Cabinet shows beneath the curios that is not a curio.
export function cabinetExtrasHTML(state) {
  return legacyHTML(state) + frameRow(state) + setsHTML(state) + editionsHTML(state);
}
export function cabinetFrameClass(state) { return 'fr-' + activeFrame(state); }

/* ---------- the Collector's Exchange ---------- */
const sheet = () => byId('exchangeSheet');
const price = item => item.tokens ? item.tokens + ' ' + (item.tokens === 1 ? 'Token' : 'Tokens') : num(item.cost) + ' souls';
function buyButton(item, action, extra = '') {
  const key = action + ':' + (item.key || item.id), big = (item.cost || 0) >= CONFIRM_AT;
  const confirm = armed === key;
  if (item.owned) return '';
  if (!item.can) return '<button class="btn btn-sm" type="button" disabled>' + esc(price(item)) + '</button>';
  return '<button class="btn btn-sm btn-primary' + (confirm ? ' armed' : '') + '" type="button" data-ex="' + action + '" data-id="' + esc(item.key || item.id) + '"' + extra + '>' + (confirm ? 'Tap again: ' : '') + esc(price(item)) + '</button>';
}
function row(art, name, line, side, cls = '') {
  return '<li class="ex-row ' + cls + '"><span class="ex-art">' + art + '</span><span class="ex-text"><b>' + esc(name) + '</b><small>' + esc(line) + '</small></span><span class="ex-side">' + side + '</span></li>';
}
const swatch = css => '<span class="ex-swatch" style="background:' + esc(css) + '"></span>';

function backHTML(state, now) {
  const list = backIssues(state, now), m = mayhemState(state);
  const byChapter = {};
  for (const c of list.curios) (byChapter[c.chapter] ||= []).push(c);
  const parts = [];
  if (list.bargain) parts.push('<div class="ex-bargain"><span class="mh-tile-kicker">This week’s mark-down</span><b>' + esc(list.bargain.name) + '</b><small>From ' + esc(list.bargain.chapterName) + '. Was ' + num(list.bargain.was) + ' souls, now ' + num(list.bargain.cost) + '. Next Monday it is full price again.</small></div>');
  for (const [id, items] of Object.entries(byChapter)) {
    const c = CHAPTER_BY_ID[id];
    parts.push('<h4 class="ex-chapter">' + esc(c.name) + ' <small>' + esc(c.month) + '</small></h4><ul class="ex-list">' + items.map(i =>
      row(almanacCurioSVG(i.curio, c), i.name, i.curio.text, buyButton({ ...i, can: m.souls >= i.cost, owned: false }, 'back'), i.bargain ? 'bargain' : '')).join('') + '</ul>');
  }
  if (list.decor.length) parts.push('<h4 class="ex-chapter">Room sets</h4><ul class="ex-list">' + list.decor.map(d => {
    const c = CHAPTER_BY_ID[d.chapter], room = ROOMS[c.decor.room.id];
    return row(swatch(room.swatch), d.name, c.name + ': a room, a shelf wood and a wall.', buyButton({ ...d, can: m.souls >= d.cost, owned: false }, 'back'));
  }).join('') + '</ul>');
  if (!parts.length) parts.push('<p class="ex-empty">' + (pastChapters(now).length
    ? 'Nothing to buy back. Every finished chapter is in the cabinet, which is a thing very few people can say.'
    : 'Nothing has finished yet. A chapter lands here the day after it ends, so that nothing is lost for good, only dearer.') + '</p>');
  return '<p class="hint">A chapter’s curios are handed out while it runs. After that they cost ' + BACK_ISSUE_COST + ' souls each, because that is how the bookshop is run.</p>' + parts.join('');
}

function framesHTML(state, cat) {
  const cabinet = cat.frames.map(f => row('<span class="col-frame-sample fr-' + esc(f.id) + '"></span>', f.name, f.line,
    f.owned ? (f.active ? '<span class="ex-on">Worn</span>' : '<button class="btn btn-sm" type="button" data-ex="wear-frame" data-id="' + esc(f.id) + '">Wear</button>') :
      f.locked ? '<span class="ex-lock">Complete a set</span>' : buyButton(f, 'frame'), f.active ? 'active' : '')).join('');
  const portraits = cat.portraits.map(f => row('<span class="pf-sample pf-' + esc(f.id) + '"></span>', f.name, f.line, f.owned ? '<span class="ex-on">Yours</span>' : buyButton(f, 'portrait'))).join('');
  const owned = cat.portraits.filter(f => f.owned);
  const wear = S.pets.length && owned.length > 1 ? '<h4 class="ex-chapter">Who wears what</h4><ul class="ex-list">' + S.pets.map(p =>
    row('', p.name, 'Portrait frame on their card.', '<select class="ex-select" data-ex="pet-frame" data-id="' + esc(p.id) + '" aria-label="Portrait frame for ' + esc(p.name) + '">' + owned.map(f => '<option value="' + esc(f.id) + '"' + (portraitFor(S, p.id) === f.id ? ' selected' : '') + '>' + esc(f.name) + '</option>').join('') + '</select>')).join('') + '</ul>' : '';
  return '<h4 class="ex-chapter">Cabinet frames</h4><ul class="ex-list">' + cabinet + '</ul><h4 class="ex-chapter">Portrait frames</h4><ul class="ex-list">' + portraits + '</ul>' + wear;
}

function decorHTML(state, cat) {
  const kinds = { room: 'Rooms', wood: 'Shelf woods', wall: 'Walls', accent: 'Accents' };
  const art = item => item.kind === 'room' ? swatch(ROOMS[item.id].swatch) : item.kind === 'wood' ? swatch(WOODS[item.id].lip) : item.kind === 'accent' ? swatch(ACCENTS[item.id].c) : '<span class="ex-swatch wallsample wall-' + esc(item.id) + '"></span>';
  return Object.entries(kinds).map(([kind, title]) => {
    const items = cat.decor.filter(d => d.kind === kind);
    return '<h4 class="ex-chapter">' + title + '</h4><ul class="ex-list">' + items.map(d => row(art(d), d.name, d.line, d.owned ? '<span class="ex-on">Yours</span>' : buyButton(d, 'decor'))).join('') + '</ul>';
  }).join('') + '<p class="hint">Bought rooms, woods and walls appear under Decorate. Almanac room sets come from the track, or from Back Issues once a chapter has ended.</p><button class="btn" type="button" data-ex="decorate">Open Decorate</button>';
}

function commissionsHTML(cat) {
  return '<p class="hint">One-off orders, placed once and never refunded. Each leaves a document on the note board and a title. They are for the person who has everything, and a lot of souls.</p><ul class="ex-list">' +
    cat.commissions.map(c => row(glyph('scroll'), c.name, c.owned ? c.done : c.blurb, c.owned ? '<span class="ex-on">On file</span>' : buyButton(c, 'commission'), c.owned ? 'filed' : '')).join('') + '</ul>';
}

function legacyTabHTML(state, cat) {
  const l = legacyInfo(state);
  const tokenItems = [...cat.frames, ...cat.portraits, ...cat.decor].filter(i => i.tokens);
  return '<div class="ex-legacy"><b>' + (l.level ? 'Legacy ' + l.level + ': ' + esc(l.rank.short) : 'Not yet past Unspeakable') + '</b><small>' + l.earned + ' earned · ' + l.spent + ' spent · <span class="ex-tokens">' + l.balance + ' to spend</span>' +
    (l.next ? ' · next in ' + num(Math.max(0, l.toNext)) + ' souls' : '') + '</small></div>' +
    '<ul class="ex-list">' + tokenItems.map(i => row(i.kind ? (i.kind === 'room' ? swatch(ROOMS[i.id].swatch) : i.kind === 'wood' ? swatch(WOODS[i.id].lip) : i.kind === 'accent' ? swatch(ACCENTS[i.id].c) : '<span class="ex-swatch wallsample wall-' + esc(i.id) + '"></span>') : (FRAME_BY_ID[i.id] ? '<span class="col-frame-sample fr-' + esc(i.id) + '"></span>' : '<span class="pf-sample pf-' + esc(i.id) + '"></span>'),
      i.name, i.line, i.owned ? '<span class="ex-on">Yours</span>' : buyButton(i, i.kind ? 'decor' : FRAME_BY_ID[i.id] ? 'frame' : 'portrait'))).join('') + '</ul>' +
    '<p class="hint">One Legacy Token for every Legacy rank, from lifetime souls. Nothing resets and nothing is taken away.</p>';
}

const TABS = [['back', 'Back Issues'], ['frames', 'Frames'], ['decor', 'Rooms & walls'], ['commissions', 'Commissions'], ['legacy', 'Legacy']];
function renderExchange(state, now = Date.now()) {
  const el = sheet();
  if (!el) return;
  const cat = exchangeCatalog(state);
  const body = tab === 'back' ? backHTML(state, now) : tab === 'frames' ? framesHTML(state, cat) : tab === 'decor' ? decorHTML(state, cat) : tab === 'commissions' ? commissionsHTML(cat) : legacyTabHTML(state, cat);
  el.className = 'sheet sheet-exchange';
  el.innerHTML = '<div class="sheet-head"><div><span class="eyebrow">For the person with everything</span><h2>The Collector’s Exchange</h2></div><button class="btn btn-ghost btn-sm" type="button" data-ex="close">Close</button></div>' +
    '<div class="ex-purse" aria-live="polite"><span><b>' + num(cat.souls) + '</b> souls</span><span><b>' + cat.tokens + '</b> ' + (cat.tokens === 1 ? 'Legacy Token' : 'Legacy Tokens') + '</span></div>' +
    (notice ? '<p class="ex-notice" role="status">' + esc(notice) + '</p>' : '') +
    '<div class="ex-tabs" role="group" aria-label="Sections">' + TABS.map(([id, label]) => '<button class="filter-chip" type="button" data-ex="tab" data-id="' + id + '" aria-pressed="' + (tab === id) + '">' + label + '</button>').join('') + '</div>' +
    '<div class="ex-body">' + body + '</div>';
}
export function openExchange(next, state = S) {
  if (next && TABS.some(t => t[0] === next)) tab = next;
  notice = ''; armed = null;
  renderExchange(state);
  openSheet('exchangeVeil');
  sheet()?.scrollTo?.({ top: 0 });
}

function bought(message, kind = 'souls') {
  notice = message; armed = null;
  checkAchievements(S);
  save();
  renderExchange(S);
  chime(kind); celebrate(kind, { message });
  refresh();
}
function attempt(key, big, run) {
  if (big && armed !== key) { armed = key; renderExchange(S); return; }
  armed = null;
  run();
}

/* ---------- portrait frames on the resident card ---------- */
function paintPortrait() {
  const stage = document.querySelector('#cardSheet .portrait-stage');
  if (!stage || !S) return;
  const id = stage.querySelector('[data-pet]')?.dataset.pet;
  const frame = id ? portraitFor(S, id) : 'plain';
  stage.className = stage.className.replace(/\bpf-[a-z-]+\b/g, '').trim() + (frame !== 'plain' ? ' pf-' + frame : '');
}

export function initCollections(state, onRefresh) {
  S = state;
  refresh = onRefresh || refresh;
  document.addEventListener('click', event => {
    const control = event.target.closest?.('[data-col],[data-ex]');
    if (!control || !S) return;
    if (control.dataset.col) {
      const action = control.dataset.col;
      if (action === 'claim') {
        const r = claimSet(S, control.dataset.id);
        if (!r) return;
        checkAchievements(S); save();
        chime('set'); celebrate('set', { set: r.set.id });
        say(r.set.name + ' complete: +' + r.souls + ' souls' + (r.title ? ', title “' + r.title + '”' : '') + (r.frame ? ', frame “' + r.frame + '”' : '') + '.');
        const sec = byId('colSets'); if (sec) sec.outerHTML = setsHTML(S);
        refresh();
      } else if (action === 'curio') {
        const k = CHAPTERS.flatMap(c => c.curios.map(x => ({ x, c }))).find(i => i.x.id === control.dataset.id), box = byId('colCurioDetail');
        if (k && box) { box.hidden = false; box.innerHTML = '<div class="mh-curio-card rarity-edition fresh" style="--rc:' + esc(k.c.colors.glow) + '"><span class="mh-curio-flag">' + esc(k.c.name) + '</span><span class="mh-curio-art col-detail-art">' + almanacCurioSVG(k.x, k.c) + '</span><span class="mh-rarity">Almanac edition</span><b>' + esc(k.x.name) + '</b><p>' + esc(k.x.text) + '</p></div>'; box.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
      } else if (action === 'exchange') {
        window.dispatchEvent(new CustomEvent('shelflife:almanac', { detail: { view: 'exchange', tab: control.dataset.tab } }));
      }
      return;
    }
    const action = control.dataset.ex;
    if (control.closest('#exchangeVeil') === null) return;
    const id = control.dataset.id, now = Date.now();
    if (action === 'close') { closeSheet('exchangeVeil'); notice = ''; armed = null; refresh(); }
    else if (action === 'tab') { tab = id; notice = ''; armed = null; renderExchange(S); }
    else if (action === 'wear-frame') { if (equipFrame(S, id)) { save(); renderExchange(S); refresh(); } }
    else if (action === 'decorate') { closeSheet('exchangeVeil'); byId('decorBtn')?.click(); }
    else if (action === 'frame') attempt('frame:' + id, (FRAME_BY_ID[id].cost || 0) >= CONFIRM_AT, () => { const f = buyFrame(S, id); if (f) { equipFrame(S, id); bought(f.name + ' is yours, and already on the cabinet.', 'curio'); } });
    else if (action === 'portrait') attempt('portrait:' + id, false, () => { const f = buyPortraitFrame(S, id); if (f) bought(f.name + ' is yours. Choose who wears it below.', 'curio'); });
    else if (action === 'decor') attempt('decor:' + id, (NEW_DECOR[id].cost || 0) >= CONFIRM_AT, () => { const item = buyDecor(S, id); if (item) bought(item.name + ' is yours. It is under Decorate now.', 'curio'); });
    else if (action === 'commission') attempt('commission:' + id, true, () => { const c = placeCommission(S, id, now); if (c) bought('Commissioned: ' + c.name + '. It is on the note board.', 'set'); });
    else if (action === 'back') {
      const big = (backIssues(S, now).curios.concat(backIssues(S, now).decor).find(i => i.id === id)?.cost || 0) >= CONFIRM_AT;
      attempt('back:' + id, big, () => { const r = buyBackIssue(S, id, now); if (r) bought(r.item.name + ' is back in the cabinet.', 'curio'); });
    }
  });
  document.addEventListener('change', event => {
    const select = event.target.closest?.('[data-ex="pet-frame"]');
    if (!select || !S) return;
    if (equipPortraitFrame(S, select.dataset.id, select.value)) { save(); refresh(); }
  });
  window.addEventListener('shelflife:almanac', event => {
    const view = event.detail?.view;
    if (view === 'exchange') openExchange(event.detail.tab);
    else if (view === 'collections') {
      byId('almanacVeil')?.classList.remove('open');
      byId('soulsHud')?.click();
      setTimeout(() => byId('colSets')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 80);
    }
  });
  byId('exchangeBtn')?.addEventListener('click', () => openExchange('back'));
  byId('decorShop')?.addEventListener('click', () => { byId('decorVeil')?.classList.remove('open'); openExchange('decor'); });
  byId('collectionsBtn')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('shelflife:almanac', { detail: { view: 'collections' } })));
  byId('exchangeVeil')?.setAttribute('aria-label', 'The Collector’s Exchange');
  byId('exchangeVeil')?.addEventListener('click', event => { if (event.target === byId('exchangeVeil')) { closeSheet('exchangeVeil'); refresh(); } });
  const card = byId('cardSheet');
  if (card) new MutationObserver(paintPortrait).observe(card, { childList: true, subtree: true });
  return { open: openExchange, setsHTML };
}

export { completedSetCount, plural, memberInfo, SETS, PORTRAIT_FRAMES, CABINET_FRAMES };

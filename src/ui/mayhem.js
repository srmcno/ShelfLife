import {
  accrueMayhem, nextEmergencyIn, describeEmergency, resolveEmergency, openCoffin, coffinCost, drawOmen,
  omenPending, todaysOmen, ensureChores, choreInfo, rankInfo, curioCount, onMayhem, CURIO_BY_ID, RARITY_BY_ID,
  queueCap, pokeDrawer, POKE_COST
} from '../engine/mayhem.js';
import { mayhemState } from '../mayhem-state.js';
import { CURIOS, RARITIES, RANKS, QUIET_LINES } from '../content/mayhem.js';
import { renderPetSprite } from '../art/sprite.js';
import { glyph } from '../art/mayhem-glyphs.js';
import { reactTo } from '../art/animator.js';
import { playAchievement, playPowerUp, playStar, playStomp, playFeud, playUnlock } from '../audio/sound.js';
import { save } from '../state.js';
import { toast } from './toast.js';

/* The mayhem loop's surfaces: a souls counter in the top bar, an alarm strip
   over the cabinet, a small desk under the actions, and one sheet that shows an
   emergency, a coffin, the omen or the Cabinet of Curiosities. */

const byId = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const plural = (n, one, many = one + 's') => n + ' ' + (n === 1 ? one : many);
const clock = ms => { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const quiet = () => QUIET_LINES[Math.floor(Date.now() / 60000) % QUIET_LINES.length];

let S = null, refresh = () => {};
let view = null;           // what the sheet is showing
const veil = byId('mayhemVeil');
const sheet = byId('mayhemSheet');
const hud = byId('soulsHud');
const alertEl = byId('mayhemAlert');
const deskEl = byId('mayhemDesk');
const rankEl = byId('mayhemRankUp');
const marks = new WeakMap();

function setHTML(node, html) {
  if (!node || marks.get(node) === html) return;
  node.innerHTML = html;
  marks.set(node, html);
}

/* ---------------- top bar ---------------- */
function renderHud(state) {
  if (!hud) return;
  const m = mayhemState(state), info = rankInfo(state);
  hud.hidden = !state.pets.length && !m.lifetime;
  setHTML(hud, '<span class="souls-icon">' + glyph('soul') + '</span>' +
    '<span class="souls-count"><b>' + m.souls + '</b><small>souls</small></span>' +
    '<span class="souls-rank"><em>' + esc(info.rank.title) + '</em><i class="souls-bar"><i style="width:' + Math.round(info.progress * 100) + '%"></i></i></span>');
  hud.setAttribute('aria-label', m.souls + ' souls. Household rank: ' + info.rank.title + '. Open the Cabinet of Curiosities.');
}

/* ---------------- the alarm strip ---------------- */
function renderAlert(state, now = Date.now()) {
  if (!alertEl) return;
  const m = mayhemState(state);
  if (!state.pets.length) { alertEl.hidden = true; return; }
  alertEl.hidden = false;
  if (omenPending(state, now)) {
    setHTML(alertEl, '<button class="mh-alert omen" type="button" data-mh="omen"><span class="mh-siren">' + glyph('eye') + '</span>' +
      '<span class="mh-alert-text"><b>Tonight’s omen is face down</b><span>Turn it over. The house has been waiting all day to tell you something.</span></span><span class="mh-alert-go">Reveal</span></button>');
    return;
  }
  const first = m.queue.map(entry => describeEmergency(state, entry)).find(Boolean);
  if (first) {
    const n = m.queue.length;
    setHTML(alertEl, '<button class="mh-alert hot" type="button" data-mh="emergency"><span class="mh-siren">' + glyph(first.template.art) + '</span>' +
      '<span class="mh-alert-text"><b>' + (n > 1 ? n + ' emergencies' : 'Emergency') + '</b><span>' + esc(first.title) + '</span></span><span class="mh-alert-go">Deal with it</span></button>');
    return;
  }
  const wait = nextEmergencyIn(state, now);
  setHTML(alertEl, '<button class="mh-alert calm" type="button" data-mh="quiet"><span class="mh-siren">' + glyph('candle') + '</span><span class="mh-alert-text"><b>' + esc(quiet()) + '</b>' +
    '<span>Next disaster in <b data-countdown>' + clock(wait) + '</b></span></span><span class="mh-alert-go">Poke the drawer</span></button>');
}

/* ---------------- pets in trouble ---------------- */
function markTrouble(state) {
  const trouble = new Set(mayhemState(state).queue.flatMap(q => [q.a, q.b]).filter(Boolean));
  document.querySelectorAll('#cabinet .pet[data-id]').forEach(el => el.classList.toggle('mh-trouble', trouble.has(el.dataset.id)));
}

/* ---------------- the desk ---------------- */
function renderDesk(state, now = Date.now()) {
  if (!deskEl) return;
  if (!state.pets.length) { deskEl.hidden = true; return; }
  deskEl.hidden = false;
  const m = mayhemState(state);
  const omen = todaysOmen(state, now);
  const chores = ensureChores(state, now);
  const cost = coffinCost(state, now);
  const owned = curioCount(state);
  const done = chores.list.filter(c => c.done).length;
  const omenTile = omen
    ? '<button class="mh-tile mh-omen-tile" type="button" data-mh="omen-view"><span class="mh-tile-kicker">Tonight’s omen · night ' + m.omen.streak + '</span><b>' + esc(omen.name) + '</b><small>' + esc(omen.line.split('.')[0]) + '.</small></button>'
    : '<button class="mh-tile mh-omen-tile pending" type="button" data-mh="omen"><span class="mh-tile-kicker">Tonight’s omen</span><b>Face down</b><small>Turn it over for free souls.</small></button>';
  const choreRows = chores.list.map(entry => {
    const c = choreInfo(entry); if (!c) return '';
    return '<li class="' + (c.done ? 'done' : '') + '"><span class="mh-check" aria-hidden="true">' + (c.done ? '✓' : '') + '</span><span>' + esc(c.label) + '<small>' + esc(c.line) + '</small></span><em>' + c.have + '/' + c.need + '</em></li>';
  }).join('');
  const choresTile = '<div class="mh-tile mh-chores"><span class="mh-tile-kicker">Unholy chores · ' + done + '/3' + (chores.bonus ? ' · coffin claimed' : ' · all 3 = free curio') + '</span><ul>' + choreRows + '</ul></div>';
  const short = Math.max(0, cost - m.souls);
  const coffinTile = '<button class="mh-tile mh-coffin-tile" type="button" data-mh="coffin"' + (short ? ' aria-disabled="true"' : '') + '><span class="mh-coffin-art">' + glyph('coffin') + '</span><span><span class="mh-tile-kicker">Open a coffin</span><b>' + cost + ' souls</b><small>' + (short ? short + ' more souls needed' : 'Something inside is knocking') + '</small></span></button>';
  const cabinetTile = '<button class="mh-tile mh-cabinet-tile" type="button" data-mh="cabinet"><span class="mh-tile-kicker">Cabinet of Curiosities</span><b>' + owned + ' / ' + CURIOS.length + '</b><span class="mh-meter"><i style="width:' + Math.round(owned / CURIOS.length * 100) + '%"></i></span><small>' + esc(rankInfo(state).rank.title) + '</small></button>';
  setHTML(deskEl, omenTile + choresTile + coffinTile + cabinetTile);
}

// The count of waiting disasters follows you: onto the Shelf tab, into the
// browser tab title and, for an installed app, onto its icon.
const baseTitle = document.title;
function renderBadges(state) {
  const n = state.pets.length ? mayhemState(state).queue.length : 0;
  const badge = byId('shelfBadge');
  if (badge) { badge.hidden = !n; badge.textContent = n ? String(n) : ''; }
  const title = n ? '(' + n + ') ' + baseTitle : baseTitle;
  if (document.title !== title) document.title = title;
  try { if (n) navigator.setAppBadge?.(n)?.catch?.(() => {}); else navigator.clearAppBadge?.()?.catch?.(() => {}); } catch { /* badges are optional */ }
}

export function renderMayhem(state) {
  if (!state) return;
  S = state;
  renderBadges(state);
  renderHud(state);
  renderAlert(state);
  renderDesk(state);
  markTrouble(state);
}

/* ---------------- the sheet ---------------- */
function open() { if (!veil.classList.contains('open')) veil.classList.add('open'); }
function close() { veil.classList.remove('open'); view = null; sheet.className = 'sheet mh-sheet'; refresh(); }
function head(kicker, title, closeLabel = 'Close') {
  return '<div class="sheet-head"><div><span class="eyebrow">' + esc(kicker) + '</span><h2>' + esc(title) + '</h2></div><button class="btn btn-ghost btn-sm" type="button" data-mh="close">' + esc(closeLabel) + '</button></div>';
}
function sprite(pet, cls) {
  const holder = document.createElement('div');
  holder.className = 'mh-actor ' + cls;
  const s = renderPetSprite(pet);
  s.classList.add('sl-mood-content');
  holder.appendChild(s);
  return holder;
}

function showEmergency(state) {
  const m = mayhemState(state);
  const info = m.queue.map(entry => describeEmergency(state, entry)).find(Boolean);
  if (!info) { showQuiet(state); return; }
  view = { mode: 'emergency', uid: info.entry.uid };
  const index = m.queue.indexOf(info.entry) + 1;
  sheet.className = 'sheet mh-sheet mh-emergency';
  sheet.innerHTML = head('Emergency ' + index + ' of ' + m.queue.length, 'Something has happened', 'Later') +
    '<div class="mh-card"><div class="mh-scene"><div class="mh-prop">' + glyph(info.template.art) + '</div></div>' +
    '<h3 class="mh-title">' + esc(info.title) + '</h3>' +
    '<div class="mh-choices">' + info.choices.map((label, i) => '<button class="mh-choice" type="button" data-choice="' + i + '"><span>' + (i ? 'B' : 'A') + '</span>' + esc(label) + '</button>').join('') + '</div>' +
    '<p class="mh-fineprint">Every choice pays souls. Not every choice goes well.</p></div>';
  const scene = sheet.querySelector('.mh-scene');
  scene.prepend(sprite(info.a, 'mh-actor-a'));
  if (info.b) scene.appendChild(sprite(info.b, 'mh-actor-b'));
  scene.classList.toggle('pair', !!info.b);
  open();
  sheet.querySelector('.mh-choice')?.focus({ preventScroll: true });
}

function showQuiet(state) {
  view = { mode: 'quiet' };
  sheet.className = 'sheet mh-sheet';
  const souls = mayhemState(state).souls;
  sheet.innerHTML = head('All clear', 'Nothing is on fire') + '<p class="mh-quiet">' + esc(quiet()) + '</p><p class="mh-quiet">Next disaster in <b data-countdown>' + clock(nextEmergencyIn(state)) + '</b>. Up to ' + queueCap(state) + ' can pile up while you are away.</p>' +
    '<div class="mh-next"><button class="btn btn-primary" type="button" data-mh="poke"' + (souls < POKE_COST ? ' disabled' : '') + '>Poke the drawer · ' + POKE_COST + ' souls</button><button class="btn btn-ghost" type="button" data-mh="cabinet">Cabinet</button></div>' +
    '<p class="mh-coffin-note">Something in there is always willing to start trouble. It charges.</p>';
  open();
}

function rewardList(result) {
  const items = [];
  if (result.souls) items.push('<li class="souls">' + glyph('soul') + '+' + result.souls + ' souls</li>');
  if (result.trust) items.push('<li class="good">' + esc(result.a.name) + ' trusts you a little more</li>');
  if (result.grudge) items.push('<li class="bad">' + esc(result.grudge) + ' is holding a grudge</li>');
  if (result.fallout) items.push('<li class="bad">' + esc(result.fallout.name) + ' ' + ({ food: 'needs feeding now', fuss: 'needs some attention now', clean: 'needs a wash now' })[result.fallout.need] + '</li>');
  (result.chores || []).forEach(c => { if (c.chore) items.push('<li class="souls">Chore done: ' + esc(c.chore.label) + ' · +' + c.souls + '</li>'); else if (c.bonus) items.push('<li class="good">All chores done. A free curio.</li>'); });
  return items.length ? '<ul class="mh-rewards">' + items.join('') + '</ul>' : '';
}

function curioCard(roll, extra = '') {
  const rarity = roll.rarity || RARITY_BY_ID[roll.curio.rarity];
  return '<div class="mh-curio-card rarity-' + rarity.id + (roll.duplicate ? ' duplicate' : ' fresh') + '">' +
    '<span class="mh-curio-flag">' + (roll.duplicate ? 'Duplicate · +' + roll.refund + ' souls' : 'New curio') + '</span>' +
    '<span class="mh-curio-art">' + glyph(roll.curio.glyph) + '</span>' +
    '<span class="mh-rarity">' + esc(rarity.label) + '</span><b>' + esc(roll.curio.name) + '</b><p>' + esc(roll.curio.text) + '</p>' +
    (roll.quip ? '<small>' + esc(roll.quip) + '</small>' : '') + extra + '</div>';
}

function choose(state, index) {
  if (!view || view.mode !== 'emergency') return;
  const result = resolveEmergency(state, view.uid, index);
  if (!result) { showEmergency(state); return; }
  save();
  view = { mode: 'result' };
  const left = mayhemState(state).queue.length;
  const card = sheet.querySelector('.mh-card');
  sheet.querySelector('.sheet-head .eyebrow').textContent = 'You chose: ' + result.choice;
  sheet.querySelector('.sheet-head [data-mh="close"]').textContent = 'Close';
  card.classList.add('resolved', 'tone-' + result.tone);
  card.querySelector('.mh-choices').outerHTML = '<div class="mh-outcome"><div class="mh-stamp tone-' + result.tone + '">' + esc(result.stamp) + '</div>' +
    '<p class="mh-text">' + esc(result.text) + '</p>' + rewardList(result) +
    (result.curio ? '<div class="mh-drop"><span class="mh-drop-kicker">Something was left behind</span>' + curioCard(result.curio) + '</div>' : '') +
    '<div class="mh-next">' + (left ? '<button class="btn btn-primary" type="button" data-mh="emergency">Next emergency <small>(' + left + ' left)</small></button>' : mayhemState(state).souls >= POKE_COST ? '<button class="btn btn-primary" type="button" data-mh="poke">Poke the drawer · ' + POKE_COST + '</button><button class="btn" type="button" data-mh="close">Back to the shelf</button>' : '<button class="btn btn-primary" type="button" data-mh="close">Back to the shelf</button>') +
    '<button class="btn btn-ghost" type="button" data-mh="cabinet">Cabinet</button></div></div>';
  card.querySelector('.mh-fineprint')?.remove();
  (result.tone === 'bad' ? playFeud : result.tone === 'good' ? playStar : playStomp)();
  if (result.curio && !result.curio.duplicate) setTimeout(() => playUnlock(), 450);
  card.querySelectorAll('.mh-actor').forEach(el => el.classList.add(result.tone === 'bad' ? 'recoil' : 'bounce'));
  reactTo(result.a.id, result.tone === 'bad' ? 'food' : 'fuss');
  sheet.querySelector('.mh-next .btn')?.focus({ preventScroll: true });
  refresh();
}

function showCoffin(state) {
  const cost = coffinCost(state), m = mayhemState(state);
  view = { mode: 'coffin' };
  sheet.className = 'sheet mh-sheet mh-coffin';
  const short = cost - m.souls;
  sheet.innerHTML = head('The undertaker’s back room', 'Open a coffin') +
    '<div class="mh-coffin-stage"><button class="mh-coffin-box" type="button" data-mh="pry"' + (short > 0 ? ' disabled' : '') + ' aria-label="Pry the coffin open for ' + cost + ' souls">' + glyph('coffin') + '</button></div>' +
    '<p class="mh-coffin-note">' + (short > 0 ? 'You need ' + short + ' more souls. Deal with a few emergencies. Someone always digs something up.' : 'Tap the coffin to pry it open. <b>' + cost + ' souls.</b> You have ' + m.souls + '.') + '</p>' +
    '<p class="mh-odds">' + RARITIES.map(r => '<span class="rarity-' + r.id + '">' + esc(r.label) + '</span>').join(' · ') + '</p>';
  open();
  sheet.querySelector('.mh-coffin-box:not([disabled])')?.focus({ preventScroll: true });
}

function pry(state) {
  const box = sheet.querySelector('.mh-coffin-box');
  if (!box || box.dataset.opening) return;
  const result = openCoffin(state);
  if (!result) { showCoffin(state); return; }
  save();
  box.dataset.opening = '1';
  box.classList.add('shaking');
  playStomp();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  setTimeout(() => {
    const m = mayhemState(state), cost = coffinCost(state);
    const again = m.souls >= cost;
    sheet.querySelector('.mh-coffin-stage').innerHTML = curioCard(result);
    sheet.querySelector('.mh-coffin-note').innerHTML = '<span class="mh-next"><button class="btn btn-primary" type="button" data-mh="coffin"' + (again ? '' : ' disabled') + '>' + (again ? 'Open another · ' + cost : 'Need ' + (cost - m.souls) + ' more souls') + '</button><button class="btn btn-ghost" type="button" data-mh="cabinet">See the cabinet</button></span>';
    (['cursed', 'unholy', 'rare'].includes(result.rarity.id) ? playAchievement : result.duplicate ? playStar : playUnlock)();
    sheet.querySelector('.mh-next .btn')?.focus({ preventScroll: true });
    refresh();
  }, reduce ? 60 : 900);
}

function showOmen(state, revealed = null) {
  view = { mode: 'omen' };
  sheet.className = 'sheet mh-sheet mh-omen';
  const omen = revealed?.omen || todaysOmen(state);
  if (!omen) {
    sheet.innerHTML = head('Once a night', 'Tonight’s omen') +
      '<div class="mh-tarot-stage"><button class="mh-tarot" type="button" data-mh="flip" aria-label="Turn the omen over"><span class="mh-tarot-back">' + glyph('eye') + '</span></button></div>' +
      '<p class="mh-coffin-note">Turn it over. Come back tomorrow night for another. Nights in a row pay more.</p>';
    open();
    sheet.querySelector('.mh-tarot')?.focus({ preventScroll: true });
    return;
  }
  const m = mayhemState(state);
  sheet.innerHTML = head('Night ' + m.omen.streak + (m.omen.streak > 1 ? ' in a row' : ''), 'Tonight’s omen') +
    '<div class="mh-tarot-stage"><div class="mh-tarot face' + (revealed ? ' flipping' : '') + '"><span class="mh-tarot-face"><span class="mh-tarot-art">' + glyph(omenGlyph(omen.id)) + '</span><b>' + esc(omen.name) + '</b></span></div></div>' +
    '<p class="mh-omen-line">' + esc(omen.line) + '</p>' +
    (revealed ? '<ul class="mh-rewards"><li class="souls">' + glyph('soul') + '+' + revealed.gift + ' souls for showing up</li>' + (m.omen.streak < 7 ? '<li>Night ' + m.omen.streak + ' of 7. The seventh night leaves something rare on the step.</li>' : '') + '</ul>' : '') +
    (revealed?.bonus ? '<div class="mh-drop"><span class="mh-drop-kicker">Seven nights. Something was left on the step.</span>' + curioCard(revealed.bonus) + '</div>' : '') +
    '<div class="mh-next"><button class="btn btn-primary" type="button" data-mh="' + (mayhemState(state).queue.length ? 'emergency' : 'close') + '">' + (mayhemState(state).queue.length ? 'See what went wrong' : 'Back to the shelf') + '</button></div>';
  open();
  sheet.querySelector('.mh-next .btn')?.focus({ preventScroll: true });
}
function omenGlyph(id) {
  return ({ 'wet-hand': 'hand', 'hanged-spoon': 'spoon', 'open-coffin': 'coffin', 'many-eyes': 'eye', 'crowded-grave': 'grave', 'patient-worm': 'bug', 'smiling-moon': 'glow', 'second-shadow': 'shadow', 'tolling-bell': 'clock', 'hungry-house': 'door' })[id] || 'skull';
}
function flip(state) {
  const result = drawOmen(state);
  if (!result) { showOmen(state); return; }
  save();
  playPowerUp();
  showOmen(state, result);
  refresh();
}

function showCabinet(state) {
  view = { mode: 'cabinet' };
  const m = mayhemState(state), info = rankInfo(state);
  sheet.className = 'sheet mh-sheet mh-cabinet';
  const ladder = RANKS.map((rank, i) => '<li class="' + (i < info.index ? 'past' : i === info.index ? 'now' : 'future') + '"><b>' + (i <= info.index + 1 ? esc(rank.title) : '???') + '</b><small>' + rank.at + '</small></li>').join('');
  const groups = RARITIES.map(r => {
    const items = CURIOS.filter(c => c.rarity === r.id).map(c => {
      const n = m.curios[c.id] || 0;
      return n
        ? '<button class="mh-shelf-item rarity-' + r.id + '" type="button" data-curio="' + c.id + '"><span class="mh-curio-art">' + glyph(c.glyph) + '</span><b>' + esc(c.name) + '</b>' + (n > 1 ? '<em>×' + n + '</em>' : '') + '</button>'
        : '<span class="mh-shelf-item missing rarity-' + r.id + '"><span class="mh-curio-art">' + glyph(c.glyph) + '</span><b>???</b></span>';
    }).join('');
    const have = CURIOS.filter(c => c.rarity === r.id && m.curios[c.id]).length, total = CURIOS.filter(c => c.rarity === r.id).length;
    return '<section class="mh-shelf-group"><h3 class="rarity-' + r.id + '">' + esc(r.label) + ' <small>' + have + '/' + total + '</small></h3><div class="mh-shelf-grid">' + items + '</div></section>';
  }).join('');
  const log = m.log.slice(0, 6).map(entry => '<li class="tone-' + entry.tone + '"><span class="mh-mini-stamp">' + esc(entry.stamp) + '</span><span><b>' + esc(entry.title) + '</b> ' + esc(entry.text) + '</span></li>').join('');
  sheet.innerHTML = head('Souls earned in this house: ' + m.lifetime, 'Cabinet of Curiosities') +
    '<section class="mh-rank-card"><span class="mh-tile-kicker">The neighbours call this house</span><h3>' + esc(info.rank.title) + '</h3><p>' + esc(info.rank.line) + '</p>' +
    '<span class="mh-meter big"><i style="width:' + Math.round(info.progress * 100) + '%"></i></span>' +
    '<small>' + (info.next ? info.toNext + ' more souls until the neighbours start saying “' + esc(info.next.title) + '”' : 'There is nothing worse they can call you. Well done.') + '</small>' +
    '<ol class="mh-ladder">' + ladder + '</ol>' +
    '<p class="mh-stats">' + plural(m.resolved, 'emergency', 'emergencies') + ' survived · ' + plural(m.coffins, 'coffin') + ' opened · ' + m.souls + ' souls in hand</p></section>' +
    '<div class="mh-cabinet-actions"><button class="btn btn-primary" type="button" data-mh="coffin">Open a coffin · ' + coffinCost(state) + '</button>' + (m.queue.length ? '<button class="btn" type="button" data-mh="emergency">' + plural(m.queue.length, 'emergency', 'emergencies') + ' waiting</button>' : '') + '</div>' +
    '<div class="mh-curio-detail" id="mhCurioDetail" hidden></div>' +
    groups +
    (log ? '<section class="mh-log"><h3>The incident reports</h3><ul>' + log + '</ul></section>' : '');
  open();
}
function showCurio(id) {
  const curio = CURIO_BY_ID[id], box = byId('mhCurioDetail');
  if (!curio || !box || !S) return;
  const n = mayhemState(S).curios[id] || 0;
  box.hidden = false;
  box.innerHTML = curioCard({ curio, rarity: RARITY_BY_ID[curio.rarity], duplicate: false, refund: 0 }).replace('New curio', n > 1 ? 'Owned ×' + n : 'Owned');
  box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/* ---------------- celebrations ---------------- */
let rankTimer = null;
function celebrateRank(rank) {
  if (!rankEl) return;
  rankEl.innerHTML = '<div class="mh-rankup-card"><span class="mh-tile-kicker">The neighbours have a new word for you</span><b>' + esc(rank.title) + '</b><p>' + esc(rank.line) + '</p></div>';
  rankEl.hidden = false;
  rankEl.classList.remove('show'); void rankEl.offsetWidth; rankEl.classList.add('show');
  playAchievement();
  clearTimeout(rankTimer);
  rankTimer = setTimeout(() => { rankEl.classList.remove('show'); rankEl.hidden = true; }, 5200);
}
function floatSouls(amount) {
  if (!hud || hud.hidden || !amount) return;
  const f = document.createElement('span');
  f.className = 'souls-float';
  f.textContent = '+' + amount;
  hud.appendChild(f);
  hud.classList.remove('pulse'); void hud.offsetWidth; hud.classList.add('pulse');
  setTimeout(() => f.remove(), 1400);
}

/* ---------------- wiring ---------------- */
const pendingNews = [];
let newsTimer = null;
function later(message) {
  pendingNews.push(message);
  if (newsTimer) return;
  const next = () => {
    const m = pendingNews.shift();
    if (!m) { newsTimer = null; return; }
    // Never drop news over a game or another sheet; the desk already shows it.
    if (!document.querySelector('.veil.open:not(#mayhemVeil)')) toast(m);
    newsTimer = setTimeout(next, 3400);
  };
  newsTimer = setTimeout(next, 3400);
}

export function initMayhem(state, onRefresh) {
  S = state;
  refresh = onRefresh || refresh;
  onMayhem(event => {
    if (event.type === 'rank') celebrateRank(event.rank);
    else if (event.type === 'souls') floatSouls(event.amount);
    // Chore news waits for the joke that earned it to finish landing.
    else if (event.type === 'chore') { floatSouls(event.souls); later('Chore done: ' + event.chore.label + '. +' + event.souls + ' souls.'); }
    else if (event.type === 'chores-complete') later('All three chores done. A free curio: ' + event.prize.curio.name + (event.prize.duplicate ? ' (duplicate, +' + event.prize.refund + ' souls)' : '') + '.');
  });
  document.addEventListener('click', event => {
    const control = event.target.closest?.('[data-mh],[data-choice],[data-curio]');
    if (!control || !S) return;
    if (control.closest('#mayhemVeil') === null && !control.closest('#mayhemAlert,#mayhemDesk')) return;
    if (control.getAttribute('aria-disabled') === 'true' && control.dataset.mh === 'coffin') { showCoffin(S); return; }
    if (control.dataset.choice != null) { choose(S, Number(control.dataset.choice)); return; }
    if (control.dataset.curio) { showCurio(control.dataset.curio); return; }
    const action = control.dataset.mh;
    if (action === 'close') close();
    else if (action === 'emergency') showEmergency(S);
    else if (action === 'quiet') showQuiet(S);
    else if (action === 'coffin') showCoffin(S);
    else if (action === 'pry') pry(S);
    else if (action === 'cabinet') showCabinet(S);
    else if (action === 'omen') showOmen(S);
    else if (action === 'omen-view') showOmen(S);
    else if (action === 'flip') flip(S);
    else if (action === 'poke') { if (pokeDrawer(S)) { save(); playFeud(); showEmergency(S); refresh(); } else showQuiet(S); }
  });
  hud?.addEventListener('click', () => showCabinet(S));
  veil?.addEventListener('click', event => { if (event.target === veil) close(); });
  rankEl?.addEventListener('click', () => { rankEl.classList.remove('show'); rankEl.hidden = true; });
  // A one-second clock for the countdown. It only redraws the shelf when a new
  // emergency actually lands and nothing else is open.
  setInterval(() => {
    if (!S || document.hidden) return;
    const counter = document.querySelector('#mayhemAlert [data-countdown]');
    const sheetCounter = veil.classList.contains('open') ? sheet.querySelector('[data-countdown]') : null;
    const wait = nextEmergencyIn(S);
    if (counter) counter.textContent = clock(wait);
    if (sheetCounter) sheetCounter.textContent = clock(wait);
    if (wait === 0 && S.pets.length && !document.querySelector('.veil.open') && accrueMayhem(S)) { playFeud(); refresh(); }
  }, 1000);
  accrueMayhem(state);
  return { render: renderMayhem, isOpen: () => veil.classList.contains('open') };
}


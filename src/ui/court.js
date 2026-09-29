import { COURT_CAST, QUESTIONS_PER_EPISODE } from '../content/court.js';
import {
  courtCases, nextCaseId, castEpisode, episodeCase, episodeOpening, episodeQuestions, episodeAsk,
  randomHappening, resolveHappening, episodeBreak, episodeRule, courtFinish, fill, COURT_BY_ID, docketToday, DOCKET_SOULS, summonsReward
} from '../engine/court.js';
import { courtroomState } from '../court-state.js';
import { save } from '../state.js';
import { renderPetSprite } from '../art/sprite.js';
import { castSvg, COURT_PROPS } from '../art/court-cast.js';
import { glyph } from '../art/mayhem-glyphs.js';
import { escapadeView } from '../engine/escapades.js';
import { guestPet } from '../cloud/social.js';
import { guestPortrait, collectVerdicts, verdictLine } from './friends.js';
import { playTone, playStomp, playAchievement, playError, playStar, playUnlock } from '../audio/sound.js';

/* Shelf Court, the daytime TV show. You are Judge Mortis. The sheet is a
   studio: your bench at the back, the plaintiff and defendant at their
   podiums, the rest of the shelf in the jury box, and a ghost audience in the
   foreground. Lines type out one at a time; tap to hurry them. The episode
   itself is one async script that waits on your taps and choices. */

const byId = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const veil = byId('courtVeil'), sheet = byId('courtSheet');
const VOICES = { judge: 110, bailiff: 640, announcer: 180, p: 470, d: 380, audience: 220, jury: 300 };
const NPC_VOICES = { woodlouse: 440, geoffrey2: 470, moth: 560, lamp: 250, cat: 180, ghost: 330, uncle: 150, raven: 240, widow: 380, susan: 600 };
const TYPE_MS = 20;
const HEADS = 9;

let S = null, refresh = () => {};
let lobby = { caseId: '', plaintiffId: '', defendantId: '', standInSalt: Math.floor(Math.random() * 1000) };
let ep = null, session = 0;
// Summonses from friends (only when the social layer is on): what is in the
// post, and the one being heard right now.
let courtSocial = null, post = { cases: [], results: [], note: '' }, postToken = 0, hearing = null;
let queue = [], onDone = null, current = null, typer = 0, onChoice = null;
const timers = new Set();
const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = ms => new Promise(resolve => later(resolve, reduced() ? Math.min(ms, 80) : ms));
const $ = selector => sheet.querySelector(selector);

function head(title, kicker) {
  return '<div class="sheet-head"><div><span class="eyebrow">' + esc(kicker) + '</span><h2>' + esc(title) + '</h2></div><button class="btn btn-ghost btn-sm" type="button" data-sc="close">Close</button></div>';
}
function stopAll() {
  session++;
  for (const t of timers) clearTimeout(t);
  timers.clear(); clearInterval(typer); typer = 0;
  queue = []; onDone = null; current = null; onChoice = null;
}
function portrait(who) {
  if (who.kind === 'npc') return castSvg(who.art);
  if (who.kind === 'guest') return hearing?.pet ? guestPortrait(hearing.pet) : '';
  const pet = S.pets.find(p => p.id === who.id);
  if (!pet) return '';
  const holder = document.createElement('span');
  holder.appendChild(renderPetSprite(pet));
  return holder.innerHTML;
}
const stars = (n, max = 3) => Array.from({ length: max }, (_, i) => '<i class="' + (i < n ? 'on' : '') + '">★</i>').join('');

/* ---------------- the lobby ---------------- */
function docketLine(docket, k) {
  const today = COURT_BY_ID[docket.caseId];
  if (!today) return '';
  if (docket.done) return '<p class="sc-docket done"><b>Today’s docket is filed.</b> ' + (docket.streak > 1 ? docket.streak + ' days in session.' : 'Back tomorrow for another.') + '</p>';
  return '<p class="sc-docket"><b>Today’s docket: ' + esc(today.title) + '.</b> +' + DOCKET_SOULS + ' souls for airing it' + (docket.streak ? ' · ' + docket.streak + ' day' + (docket.streak === 1 ? '' : 's') + ' in session' : '') +
    (k.id === today.id ? '' : ' <button class="btn btn-ghost btn-sm" type="button" data-sc-case="' + today.id + '">Hear it</button>') + '</p>';
}
function defaultLobby(petId) {
  const pets = S.pets;
  const p = pets.find(x => x.id === petId) || pets.find(x => x.id === lobby.plaintiffId) || pets[0];
  const others = pets.filter(x => x.id !== p.id);
  const d = others.find(x => x.id === lobby.defendantId) || others[Math.floor(Math.random() * others.length)] || null;
  // The first time the lobby opens each day it offers the docket case, unless it is already aired.
  const docket = docketToday(S);
  const first = COURT_BY_ID[lobby.caseId] ? lobby.caseId : !docket.done && COURT_BY_ID[docket.caseId] ? docket.caseId : nextCaseId(S);
  lobby = { caseId: first, plaintiffId: p.id, defendantId: d?.id || '', standInSalt: lobby.standInSalt };
}
function showLobby() {
  stopAll(); ep = null;
  const c = courtroomState(S), cases = courtCases(S), docket = docketToday(S);
  const k = COURT_BY_ID[lobby.caseId];
  const preview = castEpisode(S, lobby, () => 0);  // lobby.standInSalt names the same neighbour the episode will use
  const adventure = escapadeView(S).active, forUs = adventure && !adventure.playDone && adventure.approach.activity === 'court';
  sheet.className = 'sheet sheet-court sc-lobby';
  sheet.innerHTML = head('Shelf Court', 'Daytime television · ' + c.episodes + ' episodes aired') +
    '<div class="sc-titlecard"><div class="sc-logo"><small>Live from the shelf</small><b>SHELF COURT</b><em>Real residents. Real disputes. Real dead.</em></div><div class="sc-titlecard-judge">' + castSvg('judge') + '</div></div>' +
    (forUs ? '<p class="sc-adventure"><b>' + esc(adventure.episode.title) + '</b> · An episode starring our resident moves our adventure on.</p>' : '') +
    docketLine(docket, k) +
    (courtSocial?.active() ? '<div data-sc-summons>' + summonsMarkup() + '</div>' : '') +
    '<section class="sc-tonight" aria-label="Tonight’s episode"><span class="sc-kicker">Tonight’s episode</span><h3>' + esc(k.title) + '</h3>' +
    '<div class="sc-vs"><figure><span class="sc-vs-art">' + portrait(preview.p) + '</span><figcaption><small>Plaintiff</small>' + esc(preview.p.name) + '</figcaption></figure><b>v.</b><figure><span class="sc-vs-art">' + portrait(preview.d) + '</span><figcaption><small>Defendant</small>' + esc(preview.d.name) + '</figcaption></figure></div>' +
    '<p class="sc-claim">' + esc(fill(preview, k.claim)) + '<br><small>Asking: ' + esc(fill(preview, k.asking)) + '</small></p>' +
    '<div class="sc-cast"><label>Plaintiff<select data-sc-cast="plaintiffId">' + S.pets.map(x => '<option value="' + esc(x.id) + '"' + (x.id === lobby.plaintiffId ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select></label>' +
    '<label>Defendant<select data-sc-cast="defendantId">' + (S.pets.length > 1 ? S.pets.filter(x => x.id !== lobby.plaintiffId).map(x => '<option value="' + esc(x.id) + '"' + (x.id === lobby.defendantId ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') : '<option value="">' + esc(preview.d.name) + ' (a neighbour)</option>') + '</select></label></div>' +
    '<div class="sc-actions"><button class="btn btn-primary sc-roll" type="button" data-sc="roll">Roll tape</button><button class="btn" type="button" data-sc="another">Different case</button>' + (S.pets.length > 1 ? '<button class="btn btn-ghost" type="button" data-sc="swap">Swap sides</button>' : '') + '</div></section>' +
    '<ol class="sc-rules"><li><b>Hear both sides,</b> then ask three of six questions.</li><li><b>Clues</b> go in your notes. <b>Zingers</b> play to the audience.</li><li>When chaos breaks out, <b>bang the gavel</b> (the jury likes order) or <b>let it play</b> (the ratings like chaos).</li><li><b>Rule</b> for the plaintiff, the defendant, or “you’re both idiots”. Rule against whoever was right and they will remember it.</li></ol>' +
    '<h3 class="sc-guide-title">Episode guide</h3><div class="sc-guide">' + cases.map(x => '<button type="button" class="sc-ep' + (x.id === lobby.caseId ? ' on' : '') + '" data-sc-case="' + x.id + '" aria-pressed="' + (x.id === lobby.caseId) + '"><span class="sc-ep-no">Ep. ' + x.number + '</span><b>' + esc(x.title) + '</b><span class="sc-ep-stars" aria-label="' + (x.aired ? x.stars + ' of 3 stars' : 'Unaired') + '">' + (x.aired ? stars(x.stars) : '<em>Unaired</em>') + '</span></button>').join('') + '</div>';
  open();
  $('.sc-roll')?.focus({ preventScroll: true });
}

/* ---------------- summonses from friends ---------------- */
function summonsMarkup() {
  if (!post.cases.length && !post.results.length && !post.note) return '';
  return '<section class="sc-summons" aria-labelledby="scSummonsTitle"><h3 id="scSummonsTitle">Summonses</h3>' +
    (post.note ? '<p class="sc-summons-note">' + esc(post.note) + '</p>' : '') +
    post.results.map(r => '<p class="sc-verdict">' + esc(verdictLine(r)) + '</p>').join('') + post.cases.map(summonsCase).join('') + '</section>';
}
function summonsCase(c) {
  const k = COURT_BY_ID[c.caseId], home = S.pets.find(p => p.id === c.defendant.id);
  const problem = !k ? ' This edition does not know that case yet.' : !home ? ' ' + c.defendant.name + ' no longer lives here.' : '';
  return '<div class="sc-summons-case"><p><b>' + esc(c.plaintiff.name) + '</b>, from ' + esc(c.fromName || 'a friend') + ', is suing <b>' + esc(home ? home.name : c.defendant.name) +
    '</b> over ' + esc(k ? k.title : 'a mystery') + '.' + (problem ? '<span class="sc-summons-problem">' + esc(problem) + '</span>' : '') + '</p><div class="sc-actions">' +
    (k && home ? '<button class="btn btn-primary btn-sm" type="button" data-sc-take="' + esc(c.id) + '">Take the case</button>' : '') +
    '<button class="btn btn-ghost btn-sm" type="button" data-sc-decline="' + esc(c.id) + '">Decline</button></div></div>';
}
function renderSummons() {
  const slot = !ep && sheet.querySelector('[data-sc-summons]');
  if (slot) slot.innerHTML = summonsMarkup();
}
// Never in the way: the lobby is already up, and the post arrives when it arrives.
async function fetchPost() {
  if (!courtSocial?.active()) return;
  const token = ++postToken;
  try {
    const box = await courtSocial.inbox();
    if (token !== postToken) return;
    post = { cases: box.cases, results: [...collectVerdicts(S, courtSocial, box.results), ...post.results.filter(r => !box.results.some(x => x.id === r.id))], note: '' };
    if (post.results.some(r => r.souls)) refresh();
  } catch (error) {
    if (token !== postToken) return;
    post = { ...post, note: error?.offline ? 'Offline. Any papers will keep.' : '' };
  }
  renderSummons();
}
function takeSummons(id) {
  const c = post.cases.find(x => x.id === id), home = c && S.pets.find(p => p.id === c.defendant.id), pet = c && guestPet(c.plaintiff);
  if (!c || !home || !pet || !COURT_BY_ID[c.caseId]) return;
  stopAll();
  hearing = { summons: c, pet };
  ep = castEpisode(S, { caseId: c.caseId, defendantId: home.id, guest: { side: 'p', pet } });
  if (ep) runEpisode(); else hearing = null;
}
async function declineSummons(id) {
  const c = post.cases.find(x => x.id === id);
  if (!c) return;
  try {
    await courtSocial.decline(id);
    post.cases = post.cases.filter(x => x.id !== id);
    post.note = 'Declined. ' + (c.fromName || 'Your friend') + ' is not told.';
  } catch (error) { post.note = error?.offline ? 'Offline. Try again once you are back online.' : 'That did not go through. The papers are still here.'; }
  renderSummons();
  sheet.querySelector('[data-sc-summons] button, .sc-roll')?.focus({ preventScroll: true });
}
// After the wrap: the verdict goes back to whoever served the papers.
async function deliverVerdict(h, res, ruling) {
  const line = () => sheet.querySelector('[data-sc-verdict]');
  const to = h.summons.fromName || 'your friend';
  try {
    await courtSocial.rule(h.summons.id, { verdict: ruling, stars: res.stars, ratings: res.ratings });
    const souls = summonsReward(S, h.summons.id, 'heard');
    post.cases = post.cases.filter(c => c.id !== h.summons.id);
    save(); refresh();
    if (line()) line().innerHTML = glyph('soul') + esc(souls ? '+' + souls + ' for hearing ' + to + '’s summons. The verdict is on its way.' : 'The verdict is on its way to ' + to + '. Summonses pay nothing more today.');
  } catch (error) {
    if (error?.code === 'not_open') post.cases = post.cases.filter(c => c.id !== h.summons.id);
    if (line()) line().textContent = error?.code === 'not_open' ? 'Someone had already heard this one.' : 'The verdict did not reach ' + to + '. The papers stay in the lobby.';
  }
}

/* ---------------- the studio ---------------- */
function seat(juror, i) {
  return '<span class="sc-seat" data-seat="' + i + '" title="' + esc(juror.name) + '"><span class="sc-seat-art">' + portrait(juror) + '</span><i class="sc-vote" aria-hidden="true"></i><i class="sc-zzz" aria-hidden="true">z<b>z</b><b>z</b></i></span>';
}
function studioMarkup() {
  const heads = Array.from({ length: HEADS }, (_, i) => '<span class="sc-head" style="--i:' + i + '">' + COURT_PROPS.galleryGhost + '</span>').join('');
  return '<div class="sc-stage" data-sc-stage data-speaker="">' +
    '<div class="sc-set"><span class="sc-curtain l"></span><span class="sc-curtain r"></span><span class="sc-beam l"></span><span class="sc-beam r"></span></div>' +
    '<span class="sc-applause">APPLAUSE</span><span class="sc-onair">ON AIR</span>' +
    '<span class="sc-bug"><b>SHELF COURT</b><i></i>LIVE</span>' +
    '<div class="sc-jury" data-actor="jury"><span class="sc-jury-label">Jury</span><div class="sc-seats">' + ep.jury.map(seat).join('') + '</div></div>' +
    '<div class="sc-actor sc-judge" data-actor="judge">' + castSvg('judge') + '</div>' +
    '<div class="sc-bench"><span>' + glyph('skull') + '</span></div>' +
    '<div class="sc-actor sc-bailiff" data-actor="bailiff">' + castSvg('rat') + '</div>' +
    '<div class="sc-actor sc-podium p" data-actor="p"><span class="sc-party">' + portrait(ep.p) + '</span><span class="sc-lectern"><small>Plaintiff</small><span>' + esc(ep.p.name) + '</span></span></div>' +
    '<div class="sc-actor sc-podium d" data-actor="d"><span class="sc-party">' + portrait(ep.d) + '</span><span class="sc-lectern"><small>Defendant</small><span>' + esc(ep.d.name) + '</span></span></div>' +
    '<div class="sc-actor sc-witness" data-actor="npc" hidden><span class="sc-witness-art"></span><span class="sc-witness-tag">Surprise witness</span></div>' +
    '<div class="sc-audience" data-actor="audience">' + heads + '</div>' +
    '<div class="sc-fx" data-sc-fx></div>' +
    '</div>';
}
function showStudio() {
  const k = episodeCase(ep);
  sheet.className = 'sheet sheet-court sc-show';
  sheet.innerHTML = head(k.title, ep.p.name + ' v. ' + ep.d.name) + studioMarkup() +
    '<div class="sc-chyron"><span class="sc-chyron-case"><b>' + esc(k.title.toUpperCase()) + '</b> ' + esc(fill(ep, k.claim)) + '</span>' +
    '<span class="sc-meters"><span class="sc-meter ratings"><small>Ratings</small><i><b data-sc-meter="ratings"></b></i></span><span class="sc-meter respect"><small>Jury</small><i><b data-sc-meter="respect"></b></i></span></span></div>' +
    '<div class="sc-box" data-sc-box role="button" tabindex="0" aria-label="Next line"><span class="sc-name" data-sc-name></span><p class="sc-text" data-sc-text aria-live="polite"></p><span class="sc-more" aria-hidden="true">▼</span></div>' +
    '<div class="sc-controls" data-sc-controls hidden></div>';
  meters();
  open();
}
function stage() { return $('[data-sc-stage]'); }
function fx() { return $('[data-sc-fx]'); }
function meters() {
  for (const key of ['ratings', 'respect']) {
    const bar = $('[data-sc-meter="' + key + '"]');
    if (bar) { bar.style.width = ep[key] + '%'; bar.parentElement.parentElement.setAttribute('aria-label', (key === 'ratings' ? 'Ratings ' : 'Jury respect ') + ep[key] + ' of 100'); }
  }
}

/* ---------------- lines ---------------- */
function play(list) {
  return new Promise(resolve => {
    queue = list.slice(); onDone = resolve;
    const controls = $('[data-sc-controls]');
    if (controls) controls.hidden = true;
    nextLine();
  });
}
function nextLine() {
  if (!queue.length) { const done = onDone; onDone = null; current = null; setSpeaker(''); done?.(); return; }
  speak(queue.shift());
}
function nameFor(line) {
  if (line.s === 'npc') return COURT_CAST[line.who]?.name || 'A witness';
  if (line.s === 'p') return ep.p.name + ', plaintiff';
  if (line.s === 'd') return ep.d.name + ', defendant';
  return ({ judge: 'Judge Mortis (you)', bailiff: 'Bailiff Rattigan', announcer: 'Announcer', audience: 'Studio audience', jury: 'The jury' })[line.s] || '';
}
function setSpeaker(who) {
  const st = stage(); if (!st) return;
  st.dataset.speaker = who;
  st.querySelectorAll('.talking').forEach(el => el.classList.remove('talking'));
  st.classList.toggle('sc-applauding', who === 'audience');
}
function showWitness(who) {
  const spot = $('.sc-witness'); if (!spot) return;
  if (!who) { spot.hidden = true; spot.dataset.who = ''; return; }
  if (spot.dataset.who === who && !spot.hidden) return;
  spot.dataset.who = who;
  spot.querySelector('.sc-witness-art').innerHTML = castSvg(COURT_CAST[who].art);
  spot.hidden = false;
  spot.classList.remove('enter'); void spot.offsetWidth; spot.classList.add('enter');
  playTone(660, { duration: 0.1, type: 'square', gain: 0.05 });
}
function speak(line) {
  clearInterval(typer);
  current = line;
  const box = $('[data-sc-box]'), text = $('[data-sc-text]'), name = $('[data-sc-name]');
  if (!box) return;
  box.className = 'sc-box sc-say-' + line.s;
  name.textContent = nameFor(line);
  name.hidden = !name.textContent;
  if (line.s === 'npc') showWitness(line.who);
  setSpeaker(line.s);
  cue(line);
  $('[data-actor="' + line.s + '"]')?.classList.add('talking');
  let typed = 0;
  text.textContent = '';
  const full = line.t;
  const voice = line.s === 'npc' ? NPC_VOICES[line.who] || 400 : VOICES[line.s];
  typer = setInterval(() => {
    typed = Math.min(full.length, typed + 1);
    text.textContent = full.slice(0, typed);
    if (voice && typed % 3 === 1 && /\w/.test(full[typed - 1])) playTone(voice * (0.94 + Math.random() * 0.12), { duration: 0.045, type: 'square', gain: 0.022 });
    if (typed >= full.length) finishTyping();
  }, TYPE_MS);
}
function finishTyping() {
  clearInterval(typer); typer = 0;
  if (!current) return;
  $('[data-sc-text]').textContent = current.t;
  sheet.querySelectorAll('.talking').forEach(el => el.classList.remove('talking'));
  $('[data-sc-box]')?.classList.add('ready');
}
function advance() {
  if (!current) return;
  if (typer) { finishTyping(); return; }
  nextLine();
}
// Show a set of buttons and wait for one.
function choose(html) {
  return new Promise(resolve => {
    const controls = $('[data-sc-controls]');
    controls.innerHTML = html;
    controls.hidden = false;
    onChoice = value => { onChoice = null; controls.hidden = true; resolve(value); };
    controls.querySelector('button:not([disabled])')?.focus({ preventScroll: true });
    // On short phones the choices land below the fold; bring them up.
    controls.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
  });
}

/* ---------------- effects ---------------- */
function layer(cls, html, ms) {
  const host = fx(); if (!host) return null;
  const el = document.createElement('div');
  el.className = cls; el.innerHTML = html;
  host.appendChild(el);
  if (ms) later(() => el.remove(), ms);
  return el;
}
function bubble(word, cls = '') { layer('sc-bubble ' + cls, '<span class="sc-burst"></span><b>' + esc(word) + '</b>', 1000); }
function shake(big = false) {
  const st = stage(); if (!st || reduced()) return;
  st.classList.remove('sc-shake', 'sc-shake-big'); void st.offsetWidth;
  st.classList.add(big ? 'sc-shake-big' : 'sc-shake');
  later(() => st?.classList.remove('sc-shake', 'sc-shake-big'), 500);
}
function gavel(word = 'ORDER!') {
  const judge = $('.sc-judge'); if (!judge) return;
  judge.classList.remove('banging', 'jm-nogavel'); void judge.offsetWidth; judge.classList.add('banging');
  // 240ms is when the gavel head meets the block in css/court.css (jm-swing).
  later(() => { playStomp(); shake(); bubble(word, 'sc-bang'); react('bailiff', 'rb-jumped', 650); }, 240);
  later(() => judge?.classList.remove('banging'), 900);
}

/* ---------------- the judge and the bailiff ----------------
   Both puppets react through classes on their actor that css/court.css
   animates. One-shots clear themselves; a newer copy of the same reaction
   restarts it rather than being cut short by the old timer. */
const reactTimers = {};
function react(actor, cls, ms) {
  const el = $('.sc-' + actor); if (!el) return;
  clearTimeout(reactTimers[cls]); timers.delete(reactTimers[cls]);
  el.classList.remove(cls); void el.getBoundingClientRect(); el.classList.add(cls);
  reactTimers[cls] = later(() => el.classList.remove(cls), ms);
}
const JUDGE_MOODS = { surprise: 1250, irked: 2600, sigh: 1850 };
const judgeMood = mood => react('judge', 'jm-' + mood, JUDGE_MOODS[mood]);
// How the bench takes each scene.
const JUDGE_TAKES = { outburst: 'surprise', throw: 'surprise', jaw: 'surprise', moth: 'surprise', sleep: 'irked', heckle: 'irked', eat: 'irked', cat: 'irked', faint: 'sigh', applause: 'sigh' };
const busyEffects = () => reduced() || document.body.dataset.effects === 'light';
// When the bench speaks to the bailiff he salutes, and a question makes him
// sweat until somebody else takes the floor. Shouting irritates the judge.
function cue(line) {
  const bailiff = $('.sc-bailiff');
  if (line.s === 'judge' && /\bbailiff\b/i.test(line.t)) {
    react('bailiff', 'rb-salute', 1500);
    if (line.t.includes('?')) bailiff?.classList.add('rb-caught');
  } else if (line.s !== 'bailiff') bailiff?.classList.remove('rb-caught');
  if (line.s === 'judge' && (line.t.match(/\b[A-Z]{3,}\b/g) || []).length >= 2) judgeMood('irked');
}
// Business between lines: every so often the wig slides and gets shoved back.
// Full effects only.
function idle(tok) {
  later(() => {
    if (tok !== session || !stage()) return;
    if (!busyEffects() && !$('.sc-judge.banging')) react('judge', 'jm-slip', 2700);
    idle(tok);
  }, 9000 + Math.random() * 9000);
}
function sting() {
  [392, 523.3, 659.3, 784].forEach((f, i) => later(() => playTone(f, { duration: 0.22, type: 'triangle', gain: 0.07 }), i * 130));
}
function tvStatic(ms = 700) { layer('sc-static', '', ms); playTone(90, { duration: 0.25, type: 'sawtooth', gain: 0.03 }); }
function applause(ms = 1800) {
  const st = stage(); if (!st) return;
  st.classList.add('sc-cheer', 'sc-applauding');
  playStar();
  later(() => st?.classList.remove('sc-cheer', 'sc-applauding'), ms);
}
function podium(side) { return $('.sc-podium.' + side); }
function happeningStart(h) {
  const st = stage(); if (!st) return;
  const heads = st.querySelectorAll('.sc-head');
  if (JUDGE_TAKES[h.anim]) later(() => judgeMood(JUDGE_TAKES[h.anim]), h.anim === 'throw' ? 650 : h.anim === 'cat' ? 2000 : 0);
  switch (h.anim) {
    case 'outburst': podium(h.x)?.classList.add('sc-rant'); shake(true); playTone(150, { duration: 0.3, type: 'sawtooth', gain: 0.06 }); break;
    case 'sleep': $('.sc-seat[data-seat="' + ep.jury.indexOf(h.juror) + '"]')?.classList.add('asleep'); break;
    case 'throw':
      layer('sc-thrown', glyph('tooth'), 1300);
      later(() => { podium('p')?.classList.add('sc-hit'); shake(); later(() => podium('p')?.classList.remove('sc-hit'), 500); }, 650);
      break;
    case 'heckle': heads[5]?.classList.add('standing'); break;
    case 'faint': heads[2]?.classList.add('fainted'); heads[6]?.classList.add('fainted'); break;
    case 'dark': st.classList.add('sc-dark'); playTone(70, { duration: 0.4, type: 'sawtooth', gain: 0.05 }); break;
    case 'cat': layer('sc-walker cat', castSvg('cat'), 3400); later(() => $('.sc-judge')?.classList.add('jm-nogavel'), 1800); break;
    case 'applause': applause(3200); break;
    case 'eat': $('.sc-bailiff')?.classList.add('chomping', 'rb-caught'); break;
    case 'jaw': layer('sc-jaw', COURT_PROPS.bone, 2200); break;
    case 'moth': layer('sc-walker moth', castSvg('moth'), 2600); break;
  }
}
function happeningEnd(h, choice) {
  const st = stage(); if (!st) return;
  podium('p')?.classList.remove('sc-rant'); podium('d')?.classList.remove('sc-rant');
  st.classList.remove('sc-dark');
  $('.sc-bailiff')?.classList.remove('chomping', 'rb-caught');
  $('.sc-judge')?.classList.remove('jm-nogavel');
  st.querySelectorAll('.sc-head.standing').forEach(el => el.classList.remove('standing'));
  if (h.anim === 'sleep' && choice === 'gavel') st.querySelectorAll('.sc-seat.asleep').forEach(el => el.classList.remove('asleep'));
}

/* ---------------- the episode ---------------- */
async function runEpisode() {
  const tok = session;
  const alive = () => tok === session && !!ep;
  showStudio();
  idle(tok);
  tvStatic(); sting();
  await wait(700); if (!alive()) return;
  applause(1600);
  await play(episodeOpening(ep)); if (!alive()) return;
  for (let round = 0; round < QUESTIONS_PER_EPISODE; round++) {
    if (round === 2 && !ep.hadBreak) {
      await commercial(); if (!alive()) return;
      await runHappening(randomHappening(ep)); if (!alive()) return;
    }
    const index = await chooseQuestion(round); if (!alive()) return;
    showWitness('');
    const r = episodeAsk(ep, index);
    await play(r.lines); if (!alive()) return;
    if (r.clue) { noteClue(r.clue); await wait(900); if (!alive()) return; }
    meters();
    if (r.happening) await runHappening(r.happening);
    else if (round === 0 && Math.random() < 0.45) await runHappening(randomHappening(ep));
    if (!alive()) return;
  }
  showWitness('');
  const ruling = await chooseRuling(); if (!alive()) return;
  const result = episodeRule(ep, ruling);
  gavel(ruling === 'both' ? 'BOTH IDIOTS!' : 'JUDGMENT!');
  if (ruling === 'both') later(() => judgeMood('sigh'), 950);
  await wait(700); if (!alive()) return;
  await play(result.ruling); if (!alive()) return;
  await juryVote(result); if (!alive()) return;
  if (result.agree * 2 < ep.jury.length) judgeMood('irked');
  await play(result.jury); if (!alive()) return;
  meters();
  if (ep.ratings >= 50) applause(2200);
  await play([result.audience]); if (!alive()) return;
  tvStatic(500);
  stage()?.classList.add('sc-hallway');
  await wait(450); if (!alive()) return;
  await play(result.hallway); if (!alive()) return;
  finish();
}
async function runHappening(h) {
  if (!h || !ep) return;
  const tok = session;
  happeningStart(h);
  await play(h.lines); if (tok !== session) return;
  let choice = null;
  if (h.choice) {
    choice = await choose('<p class="sc-prompt">It is kicking off. Your call, Your Honour.</p><div class="sc-choice-row"><button class="btn sc-gavel-btn" type="button" data-sc-choice="gavel">Bang the gavel<small>The jury likes order</small></button><button class="btn sc-let-btn" type="button" data-sc-choice="let">Let it play<small>The ratings like chaos</small></button></div>');
    if (tok !== session) return;
    if (choice === 'gavel') gavel(); else applause(1400);
    await wait(choice === 'gavel' ? 600 : 300); if (tok !== session) return;
    await play(resolveHappening(ep, h, choice)); if (tok !== session) return;
  }
  happeningEnd(h, choice);
  meters();
}
function notesMarkup() {
  return '<details class="sc-notes"><summary>Case notes · ' + ep.clues.length + '</summary>' + (ep.clues.length ? '<ul>' + ep.clues.map(c => '<li>' + esc(c) + '</li>').join('') + '</ul>' : '<p>Nothing yet. Ask better questions.</p>') + '</details>';
}
function chooseQuestion(round) {
  const list = episodeQuestions(ep).filter(q => !q.asked);
  return choose('<div class="sc-q-head"><b>Question ' + (round + 1) + ' of ' + QUESTIONS_PER_EPISODE + '</b>' + notesMarkup() + '</div>' +
    '<div class="sc-questions">' + list.map(q => '<button type="button" class="sc-q' + (q.sass ? ' sass' : '') + '" data-sc-choice="' + q.index + '">' + (q.sass ? '<i>Zinger</i>' : '') + esc(q.text) + '</button>').join('') + '</div>').then(Number);
}
function noteClue(text) {
  layer('sc-clue', '<small>Noted</small>' + esc(text), 2400);
  playUnlock();
}
function chooseRuling() {
  return choose('<div class="sc-deliberate"><h3>Your ruling, Your Honour</h3>' +
    (ep.clues.length ? '<ul class="sc-clues">' + ep.clues.map(c => '<li>' + esc(c) + '</li>').join('') + '</ul>' : '<p class="sc-noclues">You have no clues. Rule with your gut. You have no gut.</p>') +
    '<div class="sc-rulings"><button class="btn sc-rule p" type="button" data-sc-choice="plaintiff">For ' + esc(ep.p.name) + '<small>The plaintiff is right</small></button>' +
    '<button class="btn sc-rule d" type="button" data-sc-choice="defendant">For ' + esc(ep.d.name) + '<small>The defendant is right</small></button>' +
    '<button class="btn sc-rule both" type="button" data-sc-choice="both">You’re both idiots<small>Nobody is right</small></button></div></div>');
}
async function commercial() {
  const tok = session;
  const br = episodeBreak(ep);
  await play([br.into]); if (tok !== session) return;
  tvStatic(600);
  await wait(300); if (tok !== session) return;
  const ad = layer('sc-ad', '<span class="sc-ad-tag">Advertisement</span><b>' + esc(br.ad.brand) + '</b>', 0);
  [523.3, 659.3, 784, 1046.5].forEach((f, i) => later(() => playTone(f, { duration: 0.14, type: 'square', gain: 0.04 }), i * 110));
  await play(br.ad.lines.map(t => ({ s: 'announcer', t }))); if (tok !== session) return;
  ad?.remove();
  tvStatic(500);
  await play([br.back]);
}
async function juryVote(result) {
  const tok = session;
  const seats = [...sheet.querySelectorAll('.sc-seat')];
  for (let i = 0; i < seats.length; i++) {
    seats[i].classList.remove('asleep');
    seats[i].classList.add(result.votes[i] ? 'agree' : 'disagree');
    seats[i].querySelector('.sc-vote').textContent = result.votes[i] ? '👍' : '👎';
    playTone(result.votes[i] ? 660 : 180, { duration: 0.1, type: 'square', gain: 0.05 });
    await wait(260); if (tok !== session) return;
  }
}

/* ---------------- wrap ---------------- */
function finish() {
  const res = courtFinish(S, ep, Date.now()), heard = ep.guest ? hearing : null;
  save();
  const k = episodeCase(ep);
  const truth = res.truth === 'plaintiff' ? ep.p.name + ' was right.' : res.truth === 'defendant' ? ep.d.name + ' was right.' : 'They were both idiots.';
  const controls = $('[data-sc-controls]');
  controls.hidden = false;
  controls.innerHTML = '<div class="sc-wrap ' + (res.correct ? 'right' : 'wrong') + '"><span class="sc-kicker">That’s a wrap</span>' +
    '<div class="sc-wrap-stars" aria-label="' + res.stars + ' of 3 stars">' + stars(res.stars) + '</div>' +
    '<h3>' + (res.correct ? 'Justice, allegedly, was served' : 'You got it wrong, live on air') + '</h3>' +
    '<p>' + esc(truth) + ' Ratings ' + res.ratings + '. The jury agreed ' + res.agree + ' to ' + (ep.jury.length - res.agree) + '.</p>' +
    '<ul class="mh-rewards">' + (res.souls ? '<li class="souls">' + glyph('soul') + '+' + res.souls + ' souls</li>' : '<li>Today’s game purse is empty. You did it for the art.</li>') +
    (res.docket ? '<li class="souls">' + glyph('soul') + '+' + res.docket.bonus + ' for today’s docket' + (res.docket.streak > 1 ? ' · ' + res.docket.streak + ' days in session' : '') + '</li>' : '') +
    (res.trust ? '<li class="good">' + esc(res.trust) + ' trusts you a little more</li>' : '') +
    (res.grudge ? '<li class="bad">' + esc(res.grudge) + ' will remember this</li>' : '') +
    (res.firstAir ? '<li>Episode ' + (courtCases(S).findIndex(c => c.id === k.id) + 1) + ' aired · ' + res.aired + ' of ' + res.total + '</li>' : '') +
    (heard ? '<li class="souls" data-sc-verdict>Sending the verdict to ' + esc(heard.summons.fromName || 'your friend') + '.</li>' : '') + '</ul>' +
    (escapadeView(S).active?.ready ? '<div class="sc-actions"><button class="btn btn-primary" type="button" data-escapade="open">Our story’s ending ↗</button></div>' : '') +
    '<div class="sc-actions"><button class="btn btn-primary sc-next" type="button" data-sc="next" disabled>Next episode</button><button class="btn" type="button" data-sc="lobby">Episode guide</button><button class="btn btn-ghost" type="button" data-sc="close">Back to the shelf</button></div></div>';
  (res.stars >= 3 ? playAchievement : res.correct ? playStar : playError)();
  if (heard) deliverVerdict(heard, res, ep.ruling);
  const next = controls.querySelector('.sc-next');
  later(() => { if (next?.isConnected) { next.disabled = false; next.focus({ preventScroll: true }); } }, 650);
  refresh();
}

/* ---------------- wiring ---------------- */
function open() { if (!veil.classList.contains('open')) veil.classList.add('open'); }
function close() { stopAll(); ep = null; hearing = null; veil.classList.remove('open'); refresh(); }
function roll() {
  stopAll();
  hearing = null;
  ep = castEpisode(S, lobby);
  if (ep) runEpisode();
}

export function openCourt(residentId, caseId) {
  if (!S || !S.pets.length || document.querySelector('.veil.open:not(#courtVeil)')) return;
  if (caseId && COURT_BY_ID[caseId]) lobby.caseId = caseId;
  defaultLobby(residentId);
  showLobby();
  fetchPost();
}

export function initCourt(state, onRefresh, { social } = {}) {
  S = state; refresh = onRefresh || refresh; courtSocial = social || null;
  window.addEventListener('shelflife:court', e => openCourt(e.detail?.petId, e.detail?.caseId));
  sheet.addEventListener('change', e => {
    const key = e.target.dataset?.scCast;
    if (!key) return;
    lobby[key] = e.target.value;
    if (key === 'plaintiffId' && lobby.defendantId === lobby.plaintiffId) lobby.defendantId = '';
    defaultLobby(lobby.plaintiffId);
    showLobby();
  });
  sheet.addEventListener('click', e => {
    const take = e.target.closest('[data-sc-take]');
    if (take) { takeSummons(take.dataset.scTake); return; }
    const decline = e.target.closest('[data-sc-decline]');
    if (decline) { declineSummons(decline.dataset.scDecline); return; }
    const pickCase = e.target.closest('[data-sc-case]');
    if (pickCase) { lobby.caseId = pickCase.dataset.scCase; showLobby(); return; }
    const choice = e.target.closest('[data-sc-choice]');
    if (choice) { if (!choice.disabled) onChoice?.(choice.dataset.scChoice); return; }
    const action = e.target.closest('[data-sc]');
    if (!action) { if (e.target.closest('[data-sc-box],[data-sc-stage]')) advance(); return; }
    const act = action.dataset.sc;
    if (act === 'close') close();
    else if (act === 'roll') roll();
    else if (act === 'another') { lobby.caseId = nextCaseId(S, Math.random, lobby.caseId); showLobby(); }
    else if (act === 'swap') { [lobby.plaintiffId, lobby.defendantId] = [lobby.defendantId, lobby.plaintiffId]; showLobby(); }
    else if (act === 'lobby') { lobby.caseId = nextCaseId(S, Math.random, ep?.caseId); showLobby(); }
    else if (act === 'next') { lobby.caseId = nextCaseId(S, Math.random, ep?.caseId); defaultLobby(lobby.plaintiffId); roll(); }
  });
  document.addEventListener('keydown', e => {
    if (!veil.classList.contains('open') || !ep || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target.closest?.('button,select,input,summary')) return;
    if ((e.key === 'Enter' || e.key === ' ') && current) { e.preventDefault(); advance(); }
  });
  veil.addEventListener('click', e => { if (e.target === veil) close(); });
}

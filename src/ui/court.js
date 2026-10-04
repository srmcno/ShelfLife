import { COURT_CAST, QUESTIONS_PER_EPISODE } from '../content/court.js';
import {
  courtCases, nextCaseId, castEpisode, episodeCase, episodeOpening, episodeReceipts, episodeQuestions, episodeAsk,
  randomHappening, resolveHappening, episodeBreak, episodeRule, courtFinish, fill, COURT_BY_ID, docketToday, DOCKET_SOULS, summonsReward,
  rotateCast, payOwedSummons, slotVerdict
} from '../engine/court.js';
import { versionView, versionTotals, BASE } from '../engine/court-twists.js';
import { castBriefing, seatTags, describeCast } from '../engine/court-traits.js';
import { objectionOptions, checkNote, pressWitness } from '../engine/court-objection.js';
import { careerView } from '../engine/court-career.js';
import { courtroomState } from '../court-state.js';
import { save } from '../state.js';
import { renderPetSprite } from '../art/sprite.js';
import { castSvg, COURT_PROPS } from '../art/court-cast.js';
import { dressClasses, benchDressing, stageDressing, GALLERY_REGULARS, LAUREL, ROLE_ICONS } from '../art/court-dress.js';
import { HALL_SET, HALL_PROPS } from '../art/court-hallway.js';
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
const VOICES = { judge: 110, bailiff: 640, announcer: 180, reporter: 540, p: 470, d: 380, audience: 220, jury: 300 };
const NPC_VOICES = { woodlouse: 440, geoffrey2: 470, moth: 560, lamp: 250, cat: 180, ghost: 330, uncle: 150, raven: 240, widow: 380, susan: 600 };
const TYPE_MS = 20;
const HEADS = 9;
const REGULAR_SEATS = [1, 6];   // which gallery heads the bench career's regulars take

let S = null, refresh = () => {};
// `twist` is the version asked for in the lobby: '' to be surprised, 'base' for the original, or a twist id.
let lobby = { caseId: '', plaintiffId: '', defendantId: '', standInSalt: Math.floor(Math.random() * 1000), twist: '' };
let ep = null, session = 0, backpay = '';
// Summonses from friends (only when the social layer is on): what is in the
// post, and the one being heard right now.
let courtSocial = null, post = { cases: [], results: [], note: '' }, postToken = 0, postUser = null, hearing = null;
let queue = [], onDone = null, current = null, typer = 0, onChoice = null;
// A replay can skip the rest of the opening, or the hallway interview. `keep` stops the skip at the twist's hint.
let skipMode = null, spoken = 0;
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
  queue = []; onDone = null; current = null; onChoice = null; skipMode = null; spoken = 0;
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
const plural = (n, one, many = one + 's') => n + ' ' + (n === 1 ? one : many);
const lowerFirst = text => text ? text[0].toLowerCase() + text.slice(1) : '';

/* ---------------- the lobby ---------------- */
// Today's docket airs one fixed version, the same for everyone, until it is filed.
const docketLocked = caseId => { const d = docketToday(S); return !d.done && d.caseId === caseId; };
function docketLine(docket, k) {
  const today = COURT_BY_ID[docket.caseId];
  if (!today) return '';
  if (docket.done) return '<p class="sc-docket done"><b>Today’s docket is filed.</b> ' + (docket.streak > 1 ? docket.streak + ' days in session.' : 'Back tomorrow for another.') + '</p>';
  const fixed = versionView(courtroomState(S), today.id).of > 1;
  return '<p class="sc-docket"><b>Today’s docket: ' + esc(today.title) + '.</b> +' + DOCKET_SOULS + ' souls for airing it' + (docket.streak ? ' · ' + docket.streak + ' day' + (docket.streak === 1 ? '' : 's') + ' in session' : '') +
    (fixed ? ' · the same version for everyone today' : '') +
    (k.id === today.id ? '' : ' <button class="btn btn-ghost btn-sm" type="button" data-sc-case="' + today.id + '">Hear it</button>') + '</p>';
}
function defaultLobby(petId, rotate = false) {
  const pets = S.pets;
  const turn = rotate ? rotateCast(S, Math.random, { plaintiffId: petId || '' }) : null;
  const p = pets.find(x => x.id === (turn ? turn.plaintiffId : petId)) || pets.find(x => x.id === lobby.plaintiffId) || pets[0];
  const others = pets.filter(x => x.id !== p.id);
  const d = (turn && others.find(x => x.id === turn.defendantId)) || others.find(x => x.id === lobby.defendantId) || others[Math.floor(Math.random() * others.length)] || null;
  // The first time the lobby opens each day it offers the docket case, unless it is already aired.
  const docket = docketToday(S);
  const first = COURT_BY_ID[lobby.caseId] ? lobby.caseId : !docket.done && COURT_BY_ID[docket.caseId] ? docket.caseId : nextCaseId(S);
  lobby = { caseId: first, plaintiffId: p.id, defendantId: d?.id || '', standInSalt: lobby.standInSalt, twist: first === lobby.caseId ? lobby.twist : '' };
}
const tagChips = tags => tags.length ? '<span class="sc-tags">' + tags.map(t => '<span class="sc-chip ' + t.role + '" title="' + esc(t.text) + '">' + esc(t.tag) + '</span>').join('') + '</span>' : '';
function careerPanel() {
  const v = careerView(courtroomState(S)), pct = Math.round(v.progress * 100);
  return '<section class="sc-career" aria-label="Your career on the bench"><div class="sc-career-top"><span class="sc-kicker">On the bench</span><b>' + esc(v.name) + '</b><small>' + plural(v.stars, 'star') + '</small></div>' +
    '<div class="sc-bar" role="progressbar" aria-label="Progress to the next rank" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><i style="width:' + pct + '%"></i></div>' +
    '<p>' + (v.max ? 'Top of the bench. There is nothing above you but the ceiling.' :
      plural(v.toNext, 'star') + ' to <b>' + esc(v.next.name) + '</b> (+' + v.next.souls + ' souls)' + (v.next.unlock ? '. Unlocks the ' + esc(lowerFirst(v.next.unlock.name)) : '') + '.') + '</p></section>';
}
function versionMarkup(k) {
  const v = versionView(courtroomState(S), k.id);
  if (v.of <= 1) return '';
  const locked = docketLocked(k.id);
  const dots = v.versions.map(x => '<i class="' + (x.seen ? 'on' : '') + '"></i>').join('');
  return '<div class="sc-versions"><span class="sc-ver-count" role="img" aria-label="' + v.seen + ' of ' + v.of + ' versions seen">' + dots + '</span><span>Versions seen: <b>' + v.seen + ' of ' + v.of + '</b>' +
    (locked ? '. Today’s docket is a fixed version.' : v.seen === v.of ? '. You have seen them all.' : '. Read the notes again: the truth may have moved.') + '</span></div>';
}
// A version already seen can be asked for by name; everything else is a surprise.
function versionPicker(k) {
  const view = versionView(courtroomState(S), k.id), picks = view.versions.filter(x => x.seen);
  if (view.of <= 1 || docketLocked(k.id) || !picks.length) return '';
  return '<label class="sc-ver-pick">Version<select data-sc-version><option value=""' + (lobby.twist ? '' : ' selected') + '>Surprise me</option>' +
    picks.map(x => '<option value="' + esc(x.key) + '"' + (lobby.twist === x.key ? ' selected' : '') + '>' + esc(x.title) + '</option>').join('') + '</select></label>';
}
function whyMarkup(preview) {
  const lines = castBriefing(preview, 3);
  return '<div class="sc-why"><span class="sc-kicker">Why this cast matters</span>' + (lines.length ? '<ul>' + lines.map(l => '<li>' + esc(l) + '</li>').join('') + '</ul>' :
    '<p>This cast plays it straight. Residents who are Theatrical, Terminally Dramatic or Cult Adjacent change the maths, and so do bonds and old quarrels.</p>') + '</div>';
}
function showLobby() {
  stopAll(); ep = null;
  const c = courtroomState(S), cases = courtCases(S), docket = docketToday(S);
  const k = COURT_BY_ID[lobby.caseId];
  const preview = castEpisode(S, { ...lobby, twist: undefined }, () => 0);  // lobby.standInSalt names the same neighbour the episode will use
  const adventure = escapadeView(S).active, forUs = adventure && !adventure.playDone && adventure.approach.activity === 'court';
  const totals = versionTotals(c, cases.map(x => x.id));
  sheet.className = 'sheet sheet-court sc-lobby';
  sheet.innerHTML = head('Shelf Court', 'Daytime television · ' + c.episodes + ' episodes aired') +
    '<div class="sc-titlecard"><div class="sc-logo"><small>Live from the shelf</small><b>SHELF COURT</b><em>Real residents. Real disputes. Real dead.</em></div><div class="sc-titlecard-judge ' + dressClasses(careerView(c).dress) + '">' + castSvg('judge') + '</div></div>' +
    (forUs ? '<p class="sc-adventure"><b>' + esc(adventure.episode.title) + '</b> · An episode starring our resident moves our adventure on.</p>' : '') +
    (backpay ? '<p class="sc-backpay">' + glyph('soul') + esc(backpay) + '</p>' : '') +
    docketLine(docket, k) +
    (courtSocial?.active() ? '<div data-sc-summons>' + summonsMarkup() + '</div>' : '') +
    careerPanel() +
    '<section class="sc-tonight" aria-label="Tonight’s episode"><span class="sc-kicker">Tonight’s episode</span><h3>' + esc(k.title) + '</h3>' +
    '<div class="sc-vs"><figure><span class="sc-vs-art">' + portrait(preview.p) + '</span><figcaption><small>Plaintiff</small>' + esc(preview.p.name) + tagChips(seatTags(preview, 'p')) + '</figcaption></figure><b>v.</b><figure><span class="sc-vs-art">' + portrait(preview.d) + '</span><figcaption><small>Defendant</small>' + esc(preview.d.name) + tagChips(seatTags(preview, 'd')) + '</figcaption></figure></div>' +
    '<p class="sc-claim">' + esc(fill(preview, k.claim)) + '<br><small>Asking: ' + esc(fill(preview, k.asking)) + '</small></p>' +
    versionMarkup(k) +
    '<div class="sc-cast"><label>Plaintiff<select data-sc-cast="plaintiffId">' + S.pets.map(x => '<option value="' + esc(x.id) + '"' + (x.id === lobby.plaintiffId ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select></label>' +
    '<label>Defendant<select data-sc-cast="defendantId">' + (S.pets.length > 1 ? S.pets.filter(x => x.id !== lobby.plaintiffId).map(x => '<option value="' + esc(x.id) + '"' + (x.id === lobby.defendantId ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') : '<option value="">' + esc(preview.d.name) + ' (a neighbour)</option>') + '</select></label>' + versionPicker(k) + '</div>' +
    whyMarkup(preview) +
    '<div class="sc-actions"><button class="btn btn-primary sc-roll" type="button" data-sc="roll">Roll tape</button><button class="btn" type="button" data-sc="another">Different case</button>' + (S.pets.length > 1 ? '<button class="btn btn-ghost" type="button" data-sc="swap">Swap sides</button>' : '') + '</div></section>' +
    '<ol class="sc-rules"><li><b>Hear both sides,</b> then ask three of six questions.</li><li><b>Clues</b> go in your notes. <b>Zingers</b> play to the audience. A note marked <b>unconfirmed</b> earns the jury’s respect only once you have checked it.</li>' +
    '<li><b>Objection,</b> once an episode: check an unconfirmed note, or press the last witness for another clue.</li>' +
    '<li>When chaos breaks out, <b>bang the gavel</b> (the jury likes order) or <b>let it play</b> (the ratings like chaos).</li><li><b>Rule</b> for the plaintiff, the defendant, or “you’re both idiots”. Rule against whoever was right and they will remember it.</li></ol>' +
    '<div class="sc-guide-head"><h3 class="sc-guide-title">Episode guide</h3><button class="btn btn-ghost btn-sm" type="button" data-sc="notebook">Case Notebook</button></div>' +
    (totals.twists ? '<p class="sc-guide-note">Versions seen: <b>' + totals.seen + ' of ' + totals.of + '</b>. Some cases have more than one truth.</p>' : '') +
    '<div class="sc-guide">' + cases.map(x => '<button type="button" class="sc-ep' + (x.id === lobby.caseId ? ' on' : '') + '" data-sc-case="' + x.id + '" aria-pressed="' + (x.id === lobby.caseId) + '"><span class="sc-ep-no">Ep. ' + x.number + '</span><b>' + esc(x.title) + '</b><span class="sc-ep-stars" aria-label="' + (x.aired ? x.stars + ' of 3 stars' : 'Unaired') + '">' + (x.aired ? stars(x.stars) : '<em>Unaired</em>') + '</span>' +
      (x.versions.of > 1 ? '<span class="sc-ep-ver" aria-label="' + x.versions.seen + ' of ' + x.versions.of + ' versions seen">Version ' + x.versions.seen + ' of ' + x.versions.of + '</span>' : '') + '</button>').join('') + '</div>';
  open();
  $('.sc-roll')?.focus({ preventScroll: true });
  dressJudge($('.sc-titlecard-judge'), careerView(c).dress);
}

/* ---------------- the Case Notebook ---------------- */
function showNotebook() {
  stopAll(); ep = null;
  const c = courtroomState(S), cases = courtCases(S), totals = versionTotals(c, cases.map(x => x.id));
  sheet.className = 'sheet sheet-court sc-notebook';
  sheet.innerHTML = head('Case Notebook', totals.seen + ' of ' + totals.of + ' versions seen') +
    '<p class="sc-nb-intro">Every case you have aired, and every version of it you have sat through. ' + (totals.twists ? 'A version you have not seen stays a blank, so nothing is spoiled. ' : '') + 'Three stars on a version is yours to keep.</p>' +
    '<div class="sc-nb">' + cases.map(x => {
      const v = x.versions;
      return '<article class="sc-nb-case' + (x.aired ? '' : ' unaired') + '"><header><span class="sc-ep-no">Ep. ' + x.number + '</span><b>' + esc(x.title) + '</b><span class="sc-ep-stars" aria-label="' + (x.aired ? 'Best ' + x.stars + ' of 3 stars' : 'Unaired') + '">' + (x.aired ? stars(x.stars) : '<em>Unaired</em>') + '</span></header>' +
        (v.of === 1 && !x.aired ? '' : '<ul class="sc-nb-versions">') + v.versions.filter(y => v.of > 1 || x.aired).map(y => y.seen
          ? '<li class="seen"><span class="sc-nb-name">' + esc(y.title) + '</span><span class="sc-ep-stars" aria-label="' + y.stars + ' of 3 stars">' + stars(y.stars) + '</span><button class="btn btn-ghost btn-sm" type="button" data-sc-replay="' + x.id + '|' + esc(y.key) + '">Re-air<span class="sr-only"> ' + esc(y.title) + ' of ' + esc(x.title) + '</span></button></li>'
          : '<li class="unseen"><span class="sc-nb-name">Version ' + y.number + ': not yet seen</span></li>').join('') + (v.of === 1 && !x.aired ? '' : '</ul>') + '</article>';
    }).join('') + '</div>' +
    '<div class="sc-actions"><button class="btn btn-primary" type="button" data-sc="lobby-back">Back to the lobby</button></div>';
  open();
  $('.sc-actions .btn')?.focus({ preventScroll: true });
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
  const homeName = home ? home.name : c.defendant.name, title = k ? k.title : 'a mystery';
  // The sender chose which side their resident takes: suing (the usual) or being sued.
  const sentence = c.side === 'd'
    ? '<b>' + esc(homeName) + '</b> is suing <b>' + esc(c.plaintiff.name) + '</b>, from ' + esc(c.fromName || 'a friend') + ', over ' + esc(title) + '.'
    : '<b>' + esc(c.plaintiff.name) + '</b>, from ' + esc(c.fromName || 'a friend') + ', is suing <b>' + esc(homeName) + '</b> over ' + esc(title) + '.';
  return '<div class="sc-summons-case"><p>' + sentence + (problem ? '<span class="sc-summons-problem">' + esc(problem) + '</span>' : '') + '</p><div class="sc-actions">' +
    (k && home ? '<button class="btn btn-primary btn-sm" type="button" data-sc-take="' + esc(c.id) + '">Take the case</button>' : '') +
    '<button class="btn btn-ghost btn-sm" type="button" data-sc-decline="' + esc(c.id) + '">Decline</button></div></div>';
}
function renderSummons() {
  const slot = !ep && sheet.querySelector('[data-sc-summons]');
  if (slot) slot.innerHTML = summonsMarkup();
}
// Never in the way: the lobby is already up, and the post arrives when it arrives.
function scopePost() {
  const uid = courtSocial?.userId() || null;
  if (uid !== postUser) { postUser = uid; postToken++; post = { cases: [], results: [], note: '' }; }
  return uid;
}
async function fetchPost() {
  if (!courtSocial?.active()) return;
  const uid = scopePost();
  const token = ++postToken;
  try {
    const box = await courtSocial.inbox();
    if (token !== postToken || courtSocial.userId() !== uid) return;
    post = { cases: box.cases, results: [...collectVerdicts(S, courtSocial, box.results), ...post.results.filter(r => !box.results.some(x => x.id === r.id))], note: '' };
    if (post.results.some(r => r.souls)) refresh();
  } catch (error) {
    if (token !== postToken || courtSocial.userId() !== uid) return;
    post = { ...post, note: error?.offline ? 'Offline. Any papers will keep.' : '' };
  }
  renderSummons();
}
function takeSummons(id) {
  const c = post.cases.find(x => x.id === id), home = c && S.pets.find(p => p.id === c.defendant.id), pet = c && guestPet(c.plaintiff);
  if (!c || !home || !pet || !COURT_BY_ID[c.caseId]) return;
  stopAll();
  const side = c.side === 'd' ? 'd' : 'p';
  hearing = { summons: c, pet, side };
  // The visitor takes the side its owner chose; our resident takes the other.
  ep = castEpisode(S, { caseId: c.caseId, ...(side === 'p' ? { defendantId: home.id } : { plaintiffId: home.id }), guest: { side, pet } });
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
    await courtSocial.rule(h.summons.id, { verdict: slotVerdict(h.side, ruling), stars: res.stars, ratings: res.ratings });
    const souls = summonsReward(S, h.summons.id, 'heard');
    post.cases = post.cases.filter(c => c.id !== h.summons.id);
    save(); refresh();
    if (line()) line().innerHTML = glyph('soul') + esc(souls ? '+' + souls + ' for hearing ' + to + '’s summons. The verdict is on its way.'
      : 'The verdict is on its way to ' + to + '. The reward for hearing it is owed: summonses pay three a day, and it will be paid on the next day with room.');
  } catch (error) {
    if (error?.code === 'not_open') post.cases = post.cases.filter(c => c.id !== h.summons.id);
    if (line()) line().textContent = error?.code === 'not_open' ? 'Someone had already heard this one.' : 'The verdict did not reach ' + to + '. The papers stay in the lobby.';
  }
}

/* ---------------- the studio ---------------- */
function seatIcons(i) {
  const tags = seatTags(ep, i);
  return tags.length ? '<span class="sc-seat-tags" role="img" aria-label="' + esc(tags.map(t => t.text).join(' ')) + '">' + tags.map(t => ROLE_ICONS[t.role] || '').join('') + '</span>' : '';
}
function seat(juror, i) {
  return '<span class="sc-seat" data-seat="' + i + '" title="' + esc(juror.name) + '"><span class="sc-seat-art">' + portrait(juror) + '</span>' + seatIcons(i) + '<i class="sc-vote" aria-hidden="true"></i><i class="sc-zzz" aria-hidden="true">z<b>z</b><b>z</b></i></span>';
}
const party = side => '<span class="sc-lectern"><small>' + (side === 'p' ? 'Plaintiff' : 'Defendant') + '</small><span>' + esc(ep[side].name) + '</span></span>';
function studioMarkup(dress) {
  const heads = Array.from({ length: HEADS }, (_, i) => {
    const regular = dress.audience === 'regulars' ? REGULAR_SEATS.indexOf(i) : -1;
    return '<span class="sc-head' + (regular >= 0 ? ' sc-reg' : '') + '" style="--i:' + i + '">' + (regular >= 0 ? GALLERY_REGULARS[regular] : COURT_PROPS.galleryGhost) + '</span>';
  }).join('');
  return '<div class="sc-stage ' + dressClasses(dress) + '" data-sc-stage data-speaker="">' +
    '<div class="sc-set"><span class="sc-curtain l"></span><span class="sc-curtain r"></span><span class="sc-beam l"></span><span class="sc-beam r"></span></div>' + stageDressing(dress) +
    '<span class="sc-applause">APPLAUSE</span><span class="sc-onair">ON AIR</span>' +
    '<span class="sc-bug"><b>SHELF COURT</b><i></i>LIVE</span>' +
    '<div class="sc-jury" data-actor="jury"><span class="sc-jury-label">Jury</span><div class="sc-seats">' + ep.jury.map(seat).join('') + '</div></div>' +
    '<div class="sc-actor sc-judge" data-actor="judge">' + castSvg('judge') + '</div>' +
    '<div class="sc-bench"><span>' + glyph('skull') + '</span>' + benchDressing(dress) + '</div>' +
    '<div class="sc-actor sc-bailiff" data-actor="bailiff">' + castSvg('rat') + '</div>' +
    '<div class="sc-actor sc-podium p" data-actor="p"><span class="sc-party">' + portrait(ep.p) + '</span>' + party('p') + '</div>' +
    '<div class="sc-actor sc-podium d" data-actor="d"><span class="sc-party">' + portrait(ep.d) + '</span>' + party('d') + '</div>' +
    '<div class="sc-actor sc-witness" data-actor="npc" hidden><span class="sc-witness-art"></span><span class="sc-witness-tag">Surprise witness</span></div>' +
    '<div class="sc-audience" data-actor="audience">' + heads + '</div>' +
    '<div class="sc-fx" data-sc-fx></div>' +
    '</div>';
}
// The wreath rides on the judge's wig, so it goes inside the wig's own group.
function dressJudge(root, dress) {
  if (dress.wig === 'laurel') root?.querySelector('.jm-wig')?.insertAdjacentHTML('beforeend', LAUREL);
}
// The cast, in a line you can read at a glance and a list that says what each one does.
function castNotes() {
  const notes = describeCast(ep);
  if (!notes.length) return '';
  const chips = ['p', 'd'].flatMap(side => seatTags(ep, side).map(t => '<span class="sc-chip ' + t.role + '">' + esc(ep[side].name) + ' · ' + esc(t.tag) + '</span>')).join('');
  return '<details class="sc-castnotes"><summary><span class="sc-castnotes-label">Cast notes · ' + notes.length + '</span><span class="sc-tags">' + chips + '</span></summary><ul>' +
    notes.map(n => '<li><b>' + esc(n.tag) + '</b> ' + esc(n.text) + '</li>').join('') + '</ul></details>';
}
function showStudio() {
  const k = episodeCase(ep), dress = careerView(courtroomState(S)).dress;
  sheet.className = 'sheet sheet-court sc-show';
  sheet.innerHTML = head(k.title, ep.p.name + ' v. ' + ep.d.name) + studioMarkup(dress) +
    '<div class="sc-chyron"><span class="sc-chyron-case"><b>' + esc(k.title.toUpperCase()) + '</b> ' + esc(fill(ep, k.claim)) + '</span>' +
    '<span class="sc-meters"><span class="sc-meter ratings"><small>Ratings</small><i><b data-sc-meter="ratings"></b></i></span><span class="sc-meter respect"><small>Jury</small><i><b data-sc-meter="respect"></b></i></span></span></div>' +
    castNotes() +
    '<div class="sc-box" data-sc-box role="button" tabindex="0" aria-label="Next line"><span class="sc-name" data-sc-name></span><p class="sc-text" data-sc-text aria-live="polite"></p><span class="sc-more" aria-hidden="true">▼</span></div>' +
    '<div class="sc-skiprow" data-sc-skiprow hidden><button class="btn btn-ghost btn-sm" type="button" data-sc="skip"></button></div>' +
    '<div class="sc-controls" data-sc-controls hidden></div>';
  meters();
  open();
  dressJudge($('.sc-judge'), dress);
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
    queue = list.slice(); onDone = resolve; spoken = 0;
    const controls = $('[data-sc-controls]');
    if (controls) controls.hidden = true;
    nextLine();
  });
}
function nextLine() {
  if (!queue.length) { const done = onDone; onDone = null; current = null; skipMode = null; skipUi(); setSpeaker(''); done?.(); return; }
  speak(queue.shift());
}
// The skip control shows once the first line has been read, and only on a rerun.
function skipUi() {
  const row = $('[data-sc-skiprow]'); if (!row) return;
  row.hidden = !(skipMode && spoken >= 1 && current);
  const button = row.querySelector('button');
  if (skipMode && button.textContent !== skipMode.label) button.textContent = skipMode.label;
}
function skip() {
  if (!skipMode) return;
  const at = skipMode.keep ? queue.findIndex(line => line.turn) : -1;
  queue = at >= 0 ? queue.slice(at) : [];
  skipMode = null; skipUi();
  clearInterval(typer); typer = 0;
  nextLine();
}
function nameFor(line) {
  if (line.s === 'npc') return COURT_CAST[line.who]?.name || 'A witness';
  if (line.s === 'p') return ep.p.name + ', plaintiff';
  if (line.s === 'd') return ep.d.name + ', defendant';
  return ({ judge: 'Judge Mortis (you)', bailiff: 'Bailiff Rattigan', announcer: 'Announcer', reporter: 'Hall cam reporter', audience: 'Studio audience', jury: 'The jury' })[line.s] || '';
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
  spoken++; skipUi();
  const hall = $('.sc-hall');
  if (hall && (line.s === 'reporter' || line.s === 'p' || line.s === 'd')) aimHall(line.s === 'reporter' ? line.who : line.s);
  (hall?.querySelector('[data-actor="' + line.s + '"]') || $('[data-actor="' + line.s + '"]'))?.classList.add('talking');
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

/* ---------------- the hallway ----------------
   After the ruling the show cuts to a hand-held camera in the corridor
   outside Courtroom 1: its own set (art/court-hallway.js), the loser in the
   foreground with a microphone in their face, and on some episodes the winner
   strolling past behind them while the loser's eyes follow. The courtroom
   stays underneath, hidden by the stage's .sc-hallway hook, until the cut
   back. */
const WALK_DELAY = 1600, WALK_MS = 6400;  // matches .sc-hall-track in css/court.css
function hallTitle(side) {
  if (ep.ruling === 'both') return 'Declared an idiot, live on air';
  const asking = lowerFirst(fill(ep, episodeCase(ep).asking));
  return (side === 'd' ? 'Found liable. Owes ' : 'Lost. Wanted ') + asking;
}
function hallMarkup(losers, walker, boom) {
  const loser = side => '<div class="sc-hall-loser ' + side + '" data-actor="' + side + '"><span class="sc-hall-art">' + portrait(ep[side]) + '</span></div>';
  return '<div class="sc-hall' + (losers.length > 1 ? ' both' : '') + '" aria-hidden="true"><div class="sc-hall-cam">' + HALL_SET +
    '<span class="sc-hall-onair">ON AIR</span><span class="sc-hall-plate">COURT 1</span>' +
    '<span class="sc-hall-prop board">' + HALL_PROPS.noticeboard + '</span><span class="sc-hall-prop portrait">' + HALL_PROPS.portrait + '</span>' +
    '<span class="sc-hall-prop bench">' + HALL_PROPS.bench + '</span><span class="sc-hall-prop vend">' + HALL_PROPS.vending + '</span>' +
    (walker ? '<div class="sc-hall-track"><span class="sc-hall-walker"><span class="sc-hall-stride">' + portrait(walker) + '</span></span></div>' : '') +
    '<span class="sc-hall-haze"></span>' + losers.map(loser).join('') +
    (boom ? '<span class="sc-hall-prop boom">' + HALL_PROPS.boom + '</span>' : '') +
    '<span class="sc-hall-prop mic" data-actor="reporter">' + HALL_PROPS.mic + '</span></div>' +
    '<span class="sc-hall-vignette"></span><span class="sc-hall-vf"><i></i><i></i><i></i><i></i><b></b></span>' +
    '<span class="sc-hall-rec"><i></i>REC</span><span class="sc-hall-label">HALL CAM 2</span><span class="sc-hall-tc" data-sc-tc></span><span class="sc-hall-batt"><i></i></span>' +
    '<div class="sc-hall-lower"><b data-sc-hall-name></b><span data-sc-hall-title></span></div></div>';
}
function enterHallway(result) {
  const st = stage(); if (!st || !result.losers?.length) return;
  const tok = session;
  const walker = result.winner && !reduced() && Math.random() < 0.65 ? ep[result.winner] : null;
  st.insertAdjacentHTML('beforeend', hallMarkup(result.losers, walker, !busyEffects() && Math.random() < 0.6));
  st.classList.add('sc-hallway');
  aimHall(result.losers[0]);
  timecode(tok);
  if (walker) followWinner(tok);
}
function leaveHallway() {
  const st = stage(); if (!st) return;
  st.classList.remove('sc-hallway');
  st.querySelector('.sc-hall')?.remove();
}
// Point the microphone and the lower third at one loser.
function aimHall(side) {
  const hall = $('.sc-hall');
  if (!hall || !ep?.[side] || hall.dataset.aim === side) return;
  hall.dataset.aim = side;
  hall.querySelector('[data-sc-hall-name]').textContent = ep[side].name;
  hall.querySelector('[data-sc-hall-title]').textContent = hallTitle(side);
  const lower = hall.querySelector('.sc-hall-lower');
  lower.classList.remove('in'); void lower.offsetWidth; lower.classList.add('in');
}
// A running timecode, hours:minutes:seconds:frames at 24 frames a second.
function timecode(tok) {
  const el = $('[data-sc-tc]'); if (!el) return;
  const start = Date.now(), base = (60 * (12 + Math.floor(Math.random() * 40)) + Math.floor(Math.random() * 60)) * 24;
  const two = n => String(n).padStart(2, '0');
  const tick = () => {
    if (tok !== session || !el.isConnected) return;
    const f = base + Math.floor((Date.now() - start) * 24 / 1000);
    el.textContent = two(Math.floor(f / 86400)) + ':' + two(Math.floor(f / 1440) % 60) + ':' + two(Math.floor(f / 24) % 60) + ':' + two(f % 24);
    later(tick, reduced() ? 1000 : 125);
  };
  tick();
}
// The winner walks from the far end of the corridor to the near side; the
// loser's eyes (and a little of their head) go with them.
function followWinner(tok) {
  const loser = $('.sc-hall-loser'); if (!loser) return;
  for (let t = 0; t <= WALK_MS + 800; t += 400) {
    later(() => {
      if (tok !== session || !loser.isConnected) return;
      const centre = 1.1 - 1.25 * Math.min(1, t / WALK_MS);
      loser.style.setProperty('--gaze', t > WALK_MS ? '0' : Math.max(-2.4, Math.min(2.4, (centre - 0.5) * 5)).toFixed(2));
    }, WALK_DELAY + t);
  }
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
  // On a rerun the statements can be skipped after the first line; the twist's hint never is.
  if (ep.recap) skipMode = { label: 'Skip the opening', keep: true };
  await play(episodeOpening(ep)); if (!alive()) return;
  for (const gift of episodeReceipts(ep)) {
    await play(gift.lines); if (!alive()) return;
    noteClue(gift.note); await wait(900); if (!alive()) return;
    meters();
  }
  for (let round = 0; round < QUESTIONS_PER_EPISODE; round++) {
    if (round === ep.plan.breakBefore && !ep.hadBreak) {
      await commercial(); if (!alive()) return;
      await runHappening(randomHappening(ep)); if (!alive()) return;
    }
    const index = await pickQuestion(round); if (!alive()) return;
    showWitness('');
    const r = episodeAsk(ep, index);
    await play(r.lines); if (!alive()) return;
    if (r.note) { noteClue(r.note); await wait(900); if (!alive()) return; }
    if (r.perks.some(perk => perk.id === 'showman')) { bubble('SHOWTIME!', 'sc-bang'); await wait(500); if (!alive()) return; }
    meters();
    if (r.happening) await runHappening(r.happening);
    else if (round === ep.plan.extraAfter) await runHappening(randomHappening(ep));
    if (!alive()) return;
  }
  showWitness('');
  const ruling = await pickRuling(); if (!alive()) return;
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
  // Cut to the hall cam under the static; the announcer talks over the cut.
  tvStatic(700);
  enterHallway(result);
  if (ep.recap) skipMode = { label: 'Skip the interview', keep: false };
  await play(result.hallway); if (!alive()) return;
  tvStatic(500);
  await wait(260); if (!alive()) return;
  leaveHallway();
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

/* ---------------- notes and the Objection ---------------- */
function noteFlag(n) {
  if (n.state === 'struck') return 'Struck';
  if (n.state === 'confirmed') return 'Confirmed';
  return n.shaky ? (n.kind === 'lead' ? 'Unconfirmed lead' : 'Unconfirmed') : '';
}
function noteList(cls) {
  return '<ul class="' + cls + '">' + ep.notes.map(n => '<li class="sc-note' + (n.shaky && !n.state ? ' shaky' : '') + (n.state ? ' ' + n.state : '') + '">' + (n.state === 'struck' ? '<s>' + esc(n.text) + '</s>' : esc(n.text)) +
    (noteFlag(n) ? ' <span class="sc-note-flag">' + noteFlag(n) + '</span>' : '') + '</li>').join('') + '</ul>';
}
function notesMarkup() {
  return '<details class="sc-notes"><summary>Case notes · ' + ep.clues.length + '</summary>' + (ep.notes.length ? noteList('') : '<p>Nothing yet. Ask better questions.</p>') + '</details>';
}
// One button with a counter. It says why when there is nothing to do.
function objectionButton(final) {
  const o = objectionOptions(ep), can = o.notes.length > 0 || (!final && o.press);
  if (!o.left) return '<div class="sc-obj-row"><button class="btn btn-ghost sc-obj" type="button" disabled>Objection used</button></div>';
  if (final && !o.notes.length) return '';
  return '<div class="sc-obj-row"><button class="btn sc-obj" type="button" data-sc="objection"' + (can ? '' : ' disabled') + '>Objection! <span class="sc-obj-count">' + o.left + ' left</span></button>' +
    (can ? '' : '<small>' + (ep.asked.length ? 'Nothing left to check or press.' : 'Nothing to object to yet. Save it.') + '</small>') + '</div>';
}
function pickQuestion(round) {
  return (async function ask() {
    for (;;) {
      const list = episodeQuestions(ep).filter(q => !q.asked);
      const value = await choose('<div class="sc-q-head"><b>Question ' + (round + 1) + ' of ' + QUESTIONS_PER_EPISODE + '</b>' + notesMarkup() + '</div>' +
        '<div class="sc-questions">' + list.map(q => '<button type="button" class="sc-q' + (q.sass ? ' sass' : '') + '" data-sc-choice="' + q.index + '">' + (q.sass ? '<i>Zinger</i>' : '') + esc(q.text) + '</button>').join('') + '</div>' + objectionButton(false));
      if (value !== 'objection') return Number(value);
      await objectionFlow(false);
      if (!ep) return 0;
    }
  })();
}
function objectionPanel(final) {
  const o = objectionOptions(ep);
  return '<div class="sc-obj-panel"><p class="sc-prompt">Objection! To what, Your Honour?</p>' +
    o.notes.map(n => '<button type="button" class="sc-obj-opt" data-sc-choice="note:' + n.id + '"><small>Check this note</small>' + esc(n.text) + '</button>').join('') +
    (o.press && !final ? '<button type="button" class="sc-obj-opt" data-sc-choice="press"><small>Press the witness</small>Force another clue out of the last testimony. The audience will not enjoy the wait.</button>' : '') +
    '<button type="button" class="btn btn-ghost" data-sc-choice="cancel">Never mind, keep it</button></div>';
}
async function objectionFlow(final) {
  const tok = session;
  const value = await choose(objectionPanel(final));
  if (tok !== session || value === 'cancel') return;
  if (value === 'press') {
    const res = pressWitness(ep);
    if (!res) return;
    bubble('OBJECTION!', 'sc-bang'); judgeMood('irked');
    await wait(500); if (tok !== session) return;
    await play(res.lines); if (tok !== session) return;
    noteClue(res.note); await wait(900);
  } else if (value.startsWith('note:')) {
    const res = checkNote(ep, Number(value.slice(5)));
    if (!res) return;
    bubble(res.outcome === 'struck' ? 'SUSTAINED!' : 'OVERRULED!', 'sc-bang');
    await wait(500); if (tok !== session) return;
    await play(res.lines); if (tok !== session) return;
    playUnlock();
  }
  meters();
}
function noteClue(note) {
  const flag = noteFlag(note);
  layer('sc-clue' + (note.shaky ? ' shaky' : ''), '<small>' + (flag || 'Noted') + '</small>' + esc(note.text), 2400);
  playUnlock();
}
function pickRuling() {
  return (async function rule() {
    for (;;) {
      const value = await chooseRuling();
      if (value !== 'objection') return value;
      await objectionFlow(true);
      if (!ep) return 'both';
    }
  })();
}
function chooseRuling() {
  return choose('<div class="sc-deliberate"><h3>Your ruling, Your Honour</h3>' +
    (ep.notes.length ? noteList('sc-clues') : '<p class="sc-noclues">You have no clues. Rule with your gut. You have no gut.</p>') +
    objectionButton(true) +
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
    const absent = result.absent?.includes(i);
    if (!absent) seats[i].classList.remove('asleep');
    seats[i].classList.add(absent ? 'absent' : result.votes[i] ? 'agree' : 'disagree');
    seats[i].querySelector('.sc-vote').textContent = absent ? '💤' : result.votes[i] ? '👍' : '👎';
    playTone(absent ? 110 : result.votes[i] ? 660 : 180, { duration: 0.1, type: 'square', gain: 0.05 });
    await wait(260); if (tok !== session) return;
  }
}

/* ---------------- wrap ---------------- */
function promotionMarkup(promotion) {
  if (!promotion) return '';
  return '<div class="sc-promo" role="status"><span class="sc-kicker">Promoted</span><b>' + esc(promotion.name) + '</b>' +
    '<p>' + glyph('soul') + '+' + promotion.souls + ' souls' + (promotion.ranks.length > 1 ? ' for ' + promotion.ranks.length + ' promotions' : '') + '</p>' +
    (promotion.unlocks.length ? '<ul>' + promotion.unlocks.slice(-3).map(u => '<li><b>' + esc(u.name) + '</b> ' + esc(u.blurb) + '</li>').join('') +
      (promotion.unlocks.length > 3 ? '<li>and ' + (promotion.unlocks.length - 3) + ' more for the courtroom.</li>' : '') + '</ul>' : '') + '</div>';
}
function careerLine(res) {
  const v = careerView(courtroomState(S));
  if (res.promotion || res.guest) return '';
  return '<p class="sc-career-line">On the bench: ' + plural(v.stars, 'star') + (v.max ? '. Top rank.' : '. ' + plural(v.toNext, 'star') + ' to ' + esc(v.next.name) + '.') + '</p>';
}
function versionLine(res) {
  const v = res.version;
  if (!v || v.of <= 1) return '';
  return '<li class="sc-ver-line' + (v.isNew && v.key !== BASE ? ' twist' : '') + '">' + (v.key === BASE ? 'The original telling.' : 'The twist: ' + esc(v.title) + '.') +
    ' Versions seen: ' + v.seen + ' of ' + v.of + (v.isNew ? ' (a new one)' : '') + '</li>';
}
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
    versionLine(res) +
    (heard ? '<li class="souls" data-sc-verdict>Sending the verdict to ' + esc(heard.summons.fromName || 'your friend') + '.</li>' : '') + '</ul>' +
    promotionMarkup(res.promotion) + careerLine(res) +
    (escapadeView(S).active?.ready ? '<div class="sc-actions"><button class="btn btn-primary" type="button" data-escapade="open">Our story’s ending ↗</button></div>' : '') +
    '<div class="sc-actions"><button class="btn btn-primary sc-next" type="button" data-sc="next" disabled>Next episode</button><button class="btn" type="button" data-sc="lobby">Episode guide</button><button class="btn btn-ghost" type="button" data-sc="close">Back to the shelf</button></div></div>';
  (res.promotion || res.stars >= 3 ? playAchievement : res.correct ? playStar : playError)();
  if (res.promotion) { bubble('PROMOTED!', 'sc-bang'); applause(2600); }
  if (heard) deliverVerdict(heard, res, ep.ruling);
  const next = controls.querySelector('.sc-next');
  later(() => { if (next?.isConnected) { next.disabled = false; next.focus({ preventScroll: true }); } }, 650);
  refresh();
}

/* ---------------- wiring ---------------- */
function open() { if (!veil.classList.contains('open')) veil.classList.add('open'); }
function close() { stopAll(); ep = null; hearing = null; veil.classList.remove('open'); refresh(); }
// Today’s docket is a fixed version for everyone, so the lobby's choice does not apply to it.
function roll() {
  stopAll();
  hearing = null;
  ep = castEpisode(S, { ...lobby, twist: docketLocked(lobby.caseId) ? undefined : lobby.twist || undefined });
  if (ep) runEpisode();
}
const pickCase = id => { lobby.caseId = id; lobby.twist = ''; };

export function openCourt(residentId, caseId) {
  if (!S || (!S.pets.length && !courtSocial?.active()) || document.querySelector('.veil.open:not(#courtVeil)')) return;
  scopePost();
  // Summons rewards that were over the daily cap are paid on the first day with room.
  const owed = payOwedSummons(S);
  backpay = owed.souls ? '+' + owed.souls + ' souls in back pay for ' + (owed.count === 1 ? 'a summons' : owed.count + ' summonses') + ' heard when the till was shut.' : '';
  if (owed.souls) { save(); refresh(); }
  // Mail remains readable after every resident has left. A missing defendant
  // can still have their papers declined, and the sender can collect a verdict.
  if (!S.pets.length) {
    stopAll(); ep = null; hearing = null;
    sheet.className = 'sheet sheet-court sc-lobby';
    sheet.innerHTML = head('Shelf Court', 'Your court mail') +
      '<p>Your shelf is empty. You can still read verdicts or decline papers for residents who have left.</p>' +
      (backpay ? '<p class="sc-backpay">' + glyph('soul') + esc(backpay) + '</p>' : '') +
      '<div data-sc-summons>' + summonsMarkup() + '</div>';
    open(); sheet.querySelector('[data-sc="close"]')?.focus({ preventScroll: true });
    fetchPost();
    return;
  }
  if (caseId && COURT_BY_ID[caseId]) pickCase(caseId);
  // Residents who have not been at a podium lately go first.
  defaultLobby(residentId, true);
  showLobby();
  fetchPost();
}

export function initCourt(state, onRefresh, { social, cloud } = {}) {
  S = state; refresh = onRefresh || refresh; courtSocial = social || null;
  scopePost();
  const accountChanged = () => {
    if ((courtSocial?.userId() || null) === postUser) return;
    scopePost();
    if (veil.classList.contains('open')) close();
  };
  social?.subscribe(accountChanged);
  cloud?.subscribe(accountChanged);
  window.addEventListener('shelflife:court', e => openCourt(e.detail?.petId, e.detail?.caseId));
  sheet.addEventListener('change', e => {
    if (e.target.dataset?.scVersion !== undefined) { lobby.twist = e.target.value; showLobby(); return; }
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
    const replay = e.target.closest('[data-sc-replay]');
    if (replay) { const [id, key] = replay.dataset.scReplay.split('|'); pickCase(id); lobby.twist = key; defaultLobby('', true); showLobby(); return; }
    const caseButton = e.target.closest('[data-sc-case]');
    if (caseButton) { pickCase(caseButton.dataset.scCase); showLobby(); return; }
    const choice = e.target.closest('[data-sc-choice]');
    if (choice) { if (!choice.disabled) onChoice?.(choice.dataset.scChoice); return; }
    const action = e.target.closest('[data-sc]');
    if (!action) { if (e.target.closest('[data-sc-box],[data-sc-stage]')) advance(); return; }
    const act = action.dataset.sc;
    if (act === 'close') close();
    else if (act === 'roll') roll();
    else if (act === 'another') { pickCase(nextCaseId(S, Math.random, lobby.caseId)); showLobby(); }
    else if (act === 'swap') { [lobby.plaintiffId, lobby.defendantId] = [lobby.defendantId, lobby.plaintiffId]; showLobby(); }
    else if (act === 'lobby') { pickCase(nextCaseId(S, Math.random, ep?.caseId)); defaultLobby('', true); showLobby(); }
    else if (act === 'lobby-back') showLobby();
    else if (act === 'notebook') showNotebook();
    else if (act === 'next') { pickCase(nextCaseId(S, Math.random, ep?.caseId)); defaultLobby('', true); roll(); }
    else if (act === 'skip') skip();
    else if (act === 'objection') onChoice?.('objection');
  });
  document.addEventListener('keydown', e => {
    if (!veil.classList.contains('open') || !ep || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target.closest?.('button,select,input,summary')) return;
    if ((e.key === 'Enter' || e.key === ' ') && current) { e.preventDefault(); advance(); }
  });
  veil.addEventListener('click', e => { if (e.target === veil) close(); });
}

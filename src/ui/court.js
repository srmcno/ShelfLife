import { COURT_CAST, COURT_PATIENCE } from '../content/court.js';
import {
  courtCases, courtStart, courtCallWitness, courtMove, courtPress, courtPresent, courtFinish,
  trialCase, witnessInfo, evidenceList, statementText
} from '../engine/court.js';
import { courtroomState } from '../court-state.js';
import { save } from '../state.js';
import { renderPetSprite } from '../art/sprite.js';
import { castSvg, COURT_PROPS } from '../art/court-cast.js';
import { glyph } from '../art/mayhem-glyphs.js';
import { escapadeView } from '../engine/escapades.js';
import { playTone, playStomp, playAchievement, playError, playStar, playUnlock } from '../audio/sound.js';

/* Shelf Court. A lit little courtroom in a sheet: the judge on the bench, the
   prosecutor at the right, your resident in the dock and a witness on the
   stand. Lines type out one at a time; tap to hurry them. During
   cross-examination you step through the testimony, press anything
   suspicious and present evidence at the statement it contradicts. */

const byId = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const veil = byId('courtVeil'), sheet = byId('courtSheet');
const VOICES = { judge: 110, prosecutor: 660, you: 300, defendant: 520, gallery: 200 };
const WITNESS_VOICES = { woodlouse: 440, geoffrey2: 470, moth: 560, lamp: 250, cat: 180, ghost: 330, uncle: 150, raven: 240, widow: 380, susan: 600 };
const TYPE_MS = 22;

let S = null, refresh = () => {};
let petId = '', trial = null, mode = 'docket';
let queue = [], onDone = null, current = null, typed = 0, typer = 0, lockUntil = 0;
const timers = new Set();
const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function pet() { return S.pets.find(p => p.id === petId) || S.pets[0] || null; }
function head(title, kicker) {
  return '<div class="sheet-head"><div><span class="eyebrow">' + esc(kicker) + '</span><h2>' + esc(title) + '</h2></div><button class="btn btn-ghost btn-sm" type="button" data-ct="close">Close</button></div>';
}
function stopAll() {
  for (const t of timers) clearTimeout(t);
  timers.clear(); clearInterval(typer); typer = 0;
  queue = []; onDone = null; current = null;
}

/* ---------------- the docket ---------------- */
function showDocket() {
  stopAll(); trial = null; mode = 'docket';
  const c = courtroomState(S), cases = courtCases(S), p = pet();
  const adventure = escapadeView(S).active, forUs = adventure && !adventure.playDone && adventure.approach.activity === 'court';
  sheet.className = 'sheet sheet-court ct-docket';
  sheet.innerHTML = head('Shelf Court', 'Now in session · ' + c.solved.length + ' of ' + cases.length + ' cases won') +
    '<div class="ct-hero"><div class="ct-hero-judge">' + castSvg('judge') + '<span class="ct-hero-gavel">' + COURT_PROPS.gavel + '</span></div>' +
    '<div><p class="ct-hero-line">Your residents stand accused of crimes they almost certainly did not commit. Almost.</p>' +
    '<ol class="ct-howto"><li><b>Listen</b> to the testimony.</li><li><b>Press</b> anything fishy. Liars sweat.</li><li><b>Present</b> the evidence that proves a statement wrong and shout <em>Objection!</em></li></ol>' +
    '<p class="ct-hero-small">Three wrong objections and the judge runs out of patience. He is a skeleton. He has very little.</p></div></div>' +
    (forUs ? '<p class="ct-adventure"><b>' + esc(adventure.episode.title) + '</b> · Any finished trial moves our adventure on.</p>' : '') +
    '<label class="ct-client">Your client<select data-ct-client>' + S.pets.map(x => '<option value="' + esc(x.id) + '"' + (x.id === p?.id ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select></label>' +
    '<div class="ct-cases">' + cases.map(k => '<button type="button" class="ct-case' + (k.solved ? ' solved' : '') + (k.next ? ' next' : '') + '" data-ct-case="' + k.id + '">' +
      '<span class="ct-case-no">Case ' + k.number + '</span><b>' + esc(k.title) + '</b><small>' + esc(k.blurb) + '</small>' +
      (k.flawless ? '<i class="ct-case-stamp gold">Flawless</i>' : k.solved ? '<i class="ct-case-stamp">Not guilty</i>' : k.next ? '<i class="ct-case-flag">Next on the docket</i>' : '') +
      '</button>').join('') + '</div>';
  open();
  (sheet.querySelector('.ct-case.next') || sheet.querySelector('.ct-case'))?.focus({ preventScroll: true });
}

/* ---------------- the courtroom ---------------- */
function stageMarkup() {
  const ghosts = n => Array.from({ length: n }, (_, i) => '<span class="ct-ghost" style="--i:' + i + '">' + COURT_PROPS.galleryGhost + '</span>').join('');
  return '<div class="ct-stage" data-ct-stage data-speaker="">' +
    '<div class="ct-room"><span class="ct-window"></span><span class="ct-window right"></span><span class="ct-banner-cloth"></span></div>' +
    '<div class="ct-gallery left">' + ghosts(3) + '</div><div class="ct-gallery right">' + ghosts(3) + '</div>' +
    '<div class="ct-actor ct-judge" data-actor="judge">' + castSvg('judge') + '<span class="ct-gavel">' + COURT_PROPS.gavel + '</span></div>' +
    '<div class="ct-bench"><span>' + glyph('skull') + '</span></div>' +
    '<div class="ct-actor ct-dock" data-actor="defendant"><span class="ct-pet"></span><span class="ct-rail"></span><span class="ct-duster">' + COURT_PROPS.duster + '</span></div>' +
    '<div class="ct-actor ct-stand" data-actor="witness"><span class="ct-witness"></span><span class="ct-box-front"></span></div>' +
    '<div class="ct-actor ct-prosecutor" data-actor="prosecutor">' + castSvg('rat') + '<span class="ct-table"></span></div>' +
    '<div class="ct-meter" data-ct-meter></div>' +
    '<div class="ct-ribbon" data-ct-ribbon hidden></div>' +
    '<div class="ct-fx" data-ct-fx></div>' +
    '</div>';
}

function showTrial(caseId) {
  stopAll();
  trial = courtStart(S, { caseId, petId: pet()?.id });
  const k = trialCase(trial), number = courtCases(S).find(c => c.id === k.id).number;
  sheet.className = 'sheet sheet-court ct-trial';
  sheet.innerHTML = head(k.title, 'Case ' + number + ' · ' + trial.name + ' v. the household') + stageMarkup() +
    '<div class="ct-box" data-ct-box role="button" tabindex="0" aria-label="Next line"><span class="ct-name" data-ct-name></span><p class="ct-text" data-ct-text aria-live="polite"></p><span class="ct-more" aria-hidden="true">▼</span></div>' +
    '<div class="ct-controls" data-ct-controls hidden></div>' +
    '<div class="ct-record" data-ct-record hidden></div>';
  const p = pet();
  if (p) sheet.querySelector('.ct-pet').appendChild(renderPetSprite(p));
  drawMeter();
  open();
  mode = 'script';
  play(trial.opening, callWitness);
}

function stage() { return sheet.querySelector('[data-ct-stage]'); }
function fx() { return sheet.querySelector('[data-ct-fx]'); }
function drawMeter(broken = -1) {
  const meter = sheet.querySelector('[data-ct-meter]');
  if (!meter) return;
  meter.setAttribute('aria-label', 'Judge’s patience: ' + trial.patience + ' of ' + COURT_PATIENCE);
  meter.innerHTML = '<small>Patience</small>' + Array.from({ length: COURT_PATIENCE }, (_, i) => '<i class="' + (i < trial.patience ? 'on' : i === broken ? 'breaking' : '') + '">' + glyph('skull') + '</i>').join('');
}

function callWitness() {
  const w = witnessInfo(trial);
  const slot = sheet.querySelector('.ct-witness');
  slot.innerHTML = castSvg(w.art);
  const stand = sheet.querySelector('.ct-stand');
  stand.classList.remove('exit', 'broken', 'sweating');
  stand.classList.remove('enter'); void stand.offsetWidth; stand.classList.add('enter');
  mode = 'script';
  play(courtCallWitness(trial), startCross);
}

function startCross() {
  const w = witnessInfo(trial);
  const ribbon = sheet.querySelector('[data-ct-ribbon]');
  ribbon.hidden = false;
  ribbon.innerHTML = '<span>Cross-examination</span><b>' + esc(w.title) + '</b>';
  banner('Cross-examination', 'ct-cross-banner', 1100);
  lockUntil = Date.now() + (reduced() ? 0 : 900);
  later(() => { mode = 'cross'; showStatement(); }, reduced() ? 0 : 900);
}

function showStatement() {
  mode = 'cross';
  const w = witnessInfo(trial);
  closeRecord();
  speak({ s: 'witness', t: statementText(trial) }, true);
  const controls = sheet.querySelector('[data-ct-controls]');
  controls.hidden = false;
  controls.innerHTML = '<div class="ct-count" aria-live="polite">Statement ' + (trial.statement + 1) + ' of ' + w.count + '</div>' +
    '<div class="ct-buttons"><button class="btn ct-arrow" type="button" data-ct="prev" aria-label="Previous statement">◀</button>' +
    '<button class="btn ct-press" type="button" data-ct="press">Press</button>' +
    '<button class="btn btn-primary ct-present" type="button" data-ct="record">Present</button>' +
    '<button class="btn ct-arrow" type="button" data-ct="next" aria-label="Next statement">▶</button></div>';
}

/* ---------------- lines ---------------- */
function play(lines, done) {
  queue = lines.slice(); onDone = done;
  const controls = sheet.querySelector('[data-ct-controls]');
  if (controls) controls.hidden = true;
  nextLine();
}
function nextLine() {
  if (!queue.length) { const done = onDone; onDone = null; current = null; setSpeaker(''); done?.(); return; }
  speak(queue.shift());
}
function nameFor(line) {
  if (line.s === 'witness') return witnessInfo(trial)?.name || 'Witness';
  if (line.s === 'judge') return COURT_CAST.judge.name;
  if (line.s === 'prosecutor') return COURT_CAST.prosecutor.name;
  if (line.s === 'defendant') return trial.name;
  if (line.s === 'you') return 'You, for the defence';
  if (line.s === 'gallery') return 'The gallery';
  return '';
}
function setSpeaker(who) {
  const st = stage();
  if (!st) return;
  st.dataset.speaker = who;
  st.querySelectorAll('.talking').forEach(el => el.classList.remove('talking'));
}
function speak(line, statement = false) {
  clearInterval(typer);
  current = { ...line, statement };
  const box = sheet.querySelector('[data-ct-box]'), text = sheet.querySelector('[data-ct-text]'), name = sheet.querySelector('[data-ct-name]');
  box.className = 'ct-box ct-say-' + line.s + (statement ? ' ct-statement' : '');
  name.textContent = nameFor(line);
  name.hidden = !name.textContent;
  setSpeaker(line.s);
  const actor = sheet.querySelector('[data-actor="' + line.s + '"]');
  actor?.classList.add('talking');
  if (line.s === 'gallery') stage().classList.add('ct-murmur'), later(() => stage()?.classList.remove('ct-murmur'), 1400);
  if (/NOT GUILTY/.test(line.t)) notGuilty();
  else if (/found GUILTY/.test(line.t)) guilty();
  typed = 0; text.textContent = '';
  const full = line.t;
  const voice = line.s === 'witness' ? WITNESS_VOICES[witnessInfo(trial)?.who] || 400 : VOICES[line.s];
  typer = setInterval(() => {
    typed = Math.min(full.length, typed + 1);
    text.textContent = full.slice(0, typed);
    if (voice && typed % 3 === 1 && /\w/.test(full[typed - 1])) playTone(voice * (0.94 + Math.random() * 0.12), { duration: 0.045, type: 'square', gain: 0.025 });
    if (typed >= full.length) finishTyping();
  }, TYPE_MS);
}
function finishTyping() {
  clearInterval(typer); typer = 0;
  if (!current) return;
  sheet.querySelector('[data-ct-text]').textContent = current.t;
  typed = current.t.length;
  sheet.querySelectorAll('.talking').forEach(el => el.classList.remove('talking'));
  sheet.querySelector('[data-ct-box]')?.classList.add('ready');
}
function advance() {
  if (Date.now() < lockUntil || !current || current.statement) return;
  if (typer) { finishTyping(); return; }
  nextLine();
}

/* ---------------- effects ---------------- */
function banner(text, cls, ms) {
  const layer = fx(); if (!layer) return;
  const el = document.createElement('div');
  el.className = 'ct-banner ' + cls;
  el.innerHTML = '<span>' + esc(text) + '</span>';
  layer.appendChild(el);
  later(() => el.remove(), ms);
}
function bubble(word, cls) {
  const layer = fx(); if (!layer) return;
  const el = document.createElement('div');
  el.className = 'ct-bubble ' + cls;
  el.innerHTML = '<span class="ct-burst"></span><b>' + esc(word) + '</b>';
  layer.appendChild(el);
  later(() => el.remove(), 1000);
}
function flash() {
  const layer = fx(); if (!layer) return;
  const el = document.createElement('div'); el.className = 'ct-flash'; layer.appendChild(el);
  later(() => el.remove(), 400);
}
function shake(big = false) {
  const st = stage(); if (!st || reduced()) return;
  st.classList.remove('ct-shake', 'ct-shake-big'); void st.offsetWidth;
  st.classList.add(big ? 'ct-shake-big' : 'ct-shake');
  later(() => st?.classList.remove('ct-shake', 'ct-shake-big'), 500);
}
function objectionSound() {
  playTone(196, { duration: 0.34, type: 'sawtooth', gain: 0.1 });
  playTone(294, { duration: 0.3, type: 'square', gain: 0.06 });
  playStomp();
}
function gavel() {
  const judge = sheet.querySelector('.ct-judge'); if (!judge) return;
  judge.classList.remove('banging'); void judge.offsetWidth; judge.classList.add('banging');
  later(() => { playStomp(); shake(); bubble('BANG!', 'ct-bang'); }, 260);
  later(() => judge?.classList.remove('banging'), 900);
}
function evidenceGot(e) {
  const layer = fx(); if (!layer || !e) return;
  const el = document.createElement('div');
  el.className = 'ct-got';
  el.innerHTML = '<span>' + glyph(e.glyph) + '</span><b>' + esc(e.name) + '</b><small>added to the court record</small>';
  layer.appendChild(el);
  playUnlock();
  later(() => el.remove(), 2200);
}
function notGuilty() {
  const layer = fx(); if (!layer) return;
  const el = document.createElement('div');
  el.className = 'ct-verdict good';
  el.innerHTML = [...'NOT GUILTY'].map((ch, i) => '<span style="--i:' + i + '">' + (ch === ' ' ? '&nbsp;' : ch) + '</span>').join('');
  layer.appendChild(el);
  if (!reduced()) {
    for (let i = 0; i < 26; i++) {
      const bone = document.createElement('i');
      bone.className = 'ct-bone';
      bone.style.cssText = '--x:' + Math.round(Math.random() * 100) + '%;--d:' + (Math.random() * 0.9).toFixed(2) + 's;--t:' + (1.4 + Math.random() * 1.2).toFixed(2) + 's;--r:' + Math.round(Math.random() * 720 - 360) + 'deg';
      bone.innerHTML = COURT_PROPS.bone;
      layer.appendChild(bone);
    }
  }
  stage()?.classList.add('ct-cheer');
  playAchievement();
}
function guilty() {
  const layer = fx(); if (!layer) return;
  const el = document.createElement('div');
  el.className = 'ct-stamp';
  el.textContent = 'GUILTY';
  layer.appendChild(el);
  sheet.querySelector('.ct-dock')?.classList.add('dusted');
  shake(true); playError();
}

/* ---------------- cross-examination ---------------- */
function move(delta) {
  if (mode !== 'cross' || Date.now() < lockUntil) return;
  courtMove(trial, delta);
  showStatement();
}
function press() {
  if (mode !== 'cross' || Date.now() < lockUntil) return;
  mode = 'script';
  sheet.querySelector('[data-ct-controls]').hidden = true;
  bubble('HOLD IT!', 'ct-holdit');
  playTone(520, { duration: 0.12, type: 'square', gain: 0.07 });
  const r = courtPress(trial);
  const stand = sheet.querySelector('.ct-stand');
  if (r.sweat) stand.classList.add('sweating');
  lockUntil = Date.now() + (reduced() ? 0 : 650);
  later(() => {
    if (r.added) evidenceGot(r.added);
    play(r.lines, () => { stand?.classList.remove('sweating'); showStatement(); });
  }, reduced() ? 0 : 650);
}

function openRecord(selected) {
  if (mode !== 'cross') return;
  const list = evidenceList(trial);
  const pick = list.find(e => e.id === selected) || list[0];
  const record = sheet.querySelector('[data-ct-record]');
  record.hidden = false;
  record.innerHTML = '<div class="ct-record-head"><b>Court record</b><button class="btn btn-ghost btn-sm" type="button" data-ct="back">Back</button></div>' +
    '<div class="ct-evidence">' + list.map(e => '<button type="button" class="ct-ev' + (e.id === pick.id ? ' on' : '') + '" data-ct-ev="' + e.id + '" aria-pressed="' + (e.id === pick.id) + '"><span>' + glyph(e.glyph) + '</span><small>' + esc(e.name) + '</small></button>').join('') + '</div>' +
    '<div class="ct-ev-detail"><span class="ct-ev-art">' + glyph(pick.glyph) + '</span><div><b>' + esc(pick.name) + '</b><p>' + esc(pick.text) + '</p></div></div>' +
    '<p class="ct-ev-against">Against: “' + esc(statementText(trial)) + '”</p>' +
    '<button class="btn btn-primary ct-objection-btn" type="button" data-ct="present" data-ev="' + pick.id + '">Objection!</button>';
  sheet.querySelector('[data-ct-controls]').hidden = true;
  record.querySelector('.ct-objection-btn').focus({ preventScroll: true });
}
function closeRecord() {
  const record = sheet.querySelector('[data-ct-record]');
  if (record) { record.hidden = true; record.innerHTML = ''; }
}
function present(evidenceId) {
  if (mode !== 'cross' || Date.now() < lockUntil) return;
  const r = courtPresent(trial, evidenceId);
  if (!r) return;
  mode = 'script';
  closeRecord();
  sheet.querySelector('[data-ct-controls]').hidden = true;
  bubble('OBJECTION!', 'ct-objection');
  flash(); shake(true); objectionSound();
  const pause = reduced() ? 0 : 950;
  lockUntil = Date.now() + pause;
  const stand = sheet.querySelector('.ct-stand');
  if (r.correct) {
    later(() => {
      play([{ s: 'you', t: r.shout }], () => {
        stand.classList.remove('sweating'); stand.classList.add('broken');
        sheet.querySelector('[data-ct-ribbon]').hidden = true;
        shake(true); playTone(90, { duration: 0.5, type: 'sawtooth', gain: 0.09 });
        lockUntil = Date.now() + (reduced() ? 0 : 700);
        later(() => {
          play(r.lines, () => {
            if (r.next === 'witness') {
              stand.classList.add('exit');
              later(callWitness, reduced() ? 0 : 650);
            } else finish();
          });
        }, reduced() ? 0 : 700);
      });
    }, pause);
  } else {
    later(() => {
      gavel();
      drawMeter(trial.patience);
      later(() => play(r.lines, () => r.lost ? finish() : showStatement()), reduced() ? 0 : 700);
    }, pause);
  }
}

/* ---------------- verdict ---------------- */
function finish() {
  mode = 'result';
  const result = courtFinish(S, trial, Date.now());
  save();
  const k = trialCase(trial), cases = courtCases(S), next = cases.find(c => c.next);
  const controls = sheet.querySelector('[data-ct-controls]');
  controls.hidden = false;
  controls.innerHTML = '<div class="ct-result ' + (result.won ? 'won' : 'lost') + '">' +
    '<h3>' + (result.won ? (result.flawless ? 'Flawless defence' : 'Not guilty') : 'Guilty. Eternally dusted.') + '</h3>' +
    '<p>' + (result.won ? esc(trial.name) + ' walks free from ' + esc(k.title) + (result.flawless ? ' without a single wasted objection. The skeleton is impressed. You can tell because a tooth fell out.' : '. The judge has ' + result.patience + ' patience left, which for him is practically joy.') : 'The judge ran out of patience. ' + esc(trial.name) + ' will be dusted weekly, forever. Try again: the case file is still open.') + '</p>' +
    '<ul class="mh-rewards">' + (result.souls ? '<li class="souls">' + glyph('soul') + '+' + result.souls + ' souls</li>' : '<li>Today’s game purse is empty. Justice is its own reward. Allegedly.</li>') +
    (result.trust ? '<li class="good">' + esc(trial.name) + ' trusts you a little more</li>' : '') +
    (result.firstSolve ? '<li class="good">Case ' + (cases.findIndex(c => c.id === k.id) + 1) + ' closed · ' + result.solved + ' of ' + result.total + '</li>' : '') + '</ul>' +
    (escapadeView(S).active?.ready ? '<div class="ct-actions"><button class="btn btn-primary" type="button" data-escapade="open">Our story’s ending ↗</button></div>' : '') +
    '<div class="ct-actions">' + (result.won ? (next ? '<button class="btn btn-primary ct-next-case" type="button" data-ct="case" data-case="' + next.id + '" disabled>Next case</button>' : '') : '<button class="btn btn-primary ct-next-case" type="button" data-ct="case" data-case="' + k.id + '" disabled>Retry the case</button>') +
    '<button class="btn" type="button" data-ct="docket">The docket</button><button class="btn btn-ghost" type="button" data-ct="close">Back to the shelf</button></div></div>';
  if (result.won) (result.flawless ? playStar : playAchievement)();
  const again = controls.querySelector('.ct-next-case');
  later(() => { if (again?.isConnected) { again.disabled = false; again.focus({ preventScroll: true }); } }, 650);
  refresh();
}

/* ---------------- wiring ---------------- */
function open() { if (!veil.classList.contains('open')) veil.classList.add('open'); }
function close() { stopAll(); trial = null; mode = 'docket'; veil.classList.remove('open'); refresh(); }

export function openCourt(residentId, caseId) {
  if (!S || !S.pets.length || document.querySelector('.veil.open:not(#courtVeil)')) return;
  if (residentId && S.pets.some(p => p.id === residentId)) petId = residentId;
  if (caseId) showTrial(caseId); else showDocket();
}

export function initCourt(state, onRefresh) {
  S = state; refresh = onRefresh || refresh;
  window.addEventListener('shelflife:court', e => openCourt(e.detail?.petId, e.detail?.caseId));
  sheet.addEventListener('change', e => { if (e.target.matches('[data-ct-client]')) petId = e.target.value; });
  sheet.addEventListener('click', e => {
    const kase = e.target.closest('[data-ct-case]');
    if (kase) { const sel = sheet.querySelector('[data-ct-client]'); if (sel) petId = sel.value; showTrial(kase.dataset.ctCase); return; }
    const ev = e.target.closest('[data-ct-ev]');
    if (ev) { openRecord(ev.dataset.ctEv); return; }
    const action = e.target.closest('[data-ct]');
    if (!action) { if (e.target.closest('[data-ct-box],[data-ct-stage]')) advance(); return; }
    const act = action.dataset.ct;
    if (act === 'close') close();
    else if (act === 'docket') showDocket();
    else if (act === 'case') showTrial(action.dataset.case);
    else if (act === 'prev') move(-1);
    else if (act === 'next') move(1);
    else if (act === 'press') press();
    else if (act === 'record') openRecord();
    else if (act === 'back') { closeRecord(); showStatement(); }
    else if (act === 'present') present(action.dataset.ev);
  });
  document.addEventListener('keydown', e => {
    if (!veil.classList.contains('open') || !trial || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target.closest?.('button,select,input')) return;
    if ((e.key === 'Enter' || e.key === ' ') && mode === 'script') { e.preventDefault(); advance(); }
    else if (mode === 'cross' && sheet.querySelector('[data-ct-record]').hidden) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); move(1); }
    }
  });
  veil.addEventListener('click', e => { if (e.target === veil) close(); });
}

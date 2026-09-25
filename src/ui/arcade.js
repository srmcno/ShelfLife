import { ARCADE_GAMES, ARCADE_BY_ID, FRENZY_ITEMS } from '../content/arcade.js';
import {
  startGame, frenzyStep, stackStep, stackDrop, seanceShown, seanceInput, seanceBeat, whackStep, whackHit, finishRun, FRENZY
} from '../engine/arcade.js';
import { arcadeState } from '../arcade-state.js';
import { mayhemState } from '../mayhem-state.js';
import { GAME_SOULS_PER_DAY } from '../engine/mayhem.js';
import { localDayKey, save } from '../state.js';
import { renderPetSprite } from '../art/sprite.js';
import { escapadeView } from '../engine/escapades.js';
import { glyph } from '../art/mayhem-glyphs.js';
import { playTone, playStar, playFeud, playStomp, playAchievement, playFeed } from '../audio/sound.js';

/* The arcade sheet. One screen per phase: an intro card with a single line of
   instructions, the live playfield, and a result card with "Again" focused so
   the next run is one key away. */

const byId = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const SEANCE_NOTES = [261.6, 329.6, 392, 523.3];
const SEANCE_NAMES = ['Bone candle', 'Wax candle', 'Tallow candle', 'Black candle'];

let S = null, refresh = () => {};
const veil = byId('arcadeVeil'), sheet = byId('arcadeSheet');
let run = null;           // { id, petId, game, raf, last, paused, ... }
let gameId = 'frenzy', petId = '';

function pet() { return S.pets.find(p => p.id === petId) || S.pets[0] || null; }
function skulls(n, max) { return Array.from({ length: max }, (_, i) => '<i class="' + (i < n ? 'on' : '') + '">' + glyph('skull') + '</i>').join(''); }
function purseLeft() { const m = mayhemState(S); return m.gameDay === localDayKey() ? Math.max(0, GAME_SOULS_PER_DAY - m.gameSouls) : GAME_SOULS_PER_DAY; }

function head(title, kicker) {
  return '<div class="sheet-head"><div><span class="eyebrow">' + esc(kicker) + '</span><h2>' + esc(title) + '</h2></div><button class="btn btn-ghost btn-sm" type="button" data-ar="close">Close</button></div>';
}

/* ---------------- intro ---------------- */
function showIntro() {
  stop();
  const g = ARCADE_BY_ID[gameId], a = arcadeState(S), p = pet();
  sheet.className = 'sheet sheet-arcade ar-' + gameId;
  sheet.style.setProperty('--ar-accent', g.accent);
  sheet.innerHTML = head(g.title, g.kind + ' · with ' + (p ? p.name : 'nobody')) +
    '<div class="ar-intro"><div class="ar-intro-art"><span class="ar-intro-glyph">' + glyph(g.glyph) + '</span><span class="ar-intro-pet"></span></div>' +
    '<p class="ar-hook">' + esc(g.hook) + '</p><p class="ar-howto">' + esc(g.howto) + '</p>' +
    '<div class="ar-records"><span><b>' + (a.best[gameId] || 0) + '</b><small>best</small></span><span><b>' + (a.plays[gameId] || 0) + '</b><small>runs</small></span><span><b>' + purseLeft() + '</b><small>souls left today</small></span></div>' +
    '<div class="ar-actions"><button class="btn btn-primary ar-go" type="button" data-ar="play">Play</button><button class="btn btn-ghost" type="button" data-ar="menu">Other games</button></div></div>';
  if (p) sheet.querySelector('.ar-intro-pet').appendChild(renderPetSprite(p));
  open();
  sheet.querySelector('.ar-go')?.focus({ preventScroll: true });
}

/* ---------------- the menu of games ---------------- */
function showMenu() {
  stop();
  const a = arcadeState(S), p = pet();
  sheet.className = 'sheet sheet-arcade ar-menu';
  sheet.innerHTML = head('The arcade', 'Open after hours · with ' + (p ? p.name : 'nobody')) +
    '<div class="ar-menu-grid">' + ARCADE_GAMES.map(g => '<button class="ar-menu-card" type="button" data-ar-game="' + g.id + '" style="--ar-accent:' + g.accent + '"><span class="ar-menu-glyph">' + glyph(g.glyph) + '</span><b>' + esc(g.title) + '</b><small>' + esc(g.hook) + '</small><em>Best ' + (a.best[g.id] || 0) + '</em></button>').join('') + '</div>';
  open();
}

/* ---------------- playfields ---------------- */
function hud() {
  const g = run.game, def = ARCADE_BY_ID[run.id];
  const lives = 'lives' in g ? '<span class="ar-lives" aria-label="' + g.lives + ' lives left">' + skulls(g.lives, run.maxLives) + '</span>' : '';
  return '<div class="ar-hud"><span class="ar-score"><small>Score</small><b data-ar-score>' + g.score + '</b></span><span class="ar-best"><small>Best</small><b>' + (arcadeState(S).best[run.id] || 0) + '</b></span>' + lives + '<button class="btn btn-ghost btn-sm ar-pause" type="button" data-ar="pause" aria-label="Pause">❚❚</button></div>' +
    '<p class="ar-status" data-ar-status aria-live="polite">' + esc(def.howto) + '</p>';
}

function buildFrenzy(field) {
  field.innerHTML = '<div class="ar-frenzy-glow"></div><div class="ar-catcher"></div><div class="ar-floor"></div>';
  const p = pet();
  if (p) field.querySelector('.ar-catcher').appendChild(renderPetSprite(p));
  run.nodes = new Map();
}
function drawFrenzy(field, events) {
  const g = run.game;
  const catcher = field.querySelector('.ar-catcher');
  catcher.style.left = (g.x * 100) + '%';
  field.classList.toggle('frenzied', g.t < g.frenzyUntil);
  const seen = new Set();
  for (const item of g.items) {
    seen.add(item.id);
    let node = run.nodes.get(item.id);
    if (!node) {
      node = document.createElement('span');
      node.className = 'ar-item ' + (FRENZY_ITEMS[item.kind].good ? 'good' : 'bad') + ' k-' + item.kind;
      node.innerHTML = glyph(FRENZY_ITEMS[item.kind].glyph);
      node.style.setProperty('--spin', item.spin + 'deg');
      field.appendChild(node); run.nodes.set(item.id, node);
    }
    node.style.left = (item.x * 100) + '%';
    node.style.top = (item.y * 100) + '%';
  }
  for (const [id, node] of run.nodes) if (!seen.has(id)) { node.remove(); run.nodes.delete(id); }
  for (const e of events) {
    if (e.type === 'catch') { pop(field, '+' + e.points + (e.mult > 1 ? ' ×' + e.mult : ''), e.x, 0.78, 'good'); playTone(520 + Math.min(e.points, 10) * 40, { duration: 0.09, type: 'square', gain: 0.05 }); }
    if (e.type === 'hit') { pop(field, ({ holy: 'Holy water!', soap: 'Soap!', trap: 'Snap!' })[e.kind] || 'Ow', e.x, 0.74, 'bad'); flash(field); playFeud(); }
  }
}

const STACK_ROW = 0.075;
function buildStack(field) {
  field.innerHTML = '<div class="ar-tower"></div><div class="ar-mover"><span class="ar-coffin"></span></div><div class="ar-rider"></div>';
  const p = pet();
  if (p) field.querySelector('.ar-rider').appendChild(renderPetSprite(p));
  run.drawn = 0;
}
function coffin(block, row) {
  const el = document.createElement('span');
  el.className = 'ar-coffin placed';
  el.style.left = (block.x * 100) + '%'; el.style.width = (block.w * 100) + '%';
  el.style.bottom = (row * STACK_ROW * 100) + '%';
  return el;
}
function drawStack(field) {
  const g = run.game, tower = field.querySelector('.ar-tower');
  while (run.drawn < g.stack.length) { tower.appendChild(coffin(g.stack[run.drawn], run.drawn)); run.drawn++; }
  // The camera climbs with the tower so the top few rows stay in view.
  const lift = Math.max(0, g.stack.length - 7) * STACK_ROW * 100;
  tower.style.transform = 'translateY(' + lift + '%)';
  const topRow = g.stack.length - Math.max(0, g.stack.length - 7);
  const mover = field.querySelector('.ar-mover');
  mover.style.left = (g.mover.x * 100) + '%'; mover.style.width = (g.mover.w * 100) + '%';
  mover.style.bottom = ((topRow + 1.6) * STACK_ROW * 100) + '%';
  const top = g.stack[g.stack.length - 1], rider = field.querySelector('.ar-rider');
  rider.style.left = ((top.x + top.w / 2) * 100) + '%';
  rider.style.bottom = (topRow * STACK_ROW * 100) + '%';
  mover.hidden = g.over;
}
function dropCoffin(field) {
  const g = run.game;
  const r = stackDrop(g);
  if (r.cut) {
    const piece = document.createElement('span');
    piece.className = 'ar-coffin falling ' + (r.cut.side < 0 ? 'left' : 'right');
    const topRow = g.stack.length - 1 - Math.max(0, g.stack.length - 7);
    piece.style.left = (r.cut.x * 100) + '%'; piece.style.width = (r.cut.w * 100) + '%'; piece.style.bottom = (topRow * STACK_ROW * 100) + '%';
    field.appendChild(piece); setTimeout(() => piece.remove(), 900);
  }
  if (r.over) { playFeud(); return; }
  if (r.perfect) { pop(field, r.grew ? 'Perfect! It grew.' : 'Perfect', 0.5, 0.2, 'good'); playTone(440 + Math.min(r.streak, 8) * 60, { duration: 0.12 }); }
  else playStomp();
}

function buildSeance(field) {
  field.innerHTML = '<div class="ar-circle">' + [0, 1, 2, 3].map(i => '<button class="ar-candle c' + i + '" type="button" data-pad="' + i + '" aria-label="' + SEANCE_NAMES[i] + ', key ' + (i + 1) + '"><span class="ar-flame"></span><span class="ar-wax"></span><small>' + (i + 1) + '</small></button>').join('') + '<div class="ar-medium"></div></div>';
  const p = pet();
  if (p) field.querySelector('.ar-medium').appendChild(renderPetSprite(p));
  run.showAt = 0; run.showIndex = -1; run.lit = -1;
}
function lightCandle(field, pad, on) {
  field.querySelectorAll('.ar-candle').forEach((el, i) => el.classList.toggle('lit', on && i === pad));
}
function stepSeance(field, dt) {
  const g = run.game;
  if (g.phase !== 'show') return;
  run.showAt += dt;
  const beat = seanceBeat(g), gap = beat * 0.45;
  // Lead-in, then each candle: lit for a beat, dark for a gap.
  const lead = 0.55;
  if (run.showAt < lead) { if (run.lit !== -2) { lightCandle(field, -1, false); run.lit = -2; status('The spirits are speaking…'); field.classList.add('listening'); } return; }
  const t = run.showAt - lead, step = Math.floor(t / (beat + gap)), within = t - step * (beat + gap);
  if (step >= g.seq.length) { lightCandle(field, -1, false); seanceShown(g); run.showAt = 0; run.lit = -1; field.classList.remove('listening'); status('Your turn. ' + g.seq.length + (g.seq.length === 1 ? ' candle.' : ' candles.')); return; }
  const on = within < beat;
  const key = on ? step : -1;
  if (key !== run.lit) { lightCandle(field, on ? g.seq[step] : -1, on); if (on) playTone(SEANCE_NOTES[g.seq[step]]); run.lit = key; }
}
function pressCandle(field, pad) {
  const g = run.game;
  const r = seanceInput(g, pad);
  if (r.ignored) return;
  const el = field.querySelector('.ar-candle.c' + pad);
  el.classList.add('lit'); setTimeout(() => el.classList.remove('lit'), 180);
  if (r.ok) { playTone(SEANCE_NOTES[pad], { duration: 0.18 }); if (r.round) { pop(field, 'The dead approve', 0.5, 0.12, 'good'); status('Round ' + g.seq.length + '. Listen…'); } }
  else if (r.forgiven) { playFeud(); status('Wrong candle. The spirits forgive you once. Listen again.'); pop(field, 'Forgiven. Once.', 0.5, 0.12, 'bad'); }
  else { playFeud(); }
}

function buildWhack(field) {
  field.innerHTML = '<div class="ar-yard">' + Array.from({ length: 9 }, (_, i) => '<button class="ar-grave" type="button" data-hole="' + i + '" aria-label="Grave ' + (i + 1) + '"><span class="ar-stone">' + glyph('grave') + '</span><span class="ar-riser"></span><span class="ar-mound"></span></button>').join('') + '</div>';
}
const RISER = { hand: 'hand', mourner: 'veil', landlord: 'skull' };
function drawWhack(field, events) {
  const g = run.game;
  field.querySelectorAll('.ar-grave').forEach((el, i) => {
    const hole = g.holes[i], kind = hole ? hole.kind : '';
    if (el.dataset.kind !== kind) {
      el.dataset.kind = kind;
      el.querySelector('.ar-riser').innerHTML = kind ? glyph(RISER[kind]) : '';
      el.setAttribute('aria-label', 'Grave ' + (i + 1) + (kind === 'hand' ? ': a hand' : kind === 'mourner' ? ': a mourner, leave her' : kind === 'landlord' ? ': the landlord, five points' : ''));
    }
    el.classList.toggle('up', !!hole);
  });
  for (const e of events) if (e.type === 'escape') { pop(field, 'Escaped!', ((e.hole % 3) + 0.5) / 3, (Math.floor(e.hole / 3) + 0.3) / 3, 'bad'); flash(field); playFeud(); }
}
function hitGrave(field, i) {
  const g = run.game, r = whackHit(g, i);
  if (r.ignored || r.empty) return;
  const x = ((i % 3) + 0.5) / 3, y = (Math.floor(i / 3) + 0.3) / 3;
  const el = field.querySelector('.ar-grave[data-hole="' + i + '"]');
  el.classList.add('bonk'); setTimeout(() => el.classList.remove('bonk'), 160);
  if (r.widow) { pop(field, 'That was the widow.', x, y, 'bad'); flash(field); playFeud(); }
  else { pop(field, '+' + r.points, x, y, 'good'); playTone(r.kind === 'landlord' ? 880 : 330 + Math.random() * 90, { duration: 0.08, type: 'square', gain: 0.05 }); }
}

/* ---------------- little effects ---------------- */
function pop(field, text, x, y, tone) {
  const el = document.createElement('span');
  el.className = 'ar-pop ' + tone; el.textContent = text;
  el.style.left = (x * 100) + '%'; el.style.top = (y * 100) + '%';
  field.appendChild(el); setTimeout(() => el.remove(), 900);
}
function flash(field) { field.classList.remove('hurt'); void field.offsetWidth; field.classList.add('hurt'); }
function status(text) { const el = sheet.querySelector('[data-ar-status]'); if (el && el.textContent !== text) el.textContent = text; }

/* ---------------- the loop ---------------- */
const BUILD = { frenzy: buildFrenzy, stack: buildStack, seance: buildSeance, whack: buildWhack };
function startRun() {
  stop();
  const game = startGame(gameId);
  run = { id: gameId, petId: pet()?.id || '', game, raf: 0, last: 0, paused: false, maxLives: game.lives || 0 };
  sheet.className = 'sheet sheet-arcade playing ar-' + gameId;
  sheet.style.setProperty('--ar-accent', ARCADE_BY_ID[gameId].accent);
  sheet.innerHTML = head(ARCADE_BY_ID[gameId].title, 'With ' + (pet()?.name || 'nobody')) + hud() + '<div class="ar-field" data-ar-field tabindex="0" aria-label="' + esc(ARCADE_BY_ID[gameId].title) + ' playfield"></div>' + controls();
  const field = sheet.querySelector('[data-ar-field]');
  BUILD[gameId](field);
  open();
  field.focus({ preventScroll: true });
  run.last = performance.now();
  run.raf = requestAnimationFrame(frame);
}
function controls() {
  if (gameId === 'frenzy') return '<div class="ar-pads"><button class="btn ar-pad" type="button" data-ar-dir="-1" aria-label="Move left">←</button><button class="btn ar-pad" type="button" data-ar-dir="1" aria-label="Move right">→</button></div>';
  if (gameId === 'stack') return '<div class="ar-pads"><button class="btn btn-primary ar-pad wide" type="button" data-ar="drop">Drop the coffin</button></div>';
  return '';
}
function frame(now) {
  if (!run) return;
  run.raf = requestAnimationFrame(frame);
  let dt = (now - run.last) / 1000;
  run.last = now;
  if (run.paused) return;
  // A long gap (a hidden tab, a stalled phone) pauses rather than skipping ahead.
  if (dt > 1.5) { pause(true); return; }
  dt = Math.min(dt, 1 / 20);
  const field = sheet.querySelector('[data-ar-field]');
  if (!field) { stop(); return; }
  const g = run.game;
  if (run.id === 'frenzy') drawFrenzy(field, frenzyStep(g, dt));
  else if (run.id === 'stack') { stackStep(g, dt); drawStack(field); }
  else if (run.id === 'seance') stepSeance(field, dt);
  else if (run.id === 'whack') drawWhack(field, whackStep(g, dt));
  const scoreEl = sheet.querySelector('[data-ar-score]');
  if (scoreEl && scoreEl.textContent !== String(g.score)) scoreEl.textContent = g.score;
  const lives = sheet.querySelector('.ar-lives');
  if (lives && lives.dataset.n !== String(g.lives)) { lives.dataset.n = g.lives; lives.innerHTML = skulls(g.lives, run.maxLives); }
  if (g.over && !run.ending) { run.ending = true; setTimeout(gameOver, run.id === 'stack' ? 700 : 450); }
}
function pause(on) {
  if (!run || run.game.over) return;
  run.paused = on;
  sheet.classList.toggle('paused', on);
  const field = sheet.querySelector('[data-ar-field]');
  let cover = field?.querySelector('.ar-paused');
  if (on && field && !cover) { cover = document.createElement('button'); cover.type = 'button'; cover.className = 'ar-paused'; cover.dataset.ar = 'resume'; cover.innerHTML = '<b>Paused</b><span>The dead are waiting politely. Tap to carry on.</span>'; field.appendChild(cover); }
  if (!on) cover?.remove();
  if (!on && run) run.last = performance.now();
}
function stop() {
  if (run?.raf) cancelAnimationFrame(run.raf);
  run = null;
}

/* ---------------- game over ---------------- */
function gameOver() {
  if (!run) return;
  const { id, game } = run;
  const result = finishRun(S, id, game.score, run.petId);
  stop();
  save();
  const g = ARCADE_BY_ID[id];
  sheet.className = 'sheet sheet-arcade over ar-' + id;
  sheet.innerHTML = head(g.title, 'Run over') +
    '<div class="ar-over"><div class="ar-final"><small>Score</small><b>' + result.score + '</b>' + (result.newBest ? '<span class="ar-newbest">New best</span>' : '<em>Best ' + result.best + '</em>') + '</div>' +
    '<div class="ar-tier" aria-label="' + result.tier + ' of 3">' + skulls(result.tier, 3) + '</div>' +
    '<p class="ar-quip">' + esc(result.quip) + '</p>' + (result.bestLine ? '<p class="ar-bestline">' + esc(result.bestLine) + '</p>' : '') +
    '<ul class="mh-rewards">' + (result.souls ? '<li class="souls">' + glyph('soul') + '+' + result.souls + ' souls</li>' : '<li>' + (result.score ? 'Today’s arcade purse is empty. Play for glory.' : 'No score, no souls.') + '</li>') +
    (result.trust ? '<li class="good">' + esc(pet()?.name || '') + ' trusts you a little more</li>' : '') + '</ul>' +
    (escapadeView(S).active?.ready ? '<div class="ar-actions"><button class="btn btn-primary" type="button" data-escapade="open">Our story’s ending ↗</button></div>' : '') +
    '<div class="ar-actions"><button class="btn btn-primary ar-again" type="button" data-ar="play">Again</button><button class="btn" type="button" data-ar="menu">Other games</button><button class="btn btn-ghost" type="button" data-ar="close">Back to the shelf</button></div></div>';
  (result.newBest ? playAchievement : result.tier >= 2 ? playStar : playFeed)();
  sheet.querySelector('.ar-again')?.focus({ preventScroll: true });
  refresh();
}

/* ---------------- wiring ---------------- */
function open() { if (!veil.classList.contains('open')) veil.classList.add('open'); }
function close() { stop(); veil.classList.remove('open'); refresh(); }

export function openArcade(id, residentId) {
  if (!S || !S.pets.length) return;
  if (residentId) petId = residentId;
  if (id && ARCADE_BY_ID[id]) { gameId = id; showIntro(); }
  else showMenu();
}

export function initArcade(state, onRefresh) {
  S = state; refresh = onRefresh || refresh;
  window.addEventListener('shelflife:arcade', e => openArcade(e.detail?.game, e.detail?.petId));
  // Older invitations still say "play"; they now open the arcade menu.
  window.addEventListener('shelflife:play', e => openArcade(null, e.detail?.petId));
  sheet.addEventListener('click', e => {
    const card = e.target.closest('[data-ar-game]');
    if (card) { gameId = card.dataset.arGame; showIntro(); return; }
    const pad = e.target.closest('[data-pad]');
    if (pad && run?.id === 'seance') { pressCandle(sheet.querySelector('[data-ar-field]'), Number(pad.dataset.pad)); return; }
    const grave = e.target.closest('[data-hole]');
    if (grave && run?.id === 'whack') return; // handled on pointerdown for speed
    const action = e.target.closest('[data-ar]')?.dataset.ar;
    if (action === 'close') close();
    else if (action === 'play') startRun();
    else if (action === 'menu') showMenu();
    else if (action === 'pause') pause(!run?.paused);
    else if (action === 'resume') pause(false);
    else if (action === 'drop' && run?.id === 'stack' && !run.paused) dropCoffin(sheet.querySelector('[data-ar-field]'));
  });
  sheet.addEventListener('pointerdown', e => {
    if (!run || run.paused) return;
    const field = e.target.closest('[data-ar-field]');
    if (run.id === 'whack') {
      const grave = e.target.closest('[data-hole]');
      if (grave) { e.preventDefault(); hitGrave(field || sheet.querySelector('[data-ar-field]'), Number(grave.dataset.hole)); }
      return;
    }
    if (run.id === 'stack' && field && !e.target.closest('.ar-paused')) { e.preventDefault(); dropCoffin(field); return; }
    if (run.id === 'frenzy') {
      const dir = e.target.closest('[data-ar-dir]');
      if (dir) { e.preventDefault(); run.game.dir = Number(dir.dataset.arDir); run.game.target = null; dir.setPointerCapture?.(e.pointerId); return; }
      if (field) { e.preventDefault(); aim(field, e); run.dragging = true; field.setPointerCapture?.(e.pointerId); }
    }
  });
  sheet.addEventListener('pointermove', e => { if (run?.id === 'frenzy' && run.dragging) aim(sheet.querySelector('[data-ar-field]'), e); });
  const release = () => { if (run?.id === 'frenzy') { run.dragging = false; run.game.dir = 0; } };
  sheet.addEventListener('pointerup', release);
  sheet.addEventListener('pointercancel', release);
  document.addEventListener('keydown', e => {
    if (!run || !veil.classList.contains('open') || e.altKey || e.ctrlKey || e.metaKey) return;
    // A focused button already turns Space and Enter into its own click.
    if ((e.key === ' ' || e.key === 'Enter') && e.target.closest?.('button')) return;
    const field = sheet.querySelector('[data-ar-field]');
    if (e.key === 'p' || e.key === 'P') { e.preventDefault(); pause(!run.paused); return; }
    if (run.paused) return;
    if (run.id === 'frenzy' && ['ArrowLeft', 'ArrowRight', 'a', 'd', 'A', 'D'].includes(e.key)) { e.preventDefault(); run.game.target = null; run.game.dir = /Left|a/i.test(e.key) && !/d/i.test(e.key) ? -1 : 1; }
    else if (run.id === 'stack' && (e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); dropCoffin(field); }
    else if (run.id === 'seance' && /^[1-4]$/.test(e.key) && !e.repeat) { e.preventDefault(); pressCandle(field, Number(e.key) - 1); }
    else if (run.id === 'whack' && /^[1-9]$/.test(e.key) && !e.repeat) {
      // Number keys follow the phone layout: 1 2 3 on the top row.
      e.preventDefault(); hitGrave(field, Number(e.key) - 1);
    }
  });
  document.addEventListener('keyup', e => { if (run?.id === 'frenzy' && ['ArrowLeft', 'ArrowRight', 'a', 'd', 'A', 'D'].includes(e.key)) run.game.dir = 0; });
  document.addEventListener('visibilitychange', () => { if (document.hidden && run) pause(true); });
  veil.addEventListener('click', e => { if (e.target === veil) close(); });
}
function aim(field, e) {
  const box = field.getBoundingClientRect();
  run.game.target = Math.max(0, Math.min(1, (e.clientX - box.left) / box.width));
  run.game.dir = 0;
}
export const ARCADE_FRENZY = FRENZY;

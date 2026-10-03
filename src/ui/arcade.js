import { ARCADE_GAMES, ARCADE_BY_ID, ARCADE_THEMES, THEME_BY_ID, COUNTDOWN_WORDS, SKULL_LINES } from '../content/arcade.js';
import {
  startGame, finishRun, frenzyDirection, challengeToday, ladder, runStats, dailyHistory, FRENZY
} from '../engine/arcade.js';
import { arcadeState, themeUnlocked, nextUnlock, medalTotal, lifetimeRuns } from '../arcade-state.js';
import { DAILY_SOULS } from '../content/daily.js';
import { mayhemState } from '../mayhem-state.js';
import { GAME_SOULS_PER_DAY } from '../engine/mayhem.js';
import { localDayKey, save } from '../state.js';
import { renderPetSprite } from '../art/sprite.js';
import { createPuppet } from '../art/animator.js';
import { escapadeView } from '../engine/escapades.js';
import { arcadeGlyph, sceneMarkup, hubArt } from '../art/arcade-art.js';
import { playStar, playAchievement, playFeed } from '../audio/sound.js';
import { sfx, startBed, stopBed, duckBed } from '../audio/arcade-audio.js';
import {
  createFx, createGovernor, countUp, fxLevelFor, rememberLevel, rememberedLevel, prefersReducedMotion, currentEffectsMode, buzz, FX_CAPS
} from './arcade-fx.js';
import { VIEWS } from './arcade-games.js';

/* The arcade sheet. One screen per phase: the hub, an intro card with a single
   line of instructions, the live playfield, and a result card with "Again"
   focused so the next run is one key away.

   A run goes ready (a quick 3, 2, 1 that any tap skips) then play, then a short
   death in slow motion, then the result. The four games live in
   ui/arcade-games.js; the effects in ui/arcade-fx.js; the art in
   art/arcade-art.js. This file is the shell around them. */

const byId = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

let S = null, refresh = () => {};
const veil = byId('arcadeVeil'), sheet = byId('arcadeSheet');
let run = null;           // the live run, or null
let gameId = 'frenzy', petId = '';
let arcadeSocial = null, boardToken = 0;   // friends' scores for the daily challenge, when the social layer is on
let resultTimers = [];    // everything the result card has scheduled
let resultFx = null, resultPuppet = null, quickNext = false;

function pet() { return S.pets.find(p => p.id === petId) || S.pets[0] || null; }
function skulls(n, max) { return Array.from({ length: max }, (_, i) => '<i class="' + (i < n ? 'on' : '') + '">' + arcadeGlyph('skull') + '</i>').join(''); }
function purseLeft() { const m = mayhemState(S); return m.gameDay === localDayKey() ? Math.max(0, GAME_SOULS_PER_DAY - m.gameSouls) : GAME_SOULS_PER_DAY; }
const hapticsOn = () => S?.settings?.haptics !== false;
function theme() { const a = arcadeState(S), t = THEME_BY_ID[a.theme]; return t && themeUnlocked(a, t) ? t : ARCADE_THEMES[0]; }
function themeVars(t) { return '--ar-sky-a:' + t.sky[0] + ';--ar-sky-b:' + t.sky[1] + ';--ar-ground:' + t.ground + ';--ar-glow:' + t.glow + ';--ar-fog:' + t.fog + ';--ar-star:' + t.star; }
function medals(id, n = (arcadeState(S).medals[id] || 0)) {
  return '<span class="ar-medals" role="img" aria-label="Best medal: ' + n + ' of 3 skulls">' + skulls(n, 3) + '</span>';
}

function head(title, kicker) {
  return '<div class="sheet-head"><div><span class="eyebrow">' + esc(kicker) + '</span><h2>' + esc(title) + '</h2></div><button class="btn btn-ghost btn-sm" type="button" data-ar="close">Close</button></div>';
}
function clearResultTimers() {
  resultTimers.forEach(t => { if (typeof t === 'function') t(); else { clearTimeout(t); clearInterval(t); } });
  resultTimers = [];
  resultFx?.destroy(); resultFx = null;
  resultPuppet?.release(); resultPuppet = null;
}
const later = (fn, ms) => { const t = setTimeout(fn, ms); resultTimers.push(t); return t; };

/* ---------------- intro ---------------- */
function showIntro() {
  stop();
  const g = ARCADE_BY_ID[gameId], a = arcadeState(S), p = pet();
  const ch = challengeToday(S), today = ch && ch.game === gameId ? ch : null;
  sheet.className = 'sheet sheet-arcade ar-' + gameId;
  sheet.style.cssText = '--ar-accent:' + g.accent + ';' + themeVars(theme());
  sheet.innerHTML = head(g.title, g.kind + ' · with ' + (p ? p.name : 'nobody')) +
    '<div class="ar-intro"><div class="ar-intro-art"><span class="ar-intro-glyph">' + arcadeGlyph(g.glyph) + '</span><span class="ar-intro-pet"></span></div>' +
    '<p class="ar-hook">' + esc(g.hook) + '</p><p class="ar-howto">' + esc(g.howto) + '</p>' +
    '<div class="ar-records"><span><b>' + (a.best[gameId] || 0) + '</b><small>best</small></span><span><b>' + (a.plays[gameId] || 0) + '</b><small>runs</small></span><span><b>' + purseLeft() + '</b><small>souls left today</small></span></div>' +
    '<div class="ar-skullrow" aria-label="Skull targets">' + g.tiers.map((t, k) => '<span class="' + ((a.medals[gameId] || 0) > k ? 'got' : '') + '"><i>' + arcadeGlyph('skull') + '</i><b>' + t + '</b><small>' + esc(g.ranks[k]) + '</small></span>').join('') + '</div>' +
    (today ? dailyCard(today) : '') + (today && arcadeSocial?.active() ? BOARD_SLOT : '') +
    '<div class="ar-actions">' + (today
      ? '<button class="btn btn-primary ar-go" type="button" data-ar="challenge">Today’s challenge</button><button class="btn" type="button" data-ar="play">Play as usual</button>'
      : '<button class="btn btn-primary ar-go" type="button" data-ar="play">Play</button>') +
    '<button class="btn btn-ghost" type="button" data-ar="menu">Other games</button></div></div>';
  if (p) sheet.querySelector('.ar-intro-pet').appendChild(renderPetSprite(p));
  open();
  sheet.querySelector('.ar-go')?.focus({ preventScroll: true });
  // Today's best goes up again in case an earlier try found no connection.
  if (today && arcadeSocial?.active()) loadBoard({ game: today.game, day: today.day, mod: today.mod.id }, today.best);
}

/* ---------------- friends today ---------------- */
// Friends by name, everyone else as a percentage. Filled in whenever the
// network answers; the game never waits for it.
const BOARD_SLOT = '<div class="ar-board" data-ar-board aria-live="polite"><p class="ar-board-note">Asking the neighbours.</p></div>';
async function loadBoard(ch, score = 0) {
  const token = ++boardToken;
  const slot = () => token === boardToken ? sheet.querySelector('[data-ar-board]') : null;
  if (score > 0) { try { await arcadeSocial.submitScore({ game: ch.game, day: ch.day, score, mod: ch.mod }); } catch { /* the board below says if we are offline */ } }
  try {
    const [board, place] = await Promise.all([arcadeSocial.board(ch.game, ch.day), arcadeSocial.percentile(ch.game, ch.day)]);
    const el = slot();
    if (el) el.innerHTML = boardMarkup(board, place);
  } catch {
    const el = slot();
    if (el) el.innerHTML = '<p class="ar-board-note">Offline. The scores will keep.</p>';
  }
}
function boardMarkup(board, place) {
  const top = board.slice(0, 5), mine = board.find(r => r.me);
  const rows = mine && !top.includes(mine) ? [...top, mine] : top;
  const line = place.beaten !== null ? 'You beat ' + place.beaten + '% of players today.'
    : place.players > 1 ? place.players + ' players so far today. The best scored ' + place.top + '.'
    : place.players === 1 ? (mine ? 'You are the only player so far today.' : 'One player so far today.') : '';
  return '<span class="ar-daily-kicker">Friends today</span>' + (rows.length
    ? '<ol class="ar-board-list">' + rows.map(r => '<li' + (r.me ? ' class="me"' : '') + '><b>' + r.rank + '</b><span>' + esc(r.me ? 'You' : r.name || 'A friend') + '</span><em>' + r.score + '</em></li>').join('') + '</ol>'
    : '<p class="ar-board-note">No friends have played today. Yet.</p>') + (line ? '<p class="ar-board-note">' + esc(line) + '</p>' : '');
}

function dailyCard(ch) {
  const state = ch.claimed
    ? 'Bonus claimed. Best today: ' + ch.best + (ch.streak > 1 ? ' · ' + ch.streak + ' days in a row' : '')
    : '+' + DAILY_SOULS + ' souls for your first run today' + (ch.streak ? ' · ' + ch.streak + ' day' + (ch.streak === 1 ? '' : 's') + ' in a row' : '');
  return '<div class="ar-daily"><span class="ar-daily-kicker">Today’s challenge · ' + esc(ch.mod.title) + '</span><p>' + esc(ch.mod.line) + '</p><small>' + esc(state) + '</small></div>';
}

/* ---------------- the hub ---------------- */
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
function fortnight() {
  const days = dailyHistory(S), played = days.filter(d => d.played).length;
  const cells = days.map(d => {
    const game = ARCADE_BY_ID[d.game], [y, m, day] = d.day.split('-').map(Number), dow = new Date(y, m, day).getDay();
    const pct = d.played ? Math.round(24 + 76 * Math.min(1, d.best / (game.tiers[2] * 0.9))) : 0;
    const label = new Date(y, m, day).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) + ': ' + game.title + (d.played ? ', best ' + d.best : ', not played');
    return '<li class="' + (d.played ? 'played' : '') + (d.today ? ' today' : '') + '" style="--ar-accent:' + game.accent + '" title="' + esc(label) + '" aria-label="' + esc(label) + '"><i style="height:' + pct + '%"></i><small>' + DOW[dow] + '</small></li>';
  }).join('');
  return '<section class="ar-fortnight" aria-label="The last fourteen challenge days"><div class="ar-fortnight-head"><span class="ar-daily-kicker">Last 14 days</span><small>' + played + ' of 14 played</small></div><ol>' + cells + '</ol></section>';
}
function arenaPicker() {
  const a = arcadeState(S), t = theme(), next = nextUnlock(a);
  const chips = ARCADE_THEMES.map(th => {
    const open = themeUnlocked(a, th);
    return '<button class="ar-chip' + (th.id === t.id ? ' is-on' : '') + (open ? '' : ' is-locked') + '" type="button" data-ar-theme="' + th.id + '"' + (open ? '' : ' disabled') + ' aria-pressed="' + (th.id === t.id) + '" style="--sw-a:' + th.sky[0] + ';--sw-b:' + th.glow + '"><i></i><span>' + esc(th.title) + '</span>' +
      (open ? '' : '<small>' + (th.need.runs ? th.need.runs + ' runs' : th.need.medals + ' skulls') + '</small>') + '</button>';
  }).join('');
  const line = next ? 'Next arena: ' + next.theme.title + '. ' + (next.left === 1 ? 'One more ' : next.left + ' more ') + (next.kind === 'runs' ? (next.left === 1 ? 'run' : 'runs') : (next.left === 1 ? 'skull' : 'skulls')) + ' to open it.' : 'Every arena is open. Choose whichever suits the occasion.';
  return '<section class="ar-arena" aria-label="Arena"><div class="ar-fortnight-head"><span class="ar-daily-kicker">Arena</span><small>' + medalTotal(a) + ' of 12 skulls · ' + lifetimeRuns(a) + ' runs</small></div><div class="ar-chips">' + chips + '</div><p class="ar-board-note">' + esc(t.line) + ' ' + esc(line) + '</p></section>';
}
function showMenu() {
  stop();
  const a = arcadeState(S), p = pet(), ch = challengeToday(S);
  sheet.className = 'sheet sheet-arcade ar-menu';
  sheet.style.cssText = themeVars(theme());
  sheet.innerHTML = head('The arcade', 'Open after hours · with ' + (p ? p.name : 'nobody')) +
    (ch ? '<button class="ar-daily-banner" type="button" data-ar-game="' + ch.game + '"><span class="ar-daily-kicker">Today’s challenge</span><b>' + esc(ARCADE_BY_ID[ch.game].title) + ': ' + esc(ch.mod.title) + '</b><small>' + esc(ch.claimed ? 'Bonus claimed. Best today: ' + ch.best : '+' + DAILY_SOULS + ' souls for your first run today') + '</small></button>' : '') +
    '<div class="ar-menu-grid">' + ARCADE_GAMES.map(g => '<button class="ar-menu-card' + (ch && ch.game === g.id ? ' is-today' : '') + '" type="button" data-ar-game="' + g.id + '" style="--ar-accent:' + g.accent + '"><span class="ar-menu-art">' + hubArt(g.id) + '</span><b>' + esc(g.title) + '</b><small>' + esc(g.hook) + '</small><span class="ar-menu-meta">' + medals(g.id) + '<em>Best ' + (a.best[g.id] || 0) + '</em></span>' + (ch && ch.game === g.id ? '<span class="ar-today">Today</span>' : '') + '</button>').join('') + '</div>' +
    fortnight() + arenaPicker();
  open();
}

/* ---------------- the HUD ---------------- */
function hud() {
  const g = run.game, def = ARCADE_BY_ID[run.id];
  const lives = 'lives' in g ? '<span class="ar-lives" aria-label="' + g.lives + ' lives left">' + skulls(g.lives, run.maxLives) + '</span>' : '';
  return '<div class="ar-hud"><span class="ar-score"><small>Score</small><b data-ar-score>' + g.score + '</b></span><span class="ar-best"><small>' + (run.daily ? 'Today' : 'Best') + '</small><b>' + (run.daily ? arcadeState(S).daily?.best || 0 : arcadeState(S).best[run.id] || 0) + '</b></span>' + lives + '<button class="btn btn-ghost btn-sm ar-pause" type="button" data-ar="pause" aria-label="Pause">❚❚</button></div>' +
    '<div class="ar-ladder" data-ar-ladder aria-hidden="true"><div class="ar-ladder-track"><i></i>' + def.tiers.map((t, k) => '<span class="ar-notch n' + (k + 1) + '"><u>' + arcadeGlyph('skull') + '</u><b>' + t + '</b></span>').join('') + '</div><small data-ar-next></small></div>' +
    '<p class="ar-status" data-ar-status aria-live="polite">' + esc(run.daily ? run.mod.title + '. ' + run.mod.line : def.howto) + '</p>';
}
function paintLadder(force = false) {
  const root = sheet.querySelector('[data-ar-ladder]');
  if (!root) return;
  const def = ARCADE_BY_ID[run.id], L = ladder(run.id, run.game.score), key = L.tier + ':' + L.left + ':' + Math.round(L.progress * 50);
  if (!force && key === run.ladderKey) return;
  run.ladderKey = key;
  root.querySelector('.ar-ladder-track i').style.transform = 'scaleX(' + Math.max(0.01, Math.min(1, (L.tier + (L.next ? L.progress : 0)) / 3)).toFixed(3) + ')';
  root.querySelectorAll('.ar-notch').forEach((el, k) => el.classList.toggle('on', L.tier > k));
  const out = root.querySelector('[data-ar-next]');
  const html = L.next ? L.left + ' to <span class="rk">' + esc(def.ranks[L.tier]) + '</span><span class="go"> go</span>' : 'All three skulls';
  if (out.innerHTML !== html) out.innerHTML = html;
}
function status(text) { const el = sheet.querySelector('[data-ar-status]'); if (el && el.textContent !== text) el.textContent = text; }

/* ---------------- a run ---------------- */
function controlsFor() { return VIEWS[gameId]().controls(); }
function startRun(daily = false) {
  stop();
  const ch = daily ? challengeToday(S) : null;
  const challenge = ch && ch.game === gameId ? ch : null;
  const game = startGame(gameId, Math.random, challenge ? challenge.mod : null);
  const a = arcadeState(S), def = ARCADE_BY_ID[gameId];
  const reduced = prefersReducedMotion();
  run = {
    id: gameId, petId: pet()?.id || '', game, raf: 0, last: 0, paused: false, phase: 'ready', maxLives: game.maxLives || game.lives || 0,
    daily: !!challenge, mod: challenge ? challenge.mod : null, view: VIEWS[gameId](), bestStart: challenge ? challenge.best : (a.best[gameId] || 0),
    tier: 0, beatShown: false, nearNext: 0, ladderKey: '', timeScale: 1, readyT: 0, readyLen: quickNext ? 0.3 : 0.42, readyStep: -1,
    puppet: null, reacts: {}, size: { w: 0, h: 0 }, timers: [], dying: false, ro: null, padDownAt: 0,
    gov: createGovernor(), reduced
  };
  quickNext = false;
  run.gov.level = fxLevelFor({ mode: currentEffectsMode(), reduced, remembered: rememberedLevel() });
  sheet.className = 'sheet sheet-arcade playing ar-' + gameId;
  veil.classList.add('ar-live');
  sheet.style.cssText = '--ar-accent:' + def.accent + ';' + themeVars(theme());
  sheet.innerHTML = head(def.title, (run.daily ? 'Today’s challenge · ' : '') + 'With ' + (pet()?.name || 'nobody')) + hud() +
    '<div class="ar-field" data-ar-field tabindex="0" aria-label="' + esc(def.title) + ' playfield"><div class="ar-scene" aria-hidden="true">' + sceneMarkup(gameId) + '</div><div class="ar-world"></div></div>' + controlsFor();
  const field = sheet.querySelector('[data-ar-field]'), world = field.querySelector('.ar-world');
  open();
  run.field = field; run.world = world;
  run.size = { w: field.clientWidth, h: field.clientHeight };
  run.fx = createFx(field, { level: run.gov.level, world, haptics: hapticsOn });
  run.fx.resize(run.size.w, run.size.h);
  if (typeof ResizeObserver === 'function') {
    run.ro = new ResizeObserver(() => { if (!run) return; run.size = { w: field.clientWidth, h: field.clientHeight }; run.fx.resize(run.size.w, run.size.h); });
    run.ro.observe(field);
  }
  const A = {
    g: game, run, field, world, fx: run.fx,
    get size() { return run.size; }, get puppet() { return run.puppet; },
    sfx: (name, step, opts) => sfx(name, step, opts), haptic: name => run.fx.haptic(name), say: status, react, pet: pet(),
    mkPet(parent) {
      const p = pet();
      if (!p) return null;
      const sprite = renderPetSprite(p);
      parent.appendChild(sprite);
      run.puppet = createPuppet(sprite);
      return sprite;
    }
  };
  run.A = A;
  run.el = { score: sheet.querySelector('[data-ar-score]'), lives: sheet.querySelector('.ar-lives') };
  run.view.build(A);
  paintLadder(true);
  showReady(0);
  field.focus({ preventScroll: true });
  startBed(gameId);
  run.last = performance.now();
  run.raf = requestAnimationFrame(frame);
}

/* The 3, 2, 1. Any tap or key ends it early and counts as the first move. */
function showReady(step) {
  const field = run.field;
  let el = field.querySelector('.ar-count');
  if (!el) { el = document.createElement('div'); el.className = 'ar-count'; el.setAttribute('aria-hidden', 'true'); el.innerHTML = '<b></b><small></small>'; field.appendChild(el); }
  const word = step >= 3 ? 'Go' : COUNTDOWN_WORDS[step];
  el.dataset.step = String(step);
  el.querySelector('b').textContent = word;
  el.querySelector('small').textContent = step === 0 && !run.reduced ? ARCADE_BY_ID[run.id].ready : '';
  el.hidden = false;
  if (typeof el.animate === 'function' && !run.reduced) { el.getAnimations?.().forEach(a => a.cancel()); el.animate([{ opacity: 0, transform: 'translate(-50%,-50%) scale(1.5)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.3 }, { opacity: step >= 3 ? 0 : 0.9, transform: 'translate(-50%,-50%) scale(.92)' }], { duration: Math.max(260, run.readyLen * 1000), easing: 'ease-out', fill: 'forwards' }); }
  sfx(step >= 3 ? 'go' : 'tick', step >= 3 ? 0 : step, { priority: 'high' });
  run.fx.haptic(step >= 3 ? 'go' : 'tick');
}
function beginPlay() {
  if (!run || run.phase !== 'ready') return;
  run.phase = 'play';
  const el = run.field.querySelector('.ar-count');
  if (el && el.dataset.step !== '3') { showReady(3); }
  setTimeout(() => { const c = run?.field?.querySelector('.ar-count'); if (c) c.hidden = true; }, 380);
  run.last = performance.now();
  status(run.daily ? run.mod.title + '. ' + run.mod.line : ARCADE_BY_ID[run.id].howto);
}

/* The resident answers what happens on the field. */
const GESTURE_GAP = 240;
function react(kind) {
  if (!run?.puppet || run.phase === 'ready') return;
  const now = performance.now();
  if (now - (run.reacts[kind] || 0) < GESTURE_GAP) return;
  run.reacts[kind] = now;
  run.puppet.gesture(kind);
}

function frame(now) {
  if (!run) return;
  run.raf = requestAnimationFrame(frame);
  const raw = now - run.last;
  run.last = now;
  if (run.paused) return;
  // A long gap (a hidden tab, a stalled phone) pauses rather than skipping ahead.
  if (raw > 1500) { pause(true); return; }
  const stepDown = run.gov.push(raw);
  if (stepDown) { run.fx.setLevel(stepDown); rememberLevel(stepDown); run.field.dataset.fx = String(stepDown); }
  const dt = Math.min(raw / 1000, 1 / 20);
  if (run.phase === 'ready') {
    run.readyT += dt;
    const step = Math.floor(run.readyT / run.readyLen);
    if (step !== run.readyStep && step < 3) { run.readyStep = step; showReady(step); }
    if (step >= 3) beginPlay();
    run.fx.update(dt);
    return;
  }
  if (run.fx.frozen(now)) return;        // hit-stop: nothing moves for a beat
  const slow = dt * run.timeScale;
  if (run.phase === 'play') {
    run.view.frame(run.A, slow);
    paintHud();
    if (run.game.over) startDying();
  }
  run.fx.update(slow);
}
function paintHud() {
  const g = run.game, scoreEl = run.el.score;
  if (scoreEl && scoreEl.textContent !== String(g.score)) {
    scoreEl.textContent = g.score;
    if (!run.reduced && typeof scoreEl.animate === 'function' && run.fx.level < 2) scoreEl.animate([{ transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 160, easing: 'ease-out' });
    paintLadder();
    milestones();
  }
  const lives = run.el.lives;
  if (lives && lives.dataset.n !== String(g.lives)) { lives.dataset.n = g.lives; lives.innerHTML = skulls(g.lives, run.maxLives); lives.setAttribute('aria-label', g.lives + ' lives left'); }
}
// Skulls, records and "nearly there", said on the field as they happen.
function milestones() {
  const g = run.game, def = ARCADE_BY_ID[run.id], L = ladder(run.id, g.score);
  if (L.tier > run.tier) {
    for (let t = run.tier + 1; t <= L.tier; t++) {
      run.fx.banner('Skull ' + t + ': ' + def.ranks[t - 1], SKULL_LINES[t - 1], 'gold', 1900);
      sfx('tier', t, { priority: 'high' }); run.fx.haptic('skull'); run.fx.burst('gold', 0.5, 0.4, 1.4);
    }
    run.tier = L.tier; run.nearNext = 0;
    return;
  }
  if (!run.beatShown && run.bestStart > 0 && g.score > run.bestStart) {
    run.beatShown = true;
    run.fx.banner('New best', 'Past ' + run.bestStart + ', and still going', 'gold', 1700);
    sfx('tier', 3, { priority: 'high' }); run.fx.haptic('best'); run.fx.burst('confetti', 0.5, 0.3, 1);
    return;
  }
  if (L.next && run.nearNext !== L.next && L.left <= Math.max(2, Math.round((L.next - (def.tiers[L.tier - 1] || 0)) * 0.1))) {
    run.nearNext = L.next;
    run.fx.pop(L.left + ' to the next skull', 0.5, 0.26, 'soft');
  }
}

function startDying() {
  if (run.dying) return;
  run.dying = true; run.phase = 'dying';
  const caps = run.fx.caps;
  run.view.die?.(run.A);
  run.fx.dim(true);
  if (caps.slowmo) run.timeScale = 0.28;
  run.fx.hitStop(110);
  run.fx.shake(1.3);
  sfx(run.id === 'stack' ? 'wave' : 'fatal', 0, { priority: 'high' });
  run.fx.haptic('fatal');
  stopBed(0.9);
  run.fx.burst('dust', 0.5, 0.6, 2);
  const wait = run.fx.level >= 2 ? 360 : run.id === 'stack' ? 1000 : 820;
  run.timers.push(setTimeout(gameOver, wait));
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
  duckBed(on);
}
function stop() {
  // A run that is over still counts if the sheet is closed during the slow-motion beat.
  if (run?.dying && !run.settled) {
    run.settled = true;
    finishRun(S, run.id, run.game.score, run.petId, Date.now(), Math.random, { daily: run.daily });
    save(); refresh();
  }
  if (run) {
    if (run.raf) cancelAnimationFrame(run.raf);
    run.timers.forEach(clearTimeout);
    run.ro?.disconnect();
    run.view?.destroy?.();
    run.puppet?.release();
    run.fx?.destroy();
  }
  run = null;
  clearResultTimers();
  stopBed(0.3);
  veil.classList.remove('ar-live');
}

/* ---------------- game over ---------------- */
function gameOver() {
  if (!run) return;
  const { id, game } = run, wasDaily = run.daily, stats = runStats(game);
  run.settled = true;
  const result = finishRun(S, id, game.score, run.petId, Date.now(), Math.random, { daily: wasDaily });
  const reduced = run.reduced, level = run.fx.level;
  stop();
  save();
  const g = ARCADE_BY_ID[id];
  const good = result.newBest || result.tier >= 2;
  sheet.className = 'sheet sheet-arcade over ar-' + id;
  sheet.style.cssText = '--ar-accent:' + g.accent + ';' + themeVars(theme());
  sheet.innerHTML = head(g.title, wasDaily ? 'Today’s challenge · run over' : 'Run over') +
    '<div class="ar-over"><div class="ar-over-stage" data-mood="' + (good ? 'win' : result.tier === 0 ? 'lose' : 'ok') + '"><span class="ar-over-pet"></span></div>' +
    '<div class="ar-final"><small>Score</small><span class="ar-final-num"><b>' + result.score + '</b><span class="ar-count-up" aria-hidden="true"></span>' + (result.newBest ? '<span class="ar-newbest">' + (wasDaily ? 'Best today' : 'New best') + '</span>' : '') + '</span>' + (result.newBest ? '' : '<em>' + (wasDaily ? 'Best today ' : 'Best ') + result.best + '</em>') + '</div>' +
    '<div class="ar-medalrow"><div class="ar-tier" aria-label="' + result.tier + ' of 3">' + skulls(result.tier, 3) + '</div>' +
    (result.tier ? '<p class="ar-rank">' + esc(g.ranks[result.tier - 1]) + (result.newMedal ? ' · new medal' : '') + '</p>' : '<p class="ar-rank dim">' + (g.tiers[0] - result.score) + ' short of ' + esc(g.ranks[0]) + '</p>') + '</div>' +
    '<ul class="ar-stats">' + stats.map(([k, v]) => '<li><b>' + esc(v) + '</b><small>' + esc(k) + '</small></li>').join('') + '</ul>' +
    '<p class="ar-quip">' + esc(result.quip) + '</p>' + (result.bestLine ? '<p class="ar-bestline">' + esc(result.bestLine) + '</p>' : '') +
    '<ul class="mh-rewards">' + (result.souls ? '<li class="souls">' + arcadeGlyph('soul') + '+' + result.souls + ' souls</li>' : '<li>' + (result.score ? 'Today’s arcade purse is empty. Play for glory.' : 'No score, no souls.') + '</li>') +
    (result.daily?.bonus ? '<li class="souls">' + arcadeGlyph('soul') + '+' + result.daily.bonus + ' daily bonus' + (result.daily.streak > 1 ? ' · ' + result.daily.streak + ' days in a row' : '') + '</li>' : '') +
    (result.trust ? '<li class="good">' + esc(pet()?.name || '') + ' trusts you a little more</li>' : '') +
    result.unlocked.map(t => '<li class="good">Arena unlocked: ' + esc(t.title) + '</li>').join('') + '</ul>' +
    (wasDaily && result.daily && arcadeSocial?.active() ? BOARD_SLOT : '') +
    (escapadeView(S).active?.ready ? '<div class="ar-actions"><button class="btn btn-primary" type="button" data-escapade="open">Our story’s ending ↗</button></div>' : '') +
    '<div class="ar-actions"><button class="btn btn-primary ar-again" type="button" data-ar="' + (wasDaily ? 'challenge' : 'play') + '" disabled>Again</button><button class="btn" type="button" data-ar="menu">Other games</button><button class="btn btn-ghost" type="button" data-ar="close">Back to the shelf</button></div></div>';
  // The sound for the result: a record is a fanfare, a good run a bell for each skull.
  if (result.newBest) playAchievement(); else if (result.tier >= 1) playStar({ step: result.tier, priority: 'high' }); else playFeed();
  buzz(result.newBest ? 'best' : result.tier >= 1 ? 'skull' : 'tick', hapticsOn());
  const stage = sheet.querySelector('.ar-over-stage'), p = pet();
  if (p) {
    const sprite = renderPetSprite(p);
    sheet.querySelector('.ar-over-pet').appendChild(sprite);
    resultPuppet = createPuppet(sprite);
    const pose = () => resultPuppet?.gesture(good ? 'win' : result.tier === 0 ? 'confess' : 'boop');
    later(pose, 280);
    if (good) resultTimers.push(setInterval(pose, 1700));
  }
  // The number counts up under the real one, which is already there for anything that reads it.
  const numWrap = sheet.querySelector('.ar-final-num'), over = sheet.querySelector('.ar-count-up');
  const still = reduced || level >= 2 || result.score < 4;
  if (!still) {
    numWrap.classList.add('counting');
    countUp(over, result.score, { ms: Math.min(1100, 450 + result.score * 6), onDone: () => { numWrap.classList.remove('counting'); over.textContent = ''; } });
  }
  if (result.newBest || result.tier >= 1) {
    resultFx = createFx(stage, { level, haptics: hapticsOn });
    resultFx.resize(stage.clientWidth, stage.clientHeight);
    later(() => { resultFx?.burstPx('confetti', stage.clientWidth / 2, stage.clientHeight * 0.4, result.newBest ? 1.6 : 0.9); }, 420);
    if (result.newBest) later(() => resultFx?.burstPx('gold', stage.clientWidth / 2, stage.clientHeight * 0.45, 1.2), 900);
    let last = performance.now();
    const loop = now => { if (!resultFx) return; resultFx.update(Math.min(0.05, (now - last) / 1000)); last = now; raf = requestAnimationFrame(loop); };
    let raf = requestAnimationFrame(loop);
    resultTimers.push(() => cancelAnimationFrame(raf));
    later(() => cancelAnimationFrame(raf), 4200);
  }
  // A beat before Again is live, so the key mashing that ended the run does
  // not start another one by accident.
  const again = sheet.querySelector('.ar-again');
  setTimeout(() => { if (again?.isConnected) { again.disabled = false; again.focus({ preventScroll: true }); } }, 650);
  refresh();
  if (wasDaily && result.daily && arcadeSocial?.active()) loadBoard({ game: id, day: result.day, mod: result.daily.mod }, result.score);
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

// "Again" is quicker than the first start: a short count and straight back in.
function again(daily) { quickNext = true; startRun(daily); }

function inRun() { return run && run.phase !== 'dying'; }
function press(pad) {
  if (!inRun() || run.paused || run.id !== 'seance') return;
  beginPlay();
  run.view.press(run.A, pad);
}
function dropCoffin() {
  if (!inRun() || run.paused || run.id !== 'stack') return;
  beginPlay();
  run.view.drop(run.A);
}
function tapGrave(i) {
  if (!inRun() || run.paused || run.id !== 'whack' || run.phase === 'ready') return;
  run.view.hit(run.A, i);
}
function aim(field, e) {
  // The field does not move during a drag, so it is measured once per touch rather than once per move.
  const box = run.box || (run.box = field.getBoundingClientRect());
  run.game.target = Math.max(0, Math.min(1, (e.clientX - box.left) / box.width));
  run.game.dir = 0;
}

export function initArcade(state, onRefresh, { social } = {}) {
  S = state; refresh = onRefresh || refresh; arcadeSocial = social || null;
  // A read-only window onto the live run, so the browser tests can set up a late game without playing it.
  Object.defineProperty(sheet, 'arcadeRun', { configurable: true, get: () => run });
  initHapticsButton();
  window.addEventListener('shelflife:arcade', e => openArcade(e.detail?.game, e.detail?.petId));
  // Older invitations still say "play"; they now open the arcade menu.
  window.addEventListener('shelflife:play', e => openArcade(null, e.detail?.petId));
  sheet.addEventListener('click', e => {
    const card = e.target.closest('[data-ar-game]');
    if (card) { gameId = card.dataset.arGame; showIntro(); return; }
    const chip = e.target.closest('[data-ar-theme]');
    if (chip) {
      const a = arcadeState(S), t = THEME_BY_ID[chip.dataset.arTheme];
      if (t && themeUnlocked(a, t)) { a.theme = t.id; save(); sheet.style.cssText = themeVars(t); showMenu(); sheet.querySelector('[data-ar-theme="' + t.id + '"]')?.focus({ preventScroll: true }); }
      return;
    }
    const pad = e.target.closest('[data-pad]');
    if (pad && run?.id === 'seance') {
      // A touch already played this candle on pointer down; a key press or a click does it here.
      if (performance.now() - run.padDownAt > 500) press(Number(pad.dataset.pad));
      return;
    }
    const grave = e.target.closest('[data-hole]');
    if (grave && run?.id === 'whack') return; // handled on pointerdown for speed
    const action = e.target.closest('[data-ar]')?.dataset.ar;
    if (action === 'close') close();
    else if (action === 'play') { if (e.target.closest('.ar-again')) again(false); else startRun(false); }
    else if (action === 'challenge') { if (e.target.closest('.ar-again')) again(true); else startRun(true); }
    else if (action === 'menu') showMenu();
    else if (action === 'pause') pause(!run?.paused);
    else if (action === 'resume') pause(false);
    else if (action === 'drop') dropCoffin();
  });
  sheet.addEventListener('pointerdown', e => {
    if (!run || run.paused) return;
    const field = e.target.closest('[data-ar-field]');
    if (run.id === 'whack') {
      const grave = e.target.closest('[data-hole]');
      if (run.phase === 'ready' && (grave || field)) beginPlay();
      if (grave && !grave.getAttribute('aria-disabled')) { e.preventDefault(); tapGrave(Number(grave.dataset.hole)); }
      return;
    }
    if (run.id === 'seance') {
      const pad = e.target.closest('[data-pad]');
      if (pad) { e.preventDefault(); run.padDownAt = performance.now(); press(Number(pad.dataset.pad)); }
      else if (field && run.phase === 'ready' && !e.target.closest('.ar-paused')) beginPlay();
      return;
    }
    if (run.id === 'stack' && field && !e.target.closest('.ar-paused')) { e.preventDefault(); dropCoffin(); return; }
    if (run.id === 'frenzy') {
      const dir = e.target.closest('[data-ar-dir]');
      if (dir) { e.preventDefault(); beginPlay(); run.game.dir = Number(dir.dataset.arDir); run.game.target = null; dir.setPointerCapture?.(e.pointerId); return; }
      if (field && !e.target.closest('.ar-paused')) { e.preventDefault(); beginPlay(); run.box = null; aim(field, e); run.dragging = true; field.setPointerCapture?.(e.pointerId); }
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
    if (e.key === 'p' || e.key === 'P') { e.preventDefault(); pause(!run.paused); return; }
    if (run.paused || run.phase === 'dying') return;
    if (run.id === 'frenzy' && frenzyDirection(e.key) !== null) { e.preventDefault(); beginPlay(); run.game.target = null; run.game.dir = frenzyDirection(e.key); }
    else if (run.id === 'stack' && (e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); dropCoffin(); }
    else if (run.id === 'seance' && /^[1-4]$/.test(e.key) && !e.repeat) { e.preventDefault(); press(Number(e.key) - 1); }
    else if (run.id === 'whack' && /^[1-9]$/.test(e.key) && !e.repeat) {
      // Number keys follow the phone layout: 1 2 3 on the top row.
      e.preventDefault(); beginPlay(); tapGrave(Number(e.key) - 1);
    }
  });
  document.addEventListener('keyup', e => { if (run?.id === 'frenzy' && frenzyDirection(e.key) !== null) run.game.dir = 0; });
  document.addEventListener('visibilitychange', () => { if (document.hidden && run) pause(true); });
  // The installed app going to the background (src/native.js).
  window.addEventListener('shelflife:pause', () => { if (run) pause(true); });
  veil.addEventListener('click', e => { if (e.target === veil) close(); });
}

// The More tray's haptics switch. Phones that cannot vibrate never see it.
function initHapticsButton() {
  const btn = byId('hapticsBtn');
  if (!btn) return;
  const supported = typeof navigator.vibrate === 'function';
  btn.hidden = !supported;
  const paint = () => {
    const on = hapticsOn();
    btn.setAttribute('aria-pressed', String(on));
    const span = btn.querySelector('span'), small = btn.querySelector('small');
    if (span) span.textContent = on ? 'Haptics' : 'Haptics off';
    if (small) small.textContent = on ? 'Small buzzes in the arcade' : 'The arcade stays still';
  };
  paint();
  btn.addEventListener('click', () => {
    S.settings.haptics = !hapticsOn();
    save(); paint();
    buzz('perfect', hapticsOn());
  });
}
export const ARCADE_FRENZY = FRENZY;
export { FX_CAPS };

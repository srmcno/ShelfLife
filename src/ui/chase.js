import { newChase, updateChase, jumpChase, recordChase, chaseStars, streakMultiplier, CHASE_SECONDS, CHASE_WIDTH, CHASE_HEIGHT, CHASE_GROUND } from '../engine/chase.js';
import { moodOf } from '../engine/tick.js';
import { renderPetSprite } from '../art/sprite.js';
import { createPuppet } from '../art/animator.js';
import { playFeed, playFuss, playClean, playStomp, playPowerUp, playStar } from '../audio/sound.js';

const CRUMB = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 4 10-2 7 9-6 11L3 18 1 10Z" fill="currentColor"/><path d="m7 7 6-1m-5 9 5 2" stroke="#fff4cc" stroke-width="2" stroke-linecap="round"/></svg>';
const BUNNY = '<svg viewBox="0 0 40 34" aria-hidden="true"><path d="M7 18C-1 3 8-2 14 14 11-5 25-3 23 12 36 4 40 17 32 22c8 13-29 15-27 3Z" fill="#998399"/><path d="m4 21-4-3m5 8-5 2m34-9 5-3m-5 10 6 2" stroke="#cdbdce" stroke-width="2"/><circle cx="15" cy="22" r="3" fill="#261b2b"/><circle cx="26" cy="22" r="3" fill="#261b2b"/><path d="m19 29 4-1" stroke="#261b2b" stroke-width="2"/></svg>';

const MOTH = '<svg viewBox="0 0 40 30" aria-hidden="true"><path d="M19 15C12 2 2 4 3 12c1 7 8 10 16 6Z" fill="#cdb98f"/><path d="M21 15c7-13 17-11 16-3-1 7-8 10-16 6Z" fill="#cdb98f"/><path d="M19 15c-6 3-9 8-6 12 3 1 6 0 7-4Z" fill="#b39f78"/><path d="M21 15c6 3 9 8 6 12-3 1-6 0-7-4Z" fill="#b39f78"/><ellipse cx="20" cy="17" rx="3" ry="8" fill="#5a4a3c"/><path d="m18 10-4-6m8 6 4-6" stroke="#5a4a3c" stroke-width="1.5" stroke-linecap="round"/><circle cx="9" cy="11" r="2" fill="#5a4a3c"/><circle cx="31" cy="11" r="2" fill="#5a4a3c"/></svg>';
const BISCUIT = '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14" fill="#c98f4c"/><circle cx="16" cy="16" r="11" fill="none" stroke="#e2b276" stroke-width="2" stroke-dasharray="3 3"/><circle cx="11" cy="13" r="1.6" fill="#7a4a22"/><circle cx="19" cy="11" r="1.6" fill="#7a4a22"/><circle cx="21" cy="19" r="1.6" fill="#7a4a22"/><circle cx="13" cy="21" r="1.6" fill="#7a4a22"/><circle cx="27" cy="7" r="5" fill="#2a2230"/></svg>';
const SUGAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8l8-4 8 4-8 4Z" fill="#fbf8ff"/><path d="M4 8v9l8 4v-9Z" fill="#d9d0ec"/><path d="M20 8v9l-8 4v-9Z" fill="#bfb2dd"/><path d="m7 6 2-1M9 15v3m6-3v3" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".7"/></svg>';
const ART = { crumb: CRUMB, bunny: BUNNY, moth: MOTH, biscuit: BISCUIT, sugar: SUGAR };
// Deadpan end-screen copy. Short, dry, four inches tall.
const QUIPS = {
  lost: ['The crumbs remain at large.', 'It maintains the floor moved.', 'Nothing was lost except the crumbs. And the round.'],
  two: ['Adequate. It will not say so.', 'Serious work, four inches tall.', 'It will accept praise now. Briefly.'],
  three: ['Flawless. It will be unbearable about this.', 'Three stars. Nobody saw. It knows.', 'The dust has requested a meeting.'],
  best: ['A new record. The pride was already there.', 'The old best has been quietly disowned.', 'It would like this noted in the museum.']
};

export function createChaseUI(root, onFinish, onStatus) {
  const field = root.querySelector('#chaseField'), actor = root.querySelector('#chaseResident');
  const items = root.querySelector('#chaseItems'), shadow = root.querySelector('#chaseShadow');
  const overlay = root.querySelector('#chaseOverlay'), title = root.querySelector('#chaseHeading');
  const description = root.querySelector('#chaseDescription'), go = root.querySelector('#chaseGo');
  const pauseButton = root.querySelector('#chasePause'), hop = root.querySelector('#chaseHop');
  const count = root.querySelector('#chaseCount'), score = root.querySelector('#chaseScore'), time = root.querySelector('#chaseTime');
  const pop = root.querySelector('#chasePop'), tip = root.querySelector('#chaseTip'), fx = root.querySelector('#chaseFx');
  const best = root.querySelector('#chaseBest'), combo = root.querySelector('#chaseCombo'), comboLabel = root.querySelector('#chaseComboLabel'), comboBar = root.querySelector('#chaseComboBar');
  const stars = root.querySelector('#chaseStars'), quip = root.querySelector('#chaseQuip');
  const directions = [...root.querySelectorAll('[data-chase-direction]')];
  const controls = [...directions, hop];
  const nodes = new Map(), held = new Set();
  let pet = null, game = null, puppet = null, running = false, paused = false, gentle = false;
  let frameId = 0, lastTime = 0, targetX = null, pointerId = null;
  const resetInput = () => { held.clear(); targetX = null; pointerId = null; };
  const stopFrame = () => { cancelAnimationFrame(frameId); frameId = 0; running = false; resetInput(); };
  function disabled(value) { controls.forEach(b => { b.disabled = value; }); pauseButton.disabled = value; }
  function message(text, kind = '') { pop.textContent = text; pop.className = 'chase-pop ' + kind; void pop.offsetWidth; pop.classList.add('show'); }
  // One-shot effects: a floating score pop or a landing dust puff at a board position.
  function spark(kind, x, z, text = '') {
    const node = document.createElement('div'); node.className = 'chase-' + kind; node.textContent = text;
    node.style.left = x / CHASE_WIDTH * 100 + '%'; node.style.bottom = (CHASE_GROUND + z) / CHASE_HEIGHT * 100 + '%';
    fx.appendChild(node); setTimeout(() => node.remove(), kind === 'float' ? 900 : 500);
  }
  // A stomped bunny leaves the engine at once; its node stays behind just long enough to flatten.
  function squash(id) {
    const node = nodes.get(id); if (!node) return;
    nodes.delete(id); node.classList.add('squashed'); setTimeout(() => node.remove(), 480);
  }
  function shake() { field.classList.add('shake'); setTimeout(() => field.classList.remove('shake'), 350); }
  function tumbleOf(item) {
    if (item.kind === 'crumb') return item.age * 75;
    if (item.kind === 'biscuit') return item.age * 40;
    if (item.kind === 'moth') return Math.sin(item.age * 6) * 14;
    if (item.kind === 'sugar') return Math.sin(item.age * 4) * 8;
    return Math.sin(item.age * 13) * 10;
  }
  function paintCombo() {
    const mult = streakMultiplier(game.combo);
    comboBar.style.setProperty('--fill', String(mult >= 3 ? 1 : (game.combo % 4) / 4));
    comboLabel.textContent = game.combo ? 'Streak ' + game.combo + ' · ×' + mult : 'Streak';
    combo.classList.toggle('hot', mult >= 2); combo.classList.toggle('max', mult >= 3);
  }
  function paintItem(item) {
    let node = nodes.get(item.id);
    if (!node) {
      node = document.createElement('div'); node.className = 'chase-item ' + item.kind + (item.gold ? ' gold' : '');
      node.innerHTML = ART[item.kind] || CRUMB;
      node.setAttribute('aria-hidden', 'true'); node.dataset.kind = item.kind;
      nodes.set(item.id, node); items.appendChild(node);
    }
    node.style.left = item.x / CHASE_WIDTH * 100 + '%';
    node.style.bottom = (CHASE_GROUND + item.z) / CHASE_HEIGHT * 100 + '%';
    node.style.setProperty('--tumble', tumbleOf(item) + 'deg');
    if (item.kind === 'moth') node.classList.toggle('carrying', !!item.carrying);
    node.dataset.x = item.x.toFixed(2); node.dataset.z = item.z.toFixed(2);
  }
  function paint() {
    if (!game) return;
    const p = game.player;
    actor.style.left = p.x / CHASE_WIDTH * 100 + '%';
    actor.style.bottom = (CHASE_GROUND + p.z) / CHASE_HEIGHT * 100 + '%';
    actor.dataset.x = p.x.toFixed(2); actor.dataset.z = p.z.toFixed(2);
    actor.classList.toggle('protected', p.invincible > 0);
    field.classList.toggle('rush', running && game.rush > 0);
    shadow.style.left = p.x / CHASE_WIDTH * 100 + '%';
    shadow.style.scale = String(Math.max(.35, 1 - p.z / 170));
    shadow.style.opacity = String(Math.max(.1, .45 - p.z / 260));
    puppet.move(running && p.moving, p.direction, p.z > 3);
    count.textContent = game.caught + ' / ' + game.goal;
    count.classList.toggle('met', game.caught >= game.goal);
    score.textContent = String(game.score);
    best.textContent = pet?.chaseBest ? String(pet.chaseBest.score) : '–';
    best.classList.toggle('beaten', !!pet?.chaseBest && game.score > pet.chaseBest.score);
    time.textContent = Math.max(0, Math.ceil(CHASE_SECONDS - game.time)) + 's';
    time.classList.toggle('urgent', game.time > CHASE_SECONDS - 5);
    paintCombo();
    root.dataset.score = game.score; root.dataset.caught = game.caught;
    root.dataset.running = String(running); root.dataset.paused = String(paused);
    const present = new Set();
    for (const item of game.items) { present.add(item.id); paintItem(item); }
    for (const [id, node] of nodes) if (!present.has(id)) { node.remove(); nodes.delete(id); }
  }
  const pick = list => list[(game.score + game.caught) % list.length];
  function quipFor(rating, newBest) {
    if (!game.complete) return newBest ? 'A personal best, technically. The bar was on the floor.' : pick(QUIPS.lost);
    return pick(newBest ? QUIPS.best : rating === 3 ? QUIPS.three : QUIPS.two);
  }
  function summary(reward) {
    const n = (count, word) => count + ' ' + word + (count === 1 ? '' : 's');
    const line = n(game.caught, 'crumb') + ' · ' + n(game.dodged, 'dodge') + ' · ' + n(game.stomps, 'stomp') + ' · ' + n(game.score, 'point') + ' · best streak ' + game.bestCombo + '. ';
    if (!game.complete) return line + 'Reach ' + game.goal + ' crumbs to win. Nothing on your shelf was lost.';
    return line + (reward?.practice ? 'Practice complete. Your best still counts.' : '+' + (reward?.fuss || 0) + ' attention · +' + (reward?.bond || 0) + ' trust.');
  }
  function showStars(rating) {
    stars.replaceChildren(...[1, 2, 3].map(n => { const s = document.createElement('span'); s.textContent = '★'; s.classList.toggle('lit', n <= rating); return s; }));
    stars.setAttribute('aria-label', rating + ' of 3 stars'); stars.hidden = false;
  }
  function statusFor(rating, newBest) {
    if (!game.complete) return 'Chase over. Jump over dust bunnies to keep your streak, or land on one to stomp it. Gentle play gives wider catches and slower bunnies.';
    return 'Chase complete: ' + rating + ' of 3 stars' + (newBest ? ', a new personal best' : '') + '. Best streak ' + game.bestCombo + '.';
  }
  function finish() {
    stopFrame(); paused = false; root.dataset.finished = 'true'; disabled(true);
    const newBest = recordChase(pet, game), reward = onFinish(game), rating = chaseStars(game);
    paint();
    title.textContent = game.complete ? (newBest ? 'A new personal best!' : rating === 3 ? 'Three stars. Insufferable.' : 'Crumb bandit.') : 'One more chase?';
    description.textContent = summary(reward);
    showStars(rating); quip.textContent = quipFor(rating, newBest); quip.hidden = false;
    overlay.classList.toggle('best', newBest);
    if (game.complete) { puppet.gesture('win'); playFuss(); playStar({ step: rating, delay: .3 }); }
    else if (newBest) playStar({ step: 1 });
    go.textContent = 'Chase again'; overlay.hidden = false; go.focus({ preventScroll: true });
    onStatus(statusFor(rating, newBest));
  }
  function onCatch(event) {
    puppet.gesture('catch'); playFeed();
    const mult = streakMultiplier(game.combo);
    const label = event.kind === 'moth' ? 'Moth caught! ' : event.kind === 'biscuit' ? 'Whole biscuit! ' : event.air ? 'Air catch! ' : event.gold ? 'Golden crumb! ' : '';
    spark('float', event.x, event.z, '+' + event.points);
    message(label + '+' + event.points + (mult > 1 ? ' · streak ×' + mult : ''), 'good');
  }
  function onPowerUp(event) {
    playPowerUp(); spark('float', event.x, event.z, 'Sugar!');
    message('Sugar rush! ' + event.seconds + 's of speed and pull', 'good');
    onStatus('Sugar rush: faster steering, and crumbs drift toward you for ' + event.seconds + ' seconds.');
  }
  function react(event) {
    const p = game.player;
    if (event.type === 'catch') onCatch(event);
    else if (event.type === 'stomp') { puppet.gesture('jump'); playStomp(); squash(event.id); spark('float', event.x, event.z + 12, '+' + event.points); message((event.tail ? 'Stomp! Tail bounce ' : 'Stomp! ') + '+' + event.points, 'good'); }
    else if (event.type === 'bump') { puppet.gesture('bump'); playClean(); shake(); message('Dust ambush! −5 · jump over them', 'bad'); }
    else if (event.type === 'shield') { puppet.gesture('shield'); message('Horn block! Unbothered.', 'good'); }
    else if (event.type === 'dodge') { spark('float', p.x, p.z + 40, '+' + event.points); message('Clean jump! +' + event.points, 'good'); }
    else if (event.type === 'land') spark('puff', event.x, 0);
    else if (event.type === 'steal') { spark('puff', event.x, event.z); message('A moth took that one.', 'bad'); }
    else if (event.type === 'crumble') { spark('puff', event.x, 0); message('The biscuit crumbled. Unclaimed.', ''); }
    else if (event.type === 'melt') spark('puff', event.x, 0);
    else if (event.type === 'powerup') onPowerUp(event);
  }
  function frame(now) {
    if (!running) return;
    const axis = Number(held.has('right')) - Number(held.has('left'));
    const events = updateChase(game, { axis, targetX: axis ? null : targetX }, (now - lastTime) / 1000);
    lastTime = now;
    for (const event of events) {
      if (event.type === 'finish') { finish(); return; }
      react(event);
    }
    paint(); frameId = requestAnimationFrame(frame);
  }
  function run() {
    running = true; paused = false; resetInput(); overlay.hidden = true; disabled(false);
    lastTime = performance.now(); frameId = requestAnimationFrame(frame);
    field.focus({ preventScroll: true });
    onStatus('Collect ' + game.goal + ' crumbs. Jump over dust bunnies or land on them to stomp; airborne catches and streaks score extra.');
  }
  function start() {
    if (!pet || root.hidden) return;
    stopFrame(); game = newChase(pet, { gentle, mood: moodOf(pet) });
    root.dataset.finished = 'false'; pop.textContent = ''; stars.hidden = true; quip.hidden = true;
    overlay.classList.remove('best'); fx.replaceChildren(); paint(); run();
  }
  function pause() {
    if (!running) return;
    stopFrame(); paused = true; disabled(true); paint();
    title.textContent = 'The crumbs can wait.'; description.textContent = 'Paused. Your score and remaining time are safe.';
    go.textContent = 'Resume chase'; overlay.hidden = false; go.focus({ preventScroll: true });
    onStatus('Paused. Resume whenever you are ready.');
  }
  function jump() { if (running && jumpChase(game)) { puppet.gesture('jump'); if (navigator.vibrate) navigator.vibrate(8); } }
  function moveTo(e) {
    const box = field.getBoundingClientRect();
    targetX = Math.max(26, Math.min(294, (e.clientX - box.left) / box.width * CHASE_WIDTH));
  }
  field.addEventListener('pointerdown', e => {
    if (!running || e.button !== 0 || e.target.closest('button')) return;
    e.preventDefault(); pointerId = e.pointerId; field.setPointerCapture(e.pointerId); moveTo(e);
  });
  field.addEventListener('pointermove', e => { if (running && e.pointerId === pointerId) moveTo(e); });
  field.addEventListener('pointerup', e => { if (e.pointerId === pointerId) pointerId = null; });
  field.addEventListener('pointercancel', () => { pointerId = null; targetX = null; });
  directions.forEach(button => {
    const dir = button.dataset.chaseDirection;
    button.addEventListener('pointerdown', e => { if (!running) return; e.preventDefault(); held.add(dir); targetX = null; button.setPointerCapture(e.pointerId); });
    for (const name of ['pointerup','pointercancel','lostpointercapture']) button.addEventListener(name, () => held.delete(dir));
    button.addEventListener('click', e => { if (running && e.detail === 0) targetX = game.player.x + (dir === 'left' ? -55 : 55); });
  });
  hop.addEventListener('click', jump);
  go.addEventListener('click', () => { if (paused) run(); else start(); });
  pauseButton.addEventListener('click', pause);
  document.addEventListener('keydown', e => {
    const typing = e.target?.nodeType === 1 && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName);
    // Space and Enter on a focused button stay a click, so Hop, ← and → keep working from the keyboard.
    const onButton = e.target?.nodeType === 1 && !!e.target.closest('button') && [' ', 'Enter'].includes(e.key);
    if (!running || root.hidden || typing || onButton || e.repeat && [' ','ArrowUp','w','W'].includes(e.key)) return;
    if (['ArrowLeft','a','A'].includes(e.key)) { held.add('left'); targetX = null; e.preventDefault(); }
    if (['ArrowRight','d','D'].includes(e.key)) { held.add('right'); targetX = null; e.preventDefault(); }
    if ([' ','ArrowUp','w','W'].includes(e.key)) { jump(); e.preventDefault(); }
    if (e.key === 'p' || e.key === 'P') { pause(); e.preventDefault(); }
  });
  document.addEventListener('keyup', e => {
    if (['ArrowLeft','a','A'].includes(e.key)) held.delete('left');
    if (['ArrowRight','d','D'].includes(e.key)) held.delete('right');
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('blur', pause);
  return {
    prepare(resident, useGentle) {
      stopFrame(); puppet?.release(); paused = false; pet = resident; gentle = useGentle;
      game = newChase(pet, { gentle, mood: moodOf(pet) });
      actor.replaceChildren(renderPetSprite(pet)); actor.firstElementChild.classList.add('sl-mood-content');
      puppet = createPuppet(actor.firstElementChild);
      title.textContent = 'The crumbs are escaping.';
      description.textContent = 'Steer ' + pet.name + '. Catch ' + game.goal + ' crumbs in 22 seconds. Jump over the dust bunnies, or land on them.';
      go.textContent = 'Let’s chase'; overlay.hidden = false; disabled(true);
      hop.textContent = game.wings ? 'Flap ↑' : 'Hop ↑';
      const trait = game.wings ? 'Wings: tap Flap again in midair.' : game.horns ? 'Horns block your first dust ambush.' : game.halo ? 'Your halo pulls nearby crumbs closer.' : game.tail ? 'Tail: a bigger stomp bounce.' : 'Keyboard: arrows + Space.';
      const record = pet.chaseBest ? ' Best: ' + pet.chaseBest.score + (pet.chaseBest.stars ? ' · ' + pet.chaseBest.stars + '★' : '') + '.' : '';
      tip.textContent = 'Drag to steer or hold ← →. Land on a dust bunny to stomp it; jump clear to dodge. ' + trait + record;
      stars.hidden = true; quip.hidden = true; overlay.classList.remove('best'); fx.replaceChildren();
      pop.textContent = ''; paint();
    },
    stop() { stopFrame(); paused = false; puppet?.release(); },
    pause
  };
}

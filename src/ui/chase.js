import { newChase, updateChase, jumpChase, recordChase, CHASE_SECONDS, CHASE_WIDTH, CHASE_HEIGHT, CHASE_GROUND } from '../engine/chase.js';
import { renderPetSprite } from '../art/sprite.js';
import { createPuppet } from '../art/animator.js';
import { playFeed, playFuss, playClean } from '../audio/sound.js';

const CRUMB = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 4 10-2 7 9-6 11L3 18 1 10Z" fill="currentColor"/><path d="m7 7 6-1m-5 9 5 2" stroke="#fff4cc" stroke-width="2" stroke-linecap="round"/></svg>';
const BUNNY = '<svg viewBox="0 0 40 34" aria-hidden="true"><path d="M7 18C-1 3 8-2 14 14 11-5 25-3 23 12 36 4 40 17 32 22c8 13-29 15-27 3Z" fill="#998399"/><path d="m4 21-4-3m5 8-5 2m34-9 5-3m-5 10 6 2" stroke="#cdbdce" stroke-width="2"/><circle cx="15" cy="22" r="3" fill="#261b2b"/><circle cx="26" cy="22" r="3" fill="#261b2b"/><path d="m19 29 4-1" stroke="#261b2b" stroke-width="2"/></svg>';

export function createChaseUI(root, onFinish, onStatus) {
  const field = root.querySelector('#chaseField'), actor = root.querySelector('#chaseResident');
  const items = root.querySelector('#chaseItems'), shadow = root.querySelector('#chaseShadow');
  const overlay = root.querySelector('#chaseOverlay'), title = root.querySelector('#chaseHeading');
  const description = root.querySelector('#chaseDescription'), go = root.querySelector('#chaseGo');
  const pauseButton = root.querySelector('#chasePause'), hop = root.querySelector('#chaseHop');
  const count = root.querySelector('#chaseCount'), score = root.querySelector('#chaseScore'), time = root.querySelector('#chaseTime');
  const pop = root.querySelector('#chasePop'), tip = root.querySelector('#chaseTip');
  const directions = [...root.querySelectorAll('[data-chase-direction]')];
  const controls = [...directions, hop];
  const nodes = new Map(), held = new Set();
  let pet = null, game = null, puppet = null, running = false, paused = false, gentle = false;
  let frameId = 0, lastTime = 0, targetX = null, pointerId = null;
  const resetInput = () => { held.clear(); targetX = null; pointerId = null; };
  const stopFrame = () => { cancelAnimationFrame(frameId); frameId = 0; running = false; resetInput(); };
  function disabled(value) { controls.forEach(b => { b.disabled = value; }); pauseButton.disabled = value; }
  function message(text, kind = '') { pop.textContent = text; pop.className = 'chase-pop ' + kind; void pop.offsetWidth; pop.classList.add('show'); }
  function paint() {
    if (!game) return;
    const p = game.player;
    actor.style.left = p.x / CHASE_WIDTH * 100 + '%';
    actor.style.bottom = (CHASE_GROUND + p.z) / CHASE_HEIGHT * 100 + '%';
    actor.dataset.x = p.x.toFixed(2); actor.dataset.z = p.z.toFixed(2);
    actor.classList.toggle('protected', p.invincible > 0);
    shadow.style.left = p.x / CHASE_WIDTH * 100 + '%';
    shadow.style.scale = String(Math.max(.35, 1 - p.z / 170));
    shadow.style.opacity = String(Math.max(.1, .45 - p.z / 260));
    puppet.move(running && p.moving, p.direction, p.z > 3);
    count.textContent = game.caught + ' / ' + game.goal;
    count.classList.toggle('met', game.caught >= game.goal);
    score.textContent = String(game.score);
    time.textContent = Math.max(0, Math.ceil(CHASE_SECONDS - game.time)) + 's';
    time.classList.toggle('urgent', game.time > CHASE_SECONDS - 5);
    root.dataset.score = game.score; root.dataset.caught = game.caught;
    root.dataset.running = String(running); root.dataset.paused = String(paused);
    const present = new Set();
    for (const item of game.items) {
      present.add(item.id);
      let node = nodes.get(item.id);
      if (!node) {
        node = document.createElement('div'); node.className = 'chase-item ' + item.kind + (item.gold ? ' gold' : '');
        node.innerHTML = item.kind === 'crumb' ? CRUMB : BUNNY;
        node.setAttribute('aria-hidden', 'true'); node.dataset.kind = item.kind;
        nodes.set(item.id, node); items.appendChild(node);
      }
      node.style.left = item.x / CHASE_WIDTH * 100 + '%';
      node.style.bottom = (CHASE_GROUND + item.z) / CHASE_HEIGHT * 100 + '%';
      node.style.setProperty('--tumble', (item.kind === 'crumb' ? item.age * 75 : Math.sin(item.age * 13) * 10) + 'deg');
      node.dataset.x = item.x.toFixed(2); node.dataset.z = item.z.toFixed(2);
    }
    for (const [id, node] of nodes) if (!present.has(id)) { node.remove(); nodes.delete(id); }
  }
  function finish() {
    stopFrame(); paused = false; root.dataset.finished = "true"; disabled(true); paint();
    const best = recordChase(pet, game);
    const reward = onFinish(game);
    title.textContent = game.complete ? (best ? 'A new personal best!' : 'Crumb bandit.') : 'One more chase?';
    description.textContent = game.caught + ' crumbs · ' + game.dodged + ' dodges · ' + game.score + ' points. ' +
      (game.complete ? (reward?.practice ? 'Practice complete. Your best still counts.' : '+' + (reward?.fuss || 0) + ' attention · +' + (reward?.bond || 0) + ' trust.') : 'Reach ' + game.goal + ' crumbs to win. Nothing on your shelf was lost.');
    if (game.complete) { puppet.gesture('win'); playFuss(); }
    go.textContent = 'Chase again'; overlay.hidden = false; go.focus({ preventScroll: true });
    onStatus(game.complete ? 'Chase complete. Try for a longer streak or a new best.' : 'Jump over dust bunnies to keep your streak. Gentle play gives wider catches and slower bunnies.');
  }
  function frame(now) {
    if (!running) return;
    const axis = Number(held.has('right')) - Number(held.has('left'));
    const events = updateChase(game, { axis, targetX: axis ? null : targetX }, (now - lastTime) / 1000);
    lastTime = now;
    for (const event of events) {
      if (event.type === 'catch') {
        puppet.gesture('catch'); playFeed();
        message((event.air ? 'Air catch! ' : event.gold ? 'Golden crumb! ' : '') + '+' + event.points + (game.combo >= 4 ? ' · streak ×' + Math.min(3, 1 + Math.floor(game.combo / 4)) : ''), 'good');
      } else if (event.type === 'bump') { puppet.gesture('bump'); playClean(); message('Dust ambush! −5 · jump over them', 'bad'); }
      else if (event.type === 'shield') { puppet.gesture('shield'); message('Horn block! Unbothered.', 'good'); }
      else if (event.type === 'dodge') { message('Clean jump! +15', 'good'); }
      else if (event.type === 'finish') { finish(); return; }
    }
    paint(); frameId = requestAnimationFrame(frame);
  }
  function run() {
    running = true; paused = false; resetInput(); overlay.hidden = true; disabled(false);
    lastTime = performance.now(); frameId = requestAnimationFrame(frame);
    field.focus({ preventScroll: true });
    onStatus('Collect ' + game.goal + ' crumbs. Jump over dust bunnies; airborne catches and streaks score extra.');
  }
  function start() {
    if (!pet || root.hidden) return;
    stopFrame(); game = newChase(pet, { gentle });
    root.dataset.finished = 'false'; pop.textContent = ''; paint(); run();
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
    if (!running || root.hidden || typing || e.repeat && [' ','ArrowUp','w','W'].includes(e.key)) return;
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
      game = newChase(pet, { gentle });
      actor.replaceChildren(renderPetSprite(pet)); actor.firstElementChild.classList.add('sl-mood-content');
      puppet = createPuppet(actor.firstElementChild);
      title.textContent = 'The crumbs are escaping.';
      description.textContent = 'Steer ' + pet.name + '. Catch ' + game.goal + ' crumbs in 22 seconds. Jump over the dust bunnies.';
      go.textContent = 'Let’s chase'; overlay.hidden = false; disabled(true);
      hop.textContent = game.wings ? 'Flap ↑' : 'Hop ↑';
      tip.textContent = 'Drag to steer or hold ← →. ' + (game.wings ? 'Wings: tap Flap again in midair.' : game.horns ? 'Horns block your first dust ambush.' : game.halo ? 'Your halo pulls nearby crumbs closer.' : 'Tap Hop to jump. Keyboard: arrows + Space.') + (pet.chaseBest ? ' Best: ' + pet.chaseBest.score + '.' : '');
      pop.textContent = ''; paint();
    },
    stop() { stopFrame(); paused = false; puppet?.release(); },
    pause
  };
}

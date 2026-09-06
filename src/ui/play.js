import { GESTURES, newHandshake, tapHandshake, rewardHandshake, playWait } from '../engine/play.js';
import { isAsleep } from '../engine/tick.js';
import { renderPetSprite } from '../art/sprite.js';
import { createPuppet } from '../art/animator.js';
import { createChaseUI } from './chase.js';
import { playFuss } from '../audio/sound.js';
import { save } from '../state.js';
import { checkUnlocks } from '../engine/unlocks.js';
import { checkAchievements } from '../engine/achievements.js';

export function initPlay(state, refresh) {
  const veil = document.getElementById('playVeil'), host = document.getElementById('playPortrait');
  const status = document.getElementById('playStatus'), cue = document.getElementById('playCue');
  const start = document.getElementById('playStart'), replay = document.getElementById('playReplay');
  const chaseRoot = document.getElementById('chaseArea'), gentle = document.getElementById('playRelaxed');
  const pads = [...veil.querySelectorAll('[data-gesture]')], modeButtons = [...veil.querySelectorAll('[data-play-mode]')];
  let game = null, pet = null, puppet = null, accepting = false, generation = 0, mode = 'chase';
  function reward(finished) {
    const result = rewardHandshake(state, finished);
    checkUnlocks(state); checkAchievements(state); save(); refresh();
    document.getElementById('playReward').textContent = 'Games share a 5-minute reward rest per resident. Practice and personal bests are always available.';
    return result;
  }
  const chase = createChaseUI(chaseRoot, reward, text => { status.textContent = text; });
  function setMode(next) {
    generation++; chase.stop(); puppet?.release(); puppet = null;
    mode = next; game = mode === 'memory' ? newHandshake(pet) : null; lock(true);
    modeButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.playMode === mode)));
    pads.forEach(p => p.classList.remove('lit'));
    veil.classList.toggle('chase-mode', mode === 'chase');
    chaseRoot.hidden = mode !== 'chase'; document.getElementById('gentleOption').hidden = mode !== 'chase';
    start.hidden = false; replay.hidden = true; start.textContent = 'Learn the handshake';
    document.getElementById('playTitle').textContent = mode === 'chase' ? 'Crumb Chase' : 'Secret handshake';
    document.getElementById('playName').textContent = (mode === 'chase' ? 'On the loose with ' : 'A secret with ') + pet.name;
    cue.textContent = 'They have been rehearsing.';
    status.textContent = mode === 'chase' ? 'You steer. They chase. Keep a streak, catch golden crumbs, and jump over dust bunnies.' : 'Watch your resident perform the gestures, then tap them in order. A wrong tap just means another try.';
    document.getElementById('playReward').textContent = playWait(pet) || isAsleep(pet) ? 'Practice round · rewards return when rested and awake.' : 'Win for up to +24 attention and +1 trust.';
    host.replaceChildren();
    if (mode === 'chase') chase.prepare(pet, gentle.checked);
    else { host.appendChild(renderPetSprite(pet)); host.firstElementChild.classList.add('sl-mood-content'); puppet = createPuppet(host.firstElementChild); progress(); }
  }
  modeButtons.forEach(b => b.addEventListener('click', () => setMode(b.dataset.playMode)));
  gentle.addEventListener('change', () => { if (pet && mode === 'chase') setMode('chase'); });
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  function lock(locked) { accepting = !locked; pads.forEach(p => p.setAttribute('aria-disabled', String(locked))); }
  function progress() {
    document.getElementById('playProgress').textContent = 'Round ' + Math.min(3, game.round + 1) + ' of 3';
    veil.querySelectorAll('.play-step').forEach((el, i) => el.classList.toggle('done', i < game.round));
  }
  async function demonstrate() {
    const token = ++generation;
    lock(true); replay.disabled = true; progress();
    status.textContent = 'Watch ' + pet.name + '. Then repeat their gestures.';
    const sequence = game.sequence.slice(0, game.round + 2);
    cue.textContent = 'Watch…';
    document.getElementById('playAnnouncement').textContent = 'Remember: ' + sequence.map(i => GESTURES[i]).join(', ');
    await wait(650);
    for (const gesture of sequence) {
      if (token !== generation) return;
      pads[gesture].classList.add('lit'); cue.textContent = GESTURES[gesture];
      puppet.gesture(GESTURES[gesture].toLowerCase());
      await wait(700);
      if (token !== generation) return;
      pads[gesture].classList.remove('lit'); cue.textContent = '·'; await wait(220);
    }
    if (token !== generation) return;
    cue.textContent = 'Your turn'; status.textContent = 'Repeat ' + sequence.length + ' gestures. Take your time.';
    document.getElementById('playAnnouncement').textContent = 'Your turn. Repeat the pattern.';
    lock(false); replay.disabled = false; pads[0].focus({ preventScroll: true });
  }
  function close() {
    generation++; lock(true); game = null; chase.stop(); puppet?.release(); puppet = null;
    pads.forEach(p => p.classList.remove('lit')); veil.classList.remove('open');
  }
  document.getElementById('playClose').addEventListener('click', close);
  veil.addEventListener('click', e => { if (e.target === veil) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  document.addEventListener('visibilitychange', () => {
    if (mode !== 'memory' || !document.hidden || !game || game.complete || !veil.classList.contains('open')) return;
    generation++; lock(true); game.cursor = 0; pads.forEach(p => p.classList.remove('lit'));
    status.textContent = 'Paused. Replay the pattern when you are ready.'; cue.textContent = 'Take your time'; replay.disabled = false;
  });
  window.addEventListener('shelflife:play', e => {
    pet = state.pets.find(p => p.id === e.detail?.petId);
    if (!pet) return;
    setMode(e.detail?.mode === 'memory' ? 'memory' : 'chase'); veil.classList.add('open');
  });
  function conclude() {
    lock(true); replay.disabled = true;
    const result = reward(game); progress();
    cue.textContent = 'You are in the club.';
    status.textContent = result && !result.practice ? '+' + result.fuss + ' attention · +' + result.bond + ' trust. They will deny enjoying that.' : 'Practice complete. They insist they were letting you win.';
    puppet.gesture('win'); playFuss();
    start.hidden = false; start.textContent = 'Play again for practice'; replay.hidden = true; start.focus({ preventScroll: true });
  }
  start.addEventListener('click', () => { if (!game || game.complete) game = newHandshake(pet); start.hidden = true; replay.hidden = false; demonstrate(); });
  replay.addEventListener('click', () => { if (game && !game.complete) { game.cursor = 0; demonstrate(); } });
  pads.forEach((pad, i) => pad.addEventListener('click', () => {
    if (!accepting || !game) return;
    const result = tapHandshake(game, i); cue.textContent = GESTURES[i];
    puppet.gesture(result === 'retry' ? 'bump' : GESTURES[i].toLowerCase());
    if (navigator.vibrate) navigator.vibrate(8);
    if (result === 'retry') { lock(true); cue.textContent = 'Nearly. They insist.'; status.textContent = 'No points lost. Replay the pattern and try again.'; return; }
    if (result === 'correct') { status.textContent = game.cursor + ' remembered. Keep going.'; return; }
    lock(true); replay.disabled = true;
    if (result === 'round') demonstrate();
    if (result === 'complete') conclude();
  }));
}

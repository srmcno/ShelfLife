import { artPersonality } from '../engine/personality.js';
import { GESTURES, newHandshake, tapHandshake, rewardHandshake, playWait, newDustPatrol, nextDust, catchDust, finishDust } from '../engine/play.js';
import { isAsleep } from '../engine/tick.js';
import { renderPetSprite } from '../art/sprite.js';
import { reactTo } from '../art/animator.js';
import { playFuss } from '../audio/sound.js';
import { save } from '../state.js';
import { checkUnlocks } from '../engine/unlocks.js';
import { checkAchievements } from '../engine/achievements.js';

export function initPlay(state, refresh) {
  const veil = document.getElementById('playVeil'), host = document.getElementById('playPortrait');
  const status = document.getElementById('playStatus'), cue = document.getElementById('playCue');
  const start = document.getElementById('playStart'), replay = document.getElementById('playReplay');
  const pads = [...veil.querySelectorAll('[data-gesture]')];
  let game = null, pet = null, accepting = false, generation = 0, mode = 'memory';
  const padMarkup = pads.map(p => p.innerHTML);
  const modeButtons = [...veil.querySelectorAll('[data-play-mode]')];
  const makeGame = () => mode === 'dust' ? newDustPatrol(pet) : newHandshake(pet);
  function setMode(next) {
    generation++; mode = next; game = makeGame(); lock(true);
    modeButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.playMode === mode)));
    pads.forEach((p, i) => { p.classList.remove('lit'); p.innerHTML = mode === 'dust' ? '<span class="dust-glyph" aria-hidden="true">✦</span><span>Spot ' + (i + 1) + '</span>' : padMarkup[i]; });
    veil.classList.toggle('dust-mode', mode === 'dust');
    start.hidden = false; replay.hidden = true;
    start.textContent = mode === 'dust' ? 'Start dust patrol' : 'Learn the handshake';
    const art = artPersonality(pet);
    document.getElementById('playTitle').textContent = mode === 'dust' ? (art.halo ? 'Polish the halo' : art.horns ? 'Horn patrol' : 'Dust patrol') : 'Secret handshake';
    cue.textContent = mode === 'dust' ? (art.motion.canFlap ? 'Wingbeats scatter the evidence.' : 'The lint is making a break for it.') : 'They have been rehearsing.';
    status.textContent = mode === 'dust' ? 'Catch 6 of 12 glowing dust specks. Tap the lit spot. About 15 seconds; missed taps cost nothing.' : 'Remember the gestures, then tap them in order. A wrong tap just means another try.';
    document.getElementById('playReward').textContent = playWait(pet) || isAsleep(pet) ? 'Practice round · rewards return when rested and awake.' : 'Finish for up to +24 ' + (mode === 'dust' ? 'cleanliness' : 'attention') + ' and +1 trust.';
    progress();
  }
  modeButtons.forEach(b => b.addEventListener('click', () => setMode(b.dataset.playMode)));
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  function lock(locked) { accepting = !locked; pads.forEach(p => p.setAttribute('aria-disabled', String(locked))); }
  function progress() {
    document.getElementById('playProgress').textContent = mode === 'dust' ? game.hits + ' / 6 caught · ' + game.round + ' / 12 specks' : 'Round ' + Math.min(3, game.round + 1) + ' of 3';
    veil.querySelectorAll('.play-step').forEach((el, i) => el.classList.toggle('done', i < (mode === 'dust' ? Math.floor(game.hits / 2) : game.round)));
  }
  async function demonstrate() {
    const token = ++generation;
    lock(true); replay.disabled = true; progress();
    status.textContent = 'Watch their pattern. Then repeat it.';
    const sequence = game.sequence.slice(0, game.round + 2);
    cue.textContent = 'Watch…';
    document.getElementById('playAnnouncement').textContent = 'Remember: ' + sequence.map(i => GESTURES[i]).join(', ');
    await wait(650);
    for (const gesture of sequence) {
      if (token !== generation) return;
      const pad = pads[gesture];
      pad.classList.add('lit'); cue.textContent = GESTURES[gesture];
      await wait(700);
      if (token !== generation) return;
      pad.classList.remove('lit'); cue.textContent = '·';
      await wait(220);
    }
    if (token !== generation) return;
    cue.textContent = 'Your turn'; status.textContent = 'Repeat ' + sequence.length + ' gestures. Take your time.';
    document.getElementById('playAnnouncement').textContent = 'Your turn. Repeat the pattern.';
    lock(false); replay.disabled = false;
    pads[0].focus({ preventScroll: true });
  }
  function close() {
    generation++; lock(true); game = null;
    pads.forEach(p => p.classList.remove('lit'));
    veil.classList.remove('open');
  }
  document.getElementById('playClose').addEventListener('click', close);
  veil.addEventListener('click', e => { if (e.target === veil) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden || !game || game.complete || !veil.classList.contains('open')) return;
    generation++; lock(true); game.cursor = 0;
    pads.forEach(p => p.classList.remove('lit'));
    status.textContent = mode === 'dust' ? 'Paused. Restart dust patrol when you are ready. No penalty.' : 'Paused. Replay the pattern when you are ready.';
    if (mode === 'dust') { start.hidden = false; start.textContent = 'Restart dust patrol'; }
    cue.textContent = 'Take your time'; replay.disabled = false;
  });
  window.addEventListener('shelflife:play', e => {
    pet = state.pets.find(p => p.id === e.detail?.petId);
    if (!pet) return;
    setMode('memory');
    document.getElementById('playName').textContent = 'A secret with ' + pet.name;
    host.replaceChildren(renderPetSprite(pet));
    host.firstElementChild.classList.add('sl-mood-content');
    veil.classList.add('open');
  });
  function conclude() {
    lock(true); replay.disabled = true;
    const reward = rewardHandshake(state, game);
    checkUnlocks(state); checkAchievements(state); save(); refresh(); progress();
    cue.textContent = mode === 'dust' ? 'Immaculately unreasonable.' : 'You are in the club.';
    status.textContent = reward && !reward.practice ? '+' + reward.fuss + ' ' + (mode === 'dust' ? 'cleanliness' : 'attention') + ' · +' + reward.bond + ' trust. They will deny enjoying that.' : 'Practice complete. They insist they were letting you win.';
    host.classList.remove('celebrate'); void host.offsetWidth; host.classList.add('celebrate');
    reactTo(pet.id, mode === 'dust' ? 'clean' : 'fuss'); playFuss();
    start.hidden = false; start.textContent = 'Play again for practice'; replay.hidden = true;
    document.getElementById('playReward').textContent = 'Both games share a 5-minute reward rest per resident. Practice anytime.';
    start.focus({ preventScroll: true });
  }
  async function dustPatrol() {
    const token = ++generation;
    replay.disabled = true; replay.hidden = true;
    game = newDustPatrol(pet); lock(false);
    const relaxed = document.getElementById('playRelaxed').checked;
    const delay = artPersonality(pet).motion.canFlap ? 1000 : pet.traits.includes('nocturnal') ? 1400 : 1200;
    status.textContent = relaxed ? 'Take your time. Catch each speck to reveal the next.' : 'Tap the glowing speck. Six catches wins; no penalty for misses.';
    while (game && nextDust(game)) {
      if (token !== generation) return;
      pads.forEach(p=>p.classList.remove('lit'));
      pads[game.target].classList.add('lit');
      cue.textContent = 'Spot ' + (game.target + 1); progress();
      if (relaxed) {
        while (token === generation && game && !game.caught) await wait(100);
      } else await wait(delay);
      if (token !== generation) return;
    }
    pads.forEach(p=>p.classList.remove('lit')); lock(true);
    if (finishDust(game)) conclude();
    else { status.textContent = game.hits + ' caught. The lint won this one. Try again, or switch on relaxed play.'; cue.textContent = 'The dust is celebrating.'; start.hidden = false; start.textContent = 'Try dust patrol again'; }
  }
  start.addEventListener('click', () => {
    if (!game || game.complete) game = makeGame();
    start.hidden = true; replay.hidden = false;
    if (mode === 'dust') dustPatrol(); else demonstrate();
  });
  replay.addEventListener('click', () => { if (game && !game.complete) { game.cursor = 0; if (mode === 'dust') dustPatrol(); else demonstrate(); } });
  pads.forEach((pad, i) => pad.addEventListener('click', () => {
    if (!accepting || !game) return;
    if (mode === 'dust') {
      if (catchDust(game, i)) { pad.classList.remove('lit'); cue.textContent = 'Caught!'; progress(); if (navigator.vibrate) navigator.vibrate(8); }
      return;
    }
    const result = tapHandshake(game, i);
    cue.textContent = GESTURES[i];
    if (navigator.vibrate) navigator.vibrate(8);
    if (result === 'retry') {
      lock(true); cue.textContent = 'Nearly. They insist.';
      status.textContent = 'No points lost. Replay the pattern and try again.';
      return;
    }
    if (result === 'correct') { status.textContent = game.cursor + ' remembered. Keep going.'; return; }
    lock(true); replay.disabled = true;
    if (result === 'round') { demonstrate(); return; }
    if (result === 'complete') conclude();
  }));
}

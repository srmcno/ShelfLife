import { GESTURES, newHandshake, tapHandshake, rewardHandshake, playWait, gesturesFor, handshakeRounds } from '../engine/play.js';
import { newAlibi, answerAlibi, advanceAlibi, rewardAlibi, currentRound, ALIBI_ROUNDS } from '../engine/alibi.js';
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
  const alibiRoot = document.getElementById('alibiArea');
  const alibiList = document.getElementById('alibiStatements');
  const alibiVerdict = document.getElementById('alibiVerdict');
  const alibiCharge = document.getElementById('alibiCharge');
  const gestureGrid = veil.querySelector('.gesture-grid');
  const playControls = veil.querySelector('.play-controls');
  let game = null, pet = null, puppet = null, accepting = false, generation = 0, mode = 'chase';
  let alibi = null;
  function reward(finished) {
    const result = rewardHandshake(state, finished);
    checkUnlocks(state); checkAchievements(state); save(); refresh();
    document.getElementById('playReward').textContent = 'Games share a 5-minute reward rest per resident. Practice and personal bests are always available.';
    return result;
  }
  const chase = createChaseUI(chaseRoot, reward, text => { status.textContent = text; });
  const TITLES = { chase: 'Crumb Chase', memory: 'Secret handshake', alibi: 'The Alibi' };
  const EYEBROWS = { chase: 'On the loose with ', memory: 'A secret with ', alibi: 'Taking a statement from ' };
  const BRIEFS = {
    chase: 'You steer. They chase. Keep a streak, catch what falls, and jump over or stomp the dust bunnies.',
    memory: 'Watch your resident perform the gestures, then tap them in order. A wrong tap just means another try.',
    alibi: 'Three sworn statements about this shelf. Exactly one of them is false. You have to know your own shelf.'
  };
  const STARTS = { chase: 'Let’s chase', memory: 'Learn the handshake', alibi: 'Take their statement' };

  function setMode(next) {
    generation++; chase.stop(); puppet?.release(); puppet = null;
    mode = next; game = mode === 'memory' ? newHandshake(pet) : null; alibi = null; lock(true);
    modeButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.playMode === mode)));
    pads.forEach(p => p.classList.remove('lit'));
    veil.classList.toggle('chase-mode', mode === 'chase');
    chaseRoot.hidden = mode !== 'chase'; document.getElementById('gentleOption').hidden = mode !== 'chase';
    // The gesture pads and the replay control belong to the handshake alone; the
    // statement list belongs to the alibi. Neither should be reachable by tab in
    // a mode where it does nothing.
    alibiRoot.hidden = mode !== 'alibi';
    gestureGrid.hidden = mode !== 'memory';
    playControls.hidden = mode === 'chase';
    alibiList.replaceChildren();
    alibiVerdict.textContent = '';
    start.hidden = mode === 'chase'; replay.hidden = true; start.textContent = STARTS[mode] || STARTS.memory;
    document.getElementById('playTitle').textContent = TITLES[mode] || TITLES.memory;
    document.getElementById('playName').textContent = (EYEBROWS[mode] || EYEBROWS.memory) + pet.name;
    cue.textContent = mode === 'alibi' ? 'It has had time to prepare.' : 'They have been rehearsing.';
    status.textContent = BRIEFS[mode] || BRIEFS.memory;
    const resting = playWait(pet) || isAsleep(pet);
    document.getElementById('playReward').textContent = resting
      ? 'Practice round · rewards return when rested and awake.'
      : mode === 'alibi' ? 'Catch all three lies for up to +20 attention and +1 trust.'
      : 'Win for up to +24 attention and +1 trust.';
    const names = gesturesFor(pet);
    pads.forEach((pad, i) => { const label = pad.querySelector('span'); if (label) label.textContent = names[i]; });
    host.replaceChildren();
    if (mode === 'chase') chase.prepare(pet, gentle.checked);
    else { host.appendChild(renderPetSprite(pet)); host.firstElementChild.classList.add('sl-mood-content'); puppet = createPuppet(host.firstElementChild); progress(); }
  }
  modeButtons.forEach(b => b.addEventListener('click', () => setMode(b.dataset.playMode)));
  gentle.addEventListener('change', () => { if (pet && mode === 'chase') setMode('chase'); });
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  function lock(locked) { accepting = !locked; pads.forEach(p => p.setAttribute('aria-disabled', String(locked))); }
  // Both the handshake and the alibi are three rounds, so they share the step
  // indicator; whichever one is live supplies the count.
  function progress() {
    const live = mode === 'alibi' ? alibi : game;
    const round = live ? live.round : 0;
    const total = mode === 'alibi' ? ((alibi && alibi.rounds.length) || ALIBI_ROUNDS)
      : (game && game.rounds) || handshakeRounds(pet);
    document.getElementById('playProgress').textContent = 'Round ' + Math.min(total, round + 1) + ' of ' + total;
    const steps = veil.querySelector('.play-rounds');
    let pips = [...steps.querySelectorAll('.play-step')];
    while (pips.length < total) { const el = document.createElement('span'); el.className = 'play-step'; steps.appendChild(el); pips.push(el); }
    while (pips.length > total) pips.pop().remove();
    pips.forEach((el, i) => el.classList.toggle('done', i < round));
  }

  /* ---- the alibi ---------------------------------------------------------- */
  function renderAlibi() {
    const round = currentRound(alibi);
    alibiList.replaceChildren();
    if (!round) return;
    alibiCharge.textContent = 'Statement ' + (alibi.round + 1) + ' of ' + alibi.rounds.length + '. One of these three is false.';
    round.statements.forEach((text, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'alibi-statement';
      b.dataset.alibi = String(i);
      b.textContent = '“' + text + '”';
      alibiList.appendChild(b);
    });
    progress();
    alibiList.firstElementChild?.focus({ preventScroll: true });
  }

  function startAlibi() {
    alibi = newAlibi(state, pet);
    alibiVerdict.textContent = '';
    if (!alibi.rounds.length) {
      // A brand-new solo shelf cannot supply three rounds of checkable facts yet.
      alibiCharge.textContent = 'It has nothing to swear to yet. Give it a neighbour, or a few days of being looked after, and it will find something.';
      status.textContent = 'Not enough shelf to lie about. Come back when there is more of it.';
      start.hidden = false; start.textContent = 'Try again';
      return;
    }
    start.hidden = true;
    status.textContent = 'Tap the statement you believe is false. A wrong call costs nothing but the round.';
    renderAlibi();
  }

  function concludeAlibi() {
    const result = rewardAlibi(state, alibi, Date.now());
    checkUnlocks(state); checkAchievements(state); save(); refresh();
    const caught = alibi.correct, total = alibi.rounds.length;
    alibiCharge.textContent = 'Statement closed. You caught ' + caught + ' of ' + total + '.';
    alibiVerdict.textContent = result && !result.practice
      ? (result.clean
        ? 'Every lie found. +' + result.fuss + ' attention · +' + result.bond + ' trust. It would like to know how.'
        : '+' + result.fuss + ' attention. It is not going to tell you which ones you missed.')
      : 'Practice statement. Nothing on the record, and it knows it.';
    status.textContent = caught === total ? 'You know your own shelf.' : 'It got some of that past you.';
    puppet?.gesture(caught === total ? 'win' : 'bump');
    if (caught === total) playFuss();
    progress();
    start.hidden = false; start.textContent = 'Take another statement';
    start.focus({ preventScroll: true });
  }

  alibiList.addEventListener('click', e => {
    const button = e.target.closest('[data-alibi]');
    if (!button || !alibi || alibi.complete) return;
    const round = currentRound(alibi);
    const verdict = answerAlibi(alibi, Number(button.dataset.alibi));
    if (verdict === 'ignored') return;
    if (navigator.vibrate) navigator.vibrate(8);
    [...alibiList.children].forEach((el, i) => {
      el.disabled = true;
      if (i === round.lie) el.classList.add('was-lie');
      else if (i === round.answered) el.classList.add('was-wrong');
    });
    alibiVerdict.textContent = verdict === 'right'
      ? 'That one was false. It does not look sorry.'
      : 'That one was true. The false one is marked.';
    puppet?.gesture(verdict === 'right' ? 'blink' : 'bump');
    setTimeout(() => {
      if (!alibi) return;
      if (alibi.complete) concludeAlibi();
      else if (advanceAlibi(alibi)) { alibiVerdict.textContent = ''; renderAlibi(); }
    }, 1500);
  });
  async function demonstrate() {
    const token = ++generation;
    lock(true); replay.disabled = true; progress();
    status.textContent = 'Watch ' + pet.name + '. Then repeat their gestures.';
    const sequence = game.sequence.slice(0, game.round + 2);
    cue.textContent = 'Watch…';
    const names = game.names || GESTURES;
    document.getElementById('playAnnouncement').textContent = 'Remember: ' + sequence.map(i => names[i]).join(', ');
    await wait(650);
    for (const gesture of sequence) {
      if (token !== generation) return;
      pads[gesture].classList.add('lit'); cue.textContent = names[gesture];
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
    generation++; lock(true); game = null; alibi = null; chase.stop(); puppet?.release(); puppet = null;
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
  start.addEventListener('click', () => {
    if (mode === 'alibi') { startAlibi(); return; }
    if (!game || game.complete) game = newHandshake(pet);
    start.hidden = true; replay.hidden = false; demonstrate();
  });
  replay.addEventListener('click', () => { if (game && !game.complete) { game.cursor = 0; demonstrate(); } });
  pads.forEach((pad, i) => pad.addEventListener('click', () => {
    if (!accepting || !game) return;
    const result = tapHandshake(game, i); cue.textContent = (game.names || GESTURES)[i];
    puppet.gesture(result === 'retry' ? 'bump' : GESTURES[i].toLowerCase());
    if (navigator.vibrate) navigator.vibrate(8);
    if (result === 'retry') { lock(true); cue.textContent = 'Nearly. They insist.'; status.textContent = 'No points lost. Replay the pattern and try again.'; return; }
    if (result === 'correct') { status.textContent = game.cursor + ' remembered. Keep going.'; return; }
    lock(true); replay.disabled = true;
    if (result === 'round') demonstrate();
    if (result === 'complete') conclude();
  }));
}

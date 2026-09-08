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
  const slow = document.getElementById('playSlow'), trail = document.getElementById('memoryTrail');
  const encore = document.getElementById('playEncore');
  const notebook = document.getElementById('alibiNotebook'), facts = document.getElementById('alibiFacts');
  const alibiRoot = document.getElementById('alibiArea');
  const alibiList = document.getElementById('alibiStatements');
  const alibiVerdict = document.getElementById('alibiVerdict');
  const alibiCharge = document.getElementById('alibiCharge');
  const alibiNext = document.getElementById('alibiNext');
  const gestureGrid = veil.querySelector('.gesture-grid');
  const playControls = veil.querySelector('.play-controls');
  let game = null, pet = null, puppet = null, accepting = false, generation = 0, mode = 'chase';
  let alibi = null;
  function reward(finished) {
    const result = rewardHandshake(state, finished);
    checkUnlocks(state); checkAchievements(state); refresh();
    document.getElementById('playReward').textContent = 'Each game has its own 5-minute reward rest. Every completed game counts in your history.';
    return result;
  }
  const chase = createChaseUI(chaseRoot, reward, text => { status.textContent = text; });
  const TITLES = { chase: 'Crumb Chase', memory: 'Secret handshake', alibi: 'The Alibi' };
  const EYEBROWS = { chase: 'On the loose with ', memory: 'A secret with ', alibi: 'Taking a statement from ' };
  const BRIEFS = {
    chase: 'You steer. They chase. Keep a streak, catch what falls, and jump over or stomp the dust bunnies.',
    memory: 'Watch, then repeat the gestures. Tap the pads or press 1–4. Wrong taps cost nothing. It has eternity to rehearse.',
    alibi: 'Three sworn statements about this shelf. Find the false one. Your evidence notebook is available throughout; no timer, no penalties for reading.'
  };
  const STARTS = { chase: 'Let’s chase', memory: 'Learn the handshake', alibi: 'Take their statement' };

  function setMode(next) {
    generation++; chase.stop(); puppet?.release(); puppet = null;
    document.getElementById('playAnnouncement').textContent = '';
    mode = next; game = mode === 'memory' ? newHandshake(pet, Math.random, {encore:encore.checked}) : null; alibi = null; lock(true);
    modeButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.playMode === mode)));
    pads.forEach(p => p.classList.remove('lit'));
    veil.classList.toggle('chase-mode', mode === 'chase');
    veil.classList.toggle('alibi-mode', mode === 'alibi');
    document.getElementById('memoryOption').hidden = mode !== 'memory';
    trail.hidden = mode !== 'memory'; trail.replaceChildren();
    chaseRoot.hidden = mode !== 'chase'; document.getElementById('gentleOption').hidden = mode !== 'chase';
    // The gesture pads and the replay control belong to the handshake alone; the
    // statement list belongs to the alibi. Neither should be reachable by tab in
    // a mode where it does nothing.
    alibiRoot.hidden = mode !== 'alibi';
    gestureGrid.hidden = mode !== 'memory';
    playControls.hidden = mode === 'chase';
    notebook.hidden = true; notebook.open = false; facts.replaceChildren(); encore.disabled = false;
    alibiList.replaceChildren();
    alibiVerdict.textContent = ''; alibiNext.hidden = true;
    alibiCharge.textContent = 'Three statements. One false. All suspiciously moist.';
    start.hidden = mode === 'chase'; replay.hidden = true; start.textContent = STARTS[mode] || STARTS.memory;
    document.getElementById('playTitle').textContent = TITLES[mode] || TITLES.memory;
    document.getElementById('playName').textContent = (EYEBROWS[mode] || EYEBROWS.memory) + pet.name;
    cue.textContent = mode === 'alibi' ? 'It has had time to prepare.' : 'They have been rehearsing.';
    status.textContent = BRIEFS[mode] || BRIEFS.memory;
    const resting = playWait(pet, Date.now(), mode) || isAsleep(pet);
    document.getElementById('playReward').textContent = resting
      ? 'Practice round · rewards return when rested and awake.'
      : mode === 'alibi' ? 'Catch all three lies for up to +20 attention and +1 trust.'
      : 'Win for up to +24 attention and +1 trust.';
    const names = gesturesFor(pet);
    pads.forEach((pad, i) => { const label = pad.querySelector('span'); if (label) label.textContent = GESTURES[i]; pad.title=names[i]; pad.setAttribute('aria-label',GESTURES[i]+' · '+names[i]+' · key '+(i+1)); });
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
    const round = live ? live.round + (mode === 'alibi' && currentRound(live)?.answered !== null ? 1 : 0) : 0;
    const total = mode === 'alibi' ? ((alibi && alibi.rounds.length) || ALIBI_ROUNDS)
      : (game && game.rounds) || handshakeRounds(pet);
    document.getElementById('playProgress').textContent = live?.complete ? 'Complete · ' + total + ' rounds' : 'Round ' + Math.min(total, (live?.round || 0) + 1) + ' of ' + total;
    const steps = veil.querySelector('.play-rounds');
    let pips = [...steps.querySelectorAll('.play-step')];
    while (pips.length < total) { const el = document.createElement('span'); el.className = 'play-step'; steps.appendChild(el); pips.push(el); }
    while (pips.length > total) pips.pop().remove();
    pips.forEach((el, i) => el.classList.toggle('done', i < round));
  }

  /* ---- the alibi ---------------------------------------------------------- */
  function renderAlibi() {
    const round = currentRound(alibi);
    alibiList.replaceChildren(); alibiNext.hidden = true;
    if (!round) return;
    alibiCharge.textContent = 'Statement ' + (alibi.round + 1) + ' of ' + alibi.rounds.length + '. One of these three is false.';
    round.statements.forEach((text, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'alibi-statement';
      b.dataset.alibi = String(i);
      const number = document.createElement('span'); number.className = 'alibi-number'; number.textContent = String(i + 1); number.setAttribute('aria-hidden', 'true');
      const claim = document.createElement('span'); claim.textContent = '“' + text + '”';
      b.append(number, claim);
      alibiList.appendChild(b);
    });
    progress();
    alibiList.firstElementChild?.focus({ preventScroll: true });
  }

  function startAlibi() {
    alibi = newAlibi(state, pet);
    notebook.hidden = false; notebook.open = false;
    facts.replaceChildren(...alibi.notebook.map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
    alibiNext.hidden = true;
    alibiVerdict.textContent = '';
    if (!alibi.rounds.length) {
      // A brand-new solo shelf cannot supply three rounds of checkable facts yet.
      alibiCharge.textContent = 'It has nothing to swear to yet. Give it a neighbour, or a few days of being looked after, and it will find something.';
      status.textContent = 'Not enough shelf to lie about. Come back when there is more of it.';
      start.hidden = false; start.textContent = 'Try again';
      return;
    }
    start.hidden = true;
    status.textContent = 'Find the lie. Check the evidence notebook or press 1–3 to choose. Take all the time you need.';
    renderAlibi();
  }

  function concludeAlibi() {
    const result = rewardAlibi(state, alibi, Date.now());
    checkUnlocks(state); checkAchievements(state); refresh();
    const caught = alibi.correct, total = alibi.rounds.length;
    alibiCharge.textContent = 'Statement closed. You caught ' + caught + ' of ' + total + '.';
    const outcome = result && !result.practice
      ? (result.clean
        ? 'Every lie found. +' + result.fuss + ' attention · +' + result.bond + ' trust. It would like to know how.'
        : '+' + result.fuss + ' attention. It has eaten the carbon copy.')
      : 'Practice complete. Your statement and clean wins are recorded.';
    status.textContent = outcome;
    document.getElementById('playReward').textContent = 'Each game rests separately. Practice always counts in your history.';
    puppet?.gesture(caught === total ? 'win' : 'bump');
    if (caught === total) playFuss();
    progress();
    start.hidden = false; start.textContent = 'Take another statement';
    start.focus({ preventScroll: true });
  }

  alibiNext.addEventListener('click', () => {
    if (mode !== 'alibi' || !alibi || !advanceAlibi(alibi)) return;
    alibiVerdict.textContent = ''; renderAlibi();
  });
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
      const stamp = document.createElement('small'); stamp.className = 'alibi-stamp';
      stamp.textContent = i === round.lie ? 'FALSE' : 'TRUE'; el.appendChild(stamp);
    });
    alibiVerdict.textContent = (verdict === 'right'
      ? 'Lie caught. It swore on a crumb. ' : 'That was true. The false statement is marked. ')
      + 'On record: ' + round.evidence;
    puppet?.gesture(verdict === 'right' ? 'blink' : 'bump');
    progress();
    // No delayed callbacks: the player controls reading time, and a new session
    // can never inherit an old verdict or consume its next round.
    if (alibi.complete) concludeAlibi();
    else { alibiNext.hidden = false; alibiNext.focus({ preventScroll: true }); }
  });
  function paintTrail() {
    if (!game) return;
    const length = Math.min(game.sequence.length, game.round + 2);
    trail.replaceChildren(...Array.from({ length }, (_, i) => {
      const dot = document.createElement('span'); dot.textContent = i < game.cursor ? '✓' : '·'; dot.className = i < game.cursor ? 'remembered' : ''; return dot;
    }));
    trail.setAttribute('aria-label', game.cursor + ' of ' + length + ' gestures remembered');
  }
  async function demonstrate() {
    const token = ++generation;
    const pace = slow.checked ? 1.6 : 1;
    lock(true); replay.disabled = true; progress(); paintTrail();
    status.textContent = 'Watch ' + pet.name + '. Then repeat their gestures.';
    const sequence = game.sequence.slice(0, game.round + 2);
    cue.textContent = 'Watch…';
    const names = game.names || GESTURES;
    document.getElementById('playAnnouncement').textContent = 'Remember: ' + sequence.map(i => names[i]).join(', ');
    await wait(650);
    for (const gesture of sequence) {
      if (token !== generation) return;
      pads[gesture].classList.add('lit'); cue.textContent = GESTURES[gesture]+' · '+names[gesture];
      puppet.gesture(GESTURES[gesture].toLowerCase());
      await wait(700 * pace);
      if (token !== generation) return;
      pads[gesture].classList.remove('lit'); cue.textContent = '·'; await wait(220 * pace);
    }
    if (token !== generation) return;
    cue.textContent = 'Your turn'; status.textContent = 'Repeat ' + sequence.length + ' gestures. Tap or use keys 1–4. Take your time.';
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
    generation++; lock(true); game.cursor = 0; paintTrail(); pads.forEach(p => p.classList.remove('lit'));
    status.textContent = 'Paused. Replay the pattern when you are ready.'; cue.textContent = 'Take your time'; replay.disabled = false;
  });
  window.addEventListener('shelflife:play', e => {
    pet = state.pets.find(p => p.id === e.detail?.petId);
    if (!pet) return;
    setMode(['memory', 'alibi'].includes(e.detail?.mode) ? e.detail.mode : 'chase'); veil.classList.add('open');
  });
  function conclude() {
    lock(true); replay.disabled = true;
    const result = reward(game); progress();
    trail.replaceChildren(); trail.setAttribute('aria-label', 'Handshake complete');
    encore.disabled = false;
    cue.textContent = game.encore ? 'The inner circle. Six gestures wide.' : 'You are in the club.';
    document.getElementById('playAnnouncement').textContent = 'Handshake complete. ' + game.rounds + ' rounds remembered.';
    status.textContent = result && !result.practice ? '+' + result.fuss + ' attention · +' + result.bond + ' trust. They will deny enjoying that.' : 'Practice complete. They insist they were letting you win.';
    status.textContent += ' ' + game.rounds + ' rounds · ' + game.mistakes + (game.mistakes === 1 ? ' slip · ' : ' slips · ') + game.replays + (game.replays === 1 ? ' replay.' : ' replays.');
    const bestRun = pet.handshakeBest?.[game.encore ? 'encore' : 'standard'];
    if (bestRun) status.textContent += ' Personal best: ' + bestRun.rounds + ' rounds with ' + bestRun.mistakes + (bestRun.mistakes === 1 ? ' slip and ' : ' slips and ') + bestRun.replays + (bestRun.replays === 1 ? ' replay.' : ' replays.');
    puppet.gesture('win'); playFuss();
    start.hidden = false; start.textContent = 'Play another handshake'; replay.hidden = true; start.focus({ preventScroll: true });
  }
  start.addEventListener('click', () => {
    if (mode === 'alibi') { startAlibi(); return; }
    if (!game || game.complete) game = newHandshake(pet, Math.random, {encore:encore.checked});
    encore.disabled = true; start.hidden = true; replay.hidden = false; demonstrate();
  });
  replay.addEventListener('click', () => { if (game && !game.complete) { game.cursor = 0; game.replays++; demonstrate(); } });
  encore.addEventListener('change', () => { if (pet && mode === 'memory') setMode('memory'); });
  document.addEventListener('keydown', e => {
    if (mode === 'alibi' && veil.classList.contains('open') && !e.repeat && !e.altKey && !e.ctrlKey && !e.metaKey && /^[1-3]$/.test(e.key) && !e.target?.closest?.('input,select,textarea,[contenteditable=true]')) { e.preventDefault(); alibiList.children[Number(e.key)-1]?.click(); return; }
    if (mode !== 'memory' || !accepting || !veil.classList.contains('open') || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target?.closest?.('input,select,textarea,[contenteditable=true]')) return;
    if (/^[1-4]$/.test(e.key)) { e.preventDefault(); pads[Number(e.key) - 1].click(); }
  });
  pads.forEach((pad, i) => pad.addEventListener('click', () => {
    if (!accepting || !game) return;
    const result = tapHandshake(game, i); paintTrail();
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) pad.animate([{transform:'scale(.94)'},{transform:'scale(1)'}], {duration:180});
    cue.textContent = (game.names || GESTURES)[i];
    puppet.gesture(result === 'retry' ? 'bump' : GESTURES[i].toLowerCase());
    if (navigator.vibrate) navigator.vibrate(8);
    if (result === 'retry') {
      lock(true); cue.textContent = 'A rehearsal casualty.'; status.textContent = 'No progress lost. They will show this round again.';
      const token = ++generation;
      wait(1000).then(() => { if (token === generation && game && !game.complete && !document.hidden) demonstrate(); });
      return;
    }
    if (result === 'correct') { status.textContent = game.cursor + ' remembered. Keep going.'; return; }
    lock(true); replay.disabled = true;
    if (result === 'round') demonstrate();
    if (result === 'complete') conclude();
  }));
}

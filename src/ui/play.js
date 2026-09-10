import { GESTURES, newHandshake, tapHandshake, rewardHandshake, playWait, gesturesFor, handshakeRounds, HANDSHAKE_RITUALS, handshakePattern, handshakeDemonstration, handshakeRecordKey, restartHandshake } from '../engine/play.js';
import { newAlibi, answerAlibi, advanceAlibi, rewardAlibi, currentRound, ALIBI_ROUNDS, alibiReaction, alibiRank } from '../engine/alibi.js';
import { isAsleep } from '../engine/tick.js';
import { renderPetSprite } from '../art/sprite.js';
import { createPuppet } from '../art/animator.js';
import { createChaseUI } from './chase.js';
import { playFuss } from '../audio/sound.js';
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
  let alibi = null, accusation = null, exhibit = null;
  const theatre = veil.querySelector('.play-theatre');
  const sceneLabel = document.createElement('span'); sceneLabel.className = 'parlour-scene-label'; theatre.prepend(sceneLabel);
  const audience = document.createElement('div'); audience.className = 'parlour-audience'; audience.setAttribute('aria-hidden', 'true'); audience.innerHTML = '<i></i><i></i><i></i><i></i>'; theatre.append(audience);
  const ritualLabel = document.createElement('label'); ritualLabel.className = 'parlour-select'; ritualLabel.textContent = 'Ritual';
  const ritualSelect = document.createElement('select'); ritualSelect.id = 'handshakeRitual'; ritualSelect.setAttribute('aria-label', 'Handshake ritual');
  for (const [value, ritual] of Object.entries(HANDSHAKE_RITUALS)) { const option = document.createElement('option'); option.value = value; option.textContent = ritual.name + (value === 'echo' ? ' · copy' : value === 'mirror' ? ' · backwards' : ' · alternate beats'); ritualSelect.append(option); }
  ritualLabel.append(ritualSelect); document.getElementById('memoryOption').prepend(ritualLabel);
  const alibiLabel = document.createElement('label'); alibiLabel.className = 'parlour-select'; alibiLabel.textContent = 'Investigation';
  const alibiMode = document.createElement('select'); alibiMode.id = 'alibiDifficulty'; alibiMode.setAttribute('aria-label', 'Alibi investigation');
  alibiMode.innerHTML = '<option value="prove">Prove it · lie + evidence</option><option value="quick">Spot the lie · casual</option>'; alibiLabel.append(alibiMode); alibiRoot.prepend(alibiLabel);
  const evidencePanel = document.createElement('div'); evidencePanel.className = 'alibi-evidence-panel'; evidencePanel.hidden = true;
  const evidenceTitle = document.createElement('h3'); evidenceTitle.textContent = 'Which record contradicts it?';
  const evidenceList = document.createElement('div'); evidenceList.className = 'alibi-exhibits'; evidenceList.setAttribute('role', 'group'); evidenceList.setAttribute('aria-label', 'Shelf records. Choose contradictory evidence.');
  evidencePanel.append(evidenceTitle, evidenceList); alibiList.after(evidencePanel);
  const accuse = document.createElement('button'); accuse.type = 'button'; accuse.className = 'btn btn-primary alibi-accuse'; accuse.textContent = 'Present accusation'; accuse.hidden = true; evidencePanel.after(accuse);
  const again = document.createElement('button'); again.type = 'button'; again.className = 'btn'; again.textContent = 'Replay this ritual'; again.hidden = true; playControls.append(again);
  const stageAnimations = new Set();
  function animate(el, frames, options) {
    if (document.hidden || document.body.dataset.effects === 'light' || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !el?.animate) return;
    const animation = el.animate(frames, options); stageAnimations.add(animation);
    animation.onfinish = animation.oncancel = () => stageAnimations.delete(animation);
  }
  function cancelStageMotion() { for (const animation of stageAnimations) animation.cancel(); stageAnimations.clear(); }
  function stage(phase, text) {
    theatre.dataset.phase = phase; sceneLabel.textContent = text;
    if (phase === 'win') animate(audience, [{ transform: 'translateY(14px)' }, { transform: 'translateY(-5px)' }, { transform: 'translateY(0)' }], { duration: 650, easing: 'ease-out' });
  }
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', e => { if (e.matches) cancelStageMotion(); });
  function freshHandshake() { return newHandshake(pet, Math.random, { encore: encore.checked, ritual: ritualSelect.value }); }

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
    chase: 'Catch, hop, dash. Keep a streak, smash the dust, and sweep the gold at last call. The bread had a good run.',
    memory: 'Choose a ritual: echo every move, reverse the order, or learn only your half of a duet. Tap the pads or press 1–4. No timer.',
    alibi: 'Catch the lie, then produce the shelf record that disproves it. A true fact is not always relevant evidence. Untimed, with an optional casual mode.'
  };
  const STARTS = { chase: 'Let’s chase', memory: 'Learn the handshake', alibi: 'Take their statement' };

  function setMode(next) {
    generation++; cancelStageMotion(); chase.stop(); puppet?.release(); puppet = null;
    document.getElementById('playAnnouncement').textContent = '';
    mode = next; game = mode === 'memory' ? freshHandshake() : null; alibi = null; lock(true);
    modeButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.playMode === mode)));
    pads.forEach(p => p.classList.remove('lit')); again.hidden = true; ritualSelect.disabled = false; alibiMode.disabled = false; accuse.hidden = true; evidencePanel.hidden = true; accusation = null; exhibit = null;
    veil.classList.toggle('chase-mode', mode === 'chase');
    veil.classList.toggle('alibi-mode', mode === 'alibi'); veil.classList.toggle('memory-mode', mode === 'memory'); veil.classList.remove('ritual-active');
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
    alibiCharge.textContent = 'Three statements. One lie. Bring receipts.'; stage('ready', mode === 'alibi' ? 'The interview room' : HANDSHAKE_RITUALS[ritualSelect.value].name + ' ritual');
    start.hidden = mode === 'chase'; replay.hidden = true; start.textContent = STARTS[mode] || STARTS.memory;
    document.getElementById('playTitle').textContent = TITLES[mode] || TITLES.memory;
    document.getElementById('playName').textContent = (EYEBROWS[mode] || EYEBROWS.memory) + pet.name;
    cue.textContent = mode === 'alibi' ? 'It has had time to prepare.' : 'They have been rehearsing.';
    status.textContent = BRIEFS[mode] || BRIEFS.memory;
    const resting = playWait(pet, Date.now(), mode) || isAsleep(pet);
    document.getElementById('playReward').textContent = resting
      ? 'Practice round · rewards return when rested and awake.'
      : mode === 'alibi' ? (alibiMode.value === 'prove' ? 'Find and prove all three lies for up to +20 attention and +1 trust.' : 'Catch all three lies for up to +20 attention and +1 trust.')
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
    alibiList.replaceChildren(); evidenceList.replaceChildren(); alibiNext.hidden = true;
    accusation = null; exhibit = null; accuse.hidden = false; accuse.disabled = true;
    evidencePanel.hidden = alibi?.mode !== 'prove';
    if (!round) return;
    stage('testimony', 'Interview ' + (alibi.round + 1) + ' · select a lie'); puppet?.gesture('testify');
    alibiCharge.textContent = 'Interview ' + (alibi.round + 1) + ' of ' + alibi.rounds.length + '. Select the false statement.';
    round.statements.forEach((text, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'alibi-statement'; b.dataset.alibi = String(i); b.setAttribute('aria-pressed', 'false');
      const number = document.createElement('span'); number.className = 'alibi-number'; number.textContent = String(i + 1); number.setAttribute('aria-hidden', 'true');
      const claim = document.createElement('span'); claim.textContent = '“' + text + '”'; b.append(number, claim); alibiList.appendChild(b);
    });
    if (alibi.mode === 'prove') round.exhibits.forEach((fact, i) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'alibi-exhibit'; button.dataset.exhibit = String(i); button.setAttribute('aria-pressed', 'false');
      const tag = document.createElement('b'); tag.textContent = 'Record ' + String.fromCharCode(65 + i);
      const text = document.createElement('span'); text.textContent = fact.text; button.append(tag, text); evidenceList.append(button);
    });
    animate(alibiList, [{ opacity: .3, transform: 'translateY(10px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 350, easing: 'ease-out' });
    progress(); alibiList.firstElementChild?.focus({ preventScroll: true }); alibiList.firstElementChild?.scrollIntoView({ block: 'nearest' });
  }

  function startAlibi() {
    alibi = newAlibi(state, pet, Math.random, { mode: alibiMode.value }); alibiMode.disabled = true;
    notebook.hidden = false; notebook.open = false;
    facts.replaceChildren(...alibi.notebook.map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
    alibiNext.hidden = true; alibiVerdict.textContent = '';
    if (!alibi.rounds.length) {
      alibiCharge.textContent = 'It has nothing to swear to yet. Give it a neighbour, or a little care, and it will find something.';
      status.textContent = 'Not enough shelf to lie about yet.'; start.hidden = false; start.textContent = 'Try again'; alibiMode.disabled = false; return;
    }
    start.hidden = true;
    status.textContent = alibi.mode === 'prove' ? 'Select a lie and the record that contradicts it. You can change both before presenting. Keys 1–3 select statements.' : 'Select the lie, then present your accusation. You can change your mind before presenting.';
    renderAlibi();
  }

  function concludeAlibi() {
    const result = rewardAlibi(state, alibi, Date.now());
    checkUnlocks(state); checkAchievements(state); refresh();
    const caught = alibi.correct, total = alibi.rounds.length;
    alibiCharge.textContent = alibiRank(alibi) + ' · ' + caught + '/' + total + ' lies found' + (alibi.mode === 'prove' ? ' · ' + alibi.proved + '/' + total + ' proved.' : '.');
    status.textContent = result && !result.practice
      ? '+' + Math.round(result.fuss) + ' attention · +' + result.bond + ' trust. ' + (result.clean ? 'It is deleting your number with both hands.' : 'The witness leaves. Your chair leaves with it.')
      : 'Practice complete. Your investigation and clean wins are recorded.';
    document.getElementById('playReward').textContent = 'Each game rests separately. Practice always counts in your history.';
    puppet?.gesture(result?.clean ? 'confess' : 'deny'); stage(result?.clean ? 'win' : 'closed', alibiRank(alibi));
    if (result?.clean) playFuss(); progress();
    start.hidden = false; start.textContent = 'Take another statement'; alibiMode.disabled = false; start.focus({ preventScroll: true }); start.scrollIntoView({ block: 'nearest' });
  }

  alibiNext.addEventListener('click', () => {
    if (mode !== 'alibi' || !alibi || !advanceAlibi(alibi)) return;
    alibiVerdict.textContent = ''; renderAlibi();
  });
  function readyAccusation() {
    accuse.disabled = accusation === null || (alibi.mode === 'prove' && exhibit === null);
    if (accusation !== null) {
      stage('selected', alibi.mode === 'prove' && exhibit === null ? 'Now connect the evidence' : 'Ready to confront the witness');
      cue.textContent = 'It has stopped blinking.'; puppet?.gesture('inspect');
    }
  }
  alibiList.addEventListener('click', e => {
    const button = e.target.closest('[data-alibi]');
    if (!button || !alibi || alibi.complete || currentRound(alibi)?.answered !== null) return;
    accusation = Number(button.dataset.alibi);
    [...alibiList.children].forEach((el, i) => el.setAttribute('aria-pressed', String(i === accusation))); readyAccusation();
  });
  evidenceList.addEventListener('click', e => {
    const button = e.target.closest('[data-exhibit]');
    if (!button || !alibi || alibi.complete || currentRound(alibi)?.answered !== null) return;
    exhibit = Number(button.dataset.exhibit); [...evidenceList.children].forEach((el, i) => el.setAttribute('aria-pressed', String(i === exhibit))); readyAccusation();
  });
  accuse.addEventListener('click', () => {
    if (mode !== 'alibi' || !alibi || accusation === null) return;
    const round = currentRound(alibi), verdict = answerAlibi(alibi, accusation, exhibit);
    if (verdict === 'ignored') return;
    accuse.hidden = true;
    [...alibiList.children].forEach((el, i) => {
      el.disabled = true;
      if (i === round.lie) el.classList.add('was-lie'); else if (i === round.answered) el.classList.add('was-wrong');
      const stamp = document.createElement('small'); stamp.className = 'alibi-stamp'; stamp.textContent = i === round.lie ? 'FALSE' : 'TRUE'; el.append(stamp);
      animate(stamp, [{ opacity: 0, transform: 'scale(1.8) rotate(-12deg)' }, { opacity: 1, transform: 'scale(1) rotate(0)' }], { duration: 260 });
    });
    [...evidenceList.children].forEach((el, i) => { el.disabled = true; if (i === round.proof) { el.classList.add('proved'); const tag = document.createElement('small'); tag.textContent = 'Contradicts the lie'; el.append(tag); } });
    const explanation = verdict === 'right' ? (alibi.mode === 'prove' ? 'Caught and proved. ' : 'Lie caught. ') : verdict === 'unsupported' ? 'Right lie, unrelated evidence. Your record is true, but it does not contradict this claim. ' : 'That statement was true. The lie and its contradictory record are marked. ';
    alibiVerdict.textContent = explanation + 'On record: ' + round.evidence + ' ' + alibiReaction(round);
    cue.textContent = verdict === 'right' ? 'The witness has developed a tremor.' : 'It asks whether you work alone.';
    puppet?.gesture(verdict === 'right' ? 'confess' : 'deny'); stage(verdict === 'right' ? 'caught' : 'escaped', verdict === 'right' ? 'The record survives' : 'A hole in the case');
    progress();
    if (alibi.complete) concludeAlibi(); else { alibiNext.hidden = false; alibiNext.focus({ preventScroll: true }); alibiNext.scrollIntoView({ block: 'nearest' }); }
  });
  alibiMode.addEventListener('change', () => { if (pet && mode === 'alibi' && !alibiMode.disabled) setMode('alibi'); });
  function paintTrail() {
    if (!game) return;
    const length = handshakePattern(game).length;
    trail.replaceChildren(...Array.from({ length }, (_, i) => {
      const dot = document.createElement('span'); dot.textContent = i < game.cursor ? '✓' : '·'; dot.className = i < game.cursor ? 'remembered' : ''; return dot;
    }));
    trail.setAttribute('aria-label', game.cursor + ' of ' + length + ' gestures remembered');
  }
  async function demonstrate() {
    const token = ++generation;
    const pace = slow.checked ? 1.6 : 1;
    lock(true); replay.disabled = true; progress(); paintTrail();
    const ritual = HANDSHAKE_RITUALS[game.ritual || 'echo'];
    const stageLines = ['The audience died for these seats. Literally.', 'A second row has appeared. Do not turn around.', 'The applause is coming from inside the walls.', 'Someone is keeping time with a femur.', 'Your understudy has been buried. No pressure.'];
    status.textContent = ritual.rule + ' ' + stageLines[Math.min(game.round, stageLines.length - 1)]; stage('watch', ritual.name + ' · watch the ritual');
    const sequence = handshakeDemonstration(game);
    cue.textContent = 'Watch…';
    const names = game.names || GESTURES;
    document.getElementById('playAnnouncement').textContent = ritual.rule + ' Demonstration: ' + sequence.map((g, i) => (game.ritual === 'duet' ? (i % 2 ? 'your beat: ' : 'their beat: ') : '') + names[g]).join(', ');
    await wait(650);
    for (const [beat, gesture] of sequence.entries()) {
      if (token !== generation) return;
      pads[gesture].classList.add('lit'); cue.textContent = (game.ritual === 'duet' ? (beat % 2 ? 'YOUR BEAT · ' : 'Their beat · ') : '') + GESTURES[gesture]+' · '+names[gesture];
      stage(game.ritual === 'duet' && beat % 2 === 0 ? 'their-beat' : 'watch', game.ritual === 'duet' ? (beat % 2 ? 'Remember this beat' : 'Their beat · do not repeat') : 'Move ' + (beat + 1) + ' of ' + sequence.length);
      animate(pads[gesture].querySelector('svg'), [{ transform: 'scale(.85)' }, { transform: 'scale(1.14)' }, { transform: 'scale(1)' }], { duration: 400 });
      puppet.gesture(GESTURES[gesture].toLowerCase());
      await wait(700 * pace);
      if (token !== generation) return;
      pads[gesture].classList.remove('lit'); cue.textContent = '·'; await wait(220 * pace);
    }
    if (token !== generation) return;
    cue.textContent = game.ritual === 'mirror' ? 'Last move first' : game.ritual === 'duet' ? 'Your half of the duet' : 'Your turn';
    stage('answer', ritual.name + ' · your turn'); status.textContent = ritual.rule + ' ' + handshakePattern(game).length + ' moves. Keys 1–4 or tap. Take your time.';
    document.getElementById('playAnnouncement').textContent = 'Your turn. ' + ritual.rule;
    lock(false); replay.disabled = false; pads[0].focus({ preventScroll: true });
  }
  function close() {
    generation++; cancelStageMotion(); lock(true); game = null; alibi = null; chase.stop(); puppet?.release(); puppet = null;
    pads.forEach(p => p.classList.remove('lit')); veil.classList.remove('open');
  }
  document.getElementById('playClose').addEventListener('click', close);
  veil.addEventListener('click', e => { if (e.target === veil) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelStageMotion();
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
    encore.disabled = false; ritualSelect.disabled = false; veil.classList.remove('ritual-active'); stage('win', HANDSHAKE_RITUALS[game.ritual || 'echo'].name + ' ritual complete');
    cue.textContent = game.encore ? 'Six moves. Your pulse is optional.' : 'The audience wants you to stay. Forever.';
    document.getElementById('playAnnouncement').textContent = 'Handshake complete. ' + game.rounds + ' rounds remembered.';
    status.textContent = result && !result.practice ? '+' + Math.round(result.fuss) + ' attention · +' + result.bond + ' trust. The usher has crossed you off the missing persons board.' : 'Practice complete. The audience has requested the same funeral again.';
    status.textContent += ' ' + game.rounds + ' rounds · ' + game.mistakes + (game.mistakes === 1 ? ' slip · ' : ' slips · ') + game.replays + (game.replays === 1 ? ' replay.' : ' replays.');
    const bestRun = pet.handshakeBest?.[handshakeRecordKey(game)];
    if (bestRun) status.textContent += ' Personal best: ' + bestRun.rounds + ' rounds with ' + bestRun.mistakes + (bestRun.mistakes === 1 ? ' slip and ' : ' slips and ') + bestRun.replays + (bestRun.replays === 1 ? ' replay.' : ' replays.');
    puppet.gesture('win'); playFuss();
    start.hidden = false; start.textContent = 'New ritual'; replay.hidden = true; again.hidden = false; start.focus({ preventScroll: true });
  }
  start.addEventListener('click', () => {
    if (mode === 'alibi') { startAlibi(); return; }
    if (!game || game.complete) game = freshHandshake();
    encore.disabled = true; ritualSelect.disabled = true; veil.classList.add('ritual-active'); start.hidden = true; replay.hidden = false; again.hidden = true; demonstrate();
  });
  again.addEventListener('click', () => { if (mode !== 'memory' || !game?.complete) return; game = restartHandshake(game); encore.disabled = true; ritualSelect.disabled = true; veil.classList.add('ritual-active'); start.hidden = true; again.hidden = true; replay.hidden = false; demonstrate(); });
  ritualSelect.addEventListener('change', () => { if (pet && mode === 'memory' && !ritualSelect.disabled) setMode('memory'); });
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
    animate(pad, [{transform:'scale(.94)'},{transform:'scale(1)'}], {duration:180});
    cue.textContent = (game.names || GESTURES)[i];
    puppet.gesture(result === 'retry' ? 'bump' : GESTURES[i].toLowerCase());
    if (navigator.vibrate) navigator.vibrate(8);
    if (result === 'retry') {
      lock(true); stage('retry', 'A rehearsal casualty'); cue.textContent = 'A rehearsal casualty.'; status.textContent = ['The trapdoor operator has been told to sit down. Watch this round again.', 'Your predecessor made that mistake. Different circumstances. Watch again.', 'The audience inhales. None of it has lungs. Watch again.'][(game.mistakes - 1) % 3];
      const token = ++generation;
      wait(1000).then(() => { if (token === generation && game && !game.complete && !document.hidden) demonstrate(); });
      return;
    }
    if (result === 'correct') { status.textContent = game.cursor + ' of ' + handshakePattern(game).length + ' remembered. ' + (game.ritual === 'mirror' ? 'Keep working backwards.' : game.ritual === 'duet' ? 'Your beats only.' : 'Keep going.'); return; }
    lock(true); replay.disabled = true;
    if (result === 'round') demonstrate();
    if (result === 'complete') conclude();
  }));
}

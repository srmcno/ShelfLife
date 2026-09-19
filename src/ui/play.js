import { mastery, masteryTicket, completeMastery, masteryText } from '../mastery-state.js';
import { GESTURES, newHandshake, tapHandshake, rewardHandshake, gesturesFor, handshakeRounds, HANDSHAKE_RITUALS, handshakePattern, handshakeDemonstration, handshakeRecordKey, restartHandshake, replayHandshake } from '../engine/play.js';
import { rewardSummary, rewardPreview } from './reward-summary.js';
import { newAlibi, answerAlibi, advanceAlibi, rewardAlibi, currentRound, ALIBI_ROUNDS, alibiReaction, alibiRank } from '../engine/alibi.js';
import { renderPetSprite } from '../art/sprite.js';
import { createPuppet } from '../art/animator.js';
import { createChaseUI } from './chase.js';
import { acceptsGameShortcut, chaseSettingsLocked } from './game-controls.js';
import { playFuss } from '../audio/sound.js';
import { handshakeMemory, handshakeReaction } from '../engine/play.js';
import { checkUnlocks } from '../engine/unlocks.js';
import { checkAchievements } from '../engine/achievements.js';

// Statement numbers always mean statements, at every viewport size. Records
// have their own letter keys so selecting evidence cannot reset an accusation.
export function alibiEvidenceFeedback(round,index){return Array.isArray(round.proofs)?round.proofs.includes(index)?'Together, these records disprove the total':'':index===round.proof?'Contradicts the lie':'';}

export function alibiShortcut(event, game) {
  if (!game || game.complete || currentRound(game)?.answered !== null || event.repeat || !acceptsGameShortcut(event)) return null;
  const key = String(event.key).toLowerCase();
  if (/^[1-3]$/.test(key)) return { type: 'statement', index: Number(key) - 1 };
  if (game.mode !== 'quick' && /^[a-c]$/.test(key)) return { type: 'evidence', index: key.charCodeAt(0) - 97 };
  return null;
}

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
  const workspace = veil.querySelector('.parlour-workspace'), footer = veil.querySelector('.parlour-footer');
  const memorySetup = document.getElementById('memorySetup'), memoryOptions = memorySetup.querySelector('details');
  const mobileLayout = window.matchMedia('(max-width: 720px), (max-height: 500px)');
  let game = null, pet = null, puppet = null, accepting = false, generation = 0, mode = 'chase';
  let alibi = null, accusation = null, exhibit = null;
  const theatre = veil.querySelector('.play-theatre');
  const sceneLabel = document.createElement('span'); sceneLabel.className = 'parlour-scene-label'; theatre.prepend(sceneLabel);
  const audience = document.createElement('div'); audience.className = 'parlour-audience'; audience.setAttribute('aria-hidden', 'true'); audience.innerHTML = '<i></i><i></i><i></i><i></i>'; theatre.append(audience);
  const ritualLabel = document.createElement('label'); ritualLabel.className = 'parlour-select'; ritualLabel.textContent = 'Ritual';
  const ritualSelect = document.createElement('select'); ritualSelect.id = 'handshakeRitual'; ritualSelect.setAttribute('aria-label', 'Handshake ritual');
  for (const [value, ritual] of Object.entries(HANDSHAKE_RITUALS)) { const option = document.createElement('option'); option.value = value; option.textContent = ritual.name + (value === 'echo' ? ' · copy' : value === 'mirror' ? ' · backwards' : ' · alternate beats'); ritualSelect.append(option); }
  const autoRitual = document.createElement('option'); autoRitual.value='auto'; autoRitual.textContent='Continue mastery lesson'; ritualSelect.prepend(autoRitual); ritualSelect.value='auto';
  ritualLabel.append(ritualSelect); document.getElementById('memoryRitualSlot').append(ritualLabel);
  const ritualGuide = document.createElement('div'); ritualGuide.className = 'ritual-guide';
  memorySetup.after(ritualGuide);
  const alibiLabel = document.createElement('label'); alibiLabel.className = 'parlour-select'; alibiLabel.textContent = 'Investigation';
  const alibiMode = document.createElement('select'); alibiMode.id = 'alibiDifficulty'; alibiMode.setAttribute('aria-label', 'Alibi investigation');
  alibiMode.innerHTML = '<option value="prove">Prove it · lie + evidence</option><option value="quick">Spot the lie · casual</option>'; alibiLabel.append(alibiMode); alibiRoot.prepend(alibiLabel);
  const evidencePanel = document.createElement('div'); evidencePanel.className = 'alibi-evidence-panel'; evidencePanel.hidden = true;
  const evidenceTitle = document.createElement('h3'); evidenceTitle.textContent = 'Which record contradicts it?';
  const evidenceHint = document.createElement('p'); evidenceHint.className = 'hint'; evidenceHint.textContent = 'Every record is true. Only one disproves the lie. A–C: records · 1–3: statements.';
  const evidenceList = document.createElement('div'); evidenceList.className = 'alibi-exhibits'; evidenceList.setAttribute('role', 'group'); evidenceList.setAttribute('aria-label', 'Shelf records. Choose contradictory evidence.');
  const selectedClaim = document.createElement('button'); selectedClaim.type = 'button'; selectedClaim.className = 'alibi-selected-claim';
  evidencePanel.append(selectedClaim, evidenceTitle, evidenceHint, evidenceList); alibiList.after(evidencePanel);
  const accuse = document.createElement('button'); accuse.type = 'button'; accuse.className = 'btn btn-primary alibi-accuse'; accuse.textContent = 'Present accusation'; accuse.hidden = true; playControls.append(accuse, alibiNext);
  const review = document.createElement('button'); review.type = 'button'; review.className = 'btn btn-ghost alibi-review'; review.textContent = 'Review statements and records'; review.hidden = true; alibiVerdict.after(review);
  const again = document.createElement('button'); again.type = 'button'; again.className = 'btn'; again.textContent = 'Replay this ritual'; again.hidden = true; playControls.append(again);
  const slowerReplay = document.createElement('button'); slowerReplay.type = 'button'; slowerReplay.className = 'btn btn-ghost'; slowerReplay.textContent = 'Replay slowly'; slowerReplay.hidden = true;
  slowerReplay.title = 'Watch the same round at a slower pace. Completed rounds stay safe.'; playControls.append(slowerReplay);
  const ritualRecord = document.createElement('details'); ritualRecord.className = 'handshake-result-details'; ritualRecord.hidden = true;
  const ritualRecordTitle = document.createElement('summary'); ritualRecordTitle.textContent = 'Ritual record';
  const ritualRecordText = document.createElement('p'); ritualRecord.append(ritualRecordTitle, ritualRecordText); trail.after(ritualRecord);
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
  function freshHandshake() { return newHandshake(pet, Math.random, { encore: encore.checked, ritual: ritualSelect.value === 'auto' ? null : ritualSelect.value, practice: ritualSelect.value === 'echo' }); }
  function previewReward() { document.getElementById('playReward').textContent = rewardPreview(pet, mode, Date.now(), { alibiMode: alibiMode.value }); }

  function reward(finished) {
    const result = rewardHandshake(state, finished);
    checkUnlocks(state); checkAchievements(state); refresh();
    document.getElementById('playReward').textContent = 'Each game has its own 5-minute reward rest. Every completed game counts in your history.';
    return result;
  }
  const chase = createChaseUI(chaseRoot, reward, text => { status.textContent = text; }, phase => {
    gentle.disabled = chaseSettingsLocked(phase);
    gentle.title = gentle.disabled ? 'Pace stays fixed during a chase. Finish or close it to change the setup.' : '';
  });
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
    ritualRecord.hidden = true; ritualRecord.open = false;
    document.getElementById('playAnnouncement').textContent = '';
    const learned=mastery(pet,'handshake').tier;
    for(const option of ritualSelect.options)option.disabled=(option.value==='mirror'&&learned<2)||(option.value==='duet'&&learned<3);
    if(ritualSelect.selectedOptions[0]?.disabled)ritualSelect.value='auto';
    for(const option of alibiMode.options)option.disabled=option.value==='prove'&&mastery(pet,'alibi').tier<1;
    if(alibiMode.selectedOptions[0]?.disabled)alibiMode.value='auto';
    mode = next; game = mode === 'memory' ? freshHandshake() : null; alibi = null; lock(true);
    modeButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.playMode === mode)));
    pads.forEach(p => p.classList.remove('lit')); again.hidden = true; slowerReplay.hidden = true; ritualSelect.disabled = false; alibiMode.disabled = false; accuse.hidden = true; evidencePanel.hidden = true; accusation = null; exhibit = null;
    veil.classList.toggle('chase-mode', mode === 'chase');
    veil.classList.toggle('alibi-mode', mode === 'alibi'); veil.classList.toggle('memory-mode', mode === 'memory'); veil.classList.remove('ritual-active', 'alibi-complete');
    document.getElementById('memoryOption').hidden = mode !== 'memory'; memorySetup.hidden = mode !== 'memory'; memoryOptions.open = false;
    workspace.hidden = mode === 'chase'; footer.hidden = mode === 'chase'; workspace.scrollTop = 0; veil.dataset.investigationStep = 'setup'; review.hidden = true; selectedClaim.textContent = '';
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
    alibiCharge.textContent = 'Three statements. One lie. They think you will be too polite to mention it.'; stage('ready', mode === 'alibi' ? 'The interview room' : HANDSHAKE_RITUALS[game?.ritual || 'echo'].name + ' ritual');
    start.hidden = mode === 'chase'; replay.hidden = true; start.textContent = STARTS[mode] || STARTS.memory;
    document.getElementById('playTitle').textContent = TITLES[mode] || TITLES.memory;
    document.getElementById('playName').textContent = (EYEBROWS[mode] || EYEBROWS.memory) + pet.name;
    cue.textContent = mode === 'alibi' ? 'It has had time to prepare.' : 'They have been rehearsing.';
    status.textContent = mode==='alibi' ? masteryText(pet,'alibi') : BRIEFS[mode] || BRIEFS.memory;
    ritualGuide.hidden = mode !== 'memory';
    if (mode === 'memory') {
      const ritual = HANDSHAKE_RITUALS[game.ritual];
      status.textContent = masteryText(pet,'handshake');
      const examples = { echo: 'Watch: Knock, Blink. Your turn: Knock, Blink.', mirror: 'Watch: Knock, Blink. Your turn: Blink, Knock.', duet: 'Their beat: Knock. Your beat: Blink. Your turn: Blink only.' };
      ritualGuide.replaceChildren();
      const rule = document.createElement('strong'); rule.textContent = ritual.rule;
      const example = document.createElement('p'); example.textContent = examples[game.ritual];
      const goal = document.createElement('p'); goal.textContent = 'Start with 2 moves. Add one each round, up to ' + (game.rounds + 1) + '. Finish all ' + game.rounds + ' rounds. No timer; mistakes only restart the current round.';
      const learning=document.createElement('p');learning.textContent=masteryText(pet,'handshake');ritualGuide.append(learning,rule, example, goal);
      const memory = handshakeMemory(pet, game.ritual);
      const familiarity = document.createElement('p'); familiarity.className = 'handshake-familiarity';
      familiarity.textContent = memory ? pet.name + ' remembers your opening: ' + memory.opening.map(move => GESTURES[move]).join(', ') + '. Learned together in ' + memory.completions + (memory.completions === 1 ? ' completed lesson. New moves follow it.' : ' completed lessons. New moves follow it.') : 'Finish a lesson and ' + pet.name + ' will keep its opening as your shared greeting, even during reward rest.';
      ritualGuide.append(familiarity);
      status.textContent = 'Watch the resident light up the pads. When it says “Your turn”, tap them or use keys 1–4.';
    }
    previewReward();
    const names = gesturesFor(pet);
    pads.forEach((pad, i) => {
      const label = pad.querySelector('span'); if (label) label.textContent = GESTURES[i];
      let key = pad.querySelector('kbd'); if (!key) { key = document.createElement('kbd'); key.setAttribute('aria-hidden', 'true'); pad.append(key); } key.textContent = i + 1;
      pad.title = names[i] === GESTURES[i] ? GESTURES[i] : 'This resident calls it “' + names[i] + '”';
      pad.setAttribute('aria-label', GESTURES[i] + ', key ' + (i + 1));
    });
    host.replaceChildren();
    if (mode === 'chase') chase.prepare(pet, gentle.checked);
    else { host.appendChild(renderPetSprite(pet)); host.firstElementChild.classList.add('sl-mood-content'); puppet = createPuppet(host.firstElementChild); progress(); }
  }
  modeButtons.forEach(b => b.addEventListener('click', () => { if (mode !== b.dataset.playMode) setMode(b.dataset.playMode); }));
  gentle.addEventListener('change', () => { if (pet && mode === 'chase' && !gentle.disabled) setMode('chase'); });
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
  function investigationStep(step) {
    veil.dataset.investigationStep = step;
    if (mobileLayout.matches) workspace.scrollTop = 0;
  }
  function renderAlibi() {
    const round = currentRound(alibi);
    alibiList.replaceChildren(); evidenceList.replaceChildren(); alibiNext.hidden = true;
    accusation = null; exhibit = null; accuse.hidden = false; accuse.disabled = true; accuse.textContent = 'Select a statement';
    review.hidden = true; review.textContent = 'Review statements and records'; selectedClaim.textContent = ''; selectedClaim.disabled = false; investigationStep('statements');
    evidencePanel.hidden = alibi?.mode === 'quick';
    if (!round) return;
    stage('testimony', 'Interview ' + (alibi.round + 1) + ' · select a lie'); puppet?.gesture('testify');
    alibiRoot.dataset.proofMode = alibi.mode;
    alibiCharge.textContent = alibi.mode==='combine' ? 'Select the lie, then select BOTH true records that together disprove it.' : alibi.mode !== 'quick' ? '1 · Choose the lie. 2 · Pair it with the contradictory record.' : 'Choose the false statement. You can change your mind before presenting.';
    round.statements.forEach((text, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'alibi-statement'; b.dataset.alibi = String(i); b.setAttribute('aria-pressed', 'false');
      const number = document.createElement('span'); number.className = 'alibi-number'; number.textContent = String(i + 1); number.setAttribute('aria-hidden', 'true');
      b.setAttribute('aria-keyshortcuts', String(i + 1)); b.setAttribute('aria-label', 'Statement ' + (i + 1) + ': ' + text);
      const claim = document.createElement('span'); claim.textContent = '“' + text + '”'; b.append(number, claim); alibiList.appendChild(b);
    });
    if (alibi.mode !== 'quick') round.exhibits.forEach((fact, i) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'alibi-exhibit'; button.dataset.exhibit = String(i); button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-keyshortcuts', String.fromCharCode(65 + i));
      const tag = document.createElement('b'); tag.textContent = 'Record ' + String.fromCharCode(65 + i);
      const text = document.createElement('span'); text.textContent = '['+fact.key+'] '+fact.text; button.append(tag, text); evidenceList.append(button);
    });
    animate(alibiList, [{ opacity: .3, transform: 'translateY(10px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 350, easing: 'ease-out' });
    progress(); alibiList.firstElementChild?.focus({ preventScroll: true }); if (!mobileLayout.matches) alibiList.firstElementChild?.scrollIntoView({ block: 'nearest' });
  }

  function startAlibi() {
    veil.classList.remove('alibi-complete');
    previewReward();
    alibi = newAlibi(state, pet, Math.random, { mode: alibiMode.value === 'auto' ? null : alibiMode.value }); alibiMode.disabled = true;
    notebook.hidden = false; notebook.open = false;
    facts.replaceChildren(...alibi.notebook.map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
    alibiNext.hidden = true; alibiVerdict.textContent = '';
    if (!alibi.rounds.length) {
      alibiCharge.textContent = 'It has nothing to swear to yet. Give it a neighbour, or a little care, and it will find something.';
      status.textContent = 'Not enough shelf to lie about yet.'; start.hidden = false; start.textContent = 'Try again'; alibiMode.disabled = false; return;
    }
    start.hidden = true;
    status.textContent = alibi.mode==='combine' ? 'Select the lie and TWO true records. Both facts together must refute the claim. Keys 1–3 select claims; A–C toggle records.' : alibi.mode !== 'quick' ? 'Select a lie and the record that contradicts it. You can change both before presenting. Keys 1–3 select statements; A–C select records.' : 'Select the lie, then present your accusation. You can change your mind before presenting. Keys 1–3 select statements.';
    renderAlibi();
  }

  function concludeAlibi() {
    veil.classList.add('alibi-complete');
    const result = rewardAlibi(state, alibi, Date.now());
    checkUnlocks(state); checkAchievements(state); refresh();
    const caught = alibi.correct, total = alibi.rounds.length;
    alibiCharge.textContent = alibiRank(alibi) + ' · ' + caught + '/' + total + ' lies found' + (alibi.mode !== 'quick' ? ' · ' + alibi.proved + '/' + total + ' proved.' : '.');
    status.textContent = masteryText(pet,'alibi')+' '+rewardSummary(result, { alibiMode: alibi.mode }) + ' ' + (result?.clean ? 'It is deleting your number with both hands.' : 'The witness leaves. Your chair leaves with it.');
    document.getElementById('playReward').textContent = 'Each game rests separately. Practice always counts in your history.';
    puppet?.gesture(result?.clean ? 'confess' : 'deny'); stage(result?.clean ? 'win' : 'closed', alibiRank(alibi));
    if (result?.clean) playFuss(); progress();
    start.hidden = false; start.textContent = 'Take another statement'; alibiMode.disabled = false; start.focus({ preventScroll: true }); if (!mobileLayout.matches) start.scrollIntoView({ block: 'nearest' });
  }

  alibiNext.addEventListener('click', () => {
    if (mode !== 'alibi' || !alibi || !advanceAlibi(alibi)) return;
    alibiVerdict.textContent = ''; renderAlibi();
  });
  function readyAccusation() {
    accuse.disabled = (alibi.mode==='combine' && (!Array.isArray(exhibit)||exhibit.length!==2)) || accusation === null || (alibi.mode !== 'quick' && exhibit === null);
    accuse.textContent = accusation === null ? 'Select a statement' : alibi.mode !== 'quick' && exhibit === null ? 'Select a record' : 'Present accusation';
    if (accusation !== null) {
      stage('selected', alibi.mode !== 'quick' && exhibit === null ? 'Now connect the evidence' : 'Ready to confront the witness');
      cue.textContent = 'It has stopped blinking.'; puppet?.gesture('inspect');
      selectedClaim.textContent = 'Challenging statement ' + (accusation + 1) + ': “' + currentRound(alibi).statements[accusation] + '”'; selectedClaim.setAttribute('aria-label', 'Change selected statement. ' + currentRound(alibi).statements[accusation]);
    }
  }
  alibiList.addEventListener('click', e => {
    const button = e.target.closest('[data-alibi]');
    if (!button || !alibi || alibi.complete || currentRound(alibi)?.answered !== null) return;
    accusation = Number(button.dataset.alibi); exhibit = null; [...evidenceList.children].forEach(el => el.setAttribute('aria-pressed', 'false'));
    [...alibiList.children].forEach((el, i) => el.setAttribute('aria-pressed', String(i === accusation))); readyAccusation();
    if (alibi.mode !== 'quick') { investigationStep('evidence'); if (mobileLayout.matches) evidenceList.firstElementChild?.focus({ preventScroll: true }); }
  });
  evidenceList.addEventListener('click', e => {
    const button = e.target.closest('[data-exhibit]');
    if (!button || !alibi || alibi.complete || currentRound(alibi)?.answered !== null) return;
    const index=Number(button.dataset.exhibit); if(alibi.mode==='combine'){const selected=Array.isArray(exhibit)?exhibit:[];exhibit=selected.includes(index)?selected.filter(i=>i!==index):[...selected.slice(-1),index];}else exhibit=index; [...evidenceList.children].forEach((el, i) => el.setAttribute('aria-pressed', String(Array.isArray(exhibit)?exhibit.includes(i):i === exhibit))); readyAccusation();
  });
  function changeClaim() { if (currentRound(alibi)?.answered !== null) return; investigationStep('statements'); alibiList.children[accusation ?? 0]?.focus({ preventScroll: true }); }
  selectedClaim.addEventListener('click', changeClaim);
  review.addEventListener('click', () => { const open = veil.dataset.investigationStep !== 'review'; investigationStep(open ? 'review' : 'verdict'); review.textContent = open ? 'Back to verdict' : 'Review statements and records'; });
  accuse.addEventListener('click', () => {
    if (mode !== 'alibi' || !alibi || accusation === null) return;
    const round = currentRound(alibi), verdict = answerAlibi(alibi, accusation, exhibit);
    if (verdict === 'ignored') return;
    accuse.hidden = true; review.hidden = false; selectedClaim.disabled = true; investigationStep('verdict');
    [...alibiList.children].forEach((el, i) => {
      el.disabled = true;
      el.setAttribute('aria-label', 'Statement ' + (i + 1) + '. ' + (i === round.lie ? 'False. ' : 'True. ') + round.statements[i]);
      if (i === round.lie) el.classList.add('was-lie'); else if (i === round.answered) el.classList.add('was-wrong');
      const stamp = document.createElement('small'); stamp.className = 'alibi-stamp'; stamp.textContent = i === round.lie ? 'FALSE' : 'TRUE'; el.append(stamp);
      animate(stamp, [{ opacity: 0, transform: 'scale(1.8) rotate(-12deg)' }, { opacity: 1, transform: 'scale(1) rotate(0)' }], { duration: 260 });
    });
    [...evidenceList.children].forEach((el, i) => { el.disabled = true; const feedback=alibiEvidenceFeedback(round,i); if (feedback) { el.classList.add('proved'); const tag = document.createElement('small'); tag.textContent = feedback; el.append(tag); } });
    const explanation = verdict === 'right' ? (alibi.mode !== 'quick' ? 'Caught and proved. ' : 'Lie caught. ') : verdict === 'unsupported' ? 'Right lie, unrelated evidence. Your record is true, but it does not contradict this claim. ' : 'That statement was true. The false claim is “' + round.statements[round.lie] + '” ';
    alibiVerdict.textContent = explanation + 'On record: ' + round.evidence + ' ' + alibiReaction(round, pet);
    cue.textContent = verdict === 'right' ? 'The witness has developed a tremor.' : 'It asks whether you work alone.';
    puppet?.gesture(verdict === 'right' ? 'confess' : 'deny'); stage(verdict === 'right' ? 'caught' : 'escaped', verdict === 'right' ? 'The record survives' : 'A hole in the case');
    progress();
    if (alibi.complete) concludeAlibi(); else { alibiNext.hidden = false; alibiNext.focus({ preventScroll: true }); if (!mobileLayout.matches) alibiNext.scrollIntoView({ block: 'nearest' }); }
  });
  const autoAlibi=document.createElement('option');autoAlibi.value='auto';autoAlibi.textContent='Continue mastery lesson';alibiMode.prepend(autoAlibi);alibiMode.value='auto';
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
    lock(true); replay.disabled = true; slowerReplay.hidden = true; progress(); paintTrail(); previewReward();
    const ritual = HANDSHAKE_RITUALS[game.ritual || 'echo'];
    ritualGuide.hidden = true;
    status.textContent = ritual.rule + ' ' + handshakeReaction(pet); stage('watch', ritual.name + (game.familiar && game.round === 0 ? ' · your familiar opening' : ' · watch the ritual'));
    const sequence = handshakeDemonstration(game);
    cue.textContent = 'Watch…';
    const names = game.names || GESTURES;
    document.getElementById('playAnnouncement').textContent = ritual.rule + ' Demonstration: ' + sequence.map((g, i) => (game.ritual === 'duet' ? (i % 2 ? 'your beat: ' : 'their beat: ') : '') + GESTURES[g]).join(', ');
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
    lock(false); replay.disabled = false; slowerReplay.hidden = slow.checked; pads[0].focus({ preventScroll: true });
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
    if (document.hidden) pauseHandshake();
  });
  function pauseHandshake() {
    if (mode !== 'memory' || !game || game.complete || !start.hidden || !veil.classList.contains('open')) return;
    cancelStageMotion();
    generation++; lock(true); game.cursor = 0; paintTrail(); pads.forEach(p => p.classList.remove('lit'));
    status.textContent = 'Paused. Replay the pattern when you are ready. Your completed rounds are safe.';
    document.getElementById('playAnnouncement').textContent = status.textContent;
    stage('paused', 'The rehearsal is waiting');
    cue.textContent = 'Take your time'; replay.disabled = false; slowerReplay.hidden = replay.hidden || slow.checked;
  }
  window.addEventListener('blur', pauseHandshake);
  window.addEventListener('shelflife:play', e => {
    pet = state.pets.find(p => p.id === e.detail?.petId);
    if (!pet) return;
    setMode(['memory', 'alibi'].includes(e.detail?.mode) ? e.detail.mode : 'chase'); veil.classList.add('open');
  });
  function conclude() {
    lock(true); replay.disabled = true; slowerReplay.hidden = true;
    const result = reward(game); progress();
    trail.replaceChildren(); trail.setAttribute('aria-label', 'Handshake complete');
    encore.disabled = false; ritualSelect.disabled = false; veil.classList.remove('ritual-active'); stage('win', HANDSHAKE_RITUALS[game.ritual || 'echo'].name + ' ritual complete');
    cue.textContent = 'A secret with ' + pet.name;
    document.getElementById('playAnnouncement').textContent = 'Handshake complete. ' + game.rounds + ' rounds remembered.';
    status.textContent = masteryText(pet,'handshake')+' '+rewardSummary(result) + ' ' + handshakeReaction(pet, 'complete');
    ritualRecordText.textContent = game.rounds + ' rounds · ' + game.mistakes + (game.mistakes === 1 ? ' slip · ' : ' slips · ') + game.replays + (game.replays === 1 ? ' replay.' : ' replays.');
    const bestRun = pet.handshakeBest?.[handshakeRecordKey(game)];
    if (bestRun) ritualRecordText.textContent += ' Personal best: ' + bestRun.rounds + ' rounds with ' + bestRun.mistakes + (bestRun.mistakes === 1 ? ' slip and ' : ' slips and ') + bestRun.replays + (bestRun.replays === 1 ? ' replay.' : ' replays.');
    const memory = handshakeMemory(pet, game.ritual);
    if (memory) ritualRecordText.textContent += ' Your saved opening: ' + memory.opening.map(move => GESTURES[move]).join(', ') + '. ' + memory.completions + ' lessons together.';
    ritualRecord.hidden = false; ritualRecord.open = false;
    puppet.gesture('win'); playFuss();
    start.hidden = false; start.textContent = 'Another lesson'; replay.hidden = true; again.hidden = false; start.focus({ preventScroll: true });
  }
  start.addEventListener('click', () => {
    if (mode === 'alibi') { startAlibi(); return; }
    if (!game || game.complete) setMode('memory');
    ritualRecord.hidden = true;
    encore.disabled = true; ritualSelect.disabled = true; memoryOptions.open = false; workspace.scrollTop = 0; veil.classList.add('ritual-active'); start.hidden = true; replay.hidden = false; again.hidden = true; demonstrate();
  });
  again.addEventListener('click', () => { if (mode !== 'memory' || !game?.complete) return; game = restartHandshake(game); ritualRecord.hidden = true; encore.disabled = true; ritualSelect.disabled = true; memoryOptions.open = false; workspace.scrollTop = 0; veil.classList.add('ritual-active'); start.hidden = true; again.hidden = true; replay.hidden = false; demonstrate(); });
  ritualSelect.addEventListener('change', () => { if (pet && mode === 'memory' && !ritualSelect.disabled) setMode('memory'); });
  function replayPattern(slower = false) {
    if (!replayHandshake(game)) return;
    if (slower) slow.checked = true;
    demonstrate();
  }
  replay.addEventListener('click', () => replayPattern());
  slowerReplay.addEventListener('click', () => replayPattern(true));
  encore.addEventListener('change', () => { if (pet && mode === 'memory') setMode('memory'); });
  document.addEventListener('keydown', e => {
    if (mode === 'alibi' && veil.classList.contains('open')) {
      const shortcut = alibiShortcut(e, alibi);
      if (shortcut) {
        // On a phone, evidence is not visible until a statement is selected.
        if (shortcut.type === 'evidence' && accusation === null) return;
        const choices = shortcut.type === 'evidence' ? evidenceList : alibiList;
        const choice = choices.children[shortcut.index];
        if (choice && !choice.disabled) { e.preventDefault(); choice.click(); }
      }
      return;
    }
    if (mode !== 'memory' || !accepting || !veil.classList.contains('open') || e.repeat || !acceptsGameShortcut(e)) return;
    if (/^[1-4]$/.test(e.key)) { e.preventDefault(); pads[Number(e.key) - 1].click(); }
  });
  pads.forEach((pad, i) => pad.addEventListener('click', () => {
    if (!accepting || !game) return;
    const result = tapHandshake(game, i); paintTrail();
    animate(pad, [{transform:'scale(.94)'},{transform:'scale(1)'}], {duration:180});
    cue.textContent = GESTURES[i];
    puppet.gesture(result === 'retry' ? 'bump' : GESTURES[i].toLowerCase());
    if (navigator.vibrate) navigator.vibrate(8);
    if (result === 'retry') {
      lock(true); generation++; stage('retry', 'Same round. Another rehearsal.'); cue.textContent = 'No harm done.';
      status.textContent = handshakeReaction(pet, 'retry') + ' Watch the same pattern again. Completed rounds stay safe.';
      replay.disabled = false; slowerReplay.hidden = slow.checked; replay.focus({ preventScroll: true });
      return;
    }
    if (result === 'correct') { status.textContent = game.cursor + ' of ' + handshakePattern(game).length + ' remembered. ' + (game.ritual === 'mirror' ? 'Keep working backwards.' : game.ritual === 'duet' ? 'Your beats only.' : 'Keep going.'); return; }
    lock(true); replay.disabled = true; slowerReplay.hidden = true;
    if (result === 'round') {
      stage('round', 'Round ' + game.round + ' remembered'); cue.textContent = pet.name + ' moves a little closer.';
      animate(host, [{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(8px) scale(1.06)', offset: .65 }, { transform: 'translateY(0) scale(1)' }], { duration: 650, easing: 'ease-out' });
      status.textContent = 'Round ' + game.round + ' complete. Next: ' + handshakePattern(game).length + ' moves. Start when you are ready.';
      progress(); start.hidden = false; start.textContent = 'Watch round ' + (game.round + 1); replay.hidden = true;
      start.focus({ preventScroll: true });
    }
    if (result === 'complete') conclude();
  }));
}

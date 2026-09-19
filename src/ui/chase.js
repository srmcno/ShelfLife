import { CHASE_STAGES, CHASE_CHAPTERS, chaseStage, campaignProgress, normalizeChaseCampaign } from '../content/chase-campaign.js';
import { CHASE_VENUES, chaseRecordKey, chaseStarTarget, chaseCoaching, newChase, updateChase, jumpChase, dashChase, recordChase, chaseStars, streakMultiplier, CHASE_WIDTH, CHASE_HEIGHT, CHASE_GROUND, RUN_WAVES, RUN_UPGRADES, RUN_WAVE_SECONDS, chaseDuration, chaseWaveTime, chaseWaveContract, selectChaseUpgrade, advanceChaseWave } from '../engine/chase.js';
import { moodOf } from '../engine/tick.js';
import { rewardSummary } from './reward-summary.js';
import { chaseKeyAction } from './game-controls.js';
import { renderPetSprite } from '../art/sprite.js';
import { createPuppet } from '../art/animator.js';
import { playFeed, playFuss, playClean, playStomp, playPowerUp, playStar } from '../audio/sound.js';
import { chaseContractOptions, selectChaseContract } from '../engine/chase.js';

const CRUMB = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 4 10-2 7 9-6 11L3 18 1 10Z" fill="currentColor"/><path d="m7 7 6-1m-5 9 5 2" stroke="#fff4cc" stroke-width="2" stroke-linecap="round"/></svg>';
const BUNNY = '<svg viewBox="0 0 40 34" aria-hidden="true"><path d="M7 18C-1 3 8-2 14 14 11-5 25-3 23 12 36 4 40 17 32 22c8 13-29 15-27 3Z" fill="#998399"/><path d="m4 21-4-3m5 8-5 2m34-9 5-3m-5 10 6 2" stroke="#cdbdce" stroke-width="2"/><circle cx="15" cy="22" r="3" fill="#261b2b"/><circle cx="26" cy="22" r="3" fill="#261b2b"/><path d="m19 29 4-1" stroke="#261b2b" stroke-width="2"/></svg>';

const MOTH = '<svg viewBox="0 0 40 30" aria-hidden="true"><path d="M19 15C12 2 2 4 3 12c1 7 8 10 16 6Z" fill="#cdb98f"/><path d="M21 15c7-13 17-11 16-3-1 7-8 10-16 6Z" fill="#cdb98f"/><path d="M19 15c-6 3-9 8-6 12 3 1 6 0 7-4Z" fill="#b39f78"/><path d="M21 15c6 3 9 8 6 12-3 1-6 0-7-4Z" fill="#b39f78"/><ellipse cx="20" cy="17" rx="3" ry="8" fill="#5a4a3c"/><path d="m18 10-4-6m8 6 4-6" stroke="#5a4a3c" stroke-width="1.5" stroke-linecap="round"/><circle cx="9" cy="11" r="2" fill="#5a4a3c"/><circle cx="31" cy="11" r="2" fill="#5a4a3c"/></svg>';
const BISCUIT = '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14" fill="#c98f4c"/><circle cx="16" cy="16" r="11" fill="none" stroke="#e2b276" stroke-width="2" stroke-dasharray="3 3"/><circle cx="11" cy="13" r="1.6" fill="#7a4a22"/><circle cx="19" cy="11" r="1.6" fill="#7a4a22"/><circle cx="21" cy="19" r="1.6" fill="#7a4a22"/><circle cx="13" cy="21" r="1.6" fill="#7a4a22"/><circle cx="27" cy="7" r="5" fill="#2a2230"/></svg>';
const SUGAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8l8-4 8 4-8 4Z" fill="#fbf8ff"/><path d="M4 8v9l8 4v-9Z" fill="#d9d0ec"/><path d="M20 8v9l-8 4v-9Z" fill="#bfb2dd"/><path d="m7 6 2-1M9 15v3m6-3v3" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".7"/></svg>';
const BROOM = '<svg viewBox="0 0 152 54" aria-hidden="true"><path d="m20 7 119 0" stroke="#b9957d" stroke-width="7" stroke-linecap="round"/><path d="m14 5 6 39h42L51 5Z" fill="#c9a661"/><path d="m24 13 3 27m8-27 3 27m7-27 5 27" stroke="#806042" stroke-width="3"/></svg><span>BROOM · HOP OR CROSS</span>';
const ART = { crumb: CRUMB, bunny: BUNNY, moth: MOTH, biscuit: BISCUIT, sugar: SUGAR, broom: BROOM };
// Deadpan end-screen copy. Short, dry, four inches tall.
const QUIPS = {
  lost: ['The crumbs remain at large.', 'Immortal. Outrun by bread.', 'It has requested a smaller floor.', 'It maintains the floor moved.', 'Nothing was lost except the crumbs. And the round.'],
  two: ['Adequate. It will not say so.', 'Serious work, four inches tall.', 'It will accept praise now. Briefly.'],
  three: ['Flawless. It will be unbearable about this.', 'Three stars. Nobody saw. It knows.', 'The dust has requested a meeting.', 'The dust bunny left a tiny will. You ate it.'],
  best: ['A new record. The pride was already there.', 'The old best has been quietly disowned.', 'It scratched the score into the wood. With a tooth.', 'It would like this noted in the museum.']
};

// Immediate touch feedback with native-click and assistive-input fallback.
export function wireChaseAction(button,action,active) {
 let firedOnPress=false;
 button.addEventListener('pointerdown',e=>{if(!active()||e.button!==0)return;e.preventDefault();firedOnPress=true;action();});
 // Touch browsers can dispatch the compatibility click after a delay. Keeping
 // this flag until that click avoids consuming a second flap from one press.
 button.addEventListener('pointercancel',()=>{firedOnPress=false;});
 button.addEventListener('click',e=>{if(active()&&(e.detail===0||!firedOnPress))action();firedOnPress=false;});
}

// A keyboard key and a finger may hold the same direction. Releasing either
// must only remove its own input; it must not cancel the other held control.
export function createChaseInput() {
  const sources = new Map();
  return {
    hold(source, direction) { if (direction === 'left' || direction === 'right') sources.set(source, direction); },
    release(source) { sources.delete(source); },
    clear() { sources.clear(); },
    get axis() { const directions = new Set(sources.values()); return Number(directions.has('right')) - Number(directions.has('left')); }
  };
}

export function createChaseUI(root, onFinish, reportStatus, onPhase = () => {}) {
  const announcement = document.createElement('p'); announcement.className = 'sr-only'; announcement.setAttribute('role', 'status'); root.append(announcement);
  const onStatus = text => { announcement.textContent = text; reportStatus(text); };
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
  const dash = document.createElement('button');
  dash.type = 'button'; dash.id = 'chaseDash'; dash.className = 'btn chase-dash'; dash.textContent = 'Dash →';
  dash.title = 'Burst in your steering direction and smash dust. Recharges in 2.4 seconds; catches recharge it sooner. Keyboard: X.';
  // Restore the original left / hop / right thumb layout. Dash is secondary.
  hop.parentElement.append(directions[0], hop, directions[1]);
  const controls = [...directions, hop, dash];
  field.setAttribute('aria-label', 'Crumb Chase. Drag to steer or use arrow keys. Space hops. X dashes in your steering direction and smashes dust bunnies. P pauses or resumes.');
  const world = root.querySelector('#chaseWorld'), clockFill = root.querySelector('#chaseClockFill');
  const scene = document.createElement('div'); scene.className = 'chase-depth'; scene.setAttribute('aria-hidden', 'true');
  scene.innerHTML = '<i class="chase-orb"></i><i class="chase-bottles"></i><i class="chase-rib"></i><i class="chase-scene-rail"></i>';
  world.before(scene);
  const waveBanner = document.createElement('div'); waveBanner.className = 'chase-wave-banner'; waveBanner.setAttribute('aria-live', 'polite');
  const loadout = document.createElement('div'); loadout.className = 'chase-loadout';
  const upgrades = document.createElement('div'); upgrades.className = 'chase-upgrades'; upgrades.hidden = true; go.before(upgrades);
  const contractPicker = document.createElement('fieldset'); contractPicker.className = 'chase-contract-picker'; contractPicker.hidden = true;
  const contractTitle = document.createElement('legend'); contractTitle.textContent = 'Choose the next contract';
  const contractChoices = document.createElement('div'); contractChoices.className = 'chase-contract-choices'; contractPicker.append(contractTitle, contractChoices);
  upgrades.before(contractPicker);
  const objective = root.querySelector('#chaseObjective');
  const venuePicker = root.querySelector('#chaseVenue');
  const practiceTools = document.createElement('div');
  practiceTools.className = 'chase-practice-tools';
  practiceTools.innerHTML = '<label class="chase-challenge">Side quest<select id="chaseChallenge"><option value="rotate">A different challenge each run</option><option value="combo">Build a streak of 6</option><option value="air">Make 3 airborne catches</option><option value="biscuit">Catch a whole biscuit</option></select></label><label class="chase-repeat"><input type="checkbox" id="chaseRepeat"> Practise the same course</label>';
  venuePicker.closest('label').after(practiceTools);
  const settings = document.createElement('details'), settingsSummary = document.createElement('summary');
  settings.className = 'chase-settings'; settingsSummary.textContent = 'Ground & side quest';
  settings.open = false;
  venuePicker.closest('label').before(settings);
  settings.append(settingsSummary, venuePicker.closest('label'), practiceTools);
  const formatPicker = document.createElement('div'); formatPicker.className = 'chase-formats'; formatPicker.setAttribute('role', 'group'); formatPicker.setAttribute('aria-label', 'Chase length');
  formatPicker.innerHTML = '<button type="button" class="btn" data-chase-format="campaign" aria-pressed="true"><b>Household lessons</b><span>12 stages · 3 chapters</span></button><button type="button" class="btn" data-chase-format="quick" aria-pressed="false"><b>Quick Chase</b><span>22 seconds</span></button><button type="button" class="btn" data-chase-format="run" aria-pressed="false"><b>Midnight Run</b><span>3 acts · choose your upgrades</span></button>';
  settings.before(formatPicker); settings.after(waveBanner, loadout);
  let format = 'campaign', selectedStage = null;
  const campaignSetup = document.createElement('div'); campaignSetup.className = 'chase-campaign-setup';
  const stageLabel = document.createElement('label'); stageLabel.textContent = 'Lesson · replay any unlocked stage';
  const stagePicker = document.createElement('select'); stagePicker.id = 'chaseStage'; stageLabel.append(stagePicker);
  const campaignPace = document.createElement('label'); campaignPace.className = 'chase-campaign-pace';
  const paceCheck = document.createElement('input'); paceCheck.type = 'checkbox'; paceCheck.checked = true;
  campaignPace.append(paceCheck, document.createTextNode(' Gentle catches & longer warnings'));
  const mirrorOption = document.createElement('label'); mirrorOption.className = 'chase-campaign-pace'; mirrorOption.hidden = true;
  const mirrorCheck = document.createElement('input'); mirrorCheck.type = 'checkbox'; mirrorCheck.id = 'chaseMirror';
  mirrorOption.append(mirrorCheck, document.createTextNode(' Mirror route on this replay'));
  mirrorCheck.addEventListener('change', () => { if (pet) controller.prepare(pet, gentle); });
  const campaignInfo = document.createElement('p'); campaignInfo.className = 'chase-campaign-info';
  campaignSetup.append(stageLabel, campaignPace, mirrorOption, campaignInfo);
  stagePicker.addEventListener('change', () => { selectedStage = stagePicker.value; if (pet) controller.prepare(pet, gentle); });
  paceCheck.addEventListener('change', () => { if (pet) controller.prepare(pet, gentle); });
  formatPicker.addEventListener('click', e => {
    const button = e.target.closest('[data-chase-format]');
    if (!button || running || game?.awaitingChoice) return;
    format = button.dataset.chaseFormat;
    for (const option of formatPicker.children) option.setAttribute('aria-pressed', String(option === button));
    courseSeed = null; courseObjective = null;
    if (pet) controller.prepare(pet, gentle);
  });
  const challengePicker = practiceTools.querySelector('#chaseChallenge'), repeatCourse = practiceTools.querySelector('#chaseRepeat');
  const starTarget = document.createElement('p'); starTarget.className = 'chase-star-target';
  objective.after(starTarget);
  // Desktop keeps its familiar inline layout. A phone gets one bounded arena,
  // and setup/results use the whole workspace instead of a tiny field inset.
  const mobileLayout = window.matchMedia('(max-width: 720px), (max-height: 500px)');
  const arena = document.createElement('div'); arena.className = 'chase-arena';
  field.before(arena); arena.append(field);
  const hudStrip = document.createElement('div'); hudStrip.className = 'chase-hud-strip';
  const hud = root.querySelector('.chase-hud'), clock = root.querySelector('.chase-clock');
  hud.before(hudStrip); hudStrip.append(hud, clock);
  const readout = document.createElement('div'); readout.className = 'chase-readout';
  combo.before(readout); readout.append(combo, objective, starTarget);
  const mobileProgress = document.createElement('p'); mobileProgress.className = 'chase-mobile-progress'; readout.append(mobileProgress);
  readout.append(dash);
  const overlayScroll = document.createElement('div'); overlayScroll.className = 'chase-overlay-scroll';
  const overlayFooter = document.createElement('div'); overlayFooter.className = 'chase-overlay-footer';
  overlay.prepend(overlayScroll); overlayScroll.append(title, stars, description, quip, contractPicker, upgrades);
  const resultDetails = document.createElement('details'); resultDetails.className = 'chase-result-details'; resultDetails.hidden = true;
  const resultTitle = document.createElement('summary'); resultTitle.textContent = 'Run details & contracts';
  const resultText = document.createElement('p'); resultDetails.append(resultTitle, resultText); overlayScroll.append(resultDetails);
  const coaching = document.createElement('p'); coaching.className = 'chase-coaching'; coaching.hidden = true;
  description.after(coaching);
  const guide = document.createElement('details'); guide.className = 'chase-guide';
  const guideSummary = document.createElement('summary'); guideSummary.textContent = 'What to catch & how to play';
  const guideItems = document.createElement('div'); guideItems.className = 'chase-guide-items';
  for (const [art, label, explanation] of [
    [CRUMB, 'Crumbs count toward your goal', 'Ordinary: 10 points. Gold: 30. Pick them up in the air or from the floor.'],
    [BISCUIT, 'Biscuits are bonus points', 'Catch before they land for 50 points. They do not add to your crumb count.'],
    [BUNNY, 'Dust breaks your streak', 'Hop over it, land on it, or Dash through it. A bump costs up to 5 points.'],
    [SUGAR, 'Sugar makes you faster', 'Touch the cube for a short burst of speed and a crumb magnet.'],
    [MOTH, 'Moths steal floor crumbs', 'Catch one for 20 points. A carrying moth also returns one crumb to your goal.']
  ]) {
    const row = document.createElement('div'), icon = document.createElement('span'), text = document.createElement('span');
    const name = document.createElement('b'), detail = document.createElement('span');
    icon.innerHTML = art; icon.setAttribute('aria-hidden', 'true'); name.textContent = label; detail.textContent = explanation;
    text.append(name, detail); row.append(icon, text); guideItems.append(row);
  }
  const guideControls = document.createElement('p');
  guideControls.textContent = 'Hold ← or → to move, or drag the arena. Hop: Space or ↑. Dash: X. Pause or resume: P. Catch streaks multiply points: ×2 at 4, ×3 at 8. Missed crumbs trim the streak by 2; dust and theft break it.';
  guide.append(guideSummary, guideItems, guideControls); overlayScroll.append(guide);
  const pausePortrait = document.createElement('figure'); pausePortrait.className = 'chase-pause-portrait'; pausePortrait.hidden = true;
  const pauseResident = document.createElement('div'); pauseResident.className = 'chase-pause-resident'; pauseResident.setAttribute('aria-hidden', 'true');
  const pauseCaption = document.createElement('figcaption'); pausePortrait.append(pauseResident, pauseCaption); overlayScroll.append(pausePortrait);
  overlay.append(overlayFooter); overlayFooter.append(go);
  const configure = document.createElement('button'); configure.type = 'button'; configure.className = 'btn btn-ghost'; configure.textContent = 'Change setup'; configure.hidden = true;
  overlayFooter.append(configure);
  const restart = document.createElement('button'); restart.type = 'button'; restart.id = 'chaseRestart'; restart.className = 'btn btn-ghost'; restart.textContent = 'Restart this course'; restart.hidden = true;
  restart.title = 'Start from zero with the same course and side quest. The unfinished attempt earns no result.';
  overlayFooter.append(restart);
  const mobileSetup = document.createElement('div'); mobileSetup.className = 'chase-mobile-setup';
  const mobileGuide = document.createElement('p'); mobileGuide.className = 'chase-mobile-guide'; mobileSetup.append(mobileGuide);
  overlayScroll.append(mobileSetup);
  description.after(campaignSetup);
  const markers = new Map();
  settings.append(formatPicker);
  for (const element of [settings, overlay]) {
    const marker = document.createComment('chase original position'); element.before(marker); markers.set(element, marker);
  }
  const gentleOption = document.getElementById('gentleOption');
  if (gentleOption) { const marker = document.createComment('gentle original position'); gentleOption.before(marker); markers.set(gentleOption, marker); }
  const screen = value => {
    root.dataset.chaseScreen = value; campaignSetup.hidden = value !== 'setup' || format !== 'campaign'; configure.hidden = value !== 'result'; mobileSetup.hidden = value !== 'setup';
    guide.hidden = !['setup', 'paused'].includes(value); coaching.hidden = value !== 'result';
    restart.hidden = value !== 'paused'; pausePortrait.hidden = value !== 'paused'; onPhase(value);
    contractPicker.hidden = value !== 'upgrade'; resultDetails.hidden = value !== 'result'; resultDetails.open = false;
  };
  function fitLayout() {
    if (mobileLayout.matches) {
      mobileSetup.append(settings);
      settings.open = false;
      if (gentleOption) settings.append(gentleOption);
      root.append(overlay);
    } else {
      for (const [element, marker] of markers) marker.after(element);
    }
    requestAnimationFrame(measure);
  }
  mobileLayout.addEventListener('change', fitLayout);
  configure.addEventListener('click', () => { if (pet) controller.prepare(pet, gentle); });
  let courseSeed = null, courseObjective = null;
  venuePicker.addEventListener('change',()=>{if(pet)controller.prepare(pet,gentle);});
  challengePicker.addEventListener('change', () => { courseObjective = null; if (pet) controller.prepare(pet, gentle); });
  repeatCourse.addEventListener('change', () => {
    if (repeatCourse.checked && game?.finished) { courseSeed = game.seed; courseObjective = game.objective?.id; }
    else if (!repeatCourse.checked) { courseSeed = null; courseObjective = null; }
  });
  const nodes = new Map(), held = createChaseInput();
  let fieldBox = null, hudKey = '', popAnimation = null, runNumber = 0;
  function measure() {
    if (mobileLayout.matches) {
      const box = arena.getBoundingClientRect();
      if (box.width > 0 && box.height > 0) {
        const width = Math.floor(Math.min(box.width, box.height * CHASE_WIDTH / CHASE_HEIGHT));
        field.style.width = width + 'px'; field.style.height = (width * CHASE_HEIGHT / CHASE_WIDTH) + 'px';
      }
    } else { field.style.removeProperty('width'); field.style.removeProperty('height'); }
    fieldBox = field.getBoundingClientRect();
    if (fieldBox.width > 2) world.style.transform = 'scale(' + (field.clientWidth / CHASE_WIDTH) + ')';
  }
  const fieldObserver = new ResizeObserver(measure); fieldObserver.observe(field); fieldObserver.observe(arena);
  window.addEventListener('resize', measure);
  const setText = (el, value) => { if (el.textContent !== String(value)) el.textContent = String(value); };
  let pet = null, game = null, puppet = null, running = false, paused = false, gentle = false;
  let frameId = 0, lastTime = 0, targetX = null, pointerId = null, goalCelebrated = false;
  const resetInput = () => { held.clear(); targetX = null; pointerId = null; };
  const stopFrame = () => { cancelAnimationFrame(frameId); frameId = 0; running = false; field.classList.remove('is-running'); resetInput(); };
  function disabled(value) { controls.forEach(b => { b.disabled = value; }); pauseButton.disabled = value; }
  function message(text, kind = '') {
    pop.textContent = text; pop.className = 'chase-pop ' + kind;
    popAnimation?.cancel();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    popAnimation = pop.animate(reduced ? [{ opacity: 1 }, { opacity: 0 }] : [{opacity:0,translate:'0 5px'},{opacity:1,translate:'0 0',offset:.12},{opacity:1,offset:.75},{opacity:0,translate:'0 -4px'}], {duration:1250,fill:'both'});
  }
  // One-shot effects: a floating score pop or a landing dust puff at a board position.
  function spark(kind, x, z, text = '') {
    if (document.hidden || kind !== 'float' && (document.body.dataset.effects === 'light' || window.matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    if (fx.children.length >= 10) fx.firstElementChild.remove();
    const node = document.createElement('div'); node.className = 'chase-' + kind; node.textContent = text;
    node.style.left = x / CHASE_WIDTH * 100 + '%'; node.style.bottom = (CHASE_GROUND + z) / CHASE_HEIGHT * 100 + '%';
    fx.appendChild(node); setTimeout(() => node.remove(), kind === 'float' ? 900 : 500);
  }
  // A stomped bunny leaves the engine at once; its node stays behind just long enough to flatten.
  function squash(id) {
    const node = nodes.get(id); if (!node) return;
    nodes.delete(id); node.classList.add('squashed'); setTimeout(() => node.remove(), 480);
  }
  function shake() { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; field.classList.add('shake'); setTimeout(() => field.classList.remove('shake'), 350); }
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
      node = document.createElement('div'); node.className = 'chase-item ' + item.kind + (item.gold ? ' gold' : '') + (item.finale ? ' finale' : '');
      node.innerHTML = ART[item.kind] || CRUMB;
      node.setAttribute('aria-hidden', 'true'); node.dataset.kind = item.kind;
      nodes.set(item.id, node); items.appendChild(node);
    }
    const warning = (item.kind === 'bunny' || item.kind === 'broom') && item.warning > 0;
    const x = warning && item.kind === 'bunny' ? (item.vx > 0 ? 18 : CHASE_WIDTH - 18) : item.x;
    node.classList.toggle('warning', warning);
    node.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + (-CHASE_GROUND - item.z).toFixed(2) + 'px,0) translate(-50%,50%)';
    node.style.setProperty('--tumble', tumbleOf(item) + 'deg');
    if (item.kind === 'moth') node.classList.toggle('carrying', !!item.carrying);

  }
  function paint() {
    if (!game) return;
    const p = game.player;
    actor.style.transform = 'translate3d(' + p.x.toFixed(2) + 'px,' + (-CHASE_GROUND - p.z).toFixed(2) + 'px,0) translateX(-50%)';
    actor.classList.toggle('protected', p.invincible > 0);
    field.classList.toggle('rush', running && game.rush > 0);
    field.classList.toggle('dashing', running && p.dash > 0);
    field.classList.toggle('is-running', running);
    field.classList.toggle('final-call', running && game.finaleStarted);
    field.dataset.venue = game.venue;
    field.style.setProperty('--track', ((160 - p.x) * .04).toFixed(1) + 'px');
    actor.style.setProperty('--dash-side', p.direction < 0 ? '1' : '-1');
    shadow.style.translate = p.x.toFixed(2) + 'px 0';
    shadow.style.scale = String(Math.max(.35, 1 - p.z / 170));
    shadow.style.opacity = String(Math.max(.1, .45 - p.z / 260));
    puppet.move(running && p.moving, p.direction, p.z > 3);
    const stageSeconds = game.format === 'run' ? RUN_WAVE_SECONDS : chaseDuration(game);
    clockFill.style.transform = 'scaleX(' + Math.max(0, 1 - chaseWaveTime(game) / stageSeconds) + ')';
    const seconds = Math.max(0, Math.ceil(stageSeconds - chaseWaveTime(game)));
    const record = game.format === 'campaign' ? pet?.chaseCampaign?.records?.[game.stageId] : pet?.chaseRecords?.[chaseRecordKey(game)];
    const quest = game.objective, questProgress = quest ? Math.min(quest.target, game[quest.stat]) : 0;
    const recharge = Math.ceil(p.dashCooldown * 10) / 10;
    const contract = chaseWaveContract(game);
    const key = [game.caught, game.score, seconds, game.combo, running, paused, record?.score, quest?.done, questProgress, recharge, p.direction, game.finaleCaught, game.finaleWarned, game.finaleStarted, game.wave, contract?.progress, game.airCatches, game.dashSmashes, game.biscuits, game.rescued, game.rushCatches, game.highCatches, game.safeCrossings, game.leftCaught, game.rightCaught, game.bumps].join('|');
    if (key !== hudKey) {
      hudKey = key;
      setText(count, game.caught + ' / ' + game.goal); count.classList.toggle('met', game.caught >= game.goal);
      setText(score, game.score); setText(best, record?.score ?? '–');
      best.classList.toggle('beaten', !!record && game.score > record.score);
      setText(time, seconds + 's'); time.classList.toggle('urgent', seconds <= 5);
      dash.disabled = !running || recharge > 0;
      dash.classList.toggle('ready', running && recharge === 0);
      setText(dash, recharge > 0 ? 'Dash ' + recharge.toFixed(1) + 's' : 'Dash ' + (p.direction < 0 ? '←' : '→'));
      dash.setAttribute('aria-label', recharge > 0 ? 'Dash recharging, ' + recharge.toFixed(1) + ' seconds' : 'Dash ' + (p.direction < 0 ? 'left' : 'right') + '. Smashes dust bunnies.');
      field.classList.toggle('urgent', running && seconds <= 5);
      waveBanner.hidden = !contract; loadout.hidden = !game.upgrades.length;
      if (contract) setText(waveBanner, 'ACT ' + (game.wave + 1) + '/3 · ' + contract.name + ' · ' + Math.min(contract.progress, contract.target) + '/' + contract.target + ' ' + contract.goal + ' · +' + contract.bonus);
      setText(mobileProgress, contract ? 'Act ' + (game.wave + 1) + '/3 · ' + Math.min(contract.progress, contract.target) + '/' + contract.target + ' ' + contract.goal + ' · ×' + streakMultiplier(game.combo)
        : 'Streak ' + game.combo + ' · ×' + streakMultiplier(game.combo) + (quest ? (quest.done ? ' · Side quest ✓ +40' : ' · ' + quest.label + ' · ' + questProgress + '/' + quest.target) : ''));
      setText(loadout, game.upgrades.map(id => RUN_UPGRADES[id].name).join(' · '));
      paintCombo();
      root.dataset.score = game.score; root.dataset.caught = game.caught;
      root.dataset.running = String(running); root.dataset.paused = String(paused);
      objective.textContent = quest ? (quest.done ? '✓ Side quest complete · +40 points' : 'Side quest: ' + quest.label + ' · ' + questProgress + '/' + quest.target + ' · +40 points') : '';
      objective.classList.toggle('complete', !!game.objective?.done);
      const target = chaseStarTarget(game);
      starTarget.textContent = target.stars === 2 ? '★★ Win: ' + target.crumbs + ' more crumbs' : target.crumbs || target.points || target.contracts
        ? '★★★ Next: ' + [target.crumbs ? target.crumbs + ' more crumbs' : '', target.points ? target.points + ' more points' : '', target.contracts ? target.contracts + ' contracts' : ''].filter(Boolean).join(' + ')
        : '★★★ Three-star target reached';
      if (game.format === 'campaign') {
        const progress = campaignProgress(game);
        setText(count, progress.requirements.filter(r => r.done).length + '/' + progress.requirements.length + ' goals');
        count.classList.toggle('met', progress.done);
        setText(objective, progress.text); setText(mobileProgress, progress.text);
        starTarget.textContent = progress.stage.lesson;
        waveBanner.hidden = false; setText(waveBanner, (game.mirror ? 'MIRRORED REPLAY · ' : '') + 'CHAPTER ' + progress.stage.chapter + '/3 · LESSON ' + (progress.stage.index + 1) + '/12 · ' + progress.stage.name);
      }
      if (game.finaleStarted) starTarget.textContent += game.finaleComplete ? ' · Gold sweep ✓ +60' : ' · Gold sweep ' + game.finaleCaught + '/5';
      else if (game.finaleWarned) starTarget.textContent += ' · Gold soon: get near either edge';
    }
    const present = new Set();
    for (const item of game.items) { present.add(item.id); paintItem(item); }
    for (const [id, node] of nodes) if (!present.has(id)) { node.remove(); nodes.delete(id); }
  }
  const pick = list => list[(game.score + game.caught) % list.length];
  function quipFor(rating, newBest) {
    const traits = pet.traits || [];
    if (traits.some(id => ['clingy', 'sugar', 'lifecoach', 'porcelain'].includes(id))) return game.complete ? pet.name + ' pushes the best crumb toward you, then sits on it so you have to stay.' : pet.name + ' leans against you. Apparently the important part was having an accomplice.';
    if (traits.some(id => ['spiteful', 'bitey', 'feral', 'napoleon'].includes(id))) return game.complete ? pet.name + ' bites the winning crumb into smaller losing crumbs.' : pet.name + ' stares at the carpet until it becomes awkward for the carpet.';
    if (traits.some(id => ['haunted', 'cult', 'undertaker', 'cryptid'].includes(id))) return game.complete ? pet.name + ' saves one crumb for whatever lives behind the wall. Something taps thank you.' : pet.name + ' lays a crumb-shaped shadow beside you. It appears to be a consolation prize.';
    if (traits.some(id => ['damp', 'fungal'].includes(id))) return game.complete ? pet.name + ' sits on the haul. The biscuits are becoming a single damp biscuit.' : pet.name + ' leaves a damp trail spelling something unkind about traction.';
    if (!game.complete) return newBest ? 'A personal best, technically. The bar was on the floor.' : pick(QUIPS.lost);
    return pick(newBest ? QUIPS.best : rating === 3 ? QUIPS.three : QUIPS.two);
  }
  function summary(reward) {
    const n = (count, word) => count + ' ' + word + (count === 1 ? '' : /(?:s|sh|ch|x|z)$/.test(word) ? 'es' : 's');
    const contracts = game.format === 'run' ? 'Contracts: ' + game.waveResults.filter(result => result.bonus > 0).length + '/3. ' : '';
    const line = contracts + n(game.caught, 'crumb') + ' · ' + n(game.dodged, 'dodge') + ' · ' + n(game.stomps, 'stomp') + ' · ' + n(game.dashSmashes, 'dash smash') + ' · ' + n(game.score, 'point') + ' · best streak ' + game.bestCombo + ' · ' + n(game.airCatches, 'air catch') + ' · ' + n(game.bumps, 'bump') + (game.finaleComplete ? ' · Gold sweep +60' : '') + '. ';
    resultText.textContent = line + (game.format === 'run' ? game.waveResults.map((result, index) => 'Act ' + (index + 1) + ': ' + result.name + ', ' + result.progress + '/' + result.target + ' ' + result.goal + ', +' + result.bonus + ' points.').join(' ') : '') + (game.upgrades.length ? ' Equipment: ' + game.upgrades.map(id => RUN_UPGRADES[id].name).join(', ') + '.' : '');
    const scoreline = pet.name + ' caught ' + game.caught + '/' + game.goal + ' crumbs · ' + game.score + ' points. ';
    if (!game.complete) return scoreline + 'No shelf needs were lost. Your personal best stays saved; another attempt can improve it.';
    return scoreline + rewardSummary(reward);
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
    venuePicker.disabled=false;
    challengePicker.disabled = false; repeatCourse.disabled = false;
    for (const button of formatPicker.children) button.disabled = false;
    stopFrame(); paused = false; root.dataset.finished = 'true'; disabled(true);
    screen('result');
    const previous = game.format === 'campaign' ? pet.chaseCampaign?.records?.[game.stageId] : pet.chaseRecords?.[chaseRecordKey(game)];
    const newBest = !previous || game.score > previous.score;
    recordChase(pet, game);
    const reward = onFinish(game), rating = chaseStars(game);
    paint();
    title.textContent = game.complete ? (newBest ? 'A new personal best!' : rating === 3 ? 'Three stars. Insufferable.' : 'Crumb bandit.') : 'One more chase?';
    description.textContent = summary(reward);
    if (game.format === 'campaign') {
      const stage = chaseStage(game.stageId), next = CHASE_STAGES[stage.index + 1];
      title.textContent = (game.complete ? 'Lesson complete: ' : 'Try the lesson again: ') + stage.name;
      description.textContent = campaignProgress(game).text + '. ' + (game.complete ? (reward?.practice ? (pet.chaseCampaign?.records?.[game.stageId]?.rewarded ? 'Practice recorded. This lesson’s mastery reward is already claimed. ' : 'Clear saved. Its mastery reward is still available on a later rested replay. ') : rewardSummary(reward) + ' ') + (next ? 'Unlocked next: ' + next.name + '. ' + next.lesson : 'All twelve lessons complete. Every course is open for practice.') : 'No progress lost. ' + stage.lesson);
    }
    coaching.textContent = chaseCoaching(game);
    showStars(rating); quip.textContent = quipFor(rating, newBest); quip.hidden = false;
    overlay.classList.toggle('best', newBest);
    if (game.complete) { puppet.gesture('win'); playFuss(); playStar({ step: rating, delay: .3 }); }
    else if (newBest) playStar({ step: 1 });
    upgrades.hidden = true; go.hidden = false;
    go.textContent = game.format === 'campaign' ? (game.complete && chaseStage(game.stageId).index < 11 ? 'Next lesson' : 'Practise this lesson') : game.format === 'run' ? 'Another midnight run' : 'Chase again'; overlay.hidden = false; overlay.scrollTop = 0; overlayScroll.scrollTop = 0; go.focus({ preventScroll: true });
    onStatus(statusFor(rating, newBest) + ' ' + chaseCoaching(game));
  }
  function onCatch(event) {
    puppet.gesture('catch'); playFeed();
    const mult = streakMultiplier(game.combo);
    const label = event.rescued ? 'Crumb rescued! ' : event.kind === 'moth' ? 'Moth caught! ' : event.kind === 'biscuit' ? 'Whole biscuit! ' : event.air ? 'Air catch! ' : event.gold ? 'Golden crumb! ' : '';
    spark('float', event.x, event.z, '+' + event.points);
    spark('burst', event.x, event.z);
    message(label + '+' + event.points + (mult > 1 ? ' · streak ×' + mult : ''), 'good');
    if (!goalCelebrated && (game.format === 'campaign' ? campaignProgress(game).done : game.caught >= game.goal)) {
      goalCelebrated = true; playStar({ step: 1 });
      spark('float', game.player.x, game.player.z + 65, 'Goal ✓');
      onStatus('Crumb goal reached! Keep playing for more stars. The floor has become a buffet with casualties.');
    }
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
    else if (event.type === 'dashSmash') { puppet.gesture('catch'); playStomp(); squash(event.id); spark('float', event.x, event.z + 12, '+' + event.points); message('Dust demolished! +' + event.points, 'good'); }
    else if (event.type === 'bufferedJump') puppet.gesture('jump');
    else if (event.type === 'bump') { puppet.gesture('bump'); playClean(); shake(); message((event.hazard === 'broom' ? 'Swept for parts! ' : 'Dust ambush! ') + '−' + event.loss + ' · hop or dash', 'bad'); }
    else if (event.type === 'shield') { puppet.gesture('shield'); message(event.source === 'horns' ? 'Horn block! Unbothered.' : 'Trust shield! It took that one for you.', 'good'); }
    else if (event.type === 'dodge') { spark('float', p.x, p.z + 40, '+' + event.points); message('Clean jump! +' + event.points, 'good'); }
    else if (event.type === 'land') { puppet.gesture('land'); spark('puff', event.x, 0); }
    else if (event.type === 'steal') { spark('puff', event.x, event.z); message('Moth theft. No witnesses with spines.', 'bad'); }
    else if (event.type === 'crumble') { spark('puff', event.x, 0); message('Biscuit deceased. Crumbs inherited nothing.', ''); }
    else if (event.type === 'miss') message('Crumb escaped. Streak −2. It had dependants.', '');
    else if (event.type === 'melt') spark('puff', event.x, 0);
    else if (event.type === 'broomWarning') { message('Broom on the ' + event.side + '! Hop, Dash or cross.', 'bad'); onStatus('Broom approaching the ' + event.side + ' half. Hop over it, Dash through it, or move to the other side.'); }
    else if (event.type === 'powerup') onPowerUp(event);
    else if (event.type === 'objective') { spark('float', p.x, p.z + 60, 'Quest +40'); playStar({step:1}); onStatus('Side quest complete! Forty extra points. The paperwork has been eaten in celebration.'); }
    else if (event.type === 'finaleWarning') { message('Gold soon! Get near either edge.', 'good'); onStatus('The gold sweep is about to appear. Move near either edge, then hop toward the middle. It stays until time runs out.'); }
    else if (event.type === 'finale') { playPowerUp(); message('Last call! Sweep all 5 gold for +60', 'good'); onStatus('Last call! Five golden crumbs form an arc. Hop and dash to sweep all five for 60 bonus points. These extras never break your streak.'); }
    else if (event.type === 'finaleComplete') { playStar({step:3}); spark('float', p.x, p.z + 60, 'Gold sweep +60'); message('Gold sweep! +60. Bread has fallen.', 'good'); onStatus('Gold sweep complete! Sixty bonus points.'); }
  }
  function intermission() {
    stopFrame(); disabled(true); paint();
    screen('upgrade');
    const result = game.waveResults.at(-1);
    title.textContent = result.bonus ? pet.name + ' has brought dinner.' : 'Still hungry. Still in the running.';
    description.textContent = result.progress + '/' + result.target + ' ' + result.goal + (result.bonus ? ' · +' + result.bonus + ' contract points. ' : '. No contract bonus. ') + 'Pick your next goal, then equipment to suit it. A lower-paying contract can be safer. Missing one never ends the run.';
    quip.textContent = game.wave === 0 ? 'There are spare kneecaps in the drawer. Nobody has admitted whose.' : 'The moon makes everything lighter, including your judgment.';
    quip.hidden = false; stars.hidden = true; go.hidden = true; upgrades.hidden = false;
    game.pendingContract = 'house';
    contractChoices.replaceChildren(...chaseContractOptions(game, game.wave + 1).map(contract => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'btn chase-contract'; button.setAttribute('aria-pressed', String(contract.id === 'house'));
      const name = document.createElement('b'), detail = document.createElement('span'); name.textContent = contract.name + ' · +' + contract.bonus;
      detail.textContent = contract.target + ' ' + contract.goal + '. ' + contract.intro; button.append(name, detail);
      button.addEventListener('click', () => {
        if (!selectChaseContract(game, contract.id)) return;
        for (const choice of contractChoices.children) choice.setAttribute('aria-pressed', String(choice === button));
        onStatus('Next contract: ' + contract.target + ' ' + contract.goal + ' for ' + contract.bonus + ' points. Choose equipment, then begin when ready.');
      }); return button;
    }));
    upgrades.replaceChildren(...Object.entries(RUN_UPGRADES).filter(([id]) => !game.upgrades.includes(id)).map(([id, data]) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'chase-upgrade btn';
      button.setAttribute('aria-pressed', 'false');
      const name = document.createElement('b'), description = document.createElement('span');
      const plan = document.createElement('small'); plan.textContent = data.plan;
      name.textContent = data.name; description.textContent = data.description; button.append(name, description, plan);
      button.addEventListener('click', () => {
        if (!selectChaseUpgrade(game, id)) return;
        for (const option of upgrades.children) option.setAttribute('aria-pressed', String(option === button));
        quip.textContent = 'Selected: ' + data.name + '. You can change your choice before continuing.';
        go.textContent = 'Begin act ' + (game.wave + 2); go.hidden = false;
        onStatus(data.name + ' selected. The clock is still stopped. Choose Begin act ' + (game.wave + 2) + ' when you are ready.');
      });
      return button;
    }));
    overlay.classList.remove('best'); overlay.hidden = false; overlay.scrollTop = 0; overlayScroll.scrollTop = 0;
    contractChoices.firstElementChild?.focus({ preventScroll: true });
    onStatus('Act ' + (game.wave + 1) + ' complete. ' + (result.bonus ? result.bonus + ' contract points. ' : '') + 'The clock is stopped. Choose one upgrade for the rest of this run.');
  }
  function frame(now) {
    if (!running) return;
    const axis = held.axis;
    const events = updateChase(game, { axis, targetX: axis ? null : targetX }, (now - lastTime) / 1000);
    lastTime = now;
    for (const event of events) {
      if (event.type === 'pause') { pause('The browser stalled, so the chase is paused. Resume when ready.'); return; }
      if (event.type === 'finish') { finish(); return; }
      if (event.type === 'intermission') { intermission(); return; }
      react(event);
    }
    paint(); frameId = requestAnimationFrame(frame);
  }
  function run() {
    running = true; paused = false; resetInput(); overlay.hidden = true; disabled(false);
    screen('play');
    settings.open = false;
    measure(); lastTime = performance.now(); frameId = requestAnimationFrame(frame);
    field.focus({ preventScroll: true });
    onStatus(game.format === 'campaign' ? chaseStage(game.stageId).lesson + ' Goal: ' + campaignProgress(game).text : game.format === 'run' ? chaseWaveContract(game).intro + ' Contract: ' + chaseWaveContract(game).target + ' ' + chaseWaveContract(game).goal + ' for +' + chaseWaveContract(game).bonus + '. Each act lasts 18 seconds; pauses stop the clock.' : 'Collect ' + game.goal + ' crumbs. Hop over dust or dash through it. Every catch recharges Dash sooner. Sweep the five gold crumbs at last call for a bonus.');
  }
  function start(keepCourse = false) {
    if (!pet || root.hidden) return;
    if (keepCourse) { courseSeed = game.seed; courseObjective = game.objective?.id; }
    else {
      if (!repeatCourse.checked || courseSeed === null) courseSeed = Math.floor(Math.random() * 4294967296);
      const nextObjective = challengePicker.value === 'rotate' ? ['combo', 'air', 'biscuit'][runNumber % 3] : challengePicker.value;
      if (!repeatCourse.checked || !courseObjective) courseObjective = nextObjective;
      runNumber++;
    }
    stopFrame(); game = newChase(pet, { gentle: format === 'campaign' ? paceCheck.checked : gentle, stageId: selectedStage, mirror: mirrorCheck.checked, seed: courseSeed, venue:venuePicker.value, format, mood: moodOf(pet), objective: courseObjective });
    hudKey = ''; nodes.clear(); items.replaceChildren();
    goalCelebrated = false;
    venuePicker.disabled=true;
    challengePicker.disabled = true; repeatCourse.disabled = true;
    for (const button of formatPicker.children) button.disabled = true;
    root.dataset.finished = 'false'; pop.textContent = ''; stars.hidden = true; quip.hidden = true;
    overlay.classList.remove('best'); upgrades.hidden = true; go.hidden = false; fx.replaceChildren(); paint(); run();
  }
  function pause(reason = '') {
    if (!running) return;
    const explanation = typeof reason === 'string' ? reason : '';
    stopFrame(); paused = true; disabled(true); paint();
    screen('paused');
    title.textContent = 'The crumbs can wait.';
    const remaining = Math.ceil((game.format === 'run' ? RUN_WAVE_SECONDS : chaseDuration(game)) - chaseWaveTime(game));
    description.textContent = (explanation ? explanation + ' ' : '') + 'Paused at ' + game.caught + '/' + game.goal + ' crumbs and ' + game.score + ' points. ' + remaining + ' seconds remain' + (game.format === 'run' ? ' in act ' + (game.wave + 1) : '') + '. Resume when you are ready.';
    pauseCaption.textContent = pet.name + [' is on a very small union break.', ' is negotiating with the biscuit.', ' insists this was a strategic pause.'][(game.caught + game.bumps) % 3];
    restart.textContent = game.format === 'run' ? 'Restart whole run' : 'Restart this course';
    go.textContent = 'Resume chase'; go.hidden = false; upgrades.hidden = true; overlay.hidden = false; overlay.scrollTop = 0; overlayScroll.scrollTop = 0; go.focus({ preventScroll: true });
    onStatus(explanation || 'Paused. Resume whenever you are ready.');
  }
  function jump() { if (running && jumpChase(game, { buffer: true })) { puppet.gesture('jump'); if (navigator.vibrate) navigator.vibrate(8); } }
  function burst() {
    if (!running) return;
    const axis = held.axis;
    const direction = axis || (Number.isFinite(targetX) && Math.abs(targetX - game.player.x) > 4 ? Math.sign(targetX - game.player.x) : game.player.direction);
    if (dashChase(game, direction)) { playStomp(); spark('puff', game.player.x, game.player.z); if (navigator.vibrate) navigator.vibrate(10); paint(); }
  }
  function moveTo(e) {
    const box = fieldBox || field.getBoundingClientRect();
    targetX = Math.max(26, Math.min(294, (e.clientX - box.left) / box.width * CHASE_WIDTH));
  }
  field.addEventListener('pointerdown', e => {
    if (!running || e.button !== 0 || pointerId !== null || e.target.closest('button')) return;
    e.preventDefault(); measure(); pointerId = e.pointerId; field.setPointerCapture(e.pointerId); moveTo(e);
  });
  field.addEventListener('pointermove', e => { if (running && e.pointerId === pointerId) moveTo(e); });
  field.addEventListener('pointerup', e => { if (e.pointerId === pointerId) { pointerId = null; targetX = null; } });
  field.addEventListener('lostpointercapture', e => { if (e.pointerId === pointerId) { pointerId = null; targetX = null; } });
  field.addEventListener('pointercancel', e => { if (e.pointerId === pointerId) { pointerId = null; targetX = null; } });
  directions.forEach(button => {
    const dir = button.dataset.chaseDirection;
    button.addEventListener('pointerdown', e => { if (!running || e.button !== 0) return; e.preventDefault(); held.hold('pointer:' + e.pointerId, dir); targetX = null; button.setPointerCapture(e.pointerId); });
    for (const name of ['pointerup','pointercancel','lostpointercapture']) button.addEventListener(name, e => held.release('pointer:' + e.pointerId));
    button.addEventListener('click', e => { if (running && e.detail === 0) targetX = game.player.x + (dir === 'left' ? -55 : 55); });
  });
  // Touch actions fire on press. Waiting for click adds the entire thumb-hold
  // duration to a jump, and prevented running/steering/jumping together on phones.
  wireChaseAction(hop,jump,()=>running);wireChaseAction(dash,burst,()=>running);
  go.addEventListener('click', () => {
    if (running) return;
    if (game?.awaitingChoice) {
      if (!advanceChaseWave(game)) return;
      upgrades.hidden = true; quip.hidden = true;
      nodes.clear(); items.replaceChildren(); fx.replaceChildren(); hudKey = ''; paint(); run();
      message('ACT ' + (game.wave + 1) + ' · ' + RUN_WAVES[game.wave].name, 'good');
    } else if (paused) run();
    else if (game?.format === 'campaign' && game.finished && game.complete && chaseStage(game.stageId).index < 11) { selectedStage = CHASE_STAGES[chaseStage(game.stageId).index + 1].id; controller.prepare(pet, gentle); }
    else start();
  });
  pauseButton.addEventListener('click', pause);
  restart.addEventListener('click', () => { if (paused && game && !game.finished) start(true); });
  document.addEventListener('keydown', e => {
    const action = chaseKeyAction(e, { running, paused, visible: !root.hidden });
    if (!action) return;
    e.preventDefault();
    if (action === 'pause') { pause(); return; }
    if (action === 'resume') { run(); return; }
    const source = 'key:' + (e.code || e.key.toLowerCase());
    if (action === 'left' || action === 'right') { held.hold(source, action); targetX = null; }
    if (action === 'hop') jump();
    if (action === 'dash') burst();
  });
  document.addEventListener('keyup', e => {
    held.release('key:' + (e.code || e.key.toLowerCase()));
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('blur', pause);
  const controller = {
    prepare(resident, useGentle) {
      if (pet?.id !== resident.id) selectedStage = null;
      if (pet?.id !== resident.id || gentle !== useGentle || game?.format === 'quick' && game.venue !== venuePicker.value) { courseSeed = null; courseObjective = null; }
      stopFrame(); puppet?.release(); paused = false; goalCelebrated = false; pet = resident; gentle = useGentle;
      if (format === 'campaign') {
        const progress = normalizeChaseCampaign(pet.chaseCampaign);
        if (!selectedStage || chaseStage(selectedStage).index >= progress.unlocked) selectedStage = CHASE_STAGES[progress.unlocked - 1].id;
        stagePicker.replaceChildren(...CHASE_STAGES.map(stage => { const option = document.createElement('option'); option.value = stage.id; option.disabled = stage.index >= progress.unlocked; option.textContent = (stage.index + 1) + '. ' + stage.name + (progress.records[stage.id]?.won ? ' ✓ · practice' : stage.index >= progress.unlocked ? ' · locked' : ''); return option; }));
        stagePicker.value = selectedStage;
        mirrorOption.hidden = !progress.records[selectedStage]?.won;
        if (mirrorOption.hidden) mirrorCheck.checked = false;
        campaignInfo.textContent = progress.unlocked + '/12 lessons available. Clears unlock the next lesson; replay preserves your best. Handling never changes with affection.';
      }
      screen('setup'); settings.open = false;
      root.dataset.finished = 'false'; guide.open = false;
      const nextObjective = challengePicker.value === 'rotate' ? ['combo', 'air', 'biscuit'][runNumber % 3] : challengePicker.value;
      game = newChase(pet, { gentle: format === 'campaign' ? paceCheck.checked : gentle, stageId: selectedStage, mirror: mirrorCheck.checked, venue:venuePicker.value, format, mood: moodOf(pet), objective: repeatCourse.checked && courseObjective ? courseObjective : nextObjective });
      venuePicker.disabled=false;field.dataset.venue=game.venue;
      venuePicker.closest('label').hidden = format === 'run';
      settingsSummary.textContent = 'Advanced: free play, ground & side quests';
      practiceTools.hidden = format === 'campaign';
      venuePicker.closest('label').hidden = format !== 'quick';
      for (const button of formatPicker.children) button.disabled = false;
      challengePicker.disabled = false; repeatCourse.disabled = false;
      hudKey = ''; nodes.clear(); items.replaceChildren();
      actor.replaceChildren(renderPetSprite(pet)); actor.firstElementChild.classList.add('sl-mood-content');
      pauseResident.replaceChildren(renderPetSprite(pet));
      puppet = createPuppet(actor.firstElementChild);
      title.textContent = format === 'run' ? 'Midnight Run' : CHASE_VENUES[game.venue].name;
      description.textContent = format === 'run' ? 'Catch ' + game.goal + ' crumbs across three 18-second acts to win. The clock stops between acts while you choose upgrades. Contracts add bonus points; missing one still lets you finish the run. First: ' + (gentle ? RUN_WAVES[0].gentleTarget : RUN_WAVES[0].target) + ' crumbs for +50 points.' : 'Steer ' + pet.name + '. Catch ' + game.goal + ' crumbs in 22 seconds to win. Crumbs count toward the goal; biscuits and moths earn bonus points. Hop over dust bunnies or Dash straight through them.';
      go.textContent = format === 'run' ? 'Begin the midnight run' : 'Let’s chase'; go.hidden = false; upgrades.hidden = true; overlay.hidden = false; overlay.scrollTop = 0; overlayScroll.scrollTop = 0; disabled(true);
      hop.textContent = game.wings ? 'Flap ↑' : 'Hop ↑';
      const trait = game.wings ? 'Wings: tap Flap again in midair.' : game.horns ? 'Horns block your first dust ambush.' : game.halo ? 'Your halo pulls nearby crumbs closer.' : game.tail ? 'Tail: a bigger stomp bounce.' : 'Keyboard: arrows + Space.';
      mobileGuide.textContent = 'Hold ← or → to move. Tap ' + (game.wings ? 'Flap' : 'Hop') + ' to jump. You can hold a direction and jump together. Dragging the arena also works. Dash is an optional burst in your steering direction. ' + (game.wings || game.horns || game.halo || game.tail ? trait : '');
      const modeRecord = pet.chaseRecords?.[chaseRecordKey(game)];
      const record = modeRecord ? ' ' + (format === 'run' ? 'Midnight Run' : gentle ? 'Gentle' : 'Standard') + ' best: ' + modeRecord.score + '.' : ' Separate records for every ground, length and pace.';
      description.textContent += game.venue==='pantry'?' More falling biscuits, each worth 50 base points.':game.venue==='moon'?' The moon lends you longer, higher jumps.':'';
      tip.textContent = 'Drag or hold ← →. Hop: Space. Dash: X, in your steering direction. Catches recharge Dash sooner. Sweep all 5 gold at last call for +60. ' + trait + record;
      stars.hidden = true; quip.hidden = true; overlay.classList.remove('best'); fx.replaceChildren();
      if (format === 'campaign') {
        const stage = chaseStage(game.stageId);
        title.textContent = 'Chapter ' + stage.chapter + ': ' + CHASE_CHAPTERS[stage.chapter - 1];
        description.textContent = 'Lesson ' + (stage.index + 1) + '/12 · ' + stage.name + (game.mirror ? ' · Mirrored replay. ' : '. ') + stage.lesson + ' Goal: ' + campaignProgress(game).text + '. ' + stage.seconds + ' seconds.';
        go.textContent = pet.chaseCampaign?.records?.[stage.id]?.won ? 'Practise lesson ' + (stage.index + 1) : 'Begin lesson ' + (stage.index + 1);
        tip.textContent = stage.lesson + ' Hold ← → or drag. Hop: Space. Dash: X. Pause: P.';
      }
      pop.textContent = ''; paint();
    },
    stop() { stopFrame(); paused = false; popAnimation?.cancel(); fx.replaceChildren(); puppet?.release(); },
    pause
  };
  fitLayout();
  return controller;
}

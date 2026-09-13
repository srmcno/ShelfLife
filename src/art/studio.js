// The studio: two equal ways to make a pet, sharing one name field and one
// "Move it in" button.
//
//   GROW ONE  — art/creatures.js rolls a designed vector creature; the player
//               re-rolls the whole thing, or nudges one feature at a time, and
//               watches a live animated preview of exactly what will stand on
//               the shelf. Saves `{ creature }`.
//   DRAW ONE  — the original freehand pad: a raster body canvas plus stamps
//               recorded as positional data rather than baked into pixels.
//               Saves `{ body, stamps }`. Mechanics unchanged.
//
// Neither is the "real" one. They are two tabs of the same size in the same
// place, and the only asymmetry is which opens first — Grow, because a brand
// new player should meet a creature that already looks like something.
//
// Everything here takes `state` as an explicit argument or reads the live `state`
// import — never a hidden closure over a duplicated copy of the save data.
import { CANVAS_SIZE, STAMP_SCALE, BASE_STAMPS, UNLOCK_STAMPS, STAMP_SVG, STAMP_LABELS } from './stamps.js';
import {
  generateCreature, selectCreaturePart, listVariants, normalizeCreature, describeCreature, customizeCreature, resolveColors,
  SLOTS, SLOT_KEYS, PALETTES, PALETTE_IDS, BODY_IDS, BODIES
} from './creatures.js';
import { renderPetSprite } from './sprite.js';
import { state, save } from '../state.js';
import { drawingBounds, measureStampInk } from './drawing.js';
import { reactTo } from './animator.js';
import { toast } from '../ui/toast.js';
import { remixCreature } from './studio-model.js';
import { TRAITS, TRAIT_BY_ID } from '../content/traits.js';
import { FALLBACK_NAMES } from '../content/copy.js';
import { createPersonalityDraft, normalizePersonalityDraft, resolvePersonality, creationCareRates, ORIGIN_LIMIT, CREATION_STATS } from '../engine/creation.js';

// Ported verbatim from ~/Documents/shelf-life.html (lines ~475-480). Studio-only concern:
// which brush colors are available at the shelf's current total bond.
export const BASE_COLORS = ['#1A1220', '#F2E9DC', '#FF8FB8', '#C94F7C', '#7FD8C0', '#3E9E86', '#F2B441', '#E0672F', '#A32C3C', '#8E6BD1', '#4A7FD1', '#6FBF4A', '#8A5A3B', '#9AA5AD'];
export const UNLOCK_COLORS = [
  { at: 10, colors: ['#39D6C0', '#FF5FA2', '#FFE066'], label: 'three loud colors' },
  { at: 30, colors: ['#B8FF5A', '#8C1BE0', '#00E5FF'], label: 'three colors that should not exist' },
  { at: 60, colors: ['#FF3B1F', '#0B0F45', '#E8D7FF'], label: 'the last three colors' }
];

// Pure function per the project's "state is an explicit first argument" rule. Computes
// total bond inline rather than importing engine/unlocks.js's totalBond(state) — that
// module is a parallel, not-yet-built task, and this is one line of harmless duplicated
// arithmetic rather than a backwards/circular dependency.
export function unlockedColors(state) {
  const bond = state.pets.reduce((n, p) => n + p.bond, 0);
  let out = BASE_COLORS.slice();
  UNLOCK_COLORS.forEach(u => { if (bond >= u.at) out = out.concat(u.colors); });
  return out;
}

// Mirrors unlockedColors' shape for stamp kinds. Not part of the module's export
// contract (only art/studio.js itself needs it to build the stamp picker), so it stays
// local rather than exported.
function unlockedStampKinds() {
  const bond = state.pets.reduce((n, p) => n + p.bond, 0);
  let out = BASE_STAMPS.slice();
  UNLOCK_STAMPS.forEach(u => { if (bond >= u.at) out = out.concat(u.stamps); });
  return out;
}

// The preview sprite is a real sprite, with a real `data-pet`, so art/animator.js
// picks it up on its next pass and breathes/blinks/steps it exactly as it will on
// the shelf. The id is not a valid pet id (those are `p<seq>_<base36>`), so it can
// never collide with a resident.
const PREVIEW_ID = 'studio-preview';

const BLURB = {
  generate: 'Choose a feature and browse its variations. Keep your favourites, then remix everything else.',
  draw: 'Draw it, stamp it, name it. It takes over from there.'
};

export function initStudio({ onSave }) {
  const studioVeil = document.getElementById('studioVeil');
  const pad = document.getElementById('pad');
  const stampLayer = document.getElementById('stampLayer');
  const swatchesWrap = document.getElementById('swatches');
  const sizeWrap = document.getElementById('sizes');
  const eraserChip = document.getElementById('eraserChip');
  const stampPickerWrap = document.getElementById('stamps');
  const undoBtn = document.getElementById('undoBtn');
  const clearBtn = document.getElementById('clearBtn');
  const petName = document.getElementById('petName');
  const studioClose = document.getElementById('studioClose');
  const cancelPet = document.getElementById('cancelPet');
  const savePet = document.getElementById('savePet');

  const studioBlurb = document.getElementById('studioBlurb');
  const tabGenerate = document.getElementById('tabGenerate');
  const tabDraw = document.getElementById('tabDraw');
  const genPanel = document.getElementById('genPanel');
  const drawPanel = document.getElementById('drawPanel');
  const genMount = document.getElementById('genMount');
  const genDesc = document.getElementById('genDesc');
  const genSurprise = document.getElementById('genSurprise');
  const genParts = document.getElementById('genParts');
  const genPalette = document.getElementById('genPalette');

  const ctx = pad.getContext('2d');
  pad.width = CANVAS_SIZE;
  pad.height = CANVAS_SIZE;

  const brush = { color: BASE_COLORS[0], size: 16, erase: false, stamp: null };

  // Single linear undo history covering both freehand strokes and stamp placements,
  // oldest-to-newest, matching the original's single-stack single-button UX.
  //   { type: 'stroke', pixels }   – canvas snapshot taken before a stroke
  //   { type: 'stamp' }            – undoing just pops the last placed stamp
  let undoStack = [];

  // Placed stamps: plain data objects, never drawn onto the canvas. `stamps` is the
  // data (this is what becomes art.stamps on save); `stampEls` is the parallel array of
  // live preview DOM nodes in #stampLayer, kept in lockstep so undo can remove the right one.
  let stamps = [];
  let stampEls = [];
  const drawPreview = document.getElementById('drawPreview');
  function drawingArt() {
    return { body: padThumb(), stamps: stamps.map(s => ({ ...s })),
      bounds: drawingBounds(ctx.getImageData(0, 0, pad.width, pad.height).data, pad.width, pad.height, stamps, measureStampInk(stamps)) };
  }
  function previewDrawing() {
    if (isEmpty() && !stamps.length) {
      drawPreview.innerHTML = '<span>Your drawing comes to life here.</span>';
      return;
    }
    const sprite = renderPetSprite({ id: 'drawing-preview', art: drawingArt() });
    sprite.classList.add('sl-mood-content');
    drawPreview.replaceChildren(sprite);
  }
  document.getElementById('drawWiggle').addEventListener('click', () => reactTo('drawing-preview', 'fuss'));


  let drawing = false;
  let lastPt = null;

  // ---- generate mode ------------------------------------------------------
  // `mode` is the single source of truth for which tab is live; it decides only
  // two things — which panel is visible, and which art shape Save hands back.

  let mode = 'generate';
  let editingId=null, openGeneration=0;
  let personalityDraft = null;
  const personalityEditor = document.createElement('section');
  personalityEditor.className = 'personality-editor';
  personalityEditor.setAttribute('aria-labelledby', 'personalityTitle');
  personalityEditor.innerHTML = `
    <div class="personality-heading"><h3 id="personalityTitle">Someone in there</h3><button type="button" class="btn btn-ghost btn-sm" id="shufflePersonality">Shuffle personality</button></div>
    <p class="hint" id="personalityHelp">Choose two quirks, or add a third. These shape care, friendships and shelf habits. Changing the appearance keeps them.</p>
    <div class="personality-quirks"></div>
    <div class="personality-preview" role="status" aria-live="polite" aria-atomic="true">
      <h4>Particulars · final stats</h4><dl class="personality-stats"></dl>
      <p class="hint personality-stat-help">Cute improves fussing. Menace wins arguments over furniture. Damp attracts grime. Mystique attracts case files.</p>
      <h4>Care at a glance</h4><p class="personality-rates"></p>
    </div>
    <p class="hint">Care shows points lost per daytime hour, including Damp. Furniture and neighbours can help; needs fall more slowly at night.</p>
    <label class="tool-label" for="petOrigin">Where did they come from? <span>(optional)</span></label>
    <textarea id="petOrigin" rows="2" maxlength="${ORIGIN_LIMIT}" aria-describedby="petOriginHint petOriginCount" placeholder="Found behind the radiator. Claims to own the building."></textarea>
    <div class="personality-origin-help"><p class="hint" id="petOriginHint">Your short backstory becomes their introduction. Leave blank for a ready-made one.</p><span id="petOriginCount">0 / ${ORIGIN_LIMIT}</span></div>
    <details class="personality-introduction"><summary>Read their introduction</summary><p></p></details>`;
  // Two small decisions instead of one long form: make the body, then meet
  // the resident. Moving between steps never recreates the art or personality.
  const nameBlock = petName.closest('.tool-block');
  const identityPanel = document.createElement('section');
  identityPanel.id = 'studioIdentity'; identityPanel.hidden = true;
  identityPanel.setAttribute('aria-label', 'Name and personality');
  const identityPortrait = document.createElement('div');
  identityPortrait.className = 'studio-identity-portrait'; identityPortrait.setAttribute('aria-hidden', 'true');
  nameBlock.before(identityPanel);
  identityPanel.append(identityPortrait, nameBlock, personalityEditor);
  const appearancePanel = document.createElement('section');
  appearancePanel.id = 'studioAppearance';
  appearancePanel.setAttribute('aria-label', 'Appearance');
  const artTabs = tabGenerate.closest('.studio-tabs');
  artTabs.before(appearancePanel); appearancePanel.append(artTabs, genPanel, drawPanel);
  const steps = document.createElement('nav');
  steps.className = 'studio-steps'; steps.setAttribute('aria-label', 'Create your resident');
  steps.innerHTML = '<button class="studio-step" type="button" id="studioLooks" aria-controls="studioAppearance" aria-current="step"><span>1</span> Appearance</button><button class="studio-step" type="button" id="studioIdentityStep" aria-controls="studioIdentity"><span>2</span> Name &amp; personality</button>';
  appearancePanel.before(steps);
  const quickResident=document.createElement('section');quickResident.className='quick-resident';
  quickResident.innerHTML='<div><b>Ready to cause trouble</b><small class="quick-identity"></small><small>Keep this character now. You can change its appearance and name later.</small></div><button type="button" class="btn btn-primary" id="quickAdopt">Meet this resident</button>';
  steps.after(quickResident);
  const quickAdopt=quickResident.querySelector('button');
  function syncQuickResident(){
    quickResident.hidden=!!editingId||creationStep==='identity';
    if(editingId||!personalityDraft)return;
    const name=petName.value.trim()||FALLBACK_NAMES[personalityDraft.seed%FALLBACK_NAMES.length];
    quickResident.querySelector('.quick-identity').textContent=name+' · '+personalityDraft.traits.map(id=>TRAIT_BY_ID[id]?.name).filter(Boolean).join(' / ');
    quickAdopt.textContent='Meet '+name;
  }
  quickAdopt.addEventListener('click',()=>{
    if(savePet.disabled)return;
    if(mode==='draw'&&isEmpty()&&!stamps.length){toast('Draw a body or place a stamp first.');return;}
    if(!petName.value.trim())petName.value=FALLBACK_NAMES[personalityDraft.seed%FALLBACK_NAMES.length];
    setCreationStep('identity');savePet.click();
  });
  petName.addEventListener('input',syncQuickResident);
  const backToLooks = document.createElement('button');
  backToLooks.type = 'button'; backToLooks.id = 'studioBack'; backToLooks.className = 'btn'; backToLooks.textContent = 'Back'; backToLooks.hidden = true;
  savePet.before(backToLooks);
  let creationStep = 'appearance';
  function showDrawingWorkspace() {
    if (mode !== 'draw' || innerWidth <= 720 || innerHeight > 600) return;
    requestAnimationFrame(() => { if (studioVeil.classList.contains('open') && !appearancePanel.hidden) drawPanel.scrollIntoView({ block: 'start', behavior: 'instant' }); });
  }
  function setCreationStep(next, focus = false) {
    creationStep = editingId ? 'appearance' : next;
    syncQuickResident();
    const identity = creationStep === 'identity';
    appearancePanel.hidden = identity; identityPanel.hidden = !identity;
    steps.hidden = !!editingId; backToLooks.hidden = !identity;
    const looksButton = steps.querySelector('#studioLooks'), identityButton = steps.querySelector('#studioIdentityStep');
    looksButton.toggleAttribute('aria-current', !identity); identityButton.toggleAttribute('aria-current', identity);
    (identity ? identityButton : looksButton).setAttribute('aria-current', 'step');
    savePet.textContent = editingId ? 'Save appearance' : identity ? 'Move it in' : 'Next: personality';
    if (identity) identityPortrait.replaceChildren(renderPetSprite({ id: 'identity-preview', art: mode === 'generate' ? { creature } : drawingArt() }));
    else identityPortrait.replaceChildren();
    const sheet = studioVeil.querySelector('.sheet');
    sheet.scrollTop = 0; studioVeil.scrollTop = 0;
    if (focus) (identity ? identityButton : looksButton).focus({ preventScroll: true });
    if (!identity) showDrawingWorkspace();
  }
  steps.querySelector('#studioLooks').addEventListener('click', () => setCreationStep('appearance', true));
  steps.querySelector('#studioIdentityStep').addEventListener('click', () => setCreationStep('identity', true));
  backToLooks.addEventListener('click', () => setCreationStep('appearance', true));

  const originInput = personalityEditor.querySelector('#petOrigin');
  const quirkSelects = [];
  const needNames = { food: 'Food', fuss: 'Attention', clean: 'Cleanliness' };
  const sortedTraits = TRAITS.slice().sort((a, b) => a.name.localeCompare(b.name));
  for (let index = 0; index < 3; index++) {
    const field = document.createElement('div');
    field.className = 'personality-quirk';
    field.innerHTML = `<label class="tool-label" for="petQuirk${index}">${['First quirk', 'Second quirk', 'Third quirk (optional)'][index]}</label><select id="petQuirk${index}" aria-describedby="petQuirkInfo${index} personalityHelp"></select><p id="petQuirkInfo${index}" class="personality-quirk-info"></p>`;
    const select = field.querySelector('select');
    if (index === 2) select.add(new Option('Just two, thanks', ''));
    for (const trait of sortedTraits) select.add(new Option(trait.name, trait.id));
    select.addEventListener('change', () => {
      personalityDraft = normalizePersonalityDraft({ ...personalityDraft, traits: quirkSelects.map(input => input.value) });
      syncPersonality();
    });
    quirkSelects.push(select);
    personalityEditor.querySelector('.personality-quirks').append(field);
  }
  function syncPersonality() {
    const resolved = resolvePersonality(personalityDraft);
    syncQuickResident();
    quirkSelects.forEach((select, index) => {
      const id = personalityDraft.traits[index] || '';
      select.value = id;
      for (const option of select.options) option.disabled = !!option.value && option.value !== id && personalityDraft.traits.includes(option.value);
      const trait = TRAIT_BY_ID[id];
      const info = personalityEditor.querySelector('#petQuirkInfo' + index);
      if (!trait) { info.textContent = 'Two quirks make a complete personality.'; return; }
      const effects = Object.entries(trait.care || {}).map(([need, multiplier]) =>
        `${needNames[need]} falls ${Math.round(Math.abs(multiplier - 1) * 100)}% ${multiplier < 1 ? 'slower' : 'faster'}`);
      if (trait.nocturnal) effects.push('Sleeps 7am–8pm: care has half effect and games are practice');
      info.textContent = trait.blurb + ' ' + (effects.length ? effects.join(' · ') + '.' : 'No direct change to need loss.');
    });
    const stats = personalityEditor.querySelector('.personality-stats');
    stats.replaceChildren(...CREATION_STATS.map(key => {
      const item = document.createElement('div');
      const label = document.createElement('dt'); label.textContent = key[0].toUpperCase() + key.slice(1);
      const value = document.createElement('dd'); value.textContent = resolved.stats[key] + ' / 10';
      item.append(label, value); return item;
    }));
    const rates = creationCareRates(personalityDraft);
    personalityEditor.querySelector('.personality-rates').textContent = Object.entries(rates)
      .map(([need, rate]) => `${needNames[need]} −${rate.toFixed(1)} / hour`).join(' · ');
    syncOrigin();
  }
  function syncOrigin() {
    personalityEditor.querySelector('#petOriginCount').textContent = originInput.value.length + ' / ' + ORIGIN_LIMIT;
    personalityEditor.querySelector('.personality-introduction p').textContent = resolvePersonality(personalityDraft).bio;
  }
  originInput.addEventListener('input', () => {
    personalityDraft = { ...personalityDraft, origin: originInput.value };
    syncOrigin();
  });
  personalityEditor.querySelector('#shufflePersonality').addEventListener('click', () => {
    personalityDraft = { ...createPersonalityDraft(), origin: originInput.value };
    syncPersonality();
  });
  let creature = null;
  let selectedPart = 'body';
  const undo = [];
  const redo = [];
  const lockedParts = new Set();
  let previewFrame = 0;
  const remixTools = document.createElement('div');
  remixTools.className = 'studio-remix-tools tool-block';
  remixTools.innerHTML = '<button type="button" class="chip" id="genLockPart" aria-pressed="false">Keep this body</button><button type="button" class="chip" id="genLockPalette" aria-pressed="false">Keep colours</button><button type="button" class="btn btn-ghost btn-sm" id="genUnlockAll">Release all</button><p class="hint" id="genLockSummary" role="status"></p>';
  genParts.parentElement.appendChild(remixTools);
  const lockPart = remixTools.querySelector('#genLockPart'), lockPalette = remixTools.querySelector('#genLockPalette');
  const redoButton = document.createElement('button');
  redoButton.id = 'genRedo'; redoButton.type = 'button'; redoButton.className = 'btn btn-sm btn-ghost'; redoButton.textContent = 'Redo';
  genSurprise.parentElement.append(document.getElementById('genUndo'), redoButton);
  function syncLocks() {
    const label = PART_CHIPS.find(part => part.key === selectedPart).label.toLowerCase();
    lockPart.textContent = (lockedParts.has(selectedPart) ? 'Keeping ' : 'Keep ') + label;
    lockPart.setAttribute('aria-pressed', String(lockedParts.has(selectedPart)));
    lockPalette.setAttribute('aria-pressed', String(lockedParts.has('palette')));
    genParts.querySelectorAll('[data-part-key]').forEach(button => {
      const part = PART_CHIPS.find(p => p.key === button.dataset.partKey);
      button.textContent = part.label + (lockedParts.has(part.key) ? ' ✓' : '');
      button.title = lockedParts.has(part.key) ? 'Kept when remixing; you can still edit it.' : 'Choose ' + part.label.toLowerCase();
    });
    document.getElementById('genUnlockAll').disabled = !lockedParts.size;
    document.getElementById('genLockSummary').textContent = lockedParts.size
      ? lockedParts.size + ' choices kept. Remix changes the rest. Your face adjustments stay.'
      : 'Keep a feature before remixing to preserve it. Undo and redo let you compare designs.';
    genSurprise.textContent = lockedParts.size ? 'Remix the rest' : 'Surprise me';
  }
  lockPart.addEventListener('click', () => { if (lockedParts.has(selectedPart)) lockedParts.delete(selectedPart); else lockedParts.add(selectedPart); syncLocks(); });
  lockPalette.addEventListener('click', () => { if (lockedParts.has('palette')) lockedParts.delete('palette'); else lockedParts.add('palette'); syncLocks(); });
  document.getElementById('genUnlockAll').addEventListener('click', () => { lockedParts.clear(); syncLocks(); });

  // Slot chips, in the order the SLOTS registry declares them, plus body. Body is
  // deliberately first: it is the one change that alters the silhouette, and the
  // labels come from the library so a new part slot appears here for free.
  const PART_CHIPS = [{ key: 'body', label: 'Body' }]
    .concat(SLOT_KEYS.map(k => ({ key: k, label: SLOTS[k].label })));

  function renderPreview() {
    genMount.innerHTML = '';
    // A real sprite element, not a bare <svg>: the preview then inherits every
    // shelf behaviour (breathing, blinking, limb idles, gait) from the same
    // director, so what you approve here is what moves in.
    const sprite = renderPetSprite({ id: PREVIEW_ID, art: { body: '', stamps: [], creature } });
    sprite.classList.add('sl-mood-content');
    genMount.appendChild(sprite);
    genDesc.textContent = describeCreature(creature);
  }

  function setCreature(next, remember = true) {
    if (remember && creature) { undo.push(creature); if (undo.length > 30) undo.shift(); redo.length = 0; }
    creature = normalizeCreature(next);
    cancelAnimationFrame(previewFrame);
    previewFrame = requestAnimationFrame(renderPreview);
    syncPalette();
    syncPartPicker();
    syncDetails();
  }

  function syncPalette() {
    genPalette.querySelectorAll('.sw').forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.palette === creature.palette));
    });
  }

  function syncPartPicker() {
    const select = document.getElementById('genVariant');
    if (!select || !creature) return;
    const pickerKey = selectedPart + ':' + (selectedPart === 'body' ? creature.body : creature.parts[selectedPart]);
    if (select.dataset.pickerKey === pickerKey) return;
    select.dataset.pickerKey = pickerKey;
    const options = selectedPart === 'body' ? BODY_IDS.map(id => ({ id, name: BODIES[id].name })) : listVariants(selectedPart);
    const current = selectedPart === 'body' ? creature.body : creature.parts[selectedPart];
    select.replaceChildren(...options.map(({ id, name }) => {
      const option = document.createElement('option'); option.value = id; option.textContent = name; return option;
    }));
    select.value = current;
    const label = PART_CHIPS.find(p => p.key === selectedPart).label;
    document.getElementById('genVariantLabel').textContent = label;
    document.getElementById('genVariantCount').textContent = (select.selectedIndex + 1) + ' of ' + options.length;
    genParts.querySelectorAll('[data-part-key]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.partKey === selectedPart)));
  }

  function buildPartChips() {
    genParts.replaceChildren();
    PART_CHIPS.forEach(({ key, label }) => {
      const b = document.createElement('button');
      b.className = 'chip'; b.type = 'button'; b.textContent = label; b.dataset.partKey = key;
      b.addEventListener('click', () => { selectedPart = key; syncPartPicker(); syncLocks(); });
      genParts.appendChild(b);
    });
  }
  const variantSelect = document.getElementById('genVariant');
  variantSelect.addEventListener('change', () => setCreature(selectCreaturePart(creature, selectedPart, variantSelect.value)));
  for (const [id, direction] of [['genPrevious', -1], ['genNext', 1]]) {
    document.getElementById(id).addEventListener('click', () => {
      const options = [...variantSelect.options];
      const next = (variantSelect.selectedIndex + direction + options.length) % options.length;
      setCreature(selectCreaturePart(creature, selectedPart, options[next].value));
    });
  }

  function buildPalette() {
    genPalette.innerHTML = '';
    PALETTE_IDS.forEach(id => {
      const p = PALETTES[id];
      const b = document.createElement('button');
      b.className = 'sw';
      b.type = 'button';
      b.dataset.palette = id;
      // Body over accent: the two colours that actually change the read of a
      // creature, so the swatch is a preview rather than a label.
      b.style.background = `linear-gradient(135deg, ${p.body} 0 58%, ${p.accent} 58% 100%)`;
      b.setAttribute('aria-label', p.name);
      b.title = p.name;
      b.addEventListener('click', () => {
        // Palette is pure colour: keep every rolled part, seed and tune exactly
        // as they are rather than regenerating and drifting the creature.
        setCreature(Object.assign({}, creature, { palette: id, colors: undefined }));
      });
      genPalette.appendChild(b);
    });
  }

  function syncDetails() {
    document.querySelectorAll('[data-tune]').forEach(input => {
      const key = input.dataset.tune;
      input.value = creature.tune[key];
      document.getElementById(key + 'Value').textContent = key === 'lean' ? creature.tune[key] + '°' : Math.round(creature.tune[key] * 100) + '%';
    });
    const colours = resolveColors(creature);
    document.querySelectorAll('[data-colour]').forEach(input => { input.value = colours[input.dataset.colour]; });
    document.getElementById('genUndo').disabled = !undo.length;
    redoButton.disabled = !redo.length;
  }
  document.querySelectorAll('[data-tune],[data-colour]').forEach(input => {
    let editing = false;
    input.addEventListener('input', () => {
      const options = input.dataset.tune ? { tune: { [input.dataset.tune]: Number(input.value) } } : { colors: { [input.dataset.colour]: input.value } };
      setCreature(customizeCreature(creature, options), !editing); editing = true;
    });
    input.addEventListener('change', () => { editing = false; });
    input.addEventListener('blur', () => { editing = false; });
  });
  function undoCreature() { if (undo.length) { redo.push(creature); setCreature(undo.pop(), false); } }
  function redoCreature() { if (redo.length) { undo.push(creature); setCreature(redo.pop(), false); } }
  document.getElementById('genUndo').addEventListener('click', undoCreature);
  redoButton.addEventListener('click', redoCreature);
  studioVeil.addEventListener('keydown', event => {
    if (creationStep !== 'appearance' || mode !== 'generate' || !isOpen() || (!event.ctrlKey && !event.metaKey) || event.altKey) return;
    if (event.target.closest('input,textarea,select,[contenteditable=true]')) return;
    if (event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redoCreature(); else undoCreature(); }
    else if (event.key.toLowerCase() === 'y') { event.preventDefault(); redoCreature(); }
  });
  document.getElementById('genResetDetails').addEventListener('click', () => setCreature({ ...creature, colors: undefined, tune: {} }));

  genSurprise.addEventListener('click', () => setCreature(lockedParts.size ? remixCreature(creature, lockedParts) : generateCreature()));

  // ---- tabs ---------------------------------------------------------------

  function setMode(next) {
    mode = next === 'draw' ? 'draw' : 'generate';
    const gen = mode === 'generate';
    tabGenerate.setAttribute('aria-selected', String(gen));
    tabDraw.setAttribute('aria-selected', String(!gen));
    tabGenerate.tabIndex = gen ? 0 : -1;
    tabDraw.tabIndex = gen ? -1 : 0;
    genPanel.hidden = !gen;
    drawPanel.hidden = gen;
    studioBlurb.textContent = BLURB[mode];
    if (!gen) previewDrawing();
  }

  tabGenerate.addEventListener('click', () => setMode('generate'));
  tabDraw.addEventListener('click', () => {
    setMode('draw');
    showDrawingWorkspace();
  });
  [tabGenerate, tabDraw].forEach(tab => {
    tab.addEventListener('keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const next = mode === 'generate' ? 'draw' : 'generate';
      setMode(next);
      (next === 'generate' ? tabGenerate : tabDraw).focus();
    });
  });

  function padPos(e) {
    const r = pad.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (pad.width / r.width), y: (e.clientY - r.top) * (pad.height / r.height) };
  }

  function strokeTo(a, b) {
    ctx.globalCompositeOperation = brush.erase ? 'destination-out' : 'source-over';
    ctx.strokeStyle = brush.color;
    ctx.lineWidth = brush.size * 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  function pushStrokeUndo() {
    undoStack.push({ type: 'stroke', pixels: ctx.getImageData(0, 0, pad.width, pad.height) });
    if (undoStack.length > 12) undoStack.shift();
  }

  // Same left/top/width/height/transform math art/sprite.js uses to place a stamp on the
  // shelf, so a stamp previewed here lands in the same relative spot once rendered small.
  function renderStampEl(s) {
    const el = document.createElement('div');
    el.className = 'sprite-stamp';
    el.style.left = (s.x / CANVAS_SIZE * 100) + '%';
    el.style.top = (s.y / CANVAS_SIZE * 100) + '%';
    const wh = (s.size * STAMP_SCALE / CANVAS_SIZE * 100) + '%';
    el.style.width = wh;
    el.style.height = wh;
    el.style.transform = 'translate(-50%,-50%)';
    el.style.color = s.color;
    el.innerHTML = STAMP_SVG[s.kind] || '';
    return el;
  }

  function placeStamp(p) {
    const s = { kind: brush.stamp, x: p.x, y: p.y, size: brush.size * 1.7, rotation: 0, color: brush.color };
    stamps.push(s);
    undoStack.push({ type: 'stamp' });
    if (undoStack.length > 12) undoStack.shift();
    const el = renderStampEl(s);
    stampEls.push(el);
    stampLayer.appendChild(el);
    previewDrawing();
  }

  pad.addEventListener('pointerdown', e => {
    e.preventDefault();
    pad.setPointerCapture(e.pointerId);
    const p = padPos(e);
    if (brush.stamp) { placeStamp(p); return; }
    pushStrokeUndo();
    drawing = true;
    lastPt = p;
    strokeTo(p, p);
  });
  pad.addEventListener('pointermove', e => {
    if (!drawing) return;
    const p = padPos(e);
    strokeTo(lastPt, p);
    lastPt = p;
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => pad.addEventListener(ev, () => { if (drawing) { drawing = false; lastPt = null; previewDrawing(); } }));

  sizeWrap.addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    brush.stamp = null;
    stampPickerWrap.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', 'false'));
    sizeWrap.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', 'false'));
    chip.setAttribute('aria-pressed', 'true');
    if (chip.dataset.erase) brush.erase = true;
    else { brush.erase = false; brush.size = Number(chip.dataset.size); }
  });

  undoBtn.addEventListener('click', () => {
    if (!undoStack.length) return;
    const entry = undoStack.pop();
    if (entry.type === 'stamp') {
      stamps.pop();
      const el = stampEls.pop();
      if (el && el.parentNode) el.parentNode.removeChild(el);
      previewDrawing();
      return;
    }
    if (entry.stamps) {
      stamps = entry.stamps;
      stampEls = stamps.map(renderStampEl);
      stampLayer.replaceChildren(...stampEls);
    }
    ctx.globalCompositeOperation = 'source-over';
    if (entry.pixels) ctx.putImageData(entry.pixels, 0, 0);
    previewDrawing();
  });

  // Clear the entire drawing, with a single undo restoring body and stamps.
  clearBtn.addEventListener('click', () => {
    pushStrokeUndo();
    undoStack[undoStack.length - 1].stamps = stamps.map(s => ({ ...s }));
    stamps = [];
    stampEls = [];
    stampLayer.replaceChildren();
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, pad.width, pad.height);
    previewDrawing();
  });

  function isEmpty() {
    const d = ctx.getImageData(0, 0, pad.width, pad.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return false;
    return true;
  }

  function padThumb() {
    // Keep the original resolution for crisp ink on high-density displays.
    return pad.toDataURL('image/png');
  }

  // `unlockedBond` is accepted for contract-shape parity with the caller (main.js may
  // already have a fresh totalBond(state) on hand), but since `state` is imported live
  // here, rebuilding straight from `state` is always correct and avoids a second,
  // possibly-stale source of truth. See report for this judgment call.
  function rebuildPalette(unlockedBond) {
    swatchesWrap.innerHTML = '';
    unlockedColors(state).forEach(c => {
      const b = document.createElement('button');
      b.className = 'sw';
      b.style.background = c;
      b.setAttribute('aria-pressed', c === brush.color ? 'true' : 'false');
      b.setAttribute('aria-label', 'Color ' + c);
      b.addEventListener('click', () => {
        brush.color = c;
        brush.erase = false;
        swatchesWrap.querySelectorAll('.sw').forEach(x => x.setAttribute('aria-pressed', 'false'));
        b.setAttribute('aria-pressed', 'true');
        eraserChip.setAttribute('aria-pressed', 'false');
        const m = sizeWrap.querySelector('.chip[data-size="' + brush.size + '"]');
        if (m) m.setAttribute('aria-pressed', 'true');
      });
      swatchesWrap.appendChild(b);
    });
  }

  function rebuildStamps(unlockedBond) {
    stampPickerWrap.innerHTML = '';
    unlockedStampKinds().forEach(key => {
      const b = document.createElement('button');
      b.className = 'chip';
      b.textContent = STAMP_LABELS[key];
      b.setAttribute('aria-pressed', brush.stamp === key ? 'true' : 'false');
      b.addEventListener('click', () => {
        const on = brush.stamp === key;
        stampPickerWrap.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', 'false'));
        brush.stamp = on ? null : key;
        b.setAttribute('aria-pressed', on ? 'false' : 'true');
      });
      stampPickerWrap.appendChild(b);
    });
  }

  function open(unlockedBond, existing=null, draft=null) {
    const generation=++openGeneration; editingId=existing?.id||null;
    studioVeil.querySelector('h2').textContent=existing?'Edit '+existing.name:'Make a pet';
    document.getElementById('petNameHint').textContent=existing?'Appearance changes keep their traits, needs and history. Rename them from their resident card.':'Leave it blank and one gets picked for you. You may regret that.';
    savePet.disabled=false; savePet.textContent=existing?"Save appearance":"Move it in";
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, pad.width, pad.height);
    undoStack = [];
    stamps = [];
    stampEls = [];
    stampLayer.innerHTML = '';
    petName.value = existing?.name || draft?.name || ''; petName.disabled=!!existing;
    personalityEditor.hidden = !!existing;
    personalityDraft = existing ? null : draft?.personality ? normalizePersonalityDraft(draft.personality) : createPersonalityDraft();
    originInput.value = personalityDraft?.origin || '';
    personalityEditor.querySelector('.personality-introduction').open = false;
    if (!existing) syncPersonality();
    brush.stamp = null;
    drawing = false; lastPt = null;
    rebuildPalette(unlockedBond);
    rebuildStamps(unlockedBond);
    // A fresh roll every time the studio opens: the first thing a player sees is
    // a finished creature, not an empty box asking them to be an artist.
    setMode('generate');
    undo.length = 0; redo.length = 0; lockedParts.clear(); selectedPart = 'body'; creature = null;
    setCreature(existing?.art?.creature || draft?.creature || generateCreature(), false);
    syncLocks();
    syncBlueprints();
    if(existing && !existing.art?.creature){
      setMode('draw');
      stamps=(existing.art.stamps||[]).map(s=>({...s}));
      stampEls=stamps.map(renderStampEl);stampLayer.replaceChildren(...stampEls);
      if(existing.art.body){
        savePet.disabled=true;
        const img=new Image();
        img.onload=()=>{if(generation!==openGeneration)return;ctx.drawImage(img,0,0,pad.width,pad.height);savePet.disabled=false;previewDrawing();};
        img.onerror=()=>{if(generation!==openGeneration)return;toast('The existing drawing could not load. Close and try again to preserve it.');};
        img.src=existing.art.body;
      }else previewDrawing();
    }
    setCreationStep('appearance');
    studioVeil.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    openGeneration++;
    cancelAnimationFrame(previewFrame);
    drawing = false; lastPt = null;
    studioVeil.classList.remove('open');
    document.body.style.overflow = '';
    // Drop the preview sprite. art/animator.js scans the whole document each
    // pass, and a closed studio should not leave a pet it has to keep animating.
    // open() rolls a fresh one anyway.
    genMount.innerHTML = '';
    drawPreview.replaceChildren();
    identityPortrait.replaceChildren();
  }

  function isOpen() {
    return studioVeil.classList.contains('open');
  }

  studioClose.addEventListener('click', close);
  cancelPet.addEventListener('click', close);
  savePet.addEventListener('click', () => {
    if (!editingId && creationStep === 'appearance') {
      if (mode === 'draw' && isEmpty() && !stamps.length) { toast('Draw a body or place a stamp first. It needs something to inhabit.'); return; }
      setCreationStep('identity', true); return;
    }
    const name = (petName.value || '').trim();
    if (mode === 'generate') {
      if (!creature) return;
      onSave({ creature }, name, editingId, editingId ? null : normalizePersonalityDraft(personalityDraft));
      close();
      return;
    }
    if (isEmpty() && !stamps.length) { setCreationStep('appearance', true); toast('Draw a body or place a stamp first. It needs something to inhabit.'); return; }
    const art = drawingArt();
    onSave(art, name, editingId, editingId ? null : normalizePersonalityDraft(personalityDraft));
    close();
  });

  const blueprintBar=document.createElement('div');blueprintBar.className='blueprint-tools';
  blueprintBar.innerHTML='<button class="btn btn-sm" id="keepBlueprint">Keep this design</button><select id="blueprintPicker" aria-label="Saved creature designs"><option value="">Saved designs</option></select><button class="btn btn-ghost btn-sm" id="forgetBlueprint">Remove selected design</button>';
  genPanel.appendChild(blueprintBar);
  function syncBlueprints(){
    const picker=document.getElementById('blueprintPicker');picker.replaceChildren(new Option('Saved designs · '+(state.life?.blueprints?.length||0)+'/6',''));
    (state.life?.blueprints||[]).forEach((b,i)=>picker.add(new Option(b.name,String(i))));
    document.getElementById('forgetBlueprint').disabled=true;
  }
  document.getElementById('keepBlueprint').addEventListener('click',()=>{
    if(!creature||!state.life)return;
    if(state.life.blueprints.length>=6){toast('Six designs kept. Select and remove one to make room.');return;}
    state.life.blueprints.push({name:petName.value.trim()||'Design '+(state.life.blueprints.length+1),creature:structuredClone(creature)});save();syncBlueprints();toast('Design kept. The original has retained its lawyer.');
  });
  document.getElementById('blueprintPicker').addEventListener('change',e=>{
    document.getElementById('forgetBlueprint').disabled=e.target.value==='';
    if(e.target.value==='')return;const b=state.life?.blueprints?.[Number(e.target.value)];if(b)setCreature(b.creature);
  });
  document.getElementById('forgetBlueprint').addEventListener('click',()=>{
    const picker=document.getElementById('blueprintPicker');if(picker.value==='')return;state.life.blueprints.splice(Number(picker.value),1);save();syncBlueprints();
  });
  buildPartChips();
  buildPalette();

  return { open, close, rebuildPalette, rebuildStamps, isOpen, isEmpty };
}

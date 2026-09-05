import { moodOf, isAsleep, MOOD_WORD } from '../engine/tick.js';
import { careFor, CARE_GAIN } from '../engine/care.js';
import { checkUnlocks } from '../engine/unlocks.js';
import { checkAchievements, grudgeStageFor, GRUDGE_STAGE_AT } from '../engine/achievements.js';
import { TRAIT_BY_ID } from '../content/traits.js';
import { PROPS, PROP_ART } from '../content/props.js';
import { renderPetSprite, moodMotionClasses } from '../art/sprite.js';
import { reactTo } from '../art/animator.js';
import { renderAll, escapeHtml } from './render.js';
import { toast } from './toast.js';
import { buildDecor } from './decorUI.js';
import { playFeed, playFuss, playClean } from '../audio/sound.js';
import { petById, propById, pick, addNote, save, clamp } from '../state.js';

const cardVeil = document.getElementById('cardVeil');
const cardSheet = document.getElementById('cardSheet');

let openPetId = null;

function slotName(i) {
  return String.fromCharCode(65 + Math.floor(i / 6)) + (i % 6 + 1);
}

function positionControl(state, id) {
  return '<div class="position-control"><label for="residentPosition">Place on shelf</label><select id="residentPosition">' +
    state.slots.map((occupant, i) => '<option value="' + i + '"' + (occupant === id ? ' selected' : '') + '>' +
      slotName(i) +
      (occupant && occupant !== id ? ' · swap with ' + escapeHtml((petById(state, occupant) || {}).name || (PROPS[(propById(state, occupant) || {}).kind] || {}).name || 'furniture') : occupant === id ? ' · here' : ' · empty') + '</option>').join('') +
    '</select><button class="btn btn-sm" id="moveResident">Move</button></div>';
}
function wirePosition(state, id) {
  document.getElementById('moveResident').addEventListener('click', () => {
    const from = state.slots.indexOf(id), to = Number(document.getElementById('residentPosition').value);
    if (from < 0 || from === to) { toast('Already there. It appreciates the certainty.'); return; }
    [state.slots[from], state.slots[to]] = [state.slots[to], state.slots[from]];
    save();
    closeCard();
    renderAll(state);
    toast('Moved. The neighbours are reassessing.');
  });
}

// Thresholds mirror engine/achievements.js's GRUDGE_STAGE_AT (5/12/20).
function grievanceLine(pet) {
  const g = pet.grudges || 0;
  if (g === 0) return 'No grievances on file. Yet.';
  if (g < GRUDGE_STAGE_AT[0]) return 'Grievances filed: ' + g + '.';
  if (g < GRUDGE_STAGE_AT[1]) return 'Grievances filed: ' + g + '. It has started numbering them.';
  if (g < GRUDGE_STAGE_AT[2]) return 'Grievances filed: ' + g + '. There is a folder now.';
  return 'Grievances filed: ' + g + '. It has stopped filing and started planning.';
}

function needRow(pet, key, label) {
  const v = Math.round(pet.needs[key]);
  return '<div class="need ' + key + (v < 30 ? ' low' : '') + '"><span>' + label + '</span>' +
    '<span class="bar"><span style="width:' + v + '%"></span></span><span class="num">' + v + '</span></div>';
}

function statRow(label, key, val) {
  return '<div class="stat ' + key + '"><span>' + label + '</span>' +
    '<span class="bar"><span style="width:' + (val * 10) + '%"></span></span><span class="num">' + val + '</span></div>';
}

// The last few things the board has said about this creature, in its own hand.
function onFile(state, pet) {
  const mine = (state.notes || []).filter(n => n.from === pet.name || (n.text && n.text.indexOf(pet.name) >= 0)).slice(0, 3);
  if (!mine.length) return '<p class="on-file-empty">Nothing on file. It is early. It has plans.</p>';
  return '<ul class="on-file">' + mine.map(n => {
    const text = n.text.length > 150 ? n.text.slice(0, 147).trimEnd() + '…' : n.text;
    return '<li class="' + escapeHtml(n.kind || 'note') + '">' + escapeHtml(text) + '</li>';
  }).join('') + '</ul>';
}

export function openCard(state, id, keepScroll) {
  const pet = petById(state, id);
  if (!pet) return;
  openPetId = id;
  const focused = keepScroll && cardSheet.contains(document.activeElement) ? { id: document.activeElement.id, care: document.activeElement.dataset.care } : null;
  const pendingPosition = keepScroll ? document.getElementById('residentPosition')?.value : null;
  const y = keepScroll ? (cardSheet.scrollTop || cardVeil.scrollTop) : 0;
  const mood = moodOf(pet);
  const asleep = isAsleep(pet);
  const dateStr = new Date(pet.born).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const stage = grudgeStageFor(pet.grudges);
  const slot = state.slots.indexOf(pet.id);

  let html = '';
  html += '<div class="sheet-head"><div><h2>' + escapeHtml(pet.name) + '</h2>' +
    '<div class="card-meta">Moved in ' + dateStr + (slot >= 0 ? ' · slot ' + slotName(slot) : '') + (asleep ? ' · asleep right now' : '') + '</div>' +
    '<span class="mood-tag mood-' + mood + '">' + MOOD_WORD[mood] + '</span></div>' +
    '<button class="btn btn-ghost btn-sm" id="cardClose">Close</button></div>';
  html += '<div class="card-hero"><div class="card-portrait" id="cardPortraitHost"></div><div class="needs">' +
    needRow(pet, 'food', 'Fed') + needRow(pet, 'fuss', 'Fussed') + needRow(pet, 'clean', 'Clean') +
    '<div class="bondline"><b>Trust ' + pet.bond + ' of 25.</b> ' + grievanceLine(pet) +
    (stage ? ' Grudge stage ' + stage + ' of ' + GRUDGE_STAGE_AT.length + '.' : '') +
    '<span class="bond-bar"><span style="width:' + (pet.bond / 25 * 100) + '%"></span></span></div>' +
    '</div></div>';
  html += '<div class="care-row">' +
    '<button class="btn care-food" data-care="food">Feed it<small>fed +' + CARE_GAIN.food + '</small></button>' +
    '<button class="btn care-fuss" data-care="fuss">Fuss over it<small>fussed +' + CARE_GAIN.fuss + '</small></button>' +
    '<button class="btn care-clean" data-care="clean">Clean it up<small>clean +' + CARE_GAIN.clean + '</small></button></div>';
  html += '<p class="bio">' + escapeHtml(pet.bio) + '</p>';
  html += '<div class="card-section-title">On file</div>' + onFile(state, pet);
  html += '<div class="card-section-title">Particulars</div>';
  html += statRow('Cute', 'cute', pet.stats.cute) + statRow('Menace', 'menace', pet.stats.menace) +
    statRow('Damp', 'damp', pet.stats.damp) + statRow('Mystique', 'mystique', pet.stats.mystique);
  html += '<ul class="traits">';
  pet.traits.forEach(tid => {
    const t = TRAIT_BY_ID[tid];
    if (!t) return;
    html += '<li><strong>' + escapeHtml(t.name) + '</strong><em>' + escapeHtml(t.blurb) + '</em></li>';
  });
  html += '</ul>';
  html += positionControl(state, pet.id);
  html += '<div class="card-actions"><button class="btn btn-danger btn-sm" id="rehomeBtn">Rehome</button>' +
    '<button class="btn btn-sm" id="renameBtn">Rename</button></div>';

  cardSheet.innerHTML = html;
  // The portrait is a live animated sprite (a real DOM element), appended into
  // the empty host the string left behind.
  const portrait = renderPetSprite(pet);
  portrait.classList.add(...moodMotionClasses(pet, { mood, asleep }));
  document.getElementById('cardPortraitHost').appendChild(portrait);

  cardVeil.classList.add('open');
  document.body.style.overflow = 'hidden';
  cardSheet.scrollTop = y;
  cardVeil.scrollTop = y;
  if (focused?.care) cardSheet.querySelector('[data-care="' + focused.care + '"]')?.focus({ preventScroll: true });
  else if (focused?.id) document.getElementById(focused.id)?.focus({ preventScroll: true });

  wirePosition(state, pet.id);
  if (pendingPosition != null) document.getElementById('residentPosition').value = pendingPosition;
  cardSheet.querySelectorAll('[data-care]').forEach(btn => {
    btn.addEventListener('click', () => {
      const need = btn.dataset.care;
      const result = careFor(state, pet, need);
      toast(result.message);
      if (need === 'food') playFeed();
      else if (need === 'fuss') playFuss();
      else if (need === 'clean') playClean();
      checkUnlocks(state);
      checkAchievements(state);
      save();
      renderAll(state);
      if (cardVeil.classList.contains('open') && openPetId === pet.id) {
        openCard(state, pet.id, true);
      }
      // After the re-render: renderAll throws away the element the reaction
      // has to play on. reactTo finds the pet again by id, on the shelf and in
      // the portrait at once.
      reactTo(pet.id, need);
    });
  });
  document.getElementById('cardClose').addEventListener('click', closeCard);
  // Rename and Rehome deliberately do NOT use the native prompt()/confirm():
  // Chrome silently suppresses them after "Prevent this page from creating
  // additional dialogs", and they are unreliable inside installed PWAs.
  document.getElementById('renameBtn').addEventListener('click', () => {
    const actions = document.querySelector('#cardSheet .card-actions');
    if (!actions || document.getElementById('renameField')) return;
    const row = document.createElement('div');
    row.className = 'inline-prompt';
    row.innerHTML =
      '<label for="renameField">New name</label>' +
      '<input type="text" id="renameField" maxlength="22" value="' + escapeHtml(pet.name) + '">' +
      '<button class="btn btn-primary btn-sm" id="renameSave">Save</button>' +
      '<button class="btn btn-ghost btn-sm" id="renameCancel">Cancel</button>';
    actions.insertAdjacentElement('afterend', row);
    const field = document.getElementById('renameField');
    field.focus();
    field.select();

    function commit() {
      const next = (field.value || '').trim();
      if (!next) { row.remove(); return; }
      pet.name = next.slice(0, 22);
      save();
      openCard(state, pet.id, true);
      renderAll(state);
    }
    document.getElementById('renameSave').addEventListener('click', commit);
    document.getElementById('renameCancel').addEventListener('click', () => row.remove());
    field.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); row.remove(); }
    });
  });
  document.getElementById('rehomeBtn').addEventListener('click', () => {
    const btn = document.getElementById('rehomeBtn');
    // Two-step confirm in-page: the first click arms it, the second commits.
    if (btn.dataset.armed !== '1') {
      btn.dataset.armed = '1';
      btn.textContent = 'Really rehome? It does not come back.';
      setTimeout(() => {
        if (btn.isConnected && btn.dataset.armed === '1') {
          btn.dataset.armed = '';
          btn.textContent = 'Rehome';
        }
      }, 4000);
      return;
    }
    state.pets = state.pets.filter(x => x.id !== pet.id);
    state.slots = state.slots.map(s => s === pet.id ? null : s);
    state.pets.forEach(o => { o.needs.fuss = clamp(o.needs.fuss - 9, 0, 100); });
    addNote(state, pet.name + ' is gone. The others noticed immediately and said nothing.', 'the shelf', 'feud');
    if (state.pets.length) {
      addNote(state, pick([
        'They have counted themselves twice since.',
        'Nobody has taken the empty space. Nobody will.',
        'One of them asked whether there is a list, and whether it is on it.',
        'Somebody has put a crumb in the empty slot. Nobody will say whether it is an offering.'
      ]), 'the shelf', 'angry');
    }
    save();
    closeCard();
    renderAll(state);
  });
}

export function openPropCard(state, id) {
  const pr = propById(state, id);
  if (!pr) return;
  const def = PROPS[pr.kind] || { name: 'Unfamiliar furniture', desc: 'This belongs to a newer shelf.', ambient: ['It has not introduced itself.'], aura: {} };
  openPetId = null;
  const AURA_WORD = { food: 'hunger', fuss: 'boredom', clean: 'grime' };
  const auras = Object.entries(def.aura || {}).map(([k, v]) => AURA_WORD[k] + (v < 1 ? ' slows' : ' speeds up') + ' for neighbours');
  cardSheet.innerHTML =
    '<div class="sheet-head"><div><h2>' + escapeHtml(def.name) + '</h2>' +
    '<div class="card-meta">' + escapeHtml(def.desc) + '</div></div>' +
    '<button class="btn btn-ghost btn-sm" id="cardClose">Close</button></div>' +
    '<div class="card-hero"><div class="card-portrait">' + (PROP_ART[pr.kind] || '') + '</div><div>' +
    '<p class="bio">' + escapeHtml(pick(def.ambient)) + '</p>' +
    (auras.length ? '<p class="hint">' + escapeHtml(auras.join('; ')) + '.</p>' : '<p class="hint">No practical effect. They like it anyway.</p>') +
    '</div></div>' +
    positionControl(state, pr.id) + '<div class="card-actions"><button class="btn btn-danger btn-sm" id="removeProp">Put it away</button></div>';
  cardVeil.classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('cardClose').addEventListener('click', closeCard);
  wirePosition(state, pr.id);
  document.getElementById('removeProp').addEventListener('click', () => {
    state.props = state.props.filter(x => x.id !== pr.id);
    state.slots = state.slots.map(x => x === pr.id ? null : x);
    addNote(state, def.name + ' has been put away. Somebody has noticed.', 'the shelf', 'note');
    save();
    closeCard();
    buildDecor(state);
    renderAll(state);
  });
}

// Lets main.js's periodic tick know which pet's card (if any) to silently
// refresh, without needing its own copy of this module's open-card state.
export function getOpenPetId() {
  return openPetId;
}

export function closeCard() {
  openPetId = null;
  cardVeil.classList.remove('open');
  document.body.style.overflow = '';
}

cardVeil.addEventListener('click', e => { if (e.target === cardVeil) closeCard(); });

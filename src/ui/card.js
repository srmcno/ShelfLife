import { moodOf, isAsleep, MOOD_WORD } from '../engine/tick.js';
import { careFor } from '../engine/care.js';
import { checkUnlocks } from '../engine/unlocks.js';
import { checkAchievements, grudgeStageFor, GRUDGE_STAGE_AT } from '../engine/achievements.js';
import { TRAIT_BY_ID } from '../content/traits.js';
import { PROPS, PROP_ART } from '../content/props.js';
import { renderPetSprite } from '../art/sprite.js';
import { reactTo } from '../art/animator.js';
import { renderAll, escapeHtml } from './render.js';
import { toast } from './toast.js';
import { buildDecor } from './decorUI.js';
import { playFeed, playFuss, playClean } from '../audio/sound.js';
import { petById, propById, pick, addNote, save, clamp } from '../state.js';

const cardVeil = document.getElementById('cardVeil');
const cardSheet = document.getElementById('cardSheet');

let openPetId = null;

// Thresholds mirror engine/achievements.js's GRUDGE_STAGE_AT (5/12/20) rather
// than the original prototype's hardcoded 4/10/20, so this stays in sync with
// the actual grudge-stage escalation logic.
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

export function openCard(state, id, keepScroll) {
  const pet = petById(state, id);
  if (!pet) return;
  openPetId = id;
  const y = keepScroll ? cardVeil.scrollTop : 0;
  const mood = moodOf(pet);
  const asleep = isAsleep(pet);
  const dateStr = new Date(pet.born).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const stage = grudgeStageFor(pet.grudges);

  let html = '';
  html += '<div class="sheet-head"><div><h2>' + escapeHtml(pet.name) + '</h2>' +
    '<div class="card-meta">Moved in ' + dateStr + (asleep ? '. Asleep right now.' : '') + '</div>' +
    '<span class="mood-tag mood-' + mood + '">' + MOOD_WORD[mood] + '</span></div>' +
    '<button class="btn btn-ghost btn-sm" id="cardClose">Close</button></div>';
  html += '<div class="card-top"><div class="card-portrait" id="cardPortraitHost"></div><div class="needs">' +
    needRow(pet, 'food', 'Fed') + needRow(pet, 'fuss', 'Fussed') + needRow(pet, 'clean', 'Clean') +
    '<div class="bondline">Bond ' + pet.bond + ' of 25' +
    '<br>' + grievanceLine(pet) +
    '<br>Grudge stage ' + stage + ' of ' + GRUDGE_STAGE_AT.length +
    '<span class="bond-bar"><span style="width:' + (pet.bond / 25 * 100) + '%"></span></span></div>' +
    '</div></div>';
  html += '<div class="care-row">' +
    '<button class="btn" data-care="food">Feed it</button>' +
    '<button class="btn" data-care="fuss">Fuss over it</button>' +
    '<button class="btn" data-care="clean">Clean it up</button></div>';
  html += '<p class="bio">' + escapeHtml(pet.bio) + '</p>';
  html += '<div class="section-rule"></div>';
  html += statRow('Cute', 'cute', pet.stats.cute) + statRow('Menace', 'menace', pet.stats.menace) +
    statRow('Damp', 'damp', pet.stats.damp) + statRow('Mystique', 'mystique', pet.stats.mystique);
  html += '<ul class="traits">';
  pet.traits.forEach(tid => {
    const t = TRAIT_BY_ID[tid];
    if (!t) return;
    html += '<li><strong>' + escapeHtml(t.name) + '</strong><em>' + escapeHtml(t.blurb) + '</em></li>';
  });
  html += '</ul>';
  html += '<div class="card-actions"><button class="btn btn-danger btn-sm" id="rehomeBtn">Rehome</button>' +
    '<button class="btn btn-sm" id="renameBtn">Rename</button></div>';

  cardSheet.innerHTML = html;
  // The portrait is a live animated sprite (a real DOM element), not something
  // that can live inside the innerHTML string above — appended after the fact
  // into the empty host div that string left behind.
  document.getElementById('cardPortraitHost').appendChild(renderPetSprite(pet));

  cardVeil.classList.add('open');
  document.body.style.overflow = 'hidden';
  cardVeil.scrollTop = y;

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
      // After the re-render, not before: renderAll throws away the element the
      // reaction has to play on. reactTo finds the pet again by id, on the
      // shelf and in the portrait at once.
      reactTo(pet.id, need);
    });
  });
  document.getElementById('cardClose').addEventListener('click', closeCard);
  // Rename and Rehome deliberately do NOT use the native prompt()/confirm().
  // Chrome silently makes both return null/false forever once the user ticks
  // "Prevent this page from creating additional dialogs" (which appears after a
  // few dialogs), so Rename appeared completely dead with no error in console.
  // They're also unreliable inside installed PWAs and awkward on mobile, and this
  // game is meant to be installed on a phone. In-page UI instead.
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
        'One of them asked whether there is a list, and whether it is on it.'
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
  const def = PROPS[pr.kind];
  openPetId = null;
  cardSheet.innerHTML =
    '<div class="sheet-head"><div><h2>' + escapeHtml(def.name) + '</h2>' +
    '<div class="card-meta">' + escapeHtml(def.desc) + '</div></div>' +
    '<button class="btn btn-ghost btn-sm" id="cardClose">Close</button></div>' +
    '<div class="card-top"><div class="card-portrait">' + PROP_ART[pr.kind] + '</div><div>' +
    '<p class="bio">' + escapeHtml(pick(def.ambient)) + '</p></div></div>' +
    '<div class="card-actions"><button class="btn btn-danger btn-sm" id="removeProp">Put it away</button></div>';
  cardVeil.classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('cardClose').addEventListener('click', closeCard);
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

// This module only owns cardVeil's own outside-click-to-close behavior — the
// global Escape-key handler (which needs to know about every other veil in
// the app) belongs to main.js (Task 14), not here.
cardVeil.addEventListener('click', e => { if (e.target === cardVeil) closeCard(); });

import { moodOf, isAsleep, hasTrait, MOOD_WORD } from '../engine/tick.js';
import { activeFeuds, feudingIds } from '../engine/achievements.js';
import { totalBond } from '../engine/unlocks.js';
import { renderPetSprite, moodMotionClasses, MOTION_TRAIT_FLAGS } from '../art/sprite.js';
import { captureShelfPositions, playShelfMoves } from '../art/animator.js';
import { PROPS, PROP_ART } from '../content/props.js';

const cabinet = document.getElementById('cabinet');
const notesEl = document.getElementById('notes');
const statusBar = document.getElementById('statusBar');

export function renderAll(state) {
  renderStatus(state);
  renderShelf(state);
  renderNotes(state);
}

export function renderStatus(state) {
  const days = Math.max(1, Math.floor((Date.now() - state.started) / 86400000) + 1);
  const counts = { content: 0, fine: 0, annoyed: 0, furious: 0 };
  state.pets.forEach(p => counts[moodOf(p)]++);
  const feuds = activeFeuds(state).length;
  statusBar.innerHTML =
    '<span>Day <b>' + days + '</b></span>' +
    '<span>Living here: <b>' + state.pets.length + '</b> of ' + state.slots.length + '</span>' +
    '<span class="good">Content: <b>' + counts.content + '</b></span>' +
    '<span>Fine: <b>' + counts.fine + '</b></span>' +
    '<span class="mid">Annoyed: <b>' + counts.annoyed + '</b></span>' +
    '<span class="bad">Furious: <b>' + counts.furious + '</b></span>' +
    '<span>Feuds: <b>' + feuds + '</b></span>' +
    '<span>Bond: <b>' + totalBond(state) + '</b></span>' +
    '<span class="streak-badge">🔥 Streak: <b>' + (state.streak.count || 0) + '</b></span>';
}

function feudDirectionFor(state, pet, slotIndex) {
  const partnerIds = new Set();
  activeFeuds(state).forEach(([a, b]) => {
    if (a.id === pet.id) partnerIds.add(b.id);
    else if (b.id === pet.id) partnerIds.add(a.id);
  });
  if (!partnerIds.size) return null;
  const leftIdx = slotIndex % 6 > 0 ? slotIndex - 1 : -1;
  const rightIdx = slotIndex % 6 < 5 ? slotIndex + 1 : -1;
  if (leftIdx >= 0 && partnerIds.has(state.slots[leftIdx])) return 'right';
  if (rightIdx >= 0 && partnerIds.has(state.slots[rightIdx])) return 'left';
  return null;
}

function petEl(state, pet, slotIndex) {
  const mood = moodOf(pet);
  const asleep = isAsleep(pet);
  const feuding = feudingIds(state).has(pet.id);
  const feudDirection = feuding ? feudDirectionFor(state, pet, slotIndex) : null;

  const btn = document.createElement('button');
  btn.className = 'pet piece' + (feuding ? ' feuding' : '') + (mood === 'furious' ? ' furious' : '') + (asleep ? ' asleep' : '');
  btn.dataset.id = pet.id;
  btn.dataset.kind = 'pet';
  btn.dataset.slot = slotIndex;
  btn.setAttribute('aria-label', 'Take care of ' + pet.name + ', currently ' + MOOD_WORD[mood]);

  // Trait flags are resolved here rather than inside art/sprite.js so the art
  // layer keeps its "no engine/content imports" rule; the animation director
  // reads them back off the element to weight which idle behaviours a pet gets.
  const traits = MOTION_TRAIT_FLAGS.filter(k => hasTrait(pet, k));
  const sprite = renderPetSprite(pet);
  sprite.classList.add(...moodMotionClasses(pet, { mood, asleep, feudDirection, traits }));
  btn.appendChild(sprite);

  const nameplate = document.createElement('span');
  nameplate.className = 'nameplate';
  nameplate.textContent = pet.name;
  btn.appendChild(nameplate);

  const pips = document.createElement('span');
  pips.className = 'pips';
  if (asleep) pips.innerHTML += '<span class="pip zzz">asleep</span>';
  ['food', 'fuss', 'clean'].forEach(k => { if (pet.needs[k] < 42) pips.innerHTML += '<span class="pip ' + k + '"></span>'; });
  btn.appendChild(pips);

  return btn;
}

function propEl(pr, slotIndex) {
  const def = PROPS[pr.kind];
  const btn = document.createElement('button');
  btn.className = 'prop piece';
  btn.dataset.id = pr.id;
  btn.dataset.kind = 'prop';
  btn.dataset.slot = slotIndex;
  btn.setAttribute('aria-label', def.name);
  btn.innerHTML = PROP_ART[pr.kind] + '<span class="nameplate">' + escapeHtml(def.name) + '</span>';
  return btn;
}

export function renderShelf(state) {
  // The cabinet is rebuilt from scratch every render, so a pet that changed
  // slots is destroyed and recreated somewhere else — it would teleport. Snap
  // the old positions first and hand them to the animator afterwards, which
  // replays the difference as an actual walk across the shelf (FLIP).
  const before = captureShelfPositions(cabinet);
  cabinet.innerHTML = '';
  const rows = state.slots.length / 6;
  for (let r = 0; r < rows; r++) {
    // A row with nothing on it collapses to a thin bare shelf (CSS .row-empty)
    // instead of leaving a full-height void. It keeps all six slot elements, so
    // it stays a valid drop target and slot indices stay positional.
    const rowEmpty = state.slots.slice(r * 6, r * 6 + 6).every(id => !id);
    const bareShelf = r === 0 && rowEmpty && !state.pets.length;
    const row = document.createElement('div');
    row.className = 'shelf-row' + (rowEmpty && !bareShelf ? ' row-empty' : '');
    const slots = document.createElement('div');
    slots.className = 'slots';
    for (let c = 0; c < 6; c++) {
      const i = r * 6 + c;
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.dataset.slot = i;
      const id = state.slots[i];
      if (id) {
        const pet = state.pets.find(p => p.id === id);
        if (pet) slot.appendChild(petEl(state, pet, i));
        else {
          const pr = (state.props || []).find(x => x.id === id);
          if (pr) slot.appendChild(propEl(pr, i));
        }
      }
      slots.appendChild(slot);
    }
    // Guarded by rowEmpty (via bareShelf) so props sitting on row 0 with no pets
    // yet are no longer wiped out by the empty-shelf message.
    if (bareShelf) {
      slots.innerHTML = '';
      const msg = document.createElement('div');
      msg.className = 'empty-shelf';
      msg.textContent = 'Nothing lives here yet. Make something.';
      slots.appendChild(msg);
    }
    row.appendChild(slots);
    const plank = document.createElement('div');
    plank.className = 'plank';
    row.appendChild(plank);
    cabinet.appendChild(row);
  }
  playShelfMoves(cabinet, before);
}

export function renderNotes(state) {
  notesEl.innerHTML = '';
  if (!state.notes.length) {
    const d = document.createElement('div');
    d.className = 'notes-empty';
    d.textContent = 'No notes yet. Press "Check the shelf" and see what turns up.';
    notesEl.appendChild(d);
    return;
  }
  state.notes.forEach(n => {
    const d = document.createElement('div');
    // Forms 2/4/6 carry real newlines and rely on .note{white-space:pre-line}.
    // A filled-in document additionally drops the handwriting for a typed face.
    d.className = 'note ' + n.kind + (n.form === 'doc' ? ' note--doc' : '');
    d.innerHTML = escapeHtml(n.text) + '<span class="from">' + escapeHtml(n.from) + '</span>';
    notesEl.appendChild(d);
  });
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

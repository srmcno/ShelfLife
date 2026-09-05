import { renderScheme } from './schemes.js';
import { moodOf, isAsleep, hasTrait, MOOD_WORD } from '../engine/tick.js';
import { activeFeuds, feudingIds, ACHIEVEMENTS } from '../engine/achievements.js';
import { totalBond } from '../engine/unlocks.js';
import { renderPetSprite, moodMotionClasses, MOTION_TRAIT_FLAGS } from '../art/sprite.js';
import { captureShelfPositions, playShelfMoves } from '../art/animator.js';
import { PROPS, PROP_ART } from '../content/props.js';

const cabinet = document.getElementById('cabinet');
const notesEl = document.getElementById('notes');
const statusBar = document.getElementById('statusBar');
let expandedNotes = false;
let notesState = null;
document.getElementById('notesMore').addEventListener('click', () => { expandedNotes = !expandedNotes; if (notesState) renderNotes(notesState); });

export function renderAll(state) {
  renderStatus(state);
  renderShelf(state);
  renderNotes(state);
  renderScheme(state);
  renderProgress(state);
  renderDoors(state);
}

// Three figures, and a fourth only when something is wrong. The mood census is
// already on the shelf as pips and nameplate ink; this line is what changes
// when the game changes.
export function renderStatus(state) {
  const days = Math.max(1, Math.floor((Date.now() - state.started) / 86400000) + 1);
  const counts = { content: 0, fine: 0, annoyed: 0, furious: 0 };
  state.pets.forEach(p => counts[moodOf(p)]++);
  const feuds = activeFeuds(state).length;
  const unrest = counts.furious + feuds;
  document.getElementById('roundsBtn').disabled = !state.pets.length;
  statusBar.innerHTML =
    '<span class="day">Day <b>' + days + '</b></span>' +
    '<span class="pop">Living here <b>' + state.pets.length + '</b><span class="of">of ' + state.slots.length + '</span></span>' +
    '<span class="trust">Trust <b>' + totalBond(state) + '</b></span>' +
    (unrest ? '<span class="bad">Unrest <b>' + unrest + '</b></span>' : '');
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
  const plotting = state.schemes?.active?.petId === pet.id;
  const feuding = feudingIds(state).has(pet.id);
  const feudDirection = feuding ? feudDirectionFor(state, pet, slotIndex) : null;

  const btn = document.createElement('button');
  btn.className = 'pet piece' + (feuding ? ' feuding' : '') + (mood === 'furious' ? ' furious' : '') + (asleep ? ' asleep' : '');
  btn.dataset.id = pet.id;
  if (plotting) btn.classList.add('scheming');
  btn.dataset.kind = 'pet';
  btn.dataset.slot = slotIndex;
  btn.dataset.mood = mood;
  btn.setAttribute('aria-label', 'Take care of ' + pet.name + ', currently ' + MOOD_WORD[mood]);

  // Trait flags are resolved here rather than inside art/sprite.js so the art
  // layer keeps its "no engine/content imports" rule; the animation director
  // reads them back off the element to weight which idle behaviours a pet gets.
  const traits = MOTION_TRAIT_FLAGS.filter(k => hasTrait(pet, k));
  const sprite = renderPetSprite(pet);
  sprite.classList.add(...moodMotionClasses(pet, { mood, asleep, feudDirection, traits }));
  if (plotting) sprite.classList.add('sl-plotting');
  btn.appendChild(sprite);

  const nameplate = document.createElement('span');
  nameplate.className = 'nameplate';
  nameplate.textContent = pet.name;
  btn.appendChild(nameplate);

  const pips = document.createElement('span');
  pips.className = 'pips';
  if (plotting && !asleep) pips.innerHTML += '<span class="pip plotting">plotting</span>';
  if (asleep) pips.innerHTML += '<span class="pip zzz">asleep</span>';
  ['food', 'fuss', 'clean'].forEach(k => { if (pet.needs[k] < 42) pips.innerHTML += '<span class="pip ' + k + '"></span>'; });
  btn.appendChild(pips);

  return btn;
}

function propEl(pr, slotIndex) {
  const def = PROPS[pr.kind] || { name: 'Unfamiliar furniture' };
  const btn = document.createElement('button');
  btn.className = 'prop piece';
  btn.dataset.id = pr.id;
  btn.dataset.kind = 'prop';
  btn.dataset.slot = slotIndex;
  // css/style.css gives light-source props their own pool that falls on the
  // neighbours, keyed off this attribute.
  btn.dataset.prop = pr.kind;
  btn.setAttribute('aria-label', def.name);
  btn.innerHTML = (PROP_ART[pr.kind] || '') + '<span class="nameplate">' + escapeHtml(def.name) + '</span>';
  return btn;
}

export function renderShelf(state) {
  // The cabinet is rebuilt from scratch every render, so a pet that changed
  // slots is destroyed and recreated somewhere else — it would teleport. Snap
  // the old positions first and hand them to the animator afterwards, which
  // replays the difference as an actual walk across the shelf (FLIP).
  const focusedId = cabinet.contains(document.activeElement) ? document.activeElement.closest('.piece')?.dataset.id : null;
  const before = captureShelfPositions(cabinet);
  cabinet.innerHTML = '';
  const rows = state.slots.length / 6;
  for (let r = 0; r < rows; r++) {
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
    if (bareShelf) {
      slots.innerHTML = '';
      const msg = document.createElement('div');
      msg.className = 'empty-shelf';
      msg.innerHTML = '<span class="empty-kicker">Vacancy. Eighteen small rooms.</span>' +
        '<strong>Someone should live here.</strong>' +
        '<span>Grow a peculiar little creature, or draw your own. They cannot die. They can hold a grudge, and they will hold it against you.</span>' +
        '<button class="btn btn-primary" type="button">Make your first pet</button>';
      msg.querySelector('button').addEventListener('click', () => document.getElementById('newPetBtn').click());
      slots.appendChild(msg);
    }
    row.appendChild(slots);
    const plank = document.createElement('div');
    plank.className = 'plank';
    row.appendChild(plank);
    cabinet.appendChild(row);
  }
  playShelfMoves(cabinet, before);
  if (focusedId) Array.from(cabinet.querySelectorAll('.piece')).find(el => el.dataset.id === focusedId)?.focus({ preventScroll: true });
}

// Notes the board has already shown, so a fresh one can slide in rather than
// the whole wall re-appearing every render.
const shown = new Set();
let firstRender = true;

export function renderNotes(state) {
  notesState = state;
  const more = document.getElementById('notesMore');
  more.hidden = state.notes.length <= 6;
  more.textContent = expandedNotes ? 'Keep the latest six' : 'Read ' + (state.notes.length - 6) + (state.notes.length === 7 ? ' older note' : ' older notes');
  more.setAttribute('aria-expanded', String(expandedNotes));
  notesEl.innerHTML = '';
  document.getElementById('clearNotes').disabled = !state.notes.length && document.getElementById('clearNotes').dataset.undo !== 'true';
  if (!state.notes.length) {
    const d = document.createElement('div');
    d.className = 'notes-empty';
    d.textContent = state.pets.length ? 'Check the shelf to see what they have to say. Care for them individually to build trust and unlock new things.' : 'First, a creature. Then, the complaints.';
    notesEl.appendChild(d);
    return;
  }
  (expandedNotes ? state.notes : state.notes.slice(0, 6)).forEach(n => {
    const key = n.at + '|' + n.text;
    const fresh = !firstRender && !shown.has(key);
    shown.add(key);
    const d = document.createElement('div');
    // Forms 2/4/6 carry real newlines and rely on .note{white-space:pre-line}.
    // A filled-in document additionally drops the handwriting for a typed face.
    d.className = 'note ' + n.kind + (n.form === 'doc' ? ' note--doc' : '') + (fresh ? ' note--new' : '');
    d.innerHTML = escapeHtml(n.text) + '<span class="from">' + escapeHtml(n.from) + '</span>';
    const time = document.createElement('time');
    const date = new Date(n.at);
    if (Number.isFinite(date.getTime())) {
      time.dateTime = date.toISOString();
      time.className = 'note-time';
      time.textContent = date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      d.appendChild(time);
    }
    notesEl.appendChild(d);
  });
  firstRender = false;
  if (shown.size > 400) shown.clear();
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderProgress(state) {
  const host = document.getElementById('shelfProgress');
  const bond = totalBond(state);
  const next = Object.values(PROPS).filter(p => p.at > bond).sort((a, b) => a.at - b.at)[0];
  if (!state.pets.length) { host.innerHTML = ''; return; }
  host.innerHTML = next ? '<div><span class="eyebrow">Next unlock</span><p><strong>' + escapeHtml(next.name) + '</strong> at ' + next.at + ' trust <span>· ' + (next.at - bond) + ' to go. Care for someone individually.</span></p></div><meter min="0" max="' + next.at + '" value="' + bond + '" aria-label="Trust toward ' + escapeHtml(next.name) + '"></meter>' : '<div><span class="eyebrow">In far too deep</span><p>Every furnishing unlocked. They trust your judgment. An error, surely.</p></div>';
}

function renderDoors(state) {
  const sub = document.getElementById('incidentsSub');
  if (!sub) return;
  const n = (state.achievements || []).length;
  const streak = state.streak && state.streak.count || 0;
  sub.textContent = n
    ? n + ' of ' + ACHIEVEMENTS.length + ' on record' + (streak > 1 ? ' · ' + streak + ' days running' : '')
    : 'Nothing on file. Give it time.';
}

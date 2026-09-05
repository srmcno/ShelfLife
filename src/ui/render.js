import { advanceStories } from '../engine/stories.js';
import { renderStories } from './stories.js';
import { save } from '../state.js';
import { roundsWait } from '../engine/care.js';
import { playWait } from '../engine/play.js';
import { renderScheme } from './schemes.js';
import { moodOf, isAsleep, hasTrait, worstNeed, MOOD_WORD } from '../engine/tick.js';
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
let shelfSeen = null;
document.getElementById('notesMore').addEventListener('click', () => { expandedNotes = !expandedNotes; if (notesState) renderNotes(notesState); });

export function renderAll(state) {
  advanceStories(state);
  renderStatus(state);
  renderShelf(state);
  renderNotes(state);
  renderScheme(state);
  renderProgress(state);
  renderDoors(state);
  renderBrief(state);
  renderStories(state);
  save();
}

// Three figures, and a fourth only when something is wrong. The mood census is
// already on the shelf as pips and nameplate ink; this line is what changes
// when the game changes.
// The moon, as a small drawn disc in the status line. Real phase, computed from
// the synodic month; the line under it is what the shelf makes of it.
const SYNODIC = 29.530588853;
const MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14);
export function moonPhase(now = Date.now()) {
  const age = (((now - MOON_EPOCH) / 86400000) % SYNODIC + SYNODIC) % SYNODIC;
  const f = age / SYNODIC;
  const names = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
  const lines = [
    'The dark ones are very pleased.', 'Something is being planned by lamplight.', 'Half the shelf is awake, and it is the wrong half.',
    'The howling is rehearsed, not felt.', 'Nobody has slept and nobody intends to.', 'The candle has been asked to try harder.',
    'The nocturnal ones are checking the rota.', 'The bowl has been moved toward the dark.'
  ];
  const i = Math.round(f * 8) % 8;
  // A dark disc slid across a light one: 0 covers it (new), a full diameter clears it (full).
  const shift = f < 0.5 ? -(f * 2) : (1 - f) * 2;
  return { name: names[i], line: lines[i], shift: Math.round(shift * 13) };
}

export function renderStatus(state) {
  const days = Math.max(1, Math.floor((Date.now() - state.started) / 86400000) + 1);
  const counts = { content: 0, fine: 0, annoyed: 0, furious: 0 };
  state.pets.forEach(p => counts[moodOf(p)]++);
  const feuds = activeFeuds(state).length;
  const unrest = counts.furious + feuds;
  const moon = moonPhase();
  syncRounds(state);
  statusBar.innerHTML =
    '<span class="day">Day <b>' + days + '</b></span>' +
    '<span class="pop">Living here <b>' + state.pets.length + '</b><span class="of">of ' + state.slots.length + '</span></span>' +
    '<span class="trust">Trust <b>' + totalBond(state) + '</b></span>' +
    (unrest ? '<span class="bad">Unrest <b>' + unrest + '</b></span>' : '') +
    '<span class="moon" title="' + escapeHtml(moon.name + '. ' + moon.line) + '" aria-label="' + escapeHtml(moon.name) + '"><i style="--ms:' + moon.shift + 'px"></i><span class="moon-name">' + escapeHtml(moon.name) + '</span></span>';
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
  const needs = Object.keys(needWords).filter(k => pet.needs[k] < 42).map(k => needWords[k]);
  btn.setAttribute('aria-label', 'Take care of ' + pet.name + ', currently ' + MOOD_WORD[mood] + (needs.length ? ', ' + needs.join(', ') : ''));
  btn.title = pet.name + ' · ' + (needs.join(', ') || MOOD_WORD[mood]);

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
        if (pet) {
          const el = petEl(state, pet, i);
          if (shelfSeen && !shelfSeen.has(pet.id)) el.classList.add('pet-arrival');
          slot.appendChild(el);
        }
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
  shelfSeen = new Set(state.pets.map(p => p.id));
  playShelfMoves(cabinet, before);
  if (focusedId) Array.from(cabinet.querySelectorAll('.piece')).find(el => el.dataset.id === focusedId)?.focus({ preventScroll: true });
}

// Notes the board has already shown, so a fresh one can slide in rather than
// the whole wall re-appearing every render.
const shown = new Set();
let firstRender = true;

// Filter chips above the board. A note is classified from what the engine
// already stamps on it (kind and form), so no note needs a new field.
let noteFilter = 'all';
function noteMatches(n, filter) {
  switch (filter) {
    case 'said': return ['two', 'react', 'direct'].includes(n.form) || n.from === 'overheard';
    case 'complaints': return n.kind === 'angry' || n.kind === 'feud';
    case 'papers': return n.form === 'doc' || n.form === 'list';
    case 'plots': return n.kind === 'scheme';
    default: return true;
  }
}
const filterHost = document.getElementById('noteFilters');
if (filterHost) filterHost.addEventListener('click', e => {
  const chip = e.target.closest('[data-filter]');
  if (!chip) return;
  noteFilter = chip.dataset.filter;
  filterHost.querySelectorAll('[data-filter]').forEach(c => c.setAttribute('aria-pressed', String(c === chip)));
  expandedNotes = false;
  if (notesState) renderNotes(notesState);
});

function renderTeaser(state) {
  const teaser = document.getElementById('shelfTeaser');
  if (!teaser) return;
  const n = state.notes[0];
  teaser.hidden = !n;
  if (!n) return;
  teaser.querySelector('.teaser-text').textContent = n.text.length > 150 ? n.text.slice(0, 148).replace(/\s+\S*$/, '') + '…' : n.text;
  teaser.querySelector('.teaser-by').textContent = n.from;
}

export function renderNotes(state) {
  notesState = state;
  renderTeaser(state);
  const list = state.notes.filter(n => noteMatches(n, noteFilter));
  const more = document.getElementById('notesMore');
  more.hidden = list.length <= 6;
  more.textContent = expandedNotes ? 'Keep the latest six' : 'Read ' + (list.length - 6) + (list.length === 7 ? ' older note' : ' older notes');
  more.setAttribute('aria-expanded', String(expandedNotes));
  notesEl.innerHTML = '';
  document.getElementById('clearNotes').disabled = !state.notes.length && document.getElementById('clearNotes').dataset.undo !== 'true';
  if (!list.length) {
    const d = document.createElement('div');
    d.className = 'notes-empty';
    d.textContent = state.notes.length ? 'Nothing filed under that. Yet.' : state.pets.length ? 'Check the shelf to see what they have to say. Care for them individually to build trust and unlock new things.' : 'First, a creature. Then, the complaints.';
    notesEl.appendChild(d);
    return;
  }
  (expandedNotes ? list : list.slice(0, 6)).forEach(n => {
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

let briefState;
const needWords = { food: 'hungry', fuss: 'lonely', clean: 'grubby' };
function syncRounds(state) {
  const button = document.getElementById('roundsBtn'), remaining = roundsWait(state);
  button.disabled = !state.pets.length || remaining > 0;
  button.querySelector('span').textContent = remaining ? 'Restocking · ' + Math.ceil(remaining / 1000) + 's' : 'Do the rounds';
}
setInterval(() => { if (briefState) syncRounds(briefState); }, 1000);
function renderBrief(state) {
  briefState = state;
  const host = document.getElementById('shelfBrief');
  if (!host) return;
  const sorted = [...state.pets].sort((a, b) => a.needs[worstNeed(a)] - b.needs[worstNeed(b)]);
  const needy = sorted.find(p => p.needs[worstNeed(p)] < 60);
  const playful = state.pets.find(p => !isAsleep(p) && !playWait(p)) || state.pets[0];
  const pet = needy || playful;
  if (!pet) {
    host.innerHTML = '<span class="brief-icon" aria-hidden="true">✦</span><div><b>Make something wonderfully odd.</b><span>Care. Conspire. Collect the evidence.</span></div>';
    return;
  }
  host.innerHTML = '<span class="brief-icon" aria-hidden="true">' + (needy ? '!' : '✦') + '</span><div><b>' + escapeHtml(needy ? pet.name + ' is feeling ' + needWords[worstNeed(pet)] + '.' : 'A little time together?') + '</b><span>' + (needy ? 'Tap to help. Individual care builds trust.' : 'Try a secret handshake with ' + escapeHtml(pet.name) + '.') + '</span></div><button class="btn btn-sm">' + (needy ? 'Care' : 'Play') + ' ↗</button>';
  host.querySelector('button').addEventListener('click', () => window.dispatchEvent(new CustomEvent(needy ? 'shelflife:care' : 'shelflife:play', { detail: { petId: pet.id } })));
}

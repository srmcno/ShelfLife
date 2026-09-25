import { householdAftermath } from '../household-echoes.js';
import { renderLife } from './life.js';
import { renderWelcome } from './welcome.js';
import { renderEscapades } from './escapades.js';
import { renderPlayRug } from './play-rug.js';
import { welcomeView } from '../engine/welcome.js';
import { escapadeView } from '../engine/escapades.js';
import { advanceStories, withStories } from '../engine/stories.js';
import { renderStories } from './stories.js';
import { save } from '../state.js';
import { fileDocument, householdReport, PAPERWORK_LIMIT } from '../paperwork-state.js';
import { syncEffects } from './effects.js';
import { roundsWait } from '../engine/care.js';
import { checkWait } from '../engine/loop.js';
import { isDragging } from './drag.js';
import { playWait } from '../engine/play.js';
import { renderScheme } from './schemes.js';
import { moodOf, isAsleep, hasTrait, worstNeed, MOOD_WORD } from '../engine/tick.js';
import { activeFeuds, ACHIEVEMENTS } from '../engine/achievements.js';
import { totalBond } from '../engine/unlocks.js';
import { petById } from '../state.js';
import { renderPetSprite, moodMotionClasses, MOTION_TRAIT_FLAGS } from '../art/sprite.js';
import { captureShelfPositions, playShelfMoves } from '../art/animator.js';
import { PROPS, PROP_ART } from '../content/props.js';
import { currentScheme, SCHEME_DEADLINE } from '../engine/schemes.js';
import { storyState, caseGate, currentCase, VISIT_LENGTH } from '../engine/stories.js';
import { VISITORS } from '../content/stories.js';
import { renderTheatreControls } from './shelf-theatre.js';
import { createArrivalInvitation } from './arrival.js';
import { renderMayhem } from './mayhem.js';

const cabinet = document.getElementById('cabinet');
const notesEl = document.getElementById('notes');
const statusBar = document.getElementById('statusBar');
let expandedNotes = false;
let notesState = null;
let shelfSeen = null;
const markupForNode = new WeakMap();
function updateMarkup(node, markup, key = markup) {
  if (markupForNode.get(node) === key) return false;
  node.innerHTML = markup;
  markupForNode.set(node, key);
  return true;
}
function updateText(node, text) {
  if (node && node.textContent !== text) node.textContent = text;
}
document.getElementById('notesMore').addEventListener('click', () => { expandedNotes = !expandedNotes; if (notesState) renderNotes(notesState); });

export function renderAll(state) {
  return withStories(state, () => {
    syncEffects(state);
    advanceStories(state);
    renderStatus(state);
    renderShelf(state);
    renderAftermath(state);
    renderNotes(state);
    renderScheme(state);
    renderProgress(state);
    renderDoors(state);
    renderBrief(state);
    renderNeeds(state);
    renderStories(state);
    renderLife(state);
    renderWelcome(state);
    renderEscapades(state);
    renderTheatreControls(state);
    renderPlayRug(state);
    renderMayhem(state);
    save();
  });
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
  // The disc is lit; css/style.css paints an inset shadow whose x-offset is the
  // width of the dark part. Positive shadows the left edge (a waxing moon, lit
  // on the right), negative the right edge (waning). Full is 0, new is the
  // whole diameter.
  const lit = f < 0.5 ? f * 2 : 2 - f * 2;
  const dark = 1 - lit;
  const shift = (f < 0.5 ? 1 : -1) * dark;
  return { name: names[i], line: lines[i], shift: Math.round(shift * 13), lit };
}

export function renderStatus(state) {
  const days = Math.max(1, Math.floor((Date.now() - state.started) / 86400000) + 1);
  const counts = { content: 0, fine: 0, annoyed: 0, furious: 0 };
  state.pets.forEach(p => counts[moodOf(p)]++);
  const feuds = activeFeuds(state).length;
  const unrest = counts.furious + feuds;
  const moon = moonPhase();
  syncRounds(state);
  updateMarkup(statusBar,
    '<span class="day">Day <b>' + days + '</b></span>' +
    '<span class="pop">Living here <b>' + state.pets.length + '</b><span class="of">of ' + state.slots.length + '</span></span>' +
    '<span class="trust">Trust <b>' + totalBond(state) + '</b></span>' +
    (unrest ? '<span class="bad">Unrest <b>' + unrest + '</b></span>' : '') +
    '<span class="moon" title="' + escapeHtml(moon.name + '. ' + moon.line) + '" aria-label="' + escapeHtml(moon.name) + '"><i style="--ms:' + moon.shift + 'px"></i><span class="moon-name">' + escapeHtml(moon.name) + '</span></span>');
}

function feudDirectionFor(state, pet, slotIndex, feuds) {
  const partnerIds = new Set();
  feuds.forEach(([a, b]) => {
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

const artForNode = new WeakMap();
function petEl(state, pet, slotIndex, existing, feuds, feudIds) {
  const mood = moodOf(pet);
  const asleep = isAsleep(pet);
  const plotting = state.schemes?.active?.petId === pet.id;
  const feuding = feudIds.has(pet.id);
  const feudDirection = feuding ? feudDirectionFor(state, pet, slotIndex, feuds) : null;

  const btn = existing || document.createElement('button');
  btn.classList.add('pet', 'piece');
  for (const [name, on] of Object.entries({feuding, furious: mood === 'furious', asleep, scheming: plotting})) btn.classList.toggle(name, on);
  btn.dataset.id = pet.id;
  if (plotting) btn.classList.add('scheming');
  btn.dataset.kind = 'pet';
  btn.dataset.slot = slotIndex;
  // The animation director reads these back to mutter a fragment of this
  // creature's own inner monologue instead of a generic mood bubble.
  btn.dataset.traits = (pet.traits || []).join(' ');
  btn.dataset.mood = mood;
  const needs = Object.keys(needWords).filter(k => pet.needs[k] < 42).map(k => needWords[k]);
  btn.setAttribute('aria-label', 'Take care of ' + pet.name + ', currently ' + MOOD_WORD[mood] + (needs.length ? ', ' + needs.join(', ') : ''));
  btn.title = pet.name + ' · ' + (needs.join(', ') || MOOD_WORD[mood]);

  // Trait flags are resolved here rather than inside art/sprite.js so the art
  // layer keeps its "no engine/content imports" rule; the animation director
  // reads them back off the element to weight which idle behaviours a pet gets.
  const traits = MOTION_TRAIT_FLAGS.filter(k => hasTrait(pet, k));
  let sprite = btn.querySelector('.sprite');
  if (!sprite || artForNode.get(btn) !== pet.art) {
    const next = renderPetSprite(pet);
    if (sprite) sprite.replaceWith(next); else btn.appendChild(next);
    sprite = next; artForNode.set(btn, pet.art);
  }
  const motion = moodMotionClasses(pet, { mood, asleep, feudDirection, traits });
  const previous = (sprite.dataset.moodClasses || '').split(' ').filter(Boolean);
  previous.filter(c => !motion.includes(c)).forEach(c => sprite.classList.remove(c));
  motion.forEach(c => sprite.classList.add(c));
  sprite.dataset.moodClasses = motion.join(' ');
  sprite.classList.toggle('sl-plotting', plotting);
  let nameplate = btn.querySelector('.nameplate');
  if (!nameplate) { nameplate = document.createElement('span'); nameplate.className = 'nameplate'; btn.appendChild(nameplate); }
  if (nameplate.textContent !== pet.name) nameplate.textContent = pet.name;
  let pips = btn.querySelector('.pips');
  if (!pips) { pips = document.createElement('span'); pips.className = 'pips'; btn.appendChild(pips); }
  const pipMarkup = (plotting && !asleep ? '<span class="pip plotting">plotting</span>' : '') +
    (asleep ? '<span class="pip zzz">asleep</span>' : '') +
    ['food', 'fuss', 'clean'].filter(k => pet.needs[k] < 42).map(k => '<span class="pip ' + k + '"></span>').join('');
  if (pips.innerHTML !== pipMarkup) pips.innerHTML = pipMarkup;

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

let shelfLayout = '';
export function renderShelf(state) {
  // A household can outlive its residents. Keep its furniture, notes and
  // museum accessible after the last resident leaves; only a new shelf needs
  // the full invitation in place of those views.
  const vacant = !state.pets.length && !state.props.length &&
    !state.gone?.length && !state.stories?.residents?.length;
  document.body.classList.toggle('shelf-vacant', vacant);
  document.body.classList.toggle('focus-shelf',state.pets.length>0&&state.life?.focusShelf===true);
  const framing=document.getElementById('shelfFocus');
  if(framing){framing.hidden=!state.pets.length;framing.setAttribute('aria-pressed',String(state.life?.focusShelf===true));framing.textContent=state.life?.focusShelf?'Show all shelves':'Focus occupied shelves';}
  if (isDragging()) return;
  const layout = JSON.stringify(state.slots);
  const moved = shelfLayout !== layout;
  const before = moved ? captureShelfPositions(cabinet) : null;
  const focusedId = cabinet.contains(document.activeElement) ? document.activeElement.closest('.piece')?.dataset.id : null;
  const pieces = new Map([...cabinet.querySelectorAll('.piece')].map(el => [el.dataset.id, el]));
  const pets = new Map(state.pets.map(p => [p.id, p]));
  const feuds = activeFeuds(state), feudIds = new Set(feuds.flatMap(pair => pair.map(p => p.id)));
  const props = new Map((state.props || []).map(p => [p.id, p]));
  const rows = Math.ceil(state.slots.length / 6);
  while (cabinet.children.length > rows) cabinet.lastElementChild.remove();
  for (let r = 0; r < rows; r++) {
    let row = cabinet.children[r];
    if (!row) {
      row = document.createElement('div'); row.className = 'shelf-row';
      row.innerHTML = '<div class="slots"></div><div class="plank"></div>'; cabinet.appendChild(row);
    }
    const slots = row.firstElementChild;
    const rowEmpty = state.slots.slice(r * 6, r * 6 + 6).every(id => !id);
    const bareShelf = r === 0 && rowEmpty && vacant;
    row.classList.toggle('row-empty', rowEmpty && !bareShelf);
    if (bareShelf) {
      if (!slots.querySelector('.empty-shelf')) {
        slots.replaceChildren(createArrivalInvitation());
      }
      continue;
    }
    slots.querySelector('.empty-shelf')?.remove();
    for (let c = 0; c < 6; c++) {
      const i = r * 6 + c, id = state.slots[i];
      let slot = slots.children[c];
      if (!slot) { slot = document.createElement('div'); slot.className = 'slot'; slot.dataset.slot = i; slots.appendChild(slot); }
      const pet = pets.get(id), prop = props.get(id);
      let piece = pieces.get(id);
      if (pet) {
        piece = petEl(state, pet, i, piece?.dataset.kind === 'pet' ? piece : null, feuds, feudIds);
        if (shelfSeen && !shelfSeen.has(pet.id)) piece.classList.add('pet-arrival');
      } else if (prop) {
        if (!piece || piece.dataset.prop !== prop.kind) piece = propEl(prop, i);
        piece.dataset.slot = i;
        if (prop.kind === 'lamp') {
          const lit=state.theatre?.lamps?.[prop.id]!==false;
          piece.dataset.lit=String(lit);
          piece.setAttribute('aria-label',PROPS.lamp.name+' · '+(lit?'on':'off')+' · open controls');
        }
      } else piece = null;
      if (slot.firstElementChild !== piece) slot.replaceChildren(...(piece ? [piece] : []));
    }
  }
  shelfSeen = new Set(pets.keys()); shelfLayout = layout;
  if (before) playShelfMoves(cabinet, before);
  if (focusedId && document.activeElement?.dataset.id !== focusedId) pieces.get(focusedId)?.focus({preventScroll:true});
}

// Notes the board has already shown, so a fresh one can slide in rather than
// the whole wall re-appearing every render.
const shown = new Set();
let firstRender = true;

// Filter chips above the board. A note is classified from what the engine
// already stamps on it (kind and form), so no note needs a new field.
let noteFilter = 'all';
// A second, orthogonal filter: only notes by or about one resident. Set by
// tapping a byline on the board or the link in a resident's card.
let petFilter = null;
export function nameMentions(text, name) {
  if (!name) return false;
  const safe = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(^|[^\\w])' + safe + '(?=$|[^\\w])', 'i').test(String(text || ''));
}
export function noteAbout(n, name) {
  return n.from === name || nameMentions(n.text, name);
}
export function setPetFilter(state, name) {
  petFilter = name || null;
  expandedNotes = false;
  if (state) { notesState = state; renderNotes(state); }
}
export function getPetFilter() { return petFilter; }
function syncPetChip() {
  const host = document.getElementById('noteFilters');
  if (!host) return;
  host.querySelector('.pet-filter')?.remove();
  if (!petFilter) return;
  const chip = document.createElement('button');
  chip.className = 'filter-chip pet-filter';
  chip.type = 'button';
  chip.dataset.petFilter = petFilter;
  chip.setAttribute('aria-pressed', 'true');
  chip.setAttribute('aria-label', 'Only notes about ' + petFilter + '. Tap to show everyone.');
  chip.innerHTML = 'Only ' + escapeHtml(petFilter) + '<span aria-hidden="true">×</span>';
  host.appendChild(chip);
}
function noteMatches(n, filter) {
  if (petFilter && !noteAbout(n, petFilter) && !(Array.isArray(n.cast) && n.cast.includes(notesState?.pets.find(p => p.name === petFilter)?.id))) return false;
  switch (filter) {
    case 'said': return ['two', 'react', 'direct'].includes(n.form) || n.from === 'overheard';
    case 'complaints': return n.kind === 'angry' || n.kind === 'feud';
    case 'papers': return n.form === 'doc' || n.form === 'list';
    case 'unsaid': return n.form === 'thought';
    case 'plots': return n.kind === 'scheme';
    default: return true;
  }
}
const filterHost = document.getElementById('noteFilters');
const paperworkDesk = document.getElementById('paperworkDesk');
paperworkDesk?.addEventListener('click', e => {
  if (!e.target.closest('[data-file-report]') || !notesState) return;
  const report = fileDocument(notesState, householdReport(notesState));
  if (!report) return;
  const persisted = save();
  renderNotes(notesState);
  const status = paperworkDesk.querySelector('.paperwork-status');
  if (status) status.textContent = persisted ? 'Stamped and filed. Your household report is saved.' : 'Filed for this visit. Storage is unavailable; export a backup in More to keep this record.';
});
if (filterHost) filterHost.addEventListener('click', e => {
  const petChip = e.target.closest('[data-pet-filter]');
  if (petChip) { setPetFilter(notesState, null); return; }
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

let notesKey = null;
export function renderNotes(state) {
  notesState = state;
  const papers = state.paperwork?.entries || [];
  const report = noteFilter === 'papers' ? householdReport(state) : null;
  const key = JSON.stringify([state.notes, papers, report?.key, noteFilter, petFilter, expandedNotes, !!state.pets.length, document.getElementById('clearNotes').dataset.undo]);
  if (key === notesKey) return;
  notesKey = key;
  const pane = document.getElementById('paneNotes');
  pane.classList.toggle('is-paperwork', noteFilter === 'papers');
  pane.querySelector('.destination-heading h1').textContent = noteFilter === 'papers' ? 'Paperwork' : 'The note board';
  pane.querySelector('.destination-heading > p').textContent = noteFilter === 'papers' ? 'The official record of a deeply unofficial household.' : 'Complaints, confessions and the occasional compliment. Mostly complaints.';
  renderTeaser(state);
  const list = (noteFilter === 'papers' ? papers : state.notes).filter(n => noteMatches(n, noteFilter));
  filterHost?.querySelectorAll('[data-filter]').forEach(chip => {
    const label = chip.dataset.label || (chip.dataset.label = chip.textContent);
    const source = chip.dataset.filter === 'papers' ? papers : state.notes;
    const count = source.filter(n => noteMatches(n, chip.dataset.filter)).length;
    chip.innerHTML = escapeHtml(label) + '<span class="filter-count" aria-hidden="true">' + count + '</span>';
    chip.setAttribute('aria-label', label + ', ' + count + (chip.dataset.filter === 'papers' ? ' filed documents' : ' notes'));
  });
  if (paperworkDesk) {
    paperworkDesk.hidden = noteFilter !== 'papers';
    if (!paperworkDesk.hidden) {
      const filed = report && papers.some(doc => doc.key === report.key);
      paperworkDesk.innerHTML = '<div class="paperwork-heading"><span class="paperwork-seal" aria-hidden="true">SL<br>FILED</span><div><span class="eyebrow">The household filing desk</span><h2 id="paperworkTitle">A paper trail. Finally.</h2><p>Court verdicts, expedition reports, market receipts and the residents’ own documents. The latest ' + PAPERWORK_LIMIT + ' stay here when you clear the note board.</p></div></div>' +
        '<div class="paperwork-actions"><button type="button" class="btn" data-file-report' + (!report || filed ? ' disabled' : '') + '>' + (filed ? 'Report up to date' : 'File household report') + '</button>' +
        (state.pets.length ? '<button type="button" class="btn btn-ghost" data-life="court">Open Shelf Court</button><button type="button" class="btn btn-ghost" data-life="outing">Plan an expedition</button>' : '') + '</div>' +
        '<p class="paperwork-status" role="status">' + (!report ? 'Welcome a resident to start your household register.' : filed ? 'This report matches your current household. Care, play and rearrange the shelf to give the clerk something new to record.' : 'Request a real census of your residents, care and completed adventures. The clerk insists on checking the numbers.') + '</p>';
    }
  }
  const more = document.getElementById('notesMore');
  more.hidden = list.length <= 6;
  more.textContent = expandedNotes ? 'Keep the latest six' : 'Read ' + (list.length - 6) + (noteFilter === 'papers' ? ' older documents' : list.length === 7 ? ' older note' : ' older notes');
  more.setAttribute('aria-expanded', String(expandedNotes));
  syncPetChip();
  notesEl.innerHTML = '';
  document.getElementById('clearNotes').disabled = !state.notes.length && document.getElementById('clearNotes').dataset.undo !== 'true';
  document.getElementById('clearNotes').hidden = noteFilter === 'papers';
  if (!list.length) {
    const d = document.createElement('div');
    d.className = 'notes-empty';
    const empty = {
      papers: 'The filing desk is ready. File a household report above, or finish a court case, expedition or market trip to add its record automatically.',
      said: 'No conversations in the latest 40 notes. Check the shelf or care for a resident to hear from the household.',
      complaints: 'No complaints in the latest 40 notes. Enjoy the peace; it is a perfectly good outcome.',
      unsaid: 'No private thoughts in the latest 40 notes. These appear occasionally when you check the shelf, including while residents dream.',
      plots: 'No recent conspiracies on the board. Open Visitors & conspiracies in Stories to follow the household’s current plots.'
    };
    d.textContent = petFilter ? 'No ' + (noteFilter === 'papers' ? 'filed documents' : 'matching notes') + ' about ' + petFilter + '. Remove the “Only” filter to read the whole household.' : !state.pets.length ? 'First, a creature. Then, the complaints.' : empty[noteFilter] || 'Check the shelf to collect notes. Care for a resident to build trust and hear a reply.';
    notesEl.appendChild(d);
    return;
  }
  const residentNames = new Set(state.pets.map(p => p.name));
  (expandedNotes ? list : list.slice(0, 6)).forEach((n, index) => {
    const key = n.at + '|' + n.text;
    const fresh = !firstRender && !shown.has(key);
    shown.add(key);
    const d = document.createElement('div');
    // Forms 2/4/6 carry real newlines and rely on .note{white-space:pre-line}.
    // A filled-in document additionally drops the handwriting for a typed face,
    // and form 9 — the inner voice — is pinned unlined and unsigned, because it
    // is the one note on the board that nobody wrote down on purpose.
    d.className = 'note ' + n.kind + (n.form === 'doc' ? ' note--doc' : '') +
      (n.form === 'thought' ? ' note--thought' : '') + (fresh ? ' note--new' : '');
    // Resident bylines filter the board, so give them native button keyboard
    // behavior. Other authors are labels, not controls. Keep the bare name in
    // the button text because the thought qualifier is CSS generated content.
    const residentAuthor = residentNames.has(n.from);
    const byline = residentAuthor
      ? '<button type="button" class="from" data-note-author aria-label="' + (petFilter === n.from ? 'Show all notes, remove ' + escapeHtml(n.from) + ' filter' : 'Show only notes about ' + escapeHtml(n.from)) + '" aria-pressed="' + (petFilter === n.from) + '">' + escapeHtml(n.from) + '</button>'
      : '<span class="from">' + escapeHtml(n.from) + '</span>';
    d.innerHTML = (n.title ? '<h3 class="document-title">' + escapeHtml(n.title) + '</h3>' : '') + escapeHtml(n.text) + byline;
    const time = document.createElement('time');
    const date = new Date(n.at);
    if (Number.isFinite(date.getTime())) {
      time.dateTime = date.toISOString();
      time.className = 'note-time';
      time.textContent = date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      d.appendChild(time);
    }
    if (noteFilter === 'papers' && n.title) {
      const folded = document.createElement('details');
      folded.className = 'filed-document'; folded.open = index === 0;
      const summary = window.document.createElement('summary');
      summary.appendChild(d.querySelector('.document-title'));
      const time = d.querySelector('time'); if (time) summary.appendChild(time);
      const body = window.document.createElement('div');body.className = 'document-body';
      while (d.firstChild) body.appendChild(d.firstChild);
      folded.append(summary, body);d.appendChild(folded);
    }
    notesEl.appendChild(d);
  });
  firstRender = false;
  if (shown.size > 400) shown.clear();
}

// A resident byline keeps only that resident's paper trail.
if (notesEl) notesEl.addEventListener('click', e => {
  const from = e.target.closest('.note button.from[data-note-author]');
  if (!from || !notesState) return;
  const name = from.textContent;
  setPetFilter(notesState, petFilter === name ? null : name);
  const next = [...notesEl.querySelectorAll('button.from[data-note-author]')].find(button => button.textContent === name);
  (next || filterHost?.querySelector('[data-filter="' + noteFilter + '"]'))?.focus({ preventScroll: true });
});

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderProgress(state) {
  const host = document.getElementById('shelfProgress');
  const bond = totalBond(state);
  const next = Object.values(PROPS).filter(p => p.at > bond).sort((a, b) => a.at - b.at)[0];
  if (!state.pets.length) { updateMarkup(host, ''); return; }
  updateMarkup(host, next ? '<div><span class="eyebrow">Next unlock</span><p><strong>' + escapeHtml(next.name) + '</strong> at ' + next.at + ' trust <span>· ' + (next.at - bond) + ' to go. Care for someone individually.</span></p></div><meter min="0" max="' + next.at + '" value="' + bond + '" aria-label="Trust toward ' + escapeHtml(next.name) + '"></meter>' : '<div><span class="eyebrow">In far too deep</span><p>Every furnishing unlocked. They trust your judgment. An error, surely.</p></div>');
}

function renderDoors(state) {
  const sub = document.getElementById('incidentsSub');
  if (!sub) return;
  const n = (state.achievements || []).length;
  const streak = state.streak && state.streak.count || 0;
  updateText(sub, n
    ? n + ' of ' + ACHIEVEMENTS.length + ' on record' + (streak > 1 ? ' · ' + streak + ' days running' : '')
    : 'Milestones from care, games and household drama.');
}

let briefState;
const needWords = { food: 'hungry', fuss: 'lonely', clean: 'grubby' };
function syncRounds(state) {
  const button = document.getElementById('roundsBtn'), remaining = roundsWait(state);
  const disabled = !state.pets.length || remaining > 0;
  if (button.disabled !== disabled) button.disabled = disabled;
  updateText(button.querySelector('span'), remaining ? 'Restocking · ' + Math.ceil(remaining / 1000) + 's' : 'Do the rounds');
  const check = document.getElementById('checkBtn'), wait = checkWait(state);
  if (check) {
    if (check.disabled !== (wait > 0)) check.disabled = wait > 0;
    updateText(check.querySelector('span'), wait ? 'Listening · ' + Math.ceil(wait / 1000) + 's' : 'Check the shelf');
  }
}
function renderBrief(state) {
  briefState = state;
  const host = document.getElementById('shelfBrief');
  if (!host) return;
  const welcome = welcomeView(state);
  if (welcome && !state.life?.welcome?.dismissed && welcome.stage !== 'finished') {
    const markup = '<span class="brief-icon" aria-hidden="true">✦</span><div><b>' + escapeHtml(welcome.pet.name + ' has a housewarming invitation.') + '</b><span>Unpack a little bowl. Make your first household memory.</span></div><button class="btn btn-sm">Come in</button>';
    if (updateMarkup(host, markup)) host.querySelector('button').addEventListener('click', () => window.dispatchEvent(new CustomEvent('shelflife:goto', {detail:{tab:'plots',target:'#welcomePanel'}})));
    return;
  }
  const adventure = escapadeView(state).active;
  if (adventure) {
    const text = adventure.ready ? 'The story is ready for its ending. You get to choose.' : 'Your place is saved. ' + adventure.completedSteps + ' of 2 moments shared.';
    updateMarkup(host, '<span class="brief-icon" aria-hidden="true">✦</span><div><b>' + escapeHtml(adventure.pet.name + ' saved you a place.') + '</b><span>' + escapeHtml(text) + '</span></div><button id="escapadeBrief" class="btn btn-sm" data-escapade="open">' + (adventure.ready ? 'The ending' : 'Continue') + ' ↗</button>');
    return;
  }
  const recap=state.life?.recap?.map(id=>state.life.scenes.find(scene=>scene.id===id)).filter(Boolean)||[];
  if(recap.length){
    const latest=recap[0],cast=(latest.cast||[]).map(id=>petById(state,id)?.name).filter(Boolean);
    const next=state.life.outing?{action:'outing',label:'Continue expedition'}:state.life.market&&!state.life.market.claimed?{action:'market',label:'Finish the deliveries'}:{action:'scene-select',label:'See what happened'};
    const text=latest.text.length>170?latest.text.slice(0,167).trimEnd()+'…':latest.text;
    updateMarkup(host,'<span class="brief-icon" aria-hidden="true">✦</span><div><b>'+escapeHtml(cast.length?cast.join(' & ')+': '+latest.title:latest.title)+'</b><span>'+escapeHtml(text)+'</span></div><button class="btn btn-sm" data-life="'+next.action+'" data-id="'+latest.id+'">'+next.label+' ↗</button>');
    return;
  }
  const sorted = [...state.pets].sort((a, b) => a.needs[worstNeed(a)] - b.needs[worstNeed(b)]);
  const needy = sorted.find(p => p.needs[worstNeed(p)] < 60);
  const playful = state.pets.find(p => !isAsleep(p) && !playWait(p)) || state.pets[0];
  const pet = needy || playful;
  if (!pet) {
    updateMarkup(host, '<span class="brief-icon" aria-hidden="true">✦</span><div><b>Make something wonderfully odd.</b><span>Care. Conspire. Collect the evidence.</span></div>');
    return;
  }
  const markup = '<span class="brief-icon" aria-hidden="true">' + (needy ? '!' : '✦') + '</span><div><b>' + escapeHtml(needy ? pet.name + ' is feeling ' + needWords[worstNeed(pet)] + '.' : 'A little time together?') + '</b><span>' + (needy ? 'Tap to help. Individual care builds trust.' : 'Try a secret handshake with ' + escapeHtml(pet.name) + '.') + '</span></div><button class="btn btn-sm">' + (needy ? 'Care' : 'Play') + ' ↗</button>';
  if (!updateMarkup(host, markup, JSON.stringify([pet.id, markup]))) return;
  host.querySelector('button').addEventListener('click', () => window.dispatchEvent(new CustomEvent(needy ? 'shelflife:care' : 'shelflife:play', { detail: { petId: pet.id, mode: 'memory' } })));
}

/* ---- what needs you -------------------------------------------------------
   One row of chips for the things with a clock on them or a decision in them:
   a live conspiracy and its deadline, offered requests, a visitor at the door,
   a case beat ready to file, and anyone below thirty on a need. Each chip goes
   to the place the thing is decided. */
let needsState = null;
function needsItems(state) {
  const items = [];
  const now = Date.now();
  const plan = currentScheme(state);
  if (plan) items.push({ key: 'scheme', cls: 'urgent', label: 'Conspiracy', deadline: plan.at + SCHEME_DEADLINE, tab: 'plots', target: '#schemeCard' });
  const s = storyState(state);
  const offered = Object.entries(s.requests).filter(([id, r]) => r.status === 'offered' && state.pets.some(p => p.id === id));
  if (offered.length) items.push({ key: 'requests', cls: '', label: offered.length === 1 ? 'A request' : offered.length + ' requests', small: offered.length === 1 ? (petById(state, offered[0][0]) || {}).name : 'waiting in cards', petId: offered[0][0] });
  if (s.visitor && !s.visitor.welcomed) {
    const d = VISITORS.find(v => v.id === s.visitor.kind);
    items.push({ key: 'visitor', cls: '', label: 'Visitor', small: d ? d.name : 'at the door', deadline: s.visitor.at + VISIT_LENGTH, tab: 'plots', target: '#visitorCard', hours: true });
  }
  const c = currentCase(state);
  if (c && c.beat < 6 && caseGate(state).ready) items.push({ key: 'case', cls: '', label: 'Case file', small: 'evidence ready', tab: 'plots', target: '#caseCard' });
  const sore = state.pets.filter(p => p.needs[worstNeed(p)] < 30).sort((a, b) => a.needs[worstNeed(a)] - b.needs[worstNeed(b)]);
  if (sore.length) items.push({ key: 'sore', cls: 'sore', label: sore.length === 1 ? sore[0].name : sore.length + ' residents', small: sore.length === 1 ? needWords[worstNeed(sore[0])] : 'in a bad way', petId: sore[0].id });
  return items;
}
function countdownText(item, now = Date.now()) {
  const left = Math.max(0, item.deadline - now);
  if (!left) return 'Due now';
  if (item.hours) return Math.max(1, Math.ceil(left / 3600000)) + 'h left';
  const m = Math.floor(left / 60000), sec = Math.floor((left % 60000) / 1000);
  return m + ':' + String(sec).padStart(2, '0');
}
function renderNeeds(state) {
  needsState = state;
  const host = document.getElementById('needsYou');
  if (!host) return;
  const items = needsItems(state);
  // The target and deadline matter even when two residents have the same name,
  // or a new conspiracy happens to have the same visible label as the last one.
  const signature = JSON.stringify(items);
  if (host.dataset.signature === signature) { tickNeeds(); return; }
  host.dataset.signature = signature;
  host.innerHTML = '';
  items.forEach(item => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'need-chip' + (item.cls ? ' ' + item.cls : '');
    chip.innerHTML = '<i aria-hidden="true"></i>' + escapeHtml(item.label) +
      (item.deadline ? ' <b data-countdown>' + countdownText(item) + '</b>' : '') +
      (item.small ? ' <small>' + escapeHtml(item.small) + '</small>' : '');
    chip.dataset.deadline = item.deadline || '';
    chip.dataset.hours = item.hours ? '1' : '';
    chip.addEventListener('click', () => {
      if (item.petId) { window.dispatchEvent(new CustomEvent('shelflife:care', { detail: { petId: item.petId } })); return; }
      window.dispatchEvent(new CustomEvent('shelflife:goto', { detail: { tab: item.tab, target: item.target } }));
    });
    host.appendChild(chip);
  });
}
function tickNeeds() {
  const host = document.getElementById('needsYou');
  if (!host) return;
  const now = Date.now();
  host.querySelectorAll('.need-chip[data-deadline]').forEach(chip => {
    const deadline = Number(chip.dataset.deadline);
    if (!deadline) return;
    const b = chip.querySelector('[data-countdown]');
    updateText(b, countdownText({ deadline, hours: chip.dataset.hours === '1' }, now));
  });
}
setInterval(() => {
  if (document.hidden || document.body.classList.contains('dialog-open')) return;
  if (briefState) syncRounds(briefState);
  if (needsState) tickNeeds();
}, 1000);

function renderAftermath(state) {
  const node=document.getElementById('householdAftermath');if(!node)return;
  const aftermath=householdAftermath(state);node.hidden=!aftermath;if(!aftermath)return;
  node.dataset.kind=aftermath.kind;const pet=petById(state,aftermath.petId);
  const changed=updateMarkup(node,'<div class="aftermath-stage" aria-hidden="true"><span class="aftermath-actor">'+(aftermath.kind==='court'?'♟':aftermath.kind==='bath'?'♧':'•')+'</span><span class="aftermath-object"></span><span class="aftermath-visitor"></span></div><div><b>'+escapeHtml(aftermath.title)+'</b><p>'+escapeHtml(aftermath.text)+'</p><button class="btn btn-sm" data-aftermath-rug>See them on the rug</button></div>',aftermath.id+'|'+pet.name);
  if(changed||artForNode.get(node)!==pet.art){const actor=node.querySelector('.aftermath-actor');actor.replaceChildren(renderPetSprite(pet));artForNode.set(node,pet.art);}
  const button=node.querySelector('[data-aftermath-rug]');button.onclick=()=>window.dispatchEvent(new CustomEvent('shelflife:rug',{detail:{petId:aftermath.petId}}));
}

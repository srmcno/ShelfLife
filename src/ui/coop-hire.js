import { cloud, social } from '../cloud/index.js';
import { createCoop, coopText } from '../cloud/coop.js';
import { guestPet } from '../cloud/social.js';
import { coopState } from '../coop-state.js';
import { hireGuest, guestSkills, guestArrival, guestLine, guestFarewell, reportSent, STAT_KEYS, SKILLED } from '../engine/coop.js';
import { save } from '../state.js';

/* Hired help on this shelf's expeditions: the friends' residents for hire in
   the expedition planner, the hire itself, the guest's lines on the trip and
   the report that goes home afterwards. ui/expeditions.js and ui/life.js call
   in here; everything shown is built from what src/cloud/coop.js has read. */

export const coop = createCoop({ cloud, social });

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const BOARD_FRESH = 90000;
let board = null, boardAt = 0, boardUser = null, loading = false, failure = '', pick = '', notice = '', engaging = false, lastState = null, lastStops = [];
// A drawn resident's picture for the trip in progress. It never goes in the save.
const pictures = new Map();

export const hireOffered = () => !!cloud.configured;
export const hireReady = () => coop.active();

function fresh() { return board && boardUser === cloud.userId() && Date.now() - boardAt < BOARD_FRESH; }
export function loadBoard(force = false) {
  if (!coop.active() || loading || (!force && fresh())) return Promise.resolve(board);
  loading = true; failure = '';
  const user = cloud.userId();
  paintPlanner();
  return coop.hireBoard().then(b => { if (cloud.userId() === user) { board = b; boardAt = Date.now(); boardUser = user; } return board; },
    error => { failure = coopText(error); return null; })
    .finally(() => { loading = false; paintPlanner(); });
}
export function plannedListing() {
  if (!board || boardUser !== cloud.userId()) return null;
  return board.listings.find(l => l.ownerId + '|' + l.petId === pick && l.available) || null;
}
export function pickHire(value) { pick = typeof value === 'string' ? value : ''; notice = ''; }
export function clearHire() { pick = ''; notice = ''; }

// A friend's resident drawn like a pet, for portraits and the trip stage.
export function guestFigure(resident, from, hireId = '') {
  const pet = guestPet({ id: resident.id, name: resident.name, traits: resident.traits, mood: 'fine', bond: 0, art: pictures.get(hireId) || resident.art });
  if (!pet) return null;
  const stats = {};
  for (const k of STAT_KEYS) stats[k] = Number.isInteger(resident.stats?.[k]) ? resident.stats[k] : 5;
  return { ...pet, stats, from: from || 'a friend', hireId };
}
export function plannedCrew() {
  const l = plannedListing();
  return l ? [guestFigure(l.resident, l.ownerName, '')].filter(Boolean) : [];
}
export function tripCrew(outing) {
  const g = outing?.guest;
  return g ? [guestFigure(g, g.from.name, g.hireId)].filter(Boolean) : [];
}
export const guestTag = pet => pet?.guest && pet.from ? ' <small class="co-from">from ' + esc(pet.from) + '’s shelf</small>' : '';

/* ---------------- the planner ---------------- */

const statLine = stats => STAT_KEYS.filter(k => stats[k] >= SKILLED).map(k => k + ' ' + stats[k]).join(', ') || 'no specialities';
function plannerBody(state, stops) {
  if (!coop.active()) return '<p class="co-hire-note">Hired help comes from friends’ shelves. Turn on cloud save, then open Friends and swap codes with someone.</p>';
  if (!board && loading) return '<p class="co-hire-note" role="status">Asking around the neighbourhood.</p>';
  if (!board) return '<p class="co-hire-note" role="status">' + esc(failure || 'Nobody has been asked yet.') + '</p><div class="fr-actions"><button class="btn btn-sm" type="button" data-co-hire-act="retry">Ask again</button></div>';
  if (board.hiredToday) return '<p class="co-hire-note">You have had your hire for today. The agency reopens at midnight, UTC, which is its own kind of midnight.</p>';
  if (!board.listings.length) return '<p class="co-hire-note">None of your friends have anyone up for hire. Ask them. Nag, if you must.</p>';
  const chosen = plannedListing();
  const options = '<option value="">Nobody, thank you</option>' + board.listings.map(l => {
    const key = l.ownerId + '|' + l.petId, why = l.available ? statLine(l.resident.stats) : l.tripsToday >= 3 ? 'three trips today, lying down' : 'not taking work today';
    return '<option value="' + esc(key) + '"' + (key === pick && l.available ? ' selected' : '') + (l.available ? '' : ' disabled') + '>' +
      esc(l.resident.name + ' · from ' + (l.ownerName || 'a friend') + '’s shelf · ' + why) + '</option>';
  }).join('');
  let card = '';
  if (chosen) {
    const skills = guestSkills({ stats: chosen.resident.stats, id: chosen.petId }, stops);
    card = '<article class="co-hire-card"><span class="co-hire-art" data-co-hire-art aria-hidden="true"></span><div><b>' + esc(chosen.resident.name) + '</b>' +
      '<small>from ' + esc(chosen.ownerName || 'a friend') + '’s shelf · ' + esc(statLine(chosen.resident.stats)) + '</small>' +
      '<p>' + esc(skills.length ? 'Makes the detour at stop' + (skills.length === 1 ? ' ' : 's ') + skills.map(i => i + 1).join(' & ') + ' cost 1 nerve.' : 'No specialist shortcut on this route. Good company, allegedly.') + '</p></div></article>';
  }
  return '<label class="fr-label" for="outingHire">Bring along</label><select class="fr-input" id="outingHire"' + (engaging ? ' disabled' : '') + '>' + options + '</select>' + card;
}
export function hirePlannerMarkup(state, stops) {
  if (!hireOffered()) return '';
  lastState = state;
  lastStops = stops;
  if (coop.active() && !fresh() && !loading) queueMicrotask(() => loadBoard());
  return '<section class="co-hire" data-co-hire aria-labelledby="coHireTitle"><h4 class="expedition-pack-heading" id="coHireTitle">Hired help <small>optional</small></h4>' +
    '<p class="hint">Take one friend’s resident along. Its stats count at every stop, and it goes home afterwards with wages paid by the house. One hire a day.</p>' +
    plannerBody(state, stops) + (notice ? '<p class="co-hire-note co-warn" role="status">' + esc(notice) + '</p>' : '') + '</section>';
}
function paintPlanner() {
  const slot = typeof document !== 'undefined' && document.querySelector('[data-co-hire]');
  if (!slot || !lastState) return;
  const focused = slot.contains(document.activeElement) ? document.activeElement.id || document.activeElement.dataset.coHireAct : null;
  slot.outerHTML = hirePlannerMarkup(lastState, lastStops);
  mountHireArt();
  if (focused) (document.getElementById(focused) || document.querySelector('[data-co-hire-act="' + focused + '"]'))?.focus({ preventScroll: true });
}
// The chosen resident's portrait, after any repaint of the planner.
export function mountHireArt(root = document) {
  const holder = root.querySelector?.('[data-co-hire-art]'), l = plannedListing();
  if (!holder || !l) return;
  import('../art/sprite.js').then(({ renderPetSprite }) => { const figure = guestFigure(l.resident, l.ownerName); if (figure && holder.isConnected) holder.replaceChildren(renderPetSprite(figure)); });
}

// Books the chosen resident with the server just before setting out. Resolves
// with the guest for the trip, or null when nobody was chosen; a refusal
// rejects with the player's copy and leaves the plan as it was.
export async function engageHire() {
  const l = plannedListing();
  if (!l) return null;
  if (engaging) throw new Error('Already asking.');
  engaging = true; notice = ''; paintPlanner();
  try {
    const hire = await coop.hire(l.ownerId, l.petId);
    if (hire.resident.art?.body) pictures.set(hire.id, hire.resident.art);
    if (board) board.hiredToday = true;
    pick = '';
    return hireGuest(hire);
  } catch (error) {
    notice = coopText(error);
    loadBoard(true);
    throw error;
  } finally { engaging = false; paintPlanner(); }
}

/* ---------------- on the trip ---------------- */

export function guestStopLine(outing, stepIndex, lead = '') {
  const g = outing?.guest, choice = outing?.choices?.[stepIndex];
  if (!g || choice === undefined) return '';
  return '<p class="co-guest-line"><b>' + esc(g.name) + '</b>' + guestTag({ guest: true, from: g.from.name || 'a friend' }) + ' ' +
    esc('“' + guestLine(g, stepIndex, choice, { lead, gear: outing.gear }) + '”') + '</p>';
}
export function guestArrivalLine(outing, lead = '') {
  const g = outing?.guest;
  return g ? '<p class="co-guest-line">' + esc(guestArrival(g, lead)) + '</p>' : '';
}
export function guestHomeLine(state, outing, lead = '') {
  const g = outing?.guest;
  if (!g) return '';
  queueMicrotask(() => flushOutbox(state));
  const waiting = coopState(state).outbox.some(x => x.hireId === g.hireId);
  return '<section class="co-guest-home"><p>' + esc(guestFarewell(g, lead)) + '</p><small>' +
    esc(waiting ? 'A field report goes to ' + (g.from.name || 'your friend') + ' as soon as there is a connection. Their wages are paid by the house, not by you.'
      : 'The field report has gone to ' + (g.from.name || 'your friend') + '. Their wages are paid by the house, not by you.') + '</small></section>';
}

// Sends the trip reports waiting in the save. A report the server no longer
// wants (the hire came home by itself) is dropped; anything else waits.
let flushing = null;
export function flushOutbox(state) {
  if (flushing || !coop.active() || !coopState(state).outbox.length) return flushing || Promise.resolve(0);
  flushing = (async () => {
    let sent = 0;
    for (const item of coopState(state).outbox.slice()) {
      try { await coop.finishHire(item.hireId, item.report); reportSent(state, item.hireId); sent++; }
      catch (error) {
        if (['not_open', 'not_found', 'bad_report'].includes(error?.code)) reportSent(state, item.hireId);
        else { item.tries = Math.min(99, (item.tries || 0) + 1); if (error?.offline) break; }
      }
    }
    save();
    return sent;
  })().finally(() => { flushing = null; });
  return flushing;
}

if (typeof window !== 'undefined') {
  document.addEventListener('click', e => {
    const b = e.target.closest?.('[data-co-hire-act]');
    if (b?.dataset.coHireAct === 'retry') loadBoard(true);
  });
}

import {
  state, save, addNote, pick, clamp, defaultNeeds, normalizeState, normalizePetArt, HOUR, Store, RECOVERY_KEY, loadFailed
} from './state.js';
import { TRAITS, TRAIT_BY_ID } from './content/traits.js';
import { ORIGINS, HABITS, CLOSERS, FALLBACK_NAMES } from './content/copy.js';
import { tick } from './engine/tick.js';
import { checkShelf, petLine } from './engine/loop.js';
import { runBehavior, catchUpBehavior } from './engine/behavior.js';
import { doRounds } from './engine/care.js';
import { checkAchievements, ACHIEVEMENTS } from './engine/achievements.js';
import { checkUnlocks, totalBond } from './engine/unlocks.js';
import { advanceSchemes } from './engine/schemes.js';
import { initSchemeUI } from './ui/schemes.js';
import { initDialogs } from './ui/dialogs.js';
import { initStudio } from './art/studio.js';
import { initAnimator, reactShelf } from './art/animator.js';
import { applyDecor, initDecorUI } from './ui/decorUI.js';
import { initDrag } from './ui/drag.js';
import { renderAll, renderStatus, renderShelf, renderNotes, escapeHtml } from './ui/render.js';
import { toast } from './ui/toast.js';
import { openCard, closeCard, getOpenPetId } from './ui/card.js';
import { initSoundNoteHook, isMuted, toggleMuted } from './audio/sound.js';
import { initNarrator, initNarratorUI, isNarratorOn, toggleNarrator, stopSpeech } from './audio/narrator.js';

// ---------- pet generation (ported from the original prototype's rollTraits/rollStats/makeBio) ----------

function rollTraits() {
  const pool = TRAITS.slice();
  const count = Math.random() < 0.45 ? 3 : 2;
  const out = [];
  for (let i = 0; i < count; i++) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0].id);
  return out;
}

function rollStats(traitIds) {
  const s = {
    cute: 3 + Math.floor(Math.random() * 5),
    menace: 2 + Math.floor(Math.random() * 5),
    damp: 1 + Math.floor(Math.random() * 4),
    mystique: 2 + Math.floor(Math.random() * 5)
  };
  traitIds.forEach(id => {
    const m = TRAIT_BY_ID[id].stats || {};
    for (const k in m) s[k] = (s[k] || 0) + m[k];
  });
  for (const k in s) s[k] = clamp(s[k], 1, 10);
  return s;
}

function makeBio(traitIds) {
  return pick(ORIGINS) + ' ' + pick(HABITS) + ' ' + TRAIT_BY_ID[traitIds[0]].blurb + ' ' + pick(CLOSERS);
}

// ---------- studio (pet creation) ----------

initDialogs();
const studio = initStudio({
  // `art` arrives in one of the studio's two shapes — `{ creature }` from the
  // Grow tab, `{ body, stamps }` from the Draw tab. normalizePetArt reconciles
  // them into the one stored shape (see the art-model note in state.js), so
  // everything downstream of here is identical for both kinds of pet.
  onSave: (art, name) => {
    const slot = state.slots.indexOf(null);
    if (slot === -1) { toast('The shelf is full. Rehome someone first.'); return; }
    const finalName = (name || '').trim() || pick(FALLBACK_NAMES);
    const traits = rollTraits();
    const pet = {
      id: 'p' + (state.seq++) + '_' + Date.now().toString(36),
      name: finalName,
      art: normalizePetArt(art),
      traits,
      stats: rollStats(traits),
      bio: makeBio(traits),
      born: Date.now(),
      needs: defaultNeeds(),
      bond: 0, cared: 0, grudges: 0, grudgeStage: 0
    };
    state.pets.push(pet);
    state.slots[slot] = pet.id;
    addNote(state, finalName + ' has moved in. ' + TRAIT_BY_ID[traits[0]].blurb + ' ' + pick([
      'It has inspected the edge. It will be staying.',
      'It brought nothing. It has already lost something.',
      'It tried to look taller for the introductions.',
      'It has unpacked. There was a crumb.'
    ]), 'the shelf', 'arrival');
    checkAchievements(state);
    advanceSchemes(state);
    save();
    renderAll(state);
  }
});

document.getElementById('newPetBtn').addEventListener('click', () => {
  if (state.slots.every(s => s !== null)) { toast('The shelf is full. Rehome someone first.'); return; }
  studio.open(totalBond(state));
});

// ---------- toolbar ----------

document.getElementById('roundsBtn').addEventListener('click', () => {
  const result = doRounds(state);
  toast(result ? result.message : 'There is nobody to do rounds for.');
  checkUnlocks(state);
  checkAchievements(state);
  save();
  renderAll(state);
  // Staggered left to right, so doing the rounds reads as you going down the
  // line rather than the whole shelf twitching at once.
  reactShelf(state.slots.filter(Boolean), 'rounds');
});

document.getElementById('checkBtn').addEventListener('click', () => {
  const before = state.noteCount || 0;
  checkShelf(state); // already calls checkUnlocks internally
  checkAchievements(state);
  save();
  renderAll(state);
  // The shelf reacts before the notes are read: everyone glances up at once,
  // staggered, the way a room does when the door opens.
  reactShelf(state.slots.filter(Boolean), 'notice');
  window.dispatchEvent(new CustomEvent('shelflife:checked', { detail: { added: (state.noteCount || 0) - before } }));
});

let clearedNotes = null;
document.getElementById('clearNotes').addEventListener('click', () => {
  const button = document.getElementById('clearNotes');
  if (clearedNotes) {
    state.notes = [...state.notes, ...clearedNotes].slice(0, 40);
    clearedNotes = null;
    button.dataset.undo = '';
    button.textContent = 'Clear notes';
    toast('Notes restored. They kept copies.');
  } else {
    clearedNotes = state.notes.slice();
    state.notes = [];
    button.dataset.undo = 'true';
    button.textContent = 'Undo clear';
  }
  save();
  renderNotes(state);
});

document.getElementById('exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'shelf-life-backup.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
});

let pendingRestore = null;
const restoreVeil = document.getElementById('restoreVeil');
function cancelRestore() { pendingRestore = null; restoreVeil.classList.remove('open'); }
document.getElementById('restoreCancel').addEventListener('click', cancelRestore);
restoreVeil.addEventListener('click', e => { if (e.target === restoreVeil) cancelRestore(); });
document.getElementById('restoreBackup').addEventListener('click', () => document.getElementById('exportBtn').click());
document.getElementById('restoreConfirm').addEventListener('click', () => {
  if (!pendingRestore) return;
  stopSpeech();
  closeCard();
  clearedNotes = null;
  document.getElementById('clearNotes').dataset.undo = '';
  document.getElementById('clearNotes').textContent = 'Clear notes';
  Object.keys(state).forEach(k => delete state[k]);
  Object.assign(state, pendingRestore);
  tick(state);
  catchUpBehavior(state);
  advanceSchemes(state);
  applyDecor(state);
  save();
  renderAll(state);
  syncAudioButtons();
  cancelRestore();
  toast('Shelf restored. Everyone has an opinion about the journey.');
});
const recoveryBtn = document.getElementById('recoveryBtn');
recoveryBtn.hidden = !Store.get(RECOVERY_KEY);
document.getElementById('recoveryWarn').hidden = !loadFailed;
recoveryBtn.addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([Store.get(RECOVERY_KEY)], { type: 'application/json' }));
  a.download = 'shelf-life-recovery.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
const importFile = document.getElementById('importFile');
document.getElementById('importBtn').addEventListener('click', () => importFile.click());
importFile.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 12 * 1024 * 1024) { toast('That backup is too large. Choose a Shelf Life JSON backup under 12 MB.'); e.target.value = ''; return; }
  const fr = new FileReader();
  fr.onerror = () => { toast('That file could not be read. Try choosing it again.'); e.target.value = ''; };
  fr.onload = () => {
    try {
      const normalized = normalizeState(JSON.parse(fr.result));
      if (!normalized) throw new Error('bad save file');
      pendingRestore = normalized;
      document.getElementById('restoreSummary').textContent =
        'This backup contains ' + normalized.pets.length + ' pets and ' + normalized.props.length +
        ' pieces of furniture. It will replace the ' + state.pets.length + ' pets on your current shelf.';
      document.getElementById('restoreVeil').classList.add('open');
    } catch (err) {
      toast('That file did not load.');
    }
    e.target.value = '';
  };
  fr.readAsText(file);
});

// ---------- audio toggles ----------

const muteBtn = document.getElementById('muteBtn');
const narratorBtn = document.getElementById('narratorBtn');
const matureBtn = document.getElementById('matureBtn');

// No emoji. A full-colour OS glyph is the most saturated thing on the page and
// these sit in a dark menu next to hand-drawn creatures that are supposed to be
// the only saturated things in the frame. The aria-pressed state already says
// which way each toggle is set; the word says the rest.
function syncAudioButtons() {
  muteBtn.setAttribute('aria-pressed', String(isMuted()));
  muteBtn.textContent = isMuted() ? 'Muted' : 'Sound';
  narratorBtn.setAttribute('aria-pressed', String(isNarratorOn()));
  narratorBtn.textContent = isNarratorOn() ? 'Narrator' : 'Narrator off';
  matureBtn.setAttribute('aria-pressed', String(!!state.settings.matureMode));
  matureBtn.textContent = state.settings.matureMode ? 'Mature: On' : 'Mature: Off';
}
muteBtn.addEventListener('click', () => { if (toggleMuted()) stopSpeech(); syncAudioButtons(); });
narratorBtn.addEventListener('click', () => { toggleNarrator(); syncAudioButtons(); });
matureBtn.addEventListener('click', () => {
  state.settings.matureMode = !state.settings.matureMode;
  save();
  syncAudioButtons();
});

// ---------- incidents (achievements log) ----------

const incidentsVeil = document.getElementById('incidentsVeil');
const incidentsSheet = document.getElementById('incidentsSheet');

function closeIncidents() {
  incidentsVeil.classList.remove('open');
  document.body.style.overflow = '';
}

function renderIncidents() {
  const unlocked = new Set(state.achievements);
  // The check-in streak used to be a ninth pill on the status rail. It is a log
  // entry, not a vital sign, so it lives here now — next to the other things
  // that have happened.
  const streak = state.streak.count || 0;
  let html = '<div class="sheet-head"><div><h2>Incidents</h2><div class="card-meta">' +
    unlocked.size + ' of ' + ACHIEVEMENTS.length + ' on record' +
    (streak ? ' &middot; checked in ' + streak + (streak === 1 ? ' day' : ' days') + ' running' : '') +
    '</div></div>' +
    '<button class="btn btn-ghost btn-sm" id="incidentsClose">Close</button></div>';
  if (!unlocked.size) html += '<div class="incident-empty">No incidents logged. Give it time. They are working on it.</div>';
  ACHIEVEMENTS.forEach(a => {
    const has = unlocked.has(a.id);
    html += '<div class="incident' + (has ? '' : ' locked') + '"><div><b>' + escapeHtml(has ? a.label : 'Not yet') + '</b><p>' +
      escapeHtml(has ? a.desc : a.hint || 'Something has not happened here yet.') + '</p></div></div>';
  });
  incidentsSheet.innerHTML = html;
  document.getElementById('incidentsClose').addEventListener('click', closeIncidents);
}

document.getElementById('incidentsBtn').addEventListener('click', () => {
  renderIncidents();
  incidentsVeil.classList.add('open');
  document.body.style.overflow = 'hidden';
});
incidentsVeil.addEventListener('click', e => { if (e.target === incidentsVeil) closeIncidents(); });

// ---------- wire the remaining self-contained widgets ----------

initSchemeUI(state, () => renderAll(state));
initDecorUI(state);
initDrag(state);
// One shared director for every pet on the shelf. getPet lets it read a pet's
// traits for thought-bubble copy without art/ importing state.js.
initAnimator({ getPet: id => state.pets.find(p => p.id === id) || null });
initNarrator();
initNarratorUI();
initSoundNoteHook();

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  closeCard();
  studio.close();
  document.getElementById('helpVeil').classList.remove('open');
  document.getElementById('restoreVeil').classList.remove('open');
  closeIncidents();
  document.getElementById('decorVeil').classList.remove('open');
  document.getElementById('voiceVeil').classList.remove('open');
  document.body.style.overflow = '';
});

// ---------- boot ----------

function syncStorageWarning() { document.getElementById('storageWarn').hidden = Store.persistent; }
window.addEventListener('shelflife:storage', syncStorageWarning);
syncStorageWarning();
const helpVeil = document.getElementById('helpVeil');
document.getElementById('quickHelp').addEventListener('click', () => helpVeil.classList.add('open'));
document.getElementById('helpBtn').addEventListener('click', () => helpVeil.classList.add('open'));
document.getElementById('helpClose').addEventListener('click', () => helpVeil.classList.remove('open'));
helpVeil.addEventListener('click', e => { if (e.target === helpVeil) helpVeil.classList.remove('open'); });

(function boot() {
  applyDecor(state);
  const away = (Date.now() - state.lastTick) / HOUR;
  tick(state);
  catchUpBehavior(state);
  advanceSchemes(state);
  save();   // life went on while you were away
  renderAll(state);
  if (state.pets.length && away > 6) {
    const worst = state.pets.slice().sort((a, b) =>
      (a.needs.food + a.needs.fuss + a.needs.clean) - (b.needs.food + b.needs.fuss + b.needs.clean)
    )[0];
    const line = petLine(state, worst);
    addNote(state, line.text, worst.name, line.kind);
    save();
    renderNotes(state);
  }
  syncAudioButtons();
})();

setInterval(() => {
  if (tick(state)) {
    advanceSchemes(state);
    runBehavior(state);                 // self-rate-limited to PASS_INTERVAL_MS
    save();
    renderAll(state);
    const openId = getOpenPetId();
    if (openId && !document.getElementById('renameField') && !document.querySelector('#rehomeBtn[data-armed="1"]')) openCard(state, openId, true);
  }
}, 30000);

// Catch up immediately after waking a sleeping phone or returning to the tab.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { save(); stopSpeech(); return; }
  tick(state);
  catchUpBehavior(state);
  advanceSchemes(state);
  save();
  renderAll(state);
});
window.addEventListener('pagehide', () => save());

// ---------- service worker ----------
// Without this the manifest still makes the game "installable", but there is no
// offline support and no caching at all — service-worker.js was dead code.
// Registered last so a failure here can never block the game from booting.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {
      // Offline support is a bonus, not a requirement. A registration failure
      // (file:// origin, private mode, unsupported browser) must stay silent.
    });
  });
}

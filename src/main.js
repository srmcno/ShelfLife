import {
  state, save, addNote, pick, clamp, defaultNeeds, normalizeState, normalizePetArt, HOUR, Store
} from './state.js';
import { TRAITS, TRAIT_BY_ID } from './content/traits.js';
import { ORIGINS, HABITS, CLOSERS, FALLBACK_NAMES } from './content/copy.js';
import { tick } from './engine/tick.js';
import { checkShelf, petLine } from './engine/loop.js';
import { runBehavior, catchUpBehavior } from './engine/behavior.js';
import { doRounds } from './engine/care.js';
import { checkAchievements, ACHIEVEMENTS } from './engine/achievements.js';
import { checkUnlocks, totalBond } from './engine/unlocks.js';
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
      'The others have gone quiet.',
      'Nobody welcomed it.',
      'Something on the shelf already knows it.',
      'The temperature dropped a little. Probably a draft.'
    ]), 'the shelf', 'arrival');
    checkAchievements(state);
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
  checkShelf(state); // already calls checkUnlocks internally
  checkAchievements(state);
  save();
  renderAll(state);
});

document.getElementById('clearNotes').addEventListener('click', () => {
  state.notes = [];
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

const importFile = document.getElementById('importFile');
document.getElementById('importBtn').addEventListener('click', () => importFile.click());
importFile.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const normalized = normalizeState(JSON.parse(fr.result));
      if (!normalized) throw new Error('bad save file');
      Object.keys(state).forEach(k => delete state[k]);
      Object.assign(state, normalized);
      applyDecor(state);
      save();
      renderAll(state);
      toast('Shelf restored.');
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

function syncAudioButtons() {
  muteBtn.setAttribute('aria-pressed', String(isMuted()));
  muteBtn.textContent = isMuted() ? '🔇 Muted' : '🔊 Sound';
  narratorBtn.setAttribute('aria-pressed', String(isNarratorOn()));
  narratorBtn.textContent = isNarratorOn() ? '🗣️ Narrator' : '🤫 Narrator off';
  matureBtn.setAttribute('aria-pressed', String(!!state.settings.matureMode));
  matureBtn.textContent = state.settings.matureMode ? '🔞 Mature: On' : '🔞 Mature: Off';
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
  let html = '<div class="sheet-head"><div><h2>Incidents</h2><div class="card-meta">' +
    unlocked.size + ' of ' + ACHIEVEMENTS.length + ' on record</div></div>' +
    '<button class="btn btn-ghost btn-sm" id="incidentsClose">Close</button></div>';
  if (!unlocked.size) {
    html += '<div class="incident-empty">No incidents logged. Give it time.</div>';
  } else {
    ACHIEVEMENTS.forEach(a => {
      if (!unlocked.has(a.id)) return;
      html += '<div class="incident"><b>' + escapeHtml(a.label) + '</b><p>' + escapeHtml(a.desc) + '</p></div>';
    });
  }
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
  closeIncidents();
  document.getElementById('decorVeil').classList.remove('open');
  document.getElementById('voiceVeil').classList.remove('open');
  document.body.style.overflow = '';
});

// ---------- boot ----------

if (!Store.persistent) document.getElementById('storageWarn').hidden = false;

(function boot() {
  applyDecor(state);
  const away = (Date.now() - state.lastTick) / HOUR;
  tick(state);
  if (catchUpBehavior(state)) save();   // life went on while you were away
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
    runBehavior(state);                 // self-rate-limited to PASS_INTERVAL_MS
    save();
    renderStatus(state);
    renderShelf(state);
    renderNotes(state);
    const openId = getOpenPetId();
    if (openId) openCard(state, openId, true);
  }
}, 30000);

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

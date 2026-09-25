import { ARCADE_GAMES } from '../content/arcade.js';
import { arcadeState } from '../arcade-state.js';
import { renderPetSprite } from '../art/sprite.js';
import { glyph } from '../art/mayhem-glyphs.js';
import { escapadeView } from '../engine/escapades.js';
import { courtroomState } from '../court-state.js';
import { COURT_CASES } from '../content/court.js';
import { castSvg } from '../art/court-cast.js';

/* The Playroom: pick an accomplice, pick a game. Shelf Court, four arcade
   games and the expedition, each one tap from playing. */

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

export function initPlayroom(state) {
  const veil = document.getElementById('playroomVeil');
  const cards = document.getElementById('activityCards');
  const resident = document.getElementById('playroomResident');
  const portrait = document.getElementById('playroomPortrait');
  const company = document.getElementById('playroomCompany');
  const empty = document.getElementById('playroomEmpty');
  const purpose = document.getElementById('playroomPurpose');
  let selected = '';

  function render() {
    const pet = state.pets.find(p => p.id === selected) || state.pets[0];
    selected = pet?.id || '';
    resident.replaceChildren(...state.pets.map(p => { const o = document.createElement('option'); o.value = p.id; o.textContent = p.name; return o; }));
    resident.value = selected;
    company.hidden = !pet; empty.hidden = !!pet;
    portrait.replaceChildren();
    if (pet) portrait.appendChild(renderPetSprite(pet));
    const adventure = escapadeView(state).active, forUs = adventure && pet && adventure.petId === pet.id && !adventure.playDone;
    purpose.hidden = !forUs;
    if (forUs) purpose.innerHTML = '<b>' + esc(adventure.episode.title) + '</b> · ' + esc(adventure.approach.label) + '. The marked game moves our adventure on.';
    const best = arcadeState(state).best, wanted = forUs ? adventure.approach.activity : '';
    const court = courtroomState(state);
    cards.innerHTML = '<button type="button" class="activity-card play-card court-card' + (wanted === 'court' ? ' for-adventure' : '') + '" data-court style="--ar-accent:#F2C94C" ' + (pet ? '' : 'disabled') + ' aria-label="Shelf Court. Defend ' + esc(pet?.name || 'a resident') + ' against absurd charges. ' + court.solved.length + ' of ' + COURT_CASES.length + ' cases won.">' +
        '<span class="court-card-judge" aria-hidden="true">' + castSvg('judge') + '</span><span class="activity-kind">Courtroom comedy' + (wanted === 'court' ? ' · for our adventure' : '') + '</span><strong>Shelf Court</strong><span class="activity-hook">' + esc(pet?.name || 'Your resident') + ' stands accused. Catch the lying witness. Shout objection.</span>' +
        '<span class="activity-bottom"><span>' + court.solved.length + ' of ' + COURT_CASES.length + ' cases won</span><b class="activity-action" aria-hidden="true">' + (court.solved.length ? 'Next case' : 'Take the case') + '</b></span></button>' +
      ARCADE_GAMES.map(g => '<button type="button" class="activity-card play-card' + (wanted === 'arcade:' + g.id ? ' for-adventure' : '') + '" data-game="' + g.id + '" style="--ar-accent:' + g.accent + '" ' + (pet ? '' : 'disabled') + ' aria-label="Play ' + esc(g.title) + '. ' + esc(g.hook) + ' Best ' + (best[g.id] || 0) + '.">' +
        '<span class="play-card-glyph" aria-hidden="true">' + glyph(g.glyph) + '</span><span class="activity-kind">' + esc(g.kind) + (wanted === 'arcade:' + g.id ? ' · for our adventure' : '') + '</span><strong>' + esc(g.title) + '</strong><span class="activity-hook">' + esc(g.hook) + '</span>' +
        '<span class="activity-bottom"><span>Best ' + (best[g.id] || 0) + '</span><b class="activity-action" aria-hidden="true">Play</b></span></button>').join('') +
      '<button type="button" class="activity-card play-card expedition-card' + (wanted === 'outing' ? ' for-adventure' : '') + '" data-activity="outing" style="--ar-accent:#7FD8C0" ' + (pet ? '' : 'disabled') + ' aria-label="Expeditions. Three stops beyond the shelf to recover parts for household projects.">' +
        '<span class="play-card-glyph" aria-hidden="true">' + glyph('key') + '</span><span class="activity-kind">Adventure' + (wanted === 'outing' ? ' · for our adventure' : '') + '</span><strong>Expeditions</strong><span class="activity-hook">Three stops beyond the shelf. Bring back parts. Build something.</span>' +
        '<span class="activity-bottom"><span>' + (state.life?.outing ? 'Trip in progress' : (state.life?.outings || 0) + ' trips') + '</span><b class="activity-action" aria-hidden="true">' + (state.life?.outing ? 'Resume' : 'Go') + '</b></span></button>';
  }
  function open() {
    if (document.querySelector('.veil.open')) return;
    render(); veil.classList.add('open');
  }
  function close() { veil.classList.remove('open'); }
  document.getElementById('playroomBtn').addEventListener('click', open);
  document.getElementById('playroomClose').addEventListener('click', close);
  resident.addEventListener('change', () => { selected = resident.value; render(); });
  veil.addEventListener('click', e => { if (e.target === veil) close(); });
  document.getElementById('playroomCreate').addEventListener('click', () => { close(); document.getElementById('newPetBtn').click(); });
  cards.addEventListener('click', e => {
    const card = e.target.closest('[data-game],[data-activity],[data-court]');
    if (!card || card.disabled || !state.pets.some(p => p.id === selected)) return;
    close();
    if ('court' in card.dataset) window.dispatchEvent(new CustomEvent('shelflife:court', { detail: { petId: selected } }));
    else if (card.dataset.game) window.dispatchEvent(new CustomEvent('shelflife:arcade', { detail: { game: card.dataset.game, petId: selected } }));
    else window.dispatchEvent(new CustomEvent('shelflife:activity', { detail: { action: 'outing', petId: selected } }));
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'p' && e.key !== 'P' || e.repeat || e.altKey || e.ctrlKey || e.metaKey ||
        e.target.closest?.('input,select,textarea,button,a,[contenteditable="true"]') ||
        document.querySelector('.veil.open,.tray.open')) return;
    e.preventDefault(); open();
  });
}

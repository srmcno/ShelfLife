import { ACTIVITIES, activityRecord, activityPassport } from '../content/activities.js';
import { renderPetSprite } from '../art/sprite.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const drawings = {
  crumb: '<path d="M10 9 19 5l9 7-2 12-12 4-8-9z"/><path d="m13 13 1 1m7 4 1 1m-8 3 1 1M4 5l2 1m25 21 1 1"/>',
  hand: '<path d="M10 26 5 17q-1-4 3-2l3 4V8q0-4 3-2v9-11q3-3 4 0v11-8q3-3 4 0v10-5q4-2 4 2v8q0 9-8 9-5 0-8-5z"/>',
  eye: '<path d="M3 17q13-17 26 0-13 17-26 0z"/><circle cx="16" cy="17" r="4"/><path d="M7 5 4 2m21 3 3-3M16 2v4"/>',
  map: '<path d="m3 8 8-4 10 4 8-4v23l-8 4-10-4-8 4zM11 4v23m10-19v23"/><path d="m7 18 3-3 8 6 7-9" stroke-dasharray="2 3"/>',
  scales: '<path d="M16 4v25M9 29h14M5 9h22M8 10l-5 11h10zm16 0-5 11h10z"/><circle cx="16" cy="5" r="2"/>',
  market: '<path d="M4 13h24v17H4zM3 13 6 4h20l3 9M11 4l-1 9m11-9 1 9M4 13q4 7 8 0 4 7 8 0 4 7 8 0M13 22h6v8"/>'
};
const icon = name => '<svg viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + drawings[name] + '</svg>';

export function initPlayroom(state) {
  const veil = document.getElementById('playroomVeil');
  const cards = document.getElementById('activityCards');
  const resident = document.getElementById('playroomResident');
  const portrait = document.getElementById('playroomPortrait');
  const passport = document.getElementById('playroomPassport');
  let selected = '';
  function close() { veil.classList.remove('open'); }
  function render() {
    const pet = state.pets.find(p => p.id === selected) || state.pets[0];
    selected = pet?.id || '';
    resident.replaceChildren(...state.pets.map(p => {
      const option = document.createElement('option'); option.value = p.id; option.textContent = p.name; return option;
    }));
    resident.value = selected;
    document.getElementById('playroomCompany').hidden = !pet;
    document.getElementById('playroomEmpty').hidden = !!pet;
    portrait.replaceChildren();
    if (pet) portrait.appendChild(renderPetSprite(pet));
    passport.hidden = !pet;
    if (pet) {
      const progress = activityPassport(state), next = ACTIVITIES.find(a => a.id === progress.next);
      passport.innerHTML = '<div class="passport-heading"><div><span class="eyebrow">The household record</span><strong>' +
        (progress.completed === 6 ? 'A thoroughly incriminating evening.' : progress.completed + ' / 6 activities tried') +
        '</strong></div><span class="passport-seal" aria-hidden="true">' + (progress.completed === 6 ? 'FULL<br>HOUSE' : 'ON<br>FILE') + '</span></div>' +
        '<div class="passport-stamps">' + progress.stamps.map(s => '<span class="' + (s.earned ? 'earned' : '') + '"><b aria-hidden="true">' + (s.earned ? '✓' : '○') + '</b>' + esc(s.title) + '<span class="sr-only">' + (s.earned ? ', completed' : ', not yet completed') + '</span></span>').join('') + '</div>' +
        '<div class="passport-next"><p>' + (progress.resume ? 'There is unfinished business.' : progress.completed === 6 ? 'Every activity on record. The witnesses have been separated.' : 'Complete a game to leave your mark. Wins and practice both count.') + '</p><button type="button" class="btn btn-sm" data-activity="' + next.id + '">' + (progress.resume ? 'Resume ' : 'Play ') + esc(next.title) + ' ↗</button></div>';
    }
    cards.innerHTML = ACTIVITIES.map(a => '<button type="button" class="activity-card activity-' + a.id + '" data-activity="' + a.id + '" ' + (!pet ? 'disabled' : '') + '>' +
      '<span class="activity-top"><span class="activity-icon">' + icon(a.icon) + '</span><span>' + esc(a.kind) + ' · ' + esc(a.time) + '</span></span>' +
      '<strong>' + esc(a.title) + '</strong><span class="activity-line">' + esc(a.line) + '</span><span class="activity-detail">' + esc(a.detail) + '</span>' +
      '<span class="activity-bottom"><span>' + esc(activityRecord(a, state, pet)) + '</span><b aria-hidden="true">↗</b></span></button>').join('');
  }
  function open() {
    // Shortcuts never interrupt a game or an unfinished drawing.
    if (document.querySelector('.veil.open')) return;
    render(); veil.classList.add('open');
  }
  document.getElementById('playroomBtn').addEventListener('click', open);
  document.getElementById('playroomClose').addEventListener('click', close);
  resident.addEventListener('change', () => { selected = resident.value; render(); });
  veil.addEventListener('click', e => { if (e.target === veil) close(); });
  document.getElementById('playroomCreate').addEventListener('click', () => { close(); document.getElementById('newPetBtn').click(); });
  function launch(e) {
    const card = e.target.closest('[data-activity]');
    if (!card || card.disabled) return;
    const a = ACTIVITIES.find(x => x.id === card.dataset.activity);
    if (!a || !state.pets.some(p => p.id === selected)) { render(); return; }
    close();
    if (a.mode) window.dispatchEvent(new CustomEvent('shelflife:play', { detail: { petId:selected, mode:a.mode } }));
    else window.dispatchEvent(new CustomEvent('shelflife:activity', { detail: { action:a.life, petId:selected } }));
  }
  cards.addEventListener('click', launch);
  passport.addEventListener('click', launch);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { close(); return; }
    if (e.key.toLowerCase() !== 'p' || e.repeat || e.altKey || e.ctrlKey || e.metaKey ||
        e.target.closest?.('input,select,textarea,button,a,[contenteditable="true"]') ||
        document.querySelector('.veil.open,.tray.open')) return;
    e.preventDefault(); open();
  });
}

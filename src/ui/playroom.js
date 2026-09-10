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
const cardCopy = {
  chase: { title:'Crumb Chase', time:'22s / 3 acts', hook:'Dodge, dash, steal crumbs.' },
  memory: { title:'Handshake', time:'Your pace', hook:'Copy. Reverse. Duet.' },
  alibi: { title:'The Alibi', time:'No timer', hook:'Catch a lie. Prove it.' },
  outing: { title:'Expeditions', time:'3 stops', hook:'Three stops. One tool.' },
  court: { title:'Shelf Court', time:'No timer', hook:'Search. Question. Accuse.' },
  market: { title:'Night Market', time:'6 stalls', hook:'Buy oddities. Sell secrets.' }
};

function continueLabel(id, life = {}) {
  if (id === 'court' && life.court && !life.court.claimed) return 'Continue case';
  if (id === 'outing' && life.outing) return 'Continue expedition';
  if (id === 'market' && life.market && !life.market.claimed) return 'Continue trip';
  return '';
}

function shortRecord(activity, state, pet) {
  if (!pet) return 'Make a resident';
  if (activity.id === 'market' && !state.life?.marketRuns) return 'No trips yet';
  return activityRecord(activity, state, pet).split(' · ')[0].replace(' completed', '');
}

export function initPlayroom(state) {
  const veil = document.getElementById('playroomVeil');
  const cards = document.getElementById('activityCards');
  const resident = document.getElementById('playroomResident');
  const portrait = document.getElementById('playroomPortrait');
  const passport = document.getElementById('playroomPassport');
  const sheet = veil.querySelector('.sheet');
  const company = document.getElementById('playroomCompany');
  const empty = document.getElementById('playroomEmpty');
  const residentLabel = document.createElement('span');
  residentLabel.textContent = 'Playing as';
  resident.parentElement.replaceChildren(residentLabel, resident);
  const intro = sheet.querySelector('.playroom-intro');
  const hint = sheet.querySelector(':scope > .hint');
  // The resident stays above one scrolling catalogue. Long explanations belong
  // to an optional guide, so every game is a visible destination on a phone.
  const toolbar = document.createElement('div');
  toolbar.className = 'playroom-toolbar';
  toolbar.append(company, passport);
  const workspace = document.createElement('div');
  workspace.className = 'playroom-workspace';
  const guide = document.createElement('details');
  guide.className = 'playroom-guide';
  const summary = document.createElement('summary');
  summary.textContent = 'How to play & full records';
  const guideBody = document.createElement('div');
  guideBody.className = 'playroom-guide-body';
  guide.append(summary);
  if (intro) guide.append(intro);
  if (hint) guide.append(hint);
  guide.append(guideBody);
  workspace.append(empty, cards, guide);
  sheet.append(toolbar, workspace);
  let selected = '';
  let returnActivity = '';
  function close() { veil.classList.remove('open'); }
  function render() {
    const pet = state.pets.find(p => p.id === selected) || state.pets[0];
    selected = pet?.id || '';
    resident.replaceChildren(...state.pets.map(p => {
      const option = document.createElement('option'); option.value = p.id; option.textContent = p.name; return option;
    }));
    resident.value = selected;
    company.hidden = !pet;
    empty.hidden = !!pet;
    portrait.replaceChildren();
    if (pet) portrait.appendChild(renderPetSprite(pet));
    passport.hidden = !pet;
    if (pet) {
      const progress = activityPassport(state);
      passport.innerHTML = '<span class="passport-count">' + progress.completed + '/6 games tried</span>' +
        '<span class="passport-dots">' + progress.stamps.map(s => '<span class="' + (s.earned ? 'earned' : '') + '" title="' + esc(s.title) + '"><span aria-hidden="true">' + (s.earned ? '✓' : '○') + '</span><span class="sr-only">' + esc(s.title) + (s.earned ? ', completed' : ', not yet completed') + '</span></span>').join('') + '</span>';
    }
    cards.innerHTML = ACTIVITIES.map(a => {
      const copy = cardCopy[a.id], resume = pet ? continueLabel(a.id, state.life) : '';
      const record = resume || shortRecord(a, state, pet);
      return '<button type="button" class="activity-card activity-' + a.id + (resume ? ' activity-continue' : '') + '" data-activity="' + a.id + '" aria-label="' + esc((resume ? 'Continue ' : 'Play ') + a.title + '. ' + activityRecord(a, state, pet)) + '" ' + (!pet ? 'disabled' : '') + '>' +
        '<span class="activity-top"><span class="activity-icon">' + icon(a.icon) + '</span><span>' + (resume ? 'IN PROGRESS' : esc(copy.time)) + '</span></span>' +
        '<strong>' + esc(copy.title) + '</strong><span class="activity-hook">' + esc(copy.hook) + '</span>' +
        '<span class="activity-bottom"><span>' + esc(record) + '</span><b aria-hidden="true">→</b></span></button>';
    }).join('');
    guideBody.innerHTML = ACTIVITIES.map(a => '<article><h3>' + esc(a.title) + '</h3><p class="playroom-guide-joke">' + esc(a.line) + '</p><p>' + esc(a.detail) + '</p><small>' + esc(activityRecord(a, state, pet)) + '</small></article>').join('');
  }
  function open() {
    // Shortcuts never interrupt a game or an unfinished drawing.
    if (document.querySelector('.veil.open')) return;
    render(); veil.classList.add('open');
    if (returnActivity) {
      const card = cards.querySelector('[data-activity="' + returnActivity + '"]');
      returnActivity = '';
      requestAnimationFrame(() => { if (veil.classList.contains('open')) card?.focus({ preventScroll:true }); });
    }
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
    returnActivity = a.id;
    close();
    if (a.mode) window.dispatchEvent(new CustomEvent('shelflife:play', { detail: { petId:selected, mode:a.mode } }));
    else window.dispatchEvent(new CustomEvent('shelflife:activity', { detail: { action:a.life, petId:selected } }));
  }
  cards.addEventListener('click', launch);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { close(); return; }
    if (e.key.toLowerCase() !== 'p' || e.repeat || e.altKey || e.ctrlKey || e.metaKey ||
        e.target.closest?.('input,select,textarea,button,a,[contenteditable="true"]') ||
        document.querySelector('.veil.open,.tray.open')) return;
    e.preventDefault(); open();
  });
}

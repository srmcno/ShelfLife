import { mastery, masteryTicket, completeMastery, masteryText } from '../mastery-state.js';
import { ACTIVITIES, activityRecord, activityPassport } from '../content/activities.js';
import { renderPetSprite } from '../art/sprite.js';
import { escapadeView } from '../engine/escapades.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
// Tiny scenes describe the actual games. Keeping this art inside the catalogue
// avoids six image requests and keeps the playroom available offline.
const scenes = {
  chase: '<path d="m22 53 16-2m-11-9 16-2m-7 23 8-2" opacity=".45"/>' +
    '<path class="scene-accent" d="M44 58q-2-19 13-27l1-10 9 7 10-7 1 11q13 7 10 24-2 14-22 14-18 0-22-12Z"/>' +
    '<path class="scene-dark" d="m50 66-7 10h14l7-7m13-1 9 9h12l-12-12"/><ellipse class="scene-paper" cx="72" cy="44" rx="12" ry="9"/>' +
    '<circle class="scene-ink" cx="72" cy="44" r="2"/><circle class="scene-ink" cx="80" cy="43" r="2"/><path class="scene-ink-line" d="m70 58 7 2 4-4"/>' +
    '<path class="scene-paper" d="m119 45 10-5 9 9-4 12-13 2-7-10Z"/><path class="scene-ink-line" d="m122 48 1 1m8 5 1 1m-10 3 1 1"/>' +
    '<path d="m99 26 3-4m5 48 3 2m38-30 2-2m-4 25 4 1"/><path class="scene-dark" d="m163 54 13-10 20 21-20 8Z"/><path d="m178 48 10-30m-14 39 12 12m-18-8 9 12"/>',
  memory: '<path d="M21 25h26m-8-6 8 6-8 6m117 0h26m-8-6 8 6-8 6" opacity=".5"/>' +
    '<path class="scene-dark" d="m42 70 8-16 23 6-5 15Z"/><path class="scene-accent" d="M52 55 44 40q-3-6 2-7 3-1 8 6V23q0-6 5-6t5 6v11-16q0-5 5-5t5 5v17-10q0-6 5-6t5 6v17-7q1-5 6-4 4 1 3 7l-2 17q-2 14-15 15-13 1-24-15Z"/>' +
    '<path class="scene-dark" d="m152 70-8-16-23 6 5 15Z"/><path class="scene-paper" d="M142 55 150 40q3-6-2-7-3-1-8 6V23q0-6-5-6t-5 6v11-16q0-5-5-5t-5 5v17-10q0-6-5-6t-5 6v17-7q-1-5-6-4-4 1-3 7l2 17q2 14 15 15 13 1 24-15Z"/>' +
    '<path class="scene-ink-line" d="M61 46q13-8 20 4m40-4q12-8 14 4"/><path d="m92 16 5-7 5 7m-9 57 4 4 4-4"/>',
  alibi: '<path class="scene-dark" d="m39 23 59-7 7 54-59 7Z"/><path class="scene-paper" d="m58 16 59 5-4 56-59-5Z"/>' +
    '<path class="scene-ink-line" d="m70 31 28 2m-28 9 21 2m-22 9 31 2m-32 9 19 2"/>' +
    '<path class="scene-accent" d="M129 22q-20 0-20 20t20 20q20 0 20-20t-20-20Z"/><circle class="scene-dark" cx="129" cy="42" r="14"/>' +
    '<path class="scene-paper" d="m143 55 8-3 18 19q2 3-1 6-3 3-6 0Z"/><path class="scene-ink-line" d="m117 42 22 2m-19 5 17 2"/>' +
    '<path d="m126 33 7 2m-92-2-6-3m143 17 6-3m-25-20 4-5" opacity=".55"/>',
  outing: '<path class="scene-dark" d="m29 69 11-20 12 20m104 0 13-24 12 24"/>' +
    '<path class="scene-paper" d="m58 24 30-7 29 10 29-7-4 45-27 9-28-10-31 6Z"/><path class="scene-ink-line" d="m88 17-1 47m30-37-2 47" opacity=".45"/>' +
    '<path class="scene-ink-line" d="m68 55 9-14 26 16 22-16" stroke-dasharray="3 5"/><path class="scene-accent" d="m123 24 14 4-11 8Z"/><path class="scene-ink-line" d="m123 24 2 19"/>' +
    '<circle class="scene-accent" cx="53" cy="65" r="15"/><circle class="scene-ink" cx="49" cy="61" r="2"/><circle class="scene-ink" cx="56" cy="61" r="2"/><circle class="scene-ink" cx="49" cy="68" r="2"/><circle class="scene-ink" cx="56" cy="68" r="2"/>' +
    '<path d="m156 24 5-8 5 8m-9-4h7m-138 8h8m-4-4v8" opacity=".5"/>',
  court: '<path class="scene-paper" d="m27 32 31-6 7 41-31 6Z"/><path class="scene-ink-line" d="m37 41 13-3m-12 11 15-3m-14 11 16-3"/>' +
    '<path d="M109 20v47m-22 5h44m-49-40h54m-43 1-13 23h27Zm31 0-13 23h27Z"/><path class="scene-accent" d="M80 56h27q-13 17-27 0m32 0h27q-13 17-27 0"/><circle class="scene-accent" cx="109" cy="21" r="5"/>' +
    '<path class="scene-dark" d="m147 67 27-8 4 11-27 8Z"/><path class="scene-accent" d="m146 45 8-6 14 19-8 6Z"/><path d="m156 49 19-14"/>' +
    '<path d="m63 16 5-4m80 9 6-3" opacity=".5"/>',
  market: '<path d="M26 20q70 18 151-4" opacity=".55"/><path class="scene-paper" d="m43 23-1 8m115-10 1 9"/>' +
    '<path class="scene-accent" d="M36 31h13l-2 13h-9Zm116-1h13l-2 13h-9Z"/>' +
    '<path class="scene-dark" d="M62 41h78v33H62Z"/><path class="scene-paper" d="m57 43 13-21h62l13 21Z"/><path class="scene-accent" d="m79 22-6 21H57l13-21Zm20 0v21H85l4-21Zm19 0 11 21h16l-13-21Z"/>' +
    '<path class="scene-paper" d="M62 61h78v13H62Z"/><path class="scene-accent" d="m78 49 7-5 7 6-2 9H79Z"/><path class="scene-paper" d="M107 48h15v11h-15Zm3-4h9v4h-9Z"/>' +
    '<path class="scene-dark" d="M153 59h25l-3 17h-19Z"/><path d="M159 60v-5q0-7 7-7t7 7v5"/><path class="scene-ink-line" d="M71 68h60" opacity=".3"/>'
};
const scene = id => '<span class="activity-scene" aria-hidden="true"><svg viewBox="0 0 200 88" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false"><ellipse class="scene-shadow" cx="100" cy="78" rx="83" ry="5"/>' + scenes[id] + '</svg></span>';
const cardCopy = {
  chase: { title:'Crumb Chase', time:'12 lessons', hook:'Learn the route. Outwit the broom.' },
  memory: { title:'Handshake', time:'Your pace', hook:'Copy a secret. Or reverse it.' },
  alibi: { title:'The Alibi', time:'No timer', hook:'Spot the lie. Find the proof.' },
  outing: { title:'Expeditions', time:'3 stops', hook:'Find parts. Build a better home.' },
  court: { title:'Shelf Court', time:'No timer', hook:'Follow the clues. Name a suspect.' },
  market: { title:'Night Market', time:'2–8 stalls', hook:'Find a pair. Send the shopping home.' }
};

function activityTime(id, life = {}) {
  // Saves retain the route seed and rules version, not the generated stalls.
  if(id==='market'&&life.market?.version===5)return [2,6,8][life.market.tier||0]+' stalls';
  if(id==='market'&&life.market?.version===4)return '8 stalls';
  if (id === 'market' && life.market && (life.market.version || 1) < 4) return '6 stalls';
  return cardCopy[id].time;
}

function activityDetail(activity, life = {}) {
  if (activity.id !== 'market' || !life.market || life.market.version >= 4) return activity.detail;
  if (life.market.version === 3) return 'This saved trip has six stalls. Buy pairs for three errands, then deliver them to free bag space and earn shopping money. A new trip uses eight stalls.';
  return 'This saved trip keeps its original six-stall rules. Buy matching objects for the household’s requests. Your final basket, spare buttons and charm determine your score. A new trip uses eight-stall delivery errands.';
}

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
  const purpose = document.createElement('div');
  purpose.className = 'escapade-game-purpose'; purpose.hidden = true;
  workspace.prepend(purpose);
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
    const adventure = escapadeView(state).active;
    purpose.hidden = !adventure || adventure.petId !== pet?.id;
    if (!purpose.hidden) purpose.innerHTML = '<b>' + esc(adventure.episode.title) + '</b> · ' + esc(adventure.playDone ? 'Our game is saved. The adventure is waiting on the shelf.' : adventure.approach.label + ' — finish a game together to advance our adventure.');
    passport.hidden = !pet;
    if (pet) {
      const progress = activityPassport(state);
      passport.innerHTML = '<span class="passport-count">' + progress.completed + '/' + progress.stamps.length + ' games tried</span>' +
        '<span class="passport-dots">' + progress.stamps.map(s => '<span class="' + (s.earned ? 'earned' : '') + '" title="' + esc(s.title) + '"><span aria-hidden="true">' + (s.earned ? '✓' : '○') + '</span><span class="sr-only">' + esc(s.title) + (s.earned ? ', completed' : ', not yet completed') + '</span></span>').join('') + '</span>';
    }
    cards.innerHTML = ACTIVITIES.map(a => {
      const copy = cardCopy[a.id], resume = pet ? continueLabel(a.id, state.life) : '';
      const key={memory:'handshake',outing:'expedition',alibi:'alibi',court:'court',market:'market'}[a.id];
      const learning=key?masteryText(['memory','alibi'].includes(a.id)?pet||{}:state,key).split('. ')[0]:'';
      const record = adventure?.petId === pet?.id && adventure.approach.activity === a.id && !adventure.playDone ? 'For our little adventure' : resume || shortRecord(a, state, pet);
      return '<button type="button" class="activity-card activity-' + a.id + (resume ? ' activity-continue' : '') + '" data-activity="' + a.id + '" aria-label="' + esc((resume ? 'Continue ' : 'Play ') + copy.title + '. ' + activityTime(a.id, state.life) + '. ' + activityRecord(a, state, pet)) + '" ' + (!pet ? 'disabled' : '') + '>' +
        scene(a.id) + '<span class="activity-top"><span class="activity-kind">' + esc(a.kind) + '</span><span>' + esc(activityTime(a.id, state.life)) + '</span></span>' +
        '<strong>' + esc(copy.title) + '</strong><span class="activity-hook">' + esc(copy.hook) + '</span>'+(learning?'<span class="activity-hook">'+esc(learning)+'</span>':'') +
        '<span class="activity-bottom"><span>' + esc(record) + '</span><b class="activity-action" aria-hidden="true">' + (resume ? 'Resume' : 'Play') + '</b></span></button>';
    }).join('');
    guideBody.innerHTML = ACTIVITIES.map(a => '<article><h3>' + esc(a.title) + '</h3><p class="playroom-guide-joke">' + esc(a.line) + '</p><p>' + esc(activityDetail(a, state.life)) + '</p><small>' + esc(activityRecord(a, state, pet)) + '</small></article>').join('');
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

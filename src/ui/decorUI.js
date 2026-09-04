// Decor veil: room/wall/wood/accent pickers plus the prop tray. Owns its own
// veil open/close lifecycle (mirrors art/studio.js's self-contained-widget
// pattern) rather than leaving that wiring to main.js.
import { ROOMS, WALLS, WOODS, ACCENTS } from '../content/decor.js';
import { PROPS, PROP_ART } from '../content/props.js';
import { totalBond } from '../engine/unlocks.js';
import { save, addNote, defaultDecor } from '../state.js';
import { toast } from './toast.js';
import { renderAll, escapeHtml } from './render.js';

// Ported verbatim from ~/Documents/shelf-life.html's optButton (~line 1339).
// Not part of the module's export contract — only buildDecor needs it.
function optButton(label, pressed, swatchColor, onClick, disabled) {
  const b = document.createElement('button');
  b.className = 'opt';
  b.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  b.innerHTML = (swatchColor ? '<span class="dot" style="background:' + swatchColor + '"></span>' : '') + escapeHtml(label);
  if (disabled) b.disabled = true;
  else b.addEventListener('click', onClick);
  return b;
}

export function applyDecor(state) {
  const d = state.decor || defaultDecor();
  const root = document.documentElement.style;
  const room = ROOMS[d.room] || ROOMS.aubergine;
  for (const k in room.vars) root.setProperty(k, room.vars[k]);
  const wood = WOODS[d.wood] || WOODS.rosewood;
  root.setProperty('--wood', wood.wood);
  root.setProperty('--wood-lip', wood.lip);
  root.setProperty('--pink', (ACCENTS[d.accent] || ACCENTS.bubblegum).c);
  document.body.className = 'wall-' + d.wall;
}

// Not exported — only the prop-tray click handler built inside buildDecor
// calls it, matching the original's internal-only placeProp.
function placeProp(state, kind) {
  const slot = state.slots.indexOf(null);
  if (slot === -1) { toast('No room on the shelf. Move something first.'); return; }
  const pr = { id: 'd' + (state.seq++) + '_' + Date.now().toString(36), kind: kind };
  state.props.push(pr);
  state.slots[slot] = pr.id;
  addNote(state, PROPS[kind].name + ' arrived on the shelf. They are pretending not to care.', 'the shelf', 'arrival');
  save();
  buildDecor(state);
  renderAll(state);
  toast(PROPS[kind].name + ' placed. Drag it where you want it.');
}

export function buildDecor(state) {
  const d = state.decor;

  const rooms = document.getElementById('roomOpts');
  rooms.innerHTML = '';
  Object.keys(ROOMS).forEach(k => rooms.appendChild(optButton(ROOMS[k].name, d.room === k, ROOMS[k].swatch, () => { d.room = k; applyDecor(state); save(); buildDecor(state); })));

  const walls = document.getElementById('wallOpts');
  walls.innerHTML = '';
  Object.keys(WALLS).forEach(k => walls.appendChild(optButton(WALLS[k], d.wall === k, null, () => { d.wall = k; applyDecor(state); save(); buildDecor(state); })));

  const woods = document.getElementById('woodOpts');
  woods.innerHTML = '';
  Object.keys(WOODS).forEach(k => woods.appendChild(optButton(WOODS[k].name, d.wood === k, WOODS[k].lip, () => { d.wood = k; applyDecor(state); save(); buildDecor(state); })));

  const acc = document.getElementById('accentOpts');
  acc.innerHTML = '';
  Object.keys(ACCENTS).forEach(k => acc.appendChild(optButton(ACCENTS[k].name, d.accent === k, ACCENTS[k].c, () => { d.accent = k; applyDecor(state); save(); buildDecor(state); })));

  const tray = document.getElementById('propTray');
  tray.innerHTML = '';
  const bond = totalBond(state);
  Object.keys(PROPS).forEach(kind => {
    const def = PROPS[kind];
    const locked = bond < def.at;
    const card = document.createElement('button');
    card.className = 'prop-card' + (locked ? ' locked' : '');
    const owned = state.props.filter(x => x.kind === kind).length;
    card.innerHTML = PROP_ART[kind] + '<b>' + escapeHtml(def.name) + '</b><small>' +
      (locked ? 'Needs bond ' + def.at : escapeHtml(def.desc) + (owned ? '<br>On the shelf: ' + owned : '')) + '</small>';
    if (locked) card.disabled = true;
    else card.addEventListener('click', () => placeProp(state, kind));
    tray.appendChild(card);
  });
}

export function initDecorUI(state) {
  const decorVeil = document.getElementById('decorVeil');
  const decorBtn = document.getElementById('decorBtn');
  const decorClose = document.getElementById('decorClose');

  function openIt() {
    buildDecor(state);
    decorVeil.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeIt() {
    decorVeil.classList.remove('open');
    document.body.style.overflow = '';
  }

  decorBtn.addEventListener('click', openIt);
  decorClose.addEventListener('click', closeIt);
  decorVeil.addEventListener('click', e => {
    if (e.target === decorVeil) closeIt();
  });
}

// Decor veil: room/wall/wood/accent pickers plus the prop tray. Owns its own
// veil open/close lifecycle (mirrors art/studio.js's self-contained-widget
// pattern) rather than leaving that wiring to main.js.
import { ROOMS, WALLS, WOODS, ACCENTS } from '../content/decor.js';
import { PROPS, PROP_ART } from '../content/props.js';
import { totalBond } from '../engine/unlocks.js';
import { save, addNote, defaultDecor } from '../state.js';
import { toast } from './toast.js';
import { renderAll, escapeHtml } from './render.js';
import { SHELF_SCENES } from '../content/shelf-theatre.js';

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
  // Swap only the wall class. Assigning className here used to wipe body.night
  // (and anything else on the body) on every decor change and at boot.
  [...document.body.classList].filter(c => c.startsWith('wall-')).forEach(c => document.body.classList.remove(c));
  document.body.classList.add('wall-' + (WALLS[d.wall] ? d.wall : 'none'));
}

// Shared by the furniture tray and repertoire quick placement.
export function placeProp(state, kind, { nearResident = false } = {}) {
  if (!Object.hasOwn(PROPS, kind) || totalBond(state) < PROPS[kind].at) return null;
  let slot = state.slots.indexOf(null);
  if (slot === -1) { toast('No room on the shelf. Put some furniture away to make a space.'); return; }
  if (nearResident) {
    const occupied = state.pets.map(p => state.slots.indexOf(p.id)).filter(i => i >= 0);
    const score = i => occupied.reduce((n,j) => n + (Math.floor(i/6)===Math.floor(j/6) && Math.abs(i-j)<=2 ? 3-Math.abs(i-j) : 0),0);
    state.slots.forEach((id,i)=>{if(!id&&score(i)>score(slot))slot=i;});
  }
  const pr = { id: 'd' + (state.seq++) + '_' + Date.now().toString(36), kind: kind };
  state.props.push(pr);
  state.slots[slot] = pr.id;
  addNote(state, PROPS[kind].name + ' arrived on the shelf. They are pretending not to care.', 'the shelf', 'arrival');
  save();
  buildDecor(state);
  renderAll(state);
  toast(PROPS[kind].name + ' placed. Tap it to invite a resident over.');
  return pr;
}

export function buildDecor(state) {
  const d = state.decor;

  const rooms = document.getElementById('roomOpts');
  rooms.innerHTML = '';
  // Every room is a dark room; what changes is the colour of the darkness and
  // of the one bulb in it, so the swatch shows both rather than a pale panel
  // the room never actually paints.
  Object.keys(ROOMS).forEach(k => rooms.appendChild(optButton(ROOMS[k].name, d.room === k,
    'linear-gradient(135deg,' + ROOMS[k].vars['--room-b'] + ' 0 55%,' + ROOMS[k].vars['--room-key'] + ' 55% 100%)',
    () => { d.room = k; applyDecor(state); save(); buildDecor(state); })));

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
  Object.keys(PROPS).sort((a,b)=>Number(bond<PROPS[a].at)-Number(bond<PROPS[b].at)||PROPS[a].at-PROPS[b].at).forEach(kind => {
    const def = PROPS[kind];
    const locked = bond < def.at;
    const card = document.createElement('button');
    card.className = 'prop-card' + (locked ? ' locked' : '');
    card.dataset.propKind = kind;
    const owned = state.props.filter(x => x.kind === kind).length;
    const scene = SHELF_SCENES.find(s=>s.propKind===kind);
    card.innerHTML = PROP_ART[kind] + '<b>' + escapeHtml(def.name) + '</b><small>' +
      (locked ? 'Needs trust ' + def.at : escapeHtml(def.desc) + (scene ? '<br>Play: '+escapeHtml(scene.title) : '') + (owned ? '<br>On the shelf: ' + owned : '')) + '</small>';
    if (locked) card.disabled = true;
    else card.addEventListener('click', () => placeProp(state, kind, { nearResident: true }));
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

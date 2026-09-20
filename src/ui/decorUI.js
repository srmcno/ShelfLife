// Decor veil: room/wall/wood/accent pickers plus the prop tray. Owns its own
// veil open/close lifecycle (mirrors art/studio.js's self-contained-widget
// pattern) rather than leaving that wiring to main.js.
import { ROOMS, WALLS, WOODS, ACCENTS } from '../content/decor.js';
import { PROPS, PROP_ART } from '../content/props.js';
import { totalBond } from '../engine/unlocks.js';
import { save, addNote, defaultDecor } from '../state.js';
import { toast } from './toast.js';
import { renderAll, escapeHtml } from './render.js';
import { renderPetSprite } from '../art/sprite.js';
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
  root.setProperty('--shelf-ink', d.wood === 'bone' ? '#211a16' : '#F2E9DC');
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

  const preview = document.getElementById('decorPreview');
  const describe = () => preview.setAttribute('aria-label', [ROOMS[d.room]?.name, WALLS[d.wall] + ' walls', WOODS[d.wood]?.name + ' shelves', ACCENTS[d.accent]?.name + ' accents'].join(', '));
  describe();
  const residents = document.getElementById('decorPreviewResidents');
  residents.replaceChildren(...state.pets.slice(0, 3).map(pet => renderPetSprite(pet)));
  if (!state.pets.length) {
    const empty = document.createElement('span'); empty.className = 'decor-preview-empty';
    empty.textContent = 'Room for someone unpleasant.'; residents.appendChild(empty);
  }
  const status = document.getElementById('decorSaveStatus');
  status.textContent = 'Changes save as you choose.';
  delete status.dataset.failed;
  const groups = [
    ['room', 'roomOpts', ROOMS, value => value.name, value => value.swatch],
    ['wall', 'wallOpts', WALLS, value => value, () => null],
    ['wood', 'woodOpts', WOODS, value => value.name, value => value.lip],
    ['accent', 'accentOpts', ACCENTS, value => value.name, value => value.c]
  ];
  for (const [field, id, options, label, swatch] of groups) {
    const group = document.getElementById(id); group.replaceChildren();
    for (const [key, value] of Object.entries(options)) {
      const button = optButton(label(value), d[field] === key, swatch(value), () => {
        d[field] = key; applyDecor(state);
        const saved = save();
        for (const option of group.children) option.setAttribute('aria-pressed', String(option.dataset.decorValue === key));
        describe();
        status.textContent = saved ? 'Saved.' : 'Not saved. Free browser storage, then choose again.';
        status.toggleAttribute('data-failed', !saved);
        // Keep the actual button in place: rebuilding this dialog discarded
        // keyboard focus after every choice and made Tab restart at Close.
      });
      button.dataset.decorValue = key;
      group.appendChild(button);
    }
  }

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
      (locked ? 'Needs trust ' + def.at : escapeHtml(def.desc) + (scene ? '<br>Scene: '+escapeHtml(scene.title) : '') + (owned ? '<br>On the shelf: ' + owned : '')) + '</small>' + (locked ? '' : '<span class="prop-add-label">+ Add to shelf</span>');
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

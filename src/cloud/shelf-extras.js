// What a shelf snapshot carries beyond its residents, so a friend's visit can
// show the room as it really is: the paint, paper, wood and accent, where each
// resident sits, the title the owner wears and the best of their cabinet.
// Written by shelfSnapshot() and read back by readShelf() in social.js.
// Every field is optional: an older snapshot simply has none of them.
import { ROOMS, WALLS, WOODS, ACCENTS } from '../content/decor.js';
import { CURIO_BY_ID } from '../engine/mayhem.js';
import { RARITIES } from '../content/mayhem.js';
import { activeTitle } from '../engine/collections.js';
import { titleText } from '../content/collections.js';

const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const own = (lib, key) => typeof key === 'string' && Object.hasOwn(lib, key);
const PET_ID = /^[a-zA-Z0-9_-]{1,100}$/;
const SLOTS = 36, HIGHLIGHTS = 4;
const RANK = Object.fromEntries(RARITIES.map((r, i) => [r.id, i]));
const clip = (value, max) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '';

export function shelfExtras(state) {
  const out = {};
  const d = record(state?.decor) ? state.decor : {};
  const decor = {};
  if (own(ROOMS, d.room)) decor.room = d.room;
  if (own(WALLS, d.wall)) decor.wall = d.wall;
  if (own(WOODS, d.wood)) decor.wood = d.wood;
  if (own(ACCENTS, d.accent)) decor.accent = d.accent;
  if (Object.keys(decor).length) out.decor = decor;
  const slots = {};
  (Array.isArray(state?.slots) ? state.slots : []).slice(0, SLOTS).forEach((id, i) => {
    if (typeof id === 'string' && (state.pets || []).some(p => p?.id === id)) slots[id] = i;
  });
  out.slots = slots;
  try { const title = titleText(activeTitle(state)); if (title) out.title = clip(title, 40); } catch { /* no title worn */ }
  const curios = record(state?.mayhem?.curios) ? state.mayhem.curios : {};
  out.highlights = Object.keys(curios).filter(id => curios[id] > 0 && CURIO_BY_ID[id])
    .sort((a, b) => (RANK[CURIO_BY_ID[b].rarity] ?? 0) - (RANK[CURIO_BY_ID[a].rarity] ?? 0) || a.localeCompare(b)).slice(0, HIGHLIGHTS);
  return out;
}

export function readShelfExtras(raw) {
  const r = record(raw) ? raw : {};
  const out = { decor: null, slots: {}, title: clip(r.title, 40), highlights: [] };
  if (record(r.decor)) {
    const d = r.decor;
    out.decor = { room: own(ROOMS, d.room) ? d.room : 'aubergine', wall: own(WALLS, d.wall) ? d.wall : 'none',
      wood: own(WOODS, d.wood) ? d.wood : 'rosewood', accent: own(ACCENTS, d.accent) ? d.accent : 'bubblegum' };
  }
  if (record(r.slots)) {
    const taken = new Set();
    for (const [id, i] of Object.entries(r.slots).slice(0, SLOTS)) {
      if (!PET_ID.test(id) || !Number.isInteger(i) || i < 0 || i >= SLOTS || taken.has(i)) continue;
      taken.add(i); out.slots[id] = i;
    }
  }
  if (Array.isArray(r.highlights)) out.highlights = [...new Set(r.highlights.filter(id => typeof id === 'string' && Object.hasOwn(CURIO_BY_ID, id)))].slice(0, HIGHLIGHTS);
  return out;
}

// The room's colours, for drawing a friend's shelf inside the sheet.
export function roomLook(decor) {
  const d = decor || {};
  const room = ROOMS[d.room] || ROOMS.aubergine, wood = WOODS[d.wood] || WOODS.rosewood;
  return { a: room.vars['--room-a'], b: room.vars['--room-b'], wood: wood.wood, lip: wood.lip, wall: own(WALLS, d.wall) ? d.wall : 'none',
    ink: room.vars['--bone'], accent: (ACCENTS[d.accent] || ACCENTS.bubblegum).c };
}

/* Player-selected room paint, wallpaper, shelf wood and interface accent.
   Keep these materials independent: changing the light must never replace
   the player's chosen shelf finish or hide their wallpaper. */
export const ROOMS = {
  aubergine: { name: 'Aubergine', swatch: '#33203D', vars: { '--room-a': '#33203D', '--room-b': '#1A1220', '--panel-a': '#2C1D35', '--panel-b': '#241830', '--line': '#4A3557', '--rule': '#3A2A47', '--surface': '#241833', '--surface-hi': '#372748', '--field': '#1C1327', '--bone': '#F2E9DC', '--bone-dim': '#C9BCAE', '--wall-ink': 'rgba(242,233,220,.14)', '--room-key': '#F2C083' } },
  mortuary: { name: 'Mortuary Mint', swatch: '#8FB5A4', vars: { '--room-a': '#A8C9B9', '--room-b': '#7FA492', '--panel-a': '#E4EDE4', '--panel-b': '#D2E0D4', '--line': '#8CA697', '--rule': '#A9BFB0', '--surface': '#DCE7DD', '--surface-hi': '#CBDACD', '--field': '#EDF3ED', '--bone': '#23302A', '--bone-dim': '#4E6357', '--wall-ink': 'rgba(30,64,46,.16)', '--room-key': '#C8E8D4' } },
  nursery: { name: 'Haunted Nursery', swatch: '#D9A7B0', vars: { '--room-a': '#E7BFC6', '--room-b': '#C08D98', '--panel-a': '#F3E2E4', '--panel-b': '#E5CED3', '--line': '#B98F98', '--rule': '#CFA9B1', '--surface': '#EEDCDF', '--surface-hi': '#E2C8CD', '--field': '#F7ECEE', '--bone': '#33202A', '--bone-dim': '#61454F', '--wall-ink': 'rgba(94,40,58,.16)', '--room-key': '#F4B9C4' } },
  basement: { name: 'Blacklight Basement', swatch: '#1B0B2E', vars: { '--room-a': '#2E0F52', '--room-b': '#0C0616', '--panel-a': '#1D0C33', '--panel-b': '#130823', '--line': '#4A208A', '--rule': '#33146B', '--surface': '#1C0B34', '--surface-hi': '#2C1252', '--field': '#150826', '--bone': '#E8DBFF', '--bone-dim': '#A98FD4', '--wall-ink': 'rgba(180,120,255,.16)', '--room-key': '#B478FF' } },
  parlor: { name: 'Bone Parlor', swatch: '#E8DFCE', vars: { '--room-a': '#F4EDDF', '--room-b': '#DCD2BE', '--panel-a': '#EFE7D6', '--panel-b': '#E2D8C4', '--line': '#BCAE95', '--rule': '#CFC3AB', '--surface': '#E7DECB', '--surface-hi': '#DBD0B9', '--field': '#F6F1E5', '--bone': '#2B2318', '--bone-dim': '#5D5241', '--wall-ink': 'rgba(89,65,34,.16)', '--room-key': '#FFD9A0' } },
  midnight: { name: 'Midnight', swatch: '#0E1526', vars: { '--room-a': '#17233F', '--room-b': '#080C16', '--panel-a': '#131C31', '--panel-b': '#0C1322', '--line': '#2C3D63', '--rule': '#22314F', '--surface': '#141E36', '--surface-hi': '#1F2C4B', '--field': '#0F1728', '--bone': '#DDE6F5', '--bone-dim': '#93A3C2', '--wall-ink': 'rgba(190,210,255,.12)', '--room-key': '#9EC0FF' } }
};

export const WALLS = { none: 'Bare', stripes: 'Stripes', dots: 'Dots', grid: 'Grid', web: 'Cobwebs', diamond: 'Diamonds', damask: 'Funeral damask' };

export const WOODS = {
  rosewood: { name: 'Rosewood', wood: '#5C3A47', lip: '#7A4C5B' },
  charcoal: { name: 'Charcoal', wood: '#2F2E33', lip: '#474650' },
  bone: { name: 'Bone', wood: '#CFC3AC', lip: '#E6DCC8' },
  bubblegum: { name: 'Bubblegum', wood: '#C4708F', lip: '#E28FAC' },
  moss: { name: 'Moss', wood: '#44573F', lip: '#5E7455' },
  oxblood: { name: 'Oxblood', wood: '#5A1E23', lip: '#7A2C33' },
  gilt: { name: 'Gilt', wood: '#8A6B22', lip: '#C4972F' }
};

export const ACCENTS = {
  bubblegum: { name: 'Bubblegum', c: '#FF8FB8' },
  mint: { name: 'Mint', c: '#7FD8C0' },
  amber: { name: 'Amber', c: '#F2B441' },
  blood: { name: 'Blood', c: '#C4414F' },
  violet: { name: 'Violet', c: '#B183F0' },
  acid: { name: 'Acid', c: '#B8E634' }
};

/* ================= WHAT IS FREE AND WHAT IS NOT =================
   Everything above this line has always been free, and every household keeps
   it: FREE_DECOR is the list a save falls back to when it has never recorded
   what it owns. What follows is new, and is earned or bought: Almanac room sets
   come from the track (or Back Issues), the rest are sold by the Collector’s
   Exchange (content/collections.js). */
import { CHAPTERS } from './almanac.js';
import { EXCHANGE_DECOR } from './collections.js';

export const FREE_DECOR = { room: Object.keys(ROOMS), wall: Object.keys(WALLS), wood: Object.keys(WOODS), accent: Object.keys(ACCENTS) };
export const DECOR_KINDS = ['room', 'wall', 'wood', 'accent'];
export const DECOR_CATALOG = { room: ROOMS, wall: WALLS, wood: WOODS, accent: ACCENTS };

const channels = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (x, y, t) => '#' + channels(x).map((v, i) => Math.round(v + (channels(y)[i] - v) * t).toString(16).padStart(2, '0')).join('');
// A dark room from three colours, in the same shape as the hand-made ones above.
export function makeRoom({ name, a, b, key }) {
  return { name, swatch: a, vars: {
    '--room-a': a, '--room-b': b, '--panel-a': mix(a, b, 0.28), '--panel-b': mix(a, b, 0.52),
    '--line': mix(a, '#ffffff', 0.17), '--rule': mix(a, '#ffffff', 0.09), '--surface': mix(a, b, 0.5),
    '--surface-hi': mix(a, '#ffffff', 0.1), '--field': mix(b, a, 0.3), '--bone': '#F2E9DC', '--bone-dim': '#C9BCAE',
    '--wall-ink': 'rgba(242,233,220,.14)', '--room-key': key } };
}

// New wallpapers. The patterns themselves live in css/almanac.css as body.wall-<id>.
const NEW_WALLS = {
  scallop: 'Scallops', waves: 'Waves', stars: 'Stars', plaid: 'Plaid', quilt: 'Quilting', rain: 'Rain', argyle: 'Argyle',
  chevron: 'Chevrons', brick: 'Brick', ticking: 'Ticking', morse: 'Morse', tally: 'Tally Marks', lattice: 'Lattice, Locked', ripple: 'Seepage'
};
Object.assign(WALLS, NEW_WALLS);

// 'room:pumpkin-hollow' -> where it comes from. Exchange items carry a price.
export const NEW_DECOR = {};
const add = (kind, id, info) => { NEW_DECOR[kind + ':' + id] = { kind, id, ...info }; };
for (const chapter of CHAPTERS) {
  const { room, wood, wall } = chapter.decor;
  ROOMS[room.id] = makeRoom(room);
  WOODS[wood.id] = { name: wood.name, wood: wood.wood, lip: wood.lip };
  add('room', room.id, { name: room.name, source: 'chapter', chapter: chapter.id });
  add('wood', wood.id, { name: wood.name, source: 'chapter', chapter: chapter.id });
  if (!FREE_DECOR.wall.includes(wall)) add('wall', wall, { name: WALLS[wall], source: 'chapter', chapter: chapter.id });
}
for (const item of EXCHANGE_DECOR.room) { ROOMS[item.id] = makeRoom(item); add('room', item.id, { name: item.name, source: 'exchange', cost: item.cost || 0, tokens: item.tokens || 0, line: item.line }); }
for (const item of EXCHANGE_DECOR.wood) { WOODS[item.id] = { name: item.name, wood: item.wood, lip: item.lip }; add('wood', item.id, { name: item.name, source: 'exchange', cost: item.cost || 0, tokens: item.tokens || 0, line: item.line }); }
for (const item of EXCHANGE_DECOR.wall) { WALLS[item.id] = item.name; add('wall', item.id, { name: item.name, source: 'exchange', cost: item.cost || 0, tokens: item.tokens || 0, line: item.line }); }
for (const item of EXCHANGE_DECOR.accent) { ACCENTS[item.id] = { name: item.name, c: item.c }; add('accent', item.id, { name: item.name, source: 'exchange', cost: item.cost || 0, tokens: item.tokens || 0, line: item.line }); }
for (const id of Object.keys(NEW_WALLS)) if (!NEW_DECOR['wall:' + id]) throw new Error('wall ' + id + ' has no source');

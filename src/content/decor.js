/* ================= DECOR CATALOGS =================
   Ported verbatim from the original prototype (~/Documents/shelf-life.html lines 489-497).

   --room-key is the room's BULB. The art direction paints every room as the same
   dark room, so varying the hue of the darkness made all six look alike; what
   varies instead is the colour of the one light in it. Every pool, rim, plank
   lip and cast shadow in css/style.css is mixed from this single token, so
   Bone Parlor reads as gaslight and Mortuary Mint as a failing strip light
   without either of them owning a second palette. */
export const ROOMS = {
  aubergine: { name: 'Aubergine', swatch: '#33203D', vars: { '--room-a': '#33203D', '--room-b': '#1A1220', '--panel-a': '#2C1D35', '--panel-b': '#241830', '--line': '#4A3557', '--rule': '#3A2A47', '--surface': '#241833', '--surface-hi': '#372748', '--field': '#1C1327', '--bone': '#F2E9DC', '--bone-dim': '#C9BCAE', '--wall-ink': 'rgba(242,233,220,.14)', '--room-key': '#F2C083' } },
  mortuary: { name: 'Mortuary Mint', swatch: '#8FB5A4', vars: { '--room-a': '#A8C9B9', '--room-b': '#7FA492', '--panel-a': '#E4EDE4', '--panel-b': '#D2E0D4', '--line': '#8CA697', '--rule': '#A9BFB0', '--surface': '#DCE7DD', '--surface-hi': '#CBDACD', '--field': '#EDF3ED', '--bone': '#23302A', '--bone-dim': '#4E6357', '--wall-ink': 'rgba(30,50,40,.12)', '--room-key': '#C8E8D4' } },
  nursery: { name: 'Haunted Nursery', swatch: '#D9A7B0', vars: { '--room-a': '#E7BFC6', '--room-b': '#C08D98', '--panel-a': '#F3E2E4', '--panel-b': '#E5CED3', '--line': '#B98F98', '--rule': '#CFA9B1', '--surface': '#EEDCDF', '--surface-hi': '#E2C8CD', '--field': '#F7ECEE', '--bone': '#33202A', '--bone-dim': '#61454F', '--wall-ink': 'rgba(60,30,40,.12)', '--room-key': '#F4B9C4' } },
  basement: { name: 'Blacklight Basement', swatch: '#1B0B2E', vars: { '--room-a': '#2E0F52', '--room-b': '#0C0616', '--panel-a': '#1D0C33', '--panel-b': '#130823', '--line': '#4A208A', '--rule': '#33146B', '--surface': '#1C0B34', '--surface-hi': '#2C1252', '--field': '#150826', '--bone': '#E8DBFF', '--bone-dim': '#A98FD4', '--wall-ink': 'rgba(180,120,255,.16)', '--room-key': '#B478FF' } },
  parlor: { name: 'Bone Parlor', swatch: '#E8DFCE', vars: { '--room-a': '#F4EDDF', '--room-b': '#DCD2BE', '--panel-a': '#EFE7D6', '--panel-b': '#E2D8C4', '--line': '#BCAE95', '--rule': '#CFC3AB', '--surface': '#E7DECB', '--surface-hi': '#DBD0B9', '--field': '#F6F1E5', '--bone': '#2B2318', '--bone-dim': '#5D5241', '--wall-ink': 'rgba(60,48,30,.10)', '--room-key': '#FFD9A0' } },
  midnight: { name: 'Midnight', swatch: '#0E1526', vars: { '--room-a': '#17233F', '--room-b': '#080C16', '--panel-a': '#131C31', '--panel-b': '#0C1322', '--line': '#2C3D63', '--rule': '#22314F', '--surface': '#141E36', '--surface-hi': '#1F2C4B', '--field': '#0F1728', '--bone': '#DDE6F5', '--bone-dim': '#93A3C2', '--wall-ink': 'rgba(190,210,255,.12)', '--room-key': '#9EC0FF' } }
};

export const WALLS = { none: 'Bare', stripes: 'Stripes', dots: 'Dots', grid: 'Grid', web: 'Cobwebs', diamond: 'Diamonds' };

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

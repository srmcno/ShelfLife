/* The courtroom's dressing: what the bench career unlocks. Everything is drawn
   here as plain SVG strings or is a class that css/court.css restyles, so there
   are no image files. engine/court-career.js says what is worn at a rank
   (dressFor); the Court UI turns that into stage classes and the pieces below.

     gavel       .sc-gavel-brass / .sc-gavel-ebony recolour the judge's own gavel
     wig         .sc-wig-gilt recolours the wig; laurel adds a wreath that
                 rides on the wig, and a spotlight
     plate       a brass nameplate on the bench front
     bench       a drape, then deep red velvet with two candles
     banner      a crest hung behind the bench
     audience    two regulars take seats in the gallery */

const O = 'stroke="#1a0a11" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"';
const GOLD = '#e2b04a', GOLD_DEEP = '#a8791f', CRIMSON = '#8a1a2c', CRIMSON_DEEP = '#5e1020';
const svg = (cls, box, body) => '<svg class="cc-dress ' + cls + '" viewBox="' + box + '" aria-hidden="true" focusable="false">' + body + '</svg>';

// Scales of justice on a crimson banner.
const crest = '<path d="M30 22v34" fill="none" stroke="' + GOLD + '" stroke-width="2.4" stroke-linecap="round"/>' +
  '<path d="M16 30h28" fill="none" stroke="' + GOLD + '" stroke-width="2.4" stroke-linecap="round"/>' +
  '<path d="M16 30l-5 12h10zM44 30l-5 12h10z" fill="' + GOLD + '" stroke="' + GOLD_DEEP + '" stroke-width="1.2" stroke-linejoin="round"/>' +
  '<path d="M22 56h16" fill="none" stroke="' + GOLD + '" stroke-width="2.6" stroke-linecap="round"/><circle cx="30" cy="20" r="2.4" fill="' + GOLD + '"/>';
const BANNER = svg('banner', '0 0 60 100',
  '<rect x="3" y="2" width="54" height="6" rx="3" fill="' + GOLD + '" ' + O + '/><circle cx="3" cy="5" r="3.2" fill="' + GOLD + '" ' + O + '/><circle cx="57" cy="5" r="3.2" fill="' + GOLD + '" ' + O + '/>' +
  '<path d="M8 8h44v74l-22 12-22-12z" fill="' + CRIMSON + '" ' + O + '/>' +
  '<path d="M12 12h36v68l-18 10-18-10z" fill="none" stroke="' + GOLD + '" stroke-width="1.6" stroke-linejoin="round"/>' +
  '<path d="M30 8v8" stroke="' + CRIMSON_DEEP + '" stroke-width="1.4"/>' + crest +
  '<path d="M16 84l1.5 6M22 88l1 6M30 91v6M38 88l-1 6M44 84l-1.5 6" fill="none" stroke="' + GOLD + '" stroke-width="1.6" stroke-linecap="round"/>');

const PLATE = svg('plate', '0 0 40 12',
  '<rect x="1.5" y="1.5" width="37" height="9" rx="2" fill="' + GOLD + '" ' + O + '/>' +
  '<path d="M8 4.8h24M11 7.6h18" fill="none" stroke="' + GOLD_DEEP + '" stroke-width="1.5" stroke-linecap="round"/>' +
  '<circle cx="4.6" cy="6" r=".9" fill="' + GOLD_DEEP + '"/><circle cx="35.4" cy="6" r=".9" fill="' + GOLD_DEEP + '"/>');

// A velvet drape over the bench front: swags, gold braid and a fringe of tassels.
const tassels = Array.from({ length: 13 }, (_, i) => 'M' + (4 + i * 7.7).toFixed(1) + ' 31v6').join('');
const DRAPE = svg('drape', '0 0 100 40',
  '<path d="M1 2h98v26q-12 7-24 0q-12 7-25 0q-12 7-25 0q-12 7-24 0z" fill="' + CRIMSON + '" ' + O + '/>' +
  '<path d="M3 8q23 7 47 0q24 7 47 0" fill="none" stroke="' + CRIMSON_DEEP + '" stroke-width="2.2"/>' +
  '<path d="M1 3h98" fill="none" stroke="' + GOLD + '" stroke-width="3"/>' +
  '<path d="' + tassels + '" fill="none" stroke="' + GOLD + '" stroke-width="1.8" stroke-linecap="round"/>');
const VELVET = svg('velvet', '0 0 100 40',
  '<path d="M1 2h98v32H1z" fill="#6e0f22" ' + O + '/>' +
  '<path d="M10 4v30M24 4v30M38 4v30M52 4v30M66 4v30M80 4v30M92 4v30" fill="none" stroke="#8a1a2c" stroke-width="3" opacity=".8"/>' +
  '<path d="M1 3h98" fill="none" stroke="' + GOLD + '" stroke-width="3"/><path d="M1 32h98" fill="none" stroke="' + GOLD + '" stroke-width="2.4"/>');
const CANDLE = svg('candle', '0 0 14 40',
  '<path class="sc-flame" d="M7 2c3 4 4 6 4 8a4 4 0 0 1-8 0c0-2 1-4 4-8z" fill="#ffd36b" ' + O + ' stroke-width="1.2"/>' +
  '<rect x="4" y="14" width="6" height="16" rx="1.5" fill="#f3ede2" ' + O + ' stroke-width="1.4"/>' +
  '<path d="M2 30h10l-1.5 4H3.5zM5 34h4v4H5z" fill="' + GOLD + '" ' + O + ' stroke-width="1.4"/><rect x="2" y="37" width="10" height="3" rx="1" fill="' + GOLD + '" ' + O + ' stroke-width="1.4"/>');

// Two regulars for the gallery. Only paths take the stylesheet's silhouette
// fill, so the hat, bonnet and sandwich carry their own classes and colours.
const GHOST = 'M6 46c-1-16 0-40 14-40s15 24 14 40l-4-4-4 4-3-4-3 4-3-4-4 4z';
const REGULAR_TOPHAT = svg('regular', '0 0 40 48',
  '<path d="' + GHOST + '"/><path class="hat" d="M12 14h16l-1.6-12H13.6z"/><path class="brim" d="M7 15h26"/><path class="band" d="M12.6 10h14.8"/><circle class="monocle" cx="25" cy="22" r="3.4"/>');
const REGULAR_BONNET = svg('regular', '0 0 40 48',
  '<path d="' + GHOST + '"/><path class="hat" d="M8 20c0-10 5-15 12-15s12 5 12 15c-4-3-8-4-12-4s-8 1-12 4z"/><path class="band" d="M10 18q10-5 20 0"/>' +
  '<rect class="sandwich" x="24" y="31" width="11" height="6" rx="1.5"/><path class="lettuce" d="M24.6 34h9.8"/>');
export const GALLERY_REGULARS = [REGULAR_TOPHAT, REGULAR_BONNET];

// A wreath for the wig, as a fragment to drop inside the wig's own group so it
// rides on it. Leaves are laid along two arcs over the crown (the wig is drawn
// 120 wide); the berries are gold.
function wreath() {
  const leaves = [];
  const arc = (side) => {
    for (let i = 0; i <= 8; i++) {
      const t = i / 8, x = 60 + side * (31 * Math.sin(t * 1.35)), y = 44 - 36 * Math.sin(t * 1.35) * (0.4 + 0.6 * t) - 2 * t;
      const turn = side * (62 - 70 * t);
      leaves.push('<ellipse cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" rx="5.6" ry="2.5" transform="rotate(' + turn.toFixed(0) + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ')" fill="#5fae6a" ' + O.replace('stroke-width="2"', 'stroke-width="1.2"') + '/>');
      if (i % 2 === 1) leaves.push('<circle cx="' + (x + side * 1.6).toFixed(1) + '" cy="' + (y + 2.4).toFixed(1) + '" r="1.5" fill="' + GOLD + '"/>');
    }
  };
  arc(-1); arc(1);
  return '<g class="sc-laurel">' + leaves.join('') + '</g>';
}
export const LAUREL = wreath();

const SPOT = '<span class="sc-spot" aria-hidden="true"></span>';

// What to add to the stage for a dress: stage classes, then the pieces.
export function dressClasses(dress) {
  return ['gavel-' + dress.gavel, 'wig-' + dress.wig, dress.bench && 'bench-' + dress.bench, dress.banner && 'has-banner', dress.plate && 'has-plate', dress.audience && 'has-regulars', dress.spotlight && 'has-spot']
    .filter(Boolean).map(c => 'sc-' + c).join(' ');
}
export function benchDressing(dress) {
  return (dress.bench === 'drape' ? '<span class="sc-bench-dress">' + DRAPE + '</span>' : dress.bench === 'velvet' ? '<span class="sc-bench-dress">' + VELVET + '</span>' : '') +
    (dress.plate ? '<span class="sc-bench-plate">' + PLATE + '</span>' : '');
}
export function stageDressing(dress) {
  return (dress.banner ? '<span class="sc-banner" aria-hidden="true">' + BANNER + '</span>' : '') +
    (dress.bench === 'velvet' ? '<span class="sc-candle l" aria-hidden="true">' + CANDLE + '</span><span class="sc-candle r" aria-hidden="true">' + CANDLE + '</span>' : '') +
    (dress.spotlight ? SPOT : '');
}
export const DRESS_ART = { banner: BANNER, plate: PLATE, drape: DRAPE, velvet: VELVET, candle: CANDLE, regularTopHat: REGULAR_TOPHAT, regularBonnet: REGULAR_BONNET };

import { glyph as baseGlyph, GLYPH_NAMES } from './mayhem-glyphs.js';

/* Art for the arcade. Everything is drawn here as SVG strings so the games
   stay offline and dependency free.

   Colour comes from CSS custom properties set on the playfield from the chosen
   arena (content/arcade.js ARCADE_THEMES): --ar-sky-a, --ar-sky-b, --ar-ground,
   --ar-glow, --ar-fog and --ar-star. Switching arena changes the variables
   and nothing else, so one set of scenes covers every arena.

   The scenes are layers. Each layer is its own SVG so the stylesheet can drift
   or sway one layer without repainting the others, and none of them use
   filters: every effect is a gradient, an opacity or a transform. */

const S = 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';
const F = 'fill="currentColor" fill-opacity=".16"';

/* Line glyphs drawn for the arcade, in the same 48 unit style as the curios.
   They replace the stand-ins the games used before (soap was a sun, the trap
   was a nail, the coffin was a flat hexagon). */
const GLYPHS = {
  casket: `<path ${S} ${F} d="M17 4h14l9 12-6 28H14L8 16z"/><path ${S} d="M20 11h8l5 7-3 20H18l-3-20z"/><path ${S} d="M24 17v14M19 22h10"/><circle cx="10.5" cy="17" r="1.3" fill="currentColor"/><circle cx="37.5" cy="17" r="1.3" fill="currentColor"/>`,
  soap: `<rect ${S} ${F} x="6" y="19" width="30" height="18" rx="8" transform="rotate(-12 21 28)"/><path ${S} d="M13 27c3-3 7-4 11-4"/><circle ${S} cx="36" cy="14" r="4"/><circle ${S} cx="30" cy="8" r="2.4"/><circle ${S} cx="41" cy="22" r="2.2"/><path ${S} d="M8 41c4 2 8 2 12 0s8-2 12 0"/>`,
  trap: `<rect ${S} ${F} x="5" y="28" width="36" height="13" rx="2.5"/><path ${S} d="M34 28C34 10 13 9 11 26"/><path ${S} d="M37 29c4-5 4-9 0-13"/><path ${S} d="M11 26v2M16 36h14"/><path ${S} ${F} d="M7 39l9-1.5L13.5 33z"/>`,
  glove: `<path ${S} ${F} d="M13 43V33C9 30 8 25 9 20c1-3 5-2 6 1l1 4V9a3 3 0 0 1 6 0v11-13a3 3 0 0 1 6 0v13-11a3 3 0 0 1 6 0v13l1-4c1-2 5-2 5 1 0 8-2 14-5 19v5z"/><path ${S} stroke-dasharray="2.4 3" d="M16 37h16"/><path ${S} d="M18 43v-5M30 43v-5"/>`,
  goldtooth: `<path ${S} ${F} d="M12 12c3-4 8-3 11-1 3-2 8-3 11 1 3 5 1 11-1 15-1 4-1 14-5 14-3 0-2-10-5-10s-2 10-5 10c-4 0-4-10-5-14-2-4-4-10-1-15z"/><path ${S} d="M38 6v8M34 10h8M10 40l3 3M14 37l-4 1"/>`,
  cross: `<path ${S} ${F} d="M20 5h8v13h13v8H28v18h-8V26H7v-8h13z"/>`
};
export const ARCADE_GLYPH_NAMES = Object.keys(GLYPHS);
export function allGlyphNames() { return [...GLYPH_NAMES, ...ARCADE_GLYPH_NAMES]; }
// A glyph from the arcade set, falling back to the shared curio glyphs.
export function arcadeGlyph(name, className = '') {
  const body = GLYPHS[name];
  if (!body) return baseGlyph(name, className);
  return '<svg class="mh-glyph' + (className ? ' ' + className : '') + '" viewBox="0 0 48 48" aria-hidden="true" focusable="false">' + body + '</svg>';
}

const layer = (cls, inner, ratio = 'xMidYMax slice') =>
  '<svg class="ar-layer ' + cls + '" viewBox="0 0 100 115" preserveAspectRatio="' + ratio + '" aria-hidden="true" focusable="false">' + inner + '</svg>';
const stop = (at, v, o = 1) => '<stop offset="' + at + '" style="stop-color:var(' + v + ');stop-opacity:' + o + '"/>';
const sky = (id, a = '--ar-sky-a', b = '--ar-sky-b') => '<linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' + stop(0, a) + stop(1, b) + '</linearGradient>';
// A cheap, repeatable scatter of dots: the same every time, so scenes do not
// shimmer when they are rebuilt.
function scatter(n, seed, w, h, size, cls = 'dot') {
  let a = seed >>> 0, out = '';
  const rnd = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  for (let i = 0; i < n; i++) out += '<circle class="' + cls + '" cx="' + (rnd() * w).toFixed(1) + '" cy="' + (rnd() * h).toFixed(1) + '" r="' + (size * (0.5 + rnd())).toFixed(2) + '"/>';
  return out;
}

/* ---------- Feeding Frenzy: the larder ---------- */
function frenzyScene() {
  const jars = [[8, 0], [20, 1], [31, 0], [66, 1], [78, 0], [90, 1]].map(([x, k]) =>
    '<g class="a-jar"><rect x="' + (x - 4) + '" y="' + (31 - 8 - k * 2) + '" width="8" height="' + (8 + k * 2) + '" rx="2"/><rect class="a-lid" x="' + (x - 3) + '" y="' + (31 - 10 - k * 2) + '" width="6" height="2.4" rx="1"/></g>').join('');
  const jars2 = [[14, 0], [26, 1], [72, 1], [85, 0]].map(([x, k]) =>
    '<g class="a-jar"><rect x="' + (x - 4.5) + '" y="' + (52 - 9 - k * 2) + '" width="9" height="' + (9 + k * 2) + '" rx="2.4"/><rect class="a-lid" x="' + (x - 3.5) + '" y="' + (52 - 11 - k * 2) + '" width="7" height="2.4" rx="1"/></g>').join('');
  const back = '<defs>' + sky('af-wall') + '<pattern id="af-brick" width="14" height="7" patternUnits="userSpaceOnUse"><path d="M0 0h14M0 3.5h14M3.5 0v3.5M10.5 3.5v3.5" class="a-mortar"/></pattern></defs>' +
    '<rect width="100" height="115" fill="url(#af-wall)"/><rect width="100" height="115" fill="url(#af-brick)" opacity=".5"/>' +
    '<g class="a-window" transform="translate(16 0)"><path d="M40 52V28a10 10 0 0 1 20 0v24z" class="a-glass"/><circle cx="53" cy="24" r="4.2" class="a-moon"/><path d="M50 18v34M40 34h20M45 20v32M55 20v32" class="a-bars"/><path d="M38 52h24v3H38z" class="a-sill"/></g>' +
    '<rect x="2" y="31" width="30" height="2.4" class="a-plank"/><rect x="62" y="31" width="36" height="2.4" class="a-plank"/>' +
    '<rect x="6" y="52" width="26" height="2.4" class="a-plank"/><rect x="66" y="52" width="30" height="2.4" class="a-plank"/>' + jars + jars2;
  const mid = '<rect width="100" height="7" class="a-beam"/><rect x="0" y="7" width="100" height="1.4" class="a-beam-edge"/>' +
    '<g class="a-sway s1"><path d="M10 8v12" class="a-string"/><ellipse cx="10" cy="24" rx="3.2" ry="5" class="a-meat"/><ellipse cx="10" cy="32" rx="3" ry="4.6" class="a-meat"/></g>' +
    '<g class="a-sway s2"><path d="M86 8v9" class="a-string"/><circle cx="86" cy="20" r="3" class="a-garlic"/><circle cx="83.4" cy="26" r="2.6" class="a-garlic"/><circle cx="88.6" cy="26.4" r="2.6" class="a-garlic"/><circle cx="86" cy="31" r="2.4" class="a-garlic"/></g>' +
    '<g class="a-lamp" transform="translate(-22 0)"><path d="M50 8v8" class="a-string"/><path d="M44 28l3-12h6l3 12z" class="a-shade"/><circle cx="50" cy="26" r="2.4" class="a-bulb"/></g>' +
    '<path d="M0 0l16 0-14 14z M100 0l-16 0 14 14z" class="a-web" opacity=".5"/>';
  const front = '<g class="a-boards">' + [0, 1, 2, 3, 4, 5, 6, 7].map(i => '<path d="M' + (i * 14 - 4) + ' 105l' + (i % 2 ? 6 : -6) + ' 10" />').join('') + '<path d="M0 105h100"/></g>' + '<g transform="translate(0 105)">' + scatter(18, 7, 100, 10, 0.5, 'a-grit') + '</g>';
  return layer('l-back', back) + layer('l-mid', mid) + '<div class="ar-lampglow"></div>' + layer('l-front', front);
}

/* ---------- Coffin Stack: the hill, and the sky above it ---------- */
function stackScene() {
  const stars = scatter(46, 11, 100, 90, 0.5, 'a-star');
  const night = '<defs>' + sky('as-night', '--ar-sky-b', '--ar-sky-a') + '</defs><rect width="100" height="115" fill="url(#as-night)"/>' + stars +
    '<circle cx="76" cy="26" r="10" class="a-halo"/><circle cx="76" cy="26" r="6.2" class="a-moon"/><circle cx="73.8" cy="24.5" r="1.4" class="a-crater"/><circle cx="78.2" cy="28.2" r="1.9" class="a-crater"/>' +
    '<g class="a-bat b1"><path d="M20 40c3-3 5-1 6 1 1-2 3-4 6-1-2 0-4 1-6 4-2-3-4-4-6-4z"/></g><g class="a-bat b2"><path d="M54 62c3-3 5-1 6 1 1-2 3-4 6-1-2 0-4 1-6 4-2-3-4-4-6-4z"/></g>';
  const dusk = '<defs><linearGradient id="as-dusk" x1="0" y1="0" x2="0" y2="1">' + stop(0, '--ar-sky-a') + stop(0.7, '--ar-fog', 0.55) + stop(1, '--ar-glow', 0.45) + '</linearGradient></defs>' +
    '<rect width="100" height="115" fill="url(#as-dusk)"/><circle cx="24" cy="84" r="9" class="a-sun"/>' +
    '<g class="a-pigeon p1"><path d="M60 34c2-2 4-1 5 1 1-2 3-3 5-1-2 0-4 1-5 3-1-2-3-3-5-3z"/></g><g class="a-pigeon p2"><path d="M30 52c2-2 4-1 5 1 1-2 3-3 5-1-2 0-4 1-5 3-1-2-3-3-5-3z"/></g>';
  const clouds = '<defs>' + sky('as-cloud', '--ar-sky-a', '--ar-fog') + '</defs><rect width="100" height="115" fill="url(#as-cloud)" opacity=".92"/>' +
    [[16, 30, 20], [70, 18, 24], [48, 62, 28], [86, 84, 18], [10, 96, 22]].map(([x, y, r]) => '<ellipse class="a-cloud" cx="' + x + '" cy="' + y + '" rx="' + r + '" ry="' + (r * 0.32).toFixed(1) + '"/><ellipse class="a-cloud" cx="' + (x + r * 0.35) + '" cy="' + (y - r * 0.12).toFixed(1) + '" rx="' + (r * 0.6).toFixed(1) + '" ry="' + (r * 0.26).toFixed(1) + '"/>').join('');
  const heaven = '<defs><linearGradient id="as-heaven" x1="0" y1="0" x2="0" y2="1">' + stop(0, '--ar-glow', 0.9) + stop(1, '--ar-sky-a') + '</linearGradient></defs><rect width="100" height="115" fill="url(#as-heaven)"/>' +
    '<g class="a-rays">' + [0, 1, 2, 3, 4, 5].map(i => '<path d="M50 -4L' + (i * 20 - 14) + ' 120h10z"/>').join('') + '</g>' +
    '<g class="a-gate"><path d="M30 118V74a20 20 0 0 1 40 0v44z" class="a-arch"/><path d="M40 118V80a10 10 0 0 1 20 0v38z" class="a-arch-in"/></g>' + scatter(24, 5, 100, 100, 0.7, 'a-star');
  const hill = '<defs>' + sky('as-hill', '--ar-ground', '--ar-sky-b') + '</defs>' +
    '<path d="M0 115V88c14-8 30-10 48-6 20 5 36 2 52-4v37z" class="a-hill"/>' +
    '<g class="a-church"><path d="M70 82V62h14v20z" /><path d="M68 62l9-12 9 12z"/><path d="M76 50V42M73.5 45h5" class="a-spire"/><rect x="75" y="68" width="4" height="8" rx="2" class="a-lit"/></g>' +
    '<g class="a-stones">' + [[8, 90, 7], [20, 92, 6], [34, 90, 7], [88, 88, 6], [96, 90, 5]].map(([x, y, w]) => '<path d="M' + (x - w / 2) + ' ' + (y + 12) + 'V' + y + 'a' + w / 2 + ' ' + w / 2 + ' 0 0 1 ' + w + ' 0v12z"/>').join('') + '</g>' +
    '<path d="M4 88l4-10 4 0-3 6 6-4 2 3-7 5z M92 84l-3-14 3 3 3-6 2 8-3-2z" class="a-tree"/><rect width="100" height="115" fill="none"/>';
  return '<div class="ar-sky" data-stage="0"><div class="st st-dusk">' + layer('l-sky', dusk) + '</div><div class="st st-clouds">' + layer('l-sky', clouds) + '</div><div class="st st-night">' + layer('l-sky', night) + '</div><div class="st st-heaven">' + layer('l-sky', heaven) + '</div></div>' +
    '<div class="ar-ground">' + layer('l-hill', hill) + '</div>';
}

/* ---------- The Séance: the parlour ---------- */
function seanceScene() {
  const wall = '<defs>' + sky('ac-wall') + '<pattern id="ac-damask" width="14" height="18" patternUnits="userSpaceOnUse"><path d="M7 2c2 3 3 5 0 8-3-3-2-5 0-8zM0 11c2 2 3 4 0 7M14 11c-2 2-3 4 0 7M7 12c1 2 1 3 0 5" class="a-motif"/></pattern></defs>' +
    '<rect width="100" height="115" fill="url(#ac-wall)"/><rect width="100" height="115" fill="url(#ac-damask)" opacity=".5"/>' +
    '<path d="M0 0h22c-4 14-4 40 0 76-8 8-14 18-22 24z" class="a-curtain"/><path d="M100 0H78c4 14 4 40 0 76 8 8 14 18 22 24z" class="a-curtain"/>' +
    '<path d="M6 2c2 30 2 56 0 80M13 2c1 26 1 48-1 70" class="a-fold"/><path d="M94 2c-2 30-2 56 0 80M87 2c-1 26-1 48 1 70" class="a-fold"/>';
  const table = '<ellipse cx="50" cy="66" rx="47" ry="42" class="a-table"/><ellipse cx="50" cy="66" rx="43" ry="38" class="a-table-in"/>' +
    '<ellipse cx="50" cy="66" rx="34" ry="30" class="a-ring"/><ellipse cx="50" cy="66" rx="26" ry="22.5" class="a-ring dash"/>' +
    [0, 1, 2, 3, 4, 5, 6, 7].map(i => { const a = i * Math.PI / 4; return '<path class="a-rune" d="M' + (50 + Math.cos(a) * 30).toFixed(1) + ' ' + (66 + Math.sin(a) * 26.5).toFixed(1) + 'l1.6 -2.2 1.6 2.2z"/>'; }).join('');
  const mist = '<ellipse class="a-mist" cx="20" cy="86" rx="26" ry="5"/><ellipse class="a-mist" cx="80" cy="96" rx="30" ry="6"/><ellipse class="a-mist" cx="50" cy="104" rx="40" ry="5"/>';
  return layer('l-back', wall) + layer('l-mid', table, 'xMidYMid slice') + layer('l-front ar-mist-layer', mist);
}

/* ---------- Grave Whack: the cemetery ---------- */
function whackScene() {
  const sk = '<defs>' + sky('aw-sky') + '</defs><rect width="100" height="115" fill="url(#aw-sky)"/>' + scatter(34, 3, 100, 48, 0.45, 'a-star') +
    '<circle cx="78" cy="16" r="13" class="a-halo"/><circle cx="78" cy="16" r="7.4" class="a-moon"/><circle cx="75.6" cy="14.4" r="1.5" class="a-crater"/><circle cx="80.4" cy="18.4" r="2" class="a-crater"/>';
  const far = '<path d="M0 64c8-3 14-2 22 0 10 3 18 2 28-1s18-2 28 1c8 2 16 1 22-1v52H0z" class="a-ridge"/>' +
    '<g class="a-fence">' + Array.from({ length: 22 }, (_, i) => '<path d="M' + (i * 4.7 + 1) + ' 72V58l1.6-3 1.6 3v14z"/>').join('') + '<path d="M0 62h100M0 68h100"/></g>' +
    '<path d="M6 70V40c-4-3-6-8-4-12 2 3 6 4 8 4-2-4-2-8 1-12 1 5 4 8 6 8-1 6-4 8-4 14l1 28z" class="a-tree"/>' +
    '<path d="M92 70V46l-8-8 7 3-3-9 5 8 4-7-1 9 5-3-6 8V70z" class="a-tree"/>';
  const fog = '<ellipse class="a-fog" cx="24" cy="66" rx="38" ry="6"/><ellipse class="a-fog" cx="76" cy="78" rx="42" ry="7"/>';
  const ground = '<path d="M0 115V74c20-2 40-3 60-1 14 1 28 2 40 0v42z" class="a-ground"/>' +
    '<g class="a-grass">' + Array.from({ length: 18 }, (_, i) => '<path d="M' + (i * 5.8 + 2) + ' 115l-1.2-6 2.2 5 1.4-7 .6 8"/>').join('') + '</g>' +
    '<g class="a-lantern"><path d="M93 96V84M90 84h6l-1 8h-4z" class="a-post"/><circle cx="93" cy="88" r="1.6" class="a-bulb"/></g>';
  return layer('l-sky', sk) + layer('l-far', far) + layer('l-fog ar-fog-layer', fog) + layer('l-front', ground);
}

const SCENES = { frenzy: frenzyScene, stack: stackScene, seance: seanceScene, whack: whackScene };
export function sceneMarkup(gameId) { return (SCENES[gameId] || (() => ''))(); }

/* ---------- Brother Aldous, who throws the holy water ---------- */
export function bossMarkup() {
  return '<svg class="ar-boss-art" viewBox="0 0 80 96" aria-hidden="true" focusable="false">' +
    '<path d="M40 8c-10 0-17 8-17 18 0 6 2 10 4 13l-9 49h44l-9-49c2-3 4-7 4-13 0-10-7-18-17-18z" class="b-robe"/>' +
    '<path d="M31 24c2-6 16-6 18 0 1 6-2 14-9 14s-10-8-9-14z" class="b-face"/><circle cx="35.5" cy="28" r="1.5" class="b-eye"/><circle cx="44.5" cy="28" r="1.5" class="b-eye"/>' +
    '<path d="M36 34c3 2 5 2 8 0" class="b-mouth"/><path d="M40 40l-4 46M40 40l4 46" class="b-fold"/>' +
    '<g class="b-arm"><path d="M23 44c-8 4-12 10-13 18" class="b-sleeve"/><path d="M6 60h10v10c0 3-2 5-5 5s-5-2-5-5z" class="b-bucket"/><path d="M6 62h10" class="b-rim"/></g>' +
    '<g class="b-arm2"><path d="M57 44c8 4 12 10 13 18" class="b-sleeve"/><path d="M70 62v-14" class="b-wand"/><circle cx="70" cy="45" r="4" class="b-ball"/></g></svg>';
}

/* ---------- animated cards for the arcade hub ---------- */
export function hubArt(gameId) {
  const wrap = inner => '<svg class="hub-art hub-' + gameId + '" viewBox="0 0 96 64" aria-hidden="true" focusable="false">' + inner + '</svg>';
  if (gameId === 'frenzy') return wrap('<rect width="96" height="64" rx="8" class="h-bg"/><path d="M22 60h52" class="h-floor"/><g class="h-fall f1"><circle cx="26" cy="8" r="4.5" class="h-good"/></g><g class="h-fall f2"><rect x="46" y="4" width="8" height="12" rx="3" class="h-bad"/></g><g class="h-fall f3"><circle cx="70" cy="8" r="3.4" class="h-good"/></g>' +
    '<g class="h-mouth"><path d="M28 52c4-8 36-8 40 0-2 10-8 8-20 8s-18 2-20-8z" class="h-teeth"/><path d="M36 53l3 4 3-4 3 4 3-4 3 4 3-4" class="h-gum"/></g>');
  if (gameId === 'stack') return wrap('<rect width="96" height="64" rx="8" class="h-bg"/><circle cx="76" cy="14" r="6" class="h-moon"/><g class="h-cof c1"><path d="M22 52h52l4 5-4 5H22l-4-5z" class="h-block"/></g><g class="h-cof c2"><path d="M30 40h40l4 5-4 5H30l-4-5z" class="h-block"/></g><g class="h-top"><path d="M34 28h34l4 5-4 5H34l-4-5z" class="h-mover"/></g>');
  if (gameId === 'seance') return wrap('<rect width="96" height="64" rx="8" class="h-bg"/><ellipse cx="48" cy="54" rx="40" ry="7" class="h-table"/>' +
    [[22, 0], [48, 1], [74, 2]].map(([x, i]) => '<g class="h-candle k' + i + '"><rect x="' + (x - 4) + '" y="34" width="8" height="18" rx="1.6" class="h-wax"/><path d="M' + x + ' 20c4 5 5 7 5 10a5 5 0 0 1-10 0c0-3 1-5 5-10z" class="h-flame"/></g>').join(''));
  return wrap('<rect width="96" height="64" rx="8" class="h-bg"/><circle cx="76" cy="12" r="6" class="h-moon"/><path d="M0 52c14-3 28-3 48 0s34 2 48-1v13H0z" class="h-ground"/><g class="h-stones"><path d="M14 50v-10a7 7 0 0 1 14 0v10z" class="h-stone"/><path d="M68 50v-10a7 7 0 0 1 14 0v10z" class="h-stone"/></g>' +
    '<g class="h-hand"><path d="M40 52c-3-3-4-6-4-10v-4a2 2 0 0 1 4 0v3-10a2.2 2.2 0 0 1 4.4 0v10-12a2.2 2.2 0 0 1 4.4 0v12-9a2.2 2.2 0 0 1 4.4 0v14c0 4-2 6-3 7z" class="h-rise"/></g><path d="M34 52h28v6H34z" class="h-mound"/>');
}

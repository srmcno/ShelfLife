import { COLOUR_BY_ID, AWARD_BY_ID } from '../content/coven.js';

/* ================= COVEN ART =================
   Sigils built from three parts (a shape, a symbol, a colour) and worn in an
   optional frame; the curios in the coven cupboard; and the trophies on the
   Shelfies shelf. Flat fills under a dark ink line, like the Court's cast.
   Every function returns an SVG string built only from known ids, so nothing a
   friend sends can become markup. */

const INK = '#1a0a11', BONE = '#f2e9dc';
const O = 'stroke="' + INK + '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';
const T = 'stroke="' + INK + '" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"';
const L = 'fill="none" stroke="' + INK + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';

const channels = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
export const mix = (x, y, t) => '#' + channels(x).map((v, i) => Math.round(v + (channels(y)[i] - v) * t).toString(16).padStart(2, '0')).join('');

/* ---------- shapes, inside 0..100 ---------- */
const SHAPES = {
  shield: 'M50 6L88 18V48C88 72 70 88 50 96C30 88 12 72 12 48V18Z',
  seal: 'M50 7C61 5 71 11 79 17C89 25 94 37 92 50C95 62 89 74 80 82C72 90 62 95 50 92C38 95 27 90 20 82C11 74 5 62 8 50C5 38 11 26 20 18C28 10 39 5 50 7Z',
  moon: 'M50 6A44 44 0 1 1 49.9 6Z',
  coffin: 'M37 4H63L84 27L70 96H30L16 27Z',
  lozenge: 'M50 4L95 50L50 96L5 50Z',
  keyhole: 'M50 5C68 5 80 19 80 35C80 46 75 54 69 59L83 95H17L31 59C25 54 20 46 20 35C20 19 32 5 50 5Z'
};
// A lighter shape laid over part of the base, so each sigil has a little depth.
const SHINE = {
  shield: 'M50 12L82 22V46C82 54 79 61 74 67C66 52 56 34 50 12Z',
  seal: 'M30 18C40 11 54 10 64 14C52 18 40 28 34 42C30 34 28 25 30 18Z',
  moon: 'M50 10C36 22 30 36 30 50C30 64 36 78 50 90A40 40 0 0 1 50 10Z',
  coffin: 'M40 9H60L77 28L74 44C62 34 48 20 40 9Z',
  lozenge: 'M50 11L88 50L74 64C66 48 56 30 50 11Z',
  keyhole: 'M50 11C64 11 74 22 74 35C74 40 72 45 69 49C60 40 52 26 50 11Z'
};

/* ---------- symbols, centred near 50,50 ---------- */
const SYMBOLS = {
  spoon: '<ellipse cx="50" cy="35" rx="10" ry="14" fill="' + BONE + '" ' + T + '/><path d="M47 48h6l-1 28a2 2 0 0 1-4 0z" fill="' + BONE + '" ' + T + '/><path d="M45 31q3-6 7-7" ' + L + ' stroke-width="1.6" opacity=".5"/>',
  key: '<circle cx="50" cy="33" r="11" fill="' + BONE + '" ' + T + '/><circle cx="50" cy="33" r="4" fill="' + INK + '"/><path d="M47 43h6v34h-6z" fill="' + BONE + '" ' + T + '/><path d="M53 64h8v5h-8M53 72h6v5h-6" fill="' + BONE + '" ' + T + '/>',
  moth: '<path d="M49 40C40 24 24 26 26 40c1 9 12 12 23 8zM51 40c9-16 25-14 23 0-1 9-12 12-23 8z" fill="' + BONE + '" ' + T + '/><path d="M49 52c-10 2-18 12-12 18 5 5 12-4 12-14zM51 52c10 2 18 12 12 18-5 5-12-4-12-14z" fill="' + BONE + '" ' + T + '/><ellipse cx="50" cy="51" rx="4" ry="14" fill="' + INK + '"/><path d="M48 37q-4-8-9-9M52 37q4-8 9-9" ' + L + '/><circle cx="35" cy="38" r="3" fill="' + INK + '" opacity=".5"/><circle cx="65" cy="38" r="3" fill="' + INK + '" opacity=".5"/>',
  candle: '<path d="M50 18c6 7 6 13 0 17-6-4-6-10 0-17z" fill="#ffd27a" ' + T + '/><path d="M50 35v4" ' + L + '/><path d="M40 40h20v36H40z" fill="' + BONE + '" ' + T + '/><path d="M40 44c3 0 3 8 6 8s2-8 6-8 3 5 8 4" fill="none" ' + T + '/><path d="M34 78h32" ' + L + ' stroke-width="3"/>',
  teacup: '<path d="M30 42h36v8c0 12-8 20-18 20s-18-8-18-20z" fill="' + BONE + '" ' + T + '/><path d="M66 46c8 0 10 4 9 8s-5 7-11 6" fill="none" ' + T + '/><path d="M26 74h44" ' + L + ' stroke-width="3.4"/><path d="M42 22q-4 5 0 10t0 10M52 20q-4 5 0 10t0 10" ' + L + ' opacity=".7"/>',
  raven: '<path d="M70 70c-6 6-24 8-32 2-8-6-8-20-2-28 5-7 14-10 20-8l10-8c2 6 0 10-2 12 8 6 12 22 6 30z" fill="' + BONE + '" ' + T + '/><path d="M36 44l-14 3 13 4" fill="' + BONE + '" ' + T + '/><circle cx="44" cy="40" r="2.6" fill="' + INK + '"/><path d="M48 76l-3 8M56 76l3 8" ' + L + '/><path d="M58 50q8 6 8 16" ' + L + ' opacity=".6"/>',
  mushroom: '<path d="M24 48c0-16 12-26 26-26s26 10 26 26z" fill="' + BONE + '" ' + T + '/><path d="M42 48h16l2 26H40z" fill="' + BONE + '" ' + T + '/><circle cx="38" cy="38" r="4" fill="' + INK + '" opacity=".75"/><circle cx="54" cy="31" r="3" fill="' + INK + '" opacity=".75"/><circle cx="63" cy="41" r="3.4" fill="' + INK + '" opacity=".75"/><path d="M34 78h32" ' + L + '/>',
  kettle: '<path d="M30 70c-2-18 6-32 20-32s22 14 20 32z" fill="' + BONE + '" ' + T + '/><path d="M30 56c-10-2-14-12-12-20" ' + L + ' stroke-width="3"/><path d="M36 38c0-14 28-14 28 0" fill="none" ' + T + '/><circle cx="50" cy="35" r="3.4" fill="' + BONE + '" ' + T + '/><path d="M28 72h44" ' + L + ' stroke-width="3"/>',
  bell: '<path d="M30 66c4-4 4-10 4-20 0-10 7-18 16-18s16 8 16 18c0 10 0 16 4 20z" fill="' + BONE + '" ' + T + '/><circle cx="50" cy="72" r="5" fill="' + BONE + '" ' + T + '/><path d="M50 22v6" ' + L + ' stroke-width="3"/><path d="M40 40q2-6 8-8" ' + L + ' stroke-width="1.6" opacity=".5"/>',
  spider: '<path d="M44 46L28 34l-6 4M44 50L24 48l-4 6M44 54L26 62l-2 8M46 58L34 72M56 46l16-12 6 4M56 50l20-2 4 6M56 54l18 8 2 8M54 58l12 14" ' + L + '/><ellipse cx="50" cy="56" rx="10" ry="12" fill="' + BONE + '" ' + T + '/><circle cx="50" cy="40" r="7" fill="' + BONE + '" ' + T + '/><circle cx="47" cy="39" r="1.6" fill="' + INK + '"/><circle cx="53" cy="39" r="1.6" fill="' + INK + '"/><path d="M50 20v13" ' + L + ' stroke-width="1.6"/>',
  snail: '<path d="M22 72h48c6 0 10-4 12-10" fill="none" ' + T + ' stroke-width="3"/><path d="M24 72c0-6 4-10 10-10h40c4 0 6 4 4 10z" fill="' + BONE + '" ' + T + '/><circle cx="54" cy="48" r="18" fill="' + BONE + '" ' + T + '/><path d="M54 48m-4 0a4 4 0 1 0 8 0a8 8 0 1 0-16 0a12 12 0 1 0 24 0" ' + L + '/><path d="M28 62l-4-12M34 62l-1-12" ' + L + '/>',
  jar: '<path d="M38 26h24v8H38z" fill="#c9a06a" ' + T + '/><path d="M36 34h28c4 6 6 12 6 20v16c0 4-3 6-7 6H37c-4 0-7-2-7-6V54c0-8 2-14 6-20z" fill="' + BONE + '" ' + T + '/><path d="M37 52h26v12H37z" fill="#e7d8bb" ' + T + ' stroke-width="1.6"/><path d="M41 58h14" ' + L + ' stroke-width="1.6"/>'
};

/* ---------- frames, around the 0..100 sigil, in a -10..110 box ---------- */
const ring = (r, extra = '') => '<circle cx="50" cy="50" r="' + r + '" fill="none" ' + extra + '/>';
const around = (n, fn, offset = 0) => Array.from({ length: n }, (_, i) => fn((i / n) * Math.PI * 2 + offset, i)).join('');
const at = (a, r) => [50 + Math.cos(a) * r, 50 + Math.sin(a) * r].map(v => v.toFixed(1));
const FRAMES = {
  ivy: ring(55, 'stroke="#3e6b34" stroke-width="2.4"') + around(10, a => { const [x, y] = at(a, 55); return '<ellipse cx="' + x + '" cy="' + y + '" rx="5" ry="2.8" transform="rotate(' + (a * 57.3 + 45).toFixed(0) + ' ' + x + ' ' + y + ')" fill="#7fae55" ' + T + ' stroke-width="1.4"/>'; }),
  stubs: ring(55, 'stroke="#6b4a36" stroke-width="2"') + around(7, a => { const [x, y] = at(a, 55); return '<g transform="translate(' + x + ' ' + y + ')"><rect x="-3" y="-4" width="6" height="8" fill="' + BONE + '" ' + T + ' stroke-width="1.4"/><path d="M0 -10c2 2 2 4 0 6-2-2-2-4 0-6z" fill="#ffd27a"/></g>'; }, -Math.PI / 2),
  lace: around(24, (a, i) => { const [x, y] = at(a, 56); return '<circle cx="' + x + '" cy="' + y + '" r="3.6" fill="' + BONE + '" fill-opacity=".85" ' + T + ' stroke-width="1"/>'; }) + ring(52, 'stroke="' + BONE + '" stroke-width="1.4" stroke-dasharray="2 3" opacity=".7"'),
  bunting: '<path d="M2 26Q50 -6 98 26" fill="none" stroke="' + INK + '" stroke-width="1.6"/>' + [10, 22, 35, 50, 65, 78, 90].map((x, i) => { const y = 26 - Math.sin((x / 100) * Math.PI) * 26; return '<path d="M' + (x - 5) + ' ' + (y + 2).toFixed(1) + 'h10l-5 10z" fill="' + (i % 2 ? '#2a2230' : '#5b4a63') + '" ' + T + ' stroke-width="1.2"/>'; }).join(''),
  thorns: ring(54, 'stroke="#4a3a2e" stroke-width="3"') + around(14, a => { const [x1, y1] = at(a - 0.07, 54), [x2, y2] = at(a + 0.07, 54), [x3, y3] = at(a, 62); return '<path d="M' + x1 + ' ' + y1 + 'L' + x3 + ' ' + y3 + 'L' + x2 + ' ' + y2 + 'z" fill="#6b5442" ' + T + ' stroke-width="1"/>'; }),
  gilt: ring(57, 'stroke="#e8c77a" stroke-width="3"') + ring(53, 'stroke="#b8923e" stroke-width="1.6"') + around(16, a => { const [x, y] = at(a, 55); return '<circle cx="' + x + '" cy="' + y + '" r="1.6" fill="#fff1c4"/>'; })
};

export function sigilSVG(sigil, { frame = '', className = '', label = '' } = {}) {
  const colour = COLOUR_BY_ID[sigil?.colour]?.hex || '#a9a39b';
  const shape = SHAPES[sigil?.shape] ? sigil.shape : 'shield';
  const symbol = SYMBOLS[sigil?.symbol] ? sigil.symbol : 'candle';
  const a11y = label ? 'role="img" aria-label="' + label.replace(/[&<>"']/g, '') + '"' : 'aria-hidden="true"';
  return '<svg class="cv-sigil' + (className ? ' ' + className : '') + '" viewBox="-12 -12 124 124" ' + a11y + ' focusable="false">' +
    '<path d="' + SHAPES[shape] + '" fill="' + colour + '" ' + O + '/>' +
    '<path d="' + SHINE[shape] + '" fill="' + mix(colour, '#ffffff', 0.32) + '" opacity=".55"/>' +
    '<path d="' + SHAPES[shape] + '" fill="none" stroke="' + mix(colour, '#000000', 0.45) + '" stroke-width="1.4" transform="translate(50 50) scale(.86) translate(-50 -50)" opacity=".7"/>' +
    '<g transform="translate(50 52) scale(.78) translate(-50 -50)">' + SYMBOLS[symbol] + '</g>' +
    (FRAMES[frame] || '') + '</svg>';
}

/* ---------- the coven cupboard ---------- */
const CURIO_ART = {
  'cv-minutes': '<path d="M14 8h26l8 8v36H14z" fill="' + BONE + '" ' + T + '/><path d="M40 8v8h8" fill="none" ' + T + '/><path d="M20 22h20M20 28h22M20 34h16M20 40h20" ' + L + ' stroke-width="1.4" opacity=".6"/><path d="M20 46h6" stroke="#a32c3c" stroke-width="2.4" stroke-linecap="round"/><text x="31" y="49" font-size="9" font-weight="700" fill="#a32c3c" font-family="Georgia,serif">4.</text>',
  'cv-spoon': '<ellipse cx="22" cy="18" rx="8" ry="11" fill="#cfd3da" ' + T + '/><path d="M20 28h4l4 24h-8z" fill="#cfd3da" ' + T + '/><path d="M26 40l14 6v8l-14-4" fill="#e8c77a" ' + T + ' stroke-width="1.6"/><circle cx="37" cy="49" r="1.6" fill="' + INK + '"/>',
  'cv-candle': '<path d="M30 10c5 5 5 10 0 13-5-3-5-8 0-13z" fill="#ffd27a" ' + T + '/><path d="M22 26h16v20H22z" fill="' + BONE + '" ' + T + '/><path d="M22 30c2 0 2 9 4 9s1-9 4-9 2 12 4 12 2-12 4-12" fill="none" ' + T + ' stroke-width="1.6"/><path d="M14 48h32" ' + L + ' stroke-width="3"/>',
  'cv-mug': '<path d="M14 16h26v30c0 4-3 6-6 6H20c-3 0-6-2-6-6z" fill="' + BONE + '" ' + T + '/><path d="M40 22c8 0 9 4 9 8s-2 8-9 8" fill="none" ' + T + '/><text x="18" y="36" font-size="9" font-weight="700" fill="#a32c3c" font-family="Georgia,serif">OK</text>',
  'cv-rota': '<rect x="12" y="10" width="34" height="44" rx="3" fill="#b07a4a" ' + T + '/><rect x="16" y="16" width="26" height="34" fill="' + BONE + '"/><rect x="22" y="7" width="14" height="6" rx="2" fill="#cfd3da" ' + T + ' stroke-width="1.6"/><path d="M16 24h26M16 32h26M16 40h26M26 16v34M34 16v34" ' + L + ' stroke-width="1.2"/><rect x="27" y="33" width="6" height="6" fill="#6b1422"/>',
  'cv-badge': '<rect x="10" y="16" width="38" height="28" rx="4" fill="#9fd8ff" fill-opacity=".45" ' + T + '/><rect x="14" y="20" width="12" height="14" fill="#cfd3da" ' + T + ' stroke-width="1.4"/><circle cx="20" cy="25" r="3" fill="' + INK + '" opacity=".6"/><path d="M30 24h14M30 30h10M14 39h30" ' + L + ' stroke-width="1.4"/><path d="M29 10v6" ' + L + '/>',
  'cv-tin': '<ellipse cx="30" cy="44" rx="20" ry="7" fill="#6b1422" ' + T + '/><path d="M10 26v18c0 4 9 7 20 7s20-3 20-7V26" fill="#a32c3c" ' + T + '/><ellipse cx="30" cy="26" rx="20" ry="7" fill="#c8404f" ' + T + '/><rect x="23" y="18" width="14" height="8" rx="2" fill="#e8b964" ' + T + ' stroke-width="1.6"/><path d="M26 22h8" ' + L + ' stroke-width="1.2"/>',
  'cv-gavel': '<rect x="8" y="44" width="30" height="8" rx="2" fill="#6b4a36" ' + T + '/><path d="M26 34l20-18" stroke="' + INK + '" stroke-width="5" stroke-linecap="round"/><path d="M26 34l20-18" stroke="#b07a4a" stroke-width="2.6" stroke-linecap="round"/><rect x="12" y="20" width="22" height="12" rx="3" transform="rotate(-42 23 26)" fill="#8b5a3c" ' + T + '/>'
};
export function covenCurioSVG(id, { locked = false } = {}) {
  const art = CURIO_ART[id];
  if (!art || locked) return '<svg class="cv-curio-art locked" viewBox="0 0 60 60" aria-hidden="true" focusable="false"><rect x="12" y="12" width="36" height="36" rx="6" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="4 4" opacity=".4"/><text x="30" y="37" text-anchor="middle" font-size="16" fill="currentColor" opacity=".45" font-family="Georgia,serif">?</text></svg>';
  return '<svg class="cv-curio-art" viewBox="0 0 60 60" aria-hidden="true" focusable="false">' + art + '</svg>';
}

/* ---------- trophies ---------- */
// Gold for leading something, silver for support, tin for turning up, and for Least Help, a wooden spoon.
export function trophySVG(awardId) {
  const stat = AWARD_BY_ID[awardId]?.stat || 'zero';
  if (stat === 'least') {
    return '<svg class="cv-trophy spoon" viewBox="0 0 60 70" aria-hidden="true" focusable="false"><ellipse cx="30" cy="18" rx="10" ry="13" fill="#b07a4a" ' + T + '/><path d="M27 30h6l2 28h-10z" fill="#b07a4a" ' + T + '/><rect x="14" y="58" width="32" height="8" rx="2" fill="#4a3a2e" ' + T + '/><path d="M26 14q3-5 7-5" ' + L + ' opacity=".4"/></svg>';
  }
  const metal = stat === 'support' ? ['#cfd3da', '#9aa0aa'] : stat === 'zero' ? ['#a9a39b', '#77716a'] : ['#e8c77a', '#b8923e'];
  return '<svg class="cv-trophy" viewBox="0 0 60 70" aria-hidden="true" focusable="false">' +
    '<path d="M16 8h28v12c0 10-6 18-14 18S16 30 16 20z" fill="' + metal[0] + '" ' + T + '/>' +
    '<path d="M16 12H8c0 8 4 12 10 12M44 12h8c0 8-4 12-10 12" fill="none" ' + T + '/>' +
    '<path d="M26 38h8v10h-8z" fill="' + metal[1] + '" ' + T + '/><rect x="16" y="48" width="28" height="8" rx="2" fill="' + metal[1] + '" ' + T + '/>' +
    '<rect x="12" y="56" width="36" height="9" rx="2" fill="#4a3a2e" ' + T + '/><path d="M22 14q2 8 4 12" ' + L + ' stroke="#fff" opacity=".45"/></svg>';
}

// The Shelfies' stage: curtains, a sign, a spotlight. The host and the gallery are laid over it.
export const STAGE_SVG = '<svg class="cv-stage-set" viewBox="0 0 320 170" preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
  '<rect width="320" height="170" fill="#140d1a"/>' +
  '<path d="M90 0h140l40 170H50z" fill="#ffe8a8" opacity=".09"/>' +
  '<rect y="128" width="320" height="42" fill="#3a2418"/><path d="M0 128h320" stroke="#6b4a36" stroke-width="3"/>' +
  '<path d="M0 0h58c-6 40-4 90 6 170H0z" fill="#6b1422"/><path d="M14 0c-2 60 2 120 8 170M32 0c-3 60 0 120 10 170" stroke="#4a0d18" stroke-width="5" fill="none"/>' +
  '<path d="M320 0h-58c6 40 4 90-6 170h64z" fill="#6b1422"/><path d="M306 0c2 60-2 120-8 170M288 0c3 60 0 120-10 170" stroke="#4a0d18" stroke-width="5" fill="none"/>' +
  '<path d="M0 0h320v14c-26 8-54 8-80 0-26 8-54 8-80 0-26 8-54 8-80 0-26 8-54 8-80 0z" fill="#8a1c2c"/>' +
  '</svg>';

/* The corridor outside Courtroom 1, where the hall cam catches the loser.

   HALL_SET is the architecture: ceiling, wallpaper, dado rail, wainscot,
   skirting, floor, carpet runner and the courtroom door. It is drawn in a
   0 0 100 100 box that stretches to the stage (preserveAspectRatio none), so
   its coordinates are percentages of the stage and anything placed over it in
   CSS percentages lands in the same spot at every width. The wall runs away
   from the camera towards a vanishing point off to the right; the wallpaper's
   teardrops (the shelf's damask motif) shrink with it. Shapes that must stay
   round are drawn a third narrower, which is right for the usual 3:2 stage.

   HALL_PROPS are the things with faces, text or proportions worth keeping:
   the vending machine, the noticeboard, the late Judge Osseus, the bench, the
   reporter's microphone and the boom. Each is its own SVG and css/court.css
   places it. Everything is decoration and aria-hidden; the lines carry the
   meaning. */

const INK = '#1a0a11';
const ol = (w = 2) => 'stroke="' + INK + '" stroke-width="' + w + '" stroke-linejoin="round" stroke-linecap="round"';
const thin = (color, w = 1) => 'fill="none" stroke="' + color + '" stroke-width="' + w + '" stroke-linecap="round" vector-effect="non-scaling-stroke"';
const r1 = n => Math.round(n * 100) / 100;

// The wall: its top (ceiling line) and bottom (floor line) run to one point.
const VPX = 400, VPY = 44, ASPECT = 1.5;
const wallTop = x => 3 + (VPY - 3) * x / VPX;
const wallBottom = x => 79 - (79 - VPY) * x / VPX;
// A point on the wall: x across the stage, v from floor (0) to ceiling (1).
const at = (x, v) => r1(wallBottom(x) - v * (wallBottom(x) - wallTop(x)));
// A line on the floor that runs along the corridor, entering at (0, y0).
const floorY = (x, y0) => r1(y0 + (VPY - y0) * x / VPX);
const scale = x => 1 - x / VPX;

const band = (v1, v2, fill) => '<path d="M-3 ' + at(-3, v1) + 'L103 ' + at(103, v1) + 'L103 ' + at(103, v2) + 'L-3 ' + at(-3, v2) + 'Z" fill="' + fill + '"/>';
const along = (v, color, w = 1) => '<path d="M-3 ' + at(-3, v) + 'L103 ' + at(103, v) + '" ' + thin(color, w) + '/>';
const quad = (x1, x2, v1, v2) => 'M' + x1 + ' ' + at(x1, v1) + 'L' + x2 + ' ' + at(x2, v1) + 'L' + x2 + ' ' + at(x2, v2) + 'L' + x1 + ' ' + at(x1, v2) + 'Z';

function wallpaper() {
  let drops = '', dots = '';
  for (let row = 0; row < 7; row++) {
    const v = 0.455 + row * 0.072;
    for (let x = -3 + (row % 2) * 2.6; x < 104;) {
      const s = scale(x), y = at(x, v), h = 3 * s, w = 1.05 * s / ASPECT;
      drops += 'M' + r1(x) + ' ' + r1(y - h / 2) + 'C' + r1(x + w * 1.25) + ' ' + r1(y) + ' ' + r1(x + w) + ' ' + r1(y + h / 2) + ' ' + r1(x) + ' ' + r1(y + h / 2) +
        'C' + r1(x - w) + ' ' + r1(y + h / 2) + ' ' + r1(x - w * 1.25) + ' ' + r1(y) + ' ' + r1(x) + ' ' + r1(y - h / 2) + 'Z';
      const dy = at(x + 2.6 * s, v + 0.036);
      if (row < 6) dots += 'M' + r1(x + 2.6 * s) + ' ' + r1(dy - 0.7 * s) + 'l' + r1(0.5 * s / ASPECT) + ' ' + r1(0.7 * s) + 'l' + r1(-0.5 * s / ASPECT) + ' ' + r1(0.7 * s) + 'l' + r1(-0.5 * s / ASPECT) + ' ' + r1(-0.7 * s) + 'Z';
      x += 5.2 * s;
    }
  }
  return '<path d="' + drops + '" fill="#5d2a50"/><path d="' + dots + '" fill="#6e3561"/>';
}
function wainscot() {
  let panels = '';
  for (let x = -3; x < 103;) {
    const step = 13 * scale(x);
    panels += quad(r1(x + 1.1 * scale(x)), r1(x + step - 1.1 * scale(x)), 0.1, 0.32);
    x += step;
  }
  return '<path d="' + panels + '" fill="#321828" ' + thin('#4d2839', 1) + '/>';
}
function floor() {
  const lines = [82, 90, 118, 140].map(y0 => 'M-3 ' + floorY(-3, y0) + 'L103 ' + floorY(103, y0)).join('');
  const worn = [[14, 1.7], [38, 1.4], [63, 1.15]].map(([x, s]) => {
    const y = floorY(x, 100);
    return '<ellipse cx="' + x + '" cy="' + y + '" rx="' + r1(9 * s / ASPECT * 1.4) + '" ry="' + r1(2.2 * s) + '" fill="#8a3342" opacity=".55"/>';
  }).join('');
  return '<path d="M-3 ' + at(-3, 0) + 'L103 ' + at(103, 0) + 'L103 103L-3 103Z" fill="#221219"/>' +
    '<path d="' + lines + '" ' + thin('#150a10', 1) + '/>' +
    '<path d="M-3 ' + floorY(-3, 86) + 'L103 ' + floorY(103, 86) + 'L103 ' + floorY(103, 114) + 'L-3 ' + floorY(-3, 114) + 'Z" fill="#6e1c2a"/>' + worn +
    '<path d="M-3 ' + floorY(-3, 88.4) + 'L103 ' + floorY(103, 88.4) + 'M-3 ' + floorY(-3, 111.4) + 'L103 ' + floorY(103, 111.4) + '" ' + thin('#b8893a', 1.2) + '/>' +
    '<path d="M-3 ' + floorY(-3, 86) + 'L103 ' + floorY(103, 86) + '" ' + thin('#2a0d14', 1.4) + '/>';
}
// Courtroom 1: the door stands ajar, the studio light spilling through.
const DOOR = { x1: 43.5, x2: 55.5, top: 0.64, leaf: 49.4 };
function door() {
  const { x1, x2, top, leaf } = DOOR;
  const leafPath = 'M' + x1 + ' ' + at(x1, 0) + 'L' + x1 + ' ' + at(x1, top) + 'L' + leaf + ' ' + r1(at(leaf, top) + 1.4) + 'L' + leaf + ' ' + r1(at(leaf, 0) - 0.9) + 'Z';
  const spillTop = at(leaf, 0), spillEnd = at(x2, 0);
  return '<path class="sc-hall-spill" d="M' + leaf + ' ' + spillTop + 'L' + x2 + ' ' + spillEnd + 'L' + (x2 + 18) + ' 103L' + (leaf - 3) + ' 103Z" fill="url(#hallSpill)"/>' +
    '<path d="' + quad(x1 - 1.3, x2 + 1.3, 0, top + 0.05) + '" fill="#3a1c14" ' + thin(INK, 1.4) + '/>' +
    '<path d="' + quad(x1, x2, 0, top) + '" fill="url(#hallDoorway)" ' + thin(INK, 1.2) + '/>' +
    '<path d="M' + leaf + ' ' + at(leaf, top) + 'L' + x2 + ' ' + at(x2, top) + 'L' + x2 + ' ' + at(x2, 0) + 'L' + leaf + ' ' + at(leaf, 0) + 'Z" fill="url(#hallGlow)" opacity=".85"/>' +
    '<path d="' + leafPath + '" fill="#5a3122" ' + thin(INK, 1.2) + '/>' +
    '<path d="M' + (x1 + 0.9) + ' ' + at(x1 + 0.9, 0.36) + 'L' + (leaf - 0.8) + ' ' + r1(at(leaf, 0.36) + 0.3) + 'L' + (leaf - 0.8) + ' ' + r1(at(leaf, top - 0.05) + 1.2) + 'L' + (x1 + 0.9) + ' ' + at(x1 + 0.9, top - 0.05) + 'Z' +
      'M' + (x1 + 0.9) + ' ' + at(x1 + 0.9, 0.06) + 'L' + (leaf - 0.8) + ' ' + r1(at(leaf, 0.06) - 0.6) + 'L' + (leaf - 0.8) + ' ' + r1(at(leaf, 0.3)) + 'L' + (x1 + 0.9) + ' ' + at(x1 + 0.9, 0.3) + 'Z" fill="#4a2619" ' + thin('#2a120c', 1) + '/>' +
    '<ellipse cx="' + (leaf - 1.3) + '" cy="' + at(leaf - 1.3, 0.33) + '" rx=".55" ry=".85" fill="#e2b04a" ' + thin(INK, 0.8) + '/>';
}
// A fluorescent tube hanging from the ceiling, and the light it throws.
const tube = '<g class="sc-hall-tube"><ellipse cx="36" cy="' + at(36, 0.8) + '" rx="30" ry="26" fill="url(#hallPool)"/>' +
  '<path d="M22 3H50L49 5.6H23Z" fill="#cfc8b8" ' + thin(INK, 1.2) + '/><path d="M24 5.5H48" ' + thin('#fffbe6', 3) + '/></g>' +
  '<path d="M25 -1V3M47 -1V3" ' + thin('#6b5f58', 1) + '/>';

export const HALL_SET = '<svg class="sc-hall-set" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
  '<defs>' +
    '<radialGradient id="hallPool" cx=".5" cy=".3" r=".6"><stop offset="0" stop-color="#fff2cf" stop-opacity=".3"/><stop offset="1" stop-color="#fff2cf" stop-opacity="0"/></radialGradient>' +
    '<linearGradient id="hallDoorway" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a4a2a"/><stop offset="1" stop-color="#3a1c14"/></linearGradient>' +
    '<linearGradient id="hallGlow" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffe7a8"/><stop offset="1" stop-color="#f2a94c"/></linearGradient>' +
    '<linearGradient id="hallSpill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd98a" stop-opacity=".42"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></linearGradient>' +
    '<linearGradient id="hallDepth" x1="0" y1="0" x2="1" y2="0"><stop offset=".45" stop-color="#12070e" stop-opacity="0"/><stop offset="1" stop-color="#12070e" stop-opacity=".5"/></linearGradient>' +
  '</defs>' +
  '<path d="M-3 -3H103V' + at(103, 1) + 'L-3 ' + at(-3, 1) + 'Z" fill="#1b0d17"/>' +
  band(0.405, 0.955, '#401d39') + wallpaper() +
  band(0.955, 1, '#55283f') + along(0.955, '#2a1020') + along(0.975, '#7a3d5c', 0.8) +
  band(0.37, 0.405, '#5c3324') + along(0.4, '#8a5a44', 1) + along(0.37, '#2a140f', 1) +
  band(0.055, 0.37, '#2a1421') + wainscot() +
  band(0, 0.055, '#140910') + along(0.055, '#3a2030', 1) +
  floor() + door() + tube +
  '<rect x="-3" y="-3" width="106" height="106" fill="url(#hallDepth)"/>' +
  '</svg>';

// ---- props ----
const tooth = (x, y) => '<path d="M' + (x - 3) + ' ' + (y - 3) + 'h6v3l-1 3.4-1.4-2.2-.6 2.2-.6-2.2-1.4 2.2-1-3.4z" fill="#fbf3e3" ' + ol(0.9) + '/>';
const raisin = (x, y) => '<ellipse cx="' + x + '" cy="' + y + '" rx="2.6" ry="2.1" fill="#4a1e3a" ' + ol(0.8) + '/><path d="M' + (x - 1.3) + ' ' + (y - 0.4) + 'q1.3 .9 2.6 0" fill="none" stroke="#7a3a62" stroke-width=".6"/>';
const soul = (x, y) => '<path d="M' + x + ' ' + (y - 5) + 'c2.6 2.2 3.4 4.4 2.6 6.4a2.8 2.8 0 0 1-5.2 0c-.6-1.4.2-2.6 1-3.4c.2 1 .8 1.4 1.4 1.4c-.8-1.4-.6-2.8.2-4.4z" fill="#9fd8ff" ' + ol(0.9) + '/>';
const coil = (x, y) => '<path d="M' + (x - 4) + ' ' + (y + 2.6) + 'q1 -2 2 0q1 2 2 0q1-2 2 0q1 2 2 0" fill="none" stroke="#9fb3c4" stroke-width=".9"/>';
const txt = (x, y, size, fill, text, extra = '') => '<text x="' + x + '" y="' + y + '" font-size="' + size + '" fill="' + fill + '" text-anchor="middle" font-family="Karla, system-ui, sans-serif" font-weight="800"' + extra + '>' + text + '</text>';

const vending = '<svg viewBox="0 0 70 110" aria-hidden="true" focusable="false">' +
  '<rect x="3" y="3" width="64" height="102" rx="4" fill="#7a1a2a" ' + ol(2.4) + '/><path d="M56 7V101" stroke="#5c1220" stroke-width="7"/>' +
  '<rect x="7" y="7" width="45" height="14" rx="2" fill="#140a10" ' + ol(1.4) + '/>' + txt(29.5, 17.6, 9.4, '#ffd98a', 'SNACKS', ' letter-spacing=".6"') +
  '<rect x="7" y="24" width="45" height="64" rx="2" fill="#18283a" ' + ol(1.6) + '/><rect x="9" y="26" width="7" height="60" fill="#ffffff" opacity=".07"/>' +
  '<path d="M7 42H52M7 62H52M7 80H52" stroke="#9fb3c4" stroke-width="1.2"/>' +
  tooth(14, 33) + tooth(26, 33) + tooth(38, 33) + coil(14, 35) + coil(26, 35) + coil(38, 35) +
  txt(29.5, 47.6, 5, '#cfe0ee', 'TEETH') +
  raisin(12, 55) + raisin(17, 57) + raisin(26, 55) + raisin(31, 57) + raisin(40, 55) + raisin(45, 57) +
  txt(29.5, 67.4, 5, '#cfe0ee', 'RAISINS') +
  soul(15, 75) + soul(29.5, 75) + soul(44, 75) +
  txt(29.5, 85.2, 5.6, '#9fd8ff', 'SOULS') +
  '<g transform="rotate(-6 40 96)"><rect x="24" y="90.4" width="30" height="8.6" fill="#fff8d8" ' + ol(0.9) + '/>' + txt(39, 96.4, 3.9, INK, '(EXACT CHANGE)') + '</g>' +
  '<rect x="10" y="92" width="12" height="9" rx="1" fill="#120a10" ' + ol(1) + '/>' +
  '<rect x="55" y="26" width="9" height="6" rx="1" fill="#0f0a0c" ' + ol(1) + '/><path d="M57 29h5" stroke="#ff4b5c" stroke-width="1.4"/>' +
  '<g fill="#d9c9b0" ' + ol(0.6) + '><rect x="55.4" y="36" width="2.4" height="2.4"/><rect x="58.6" y="36" width="2.4" height="2.4"/><rect x="61.8" y="36" width="2.4" height="2.4"/><rect x="55.4" y="39.4" width="2.4" height="2.4"/><rect x="58.6" y="39.4" width="2.4" height="2.4"/><rect x="61.8" y="39.4" width="2.4" height="2.4"/><rect x="55.4" y="42.8" width="2.4" height="2.4"/><rect x="58.6" y="42.8" width="2.4" height="2.4"/><rect x="61.8" y="42.8" width="2.4" height="2.4"/></g>' +
  '<rect x="57.6" y="50" width="4.4" height="9" rx="1" fill="#0f0a0c" ' + ol(0.8) + '/><path d="M59.8 52v5" stroke="#8a8a8a" stroke-width=".8"/>' +
  '<rect x="54.8" y="66" width="10" height="7" fill="#f2e9dc" transform="rotate(8 60 69)" ' + ol(0.6) + '/><path d="M56.6 69h6M56.6 71h4" stroke="#8a7a6a" stroke-width=".7" transform="rotate(8 60 69)"/>' +
  '<path d="M6 105v3h8v-3M56 105v3h8v-3" fill="#140a10" ' + ol(1) + '/>' +
  '</svg>';

const scrap = (x, y, w, h, fill, rot, pin) => '<g transform="rotate(' + rot + ' ' + (x + w / 2) + ' ' + (y + h / 2) + ')"><rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + fill + '" ' + ol(0.7) + '/>' +
  '<path d="' + Array.from({ length: Math.max(1, Math.floor((h - 3) / 2.4)) }, (_, i) => 'M' + (x + 1.4) + ' ' + (y + 3 + i * 2.4) + 'h' + (w - 2.8 - (i % 2) * 2)).join('') + '" stroke="#8a7a6a" stroke-width=".7"/>' +
  '<circle cx="' + (x + w / 2) + '" cy="' + (y + 1.4) + '" r="1.1" fill="' + pin + '" ' + ol(0.5) + '/></g>';
const noticeboard = '<svg viewBox="0 0 86 52" aria-hidden="true" focusable="false">' +
  '<rect x="1.5" y="1.5" width="83" height="49" rx="2" fill="#6b3f2f" ' + ol(2) + '/><rect x="5" y="5" width="76" height="42" fill="#b98a5a" ' + ol(1.2) + '/>' +
  '<g fill="#9a6d42"><circle cx="12" cy="9" r=".7"/><circle cx="30" cy="44" r=".7"/><circle cx="60" cy="8" r=".7"/><circle cx="77" cy="42" r=".7"/><circle cx="20" cy="30" r=".7"/><circle cx="70" cy="25" r=".7"/></g>' +
  scrap(7, 7.4, 13, 12, '#f2e9dc', -4, '#b3142a') + scrap(8, 22, 12, 9, '#ffb0c8', 3, '#2f5fa8') + scrap(7.6, 34, 13, 11, '#e6f0d8', -2, '#e2b04a') +
  '<g transform="rotate(-2.4 52 26)"><rect x="24" y="8" width="56" height="35" fill="#f7e27a" ' + ol(1) + '/>' +
    txt(52, 22.4, 9.2, INK, 'DO NOT FEED') + txt(52, 34.6, 9.2, '#b3142a', 'THE BAILIFF') + '<circle cx="52" cy="10.6" r="1.6" fill="#b3142a" ' + ol(0.6) + '/></g>' +
  '</svg>';

// The late Judge Osseus, Judge Mortis's predecessor, in oils. Also a skeleton.
const portrait = '<svg viewBox="0 0 42 52" aria-hidden="true" focusable="false">' +
  '<rect x="1.5" y="1.5" width="39" height="49" rx="2" fill="#c9973a" ' + ol(1.8) + '/><rect x="5" y="5" width="32" height="42" fill="#8a6420" ' + ol(1) + '/>' +
  '<g fill="#e8c878" ' + ol(0.8) + '><circle cx="3.6" cy="3.6" r="2.4"/><circle cx="38.4" cy="3.6" r="2.4"/><circle cx="3.6" cy="48.4" r="2.4"/><circle cx="38.4" cy="48.4" r="2.4"/></g>' +
  '<rect x="7" y="7" width="28" height="38" fill="#241d30"/>' +
  '<path d="M9 45c1-8 5-11 12-11s11 3 12 11z" fill="#3a1030" ' + ol(1) + '/><path d="M18 34l3 6 3-6z" fill="#f2e9dc" ' + ol(0.7) + '/>' +
  '<path d="M11 32c-3-6-2-16 1-19c4-6 14-6 18 0c3 3 4 13 1 19c-2-4-3-10-3-14h-14c0 4-1 10-3 14z" fill="#b5ada0" ' + ol(1) + '/>' +
  '<path d="M21 12c5 0 8 3.4 8 8c0 3-1 4.6-2 5.6v3c0 1-1 1.6-2 1.6h-8c-1 0-2-.6-2-1.6v-3c-1-1-2-2.6-2-5.6c0-4.6 3-8 8-8z" fill="#efe6d4" ' + ol(1) + '/>' +
  '<ellipse cx="18" cy="21" rx="2.3" ry="2.6" fill="' + INK + '"/><ellipse cx="24" cy="21" rx="2.3" ry="2.6" fill="' + INK + '"/><circle cx="18" cy="21" r=".8" fill="#6fd6ff"/><circle cx="24" cy="21" r=".8" fill="#6fd6ff"/>' +
  '<circle cx="24" cy="21" r="3.4" fill="none" stroke="#e2b04a" stroke-width=".7"/><path d="M27.3 22c1.4 3 1.6 6 .4 9" fill="none" stroke="#e2b04a" stroke-width=".5"/>' +
  '<path d="M21 23.6l-1 2.2h2z" fill="' + INK + '"/><path d="M17.6 28.4h6.8M19 27.6v1.6M21 27.6v1.6M23 27.6v1.6" stroke="' + INK + '" stroke-width=".6"/>' +
  '<rect x="15" y="43.4" width="12" height="3.2" rx=".6" fill="#e2b04a" ' + ol(0.6) + '/><path d="M16.6 45h8.8" stroke="#8a6420" stroke-width=".6" stroke-dasharray="1.4 .6"/>' +
  '</svg>';

const bench = '<svg viewBox="0 0 90 34" aria-hidden="true" focusable="false">' +
  '<path d="M6 14h78v5H6z" fill="#7a4a32" ' + ol(1.6) + '/><path d="M8 19v13M82 19v13M44 19v13" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"/><path d="M8 19v13M82 19v13M44 19v13" stroke="#5a3326" stroke-width="2" stroke-linecap="round"/>' +
  '<path d="M4 3h82v5H4z" fill="#6b3f2f" ' + ol(1.4) + '/><path d="M12 8v6M78 8v6" stroke="' + INK + '" stroke-width="2.6"/>' +
  '<path d="M54 14c0-5 3-8 8-8s8 3 8 8z" fill="#241d30" ' + ol(1.2) + '/><path d="M50 14h24" stroke="' + INK + '" stroke-width="2.4" stroke-linecap="round"/><path d="M55 11.6h14" stroke="#b3142a" stroke-width="1.4"/>' +
  '<path d="M18 14l3-4h14l-2 4z" fill="#f2e9dc" ' + ol(0.9) + '/><path d="M22 11.4h9M22 12.8h7" stroke="#8a7a6a" stroke-width=".6"/>' +
  '</svg>';

const mic = '<svg viewBox="0 0 140 40" aria-hidden="true" focusable="false">' +
  '<path d="M104 9h40v22h-40z" fill="#c9973a" ' + ol(1.8) + '/><path d="M110 9v22M118 9v22M126 9v22M134 9v22" stroke="#a87a2a" stroke-width="1.4"/><path d="M103 8c3 4 3 20 0 24" fill="#e8d7b0" ' + ol(1.4) + '/>' +
  '<path d="M44 16.4h58v7.2H44z" fill="#22222b" ' + ol(1.6) + '/><path d="M46 18.4h54" stroke="#4a4a58" stroke-width="1.2"/>' +
  '<path d="M90 13c3-2.6 9-2.6 12 0l1 14c-3 2.6-10 2.6-13 0z" fill="#c8d0b4" ' + ol(1.4) + '/><path d="M91 16.6h10M91 20h10M91 23.4h10" stroke="#8a927a" stroke-width="1"/>' +
  '<path d="M24 5l6-3.4h20l-6 3.4z" fill="#ff5a6e" ' + ol(1.2) + '/><path d="M44 5l6-3.4v30l-6 3.4z" fill="#8a0f20" ' + ol(1.2) + '/>' +
  '<rect x="24" y="5" width="20" height="30" fill="#b3142a" ' + ol(1.4) + '/><rect x="26" y="7" width="16" height="26" fill="none" stroke="#e2b04a" stroke-width=".8"/>' +
  txt(34, 18.2, 5.6, '#fff4dc', 'SHELF') + txt(34, 26.6, 5.6, '#fff4dc', 'COURT') +
  '<circle cx="13" cy="20" r="11.4" fill="#2a2a33" ' + ol(1.8) + '/><path d="M5 14l16 12M4 20l14 10M7 10l15 12M11 8l12 9M3 26l8 5M21 14L7 25M22 20L10 30M19 10L4 22M14 8.6L3.4 17" stroke="#4a4a58" stroke-width=".8"/><path d="M8 13a8 8 0 0 1 7-3" fill="none" stroke="#8a8a98" stroke-width="1.6" stroke-linecap="round"/>' +
  '</svg>';

const boom = '<svg viewBox="0 0 70 100" aria-hidden="true" focusable="false">' +
  '<path d="M66 -2L34 66" stroke="' + INK + '" stroke-width="5" stroke-linecap="round"/><path d="M66 -2L34 66" stroke="#6b6b78" stroke-width="2.6" stroke-linecap="round"/>' +
  '<g transform="rotate(-24 26 78)"><path d="M6 72l2-3 1 3 2-4 1 4 2-4 1 3 2-4 1 4 2-3 1 4 2-4 1 3 2-4 1 4 2-3 1 4 2-4 1 3 3-2-1 4 3 1-3 2 3 2-3 1 1 4-3-2-1 3-2-4-1 4-2-3-1 4-2-4-1 3-2-4-1 4-2-3-1 4-2-4-1 3-2-4-1 4-3-2 1-4-3-1 3-2-3-2 3-1z" fill="#8f8a94" ' + ol(1.4) + '/>' +
  '<path d="M12 76h28M14 80h24" stroke="#6e6a74" stroke-width="1.1"/></g>' +
  '</svg>';

export const HALL_PROPS = { vending, noticeboard, portrait, bench, mic, boom };

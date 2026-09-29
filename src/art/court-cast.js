/* The Shelf Court cast, drawn as small SVG puppets. Every portrait shares a
   120 x 140 box and the same named parts so one stylesheet can animate them
   all: .cc-eye blinks, .cc-mouth flaps while the character talks, .cc-sweat
   appears when a witness is caught near a lie, and .cc-bob floats. */

const O = 'stroke="#1a0a11" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';
const T = 'stroke="#1a0a11" stroke-width="2" stroke-linecap="round" fill="none"';
const sweat = '<g class="cc-sweat"><path d="M96 30c4 6 6 9 6 12a6 6 0 0 1-12 0c0-3 2-6 6-12z" fill="#9fd8ff" ' + O + '/><path d="M24 40c3 5 5 7 5 10a5 5 0 0 1-10 0c0-3 2-5 5-10z" fill="#9fd8ff" ' + O + '/></g>';
const blink = (cx, cy, rx, ry, fill = '#1a0a11') => '<ellipse class="cc-eye" cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + fill + '"/>';

function woodlouse(extra = '') {
  return '<g class="cc-bob">' +
    '<path d="M40 44c-6-10-12-22-8-30M80 44c6-10 12-22 8-30" ' + T + ' stroke-width="3"/>' +
    '<circle cx="32" cy="13" r="3" fill="#1a0a11"/><circle cx="88" cy="13" r="3" fill="#1a0a11"/>' +
    '<path d="M22 70l-10 4M22 86l-12 2M22 102l-10 -2M98 70l10 4M98 86l12 2M98 102l10 -2" ' + T + ' stroke-width="3"/>' +
    '<ellipse cx="60" cy="90" rx="38" ry="44" fill="#8a8795" ' + O + '/>' +
    '<path d="M24 76q36 12 72 0M23 92q37 12 74 0M26 108q34 11 68 0M34 122q26 9 52 0" ' + T + ' stroke="#5a5764"/>' +
    '<ellipse cx="60" cy="50" rx="26" ry="18" fill="#76727f" ' + O + '/>' +
    '<circle cx="50" cy="48" r="7" fill="#fff" ' + O + '/><circle cx="70" cy="48" r="7" fill="#fff" ' + O + '/>' +
    blink(51, 49, 3, 3.4) + blink(71, 49, 3, 3.4) +
    '<path class="cc-mouth" d="M53 59q7 5 14 0" fill="#3a1a24" ' + O + '/>' +
    extra + sweat + '</g>';
}

/* ---- Judge Mortis ----
   A skeleton in a full-bottomed, moth-eaten wig, sitting at his bench. The
   parts are separate groups so css/court.css can move them: .jm-jaw (also
   .cc-mouth) is hinged below the upper teeth, .jm-eyes glance, .jm-glow
   dims, .jm-lid is the socket shadow that blinks, .cc-brow holds both brow
   ridges, .jm-wig slips and hops, .jm-push is the hand that shoves it back,
   .jm-arm swings the gavel (.jm-gavel) down on .jm-block, .jm-flash is the
   impact, .jm-body drops when he sighs. Everything the bench hides in the
   studio sits below y = 114, where his own desk top is drawn for the
   portraits that show him whole. */
const ol = (w = 3) => 'stroke="#1a0a11" stroke-width="' + w + '" stroke-linejoin="round" stroke-linecap="round"';
const line = (color, w) => 'fill="none" stroke="' + color + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"';
const WIG = '#f3ede2', WIG_SHADE = '#d9cfbc', WIG_DEEP = '#ae9f86', BONE = '#efe6d4', BONE_SHADE = '#d4c7ae', BONE_DEEP = '#a8977b';
function roll(cx, cy, rx, ry, side) {
  const ex = cx + side * (rx - 4.4);
  return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + WIG + '" ' + ol(2.2) + '/>' +
    '<path d="M' + (cx - rx + 3) + ' ' + (cy + 2.6) + 'Q' + cx + ' ' + (cy + ry + 1.2) + ' ' + (cx + rx - 3) + ' ' + (cy + 2.6) + '" ' + line(WIG_SHADE, 2.4) + '/>' +
    '<path d="M' + (ex + side * 2.6) + ' ' + cy + 'a2.8 2.8 0 1 ' + (side > 0 ? 0 : 1) + ' ' + (-side * 2.8) + ' -2.6" ' + line(WIG_DEEP, 1.5) + '/>';
}
const mirror = (list, fn) => list.map(([cx, cy, rx, ry]) => fn(cx, cy, rx, ry, -1)).join('') + list.map(([cx, cy, rx, ry]) => fn(120 - cx, cy, rx, ry, 1)).join('');
const ROLLS = [[31, 99, 12, 7], [27, 86, 13, 7.5], [26, 72, 13, 7.5], [28, 58, 12, 7.5], [33, 45, 10.5, 7]];
// Rows of little powdered curls over the crown, following its dome, and a
// fringe of tight curls along its front edge.
const CROWN_CURLS = [[15.5, 14], [21.5, 22], [28, 26]].map(([y, half]) => {
  let d = '';
  for (let x = 60 - half; x < 60 + half - 2; x += 5.6) d += 'M' + x.toFixed(1) + ' ' + (y + ((x - 60) ** 2) / 70).toFixed(1) + 'q1.6-2.6 3.8-.4';
  return d;
}).join('');
const FRINGE = [[33, 42.6], [38.6, 39.4], [44.6, 37.4], [50.8, 36.2], [57, 35.6], [63, 35.6], [69.2, 36.2], [75.4, 37.4], [81.4, 39.4], [87, 42.6]];
const bonyFinger = (x, y, dx) => '<path d="M' + x + ' ' + y + 'h' + dx + '" ' + line('#1a0a11', 4.6) + '/><path d="M' + x + ' ' + y + 'h' + dx + '" ' + line(BONE, 2.6) + '/><circle cx="' + (x + dx / 2) + '" cy="' + y + '" r=".7" fill="' + BONE_DEEP + '"/>';

const judge = '<g class="cc-bob"><g class="jm-sway">' +
  // robe, scarlet collar and the lace jabot
  '<g class="jm-body">' +
    '<path d="M2 140C4 118 10 104 28 98C36 95 44 93 52 92H68C76 93 84 95 92 98C110 104 116 118 118 140Z" fill="#17101f" ' + ol() + '/>' +
    '<path d="M22 108C24 118 23 128 20 140M36 103C34 116 36 128 34 140M84 103C86 116 84 128 86 140M98 108C96 118 97 128 100 140" ' + line('#3d2f4d', 2) + '/>' +
    '<path d="M12 110C22 100 36 95 50 92L58 121L50 123C44 110 30 105 16 114Z" fill="#b3142a" ' + ol(2.4) + '/>' +
    '<path d="M108 110C98 100 84 95 70 92L62 121L70 123C76 110 90 105 104 114Z" fill="#b3142a" ' + ol(2.4) + '/>' +
    '<path d="M17 109C28 101 38 97 48 95M103 109C92 101 82 97 72 95" ' + line('#e2b04a', 1.6) + '/>' +
    '<path d="M47 113H73L77 124q-3 3.2-6 0q-3 3.2-6 0q-3 3.2-6 0q-3 3.2-6 0q-3 3.2-6 0Z" fill="#fbf6ea" ' + ol(1.8) + '/>' +
    '<path d="M48 104H72L76 114.5q-2.8 3.2-5.6 0q-2.8 3.2-5.6 0q-2.8 3.2-5.6 0q-2.8 3.2-5.6 0q-2.8 3.2-5.6 0Z" fill="#fbf6ea" ' + ol(1.8) + '/>' +
    '<path d="M50 95H70L73 105q-2.6 3-5.2 0q-2.6 3-5.2 0q-2.6 3-5.2 0q-2.6 3-5.2 0q-2.6 3-5.2 0Z" fill="#fbf6ea" ' + ol(1.8) + '/>' +
    '<g fill="#d6cab5"><circle cx="53" cy="101" r=".9"/><circle cx="57" cy="101.5" r=".9"/><circle cx="61" cy="101.5" r=".9"/><circle cx="65" cy="101.5" r=".9"/><circle cx="69" cy="101" r=".9"/>' +
    '<circle cx="51.5" cy="110.5" r=".9"/><circle cx="56" cy="111" r=".9"/><circle cx="60.5" cy="111" r=".9"/><circle cx="65" cy="111" r=".9"/><circle cx="69.5" cy="110.5" r=".9"/></g>' +
    '<rect x="50" y="89" width="20" height="6" rx="1.5" fill="#fbf6ea" ' + ol(1.8) + '/>' +
  '</g>' +
  // the head: mouth cavity, hinged jaw, skull, eyes, lids, brows, wig
  '<g class="jm-head">' +
    '<path d="M46 75h28v15q-14 6-28 0z" fill="#2a0d16"/>' +
    '<g class="cc-mouth jm-jaw">' +
      '<path d="M41 67C40 80 44 92 52 96C56 98 64 98 68 96C76 92 80 80 79 67L74 69C73 76 71 81 67 82L53 82C49 81 47 76 46 69Z" fill="' + BONE + '" ' + ol(2.6) + '/>' +
      '<path d="M46 87Q60 97 74 87" ' + line(BONE_SHADE, 2.2) + '/><circle cx="49" cy="88" r="1" fill="#1a0a11"/><circle cx="71" cy="88" r="1" fill="#1a0a11"/>' +
      '<path d="M49 81h22v5q-11 3.2-22 0z" fill="#fbf3e3" ' + ol(1.8) + '/><path d="M53.4 81v5.6M57.8 81v6M62.2 81v6M66.6 81v5.6" ' + line('#1a0a11', 1.3) + '/>' +
    '</g>' +
    '<path d="M60 21C77 21 86 33 86 49C86 55 84 58 85 62C86 67 82 70 77 70C76 74 74 77 72 79L48 79C46 77 44 74 43 70C38 70 34 67 35 62C36 58 34 55 34 49C34 33 43 21 60 21Z" fill="' + BONE + '" ' + ol(2.8) + '/>' +
    '<path d="M37.5 47Q41 56 38.5 63M82.5 47Q79 56 81.5 63" ' + line(BONE_SHADE, 2.4) + '/>' +
    '<path d="M40 67Q46 63 52 65.5M68 65.5Q74 63 80 67" ' + line(BONE_DEEP, 1.8) + '/>' +
    '<path d="M76.5 26l-3 5 3 3-2.5 5" ' + line('#1a0a11', 1.3) + '/>' +
    '<path d="M41 55C41 48 46 46 50 46C55 46 58 49 57 55C57 61 53 63 49 63C44 63 41 60 41 55Z" fill="#1a0a11"/>' +
    '<path d="M79 55C79 48 74 46 70 46C65 46 62 49 63 55C63 61 67 63 71 63C76 63 79 60 79 55Z" fill="#1a0a11"/>' +
    '<path d="M60 62C57 66 55 69 56 71C57 72.5 59 71.5 60 70C61 71.5 63 72.5 64 71C65 69 63 66 60 62Z" fill="#1a0a11"/>' +
    '<path d="M47 75.5h26v5.5q-13 3.2-26 0z" fill="#fbf3e3" ' + ol(1.8) + '/><path d="M51.3 75.5v6M55.6 75.5v6.6M60 75.5v6.8M64.4 75.5v6.6M68.7 75.5v6" ' + line('#1a0a11', 1.3) + '/>' +
    '<g class="jm-eyes">' +
      '<g class="jm-pupil jm-pupil-l"><circle class="jm-glow" cx="49" cy="55" r="6.2" fill="#ff3b4e" opacity=".3"/><circle cx="49" cy="55" r="3" fill="#ff5a6e"/><circle cx="48" cy="54" r="1.2" fill="#ffe3e6"/></g>' +
      '<g class="jm-pupil jm-pupil-r"><circle class="jm-glow" cx="71" cy="55" r="6.2" fill="#ff3b4e" opacity=".3"/><circle cx="71" cy="55" r="3" fill="#ff5a6e"/><circle cx="70" cy="54" r="1.2" fill="#ffe3e6"/></g>' +
    '</g>' +
    '<path class="jm-lid" d="M41 55C41 48 46 46 50 46C55 46 58 49 57 55C57 61 53 63 49 63C44 63 41 60 41 55ZM79 55C79 48 74 46 70 46C65 46 62 49 63 55C63 61 67 63 71 63C76 63 79 60 79 55Z" fill="#0b0407"/>' +
    '<g class="cc-brow">' +
      '<path class="jm-brow jm-brow-l" d="M38 50C40 43 48 40 57 44L56.5 48C50 45 44 46 40 52Z" fill="' + BONE + '" ' + ol(2) + '/>' +
      '<path class="jm-brow jm-brow-r" d="M82 50C80 43 72 40 63 44L63.5 48C70 45 76 46 80 52Z" fill="' + BONE + '" ' + ol(2) + '/>' +
    '</g>' +
    '<g class="jm-wig">' +
      // the queue, tied with a black ribbon, hangs down behind the right curls
      '<path d="M93 42C104 48 110 62 107 78C105 88 108 95 112 99" ' + line('#1a0a11', 8) + '/><path d="M93 42C104 48 110 62 107 78C105 88 108 95 112 99" ' + line(WIG, 4.6) + '/>' +
      '<path d="M101 55l4 1.5M105 65l4 .5M105.5 75l4-.5M105 85l4-1" ' + line(WIG_DEEP, 1.4) + '/>' +
      '<circle cx="112.5" cy="100" r="3.6" fill="' + WIG + '" ' + ol(1.8) + '/>' +
      '<path d="M98 40c5-9 16-9 15-1c-1 6-10 5-15 1zM98 40c8 1 15 8 10 13c-4 4-9-4-10-13z" fill="#120c18" ' + ol(1.8) + '/><path d="M98 40l3 16 2-3 3 2z" fill="#120c18" ' + ol(1.4) + '/><circle cx="98" cy="40" r="3" fill="#2a2036" ' + ol(1.6) + '/>' +
      // the wig's mass, then its curls from the bottom up
      '<path d="M41 36C27 40 17 60 16 80C15 96 19 104 26 107L43 104C42 88 40 68 42 48Z" fill="' + WIG_SHADE + '" ' + ol(2.2) + '/>' +
      '<path d="M79 36C93 40 103 60 104 80C105 96 101 104 94 107L77 104C78 88 80 68 78 48Z" fill="' + WIG_SHADE + '" ' + ol(2.2) + '/>' +
      mirror(ROLLS, roll) +
      '<path d="M29 46C26 22 42 9 60 9C78 9 94 22 91 46C84 39 72 35 60 35C48 35 36 39 29 46Z" fill="' + WIG + '" ' + ol(2.6) + '/>' +
      '<path d="' + CROWN_CURLS + '" ' + line(WIG_SHADE, 1.5) + '/><path d="M60 11V33" ' + line(WIG_SHADE, 1.6) + '/>' +
      '<g fill="' + WIG + '" ' + ol(1.6) + '>' + FRINGE.map(([x, y]) => '<circle cx="' + x + '" cy="' + y + '" r="3.1"/>').join('') + '</g>' +
      '<g ' + line(WIG_DEEP, 1.1) + '>' + FRINGE.map(([x, y]) => '<path d="M' + (x + 1.3) + ' ' + (y - .4) + 'a1.3 1.3 0 1 0-1.3 1.3"/>').join('') + '</g>' +
      // moth damage: two holes, a nibbled curl and a loose thread
      '<path d="M69 17c2.5-1.5 5 .5 4 3c-1 2.4-4.5 2.2-5 0c-.3-1.2 0-2.3 1-3z" fill="#3a2830"/><circle cx="45" cy="27" r="1.6" fill="#3a2830"/>' +
      '<path d="M96 72c1.5-2 4-2 4.5.3c.4 2-2 3.4-3.8 2.4z" fill="#3a2830"/><path d="M15 86l-3 2M16 89l-3.4.6" ' + line(WIG_DEEP, 1.2) + '/>' +
    '</g>' +
  '</g>' +
  // his desk, which the studio bench covers
  '<g class="jm-desk"><path d="M0 114H120V140H0Z" fill="#6b3f2f" ' + ol(2.4) + '/><path d="M0 114H120V119.5H0Z" fill="#8a5a44" ' + ol(2.4) + '/><path d="M10 125H110V140" ' + line('#4a2a1f', 2) + '/><rect x="48" y="123" width="24" height="7" rx="1.5" fill="#e2b04a" ' + ol(1.6) + '/></g>' +
  // the sounding block, and the flash when the gavel lands on it
  '<g class="jm-block"><path d="M1 108v5c0 2 4 3.2 9 3.2s9-1.2 9-3.2v-5z" fill="#4a2a1f" ' + ol(2) + '/><ellipse cx="10" cy="108" rx="9" ry="2.8" fill="#8a5a44" ' + ol(2) + '/></g>' +
  '<path class="jm-flash" d="M10 96l2.4 6 6-3-3.4 5.4 6.6 1.2-6.6 1.8 2.6 5-5.6-3.2-2 6-2-6-5.6 3.2 2.6-5-6.6-1.8 6.6-1.2-3.4-5.4 6 3z" fill="#fff4c4" ' + ol(1.4) + '/>' +
  // the free hand, drumming its finger bones on the desk
  '<g class="jm-hand">' +
    '<path d="M117 116C116 110 112 105 105 103L97 105L99 116Z" fill="#17101f" ' + ol(2.2) + '/><path d="M108 107Q111 111 111 116" ' + line('#3d2f4d', 1.4) + '/>' +
    '<path d="M99 103.4q-2.6 1.4-2 4q-2 2 0 4.4q0 2.4 2.6 3.4l3-.4l-.6-11.6z" fill="#fbf6ea" ' + ol(1.5) + '/>' +
    '<path d="M86 105C90 103 95 104 97 106L97 113C93 115 89 115 86 113Z" fill="' + BONE + '" ' + ol(1.8) + '/>' +
    '<g class="jm-f jm-f1">' + bonyFinger(86, 106.2, -9) + '</g><g class="jm-f jm-f2">' + bonyFinger(86, 109.2, -10) + '</g><g class="jm-f jm-f3">' + bonyFinger(86, 112.2, -8.5) + '</g>' +
  '</g>' +
  // the gavel arm: a forearm propped on the desk, lace cuff, the gavel, the fist
  '<g class="jm-arm">' +
    '<path d="M19 116C20 109 23 104 27 100L38 101C41 106 42 111 42 116Z" fill="#17101f" ' + ol(2.4) + '/><path d="M33 104Q36 110 35 116" ' + line('#3d2f4d', 1.5) + '/>' +
    '<path d="M25 101.6q1-3.4 4-2.6q2.6-2.4 5.2 0q3-.8 3.8 2.4l-1 2.6q-3 1.4-5.6 0q-3 1.4-5.6 0z" fill="#fbf6ea" ' + ol(1.5) + '/>' +
    '<g class="jm-gavel">' +
      '<path d="M26 97.6L12 97" ' + line('#1a0a11', 5.6) + '/><path d="M26 97.6L12 97" ' + line('#8b5a3c', 3) + '/>' +
      '<rect x="2" y="88" width="16" height="18" rx="3" fill="#7a4a32" ' + ol(2.2) + '/><path d="M2.5 91.5h15M2.5 102.5h15" ' + line('#e2b04a', 2.2) + '/><path d="M6 94v6" ' + line('#a8704c', 1.6) + '/>' +
    '</g>' +
    '<path d="M22 93C25 91 30 91 31 94L31 101C29 104 25 104 22 102Z" fill="' + BONE + '" ' + ol(1.8) + '/>' +
    '<g fill="' + BONE + '" ' + ol(1.4) + '><ellipse cx="21.5" cy="94.4" rx="2.2" ry="1.7"/><ellipse cx="21" cy="97.6" rx="2.2" ry="1.7"/><ellipse cx="21" cy="100.8" rx="2.2" ry="1.7"/></g>' +
    '<path d="M29 93q-4-3-8-.6" ' + line('#1a0a11', 4.2) + '/><path d="M29 93q-4-3-8-.6" ' + line(BONE, 2.2) + '/>' +
  '</g>' +
  // the hand that shoves the wig back when it slips
  '<g class="jm-push">' +
    '<path d="M104 92C104 84 100 78 96 76L90 80C93 84 95 88 95 94Z" fill="#17101f" ' + ol(2) + '/>' +
    '<path d="M89 78q3-3 8-2l2 4q-4 2-8 1z" fill="#fbf6ea" ' + ol(1.4) + '/>' +
    '<path d="M88 76C87 71 89 67 94 66C98 67 99 71 98 75Z" fill="' + BONE + '" ' + ol(1.6) + '/>' +
    '<path d="M89 67l-1.5-8M92 66l-.5-9M95 66.5l.5-8.5M97.5 68l1.5-7" ' + line('#1a0a11', 3.6) + '/><path d="M89 67l-1.5-8M92 66l-.5-9M95 66.5l.5-8.5M97.5 68l1.5-7" ' + line(BONE, 1.8) + '/>' +
  '</g>' +
  '</g></g>';

/* ---- Bailiff Rattigan ----
   A rat in a uniform bought for a bigger rat: cap on his eyebrows, cuffs over
   his paws, trousers round his feet. He keeps a notebook, a whistle on a cord
   and a raisin he should not have. Arms come in three poses (.rb-arm-rest,
   .rb-arm-salute, .rb-arm-chomp) that the stylesheet swaps; .rb-tail swishes,
   .rb-whisk twitches, .rb-ear flicks, .rb-jump lifts him off the floor. */
const FUR = '#a59aa8', FUR_SHADE = '#83788a', NAVY = '#2b3670', NAVY_DARK = '#1b2250', PINK = '#ff9fc0', BRASS = '#e2b04a';
const raisin = (cx, cy, s = 1) => '<g><ellipse cx="' + cx + '" cy="' + cy + '" rx="' + 4 * s + '" ry="' + 3.4 * s + '" fill="#4a1e3a" ' + ol(1.4) + '/><path d="M' + (cx - 2 * s) + ' ' + (cy - 1 * s) + 'q' + 2 * s + ' ' + 1.4 * s + ' ' + 4 * s + ' 0M' + (cx - 1.6 * s) + ' ' + (cy + 1.2 * s) + 'q' + 1.6 * s + ' -1 ' + 3 * s + ' 0" ' + line('#7a3a62', 1) + '/></g>';
const button = (cx, cy) => '<circle cx="' + cx + '" cy="' + cy + '" r="2.6" fill="' + BRASS + '" ' + ol(1.4) + '/><circle cx="' + (cx - .8) + '" cy="' + (cy - .8) + '" r=".8" fill="#fff4c4"/>';
const paw = (x, y) => '<path d="M' + x + ' ' + y + 'c-1 3 1 5.4 4 5.4s4.6-2.6 3.6-5.4" fill="' + PINK + '" ' + ol(1.5) + '/>';

const rat = '<g class="cc-bob"><g class="rb-jump">' +
  '<g class="rb-tail"><path d="M88 124C104 130 116 122 113 107C111 96 101 95 104 85C106 78 113 78 115 83" ' + line('#1a0a11', 7.4) + '/><path d="M88 124C104 130 116 122 113 107C111 96 101 95 104 85C106 78 113 78 115 83" ' + line(PINK, 4.6) + '/>' +
    '<path d="M98 126.4l.4-3M106 124.4l-1-2.8M111 117l-2.8-1M112 107l-3 .4M106 97l-2.6 1.4" ' + line('#e07aa0', 1.1) + '/></g>' +
  // trousers pooling over his feet
  '<path d="M34 124H57L58 138H31Z" fill="' + NAVY + '" ' + ol(2.4) + '/><path d="M63 124H86L89 138H62Z" fill="' + NAVY + '" ' + ol(2.4) + '/>' +
  '<path d="M37 126v10M84 126v10" ' + line(BRASS, 1.6) + '/>' +
  '<path d="M28 139q3-4 6-.5q3-3.4 5.6 0M81 139q3-4 6-.5q3-3.4 5.6 0" fill="' + PINK + '" ' + ol(1.4) + '/>' +
  // the tunic, too big everywhere
  '<g class="rb-body">' +
    '<path d="M29 86C20 90 18 102 20 118L23 128H97L100 118C102 102 100 90 91 86C80 81 40 81 29 86Z" fill="' + NAVY + '" ' + ol(2.6) + '/>' +
    '<path d="M60 90V128M30 98q2 12 0 24M90 98q-2 12 0 24" ' + line(NAVY_DARK, 1.8) + '/>' +
    '<path d="M21 117H99V124H21Z" fill="#1a1426" ' + ol(2) + '/><rect x="54" y="116" width="12" height="9" rx="1.5" fill="' + BRASS + '" ' + ol(1.6) + '/><rect x="57.5" y="118.5" width="5" height="4" fill="#1a1426"/>' +
    button(60, 95) + button(60, 104) + button(60, 112) +
    '<path d="M18 90q9-6 18-1l-1 4H19z" fill="' + BRASS + '" ' + ol(1.6) + '/><path d="M102 90q-9-6-18-1l1 4h16z" fill="' + BRASS + '" ' + ol(1.6) + '/>' +
    '<path d="M20 93v3M23.5 93v3.4M27 93v3.4M30.5 93v3M100 93v3M96.5 93v3.4M93 93v3.4M89.5 93v3" ' + line(BRASS, 1.4) + '/>' +
    '<path d="M38 104h13v10h-13z" fill="' + NAVY_DARK + '" ' + ol(1.4) + '/><path d="M38 104h13l-1 3.4h-11z" fill="' + NAVY + '" ' + ol(1.4) + '/>' +
    '<path d="M31 90C33 98 38 103 43 104.5" ' + line(BRASS, 1.5) + '/>' +
    '<path d="M40 102.5h7a3.4 3.4 0 0 1 0 6.8h-4.6l-3-2.4z" fill="#cfd7e0" ' + ol(1.4) + '/><circle cx="46.6" cy="105.9" r="1" fill="#1a0a11"/>' +
    '<path d="M44 80H76L74 89H46Z" fill="' + NAVY_DARK + '" ' + ol(2) + '/><path d="M45.5 86.5H74.5" ' + line(BRASS, 1.4) + '/>' +
    '<path d="M53 84l2.4 3.6 2.4-3.4 2.2 3.8 2.4-3.8 2.2 3.4 2.4-3.6" fill="' + FUR + '" ' + ol(1.2) + '/>' +
  '</g>' +
  // arms at rest: a raisin down by his side, the notebook held up proudly
  '<g class="rb-arm rb-arm-rest">' +
    '<path d="M29 88C21 92 17 104 17 116L29 119C29 108 31 99 36 93Z" fill="' + NAVY + '" ' + ol(2.4) + '/><path d="M17 113.6L29 116.4" ' + line(BRASS, 1.6) + '/>' +
    paw(19, 118) + raisin(20.4, 124.6, .9) +
    '<path d="M91 88C101 92 102 101 96 106L86 110L82 104L91 99C93 97 91 93 86 92Z" fill="' + NAVY + '" ' + ol(2.4) + '/>' +
    '<g class="rb-notebook"><rect x="72" y="96" width="15" height="19" rx="2" fill="#7a1a2a" ' + ol(1.8) + '/><path d="M85.6 97.4v16.4" ' + line('#f2e9dc', 1.8) + '/><rect x="74.6" y="99" width="7.4" height="4.4" rx=".8" fill="#f2e9dc"/><path d="M72.4 108.6h13" ' + line('#1a0a11', 1.2) + '/><path d="M74 96l-2.4-5 1.4-.6 2.6 5" fill="' + BRASS + '" ' + ol(1) + '/></g>' +
    paw(79, 104) +
  '</g>' +
  // the head: ears, fur, eyes, monocle, whiskers, nose, incisors, the cap
  '<g class="rb-head">' +
    '<g class="rb-ear rb-ear-l"><circle cx="27" cy="27" r="14" fill="' + FUR + '" ' + ol(2.6) + '/><circle cx="27" cy="27.6" r="9.4" fill="#ffabc8"/><path d="M19.6 31c-.6-6 3.4-10.6 9-10.4c-4.4 1.8-7 5.4-7 10.4z" fill="#e37aa0"/></g>' +
    '<g class="rb-ear rb-ear-r"><circle cx="93" cy="27" r="14" fill="' + FUR + '" ' + ol(2.6) + '/><circle cx="93" cy="27.6" r="9.4" fill="#ffabc8"/><path d="M100.4 31c.6-6-3.4-10.6-9-10.4c4.4 1.8 7 5.4 7 10.4z" fill="#e37aa0"/></g>' +
    '<path d="M60 26C79 26 89 38 89 52C89 60 84 66 78 70C72 76 66 82 60 84C54 82 48 76 42 70C36 66 31 60 31 52C31 38 41 26 60 26Z" fill="' + FUR + '" ' + ol(2.8) + '/>' +
    '<path d="M32 55l-4.6 2.6 4 1.6-4 3.4 5.4.6M88 55l4.6 2.6-4 1.6 4 3.4-5.4.6" fill="' + FUR + '" ' + ol(1.6) + '/>' +
    '<path d="M36 64q6 6 10 6M84 64q-6 6-10 6" ' + line(FUR_SHADE, 1.8) + '/>' +
    '<path d="M47 63C52 59 68 59 73 63C71 73 65 81 60 82.6C55 81 49 73 47 63Z" fill="#c9bfcc"/>' +
    '<g class="rb-look"><g class="cc-eye"><circle cx="49" cy="52" r="4.4" fill="#1a0a11"/><circle cx="47.6" cy="50.6" r="1.4" fill="#fff"/></g><g class="cc-eye"><circle cx="71" cy="52" r="4.4" fill="#1a0a11"/><circle cx="69.6" cy="50.6" r="1.4" fill="#fff"/></g></g>' +
    '<circle cx="71" cy="52" r="7.6" fill="#ffffff" fill-opacity=".14" stroke="' + BRASS + '" stroke-width="2.4"/><path d="M78 55C84 62 86 72 82 84" ' + line(BRASS, 1.3) + ' stroke-dasharray="1.6 1.4"/>' +
    '<g class="rb-cheeks"><circle cx="41" cy="67" r="6" fill="' + FUR + '" ' + ol(1.8) + '/><circle cx="79" cy="67" r="6" fill="' + FUR + '" ' + ol(1.8) + '/></g>' +
    '<g class="rb-whisk rb-whisk-l"><path d="M51 72L24 64M51 74.5L22 74M51.6 77L25 84" ' + line('#1a0a11', 1.3) + '/></g>' +
    '<g class="rb-whisk rb-whisk-r"><path d="M69 72L96 64M69 74.5L98 74M68.4 77L95 84" ' + line('#1a0a11', 1.3) + '/></g>' +
    '<path d="M53 79.6q7 3 14 0l-1.4 6.4q-5.6 3.4-11.2 0z" fill="#5a2436" ' + ol(1.4) + '/>' +
    '<g class="cc-mouth rb-teeth"><path d="M56.4 80.4h7.2v6.6q-.6 1.6-2 1.6h-3.2q-1.4 0-2-1.6z" fill="#f2d68e" ' + ol(1.5) + '/><path d="M60 80.6v7.8" ' + line('#1a0a11', 1.1) + '/></g>' +
    '<path class="rb-nose" d="M55 75.4C55 72.6 65 72.6 65 75.4C65 78.6 62 80.6 60 80.6C58 80.6 55 78.6 55 75.4Z" fill="#ff8fb8" ' + ol(1.8) + '/><circle cx="58" cy="74.6" r=".9" fill="#fff"/>' +
    '<g class="rb-cap">' +
      '<path d="M33 30C31 15 45 8 60 8C75 8 89 15 87 30Z" fill="' + NAVY + '" ' + ol(2.4) + '/>' +
      '<path d="M41 14q19-7 38 0" ' + line('#3d4a8c', 1.8) + '/>' +
      '<path d="M33 28.5H87V35H33Z" fill="#141a3c" ' + ol(2) + '/><path d="M33 31.6H87" ' + line(BRASS, 1.2) + ' stroke-dasharray="3 2"/>' +
      '<path d="M60 12.4l6.4 2.6v5c0 4.6-3.4 7.6-6.4 8.6c-3-1-6.4-4-6.4-8.6v-5z" fill="' + BRASS + '" ' + ol(1.6) + '/><circle cx="60" cy="19.6" r="2.2" fill="#8a5a1a"/>' +
      '<path d="M31 35C44 31 76 31 89 35C88 43 32 43 31 35Z" fill="#0f0c18" ' + ol(2.2) + '/><path d="M40 37.6Q60 35 80 37.6" ' + line('#4a4870', 1.4) + '/>' +
    '</g>' +
    '<path d="M55.6 41.6l1.6 4 1.8-3.2 1.4 3.6 1.6-3.4 1.6 3 1.2-3.8" fill="' + FUR + '" ' + ol(1.2) + '/>' +
    '<g class="cc-sweat"><path d="M38 40c3 4.6 4.4 7 4.4 9a4.4 4.4 0 0 1-8.8 0c0-2 1.4-4.4 4.4-9z" fill="#9fd8ff" ' + ol(1.8) + '/><path d="M86 42c2.4 3.8 3.6 5.6 3.6 7.2a3.6 3.6 0 0 1-7.2 0c0-1.6 1.2-3.4 3.6-7.2z" fill="#9fd8ff" ' + ol(1.8) + '/></g>' +
  '</g>' +
  // the salute, the raisin still in his paw
  '<g class="rb-arm rb-arm-salute">' +
    '<path d="M29 88C20 86 12 80 11 72C10 64 20 52 32 43L38 48C30 56 22 64 23 70C24 76 30 80 35 83Z" fill="' + NAVY + '" ' + ol(2.4) + '/><path d="M31 44l6 5" ' + line(BRASS, 1.6) + '/>' +
    '<path d="M33 43C35 37 41 34 46 35C47 38 43 43 38 46Z" fill="' + PINK + '" ' + ol(1.5) + '/>' + raisin(31, 40, .8) +
  '</g>' +
  // both paws up at his mouth with the evidence
  '<g class="rb-arm rb-arm-chomp">' +
    '<path d="M29 88C21 92 22 100 30 99L47 91L44 86Z" fill="' + NAVY + '" ' + ol(2.4) + '/><path d="M91 88C99 92 98 100 90 99L73 91L76 86Z" fill="' + NAVY + '" ' + ol(2.4) + '/>' +
    raisin(60, 88.4, 1.1) + paw(49, 85) + paw(64, 85) +
  '</g>' +
  '</g></g>';

export const COURT_ART = {
  judge,
  rat,
  woodlouse: woodlouse('<g><rect x="84" y="96" width="20" height="16" rx="4" fill="#f2c94c" ' + O + '/><path d="M94 104h14" ' + T + '/></g>'),
  woodlouse2: woodlouse('<g><rect x="46" y="16" width="28" height="20" fill="#120c18" ' + O + '/><rect x="38" y="34" width="44" height="6" rx="2" fill="#120c18" ' + O + '/><rect x="46" y="28" width="28" height="4" fill="#6b1422"/></g><path d="M24 84q36 12 72 0" stroke="#120c18" stroke-width="7" fill="none"/>'),
  moth: '<g class="cc-bob">' +
    '<g class="cc-wing cc-wing-l"><path d="M56 66C38 20 0 14 4 50c3 26 28 32 52 26zM56 80c-22 6-38 28-26 42 12 12 28-10 28-34z" fill="#b9a488" ' + O + '/><circle cx="28" cy="48" r="10" fill="#7a5b44" ' + O + '/><circle cx="28" cy="48" r="3.4" fill="#f2e9dc"/><path d="M14 36q10 4 16 22" ' + T + ' stroke="#8d7358"/></g>' +
    '<g class="cc-wing cc-wing-r"><path d="M64 66C82 20 120 14 116 50c-3 26-28 32-52 26zM64 80c22 6 38 28 26 42-12 12-28-10-28-34z" fill="#b9a488" ' + O + '/><circle cx="92" cy="48" r="10" fill="#7a5b44" ' + O + '/><circle cx="92" cy="48" r="3.4" fill="#f2e9dc"/><path d="M106 36q-10 4-16 22" ' + T + ' stroke="#8d7358"/></g>' +
    '<ellipse cx="60" cy="84" rx="13" ry="24" fill="#d9c8a8" ' + O + '/><path d="M49 80h22M50 90h20" ' + T + ' stroke="#a8937a"/>' +
    '<path d="M52 20q-10-6-16 2M68 20q10-6 16 2" ' + T + ' stroke-width="3"/><path d="M46 14l-2 6M50 12l0 6M70 12l0 6M74 14l2 6" ' + T + '/>' +
    '<circle cx="60" cy="42" r="17" fill="#e6d7ba" ' + O + '/>' +
    '<circle cx="52" cy="40" r="6" fill="#1a0a11"/><circle cx="68" cy="40" r="6" fill="#1a0a11"/>' + blink(54, 38, 1.8, 1.8, '#fff') + blink(70, 38, 1.8, 1.8, '#fff') +
    '<path d="M44 32l10 3M76 32l-10 3" ' + T + '/>' +
    '<ellipse class="cc-mouth" cx="60" cy="51" rx="4" ry="2.4" fill="#6b1422" ' + O + '/>' +
    '<g fill="#fff8f0" stroke="#1a0a11" stroke-width="1.2"><circle cx="48" cy="62" r="3"/><circle cx="54" cy="65" r="3"/><circle cx="60" cy="66" r="3"/><circle cx="66" cy="65" r="3"/><circle cx="72" cy="62" r="3"/></g>' +
    sweat + '</g>',
  lamp: '<g class="cc-bob">' +
    '<circle class="cc-glow" cx="60" cy="54" r="54" fill="#ffd98a" opacity=".22"/>' +
    '<rect x="55" y="80" width="10" height="44" fill="#6b4a36" ' + O + '/><ellipse cx="60" cy="128" rx="28" ry="8" fill="#6b4a36" ' + O + '/>' +
    '<path d="M32 22h56l18 58H14z" fill="#eab86c" ' + O + '/>' +
    '<path d="M20 86v6M30 86v8M40 86v6M50 86v8M60 86v6M70 86v8M80 86v6M90 86v8M100 86v6" ' + T + ' stroke="#8a2b3a" stroke-width="3"/>' +
    '<path d="M16 80h88" stroke="#8a2b3a" stroke-width="6"/>' +
    '<path d="M38 50q8-6 16 0M66 50q8-6 16 0" ' + T + ' stroke-width="3"/>' +
    blink(46, 54, 4, 3) + blink(74, 54, 4, 3) +
    '<ellipse class="cc-mouth" cx="60" cy="68" rx="6" ry="3.4" fill="#6b1422" ' + O + '/>' +
    sweat + '</g>',
  cat: '<g class="cc-bob">' +
    '<path d="M18 140c0-30 18-44 42-44s42 14 42 44z" fill="#d9822f" ' + O + '/>' +
    '<path d="M24 20l12 34 30-16zM96 20L84 54 54 38z" fill="#d9822f" ' + O + '/><path d="M30 30l8 18 12-8zM90 30l-8 18-12-8z" fill="#ffb0c8"/>' +
    '<ellipse cx="60" cy="66" rx="40" ry="34" fill="#e0893a" ' + O + '/>' +
    '<path d="M60 34v12M50 36l2 10M70 36l-2 10M22 64h10M22 74h10M88 64h10M88 74h10" ' + T + ' stroke="#a8541f" stroke-width="3.4"/>' +
    '<path d="M36 58q10-8 20 0q-10 6-20 0zM64 58q10-8 20 0q-10 6-20 0z" fill="#a8e06a" ' + O + '/>' +
    blink(46, 58, 1.6, 4.6) + blink(74, 58, 1.6, 4.6) +
    '<path d="M34 53q12-6 24 2M62 55q12-8 24-2" fill="#e0893a" stroke="#1a0a11" stroke-width="2.4"/>' +
    '<path d="M56 70h8l-4 5z" fill="#ff8fb8" ' + O + '/>' +
    '<path class="cc-mouth" d="M50 78q5 5 10 0q5 5 10 0" fill="#6b1422" ' + O + '/>' +
    '<path d="M42 74l-26-4M42 78l-26 4M78 74l26-4M78 78l26 4" ' + T + ' stroke-width="1.5"/>' +
    '<path d="M28 98q32 12 64 0" stroke="#a32c3c" stroke-width="8" fill="none"/><circle cx="60" cy="110" r="8" fill="#f2c94c" ' + O + '/><path d="M60 110v6" ' + T + '/>' +
    sweat + '</g>',
  ghost: '<g class="cc-bob">' +
    '<path d="M24 130c-2-40 2-92 36-96 34 4 38 56 36 96l-9-8-9 8-9-8-9 8-9-8-9 8-9-8z" fill="#eef0f7" ' + O + '/>' +
    '<ellipse cx="60" cy="30" rx="30" ry="6" fill="#221a2b" ' + O + '/><path d="M42 30c0-18 36-18 36 0z" fill="#221a2b" ' + O + '/>' +
    blink(48, 62, 5, 8) + blink(72, 62, 5, 8) +
    '<ellipse class="cc-mouth" cx="60" cy="84" rx="6" ry="7" fill="#1a0a11"/>' +
    '<g><rect x="84" y="78" width="26" height="34" rx="3" fill="#8b5a3c" ' + O + '/><rect x="88" y="84" width="18" height="24" fill="#fbf6ea"/><path d="M91 90h12M91 96h12M91 102h8" ' + T + ' stroke-width="1.4"/><rect x="92" y="75" width="10" height="6" rx="2" fill="#c9c2b6" ' + O + '/></g>' +
    sweat + '</g>',
  uncle: '<g class="cc-bob">' +
    '<ellipse cx="60" cy="128" rx="40" ry="10" fill="#6b1422" ' + O + '/>' +
    '<path d="M60 30c-26 0-40 18-40 40 0 14 8 22 14 28v18h52V98c6-6 14-14 14-28 0-22-14-40-40-40z" fill="#eadfbf" ' + O + '/>' +
    '<path d="M76 38l-6 12 6 6" ' + T + '/>' +
    '<ellipse cx="46" cy="70" rx="10" ry="11" fill="#1a0a11"/><ellipse cx="74" cy="70" rx="10" ry="11" fill="#1a0a11"/>' +
    blink(46, 71, 3, 3, '#ffd98a') + blink(74, 71, 3, 3, '#ffd98a') +
    '<path d="M60 80l-5 9h10z" fill="#1a0a11"/>' +
    '<g class="cc-mouth"><rect x="42" y="98" width="36" height="12" rx="3" fill="#eadfbf" ' + O + '/><rect x="48" y="99" width="6" height="8" fill="#1a0a11"/><rect x="62" y="99" width="5" height="8" fill="#1a0a11"/></g>' +
    '<g transform="rotate(-10 60 30)"><ellipse cx="60" cy="34" rx="34" ry="7" fill="#e8c878" ' + O + '/><path d="M40 34v-14h40v14z" fill="#e8c878" ' + O + '/><rect x="40" y="24" width="40" height="6" fill="#1a0a11"/></g>' +
    sweat + '</g>',
  raven: '<g class="cc-bob">' +
    '<path d="M46 132l-6 8M60 132l6 8" ' + T + ' stroke-width="4"/>' +
    '<path d="M100 120c-10 12-44 14-60 4-16-10-18-40-6-58 10-16 34-24 50-14 16 10 26 50 16 68z" fill="#1f1b29" ' + O + '/>' +
    '<path d="M86 70q18 18 12 46M76 80q12 14 8 34" ' + T + ' stroke="#3d3650" stroke-width="3"/>' +
    '<circle cx="52" cy="44" r="22" fill="#1f1b29" ' + O + '/>' +
    '<path d="M34 40L6 50l28 6z" fill="#4a4456" ' + O + '/><path class="cc-mouth" d="M34 52L10 54l24 6z" fill="#3a3444" ' + O + '/>' +
    '<circle cx="48" cy="38" r="6" fill="#fff"/>' + blink(46, 38, 2.6, 2.6) +
    '<path d="M40 30l14-4" ' + T + ' stroke="#fff" stroke-width="2"/>' +
    '<path d="M58 66q20 20 44 34" stroke="#8b5a3c" stroke-width="5" fill="none"/><rect x="88" y="94" width="24" height="18" rx="3" fill="#8b5a3c" ' + O + '/><path d="M92 98l8 6 8-6" ' + T + ' stroke="#fbf6ea"/>' +
    sweat + '</g>',
  widow: '<g class="cc-bob">' +
    '<path d="M22 140c4-30 14-52 38-52s34 22 38 52z" fill="#140e1a" ' + O + '/>' +
    '<path d="M50 90l10 14 10-14" fill="none" stroke="#f2e9dc" stroke-width="2"/>' +
    '<ellipse cx="60" cy="62" rx="22" ry="26" fill="#efe4e6" ' + O + '/>' +
    '<path class="cc-eye" d="M44 60q6 5 12 0M64 60q6 5 12 0" ' + T + ' stroke-width="3"/>' +
    '<path class="cc-tear" d="M48 66c2 4 3 6 3 8a3 3 0 0 1-6 0c0-2 1-4 3-8z" fill="#9fd8ff"/><path class="cc-tear cc-tear-2" d="M72 66c2 4 3 6 3 8a3 3 0 0 1-6 0c0-2 1-4 3-8z" fill="#9fd8ff"/>' +
    '<path class="cc-mouth" d="M52 78q8-5 16 0" fill="none" stroke="#6b1422" stroke-width="3" stroke-linecap="round"/>' +
    '<ellipse cx="60" cy="38" rx="46" ry="9" fill="#140e1a" ' + O + '/><path d="M36 38c0-22 48-22 48 0z" fill="#140e1a" ' + O + '/>' +
    '<path d="M16 40q44 70 88 0" fill="#140e1a" opacity=".38"/><path d="M26 50l68 0M22 60h76M30 70h60M26 44l20 40M44 44l12 44M76 44l-12 44M94 44l-20 40" stroke="#140e1a" stroke-width="1" opacity=".55"/>' +
    '<g><path d="M86 110l18-6 4 12-18 6z" fill="#fbf6ea" ' + O + '/></g>' +
    sweat + '</g>',
  susan: '<g class="cc-bob">' +
    '<ellipse cx="60" cy="126" rx="42" ry="10" fill="#f2e9dc" ' + O + '/><ellipse cx="60" cy="124" rx="30" ry="6" fill="none" stroke="#c9bcae" stroke-width="2" stroke-dasharray="3 4"/>' +
    '<g fill="#a86a3a" stroke="#1a0a11" stroke-width="3"><circle cx="28" cy="52" r="14"/><circle cx="92" cy="52" r="14"/><circle cx="36" cy="32" r="14"/><circle cx="84" cy="32" r="14"/><circle cx="60" cy="24" r="16"/><circle cx="24" cy="76" r="12"/><circle cx="96" cy="76" r="12"/></g>' +
    '<circle cx="60" cy="72" r="36" fill="#f6e4d8" ' + O + '/>' +
    '<path d="M70 42l-4 8 5 4-3 6" ' + T + ' stroke-width="1.6"/>' +
    '<circle cx="46" cy="70" r="9" fill="#fff" ' + O + '/>' + blink(46, 70, 4.6, 4.6, '#3b7dd8') +
    '<circle cx="74" cy="70" r="9" fill="#7a4a2a" ' + O + '/><g fill="#1a0a11"><circle cx="71" cy="67" r="1.6"/><circle cx="77" cy="67" r="1.6"/><circle cx="71" cy="73" r="1.6"/><circle cx="77" cy="73" r="1.6"/></g>' +
    '<circle cx="38" cy="86" r="6" fill="#ff9fb4" opacity=".6"/><circle cx="82" cy="86" r="6" fill="#ff9fb4" opacity=".6"/>' +
    '<path class="cc-mouth" d="M55 92q5-4 10 0q-5 5-10 0z" fill="#c23a50" ' + O + '/>' +
    sweat + '</g>'
};

// Props used by the courtroom effects.
export const COURT_PROPS = {
  gavel: '<svg viewBox="0 0 80 80" aria-hidden="true" focusable="false"><g ' + O + '><rect x="8" y="12" width="44" height="20" rx="5" fill="#6b3a2a" transform="rotate(-30 30 22)"/><path d="M36 30l32 34" stroke-width="7"/><path d="M36 30l32 34" stroke="#8b5a3c" stroke-width="3"/></g></svg>',
  duster: '<svg viewBox="0 0 80 80" aria-hidden="true" focusable="false"><path d="M40 78V36" stroke="#6b3a2a" stroke-width="5" stroke-linecap="round"/><g fill="#ff8fb8" stroke="#1a0a11" stroke-width="2"><path d="M40 40C26 34 10 20 14 6c10 4 20 16 26 30z"/><path d="M40 40c14-6 30-20 26-34-10 4-20 16-26 30z"/><path d="M40 38C36 24 34 10 40 2c6 8 4 22 0 36z" fill="#ffc0d6"/></g></svg>',
  bone: '<svg viewBox="0 0 40 20" aria-hidden="true" focusable="false"><path d="M8 4a4 4 0 1 1 3 7h18a4 4 0 1 1 3-7 4 4 0 1 1 0 12 4 4 0 1 1-3-7H11a4 4 0 1 1-3 7 4 4 0 1 1 0-12z" fill="#f2e9dc" stroke="#1a0a11" stroke-width="1.6"/></svg>',
  galleryGhost: '<svg viewBox="0 0 40 48" aria-hidden="true" focusable="false"><path d="M6 46c-1-16 0-40 14-40s15 24 14 40l-4-4-4 4-3-4-3 4-3-4-4 4z" fill="#dfe4f2" fill-opacity=".82" stroke="#1a0a11" stroke-width="2"/><ellipse cx="15" cy="20" rx="2.4" ry="3.6" fill="#1a0a11"/><ellipse cx="25" cy="20" rx="2.4" ry="3.6" fill="#1a0a11"/><ellipse class="cg-mouth" cx="20" cy="30" rx="3" ry="2" fill="#1a0a11"/></svg>'
};

export function castSvg(art, className = '') {
  return '<svg class="cc-portrait cc-' + art + (className ? ' ' + className : '') + '" viewBox="0 0 120 140" aria-hidden="true" focusable="false">' + (COURT_ART[art] || COURT_ART.ghost) + '</svg>';
}

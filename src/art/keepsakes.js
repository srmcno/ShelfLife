// Original cabinet miniatures. Only known content keys enter these illustrations;
// player names and other saved text are rendered separately by the UI.
const PAINTS = {
  paper: ['#fff1cb', '#d7b47b'],
  gold: ['#ffe8a8', '#b87a38'],
  brass: ['#edd29a', '#946440'],
  silver: ['#edf2e9', '#85939a'],
  teal: ['#b7d9c6', '#527d76'],
  plum: ['#b48ba6', '#604466'],
  rose: ['#e9ac9d', '#964c61'],
  glass: ['#d7eee2', '#739ea8'],
  velvet: ['#827897', '#42374f'],
  wax: ['#ffedb8', '#caa277']
};

const illustrations = {
  'button-crown': p => `
    <path d="m37 59 3-12 8 4 7-12 8 7 7-13 10 10 10-10 7 13 8-7 7 12 8-4 3 12-7 25H44Z" fill="${p('gold')}"/>
    <path d="m43 55 5 21m8-29 3 26m12-31 2 30m15-30-1 30m17-25-3 27m17-19-6 22" stroke="#8f5839" opacity=".6"/>
    <ellipse cx="80" cy="82" rx="38" ry="11" fill="${p('brass')}"/>
    <ellipse cx="80" cy="77" rx="38" ry="10" fill="${p('gold')}"/>
    <path d="M49 78q30 13 63 0" fill="none" stroke="#fff1c4" stroke-width="2.2"/>
    <circle cx="80" cy="73" r="11" fill="${p('teal')}"/>
    <circle cx="80" cy="73" r="7.5" fill="none" stroke="#e6e7bc"/>
    <path d="m77 70 6 6m0-6-6 6" stroke="#e8d6b1" stroke-width="2"/>
    <path d="M63 94c-15-6-37 0-28 8 8 7 14-6 5-9m24 1c19 12 40-1 48 7" fill="none" stroke="#a87978" stroke-width="2.3"/>
    <path d="m80 17 1.8 5.2L87 24l-5.2 1.8L80 31l-1.8-5.2L73 24l5.2-1.8Z" fill="#d7ad66" stroke="none"/>
  `,
  'button-passport': p => `
    <g transform="rotate(-9 78 62)">
      <path d="M43 24h66v74H47q-7 0-7-7V31q0-7 7-7" fill="${p('paper')}"/>
      <path d="M42 22h62v70H45q-7 0-7-7V30q0-8 7-8Z" fill="${p('teal')}"/>
      <path d="M45 24v65M51 31h44v52H51Z" fill="none" stroke="#e9d99e" stroke-width="1.1"/>
      <circle cx="73" cy="53" r="13" fill="none" stroke="#edda9f"/>
      <path d="M60 53h26m-13-13q-13 13 0 26m0-26q13 13 0 26m-13-13q13 8 26 0m-26 0q13-8 26 0" fill="none" stroke="#edda9f" stroke-width=".9"/>
      <path d="M60 73h26m-21 4h16" stroke="#edda9f" stroke-width="2"/>
      <path d="M46 95h58" stroke="#b69567"/>
    </g>
    <g transform="rotate(12 111 84)">
      <path d="M96 60h27v36l-7-3-7 3-7-3-6 3Z" fill="${p('paper')}"/>
      <circle cx="110" cy="77" r="10" fill="none" stroke="#9f626e" stroke-width="2"/>
      <path d="m107 74 6 6m0-6-6 6" stroke="#9f626e" stroke-width="2"/>
      <path d="M102 89h17" stroke="#8b7066"/>
    </g>
  `,
  'ghost-bed': p => `
    <path d="m33 71 58-14 38 18-60 18Z" fill="${p('paper')}"/>
    <path d="m33 71 36 22v17L33 89Z" fill="${p('rose')}"/>
    <path d="m69 93 60-18v17l-60 18Z" fill="${p('rose')}"/>
    <path d="m38 80 25 14v8L38 88Z" fill="#704350"/>
    <path d="m43 83 16 10m-15-5 10 6" stroke="#d6a58c" stroke-dasharray="1 3"/>
    <path d="m43 70 44-10 29 14-44 13Z" fill="#d5bdba"/>
    <path d="M47 69q13-14 26-5l9 7-22 8Z" fill="#f3e7d1"/>
    <path d="M60 58c-4-25 30-33 32-11l5 17-8-2-6 6-8-4-7 6Z" fill="${p('glass')}"/>
    <path d="M68 48q3 3 6 0m8-1q3 3 6-1" fill="none" stroke="#62717c"/>
    <path d="m62 77 26-7 29 6-44 12Z" fill="${p('plum')}"/>
    <path d="m73 76 26 5m-20-7 26 4" stroke="#dab1b8" opacity=".7"/>
    <path d="M39 32h7l-7 8h7m58-13h10l-10 11h10" fill="none" stroke="#b28a8d"/>
  `,
  'holiday-bell': p => `
    <path d="M77 35c-4-9-10-14-19-15l-7 15 20 5m13-5c4-10 11-14 21-14l4 17-20 4" fill="${p('rose')}"/>
    <path d="m73 35-16 32 10-2 5 8 9-32m7-4 14 25-9-2-4 6-8-24" fill="${p('rose')}"/>
    <path d="M71 29q9-8 17 0v12H71Z" fill="${p('brass')}"/>
    <path d="M52 81c8-9 3-34 28-36 26 1 20 27 28 36l9 9H43Z" fill="${p('gold')}"/>
    <path d="M62 77c4-8 1-19 11-23" fill="none" stroke="#fff0b5" stroke-width="3.5"/>
    <ellipse cx="80" cy="90" rx="37" ry="9" fill="#9a663d"/>
    <ellipse cx="80" cy="89" rx="32" ry="6" fill="#4a3b46"/>
    <path d="M80 83v10" stroke="#dabb7a" stroke-width="3"/>
    <circle cx="80" cy="95" r="6" fill="${p('rose')}"/>
    <path d="M47 69q-6-7-3-16m71 16q6-7 3-16" fill="none" stroke="#ceb989"/>
    <path d="M100 33q22 5 20 20" fill="none" stroke="#c4b59d"/>
    <path d="m109 49 22 3-2 17-22-3Z" fill="${p('paper')}"/>
    <path d="m115 57 9 1m-10 4 7 1" stroke="#8e746c"/>
  `,
  'crumb-telescope': p => `
    <path d="m74 70-18 34m19-34 3 35m-1-35 22 34" stroke="#8d6649" stroke-width="4"/>
    <path d="M73 72h12" stroke="#d4b077" stroke-width="5"/>
    <g transform="rotate(-25 79 53)">
      <path d="M35 42h67v22H35Z" fill="${p('brass')}"/>
      <path d="M40 44h57v6H40Z" fill="#f8dda0" stroke="none" opacity=".65"/>
      <path d="M97 37h15v32H97Z" fill="${p('gold')}"/>
      <ellipse cx="113" cy="53" rx="7" ry="16" fill="#334354"/>
      <ellipse cx="113" cy="53" rx="4" ry="12" fill="${p('glass')}"/>
      <path d="m113 43-2 8" stroke="#fff3ce" stroke-width="1.7"/>
      <path d="M29 46h9v14h-9Z" fill="#526367"/>
    </g>
    <g transform="rotate(12 38 92)">
      <path d="M20 77h30v28H20Z" fill="${p('paper')}"/>
      <path d="m25 92 5-7 7 11 8-10" fill="none" stroke="#85899a" stroke-dasharray="2 2"/>
      <circle cx="25" cy="92" r="1.6" fill="#907456"/><circle cx="37" cy="96" r="1.6" fill="#907456"/>
    </g>
    <path d="m113 24 15-6m-17 9 18-4m-16 7 11-1" stroke="#ccab77"/>
    <path d="m108 24 6 4-2 7-7 1-4-6Z" fill="${p('gold')}"/>
    <circle cx="108" cy="29" r="1.4" fill="#a66e45" stroke="none"/>
  `,
  'orbit-saucer': p => `
    <ellipse cx="80" cy="91" rx="43" ry="12" fill="${p('teal')}"/>
    <path d="M37 87q3 17 43 18 41-1 43-18" fill="${p('teal')}"/>
    <ellipse cx="80" cy="87" rx="43" ry="12" fill="${p('paper')}"/>
    <ellipse cx="80" cy="87" rx="29" ry="7" fill="none" stroke="#91a592"/>
    <path d="M80 84V36q0-15 18-13" fill="none" stroke="#aa885d" stroke-width="2.5"/>
    <ellipse cx="80" cy="58" rx="33" ry="11" transform="rotate(-24 80 58)" fill="none" stroke="#bd9b63" stroke-width="2"/>
    <ellipse cx="80" cy="58" rx="33" ry="11" transform="rotate(39 80 58)" fill="none" stroke="#bd9b63" stroke-width="1.3"/>
    <path d="m75 48 10-3 8 7-2 11-11 6-10-8Z" fill="${p('gold')}"/>
    <path d="m77 52 4 3m3 8 3-4m-12 0 1 1" stroke="#9a653f" stroke-width="2"/>
    <path d="m96 21 4 3-2 5-5-1-1-5Z" fill="#bd8190"/>
    <circle cx="109" cy="53" r="3.5" fill="${p('rose')}"/>
    <path d="m47 80-7 2m72-7 8 3" stroke="#e8dcb7"/>
  `,
  'rain-bottle': p => `
    <path d="M66 22h27v12H66Z" fill="${p('brass')}"/>
    <path d="M72 24v7m8-7v7m7-7v7" stroke="#8c684e" opacity=".7"/>
    <path d="M65 33h29v12c3 5 19 9 19 28v25q-34 13-68 0V73c0-19 16-23 20-28Z" fill="${p('glass')}"/>
    <path d="M51 92q29-12 56 0v3q-28 10-56 0Z" fill="#638e9c" stroke="none"/>
    <path d="M56 59q-7 12-6 28m22-47v7" fill="none" stroke="#f3f4dd" stroke-width="3"/>
    <path d="M67 64c-7-8 3-17 10-12 7-12 21-6 20 3 11-1 15 14 2 16H70" fill="#e7e8de"/>
    <path d="m72 76-2 5m14-5-2 5m13-4-2 5" stroke="#74939c" stroke-width="2"/>
    <path d="M58 45h-8v39q8-4 8-16m44-23h8v39q-8-4-8-16" fill="${p('rose')}" stroke-width="1"/>
    <path d="M57 50h46" stroke="#8d795f"/>
    <path d="M62 96q18 4 33 0" stroke="#b6d0c8"/>
  `,
  'rain-boat': p => `
    <path d="M29 97q10-5 20 0t20 0t20 0t20 0t20 0" fill="none" stroke="#82a7ad" stroke-width="2"/>
    <path d="m36 71 46-39 39 42-41 23Z" fill="${p('paper')}"/>
    <path d="m82 32-8 50 47-8Z" fill="#f3ddb3"/>
    <path d="m36 71 38 11 6 15Z" fill="#d5b07f"/>
    <path d="m36 71 20 26 44 2 21-25-47 8Z" fill="${p('paper')}"/>
    <path d="m55 81 13 5m26 2 12-4m-48 7 7 2m13-30 6 1m-8 4 12 2" stroke="#9c9581" opacity=".65"/>
    <path d="M84 65V22" stroke="#9c7753" stroke-width="2"/>
    <path d="m84 22 28 5-9 7 8 8-27-6Z" fill="${p('teal')}"/>
    <path d="M98 27c-5 6-6 8-3 10s8-2 3-10Z" fill="#dce8d2" stroke="none"/>
    <path d="M46 44c-7 8-7 11-3 13s8-4 3-13m75 10c-5 7-5 9-2 10s7-3 2-10" fill="${p('glass')}" stroke="#8da6a3"/>
    <path d="M43 104q8-4 16 0m43-1q10-4 17 0" fill="none" stroke="#b0c7bb"/>
  `,
  'ever-candle': p => `
    <ellipse cx="80" cy="99" rx="33" ry="7" fill="${p('brass')}"/>
    <path d="M59 82h43l-7 16H66Z" fill="${p('gold')}"/>
    <path d="M66 42h28v45q-14 7-28 0Z" fill="${p('wax')}"/>
    <ellipse cx="80" cy="42" rx="14" ry="5" fill="#fff2cd"/>
    <path d="M66 44v11q4 8 7 1V46m13-2v19q5 7 7-1V44" fill="#fce8b9" stroke="#cfa67d"/>
    <path d="M80 41v-9" stroke="#60434a" stroke-width="2"/>
    <path d="M80 14c3 10 11 14 7 24-3 7-12 7-16 0-4-8 7-17 9-24Z" fill="${p('gold')}" stroke="#c59155"/>
    <path d="M80 27c-3 5-6 8-3 11 3 4 9 0 6-4Z" fill="#fff6d1" stroke="none"/>
    <path d="M58 25l-5-3m5 15h-8m50-12 5-3m-4 15h8" stroke="#d7b879"/>
    <path d="M63 79q17-8 35 0" fill="none" stroke="#ba7182" stroke-width="4"/>
    <path d="m78 77-11-4-2 8 14-2 12 8 3-8-15-2" fill="${p('rose')}"/>
  `,
  'unbirthday-rosette': p => `
    <path d="m58 66-13 42 18-6 10 11 9-44m7-3 6 43 11-12 17 4-20-40" fill="${p('rose')}"/>
    <path d="m59 77-7 22m49-25 9 22" stroke="#efc2b0"/>
    <path d="m79 21 10 6 12-1 5 11 10 7-2 12 4 12-10 8-6 11-12-1-11 6-10-6-12 1-5-11-10-7 2-12-4-12 10-8 6-11 12 1Z" fill="${p('plum')}"/>
    <path d="m78 27 1 6m15-4-2 6m12 1-5 5m11 6-6 2m7 11-7-1m2 14-6-4m-3 11-4-6m-12 12v-7m-12 1 3-7m-13 2 6-5m-10-7 7-1m-5-13 7 2m-1-14 5 6" stroke="#d2abb8"/>
    <circle cx="80" cy="56" r="23" fill="${p('gold')}"/>
    <circle cx="80" cy="56" r="18" fill="${p('paper')}"/>
    <path d="M80 66c-18-10-13-22-6-20 3 0 5 3 6 5 2-4 5-6 9-4 8 4 2 13-9 19Z" fill="${p('rose')}" stroke="#a06470"/>
    <circle cx="68" cy="83" r="1.3" fill="#efd29a" stroke="none"/>
  `,
  'nobody-stamp': p => `
    <g transform="rotate(-12 66 80)">
      <path d="m29 60 5 2 4-2 4 2 4-2 4 2 4-2 4 2 4-2 4 2 4-2 4 2 4-2v39l-4-2-4 2-4-2-4 2-4-2-4 2-4-2-4 2-4-2-4 2-4-2-5 2Z" fill="${p('paper')}"/>
      <path d="M37 68h38v23H37Z" fill="#bba3a5"/>
      <path d="m41 77 15 9 15-9m-30 0v10h30V77Z" fill="#eee0bc"/>
      <path d="M42 63h30" stroke="#9c8775" stroke-width="1"/>
    </g>
    <path d="M78 70h42l8 14H70Z" fill="${p('brass')}"/>
    <path d="M70 84h58v9H70Z" fill="#5e4c56"/>
    <path d="M82 71q12-9 7-28c-13-16 23-20 18 0-4 19-3 23 6 28Z" fill="${p('teal')}"/>
    <path d="M95 33q7-4 8 4m-9 10q3 10-1 18" fill="none" stroke="#dfdfb9" stroke-width="2"/>
    <path d="M78 80h41" stroke="#f0d098"/>
    <path d="M103 100c-5-3-7 4-2 6 7 2 8-4 2-6" fill="#92647b" stroke="none"/>
  `,
  'reply-envelope': p => `
    <g transform="rotate(-8 76 74)">
      <path d="M33 53h83v48H33Z" fill="${p('paper')}"/>
      <path d="m33 53 41 30 42-30m-83 48 31-26m52 26L86 77" fill="none" stroke="#b38d64"/>
      <path d="m43 39 61 4-2 20-27 18-28-22Z" fill="#fff0cd"/>
      <path d="m55 49 31 3m-30 5 37 3m-34 5 19 1" stroke="#968a78"/>
      <path d="M64 84c-4-12 22-16 24-2 4 14-24 16-24 2Z" fill="${p('rose')}"/>
      <path d="M70 82h12l-6 5Z" fill="none" stroke="#f1c4a8"/>
    </g>
    <path d="m103 88 18-42 8-2 1 9-25 37Z" fill="${p('gold')}"/>
    <path d="m120 49 5 2-20 35" fill="none" stroke="#7f6150"/>
    <path d="M121 43c-3-13 10-28 18-30-2 12 1 21-9 32Z" fill="${p('teal')}"/>
    <path d="m137 18-13 23m6-19 1 5m-7 1 2 7" stroke="#dfdcae" stroke-width="1"/>
  `,
  'silver-baton': p => `
    <path d="m29 87 81-44 22 18-81 46Z" fill="${p('plum')}"/>
    <path d="m40 88 70-38 11 10-70 39Z" fill="#433b52" stroke="#b5a3ab"/>
    <path d="M33 89 48 100m67-52 12 12" stroke="#d8b690"/>
    <g transform="rotate(34 78 56)">
      <path d="m79 15 3 62h-6Z" fill="${p('silver')}"/>
      <path d="M78 21v19" stroke="#ffffff" stroke-width="1"/>
      <path d="M72 75h14v23H72Z" fill="${p('brass')}"/>
      <path d="M72 81h14m-14 6h14m-14 6h14" stroke="#8b644b"/>
      <path d="M79 14v5" stroke="#f0edde" stroke-width="1"/>
    </g>
    <path d="M43 35v17q-10-3-10 3t11 0V40l11-4v12q-10-3-10 3t11 0V31Z" fill="#d7b578" stroke="none"/>
    <path d="M115 26v12q-8-2-8 3t9 0V24l7 3" fill="#bf8795" stroke="none"/>
  `,
  'choir-ticket': p => `
    <g transform="rotate(-10 78 70)">
      <path d="M26 48h108v14c-12 0-12 17 0 17v15H26V79c12 0 12-17 0-17Z" fill="${p('rose')}"/>
      <path d="M36 54h88v34H36Z" fill="none" stroke="#eac59e"/>
      <path d="M105 50v43" stroke="#ecc7a5" stroke-dasharray="2 4"/>
      <path d="M46 62h47m-43 6h39m-38 11h35" stroke="#f4dbc0" stroke-width="2"/>
      <path d="M115 60v19m5-19v19m-9-18v18" stroke="#ecd0ad" stroke-width="1.4"/>
    </g>
    <path d="M57 28v16q-8-2-8 3t9 0V31l12-4v13q-8-2-8 3t9 0V22Z" fill="${p('gold')}" stroke-width="1"/>
    <path d="M90 24v12q-7-2-7 3t8 0V20l9 3v5l-9-3" fill="${p('teal')}" stroke-width="1"/>
    <path d="m48 97-6 9m66-12 6 9" stroke="#d2b681"/>
  `,
  'dragon-key': p => `
    <path d="M92 23c21-15 46 10 25 28-14 13-34-3-21-14 8-7 20 2 12 8" fill="none" stroke="#b37944" stroke-width="5"/>
    <path d="M92 22c21-15 46 10 25 28" fill="none" stroke="#f3d699" stroke-width="2"/>
    <g transform="rotate(32 78 67)">
      <path d="M66 41c-12-9-16-19-2-23l7 7 10-8 8 13 11 1-4 13-10 8v43H75V83h-9v-8h9V52Z" fill="${p('gold')}"/>
      <path d="m65 29-7-9 12 4m14-2 9-6-3 14" fill="${p('brass')}"/>
      <path d="M70 35q9-6 13 2l-5 9-10-3Z" fill="#52646b"/>
      <circle cx="87" cy="32" r="2" fill="#5e4646" stroke="none"/>
      <path d="M82 56v34m-8-56 4 4" stroke="#fff0b5" stroke-width="1.6"/>
    </g>
    <path d="M49 87c-21-8-33 7-19 14 9 4 10-10 3-9" fill="none" stroke="#ba8fa0" stroke-width="2"/>
    <path d="M38 105 65 96" stroke="#a6afb0" stroke-width="2"/>
    <circle cx="37" cy="105" r="2.5" fill="#dab891"/>
  `,
  'dragon-parcel': p => `
    <path d="m37 59 45-14 42 17-5 32-39 12-39-16Z" fill="${p('velvet')}"/>
    <path d="m37 59 43 20 44-17m-44 17v27" fill="none" stroke="#b8a4b7"/>
    <path d="m69 49 14-4 9 4-41 24-10-5Z" fill="${p('rose')}"/>
    <path d="m105 54 11 5-56 36-12-5Z" fill="${p('rose')}"/>
    <path d="m75 75 12-5 9 4-9 29-14 4Z" fill="${p('rose')}"/>
    <path d="M84 68c-22-19-22-38-8-33 11 4 4 21 8 33m0 0c4-25 30-38 31-23 1 14-21 11-31 23" fill="${p('rose')}"/>
    <path d="M84 63c-9-4-13 3-6 7 7 5 17-1 6-7Z" fill="${p('gold')}"/>
    <path d="m57 54 2-23" stroke="#d9dad0" stroke-width="2.2"/>
    <circle cx="59" cy="29" r="4" fill="${p('gold')}"/>
    <path d="M105 81c10-11 15-4 13 2-1 6-8 8-12 5l-4 4-4-4 4-3Z" fill="${p('teal')}" stroke="#68877f"/>
    <path d="m109 79 2 2m0 4 3 1m-9-2 2 2" stroke="#d5dcc1" stroke-width="1"/>
  `
};

export const KEEPSAKE_KEYS = Object.freeze(Object.keys(illustrations));
let renderSerial = 0;

export function keepsakeSvg(key) {
  if (!Object.hasOwn(illustrations, key)) return '';
  // A preview and its album entry can coexist. Per-render gradient IDs prevent
  // one illustration resolving a paint server in a hidden sibling SVG.
  const prefix = 'keepsake-' + ++renderSerial;
  const used = new Set();
  const paint = name => { used.add(name); return 'url(#' + prefix + '-' + name + ')'; };
  const drawing = illustrations[key](paint);
  const defs = [...used].map(name => '<linearGradient id="' + prefix + '-' + name +
    '" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="' + PAINTS[name][0] +
    '"/><stop offset="1" stop-color="' + PAINTS[name][1] + '"/></linearGradient>').join('');
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120" class="keepsake-art" aria-hidden="true" focusable="false" fill="none" stroke="#493943" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<defs>' + defs + '</defs><ellipse cx="80" cy="109" rx="45" ry="5" fill="#241e2b" opacity=".13" stroke="none"/>' + drawing + '</svg>';
}

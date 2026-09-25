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

export const COURT_ART = {
  judge: '<g class="cc-bob">' +
    '<path d="M16 140l12-44q32-14 64 0l12 44z" fill="#17101f" ' + O + '/>' +
    '<path d="M52 96h16l-3 16h-10z" fill="#f2e9dc" ' + O + '/>' +
    '<circle cx="33" cy="46" r="11" fill="#dcd5c8" ' + O + '/><circle cx="29" cy="64" r="11" fill="#dcd5c8" ' + O + '/><circle cx="31" cy="82" r="10" fill="#dcd5c8" ' + O + '/>' +
    '<circle cx="87" cy="46" r="11" fill="#dcd5c8" ' + O + '/><circle cx="91" cy="64" r="11" fill="#dcd5c8" ' + O + '/><circle cx="89" cy="82" r="10" fill="#dcd5c8" ' + O + '/>' +
    '<ellipse cx="60" cy="58" rx="25" ry="28" fill="#f0e8d8" ' + O + '/>' +
    '<path d="M34 44q26-34 52 0q-26-12-52 0z" fill="#dcd5c8" ' + O + '/>' +
    '<path class="cc-brow" d="M42 44l14 5M78 44l-14 5" ' + T + ' stroke-width="3.4"/>' +
    '<ellipse cx="50" cy="56" rx="8" ry="9" fill="#1a0a11"/><ellipse cx="70" cy="56" rx="8" ry="9" fill="#1a0a11"/>' +
    blink(50, 57, 2.6, 2.6, '#ff5a6e') + blink(70, 57, 2.6, 2.6, '#ff5a6e') +
    '<path d="M60 63l-4 8h8z" fill="#1a0a11"/>' +
    '<g class="cc-mouth"><rect x="46" y="74" width="28" height="9" rx="2" fill="#f0e8d8" ' + O + '/><path d="M53 74v9M60 74v9M67 74v9" ' + T + '/></g>' +
    '</g>',
  rat: '<g class="cc-bob">' +
    '<path d="M34 140l14-50q26-12 52 0l12 50z" fill="#6b1422" ' + O + '/>' +
    '<path d="M64 92h14l-3 14h-8z" fill="#f2e9dc" ' + O + '/>' +
    '<circle cx="96" cy="50" r="10" fill="#dcd5c8" ' + O + '/><circle cx="100" cy="66" r="10" fill="#dcd5c8" ' + O + '/><circle cx="98" cy="82" r="9" fill="#dcd5c8" ' + O + '/>' +
    '<circle cx="76" cy="30" r="13" fill="#a79daa" ' + O + '/><circle cx="76" cy="30" r="6" fill="#ff9fc0"/>' +
    '<path d="M94 62c0-16-12-26-30-24-14 2-26 10-48 24 20 10 36 16 50 16 16 0 28-4 28-16z" fill="#958b99" ' + O + '/>' +
    '<circle cx="16" cy="62" r="5" fill="#ff8fb8" ' + O + '/>' +
    '<path d="M22 58l-16-8M22 64l-18 0M24 68l-15 8" ' + T + ' stroke-width="1.6"/>' +
    '<circle cx="58" cy="52" r="4" fill="#1a0a11"/>' + blink(59, 51, 1.3, 1.3, '#fff') +
    '<circle cx="58" cy="52" r="9" ' + T + ' stroke="#e2b04a" stroke-width="2.4"/><path d="M66 56q10 12 20 26" ' + T + ' stroke="#e2b04a" stroke-width="1.6"/>' +
    '<path class="cc-brow" d="M48 42l16 4" ' + T + ' stroke-width="3"/>' +
    '<g class="cc-mouth"><rect x="26" y="68" width="6" height="9" rx="1.5" fill="#fff8e6" ' + O + '/><rect x="32" y="68" width="6" height="9" rx="1.5" fill="#fff8e6" ' + O + '/></g>' +
    '<path d="M108 128c10-4 12-18 4-24" ' + T + ' stroke="#ff9fc0" stroke-width="4"/>' +
    sweat + '</g>',
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

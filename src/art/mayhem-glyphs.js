/* Line glyphs for curios and emergency cards. One 48 unit square each, drawn
   in currentColor with a soft fill so rarity colours can tint them. */
const S = 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';
const F = 'fill="currentColor" fill-opacity=".16"';

const GLYPHS = {
  bottle: `<path ${S} ${F} d="M20 6h8v7l5 6v21a3 3 0 0 1-3 3H18a3 3 0 0 1-3-3V19l5-6z"/><path ${S} d="M19 26h10M20 31l8 6M28 31l-8 6"/><path ${S} d="M19 6h10"/>`,
  shovel: `<path ${S} d="M24 5v24"/><path ${S} d="M19 5h10"/><path ${S} ${F} d="M16 29h16v6c0 5-4 9-8 9s-8-4-8-9z"/>`,
  planchette: `<path ${S} ${F} d="M24 5c10 0 17 12 17 22 0 8-7 14-17 14S7 35 7 27C7 17 14 5 24 5z"/><circle ${S} cx="24" cy="21" r="5"/><path ${S} d="M13 38l-3 5M35 38l3 5M24 41v4"/>`,
  scroll: `<path ${S} ${F} d="M12 8h22a4 4 0 0 1 4 4v26a4 4 0 0 0 4 4H18a4 4 0 0 1-4-4V12a4 4 0 0 0-4-4"/><path ${S} d="M19 17h12M19 23h12M19 29h8"/><path ${S} d="M26 36c2-2 4-2 5 0s3 2 4 0"/>`,
  mirror: `<ellipse ${S} ${F} cx="24" cy="20" rx="12" ry="15"/><path ${S} d="M24 35v8M17 44h14"/><path ${S} d="M18 14c2-3 5-4 8-4"/>`,
  teeth: `<path ${S} ${F} d="M6 18c6-6 30-6 36 0-2 12-8 20-18 20S8 30 6 18z"/><path ${S} d="M11 19l3 6 3-6 3 6 4-6 4 6 3-6 3 6 3-6"/>`,
  lamp: `<path ${S} ${F} d="M15 8h18l6 16H9z"/><path ${S} d="M24 24v14M15 42h18"/><path ${S} d="M20 30c-3 2-3 5 0 7"/>`,
  candle: `<path ${S} ${F} d="M18 20h12v20a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2z"/><path ${S} d="M24 20v-4"/><path ${S} ${F} d="M24 4c3 4 5 6 5 9a5 5 0 0 1-10 0c0-3 2-5 5-9z"/><path ${S} d="M28 20v6c0 2 2 2 2 4"/>`,
  glow: `<circle ${S} ${F} cx="24" cy="24" r="9"/><path ${S} d="M24 5v6M24 37v6M5 24h6M37 24h6M11 11l4 4M33 33l4 4M37 11l-4 4M15 33l-4 4"/>`,
  door: `<path ${S} ${F} d="M13 43V12a11 11 0 0 1 22 0v31z"/><circle cx="30" cy="28" r="1.8" fill="currentColor"/><path ${S} d="M9 43h30"/>`,
  skull: `<path ${S} ${F} d="M24 6c-9 0-15 6-15 15 0 5 3 8 5 10v6h20v-6c2-2 5-5 5-10 0-9-6-15-15-15z"/><circle cx="18" cy="22" r="3.4" fill="currentColor"/><circle cx="30" cy="22" r="3.4" fill="currentColor"/><path ${S} d="M22 30l2-3 2 3M19 37v5M24 37v5M29 37v5"/>`,
  tooth: `<path ${S} ${F} d="M13 10c3-4 8-3 11-1 3-2 8-3 11 1 3 5 1 11-1 15-1 4-1 15-5 15-3 0-2-11-5-11s-2 11-5 11c-4 0-4-11-5-15-2-4-4-10-1-15z"/>`,
  cake: `<path ${S} ${F} d="M9 26h30v16H9z"/><path ${S} d="M9 32c5 3 10-3 15 0s10 3 15 0"/><path ${S} d="M16 26v-7M24 26v-7M32 26v-7"/><path ${S} d="M16 15c1 2 0 3 0 3M24 15c1 2 0 3 0 3M32 15c1 2 0 3 0 3"/>`,
  photo: `<rect ${S} ${F} x="8" y="9" width="32" height="30" rx="2"/><circle ${S} cx="19" cy="21" r="4"/><circle ${S} cx="30" cy="21" r="4"/><path ${S} d="M12 35c2-5 12-5 14 0M23 35c2-5 12-5 14 0"/>`,
  eye: `<path ${S} ${F} d="M4 24c6-9 13-13 20-13s14 4 20 13c-6 9-13 13-20 13S10 33 4 24z"/><circle ${S} cx="24" cy="24" r="7"/><circle cx="24" cy="24" r="3" fill="currentColor"/>`,
  spider: `<ellipse ${S} ${F} cx="24" cy="27" rx="7" ry="8"/><circle ${S} ${F} cx="24" cy="16" r="4"/><path ${S} d="M17 23l-9-6-3 4M17 28H6l-2 5M18 33l-8 6M31 23l9-6 3 4M31 28h11l2 5M30 33l8 6M24 4v8"/>`,
  clock: `<circle ${S} ${F} cx="24" cy="25" r="16"/><path ${S} d="M24 15v10l7 5M18 5h12M24 5v4"/>`,
  gavel: `<rect ${S} ${F} x="10" y="10" width="18" height="10" rx="2" transform="rotate(-35 19 15)"/><path ${S} d="M22 20l14 14M8 42h22"/>`,
  coffin: `<path ${S} ${F} d="M18 4h12l7 12-5 28H16L11 16z"/><path ${S} d="M24 14v14M19 20h10"/>`,
  bug: `<ellipse ${S} ${F} cx="24" cy="26" rx="10" ry="13"/><path ${S} d="M14 22h20M14 28h20M15 34h18M20 13l-4-6M28 13l4-6M14 22l-6-2M14 30l-7 2M34 22l6-2M34 30l7 2"/>`,
  ink: `<path ${S} ${F} d="M24 5c6 9 11 15 11 22a11 11 0 0 1-22 0c0-7 5-13 11-22z"/><path ${S} d="M18 28c0 4 3 6 6 6"/>`,
  flame: `<path ${S} ${F} d="M24 4c2 8 12 12 12 24a12 12 0 0 1-24 0c0-6 3-9 5-12 1 4 3 6 5 6-2-6 0-12 2-18z"/><path ${S} d="M24 42c-3 0-5-2-5-5 0-3 3-5 5-9 2 4 5 6 5 9 0 3-2 5-5 5z"/>`,
  ear: `<path ${S} ${F} d="M16 18a10 10 0 0 1 20 0c0 7-6 9-7 15-1 6-5 9-9 9-3 0-5-2-5-4"/><path ${S} d="M21 19a4 4 0 0 1 8 0c0 3-4 4-4 7"/>`,
  grave: `<path ${S} ${F} d="M12 42V18a12 12 0 0 1 24 0v24z"/><path ${S} d="M24 17v14M19 22h10M6 42h36"/>`,
  ghost: `<path ${S} ${F} d="M11 42V21a13 13 0 0 1 26 0v21l-4-4-4 4-5-4-5 4-4-4z"/><circle cx="19" cy="21" r="2.5" fill="currentColor"/><circle cx="29" cy="21" r="2.5" fill="currentColor"/><ellipse cx="24" cy="29" rx="3" ry="4" fill="currentColor" fill-opacity=".5"/>`,
  bone: `<path ${S} ${F} d="M14 10a5 5 0 0 0-8 5 5 5 0 0 0 5 5l17 17a5 5 0 0 0 5 5 5 5 0 0 0 5-8 5 5 0 0 0 5-8 5 5 0 0 0-8-3L18 6a5 5 0 0 0-8 1 5 5 0 0 0 4 3z"/>`,
  head: `<circle ${S} ${F} cx="24" cy="21" r="14"/><circle cx="19" cy="20" r="2.4" fill="currentColor"/><circle cx="29" cy="20" r="2.4" fill="currentColor"/><path ${S} d="M20 28c3 2 5 2 8 0M13 11c4-5 18-5 22 0M16 35l-2 8M32 35l2 8"/>`,
  chalk: `<path ${S} stroke-dasharray="3 3" d="M24 6a5 5 0 0 1 0 10 5 5 0 0 1 0-10zM24 16v14M24 20l-12-4M24 20l12-4M24 30l-8 13M24 30l8 13"/>`,
  raven: `<path ${S} ${F} d="M8 30c6-2 10-8 12-14 2-5 7-8 12-6l8 2-6 3c1 8-3 16-12 19l-4 8-2-7c-3 0-6-2-8-5z"/><circle cx="31" cy="15" r="1.6" fill="currentColor"/>`,
  shadow: `<path ${S} ${F} d="M16 40c-5-2-6-10-3-18 2-7 8-12 11-12 3 0 6 5 6 12"/><path ${S} stroke-dasharray="3 3" d="M26 40c6 0 12-6 13-14 1-7-3-12-7-12"/><path ${S} d="M8 42h32"/>`,
  jar: `<path ${S} ${F} d="M15 12h18v4c3 2 5 5 5 9v13a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V25c0-4 2-7 5-9z"/><path ${S} d="M14 8h20v4H14z"/><path ${S} d="M17 30l2 3 2-3M24 27l2 3 2-3M20 36l2 3 2-3"/>`,
  veil: `<path ${S} ${F} d="M24 5c-9 0-14 8-14 18 0 8-2 15-4 20h36c-2-5-4-12-4-20 0-10-5-18-14-18z"/><path ${S} d="M17 20c2 2 5 2 7 0 2 2 5 2 7 0M18 30c4 3 8 3 12 0"/>`,
  hand: `<path ${S} ${F} d="M16 42c-4-4-6-9-6-14v-6a3 3 0 0 1 6 0v4V10a3 3 0 0 1 6 0v12V8a3 3 0 0 1 6 0v14-10a3 3 0 0 1 6 0v18c0 6-2 9-4 12z"/>`,
  brooch: `<ellipse ${S} ${F} cx="24" cy="25" rx="13" ry="16"/><ellipse ${S} cx="24" cy="25" rx="7" ry="9"/><path ${S} d="M24 5v4M20 18c3-2 6 1 4 4s1 6 4 4"/>`,
  mushroom: `<path ${S} ${F} d="M6 24C6 13 14 7 24 7s18 6 18 17z"/><path ${S} d="M18 24v14a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4V24"/><circle cx="16" cy="16" r="2.4" fill="currentColor"/><circle cx="28" cy="13" r="2" fill="currentColor"/><circle cx="33" cy="19" r="1.6" fill="currentColor"/>`,
  moth: `<path ${S} ${F} d="M24 16C18 6 6 6 6 14c0 7 8 10 16 10-8 2-12 8-8 14 4 4 9-3 10-10 1 7 6 14 10 10 4-6 0-12-8-14 8 0 16-3 16-10 0-8-12-8-18 2z"/><path ${S} d="M24 14v22M22 10l-3-5M26 10l3-5"/>`,
  spoon: `<ellipse ${S} ${F} cx="20" cy="14" rx="7" ry="9" transform="rotate(-20 20 14)"/><path ${S} d="M23 22c2 6 1 10 6 12s7 6 5 9"/>`,
  nail: `<path ${S} ${F} d="M12 8h24v5H12z"/><path ${S} ${F} d="M20 13h8v18l-4 12-4-12z"/>`,
  thimble: `<path ${S} ${F} d="M14 40V20a10 10 0 0 1 20 0v20z"/><path ${S} d="M12 40h24"/><circle cx="20" cy="20" r="1.3" fill="currentColor"/><circle cx="26" cy="18" r="1.3" fill="currentColor"/><circle cx="23" cy="25" r="1.3" fill="currentColor"/><circle cx="29" cy="25" r="1.3" fill="currentColor"/><circle cx="19" cy="30" r="1.3" fill="currentColor"/><circle cx="26" cy="31" r="1.3" fill="currentColor"/>`,
  ring: `<ellipse ${S} ${F} cx="24" cy="30" rx="13" ry="11"/><ellipse ${S} cx="24" cy="30" rx="8" ry="6"/><path ${S} ${F} d="M19 17l5-10 5 10z"/>`,
  mouse: `<path ${S} ${F} d="M10 36c0-10 7-18 16-18 7 0 12 6 12 12v6z"/><circle ${S} cx="30" cy="16" r="5"/><circle cx="33" cy="26" r="1.6" fill="currentColor"/><path ${S} d="M38 36h4M10 36c-4 0-6 3-4 6M20 18l-3-6h8"/>`,
  paw: `<path ${S} ${F} d="M16 44c-2-10 0-18 8-20 8 2 10 10 8 20z"/><path ${S} d="M17 24c-2-5-2-10 0-14M24 24V8M31 24c2-5 2-10 0-14"/>`,
  box: `<path ${S} ${F} d="M8 20h32v20H8z"/><path ${S} ${F} d="M8 20l4-10h24l4 10"/><path ${S} d="M24 30v10M40 30h4a2 2 0 0 0 0-4"/><path ${S} d="M18 6c1 2 3 2 4 0M28 4c1 2 3 2 4 0"/>`,
  key: `<circle ${S} ${F} cx="15" cy="15" r="8"/><circle ${S} cx="15" cy="15" r="3"/><path ${S} d="M21 21l19 19M32 32l4-4M36 36l4-4"/>`,
  book: `<path ${S} ${F} d="M8 10c6-2 12-2 16 2v30c-4-4-10-4-16-2z"/><path ${S} ${F} d="M40 10c-6-2-12-2-16 2v30c4-4 10-4 16-2z"/><path ${S} d="M12 18h8M12 23h8M28 18h8"/>`,
  heart: `<path ${S} ${F} d="M24 42C12 33 6 26 6 18a9 9 0 0 1 18-3 9 9 0 0 1 18 3c0 8-6 15-18 24z"/><path ${S} d="M24 15v-8M20 9h8"/><path ${S} d="M13 22h6l2-4 3 8 2-4h9"/>`,
  soul: `<path ${S} ${F} d="M24 4c5 7 11 12 11 21a11 11 0 0 1-22 0c0-4 2-7 4-9 0 4 2 6 4 6-1-7 1-12 3-18z"/><circle cx="20" cy="27" r="1.8" fill="currentColor"/><circle cx="28" cy="27" r="1.8" fill="currentColor"/><path ${S} d="M21 33c2 1 4 1 6 0"/>`
};

export const GLYPH_NAMES = Object.keys(GLYPHS);

export function glyph(name, className = '') {
  const body = GLYPHS[name] || GLYPHS.skull;
  return '<svg class="mh-glyph' + (className ? ' ' + className : '') + '" viewBox="0 0 48 48" aria-hidden="true" focusable="false">' + body + '</svg>';
}

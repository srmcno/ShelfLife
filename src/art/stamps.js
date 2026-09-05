// Studio canvas is a fixed 640x640 square (see art/studio.js). A placed stamp's
// x/y/size are stored in that same pixel space; art/sprite.js converts them to
// percentages of this constant when rendering, so a stamp lands in the same
// relative spot on the shelf (rendered much smaller) as it was drawn in the studio.
export const CANVAS_SIZE = 640;

// How many canvas units wide a stamp's SVG box is, per unit of its `size`.
// Every STAMP_SVG below is generated at 12 SVG units per canvas unit on a
// "-30 -30 60 60" viewBox, so the box spans 60/12 = 5x size. Both the shelf
// renderer (art/sprite.js) and the studio preview (art/studio.js) must use
// this same constant or the studio stops being WYSIWYG.
export const STAMP_SCALE = 5;

export const BASE_STAMPS = ['blob','eyes','bigeye','deadeyes','ears','horns','grin','arms','legs','tail','wing','bow','halo','stitches','spots'];
export const UNLOCK_STAMPS = [
  { at:20, stamps:['thirdeye','antlers'], label:'a third eye and antlers' },
  { at:45, stamps:['tentacles','crown'], label:'tentacles and a crown' }
];
export const STAMP_LABELS = { blob:'Body', eyes:'Eyes', bigeye:'One eye', deadeyes:'X eyes', ears:'Ears', horns:'Horns', grin:'Teeth', arms:'Arms', legs:'Legs', tail:'Tail', wing:'Wing', bow:'Bow', halo:'Halo', stitches:'Stitches', spots:'Spots', thirdeye:'Third eye', antlers:'Antlers', tentacles:'Tentacles', crown:'Crown' };
export const DEFAULT_STAMP_SIZE = 40;

// Each SVG uses fill/stroke=currentColor for the tinted parts and a fixed off-white
// (#F2E9DC) for eye-whites/teeth, matching the original canvas-drawn stamps. Coordinate
// space is a fixed -30..30 (60x60) box, same convention as PROP_ART.
export const STAMP_SVG = {
  arms: `<svg viewBox="-30 -30 60 60" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">
  <g transform="translate(-10 -6)"><g data-part="arm" data-index="0" data-side="l" data-pivot-x="-10" data-pivot-y="-6"><path d="M0 0Q-9 4-8 14M-8 14l-5 1m5-1l-1 5m1-5l4 3"/></g></g>
  <g transform="translate(10 -6)"><g data-part="arm" data-index="1" data-side="r" data-pivot-x="10" data-pivot-y="-6"><path d="M0 0Q9 4 8 14M8 14l5 1m-5-1l1 5m-1-5l-4 3"/></g></g>
</svg>`,
  legs: `<svg viewBox="-30 -30 60 60" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
  <g transform="translate(-7 -8)"><g data-part="leg" data-index="0" data-side="l" data-pivot-x="-7" data-pivot-y="-8"><path d="M0 0Q-3 10-1 21l-7 1"/></g></g>
  <g transform="translate(7 -8)"><g data-part="leg" data-index="1" data-side="r" data-pivot-x="7" data-pivot-y="-8"><path d="M0 0Q3 10 1 21l7 1"/></g></g>
</svg>`,

  blob: `<svg viewBox="-30 -30 60 60" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
  <path d="M 0 -19.2 C 24 -18 22.8 19.2 0 20.4 C -22.8 19.2 -24 -18 0 -19.2 Z"/>
</svg>`,
  eyes: `<svg viewBox="-30 -30 60 60" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="-6.6" cy="0" rx="5.04" ry="6" fill="#F2E9DC"/>
  <ellipse cx="6.6" cy="0" rx="5.04" ry="6" fill="#F2E9DC"/>
  <circle cx="-6" cy="0.6" r="2.4" fill="currentColor"/>
  <circle cx="7.2" cy="0.6" r="2.4" fill="currentColor"/>
</svg>`,
  bigeye: `<svg viewBox="-30 -30 60 60" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="0" cy="0" rx="10.8" ry="9" fill="#F2E9DC"/>
  <circle cx="0" cy="0" r="4.32" fill="currentColor"/>
  <circle cx="1.92" cy="-1.92" r="1.32" fill="#F2E9DC"/>
</svg>`,
  deadeyes: `<svg viewBox="-30 -30 60 60" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.92" stroke-linecap="round" fill="none">
  <line x1="-10.8" y1="-3.6" x2="-3.6" y2="3.6"/>
  <line x1="-3.6" y1="-3.6" x2="-10.8" y2="3.6"/>
  <line x1="3.6" y1="-3.6" x2="10.8" y2="3.6"/>
  <line x1="10.8" y1="-3.6" x2="3.6" y2="3.6"/>
</svg>`,
  ears: `<svg viewBox="-30 -30 60 60" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
  <path d="M -10.8 8.4 Q -14.4 -13.2 -1.8 -2.4 Z"/>
  <path d="M 10.8 8.4 Q 14.4 -13.2 1.8 -2.4 Z"/>
</svg>`,
  horns: `<svg viewBox="-30 -30 60 60" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
  <path d="M -6 7.2 Q -18 -2.4 -9 -14.4 Q -7.2 -1.2 -0.6 7.2 Z"/>
  <path d="M 6 7.2 Q 18 -2.4 9 -14.4 Q 7.2 -1.2 0.6 7.2 Z"/>
</svg>`,
  grin: `<svg viewBox="-30 -30 60 60" xmlns="http://www.w3.org/2000/svg">
  <path d="M 9.62 2.5 A 10.8 10.8 0 0 1 -9.62 2.5" fill="none" stroke="currentColor" stroke-width="1.68"/>
  <path d="M -9.84 6.6 L -6.48 6.6 L -8.16 11.4 Z" fill="#F2E9DC"/>
  <path d="M -5.76 6.6 L -2.4 6.6 L -4.08 11.4 Z" fill="#F2E9DC"/>
  <path d="M -1.68 6.6 L 1.68 6.6 L 0 11.4 Z" fill="#F2E9DC"/>
  <path d="M 2.4 6.6 L 5.76 6.6 L 4.08 11.4 Z" fill="#F2E9DC"/>
  <path d="M 6.48 6.6 L 9.84 6.6 L 8.16 11.4 Z" fill="#F2E9DC"/>
</svg>`,
  tail: `<svg viewBox="-30 -30 60 60" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="4.8" stroke-linecap="round">
  <path d="M 0 0 C 16.8 -2.4 13.2 -19.2 -1.2 -15.6"/>
</svg>`,
  wing: `<svg viewBox="-30 -30 60 60" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
  <path d="M 0 0 Q -21.6 -16.8 -25.2 2.4 Q -14.4 1.2 -16.8 10.8 Q -6 6 0 0 Z"/>
</svg>`,
  bow: `<svg viewBox="-30 -30 60 60" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
  <ellipse cx="-9" cy="0" rx="8.4" ry="6" transform="rotate(-17.2 -9 0)"/>
  <ellipse cx="9" cy="0" rx="8.4" ry="6" transform="rotate(17.2 9 0)"/>
  <circle cx="0" cy="0" r="3.6"/>
</svg>`,
  halo: `<svg viewBox="-30 -30 60 60" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.64">
  <ellipse cx="0" cy="0" rx="14.4" ry="5.04"/>
</svg>`,
  stitches: `<svg viewBox="-30 -30 60 60" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.44" stroke-linecap="round">
  <line x1="-14.4" y1="0" x2="14.4" y2="0"/>
  <line x1="-12" y1="-4.8" x2="-12" y2="4.8"/>
  <line x1="-6" y1="-4.8" x2="-6" y2="4.8"/>
  <line x1="0" y1="-4.8" x2="0" y2="4.8"/>
  <line x1="6" y1="-4.8" x2="6" y2="4.8"/>
  <line x1="12" y1="-4.8" x2="12" y2="4.8"/>
</svg>`,
  spots: `<svg viewBox="-30 -30 60 60" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
  <circle cx="0" cy="0" r="7.56"/>
  <circle cx="13.2" cy="6" r="5.94"/>
  <circle cx="-10.8" cy="7.2" r="5.13"/>
  <circle cx="4.8" cy="-10.8" r="4.86"/>
</svg>`,
  thirdeye: `<svg viewBox="-30 -30 60 60" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="0" cy="0" rx="9.6" ry="13.2" fill="#F2E9DC"/>
  <ellipse cx="0" cy="0" rx="3.6" ry="9" fill="currentColor"/>
  <g stroke="currentColor" stroke-width="1.2" stroke-linecap="round">
  <line x1="12" y1="0" x2="18" y2="0"/>
  <line x1="8.49" y1="11.03" x2="12.73" y2="16.12"/>
  <line x1="0" y1="15.6" x2="0" y2="22.8"/>
  <line x1="-8.49" y1="11.03" x2="-12.73" y2="16.12"/>
  <line x1="-12" y1="0" x2="-18" y2="0"/>
  <line x1="-8.49" y1="-11.03" x2="-12.73" y2="-16.12"/>
  <line x1="0" y1="-15.6" x2="0" y2="-22.8"/>
  <line x1="8.49" y1="-11.03" x2="12.73" y2="-16.12"/>
  </g>
</svg>`,
  antlers: `<svg viewBox="-30 -30 60 60" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="2.16" stroke-linecap="round" fill="none">
  <line x1="-3.6" y1="9.6" x2="-8.4" y2="-16.8"/>
  <line x1="-6" y1="-3.6" x2="-16.8" y2="-10.8"/>
  <line x1="-7.44" y1="-10.8" x2="-15.6" y2="-20.4"/>
  <line x1="3.6" y1="9.6" x2="8.4" y2="-16.8"/>
  <line x1="6" y1="-3.6" x2="16.8" y2="-10.8"/>
  <line x1="7.44" y1="-10.8" x2="15.6" y2="-20.4"/>
</svg>`,
  tentacles: `<svg viewBox="-30 -30 60 60" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.64" stroke-linecap="round">
  <path d="M -13.2 0 C -21.6 10.8 -6 18 -16.8 25.2"/>
  <path d="M -4.8 0 C 3.6 10.8 -12 18 -1.2 25.2"/>
  <path d="M 4.8 0 C -3.6 10.8 12 18 1.2 25.2"/>
  <path d="M 13.2 0 C 21.6 10.8 6 18 16.8 25.2"/>
</svg>`,
  crown: `<svg viewBox="-30 -30 60 60" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
  <path d="M -15.6 7.2 L -15.6 -8.4 L -7.8 0.6 L 0 -13.2 L 7.8 0.6 L 15.6 -8.4 L 15.6 7.2 Z"/>
</svg>`,
};

export const STAMP_ANIM_CLASS = {
  blob:'', arms:'', legs:'', eyes:'anim-blink', bigeye:'anim-blink', deadeyes:'anim-blink-slow', thirdeye:'anim-blink-slow',
  ears:'anim-sway', wing:'anim-sway', tail:'anim-sway', antlers:'anim-sway-slow', tentacles:'anim-undulate',
  horns:'anim-twitch', stitches:'anim-twitch', halo:'anim-halo', crown:'anim-bob', bow:'anim-bob',
  grin:'', spots:''
};

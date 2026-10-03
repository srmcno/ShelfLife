/* Small illustrations for empty states. Procedural SVG, line work in the room's
   own ink with one lit accent, so they sit in the dark like the furniture does.
   Colours come from css/fx.css (.ea-line, .ea-fill, .ea-acc, .ea-warm), which is
   what lets one drawing take the cabinet's key light in every room.

   120 x 84 units. Each is a little scene that explains why it is empty. */
const WEB = '<path class="ea-line faint" d="M4 4h26M4 4l19 13M4 4l8 22M10 4q2 6-1 11M17 4q1 9-6 15M24 4q0 10-9 17"/>';

const ART = {
  // The note board, with nothing pinned to it and a spider who is being blamed.
  notes: WEB +
    '<g transform="rotate(-4 62 46)"><rect class="ea-line ea-fill" x="36" y="17" width="52" height="54" rx="2.5"/>' +
    '<path class="ea-line dotted" d="M45 35h34M45 43h34M45 51h20"/><circle class="ea-pin" cx="62" cy="22" r="3.4"/></g>' +
    '<g class="ea-dangle"><path class="ea-line" d="M102 4v26"/><ellipse class="ea-line ea-fill" cx="102" cy="34" rx="4.4" ry="3.6"/>' +
    '<path class="ea-line" d="M97.6 33l-5-3.4M97.6 35l-5.4 1.4M106.4 33l5-3.4M106.4 35l5.4 1.4M99 37l-3 4M105 37l3 4"/></g>',

  // An empty display case. The velvet has a dent in it. Somebody was here.
  cabinet:
    '<path class="ea-line ea-fill" d="M31 70V32a29 29 0 0 1 58 0v38z"/><path class="ea-line" d="M26 70h68M31 62h58"/>' +
    '<path class="ea-line ea-acc" d="M44 62c4-6 28-6 32 0"/><path class="ea-line faint" d="M40 30a21 21 0 0 1 12-17"/>' +
    '<g class="ea-tag"><path class="ea-line" d="M60 12v8"/><rect class="ea-line ea-fill" x="49" y="20" width="22" height="13" rx="1.6" transform="rotate(5 60 26)"/>' +
    '<path class="ea-line" d="M57 27.5c0-3 6-3 6 0 0 2-3 2-3 4.2"/><circle class="ea-dot" cx="60" cy="33.4" r=".1"/></g>' +
    '<g class="ea-bunny"><circle class="ea-line ea-fill" cx="82" cy="66" r="3.4"/><circle class="ea-line ea-fill" cx="86.5" cy="67.4" r="2.4"/><circle class="ea-line ea-fill" cx="78.6" cy="67.6" r="2.2"/></g>' +
    '<path class="ea-warm ea-twinkle" d="M101 14l1.6 4.2 4.2 1.6-4.2 1.6L101 25.6l-1.6-4.2-4.2-1.6 4.2-1.6z"/>',

  // A closed book, a ribbon and a moth that has come to read over its shoulder.
  stories:
    '<path class="ea-line ea-fill" d="M30 66V26c0-3 2-5 5-5h46c3 0 5 2 5 5v40z"/><path class="ea-line" d="M30 66c0 3 2 5 5 5h51"/>' +
    '<path class="ea-line" d="M38 21v50"/><path class="ea-line faint" d="M46 36h28M46 44h22"/>' +
    '<path class="ea-line ea-acc" d="M66 21v33l5-4 5 4V21"/>' +
    '<g class="ea-moth"><path class="ea-line ea-fill" d="M92 24c-5-6-14-5-14 0 0 5 7 6 14 5-5 2-8 6-5 10 3 3 6-1 7-6 1 5 4 9 7 6 3-4 0-8-5-10 7 1 14 0 14-5 0-5-9-6-14 0z" transform="scale(.8) translate(18 4)"/></g>' +
    '<g class="ea-flame"><path class="ea-warm" d="M20 34c2 3 3 4 3 6a3 3 0 0 1-6 0c0-2 1-3 3-6z"/><path class="ea-line" d="M20 43v10"/></g>',

  // A front door with a lit window, a mat and a knocker. Nobody has knocked.
  friends:
    '<path class="ea-line ea-fill" d="M38 72V28a22 22 0 0 1 44 0v44z"/><path class="ea-line" d="M30 72h60"/>' +
    '<circle class="ea-line ea-acc" cx="60" cy="30" r="7"/><path class="ea-warm ea-win" d="M60 24.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11z" opacity=".5"/>' +
    '<circle class="ea-line ea-knock" cx="60" cy="49" r="3.2"/><path class="ea-line" d="M60 45.8v-3"/>' +
    '<rect class="ea-line ea-fill" x="46" y="74" width="28" height="6" rx="2"/><path class="ea-line faint" d="M51 77h18"/>' +
    '<circle class="ea-line" cx="76" cy="58" r="1.6"/>',

  // A chalkboard of scores nobody has written, and a lonely candle.
  board:
    '<rect class="ea-line ea-fill" x="22" y="12" width="66" height="50" rx="3"/><path class="ea-line" d="M26 62l-4 12M84 62l4 12"/>' +
    '<path class="ea-line dotted" d="M34 26h8M34 37h8M34 48h8M50 26h28M50 37h24M50 48h18"/>' +
    '<g class="ea-flame"><path class="ea-warm" d="M102 36c2 3 3 4 3 6a3 3 0 0 1-6 0c0-2 1-3 3-6z"/><path class="ea-line ea-fill" d="M98 46h8v26h-8z"/></g>',

  // Two tin cans and a string that does not reach.
  offline:
    '<g class="ea-line ea-fill"><path d="M12 34h22v26a11 5 0 0 1-22 0z"/><ellipse cx="23" cy="34" rx="11" ry="5"/></g>' +
    '<g class="ea-line ea-fill"><path d="M86 34h22v26a11 5 0 0 1-22 0z"/><ellipse cx="97" cy="34" rx="11" ry="5"/></g>' +
    '<path class="ea-line ea-acc" d="M34 40c8 2 12 8 17 12"/><path class="ea-line ea-acc" d="M86 40c-7 3-11 6-15 12"/>' +
    '<path class="ea-line faint" d="M54 54l3 3M66 54l-3 3M57 51l3 3 3-3"/>' +
    '<path class="ea-warm ea-twinkle" d="M60 20l1.4 3.6 3.6 1.4-3.6 1.4L60 30l-1.4-3.6L55 25l3.6-1.4z"/>'
};

export const EMPTY_KINDS = Object.keys(ART);

export function emptyArt(kind) {
  const body = ART[kind] || ART.notes;
  return '<svg class="empty-art" viewBox="0 0 120 84" focusable="false" aria-hidden="true">' + body + '</svg>';
}

/* ================= SEASONS =================
   A season is a date window (month is 0 to 11, day 1 to 31, inclusive, and it
   comes round every year) in which the coffins can also hold seasonal curios.
   They join the cabinet like any other curio and stay there. Nothing is taken
   away when a season ends: the curios you have keep their place and the rest
   wait for next year. */

export const SEASON_RARITY = { id: 'season', label: 'Seasonal', refund: 30, weight: 0 };

export const SEASONS = [
  {
    id: 'thin-season', name: 'The Thin Season', from: [9, 15], to: [10, 2], chance: 0.25,
    blurb: 'The wall between the shelf and everywhere else is thin, and something is leaning on it.',
    curios: [
      { id: 'ts-pumpkin', name: 'Pumpkin Carved Under Protest', rarity: 'season', glyph: 'head', text: 'The face is smiling. The pumpkin says it was not consulted. It has asked to be lit before eleven.' },
      { id: 'ts-sheet', name: 'A Sheet With Two Holes', rarity: 'season', glyph: 'ghost', text: 'It is not a ghost. It is a sheet. The ghost inside is very firm about that distinction.' },
      { id: 'ts-candy', name: 'Fun-Size Regret', rarity: 'season', glyph: 'jar', text: 'Wrapped in the last of the good wrappers. Inside is one raisin and a note that says “trick”.' },
      { id: 'ts-broom', name: 'Broom, Unlicensed', rarity: 'season', glyph: 'shovel', text: 'It flies, technically. Nobody has checked the insurance. The cat rides on the back and refuses to hold on.' },
      { id: 'ts-bat', name: 'Bat, Slightly Damp', rarity: 'season', glyph: 'raven', text: 'It came in through the window and stayed for the soup. It has not mentioned leaving.' },
      { id: 'ts-lantern', name: 'Lantern With a Name', rarity: 'season', glyph: 'lamp', text: 'The flame inside answers to Derek. Derek has been lit since 1911 and would like a day off.' }
    ]
  }
];

export const SEASONAL_CURIOS = SEASONS.flatMap(s => s.curios);

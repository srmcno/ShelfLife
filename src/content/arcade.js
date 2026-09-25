/* ================= THE ARCADE =================
   Four short games. Each one is endless, gets faster, and ends when you run
   out of luck. Instructions are one line because nobody reads the second.
   `tiers` are score thresholds for the result quips; `pay` is score per soul. */

export const ARCADE_GAMES = [
  { id: 'frenzy', title: 'Feeding Frenzy', kind: 'Catch', glyph: 'teeth', accent: '#F6C768',
    hook: 'Catch the snacks. Dodge the holy water.',
    howto: 'Drag, tap either side, or use ← →. Three hits and it is over.',
    pay: 3, tiers: [15, 40, 80] },
  { id: 'stack', title: 'Coffin Stack', kind: 'Timing', glyph: 'coffin', accent: '#C49BFF',
    hook: 'Stack the coffins. Higher is holier.',
    howto: 'Tap, click or press Space to drop. Overhang gets sawn off.',
    pay: 1, tiers: [6, 14, 25] },
  { id: 'seance', title: 'The Séance', kind: 'Memory', glyph: 'candle', accent: '#7FD8C0',
    hook: 'The dead are spelling something. Repeat it.',
    howto: 'Watch the candles, then tap them in order, or press 1 to 4. One mistake is forgiven.',
    pay: 0.5, tiers: [4, 8, 13] },
  { id: 'whack', title: 'Grave Whack', kind: 'Reflex', glyph: 'grave', accent: '#FF6F7F',
    hook: 'Push the dead back down. Not the widow.',
    howto: 'Tap a hand before it climbs out. Never tap a mourner. Three strikes.',
    pay: 3, tiers: [15, 35, 60] }
];
export const ARCADE_BY_ID = Object.fromEntries(ARCADE_GAMES.map(g => [g.id, g]));

/* Falling things in Feeding Frenzy. Good things score; bad things cost a life. */
export const FRENZY_ITEMS = {
  crumb: { good: true, points: 1, glyph: 'bone', weight: 40, label: 'a crumb' },
  raisin: { good: true, points: 2, glyph: 'bug', weight: 22, label: 'a raisin with legs' },
  tooth: { good: true, points: 3, glyph: 'tooth', weight: 14, label: 'a tooth' },
  heart: { good: true, points: 5, glyph: 'heart', weight: 4, label: 'a still-beating heart', frenzy: true },
  holy: { good: false, glyph: 'bottle', weight: 14, label: 'holy water' },
  soap: { good: false, glyph: 'glow', weight: 10, label: 'a bar of soap' },
  trap: { good: false, glyph: 'nail', weight: 8, label: 'a mousetrap' }
};

/* Result lines. {n} is the resident's name. Picked by tier: 0 = below the
   first threshold, 3 = above the last. */
export const ARCADE_QUIPS = {
  frenzy: [
    ['{n} is still hungry. {n} is looking at your fingers.', '{n} caught almost nothing and blames the gravity.', '{n} has been hit by holy water and is sulking in a way that steams.'],
    ['{n} ate well. Nobody saw where it all went. {n} is the same size.', '{n} has a full mouth and an empty expression.', 'A respectable feed. {n} saved a tooth for later.'],
    ['{n} is fat with crumbs and smug about it.', '{n} caught so much the bowl has filed a complaint.', 'The ceiling is out of snacks. {n} checked.'],
    ['{n} has eaten everything that fell and one thing that did not.', 'Legendary. {n} is now mostly biscuit.', 'Nothing that fell survived. {n} is licking the sky.']
  ],
  stack: [
    ['The coffins fell over. Everyone inside is fine. Everyone inside is annoyed.', 'A small pile. More of a heap. More of a crime scene.', '{n} watched it collapse and applauded anyway.'],
    ['A tidy little mausoleum. {n} has moved in on the top floor.', 'Respectable. The undertaker nodded once.', '{n} is sitting on top, pretending it planned this.'],
    ['A tower of coffins. The council is concerned. {n} is thrilled.', 'You can see the church from up there. The church can see you.', 'The top coffin can see its own funeral from here.'],
    ['A skyscraper of the dead. Aircraft have been diverted.', '{n} is so high up it has met a bat socially.', 'The tallest pile of coffins in the parish. Possibly the country.']
  ],
  seance: [
    ['The spirits hung up. {n} says they were rude first.', 'You summoned something. It asked to speak to someone else.', 'The candles went out in a disappointed way.'],
    ['The dead spelled “HELLO”. Then “WHO IS THIS”. Then nothing.', '{n} heard from a great-aunt. She wants her teeth back.', 'A short conversation with the other side. It was mostly about weather.'],
    ['The spirits are impressed. One of them asked for your number.', '{n} is fluent in candle now. It will not stop showing off.', 'Something in the drawer is clapping. Slowly.'],
    ['You have opened a direct line to the afterlife. It has hold music.', 'The dead have made {n} an honorary member. There is a hat.', 'Every ghost in the house came to watch. They brought snacks.']
  ],
  whack: [
    ['The dead got out. They are in the kitchen. They are eating the good biscuits.', 'The dead got out and nobody wrote down which way they went.', '{n} watched the whole thing through its fingers.'],
    ['Most of the dead stayed dead. A decent night’s work.', '{n} counted the ones that got away. It is not telling.', 'The graveyard is quieter. The widow is still glaring.'],
    ['Nothing got out. {n} is patting the soil down with real pride.', 'The dead have filed a complaint about excessive force.', '{n} wants to do this professionally.'],
    ['The graveyard has never been so orderly. The dead have unionised in protest.', 'A perfect night. The widow sent a thank-you card. It was damp.', 'You are now the most feared thing in the cemetery. {n} is so proud.']
  ]
};

export const NEW_BEST_LINES = [
  'New personal best. {n} is carving it into the shelf.',
  'New record. {n} demands a plaque. A small one. On a tooth.',
  'A new best. The dead are talking about it.'
];

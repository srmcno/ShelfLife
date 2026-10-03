/* ================= THE ARCADE =================
   Four short games. Each one is endless, gets harder in waves, and ends when
   you run out of luck. Instructions are one line because nobody reads the
   second.

   `tiers` are the three skull thresholds (score needed for skull 1, 2 and 3).
   They drive the result quips, the medals and the ladder on the HUD.
   `pay` is SOULS PER POINT: the final score is multiplied by it, and the
   shared daily purse (GAME_SOULS_PER_DAY in engine/mayhem.js) caps the total.
   It is not "score per soul". The numbers are chosen so a run that earns the
   same skull pays about the same souls per minute in every game.
   `ranks` name the three skulls. */

export const ARCADE_GAMES = [
  { id: 'frenzy', title: 'Feeding Frenzy', kind: 'Catch', glyph: 'teeth', accent: '#F6C768',
    hook: 'Catch the snacks. Dodge the holy water.',
    howto: 'Drag, tap either side, or use ← →. Three hits and it is over.',
    ready: 'Mouths ready.', pay: 0.36, tiers: [30, 80, 160], ranks: ['Peckish', 'Glutton', 'Bottomless'] },
  { id: 'stack', title: 'Coffin Stack', kind: 'Timing', glyph: 'casket', accent: '#C49BFF',
    hook: 'Stack the coffins. Higher is holier.',
    howto: 'Tap, click or press Space to drop. Overhang gets sawn off.',
    ready: 'Steady hands.', pay: 0.6, tiers: [10, 22, 42], ranks: ['Shallow grave', 'Mausoleum', 'Cathedral'] },
  { id: 'seance', title: 'The Séance', kind: 'Memory', glyph: 'candle', accent: '#7FD8C0',
    hook: 'The dead are spelling something. Repeat it.',
    howto: 'Watch the candles, then tap them in order, or press 1 to 4. One mistake is forgiven.',
    ready: 'Hush.', pay: 3.5, tiers: [8, 13, 18], ranks: ['Table-rapper', 'Medium', 'Switchboard'] },
  { id: 'whack', title: 'Grave Whack', kind: 'Reflex', glyph: 'grave', accent: '#FF6F7F',
    hook: 'Push the dead back down. Not the widow.',
    howto: 'Tap a hand before it climbs out. Never tap a mourner. Three strikes.',
    ready: 'Shovels up.', pay: 0.33, tiers: [25, 80, 160], ranks: ['Groundskeeper', 'Sexton', 'Warden of the Yard'] }
];
export const ARCADE_BY_ID = Object.fromEntries(ARCADE_GAMES.map(g => [g.id, g]));

/* Score ceilings. The server refuses anything above these (supabase/migrations
   0002_social.sql, private.score_cap) and src/cloud/social.js mirrors them, so
   the engine clamps a finished run to them and the tests pin all three lists
   to one another. No honest run comes close. */
export const ARCADE_SCORE_CAPS = { frenzy: 3000, stack: 500, seance: 150, whack: 2500 };

/* The thresholds before the arcade was rebalanced. Medals were seeded from
   these, so nobody loses a skull they had already earned. */
export const LEGACY_TIERS = { frenzy: [15, 40, 80], stack: [6, 14, 25], seance: [4, 8, 13], whack: [15, 35, 60] };

/* Falling things in Feeding Frenzy. Good things score; bad things cost a life.
   Glyph names come from art/mayhem-glyphs.js or art/arcade-art.js. */
export const FRENZY_ITEMS = {
  crumb: { good: true, points: 1, glyph: 'bone', weight: 40, label: 'a crumb' },
  raisin: { good: true, points: 2, glyph: 'bug', weight: 22, label: 'a raisin with legs' },
  tooth: { good: true, points: 3, glyph: 'tooth', weight: 14, label: 'a tooth' },
  heart: { good: true, points: 5, glyph: 'heart', weight: 4, label: 'a still-beating heart', frenzy: true },
  holy: { good: false, glyph: 'bottle', weight: 14, label: 'holy water' },
  soap: { good: false, glyph: 'soap', weight: 10, label: 'a bar of soap' },
  trap: { good: false, glyph: 'trap', weight: 8, label: 'a mousetrap' }
};

/* Waves. Feeding Frenzy and Grave Whack run on a plan: each entry is a stretch
   of play with its own rules. The plan plays once, then loops from entry 1
   with the pace still rising. Lengths are in seconds. */
export const FRENZY_PLAN = [
  { kind: 'warm', len: 16 }, { kind: 'feast', len: 14 }, { kind: 'procession', len: 16 }, { kind: 'boss', len: 15 },
  { kind: 'draught', len: 16 }, { kind: 'feast', len: 12 }, { kind: 'procession', len: 16 }, { kind: 'boss', len: 16 }
];
export const FRENZY_WAVES = {
  warm: { name: 'Dinner is served', line: 'Everything that falls is food. Mostly.' },
  feast: { name: 'The feast', line: 'Hearts and teeth. The water has gone to church.' },
  procession: { name: 'Holy procession', line: 'Mind the gaps. The Church does not.' },
  draught: { name: 'Draughty larder', line: 'A window is open and it is not saying which.' },
  boss: { name: 'Brother Aldous', line: 'He has brought the good water, in quantity.' }
};
export const FRENZY_BOSS_LINES = {
  clean: ['Not a drop touched you. Aldous has gone to lie down.', 'Aldous is out of water and out of arguments.', 'Flawless. Aldous is writing you a strongly worded blessing.'],
  scuffed: ['Aldous has gone home, pleased with his aim.', 'Aldous leaves, damp and unrepentant.', 'The sermon is over. You were mentioned in it.']
};

export const WHACK_PLAN = [
  { kind: 'calm', len: 20 }, { kind: 'rush', len: 14 }, { kind: 'funeral', len: 14 }, { kind: 'gold', len: 10 },
  { kind: 'rush', len: 16 }, { kind: 'funeral', len: 16 }, { kind: 'gold', len: 10 }
];
export const WHACK_WAVES = {
  calm: { name: 'Quiet night', line: 'Hands first. Do not wake the widow.' },
  rush: { name: 'Overcrowding', line: 'The cemetery is over capacity. They are taking it personally.' },
  funeral: { name: 'Funeral party', line: 'The widow brought friends. Leave all of them alone.' },
  gold: { name: 'Gold fever', line: 'The gold-toothed dead are about. Be quick, be grabby.' }
};

/* Words for the run flow. */
export const COUNTDOWN_WORDS = ['3', '2', '1'];
export const SKULL_LINES = [
  'First skull. The dead have noticed you.',
  'Second skull. The dead have stopped being polite.',
  'Third skull. There is a plaque being discussed.'
];
export const STACK_HEIGHT_LINES = {
  8: 'Eight coffins. The pigeons have noticed.',
  16: 'Cloud level. Damp, and judging.',
  24: 'Bats at eye level. They have opinions.',
  32: 'The moon has stopped to look.',
  42: 'Higher than the church. The church is livid.',
  54: 'Nobody has told the angels. They are checking the paperwork.'
};

/* Cosmetic arenas. They only change the colours behind the game. Unlocked by
   lifetime runs (all games, challenge runs included) or by medals (the total
   of the best skulls across the four games, at most 12). */
export const ARCADE_THEMES = [
  { id: 'dusk', title: 'Dusk', line: 'The usual light. Nobody has complained.', need: null,
    sky: ['#2a1b36', '#120c1a'], ground: '#2b1822', glow: '#f6c768', fog: '#8a6a9e', star: '#f2e9dc' },
  { id: 'moonlit', title: 'Moonlit', line: 'A clear night. The dead can see what they are doing.', need: { runs: 10 },
    sky: ['#1b2748', '#0a0f22'], ground: '#1a2036', glow: '#bcd4ff', fog: '#6f86b8', star: '#e8f0ff' },
  { id: 'embers', title: 'Embers', line: 'Something is burning, politely, in the next room.', need: { runs: 30 },
    sky: ['#4a1d1a', '#1a0a0c'], ground: '#2a1210', glow: '#ff9a4a', fog: '#b0503a', star: '#ffd9a8' },
  { id: 'frost', title: 'Hard frost', line: 'Everything is crisp, including the widow.', need: { medals: 4 },
    sky: ['#1d3a46', '#0a1a22'], ground: '#1b2f38', glow: '#9fe8ff', fog: '#7fc4d6', star: '#eafcff' },
  { id: 'fog', title: 'Pea soup', line: 'You can see about one coffin ahead. Good luck.', need: { medals: 8 },
    sky: ['#2c3a2a', '#101810'], ground: '#1d2a1c', glow: '#c9e58a', fog: '#8aa57a', star: '#e6f2c8' },
  { id: 'gilded', title: 'Gilded', line: 'Someone has been at the paint with ambition.', need: { medals: 12 },
    sky: ['#4a3612', '#1c1405'], ground: '#33260c', glow: '#ffd75e', fog: '#c9a24a', star: '#fff2c0' }
];
export const THEME_BY_ID = Object.fromEntries(ARCADE_THEMES.map(t => [t.id, t]));
export const DEFAULT_THEME = 'dusk';

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

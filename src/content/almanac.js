/* ================= THE ALMANAC =================
   A calendar of monthly chapters, pre-written so the shelf has something new to
   offer for well over a year without an update. Each chapter has a free
   30-tier track, four limited curios, a room set, a title and a final badge.

   Writing rules for this file: dry, dark, specific and petty. The joke is the
   precise absurd detail, delivered flat. Curly quotes in anything a player reads,
   and no dashes of any kind: commas, colons and full stops do the work.

   This module is data only. It imports nothing, so state, engines and the UI
   can all read it without a cycle.

   Dates are local calendar dates ('2026-10-01'). A chapter runs from `from`
   to `to`, both inclusive. Chapters are contiguous: each starts the day after
   the last one ended. After the final chapter the calendar encores: the same
   month of the last year comes round again, with its prizes converted to souls
   for anything already owned (see engine/almanac.js chapterAt). */

export const EDITION_RARITY = { id: 'edition', label: 'Almanac edition', refund: 60, weight: 0 };

// The track every chapter shares. Tier XP is spread over the chapter by its
// length (engine/almanac.js tierXp), so a short month asks for less.
export const TIERS = 30;
export const TRACK_XP_PER_DAY = 40;

/* What each tier pays. kind: souls | curio (index into the chapter's four) |
   decor (the room set) | title | badge (the final badge, plus souls). */
export const TRACK = [
  { tier: 1, kind: 'souls', amount: 25 },
  { tier: 2, kind: 'souls', amount: 25 },
  { tier: 3, kind: 'souls', amount: 30 },
  { tier: 4, kind: 'souls', amount: 30 },
  { tier: 5, kind: 'curio', index: 0 },
  { tier: 6, kind: 'souls', amount: 35 },
  { tier: 7, kind: 'souls', amount: 35 },
  { tier: 8, kind: 'souls', amount: 40 },
  { tier: 9, kind: 'souls', amount: 40 },
  { tier: 10, kind: 'curio', index: 1 },
  { tier: 11, kind: 'souls', amount: 45 },
  { tier: 12, kind: 'souls', amount: 45 },
  { tier: 13, kind: 'souls', amount: 50 },
  { tier: 14, kind: 'souls', amount: 50 },
  { tier: 15, kind: 'decor' },
  { tier: 16, kind: 'souls', amount: 55 },
  { tier: 17, kind: 'souls', amount: 55 },
  { tier: 18, kind: 'curio', index: 2 },
  { tier: 19, kind: 'souls', amount: 60 },
  { tier: 20, kind: 'souls', amount: 60 },
  { tier: 21, kind: 'souls', amount: 65 },
  { tier: 22, kind: 'souls', amount: 65 },
  { tier: 23, kind: 'curio', index: 3 },
  { tier: 24, kind: 'souls', amount: 70 },
  { tier: 25, kind: 'souls', amount: 70 },
  { tier: 26, kind: 'title' },
  { tier: 27, kind: 'souls', amount: 80 },
  { tier: 28, kind: 'souls', amount: 80 },
  { tier: 29, kind: 'souls', amount: 90 },
  { tier: 30, kind: 'badge', amount: 120 }
];

/* Almanac XP comes from things the game already has. Every source is capped per
   local day, and the day as a whole is capped too, so nothing can be farmed.
   per: XP for each act. cap: the most XP that source can pay in one day. */
export const XP_RULES = {
  care: { per: 1, cap: 8, label: 'Looking after residents' },
  emergency: { per: 3, cap: 15, label: 'Surviving emergencies' },
  coffin: { per: 2, cap: 6, label: 'Opening coffins' },
  omen: { per: 6, cap: 6, label: 'Reading tonight’s omen' },
  chore: { per: 3, cap: 9, label: 'Finishing chores' },
  choresAll: { per: 4, cap: 4, label: 'All three chores' },
  court: { per: 8, cap: 16, label: 'Airing Shelf Court' },
  docket: { per: 5, cap: 5, label: 'Airing the docket' },
  arcade: { per: 3, cap: 9, label: 'Arcade runs' },
  daily: { per: 6, cap: 6, label: 'The daily challenge' },
  expedition: { per: 8, cap: 16, label: 'Expeditions' }
};
export const DAILY_XP_CAP = 60;
// Bonuses that happen at most once per chapter, week or return, so they sit outside the daily cap.
export const SPOTLIGHT_XP = 20;
export const WEEKLY_XP = 35;
export const CHEST_XP = 20;
export const RETURN_XP_PER_DAY = 12;

// The weekly chest and what each challenge pays. A week is Monday to Sunday, local time.
export const WEEKLY_SOULS = 30;
export const CHEST_SOULS = 120;

/* Three challenges a week, one from each of three different families, picked
   by the week number so every device agrees without a server. `kind` is a
   counter the Almanac keeps from things the game already counts. */
export const WEEKLY_FAMILIES = [
  ['emergency', 'coffin'],
  ['care', 'chore', 'omen'],
  ['court', 'arcade', 'daily', 'docket'],
  ['expedition', 'curio']
];
export const WEEKLY_POOL = [
  { id: 'emergency-8', kind: 'emergency', need: 8, label: 'Loss adjuster', line: 'Resolve 8 emergencies' },
  { id: 'emergency-14', kind: 'emergency', need: 14, label: 'Crisis tourism', line: 'Resolve 14 emergencies' },
  { id: 'emergency-22', kind: 'emergency', need: 22, label: 'The usual Tuesday', line: 'Resolve 22 emergencies' },
  { id: 'coffin-3', kind: 'coffin', need: 3, label: 'Browsing the undertaker', line: 'Open 3 coffins' },
  { id: 'coffin-6', kind: 'coffin', need: 6, label: 'Regular customer', line: 'Open 6 coffins' },
  { id: 'care-18', kind: 'care', need: 18, label: 'Hands-on', line: 'Care for residents 18 times' },
  { id: 'care-30', kind: 'care', need: 30, label: 'Dangerously attentive', line: 'Care for residents 30 times' },
  { id: 'chore-8', kind: 'chore', need: 8, label: 'Domestic duties', line: 'Finish 8 chores' },
  { id: 'chore-12', kind: 'chore', need: 12, label: 'Mop and bucket', line: 'Finish 12 chores' },
  { id: 'omen-4', kind: 'omen', need: 4, label: 'Reading the cards', line: 'Turn over the omen on 4 different days' },
  { id: 'omen-6', kind: 'omen', need: 6, label: 'Faithful to the candle', line: 'Turn over the omen on 6 different days' },
  { id: 'court-3', kind: 'court', need: 3, label: 'Sitting on the bench', line: 'Air 3 Shelf Court cases' },
  { id: 'court-5', kind: 'court', need: 5, label: 'Judge in residence', line: 'Air 5 Shelf Court cases' },
  { id: 'arcade-6', kind: 'arcade', need: 6, label: 'Gentle button abuse', line: 'Finish 6 arcade runs' },
  { id: 'arcade-10', kind: 'arcade', need: 10, label: 'Thumbs, mostly', line: 'Finish 10 arcade runs' },
  { id: 'daily-3', kind: 'daily', need: 3, label: 'Challenge accepted', line: 'Finish the daily challenge on 3 days' },
  { id: 'daily-5', kind: 'daily', need: 5, label: 'Challenge, repeatedly', line: 'Finish the daily challenge on 5 days' },
  { id: 'docket-3', kind: 'docket', need: 3, label: 'On the docket', line: 'Air the docket on 3 days' },
  { id: 'docket-5', kind: 'docket', need: 5, label: 'Court regular', line: 'Air the docket on 5 days' },
  { id: 'expedition-2', kind: 'expedition', need: 2, label: 'Out and back', line: 'Send 2 expeditions' },
  { id: 'expedition-3', kind: 'expedition', need: 3, label: 'Hardly home', line: 'Send 3 expeditions' },
  { id: 'curio-3', kind: 'curio', need: 3, label: 'Fresh evidence', line: 'Add 3 curios you did not have' },
  { id: 'curio-5', kind: 'curio', need: 5, label: 'Acquisitive', line: 'Add 5 curios you did not have' }
];

/* Chapters. `decor` names the room set: a room paint, a shelf wood and a wall.
   content/decor.js builds the real room and wood entries from these. `mark` is
   what is stamped on the curio: g:<glyph> from art/mayhem-glyphs.js or
   c:<shape> from art/curios.js. `form` is the shape of the object. */
const FLAG_HOOKS_26 = [
  'Somewhere behind the skirting board, something took notes.',
  'The wall was thin there. It is thinner now.',
  '{a} swears the candle burned a different colour while it happened.',
  'A pumpkin on the windowsill turned to watch. Nobody has carved it. It has an expression anyway.',
  'The draught came from inside the wall. {a} has asked it to leave a forwarding address.',
  'Something knocked twice, politely, from the far side. It sounded like a tradesman.',
  'The Thin Season ruling: if it happened near a mirror, it counts double. Nobody has said for what.',
  'Every shadow in the room was pointing the same way, and it was not away from the light.'
];
const FLAG_HOOKS_27 = [
  'The wall is thinner than last year and has stopped pretending it is not.',
  '{a} swears the rota had this down for Thursday. The rota is wrong, and also on fire.',
  'Something on the far side applied for a visitor’s pass. It has been granted. It is already in.',
  'A second pumpkin, unrequested, has appeared next to the first. They are not speaking.',
  'The cupboard door opened and closed by itself. It looked like it had remembered something.',
  'There was a cold patch. It was the exact size of a resident and stood there for a while.',
  'The candle guttered, and then, for some reason, the other candles guttered with it, in sympathy.',
  'Someone in the wall tutted. It was the tut of a person who has been left on hold for years.'
];

export const CHAPTERS = [
  {
    id: 'thin-2026', no: 1, name: 'The Thin Season', month: 'October 2026', from: '2026-10-01', to: '2026-11-02',
    flagship: true, season: 'thin-season', motif: 'moon',
    colors: { a: '#2A1233', b: '#0E0716', glow: '#FF9A3C' },
    blurb: 'The wall between the shelf and everywhere else is wearing through. Something has taped a notice to the far side. The notice says PULL.',
    curios: [
      { id: 'al1-treat-bag', name: 'Trick-or-Treat Bag, Overnight', form: 'pouch', mark: 'g:hand', text: 'Collected from ninety-one doors. Eleven opened. Two of those are still counting what they gave.' },
      { id: 'al1-wall-swatch', name: 'A Swatch of the Wall, Thin Part', form: 'shard', mark: 'g:veil', text: 'Cut from the bit that is currently thin. Hold it to the light and the light holds back.' },
      { id: 'al1-cobweb', name: 'Cobweb, Premium Grade', form: 'frame', mark: 'g:spider', text: 'Spun by a spider who was promised exposure. It has had the exposure. It has also had the complaints.' },
      { id: 'al1-cold-candle', name: 'Candle That Burns Cold', form: 'lantern', mark: 'g:flame', text: 'Gives off no heat and a great deal of opinion. Lit by the dead, who like to save on the electric.' }
    ],
    decor: { room: { id: 'pumpkin-hollow', name: 'Pumpkin Hollow', a: '#3A1A14', b: '#170A08', key: '#FF9A3C' }, wood: { id: 'burnt-pumpkin', name: 'Burnt Pumpkin', wood: '#7A3A12', lip: '#B8601E' }, wall: 'scallop' },
    title: 'Warden of the Thin Part', badge: 'Seen It Through the Wall',
    spotlight: ['fake-seance', 'haunted-sock'], hooks: FLAG_HOOKS_26
  },
  {
    id: 'fog-2026', no: 2, name: 'Fog Quarter', month: 'November 2026', from: '2026-11-03', to: '2026-11-30', motif: 'fog',
    colors: { a: '#2A3744', b: '#0E141B', glow: '#9FC4D9' },
    blurb: 'Visibility is a rumour. The shelf is thirty centimetres long and nobody can confirm it.',
    curios: [
      { id: 'al2-bottled-fog', name: 'Fog, Bottled (Do Not Shake)', form: 'jar', mark: 'g:glow', text: 'The label says 750 ml. The label has been wrong about the weather before.' },
      { id: 'al2-umbrella', name: 'Umbrella With Opinions', form: 'tag', mark: 'c:rain', text: 'Opens by itself whenever it is about to be wrong about the forecast. It is wrong a lot. It is always open.' },
      { id: 'al2-lamppost', name: 'Lamppost, Nobody Lit', form: 'lantern', mark: 'g:lamp', text: 'Stands in the corner with its head up, waiting for a lamplighter who retired in 1931. The cat leaves it small gifts.' },
      { id: 'al2-foghorn', name: 'Foghorn, Muffled', form: 'medal', mark: 'c:bell', text: 'Sounds once an hour. The sound arrives the next morning, apologising.' }
    ],
    decor: { room: { id: 'sea-fret', name: 'Sea Fret', a: '#2A3744', b: '#0E141B', key: '#9FC4D9' }, wood: { id: 'wet-driftwood', name: 'Wet Driftwood', wood: '#5C6A70', lip: '#8397A0' }, wall: 'waves' },
    title: 'Navigator by Guesswork', badge: 'Lost, Found, Lost Again',
    spotlight: ['stolen-shadow'],
    hooks: [
      'The fog came in partway through this and has not been asked to leave.',
      'Visibility was four inches. {a} filed it as an act of God and did not say which one.',
      'Nobody saw it happen. Several people have confirmed it anyway.'
    ]
  },
  {
    id: 'night-2026', no: 3, name: 'The Long Night', month: 'December 2026', from: '2026-12-01', to: '2026-12-31', motif: 'snow',
    colors: { a: '#17301F', b: '#0A140D', glow: '#F2D27A' },
    blurb: 'The longest night of the year, and the shelf has been decorated against its will. There are lights on it. Some are not electric.',
    curios: [
      { id: 'al3-advent', name: 'Advent Calendar, Door 25', form: 'card', mark: 'g:door', text: 'Nobody knows what is behind it, because the calendar stops at 24. It has begun to sweat.' },
      { id: 'al3-tinsel', name: 'Tinsel, Ongoing', form: 'coin', mark: 'c:ribbon', text: 'Found in the hoover, the bath and a resident. It has been in the family for generations. So has the resident.' },
      { id: 'al3-mulled', name: 'Mulled Formaldehyde', form: 'bottle', mark: 'g:bottle', text: 'A festive jar of the usual. Smells of cloves and a hospital. Served warm to guests who are, to a man, suspicious.' },
      { id: 'al3-pie', name: 'The Last Mince Pie', form: 'plate', mark: 'g:cake', text: 'Left out for a visitor. The visitor ate it and left a note about the pastry. The note is the real present.' }
    ],
    decor: { room: { id: 'midwinter-parlour', name: 'Midwinter Parlour', a: '#17301F', b: '#0A140D', key: '#F2D27A' }, wood: { id: 'holly-black', name: 'Holly Black', wood: '#26302A', lip: '#3F5246' }, wall: 'stars' },
    title: 'Keeper of the Long Candle', badge: 'Survived the Gifts',
    spotlight: ['tontine'],
    hooks: [
      'Someone has hung tinsel on it. It was not tinsel’s turn.',
      '{a} opened it early and wrapped it up again, badly, as a different thing.',
      'A paper hat appeared halfway through. Nobody put it on voluntarily.'
    ]
  },
  {
    id: 'resolve-2027', no: 4, name: 'Resolutions of the Dead', month: 'January 2027', from: '2027-01-01', to: '2027-01-31', motif: 'calendar',
    colors: { a: '#243528', b: '#0C140E', glow: '#C8E8D4' },
    blurb: 'A new year. The residents have all resolved to improve. The fridge has heard this before.',
    curios: [
      { id: 'al4-resolution', name: 'Resolution, Barely Used', form: 'tag', mark: 'g:scroll', text: 'Written on the first. Folded on the second. Found on the third, under something that was never going to be exercised.' },
      { id: 'al4-gym', name: 'Gym Membership, Posthumous', form: 'card', mark: 'c:medal', text: 'Valid for life, which the member has already finished. The gym is flexible on the terms and rigid on the fees.' },
      { id: 'al4-kale', name: 'Kale, Reanimated', form: 'jar', mark: 'g:mushroom', text: 'Rose from the crisper drawer on the fourth day. It is healthier than any of us and will not stop saying so.' },
      { id: 'al4-calendar', name: 'Calendar With Extra Days', form: 'book', mark: 'g:clock', text: 'Has a thirty-second of January. Everyone who uses it is a little behind and a lot more relaxed.' }
    ],
    decor: { room: { id: 'dry-january', name: 'Dry January', a: '#243528', b: '#0C140E', key: '#C8E8D4' }, wood: { id: 'pale-ash', name: 'Pale Ash', wood: '#8A8F7C', lip: '#B3B8A1' }, wall: 'plaid' },
    title: 'Resolved, Technically', badge: 'Lasted Until the Fourteenth',
    spotlight: ['practice-burial'],
    hooks: [
      '{a} has resolved to do better. This is the third such resolution since Tuesday.',
      'It was meant to be a fresh start. It was a stale start with a nice cover.'
    ]
  },
  {
    id: 'valentine-2027', no: 5, name: 'The Funeral Valentine', month: 'February 2027', from: '2027-02-01', to: '2027-02-28', motif: 'hearts',
    colors: { a: '#4A1B2C', b: '#1B0A11', glow: '#FF8FB8' },
    blurb: 'Love is in the air, and so is something else. The residents have been writing to one another. Most of it is a threat with a stamp on.',
    curios: [
      { id: 'al5-heart-box', name: 'Heart in a Box, Returned', form: 'seal', mark: 'g:heart', text: 'The sender denies everything. The postmark is from a town that is not on the map and very much on the post.' },
      { id: 'al5-wrong-grave', name: 'Love Letter, Wrong Grave', form: 'card', mark: 'g:ear', text: 'Beautifully written and read aloud to the wrong headstone. The right one has heard, and is not speaking to either of them.' },
      { id: 'al5-chocolates', name: 'Chocolates, Each One Bitten', form: 'plate', mark: 'g:box', text: 'Nineteen chocolates, nineteen bites, one culprit and a very confident alibi.' },
      { id: 'al5-ring', name: 'Ring From the Bargain Bin', form: 'coin', mark: 'g:ring', text: 'Engraved “Forever” in a font that suggests the offer was limited.' }
    ],
    decor: { room: { id: 'rose-cellar', name: 'Rose Cellar', a: '#4A1B2C', b: '#1B0A11', key: '#FF8FB8' }, wood: { id: 'crushed-petal', name: 'Crushed Petal', wood: '#7A3A52', lip: '#A85A78' }, wall: 'quilt' },
    title: 'Hopeless Romantic, Legally', badge: 'Never Once Asked Out',
    spotlight: ['shared-headstone'],
    hooks: [
      'Somebody sent a card about it. It was signed with an initial, a smudge and a threat.',
      '{a} is calling it a misunderstanding. The misunderstanding has a lawyer.'
    ]
  },
  {
    id: 'thaw-2027', no: 6, name: 'The Great Thaw', month: 'March 2027', from: '2027-03-01', to: '2027-03-31', motif: 'drip',
    colors: { a: '#33362A', b: '#12140E', glow: '#8FD7A6' },
    blurb: 'Everything that was frozen is coming back up: the garden, the drains, an uncle.',
    curios: [
      { id: 'al6-thawed', name: 'Something Thawed, Unlabelled', form: 'jar', mark: 'g:ink', text: 'It was in the freezer when the freezer was bought. The freezer has since been replaced twice. The thing has stayed on, and has been polite.' },
      { id: 'al6-bootprints', name: 'Muddy Bootprints, Leading In', form: 'shard', mark: 'g:paw', text: 'They stop in the middle of the room. They do not go out again. It is a matter of principle, or of the floor.' },
      { id: 'al6-seedling', name: 'Seedling, Suspicious', form: 'cloche', mark: 'g:moth', text: 'You planted something small. Something larger has come up. It is facing the window and has started leaning toward you.' },
      { id: 'al6-inventory', name: 'Spring Cleaning Inventory', form: 'book', mark: 'c:receipt', text: 'Itemised: one sock, one tooth, one uncle’s temper, and a line reading only “ask Doreen”.' }
    ],
    decor: { room: { id: 'mud-season', name: 'Mud Season', a: '#33362A', b: '#12140E', key: '#8FD7A6' }, wood: { id: 'dark-peat', name: 'Dark Peat', wood: '#3F3426', lip: '#5E4E39' }, wall: 'rain' },
    title: 'Thawed and Not Sorry', badge: 'Found Under the Snow',
    spotlight: ['runaway-rock'],
    hooks: [
      'The thaw has brought up several things, and this was not the worst of them.',
      '{a} blames the thaw. Everyone has agreed not to repeat what the thaw said back.'
    ]
  },
  {
    id: 'fools-2027', no: 7, name: 'Fools’ Month', month: 'April 2027', from: '2027-04-01', to: '2027-04-30', motif: 'confetti',
    colors: { a: '#38204A', b: '#150C1D', glow: '#FFD166' },
    blurb: 'The residents have been told today is not the day. It is also not tomorrow. The pranks have been running for three weeks.',
    curios: [
      { id: 'al7-cushion', name: 'Whoopee Cushion, Ectoplasmic', form: 'pouch', mark: 'g:ghost', text: 'Makes a noise only the recently departed can hear, which is exactly why it is so funny to them.' },
      { id: 'al7-moustache', name: 'Moustache, Real Concern', form: 'tag', mark: 'g:brooch', text: 'Fake, glued, and growing. The glue came from the same shop as the wig, which has also started.' },
      { id: 'al7-chicken', name: 'Rubber Chicken of Office', form: 'medal', mark: 'g:raven', text: 'Presides over minor disputes with a calm that has been mistaken for competence. Not a judge. Has been asked to rule on three things.' },
      { id: 'al7-trick-coffin', name: 'Trick Coffin', form: 'frame', mark: 'g:coffin', text: 'Opens inward. Contains a smaller coffin. Contains a smaller coffin. The joke is the rest of the afternoon.' }
    ],
    decor: { room: { id: 'greasepaint', name: 'Greasepaint', a: '#38204A', b: '#150C1D', key: '#FFD166' }, wood: { id: 'painted-pine', name: 'Painted Pine', wood: '#7A4A8A', lip: '#A56EB5' }, wall: 'argyle' },
    title: 'Fool for the Cause', badge: 'It Was a Joke (It Was Not)',
    spotlight: ['tooth-fairy'],
    hooks: [
      'It may have been a prank. The evidence is split down the middle, and one half is laughing.',
      'Someone has filed this under April and a number of other months.'
    ]
  },
  {
    id: 'bloom-2027', no: 8, name: 'Overgrowth', month: 'May 2027', from: '2027-05-01', to: '2027-05-31', motif: 'sprouts',
    colors: { a: '#16382B', b: '#08150F', glow: '#F2A7C3' },
    blurb: 'Everything is blooming. The curtains have started. A resident was mistaken for a hedge and has been clipped.',
    curios: [
      { id: 'al8-can', name: 'Watering Can, Tearful', form: 'bottle', mark: 'g:teeth', text: 'Pours itself on the saddest plants first. It was not asked. The plants are working through it.' },
      { id: 'al8-gnome', name: 'Gnome, Disapproving', form: 'coin', mark: 'g:head', text: 'Has been in the garden since before the garden. Judges the beds, the paths and, at length, the pond.' },
      { id: 'al8-gary', name: 'Venus Flytrap Named Gary', form: 'jar', mark: 'g:eye', text: 'Gary has eaten a letter, two flies and a ledger. He is currently considering the postman.' },
      { id: 'al8-compost', name: 'Compost, Heirloom', form: 'plate', mark: 'g:bug', text: 'Seven generations in the heap. The newest addition is a small signed note reading “not a body”.' }
    ],
    decor: { room: { id: 'greenhouse-night', name: 'Greenhouse Night', a: '#16382B', b: '#08150F', key: '#F2A7C3' }, wood: { id: 'moss-trellis', name: 'Moss Trellis', wood: '#3F5B3A', lip: '#5F8456' }, wall: 'chevron' },
    title: 'Gardener of Doubtful Beds', badge: 'Pruned Nothing, Regretted Plenty',
    spotlight: ['stolen-slot'],
    hooks: [
      'The garden has an opinion on this. It is the same opinion as always, only taller.',
      'Something in the hedge shook, which is a normal reaction, and a different hedge answered.'
    ]
  },
  {
    id: 'midsummer-2027', no: 9, name: 'Midsummer Wake', month: 'June 2027', from: '2027-06-01', to: '2027-06-30', motif: 'sun',
    colors: { a: '#4A3A1E', b: '#18110A', glow: '#FFD28A' },
    blurb: 'The shortest night of the year. Nobody sleeps. Nobody is asked to.',
    curios: [
      { id: 'al9-sunscreen', name: 'Sunscreen, SPF Pale', form: 'bottle', mark: 'c:sun', text: 'Applied to a resident who has not seen daylight since 1922. It works. It also takes six years off him, and he is furious.' },
      { id: 'al9-tongs', name: 'Barbecue Tongs, Handled Reverently', form: 'tag', mark: 'g:nail', text: 'Used at one cook-out. Held at arm’s length ever since. The sausage was on loan.' },
      { id: 'al9-lemonade', name: 'Lemonade of the Damned', form: 'jar', mark: 'g:mirror', text: 'Sweet, sour, and from the cellar. Served in a jug with a lid, because it keeps trying to leave.' },
      { id: 'al9-deckchair', name: 'Deckchair, Reserved', form: 'frame', mark: 'g:grave', text: 'A towel has been on it since Tuesday. The owner returns on Fridays, does not sit, and always looks to be somewhere else.' }
    ],
    decor: { room: { id: 'long-dusk', name: 'Long Dusk', a: '#4A3A1E', b: '#18110A', key: '#FFD28A' }, wood: { id: 'bleached-oak', name: 'Bleached Oak', wood: '#9A8A6A', lip: '#C4B48E' }, wall: 'stripes' },
    title: 'Last to Leave the Garden', badge: 'Out Until the Light Came Back',
    spotlight: ['radiator-raffle'],
    hooks: [
      'It was still light at the time, which is the sort of thing midsummer gets away with.',
      'Nobody went home. Nobody had been sent.'
    ]
  },
  {
    id: 'dogdays-2027', no: 10, name: 'Dog Days', month: 'July 2027', from: '2027-07-01', to: '2027-07-31', motif: 'heat',
    colors: { a: '#4A2418', b: '#190C08', glow: '#FF8A5B' },
    blurb: 'It is far too warm. The candles have given up. The ghost is in the freezer and will not come out.',
    curios: [
      { id: 'al10-fan', name: 'Fan, Slowly Turning', form: 'coin', mark: 'g:flame', text: 'Moves the air from one corner to the other and back. Takes the credit for the idea of a breeze.' },
      { id: 'al10-jingle', name: 'Ice Cream Truck Jingle, Wrong Key', form: 'seal', mark: 'g:chalk', text: 'Plays from somewhere past the street at three in the morning. Nobody has seen the truck. Everybody has heard the offer.' },
      { id: 'al10-candle', name: 'Melted Candle Sculpture, Titled “Me”', form: 'lantern', mark: 'g:candle', text: 'It had a face yesterday. It now has a sense of loss and a puddle.' },
      { id: 'al10-sunburn', name: 'Sunburn, On a Skeleton', form: 'card', mark: 'g:skull', text: 'A skeleton burns anyway. This is a mystery for the sciences and a note for the fashion pages.' }
    ],
    decor: { room: { id: 'heatwave', name: 'Heatwave', a: '#4A2418', b: '#190C08', key: '#FF8A5B' }, wood: { id: 'scorched-cedar', name: 'Scorched Cedar', wood: '#6B3A22', lip: '#9A5A34' }, wall: 'dots' },
    title: 'Cool Under Pressure, Eventually', badge: 'Outlasted the Heat Death of the Shelf',
    spotlight: ['teacup-timeshare'],
    hooks: [
      'The heat made everything slightly worse and slightly slower, a combination the shelf calls its natural pace.',
      '{a} blamed the temperature. The temperature has declined to comment.'
    ]
  },
  {
    id: 'term-2027', no: 11, name: 'The Haunted Term', month: 'August 2027', from: '2027-08-01', to: '2027-08-31', motif: 'chalk',
    colors: { a: '#1F2D4A', b: '#0A101C', glow: '#9EC0FF' },
    blurb: 'Back to school. Not the residents’ school. Nobody has been told whose it is.',
    curios: [
      { id: 'al11-detention', name: 'Detention Slip, Ink Unknown', form: 'tag', mark: 'g:gavel', text: 'Issued for crimes against the register. The offender has served four hundred years and is not looking to appeal.' },
      { id: 'al11-lunchbox', name: 'Lunchbox, Contents Alive', form: 'pouch', mark: 'g:jar', text: 'It was a sandwich this morning. It is now a colleague, and has been invited to the meeting.' },
      { id: 'al11-pencil', name: 'Pencil Case of Doom', form: 'frame', mark: 'c:needle', text: 'Holds one pen, two pencils and a compass that points at you. The ruler has been measured against itself and found short.' },
      { id: 'al11-pass', name: 'Ghost’s Hall Pass', form: 'card', mark: 'g:ghost', text: 'Valid for the corridor, the stairwell and the thing under the stairwell. Signed by a teacher who has since left, in a manner of speaking.' }
    ],
    decor: { room: { id: 'detention-hall', name: 'Detention Hall', a: '#1F2D4A', b: '#0A101C', key: '#9EC0FF' }, wood: { id: 'classroom-pine', name: 'Classroom Pine', wood: '#8A6A3C', lip: '#B58E54' }, wall: 'grid' },
    title: 'Prefect of the Lower Corridor', badge: 'Never Late (Dead on Time)',
    spotlight: ['ghost-writer'],
    hooks: [
      'The incident has been entered in a register that is no longer kept, and will be marked anyway.',
      'A bell rang somewhere and everyone stopped. Nobody knew why. Everybody was sure they were in trouble.'
    ]
  },
  {
    id: 'harvest-2027', no: 12, name: 'Harvest Moon Inquest', month: 'September 2027', from: '2027-09-01', to: '2027-09-30', motif: 'fullmoon',
    colors: { a: '#4A3A1A', b: '#181208', glow: '#F6C768' },
    blurb: 'The moon is the size of a dinner plate and has views about the corn.',
    curios: [
      { id: 'al12-moon', name: 'Harvest Moon, Slightly Overripe', form: 'coin', mark: 'c:moon', text: 'Hangs low and a little soft. Bruises where touched. Has been asked, repeatedly, to go up.' },
      { id: 'al12-scarecrow', name: 'Scarecrow’s Resignation', form: 'card', mark: 'g:raven', text: 'Hand-delivered, on a field of straw. The crows have accepted it, and the farm is being run by the crows.' },
      { id: 'al12-maze', name: 'Corn Maze Map, Unfinished', form: 'tag', mark: 'c:paper', text: 'Printed with no exit, on purpose. Customers who find one are asked to hand it back.' },
      { id: 'al12-press', name: 'Cider Press', form: 'plate', mark: 'g:shovel', text: 'Squeezes apples and anything else that stands near it. Known to produce a single, tragic note.' }
    ],
    decor: { room: { id: 'stubble-field', name: 'Stubble Field', a: '#4A3A1A', b: '#181208', key: '#F6C768' }, wood: { id: 'straw-gold', name: 'Straw Gold', wood: '#8A6B22', lip: '#C4972F' }, wall: 'brick' },
    title: 'Reaper of Small Fields', badge: 'Brought the Last Sheaf Home',
    spotlight: ['crayon-will'],
    hooks: [
      'The moon was out, enormous and unhelpful, and saw the whole thing.',
      'Someone said it would keep till the harvest and has been quietly taken aside.'
    ]
  },
  {
    id: 'thin-2027', no: 13, name: 'The Thin Season, Second Sitting', month: 'October 2027', from: '2027-10-01', to: '2027-11-02',
    flagship: true, season: 'thin-season', motif: 'moon',
    colors: { a: '#36103F', b: '#12061A', glow: '#FF7A3C' },
    blurb: 'The wall has thinned again, this time with gusto. The residents have drawn up a rota. The rota is already behind.',
    curios: [
      { id: 'al13-costume', name: 'Tombstone Costume, Child’s Size', form: 'pouch', mark: 'g:photo', text: 'Worn by a trick-or-treater who stood very still all night. The neighbours were generous. The neighbours have not been back.' },
      { id: 'al13-draught', name: 'The Draught From Inside', form: 'shard', mark: 'g:shadow', text: 'Comes out of the cupboard and goes back in again. Has a route. Has, it is said, a family.' },
      { id: 'al13-pumpkin', name: 'Pumpkin, Second Opinion', form: 'cloche', mark: 'g:cake', text: 'The first one said yes. This one is checking. It is thorough, and orange, and a little behind with its notes.' },
      { id: 'al13-skeleton-key', name: 'Skeleton Key to the Same Skeleton', form: 'medal', mark: 'g:key', text: 'Opens everything on the shelf and, regrettably, the skeleton. Do not use it on the skeleton. It has asked.' }
    ],
    decor: { room: { id: 'candlelit-crypt', name: 'Candlelit Crypt', a: '#2C1138', b: '#10051A', key: '#FF7A3C' }, wood: { id: 'black-walnut', name: 'Black Walnut', wood: '#3A2A22', lip: '#5A4234' }, wall: 'web' },
    title: 'Warden of the Thinner Part', badge: 'Seen It Through the Wall, Twice',
    spotlight: ['early-eulogy', 'loaned-leg'], hooks: FLAG_HOOKS_27
  },
  {
    id: 'gravy-2027', no: 14, name: 'Gravy Season', month: 'November 2027', from: '2027-11-03', to: '2027-11-30', motif: 'steam',
    colors: { a: '#4B2A1E', b: '#1A0E0A', glow: '#E8A064' },
    blurb: 'A feast for the household. Several guests have gone missing in the gravy. The gravy is not saying.',
    curios: [
      { id: 'al14-boat', name: 'Gravy Boat, Long Haul', form: 'plate', mark: 'g:spoon', text: 'Sailed from the kitchen and never docked. The crew is gravy. The captain is the skin on top.' },
      { id: 'al14-placecard', name: 'Place Card for a Missing Guest', form: 'card', mark: 'c:portrait', text: 'Calligraphed to a very high standard. The guest has been late since 1987 and nobody wants to start without them.' },
      { id: 'al14-turkey', name: 'Turkey, Resigned', form: 'coin', mark: 'g:bone', text: 'Has accepted the situation with a dignity the stuffing could not match.' },
      { id: 'al14-pie', name: 'Pie of Uncertain Provenance', form: 'seal', mark: 'g:mouse', text: 'Tastes of apple, and of an afternoon in 1974. The crust has seen things and has closed ranks.' }
    ],
    decor: { room: { id: 'dinner-gong', name: 'Dinner Gong', a: '#4B2A1E', b: '#1A0E0A', key: '#E8A064' }, wood: { id: 'gravy-brown', name: 'Gravy Brown', wood: '#6B4226', lip: '#946038' }, wall: 'ticking' },
    title: 'Carver, Reluctantly', badge: 'Seconds Were Mandatory',
    spotlight: ['labelled-biscuit'],
    hooks: [
      'Gravy was involved. Gravy is always involved. It has a lawyer and a very smooth manner.',
      '{a} said grace afterwards, which is not the usual order, and which the table accepted.'
    ]
  },
  {
    id: 'night-2027', no: 15, name: 'The Long Night, Revised', month: 'December 2027', from: '2027-12-01', to: '2027-12-31', motif: 'snow',
    colors: { a: '#1C2548', b: '#0A0E1F', glow: '#F2C083' },
    blurb: 'The longest night returns, newly sorted. The decorations have been up since the last one.',
    curios: [
      { id: 'al15-wreath', name: 'Wreath, Self-Hanging', form: 'frame', mark: 'g:brooch', text: 'Hangs itself on the door every evening and has to be taken down by hand every morning. It has never missed a day. It has also never been asked.' },
      { id: 'al15-globe', name: 'Snow Globe, Interior Weather', form: 'cloche', mark: 'c:echo', text: 'Shake it and the snow falls on you. Inside, it is already summer, and a tiny figure is waving for help.' },
      { id: 'al15-cake', name: 'Twelfth Night Cake, Bean Missing', form: 'plate', mark: 'c:crown', text: 'Whoever finds the bean is king. Nobody has found the bean. Several people have been quietly crowned anyway.' },
      { id: 'al15-bells', name: 'Bells, Seven (Eight Counted)', form: 'medal', mark: 'c:clock', text: 'Seven ring in unison. One rings a beat behind, with no wire and no visible means.' }
    ],
    decor: { room: { id: 'midwinter-vault', name: 'Midwinter Vault', a: '#1C2548', b: '#0A0E1F', key: '#F2C083' }, wood: { id: 'frost-oak', name: 'Frost Oak', wood: '#6A7A8C', lip: '#94A6B8' }, wall: 'morse' },
    title: 'Keeper of the Longer Candle', badge: 'Survived Two of Them',
    spotlight: ['museum-piece'],
    hooks: [
      'Somebody has put a bow on it. The bow has been there since last year.',
      '{a} was given a present for it. It was a smaller version of the same present.'
    ]
  }
];

export const CHAPTER_BY_ID = Object.fromEntries(CHAPTERS.map(c => [c.id, c]));
export const ALMANAC_CURIOS = CHAPTERS.flatMap(c => c.curios.map(k => ({ ...k, rarity: 'edition', glyph: k.mark.startsWith('g:') ? k.mark.slice(2) : 'jar', chapter: c.id })));
export const ALMANAC_CURIO_BY_ID = Object.fromEntries(ALMANAC_CURIOS.map(c => [c.id, c]));
export const CHAPTER_OF_CURIO = Object.fromEntries(ALMANAC_CURIOS.map(c => [c.id, c.chapter]));

/* ================= FRIDGE MAGNETS =================
   The word bank for notes between players. Nobody types: a note is a row of
   these tiles, at most twelve, and a tile travels as its id. A reader draws
   only ids it knows, so nothing outside this list can ever be shown.

   Curated so that it cannot make a slur or a direct threat: no words for
   violence, nothing about bodies, no insults beyond the domestic and petty.
   test/coven.test.mjs checks every tile against DENY below, so keep both
   lists honest when adding words. Tiles are whole words and are always shown
   with a space between them, so two tiles can never run together into a
   different word. Ids are permanent: add to the end of a group, never
   rename, retire by leaving in place.

   Data only. Imports nothing. */

// A tile's id is its text, lower case, with everything but a to z and 0 to 9
// taken out ("Don’t" is dont, "séance" is seance). Punctuation has its own.
export const tileId = text => text.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');

// Always on the tray: the small words every sentence needs.
const GLUE = [
  'the', 'a', 'an', 'is', 'are', 'was', 'has', 'have', 'will', 'could', 'should', 'must', 'not', 'no', 'yes', 'and', 'but',
  'or', 'so', 'if', 'of', 'in', 'on', 'at', 'for', 'to', 'from', 'with', 'under', 'behind', 'again', 'still', 'never',
  'always', 'very', 'too', 'all', 'some', 'more', 'only', 'just', 'my', 'your', 'our', 'their', 'this', 'that', 'I', 'you',
  'we', 'they', 'it', 'me', 'us', 'them', 'who', 'what', 'why', 'where', 'when', 'how', 'someone', 'nobody', 'everyone',
  'nothing', 'something', 'here', 'there', 'now', 'then', 'Don’t', 'Can’t', 'Won’t', 'I’m', 'They’re'
];
// Shown attached to the word before them.
export const PUNCTUATION = [['qm', '?'], ['bang', '!'], ['dots', '…'], ['comma', ','], ['stop', '.'], ['poss', '’s']];

const PEOPLE = [
  'Keith', 'Susan', 'Uncle', 'Geoffrey', 'Mortis', 'vicar', 'landlord', 'neighbour', 'undertaker', 'cousin', 'aunt', 'nan',
  'committee', 'treasurer', 'chair', 'secretary', 'solicitor', 'milkman', 'postman', 'ghost', 'moth', 'raven', 'cat', 'spider',
  'snail', 'residents', 'coven', 'jury', 'witness', 'audience'
];
const THINGS = [
  'drawer', 'spoon', 'regret', 'receipt', 'kettle', 'biscuit', 'coffin', 'candle', 'jar', 'cupboard', 'cardigan', 'teapot',
  'invoice', 'minutes', 'rota', 'tin', 'ladder', 'bath', 'glove', 'doily', 'mould', 'crumb', 'custard', 'jam', 'sherry',
  'scone', 'trifle', 'wardrobe', 'attic', 'cellar', 'shed', 'hedge', 'parcel', 'postcard', 'deeds', 'rent', 'debt', 'souls',
  'curio', 'omen', 'hex', 'curse', 'cauldron', 'chest', 'sigil', 'séance', 'tea', 'wig', 'verdict', 'evidence', 'fridge',
  'board', 'note', 'meeting', 'apology', 'grudge', 'feud', 'rumour', 'secret', 'favour', 'dues', 'shelf', 'cabinet', 'sofa',
  'flannel', 'mop', 'bucket', 'pantry', 'pickle', 'turnip', 'mushroom', 'raisin', 'custard-cream', 'Tuesday', 'Sunday',
  'Monday', 'midnight', 'weekend', 'anniversary', 'Christmas', 'draught', 'damp', 'cobweb', 'paperwork', 'stamp', 'complaint',
  'feelings', 'standards', 'principle', 'reasons', 'plans', 'mess'
];
const DOING = [
  'owes', 'borrowed', 'stole', 'found', 'lost', 'ate', 'polished', 'alphabetised', 'sulked', 'haunted', 'forgot', 'remembered',
  'moved', 'denied', 'knows', 'saw', 'wept', 'sighed', 'waited', 'complained', 'apologised', 'refuses', 'wants', 'needs',
  'misses', 'loves', 'suspects', 'blames', 'forgives', 'invited', 'cancelled', 'minuted', 'noticed', 'sued', 'objected',
  'whispered', 'tutted', 'lurked', 'drips', 'leaks', 'smells', 'fell', 'broke', 'mended', 'washed', 'dusted', 'rearranged',
  'labelled', 'regrets', 'kept', 'gave', 'asked', 'voted', 'won', 'cheated', 'napped', 'vanished', 'reappeared', 'insists',
  'disagrees', 'objects', 'remains', 'appears', 'pretends'
];
const DESCRIBING = [
  'moist', 'lukewarm', 'sticky', 'cursed', 'suspicious', 'tiny', 'enormous', 'unwashed', 'overdue', 'beige', 'grey', 'wet',
  'ancient', 'petty', 'polite', 'furious', 'smug', 'sorry', 'guilty', 'innocent', 'legally', 'technically', 'frankly',
  'quietly', 'allegedly', 'apparently', 'probably', 'slightly', 'nearly', 'already', 'lovely', 'ominous', 'inedible',
  'missing', 'second', 'last', 'first', 'best', 'worst', 'good', 'bad', 'fine', 'wrong', 'old', 'stale', 'quiet', 'late',
  'magnificent', 'disappointing', 'unforgivable', 'forgiven', 'ceremonial', 'communal', 'decorative', 'unofficial', 'urgent',
  'pending', 'yesterday', 'tonight', 'tomorrow', 'today', 'forever', 'twice', 'once'
];

// Words the bank must never hold, whole or as the start of a tile: violence,
// bodies, insults and slurs. Not exhaustive of the language, exhaustive of
// what review found worth refusing. Lower case, letters only.
export const DENY = [
  'kill', 'murder', 'stab', 'die', 'dies', 'died', 'dying', 'dead', 'death', 'hurt', 'harm', 'hit', 'punch', 'kick', 'slap', 'shoot',
  'shot', 'gun', 'knife', 'blade', 'blood', 'bleed', 'bury', 'buried', 'grave', 'funeral', 'strangle', 'choke', 'hang', 'drown',
  'burn', 'poison', 'attack', 'destroy', 'hate', 'rape', 'suicide', 'bomb', 'beat', 'fight', 'wound', 'threat', 'torture', 'maim',
  'smash', 'crush', 'face', 'head', 'nose', 'eye', 'eyes', 'ear', 'ears', 'mouth', 'teeth', 'tooth', 'lip', 'lips',
  'tongue', 'neck', 'throat', 'chin', 'cheek', 'hand', 'hands', 'finger', 'arm', 'leg', 'legs', 'foot', 'feet', 'knee', 'belly',
  'stomach', 'butt', 'bum', 'arse', 'ass', 'hip', 'hips', 'skin', 'bone', 'bones', 'skull', 'body', 'breast', 'boob',
  'tits', 'nipple', 'penis', 'dick', 'cock', 'vagina', 'fat', 'ugly', 'stupid', 'dumb', 'idiot', 'moron', 'loser', 'freak',
  'slut', 'whore', 'bitch', 'bastard', 'cunt', 'twat', 'prick', 'retard', 'nazi', 'kys', 'licked', 'lick', 'naked', 'sexy', 'sex'
];
// These may not begin a tile either ("killer", "murderous", "stabbed").
export const DENY_STEMS = ['kill', 'murder', 'stab', 'strangl', 'drown', 'poison', 'tortur', 'suicid', 'rape', 'bomb', 'shoot', 'bleed', 'blood'];

function tiles(group, list) { return list.map(text => ({ id: tileId(text), text, group })); }
// custard-cream and the like are one tile with a space in them.
const shown = text => text.replace(/-/g, ' ');
export const MAGNETS = [
  ...tiles('glue', GLUE),
  ...PUNCTUATION.map(([id, text]) => ({ id, text, group: 'punct' })),
  ...tiles('people', PEOPLE), ...tiles('things', THINGS), ...tiles('doing', DOING), ...tiles('describing', DESCRIBING)
].map(t => ({ ...t, text: t.group === 'punct' ? t.text : shown(t.text) }));
export const MAGNET_BY_ID = Object.fromEntries(MAGNETS.map(t => [t.id, t]));
export const MAX_TILES = 12;
export const MAX_NAMES = 3;

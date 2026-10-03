/* ================= COLLECTIONS AND THE EXCHANGE =================
   Sets: the curios, keepsakes and souvenirs the game already hands out, grouped
   into themed sets of four to six. Finish a set and it pays souls and a title,
   sometimes a display frame for the cabinet.

   The Collector’s Exchange: where souls and Legacy Tokens go once the cabinet
   is full. Frames for the cabinet, frames for resident portraits, rooms, woods,
   walls and accents, Back Issues of chapters you missed, and commissions.

   Data only. Imports content modules, never state or engines. */
import { CURIOS } from './mayhem.js';
import { SEASONS } from './seasons.js';
import { CHAPTERS, CHAPTER_BY_ID } from './almanac.js';
import { LEGACY_RANKS } from './legacy.js';

// Members are typed: c: a curio in the cabinet, r: an expedition keepsake, s: a visitor’s souvenir.
const thin = SEASONS.find(s => s.id === 'thin-season');

export const SETS = [
  { id: 'paper', group: 'cabinet', name: 'Stationery of the Recently Departed', blurb: 'Everything the dead needed signed, and one thing they did not.',
    members: ['c:damp-receipt', 'c:condolence-card', 'c:name-tag', 'c:map-house', 'c:named-book'], souls: 180, title: 'Clerk to the Deceased' },
  { id: 'spares', group: 'cabinet', name: 'Spare Parts', blurb: 'Collected, not kept. There is a distinction, and the parts have been told.',
    members: ['c:glass-eye', 'c:jar-teeth', 'c:monkey-paw', 'c:waving-hand', 'c:warm-glove'], souls: 180, title: 'Sorter of Spares' },
  { id: 'mourning', group: 'cabinet', name: 'Mourning Jewellery', blurb: 'Worn to the funeral, and the one after, and the one nobody mentioned.',
    members: ['c:mourning-brooch', 'c:leech-locket', 'c:lake-ring', 'c:cursed-thimble', 'c:button-eye'], souls: 180, title: 'Chief Mourner, Accessorised' },
  { id: 'seance', group: 'cabinet', name: 'Séance Supplies', blurb: 'Everything for a successful evening, bar a guest who is alive.',
    members: ['c:half-candle', 'c:seance-spoon', 'c:planchette', 'c:music-box', 'c:bottled-scream', 'c:hand-of-glory'], souls: 260, title: 'Convener of the Circle', frame: 'seance-felt' },
  { id: 'specimens', group: 'cabinet', name: 'Specimens', blurb: 'Labelled in a hand that was shaking. Possibly the specimen’s.',
    members: ['c:suspicious-mushroom', 'c:moth-wing', 'c:formal-mouse', 'c:tooth-not-yours'], souls: 120, title: 'Curator of Small Evidence' },
  { id: 'hardware', group: 'cabinet', name: 'Hardware of the Hereafter', blurb: 'If it can be hung, opened or hammered, it is in here. Some of it is hanging you.',
    members: ['c:coffin-nail', 'c:other-key', 'c:small-door', 'c:the-nail', 'c:tiny-coffin'], souls: 220, title: 'Keeper of the Hinge', frame: 'hearse-lacquer' },
  { id: 'watchers', group: 'cabinet', name: 'The Ones That Look Back', blurb: 'You cannot see all of them at once. This has been tested, to the tester’s cost.',
    members: ['c:turning-doll', 'c:death-photo', 'c:last-breath', 'c:shelf-heart'], souls: 240, title: 'Watched, and Content', frame: 'watchful-glass' },
  { id: 'thin', group: 'season', name: 'The Thin Season Set', blurb: 'Six things that came through the wall and stayed for the soup.',
    members: thin.curios.map(c => 'c:' + c.id), souls: 260, title: 'Walker Between the Walls', frame: 'thin-ember' },
  { id: 'lost-property', group: 'keepsakes', name: 'Lost Property Office', blurb: 'Handed in by the shelf. Unclaimed by the owners, who deny existing.',
    members: ['r:drawer:0', 'r:drawer:1', 'r:drawer:2', 'r:fridge:0'], souls: 140, title: 'Keeper of Lost Property' },
  { id: 'cold-cupboard', group: 'keepsakes', name: 'Cold Storage and Cupboards', blurb: 'What the fridge kept and what the cupboard declined to discuss.',
    members: ['r:fridge:1', 'r:fridge:2', 'r:cupboard:0', 'r:cupboard:1', 'r:cupboard:2'], souls: 180, title: 'Cold Storage Clerk' },
  { id: 'callers-1', group: 'callers', name: 'Callers, First Sitting', blurb: 'People who came calling and left something behind. Mostly manners.',
    members: ['s:moth', 's:lint', 's:bell', 's:undertow', 's:widow', 's:spore'], souls: 260, title: 'Host of the First Sitting' },
  { id: 'callers-2', group: 'callers', name: 'Callers, Second Sitting', blurb: 'The rest of the guest book. Several signatures are only a smudge and an apology.',
    members: ['s:tooth', 's:echo', 's:needle', 's:clock', 's:receipt', 's:rain'], souls: 260, title: 'Host of the Second Sitting' },
  // One set per chapter: its four limited curios. Missed ones can be bought back from the Exchange.
  ...CHAPTERS.map(c => ({ id: 'ch:' + c.id, group: 'almanac', chapter: c.id, name: c.name + ' (' + c.month + ')', blurb: 'The four limited curios from this chapter of the Almanac.',
    members: c.curios.map(k => 'c:' + k.id), souls: 150 }))
];
export const SET_BY_ID = Object.fromEntries(SETS.map(s => [s.id, s]));
export const SET_GROUPS = [
  { id: 'cabinet', title: 'The Cabinet' },
  { id: 'season', title: 'Seasonal' },
  { id: 'keepsakes', title: 'Expedition keepsakes' },
  { id: 'callers', title: 'Visitors’ souvenirs' },
  { id: 'almanac', title: 'Almanac editions' }
];
export const CURIO_SET = (() => {
  const out = {};
  for (const set of SETS) for (const m of set.members) if (m.startsWith('c:')) out[m.slice(2)] = set.id;
  return out;
})();

/* ---- display frames for the Cabinet ------------------------------------------ */
// cost: souls. tokens: Legacy Tokens. reward: earned by finishing a set (no price).
export const CABINET_FRAMES = [
  { id: 'plain', name: 'Plain Pine', line: 'It holds things. It does not mean it.', cost: 0 },
  { id: 'tin', name: 'Pressed Tin', line: 'The pattern is a cheerful skull. The cheerful is the tin’s own idea.', cost: 250 },
  { id: 'bone', name: 'Bone Inlay', line: 'Fitted by a man who said he could do it without any more bone, and then did it.', cost: 400 },
  { id: 'walnut', name: 'Sad Walnut', line: 'A good frame, in low spirits. It would like to be asked about it.', cost: 600 },
  { id: 'brass', name: 'Brass, Allegedly', line: 'Goes green at the corners. The corners have been told to keep it quiet.', cost: 900 },
  { id: 'velvet', name: 'Moth-Eaten Velvet', line: 'Once plush. Still plush, in the places the moths have not reviewed.', cost: 1300 },
  { id: 'gilt', name: 'Gilt by Association', line: 'Gold leaf, applied by someone who had heard of gold.', cost: 1800 },
  { id: 'obsidian', name: 'Obsidian Veneer', line: 'You can see your reflection. It looks worried on your behalf.', tokens: 2 },
  { id: 'reliquary', name: 'Reliquary Gold', line: 'For objects that were once somebody’s favourite. Nobody says whose.', tokens: 5 },
  { id: 'seance-felt', name: 'Séance Felt', line: 'Green baize, warm to the touch. Do not ask who was warming it.', reward: 'seance' },
  { id: 'hearse-lacquer', name: 'Hearse Lacquer', line: 'Eight coats of black and one coat of regret. The regret is on top.', reward: 'hardware' },
  { id: 'watchful-glass', name: 'Watchful Glass', line: 'The glass is slightly convex. It is not for you. It is for what is behind you.', reward: 'watchers' },
  { id: 'thin-ember', name: 'Thin Season Ember', line: 'A frame that is faintly warm from the wrong side.', reward: 'thin' }
];
export const FRAME_BY_ID = Object.fromEntries(CABINET_FRAMES.map(f => [f.id, f]));

/* ---- frames for resident portraits (the card you open by tapping a resident) --- */
export const PORTRAIT_FRAMES = [
  { id: 'plain', name: 'No Frame', line: 'They are what they are. They have noted the absence.', cost: 0 },
  { id: 'cameo', name: 'Oval Cameo', line: 'A good profile, cut out of a worse one.', cost: 300 },
  { id: 'wax', name: 'Wax Seal', line: 'A red seal, pressed with a thumb. The thumb is not yours.', cost: 450 },
  { id: 'gallows', name: 'Gallows Timber', line: 'Honest wood from a structure that has been decommissioned.', cost: 600 },
  { id: 'doily', name: 'Doily, Aggressive', line: 'Crocheted by a great-aunt who had a lot of time and a lot of feelings.', cost: 750 },
  { id: 'lineup', name: 'Police Lineup', line: 'Height marks on the wall behind. They are all the same height. It is being looked into.', cost: 900 },
  { id: 'gold-leaf', name: 'Leaf of Legacy', line: 'Gilded edges and an expression of long-suffering pride.', tokens: 3 },
  { id: 'obsidian-oval', name: 'Obsidian Oval', line: 'A portrait frame so polished that the resident can see itself being judged.', tokens: 4 }
];
export const PORTRAIT_BY_ID = Object.fromEntries(PORTRAIT_FRAMES.map(f => [f.id, f]));

/* ---- priced rooms, woods, walls and accents ------------------------------------
   Everything the game offered before this existed stays free and owned (see
   FREE_DECOR in content/decor.js). Only these are sold. */
export const EXCHANGE_DECOR = {
  room: [
    { id: 'catacomb-chic', name: 'Catacomb Chic', a: '#2E2A26', b: '#100E0C', key: '#C9BCAE', cost: 800, line: 'Grey stone, tasteful drips, a single skull used as a candle holder and a bookend.' },
    { id: 'bruise-violet', name: 'Bruise Violet', a: '#3B2347', b: '#150B1E', key: '#C49BFF', cost: 700, line: 'A room that looks recently hit and is handling it.' },
    { id: 'embalmer-teal', name: 'Embalmer’s Teal', a: '#17383A', b: '#09171A', key: '#7FD8C0', cost: 900, line: 'The colour of a very clean tool, in a very quiet room.' },
    { id: 'tallow-dark', name: 'Tallow', a: '#3A3022', b: '#16110B', key: '#F6C768', cost: 700, line: 'Lit by rendered candle. Smells of Sunday, and of something that came after Sunday.' },
    { id: 'reliquary-black', name: 'Reliquary Black', a: '#1A1416', b: '#070405', key: '#E8C77A', tokens: 6, line: 'Black on black, with gold only where a saint would want it.' }
  ],
  wood: [
    { id: 'ebony', name: 'Ebony, Mostly', wood: '#25211F', lip: '#3C3532', cost: 500, line: 'Mostly ebony. The rest is a disclaimer.' },
    { id: 'coffin-pine', name: 'Coffin Pine, Offcuts', wood: '#8A6A48', lip: '#B38E66', cost: 450, line: 'Left over from a larger job. The larger job is not complaining.' },
    { id: 'obsidian-lacquer', name: 'Obsidian Lacquer', wood: '#14101C', lip: '#2E2640', tokens: 4, line: 'Lacquered until the grain gave up and joined in.' }
  ],
  wall: [
    { id: 'tally', name: 'Tally Marks', cost: 500, line: 'Someone has been counting. They stopped at a number and refused to say which.' },
    { id: 'lattice', name: 'Lattice, Locked', cost: 500, line: 'A wall made of gaps. The gaps are the point and the gaps are watching.' },
    { id: 'filigree', name: 'Filigree', tokens: 4, line: 'Fine metal lace, hammered flat by someone with more patience than reasons.' },
    { id: 'ripple', name: 'Seepage', cost: 500, line: 'A pattern that spreads slowly from one corner. It appears to be moving in.' }
  ],
  accent: [
    { id: 'ectoplasm', name: 'Ectoplasm', c: '#9BFFB0', cost: 300, line: 'The buttons glow faintly and leave a mark on anything they touch.' },
    { id: 'rust', name: 'Rust', c: '#D9803B', cost: 300, line: 'Everything it touches ages ten years. It looks great on a button.' },
    { id: 'lichen', name: 'Lichen', c: '#C9D86B', cost: 300, line: 'Slow-growing. Persistent. Takes over the buttons on its own timeline.' },
    { id: 'reliquary-gold', name: 'Reliquary Gold', c: '#E8C77A', tokens: 3, line: 'Gold that has been prayed over. It would rather not say by whom.' },
    { id: 'ghostlight', name: 'Ghostlight', c: '#CFE6FF', tokens: 1, line: 'A pale, steady light that is looking at something just behind you.' }
  ]
};

/* ---- Back Issues ------------------------------------------------------------------
   A chapter’s curios are only handed out while it runs. After it ends they are
   sold here, at a price that is a sink and not a bargain, so nothing is lost for good.
   One piece a week is marked down. */
export const BACK_ISSUE_COST = 450;
export const BACK_ISSUE_DECOR_COST = 1200;
export const BACK_ISSUE_BARGAIN = 0.4;

/* ---- commissions ---------------------------------------------------------------------
   One-off orders, in the voice of the people who take them. Each is bought
   once, pays nothing back in souls and leaves a document on the note board and
   a title. They are for the player who has everything and a lot of souls. */
export const COMMISSIONS = [
  { id: 'portrait', name: 'A Portrait of the Household, Mostly Accurate', cost: 1500, title: 'Patron of the Arts, Technically',
    blurb: 'An artist will call. He says he works fast. He has spent forty minutes on one ear.',
    done: 'The portrait has arrived. It shows all of you, standing in front of a larger portrait of all of you, and so on. The artist signed it with a name that is clearly several other names.' },
  { id: 'letter', name: 'A Strongly Worded Letter to the Council', cost: 2400, title: 'Thorn in the Council’s Side',
    blurb: 'Drafted by a retired solicitor who enjoys this far more than he is willing to say.',
    done: 'Dear Council, regarding the matter. We are aware you are aware. We are aware that you are aware that we are aware. We enclose a cheque for nothing and a sock. Yours, a household. P.S. Mrs Widow would like her ladder back.' },
  { id: 'eulogy', name: 'A Eulogy for a Raisin', cost: 3200, title: 'Orator of the Small Occasion',
    blurb: 'Delivered at dusk, to a single raisin, by someone who has practised in the mirror.',
    done: 'The eulogy was delivered at dusk to one raisin, who looked, for the first time in its short life, moved. It was wrinkled, but then so was the speaker. Both were seen to dab at something. The raisin has asked for a copy.' },
  { id: 'plaque', name: 'A Brass Plaque Reading “HERE”', cost: 4000, title: 'Marker of the Spot',
    blurb: 'Fixed to the shelf by a man with a hammer and no further questions.',
    done: 'The plaque is up. It reads HERE. Nobody can say what it marks. It marks the spot with great authority, and visitors have started to stand on either side of it, respectfully, just in case.' },
  { id: 'statue', name: 'A Statue of Someone Local', cost: 5500, title: 'Subject of a Statue, Pending',
    blurb: 'The sculptor will not say who it is. He says you will know when it is finished. He sounds sure.',
    done: 'The statue was unveiled by a committee of three, none of whom had been told whose it was. It is very like somebody. The pigeons have formed a view and are sharing it in the usual manner.' },
  { id: 'annex', name: 'An Annex, for the Overflow', cost: 7000, title: 'Developer of Dubious Land',
    blurb: 'Nobody has built an annex. A contractor has drawn one, and invoiced for the drawing.',
    done: 'The annex has been drawn up in full. It is in the shape of a hand making a sign. Planning permission was granted by a clerk who did not read it and then left the country. Construction begins when the weather improves, which is to say never.' },
  { id: 'anthem', name: 'A Household Anthem', cost: 8500, title: 'Lead Voice, Reluctantly',
    blurb: 'Composed by the dead, performed off-key, rewritten twice by a committee that only met once.',
    done: 'The anthem has three verses and a chorus. The chorus is the word “shelf” held for as long as the singer can bear it. Everyone stands for it. Several have had to sit down again, not out of disrespect, but because of the note.' },
  { id: 'arms', name: 'A Coat of Arms, Legally Binding', cost: 10000, title: 'Armigerous and Damp',
    blurb: 'Granted by a herald of uncertain jurisdiction. The seal looks real. The herald does not.',
    done: 'Three bones on a field of damp. The motto is in a language nobody has verified and reads, as far as anyone can tell, “WE WERE HERE FIRST”. It has been stitched onto a cushion, and the cushion has been sat on by a person of rank.' },
  { id: 'mausoleum', name: 'A Small Mausoleum, Decorative', cost: 12500, title: 'Landlord of the Small Mausoleum',
    blurb: 'Hand-built to the dimensions of a biscuit tin. It was a biscuit tin. It was emptied first.',
    done: 'The mausoleum is finished. It has a very small door, a very small knocker and a very small sign saying BACK SOON. Nobody has ever been seen entering or leaving. The sign has been changed twice.' },
  { id: 'town', name: 'The Founding of a Town (Population: You)', cost: 15000, title: 'Mayor of Nowhere in Particular',
    blurb: 'A charter will be drawn up. A flag will be chosen. The flag will be a damp patch, because the damp patch is first to arrive.',
    done: 'A charter has been signed. The town is named after the shelf. It has a mayor, who is you, and a council, who are also you, and a rival town two inches along, which has been quietly annexed and has not been told.' }
];
export const COMMISSION_BY_ID = Object.fromEntries(COMMISSIONS.map(c => [c.id, c]));

/* ---- titles --------------------------------------------------------------------------
   Every title the game can give, looked up by a short namespaced id so the save
   stays small. ch: an Almanac chapter. set: a collection. lg: a Legacy rank.
   cm: a commission. */
export function titleText(id) {
  const [kind, ...rest] = String(id).split(':'), key = rest.join(':');
  if (kind === 'ch') return CHAPTER_BY_ID[key]?.title || '';
  if (kind === 'set') return SET_BY_ID[key]?.title || '';
  if (kind === 'lg') return LEGACY_RANKS[Number(key) - 1]?.short || '';
  if (kind === 'cm') return COMMISSION_BY_ID[key]?.title || '';
  return '';
}
export const TITLE_IDS = [
  ...CHAPTERS.map(c => 'ch:' + c.id),
  ...SETS.filter(s => s.title).map(s => 'set:' + s.id),
  ...LEGACY_RANKS.map(r => 'lg:' + r.legacy),
  ...COMMISSIONS.map(c => 'cm:' + c.id)
];

export const CURIO_NAMES = Object.fromEntries(CURIOS.map(c => [c.id, c.name]));

/* ================= THE POSTBOX: WHAT FRIENDS SEND EACH OTHER =================
   Everything a player can send another is chosen from these lists, never typed,
   so the only free text between players stays the display name. Ids are what
   travel; the words live here. A line the reader's edition does not know is
   shown as a polite blank rather than trusted.

   Placeholders: {who} the sender, {host} the friend who kept a guest, {pet} a
   resident, {from} the giver, {days} "a day", "two days" or "three days". */

/* ---- treats: once a day per friend ---- */
export const TREATS = [
  { id: 'jar-of-teeth', name: 'A Jar of Teeth', glyph: 'jar', line: 'Assorted. Some of them still have opinions.' },
  { id: 'moth-pie', name: 'Moth Pie', glyph: 'raisin', line: 'Baked at dusk. The lid moves if you look away.' },
  { id: 'grave-fudge', name: 'Grave Dirt Fudge', glyph: 'receipt', line: 'Locally sourced. Very locally.' },
  { id: 'pickled-whisper', name: 'A Pickled Whisper', glyph: 'jar', line: 'Do not open near anyone you have wronged.' },
  { id: 'candle-end', name: 'The End of a Candle', glyph: 'clock', line: 'It lit somebody’s last evening. It would like to light yours.' },
  { id: 'damp-biscuit', name: 'One Damp Biscuit', glyph: 'button', line: 'Dunked by a ghost in 1911. Still drying.' },
  { id: 'sympathy-card', name: 'A Sympathy Card, Unsigned', glyph: 'paper', line: 'For whatever happens next.' },
  { id: 'eyeball-humbugs', name: 'Eyeball Humbugs', glyph: 'pea', line: 'Mint. They follow you round the room anyway.' },
  { id: 'lint-bouquet', name: 'A Bouquet of Lint', glyph: 'scarf', line: 'Gathered from under the good sofa. The good sofa does not know.' },
  { id: 'cursed-raisin', name: 'A Cursed Raisin', glyph: 'raisin', line: 'Small. Patient. Previously a grape with prospects.' }
];
export const TREAT_BY_ID = Object.fromEntries(TREATS.map(t => [t.id, t]));
export const GIFT_SOULS = 4;

/* ---- guestbook: one signature a day per book ---- */
export const GUESTBOOK_LINES = [
  'Lovely shelf. I counted the residents twice and got two different numbers.',
  'Came for the ambience. Left with somebody’s tooth in my shoe.',
  'The bowl was empty. I am not saying anything. I am writing it down.',
  'Ten out of ten. Would be haunted again.',
  'Your lamp looked at me. I looked back. We have an understanding now.',
  'I moved one thing an inch to the left. You will never know which.',
  'Smelled faintly of pond. Not a complaint. An observation, for the record.',
  'Somebody here owes me a biscuit. They know who they are.',
  'Wiped my feet. Your doormat whispered my name. Rude.',
  'Lovely to see everyone still technically alive.',
  'The quiet one in the corner did not blink once. Tell them well done.',
  'I left a small curse by the skirting board. A housewarming thing.',
  'Visited. Was not offered a chair. I will remember this at your funeral.',
  'Everything is exactly where I would not have put it. Bold.',
  'Your residents are very loud for things with no lungs.',
  'Signed in blood. Mostly. Some of it is jam.',
  'Popped by. Something popped back.',
  'I have seen worse shelves. Not many. But some.',
  'The damp one sneezed on my coat. I have kept the coat as evidence.',
  'Charming. Slightly cursed. Like a christening.',
  'I would like my umbrella back. I did not bring an umbrella. I would still like it back.',
  'Delightful. I will be telling everyone a slightly worse version of this visit.',
  'Your shelf has a draught. I think it is a ghost. I think it likes you.',
  'No notes. Several grudges. See you next week.'
];

// What the stamps are called. Their drawings are in src/ui/postbox.js.
export const STAMPS = [
  { id: 'skull', name: 'Skull' },
  { id: 'candle', name: 'Candle' },
  { id: 'moth', name: 'Moth' },
  { id: 'teeth', name: 'Teeth' },
  { id: 'coffin', name: 'Coffin' },
  { id: 'eye', name: 'Eye' }
];
export const STAMP_IDS = STAMPS.map(s => s.id);

/* ---- waves and pokes at a friend's resident (16 line slots on the server) ---- */
export const WAVE_LINES = [
  '{who} waved at {pet}. {pet} has not recovered.',
  '{who} waved at {pet}. {pet} waved back with the wrong hand and is now mortified.',
  '{who} waved at {pet}. {pet} has taken it as a proposal.',
  '{who} waved at {pet} from a great distance. {pet} pretended not to see and is still pretending.',
  '{who} waved at {pet}. {pet} has written it in a diary, under “Incidents”.',
  '{who} waved at {pet}. {pet} is telling everyone it is famous now.',
  '{who} waved at {pet}. {pet} would like to know what was meant by that.',
  '{who} waved at {pet}. {pet} has started practising a wave of its own, in a mirror, for hours.'
];
export const POKE_LINES = [
  '{who} poked {pet}. {pet} has filed a complaint with nobody in particular.',
  '{who} poked {pet}. {pet} made a noise like a kettle and will not discuss it.',
  '{who} poked {pet}. {pet} is now slightly further to the left, and furious about it.',
  '{who} poked {pet} to see if it was real. The results are inconclusive.',
  '{who} poked {pet}. {pet} poked the nearest resident, who poked the lamp. The lamp is fine.',
  '{who} poked {pet}. {pet} has added a name to a list. The list is getting long.',
  '{who} poked {pet}. {pet} said “ow” in a tone that suggested a lawsuit.',
  '{who} poked {pet}. {pet} is lying very still in case it happens again.'
];
// What the sender sees once it has gone.
export const WAVE_SENT = { wave: 'Waved. {pet} has been informed.', poke: 'Poked. {pet} noticed. {pet} always notices.' };

/* ---- visits ---- */
export const VISIT_DAYS = [
  { days: 1, label: 'A day', hint: 'A quick look round.' },
  { days: 2, label: 'Two days', hint: 'Long enough to have opinions.' },
  { days: 3, label: 'Three days', hint: 'Pack a toothbrush. Pack a grudge.' }
];
export const DAY_WORDS = ['', 'a day', 'two days', 'three days'];

// The host feeds, fusses and washes; the guest answers in its own manner.
// {pet} is the guest.
export const GUEST_REACTIONS = {
  food: [
    '{pet} eats it slowly, looking you in the eye, like a review.',
    '{pet} eats it and asks, politely, what it was.',
    '{pet} eats half and wraps the other half to take home. It is not going home yet.'
  ],
  fuss: [
    '{pet} tolerates the fuss with the face of a cat at a christening.',
    '{pet} leans in. Then remembers it is a guest and leans out again.',
    '{pet} says its own household never does this. It says it loudly, for the record.'
  ],
  clean: [
    '{pet} is washed. {pet} says the water at home is wetter.',
    '{pet} submits to the flannel with enormous dignity and one small scream.',
    '{pet} comes out cleaner and noticeably more suspicious.'
  ]
};
// A trait can answer instead. `need` is food, fuss, clean or any.
export const TRAIT_REACTIONS = {
  damp: { need: 'clean', line: '{pet} cannot get any wetter. You tried anyway. It is quietly impressed.' },
  critic: { need: 'food', line: '{pet} gives the meal two skulls out of five and asks for the bill.' },
  sugar: { need: 'food', line: '{pet} asks whether there is pudding. There is never pudding. It asks anyway.' },
  clean: { need: 'clean', line: '{pet} was already clean. It lets you carry on, out of pity.' },
  feral: { need: 'fuss', line: '{pet} bites your thumb, gently, as a thank you.' },
  bitey: { need: 'fuss', line: '{pet} bites. Where it comes from, that is a compliment.' },
  narcissist: { need: 'fuss', line: '{pet} accepts the fuss as no more than it is owed.' },
  spiteful: { need: 'any', line: '{pet} accepts. {pet} also writes your name down.' },
  complaints: { need: 'any', line: '{pet} files a complaint about the service, then a second one about the form.' },
  terminal: { need: 'any', line: '{pet} thanks you as though you have saved its life. You have not. It is fine.' },
  landlord: { need: 'any', line: '{pet} asks what you charge for the room, then says it is too much.' },
  gossip: { need: 'any', line: '{pet} will be telling its whole shelf about this. Most of it untrue.' },
  etiquette: { need: 'any', line: '{pet} thanks you in writing. The card arrives before you have finished.' },
  ancient: { need: 'any', line: '{pet} says it was looked after better in 1740. It does not elaborate.' },
  auditor: { need: 'any', line: '{pet} makes a note of it. In triplicate.' }
};
export const CARE_WORDS = { food: 'Feed', fuss: 'Fuss', clean: 'Wash' };

// The postcard: what the host did, then what the guest has to say about it.
export const POSTCARD_COMPLAINTS = {
  clean: [
    '{pet} would like it noted that the towel was the wrong colour.',
    '{pet} says the water was wet in a way it did not care for.',
    '{pet} has kept the soap. As a hostage.'
  ],
  food: [
    '{pet} says the portions were generous and the plates were judgemental.',
    '{pet} would like the recipe, so that it can never have it again.',
    '{pet} has gained a little weight and a great deal of opinion.'
  ],
  fuss: [
    '{pet} was fussed over so thoroughly it forgot its own name for an afternoon.',
    '{pet} enjoyed the attention and will deny it under oath.',
    '{pet} has come back slightly smug. Nobody can say why.'
  ],
  none: [
    '{pet} would like you to know nobody touched it once. {pet} has never been happier.',
    '{pet} spent the whole stay staring at a wall. It says it was a nice wall.',
    '{pet} describes the hospitality as “present, technically”.'
  ],
  lots: [
    '{pet} is exhausted from being loved and needs a lie down in a cold room.',
    '{pet} has been looked after to within an inch of its life, which, given everything, is quite far.'
  ]
};
export const POSTCARD_DECLINED = [
  '{host} declined. {pet} has taken it well, which is to say badly, in private.',
  '{host} said no. {pet} has unpacked its suitcase very loudly.'
];
export const POSTCARD_LAPSED = [
  '{host} never answered. {pet} waited by the door for two days with a small suitcase and is now unpacking it at you.',
  'Nobody at {host}’s came to the door. {pet} says it was relieved. {pet} is lying.'
];
// The note the guest leaves the host.
export const THANK_YOU_NOTES = [
  'Thank you for having me. I took a spoon.',
  'Lovely stay. The lamp and I are no longer speaking.',
  'Thank you. Please do not look under the cushion.',
  'Grateful. Slightly damp. Mostly grateful.',
  'Thank you for your hospitality. I have left some of my personality behind the radiator.',
  'Thank you. I will tell everyone you were very normal.'
];

// A small keepsake that comes home with every visit that happened. Drawn with
// the curio cabinet's shapes (src/art/curios.js).
export const SOUVENIRS = [
  { id: 'dust-globe', name: 'A Snow Globe of Their Dust', glyph: 'jar', line: 'Shake it and their whole shelf settles, slowly, on your conscience.' },
  { id: 'their-spoon', name: 'A Spoon From Their Drawer', glyph: 'spoon', line: 'Nobody saw. Everybody knows.' },
  { id: 'small-card', name: 'A Very Small Postcard', glyph: 'paper', line: '“Wish you were here. You are not. Fine.”' },
  { id: 'their-key', name: 'A Key to Something of Theirs', glyph: 'key', line: 'Neither of you knows what it opens. Both of you are worried.' },
  { id: 'tooth-magnet', name: 'A Fridge Magnet Shaped Like a Tooth', glyph: 'tooth', line: 'Their fridge had seven. Now it has six.' },
  { id: 'coat-button', name: 'A Button off Their Coat', glyph: 'button', line: 'The coat has been informed.' },
  { id: 'haunting-receipt', name: 'A Receipt for One Haunting', glyph: 'receipt', line: 'Paid in full. Non-refundable. Lightly used.' },
  { id: 'odd-sock', name: 'One of Their Socks', glyph: 'sock', line: 'The other one is still there, waiting, like a widow.' },
  { id: 'stopped-clock', name: 'A Clock That Stopped While It Was There', glyph: 'clock', line: 'At twenty past three. Nobody will say what happened at twenty past three.' },
  { id: 'pressed-raisin', name: 'A Pressed Raisin', glyph: 'raisin', line: 'Kept between the pages of their visitors’ book. Now kept between yours.' },
  { id: 'their-bell', name: 'The Bell From Their Door', glyph: 'bell', line: 'They will notice when the next person knocks. Nobody will knock.' },
  { id: 'darning-needle', name: 'A Darning Needle', glyph: 'needle', line: 'It came home in the lining. It does not explain itself.' }
];
export const SOUVENIR_BY_ID = Object.fromEntries(SOUVENIRS.map(s => [s.id, s]));
export const VISIT_SOULS = { sender: 8, host: 6 };

/* ---- friendship levels, from the interactions the server counts ---- */
export const FRIEND_LEVELS = [
  { at: 0, name: 'Acquaintance', line: 'You know each other’s codes. That is technically a relationship.' },
  { at: 3, name: 'On Nodding Terms', line: 'You nod. They nod. Neither of you will ever stop.' },
  { at: 8, name: 'Spare Key Holder', line: 'You know where the spare key is. You have not used it. Yet.' },
  { at: 16, name: 'Emergency Contact', line: 'Named on the form. Neither of you was asked.' },
  { at: 30, name: 'Each Other’s Alibi', line: 'Where were you on the night of the ninth? With them. Obviously.' },
  { at: 50, name: 'Co-conspirators', line: 'Whatever it is, you are both in it now. Up to the neck.' }
];
// History, in the order a friend's profile lists it.
export const HISTORY_KINDS = [
  { id: 'case', one: 'case heard', many: 'cases heard' },
  { id: 'visit', one: 'visit', many: 'visits' },
  { id: 'gift', one: 'treat opened', many: 'treats opened' },
  { id: 'signature', one: 'guestbook signature', many: 'guestbook signatures' },
  { id: 'wave', one: 'day of waving', many: 'days of waving' },
  { id: 'trade', one: 'trade', many: 'trades' },
  { id: 'hearing', one: 'joint hearing', many: 'joint hearings' }
];

/* ---- Do not disturb, and refusals as the sender reads them ---- */
export const DND = {
  label: 'Do not disturb',
  on: 'On. No visitors, treats, waves or papers can reach you. What has already arrived stays.',
  off: 'Off. Friends can send visitors, treats, waves and papers.'
};
export const POSTBOX_TEXT = {
  dnd: 'They have hung a Do not disturb sign on the door. It is not personal. It might be a little personal.',
  shelf_full: 'Their shelf already has two guests. Nobody else fits, socially or physically.',
  already_visiting: 'One of your residents is already staying with them. One at a time.',
  already_away: 'That resident is already away. It can only be in one place, legally.',
  already_sent: 'You have already sent them a treat today. Restraint is also a gift.',
  already_signed: 'You have signed their guestbook today. Once is charming. Twice is a pattern.',
  too_soon: 'Give the guest a moment. It is still recovering from the last one.',
  care_full: 'The guest has had all of that it can stand for one visit.',
  expired: 'Too late. That has gone off.',
  not_open: 'That has already been dealt with.',
  too_many_open: 'They already have a queue of visitors at the door. Try again later.',
  rate_limited: 'That is a lot for one day. Try again tomorrow.',
  not_found: 'That is not there any more.',
  refused: 'That did not go through. Nothing was changed.'
};

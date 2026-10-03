/* ================= LEGACY RANKS =================
   The twelve ranks end at Unspeakable (8,500 lifetime souls). Past that the
   neighbours keep finding new ways to describe you. Thirty more ranks, each
   further apart than the last, each paying a cosmetic title and one Legacy
   Token. Nothing resets and nothing is taken away: this is a longer ladder,
   not a prestige.

   Pure data: imports nothing. content/mayhem.js appends these to RANKS. */

export const LEGACY_START = 8500;
export const LEGACY_LEVELS = 30;
// Legacy N needs this many lifetime souls. The gap grows by 150 a rank, so the
// first is a few days past Unspeakable and the thirtieth is most of a year on.
export function legacyAt(n) { return LEGACY_START + 1500 * n + 75 * n * (n + 1); }

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI', 'XXII', 'XXIII', 'XXIV', 'XXV', 'XXVI', 'XXVII', 'XXVIII', 'XXIX', 'XXX'];
export const legacyNumeral = n => ROMAN[n] || String(n);

const TEXT = [
  ['Previously Unspeakable', 'The neighbours have stopped saying your name and started saying your weather.'],
  ['Spoken of Only in Whispers', 'The whispers have been moved to a bigger room. They are still whispers. They are just louder.'],
  ['Mentioned in Dispatches', 'Somebody has written you into a report. It is a long report. You are in the appendix, and the appendix is on fire.'],
  ['Formally Uninvited', 'A letter confirms that you will not be asked, and would not be welcome if you were.'],
  ['Landmark, Unlisted', 'Tourists photograph the house from across the road, then delete the photograph, then check it is deleted.'],
  ['Cited in Three Wills', 'In each of them you are the reason nobody is getting the clock.'],
  ['A Regional Variance', 'The council has added a line to a map. It is just your house. The line is dotted and has a warning.'],
  ['Weather Event', 'The forecast now carries your postcode. It says “localised, persistent, sulking”.'],
  ['Footnote to the Apocalypse', 'It is a small footnote and it says “see also: the shelf”. Nobody has looked it up and everybody agrees on what it means.'],
  ['Subject of a Plaque', 'A plaque has been put up outside. It does not say what happened. It says “Never Again, Probably”.'],
  ['Incorporated', 'You are now a company. The residents have been made directors. Nobody has read the paperwork, and the paperwork has been waiting.'],
  ['Recurring Nightmare, Licensed', 'You appear in other people’s sleep under a permit. It is renewed each spring and is not a pleasure.'],
  ['Unlucky for Some, Unlucky for All', 'Thirteen is your number now. The building has stopped having a thirteenth floor and started having you.'],
  ['Local Government', 'A vote was held on whether you were in charge. The count has not finished, and nobody is brave enough to go in.'],
  ['Annexed the Neighbouring Dread', 'The dread next door has been quietly absorbed. It sends a polite note about the arrangement.'],
  ['Postcode of Concern', 'Delivery drivers put a thumbs-down next to your address. It is the only thing they agree on.'],
  ['Official Mythology', 'The children’s version of you is gentler. In it you are only a tall wardrobe. Do not correct them.'],
  ['Hereditary Peer of the Damp', 'You now sit in a chamber with a leak above the seats. The chamber is moved. The leak follows.'],
  ['Recognised by the Sea', 'The tide comes in a little earlier than it needs to. It has been told what it is looking at.'],
  ['The Reason for the Wall', 'There was a wall put up long ago for a particular reason. The reason turns out to be your address.'],
  ['Tenured', 'You can no longer be removed, only reorganised. The paperwork is in a drawer that is also tenured.'],
  ['A Holiday, Observed Reluctantly', 'A day has been set aside in your name. Shops are closed. People stay in. Nobody knows who they are staying in for.'],
  ['Pre-Existing Condition', 'Insurers have your house on a form. They crossed through a box, then wrote “no” in a different pen.'],
  ['Institution', 'The house is now referred to as an institution. It is unclear what it institutes, but it does so every day.'],
  ['Geological', 'Rocks in the vicinity have started to lean toward you. A geologist has taken a note, and a long holiday.'],
  ['Sentient Zoning Law', 'The ordinance changes to suit you and tells the planning office afterward. They have learned to nod.'],
  ['Older Than the Shelf', 'People insist you were here first. The shelf is quietly agreeing, which is worse.'],
  ['Quoted by the Dead', 'The dead cite you in their disputes, and they are thorough. You have been misquoted twice, and corrected neither.'],
  ['Almost Entirely Legend', 'Very little of you is true now. The true part is small, damp and kept in a drawer, where it is safe.'],
  ['The Last Word on the Subject', 'There is nothing more to be said. It has been said. It was said by you, and it was one word, and it was “no”.']
];

export const LEGACY_RANKS = TEXT.map(([title, line], i) => ({
  at: legacyAt(i + 1), legacy: i + 1,
  title: 'Legacy ' + legacyNumeral(i + 1) + ': ' + title, short: title, line
}));

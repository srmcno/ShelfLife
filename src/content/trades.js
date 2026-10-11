// Words for trading between friends: the canned lines a sender can attach,
// the departing resident's last line, the arriving resident's first line, the
// new household's welcome and the old household's reaction.
//
// Lines are picked from the trade id, not at random, so both players, both of
// a player's devices and every replay of a sync see the same words.
// {name} is the resident, {from} the shelf it came from, {to} the shelf it goes to.

// What a sender may say with an offer. Free text between players is limited to
// display names, so this is the whole vocabulary of trade.
export const TRADE_LINES = [
  { id: 'fair', text: 'A fair trade. I checked, and it is fair to me.' },
  { id: 'wishlist', text: 'It was on your wishlist. I read your wishlist. I read everything.' },
  { id: 'regret', text: 'I let this go with real regret and a small receipt.' },
  { id: 'hums', text: 'It hums at night. I am told that passes.' },
  { id: 'hiding', text: 'No charge. I have simply run out of places to hide it.' },
  { id: 'apology', text: 'Consider this an apology. Do not consider it an admission.' },
  { id: 'swap', text: 'Yours looks lonely. Mine looks worse. Let us swap the problem.' },
  { id: 'final', text: 'Final offer. I say that every time, but this time there is a stamp.' },
  { id: 'counter', text: 'A counter-offer, as is my right under the Shelf Act.' },
  { id: 'nothing', text: 'I want nothing in return. Write that down somewhere I can point to.' }
];
export const TRADE_LINE_BY_ID = Object.fromEntries(TRADE_LINES.map(l => [l.id, l]));

export const LAST_LINES = [
  '“I have left a list of grievances under the bowl. It is double-sided.”',
  '“Water the thing in the corner. It is not a plant, but it enjoys being treated like one.”',
  '“Tell the others I said nothing. They will find that worse.”',
  '“I am taking the good crumb. You know the one.”',
  '“If anyone asks, I was never here. If anyone cries, I was here the whole time.”',
  '“I licked the doorframe on the way out. It is legally mine now.”',
  '“Do not let anyone have my slot. Leave it empty, as a warning.”',
  '“I forgive you. I have written down the exact amount.”',
  '“Forward my post. It is mostly threats I sent myself, but I like to keep up.”',
  '“I never liked this shelf. I liked one plank of it. You know which plank.”',
  '“There is something in the wall. You will know it is mine when it hatches.”',
  '“Goodbye. I was going to say something kind, but the moment has passed and I feel much better.”',
  '“Tell {to} I bite on Tuesdays. Then tell them what day it is.”',
  '“Keep the lamp on. Not for me. I just like knowing you are paying for it.”'
];

export const FIRST_LINES = [
  '“Where do you keep the screaming? I only need to know which cupboard.”',
  '“I am told this is an upgrade. I will be the judge of that, and of several other things.”',
  '“{from} sends regards. I made them up, but I made them up sincerely.”',
  '“I have counted the slots. One of them is lying.”',
  '“Nobody touch my box. My box may touch you. That is different.”',
  '“I was traded fairly. I checked. I am worth slightly more.”',
  '“Show me the bowl. No. The real bowl.”',
  '“I bring my name, my teeth and one small grudge, to be assigned later.”',
  '“I have already chosen my nemesis. Watch where I sit.”',
  '“The last shelf had a draught. I intend to miss it out loud, every day.”',
  '“I came in a box marked FRAGILE. I would like that painted on my slot.”',
  '“Hello. I have heard everything about you. The undertaker talks.”',
  '“Is this the shelf with the cult, or the other one? Either is fine. I brought a robe.”'
];

export const WELCOME_LINES = [
  '{name} has moved in by bill of sale. The others have formed a committee about it.',
  'A box arrived from {from}’s shelf. It held {name} and a note asking for the box back.',
  '{name} is here. The shelf made room the way a queue makes room.',
  'The undertaker delivered {name} personally and charged for the stairs. There are no stairs.',
  '{name} has been signed for. Nobody remembers signing.',
  '{name} arrived and asked who is in charge. Everybody said themselves.',
  '{name} has come from {from}’s shelf and has already compared the two, out loud.',
  '{name} unpacked in under a minute. It had packed for somewhere much worse.',
  'The residents have been told {name} is a cousin. Nobody believes it, and everybody is going along with it.',
  '{name} has arrived. Somebody has already written its name on a jar.',
  '{name} is new here. It has been given the tour, the rules and, by accident, a nickname it will never shake.',
  'The shelf welcomes {name}. The shelf is lying, but it is trying.'
];

export const FAREWELL_LINES = [
  'The others have shared out {name}’s things, mostly by eating them.',
  'Someone has drawn a chalk outline where {name} used to sit. It is not a good likeness.',
  'Nobody mentioned {name} at dinner. Everybody looked at the chair.',
  '{name}’s slot is being kept exactly as it was, including the smell.',
  'A small memorial has gone up for {name}, who is not dead, just on {to}’s shelf.',
  'The shelf has voted to stop talking about {name}. The vote was loud and took an hour.'
];

// A bill of sale needs a number. It is the trade id, made legible.
export const BILL_KICKERS = ['Bill of sale', 'Deed of transfer', 'Receipt of goods and souls'];

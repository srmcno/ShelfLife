// Co-op writing: hired help on a friend's expedition, the field reports that
// come home with them, what the lent resident remembers, and arcade duels.
// Every line is chosen by the game; nothing here is typed by a player except
// the names it is filled with. Placeholders: {name} the hired resident,
// {host} the shelf it came from, {lead} the hirer's lead resident, {hirer} the
// friend who hired it, {gear} the packed tool, {stop} a stop's title,
// {project} a household project, {friend} the other player, {game} an
// arcade game, {n} a round, {mine} and {theirs} scores, {stake} and {souls}.

/* ---------------- hired help, on the trip ---------------- */

// When the hire is confirmed and the guest joins the planner.
export const HIRE_ARRIVALS = [
  '{name} has arrived from {host}’s shelf with a packed lunch and no intention of sharing it.',
  '{name} is here on loan. {name} would like everyone to know it is on loan.',
  '{name} has brought a note from {host}. It says “Please return by bedtime”, underlined twice, once in anger.',
  '{name} introduces itself to the crew, then to the bag, then to the tool. Only the tool gets a handshake.',
  '{name} reads the expedition plan and asks who wrote it, in the voice people use for wills.',
  '{name} is from {host}’s shelf. It mentions this every few minutes, like a smoke alarm with a hometown.',
  '{name} has been hired. It would like the word “hired” used in full, every time, with eye contact.',
  '{name} has come to help, and to look at your shelf and say nothing in a way you can hear.',
  '{name} asks where the toilets are. There are no toilets. {name} writes this down.',
  '{name} has signed the waiver with a cross, a smaller cross and what may be a threat.'
];

// After each stop, by what the crew did there: 0 the quiet way, 1 a detour,
// 2 the packed tool. The guest says one of these in the field report.
export const GUEST_LINES = [
  [
    'I want it noted that I was willing to be brave. Nobody asked.',
    'On {host}’s shelf we call this a tactical sit.',
    'I have seen worse detours. I was not on them, but I saw them.',
    'Back home we would charge admission for this bit.',
    'I am paid by the stop, not by the peril. Carry on.',
    '{lead} keeps looking at me as if I should do something. I am doing something. I am resting professionally.',
    'This is the part of the trip I will describe differently later.',
    'I counted the exits. There were none. I felt better.',
    'My contract says nothing about heroics. I checked twice and then I ate it.',
    'We caught our breath. I caught slightly more than my share. I am a guest.',
    'At home this is called Tuesday.',
    'If anyone asks, this was my idea, and it was a good one, and I was very calm.'
  ],
  [
    'Fine. But I am telling {host} it was my idea, and that it went worse than it did.',
    'I touched it first. I would like that in the report, in bold.',
    '{lead} went left. I went slightly more left. That is leadership.',
    'I have done this before, in a dream. In the dream I was taller and it was a bakery.',
    'Nobody at home will believe this. Nobody at home believes anything I say. This changes nothing.',
    'I have bitten things for less.',
    'That was horrible. When is the next one.',
    'I would like danger money. I will accept danger soup.',
    'I nearly died. It was fine. It was the best part of the week.',
    'Whoever packed this expedition has never met a sock with ambitions.',
    'I am not out of breath. I am breathing with feeling.',
    'That will be in my memoirs. Chapter one. It is a short book with a lot of footnotes about {lead}.'
  ],
  [
    'We used the {gear}. I held the other end. I want both ends in the report.',
    'You brought a {gear}. On {host}’s shelf we would have brought two and lost one on purpose.',
    'I have opinions about how you hold a {gear}. I will keep them until the wages clear.',
    'Clever. I would have done the same, slower, with more complaining and a small fire.',
    'That {gear} has seen things today. So have I. Neither of us will discuss it.',
    'If the {gear} gets a thank you note, I want to be copied in.',
    'Equipment. We do not have equipment at home. We have {host}.',
    'I would have used teeth. But fine. Tools. Very modern. Very sad.',
    '{lead} did that well. Do not tell {lead} I said so. Tell {lead} I said it was adequate.',
    'Nobody told me there would be competence on this trip. I would have dressed for it.'
  ]
];

// On the homecoming card.
export const GUEST_FAREWELLS = [
  '{name} goes back to {host}’s shelf tonight with a story nobody there will believe.',
  '{name} leaves a review: “Four stars. One was for the biscuit.”',
  '{name} says goodbye to the crew one by one, and to {lead} twice, the second time to check.',
  '{name} asks to be paid in something with a lid.',
  '{name} thanks you for the trip, then thanks the bag, more warmly.',
  '{name} walks home alone. It insists this is how it prefers it, and then looks back four times.',
  '{name} has taken a souvenir. You are not told what. Count the spoons.',
  '{name} shakes hands with {lead}, finds the hand slightly damp, and decides to be gracious about it.'
];

/* ---------------- hired help, the field report home ---------------- */

export const REPORT_OPENERS = {
  drawer: [
    'Your {name} went into the Lost Sock Drawer with {hirer}’s crew.',
    'Your {name} spent the day in {hirer}’s sock drawer, which is a sentence nobody wants on a reference.',
    '{hirer} took your {name} into the Lost Sock Drawer, where the socks have formed a government.'
  ],
  fridge: [
    'Your {name} spent the day under {hirer}’s fridge.',
    '{hirer} took your {name} under the fridge, where the peas remember everyone’s ancestors.',
    'Your {name} went under {hirer}’s fridge and came back several degrees colder in manner.'
  ],
  cupboard: [
    'Your {name} opened {hirer}’s Cupboard Nobody Opens, on {hirer}’s behalf and at {hirer}’s insistence.',
    '{hirer} took your {name} into the Cupboard Nobody Opens. Somebody had to. It was your {name}.',
    'Your {name} went into {hirer}’s cupboard with a crew and came out with a crew and a new silence.'
  ]
};

// When the packed tool was used, by tool.
export const REPORT_GEAR = {
  thread: [
    '{name} held {hirer}’s thread while {lead} went down it, then held it again while {lead} came back up, slower.',
    '{name} was in charge of the safety pin and took it more seriously than anyone had asked.',
    '{name} tied a knot nobody could undo. The knot is now part of {hirer}’s furniture.'
  ],
  lantern: [
    '{name} carried {hirer}’s lamp up the stairs and down again.',
    '{name} held the lantern and pointed it at whatever {lead} was trying not to look at.',
    '{name} was given the lantern and used it mainly to look at its own face.'
  ],
  biscuit: [
    '{name} was trusted with {hirer}’s emergency biscuit and returned most of it.',
    '{name} carried the emergency biscuit the whole way and has asked whether it counts as a relationship.',
    '{name} handed over the emergency biscuit at the vital moment and has not let anyone forget the vital moment.'
  ]
};

// When the guest's own stats made a detour cheaper, by the stop's stat.
export const REPORT_HELPED = {
  cute: [
    'At {stop}, {name} was adorable on purpose, which is the worst kind, and it worked.',
    'At {stop}, {name} looked up at everyone until they felt bad. {lead} is still apologising.'
  ],
  menace: [
    'At {stop}, {name}’s menace did most of the talking and some of the biting.',
    'At {stop}, {name} stood very still and somebody else decided to leave.'
  ],
  damp: [
    'At {stop}, {name} was damp, which turned out to be a qualification.',
    'At {stop}, {name} dripped meaningfully and the way opened.'
  ],
  mystique: [
    'At {stop}, {name} said nothing in a meaningful way and it worked.',
    'At {stop}, {name} stared into the middle distance until the middle distance looked away.'
  ]
};

export const REPORT_QUIET = [
  'Most of the trip was the quiet way round. {name} describes it as “strategic”.',
  'They mostly went the quiet way. {name} has filed this under “crowd control”.',
  'It was a calm trip. {name} has asked that the word “calm” be removed from the record.'
];

export const REPORT_TIERS = [
  [
    'They came back with a curiosity nobody wanted and a strong sense of having been somewhere.',
    'They came back with the smallest curiosity on offer. {name} carried it like an organ for transplant.',
    'The haul was modest. {name} would like to stress that the haul was not its department.'
  ],
  [
    'They came back with something in the bag and nobody has asked what.',
    'They came back with a respectable curiosity. {hirer} has put it on a shelf where guests can pretend not to see it.',
    'A decent haul. {name} has started describing it as “ours”.'
  ],
  [
    'They came back with the good curiosity. {hirer} has framed it. {name} is not in the frame.',
    'They came back with the best curiosity on the route. {name} says it saw it first. {name} says that about everything.',
    'A perfect trip, more or less. {hirer} wept. {name} pretended it was the dust.'
  ]
];

export const REPORT_BUILT = [
  '{hirer}’s household built {project} with what they found. {name} has asked for a plaque.',
  'The parts went straight into {project} at {hirer}’s. {name} tested it first, uninvited.'
];
export const REPORT_EARLY = [
  'They came home early with what they had. {name} calls this “knowing when to leave a party”.',
  'They turned back before the last stop. {name} would like it noted that it voted to stay, quietly, after the vote.'
];
// How the guest was paid, besides the wages. The first is the original.
export const REPORT_PAY = [
  'It was paid in soup and has opinions about the soup.',
  'It was paid in buttons. It has asked whether buttons are legal tender here. They are now.',
  'It was paid in exposure. It has developed a cough.',
  'It was paid in biscuit crumbs, counted out in front of it, twice.',
  'It was paid with a firm handshake and a smaller, less firm one from {lead}.',
  'It was paid in a jar of something. The jar has a name on it. Not its name.',
  'It was paid in compliments, which it spent on the way home.',
  'It was paid in a single pea, which it will not let anyone see.',
  'It was paid in a receipt for a receipt.',
  'It was paid in gossip about {hirer}’s shelf, which it has brought home for you, warm.',
  'It was paid in a thank you card signed by everyone except {lead}.',
  'It was paid in a ride home on a teaspoon. The teaspoon was not consulted.'
];
export const REPORT_UNPAID = [
  'It worked for free today: {hirer}’s budget for hired help has run out. It has told everyone it worked for free today.',
  'There were no wages left today. {name} has started a union. It is the only member and the treasurer.'
];
// A hire that nobody finished, home by itself after three days.
export const REPORT_UNFINISHED = [
  'Your {name} came back from {hirer}’s shelf on its own after three days. It will not say where the expedition went. It has a new limp and an old smile.',
  '{hirer}’s expedition never came home, but your {name} did. It says the others are “fine” and “making their own way”.',
  'Your {name} returned from {hirer}’s shelf without the crew, the bag or an explanation. Somebody paid the base rate. Nobody knows who.'
];

/* ---------------- what the lent resident remembers ---------------- */

export const HIRE_MEMORIES = {
  drawer: [
    'I worked in {friend}’s sock drawer for a day. I know things about their socks I cannot unknow.',
    'I was hired help in {friend}’s drawer. The socks there are unionised. I am thinking about it.'
  ],
  fridge: [
    'I went under {friend}’s fridge as hired help. Their peas are ruder than ours. I miss them.',
    'I spent a day under {friend}’s fridge. The cold got into my opinions and has not left.'
  ],
  cupboard: [
    'I opened {friend}’s Cupboard Nobody Opens. I can never tell you what was in it. Ask me later.',
    'I was hired help in {friend}’s cupboard. I came back with a spoon nobody gave me.'
  ],
  lost: [
    'I went to {friend}’s shelf and came back alone. We do not talk about the expedition.'
  ]
};

/* ---------------- duels ---------------- */

export const DUEL_CHALLENGES = [
  '{friend} has challenged you to {game}. They have already played. They are being very casual about it.',
  '{friend} wants a duel at {game}. Their score is sealed in an envelope that smells faintly of confidence.',
  '{friend} played {game} and then sent you this. Draw your own conclusions. They have.',
  'A duel at {game}, from {friend}, who would like it known they were “barely trying”.',
  '{friend} challenges you to {game}. Their ghost is warmed up and has started stretching.',
  '{friend} has played your seed of {game} and left the lights on for you.',
  '{friend} is waiting for you at {game}. Their score is sealed. Their smugness is not.',
  '{friend} has thrown down a glove at {game}. It is one of the stuffed ones from Grave Whack. Pick it up anyway.'
];
export const DUEL_REMATCHES = [
  '{friend} wants a rematch at {game}: round {n}. They have played first and are pretending not to watch.',
  'Round {n} of {game}, from {friend}. They have played it. They have opinions about your last round.',
  '{friend} has asked for round {n}. Their ghost has been told it is “just a bit of fun”.'
];
export const DUEL_SEALED = [
  'Your score is sealed and on its way to {friend}. You may not tell them. You will want to.',
  'Sealed. {friend} gets your seed and your ghost, never your score. Let them wonder.',
  'Sent. Your ghost has been folded neatly and posted to {friend}.',
  'Sealed and sent. {friend} has 48 hours to answer, or to pretend they never saw it.'
];
export const DUEL_ROUND_WON = [
  'You take round {n}, {mine} to {theirs}. Be gracious. Or don’t; it is your round.',
  'Round {n} is yours, {mine} to {theirs}. {friend}’s ghost has gone very quiet.',
  '{mine} to {theirs}. You win round {n}. {friend} has asked to see the replay. There is no replay. There is only you.'
];
export const DUEL_ROUND_LOST = [
  '{friend} takes round {n}, {theirs} to {mine}. The ghost would like to thank its coach.',
  '{theirs} to {mine}. {friend} wins round {n}. Their ghost did a little bow on the way out.',
  'Round {n} to {friend}, {theirs} to {mine}. You were robbed, says nobody.'
];
export const DUEL_ROUND_TIED = [
  '{mine} each. A dead heat, which in this house counts as a compliment.',
  'Level at {mine}. Round {n} belongs to nobody. You and the ghost stare at each other.'
];
export const DUEL_SERIES = {
  won: ['You win the duel {a} to {b}.', 'The duel is yours, {a} to {b}. {friend} has gone for a walk.'],
  lost: ['{friend} wins the duel {b} to {a}.', 'The duel goes to {friend}, {b} to {a}. You have been asked not to mention the seed.'],
  tie: ['The duel is a draw. Stakes go home to their owners, slightly embarrassed.'],
  void: ['The duel was called off. Every stake comes back, untouched and a little bored.'],
  lapsed: ['{friend} never answered. The duel lapsed after 48 hours and your stake came back.']
};
export const DUEL_STAKES = {
  none: 'No stake. Only pride, which is worth less and costs more.',
  some: 'Stake: {stake} souls each. The winner takes both; a draw or a lapse returns them.'
};
// The ghost, during your run. Never a number: both scores reveal together.
export const GHOST_LINES = {
  ahead: ['You are ahead of {friend}’s ghost.', '{friend}’s ghost is behind you, looking worried.', 'You are ahead. The ghost is pretending this is a warm-up.'],
  behind: ['{friend}’s ghost is ahead.', 'The ghost is ahead and humming.', '{friend}’s ghost is ahead and has not looked back once.'],
  level: ['Neck and neck with {friend}’s ghost.', 'Level with the ghost. It is breathing down your neck, which is a trick; it does not breathe.'],
  gone: ['{friend}’s ghost has left the building.', 'The ghost has gone. Beat what it left behind.'],
  ticker: ['{friend}’s run is playing beside you as scores only. Their ghost could not make the trip.']
};

/* ---------------- filling ---------------- */

export function fill(line, vars = {}) {
  return String(line).replace(/\{(\w+)\}/g, (all, key) => Object.hasOwn(vars, key) ? String(vars[key]) : all);
}
// A stable pick: the same key always gets the same line, so a report reads the
// same every time it is opened and different trips read differently.
export function pickBy(list, key) {
  let h = 2166136261;
  for (const ch of String(key)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return list[(h >>> 0) % list.length];
}

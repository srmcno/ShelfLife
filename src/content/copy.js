/* ================= CARE COPY ================= */
export const NEED_LABEL = { food: 'Fed', fuss: 'Fussed', clean: 'Clean' };
export const DECAY = { food: 5.2, fuss: 4.4, clean: 3.4 };

export const COMPLAINTS = {
  food: {
    annoyed: [
      'Has not eaten. Is being brave about it.',
      'Asked when dinner is. Dinner was yesterday.',
      'Has been staring at the kitchen. Pointedly.',
      'Is chewing the shelf. Slowly. Meaningfully.',
      'Checked the bowl four times this hour. Optimism, mostly.',
      'Has started rationing. There was nothing to ration.',
      'Sighed audibly near the empty bowl.',
      'Says it is "not hungry, just disappointed." It is hungry.'
    ],
    furious: [
      'Has started eyeing the others.',
      'Says it will eat the shelf. It might.',
      'Ate something structural. You will find out which part later.',
      'Has drawn up a menu. The others are on it.',
      'Says hunger is temporary and grudges are forever.',
      'Has begun taking inventory of anything that could be food.',
      'Chewed through something that was not meant to be chewed.',
      'Has stopped asking. That is worse.',
      'Looked at your hand like it was an appetizer.',
      'Filed dinner under "unresolved." The file is thick.'
    ]
  },
  fuss: {
    annoyed: [
      'Waited by the door. You walked past twice.',
      'Says you have been busy. Says it in that voice.',
      'Has been sighing at a volume you were meant to hear.',
      'Asked the others whether you had mentioned it. You had not.',
      'Left a spot warm for you. You did not sit in it.',
      'Practiced a conversation with you that did not happen.',
      'Has started a countdown. It will not say to what.',
      'Watched the door for a while. The door did not open.'
    ],
    furious: [
      'Has stopped waiting. Wants you to know it stopped.',
      'Has decided it does not need anyone. It is lying.',
      'Turned to face the wall. It has been hours.',
      'Has written you out of something. There was nothing to be written out of.',
      'Says it is fine. Nothing about it is fine.',
      'Has unlearned your name on purpose.',
      'Practiced getting along without you. Badly.',
      'Told the others it never liked you anyway.',
      'Has drafted a goodbye it has no intention of sending. Yet.',
      'Stopped saving you a spot. The spot is gone now.'
    ]
  },
  clean: {
    annoyed: [
      'Something is growing on it. It has named the something.',
      'Is sticky and will not explain why.',
      'Left a mark. The mark is spreading.',
      'Has begun attracting flies. Considers them company.',
      'Smells faintly of something you cannot place. Yet.',
      'Has developed a texture. It is proud of the texture.',
      'Left a print somewhere it should not have been.',
      'Is collecting dust like it is a hobby.'
    ],
    furious: [
      'Has achieved a new texture. Do not touch it.',
      'Is no longer entirely one color.',
      'The shelf smells. It says that is not its problem.',
      'Something has moved in with it and started charging rent.',
      'You will need gloves. Possibly a bag.',
      'Has begun to shine, in a way that concerns everyone.',
      'Left a trail. The trail is still moving.',
      'Something under it has developed a heartbeat. Probably.',
      'Has stopped being a color and started being a warning.',
      'Requires a hazmat approach and a moment of silence.'
    ]
  }
};

export const CARE_LINES = {
  food: [
    'Ate. Said nothing.',
    'Ate it. Wanted a different one.',
    'Inhaled it. Looked at the bowl. Looked at you.',
    'Ate, then asked what the next one is.',
    'Chewed slowly while maintaining eye contact.',
    'Finished it in one bite and pretended it took longer.',
    'Ate half. Saved the rest. For spite, probably.',
    'Sniffed it first. Approved, reluctantly.',
    'Ate without looking away from the door.',
    'Licked the bowl clean and rated it "adequate."'
  ],
  fuss: [
    'Allowed it. Briefly.',
    'Pretended not to enjoy that.',
    'Leaned in. Will deny leaning in.',
    'Purred, then acted like nothing happened.',
    'Says it merely tolerated that. It did not merely tolerate that.',
    'Closed its eyes for exactly four seconds. A record.',
    'Let you get close. Filed it under "an exception."',
    'Made a small sound. Refuses to repeat it.',
    'Softened, visibly, then caught itself.',
    'Accepted the attention like it was doing you a favor.'
  ],
  clean: [
    'Tolerated the wipe. Barely.',
    'Is clean. Is furious about being clean.',
    'Smells like nothing now. It preferred smelling like something.',
    'Held very still. Made it weird.',
    'Watched you the entire time without blinking.',
    'Emerged pristine and immediately went looking for something to ruin that.',
    'Sat through it with the dignity of someone being wrongly arrested.',
    'Is shiny now. Resents being shiny.',
    'Allowed the cleaning under written protest. There is no writing. There is protest.',
    'Came out smelling like nothing, which it considers a personality loss.'
  ]
};

export const OVERFED = {
  food: [
    'Was not hungry. Ate anyway. Consequences pending.',
    'Turned it down. Nobody turns down food. Something is wrong.',
    'Is full. Took it anyway. For the stash.',
    'Ate out of spite, not hunger. Same result.',
    'Says it is stuffed. Is already eyeing the next one.',
    'Has reached capacity and kept going regardless.'
  ],
  fuss: [
    'Has had enough attention for one day.',
    'Wriggled away. You are the clingy one now.',
    'Says this is getting needy. It means you.',
    'Has had its fill of affection and is filing a complaint about the surplus.',
    'Requested space. Received it. Immediately missed the attention.',
    'Is overstimulated and blaming you for it, specifically.'
  ],
  clean: [
    'Is already clean. This is harassment.',
    'Was clean. Is now damp. Well done.',
    'Says you are scrubbing off its personality.',
    'Has been cleaned enough to lose a layer of mystique.',
    'Squeaks now. Did not squeak before. Does not want to discuss it.',
    'Is too clean to function and holds you personally responsible.'
  ]
};

export const HAPPY_NOTES = [
  'Everything is fine. It is suspicious about that.',
  'Has no complaints today and wants that noted as unusual.',
  'Sat on your thing. Considers this affection.',
  'Slept somewhere warm and will not admit whose fault that was.',
  'Is content. Do not make it weird.',
  'Said something almost nice, then took it back.',
  'Has decided to keep you. For now.',
  'Is in a good mood. The others find this unsettling.',
  'Hummed something. Stopped the second you noticed.',
  'Left the good spot for you. Will deny it was on purpose.',
  'Had a fine day and is furious about how fine it was.',
  'Smiled. It was brief. It happened.',
  'Told the others you are "acceptable." High praise, apparently.',
  'Napped in full view of everyone. Vulnerability, on its terms.',
  'Is, against all evidence and effort, happy.',
  'Kept a good mood going all day and blamed nobody for it, which is new.'
];

export const ASLEEP_LINES = [
  'Was asleep. Is now awake and unimpressed.',
  'You woke it. It will remember.',
  'It is daytime. It is nocturnal. Do the math.',
  'Opened one eye, closed it. That was your answer.',
  'Was mid-dream. You will never know about what. Neither will it.',
  'Grumbled something in its sleep. It was about you.',
  'Surfaced just enough to register the disappointment, then went back under.',
  'Is technically awake now. Emotionally, still asleep.'
];

export const EVENTS = [
  'Something fell off the shelf in the night. Nothing was near the edge.',
  'A tooth was found on the floor. Nobody is missing one.',
  'They were all facing the same direction this morning. Nobody moved them.',
  'There is one more shadow than there are pets. Probably the lighting.',
  'A name has been scratched into the wood. It is not one of theirs.',
  'The house was very quiet at 4am. Too quiet, according to three of them.',
  'Something has been buried in a houseplant. It is best left there.',
  'They have voted on something. The result was not shared with you.',
  'The pile of teeth is growing. They are calling it a collection.',
  'One of them was on the top shelf this morning. It cannot climb.',
  'Everyone was exactly one inch to the left. Every single one.',
  'A small hole has appeared in the wall. It is at their height.',
  'The clock in the other room stopped at the same time three nights running.',
  'Something was singing very quietly after midnight. It knew the words.',
  'A second set of small footprints appeared next to the usual ones. They stop mid-stride.',
  'Every mirror on the shelf was turned to face the wall this morning. Nobody will say who started it.',
  'There is a list taped under the shelf. Your name is on it twice.',
  'The temperature dropped for exactly six minutes at 3am. It has been noted.',
  'Something drew a door on the wall. It has no handle. Nobody has tried it. Yet.',
  'A jar that was empty last night is not empty anymore.',
  'They all went quiet at once, for no reason anyone will name.',
  'One of the shadows on the shelf does not match anything currently on the shelf.',
  'A single candle was lit and extinguished by morning. Nobody owns a lighter.',
  'Something has been counting. The counting stopped exactly at your name.'
];

/* ================= NAMING + BIO ================= */
export const FALLBACK_NAMES = [
  'Bartholomew', 'Gnash', 'Miss Teeth', 'Pudding', 'The Reverend', 'Snaggle', 'Doreen', 'Wretch',
  'Buttons', 'Mildew', 'Sir Nibbles', 'Grandma', 'Tuesday', 'Hex', 'Marshmallow', 'Custard',
  'The Landlord', 'Prudence', 'Gob', 'Winifred', 'Sock', 'Beverly', 'The Widow', 'Gravy',
  'Nubbins', 'Small Kevin', 'Aunt Vera', 'Chompy', 'Poultice', 'Dread Nancy', 'Bisque', 'Moth',
  'Gristle', 'Peaches', 'Uncle Bramble', 'Sister Margaret', 'The Auditor', 'Roach', 'Vellum',
  'Nubby', 'The Understudy', 'Cutlet', 'Miss Fortune', 'Gizzard', 'The Sublet', 'Old Nan',
  'Weevil', 'The Deposit', 'Corncob', 'Sourdough', 'The Notary', 'Bramwell', 'Mothball',
  'The Intern', 'Chives', 'Reverend Tuesday', 'Gnat', 'The Estate', 'Buttercream', 'Doily',
  'The Codicil', 'Sprocket', 'Aunt Ruth', 'Barnacle'
];

export const ORIGINS = [
  'Found at a yard sale in a town nobody names.',
  'Arrived in a box marked "do not".',
  'Traded for half a sandwich.',
  'Was in the walls. Now it is not.',
  'Came free with something else. That something is gone.',
  'Left on a porch. Not this porch.',
  'Won in a bet nobody remembers making.',
  'Was already here when you moved in.',
  'Rescued, allegedly.',
  'Fell out of a coat pocket. Not yours.',
  'Dug up, cleaned off, mostly.',
  'Returned to the store twice. Came back anyway.',
  'Inherited. The will was oddly specific about it.',
  'Found in a storage unit with the light still on.',
  'A gift from someone who moved away shortly afterward.',
  'Delivered to the wrong address. Kept anyway.',
  'Won at a raffle nobody remembers entering.',
  'Followed you home. You let it.',
  'Confiscated from a yard sale before it could be sold to someone worse.',
  'Appeared during a power outage. Has never explained the timing.',
  'Purchased "as is." As is turned out to be a lot.',
  'Was left in the mailbox with no note and no stamp.',
  'Emerged from a box marked FRAGILE. Was not fragile.',
  'Swapped for something you liked better at the time.',
  'Found under the porch, mid-argument with something unseen.',
  'Came with the apartment. The lease did not mention it.',
  'Salvaged from a dumpster behind somewhere that closed suddenly.',
  'Handed over by a stranger who seemed relieved to be rid of it.',
  'Turned up at the door during a storm and never left.',
  'Acquired in a trade that felt fair at the time.'
];

export const HABITS = [
  'Keeps its own hours.',
  'Answers to its name roughly half the time.',
  'Not for sale. It has made that clear.',
  'Prefers the left side of everything.',
  'Does not photograph well and knows it.',
  'Has strong opinions about the curtains.',
  'Sits where it likes, which is where you were.',
  'Will not be rushed.',
  'Holds grudges longer than it has been alive.',
  'Sleeps facing the door.',
  'Does not like being counted.',
  'Has never once been where you left it.',
  'Refuses to be photographed from the left.',
  'Counts things. Will not say what or why.',
  'Naps in fifteen-minute increments, on the hour, without fail.',
  'Has never once said thank you and never will.',
  'Keeps something hidden and checks on it nightly.',
  'Refuses all beverages except the one you are drinking.',
  'Insists on the last word, even when there is no argument.',
  'Has a designated sulking corner.',
  'Will not enter a room second.',
  'Tracks the weather better than any app.',
  'Only eats in front of an audience.',
  'Maintains a private feud with the vacuum cleaner.'
];

export const CLOSERS = [
  'Good luck.',
  'It has been very patient with you.',
  'Do not leave food out.',
  'Loved, technically.',
  'Ask it nothing after dark.',
  'Warranty void.',
  'Handle with mild suspicion.',
  'No refunds. It checked.',
  'Keep it away from the good curtains.',
  'It knows where you sleep. That is probably fine.',
  'Do not let it near the good yarn.',
  'It is watching you read this.',
  'Feed it on schedule. It is keeping track.',
  'You agreed to this. There are witnesses.',
  'It does not forgive. It archives.',
  'Batteries not included. There are no batteries.',
  'Terms and conditions apply, mostly to you.',
  'It has already decided how this ends.',
  'Store away from open flame and open arguments.',
  'This is now permanent. Congratulations, probably.'
];

/* ================= GRUDGES + STREAK ================= */
// Keyed by grudge escalation stage: 1 = mild (5+ grudges), 2 = serious (12+), 3 = terminal (20+).
export const GRUDGE_LINES = {
  1: [
    '{n} has started a list with your name at the top.',
    "{n} moved your things two inches to the left. Just to see if you'd notice.",
    '{n} is being extremely polite to you. This is not a good sign.',
    '{n} has stopped making eye contact. It is on purpose.',
    '{n} left something unpleasant exactly where you would find it.',
    '{n} has begun referring to you in the third person while you are in the room.'
  ],
  2: [
    '{n} has recruited two others against you. You are the last to know.',
    '{n} has stopped eating in front of you. It eats fine when you leave.',
    '{n} has drawn up something that looks a lot like a formal grievance, with your name on it.',
    '{n} rearranged the shelf overnight so nothing faces you.',
    '{n} has been telling the others a version of events that is not flattering to you.',
    '{n} has taken something of yours and is not hiding it especially well.'
  ],
  3: [
    '{n} has stopped speaking to you entirely. The silence has a schedule.',
    '{n} has named a small, ominous jar after you. Nobody knows what is in the jar.',
    '{n} held a ceremony. You were not invited, but you were definitely the subject.',
    '{n} has begun leaving notes that are just your name, underlined, with no further explanation.',
    '{n} has started keeping a shrine. It is not a nice shrine.',
    '{n} is being suspiciously, aggressively kind to you now. This is the worst sign yet.'
  ]
};

// {d} = consecutive check-in day count.
export const STREAK_LINES = [
  "Oh. You're back. Day {d}.",
  'Day {d}. They noticed. They will not say they noticed.',
  '{d} days running. Somewhere between habit and hostage situation.',
  'Day {d} of you showing up. Nobody is impressed. Everybody noticed.',
  '{d} days. That is either dedication or a controlled experiment. Unclear which.',
  'Back again. Day {d}. The shelf keeps better records than you do.',
  'Day {d}. This is either the beginning of something or a very long habit.',
  '{d} days straight. They have started to expect you, which is worse than needing you.',
  'Day {d}. Somewhere, quietly, this is being counted as loyalty.',
  '{d} days. Nobody said it out loud, but they would miss you. Do not bring this up.'
];

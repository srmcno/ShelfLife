/* ================= CARE COPY =================
   Every pool below is consumed in a specific sentence position. Before adding a line,
   check where it actually lands:

   COMPLAINTS / HAPPY_NOTES  -> a shelf note bylined with the pet's own name, so they
                                read as third-person observations about that pet.
   CARE_LINES / OVERFED /
   ASLEEP_LINES              -> a toast, rendered as "<PetName>: <line>", so the line
                                must be a report on what the pet just did.
   EVENTS                    -> bylined "the shelf". No single pet is the subject.
   ORIGINS/HABITS/CLOSERS    -> the bio, assembled as
                                ORIGIN + ' ' + HABIT + ' ' + trait.blurb + ' ' + CLOSER,
                                so each has to be a complete standalone sentence.
   GRUDGE_LINES              -> bylined with the pet's name, and {n} is that same pet.
   STREAK_LINES              -> bylined "the shelf". {d} is the day count. */
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
      'Sighed near the empty bowl until somebody looked.',
      'Says it is "not hungry, just disappointed." It is hungry.',
      'Moved the empty bowl into your path. Twice.',
      'Has begun describing meals it has had. In detail. To nobody.'
    ],
    furious: [
      'Has started eyeing the others.',
      'Says it will eat the shelf. It might.',
      'Ate something structural. You will find out which part later.',
      'Has drawn up a menu. The others are on it.',
      'Says hunger is temporary and grudges are forever.',
      'Has divided the shelf into food and not-yet-food.',
      'Chewed the cord. The cord was not plugged in. It checked first.',
      'Has stopped asking. That is worse.',
      'Looked at your hand like it was an appetizer.',
      'Filed dinner under "unresolved." The file is thick.',
      'Is no longer distinguishing between snacks and neighbors.',
      'Told the others it would go first, and that they should be ready.'
    ]
  },
  fuss: {
    annoyed: [
      'Waited by the door. You walked past twice.',
      'Says you have been busy. Says it in that voice.',
      'Heard your footsteps and sat up. It was the radiator.',
      'Asked the others whether you had mentioned it. You had not.',
      'Left a spot warm for you. You did not sit in it.',
      'Practiced a conversation with you that did not happen.',
      'Has started a countdown. It will not say to what.',
      'Was fine all day and would like that investigated.',
      'Has been keeping track of who you greeted first. It was not this one.',
      'Turned its back, then checked over its shoulder to see if that had worked.'
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
      'Stopped saving you a spot. Somebody else is in it.',
      'Has begun introducing itself as unattached.',
      'Looked directly at you and then looked directly away. Deliberately. Slowly.'
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
      'Left a print on the ceiling. Nobody is addressing the ceiling.',
      'Is furred with dust and calls it a coat.',
      'Was clean on Tuesday. Nobody can account for Wednesday.',
      'Has stopped being wiped down and started being negotiated with.'
    ],
    furious: [
      'Has achieved a new texture. Do not touch it.',
      'Is no longer entirely one color.',
      'The shelf smells. It says that is not its problem.',
      'Something has moved in with it and started charging rent.',
      'You will need gloves. Possibly a bag.',
      'Has begun to shine. Nothing clean shines like that.',
      'Left a trail. The trail is still moving.',
      'Something under it has a heartbeat. It is slower than yours.',
      'Has stopped being a color and started being a warning.',
      'Requires a hazmat approach and a moment of silence.',
      'Is damp in a way that suggests intent.',
      'The others have relocated. All of them. Without discussion.'
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
    'Licked the bowl clean and rated it "adequate."',
    'Ate it in the corner, facing out, like it expected trouble.',
    'Took the food. Did not take it graciously.'
  ],
  fuss: [
    'Allowed it. Briefly.',
    'Pretended not to enjoy that.',
    'Leaned in. Will deny leaning in.',
    'Purred, then acted like nothing happened.',
    'Says it tolerated that. Its eyes were closed the entire time.',
    'Closed its eyes for exactly four seconds. A record.',
    'Let you get close. Filed it under "an exception."',
    'Made a small sound. Refuses to repeat it.',
    'Softened, visibly, then caught itself.',
    'Accepted the attention like it was doing you a favor.',
    'Headbutted your hand once, then looked away as if that had not happened.',
    'Stayed for the whole thing. Left the second it ended, to make a point.'
  ],
  clean: [
    'Tolerated the wipe. Barely.',
    'Is clean. Is furious about being clean.',
    'Smells like nothing now. It preferred smelling like something.',
    'Held very still. Made it weird.',
    'Watched you the entire time without blinking.',
    'Came out spotless. Went straight for the fern.',
    'Sat through it with the dignity of someone being wrongly arrested.',
    'Is shiny now. Will not be seen like this.',
    'Allowed the cleaning under written protest. There is no writing. There is protest.',
    'Bit the cloth. Once. To establish terms.',
    'Was cleaned. Immediately sat somewhere questionable.',
    'Did not resist, which everyone agrees is out of character.'
  ]
};

export const OVERFED = {
  food: [
    'Was not hungry. Ate anyway. Consequences pending.',
    'Turned it down. Nobody turns down food. Something is wrong.',
    'Is full. Took it anyway. For the stash.',
    'Ate out of spite, not hunger. Same result.',
    'Says it is stuffed. Is already eyeing the next one.',
    'Ate past the point of dignity and is not embarrassed.',
    'Accepted a fourth helping the way a hostage accepts a phone call.'
  ],
  fuss: [
    'Has had enough attention. Will want more in ten minutes. Has been told this.',
    'Wriggled away. You are the clingy one now.',
    'Says this is getting needy. It means you.',
    'Has had its fill of affection and is filing a complaint about the surplus.',
    'Requested space. Received it. Immediately missed the attention.',
    'Has been fussed into a mood. The mood is about you.',
    'Left mid-fuss to prove it could.'
  ],
  clean: [
    'Is already clean. This is harassment.',
    'Was clean. Is now damp. Well done.',
    'Says you are scrubbing off its personality.',
    'Has been cleaned down to the base layer. There was supposed to be more.',
    'Squeaks now. Did not squeak before. Does not want to discuss it.',
    'Is too clean to be taken seriously by the others. That is on you.',
    'Has been cleaned three times today and is starting to take it as an accusation.'
  ]
};

export const HAPPY_NOTES = [
  'Everything is fine. It is suspicious about that.',
  'Has no complaints today and wants that noted as unusual.',
  'Sat on your thing. Considers this affection.',
  'Slept somewhere warm. Will not say it was your lap.',
  'Is content. Do not make it weird.',
  'Said something almost nice, then took it back.',
  'Has decided to keep you. For now.',
  'Is in a good mood. The others find this unsettling.',
  'Hummed something. Stopped the second you noticed.',
  'Left the good spot for you. Will deny it was on purpose.',
  'Had a fine day and is furious about how fine it was.',
  'Smiled. It was brief. It happened.',
  'Told the others you are "acceptable." That is the top of its scale.',
  'Napped in full view of everyone. Belly up. Briefly.',
  'Is, against all evidence and effort, happy.',
  'Went a whole day without blaming anybody. Nobody knows what to do with that.',
  'Let you leave the room without comment. That is new.',
  'Was found asleep facing the door with the door open. It trusts something now.',
  'Started to complain, thought about it, and stopped.'
];

export const ASLEEP_LINES = [
  'Was asleep. Is now awake and unimpressed.',
  'You woke it. It will remember.',
  'It is daytime. It is nocturnal. This was always going to go badly.',
  'Opened one eye, closed it. That was your answer.',
  'Was mid-dream. You will never know about what. Neither will it.',
  'Grumbled something in its sleep. It was about you.',
  'Surfaced just enough to register the disappointment, then went back under.',
  'Is technically awake now. Emotionally, still asleep.',
  'Accepted the interruption. Filed the interruption.',
  'Went straight back to sleep, but louder, so you would know.'
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
  'A second set of small footprints appeared beside the usual ones. They stop mid-stride.',
  'Every mirror on the shelf was turned to face the wall. Nobody will say who started it.',
  'There is a list taped under the shelf. Your name is on it twice.',
  'The temperature dropped for exactly six minutes at 3am. It has been noted.',
  'Something drew a door on the wall. It has no handle. Nobody has tried it. Yet.',
  'A jar that was empty last night is not empty anymore.',
  'They all went quiet at 9:14. They went quiet at 9:14 the night before, too.',
  'The dust has been swept into a shape. There is a name written under the shape.',
  'A single candle was lit and put out by morning. Nobody in this house owns a lighter.',
  'Something counted to nine in the night and then started again.',
  'Every one of them was awake at 3:12 and none of them will discuss it.',
  'A small chair has been arranged to face the shelf. There is no small chair in this house.',
  'One of them has been practicing your handwriting. It is getting good.',
  'The wood under the shelf is warm. It has been warm since Tuesday.',
  'Somebody left the good spot empty all night. Out of respect, apparently.',
  'There are eleven of them in the photograph. There are ten of them on the shelf.',
  'The fern was moved four inches and put back facing a different way.',
  'Something laughed at 2am. Only one of them laughs, and it was asleep.',
  'A door in this house opened and closed. Every door is accounted for.',
  'They have started leaving a gap in the middle of the shelf. Nobody will sit in it.',
  'A drawing was found under the shelf. It is a drawing of the room, from above.',
  'Somebody has been leaving crumbs in a line, leading somewhere, deliberately.'
];

/* ================= NAMING + BIO ================= */
export const FALLBACK_NAMES = [
  'Bartholomew', 'Gnash', 'Miss Teeth', 'Pudding', 'The Reverend', 'Snaggle', 'Doreen', 'Wretch',
  'Buttons', 'Mildew', 'Sir Nibbles', 'Grandma', 'Tuesday', 'Hex', 'Marshmallow', 'Custard',
  'The Landlord', 'Prudence', 'Gob', 'Winifred', 'Beverly', 'The Widow', 'Gravy',
  'Nubbins', 'Small Kevin', 'Aunt Vera', 'Chompy', 'Poultice', 'Dread Nancy', 'Bisque', 'Moth',
  'Gristle', 'Peaches', 'Uncle Bramble', 'Sister Margaret', 'The Auditor', 'Vellum',
  'The Understudy', 'Cutlet', 'Miss Fortune', 'Gizzard', 'The Sublet', 'Old Nan',
  'Weevil', 'The Deposit', 'Corncob', 'Sourdough', 'The Notary', 'Bramwell', 'Mothball',
  'The Intern', 'Reverend Tuesday', 'The Estate', 'Buttercream', 'Doily',
  'The Codicil', 'Aunt Ruth', 'Great Aunt Something', 'The Second Mrs. Hobbs',
  'Nobody You Know', 'The Executor', 'Little Consequence', 'Mrs. Pilchard', 'The Deceased'
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
  'Followed you home. You let it.',
  'Bought at a yard sale to keep it away from the other bidder.',
  'Appeared during a power outage and has never explained the timing.',
  'Purchased "as is." As is turned out to be a lot.',
  'Was in the mailbox with no note and no stamp.',
  'Emerged from a box marked FRAGILE. Was not fragile.',
  'Traded away once. Traded back at a loss.',
  'Found under the porch, mid-argument with something unseen.',
  'Came with the apartment. The lease did not mention it.',
  'Salvaged from a dumpster behind somewhere that closed suddenly.',
  'Handed over by a stranger who seemed relieved to be rid of it.',
  'Turned up at the door during a storm and never left.',
  'Bought at an estate sale, from a room the family would not enter.',
  'Came out of a wall during renovations. Renovations stopped.',
  'Was the only thing left in the house when the house was cleared.',
  'Arrived in a hamper addressed to a previous tenant.',
  'Pulled out of a river. Was completely dry.',
  'Bid on by mistake. Won by a wide margin.',
  'Left behind by a lodger who paid three months in advance and never returned.'
];

export const HABITS = [
  'Keeps its own hours.',
  'Answers to its name roughly half the time.',
  'Not for sale. It has made that clear.',
  'Prefers the left side of everything.',
  'Does not photograph well and knows it.',
  'Has strong opinions about the curtains.',
  'Sits where it likes, which is where you were.',
  'Will not be rushed, hurried, or reasoned with.',
  'Holds grudges longer than it has been alive.',
  'Sleeps facing the door.',
  'Does not like being counted.',
  'Has never once been where you left it.',
  'Counts things. Will not say what or why.',
  'Naps in fifteen-minute increments, on the hour, without fail.',
  'Has never once said thank you and never will.',
  'Keeps something hidden and checks on it nightly.',
  'Refuses all beverages except the one you are drinking.',
  'Insists on the last word, even when there is no argument.',
  'Has a designated sulking corner.',
  'Will not enter a room second.',
  'Knows when it is going to rain and sulks in advance.',
  'Only eats in front of an audience.',
  'Maintains a private feud with the vacuum cleaner.',
  'Sits in the exact center of any surface offered to it.',
  'Waits until you are almost asleep to start moving around.',
  'Has never been seen entering or leaving a room, only being in one.',
  'Considers eye contact a negotiation.'
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
  'It is watching you read this.',
  'Feed it on schedule. It is keeping track.',
  'You agreed to this. There are witnesses.',
  'It does not forgive. It archives.',
  'Batteries not included. There are no batteries.',
  'Terms and conditions apply, mostly to you.',
  'It has already decided how this ends.',
  'Store away from open flame and open arguments.',
  'This is now permanent. Congratulations, probably.',
  'Previous owners are not available for comment.',
  'Do not apologize to it. It will take that as an admission.',
  'It sleeps. That is the good news.'
];

/* ================= GRUDGES + STREAK ================= */
// Keyed by grudge escalation stage: 1 = mild (5+ grudges), 2 = serious (12+), 3 = terminal (20+).
// {n} is the grudge-holding pet itself, and the note is bylined with that same name.
export const GRUDGE_LINES = {
  1: [
    '{n} has started a list with your name at the top.',
    "{n} moved your things two inches to the left. Just to see if you'd notice.",
    '{n} is being extremely polite to you. This is not a good sign.',
    '{n} has stopped making eye contact. It is on purpose.',
    '{n} left something unpleasant exactly where you would find it.',
    '{n} has begun referring to you in the third person while you are in the room.',
    '{n} has started leaving the room when you enter it. Slowly. So you see it happen.'
  ],
  2: [
    '{n} has recruited two others against you. You are the last to know.',
    '{n} has stopped eating in front of you. It eats fine when you leave.',
    '{n} has drawn up something that looks a lot like a formal grievance, with your name on it.',
    '{n} rearranged the shelf overnight so that nothing faces you.',
    '{n} has been telling the others a version of events that is not flattering to you.',
    '{n} has taken something of yours and is not hiding it especially well.',
    '{n} has stopped filing and started planning.'
  ],
  3: [
    '{n} has stopped speaking to you entirely. The silence has a schedule.',
    '{n} has labeled a jar with your name on it. The jar is not empty.',
    '{n} held a ceremony. You were not invited, but you were definitely the subject.',
    '{n} leaves notes now. They are all just your name, underlined.',
    '{n} has built something out of your things. It is arranged like an altar.',
    '{n} is being very kind to you now. It has never been kind before.',
    '{n} has forgiven you. It said so out loud, twice, without being asked.'
  ]
};

// {d} = consecutive check-in day count.
export const STREAK_LINES = [
  "Oh. You're back. Day {d}.",
  'Day {d}. They noticed. They will not say they noticed.',
  '{d} days running. Somewhere between a habit and a hostage situation.',
  'Day {d} of you showing up. Nobody is impressed. Everybody noticed.',
  '{d} days. Either you are devoted, or this is an experiment and you are in it.',
  'Back again. Day {d}. The shelf keeps better records than you do.',
  '{d} days straight. They have started to expect you, which is worse than needing you.',
  'Day {d}. Somewhere, quietly, this is being counted as loyalty.',
  '{d} days. Nobody said it out loud, but they would miss you. Do not bring this up.',
  'Day {d}. One of them was already facing the door when you came in.'
];

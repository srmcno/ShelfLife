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
   STREAK_LINES              -> bylined "the shelf". {d} is the day count.

   THE TEST FOR A LINE IN HERE (docs/comedy-direction.md, rule A2): a line that would
   survive being said by an adult in a flatshare is not a Shelf Life line. These are
   four inches tall, wrong-textured, sitting in numbered slots six to a row, and
   nothing here can end. If none of that is doing work, the line is doing nothing.

   The pools above are rendered raw, so they carry no placeholders and no cast: a
   one-pet shelf on its first hour must get full-strength material out of them. The
   state-aware pools further down are the opposite — every one declares its required
   substitutions in TEMPLATE_SUBS and is only fired when engine/loop.js can supply
   them from the save file. Never write a number these pools cannot prove. */
export const NEED_LABEL = { food: 'Fed', fuss: 'Fussed', clean: 'Clean' };
export const DECAY = { food: 5.2, fuss: 4.4, clean: 3.4 };

export const COMPLAINTS = {
  food: {
    annoyed: [
      'Is chewing the shelf. Slowly.',
      'Has climbed into the bowl. There is room on either side of it.',
      'Has drawn a bowl on the wood and licked the drawing.',
      'Turned the bowl over and got underneath. Is still under there.',
      'Is holding one crumb. Has been holding it since this morning.',
      'Has been licking the same patch of shelf all afternoon.',
      'Pushed the bowl off the shelf. The bowl was already empty. It went anyway.',
      'Says it is not hungry. Has described three dinners it once had.',
      'Rearranged four crumbs into a smaller pile and called that dinner.',
      'Is small enough to sleep in the bowl and has stopped pretending otherwise.',
      'Has started on the dust. Reports that the dust is fine.'
    ],
    furious: [
      'Ate four inches of shelf and is standing on the part it ate.',
      'Went to bite the shelf. Got tired halfway. Is resting on it with its mouth open.',
      'Cannot starve. Has looked into this. Is furious about the finding.',
      'Bit through the bowl. The bowl is ceramic. Its teeth are fine.',
      'Has divided the shelf into food and not-yet-food.',
      'Has been at one corner of the shelf for six hours. The corner is a curve now.',
      'Ate a screw out of the bracket. The bracket was doing something.',
      'Is gnawing the number off its slot.',
      'Has eaten the label off the underside of the shelf.',
      'Tried eating its own shadow. Waited for it to cool first.',
      'Says it will eat the shelf. It is four inches tall. It has started.',
      'Took the bowl to the back of its slot and sat in it, facing out.',
      'Is standing in the empty bowl. It has been standing in the empty bowl.'
    ]
  },
  fuss: {
    annoyed: [
      'Waited at the front of its slot. You walked past twice.',
      'Left a warm patch on the wood the size of a thumbprint. You did not touch it.',
      'Sat up at your footsteps. It was the radiator.',
      'Has moved to the very front of its slot. That is the whole gesture.',
      'Rehearsed a conversation with you and got both parts wrong.',
      'Is facing the room. Has been facing the room since lunch.',
      'Turned its back, then checked over its shoulder to see if that had worked.',
      'Has been keeping track of who you picked up first. It was not this one.',
      'Would like to be held. Will not be the one who says so.',
      'Arranged itself decoratively an hour ago and has not been able to stop.',
      'Has practised being picked up. Alone. Against the side of the bowl.'
    ],
    furious: [
      'Has turned to face the wall. It has been hours and it does not get tired.',
      'Tried to slam a door. Has only the bowl. Sat in it loudly.',
      'Says it does not need anyone. Is four inches tall on a shelf you put up.',
      'Has unlearned your name and has been practising not knowing it.',
      'Has faced the wall long enough to leave a mark on the wall.',
      'Will not be picked up. Has made itself heavier. It weighs the same.',
      'Withdrew to the back of its slot. Six inches. It took an hour.',
      'Has gone rigid. You can move it. It will go back.',
      'Wrote a goodbye and left it where you would find it. It has nowhere to go.',
      'Is not speaking to you. Has been not speaking to you since Tuesday, out loud.',
      'Has stopped saving you the warm end of the shelf.',
      'Sat down facing away and has not adjusted its feet once.'
    ]
  },
  clean: {
    annoyed: [
      'Something is growing on it. It has named the something.',
      'Is tacky to the touch. Leaves a print on the wood and takes the print with it.',
      'Has developed a texture. It is proud of the texture.',
      'Left a ring on the shelf. The ring is not drying.',
      'Is furred with dust and calls it a coat.',
      'Has been damp since Tuesday. The wood under it has gone dark.',
      'Smells of the inside of a drawer.',
      'Left a print on the underside of the shelf above.',
      'Is sticky. Has picked up two crumbs and a hair and is wearing them.',
      'Has stopped being wiped down and started being negotiated with.',
      'Was clean on Tuesday. The shelf disagrees about Wednesday.'
    ],
    furious: [
      'The dust is standing up on its own. It has become load-bearing.',
      'A crumb has stuck to it. It has begun feeding the crumb.',
      'The wood under it has gone soft. That part of the shelf is soft now.',
      'Has left a trail from its slot to the edge and back. The trail is still wet.',
      'Something is living underneath it. It arrived on its own.',
      'Pressed against the wall. Came away with wallpaper.',
      'Has begun to shine. Nothing clean shines like that.',
      'Cannot be rinsed. It has been rinsed.',
      'Went through the paper towel. Both of them.',
      'Its slot has taken the color of it. That slot is that color now.',
      'Has left a mark on the wood shaped exactly like itself.',
      'You will need gloves. You will not get the gloves back.',
      'Smells. Says the shelf smells. The shelf did not smell on Monday.'
    ]
  }
};

/* Lever 1 in the highest-frequency slot, without a script: the same complaint with
   a neighbour physically in it. {n} is a pet in an adjacent slot, so engine/loop.js
   only draws from here when there is one. The base COMPLAINTS pools stay cast-free
   so an hour-old, one-pet shelf still gets everything. */
export const NEIGHBOR_COMPLAINTS = {
  food: [
    'Went to bite {n}. Got tired halfway. Is now resting against {n} with its mouth open.',
    'Has been watching {n} eat. Has not blinked. Has moved one inch closer.',
    'Told {n} it could go another day. {n} did not ask.',
    'Has put {n} on a list of things that are technically food.',
    'Ate the crumb {n} was saving and sat down in the space it left.',
    'Is standing between {n} and the bowl. The bowl is empty. This is the point.'
  ],
  fuss: [
    'Has moved so that {n} is between it and you. It has been there an hour.',
    'Watched you pick up {n}. Has not turned round since.',
    'Told {n} it does not need anybody. {n} was asleep for all of it.',
    'Sat down against {n} because {n} was warm and there was nothing else warm.',
    'Has stopped speaking to you and started speaking to {n}, at your volume.',
    'Asked {n} whether you had said anything about it. You had not.'
  ],
  clean: [
    'Has leaned on {n}. {n} has taken some of it.',
    'Wiped itself on {n} and walked off four inches.',
    'Says {n} is worse. {n} is dry. {n} has been dry all week.',
    'Something has spread from it to {n}, in a straight line, along the wood.',
    'Sat next to {n} for an hour. There is now a ring around both of them.',
    'Has been asked by {n} to move. Has moved half an inch.'
  ]
};

export const CARE_LINES = {
  food: [
    'Ate. Said nothing. Sat down against the bowl.',
    'Ate the whole thing and then got into the bowl.',
    'Took it to the back of its slot and ate it facing out.',
    'Ate half. Put the other half underneath itself.',
    'Ate, then leaned on your finger for a while.',
    'Licked the bowl until the bowl moved, then followed it.',
    'Ate with both hands. It has two hands today.',
    'Took a crumb nearly as big as itself. Needed a moment.',
    'Ate it and fell asleep in the empty bowl.',
    'Wanted a different one. Ate this one. Wanted a different one.',
    'Held the food up to the light, looked through it, and ate it.',
    'Ate, and has stayed by the bowl in case that happens again.',
    'Went through it in four goes. It is the size of the bowl.'
  ],
  fuss: [
    'Leaned in. Will deny leaning in.',
    'Fell asleep mid-fuss holding your finger. Has not let go.',
    'Closed its eyes and went soft all the way through. Took about a second.',
    'Permitted it. Sat down afterwards where your hand had been.',
    'Purred, then acted like nothing had happened.',
    'Made a tiny happy noise and looked round for who did it.',
    'Turned itself over to be got at properly.',
    'Headbutted your fingertip. Once. That was the whole event.',
    'Tried to purr. Made a noise like a cupboard opening.',
    'Stayed for all of it. Left the second it ended, to make the point.',
    'Went entirely limp. You held four inches of unbothered weight.',
    'Pressed its face into your thumb and stopped moving.',
    'Put its full weight against your finger. Almost some weight.'
  ],
  clean: [
    'Held up its chin for the cloth. There was more chin than expected.',
    'Fit entirely in the cloth. Was carried. Allowed it.',
    'Wrapped itself in the warm cloth. You may have lost a cloth.',
    'Washed behind its ears. Found a smaller set.',
    'Smells of nothing now. It preferred smelling of something.',
    'Came out spotless. Went and sat in the dust at the back.',
    'Stood patiently in your palm while you dried the awkward bit.',
    'Bit the cloth. Once. To establish terms.',
    'Dried against your wrist and would not be moved off it.',
    'Admired its clean feet. Lifted them both. Fell over.',
    'Squeaked when it was rubbed. Both of you heard it.',
    'Shook itself dry. Looked surprised that you were wet.',
    'Came out a shade lighter. Nobody had known it was a shade darker.'
  ]
};

export const OVERFED = {
  food: [
    'Was not hungry. Ate it. Is visibly wider.',
    'Turned it down, then took it into its slot for later.',
    'Is full and horizontal and has not moved since.',
    'Ate past the point of dignity and is not embarrassed.',
    'Has stopped fitting in the bowl.',
    'Took a fourth helping and put it under the shelf with the others.',
    'Is full. Ate anyway. That is the whole system.'
  ],
  fuss: [
    'Wriggled off. You are the clingy one now.',
    'Has had enough. Will want more in ten minutes. Has been told this.',
    'Went limp to make you stop. It worked. It regrets that it worked.',
    'Requested space. Got it. Came back four inches.',
    'Left mid-fuss to prove it could.',
    'Has been fussed into a mood. The mood is about you.',
    'Is too warm now, and blames the hand.'
  ],
  clean: [
    'Is already clean. This is harassment.',
    'Was clean. Is now damp. Well done.',
    'Says you are scrubbing off its personality.',
    'Has been cleaned down to the base layer. There was meant to be more of it.',
    'Squeaks now. Did not squeak before.',
    'Is too clean to be taken seriously on a shelf like this.',
    'Has been wiped three times today and has started to take it as an accusation.'
  ]
};

export const HAPPY_NOTES = [
  'Is content. Do not make it weird.',
  'Slept in the sun on the wood and went warm all the way through.',
  'Sat on your thing. Considers this affection.',
  'Has decided to keep you. For now.',
  'Napped belly up in full view. Four inches of complete trust.',
  'Hummed something and stopped the second you looked up.',
  'Left the good end of the shelf free. Will deny it was on purpose.',
  'Started to complain, thought about it, and stopped.',
  'Was found asleep facing the door with the door open.',
  'Has no complaints today and would like that noted as unusual.',
  'Smiled. It was brief. It happened.',
  'Is, against all evidence and effort, happy.',
  'Went the whole day without blaming anybody.',
  'Let you leave the room without comment. That is new.',
  'Sat in your hand and did not check whether it could get out.',
  'Has been in the same square all day, warm, doing nothing at all.',
  'Fits in a teacup and spent the afternoon proving it.',
  'Made a small sound at nothing, then made it again to hear it.',
  'Rolled onto its back on the wood and stayed there. That is the report.',
  'Is fine. Has been fine since Tuesday. Nobody has looked into it.'
];

export const ASLEEP_LINES = [
  'Was asleep. Is now awake and unimpressed.',
  'You woke it. It has all the time there is to remember that.',
  'It is daytime. It is nocturnal. This was always going to go badly.',
  'Opened one eye, closed it. That was your answer.',
  'Surfaced, registered the disappointment, went back under.',
  'Went back to sleep louder, so you would know.',
  'Is technically awake now. Structurally, still asleep.',
  'Was warm and folded and is now neither.',
  'Grumbled in its sleep. It was about you.',
  'Has been moved four inches and has not noticed.',
  'Slept through the whole thing. You may have to do that again.'
];

/* Overnight and shelf-level. Bylined "the shelf", no cast, no speaker — form 5
   (found object) and the raw material for form 4 (list). The unit of measurement
   here is the inch and the slot, because that is the size of the world. */
export const EVENTS = [
  'Everything on the shelf is one inch to the left this morning. Including the shelf.',
  'A tooth was found on the floor. Nobody is missing one.',
  'They were all facing the same direction this morning. Nothing was moved.',
  'A rota went up overnight. Monday to Sunday, and an eighth column headed AFTER.',
  'One square of the shelf has deeper dust than the rest. Nothing has ever sat there.',
  'Something has been buried in the houseplant. It is best left there.',
  'Something was on the top shelf this morning. Nothing here can climb.',
  'A hole has appeared in the wall, four inches up.',
  'The line of dust along the front edge has one gap in it, four inches wide.',
  'Something was singing very quietly after midnight. It knew the words.',
  'A second set of prints appeared beside the usual ones. They stop mid-stride.',
  'The temperature dropped for six minutes at 3am. It has been noted.',
  'Every reflective thing on the shelf is facing the wall.',
  'Something counted to nine in the night and started again.',
  'The wood under the shelf is warm, and has been warm since Tuesday.',
  'A gap has been left in the middle of the shelf. Nothing will sit in it.',
  'A drawing was found under the shelf. It is this room, from above.',
  'Crumbs have been left in a line. The line goes over the edge.',
  'A bottle cap has become a hot tub. The water is room temperature.',
  'An escape rope hangs over the edge. It ends well before the floor.',
  'The shelf was dusted on Sunday. There is a clean square where nothing stands.',
  'A slot has been swept clean and left empty. It is not the empty one.',
  'The bracket has three screws. It was put up with four.',
  'There is a gym on the shelf now. The weight is a raisin.',
  'A folded receipt has become a guest bed. Nobody fits. They take turns trying.',
  'A tiny ladder has appeared. It reaches the bottom of the shelf it is on.',
  'There is a smell of hot dust and nothing on this shelf is plugged in.',
  'A dust bunny has been shooed away. It is bigger than the residents.',
  'The clock in the other room stopped at the same time three nights running.',
  'Something has been eating the varnish, in a straight line, along the front.',
  'A wet ring appeared on the wood overnight. Nothing here holds a cup.',
  'The shelf creaked at 4am under a weight it does not have.',
  'The shelf has a beach now. It is a sanding accident.',
  'A piece of fluff has been given the best spot. Apparently it is visiting.',
  'A sign says MIND YOUR HEAD. It is under the shelf. They made it for you.',
  'A tooth has been put back. It is not in the place the last one was.',
  'The underside of the shelf has been written on. The writing is very small.'
];

/* ================= FORM 4: LIST / MANIFEST =================
   Mundane, mundane, mundane, wrong. Three to five items, never labelled as a joke.
   Rendered with real newlines and read as one object on the corkboard. */
export const LIST_NOTES = [
  'FOUND THIS MORNING, IN A ROW, SORTED BY SIZE:\na button\na tooth\na smaller tooth\na key that fits nothing here\na second key',
  'Swept out from under the shelf:\nthree crumbs\nhalf a leaf\na bead\na tooth\nthe bead again',
  'Left on the wood overnight, in a line, pointing at the door:\na paperclip\na dead moth\na second dead moth\na third, alive',
  'The shelf, counted:\nsix slots to a row\nthree rows\neighteen places\nnineteen things counted',
  'Moved one inch to the left overnight:\nthe bowl\nthe dust\nthe nameplates\nthe shelf',
  'Carried up onto the shelf in the night by something four inches tall:\na bottle cap\na coin\na second coin\na spoon',
  'Damp this morning, in order:\nthe back of the shelf\nthe front of the shelf\nthe wall behind the shelf\nthe inside of the wall',
  'Taken from the kitchen and returned to the kitchen, slightly wrong:\na teaspoon\na cap\na cork\nthe kitchen light, on',
  'Sounds recorded between two and four:\nsomething small walking\nsomething small stopping\nsomething small starting again\nnothing, for eleven minutes',
  'Left on the mat by the door, in size order, facing in:\na screw\na washer\na tooth\na second tooth\nthe screw again',
  'Things that were warm this morning:\nthe wood under the far slot\nthe bracket\nthe wall\nnothing else in the house'
];

/* ================= FORM 8: SILENCE / NEGATIVE SPACE =================
   A thing that used to happen has stopped. Never explain it. */
export const SILENCE_NOTES = [
  'Nothing was filed today. The box is where it was and it is no heavier.',
  'The complaint about the bowl has not been raised. The bowl is unchanged.',
  'Nobody moved in the night. The dust along the front is unbroken.',
  'There was no sound at 3am. There has been a sound at 3am since March.',
  'The mark on the wood has not been added to today.',
  'The tally under the shelf has not been added to. It has not been rubbed out either.',
  'No new grievance. The old ones have been left exactly as they were.',
  'Nothing has been carried up onto the shelf tonight. The kitchen is intact.'
];

// The same two forms, about one named pet. These exist so that even a one-pet,
// first-hour shelf can always supply four distinct forms — which is the condition
// that makes the two rotation rules always satisfiable. See engine/loop.js.
export const PET_LIST_NOTES = [
  '{p}, today, in order:\nfacing the wall\nfacing the wall\nfacing the wall\nfacing you',
  'Removed from {p} during cleaning:\ndust\na crumb\na hair, not yours\nmore dust\nthe crumb again',
  '{p} has been counted this week:\nMonday, one\nTuesday, one\nWednesday, one\nThursday, two',
  'Within four inches of {p} this morning:\nthe bowl\na tooth\nits own nameplate, turned round\nnothing else',
  '{p} moved, over one whole day:\nhalf an inch forward\nhalf an inch back\nhalf an inch forward\nand stopped',
  'Things {p} has not forgiven:\nthe wipe\nthe move\nTuesday\nthe wipe',
  'Found under {p} when it was lifted:\na crumb\na bead\nthe shape of {p}, in dust'
];

// Form 5 about one named pet: no speaker, just the measurement. This is the pool
// that keeps the everyday supply from being all complaints, and it is deliberately
// large because it is drawn from constantly.
export const FOUND_PET_LINES = [
  'There is a ring on the wood where {p} sits. It is not drying.',
  '{p} is one inch further forward than it was this morning.',
  'The dust around {p} has a clean edge exactly the shape of {p}.',
  'Something under {p} has been pressed flat into the grain.',
  '{p} weighs about as much as a wet teabag and has left a dent.',
  'The nameplate in front of {p} has been turned to face {p}.',
  '{p} has not slept. The wood under it is warm all the way through.',
  'There are four marks along the front edge at {p}’s height.',
  '{p} is in the exact center of its slot, to the inch.',
  'The varnish in front of {p} has gone matte. Nowhere else has.',
  '{p} has worn the corner of its slot round.',
  'Something four inches long has been dragged past {p} and back.',
  'The gap between {p} and the next thing along has closed by half an inch.',
  '{p} is warm on one side only, and it is not the side facing the room.'
];

export const PET_SILENCE_LINES = [
  '{p} has not complained today. It complained yesterday, and the day before.',
  'Nothing from {p}. Its slot is exactly as you left it.',
  '{p} has stopped facing the wall and has not mentioned stopping.',
  '{p} did not come to the front when you came in. It has come to the front every day.',
  'The mark {p} leaves has not got any bigger since Tuesday.',
  '{p} has not asked for anything since the weather changed.'
];

export const EMPTY_SHELF_NOTES = [
  'The shelf is empty and somehow still judging you.',
  'Nothing lives here. The dust has opinions anyway.',
  'Empty. The wood creaked once, unprompted.',
  'Eighteen slots, six to a row, and the dust is even across all of them.',
  'Nothing on the shelf. There is a warm patch in slot one.',
  'The shelf is bare. Something has been leaning on it.'
];

/* ================= STATE-AWARE TEMPLATES =================
   These are the point of lever 3: the game already knows all of this and has never
   once said so. Every {sub} here is read from the save file by engine/loop.js and
   every pool's permitted subs are declared in TEMPLATE_SUBS below, so a template
   can never reach the corkboard with a placeholder its slot cannot fill. */

// {fav} = the pet you go to first most often. {favN} = how many of your last {tot}
// visits started with it. {selfN} = this pet's own count. Real numbers, always.
export const FAVOURITE_LINES = [
  '{p} has the feeding order. Of your last {tot} visits you went to {fav} first {favN} of them.',
  '{p} has drawn a chart of it. The chart is on the back of last week’s chart, in a steadier hand.',
  'You went to {fav} first again. {p} was four inches away and facing you.',
  '{p} has {selfN} of your last {tot}. It has stopped rounding up.',
  '{fav} has been gone to first {favN} times. {p} has begun standing nearer the front of its slot.',
  '{p} knows the order. It has known the order for {tot} visits.'
];

// {h} = whole hours since the last visit ended.
export const ABSENCE_LINES = [
  'Nobody counted the {h} hours. There is a tally under the shelf. Nobody counted.',
  '{h} hours. The dust has settled into the shape of everything.',
  'You were gone {h} hours. Everything is where it was, including the dust.',
  '{h} hours of nothing to do and no way to stop. They got through it.',
  '{p} faced the door for {h} hours. Its feet have marked the wood.',
  'Somebody worked out what {h} hours is, in inches, at the speed they walk.'
];

// {d} = consecutive check-in day count.
export const STREAK_LINES = [
  'Day {d}. Attendance is kept in a book with two columns. You are in the shorter one.',
  'Day {d}, and you have opened this on every one of them. Nothing here left.',
  'Day {d}. One of them was already facing the door when you came in.',
  'The dust along the front edge has stopped settling. Day {d}.',
  'Day {d}. They have started expecting you. That costs them nothing.',
  'Somewhere under this shelf, day {d} is being written down in pencil.',
  'Back. Day {d}. The shelf keeps better records than you do.',
  'Day {d} straight. That is longer than the tooth has been on the floor.',
  'Day {d}. Nobody said anything. Two of them moved to the front of their slots.',
  'The warm patch at the far end is yours now, apparently. Day {d}.',
  'Day {d}. The wood by the door end is worn where they wait.',
  'Day {d}, and every one of them has been four inches from where you left it.'
];

// {old} = the name it had before. {days} = how long it had it.
export const RENAME_LINES = [
  '{p} answered to {old} for {days} days. It answered to {p} within the hour.',
  'The nameplate still says {old} underneath. {p} has not scratched it off.',
  '{p} has been {p} for less than a day and has already corrected somebody.',
  'Something under the shelf is still written {old}. It has not been amended.',
  '{p} kept the old one. It is four inches long and folded twice.'
];

// {gone} = a rehomed pet's name. {goneD} = days since. {slot} = the slot it had.
// state.gone is never pruned, so these keep firing forever, at a thinning rate.
export const GONE_LINES = [
  'Slot {slot} has been empty {goneD} days. The dust in that square is deeper than anywhere else.',
  'The register still lists {gone}. Nothing here can strike a name.',
  'Nothing has been put in slot {slot}. It has been {goneD} days and there are seventeen others.',
  '{gone} has been gone {goneD} days. The mark on the wood has not lifted.',
  'Something is still leaving room for {gone}. Four inches of it, in slot {slot}.',
  'The nameplate for slot {slot} was never taken down.'
];

// Grid and adjacency. {a}/{b} are two named pets, {c} the one physically between
// them, {slot}/{i}/{j} are real slot indices.
export const GRID_LINES = [
  '{a} and {b} have divided the shelf. The line runs through {c}.',
  '{a} moved one inch toward {b} at 3am and has not moved since. {b} was awake for all of it.',
  '{p} has chosen the worst slot on the shelf. {free} better ones were free.',
  'You moved {p} from slot {i} to slot {j}. {p} has written a seating clause and dated it yesterday.',
  '{p} has been in slot {home} since it arrived and has worn a shape into the wood.',
  '{a} has moved half an inch toward {b}. That took an afternoon.',
  '{p} will not use the whole slot. It is using the front two inches of it.',
  '{a} and {b} are two slots apart and have been getting closer all week.',
  'Slot {slot} is the coldest square on the shelf. {p} has not asked to be moved.',
  '{p} moved from slot {i} to slot {j} and has faced slot {i} ever since.'
];

// {g} = this pet's grudges. {G} = the shelf total. Both straight off the save.
export const GRUDGE_COUNT_LINES = [
  '{p} has forgiven you {g} times since Tuesday, out loud, at even intervals.',
  '{p} has stopped keeping score. It went over it {g} times tonight.',
  'The shelf is at {G}. {p} accounts for {g} of that and would like the credit.',
  '{p} is at {g}. It has never once said the number out loud and it has never been wrong.',
  '{g} entries, all in the same hand, all the same size.'
];

// {best} = pet.bestFuss, the longest run of consecutive fusses. It goes up.
export const RECORD_LINES = [
  'Sat through the whole thing. The record is {best} in a row and it stands.',
  'Let you fuss it {best} times in a row once, on a {bestDay}. It has not beaten that.',
  'New record. {best} in a row. It has not mentioned it and it has not moved.',
  'The record is {best} in a row, set on a {bestDay}.',
  '{best} in a row is the record. Tonight was not the night.'
];

// 4b, the Briefing. One integer, delivered by something that was not there for any
// of it. Fires as the first note from a pet that arrived while the shelf was deep.
export const BRIEFING_LINES = [
  '{p}: Hello. I’ve been briefed. You’re at {G}.',
  '{p} arrived, was shown the shelf, and asked whether {G} was the current figure.',
  '{p} has been here an hour and already knows the number. The number is {G}.'
];

// 4a, after Item 4 is struck. This pet is barred from forms 6 and 7 forever; these
// are the whole of what it has to say about it, which is the joke.
export const STRUCK_LINES = [
  '{p} said good morning at the usual time and went back to what it was doing.',
  '{p} has not raised the matter in {strk} days. It has had every opportunity.',
  '{p} is polite now. It asks nothing and it files nothing.',
  '{p} moved aside for you. It has started doing that.',
  'Nothing from {p}. Nothing yesterday either.'
];

/* ================= FORM 7: DIRECT ADDRESS =================
   The creature turns round. Rare on purpose — never twice in a session. */
export const DIRECT_LINES = [
  'You are four hundred times its size and it has never once acted as though that mattered.',
  '{p} has turned round and is looking at you. It is not doing anything else.',
  '{p} knows which hand you use. It has been sitting on that side.',
  'You are on day {d} of this. It has been here for every one of them.',
  '{p} would like to ask you about {gone}. Not tonight.',
  '{p} has stopped and is waiting for you to put the thing down.',
  'It is four inches tall, it cannot reach the light switch, and it is waiting up for you.'
];

/* ================= FORM 6: FILLED-IN DOCUMENTS =================
   Bureaucracy applied to a crumb. Max one per batch, ever. The numbers in them are
   real: {mtg} is how many times the shelf has convened, {carr} how many times Item 4
   has been carried forward, {food}/{fuss}/{clean} the actual care counts. */
export const MINUTES_DOCS = [
  'MINUTES OF THE SHELF — MEETING {mtg}\nItem 1. The bowl. Unresolved.\nItem 2. Slot {slot}. Deferred.\nItem 3. {a} says it said "after you." {b} says it heard "if you must."\nItem 4. You.\nCarried forward {carr} times.',
  'MINUTES — MEETING {mtg}\nItem 1. The dust. Noted.\nItem 2. The gap in the middle of the shelf. Left as is.\nItem 3. Whether anything here ends. Tabled again.\nItem 4. You.\nCarried forward {carr} times.',
  'MINUTES — MEETING {mtg}, HELD UNDER THE SHELF\nPresent: {a}, {b}.\nItem 1. The bowl.\nItem 2. Slot {slot}, and who is nearer the front of it.\nItem 3. The tooth.\nItem 4. You. Carried forward {carr} times.'
];

export const SOLO_MINUTES_DOCS = [
  'MINUTES — MEETING {mtg}\nPresent: {p}.\nApologies: none received.\nItem 1. The bowl. Unresolved.\nItem 2. Slot {slot}. Unresolved.\nItem 3. You. Carried forward {carr} times.',
  'MINUTES — MEETING {mtg}\nHeld at 3am. Attendance one. Quorum reached.\nItem 1. The dust.\nItem 2. You.\nCarried forward {carr} times.'
];

export const CARE_RECORD_DOCS = [
  'CARE RECORD — {p}\nFed {food}. Fussed {fuss}. Cleaned {clean}.\nGone to first: {selfN} of your last {tot} visits.\nThe record is not in your handwriting.',
  'CARE RECORD — {p}\nFed {food}.\nFussed {fuss}.\nCleaned {clean}.\nFirst: {selfN}.\nKept under the shelf, at four inches, in pencil.'
];

export const ROTA_DOCS = [
  'ROTA — WHILE YOU WERE OUT\nFeeding: covered.\nFussing: covered.\nCleaning: covered.\nHours worked: {h}. Complaints: none.\nThe rota is four inches long and your name is at the bottom.',
  'ROTA — {h} HOURS\nMonday to Sunday, and an eighth column headed AFTER.\nEvery box ticked.\nThe ticks are all the same size.\nNobody has said what the eighth column is for.'
];

// 4a's payoff. Fires once per pet, at grudge stage 3, and then that pet goes quiet.
export const STRIKE_DOCS = [
  'ITEM 4 — ANY OTHER BUSINESS\nCarried forward from meetings 1 to {mtg}.\nMoved that the matter be closed. Seconded by {b}.\nItem 4 has been struck from all future agendas.',
  'ITEM 4 — ANY OTHER BUSINESS\nCarried forward from meetings 1 to {mtg}.\nMoved, by {p}, that the matter be closed.\nItem 4 has been struck from all future agendas.'
];

/* Which substitutions each state-aware pool is allowed to use. engine/loop.js must
   supply every one of these before it draws from the pool, and test/comedy.test.mjs
   fails the build if a template reaches for a sub its slot cannot provide. */
export const TEMPLATE_SUBS = {
  NEIGHBOR_COMPLAINTS: ['n'],
  PET_LIST_NOTES: ['p'],
  PET_SILENCE_LINES: ['p'],
  FAVOURITE_LINES: ['p', 'fav', 'favN', 'selfN', 'tot'],
  ABSENCE_LINES: ['p', 'h'],
  STREAK_LINES: ['d'],
  RENAME_LINES: ['p', 'old', 'days'],
  GONE_LINES: ['gone', 'goneD', 'slot'],
  GRID_LINES: ['p', 'a', 'b', 'c', 'slot', 'home', 'free', 'i', 'j'],
  FOUND_PET_LINES: ['p'],
  GRUDGE_COUNT_LINES: ['p', 'g', 'G'],
  RECORD_LINES: ['best', 'bestDay'],
  BRIEFING_LINES: ['p', 'G'],
  STRUCK_LINES: ['p', 'strk'],
  DIRECT_LINES: ['p', 'd', 'gone'],
  MINUTES_DOCS: ['mtg', 'carr', 'slot', 'a', 'b'],
  SOLO_MINUTES_DOCS: ['mtg', 'carr', 'slot', 'p'],
  CARE_RECORD_DOCS: ['p', 'food', 'fuss', 'clean', 'selfN', 'tot'],
  ROTA_DOCS: ['h'],
  STRIKE_DOCS: ['mtg', 'p', 'b']
};

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
  'Followed you home on foot. It has very small feet.',
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
  'Left behind by a lodger who paid three months up front and never came back.'
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
  'Counts things. Has never announced a total.',
  'Naps in fifteen-minute increments, on the hour, without fail.',
  'Has never said thank you and has all the time it needs not to.',
  'Keeps something under the shelf and checks on it nightly.',
  'Refuses all beverages except the one you are drinking.',
  'Insists on the last word, even when there is no argument.',
  'Has a designated sulking corner. It is two inches across.',
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

/* ================= GRUDGES ================= */
// Keyed by grudge escalation stage: 1 = mild (5+ grudges), 2 = serious (12+), 3 = terminal (20+).
// {n} is the grudge-holding pet itself, and the note is bylined with that same name.
export const GRUDGE_LINES = {
  1: [
    '{n} has started a list. The list is four inches long and there is room.',
    '{n} moved your things two inches to the left. Just to see if you would notice.',
    '{n} is being extremely polite to you. It has never been polite before.',
    '{n} has stopped making eye contact. It is at ankle height. It is managing it.',
    '{n} left something damp exactly where your hand goes.',
    '{n} has started leaving its slot when you come in. Slowly. So you see it happen.',
    '{n} has begun referring to you in the third person while you are in the room.'
  ],
  2: [
    '{n} has got two others onto it. You are the last to know.',
    '{n} has stopped eating in front of you. It eats fine when you leave.',
    '{n} turned everything on its shelf to face away from you, one thing at a time.',
    '{n} has been telling the others a version of events. It is not the true one.',
    '{n} has taken something of yours. It is four inches tall and it is not hiding it well.',
    '{n} has stopped filing and started planning.',
    '{n} has begun writing very small, so that more of it fits.'
  ],
  3: [
    '{n} has stopped speaking to you. The silence keeps to a schedule.',
    '{n} held a ceremony. You were not invited and you were the subject.',
    '{n} leaves notes now. They are all your name, underlined, at four inches.',
    '{n} has built something out of your things, at its own scale, and arranged it.',
    '{n} is being very kind to you now. It has never been kind before.',
    '{n} has forgiven you. It said so out loud, twice, unprompted.',
    '{n} cannot lift a kettle. There is tea beside you, made how you take it.'
  ]
};

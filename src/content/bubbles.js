/* ================= THOUGHT BUBBLES =================
   The shortest form in the game. A bubble sits over a four-inch creature for
   three seconds on a shelf slot roughly 140px wide, so every line here is a
   clause, lowercase, with a full stop: something a small immortal thing might
   think while it believes nobody is watching.

   src/art/animator.js draws from these pools. Nothing in here is substituted,
   so no placeholders, and nothing is ever longer than about 40 characters.

   Shapes:
     MOOD_BUBBLES[mood]        idle thoughts by mood
     SLEEP_TALK                muttered by a sleeper (rare, dark bubble)
     PLOTTING_BUBBLES          a pet with an active scheme
     NOTICE_BUBBLES            the keeper just checked the shelf
     TRAVEL_BUBBLES            muttered on the walk to a new slot
     CARE_BUBBLES[need]        after being fed / fussed / cleaned / rounds
     DUET_BUBBLES[id].a / .b   the two halves of a neighbour interaction;
                               .b is the reply, and the reply is the joke
     PROP_POKE_BUBBLES[kind]   poking a piece of furniture (_default fallback) */

export const MOOD_BUBBLES = {
  content: [
    'warm side of the wood.', 'nobody has died today.', 'four inches of calm.',
    'the dust is mine now.', 'this is the good square.', 'hm. acceptable.',
    'i could go another day.', 'they remembered. noted.', 'i forgive the ceiling.',
    'sun on the plank. bliss.', 'the crumb is safe with me.', 'a nap, then revenge. no rush.',
    'i like this slot. it likes me.', 'the bracket held again.', 'happy. tell nobody.',
    'everything is where i left it.', 'smug, technically.', 'i have a raisin and a plan.',
    'the edge can wait.', 'holding the grudge loosely.', 'my seam is holding.',
    'warm all the way through.', 'they looked at me first.', 'the ceiling is still up. good.',
    'i licked the wood. it was fine.', 'nothing hurts. suspicious.', 'a good day for a crumb.'
  ],
  fine: [
    'hm.', '…', 'mm.', 'is it tuesday.', 'i have been counting dust.',
    'something moved. not me.', 'four inches. still.', 'no complaints. yet.',
    'the wall is still there.', 'i had a thought. it left.', 'where did i put the crumb.',
    'bored, but alive. probably.', 'the fern is looking at me.', 'i could lick that.',
    'the bowl is far away.', 'waiting. i am good at it.', 'i miss the eraser.',
    'all quiet. suspicious.', 'a moth went by. i said nothing.', 'slot life.',
    'the varnish tastes of march.', 'i know what the dust knows.', 'one day i will be dusted.'
  ],
  annoyed: [
    'tsk.', 'no.', 'i saw that.', 'noted. underlined.', 'the bowl is a rumour.',
    'adding this to the list.', 'do not touch the crumb.', 'somebody breathed on me.',
    'the dust gets more attention.', 'i asked once. that was the once.',
    'my side. your side. learn it.', 'the light is wrong again.', 'i was here first. in 1987.',
    'you call this a shelf.', 'fine. FINE.', 'i heard that from here.',
    'i will remember this at 3am.', 'the raisin was mine.', 'a grudge, but a small one.',
    'they walked past. twice.', 'nobody asked the shelf.', 'counting to ten. i am at four.',
    'the lamp knows what it did.', 'i have a folder now.'
  ],
  furious: [
    'no.', '!', 'i will eat the bracket.', 'the list has your name.',
    'starving. cannot die. rude.', 'i bit the wood. the wood won.', 'this is item four.',
    'i have looked into the edge.', 'do not look at me.', 'the bowl is empty. AGAIN.',
    'i am writing to someone.', 'the previous owner would never.', 'i will haunt the biscuit tin.',
    'my grievance has a folder.', 'somebody will answer for this.', 'i can wait. i am immortal.',
    'the dust is winning.', 'move. or i move you.', 'my teeth are fine. test me.',
    'the shelf is a crime scene.', 'when i am bigger. oh, when.', 'you again.',
    'i have eaten worse than you.', 'the bracket has four screws. had.'
  ]
};

export const SLEEP_TALK = [
  'no, the other jar.', 'not the eraser.', 'i can see the edge.', 'put it back. put it back.',
  'the previous owner says hi.', 'it fits. it fits.', 'zzz. the bowl. zzz.', 'nobody counted.',
  'four inches. forever.', 'do not open the box.', 'the raisin knows.', 'i was taller once.',
  'under the shelf. under.', 'dig. dig. good.', 'uncle, no.', 'the crumb had a family.'
];

export const PLOTTING_BUBBLES = [
  'act natural.', 'you saw nothing.', 'entirely legal.', 'a minor undertaking.',
  'where is the crumb.', 'phase one: crumb.', 'the lamp suspects nothing.', 'nobody checks the fern.',
  'tonight, the bowl.', 'i need a smaller shovel.', 'the alibi is the dust.', 'step one: look innocent.',
  'the tissue is the parachute.', 'the plan has a plan.', 'do not tell uncle.', 'we strike at dusting time.',
  'i have drawn a map. of here.', 'the bracket is the weak point.', 'not a heist. legally.',
  'the moth is in on it.', 'i will need a witness. not you.', 'first the raisin. then the world.'
];

export const NOTICE_BUBBLES = [
  'oh. you.', 'look who remembered.', 'you again.', 'we were just discussing you.',
  'act like nothing happened.', 'the tally stops. for now.', 'hello. i have notes.',
  'you took your time.', 'we counted the hours.', 'the bowl has questions.', 'i felt that look.',
  'be honest. how long.', 'ah. the management.', 'do not look at the fern.', 'i was not asleep.',
  'we forgive you. mostly.', 'quick. hide the crumb.', 'you smell like outside.', 'we practised a face.'
];

export const TRAVEL_BUBBLES = [
  'excuse me.', 'coming through.', 'do not watch me walk.', 'better slot. brb.',
  'i live here now.', 'the lamp called.', 'moving on principle.', 'nobody saw that.',
  'left foot. other left.', 'i was never here.', 'closer to the bowl.', 'away from that one.',
  'new square, new me.', 'nearly there. nearly.', 'this is the long way.', 'mind the dust.'
];

export const CARE_BUBBLES = {
  food: ['finally.', 'mine. all mine.', 'chew. chew. yes.', 'acceptable.', 'more.', 'i knew you would fold.', 'crumb accepted.', 'noted. thank you.', 'the bowl was a rumour. was.'],
  fuss: ['hm. nice.', 'again.', 'there. no, there.', 'do not stop.', 'i permit this.', 'eleven seconds. a record.', 'ok. enough. no, more.', 'the seam likes it.'],
  fussbad: ['get off.', 'no.', 'i did not ask.', 'hands.', 'personal space.', 'later. maybe.', 'i am four inches of no.'],
  clean: ['sparkling.', 'i was fine.', 'cold water. cold.', 'the dust will return.', 'i smell of soap. betrayal.', 'that was my good grime.', 'shiny. vulnerable.'],
  rounds: ['ah. the rounds.', 'efficient. noted.', 'everyone got one. hm.', 'assembly line care.', 'i was third. i counted.', 'a rota is not love.']
};

export const DUET_BUBBLES = {
  whisper: {
    a: ['psst.', 'about the bowl.', 'not here. later.', 'they cannot hear us.', 'i have a plan.', 'meet me by the fern.', 'the lamp is listening.', 'it was me. the crumb.', 'do you have a shovel.', 'the keeper is a liar.'],
    b: ['no.', 'i heard nothing.', 'i am not involved.', 'again?', 'tell the fern.', 'you said that tuesday.', 'i am four inches from you.', 'leave me out of it.', 'your breath is damp.', 'write it down. not here.']
  },
  nudge: {
    a: ['budge up.', 'my side.', 'you are in my light.', 'move.', 'closer. no, back.', 'there is no room.', 'you are leaning.'],
    b: ['hey.', 'rude.', 'i felt that.', 'noted.', 'there was room.', 'do that again. go on.', 'i am telling the shelf.', 'that was my good side.']
  },
  glare: {
    a: ['…', 'i see you.', 'we both know.', 'stay there.', 'yours, was it.', 'do not.'],
    b: ['…', 'blink first.', 'i can do this all day.', 'i have no lids.', 'still here.', 'what.', 'i was here in march.']
  },
  poke: {
    a: ['wake up.', 'you were snoring.', 'are you dead.', 'still there?', 'boo.', 'psst. wake.', 'you were talking. about me.'],
    b: ['no.', 'i was resting my eyes.', 'i am awake. legally.', 'that was my good nap.', '!', 'never.', 'i will remember that.', 'i was somewhere nice.']
  },
  sniff: {
    a: ['you smell of outside.', 'is that the bowl.', 'you have been in the fern.', 'sniff. hm.', 'something died on you.', 'you are damp.'],
    b: ['personal space.', 'it is ambient moisture.', 'back off.', 'that is my smell.', 'i have not moved.', 'stop that.', 'you first.']
  },
  mirror: {
    a: ['again.', 'together.', 'on three.', 'ha.', 'higher.'],
    b: ['again.', 'i did it better.', 'three.', 'wheee. quietly.', 'my knees. i have no knees.']
  }
};

export const PROP_POKE_BUBBLES = {
  _default: ['hm.', 'is this mine now.', 'it moved. i swear.', 'what does it do.', 'i could lick that.', 'mine.'],
  bowl: ['empty. again.', 'crumb? no crumb.', 'i checked. still nothing.', 'the bowl lies.'],
  tub: ['cold.', 'no.', 'nobody is watching. good.', 'not today, tub.'],
  lamp: ['too bright.', 'warm. suspicious.', 'i moved it an inch.', 'the bulb is watching.'],
  yarn: ['prey.', 'it fought back.', 'one more pull.', 'the yarn started it.'],
  mat: ['WELCOM. ha.', 'wipe. wipe. done.', 'another letter gone.'],
  musicbox: ['play it again.', 'it knows the words.', 'not that song.'],
  candle: ['pretty. dangerous.', 'the flame leaned.', 'it is watching me back.', 'do not tell it my secrets.'],
  fern: ['nobody checks the fern.', 'something is buried here.', 'it moved. it did.', 'my things are in there.'],
  mirror: ['who is that.', 'it blinked first.', 'handsome. cracked.', 'not looking. not looking.'],
  clock: ['still march.', 'it is always this time.', 'tick. no tock.'],
  skull: ['hello, uncle.', 'uncle agrees.', 'uncle has heard worse.', 'goodnight, uncle.'],
  coffinbed: ['mine.', 'a nap. a long one.', 'it fits. it fits.', 'do not close the lid.'],
  phone: ['it rang. it never rings.', 'hello? hello.', 'for you. it is the wall.', 'the dial says nine.'],
  bell: ['tap.', 'something is under there.', 'let me in.', 'do not lift it.'],
  globe: ['shake it.', 'it is snowing in there.', 'the little man waved.', 'snow. again. snow.'],
  birdcage: ['the door is open.', 'the bird left. i stay.', 'the perch is mine.'],
  trophy: ['what happened to the rest.', 'nice antlers.', 'salute.'],
  board: ['ask it something.', 'it says GOODBYE.', 'the planchette moved.', 'spell it slower.'],
  urn: ['warm.', 'sorry. again.', 'whose is it.', 'family, probably.'],
  box: ['filed.', 'another one for the box.', 'the box is full. good.'],
  plant: ['it is crying again.', 'leaf. bite. done.', 'the fig understands.'],
  lantern: ['warm pane.', 'moths. moths everywhere.', 'a light for the edge.', 'do not let it go out.'],
  cauldron: ['what is in it.', 'green. hm. green.', 'i dropped a tooth in.', 'it bubbles when i lie.'],
  jar: ['are those mine.', 'one more for the jar.', 'the teeth are counting.', 'shake. rattle. hm.'],
  hourglass: ['flip it. flip it again.', 'the sand is going up.', 'time. rude.', 'it is always half.'],
  headstone: ['not mine yet.', 'nice stone.', 'who is under it.', 'spelled wrong. probably.'],
  effigy: ['it looks like you.', 'pins? no pins. yet.', 'it has your hair.'],
  guillotine: ['for a raisin.', 'i cannot die. try me.', 'sharp. hm.'],
  mousetrap: ['not today, trap.', 'the cheese is a lie.', 'snap. missed.'],
  teacup: ['it fits me.', 'cold tea. mine.', 'one lump.'],
  portrait: ['the eyes follow.', 'the previous owner.', 'do not touch the frame.'],
  radio: ['static. good song.', 'it whispers the news.', 'turn it down. no, up.']
};

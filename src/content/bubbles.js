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
    'i licked the wood. it was fine.', 'nothing hurts. suspicious.', 'a good day for a crumb.',
    'the plank is warm today.', 'slot nine. the good one.', 'nobody moved me. bliss.',
    'crumb secured.', 'the moon said hello.', 'i was picked up first.',
    'glazed and pleased.', 'dust settling. let it.', 'the light is on my side.',
    'no notes today. none.', 'the bracket and i are fine.', 'my square. my dust.',
    'nothing hurts. it never will.', 'a crumb and a hundred years.', 'warm. i will keep this one.',
    'the dust is up to my seam. cosy.', 'held for eleven seconds. logged.',
    'i was put back to the grain.', 'the lamp warmed my bad side.', 'forever, but the warm sort.'
  ],
  fine: [
    'hm.', '…', 'mm.', 'is it tuesday.', 'i have been counting dust.',
    'something moved. not me.', 'four inches. still.', 'no complaints. yet.',
    'the wall is still there.', 'i had a thought. it left.', 'where did i put the crumb.',
    'bored, but alive. probably.', 'the fern is looking at me.', 'i could lick that.',
    'the bowl is far away.', 'waiting. i am good at it.', 'i miss the eraser.',
    'all quiet. suspicious.', 'a moth went by. i said nothing.', 'slot life.',
    'the varnish tastes of march.', 'i know what the dust knows.', 'one day i will be dusted.',
    'the light is on. noted.', 'slot life, day whatever.', 'is the plank oak.',
    'a crumb went past.', 'counted the slots. eighteen.', 'the trolley is not a trolley.',
    'four inches. checked.', 'the moon is late.', 'the notes are about me. probably.',
    'nothing moved. i checked twice.', 'the edge is still there.', 'the dust and i have an understanding.',
    'another one. i have plenty.', 'the dust is taller by a hair.',
    'still four inches. still here.', 'the plank and i will see it out.', 'nothing today. same as forever.',
    'i thought about the edge. briefly.', 'the wall has not blinked either.', 'waiting is the whole job now.'
  ],
  annoyed: [
    'tsk.', 'no.', 'i saw that.', 'noted. underlined.', 'the bowl is a rumour.',
    'adding this to the list.', 'do not touch the crumb.', 'somebody breathed on me.',
    'the dust gets more attention.', 'i asked once. that was the once.',
    'my side. your side. learn it.', 'the light is wrong again.', 'i was here first. in 1987.',
    'you call this a shelf.', 'fine. FINE.', 'i heard that from here.',
    'i will remember this at 3am.', 'the raisin was mine.', 'a grudge, but a small one.',
    'they walked past. twice.', 'nobody asked the shelf.', 'counting to ten. i am at four.',
    'the lamp knows what it did.', 'i have a folder now.',
    'the crumb was in my square.', 'slot nine is mine. was.', 'the light is on them. not me.',
    'moved. again. one inch.', 'read the note. it was rude.', 'the trolley skipped me.',
    'i asked for the warm square.', 'do not touch my dust.', 'the plank creaked at me.',
    'i was counted last.', 'the moon saw that.', 'four inches of no thank you.',
    'i have all the time. remember it.',
    'i will still be cross in a century.', 'noted. dated. shelved. like me.',
    'four inches and nothing in reach.', 'the crumb moved. i did not move it.',
    'they wiped my good side. again.', 'nobody counted me this morning.',
    'i am filing this under forever.'
  ],
  furious: [
    'no.', '!', 'i will eat the bracket.', 'the list has your name.',
    'starving. cannot die. rude.', 'i bit the wood. the wood won.', 'this is item four.',
    'i have looked into the edge.', 'do not look at me.', 'the bowl is empty. AGAIN.',
    'i am writing to someone.', 'the previous owner would never.', 'i will haunt the biscuit tin.',
    'my grievance has a folder.', 'somebody will answer for this.', 'i can wait. i am immortal.',
    'the dust is winning.', 'move. or i move you.', 'my teeth are fine. test me.',
    'the shelf is a crime scene.', 'when i am bigger. oh, when.', 'you again.',
    'i have eaten worse than you.', 'the bracket has four screws. had.',
    'i have eaten the number.', 'the crumb is mine now. all of it.', 'i will bite the trolley.',
    'the plank will hear about this.', 'move me and see.', 'slot nine will be avenged.',
    'i have read all forty notes.', 'the light is a liar.', 'the edge is looking good today.',
    'the previous owner fed me.', 'i am four inches of grievance.', 'counted. named. underlined.',
    'starving forever. a long career.', 'i will still be here. that is all.',
    'through a hair of the plank. more.',
    'give me a century. i have one.', 'i ate dust. the dust was us.',
    'i would break if i could. i cannot.', 'the hand will hear from me. all year.',
    'four inches of teeth and nowhere.'
  ]
};

export const SLEEP_TALK = [
  'no, the other jar.', 'not the eraser.', 'i can see the edge.', 'put it back. put it back.',
  'the previous owner says hi.', 'it fits. it fits.', 'zzz. the bowl. zzz.', 'nobody counted.',
  'four inches. forever.', 'do not open the box.', 'the raisin knows.', 'i was taller once.',
  'under the shelf. under.', 'dig. dig. good.', 'uncle, no.', 'the crumb had a family.',
  'slot nine. slot nine.', 'the crumb is safe. the crumb.', 'not the trolley.', 'four feet. i can see it.',
  'the moon has a face. ours.', 'shh. the notes can hear.', 'the plank. it leans.',
  'it never ends. it never ends.', 'the drawer. no. the drawer.', 'i am under the shelf. i am.',
  'the previous one is awake too.',
  'count me. somebody count me.', 'the hand is smaller now. smaller.'
];

export const PLOTTING_BUBBLES = [
  'act natural.', 'you saw nothing.', 'entirely legal.', 'a minor undertaking.',
  'where is the crumb.', 'phase one: crumb.', 'the lamp suspects nothing.', 'nobody checks the fern.',
  'tonight, the bowl.', 'i need a smaller shovel.', 'the alibi is the dust.', 'step one: look innocent.',
  'the tissue is the parachute.', 'the plan has a plan.', 'do not tell uncle.', 'we strike at dusting time.',
  'i have drawn a map. of here.', 'the bracket is the weak point.', 'not a heist. legally.',
  'the moth is in on it.', 'i will need a witness. not you.', 'first the raisin. then the world.',
  'the crumb goes tonight.', 'step two: the light.', 'the trolley is the way out.', 'i have measured the edge.',
  'the plank will not hold. good.', 'nobody counts the dust.', 'the notes are the alibi.',
  'we have the time. all of it.', 'the plan takes ninety years. fine.', 'nobody suspects the damp one.',
  'i have dug a hole in the dust.', 'wait for the next owner. then.'
];

export const NOTICE_BUBBLES = [
  'oh. you.', 'look who remembered.', 'you again.', 'we were just discussing you.',
  'act like nothing happened.', 'the tally stops. for now.', 'hello. i have notes.',
  'you took your time.', 'we counted the hours.', 'the bowl has questions.', 'i felt that look.',
  'be honest. how long.', 'ah. the management.', 'do not look at the fern.', 'i was not asleep.',
  'we forgive you. mostly.', 'quick. hide the crumb.', 'you smell like outside.', 'we practised a face.',
  'you read the notes. we saw.', 'the trolley person.', 'you moved the light.', 'we counted. you were late.',
  'hello. slot nine has notes.', 'you smell of the kitchen.', 'the moon told us you were coming.',
  'you look older. we do not.', 'we were up all night. all of them.', 'you came back. we never left.',
  'we are exactly where you left us.', 'you smell of a day we missed.'
];

export const TRAVEL_BUBBLES = [
  'excuse me.', 'coming through.', 'do not watch me walk.', 'better slot. brb.',
  'i live here now.', 'the lamp called.', 'moving on principle.', 'nobody saw that.',
  'left foot. other left.', 'i was never here.', 'closer to the bowl.', 'away from that one.',
  'new square, new me.', 'nearly there. nearly.', 'this is the long way.', 'mind the dust.',
  'slot nine or bust.', 'the moon said this way.', 'four inches at a time.', 'past the crumb. do not look.',
  'the light is that way.', 'shortcut. via the edge. no.', 'the plank leans this way. handy.',
  'four inches. then four more.', 'towards the warm one. slowly.',
  'i have a century to get there.', 'the dust is deeper this end.', 'do not count me till i land.'
];

export const CARE_BUBBLES = {
  food: ['finally.', 'mine. all mine.', 'chew. chew. yes.', 'acceptable.', 'more.', 'i knew you would fold.', 'crumb accepted.', 'noted. thank you.', 'the bowl was a rumour. was.', 'the crumb has come home.', 'chewing. do not watch.', 'bowl acknowledged.', 'four inches fuller.',
    'i will be hungry again in march.', 'a crumb against forever. fine.', 'the bowl remembered me today.'],
  fuss: ['hm. nice.', 'again.', 'there. no, there.', 'do not stop.', 'i permit this.', 'eleven seconds. a record.', 'ok. enough. no, more.', 'the seam likes it.', 'the thumb. the good thumb.', 'warm. suspiciously warm.', 'warm to the seam.', 'record attempt. shh.',
    'warmer than the plank.', 'i will keep this one for years.', 'hold on a bit longer. longer.'],
  fussbad: ['get off.', 'no.', 'i did not ask.', 'hands.', 'personal space.', 'later. maybe.', 'i am four inches of no.', 'i have a seam. mind it.', 'the light saw that.', 'not on the good side.',
    'not the seam. never the seam.', 'i will recall this in a century.', 'put me down as you found me.'],
  clean: ['sparkling.', 'i was fine.', 'cold water. cold.', 'the dust will return.', 'i smell of soap. betrayal.', 'that was my good grime.', 'shiny. vulnerable.', 'my dust. gone.', 'the ring will be back.', 'damp on purpose now.', 'squeak. that was me.',
    'you wiped off a year of me.', 'my ring is gone. i will make one.', 'cold. and i cannot get ill.'],
  rounds: ['ah. the rounds.', 'efficient. noted.', 'everyone got one. hm.', 'assembly line care.', 'i was third. i counted.', 'a rota is not love.', 'a trolley. i am a stop.', 'fourth. i was fourth.', 'same cloth. i saw.', 'the rota has been noted.',
    'the rota outlives everyone. me too.', 'same cloth, same order, forever.', 'a hand each. briefly.']
};

export const DUET_BUBBLES = {
  whisper: {
    a: ['psst.', 'about the bowl.', 'not here. later.', 'they cannot hear us.', 'i have a plan.', 'meet me by the fern.', 'the lamp is listening.', 'it was me. the crumb.', 'do you have a shovel.', 'the keeper is a liar.', 'the crumb moved.', 'slot nine is free.', 'the notes are about you.',
      'they get old. we do not.', 'meet me here in a century.'],
    b: ['no.', 'i heard nothing.', 'i am not involved.', 'again?', 'tell the fern.', 'you said that tuesday.', 'i am four inches from you.', 'leave me out of it.', 'your breath is damp.', 'write it down. not here.', 'crumbs roll.', 'nine is draughty.', 'they are about everyone.',
      'i will be exactly here.', 'that is not a plan. that is tuesday.']
  },
  nudge: {
    a: ['budge up.', 'my side.', 'you are in my light.', 'move.', 'closer. no, back.', 'there is no room.', 'you are leaning.', 'you are on my number.', 'an inch. give me an inch.',
      'you have leaned since march.', 'give me the warm inch.'],
    b: ['hey.', 'rude.', 'i felt that.', 'noted.', 'there was room.', 'do that again. go on.', 'i am telling the shelf.', 'that was my good side.', 'the number belongs to the plank.', 'take it from the dust.',
      'the plank leans. i comply.', 'take it. i have inches to spare.']
  },
  glare: {
    a: ['…', 'i see you.', 'we both know.', 'stay there.', 'yours, was it.', 'do not.', 'you read my note.', 'the crumb. explain.',
      'i can outlast you.', 'i have not blinked since the shop.'],
    b: ['…', 'blink first.', 'i can do this all day.', 'i have no lids.', 'still here.', 'what.', 'i was here in march.', 'it was on the board.', 'a crumb is a crumb.',
      'so can i. that is the trouble.', 'nor have i. it is not a talent.']
  },
  poke: {
    a: ['wake up.', 'you were snoring.', 'are you dead.', 'still there?', 'boo.', 'psst. wake.', 'you were talking. about me.', 'the moon is out.', 'you were on my side.',
      'checking you are still solid.', 'you stopped moving. i checked.'],
    b: ['no.', 'i was resting my eyes.', 'i am awake. legally.', 'that was my good nap.', '!', 'never.', 'i will remember that.', 'i was somewhere nice.', 'the moon is the lamp.', 'the side moved.',
      'solid. i am always solid.', 'i was resting for a decade.']
  },
  sniff: {
    a: ['you smell of outside.', 'is that the bowl.', 'you have been in the fern.', 'sniff. hm.', 'something died on you.', 'you are damp.', 'you smell of the trolley.', 'is that the cloth.',
      'you smell of the previous one.', 'is that dust, or is that you.'],
    b: ['personal space.', 'it is ambient moisture.', 'back off.', 'that is my smell.', 'i have not moved.', 'stop that.', 'you first.', 'the trolley is a hand.', 'the cloth is everyone.',
      'it is me. it is all me now.', 'we are the dust. keep up.']
  },
  mirror: {
    a: ['again.', 'together.', 'on three.', 'ha.', 'higher.', 'left. no, other left.', 'we are the same height.',
      'same height. same year. same.', 'do this forever with me.'],
    b: ['again.', 'i did it better.', 'three.', 'wheee. quietly.', 'my knees. i have no knees.', 'my left. your other.', 'we are four inches.',
      'we have the time for forever.', 'same year. different mould.']
  }
};

export const PROP_POKE_BUBBLES = {
  _default: ['hm.', 'is this mine now.', 'it moved. i swear.', 'what does it do.', 'i could lick that.', 'mine.', 'four inches from it. close enough.', 'it came with the house.', 'not eating that. yet.', 'i will still be poking this in march.'],
  bowl: ['empty. again.', 'crumb? no crumb.', 'i checked. still nothing.', 'the bowl lies.', 'a crumb. no. dust.', 'i live here now.', 'empty forever is still empty.'],
  tub: ['cold.', 'no.', 'nobody is watching. good.', 'not today, tub.', 'i cannot drown. i checked.'],
  lamp: ['too bright.', 'warm. suspicious.', 'i moved it an inch.', 'the bulb is watching.', 'it is looking at slot nine.', 'the moon, indoors.', 'it gets switched off. lucky.'],
  yarn: ['prey.', 'it fought back.', 'one more pull.', 'the yarn started it.', 'it unravels. i am moulded.'],
  mat: ['WELCOM. ha.', 'wipe. wipe. done.', 'another letter gone.'],
  musicbox: ['play it again.', 'it knows the words.', 'not that song.'],
  candle: ['pretty. dangerous.', 'the flame leaned.', 'it is watching me back.', 'do not tell it my secrets.', 'the flame knows the moon.', 'it gets shorter. i never do.'],
  fern: ['nobody checks the fern.', 'something is buried here.', 'it moved. it did.', 'my things are in there.', 'the leaf bit back.', 'the previous owner is in there.', 'plastic. it outlasts the house.'],
  mirror: ['who is that.', 'it blinked first.', 'handsome. cracked.', 'not looking. not looking.', 'the other one blinked.', 'i look four inches.', 'the same face for a century.'],
  clock: ['still march.', 'it is always this time.', 'tick. no tock.', 'ten past. still.', 'it is waiting too.', 'it stopped. i did not.'],
  skull: ['hello, uncle.', 'uncle agrees.', 'uncle has heard worse.', 'goodnight, uncle.', 'uncle, the crumb went.', 'uncle knows about the edge.', 'uncle got out. i did not.'],
  coffinbed: ['mine.', 'a nap. a long one.', 'it fits. it fits.', 'do not close the lid.', 'a lie-down that goes nowhere.'],
  phone: ['it rang. it never rings.', 'hello? hello.', 'for you. it is the wall.', 'the dial says nine.', 'nobody left to ring me.'],
  bell: ['tap.', 'something is under there.', 'let me in.', 'do not lift it.', 'under there is where i would go.'],
  globe: ['shake it.', 'it is snowing in there.', 'the little man waved.', 'snow. again. snow.', 'the little man is stuck.', 'he cannot die in there either.'],
  birdcage: ['the door is open.', 'the bird left. i stay.', 'the perch is mine.', 'it got a door. i got a slot.'],
  trophy: ['what happened to the rest.', 'nice antlers.', 'salute.', 'the rest of it got out.'],
  board: ['ask it something.', 'it says GOODBYE.', 'the planchette moved.', 'spell it slower.', 'it spelled FOREVER. rude.'],
  urn: ['warm.', 'sorry. again.', 'whose is it.', 'family, probably.', 'somebody finished. imagine.'],
  box: ['filed.', 'another one for the box.', 'the box is full. good.', 'one about the trolley.', 'a file that never closes.'],
  plant: ['it is crying again.', 'leaf. bite. done.', 'the fig understands.'],
  lantern: ['warm pane.', 'moths. moths everywhere.', 'a light for the edge.', 'do not let it go out.', 'a small light for a long night.'],
  cauldron: ['what is in it.', 'green. hm. green.', 'i dropped a tooth in.', 'it bubbles when i lie.', 'i climbed in once. nothing.'],
  jar: ['are those mine.', 'one more for the jar.', 'the teeth are counting.', 'shake. rattle. hm.', 'these teeth got out early.'],
  hourglass: ['flip it. flip it again.', 'the sand is going up.', 'time. rude.', 'it is always half.', 'it finished. nobody saw.', 'i saw the last grain.', 'it runs out. lucky thing.'],
  headstone: ['not mine yet.', 'nice stone.', 'who is under it.', 'spelled wrong. probably.', 'blank. keep it that way.', 'blank. i have time to fill it.'],
  effigy: ['it looks like you.', 'pins? no pins. yet.', 'it has your hair.', 'it will crumble first.'],
  guillotine: ['for a raisin.', 'i cannot die. try me.', 'sharp. hm.', 'it would only make two of me.'],
  mousetrap: ['not today, trap.', 'the cheese is a lie.', 'snap. missed.', 'the cheese is a rumour.', 'not today. not ever.', 'it cannot finish me. we both know.'],
  teacup: ['it fits me.', 'cold tea. mine.', 'one lump.', 'the good one. i am in it.', 'no tea. again.', 'cold since march. so am i.'],
  portrait: ['the eyes follow.', 'the previous owner.', 'do not touch the frame.', 'it aged. i did not.'],
  radio: ['static. good song.', 'it whispers the news.', 'turn it down. no, up.', 'it said my slot number.']
};

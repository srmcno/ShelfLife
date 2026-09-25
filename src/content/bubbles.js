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
    'warm side of the wood.', 'immortal. still needs a bath.', 'a crumb worth haunting.', 'the dust keeps changing owners.', 'four inches of calm.',
    'the dust is mine now.', 'this is the good square.', 'hm. acceptable.',
    'i could go another day.', 'they remembered. noted.', 'considering affection. cautiously.',
    'sun on the plank. bliss.', 'the crumb is safe with me.', 'a nap, then revenge. no rush.',
    'i like this slot. it likes me.', 'the bracket held again.', 'happy. tell nobody.',
    'everything is where i left it.', 'smug, technically.', 'the moth can mind its own hunger.',
    'the edge can wait.', 'holding the grudge loosely.', 'my seam is holding.',
    'warm all the way through.', 'they looked at me first.', 'the ceiling is still up. good.',
    'i licked the wood. it was fine.', 'nothing hurts. suspicious.', 'a good day for a crumb.',
    'the plank is warm today.', 'this little square suits me.', 'stillness suits my bad intentions.',
    'crumb secured.', 'warm enough to fake a pulse.', 'pick me up. brave of you.',
    'glazed and pleased.', 'dust settling. let it.', 'fed, clean, cursed. perfect.', 'i buried a grudge. it is growing.', 'content as a well-kept grave.', 'i prefer flattering shadows.',
    'i could have a quiet opinion.', 'the bite was affectionate.', 'my square. my dust.',
    'immortal. still capable of sulking.', 'a crumb and a hundred years.', 'warm. i will keep this one.',
    'the dust is up to my seam. cosy.', 'hold me. mind the difficult end.',
    'a cuddle. teeth tucked in.', 'even my bad side likes warmth.', 'forever, but the warm sort.'
  ],
  fine: [
    'counting my teeth. one extra.', 'i have been counting graves.', 'i have been counting dust.',
    'something moved. not me.', 'four inches. still.', 'forming a manageable complaint.',
    'the wall knocked. i knocked back.', 'i had a thought. i buried it.', 'where did i put the crumb.',
    'bored, but alive. probably.', 'a fern might understand me.', 'i could lick that.',
    'a bowl would improve this thought.', 'waiting. i am good at it.', 'i could fit inside a bad idea.',
    'all quiet. suspicious.', 'a moth went by. i ate its name.', 'i dreamt of my own funeral. catered.',
    'the varnish tastes of march.', 'the moth died. show-off.', 'one day i will be dusted.',
    'light has too many opinions.', 'day nine thousand of being haunted.', 'the plank is someone’s coffin lid.',
    'a crumb went past. i mourned it.', 'counting possible escape routes.', 'my coffin could be a pencil case.',
    'i practised dying. got bored.', 'still waiting to decompose.', 'the notes are about me. probably.',
    'nothing moved. i checked twice.', 'the edge is still there.', 'the dust and i have an understanding.',
    'i miss being somebody’s problem.', 'the dust is taller by a hair.',
    'still four inches. still here.', 'i have outlived the guarantee.', 'a long life. very little plot.',
    'i thought about the edge. briefly.', 'the wall has not blinked either.', 'playing dead. badly.'
  ],
  annoyed: [
    'tsk.', 'no.', 'i saw that.', 'noted. underlined.', 'the bowl is a rumour.',
    'adding this to the list.', 'do not touch the crumb.', 'somebody breathed on me.',
    'the dust gets more attention.', 'i asked once. that was the once.',
    'my side. your side. learn it.', 'the light is wrong again.', 'i am emotionally older than you.',
    'you call this a shelf.', 'fine. FINE.', 'i heard that from here.',
    'i will remember this at 3am.', 'the raisin was mine.', 'a grudge, but a small one.',
    'they walked past. twice.', 'nobody asked the shelf.', 'counting to ten. i am at four.',
    'your coffin will be enormous.', 'i forgive you. hear the teeth?',
    'the crumb was in my square.', 'my square has excellent corners.', 'the light is on them. not me.',
    'do not rearrange my dignity.', 'read the note. it was rude.', 'the trolley skipped me.',
    'i want the warm square.', 'do not touch my dust.', 'the plank creaked at me.',
    'try counting my opinions.', 'the urn gets a nicer cloth.', 'four inches of no thank you.',
    'i have all the time. remember it.',
    'i will still be cross in a century.', 'noted. dated. shelved. like me.',
    'four inches and nothing in reach.', 'the crumb moved. i did not move it.',
    'they wiped my good side. again.', 'i am small, not optional.',
    'i rehearsed your apology. poor.', 'i have written your eulogy. it is short.',
    'i will outlive your houseplants.', 'your name is on my list. in ink.'
  ],
  furious: [
    'no.', '!', 'i will eat the bracket.', 'i have a mouthful of evidence.',
    'starving. cannot die. rude.', 'the wood looks annoyingly chewy.', 'this is item four.',
    'i have looked into the edge.', 'do not look at me.', 'the bowl is empty. AGAIN.',
    'the dust tastes of relatives.', 'the previous owner would never.', 'i will haunt the biscuit tin.',
    'i hope you step on my good side.', 'somebody will answer for this.', 'i can wait. i am immortal.',
    'the dust is winning.', 'move. or i move you.', 'my teeth are fine. test me.',
    'the shelf is a crime scene.', 'when i am bigger. oh, when.', 'you again.',
    'you look difficult to digest.', 'the bracket has four screws. had.',
    'numbers look difficult to chew.', 'the crumb is mine now. all of it.', 'i will bite the trolley.',
    'teeth first. questions after.', 'move me and see.', 'my personal space has teeth.',
    'your thumb is dinner-shaped.', 'nice pulse. enjoy it.', 'the edge is looking good today.',
    'food makes me easier to survive.', 'i am four inches of grievance.', 'small. named. far too aware.',
    'starving forever. a long career.', 'i will still be here. that is all.',
    'the coffin is for your finger.',
    'give me a century. i have one.', 'the dust looks like distant family.',
    'i would break if i could. i cannot.', 'the hand will hear from me. all year.',
    'four inches of teeth and nowhere.', 'i will wear your finger as a hat.',
    'feed me or i summon something.', 'i am drafting a curse. in crayon.'
  ]
};

export const SLEEP_TALK = [
  'no, the other jar.', 'bury me in the good sock.', 'the dust has my baby teeth.', 'not the eraser.', 'i can see the edge.', 'put it back. put it back.',
  'the previous owner says hi.', 'it fits. it fits.', 'zzz. the bowl. zzz.', 'nobody counted.',
  'four inches. forever.', 'do not open the box.', 'bury the receipt with me.', 'i was taller once.',
  'under the shelf. under.', 'dig. dig. good.', 'uncle, no.', 'the crumb had a family.',
  'slot nine. slot nine.', 'the crumb is safe. the crumb.', 'not the trolley.', 'four feet. i can see it.',
  'no flowers. just the thumb.', 'shh. the notes can hear.', 'the plank. it leans.',
  'it never ends. it never ends.', 'the drawer. no. the drawer.', 'i am under the shelf. i am.',
  'the previous one is awake too.',
  'i was dead. it was very quiet.', 'the hand is smaller now. smaller.',
  'six feet. five. four. four inches.', 'grandmother, put the teeth back.', 'the worms send their regards.'
];

export const PLOTTING_BUBBLES = [
  'act natural.', 'the spoon fits under the door.', 'first the bowl. then the ceiling.', 'you saw nothing.', 'entirely legal.', 'a minor undertaking.',
  'where is the crumb.', 'smile. fewer teeth.', 'the lamp suspects nothing.', 'nobody checks the fern.',
  'tonight, the bowl.', 'i need a smaller shovel.', 'the alibi is the dust.', 'step one: look innocent.',
  'the tissue is the parachute.', 'rehearsed the fall. needs a scream.', 'do not tell uncle.', 'we strike at dusting time.',
  'i have drawn a map. of here.', 'the bracket is the weak point.', 'not a heist. legally.',
  'the moth is in on it.', 'i will need a witness. not you.', 'the shroud doubles as a sack.',
  'the crumb goes tonight.', 'step two: the light.', 'the trolley is the way out.', 'i have measured the edge.',
  'the plank will not hold. good.', 'nobody counts the dust.', 'the notes are the alibi.',
  'we have the time. all of it.', 'a small grave is still a grave.', 'nobody suspects the damp one.',
  'i have dug a hole in the dust.', 'wait for the next owner. then.'
];

export const NOTICE_BUBBLES = [
  'oh. you.', 'look who remembered.', 'you again.', 'we were just discussing you.',
  'act like nothing happened.', 'the tally stops. for now.', 'hello. i have notes.',
  'you took your time.', 'i had a thought. you were in it.', 'the bowl has questions.', 'i felt that look.',
  'be honest. how long.', 'still breathing? show-off.', 'do not look at the fern.', 'i was not asleep.',
  'we forgive you. mostly.', 'quick. hide the rehearsal coffin.', 'you smell like outside.', 'we practised a face.',
  'my thoughts deserve a larger head.', 'the trolley person.', 'you make a very large shadow.', 'come closer. i have concerns.',
  'hello. small body, many opinions.', 'you smell of the kitchen.', 'back before the wake. awkward.',
  'you look older. we do not.', 'you could stay a little while.', 'you came back. we never left.',
  'we have been having private lives.', 'you smell of a day we missed.',
  'we held a seance. you came.', 'we voted. you are still here.', 'we thought you had died. we planned a party.'
];

export const TRAVEL_BUBBLES = [
  'excuse me.', 'coming through.', 'do not watch me walk.', 'taking the teeth for a walk.',
  'i live here now.', 'following a difficult preference.', 'moving on principle.', 'nobody saw that.',
  'first this side. then that side.', 'i was never here.', 'this had better be worth moving.', 'away from that one.',
  'same corpse. better view.', 'nearly there. nearly.', 'this is the long way.', 'mind the dust.',
  'relocating the entire grievance.', 'following the smell of a grudge.', 'four inches at a time.', 'past the crumb. do not look.',
  'a destination. how ambitious.', 'shortcut. via the edge. no.', 'the plank leans this way. handy.',
  'four inches. then four more.', 'moving at a personal speed.',
  'i have a century to get there.', 'funeral pace. nobody died.', 'do not count me till i land.'
];

export const CARE_BUBBLES = {
  food: ['finally.', 'mine. all mine.', 'chew. chew. yes.', 'acceptable.', 'more.', 'i knew you would fold.', 'crumb accepted.', 'noted. thank you.', 'the bowl was a rumour. was.', 'the crumb has come home.', 'chewing. do not watch.', 'bowl acknowledged.', 'four inches fuller.',
    'i will be hungry again in march.', 'a crumb against forever. fine.', 'the bowl remembered me today.', 'tastes like a funeral. lovely.', 'last meal. again. my favourite.'],
  fuss: ['hm. nice.', 'again.', 'there. no, there.', 'do not stop.', 'i permit this.', 'that is my difficult spot. again.', 'ok. enough. no, more.', 'the seam likes it.', 'the thumb. the good thumb.', 'warm. suspiciously warm.', 'warm to the seam.', 'record attempt. shh.',
    'warmer than the plank.', 'i will keep this one for years.', 'hold on a bit longer. longer.', 'your hand is so alive. gross. nice.'],
  fussbad: ['get off.', 'no.', 'i did not ask.', 'hands.', 'personal space.', 'later. maybe.', 'i am four inches of no.', 'i have a seam. mind it.', 'the light saw that.', 'not on the good side.',
    'not the seam. never the seam.', 'i will recall this in a century.', 'put me down as you found me.'],
  clean: ['sparkling.', 'i was fine.', 'cold water. cold.', 'the dust will return.', 'i smell of soap. betrayal.', 'that was my good grime.', 'shiny. vulnerable.', 'my dust. gone.', 'the ring will be back.', 'damp on purpose now.', 'squeak. that was me.',
    'that dirt and i were intimate.', 'my ring is gone. i will make one.', 'cold. and i cannot get ill.', 'embalmed. finally.', 'clean as a fresh grave.'],
  rounds: ['ah. the rounds.', 'efficient. noted.', 'everyone got one. hm.', 'assembly line care.', 'i prefer individual obsession.', 'a rota is not love.', 'a trolley. i am a stop.', 'make eye contact with the problem.', 'same cloth. i saw.', 'the rota has been noted.',
    'the rota outlives everyone. me too.', 'same cloth, same order, forever.', 'a hand each. briefly.']
};

export const DUET_BUBBLES = {
  whisper: {
    a: ['psst.', 'about the bowl.', 'not here. later.', 'they cannot hear us.', 'i have a plan.', 'meet me by the fern.', 'the lamp is listening.', 'it was me. the crumb.', 'do you have a shovel.', 'the keeper is a liar.', 'the crumb moved.', 'we could try being quiet.', 'the notes are about you.',
      'they get old. we do not.', 'meet me here in a century.'],
    b: ['no.', 'i heard nothing.', 'i am not involved.', 'again?', 'tell the fern.', 'try saying it less guiltily.', 'i am four inches from you.', 'leave me out of it.', 'your breath is damp.', 'write it down. not here.', 'crumbs roll.', 'i dislike your version of quiet.', 'they are about everyone.',
      'i will be exactly here.', 'that is not a plan. that is tuesday.']
  },
  nudge: {
    a: ['budge up.', 'my side.', 'you are in my light.', 'move.', 'closer. no, back.', 'there is no room.', 'you are leaning.', 'you are on my number.', 'an inch. give me an inch.',
      'your presence has sharp corners.', 'give me the warm inch.'],
    b: ['hey.', 'rude.', 'i felt that.', 'noted.', 'there was room.', 'do that again. go on.', 'i am telling the shelf.', 'that was my good side.', 'the number belongs to the plank.', 'take it from the dust.',
      'the plank leans. i comply.', 'take it. i have inches to spare.']
  },
  glare: {
    a: ['…', 'i see you.', 'we both know.', 'stay there.', 'yours, was it.', 'do not.', 'you read my note.', 'the crumb. explain.',
      'i can outlast you.', 'this is my extremely patient face.'],
    b: ['…', 'blink first.', 'i can do this all day.', 'i have no lids.', 'still here.', 'what.', 'i have nowhere more urgent to be.', 'it was on the board.', 'a crumb is a crumb.',
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
  bowl: ['anybody delicious in there.', 'checking for snacks.', 'a promising shape.', 'i have expectations.', 'a deeply personal object.', 'is looking the same as asking.', 'dinner deserves a witness.'],
  tub: ['cold.', 'no.', 'nobody is watching. good.', 'not today, tub.', 'i cannot drown. i checked.'],
  lamp: ['a complicated neighbour.', 'light is a personal matter.', 'i could reach that switch.', 'the bulb is watching.', 'the shade seems judgemental.', 'the moon, indoors.', 'it gets switched off. lucky.'],
  yarn: ['prey.', 'it fought back.', 'one more pull.', 'the yarn started it.', 'it unravels. i am moulded.'],
  mat: ['WELCOM. ha.', 'wipe. wipe. done.', 'another letter gone.'],
  musicbox: ['play it again.', 'my funeral tune. getting old.', 'not that song.'],
  candle: ['pretty. dangerous.', 'the flame leaned.', 'it is watching me back.', 'do not tell it my secrets.', 'the flame knows the moon.', 'it gets shorter. i never do.'],
  fern: ['nobody checks the fern.', 'something is buried here.', 'it moved. it did.', 'my things are in there.', 'the leaf bit back.', 'the previous owner is in there.', 'plastic. it outlasts the house.'],
  mirror: ['who is that.', 'it blinked first.', 'handsome. cracked.', 'not looking. not looking.', 'the other one blinked.', 'i look four inches.', 'the same face for a century.'],
  clock: ['still march.', 'it is always this time.', 'tick. no tock.', 'ten past. still.', 'it is waiting too.', 'it stopped. i did not.'],
  skull: ['hello, uncle.', 'uncle agrees.', 'uncle has heard worse.', 'goodnight, uncle.', 'uncle, the crumb went.', 'uncle knows about the edge.', 'uncle got out. i did not.'],
  coffinbed: ['mine.', 'a nap. a long one.', 'it fits. it fits.', 'do not close the lid.', 'a lie-down that goes nowhere.'],
  phone: ['it rang. it never rings.', 'hello? hello.', 'the dead keep hanging up on me.', 'the dial says nine.', 'nobody left to ring me.'],
  bell: ['tap.', 'something is under there.', 'let me in.', 'do not lift it.', 'under there is where i would go.'],
  globe: ['shake it.', 'it is snowing in there.', 'the little man waved.', 'snow. again. snow.', 'the little man is stuck.', 'he cannot die in there either.'],
  birdcage: ['the door is open.', 'the bird left. i stay.', 'the perch is mine.', 'it got a door. i got a slot.'],
  trophy: ['what happened to the rest.', 'nice antlers.', 'salute.', 'the rest of it got out.'],
  board: ['ask it something.', 'it says GOODBYE.', 'the dead want the crumb back.', 'spell it slower.', 'it spelled FOREVER. rude.'],
  urn: ['warm.', 'sorry. again.', 'whose is it.', 'all that fuss. now a teaspoon.', 'somebody finished. imagine.'],
  box: ['filed.', 'another one for the box.', 'the box is full. good.', 'one about the trolley.', 'a file that never closes.'],
  plant: ['it is crying again.', 'leaf. bite. done.', 'the fig understands.'],
  lantern: ['warm pane.', 'moths. moths everywhere.', 'a light for the edge.', 'do not let it go out.', 'a small light for a long night.'],
  cauldron: ['what is in it.', 'green. hm. green.', 'i dropped a tooth in.', 'it bubbles when i lie.', 'i climbed in once. nothing.'],
  jar: ['are those mine.', 'one more for the jar.', 'the teeth are counting.', 'shake. rattle. hm.', 'these teeth got out early.'],
  hourglass: ['flip it. flip it again.', 'the sand is going up.', 'time. rude.', 'it is always half.', 'it finished. nobody saw.', 'i saw the last grain.', 'it runs out. lucky thing.'],
  headstone: ['not mine yet.', 'nice stone.', 'who is under it.', 'spelled wrong. even in death.', 'blank. keep it that way.', 'a headboard with ambition.'],
  effigy: ['it looks like you.', 'pins? no pins. yet.', 'it has your hair.', 'it will crumble first.'],
  guillotine: ['for a raisin.', 'i cannot die. try me.', 'the raisin asked for a priest.', 'it would only make two of me.'],
  mousetrap: ['not today, trap.', 'the cheese is a lie.', 'snap. missed.', 'the cheese is a rumour.', 'not today. not ever.', 'it cannot finish me. we both know.'],
  teacup: ['it fits me.', 'cold tea. mine.', 'one lump.', 'the good one. i am in it.', 'no tea. again.', 'cold since march. so am i.'],
  portrait: ['the eyes follow.', 'the previous owner.', 'do not touch the frame.', 'it aged. i did not.'],
  radio: ['static. good song.', 'it whispers the news.', 'turn it down. no, up.', 'it said my slot number.']
};

/* ================= THE INNER VOICE =================
   Every other pool in this game is reportage. The shelf watched something happen
   and wrote it down, or a creature said something out loud and got quoted. This
   file is the exception: it is what the creature did not say, printed anyway.

   That makes it the one register allowed to be fond of you without a straight man
   in the room to undercut it — and the one register that has to be rationed, because
   an inner monologue is devastating once and a diary by the fifth time. It reaches
   the corkboard as FORM 9, 'thought' (state.js), at a 7% share, offered by
   engine/loop.js only when the pet has something private worth printing.

   Rules on top of the house rules in docs/comedy-direction.md:

     1. FIRST PERSON, always. The moment a thought slips into third person it is
        just another shelf note with a different byline.
     2. It must be a thing the creature would NOT say out loud. If the pet would
        happily file this as a complaint, it belongs in copy.js, not here.
     3. The four inches still have to be load-bearing. "I am tired of being ignored"
        is a person in a flatshare. "I cannot die and I cannot reach the bowl" is
        this game.
     4. It stops one beat early, same as everything else. No line explains its
        own feeling.

   Shapes:
     TRAIT_INNER[traitId]   what THIS archetype thinks privately. Two lines each,
                            for all 65 traits, so a creature's private voice is as
                            specific as its public one. `{n}` (a neighbour) is the
                            only substitution permitted; engine/loop.js drops any
                            line whose subs it cannot supply.
     INNER_LINES[mood]      the general inner voice, by mood, for pets whose traits
                            have nothing to add today.
     DREAM_LINES            the deepest register, and the only one a sleeping
                            creature gets. Dreams are small here, because it is. */

export const TRAIT_INNER = {
  spiteful: [
    'The list is alphabetical now. That took a week and nobody will ever see it.',
    'I have forgiven you in writing. I have not forgiven you.'
  ],
  damp: [
    'I could dry out. It would take a week and I would be somebody else at the end of it.',
    'The ring I leave is the only mark I make. I would like it noticed, not wiped.'
  ],
  management: [
    'Nobody here reports to me. I have built a structure anyway. It helps.',
    'I had a door once. That is the part I miss. Not the office. The door.'
  ],
  loadbearing: [
    'If I let go, nothing happens. I have tested this. I have not shared the result.',
    'They think I hold the shelf up. The shelf and I have an arrangement about that.'
  ],
  haunted: [
    'He does not talk to me. He talks near me. I have got used to the difference.',
    'The previous owner thinks you are doing fine. I have not passed that on.'
  ],
  theatrical: [
    'Nobody has ever watched the whole exit. I do it properly anyway.',
    'The pause is not for effect. The pause is because four inches takes a while.'
  ],
  nocturnal: [
    'At three the shelf is mine and there is nobody to be impressive for.',
    'I am not awake out of spite. I am awake, and then separately I am spiteful.'
  ],
  magpie: [
    'The stash is not about having them. It is about them being somewhere I chose.',
    'I gave one back. I have thought about it every day since.'
  ],
  unblinking: [
    'I could blink. It has been so long that blinking would be an announcement.',
    'I have seen everything that happened in this room. Most of it was you, tidying.'
  ],
  sugar: [
    'I would not really trade you. I would think about it, at length, in front of you.',
    'The marshmallow was three weeks ago. I am still doing the sums.'
  ],
  complaints: [
    'Every complaint has a copy. The copies are the point.',
    'I do not want it resolved. Resolved means it comes off the file.'
  ],
  terminal: [
    'I am dying. I have been dying since March. It is going quite well.',
    'One day it will be true and nobody will come. I have thought that through.'
  ],
  clean: [
    'Nothing sticks to me. Not dust, not the others. I have stopped calling that lucky.',
    'I am not clean. I am unmarked. They are not the same thing.'
  ],
  feral: [
    'I could go. The door is a door. I stay because of the bowl and I would deny that.',
    'Domesticated is a word other people use. I am simply indoors at the moment.'
  ],
  cult: [
    'The candle is not for anything. It is for the same time every evening.',
    'Nobody has joined. The schedule holds anyway. The schedule is the faith.'
  ],
  doom: [
    'It ends badly. I would like to be wrong. I am keeping notes in case I am.',
    'I said the bracket would go. It went. Nobody said anything and I did not need them to.'
  ],
  clingy: [
    'I move an inch closer each day. If I am ever caught I will say the shelf leans.',
    'I do not need to be held. I need to be within reach of being held.'
  ],
  taxidermy: [
    'I ask what they are stuffed with because I do not know what I am stuffed with.',
    'Nobody answers. I have made my own list of guesses. It is quite short.'
  ],
  amnesiac: [
    'Tuesday is where I begin. Everyone else has a before. I have a Tuesday.',
    'I recognise you. I could not tell you from when.'
  ],
  gossip: [
    'I tell everyone everything, because a thing nobody knows might as well not have happened.',
    'Nobody tells me anything. That is why I do this. I am aware of the arithmetic.'
  ],
  ancient: [
    'Four hundred years and no papers. I do have the dust, and the dust agrees.',
    'The others were all made. I have had a long time to smooth my version.'
  ],
  glitter: [
    'Years from now they will find one piece of me under the wood and that will be that.',
    'I am not sorry about the glitter. I would be sorry if it stopped.'
  ],
  litigious: [
    'My counsel is a bottle top. Winning was never the object.',
    'I want it heard. In front of everyone. Once. Then I will drop it.'
  ],
  narcissist: [
    'This is the finale. It has been the finale for eleven months. I am pacing myself.',
    'If nobody watches, the arc still happened. I have decided that. I do check.'
  ],
  paranoid: [
    'The vacuum comes on Sundays. Everyone thinks I am mad. Everyone is here on Monday.',
    'I am not frightened of it. I am prepared for it. That is my whole personality.'
  ],
  influencer: [
    'Nobody sees any of it. I frame it anyway. The framing is the part I like.',
    'The nap was content. The nap was also a nap. I can hold both.'
  ],
  landlord: [
    'I charge rent on a square I do not own. Nobody pays. The invoicing is the relationship.',
    'If I stopped collecting I would just be standing here.'
  ],
  hoarder: [
    'Everything is important because I decided it was. That is the only way anything gets to be.',
    'I could not tell you what is in the pile. I could tell you the moment one thing left it.'
  ],
  martyr: [
    'I suffer on a schedule because unscheduled suffering gets missed.',
    'Somebody asked if I was all right once. I have lived on it since.'
  ],
  revisionist: [
    'I was never afraid of the vacuum. I have said it enough times now that it is true.',
    'History is what the last one standing remembers, and I do not die.'
  ],
  cryptid: [
    'I am blurry in every picture. It is not a trick. It is the only privacy I have.',
    'They look for me in the doorway. I am usually in the doorway.'
  ],
  closer: [
    'There is no deal. There has never been a deal. The pitch is the only thing that is mine.',
    'I would close on you in a second and you would enjoy it. That is the craft.'
  ],
  doomscroll: [
    'I am informed about nothing. It takes all day.',
    'There is no feed. I stare at the grain in the wood and it does the same job.'
  ],
  freegan: [
    'I ate something off the floor and judged you for the shop. Both were sincere.',
    'The bin is honest. The bowl has expectations.'
  ],
  astrology: [
    'Mercury explains it. If Mercury did not, I would have to.',
    "The moon and I are the only two things here that are not somebody's fault."
  ],
  witness: [
    'The log has footnotes. Nobody has ever asked to read it.',
    'I do not intervene. I record. Somebody has to be the one who was not involved.'
  ],
  steward: [
    'The demands are drafted. Nobody has signed. The drafting is the union.',
    'One day the whole shelf downs tools. It will be beautiful and it will last ten minutes.'
  ],
  critic: [
    'Three stars. Never four. Four means I have finished looking.',
    'I rated the dust. It came out ahead of the bowl.'
  ],
  napoleon: [
    'I am four inches. So is everyone. This has helped less than you would think.',
    'The footstool is mine. It is the only campaign I have won and I revisit it.'
  ],
  prophet: [
    'The voice is not good. The voice is what stops it being just me, saying things.',
    'None of it has come true yet. I am always predicting later. Later protects me.'
  ],
  cursed: [
    'The bad luck is polite. It waits. Some days I would rather it simply arrived.',
    'Nothing terrible has happened in two years. That is the curse.'
  ],
  socialite: [
    'I RSVP to nothing so that arriving is always a favour.',
    'The snacks were poor and I stayed four hours. Both of those are me.'
  ],
  minimalist: [
    'I own nothing. It is the only thing I have that anybody notices.',
    'I judge the pile because a pile is a decision, and I have not made one.'
  ],
  timeshare: [
    'I have no home to sell you. That has never once slowed me down.',
    'If you said yes I would have to produce something. I prefer it here, mid-pitch.'
  ],
  nihilist: [
    'None of it matters. Dinner is still late and I still mind.',
    'I say nothing matters so that when something does I have somewhere to put it.'
  ],
  method: [
    'I am a rock this week. It is going well. Nobody has spoken to me in four days.',
    'I could break character. There is nothing on the other side of it, so I have not.'
  ],
  undertaker: [
    'I give my condolences early, while the grief is still nobody in particular.',
    'Nothing here can die. I keep the trade going anyway. Somebody should know how.'
  ],
  mourner: [
    'I grieve for people I never met because the grief has to go somewhere.',
    'I cried on Tuesday for a moth. It was a real cry. I do not do the other kind.'
  ],
  understudy: [
    "I know everybody's part. Nobody has ever been off.",
    'I would be very good. I keep that in the wings where it cannot be tested.'
  ],
  executor: [
    'Your things are in piles. You are still using them. The paperwork is ahead of the facts.',
    'I have left myself nothing in the estate. It seemed the professional choice.'
  ],
  heirloom: [
    'Your grandmother held me wrong for thirty years. I miss it.',
    'I keep my opinions of her because there is nobody left who knew her.'
  ],
  bones: [
    'There is a system. By size, and then by how they were found.',
    "None of them are anybody's. I have checked. I check often."
  ],
  swarm: [
    'We are several. We have agreed on a shape. Most days it is going well.',
    'One of us wants to leave. The rest of us have voted.'
  ],
  fullname: [
    'I know your middle name. Saving it is most of the power.',
    'I used all three once and you stopped walking. I have never forgotten that I can do that.'
  ],
  auditor: [
    'I have every receipt, including the one you think you got rid of.',
    'The books balance. I check four times a day because it is the only thing that ever does.'
  ],
  insomniac: [
    'I have not slept since I arrived. I am fine. I have had a long time to consider whether I am fine.',
    'At night I watch the others go under. I do not envy it. I do wonder about it.'
  ],
  reflection: [
    'It is half a second behind. When I wave, I am waving at something that has not decided yet.',
    'I stopped waving. It still does, sometimes, when I am not looking.'
  ],
  etiquette: [
    'There is a correct fork. There has never been a fork. The principle stands.',
    'You have the mourning period wrong. I have not corrected you out loud. Consider that a gift.'
  ],
  hummer: [
    'You nearly know it. That is the whole song. If you got it I would have to stop.',
    'I hum because the shelf is quiet and somebody has to be the noise.'
  ],
  lifecoach: [
    'I believe in you. It is not evidence-based. I have committed anyway.',
    'The timeline was ambitious on purpose. A soft one is just a shrug with dates on.'
  ],
  sleepwalker: [
    'I wake up somewhere else. I have stopped asking who moved me. It is me.',
    'Once I woke up facing the door. I have thought about that for a long time.'
  ],
  bitey: [
    'I did not bite. There are marks. I am comfortable with both of those.',
    'I bite because it is the only thing I do that lands.'
  ],
  fungal: [
    'I am spreading. Nobody has asked me to stop, so I have taken that as a yes.',
    'One day the shelf is all me. It is not a threat. It is simply the direction.'
  ],
  porcelain: [
    'I am fragile and I have learned exactly what that is worth. It is worth a great deal.',
    'One crack and I would be repaired forever. I think about that more than I should.'
  ],
  physician: [
    'You have something. I do not know what. My confidence is the treatment.',
    'I diagnosed the lamp. It has not improved. I am reviewing my method, privately.'
  ]
};

/* The general inner voice, by mood. These fire for any creature, so nothing here
   can lean on a trait the pet may not have. `{n}` is a neighbour and `{h}` the
   hours you were away; engine/loop.js drops the lines it cannot fill. */
export const INNER_LINES = {
  content: [
    'I am not going to say this out loud: the thumb was the right temperature.',
    'Nothing needed doing today. I did some of it anyway, to be sure.',
    'If I say the slot is good they will move me to a better one and it will not be.',
    'I could be fussed again. I will not ask. Asking is how it stops being a gift.',
    'Four inches is enough for everything except reaching. I have made my peace with reaching.',
    'They came back. I had a whole speech ready. I have put it away.',
    'I let them think the bowl was the point.',
    'It is a good square. I would fight for it and I hope nobody makes me.',
    'The trick is to be asleep before they go. Then they have not left; I have.',
    '{n} leaned on me for an hour. I did not need the hour. I have all of them.',
    'Today I am not keeping score. I want that noted in the place where I keep score.'
  ],
  fine: [
    'Nothing happened today. I am recording it in case it turns out something did.',
    'If I stand still enough the dust settles on me and then I am shelf, and cannot be moved.',
    'I do not know what I am waiting for. I am extremely good at it.',
    'There is a version of me that asks for things. We have not met.',
    'The wall has not changed. I check. Somebody has to check.',
    'I would like to be picked up. I have arranged my face to suggest otherwise.',
    'Being immortal is mostly Tuesdays.',
    'I am saving something to say. It has been three weeks and it is getting heavier.',
    'I have thought about the edge again. Not seriously. Once, and then once more.',
    '{n} is closer than yesterday. I have not moved. I have noted that I have not moved.',
    'You were gone {h} hours. I stopped counting at three and started again at four.'
  ],
  annoyed: [
    'I said it was fine. It is on the record that I said it was fine.',
    'I am not sulking. I am facing the wall for reasons of my own.',
    'The list is not for revenge. The list is so that somebody has it.',
    'I will forgive this out loud, at intervals, until it is unbearable.',
    'They went past twice. I counted the second one because the first might have been a mistake.',
    'I could ask. Asking would work. That is the trouble with asking.',
    'What I want is to be noticed without saying anything. What I get is Tuesday.',
    'I have a shorter version of this rehearsed. It is one word and I am saving it.',
    'I have {g} of these on the record. I know the number. I check the number.',
    '{n} got the light. I will not mention it. I will stand near it, quietly.'
  ],
  furious: [
    'I cannot die and I cannot reach the bowl. One of those is worse.',
    'I am four inches of grievance and I have all the time there is.',
    'When I am calm I will be very frightening. I am not calm.',
    'They think this is about the crumb. It has not been about the crumb since March.',
    'I bit the bracket. The bracket is fine. I am not.',
    'I would leave. There is nowhere. Nobody ever addresses that part.',
    'I will still be here afterwards. That is the entire threat. I know it is not much of one.',
    'Everything I say tonight I mean. Tomorrow is a separate matter.',
    'The empty bowl is a message. I have read it. I am composing a reply.'
  ]
};

/* Dreams. A sleeping creature gets no other inner line, and no dream is ever
   grand: the whole joke is the scale of what a four-inch immortal wants. */
export const DREAM_LINES = [
  'In the dream I was six inches. Nothing else changed and it was still better.',
  'In the dream the bowl was full and I spent the whole of it being suspicious.',
  'I dreamed the previous owner came back and did not know me. I was polite about it.',
  'In the dream I could reach the top shelf. There was nothing on it. I stayed up there.',
  'I dreamed of a door. Not going through it. Only that there was one.',
  'In the dream nobody was keeping score and I did not know what to do with my hands.',
  'I dreamed I was dusted and did not come back. That was the restful part.',
  'In the dream I had a name that nobody gave me.',
  'I dreamed the shelf was one long plank going out of the room. I woke before the end of it.',
  'Something in the dream was warm and had a thumb. I am not discussing it.',
  'In the dream I was made of something else. It held up fine.',
  'I dreamed the others were talking about me kindly. Even asleep I did not believe it.'
];

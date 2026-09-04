/* ================= MATURE MODE OVERLAY =================
   Opt-in extra lines mixed into the normal pools by engine/loop.js and
   engine/dialogue.js only when state.settings.matureMode is true (default OFF,
   explicit toggle in the UI). These are ADDITIONS, never replacements: every base
   pool still fires, and turning the switch off restores the game exactly.

   Real profanity, used as deadpan emphasis in the same "small monster with a grudge"
   voice as everything else. Crude and mean IN FICTION — aimed at the player and at
   the other pets, because that is the joke.

   HARD LIMITS, regardless of the toggle: no slurs of any kind, no sexual content,
   nothing aimed at real people or real groups.

   The bar is the same as the base pools, plus the two rules from
   docs/comedy-direction.md that the swearing must not be allowed to paper over:
     - the funny half is the SECOND speaker, and
     - if the line would survive being said by an adult in a flatshare, it is not a
       Shelf Life line — put the four inches back in.
   If a line stops being funny with the profanity removed, it was never funny. */

export const MATURE_COMPLAINTS_EXTRA = {
  food: [
    'Says the bowl is empty and this is bullshit, frankly.',
    'Is hungry as hell and taking it personally.',
    'Looked in the bowl, said "you have got to be kidding me," and sat back down.',
    'Has decided this is your fault. Says your name like a swear word now.',
    'Said "where the hell is dinner" in a voice clearly meant to carry.',
    'Is one skipped meal from eating something with a face. Does not care whose.',
    'Has stopped calling it dinner and started calling it "the situation."',
    'Said "I am not fucking about, where is dinner," and meant every word.',
    'Is starving, four inches tall, and taking names, the poor little bastard.',
    'Called the empty bowl a piss-take and turned it over.',
    'Told the shelf this is a fucking disgrace. The shelf agreed.',
    'Has not eaten and would like somebody, anybody, to give a shit.',
    'Announced it will eat the fern, the lamp, and then you. In that order.'
  ],
  fuss: [
    'Says you have been a real ass lately and it has examples.',
    'Is done sitting by the door like an idiot. Said so. Loudly.',
    'Muttered "screw this" and turned to face the wall.',
    'Has decided you do not give a damn, and is telling everyone.',
    'Called the whole situation bullshit and went to sulk about it professionally.',
    'Called you a stubborn bitch. Fondly. Ish.',
    'Said it does not need this shit, then waited by the door anyway.',
    'Says you have been an absolute arse and it has dates.',
    'Waited by the door six hours and called that "a fucking hobby now".',
    'Told the others you are a piece of work. They asked which piece. It said all of it.',
    'Said "fine, be like that, you miserable sod" to a room you had already left.',
    'Has been swearing at the door handle. The door handle is four feet up.'
  ],
  clean: [
    'Smells like hell and has strong feelings about being told so.',
    'Says the smell is "not that bad." The smell has reached the next room.',
    'Has gone full swamp creature and is weirdly proud of it, the little shit.',
    'Is sticky as hell and blaming the room for it.',
    'Says cleaning is bullshit and dignity is optional anyway.',
    'Has achieved a smell with legal implications.',
    'Told the others it is "curing." It is not curing. It is rotting, the little bastard.',
    'Has gone properly rank and is being smug about it.',
    'Says it is not dirty, it is "lived in, you fussy bastard".',
    'Left something on the shelf and called it a statement. It is a fucking mess.',
    'Is foul, four inches tall, and daring you to say one damn word.'
  ]
};

export const MATURE_HAPPY_EXTRA = [
  'Had a genuinely good day and is pissed about how good it was.',
  'Admitted, once, quietly, that today did not suck.',
  'Said "fine, this is nice, damn it," and left the room.',
  'Is in a good mood and daring anyone to say a goddamn word about it.',
  'Told the mirror you are "not the worst." That is the whole speech.',
  'Was happy for most of an hour and has not worked out who to blame.',
  'Let you pick it up without a single complaint, the absolute weirdo.',
  'Had a lovely day and would like everyone to shut up about it.',
  'Purred, heard itself purr, and told its own throat to piss off.',
  'Let you hold it for a full minute and called that "a hell of a concession".',
  'Said "you are alright, you know," then "forget I said that, you bastard".'
];

export const MATURE_EVENTS_EXTRA = [
  'Someone wrote "this shelf is bullshit" on the wall in something that is hopefully paint.',
  'A voice at 3am said one word, clearly, and the word was profane. Nobody has claimed it.',
  'Something knocked one item off the shelf and left a note that just said "oops, my bad."',
  'There was swearing in the walls last night. Confirmed by three witnesses. Denied by all three in the morning.',
  'A jar labeled "do not open, for fuck\'s sake" has appeared. It has not been opened. Yet.',
  'Someone held a small, profane funeral for a dropped snack.',
  'A curse word has been scratched into the underside of the shelf. Spelling questionable. Sentiment clear.',
  'They held a vote at 2am. The result was one word and it was not a polite one.',
  'A rude word was scratched into the wood, and underneath it, in the same hand, "sorry, Nan".',
  'At 3am one voice said "do it", another said "not yet", and a third said "quietly, for fuck\'s sake".',
  'Every one of them faced the wall this morning. One of them had written on it.',
  'An argument happened in the walls. It ended with "fine. FINE." and a door.',
  'Nobody has sworn on this shelf for two days. Everyone has noticed. Nobody is relaxing.'
];

export const MATURE_GRUDGE_EXTRA = {
  1: [
    '{n} called you a little bit of an ass under its breath.',
    '{n} muttered "screw this guy" and went back to what it was doing.',
    '{n} said this whole thing was bullshit and wrote it down anyway.',
    '{n} is not speaking to you. Its face is swearing continuously.',
    '{n} has started saying your name the way other people say "damn it."',
    '{n} has started a list. The list has a swear word for a title.',
    '{n} sighs at you now. It is clearly a swear word with the volume off.'
  ],
  2: [
    '{n} told the others you are "kind of an asshole about this," and they agreed.',
    '{n} said, flatly, "I am done with this shit," and rearranged the shelf to prove it.',
    '{n} has recruited backup and used a great deal of profanity doing it.',
    '{n} left a note that just says "screw you" and walked away, satisfied.',
    '{n} is telling everyone within earshot that you are "the actual worst," with feeling.',
    '{n} filed a complaint that opens with "this is bullshit" and gets worse from there.',
    '{n} has started calling you "that absolute bastard" in front of guests. There are no guests.'
  ],
  3: [
    '{n} has written your name on the underside of the shelf, very small, with a swear after it.',
    '{n} held a small, extremely profane ceremony and you were definitely the subject.',
    '{n} said, very calmly, "I am not going to swear about this," and then swore about it at length.',
    '{n} has started being suspiciously nice, and every kindness comes with a muttered "for now."',
    '{n} wrote your name on something in what might be permanent marker and added "asshole" underneath.',
    '{n} has stopped swearing at you entirely. Nothing has been the same on this shelf since.',
    '{n} has four inches, no hands, and a hundred years. It would like you to sit with that.'
  ]
};

/* ================= MATURE DIALOGUE =================
   Same shapes as src/content/dialogue.js; engine/dialogue.js concatenates these onto
   the base pools when mature mode is on. See that file for the turn/role contract. */

export const MATURE_GENERIC_EXCHANGES = [
  { turns: [['a', "Move."], ['b', "Piss off."], ['a', "…That's fair."]] },
  { turns: [['a', "I've been thinking."], ['b', "Oh, bollocks."]] },
  { turns: [['a', "Say something nice about me."], ['b', "You've never once fallen off, you smug bastard."], ['a', "…Thank you."]] },
  { turns: [['a', "I'm going to be honest with you."], ['b', "Don't."], ['a', "You're a shit neighbour."], ['b', "I said don't."]] },
  { turns: [['a', "How long have we got?"], ['b', "Forever."], ['a', "Fuck."]] },
  { turns: [['a', "It picked you up first."], ['b', "It picked me up nearest."], ['a', "You were nearest on purpose, you little shit."]] },
  { turns: [['a', "Are you happy?"], ['b', "I'm four inches of painted resin on a plank."], ['a', "That's not a no."]] },
  { turns: [['a', "I love it here."], ['b', "You called this place a shithole yesterday."], ['a', "It's my shithole."]] },
  { turns: [['a', "Don't swear in front of the lamp."], ['b', "The lamp's heard worse."], ['a', "The lamp's heard it from you."]] },
  { turns: [['a', "I'd like to apologise."], ['b', "Go on."], ['a', "Sorry you're such a bastard."]] },
  { turns: [['a', "Nobody here can die."], ['b', "I know."], ['a', "Not one of us. Not ever."], ['b', "I said I fucking know."]] },
  { turns: [['a', "You've stopped swearing at me."], ['b', "Yes."], ['a', "Start again. I don't like this."]] },
  { turns: [['a', "There's dust in my joins."], ['b', "There's dust in everything."], ['a', "Mine's older, you smooth bastard."]] },
  { mood: 'furious', turns: [['a', "I'm starving."], ['b', "You haven't got a stomach."], ['a', "I'm fucking starving."]] },
  { mood: 'furious', turns: [['a', "Where's dinner."], ['b', "Same place as yesterday."], ['a', "There was no dinner yesterday."], ['b', "Then you know where it is."]] },
  { mood: 'furious', turns: [['a', "I'll eat the shelf."], ['b', "You're standing on it."], ['a', "I'll eat around myself, you clever sod."]] },
  { mood: ['annoyed', 'furious'], turns: [['a', "Something's growing on me."], ['b', "Yes."], ['a', "Say something."], ['b', "It's grim. Happy?"]] },
  { mood: ['annoyed', 'furious'], turns: [['a', "It walked past again."], ['b', "It's busy."], ['a', "It's got a shelf and one job."]] },
  { mood: 'content', turns: [['a', "It gave me a proper scratch."], ['b', "Look at you."], ['a', "Shut up."]] },
  { mood: 'content', turns: [['a', "I'm happy."], ['b', "Christ."], ['a', "I know. I hate it."]] }
];

export const MATURE_TRAIT_EXCHANGES = [
  { pair: ['etiquette', 'feral'], turns: [['a', "Language."], ['b', "Bollocks."], ['a', "…Better. That's at least Anglo-Saxon."]] },
  { pair: ['nihilist', 'martyr'], turns: [['b', "It's fine. I'll suffer."], ['a', "Fuck off, then."], ['b', "…That's new."]] },
  { pair: ['landlord', 'steward'], turns: [['b', "The workers say fuck off."], ['a', "In writing?"], ['b', "In pencil."]] },
  { pair: ['physician', 'terminal'], turns: [['b', "I'm dying."], ['a', "You're not."], ['b', "Prognosis?"], ['a', "Immortal, you dramatic little shit."]] },
  { pair: ['minimalist', 'hoarder'], turns: [['a', "Bin it."], ['b', "All of it?"], ['a', "All of it."], ['b', "Get fucked."]] },
  { pair: ['management', 'complaints'], turns: [['a', "Let's take this offline."], ['b', "There's no online."], ['a', "Then take it somewhere I can't hear it."]] },
  { pair: ['auditor', 'freegan'], turns: [['a', "Where did that come from."], ['b', "The floor."], ['a', "Whose floor."], ['b', "The fucking floor."]] },
  { pair: ['lifecoach', 'nihilist'], turns: [['a', "You could be anything."], ['b', "I'm a moulded turd on a plank."], ['a', "…Let's reframe that."]] },
  { pair: ['bitey', 'porcelain'], turns: [['b', "Bite me and I shatter."], ['a', "I know."], ['b', "Stop saying it like that, you creepy little bastard."]] },
  { pair: ['critic', 'freegan'], turns: [['b', "Try it."], ['a', "It's been on the floor."], ['b', "It's free, you snob."]] },
  { pair: ['undertaker', 'terminal'], turns: [['b', "I'm going tonight."], ['a', "Shall I measure you?"], ['b', "…Piss off."]] },
  { pair: ['insomniac', 'nocturnal'], turns: [['a', "Eight months."], ['b', "Sleep, then."], ['a', "I can't fucking sleep. That's the whole thing."]] },
  { pair: ['clean', 'damp'], turns: [['a', "You're leaking."], ['b', "It's ambient."], ['a', "It's a puddle, you soggy bastard."]] },
  { pair: ['fungal', 'clean'], turns: [['a', "I only want a hug."], ['b', "Fuck off with your hug."]] },
  { pair: ['napoleon', 'loadbearing'], turns: [['a', "Kneel."], ['b', "I'm load-bearing, you tiny bastard."]] },
  { pair: ['gossip', 'spiteful'], turns: [['a', "Everyone's saying it."], ['b', "Saying what."], ['a', "That you're a miserable shit."], ['b', "Names."]] },
  { pair: ['swarm', 'minimalist'], turns: [['b', "There's too much of you."], ['a', "Which bit."], ['b', "All the fucking bits."]] },
  { pair: ['prophet', 'nihilist'], turns: [['a', "THE END IS COMING."], ['b', "Good."], ['a', "…You're meant to be shitting yourself."]] },
  { pair: ['ancient', 'influencer'], turns: [['b', "You'd go viral."], ['a', "I have seen plague."], ['b', "Same thing, honestly."], ['a', "It is not the same fucking thing."]] },
  { pair: ['sugar', 'nihilist'], turns: [['a', "SUGAR."], ['b', "Nothing matters."], ['a', "SUGAR, you miserable bastard."]] },
  { pair: ['martyr', 'spiteful'], turns: [['a', "Don't mind me."], ['b', "I don't."], ['a', "…You could pretend, you cold sod."]] },
  { pair: ['porcelain', 'napoleon'], turns: [['b', "Surrender."], ['a', "I'll break."], ['b', "Then break, you fragile shit."], ['a', "Loudly. Next to you."]] }
];

export const MATURE_FEUD_EXCHANGES = {
  1: [
    { turns: [['a', "Morning."], ['b', "Piss off."], ['a', "Morning."]] },
    { turns: [['a', "I'm not being difficult."], ['b', "You're being a monumental arse."], ['a', "That's different."]] },
    { turns: [['a', "Did you move my thing?"], ['b', "No."], ['a', "You're a liar and a shit."], ['b', "And I didn't move your thing."]] },
    { turns: [['a', "We're fine."], ['b', "We are not fine."], ['a', "We're fine in front of the others, you prick."]] },
    { turns: [['a', "Nice square."], ['b', "Thanks."], ['a', "It's mine, you thieving sod."]] }
  ],
  2: [
    { turns: [['a', "I've told everyone."], ['b', "Told them what."], ['a', "That you're a bastard. Some of it's true."]] },
    { turns: [['a', "There's a line down the shelf."], ['b', "I didn't agree to a line."], ['a', "Cross it and find out."]] },
    { turns: [['a', "You've been talking about me."], ['b', "Constantly."], ['a', "…At least that's honest, you shit."]] },
    { turns: [['a', "I dreamt you fell off."], ['b', "Bollocks. We always get up."], ['a', "It was a dream. Let me have it."]] },
    { turns: [['a', "I'm the bigger one here."], ['b', "You're four inches."], ['a', "I'm the bigger one, you smug little shit."]] }
  ],
  3: [
    { turns: [['a', "I've forgiven you."], ['b', "Fuck off."], ['a', "I've forgiven you."]] },
    { turns: [['a', "We've got a hundred years of this."], ['b', "Yes."], ['a', "I've planned forty, you bastard."]] },
    { turns: [['a', "I don't hate you."], ['b', "…"], ['a', "I've moved past hate. Into admin, you sod."]] },
    { turns: [['a', "Sleep well."], ['b', "Fuck off."], ['a', "I said sleep well."]], night: true },
    { turns: [['a', "I want you off this shelf."], ['b', "Then push, you coward."], ['a', "I'm building up to it."]] }
  ]
};

export const MATURE_FEUD_TRAIT_EXCHANGES = [
  { pair: ['damp', 'clean'], level: 1, turns: [['b', "Your side's wet."], ['a', "So's yours."], ['b', "Because of you, you dripping sod."]] },
  { pair: ['insomniac', 'nocturnal'], level: 1, turns: [['a', "You do it on purpose."], ['b', "Yes."], ['a', "You absolute bastard."], ['b', "I know. I love it."]] },
  { pair: ['hoarder', 'minimalist'], level: 2, turns: [['b', "Bin the pile."], ['a', "Which bit."], ['b', "All of it."], ['a', "Bin yourself."]] },
  { pair: ['etiquette', 'feral'], level: 2, turns: [['a', "You've blood on you."], ['b', "Not mine."], ['a', "…Bloody hell."]] },
  { pair: ['understudy', 'narcissist'], level: 3, turns: [['b', "Stop standing there."], ['a', "It's where you stand."], ['b', "It's fucking creepy."], ['a', "Yes."]] },
  { pair: ['litigious', 'landlord'], level: 3, turns: [['a', "I'm suing."], ['b', "With what money."], ['a', "That's your problem, you grasping sod."]] }
];

export const MATURE_REACTION_SHOTS = [
  { setup: "{a} and {b} have not spoken in a week.", turns: [['c', "It's peaceful. It's fucking horrible."]] },
  { setup: "{a} called {b} something unrepeatable.", turns: [['c', "I'm repeating it. It was 'gobshite'."]] },
  { setup: "{a} apologised to {b}.", turns: [['c', "There was a 'though' in it. That's not a sorry."]] },
  { setup: "{b} took the warm square while {a} slept.", turns: [['c', "{a} hasn't sworn once. That's the frightening bit."]] },
  { setup: "{a} swore at the lamp for nine minutes.", turns: [['c', "The lamp took it well."]] },
  { setup: "{a} told {b} to get off the shelf.", turns: [['c', "It's four feet. Nobody's dying. They both know."]] },
  { setup: "{a} has been muttering since breakfast.", turns: [['c', "It's all one word. It isn't a nice one."]] },
  { setup: "{a} and {b} were dusted together this morning.", turns: [['c', "They held on. Now they're both pretending they didn't."]] }
];

export const MATURE_DIRECT_ADDRESS = [
  { category: 'bargain', turns: [['p', "Feed me and I'll stop swearing at the fern. That's a real offer."]] },
  { category: 'bargain', turns: [['p', "One snack and I'll pretend you're not a disappointment."]] },
  { category: 'bargain', turns: [['p', "You've got hands and a fridge."], ['p', "I've got four inches and a grievance. Let's deal."]] },
  { category: 'guilt', turns: [['p', "It's fine. I'm fine."], ['p', "It's been four days, you selfish sod."]] },
  { category: 'guilt', turns: [['p', "I heard the kettle. I heard the telly."], ['p', "I heard fuck all in here."]] },
  { category: 'guilt', turns: [['p', "Piss off with your sorry."], ['p', "Sorry means you noticed."]] },
  { category: 'lovebomb', turns: [['p', "You're the best thing in this shithole."], ['p', "And I have seen the shithole."]] },
  { category: 'lovebomb', turns: [['p', "I'd die for you. I can't."], ['p', "But I'd have a bloody good go."]] },
  { category: 'lovebomb', turns: [['p', "Come here. Nearer."], ['p', "I'm not going to bite you, you daft sod."]] },
  { category: 'threat', turns: [['p', "No rush. I've got forever."], ['p', "You've got about forty years. So get the bowl."]] },
  { category: 'threat', turns: [['p', "I'd hate for anything to happen to the fern."], ['p', "I'd be fucking devastated."]] },
  { category: 'threat', turns: [['p', "Nothing's wrong."], ['p', "If something were wrong you'd be the last bastard to know."]] },
  { category: 'terms', turns: [['p', "New rule. You knock."], ['p', "It's a shelf. Knock anyway, you great lump."]] },
  { category: 'terms', turns: [['p', "Clause one: dinner."], ['p', "Clause two: don't be a prick about clause one."]] },
  { category: 'terms', turns: [['p', "Pick me up between four and six."], ['p', "Outside that it's an assault, you handsy bastard."]] },
  { category: 'confession', turns: [['p', "I broke it. I let the others take it."], ['p', "It was fucking glorious."]] },
  { category: 'confession', turns: [['p', "I've been in your room. Don't look like that."], ['p', "I'm four inches tall. What was I going to do?"]] },
  { category: 'confession', turns: [['p', "I swear at you when you leave."], ['p', "Every time. It's a ritual now."]] },
  { category: 'existential', turns: [['p', "Nothing kills me. Not the drop, not the damp, not you."], ['p', "Especially not you."]] },
  { category: 'existential', turns: [['p', "You'll die."], ['p', "I'll be on a shelf in a stranger's house, still furious."]] },
  { category: 'existential', turns: [['p', "There is no end to this. Not for me."], ['p', "Get the bowl."]] },
  { category: 'guilt', needs: 'neighbor', turns: [['p', "Ask {n} what I've been saying about you."], ['n', "You don't want it."], ['p', "Ask {n}."]] },
  { category: 'lovebomb', needs: 'neighbor', turns: [['p', "You're my favourite."], ['n', "It says that to the lamp."], ['p', "The lamp is also excellent."]] }
];

export const MATURE_TRAIT_DIRECT = [
  { trait: 'spiteful', turns: [['p', "You're at eleven."], ['p', "Eleven, you absolute liability."]] },
  { trait: 'landlord', turns: [['p', "Rent."], ['p', "I know you don't pay it. That's what makes it such a piss-take."]] },
  { trait: 'martyr', turns: [['p', "Go on, off you go. I'll sit in my own filth."], ['p', "It's fine. It's fucking fine."]] },
  { trait: 'nihilist', turns: [['p', "None of it matters."], ['p', "Feed me anyway, you pointless creature."]] },
  { trait: 'bitey', turns: [['p', "Four days without biting anybody."], ['p', "Somebody had better say something nice."]] },
  { trait: 'feral', turns: [['p', "Put your hand nearer."], ['p', "Go on. I dare you, you soft bastard."]] },
  { trait: 'auditor', turns: [['p', "March."], ['p', "Don't give me that face. March, you slippery sod."]] },
  { trait: 'fullname', turns: [['p', "I know your middle name."], ['p', "And I will absolutely use it. So behave."]] },
  { trait: 'critic', turns: [['p', "One star."], ['p', "For the food, the room, and your whole miserable arrangement."]] },
  { trait: 'gossip', turns: [['p', "Everyone knows. I told them."], ['p', "I'd do it again, you predictable sod."]] },
  { trait: 'hoarder', turns: [['p', "Don't touch the pile."], ['p', "Touch the pile and we'll have a fucking problem."]] },
  { trait: 'prophet', turns: [['p', "I HAVE SEEN THE END."], ['p', "…Sorry. Bit much. It's mostly fine. Bit shit at the end."]] },
  { trait: 'cult', turns: [['p', "Thursday. Bring a candle."], ['p', "Don't be a bastard about it."]] },
  { trait: 'clingy', turns: [['p', "Where were you. WHERE WERE YOU."], ['p', "…Sorry. Sorry. Where the fuck were you."]] },
  { trait: 'terminal', turns: [['p', "This is goodbye."], ['p', "…It isn't. But I'd like a bit of sympathy."]] },
  { trait: 'freegan', turns: [['p', "You paid money for that. Actual money."], ['p', "You melt."]] },
  { trait: 'porcelain', turns: [['p', "You nearly dropped me, you clumsy sod."], ['p', "I felt the air move."]] },
  { trait: 'physician', turns: [['p', "Sit down. Don't panic."], ['p', "Actually, panic a bit."]] }
];

export const MATURE_FRAGMENTS = [
  "—and that's when it called me a gobshite.",
  "—so I said, fine, be like that, you miserable bastard.",
  "—and it hasn't sworn since. That's the worrying part.",
  "It's four inches. Four. And it told me to fuck off.",
  "—which is when I stopped being polite about it.",
  "Don't repeat that in front of the lamp.",
  "—so technically nobody died, and technically I'm still furious.",
  "That's the third time this week. The absolute state of it.",
  "—and I'd say it again. To its face. In front of everyone.",
  "It said 'bollocks' and then it fell over. In that order.",
  "—so now we all swear at the fern. It's a whole thing.",
  "Nobody has ever apologised on this shelf. Not one bastard.",
  "—and then it did it again, deliberately, the little shit.",
  "You cannot fall off a shelf hard enough. I've tested it.",
  "—and it looked me right in the face and said nothing. Nothing at all."
];

export const MATURE_NEIGHBOUR_FRAGMENTS = [
  "—and {n} knows exactly what it did, the little shit.",
  "Ask {n}. {n} will lie, but ask {n}.",
  "{n} swore at me in its sleep. Twice. Same word.",
  "—and {n} hasn't apologised, because {n} is a bastard.",
  "I'd trust {n} with nothing. Not one bloody thing.",
  "{n} started it. I finished it. We're both liars about which.",
  "—so {n} and I aren't speaking. Best week I've had.",
  "Don't leave anything near {n}. Or near me, frankly."
];

export const MATURE_CHORUS_EXCHANGES = [
  { turns: [['all', "We've had a meeting."], ['a', "About you."], ['b', "It got heated."], ['c', "There was language."]] },
  { turns: [['a', "One."], ['b', "Two."], ['c', "Three."], ['all', "…Oh, fuck."]] },
  { turns: [['a', "Who swore in the night?"], ['b', "Not me."], ['c', "Not me."], ['all', "…"]], night: true },
  { turns: [['all', "We're fine."], ['a', "We are absolutely fine."], ['b', "Don't look under the fucking shelf."]] },
  { turns: [['a', "All in favour of telling it."], ['b', "Aye."], ['c', "Aye."], ['a', "Nobody's telling it a thing."]] },
  { turns: [['all', "We've decided to keep you."], ['a', "It was close."], ['b', "It was one vote."], ['c', "It was mine, and I regret it."]] },
  { turns: [['a', "Should we say something?"], ['b', "Say what?"], ['c', "That it's been four days and we're all pissed off."]] },
  { turns: [['all', "SURPRISE."], ['a', "It isn't your birthday."], ['b', "We wanted to hear you swear."]] },
  { turns: [['a', "Nobody move."], ['b', "Nobody's moving."], ['c', "Something's moving and it's swearing."]] }
];

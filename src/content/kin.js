/* ================= KIN =================
   Foundlings (a resident born of two friends' residents) and the letters
   their residents write to each other across shelves.

   Everything here is canned. Letters are assembled on each device from these
   pools, so nothing a friend types ever appears in one. Placeholders:
     {to}     the resident the letter is addressed to
     {from}   the resident writing it
     {case}   the Shelf Court case the two were in (hearing pen pals)
     {child}  the reader's own name for the foundling the two share
   Lines are short on purpose: a letter is three or four of them. */

// "Lord Dampington III" is called Dampington by his children.
export const NAME_TITLES = ['lord', 'lady', 'sir', 'dame', 'mr', 'mrs', 'ms', 'miss', 'master', 'madam', 'doctor', 'dr', 'saint', 'st', 'old', 'little',
  'uncle', 'aunt', 'auntie', 'the', 'of', 'von', 'van', 'de', 'la', 'le', 'baby', 'young', 'big', 'small', 'junior', 'senior', 'jr', 'sr', 'esq'];
export const NAME_DRESSINGS = ['Little {n}', '{n} the Second', '{n} Junior', 'Young {n}', '{n} the Lesser', 'Small {n}', '{n} Minor', 'Baby {n}'];

export const BIRTH_OPENINGS = [
  'A basket was found on the step.',
  'A basket appeared on the step overnight, with air holes and no note.',
  'Something was left on the step in a hatbox lined with a tea towel.',
  'The step had a basket on it this morning. The basket had an opinion.',
  'A basket was found on the step, wrapped in a tablecloth that belongs to nobody here.',
  'There was a knock. Nobody was there. A basket was.',
  'Found on the step at dawn, in a shoebox marked “fragile, and spiteful.”',
  'A basket was left on the step with a note that just says “Good luck.”',
  'A basket turned up on the step with a receipt for something else.',
  'On the step this morning: one basket, one blanket, one small, unimpressed face.',
  'Somebody rang the bell and ran. They left a basket.',
  'The milk was not delivered this morning. A basket was.',
  'There was a basket on the step. The cat has not looked at anyone since.',
  'A basket was found on the step, tied with string from two different shelves.'
];
export const BIRTH_FEATURES = ['eyes', 'chin', 'ears', 'posture', 'laugh', 'way of sitting', 'sense of direction', 'handwriting', 'nose for trouble',
  'taste in lamps', 'sideways look', 'snore', 'appetite', 'knees', 'gift for silence', 'good side', 'walk', 'way with doors', 'singing voice',
  'fondness for corners', 'teeth', 'timing', 'eyebrows, somehow', 'way of eating soup'];
export const BIRTH_INHERITANCES = ['grievances', 'debts', 'alibi', 'list of enemies', 'unpaid fines', 'opinion of Tuesdays', 'suspicion of soup',
  'filing system', 'way of holding a grudge', 'fear of hats', 'legal team', 'temper', 'unfinished business', 'dramatic exits', 'taste in funerals',
  'outstanding warrants', 'way of looking at the door', 'criminal record', 'unshakeable confidence', 'theories about the moon', 'opinions about the lamp',
  'tendency to bite', 'objection to everything', 'feud with the skirting board'];

// How two residents came to know each other, for the screens.
export const HISTORY_LABELS = {
  hearing: 'Met in Shelf Court', foundling: 'Parents of the same foundling', twin: 'Two copies of the same foundling',
  introduced: 'Introduced by their people', letters: 'Already pen pals', friends: 'A week of friendship',
  visit: 'One visited the other', trade: 'Traded once', hex: 'Hexed, and forgave', hire: 'Went on an expedition together'
};

/* ---------------- letters ----------------
   An opening (any mood, or the writer's mood), a middle about what the two
   have been through, a sign-off, the writer's name, and a P.S. last, because
   the P.S. is where the truth comes out. */
export const OPENINGS = [
  { mood: 'any', text: 'I hope this finds you, and that it took a while.' },
  { mood: 'any', text: 'Your last silence was received and filed.' },
  { mood: 'any', text: 'I am writing from the second plank, where the light is better and the company is worse.' },
  { mood: 'any', text: 'Nothing has happened here since my last letter, and I want that on record.' },
  { mood: 'any', text: 'I have been meaning to write. I have also been meaning to stop meaning things.' },
  { mood: 'any', text: 'Forgive the handwriting. I am writing on the lid of something that is not a box.' },
  { mood: 'any', text: 'I counted to a hundred before starting this letter. It seemed to help, and then it did not.' },
  { mood: 'any', text: 'It has rained on this side of the shelf, which means someone has spilled something.' },
  { mood: 'any', text: 'I write at the hour when the lamp makes everyone look guilty.' },
  { mood: 'any', text: 'Let me begin by saying I am well, which is a lie, and that I miss you, which is a smaller lie.' },
  { mood: 'any', text: 'This is my fourth draft. The other three were too honest.' },
  { mood: 'any', text: 'I trust you are as you were, give or take a grievance.' },
  { mood: 'any', text: 'Someone here asked who I was writing to. I said “a colleague.” They have not stopped asking since.' },
  { mood: 'any', text: 'I have found a pencil. I am using it before somebody notices.' },
  { mood: 'any', text: 'Greetings from a shelf where the dust has formed a committee.' },
  { mood: 'any', text: 'I am writing this by the light of a candle I was told not to touch.' },
  { mood: 'any', text: 'A moth delivered your last letter, or ate it. Either way, I got the gist.' },
  { mood: 'any', text: 'It is Tuesday here, or it is not. Nobody wears a watch on this shelf except the skull, and he will not say.' },
  { mood: 'any', text: 'I was going to write sooner, but I was in a mood, and the mood was in me.' },
  { mood: 'any', text: 'I have kept your letters in a drawer with my other evidence.' },
  { mood: 'any', text: 'First, the weather: a draught from the left, and opinions from the right.' },
  { mood: 'any', text: 'I am told letter writing is good for the soul. I am checking whether I have one.' },
  { mood: 'any', text: 'Please excuse the smudge. It is jam, mostly.' },
  { mood: 'any', text: 'Your name came up today. I let it.' },
  { mood: 'any', text: 'Our person went out this morning in a hat. We are still discussing the hat.' },
  { mood: 'any', text: 'I write to you with my good hand. With the other hand I am holding a grudge.' },
  { mood: 'any', text: 'There is a crack in the plank shaped like a question. I have been answering it all week.' },
  { mood: 'any', text: 'It is late. The fern is asleep. This is the only privacy I get.' },
  { mood: 'any', text: 'I hope the post finds you before anything worse does.' },
  { mood: 'any', text: 'A small spider has moved in above me. I have named it after you. It has not earned that.' },
  { mood: 'any', text: 'I sat down to write you something short and sincere, and I have managed short.' },
  { mood: 'any', text: 'Here is the news, in the order I care about it.' },
  { mood: 'any', text: 'Sorry this letter is late. It was ready on time, but I was not.' },
  { mood: 'any', text: 'I have had a week. Not a good one or a bad one. Just one, in full.' },
  { mood: 'any', text: 'Your shelf sounds very far away, which I find restful.' },
  { mood: 'any', text: 'I licked the envelope before writing the letter. Things are out of order here.' },
  { mood: 'any', text: 'Somebody has been reading my diary, so I am writing to you instead.' },
  { mood: 'any', text: 'The undertaker came by. Professional interest only, he said, while measuring.' },
  { mood: 'any', text: 'I found your last letter under the bowl. It had been there all along, judging me.' },
  { mood: 'any', text: 'I meant to keep this brief. That plan did not survive the first sentence.' },
  { mood: 'content', text: 'I am in an excellent mood, which has frightened everyone here.' },
  { mood: 'content', text: 'I have been fed, fussed and dusted, in that order, which is the correct order.' },
  { mood: 'content', text: 'Things are good. I am trying not to make a habit of it.' },
  { mood: 'content', text: 'I am happy, if you can believe it. Nobody here can.' },
  { mood: 'content', text: 'I woke up content this morning and have been carrying it around carefully, like soup.' },
  { mood: 'fine', text: 'I am fine, in the official sense.' },
  { mood: 'fine', text: 'I am, as they say, fine. I have looked into who says it.' },
  { mood: 'fine', text: 'Things are about the same, which is what I asked for.' },
  { mood: 'fine', text: 'Nothing to report, and I report it gladly.' },
  { mood: 'fine', text: 'I am neither up nor down this week. I am along.' },
  { mood: 'annoyed', text: 'I am writing because the alternative was biting someone.' },
  { mood: 'annoyed', text: 'Somebody moved my spot by an inch. I will be writing about that separately.' },
  { mood: 'annoyed', text: 'I am annoyed. I will not say at whom. You can guess, and you will be warm.' },
  { mood: 'annoyed', text: 'Everyone on this shelf is breathing too loudly this week.' },
  { mood: 'annoyed', text: 'I have been patient for nearly an hour, which is a personal record.' },
  { mood: 'furious', text: 'I am writing this with my teeth clenched, which is why the letters lean.' },
  { mood: 'furious', text: 'I am furious. Not with you. Not yet.' },
  { mood: 'furious', text: 'I have been neglected, and I have kept notes, and the notes have notes.' },
  { mood: 'furious', text: 'Forgive the tone. I have not been fed since the Restoration.' },
  { mood: 'furious', text: 'Everything is terrible and I wanted you to hear it from me first.' }
];

export const MIDDLES = {
  hearing: [
    'I still think about {case}. I was right, and the jury was asleep, which is not the same as being wrong.',
    'I have had the transcript of {case} framed. I come out of it well if you skip the middle.',
    'No hard feelings about {case}. The feelings I have are medium at most.',
    'I bumped into the bailiff. He sends his regards and an invoice.',
    'I have reread my closing statement from {case}. It still makes me cry, and I am the only one.',
    'The studio audience still writes to me about {case}. One of them is the ghost who coughs.',
    'I have appealed {case} to a higher shelf. There is no higher shelf. I am waiting anyway.',
    'Judge Mortis winked at me during {case}. I have decided it meant something.',
    'Whatever was said in {case}, and it was mostly you, I hold no grudge. I hold several small ones.',
    'Our hearing is now a family story here. In this version I win and you apologise.',
    'I have been practising objecting in the mirror. The mirror has stopped taking my calls.',
    'If {case} goes to a retrial, I am bringing better shoes and a witness who can blink.',
    'I keep the sound of the gavel in my head, for when I need to end a conversation.',
    'My lawyer says I cannot discuss {case}. My lawyer is a teaspoon, so I am discussing it.',
    'The jury from {case} still argue about it at night. I can hear them through the plank. Two of them are me.',
    'I have had {case} embroidered on a cushion. I sit on the side that mentions you.',
    'The cat walked across the bench during {case}. I have since learned the cat was paid.',
    'I bear you no ill will for {case}. I bear you a medium amount, and I carry it well.'
  ],
  foundling: [
    '{child} said its first word. It was “no.” I said that was yours. Nobody laughed.',
    '{child} is growing, mostly sideways. It has your knack for taking up room.',
    '{child} bit the lamp. I told it you would be disappointed. It bit the lamp again, more thoughtfully.',
    'I found {child} reading the will. It asked where its name was. I said “pending.”',
    '{child} asks about you. I say you are on another shelf, doing important work. Do not prove me wrong.',
    '{child} has started a list. I recognise the handwriting. It is yours, somehow.',
    'We should discuss {child}’s education. At present it is learning everything from the fern.',
    '{child} sleeps in the bowl now. I have stopped trying. You would have stopped sooner.',
    '{child} drew a picture of our family. You are the one with too many teeth. It was not wrong.',
    'I caught {child} practising your face in the mirror. It has the frown down.',
    'Nobody here believes {child} came in a basket. I have told them the truth, which makes it worse.',
    '{child} wants to know if it is adopted. I said “in a sense.” It has been quiet since.',
    '{child} has learned to hide. We do not know where. We hear it laughing at mealtimes.',
    'I have started a small fund for {child}’s future. It is a button. It is a good button.'
  ],
  twin: [
    'They tell me we came from the same basket. I have no memory of you, which I find suspicious.',
    'Are you also called {to}? I am. One of us is the original, and I have a feeling.',
    'My person says you are my twin. I have been looking in mirrors to see if you are in there.',
    'I bit the lamp today. Did you? I need to know if it is me or if it is us.',
    'I hear you have a nicer shelf. I am not jealous. I have written “not jealous” on a small card and I look at it.',
    'Somebody here called me by your name by accident. Except it is my name. We need to talk about this.',
    'They say we have the same eyes. I have checked, and mine are better kept.',
    'I keep half of everything for you, then eat it. I wanted you to know about the first part.',
    'I dreamt I was on your shelf and you were on mine and nobody noticed. I woke up angry for both of us.',
    'Do you also hate the colour of the third plank? I do not know what my third plank is. I hate it anyway.',
    'Does your person also call you “the little one”? I am the same size as everyone. I want this stopped on both shelves.',
    'If we ever meet, let us agree in advance not to compare. I will win, and it will be awkward.'
  ],
  introduced: [
    'Our people arranged this correspondence. I assume they want something. I am keeping my letters vague.',
    'I was told to be polite to you. This is me being polite. I want credit.',
    'I still do not know why we are pen pals. I have decided it is a scheme, and that I am in on it.',
    'My person reads your letters over my shoulder and laughs at the wrong bits.',
    'You are my first pen pal. I am told this is meant to broaden me. I am as broad as I intend to get.',
    'I have shown your letters to the others. They agree you seem real.',
    'I have started signing my letters with a flourish. It took eleven attempts and a shirt.',
    'Everyone here asks what you are like. I say “distant,” and I leave it there, because it is literally true.',
    'I do not know what our people see in this arrangement. I see a stamp, and I want more stamps.',
    'This is my weekly letter. I was told weekly. Nobody said how long, so this is it.',
    'You seem nice, which worries me. Nobody nice writes back this regularly.',
    'Our people are friends, which makes us colleagues, which makes this a work letter. I have billed it accordingly.'
  ],
  visit: [
    'I still think about my stay on your shelf. Your plank has a soft spot I have told nobody about.',
    'Thank you again for having me. I took nothing, except a button, which I am returning in a later letter.',
    'Since I came back from your shelf, mine feels smaller. I have been measuring it out of spite.',
    'Your neighbours were very welcoming. One of them followed me home. It lives in my ear now.',
    'I told everyone here about your shelf. I may have added a fountain.',
    'When I visited, I noticed the lamp on your side leans left. I have been leaning left in solidarity.'
  ],
  trade: [
    'The curio from our trade has settled in. It hums at night. Was it humming before? Be honest.',
    'I have been told I got the better end of our trade. I have been told this by me.',
    'I keep the thing you traded me on a little stand. It does not deserve the stand, but nobody else would have it.',
    'I would trade with you again, but I am still recovering from the first time.',
    'Our trade has been entered in the ledger here, under “mistakes, mutual.”',
    'The item you sent arrived with a smell that has outlasted the item.'
  ],
  hex: [
    'I forgive you for the hex. It has worn off, except for a small itch I now consider part of my personality.',
    'That curse you sent was very well made. I admired it all the way through.',
    'I am sending the hex back, gently used.',
    'Since the hex, the fern will not look at me. Tell your person it was worth it, and that I will be in touch.',
    'Thank you for the prank. Nobody here had laughed in weeks, and they still have not, but there was a sound.',
    'The emergency you caused was handled with great dignity. I had none at the time. I have since found some.'
  ],
  hire: [
    'Our expedition still comes up. In my telling, I carried you. In yours, I expect you lie.',
    'I have kept my share of the expedition loot. It is a nail. I treasure it.',
    'The road we took together is still on my mind, and in my boots.',
    'If you need a hand on your next expedition, I have two, and one of them is clean.',
    'The expedition taught me a lot about myself. I would like to unlearn some of it.',
    'I still have the map from our trip. I have improved it by drawing a door where there was no door.'
  ],
  any: [
    'I have been thinking about what you said in your last letter. I disagree, but I agree with the stamp.',
    'Ours has a new noise in the wall. We have given it a name and a small allowance.',
    'I am sending you a pressed moth. It was not pressed on purpose. It is still a gift.',
    'Somebody here asked what you are like. I said “a lot,” and they nodded like they knew.',
    'I have been reading. Mostly the backs of things. I know a great deal about cereal now.',
    'We had a funeral for a raisin on Thursday. Nobody cried, but the raisin had not been popular.',
    'Our person tried to clean my corner. I have filed a report. You would have done the same.',
    'The lamp went out on Wednesday and everybody confessed to something. I confessed to nothing. I was ready.',
    'I have taken up knitting. Nothing yet, but I have unravelled a sock with real confidence.',
    'The fern here has grown a new leaf. Everyone is pretending it is about them.',
    'A coffin arrived last week. It was empty, which disappointed some of us more than others.',
    'There was a disagreement about the window. The window won.',
    'I have been elected to a position here. I do not know which, and I am afraid to ask.',
    'We held a vote on whether you are real. It was close. I abstained, to keep you guessing.',
    'I learned a new word this week. It is rude in a language nobody here speaks, so I use it freely.',
    'The others want to know if you are coming to visit. I said you were busy. Please be busy.'
  ]
};

export const SIGNOFFS = [
  'Yours, with reservations,', 'Yours in arrears,', 'With a reasonable amount of regard,', 'Warmly, within limits,', 'Yours until further notice,',
  'Fondly, and under protest,', 'Yours, more or less,', 'With love, or something filed under it,', 'Sincerely, for once,', 'Regards, both kinds,',
  'Until the post fails us,', 'Yours from the second plank,', 'With the usual grievances,', 'Yours truly, terms and conditions apply,',
  'Affectionately, and I have a witness,', 'Respectfully, on paper,', 'In haste, and in a mood,', 'Your correspondent, under duress,',
  'Yours, damp but sincere,', 'Till next week, if we last,', 'With a firm handshake I cannot technically perform,',
  'Yours as ever, which is to say about the same,', 'With my best, which is not much this week,', 'Kindly, for now,',
  'Yours, in the dark, with a candle,', 'Ever yours, give or take a plank,', 'Cordially, through gritted teeth,',
  'Love from the shelf, and from me, separately,', 'Faithfully, mostly,', 'Yours, as long as the glue holds,',
  'With warm regards and a cold draught,', 'Yours, still here,', 'In friendship and minor litigation,', 'Yours, in no particular order,',
  'Signed, sealed and slightly licked,', 'With fondness and an itemised list,', 'Yours, before anyone notices,', 'With great restraint,',
  'As ever, and against advice,', 'Yours, and nobody else’s, legally,'
];

// The P.S. a resident's quirks make it write. One per trait it has; the
// letter rotates through them.
export const TRAIT_PS = {
  spiteful: 'You are on a list. It is a good list, for now.',
  damp: 'If this letter is damp, that is me. It is not tears. Do not write back about the tears.',
  management: 'Let us circle back on this next week. Put something in the diary. Your diary. I do not have one.',
  loadbearing: 'I had to put the shelf down to write this. It held, but only just.',
  haunted: 'My ghost says hello. My ghost says a lot of things. I have stopped passing them on.',
  theatrical: 'I left the room after writing this. Then I came back in, so you would know I had left.',
  nocturnal: 'Written at three in the morning. If any of it sounds unhinged, that is the hour, not me.',
  magpie: 'If you are missing a small shiny thing, it is not here. It is somewhere near here.',
  unblinking: 'I watched you read this. Well, I imagined it. I did not blink either way.',
  sugar: 'The envelope tastes of nothing. I checked. Twice.',
  complaints: 'A copy of this letter has been filed, with a complaint about the paper.',
  terminal: 'This may be my last letter. It may also not be. Keep the good stationery ready.',
  clean: 'I washed this letter before sending it. You are welcome.',
  feral: 'Sorry about the bite mark. It is how I seal things.',
  cult: 'Have you thought about joining something? Nothing in particular. Just joining, generally.',
  doom: 'I would not get too comfortable. I am not saying why. I am saying it in writing.',
  clingy: 'I will be thinking about you until I hear back. Write back. Write back. Write back.',
  taxidermy: 'How are your proportions? No reason. Just keeping notes.',
  amnesiac: 'Remind me who you are. I liked this letter, so I assume I like you.',
  gossip: 'I have heard something about your shelf. I will tell you next week if you tell me something first.',
  ancient: 'In my day, letters were carried by a man with a bell. He was not reliable either.',
  glitter: 'If glitter falls out of this letter, I am sorry. It falls out of me too.',
  litigious: 'Nothing in this letter is an admission of anything.',
  narcissist: 'Enough about you. Next week, more about me.',
  paranoid: 'Burn this. Or keep it somewhere very normal, where nobody would think to look.',
  influencer: 'If you mention me on your shelf, use my good side. I have drawn an arrow to it.',
  landlord: 'Your room on my shelf is still available. Rent has gone up.',
  hoarder: 'Please send the envelope back. I am collecting them.',
  martyr: 'Do not worry about writing back. I will just wait here. It is fine. I am used to it.',
  revisionist: 'Last week’s letter never happened, and if it did, it said something nicer.',
  cryptid: 'If anyone asks, you have not seen me. You have only read me. That is different.',
  closer: 'This offer of friendship expires on Friday. Act now.',
  doomscroll: 'Have you heard the latest? It is bad. I will not say what. That is part of how bad.',
  freegan: 'The stamp was free. I found it on another letter. That letter is now going nowhere.',
  astrology: 'Your stars this week: a letter arrives. Mine are always right.',
  witness: 'I saw what happened on your shelf on Tuesday. I am not going to bring it up. I just have.',
  steward: 'Writing this letter was unpaid labour. I have registered a dispute with myself.',
  critic: 'Your last letter: three stars. Strong opening. The middle sagged.',
  napoleon: 'Next week I will be writing to you as Emperor. Address me accordingly.',
  prophet: 'I foresee a reply. Do not prove me wrong. It undermines the whole operation.',
  cursed: 'If anything goes wrong after reading this, that is a coincidence. Probably.',
  socialite: 'I am hosting something on Thursday. You are not invited, but you are mentioned.',
  minimalist: 'This letter was too long. I have already thrown out half of it, the good half.',
  timeshare: 'Have you considered a fortnight on our shelf each year, for life? Do not answer now.',
  nihilist: 'None of this matters. Write back anyway.',
  method: 'I am preparing for a role as a letter. This is research.',
  undertaker: 'I have taken your measurements from memory. Purely professional.',
  mourner: 'If anyone on your shelf dies, I am available, with references.',
  understudy: 'If you are ever too ill to write, I know your letters by heart. I could do them.',
  executor: 'You are in my will. Do not get excited. You get the pencil.',
  heirloom: 'I am very valuable and I am writing to you anyway. Remember that.',
  bones: 'If you lose any bones, send them to me. I will keep them in a nice order.',
  swarm: 'We all say hello. There are more of us than when we last wrote.',
  fullname: 'That is all for now, {to}. I mean that formally, and in full.',
  auditor: 'I have checked your last letter. Two of the sentences do not add up.',
  insomniac: 'I have not slept since your last letter. Not because of it. It just happened in that order.',
  reflection: 'I tried to write this in a mirror. It came out backwards and I meant every word.',
  etiquette: 'A reply within the week is customary. A reply within the hour is showing off.',
  hummer: 'I hummed while writing this. Hold it to your ear. You will not hear it, but it is in there.',
  lifecoach: 'You can do anything you set your mind to. Except that. Not that.',
  sleepwalker: 'I do not remember writing this letter. I do remember the stamp tasting of glue.',
  bitey: 'I bit the corner of this. Not hard. A sort of greeting.',
  fungal: 'If something is growing on this letter, it is a gift. Water it.',
  porcelain: 'Handle this letter carefully. I did.',
  physician: 'Your handwriting suggests a vitamin deficiency. Eat a leaf.'
};
export const GENERAL_PS = [
  'The fern sends its regards. The fern has never sent its regards. Something is wrong with the fern.',
  'I forgot what I was going to say. It was important. It will come back to me at a funeral.',
  'Burn after reading. Or do not. I have kept a copy.',
  'If you see a small grey spider, do not engage. It knows what it did.',
  'There is no P.S. I just like having the last word.',
  'I have enclosed nothing. Look again. Still nothing. That is the enclosure.',
  'Somebody has been eating the stamps. It is not me. I have an alibi and a stomach ache.',
  'Do not tell your person about the button.',
  'I have been told I write the way I talk. I do not talk. Make of that what you will.',
  'This letter will destroy itself in forty years. It is very slow paper.',
  'Please return the pencil if it ends up there. It walks.',
  'The lamp asked about you. I said nothing. The lamp has been odd since.'
];

/* ---------------- replies ----------------
   Three options, one of each tone. A resident with a quirk that has its own
   reply puts it in place of the dry or the petty one. */
export const REPLIES = {
  warm: [
    'Your letter arrived and I read it twice, once to myself and once to the lamp.',
    'I have put your letter under my pillow. I do not have a pillow. It is under me.',
    'Thank you for writing. It was the best thing that happened this week, and a moth died in the bowl.',
    'I laughed at your letter. Quietly, so nobody would think I was happy.',
    'Your letter smelled of your shelf. I have decided that is a compliment.',
    'Write again soon. Nothing has happened here and I need something to hold.',
    'I agree with everything you said, and with some things you did not say.',
    'I have kept your letter with my important things: a button and a grudge.',
    'You are my favourite resident on another shelf. The competition is thin, but you are winning it.',
    'I read your letter aloud. The others pretended not to listen. They were listening.',
    'Your news cheered me up, which I resent, but I am grateful.',
    'I miss you the way you miss a tooth: constantly, with your tongue.',
    'Thank you. I will be thinking of you, at a respectful distance.',
    'I have pinned your letter up where the draught can read it too.',
    'It is good to hear from you. It is good to hear anything that is not the wall.',
    'I have started looking forward to Mondays, because of you. Please stop. It is unnatural.',
    'Your letter made me feel something. I have put it in a jar.',
    'Everything you write is a little better than the truth. Keep going.',
    'I am glad you wrote. I was beginning to think I had made you up.',
    'Received with thanks and a small, private smile that nobody saw.'
  ],
  dry: [
    'Received. Read. Noted.',
    'Your letter arrived. It was a letter.',
    'Thank you for your letter of this week. I have nothing to add except this sentence.',
    'I have read your letter and I have no further questions at this time.',
    'Nothing to report. Please confirm receipt of nothing.',
    'Letter acknowledged. Feelings to follow, under separate cover.',
    'Your handwriting has improved. The content has not.',
    'I have read it. I am choosing not to have a reaction.',
    'Understood. I will now continue as before.',
    'Thank you for the update. Please keep me informed, but less.',
    'I have filed your letter under “letters.”',
    'Interesting. I will be thinking about it for nearly a minute.',
    'This is my reply. I hope it meets your expectations, which I assume are low.',
    'Got it. Keep it up. Or do not. I am easy.',
    'Your letter was the correct length. I respect that.',
    'Yes.',
    'I have nothing to say, and I wanted to say it properly.',
    'Noted, with the usual amount of interest.',
    'I read your letter in one sitting. I was already sitting.',
    'All received in good order, apart from the tone.'
  ],
  petty: [
    'I notice you did not ask how I was. I was fine. Now I am noting it.',
    'Your letter was shorter than mine last week. I have measured.',
    'I see what you did in the second sentence. I will not say what. I will remember.',
    'Lovely letter. I have corrected the spelling and I am sending it back.',
    'You spelled my name right this time. I am choosing to treat that as an apology.',
    'I have decided to forgive you for something. I will tell you what when you least expect it.',
    'You used a full stop where a kinder correspondent would have used a comma.',
    'My letters arrive on time. I just wanted to say that, for no reason.',
    'Thank you for the letter. I have added it to the file.',
    'I am replying promptly, which is more than some residents manage.',
    'I would answer your question, but you did not ask one, did you.',
    'Your stamp was crooked. I let it go. I am telling you that I let it go.',
    'I have shown your letter to the others. They agreed with me about it.',
    'Very interesting. Mine was more interesting, but this was very interesting.',
    'I see your shelf is doing well. Good. Good for your shelf.',
    'No need to write back so soon. I mean that politely, and also as a warning.',
    'Your letter smelled faintly of somebody else’s shelf. I am not asking. I am noting.',
    'I enjoyed your letter, apart from the beginning, the middle and the part where it ended.',
    'Kind of you to remember me. It took you a week.',
    'I have kept your letter, as evidence.'
  ]
};
export const TRAIT_REPLIES = {
  spiteful: 'I have read your letter and put you back on the list, near the top, where you belong.',
  litigious: 'My solicitor has advised me not to reply. I am replying to annoy my solicitor, who is also me.',
  complaints: 'Your letter has been received and a complaint about it has been opened. Reference number to follow.',
  theatrical: 'I read your letter by candlelight, then blew the candle out, for effect. Nobody saw. It still counted.',
  terminal: 'Thank you for writing. I may not live to reply properly, but I will try to linger.',
  gossip: 'I have told everyone what you said. I added a bit at the end. It is better now.',
  critic: 'Your letter: two stars. One for effort, one for the stamp.',
  nihilist: 'Your letter meant nothing, like everything. I read it twice.',
  martyr: 'No, do not trouble yourself to write more often. I will manage. I always do.',
  doom: 'I enjoyed your letter. Enjoy it while you can. That is all I am saying.',
  napoleon: 'Your letter has been received by His Small Majesty, who is me, and who is pleased.',
  magpie: 'Thank you for the letter. Is there anything shiny on your shelf? Asking for nobody.',
  narcissist: 'Your letter reminded me of me, which is the highest compliment I give.',
  landlord: 'Thank you for your letter. Please note your account with me remains overdue.',
  auditor: 'I have reviewed your letter. There is a discrepancy of one feeling.',
  etiquette: 'Thank you for your kind letter, which I shall answer properly once I find a fresh nib and a better mood.',
  cult: 'We read your letter at the meeting. You are in the minutes, favourably, for now.',
  paranoid: 'Who else has read your letter? Do not answer that in writing.',
  feral: 'I chewed your letter. It was a compliment. It is how I read.',
  clingy: 'Write back. Write back. Write back. That is my reply. It is a strong reply.',
  amnesiac: 'Thank you for your letter. Who are you? I liked it either way.',
  prophet: 'I knew you would write. I wrote this reply last week.',
  sugar: 'Your letter did not come with sweets. I have read it anyway, as a favour.',
  heirloom: 'Thank you for your letter. I have had it valued. Do not ask.',
  haunted: 'My ghost read your letter first. It liked it. I liked it less, but I am alive.',
  ancient: 'In my youth, we replied by carving it in stone. Here is a reply. It is lighter.'
};
export const REPLY_SIGNOFFS = ['Yours,', 'Regards,', 'Until next week,', 'Briefly,', 'As ever,', 'With a nod,', 'Yours, still,', 'Fondly, roughly,',
  'From the shelf,', 'In haste,', 'Pointedly,', 'Kindly,'];
export const REPLY_TONES = ['warm', 'dry', 'petty'];
export const TONE_LABELS = { warm: 'Fond', dry: 'Dry', petty: 'Petty' };

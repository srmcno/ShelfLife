/* ================= SHELF COURT =================
   A daytime small-claims TV show, filmed live on the shelf. You play Judge
   Mortis. Two residents sue each other over something petty; the rest of the
   shelf sits in the jury box; a studio audience of ghosts reacts to
   everything; Bailiff Rattigan (a rat) keeps order, badly.

   Each case: opening statements, then you pick three of six questions. Some
   questions turn up a clue (a line in your case notes), some are zingers
   that play to the audience, and some set off a scene. Then you rule: for
   the plaintiff, for the defendant, or "you're both idiots". One of those is
   the truth, and the clues point at it. Rule against the one who was right
   and they will remember it.

   Lines are [speaker, text] or ['npc', text, castId]. Speakers: judge,
   bailiff, p (plaintiff), d (defendant), announcer, audience, jury,
   narrator, npc. {p} and {d} are the parties, {j} a random juror.
   Writing rules: petty, dark, specific, and never an em dash. */

export const COURT_CAST = {
  judge: { name: 'Judge Mortis', art: 'judge' },
  bailiff: { name: 'Bailiff Rattigan', art: 'rat' },
  woodlouse: { name: 'Geoffrey the Woodlouse', art: 'woodlouse' },
  geoffrey2: { name: 'Geoffrey the Second', art: 'woodlouse2' },
  moth: { name: 'Madam Moth', art: 'moth' },
  lamp: { name: 'The Lamp', art: 'lamp' },
  cat: { name: 'Sir Reginald Whiskers', art: 'cat' },
  ghost: { name: 'Inspector Wispley', art: 'ghost' },
  uncle: { name: 'Uncle', art: 'uncle' },
  raven: { name: 'The Raven', art: 'raven' },
  widow: { name: 'Mrs Widow', art: 'widow' },
  susan: { name: 'Susan', art: 'susan' }
};
// Who fills empty jury seats, and who stands in when there is only one resident.
export const JURY_EXTRAS = ['woodlouse', 'susan', 'uncle', 'widow', 'raven', 'lamp', 'moth', 'cat', 'geoffrey2', 'ghost'];
export const STAND_INS = ['woodlouse', 'cat', 'susan', 'widow', 'raven', 'uncle'];
export const QUESTIONS_PER_EPISODE = 3;
export const RULINGS = ['plaintiff', 'defendant', 'both'];

export const COURT_CASES = [
  {
    id: 'borrowed-coffin', title: 'The Borrowed Coffin', truth: 'plaintiff',
    claim: '{p} is suing {d} for one coffin, lent for “a nap”, returned with a stranger in it.',
    asking: '40 souls, and a coffin with nobody in it',
    plaintiff: [
      ['p', 'I lent {d} my coffin for a nap. One nap. It came back with a man in it.'],
      ['p', 'His name is Keith. I know that because it is written on his hand. In {d}’s handwriting.'],
      ['judge', 'And what do you want, {p}?'],
      ['p', 'My coffin, Keith-free. And forty souls for every night I have lain awake wondering if Keith is comfortable.']
    ],
    defendant: [
      ['d', 'It was a nap, Your Honour. It is still a nap. It is just a very long nap.'],
      ['d', 'Keith needed it more. Keith had a terrible Tuesday. His last one.'],
      ['judge', 'So you lent out a coffin that was not yours. To a Keith.'],
      ['d', 'When you say it, it sounds bad. When I say it, I am a hero.']
    ],
    questions: [
      { ask: 'Ask {d} where Keith came from.', clue: '{d} found Keith face down in the garden and moved him into {p}’s coffin without asking.', lines: [
        ['d', 'The garden. Face down. In the mint.'],
        ['judge', 'Keith was dead in the mint.'],
        ['d', 'Keith was resting in the mint. Now Keith is resting indoors. I upgraded Keith.']] },
      { ask: 'Ask {p} to prove the coffin is theirs.', clue: 'The coffin has {p}’s name on the lid, {p}’s teeth marks on the handle and a little shelf for one raisin.', lines: [
        ['p', 'My name is on the lid. My teeth marks are on the handle. There is a little shelf inside where I keep one raisin.'],
        ['bailiff', 'I can confirm there is a little shelf, Your Honour.'],
        ['judge', 'And the raisin, Bailiff?'],
        ['bailiff', 'I can confirm there is a little shelf.']] },
      { ask: 'Tell {d} that “a nap” is not a legal term.', sass: true, lines: [
        ['judge', '{d}. “Nap” is not a legal term. Neither is “basically family”, “he looked cold” or “finders keepers”.'],
        ['d', 'What about “oops”?'],
        ['judge', '“Oops” is a confession. Say it again. Slowly. For the jury.'],
        ['d', 'No.']] },
      { ask: 'Ask {d} if Keith has any family.', clue: 'There is now a second Keith, Keith’s cousin, in {p}’s sock drawer. {d} put him there.', happen: 'outburst', party: 'p', lines: [
        ['d', 'A cousin. Also Keith. He came round asking for Keith, and I panicked.'],
        ['judge', 'Where is the second Keith, {d}?'],
        ['d', '{p}’s sock drawer.'],
        ['p', 'I HAVE BEEN WEARING THOSE SOCKS.']] },
      { ask: 'Ask {p} where it slept during the nap.', lines: [
        ['p', 'On the bare shelf. No lid. No pillow. The moth watched me all night.'],
        ['judge', 'That sounds awful.'],
        ['p', 'The moth said it was the best night of her life.']] },
      { ask: 'Have the bailiff check on Keith.', lines: [
        ['narrator', '(The bailiff lifts the lid. He looks for a long time. He lowers the lid.)'],
        ['bailiff', 'Keith says hello, Your Honour.'],
        ['judge', 'Keith is dead, Bailiff.'],
        ['bailiff', 'He says that too.']] }
    ],
    rulings: {
      plaintiff: [
        ['judge', 'Judgment for {p}. You do not lend out what is not yours, and you do not fill it with Keiths.'],
        ['judge', '{d} pays forty souls, returns the coffin, and tells both Keiths, in person, that they have to leave.'],
        ['d', 'Where do the Keiths go?'],
        ['judge', 'Your slot. You love Keith so much.']],
      defendant: [
        ['judge', 'Judgment for {d}. Keith needed it more.'],
        ['p', 'KEITH ISN’T EVEN HERE.'],
        ['judge', 'Keith is exactly where Keith should be, {p}. Which is more than anyone can say for you.'],
        ['audience', '(A ghost at the back whispers “justice for Keith”. It catches on.)']],
      both: [
        ['judge', 'You are both idiots. {p}, never lend a coffin to anyone who says “nap” with that face. {d}, stop collecting Keiths.'],
        ['judge', 'The coffin goes to Keith.'],
        ['p', 'KEITH gets the coffin?'],
        ['judge', 'Keith is the only one in this case who has not lied to me.']]
    },
    hallway: { p: 'I’ve moved in with Keith. Out of spite. He hasn’t said no.', d: 'Keith and I are very happy. Keith hasn’t said so. Keith hasn’t said anything. That’s what I like about Keith.' }
  },
  {
    id: 'snoring-wall', title: 'The Snoring', truth: 'defendant',
    claim: '{p} is suing {d} for snoring so loudly the paint came off the wall.',
    asking: 'A new wall, and ninety years of sleep',
    plaintiff: [
      ['p', 'Every night {d} snores. It sounds like a drain being strangled by a smaller drain.'],
      ['p', 'The paint has come off the wall. The wall is bare brick now. The brick looks tired.'],
      ['judge', 'You want ninety years of sleep. How old are you?'],
      ['p', 'Seven. I sleep very badly.']
    ],
    defendant: [
      ['d', 'I do not snore, Your Honour. I sleep on my back, arms crossed, completely silent. Like a lid.'],
      ['d', 'I hear it too. I assumed it was {p}. It sounds like someone who eats in bed.'],
      ['p', 'I DO eat in bed.'],
      ['judge', 'That is not the point you think it is.']
    ],
    questions: [
      { ask: 'Ask {p} if it snored while {d} was away at the vet.', clue: 'The snoring got louder the night {d} was away at the vet.', lines: [
        ['p', 'Last Tuesday {d} was at the vet all night. The snoring was the worst it has ever been.'],
        ['judge', 'So it was louder when {d} was not in the building.'],
        ['p', 'I assumed {d} was doing it from the vet. Out of spite. Down the phone.']] },
      { ask: 'Have the bailiff put an ear to the wall.', clue: 'The wall snores. The Ministry of Haunting has it registered to a Mr Pemberton, deceased, snorer, since 1840.', lines: [
        ['narrator', '(The bailiff presses his ear to the wall. The wall snores. The bailiff’s whiskers blow back.)'],
        ['bailiff', 'Your Honour, the wall is snoring.'],
        ['judge', 'Walls do not snore, Bailiff.'],
        ['bailiff', 'This one just said “five more minutes”.'],
        ['npc', 'MINISTRY OF HAUNTING. Nobody touch that wall. That is a Mr Pemberton, snorer, registered 1840. He is on the heritage list.', 'ghost']] },
      { ask: 'Ask {p} if it has tried simply being asleep.', sass: true, lines: [
        ['judge', '{p}, have you tried simply being asleep? I am told it is very quiet in there.'],
        ['p', 'I CAN’T. BECAUSE OF THE SNORING.'],
        ['judge', 'Then try dying. I did. Slept like a log. Was mistaken for one. Twice.']] },
      { ask: 'Ask {d} to show the court how it sleeps.', clue: '{d} sleeps in total silence. It is upsetting to watch, but it is silent.', happen: 'outburst', party: 'p', lines: [
        ['narrator', '({d} lies down on the podium, crosses its arms, and becomes instantly, horribly still.)'],
        ['judge', 'Not a sound.'],
        ['bailiff', 'Shall I check it is alive, sir?'],
        ['p', 'THAT IS WHAT IT WANTS YOU TO THINK.']] },
      { ask: 'Ask {p} to do the snore for the court.', lines: [
        ['p', 'It goes HNNNRRK. Shhhwww. HNNNRRK. And then, sometimes, “Margaret”.'],
        ['judge', 'Who is Margaret?'],
        ['p', 'NOBODY KNOWS. THERE IS NO MARGARET.']] },
      { ask: 'Put the question to the wall.', lines: [
        ['judge', 'Wall. Did you snore?'],
        ['narrator', '(Silence. The wall snores. Then, quite clearly: “Margaret. The gas.”)'],
        ['judge', 'Nobody turn anything on.']] }
    ],
    rulings: {
      plaintiff: [
        ['judge', 'Judgment for {p}. {d} sleeps in the drawer until the snoring stops.'],
        ['narrator', '(That night {d} sleeps in the drawer. The wall snores louder than ever. It asks for Margaret twice.)'],
        ['p', 'I would like to reopen the case.'],
        ['judge', 'Denied. I am asleep.']],
      defendant: [
        ['judge', 'Judgment for {d}. The snorer is the wall, and the wall is a dead man called Pemberton. {p} has spent a month shouting at the only quiet thing on the shelf.'],
        ['judge', '{p} owes {d} an apology and a pillow. Mr Pemberton owes everybody an explanation, and a Margaret.'],
        ['narrator', '(The wall snores, gently, in agreement.)']],
      both: [
        ['judge', 'You are both wrong about everything. You sleep next to a dead man in a wall and blame each other.'],
        ['judge', 'Buy earplugs. Buy the wall a Margaret. Get out of my court.']]
    },
    hallway: { p: 'The wall is covering for {d}. They’re close. I’ve seen them.', d: 'Convicted of snoring by a court that takes evidence from a wall. I’m going to go and lie down. Silently. At it.' }
  },
  {
    id: 'stolen-slot', title: 'The Warm Slot', truth: 'both',
    claim: '{p} is suing {d} for taking its slot on the shelf while {p} was out being ill in a bucket.',
    asking: 'The slot back, and the smell removed',
    plaintiff: [
      ['p', 'I was ill for one afternoon. ONE. I come back and {d} is in my slot. In my shape. In my smell.'],
      ['p', 'It was still warm from me. {d} was using my warmth. Second-hand.'],
      ['judge', 'How ill were you?'],
      ['p', 'Bucket ill, Your Honour.']
    ],
    defendant: [
      ['d', 'An empty slot is like an empty chair at a funeral. Somebody sits in it, or people talk.'],
      ['d', 'Also, I had heard {p} was dead. I was keeping it warm for the next of kin. I am the next of kin. I checked.']
    ],
    questions: [
      { ask: 'Ask {d} who said {p} was dead.', clue: '{d} saw a bucket and declared {p} dead. Nobody else was consulted.', lines: [
        ['d', 'Nobody said. I saw the bucket.'],
        ['judge', 'You saw a bucket and declared a death.'],
        ['d', 'It was a very serious bucket, Your Honour. It had a lid.']] },
      { ask: 'Ask {p} whose slot it was in the first place.', clue: '{p} took that same slot from {d} in the spring, while {d} was out ill. In a bucket.', lines: [
        ['p', 'Mine. Since the beginning of time.'],
        ['bailiff', 'Shelf records, Your Honour. {p} moved into that slot in the spring. While {d} was out ill. In a bucket.'],
        ['p', 'That was a DIFFERENT bucket.']] },
      { ask: 'Ask {d} why the slot smells of it now.', lines: [
        ['d', 'I rolled in it. To claim it.'],
        ['judge', 'That is what cats do.'],
        ['d', 'I have cat energy.'],
        ['npc', 'It does not.', 'cat']] },
      { ask: 'Remind them both they are fighting over a plank.', sass: true, lines: [
        ['judge', 'It is a plank. You are fighting over a plank. I was buried in a box with less wood in it than this argument.'],
        ['p', 'It is a very good plank.'],
        ['d', 'It is the best plank.'],
        ['judge', 'It is an absolutely average plank.']] },
      { ask: 'Ask {p} to describe the bucket.', happen: 'outburst', party: 'd', lines: [
        ['p', 'Blue. Deep. Unforgiving.'],
        ['judge', 'And what was in it?'],
        ['p', 'Everything I had eaten since Thursday. And a button. I do not own a button.'],
        ['bailiff', '(quietly) I have been looking for that button.']] },
      { ask: 'Ask the jury who owns the slot.', lines: [
        ['jury', '{j} says a slot belongs to whoever is lying in it. That is the law of the shelf, and also of the bus.'],
        ['judge', 'Thank you, {j}. Nobody asked you. I did. I regret it.']] }
    ],
    rulings: {
      plaintiff: [
        ['judge', 'Judgment for {p}. You get ill, you get your slot back. That is basic decency, which I gather is rare on this shelf.'],
        ['d', 'Can I at least keep the smell?'],
        ['judge', 'The smell stays. You go.']],
      defendant: [
        ['judge', 'Judgment for {d}. {p} stole this slot first and weeps when it is stolen back. That is called karma. It is also called a bucket.'],
        ['p', 'This is a MISCARRIAGE of JUSTICE.'],
        ['judge', 'This is a plank.']],
      both: [
        ['judge', 'You are both slot thieves. {p} took it in the spring. {d} took it back in a bucket-based ambush. You deserve each other, and the plank deserves better.'],
        ['judge', 'You share the slot on alternate days, and you both clean the bucket.'],
        ['audience', '(Somebody at the back shouts “THE BUCKET”. It becomes a chant.)']]
    },
    hallway: { p: 'I’ll get it back. I have a bucket. I am not afraid to use it.', d: 'Fine. We share. I get the warm side. There is no warm side. I’ll make one.' }
  },
  {
    id: 'early-eulogy', title: 'The Early Eulogy', truth: 'plaintiff',
    claim: '{p} is suing {d} for delivering {p}’s eulogy while {p} was alive, in the front row, eating a salad.',
    asking: 'A retraction, a nicer eulogy, and the flowers back',
    plaintiff: [
      ['p', 'There was a misunderstanding about a nap, and I attended my own funeral as a guest.'],
      ['p', '{d} stood up and said I was “mostly fine” and “a bit much”. I was in the front row. I had brought a salad.'],
      ['judge', 'You brought a salad to your own funeral.'],
      ['p', 'I did not know it was mine until the hymns.']
    ],
    defendant: [
      ['d', '“Mostly fine” is a lovely thing to say. It is the nicest thing anyone has ever said about anybody, and I was the one saying it.'],
      ['d', 'And once the cake is bought, Your Honour, somebody is getting buried.']
    ],
    questions: [
      { ask: 'Ask {d} if it noticed {p} in the front row.', clue: '{d} saw {p} alive in the front row, eating a salad, and kept going.', lines: [
        ['d', 'I did. I thought it was a ghost. You do not stop a eulogy for a ghost. It encourages them.'],
        ['judge', 'It was eating a salad.'],
        ['d', 'Ghosts eat salad. Badly. It goes straight through.']] },
      { ask: 'Have {d} read the eulogy aloud.', clue: '{d} used the eulogy to claim {p} owed it three souls. {p} did not.', happen: 'outburst', party: 'p', lines: [
        ['d', '“{p} was here. Now {p} is not. {p} was mostly fine. {p} was a bit much. {p} owed me three souls.”'],
        ['judge', 'Did {p} owe you three souls?'],
        ['d', 'I thought if I said it at the funeral, nobody could argue.'],
        ['p', 'I WAS RIGHT THERE.']] },
      { ask: 'Tell {p} to be grateful anybody came.', sass: true, lines: [
        ['judge', '{p}, four people came to my funeral. One of them was the horse, and the horse left early.'],
        ['p', 'How many came to mine?'],
        ['d', 'Six. Seven counting you. Eight counting the salad.']] },
      { ask: 'Ask who booked the funeral.', clue: 'The funeral was booked by {d}, who never checked whether {p} was dead.', lines: [
        ['p', 'I don’t know. Somebody saw me lying very still and started booking things.'],
        ['bailiff', 'The paperwork is signed by {d}, Your Honour. Under “cause of death” it says “quiet”.']] },
      { ask: 'Ask what happened to the flowers.', lines: [
        ['d', 'I took them home. I bought them for a death. There was no death. That is on {p}.'],
        ['judge', 'That is annoyingly not wrong.'],
        ['d', 'They are in a jar. They are waiting.']] },
      { ask: 'Invite {d} to deliver the court’s eulogy too.', sass: true, lines: [
        ['judge', 'Do mine, {d}. I am right here, and I am properly dead. Go on.'],
        ['d', '“Judge Mortis was here. Judge Mortis is still here. Nobody knows why.”'],
        ['narrator', '(The judge’s jaw trembles. It could be emotion. It could be the hinge.)']] }
    ],
    rulings: {
      plaintiff: [
        ['judge', 'Judgment for {p}. You do not eulogise the living. You do not invoice at a graveside. You do not take the flowers home in a jar.'],
        ['judge', 'Next time somebody is lying very still, {d}, you poke them. Once. Firmly.'],
        ['d', 'Can I keep the speech for when it is real?'],
        ['judge', 'Put it in a drawer. We all have one.']],
      defendant: [
        ['judge', 'Judgment for {d}. {p}, if you do not want a funeral, stop lying so still. The eulogy stands. You are officially “mostly fine”.'],
        ['p', 'I am MORE than mostly fine.'],
        ['judge', 'Not according to the record.']],
      both: [
        ['judge', 'You are both morbid. One of you lies still for attention. The other one books a hall.'],
        ['judge', 'You will each write the other a eulogy. A nice one. And read them at the same time, over each other, like a normal family.']]
    },
    hallway: { p: 'I’m going to die just to prove a point. Not today. When it’s inconvenient for {d}.', d: 'I’ve kept the flowers. They’re pre-grieved. Ready to go.' }
  },
  {
    id: 'haunted-sock', title: 'The Haunted Sock', truth: 'defendant',
    claim: '{p} is suing {d} for borrowing one sock and returning it possessed.',
    asking: 'One sock, exorcised, and damages for the whispering',
    plaintiff: [
      ['p', 'I lent {d} one sock. For warmth. It came back whispering.'],
      ['p', 'Every night it says my name. Then it says “wrong”. Just “wrong”. Like it has read my diary.'],
      ['judge', 'Where is the sock now?'],
      ['bailiff', 'In a jar, Your Honour. It is saying my name now. It knows about the raisins.']
    ],
    defendant: [
      ['d', 'That sock was haunted when I got it. I did not mention it. It seemed private.'],
      ['d', 'It kept asking for its other half. I thought it was a metaphor. It was a sock.']
    ],
    questions: [
      { ask: 'Ask {p} where the sock came from.', clue: '{p} took the sock from the bottom drawer, the one that whispers, before it lent it to {d}.', lines: [
        ['p', 'The bottom drawer.'],
        ['judge', 'The one that whispers.'],
        ['p', 'All drawers whisper if you listen hard enough.'],
        ['judge', 'No, {p}. They do not.']] },
      { ask: 'Question the sock directly.', clue: 'The sock says it has been haunted “since the beginning”, long before {d} ever wore it.', lines: [
        ['narrator', '(The bailiff holds up the jar. The sock presses itself flat against the glass.)'],
        ['narrator', '(The sock whispers: “Haunted… since… the beginning.” Then, quieter: “{p}… knew.”)'],
        ['p', 'It is saying that for effect.']] },
      { ask: 'Ask {d} how it looked after the sock.', lines: [
        ['d', 'I wore it. I apologised to it. I sang to it once. It cried. We have a bond.'],
        ['judge', 'You bonded with a haunted sock.'],
        ['d', 'It has been a lonely year, Your Honour, and it is a very good listener.']] },
      { ask: 'Tell {p} this is the stupidest case ever put before a skeleton.', sass: true, lines: [
        ['judge', '{p}, in three hundred years on the bench I once heard a man sue his own hat. The hat countersued. This is stupider.'],
        ['p', 'Who won?'],
        ['judge', 'The hat. Obviously.']] },
      { ask: 'Ask the bailiff for the drawer’s record.', clue: 'Seventeen complaints about the whispering drawer are on file. The newest was filed by {p}, a week before it lent the sock.', lines: [
        ['bailiff', 'Seventeen complaints about that drawer, Your Honour. They all say “whispering”. The oldest is in Latin. The newest is from {p}.'],
        ['npc', 'That drawer whispered at my christening. I thought it was the vicar. It was not the vicar. The vicar was in the drawer.', 'uncle']] },
      { ask: 'Ask {p} if it even wants the sock back.', happen: 'outburst', party: 'p', lines: [
        ['p', 'Not really. I want it to stop saying “wrong”.'],
        ['judge', 'That is not a sock problem, {p}. That is a you problem.']] }
    ],
    rulings: {
      plaintiff: [
        ['judge', 'Judgment for {p}. {d} returns the sock, unhaunted. How is not my concern. Get a priest. A small one.'],
        ['d', 'Where do I find a small priest?'],
        ['judge', 'Try the drawer.']],
      defendant: [
        ['judge', 'Judgment for {d}. That sock was haunted before it left the drawer. {p} lent out a curse and is now billing for the side effects.'],
        ['judge', '{p} takes the sock home. It is the sock’s idea of justice too.'],
        ['narrator', '(The sock whispers “wrong” one last time. Nobody disagrees.)']],
      both: [
        ['judge', 'You are both wrong. The sock is right. The sock has been right this whole time.'],
        ['judge', 'The sock goes back in the drawer, and nobody borrows from the drawer. Nobody even looks at the drawer.'],
        ['narrator', '(Everybody looks at the drawer.)']]
    },
    hallway: { p: 'I’m going to find the other sock. Then there’ll be two. Then we’ll see who’s wrong.', d: 'I miss it. It mostly whispered, but it was ours.' }
  },
  {
    id: 'dead-portrait', title: 'The Portrait', truth: 'both',
    claim: '{p} is suing {d} for painting its portrait “in a way that looks dead”.',
    asking: 'A refund, and a new portrait with more cheekbone',
    plaintiff: [
      ['p', '{d} painted my portrait. I sat for six hours. I look like a corpse that lost an argument.'],
      ['p', 'My eyes are two holes. My mouth is a line. There are flies. Painted flies. On me.'],
      ['judge', 'Were there real flies?'],
      ['p', 'That is not the point.']
    ],
    defendant: [
      ['d', 'I paint what I see. I saw a still, slightly grey resident with flies.'],
      ['d', 'It is called realism. People pay good money for realism.'],
      ['judge', 'Name one.'],
      ['d', '{p}.']
    ],
    questions: [
      { ask: 'Ask {p} whether there were real flies at the sitting.', clue: 'There were real flies around {p} for the whole sitting. Fourteen of them.', lines: [
        ['p', '…Some flies.'],
        ['judge', 'How many?'],
        ['p', 'A normal number. For me.'],
        ['bailiff', 'Fourteen, Your Honour. They are in the gallery today. They came to support {p}.']] },
      { ask: 'Ask {d} how long it has been painting.', clue: '{d} took up painting on Tuesday and was charging full price by Wednesday.', lines: [
        ['d', 'Since Tuesday.'],
        ['judge', 'This Tuesday?'],
        ['d', 'I am a natural. It is a gift. It is also twelve souls.']] },
      { ask: 'Ask what {p} paid for it.', clue: '{d} charged twelve souls. One of them was for the flies.', lines: [
        ['p', 'Twelve souls.'],
        ['judge', 'Twelve souls, for a skill acquired on Tuesday.'],
        ['d', 'Eleven for the portrait. One for the flies. Flies are fiddly.']] },
      { ask: 'Have the bailiff show the painting to the audience.', happen: 'faint', lines: [
        ['narrator', '(The bailiff turns the painting round. The audience screams. One ghost leaves through the wall, then through the next wall.)'],
        ['audience', '(A small voice from the back: “IT’S BEAUTIFUL.” It is Madam Moth.)']] },
      { ask: 'Tell {p} the painting is flattering, actually.', sass: true, lines: [
        ['judge', '{p}, I have seen you. I have seen the painting. The painting is being generous. The flies are being generous.'],
        ['p', 'The flies are WITNESSES.']] },
      { ask: 'Ask {p} whether it sat still.', clue: '{p} sat so still for six hours that {d} held a mirror under its nose. Twice.', lines: [
        ['p', 'Perfectly still. Six hours. I barely blinked.'],
        ['d', 'It was very unsettling. I held a mirror under its nose. Twice. The second time the mirror looked worried.']] }
    ],
    rulings: {
      plaintiff: [
        ['judge', 'Judgment for {p}. You learned to paint on Tuesday and charged a fly fee. Full refund, and no brushes until Friday at the earliest.'],
        ['d', 'What about my art?'],
        ['judge', 'Your art is a crime scene.']],
      defendant: [
        ['judge', 'Judgment for {d}. You sat like a corpse, with flies, and received a painting of a corpse, with flies. That is not a crime. That is a mirror.'],
        ['p', 'I want a second opinion.'],
        ['judge', 'The moth loves it.']],
      both: [
        ['judge', 'You are both terrible. {p} sat there like a dead thing collecting flies. {d} painted it like a dead thing and billed for the flies.'],
        ['judge', 'Half refund. The painting hangs in the hall, as a warning.'],
        ['audience', '(The audience looks at the painting again. It is worse the second time.)']]
    },
    hallway: { p: 'I’m hiring a professional. The spider does portraits. Mostly flies, but it knows the subject.', d: 'Critics are just people who can’t paint flies.' }
  },
  {
    id: 'tooth-fairy', title: 'The Tooth Fairy Job', truth: 'both',
    claim: '{p} is suing {d} for selling {p}’s teeth to the tooth fairy and keeping the money.',
    asking: 'Three souls, and the teeth back if the fairy will part with them',
    plaintiff: [
      ['p', 'I had three beautiful teeth in a tin. My pension. {d} put them under a pillow and the fairy paid three souls.'],
      ['p', 'Three souls, Your Honour. That was my retirement.'],
      ['judge', 'You cannot retire. You cannot die. What were you retiring from?'],
      ['p', 'This.']
    ],
    defendant: [
      ['d', 'Finders keepers. I found them in {p}’s tin, which is exactly where I found them.'],
      ['d', 'The fairy was thrilled. She said they were vintage. She said “where did you get these” and I said “don’t”.']
    ],
    questions: [
      { ask: 'Ask {p} where it got the teeth.', clue: 'The teeth came from a jar labelled NOT UNCLE’S, in Uncle’s handwriting.', lines: [
        ['p', 'A jar. It says “NOT UNCLE’S”.'],
        ['judge', 'In handwriting that is very obviously Uncle’s.'],
        ['p', 'I do not read handwriting, Your Honour. I read labels.'],
        ['npc', 'THOSE ARE MY TEETH. I HAVE BEEN GUMMING SOUP SINCE 1911.', 'uncle']] },
      { ask: 'Ask {d} what it spent the three souls on.', clue: '{d} spent the tooth money on a hat that nobody can see.', lines: [
        ['d', 'A hat.'],
        ['judge', 'Where is the hat?'],
        ['d', 'I am wearing it.'],
        ['narrator', '({d} is not wearing a hat.)'],
        ['d', 'It is a very exclusive hat.']] },
      { ask: 'Have the bailiff check {d}’s mouth.', sass: true, lines: [
        ['bailiff', 'All present, Your Honour. Plus one extra.'],
        ['judge', 'An extra tooth, {d}?'],
        ['d', 'Everyone needs a spare.'],
        ['npc', 'THAT ONE IS MINE AS WELL.', 'uncle']] },
      { ask: 'Ask {p} whether the teeth were ever really its.', clue: '{p} admits the teeth only became “its” by being put in a tin.', lines: [
        ['p', 'They became mine the moment I put them in my tin. That is how tins work.'],
        ['judge', 'That is how burglary works.']] },
      { ask: 'Call the tooth fairy.', happen: 'faint', lines: [
        ['narrator', '(A small, exhausted fairy is led in. She carries a sack of teeth and has the eyes of someone who has seen too many pillows.)'],
        ['narrator', '(The fairy: “I pay for teeth. I do not ask whose. Nobody in this job asks whose. You would never sleep again.”)'],
        ['judge', 'Whose teeth do you usually get?'],
        ['narrator', '(The fairy: “I am going home.”)']] },
      { ask: 'Ask {d} if it would do it again.', happen: 'outburst', party: 'p', lines: [
        ['d', 'Tomorrow. The fairy does a loyalty card. Two more teeth and I get a free pillow.']] }
    ],
    rulings: {
      plaintiff: [
        ['judge', 'Judgment for {p}. {d} pays three souls and hands over the hat.'],
        ['narrator', '({d} hands over nothing. {p} puts it on. It really suits {p}.)']],
      defendant: [
        ['judge', 'Judgment for {d}. {p} took teeth from a jar and called it a pension. {d} merely liquidated the assets.'],
        ['p', 'That is just THEFT in a TIE.'],
        ['judge', 'That is finance.']],
      both: [
        ['judge', 'Neither of you owned those teeth. They are Uncle’s. Every tooth on this shelf is Uncle’s until proven otherwise.'],
        ['judge', 'You will both pay Uncle three souls and read him a letter of apology. Slowly. Twice. He likes to hear things twice.'],
        ['narrator', '(Uncle weeps in the gallery. It sounds like marbles.)']]
    },
    hallway: { p: 'I’ve started a new tin. Nobody tell Uncle.', d: 'I still have the hat. They can’t take the hat. Nobody can find the hat.' }
  },
  {
    id: 'crayon-will', title: 'The Crayon Will', truth: 'plaintiff',
    claim: '{p} is suing {d} for writing itself into {p}’s will. In crayon. While {p} was asleep.',
    asking: 'The will back, and the crayon confiscated',
    plaintiff: [
      ['p', 'I woke up and my will had a new page. It says “And EVERYTHING to {d}”. In purple crayon. With a heart.'],
      ['p', 'I do not own a purple crayon. I own a spoon.'],
      ['judge', 'And what did the will say before?'],
      ['p', 'The spoon, to the moth.']
    ],
    defendant: [
      ['d', 'I did not write it. The will wrote it. Wills are very emotional documents.'],
      ['d', 'And a heart is how I sign things. Everybody signs with a heart. It is how you know it is sincere.']
    ],
    questions: [
      { ask: 'Have {d} write the word “everything”.', clue: '{d} spells it “EVRYTHING”, with a heart, exactly like the forged page.', lines: [
        ['narrator', '({d} writes “EVRYTHING” in purple crayon and dots the I with a heart. There is no I.)'],
        ['judge', 'The will also says “EVRYTHING”.'],
        ['d', 'Common mistake. Very common. There are probably loads of us.']] },
      { ask: 'Ask {p} whether it is dying.', clue: '{d} is openly waiting for {p} to die.', happen: 'outburst', party: 'p', lines: [
        ['p', 'No!'],
        ['d', 'Not YET.'],
        ['judge', '{d}, did you just say “not yet”?'],
        ['d', 'I said “the jet”. There is a jet. Somewhere. Probably.']] },
      { ask: 'Tell {d} a heart is not a signature.', sass: true, lines: [
        ['judge', 'A heart is not a signature, {d}. A heart is a muscle. I have not had one since 1702 and I sign things perfectly well.'],
        ['d', 'With what?'],
        ['judge', 'A bone.']] },
      { ask: 'Ask the bailiff what he found in {d}’s slot.', clue: 'A purple crayon and three drafts of the will were found in {d}’s slot. Each is marked PRACTICE.', lines: [
        ['bailiff', 'One purple crayon, Your Honour. Three drafts of the will. They each say “practice”. The third one is quite good.']] },
      { ask: 'Ask the moth what she thinks.', lines: [
        ['npc', 'I was promised a spoon. I have waited a very long time for this spoon. I would like that noted.', 'moth'],
        ['judge', 'You are not a party to this case.'],
        ['npc', 'I am a party to every case with a spoon in it.', 'moth']] },
      { ask: 'Ask {d} what it would do with everything.', sass: true, lines: [
        ['d', 'Get a bigger slot. A second spoon. Visit {p}’s grave every week.'],
        ['judge', '{p} is not dead.'],
        ['d', 'Fortnightly, then.']] }
    ],
    rulings: {
      plaintiff: [
        ['judge', 'Judgment for {p}. {d} forged a will in crayon and could not spell the only word on it. {d} is banned from all stationery for a year.'],
        ['d', 'What about pencils?'],
        ['judge', 'ESPECIALLY pencils.']],
      defendant: [
        ['judge', 'Judgment for {d}. The will has a heart on it. I am not proud of this. It was a very convincing heart.'],
        ['p', 'You are letting a CRAYON win?'],
        ['judge', 'The crayon made the better argument. In purple.']],
      both: [
        ['judge', 'You are both morbid. One forges wills in crayon; the other keeps a will for a spoon. New wills, both of you. Everything to the moth.'],
        ['narrator', '(Madam Moth, in the gallery, screams with joy and flies into a lamp.)']]
    },
    hallway: { p: 'I’m leaving everything to the wall. The wall is honest. It snores, but it’s honest.', d: 'I’ll be in the will eventually. I’m patient. I have more crayons at home. I have all the colours.' }
  },
  {
    id: 'labelled-biscuit', title: 'The Labelled Biscuit', truth: 'defendant',
    claim: '{p} is suing {d} for eating a biscuit labelled “{p}’s. DO NOT EAT. I WILL KNOW.”',
    asking: 'One biscuit, and a signed admission that {p} knew',
    plaintiff: [
      ['p', 'The label was clear. It had my name. It said “do not eat”. It said “I will know”.'],
      ['p', 'And I knew, Your Honour. I always know.'],
      ['judge', 'How did you know?'],
      ['p', 'Crumbs on {d}’s face. A look of joy. More crumbs.']
    ],
    defendant: [
      ['d', 'Your Honour, {p} labels everything. EVERYTHING.'],
      ['d', 'There is a label on me. It says “{p}’s”. I did not put it there. I woke up with it.']
    ],
    questions: [
      { ask: 'Have the bailiff check {d} for labels.', clue: '{p} has labelled {d} as its own property.', lines: [
        ['bailiff', 'One label, Your Honour, on the back. It says “{p}’s. DO NOT EAT.”'],
        ['judge', 'You labelled another resident as food.'],
        ['p', 'As property. Food is a kind of property. Everybody knows that.']] },
      { ask: 'Ask who actually bought the biscuit.', clue: '{d} bought the biscuit with its own souls, and kept the receipt.', lines: [
        ['d', 'Me. With my own souls. I have the receipt.'],
        ['narrator', '({d} produces the receipt. There is a label on the receipt. It says “{p}’s”.)']] },
      { ask: 'Have the bailiff look under the bench.', clue: '{p} labelled the judge’s bench during the opening statements.', lines: [
        ['narrator', '(There is a label on the judge’s bench. It says “{p}’s”.)'],
        ['judge', 'When did you do this?'],
        ['p', 'During your entrance. You were very dramatic. Nobody was watching me.']] },
      { ask: 'Ask {d} how the biscuit tasted.', lines: [
        ['d', 'Like victory, Your Honour. And a bit like glue. From the label.'],
        ['judge', 'You ate the label.'],
        ['d', 'The label was the best bit.']] },
      { ask: 'Ask {p} what “I will know” means.', happen: 'sleep', lines: [
        ['p', 'It means I have a system.'],
        ['judge', 'What system?'],
        ['p', 'I sit very still in the dark and watch the biscuits.'],
        ['judge', 'Since when?'],
        ['p', 'March.']] },
      { ask: 'Have the bailiff put a label on {p}.', sass: true, happen: 'outburst', party: 'p', lines: [
        ['judge', 'Bailiff. A label, please.'],
        ['narrator', '(The bailiff sticks a label on {p}. It says “NOT {p}’s. NOTHING IS.”)'],
        ['p', 'TAKE IT OFF. TAKE IT OFF.']] }
    ],
    rulings: {
      plaintiff: [
        ['judge', 'Judgment for {p}. A label is a label. It said you would know. You knew. That is a contract.'],
        ['d', 'I am labelled too!'],
        ['judge', 'Then you are {p}’s as well. Congratulations. Go and sit in its slot.']],
      defendant: [
        ['judge', 'Judgment for {d}. {d} bought the biscuit, kept the receipt, and has been labelled like a jam jar. {p}, you do not own things by writing on them.'],
        ['p', 'Then how do you own things?'],
        ['judge', 'Money. Violence. Mostly money.']],
      both: [
        ['judge', 'You are both exhausting. One of you labels the living. The other eats a biscuit that says “I WILL KNOW” and is surprised when somebody knows.'],
        ['judge', 'All labels come off. Including the one on my bench. Including the one I have just found on my skull.']]
    },
    hallway: { p: 'I’ve already made new labels. They say “MINE AGAIN”.', d: 'I’m keeping my label. It’s the only thing anyone’s ever given me.' }
  },
  {
    id: 'fake-seance', title: 'The Séance Under the Table', truth: 'plaintiff',
    claim: '{p} is suing {d} for a séance that was “obviously just {d} under the table going woooo”.',
    asking: 'Five souls, and the real Great-Aunt Gertrude',
    plaintiff: [
      ['p', 'I paid {d} five souls to reach my great-aunt Gertrude. The lights went out. A voice said “woooo”.'],
      ['p', 'Gertrude never said “woooo” in her life. Gertrude said “eat something”. As a threat.']
    ],
    defendant: [
      ['d', 'Spirits change after death. Gertrude has grown. Gertrude now says woooo.'],
      ['d', 'I was under the table for medical reasons.']
    ],
    questions: [
      { ask: 'Ask {d} what Gertrude said, exactly.', clue: 'The “ghost” told {p} to pay {d}. Twice. Then asked for a nice review.', lines: [
        ['d', '“Woooo. It is Gertrude. Pay {d}. Woooo. {d} is very gifted. Woooo. Five stars.”'],
        ['judge', 'Gertrude asked for a tip.'],
        ['d', 'She was very generous. For a dead lady.']] },
      { ask: 'Ask {d} about the medical reasons.', clue: '{d} admits to being under the table.', lines: [
        ['d', 'I have a condition where I have to be under a table whenever somebody pays me.'],
        ['judge', 'That is not a condition.'],
        ['d', 'It is a very rare condition. There is a leaflet. I am on the leaflet.']] },
      { ask: 'Make {d} do the voice.', sass: true, lines: [
        ['judge', 'Do the voice.'],
        ['d', '…woooo.'],
        ['judge', 'Again. Like you mean it.'],
        ['d', 'WOOOOOOOO. I AM GERTRUDE. EAT SOMETHING.'],
        ['narrator', '({p} bursts into tears. It was a very good Gertrude.)']] },
      { ask: 'Call a real ghost to give evidence.', clue: 'The Ministry of Haunting confirms Gertrude was on holiday that night. In Margate.', lines: [
        ['npc', 'Ministry of Haunting. I have reviewed the séance. That was a small person under a table. Also, Gertrude is in Margate.', 'ghost'],
        ['judge', 'Ghosts go on holiday?'],
        ['npc', 'Seaside towns, mostly. We love a pier. Nobody can tell.', 'ghost']] },
      { ask: 'Ask {p} what it wanted to ask Gertrude.', happen: 'outburst', party: 'p', lines: [
        ['p', 'Where she hid the good biscuits.'],
        ['judge', 'That was it?'],
        ['p', 'They were VERY good biscuits.'],
        ['d', 'Top of the wardrobe. Behind the hatbox.']] },
      { ask: 'Explain to {p} that the dead are not a vending machine.', sass: true, lines: [
        ['judge', '{p}. The dead are not a vending machine. You do not put in five souls and get a Gertrude.'],
        ['p', 'Then what do you get?'],
        ['judge', 'In my experience? A {d} under a table.']] }
    ],
    rulings: {
      plaintiff: [
        ['judge', 'Judgment for {p}. That was not a séance. That was a con with a tablecloth. Full refund, and an apology to Gertrude, by postcard, to the pier.'],
        ['d', 'What if she writes back?'],
        ['judge', 'Then you have much bigger problems than me.']],
      defendant: [
        ['judge', 'Judgment for {d}. {p} paid for a spooky evening and got a spooky evening. There was a {d} under the table. That is spooky.'],
        ['p', 'IT WAS UNDER THE TABLE.'],
        ['judge', 'So, often, is the truth.']],
      both: [
        ['judge', 'You are both fools. One of you pays for ghosts. The other one IS the ghost. You will hold a real séance, together, and ask Gertrude about the biscuits.'],
        ['narrator', '(Somewhere on a pier in Margate, Gertrude says “eat something”.)']]
    },
    hallway: { p: 'I’m going to find those biscuits myself. With a spade.', d: 'Woooo. That’s all I’m saying, on the advice of my ghost.' }
  },
  {
    id: 'practice-burial', title: 'The Practice Burial', truth: 'defendant',
    claim: '{p} is suing {d} for burying it in the plant pot. Alive. “A little bit”.',
    asking: 'Twenty souls, and the soil out of its ears',
    plaintiff: [
      ['p', 'I woke up in the plant pot. Under the soil. With a daisy on my face.'],
      ['p', 'I dug myself out with a teaspoon. It took until Thursday.'],
      ['judge', 'Where did you get a teaspoon?'],
      ['p', 'It was in there with me. With a note. The note said “good luck”.']
    ],
    defendant: [
      ['d', 'It asked me to. It said “I want to know what it is like”.'],
      ['d', 'I gave it a teaspoon. I gave it a daisy. I made a short speech. It is the nicest thing I have ever done for anybody, and look where it got me.']
    ],
    questions: [
      { ask: 'Ask {d} for proof that {p} asked.', clue: '{p} signed a form: “Practice burial. Do not dig up until Thursday.”', lines: [
        ['d', 'I have a form.'],
        ['narrator', '(The form reads: “Practice burial. Do not dig up until Thursday. No lilies. Signed, {p}.”)'],
        ['judge', '{p}, is that your signature?'],
        ['p', 'I sign a LOT of things, Your Honour.']] },
      { ask: 'Ask {p} what day it got out.', clue: '{p} came out on exactly the Thursday its own form asked for. It had set an alarm.', happen: 'outburst', party: 'p', lines: [
        ['p', 'Thursday.'],
        ['judge', 'The form says Thursday.'],
        ['p', 'That is a COINCIDENCE.'],
        ['bailiff', 'It came out at nine sharp, Your Honour. It had set an alarm.']] },
      { ask: 'Tell {p} the court has been buried too and it was lovely.', sass: true, lines: [
        ['judge', 'I have been buried for three hundred years, {p}. It is lovely. The worms are chatty. You did four days and you want twenty souls?'],
        ['p', 'The worms were NOT chatty.'],
        ['judge', 'Then you got the wrong worms. That is a customer service matter.']] },
      { ask: 'Ask {p} about the teaspoon.', lines: [
        ['p', 'A good teaspoon. Silver. I’m keeping it.'],
        ['d', 'That is MY teaspoon.'],
        ['judge', 'So {p} went into the ground with nothing and came up with silver. That is called mining.']] },
      { ask: 'Ask the plant pot’s regular occupant.', happen: 'faint', lines: [
        ['npc', 'It spent four days on top of my father. Father did not mind. He said it was nice to have company.', 'geoffrey2'],
        ['judge', 'Your father is dead, Geoffrey.'],
        ['npc', 'He is a very good listener.', 'geoffrey2']] },
      { ask: 'Ask {d} if it would bury {p} again.', lines: [
        ['d', 'Only with a form. And only on a weekday. I am not a monster.']] }
    ],
    rulings: {
      plaintiff: [
        ['judge', 'Judgment for {p}. I do not care what the form says. You do not bury people. Not a little bit. Not with a daisy.'],
        ['d', 'Not even for practice?'],
        ['judge', 'Practise on a raisin.'],
        ['bailiff', 'Please do not bury the raisins.']],
      defendant: [
        ['judge', 'Judgment for {d}. {p} ordered a burial, received a burial with a daisy and a speech, and was released on the agreed day. That is the best customer service on this shelf.'],
        ['p', 'I had soil in my EARS.'],
        ['judge', 'That comes as standard.']],
      both: [
        ['judge', 'You are both deranged. One asks to be buried for fun. The other says yes and packs a spoon.'],
        ['judge', 'No more burials unless somebody is actually dead. On this shelf, that is nobody. So: no more burials.']]
    },
    hallway: { p: 'Honestly? It was very peaceful. Don’t tell {d}.', d: 'I’m starting a business. Practice burials. Daisy included. Spoon extra.' }
  },
  {
    id: 'moth-custody', title: 'Custody of the Moth', truth: 'both',
    claim: '{p} is suing {d} for custody of Madam Moth, whom they both say they own.',
    asking: 'Full custody of the moth, and weekends with the lamp',
    plaintiff: [
      ['p', 'I found her first. On my ceiling. She looked at me like I was the moon.'],
      ['p', 'I have fed her. Mostly wool. Once, a sleeve.'],
      ['judge', 'Whose sleeve?'],
      ['p', 'Mine. I was in it.']
    ],
    defendant: [
      ['d', 'She sleeps in MY slot. She dusts herself on MY face. That is a bond.'],
      ['d', 'She calls me “Lamp”. Nobody else gets called Lamp.']
    ],
    questions: [
      { ask: 'Call Madam Moth to the stand.', clue: 'Madam Moth says she belongs to neither of them. She belongs to the light.', lines: [
        ['npc', 'I belong to nobody. I belong to the light. Mostly the lamp. Sometimes the fridge, when it is open.', 'moth'],
        ['judge', 'Do you like either of them?'],
        ['npc', '{p} is soft. {d} is warm. Neither of them is a lamp. I have been very clear about this.', 'moth']] },
      { ask: 'Ask {d} what it calls the moth.', happen: 'outburst', party: 'p', lines: [
        ['d', 'Mothew.'],
        ['p', 'HER NAME IS NOT MOTHEW.'],
        ['npc', 'I answer to Mothew.', 'moth']] },
      { ask: 'Ask {p} about the sleeve.', lines: [
        ['p', 'She ate it while I was in it. It was the most intimate moment of my life.'],
        ['judge', 'Did you consent?'],
        ['p', 'I did not NOT consent.']] },
      { ask: 'Tell them both the moth is seeing other people.', sass: true, lines: [
        ['judge', 'Both of you, listen. The moth has been seeing the lamp. And the fridge. And a porch light two doors down.'],
        ['judge', 'This is not a custody battle. It is a love triangle, and you are both losing to electricity.']] },
      { ask: 'Ask the bailiff where the moth actually sleeps.', clue: 'The moth splits her week between {p}, {d} and the lamp, and has done for months.', lines: [
        ['bailiff', 'Surveillance, Your Honour. Monday to Wednesday with {p}. Thursday to Saturday with {d}. Sundays with the lamp, in what I can only describe as a situation.']] },
      { ask: 'Ask {d} what it feeds her.', clue: '{d} has been feeding the moth {p}’s socks. {p} has been feeding her {d}’s.', lines: [
        ['d', 'Wool. Crumbs. Some of {p}’s socks.'],
        ['p', 'THAT is where they went? I have been feeding her YOURS.'],
        ['d', '…Those were my socks?']] }
    ],
    rulings: {
      plaintiff: [
        ['judge', 'Judgment for {p}. Full custody. {d} gets supervised visits. The lamp will supervise.'],
        ['narrator', '(The moth, entirely unbothered, flies straight into the studio light.)']],
      defendant: [
        ['judge', 'Judgment for {d}. She sleeps on your face. That is commitment. {p} may visit on Sundays.'],
        ['npc', 'I am with the lamp on Sundays.', 'moth'],
        ['judge', 'Then {p} may visit the lamp.']],
      both: [
        ['judge', 'Nobody owns the moth. The moth owns herself, and frankly the lamp.'],
        ['judge', 'Shared custody, split by the week, exactly as the moth arranged months ago without either of you noticing.'],
        ['narrator', '(The moth takes a bow. It is a very small bow. Three ghosts weep.)']]
    },
    hallway: { p: 'She’ll come back to me. They always come back to the soft one.', d: 'Mothew knows who loves her. The lamp, first. Then me.' }
  },
  {
    id: 'loaned-leg', title: 'The Loaned Leg', truth: 'plaintiff',
    claim: '{p} is suing {d} for one leg, lent for the sack race and never given back.',
    asking: 'The leg, and half the medal it won',
    plaintiff: [
      ['p', 'I lent {d} my left leg for the sack race. One race. Back by teatime.'],
      ['p', 'That was a fortnight ago. I have been hopping ever since. You try hopping to a bowl.'],
      ['judge', 'Why would anyone lend out a leg?'],
      ['p', '{d} said it was for charity. The charity was {d}.']
    ],
    defendant: [
      ['d', 'The leg does not want to come back, Your Honour. It has stood on a podium. It has tasted victory.'],
      ['d', 'And it has settled in. It knows where everything is. It kicks when it dreams.']
    ],
    questions: [
      { ask: 'Ask {d} whose name is on the leg.', clue: 'There is a name tape sewn inside the top of the leg. It says {p}.', lines: [
        ['d', 'Nobody’s. It is a leg. Legs do not have names.'],
        ['narrator', '(The bailiff turns down the top of the leg. Inside, sewn in like a school jumper, is a name tape. It says {p}.)'],
        ['d', 'That could be any {p}.']] },
      { ask: 'Call the race steward.', clue: 'Sir Reginald Whiskers saw {d} get into the sack with one more leg than it arrived with.', lines: [
        ['npc', 'I stewarded the sack race. {d} got into the sack with one more leg than it came with.', 'cat'],
        ['judge', 'And you did not disqualify it?'],
        ['npc', 'I was asleep by the finish. I was asleep by the start. I am a cat.', 'cat']] },
      { ask: 'Have {d} walk to the bench and back.', clue: 'The leg is the wrong length for {d}. {d} now walks in a slow circle to the right.', lines: [
        ['narrator', '({d} sets off towards the bench, bears steadily right, and arrives back at its own podium four minutes later.)'],
        ['judge', 'You did not reach the bench.'],
        ['d', 'I got the gist of it.']] },
      { ask: 'Ask {p} whether it has tried growing another one.', sass: true, lines: [
        ['judge', '{p}, the lizard in the garden grows a new tail every spring. Have you tried applying yourself?'],
        ['p', 'I have sat in a pot of soil every night since the race.'],
        ['judge', 'And?'],
        ['p', 'Something is coming up. It is a radish.']] },
      { ask: 'Ask {d} what the leg has been doing since the race.', happen: 'outburst', party: 'p', lines: [
        ['d', 'Light training. A jog on Tuesdays. It has had an offer from a centipede.'],
        ['judge', 'An offer.'],
        ['d', 'The leg is weighing it up. It would be one of a hundred, but it would be first team.']] },
      { ask: 'Ask {p} whether there was any agreement.', clue: '{d} wrote “BACK BY TEATIME. PROMISE.” on {p}’s other leg in felt pen, and signed it.', lines: [
        ['p', 'There was. {d} wrote it on my other leg, so I would not lose it.'],
        ['narrator', '({p} holds up its other leg. On it, in felt pen: “BACK BY TEATIME. PROMISE. {d}”)'],
        ['d', 'It has smudged. It could say anything.'],
        ['judge', 'It says PROMISE, {d}. In capitals. With a smiley face.']] }
    ],
    rulings: {
      plaintiff: [
        ['judge', 'Judgment for {p}. A leg lent for one race is lent for one race. It goes back tonight, with the medal.'],
        ['d', 'And if it does not want to go?'],
        ['judge', 'Then it can walk. It is a leg.']],
      defendant: [
        ['judge', 'Judgment for {d}. The leg has made its choice, and this court will not stand in the way of a leg.'],
        ['narrator', '({p} hops out of the courtroom. It takes a long time. The audience applauds every hop.)']],
      both: [
        ['judge', 'You are both ridiculous. {p}, never lend a leg to anyone who says “charity”. {d}, you walk in circles now. That is its own sentence.'],
        ['judge', 'The court will keep the leg. The bailiff has always wanted to be taller.'],
        ['narrator', '(The bailiff puts it on. He is now taller on one side. He has never been happier.)']]
    },
    hallway: { p: 'Next year I’m entering the sack race on one leg. In a smaller sack. Out of spite.', d: 'I’ll miss that leg. It always knew where it was going. Right, mostly.' }
  },
  {
    id: 'stolen-dust', title: 'The Dusting', truth: 'plaintiff',
    claim: '{p} is suing {d} for dusting {p} in the night, without asking, and keeping the dust.',
    asking: 'Eighty years of dust, returned in the right order',
    plaintiff: [
      ['p', 'I had eighty years of dust on me, Your Honour. A proper layer. It had a crust. You could write your name in it. People did.'],
      ['p', 'On Tuesday I woke up clean. I could see my own knees. Nobody should have to see their own knees.'],
      ['judge', 'And you blame {d}.'],
      ['p', '{d} is suddenly very grey for someone who was not grey on Monday.']
    ],
    defendant: [
      ['d', 'I cleaned {p} as a kindness. Things were living in that dust. Things with opinions.'],
      ['d', 'And I have always been this grey. I have a naturally dusty complexion.']
    ],
    questions: [
      { ask: 'Have the bailiff run a finger down {d}.', clue: 'The grey comes off {d} on a finger. Underneath, {d} is spotless.', lines: [
        ['narrator', '(The bailiff runs a finger down {d}’s back. It comes away grey. Underneath, {d} is spotless.)'],
        ['bailiff', 'It is on quite loose, Your Honour.'],
        ['d', 'That is how complexions work.']] },
      { ask: 'Call a witness who lived in the dust.', clue: 'Geoffrey the Woodlouse went to sleep on {p} on Monday and woke up on {d}, in the same dust.', lines: [
        ['npc', 'My family has lived on {p} for three generations. Left shoulder. My grandfather was born there.', 'woodlouse'],
        ['npc', 'On Monday I went to sleep on {p}. On Tuesday I woke up on {d}. Same dust. Much worse view.', 'woodlouse']] },
      { ask: 'Ask {d} what it used for the dusting.', clue: '{d} swept {p}’s dust into a jar with a lid, “to keep it fresh”.', lines: [
        ['d', 'A soft brush. And a jar, for the dust. And a lid for the jar.'],
        ['judge', 'Why does dust need a lid?'],
        ['d', 'To keep it fresh.']] },
      { ask: 'Tell {p} that dust is not a personality.', sass: true, lines: [
        ['judge', '{p}, dust is not a personality. I am mostly dust, and I have a personality entirely my own.'],
        ['p', 'How much of your dust is yours?'],
        ['judge', '…Most of it.']] },
      { ask: 'Ask {p} what was in the dust.', happen: 'heckle', lines: [
        ['p', 'A crumb from 1964. The lid of a biro. A sequin. Geoffrey. Geoffrey’s furniture.'],
        ['judge', 'Anything of value?'],
        ['p', 'Geoffrey’s furniture is very good. Geoffrey has taste.']] },
      { ask: 'Ask {d} why anyone would want somebody else’s dust.', happen: 'outburst', party: 'p', lines: [
        ['d', 'Hypothetically? Nobody on this shelf takes you seriously unless you look at least a hundred.'],
        ['d', 'And, hypothetically, I looked about sixty.']] }
    ],
    rulings: {
      plaintiff: [
        ['judge', 'Judgment for {p}. You do not dust a resident without asking, and you certainly do not wear it afterwards.'],
        ['judge', '{d} puts back every speck tonight. Including Geoffrey. Including Geoffrey’s furniture.'],
        ['npc', 'I would like the left shoulder again, if it is going.', 'woodlouse']],
      defendant: [
        ['judge', 'Judgment for {d}. {p} is clean, and it suits {p}. The court can see {p}’s knees, and, frankly, so can everybody.'],
        ['p', 'I DID NOT ASK TO BE SEEN.']],
      both: [
        ['judge', 'You are both filthy, in opposite directions. The dust goes in the jar, the jar goes on the shelf, and nobody wears it.'],
        ['narrator', '(By morning the jar is empty and both of them are very slightly grey.)']]
    },
    hallway: { p: 'I’m never washing again. Give me eighty years. I’ll be back.', d: 'I still look distinguished round the edges. Where I missed.' }
  },
  {
    id: 'jumble-pulse', title: 'The Pulse', truth: 'defendant',
    claim: '{p} is suing {d} for stealing a pulse. {p}’s stopped on Tuesday. On Wednesday, {d} had one.',
    asking: 'The pulse back, and every beat it has missed since',
    plaintiff: [
      ['p', 'I had a pulse, Your Honour. Small. Regular. At night I used to lie in my slot and listen to it.'],
      ['p', 'On Tuesday it stopped. On Wednesday {d} had one. Nobody else on this shelf has one.'],
      ['judge', 'So you assume it is yours.'],
      ['p', 'I have not had much else to go on. It has been very quiet in here.']
    ],
    defendant: [
      ['d', 'I bought it, Your Honour. Mrs Widow’s jumble sale. It was in a box with a wig and three spoons.'],
      ['d', 'I have been very happy with it. I feel things now. Mostly the pulse.']
    ],
    questions: [
      { ask: 'Call the seller.', clue: 'Mrs Widow sold {d} the pulse at her jumble sale. It was her late husband’s.', lines: [
        ['npc', 'I sold {d} that pulse on Wednesday. Two souls. It was my late husband’s.', 'widow'],
        ['judge', 'He did not want it?'],
        ['npc', 'He had stopped using it. I kept it in my sewing box for forty years. He never could keep still.', 'widow']] },
      { ask: 'Have the bailiff take {d}’s pulse.', clue: '{d}’s pulse is in three-four time. It waltzes.', lines: [
        ['narrator', '(The bailiff holds {d}’s wrist and counts, moving his lips.)'],
        ['bailiff', 'One two three. One two three. Your Honour, it is waltzing.'],
        ['p', 'Mine could have learned.']] },
      { ask: 'Have the bailiff hold {p} up to the studio light.', clue: 'Inside {p} is a pocket watch, swallowed in 1896 and stopped at ten past four.', happen: 'faint', lines: [
        ['narrator', '(The bailiff holds {p} up to the light. Inside, clear as anything, is a small pocket watch, stopped at ten past four.)'],
        ['judge', '{p}. When did you swallow a watch?'],
        ['p', '1896. It was a Sunday. There was nothing else to do.']] },
      { ask: 'Ask {p} what its pulse sounded like.', lines: [
        ['p', 'Steady. Reliable. Tick. Tick. Tick.'],
        ['judge', 'Tick.'],
        ['p', 'You could set your watch by it.'],
        ['judge', 'Yes, {p}. You could.']] },
      { ask: 'Remind {p} that nobody here needs a pulse.', sass: true, lines: [
        ['judge', '{p}, I have not had a pulse since 1702. I manage. I tap my foot so people know I am still here.'],
        ['narrator', '(The judge taps his foot. It clicks like knitting needles.)']] },
      { ask: 'Ask the jury to check their own pulses.', happen: 'outburst', party: 'p', lines: [
        ['jury', '{j} checks its wrist. Nothing. {j} checks the juror next to it. Nothing there either. {j} looks worried, then remembers.'],
        ['judge', 'So the only pulse in this room is on {d}.'],
        ['p', 'THAT IS MY POINT.']] }
    ],
    rulings: {
      plaintiff: [
        ['judge', 'Judgment for {p}. {d} hands over the pulse.'],
        ['narrator', '({d} hands it over. {p} holds it to its chest. It waltzes. {p} has never waltzed in its life. {p} is waltzing.)']],
      defendant: [
        ['judge', 'Judgment for {d}. That pulse was bought, paid for, and it waltzes. {p}, yours did not stop. It ran down.'],
        ['judge', 'Bailiff. Find a key.'],
        ['narrator', '(The bailiff winds {p}. Somewhere inside {p}, something goes tick.)']],
      both: [
        ['judge', 'You are both wrong. One of you mistook a watch for a pulse. The other bought a dead man’s pulse off his widow and never asked if he wanted it back.'],
        ['judge', 'The pulse goes back to Mrs Widow. {p} gets wound on Sundays.']]
    },
    hallway: { p: 'It was a watch. I know that now. It was still a very good pulse.', d: 'I had a pulse for a week. I felt everything. Mostly dizzy. Occasionally a waltz.' }
  },
  {
    id: 'museum-piece', title: 'The Museum Piece', truth: 'defendant',
    claim: '{p} is suing {d} for pushing {p}’s bed one inch nearer the lamp every night for a week.',
    asking: 'Seven inches back, and a lock for the bed',
    plaintiff: [
      ['p', 'Every morning my bed is one inch nearer the lamp. Every morning. Seven inches this week.'],
      ['p', 'It is not me. The lamp cannot do it. That leaves {d}. It always leaves {d}.'],
      ['judge', 'What is your bed?'],
      ['p', 'A matchbox, Your Honour. A very good matchbox. It slides beautifully.']
    ],
    defendant: [
      ['d', 'I was not on the shelf last week, Your Honour. I was in a museum.'],
      ['d', 'A man came round asking if anyone had any antiques. I put my hand up.']
    ],
    questions: [
      { ask: 'Ask {d} to describe the museum.', clue: '{d} spent last week locked in a glass case at the town museum, labelled UNKNOWN CREATURE, c. 1740.', lines: [
        ['d', 'A glass case. Locked. A little card, and a rope so nobody gets too close.'],
        ['narrator', '({d} produces the card. It says: UNKNOWN CREATURE, c. 1740. PLEASE DO NOT TAP THE GLASS.)'],
        ['d', 'They tapped the glass.']] },
      { ask: 'Call the exhibit from the next case along.', clue: 'Susan, in the next case along, says {d} did not move all week.', lines: [
        ['npc', 'I was in case fourteen. {d} was in case thirteen. Nobody moved all week.', 'susan'],
        ['npc', 'A school trip drew us both. I came out better. I have the drawing.', 'susan']] },
      { ask: 'Ask the lamp what it has seen.', clue: 'The Lamp has watched {p} get up at three every night and push its own bed an inch nearer.', lines: [
        ['npc', 'Every night at three, {p} gets up, pushes its bed one inch nearer to me, and goes back to sleep.', 'lamp'],
        ['judge', 'And you said nothing?'],
        ['npc', 'I did not want it to stop.', 'lamp']] },
      { ask: 'Have the bailiff measure how far the bed has come.', happen: 'dark', lines: [
        ['bailiff', 'Seven inches, Your Honour. All towards the lamp. At this rate it arrives on Thursday.'],
        ['npc', 'I have tidied.', 'lamp']] },
      { ask: 'Tell {d} that being in a museum is showing off.', sass: true, lines: [
        ['judge', '{d}. I have been dead for three hundred years and no museum has ever asked for me.'],
        ['d', 'Have you asked them?'],
        ['judge', 'I have written. Twice. They sent back a leaflet about leaving your body to science.']] },
      { ask: 'Ask {d} what it thinks of {p}’s bed.', happen: 'outburst', party: 'p', lines: [
        ['d', 'Cheap. Damp. The drawer end sticks. I would not be seen dead pushing it, and I am in a museum.']] }
    ],
    rulings: {
      plaintiff: [
        ['judge', 'Judgment for {p}. {d} will keep its hands off the bed.'],
        ['narrator', '(That night, at three, the bed moves one inch nearer the lamp. {d} is asleep on the far side of the shelf, under an upturned glass.)']],
      defendant: [
        ['judge', 'Judgment for {d}, who was in a locked case with a card, a rope and a witness. It is the best alibi this court has ever heard, and I have heard “I was dead”.'],
        ['judge', '{p}, it is you. It has been you every night. The lamp would like you to know it is flattered.'],
        ['npc', 'Deeply.', 'lamp']],
      both: [
        ['judge', 'You are both peculiar. One of you pushes furniture at a lamp in its sleep. The other hires itself out as an antique.'],
        ['judge', 'The bed will be nailed down, and {d} goes back in its case until somebody claims it.']]
    },
    hallway: { p: 'I’ve tied the bed down with a shoelace. This morning it was next to the lamp. So was the shoelace.', d: 'I’m going back to the museum. They appreciate me there. There’s a little rope.' }
  },
  {
    id: 'shared-headstone', title: 'Here Lie', truth: 'both',
    claim: '{p} is suing {d} for chiselling {p}’s name off the headstone they bought together.',
    asking: 'The name put back, in letters the same size as {d}’s',
    plaintiff: [
      ['p', 'We bought a headstone together. For eventually. Two names, one stone, a little carved dove.'],
      ['p', 'Last week {d} chiselled my name off. Now it just says HERE LIE. And a dove.'],
      ['judge', 'Here lie.'],
      ['p', 'Which, on this shelf, is accurate.']
    ],
    defendant: [
      ['d', '{p} started it. On Tuesday MY name came off. I was only evening things up.'],
      ['d', 'And the dove is mine. I paid for the dove.']
    ],
    questions: [
      { ask: 'Have the bailiff search both slots.', clue: 'There is a blunt chisel in {p}’s slot and another in {d}’s. Both are covered in stone dust.', lines: [
        ['bailiff', 'One chisel in each slot, Your Honour. Both blunt. Both covered in stone dust.'],
        ['judge', 'Two chisels. For one stone.'],
        ['bailiff', 'And in {p}’s slot, a second, smaller dove. Half carved. It looks furious.']] },
      { ask: 'Call the resident who lives under the stone.', clue: 'Geoffrey the Second watched one name come off on Tuesday and the other on Wednesday.', lines: [
        ['npc', 'I live under that stone. On Monday it had two names. On Tuesday, one. On Wednesday, none.', 'geoffrey2'],
        ['judge', 'And now?'],
        ['npc', 'Now it just calls everybody liars. I have never felt so seen.', 'geoffrey2']] },
      { ask: 'Ask {p} what it chiselled first.', clue: '{p} admits it took {d}’s name off first, “to make room”.', lines: [
        ['p', 'Nothing. I tidied. I made room.'],
        ['judge', 'Room for what?'],
        ['p', 'A bigger me.']] },
      { ask: 'Point out that neither of them is going to die.', sass: true, lines: [
        ['judge', 'Neither of you is dead. Neither of you is ever going to be dead. Who is this stone for?'],
        ['d', 'We visit it on Sundays.'],
        ['p', 'We take a flask.']] },
      { ask: 'Ask {d} about the dove.', happen: 'throw', lines: [
        ['d', 'I paid for the dove. The dove is mine. {p} sits on the dove.'],
        ['p', 'It is the only flat bit.']] },
      { ask: 'Ask the jury who deserves the top line.', lines: [
        ['jury', '{j} says the top line should go to whoever dies first.'],
        ['narrator', '(The court waits. Nobody volunteers. The bailiff edges towards the door.)']] }
    ],
    rulings: {
      plaintiff: [
        ['judge', 'Judgment for {p}. {d} carves {p}’s name back on, in full, the same size.'],
        ['narrator', '(The stone now reads HERE LIE {p}. {p} is delighted with it. Nobody has the heart.)']],
      defendant: [
        ['judge', 'Judgment for {d}. {p} started it, and you do not chisel a friend on a Tuesday.'],
        ['d', 'Can I have the top line?'],
        ['judge', 'There is no top line. There is a dove.']],
      both: [
        ['judge', 'You are both vandals. That stone says HERE LIE, and it is the most honest thing either of you owns.'],
        ['judge', 'Both names go back on, side by side, the same size. The dove stays in the middle, to keep you apart.']]
    },
    hallway: { p: 'We’re still going on Sunday. Opposite ends. I’m bringing the flask. {d} isn’t getting any.', d: 'I’m getting my own stone. Just me. Enormous. Two doves.' }
  },
  {
    id: 'tontine', title: 'The Tontine', truth: 'both',
    claim: '{p} is suing {d} for not dying. They have had a bet since 1908: last one left gets the tin.',
    asking: 'One tin of travel sweets, unopened since 1908, and for {d} to get on with it',
    plaintiff: [
      ['p', 'In 1908 {d} and I made a bet. One tin of travel sweets. Whoever is left at the end gets the tin.'],
      ['p', 'That was a long time ago, and {d} is still here. I have been extremely patient.'],
      ['judge', 'That is a tontine. They were banned. People kept falling down the stairs.'],
      ['p', 'I have not pushed anybody. I have only been hopeful near stairs.']
    ],
    defendant: [
      ['d', 'I am not dying for a tin of sweets, Your Honour. I have looked into dying. It is not worth it for sweets.'],
      ['d', 'And a bet is a bet. I intend to be the one left. I am very good at being left.']
    ],
    questions: [
      { ask: 'Have the bailiff open the tin.', clue: 'The sweets in the tin are buttons, each one carefully painted to look like a sweet.', lines: [
        ['narrator', '(The bailiff prises the lid off. The tin is full of buttons, each one painted, quite carefully, to look like a sweet.)'],
        ['judge', 'Who paints buttons to look like sweets?'],
        ['d', 'Somebody with a lot of time, Your Honour. So, any of us.'],
        ['bailiff', '(chewing) These are not sweets.']] },
      { ask: 'Ask {d} what flavour the sweets were.', clue: '{d} knows the sweets were lemon and slightly fizzy. The tin only says ASSORTED.', lines: [
        ['d', 'Lemon. Slightly fizzy. A bit dusty by the end, but lovely.'],
        ['judge', 'The tin says ASSORTED.'],
        ['d', 'Does it? Then I have no idea. Never met them.']] },
      { ask: 'Have the bailiff examine the lid.', clue: 'Someone has been at the lid with a hairpin for years, from the side that faces {p}’s slot.', lines: [
        ['bailiff', 'Hundreds of little scratches round the lid, Your Honour. All on the side facing {p}’s slot.'],
        ['bailiff', 'And half a hairpin, snapped off in the rim.'],
        ['p', 'Everybody has a hairpin.'],
        ['judge', 'Not in the rim of the tin, {p}.']] },
      { ask: 'Explain to {p} how long “the end” is.', sass: true, lines: [
        ['judge', '{p}. Neither of you can die. This bet ends when the sun goes out, and I would not put money on it even then.'],
        ['p', 'I can wait.'],
        ['d', 'So can I.'],
        ['narrator', '(They look at each other. Neither of them blinks. Neither of them has blinked since 1908.)']] },
      { ask: 'Call the witness to the bet.', lines: [
        ['npc', 'I witnessed it. 1908. A Tuesday. They shook hands on it.', 'raven'],
        ['npc', 'Then, when the other one was not looking, they both wiped their hands on me.', 'raven']] },
      { ask: 'Ask {p} what it would do with the tin.', happen: 'outburst', party: 'd', lines: [
        ['p', 'Open it. Eat one. Visit {d}. Eat another one.'],
        ['judge', 'Visit {d} where?'],
        ['p', 'I have picked out a spot. It has a view.']] }
    ],
    rulings: {
      plaintiff: [
        ['judge', 'Judgment for {p}. {d} is declared to have lost. That is as close to dead as this court can get you.'],
        ['narrator', '({p} opens the tin. It is buttons.)'],
        ['p', 'I would like to appeal my own win.']],
      defendant: [
        ['judge', 'Judgment for {d}. This court does not hurry anybody along. Not even for sweets.'],
        ['narrator', '({d} takes the tin home and gives it a shake. It rattles like buttons. {d} does not look surprised.)']],
      both: [
        ['judge', 'You are both cheats. One of you has been at the lid with a hairpin for sixty years. The other ate the prize in 1911 and painted the buttons.'],
        ['judge', 'The bet stands. It will outlive everyone in this room, and I am already dead.']]
    },
    hallway: { p: 'I can wait. I’ve waited since 1908. The tin will rust before I do.', d: 'Lemon. They were lemon. I think about them most days.' }
  }
];

/* Scenes that break out mid-episode. `choice` scenes wait for you: bang the
   gavel (the jury respects order) or let it play out (the audience loves
   it). {x} is whoever is losing it; `x` lines are spoken by them. */
export const HAPPENINGS = {
  outburst: { anim: 'outburst', choice: true,
    intro: [['narrator', '({x} climbs onto the podium.)']],
    rants: [
      'THIS IS A SHAM. I HAVE BEEN ON THIS SHELF SINCE BEFORE THE SHELF. I AM PRACTICALLY LOAD-BEARING.',
      'YOU ARE ALL IN ON IT. THE MOTH. THE WALL. THE SKELETON. ESPECIALLY THE SKELETON. LOOK AT HIS FACE. HE HASN’T GOT ONE.',
      'I WILL NOT BE SILENCED BY A MAN WITH NO THROAT.',
      'I WANT IT NOTED THAT I AM CRYING. BAILIFF. NOTE IT. NOT WITH A DRAWING.',
      'I AM WRITING A STRONGLY WORDED LETTER. THEN I AM EATING IT. THAT IS HOW STRONGLY WORDED IT IS.'
    ],
    gavel: [['judge', 'SIT. DOWN. I have been dead for three hundred years and I have never been this tired.'], ['narrator', '({x} sits down and sulks at a volume the microphones can pick up.)']],
    let: [['narrator', '({x} goes on for four minutes. At one point it sings. At another point it lies down. The audience gives the lying down a standing ovation.)'], ['judge', 'Are you finished?'], ['x', 'I have a second verse.']] },
  sleep: { anim: 'sleep', choice: true,
    intro: [['narrator', '({j} has fallen asleep in the jury box. {j} is snoring in the key of D.)']],
    gavel: [['judge', 'WAKE UP, {j}.'], ['narrator', '({j} wakes up and shouts “GUILTY”. There is nothing to be guilty of yet. {j} stands by it.)']],
    let: [['narrator', '({j} sleeps through the rest of the case. {j} will still be voting. {j} has already decided.)'], ['audience', '(A ghost in the front row starts snoring in harmony. It is quite beautiful.)']] },
  throw: { anim: 'throw', choice: true,
    intro: [['narrator', '({d} has thrown a tooth at {p}.)']],
    gavel: [['judge', 'Bailiff. Confiscate every tooth in the building.'], ['bailiff', 'That will take a while, Your Honour. Uncle is here.']],
    let: [['narrator', '({p} throws it back. {d} throws a shoe. Nobody here wears shoes. The shoe is the bailiff’s. The bailiff says nothing.)'], ['audience', '(The audience chants “SHOE. SHOE. SHOE.”)']] },
  heckle: { anim: 'heckle', choice: true,
    intro: [['audience', '(A ghost in row two stands up: “{p} IS A FRAUD. I WENT ON A DATE WITH {p} IN 1850.”)']],
    gavel: [['judge', 'Sit down or be exorcised. Bailiff, exorcise him a little.'], ['bailiff', '(The bailiff flicks salt at the ghost. The ghost sits down, lightly seasoned.)']],
    let: [['audience', '(The ghost describes the date in detail. It was a picnic. It rained. {p} ate the blanket.)'], ['p', 'IT WAS A VERY GOOD BLANKET.']] },
  faint: { anim: 'faint', ratings: 6,
    intro: [['narrator', '(A ghost in the front row faints. It was already dead, so this is mostly theatre.)'], ['audience', '(Two more faint in solidarity. One of them is doing it wrong.)']] },
  dark: { anim: 'dark', ratings: 6,
    intro: [['narrator', '(The studio lights go out.)'], ['judge', 'Everybody stay calm. Somebody is licking my hand. Bailiff, is that you?'], ['bailiff', 'No, Your Honour.'], ['narrator', '(The lights come back on. Nobody is near the judge. The judge’s hand is wet. Nobody discusses it.)']] },
  cat: { anim: 'cat', ratings: 6,
    intro: [['narrator', '(Sir Reginald Whiskers strolls across the judge’s bench, knocks the gavel onto the floor, and leaves without eye contact.)'], ['judge', 'Who let the cat in?'], ['bailiff', 'Nobody lets the cat in, Your Honour. The cat arrives.']] },
  applause: { anim: 'applause', ratings: 6,
    intro: [['narrator', '(The APPLAUSE sign has jammed on. The audience cannot stop clapping. They are exhausted. One of them has died again.)']] },
  eat: { anim: 'eat', ratings: 6,
    intro: [['narrator', '(Bailiff Rattigan has eaten Exhibit B.)'], ['judge', 'What was Exhibit B?'], ['bailiff', 'I would rather not say, Your Honour. It was a raisin.']] },
  jaw: { anim: 'jaw', ratings: 6,
    intro: [['narrator', '(Uncle’s jaw has fallen off in the gallery. It is still talking. It is heckling.)'], ['audience', '(The jaw, from under a seat: “BOOOOOO.”)']] },
  moth: { anim: 'moth', ratings: 6,
    intro: [['narrator', '(Madam Moth has flown into the studio light. The light has won. Madam Moth has never been happier.)']] }
};
export const RANDOM_HAPPENINGS = ['sleep', 'throw', 'heckle', 'faint', 'dark', 'cat', 'applause', 'eat', 'jaw', 'moth', 'outburst'];

export const OPENERS = [
  'Real residents. Real disputes. Real dead. This… is SHELF COURT.',
  'No lawyers. No appeals. No pulse. This is SHELF COURT.',
  'Filmed in front of a live studio audience, who are not. This is SHELF COURT.',
  'Two residents. One grievance. Absolutely no chance of anybody learning anything. This is SHELF COURT.',
  'The cases are real. The residents are real. The judge was real, in 1702. This is SHELF COURT.'
];
export const ALL_RISE = [
  'All rise for the Honourable Judge Mortis. The dead may remain seated. The dead always remain seated.',
  'All rise. Judge Mortis presiding. Please stop licking the benches. They have been varnished, and now, so have you.',
  'All rise for Judge Mortis: three hundred years on the bench, two hundred and ninety of them in the ground.'
];
export const JUDGE_ENTRANCES = [
  'Sit down. I have been dead since 1702 and I still have better places to be. Specifically, a hole.',
  'I have no ears and I can already hear you lying. Sit.',
  'I have no eyelids, so I cannot roll my eyes at you. Imagine that I am. Imagine it very hard.',
  'I am speaking. When I am speaking, you are not. That rule was true when I had lips and it is truer now.',
  'Sit. I have seen empires fall and plagues come and go. Let us see if you two can top either.'
];
export const PLAINTIFF_CUE = ['{p}. You are suing {d}. Talk. Short sentences. I am decomposing.', '{p}, you brought this. Tell me why, and tell me before I rot.', 'Plaintiff. Go. I have no brain, so keep it simple.'];
export const DEFENDANT_CUE = ['{d}. Your side. And do not tell me it was an accident. Nothing on this shelf is an accident. It is all on purpose, badly.', '{d}. Speak. Carefully. I can see right through you, and I do not even have eyes.', 'Defendant. Your turn. Impress me. Nobody has since 1702.'];

export const ADS = [
  { brand: 'KEITH REMOVALS', lines: ['Is your loved one dead? Are they also still in the house?', 'Call Keith. Keith removes. Keith does not ask questions. Keith has a van.'] },
  { brand: 'COFFIN-FRESH', lines: ['For that just-buried smell, wherever you go.', 'Now in Wet Earth, Old Lace and Grandad.'] },
  { brand: 'UNCLE’S DISCOUNT DENTURES', lines: ['Teeth from every era. Most of them previously owned. Some of them previously Uncle.', 'They still bite. No refunds. No receipts. No gums.'] },
  { brand: 'THE RETIREMENT DRAWER', lines: ['Tired of being alive? So is everybody at the Retirement Drawer.', 'Ask about our All-Eternity package. The lid is complimentary.'] },
  { brand: 'MINISTRY OF HAUNTING', lines: ['An unlicensed ghost is a sad ghost. It is also a forty soul fine.', 'Renew today. Moaning after eleven requires a permit. Clanking requires two.'] },
  { brand: 'MADAM MOTH’S LAMP EMPORIUM', lines: ['Every lamp is a friend.', 'Some lamps are lunch. We do not say which.'] },
  { brand: 'PAWN & POUNCE', lines: ['We buy eyes, teeth, and anything left on a table.', 'Sir Reginald Whiskers, proprietor. He is looking at your table right now.'] },
  { brand: 'DUST', lines: ['Dust. It gets everywhere.', 'Dust: you will be it. Shelf Court is brought to you by Dust.'] },
  { brand: 'THE GARDEN LYING-DOWN SOCIETY', lines: ['Feeling low? Try lying down in the garden.', 'We will come back for you. Probably. Thursday at the latest.'] },
  { brand: 'RATTIGAN’S RAISIN EXCHANGE', lines: ['Raisins bought and sold. Including raisins you left on a little shelf in a coffin.', 'Rattigan’s. We are not the bailiff. Stop asking.'] }
];
export const BREAK_IN = ['We’ll be right back after these messages from people who are also dead.', 'Don’t go anywhere. You can’t. You’re on a shelf.'];
export const BREAK_OUT = ['And we’re back. The judge has not moved. We are checking.', 'Welcome back to Shelf Court. Nobody has left. The doors do not open. We are looking into it.'];

export const JURY_AGREE = ['{j} nods so hard something falls off.', '{j} says “obviously” and folds its arms. It was not listening.', '{j} agrees, then agrees again, louder, in case the first one did not count.', '{j} gives a thumbs up. {j} does not have thumbs. It is still somehow a thumbs up.'];
export const JURY_DISAGREE = ['{j} boos. It is the first thing it has said all day.', '{j} throws a raisin at the bench. The bailiff catches it in his mouth.', '{j} says it would have ruled with its heart, which it keeps in a jar, which it has brought.', '{j} turns its back on the court. It was already facing the wrong way.'];
export const AUDIENCE_REACTIONS = [
  ['(Silence. One ghost coughs. It echoes for longer than a cough should.)', '(Somebody in the audience says “huh”. It is not a good “huh”.)'],
  ['(Polite applause. The kind you hear at the funeral of somebody nobody liked.)', '(The audience claps. Some of them are still clapping from a previous episode.)'],
  ['(The audience cheers. A ghost throws its hat. The hat is also a ghost. It comes back.)', '(Big applause. The APPLAUSE sign did not even have to light up. It lights up anyway, jealous.)'],
  ['(The audience loses its mind. Three ghosts faint. One proposes to the bailiff. The bailiff says he will think about it.)', '(Standing ovation. The dead are on their feet. They do not have feet. It is still very moving.)']
];
export const HALLWAY_IN = ['Outside the courtroom…', 'In the hallway, moments later…', 'Our cameras caught up with them by the vending machine…', 'We asked for a comment. We got one.'];

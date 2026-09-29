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

// Several takes of one beat of script; the engine plays one per episode.
export const alt = (...sets) => ({ alt: sets });

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
    plaintiff: alt([
      ['p', 'I lent {d} my coffin for a nap. One nap. It came back with a man in it.'],
      ['p', 'His name is Keith. I know that because it is written on his hand. In {d}’s handwriting.'],
      ['judge', 'And what do you want, {p}?'],
      ['p', 'My coffin, Keith-free. And forty souls for every night I have lain awake wondering if Keith is comfortable.']
    ], [
      ['p', 'Your Honour, I lent {d} my coffin for one nap. It came back heavier.'],
      ['judge', 'Heavier.'],
      ['p', 'By one Keith. I have asked him to leave, twice. He just lies there, like he owns the place.'],
      ['judge', 'He is dead, {p}.'],
      ['p', 'He is SMUG.']
    ]),
    defendant: alt([
      ['d', 'It was a nap, Your Honour. It is still a nap. It is just a very long nap.'],
      ['d', 'Keith needed it more. Keith had a terrible Tuesday. His last one.'],
      ['judge', 'So you lent out a coffin that was not yours. To a Keith.'],
      ['d', 'When you say it, it sounds bad. When I say it, I am a hero.']
    ], [
      ['d', 'I am not a monster, Your Honour. Keith was cold. Keith was damp. Keith was in the mint.'],
      ['d', '{p} was not using the coffin. {p} was alive. It seemed wasteful.'],
      ['judge', 'You gave away a coffin because its owner was alive.'],
      ['d', 'It was just sitting there, Your Honour. Being a coffin. At nobody.']
    ]),
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
      plaintiff: alt([
        ['judge', 'Judgment for {p}. You do not lend out what is not yours, and you do not fill it with Keiths.'],
        ['judge', '{d} pays forty souls, returns the coffin, and tells both Keiths, in person, that they have to leave.'],
        ['d', 'Where do the Keiths go?'],
        ['judge', 'Your slot. You love Keith so much.']], [
        ['judge', 'Judgment for {p}. A coffin is personal. You do not put a Keith in it without asking. You barely put a Keith anywhere without asking.'],
        ['judge', '{d} pays forty souls and finds Keith somewhere else to be.'],
        ['d', 'He likes it there.'],
        ['judge', 'Then he can come back when he has his own coffin, like an adult.']]),
      defendant: alt([
        ['judge', 'Judgment for {d}. Keith needed it more.'],
        ['p', 'KEITH ISN’T EVEN HERE.'],
        ['judge', 'Keith is exactly where Keith should be, {p}. Which is more than anyone can say for you.'],
        ['audience', '(A ghost at the back whispers “justice for Keith”. It catches on.)']], [
        ['judge', 'Judgment for {d}. Keith is at peace. Keith has never looked better. I will not disturb a man who has finally found somewhere to lie down.'],
        ['p', 'IT IS MY COFFIN.'],
        ['judge', 'It is Keith’s coffin now, {p}. Possession is nine tenths of the law, and Keith is extremely possessed.']]),
      both: alt([
        ['judge', 'You are both idiots. {p}, never lend a coffin to anyone who says “nap” with that face. {d}, stop collecting Keiths.'],
        ['judge', 'The coffin goes to Keith.'],
        ['p', 'KEITH gets the coffin?'],
        ['judge', 'Keith is the only one in this case who has not lied to me.']], [
        ['judge', 'Neither of you gets the coffin. {p} lent it to a liar, {d} filled it with a stranger, and the only one who behaved well is dead.'],
        ['judge', 'Keith keeps the coffin. The raisin shelf is to be emptied. Bailiff, stop smiling.']])
    },
    hallway: {
      p: ['I’ve moved in with Keith. Out of spite. He hasn’t said no.',
        'I’ve left Keith a note. It says “leave”. He hasn’t read it. He hasn’t done anything.',
        'I’m getting a new coffin. With a lock. Keith can’t pick a lock. Keith can’t do anything.'],
      d: ['Keith and I are very happy. Keith hasn’t said so. Keith hasn’t said anything. That’s what I like about Keith.',
        'I stand by Keith. Somebody has to. Keith can’t.',
        'I’m starting a charity. For Keiths. There are more of them than you’d think.']
    }
  },
  {
    id: 'snoring-wall', title: 'The Snoring', truth: 'defendant',
    claim: '{p} is suing {d} for snoring so loudly the paint came off the wall.',
    asking: 'A new wall, and ninety years of sleep',
    plaintiff: alt([
      ['p', 'Every night {d} snores. It sounds like a drain being strangled by a smaller drain.'],
      ['p', 'The paint has come off the wall. The wall is bare brick now. The brick looks tired.'],
      ['judge', 'You want ninety years of sleep. How old are you?'],
      ['p', 'Seven. I sleep very badly.']
    ], [
      ['p', '{d} snores, Your Honour. Every night. I have timed it. It starts at eleven and ends at the heat death of the universe.'],
      ['p', 'Last week it snored so hard a picture fell off the wall. It was a picture of me. I took that personally.'],
      ['judge', 'And you are asking for ninety years of sleep.'],
      ['p', 'I am being reasonable.']
    ]),
    defendant: alt([
      ['d', 'I do not snore, Your Honour. I sleep on my back, arms crossed, completely silent. Like a lid.'],
      ['d', 'I hear it too. I assumed it was {p}. It sounds like someone who eats in bed.'],
      ['p', 'I DO eat in bed.'],
      ['judge', 'That is not the point you think it is.']
    ], [
      ['d', 'Your Honour, I do not snore. Nobody has ever heard me snore. I sleep like a tomb. I have been told so by a tomb.'],
      ['d', 'If anything, the snoring keeps ME awake. I lie there listening, thinking: {p}, you animal.']
    ]),
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
      plaintiff: alt([
        ['judge', 'Judgment for {p}. {d} sleeps in the drawer until the snoring stops.'],
        ['narrator', '(That night {d} sleeps in the drawer. The wall snores louder than ever. It asks for Margaret twice.)'],
        ['p', 'I would like to reopen the case.'],
        ['judge', 'Denied. I am asleep.']], [
        ['judge', 'Judgment for {p}. {d} will wear a peg on its nose every night until further notice.'],
        ['narrator', '(That night {d} wears the peg. The snoring carries on, louder, from inside the wall. Nobody says anything. Everybody knows.)']]),
      defendant: alt([
        ['judge', 'Judgment for {d}. The snorer is the wall, and the wall is a dead man called Pemberton. {p} has spent a month shouting at the only quiet thing on the shelf.'],
        ['judge', '{p} owes {d} an apology and a pillow. Mr Pemberton owes everybody an explanation, and a Margaret.'],
        ['narrator', '(The wall snores, gently, in agreement.)']], [
        ['judge', 'Judgment for {d}. {p} has accused the one resident on this shelf who sleeps in total silence, and ignored a wall with a dead man in it.'],
        ['judge', '{p} will apologise to {d}, then to Mr Pemberton, then go to bed like everybody else.'],
        ['p', 'I CAN’T GO TO BED. THAT IS THE WHOLE CASE.']]),
      both: alt([
        ['judge', 'You are both wrong about everything. You sleep next to a dead man in a wall and blame each other.'],
        ['judge', 'Buy earplugs. Buy the wall a Margaret. Get out of my court.']], [
        ['judge', 'You are both wrong, you are both tired, and it is the wall.'],
        ['judge', 'Swap slots. Then at least you will each be kept awake by something new.']])
    },
    hallway: {
      p: ['The wall is covering for {d}. They’re close. I’ve seen them.',
        'I’m sleeping in the bucket now. It’s quieter. It smells, but it’s quieter.',
        'I heard “Margaret” again on the way out. It was coming from {d}. I know it was.'],
      d: ['Convicted of snoring by a court that takes evidence from a wall. I’m going to go and lie down. Silently. At it.',
        'I’ve never snored in my life. I’ve never done anything in my life. It’s my best quality.',
        'I’m going to buy the wall a Margaret. Maybe then it’ll shut up.']
    }
  },
  {
    id: 'stolen-slot', title: 'The Warm Slot', truth: 'both',
    claim: '{p} is suing {d} for taking its slot on the shelf while {p} was out being ill in a bucket.',
    asking: 'The slot back, and the smell removed',
    plaintiff: alt([
      ['p', 'I was ill for one afternoon. ONE. I come back and {d} is in my slot. In my shape. In my smell.'],
      ['p', 'It was still warm from me. {d} was using my warmth. Second-hand.'],
      ['judge', 'How ill were you?'],
      ['p', 'Bucket ill, Your Honour.']
    ], [
      ['p', 'I leave my slot for ONE afternoon, Your Honour, and come back to find {d} lying in it with its eyes shut, pretending to be me.'],
      ['p', 'It had even done my face. Badly.'],
      ['judge', 'Why were you out all afternoon?'],
      ['p', 'A bucket, Your Honour. I would rather not go into the bucket.']
    ]),
    defendant: alt([
      ['d', 'An empty slot is like an empty chair at a funeral. Somebody sits in it, or people talk.'],
      ['d', 'Also, I had heard {p} was dead. I was keeping it warm for the next of kin. I am the next of kin. I checked.']
    ], [
      ['d', 'Your Honour, I was told {p} had passed on. I did the decent thing. I moved in before the vultures.'],
      ['judge', 'Which vultures?'],
      ['d', 'Me, Your Honour. I was the vultures. I got there first.']
    ]),
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
      plaintiff: alt([
        ['judge', 'Judgment for {p}. You get ill, you get your slot back. That is basic decency, which I gather is rare on this shelf.'],
        ['d', 'Can I at least keep the smell?'],
        ['judge', 'The smell stays. You go.']], [
        ['judge', 'Judgment for {p}. Nobody is dead until I say so, I have not said so, and I am the expert.'],
        ['judge', '{d} returns the slot tonight, unwarmed.']]),
      defendant: alt([
        ['judge', 'Judgment for {d}. {p} stole this slot first and weeps when it is stolen back. That is called karma. It is also called a bucket.'],
        ['p', 'This is a MISCARRIAGE of JUSTICE.'],
        ['judge', 'This is a plank.']], [
        ['judge', 'Judgment for {d}. {p} stole this slot first, from a resident in a bucket, and now wants the court to be shocked. The court is not shocked. The court is a skeleton.'],
        ['p', 'So I just lose my slot?'],
        ['judge', 'You lost it in the spring. You only found out today.']]),
      both: alt([
        ['judge', 'You are both slot thieves. {p} took it in the spring. {d} took it back in a bucket-based ambush. You deserve each other, and the plank deserves better.'],
        ['judge', 'You share the slot on alternate days, and you both clean the bucket.'],
        ['audience', '(Somebody at the back shouts “THE BUCKET”. It becomes a chant.)']], [
        ['judge', 'You are both vultures, and you are both in buckets, spiritually.'],
        ['judge', 'The slot is closed until you learn to share. It will be closed for a very long time.']])
    },
    hallway: {
      p: ['I’ll get it back. I have a bucket. I am not afraid to use it.',
        'I’m going to be ill again, on purpose, and see who moves in. Then I’ll know.',
        'Alternate days. Fine. My days are going to be very long.'],
      d: ['Fine. We share. I get the warm side. There is no warm side. I’ll make one.',
        'I’m not giving it back. I’m just going to lie in it until everyone forgets. I can lie very still.',
        'The slot knows who loves it. It smells of me now. Mostly.']
    }
  },
  {
    id: 'early-eulogy', title: 'The Early Eulogy', truth: 'plaintiff',
    claim: '{p} is suing {d} for delivering {p}’s eulogy while {p} was alive, in the front row, eating a salad.',
    asking: 'A retraction, a nicer eulogy, and the flowers back',
    plaintiff: alt([
      ['p', 'There was a misunderstanding about a nap, and I attended my own funeral as a guest.'],
      ['p', '{d} stood up and said I was “mostly fine” and “a bit much”. I was in the front row. I had brought a salad.'],
      ['judge', 'You brought a salad to your own funeral.'],
      ['p', 'I did not know it was mine until the hymns.']
    ], [
      ['p', 'Your Honour, I went to a funeral. I sat at the front. I thought, what a lovely turnout. Then {d} said my name.'],
      ['p', '{d} said I was “mostly fine”. The moth nodded. The moth NODDED.'],
      ['judge', 'Are you upset about the funeral or the review?'],
      ['p', 'Both, Your Honour. Mostly the review.']
    ]),
    defendant: alt([
      ['d', '“Mostly fine” is a lovely thing to say. It is the nicest thing anyone has ever said about anybody, and I was the one saying it.'],
      ['d', 'And once the cake is bought, Your Honour, somebody is getting buried.']
    ], [
      ['d', 'Your Honour, somebody had to say something. Nobody else had prepared anything. I had prepared three words.'],
      ['d', 'And I did not know {p} was alive. I thought it was just being polite at the front. Like a good corpse.']
    ]),
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
      plaintiff: alt([
        ['judge', 'Judgment for {p}. You do not eulogise the living. You do not invoice at a graveside. You do not take the flowers home in a jar.'],
        ['judge', 'Next time somebody is lying very still, {d}, you poke them. Once. Firmly.'],
        ['d', 'Can I keep the speech for when it is real?'],
        ['judge', 'Put it in a drawer. We all have one.']], [
        ['judge', 'Judgment for {p}. A eulogy is for the dead, {d}. Not the quiet. Not the sleepy. Not somebody holding a salad.'],
        ['judge', '{d} will write {p} a new eulogy, a glowing one, and read it at the next funeral {p} attends as a guest.'],
        ['d', 'Which one is that?'],
        ['judge', 'All of them, by the sound of it.']]),
      defendant: alt([
        ['judge', 'Judgment for {d}. {p}, if you do not want a funeral, stop lying so still. The eulogy stands. You are officially “mostly fine”.'],
        ['p', 'I am MORE than mostly fine.'],
        ['judge', 'Not according to the record.']], [
        ['judge', 'Judgment for {d}. A funeral was booked, a eulogy was due, and {d} delivered one. {p} was simply early to its own.'],
        ['p', 'I was ALIVE.'],
        ['judge', 'A technicality. There will be others.']]),
      both: alt([
        ['judge', 'You are both morbid. One of you lies still for attention. The other one books a hall.'],
        ['judge', 'You will each write the other a eulogy. A nice one. And read them at the same time, over each other, like a normal family.']], [
        ['judge', 'You are both ghouls. One of you plays dead for sympathy, and the other sells tickets to it.'],
        ['judge', 'The flowers go to the moth. The salad goes in the bin. Neither of you gets another funeral until you have earned one.']])
    },
    hallway: {
      p: ['I’m going to die just to prove a point. Not today. When it’s inconvenient for {d}.',
        'I read the eulogy back. “A bit much.” I’m having it engraved. To annoy {d}.',
        'Next time I’m bringing a speech. For {d}. I’ll be ready.'],
      d: ['I’ve kept the flowers. They’re pre-grieved. Ready to go.',
        'I’ve started {p}’s next eulogy. It’s longer. It’s worse.',
        'Nobody thanks the eulogist. Nobody. I did three words and the moth cried.']
    }
  },
  {
    id: 'haunted-sock', title: 'The Haunted Sock', truth: 'defendant',
    claim: '{p} is suing {d} for borrowing one sock and returning it possessed.',
    asking: 'One sock, exorcised, and damages for the whispering',
    plaintiff: alt([
      ['p', 'I lent {d} one sock. For warmth. It came back whispering.'],
      ['p', 'Every night it says my name. Then it says “wrong”. Just “wrong”. Like it has read my diary.'],
      ['judge', 'Where is the sock now?'],
      ['bailiff', 'In a jar, Your Honour. It is saying my name now. It knows about the raisins.']
    ], [
      ['p', 'Your Honour, I lent {d} a sock. A normal sock. It came back talking.'],
      ['p', 'Not chatting. Whispering. At night. It says my name like it is disappointed in me.'],
      ['judge', 'Is it disappointed in you?'],
      ['p', 'That is not the point. The point is, it knows.']
    ]),
    defendant: alt([
      ['d', 'That sock was haunted when I got it. I did not mention it. It seemed private.'],
      ['d', 'It kept asking for its other half. I thought it was a metaphor. It was a sock.']
    ], [
      ['d', 'Your Honour, the sock was whispering when {p} handed it over. {p} said “it does that”.'],
      ['judge', 'And you took it anyway.'],
      ['d', 'My feet were cold, Your Honour. A cold foot will put up with a lot.']
    ]),
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
      plaintiff: alt([
        ['judge', 'Judgment for {p}. {d} returns the sock, unhaunted. How is not my concern. Get a priest. A small one.'],
        ['d', 'Where do I find a small priest?'],
        ['judge', 'Try the drawer.']], [
        ['judge', 'Judgment for {p}. You borrow a sock, you return a sock. You do not return a sock with a personality.'],
        ['judge', '{d} will have it blessed, washed and folded, in that order.']]),
      defendant: alt([
        ['judge', 'Judgment for {d}. That sock was haunted before it left the drawer. {p} lent out a curse and is now billing for the side effects.'],
        ['judge', '{p} takes the sock home. It is the sock’s idea of justice too.'],
        ['narrator', '(The sock whispers “wrong” one last time. Nobody disagrees.)']], [
        ['judge', 'Judgment for {d}. That sock came out of the whispering drawer and {p} knew it. You cannot lend somebody a curse and then sue them for the curse.'],
        ['p', 'So I am stuck with it?'],
        ['judge', 'You were always stuck with it. Now it is official.']]),
      both: alt([
        ['judge', 'You are both wrong. The sock is right. The sock has been right this whole time.'],
        ['judge', 'The sock goes back in the drawer, and nobody borrows from the drawer. Nobody even looks at the drawer.'],
        ['narrator', '(Everybody looks at the drawer.)']], [
        ['judge', 'You are both idiots, and the sock is the only one here with a clear conscience.'],
        ['judge', 'The sock is released on its own recognisance. Bailiff, open the jar.'],
        ['narrator', '(The bailiff opens the jar. The sock does not leave. It likes it here now.)']])
    },
    hallway: {
      p: ['I’m going to find the other sock. Then there’ll be two. Then we’ll see who’s wrong.',
        'It’s still whispering. It’s whispering “{d}” now. So that’s something.',
        'I lent a sock and got a ghost. That’s the last time I’m nice.'],
      d: ['I miss it. It mostly whispered, but it was ours.',
        'I’m going to knit it a friend. A little sock friend. It deserves that.',
        'Honestly? That sock was the best company I’ve had all year. That says a lot about the year.']
    }
  },
  {
    id: 'dead-portrait', title: 'The Portrait', truth: 'both',
    claim: '{p} is suing {d} for painting its portrait “in a way that looks dead”.',
    asking: 'A refund, and a new portrait with more cheekbone',
    plaintiff: alt([
      ['p', '{d} painted my portrait. I sat for six hours. I look like a corpse that lost an argument.'],
      ['p', 'My eyes are two holes. My mouth is a line. There are flies. Painted flies. On me.'],
      ['judge', 'Were there real flies?'],
      ['p', 'That is not the point.']
    ], [
      ['p', 'Your Honour, I commissioned a portrait. I wanted dignified. I wanted noble. I got “recently deceased”.'],
      ['p', 'It hangs in the hall now. People lay flowers under it.'],
      ['judge', 'That is quite a compliment.'],
      ['p', 'They are SYMPATHY flowers.']
    ]),
    defendant: alt([
      ['d', 'I paint what I see. I saw a still, slightly grey resident with flies.'],
      ['d', 'It is called realism. People pay good money for realism.'],
      ['judge', 'Name one.'],
      ['d', '{p}.']
    ], [
      ['d', 'Your Honour, I am an artist. I do not flatter. I observe.'],
      ['d', 'And what I observed was a resident who sat so still, for so long, that I stopped halfway to check it had not died.'],
      ['judge', 'Had it?'],
      ['d', 'I could not tell, so I painted both possibilities.']
    ]),
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
      plaintiff: alt([
        ['judge', 'Judgment for {p}. You learned to paint on Tuesday and charged a fly fee. Full refund, and no brushes until Friday at the earliest.'],
        ['d', 'What about my art?'],
        ['judge', 'Your art is a crime scene.']], [
        ['judge', 'Judgment for {p}. You charged twelve souls for a skill you picked up on a Tuesday, and you added the flies on purpose.'],
        ['judge', '{d} refunds {p} in full and repaints it, alive, with no flies and at least one cheekbone.'],
        ['d', '{p} does not have a cheekbone.'],
        ['judge', 'Then you will paint one. That is what art is for.']]),
      defendant: alt([
        ['judge', 'Judgment for {d}. You sat like a corpse, with flies, and received a painting of a corpse, with flies. That is not a crime. That is a mirror.'],
        ['p', 'I want a second opinion.'],
        ['judge', 'The moth loves it.']], [
        ['judge', 'Judgment for {d}. {p} sat like a dead thing and was painted like a dead thing. The painting is accurate. That is the entire complaint.'],
        ['p', 'I wanted it to look like me.'],
        ['judge', 'It does. That is the problem.']]),
      both: alt([
        ['judge', 'You are both terrible. {p} sat there like a dead thing collecting flies. {d} painted it like a dead thing and billed for the flies.'],
        ['judge', 'Half refund. The painting hangs in the hall, as a warning.'],
        ['audience', '(The audience looks at the painting again. It is worse the second time.)']], [
        ['judge', 'You are both to blame. {p} posed like a corpse. {d} charged like a surgeon.'],
        ['judge', 'The flies get the painting. They are in it anyway.']])
    },
    hallway: {
      p: ['I’m hiring a professional. The spider does portraits. Mostly flies, but it knows the subject.',
        'I’m having a photograph taken. A camera can’t lie. A camera can’t add flies.',
        'I looked at it again on the way out. I don’t look dead. I look tired. There’s a difference and nobody here knows it.'],
      d: ['Critics are just people who can’t paint flies.',
        'Every great artist is misunderstood. I’m mostly misunderstood by {p}.',
        'The flies loved it. The flies are my audience now.']
    }
  },
  {
    id: 'tooth-fairy', title: 'The Tooth Fairy Job', truth: 'both',
    claim: '{p} is suing {d} for selling {p}’s teeth to the tooth fairy and keeping the money.',
    asking: 'Three souls, and the teeth back if the fairy will part with them',
    plaintiff: alt([
      ['p', 'I had three beautiful teeth in a tin. My pension. {d} put them under a pillow and the fairy paid three souls.'],
      ['p', 'Three souls, Your Honour. That was my retirement.'],
      ['judge', 'You cannot retire. You cannot die. What were you retiring from?'],
      ['p', 'This.']
    ], [
      ['p', 'Your Honour, I had three teeth in a tin. I checked on them every morning. One morning there was a coin instead.'],
      ['p', '{d} had sold them. To a FAIRY. For three souls. They were worth ten. One had a filling.'],
      ['judge', 'Whose filling?'],
      ['p', 'That is none of the court’s business.']
    ]),
    defendant: alt([
      ['d', 'Finders keepers. I found them in {p}’s tin, which is exactly where I found them.'],
      ['d', 'The fairy was thrilled. She said they were vintage. She said “where did you get these” and I said “don’t”.']
    ], [
      ['d', 'Your Honour, those teeth were just sitting in a tin, doing nothing. I put them to work.'],
      ['d', 'That is called enterprise. I have a hat now. {p} has a tin. Ask yourself which of us is winning.']
    ]),
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
      plaintiff: alt([
        ['judge', 'Judgment for {p}. {d} pays three souls and hands over the hat.'],
        ['narrator', '({d} hands over nothing. {p} puts it on. It really suits {p}.)']], [
        ['judge', 'Judgment for {p}. You do not sell another resident’s teeth, however they came by them.'],
        ['judge', '{d} pays three souls and goes to ask the fairy for them back. In person. At night.'],
        ['d', 'She only comes if you are asleep.'],
        ['judge', 'Then you had better get some sleep.']]),
      defendant: alt([
        ['judge', 'Judgment for {d}. {p} took teeth from a jar and called it a pension. {d} merely liquidated the assets.'],
        ['p', 'That is just THEFT in a TIE.'],
        ['judge', 'That is finance.']], [
        ['judge', 'Judgment for {d}. Those teeth were never {p}’s. You cannot be robbed of something you took out of Uncle’s jar.'],
        ['p', 'What do I get?'],
        ['judge', 'An empty tin and a lesson. Keep the tin.']]),
      both: alt([
        ['judge', 'Neither of you owned those teeth. They are Uncle’s. Every tooth on this shelf is Uncle’s until proven otherwise.'],
        ['judge', 'You will both pay Uncle three souls and read him a letter of apology. Slowly. Twice. He likes to hear things twice.'],
        ['narrator', '(Uncle weeps in the gallery. It sounds like marbles.)']], [
        ['judge', 'Both of you stole the same teeth from the same Uncle, one after the other, like a relay.'],
        ['judge', 'You will both apologise to Uncle, who has been drinking soup through a straw since 1911.'],
        ['npc', 'Ninety years of soup.', 'uncle']])
    },
    hallway: {
      p: ['I’ve started a new tin. Nobody tell Uncle.',
        'I’ve moved the tin. It’s under Uncle now. Nobody looks under Uncle.',
        'Three souls. For THREE TEETH. The fairy is running a racket.'],
      d: ['I still have the hat. They can’t take the hat. Nobody can find the hat.',
        'The fairy said I have a natural eye for teeth. I’m going pro.',
        'Nobody’s even complimented the hat. Not once. It’s a lovely hat.']
    }
  },
  {
    id: 'crayon-will', title: 'The Crayon Will', truth: 'plaintiff',
    claim: '{p} is suing {d} for writing itself into {p}’s will. In crayon. While {p} was asleep.',
    asking: 'The will back, and the crayon confiscated',
    plaintiff: alt([
      ['p', 'I woke up and my will had a new page. It says “And EVERYTHING to {d}”. In purple crayon. With a heart.'],
      ['p', 'I do not own a purple crayon. I own a spoon.'],
      ['judge', 'And what did the will say before?'],
      ['p', 'The spoon, to the moth.']
    ], [
      ['p', 'Your Honour, my will used to be one line long. It said: “The spoon, to the moth.” I was very proud of it.'],
      ['p', 'Now it is two pages long. The second page is mostly {d}. And a drawing of {d}. On a throne.'],
      ['judge', 'A throne.'],
      ['p', 'Made of my things.']
    ]),
    defendant: alt([
      ['d', 'I did not write it. The will wrote it. Wills are very emotional documents.'],
      ['d', 'And a heart is how I sign things. Everybody signs with a heart. It is how you know it is sincere.']
    ], [
      ['d', 'Your Honour, a will should reflect the true wishes of the deceased.'],
      ['judge', '{p} is not deceased.'],
      ['d', 'And yet, Your Honour, I can sense what it would have wanted.']
    ]),
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
      plaintiff: alt([
        ['judge', 'Judgment for {p}. {d} forged a will in crayon and could not spell the only word on it. {d} is banned from all stationery for a year.'],
        ['d', 'What about pencils?'],
        ['judge', 'ESPECIALLY pencils.']], [
        ['judge', 'Judgment for {p}. You forged a will, {d}. In crayon. With a picture of yourself on a throne. I have seen subtler coups.'],
        ['judge', 'The second page is torn out, and the spoon goes to the moth, where it belongs.'],
        ['npc', 'Finally.', 'moth']]),
      defendant: alt([
        ['judge', 'Judgment for {d}. The will has a heart on it. I am not proud of this. It was a very convincing heart.'],
        ['p', 'You are letting a CRAYON win?'],
        ['judge', 'The crayon made the better argument. In purple.']], [
        ['judge', 'Judgment for {d}. The will says what it says. I cannot unsee a heart.'],
        ['p', 'It is SPELLED WRONG.'],
        ['judge', 'So is most of the law.']]),
      both: alt([
        ['judge', 'You are both morbid. One forges wills in crayon; the other keeps a will for a spoon. New wills, both of you. Everything to the moth.'],
        ['narrator', '(Madam Moth, in the gallery, screams with joy and flies into a lamp.)']], [
        ['judge', 'You are both ridiculous. One of you forged a will. The other made a will so boring that forging it was a kindness.'],
        ['judge', 'Start again. One page each. No crayon. No thrones.']])
    },
    hallway: {
      p: ['I’m leaving everything to the wall. The wall is honest. It snores, but it’s honest.',
        'I’ve hidden my will. {d} will never find it. I will also never find it.',
        'The spoon goes to the moth. Everything else goes in the bin. {d} gets the bin.'],
      d: ['I’ll be in the will eventually. I’m patient. I have more crayons at home. I have all the colours.',
        'I didn’t forge it. I improved it. There’s a difference, and it’s the throne.',
        'I’ve written myself into everybody’s will now. Just in case.']
    }
  },
  {
    id: 'labelled-biscuit', title: 'The Labelled Biscuit', truth: 'defendant',
    claim: '{p} is suing {d} for eating a biscuit labelled “{p}’s. DO NOT EAT. I WILL KNOW.”',
    asking: 'One biscuit, and a signed admission that {p} knew',
    plaintiff: alt([
      ['p', 'The label was clear. It had my name. It said “do not eat”. It said “I will know”.'],
      ['p', 'And I knew, Your Honour. I always know.'],
      ['judge', 'How did you know?'],
      ['p', 'Crumbs on {d}’s face. A look of joy. More crumbs.']
    ], [
      ['p', 'Your Honour, I have a system. Everything that is mine has a label. The label says it is mine.'],
      ['p', 'The biscuit had a label. The label said “I WILL KNOW”. {d} ate it anyway. I knew.'],
      ['judge', 'How long did it take you to know?'],
      ['p', 'Four seconds. I was watching.']
    ]),
    defendant: alt([
      ['d', 'Your Honour, {p} labels everything. EVERYTHING.'],
      ['d', 'There is a label on me. It says “{p}’s”. I did not put it there. I woke up with it.']
    ], [
      ['d', 'Your Honour, if I stopped eating everything {p} labels, I would starve.'],
      ['d', '{p} has labelled the bowl, the water, the air in its slot and, once, the moon.']
    ]),
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
      plaintiff: alt([
        ['judge', 'Judgment for {p}. A label is a label. It said you would know. You knew. That is a contract.'],
        ['d', 'I am labelled too!'],
        ['judge', 'Then you are {p}’s as well. Congratulations. Go and sit in its slot.']], [
        ['judge', 'Judgment for {p}. The biscuit said “I WILL KNOW”. You were warned in writing. Most people never get that.'],
        ['judge', '{d} buys {p} a new biscuit, and {p} may label it however it likes.'],
        ['p', 'I will need a bigger label.']]),
      defendant: alt([
        ['judge', 'Judgment for {d}. {d} bought the biscuit, kept the receipt, and has been labelled like a jam jar. {p}, you do not own things by writing on them.'],
        ['p', 'Then how do you own things?'],
        ['judge', 'Money. Violence. Mostly money.']], [
        ['judge', 'Judgment for {d}, who bought the biscuit, has the receipt, and has been wearing somebody else’s name for a month.'],
        ['judge', '{p}, you are banned from labels until you can tell the difference between a biscuit and a friend.'],
        ['p', 'Can I label the ban?']]),
      both: alt([
        ['judge', 'You are both exhausting. One of you labels the living. The other eats a biscuit that says “I WILL KNOW” and is surprised when somebody knows.'],
        ['judge', 'All labels come off. Including the one on my bench. Including the one I have just found on my skull.']], [
        ['judge', 'You are both unbearable. {p} labels everything. {d} eats everything. This shelf is at war.'],
        ['judge', 'The labels come off, the biscuits go in a tin, and the tin goes to the bailiff for safekeeping.'],
        ['bailiff', 'I will keep them very safe, Your Honour.']])
    },
    hallway: {
      p: ['I’ve already made new labels. They say “MINE AGAIN”.',
        'They took my labels. I have more labels. I have labels for the labels.',
        'It said I WILL KNOW. I knew. That should count for something.'],
      d: ['I’m keeping my label. It’s the only thing anyone’s ever given me.',
        'I’m going to eat something with {p}’s name on it every day. As a hobby.',
        'There was a label on the courtroom door on the way out. It said “{p}’s”. I’ll allow it.']
    }
  },
  {
    id: 'fake-seance', title: 'The Séance Under the Table', truth: 'plaintiff',
    claim: '{p} is suing {d} for a séance that was “obviously just {d} under the table going woooo”.',
    asking: 'Five souls, and the real Great-Aunt Gertrude',
    plaintiff: alt([
      ['p', 'I paid {d} five souls to reach my great-aunt Gertrude. The lights went out. A voice said “woooo”.'],
      ['p', 'Gertrude never said “woooo” in her life. Gertrude said “eat something”. As a threat.']
    ], [
      ['p', 'Your Honour, I paid five souls to speak to my great-aunt Gertrude. The candles went out. The table shook. A voice said “woooo”.'],
      ['p', 'Then the table said “ow”, because I kicked it. Tables do not say “ow”, Your Honour.'],
      ['judge', 'Some do.'],
      ['p', 'Not in {d}’s voice.']
    ]),
    defendant: alt([
      ['d', 'Spirits change after death. Gertrude has grown. Gertrude now says woooo.'],
      ['d', 'I was under the table for medical reasons.']
    ], [
      ['d', 'Your Honour, the spirit world is a mystery. Sometimes the dead speak through a medium.'],
      ['d', 'And sometimes the medium has to crouch, for reasons of space.']
    ]),
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
      plaintiff: alt([
        ['judge', 'Judgment for {p}. That was not a séance. That was a con with a tablecloth. Full refund, and an apology to Gertrude, by postcard, to the pier.'],
        ['d', 'What if she writes back?'],
        ['judge', 'Then you have much bigger problems than me.']], [
        ['judge', 'Judgment for {p}. That was a crouch, not a séance, and five souls is a lot to pay to be woooed by {d}.'],
        ['judge', '{d} refunds the lot and is barred from going under any table for a year.'],
        ['d', 'What if I drop something?'],
        ['judge', 'Then it stays there.']]),
      defendant: alt([
        ['judge', 'Judgment for {d}. {p} paid for a spooky evening and got a spooky evening. There was a {d} under the table. That is spooky.'],
        ['p', 'IT WAS UNDER THE TABLE.'],
        ['judge', 'So, often, is the truth.']], [
        ['judge', 'Judgment for {d}. {p} paid for a séance and got exactly that: a dark room, a wobbly table and a ghost with opinions about money.'],
        ['p', 'The ghost was {d}.'],
        ['judge', 'The ghost was very convincing.']]),
      both: alt([
        ['judge', 'You are both fools. One of you pays for ghosts. The other one IS the ghost. You will hold a real séance, together, and ask Gertrude about the biscuits.'],
        ['narrator', '(Somewhere on a pier in Margate, Gertrude says “eat something”.)']], [
        ['judge', 'You are both frauds. One of you pretends to talk to the dead. The other only calls them when it wants biscuits.'],
        ['judge', 'Gertrude is on holiday. Leave her alone. She has earned it.']])
    },
    hallway: {
      p: ['I’m going to find those biscuits myself. With a spade.',
        'I’m going to Margate. I’m going to find Gertrude. Then the biscuits.',
        'I knew it was {d}. Gertrude never asked for money. Gertrude GAVE money. With a threat.'],
      d: ['Woooo. That’s all I’m saying, on the advice of my ghost.',
        'The spirits have spoken. They said “no comment”.',
        'I’m doing a tour. Séances, twelve souls. Table provided. Under-table extra.']
    }
  },
  {
    id: 'practice-burial', title: 'The Practice Burial', truth: 'defendant',
    claim: '{p} is suing {d} for burying it in the plant pot. Alive. “A little bit”.',
    asking: 'Twenty souls, and the soil out of its ears',
    plaintiff: alt([
      ['p', 'I woke up in the plant pot. Under the soil. With a daisy on my face.'],
      ['p', 'I dug myself out with a teaspoon. It took until Thursday.'],
      ['judge', 'Where did you get a teaspoon?'],
      ['p', 'It was in there with me. With a note. The note said “good luck”.']
    ], [
      ['p', 'Your Honour, I went to sleep in my slot and woke up in the plant pot, six inches under, holding a daisy.'],
      ['p', 'There was a sign on top. It said “RESTING”. Resting, Your Honour. Like a shop.'],
      ['judge', 'How did you get out?'],
      ['p', 'Teaspoon. Four days. I have never been so determined or so damp.']
    ]),
    defendant: alt([
      ['d', 'It asked me to. It said “I want to know what it is like”.'],
      ['d', 'I gave it a teaspoon. I gave it a daisy. I made a short speech. It is the nicest thing I have ever done for anybody, and look where it got me.']
    ], [
      ['d', 'Your Honour, {p} came to me and said “I want to know what it feels like”.'],
      ['d', 'So I made it feel like that. With a daisy. I even did a little service. I cried. Did {p} cry? No.']
    ]),
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
      plaintiff: alt([
        ['judge', 'Judgment for {p}. I do not care what the form says. You do not bury people. Not a little bit. Not with a daisy.'],
        ['d', 'Not even for practice?'],
        ['judge', 'Practise on a raisin.'],
        ['bailiff', 'Please do not bury the raisins.']], [
        ['judge', 'Judgment for {p}. A form is not permission to bury someone. Nothing is permission to bury someone. Ask me. I was buried with permission and I still object.'],
        ['judge', '{d} pays twenty souls and clears the soil out of {p}’s ears personally.'],
        ['d', 'With what?'],
        ['judge', 'The teaspoon.']]),
      defendant: alt([
        ['judge', 'Judgment for {d}. {p} ordered a burial, received a burial with a daisy and a speech, and was released on the agreed day. That is the best customer service on this shelf.'],
        ['p', 'I had soil in my EARS.'],
        ['judge', 'That comes as standard.']], [
        ['judge', 'Judgment for {d}. {p} ordered a burial, named the day, and set an alarm for it. That is not a kidnapping. That is a booking.'],
        ['p', 'I had soil in places I did not know I had.'],
        ['judge', 'And now you know. That is a gift.']]),
      both: alt([
        ['judge', 'You are both deranged. One asks to be buried for fun. The other says yes and packs a spoon.'],
        ['judge', 'No more burials unless somebody is actually dead. On this shelf, that is nobody. So: no more burials.']], [
        ['judge', 'You are both unwell. One asks to be buried, the other says yes, and neither of you thinks to ask the professional.'],
        ['judge', 'Next time, I do the burial. I have been practising for three hundred years.']])
    },
    hallway: {
      p: ['Honestly? It was very peaceful. Don’t tell {d}.',
        'I’ll admit the daisy was a nice touch. The rest wasn’t. The daisy was.',
        'I’ve booked one for {d}. I haven’t told it yet.'],
      d: ['I’m starting a business. Practice burials. Daisy included. Spoon extra.',
        'I gave it the best four days of its life and it sued me. That’s gratitude.',
        'I’m keeping the form. I’m framing it. It’s the only thank-you I’ll ever get.']
    }
  },
  {
    id: 'moth-custody', title: 'Custody of the Moth', truth: 'both',
    claim: '{p} is suing {d} for custody of Madam Moth, whom they both say they own.',
    asking: 'Full custody of the moth, and weekends with the lamp',
    plaintiff: alt([
      ['p', 'I found her first. On my ceiling. She looked at me like I was the moon.'],
      ['p', 'I have fed her. Mostly wool. Once, a sleeve.'],
      ['judge', 'Whose sleeve?'],
      ['p', 'Mine. I was in it.']
    ], [
      ['p', 'Your Honour, Madam Moth and I have something special. She sits on my head every evening. We watch the lamp together.'],
      ['p', 'Then, on Thursdays, she goes to {d}. And comes back smelling of {d}.'],
      ['judge', 'And what does {d} smell of?'],
      ['p', 'Betrayal. And wool.']
    ]),
    defendant: alt([
      ['d', 'She sleeps in MY slot. She dusts herself on MY face. That is a bond.'],
      ['d', 'She calls me “Lamp”. Nobody else gets called Lamp.']
    ], [
      ['d', 'Your Honour, the moth chose me. She sleeps on my face. You do not sleep on the face of someone you are not committed to.'],
      ['judge', 'Moths sleep on everything.'],
      ['d', 'Not like this, Your Honour. Not like us.']
    ]),
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
      plaintiff: alt([
        ['judge', 'Judgment for {p}. Full custody. {d} gets supervised visits. The lamp will supervise.'],
        ['narrator', '(The moth, entirely unbothered, flies straight into the studio light.)']], [
        ['judge', 'Judgment for {p}. The moth lives with {p}. {d} may wave at her from across the shelf, on Tuesdays.'],
        ['npc', 'I am at the lamp on Tuesdays.', 'moth']]),
      defendant: alt([
        ['judge', 'Judgment for {d}. She sleeps on your face. That is commitment. {p} may visit on Sundays.'],
        ['npc', 'I am with the lamp on Sundays.', 'moth'],
        ['judge', 'Then {p} may visit the lamp.']], [
        ['judge', 'Judgment for {d}. The moth sleeps on its face. That is the strongest evidence of love this court has seen, and this court once married a man to a hedge.'],
        ['p', 'She eats MY sleeves.'],
        ['judge', 'She eats everybody’s sleeves. That is not love. That is lunch.']]),
      both: alt([
        ['judge', 'Nobody owns the moth. The moth owns herself, and frankly the lamp.'],
        ['judge', 'Shared custody, split by the week, exactly as the moth arranged months ago without either of you noticing.'],
        ['narrator', '(The moth takes a bow. It is a very small bow. Three ghosts weep.)']], [
        ['judge', 'The moth is not a prize. The moth is a moth. She will go where the light is, and neither of you is the light.'],
        ['judge', 'Shared custody. The lamp has the final say.'],
        ['npc', 'She is welcome any time.', 'lamp']])
    },
    hallway: {
      p: ['She’ll come back to me. They always come back to the soft one.',
        'She’ll come back. She always comes back when the lamp’s off.',
        'I’m getting a brighter bulb. Let’s see who she loves then.'],
      d: ['Mothew knows who loves her. The lamp, first. Then me.',
        'She sleeps on my face. You can’t argue with a face.',
        'Mothew and I will be fine. We’ve been through worse. We’ve been through a sleeve.']
    }
  },
  {
    id: 'loaned-leg', title: 'The Loaned Leg', truth: 'plaintiff',
    claim: '{p} is suing {d} for one leg, lent for the sack race and never given back.',
    asking: 'The leg, and half the medal it won',
    plaintiff: alt([
      ['p', 'I lent {d} my left leg for the sack race. One race. Back by teatime.'],
      ['p', 'That was a fortnight ago. I have been hopping ever since. You try hopping to a bowl.'],
      ['judge', 'Why would anyone lend out a leg?'],
      ['p', '{d} said it was for charity. The charity was {d}.']
    ], [
      ['p', 'Your Honour, I have two legs. Had. I lent {d} one for a sack race, for charity, and it never came back.'],
      ['p', 'I am standing on the other one right now. It is tired. It is doing the work of two legs and it is not being paid for either.'],
      ['judge', 'Where is the leg now?'],
      ['p', 'On {d}. Winning things.']
    ]),
    defendant: alt([
      ['d', 'The leg does not want to come back, Your Honour. It has stood on a podium. It has tasted victory.'],
      ['d', 'And it has settled in. It knows where everything is. It kicks when it dreams.']
    ], [
      ['d', 'Your Honour, that leg and I have been through a lot. A sack race. A photo. A podium.'],
      ['d', 'You cannot just hand a leg back after all that. We have a bond. Mostly at the knee.']
    ]),
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
      plaintiff: alt([
        ['judge', 'Judgment for {p}. A leg lent for one race is lent for one race. It goes back tonight, with the medal.'],
        ['d', 'And if it does not want to go?'],
        ['judge', 'Then it can walk. It is a leg.']], [
        ['judge', 'Judgment for {p}. That leg was lent, labelled and promised back by teatime. It is well past teatime. It is nearly the next teatime.'],
        ['judge', '{d} returns the leg tonight. The medal stays with the leg. The leg earned it.']]),
      defendant: alt([
        ['judge', 'Judgment for {d}. The leg has made its choice, and this court will not stand in the way of a leg.'],
        ['narrator', '({p} hops out of the courtroom. It takes a long time. The audience applauds every hop.)']], [
        ['judge', 'Judgment for {d}. The leg has chosen its life. It has a career now, and possibly a centipede.'],
        ['p', 'How am I supposed to get home?'],
        ['judge', 'Hop, {p}. Like the rest of us. Figuratively.']]),
      both: alt([
        ['judge', 'You are both ridiculous. {p}, never lend a leg to anyone who says “charity”. {d}, you walk in circles now. That is its own sentence.'],
        ['judge', 'The court will keep the leg. The bailiff has always wanted to be taller.'],
        ['narrator', '(The bailiff puts it on. He is now taller on one side. He has never been happier.)']], [
        ['judge', 'You are both unfit to own legs. {p} lends them out. {d} keeps them.'],
        ['judge', 'The leg is placed in the care of the court until one of you grows up or grows another.']])
    },
    hallway: {
      p: ['Next year I’m entering the sack race on one leg. In a smaller sack. Out of spite.',
        'I’m going to get my leg back. I’ll hop there. It’ll take a while. I have time.',
        'One leg is fine. I’ve adapted. I lean on things. I’m leaning on the vending machine right now.'],
      d: ['I’ll miss that leg. It always knew where it was going. Right, mostly.',
        'The leg and I will always have that race. And the photo. I’m keeping the photo.',
        'I only walk in circles when I’m thinking. I’m always thinking.']
    }
  },
  {
    id: 'stolen-dust', title: 'The Dusting', truth: 'plaintiff',
    claim: '{p} is suing {d} for dusting {p} in the night, without asking, and keeping the dust.',
    asking: 'Eighty years of dust, returned in the right order',
    plaintiff: alt([
      ['p', 'I had eighty years of dust on me, Your Honour. A proper layer. It had a crust. You could write your name in it. People did.'],
      ['p', 'On Tuesday I woke up clean. I could see my own knees. Nobody should have to see their own knees.'],
      ['judge', 'And you blame {d}.'],
      ['p', '{d} is suddenly very grey for someone who was not grey on Monday.']
    ], [
      ['p', 'Your Honour, it took me eighty years to get that dusty. Eighty years of lying still, not being cleaned, letting it settle.'],
      ['p', 'On Tuesday I woke up shiny. SHINY. I have never been shiny. I looked like a spoon.'],
      ['judge', 'And {d}?'],
      ['p', '{d} looked about a hundred and twelve.']
    ]),
    defendant: alt([
      ['d', 'I cleaned {p} as a kindness. Things were living in that dust. Things with opinions.'],
      ['d', 'And I have always been this grey. I have a naturally dusty complexion.']
    ], [
      ['d', 'Your Honour, I did {p} a favour. You could not see {p} under all that. We thought it was a cushion.'],
      ['d', 'And the grey on me is mine. I aged overnight. Stress. From how dusty {p} was.']
    ]),
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
      plaintiff: alt([
        ['judge', 'Judgment for {p}. You do not dust a resident without asking, and you certainly do not wear it afterwards.'],
        ['judge', '{d} puts back every speck tonight. Including Geoffrey. Including Geoffrey’s furniture.'],
        ['npc', 'I would like the left shoulder again, if it is going.', 'woodlouse']], [
        ['judge', 'Judgment for {p}. Dust is property, {d}. Old, grey, personal property. You stole eighty years off a resident and wore them to court.'],
        ['judge', 'Every speck goes back tonight. The bailiff will supervise. The bailiff is very good at getting grubby.'],
        ['bailiff', 'Thank you, Your Honour.']]),
      defendant: alt([
        ['judge', 'Judgment for {d}. {p} is clean, and it suits {p}. The court can see {p}’s knees, and, frankly, so can everybody.'],
        ['p', 'I DID NOT ASK TO BE SEEN.']], [
        ['judge', 'Judgment for {d}. {p} was so dusty it had tenants. {d} cleaned it, which is more than anybody has done for me in three hundred years.'],
        ['p', 'I LIKED the tenants.'],
        ['judge', 'Then visit them. They live on {d} now.']]),
      both: alt([
        ['judge', 'You are both filthy, in opposite directions. The dust goes in the jar, the jar goes on the shelf, and nobody wears it.'],
        ['narrator', '(By morning the jar is empty and both of them are very slightly grey.)']], [
        ['judge', 'You are both disgusting, in completely different ways. One wears dust like a coat. The other steals it like a coat.'],
        ['judge', 'The dust goes in the jar, the jar goes on the shelf, and Geoffrey gets the jar. Geoffrey is the only one who respects it.']])
    },
    hallway: {
      p: ['I’m never washing again. Give me eighty years. I’ll be back.',
        'I’m lying down in the corner and not moving until I’m grey again. See you in eighty years.',
        'I can see my knees. I don’t like them. Nobody likes their knees.'],
      d: ['I still look distinguished round the edges. Where I missed.',
        'Nobody here respects a distinguished look. Nobody.',
        'I kept a pinch. In my pocket. For emergencies.']
    }
  },
  {
    id: 'jumble-pulse', title: 'The Pulse', truth: 'defendant',
    claim: '{p} is suing {d} for stealing a pulse. {p}’s stopped on Tuesday. On Wednesday, {d} had one.',
    asking: 'The pulse back, and every beat it has missed since',
    plaintiff: alt([
      ['p', 'I had a pulse, Your Honour. Small. Regular. At night I used to lie in my slot and listen to it.'],
      ['p', 'On Tuesday it stopped. On Wednesday {d} had one. Nobody else on this shelf has one.'],
      ['judge', 'So you assume it is yours.'],
      ['p', 'I have not had much else to go on. It has been very quiet in here.']
    ], [
      ['p', 'Your Honour, I had a pulse. I used to fall asleep to it. Tick. Tick. Tick. Like a lullaby.'],
      ['p', 'Then it stopped. And the very next day {d} walked in going “ba-dum”. Showing off.'],
      ['judge', '{d} walked in going “ba-dum”?'],
      ['p', 'Out loud, Your Honour. To everybody.']
    ]),
    defendant: alt([
      ['d', 'I bought it, Your Honour. Mrs Widow’s jumble sale. It was in a box with a wig and three spoons.'],
      ['d', 'I have been very happy with it. I feel things now. Mostly the pulse.']
    ], [
      ['d', 'Your Honour, it is a second-hand pulse. It is not new. It skips a bit. It waltzes when it is nervous.'],
      ['d', 'I paid two souls for it at a jumble sale. There was a wig in the same box. I did not take the wig. I have limits.']
    ]),
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
      plaintiff: alt([
        ['judge', 'Judgment for {p}. {d} hands over the pulse.'],
        ['narrator', '({d} hands it over. {p} holds it to its chest. It waltzes. {p} has never waltzed in its life. {p} is waltzing.)']], [
        ['judge', 'Judgment for {p}. A pulse turned up in {d} the day after one went missing from {p}. That is enough for me. I am very tired.'],
        ['judge', '{d} hands it over. If it waltzes, it waltzes.']]),
      defendant: alt([
        ['judge', 'Judgment for {d}. That pulse was bought, paid for, and it waltzes. {p}, yours did not stop. It ran down.'],
        ['judge', 'Bailiff. Find a key.'],
        ['narrator', '(The bailiff winds {p}. Somewhere inside {p}, something goes tick.)']], [
        ['judge', 'Judgment for {d}, who bought a pulse fair and square, from a widow, in a box, with a wig. That is how most things on this shelf are acquired.'],
        ['judge', 'And {p}, you swallowed a watch. The ticking was the watch. You were the last on this shelf to find out you never had a pulse.']]),
      both: alt([
        ['judge', 'You are both wrong. One of you mistook a watch for a pulse. The other bought a dead man’s pulse off his widow and never asked if he wanted it back.'],
        ['judge', 'The pulse goes back to Mrs Widow. {p} gets wound on Sundays.']], [
        ['judge', 'You are both confused about your insides, and frankly so am I.'],
        ['judge', 'The pulse goes back to Mrs Widow’s sewing box. {p} will be wound once a week. {d} will learn to live without a rhythm, like the rest of us.']])
    },
    hallway: {
      p: ['It was a watch. I know that now. It was still a very good pulse.',
        'I miss the ticking. I’m going to lie next to the clock tonight and pretend.',
        'If it was a watch, why did it feel so personal?'],
      d: ['I had a pulse for a week. I felt everything. Mostly dizzy. Occasionally a waltz.',
        'I felt alive for a week. It was exhausting. I don’t know how anybody did it.',
        'Mrs Widow says I can visit the pulse on Sundays. I’m bringing flowers.']
    }
  },
  {
    id: 'museum-piece', title: 'The Museum Piece', truth: 'defendant',
    claim: '{p} is suing {d} for pushing {p}’s bed one inch nearer the lamp every night for a week.',
    asking: 'Seven inches back, and a lock for the bed',
    plaintiff: alt([
      ['p', 'Every morning my bed is one inch nearer the lamp. Every morning. Seven inches this week.'],
      ['p', 'It is not me. The lamp cannot do it. That leaves {d}. It always leaves {d}.'],
      ['judge', 'What is your bed?'],
      ['p', 'A matchbox, Your Honour. A very good matchbox. It slides beautifully.']
    ], [
      ['p', 'Your Honour, somebody has been moving my bed. An inch a night. Towards the lamp. Like a slow and terrible pilgrimage.'],
      ['p', 'I have tied it down. I have stood guard. I have fallen asleep standing guard. Every morning: one more inch.'],
      ['judge', 'And you suspect {d}.'],
      ['p', 'I suspect {d} of everything, Your Honour. This time I am right.']
    ]),
    defendant: alt([
      ['d', 'I was not on the shelf last week, Your Honour. I was in a museum.'],
      ['d', 'A man came round asking if anyone had any antiques. I put my hand up.']
    ], [
      ['d', 'Your Honour, last week I was a museum exhibit. I had a card. I had a rope. Children pointed at me.'],
      ['d', 'It was the best week of my life, and I did not spend one second of it pushing {p}’s bed.']
    ]),
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
      plaintiff: alt([
        ['judge', 'Judgment for {p}. {d} will keep its hands off the bed.'],
        ['narrator', '(That night, at three, the bed moves one inch nearer the lamp. {d} is asleep on the far side of the shelf, under an upturned glass.)']], [
        ['judge', 'Judgment for {p}. The bed moved, {d} is shifty, and I have a feeling. I have been dead three hundred years and I trust my feelings.'],
        ['narrator', '(That night the bed moves another inch. The judge’s feeling was wrong. Nobody tells him.)']]),
      defendant: alt([
        ['judge', 'Judgment for {d}, who was in a locked case with a card, a rope and a witness. It is the best alibi this court has ever heard, and I have heard “I was dead”.'],
        ['judge', '{p}, it is you. It has been you every night. The lamp would like you to know it is flattered.'],
        ['npc', 'Deeply.', 'lamp']], [
        ['judge', 'Judgment for {d}, who was behind glass all week with a witness in the next case. The lamp has seen everything. {p} is sleepwalking towards a lamp.'],
        ['p', 'Why would I do that?'],
        ['npc', 'Why would you not?', 'lamp']]),
      both: alt([
        ['judge', 'You are both peculiar. One of you pushes furniture at a lamp in its sleep. The other hires itself out as an antique.'],
        ['judge', 'The bed will be nailed down, and {d} goes back in its case until somebody claims it.']], [
        ['judge', 'You are both strange, and you both belong in a museum, behind glass, where I cannot hear you.'],
        ['judge', 'The bed stays where it is. The lamp moves. Nobody is happy. That is justice.']])
    },
    hallway: {
      p: ['I’ve tied the bed down with a shoelace. This morning it was next to the lamp. So was the shoelace.',
        'I’m sleeping on the lamp now. Cut out the middle man.',
        'It’s not sleepwalking if you enjoy it.'],
      d: ['I’m going back to the museum. They appreciate me there. There’s a little rope.',
        'I’ve been asked back to the museum. Permanent collection. I’m packing.',
        'I’m an antique. I’m not supposed to be dragged into court. I’m supposed to be dusted.']
    }
  },
  {
    id: 'shared-headstone', title: 'Here Lie', truth: 'both',
    claim: '{p} is suing {d} for chiselling {p}’s name off the headstone they bought together.',
    asking: 'The name put back, in letters the same size as {d}’s',
    plaintiff: alt([
      ['p', 'We bought a headstone together. For eventually. Two names, one stone, a little carved dove.'],
      ['p', 'Last week {d} chiselled my name off. Now it just says HERE LIE. And a dove.'],
      ['judge', 'Here lie.'],
      ['p', 'Which, on this shelf, is accurate.']
    ], [
      ['p', 'Your Honour, {d} and I share a headstone. We went halves. I paid for my half of the dove.'],
      ['p', 'Now my name is gone. There is a gap where I was, and {d}’s name, which is a bit bigger than it used to be.'],
      ['judge', 'Bigger.'],
      ['p', 'It has been re-cut. In bold.']
    ]),
    defendant: alt([
      ['d', '{p} started it. On Tuesday MY name came off. I was only evening things up.'],
      ['d', 'And the dove is mine. I paid for the dove.']
    ], [
      ['d', 'Your Honour, on Tuesday I went to visit my own grave, and my name had been scratched off it.'],
      ['d', 'Do you know how that feels? To stand at your own grave and not be on it? I did what anyone would do. I took {p} off too.']
    ]),
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
      plaintiff: alt([
        ['judge', 'Judgment for {p}. {d} carves {p}’s name back on, in full, the same size.'],
        ['narrator', '(The stone now reads HERE LIE {p}. {p} is delighted with it. Nobody has the heart.)']], [
        ['judge', 'Judgment for {p}. {d} re-cut its own name in bold on a shared stone. That is not grief. That is branding.'],
        ['judge', '{p}’s name goes back on, the same size, and {d}’s goes back to normal size, in lower case, as a lesson.']]),
      defendant: alt([
        ['judge', 'Judgment for {d}. {p} started it, and you do not chisel a friend on a Tuesday.'],
        ['d', 'Can I have the top line?'],
        ['judge', 'There is no top line. There is a dove.']], [
        ['judge', 'Judgment for {d}. {p} started with the chisel. You cannot scratch somebody off a grave and act surprised when they scratch back.'],
        ['p', 'The dove was half mine.'],
        ['judge', 'Then you may sit on your half.']]),
      both: alt([
        ['judge', 'You are both vandals. That stone says HERE LIE, and it is the most honest thing either of you owns.'],
        ['judge', 'Both names go back on, side by side, the same size. The dove stays in the middle, to keep you apart.']], [
        ['judge', 'You are both vandals of your own memorial. I have been dead three hundred years and nobody has ever defaced my stone.'],
        ['bailiff', 'Nobody knows where your stone is, Your Honour.'],
        ['judge', 'Thank you, Bailiff.']])
    },
    hallway: {
      p: ['We’re still going on Sunday. Opposite ends. I’m bringing the flask. {d} isn’t getting any.',
        'I’ve started carving my name back on. Bigger. Much bigger. There won’t be room for the dove.',
        'HERE LIE. That’s what it says. I’m having it sent to {d} as a card.'],
      d: ['I’m getting my own stone. Just me. Enormous. Two doves.',
        'I visited the stone on the way out. It still says HERE LIE. I think it means {p}.',
        'The dove is still mine. I checked. I sat on it.']
    }
  },
  {
    id: 'tontine', title: 'The Tontine', truth: 'both',
    claim: '{p} is suing {d} for not dying. They have had a bet since 1908: last one left gets the tin.',
    asking: 'One tin of travel sweets, unopened since 1908, and for {d} to get on with it',
    plaintiff: alt([
      ['p', 'In 1908 {d} and I made a bet. One tin of travel sweets. Whoever is left at the end gets the tin.'],
      ['p', 'That was a long time ago, and {d} is still here. I have been extremely patient.'],
      ['judge', 'That is a tontine. They were banned. People kept falling down the stairs.'],
      ['p', 'I have not pushed anybody. I have only been hopeful near stairs.']
    ], [
      ['p', 'Your Honour, in 1908 {d} and I shook hands on a tin of travel sweets. Last one standing gets the tin.'],
      ['p', 'I have been standing ever since. My legs are very tired. {d} will not sit down.'],
      ['judge', 'Sit down in what sense?'],
      ['p', 'Forever, Your Honour. I am being delicate.']
    ]),
    defendant: alt([
      ['d', 'I am not dying for a tin of sweets, Your Honour. I have looked into dying. It is not worth it for sweets.'],
      ['d', 'And a bet is a bet. I intend to be the one left. I am very good at being left.']
    ], [
      ['d', 'Your Honour, I made a promise in 1908 and I intend to keep it. I promised to outlive {p}.'],
      ['d', 'I am in no hurry. I have looked at the stairs. I avoid the stairs.']
    ]),
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
      plaintiff: alt([
        ['judge', 'Judgment for {p}. {d} is declared to have lost. That is as close to dead as this court can get you.'],
        ['narrator', '({p} opens the tin. It is buttons.)'],
        ['p', 'I would like to appeal my own win.']], [
        ['judge', 'Judgment for {p}. {d} has been technically alive for far too long, and this court declares the bet won.'],
        ['narrator', '({p} opens the tin. Buttons. Every one of them painted, lovingly, by somebody who had a very long time to think about it.)'],
        ['p', 'Oh.']]),
      defendant: alt([
        ['judge', 'Judgment for {d}. This court does not hurry anybody along. Not even for sweets.'],
        ['narrator', '({d} takes the tin home and gives it a shake. It rattles like buttons. {d} does not look surprised.)']], [
        ['judge', 'Judgment for {d}. Nobody has won anything until somebody stops, and nobody on this shelf has ever stopped.'],
        ['judge', 'The tin stays shut. The bet goes on. I will see you both back here in a thousand years.']]),
      both: alt([
        ['judge', 'You are both cheats. One of you has been at the lid with a hairpin for sixty years. The other ate the prize in 1911 and painted the buttons.'],
        ['judge', 'The bet stands. It will outlive everyone in this room, and I am already dead.']], [
        ['judge', 'You are both cheating at waiting, which I did not know was possible.'],
        ['judge', 'The tin is confiscated. The bailiff will hold it until one of you dies.'],
        ['bailiff', 'I have always wanted a pension, Your Honour.']])
    },
    hallway: {
      p: ['I can wait. I’ve waited since 1908. The tin will rust before I do.',
        'I’ll outlast {d}. I’ve outlasted three kings and a biscuit tin.',
        'I’m going to paint some real sweets and put them in the tin. Then we’ll see.'],
      d: ['Lemon. They were lemon. I think about them most days.',
        '1908. I still remember the taste. I think about it more than I think about {p}.',
        'I’m going to live forever out of spite. Well. I was anyway. But now it’s spite.']
    }
  }
];

/* Scenes that break out mid-episode. `choice` scenes wait for you: bang the
   gavel (the jury respects order) or let it play out (the audience loves
   it). Each scene has several takes; an episode plays one take start to
   finish, so the response always matches the setup. {x} is whoever is losing
   it; `x` lines are spoken by them. Outburst rants are drawn separately. */
export const HAPPENINGS = {
  outburst: { anim: 'outburst', choice: true,
    rants: [
      'THIS IS A SHAM. I HAVE BEEN ON THIS SHELF SINCE BEFORE THE SHELF. I AM PRACTICALLY LOAD-BEARING.',
      'YOU ARE ALL IN ON IT. THE MOTH. THE WALL. THE SKELETON. ESPECIALLY THE SKELETON. LOOK AT HIS FACE. HE HASN’T GOT ONE.',
      'I WILL NOT BE SILENCED BY A MAN WITH NO THROAT.',
      'I WANT IT NOTED THAT I AM CRYING. BAILIFF. NOTE IT. NOT WITH A DRAWING.',
      'I AM WRITING A STRONGLY WORDED LETTER. THEN I AM EATING IT. THAT IS HOW STRONGLY WORDED IT IS.',
      'I HAVE RIGHTS. I DO NOT KNOW WHAT THEY ARE. BUT I HAVE THEM. I KEEP THEM IN A TIN.',
      'THIS IS EXACTLY WHAT HAPPENED IN 1843 AND NOBODY LISTENED THEN EITHER.',
      'I DEMAND TO SPEAK TO THE JUDGE’S MANAGER. WHO IS THE JUDGE’S MANAGER. IS IT GOD. GET HIM.',
      'I AM FOUR INCHES OF PURE FURY. THREE AND A HALF. THE REST IS HAT.',
      'YOU WILL ALL BE HEARING FROM MY SOLICITOR. MY SOLICITOR IS A SPOON. IT IS A VERY SHARP SPOON.',
      'I HAVE BEEN WRONGED IN THIS SLOT AND THE NEXT ONE, AND I WILL BE WRONGED IN THE ONE AFTER THAT. I CAN FEEL IT.',
      'EVERYBODY LOOK AT ME. NO. NOT LIKE THAT. LIKE YOU ARE SORRY.',
      'THIS IS MY INDOOR VOICE. MY OUTDOOR VOICE BROKE A WINDOW IN 1912.',
      'IS THIS JUSTICE. IS IT. BECAUSE IT FEELS LIKE A SHELF.',
      'I WOULD LIKE TO CALL A SURPRISE WITNESS. IT IS ALSO ME. I SAW EVERYTHING.',
      'SOMEBODY HOLD MY RAISIN.'
    ],
    takes: [
      { intro: [['narrator', '({x} climbs onto the podium.)']],
        gavel: [['judge', 'SIT. DOWN. I have been dead for three hundred years and I have never been this tired.'], ['narrator', '({x} sits down and sulks at a volume the microphones can pick up.)']],
        let: [['narrator', '({x} goes on for four minutes. At one point it sings. At another point it lies down. The audience gives the lying down a standing ovation.)'], ['judge', 'Are you finished?'], ['x', 'I have a second verse.']] },
      { intro: [['narrator', '({x} stands on its chair. The chair is not rated for this.)']],
        gavel: [['judge', 'Sit down, {x}, or you will be sat down. Bailiff, prepare to sit on {x}.'], ['narrator', '({x} sits. The bailiff looks disappointed.)']],
        let: [['narrator', '({x} rants until it runs out of breath, then out of words, then out of chair. It falls off. The audience is delighted.)']] },
      { intro: [['narrator', '({x} grabs the microphone. There is no microphone. It grabs the bailiff.)']],
        gavel: [['judge', 'ORDER. That is not a request. It is the only word I have left that still works.'], ['narrator', '({x} lets go of the bailiff. The bailiff straightens his cap and pretends it was his idea.)']],
        let: [['narrator', '({x} keeps going, into the bailiff. The ratings climb. The judge takes out a small book and starts reading it.)'], ['x', 'AND ANOTHER THING.'], ['judge', 'There is always another thing.']] }
    ] },
  sleep: { anim: 'sleep', choice: true,
    takes: [
      { intro: [['narrator', '({j} has fallen asleep in the jury box. {j} is snoring in the key of D.)']],
        gavel: [['judge', 'WAKE UP, {j}.'], ['narrator', '({j} wakes up and shouts “GUILTY”. There is nothing to be guilty of yet. {j} stands by it.)']],
        let: [['narrator', '({j} sleeps through the rest of the case. {j} will still be voting. {j} has already decided.)'], ['audience', '(A ghost in the front row starts snoring in harmony. It is quite beautiful.)']] },
      { intro: [['narrator', '({j} has fallen asleep and is talking in its sleep. It is giving evidence. None of it is about this case.)']],
        gavel: [['judge', 'Bailiff, wake that juror.'], ['narrator', '(The bailiff pokes {j} with a pencil. {j} wakes up, says “Mother?”, and goes very quiet.)']],
        let: [['narrator', '({j} sleeps on, still giving evidence. At one point it objects to itself. The judge sustains it.)']] },
      { intro: [['narrator', '({j} has nodded off with its eyes open. The bailiff only notices because it has not blinked since the adverts.)']],
        gavel: [['narrator', '(The gavel comes down. {j} wakes so fast it falls out of the jury box and is put back in the wrong way round.)']],
        let: [['judge', 'Leave it. It is the only one of us having a nice time.']] }
    ] },
  throw: { anim: 'throw', choice: true,
    takes: [
      { intro: [['narrator', '({d} has thrown a tooth at {p}.)']],
        gavel: [['judge', 'Bailiff. Confiscate every tooth in the building.'], ['bailiff', 'That will take a while, Your Honour. Uncle is here.']],
        let: [['narrator', '({p} throws it back. {d} throws a shoe. Nobody here wears shoes. The shoe is the bailiff’s. The bailiff says nothing.)'], ['audience', '(The audience chants “SHOE. SHOE. SHOE.”)']] },
      { intro: [['narrator', '({d} takes a tooth out of nowhere, looks at it, and throws it at {p}. It was not {d}’s tooth.)']],
        gavel: [['judge', 'There will be no throwing in my court. Only I throw things, and I throw the book.'], ['narrator', '(He throws the book. It hits the bailiff.)']],
        let: [['narrator', '(It becomes a tooth fight. Teeth everywhere. Afterwards the bailiff has quietly collected nine of them and will not say why.)']] },
      { intro: [['narrator', '({d} flicks a tooth at {p}. It bounces off {p}, off the bench and off Uncle, who says “that is mine”.)']],
        gavel: [['judge', '{d}. Pick that up and give it back to Uncle. Everything is Uncle’s.']],
        let: [['narrator', '({p} catches the tooth, looks at it, and keeps it. {d} wants it back. The audience takes sides. The tooth has never been so popular.)']] }
    ] },
  heckle: { anim: 'heckle', choice: true,
    takes: [
      { intro: [['audience', '(A ghost in row two stands up: “{p} IS A FRAUD. I WENT ON A DATE WITH {p} IN 1850.”)']],
        gavel: [['judge', 'Sit down or be exorcised. Bailiff, exorcise him a little.'], ['bailiff', '(The bailiff flicks salt at the ghost. The ghost sits down, lightly seasoned.)']],
        let: [['audience', '(The ghost describes the date in detail. It was a picnic. It rained. {p} ate the blanket.)'], ['p', 'IT WAS A VERY GOOD BLANKET.']] },
      { intro: [['audience', '(A ghost at the back stands up: “{d} OWES ME A SHILLING. SINCE 1790. WITH INTEREST, THAT IS STILL ONE SHILLING.”)']],
        gavel: [['judge', 'Sit down. Debts die with the debtor.'], ['audience', '(The ghost: “NOBODY HERE HAS EVER DIED.” The judge thinks about this and sits down himself.)']],
        let: [['audience', '(The ghost produces an IOU, written on a leaf, dated 1790. It is very convincing. The jury passes it round and one of them eats it.)']] },
      { intro: [['audience', '(A ghost shouts from the gallery: “I LIVED IN THAT SLOT BEFORE ANY OF YOU. IT WAS LOVELY. YOU HAVE RUINED IT.”)']],
        gavel: [['judge', 'Everybody used to live somewhere. Sit down.'], ['audience', '(The ghost sits down and mutters about the view.)']],
        let: [['audience', '(The ghost gives a full tour of the slot from memory. It had a little window. Nobody on this shelf has ever seen a window. Several of them cry.)']] }
    ] },
  faint: { anim: 'faint', ratings: 6,
    takes: [
      { intro: [['narrator', '(A ghost in the front row faints. It was already dead, so this is mostly theatre.)'], ['audience', '(Two more faint in solidarity. One of them is doing it wrong.)']] },
      { intro: [['narrator', '(A ghost in the front row faints onto the ghost beside it, who faints onto the next one. It is dominoes now. It is very satisfying.)']] },
      { intro: [['narrator', '(Somebody in the gallery faints. The bailiff checks on it.)'], ['bailiff', 'It is fine, Your Honour. I say that about everything, but it is.']] }
    ] },
  dark: { anim: 'dark', ratings: 6,
    takes: [
      { intro: [['narrator', '(The studio lights go out.)'], ['judge', 'Everybody stay calm. Somebody is licking my hand. Bailiff, is that you?'], ['bailiff', 'No, Your Honour.'], ['narrator', '(The lights come back on. Nobody is near the judge. The judge’s hand is wet. Nobody discusses it.)']] },
      { intro: [['narrator', '(The lights go out.)'], ['judge', 'Nobody move.'], ['narrator', '(Everybody moves. When the lights come back on, the jury has swapped seats and denies it.)']] },
      { intro: [['narrator', '(Power cut.)'], ['bailiff', 'Don’t panic, Your Honour. I have a candle.'], ['narrator', '(The candle is lit. Madam Moth is sitting on the wick. She is having the best day of her life.)']] }
    ] },
  cat: { anim: 'cat', ratings: 6,
    takes: [
      { intro: [['narrator', '(Sir Reginald Whiskers strolls across the judge’s bench, knocks the gavel onto the floor, and leaves without eye contact.)'], ['judge', 'Who let the cat in?'], ['bailiff', 'Nobody lets the cat in, Your Honour. The cat arrives.']] },
      { intro: [['narrator', '(Sir Reginald Whiskers walks onto the witness stand, sits down, and stares at the judge until the judge looks away.)'], ['judge', 'The cat has no case.'], ['bailiff', 'The cat does not need a case, Your Honour.']] },
      { intro: [['narrator', '(Sir Reginald Whiskers wanders through, sniffs {p}, sniffs {d}, and sits on the evidence.)'], ['judge', 'Somebody move the cat.'], ['narrator', '(Nobody moves the cat.)']] }
    ] },
  applause: { anim: 'applause', ratings: 6,
    takes: [
      { intro: [['narrator', '(The APPLAUSE sign has jammed on. The audience cannot stop clapping. They are exhausted. One of them has died again.)']] },
      { intro: [['narrator', '(The APPLAUSE sign has started flashing on its own. The audience claps at everything. They clap when the bailiff sneezes. They clap when he apologises.)']] },
      { intro: [['narrator', '(The APPLAUSE sign falls off the wall. The audience claps for the sign. Nobody has ever clapped for the sign before. It is very moved.)']] }
    ] },
  eat: { anim: 'eat', ratings: 6,
    takes: [
      { intro: [['narrator', '(Bailiff Rattigan has eaten Exhibit B.)'], ['judge', 'What was Exhibit B?'], ['bailiff', 'I would rather not say, Your Honour. It was a raisin.']] },
      { intro: [['narrator', '(Bailiff Rattigan is chewing.)'], ['judge', 'Bailiff. What are you eating?'], ['bailiff', 'Nothing, Your Honour.'], ['narrator', '(The case file is now missing a page.)']] },
      { intro: [['narrator', '(Bailiff Rattigan has eaten the block the gavel hits.)'], ['judge', 'That was oak.'], ['bailiff', 'I know, Your Honour. I am so sorry. It was delicious.']] }
    ] },
  jaw: { anim: 'jaw', ratings: 6,
    takes: [
      { intro: [['narrator', '(Uncle’s jaw has fallen off in the gallery. It is still talking. It is heckling.)'], ['audience', '(The jaw, from under a seat: “BOOOOOO.”)']] },
      { intro: [['narrator', '(The judge’s jaw comes off mid-sentence and lands on the bench. The court waits while he screws it back on.)'], ['judge', '…as I was saying.']] },
      { intro: [['narrator', '(A jaw rolls out from under the jury box. Nobody claims it. It clacks twice, politely, and rolls back.)']] }
    ] },
  moth: { anim: 'moth', ratings: 6,
    takes: [
      { intro: [['narrator', '(Madam Moth has flown into the studio light. The light has won. Madam Moth has never been happier.)']] },
      { intro: [['narrator', '(Madam Moth has found the studio light. She circles it with the focus of an athlete. She is going for gold.)']] },
      { intro: [['narrator', '(Madam Moth lands on the judge’s skull and settles in. The judge carries on. It is not the first time.)']] }
    ] }
};
export const RANDOM_HAPPENINGS = ['sleep', 'throw', 'heckle', 'faint', 'dark', 'cat', 'applause', 'eat', 'jaw', 'moth', 'outburst'];

export const OPENERS = [
  'Real residents. Real disputes. Real dead. This… is SHELF COURT.',
  'No lawyers. No appeals. No pulse. This is SHELF COURT.',
  'Filmed in front of a live studio audience, who are not. This is SHELF COURT.',
  'Two residents. One grievance. Absolutely no chance of anybody learning anything. This is SHELF COURT.',
  'The cases are real. The residents are real. The judge was real, in 1702. This is SHELF COURT.',
  'They cannot die, so they sue. This is SHELF COURT.',
  'Justice is blind. Our judge has no eyes at all. This is SHELF COURT.',
  'From the second shelf of a cabinet in a house you will never find: this is SHELF COURT.',
  'Today: a grudge, a grievance, and a skeleton with a hammer. This is SHELF COURT.',
  'The following programme contains scenes of pettiness that some viewers may find relatable. This is SHELF COURT.',
  'Somebody wronged somebody. Somebody wants souls. Somebody is going to cry on camera. This is SHELF COURT.',
  'Four inches tall. Four hundred years of grudges. This is SHELF COURT.',
  'Live, allegedly, from the shelf. This is SHELF COURT.',
  'One judge. Six jurors. No exits. This is SHELF COURT.',
  'Previously on Shelf Court: nobody learned anything. Tonight: the same, but louder. This is SHELF COURT.',
  'Sponsored by Dust. It is always sponsored by Dust. This is SHELF COURT.'
];
export const ALL_RISE = [
  'All rise for the Honourable Judge Mortis. The dead may remain seated. The dead always remain seated.',
  'All rise. Judge Mortis presiding. Please stop licking the benches. They have been varnished, and now, so have you.',
  'All rise for Judge Mortis: three hundred years on the bench, two hundred and ninety of them in the ground.',
  'All rise. Anyone who cannot rise, lean. Anyone who cannot lean, I am sorry for your loss.',
  'All rise for the Honourable Judge Mortis. Please switch off anything that rattles. That includes you, Uncle.',
  'All rise. The court is now in session. The bailiff is now in uniform. Both of these are temporary.',
  'All rise for Judge Mortis, who would like it known that he did not want to come in today either.',
  'All rise. No photography. No flash. No eating of the evidence by anyone other than the bailiff.',
  'All rise for the Honourable Judge Mortis. He can hear you. He has no ears. Nobody knows how.',
  'All rise. Hats off. Heads on. Uncle, head ON.'
];
export const JUDGE_ENTRANCES = [
  'Sit down. I have been dead since 1702 and I still have better places to be. Specifically, a hole.',
  'I have no ears and I can already hear you lying. Sit.',
  'I have no eyelids, so I cannot roll my eyes at you. Imagine that I am. Imagine it very hard.',
  'I am speaking. When I am speaking, you are not. That rule was true when I had lips and it is truer now.',
  'Sit. I have seen empires fall and plagues come and go. Let us see if you two can top either.',
  'Good afternoon. It is not a good afternoon. I say it out of habit, like breathing, which I also no longer do.',
  'I have read the file. I read it twice. The second time I laughed, and I am not proud of it.',
  'Before we begin, a reminder that I have no patience, no skin and no reason to be here.',
  'I have judged kings. I have judged a man who married a hedge. Today I judge you. It is not a promotion.',
  'Sit. Do not speak unless spoken to. Do not cry unless it is funny.',
  'Somebody has put a raisin on my bench. Bailiff. We will discuss this later.',
  'This is a court of law. It is also a television programme. Try to be interesting, then try to be honest, in that order.',
  'I was buried with my gavel. They had to dig me up for this. Make it worth it.',
  'I have one rule: do not lie to me. I have one other rule: do not bore me. You will break at least one.',
  'Good. You are both here. You are both small. You are both, I can already tell, wrong about something.',
  'Quiet. I said quiet. I can wait. I have been waiting since 1702. I am extremely good at it.'
];
export const PLAINTIFF_CUE = [
  '{p}. You are suing {d}. Talk. Short sentences. I am decomposing.',
  '{p}, you brought this. Tell me why, and tell me before I rot.',
  'Plaintiff. Go. I have no brain, so keep it simple.',
  '{p}. In your own words. Fewer of them than that.',
  '{p}, you have the floor. Do not do anything to it.',
  'Plaintiff. Tell me what {d} did. Then tell me what you did. I will know if you skip the second part.',
  '{p}. Start at the beginning. Stop before the end. I will tell you where the end is.',
  '{p}, the court is listening. The court is also very tired. Bear both in mind.',
  'Go on, {p}. The audience is dead, but it can still be bored.',
  '{p}. Your complaint. From the top. Not the very top. Not the bit where you were born.'
];
export const DEFENDANT_CUE = [
  '{d}. Your side. And do not tell me it was an accident. Nothing on this shelf is an accident. It is all on purpose, badly.',
  '{d}. Speak. Carefully. I can see right through you, and I do not even have eyes.',
  'Defendant. Your turn. Impress me. Nobody has since 1702.',
  '{d}. You have heard the charge. Now let us hear the excuse.',
  '{d}, your defence. If it involves the word “technically”, start again.',
  '{d}. Talk. I will be nodding. It is not agreement. It is my neck.',
  'Right. {d}. Explain yourself, and remember that I was alive once, so I know all the tricks.',
  '{d}, the court would like to hear your side. The court has already guessed it. Surprise me.',
  '{d}. Go. And do not look at the jury like that. They cannot help you. Most of them cannot help themselves.',
  '{d}, you may speak. You may not whisper. You may not do the face.'
];

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
  { brand: 'RATTIGAN’S RAISIN EXCHANGE', lines: ['Raisins bought and sold. Including raisins you left on a little shelf in a coffin.', 'Rattigan’s. We are not the bailiff. Stop asking.'] },
  { brand: 'THE SHELF LIFE ASSURANCE COMPANY', lines: ['Life insurance for people who cannot die.', 'We have never paid out. We never will. Call now.'] },
  { brand: 'THE DAMP', lines: ['Is your home too dry? Too bright? Too cheerful?', 'Call The Damp. We creep in. We never leave.'] },
  { brand: 'SPOON LAWYERS DIRECT', lines: ['Been hurt by a spoon? Hurt somebody with a spoon? Own a spoon?', 'Spoon Lawyers Direct. No win, no spoon.'] },
  { brand: 'LIDS R US', lines: ['Lids for coffins. Lids for jars. Lids for things that must never come out.', 'Lids R Us. Some things are better left closed.'] },
  { brand: 'MRS WIDOW’S JUMBLE', lines: ['Everything must go. Some of it keeps coming back.', 'This week: a wig, three spoons, and a box that knocks.'] },
  { brand: 'GRAVE EXPECTATIONS', lines: ['Plots available now. Quiet neighbours. Excellent drainage.', 'Grave Expectations estate agents. You will be here a very long time.'] },
  { brand: 'WISPLEY’S HAUNTING LESSONS', lines: ['Learn to moan in just six weeks.', 'Chain rattling for beginners, Tuesdays. Bring your own chain.'] },
  { brand: 'BONE-GLO', lines: ['Is your skeleton looking dull? Bone-Glo brings back the shine.', 'As used by Judge Mortis. Judge Mortis did not agree to this advert.'] },
  { brand: 'THE DRAWER', lines: ['Lonely? Open the drawer.', 'Do not open the drawer.'] },
  { brand: 'SIR REGINALD’S LAP SERVICE', lines: ['Is your lap going to waste?', 'Sir Reginald will sit on it. Rates negotiable. Sir Reginald is not.'] },
  { brand: 'UNCLE’S EVENING CLASSES', lines: ['Whittling. Knitting. Sitting Very Still.', 'Two of the three are taught by Uncle. He will not say which.'] },
  { brand: 'THE WOODLOUSE REMOVAL COMPANY', lines: ['Do you have woodlice?', 'You will always have woodlice. We are the woodlice. This is a hostage message.'] },
  { brand: 'FLAT-PACK COFFINS', lines: ['Ninety-seven pieces and one little key.', 'You will have three pieces left over. So, eventually, will we all.'] },
  { brand: 'THE RAVEN’S BOOK CLUB', lines: ['This month we are reading one poem.', 'Next month, the same poem. Meetings every Tuesday, forever.'] }
];
export const BREAK_IN = [
  'We’ll be right back after these messages from people who are also dead.',
  'Don’t go anywhere. You can’t. You’re on a shelf.',
  'After the break: more of this. Brace yourselves.',
  'Stay with us. The bailiff has promised not to eat anything during the adverts. He has promised this before.',
  'We are going to a short break while the judge’s jaw is reattached.',
  'Coming up: justice. Before that: things you can buy.',
  'Don’t touch that dial. Nobody here can reach it anyway.',
  'Shelf Court will return after these words from our sponsors, who are mostly Dust.'
];
export const BREAK_OUT = [
  'And we’re back. The judge has not moved. We are checking.',
  'Welcome back to Shelf Court. Nobody has left. The doors do not open. We are looking into it.',
  'We’re back. During the break, the bailiff ate something. We are not saying what.',
  'Welcome back. The jury has been counted. There are more of them than before.',
  'And we’re back, live, in a manner of speaking.',
  'Welcome back to Shelf Court, where the tension is real and the jury is mostly asleep.',
  'We’re back. The judge would like us to say he never left. He left. He went to lie down in a box.',
  'Welcome back. Somebody in the audience has started knitting. It is a small coffin. It is coming along nicely.'
];

export const JURY_AGREE = [
  '{j} nods so hard something falls off.',
  '{j} says “obviously” and folds its arms. It was not listening.',
  '{j} agrees, then agrees again, louder, in case the first one did not count.',
  '{j} gives a thumbs up. {j} does not have thumbs. It is still somehow a thumbs up.',
  '{j} says it knew all along. It had written the other verdict on its hand. It licks its hand.',
  '{j} stands up to clap and sits back down on somebody.',
  '{j} whispers “justice” and looks very pleased with the word.',
  '{j} agrees, on the condition that it gets to bang the gavel once. It does not get to bang the gavel.',
  '{j} votes with the judge. {j} always votes with the judge. {j} is hoping for a job.',
  '{j} agrees, then immediately tells the juror next to it that it disagreed.',
  '{j} says the ruling is correct, and also that it is hungry. It will not be separating these.',
  '{j} raises one limb. Then, to be safe, all of them.',
  '{j} says this is the best verdict since the one with the goat. Nobody remembers a goat.',
  '{j} agrees so quietly the bailiff has to lean in, and then agrees again, into the bailiff.',
  '{j} says it would have gone further. It will not say how much further. Everybody leans away.',
  '{j} is already writing a book about this case. It is called “I Was There”. It is one page long.'
];
export const JURY_DISAGREE = [
  '{j} boos. It is the first thing it has said all day.',
  '{j} throws a raisin at the bench. The bailiff catches it in his mouth.',
  '{j} says it would have ruled with its heart, which it keeps in a jar, which it has brought.',
  '{j} turns its back on the court. It was already facing the wrong way.',
  '{j} says this is exactly what happened with the goat. Nobody asks about the goat.',
  '{j} disagrees, stands up, sits down in a different chair, and disagrees again from there.',
  '{j} writes “NO” on a crumb and holds it up. Nobody can read a crumb.',
  '{j} says it is going to appeal. There is no appeal. {j} is going to appeal to the lamp.',
  '{j} lies down on the floor of the jury box in protest. It is quite comfortable. It stays there.',
  '{j} says it is disgusted, and then asks if there is cake.',
  '{j} votes against. Asked why, it says “vibes”. It is removed from the jury, then put back, because there is nobody else.',
  '{j} hisses. It does not know how to hiss. It is trying.',
  '{j} says the judge has clearly been bought. The judge would like to know with what.',
  '{j} disagrees in a letter. It has posted the letter to itself. It will arrive on Thursday.',
  '{j} shakes its head so hard it has to lie down.',
  '{j} says it will never forget this. It has already forgotten which one it was.'
];
export const JURY_ALL_AGREE = [
  'The jury agrees with you. All of them. Even the one that was asleep.',
  'Unanimous. The jury would like it noted that this has never happened before and will never happen again.',
  'The whole jury agrees. They are hugging. Somebody is going to have to separate them.',
  'Six out of six. The jury asks if it can go home now. It cannot. None of us can.',
  'The jury agrees with you completely. It is unsettling. They are all smiling at you.',
  'A unanimous verdict. The bailiff is so moved he eats a raisin in celebration.'
];
export const JURY_ALL_DISAGREE = [
  'The jury disagrees with you. Unanimously. One of them is writing to its MP.',
  'Nobody on the jury agrees with you. Nobody. Not even the one who was not paying attention.',
  'The jury disagrees, six to nothing. They have started a small chant.',
  'The whole jury is against you. The lamp has dimmed in protest.',
  'Unanimous disagreement. The jury says it will be watching the judge. The judge has no eyelids. He will be watching back.',
  'The jury votes against you to a juror. One of them votes against you twice. That is not allowed. Nobody stops it.'
];
export const AUDIENCE_REACTIONS = [
  ['(Silence. One ghost coughs. It echoes for longer than a cough should.)',
    '(Somebody in the audience says “huh”. It is not a good “huh”.)',
    '(The audience stares. The APPLAUSE sign lights up. Nothing happens. The sign quietly goes back off.)',
    '(A ghost in the second row gets up and leaves through the floor.)',
    '(Somebody boos, then apologises, then boos again, quieter.)',
    '(The audience says nothing. They have seen things. This is now one of them.)'],
  ['(Polite applause. The kind you hear at the funeral of somebody nobody liked.)',
    '(The audience claps. Some of them are still clapping from a previous episode.)',
    '(Scattered applause. One ghost claps with one hand. It is not a metaphor. It only has one.)',
    '(The audience murmurs. It is the murmur of people who have seen better, and worse, and mostly worse.)',
    '(A ghost says “fair enough”. That is the review.)',
    '(Light clapping, and one very enthusiastic ghost at the back, who is always like this.)'],
  ['(The audience cheers. A ghost throws its hat. The hat is also a ghost. It comes back.)',
    '(Big applause. The APPLAUSE sign did not even have to light up. It lights up anyway, jealous.)',
    '(Whoops from the gallery. A ghost shouts “ORDER” just to be part of it.)',
    '(Cheering. Somebody rings a small bell. Nobody knows where the bell came from, or the ghost.)',
    '(The audience applauds. Uncle claps so hard his teeth come out. They applaud too.)',
    '(Solid applause. Three ghosts start a small wave. It goes round the room twice.)'],
  ['(The audience loses its mind. Three ghosts faint. One proposes to the bailiff. The bailiff says he will think about it.)',
    '(Standing ovation. The dead are on their feet. They do not have feet. It is still very moving.)',
    '(The gallery erupts. Someone is chanting the judge’s name. The judge pretends not to enjoy it and fails.)',
    '(Uproar. The audience throws flowers. They were brought for a funeral. Nobody minds.)',
    '(The ovation goes on so long the bailiff has to start the next episode.)',
    '(Pandemonium. A ghost carries another ghost round the room on its shoulders. Neither of them has shoulders.)']
];
export const HALLWAY_IN = [
  'Outside the courtroom…',
  'In the hallway, moments later…',
  'Our cameras caught up with them by the vending machine…',
  'We asked for a comment. We got one.',
  'In the corridor, still wearing the verdict…',
  'Outside Courtroom 1, where the carpet has seen things…',
  'We followed them out. They did not want us to. That is the job.',
  'Leaving the court with the dignity they arrived with, which was none…',
  'Our reporter caught them before the door closed…',
  'In the hallway: a microphone, and a very small grievance…',
  'On the way out, past the portrait of a judge who is also a skeleton…',
  'Moments after the verdict, by the bench nobody sits on…'
];

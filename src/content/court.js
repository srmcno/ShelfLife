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
      { ask: 'Ask {d} where Keith came from.', clue: '{d} found Keith face down in the garden and moved him into {p}’s coffin without asking.', lines: alt([
        ['d', 'The garden. Face down. In the mint.'],
        ['judge', 'Keith was dead in the mint.'],
        ['d', 'Keith was resting in the mint. Now Keith is resting indoors. I upgraded Keith.']], [
        ['d', 'Face down in the garden, Your Honour. No name. No coffin. Nothing.'],
        ['d', 'By supper he had a name and a coffin. I did that, in one afternoon.'],
        ['judge', 'It was {p}’s coffin. Did you ask {p}?'],
        ['d', 'And spoil the surprise?']]) },
      { ask: 'Ask {p} to prove the coffin is theirs.', clue: 'The coffin has {p}’s name on the lid, {p}’s teeth marks on the handle and a little shelf for one raisin.', lines: alt([
        ['p', 'My name is on the lid. My teeth marks are on the handle. There is a little shelf inside where I keep one raisin.'],
        ['bailiff', 'I can confirm there is a little shelf, Your Honour.'],
        ['judge', 'And the raisin, Bailiff?'],
        ['bailiff', 'I can confirm there is a little shelf.']], [
        ['p', 'My name is on the lid, Your Honour. My teeth marks are on the handle. There is a little shelf inside, for one raisin.'],
        ['judge', '{d}, do you dispute any of that?'],
        ['d', 'No, Your Honour. But Keith has done a lot with the space.']]) },
      { ask: 'Tell {d} that “a nap” is not a legal term.', sass: true, lines: alt([
        ['judge', '{d}. “Nap” is not a legal term. Neither is “basically family”, “he looked cold” or “finders keepers”.'],
        ['d', 'What about “oops”?'],
        ['judge', '“Oops” is a confession. Say it again. Slowly. For the jury.'],
        ['d', 'No.']], [
        ['judge', '{d}. “Nap” is not a legal term. In 1702 I told my wife I was going for a nap.'],
        ['d', 'What happened?'],
        ['judge', 'She had me buried by teatime. I never did finish the nap.']]) },
      { ask: 'Ask {d} if Keith has any family.', clue: 'There is now a second Keith, Keith’s cousin, in {p}’s sock drawer. {d} put him there.', happen: 'outburst', party: 'p', lines: alt([
        ['d', 'A cousin. Also Keith. He came round asking for Keith, and I panicked.'],
        ['judge', 'Where is the second Keith, {d}?'],
        ['d', '{p}’s sock drawer.'],
        ['p', 'I HAVE BEEN WEARING THOSE SOCKS.']], [
        ['d', 'One cousin, Your Honour. Also Keith. It is a very Keith family.'],
        ['judge', 'And where is Cousin Keith now?'],
        ['d', 'In {p}’s sock drawer. I rolled him up in the good pair.'],
        ['p', 'THOSE WERE MY FUNERAL SOCKS.']]) },
      { ask: 'Ask {p} where it slept during the nap.', lines: alt([
        ['p', 'On the bare shelf. No lid. No pillow. The moth watched me all night.'],
        ['judge', 'That sounds awful.'],
        ['p', 'The moth said it was the best night of her life.']], [
        ['p', 'On the bare shelf, Your Honour. Arms crossed. Very still. Out of habit.'],
        ['judge', 'And?'],
        ['p', 'When I woke up, somebody had written “Keith” on my hand.']]) },
      { ask: 'Have the bailiff check on Keith.', lines: alt([
        ['narrator', '(The bailiff lifts the lid. He looks for a long time. He lowers the lid.)'],
        ['bailiff', 'Keith says hello, Your Honour.'],
        ['judge', 'Keith is dead, Bailiff.'],
        ['bailiff', 'He says that too.']], [
        ['narrator', '(The bailiff lifts the lid, looks in for a moment, and tucks Keith in.)'],
        ['judge', 'Bailiff, did you just tuck in a corpse?'],
        ['bailiff', 'He had kicked his blanket off again, Your Honour.'],
        ['p', 'He has a BLANKET?']]) }
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
      { ask: 'Ask {p} if it snored while {d} was away at the vet.', clue: 'The snoring got louder the night {d} was away at the vet.', lines: alt([
        ['p', 'Last Tuesday {d} was at the vet all night. The snoring was the worst it has ever been.'],
        ['judge', 'So it was louder when {d} was not in the building.'],
        ['p', 'I assumed {d} was doing it from the vet. Out of spite. Down the phone.']], [
        ['p', 'The night {d} was at the vet, I thought, finally. Peace. I was in bed by seven.'],
        ['judge', 'And?'],
        ['p', 'Loudest it has ever been, Your Honour. The shelf moved.'],
        ['judge', 'With {d} in a different building.'],
        ['p', 'It must have left it running.']]) },
      { ask: 'Have the bailiff put an ear to the wall.', clue: 'The wall snores. The Ministry of Haunting has it registered to a Mr Pemberton, deceased, snorer, since 1840.', lines: alt([
        ['narrator', '(The bailiff presses his ear to the wall. The wall snores. The bailiff’s whiskers blow back.)'],
        ['bailiff', 'Your Honour, the wall is snoring.'],
        ['judge', 'Walls do not snore, Bailiff.'],
        ['bailiff', 'This one just said “five more minutes”.'],
        ['npc', 'MINISTRY OF HAUNTING. Nobody touch that wall. That is a Mr Pemberton, snorer, registered 1840. He is on the heritage list.', 'ghost']], [
        ['bailiff', '(ear to the wall) It is definitely the wall, Your Honour. It just rolled over.'],
        ['npc', 'Ministry of Haunting. That wall is on our books. Mr Pemberton, deceased, snorer, since 1840.', 'ghost'],
        ['judge', 'Can the Ministry not wake him?'],
        ['npc', 'We wrote to him in 1902. He slept through it.', 'ghost']]) },
      { ask: 'Ask {p} if it has tried simply being asleep.', sass: true, lines: alt([
        ['judge', '{p}, have you tried simply being asleep? I am told it is very quiet in there.'],
        ['p', 'I CAN’T. BECAUSE OF THE SNORING.'],
        ['judge', 'Then try dying. I did. Slept like a log. Was mistaken for one. Twice.']], [
        ['judge', '{p}, have you tried simply being asleep? I managed it during your opening statement.'],
        ['p', 'You were ASLEEP?'],
        ['judge', 'Best sleep I have had since my own funeral. Do it again. Slower.']]) },
      { ask: 'Ask {d} to show the court how it sleeps.', clue: '{d} sleeps in total silence. It is upsetting to watch, but it is silent.', happen: 'outburst', party: 'p', lines: alt([
        ['narrator', '({d} lies down on the podium, crosses its arms, and becomes instantly, horribly still.)'],
        ['judge', 'Not a sound.'],
        ['bailiff', 'Shall I check it is alive, sir?'],
        ['p', 'THAT IS WHAT IT WANTS YOU TO THINK.']], [
        ['narrator', '({d} lies down on the podium, crosses its arms and goes out like a candle. The front row of the jury leans away.)'],
        ['bailiff', 'Your Honour, I have heard louder coffins.'],
        ['p', 'IT IS SNORING INWARDLY. AT ME.']]) },
      { ask: 'Ask {p} to do the snore for the court.', lines: alt([
        ['p', 'It goes HNNNRRK. Shhhwww. HNNNRRK. And then, sometimes, “Margaret”.'],
        ['judge', 'Who is Margaret?'],
        ['p', 'NOBODY KNOWS. THERE IS NO MARGARET.']], [
        ['narrator', '({p} closes its eyes and does the snore. It is long and wet, it has three movements, and there is a bit in the middle where it seems to drown.)'],
        ['judge', 'You have rehearsed that.'],
        ['p', 'Every night, Your Honour. I do it back at {d}, so it knows how it sounds.'],
        ['d', 'So it was YOU doing the harmony.']]) },
      { ask: 'Put the question to the wall.', lines: alt([
        ['judge', 'Wall. Did you snore?'],
        ['narrator', '(Silence. The wall snores. Then, quite clearly: “Margaret. The gas.”)'],
        ['judge', 'Nobody turn anything on.']], [
        ['judge', 'Wall. You are under oath. Did you snore?'],
        ['narrator', '(A long pause. Then the wall snores so hard that a little plaster comes down on {p}.)'],
        ['p', '{d} is THROWING ITS VOICE.']]) }
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
      { ask: 'Ask {d} who said {p} was dead.', clue: '{d} saw a bucket and declared {p} dead. Nobody else was consulted.', lines: alt([
        ['d', 'Nobody said. I saw the bucket.'],
        ['judge', 'You saw a bucket and declared a death.'],
        ['d', 'It was a very serious bucket, Your Honour. It had a lid.']], [
        ['d', 'Me, Your Honour. I saw the bucket and I declared {p} dead.'],
        ['judge', 'Did you ask anyone? A doctor? The bucket?'],
        ['d', 'There was no time, Your Honour. I had to grieve. I grieved very hard, for about as long as it takes to lie down.']]) },
      { ask: 'Ask {p} whose slot it was in the first place.', clue: '{p} took that same slot from {d} in the spring, while {d} was out ill. In a bucket.', lines: alt([
        ['p', 'Mine. Since the beginning of time.'],
        ['bailiff', 'Shelf records, Your Honour. {p} moved into that slot in the spring. While {d} was out ill. In a bucket.'],
        ['p', 'That was a DIFFERENT bucket.']], [
        ['p', 'Mine, Your Honour. Ask anybody.'],
        ['judge', '{d}?'],
        ['d', 'Mine until the spring, Your Honour. I was out ill in a bucket, and when I came back {p} was in my slot.'],
        ['p', 'You left with a bucket. I assumed you were moving.']]) },
      { ask: 'Ask {d} why the slot smells of it now.', lines: alt([
        ['d', 'I rolled in it. To claim it.'],
        ['judge', 'That is what cats do.'],
        ['d', 'I have cat energy.'],
        ['npc', 'It does not.', 'cat']], [
        ['d', 'I have been marinating it, Your Honour. Twice a day.'],
        ['judge', 'Marinating.'],
        ['d', 'Another week and it will be mine all the way through.']]) },
      { ask: 'Remind them both they are fighting over a plank.', sass: true, lines: alt([
        ['judge', 'It is a plank. You are fighting over a plank. I was buried in a box with less wood in it than this argument.'],
        ['p', 'It is a very good plank.'],
        ['d', 'It is the best plank.'],
        ['judge', 'It is an absolutely average plank.']], [
        ['p', 'Your Honour, that slot means everything to me.'],
        ['judge', 'It is a plank, {p}. In my day men went to war over kingdoms and still ended up in a plank. You two have skipped the kingdom.']]) },
      { ask: 'Ask {p} to describe the bucket.', happen: 'outburst', party: 'd', lines: alt([
        ['p', 'Blue. Deep. Unforgiving.'],
        ['judge', 'And what was in it?'],
        ['p', 'Everything I had eaten since Thursday. And a button. I do not own a button.'],
        ['bailiff', '(quietly) I have been looking for that button.']], [
        ['p', 'Blue. A proper lid. A handle that does not squeak. The kind of bucket you are proud to be ill in.'],
        ['judge', 'As opposed to?'],
        ['p', '{d}’s bucket, Your Honour. Tin. Dented. I would not be sick in it for money.'],
        ['d', 'THAT DENT IS SENTIMENTAL.']]) },
      { ask: 'Ask the jury who owns the slot.', lines: alt([
        ['jury', '{j} says a slot belongs to whoever is lying in it. That is the law of the shelf, and also of the bus.'],
        ['judge', 'Thank you, {j}. Nobody asked you. I did. I regret it.']], [
        ['jury', '{j} says the slot belongs to whoever was in a bucket most recently. {j} then asks, very casually, whether anybody is using the bucket.'],
        ['judge', '{j}. Take your head out of the evidence.']]) }
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
      { ask: 'Ask {d} if it noticed {p} in the front row.', clue: '{d} saw {p} alive in the front row, eating a salad, and kept going.', lines: alt([
        ['d', 'I did. I thought it was a ghost. You do not stop a eulogy for a ghost. It encourages them.'],
        ['judge', 'It was eating a salad.'],
        ['d', 'Ghosts eat salad. Badly. It goes straight through.']], [
        ['d', 'I saw it, Your Honour. Front row. Salad. Very much alive.'],
        ['judge', 'And you kept going.'],
        ['p', 'I WAVED.'],
        ['d', 'I assumed you were waving goodbye.']]) },
      { ask: 'Have {d} read the eulogy aloud.', clue: '{d} used the eulogy to claim {p} owed it three souls. {p} did not.', happen: 'outburst', party: 'p', lines: alt([
        ['d', '“{p} was here. Now {p} is not. {p} was mostly fine. {p} was a bit much. {p} owed me three souls.”'],
        ['judge', 'Did {p} owe you three souls?'],
        ['d', 'I thought if I said it at the funeral, nobody could argue.'],
        ['p', 'I WAS RIGHT THERE.']], [
        ['d', '“{p} will be missed, by some. {p} leaves behind a salad, and a debt of three souls to me, which mourners may settle in the dish by the door.”'],
        ['judge', 'Did {p} owe you three souls?'],
        ['d', 'Not before the eulogy, Your Honour.'],
        ['p', 'I PUT TWO IN THE DISH.']]) },
      { ask: 'Tell {p} to be grateful anybody came.', sass: true, lines: alt([
        ['judge', '{p}, four people came to my funeral. One of them was the horse, and the horse left early.'],
        ['p', 'How many came to mine?'],
        ['d', 'Six. Seven counting you. Eight counting the salad.']], [
        ['p', 'Your Honour, it was humiliating.'],
        ['judge', '{p}, be grateful anybody came. Nobody on this shelf is ever going to die. That was the only funeral you will ever get, and you spent it eating a salad.']]) },
      { ask: 'Ask who booked the funeral.', clue: 'The funeral was booked by {d}, who never checked whether {p} was dead.', lines: alt([
        ['p', 'I don’t know. Somebody saw me lying very still and started booking things.'],
        ['bailiff', 'The paperwork is signed by {d}, Your Honour. Under “cause of death” it says “quiet”.']], [
        ['bailiff', 'Booked by {d}, Your Honour. Hall, hymns, one cake, and one {p}.'],
        ['judge', '{d}. Did you check that {p} was actually dead?'],
        ['d', 'The cake was going fast, Your Honour. Corpses keep.']]) },
      { ask: 'Ask what happened to the flowers.', lines: alt([
        ['d', 'I took them home. I bought them for a death. There was no death. That is on {p}.'],
        ['judge', 'That is annoyingly not wrong.'],
        ['d', 'They are in a jar. They are waiting.']], [
        ['d', 'I took them home, Your Honour. The card says “For the late {p}”.'],
        ['judge', '{p} is sitting right there.'],
        ['d', 'That one was early. The flowers are for the late one.']]) },
      { ask: 'Invite {d} to deliver the court’s eulogy too.', sass: true, lines: alt([
        ['judge', 'Do mine, {d}. I am right here, and I am properly dead. Go on.'],
        ['d', '“Judge Mortis was here. Judge Mortis is still here. Nobody knows why.”'],
        ['narrator', '(The judge’s jaw trembles. It could be emotion. It could be the hinge.)']], [
        ['judge', 'Do mine, {d}. I am the only one in this room who has earned one.'],
        ['d', '“Judge Mortis. Firm. Fair. A bit much.”'],
        ['judge', 'A bit much? I am a skeleton, {d}. I am the bare minimum.']]) }
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
      { ask: 'Ask {p} where the sock came from.', clue: '{p} took the sock from the bottom drawer, the one that whispers, before it lent it to {d}.', lines: alt([
        ['p', 'The bottom drawer.'],
        ['judge', 'The one that whispers.'],
        ['p', 'All drawers whisper if you listen hard enough.'],
        ['judge', 'No, {p}. They do not.']], [
        ['p', 'The bottom drawer.'],
        ['judge', 'The drawer that whispers.'],
        ['p', 'It murmurs, Your Honour. It has asked me to correct people.']]) },
      { ask: 'Question the sock directly.', clue: 'The sock says it has been haunted “since the beginning”, long before {d} ever wore it.', lines: alt([
        ['narrator', '(The bailiff holds up the jar. The sock presses itself flat against the glass.)'],
        ['narrator', '(The sock whispers: “Haunted… since… the beginning.” Then, quieter: “{p}… knew.”)'],
        ['p', 'It is saying that for effect.']], [
        ['judge', 'Sock. Were you haunted before {d} ever wore you?'],
        ['narrator', '(The jar mists up. The sock whispers: “Since… the beginning.” A pause. “{d}… has lovely feet.”)'],
        ['p', 'It NEVER said that about MY feet.']]) },
      { ask: 'Ask {d} how it looked after the sock.', lines: alt([
        ['d', 'I wore it. I apologised to it. I sang to it once. It cried. We have a bond.'],
        ['judge', 'You bonded with a haunted sock.'],
        ['d', 'It has been a lonely year, Your Honour, and it is a very good listener.']], [
        ['d', 'Warm water on Sundays. Its own egg cup to sleep in. Puzzles on Tuesdays.'],
        ['judge', 'How does a sock do a puzzle?'],
        ['d', 'Very slowly, Your Honour. And it cheats.']]) },
      { ask: 'Tell {p} this is the stupidest case ever put before a skeleton.', sass: true, lines: alt([
        ['judge', '{p}, in three hundred years on the bench I once heard a man sue his own hat. The hat countersued. This is stupider.'],
        ['p', 'Who won?'],
        ['judge', 'The hat. Obviously.']], [
        ['judge', '{p}, this is the stupidest case ever put before a skeleton.'],
        ['p', 'How would you know?'],
        ['judge', 'I have no brain, {p}, and it still hurts.']]) },
      { ask: 'Ask the bailiff for the drawer’s record.', clue: 'Seventeen complaints about the whispering drawer are on file. The newest was filed by {p}, a week before it lent the sock.', lines: alt([
        ['bailiff', 'Seventeen complaints about that drawer, Your Honour. They all say “whispering”. The oldest is in Latin. The newest is from {p}.'],
        ['npc', 'That drawer whispered at my christening. I thought it was the vicar. It was not the vicar. The vicar was in the drawer.', 'uncle']], [
        ['bailiff', 'Seventeen complaints about that drawer, Your Honour. The newest is from {p}, filed a week before it lent the sock.'],
        ['judge', 'Who else complained?'],
        ['npc', 'Me. In 1790. They told me to put a sock in it.', 'uncle']]) },
      { ask: 'Ask {p} if it even wants the sock back.', happen: 'outburst', party: 'p', lines: alt([
        ['p', 'Not really. I want it to stop saying “wrong”.'],
        ['judge', 'That is not a sock problem, {p}. That is a you problem.']], [
        ['p', 'I do not want the sock, Your Honour. I want it to stop talking about me to the other socks.'],
        ['judge', 'And what does it tell them?'],
        ['narrator', '(From the jar, a whisper: “Wrong.” From the bottom drawer, across the shelf, forty tiny voices: “Wrong.”)'],
        ['p', 'THEY ARE ORGANISING.']]) }
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
      { ask: 'Ask {p} whether there were real flies at the sitting.', clue: 'There were real flies around {p} for the whole sitting. Fourteen of them.', lines: alt([
        ['p', '…Some flies.'],
        ['judge', 'How many?'],
        ['p', 'A normal number. For me.'],
        ['bailiff', 'Fourteen, Your Honour. They are in the gallery today. They came to support {p}.']], [
        ['p', 'No flies, Your Honour. None. Not one.'],
        ['d', 'Fourteen, Your Honour. For all six hours. They worked in shifts.'],
        ['p', 'They were VISITORS.']]) },
      { ask: 'Ask {d} how long it has been painting.', clue: '{d} took up painting on Tuesday and was charging full price by Wednesday.', lines: alt([
        ['d', 'Since Tuesday.'],
        ['judge', 'This Tuesday?'],
        ['d', 'I am a natural. It is a gift. It is also twelve souls.']], [
        ['d', 'All my life, Your Honour. Since Tuesday.'],
        ['judge', 'And when did you start charging?'],
        ['d', 'Full price, Wednesday. By then I had peaked.']]) },
      { ask: 'Ask what {p} paid for it.', clue: '{d} charged twelve souls. One of them was for the flies.', lines: alt([
        ['p', 'Twelve souls.'],
        ['judge', 'Twelve souls, for a skill acquired on Tuesday.'],
        ['d', 'Eleven for the portrait. One for the flies. Flies are fiddly.']], [
        ['p', 'Twelve souls, Your Honour. Eleven for the portrait, one for the flies.'],
        ['judge', 'You charged extra for the flies, {d}?'],
        ['d', 'They were not in the quote, Your Honour. {p} brought them on the day.']]) },
      { ask: 'Have the bailiff show the painting to the audience.', happen: 'faint', lines: alt([
        ['narrator', '(The bailiff turns the painting round. The audience screams. One ghost leaves through the wall, then through the next wall.)'],
        ['audience', '(A small voice from the back: “IT’S BEAUTIFUL.” It is Madam Moth.)']], [
        ['narrator', '(The bailiff turns the painting round. The audience goes very quiet. In the back row, a ghost slowly takes off its hat.)'],
        ['p', 'PUT YOUR HAT BACK ON.']]) },
      { ask: 'Tell {p} the painting is flattering, actually.', sass: true, lines: alt([
        ['judge', '{p}, I have seen you. I have seen the painting. The painting is being generous. The flies are being generous.'],
        ['p', 'The flies are WITNESSES.']], [
        ['judge', '{p}, I have been dead for three hundred years. I know dead. That painting has more colour in its cheeks than you have ever had.'],
        ['p', 'The painting is GREY.'],
        ['judge', 'You are beige, {p}. Grey is a promotion.']]) },
      { ask: 'Ask {p} whether it sat still.', clue: '{p} sat so still for six hours that {d} held a mirror under its nose. Twice.', lines: alt([
        ['p', 'Perfectly still. Six hours. I barely blinked.'],
        ['d', 'It was very unsettling. I held a mirror under its nose. Twice. The second time the mirror looked worried.']], [
        ['p', 'Like a statue, Your Honour. Six hours. I am a professional.'],
        ['d', 'I held a mirror under its nose. Twice.'],
        ['judge', 'Did it mist up?'],
        ['d', 'No, Your Honour. The second time, a fly moved in.']]) }
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
      { ask: 'Ask {p} where it got the teeth.', clue: 'The teeth came from a jar labelled NOT UNCLE’S, in Uncle’s handwriting.', lines: alt([
        ['p', 'A jar. It says “NOT UNCLE’S”.'],
        ['judge', 'In handwriting that is very obviously Uncle’s.'],
        ['p', 'I do not read handwriting, Your Honour. I read labels.'],
        ['npc', 'THOSE ARE MY TEETH. I HAVE BEEN GUMMING SOUP SINCE 1911.', 'uncle']], [
        ['p', 'Out of a jar marked “NOT UNCLE’S”, Your Honour. So I knew they were not Uncle’s.'],
        ['judge', 'And whose handwriting is the label in?'],
        ['p', 'Uncle’s.'],
        ['npc', 'IT WAS A DISGUISE.', 'uncle']]) },
      { ask: 'Ask {d} what it spent the three souls on.', clue: '{d} spent the tooth money on a hat that nobody can see.', lines: alt([
        ['d', 'A hat.'],
        ['judge', 'Where is the hat?'],
        ['d', 'I am wearing it.'],
        ['narrator', '({d} is not wearing a hat.)'],
        ['d', 'It is a very exclusive hat.']], [
        ['d', 'A hat, Your Honour. Wide brim. A feather. Three souls.'],
        ['judge', 'I cannot see a hat, {d}.'],
        ['d', 'The man in the shop could not see it either. He said that is how you know it is working.']]) },
      { ask: 'Have the bailiff check {d}’s mouth.', sass: true, lines: alt([
        ['bailiff', 'All present, Your Honour. Plus one extra.'],
        ['judge', 'An extra tooth, {d}?'],
        ['d', 'Everyone needs a spare.'],
        ['npc', 'THAT ONE IS MINE AS WELL.', 'uncle']], [
        ['bailiff', 'One tooth too many, Your Honour. At the back. It is much older than the rest of {d}.'],
        ['npc', 'THAT IS MY WISDOM TOOTH.', 'uncle'],
        ['judge', 'Then it is the only wisdom {d} has ever had.']]) },
      { ask: 'Ask {p} whether the teeth were ever really its.', clue: '{p} admits the teeth only became “its” by being put in a tin.', lines: alt([
        ['p', 'They became mine the moment I put them in my tin. That is how tins work.'],
        ['judge', 'That is how burglary works.']], [
        ['judge', 'Were those teeth ever yours, {p}? Before the tin?'],
        ['p', 'Nothing is anybody’s before the tin, Your Honour. The tin is what makes it mine.'],
        ['judge', 'Bailiff. Fetch a tin big enough for {p}.']]) },
      { ask: 'Call the tooth fairy.', happen: 'faint', lines: alt([
        ['narrator', '(A small, exhausted fairy is led in. She carries a sack of teeth and has the eyes of someone who has seen too many pillows.)'],
        ['narrator', '(The fairy: “I pay for teeth. I do not ask whose. Nobody in this job asks whose. You would never sleep again.”)'],
        ['judge', 'Whose teeth do you usually get?'],
        ['narrator', '(The fairy: “I am going home.”)']], [
        ['narrator', '(The tooth fairy is led in. She is the size of a thumb, wears a cardigan, and drags a sack that rattles when she breathes.)'],
        ['judge', 'Do you recognise {d}?'],
        ['narrator', '(The fairy: “I never look at faces. I look at gums.” She glances up at the gallery. Uncle shuts his mouth.)']]) },
      { ask: 'Ask {d} if it would do it again.', happen: 'outburst', party: 'p', lines: alt([
        ['d', 'Tomorrow. The fairy does a loyalty card. Two more teeth and I get a free pillow.']], [
        ['d', 'Tonight, Your Honour. {p} has a whole mouthful and barely uses them.'],
        ['p', 'STOP LOOKING AT MY MOUTH.']]) }
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
      { ask: 'Have {d} write the word “everything”.', clue: '{d} spells it “EVRYTHING”, with a heart, exactly like the forged page.', lines: alt([
        ['narrator', '({d} writes “EVRYTHING” in purple crayon and dots the I with a heart. There is no I.)'],
        ['judge', 'The will also says “EVRYTHING”.'],
        ['d', 'Common mistake. Very common. There are probably loads of us.']], [
        ['narrator', '({d} grips the purple crayon in its fist and writes “EVRYTHING”. Then, out of habit, it draws a heart.)'],
        ['judge', 'That is exactly how it is spelled on the will. Heart and all.'],
        ['d', 'That is how everybody spells it. You spell it.'],
        ['judge', 'E. V. E. R. Y.'],
        ['d', 'Show-off.']]) },
      { ask: 'Ask {p} whether it is dying.', clue: '{d} is openly waiting for {p} to die.', happen: 'outburst', party: 'p', lines: alt([
        ['p', 'No!'],
        ['d', 'Not YET.'],
        ['judge', '{d}, did you just say “not yet”?'],
        ['d', 'I said “the jet”. There is a jet. Somewhere. Probably.']], [
        ['p', 'No, Your Honour. I have never felt better.'],
        ['narrator', '({d} leans across and presses an ear to {p}’s chest. It listens for a long time, hopefully.)'],
        ['d', 'Strong as anything, Your Honour. I will check again after lunch.'],
        ['p', 'GET YOUR EAR OFF ME.']]) },
      { ask: 'Tell {d} a heart is not a signature.', sass: true, lines: alt([
        ['judge', 'A heart is not a signature, {d}. A heart is a muscle. I have not had one since 1702 and I sign things perfectly well.'],
        ['d', 'With what?'],
        ['judge', 'A bone.']], [
        ['judge', 'A heart is not a signature, {d}. A heart is a doodle with ideas above its station.'],
        ['d', 'Then what is a signature?'],
        ['judge', 'A doodle with a lawyer.']]) },
      { ask: 'Ask the bailiff what he found in {d}’s slot.', clue: 'A purple crayon and three drafts of the will were found in {d}’s slot. Each is marked PRACTICE.', lines: alt([
        ['bailiff', 'One purple crayon, Your Honour. Three drafts of the will. They each say “practice”. The third one is quite good.']], [
        ['bailiff', 'One purple crayon, Your Honour, worn to a stub. And three drafts of the will, each marked PRACTICE.'],
        ['judge', 'Do the drafts differ?'],
        ['bailiff', 'In the first, {d} gets everything. By the third, {d} also gets the moth.']]) },
      { ask: 'Ask the moth what she thinks.', lines: alt([
        ['npc', 'I was promised a spoon. I have waited a very long time for this spoon. I would like that noted.', 'moth'],
        ['judge', 'You are not a party to this case.'],
        ['npc', 'I am a party to every case with a spoon in it.', 'moth']], [
        ['npc', 'I do not care who gets everything. I care who gets the spoon.', 'moth'],
        ['judge', 'Why does a moth need a spoon?'],
        ['npc', 'I visit it every night. We are very close. I polish it with my face.', 'moth']]) },
      { ask: 'Ask {d} what it would do with everything.', sass: true, lines: alt([
        ['d', 'Get a bigger slot. A second spoon. Visit {p}’s grave every week.'],
        ['judge', '{p} is not dead.'],
        ['d', 'Fortnightly, then.']], [
        ['d', 'Spend it wisely, Your Honour. A throne. A moat. Staff.'],
        ['judge', '{d}, everything {p} owns is one spoon, and the spoon is promised to a moth. You forged a will to rob a moth.']]) }
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
      { ask: 'Have the bailiff check {d} for labels.', clue: '{p} has labelled {d} as its own property.', lines: alt([
        ['bailiff', 'One label, Your Honour, on the back. It says “{p}’s. DO NOT EAT.”'],
        ['judge', 'You labelled another resident as food.'],
        ['p', 'As property. Food is a kind of property. Everybody knows that.']], [
        ['bailiff', 'One label, Your Honour, in the middle of the back, where {d} cannot reach. It says “{p}’s”.'],
        ['p', 'It was in my slot. Everything in my slot gets a label.'],
        ['judge', 'Why was {d} in your slot?'],
        ['p', 'I put it there, Your Honour. To label it.']]) },
      { ask: 'Ask who actually bought the biscuit.', clue: '{d} bought the biscuit with its own souls, and kept the receipt.', lines: alt([
        ['d', 'Me. With my own souls. I have the receipt.'],
        ['narrator', '({d} produces the receipt. There is a label on the receipt. It says “{p}’s”.)']], [
        ['d', 'I did, Your Honour. With my own souls. I kept the receipt.'],
        ['judge', 'May I see it?'],
        ['narrator', '({d} opens its mouth and takes out a small, damp receipt.)'],
        ['d', 'It is the only place on this shelf without a label.']]) },
      { ask: 'Have the bailiff look under the bench.', clue: '{p} labelled the judge’s bench during the opening statements.', lines: alt([
        ['narrator', '(There is a label on the judge’s bench. It says “{p}’s”.)'],
        ['judge', 'When did you do this?'],
        ['p', 'During your entrance. You were very dramatic. Nobody was watching me.']], [
        ['bailiff', 'One label under the bench, Your Honour. It says “{p}’s”. The glue is still wet.'],
        ['p', 'I did it during the opening statements. You had your eyes shut.'],
        ['judge', 'I have no eyelids, {p}.'],
        ['p', 'Then you let me.']]) },
      { ask: 'Ask {d} how the biscuit tasted.', lines: alt([
        ['d', 'Like victory, Your Honour. And a bit like glue. From the label.'],
        ['judge', 'You ate the label.'],
        ['d', 'The label was the best bit.']], [
        ['d', 'Buttery, Your Honour. Crumbly. With a faint aftertaste of being watched.'],
        ['p', 'You are welcome.']]) },
      { ask: 'Ask {p} what “I will know” means.', happen: 'sleep', lines: alt([
        ['p', 'It means I have a system.'],
        ['judge', 'What system?'],
        ['p', 'I sit very still in the dark and watch the biscuits.'],
        ['judge', 'Since when?'],
        ['p', 'March.']], [
        ['p', 'It is a system, Your Honour. In eleven parts.'],
        ['judge', 'Summarise.'],
        ['p', 'Part one, the label. Part two, the label again, in case the first one falls off. Part three, I watch.'],
        ['judge', 'And parts four to eleven?'],
        ['p', 'Mostly watching. I will take you through them slowly.']]) },
      { ask: 'Have the bailiff put a label on {p}.', sass: true, happen: 'outburst', party: 'p', lines: alt([
        ['judge', 'Bailiff. A label, please.'],
        ['narrator', '(The bailiff sticks a label on {p}. It says “NOT {p}’s. NOTHING IS.”)'],
        ['p', 'TAKE IT OFF. TAKE IT OFF.']], [
        ['judge', 'Bailiff. A label for {p}. Big letters, for the back row.'],
        ['narrator', '(The bailiff slaps a label on {p}’s forehead. It says “{d}’s”.)'],
        ['judge', 'There. The first thing in this case that has been labelled correctly.'],
        ['p', 'I AM NOT PROPERTY.']]) }
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
      { ask: 'Ask {d} what Gertrude said, exactly.', clue: 'The “ghost” told {p} to pay {d}. Twice. Then asked for a nice review.', lines: alt([
        ['d', '“Woooo. It is Gertrude. Pay {d}. Woooo. {d} is very gifted. Woooo. Five stars.”'],
        ['judge', 'Gertrude asked for a tip.'],
        ['d', 'She was very generous. For a dead lady.']], [
        ['d', 'She said, “Woooo. Pay {d}.” Then, “Pay {d} again. It is a long way from the other side.”'],
        ['judge', 'Anything else?'],
        ['d', '“And leave a nice review. It really helps small mediums.”']]) },
      { ask: 'Ask {d} about the medical reasons.', clue: '{d} admits to being under the table.', lines: alt([
        ['d', 'I have a condition where I have to be under a table whenever somebody pays me.'],
        ['judge', 'That is not a condition.'],
        ['d', 'It is a very rare condition. There is a leaflet. I am on the leaflet.']], [
        ['d', 'Vertigo, Your Honour. I come over dizzy above table height.'],
        ['judge', 'So you were under the table.'],
        ['d', 'On doctor’s orders, Your Honour. He told me to keep my head down.']]) },
      { ask: 'Make {d} do the voice.', sass: true, lines: alt([
        ['judge', 'Do the voice.'],
        ['d', '…woooo.'],
        ['judge', 'Again. Like you mean it.'],
        ['d', 'WOOOOOOOO. I AM GERTRUDE. EAT SOMETHING.'],
        ['narrator', '({p} bursts into tears. It was a very good Gertrude.)']], [
        ['judge', 'Do the voice, {d}. For the court.'],
        ['narrator', '({d} will not do it until it has crawled under the bench.)'],
        ['d', '(muffled) Woooo. Eat something.'],
        ['judge', 'Five souls for that. I am actually dead, and I would have done it for three.']]) },
      { ask: 'Call a real ghost to give evidence.', clue: 'The Ministry of Haunting confirms Gertrude was on holiday that night. In Margate.', lines: alt([
        ['npc', 'Ministry of Haunting. I have reviewed the séance. That was a small person under a table. Also, Gertrude is in Margate.', 'ghost'],
        ['judge', 'Ghosts go on holiday?'],
        ['npc', 'Seaside towns, mostly. We love a pier. Nobody can tell.', 'ghost']], [
        ['npc', 'Ministry of Haunting. Gertrude signed out for a holiday that night, Your Honour. Margate.', 'ghost'],
        ['judge', 'Could she not have popped back for half an hour?'],
        ['npc', 'She had a donkey booked, Your Honour. You do not cancel a donkey.', 'ghost']]) },
      { ask: 'Ask {p} what it wanted to ask Gertrude.', happen: 'outburst', party: 'p', lines: alt([
        ['p', 'Where she hid the good biscuits.'],
        ['judge', 'That was it?'],
        ['p', 'They were VERY good biscuits.'],
        ['d', 'Top of the wardrobe. Behind the hatbox.']], [
        ['p', 'Where she hid the good biscuits. The ones in the tin with the Scottie dog on.'],
        ['judge', 'Did you get an answer?'],
        ['d', '(brushing crumbs off itself) She said she could not remember.'],
        ['p', 'THOSE ARE GERTRUDE’S CRUMBS.']]) },
      { ask: 'Explain to {p} that the dead are not a vending machine.', sass: true, lines: alt([
        ['judge', '{p}. The dead are not a vending machine. You do not put in five souls and get a Gertrude.'],
        ['p', 'Then what do you get?'],
        ['judge', 'In my experience? A {d} under a table.']], [
        ['judge', '{p}, the dead are not a vending machine. Look at my gallery. Two hundred dead, and not one of them has ever handed anybody a biscuit.'],
        ['audience', '(A ghost in the third row quietly puts a biscuit back in its pocket.)']]) }
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
      { ask: 'Ask {d} for proof that {p} asked.', clue: '{p} signed a form: “Practice burial. Do not dig up until Thursday.”', lines: alt([
        ['d', 'I have a form.'],
        ['narrator', '(The form reads: “Practice burial. Do not dig up until Thursday. No lilies. Signed, {p}.”)'],
        ['judge', '{p}, is that your signature?'],
        ['p', 'I sign a LOT of things, Your Honour.']], [
        ['d', 'I have it in writing, Your Honour.'],
        ['bailiff', 'It reads: “Practice burial. Do not dig up until Thursday.” Signed by {p}. There is also a box ticked for “daisy”.'],
        ['p', 'I thought I was signing for the daisy.']]) },
      { ask: 'Ask {p} what day it got out.', clue: '{p} came out on exactly the Thursday its own form asked for. It had set an alarm.', happen: 'outburst', party: 'p', lines: alt([
        ['p', 'Thursday.'],
        ['judge', 'The form says Thursday.'],
        ['p', 'That is a COINCIDENCE.'],
        ['bailiff', 'It came out at nine sharp, Your Honour. It had set an alarm.']], [
        ['p', 'Thursday, Your Honour. After four days of struggle. It could have been any day.'],
        ['judge', 'The form you signed says Thursday.'],
        ['d', 'Nine sharp, Your Honour. I heard its alarm go off under the soil.'],
        ['p', 'THAT WAS A WORM.']]) },
      { ask: 'Tell {p} the court has been buried too and it was lovely.', sass: true, lines: alt([
        ['judge', 'I have been buried for three hundred years, {p}. It is lovely. The worms are chatty. You did four days and you want twenty souls?'],
        ['p', 'The worms were NOT chatty.'],
        ['judge', 'Then you got the wrong worms. That is a customer service matter.']], [
        ['judge', '{p}, I have been buried. It was lovely. Gallery, hands up who enjoyed being buried.'],
        ['audience', '(Every ghost puts a hand up. One asks, quietly, if it can go back.)'],
        ['judge', 'There is a waiting list, {p}. You jumped the queue.']]) },
      { ask: 'Ask {p} about the teaspoon.', lines: alt([
        ['p', 'A good teaspoon. Silver. I’m keeping it.'],
        ['d', 'That is MY teaspoon.'],
        ['judge', 'So {p} went into the ground with nothing and came up with silver. That is called mining.']], [
        ['p', 'Four days I dug with it, Your Honour. It is bent now. It has seen things.'],
        ['d', 'That was my good teaspoon.'],
        ['p', 'It is my teaspoon now. We have been through a lot together. Mostly soil.']]) },
      { ask: 'Ask the plant pot’s regular occupant.', happen: 'faint', lines: alt([
        ['npc', 'It spent four days on top of my father. Father did not mind. He said it was nice to have company.', 'geoffrey2'],
        ['judge', 'Your father is dead, Geoffrey.'],
        ['npc', 'He is a very good listener.', 'geoffrey2']], [
        ['npc', 'I live in that pot, Your Honour. Me, my wife, and underneath us, my father.', 'geoffrey2'],
        ['judge', 'And how was {p} as a neighbour?'],
        ['npc', 'Rude. It used Father as a step on the way out.', 'geoffrey2']]) },
      { ask: 'Ask {d} if it would bury {p} again.', lines: alt([
        ['d', 'Only with a form. And only on a weekday. I am not a monster.']], [
        ['d', 'Happily, Your Honour. It has already rebooked. It wants a week this time.'],
        ['p', 'That was CONFIDENTIAL.']]) }
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
      { ask: 'Call Madam Moth to the stand.', clue: 'Madam Moth says she belongs to neither of them. She belongs to the light.', lines: alt([
        ['npc', 'I belong to nobody. I belong to the light. Mostly the lamp. Sometimes the fridge, when it is open.', 'moth'],
        ['judge', 'Do you like either of them?'],
        ['npc', '{p} is soft. {d} is warm. Neither of them is a lamp. I have been very clear about this.', 'moth']], [
        ['judge', 'Madam Moth. Whose are you?'],
        ['npc', 'Neither of theirs. I belong to the light.', 'moth'],
        ['judge', 'Which light?'],
        ['npc', 'Any light, Your Honour. Even you, when the studio lamp catches your skull.', 'moth']]) },
      { ask: 'Ask {d} what it calls the moth.', happen: 'outburst', party: 'p', lines: alt([
        ['d', 'Mothew.'],
        ['p', 'HER NAME IS NOT MOTHEW.'],
        ['npc', 'I answer to Mothew.', 'moth']], [
        ['d', 'In public, Madam Moth. At home, Mothew. When it is just the two of us, Mothew the Magnificent.'],
        ['p', 'SHE IS NOT MAGNIFICENT. SHE IS MINE.']]) },
      { ask: 'Ask {p} about the sleeve.', lines: alt([
        ['p', 'She ate it while I was in it. It was the most intimate moment of my life.'],
        ['judge', 'Did you consent?'],
        ['p', 'I did not NOT consent.']], [
        ['p', 'She started at the cuff on a Tuesday, Your Honour. By Friday she was at my elbow.'],
        ['judge', 'And you just let her?'],
        ['p', 'I held my arm very still. You do not move the plate while a lady is eating.']]) },
      { ask: 'Tell them both the moth is seeing other people.', sass: true, lines: alt([
        ['judge', 'Both of you, listen. The moth has been seeing the lamp. And the fridge. And a porch light two doors down.'],
        ['judge', 'This is not a custody battle. It is a love triangle, and you are both losing to electricity.']], [
        ['judge', 'I am sorry to be the one to tell you both. The moth is seeing other people.'],
        ['p', 'Who?'],
        ['judge', 'Anything with a switch, {p}. Last week it was the toaster, and the toaster is not even a light.']]) },
      { ask: 'Ask the bailiff where the moth actually sleeps.', clue: 'The moth splits her week between {p}, {d} and the lamp, and has done for months.', lines: alt([
        ['bailiff', 'Surveillance, Your Honour. Monday to Wednesday with {p}. Thursday to Saturday with {d}. Sundays with the lamp, in what I can only describe as a situation.']], [
        ['bailiff', 'I have kept a diary since the spring, Your Honour. Three nights a week with {p}. Three with {d}. One with the lamp.'],
        ['judge', 'And where does she seem happiest?'],
        ['bailiff', 'The lamp, Your Honour. She comes back glowing.']]) },
      { ask: 'Ask {d} what it feeds her.', clue: '{d} has been feeding the moth {p}’s socks. {p} has been feeding her {d}’s.', lines: alt([
        ['d', 'Wool. Crumbs. Some of {p}’s socks.'],
        ['p', 'THAT is where they went? I have been feeding her YOURS.'],
        ['d', '…Those were my socks?']], [
        ['d', 'Wool, Your Honour. Socks, mostly. {p}’s.'],
        ['p', 'That is odd. Every night I give her one of {d}’s.'],
        ['bailiff', 'Your Honour, that would explain the waddle.']]) }
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
      { ask: 'Ask {d} whose name is on the leg.', clue: 'There is a name tape sewn inside the top of the leg. It says {p}.', lines: alt([
        ['d', 'Nobody’s. It is a leg. Legs do not have names.'],
        ['narrator', '(The bailiff turns down the top of the leg. Inside, sewn in like a school jumper, is a name tape. It says {p}.)'],
        ['d', 'That could be any {p}.']], [
        ['d', 'Mine, Your Honour.'],
        ['narrator', '(The bailiff folds back the top of the leg. Sewn inside is a little name tape. It says {p}.)'],
        ['d', 'That is the make, Your Honour. They do a very good leg.']]) },
      { ask: 'Call the race steward.', clue: 'Sir Reginald Whiskers saw {d} get into the sack with one more leg than it arrived with.', lines: alt([
        ['npc', 'I stewarded the sack race. {d} got into the sack with one more leg than it came with.', 'cat'],
        ['judge', 'And you did not disqualify it?'],
        ['npc', 'I was asleep by the finish. I was asleep by the start. I am a cat.', 'cat']], [
        ['npc', '{d} arrived at the start line with the usual number of legs, Your Honour, and got into the sack with one more.', 'cat'],
        ['judge', 'And you said nothing?'],
        ['npc', 'I am a cat. I assumed it had eaten somebody.', 'cat']]) },
      { ask: 'Have {d} walk to the bench and back.', clue: 'The leg is the wrong length for {d}. {d} now walks in a slow circle to the right.', lines: alt([
        ['narrator', '({d} sets off towards the bench, bears steadily right, and arrives back at its own podium four minutes later.)'],
        ['judge', 'You did not reach the bench.'],
        ['d', 'I got the gist of it.']], [
        ['narrator', '({d} sets off for the bench and bears slowly right. It passes the jury box twice. The second time, the jury waves.)'],
        ['judge', 'That leg is the wrong length for you, {d}.'],
        ['d', 'Or I am the wrong length for the leg, Your Honour. The leg has been very understanding.']]) },
      { ask: 'Ask {p} whether it has tried growing another one.', sass: true, lines: alt([
        ['judge', '{p}, the lizard in the garden grows a new tail every spring. Have you tried applying yourself?'],
        ['p', 'I have sat in a pot of soil every night since the race.'],
        ['judge', 'And?'],
        ['p', 'Something is coming up. It is a radish.']], [
        ['p', 'Your Honour, I have been hopping for a fortnight.'],
        ['judge', 'Then grow another one, {p}. Starfish manage it. Worms manage it. I once watched a juror grow a second chin during my summing-up.']]) },
      { ask: 'Ask {d} what the leg has been doing since the race.', happen: 'outburst', party: 'p', lines: alt([
        ['d', 'Light training. A jog on Tuesdays. It has had an offer from a centipede.'],
        ['judge', 'An offer.'],
        ['d', 'The leg is weighing it up. It would be one of a hundred, but it would be first team.']], [
        ['d', 'It has really come out of itself, Your Honour. Tap on Mondays. It has been asked to model for a stocking catalogue.'],
        ['p', 'IT NEVER DID TAP FOR ME.']]) },
      { ask: 'Ask {p} whether there was any agreement.', clue: '{d} wrote “BACK BY TEATIME. PROMISE.” on {p}’s other leg in felt pen, and signed it.', lines: alt([
        ['p', 'There was. {d} wrote it on my other leg, so I would not lose it.'],
        ['narrator', '({p} holds up its other leg. On it, in felt pen: “BACK BY TEATIME. PROMISE. {d}”)'],
        ['d', 'It has smudged. It could say anything.'],
        ['judge', 'It says PROMISE, {d}. In capitals. With a smiley face.']], [
        ['p', 'In writing, Your Honour. {d} wrote it on my other leg.'],
        ['narrator', '({p} lifts the other leg to show the court, and falls over. From the floor, the leg reads, in felt pen: “BACK BY TEATIME. PROMISE. {d}”)'],
        ['d', 'Your Honour, would you trust a leg to somebody who falls over that easily?']]) }
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
      { ask: 'Have the bailiff run a finger down {d}.', clue: 'The grey comes off {d} on a finger. Underneath, {d} is spotless.', lines: alt([
        ['narrator', '(The bailiff runs a finger down {d}’s back. It comes away grey. Underneath, {d} is spotless.)'],
        ['bailiff', 'It is on quite loose, Your Honour.'],
        ['d', 'That is how complexions work.']], [
        ['narrator', '(The bailiff runs a finger down {d}. The finger comes away grey. It leaves a clean stripe, and under the stripe {d} is spotless.)'],
        ['judge', '{d}, you have a stripe.'],
        ['d', 'That is a laughter line.']]) },
      { ask: 'Call a witness who lived in the dust.', clue: 'Geoffrey the Woodlouse went to sleep on {p} on Monday and woke up on {d}, in the same dust.', lines: alt([
        ['npc', 'My family has lived on {p} for three generations. Left shoulder. My grandfather was born there.', 'woodlouse'],
        ['npc', 'On Monday I went to sleep on {p}. On Tuesday I woke up on {d}. Same dust. Much worse view.', 'woodlouse']], [
        ['npc', 'On Monday I went to sleep on {p}, Your Honour. On Tuesday I woke up on {d}. Same dust.', 'woodlouse'],
        ['judge', 'How can you be sure it was the same dust?'],
        ['npc', 'My name is written in it. I did it myself, as a larva.', 'woodlouse']]) },
      { ask: 'Ask {d} what it used for the dusting.', clue: '{d} swept {p}’s dust into a jar with a lid, “to keep it fresh”.', lines: alt([
        ['d', 'A soft brush. And a jar, for the dust. And a lid for the jar.'],
        ['judge', 'Why does dust need a lid?'],
        ['d', 'To keep it fresh.']], [
        ['d', 'A feather, to get it off {p}. A jar, with a lid, to keep it fresh.'],
        ['judge', 'Fresh for what?'],
        ['d', 'Special occasions, Your Honour. Like court.']]) },
      { ask: 'Tell {p} that dust is not a personality.', sass: true, lines: alt([
        ['judge', '{p}, dust is not a personality. I am mostly dust, and I have a personality entirely my own.'],
        ['p', 'How much of your dust is yours?'],
        ['judge', '…Most of it.']], [
        ['judge', '{p}, dust is not a personality.'],
        ['p', 'It was MY dust.'],
        ['judge', 'And it has moved on, {p}. It is with {d} now. It looks happier.']]) },
      { ask: 'Ask {p} what was in the dust.', happen: 'heckle', lines: alt([
        ['p', 'A crumb from 1964. The lid of a biro. A sequin. Geoffrey. Geoffrey’s furniture.'],
        ['judge', 'Anything of value?'],
        ['p', 'Geoffrey’s furniture is very good. Geoffrey has taste.']], [
        ['p', 'A crumb from 1953. Half a stamp. An eyelash, not mine. A very small door.'],
        ['judge', 'A door to what?'],
        ['p', 'I never opened it, Your Honour. It was not my business.']]) },
      { ask: 'Ask {d} why anyone would want somebody else’s dust.', happen: 'outburst', party: 'p', lines: alt([
        ['d', 'Hypothetically? Nobody on this shelf takes you seriously unless you look at least a hundred.'],
        ['d', 'And, hypothetically, I looked about sixty.']], [
        ['d', 'Gravitas, Your Honour. Eighty years of dust normally takes eighty years. Unless you know somebody.'],
        ['d', 'And it hangs better on me. It always sagged on {p}.'],
        ['p', 'IT WAS MADE TO MEASURE.']]) }
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
      { ask: 'Call the seller.', clue: 'Mrs Widow sold {d} the pulse at her jumble sale. It was her late husband’s.', lines: alt([
        ['npc', 'I sold {d} that pulse on Wednesday. Two souls. It was my late husband’s.', 'widow'],
        ['judge', 'He did not want it?'],
        ['npc', 'He had stopped using it. I kept it in my sewing box for forty years. He never could keep still.', 'widow']], [
        ['npc', 'I sold it to {d} at my jumble sale, Your Honour. Two souls. It was my late husband’s.', 'widow'],
        ['judge', 'Did your husband not mind?'],
        ['npc', 'I asked him. He did not say anything. He never did say much at breakfast.', 'widow']]) },
      { ask: 'Have the bailiff take {d}’s pulse.', clue: '{d}’s pulse is in three-four time. It waltzes.', lines: alt([
        ['narrator', '(The bailiff holds {d}’s wrist and counts, moving his lips.)'],
        ['bailiff', 'One two three. One two three. Your Honour, it is waltzing.'],
        ['p', 'Mine could have learned.']], [
        ['narrator', '(The bailiff holds {d}’s wrist. After a moment his foot starts tapping. Then he starts to sway.)'],
        ['bailiff', 'Three-four time, Your Honour. It is a waltz.'],
        ['narrator', '(Before anybody can stop him, the bailiff has taken {d} twice round the courtroom. {d} leads.)']]) },
      { ask: 'Have the bailiff hold {p} up to the studio light.', clue: 'Inside {p} is a pocket watch, swallowed in 1896 and stopped at ten past four.', happen: 'faint', lines: alt([
        ['narrator', '(The bailiff holds {p} up to the light. Inside, clear as anything, is a small pocket watch, stopped at ten past four.)'],
        ['judge', '{p}. When did you swallow a watch?'],
        ['p', '1896. It was a Sunday. There was nothing else to do.']], [
        ['narrator', '(The bailiff holds {p} up to the light. Inside, where a heart would go, is a little pocket watch, stopped at ten past four.)'],
        ['judge', '{p}. What is that?'],
        ['p', 'A watch, Your Honour. I swallowed it in 1896. I thought it had gone through.']]) },
      { ask: 'Ask {p} what its pulse sounded like.', lines: alt([
        ['p', 'Steady. Reliable. Tick. Tick. Tick.'],
        ['judge', 'Tick.'],
        ['p', 'You could set your watch by it.'],
        ['judge', 'Yes, {p}. You could.']], [
        ['p', 'Tick. Tick. Tick. And once an hour, very quietly, a little ding.'],
        ['judge', 'A ding.'],
        ['p', 'I always thought that was my conscience.']]) },
      { ask: 'Remind {p} that nobody here needs a pulse.', sass: true, lines: alt([
        ['judge', '{p}, I have not had a pulse since 1702. I manage. I tap my foot so people know I am still here.'],
        ['narrator', '(The judge taps his foot. It clicks like knitting needles.)']], [
        ['p', 'Your Honour, I miss it.'],
        ['judge', '{p}, a pulse is only a clock counting down to your funeral. Somebody has taken yours away. You have been let off.']]) },
      { ask: 'Ask the jury to check their own pulses.', happen: 'outburst', party: 'p', lines: alt([
        ['jury', '{j} checks its wrist. Nothing. {j} checks the juror next to it. Nothing there either. {j} looks worried, then remembers.'],
        ['judge', 'So the only pulse in this room is on {d}.'],
        ['p', 'THAT IS MY POINT.']], [
        ['jury', '{j} checks its wrist, then its neck, then, to be thorough, under its hat. Nothing. A toffee.'],
        ['judge', 'So the only pulse in this courtroom is in {d}.'],
        ['audience', '(The gallery goes “aww”.)'],
        ['p', 'DO NOT AWW AT IT. IT IS MINE.']]) }
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
      { ask: 'Ask {d} to describe the museum.', clue: '{d} spent last week locked in a glass case at the town museum, labelled UNKNOWN CREATURE, c. 1740.', lines: alt([
        ['d', 'A glass case. Locked. A little card, and a rope so nobody gets too close.'],
        ['narrator', '({d} produces the card. It says: UNKNOWN CREATURE, c. 1740. PLEASE DO NOT TAP THE GLASS.)'],
        ['d', 'They tapped the glass.']], [
        ['d', 'The town museum, Your Honour. Upstairs, past the stuffed owl. A glass case, locked, all week.'],
        ['judge', 'And what did your card say?'],
        ['d', '“UNKNOWN CREATURE, c. 1740.”'],
        ['judge', 'Are you from 1740?'],
        ['d', 'I am now.']]) },
      { ask: 'Call the exhibit from the next case along.', clue: 'Susan, in the next case along, says {d} did not move all week.', lines: alt([
        ['npc', 'I was in case fourteen. {d} was in case thirteen. Nobody moved all week.', 'susan'],
        ['npc', 'A school trip drew us both. I came out better. I have the drawing.', 'susan']], [
        ['npc', 'I was in the case next door, Your Honour. {d} did not move all week.', 'susan'],
        ['judge', 'Not once?'],
        ['npc', 'Not even when a child licked the glass. I moved once. A guard saw. He has not been back.', 'susan']]) },
      { ask: 'Ask the lamp what it has seen.', clue: 'The Lamp has watched {p} get up at three every night and push its own bed an inch nearer.', lines: alt([
        ['npc', 'Every night at three, {p} gets up, pushes its bed one inch nearer to me, and goes back to sleep.', 'lamp'],
        ['judge', 'And you said nothing?'],
        ['npc', 'I did not want it to stop.', 'lamp']], [
        ['npc', 'Every night at three, {p} gets out of bed, pushes the bed one inch towards me, and gets back in.', 'lamp'],
        ['judge', 'Did you not think to wake it?'],
        ['npc', 'I flickered once, Your Honour. It pushed faster.', 'lamp']]) },
      { ask: 'Have the bailiff measure how far the bed has come.', happen: 'dark', lines: alt([
        ['bailiff', 'Seven inches, Your Honour. All towards the lamp. At this rate it arrives on Thursday.'],
        ['npc', 'I have tidied.', 'lamp']], [
        ['bailiff', 'Seven inches, Your Honour, every one of them towards the lamp.'],
        ['judge', 'And at this rate?'],
        ['bailiff', 'It reaches the lamp on Thursday, Your Honour, and goes off the end of the shelf on Friday.']]) },
      { ask: 'Tell {d} that being in a museum is showing off.', sass: true, lines: alt([
        ['judge', '{d}. I have been dead for three hundred years and no museum has ever asked for me.'],
        ['d', 'Have you asked them?'],
        ['judge', 'I have written. Twice. They sent back a leaflet about leaving your body to science.']], [
        ['judge', '{d}, a week in a museum is showing off. I have been an antique for three hundred years, and all anybody ever gave me was this bench.'],
        ['d', 'It is a nice bench.'],
        ['judge', 'It came with a jury.']]) },
      { ask: 'Ask {d} what it thinks of {p}’s bed.', happen: 'outburst', party: 'p', lines: alt([
        ['d', 'Cheap. Damp. The drawer end sticks. I would not be seen dead pushing it, and I am in a museum.']], [
        ['d', 'It is a matchbox, Your Honour. It still says “SAFETY MATCHES” on the lid. I would not push it with a barge pole.'],
        ['p', 'IT IS A VERY SAFE BED.']]) }
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
      { ask: 'Have the bailiff search both slots.', clue: 'There is a blunt chisel in {p}’s slot and another in {d}’s. Both are covered in stone dust.', lines: alt([
        ['bailiff', 'One chisel in each slot, Your Honour. Both blunt. Both covered in stone dust.'],
        ['judge', 'Two chisels. For one stone.'],
        ['bailiff', 'And in {p}’s slot, a second, smaller dove. Half carved. It looks furious.']], [
        ['bailiff', 'One chisel in each slot, Your Honour. Both blunt. Both white with stone dust.'],
        ['judge', 'Where in {d}’s slot?'],
        ['bailiff', 'Under the pillow, Your Honour.'],
        ['d', 'Your Honour, anybody who shares a stone with {p} sleeps with a chisel.']]) },
      { ask: 'Call the resident who lives under the stone.', clue: 'Geoffrey the Second watched one name come off on Tuesday and the other on Wednesday.', lines: alt([
        ['npc', 'I live under that stone. On Monday it had two names. On Tuesday, one. On Wednesday, none.', 'geoffrey2'],
        ['judge', 'And now?'],
        ['npc', 'Now it just calls everybody liars. I have never felt so seen.', 'geoffrey2']], [
        ['npc', 'I live under that stone, Your Honour. On Tuesday night one name came off. On Wednesday night, the other.', 'geoffrey2'],
        ['judge', 'Did you see who?'],
        ['npc', 'Only feet, Your Honour. On Tuesday, small angry feet. On Wednesday, different small angry feet.', 'geoffrey2']]) },
      { ask: 'Ask {p} what it chiselled first.', clue: '{p} admits it took {d}’s name off first, “to make room”.', lines: alt([
        ['p', 'Nothing. I tidied. I made room.'],
        ['judge', 'Room for what?'],
        ['p', 'A bigger me.']], [
        ['judge', '{p}. Whose name came off first?'],
        ['p', '{d}’s, Your Honour. I needed to make room.'],
        ['judge', 'You chiselled {d} off its own grave.'],
        ['p', 'And it took it very personally.']]) },
      { ask: 'Point out that neither of them is going to die.', sass: true, lines: alt([
        ['judge', 'Neither of you is dead. Neither of you is ever going to be dead. Who is this stone for?'],
        ['d', 'We visit it on Sundays.'],
        ['p', 'We take a flask.']], [
        ['p', 'Your Honour, that stone is for eternity.'],
        ['judge', 'So are you, {p}. Neither of you is ever going to die. That stone is the most optimistic thing on this shelf.']]) },
      { ask: 'Ask {d} about the dove.', happen: 'throw', lines: alt([
        ['d', 'I paid for the dove. The dove is mine. {p} sits on the dove.'],
        ['p', 'It is the only flat bit.']], [
        ['d', 'I paid for the dove, Your Honour. I chose it out of a catalogue. I named it. It is called Gordon.'],
        ['p', 'It is called Brenda.']]) },
      { ask: 'Ask the jury who deserves the top line.', lines: alt([
        ['jury', '{j} says the top line should go to whoever dies first.'],
        ['narrator', '(The court waits. Nobody volunteers. The bailiff edges towards the door.)']], [
        ['jury', '{j} points out that there is plenty of room at the top now, and asks, casually, what the mason charges per letter.'],
        ['judge', '{j}. Nobody else is moving onto that grave.']]) }
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
      { ask: 'Have the bailiff open the tin.', clue: 'The sweets in the tin are buttons, each one carefully painted to look like a sweet.', lines: alt([
        ['narrator', '(The bailiff prises the lid off. The tin is full of buttons, each one painted, quite carefully, to look like a sweet.)'],
        ['judge', 'Who paints buttons to look like sweets?'],
        ['d', 'Somebody with a lot of time, Your Honour. So, any of us.'],
        ['bailiff', '(chewing) These are not sweets.']], [
        ['narrator', '(The bailiff eases the lid off. The tin is full of buttons, each one painted, with great care, to look like a sweet.)'],
        ['p', 'I have been guarding that tin since 1908.'],
        ['judge', 'Then you have been guarding a haberdashery.']]) },
      { ask: 'Ask {d} what flavour the sweets were.', clue: '{d} knows the sweets were lemon and slightly fizzy. The tin only says ASSORTED.', lines: alt([
        ['d', 'Lemon. Slightly fizzy. A bit dusty by the end, but lovely.'],
        ['judge', 'The tin says ASSORTED.'],
        ['d', 'Does it? Then I have no idea. Never met them.']], [
        ['judge', 'What flavour were the sweets, {d}?'],
        ['d', 'Lemon. Slightly fizzy. They make your ears go hot.'],
        ['judge', 'The tin says ASSORTED.'],
        ['d', 'Lemon is a sort of assorted.']]) },
      { ask: 'Have the bailiff examine the lid.', clue: 'Someone has been at the lid with a hairpin for years, from the side that faces {p}’s slot.', lines: alt([
        ['bailiff', 'Hundreds of little scratches round the lid, Your Honour. All on the side facing {p}’s slot.'],
        ['bailiff', 'And half a hairpin, snapped off in the rim.'],
        ['p', 'Everybody has a hairpin.'],
        ['judge', 'Not in the rim of the tin, {p}.']], [
        ['bailiff', 'Years of little scratches round the lid, Your Honour, all on the side facing {p}’s slot. And a bit of hairpin stuck in the rim.'],
        ['p', 'I do not even have hair.'],
        ['judge', 'Then what is the hairpin for, {p}?'],
        ['p', 'The tin.']]) },
      { ask: 'Explain to {p} how long “the end” is.', sass: true, lines: alt([
        ['judge', '{p}. Neither of you can die. This bet ends when the sun goes out, and I would not put money on it even then.'],
        ['p', 'I can wait.'],
        ['d', 'So can I.'],
        ['narrator', '(They look at each other. Neither of them blinks. Neither of them has blinked since 1908.)']], [
        ['judge', '{p}, here is how long the end is. The sun goes out. The house falls down. The shelf rots. And you two are still in the rubble, holding a tin, waiting.'],
        ['p', 'And then?'],
        ['judge', 'And then I adjourn for lunch.']]) },
      { ask: 'Call the witness to the bet.', lines: alt([
        ['npc', 'I witnessed it. 1908. A Tuesday. They shook hands on it.', 'raven'],
        ['npc', 'Then, when the other one was not looking, they both wiped their hands on me.', 'raven']], [
        ['npc', 'I witnessed it, Your Honour. 1908. They shook hands and I wrote it down.', 'raven'],
        ['judge', 'What did you write?'],
        ['npc', '“Nevermore.” I write that on everything. It saves time.', 'raven']]) },
      { ask: 'Ask {p} what it would do with the tin.', happen: 'outburst', party: 'd', lines: alt([
        ['p', 'Open it. Eat one. Visit {d}. Eat another one.'],
        ['judge', 'Visit {d} where?'],
        ['p', 'I have picked out a spot. It has a view.']], [
        ['p', 'Open it at {d}’s graveside, Your Honour. Slowly. One sweet at a time.'],
        ['p', 'I have been practising the crunch. You can hear it from the back.'],
        ['d', 'YOU WILL NOT CRUNCH AT MY GRAVE.']]) }
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
  },
  {
    id: 'borrowed-name', title: 'Squelch', truth: 'plaintiff',
    claim: '{p} is suing {d} for borrowing {p}’s name for the summer fête and bringing it back with a nickname.',
    asking: 'Its name back as lent, and for everybody to stop doing the noise',
    plaintiff: alt([
      ['p', 'I lent {d} my name for one afternoon, Your Honour. The summer fête. {d} is banned from the fête under its own.'],
      ['p', 'It came back on Monday with a nickname. The whole shelf calls me Squelch now.'],
      ['judge', 'Why Squelch?'],
      ['p', 'Nobody will tell me. They just do the noise.']
    ], [
      ['p', 'My name has been on this shelf since 1846. It has never been in any trouble. It has never been anywhere.'],
      ['p', 'I lent it to {d} for one fête. Now, when I walk past, the eggcups go “squelch”.'],
      ['judge', 'The eggcups.'],
      ['p', 'They had not said a word since 1846, Your Honour.']
    ]),
    defendant: alt([
      ['d', 'I gave the name back on Monday, Your Honour, as agreed. I even gave it a wipe.'],
      ['judge', 'Why did it need a wipe?'],
      ['d', 'I would not know, Your Honour. I was not at the fête. {p} was. It is on every form.']
    ], [
      ['d', 'I have not asked {p} what happened at the fête, Your Honour. It is none of my business.'],
      ['d', 'Whatever {p} did at that fête is between {p} and the jam.'],
      ['p', 'I WAS NOT AT THE FÊTE.'],
      ['d', 'That is not what the programme says.']
    ]),
    questions: [
      { ask: 'Ask {d} why it is banned from the fête.', clue: '{d} is banned from the fête for getting into the tombola. It needed another name to get back in.', lines: alt([
        ['d', 'Last year. The tombola. I would rather not go into it.'],
        ['judge', 'Go into it.'],
        ['d', 'That was the problem. I went into it. Somebody won me. They had wanted the bath salts.']], [
        ['d', 'The tombola, Your Honour. I got into it, and went round twice.'],
        ['d', 'They banned me for life. There is a photograph of me on the gate, next to the wasp.'],
        ['judge', 'So you needed somebody else’s name to get back in.'],
        ['d', 'The wasp just wears a hat.']]) },
      { ask: 'Have the bailiff read out the jam results.', happen: 'heckle', lines: alt([
        ['bailiff', 'Jam competition, Your Honour. Third place: “{p}, in a jar, in some jam.”'],
        ['judge', 'How many entries were there?'],
        ['bailiff', 'Three, Your Honour. The other two were just jam.']], [
        ['bailiff', 'Jam competition, Your Honour. Third place, entered under the name {p}.'],
        ['judge', 'Any comments from the jam judge?'],
        ['bailiff', '“Good set. Lovely colour. Blinked.”']]) },
      { ask: 'Call the judge of the jam.', clue: 'The Raven heard the jam entrant climb out of the jar and say, “Nobody tell {p}.”', lines: alt([
        ['npc', 'I judged the jam. Three jars. I did not know there was anybody in the third one until it waved.', 'raven'],
        ['judge', 'Did the entrant say anything?'],
        ['npc', 'It climbed out, looked round, and said, “Nobody tell {p}.” Then it went squelch.', 'raven']], [
        ['npc', 'I judged the jam, Your Honour. I lifted the lid of the third jar, and something climbed out.', 'raven'],
        ['judge', 'Did it say anything?'],
        ['npc', 'It said, “Nobody tell {p}.” Then it wiped its eyes and asked if it had placed.', 'raven']]) },
      { ask: 'Have the bailiff look in {d}’s ears.', clue: 'Four days after the fête, there is still raspberry jam in {d}’s ears.', lines: alt([
        ['narrator', '(The bailiff puts a finger in {d}’s ear. He takes it out. He looks at it. He licks it.)'],
        ['bailiff', 'Raspberry, Your Honour.'],
        ['judge', 'That was evidence, Bailiff.'],
        ['bailiff', 'It was, Your Honour. There is more in the other ear.']], [
        ['narrator', '(The bailiff shines a torch into {d}’s ear and leans in.)'],
        ['bailiff', 'Raspberry jam, Your Honour. Four days after the fête. Still setting.'],
        ['d', 'That is wax, Your Honour. It runs in the family.'],
        ['judge', 'With pips in?'],
        ['d', 'We are a very fruity family.']]) },
      { ask: 'Tell {p} the nickname suits it.', sass: true, lines: alt([
        ['judge', '{p}. You are four inches tall. You are faintly damp. When you sat down just now, you made a noise.'],
        ['p', 'What noise?'],
        ['narrator', '(The whole courtroom does the noise.)']], [
        ['p', 'Your Honour, I am not a Squelch.'],
        ['judge', '{p}, nicknames stick because they fit. At school they called me Bones. I was eleven. They were just early.']]) },
      { ask: 'Ask {d} where the rosette for third place is.', happen: 'outburst', party: 'p', lines: alt([
        ['d', 'It was won by {p}, Your Honour. It has {p}’s name on it. If {p} has lost it, I cannot help that.'],
        ['d', 'Typical Squelch.']], [
        ['d', 'On {p}’s slot, Your Honour, pinned up where everybody can see it. It is {p}’s rosette, after all.'],
        ['p', 'PEOPLE HAVE BEEN DOING THE NOISE AT IT.']]) }
    ],
    rulings: {
      plaintiff: alt([
        ['judge', 'Judgment for {p}. You borrow a name, you bring it back as you found it. Not sticky. Not third.'],
        ['judge', '{d} will stand on the top shelf every morning this week and tell everybody exactly who went squelch.'],
        ['d', 'Then they will call ME Squelch.'],
        ['judge', 'Yes.']], [
        ['judge', 'Judgment for {p}. {d} took a borrowed name to a fête, sat it in a jar of jam, and handed it back with a wipe.'],
        ['judge', 'The nickname goes to its rightful owner. {d}, you are Squelch now.'],
        ['narrator', '(As {d} leaves, the bailiff does the noise. He does not mean to. It just comes out.)']]),
      defendant: alt([
        ['judge', 'Judgment for {d}. The records are clear. {p} went to the fête, {p} got into the jam, and {p} came third.'],
        ['p', 'I have never been in a jam in my LIFE.'],
        ['judge', 'You are in one now.']], [
        ['judge', 'Judgment for {d}. {p} lent the name. What the name did next is the name’s business.'],
        ['judge', 'Case closed. Mind how you sit down, Squelch.']]),
      both: alt([
        ['judge', 'You are both to blame. {p}, you do not lend your name to a known tombola risk. {d}, you do not take a borrowed name into jam.'],
        ['judge', 'You will share the nickname. {p} is Squelch on weekdays. {d} is Squelch at weekends.'],
        ['narrator', '(From the gallery, very quietly, somebody does the noise twice.)']], [
        ['judge', 'You are both idiots. One of you lent its name to a creature banned from a tombola. The other one wore it into a jar.'],
        ['judge', 'Neither of you may use a name for a month. You will be known as “the plaintiff” and “that one”.'],
        ['d', 'Which one am I?'],
        ['judge', 'You know which one you are.']])
    },
    hallway: {
      p: ['I’ve changed my name. I’m not telling anyone what to. They still do the noise.',
        'I’m entering next year’s jam. As me. I’ll win it. Then we’ll see who’s Squelch.',
        'I’ve started sitting down very slowly. It helps. It doesn’t help.'],
      d: ['Third place. Out of three. In somebody else’s name. I have never been prouder.',
        'I’ve already borrowed a name for the harvest supper. I won’t say whose. They’ll find out at the trifle.',
        'Squelch is a lovely name. Nobody had noticed {p} since 1846. You’re welcome.']
    }
  },
  {
    id: 'runaway-rock', title: 'The Runaway Rock', truth: 'plaintiff',
    claim: '{p} is suing {d} for luring away Colin, {p}’s pet rock, who had not moved since 1931 and left on Friday.',
    asking: 'Colin home by Sunday, and {d} kept a full ruler’s length away from him',
    plaintiff: alt([
      ['p', 'Colin has been with me since 1931, Your Honour. He is a rock. He is a very good rock. He has never once gone anywhere.'],
      ['p', 'On Friday morning Colin was at {d}’s end of the shelf. Sitting with {d}. Like they were friends.'],
      ['judge', 'How far is {d}’s end?'],
      ['p', 'Nine inches, Your Honour. Colin has never done nine inches. Colin has never done one.']
    ], [
      ['p', 'Colin is a rock, Your Honour. Grey. About the size of my head. I walk him every morning.'],
      ['judge', 'How do you walk a rock?'],
      ['p', 'I stand next to him, and then I stand a bit further along. It is mostly me.'],
      ['p', 'On Friday he turned up at {d}’s. Nine inches away. Without me. He has never gone anywhere without me. He has never gone anywhere.']
    ]),
    defendant: alt([
      ['d', 'I did not take Colin, Your Honour. Colin came to me. I woke up on Friday and he was at the foot of my slot, looking up at me.'],
      ['judge', 'He is a rock. How could you tell he was looking?'],
      ['d', 'It is all in the stillness.']
    ], [
      ['d', 'Colin was unhappy, Your Honour. He had sat in the same spot since 1931. There is a dent.'],
      ['d', 'With me he has a view. On Sundays I turn him over so he can see the ceiling.'],
      ['p', 'He does not LIKE the ceiling.']
    ]),
    questions: [
      { ask: 'Have the bailiff roll a marble along the shelf.', clue: 'The shelf has sloped towards {d} since Thursday night. Before that it was dead level.', lines: alt([
        ['narrator', '(The bailiff sets a marble down outside {p}’s slot. It rolls, quite briskly, the whole way to {d}, and stops against {d}’s foot.)'],
        ['judge', 'The shelf slopes.'],
        ['bailiff', 'Only since Thursday night, Your Honour. Before that you could have played snooker on it. I did.']], [
        ['narrator', '(The bailiff sets a marble down at {p}’s end. It sets off towards {d} at once, like it has somewhere to be.)'],
        ['bailiff', 'Downhill all the way, Your Honour. Since Thursday night. Before that, dead level.'],
        ['judge', 'How can you be sure?'],
        ['bailiff', 'I sleep on it, Your Honour. On Thursday night I woke up at {d}’s end.']]) },
      { ask: 'Have the bailiff look under {p}’s end of the shelf.', clue: 'A pub beer mat, folded very tight, is propping up {p}’s end of the shelf. {d} is the only resident who has been to a pub.', happen: 'throw', lines: alt([
        ['narrator', '(The bailiff crawls under {p}’s end of the shelf and comes out with a beer mat, folded eight times, very hard.)'],
        ['bailiff', 'From the Fox and Hounds, Your Honour. Only one resident on this shelf has ever been to the Fox and Hounds.'],
        ['d', 'Once. In a coat pocket. I did not even have a drink. I only came back with a beer mat.']], [
        ['bailiff', 'A beer mat, Your Honour, from a pub. Folded until it is harder than the shelf. It is holding up {p}’s end.'],
        ['judge', 'Has anybody on this shelf ever been to a pub?'],
        ['narrator', '(Everybody turns and looks at {d}.)'],
        ['d', 'It was ONE pub.']]) },
      { ask: 'Call a witness who was up in the night.', clue: 'Geoffrey saw Colin roll past at three on Friday morning, with {d} walking beside him saying “good boy”.', lines: alt([
        ['npc', 'I saw Colin go past at three on Friday morning, Your Honour. At a steady walking pace, for a rock.', 'woodlouse'],
        ['judge', 'Was he alone?'],
        ['npc', '{d} was walking beside him, saying “good boy”. Every inch.', 'woodlouse']], [
        ['npc', 'Three on Friday morning, Your Honour. I was up with my back. Colin came rolling past my door.', 'woodlouse'],
        ['judge', 'On his own?'],
        ['npc', '{d} was walking next to him, saying “good boy”. I did not like to interrupt. It looked like a first date.', 'woodlouse']]) },
      { ask: 'Remind {p} that Colin is a rock.', sass: true, lines: alt([
        ['judge', '{p}. Colin is a rock. I say this as a man who is mostly calcium. He does not love you. He does not love anything. He is a rock.'],
        ['p', 'He loves me in his own way.'],
        ['judge', 'Which way is that?'],
        ['p', 'Staying.']], [
        ['p', 'Colin and I have something special, Your Honour.'],
        ['judge', '{p}, Colin is a rock. If you want something that will never move, never speak and never love you back, I can lend you the jury.']]) },
      { ask: 'Have the bailiff weigh Colin.', lines: alt([
        ['bailiff', 'Colin has put on a gram since Friday, Your Honour.'],
        ['judge', 'A rock cannot put on weight.'],
        ['bailiff', 'Moss, Your Honour. {d}’s end is damp. He is growing a little coat.'],
        ['d', 'He is thriving.']], [
        ['bailiff', 'Colin is up a gram since Friday, Your Honour. It is moss. He is going green round the edges.'],
        ['p', 'He never had moss when he lived with me.'],
        ['d', 'You kept him too dry, {p}. He told me.']]) },
      { ask: 'Ask {d} what it and Colin do all day.', happen: 'outburst', party: 'p', lines: alt([
        ['d', 'We sit. We watch the door. In the evenings I read to him.'],
        ['judge', 'What do you read him?'],
        ['d', 'Geology, Your Honour. He likes to hear about his family.']], [
        ['d', 'We have a routine, Your Honour. A sit in the morning. A longer sit after lunch. At night he sleeps on my chest. I can barely breathe. It is worth it.'],
        ['p', 'HE WOULD NEVER. HE IS NOT THAT KIND OF ROCK.']]) }
    ],
    rulings: {
      plaintiff: alt([
        ['judge', 'Judgment for {p}. Rocks do not choose, {d}. Rocks go downhill. It is the only thing rocks know, and you built one a hill.'],
        ['judge', '{d} will carry Colin home tonight. Nine inches. Uphill.'],
        ['d', 'He is heavier now. He has moss.'],
        ['judge', 'Lift with your knees.']], [
        ['judge', 'Judgment for {p}. {d} propped up a shelf with a pub beer mat and walked a rock downhill saying “good boy”. That is not love. That is a gradient.'],
        ['narrator', '(The bailiff moves the beer mat to {d}’s end. Colin rolls, slowly, all the way home. {p} weeps. Colin does not. Colin is a rock.)']]),
      defendant: alt([
        ['judge', 'Judgment for {d}. Colin has moss for the first time in his life. This court will not part a rock from its moss.'],
        ['p', 'He is MY rock.'],
        ['judge', 'He was your rock, {p}. Now he has moss and a view. They grow up so fast.']], [
        ['judge', 'Judgment for {d}. Colin went where Colin went. This court will not stand between a rock and a hill.'],
        ['narrator', '({p} waits outside {d}’s slot all evening, holding a lead. Colin does not come to the door. Colin has never come to anything.)']]),
      both: alt([
        ['judge', 'You are both unwell. One of you walks a rock. The other one kidnapped the rock and reads it geology.'],
        ['judge', 'Colin will live exactly halfway, at four and a half inches, and nobody touches the shelf.'],
        ['narrator', '(By morning there are beer mats under both ends. The shelf is perfectly level, and an inch higher.)']], [
        ['judge', 'You are both fools. Colin goes to the rockery, with other rocks, where nobody walks him and nobody reads to him.'],
        ['narrator', '(Colin is put in the rockery. He fits in at once. By teatime neither of them can tell which one he is.)']])
    },
    hallway: {
      p: ['I’ve got a new rock. He’s called Colin as well. It’s not the same. He moves even less.',
        'I walk past {d}’s end every morning. Colin never looks up. Colin never looked up. It still hurts.',
        'I’ve put two beer mats under {d}’s end. Let’s see how Colin likes a hill now.'],
      d: ['He’ll roll back. They always roll back. I know which end to lift.',
        'I’ve told Colin it isn’t his fault. He took it like a rock.',
        'I’m keeping the moss. Nobody said anything about the moss.']
    }
  },
  {
    id: 'ghost-writer', title: 'The Ghost-Writer', truth: 'defendant',
    claim: '{p} is suing {d} for publishing {p}’s memoirs, word for word, with {d}’s name on the front.',
    asking: 'Its name on the cover, and all the royalties, which come to two souls',
    plaintiff: alt([
      ['p', 'My memoirs, Your Honour. STILL HERE, by {p}. I spent forty years dictating them to a ghost-writer.'],
      ['p', 'Now they are on sale by the till with {d}’s name on the front. And a photograph of {d}, looking thoughtful.'],
      ['judge', 'What was {d} thinking about?'],
      ['p', 'Nothing, Your Honour. It was just a heavy chin.']
    ], [
      ['p', 'Two hundred years of my life, Your Honour. I dictated every word to a ghost. A real one. I could check its spelling from the other side of it.'],
      ['p', 'Now it has {d}’s name on the front. Not one word inside has changed. Not even the dedication.'],
      ['judge', 'What is the dedication?'],
      ['p', '“To nobody. Nobody has earned it.”']
    ]),
    defendant: alt([
      ['d', 'I bought that book fair and square, Your Honour. Two souls and a candle. The ghost could not sell it fast enough.'],
      ['d', 'I only changed the name on the front. I did not need to change anything else. {p} and I have sat next to each other since 1840. Nothing has happened to either of us.']
    ], [
      ['d', 'The ghost sold me the book, Your Honour. I have a receipt. It is quite faint.'],
      ['d', 'And, frankly, it is my life too. Page four hundred: “A crumb falls between us. Neither of us moves.” I was there. I remember that crumb.']
    ]),
    questions: [
      { ask: 'Ask {p} what it paid the ghost-writer.', clue: '{p} paid the ghost-writer nothing for forty years. It offered him “exposure”.', lines: alt([
        ['p', 'Exposure, Your Honour. I told him it would be wonderful exposure.'],
        ['judge', '{p}. He is a ghost. He has spent two hundred years trying to be less exposed.']], [
        ['p', 'Nothing, Your Honour. Not in forty years. But I did offer him exposure.'],
        ['judge', 'Exposure to what?'],
        ['p', 'Me, Your Honour. Every day. Up close.']]) },
      { ask: 'Call the ghost-writer up from the audience.', clue: 'The unpaid ghost-writer sold the book to {d} for two souls and a candle. It has forty years of invoices.', lines: alt([
        ['narrator', '(A ghost in row three stands up. It is holding forty years of invoices, each marked FINAL DEMAND, in fainter and fainter ink.)'],
        ['judge', 'Why did you sell the book to {d}?'],
        ['narrator', '(The ghost: “It paid two souls and a candle. It lit the candle for me. Nobody has lit me a candle since 1790.”)']], [
        ['narrator', '(A ghost in row three drifts forward with a bundle of invoices. Forty years of them. The top one just says “PLEASE”.)'],
        ['judge', 'And you sold the book to {d}?'],
        ['narrator', '(The ghost: “For two souls and a candle. The first money I have made since I died. I have had one of the souls framed.”)']]) },
      { ask: 'Have {p} read the court the first chapter.', happen: 'sleep', lines: alt([
        ['p', '“Chapter One. 1840. I arrive on the shelf. It is a Wednesday.”'],
        ['p', '“Chapter Two. I am still on the shelf. It is a Thursday.”'],
        ['judge', 'How many chapters are there?'],
        ['p', 'Four hundred and eleven. It picks up in the three hundreds. I move slightly to the left.']], [
        ['p', '“Chapter One. It is 1840. I am on the shelf. To my left, {d}. To my right, a cotton reel.”'],
        ['p', '“The cotton reel does not move. Neither do I. Neither does {d}. This continues.”'],
        ['judge', 'For how long?'],
        ['p', 'Until chapter nine, Your Honour. Then there is a draught.']]) },
      { ask: 'Ask the bailiff how the book is selling.', lines: alt([
        ['bailiff', 'One copy, Your Honour. I bought it.'],
        ['judge', 'Did you enjoy it?'],
        ['bailiff', 'I ate chapter nine, Your Honour. It was very dry.']], [
        ['bailiff', 'One copy, Your Honour. I bought it.'],
        ['judge', 'Have you read it?'],
        ['bailiff', 'I have been on page two since March, Your Honour. I am waiting to see if {p} moves.']]) },
      { ask: 'Tell {p} its life is not worth stealing.', sass: true, happen: 'outburst', party: 'p', lines: alt([
        ['judge', '{p}. It is four hundred pages of you on a shelf. I have spent three hundred years in the ground and even I have had a flood.'],
        ['p', 'I had a crumb. In 1961.'],
        ['judge', 'Chapter two hundred and six. I skimmed it.']], [
        ['judge', 'Nobody steals a life like yours, {p}. They steal horses. They steal silver. Nobody in history has broken in and made off with a Tuesday.'],
        ['p', 'SOME OF MY TUESDAYS WERE VERY BUSY.']]) },
      { ask: 'Call the Ministry of Haunting.', clue: 'Unpaid ghost-writing goes back to the ghost after thirty years. {p} was sent eleven warnings and slept under them.', lines: alt([
        ['npc', 'Ministry of Haunting. The writer is registered with us. Prose division. Unpaid work goes back to the ghost after thirty years.', 'ghost'],
        ['judge', 'Was {p} warned?'],
        ['npc', 'Eleven letters. {p} used them as a blanket. It has been sleeping under a final demand since 1996.', 'ghost']], [
        ['npc', 'Ministry of Haunting. Rule fourteen. Unpaid ghost-writing goes back to the ghost after thirty years.', 'ghost'],
        ['judge', 'Did {p} know?'],
        ['npc', 'We sent eleven warnings, Your Honour. {p} slept under them. On cold nights it wrote in asking for a twelfth.', 'ghost']]) }
    ],
    rulings: {
      plaintiff: alt([
        ['judge', 'Judgment for {p}. It is your life, however little is in it, and nobody else should have to own it.'],
        ['d', 'I paid two souls and a candle.'],
        ['judge', 'Then keep the candle, and read the book by it. All of it. As punishment.']], [
        ['judge', 'Judgment for {p}. {p}’s name goes back on the cover, and {d} takes its own name home.'],
        ['narrator', '(The book is reissued. Nobody buys it again, but this time, it is {p} that nobody buys.)']]),
      defendant: alt([
        ['judge', 'Judgment for {d}. {p} paid a ghost in exposure for forty years. The ghost sold up, and {d} paid him in candle, which is more than {p} ever did.'],
        ['p', 'Can I at least write a sequel?'],
        ['judge', 'What happens in it?'],
        ['p', 'I am still here.']], [
        ['judge', 'Judgment for {d}. Unpaid words go back to the ghost, and a ghost may sell them to whoever lights him a candle. That is the law. It is also, I am sorry to say, quite moving.'],
        ['judge', '{p}, if you want your life back, write it again. It will not take long. Nothing has happened since.']]),
      both: alt([
        ['judge', 'You are both writers, which is the worst thing I can say about anybody.'],
        ['judge', 'The book belongs to the ghost. He is the only one of you who did any work.'],
        ['narrator', '(The ghost puts its own name on the cover. The book sells a second copy. The ghost bought it.)']], [
        ['judge', 'You are both guilty. One of you stiffed a ghost for forty years. The other bought somebody else’s life and put its own chin on the front.'],
        ['judge', 'You will read the whole book aloud to each other, a page each, in turn. It should take about as long as it took to live.']])
    },
    hallway: {
      p: ['I’ve hired a new ghost. I’m paying this one properly. In candles. Well. In the idea of candles.',
        'It was my life. {d} can have it. I was barely using it.',
        'I’m writing the sequel. STILL HERE, AGAIN. Chapter one is this hallway.'],
      d: ['I’ve read it four times. I come out of it very well. I’m in every chapter.',
        'Book signing, Saturday, at my slot. Nobody’s coming. It’s very true to the book.',
        'I’ve still got the candle. You never know when you’ll need a ghost.']
    }
  },
  {
    id: 'stolen-shadow', title: 'The Shadow', truth: 'defendant',
    claim: '{p} is suing {d} for stealing {p}’s shadow. {d} now has two, and one of them has {p}’s ears.',
    asking: 'Its shadow back, sewn on, double stitch',
    plaintiff: alt([
      ['p', 'On Saturday I stood in the light and nothing happened. No shadow. Just me, and the floor, looking at me.'],
      ['p', 'Then {d} walks past with two shadows. One of them has my ears.'],
      ['judge', 'You are sure they are your ears.'],
      ['p', 'I have been looking at those ears on the wall behind me for two hundred years, Your Honour. I would know them in the dark.']
    ], [
      ['p', 'I have had the same shadow since 1811, Your Honour. Quiet. Loyal. Always half a step behind, like staff.'],
      ['p', 'Now {d} goes about with two, like a footballer under floodlights.'],
      ['judge', 'Perhaps {d} has two lamps.'],
      ['p', '{d} has one lamp, Your Honour, and my shadow.']
    ]),
    defendant: alt([
      ['d', 'I did not take anything, Your Honour. It turned up behind me on Saturday and it will not go away. I have tried walking quickly.'],
      ['d', 'I do not even think it likes me. It just likes where I stand.']
    ], [
      ['d', 'A shadow follows you, Your Honour. That is the whole job. I cannot help who it follows.'],
      ['d', 'I sit in the light. {p} sits in a drawer with a thimble over its head. You do the sums.']
    ]),
    questions: [
      { ask: 'Ask {p} when it last stood in the light.', clue: '{p} had not stood in the light since Easter 1953, when somebody opened the curtains by mistake.', lines: alt([
        ['p', 'Recently.'],
        ['judge', 'How recently?'],
        ['p', 'Easter, 1953. Somebody opened the curtains by mistake.'],
        ['judge', 'And since then?'],
        ['p', 'I have been very careful.']], [
        ['p', 'By choice, Your Honour, or by accident?'],
        ['judge', 'At all.'],
        ['p', 'Easter, 1953. Somebody opened the curtains by mistake. I got behind the sugar bowl and stayed there until Whitsun.']]) },
      { ask: 'Call the Lamp.', clue: 'The Lamp saw {p}’s shadow leave {p}’s drawer on its own on Saturday night, and follow {d}.', lines: alt([
        ['npc', 'Saturday, about nine. It came out of {p}’s drawer on its own and stood in my light for an hour. Just stood there. Being a shadow.', 'lamp'],
        ['judge', 'And then?'],
        ['npc', '{d} walked past. It went with {d}. I would have too.', 'lamp']], [
        ['npc', 'Saturday night, Your Honour. The drawer opened from the inside, and out came {p}’s shadow, on its own. It stretched. You could hear it crack.', 'lamp'],
        ['judge', 'And then?'],
        ['npc', '{d} walked past, and it followed. It did not even say goodbye to the drawer.', 'lamp']]) },
      { ask: 'Have the bailiff stand {d} in the studio light.', clue: 'In the light, {p}’s shadow keeps its back to {p} and has its arm round {d}’s shadow.', happen: 'dark', lines: alt([
        ['narrator', '({d} stands in the light. It casts two shadows. The second one stands a little apart, with its back to {p}.)'],
        ['judge', 'Your shadow is facing the other way, {p}.'],
        ['p', 'It is shy.'],
        ['bailiff', 'It has just put its arm round {d}’s shadow, Your Honour.']], [
        ['narrator', '({d} stands in the studio light. Two shadows. The one with {p}’s ears keeps its back to {p} and puts an arm round the other one.)'],
        ['p', '(small) Hello. It is me.'],
        ['narrator', '(It does not turn round. The other shadow does, and gives {p} a look.)']]) },
      { ask: 'Ask {p} what it ever did with its shadow.', sass: true, lines: alt([
        ['judge', '{p}. You want this shadow back. Tell the court one thing you did with it in two hundred years.'],
        ['p', 'I kept it very safe.'],
        ['judge', 'You kept it in a drawer, under a thimble. That is not safe, {p}. That is filing.']], [
        ['judge', '{p}. A shadow is meant to follow you. You never go anywhere. It has spent two hundred years following you nowhere.'],
        ['p', 'It never complained.'],
        ['judge', 'It has no mouth, {p}. It complained with its feet.']]) },
      { ask: 'Have the bailiff pin the shadow down.', lines: alt([
        ['narrator', '(The bailiff creeps up on the second shadow with a drawing pin. The shadow steps aside. The bailiff pins his own tail to the floor.)'],
        ['bailiff', 'Nearly, Your Honour.']], [
        ['narrator', '(The bailiff dives on the second shadow and lies on it. When he looks up, it is lying on him.)'],
        ['bailiff', 'I have got it, Your Honour.'],
        ['judge', 'It has got you, Bailiff.']]) },
      { ask: 'Ask {d} whether it has tried to give the shadow back.', happen: 'outburst', party: 'p', lines: alt([
        ['d', 'Twice, Your Honour. I stood with my back to {p}’s drawer and waited for it to go in.'],
        ['judge', 'And?'],
        ['d', 'It went in, came out of the far side, walked round the long way, and got back behind me. It did not even look at {p}.']], [
        ['d', 'I tried, Your Honour. I climbed into {p}’s drawer and put the thimble over my head, so it would feel at home.'],
        ['judge', 'And?'],
        ['d', 'It stayed outside, with its arms folded.'],
        ['p', 'THAT IS MY THIMBLE.']]) }
    ],
    rulings: {
      plaintiff: alt([
        ['judge', 'Judgment for {p}. A shadow belongs to whoever casts it. Bailiff, sew it back on.'],
        ['narrator', '(The bailiff sews the shadow back onto {p}. It takes an hour. The stitches cast little shadows. They leave too.)']], [
        ['judge', 'Judgment for {p}. The shadow goes home tonight, back in the drawer, under the thimble, where {p} can keep an eye on it.'],
        ['narrator', '(That night, in the drawer, in the dark, something very quietly starts to dig.)']]),
      defendant: alt([
        ['judge', 'Judgment for {d}. A shadow is not stolen if it walks. {p} kept it under a thimble in a drawer since 1953, and the first time it saw a light, it took it.'],
        ['judge', '{p}, go and stand in a window. They grow back.'],
        ['p', 'Where is a window?'],
        ['judge', 'That, {p}, is the whole problem.']], [
        ['judge', 'Judgment for {d}. That shadow spent seventy years in a drawer and one evening in the light. I know which I would pick. I have tried both.'],
        ['narrator', '({d} leaves. Both shadows follow. One of them does a little skip.)']]),
      both: alt([
        ['judge', 'You are both wrong. One of you kept a shadow in a drawer for seventy years. The other walks round the shelf with two, like it is showing off.'],
        ['judge', 'The shadow spends weekdays with {p} and weekends with {d}, and whoever has it stands in the light.'],
        ['p', 'What if I want to go in the drawer?'],
        ['judge', 'Then you go alone.']], [
        ['judge', 'Neither of you owns that shadow. Shadows belong to the light.'],
        ['npc', 'They are all mine, technically.', 'lamp'],
        ['narrator', '(The two of them are made to stand in the lamplight together. Between them there are three shadows. Two of them are holding hands.)']])
    },
    hallway: {
      p: ['I’ve moved the drawer next to the window. The curtains are shut. But it’s a start.',
        'It’ll come crawling back. In the evening. They get very long in the evening.',
        'I don’t need a shadow. I’ve got a thimble. The thimble has never left me.'],
      d: ['It waved at me as it went. With both arms. It never did that for {p}.',
        'Just the one shadow again. Very quiet. Mine has never had much to say.',
        'I’ve started standing outside {p}’s drawer, in the light. In case it wants to visit. It knows where I stand.']
    }
  },
  {
    id: 'teacup-timeshare', title: 'The Timeshare', truth: 'both',
    claim: '{p} is suing {d} for selling it a timeshare in a teacup with a sea view. When {p} arrived for its week, somebody poured tea on it.',
    asking: 'Nine souls back, and damages for the steeping',
    plaintiff: alt([
      ['p', 'I bought one week a year in the teacup from {d}. Nine souls. The brochure said “sea view”.'],
      ['judge', 'And the view?'],
      ['p', 'The saucer, Your Honour.'],
      ['p', 'Then on my first day somebody poured tea on me. I was in for four minutes. I came out quite strong.']
    ], [
      ['p', 'Week thirty-two in the teacup, Your Honour. Sea view. I packed. I got in. I lay back. Then it went hot and dark, and somebody added milk.'],
      ['judge', 'You were steeped.'],
      ['p', 'Four minutes. I came out a lovely colour. On the way here, somebody tried to dunk a biscuit in me.']
    ]),
    defendant: alt([
      ['d', 'The brochure was very clear, Your Honour. Hot water on Sundays. It is under “amenities”.'],
      ['d', 'Most of my clients love it. They come out relaxed. One came out Earl Grey.']
    ], [
      ['d', 'A timeshare is a dream, Your Honour. One week a year, in a cup, with a handle, looking at a saucer.'],
      ['d', 'And {p} knew about the tea. Everybody knows about the tea. It is a teacup. The clue is in the teacup.']
    ]),
    questions: [
      { ask: 'Call the owner of the teacup.', clue: 'The teacup is Mrs Widow’s. She has tea in it every Sunday at four, and never sold anything to {d}.', happen: 'faint', lines: alt([
        ['npc', 'It is my teacup, dear. It was a wedding present. I have tea in it every Sunday at four.', 'widow'],
        ['judge', 'Did you know there was somebody in it?'],
        ['npc', 'Not until the second sip.', 'widow']], [
        ['npc', 'That is my teacup, dear. I have my tea in it every Sunday at four. I have never sold {d} so much as a saucer.', 'widow'],
        ['judge', 'And last Sunday?'],
        ['npc', 'Lovely cup, dear. A bit strong. It had a face.', 'widow']]) },
      { ask: 'Have the bailiff check who else bought week thirty-two.', clue: '{d} has sold the same week in the teacup eleven times over. It also sold August to the judge.', lines: alt([
        ['bailiff', 'Week thirty-two has been sold eleven times, Your Honour. All by {d}. And August has been sold to you.'],
        ['judge', 'To me.'],
        ['bailiff', 'The whole of it, Your Honour. You paid in advance.'],
        ['judge', '…Carry on.']], [
        ['bailiff', 'Week thirty-two, Your Honour. Eleven owners. All sold by {d}.'],
        ['bailiff', 'And the whole of August, sold to a Judge Mortis.'],
        ['judge', 'It is a very common name.']]) },
      { ask: 'Ask {p} when it filled in its damages form.', clue: '{p} filled in its damages form two days before it was steeped. It already said “four minutes” and “milk”.', lines: alt([
        ['p', 'Afterwards, Your Honour. While I was drying.'],
        ['bailiff', 'It is dated the Friday before, Your Honour. It already says “four minutes”. It already says “milk”.'],
        ['p', 'I had a feeling.']], [
        ['p', 'Straight after, Your Honour. Still dripping.'],
        ['judge', 'It is dated two days before the steeping, {p}. It already says “four minutes”. It already says “milk”.'],
        ['p', 'I know how I take it.']]) },
      { ask: 'Tell {p} it got exactly what it paid for.', sass: true, lines: alt([
        ['judge', '{p}. You paid nine souls to lie in a cup with a sea view, and somebody brought you hot water and milk.'],
        ['judge', 'In Skegness, that is a spa weekend.']], [
        ['judge', '{p}, you paid nine souls, went in pale and anxious, and came out warm, strong and a lovely colour.'],
        ['judge', 'I spent three hundred years in the ground and came out bleached.']]) },
      { ask: 'Ask {p} why it signed.', happen: 'outburst', party: 'd', lines: alt([
        ['p', 'There was a presentation. In the teapot. {d} said I was free to leave at any time.'],
        ['judge', 'Then why did you not leave?'],
        ['p', 'It was sitting on the lid.']], [
        ['p', 'There was a free gift for signing, Your Honour. A sugar lump.'],
        ['judge', 'Did you get it?'],
        ['p', 'No. {d} ate it while I was reading the small print.'],
        ['d', 'THAT WAS THE DEMONSTRATION LUMP.']]) },
      { ask: 'Ask {d} about the exchange scheme.', lines: alt([
        ['d', 'Very popular, Your Honour. You can swap your teacup week for four nights in the toast rack.'],
        ['judge', 'What is the toast rack like?'],
        ['d', 'You sleep standing up, between two slices. It is very continental.']], [
        ['d', 'Very flexible, Your Honour. Swap your week in the teacup for a fortnight in the sugar bowl.'],
        ['judge', 'Is there a catch?'],
        ['d', 'Only the spoon, Your Honour. It comes round at four.']]) }
    ],
    rulings: {
      plaintiff: alt([
        ['judge', 'Judgment for {p}. {d} sold one teacup to eleven residents and a judge. Full refunds, starting with mine.'],
        ['d', 'What about your August?'],
        ['judge', 'I am keeping August.']], [
        ['judge', 'Judgment for {p}. Nobody should pay nine souls to be made into a drink.'],
        ['narrator', '({p} leaves the court, still faintly brown. Two ghosts in the front row try to dunk a biscuit in it.)']]),
      defendant: alt([
        ['judge', 'Judgment for {d}. You climbed into a teacup at four on a Sunday, {p}, and came out as tea. That is not fraud. That is brewing.'],
        ['p', 'I want a second opinion.'],
        ['judge', 'Ask Mrs Widow. She has had a taste.']], [
        ['judge', 'Judgment for {d}. Every timeshare has a catch. This one had a kettle.'],
        ['narrator', '({p} is shown out. It leaves a faint brown ring on the podium.)']]),
      both: alt([
        ['judge', 'You are both crooks. {d} sold a teacup it does not own, eleven times. {p} climbed into it at four on a Sunday with its damages form already filled in.'],
        ['judge', 'No refunds. No damages. The teacup goes back to Mrs Widow, who may put in it whatever she likes.'],
        ['npc', 'I thought {d}, next Sunday. {p} was a bit strong.', 'widow']], [
        ['judge', 'You deserve each other. One of you sells cups it does not own. The other gets steeped on purpose and sends an invoice.'],
        ['judge', 'You will both spend week thirty-two in the teacup, together, on a Sunday, at four.'],
        ['judge', 'I shall be in it for August. I have paid.']])
    },
    hallway: {
      p: ['I’ve bought another week off {d}. In the gravy boat. {d} says there has never been gravy in it.',
        'I’m still a bit brown. I’m telling people it’s a tan. From the sea.',
        'I’d go back. The four minutes were lovely. It was the sip I minded.'],
      d: ['Eleven furious clients and a judge in August. Business has never been better.',
        'Mrs Widow can have the teacup. I’ve kept the saucer. I’m selling it as a sea view.',
        'I’m moving into teapots. Longer stays. Lid included.']
    }
  },
  {
    id: 'radiator-raffle', title: 'The Radiator Raffle', truth: 'both',
    claim: '{p} is suing {d} for rigging the shelf raffle. First prize was the slot next to the radiator. {d} ran the raffle, and {d} won it.',
    asking: 'The slot next to the radiator, and a recount',
    plaintiff: alt([
      ['p', 'I bought ninety-nine tickets, Your Honour. {d} bought one. {d} drew the winner, and it was {d}.'],
      ['judge', 'That is how raffles work, {p}. That is the terrible beauty of a raffle.'],
      ['p', 'I did not buy ninety-nine tickets for beauty, Your Honour.']
    ], [
      ['p', 'The slot next to the radiator, Your Honour. Warm from six until seven every night. I have wanted it since 1890.'],
      ['p', 'A hundred tickets. I bought ninety-nine. {d} bought one, drew one, and moved in the same evening.'],
      ['judge', 'That was quick.'],
      ['p', 'Its things were already there, Your Honour. Warming up.']
    ]),
    defendant: alt([
      ['d', 'I drew the winner with my eyes shut, Your Honour. It was mine. I was so surprised I had to sit down. Next to the radiator.'],
      ['d', 'And I would look at whoever bought ninety-nine tickets before I looked at whoever bought one.']
    ], [
      ['d', 'Lucky ticket, Your Honour. I have had it since 1897. It has never won anything. It was due.'],
      ['d', 'The rules said one ticket each. I am not saying anything. I am only saying I have never met a Mr Radiator.']
    ]),
    questions: [
      { ask: 'Ask to see the winning ticket.', clue: '{d}’s winning ticket is folded into a hard little triangle. The rest are flat. It can be found blind, every time.', happen: 'applause', lines: alt([
        ['bailiff', 'The winning ticket, Your Honour. Folded into a triangle. Very small. Very hard. Every other ticket in the hat is flat.'],
        ['d', 'I fold for luck.'],
        ['bailiff', 'I put it back in and drew it out with my eyes shut, Your Honour. Four times out of four.']], [
        ['bailiff', 'The winning ticket, Your Honour. Folded into a little triangle, as hard as a knuckle. Every other ticket in the hat is flat.'],
        ['narrator', '(The judge drops it back in, stirs the hat, and reaches in with no eyes, which is how he does everything. Out comes the triangle. Three times running.)'],
        ['d', 'The court is having a very lucky day.']]) },
      { ask: 'Ask {p} what names it bought its tickets under.', clue: 'The limit was one ticket each. {p} bought ninety-nine under false names, including “Mr Radiator” and “Not {p}”.', lines: alt([
        ['p', 'Various, Your Honour.'],
        ['judge', 'Read me some.'],
        ['p', '“{p}.” “{p}, Junior.” “Mr Radiator.” “Not {p}.” And one that is just a drawing of a hat.']], [
        ['judge', 'The rules said one ticket each, {p}.'],
        ['p', 'And I only bought one each, Your Honour. There were just ninety-nine of me.'],
        ['bailiff', 'The stubs include a “Mr Radiator”, Your Honour, and a “Not {p}”.'],
        ['p', 'Mr Radiator is a very private man.']]) },
      { ask: 'Call the radiator.', lines: alt([
        ['narrator', '(The radiator is called. It clanks twice. It is six o’clock.)'],
        ['narrator', '(The whole court, jury, audience and judge, shuffles four inches towards it. Nobody says anything. Nobody has to.)'],
        ['judge', 'We will resume at seven.']], [
        ['judge', 'Radiator. Did anybody tamper with the raffle?'],
        ['narrator', '(The radiator clanks three times, gurgles, and goes quiet.)'],
        ['bailiff', 'I think that was a yes, Your Honour. Or it wants bleeding.']]) },
      { ask: 'Tell {p} what else ninety-nine souls could have bought.', sass: true, lines: alt([
        ['judge', '{p}. The tickets were a soul each. You spent ninety-nine souls on one warm hour a day. For ninety-nine souls, you could have bought the radiator.'],
        ['p', 'The radiator is not for sale.'],
        ['judge', 'Neither, it turns out, was the raffle.']], [
        ['p', 'I only wanted to be warm, Your Honour.'],
        ['judge', 'For ninety-nine souls, {p}, you could have been cremated. Twice. Nobody on this shelf has ever been that warm.']]) },
      { ask: 'Ask {d} how it is finding the new slot.', happen: 'outburst', party: 'p', lines: alt([
        ['d', 'Wonderful, Your Honour. From six until seven I am the warmest thing on the shelf.'],
        ['judge', 'And from seven until six?'],
        ['d', 'I tell {p} about it.']], [
        ['d', 'Lovely, Your Honour. At six the pipes start ticking. By ten past, my feet have gone pink. People have started saying I have a glow.'],
        ['p', 'NOBODY HAS SAID YOU HAVE A GLOW.']]) },
      { ask: 'Ask the bailiff whether anybody approached him about the draw.', clue: 'Both of them bribed the bailiff over the draw. {p} offered four raisins. {d} offered six.', lines: alt([
        ['bailiff', '{p} offered me four raisins to draw the raffle for it, Your Honour. {d} offered me six to let it draw its own.'],
        ['judge', 'And what did you do?'],
        ['bailiff', 'I am a man of principle, Your Honour. Six is more than four.']], [
        ['bailiff', 'Approached, Your Honour? No. {p} left four raisins on my chair the night before the draw. {d} left six in my cap.'],
        ['judge', 'And did you declare them?'],
        ['bailiff', 'Your Honour, I declared them delicious.']]) }
    ],
    rulings: {
      plaintiff: alt([
        ['judge', 'Judgment for {p}. A triangle in a hat full of flat tickets is not luck, {d}. It is geometry.'],
        ['judge', '{p} gets the slot next to the radiator.'],
        ['d', 'What about Mr Radiator?'],
        ['judge', 'Mr Radiator may visit.']], [
        ['judge', 'Judgment for {p}. Ninety-nine tickets out of a hundred is not a raffle. It is a purchase, and this court upholds it.'],
        ['narrator', '({p} moves in at six. At seven the radiator goes cold. {p} stays put until morning, out of principle, and comes out slightly blue.)']]),
      defendant: alt([
        ['judge', 'Judgment for {d}. The rule was one ticket each. {p} bought ninety-nine, one of them as a hat. The hat is disqualified, and so are you.'],
        ['p', 'And the triangle?'],
        ['judge', 'The triangle bought one ticket. That is all this court is prepared to know.']], [
        ['judge', 'Judgment for {d}. One ticket won, and it was {d}’s. I see no reason to look at its shape.'],
        ['narrator', '(From six until seven, {d} is very warm. From seven until six, it tells {p} about it.)']]),
      both: alt([
        ['judge', 'You are both cheats. {p} bought ninety-nine tickets as Mr Radiator and a hat. {d} folded its own ticket into a triangle and drew it blind.'],
        ['judge', 'The slot will be shared. {p} from six until half past. {d} from half past until seven.'],
        ['narrator', '(At half past six, neither of them moves. At seven, neither of them moves. At eight it is cold, and neither of them moves.)']], [
        ['judge', 'You have rigged the same raffle from both ends. I admire the effort. I will not reward it.'],
        ['judge', 'The raffle will be drawn again. One ticket each. Flat. The bailiff will hold the hat.'],
        ['bailiff', 'Very good, Your Honour. Prices on request.']])
    },
    hallway: {
      p: ['Mr Radiator is appealing. He has a very strong case. He has my handwriting.',
        'Next year I’m buying all hundred tickets. Let’s see {d} fold its way out of that.',
        'I don’t even like being warm. I just don’t like {d} being warm.'],
      d: ['I’ve kept the ticket. I sleep on it. It’s very uncomfortable. It’s a triangle.',
        'I paid that bailiff good money. I’m reporting him. To the bailiff.',
        'My things had been in that slot since Wednesday. They were only just getting warm.']
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

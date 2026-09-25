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
    claim: '{p} is suing {d} for one coffin, lent for “a nap”, returned occupied.',
    asking: '40 souls, and the name of whoever is in it',
    plaintiff: [
      ['p', 'I lent {d} my coffin for one nap. One. It came back with someone in it.'],
      ['p', 'He is called Keith. I have not met Keith. Keith has not introduced himself. Keith is very still.'],
      ['judge', 'And you want?'],
      ['p', 'My coffin, Keith-free. And forty souls for the emotional damage of Keith.']
    ],
    defendant: [
      ['d', 'Your Honour, it was a nap. A long nap. For Keith.'],
      ['d', 'Keith needed it more than I did. Keith was having a very bad day. His last one.'],
      ['judge', 'So you lent out a coffin that was not yours. To a Keith.'],
      ['d', 'When you say it like that it sounds bad. When I say it like that it sounds generous.']
    ],
    questions: [
      { ask: 'Ask {d} where Keith came from.', clue: '{d} moved a stranger called Keith from the garden into {p}’s coffin without asking.', lines: [
        ['d', 'The garden. Keith was in the garden. Keith was not using the garden.'],
        ['judge', 'Keith was dead in the garden.'],
        ['d', 'Keith was resting in the garden. Now Keith is resting indoors. That is called hospitality.']] },
      { ask: 'Ask {p} to prove the coffin is theirs.', clue: 'The coffin has {p}’s name in the lid, {p}’s teeth marks and a little raisin shelf. It is definitely theirs.', lines: [
        ['p', 'It has my name carved in the lid. And my teeth marks. And a little shelf where I keep a raisin.'],
        ['bailiff', 'I can confirm the raisin, Your Honour.'],
        ['judge', 'Bailiff. Did you eat the raisin?'],
        ['bailiff', 'I can confirm there was a raisin.']] },
      { ask: 'Tell {d} that “a nap” is not a legal term.', sass: true, lines: [
        ['judge', '{d}. “Nap” is not a legal term. Neither is “basically a friend”, or “he looked cold”. Nothing you are about to say is a legal term.'],
        ['d', 'Is “oops” a legal term?'],
        ['judge', '“Oops” is a confession.'],
        ['audience', '(The audience goes “OOOOOOH”.)']] },
      { ask: 'Ask {d} if Keith has any family.', clue: 'There is now a second Keith. He is in the drawer.', happen: 'outburst', party: 'p', lines: [
        ['d', 'Keith has a cousin. Also called Keith. He came round looking for Keith and I panicked and put him in the drawer.'],
        ['judge', 'There are TWO Keiths?'],
        ['d', 'There are currently two Keiths, yes. It has been a very Keith-heavy week.']] },
      { ask: 'Ask {p} where they slept during the nap.', lines: [
        ['p', 'On the bare shelf. Like an animal. No lid. The moth watched me all night.'],
        ['judge', 'That sounds awful.'],
        ['p', 'The moth said it was the best night of its life.']] },
      { ask: 'Offer {p} the chance to get in the coffin right now.', sass: true, lines: [
        ['judge', '{p}, would you like to get in, right now, and show this court how a coffin is supposed to be used?'],
        ['p', 'With Keith in it?'],
        ['judge', 'I am not a miracle worker. I am a judge.']] }
    ],
    rulings: {
      plaintiff: [
        ['judge', 'Judgment for {p}. You do not lend out what is not yours, and you certainly do not fill it with Keiths.'],
        ['judge', '{d} pays forty souls, returns the coffin, and personally explains to both Keiths why they have to leave.'],
        ['d', 'Where do the Keiths go?'],
        ['judge', 'Not my problem. I have enough dead people in my life. I am one.']],
      defendant: [
        ['judge', 'Judgment for {d}. Keith needed it more.'],
        ['p', 'KEITH ISN’T EVEN HERE.'],
        ['judge', 'Keith is in your coffin. Keith is exactly where Keith should be.'],
        ['audience', '(Somebody at the back whispers “justice for Keith”.)']],
      both: [
        ['judge', 'You are both ridiculous. {p}, never lend a coffin to anyone who says “nap” with that face. {d}, stop collecting Keiths.'],
        ['judge', 'The coffin goes to Keith. Case dismissed.'],
        ['p', 'KEITH gets the coffin?'],
        ['judge', 'Keith is the only one in this room who has not lied to me.']]
    },
    hallway: { p: 'I’m going to move in with Keith. Out of spite. We’ll see who gets the lid.', d: 'I stand by it. Keith and I are very happy. Keith hasn’t said so, but Keith hasn’t said anything.' }
  },
  {
    id: 'snoring-wall', title: 'The Snoring', truth: 'defendant',
    claim: '{p} is suing {d} for snoring so loudly the paint came off the wall.',
    asking: 'A new wall, and ninety years of lost sleep',
    plaintiff: [
      ['p', 'Every night {d} snores. It sounds like a drain being strangled. It sounds like a church organ with a cold.'],
      ['p', 'The paint has come off the wall. The wall is just brick now. The brick looks tired.'],
      ['judge', 'Ninety years of lost sleep. How old are you?'],
      ['p', 'I am rounding up for the emotional years.']
    ],
    defendant: [
      ['d', 'I do not snore. I sleep like the dead. On my back. Hands crossed. Silent. Respectful.'],
      ['d', 'I hear the snoring too. I assumed it was {p}. It sounds like someone who eats in bed.']
    ],
    questions: [
      { ask: 'Ask {p} if it snored while {d} was away at the vet.', clue: 'The snoring was worse on the night {d} was away at the vet.', lines: [
        ['p', 'Well. Yes. Last Tuesday {d} was at the vet all night. And the snoring was worse.'],
        ['judge', 'So the snoring was louder when {d} was not in the building.'],
        ['p', 'I assumed {d} was snoring from the vet. Out of spite.']] },
      { ask: 'Have the bailiff put an ear to the wall.', clue: 'The wall snores. The Ministry of Haunting has it registered to a dead snorer.', lines: [
        ['narrator', '(The bailiff presses his ear to the wall. The wall snores.)'],
        ['bailiff', 'Your Honour, the wall is snoring.'],
        ['judge', 'Walls do not snore, Bailiff.'],
        ['bailiff', 'This one just said “five more minutes”.'],
        ['npc', 'MINISTRY OF HAUNTING. Nobody touch that wall. It is registered to a Mr Pemberton, deceased, snorer, since 1840.', 'ghost']] },
      { ask: 'Ask {p} if they have tried being asleep.', sass: true, lines: [
        ['judge', '{p}, have you tried being asleep? It is very quiet in there.'],
        ['p', 'I CAN’T sleep. Because of the SNORING.'],
        ['judge', 'Then have you tried being dead? I did. Slept like a baby. A very old, very dead baby.']] },
      { ask: 'Ask {d} to demonstrate how they sleep.', clue: '{d} sleeps in total, eerie silence. It was upsetting to watch.', happen: 'outburst', party: 'p', lines: [
        ['narrator', '({d} lies down on the podium, crosses its hands and becomes instantly, horribly still.)'],
        ['judge', 'Not a sound.'],
        ['p', 'THAT’S WHAT IT WANTS YOU TO THINK.']] },
      { ask: 'Ask {p} to do the snore for the court.', lines: [
        ['p', 'It goes HNNNNRK. Shhhhwww. HNNNRK. And then sometimes “Margaret”.'],
        ['judge', 'Who is Margaret?'],
        ['p', 'I DON’T KNOW. NOBODY HERE KNOWS A MARGARET.']] },
      { ask: 'Tell {d} the court can smell the guilt.', sass: true, lines: [
        ['judge', '{d}, I can smell guilt. It smells like wet biscuit.'],
        ['d', 'That is the wall, Your Honour.'],
        ['judge', '…Noted.']] }
    ],
    rulings: {
      plaintiff: [
        ['judge', 'Judgment for {p}. {d} sleeps in the drawer until the snoring stops.'],
        ['narrator', '(That night {d} sleeps in the drawer. The wall snores louder than ever. It calls for Margaret.)'],
        ['p', 'I would like to reopen the case.'],
        ['judge', 'Denied. I am asleep.']],
      defendant: [
        ['judge', 'Judgment for {d}. The wall is snoring. The wall is dead. {p} has spent a month blaming the only quiet thing on the shelf.'],
        ['judge', '{p} owes {d} an apology and a nice pillow. The wall owes everybody an explanation, and a Margaret.'],
        ['audience', '(The wall snores, gently, in agreement.)']],
      both: [
        ['judge', 'You are both wrong about everything. You are sleeping next to a dead man in a wall and blaming each other.'],
        ['judge', 'Buy earplugs. Buy the wall a Margaret. Get out of my court.']]
    },
    hallway: { p: 'I still think it’s {d}. The wall is covering for it. They’re close.', d: 'Convicted of snoring by a court that listens to walls. I’m going to lie down. Silently. In protest.' }
  },
  {
    id: 'stolen-slot', title: 'The Warm Slot', truth: 'both',
    claim: '{p} is suing {d} for taking their slot on the shelf while {p} was out being ill in a bucket.',
    asking: 'The slot back, and an admission that it smells of them',
    plaintiff: [
      ['p', 'I was ill for ONE afternoon. I come back and {d} is in my slot. Lying in my shape. In my smell.'],
      ['p', 'It was still warm from me. {d} was using my warmth.'],
      ['judge', 'How ill?'],
      ['p', 'Bucket ill, Your Honour.']
    ],
    defendant: [
      ['d', 'An empty slot is like an empty chair at a funeral. You fill it, or people talk.'],
      ['d', 'Also I heard {p} had died. I was keeping it warm for the next of kin. That is manners.']
    ],
    questions: [
      { ask: 'Ask {d} who told them {p} had died.', clue: '{d} saw a bucket and assumed {p} was dead. Nobody said so.', lines: [
        ['d', 'Nobody told me. I saw the bucket and assumed.'],
        ['judge', 'You saw a bucket and declared a death.'],
        ['d', 'It was a very serious-looking bucket.']] },
      { ask: 'Ask {p} whose slot it was in the first place.', clue: '{p} originally took that slot from {d}, the same way, while {d} was ill in a bucket.', lines: [
        ['p', 'Mine. Since the beginning.'],
        ['bailiff', 'Your Honour, shelf records show {p} took that slot from {d} in the spring. While {d} was out being ill. In a bucket.'],
        ['audience', '(OOOOOOOOOH.)'],
        ['p', 'That was a DIFFERENT bucket.']] },
      { ask: 'Ask {d} why the slot smells of them now.', clue: '{d} rolled in the slot on purpose to claim it.', lines: [
        ['d', 'I rolled in it. To mark it. It is a normal thing.'],
        ['judge', 'It is a normal thing for cats.'],
        ['d', 'I have cat energy.']] },
      { ask: 'Remind them both they are fighting over a plank.', sass: true, lines: [
        ['judge', 'It is a plank. You are fighting over a plank. I was buried in a box that cost less than this argument.'],
        ['p', 'It is a very good plank.'],
        ['d', 'It is the best plank.'],
        ['judge', 'It is an absolutely average plank.']] },
      { ask: 'Ask {p} to describe the bucket.', happen: 'outburst', party: 'd', lines: [
        ['p', 'Blue. Deep. Unforgiving.'],
        ['judge', 'And what was in it?'],
        ['p', 'Everything I had eaten since Thursday. And a button. I do not know where the button came from.']] },
      { ask: 'Ask the jury who they think owns the slot.', lines: [
        ['jury', '{j} says the slot belongs to whoever is lying in it, which is the law of the jungle and also of the bus.'],
        ['judge', 'Thank you, {j}. Nobody asked you. Well. I did. I regret it.']] }
    ],
    rulings: {
      plaintiff: [
        ['judge', 'Judgment for {p}. You get sick, you get your slot back. That is basic decency, which I gather is rare on this shelf.'],
        ['d', 'Can I at least keep the smell?'],
        ['judge', 'The smell stays. You leave.']],
      defendant: [
        ['judge', 'Judgment for {d}. {p} stole this slot first and cries when it happens back. That is called karma. It is also called a bucket.'],
        ['p', 'This is a MISCARRIAGE of JUSTICE.'],
        ['judge', 'This is a plank.']],
      both: [
        ['judge', 'You are both slot thieves. {p} stole it in spring. {d} stole it back in a bucket-based ambush. You deserve each other.'],
        ['judge', 'You will share the slot on alternate days, and you will both clean the bucket.'],
        ['audience', '(Applause. Somebody at the back yells “THE BUCKET”.)']]
    },
    hallway: { p: 'I’ll get it back. I have a bucket at home. I am not afraid to use it.', d: 'Fine. We share. But I get the warm side. There is no warm side. I’ll make one.' }
  },
  {
    id: 'early-eulogy', title: 'The Early Eulogy', truth: 'plaintiff',
    claim: '{p} is suing {d} for delivering {p}’s eulogy while {p} was alive and in the front row.',
    asking: 'A retraction, a nicer eulogy, and the flowers back',
    plaintiff: [
      ['p', 'I attended my own funeral as a guest. There had been a misunderstanding about a nap.'],
      ['p', '{d} stood up and said I was “mostly fine” and “a bit much”. In front of the moth.'],
      ['judge', 'You were at your own funeral.'],
      ['p', 'I brought a salad.']
    ],
    defendant: [
      ['d', 'It was a lovely eulogy. “Mostly fine” is lovely. It is the nicest thing anyone has ever said about me.'],
      ['d', 'And they held the funeral anyway. Nobody wanted to waste the cake.']
    ],
    questions: [
      { ask: 'Ask {d} if they noticed {p} in the front row.', clue: '{d} saw {p} alive in the front row, eating a salad, and carried on anyway.', lines: [
        ['d', 'I did notice. I thought it was a ghost. You do not stop a eulogy for a ghost. That is rude.'],
        ['judge', 'It was eating a salad.'],
        ['d', 'Ghosts eat salad. Not well. It goes straight through.']] },
      { ask: 'Have {d} read the eulogy aloud.', clue: '{d} used the eulogy to claim {p} owed them three souls. {p} did not.', happen: 'outburst', party: 'p', lines: [
        ['d', '“{p} was here. Now {p} is not. {p} was mostly fine. {p} was a bit much. {p} owed me three souls.”'],
        ['judge', 'Did {p} owe you three souls?'],
        ['d', '…I thought if I said it at the funeral nobody could argue.']] },
      { ask: 'Tell {p} to be grateful anyone came.', sass: true, lines: [
        ['judge', '{p}, four people came to my funeral and one of them was the horse. Be grateful.'],
        ['p', 'How many came to mine?'],
        ['d', 'Six. Seven with you.']] },
      { ask: 'Ask {p} who organised the funeral.', clue: 'The funeral was booked by {d}, who never checked whether {p} was dead.', lines: [
        ['p', 'I don’t know. Somebody saw me lying very still and just started booking things.'],
        ['judge', 'Who?'],
        ['bailiff', '(ahem) The paperwork is signed by {d}, Your Honour. In a hurry. With a heart.']] },
      { ask: 'Ask what happened to the flowers.', lines: [
        ['d', 'I took them home. I bought them for your death. You did not die. That is on you.'],
        ['judge', 'That is… annoyingly not wrong.']] },
      { ask: 'Invite {d} to deliver the court’s eulogy too.', sass: true, lines: [
        ['judge', 'Would you like to do mine? I am right here. I have been dead three hundred years. Go on.'],
        ['d', '“Judge Mortis was mostly fine.”'],
        ['audience', '(Applause. The judge is visibly moved. His jaw wobbles.)']] }
    ],
    rulings: {
      plaintiff: [
        ['judge', 'Judgment for {p}. You do not eulogise the living. You do not invoice at a funeral. You do not take the flowers.'],
        ['judge', 'And next time somebody is lying very still, {d}, you check them. With a stick. Like a normal person.'],
        ['d', 'Can I keep the speech for when it’s real?'],
        ['judge', 'Put it in a drawer.']],
      defendant: [
        ['judge', 'Judgment for {d}. {p}, if you do not want a funeral, stop lying so still. The eulogy stands. You are officially “mostly fine”.'],
        ['p', 'I am MORE than mostly fine.'],
        ['judge', 'Not according to the record.']],
      both: [
        ['judge', 'You are both morbid idiots. One of you lay still for attention. The other one booked a hall.'],
        ['judge', 'You will each write the other a eulogy. A NICE one. And read them at the same time. Case closed.']]
    },
    hallway: { p: 'I’m going to die just to prove a point. Not today. But soon. When it’s inconvenient for {d}.', d: 'I’m keeping the flowers. They’re pre-grieved. They’ll be ready for next time.' }
  },
  {
    id: 'haunted-sock', title: 'The Haunted Sock', truth: 'defendant',
    claim: '{p} is suing {d} for returning a borrowed sock possessed.',
    asking: 'One sock, exorcised, and damages for the whispering',
    plaintiff: [
      ['p', 'I lent {d} one sock. For warmth. It came back whispering.'],
      ['p', 'At night it says my name. Then it says “wrong”. Just “wrong”. Over and over.'],
      ['judge', 'Where is the sock now?'],
      ['bailiff', 'In a jar, Your Honour. It is saying my name now.']
    ],
    defendant: [
      ['d', 'That sock was haunted when I got it. I did not mention it. It would have been rude.'],
      ['d', 'It kept asking for its other half. I thought it was a metaphor. It was a sock.']
    ],
    questions: [
      { ask: 'Ask {p} where the sock came from.', clue: '{p} got the sock from the bottom drawer. The one that whispers.', lines: [
        ['p', 'The drawer. The bottom drawer. The one we don’t open.'],
        ['judge', 'Why do you not open it?'],
        ['p', 'Because of the whispering.']] },
      { ask: 'Question the sock directly.', clue: 'The sock says it has been haunted “since the beginning”, long before {d} had it.', lines: [
        ['narrator', '(The bailiff holds up the jar. The sock presses itself against the glass.)'],
        ['narrator', '(The sock whispers: “{p}… wrong… since… the beginning.”)'],
        ['judge', 'Since the beginning.'],
        ['p', 'It’s saying that for effect.']] },
      { ask: 'Ask {d} what they did to the sock.', lines: [
        ['d', 'I wore it. I apologised to it. I sang to it once. It cried. I think we bonded.'],
        ['judge', 'You bonded with a haunted sock.'],
        ['d', 'It has been a lonely year.']] },
      { ask: 'Tell {p} this is the dumbest case ever put before a skeleton.', sass: true, lines: [
        ['judge', 'Three hundred years on the bench. A man once sued a hat. The hat sued him back. This is dumber.'],
        ['p', 'Who won?'],
        ['judge', 'The hat.']] },
      { ask: 'Ask the bailiff for the drawer’s records.', clue: 'The bottom drawer has been whispering since before anyone here was born.', lines: [
        ['bailiff', 'Seventeen complaints on file about that drawer, Your Honour. Every one says “whispering”. The oldest is in Latin.'],
        ['npc', 'That drawer whispered at my christening. I thought it was the vicar. It was not the vicar.', 'uncle']] },
      { ask: 'Ask {p} if they even want the sock back.', happen: 'outburst', party: 'p', lines: [
        ['p', 'Not really. I want it to stop saying “wrong”.'],
        ['judge', 'That is not a sock problem. That is a you problem.']] }
    ],
    rulings: {
      plaintiff: [
        ['judge', 'Judgment for {p}. {d} returns the sock, unhaunted. How? Not my job. Get a priest. Get a small priest.'],
        ['d', 'Where do I find a small priest?'],
        ['judge', 'Try the drawer.']],
      defendant: [
        ['judge', 'Judgment for {d}. That sock was haunted before it left the drawer. You lent a cursed sock and want damages? Here are your damages: take your sock home.'],
        ['narrator', '(The sock whispers “wrong” one last time. Everyone agrees with it.)']],
      both: [
        ['judge', 'You are both wrong. The sock is right. The sock has been right this whole time.'],
        ['judge', 'The sock goes back in the drawer, and nobody borrows from the drawer. Ever.']]
    },
    hallway: { p: 'I’m going to find the other sock. Then there will be two. Then we’ll see who’s wrong.', d: 'I miss the sock. It was mostly whispering, but it was ours.' }
  },
  {
    id: 'dead-portrait', title: 'The Portrait', truth: 'both',
    claim: '{p} is suing {d} for painting their portrait “in a way that looks dead”.',
    asking: 'A refund, and a new portrait with more cheekbone',
    plaintiff: [
      ['p', '{d} painted me. I sat for six hours. I look like a corpse that lost an argument.'],
      ['p', 'My eyes are two holes. My mouth is a line. There are flies. Painted flies. On me.'],
      ['judge', 'Were there real flies?'],
      ['p', 'That is not the point.']
    ],
    defendant: [
      ['d', 'I paint what I see. I saw a still, slightly grey resident with flies.'],
      ['d', 'It is called realism. People pay for this.']
    ],
    questions: [
      { ask: 'Ask {p} if there were real flies at the sitting.', clue: 'There really were flies around {p} for the whole sitting.', lines: [
        ['p', '…There were some flies.'],
        ['judge', 'How many?'],
        ['p', 'A normal number. For me.']] },
      { ask: 'Ask {d} how long they have been painting.', clue: '{d} took up painting on Tuesday and charged full price anyway.', lines: [
        ['d', 'Since Tuesday.'],
        ['judge', 'This Tuesday?'],
        ['d', 'I am a natural.']] },
      { ask: 'Ask what {p} paid for it.', clue: '{d} charged twelve souls, one of them a fee for the flies.', lines: [
        ['p', 'Twelve souls!'],
        ['judge', 'Twelve souls, for a skill you acquired on Tuesday?'],
        ['d', 'Eleven for the painting. One for the flies.']] },
      { ask: 'Have the bailiff show the painting to the audience.', happen: 'faint', lines: [
        ['narrator', '(The bailiff turns the painting round. The audience screams. One ghost leaves the building.)'],
        ['audience', '(A voice from the back: “IT’S BEAUTIFUL.” It is the moth.)']] },
      { ask: 'Tell {p} the painting is flattering, actually.', sass: true, lines: [
        ['judge', '{p}, I have seen you. The painting is being generous. The flies are being generous.'],
        ['p', 'The flies are WITNESSES.']] },
      { ask: 'Ask {p} whether they sat still.', clue: '{p} sat so still that {d} checked for signs of life. Twice.', lines: [
        ['p', 'Perfectly still. Six hours. I barely breathed.'],
        ['d', 'It was very unsettling. I checked twice. With a mirror.']] }
    ],
    rulings: {
      plaintiff: [
        ['judge', 'Judgment for {p}. You learned to paint on Tuesday and charged a fly fee. Full refund. No painting until at least Friday.'],
        ['d', 'What about my art?'],
        ['judge', 'Your art is a crime scene.']],
      defendant: [
        ['judge', 'Judgment for {d}. You sat like a corpse, with flies, and got a painting of a corpse, with flies. That is not a crime. That is a mirror.'],
        ['p', 'I want a second opinion.'],
        ['judge', 'The moth loves it.']],
      both: [
        ['judge', 'You are both terrible. {p} sat there like a dead thing collecting flies, and {d} painted it like a dead thing and charged for the flies.'],
        ['judge', 'Half refund. The painting hangs in the hall, as a warning to others.'],
        ['audience', '(The audience looks at the painting again. It is worse the second time.)']]
    },
    hallway: { p: 'I’m hiring a professional. The spider does portraits. Mostly of flies, but still.', d: 'Critics are just people who can’t paint flies.' }
  },
  {
    id: 'tooth-fairy', title: 'The Tooth Fairy Job', truth: 'both',
    claim: '{p} is suing {d} for selling {p}’s three teeth to the tooth fairy and keeping the money.',
    asking: 'Three souls, and the teeth back if the fairy will part with them',
    plaintiff: [
      ['p', 'I had three beautiful teeth. In a tin. {d} took them.'],
      ['p', '{d} put them under a pillow and the tooth fairy paid three souls. That was my dental pension.'],
      ['judge', 'Whose teeth were they?'],
      ['p', 'Mine. Legally. I found them.']
    ],
    defendant: [
      ['d', 'Finders keepers. I found them in {p}’s tin. That is exactly where I found them.'],
      ['d', 'The fairy was thrilled. She said they were “vintage”.']
    ],
    questions: [
      { ask: 'Ask {p} where they found the teeth.', clue: 'The teeth came from a jar labelled NOT UNCLE’S, in Uncle’s handwriting.', lines: [
        ['p', 'In a jar. Marked “NOT UNCLE’S”.'],
        ['judge', 'In handwriting that is clearly Uncle’s.'],
        ['p', 'I don’t read handwriting. I read labels.'],
        ['npc', 'THOSE ARE MY TEETH. I HAVE BEEN LOOKING FOR THEM SINCE 1911.', 'uncle']] },
      { ask: 'Ask {d} what they spent the three souls on.', clue: '{d} spent the tooth money on a hat nobody can see.', lines: [
        ['d', 'A hat.'],
        ['judge', 'Where is the hat?'],
        ['d', 'I am wearing it.'],
        ['narrator', '({d} is not wearing a hat.)'],
        ['d', 'It is a very small hat.']] },
      { ask: 'Have the bailiff check {d}’s mouth.', sass: true, lines: [
        ['bailiff', '(The bailiff checks.) All present, Your Honour. Plus one extra. Hm.'],
        ['judge', 'An EXTRA tooth?'],
        ['d', 'I am a collector.']] },
      { ask: 'Ask {p} whether the teeth were ever really theirs.', clue: '{p} admits the teeth only became “theirs” by being put in a tin.', lines: [
        ['p', 'They were mine the moment I put them in my tin. That is how tins work.'],
        ['judge', 'That is how theft works.']] },
      { ask: 'Call the tooth fairy.', happen: 'faint', lines: [
        ['narrator', '(A small, exhausted fairy is escorted in. She has a sack of teeth and the eyes of someone who has seen too many pillows.)'],
        ['narrator', 'Fairy: “I pay for teeth. I don’t ask whose. Nobody in this job asks whose.”'],
        ['judge', 'Whose teeth do you usually get?'],
        ['narrator', 'Fairy: “You don’t want to know. I don’t want to know. I’m going home.”']] },
      { ask: 'Ask {d} if they would do it again.', happen: 'outburst', party: 'p', lines: [
        ['d', 'Instantly. The fairy has a loyalty card.']] }
    ],
    rulings: {
      plaintiff: [
        ['judge', 'Judgment for {p}. {d} pays three souls and hands over the hat.'],
        ['narrator', '({d} hands over nothing. {p} puts it on. It suits them.)']],
      defendant: [
        ['judge', 'Judgment for {d}. {p} took teeth from a jar and called it a pension. {d} merely liquidated the assets.'],
        ['p', 'That is just THEFT wearing a TIE.'],
        ['judge', 'That is finance.']],
      both: [
        ['judge', 'Neither of you owned those teeth. They are Uncle’s. Every tooth on this shelf is Uncle’s until proven otherwise.'],
        ['judge', 'You will both pay Uncle three souls and write him a letter, which somebody will read to him, because he has no eyes.'],
        ['audience', '(Uncle, in the gallery, weeps. It sounds like marbles.)']]
    },
    hallway: { p: 'I’m starting a new tin. Nobody tell Uncle.', d: 'I still have the hat. They can’t take the hat. Nobody can see the hat.' }
  },
  {
    id: 'crayon-will', title: 'The Crayon Will', truth: 'plaintiff',
    claim: '{p} is suing {d} for writing themselves into {p}’s will. In crayon. While {p} was asleep.',
    asking: 'The will back, and the crayon confiscated',
    plaintiff: [
      ['p', 'I woke up and my will had a new page. It says “and EVERYTHING to {d}”. In purple crayon. With a heart.'],
      ['p', 'I don’t own purple crayon. I own a spoon.'],
      ['judge', 'What did the will say before?'],
      ['p', 'The spoon. To the moth.']
    ],
    defendant: [
      ['d', 'I did not write it. The will wrote it. Wills are very emotional documents.'],
      ['d', 'And the heart is just how I sign things. Everybody signs with a heart. It is legally binding.']
    ],
    questions: [
      { ask: 'Have {d} write the word “everything”.', clue: '{d} spells it “EVRYTHING”, with a heart, exactly like the forged page.', lines: [
        ['narrator', '({d} writes “EVRYTHING” in purple crayon, and dots the I with a heart. There is no I.)'],
        ['judge', 'The will says “EVRYTHING”.'],
        ['d', 'Common mistake.']] },
      { ask: 'Ask {p} whether they are dying.', clue: '{d} is openly waiting for {p} to die.', happen: 'outburst', party: 'p', lines: [
        ['p', 'No!'],
        ['d', 'Not YET.'],
        ['judge', '{d}, did you just say “not yet”?'],
        ['d', 'I said “the jet”. There is a jet. Somewhere.']] },
      { ask: 'Tell {d} a heart is not a signature.', sass: true, lines: [
        ['judge', 'A heart is not a signature, {d}. A heart is a muscle, and I have not had one since 1702.'],
        ['audience', '(OOOOOOOOH.)']] },
      { ask: 'Ask the bailiff where the crayon was found.', clue: 'A purple crayon and three practice wills were found in {d}’s slot.', lines: [
        ['bailiff', 'In {d}’s slot, Your Honour. Next to three drafts. They all say “practice will”.']] },
      { ask: 'Ask what the moth thinks.', lines: [
        ['npc', 'I was promised a spoon. I have waited a very long time for this spoon. I would like to be considered.', 'moth'],
        ['judge', 'You are not a party to this case.'],
        ['npc', 'I am a party to every case that involves a spoon.', 'moth']] },
      { ask: 'Ask {d} what they would do with everything.', sass: true, lines: [
        ['d', 'Get a bigger slot. A second spoon. Visit the grave every week. Maybe fortnightly.'],
        ['judge', 'Whose grave?'],
        ['d', '…The spoon’s.']] }
    ],
    rulings: {
      plaintiff: [
        ['judge', 'Judgment for {p}. {d} forged a will in crayon and spelled it wrong. {d} is banned from all stationery for a year.'],
        ['d', 'What about pencils?'],
        ['judge', 'ESPECIALLY pencils.']],
      defendant: [
        ['judge', 'Judgment for {d}. The will has a heart on it. Look, I am not proud of this. The heart was very convincing.'],
        ['p', 'You’re letting a CRAYON win?'],
        ['judge', 'The crayon had the better argument.']],
      both: [
        ['judge', 'You are both morbid. One forges wills in crayon, the other keeps a will for a spoon. New wills, both of you. Everything to the moth.'],
        ['audience', '(The moth, in the gallery, screams with joy.)']]
    },
    hallway: { p: 'I’m leaving everything to the wall. At least the wall is honest. It snores, but it’s honest.', d: 'I’ll be in the will eventually. I’m patient. I have crayons at home.' }
  },
  {
    id: 'labelled-biscuit', title: 'The Labelled Biscuit', truth: 'defendant',
    claim: '{p} is suing {d} for eating a biscuit labelled “{p}’s. DO NOT EAT. I WILL KNOW.”',
    asking: 'One biscuit, and a formal admission that they knew',
    plaintiff: [
      ['p', 'The label was clear. It said my name. It said do not eat. It said I will know.'],
      ['p', 'And I knew. I always know.'],
      ['judge', 'How did you know?'],
      ['p', 'Crumbs on {d}’s face. And guilt. And more crumbs.']
    ],
    defendant: [
      ['d', 'Your Honour, {p} labels everything. EVERYTHING.'],
      ['d', 'There is a label on me. It says “{p}’s”. I did not put it there. I woke up with it.']
    ],
    questions: [
      { ask: 'Have the bailiff check {d} for labels.', clue: '{p} has labelled {d} as their property.', lines: [
        ['bailiff', '(The bailiff inspects {d}.) There is a label on the back, Your Honour. It says “{p}’s. DO NOT EAT.”'],
        ['judge', 'You labelled another resident as food?'],
        ['p', 'As property. Food is a type of property.']] },
      { ask: 'Ask who actually bought the biscuit.', clue: '{d} bought the biscuit with their own souls and kept the receipt.', lines: [
        ['d', 'I did. With my own souls. I have the receipt.'],
        ['narrator', '({d} produces a receipt. The receipt also has a label on it. It says “{p}’s”.)']] },
      { ask: 'Ask {p} to stand up and turn round.', sass: true, clue: '{p} labelled the judge’s bench during the opening statements.', lines: [
        ['narrator', '(There is a label on the judge’s bench. It says “{p}’s”.)'],
        ['judge', 'When did you do this?'],
        ['p', 'During the opening statements.'],
        ['audience', '(The audience ROARS.)']] },
      { ask: 'Ask {d} how the biscuit tasted.', lines: [
        ['d', 'Honestly? Like victory. And a little like glue. From the label.']] },
      { ask: 'Ask {p} what “I will know” means.', happen: 'sleep', lines: [
        ['p', 'It means I have a system.'],
        ['judge', 'What system?'],
        ['p', 'I sit very still in the dark and watch the biscuits.'],
        ['judge', 'Since when?'],
        ['p', 'March.']] },
      { ask: 'Ask {d} about the crumbs.', happen: 'outburst', party: 'p', lines: [
        ['d', 'I leave crumbs so people know I was there. That is manners. I am not an animal.']] }
    ],
    rulings: {
      plaintiff: [
        ['judge', 'Judgment for {p}. A label is a label. It said you would know. You knew. That is a contract.'],
        ['d', 'I’m labelled too!'],
        ['judge', 'Then you are {p}’s as well. Congratulations. Go and sit on their shelf.']],
      defendant: [
        ['judge', 'Judgment for {d}. {d} bought the biscuit, kept the receipt, and has been labelled like a jam jar. {p}, you do not own things by writing on them.'],
        ['p', 'Then how do people own things?'],
        ['judge', 'Money. Violence. Mostly money.']],
      both: [
        ['judge', 'You are both exhausting. One labels living things. The other eats a biscuit that says “I WILL KNOW” and acts surprised when someone knows.'],
        ['judge', 'All labels come off. Including the one on my bench. Including the one I have just found on my skull.']]
    },
    hallway: { p: 'I’ve already made new labels. They say “MINE AGAIN”.', d: 'I’m keeping the label. It’s the only thing anyone’s ever given me.' }
  },
  {
    id: 'fake-seance', title: 'The Séance Under the Table', truth: 'plaintiff',
    claim: '{p} is suing {d} for a séance that was “obviously just {d} under the table going woooo”.',
    asking: 'Five souls, and the real great-aunt on the line',
    plaintiff: [
      ['p', 'I paid {d} five souls to contact my great-aunt Gertrude. The lights went out. A voice said “woooo”.'],
      ['p', 'Gertrude never said woooo. Gertrude said “eat something”. And not like a ghost. Like a threat.']
    ],
    defendant: [
      ['d', 'Spirits change after death. Gertrude has grown. Gertrude now says woooo.'],
      ['d', 'I was under the table for medical reasons.']
    ],
    questions: [
      { ask: 'Ask {d} what Gertrude said, exactly.', clue: 'The “ghost” asked {p} to pay {d}. Twice.', lines: [
        ['d', '“Woooo. I am Gertrude. Please pay {d}. Woooo. {d} is very talented. Woooo.”'],
        ['judge', 'Gertrude asked you to tip the medium.'],
        ['d', 'She is very generous. For a dead lady.']] },
      { ask: 'Ask {d} about the medical reasons.', clue: '{d} admits to being under the table.', lines: [
        ['d', 'I have a condition where I have to be under a table when people pay me.'],
        ['judge', 'That is not a condition.'],
        ['d', 'It is a very rare condition.']] },
      { ask: 'Make {d} do the voice.', sass: true, lines: [
        ['judge', 'Do the voice.'],
        ['d', '…woooo.'],
        ['judge', 'Again. With feeling.'],
        ['d', 'WOOOOOOOO. I AM GERTRUDE.'],
        ['audience', '(The audience goes absolutely feral.)']] },
      { ask: 'Call an actual ghost to give evidence.', clue: 'The Ministry of Haunting confirms Gertrude was on holiday that night.', lines: [
        ['npc', 'Ministry of Haunting. I have reviewed the séance. That was a small person under a table. Also, Gertrude is on holiday.', 'ghost'],
        ['judge', 'Ghosts go on holiday?'],
        ['npc', 'Seaside towns, mostly. We love a pier.', 'ghost']] },
      { ask: 'Ask {p} what they wanted to ask Gertrude.', happen: 'outburst', party: 'd', lines: [
        ['p', 'Where she hid the good biscuits.'],
        ['judge', 'That is it?'],
        ['p', 'They were VERY good biscuits.']] },
      { ask: 'Explain to {p} that the dead are not a vending machine.', sass: true, lines: [
        ['judge', '{p}. The dead are not a vending machine. You do not put in five souls and get a Gertrude.'],
        ['p', 'Then what do you get?'],
        ['judge', 'Usually a {d} under a table.']] }
    ],
    rulings: {
      plaintiff: [
        ['judge', 'Judgment for {p}. That was not a séance. That was a con with a tablecloth. Refund, plus an apology to Gertrude, by postcard, to the pier.'],
        ['d', 'What if she replies?'],
        ['judge', 'Then you have bigger problems than me.']],
      defendant: [
        ['judge', 'Judgment for {d}. {p} paid for a spooky experience and got a spooky experience. It was spookier than it needed to be.'],
        ['p', 'IT WAS UNDER THE TABLE.'],
        ['judge', 'So, often, is the truth.']],
      both: [
        ['judge', 'You are both fools. One of you pays for ghosts, and one of you IS the ghost. You will hold a real séance, together, and ask Gertrude where the biscuits are.'],
        ['narrator', '(Somewhere, on a pier, Gertrude says “eat something”.)']]
    },
    hallway: { p: 'I’m going to find those biscuits myself. With a spade.', d: 'Woooo. That’s all I’m saying. On the advice of my ghost.' }
  },
  {
    id: 'practice-burial', title: 'The Practice Burial', truth: 'defendant',
    claim: '{p} is suing {d} for burying them in the plant pot. Alive. “A little bit”.',
    asking: 'Twenty souls, and all the soil out of their ears',
    plaintiff: [
      ['p', 'I woke up in the plant pot. Under soil. With a daisy on my face.'],
      ['p', 'I dug myself out with a teaspoon. It took until Thursday.'],
      ['judge', 'Where did you get a teaspoon?'],
      ['p', 'It was in there with me. With a note. The note said “good luck”.']
    ],
    defendant: [
      ['d', 'They asked me to. They said “I want to know what it’s like”.'],
      ['d', 'I gave them a teaspoon. I gave them a daisy. I made a small speech. It is the most thoughtful thing I have ever done for anybody.']
    ],
    questions: [
      { ask: 'Ask {d} for proof that {p} asked.', clue: '{p} signed a form: “Practice burial. Please do not dig up until Thursday.”', lines: [
        ['d', 'I have a form.'],
        ['narrator', '(The form reads: “Practice burial. Please do not dig up until Thursday. Signed, {p}.”)'],
        ['judge', '{p}, is that your signature?'],
        ['p', 'I sign a LOT of things, Your Honour.']] },
      { ask: 'Ask {p} which day they got out.', clue: '{p} came out on exactly the Thursday their form asked for.', happen: 'outburst', party: 'p', lines: [
        ['p', 'Thursday.'],
        ['judge', 'The form says Thursday.'],
        ['p', 'That is a COINCIDENCE.']] },
      { ask: 'Tell {p} the court has been buried too and it was lovely.', sass: true, lines: [
        ['judge', 'I have been buried for three hundred years. It is lovely. The worms are chatty. You did four days and you want twenty souls?'],
        ['p', 'The worms were NOT chatty.'],
        ['judge', 'Then you met the wrong worms.']] },
      { ask: 'Ask {p} about the teaspoon.', lines: [
        ['p', 'It was a good teaspoon. Silver. I’m keeping it.'],
        ['d', 'That is MY teaspoon.'],
        ['judge', 'So you went into the ground with nothing and came out with a spoon. That is called a profit.']] },
      { ask: 'Ask the plant pot’s usual occupant.', happen: 'faint', lines: [
        ['npc', '{p} spent four days in my father’s grave. Father did not mind. He said it was nice to have company.', 'geoffrey2'],
        ['judge', 'Your father is dead.'],
        ['npc', 'He is a very good listener.', 'geoffrey2']] },
      { ask: 'Ask {d} if they would bury {p} again.', lines: [
        ['d', 'Only with a form. I am not a monster.']] }
    ],
    rulings: {
      plaintiff: [
        ['judge', 'Judgment for {p}. I do not care what the form says. You do not bury people. Not even a little bit. Not even with a daisy.'],
        ['d', 'Not even a practice one?'],
        ['judge', 'Practise on a raisin.']],
      defendant: [
        ['judge', 'Judgment for {d}. {p} ordered a burial, received a burial with a daisy and a speech, and was released on the agreed day. That is the best customer service on this shelf.'],
        ['p', 'I had soil in my EARS.'],
        ['judge', 'That is included.']],
      both: [
        ['judge', 'You are both deranged. One asks to be buried for fun; the other says yes and brings a spoon.'],
        ['judge', 'No more burials unless somebody is actually dead. And I will be checking. With a stick.']]
    },
    hallway: { p: 'Honestly? It was quite peaceful. Don’t tell {d}.', d: 'I’m starting a business. Practice burials. Daisies included.' }
  },
  {
    id: 'moth-custody', title: 'Custody of the Moth', truth: 'both',
    claim: '{p} is suing {d} for custody of Madam Moth, whom they both claim to own.',
    asking: 'Full custody of the moth, and weekend visits with the lamp',
    plaintiff: [
      ['p', 'I found her first. On my ceiling. She looked at me like I was the moon.'],
      ['p', 'I have fed her. Mostly wool. Once, a sleeve.'],
      ['judge', 'Whose sleeve?'],
      ['p', 'Mine. I was wearing it.']
    ],
    defendant: [
      ['d', 'She sleeps in MY slot. She dusts herself on MY face. That is a bond.'],
      ['d', 'She calls me “Lamp”. Nobody else gets called Lamp.']
    ],
    questions: [
      { ask: 'Call Madam Moth to the stand.', clue: 'Madam Moth says she belongs to the lamp, not to either of them.', lines: [
        ['npc', 'I belong to nobody. I belong to the light. Mostly the lamp. Sometimes the fridge, when it is open.', 'moth'],
        ['judge', 'Do you like either of them?'],
        ['npc', '{p} is soft. {d} is warm. Neither of them is a lamp.', 'moth']] },
      { ask: 'Ask {d} what they call the moth.', happen: 'outburst', party: 'p', lines: [
        ['d', 'Mothew.'],
        ['p', 'HER NAME IS NOT MOTHEW.']] },
      { ask: 'Ask {p} about the sleeve.', lines: [
        ['p', 'She ate it while I was inside it. It was the most intimate moment of my life.'],
        ['judge', 'Did you consent?'],
        ['p', 'I did not NOT consent.']] },
      { ask: 'Tell them both the moth is seeing other people.', sass: true, lines: [
        ['judge', 'Both of you. Listen. The moth has been seeing the lamp. And the fridge. And the neighbour’s porch light.'],
        ['judge', 'This is not a custody battle. It is a love triangle, and you are both losing to electricity.'],
        ['audience', '(OOOOOOOOOOOOH.)']] },
      { ask: 'Ask the bailiff where the moth actually sleeps.', clue: 'The moth splits her week between {p}, {d} and the lamp, and has for months.', lines: [
        ['bailiff', 'According to surveillance, Your Honour: Monday to Wednesday with {p}, Thursday to Saturday with {d}, and Sundays with the lamp, in what I can only describe as a situation.']] },
      { ask: 'Ask {d} what they feed her.', lines: [
        ['d', 'Wool. Crumbs. One of {p}’s socks. The haunted one.'],
        ['p', 'THAT’S WHERE IT WENT.']] }
    ],
    rulings: {
      plaintiff: [
        ['judge', 'Judgment for {p}. Full custody. {d} gets supervised visits. The lamp supervises.'],
        ['narrator', '(The moth, entirely unbothered, flies straight into the studio light.)']],
      defendant: [
        ['judge', 'Judgment for {d}. She sleeps on your face. That is commitment. {p} may visit on Sundays.'],
        ['npc', 'I am with the lamp on Sundays.', 'moth'],
        ['judge', 'Then {p} may visit the lamp.']],
      both: [
        ['judge', 'Nobody owns the moth. The moth owns herself. And, frankly, the lamp.'],
        ['judge', 'Shared custody, split by the week, exactly as the moth already arranged without either of you noticing.'],
        ['audience', '(The moth takes a bow. It is a very small bow. The audience weeps.)']]
    },
    hallway: { p: 'She’ll come back to me. They always come back to the soft one.', d: 'Mothew knows who loves her.' }
  }
];

/* Scenes that break out mid-episode. `choice` scenes wait for you: bang the
   gavel (the jury respects order) or let it play out (the audience loves
   it). {x} is whoever is losing it; `x` lines are spoken by them. */
export const HAPPENINGS = {
  outburst: { anim: 'outburst', choice: true,
    intro: [['narrator', '({x} climbs onto the podium.)']],
    rants: [
      'THIS IS A SHAM. A SHAM. I WAS HERE FIRST. I HAVE ALWAYS BEEN HERE FIRST.',
      'I HAVE BEEN WRONGED. I HAVE BEEN WRONGED IN THIS SLOT AND IN THE NEXT ONE.',
      'YOU’RE ALL IN ON IT. THE MOTH. THE WALL. THE SKELETON. ESPECIALLY THE SKELETON.',
      'I WILL NOT BE SILENCED BY A MAN WITH NO THROAT.',
      'I WANT IT NOTED THAT I AM CRYING. NOTE IT. BAILIFF, NOTE THE CRYING.'
    ],
    gavel: [['judge', 'SIT. DOWN. I have no skin and I am still the thinnest patience in this room.'], ['narrator', '({x} sits down, sulking at a volume the microphones can pick up.)']],
    let: [['narrator', '({x} continues for four minutes. At one point it sings. The audience gives a standing ovation.)'], ['judge', 'Are you finished?'], ['x', 'I have a second verse.']] },
  sleep: { anim: 'sleep', choice: true,
    intro: [['narrator', '({j} has fallen asleep in the jury box. {j} is snoring in the key of D.)']],
    gavel: [['judge', 'WAKE UP, {j}.'], ['narrator', '({j} wakes up and immediately votes. There is nothing to vote on yet.)']],
    let: [['narrator', '({j} sleeps through the rest of the case. {j} will still be voting.)'], ['audience', '(A ghost in the front row starts snoring in harmony.)']] },
  throw: { anim: 'throw', choice: true,
    intro: [['narrator', '({d} has thrown a tooth at {p}.)']],
    gavel: [['judge', 'Bailiff. Confiscate every tooth in the building.'], ['bailiff', 'That will take a while, Your Honour. Uncle is here.']],
    let: [['narrator', '({p} throws it back. {d} throws a shoe. Nobody here wears shoes. Nobody knows where the shoe came from.)'], ['audience', '(The audience chants “SHOE. SHOE. SHOE.”)']] },
  heckle: { anim: 'heckle', choice: true,
    intro: [['audience', '(A ghost in row two stands up: “{p} IS A FRAUD. I WENT ON A DATE WITH {p} IN 1850.”)']],
    gavel: [['judge', 'Sit down or be exorcised. Bailiff, exorcise him a little.'], ['bailiff', '(The bailiff flicks salt at the ghost. The ghost sits down, crispy.)']],
    let: [['audience', '(The ghost describes the date in detail. It was a picnic. It rained. {p} ate the blanket.)'], ['p', 'IT WAS A VERY GOOD BLANKET.']] },
  faint: { anim: 'faint', ratings: 6,
    intro: [['narrator', '(A ghost in the front row faints. It was already dead, so this is mostly theatre.)'], ['audience', '(Two more ghosts faint in solidarity.)']] },
  dark: { anim: 'dark', ratings: 6,
    intro: [['narrator', '(The studio lights go out.)'], ['judge', 'Everybody stay calm. Somebody is licking my hand. Bailiff, is that you?'], ['bailiff', 'No, Your Honour.'], ['narrator', '(The lights come back on. Nobody is near the judge. Nobody discusses it.)']] },
  cat: { anim: 'cat', ratings: 6,
    intro: [['narrator', '(Sir Reginald Whiskers strolls across the judge’s bench, knocks the gavel onto the floor, and leaves without eye contact.)'], ['judge', 'Who let the cat in?'], ['bailiff', 'Nobody lets the cat in, Your Honour. The cat arrives.']] },
  applause: { anim: 'applause', ratings: 6,
    intro: [['narrator', '(The APPLAUSE sign has jammed on. The audience cannot stop clapping. They are tiring. One of them has died again.)']] },
  eat: { anim: 'eat', ratings: 6,
    intro: [['narrator', '(Bailiff Rattigan has eaten Exhibit B.)'], ['judge', 'What was Exhibit B?'], ['bailiff', 'Evidence, Your Honour. Delicious evidence.']] },
  jaw: { anim: 'jaw', ratings: 6,
    intro: [['narrator', '(Uncle’s jaw has fallen off in the gallery. It is still talking. It is heckling.)'], ['audience', '(The jaw, from under a seat: “BOOOOOO.”)']] },
  moth: { anim: 'moth', ratings: 6,
    intro: [['narrator', '(Madam Moth has flown into the studio light. The light has won. Madam Moth is fine. Madam Moth is thrilled.)']] }
};
export const RANDOM_HAPPENINGS = ['sleep', 'throw', 'heckle', 'faint', 'dark', 'cat', 'applause', 'eat', 'jaw', 'moth', 'outburst'];

export const OPENERS = [
  'Real residents. Real disputes. Real dead. This… is SHELF COURT.',
  'The shelf is small. The grievances are enormous. The judge has no skin. This is SHELF COURT.',
  'They share a shelf. They share a wall. Today, they share a courtroom. This is SHELF COURT.',
  'No lawyers. No appeals. No pulse. This is SHELF COURT.',
  'Filmed in front of a live studio audience, who are not alive. This is SHELF COURT.'
];
export const ALL_RISE = [
  'All rise for the Honourable Judge Mortis. Rising is optional for the dead, but encouraged.',
  'All rise. Judge Mortis is presiding. Please stop licking the benches.',
  'All rise for Judge Mortis: three hundred years on the bench, two hundred and ninety of them in the ground.'
];
export const JUDGE_ENTRANCES = [
  'Sit down. I have been dead since 1702 and I still have better things to do than this.',
  'Beauty fades. Stupid is forever. Dead is also forever. Let us see who goes for the double today.',
  'I have no ears and I can already hear you lying. Sit.',
  'Do not dig me a grave and tell me it is a flowerbed. Sit down.',
  'I am speaking. When I am speaking, you are not. That is how it worked when I had lips, and it is how it works now.'
];
export const PLAINTIFF_CUE = ['{p}. You are suing {d}. Talk.', '{p}, you brought this. Tell me why, quickly. I am decomposing.', 'Plaintiff. Go. Short sentences. I have no attention span. I have no brain.'];
export const DEFENDANT_CUE = ['{d}. Your side. And do not wee on my leg and tell me it is raining.', '{d}. Speak. Carefully. I can see right through you, and I do not even have eyes.', 'Defendant. Your turn. Impress me. Nobody ever has.'];

export const ADS = [
  { brand: 'KEITH REMOVALS', lines: ['Is your loved one dead? Are they also still in the house?', 'Call Keith. Keith removes. Keith does not ask. Keith has a van.'] },
  { brand: 'COFFIN-FRESH', lines: ['For that just-buried smell, everywhere you go.', 'Now in Wet Earth, Old Lace, and Grandad.'] },
  { brand: 'UNCLE’S DISCOUNT DENTURES', lines: ['Teeth from every era. Most of them previously owned.', 'Some of them still bite. No refunds. No questions. No eyes.'] },
  { brand: 'THE RETIREMENT DRAWER', lines: ['Tired of being alive? So is everybody at the Retirement Drawer.', 'Ask about our All-Eternity package. The lid is complimentary.'] },
  { brand: 'MINISTRY OF HAUNTING', lines: ['An unlicensed ghost is a sad ghost. It is also a crime.', 'Renew today. Moaning after eleven requires a permit.'] },
  { brand: 'MADAM MOTH’S LAMP EMPORIUM', lines: ['Every lamp is a friend.', 'Some lamps are lunch. We do not say which.'] },
  { brand: 'PAWN & POUNCE', lines: ['We buy eyes, teeth, and anything left on a table.', 'Sir Reginald Whiskers, proprietor. He is watching your table right now.'] },
  { brand: 'DUST', lines: ['Dust. It gets everywhere.', 'Dust: you will be it. Shelf Court is brought to you by Dust.'] },
  { brand: 'THE GARDEN LYING-DOWN SOCIETY', lines: ['Feeling low? Try lying down in the garden.', 'We will come back for you. Probably. Thursday at the latest.'] }
];
export const BREAK_IN = ['We’ll be right back after these messages from people who are also dead.', 'Don’t go anywhere. You can’t. You’re on a shelf.'];
export const BREAK_OUT = ['And we’re back. The judge has not moved. We are checking.', 'Welcome back to Shelf Court. Nobody has left. The doors don’t open.'];

export const JURY_AGREE = ['{j} nods so hard something falls off.', '{j} says “obviously” and folds its arms.', '{j} agrees, loudly, and then again, louder.', '{j} gives a thumbs up. {j} does not have thumbs. It is still somehow a thumbs up.'];
export const JURY_DISAGREE = ['{j} boos.', '{j} throws a raisin at the bench.', '{j} says it would have ruled with its heart, which it keeps in a jar.', '{j} turns its back on the court. It was already facing the wrong way.'];
export const AUDIENCE_REACTIONS = [
  ['(The audience is silent. One ghost coughs. It echoes for a while.)', '(Somebody in the audience says “huh”. It was not a good “huh”.)'],
  ['(Polite applause. The kind you hear at a funeral for someone nobody liked.)', '(The audience claps. Some of them are still clapping from earlier.)'],
  ['(The audience cheers. A ghost throws its hat. The hat is also a ghost.)', '(Big applause. The APPLAUSE sign did not even have to light up.)'],
  ['(The audience loses its mind. Three ghosts faint. One of them proposes to the bailiff.)', '(Standing ovation. The dead are on their feet. They do not have feet. It is still moving.)']
];
export const HALLWAY_IN = ['Outside the courtroom…', 'In the hallway, moments later…', 'Our cameras caught up with them in the corridor…'];

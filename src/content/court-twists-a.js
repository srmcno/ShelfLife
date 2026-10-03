import { alt } from './court.js';

/* Shelf Court twists for cases 0 to 11 of COURT_CASES. Each case has one
   alternate version in which the investigation reveals a different truth.
   The opening statements are the base ones, so every twist is built to sit
   comfortably underneath what the parties already said. Writing rules: see
   twist-schema in the brief; petty, dark, specific, and never a dash. */

export const TWISTS_A = {

  /* ---------- 0. The Borrowed Coffin: plaintiff becomes defendant ---------- */
  'borrowed-coffin': [{
    id: 'the-lodger',
    title: 'Keith Pays His Raisin',
    truth: 'defendant',
    turn: alt([
      ['narrator', '(From inside the coffin come three polite knocks, the way you knock on a landlord’s door.)'],
      ['judge', 'Was that Keith?'],
      ['bailiff', 'He may be asking for a repair, Your Honour. Or it may be the lid.'],
      ['p', 'It is the lid.']
    ], [
      ['bailiff', 'Your Honour, the coffin has pushed a note out from under the lid. It says “Please keep the noise down. Some of us live here.”'],
      ['judge', 'Keith is dead, Bailiff.'],
      ['bailiff', 'He has underlined “live”, sir.']
    ]),
    questions: {
      0: {
        clue: 'Keith was in the mint with a suitcase and a notice, “Vacate by Tuesday”, signed by {p}. {d} carried him home to the coffin.',
        lines: alt([
          ['d', 'The mint. Face down. Suitcase by his head. A notice pinned to his back.'],
          ['judge', 'What did the notice say?'],
          ['d', '“Vacate by Tuesday. Love, {p}.” With a kiss.'],
          ['p', 'It is a firm but friendly policy.']
        ], [
          ['d', 'Face down in the mint, Your Honour, beside a shoebox. The shoebox said “KEITH. Forwarding address: the coffin.”'],
          ['judge', 'Who wrote the forwarding address?'],
          ['d', '{p}. Little loop on the K.'],
          ['judge', 'So you did not kidnap Keith. You delivered him.'],
          ['d', 'Signed for by nobody, but yes.']
        ])
      },
      1: {
        clue: 'The raisin shelf is Keith’s rent box: one raisin a night. {p} has signed forty-one receipts, each with a smiley face.',
        lines: alt([
          ['p', 'My name is on the lid. My teeth marks are on the handle. There is a little shelf inside, where I keep one raisin.'],
          ['bailiff', 'I can confirm there is a little shelf, Your Honour. I can also confirm there is a receipt book on it.'],
          ['judge', 'Read me the top one.'],
          ['bailiff', '“Received from Keith, one raisin, rent, with thanks. Signed, {p}.” With a smiley face. There are forty more.']
        ], [
          ['p', 'My name is on the lid, Your Honour. My teeth marks are on the handle. There is a little shelf inside, for one raisin.'],
          ['judge', 'Why one raisin?'],
          ['d', 'It is the rent, Your Honour. One raisin a night, in advance. Keith has never missed once.'],
          ['p', 'He is a wonderful tenant. Stranger. He is a wonderful STRANGER.']
        ])
      },
      3: {
        clue: 'Cousin Keith has a rent book stamped by {p} too. {d} put him in {p}’s sock drawer, which had a sign saying ROOM TO LET.',
        lines: alt([
          ['d', 'A cousin. Also Keith. He came round asking about his rent book.'],
          ['judge', 'Whose rent book?'],
          ['d', '{p}’s. A stamp on every page. He was homeless, so I put him in the sock drawer. It was the only vacancy.'],
          ['p', 'THERE IS A WAITING LIST FOR THAT DRAWER.']
        ], [
          ['d', 'One cousin, Your Honour. Also Keith. Rent book, stamped by {p}, and nowhere to put it.'],
          ['judge', 'Where is Cousin Keith now?'],
          ['d', 'In {p}’s sock drawer. It had a sign on the front that said ROOM TO LET.'],
          ['p', 'THAT WAS FOR THE SOCKS. THE SOCKS PAY MORE.']
        ])
      },
      4: {
        herring: '{p} swears Keith is a total stranger it has never met, and certainly never taken money from. Unconfirmed.',
        lines: alt([
          ['p', 'On the bare shelf. Arms crossed. Not thinking about the coffin, or the tenant.'],
          ['judge', 'The what?'],
          ['p', 'Tent. I said tent. I was camping, in my mind.'],
          ['bailiff', 'Noted, Your Honour. Underlined. Twice.']
        ], [
          ['p', 'On the bare shelf, Your Honour, with no lid and no pillow, thinking of nothing, least of all Keith, whom I have never met.'],
          ['judge', 'You volunteered him. Nobody had said Keith yet.'],
          ['p', 'I volunteer all strangers. It is how you stay safe.']
        ])
      },
      5: {
        lines: alt([
          ['narrator', '(The bailiff lifts the lid, listens, and writes in his notebook for some time.)'],
          ['bailiff', 'Keith has a grievance about the mint, Your Honour. It was in his hair for two days.'],
          ['judge', 'He is a corpse, not a hedge.'],
          ['bailiff', 'He says that is exactly what it felt like.']
        ], [
          ['narrator', '(The bailiff lifts the lid. A grey hand comes out holding a small, neat form. The bailiff takes it, reads it, and tips his cap to the coffin.)'],
          ['judge', 'What is it, Bailiff?'],
          ['bailiff', 'A deposit slip, Your Honour. Keith would like it back, with interest, and a lid that closes properly.'],
          ['p', 'HE HAS A DEPOSIT SLIP?']
        ])
      }
    },
    rulings: {
      defendant: alt([
        ['judge', 'Judgment for {d}. Keith is a lodger, the raisin shelf is his rent box, and {p} has signed forty-one receipts with a smiley face.'],
        ['judge', '“He lies there like he owns the place”, you said. He has a twelve-month lease, {p}. He does own the place, in every sense that matters and several that do not.'],
        ['p', 'He was a STRANGER.'],
        ['judge', 'You sent him a card at Christmas. It said “Happy Christmas, Keith. Rent is due.”']
      ], [
        ['judge', 'Judgment for {d}. Keith has paid his raisin every night for two years, and he is the only resident on this shelf who has never been late for anything.'],
        ['judge', '{p} put a paying tenant out in the mint to lend his flat to a nap, then sued the neighbour who carried him home. {p} spends tonight in the mint, face down, with a suitcase.'],
        ['p', 'I HAVE A BAD BACK.'],
        ['judge', 'Keith has no back left, {p}, and he did not make a fuss.']
      ]),
      plaintiff: alt([
        ['judge', 'Judgment for {p}. The coffin is {p}’s, the lid says so, and the law is the law, even when the law is a landlord.'],
        ['judge', '{d} will return Keith to the mint, suitcase and all. The court has seen the rent book and does not wish to see it again.'],
        ['d', 'He has a LEASE.'],
        ['judge', 'Then he can sue. I have a cousin who does evictions. He is also called Keith.']
      ], [
        ['judge', 'Judgment for {p}. A landlord may do as it likes with its keys, and the law protects it, which is the whole sad history of landlords.'],
        ['judge', '{d} pays forty souls for the carrying and carries Keith back out to the mint.'],
        ['audience', '(A ghost at the back stands up. “I HAD A LANDLORD LIKE THAT.” A second ghost: “EVERYONE DID.”)']
      ]),
      both: alt([
        ['judge', 'You are both idiots. {p} lets a flat to a corpse and then lends it out from under him. {d} puts him back without asking the flat, the landlord or Keith.'],
        ['judge', 'Keith keeps the coffin. {p} and {d} share the mint for a fortnight, in shifts.'],
        ['narrator', '(In the coffin, something that might be a satisfied sigh.)']
      ], [
        ['judge', 'Neither of you behaved. {p} treated a tenant like a parcel, and {d} treated him like a hobby.'],
        ['judge', 'Keith’s rent is halved, his deposit is returned, and the raisin shelf is to be wiped.'],
        ['bailiff', 'He has asked whether the sock drawer is still free, Your Honour. For his cousin.']
      ])
    },
    hallway: {
      p: [
        'I regret nothing. I did the paperwork. It was mostly in raisins.',
        'It was the smiley faces that did it. I will never use a smiley face again.',
        'I am converting the sock drawer into a studio flat. Premium. Views of the socks.'
      ],
      d: [
        'I have started a tenants’ union. Keith is chair. He has not spoken, but the vote was unanimous.',
        'Keith sent me a raisin as a thank-you. It is the nicest thing a corpse has ever given me.',
        'I am checking every mint on this shelf. There could be more Keiths.'
      ]
    }
  }],

  /* ---------- 1. The Snoring: defendant becomes both ---------- */
  'snoring-wall': [{
    id: 'sleep-sounds',
    title: 'Pemberton, Side B',
    truth: 'both',
    turn: alt([
      ['narrator', '(Somewhere in the gallery, a ghost whispers to its neighbour: “Is this the one with the wall?” The neighbour nods and checks its pocket.)'],
      ['judge', 'Why is everyone in the gallery holding a small plastic box?'],
      ['bailiff', 'It is for the snoring, Your Honour. They say it helps.']
    ], [
      ['bailiff', 'Your Honour, I have noticed that every ghost in the gallery is wearing the same little headphones.'],
      ['judge', 'They are dead, Bailiff. What would they be listening to?'],
      ['bailiff', 'The case, sir. I imagine. In advance.']
    ]),
    questions: {
      0: {
        clue: 'The snoring was worst the night {d} was at the vet. {p} stayed up all night snoring back at the wall.',
        lines: alt([
          ['p', 'The night {d} was at the vet, the snoring was the worst it has ever been.'],
          ['judge', 'And what were you doing, {p}?'],
          ['p', 'Snoring back. Somebody had to show it how it sounds.'],
          ['judge', 'So you held a duet with a wall, in the dark, alone.'],
          ['p', 'It started it.']
        ], [
          ['p', 'Last Tuesday I thought, finally, with {d} at the vet. Peace. Then it started up like a drain with a grudge.'],
          ['judge', 'And you?'],
          ['p', 'I gave it a taste of its own medicine, Your Honour. Eight hours. I was hoarse by Wednesday.'],
          ['judge', 'You were not giving it medicine. You were giving it encores.']
        ])
      },
      1: {
        clue: 'A microphone is hidden in the skirting board, wired to {d}’s slot. The wall snores for two souls a tape.',
        lines: alt([
          ['narrator', '(The bailiff presses his ear to the wall. The wall snores. The bailiff finds a tiny microphone in the skirting board and holds it up, very proudly.)'],
          ['bailiff', 'Your Honour, the wall is wearing a wire.'],
          ['judge', 'Where does the wire go, Bailiff?'],
          ['bailiff', 'Into {d}’s slot, sir. I believe the wall has been turned.']
        ], [
          ['bailiff', '(ear to the wall) It is snoring, Your Honour. And ticking.'],
          ['judge', 'Ticking?'],
          ['bailiff', 'A tape recorder, sir, in the skirting board. The label says “PEMBERTON, SLEEP SOUNDS, VOL. 3. TWO SOULS.”'],
          ['judge', '{d}. Is this yours?'],
          ['d', 'It is a hobby. A very busy hobby.']
        ])
      },
      3: {
        clue: '{d} sleeps in silence, wearing headphones that play the wall’s snore. {d} has known all along it was the wall.',
        lines: alt([
          ['narrator', '({d} lies down on the podium, crosses its arms, and slips on a pair of headphones. A very small snore leaks out of them.)'],
          ['judge', 'Not a sound, except the one in your ears.'],
          ['d', 'It helps me drift off.'],
          ['p', 'IT HAS BEEN LISTENING TO IT THE WHOLE TIME.']
        ], [
          ['narrator', '({d} lies down, crosses its arms, and puts on a sleeping mask that says “PEMBERTON, SIDE B”.)'],
          ['bailiff', 'Your Honour, I have heard louder coffins.'],
          ['judge', 'It is wearing the snore, Bailiff. Look at the mask.'],
          ['p', 'IT KNEW. IT HAD THE MASK. IT KNEW.']
        ])
      },
      4: {
        lines: alt([
          ['p', 'It goes HNNNRRK. Shhhwww. HNNNRRK. And then, sometimes, “Margaret”.'],
          ['audience', '(A ghost in the third row stands up: “THAT IS THE SECOND MOVEMENT. I HAVE THAT ON TAPE.” Four more ghosts nod.)'],
          ['p', 'WHY DO YOU HAVE IT ON TAPE?']
        ], [
          ['narrator', '({p} closes its eyes and does the snore. It is long and wet, with three movements, and a bit in the middle where it seems to drown.)'],
          ['judge', 'You have rehearsed that.'],
          ['p', 'Every night, Your Honour. I do it back at the wall, so it knows how it sounds.'],
          ['audience', '(A ghost at the back whispers: “Side A.”)']
        ])
      },
      5: {
        lines: alt([
          ['judge', 'Wall. Did you snore?'],
          ['narrator', '(Silence. Then the wall snores, and murmurs, quite clearly: “Margaret. Is the tape running?”)'],
          ['judge', 'Nobody answer him.']
        ], [
          ['judge', 'Wall. You are under oath. Did you snore?'],
          ['narrator', '(A long pause. The wall snores so hard that a little plaster comes down on {p}. Then, drowsily: “Royalties.”)'],
          ['judge', 'He is entitled.']
        ])
      }
    },
    rulings: {
      both: alt([
        ['judge', 'You are both guilty. {p} has spent a month duetting with a dead man in a wall and blaming the neighbour. {d} has spent the same month selling him to the gallery at two souls a tape, and saying nothing.'],
        ['judge', '{p} stops encoring. {d} burns the tapes and buys the wall a Margaret.'],
        ['audience', '(A ghost at the back, quietly: “Not Volume Three.”)']
      ], [
        ['judge', 'You are both at fault. {p} kept a wall awake by singing at it, and {d} kept a wall on sale by letting {p} take the blame.'],
        ['judge', 'Mr Pemberton is moved to a quieter wall and paid a proper share. Both of you will sleep tonight in the drawer, together, in silence.'],
        ['narrator', '(From the drawer, a very small snore. It is {p}. {d} has the tape running.)']
      ]),
      plaintiff: alt([
        ['judge', 'Judgment for {p}. {d} sells the wall by the tape, lets {p} think it is going mad, and sleeps like a lid. It is the most restful crime I have ever tried.'],
        ['judge', '{d} hands over the tapes and the microphone. Bailiff, collect the tapes.'],
        ['bailiff', 'There are only nine, Your Honour. The gallery has the rest.']
      ], [
        ['judge', 'Judgment for {p}. {d} knew it was the wall and let {p} blame itself for a month. That is not sleeping. That is conspiracy in pyjamas.'],
        ['p', 'And the snoring I did back?'],
        ['judge', 'We will return to that when you are rested. Or never.']
      ]),
      defendant: alt([
        ['judge', 'Judgment for {d}, who has never snored and has said so in front of a tomb. {p} has duetted with a wall for a month and cannot be allowed to sue the neighbour for the encores.'],
        ['judge', 'The tapes are a matter for another court. I own Volume Two myself. It is how I sleep.'],
        ['narrator', '(The judge’s jaw trembles. He appears to be thinking of Side B.)']
      ], [
        ['judge', 'Judgment for {d}, who sleeps in silence. {p} sang to a wall every night and then complained about the volume.'],
        ['p', 'THERE ARE TAPES.'],
        ['judge', 'There are always tapes, {p}. This court has simply chosen not to hear them.']
      ])
    },
    hallway: {
      p: [
        'I sang to that wall for a month and it was a DUET. I have never been so embarrassed.',
        'I am going to apologise to Mr Pemberton. Then I am going to snore at him. Politely.',
        'There is a Side B? Where do I get Side B?'
      ],
      d: [
        'Sleep Sounds Volume Four is out on Friday. The wall is on the cover.',
        'I would like to thank the wall, and Margaret, who does not exist.',
        'No comment. The comment is available on cassette, two souls.'
      ]
    }
  }],

  /* ---------- 2. The Warm Slot: both becomes plaintiff ---------- */
  'stolen-slot': [{
    id: 'next-of-kin',
    title: 'Closest, Honestly',
    truth: 'plaintiff',
    turn: alt([
      ['bailiff', 'Your Honour, before we begin: {p} has brought its own bucket to court. {d} has brought one too.'],
      ['judge', 'Why would anyone bring a bucket to a hearing about a bucket?'],
      ['bailiff', 'I believe it is for comparison, sir. {d} has put its bucket behind its back.']
    ], [
      ['narrator', '(The bailiff carries a tin bucket to the evidence table and sets it down. {d} looks at the ceiling and begins to whistle.)'],
      ['judge', 'Whose is that, Bailiff?'],
      ['bailiff', 'It was found outside {p}’s slot, sir. Nobody has claimed it. {d} would like it known that it has not claimed it.']
    ]),
    questions: {
      0: {
        clue: '{d} wrote itself in as {p}’s next of kin the morning of the bucket, then “checked” the register and found itself.',
        lines: alt([
          ['d', 'Nobody said. I saw a bucket outside the slot and I put two and two together.'],
          ['judge', 'You told us you were next of kin. You said you checked.'],
          ['bailiff', 'Shelf register, Your Honour. Next of kin for {p}: {d}. Entered the morning of the bucket. Under “relationship” it says “closest, honestly”.'],
          ['d', 'I did check. I checked it very carefully, with a pen.']
        ], [
          ['d', 'Me, Your Honour. I saw the bucket and declared {p} dead.'],
          ['judge', 'Did you consult a doctor? The register?'],
          ['bailiff', 'The register has {d} down as next of kin since the morning of the bucket, Your Honour. In {d}’s hand. With a little flourish on the D.'],
          ['d', 'The flourish is sincere.']
        ])
      },
      1: {
        clue: 'Shelf records: {p} has held that slot nine years. {d} lives by the draught and has applied for the warm slot four times.',
        lines: alt([
          ['p', 'Mine. Since the beginning of time.'],
          ['bailiff', 'Shelf records, Your Honour. {p}: nine years in that slot. {d}: nine years in the slot by the draught.'],
          ['judge', 'Has {d} ever applied for a transfer?'],
          ['bailiff', 'Four times, sir. The reason given each time is “warm”.']
        ], [
          ['p', 'Mine, Your Honour. Ask anybody.'],
          ['d', 'Mine until the spring, Your Honour. I was out ill in a bucket and when I came back {p} had taken it.'],
          ['bailiff', 'Shelf records show {d} has never been ill, Your Honour, nor in a bucket, nor in that slot before this month.'],
          ['d', 'I was ill in spirit.']
        ])
      },
      4: {
        clue: 'The bucket {d} saw was tin with a dent and a flourished “D” on the base. {p}’s bucket is blue, with a lid.',
        lines: alt([
          ['p', 'Blue. Deep. A proper lid. I had it with me the whole time, Your Honour. It is under the witness box.'],
          ['judge', 'And the bucket outside your slot, the one {d} saw?'],
          ['p', 'Never seen it. Tin. Dented.'],
          ['d', 'THAT DENT IS SENTIMENTAL.']
        ], [
          ['p', 'Blue, Your Honour. A handle that does not squeak. I took it with me, and I have not been apart from it since.'],
          ['judge', 'Then whose bucket was outside your slot?'],
          ['bailiff', 'Tin, sir. Dented. There is a “D” scratched in the base, with a flourish.'],
          ['d', 'THAT FLOURISH IS SENTIMENTAL.']
        ])
      }
    },
    rulings: {
      plaintiff: alt([
        ['judge', 'Judgment for {p}. {d} left its own bucket outside {p}’s slot, wrote itself in as next of kin, announced a death and moved in before the death was dry.'],
        ['judge', '“Which vultures?”, you were asked. “Me”, you said. The court admires a confession, even a proud one. The slot goes back, and {d} goes back to the draught.'],
        ['d', 'May I keep the bucket?'],
        ['judge', 'It is yours. It has a dent.']
      ], [
        ['judge', 'Judgment for {p}. A man who declares you dead on the strength of his own bucket has not mistaken anything. He has planned a funeral.'],
        ['judge', '{d} returns the slot, the smell, and the register entry, which {d} will eat, slowly, in front of the jury.'],
        ['d', 'It has a flourish on it.'],
        ['judge', 'Then it will go down in style.']
      ]),
      defendant: alt([
        ['judge', 'Judgment for {d}. Under shelf law a slot left empty for a full afternoon is a vacancy, and I hate it as much as you do.'],
        ['judge', 'The court notes the register, the tin bucket and the flourish, and does nothing about any of them.'],
        ['p', 'THAT IS IT?'],
        ['judge', 'It is a plank, {p}.']
      ], [
        ['judge', 'Judgment for {d}. {p} left the slot, the slot was taken, and I am told that is how slots work.'],
        ['judge', 'I was buried in a box with a better argument than that, and I did not fight it. Next time, {p}, take the slot into the bucket with you.'],
        ['p', 'IT HAD A DENT.'],
        ['judge', 'So did the box.']
      ]),
      both: alt([
        ['judge', 'You are both vultures. {p} gets ill where people can see it, and {d} writes itself into registers.'],
        ['judge', 'Alternate days. The register is burned and the bucket goes to the bailiff.'],
        ['bailiff', 'I will treasure it, Your Honour. I have always wanted a dent.']
      ], [
        ['judge', 'You are both small, and so is the slot. One of you was careless with a bucket and the other one was careful with a pen.'],
        ['judge', 'Share the slot. Share the draught. Share the bucket, if you must. I will not hear a word about it.'],
        ['audience', '(Somebody at the back shouts “THE BUCKET”. It is, once again, a chant.)']
      ])
    },
    hallway: {
      p: [
        'I’m going back to the slot. It still smells of me. It also smells of a very small tin.',
        'I’ve changed the register. Next of kin: the wall. The wall can’t be bribed. It snores through everything.',
        'I sat in my slot for three hours. It is still warm. It is warm from {d}’s guilt.'
      ],
      d: [
        'The draught is not so bad. It builds character. It builds a cough.',
        'I never said {p} was dead. I said “passed on”. Which it did. To the privy.',
        'I’m applying for the warm slot again. Fifth time. Reason given: “warm”.'
      ]
    }
  }],

  /* ---------- 3. The Early Eulogy: plaintiff becomes defendant ---------- */
  'early-eulogy': [{
    id: 'the-brief',
    title: 'Mostly Fine, As Ordered',
    truth: 'defendant',
    turn: alt([
      ['bailiff', 'Your Honour, {d} has handed up a document. It is a brief. It is eleven pages long and it has a salad stain on page one.'],
      ['judge', 'Who briefed {d}?'],
      ['bailiff', 'It does not say, sir. But there are arrows, and a diagram of a salad.']
    ], [
      ['narrator', '(The bailiff holds a booking form up to the light. There is a thumbprint in the corner. He sniffs it.)'],
      ['bailiff', 'Vinaigrette, Your Honour.'],
      ['judge', 'Bailiff, you cannot identify a suspect by smell.'],
      ['bailiff', 'It is a very specific vinaigrette, sir.']
    ]),
    questions: {
      0: {
        clue: '{p} told {d} to carry on even if it waved. Item six on the brief, in {p}’s handwriting, above “do not look at the salad”.',
        lines: alt([
          ['d', 'I did, Your Honour. Front row. Salad. Waving.'],
          ['judge', 'And you kept going.'],
          ['d', 'Item six of the brief. “Carry on even if I wave. Do not look at the salad.”'],
          ['judge', 'Who wrote that?'],
          ['p', 'A thoughtful person.']
        ], [
          ['d', 'I saw it, Your Honour. Front row. Salad. Very much alive, and very much a paying customer.'],
          ['p', 'I WAVED.'],
          ['d', 'It is in the contract, Your Honour. “If client waves, proceed. If client weeps, proceed louder.” The client wept at “a bit much”.'],
          ['p', 'THAT WAS THE SALAD. IT HAD ONIONS.']
        ])
      },
      1: {
        clue: '{p} commissioned the eulogy for three souls, due at the graveside. {p} paid two and sued over the third.',
        lines: alt([
          ['d', '“{p} was here. Now {p} is not, in theory. {p} was mostly fine. {p} was a bit much. {p} has paid two souls, and is, as of this sentence, one short.”'],
          ['judge', 'You invoiced at a graveside.'],
          ['d', 'It is where the client is most emotional, Your Honour.'],
          ['p', 'I WAS GOING TO PAY IT WHEN I WAS DEAD.']
        ], [
          ['d', '“{p} will be missed, by some. {p} leaves behind a salad, a cake, and an invoice for three souls, payable in the dish by the door. Two have been received.”'],
          ['judge', 'You read your own invoice into the eulogy.'],
          ['d', 'It was in the brief, Your Honour. “Honest. Itemised.”'],
          ['p', 'I PUT TWO IN THE DISH. THE THIRD IS FOR WHEN IT GETS GOOD.']
        ])
      },
      3: {
        clue: 'The funeral was booked by {p}. The form is signed “the deceased, in advance” and has a vinaigrette thumbprint.',
        lines: alt([
          ['p', 'I do not know. Somebody saw me lying very still and started booking things.'],
          ['bailiff', 'The form, Your Honour. Hall, hymns, one cake, one salad, signed “the deceased, in advance”. There is a thumbprint in vinaigrette.'],
          ['p', 'Anyone could have vinaigrette.'],
          ['judge', 'Only one person brought a salad, {p}.']
        ], [
          ['bailiff', 'Booked by {p}, Your Honour. Hall, hymns, one cake, one eulogy, one salad. Under “cause of death” it says “TBC”.'],
          ['judge', 'You booked your own funeral, {p}.'],
          ['p', 'It was a rehearsal. For when it is real. I wanted to see how it went.'],
          ['d', 'It went mostly fine, Your Honour.']
        ])
      },
      4: {
        lines: alt([
          ['d', 'I took them home. {p} bought them, and the card is in {p}’s own hand.'],
          ['judge', 'What does the card say?'],
          ['d', '“To me, from everyone. You deserved this.”'],
          ['p', 'Everyone was SUPPOSED to sign it.']
        ], [
          ['d', 'They are in a jar, Your Honour. Lilies, not too many. Those were the instructions.'],
          ['judge', 'Whose instructions?'],
          ['d', 'The deceased’s. There was a diagram. It had arrows.'],
          ['p', 'THE ARROWS WERE FOR THE VASE.']
        ])
      }
    },
    rulings: {
      defendant: alt([
        ['judge', 'Judgment for {d}. {p} commissioned an honest eulogy, received an honest eulogy, and sued over the honesty. The booking form is stained with vinaigrette. This court knows a salad thumb when it sees one.'],
        ['judge', '{p} pays the third soul, and {d} keeps the flowers and the card. “You deserved this.” I think we can all agree.'],
        ['p', 'I WANTED TWENTY PERCENT MORE ADJECTIVES.'],
        ['judge', 'Then you should have paid for adjectives.']
      ], [
        ['judge', 'Judgment for {d}. A resident who books its own funeral, waves from the front row and weeps at the review has no case. It has a salad.'],
        ['judge', '{p} pays the third soul. {d} will give a second eulogy, longer, with adjectives, at {p}’s real funeral, which the court has taken the liberty of booking.'],
        ['p', 'WHEN?'],
        ['judge', 'Does it matter?']
      ]),
      plaintiff: alt([
        ['judge', 'Judgment for {p}. A eulogy may be honest. It may not be honest at that volume, at that length, or in front of a cake.'],
        ['judge', '{d} will write a nicer one. The court has read the brief, and the brief did say “honest”, and the court is overruling the brief on grounds of taste.'],
        ['d', 'You cannot overrule a brief.'],
        ['judge', 'I have been dead three hundred years. I can overrule anything.']
      ], [
        ['judge', 'Judgment for {p}. {d} will give {p} a second funeral, with a kinder speech and a bigger cake.'],
        ['judge', 'The court notes the vinaigrette on the booking form, and says nothing about it, out of respect for the salad.']
      ]),
      both: alt([
        ['judge', 'You are both undertakers of the wrong thing. {p} arranges a funeral to see who cries. {d} arranges a bill to see who pays.'],
        ['judge', 'Both of you will attend the next real funeral as guests. Sit at the back. Bring nothing green.']
      ], [
        ['judge', 'Neither of you is dead and both of you are trying. {p} pays the soul. {d} refunds the adjectives it left out.'],
        ['judge', 'The cake goes to the moth, who has been in the rafters since the hymns.'],
        ['npc', 'It was a very good hymn.', 'moth']
      ])
    },
    hallway: {
      p: [
        'I’m getting a second opinion. A longer one. With adjectives.',
        'I paid two souls for “mostly fine”. I want a refund on the “mostly”.',
        'I’m framing the vinaigrette. It was the best thing in the room.'
      ],
      d: [
        'Two out of three souls and a jar of lilies. A good day for an honest man.',
        'I’m starting a service. Honest eulogies, living clients only. Salad optional.',
        'The moth cried at “a bit much”. That is my five-star review.'
      ]
    }
  }],

  /* ---------- 4. The Haunted Sock: defendant becomes both ---------- */
  'haunted-sock': [{
    id: 'dear-diary',
    title: 'Dear Diary, Wrong',
    truth: 'both',
    turn: alt([
      ['narrator', '(The jar on the evidence table whispers something. The bailiff leans in, nods gravely, and writes it down.)'],
      ['judge', 'What did it say, Bailiff?'],
      ['bailiff', '“Dear Diary.” I do not know who Diary is, Your Honour, but the sock is very fond of him.']
    ], [
      ['bailiff', 'Your Honour, a small leather book has just fallen out of the sock. The sock is trying to hide it with its toe.'],
      ['judge', 'What is it?'],
      ['bailiff', 'I have not opened it, sir. But it says DO NOT READ on the front, so I assume it is the evidence.']
    ]),
    questions: {
      1: {
        clue: 'The sock’s “wrong” is a book review. It was reading {p}’s diary, which {p} left tucked inside it when it lent it out.',
        lines: alt([
          ['judge', 'Sock. Why do you keep saying “wrong”?'],
          ['narrator', '(The sock presses itself to the glass and whispers: “March the fourth. ‘I was right about the raisins.’ …Wrong.”)'],
          ['narrator', '(A corner of a small leather diary slides out of the sock. It is labelled “DIARY OF {p}. PRIVATE. DO NOT READ.”)'],
          ['p', 'THAT WAS IN THE SOCK FOR SAFEKEEPING.']
        ], [
          ['narrator', '(The bailiff holds up the jar. The sock whispers, in a voice very like {d}’s: “Dear Diary. Today {p} was right again. Smug.” Then, in its own: “Wrong.”)'],
          ['judge', 'It is quoting {p}’s diary.'],
          ['p', 'It is in a SOCK. Nobody looks in a sock.'],
          ['judge', 'The sock looked.']
        ])
      },
      2: {
        clue: '{d} found {p}’s diary in the sock and read it aloud to the sock every night, doing the voices and taking requests.',
        lines: alt([
          ['d', 'Warm water on Sundays. Its own egg cup. And a bedtime story every night.'],
          ['judge', 'What story?'],
          ['d', 'A real page-turner. A resident who is always right about the raisins. I do the voices.'],
          ['p', 'THAT IS MY DIARY.'],
          ['d', 'It was in the sock, Your Honour. A sock is a public place.']
        ], [
          ['d', 'I wore it, I sang to it, and I read to it, Your Honour. It has no eyes, so somebody had to.'],
          ['judge', 'Read what?'],
          ['d', 'Whatever was in the sock. A lovely little book. Very confessional. The sock cried at March the fourth.'],
          ['p', 'WHAT HAPPENED ON MARCH THE FOURTH? I CAN NEVER REMEMBER WHAT I PUT IN THERE.']
        ])
      },
      5: {
        lines: alt([
          ['p', 'I do not care about the sock. I want what was in the sock.'],
          ['judge', 'And what was in the sock?'],
          ['p', 'Nothing. Nothing at all.'],
          ['narrator', '(From the jar, a whisper: “Dear Diary.” From the bottom drawer, across the shelf, forty tiny voices: “Wrong.”)'],
          ['p', 'THEY HAVE ALL READ IT.']
        ], [
          ['p', 'I want it to stop reading me back to myself.'],
          ['judge', 'Is it accurate?'],
          ['p', 'It is DEVASTATINGLY accurate.'],
          ['narrator', '(From the jar, a whisper: “Wrong.” From the bottom drawer, across the shelf, forty tiny voices: “Wrong.”)'],
          ['p', 'THEY ARE REVIEWING ME.']
        ])
      }
    },
    rulings: {
      both: alt([
        ['judge', 'You are both at fault. {p} lent out a haunted sock with a diary in it. {d} read the diary to the sock like a bedtime story. Two crimes, one sock, and the sock was only the audience.'],
        ['judge', 'The diary goes back to {p}, unread. The sock goes back in the drawer, and the sock gets the last word.'],
        ['narrator', '(The sock whispers “wrong”. For once, the entire court agrees.)']
      ], [
        ['judge', 'You are both in the wrong. {p} keeps a diary in a haunted sock, which is like keeping it in a courtroom. {d} reads other people’s diaries aloud to footwear.'],
        ['judge', 'The sock is released on its own recognisance. The diary is sealed until {p} is mostly dead.'],
        ['bailiff', 'I have not read it, Your Honour. Page nineteen is very good.']
      ]),
      plaintiff: alt([
        ['judge', 'Judgment for {p}. {d} borrowed a sock, found a diary inside it, and read it aloud, in voices. That is a violation of both privacy and footwear.'],
        ['judge', '{d} returns the sock, the diary and the egg cup, and writes the sock an apology. The sock will mark it.'],
        ['narrator', '(The sock whispers “wrong”. It is a very tough marker.)']
      ], [
        ['judge', 'Judgment for {p}. A diary is a diary, even in a sock, and a sock is a sock, even in a book club.'],
        ['judge', '{d} will return everything, and will never again do a voice for anything that has no mouth.'],
        ['d', 'The sock was very good at listening.'],
        ['judge', 'So are gossips. That is the problem.']
      ]),
      defendant: alt([
        ['judge', 'Judgment for {d}. The sock was haunted before it left the drawer and {p} knew. {p} then hid its own diary inside it, which is like hiding a secret with a gossip.'],
        ['p', 'SO THE READING IS FINE?'],
        ['judge', 'The reading is a matter for the sock.']
      ], [
        ['judge', 'Judgment for {d}. {p} lent out a cursed sock with its own diary in it and now wants damages for what the sock said. That is leaving a cake in a wasps’ nest and suing the wasp.'],
        ['p', 'But it READ it.'],
        ['judge', 'It lives in a sock, {p}. It had very little else to do.']
      ])
    },
    hallway: {
      p: [
        'I have moved the diary into the other sock. They never talk to each other.',
        'The drawer knows everything now. I am going to be very polite to the drawer.',
        'I’ve started a new diary. The first page just says “wrong”. So that is done.'
      ],
      d: [
        'The sock and I have an understanding. I read, it reviews. Best book club I have ever been in.',
        'I regret nothing. Page nineteen was incredible.',
        'I’m getting the sock a friend. It can do the second half of the book.'
      ]
    }
  }],

  /* ---------- 5. The Portrait: both becomes plaintiff ---------- */
  'dead-portrait': [{
    id: 'after-hobbs',
    title: 'The Portrait of Somebody Else',
    truth: 'plaintiff',
    turn: alt([
      ['narrator', '(Behind the judge, the bailiff has been looking at the painting for some time. He tilts his head. He tilts it the other way.)'],
      ['bailiff', 'Your Honour, I feel I have seen that face before.'],
      ['judge', 'It is a painting of a corpse, Bailiff. They all look alike.']
    ], [
      ['narrator', '(The judge glances at the portrait on the easel. He glances away. He glances back, more slowly.)'],
      ['judge', 'Bailiff. Turn that painting a little to the left.'],
      ['bailiff', 'Like this, sir?'],
      ['judge', '…Not like that. Put it back.']
    ]),
    questions: {
      0: {
        herring: '{d} insists fourteen real flies attended the sitting, so it painted only what it saw. Unconfirmed.',
        lines: alt([
          ['p', 'No flies, Your Honour. None. Not one.'],
          ['d', 'Fourteen. For all six hours. They worked in shifts.'],
          ['judge', 'Can anyone confirm?'],
          ['bailiff', 'Fourteen flies are in the gallery today, sir. They say they were there. They also say they were at a funeral in 1702, so I am treating them with caution.']
        ], [
          ['p', 'No flies, Your Honour. Not one.'],
          ['d', 'Fourteen, Your Honour, for all six hours. They worked in shifts. Very professional. I got to know them by name.'],
          ['judge', 'Which names?'],
          ['d', 'Gerald. Beryl. Gerald again. A lot of Geralds.']
        ])
      },
      1: {
        clue: '{d} took up painting on Tuesday, the day a crate marked JUDGE’S EFFECTS went missing from the cellar.',
        lines: alt([
          ['d', 'Since Tuesday. I am a natural.'],
          ['bailiff', 'Cellar log, Your Honour. On Tuesday afternoon one crate, marked JUDGE’S EFFECTS, was removed. Contents: assorted tubes of grey.'],
          ['judge', 'What a coincidence.'],
          ['d', 'Tuesday is a busy day for crates.']
        ], [
          ['d', 'All my life, Your Honour. Since Tuesday.'],
          ['judge', 'And what happened on Tuesday?'],
          ['d', 'I saw a crate. In a cellar. It spoke to me.'],
          ['judge', 'Crates do not speak.'],
          ['d', 'This one said “JUDGE’S EFFECTS”, very clearly. I felt called.']
        ])
      },
      2: {
        lines: alt([
          ['p', 'Twelve souls.'],
          ['d', 'Eleven for the portrait. One for the flies.'],
          ['judge', 'Eleven and one. I paid exactly that, once. In 1702. I cannot think why that is coming back to me.']
        ], [
          ['p', 'Twelve souls, Your Honour. Eleven for the portrait, one for the flies.'],
          ['judge', 'Why did the flies cost extra, {d}?'],
          ['d', 'They were part of the original.'],
          ['judge', 'The original what?'],
          ['d', 'Concept.']
        ])
      },
      3: {
        clue: 'The “portrait” is Judge Mortis’s own 1702 funeral portrait, by Hobbs. {d} traced it and swapped the name card for {p}’s.',
        lines: alt([
          ['narrator', '(The bailiff turns the painting round. A gasp runs through the gallery. In the front row, every ghost takes off its hat.)'],
          ['audience', '(A voice from the back: “IT’S THE JUDGE.”)'],
          ['judge', 'It is not the judge. It is a… that is my funeral portrait. That is Hobbs, 1702. Those are MY flies.'],
          ['bailiff', 'Fourteen, sir. They are named in the corner. Gerald, Beryl, and the twelve cousins.']
        ], [
          ['narrator', '(The bailiff turns the painting round. The audience goes very quiet. In the back row, a ghost stands, puts a hand over where its heart used to be, and hums two bars of a hymn.)'],
          ['bailiff', 'There is a tiny plaque on the frame, Your Honour. “After Hobbs, 1702. Judge Mortis, lying in state.” {d} has stuck {p}’s name over it, but the glue is bad.'],
          ['judge', 'Those are my cheekbones. That is my jaw. I would know it anywhere. I have been carrying it around for three hundred years.']
        ])
      },
      4: {
        sass: true,
        lines: alt([
          ['judge', '{p}, that painting is flattering. The cheekbones alone. I could look at them all day.'],
          ['p', 'IT IS A SKULL.'],
          ['judge', 'A distinguished one. Whoever sat for that had a very strong jaw.']
        ], [
          ['judge', '{p}, I have been dead three hundred years and I know a good skull. That one has a lovely brow ridge. Excellent hinge.'],
          ['p', 'THE HINGE IS NOT THE POINT.'],
          ['judge', 'The hinge is always the point.']
        ])
      },
      5: {
        clue: '{d} never once looked at {p}’s face. It kept glancing at a card up its sleeve.',
        lines: alt([
          ['p', 'Perfectly still. Six hours. I barely blinked, and it never once looked at me.'],
          ['judge', 'You never looked at your subject, {d}?'],
          ['d', 'I have a method. I look at the sleeve, I look at the canvas, I never look at the sitter.'],
          ['judge', 'What is up the sleeve?'],
          ['d', 'Reference.']
        ], [
          ['p', 'Like a statue, Your Honour. And every few seconds it looked up its sleeve, like a man checking a watch.'],
          ['d', 'It is a very long watch.'],
          ['bailiff', 'There is a card up the sleeve, Your Honour. Small. It says, “skull, flies, look serious”.'],
          ['d', 'Everyone has a note to self.']
        ])
      }
    },
    rulings: {
      plaintiff: alt([
        ['judge', 'Judgment for {p}. {d} did not paint a portrait. {d} found a crate marked JUDGE’S EFFECTS and charged twelve souls for my funeral portrait, with my flies in it.'],
        ['judge', 'Eleven for the portrait and one for the flies, exactly what Hobbs charged. Even the prices were copied. {d} refunds {p} in full and returns my jaw to its crate.'],
        ['d', 'It was a very good likeness.'],
        ['judge', 'It was an excellent likeness. That is why I am taking it personally.']
      ], [
        ['judge', 'Judgment for {p}. {p} sat for six hours and was painted as somebody else, three hundred years dead, with somebody else’s flies. That is not realism. That is a clerical error with a brush.'],
        ['judge', '{d} refunds the lot. The portrait comes to my chambers, where I will be examining the cheekbones.'],
        ['p', 'WHAT ABOUT MINE?'],
        ['judge', 'Yours were never in it.']
      ]),
      defendant: alt([
        ['judge', 'Judgment for {d}. {p} sat still, with flies, and received a portrait of precisely that. It is accurate.'],
        ['judge', 'The court has noticed that the portrait looks suspiciously like the court, and in the interests of dignity declines to say so.'],
        ['p', 'IT IS A PICTURE OF YOU.'],
        ['judge', 'It is a picture of a distinguished skull. I will hear nothing further.']
      ], [
        ['judge', 'Judgment for {d}. An artist paints what he sees. If he sees a skull and a Hobbs, that is between him and Hobbs, and Hobbs is dead.'],
        ['p', 'HOBBS IS NOT THE POINT.'],
        ['judge', 'Hobbs is always the point. Hobbs did my coffin.']
      ]),
      both: alt([
        ['judge', 'You are both to blame. {p} posed like a corpse, and {d} charged for a corpse that was not even {p}.'],
        ['judge', 'Half refund. The portrait hangs in my chambers, where it belongs.']
      ], [
        ['judge', 'Neither of you has the faintest idea what a portrait is. {p} did not ask whose face it was. {d} did not say.'],
        ['judge', 'The flies take custody. They have the strongest claim. They were there first.']
      ])
    },
    hallway: {
      p: [
        'I’ve asked the judge for a sitting. If I’m going to be mistaken for someone, it might as well be a person with presence.',
        'I sat for six hours and was painted as a man who died in 1702. I have never felt so seen.',
        'I’m hiring the spider. It does portraits. At least it paints what it eats.'
      ],
      d: [
        'Hobbs would be proud. Hobbs would also like his easel back.',
        'It was a homage. Art is just theft with better lighting.',
        'Twelve souls for a tracing. I’m thinking of tracing a few more. Is the bailiff free?'
      ]
    }
  }],

  /* ---------- 6. The Tooth Fairy Job: both becomes plaintiff ---------- */
  'tooth-fairy': [{
    id: 'gift-tag',
    title: 'NOT UNCLE’S, In Capitals',
    truth: 'plaintiff',
    turn: alt([
      ['narrator', '(In the gallery, Uncle stands up, opens his mouth to speak, and thinks better of it. He sits. He stands again.)'],
      ['judge', 'Do you wish to say something, Uncle?'],
      ['npc', 'NOT YET. I AM GATHERING MY THOUGHTS. THEY ARE IN A JAR.', 'uncle']
    ], [
      ['bailiff', 'Your Honour, there is a jar on the evidence table. The label says “NOT UNCLE’S”, underlined three times.'],
      ['judge', 'Then it is clearly Uncle’s.'],
      ['bailiff', 'That is what everyone says, sir. Uncle says it means the opposite.']
    ]),
    questions: {
      0: {
        clue: 'Uncle wrote NOT UNCLE’S on the jar because he was giving the teeth to {p}. The jar is the gift tag.',
        lines: alt([
          ['p', 'A jar. It says “NOT UNCLE’S”.'],
          ['judge', 'In handwriting that is very obviously Uncle’s.'],
          ['p', 'Yes, Your Honour. That is how you know he meant it.'],
          ['npc', 'I GAVE THEM TO {p}. THE JAR IS THE GIFT TAG. I WROTE “NOT UNCLE’S” IN CAPITALS. WHAT MORE DOES A MAN HAVE TO DO.', 'uncle']
        ], [
          ['p', 'Out of a jar marked “NOT UNCLE’S”, Your Honour. Handed to me by Uncle himself.'],
          ['judge', 'Why would Uncle hand you his teeth?'],
          ['npc', 'THEY RATTLED. I COULD NOT SLEEP. I WANTED THEM IN SOMEBODY WITH A TIN.', 'uncle'],
          ['judge', 'And the label?'],
          ['npc', 'IT IS NOT A DISGUISE. IT IS A GIFT TAG. I USED CAPITALS.', 'uncle']
        ])
      },
      3: {
        clue: 'Uncle gave {p} the teeth, with a postcard and his own lettering on the tin. {d} sold them anyway.',
        lines: alt([
          ['p', 'They were mine from the moment Uncle put them in my hand. I have the postcard.'],
          ['judge', 'Read it.'],
          ['p', '“Dear {p}. Teeth enclosed. Yours, not mine. Love, U.”'],
          ['d', 'I read it, Your Honour. “Yours, not mine.” Nobody was using them.']
        ], [
          ['judge', 'Were those teeth ever yours, {p}?'],
          ['p', 'Since last Whitsun, Your Honour. Uncle gave them to me, with a postcard. I keep them in the tin. The lettering on the tin is his too.'],
          ['npc', 'IT TOOK ME THREE WEEKS.', 'uncle'],
          ['d', 'Nobody told me they were GIFTS. They looked like inventory.']
        ])
      },
      4: {
        clue: 'The fairy paid on Uncle’s postcard, which {d} said was its own. {d} told her “{p}” was a pen name.',
        lines: alt([
          ['narrator', '(The tooth fairy is led in. She is the size of a thumb and has the eyes of someone who has seen too many pillows.)'],
          ['narrator', '(The fairy: “I pay on proof of title. The seller showed me a postcard that said ‘Teeth enclosed. Yours, not mine.’ I asked who {p} was. The seller said it was a pen name.”)'],
          ['judge', 'And you believed that?'],
          ['narrator', '(The fairy: “I believe everything. It is the only way to stay in this job.”)']
        ], [
          ['narrator', '(The tooth fairy is led in. She wears a cardigan and drags a sack that rattles when she breathes.)'],
          ['narrator', '(The fairy: “I never look at faces. I look at paperwork. The paperwork said the teeth were a gift to a {p}. The seller said that was a nickname.”)'],
          ['judge', 'A nickname for what?'],
          ['narrator', '(The fairy: “For the seller, Your Honour. It said everyone calls it that. Nobody has ever called it that.”)']
        ])
      }
    },
    rulings: {
      plaintiff: alt([
        ['judge', 'Judgment for {p}. “NOT UNCLE’S” is not a disguise. It is a gift tag in capitals, and the only people who misread gift tags are children and thieves.'],
        ['judge', '{d} pays ten souls, which is what a filling is worth, and apologises to the fairy in person. At night. While she is counting.'],
        ['npc', 'AND THE WISDOM TOOTH.', 'uncle'],
        ['judge', 'And the wisdom tooth, Uncle. We are not finished.']
      ], [
        ['judge', 'Judgment for {p}. Uncle gave the teeth. {p} kept them in a tin. {d} sold them to a fairy on a postcard it had no business reading.'],
        ['judge', '{d} will buy the teeth back from the fairy, at her price.'],
        ['d', 'What is her price?'],
        ['judge', 'Gums. She has been looking at yours since the hearing began.']
      ]),
      defendant: alt([
        ['judge', 'Judgment for {d}. A tooth in a tin is a tooth in a tin. If {p} wished to keep it, {p} should have kept it in {p}.'],
        ['p', 'UNCLE GAVE THEM TO ME.'],
        ['judge', 'Uncle gives everything to everyone. That is why he has no teeth.']
      ], [
        ['judge', 'Judgment for {d}. Finders keepers. The court has found the postcard, the jar and the lettering, and is keeping them.'],
        ['p', 'THAT IS THE WRONG WAY ROUND.'],
        ['judge', 'It is the only way round that I have.']
      ]),
      both: alt([
        ['judge', 'You are both small and toothless. {p} keeps teeth in a tin, and {d} sells what it is not given.'],
        ['judge', 'Everything goes back to Uncle, who will give it away again by Friday.'],
        ['npc', 'I WILL TRY.', 'uncle']
      ], [
        ['judge', 'You are both at fault. {p} for hoarding another man’s molars, and {d} for retailing them.'],
        ['judge', 'The fairy is to be informed. She will not be surprised. She has not been surprised since 1850.']
      ])
    },
    hallway: {
      p: [
        'I have a new tin. It says “MINE. A GIFT. FROM UNCLE.” Uncle did the lettering. It took him four weeks.',
        'Ten souls, a filling, and a hat I can’t see. I am a person of means.',
        'I am going to read every label on this shelf. Twice. Aloud. To {d}.'
      ],
      d: [
        'The postcard said “yours, not mine”. I interpreted it generously.',
        'The fairy offered me a job. I will not say what it involves.',
        'I would like it noted that the hat was worth it.'
      ]
    }
  }],

  /* ---------- 7. The Crayon Will: plaintiff becomes defendant ---------- */
  'crayon-will': [{
    id: 'sleepwriter',
    title: 'Everything, While Horizontal',
    truth: 'defendant',
    turn: alt([
      ['narrator', '({p} yawns. It is a huge yawn, very sudden. The bailiff, who has been watching it closely, writes something down.)'],
      ['judge', 'What did you write, Bailiff?'],
      ['bailiff', '“Yawns like a person who has been up all night.” I do not know what it means, sir, but I felt it should be on record.']
    ], [
      ['narrator', '(Under {p}’s chair, something small and purple rolls out and stops against the bailiff’s foot.)'],
      ['bailiff', 'Your Honour, {p} has dropped a crayon.'],
      ['p', 'That is not mine. I own a spoon.'],
      ['judge', 'It has your teeth marks on it, {p}.']
    ]),
    questions: {
      0: {
        clue: '{d} spells “everything” right. EVRYTHING, with the missing E, is scrawled forty times on {p}’s own walls in the same purple.',
        lines: alt([
          ['narrator', '({d} takes the purple crayon, writes EVERYTHING in neat capitals and dots the I with a heart. The judge counts the letters.)'],
          ['judge', 'Nine. The will says EVRYTHING. Eight.'],
          ['bailiff', 'Your Honour, I walked past {p}’s slot this morning. The wall says EVRYTHING, forty times, in the same purple.'],
          ['p', 'THAT IS DECORATION.']
        ], [
          ['narrator', '({d} grips the crayon in its fist and writes EVERYTHING. Then, out of habit, it draws a heart.)'],
          ['judge', 'It is spelled correctly. The will is not.'],
          ['bailiff', 'The wall in {p}’s slot is not spelled correctly either, sir. Neither is the pillowcase. Nor, I think, the moth.'],
          ['p', 'WHAT IS WRONG WITH THE MOTH?']
        ])
      },
      1: {
        clue: '{p} sleepwalks and sleepwrites every night in purple crayon. {d} has been following it round with a blanket.',
        lines: alt([
          ['p', 'No! I have never felt better. I sleep like a baby.'],
          ['d', 'Like a baby that draws, Your Honour. It sleepwalks. It sleepwrites. It once signed the moth.'],
          ['judge', 'Signed her?'],
          ['d', 'With a heart. She was very touched.'],
          ['p', 'I AM A HEAVY SLEEPER, NOT A WRITER.']
        ], [
          ['p', 'No, Your Honour. I have never felt better.'],
          ['d', 'It is not dying. It is sleeping. Loudly. With a crayon.'],
          ['judge', 'Sleeping with a crayon.'],
          ['d', 'It will not let go. I pry it out of its hand every morning. It says “everything” in its sleep, with the E missing.'],
          ['p', 'THAT IS A LIE. I SLEEP WITH THE SPOON.']
        ])
      },
      3: {
        clue: '{d}’s slot holds a night log: “{p} at the door, asleep, with a crayon. Walked it back to bed.” Eleven nights.',
        lines: alt([
          ['bailiff', 'Very little, Your Honour. A blanket, folded. One pencil. And a logbook, eleven entries, one per night.'],
          ['judge', 'Read one.'],
          ['bailiff', '“{p} was here again. Walked it back to bed. Crayon returned.” The last one just says “again”. It is underlined.']
        ], [
          ['bailiff', 'Nothing, Your Honour. A blanket, a torch and a logbook. Every entry: “3 a.m. {p} at the door, asleep, holding a crayon. Walked it home.”'],
          ['judge', 'Eleven nights. Why not simply wake it, {d}?'],
          ['d', 'You are not supposed to. Also it was holding my hand.']
        ])
      },
      5: {
        sass: true,
        lines: alt([
          ['d', 'Return it. Every morning. Folded. I have been doing it for a month.'],
          ['judge', 'You are the first person in this court to be inconvenienced by an inheritance.'],
          ['d', 'It is a lot of stuff to carry back at three in the morning, Your Honour.']
        ], [
          ['judge', 'What would you do with everything, {d}?'],
          ['d', 'Put a lock on the door. And a bell on {p}.'],
          ['judge', 'A bell.'],
          ['d', 'So I know when the heart-drawing starts.']
        ])
      }
    },
    rulings: {
      defendant: alt([
        ['judge', 'Judgment for {d}. The will is genuine. {p} wrote it in its sleep, in its own crayon, and spelled “everything” the way it always does when it is asleep and in love.'],
        ['judge', 'A will signed by the testator is a will, even if the testator was horizontal. {d} inherits everything. The spoon stays with the moth, as a prior commitment.'],
        ['npc', 'Finally.', 'moth'],
        ['p', 'I DO NOT LOVE {d}.'],
        ['judge', 'Your pillowcase says otherwise. In purple. With a heart.']
      ], [
        ['judge', 'Judgment for {d}. {p} accused the one resident who walked it back to bed eleven nights running, with a blanket, in the dark, and never once woke it.'],
        ['judge', 'The will stands, heart and all. If {p} wishes to amend it, {p} must do so awake, and sober, and in pencil.'],
        ['p', 'I DO NOT SLEEPWRITE.'],
        ['narrator', '(That night {p} writes “SORY” on the wall, in purple, with a heart. Nobody corrects it.)']
      ]),
      plaintiff: alt([
        ['judge', 'Judgment for {p}. A forged will is a forged will, and {d} is banned from all stationery for a year.'],
        ['d', 'I DID NOT FORGE IT. I WALKED {p} BACK TO BED ELEVEN TIMES.'],
        ['judge', 'Then you were awake, with a blanket, near a crayon, for eleven nights. I have convicted people on less.']
      ], [
        ['judge', 'Judgment for {p}. The second page is struck out and burned in front of the jury.'],
        ['narrator', '(The page is burned. That night {p} writes it again, on the wall, bigger.)']
      ]),
      both: alt([
        ['judge', 'You are both ridiculous. One writes a will in its sleep. The other keeps a logbook about it instead of waking it up.'],
        ['judge', 'New wills, both of you. Everything to the moth. Awake.']
      ], [
        ['judge', 'You are both unwell. One sleepwrites, one sleepwalks it home, and neither of you has had a full night since the spring.'],
        ['judge', 'You will both sleep at the court tonight, under supervision.'],
        ['narrator', '(The wall snores. Nobody thanks it.)']
      ])
    },
    hallway: {
      p: [
        'I do not write in my sleep. I have asked the pillowcase. It will not say.',
        'I am sleeping in a mitten tonight. On the crayon hand. And a bell. And a lock.',
        'Apparently I am “mostly heart”. That cannot be right. I sleep like a stone.'
      ],
      d: [
        'I’ll take everything. I’ll give it back in the morning. Folded. I have the practice.',
        'I did not even draw the throne. The throne was all {p}. Very ambitious throne.',
        'The best night I’ve had in a month was last night. It stayed in bed. I almost missed it.'
      ]
    }
  }],

  /* ---------- 8. The Labelled Biscuit: defendant becomes both ---------- */
  'labelled-biscuit': [{
    id: 'gift-receipt',
    title: 'Happy Birthday, Do Not Eat',
    truth: 'both',
    turn: alt([
      ['narrator', '(The bailiff places a small plate on the evidence table. On it: a card, face down, with a label stuck firmly over the front.)'],
      ['judge', 'What is that, Bailiff?'],
      ['bailiff', 'It is the other evidence, Your Honour. Nobody has lifted the label. I did not want to be labelled.']
    ], [
      ['bailiff', 'Your Honour, {d} has handed up a receipt. It is damp.'],
      ['judge', 'Where was it?'],
      ['bailiff', 'I would rather not say, sir. But it does say “GIFT” across the top, in capitals.']
    ]),
    questions: {
      1: {
        clue: '{d} bought the biscuit as a birthday present for {p}. The gift receipt says so. {p} labelled the plate before reading the card.',
        lines: alt([
          ['d', 'Me. With my own souls. I have the receipt.'],
          ['narrator', '({d} takes a small, damp receipt out of its mouth. Across the top: “GIFT RECEIPT. Recipient: {p}.”)'],
          ['judge', 'You bought the biscuit for {p}?'],
          ['d', 'For its birthday. There was a card. I put it under the plate.'],
          ['p', 'I LABELLED THE PLATE.']
        ], [
          ['d', 'I did, Your Honour. With my own souls, for {p}’s birthday. I kept the gift receipt in case of exchange.'],
          ['p', 'It is not my birthday.'],
          ['d', 'It is on the card.'],
          ['judge', 'Where is the card?'],
          ['d', 'On the plate, under the label. Nobody has lifted the label, Your Honour. Not even to see what it was stuck to.']
        ])
      },
      3: {
        clue: '{d} ate the present out of spite once {p} had labelled it, and left the card on the plate for {p} to find afterwards.',
        lines: alt([
          ['d', 'Like spite, Your Honour. And a bit like glue, from the label.'],
          ['judge', 'You ate a present, {d}. In front of the person it was for.'],
          ['d', 'It had been labelled. A present with a label on it is not a present, it is a hostage.'],
          ['p', 'YOU LEFT THE CARD ON THE PLATE.'],
          ['d', 'So you would find it afterwards. It was a very good biscuit. I wish you had been there.']
        ], [
          ['d', 'Buttery, Your Honour. Crumbly. With a faint aftertaste of being labelled.'],
          ['judge', 'Did you know it was {p}’s birthday biscuit when you ate it?'],
          ['d', 'I knew. I bought it. That was the worst bit. I ate my own present out of spite and it was the best thing I have ever tasted.'],
          ['p', 'AND THE CARD?'],
          ['d', 'I left it on the plate. I spelled “sorry” next to it, in crumbs.']
        ])
      },
      4: {
        lines: alt([
          ['p', 'It means I have a system.'],
          ['judge', 'What system?'],
          ['p', 'If anybody gives me anything, I label it before they have finished saying happy birthday.'],
          ['judge', 'Birthday?'],
          ['p', '…Hypothetical birthday.']
        ], [
          ['p', 'It is a system, Your Honour. In eleven parts. Part one, the label. Part two, the label again, in case the first one falls off.'],
          ['judge', 'And part three?'],
          ['p', 'I do not open a card until the item is labelled.'],
          ['judge', 'Why not?'],
          ['p', 'Cards are an ambush.']
        ])
      }
    },
    rulings: {
      both: alt([
        ['judge', 'You are both at fault. {d} bought {p} a birthday biscuit. {p} labelled it, and the giver, before reading the card. {d} then ate it out of spite.'],
        ['judge', 'A gift is not property, {p}, and a grudge is not a snack, {d}. All labels come off. {d} buys a second biscuit. {p} reads the card first.'],
        ['p', 'Can I label it?'],
        ['judge', 'You may label it “thank you”.']
      ], [
        ['judge', 'You are both at fault. {p} labels presents, people and benches. {d} eats presents out of spite. On this shelf, nobody has ever said “thank you” and “you’re welcome” in the right order.'],
        ['judge', 'New biscuit. Card read first. Labels off. The bailiff will hold the card.'],
        ['bailiff', 'I have read it already, Your Honour. I am sorry. I cried.']
      ]),
      plaintiff: alt([
        ['judge', 'Judgment for {p}. A present belongs to the person it is for, even when that person labels the giver, and the plate, and the air above the plate.'],
        ['judge', '{d} buys a second biscuit and presents it again, properly, with the card face up.'],
        ['p', 'Can I label the card?'],
        ['judge', 'No.']
      ], [
        ['judge', 'Judgment for {p}. A gift is a gift. You do not eat your own present out of spite, {d}. You take it back to the shop with the receipt and eat the refund.'],
        ['d', 'THE RECEIPT WAS IN MY MOUTH.'],
        ['judge', 'I know. I have seen it. It is the only damp thing in this court I have been willing to touch.']
      ]),
      defendant: alt([
        ['judge', 'Judgment for {d}, who bought the biscuit, holds the receipt, and has been labelled like a jam jar. I note it was a present, and that {d} ate it, and this court has chosen to find that touching.'],
        ['p', 'IT WAS MY BIRTHDAY.'],
        ['judge', 'Then you have had your present. It was a lesson.']
      ], [
        ['judge', 'Judgment for {d}. A resident who is labelled must be allowed some revenge. This court has a soft spot for revenge, and a hard spot for labels.'],
        ['p', 'It was a PRESENT.'],
        ['judge', 'Then it was a present that tasted of justice.']
      ])
    },
    hallway: {
      p: [
        'I read the card. It said “happy birthday”. I labelled it “MINE”. Then “THANK YOU”. Then “MINE” again.',
        'I knew somebody had eaten it. I always know. I did not know it was a present. That is a gap in the system.',
        'I will apologise to {d} in writing. With a label on the letter that says “SORRY, FROM {p}”.'
      ],
      d: [
        'I would like it noted that it was a very good biscuit.',
        'I spelled “sorry” on the plate in crumbs. Nobody read it. The bailiff ate it.',
        'First time anyone has labelled me and then read my card. I may keep the label.'
      ]
    }
  }],

  // @@NEXT
};

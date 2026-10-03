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

  // @@NEXT
};

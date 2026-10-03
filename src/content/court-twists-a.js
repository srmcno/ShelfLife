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

  // @@NEXT
};

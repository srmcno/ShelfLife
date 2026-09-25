/* ================= SHELF COURT =================
   A defence case in the old courtroom-drama shape. Each case has two
   witnesses. Every testimony has exactly one statement that a piece of
   evidence flatly contradicts; presenting it there is the OBJECTION moment.
   Pressing a statement gets a follow-up and, occasionally, new evidence.

   {d} is the defendant: always one of the player's own residents.
   Lines are { s: speaker, t: text }. Speakers: judge, prosecutor, witness,
   you, defendant, gallery, narrator.
   `lie` maps each evidence id that disproves the statement to the line you
   shout while presenting it. Writing rule: the contradiction must be plain
   from the statement and the evidence card alone. No mind reading. */

export const COURT_CAST = {
  judge: { name: 'Judge Mortis', art: 'judge' },
  prosecutor: { name: 'Prosecutor Rattigan', art: 'rat' },
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

export const COURT_CASES = [
  {
    id: 'funeral-cake',
    title: 'The Funeral Cake',
    blurb: 'The funeral cake was eaten before the funeral. The deceased is furious.',
    opening: [
      { s: 'judge', t: 'Order. ORDER. This court is now in session. It was in session before. It never really stops.' },
      { s: 'prosecutor', t: 'Your Honour, the funeral cake was eaten at three in the morning. Before the funeral. The deceased is devastated.' },
      { s: 'judge', t: 'The deceased is present?' },
      { s: 'prosecutor', t: 'The deceased is always present, Your Honour. That is the problem with this house.' },
      { s: 'judge', t: '{d} stands accused of eating the cake. How does the defendant plead?' },
      { s: 'defendant', t: '({d} opens its mouth to plead. A single crumb falls out. The gallery gasps. It is an old crumb. It is from Tuesday.)' }
    ],
    evidence: [
      { id: 'complaint', name: 'Noise Complaint', glyph: 'scroll', text: 'From next door: “{d} snored from 2am to 4am. Like a drain with opinions.”' },
      { id: 'dust', name: 'Wing Dust', glyph: 'moth', text: 'Silvery powder all over the icing. Pretty. Flammable. Definitely from a wing.' },
      { id: 'clock', name: 'Stopped Clock', glyph: 'clock', text: 'Knocked over during the crime. Stopped at 3:12. Refuses to start again out of respect.' },
      { id: 'fork', name: 'Tiny Fork', glyph: 'spoon', text: 'Found beside the cake. Spotless. Whoever ate this did not use cutlery. Animals.' }
    ],
    witnesses: [
      {
        who: 'woodlouse', title: 'What Geoffrey Saw',
        intro: [
          { s: 'prosecutor', t: 'The prosecution calls an eyewitness. He has fourteen legs and no social life.' },
          { s: 'witness', t: 'Geoffrey. Woodlouse. I measure coffins. Professionally. Nobody asked me to.' }
        ],
        testimony: [
          { t: 'I was up late measuring a coffin. Standard hobby.', press: [{ s: 'you', t: 'Whose coffin?' }, { s: 'witness', t: 'Nobody’s. Yet. I like to be ready. Like a tailor. For the end.' }] },
          { t: 'At about three, I heard chewing from the cake table.', press: [{ s: 'you', t: 'What kind of chewing?' }, { s: 'witness', t: 'Wet chewing. Chewing with feelings. Chewing that had given up on itself.' }] },
          { t: 'I saw {d} at the cake, holding a tiny fork. Bold as brass.', press: [{ s: 'you', t: 'Did {d} actually use the fork?' }, { s: 'witness', t: 'Well. No. It just held it. Menacingly. The way you hold a fork you are never going to use.' }] },
          { t: '{d} was wide awake and completely silent the whole time.',
            lie: { complaint: 'Silent? The neighbours filed a complaint! {d} was SNORING from two until four. Like a drain with opinions!' },
            crack: [
              { s: 'witness', t: '…I may have dozed off. In the coffin. It was very comfortable. I may have dreamt the fork.' },
              { s: 'judge', t: 'The witness was asleep in a coffin he was measuring for himself.' },
              { s: 'prosecutor', t: 'That is just good planning, Your Honour!' }
            ] },
          { t: 'Then I went back to my coffin and thought about my choices.', press: [{ s: 'you', t: 'Which choices?' }, { s: 'witness', t: 'All of them. I’m a woodlouse. We have a great deal of time to think.' }] }
        ]
      },
      {
        who: 'moth', title: 'Madam Moth’s Grief',
        intro: [
          { s: 'prosecutor', t: 'The prosecution calls the cake’s closest friend, Madam Moth.' },
          { s: 'witness', t: 'I loved that cake. Like a sister. A sister with icing.' }
        ],
        testimony: [
          { t: 'I was nowhere near the kitchen. I was near the lamp, as a lady should be.', press: [{ s: 'you', t: 'All night?' }, { s: 'witness', t: 'All night. Circling. Circling is a form of prayer.' }] },
          { t: 'At 3:12 exactly, I heard a crash. That was the clock falling.', press: [{ s: 'you', t: 'How do you know it was exactly 3:12, from the lamp?' }, { s: 'witness', t: 'Because clocks stop at the time they fall. Everybody knows that. Obviously. Next question.' }, { s: 'gallery', t: '(The ghosts in the gallery go “Ooooooh”.)' }] },
          { t: 'I have never touched that cake. Not with a single wing.',
            lie: { dust: 'Never touched it? Then whose wing dust is all over the icing? You didn’t just eat the cake. You WORE it!' },
            crack: [
              { s: 'witness', t: 'IT LOOKED LIKE A LAMP! A big, sweet, warm lamp! I had to get closer!' },
              { s: 'narrator', t: 'Madam Moth bursts into a small cloud of powder and remorse.' }
            ] },
          { t: 'Whoever did this had no manners at all. I could tell.', press: [{ s: 'you', t: 'How could you tell?' }, { s: 'witness', t: 'The crumbs were everywhere. Like someone ate it while flapping. Hypothetically.' }] },
          { t: '{d} is clearly guilty. Look at its little face.', press: [{ s: 'you', t: 'What’s wrong with its face?' }, { s: 'witness', t: 'It is a face that has eaten cake. Or will. Faces know.' }] }
        ]
      }
    ],
    verdict: [
      { s: 'judge', t: 'Madam Moth, you mistook a funeral cake for a lamp and ate it at 3:12 in the morning.' },
      { s: 'witness', t: 'It was the most beautiful light I have ever eaten.' },
      { s: 'judge', t: '{d} is found NOT GUILTY. Madam Moth is sentenced to sit near a real lamp and think about what she has done.' },
      { s: 'prosecutor', t: 'She’ll enjoy that, Your Honour.' },
      { s: 'judge', t: 'Case closed. Somebody sweep up the deceased.' }
    ]
  },
  {
    id: 'missing-eye',
    title: 'The Missing Eye',
    blurb: 'Susan went to sleep with two glass eyes and woke up with one.',
    opening: [
      { s: 'judge', t: 'Order! The court will now hear the case of Susan’s missing eye.' },
      { s: 'prosecutor', t: 'Your Honour, Susan the doll’s head went to sleep with two eyes and woke up with one. She has been staring at all of us ever since.' },
      { s: 'judge', t: 'With the one eye.' },
      { s: 'prosecutor', t: 'It is doing the work of two, Your Honour. It is exhausting to be looked at.' },
      { s: 'judge', t: '{d} is accused of taking it. {d}, you may look guilty in your own time.' }
    ],
    evidence: [
      { id: 'window', name: 'Open Window', glyph: 'door', text: 'The window was open all night. The latch is scratched from the OUTSIDE.' },
      { id: 'fur', name: 'Tuft of Fur', glyph: 'paw', text: 'Ginger. Found on the inside windowsill. None of the residents are ginger. The residents checked.' },
      { id: 'receipt', name: 'Pawn Receipt', glyph: 'scroll', text: '“One (1) glass eye, very judgemental. Sold for three teeth.” Signed with a paw print.' },
      { id: 'button', name: 'A Button', glyph: 'ring', text: 'Found in Susan’s empty socket. Somebody left it as a replacement. Somebody thinks they are funny.' }
    ],
    witnesses: [
      {
        who: 'lamp', title: 'What the Lamp Lit',
        intro: [
          { s: 'prosecutor', t: 'The prosecution calls the Lamp. It was on all night. It sees everything it is pointed at.' },
          { s: 'witness', t: 'I whisper now. Since the incident. Not that incident. The earlier one.' }
        ],
        testimony: [
          { t: 'I was on all night. Warm. Watchful. Slightly buzzing.', press: [{ s: 'you', t: 'Buzzing?' }, { s: 'witness', t: 'A moth. There is always a moth. We have an arrangement.' }] },
          { t: 'At midnight, a shape crept up to Susan.', press: [{ s: 'you', t: 'What kind of shape?' }, { s: 'witness', t: 'A medium shape. Bigger than {d}. Furrier than {d}. But I only saw it from the shade.' }, { s: 'prosecutor', t: 'Irrelevant! All shapes look the same from the shade!' }] },
          { t: 'The shape came from inside the house. The window stayed shut all night.',
            lie: { window: 'Shut? The window was OPEN all night, and the latch is scratched from the outside. Somebody came IN!' },
            crack: [
              { s: 'witness', t: '…I may have been facing the wall. I face the wall when I’m thinking. I think a lot.' },
              { s: 'judge', t: 'The witness is a lamp that faces walls.' },
              { s: 'prosecutor', t: 'Mood lighting, Your Honour!' }
            ] },
          { t: 'The shape took the eye and left something round in its place.', press: [{ s: 'you', t: 'Something round?' }, { s: 'witness', t: 'A button. It seemed very pleased with the button. It looked at it for a long time. With the eye.' }] },
          { t: 'It was {d}. I would know {d} anywhere.', press: [{ s: 'you', t: 'Would you?' }, { s: 'witness', t: 'It sleeps under me. It snores up at me. We are close in a way it does not know about.' }] }
        ]
      },
      {
        who: 'cat', title: 'An Independent Witness',
        intro: [
          { s: 'prosecutor', t: 'The prosecution calls an independent witness. Sir Reginald Whiskers, the large ginger cat next door.' },
          { s: 'witness', t: 'I am a cat of means. I have a collar with a bell. The bell is decorative.' },
          { s: 'gallery', t: '(The ghosts in the gallery hiss. The cat does not notice. The cat notices everything.)' }
        ],
        testimony: [
          { t: 'I was asleep on my own windowsill, next door, all night.', press: [{ s: 'you', t: 'All night?' }, { s: 'witness', t: 'Cats sleep eighteen hours a day. I was doing twenty. Overtime.' }] },
          { t: 'I have never set paw in this house. It smells of damp and grievances.',
            press: [{ s: 'you', t: 'How do you know what it smells like inside?' }, { s: 'witness', t: 'The smell comes out. Through the walls. Cats are very sensitive.' }, { s: 'gallery', t: '(A ghost in the gallery says “suuuure” very quietly.)' }],
            lie: { fur: 'Never set paw here? Then whose GINGER fur is on our windowsill? None of the residents are ginger. They CHECKED!' },
            crack: [
              { s: 'witness', t: '…Fine. FINE. I came in. The eye was looking at me. Nobody looks at me like that. So I took it and sold it.' },
              { s: 'narrator', t: 'Sir Reginald Whiskers knocks the judge’s water glass off the bench, purely out of spite, and confesses.' }
            ] },
          { t: 'And I certainly don’t need money. I’m a cat. Everything I want is on a table.', press: [{ s: 'you', t: 'And if it isn’t on a table?' }, { s: 'witness', t: 'Then I knock the table over and it is on the floor. Problem solved.' }] },
          { t: '{d} is obviously the thief. It has shifty little limbs.', press: [{ s: 'you', t: 'Shifty how?' }, { s: 'witness', t: 'It moves them. Constantly. Like it has somewhere to be.' }] },
          { t: 'Now, if you’ll excuse me, a bird has entered the conversation.', press: [{ s: 'you', t: 'There is no bird.' }, { s: 'witness', t: 'There is always a bird.' }] }
        ]
      }
    ],
    verdict: [
      { s: 'judge', t: 'Sir Reginald Whiskers, you stole Susan’s eye and pawned it for three teeth.' },
      { s: 'witness', t: 'They were very good teeth.' },
      { s: 'judge', t: '{d} is found NOT GUILTY. Susan gets her eye back, and the cat gets a second bell. A louder one.' },
      { s: 'prosecutor', t: '(quietly) I’m allergic to cats anyway, Your Honour.' },
      { s: 'judge', t: 'Case closed. Somebody give Susan her eye before she finishes staring at me.' }
    ]
  },
  {
    id: 'unlicensed-haunting',
    title: 'The Unlicensed Haunting',
    blurb: 'Someone has been moaning in the walls without a haunting licence.',
    opening: [
      { s: 'judge', t: 'Order! Next, the matter of an unlicensed haunting.' },
      { s: 'prosecutor', t: 'Your Honour, someone has been moaning in the walls at 3am without a haunting licence. The paperwork alone is chilling.' },
      { s: 'judge', t: 'Is haunting illegal?' },
      { s: 'prosecutor', t: 'Only without a licence, Your Honour. With a licence it is a career.' },
      { s: 'judge', t: '{d} is accused of haunting without the correct forms. {d}, did you moan?' },
      { s: 'defendant', t: '(Everyone looks at {d}. {d} moans a little, from nerves. The stenographer writes it down.)' }
    ],
    evidence: [
      { id: 'chain', name: 'Rusty Chain', glyph: 'key', text: 'Found in the wall. Clanky. Far too heavy for {d} to lift. {d} tried. {d} is still sore.' },
      { id: 'teeth', name: 'Jar of Teeth', glyph: 'jar', text: 'Every tooth in the house. The label says NOT UNCLE’S, in handwriting that is clearly Uncle’s.' },
      { id: 'forms', name: 'Complaint Forms', glyph: 'book', text: 'Seventeen complaints about moaning at 3am. One is from the moaner, complaining about the other sixteen.' }
    ],
    witnesses: [
      {
        who: 'ghost', title: 'The Ministry’s Findings',
        intro: [
          { s: 'witness', t: 'Inspector Wispley. Ministry of Haunting, Licensing Division. I have a clipboard. It passes through things.' },
          { s: 'prosecutor', t: 'The Inspector investigated personally, Your Honour. Through walls. Uninvited.' }
        ],
        testimony: [
          { t: 'I received seventeen complaints about moaning at 3am.', press: [{ s: 'you', t: 'From whom?' }, { s: 'witness', t: 'The neighbours. The mice. And one from the moaner, complaining about the complaints.' }] },
          { t: 'I followed the moaning into the wall behind the shelf.', press: [{ s: 'you', t: 'Through the wall?' }, { s: 'witness', t: 'I am a ghost. Doors are a courtesy I extend to the living.' }] },
          { t: 'Inside the wall, I found {d} clanking a big rusty chain.',
            lie: { chain: 'Clanking the chain? That chain is far too heavy for {d} to even LIFT! {d} tried! {d} is still sore!' },
            crack: [
              { s: 'witness', t: '…It was dark. I saw a chain and a small shape and did the maths badly. I was never good at maths. That’s why I’m in licensing.' },
              { s: 'judge', t: 'The Ministry of Haunting has made an error.' },
              { s: 'prosecutor', t: 'First time for everything, Your Honour. Well. Third.' }
            ] },
          { t: 'The moaning stopped the moment I arrived. Very suspicious.', press: [{ s: 'you', t: 'Maybe it stopped because you arrived?' }, { s: 'witness', t: 'People do go quiet when I arrive. I always assumed it was respect.' }] },
          { t: 'No haunting licence was found for {d}. Case closed.',
            press: [{ s: 'you', t: 'Did you find ANY licence in there?' }, { s: 'witness', t: 'Only an old one. Expired. Issued to somebody called “Uncle”. Hardly relevant.' }, { s: 'narrator', t: 'Evidence added: Expired Haunting Licence.' }],
            adds: 'licence' }
        ]
      },
      {
        who: 'uncle', title: 'Uncle’s Account',
        intro: [
          { s: 'prosecutor', t: 'The prosecution calls Uncle. He has lived on the second shelf since 1911.' },
          { s: 'witness', t: 'Hello. I am Uncle. I am mostly a skull now. I am doing very well, considering.' }
        ],
        testimony: [
          { t: 'I sleep soundly every night. I have no lungs to snore with.', press: [{ s: 'you', t: 'No lungs at all?' }, { s: 'witness', t: 'I had some. I left them somewhere. The 1910s were a blur.' }] },
          { t: 'I have never haunted anything in my life. Or after it.',
            lie: { licence: 'Never haunted anything? This haunting licence was issued to YOU, Uncle. In 1911. It expired. And you KEPT GOING!' },
            crack: [
              { s: 'witness', t: '…I only moan because I’ve lost my teeth! WHERE ARE MY TEETH?!' },
              { s: 'narrator', t: 'It is the same moan. Everyone recognises it at once. It has been keeping the house awake since 1911.' },
              { s: 'judge', t: 'Uncle. Have you been haunting without a licence for over a century?' },
              { s: 'witness', t: 'I’ve been BUSY!' }
            ] },
          { t: 'I spend my nights quietly on the shelf, thinking about the 1900s.', press: [{ s: 'you', t: 'What about them?' }, { s: 'witness', t: 'Mainly the hats. You could hide a whole second head in a 1900s hat.' }] },
          { t: '{d} moans constantly. About food. About baths. About me.', press: [{ s: 'you', t: 'That’s complaining, not haunting.' }, { s: 'witness', t: 'In this house there is a very fine line.' }] },
          { t: 'Also, I would like to report that my teeth are missing.', press: [{ s: 'you', t: 'Missing since when?' }, { s: 'witness', t: 'Since 1911. I have been looking. Loudly.' }] }
        ]
      }
    ],
    evidenceLater: {
      licence: { id: 'licence', name: 'Expired Licence', glyph: 'scroll', text: 'A haunting licence issued to “Uncle”. Dated 1911. Expired the same year. Never renewed.' }
    },
    verdict: [
      { s: 'judge', t: 'Uncle, you have been haunting this house without a valid licence since 1911.' },
      { s: 'witness', t: 'In my defence, the forms were very long, and I have no hands.' },
      { s: 'judge', t: '{d} is found NOT GUILTY. Uncle will renew his licence and keep the moaning to office hours.' },
      { s: 'prosecutor', t: 'And his teeth, Your Honour?' },
      { s: 'judge', t: 'The court has located them. They were in the jar marked NOT UNCLE’S. Case closed.' }
    ]
  },
  {
    id: 'plant-pot-grave',
    title: 'The Plant Pot Grave',
    blurb: 'A grave in the plant pot has been dug up and its biscuit stolen.',
    opening: [
      { s: 'judge', t: 'Order! Someone has robbed the grave in the plant pot.' },
      { s: 'prosecutor', t: 'Your Honour, the plant pot holds the grave of Geoffrey the First, a woodlouse of great standing, buried with one biscuit for the journey.' },
      { s: 'judge', t: 'And now?' },
      { s: 'prosecutor', t: 'Now the grave is open, the biscuit is gone, and Geoffrey is having a lie-in on the carpet.' },
      { s: 'judge', t: '{d} is accused of grave robbery. {d}, anything to say?' },
      { s: 'defendant', t: '({d} is covered in soil. A great deal of soil. {d} says nothing. The soil says plenty.)' }
    ],
    evidence: [
      { id: 'rota', name: 'Bath Rota', glyph: 'book', text: '{d}: in the bath from midnight until half past, scrubbed hard. Witnessed and signed by the sponge.' },
      { id: 'prints', name: 'Bird Prints', glyph: 'raven', text: 'Tracks in the spilled soil. Three long toes forward, one back. Big ones.' },
      { id: 'soil', name: 'Soil on {d}', glyph: 'shovel', text: '{d} rolled in the plant pot at one in the morning, after the grave was opened. “To feel something,” it says.' }
    ],
    evidenceLater: {
      feather: { id: 'feather', name: 'Black Feather', glyph: 'raven', text: 'Glossy. Enormous. Found lying in the open grave. Smells faintly of prophecy.' }
    },
    witnesses: [
      {
        who: 'geoffrey2', title: 'A Son’s Grief',
        intro: [
          { s: 'witness', t: 'Geoffrey the Second. Son of Geoffrey the First. I have come to see justice done. And to get my inheritance back.' },
          { s: 'prosecutor', t: 'The biscuit, Your Honour. He means the biscuit.' }
        ],
        testimony: [
          { t: 'I visit Father’s grave every night at midnight, to read him the news.', press: [{ s: 'you', t: 'What news?' }, { s: 'witness', t: 'Crumb prices, mostly. He liked to keep up.' }] },
          { t: 'At midnight, I saw {d} in the plant pot, digging with both hands.',
            lie: { rota: 'Digging at midnight? {d} was in the BATH at midnight, being scrubbed! It’s on the rota! The sponge signed it!' },
            crack: [
              { s: 'witness', t: '…It was dark. I saw {d} rolling about in the soil later and filled in the rest. Grief makes you creative.' },
              { s: 'judge', t: 'The witness has embellished.' },
              { s: 'prosecutor', t: 'It runs in woodlouse families, Your Honour.' }
            ] },
          { t: 'Father’s biscuit was gone. There was only a crumb and a feather.', press: [{ s: 'you', t: 'A feather?' }, { s: 'witness', t: 'Black. Enormous. I assumed it was {d}’s. It looks like the kind of thing that has a feather somewhere.' }, { s: 'narrator', t: 'Evidence added: Black Feather.' }], adds: 'feather' },
          { t: 'Father was on the carpet, looking peaceful. Too peaceful.', press: [{ s: 'you', t: 'He’s dead. He’s meant to look peaceful.' }, { s: 'witness', t: 'Not THAT peaceful. He looked like he’d had a lovely evening.' }] },
          { t: 'I demand justice. And the biscuit. Mostly the biscuit.', press: [{ s: 'you', t: 'Which one first?' }, { s: 'witness', t: 'The biscuit. Justice keeps. Biscuits go soft.' }] }
        ]
      },
      {
        who: 'raven', title: 'A Messenger’s Alibi',
        intro: [
          { s: 'prosecutor', t: 'The prosecution calls the Raven, a respected messenger of the dead.' },
          { s: 'witness', t: 'Nevermore. That’s just how I say hello. Good afternoon.' }
        ],
        testimony: [
          { t: 'I deliver messages to the dead. Honest work. Very quiet customers.', press: [{ s: 'you', t: 'Do they ever reply?' }, { s: 'witness', t: 'Rarely. When they do, it is usually “who is this”.' }] },
          { t: 'Last night I was delivering a postcard three streets away.', press: [{ s: 'you', t: 'What did it say?' }, { s: 'witness', t: '“Wish you were here.” The recipient was not, in fact, anywhere.' }] },
          { t: 'I have never been anywhere near that plant pot.',
            lie: {
              feather: 'Never near it? Then whose enormous black FEATHER was lying in the open grave?',
              prints: 'Never near it? Then explain the BIRD PRINTS in the soil. Three toes forward, one back. Big ones. YOURS!'
            },
            crack: [
              { s: 'witness', t: 'I was PECKISH! A biscuit buried with a woodlouse? What is a dead woodlouse going to do with a biscuit?!' },
              { s: 'narrator', t: 'The Raven coughs up the biscuit, whole. The gallery applauds. Geoffrey the Second weeps with joy.' }
            ] },
          { t: '{d} dug that grave. Just look at the soil on it.', press: [{ s: 'you', t: 'Soil proves nothing.' }, { s: 'witness', t: 'Soil proves soil. That’s one more thing than you’ve proved.' }] },
          { t: 'Nevermore. I mean goodbye. I mean I’m leaving. Nevermore.', press: [{ s: 'you', t: 'You can’t leave. You’re a witness.' }, { s: 'witness', t: 'Nevermore.' }] }
        ]
      }
    ],
    verdict: [
      { s: 'judge', t: 'Raven, you robbed a woodlouse’s grave for a biscuit.' },
      { s: 'witness', t: 'He wasn’t using it.' },
      { s: 'judge', t: '{d} is found NOT GUILTY. The biscuit returns to Geoffrey the First, and the Raven will write a formal apology. To the dead. By hand.' },
      { s: 'prosecutor', t: 'He does love a delivery, Your Honour.' },
      { s: 'judge', t: 'Case closed. Somebody put Geoffrey back in his pot.' }
    ]
  },
  {
    id: 'salted-tea',
    title: 'The Salted Tea Party',
    blurb: 'Someone salted the sugar at a tea party for the recently deceased.',
    opening: [
      { s: 'judge', t: 'Order! We turn to the tea party for the recently deceased.' },
      { s: 'prosecutor', t: 'Your Honour, someone put salt in the sugar bowl. Every guest took three lumps. One of the recently deceased died again.' },
      { s: 'judge', t: 'Again?' },
      { s: 'prosecutor', t: 'It has been a very difficult week for him, Your Honour.' },
      { s: 'judge', t: '{d} was on sugar duty. {d} stands accused of salting the tea.' }
    ],
    evidence: [
      { id: 'toaster', name: 'Crumpet Rota', glyph: 'flame', text: '{d} spent the entire party inside the toaster, rescuing a crumpet. {d} is still slightly warm.' },
      { id: 'veil', name: 'Wet Black Veil', glyph: 'veil', text: 'Found beside the sugar bowl, soaking. The kind of wet you only get from a lot of crying.' },
      { id: 'labels', name: 'The Tins', glyph: 'jar', text: 'SUGAR and SALT, both correctly labelled. Nobody swapped them. The salt tin was never opened.' },
      { id: 'spoon', name: 'Bent Spoon', glyph: 'spoon', text: 'Used to stir. Bent by the spirits, or by Gerald. Gerald was not invited.' }
    ],
    witnesses: [
      {
        who: 'susan', title: 'The Centrepiece Speaks',
        intro: [
          { s: 'prosecutor', t: 'The prosecution calls Susan, who was the centrepiece.' },
          { s: 'witness', t: 'I am a doll’s head. I was the centrepiece. It is what I do now.' }
        ],
        testimony: [
          { t: 'I sat in the middle of the table and saw everything.', press: [{ s: 'you', t: 'Everything?' }, { s: 'witness', t: 'Everything in front of me. Nobody ever turns me round.' }] },
          { t: 'I watched {d} pour salt into the sugar bowl with its own hands.',
            lie: { toaster: 'Watched {d} pour salt? {d} spent the ENTIRE party inside the toaster, rescuing a crumpet! It’s still warm!' },
            crack: [
              { s: 'witness', t: '…Fine. I was facing the wall. I am always facing the wall. Nobody moves me. I guessed.' },
              { s: 'judge', t: 'The witness is a head that guessed.' },
              { s: 'prosecutor', t: 'A very confident head, Your Honour!' }
            ] },
          { t: 'Mrs Widow wept beautifully at the other end of the table.', press: [{ s: 'you', t: 'At the other end?' }, { s: 'witness', t: 'At first. Then she moved closer to the sugar. For the acoustics.' }] },
          { t: 'The tea tasted like the sea. And the sea tasted like sadness.', press: [{ s: 'you', t: 'You drank tea? You’re a head.' }, { s: 'witness', t: 'I have a mouth. It is decorative. I use it anyway.' }] },
          { t: 'Also, I would like my eye back while we’re all here.', press: [{ s: 'you', t: 'That was a different case, Susan.' }, { s: 'witness', t: 'Every case is my case. I am always here. Nobody moves me.' }] }
        ]
      },
      {
        who: 'widow', title: 'A Professional Mourner',
        intro: [
          { s: 'witness', t: 'Mrs Widow. I attend every funeral. I have never missed one. Occasionally I start them.' },
          { s: 'prosecutor', t: 'Mrs Widow is a professional mourner, Your Honour. She cries to a very high standard.' }
        ],
        testimony: [
          { t: 'I arrived at four, in full mourning, as one does for tea.', press: [{ s: 'you', t: 'Who were you mourning?' }, { s: 'witness', t: 'The tea. It was always going to end.' }] },
          { t: 'I sat far from the sugar. I had to wave to it. Tearfully.', press: [{ s: 'you', t: 'Why wave to sugar?' }, { s: 'witness', t: 'It looked lonely. Everything looks lonely if you cry at it long enough.' }] },
          { t: 'I never cry near food. Tears make everything soggy and salty.',
            lie: { veil: 'Never cry near food? Then why was your veil found beside the sugar bowl, absolutely SOAKED in tears?!' },
            crack: [
              { s: 'witness', t: '…I may have wept. Into the sugar. For quite a long time. It was a very moving bowl.' },
              { s: 'gallery', t: '(A ghost in the gallery faints. It is not the first time. It is a fainting ghost.)' },
              { s: 'judge', t: 'The witness salted the sugar with her own grief.' }
            ] },
          { t: 'Whoever did this has no respect for the dead.', press: [{ s: 'you', t: 'Do you respect the dead?' }, { s: 'witness', t: 'I respect them so much I cry at them professionally. Invoices on request.' }] },
          { t: '{d} was on sugar duty. The sugar is {d}’s responsibility.', press: [{ s: 'you', t: 'Even if someone else cried in it?' }, { s: 'witness', t: 'Especially then. Someone should have stopped me. I am very hard to stop.' }] }
        ]
      }
    ],
    verdict: [
      { s: 'judge', t: 'Mrs Widow, you wept into the sugar until it turned to salt.' },
      { s: 'witness', t: 'It was a very moving tea.' },
      { s: 'judge', t: '{d} is found NOT GUILTY. Mrs Widow will cry into a handkerchief, or a bucket, or the sea, where it belongs.' },
      { s: 'prosecutor', t: 'The sea is already quite salty, Your Honour.' },
      { s: 'judge', t: 'And now we all know why. Case closed.' }
    ]
  },
  {
    id: 'wandering-coffin',
    title: 'The Wandering Coffin',
    blurb: 'A coffin moved to the top shelf overnight. Coffins do not do that. Legally.',
    opening: [
      { s: 'judge', t: 'Order! The matter of an unauthorised coffin relocation.' },
      { s: 'prosecutor', t: 'Your Honour, a coffin moved from the bottom shelf to the top shelf overnight. Coffins do not move themselves. Usually. Legally.' },
      { s: 'judge', t: 'Was anybody in it?' },
      { s: 'prosecutor', t: 'That, Your Honour, is always the question.' },
      { s: 'judge', t: '{d} is accused of moving the coffin. Anything to say before we begin?' },
      { s: 'defendant', t: '({d} looks at the coffin. The coffin knocks twice. {d} decides to say nothing.)' }
    ],
    evidence: [
      { id: 'height', name: 'Height Chart', glyph: 'chalk', text: '{d} can reach the second shelf, on tiptoe, weeping. The top shelf is far beyond {d}.' },
      { id: 'scratches', name: 'Scratched Lid', glyph: 'coffin', text: 'Tiny scratches on the INSIDE of the coffin lid. Somebody small was in there, and wanted out.' },
      { id: 'tape', name: 'Measuring Tape', glyph: 'key', text: 'Found coiled inside the coffin, still warm. Engraved: PROPERTY OF GEOFFREY. DO NOT MEASURE.' }
    ],
    evidenceLater: {
      pulley: { id: 'pulley', name: 'Thimble Pulley', glyph: 'thimble', text: 'String, a bent nail and a thimble, rigged to the top shelf. Built by someone with far too much time.' }
    },
    witnesses: [
      {
        who: 'cat', title: 'The Cat Returns',
        intro: [
          { s: 'prosecutor', t: 'The prosecution recalls Sir Reginald Whiskers.' },
          { s: 'witness', t: 'I’m back. I was released on bail. The bail was a saucer of milk.' },
          { s: 'judge', t: 'Try not to steal anything this time.' }
        ],
        testimony: [
          { t: 'I was watching this shelf from my window. As a hobby.', press: [{ s: 'you', t: 'Why this shelf?' }, { s: 'witness', t: 'It’s the best thing on television. Things fall off it.' }] },
          { t: 'At two o’clock, I saw {d} carry the coffin up to the top shelf.',
            lie: { height: 'Carry it to the TOP shelf? {d} can barely reach the second shelf on tiptoe, WEEPING! Look at the height chart!' },
            crack: [
              { s: 'witness', t: '…Perhaps {d} didn’t carry it. Perhaps the coffin simply rose. I’m a cat. I see things rise all the time. Mostly birds.' },
              { s: 'judge', t: 'The witness is being a cat about it.' }
            ] },
          { t: 'The coffin was empty. I would know. I can smell empty.', press: [{ s: 'you', t: 'What does empty smell like?' }, { s: 'witness', t: 'Like a Tuesday. You wouldn’t understand.' }] },
          { t: 'Then the coffin knocked twice. Which was rude.', press: [{ s: 'you', t: 'An EMPTY coffin knocked?' }, { s: 'witness', t: 'I stand by empty. I also stand by knocking. I contain multitudes.' }] },
          { t: 'A string was dangling from the top shelf. I did not bat at it. Much.', press: [{ s: 'you', t: 'Tell me about the string.' }, { s: 'witness', t: 'It ran to a little pulley made of a thimble and a nail. Far too clever. Not a cat’s work. We just knock things over.' }, { s: 'narrator', t: 'Evidence added: Thimble Pulley.' }], adds: 'pulley' }
        ]
      },
      {
        who: 'woodlouse', title: 'The Coffin Expert',
        intro: [
          { s: 'prosecutor', t: 'The prosecution calls Geoffrey the Woodlouse, coffin expert.' },
          { s: 'witness', t: 'Hello again. I measured the court earlier. It would fit about four hundred of me. In a pinch.' }
        ],
        testimony: [
          { t: 'Coffins are my passion. I measure them. I don’t move them. Different union.', press: [{ s: 'you', t: 'There’s a union?' }, { s: 'witness', t: 'The Guild of Small Undertakers. Meetings are in a matchbox. Standing room only.' }] },
          { t: 'I was at home all night, in my matchbox, being very still.',
            press: [{ s: 'you', t: 'Can anyone confirm that?' }, { s: 'witness', t: 'No. That’s the whole point of being still.' }],
            lie: {
              tape: 'At home? Then why was YOUR measuring tape coiled up inside that coffin, still WARM?',
              scratches: 'At home? Somebody small was INSIDE that coffin, scratching the lid. And you are very small, Geoffrey!'
            },
            crack: [
              { s: 'witness', t: '…I wanted to know what the top shelf was like. From inside a coffin. So I built a pulley and hoisted myself up. The view was lovely.' },
              { s: 'narrator', t: 'Geoffrey, overcome, curls into a tiny grey ball and rolls gently off the stand.' }
            ] },
          { t: 'I have no engineering skills. I can barely work a pencil.', press: [{ s: 'you', t: 'You measure coffins with precision.' }, { s: 'witness', t: 'Measuring is not building. Measuring is just knowing how disappointed to be.' }] },
          { t: 'Top shelves make me dizzy. I’m a floor person. A skirting-board person.', press: [{ s: 'you', t: 'Have you ever been up there?' }, { s: 'witness', t: 'Not while awake. Not while alive. Not while being watched.' }] },
          { t: '{d} did it. {d} has always wanted to be taller.', press: [{ s: 'you', t: 'That’s not evidence.' }, { s: 'witness', t: 'It’s a motive. I measured it.' }] }
        ]
      }
    ],
    verdict: [
      { s: 'judge', t: 'Geoffrey, you hoisted a coffin to the top shelf with a thimble pulley, and then got in it to enjoy the view.' },
      { s: 'witness', t: 'It was the best night of my life. Or death. I get them confused.' },
      { s: 'judge', t: '{d} is found NOT GUILTY. The coffin stays up there. Geoffrey may visit at weekends.' },
      { s: 'prosecutor', t: 'The prosecution would also like weekends, Your Honour.' },
      { s: 'judge', t: 'Denied. Case closed. Everybody go home. You are home. Go to your slots.' }
    ]
  }
];

/* Shared lines. {ev} is the evidence presented, {w} the witness. */
export const WRONG_EVIDENCE = [
  'The court fails to see what the {ev} has to do with anything. The court has no eyes, to be fair.',
  'Objection overruled. The {ev} is irrelevant. So, increasingly, is the defence.',
  'Counsel, did you just wave the {ev} at a witness for fun?',
  'The {ev}. Really. The court is going to lie down in its coffin after this.',
  'Rattigan, stop laughing. Counsel, stop presenting things at random.',
  'The {ev} does not contradict that statement. It barely contradicts itself.'
];
export const WRONG_TAUNTS = [
  'Ha! The defence is flailing, Your Honour! Flailing!',
  'The prosecution would like that entered into the record. Twice.',
  'Is the defence just emptying its pockets now?',
  'I’ve seen better objections from a teaspoon.'
];
export const PRESS_TAUNTS = [
  'Objection! Counsel is asking questions again, Your Honour!',
  'The defence is badgering a very small witness!',
  'Irrelevant! Also, my wig is itchy!',
  'The prosecution would like it noted that it is winning.',
  'Hold it! …Sorry. Wrong case. Carry on.'
];
export const GALLERY_GASPS = [
  '(The gallery gasps. One ghost gasps so hard it becomes slightly more dead.)',
  '(The ghosts go “Ooooooh”. They go “ooooh” at everything, but this time they mean it.)',
  '(Somewhere in the gallery a skeleton drops its jaw. Literally. It rolls under a bench.)',
  '(A murmur ripples through the gallery. It is mostly moaning, but excited moaning.)'
];
export const LOSE_LINES = [
  { s: 'judge', t: 'ENOUGH. The court is out of patience. It did not have much. It is a skeleton.' },
  { s: 'judge', t: '{d} is found GUILTY, and sentenced to be dusted weekly for all eternity.' },
  { s: 'prosecutor', t: 'Eternity is a very long time, Your Honour.' },
  { s: 'judge', t: 'Then they had better get comfortable. Court adjourned.' }
];
export const COURT_PATIENCE = 3;

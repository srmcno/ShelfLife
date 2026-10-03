/* Twenty more nightly omens, appended to OMENS in content/mayhem.js.

   Writing rules for this file:
     * `effect` is one of the six the engine already reads (care, mayhem,
       coffin, luck, extra, chores). A new omen changes the words, never the rules.
     * The first sentence says what the omen does, plainly, because the desk
       tile shows only that sentence. Everything after it is the prophecy.
     * Dry, specific, petty. The funniest beat goes last.
     * `glyph` names a picture from art/mayhem-glyphs.js for the card face.
     * No dashes of any kind and no straight quotes: test/daily_content.test.mjs
       holds every line in here to that. */

export const OMENS_EXTRA = [
  /* care: double souls for feeding, fussing and washing */
  { id: 'undertakers-pencil', name: 'The Undertaker’s Pencil', effect: 'care', glyph: 'chalk',
    line: 'Care pays double souls today. The undertaker watched you tuck someone in, rubbed out a date in his notebook and wrote a later one. He sighed like a man losing a deposit.' },
  { id: 'other-mitten', name: 'The Other Mitten', effect: 'care', glyph: 'thimble',
    line: 'Care pays double souls today. One mitten is drying on the radiator, still warm. The other is still being worn, and is applauding you. It is muffled, but meant.' },
  { id: 'night-nurse', name: 'The Night Nurse', effect: 'care', glyph: 'candle',
    line: 'Care pays double souls today. A night nurse is going round with a clipboard, awarding gold stars for having a pulse. Nobody here has one. She has run out of stars and started on the furniture.' },
  { id: 'warm-bottle', name: 'The Warm Bottle', effect: 'care', glyph: 'jar',
    line: 'Care pays double souls today. There is a hot water bottle in the bed. It was warm yesterday and it will be warm tomorrow. Nobody has asked where it goes in between.' },

  /* mayhem: emergencies pay double souls */
  { id: 'scheduled-calamity', name: 'The Scheduled Calamity', effect: 'mayhem', glyph: 'veil',
    line: 'Emergencies pay double souls today. A calamity has been pencilled in for later. It has asked for a quiet room, a glass of water and no questions about its previous work.' },
  { id: 'late-fee', name: 'The Late Fee', effect: 'mayhem', glyph: 'gavel',
    line: 'Emergencies pay double souls today. A librarian has arrived about an overdue book. He is very old and extremely polite. The late fee, as of this morning, is the house.' },
  { id: 'held-breath', name: 'The Held Breath', effect: 'mayhem', glyph: 'ear',
    line: 'Emergencies pay double souls today. It has gone quiet in the walls, and not the restful sort. It is the quiet of something that has just put its coat on.' },
  { id: 'loose-fuse', name: 'The Unattached Fuse', effect: 'mayhem', glyph: 'flame',
    line: 'Emergencies pay double souls today. A fuse is burning somewhere in the house. It is not attached to anything. It is burning in the spirit of the thing.' },

  /* coffin: coffins at half price */
  { id: 'loyalty-card', name: 'The Loyalty Card', effect: 'coffin', glyph: 'photo',
    line: 'Coffins are half price today. The undertaker stamps your loyalty card every night you call. The seventh stamp is on the house. He says this warmly, and looks at the house.' },
  { id: 'price-match', name: 'The Price Match', effect: 'coffin', glyph: 'scroll',
    line: 'Coffins are half price today. The undertaker will match any rival quote. You do not have a rival undertaker. He has gone to become one.' },
  { id: 'floor-model', name: 'The Floor Model', effect: 'coffin', glyph: 'box',
    line: 'Coffins are half price today. That includes the floor model, which has slight signs of use. The undertaker says the last occupant was only trying it for size.' },

  /* luck: rarer curios are more likely */
  { id: 'lost-property', name: 'The Lost Property Office', effect: 'luck', glyph: 'key',
    line: 'Rarer curios are more likely today. The night bus has handed in everything the dead left on it. Most of it is umbrellas. All of them are open.' },
  { id: 'estate-sale', name: 'The Estate Sale', effect: 'luck', glyph: 'ring',
    line: 'Rarer curios are more likely today. There is an estate sale two streets over, and the deceased is running it. He hovers at every table and asks what you want it for.' },
  { id: 'rabbits-foot', name: 'The Rabbit’s Foot', effect: 'luck', glyph: 'paw',
    line: 'Rarer curios are more likely today. The rabbit’s foot is working beautifully. Please do not ask the rabbit.' },

  /* extra: one more emergency can pile up */
  { id: 'tall-stranger', name: 'The Tall Stranger', effect: 'extra', glyph: 'ghost',
    line: 'One more emergency can pile up today. A tall dark stranger will change everything. He has been in the airing cupboard since March and has so far changed the towels.' },
  { id: 'plus-one', name: 'The Plus One', effect: 'extra', glyph: 'cake',
    line: 'One more emergency can pile up today. The invitation said disasters could bring a plus one. Several have brought their mothers.' },
  { id: 'overdue-book', name: 'The Overdue Book', effect: 'extra', glyph: 'book',
    line: 'One more emergency can pile up today. A library book is overdue, and the library has sent someone to collect it. He was quite young when he set out. He is on the second landing.' },

  /* chores: daily chores pay double souls */
  { id: 'pinned-rota', name: 'The Pinned Rota', effect: 'chores', glyph: 'nail',
    line: 'Chores pay double souls today. A rota has been pinned up in the hall in a dead person’s handwriting. Your name is in every box.' },
  { id: 'idle-hands', name: 'The Idle Hands', effect: 'chores', glyph: 'shovel',
    line: 'Chores pay double souls today. Idle hands are the devil’s workshop. The devil has been round to say he is overstaffed and would be grateful if you kept yours busy.' },
  { id: 'small-print', name: 'The Small Print', effect: 'chores', glyph: 'ink',
    line: 'Chores pay double souls today. Terms apply. The terms are on the inside of your eyelids and they change every time you blink.' }
];

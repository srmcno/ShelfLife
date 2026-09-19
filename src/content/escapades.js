// Authored little adventures are deliberately finite: two endings to discover,
// no expiry, streak, or score requirement. {name} is replaced outside SVG markup
// with the resident's saved name by the presentation layer.
export const ESCAPADES = [
  {
    id: 'crumb-observatory',
    title: 'The Crumb Observatory',
    pitch: '{name} has spotted a crumb caught in a cobweb. It appears to be orbiting the shelf. The astronomers predict the end of the biscuit. There are no astronomers yet; {name} is making badges.',
    care: { need: 'food', label: 'Feed the astronomer', line: 'Give {name} a personal snack so the discovery can remain an astronomical object.' },
    approaches: [
      { id: 'orbit', activity: 'chase', label: 'Follow a crumb trail', line: 'Finish a Crumb Chase. {name} is collecting observations, including any spectacular miscalculations.' },
      { id: 'equipment', activity: 'market', label: 'Look for observatory supplies', line: 'Complete a Night Market trip. Even returning with an empty bag counts as important research into the cost of astronomy.' }
    ],
    endings: [
      { id: 'discovery', label: 'Name a new constellation', keepsake: 'crumb-telescope', title: 'The Biscuit-Scope',
        text: '{name} builds a telescope from a paper tube and names the crumb The Great Maybe. Its orbit ends when someone opens a window. The star chart is adjusted: the constellation now includes the floor. Nobody has proved that the floor is not part of space.',
        callback: '{name} insists that a clear view of the carpet is excellent seeing conditions.' },
      { id: 'supper', label: 'Invite the comet to supper', keepsake: 'orbit-saucer', title: 'A Saucer for a Comet',
        text: '{name} sets a place for the crumb and gently untangles it. The comet lands on a saucer with no casualties and rather more butter than expected. A wire model preserves its famous orbit. The comet sheds a piece of crust. They bury it under the saucer. Breakfast is now a protected graveyard.',
        callback: '{name} reserves the little saucer for distinguished visitors from above.' }
    ]
  },
  {
    id: 'small-haunting',
    title: 'A Very Small Haunting',
    pitch: 'A ghost the size of a sugar grain has applied to haunt {name}. Its audition is mostly a draught. In the margin of its application, it has written: “Somewhere quiet would be nice.”',
    care: { need: 'fuss', label: 'A little reassurance', line: 'Give {name} a moment of personal fuss before meeting the applicant. Being chosen for a haunting is a lot to process.' },
    approaches: [
      { id: 'rehearse', activity: 'memory', label: 'Rehearse the haunting', line: 'Play Secret Handshake. An imperfect performance will make the nervous little ghost feel considerably better.' },
      { id: 'references', activity: 'alibi', label: 'Check its references', line: 'Finish a round of The Alibi. {name} would like some practice before asking a ghost about a gap in its employment.' }
    ],
    endings: [
      { id: 'home', label: 'Offer it a place to stay', keepsake: 'ghost-bed', title: 'The Spare Matchbox',
        text: '{name} lines a matchbox with cotton and calls it a guest room. The ghost spends its first evening haunting the pillow, then falls asleep halfway through “boo”. In the morning the pillow is one degree colder. The rent is one small shiver, payable whenever.',
        callback: '{name} leaves the matchbox open a crack. The guest dislikes draughts.' },
      { id: 'holiday', label: 'Give it some time off', keepsake: 'holiday-bell', title: 'The Off-Duty Bell',
        text: '{name} excuses the ghost from haunting and lends it a bell to ring when it feels like company. It takes the bell for a long, inaudible walk. When it returns, there is a tiny sunset caught in the clapper. The clapper is now a tooth. It was not a tooth when it left. The ghost refuses to say whose holiday this was.',
        callback: '{name} sometimes holds the bell to the light to see where the ghost went.' }
    ]
  },
  {
    id: 'button-republic',
    title: 'The Republic of One Button',
    pitch: '{name} has found a loose button and declared it a country. It has four holes, no roads, and a border dispute with a very patient bit of thread.',
    care: { need: 'food', label: 'A snack for the founder', line: 'Give {name} a personal snack. Constitutions are difficult work on an empty stomach.' },
    approaches: [
      { id: 'legal', activity: 'court', label: 'Practise cabinet law', line: 'Take a case in Shelf Court. Whatever the verdict, {name} will return with an opinion about borders.' },
      { id: 'survey', activity: 'outing', label: 'Scout beyond the border', line: 'Finish an expedition Beyond the Shelf. Every return journey gives a new country something to put on its map.' }
    ],
    endings: [
      { id: 'crown', label: 'Give the button a monarch', keepsake: 'button-crown', title: 'The Crown of Almost Nothing',
        text: '{name} crowns the button with a bottle cap. The new monarch immediately abolishes buttonholes, calling them a threat to national unity. The thread is appointed foreign minister. It crosses the border six times before lunch, which everyone agrees is diplomacy.',
        callback: '{name} still refers to the button tin as “the neighbouring powers”.' },
      { id: 'passport', label: 'Make everyone a citizen', keepsake: 'button-passport', title: 'A Passport to One Button',
        text: '{name} opens all four borders and issues passports small enough to lose inside a passport. The first visitor is the thread. It stays for tea and accidentally stitches the country to a cushion. The constitution is amended to allow a nation to be comfortable.',
        callback: '{name} stamps the passport before visiting the other end of the shelf.' }
    ]
  },
  {
    id: 'drawer-rain',
    title: 'The Rain Inside the Drawer',
    pitch: 'A teaspoon of rain has moved into an old drawer. {name} finds it watering the receipts. The rain says it has always wanted a place of its own. One receipt has already put down roots.',
    care: { need: 'clean', label: 'Freshen up the negotiator', line: 'Give {name} a personal clean before discussing the damp. A fresh start seems diplomatic.' },
    approaches: [
      { id: 'survey', activity: 'outing', label: 'Look for a better address', line: 'Finish an expedition Beyond the Shelf. A short trip still gives {name} somewhere to recommend.' },
      { id: 'tenancy', activity: 'court', label: 'Investigate rain tenancy', line: 'Finish a Shelf Court case. {name} hopes household law has a section on weather with luggage.' }
    ],
    endings: [
      { id: 'bottle', label: 'Rent it a little bottle', keepsake: 'rain-bottle', title: 'The Bottled Bedsit',
        text: '{name} finds a glass bottle with a cork roof. The rain moves in and hangs a tiny curtain. On fine evenings it fogs the window so it can pretend the weather is terrible outside. The receipts dry out. One continues to bloom, out of loyalty.',
        callback: '{name} taps the bottle before looking in. A home is a home.' },
      { id: 'boat', label: 'Build it a boat instead', keepsake: 'rain-boat', title: 'The Drizzle Packet',
        text: '{name} folds a boat from a receipt and points it towards the windowsill. The rain becomes its own sea, which saves enormously on travel. It sends back a damp paper flag from the far side of the saucer. The message is simply: “Room to stretch.”',
        callback: '{name} keeps the paper boat ready in case the rain wants to visit.' }
    ]
  },
  {
    id: 'unbirthday',
    title: 'The Unbirthday Committee',
    pitch: '{name} has received a birthday invitation with the date left blank. Nobody remembers being born, and nobody is likely to get on with dying. The committee suggests celebrating something more available.',
    care: { need: 'fuss', label: 'Make the guest feel wanted', line: 'Give {name} a moment of personal fuss. No birthday, reason, or explanation is required.' },
    approaches: [
      { id: 'supplies', activity: 'market', label: 'Browse for party supplies', line: 'Finish a trip to the Night Market. An unsuitable purchase makes a perfectly respectable party anecdote.' },
      { id: 'toast', activity: 'memory', label: 'Rehearse an awkward toast', line: 'Play Secret Handshake. The committee has agreed that losing your place is a form of spontaneity.' }
    ],
    endings: [
      { id: 'years', label: 'Celebrate all the unknown years', keepsake: 'ever-candle', title: 'The Candle with No Number',
        text: '{name} lights one candle for every year nobody can remember. Fortunately, one will do. It refuses to burn down until someone makes a wish, so the committee wishes for more time to think. The flame settles into a comfortable glow. Nobody is late for anything.',
        callback: '{name} calls the candle “about the right number”.' },
      { id: 'here', label: 'Celebrate being here together', keepsake: 'unbirthday-rosette', title: 'The Glad-You-Are-Here Ribbon',
        text: '{name} crosses “birthday” off the invitation and writes “here”. A ribbon is awarded for attending, including to the table. They sing so loudly a tooth falls into the icing. The table wins Best Smile and is immediately accused of nepotism.',
        callback: '{name} keeps the ribbon where it can be seen on completely ordinary days.' }
    ]
  },
  {
    id: 'midnight-post',
    title: 'The Midnight Post Office',
    pitch: 'A letter addressed to Nobody in Particular has arrived for {name} to sort. It weighs slightly more than paper should. Inside, someone asks whether there is room in the world for one more peculiar thing.',
    care: { need: 'fuss', label: 'A moment for the postmaster', line: 'Give {name} some personal fuss before answering a question that deserves a careful answer.' },
    approaches: [
      { id: 'sender', activity: 'alibi', label: 'Learn to read between the lines', line: 'Finish The Alibi. Whatever you deduce, {name} will have practised listening to an unlikely account.' },
      { id: 'route', activity: 'outing', label: 'Scout the postal route', line: 'Finish an expedition Beyond the Shelf. Every journey home is useful experience for a very small postal service.' }
    ],
    endings: [
      { id: 'deliver', label: 'Let the whole shelf answer', keepsake: 'nobody-stamp', title: 'The Stamp for Nobody',
        text: '{name} carries the letter along the shelf and collects a small yes from every quiet corner. The reply is stamped with a button dipped in ink. By morning, a new envelope waits beside it: “Thank you. I thought so, but it helped to ask.” Nobody signs either letter.',
        callback: '{name} checks the quiet corners for outgoing post.' },
      { id: 'reply', label: 'Write a personal reply', keepsake: 'reply-envelope', title: 'The First Letter Back',
        text: '{name} writes: “There is room beside me. You may be peculiar quietly or loudly; we have both.” The letter disappears into the crack behind the shelf. An answer emerges smelling faintly of distant rain. A correspondence begins. Neither writer asks the other to be less strange.',
        callback: '{name} leaves a little space beside the inkpot for the next letter.' }
    ]
  },
  {
    id: 'spoon-opera',
    title: 'The Spoon Opera',
    pitch: 'A teaspoon has asked {name} to stage its opera. The score is one note held for an unreasonable time. The spoon says the tragedy is in the duration. A nearby fork has already submitted a review.',
    care: { need: 'clean', label: 'Dress rehearsal, freshly polished', line: 'Give {name} a personal clean before the production meeting. There will be mirrors, even if they are all spoons.' },
    approaches: [
      { id: 'rehearsal', activity: 'memory', label: 'Practise the conductor’s cues', line: 'Play Secret Handshake. Missed gestures will give {name} useful experience handling a difficult rehearsal.' },
      { id: 'cue', activity: 'chase', label: 'Chase the runaway interval snacks', line: 'Finish a Crumb Chase. {name} needs to understand why the interval is attracting more interest than the opera.' }
    ],
    endings: [
      { id: 'solo', label: 'Give the spoon its great solo', keepsake: 'silver-baton', title: 'The Needle Baton',
        text: '{name} raises a needle baton. The spoon sings its one note until a distant kettle answers in harmony. The fork withdraws its review. For a moment the whole cupboard rings like a cathedral, and even the cups stand a little straighter. The interval snacks receive a separate curtain call.',
        callback: '{name} keeps the baton wrapped in felt. Even a conductor needs quiet.' },
      { id: 'chorus', label: 'Invite everyone into the chorus', keepsake: 'choir-ticket', title: 'The Everyone Ticket',
        text: '{name} hands a programme to every object willing to make a noise. The spoon leads, the fork hums, and the drawer contributes one exceptionally moving creak. The audience becomes the chorus. Afterwards, nobody can agree what the opera was about. Everyone remembers their part.',
        callback: '{name} has kept one ticket. It says “Admit all”.' }
    ]
  },
  {
    id: 'drawer-dragon',
    title: 'The Last Drawer Dragon',
    pitch: '{name} has been summoned to deal with a dragon in the sewing box. It is mostly lint, but it has collected three pins and developed the appropriate attitude. Its roar is a tiny, embarrassed sneeze.',
    care: { need: 'food', label: 'A snack before dragon business', line: 'Give {name} a personal snack. Nobody should negotiate with a dragon while thinking about lunch.' },
    approaches: [
      { id: 'mystery', activity: 'alibi', label: 'Investigate the missing treasure', line: 'Finish The Alibi. {name} would like some detective practice before questioning anything with imaginary flames.' },
      { id: 'claim', activity: 'court', label: 'Hear the dragon’s claim', line: 'Finish a case in Shelf Court. Even a difficult hearing gives {name} something to bring to the sewing box.' }
    ],
    endings: [
      { id: 'keeper', label: 'Appoint it keeper of small treasures', keepsake: 'dragon-key', title: 'The Treasury Key',
        text: '{name} names the dragon Keeper of Things Too Small to Find Again. It takes the job extremely seriously and sorts its hoard into pins, nearly pins, and emotionally significant fluff. A brass key is issued to {name}. It opens nothing, but the dragon recognises the authority.',
        callback: '{name} shows the treasury key before borrowing even a little bit of thread.' },
      { id: 'gifts', label: 'Show it how presents work', keepsake: 'dragon-parcel', title: 'The Dragon’s First Present',
        text: '{name} explains that a treasure can become larger by belonging to someone else. The dragon thinks for a long time, then wraps its best pin in velvet. Inside is also a scale made of lint. It keeps the other two pins. Generosity, it decides, is something to practise.',
        callback: '{name} has never opened the velvet wrapping without folding it neatly afterwards.' }
    ]
  }
];

const episodesById = new Map(ESCAPADES.map(episode => [episode.id, episode]));

export function escapadeById(id) {
  return episodesById.get(id) || null;
}

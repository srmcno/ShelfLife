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
      { id: 'orbit', activity: 'arcade:frenzy', label: 'Follow a crumb trail', line: 'Play a round of Feeding Frenzy. {name} is collecting observations, mostly by eating them.' },
      { id: 'equipment', activity: 'arcade:stack', label: 'Build an observation tower', line: 'Play Coffin Stack. The tallest pile of coffins in the parish makes a respectable telescope mount.' }
    ],
    endings: [
      { id: 'discovery', label: 'Name a new constellation', keepsake: 'crumb-telescope', title: 'The Biscuit-Scope',
        text: '{name} trains the paper telescope on the crumb. There is something eating it from the other side. The new star chart has eight legs. The astronomer folds the tube shut and labels it after the discoverer. It scratches at the label.',
        callback: '{name} keeps a thumb over the telescope when the scratching starts.' },
      { id: 'supper', label: 'Invite the comet to supper', keepsake: 'orbit-saucer', title: 'A Saucer for a Comet',
        text: '{name} untangles the crumb and seats it on a saucer. It has legs underneath. They set eight more places. The butter is carried away before anyone can introduce themselves; the saucer stays as a warning about inviting food home.',
        callback: '{name} checks beneath the saucer before laying the table.' }
    ]
  },
  {
    id: 'small-haunting',
    title: 'A Very Small Haunting',
    pitch: 'A ghost the size of a sugar grain has applied to haunt {name}. It fits through a stitch. It has already measured the hollow behind one eye.',
    care: { need: 'fuss', label: 'Steady the host', line: 'Give {name} a moment of personal fuss before meeting the applicant. The ghost has brought its own key.' },
    approaches: [
      { id: 'rehearse', activity: 'arcade:seance', label: 'Rehearse the haunting', line: 'Hold a Séance. The ghost must learn which candles belong to the resident.' },
      { id: 'references', activity: 'arcade:whack', label: 'Check its references', line: 'Play Grave Whack. {name} would like to meet the ghost’s previous colleagues, briefly, on their way back down.' }
    ],
    endings: [
      { id: 'home', label: 'Offer it a place to stay', keepsake: 'ghost-bed', title: 'The Spare Matchbox',
        text: '{name} gives the ghost a matchbox bed. By morning it has hollowed a second pillow out of the first. It says its mother is staying. The ghost is a sugar grain wide; the impression beside it has adult teeth.',
        callback: '{name} knocks on the matchbox. Two things answer at different heights.' },
      { id: 'holiday', label: 'Give it some time off', keepsake: 'holiday-bell', title: 'The Off-Duty Bell',
        text: '{name} gives the ghost a bell and a day off. It returns without the clapper. A tooth fits the gap perfectly. The ghost says the owner was finished with it. The bell rings once from inside the locked matchbox.',
        callback: '{name} keeps the bell away from its mouth. It rings when it gets too close.' }
    ]
  },
  {
    id: 'button-republic',
    title: 'The Republic of One Button',
    pitch: '{name} has found a loose button and declared it a country. It has four holes, no roads, and a border dispute with a very patient bit of thread.',
    care: { need: 'food', label: 'A snack for the founder', line: 'Give {name} a personal snack. Constitutions are difficult work on an empty stomach.' },
    approaches: [
      { id: 'legal', activity: 'arcade:whack', label: 'Guard the border', line: 'Play Grave Whack. Whatever climbs out, {name} will return with an opinion about borders.' },
      { id: 'survey', activity: 'outing', label: 'Scout beyond the border', line: 'Finish an expedition Beyond the Shelf. Every return journey gives a new country something to put on its map.' }
    ],
    endings: [
      { id: 'crown', label: 'Give the button a monarch', keepsake: 'button-crown', title: 'The Crown of Almost Nothing',
        text: '{name} crowns the button with a bottle cap. The monarch demands a neck for the opening ceremony. The thread supplies one and pulls it tight. They prop the cap back up afterwards. The coronation portrait is taken from below.',
        callback: '{name} loosens the thread before addressing the crown.' },
      { id: 'passport', label: 'Make everyone a citizen', keepsake: 'button-passport', title: 'A Passport to One Button',
        text: '{name} opens all four borders. The thread enters one hole and leaves through another, stitching the country to a cushion. The button keeps issuing passports. Nobody can leave. The queue has become upholstery.',
        callback: '{name} carries scissors when visiting the button.' }
    ]
  },
  {
    id: 'drawer-rain',
    title: 'The Rain Inside the Drawer',
    pitch: 'A teaspoon of rain has moved into an old drawer. {name} finds it watering the receipts. The rain says it has always wanted a place of its own. One receipt has already put down roots.',
    care: { need: 'clean', label: 'Freshen up the negotiator', line: 'Give {name} a personal clean before discussing the damp. A fresh start seems diplomatic.' },
    approaches: [
      { id: 'survey', activity: 'outing', label: 'Look for a better address', line: 'Finish an expedition Beyond the Shelf. A short trip still gives {name} somewhere to recommend.' },
      { id: 'tenancy', activity: 'arcade:seance', label: 'Ask the previous tenants', line: 'Hold a Séance. {name} hopes the dead remember whether it rained indoors in their day too.' }
    ],
    endings: [
      { id: 'bottle', label: 'Rent it a little bottle', keepsake: 'rain-bottle', title: 'The Bottled Bedsit',
        text: '{name} bottles the rain and corks it. Each morning the waterline is higher. The bottle is dry outside. They move it away from the beds and stop asking why everybody wakes up thirsty.',
        callback: '{name} counts the sleeping residents before checking the bottle.' },
      { id: 'boat', label: 'Build it a boat instead', keepsake: 'rain-boat', title: 'The Drizzle Packet',
        text: '{name} folds the rain a receipt boat. It sets out across a saucer and comes back towing a drowned fly. The fly gets up. The rain pushes it back under with a careful little wave. The boat is kept on dry wood.',
        callback: '{name} shakes the paper boat before putting it down. Sometimes a leg falls out.' }
    ]
  },
  {
    id: 'unbirthday',
    title: 'The Unbirthday Committee',
    pitch: '{name} has received a birthday invitation with the date left blank. Nobody remembers being born, and nobody is likely to get on with dying. The committee suggests celebrating something more available.',
    care: { need: 'fuss', label: 'Make the guest feel wanted', line: 'Give {name} a moment of personal fuss. No birthday, reason, or explanation is required.' },
    approaches: [
      { id: 'supplies', activity: 'arcade:frenzy', label: 'Gather the party snacks', line: 'Play a round of Feeding Frenzy. Whatever survives the catering becomes the buffet.' },
      { id: 'toast', activity: 'arcade:seance', label: 'Rehearse an awkward toast', line: 'Hold a Séance. The committee has agreed that losing your place is a form of spontaneity.' }
    ],
    endings: [
      { id: 'years', label: 'Celebrate all the unknown years', keepsake: 'ever-candle', title: 'The Candle with No Number',
        text: '{name} lights the candle and asks everyone to make a wish. The flame leans towards each mouth in turn. By midnight it has grown an inch. They stop wishing. The wick keeps whispering the unfinished ones.',
        callback: '{name} snuffs the candle with a cup. It has learned not to blow.' },
      { id: 'here', label: 'Celebrate being here together', keepsake: 'unbirthday-rosette', title: 'The Still-Here Ribbon',
        text: '{name} awards a ribbon for still being here. The table is eligible. During the song a tooth lands in the icing; the table takes it through a crack. They award it Best Smile before anybody sees the rest.',
        callback: '{name} leaves the ribbon on the table. The crack opens if anyone tries to move it.' }
    ]
  },
  {
    id: 'midnight-post',
    title: 'The Midnight Post Office',
    pitch: 'A letter addressed to Nobody in Particular has arrived for {name} to sort. It weighs slightly more than paper should. Something inside presses against the envelope when the room gets quiet. The return address is underneath the shelf.',
    care: { need: 'fuss', label: 'A moment for the postmaster', line: 'Give {name} some personal fuss before answering a question that deserves a careful answer.' },
    approaches: [
      { id: 'sender', activity: 'arcade:seance', label: 'Learn to read between the lines', line: 'Hold a Séance. {name} will have practised taking messages from something with no handwriting.' },
      { id: 'route', activity: 'outing', label: 'Scout the postal route', line: 'Finish an expedition Beyond the Shelf. Every journey home is useful experience for a very small postal service.' }
    ],
    endings: [
      { id: 'deliver', label: 'Let the whole shelf answer', keepsake: 'nobody-stamp', title: 'The Stamp for Nobody',
        text: '{name} carries the letter along the shelf. Every quiet corner says yes. The reply is stamped and posted. That night each corner is occupied by an elbow. There are more elbows than corners. Nobody will say which ones belong together.',
        callback: '{name} addresses outgoing letters to the elbows separately.' },
      { id: 'reply', label: 'Write a personal reply', keepsake: 'reply-envelope', title: 'The First Letter Back',
        text: '{name} writes, “There is room beside me.” An envelope arrives with a strip of measuring tape inside. Then another, containing one damp inch of something. It is a long correspondence. The promised space is getting wider.',
        callback: '{name} leaves new envelopes sealed until it has moved the bowl.' }
    ]
  },
  {
    id: 'spoon-opera',
    title: 'The Spoon Opera',
    pitch: 'A teaspoon has asked {name} to stage its opera. The score is one note held for an unreasonable time. The spoon says the tragedy is in the duration. A nearby fork has already submitted a review.',
    care: { need: 'clean', label: 'Dress rehearsal, freshly polished', line: 'Give {name} a personal clean before the production meeting. There will be mirrors, even if they are all spoons.' },
    approaches: [
      { id: 'rehearsal', activity: 'arcade:seance', label: 'Practise the conductor’s cues', line: 'Hold a Séance. Missed candles will give {name} useful experience handling a difficult rehearsal.' },
      { id: 'cue', activity: 'arcade:frenzy', label: 'Catch the runaway interval snacks', line: 'Play a round of Feeding Frenzy. {name} needs to understand why the interval is attracting more interest than the opera.' }
    ],
    endings: [
      { id: 'solo', label: 'Give the spoon its great solo', keepsake: 'silver-baton', title: 'The Needle Baton',
        text: '{name} raises the needle baton. The spoon holds its note until the kettle screams and something drops out of the spout. The fork turns its review face down. They keep the baton, but rehearse with the kettle lid tied shut.',
        callback: '{name} wraps the baton in felt. The kettle still flinches.' },
      { id: 'chorus', label: 'Invite everyone into the chorus', keepsake: 'choir-ticket', title: 'The Everyone Ticket',
        text: '{name} gives every object a ticket. The drawer supplies a creak, the fork a rattle, and the spoon a note that will not stop. They shut the drawer on the chorus. It carries on for three days. The remaining ticket says “Admit all”. Nobody is tearing it.',
        callback: '{name} listens at the drawer before opening it.' }
    ]
  },
  {
    id: 'drawer-dragon',
    title: 'The Last Drawer Dragon',
    pitch: '{name} has been summoned to deal with a dragon in the sewing box. It is mostly lint, but it has collected three pins and developed the appropriate attitude. Its sneeze drives a pin through the drawer lining.',
    care: { need: 'food', label: 'A snack before dragon business', line: 'Give {name} a personal snack. Nobody should negotiate with a dragon while thinking about lunch.' },
    approaches: [
      { id: 'mystery', activity: 'arcade:stack', label: 'Build a lookout for the treasure', line: 'Play Coffin Stack. {name} would like a better view before questioning anything with pins in its mouth.' },
      { id: 'claim', activity: 'arcade:whack', label: 'Hold back the dragon’s cousins', line: 'Play Grave Whack. Even a messy night gives {name} something to bring to the sewing box.' }
    ],
    endings: [
      { id: 'keeper', label: 'Appoint it keeper of small treasures', keepsake: 'dragon-key', title: 'The Treasury Key',
        text: '{name} appoints the lint dragon keeper of small treasures. It sorts the pins, the teeth and the things that used to be attached to the teeth. The brass key opens nothing. It is for prising the dragon’s mouth apart when someone needs a pin.',
        callback: '{name} wipes the treasury key after every use.' },
      { id: 'gifts', label: 'Show it how presents work', keepsake: 'dragon-parcel', title: 'The Dragon’s First Present',
        text: '{name} asks the dragon for a present. It wraps its sharpest pin in velvet, point out. The parcel keeps closing when anyone tries to unwrap it. The dragon has given away one of its mouths. It seems to miss that one.',
        callback: '{name} feeds a thread through the velvet before opening it.' }
    ]
  }
];

const episodesById = new Map(ESCAPADES.map(episode => [episode.id, episode]));

export function escapadeById(id) {
  return episodesById.get(id) || null;
}

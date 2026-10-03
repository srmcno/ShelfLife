/* ================= EMERGENCIES, VOLUME TWO =================
   Forty-eight more cards for the mayhem loop. Same shape and the same rules as
   the base set in content/mayhem.js ({a} is the resident the card is about, {b}
   a second resident and only on `pair: true` cards; dry, dark, specific; the
   funniest beat last; curly quotes; no dashes).

   Two optional fields are new, both read by outcomeWeight in engine/mayhem.js:
     fits:   [trait ids]  a resident with any of these traits is three times as
                          likely to get this ending, and the risk read on the card
                          moves with it. Choose the lists from the groups below.
     bondAt: n            a resident whose trust is n or more is three times as
                          likely to get this ending.
   Never both on one outcome, and never the trait `damp`: it is the test fixture. */

// Groups of traits an ending can be written for. About a quarter of residents belong to each.
const STAGEY = ['theatrical', 'terminal', 'narcissist', 'method', 'martyr', 'influencer', 'prophet', 'understudy'];
const GLOOMY = ['doom', 'paranoid', 'nihilist', 'doomscroll', 'insomniac', 'cursed', 'haunted'];
const OFFICIAL = ['complaints', 'litigious', 'auditor', 'steward', 'management', 'etiquette', 'executor', 'critic'];
const MORBID = ['undertaker', 'mourner', 'bones', 'taxidermy', 'physician', 'ancient', 'fungal', 'cryptid'];
const CHATTY = ['gossip', 'socialite', 'witness', 'clingy', 'lifecoach', 'hummer', 'revisionist'];
const FIERCE = ['feral', 'bitey', 'spiteful', 'napoleon', 'fullname', 'steward', 'loadbearing'];
const ODD = ['cult', 'astrology', 'swarm', 'reflection', 'cryptid', 'sleepwalker', 'unblinking', 'haunted', 'prophet', 'amnesiac'];
const GREEDY = ['magpie', 'hoarder', 'landlord', 'timeshare', 'closer', 'freegan', 'auditor'];
const TIDY = ['clean', 'minimalist', 'etiquette', 'porcelain'];
const FORGETFUL = ['amnesiac', 'sleepwalker', 'insomniac', 'revisionist'];
const OLD = ['ancient', 'heirloom', 'cryptid', 'porcelain'];
const WANDERERS = ['cult', 'clingy', 'sleepwalker', 'feral'];

export const EXTRA_EMERGENCIES = [
  { id: 'library-book', title: 'The library wants {a}’s book back. It has been out since 1923. It is called Teach Yourself Haunting.', art: 'book',
    choices: [
      { label: 'Return it with an apology', outcomes: [
        { tone: 'good', stamp: 'OVERDUE', text: '“We assumed you had died,” says the librarian. “I am working on it,” says {a}. The fine is a hundred and two years, payable in whispers.', souls: 16 },
        { tone: 'bad', stamp: 'RENEWED', text: 'It cannot go back. It has been renewed every year since 1923, at night, in {a}’s handwriting. {a} wants a word with whoever has been using its hands.', souls: 12, grudge: 'a', fits: FORGETFUL }
      ] },
      { label: 'Let {a} finish chapter three', outcomes: [
        { tone: 'good', stamp: 'NATURAL', text: '{a} masters a proper moan, low and wet, with a hitch at the end. A window shuts across the road. The library sends a card: “Well done. Please return.”', souls: 19, a: { fuss: 20 }, fits: STAGEY },
        { tone: 'weird', stamp: 'CHAPTER FOUR', text: 'Chapter three is about doors. {a} reads it aloud and eleven doors open in the house. You had not seen any of them. One has your name on a coat hook.', souls: 22, curio: true }
      ] }
    ] },
  { id: 'thirteenth-hour', title: 'The clock has struck thirteen. {a} says nothing said in the extra hour can be denied afterwards.', art: 'clock',
    choices: [
      { label: 'Ask {a} what it really thinks', outcomes: [
        { tone: 'good', stamp: 'CONFESSED', text: '{a} admits it likes the bowl, loathes the lamp and has been moving your slippers on purpose. You feel closer. The slippers go back in a better order.', souls: 17, bond: 'a' },
        { tone: 'bad', stamp: 'ASKED', text: '“Do you actually like me?” The clock strikes a half hour that does not exist, to spare you the answer. {a} studies the carpet. So do you.', souls: 12, grudge: 'a', fits: ['spiteful', 'critic', 'nihilist', 'fullname', 'complaints'] }
      ] },
      { label: 'Use the hour yourself', outcomes: [
        { tone: 'weird', stamp: 'ON THE RECORD', text: 'You confess to the thing with the biscuits. A voice in the wall says “Finally.” Everyone has taken notes, and {a} has taken them in ink.', souls: 20 },
        { tone: 'good', stamp: 'UNBURDENED', text: 'You say all of it, to a shelf of small patient faces. {a} says “same”. The lamp flickers. Nobody mentions it again, which is the kindest thing the shelf has ever done.', souls: 16 }
      ] }
    ] },
  { id: 'packed-ham', title: '{a} says the world ends at 4:40 this afternoon. It is 4:35. {a} is packed and standing at the door.', art: 'bone',
    choices: [
      { label: 'Wait at the door with {a}', outcomes: [
        { tone: 'weird', stamp: 'POSTPONED', text: 'At 4:41 {a} unpacks a torch, a letter of apology to the world and a ham. “Postponed,” it says, and starts on the ham, a little offended on the world’s behalf.', souls: 20, a: { food: 25 }, fits: ['doom', 'paranoid', 'prophet', 'astrology'] },
        { tone: 'good', stamp: 'DRILLED', text: 'You wait together. 4:40 comes and goes. {a} is so relieved it hugs the ham. You are both slightly disappointed, and slightly full of ham.', souls: 16, bond: 'a' }
      ] },
      { label: 'Tell it the world is fine', outcomes: [
        { tone: 'bad', stamp: 'DISPUTED', text: '“The world is fine,” you say. {a} produces a diagram of you being wrong. It is well drawn. The ham is in it, for scale.', souls: 13, grudge: 'a', fits: ['doom', 'prophet', 'napoleon', 'narcissist'] },
        { tone: 'weird', stamp: 'ON THE DOT', text: 'At 4:40 exactly the kettle clicks off, the lamp blinks and, a long way away, a door shuts. Nothing else. {a} ticks something off a list. “That will be the first,” it says.', souls: 21 }
      ] }
    ] },
  { id: 'bin-day', title: 'It is bin day. {a} is in the bin, on purpose. It wants to know how being thrown away feels.', art: 'box',
    choices: [
      { label: 'Fish it out before the lorry', outcomes: [
        { tone: 'good', stamp: 'FISHED OUT', text: 'You pull it out. {a} is damp, peeling and deeply moved. “I knew you would come,” it says. “I was not sure it would be before the lorry.”', souls: 16, bond: 'a', bondAt: 6, a: { fuss: 25 } },
        { tone: 'bad', stamp: 'ATTACHED', text: 'It comes out with a teabag, a fishbone and a point of view. {a} wears the teabag for a week and will not be told about the smell.', souls: 12, a: { clean: -20 } }
      ] },
      { label: 'Let the lorry take it', outcomes: [
        { tone: 'weird', stamp: 'ON THE ROUND', text: 'The crew take to it. It is back by four in a hi-vis vest with a route of its own and strong views on people who do not flatten their boxes.', souls: 22, curio: true, fits: ['steward', 'loadbearing', 'management', 'lifecoach', 'napoleon'] },
        { tone: 'bad', stamp: 'LANDFILL', text: 'It is gone eleven hours. It comes back and says only “so that is where everything goes”, and looks at your bin the way you would look at a relative’s grave.', souls: 13 }
      ] }
    ] },
  { id: 'wardrobe-decades', title: '{a} keeps going into the wardrobe at night and coming out in a different decade.', art: 'door',
    choices: [
      { label: 'Follow {a} in', outcomes: [
        { tone: 'weird', stamp: 'BROWN', text: 'Inside it is 1974. Everything is brown. {a} has a moustache, a flask and a strong view on decimalisation, and has been paying into a pension here for years.', souls: 21, fits: [...OLD, 'amnesiac', 'revisionist'] },
        { tone: 'good', stamp: 'COATS', text: 'You come out with a fur coat, a bus ticket for a route that no longer runs and the smell of a pub that is now a bank. {a} says you have a knack.', souls: 17, curio: true },
        { tone: 'bad', stamp: 'STRANDED', text: 'You come out in 1983, beside a family at tea. They are very polite. You stay for the trifle. {a} has to fetch you, and is cold about it for a week.', souls: 12, grudge: 'a' }
      ] },
      { label: 'Lock the wardrobe', outcomes: [
        { tone: 'weird', stamp: 'KNOCKING', text: 'At midnight something inside knocks back, politely, in {a}’s voice but older. It says it has missed its stop by about forty years.', souls: 19 },
        { tone: 'good', stamp: 'HOME FOR TEA', text: '{a} sulks, then tries the present for the first time. “Adequate,” it says, and asks for the bowl.', souls: 14, a: { food: 20 } }
      ] }
    ] },
  { id: 'wifi-password', title: '{a} has changed the wifi password to a full sentence. It is an accusation. Everyone is typing it in.', art: 'scroll',
    choices: [
      { label: 'Ask what you did', outcomes: [
        { tone: 'weird', stamp: 'SPECIFIC', text: '“You know what you did.” You do not. It changes the password to the date, the time and the room. Everyone types it in, then looks at you.', souls: 20, fits: ['spiteful', 'fullname', 'auditor', 'complaints', 'witness'] },
        { tone: 'bad', stamp: 'NUMBERED', text: 'It gives you the list. It is numbered. Number nine is how you stir tea. By midnight the password is the list, and the router needs a restart to read it.', souls: 13, grudge: 'a' }
      ] },
      { label: 'Type it in and say nothing', outcomes: [
        { tone: 'good', stamp: 'CONNECTED', text: 'You type YOUKNOWWHATYOUDID with a blank face. The connection is excellent. {a} is thrown by the lack of drama and changes the password to something kind.', souls: 16, bond: 'a', bondAt: 8 },
        { tone: 'weird', stamp: 'SIGNAL', text: 'The router lets you in, and a second network appears beside the first: Forgiven (Weak Signal). Nobody brings it up.', souls: 18 }
      ] }
    ] },
  { id: 'estate-agent', title: 'An estate agent is valuing the shelf. He keeps calling {a} “an original feature”.', art: 'key',
    choices: [
      { label: 'Let him finish the valuation', outcomes: [
        { tone: 'good', stamp: 'CHARACTERFUL', text: 'He writes “Characterful. Some damp. Sold with resident.” {a} is thrilled to be in print. The house is valued higher than ever, and {a} takes the credit.', souls: 18, a: { fuss: 20 }, fits: [...GREEDY, 'narcissist', 'influencer'] },
        { tone: 'bad', stamp: 'MODERNISE', text: 'In the brochure {a} is “in need of some modernisation”. It reads this standing up. It is now taking steps, and has chosen a shade of beige.', souls: 12 }
      ] },
      { label: 'Show him out', outcomes: [
        { tone: 'good', stamp: 'VIEWING', text: 'At the door he asks if the resident “comes with the property”. “I was here first,” says {a}. He writes that down too, and the price goes up.', souls: 16 },
        { tone: 'weird', stamp: 'OFFER', text: 'A couple make an offer at six. For {a}. Full asking price, no chain. {a} accepts before you can speak. You have twenty-eight days to exchange. It already has a forwarding address.', souls: 21 }
      ] }
    ] },
  { id: 'pest-control', title: 'A man from pest control has arrived with a clipboard. {a} is on it.', art: 'paw',
    choices: [
      { label: 'Say {a} is a pet', outcomes: [
        { tone: 'good', stamp: 'REGISTERED', text: 'He looks at {a}, at the clipboard, at {a}. “Pet.” He ticks a box. {a} hates the word, but is now on a form that proves it lives here.', souls: 16, bond: 'a', bondAt: 8 },
        { tone: 'bad', stamp: 'VACCINATED', text: 'He asks for proof of vaccination. {a} is fully inoculated against 1643 and nothing since. He does not know which of you to feel worse for.', souls: 13 }
      ] },
      { label: 'Let him assess it', outcomes: [
        { tone: 'weird', stamp: 'LIVING WITH IT', text: 'He studies {a} for a quarter of an hour and shuts the clipboard. “Not a pest, not a pet, not a problem I am licensed for.” He leaves a leaflet called Living With It.', souls: 22, curio: true, fits: ['feral', 'bitey', 'swarm', 'cryptid', 'fungal'] },
        { tone: 'good', stamp: 'SIGNED OFF', text: 'He ticks everything, then finds the nest {a} has made behind the cooker. It has a doily. He calls it the best appointed infestation he has seen and signs it off for the year.', souls: 18 }
      ] }
    ] },
  { id: 'tidying', title: '{a} has been watching a programme about tidying. It thanks your shoes before it puts them in the bin.', art: 'hand',
    choices: [
      { label: 'Defend the shoes', outcomes: [
        { tone: 'good', stamp: 'SPARED', text: '“These bring me joy,” you say, holding up the left. {a} considers it for a long minute and nods once. It puts the shoes back, and thanks them again, for staying.', souls: 16 },
        { tone: 'bad', stamp: 'PURGED', text: 'It hears your case with the sorrow of a surgeon. The shoes go anyway, thanked. It looks at your coat next. Then at you, for longer than is comfortable.', souls: 12, grudge: 'a', fits: TIDY }
      ] },
      { label: 'Give it the cupboard under the stairs', outcomes: [
        { tone: 'weird', stamp: 'ELSEWHERE', text: 'It thanks forty objects and bins thirty. At the back it thanks something that thanks it back. By evening the cupboard is a little deeper than it was.', souls: 21, curio: true },
        { tone: 'good', stamp: 'DECLUTTERED', text: 'It finds a tin of buttons, a map, a second map and a bicycle nobody remembers. It thanks them all, bins none, and labels the tin JOY.', souls: 17, a: { fuss: 15 } }
      ] }
    ] },
  { id: 'museum-plaque', title: 'A school party is touring the shelf. The guide calls {a} “late medieval, domestic, do not feed”.', art: 'photo',
    choices: [
      { label: 'Let {a} be an exhibit', outcomes: [
        { tone: 'good', stamp: 'ON DISPLAY', text: '{a} holds perfectly still for ninety minutes while thirty children draw it. Every drawing has the wrong number of legs. {a} frames the best and signs the corner.', souls: 18, a: { fuss: 20 }, fits: ['method', 'unblinking', 'porcelain', 'narcissist', 'influencer'] },
        { tone: 'weird', stamp: 'LABELLED', text: 'A plaque appears on the plank: ORIGIN UNKNOWN. DATE UNCERTAIN. DO NOT TOUCH. DO NOT MEET ITS EYE. {a} loves it and forbids you to change a word.', souls: 20, curio: true }
      ] },
      { label: 'Correct the guide', outcomes: [
        { tone: 'bad', stamp: 'NOT ON THE LIST', text: 'You say {a} is a resident. The guide checks his notes: “Not on my list.” A child asks if it is dead. “Not formally,” says {a}, and loses the room.', souls: 13, grudge: 'a' },
        { tone: 'good', stamp: 'DOCENT', text: '{a} is invited to give the tour, in a voice nobody has heard from it before. It does the whole shelf, with dates. Several of the dates are in the future.', souls: 19, bond: 'a', bondAt: 10 }
      ] }
    ] },
  { id: 'old-alias', title: 'The phone is for “Madame Zelda”. {a} has said “speaking”.', art: 'ring',
    choices: [
      { label: 'Hand {a} the phone', outcomes: [
        { tone: 'weird', stamp: 'WITH INTEREST', text: 'The caller is owed twelve shillings from 1743. With interest {a} now owes him the house, the street and a small county. It offers to settle in biscuits.', souls: 21, fits: OLD },
        { tone: 'bad', stamp: 'DEPOSIT', text: 'He wants his deposit back. And his hat. And the other thing. {a} says it remembers none of it, in a voice it last used on a ship.', souls: 13 }
      ] },
      { label: 'Say Madame Zelda has moved on', outcomes: [
        { tone: 'good', stamp: 'CONDOLENCES', text: 'He is gutted, and sends flowers. They are lovely. {a} accepts them as the bereaved, with great dignity, and wears black until the petals drop.', souls: 17, a: { fuss: 20 }, fits: [...STAGEY, 'mourner'] },
        { tone: 'weird', stamp: 'WHITBY', text: 'He says “Tell her I know what she did at Whitby” and hangs up. {a} stays by the phone for an hour, then lays a place for three at dinner.', souls: 20 }
      ] }
    ] },
  { id: 'death-survey', title: 'A satisfaction survey has come for {a}. Question one: “How was your death?” {a} has not died.', art: 'skull',
    choices: [
      { label: 'Fill it in honestly', outcomes: [
        { tone: 'good', stamp: 'RECOMMENDED', text: 'You tick “has not happened yet”. The reply comes within the hour: “Thank you! Would you recommend us to a friend?” {a} supplies a name. It is yours.', souls: 16 },
        { tone: 'weird', stamp: 'FOLLOW UP', text: 'A second survey arrives: “How was your death? (Anticipated.)” It has a box for comments and a prepaid envelope in the shape of a very small coffin.', souls: 21, curio: true }
      ] },
      { label: 'Let {a} fill it in', outcomes: [
        { tone: 'weird', stamp: 'TWO STARS', text: '{a} gives it two stars. “Nobody told me where anything was. Staff were absent. I did not die.” By return: an apology, a discount and a voucher for next time.', souls: 20, fits: ['critic', 'complaints', 'litigious', 'terminal'] },
        { tone: 'bad', stamp: 'FREE TEXT', text: '{a} uses the free text box. All of it. There is a lot. The survey crashes, and then someone in the post room telephones to say he will have to escalate this.', souls: 12 }
      ] }
    ] },
  { id: 'private-rain', title: 'A small, private rain has started falling on {a} and nowhere else. {a} says it is not complaining.', art: 'ink',
    choices: [
      { label: 'Move {a} somewhere dry', outcomes: [
        { tone: 'weird', stamp: 'TAGGED ALONG', text: 'You move it to the other end of the shelf. The cloud follows, carrying an overnight bag the size of a pea. It says it does not want to be a bother. It sits on the bowl.', souls: 20 },
        { tone: 'bad', stamp: 'DOWNPOUR', text: 'The cloud takes it personally. By evening there is thunder, and a lightning bolt the width of a hair that goes straight for the biscuits.', souls: 12, fits: ['spiteful', 'cursed', 'bitey'] }
      ] },
      { label: 'Let {a} get on with it', outcomes: [
        { tone: 'good', stamp: 'THRIVING', text: 'A week of rain does wonders. {a} has never looked better, and the fern has started to notice. Cuttings are being requested.', souls: 17, a: { clean: 25 }, fits: ['fungal', 'mourner', 'porcelain', 'glitter'] },
        { tone: 'weird', stamp: 'TIDAL', text: 'By teatime there is a puddle, by dusk a pond, by midnight a small estuary. {a} has built a pier out of pegs and is charging a ha’penny for the ferry.', souls: 21 }
      ] }
    ] },
  { id: 'dinner-for-nine', title: '{a} has laid the table for nine. There are five of you. {a} keeps glancing at the door.', art: 'spoon',
    choices: [
      { label: 'Take away the extra chairs', outcomes: [
        { tone: 'bad', stamp: 'REMOVED', text: 'The chairs are warm. The cutlery has been used. A note is left on the cloth in a courteous hand: “We will remember this.”', souls: 13 },
        { tone: 'good', stamp: 'RELIEF', text: 'You clear them away. {a} exhales as if the house has been holding its breath. The cold spot by the door leaves, a bit offended, taking its coat.', souls: 16, a: { fuss: 15 } }
      ] },
      { label: 'Sit in one of them', outcomes: [
        { tone: 'weird', stamp: 'LATE', text: 'The chair is warm. “Ah, there you are,” says the empty chair beside you. “We had given up.” The soup is the best of your life. You are expected every Friday.', souls: 22, curio: true },
        { tone: 'good', stamp: 'GRACE', text: '{a} says grace. It is long, specific and mostly about dust. Four things you cannot see say amen. Nothing is eaten and everyone is content.', souls: 18, bond: 'a', fits: ['etiquette', 'mourner', 'socialite', 'undertaker'] }
      ] }
    ] },
  { id: 'self-rumour', title: '{a} has started a rumour about itself, that it once fought a swan. It wants to see how far it gets.', art: 'head',
    choices: [
      { label: 'Help it along', outcomes: [
        { tone: 'good', stamp: 'NOTORIOUS', text: 'You tell the lamp, and the lamp tells the clock. By breakfast three residents stand when {a} walks in. {a} has never been so respected, or so afraid of swans.', souls: 19, bond: 'a', a: { fuss: 25 }, fits: [...CHATTY, 'narcissist', 'influencer'] },
        { tone: 'weird', stamp: 'LEGEND', text: 'By dinner the swan has a name. By midnight it has a horse and a motive. A woodlouse asks {a} for an autograph, and {a} can no longer deny it without looking small.', souls: 21 }
      ] },
      { label: 'Deny it loudly', outcomes: [
        { tone: 'bad', stamp: 'CONFIRMED', text: 'Your denial is taken as confirmation. Details are added. The swan won. {a} now flinches at pillows, feather dusters and the word “graceful”.', souls: 13, grudge: 'a' },
        { tone: 'good', stamp: 'RETRACTED', text: 'You deny it, and {a} confesses it made the whole thing up. The shelf is almost disappointed. A stiff note arrives from the lake, from a swan, to say he has no idea who you mean.', souls: 15 }
      ] }
    ] },
  { id: 'tunnel-loop', title: '{a} has been tunnelling to freedom with a teaspoon. It has just broken through, into the same shelf.', art: 'shovel',
    choices: [
      { label: 'Tell it the tunnel is a loop', outcomes: [
        { tone: 'bad', stamp: 'DEMORALISED', text: 'You tell it. {a} sits down on the spoon. “Eleven months,” it says, “to end up where I began.” You say that is most people’s experience of a Tuesday. It does not help.', souls: 12, grudge: 'a' },
        { tone: 'good', stamp: 'PIONEER', text: '“A loop is still a tunnel,” says {a}, rallying. It now has the shortest commute on the shelf and a plaque in preparation. Everyone has to walk through it once.', souls: 16, a: { fuss: 20 } }
      ] },
      { label: 'Dig the other end with it', outcomes: [
        { tone: 'weird', stamp: 'WARDEN', text: 'Halfway along you meet another tunnel, with a lantern and a sign: WARDEN’S OFFICE. A tiny man in stripes says “Thank goodness. Is it still Thursday?”', souls: 22, curio: true },
        { tone: 'good', stamp: 'BROKEN OUT', text: 'You break out through the skirting board. {a} stands in the hall for three whole minutes, in the open air, and goes straight back in. “Overrated.” It will tell the story for years.', souls: 16, bond: 'a', fits: WANDERERS }
      ] }
    ] },
  { id: 'hiccup-ghosts', title: '{a} has the hiccups. Each one lets out a small ghost. There is a queue by the skirting board.', art: 'ghost',
    choices: [
      { label: 'Frighten {a}', outcomes: [
        { tone: 'good', stamp: 'CURED', text: 'You leap out from behind the kettle. {a} screams so politely that the hiccups stop. The ghosts file back in, rather offended, in alphabetical order.', souls: 16 },
        { tone: 'bad', stamp: 'WORSE', text: 'You leap out. {a} does not scream. It hiccups, and out comes a ghost the size of a wardrobe, who is very cross at the lack of warning and has come for you.', souls: 12, fits: ['bitey', 'feral', 'napoleon'] }
      ] },
      { label: 'Count them', outcomes: [
        { tone: 'weird', stamp: 'INQUEST', text: 'By eleven there is a queue. By twelve, a committee. By thirteen it is an inquest, and the first twelve have named you as the cause.', souls: 22 },
        { tone: 'good', stamp: 'BLESS YOU', text: 'You put the kettle on. Each ghost says “bless you” on the way out, for no reason anyone can name, and for some reason it works.', souls: 18, bond: 'a', fits: ['haunted', 'mourner', 'undertaker', 'cult'] }
      ] }
    ] },
  { id: 'radio-names', title: 'The radio is reading out the names of the nearly dead. {a} is offended not to be on the list.', art: 'ear',
    choices: [
      { label: 'Request a dedication for {a}', outcomes: [
        { tone: 'weird', stamp: 'DEDICATED', text: '“This one goes out to {a},” says the presenter, “from someone who wishes it well, or the opposite. Hard to tell on the radio.” The song is a hymn with a good beat.', souls: 21 },
        { tone: 'good', stamp: 'ON AIR', text: '{a} is read out between a gravedigger from Leeds and a very old tortoise. It is on the list at last. It has never felt more included, or more nervous.', souls: 17, fits: ['terminal', 'narcissist', 'influencer', 'ancient', 'martyr'] }
      ] },
      { label: 'Turn it off', outcomes: [
        { tone: 'bad', stamp: 'WHITE NOISE', text: 'You turn it off. The radio stays on, quieter. You can hear it reading your name, very slowly, all the way through the middle names.', souls: 13 },
        { tone: 'good', stamp: 'OFF AIR', text: 'It clicks off. In the quiet {a} admits it did want to be on the list, and is relieved not to be. You make cocoa. It writes a poem about relief that is mostly about cocoa.', souls: 16, bond: 'a', bondAt: 8, a: { food: 15 } }
      ] }
    ] },
  { id: 'freezer-label', title: 'At the back of the freezer is a tub marked DO NOT, in {a}’s handwriting. Under it, in another: PLEASE.', art: 'jar',
    choices: [
      { label: 'Open it', outcomes: [
        { tone: 'good', stamp: 'SOUP', text: 'It is soup. Forty winters old and slightly regional. You have a bowl. “I told you not to,” says {a}, through its own bowl, and asks for the ladle.', souls: 17, a: { food: 25 } },
        { tone: 'weird', stamp: 'NESTED', text: 'Inside is a smaller tub marked DO NOT. Inside that, another. In the last is a spoon and a card: “See? Now you have started.”', souls: 22, curio: true }
      ] },
      { label: 'Add a label of your own', outcomes: [
        { tone: 'good', stamp: 'THIRD HAND', text: 'You write PLEASE, REALLY. A fourth hand adds THANK YOU. Nobody has opened anything. The freezer hums as if, at last, it has been understood.', souls: 15 },
        { tone: 'bad', stamp: 'PADLOCKED', text: 'You write STOP. By morning the tub has a padlock and a sticker reading THIS MEANS YOU. The handwriting on the sticker is yours.', souls: 12 }
      ] }
    ] },
  { id: 'fuse-box', title: '{a} has found the fuse box. One of the fuses is labelled THE OTHER KITCHEN.', art: 'nail',
    choices: [
      { label: 'Flip it', outcomes: [
        { tone: 'weird', stamp: 'LIT', text: 'A light comes on behind the cooker. Through the crack you can see a second kitchen, a tidy one, where someone in your apron is just putting the kettle on.', souls: 22, curio: true },
        { tone: 'bad', stamp: 'BLACKOUT', text: 'The shelf goes dark. In the other kitchen someone says “He flipped it”, someone else says “Told you”, and money changes hands.', souls: 13 }
      ] },
      { label: 'Read out the other labels', outcomes: [
        { tone: 'weird', stamp: 'INVENTORY', text: '{a} reads them: THE LANDING, THE LANDING (AFTER), STAIRS (MOSTLY) and one that just says NOT YET. You agree not to discuss the last one.', souls: 19 },
        { tone: 'good', stamp: 'REPAIRED', text: '{a} finds a fuse that has been blown since 1962 and replaces it. The hall light comes back and so, quietly, does an old agreement between two doors.', souls: 15, bond: 'a', fits: ['auditor', 'steward', 'executor', 'loadbearing'] }
      ] }
    ] },
  { id: 'time-capsule', title: 'Under a floorboard {a} has found a letter from itself, fifty years old. The tone is disappointed.', art: 'brooch',
    choices: [
      { label: 'Read it aloud', outcomes: [
        { tone: 'weird', stamp: 'DEAR ME', text: '“Dear Me, I hope by now you have stopped biting, learned the harp and made peace with the lamp. P.S. If you are reading this, you have not.” {a} reads the postscript twice.', souls: 20, fits: [...FORGETFUL, 'narcissist', 'prophet'] },
        { tone: 'good', stamp: 'TICKED OFF', text: 'The letter lists what young {a} hoped for. Present {a} has managed four by accident, including “be adored by something small”. It looks at you, then away, and ticks that one in pen.', souls: 18, bond: 'a', bondAt: 8 }
      ] },
      { label: 'Help it write back', outcomes: [
        { tone: 'good', stamp: 'REPLY', text: '“Dear Me. I have not learned the harp. I have, however, learned the lamp. Do not worry, you get a shelf.” {a} buries it with a biscuit, to cheer up the younger one.', souls: 19 },
        { tone: 'bad', stamp: 'LOST IN POST', text: 'The reply is mostly apology. It goes under the floorboard, and by midnight it has already been collected. The slip is in a handwriting neither of you knows.', souls: 12 }
      ] }
    ] },
  { id: 'bread-bin-let', title: '{a} has listed the bread bin as a holiday let. The first guest is on the step with a suitcase.', art: 'coffin',
    choices: [
      { label: 'Host the guest', outcomes: [
        { tone: 'good', stamp: 'GOOD REVIEW', text: 'The guest is an elderly moth in a good coat. His review reads: “Cosy. Sleeps one, upright. Host unnervingly attentive.” {a} has it printed on a tea towel.', souls: 17, fits: [...GREEDY, 'influencer', 'socialite'] },
        { tone: 'weird', stamp: 'REGULAR', text: 'The guest signs in as Mr Halloran, checks his watch and says he has booked here every year since 1953. No one has ever asked him to leave. The bread is unusually fresh.', souls: 20 }
      ] },
      { label: 'Cancel the booking', outcomes: [
        { tone: 'bad', stamp: 'ONE STAR', text: 'He leaves one star: “Left on the step. Host watched me through the letterbox and ate a sandwich.” {a} is furious. It would have given him half.', souls: 13, grudge: 'a' },
        { tone: 'good', stamp: 'RETREAT', text: '{a} relists it as an artist’s retreat. The next guest pays double and spends three days writing a poem. It is about bread, and much better than you expected.', souls: 18 }
      ] }
    ] },
  { id: 'school-reunion', title: '{a} has been invited to the class of 1875’s 150th reunion. The invitation says: plus one, alive.', art: 'grave',
    choices: [
      { label: 'Go as the plus one', outcomes: [
        { tone: 'weird', stamp: 'SEATED', text: 'You are seated beside a skeleton in a school tie, who asks what you do. “Accounts.” He puts a hand where his heart was. “Terrible. Terrible about your life.” The room nods.', souls: 22 },
        { tone: 'good', stamp: 'ADMIRED', text: 'You are the hit of the evening, mainly for the pulse. People ask if they can feel it. {a} stands beside you like someone who has brought the best thing.', souls: 18, bond: 'a', a: { fuss: 20 } }
      ] },
      { label: 'Send a card with {a}', outcomes: [
        { tone: 'bad', stamp: 'KEVIN', text: '{a} goes alone and comes back late, quiet, carrying somebody else’s coat. “Everyone has done well,” it says. “Kevin is a bishop.” It says nothing more until Tuesday.', souls: 13, a: { fuss: -20 }, fits: ['napoleon', 'narcissist', 'martyr', 'nihilist'] },
        { tone: 'good', stamp: 'EXCUSED', text: 'Your note says {a} is indisposed. The class sends lilies and a card with forty signatures. {a} reads each one, remembers none, and weeps into the lilies anyway.', souls: 16, fits: ['amnesiac', 'mourner', 'martyr'] }
      ] }
    ] },
  { id: 'anonymous-note', title: 'An anonymous note on the biscuit tin reads I KNOW WHAT YOU DID. It is in {a}’s handwriting.', art: 'chalk',
    choices: [
      { label: 'Ask {a} about it', outcomes: [
        { tone: 'weird', stamp: 'SELF ADDRESSED', text: 'It is for itself. {a} has been writing to itself for a month, as an anonymous friend, to keep itself honest. It would like to know who has been writing back.', souls: 21, fits: ['amnesiac', 'paranoid', 'revisionist', 'sleepwalker'] },
        { tone: 'bad', stamp: 'NEVER SEEN IT', text: '“Never seen it,” says {a}, in the same handwriting, with the same pen, on the back of your hand. Whether this is a threat or a signature remains unclear.', souls: 12, grudge: 'a' }
      ] },
      { label: 'Write back', outcomes: [
        { tone: 'good', stamp: 'CORRESPONDENCE', text: 'You write WHICH THING? By morning there is a reply: ALL OF IT. You find that you are almost relieved.', souls: 17 },
        { tone: 'weird', stamp: 'OLDER HAND', text: 'You pin up a reply. The answer comes in a much older hand: WE KNOW THAT TOO. {a} calmly eats the evidence.', souls: 20, curio: true }
      ] }
    ] },
  { id: 'button-wedding', title: '{a} is marrying a button. The ceremony is at three. The button has not been consulted.', art: 'ring',
    choices: [
      { label: 'Give the button away', outcomes: [
        { tone: 'good', stamp: 'GIVEN AWAY', text: 'You snip the button off your coat and walk it down the aisle. It trembles. It says “I do” in a tiny, tinny voice, and your coat falls open in the middle of the vows.', souls: 18, bond: 'a' },
        { tone: 'weird', stamp: 'HONEYMOON', text: 'They honeymoon in the sofa for a month. They come back tanned, somehow, with a ring made of thread and a very small child. The child is a button.', souls: 22, curio: true }
      ] },
      { label: 'Object at the vows', outcomes: [
        { tone: 'good', stamp: 'SPEAK NOW', text: 'You object. The button sobs with relief. {a} takes it rather well, eats the entire cake and announces it was always more of a friendship.', souls: 16, a: { food: 25 } },
        { tone: 'bad', stamp: 'JILTED', text: 'You object. {a} lowers its bouquet, which is a pin cushion. “Is there someone else?” it asks the button. There is. It is a zip. {a} blames you for the zip.', souls: 13, grudge: 'a', fits: STAGEY }
      ] }
    ] },
  { id: 'first-idea', title: '{a} has had an idea. It is holding it very carefully, like a hot dish, and will not say what it is.', art: 'glow',
    choices: [
      { label: 'Encourage it', outcomes: [
        { tone: 'weird', stamp: 'SOUP IN A HAT', text: 'The idea is soup, but in a hat. It is not a good idea. It is, however, the first {a} has had in forty years, and it is carried round the shelf like a baby.', souls: 20, fits: ['amnesiac', 'nihilist', 'doomscroll', 'insomniac', 'prophet'] },
        { tone: 'good', stamp: 'PATENT', text: 'The idea is a handle on the inside of the coffin lid. It is, you must admit, good. {a} files for a patent. The patent office is moved, and also grateful.', souls: 19, bond: 'a', curio: true }
      ] },
      { label: 'Ask it to put it down', outcomes: [
        { tone: 'bad', stamp: 'DROPPED', text: '{a} puts it down. It breaks. The pieces are small and none of them is any use. {a} sweeps them up in silence and goes to bed at four in the afternoon.', souls: 11, grudge: 'a', a: { fuss: -25 } },
        { tone: 'good', stamp: 'HALF EACH', text: 'You hold half. It is, you are told, load bearing. You do not understand it, and neither does {a}. It is the nicest evening you have spent with an idea.', souls: 16, bond: 'a', bondAt: 8 }
      ] }
    ] },
  { id: 'swear-jar', title: '{a} has started a swear jar for thoughts. Yours. It is nearly full.', art: 'teeth',
    choices: [
      { label: 'Pay what you owe', outcomes: [
        { tone: 'good', stamp: 'TARIFF', text: 'The tariff is 3p for “the thing about the dishwasher”, 5p for “don’t mention the lamp” and 40p, specifically, for the face you make about Thursdays. {a} offers change.', souls: 16, fits: OFFICIAL },
        { tone: 'weird', stamp: 'ACCRUED', text: 'You pay, and {a} banks it in an account in your name, the only one you have. It earns the best rate in the street. Nobody can find the bank.', souls: 20 }
      ] },
      { label: 'Dispute the thoughts', outcomes: [
        { tone: 'bad', stamp: 'DISALLOWED', text: 'You say you never thought it. {a} plays a recording. It is you, thinking. It is a surprise to both of you. The fine is doubled, and so is the volume.', souls: 13, grudge: 'a' },
        { tone: 'weird', stamp: 'APPEAL', text: 'You demand an appeal. {a} opens a second jar, labelled APPEALS. It is full. There is a queue, and you are in it, and so is the jar.', souls: 19 }
      ] }
    ] },
  { id: 'shelf-election', title: '{a} is standing for shelf representative. The only other candidate is the lamp. The lamp is ahead.', art: 'lamp',
    choices: [
      { label: 'Run {a}’s campaign', outcomes: [
        { tone: 'good', stamp: 'ELECTED', text: 'You print leaflets: VOTE {a}, IT IS NOT THE LAMP. Turnout is nine. The count takes two hours. {a} wins by a bowl. The lamp concedes, glowing a bit less.', souls: 18, a: { fuss: 25 }, fits: ['narcissist', 'closer', 'influencer', 'napoleon', 'steward', 'socialite'] },
        { tone: 'weird', stamp: 'RECOUNT', text: 'It is a tie. The recount produces more votes than there are residents, three of them in handwriting you recognise as the drawer’s. The result is declared “a hung shelf”.', souls: 20 }
      ] },
      { label: 'Smear the lamp', outcomes: [
        { tone: 'bad', stamp: 'BACKFIRED', text: 'You tell the shelf the lamp has been seen with a plug. The lamp is unmoved. The lamp has always been plugged in. It is a matter of public record.', souls: 12, grudge: 'a' },
        { tone: 'weird', stamp: 'LANDSLIDE', text: 'It works. The lamp goes out in disgrace. In the dark {a} is elected unopposed, to the sound of a shelf holding its breath.', souls: 21, curio: true }
      ] }
    ] },
  { id: 'reverse-seance', title: 'Someone in the wall is holding a séance to contact the living. {a} is the nearest they have got.', art: 'planchette',
    choices: [
      { label: 'Answer for {a}', outcomes: [
        { tone: 'weird', stamp: 'SAME', text: '“Is it nice up there?” asks the wall. “Damp,” says {a}. “Ah,” says the wall. “Same.” It knocks twice to say thank you and sounds enormously reassured.', souls: 20 },
        { tone: 'good', stamp: 'MESSAGE', text: 'The wall asks you to pass a message to a Maureen, in the house on the corner. {a} takes it round and comes back beaming. “She said about time.”', souls: 19, bond: 'a', curio: true, fits: ['cult', 'haunted', 'undertaker', 'mourner'] }
      ] },
      { label: 'Say nobody is in', outcomes: [
        { tone: 'bad', stamp: 'GONE QUIET', text: '“Nobody is in,” you say. The knocking stops. Much later it starts again, very softly and further off, like someone leaving a party they were not at.', souls: 12 },
        { tone: 'weird', stamp: 'OUT OF OFFICE', text: 'The wall puts up a chalk notice: BACK IN FIVE MINUTES. It means five years. {a} puts it in the diary.', souls: 18 }
      ] }
    ] },
  { id: 'obituaries', title: '{a} reads the obituaries every morning, to check it has outlived everyone in them.', art: 'veil',
    choices: [
      { label: 'Check the scores with it', outcomes: [
        { tone: 'good', stamp: 'AHEAD', text: '{a} has outlived four thousand and twelve, and keeps the cuttings on a string. Today it adds a man it once met. It is quietly pleased and quietly ashamed, in the wrong order.', souls: 17, fits: ['ancient', 'martyr', 'undertaker', 'nihilist'] },
        { tone: 'weird', stamp: 'ON THE LIST', text: 'Page six has a name it knows. It is {a}’s, from 1704, in a small black box. {a} reads it twice, cuts it out for the string and does not say what it feels.', souls: 22, curio: true }
      ] },
      { label: 'Hide the paper', outcomes: [
        { tone: 'bad', stamp: 'WITHDRAWAL', text: '{a} goes without. By noon it is pacing. By three it has found last Tuesday’s paper and is reading it with a magnifying glass, looking for what it missed.', souls: 13, grudge: 'a' },
        { tone: 'good', stamp: 'CROSSWORD', text: 'You give it the crossword instead. It does it in pen. Every answer is someone it outlived. They all fit, which is more than anyone expected.', souls: 16, bond: 'a', bondAt: 10 }
      ] }
    ] },
  { id: 'antiques', title: 'A man from the antiques programme is examining {a} through a loupe. His hands have begun to shake.', art: 'eye',
    choices: [
      { label: 'Ask for a valuation', outcomes: [
        { tone: 'weird', stamp: 'BETWEEN', text: '“I would put it,” he says, “somewhere between four pounds and a catastrophe.” He asks if he may sit down. {a} has never felt so valued, or so insured.', souls: 22, fits: OLD },
        { tone: 'bad', stamp: 'PROVENANCE', text: 'He asks about provenance. “Found in a drain,” says {a}. He writes it down, shaking, and says it will do wonders for the price. {a} is not sure why that stung.', souls: 12 }
      ] },
      { label: 'Say it is not for sale', outcomes: [
        { tone: 'good', stamp: 'NOT FOR SALE', text: 'He bows, leaves a card and a basket of fruit, and says he will call every year until he dies, which he notes will be sooner than {a}.', souls: 17, bond: 'a', a: { fuss: 20 } },
        { tone: 'bad', stamp: 'CATALOGUED', text: 'He lists {a} anyway, lot 41, “with minor damp”. By teatime there are men in the hall in white gloves. You apologise at the door. {a} is rather flattered.', souls: 14 }
      ] }
    ] },
  { id: 'smoke-alarm', title: 'The smoke alarm has chirped every forty seconds since Tuesday. {a} has been chirping back.', art: 'flame',
    choices: [
      { label: 'Change the battery', outcomes: [
        { tone: 'good', stamp: 'QUIET', text: 'Silence at last. {a} sits under the alarm for an hour, then chirps once, by itself, to be sure. It is a little lonely. You give it the old battery to hold.', souls: 14, bond: 'a', bondAt: 6 },
        { tone: 'weird', stamp: 'NOT THE BATTERY', text: 'The chirping carries on. “It was never the battery,” says {a}. “It is a reminder.” It will not say of what. By Friday you have started packing a small bag, just in case.', souls: 20 }
      ] },
      { label: 'Let {a} translate', outcomes: [
        { tone: 'weird', stamp: 'FLUENT', text: '“It says low battery,” says {a}, “and a bit about you.” It chirps back at length. The alarm replies for a full minute. {a} turns, pale. “It has seen what you do with the toast.”', souls: 22, fits: ['hummer', 'swarm', 'cryptid', 'prophet'] },
        { tone: 'bad', stamp: 'EVACUATED', text: '{a} translates “FIRE”, confidently, and the shelf is marched into the garden in its dressing gowns for two hours. It is a bonfire, two roads over, for charity. {a} says the alarm was early.', souls: 12 }
      ] }
    ] },
  { id: 'sock-hole', title: '{a} has gone down the hole in your sock. You are wearing the sock.', art: 'shadow',
    choices: [
      { label: 'Take it off, gently', outcomes: [
        { tone: 'good', stamp: 'UNSOCKED', text: 'You peel it off. {a} climbs out of the heel, blinking, with a lot to say about the toe. There is a whole community in there, it says. They have views on your feet.', souls: 16, a: { fuss: 15 } },
        { tone: 'bad', stamp: 'LINT', text: 'It emerges with a ball of fluff, a coin and somebody’s old plaster, and refuses to say where it has been. It sniffs your socks for weeks.', souls: 12, a: { clean: -20 } }
      ] },
      { label: 'Walk it through', outcomes: [
        { tone: 'weird', stamp: 'SEEN THE TOWN', text: 'You go about your day. At six there is a tap on your ankle. {a} has been to the shop, the post office and a funeral, and has opinions on all three.', souls: 21, curio: true },
        { tone: 'good', stamp: 'CARRIED', text: 'At six {a} climbs out, tired and delighted. “Fascinating. Lovely buses.” It also saw what you do on the bus. It keeps this to itself in a way you can feel.', souls: 17, bond: 'a' }
      ] }
    ] },
  { id: 'ghost-walk', title: 'A ghost walk has come through the hallway. {a} has joined it, with a lanyard, as the ghost.', art: 'candle',
    choices: [
      { label: 'Let {a} do the tour', outcomes: [
        { tone: 'good', stamp: 'SOLD OUT', text: '{a} delivers a pause and a groan so convincing that a woman faints and is given a refund. The review: “The little one was best. Shame about the real ghost, very amateur.”', souls: 18, a: { fuss: 25 }, fits: [...STAGEY, 'haunted'] },
        { tone: 'bad', stamp: 'HECKLED', text: 'The guide objects. A small boy at the back says “it looks like a sock”. {a} says it is a figure of local dread. It does not recover that week.', souls: 12, grudge: 'a', a: { fuss: -20 } }
      ] },
      { label: 'Hide until they leave', outcomes: [
        { tone: 'weird', stamp: 'CLOSE CALL', text: 'You hide under the table. The guide describes a haunting in this exact spot in 1888. Every detail is right, including the person under the table. They leave a tip.', souls: 21, curio: true },
        { tone: 'good', stamp: 'AFTER HOURS', text: 'They go. You stay still for an hour. {a} does the whole tour again, to the dark, with feeling, and signs the guestbook as the ghost.', souls: 15, bond: 'a' }
      ] }
    ] },
  { id: 'geoffrey-planning', title: 'The Geoffreys want a second storey on the matchbox. There are twenty-two of them. {a} is the neighbour.', art: 'bug',
    choices: [
      { label: 'Object to the plans', outcomes: [
        { tone: 'good', stamp: 'APPEALS', text: 'You object. The Geoffreys appeal. They appeal the appeal. The hearing is chaired by a Geoffrey and minuted by two more. {a} brings the tea and takes the credit.', souls: 14 },
        { tone: 'bad', stamp: 'UPHELD', text: 'You object on grounds of light. The planning officer, a Geoffrey, upholds the application on grounds of light. {a} loses its view of the lamp and holds you responsible.', souls: 12, grudge: 'a' }
      ] },
      { label: 'Approve it and ask for a flat', outcomes: [
        { tone: 'weird', stamp: 'GEOFFREY TOWERS', text: 'By Friday the matchbox is eleven storeys of lollipop sticks and optimism. The penthouse goes to {a}, at a very reasonable rent, payable in crumbs.', souls: 22, fits: ['landlord', 'timeshare', 'closer', 'steward'] },
        { tone: 'good', stamp: 'FREEHOLD', text: 'You approve. In return {a} is given the freehold of the smallest room, forever. A gift basket of crumbs arrives. {a} has not been so happy since the Armistice.', souls: 16, a: { food: 20 } }
      ] }
    ] },
  { id: 'raven-invoice', title: 'The raven has sent {a} an invoice for “services to the dead”, itemised by mourner.', art: 'raven',
    choices: [
      { label: 'Dispute the invoice', outcomes: [
        { tone: 'bad', stamp: 'FINAL DEMAND', text: 'The raven replies in red. The second invoice is for the first, plus a fee for writing it. A third arrives with a feather taped to it. The feather is very pointed.', souls: 13 },
        { tone: 'good', stamp: 'WAIVED', text: 'The raven waives the fee in exchange for “a small favour, to be named”. You say yes. “You did not ask what,” says {a}. You did not ask what.', souls: 18 }
      ] },
      { label: 'Pay it in full', outcomes: [
        { tone: 'good', stamp: 'STANDING ORDER', text: 'The raven is so thrilled to be paid that it becomes a regular. It comes at four every day to take messages to the dead. {a} sends the same one each time: “Not yet.”', souls: 17, bond: 'a' },
        { tone: 'weird', stamp: 'REFERENCE', text: 'The raven asks for a testimonial. {a} writes “Punctual, if grim.” By Friday there is a waiting list for the shelf, of the recently dead.', souls: 21, curio: true, fits: ['auditor', 'executor', 'mourner', 'undertaker'] }
      ] }
    ] },
  { id: 'moth-charity', title: 'The moth’s rival cult has registered as a charity. It has sent {a} a form for Gift Aid.', art: 'moth',
    choices: [
      { label: 'Sign up as a supporter', outcomes: [
        { tone: 'good', stamp: 'TOTE BAG', text: 'You get a tote bag and a monthly newsletter, which is mostly a photograph of a lamp. {a} is made treasurer, because it can add. It cooks the books, but beautifully.', souls: 17, curio: true },
        { tone: 'weird', stamp: 'TRUSTEE', text: 'You are made a trustee. At the first meeting you learn the cult has three hundred members, all moths, and one vacancy, for a body. Nobody says which body. Everyone looks at {a}.', souls: 21 }
      ] },
      { label: 'Report it to the regulator', outcomes: [
        { tone: 'bad', stamp: 'AUDITED', text: 'The regulator sends an inspector, a small, serious moth with a clipboard. He finds a model charity. He audits you instead, specifically for the lamp.', souls: 12 },
        { tone: 'weird', stamp: 'DISSOLVED', text: 'The charity is dissolved. The moths are asked to return the lamp. They do, one by one, in a long line, each in tears, each carrying a very small piece.', souls: 19 }
      ] }
    ] },
  { id: 'dentist-practice', title: 'The Victorian dentist from the drawer has opened a practice behind the skirting board. {a} is booked in.', art: 'tooth',
    choices: [
      { label: 'Go with {a}', outcomes: [
        { tone: 'weird', stamp: 'EXAMINED', text: 'He checks {a}’s mouth with a hook and delight. “Excellent bones,” he says, “for a wet thing.” He fills something that is not a tooth. {a} sends him a card at Christmas.', souls: 21, curio: true },
        { tone: 'bad', stamp: 'OPEN WIDE', text: 'He asks you to open wide as well. You do. He nods, writes “later” and gives you a sticker. The sticker is a tooth. It is yours.', souls: 13 }
      ] },
      { label: 'Cancel the appointment', outcomes: [
        { tone: 'good', stamp: 'RESCHEDULED', text: 'The dentist takes it well. He sends a reminder each month, in a hand that gets shakier and more affectionate. {a} frames the first one. It has never had a hobby before.', souls: 16, bond: 'a' },
        { tone: 'bad', stamp: 'NO SHOW', text: 'He bills for the missed appointment, for the time spent waiting and for 1887, which {a} owes from before. The bill is drawn inside a tooth.', souls: 12 }
      ] }
    ] },
  { id: 'snail-hearing', title: '{a} has a hearing against the cat on Thursday. The snail representing it left on Monday.', art: 'gavel',
    choices: [
      { label: 'Go and fetch the snail', outcomes: [
        { tone: 'good', stamp: 'CARRIED IN', text: 'He is nine inches from the front door, very focused. You carry him in. He wins on a technicality: the cat cannot be served, being a cat.', souls: 18, fits: ['litigious', 'complaints', 'auditor', 'executor'] },
        { tone: 'weird', stamp: 'ADJOURNED', text: 'You find him a mile down the road, doing well, in a small hat. You bring him back. The hearing is adjourned until the Tuesday after next. The cat is delighted.', souls: 20 }
      ] },
      { label: 'Represent {a} yourself', outcomes: [
        { tone: 'bad', stamp: 'LITIGANT', text: 'You stand. The cat’s counsel is a very large dog, who eats your closing statement. The judge, an owl, fines {a} in its absence and you in your absence of mind.', souls: 13 },
        { tone: 'good', stamp: 'ON THE DAY', text: 'Halfway through, the snail arrives at speed. “Objection,” he says. “Overruled.” “I know.” The cat settles out of court, for a sprat.', souls: 18 }
      ] }
    ] },
  { id: 'charity-shop', title: '{b} has donated {a} to the hospice charity shop, in a bag of other things. {a} is marked £2.', pair: true, art: 'heart',
    choices: [
      { label: 'Buy {a} back', outcomes: [
        { tone: 'good', stamp: 'HAGGLED', text: 'You haggle it down to 50p because of the damp. {a} comes home in a carrier bag, reduced and humbled, in a bobble hat nobody asked for, and does not speak to {b} for a month.', souls: 17 },
        { tone: 'bad', stamp: 'FULL PRICE', text: 'The woman at the till says £2. You say it was 50p in the window. She says that was the other one. {a} is mortified to have a sibling in the window, marked down.', souls: 13, grudge: 'b' }
      ] },
      { label: 'Leave it a day, to teach {b}', outcomes: [
        { tone: 'weird', stamp: 'SOLD', text: 'Someone buys {a} for the window display. By evening it is a mannequin in a good hat. It has never been so admired and will not be coming home. It sends a postcard with a pound inside.', souls: 21, curio: true },
        { tone: 'good', stamp: 'VOLUNTEER', text: 'By closing {a} has a name tag, an apron and the keys. It is the best volunteer the hospice has had. {b} is made to apologise in person, and buys it a cardigan.', souls: 18, grudge: 'b' }
      ] }
    ] },
  { id: 'border-dispute', title: '{a} and {b} have divided the shelf with string. The lamp is on the line.', pair: true, art: 'thimble',
    choices: [
      { label: 'Rule on the lamp', outcomes: [
        { tone: 'good', stamp: 'SPLIT', text: 'You rule that the lamp is shared: left half {a}’s, right half {b}’s, bulb in joint custody. It pleases nobody and holds for a full day, which is a record.', souls: 18 },
        { tone: 'bad', stamp: 'BIASED', text: 'You give the lamp to {a}. {b} stands at the border with such patient hatred that the lamp, nervously, switches itself off.', souls: 12, grudge: 'b', fits: ['napoleon', 'landlord', 'steward', 'spiteful'] }
      ] },
      { label: 'Cut the string', outcomes: [
        { tone: 'weird', stamp: 'ANNEXED', text: 'The border goes. Within the hour a wall of biscuits stands where the string was, and customs has been set up at the bowl. They do not accept your passport. They do accept a custard cream.', souls: 21, fits: ['napoleon', 'landlord', 'steward'] },
        { tone: 'good', stamp: 'UNIFIED', text: 'With no border they argue about whose fault the border was. It takes them to teatime and ends in a handshake. The string becomes a very small hammock.', souls: 17, bond: 'a', a: { fuss: 15 }, b: { fuss: 15 } }
      ] }
    ] },
  { id: 'pantomime-horse', title: '{a} and {b} have been a pantomime horse since Monday. Neither will say who is allowed to be the front.', pair: true, art: 'head',
    choices: [
      { label: 'Cut the costume off', outcomes: [
        { tone: 'good', stamp: 'RELEASED', text: 'It comes off with a sigh like a large dog settling. They emerge blinking, two separate animals who have seen each other from behind and agree never to bring it up.', souls: 16, a: { clean: 20 }, b: { clean: 20 } },
        { tone: 'bad', stamp: 'HOOVES', text: 'You cut it open. The front half has been wearing the back half’s wellies. This is announced, publicly. {b} is quiet about the hooves, and bitter.', souls: 12, grudge: 'b' }
      ] },
      { label: 'Make them take turns at the front', outcomes: [
        { tone: 'weird', stamp: 'ROSETTE', text: 'They take third prize at the village show, Best Animal. The vet is called. After an hour he admits he has never seen a more nervous pair of legs.', souls: 22, curio: true },
        { tone: 'good', stamp: 'SWAPPED', text: 'They swap at noon on the dot. The back, they discover, is the better half: nobody can see you and you see everything. {b} will not now hear of going to the front.', souls: 17, bond: 'a' }
      ] }
    ] },
  { id: 'dream-washing-up', title: '{a} and {b} have had the same dream. In it, you are washing up wrong.', pair: true, art: 'eye',
    choices: [
      { label: 'Ask for the details', outcomes: [
        { tone: 'bad', stamp: 'THE LIST', text: '{b} hands you a list. It has twelve points. Number nine is that you hold a cup like someone expecting to be forgiven. They have discussed this at length and are united.', souls: 13 },
        { tone: 'weird', stamp: 'NOT YOUR HANDS', text: 'In the dream you have no hands, they say. Someone else is washing up with yours, and doing it much better. Neither of them was brave enough to look at the face.', souls: 21 }
      ] },
      { label: 'Wash up their way', outcomes: [
        { tone: 'good', stamp: 'CORRECTED', text: 'Soak, scrub, rinse, never looking at the clock. That night they have the dream again, and this time you are good at it. They hold their breath at the end, then applaud.', souls: 17, bond: 'a' },
        { tone: 'weird', stamp: 'REPEAT', text: 'You wash up perfectly. That night they have the dream again and you are doing it wrong. At breakfast they are almost sympathetic. You are doing it wrong in your sleep, they say.', souls: 20 }
      ] }
    ] },
  { id: 'diary-newsreader', title: '{a} has found {b}’s diary and is reading it aloud in the voice of a newsreader.', pair: true, art: 'book',
    choices: [
      { label: 'Let it read', outcomes: [
        { tone: 'weird', stamp: 'BREAKING', text: '“Tuesday,” {a} reads, gravely. “Ate a thing. It was good. Told no one.” It looks into the camera that is not there. “More on this story at ten.” {b} is furious and secretly thrilled at the coverage.', souls: 22 },
        { tone: 'good', stamp: 'RATINGS', text: 'Halfway through, the entries turn out to be mostly about {a}, and warm. {a} keeps the newsreader voice up, but only just, and finishes at a whisper.', souls: 17, bond: 'a' }
      ] },
      { label: 'Confiscate the diary', outcomes: [
        { tone: 'bad', stamp: 'LEAKED', text: 'By morning the pages are pinned to the bowl and being read by the lodgers in the walls. {b} has a few things to say about leaks, none of them in the diary.', souls: 13, grudge: 'b' },
        { tone: 'good', stamp: 'HANDED BACK', text: 'You give it back unread. {b} is so touched it lets you see one page. It is a drawing of you with a halo and a small, careful label: DAMP, BUT TRYING.', souls: 18, b: { fuss: 20 } }
      ] }
    ] },
  { id: 'magic-vanish', title: '{a} has made {b} disappear, for a magic act. {a} has not rehearsed the part where {b} comes back.', pair: true, art: 'veil',
    choices: [
      { label: 'Look in the top hat', outcomes: [
        { tone: 'good', stamp: 'IN THE HAT', text: 'You find {b} in the hat, comfortable, with a small cushion it did not have before. It declines to come out until the show has been reviewed.', souls: 17 },
        { tone: 'weird', stamp: 'WRONG HAT', text: '“Wrong hat,” says a tiny voice. Inside is a second show, an older one, with {b} as assistant to a man in a cape. They are halfway through a trick. They wave.', souls: 22, curio: true }
      ] },
      { label: 'Applaud and hope', outcomes: [
        { tone: 'weird', stamp: 'ENCORE', text: '{b} returns after twenty minutes, from the biscuit tin, clapping. “Great show,” it says. “Where did we go?” {a} bows to the empty room, and to a hundred people clapping from far away.', souls: 20 },
        { tone: 'bad', stamp: 'VANISHED', text: 'You applaud for a full minute. Nothing comes back. {a} takes a last bow, to the room and to the hat, and quietly eats {b}’s biscuit.', souls: 13, grudge: 'b' }
      ] }
    ] },
  { id: 'hundred-years-silence', title: '{a} and {b} have not spoken for a hundred years. There is a party. Nobody knows who should toast.', pair: true, art: 'cake',
    choices: [
      { label: 'Propose the toast yourself', outcomes: [
        { tone: 'weird', stamp: 'FIRST WORDS', text: 'You toast a hundred quiet years. They both speak at once. “Not like that,” says {a}. “Not like that,” says {b}. They have never agreed on anything faster, and neither forgives the other for it.', souls: 21 },
        { tone: 'good', stamp: 'RAISED', text: 'You raise a thimble of cider. They clink without looking at each other, which they have clearly rehearsed. Then they toast the silence, which has been a good friend, and cry into the cake.', souls: 17, bond: 'a' }
      ] },
      { label: 'Let them toast each other', outcomes: [
        { tone: 'bad', stamp: 'STANDOFF', text: 'They stand with glasses raised for eleven minutes. Neither speaks. Both drink, glaring. It is the most hostile toast on record, and goes in the book as a success.', souls: 13, grudge: 'a', fits: ['spiteful', 'martyr', 'napoleon', 'nihilist'] },
        { tone: 'good', stamp: 'THAWED', text: '{b} slides a card across the table. Inside: “Sorry.” {a} slides one back. It also says “Sorry.” It is the same card. They have been passing it since 1925.', souls: 20, curio: true, bond: 'a' }
      ] }
    ] },
  { id: 'karaoke-organ', title: '{a} and {b} are doing karaoke. The machine only has hymns. The organ is real, and in the cellar.', pair: true, art: 'ghost',
    choices: [
      { label: 'Join the duet', outcomes: [
        { tone: 'good', stamp: 'HARMONY', text: 'You take the third part. The organ swells. All three of you hit a note nobody knew you had. The windows hum, and the lamp comes on by itself to applaud.', souls: 19, bond: 'a', a: { fuss: 20 }, fits: ['hummer', 'theatrical', 'method', 'mourner'] },
        { tone: 'weird', stamp: 'ORGANIST', text: 'Mid-verse the organ stops and a voice in the cellar says “Sorry, were we meant to be playing?” A great many hands, by the sound, are on the keys. Nobody has a microphone any more.', souls: 22 }
      ] },
      { label: 'Pull the plug', outcomes: [
        { tone: 'bad', stamp: 'FEEDBACK', text: 'The machine finishes the hymn anyway, from memory, flat and in a temper. {a} and {b} agree it was the best they have ever sounded, and say so, and blame you for the ending.', souls: 12, grudge: 'a' },
        { tone: 'good', stamp: 'UNPLUGGED', text: 'They finish the hymn unaccompanied, which is better and quieter. In the cellar the organ hums along, very softly, and the dark goes round the room, nodding.', souls: 16, bond: 'a' }
      ] }
    ] },
  { id: 'wrong-rules', title: '{a} and {b} have played one board game for six hours. The rules in the box are for another game.', pair: true, art: 'box',
    choices: [
      { label: 'Find the right rules', outcomes: [
        { tone: 'good', stamp: 'THE RULES', text: 'They are in the lid of the wrong box. Rule one: the winner eats the most pieces. They look at the board, which is mostly gone. Both have been playing correctly all along.', souls: 19 },
        { tone: 'bad', stamp: 'RULE ONE', text: 'Rule one reads: “The player who finds these rules loses.” That is you. You lose, with dignity, on a square that says GO TO BED. {b} says it is only fair.', souls: 12 }
      ] },
      { label: 'Invent new rules', outcomes: [
        { tone: 'weird', stamp: 'HOUSE RULES', text: 'The new game has forty-one rules, three dice and a hat. By teatime the hat is the judge. It is very strict. {a} and {b} are united in terror of the hat.', souls: 22, curio: true },
        { tone: 'good', stamp: 'DECLARED', text: 'You declare {a} the winner on a technicality so long that {b} concedes just to make it stop. {a} accepts a trophy made of a bottle top and a small, secretive smile.', souls: 17, a: { fuss: 20 }, grudge: 'b' }
      ] }
    ] }
];

/* ================= MAYHEM =================
   The short-session loop. Something goes wrong on the shelf roughly every
   quarter of an hour (three can pile up while you are away). Each emergency is a
   card with two choices; each choice rolls one of its outcomes. Outcomes pay
   Souls, which buy Coffins, which hold Curios, which fill the Cabinet of
   Curiosities. Souls earned for life set the household's Infamy.

   Writing rules for this file:
     * {a} is the resident the card is about. {b} is a second resident and only
       appears on cards marked `pair: true`.
     * The setup is the situation. The outcome is the punchline. Never explain it.
     * Dark is the register: death, graves, séances, curses, bones, taxidermy,
       wills, cults, the thing in the drawer. Nobody here can die, which is the
       joke underneath every joke. Nothing cruel to real people, nothing gory.
     * `tone` colours the verdict stamp: good (green), bad (red), weird (violet).
     * Effects: souls; need deltas for a/b; bond (+ only, rationed by the engine);
       grudge ('a' or 'b' files one); curio (true = a guaranteed drop). */

export const EMERGENCIES = [
  { id: 'rat-poison', title: '{a} has found the rat poison.', art: 'bottle',
    choices: [
      { label: 'Take it off them', outcomes: [
        { tone: 'good', stamp: 'CONFISCATED', text: '{a} hands it over, then produces a second bottle from somewhere it does not have pockets. You take that too. There is a third. You stop asking.', souls: 12 },
        { tone: 'bad', stamp: 'NOTED', text: '{a} surrenders the bottle and watches you the entire time, the way someone watches a will being rewritten.', souls: 6, grudge: 'a' }
      ] },
      { label: 'Let them read the label', outcomes: [
        { tone: 'weird', stamp: 'IMMUNE', text: '{a} drinks the whole thing to prove a point. Nothing happens. {a} is livid that nothing happens and demands a stronger brand.', souls: 18, a: { food: 20 } },
        { tone: 'good', stamp: 'LITERATE', text: 'It says KEEP AWAY FROM CHILDREN. {a} is four hundred years old. {a} uses it as a seasoning now.', souls: 15, a: { food: 25 } }
      ] }
    ] },
  { id: 'grave-in-pot', title: '{a} is digging a grave in the plant pot. It is exactly {b}-sized.', pair: true, art: 'shovel',
    choices: [
      { label: 'Ask who it’s for', outcomes: [
        { tone: 'weird', stamp: 'NO COMMENT', text: '“Nobody,” says {a}, and keeps digging. {b} has started sleeping with one eye open. Both of {b}’s eyes are on the same side, so this is going badly.', souls: 14, grudge: 'b' },
        { tone: 'good', stamp: 'PREPARED', text: '“It’s for me,” says {a}. “In case.” {b} helps with the corners. It is the nicest thing either of them has done all week.', souls: 16, bond: 'a' }
      ] },
      { label: 'Help them dig', outcomes: [
        { tone: 'good', stamp: 'TEAMWORK', text: 'You dig together. It is honestly lovely. {b} watches from a distance, taking notes for the inquest.', souls: 18, bond: 'a' },
        { tone: 'bad', stamp: 'ACCESSORY', text: 'You hit a smaller grave already in there. It is labelled “{a}, attempt one”. Nobody is ready to talk about it.', souls: 12, curio: true }
      ] }
    ] },
  { id: 'ouija', title: 'There is a ouija board on the bottom shelf. The planchette is moving. Nobody is touching it.', art: 'planchette',
    choices: [
      { label: 'Ask a question', outcomes: [
        { tone: 'weird', stamp: 'IT ANSWERED', text: 'You ask whether anyone is there. It spells N-O. Then, after a long pause, S-O-R-R-Y.', souls: 16 },
        { tone: 'bad', stamp: 'EXPOSED', text: 'It spells your full name, your first address and the thing you did in Year Six. {a} gives it a standing ovation.', souls: 20, grudge: 'a' },
        { tone: 'good', stamp: 'CONTACT', text: 'It spells “FEED {a}”. You do. The planchette sighs with relief and slides off the board to lie down.', souls: 14, a: { food: 30 } }
      ] },
      { label: 'Put it in the drawer', outcomes: [
        { tone: 'weird', stamp: 'MUFFLED', text: 'You shut it in the drawer. The drawer spells something back from the inside. It is spelled wrong, which is somehow worse.', souls: 10 },
        { tone: 'good', stamp: 'FILED', text: 'The drawer accepts it without comment. The drawer has accepted worse. {a} is sulking that you ended the call.', souls: 10, curio: true }
      ] }
    ] },
  { id: 'will', title: '{a} has written a will. You are not in it.', art: 'scroll',
    choices: [
      { label: 'Contest the will', outcomes: [
        { tone: 'bad', stamp: 'DISINHERITED', text: '{a} adds a clause: “Specifically not them.” It is underlined twice and signed in something brown that is not ink.', souls: 12, grudge: 'a' },
        { tone: 'good', stamp: 'SETTLED', text: 'After tense negotiations you are granted “visitation rights to the body”. {a} cannot die, so this is a symbolic win.', souls: 18 }
      ] },
      { label: 'Accept your fate', outcomes: [
        { tone: 'good', stamp: 'BENEFICIARY', text: '{a} is so moved by your grace that it writes you back in. You will inherit one wet raisin and “the knowledge”.', souls: 16, bond: 'a' },
        { tone: 'weird', stamp: 'EXECUTOR', text: '{a} names you executor. Your first duty is to read the will aloud at a funeral {a} will be attending.', souls: 14, curio: true }
      ] }
    ] },
  { id: 'replacement', title: '{a} has been replaced by an identical {a}. The new one is nicer.', art: 'mirror',
    choices: [
      { label: 'Keep the new one', outcomes: [
        { tone: 'weird', stamp: 'DOUBLED', text: 'The new {a} is delightful for eleven minutes. Then the old {a} climbs out of the bowl and the two of them have to share a name now.', souls: 20 },
        { tone: 'bad', stamp: 'UNNOTICED', text: 'Nobody on the shelf notices the difference. That is the part {a} cannot get over.', souls: 14, grudge: 'a' }
      ] },
      { label: 'Demand the original', outcomes: [
        { tone: 'good', stamp: 'RESTORED', text: 'The original {a} returns smelling of soil and refuses to say where it was. The replacement leaves a forwarding address. It is the cellar.', souls: 16, bond: 'a' },
        { tone: 'weird', stamp: 'UNCLEAR', text: 'You demand the original. Both of them point at the other one. You pick the one that bit you. That is how you know.', souls: 18 }
      ] }
    ] },
  { id: 'bite-spread', title: '{a} bit {b}. Now {b} is also biting things.', pair: true, art: 'teeth',
    choices: [
      { label: 'Quarantine them', outcomes: [
        { tone: 'good', stamp: 'CONTAINED', text: 'You put them in separate teacups. They bite the teacups. The teacups do not start biting. Science wins.', souls: 16 },
        { tone: 'bad', stamp: 'BREACH', text: 'The quarantine lasts four minutes. You now also want to bite something. You bite a biscuit. It is fine. You bite another.', souls: 12, grudge: 'b' }
      ] },
      { label: 'Let it spread', outcomes: [
        { tone: 'weird', stamp: 'OUTBREAK', text: 'By teatime the lamp is biting. The lamp cannot bite. The lamp is managing.', souls: 22 },
        { tone: 'good', stamp: 'BONDED', text: '{a} and {b} bite each other affectionately for an hour and then fall asleep in a small, damp pile.', souls: 18, a: { fuss: 25 }, b: { fuss: 25 } }
      ] }
    ] },
  { id: 'lamp-whisper', title: 'The lamp has started whispering {a}’s name at night.', art: 'lamp',
    choices: [
      { label: 'Change the bulb', outcomes: [
        { tone: 'weird', stamp: 'PERSISTENT', text: 'The new bulb whispers too, but more politely. It has also learned your name. It says it like a question.', souls: 14 },
        { tone: 'good', stamp: 'SILENCED', text: 'The old bulb goes quiet. {a} keeps it in a matchbox and whispers to it instead. Nobody is going to stop this.', souls: 12, curio: true }
      ] },
      { label: 'Whisper back', outcomes: [
        { tone: 'bad', stamp: 'ENGAGED', text: 'You whisper “what do you want”. The lamp whispers “you know what I want”. You do not. It will not tell you. This goes on for weeks.', souls: 18 },
        { tone: 'good', stamp: 'FRIENDS', text: 'It turns out the lamp just wanted someone to talk to. {a} is jealous of the lamp now, which is new.', souls: 16, a: { fuss: 20 } }
      ] }
    ] },
  { id: 'cult', title: '{a} has started a cult. There are two members. {b} is one. The other is a moth.', pair: true, art: 'candle',
    choices: [
      { label: 'Join the cult', outcomes: [
        { tone: 'good', stamp: 'INITIATED', text: 'Initiation involves a small damp handshake and forgetting your surname. You are now Brother Tuesday. The moth outranks you.', souls: 20, bond: 'a' },
        { tone: 'weird', stamp: 'ASCENDED', text: 'You are made High Priest within the hour. Your first act is to ban the moth. The moth starts a rival cult. It is doing better.', souls: 22 }
      ] },
      { label: 'Break it up', outcomes: [
        { tone: 'bad', stamp: 'DISBANDED', text: 'The cult dissolves. {b} returns to ordinary life with a thousand-yard stare. The moth takes it hardest.', souls: 12, grudge: 'a' },
        { tone: 'weird', stamp: 'UNDERGROUND', text: 'They agree to disband. The chanting now comes from inside the wall, which is technically not the shelf.', souls: 16 }
      ] }
    ] },
  { id: 'fridge-glow', title: '{a} ate something from behind the fridge. {a} is now glowing.', art: 'glow',
    choices: [
      { label: 'Induce vomiting', outcomes: [
        { tone: 'weird', stamp: 'RETURNED', text: '{a} brings it back up. It is a small key. It is still glowing. It fits nothing in this house, which is what frightens you.', souls: 16, curio: true },
        { tone: 'bad', stamp: 'REFUSED', text: '{a} refuses on the grounds that it “paid for it”. It did not pay for it. It is glowing smugly.', souls: 10, a: { food: 30 } }
      ] },
      { label: 'Use them as a nightlight', outcomes: [
        { tone: 'good', stamp: 'USEFUL', text: 'The whole shelf sleeps better. {a} has never felt so needed. Its teeth have started to hum, but that is a problem for Thursday.', souls: 18, bond: 'a', a: { food: 20 } },
        { tone: 'weird', stamp: 'RADIANT', text: 'Moths arrive from four postcodes to worship {a}. {a} starts taking confessions.', souls: 20 }
      ] }
    ] },
  { id: 'small-door', title: 'There is a small door at the back of the shelf that was not there yesterday. {a} is holding the key.', art: 'door',
    choices: [
      { label: 'Open it', outcomes: [
        { tone: 'weird', stamp: 'OCCUPIED', text: 'Behind the door is a tiny lit room with a tiny armchair and a tiny man in it, who says “Do you mind?” You close it. You do mind.', souls: 22 },
        { tone: 'good', stamp: 'SALVAGE', text: 'Behind the door is a cupboard of things the house has swallowed over the years. You take one. The door takes one of your socks.', souls: 16, curio: true },
        { tone: 'bad', stamp: 'OPEN', text: 'Behind the door is another shelf, with another you, who is also opening a small door. You both close them fast and never speak of it.', souls: 18 }
      ] },
      { label: 'Confiscate the key', outcomes: [
        { tone: 'bad', stamp: 'LOCKED OUT', text: '{a} gives you the key. Overnight a second door appears, with {a} on the other side of it, knocking politely.', souls: 14, grudge: 'a' },
        { tone: 'good', stamp: 'SECURED', text: 'You hide the key. The door fades by morning. {a} still sits beside where it was, like someone waiting for a bus that has stopped running.', souls: 12, a: { fuss: -10 } }
      ] }
    ] },
  { id: 'research-death', title: '{a} would like to know what happens when you die. “For research.”', art: 'skull',
    choices: [
      { label: 'Tell the truth', outcomes: [
        { tone: 'weird', stamp: 'DOCUMENTED', text: 'You say nobody really knows. {a} writes “NOBODY KNOWS” on a card, then “yet” underneath, then looks at you for a long time.', souls: 16 },
        { tone: 'bad', stamp: 'ALARMING', text: 'You explain it gently. {a} says “oh, like the others” and wanders off before you can ask which others.', souls: 18 }
      ] },
      { label: 'Change the subject', outcomes: [
        { tone: 'good', stamp: 'DISTRACTED', text: 'You offer a biscuit. {a} takes the biscuit and the question with it. The question will be back. It knows where you sleep.', souls: 12, a: { food: 25 } },
        { tone: 'weird', stamp: 'OVERHEARD', text: 'You talk about the weather. From inside the drawer something says “it gets cold”. {a} writes that down.', souls: 16 }
      ] }
    ] },
  { id: 'wrong-tooth', title: '{a} has a new tooth. It is not {a}’s.', art: 'tooth',
    choices: [
      { label: 'Ask whose it is', outcomes: [
        { tone: 'bad', stamp: 'EVASIVE', text: '“Finders keepers,” says {a}, and smiles with it. The tooth does not match. The tooth is smiling on its own schedule.', souls: 16 },
        { tone: 'weird', stamp: 'TRACED', text: 'The tooth belonged to a Victorian dentist, who, it turns out, is also in the drawer, and would like it back.', souls: 20, curio: true }
      ] },
      { label: 'Compliment the smile', outcomes: [
        { tone: 'good', stamp: 'RADIANT', text: '{a} beams. It has never been complimented on a stolen body part before. It is going to get more.', souls: 14, bond: 'a' },
        { tone: 'weird', stamp: 'COLLECTING', text: 'Emboldened, {a} now has four teeth that are not {a}’s. One of them is from the cat. The cat has not noticed yet.', souls: 18 }
      ] }
    ] },
  { id: 'birthday', title: 'It is {a}’s birthday. Nobody knows how old. The candles keep lighting themselves.', art: 'cake',
    choices: [
      { label: 'Sing', outcomes: [
        { tone: 'good', stamp: 'CELEBRATED', text: 'You sing. {a} sings along in a key that has not been used since the plague. The candles clap. It was a good party.', souls: 18, bond: 'a', a: { fuss: 30 } },
        { tone: 'weird', stamp: 'SUMMONED', text: 'Halfway through the second verse, something in the walls joins in with the harmony. Nobody invited it. It brought a gift.', souls: 20, curio: true }
      ] },
      { label: 'Count the candles', outcomes: [
        { tone: 'bad', stamp: 'INCALCULABLE', text: 'You get to three hundred and stop. {a} says, quietly, “keep going”. You do not. It remembers.', souls: 14, grudge: 'a' },
        { tone: 'weird', stamp: 'EXACT', text: 'There are 1,066 candles. {a} is very insistent that this is a coincidence.', souls: 16 }
      ] }
    ] },
  { id: 'photograph', title: '{a} found a photograph of this shelf from 1911. {a} is in it. So is {b}.', pair: true, art: 'photo',
    choices: [
      { label: 'Ask about it', outcomes: [
        { tone: 'weird', stamp: 'UNEXPLAINED', text: '{a} says it has “never been photographed”. {b} says “we agreed never to talk about the fire”. They both look at you as if you started it.', souls: 20 },
        { tone: 'good', stamp: 'NOSTALGIC', text: 'They tell the story of 1911 together, interrupting each other, disagreeing about the flood. It is the most they have spoken in months.', souls: 16, bond: 'a' }
      ] },
      { label: 'Burn it', outcomes: [
        { tone: 'bad', stamp: 'RETURNED', text: 'You burn it. It is back on the shelf in the morning, slightly singed. Now you are in it too.', souls: 18, curio: true },
        { tone: 'good', stamp: 'ASH', text: 'It burns with a green flame and a small sigh. {a} and {b} look relieved, like someone has finally stopped staring.', souls: 12 }
      ] }
    ] },
  { id: 'cat-window', title: 'The neighbour’s cat is at the window. {a} is making eye contact with it.', art: 'eye',
    choices: [
      { label: 'Draw the curtain', outcomes: [
        { tone: 'good', stamp: 'SAFE', text: 'You shut the curtain. {a} keeps staring at the curtain. The cat keeps staring at the curtain. The curtain has never been this important.', souls: 12 },
        { tone: 'bad', stamp: 'PERSONAL', text: 'You shut the curtain. {a} says “it was about to tell me something”. {a} will be bringing this up.', souls: 10, grudge: 'a' }
      ] },
      { label: 'Let them settle it', outcomes: [
        { tone: 'good', stamp: 'VICTORY', text: 'After forty minutes the cat blinks first. It walks away and has not been right since. The neighbour has asked what you did.', souls: 22, a: { fuss: 20 } },
        { tone: 'weird', stamp: 'PACT', text: 'They reach an understanding. Nobody knows what. The cat now leaves small bones on your step, addressed to {a}.', souls: 18, curio: true }
      ] }
    ] },
  { id: 'taxidermy', title: '{a} has taken up taxidermy. There is a spider in a tiny waistcoat. It is posed mid-scream.', art: 'spider',
    choices: [
      { label: 'Praise the craftsmanship', outcomes: [
        { tone: 'good', stamp: 'ARTIST', text: '{a} glows. It is already planning a diorama called “Supper at the Beetle’s”. The beetles have not been told.', souls: 16, bond: 'a' },
        { tone: 'weird', stamp: 'COMMISSION', text: '{a} offers to do you next. It says it would “only need you very still for about a week”.', souls: 18 }
      ] },
      { label: 'Ask about the spider', outcomes: [
        { tone: 'bad', stamp: 'UNASKED', text: '“He was already like that,” says {a}, too quickly, and puts a tiny hat on him to end the conversation.', souls: 14 },
        { tone: 'weird', stamp: 'ALIVE', text: 'The spider winks at you. {a} insists it is a trick of the light. The spider does it again. Very pleased with the waistcoat, honestly.', souls: 20, curio: true }
      ] }
    ] },
  { id: 'breath-contest', title: '{a} and {b} are holding a contest: who can hold their breath longest. Neither of them breathes.', pair: true, art: 'clock',
    choices: [
      { label: 'Declare a draw', outcomes: [
        { tone: 'bad', stamp: 'OUTRAGE', text: 'Both of them are furious. The contest has been going since March. They wanted a winner. They wanted blood, ideally someone else’s.', souls: 14, grudge: 'a' },
        { tone: 'good', stamp: 'SHARED', text: 'They accept the draw and award each other a small medal made of a coin that was on a dead man’s eye. It is very touching.', souls: 16, curio: true }
      ] },
      { label: 'Keep timing', outcomes: [
        { tone: 'weird', stamp: 'ONGOING', text: 'You have now been timing for two days. They have started a second contest, about you, which you are losing.', souls: 20 },
        { tone: 'good', stamp: 'WINNER', text: '{b} gasps first, out of habit rather than need. {a} runs a lap of the shelf with both arms in the air.', souls: 18, a: { fuss: 25 }, grudge: 'b' }
      ] }
    ] },
  { id: 'meeting', title: '{a} has called an emergency meeting about “the {b} situation”.', pair: true, art: 'gavel',
    choices: [
      { label: 'Attend the meeting', outcomes: [
        { tone: 'weird', stamp: 'MINUTED', text: 'Item one: {b} breathes too loudly. Item two: {b} does not breathe at all, which is suspicious. Item three: snacks. You stay for item three.', souls: 18, a: { food: 20 } },
        { tone: 'bad', stamp: 'AMBUSHED', text: 'It turns out {b} organised the meeting, about {a}. {a} did not know. Chairs are thrown. The chairs are thimbles.', souls: 20, grudge: 'a' }
      ] },
      { label: 'Invite {b}', outcomes: [
        { tone: 'good', stamp: 'RESOLVED', text: '{b} arrives, listens, and says “fair”. The meeting ends in a hug so long it counts as a hostage situation.', souls: 18, bond: 'a' },
        { tone: 'weird', stamp: 'ESCALATED', text: '{b} brings a lawyer. The lawyer is a snail. The snail is very, very good.', souls: 22 }
      ] }
    ] },
  { id: 'coffin-post', title: 'A tiny coffin has arrived in the post, addressed to {a}. Postage paid.', art: 'coffin',
    choices: [
      { label: 'Let {a} open it', outcomes: [
        { tone: 'good', stamp: 'GIFT', text: 'Inside is a smaller coffin, and inside that, a biscuit. {a} weeps with joy. It is the best present it has ever been sent.', souls: 16, a: { food: 30 }, bond: 'a' },
        { tone: 'weird', stamp: 'DELIVERED', text: '{a} opens it and climbs in. “Fits,” it says, and closes the lid. You hear it get comfortable. It is still in there.', souls: 18, curio: true }
      ] },
      { label: 'Return to sender', outcomes: [
        { tone: 'bad', stamp: 'RETURNED', text: 'You write RETURN TO SENDER. The sender is {a}. It posted it to itself months ago. It is deeply disappointed in your timing.', souls: 12, grudge: 'a' },
        { tone: 'weird', stamp: 'UNDELIVERABLE', text: 'The postman refuses to take it. He says the last one he took came back with him in it. He is fine. He is joking. He is not smiling.', souls: 16 }
      ] }
    ] },
  { id: 'woodlouse-pet', title: '{a} wants a pet of its own. It has chosen a woodlouse named Geoffrey.', art: 'bug',
    choices: [
      { label: 'Approve Geoffrey', outcomes: [
        { tone: 'good', stamp: 'ADOPTED', text: '{a} builds Geoffrey a house out of a matchbox. Geoffrey is thrilled. Geoffrey has thirteen children by Friday, all named Geoffrey.', souls: 18, bond: 'a' },
        { tone: 'weird', stamp: 'SUCCESSION', text: 'Geoffrey lives a long and happy life of four days. {a} holds a state funeral. Geoffrey II attends. Geoffrey II looks shifty.', souls: 16, curio: true }
      ] },
      { label: 'Say no pets', outcomes: [
        { tone: 'bad', stamp: 'BETRAYED', text: '“You have pets,” says {a}. “You have eighteen shelves of pets.” It is not wrong. It holds Geoffrey up to the glass so he can see you say it.', souls: 12, grudge: 'a' },
        { tone: 'weird', stamp: 'ADOPTED ANYWAY', text: 'Geoffrey adopts {a} instead. Legally this is fine. Geoffrey takes {a} for walks.', souls: 18 }
      ] }
    ] },
  { id: 'ink-tears', title: '{a} is crying. It is crying ink. The ink is spelling something.', art: 'ink',
    choices: [
      { label: 'Read it', outcomes: [
        { tone: 'weird', stamp: 'PROPHECY', text: 'It says “the bowl will be empty at four”. At four, the bowl is empty. Nobody knows if it was a warning or a request.', souls: 18 },
        { tone: 'good', stamp: 'SENTIMENTAL', text: 'It says “thank you for the rounds”. {a} is mortified you read it and asks you to never look directly at its face again.', souls: 16, bond: 'a' }
      ] },
      { label: 'Hand them a tissue', outcomes: [
        { tone: 'good', stamp: 'COMFORTED', text: '{a} blows its nose. The tissue now contains a short, surprisingly good poem about a drain.', souls: 16, a: { fuss: 30 }, curio: true },
        { tone: 'bad', stamp: 'SMUDGED', text: 'You wipe it away before you can read it. {a} says “well, now you will never know” and it is right, and it is smug about it.', souls: 12 }
      ] }
    ] },
  { id: 'warmth-fire', title: '{a} has started a small fire “for warmth”. It is August.', art: 'flame',
    choices: [
      { label: 'Put it out', outcomes: [
        { tone: 'good', stamp: 'EXTINGUISHED', text: 'You put it out with the tea. {a} stares at the steam and says “you have killed him”. There was no him. There is now a tiny grave.', souls: 14 },
        { tone: 'bad', stamp: 'SCORCHED', text: 'The fire goes out, but not before {a}’s eyebrows. {a} did not have eyebrows. It has lost them anyway, somehow.', souls: 12, a: { clean: -20 } }
      ] },
      { label: 'Roast something', outcomes: [
        { tone: 'good', stamp: 'COOKOUT', text: 'You roast a raisin together. It is the best raisin either of you has ever had. You toast to fire, which is technically an ally.', souls: 18, a: { food: 30 }, bond: 'a' },
        { tone: 'weird', stamp: 'RITUAL', text: 'You roast a marshmallow. {a} starts chanting over it. The marshmallow comes out very well done and speaking Latin.', souls: 20, curio: true }
      ] }
    ] },
  { id: 'wall-lodger', title: '{a} insists someone is living in the walls. There is. He pays rent.', art: 'ear',
    choices: [
      { label: 'Evict him', outcomes: [
        { tone: 'bad', stamp: 'EVICTED', text: 'He leaves politely with a very small suitcase. The rent stops. The walls are very quiet. {a} misses him and says so, pointedly, every evening.', souls: 14, grudge: 'a' },
        { tone: 'weird', stamp: 'RELOCATED', text: 'He moves into the ceiling. The rent goes up. He says the view is better. The view is of you.', souls: 18 }
      ] },
      { label: 'Raise the rent', outcomes: [
        { tone: 'good', stamp: 'LANDLORD', text: 'He pays without complaint, in old coins and one gold tooth. {a} is appointed rent collector and takes it deeply seriously.', souls: 22, curio: true },
        { tone: 'weird', stamp: 'UNION', text: 'He unionises the walls. The skirting board is on strike. {a} is crossing the picket line with snacks.', souls: 18 }
      ] }
    ] },
  { id: 'raisin-funeral', title: '{a} is holding a funeral for a raisin. {b} is giving the eulogy. It is going on too long.', pair: true, art: 'grave',
    choices: [
      { label: 'Let it continue', outcomes: [
        { tone: 'good', stamp: 'MOVING', text: 'Forty minutes in, everyone is crying. None of you knew the raisin. {b} knew the raisin. That is the whole problem, it turns out.', souls: 18, bond: 'a' },
        { tone: 'weird', stamp: 'RESURRECTED', text: 'The eulogy is so persuasive the raisin comes back. It is a grape now. Nobody is sure if that is a promotion.', souls: 22 }
      ] },
      { label: 'Eat the raisin', outcomes: [
        { tone: 'bad', stamp: 'SACRILEGE', text: 'The whole shelf turns to look at you. The eulogy stops. {a} whispers “monster” and means it as a compliment, but only partly.', souls: 16, grudge: 'a' },
        { tone: 'weird', stamp: 'DELICIOUS', text: 'It is honestly a very good raisin. {b} changes the eulogy to be about you, in the past tense, as a warning.', souls: 18, grudge: 'b' }
      ] }
    ] },
  { id: 'leaflet', title: '{a} has found the care leaflet it came with. It is reading it with growing horror.', art: 'scroll',
    choices: [
      { label: 'Take it away', outcomes: [
        { tone: 'bad', stamp: 'TOO LATE', text: '{a} has already reached page four: “Do not feed after midnight, or before it”. It now stares at the clock whenever you come near the bowl.', souls: 14 },
        { tone: 'good', stamp: 'REDACTED', text: 'You take it away. {a} remembers only the phrase “surprisingly resilient” and is very proud of it.', souls: 14, bond: 'a' }
      ] },
      { label: 'Read it together', outcomes: [
        { tone: 'weird', stamp: 'WARRANTY', text: 'It says {a} is covered for “ninety-nine years or one exorcism, whichever comes first”. The warranty ran out in 1874. Neither of you mentions it.', souls: 18 },
        { tone: 'good', stamp: 'INFORMED', text: 'You learn {a} needs a “firm but cursed” hand. You try it. It works. {a} is annoyed that it works.', souls: 16, a: { fuss: 25 } }
      ] }
    ] },
  { id: 'haunting-interview', title: '{a} has a job interview. The job is haunting. It has never haunted before.', art: 'ghost',
    choices: [
      { label: 'Coach them', outcomes: [
        { tone: 'good', stamp: 'HIRED', text: 'You practise moaning in a stairwell. {a} gets the job, starts Monday, and is already overqualified. The house is thrilled.', souls: 20, bond: 'a' },
        { tone: 'weird', stamp: 'OVERQUALIFIED', text: '{a} haunts so hard in the interview that the interviewer quits and becomes a ghost to get away from it.', souls: 22 }
      ] },
      { label: 'Tell them to be themselves', outcomes: [
        { tone: 'bad', stamp: 'REJECTED', text: 'It does not get the job. The feedback says it was “too alive”. {a} takes this very personally and practises lying down.', souls: 12, grudge: 'a' },
        { tone: 'good', stamp: 'AUTHENTIC', text: '{a} is itself for forty minutes. They make it a manager. The ghosts are terrified of it.', souls: 18, curio: true }
      ] }
    ] },
  { id: 'mirror-shelf', title: 'The mirror is showing {a} a slightly different shelf. In it, {a} is taller and better loved.', art: 'mirror',
    choices: [
      { label: 'Cover the mirror', outcomes: [
        { tone: 'good', stamp: 'VEILED', text: 'You cover it with a tea towel. {a} says “thank you” so quietly you nearly miss it, then pretends it said “thank goodness”.', souls: 14, bond: 'a' },
        { tone: 'bad', stamp: 'SEEN', text: 'Too late. {a} saw the other you in there, doing the rounds properly. It holds this against you every morning.', souls: 12, grudge: 'a' }
      ] },
      { label: 'Wave at the other shelf', outcomes: [
        { tone: 'weird', stamp: 'WAVED BACK', text: 'The other you waves back, a moment too late. Then keeps waving after you have stopped.', souls: 20 },
        { tone: 'good', stamp: 'TRADE', text: 'The other shelf passes something through the glass. It is a curio. It is still warm. It is for you. It says so on the label, in your handwriting.', souls: 16, curio: true }
      ] }
    ] },
  { id: 'adopted-curse', title: '{a} has adopted a curse. It seems happy.', art: 'eye',
    choices: [
      { label: 'Break the curse', outcomes: [
        { tone: 'bad', stamp: 'BROKEN', text: 'You break it. The curse wanders off looking small and lost. {a} holds a vigil for it every night with a tiny candle.', souls: 14, grudge: 'a' },
        { tone: 'weird', stamp: 'REHOMED', text: 'The curse leaves and moves in with the neighbours. You hear screaming. {a} says “he found a nice family” with real contentment.', souls: 20 }
      ] },
      { label: 'Let them keep it', outcomes: [
        { tone: 'good', stamp: 'FAMILY', text: 'The curse is house-trained within a week. It follows {a} about. It only curses people {a} does not like, which is most people.', souls: 18, bond: 'a' },
        { tone: 'weird', stamp: 'COMPOUNDED', text: 'The curse has a little curse of its own. {a} is a grandparent now. It asks for a cardigan.', souls: 22, curio: true }
      ] }
    ] },
  { id: 'online-bone', title: '{a} has bought something online with your card. It is a small bone.', art: 'bone',
    choices: [
      { label: 'Ask for a refund', outcomes: [
        { tone: 'bad', stamp: 'DENIED', text: 'The seller says all sales are final “for obvious reasons”. {a} leaves a five-star review for the bone.', souls: 12 },
        { tone: 'weird', stamp: 'EXCHANGED', text: 'The refund arrives as a larger bone. Nobody asked for this. The seller has added you to a mailing list called “Remains”.', souls: 18, curio: true }
      ] },
      { label: 'Ask what it’s for', outcomes: [
        { tone: 'good', stamp: 'PROJECT', text: '“It’s for a project,” says {a}. The project is a very small xylophone. It plays one song. The song is about you.', souls: 18, bond: 'a' },
        { tone: 'weird', stamp: 'ONGOING', text: '{a} says it is “collecting a set”. You check the statement. It has bought eleven. It is one short of something.', souls: 20 }
      ] }
    ] },
  { id: 'trebuchet', title: '{a} is building a trebuchet. It is aimed at {b}.', pair: true, art: 'gavel',
    choices: [
      { label: 'Confiscate it', outcomes: [
        { tone: 'good', stamp: 'DISARMED', text: 'You take it away. {a} holds a small press conference and describes you as “an obstacle to peace”. {b} sends you a thank-you card. It is ticking.', souls: 16 },
        { tone: 'bad', stamp: 'REBUILT', text: 'By dawn there is a bigger one. {b} has also built one. There is an arms race on shelf one and it is extremely well engineered.', souls: 18, grudge: 'a' }
      ] },
      { label: 'Let it fly', outcomes: [
        { tone: 'weird', stamp: 'DIRECT HIT', text: 'It launches a single pea across the shelf at {b}. Direct hit. {b} eats the pea. {a} is furious at the waste of ordnance.', souls: 20, b: { food: 15 }, grudge: 'b' },
        { tone: 'good', stamp: 'MISSED', text: 'It misses {b} entirely and hits the lamp, which goes on. Everyone agrees it looks cosier. Hostilities are suspended for tea.', souls: 18 }
      ] }
    ] },
  { id: 'exhume', title: '{a} has learned a new word. The word is “exhume”.', art: 'shovel',
    choices: [
      { label: 'Explain what it means', outcomes: [
        { tone: 'weird', stamp: 'INSPIRED', text: 'You explain. {a} nods slowly, looks at the garden, and asks where you keep the torch.', souls: 18 },
        { tone: 'bad', stamp: 'APPLIED', text: 'You explain. By morning the plant pot is empty, the plant is on the shelf, and {a} is asking it questions.', souls: 16, grudge: 'a' }
      ] },
      { label: 'Teach a nicer word', outcomes: [
        { tone: 'good', stamp: 'VOCABULARY', text: 'You teach it “lovely”. {a} uses it constantly and all wrong. “What a lovely grave.” “Lovely, you have a pulse.” Lovely.', souls: 16, bond: 'a' },
        { tone: 'weird', stamp: 'COMBINED', text: 'You teach it “cosy”. It now uses both. “Let us have a cosy exhume.” You have created something unbearable.', souls: 20 }
      ] }
    ] },
  { id: 'no-blink', title: '{a} has not blinked since Tuesday. It says it is “saving them up”.', art: 'eye',
    choices: [
      { label: 'Ask what for', outcomes: [
        { tone: 'weird', stamp: 'PLANNED', text: '“For the end,” says {a}. It does not say the end of what. It has saved four hundred. It is saving more.', souls: 18 },
        { tone: 'good', stamp: 'DRAMATIC', text: 'It is saving them for a big blink on your birthday. It will be spectacular. It has been rehearsing on {a}’s own reflection.', souls: 16, bond: 'a' }
      ] },
      { label: 'Blow in its eyes', outcomes: [
        { tone: 'bad', stamp: 'WASTED', text: '{a} blinks eleven hundred times in a row, all at once, like a moth caught in a lampshade. Its savings are gone. It is heartbroken.', souls: 14, grudge: 'a', a: { clean: 20 } },
        { tone: 'weird', stamp: 'UNBLINKING', text: 'Nothing. Not a flicker. It looks at you with total patience, like a lighthouse keeper looks at the sea.', souls: 18 }
      ] }
    ] },
  { id: 'doll-head', title: '{a} has made a friend. The friend is a doll’s head called Susan.', art: 'head',
    choices: [
      { label: 'Welcome Susan', outcomes: [
        { tone: 'good', stamp: 'WELCOMED', text: 'Susan is set a place at the bowl. Susan does not eat. Susan says nothing. {a} says Susan is the best listener it has ever met.', souls: 16, bond: 'a' },
        { tone: 'weird', stamp: 'SUSAN', text: 'Susan is facing the other way this morning. Nobody moved Susan. {a} says Susan “needed some space”. Susan has a lot of opinions, apparently.', souls: 20, curio: true }
      ] },
      { label: 'Find Susan a new home', outcomes: [
        { tone: 'bad', stamp: 'SHE CAME BACK', text: 'You put Susan in a skip on the other side of town. Susan is on the shelf when you get home. She looks tired from the walk.', souls: 18 },
        { tone: 'bad', stamp: 'ESTRANGED', text: 'Susan goes to live with an aunt. {a} writes to her weekly. The letters come back marked “SHE KNOWS WHAT YOU DID”.', souls: 14, grudge: 'a' }
      ] }
    ] },
  { id: 'backwards-latin', title: '{a} is talking in its sleep. In Latin. Backwards. Something in the drawer is answering.', art: 'candle',
    choices: [
      { label: 'Wake them', outcomes: [
        { tone: 'good', stamp: 'INTERRUPTED', text: '{a} wakes up mid-sentence. The drawer finishes the sentence, sounds offended, and slams itself.', souls: 16 },
        { tone: 'weird', stamp: 'TRANSLATED', text: '{a} wakes up and translates. It was a recipe for soup. The drawer wanted to know about the soup. It was lovely soup, apparently.', souls: 18, a: { food: 20 } }
      ] },
      { label: 'Record it', outcomes: [
        { tone: 'weird', stamp: 'PLAYED BACK', text: 'Played forwards, it is {a} saying “I love my bowl” a hundred times. Played backwards, it is the drawer saying “same”.', souls: 20 },
        { tone: 'bad', stamp: 'OVERWRITTEN', text: 'The recording is fine until the end, where a third voice you did not hear at the time says your name and “soon”. You delete it. It is still in the recycle bin.', souls: 18, curio: true }
      ] }
    ] },
  { id: 'chalk-outline', title: 'Somebody has drawn a chalk outline on the shelf. It is {a}-shaped. {a} is fine.', art: 'chalk',
    choices: [
      { label: 'Investigate', outcomes: [
        { tone: 'weird', stamp: 'CASE OPEN', text: 'The chalk is from the future. The date on it is next Thursday. {a} lies down in it anyway, “to see how it feels”. Fits perfectly.', souls: 20 },
        { tone: 'bad', stamp: 'SUSPECT', text: 'Every clue points to you. You were asleep. The chalk is in your coat pocket. You do not own a coat.', souls: 18 }
      ] },
      { label: 'Wipe it off', outcomes: [
        { tone: 'good', stamp: 'CLEANED', text: 'It comes off easily. {a} redraws it in the night, a bit bigger, with a little crown this time.', souls: 14, a: { clean: 15 } },
        { tone: 'bad', stamp: 'PERMANENT', text: 'It will not come off. You scrub. {a} watches, hurt, as if you are erasing it personally.', souls: 12, grudge: 'a' }
      ] }
    ] },
  { id: 'buried-things', title: '{a} wants to be buried with its things. Its things are your things.', art: 'coffin',
    choices: [
      { label: 'Negotiate', outcomes: [
        { tone: 'good', stamp: 'AGREED', text: 'You agree on the teaspoon and one sock. {a} writes it down. It then also writes down the television, when you look away.', souls: 16, bond: 'a' },
        { tone: 'weird', stamp: 'PREPAID', text: '{a} has already been buried with your phone charger, twice, in the plant pot, as a rehearsal. The charger works better now.', souls: 18, curio: true }
      ] },
      { label: 'Point out it can’t die', outcomes: [
        { tone: 'bad', stamp: 'OFFENDED', text: '“Not with that attitude,” says {a}, deeply wounded, and turns to face the wall for the rest of the day.', souls: 12, grudge: 'a' },
        { tone: 'weird', stamp: 'LOOPHOLE', text: '{a} says it has found a loophole: “burial is a lifestyle”. It has moved into the biscuit tin with your things and is refusing visitors.', souls: 20 }
      ] }
    ] },
  { id: 'raven', title: 'The raven is back. It would like a word with {a}. In private.', art: 'raven',
    choices: [
      { label: 'Allow it', outcomes: [
        { tone: 'weird', stamp: 'CLASSIFIED', text: 'They talk for an hour. When the raven leaves, {a} is wearing a very small black armband and will not say for whom.', souls: 20 },
        { tone: 'good', stamp: 'NETWORKING', text: 'The raven offers {a} a job carrying messages to the dead. The pay is poor but there is dental. {a} accepts at once.', souls: 18, curio: true }
      ] },
      { label: 'Shoo it away', outcomes: [
        { tone: 'bad', stamp: 'NEVERMORE', text: 'The raven leaves. It says one word as it goes. You will not repeat it. {a} will. Often. At dinner.', souls: 14, grudge: 'a' },
        { tone: 'good', stamp: 'PROTECTED', text: '{a} is so touched that you defended it from a bird that it bakes you a pie. You do not ask about the filling. It was the raven.', souls: 18, bond: 'a' }
      ] }
    ] },
  { id: 'second-shadow', title: '{a} has two shadows. The second one is doing its own thing.', art: 'shadow',
    choices: [
      { label: 'Confront the shadow', outcomes: [
        { tone: 'weird', stamp: 'TRUCE', text: 'The shadow apologises, explains it “used to belong to a butler”, and offers to tidy up. The shelf has never been cleaner.', souls: 18, a: { clean: 30 } },
        { tone: 'bad', stamp: 'TOOK OFFENCE', text: 'The shadow leaves in a huff and takes {a}’s real shadow with it. {a} now casts nothing and looks naked.', souls: 16, grudge: 'a' }
      ] },
      { label: 'Let it be', outcomes: [
        { tone: 'good', stamp: 'COMPANY', text: '{a} and the extra shadow get on well. It plays with the shadow at night. There is a lot of laughter. There are only two of them.', souls: 16, a: { fuss: 25 } },
        { tone: 'weird', stamp: 'MULTIPLYING', text: 'By Friday {a} has five shadows, forming a small committee. They have taken a vote on you.', souls: 22, curio: true }
      ] }
    ] },
  { id: 'lost-soul', title: 'A lost soul has wandered onto the shelf. It is asking {a} for directions.', art: 'ghost',
    choices: [
      { label: 'Help it cross over', outcomes: [
        { tone: 'good', stamp: 'CROSSED', text: '{a} points it towards the light. The light is the fridge. The soul seems happy enough in the fridge. It keeps the milk very fresh.', souls: 24, bond: 'a' },
        { tone: 'weird', stamp: 'LOST AGAIN', text: 'It crosses over, comes back, crosses again, and asks if there is a loyalty card. {a} makes it one out of a bus ticket.', souls: 20 }
      ] },
      { label: 'Keep it', outcomes: [
        { tone: 'good', stamp: 'COLLECTED', text: 'You pop it in a jar. It glows politely and hums old songs. Your total number of souls has gone up by exactly one.', souls: 30, curio: true },
        { tone: 'bad', stamp: 'LODGER', text: 'It moves into the jar and immediately starts complaining about the jar. {a} says “welcome to the shelf”.', souls: 20, grudge: 'a' }
      ] }
    ] },
  { id: 'toenails', title: '{a} has been collecting toenail clippings. Not its own. It does not have toes.', art: 'jar',
    choices: [
      { label: 'Throw them out', outcomes: [
        { tone: 'bad', stamp: 'DISCARDED', text: 'You throw the jar out. {a} watches it go the way people watch a ship leave with everyone they love on it.', souls: 14, grudge: 'a' },
        { tone: 'good', stamp: 'CLEAN', text: 'Out they go. The shelf breathes easier. {a} is already quietly weighing your slippers with its eyes.', souls: 14, a: { clean: 25 } }
      ] },
      { label: 'Ask whose they are', outcomes: [
        { tone: 'weird', stamp: 'YOURS', text: '{a} holds the jar up. The label has your name on it, in beautiful copperplate, and a date from last week.', souls: 20, curio: true },
        { tone: 'weird', stamp: 'LIBRARY', text: '{a} has catalogued them all with little cards. It is a lending library. The cat has borrowed three.', souls: 18 }
      ] }
    ] },
  { id: 'wake', title: '{a} has decided to hold its own wake. It is alive. It would like you to say a few words.', art: 'candle',
    choices: [
      { label: 'Give a eulogy', outcomes: [
        { tone: 'good', stamp: 'MOVING', text: 'You talk about the way {a} eats the dust off crumbs. There is not a dry eye on the shelf. {a} sits up in the coffin to clap.', souls: 20, bond: 'a', a: { fuss: 30 } },
        { tone: 'bad', stamp: 'HONEST', text: 'You mention the biting. The room goes cold. {a} sits up in the coffin and says “that was never proven”.', souls: 14, grudge: 'a' }
      ] },
      { label: 'Just bring food', outcomes: [
        { tone: 'good', stamp: 'CATERED', text: 'You bring tiny sandwiches. {a} climbs out to eat them and forgets it was dead. Best wake of the year.', souls: 16, a: { food: 30 } },
        { tone: 'weird', stamp: 'GUESTS', text: 'Guests arrive that nobody invited. They eat everything and leave through the wall. The guestbook is signed “the previous tenants”.', souls: 22, curio: true }
      ] }
    ] },
  { id: 'swap-heads', title: '{a} and {b} have swapped heads. For fun. Nobody can remember how to swap back.', pair: true, art: 'head',
    choices: [
      { label: 'Try to swap them back', outcomes: [
        { tone: 'good', stamp: 'RESTORED', text: 'It takes an hour, some jam and a lot of shouting. Everyone is themselves again, but {a} says {b}’s head “had better thoughts”.', souls: 18 },
        { tone: 'weird', stamp: 'CLOSE ENOUGH', text: 'You get them nearly right. {a} now has {b}’s left ear. They say they prefer it this way. They both hear the same things now.', souls: 22 }
      ] },
      { label: 'Leave it', outcomes: [
        { tone: 'good', stamp: 'EMPATHY', text: 'A day in each other’s heads and they finally understand each other. {a} and {b} have never got on better. Or looked stranger.', souls: 18, bond: 'a', a: { fuss: 20 }, b: { fuss: 20 } },
        { tone: 'bad', stamp: 'IDENTITY', text: 'Nobody knows who to feed. You feed the wrong one twice. Both of them are furious, in each other’s voices.', souls: 16, grudge: 'b' }
      ] }
    ] },
  { id: 'jar-teeth', title: 'You found a jar of teeth behind the bowl. {a} says it is “a savings account”.', art: 'jar',
    choices: [
      { label: 'Audit the account', outcomes: [
        { tone: 'weird', stamp: 'OVERDRAWN', text: 'There are forty-one teeth and an IOU for a molar. The IOU is signed by the cat. The cat looks away when you mention it.', souls: 20, curio: true },
        { tone: 'good', stamp: 'SOLVENT', text: '{a} walks you through its investments. It has been trading teeth with the mice at an extraordinary profit. It offers you a job.', souls: 22, bond: 'a' }
      ] },
      { label: 'Make a deposit', outcomes: [
        { tone: 'bad', stamp: 'WHOSE?', text: 'You put a coin in. {a} looks at the coin. {a} looks at your mouth. You have the rest of the afternoon to think about this.', souls: 16 },
        { tone: 'good', stamp: 'INTEREST', text: 'The next morning, the jar has a small tooth for you, with a bow on it. It is a thank you. You did not want a thank you.', souls: 18, a: { fuss: 20 } }
      ] }
    ] },
  { id: 'mourning-clothes', title: '{a} is wearing full mourning dress. It will not say who died.', art: 'veil',
    choices: [
      { label: 'Offer condolences', outcomes: [
        { tone: 'good', stamp: 'APPRECIATED', text: '{a} accepts with a small, noble nod. Later you find out it was in mourning for a sandwich. It was a very good sandwich. Fair enough.', souls: 16, bond: 'a' },
        { tone: 'weird', stamp: 'PREMATURE', text: '“Oh, nobody yet,” says {a}, and looks around the shelf, fixing each resident in turn with a long, even stare.', souls: 20 }
      ] },
      { label: 'Compliment the outfit', outcomes: [
        { tone: 'good', stamp: 'STYLISH', text: '{a} does a twirl. It has been waiting weeks for anyone to notice the veil. It wears it to every meal now.', souls: 16, a: { fuss: 25 } },
        { tone: 'bad', stamp: 'INSENSITIVE', text: '“This is a very difficult time,” says {a}, and turns so you can see the back, which is also very nice.', souls: 12, grudge: 'a' }
      ] }
    ] }
];

/* Rarity sets the drop weight, the colour of the frame and the soul refund on a
   duplicate. Order matters: the engine rolls through it top to bottom. */
export const RARITIES = [
  { id: 'common', label: 'Common', weight: 56, refund: 6 },
  { id: 'uncommon', label: 'Uncommon', weight: 27, refund: 12 },
  { id: 'rare', label: 'Rare', weight: 12, refund: 25 },
  { id: 'cursed', label: 'Cursed', weight: 4, refund: 50 },
  { id: 'unholy', label: 'Unholy', weight: 1, refund: 120 }
];

export const CURIOS = [
  { id: 'tooth-not-yours', name: 'A Tooth (Not Yours)', rarity: 'common', glyph: 'tooth', text: 'Found on your pillow. You checked. All yours are still in.' },
  { id: 'damp-receipt', name: 'Damp Receipt', rarity: 'common', glyph: 'scroll', text: 'For one (1) shovel and “the discretion package”.' },
  { id: 'warm-glove', name: 'Single Glove, Still Warm', rarity: 'common', glyph: 'hand', text: 'Nobody has worn it in ninety years. It is still warm.' },
  { id: 'mourning-brooch', name: 'Mourning Brooch', rarity: 'common', glyph: 'brooch', text: 'Contains a lock of hair. The hair is still growing, slowly, towards you.' },
  { id: 'half-candle', name: 'Half a Candle', rarity: 'common', glyph: 'candle', text: 'The other half was used for something. It will not say what.' },
  { id: 'condolence-card', name: 'Unsent Condolence Card', rarity: 'common', glyph: 'scroll', text: '“Sorry for your upcoming loss.” Addressed to you. Dated tomorrow.' },
  { id: 'button-eye', name: 'Button Eye', rarity: 'common', glyph: 'eye', text: 'From a teddy bear. The teddy bear would like it back and knows where you live.' },
  { id: 'suspicious-mushroom', name: 'Suspicious Mushroom', rarity: 'common', glyph: 'mushroom', text: 'Grew overnight in the shape of a small hand, waving.' },
  { id: 'moth-wing', name: 'Moth Wing', rarity: 'common', glyph: 'moth', text: 'The moth is fine. The moth is in the cult now. It does not need both.' },
  { id: 'seance-spoon', name: 'Bent Séance Spoon', rarity: 'common', glyph: 'spoon', text: 'Bent by the spirits, or by Gerald. Gerald has never been ruled out.' },
  { id: 'name-tag', name: 'HELLO MY NAME IS ____', rarity: 'common', glyph: 'scroll', text: 'The name has been scratched out from the inside.' },
  { id: 'coffin-nail', name: 'Coffin Nail, Slightly Used', rarity: 'common', glyph: 'nail', text: 'Pulled out from the inside. Bent at the tip. Somebody wanted out quite badly.' },
  { id: 'death-photo', name: 'Victorian Death Photo', rarity: 'uncommon', glyph: 'photo', text: 'Everyone in the picture is blinking except the one who should be.' },
  { id: 'tiny-coffin', name: 'Tiny Coffin (Occupied)', rarity: 'uncommon', glyph: 'coffin', text: 'Do not open. It is fine. It knocks twice on Sundays, which is its church.' },
  { id: 'cursed-thimble', name: 'Cursed Thimble', rarity: 'uncommon', glyph: 'thimble', text: 'Anything sewn with it cannot be unsewn. Ask the scarecrow.' },
  { id: 'glass-eye', name: 'Grandmother’s Glass Eye', rarity: 'uncommon', glyph: 'eye', text: 'Not your grandmother. Still watching you like she is disappointed.' },
  { id: 'leech-locket', name: 'Leech in a Locket', rarity: 'uncommon', glyph: 'brooch', text: 'Romantic, in the Victorian way. It has been fed. Do not ask what.' },
  { id: 'lake-ring', name: 'Wedding Ring from the Lake', rarity: 'uncommon', glyph: 'ring', text: 'Engraved “Till death”. Then, smaller, “and then some”.' },
  { id: 'formal-mouse', name: 'Taxidermied Mouse in Formal Wear', rarity: 'uncommon', glyph: 'mouse', text: 'Posed mid-toast. Its glass is still full. Nobody knows of what.' },
  { id: 'map-house', name: 'A Map to Your House', rarity: 'uncommon', glyph: 'scroll', text: 'Hand-drawn, very accurate, with a small X on your bed.' },
  { id: 'jar-teeth', name: 'Jar of Teeth (Savings)', rarity: 'uncommon', glyph: 'jar', text: 'Forty-one teeth and an IOU from the cat. Accruing interest.' },
  { id: 'monkey-paw', name: 'Monkey’s Paw', rarity: 'rare', glyph: 'paw', text: 'Two fingers left. The last owner wished for “a quiet life”. Look how quiet.' },
  { id: 'hand-of-glory', name: 'Hand of Glory', rarity: 'rare', glyph: 'hand', text: 'Lit at all five fingers. Every sleeping thing on the shelf stays asleep. Everything else gets nervous.' },
  { id: 'bottled-scream', name: 'Bottled Scream', rarity: 'rare', glyph: 'bottle', text: 'Vintage 1893. Best opened at a party you would like to end.' },
  { id: 'music-box', name: 'Haunted Music Box', rarity: 'rare', glyph: 'box', text: 'Plays a lullaby you have never heard but somehow know every word of.' },
  { id: 'planchette', name: 'Ouija Planchette', rarity: 'rare', glyph: 'planchette', text: 'Still moving. Spells the same word over and over. It is “snacks”.' },
  { id: 'other-key', name: 'The Other Key', rarity: 'rare', glyph: 'key', text: 'Opens a door in this house. You have tried every door. It is not one of those.' },
  { id: 'waving-hand', name: 'A Hand That Waves Back', rarity: 'cursed', glyph: 'hand', text: 'Just the hand. It waves when you wave. It also waves when you do not.' },
  { id: 'turning-doll', name: 'Doll Facing the Other Way', rarity: 'cursed', glyph: 'head', text: 'Every time you look away, it faces the other way. Nobody has ever seen it face you. Do not try.' },
  { id: 'named-book', name: 'The Book With Your Name In It', rarity: 'cursed', glyph: 'book', text: 'Your whole life, chapter by chapter. The last page is blank. The ink is drying.' },
  { id: 'last-breath', name: 'Jar of Someone’s Last Breath', rarity: 'cursed', glyph: 'jar', text: 'Label: “Uncle Horace, 1902. Do not open. He had onions.”' },
  { id: 'the-nail', name: 'The Nail', rarity: 'unholy', glyph: 'nail', text: 'Holds the house up. You removed it. The house has not noticed. Yet.' },
  { id: 'small-door', name: 'A Door, Small', rarity: 'unholy', glyph: 'door', text: 'Fits in a pocket. Opens onto a very long corridor. Something at the far end is coming to see who opened it.' },
  { id: 'shelf-heart', name: 'The Shelf’s Own Heart', rarity: 'unholy', glyph: 'heart', text: 'Still beating. Every resident on the shelf beats in time with it. So, now, do you.' }
];

/* Lifetime souls set the household's rank. Titles are how the neighbours talk
   about the house, not how the house talks about itself. */
export const RANKS = [
  { at: 0, title: 'Suspiciously Normal', line: 'The neighbours wave. They do not know yet.' },
  { at: 60, title: 'Mildly Damp', line: 'There is a smell. It is coming from the shelf. It is, in a way, a greeting.' },
  { at: 160, title: 'Faintly Cursed', line: 'Milk curdles in the fridge when you walk past. The milk had it coming.' },
  { at: 320, title: 'Neighbourhood Concern', line: 'A leaflet has been posted through your door. It is about you. It has pictures.' },
  { at: 560, title: 'Under Investigation', line: 'A man in a hat has started standing across the road. He is taking notes. So are the residents, about him.' },
  { at: 900, title: 'Condemned Property', line: 'The council has put a notice on the door. The residents have framed it.' },
  { at: 1400, title: 'Local Legend', line: 'Children dare each other to touch your gate. One of them did. He is on shelf three now. He seems happy.' },
  { at: 2100, title: 'Officially Haunted', line: 'You have received a certificate. The ghosts have signed it too.' },
  { at: 3000, title: 'Portal-Adjacent', line: 'The cupboard under the stairs now opens onto somewhere else on Tuesdays. Keep a coat in there.' },
  { at: 4200, title: 'Eldritch Landlord', line: 'Things older than language pay you rent. On time. In teeth.' },
  { at: 6000, title: 'The Thing Under the Stairs', line: 'The neighbours have moved. So has the street, slightly.' },
  { at: 8500, title: 'Unspeakable', line: 'Nobody says your address out loud anymore. The postman leaves the post at the end of the road and runs.' }
];

/* One omen per local day, drawn on the first visit. `effect` is read by the
   engine; `line` is what the card says. */
export const OMENS = [
  { id: 'wet-hand', name: 'The Wet Hand', effect: 'care', line: 'Care pays double souls today. Something damp approves of your touch.' },
  { id: 'hanged-spoon', name: 'The Hanged Spoon', effect: 'mayhem', line: 'Emergencies pay double souls today. Things are going to go wrong beautifully.' },
  { id: 'open-coffin', name: 'The Open Coffin', effect: 'coffin', line: 'Coffins are half price today. The undertaker is having a sale.' },
  { id: 'many-eyes', name: 'The Many Eyes', effect: 'luck', line: 'Rarer curios are more likely today. Everything in the dark is looking in your direction.' },
  { id: 'crowded-grave', name: 'The Crowded Grave', effect: 'extra', line: 'One more emergency can pile up today. The shelf is feeling ambitious.' },
  { id: 'patient-worm', name: 'The Patient Worm', effect: 'chores', line: 'Chores pay double souls today. The worm respects a work ethic.' },
  { id: 'smiling-moon', name: 'The Smiling Moon', effect: 'care', line: 'Care pays double souls today. The moon is smiling. The moon does not have a mouth.' },
  { id: 'second-shadow', name: 'The Second Shadow', effect: 'mayhem', line: 'Emergencies pay double souls today. Your shadow has plans of its own.' },
  { id: 'tolling-bell', name: 'The Tolling Bell', effect: 'luck', line: 'Rarer curios are more likely today. It tolls for thee. It is also offering a discount.' },
  { id: 'hungry-house', name: 'The Hungry House', effect: 'extra', line: 'One more emergency can pile up today. The house is peckish.' }
];

/* Three chores a day, drawn from these. `deed` is the event the engine counts. */
export const CHORES = [
  { id: 'feed', deed: 'care:food', need: 3, label: 'Feed the hungry things', line: 'Feed residents 3 times' },
  { id: 'fuss', deed: 'care:fuss', need: 3, label: 'Pet something that bites', line: 'Fuss residents 3 times' },
  { id: 'wash', deed: 'care:clean', need: 2, label: 'Hose down the damp', line: 'Wash residents 2 times' },
  { id: 'mayhem', deed: 'mayhem', need: 2, label: 'Deal with the fallout', line: 'Resolve 2 emergencies' },
  { id: 'mayhem3', deed: 'mayhem', need: 3, label: 'Triage the chaos', line: 'Resolve 3 emergencies' },
  { id: 'rounds', deed: 'rounds', need: 1, label: 'Push the trolley', line: 'Do the rounds once' },
  { id: 'game', deed: 'game', need: 1, label: 'Play with your food', line: 'Finish a Playroom game' },
  { id: 'coffin', deed: 'coffin', need: 1, label: 'Open a coffin', line: 'Open 1 coffin' },
  { id: 'check', deed: 'check', need: 1, label: 'Read the complaints', line: 'Check the shelf for notes' },
  { id: 'care5', deed: 'care', need: 5, label: 'Make the rounds personal', line: 'Care for residents 5 times' }
];

/* Lines for the empty emergency tray and small toasts. */
export const QUIET_LINES = [
  'Nothing is on fire. Give it a minute.',
  'All quiet. Too quiet. Someone is definitely digging.',
  'No emergencies. The residents are planning the next one together.',
  'Peace on the shelf. Enjoy it. It is lying to you.',
  'Nothing has gone wrong yet. The drawer is breathing a bit heavily though.'
];
export const DUPLICATE_LINES = [
  'You already own this. It is disappointed in you.',
  'A duplicate. The first one is jealous.',
  'You have one of these. Now you have a matching pair. Nobody wanted a pair.',
  'Another one. They must be breeding.'
];

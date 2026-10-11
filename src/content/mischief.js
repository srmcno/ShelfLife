/* ================= MISCHIEF =================
   Friends can now cause trouble on each other’s shelves, and help out.

   Hexes. Once a day a player is dealt a hand of three cards from HEX_DECK and
   may send one to a friend. It lands in the friend’s emergency tray as a real
   emergency, with one of the sender’s residents as the culprit. The server
   deals the hand (supabase/migrations/0007_mischief.sql keeps the same ids in
   private.hex_deck(); test/mischief_content.test.mjs checks they match).

   Writing rules, on top of content/mayhem.js:
     * {a} is the resident on the victim’s own shelf, {b} is the culprit from
       the sender’s shelf, {f} is the sender’s name. The engine fills {a} and
       {b}; engine/mischief.js fills {f} before the card is drawn.
     * Every outcome pays souls (10 to 24) and never takes anything: no grudge,
       no curse on a need, need deltas only ever upwards. Mischief costs the
       victim time and dignity, never what they earned.
     * `how` on a choice and `report` on an outcome are for the sender. The
       sender reads “Bea resolved your Unsolicited Accordion with a firm lid.”
       then the report. In a report {f} is the victim’s player and {c} the culprit.
     * `rebound: true` lets the victim send one hex back, free, once.
     * The funniest beat last. Dry, dark, specific, petty. No dashes. */

const STAGEY = ['theatrical', 'terminal', 'narcissist', 'method', 'martyr', 'influencer', 'prophet', 'understudy'];
const OFFICIAL = ['complaints', 'litigious', 'auditor', 'steward', 'management', 'etiquette', 'executor', 'critic'];
const GREEDY = ['magpie', 'hoarder', 'landlord', 'timeshare', 'closer', 'freegan'];
const SPOOKY = ['haunted', 'cursed', 'cryptid', 'mourner', 'undertaker', 'doom', 'taxidermy', 'bones'];
const NOSY = ['gossip', 'socialite', 'witness', 'paranoid', 'unblinking'];
const TIDY = ['clean', 'minimalist', 'etiquette', 'porcelain'];

export const HEX_DECK = [
  { id: 'sock-of-ill-omen', name: 'A Sock of Ill Omen', art: 'veil', blurb: 'One sock. Warm. Nobody’s.',
    title: '{b} has left a single sock on {a}’s pillow. It is warm. It is nobody’s size.',
    choices: [
      { label: 'Burn it', how: 'with fire', outcomes: [
        { tone: 'good', stamp: 'CREMATED', text: 'The sock burns with a small blue flame and a smell of 1974. {a} sleeps soundly for the first time in a week. Somewhere, a left foot is cold and furious.', souls: 16, report: 'The sock is ash. {c} came home smelling of 1974.' },
        { tone: 'weird', stamp: 'FIREPROOF', text: 'The sock does not burn. It sits in the grate, glowing gently, as if waiting to be asked properly. {a} has started calling it Gerald.', souls: 18, rebound: true, report: 'The sock survived the fire and has a name now.' }
      ] },
      { label: 'Let {a} wear it', how: 'by wearing it', outcomes: [
        { tone: 'good', stamp: 'SNUG', text: '{a} wears it as a hat. It fits perfectly, which is the worrying part. {a} now refuses to take it off for meals, baths or the inquest.', souls: 15, a: { fuss: 15 }, report: 'The sock is a hat now. {f}’s resident will not take it off, even for the inquest.' },
        { tone: 'weird', stamp: 'PAIRED', text: 'The moment {a} puts it on, its partner arrives by second post with no stamp and a note that says “Finally.” Nobody has seen the postman since.', souls: 19, curio: true, report: 'The sock found its partner. {c} has been asked to stop sending things.' }
      ] }
    ] },
  { id: 'unsolicited-accordion', name: 'Unsolicited Accordion', art: 'box', blurb: 'Arrives breathing.',
    title: '{b} has delivered an accordion to {a}. Nobody ordered it. It is breathing on its own.',
    choices: [
      { label: 'Close the lid on it', how: 'with a firm lid', outcomes: [
        { tone: 'good', stamp: 'MUFFLED', text: 'You sit on the case until it stops. It sighs once, in B flat, and is still. {a} says it heard it whisper “encore”.', souls: 15, report: 'Your {c} was returned, flattened.' },
        { tone: 'weird', stamp: 'ENCORE', text: 'The lid shuts. The accordion plays from inside the case anyway: a polka, slowly, for four hours. {a} learns every word. There are no words.', souls: 18, rebound: true, report: 'It played on inside the case. {f} knows the polka now.' }
      ] },
      { label: 'Let {a} play it', how: 'by learning to play it', outcomes: [
        { tone: 'good', stamp: 'VIRTUOSO', text: '{a} plays one sea shanty with total confidence and no knowledge of the sea. The shelf weeps. The lamp requests it for the funeral it is planning.', souls: 17, a: { fuss: 15 }, fits: STAGEY, report: '{f}’s resident played it beautifully. {c} has asked for the accordion back and been refused.' },
        { tone: 'bad', stamp: 'SQUEEZED', text: 'The accordion plays {a} instead. It is a short piece. {a} spends the afternoon in a drawer, folded in places that do not normally fold.', souls: 12, report: 'The accordion won. {f}’s resident is resting in a drawer, pleated.' }
      ] }
    ] },
  { id: 'the-drawer-remembers', name: 'The Drawer Remembers', art: 'door', blurb: 'It kept everything. It wants to go through it.',
    title: '{b} has opened the drawer under {a}. The drawer remembers everything {a} ever put in it, and would like to go through it item by item.',
    choices: [
      { label: 'Shut the drawer', how: 'by shutting the drawer', outcomes: [
        { tone: 'good', stamp: 'CLOSED', text: 'It shuts with the click of a solicitor’s briefcase. {a} pretends nothing happened. A voice inside says “we will speak again” in exactly the tone of {a}’s mother.', souls: 14, report: '{c} was shown out, along with the drawer’s opinions.' },
        { tone: 'weird', stamp: 'ITEMISED', text: 'The drawer will not shut until it has read the inventory aloud. One button, two teeth (not {a}’s), a receipt for “a favour”. {a} demands a lawyer. The drawer is a lawyer.', souls: 19, curio: true, report: 'The drawer read out the inventory. {f}’s resident is seeking representation.' }
      ] },
      { label: 'Let it talk', how: 'by letting the drawer talk', outcomes: [
        { tone: 'good', stamp: 'CLOSURE', text: 'It is cathartic. {a} finally learns where the left slipper went in 1931. The drawer apologises. {a} does not, on principle.', souls: 16, bond: 'a', report: '{f}’s resident got closure. {c} got nothing, and seemed to expect more.' },
        { tone: 'weird', stamp: 'ACCOUNTED', text: 'The drawer remembers {b} too, in detail. {b} leaves by the window, which is on the wrong side of the room for a window.', souls: 20, rebound: true, report: 'The drawer had things to say about {c} as well. Check your own drawers.' }
      ] }
    ] },
  { id: 'damp-invitation', name: 'Damp Invitation', art: 'scroll', blurb: 'You are cordially invited. Bring a towel.',
    title: '{b} has hand-delivered an invitation to {a}. The hand was wet. It invites {a} to “a small drowning, informal, no gifts”.',
    choices: [
      { label: 'Send regrets', how: 'with a polite refusal', outcomes: [
        { tone: 'good', stamp: 'REGRETS', text: '{a} writes “regrettably unable” in its best hand. A second invitation arrives, damper, with “we insist” underlined. {a} hangs it to dry next to the first.', souls: 14, report: '{f}’s resident declined. {c} is drying out on their radiator.' },
        { tone: 'weird', stamp: 'ATTENDED', text: 'The refusal goes to the party on its own and is a huge success. It comes home at three in the morning wearing somebody else’s hat.', souls: 18, curio: true, report: 'The refusal went to the party instead and had a lovely time. {c} did not.' }
      ] },
      { label: 'Go, in a raincoat', how: 'by attending in a raincoat', outcomes: [
        { tone: 'good', stamp: 'GUEST', text: '{a} goes, stays dry and leaves early with a goodie bag of pond. The hosts say it was the best guest they ever had. It was the only guest.', souls: 17, a: { clean: 20 }, report: '{f}’s resident was the best guest. {c} has been asked to host next year.' },
        { tone: 'bad', stamp: 'SOAKED', text: 'The raincoat lets it down. {a} comes home a full pint heavier and squelches gently for the rest of the evening. Everyone pretends not to hear.', souls: 12, rebound: true, report: '{f}’s resident came home squelching. Hide your towels.' }
      ] }
    ] },
  { id: 'eulogy-in-advance', name: 'A Eulogy in Advance', art: 'book', blurb: 'Kind words, early. Very early.',
    title: '{b} has written {a}’s eulogy and would like to read it now, “while there’s still a crowd”.',
    choices: [
      { label: 'Sit through it', how: 'by sitting through it', outcomes: [
        { tone: 'good', stamp: 'MOVING', text: 'It is beautiful. {a} cries twice and corrects the dates once. A moth gives {b} a standing ovation.', souls: 16, bond: 'a', report: '{c} read the eulogy. It went well. A moth stood up.' },
        { tone: 'weird', stamp: 'PREMATURE', text: 'Halfway through, {a} objects that it would never say “live, laugh, linger”. {b} produces a recording. {a} did say it. Twice.', souls: 18, report: '{c} had a recording. {f}’s resident has requested a retrial.' }
      ] },
      { label: 'Write one back', how: 'by writing one back', outcomes: [
        { tone: 'good', stamp: 'RECIPROCAL', text: '{a} writes {b}’s eulogy in four minutes flat. It is devastating and mostly about a hat. Both agree never to die, as a compromise.', souls: 15, report: 'They swapped eulogies. Theirs for {c} is mostly about a hat.' },
        { tone: 'weird', stamp: 'REBUTTED', text: '{a}’s eulogy for {b} runs to nine pages with footnotes. The ninth page is just “and another thing”. It has been posted to {b}’s family.', souls: 20, rebound: true, fits: OFFICIAL, report: 'Your {c} received a nine page eulogy with footnotes.' }
      ] }
    ] },
  { id: 'wrong-portrait', name: 'The Wrong Portrait', art: 'photo', blurb: 'A lovely likeness of someone else.',
    title: '{b} has hung a portrait of {a} over the shelf. It is a very good portrait. It is of someone else entirely.',
    choices: [
      { label: 'Take it down', how: 'by taking it down', outcomes: [
        { tone: 'good', stamp: 'REMOVED', text: 'Behind it is a smaller portrait, also of someone else. Behind that is a note: “You’ll never find the real one.” {a} has stopped looking.', souls: 15, report: 'The portrait came down. {c} has kept the real one, wherever it is.' },
        { tone: 'weird', stamp: 'RESEMBLANCE', text: 'Once it is down, {a} starts to look like the portrait. Not much. Around the eyes. The neighbours have started calling {a} Colonel.', souls: 19, curio: true, report: '{f}’s resident now looks a bit like the portrait. The neighbours call it Colonel.' }
      ] },
      { label: 'Let {a} grow into it', how: 'by leaving it up', outcomes: [
        { tone: 'good', stamp: 'FLATTERED', text: '{a} decides it is an improvement and starts standing like the portrait: one hand on a globe that is not there. It is a good look.', souls: 16, a: { fuss: 15 }, fits: STAGEY, report: '{f}’s resident has adopted the pose. There is no globe. It does not matter.' },
        { tone: 'weird', stamp: 'SITTING', text: 'The person in the portrait arrives at teatime to collect it and stays for the biscuits. Nobody can bring themselves to ask who they are. They are still there.', souls: 21, rebound: true, report: 'The person in the portrait turned up and has not left.' }
      ] }
    ] },
  { id: 'reverse-charge-seance', name: 'A Reverse-Charge Séance', art: 'planchette', blurb: 'The dead call. You pay.',
    title: '{b} has given the dead {a}’s number. They are calling now, reverse charge, and they have a lot to get through.',
    choices: [
      { label: 'Accept the charges', how: 'by accepting the charges', outcomes: [
        { tone: 'good', stamp: 'CONNECTED', text: 'It is {a}’s great aunt, mainly to say the hat was a mistake. The call costs one tooth. {a} has a spare. {a} always has a spare.', souls: 17, report: 'They took the call. It cost one tooth, which they had spare.' },
        { tone: 'weird', stamp: 'HELD', text: '{a} is on hold to the afterlife for three hours. The hold music is everyone it ever annoyed, humming. Then a voice says “sorry, wrong {a}” and hangs up.', souls: 19, rebound: true, report: 'Three hours on hold to the afterlife. Expect a call.' }
      ] },
      { label: 'Hang up', how: 'by hanging up', outcomes: [
        { tone: 'good', stamp: 'DISCONNECTED', text: 'The phone stops. The planchette starts. It spells “RUDE”. {a} spells “BUSY” back with the biscuits. Honour is satisfied.', souls: 14, report: '{f}’s resident hung up on the dead. {c} has been blamed by both sides.' },
        { tone: 'weird', stamp: 'VOICEMAIL', text: 'The dead leave a voicemail. It is eleven minutes long and ends with “anyway, love to {b}”. Nobody knew {b} had friends there.', souls: 18, curio: true, report: 'The dead left a voicemail. It sends {c} its love. Worryingly.' }
      ] }
    ] },
  { id: 'subscription-to-moths', name: 'A Subscription to Moths', art: 'moth', blurb: 'A moth a day, for life. Whose life is unclear.',
    title: '{b} has signed {a} up for a moth subscription. The first issue has arrived and is eating the second.',
    choices: [
      { label: 'Cancel it', how: 'by cancelling the subscription', outcomes: [
        { tone: 'good', stamp: 'UNSUBSCRIBED', text: 'Cancelling takes forty minutes and a lot of pressing nine. The last moth leaves with a small suitcase and a face like you have ruined Christmas.', souls: 15, report: 'They cancelled. The last moth left with a suitcase. {c} has been sent the bill.' },
        { tone: 'weird', stamp: 'RENEWED', text: 'The cancellation is accepted, then renewed by the moths, who own the company. {a} is now the face of the brand. The photographs are mostly lampshade.', souls: 20, rebound: true, report: 'The moths renewed it themselves. {f}’s resident is the face of the brand.' }
      ] },
      { label: 'Read the first issue', how: 'by reading the first issue', outcomes: [
        { tone: 'good', stamp: 'INFORMED', text: 'It is quite good. There is a crossword with every answer “lamp”. {a} gets them all and feels clever for the first time since the flood.', souls: 16, bond: 'a', report: 'They enjoyed the first issue. Every answer was “lamp”.' },
        { tone: 'weird', stamp: 'LETTERS PAGE', text: '{a}’s letter of complaint is printed in issue two. The reply is from {b}, who apparently writes the problem page under the name Doris.', souls: 18, fits: OFFICIAL, report: '{f}’s complaint was printed. Your {c} has been exposed as Doris.' }
      ] }
    ] },
  { id: 'tooth-under-the-pillow', name: 'A Tooth Under the Pillow', art: 'tooth', blurb: 'Not anyone’s. Not anymore.',
    title: '{b} has put a tooth under {a}’s pillow. It is not {a}’s tooth. The tooth fairy is downstairs asking questions.',
    choices: [
      { label: 'Claim the tooth', how: 'by claiming the tooth', outcomes: [
        { tone: 'good', stamp: 'PAID OUT', text: 'The fairy pays out in old coins and leaves without looking {a} in the eye. {a} spends it on nothing. The joy is in the fraud.', souls: 18, fits: GREEDY, report: '{f}’s resident claimed it and was paid. The fairy is looking for {c}.' },
        { tone: 'weird', stamp: 'AUDITED', text: 'The fairy checks the dental records. {a} has no teeth on record. {a} may not have teeth. A form is left: “Please confirm your mouth.”', souls: 17, report: 'The tooth fairy audited them. {c} is named on the paperwork.' }
      ] },
      { label: 'Give it back to {b}', how: 'by returning the tooth', outcomes: [
        { tone: 'good', stamp: 'RETURNED', text: '{b} accepts the tooth, counts its own teeth, and goes very quiet. Nobody knows whose it was. Nobody is going to ask.', souls: 14, report: 'The tooth came back. {c} counted and went very quiet.' },
        { tone: 'weird', stamp: 'TRADED', text: '{b} swaps it for another tooth, then another. By teatime there is a small market. {a} owns three molars and an interest in a canine.', souls: 21, rebound: true, curio: true, report: 'It became a market. {f}’s resident owns three molars now.' }
      ] }
    ] },
  { id: 'the-midnight-bell', name: 'The Midnight Bell', art: 'clock', blurb: 'Rings at midnight. Every hour.',
    title: '{b} has hidden a bell somewhere near {a}. It rings at midnight. It thinks every hour is midnight.',
    choices: [
      { label: 'Find the bell', how: 'by finding the bell', outcomes: [
        { tone: 'good', stamp: 'FOUND', text: 'It is in the teapot. It has been in the teapot for days. {a} has been drinking tea that rings. That explains a great deal about Tuesday.', souls: 16, report: 'The bell was in the teapot. {f}’s resident drank from it for days.' },
        { tone: 'weird', stamp: 'TOLLED', text: 'Every time {a} gets close, the bell moves and rings once, for whom it does not say. {a} has narrowed it down to the wall, the ceiling or itself.', souls: 18, rebound: true, report: 'They could not find it. It may be inside them.' }
      ] },
      { label: 'Keep its hours', how: 'by keeping its hours', outcomes: [
        { tone: 'good', stamp: 'PUNCTUAL', text: '{a} lives on bell time now. Twelve midnights a day. It has never been so rested, or so sure that something is coming.', souls: 15, a: { fuss: 20 }, fits: ['nocturnal', 'insomniac', 'sleepwalker'], report: '{f}’s resident lives on bell time now and has never been happier.' },
        { tone: 'bad', stamp: 'STRUCK', text: 'At the fourth midnight {a} answers the door to nobody, then to {b}, then to nobody again. One of them was wearing {a}’s dressing gown.', souls: 12, report: 'Your {c} was spotted at their door at midnight, four times, in a dressing gown.' }
      ] }
    ] },
  { id: 'jar-of-whispers', name: 'A Jar of Whispers', art: 'jar', blurb: 'Everything anyone said about you. Sealed.',
    title: '{b} has left {a} a jar. Inside are whispers. They are all about {a}. Some of them are recent.',
    choices: [
      { label: 'Open it', how: 'by opening the jar', outcomes: [
        { tone: 'good', stamp: 'FLATTERED', text: 'They are mostly compliments, whispered by people too proud to say them out loud. One just says “nice elbows”. {a} has not stopped touching its elbows.', souls: 17, bond: 'a', fits: NOSY, report: 'The whispers were compliments. Something about elbows. Well done, {c}.' },
        { tone: 'weird', stamp: 'OVERHEARD', text: 'The whispers get out and settle in the curtains. Now the curtains talk about {a} too, but kindly, and only when the window is open.', souls: 19, rebound: true, report: 'The whispers live in their curtains now.' }
      ] },
      { label: 'Put it on a high shelf', how: 'by putting it on a high shelf', outcomes: [
        { tone: 'good', stamp: 'SHELVED', text: 'Up there it can whisper all it likes. The spider on that shelf now knows everything and has started charging for it.', souls: 14, report: 'The jar is on a high shelf. A spider is selling the contents.' },
        { tone: 'weird', stamp: 'PRESERVED', text: 'Years later, or after lunch, the jar is labelled “{a}, vintage”. {b} wants it back for the collection. {a} wants to know what collection.', souls: 18, curio: true, report: '{c} would like the jar back for the collection. They want to know what collection.' }
      ] }
    ] },
  { id: 'express-coffin', name: 'Express Coffin, Signed For', art: 'coffin', blurb: 'Next day delivery. Recipient optional.',
    title: 'A coffin has arrived for {a}, express, signed for by {b}. It is {a}’s size exactly. There is a returns slip.',
    choices: [
      { label: 'Send it back', how: 'by sending it back', outcomes: [
        { tone: 'good', stamp: 'RETURNED', text: 'The returns slip asks for a reason. {a} ticks “changed my mind” and then, after thought, “not dead”. Refund in five to seven working centuries.', souls: 15, report: 'They returned it. Reason given: not dead. {c} signed for that too.' },
        { tone: 'weird', stamp: 'FORWARDED', text: 'The coffin is returned to sender. The sender is {b}. {b} is now sleeping in it and describes it as “restorative”.', souls: 19, rebound: true, report: 'It came back to {c}, who now sleeps in it.' }
      ] },
      { label: 'Try it for size', how: 'by trying it on', outcomes: [
        { tone: 'good', stamp: 'PERFECT FIT', text: '{a} gets in, gets comfortable and refuses to get out. The lid is propped open with a biscuit. {a} takes calls in there now.', souls: 17, a: { fuss: 20 }, fits: SPOOKY, report: '{f}’s resident loves the coffin and is taking calls from it.' },
        { tone: 'weird', stamp: 'OCCUPIED', text: 'There is already someone in it, a small polite skeleton who apologises and moves up. They have been there since the warehouse. They would like a cup of tea.', souls: 20, curio: true, report: 'The coffin came with a skeleton. It has asked for tea.' }
      ] }
    ] },
  { id: 'raven-with-opinions', name: 'A Raven With Opinions', art: 'raven', blurb: 'Quoth plenty.',
    title: '{b} has sent a raven to sit above {a}’s door. It does not say nevermore. It says a lot of other things, about {a}’s choices.',
    choices: [
      { label: 'Argue with it', how: 'by arguing with the raven', outcomes: [
        { tone: 'good', stamp: 'OUT-ARGUED', text: '{a} wins on points. The raven leaves a feather and a written apology, in a surprisingly neat hand. It still thinks the cardigan is wrong.', souls: 16, fits: ['critic', 'litigious', 'complaints', 'spiteful'], report: '{f}’s resident won the argument. The raven still thinks the cardigan is wrong.' },
        { tone: 'weird', stamp: 'ADJOURNED', text: 'The debate is adjourned until the raven can consult its notes. Its notes are about {b}. They are scathing. {a} reads them aloud at dinner.', souls: 19, rebound: true, report: 'The raven’s notes were all about {c}. They were read aloud at dinner.' }
      ] },
      { label: 'Feed it', how: 'by feeding the raven', outcomes: [
        { tone: 'good', stamp: 'CONVERTED', text: 'Three crusts in, the raven’s opinions soften. By the fifth it thinks {a} is wonderful and that {b} should be looked into.', souls: 15, bond: 'a', report: 'They fed the raven. It now thinks {c} should be looked into.' },
        { tone: 'weird', stamp: 'TENANT', text: 'The raven moves in. It pays rent in shiny things, mostly {a}’s own shiny things, bought back at a markup.', souls: 18, curio: true, fits: GREEDY, report: 'The raven moved in and is selling them their own spoons.' }
      ] }
    ] },
  { id: 'spider-lodger', name: 'A Spider Lodger', art: 'spider', blurb: 'Quiet. Clean. Has references.',
    title: '{b} has sublet the corner above {a} to a spider. The spider has a lease. The lease is woven, and legally binding.',
    choices: [
      { label: 'Evict it', how: 'with an eviction notice', outcomes: [
        { tone: 'good', stamp: 'EVICTED', text: 'The spider reads the notice, eight times, then packs. It leaves the corner spotless and a review that says “host was cold”.', souls: 14, report: 'The spider was evicted and left a bad review of {c}.' },
        { tone: 'weird', stamp: 'APPEALED', text: 'The spider appeals. The appeal is heard by another spider. {a} loses on a technicality involving the word “corner”.', souls: 18, rebound: true, fits: OFFICIAL, report: 'The spider won on appeal. {f}’s resident has been served.' }
      ] },
      { label: 'Accept the lodger', how: 'by taking in the lodger', outcomes: [
        { tone: 'good', stamp: 'TIDY', text: 'Best tenant ever. It catches the flies, dusts the lamp and leaves notes about the water pressure that are, honestly, fair.', souls: 16, a: { clean: 20 }, report: 'They kept the spider. It does the dusting now. {c} has been outclassed.' },
        { tone: 'weird', stamp: 'EXTENDED', text: 'The spider’s family arrives for “a few nights”. It is a large family. {a} now lives in the corner and the spiders live everywhere else.', souls: 20, report: 'The spider’s family moved in. {f}’s resident lives in the corner now.' }
      ] }
    ] },
  { id: 'spoon-that-hums', name: 'The Spoon That Hums', art: 'spoon', blurb: 'It knows one tune. It knows it well.',
    title: '{b} has swapped {a}’s spoon for one that hums. It hums the same four notes. It is getting louder.',
    choices: [
      { label: 'Bury the spoon', how: 'by burying the spoon', outcomes: [
        { tone: 'good', stamp: 'INTERRED', text: 'A short service in the plant pot. {a} reads a few words. The humming stops. The plant now hums, faintly, and has started to flower.', souls: 16, report: 'The spoon was buried. The plant hums it now, and is flowering.' },
        { tone: 'weird', stamp: 'HARMONY', text: 'From under the soil, the spoon is joined by a fork in harmony. {a} did not bury a fork. Nobody in this house owns a fork.', souls: 19, rebound: true, report: 'A fork turned up in harmony. Nobody owns a fork.' }
      ] },
      { label: 'Hum along', how: 'by humming along', outcomes: [
        { tone: 'good', stamp: 'DUET', text: '{a} finds the harmony on the first try. They perform it at teatime. A neighbour bangs on the wall in time, which counts as applause.', souls: 17, bond: 'a', fits: ['hummer', 'theatrical', 'understudy'], report: 'They hummed along and found the harmony. Even the neighbour joined in.' },
        { tone: 'weird', stamp: 'EARWORM', text: 'Now {a} cannot stop humming either. The spoon has gone quiet, smug. {a} hums through meals, baths and a very serious conversation about the will.', souls: 18, report: 'The spoon stopped. {f}’s resident has not. It hummed through the will.' }
      ] }
    ] },
  { id: 'spare-shadow', name: 'A Spare Shadow', art: 'shadow', blurb: 'Gently used. One previous owner.',
    title: '{b} has stitched a second shadow onto {a}. It is a little behind, and it does not like where {a} is going.',
    choices: [
      { label: 'Unpick it', how: 'by unpicking the stitches', outcomes: [
        { tone: 'good', stamp: 'DETACHED', text: 'It comes off cleanly and slides under the door, back the way it came. {a}’s own shadow is visibly relieved and stands a little closer than usual.', souls: 15, report: 'The spare shadow came home under the door. Check behind {c}.' },
        { tone: 'weird', stamp: 'CUSTODY', text: 'Both shadows claim to be the original. {a} has to choose. It picks the one that waves first. It is not sure it chose right.', souls: 19, rebound: true, report: 'There was a custody dispute over shadows.' }
      ] },
      { label: 'Let it trail', how: 'by letting it trail along', outcomes: [
        { tone: 'good', stamp: 'ESCORTED', text: 'Two shadows look very grand. {a} walks the length of the shelf twice to show them off. The lamp has to work overtime and has filed a complaint.', souls: 16, fits: STAGEY, report: '{f}’s resident is showing off its second shadow. The lamp has complained.' },
        { tone: 'weird', stamp: 'OVERTAKEN', text: 'By evening the new shadow is ahead. {a} is now following it. They are going somewhere. Neither of them will say where.', souls: 20, curio: true, report: 'The shadow is leading now. Nobody knows where to.' }
      ] }
    ] },
  { id: 'fairy-ring', name: 'A Fairy Ring in the Carpet', art: 'mushroom', blurb: 'Step inside. Lose a week.',
    title: '{b} has planted a ring of mushrooms around {a} while it slept. Stepping out costs a year, according to a small sign.',
    choices: [
      { label: 'Step out anyway', how: 'by stepping out', outcomes: [
        { tone: 'good', stamp: 'UNAGED', text: '{a} steps out and loses a year. It cannot die, so this just means it misses one Christmas it was dreading. Net gain.', souls: 17, report: 'They stepped out and lost a year. They were glad of it.' },
        { tone: 'weird', stamp: 'RECEIPT', text: 'The year is billed to {b}. The bill arrives by mushroom. {b} owes the fairies a summer and has started saving.', souls: 19, rebound: true, report: 'The year was billed to {c}. Keep your summers close.' }
      ] },
      { label: 'Stay in and wait', how: 'by waiting it out', outcomes: [
        { tone: 'good', stamp: 'HOSTED', text: 'The fairies arrive for a dance and turn out to be terrible dancers. {a} teaches them a waltz. They leave a tip.', souls: 18, curio: true, report: '{f}’s resident taught the fairies to waltz and was tipped.' },
        { tone: 'weird', stamp: 'LOCAL', text: '{a} stays in the ring so long it gets the vote there. It is now on the parish council of a carpet and takes it extremely seriously.', souls: 16, fits: OFFICIAL, report: 'They stayed in the ring and joined its council. Meetings are Thursdays.' }
      ] }
    ] },
  { id: 'candle-that-wont', name: 'The Candle That Won’t', art: 'candle', blurb: 'Won’t light. Won’t go out. Won’t say why.',
    title: '{b} has given {a} a candle. It will not light. It will not go out either. It is just lit, a bit, in a sulk.',
    choices: [
      { label: 'Blow it out', how: 'by blowing it out', outcomes: [
        { tone: 'good', stamp: 'EXTINGUISHED', text: 'On the ninth breath it goes out, and says “fine” in a tone that means it is not. {a} has to have a lie down. Candles are exhausting.', souls: 15, report: 'They blew it out on the ninth breath. It said “fine”.' },
        { tone: 'weird', stamp: 'RELIT', text: 'It goes out, then relights at the exact moment anyone says {b}’s name. The shelf has stopped saying {b}’s name. This suits everybody.', souls: 18, rebound: true, report: 'It relights whenever anyone says {c}. They have stopped saying {c}.' }
      ] },
      { label: 'Talk it round', how: 'by talking the candle round', outcomes: [
        { tone: 'good', stamp: 'ALIGHT', text: 'It turns out the candle wanted to be asked. Once asked, it burns beautifully, all evening, and looks at {a} the way candles never look at anyone.', souls: 17, bond: 'a', report: 'The candle just wanted asking. It burns for them now.' },
        { tone: 'weird', stamp: 'VIGIL', text: 'The candle insists on a vigil. For whom it will not say. {a} sits up all night with it. In the morning there is a small wax statue of {b}, weeping.', souls: 19, curio: true, report: 'The candle held a vigil and made a small wax {c}. It is weeping.' }
      ] }
    ] },
  { id: 'letter-from-the-landlord', name: 'A Letter From the Landlord', art: 'ink', blurb: 'Forged. Beautifully.',
    title: '{b} has forged a letter from the landlord. It says {a}’s rent is going up by “one secret, payable monthly”.',
    choices: [
      { label: 'Pay the secret', how: 'by paying up', outcomes: [
        { tone: 'good', stamp: 'PAID', text: '{a} pays with a small secret: it has never once read the terms and conditions. The landlord, who is real, is so moved that the rent goes down.', souls: 17, report: 'They paid the secret. The real landlord lowered the rent. Well done, {c}.' },
        { tone: 'weird', stamp: 'ARREARS', text: '{a} pays with {b}’s secret instead. It is a big one. The landlord accepts it and asks if {b} has any more.', souls: 20, rebound: true, fits: NOSY, report: 'They paid the rent with one of {c}’s secrets.' }
      ] },
      { label: 'Contest it', how: 'by contesting the letter', outcomes: [
        { tone: 'good', stamp: 'DISMISSED', text: '{a} spots the forgery: the landlord always signs in blood, and this is jam. Raspberry. {b} has been given a stern talking to by the jam.', souls: 16, fits: OFFICIAL, report: 'The forgery was spotted. It was signed in jam. {c} has been spoken to.' },
        { tone: 'weird', stamp: 'TRIBUNAL', text: 'A tribunal sits. The landlord turns up, reads the letter and agrees with it. Nobody wins. The rent is now one secret and a biscuit.', souls: 18, report: 'The tribunal sided with the forgery. Rent is now a secret and a biscuit.' }
      ] }
    ] },
  { id: 'sulking-mirror', name: 'A Sulking Mirror', art: 'mirror', blurb: 'Reflects. Resents.',
    title: '{b} has hung a mirror opposite {a}. It reflects everything except {a}. It says it is “taking some time”.',
    choices: [
      { label: 'Apologise to it', how: 'by apologising to the mirror', outcomes: [
        { tone: 'good', stamp: 'RECONCILED', text: '{a} apologises without knowing what for. The mirror accepts. {a} reappears in it, with better posture than it has ever had in real life.', souls: 16, report: 'They apologised to the mirror. It shows them with better posture now.' },
        { tone: 'weird', stamp: 'TERMS', text: 'The mirror will reflect {a} again, but only on weekdays and only from the left. Weekends it reflects {b}, waving.', souls: 19, rebound: true, report: 'At weekends the mirror shows {c}, waving.' }
      ] },
      { label: 'Turn it to the wall', how: 'by turning it to the wall', outcomes: [
        { tone: 'good', stamp: 'FACING', text: 'Facing the wall, the mirror reflects the wall, which has never been looked at so carefully. The wall is overwhelmed. It is a nice moment for the wall.', souls: 14, report: 'The mirror faces the wall now. The wall is having a lovely time.' },
        { tone: 'weird', stamp: 'SPITE', text: 'From the wall, it starts reflecting the room next door. {a} now knows far too much about the woodlouse and his evenings.', souls: 18, curio: true, report: 'The mirror shows next door now. They know about the woodlouse.' }
      ] }
    ] },
  { id: 'cake-inscribed-sorry', name: 'A Cake Inscribed “Sorry”', art: 'cake', blurb: 'An apology, in icing, for something not yet done.',
    title: '{b} has sent {a} a cake that says “Sorry”. {b} has not done anything yet. The cake is a down payment.',
    choices: [
      { label: 'Eat it', how: 'by eating the cake', outcomes: [
        { tone: 'good', stamp: 'ACCEPTED', text: 'It is a very good cake. {a} accepts the apology in full and in advance. Whatever {b} does next is pre-forgiven, up to a reasonable limit.', souls: 17, a: { food: 25 }, report: 'They ate it. You are forgiven in advance, up to a reasonable limit.' },
        { tone: 'weird', stamp: 'LAYERED', text: 'Each layer apologises for something different and more specific. The bottom layer says “and the thing with the vicar”. {a} does not know about the vicar. It does now.', souls: 20, a: { food: 20 }, rebound: true, report: 'The cake confessed to the thing with the vicar.' }
      ] },
      { label: 'Keep it as evidence', how: 'by keeping it as evidence', outcomes: [
        { tone: 'good', stamp: 'EXHIBIT A', text: '{a} bags it and labels it. The case against {b} is now very strong and slightly sticky.', souls: 15, fits: OFFICIAL, report: 'The cake is Exhibit A. The case against {c} is strong and sticky.' },
        { tone: 'weird', stamp: 'STALE', text: 'The cake waits so long it becomes a fossil. A museum offers to buy it. {a} holds out for more money and a plaque with {b}’s name spelled wrong.', souls: 19, curio: true, fits: GREEDY, report: 'The cake is going to a museum. {c}’s name is spelled wrong on the plaque.' }
      ] }
    ] },
  { id: 'reserved-grave', name: 'A Reserved Grave', art: 'grave', blurb: 'Lovely spot. Someone else’s name on it.',
    title: '{b} has reserved {a} a grave. Nice view. Quiet neighbours. The headstone already says “{a}, eventually”.',
    choices: [
      { label: 'Cancel the booking', how: 'by cancelling the booking', outcomes: [
        { tone: 'good', stamp: 'CANCELLED', text: 'The cemetery refunds the deposit in worms. {a} invests them in the plant pot, where they are already doing better than most pensions.', souls: 16, report: 'They cancelled. The deposit came back in worms, which are thriving.' },
        { tone: 'weird', stamp: 'TRANSFERRED', text: 'The booking cannot be cancelled, only transferred. {a} transfers it to {b}. The headstone now says “{b}, sooner”.', souls: 19, rebound: true, report: 'The grave is booked in {c}’s name now. It says “sooner”.' }
      ] },
      { label: 'Go and see it', how: 'by going to see it', outcomes: [
        { tone: 'good', stamp: 'VIEWING', text: 'It really is a lovely spot. {a} has a picnic on it and meets the neighbours, who are mostly lying down and great listeners.', souls: 17, bond: 'a', fits: SPOOKY, report: 'They had a picnic on it. The neighbours were great listeners.' },
        { tone: 'weird', stamp: 'OCCUPIED', text: 'Someone is already in it, sitting up, reading. They booked it in 1890 and are not giving it up. They lend {a} a book on the way out.', souls: 18, curio: true, report: 'The grave was occupied since 1890. They lent them a book.' }
      ] }
    ] },
  { id: 'bone-to-pick', name: 'A Bone to Pick', art: 'bone', blurb: 'An actual bone. An actual grievance.',
    title: '{b} has turned up with a bone to pick with {a}. It is a literal bone. Nobody is sure whose. {b} is very upset about it.',
    choices: [
      { label: 'Pick the bone', how: 'by picking the bone', outcomes: [
        { tone: 'good', stamp: 'PICKED', text: 'They pick it clean between them in an afternoon of honest conversation. It turns out to be a chicken bone and a misunderstanding about a chair.', souls: 16, bond: 'a', report: 'The bone was picked. It was about a chair. {c} feels heard.' },
        { tone: 'weird', stamp: 'ASSEMBLED', text: 'There are more bones where that came from. By evening they have picked a whole skeleton, who thanks them and goes to the shops.', souls: 20, curio: true, rebound: true, report: 'They picked a whole skeleton, who went to the shops.' }
      ] },
      { label: 'Bury it', how: 'by burying the bone', outcomes: [
        { tone: 'good', stamp: 'LET GO', text: '{a} buries the bone and the grievance with it. {b} stands by the grave for a long time, then admits it cannot remember what it was angry about.', souls: 15, report: 'They buried the bone. {c} cannot remember what it was angry about.' },
        { tone: 'weird', stamp: 'DUG UP', text: 'Something digs the bone up within the hour and returns it with a note: “wrong garden”. The handwriting is a dog’s.', souls: 18, fits: ['feral', 'bitey', 'bones'], report: 'The bone was returned by something with a dog’s handwriting.' }
      ] }
    ] },
  { id: 'ear-at-the-wall', name: 'An Ear at the Wall', art: 'ear', blurb: 'Hears everything. Repeats it badly.',
    title: '{b} has left an ear on {a}’s wall, the listening sort. It has already heard something and is dying to tell someone.',
    choices: [
      { label: 'Whisper something false', how: 'by feeding it false rumours', outcomes: [
        { tone: 'good', stamp: 'PLANTED', text: '{a} whispers that it is secretly royal. By teatime the whole street curtseys. {a} has always known how to accept a curtsey.', souls: 17, fits: NOSY, report: 'They fed it a rumour. The whole street now believes they are royal.' },
        { tone: 'weird', stamp: 'ECHO', text: 'The ear repeats it all back to {b}, word for word, in {a}’s voice. {b} now believes {b} owes {a} a pony.', souls: 19, rebound: true, report: '{c} now believes it owes {f}’s resident a pony.' }
      ] },
      { label: 'Put a hat on it', how: 'by putting a hat on the ear', outcomes: [
        { tone: 'good', stamp: 'MUFFLED', text: 'A small knitted hat. The ear is warm and hears nothing and is, for the first time, at peace. It is a better life than eavesdropping.', souls: 15, a: { fuss: 15 }, report: 'The ear is wearing a hat and hears nothing. It seems happier.' },
        { tone: 'weird', stamp: 'FASHION', text: 'The hat starts a trend. Every wall on the street has a hatted ear by Friday. Nobody can hear anything. Property prices soar.', souls: 18, curio: true, report: 'The hatted ear started a trend. Nobody on the street can hear anything.' }
      ] }
    ] },
  { id: 'a-hand-that-waves', name: 'A Hand That Waves', art: 'hand', blurb: 'Friendly. Disembodied. Persistent.',
    title: '{b} has left a hand in {a}’s cupboard. It waves every time the door opens. It is very friendly. It is just a hand.',
    choices: [
      { label: 'Shake it', how: 'by shaking hands', outcomes: [
        { tone: 'good', stamp: 'ACQUAINTED', text: 'A firm, dry handshake. The hand clearly went to a good school. It lets go first, which {a} respects.', souls: 16, bond: 'a', report: 'They shook hands. It went to a good school, apparently.' },
        { tone: 'weird', stamp: 'HELD', text: 'The hand will not let go. {a} spends the day doing everything one handed and holding hands with a stranger. It is weirdly nice.', souls: 18, rebound: true, report: 'The hand would not let go. They have been holding hands all day.' }
      ] },
      { label: 'Give it a job', how: 'by giving the hand a job', outcomes: [
        { tone: 'good', stamp: 'EMPLOYED', text: 'It does the washing up, beautifully. {a} gives it Thursdays off. The hand has never been happier, and never been asked.', souls: 17, a: { clean: 20 }, report: 'They gave the hand a job. It does the washing up and has Thursdays off.' },
        { tone: 'weird', stamp: 'UNIONISED', text: 'The hand organises the gloves. There is a strike. {a} has to negotiate with eleven gloves and the hand, who speaks for them all.', souls: 19, curio: true, fits: OFFICIAL, report: 'The hand unionised the gloves. Negotiations continue.' }
      ] }
    ] },
  { id: 'unexpected-ring', name: 'An Unexpected Engagement Ring', art: 'ring', blurb: 'Says yes on your behalf.',
    title: '{b} has slipped a ring onto {a} while it slept. {a} appears to be engaged. To whom is unclear. The ring will not say.',
    choices: [
      { label: 'Call it off', how: 'by calling off the engagement', outcomes: [
        { tone: 'good', stamp: 'JILTED', text: 'The ring takes it well, all things considered. It keeps the deposit on the hall and goes travelling. It sends postcards. They are not unkind.', souls: 16, report: 'The engagement is off. The ring went travelling and sends postcards.' },
        { tone: 'weird', stamp: 'ANNULLED', text: 'It takes a priest, two lawyers and a crow to annul. The crow does the most work. The ring asks if {b} is single.', souls: 19, rebound: true, report: 'Annulled with the help of a crow. The ring asked if {c} is single.' }
      ] },
      { label: 'Plan the wedding', how: 'by planning the wedding', outcomes: [
        { tone: 'good', stamp: 'BETROTHED', text: 'Nobody is sure who {a} is marrying, but the cake is booked and the moths are bridesmaids. {a} is radiant. Sincerely.', souls: 18, a: { fuss: 20 }, fits: STAGEY, report: 'There will be a wedding. Nobody knows to whom. The moths are bridesmaids.' },
        { tone: 'weird', stamp: 'SPOKEN FOR', text: 'On the day, the groom turns out to be the ring. It is a short ceremony. {a} takes the ring’s name, which is “18 carat”.', souls: 20, curio: true, report: '{f}’s resident married the ring. It goes by 18 Carat now.' }
      ] }
    ] },
  { id: 'nail-that-wants-out', name: 'A Nail That Wants Out', art: 'nail', blurb: 'Loose. Restless. Heading somewhere.',
    title: '{b} has loosened a nail in {a}’s floorboard. The nail is now pushing up a little more every hour. It has places to be.',
    choices: [
      { label: 'Hammer it back', how: 'with a hammer', outcomes: [
        { tone: 'good', stamp: 'SECURED', text: 'Three good blows. The nail goes back with a grudging creak. The board underneath says thank you, quietly, in pine.', souls: 15, report: 'The nail was hammered home. The floorboard said thank you.' },
        { tone: 'weird', stamp: 'TUNNELLED', text: 'It goes down and keeps going. Later that day a nail comes up in {b}’s floor, out of breath, holding a small map.', souls: 19, rebound: true, report: 'The nail tunnelled through and came up in {c}’s floor.' }
      ] },
      { label: 'Let it go', how: 'by letting it go', outcomes: [
        { tone: 'good', stamp: 'FREE', text: 'The nail works itself loose, nods once, and rolls out under the door. {a} gets a postcard a week later from a fence in Norfolk. It sounds happy.', souls: 16, bond: 'a', report: 'They let the nail go. It writes from a fence in Norfolk.' },
        { tone: 'weird', stamp: 'EXODUS', text: 'The other nails see it leave and start packing. {a} spends the evening holding the shelf together by hand and willpower.', souls: 18, fits: ['loadbearing', 'steward'], report: 'All the nails left. {f}’s resident is holding the shelf up by hand.' }
      ] }
    ] },
  { id: 'brooch-for-the-living', name: 'A Mourning Brooch, Early', art: 'brooch', blurb: 'In loving memory. Of someone still here.',
    title: '{b} has sent {a} a mourning brooch with {a}’s own portrait in it. It is engraved “Gone but not yet”.',
    choices: [
      { label: 'Wear it with pride', how: 'by wearing it', outcomes: [
        { tone: 'good', stamp: 'BEREAVED', text: '{a} wears it to dinner and receives a great deal of sympathy for its own loss. It handles it with enormous dignity. It is thriving on grief.', souls: 17, a: { fuss: 20 }, fits: ['mourner', 'martyr', 'terminal'], report: 'They wear the brooch and are receiving condolences for themselves.' },
        { tone: 'weird', stamp: 'PREMONITION', text: 'The portrait inside starts to age instead of {a}. It is going grey at the temples. {a} has never looked better and is insufferable about it.', souls: 20, curio: true, report: 'The brooch ages instead of them. They have never looked better.' }
      ] },
      { label: 'Post it back', how: 'by posting it back', outcomes: [
        { tone: 'good', stamp: 'REDIRECTED', text: '{a} swaps the portrait for one of {b} and posts it back. “Gone but not yet” works just as well for {b}. Better, honestly.', souls: 16, rebound: true, report: 'The brooch came back with your {c}’s portrait in it.' },
        { tone: 'weird', stamp: 'LOST', text: 'The brooch goes missing in the post and turns up at a funeral in Cornwall. Everyone there is very moved by {a}, whom nobody knew.', souls: 18, report: 'The brooch was lost in the post and moved a funeral in Cornwall.' }
      ] }
    ] },
  { id: 'mouse-with-a-lease', name: 'A Mouse With a Lease', art: 'mouse', blurb: 'Ninety-nine years. Non-negotiable.',
    title: '{b} has sold {a}’s skirting board to a mouse. The mouse has a ninety-nine year lease and has started knocking through.',
    choices: [
      { label: 'Read the small print', how: 'by reading the small print', outcomes: [
        { tone: 'good', stamp: 'VOID', text: 'Clause eleven: the lease is void if the tenant is a mouse. The mouse is a mouse. It packs up without fuss and leaves a very small cheese as compensation.', souls: 16, fits: OFFICIAL, report: 'The lease was void. The mouse left a very small cheese.' },
        { tone: 'weird', stamp: 'SUBLET', text: 'Clause twelve allows the mouse to sublet. It sublets to {b}. {b} is moving in on Thursday with several boxes.', souls: 19, rebound: true, report: 'The mouse sublet the skirting to {c}, who moves in on Thursday.' }
      ] },
      { label: 'Welcome the neighbour', how: 'by welcoming the mouse', outcomes: [
        { tone: 'good', stamp: 'NEIGHBOURLY', text: '{a} brings round a crumb. The mouse brings round a smaller crumb. They exchange crumbs every evening now. It is the most civilised thing on the shelf.', souls: 17, a: { food: 20 }, report: 'They welcomed the mouse. There is a nightly exchange of crumbs.' },
        { tone: 'weird', stamp: 'EXTENSION', text: 'The mouse puts in for planning permission. It is granted. There is now a conservatory in the skirting board, with better light than the shelf.', souls: 18, curio: true, report: 'The mouse built a conservatory. It has better light than the shelf.' }
      ] }
    ] },
  { id: 'plant-that-glows', name: 'A Plant That Glows', art: 'glow', blurb: 'Low maintenance. High wattage.',
    title: '{b} has left {a} a houseplant. It glows. It glows more when {a} looks at it. It has started to buzz.',
    choices: [
      { label: 'Water it', how: 'by watering it', outcomes: [
        { tone: 'good', stamp: 'THRIVING', text: 'It loves the water and glows a soft green. {a} reads by it now. The shelf’s electricity bill has never been lower, or more radioactive.', souls: 17, report: 'They watered it. It is now their reading lamp.' },
        { tone: 'weird', stamp: 'BLOOMING', text: 'It flowers. Each flower is a tiny lit window with a tiny {b} in it, waving. {a} draws the curtains on the plant at night.', souls: 19, rebound: true, report: 'It flowered. Every flower has a tiny {c} in it, waving.' }
      ] },
      { label: 'Put it outside', how: 'by putting it outside', outcomes: [
        { tone: 'good', stamp: 'LANDMARK', text: 'Outside it lights the whole street. Taxis use it to find the house. {a} has started charging a small fee to look at it.', souls: 16, fits: GREEDY, report: 'It lights the street now. {f}’s resident charges a fee to look at it.' },
        { tone: 'weird', stamp: 'SIGNAL', text: 'Something up there sees it and signals back. {a} is now in correspondence with a light in the sky that is mostly interested in soup.', souls: 20, curio: true, report: 'It signalled the sky. Something up there writes back about soup.' }
      ] }
    ] },
  { id: 'chalk-outline', name: 'A Chalk Outline, Pre-Drawn', art: 'chalk', blurb: 'For later. Just in case.',
    title: '{b} has drawn a chalk outline on the shelf. It is {a}’s exact shape. {a} keeps lying down in it by accident.',
    choices: [
      { label: 'Wash it off', how: 'by scrubbing it off', outcomes: [
        { tone: 'good', stamp: 'SCRUBBED', text: 'It comes off with soap and spite. {a} feels oddly lighter. The shelf is cleaner than it has been since the incident with the soup.', souls: 15, a: { clean: 20 }, report: 'They scrubbed it off with soap and spite. The shelf is spotless.' },
        { tone: 'weird', stamp: 'REDRAWN', text: 'It redraws itself overnight, slightly bigger. Then bigger. {a} is now outlined to the scale of a small horse and is very proud.', souls: 18, rebound: true, report: 'The outline redrew itself to the size of a small horse.' }
      ] },
      { label: 'Lie in it', how: 'by lying in it', outcomes: [
        { tone: 'good', stamp: 'RESTED', text: 'It is very comfortable, like being expected. {a} naps in it every afternoon now. Detectives keep turning up, and it waves them off.', souls: 16, a: { fuss: 20 }, report: '{f}’s resident naps in it daily. Detectives keep arriving.' },
        { tone: 'weird', stamp: 'INVESTIGATED', text: 'A detective arrives, studies {a} lying in the outline, and arrests {b}, on instinct. {a} says nothing. {a} says nothing beautifully.', souls: 20, fits: ['witness', 'paranoid', 'litigious'], report: 'A detective arrested {c} on instinct. {f}’s resident said nothing.' }
      ] }
    ] },
  { id: 'gossiping-lamp', name: 'A Lamp That Gossips', art: 'lamp', blurb: 'Bright. Indiscreet.',
    title: '{b} has swapped {a}’s lamp for one that gossips. It already knows about the thing with the biscuit. It has told the kettle.',
    choices: [
      { label: 'Switch it off', how: 'by switching it off', outcomes: [
        { tone: 'good', stamp: 'OFF', text: 'In the dark it can only gossip about what it remembers, which is mostly lightbulbs. Nobody minds. Lightbulbs had it coming.', souls: 15, report: 'They switched it off. It only gossips about lightbulbs now.' },
        { tone: 'weird', stamp: 'LEAKED', text: 'It goes off, but the kettle has already told the toaster, who told {b}. {b} has made a poster about the biscuit.', souls: 18, rebound: true, report: 'The toaster told {c}, who made a poster about the biscuit.' }
      ] },
      { label: 'Tell it something back', how: 'by trading gossip', outcomes: [
        { tone: 'good', stamp: 'TRADED', text: '{a} gives the lamp something juicier about {b}. The lamp glows with delight. The biscuit is forgotten. {b} is not.', souls: 17, fits: NOSY, report: 'They traded gossip. The lamp now knows something juicy about {c}.' },
        { tone: 'weird', stamp: 'SOURCED', text: 'The lamp becomes {a}’s most trusted source. It has started a newsletter. Circulation: the kitchen. Readership: devoted.', souls: 19, curio: true, report: 'The lamp now writes a newsletter. The kitchen reads it devotedly.' }
      ] }
    ] },
  { id: 'borrowed-name', name: 'A Borrowed Name', art: 'ink', blurb: 'Taken for the afternoon. Returned stretched.',
    title: '{b} has borrowed {a}’s name for the afternoon. {a} is answering to “Hey” and not enjoying it.',
    choices: [
      { label: 'Demand it back', how: 'by demanding the name back', outcomes: [
        { tone: 'good', stamp: 'RESTORED', text: 'It comes back a bit stretched, with somebody else’s initials on it. {a} wears it in. In a week it fits again. Mostly.', souls: 16, report: 'They got the name back, stretched. It mostly fits.' },
        { tone: 'weird', stamp: 'SWAPPED', text: '{b} returns the wrong name. {a} is now called Barry. Everyone agrees Barry suits it. {a} hates that everyone agrees.', souls: 19, rebound: true, fits: ['fullname', 'narcissist', 'revisionist'], report: 'You sent back the wrong name. {f}’s resident is Barry now.' }
      ] },
      { label: 'Enjoy being anonymous', how: 'by enjoying the anonymity', outcomes: [
        { tone: 'good', stamp: 'INCOGNITO', text: 'Nameless, {a} does all sorts. It cuts in line at the bowl and nobody can tell on it. It is the best afternoon it has had in years.', souls: 17, a: { food: 20 }, report: 'They loved being nameless and cut in line all afternoon.' },
        { tone: 'weird', stamp: 'IDENTIFIED', text: 'By evening {a} has a new name it made up itself. It is very long and has a number in it. It is filing the paperwork now.', souls: 18, curio: true, report: 'They gave themselves a new name with a number in it. Paperwork is filed.' }
      ] }
    ] },
  { id: 'imaginary-friend', name: 'A Second-Hand Imaginary Friend', art: 'ghost', blurb: 'Previously imagined. Good condition.',
    title: '{b} has handed down an imaginary friend to {a}. It is used. It still asks after its last owner.',
    choices: [
      { label: 'Play along', how: 'by playing along', outcomes: [
        { tone: 'good', stamp: 'BEFRIENDED', text: '{a} and the friend get on brilliantly. It is invisible, agrees with everything and never needs feeding. It is the ideal resident and does not exist.', souls: 17, bond: 'a', report: 'They get on brilliantly with the imaginary friend. It never needs feeding.' },
        { tone: 'weird', stamp: 'CUSTODY', text: 'The friend goes back to {b} every other weekend. Handover is in a car park. Nobody can see who is being handed over.', souls: 19, rebound: true, report: 'Shared custody of the imaginary friend, every other weekend.' }
      ] },
      { label: 'Refuse to imagine it', how: 'by refusing to imagine it', outcomes: [
        { tone: 'good', stamp: 'UNIMAGINED', text: 'The friend fades out politely, leaving a smell of crayons. {a} feels a small, unreasonable pang. It writes a short poem about it and burns it.', souls: 15, report: 'They refused to imagine it. It faded politely. There was a poem.' },
        { tone: 'weird', stamp: 'PERSISTENT', text: 'It does not need {a} to imagine it. It has been imagined enough. It sits at the end of the shelf, solid, waiting for a lift home.', souls: 18, curio: true, report: 'The friend is still there, fully solid, waiting for a lift home.' }
      ] }
    ] }
];

/* Tricks from a friend’s doorstep in the Thin Season: the same shape, smaller.
   {b} is a resident of the shelf you knocked on, {a} one of yours. */
export const TRICK_DECK = [
  { id: 'trick-wet-apple', name: 'A Wet Apple', art: 'cake', blurb: 'Bobbed for. Resentful.',
    title: '{b} has answered the door with a wet apple. It was for bobbing. {a} is now expected to bob.',
    choices: [
      { label: 'Bob for it', how: 'by bobbing', outcomes: [
        { tone: 'good', stamp: 'BOBBED', text: '{a} gets the apple first time and comes up gasping and victorious. The apple has a bite out of it already. It was like that when it arrived.', souls: 12 },
        { tone: 'weird', stamp: 'SUBMERGED', text: '{a} goes in after it and does not come up for some time. When it does, it is holding a different apple and will not discuss the bucket.', souls: 13 }
      ] },
      { label: 'Decline the apple', how: 'by declining', outcomes: [
        { tone: 'good', stamp: 'DRY', text: '{a} declines. The apple is thrown anyway, gently, like a disappointed parent. {a} catches it. It is still wet. It will always be wet.', souls: 11 },
        { tone: 'weird', stamp: 'FOLLOWED', text: 'The apple follows {a} home and sits on the step. In the morning it is still there, wetter, waiting to be bobbed.', souls: 13 }
      ] }
    ] },
  { id: 'trick-toilet-roll', name: 'Toilet Roll, Applied', art: 'veil', blurb: 'Draped with intent.',
    title: '{a} came home from knocking to find the shelf wrapped in toilet roll. A note says “from {b}, with love, and two-ply”.',
    choices: [
      { label: 'Unwrap everything', how: 'by unwrapping', outcomes: [
        { tone: 'good', stamp: 'UNWRAPPED', text: 'It takes an hour. {a} finds three things it lost in March underneath, and a fourth thing that is not from this house at all.', souls: 12, curio: true },
        { tone: 'weird', stamp: 'MUMMIFIED', text: 'Halfway through, {a} gets wrapped too, and decides it suits it. It shuffles about with its arms out until bedtime, groaning at the lamp.', souls: 13 }
      ] },
      { label: 'Call it decor', how: 'by calling it decor', outcomes: [
        { tone: 'good', stamp: 'FESTIVE', text: 'It looks wonderful, honestly. Ghostly. The neighbours ask who the decorator is. {a} takes full credit.', souls: 11 },
        { tone: 'weird', stamp: 'SNOWED IN', text: 'It falls like snow over the evening. By morning the shelf is a winter scene, and the mice are skiing.', souls: 14 }
      ] }
    ] },
  { id: 'trick-egg', name: 'An Egg With Intent', art: 'skull', blurb: 'Free range. Aimed.',
    title: 'An egg has been thrown at {a}. It missed, then turned round and came back. {b} has excellent aim, or the egg does.',
    choices: [
      { label: 'Duck', how: 'by ducking', outcomes: [
        { tone: 'good', stamp: 'DUCKED', text: '{a} ducks. The egg hits the lamp and makes a small, perfect omelette on the warm bulb. Supper is served.', souls: 12, a: { food: 15 } },
        { tone: 'weird', stamp: 'HATCHED', text: '{a} ducks so well the egg gives up and hatches out of embarrassment. There is a chick now. It has {b}’s eyes.', souls: 14 }
      ] },
      { label: 'Catch it', how: 'by catching it', outcomes: [
        { tone: 'good', stamp: 'CAUGHT', text: 'A clean catch. Not a crack. The egg seems almost proud of {a} and asks to be thrown again. It will be disappointed.', souls: 12 },
        { tone: 'weird', stamp: 'ADOPTED', text: '{a} catches it and cannot bring itself to throw it back. The egg sits in a teacup now, warm, wearing a tiny hat. It has a name. It is Clive.', souls: 13 }
      ] }
    ] },
  { id: 'trick-mask', name: 'A Mask That Fits Too Well', art: 'head', blurb: 'One size fits one.',
    title: '{b} has given {a} a mask for the evening. It fits perfectly. It is now proving difficult to take off.',
    choices: [
      { label: 'Pull it off', how: 'by pulling', outcomes: [
        { tone: 'good', stamp: 'UNMASKED', text: 'It comes off with a sound like a boot leaving mud. Underneath, {a} is exactly the same, which is a relief to everyone but {a}.', souls: 12 },
        { tone: 'weird', stamp: 'DOUBLE', text: 'Under the mask is another mask. Under that, {a}, looking smug. Nobody knows how long that has been going on.', souls: 14 }
      ] },
      { label: 'Keep it on', how: 'by keeping it on', outcomes: [
        { tone: 'good', stamp: 'IN CHARACTER', text: '{a} wears it all evening and becomes very convincing as a pumpkin. Too convincing. Someone tries to put a candle in it.', souls: 12, fits: STAGEY },
        { tone: 'weird', stamp: 'NEW FACE', text: 'By midnight the mask has grown on {a}. The shelf has voted to keep it. {a} abstained, with its new face.', souls: 13 }
      ] }
    ] },
  { id: 'trick-fun-size', name: 'The Fun-Size Lie', art: 'jar', blurb: 'There is nothing fun about the size.',
    title: '{b} gave {a} a fun-size bar. It is the size of a stamp. {a} has never been less entertained.',
    choices: [
      { label: 'Eat it anyway', how: 'by eating it', outcomes: [
        { tone: 'good', stamp: 'SAVOURED', text: '{a} makes it last forty minutes, in very small bites, with its eyes shut. It is the most profound meal of its life.', souls: 12, a: { food: 10 } },
        { tone: 'weird', stamp: 'EMPTY', text: 'Inside the wrapper is a smaller wrapper, and inside that, a note: “trick”. {a} frames the note.', souls: 13 }
      ] },
      { label: 'File a complaint', how: 'by complaining', outcomes: [
        { tone: 'good', stamp: 'UPHELD', text: 'The complaint is upheld by the manufacturer, who sends a full-size bar and an apology. {a} eats the apology first.', souls: 12, fits: OFFICIAL },
        { tone: 'weird', stamp: 'ESCALATED', text: 'The complaint goes to the sweet shop, then the council, then the moon. The moon agrees: there is nothing fun about the size.', souls: 14 }
      ] }
    ] },
  { id: 'trick-doorbell', name: 'A Doorbell That Follows You', art: 'clock', blurb: 'Ding. Dong. Everywhere.',
    title: 'The doorbell from {b}’s shelf followed {a} home. It rings whenever {a} sits down.',
    choices: [
      { label: 'Answer it', how: 'by answering', outcomes: [
        { tone: 'good', stamp: 'NOBODY', text: 'Nobody is there each time, but the nobody is very polite. By the tenth ring {a} has made it a cup of tea.', souls: 12 },
        { tone: 'weird', stamp: 'SOMEBODY', text: 'On the eleventh ring there is somebody. It is {b}, also holding a doorbell. They stare at each other and agree not to talk about it.', souls: 14 }
      ] },
      { label: 'Stand up for ever', how: 'by never sitting down', outcomes: [
        { tone: 'good', stamp: 'UPRIGHT', text: '{a} stays standing all evening. Its posture has never been better. The doorbell gets bored and goes home in a huff.', souls: 11 },
        { tone: 'weird', stamp: 'TUNED', text: 'With nothing else to do the doorbell learns a song. It plays it beautifully at midnight. It is the theme from a programme nobody remembers.', souls: 13 }
      ] }
    ] },
  { id: 'trick-pumpkin', name: 'A Pumpkin Grudge', art: 'head', blurb: 'Carved. Holding it.',
    title: '{b} has carved a pumpkin to look like {a}. It is not flattering. It is on the windowsill, glowing, holding a grudge.',
    choices: [
      { label: 'Carve one back', how: 'by carving one back', outcomes: [
        { tone: 'good', stamp: 'LIKENESS', text: '{a}’s pumpkin of {b} is a masterpiece. People queue to see it. One woman cries. The pumpkin of {a} has gone very quiet.', souls: 13 },
        { tone: 'weird', stamp: 'STANDOFF', text: 'The two pumpkins face each other across the street all night. By morning they have made up and are sharing a candle.', souls: 12 }
      ] },
      { label: 'Admire it', how: 'by admiring it', outcomes: [
        { tone: 'good', stamp: 'GRACIOUS', text: '{a} says it is a very good likeness. The pumpkin, disarmed, softens. It is a softer pumpkin now. Everyone gets soup.', souls: 12, a: { food: 10 } },
        { tone: 'weird', stamp: 'SITTING', text: '{a} sits for a second carving, to help. It takes all night. The pumpkin insists {a} hold very still and think about what it has done.', souls: 14 }
      ] }
    ] },
  { id: 'trick-sheet', name: 'The Sheet With Someone In It', art: 'ghost', blurb: 'It is a costume. Probably.',
    title: 'A figure in a sheet followed {a} home from {b}’s door. It says it is a costume. The sheet has no feet under it.',
    choices: [
      { label: 'Lift the sheet', how: 'by lifting the sheet', outcomes: [
        { tone: 'good', stamp: 'REVEALED', text: 'Under the sheet is a smaller sheet. Under that, a very embarrassed moth. It was trying something new. {a} says it looks great.', souls: 12 },
        { tone: 'weird', stamp: 'EMPTY', text: 'There is nothing under the sheet at all. The sheet seems relieved someone finally checked, and folds itself away for next year.', souls: 14 }
      ] },
      { label: 'Give it sweets', how: 'by giving it sweets', outcomes: [
        { tone: 'good', stamp: 'TREATED', text: 'The sheet takes a sweet and posts it through one eyehole. Something inside says thank you in a voice like a radiator.', souls: 12 },
        { tone: 'weird', stamp: 'REGULAR', text: 'It comes back every night for a sweet. It is always very polite. {a} has started leaving the porch light on for it.', souls: 13 }
      ] }
    ] },
  { id: 'trick-candy-corn', name: 'Candy Corn, Unrequested', art: 'tooth', blurb: 'Nobody has ever wanted this.',
    title: '{b} gave {a} a whole bag of candy corn. {a} did not ask. Nobody has ever asked.',
    choices: [
      { label: 'Eat one', how: 'by eating one', outcomes: [
        { tone: 'good', stamp: 'TOLERATED', text: '{a} eats one and says “it is fine”. It is fine. That is the whole problem with candy corn.', souls: 11 },
        { tone: 'weird', stamp: 'CONVERTED', text: 'After the ninth, {a} understands candy corn. It cannot explain. It has a look in its eye now that the others do not like.', souls: 13, a: { food: 10 } }
      ] },
      { label: 'Regift it', how: 'by regifting it', outcomes: [
        { tone: 'good', stamp: 'PASSED ON', text: 'The bag goes to the woodlouse, who has been waiting his whole life for someone to give him candy corn. He weeps. It is a lot for a Tuesday.', souls: 13 },
        { tone: 'weird', stamp: 'BOOMERANG', text: 'The bag comes back the next night with a different bow on it. It has been round the whole street. Nobody kept it.', souls: 12 }
      ] }
    ] },
  { id: 'trick-heavy-bag', name: 'A Bag Heavier Than It Should Be', art: 'box', blurb: 'Sweets. Mostly.',
    title: '{a}’s sweet bag is heavier after {b}’s door. Something in it has been added. It is moving.',
    choices: [
      { label: 'Look inside', how: 'by looking inside', outcomes: [
        { tone: 'good', stamp: 'GIFTED', text: 'It is a small pumpkin with legs, very shy. It was hoping to be taken somewhere nice. {a} gives it a corner of the shelf.', souls: 13, curio: true },
        { tone: 'weird', stamp: 'RETURNED', text: 'It is a brick, wrapped, with a label: “for later”. {a} keeps it on the shelf in case later comes.', souls: 12 }
      ] },
      { label: 'Shake it', how: 'by shaking it', outcomes: [
        { tone: 'good', stamp: 'SETTLED', text: 'Something inside says “all right, all right” and settles down. The bag is light again. Nobody looks inside. Some things are not for knowing.', souls: 12 },
        { tone: 'weird', stamp: 'RATTLED', text: 'It rattles back, in rhythm. {a} shakes again. It is a conversation now. They are getting on well. It may be a tambourine.', souls: 13 }
      ] }
    ] }
];

export const HEX_BY_ID = Object.fromEntries(HEX_DECK.map(h => [h.id, h]));
export const TRICK_BY_ID = Object.fromEntries(TRICK_DECK.map(h => [h.id, h]));
export const HEX_IDS = HEX_DECK.map(h => h.id);
export const TRICK_IDS = TRICK_DECK.map(h => h.id);

/* What the sender reads when a hex did not get played. {f} the victim’s player,
   {c} the culprit, {hex} the card name. */
export const HEX_DECLINED_LINES = [
  '{f} returned your {hex} unopened. {c} came home looking relieved.',
  '{f} sent your {hex} back with a note that just says “no”. {c} has framed it.',
  '{f} declined your {hex}. It was handed back at the door, at arm’s length, with tongs.',
  'Your {hex} was returned to sender. {c} was returned with it, slightly tidier than before.',
  '{f} did not want your {hex}. It is back on your step, sulking, and {c} is sitting on it.',
  '{f} returned your {hex}. Postage was paid in full, which is somehow more insulting.'
];
export const HEX_EXPIRED_LINES = [
  'Your {hex} sat on {f}’s shelf for two days and nobody touched it. {c} has come home, unacknowledged.',
  'Your {hex} dried out on {f}’s shelf. {c} waited the full two days, then walked home in the rain.',
  'Nobody dealt with your {hex}. After two days it gave up and left. {c} says it was “nice to get out”.',
  '{f} never opened your {hex}. It expired quietly. {c} is telling everyone it was a success.',
  'Your {hex} went stale on {f}’s shelf. {c} has eaten the evidence.',
  'Two days and no reply. Your {hex} has come home with {c}, who is pretending not to mind.'
];
export const REBOUND_LINE = 'It rebounded: {f} may send one back, free.';

/* ---------------- hauntings ---------------- */

/* What a ghost says while it drifts about a friend’s shelf. {g} is the ghost,
   {r} one of the haunted shelf’s residents, {f} the friend who sent it. */
export const HAUNT_LINES = [
  'I used to live on a shelf like this. Nicer, though.',
  'Don’t mind me. I’m just passing through. Slowly. All day.',
  '{r} has been looking at me. I have decided to allow it.',
  'Is that the good lamp? On {f}’s shelf we have the good lamp.',
  'I could rattle a chain, but frankly I’m above it.',
  'Your bowl is three centimetres too far left. I will be thinking about it for eternity.',
  'Boo. Sorry. I had to. It is in the contract.',
  'This is a nice shelf. Shame about the residents. Not you, {r}. Well, a bit you.',
  'I have haunted better. I have also haunted a bus shelter, so.',
  'When I was alive I was very popular. When I was alive I was also a sock drawer.',
  '{f} says hello. {f} also says you look tired.',
  'I’m not here to frighten anyone. I’m here to judge your skirting boards.',
  'Do you get much post? I get none. I am dead. Still, it would be nice.',
  'I can go through walls, but I prefer to be asked in.',
  'Every time {r} turns round I move one inch. It is the most fun I have had in years.',
  'I have chosen this corner. It is mine now. I will be leaving tomorrow, but it is mine.',
  'I once haunted a man for three years over a borrowed pen. I still have the pen.',
  'Is anyone going to offer me a biscuit? I can’t eat it. It’s about being offered.',
  'You’ve moved the furniture. I preferred it before I was here.',
  'This is your shelf? Interesting. Interesting choice.',
  '{r}, I know what you did. I don’t, actually. But your face says I should.',
  'Ooooooo. That’s it. That’s the whole act.',
  'The light here is very flattering. To the living.',
  'I’d tell you a secret, but I’d have to haunt you. Oh.',
  'If you need me I’ll be hovering near the bread. Not for any reason.',
  'It is very draughty in here, says the ghost, who is the draught.',
  'I don’t do chains any more. I do a scarf. It’s more me.',
  'I have been dead for a long time and I still think your curtains are a mistake.',
  'Nobody has screamed yet. I am trying not to take it personally.',
  'Back home on {f}’s shelf, I have a whole drawer to myself. Just saying.',
  'Shoo me if you like. I bruise like a peach, emotionally.',
  'One day you will be a ghost too, {r}. I will be there. I will be early.',
  'I came for the haunting. I stayed because nobody has told me where the door is.',
  'If I rattle the teaspoons, it means I am happy. If I rattle the knives, also happy.',
  'Tell {f} I behaved. Tell {f} I was terrifying. Both. Tell {f} both.',
  'I am semi-transparent. So are your excuses, {r}.'
];
export const SHOO_WIN_LINES = [
  '{g}’s ghost leaves through the wall it came in by, muttering about the welcome.',
  'Shooed. {g}’s ghost goes home to {f}’s shelf to tell everyone it was not frightened.',
  '{g}’s ghost leaves in a huff and a small cold breeze. It takes the draught with it.',
  'Off it goes. {g}’s ghost says it was leaving anyway, and that it hated your lamp.',
  '{g}’s ghost is shooed, but leaves a single cold handprint on the window. A signature.',
  'Gone. The shelf is warmer by a full degree. {g}’s ghost will be telling {f} it won.',
  '{g}’s ghost flees, then comes back for its scarf, then flees again, with dignity.',
  'Shooed in record time. {g}’s ghost will need a lie down. It is already lying down. It is dead.'
];
export const SHOO_MISS_LINES = [
  '{g}’s ghost was too quick. It is doing a little victory float.',
  'Missed. {g}’s ghost says “ooooo” in a way that is clearly sarcastic.',
  '{g}’s ghost dodged everything and is now pretending to be a curtain.',
  'Not quick enough. {g}’s ghost has settled back in and is judging the skirting.',
  '{g}’s ghost is still here and looks pleased with itself. Try again when it is less smug.',
  'It slipped away. {g}’s ghost says it has all day. It does. It literally does.'
];
// The sender hears how the haunting ended. {f} the haunted friend, {g} the ghost.
export const HAUNT_SHOOED_LINES = [
  '{f} shooed {g}’s ghost off their shelf in {taps} taps. It came home sulking and has gone to sit in the wardrobe.',
  '{g}’s ghost was shooed by {f} after {taps} taps. It says it let them win.',
  '{f} chased {g}’s ghost off in {taps} taps. It came home colder than usual and will not discuss it.',
  'Haunting over: {f} shooed {g}’s ghost in {taps} taps. It left a handprint on the way out, out of principle.'
];
export const HAUNT_ENDED_LINES = [
  '{g}’s ghost haunted {f} for a full day. {f} did not shoo it. Either they are very brave or they did not open the app.',
  '{g}’s ghost did a whole day on {f}’s shelf and came home unchallenged. It is unbearable about it.',
  'A full day of haunting at {f}’s and not one shoo. {g}’s ghost thinks they have grown close.',
  '{g}’s ghost is home after a day at {f}’s. It says nobody screamed. It is trying not to take it personally.'
];
export const HAUNT_CARD = { name: 'The Haunting', art: 'ghost', blurb: 'One of your ghosts drifts about their shelf for a day. They can shoo it for souls. One a week.' };

/* ---------------- neighbourly help ---------------- */
export const HELP_NEEDS = ['food', 'fuss', 'clean'];
export const HELP_VERBS = { food: 'fed', fuss: 'fussed over', clean: 'washed' };
export const HELP_BUTTONS = { food: 'Feed', fuss: 'Fuss', clean: 'Wash' };
// After the plain line, on the corkboard note. {a} the resident, {f} the helper.
export const HELP_NOTE_TAILS = [
  '{a} has told everyone it was you.',
  '{a} is pretending it was a dream.',
  '{a} has written {f} a thank you note and then eaten it.',
  'It was, by all accounts, competent.',
  '{a} would like it known that it could have managed.',
  '{f} left the bowl a little to the left. {a} has noticed.',
  'Nobody else on the shelf was offered anything. Nobody else has forgotten.',
  '{a} has asked whether {f} can come every day. You are on thin ice.'
];
// What the helper reads afterwards. {a} the resident, {f} the shelf’s owner.
export const HELP_DONE_LINES = {
  food: [
    'You fed {a}. {f} will find out. {a} has already decided to say it was a stranger.',
    'You fed {a}, who ate like it had not been fed since the Coronation.',
    '{a} has been fed. It thanked you with a look. The look was “more”.',
    'You fed {a}. It hid half of it for later, in a place you will not want to know about.'
  ],
  fuss: [
    'You fussed over {a}. It pretended not to like it for nearly a whole second.',
    '{a} has been fussed over and is now insufferable. {f} will notice.',
    'You fussed {a}. It leaned in. It will deny leaning in.',
    'You gave {a} some attention. It has gone very quiet and very pleased.'
  ],
  clean: [
    'You washed {a}. The water went a colour water should not go.',
    '{a} is clean. It is furious about it, cleanly.',
    'You washed {a}, who is now shinier than anything on {f}’s shelf and knows it.',
    'You gave {a} a wash. It came out a slightly different shape. That is probably fine.'
  ]
};
export const HELP_NOTHING_LINES = [
  'Nobody here needs anything. Their shelf is spotless, which is suspicious.',
  'Everyone on this shelf is fed, fussed and clean. Somebody is showing off.',
  'Nothing to do. You could straighten a picture, but you would be judged.'
];

/* ---------------- trick-or-treat ---------------- */
// What a door owner leaves out. The server keeps the same ids and odds in
// private.bowl_odds(); test/mischief_content.test.mjs checks they agree.
export const BOWLS = [
  { id: 'none', name: 'Porch light off', line: 'No bowl. You are pretending to be out. The street will judge.', treat: 50, curio: 15, lo: 6, hi: 10 },
  { id: 'full-size', name: 'Full-size bars', line: 'Like a lunatic. Knockers will talk about this house for years.', treat: 85, curio: 20, lo: 14, hi: 22 },
  { id: 'fun-size', name: 'Fun-size, as the law intends', line: 'Fair. Forgettable. Nobody has ever thanked anyone for a fun-size.', treat: 70, curio: 15, lo: 8, hi: 14 },
  { id: 'raisins', name: 'Raisins, loose', line: 'A bold statement. Expect eggs.', treat: 35, curio: 10, lo: 6, hi: 10 },
  { id: 'apples', name: 'Apples, suspiciously heavy', line: 'Something might be inside one. Knockers love a gamble.', treat: 55, curio: 45, lo: 8, hi: 14 },
  { id: 'toothbrushes', name: 'Toothbrushes, individually wrapped', line: 'Responsible. Unforgivable.', treat: 30, curio: 5, lo: 8, hi: 12 },
  { id: 'pennies', name: 'Pennies from 1911, still warm', line: 'Nobody knows where you got them. Nobody asks. They take them.', treat: 65, curio: 30, lo: 10, hi: 18 },
  { id: 'empty-note', name: 'An empty bowl and a note', line: 'The note says “take one”. There is nothing to take. It is art.', treat: 20, curio: 25, lo: 6, hi: 10 }
];
export const BOWL_BY_ID = Object.fromEntries(BOWLS.map(b => [b.id, b]));

// The doorstep, as its owner reads it. {n} is the number in words.
export const DOORSTEP_LINES = {
  none: [
    'No knocks yet tonight. The street is saving you for last.',
    'Not one knock. Either they are scared of you, or of your bowl.',
    'Silence on the step. Somewhere, children are deciding.'
  ],
  one: [
    'One knock tonight. You did not answer. They left a note: “we saw the curtain move”.',
    'One knock. Nobody answered. The knocker is telling everyone the house is haunted. It is.',
    'A single knock. You let it ring. Your reputation on the street is excellent.'
  ],
  some: [
    '{n} knocks tonight. You answered none. Your reputation on the street is perfect.',
    '{n} knocks tonight. The bowl answered for you. It was not polite.',
    '{n} knocks. You hid behind the sofa for each one. The sofa is getting a reputation too.'
  ],
  many: [
    '{n} knocks tonight. You are the house everyone talks about. They talk quietly.',
    '{n} knocks. The step has worn a little. The street has worn a lot.',
    '{n} knocks tonight. The knocker is hanging off its hinge. It has seen things.'
  ]
};
export const KNOCK_TREAT_LINES = [
  'Treat. {f}’s bowl gave up {s} souls’ worth of something sweet. You will not say what.',
  'A treat. {f} was not in, but the bowl was generous: {s} souls.',
  'Treat. Something in a wrapper, worth {s} souls, and not entirely a sweet.',
  'Treat. You took one. You took one more. {s} souls, and nobody saw.',
  'The door opened a crack and a hand gave you {s} souls’ worth of treat. The hand was not {f}’s.',
  'Treat. {f}’s step pays {s} souls. The street is right about this house.'
];
export const KNOCK_CURIO_LINES = [
  'Treat, and something else in the bowl: a curio for the cabinet. {f} will not miss it. {f} will.',
  'Treat. At the bottom of {f}’s bowl was something seasonal. It is yours now. It always wanted to be.',
  'A treat, and under it, a curio. It was hiding. It has stopped hiding.'
];
export const KNOCK_TRICK_LINES = [
  'Trick. Something from {f}’s step followed you home. It is in your emergency tray.',
  'Trick. The door did not open, but something came out anyway. Check your emergency tray.',
  'Trick. You knew it would be. It is waiting on your shelf.',
  'Trick. {f}’s house has a sense of humour, and it has your address.'
];
export const KNOCK_TRICK_FULL = 'Trick, but your tray is already full of hexes. The trick says it will wait. It is a very patient trick.';
export const NUMBER_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];

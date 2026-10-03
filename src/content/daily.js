/* ================= THE DAILY CHALLENGE =================
   One arcade game a day wears a modifier. Everyone who plays on the same date
   gets the same one, so scores on the day mean something. Each game has twelve,
   so the whole set takes 48 days to come round (Shelf Court's docket turns over
   every 24, so the two never line up the same way twice in a row).

   The keys are read by the simulations in engine/arcade.js; a missing key
   means "no change". Ids are lower case letters, digits and hyphens, at most
   24 characters, because the server stores them next to the score.

   Feeding Frenzy: spawn, bad, speed, fall, drift, scoreMult, weights, mirror,
     lives, reach, comboStep.
   Coffin Stack: width, speed, ease, fuse, perfectPay, regrow, perfect, shrink,
     flip, alt, cutCost.
   The Séance: start, beat, reverse, lives, grow, breath, rhythmPay, scoreMult,
     dup.
   Grave Whack: mourner, life, gold, glove, burst, landlord, lives, scoreMult,
     blocked, comboStep, hop, spawn. */

export const DAILY_GAME_ORDER = ['frenzy', 'stack', 'seance', 'whack'];

export const DAILY_MODS = {
  frenzy: [
    { id: 'storm', title: 'Snack storm', line: 'It is raining snacks. It is also raining other things.', spawn: 0.7 },
    { id: 'holy-week', title: 'Holy week', line: 'Twice the holy water. Nobody asked the water.', bad: 2 },
    { id: 'slippery', title: 'Slippery floor', line: 'Someone has soaped the catcher’s feet.', speed: 0.7 },
    { id: 'gravity-sale', title: 'Gravity sale', line: 'Everything falls faster. Gravity has overbought.', fall: 1.35 },
    { id: 'draughty', title: 'Draughty larder', line: 'A window is open and nobody will say which.', drift: 0.22 },
    { id: 'rationing', title: 'Rationing', line: 'Everything is worth double. There is much less of it.', scoreMult: 2, spawn: 1.45 },
    { id: 'dentist', title: 'Dentist’s day', line: 'Nearly all teeth. Nobody is asking where from.', weights: { tooth: 4, crumb: 0.4, raisin: 0.5 } },
    { id: 'funhouse', title: 'Funhouse floor', line: 'Left is right. The floor will not explain itself.', mirror: true },
    { id: 'sudden-death', title: 'Sudden death', line: 'One skull. Everything doubled. Think of the pay.', lives: 1, scoreMult: 2 },
    { id: 'open-heart', title: 'Open heart', line: 'Hearts everywhere. So is the holy water.', weights: { heart: 6 }, bad: 1.3 },
    { id: 'open-wide', title: 'Open wide', line: 'A mouth the size of a door, and the snacks know it.', reach: 1.5, fall: 1.25 },
    { id: 'hot-streak', title: 'Hot streak', line: 'Combos climb twice as fast. So does everything else.', comboStep: 3, bad: 1.25 }
  ],
  stack: [
    { id: 'slim', title: 'Slim coffins', line: 'Budget coffins. Nobody is comfortable.', width: 0.72 },
    { id: 'rush', title: 'Rush order', line: 'The undertaker is behind schedule and shouting.', speed: 1.3 },
    { id: 'wobble', title: 'Loose planks', line: 'Everything moves a little quicker and a little narrower.', speed: 1.15, width: 0.85 },
    { id: 'pendulum', title: 'Pendulum', line: 'It dawdles at the walls and bolts through the middle.', ease: true },
    { id: 'impatient', title: 'Impatient undertaker', line: 'He drops it for you after two and a half seconds.', fuse: 2.5 },
    { id: 'greedy', title: 'Greedy undertaker', line: 'Perfect drops pay double. Nothing grows back. He keeps the difference.', perfectPay: 2, regrow: 0 },
    { id: 'family-plot', title: 'Family plot', line: 'Big coffins, quick hands. Several relatives per box.', width: 1.3, speed: 1.35 },
    { id: 'needles-eye', title: 'Needle’s eye', line: 'Perfect drops are twice as hard and pay triple.', perfect: 0.5, perfectPay: 3 },
    { id: 'rising-damp', title: 'Rising damp', line: 'Every coffin comes out a little smaller. Something is wrong with the wood.', shrink: 0.012 },
    { id: 'two-way', title: 'Two-way traffic', line: 'The coffin keeps changing its mind about direction.', flip: 0.5 },
    { id: 'night-shift', title: 'Night shift', line: 'Slow, fast, slow, fast. The foreman is on a different clock.', alt: 0.55 },
    { id: 'strict', title: 'Strict inspector', line: 'Any overhang costs you the point. He has a clipboard.', cutCost: 1 }
  ],
  seance: [
    { id: 'chatty', title: 'A chatty spirit', line: 'It opens with five candles. It has a lot to say.', start: 5 },
    { id: 'short-wicks', title: 'Short wicks', line: 'The candles burn out quickly. The dead are impatient.', beat: 0.75 },
    { id: 'backwards', title: 'Backwards séance', line: 'The dead speak in reverse. Repeat it from the end.', reverse: true },
    { id: 'bad-mood', title: 'A bad mood', line: 'No forgiveness tonight. Something upstairs is sulking.', lives: 1 },
    { id: 'generous', title: 'Generous medium', line: 'Three mistakes forgiven, but the candles are quick.', lives: 3, beat: 0.8 },
    { id: 'long-sentences', title: 'Long sentences', line: 'Two new candles each round. The spirits do not edit.', grow: 2 },
    { id: 'breathless', title: 'Breathless', line: 'No pauses at all. Nobody told them to breathe.', breath: 0, beat: 0.7 },
    { id: 'syncopated', title: 'Syncopated spirit', line: 'It pauses for effect. Keep the rhythm for double bonus.', breath: 0.6, rhythmPay: 2 },
    { id: 'long-memory', title: 'Long memory', line: 'Six candles to open, said slowly. It has been saving this up.', start: 6, beat: 1.15 },
    { id: 'slow-dance', title: 'Slow dance', line: 'Slow, with plenty of pauses. Everyone present is in no hurry.', beat: 1.3, breath: 0.5 },
    { id: 'all-or-nothing', title: 'All or nothing', line: 'One life, double score, and the candles know it.', lives: 1, scoreMult: 2 },
    { id: 'double-vision', title: 'Double vision', line: 'Every candle is said twice. The spirits are not sure they were heard.', dup: true }
  ],
  whack: [
    { id: 'funeral', title: 'Funeral crowd', line: 'The mourners have arrived in force. Do not tap the widow.', mourner: 2 },
    { id: 'restless', title: 'Restless dead', line: 'They climb out faster and give up sooner.', life: 0.75 },
    { id: 'gold-fever', title: 'Gold fever', line: 'The gold-toothed dead are out in numbers. They know their worth.', gold: 6 },
    { id: 'glove-day', title: 'Glove day', line: 'Much of what comes up is a stuffed glove. It is almost convincing.', glove: 5 },
    { id: 'overcrowding', title: 'Overcrowding', line: 'Two at a time. The cemetery is not designed for this.', burst: 2 },
    { id: 'rent-day', title: 'Rent day', line: 'The landlord is everywhere. He wants what he is owed, in person.', landlord: 4 },
    { id: 'one-strike', title: 'One strike', line: 'One life, double points, and no appeal.', lives: 1, scoreMult: 2 },
    { id: 'flooded', title: 'Flooded corners', line: 'The corner plots are underwater. The dead are using the middle.', blocked: [0, 2, 6, 8] },
    { id: 'hot-streak', title: 'Hot streak', line: 'Combos climb twice as fast, until you tap an empty grave.', comboStep: 4 },
    { id: 'shifty', title: 'Shifty dead', line: 'Be slow and they move to another grave. They have done this before.', hop: true },
    { id: 'lazy-dead', title: 'Lazy dead', line: 'They stay up longer, but there are more of them.', life: 1.6, spawn: 0.7 },
    { id: 'masquerade', title: 'Masquerade', line: 'Everyone is wearing a veil or a glove. Tap with care.', glove: 3, mourner: 1.5 }
  ]
};

// Souls for the first scoring run of the challenge each day, plus a little for each night in a row.
export const DAILY_SOULS = 25;
export const DAILY_STREAK_SOULS = 5;
export const DAILY_STREAK_CAP = 4;

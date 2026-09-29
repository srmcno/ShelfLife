/* ================= THE DAILY CHALLENGE =================
   One arcade game a day wears a modifier. Everyone who plays on the same date
   gets the same one, so scores on the day mean something. Numbers are
   multipliers on the normal game; a missing key means "no change". */

export const DAILY_GAME_ORDER = ['frenzy', 'stack', 'seance', 'whack'];

export const DAILY_MODS = {
  frenzy: [
    { id: 'storm', title: 'Snack storm', line: 'It is raining snacks. It is also raining other things.', spawn: 0.7 },
    { id: 'holy-week', title: 'Holy week', line: 'Twice the holy water. Nobody asked the water.', bad: 2 },
    { id: 'slippery', title: 'Slippery floor', line: 'Someone has soaped the catcher’s feet.', speed: 0.7 }
  ],
  stack: [
    { id: 'slim', title: 'Slim coffins', line: 'Budget coffins. Nobody is comfortable.', width: 0.72 },
    { id: 'rush', title: 'Rush order', line: 'The undertaker is behind schedule and shouting.', speed: 1.3 },
    { id: 'wobble', title: 'Loose planks', line: 'Everything moves a little quicker and a little narrower.', speed: 1.15, width: 0.85 }
  ],
  seance: [
    { id: 'chatty', title: 'A chatty spirit', line: 'It opens with three candles. It has a lot to say.', start: 3 },
    { id: 'short-wicks', title: 'Short wicks', line: 'The candles burn out quickly. The dead are impatient.', beat: 0.75 }
  ],
  whack: [
    { id: 'funeral', title: 'Funeral crowd', line: 'The mourners have arrived in force. Do not tap the widow.', mourner: 2 },
    { id: 'restless', title: 'Restless dead', line: 'They climb out faster and give up sooner.', life: 0.75 }
  ]
};

// Souls for the first scoring run of the challenge each day, plus a little for each night in a row.
export const DAILY_SOULS = 25;
export const DAILY_STREAK_SOULS = 5;
export const DAILY_STREAK_CAP = 4;

/* ================= NUDGE COPY =================
   What the phone says when the shelf would like a word. The way-back ladder is
   five notes (a day, three, a week, a fortnight, a month) with three voices each,
   chosen by the date so a note is never the same twice running. No note scolds,
   counts hours against you or asks for anything. After the thirtieth day there
   are no more: the last of them says so.

   {name} is one of your residents. Data and tiny builders only. */

export const AWAY_LADDER = {
  away1: [
    ['The shelf has noticed', '{name} has been sitting by the edge since yesterday. It says it is not waiting. It is facing the door.'],
    ['A quiet evening', 'Nothing has gone wrong that you need to see yet. {name} is working on it.'],
    ['Tonight’s omen is face down', 'The candle is lit. {name} has been told not to touch the card, and has not touched the card. Much.']
  ],
  away3: [
    ['Three days on the shelf', '{name} has started a rota for who gets to be the one who misses you. Nobody wants it, so everybody has applied.'],
    ['The drawer is breathing', 'Something small is practising your name in the dark. {name} is helping, badly.'],
    ['A small delegation', '{name} and some others have drawn up a petition. It asks only that you look in. It is mostly doodles.']
  ],
  away7: [
    ['A week out', 'Nobody has held it against you. {name} has put a chair out anyway, and sits on it, with a face.'],
    ['The shelf is fine', 'Honestly. {name} says so, repeatedly, from under a blanket.'],
    ['The long lamp', 'The lamp is still lit. {name} has been feeding it. There is a small plaque with your name on it, in pencil.']
  ],
  away14: [
    ['A fortnight', '{name} kept your place. It has been used as a table, but the intention was there.'],
    ['A letter, unsigned', 'It is from {name}. It says “nothing to report” and runs to three pages.'],
    ['Old friends of the house', 'The residents are still here and still yours. {name} would like a word, and a snack, in that order.']
  ],
  away30: [
    ['Thirty days', 'The shelf is still here. So is the candle. {name} says come back whenever, means it, and is still on the step.'],
    ['The last word from the shelf', 'No more notes after this one. Everything is where you left it, including the dust. {name} has kept the dust.'],
    ['The door is open', 'It was never locked. {name} has put out biscuits for the occasion, and for the next occasion.']
  ]
};

const firstSentence = text => (text.match(/^[^.!?]*[.!?]/) || [text])[0];
export const CHAPTER_START_BODY = chapter => chapter.name + ' opens today. ' + firstSentence(chapter.blurb);
const LAST = [
  n => n + ' tiers to go. The limited curios can be bought back later, at a markup, so nothing is lost for good.',
  n => 'There are ' + n + ' tiers left on the track. After tonight the curios cost real souls. Real, and a lot of them.',
  n => n + ' tiers short. The month is ending the way months do, which is without asking.'
];
export const CHAPTER_LAST_BODY = (chapter, left) => LAST[chapter.no % LAST.length](left);
export const CHEST_READY_BODY = 'Three challenges done. It will open for you any time this week, and it has been very patient.';
export const CHEST_WEEK_BODY = done => done + ' of 3 weekly challenges done, and the week closes tonight. The chest only needs the other ' + (3 - done) + '.';

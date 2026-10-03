/* ================= WHILE YOU WERE AWAY =================
   What the shelf says when you come back after six hours or more. The voice is
   the usual one, with one rule on top: no guilt. The shelf is never cross, never
   counts the hours against you and never takes anything. Being away is allowed.

   {a} and {b} are two residents. {n} is a count. Data only. */

export const HEADLINES = {
  short: [
    'Back already. The shelf had barely noticed you were gone.',
    'A few hours out. Nothing was repaired, and nothing was broken beyond use.',
    'Welcome back. The residents have prepared a statement. It is mostly punctuation.'
  ],
  few: [
    'A day or two out. The shelf held a short meeting and adjourned for snacks.',
    'You were away a while. Everything is as you left it, only slightly more opinionated.',
    'Welcome back. A casserole has been left for you. Nobody will say who by.'
  ],
  many: [
    'Several days away. The shelf was run by committee, and the committee had a sandwich.',
    'A long time out, and nobody held it against you. They wrote it down in pencil, so it could be rubbed out.',
    'Welcome back. A banner was started. It says WELC, and then the glue gave up.'
  ]
};

export const QUEUE_LINES = {
  none: [
    'Nothing went wrong while you were out. The shelf is looking into why.',
    'A suspiciously quiet stretch. The drawer has been breathing evenly, which is worse.'
  ],
  one: [
    'One thing went wrong while you were out. It is waiting by the door with its hat in its hands.',
    'A single emergency has been kept warm for you. It is still warm. It is also still an emergency.'
  ],
  many: [
    '{n} things went wrong while you were out. They have formed a queue, and the queue is being very polite about it.',
    '{n} emergencies are waiting. They have taken numbers. The numbers are not in order.'
  ]
};

export const RESIDENT_LINES = [
  '{a} spent the whole time rehearsing what to say to you. It came to eleven words, nine of which were “well”.',
  '{a} reorganised a small drawer and refuses to discuss the hierarchy.',
  '{a} has been taking minutes. The minutes are mostly times at which nothing happened.',
  '{a} sat in the exact middle of the shelf, to be easy to find. Nobody looked.',
  '{a} wrote you a note, lost it, and has blamed the draught ever since.',
  '{a} and {b} had a disagreement about whose turn it was to miss you.',
  '{a} kept your place on the shelf. It is not clear what the place is, or why it needed keeping.',
  '{a} counted the candles twice. The answer was the same. It was not comforted.',
  '{a} learned a card trick. It is the same card trick. It is just a different card.',
  '{a} spent a while pretending the door was a painting. The door went along with it out of tact.',
  '{a} was heard telling a spider that you would be back. The spider has asked for a date.',
  '{a} has been very brave about it, in the manner of someone being very brave about it.',
  '{a} tried to run the household and has resigned, with a speech.',
  '{a} found a coin down the back of the shelf and has been asked to put it back.',
  '{a} napped in a patch of nothing and woke up with views.',
  '{a} drew a map of your side of the room. It is mostly arrows. A few of them are rude.',
  '{a} insists nothing happened. {b} insists something did. The shelf has taken both statements.',
  '{a} cleaned the glass, then un-cleaned it, to see what you would say.',
  '{a} gave {b} an honest opinion about the curtains. It is being processed.',
  '{a} got hold of a ladder. The ladder is back. Nobody says where it was.',
  '{a} polished a thing that does not need polishing and has not been able to explain it.',
  '{a} told a story about you that is largely true and has a better ending.',
  '{a} kept the candle going, which is the main thing, and then put it out, which is the other.',
  '{a} has started writing a will. It leaves everything to you, and the lamp to {b}.'
];

export const BOARD_LINES = {
  scene: 'The household filed “{t}” while you were out. It was filed twice, which is how they know it was serious.',
  notes: '{n} new notes are pinned to the board. Three are signed. One is signed three times.',
  quiet: 'The board is quiet, which on this shelf means someone is writing something.'
};

export const CHAPTER_LINE = '{name} has {n} {days} left. The track did not move while you were out, and it did not mind.';
export const CHEST_LINE = 'A chest was left by the door for you: {souls} souls and {xp} XP. It has not been opened, because it has manners. Nobody will say who left it.';

import { alt } from './court.js';

/* Shelf Court extras that belong to no case.

   BONUS_QUESTIONS are cross-examination questions that work in any case. An
   episode may swap one of its plain questions for one of these, so even a case
   you know by heart offers a question you do not. Each has two takes, written
   like the cases: lines are [speaker, text]; {p} and {d} are the parties and {j}
   a juror. Nothing in them depends on what the case is about.

   The rest is the patter around the Objection and the free clue a party who
   keeps receipts hands over. Same rules as everywhere in the court: petty,
   dark, specific, curly quotes, no dashes. */
export const BONUS_QUESTIONS = [
  { id: 'show-of-hands', ask: 'Ask the jury for a show of hands.', lines: alt([
    ['judge', 'Members of the jury. A show of hands. Who believes {p}?'],
    ['narrator', '(Two hands go up. One of them is not attached to anyone.)'],
    ['judge', 'And who believes {d}?'],
    ['narrator', '(The same two hands go up again. The jury becomes suspicious of the hands.)']
  ], [
    ['judge', 'A show of hands, please. Who has already made up their mind?'],
    ['narrator', '(Every hand goes up. Some of them belong to the audience. One belongs to the bailiff, who was only scratching.)'],
    ['judge', 'And who has been listening?'],
    ['narrator', '(One hand. It is {j}’s. {j} was asleep, and wants it known that it dreamt the evidence very carefully.)']
  ]) },
  { id: 'bailiff-notes', ask: 'Ask the bailiff to read his notes.', lines: alt([
    ['bailiff', 'Item one, Your Honour: “biscuit”. Item two: “biscuit”. Item three, I have drawn a biscuit.'],
    ['judge', 'Bailiff. Are those notes on the case?'],
    ['bailiff', 'They are notes on my afternoon, Your Honour. The case did not seem worth writing down.']
  ], [
    ['bailiff', 'I have written “{p}: shifty” and “{d}: also shifty”. Underneath I have written “everybody”.'],
    ['judge', 'That is not a note, Bailiff. That is a worldview.'],
    ['bailiff', 'It has served me well, Your Honour. I am still employed.']
  ]) },
  { id: 'recess', ask: 'Call a five minute recess.', lines: alt([
    ['judge', 'The court will rise for a five minute recess.'],
    ['narrator', '(The court rises. Nobody leaves. Everybody stands there, in front of each other, for five minutes.)'],
    ['audience', '(A ghost in row three asks if this is the recess. It is told yes. “It is a lot like the court,” it says.)'],
    ['judge', 'The court will sit.']
  ], [
    ['judge', 'Five minutes. Nobody leave.'],
    ['narrator', '(Everybody leaves. The jury is back in four. {p} and {d} are back in nine, each holding the other’s tea. Nobody discusses it.)'],
    ['judge', 'Is there anything either of you would like to say?'],
    ['d', 'No.'],
    ['p', 'Same.']
  ]) },
  { id: 'handshake', ask: 'Ask {p} and {d} to shake hands.', lines: alt([
    ['judge', 'Shake hands. For the cameras.'],
    ['p', 'I would rather not.'],
    ['d', 'Neither would I.'],
    ['narrator', '(They shake. It goes on for a long time. Something is communicated that nobody present will ever be able to prove.)']
  ], [
    ['judge', 'Shake hands, the pair of you. The audience likes closure.'],
    ['narrator', '({p} offers a hand. {d} looks at it, and then at the camera, and then at the hand. {d} shakes it with two fingers, like a man collecting a very small bill.)'],
    ['p', 'That was a handshake.'],
    ['d', 'That was an invoice.']
  ]) },
  { id: 'three-words', ask: 'Ask {d} to describe {p} in three words.', lines: alt([
    ['d', 'Not. My. Fault.'],
    ['judge', 'That is a description of you, {d}.'],
    ['d', 'It covers us both, Your Honour.'],
    ['p', 'It really does not.']
  ], [
    ['d', 'Loud. Damp. Present.'],
    ['p', 'That is three words.'],
    ['d', 'I had a fourth. It is not for television.'],
    ['judge', 'Keep the fourth. We will want it for the hallway.']
  ]) },
  { id: 'read-back', ask: 'Ask for the last answer to be read back.', lines: alt([
    ['judge', 'Bailiff, read that back to the court.'],
    ['bailiff', 'Which part, Your Honour?'],
    ['judge', 'The part where somebody said something true.'],
    ['bailiff', 'I only have the part where {j} sneezed, Your Honour. It was a good sneeze.']
  ], [
    ['judge', 'Read it back, Bailiff.'],
    ['bailiff', '“Mm.” Then “Ah.” Then there is a gap, and then I have written “oh no”.'],
    ['judge', 'Who said “oh no”?'],
    ['bailiff', 'I did, Your Honour. I would like that struck.']
  ]) },
  { id: 'swear', ask: 'Ask the parties to swear on something.', lines: alt([
    ['p', 'I swear on my mother.'],
    ['d', 'I swear on my mother’s mother.'],
    ['judge', 'Both of your mothers are in the gallery.'],
    ['narrator', '(In the gallery, two ghosts look at the floor. One of them mouths “I told you so” at the other. Neither of them has told anyone anything.)']
  ], [
    ['judge', 'Place a hand on the Bible and swear.'],
    ['narrator', '(There is no Bible. The bailiff offers the biscuit tin. Both parties swear on the biscuit tin, and mean it.)'],
    ['judge', 'That is the most sincere thing I have seen this week.'],
    ['bailiff', 'It is a very good tin, Your Honour.']
  ]) },
  { id: 'alive', ask: 'Ask the room if anybody here is alive.', sass: true, lines: alt([
    ['judge', 'Is anybody in this room alive? Raise a hand.'],
    ['narrator', '(Nobody raises a hand. Then, slowly, the bailiff does. The audience gasps. He lowers it. “Cramp,” he says.)'],
    ['judge', 'Bailiff, I will be speaking to you after the broadcast.']
  ], [
    ['audience', '(A ghost at the back raises a hand. The ghost beside it says “you are not.” The hand lowers. “Worth a try,” says the ghost.)'],
    ['judge', 'Let the record show that it tried.'],
    ['bailiff', 'The record is a biscuit, Your Honour. It will show whatever you like.']
  ]) },
  { id: 'conflict', ask: 'Ask the judge if he has a conflict of interest.', sass: true, lines: alt([
    ['judge', 'I do have a conflict of interest, as it happens. I am dead. It is hard to be impartial about the living.'],
    ['audience', '(The audience, who are also dead, applaud this as a matter of principle.)'],
    ['judge', 'I will try to rise above it. I am already floating a little.']
  ], [
    ['judge', 'My wife is in the gallery. Hello, dear.'],
    ['narrator', '(In the gallery, a ghost in a bonnet looks away. She has not spoken to him since 1702.)'],
    ['judge', 'She does not feel that I can be fair. I have asked her to put it in writing. She has, in the dust on my bench.']
  ]) },
  { id: 'exhibit-b', ask: 'Ask the bailiff to account for Exhibit B.', lines: alt([
    ['bailiff', 'It was a raisin, Your Honour. It is all in the notes.'],
    ['judge', 'The notes say “biscuit”.'],
    ['bailiff', 'It was a biscuit with a raisin in. I ate the part that was evidence.']
  ], [
    ['bailiff', 'Exhibit B is safe, Your Honour. It is in a safe place.'],
    ['judge', 'Where is the safe place?'],
    ['bailiff', 'I would rather not say, Your Honour, while it is still warm.']
  ]) }
];

/* The Objection. Each outcome has three takes, played whole. */
export const OBJECTION_STRIKE = [
  [['judge', 'Objection sustained. That note was a rumour in a clean shirt. Struck from the record.'],
   ['narrator', '(The bailiff crosses it out with a crayon. It is the only thing he is allowed to cross things out with.)']],
  [['judge', 'Sustained. Strike it. Strike it twice, in case it comes back.'],
   ['narrator', '(The note is struck. A small cheer goes up from the part of the audience that has been saying so all along.)']],
  [['judge', 'Sustained. That is not evidence. That is a feeling with a heading.'],
   ['narrator', '(The bailiff crosses it out with great ceremony and then, quietly, eats the corner.)']]
];
export const OBJECTION_CONFIRM = [
  [['judge', 'Objection noted, checked and overruled. The note stands. I did not enjoy that.']],
  [['judge', 'Overruled. The note was true all along. It was only wearing a lot of make-up.'],
   ['narrator', '(The bailiff stamps CONFIRMED on it. He has been waiting all week to stamp something.)']],
  [['judge', 'I checked. It is true. Somebody get that on a mug.'],
   ['narrator', '(The note is underlined twice. The bailiff adds a small drawing of a tick, then a larger tick, then a very large tick.)']]
];
export const OBJECTION_PRESS = [
  [['judge', 'Objection! I am not finished with that witness.'],
   ['narrator', '(The witness is not finished either. The witness thought it was.)']],
  [['judge', 'Objection, Your Honour. Mine. I have some more.'],
   ['narrator', '(The court leans in. It does not have to. It just likes to.)']],
  [['judge', 'Hold it there. That was nearly an answer. I would like the rest of it.'],
   ['narrator', '(The bailiff holds up a stopwatch. It is not on. He likes it for the atmosphere.)']]
];
export const OBJECTION_NOTHING = 'No note needs checking and nobody has testified yet. Save it.';

/* A party who keeps receipts hands over a free clue before the questions
   begin. `x` is whichever side it is; the clue is noted afterwards. */
export const RECEIPT_TAKES = [
  [['x', 'Before we begin, Your Honour: I kept the receipts. All of them. Alphabetically, by grievance.'],
   ['narrator', '(They hand the bailiff a folder. He holds it in both hands, as if it might hatch.)'],
   ['judge', 'Is there anything in it I should know?'],
   ['x', 'Page three. Do not read page four until I have left.']],
  [['x', 'Your Honour, if it please the court, I took notes.'],
   ['judge', 'During the incident?'],
   ['x', 'Especially during the incident. Page one is the whole thing in felt tip.'],
   ['narrator', '(The bailiff takes the pages and hides them from himself.)']],
  [['x', 'I would like to enter something into evidence.'],
   ['narrator', '(They produce a ring binder with tabs. The tabs have tabs.)'],
   ['judge', 'How long have you been preparing this?'],
   ['x', 'Since before the incident. I had a feeling.']]
];

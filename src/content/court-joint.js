// The Joint Bench: two friends judge the same Shelf Court hearing blind,
// then the bailiff opens both envelopes. Words only; the rules are in
// src/engine/court-joint.js.

// What a judge can do from the bench while watching. The second judge sees
// the first judge's taps as anonymous noises from the gallery.
export const REACTIONS = {
  laugh: { label: 'Laugh', icon: '😂', gallery: ['The gallery laughs. One judge, specifically.', 'A laugh from the gallery. It goes on slightly too long.', 'Somebody in the gallery finds this funny. The court makes a note of who.'] },
  gasp: { label: 'Gasp', icon: '😱', gallery: ['A gasp from the gallery. A proper one, with a hand.', 'The gallery gasps. Somebody up there has seen something.', 'One judge in the gallery inhales sharply and does not exhale for a while.'] },
  gavel: { label: 'Gavel', icon: '🔨', gallery: ['Someone in the gallery bangs an imaginary gavel. Firmly.', 'The gallery calls for order. The gallery is not in charge.', 'A small, furious knocking from the gallery. It is a judge, off duty.'] }
};
export const REACTION_IDS = Object.keys(REACTIONS);

// Character witnesses: a visiting guest, or a resident of the friend's shelf
// called in on an invitation. {w} is the witness, {p} and {d} the parties.
export const WITNESS_LINES = [
  'I have known {p} for an afternoon. I would not lend them a spoon. I would not lend them the idea of a spoon.',
  'I am only visiting. I saw nothing. I heard everything. I am saying nothing. Put that down as evidence.',
  '{d} looked at me “in a way” on Tuesday. I do not know what way. I would like it on the record anyway.',
  'I was promised a biscuit for this. I can see the biscuit. It is behind the judge. I am watching it, not you.',
  'Where I live this would never have come to court. Where I live we have a rota, and a laminated copy of the rota.',
  'I testify that {p} hums. Constantly. In a minor key. Nobody asked, which is why it matters.',
  'I am not from this shelf and I have never been so glad of anything in my life.',
  'I have no opinion on {p}. I have several on {d}. I have brought them in a folder.'
];
export const WITNESS_THANKS = [
  'Thank you. The court will disregard all of that, gratefully.',
  'Thank you for travelling. The court regrets it on your behalf.',
  'Noted. Somebody show the witness back to its own shelf, slowly.'
];
export const WITNESS_TAG = { visitor: 'Visiting from', friend: 'From' };

// The reveal. {a} and {b} are the two judges as the player reads them.
export const REVEAL_OPEN = [
  'Two judges. One case. No conferring. The rulings have been sealed in envelopes and kept somewhere damp.',
  'And now, the Joint Bench. Two judges have heard the same case without speaking to each other, which for one of them was a relief.',
  'The envelopes, please. They have been in the bailiff’s mouth. Only briefly.'
];
export const REVEAL_TRUTH = [
  'And the truth, from the case file, which nobody on the bench was allowed to read:',
  'The case file has been opened. It smells of Keith. It says:',
  'The truth, read aloud by the announcer, who was paid extra not to look at either of you:'
];
export const OUTCOMES = {
  full: {
    title: 'Full bench',
    lines: [
      'Full bench. Two judges, one verdict, and it was the right one. The court is unsettled by how well this went.',
      'Full bench. You agreed with each other and with the truth. Statistically this should not be possible. Legally, it is now precedent.',
      'Full bench. The jury is applauding. The bailiff is applauding. Somebody at the back is crying, but that is unrelated.'
    ]
  },
  divided: {
    title: 'The bench is divided',
    lines: [
      'The bench is divided. One of you is competent.',
      'The bench is divided. One of you is competent. The other has asked for a recount, which is not a thing.',
      'The bench is divided. One of you is competent. That one will be insufferable about it until at least Thursday.'
    ]
  },
  'wrong-together': {
    title: 'Wrong, together',
    lines: [
      'Unanimous, confident and wrong. The two of you have built something here, and it is a miscarriage of justice.',
      'You both got it wrong, in the same direction, at the same speed. The court admires the teamwork and nothing else.',
      'A united bench. United in error, holding hands, walking calmly into the sea.'
    ]
  },
  'wrong-apart': {
    title: 'Wrong, separately',
    lines: [
      'Two judges, two rulings, no truth. Somewhere a law degree is being quietly returned.',
      'You disagreed with each other and with reality. That is three parties, and you lost to all of them.',
      'Wrong in two different directions. The jury has asked whether it can judge you instead.'
    ]
  },
  alone: {
    title: 'Your ruling stands alone',
    lines: [
      'The other envelope never came. {b} has been recorded as “washing their hair”.',
      'Fourteen days and no second ruling. {b} is presumed to be hiding behind a curtain. The curtain is presumed to be enjoying it.'
    ]
  },
  declined: {
    title: 'Declined',
    lines: [
      '{b} declined to hear it. Your ruling stays sealed, in an envelope, in a drawer, forever, which is where most rulings belong.'
    ]
  }
};
export const FULL_BENCH_PAID = '+{n} souls each for a full bench.';
export const FULL_BENCH_SPENT = 'Full benches pay three times a day. This one pays in glory, which is not accepted anywhere.';

// The line in the Court lobby and on a friend's profile.
export const RECORD_AHEAD_THEM = [
  '{b} is ahead by {n}, and has mentioned it.',
  '{b} is ahead by {n}. {b} has had it engraved on something.'
];
export const RECORD_AHEAD_YOU = [
  'You are ahead by {n}. Try not to mention it. Mention it once.',
  'You are ahead by {n}, which you will be bringing up at dinner.'
];
export const RECORD_LEVEL = [
  'Dead level, which neither of you finds acceptable.',
  'Level. The court suspects collusion and cannot prove it.'
];
export const RECORD_NONE = 'No hearings together yet. Somebody has to be the better judge.';

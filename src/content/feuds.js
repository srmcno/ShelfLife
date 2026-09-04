/* ================= FEUDS =================
   A pair fires when two adjacent pets hold the two listed trait ids. Every id must
   exist in content/traits.js (enforced by test/content.test.mjs). Pairs are chosen
   for the collision, not the theme: the joke has to be legible from the two names
   alone. */
export const FEUDS = [
  ['gossip','spiteful'],['magpie','loadbearing'],['unblinking','nocturnal'],
  ['taxidermy','terminal'],['management','complaints'],['glitter','clean'],
  ['feral','clingy'],['ancient','amnesiac'],['cult','doom'],
  ['damp','clean'],['sugar','magpie'],['theatrical','management'],
  ['litigious','landlord'],['narcissist','critic'],['paranoid','influencer'],
  ['hoarder','minimalist'],['martyr','nihilist'],['revisionist','witness'],
  ['closer','timeshare'],['steward','landlord'],['prophet','cursed'],
  ['socialite','method'],['napoleon','steward'],['doomscroll','astrology'],
  ['cryptid','witness'],['freegan','critic'],

  // gothic-domestic expansion
  ['undertaker','terminal'],['undertaker','lifecoach'],
  ['mourner','nihilist'],['mourner','socialite'],
  ['understudy','narcissist'],['understudy','method'],
  ['executor','hoarder'],['executor','landlord'],
  ['heirloom','revisionist'],['heirloom','ancient'],
  ['bones','taxidermy'],['bones','clean'],
  ['swarm','witness'],['swarm','minimalist'],
  ['fullname','amnesiac'],['fullname','gossip'],
  ['auditor','freegan'],['auditor','magpie'],
  ['insomniac','nocturnal'],['insomniac','hummer'],
  ['reflection','unblinking'],['reflection','cryptid'],
  ['etiquette','feral'],['etiquette','damp'],
  ['hummer','critic'],['lifecoach','doom'],['lifecoach','martyr'],
  ['sleepwalker','paranoid'],['sleepwalker','loadbearing'],
  ['bitey','clingy'],['bitey','porcelain'],
  ['fungal','clean'],['fungal','minimalist'],
  ['porcelain','napoleon'],['physician','martyr'],['physician','astrology']
];

/* All three pools below are attributed to "observed" in the note feed — a bystander
   report, never one of the two pets speaking. {a} and {b} are two specific,
   currently-adjacent pets, so both names must be doing real work in the sentence:
   a line that reads the same with the names swapped is a line with no joke in it. */
export const FEUD_LINES = [
  '{a} and {b} are not speaking.',
  "{a} has moved {b}'s things. {b} has noticed.",
  '{a} says {b} started it. {b} is not commenting.',
  '{a} and {b} have drawn a line down the shelf.',
  '{a} wants {b} moved. Immediately. Permanently.',
  '{b} says {a} knows what it did.',
  '{a} has been sharpening something. {b} has been watching.',
  '{a} and {b} have agreed to disagree. Neither meant it.',
  '{b} slept badly. {a} slept excellently.',
  '{a} said good morning to everyone on the shelf. Everyone except {b}.',
  '{b} has begun sitting at an angle that excludes {a}.',
  '{a} laughed at something. {b} is certain it was about {b}.',
  '{a} ate first. {b} counted the seconds.',
  '{b} left the good spot rather than share it with {a}.'
];

// Used when a feud arc escalates (engine/achievements.js stepFeudArc)
export const ESCALATION_LINES = [
  '{a} rearranged the shelf overnight. {b} is now facing the wall.',
  "{a} took something of {b}'s. {b} has not said anything. Yet.",
  '{a} and {b} are communicating through a third party. The third party is the lamp.',
  '{a} left a note for {b}. The note is one sentence and it is devastating.',
  '{a} has recruited two others against {b}. {b} does not know yet.',
  "{a} moved into {b}'s spot while {b} was asleep. {b} will notice.",
  "{a} has stopped saying {b}'s name entirely. Uses a long pause instead.",
  "Something of {b}'s is missing. {a} is whistling.",
  '{a} has started keeping the receipts on {b}. Literal ones. There are three.',
  '{b} has stopped eating while {a} is watching. {a} has started watching more.',
  '{a} told everyone the story about {b}. It was not the true version. It was better.',
  '{b} has drawn up terms. {a} has not been shown the terms, only the folder.'
];

// Rare, used when a feud arc resolves into a truce
export const TRUCE_LINES = [
  '{a} and {b} are speaking again. Nobody knows what changed. Neither will say.',
  '{a} apologized to {b}. It was three words and it cost {a} everything.',
  '{a} and {b} shared a spot on the shelf without incident. Historians are stunned.',
  '{a} and {b} have called it even. The ledger has been quietly destroyed.',
  '{a} did something small for {b}. {b} pretended not to notice. Both know.',
  'Whatever it was between {a} and {b} is over. They get along now. It is much worse.',
  '{a} and {b} have a truce. It has terms. The terms are secret.',
  '{a} and {b} sat together all day. It was, against every odd, fine.',
  '{a} moved over. {b} sat down. Nothing was said about any of it.',
  '{a} and {b} have found somebody they dislike more. This counts as peace.'
];

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
  '{a} practised a eulogy for {b}. {b} corrected the good parts.',
  "{a} has moved {b}'s things. {b} has noticed.",
  '{a} calls {b} a waste of clay. {b} points out there was enough left over to make {a}.',
  '{a} has drawn a line down the shelf. {b} is licking it off from the far end.',
  '{a} keeps offering to catch {b} if it falls. Its mouth is open when it offers.',
  '{b} thanked {a} for staying small enough to ignore.',
  '{a} has been sharpening something. {b} has been watching.',
  '{a} offered {b} an olive branch. {b} asked where the rest of the coffin was.',
  '{b} slept badly. {a} slept excellently.',
  '{a} said good morning to everyone on the shelf. Everyone except {b}.',
  '{b} has begun sitting at an angle that excludes {a}.',
  '{a} laughed at something. {b} is certain it was about {b}.',
  '{a} ate first. {b} counted the seconds.',
  '{b} left the good spot rather than share it with {a}.',
  "{a} has been humming. {b} has identified the tune. It is about {b}.",
  "{b} moved one inch away from {a}. {a} moved one inch closer. This continued for an hour.",
  "{a} says it has nothing against {b}. It has a list against {b}. The list is separate.",
  "{a} and {b} both claim the crumb. {a} licked it. {b} asked whether that was the best it could do.",
  "{b} has started facing {a} while it sleeps. {a} has stopped sleeping.",
  "{a} swept its dust into {b}'s slot. {b} returned it in the shape of {a}, lying face down.",
  "{a} returned {b}'s greeting four seconds late, on purpose, and everybody heard the four seconds.",
  "{a} has drawn {b} on the underside of the shelf. It is not a flattering likeness. It is accurate."
];

// Used when a feud arc escalates (engine/achievements.js stepFeudArc)
export const ESCALATION_LINES = [
  '{a} rearranged the shelf overnight. {b} is now facing the wall.',
  "{a} took something of {b}'s. {b} has not said anything. Yet.",
  '{a} made a little effigy of {b}. {b} says the effigy is better company.',
  '{a} wrote “REST IN PEACE” on {b}’s nameplate. {b} wrote “START WITHOUT ME” on the back.',
  '{a} rehearsed pushing {b} off the shelf with a crumb. {b} ate the stunt double.',
  "{a} moved into {b}'s spot while {b} was asleep. {b} will notice.",
  "{a} has stopped saying {b}'s name entirely. Uses a long pause instead.",
  "Something of {b}'s is missing. {a} is whistling.",
  '{a} has begun knitting {b} a burial shroud. {b} keeps asking for sleeves.',
  '{b} has stopped eating while {a} is watching. {a} has started watching more.',
  '{a} told everyone the story about {b}. It was not the true version. It was better.',
  '{b} has sharpened a crumb into a point. {a} is watching it, visibly hungry.',
  "{a} has annexed the inch between itself and {b}. A very small flag has gone up.",
  "{b} now refers to {a} by slot number. {a} now refers to {b} as \"the previous tenant\".",
  "{a} rehearsed a moment of silence for {b}. {b} applauded until it stopped.",
  "{a} slept facing {b} all night with its eyes open. {b} counted. Neither blinked.",
  "{b} has built a small wall of crumbs along the border. {a} ate the wall and kept the border.",
  "{a} keeps asking whether {b} has put on weight. {b} is moulded. {a} owns the mould."
];

// Rare, used when a feud arc resolves into a truce
export const TRUCE_LINES = [
  '{a} and {b} are speaking again. They are also an inch closer together.',
  '{a} apologized to {b}. It was three words and it cost {a} everything.',
  '{a} offered {b} the little shroud as a blanket. {b} tucked its feet in.',
  '{a} and {b} have called it even. {a} ate the evidence. {b} helped with the large bit.',
  '{a} did something small for {b}. {b} pretended not to notice. Both know.',
  'Whatever it was between {a} and {b} is over. They get along now. It is much worse.',
  '{a} agreed to stop measuring {b} for a coffin. {b} agreed to stop growing in its direction.',
  '{a} and {b} sat together all day. It was, against every odd, fine.',
  '{a} moved over. {b} sat down. Nothing was said about any of it.',
  '{a} and {b} have found somebody they dislike more. This counts as peace.',
  "{a} and {b} have divided the crumb. Equally. Somebody measured it with a whisker.",
  "{a} and {b} sat through the whole of a night without either of them counting anything.",
  "{a} gave {b} the warm side. {b} checked for a trap, then sat down close enough for both.",
  "{a} and {b} have stopped wanting each other dead. Being immortal made it an exhausting hobby.",
  "{b} stood between {a} and a draught this morning. Neither of them has mentioned it, and neither will."
];

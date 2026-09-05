// Six beats each. The cast and evidence are filled from the player's shelf.
export const CASES = [
  { id: 'crumb', title: 'The crumb that cast two shadows', object: 'crumb',
    beats: ['A crumb has appeared with two shadows. {p} says one of them arrived first.',
      '{p} refuses to testify on an empty stomach. The crumb has requested separate representation.',
      'The upper shelf has poor visibility. Move {p} to B1 for a reconstruction. The second shadow is not cooperating.',
      '{p} says the crumb moved. {q} says the shelf moved. Both refuse to be measured.',
      'Someone has scratched a four-gesture code into the wood. Earn their confidence with a handshake, or two more useful care actions.',
      'The shadows line up with two dents in the wood. The crumb was covering a tiny communal doorway. Decide what becomes of it.'],
    good: 'The doorway stays open. They pass crumbs through it at night. Nobody fits. Everyone insists they have been through.',
    messy: 'The doorway is boarded up. A smaller doorway appears in the board. The committee has requested a smaller committee.' },
  { id: 'rattle', title: 'Something inside the shelf', object: 'rattle',
    beats: ['Three knocks came from inside the plank. {p} knocked back four times. There is now a disagreement about counting.',
      '{p} has been listening with its whole face. A little individual care might persuade it to describe the noise.',
      'B1 is directly over the noise. Move {p} there. It has volunteered {q}, but the wood specifically asked for {p}.',
      '{p} heard a name. {q} heard a spoon. Neither knows what a spoon sounds like when addressed formally.',
      'The knocks form a pattern. Learn a handshake with a resident, or offer two more useful care actions before the hearing.',
      'A loose knot in the wood is tapping against the back wall. It is doing its best. The residents want a verdict.'],
    good: 'The knot is admitted as an honorary resident. It gets no slot, no dinner, and the deciding vote. Turnout is excellent.',
    messy: 'The knot is told to be quiet. It starts tapping more softly. This is somehow worse.' },
  { id: 'lint', title: 'The disputed border of B1', object: 'lint border',
    beats: ['A line of lint divides the shelf. {p} claims the left side. {q} claims the lint.',
      '{p} is too cross to negotiate. Give a resident useful individual care. The border can wait; it has no legs.',
      'Put {p} in B1 to inspect the alleged frontier. All six spaces in a row remain neighbours, even on a small screen.',
      '{p} proposes a treaty. {q} proposes eating the treaty. Neither proposal includes a pen.',
      'The border guards demand a sign of goodwill: a handshake with a resident, or two more useful care actions.',
      'The lint was attached to both sides all along. The frontier is a very small scarf. Someone must decide who wears it.'],
    good: 'The scarf is declared communal. Everyone wears one end. Nobody can move. They call this peace.',
    messy: 'The scarf is divided. Both halves unravel. Two new borders have been claimed.' }
];
export const VISITORS = [
  { id: 'moth', name: 'Madam Moth', title: 'Inspector of small lights', gift: 'A bottled moonbeam', seed: 'visitor-moth', parts: { wings: 'moth', top: 'antennae' }, line: 'She has come to inspect your smallest light. She has brought a smaller clipboard.' },
  { id: 'lint', name: 'The Lint Baron', title: 'Owner of absolutely no land', gift: 'A ceremonial dust crown', seed: 'visitor-lint', parts: { top: 'crown' }, line: 'He has crossed three floorboards to be here. He considers this an overseas visit.' },
  { id: 'bell', name: 'Miss Afterbell', title: 'Arrives just after the noise', gift: 'A bell with the sound removed', seed: 'visitor-bell', parts: { top: 'halo' }, line: 'She has brought the silence from inside a bell. Please do not shake it.' }
];

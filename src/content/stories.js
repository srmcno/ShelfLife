// Six beats each. The cast and evidence are filled from the player's shelf.
export const CASES = [
  { id: 'crumb', title: 'The crumb that cast two shadows', object: 'crumb',
    beats: ['A crumb has appeared with two shadows. {p} says one of them arrived first.',
      '{p} wants a little attention before testifying. Care or a game will do. The crumb has requested separate representation.',
      'The upper shelf has poor visibility. Move {p} to B1 for a reconstruction. The second shadow is not cooperating.',
      '{p} says the crumb moved. {q} says the shelf moved. Both refuse to be measured.',
      'Someone has scratched a four-gesture code into the wood. Earn their confidence with a game together, or two more useful care actions.',
      'The shadows line up with two dents in the wood. The crumb was covering a tiny communal doorway. Decide what becomes of it.'],
    good: 'The doorway stays open. They pass crumbs through it at night. Nobody fits. Everyone insists they have been through.',
    messy: 'The doorway is boarded up. A smaller doorway appears in the board. The committee has requested a smaller committee.' },
  { id: 'rattle', title: 'Something inside the shelf', object: 'rattle',
    beats: ['Three knocks came from inside the plank. {p} knocked back four times. There is now a disagreement about counting.',
      '{p} has been listening with its whole face. A little care or a game together might persuade it to describe the noise.',
      'B1 is directly over the noise. Move {p} there. It has volunteered {q}, but the wood specifically asked for {p}.',
      '{p} heard a name. {q} heard a spoon. Neither knows what a spoon sounds like when addressed formally.',
      'The knocks form a pattern. Play a game with a resident, or offer two more useful care actions before the hearing.',
      'A loose knot in the wood is tapping against the back wall. It is doing its best. The residents want a verdict.'],
    good: 'The knot is admitted as an honorary resident. It gets no slot, no dinner, and the deciding vote. Turnout is excellent.',
    messy: 'The knot is told to be quiet. It starts tapping more softly. This is somehow worse.' },
  { id: 'lint', title: 'The disputed border of B1', object: 'lint border',
    beats: ['A line of lint divides the shelf. {p} claims the left side. {q} claims the lint.',
      '{p} is too cross to negotiate. Give a resident useful care or play a game together. The border can wait; it has no legs.',
      'Put {p} in B1 to inspect the alleged frontier. All six spaces in a row remain neighbours, even on a small screen.',
      '{p} proposes a treaty. {q} proposes eating the treaty. Neither proposal includes a pen.',
      'The border guards demand a sign of goodwill: a game with a resident, or two more useful care actions.',
      'The lint was attached to both sides all along. The frontier is a very small scarf. Someone must decide who wears it.'],
    good: 'The scarf is declared communal. Everyone wears one end. Nobody can move. They call this peace.',
    messy: 'The scarf is divided. Both halves unravel. Two new borders have been claimed.' }
];
export const VISITORS = [
  { id: 'moth', name: 'Madam Moth', title: 'Inspector of small lights', gift: 'A bottled moonbeam', seed: 'visitor-moth', parts: { wings: 'moth', top: 'antennae' }, line: 'She has come to inspect your smallest light. She has brought a smaller clipboard.' },
  { id: 'lint', name: 'The Lint Baron', title: 'Owner of absolutely no land', gift: 'A ceremonial dust crown', seed: 'visitor-lint', parts: { top: 'crown' }, line: 'He has crossed three floorboards to be here. He considers this an overseas visit.' },
  { id: 'bell', name: 'Miss Afterbell', title: 'Arrives just after the noise', gift: 'A bell with the sound removed', seed: 'visitor-bell', parts: { top: 'halo' }, line: 'She has brought the silence from inside a bell. Please do not shake it.' }
];

// Each caller leaves a different object and reacts differently to hospitality.
const GUEST_DETAILS = {
  moth: { body: 'bulb', palette: 'amber', returnLine: 'Madam Moth recognises the lamp. She greets it before anyone with a pulse.', crumbs: 'Madam Moth holds a crumb up to the light. “Opaque,” she says, and eats the evidence.', tour: 'Madam Moth inspects the shadows. One is trying to look taller than its owner.' },
  lint: { body: 'tuft', palette: 'ash', returnLine: 'The Lint Baron returns to inspect his holdings. Most are still attached to somebody else.', crumbs: 'The Baron calls the crumb a province. Annexation takes one bite.', tour: 'The Baron surveys the plank from both ends. His empire has doubled without getting any larger.' },
  bell: { body: 'gown', palette: 'lilac', returnLine: 'Miss Afterbell is back. The silence arrives first and looks for its old seat.', crumbs: 'Miss Afterbell eats without a sound. The crumb makes enough fuss for both of them.', tour: 'Miss Afterbell finds a quiet corner and folds it into a quieter corner.' }
};
VISITORS.forEach(v => Object.assign(v, GUEST_DETAILS[v.id]));
VISITORS.push(
  { id: 'undertow', name: 'Dr Undertow', title: 'Physician to the incurably permanent', gift: 'A clean bill of undeath', seed: 'visitor-undertow', body: 'urn', palette: 'drowned', parts: { top: 'halo' },
    line: 'Dr Undertow has arrived for a house call. The house has been told to stick out its tongue.', returnLine: 'Dr Undertow returns for a follow-up. Everyone is still here. A devastating result for his waiting list.',
    crumbs: 'Dr Undertow prescribes the crumb to himself. “Never test medicine on someone who can complain.”', tour: 'Dr Undertow checks the shelf for a pulse. “Wooden,” he says. “But very stable.”' },
  { id: 'widow', name: 'The Button Widow', title: 'Bereaved of a very small coat', gift: 'A mourning button', seed: 'visitor-widow', body: 'pear', palette: 'tar', parts: { wings: 'tattered', top: 'none' },
    line: 'The Button Widow has come dressed for a funeral. She is open to suggestions.', returnLine: 'The Button Widow is back. The funeral dress now has a pocket for snacks.',
    crumbs: 'The Button Widow breaks the crumb in half. One for the departed coat. Both for her.', tour: 'The Button Widow measures the plank for a procession. The procession will have to go single sadness.' },
  { id: 'spore', name: 'Auntie Spore', title: 'Travelling family of one', gift: 'A family portrait that keeps growing', seed: 'visitor-spore', body: 'sprout', palette: 'mould', parts: { top: 'none', detail: 'moss' },
    line: 'Auntie Spore arrives with a family portrait. The relatives on the back are still drying.', returnLine: 'Auntie Spore returns. There are more relatives in the photograph and less room in the frame.',
    crumbs: 'Auntie Spore names the crumb before eating it. “We were close, briefly.”', tour: 'Auntie Spore admires the corners. “Lovely. A nursery in every one.”' },
  { id: 'tooth', name: 'Sir Loose Tooth', title: 'Knight of the recently detached', gift: 'A medal with bite marks', seed: 'visitor-tooth', body: 'shard', palette: 'bone', parts: { top: 'crown', wings: 'none' },
    line: 'Sir Loose Tooth arrives without his horse. It was a sugar cube. They parted badly.', returnLine: 'Sir Loose Tooth has returned on foot. He refuses to discuss the replacement horse.',
    crumbs: 'Sir Loose Tooth challenges the crumb to single combat. It is a short and heavily chewed campaign.', tour: 'Sir Loose Tooth declares the shelf defensible. “Against what?” remains outside his brief.' },
  { id: 'echo', name: 'Little Echo', title: 'The second opinion', gift: 'A spare last word', seed: 'visitor-echo', body: 'stack', palette: 'ecto', parts: { top: 'antennae', wings: 'stubs' },
    line: 'Little Echo knocks twice. It insists the second knock was someone else.', returnLine: 'Little Echo is back. Back, it adds, helpfully.',
    crumbs: 'Little Echo asks for seconds before finishing firsts. It considers this professional consistency.', tour: 'Little Echo repeats the names of the rooms. There is only one room, but it gets a generous review.' },
  { id: 'needle', name: 'Mother Needle', title: 'Emergency seamstress', gift: 'A stitch in borrowed time', seed: 'visitor-needle', body: 'spindle', palette: 'cherry', parts: { top: 'none', detail: 'stitches' },
    line: 'Mother Needle has come to mend things. She looks at the residents and asks where to start.', returnLine: 'Mother Needle returns with stronger thread and lower expectations.',
    crumbs: 'Mother Needle threads a crumb onto a hair. “Packed lunch.” Then she eats the packing.', tour: 'Mother Needle inspects the cracks in the wood. “I can close those. The personalities will cost extra.”' }
);

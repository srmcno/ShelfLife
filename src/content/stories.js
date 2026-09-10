// Six beats each. The cast and evidence are filled from the player's shelf.
export const CASES = [
  { id: 'crumb', title: 'The crumb that cast two shadows', object: 'crumb',
    beats: ['A crumb has appeared with two shadows. {p} says one arrived first. It had been standing there since the previous tenant disappeared.',
      '{p} wants useful care or a game before testifying. It has seen what happens to witnesses who work for exposure.',
      'The upper shelf has poor visibility. Move {p} to B1 for a reconstruction. It asks whether you have already chosen its replacement.',
      '{p} says the crumb moved. {q} says the shelf moved. Both accounts end before the part where somebody screamed.',
      'Someone scratched a four-gesture code into the wood. The last mark is very deep. Earn their confidence with a game, or two more useful care actions.',
      'The shadows line up with two dents in the wood. The crumb covered a tiny communal doorway. Six witnesses have described a murder. It was the entrance to a pantry. Decide whether it stays open.'],
    good: 'The doorway stays open. They pass crumbs through it at night. Nobody fits through. Every morning, the crumbs are gone. They have voted against further investigation.',
    messy: 'The doorway is boarded up. A smaller doorway appears in the board. One witness has begun sleeping with its name facing the wall.' },
  { id: 'rattle', title: 'Something inside the shelf', object: 'rattle',
    beats: ['Three knocks came from inside the plank. {p} knocked back four times. Something inside tried the handle.',
      '{p} has been listening with its whole face. Offer useful care or a game. It would prefer to feel valued before discussing the noise behind its skull.',
      'B1 is directly over the noise. Move {p} there. It volunteers {q}. The knocking stops until it finishes saying the name.',
      '{p} heard a name. {q} heard a spoon scraping a plate. Neither wishes to meet whoever is still eating in there.',
      'The knocks form a pattern. A game together, or two more useful care actions, will earn enough confidence to hear it. {p} has asked you to stay afterwards.',
      'A loose knot in the wood is tapping against the back wall. That is all. {p} quietly withdraws its proposal to sacrifice {q}. The residents want a verdict.'],
    good: 'The knot becomes an honorary resident. It gets no slot, no food, and the deciding vote. Its first act is to block the motion requiring residents to be alive.',
    messy: 'The knot is told to be quiet. It begins tapping only when the room is empty. Nobody can explain how they know.' },
  { id: 'lint', title: 'The disputed border of B1', object: 'lint border',
    beats: ['A line of lint divides the shelf. {p} claims the left side. {q} claims the lint and has started charging mourners to cross it.',
      '{p} refuses to negotiate while hungry for attention. Give useful care or play a game together. {q} has started pricing the remaining exits.',
      'Put {p} in B1 to inspect the frontier. It wants a neutral observer. It settles for you and asks that the inspection be remembered as voluntary.',
      '{p} proposes a treaty. {q} asks whether signatures survive digestion. Negotiations briefly improve when everyone stops calling it a border and starts calling it a scarf.',
      'The border guards demand goodwill: a game together, or two more useful care actions. They are wearing the same thread and still insist they have nothing in common.',
      'The lint was attached to both sides all along. The frontier is a very small scarf. Three threats of annexation have been made over winter clothing. Decide who wears it.'],
    good: 'The scarf is declared communal. Everyone wears one end. Nobody can move without the others. One calls it peace. Another calls it a useful restraint.',
    messy: 'The scarf is divided. Both halves unravel. Nobody is warm, everyone has less territory, and both sides announce victory.' }
];
export const VISITORS = [
  { id: 'moth', name: 'Madam Moth', title: 'Inspector of small lights', gift: 'A bottled moonbeam', seed: 'visitor-moth', parts: { wings: 'moth', top: 'antennae' }, line: 'Madam Moth asks which lamp is warmest. She calls this an inspection. Her last three reports end halfway through a sentence.' },
  { id: 'lint', name: 'The Lint Baron', title: 'Owner of absolutely no land', gift: 'A ceremonial dust crown', seed: 'visitor-lint', parts: { top: 'crown' }, line: 'The Lint Baron has crossed three floorboards to inspect land he does not own. He is carrying eviction notices with the names left blank.' },
  { id: 'bell', name: 'Miss Afterbell', title: 'Arrives just after the noise', gift: 'A bell with the sound removed', seed: 'visitor-bell', parts: { top: 'halo' }, line: 'Miss Afterbell brings the silence from inside a bell. She asks you not to ring it. The last person who answered is still answering.' }
];

// Each caller leaves a different object and reacts differently to hospitality.
const GUEST_DETAILS = {
  moth: { classic: true, returnLine: 'Madam Moth greets the lamp before you. She asks whether it missed her. You appear to be staff.', crumbs: 'Madam Moth holds the crumb to the light. “A dead thing,” she says. She eats it without lowering her voice.', tour: 'Madam Moth inspects the shadows. One belongs to a resident you have never owned. She ticks a box and moves on.' },
  lint: { body: 'tuft', palette: 'ash', returnLine: 'The Lint Baron returns to inspect his holdings. They are still attached to other people. He has brought scissors.', crumbs: 'The Baron annexes the crumb and eats it. His subjects have been complaining of the same treatment.', tour: 'The Baron measures the shelf for graves. When challenged, he turns the plans upside down and calls them apartments.' },
  bell: { body: 'gown', palette: 'lilac', returnLine: 'Miss Afterbell returns with the same silence. It recognises the room. She pretends not to notice.', crumbs: 'Miss Afterbell eats the crumb in complete silence. You hear the swallowing several minutes later, from another room.', tour: 'Miss Afterbell finds a quiet corner. For a moment, every ticking thing in the room stops. She apologises for making herself comfortable.' }
};
VISITORS.forEach(v => Object.assign(v, GUEST_DETAILS[v.id]));
VISITORS.push(
  { id: 'undertow', name: 'Dr Undertow', title: 'Physician to the incurably permanent', gift: 'A clean bill of undeath', seed: 'visitor-undertow', body: 'urn', palette: 'drowned', parts: { top: 'halo' },
    line: 'Dr Undertow asks which resident looks worst. Before you answer, he takes out two forms and a tape measure.', returnLine: 'Dr Undertow returns for a follow-up. Everyone survived. He asks whether you followed his instructions.',
    crumbs: 'Dr Undertow eats the crumb. “I take a little of what the patients take.” He checks the clock. “Different dose.”', tour: 'Dr Undertow checks the shelf for a pulse. Finding none, he dates the certificate yesterday. “Saves everyone a return visit.”' },
  { id: 'widow', name: 'The Button Widow', title: 'Bereaved of a very small coat', gift: 'A mourning button', seed: 'visitor-widow', body: 'pear', palette: 'tar', parts: { wings: 'tattered', top: 'none' },
    line: 'The Button Widow is dressed for a funeral. She asks who is single. Then, without changing expression, who is insured.', returnLine: 'The Button Widow returns with another black button. “A difficult year.” She says it like a successful one.',
    crumbs: 'The Button Widow sets half the crumb aside for her late husband. After a respectful three seconds, she eats his share.', tour: 'The Button Widow admires the empty spaces. She remembers a house where there used to be none. “Lovely after a clear-out.”' },
  { id: 'spore', name: 'Auntie Spore', title: 'Travelling family of one', gift: 'A family portrait that keeps growing', seed: 'visitor-spore', body: 'sprout', palette: 'mould', parts: { top: 'none', detail: 'moss' },
    line: 'Auntie Spore arrives with a family portrait. There are faces on the back. She asks you to stop counting.', returnLine: 'Auntie Spore returns. Your wallpaper is in the family portrait now. She calls it a resemblance.',
    crumbs: 'Auntie Spore names the crumb after an uncle. She eats it and says he would have understood. Nobody asks what happened to him.', tour: 'Auntie Spore admires the damp corners. “Room for the children.” She is already unpacking them from under her skin.' },
  { id: 'tooth', name: 'Sir Loose Tooth', title: 'Knight of the recently detached', gift: 'A medal with bite marks', seed: 'visitor-tooth', body: 'shard', palette: 'bone', parts: { top: 'crown', wings: 'none' },
    line: 'Sir Loose Tooth arrives alone. His former owner has stopped putting up missing posters and started eating soup.', returnLine: 'Sir Loose Tooth returns with a second bite mark on his medal. He says he fought himself and has witnesses.',
    crumbs: 'Sir Loose Tooth challenges the crumb to single combat. He eats it before it answers and records a refusal to surrender.', tour: 'Sir Loose Tooth tests the exits. “Defensible,” he says, blocking the only one. You ask which side you are on.' },
  { id: 'echo', name: 'Little Echo', title: 'The second opinion', gift: 'A spare last word', seed: 'visitor-echo', body: 'stack', palette: 'ecto', parts: { top: 'antennae', wings: 'stubs' },
    line: 'Little Echo knocks twice. The second knock comes from inside. It waits for you to open both doors.', returnLine: 'Little Echo returns and repeats your greeting. The voice is familiar. You have been avoiding recordings of that person.',
    crumbs: 'Little Echo asks for a crumb in your voice. Then in another voice. You put down two and stop asking questions.', tour: 'Little Echo repeats the names of the rooms. It names one you have never seen. The others refuse to look towards the wall.' },
  { id: 'needle', name: 'Mother Needle', title: 'Emergency seamstress', gift: 'A stitch in borrowed time', seed: 'visitor-needle', body: 'spindle', palette: 'cherry', parts: { top: 'none', detail: 'stitches' },
    line: 'Mother Needle asks whether anything needs closing. Coats, wounds, mouths. She prices each before you can answer.', returnLine: 'Mother Needle returns with stronger thread. She has heard that some of her previous work is speaking again.',
    crumbs: 'Mother Needle threads the crumb onto a hair and eats it. She pulls out a longer hair. “Yours, I think.”', tour: 'Mother Needle inspects the residents for loose seams. One offers her money. She says it is already too late for alterations.' }
  ,{ id: 'clock', name: 'Mr Borrowed Time', title: 'Late by several lifetimes', gift: 'One unused tomorrow', seed: 'visitor-clock', body: 'urn', palette: 'rust', parts: { eyes: 'pair', top: 'halo', wings: 'none' },
    line: 'Mr Borrowed Time arrives holding an appointment card dated after your death. “I had a cancellation.”', returnLine: 'Mr Borrowed Time returns your minute. You remember being younger when you lent it.',
    crumbs: 'Mr Borrowed Time saves half the crumb for later. It crumbles to dust in his hand. He eats the other half quickly.', tour: 'Mr Borrowed Time examines the residents. “They will outlast you.” He says it kindly, which takes some of the pleasure out of the tour.' },
  { id: 'receipt', name: 'The Receipt Eater', title: 'Evidence disposal, while you wait', gift: 'A receipt for no known purchase', seed: 'visitor-receipt', body: 'spindle', palette: 'bone', parts: { top: 'none', wings: 'none', detail: 'stitches' },
    line: 'The Receipt Eater asks whether you need anything to have never happened. It checks who else is in the room before naming a price.', returnLine: 'The Receipt Eater returns looking ill. Apparently somebody kept a duplicate.',
    crumbs: 'The Receipt Eater eats the crumb, the receipt, and the pencil that signed it. You are beginning to understand its rates.', tour: 'The Receipt Eater studies the case board. It recognises several names. It has eaten the evidence against all of them.' },
  { id: 'rain', name: 'Captain Indoor Rain', title: 'Weather with nowhere to be', gift: 'A cloud on a short lead', seed: 'visitor-rain', body: 'tuft', palette: 'drowned', parts: { top: 'crown', wings: 'stubs' },
    line: 'Captain Indoor Rain arrives dripping. He takes off his hat for the crew. No crew arrives.', returnLine: 'Captain Indoor Rain returns with the same cloud. He is down one more crew member and up one more towel.',
    crumbs: 'The Captain retrieves the crumb from a puddle. He removes his hat, observes a brief silence, and eats the recovered remains.', tour: 'Captain Indoor Rain inspects the shelf for flood damage. “Good high ground.” The cloud moves directly over it.' }
);

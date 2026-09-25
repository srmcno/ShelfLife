// These pools are admitted by real shelf conditions in engine/observations.js.
export const OBSERVATIONS = {
  hungry: [
    '{p} has measured its mouth against the shelf edge. Dinner is becoming a structural question.',
    '{p} licked a picture of dinner until the plate was blank. It has eaten better drawings.',
    '{p}: “I cannot starve to death. You have found a much longer option.”',
    '{p} is chewing its own nameplate. It has reached the surname.'
  ],
  lonely: [
    '{p} is waving with its entire body. At this scale, neglect is a spectator sport.',
    '{p}: “Pick me up. I would like to be disappointed at eye level.”',
    '{p} has drawn a hand on the plank and is sitting under it.',
    '{p}: “I am small enough to lose and apparently large enough to avoid.”'
  ],
  dirty: [
    '{p} has grown mould. The mould looks healthier than {p}.',
    '{p}: “Do not scrape that off. It has started bringing me things.”',
    '{p} tried to leave a footprint. The rest of it stayed attached.',
    '{p} washed one foot. The other one is pretending they have never met.'
  ],
  full: [
    '{p} is full. It has hidden the spare crumb in its mouth, where nobody will think to look.',
    '{p}: “I have eaten enough to become slightly harder to bury.”',
    '{p} tried to suck its stomach in. Something came out of its ear.',
    '{p} has moved the emergency crumb to the other cheek. Both exits are blocked.'
  ],
  spotless: [
    '{p} has been washed. The bathwater has more personality than most of its neighbours.',
    '{p} can see its reflection in itself. Neither looks pleased to be related.',
    '{p}: “You have washed off my camouflage. The shelf can see me now.”',
    '{p} put the dirt in a little grave. It has come back to check whether the dirt stayed dead.'
  ],
  trust: [
    '{p} has stopped flinching at your hand. It now judges the cuticles.',
    '{p}: “If you ever lose me, check your sleeve. I have made improvements.”',
    '{p} is saving the softest patch of shelf for your fingertip.',
    '{p}: “I would bite someone for you. Someone proportionately sized.”'
  ],
  grudge: [
    '{p} has {count} grievances. It mouths them during cuddles. You thought it was purring.',
    '{p}: “I could forgive you. Then I would have to find a hobby.”',
    '{p} practised forgiving you in the mirror. Even its reflection did not buy it.',
    '{p} has put its grievances under the mattress. It sleeps at an angle.'
  ],
  renamed: [
    '{p} tried to peel off “{old}”. The name came away with a little dignity.',
    '{p}: “{old} is dead. Same body, unfortunately.”',
    '{p} held a funeral for {old}. Same body. Better attendance than expected.',
    '{p} is making {old} answer for its mistakes. An excellent arrangement for {p}.'
  ],
  promise: [
    '{p} has accepted your promise. It practised looking surprised in case you keep it.',
    '{p}: “You promised. I have a short body and a very long memory.”',
    '{p} has pinned its request over its mouth. It can complain through the paper.',
    '{p} has left room beside the promise for the apology. Optimism takes up less space.'
  ],
  kept: [
    '{p} has had {count} requests fulfilled. It is running out of places to hide its affection.',
    '{p}: “You kept your word. I had already sharpened a response.”',
    '{p} is practising saying thank you without showing any of its vulnerable bits.',
    '{p} has folded a kept promise into a pillow. It is less lumpy than the grudges.'
  ],
  chase: [
    '{p} re-enacted its last Crumb Chase with a dead moth playing the crumb. Poor casting.',
    '{p}: “I hunted dinner. At last, a reason for all this unnecessary leg.”',
    '{p} is warming up for Crumb Chase. Something inside it clicks on the opposite beat.',
    '{p} keeps calling Crumb Chase a massacre. It was toast before {p} arrived.'
  ],
  handshake: [
    '{p} is rehearsing the secret handshake behind its back. The back is not cleared to know.',
    '{p}: “You learned my handshake. We are now implicated together.”',
    '{p} is checking whether its shadow remembers the handshake. The shadow is one move behind.',
    '{p} has concealed the handshake in a normal itch. Please do not scratch the evidence.'
  ],
  arcade: [
    '{p} is practising Grave Whack on the bowl. The bowl has not climbed out once. {p} takes the credit.',
    '{p}: “I stacked eleven coffins. The twelfth was mine. I was not ready to be the twelfth.”',
    '{p} is holding a séance for its high score. The high score is not dead. {p} is making sure.',
    '{p} caught a falling crumb in its sleep. Then some holy water. It woke up steaming and proud.'
  ],
  court: [
    '{p} is cross-examining the teaspoon. The teaspoon is sweating. It is condensation, but {p} is taking notes.',
    '{p}: “Objection.” Nobody said anything. {p} is getting ahead of the day.',
    '{p} has been practising its not-guilty face in the mirror. The mirror has asked for a lawyer.',
    '{p} keeps glancing at the lamp. The lamp faces the wall now. The lamp knows what it did.'
  ],
  alibi: [
    '{p} has lost a clean Alibi round to you. It is moving the truth to a less accessible orifice.',
    '{p}: “You found every lie. I was hoping my face would count as mitigation.”',
    '{p} is rehearsing a more believable Alibi. It starts with a different expression.',
    '{p} has taken its defeated testimony apart. There is surprisingly little inside.'
  ],
  guest: [
    '{p} is hosting {visitor}. The good dust is out.',
    '{p}: “{visitor} has seen where I live. I can never be mysterious again.”',
    '{p} is giving {visitor} the tour. Turning round is the second half.',
    '{p} has offered {visitor} a seat. It is the same plank, said more warmly.'
  ],
  rival: [
    '{p} and {n} are sharing a shelf edge. Both have described gravity as an opportunity.',
    '{p} is leaving a gap beside {n}. The gap is getting the silent treatment too.',
    '{p}: “{n} has a lovely face for the underside of a shelf.”',
    '{p} offered to build {n} a coffin. {n} asked for breathing holes. {p} lost interest.'
  ]
};

export const CARE_CONTEXT = {
  food: {
    urgent: ['Dinner. I had started looking at my own feet as a pair of courses.', 'My mouth was beginning to inventory the furniture.', 'Good. I can cancel the tasting of myself.'],
    promised: ['You kept your promise. Come closer. I have put the teeth away.', 'Exactly what I asked for. I will complain about the bowl tomorrow.', 'You remembered. I had saved a very nasty little silence.'],
    trusted: ['I saved the least wet crumb for you.', 'You know which end the food goes in. That means a lot.', 'Stay until I finish. It is less embarrassing with company.']
  },
  fuss: {
    urgent: ['Oh. The hand still knows my address.', 'I thought I had become decorative. A fate worse than the other one.', 'A fingertip. An entire visitor, at my scale.'],
    promised: ['There. The promised affection has a thumb.', 'You remembered the small end of the arrangement.', 'I am crossing this off with my whole face.'],
    trusted: ['Careful. I am getting attached to an enormous flight risk.', 'You may touch the soft bit. Do not tell the others where it is.', 'I like you. I am saying it into your fingerprint so it cannot travel.']
  },
  clean: {
    urgent: ['My dirt had children. Please rinse the children out too.', 'I can bend again. Oh. That is what was under me.', 'Hold me while I dry. The towel is trying to keep me.'],
    promised: ['You promised a wash. I promised the mould a long life. One of us had to lie.', 'Clean, as requested. I will miss the extra height.', 'You found my face. I thought that was the back.'],
    trusted: ['You kept all my parts in the same order. I appreciate that.', 'You remembered the crack behind my ear. So did the dirt.', 'Wrap me up. I am feeling unnecessarily visible.']
  }
};

export const CONTEXT_EXCHANGES = {
  hungry: [
    { turns: [['a', 'I am wasting away.'], ['b', 'Sideways, somehow.']] },
    { turns: [['a', 'I have eaten the shelf under me.'], ['b', 'Then stop swallowing. You are holding us up.']] },
    { turns: [['a', 'I have nothing in my stomach.'], ['b', 'Enjoy the privacy.']] }
  ],
  dirty: [
    { turns: [['a', 'This layer is part of me now.'], ['b', 'Then introduce us.']] },
    { turns: [['a', 'I am cultivating a protective crust.'], ['b', 'It just asked me for directions.']] },
    { turns: [['a', 'Do I smell alive?'], ['b', 'In several places.']] }
  ],
  lonely: [
    { turns: [['a', 'I kept your spot warm.'], ['b', 'You sat in it.'], ['a', 'It was a long wait.']] },
    { turns: [['a', 'The hand passed over me again.'], ['b', 'It was moving the lamp.'], ['a', 'I have noted its priorities.']] },
    { turns: [['a', 'I have been practising not needing anyone.'], ['b', 'How is it going?'], ['a', 'I keep needing an audience.']] }
  ],
  full: [
    { turns: [['a', 'I have eaten enough.'], ['b', 'Then stop.'], ['a', 'I am waiting for the feeling to catch up.']] },
    { turns: [['a', 'There is no room left.'], ['b', 'You are the size of a button.'], ['a', 'I was referring to the bowl.']] },
    { turns: [['a', 'I hid the last crumb for later.'], ['b', 'You ate it.'], ['a', 'Later arrived early.']] }
  ],
  grudge: [
    { turns: [['a', 'I forgave the hand.'], ['b', 'Did it apologise?'], ['a', 'I said I forgave it.']] },
    { turns: [['a', 'I have stopped keeping score.'], ['b', 'The list is numbered.'], ['a', 'That is a filing system.']] },
    { turns: [['a', 'I am ready to let it go.'], ['b', 'What is it?'], ['a', 'I will tell you when it is safe.']] }
  ],
  renamed: [
    { turns: [['a', 'They used to call me {old}.'], ['b', 'Do you miss it?'], ['a', 'I still answer in the dark.']] },
    { turns: [['a', 'I had a different name last week.'], ['b', 'Was it better?'], ['a', 'It had fewer witnesses.']] },
    { turns: [['a', 'My old name is still on the shelf.'], ['b', 'Where?'], ['a', 'Under this one.']] }
  ],
  promise: [
    { turns: [['a', 'The giant has promised.'], ['b', 'The last one promised too. We outlived the excuse.']] },
    { turns: [['a', 'I have their word.'], ['b', 'Keep asking for the thumb. Harder to forget.']] },
    { turns: [['a', 'I believe they will do it.'], ['b', 'Tuck that in. Your hope is showing.']] }
  ],
  trusted: [
    { turns: [['a', 'I think the giant likes me.'], ['b', 'It keeps putting you down very carefully.']] },
    { turns: [['a', 'I would climb into that hand willingly.'], ['b', 'Disgusting. Is there room?']] },
    { turns: [['a', 'They know my soft side.'], ['b', 'All four inches of scandal.']] }
  ]
};

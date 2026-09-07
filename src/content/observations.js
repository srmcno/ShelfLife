// These pools are admitted by real shelf conditions in engine/observations.js.
export const OBSERVATIONS = {
  hungry: [
    '{p} has measured its mouth against the shelf edge. Dinner is becoming a structural question.',
    '{p} is licking the picture of a crumb. The picture is now a picture of regret.',
    '{p}: “I cannot starve to death. You have found a much longer option.”',
    '{p} has set a place for dinner. Dinner has yet to set a place for itself.'
  ],
  lonely: [
    '{p} is waving with its entire body. At this scale, neglect is a spectator sport.',
    '{p}: “Pick me up. I would like to be disappointed at eye level.”',
    '{p} has drawn a hand on the plank and is sitting under it.',
    '{p}: “I am small enough to lose and apparently large enough to avoid.”'
  ],
  dirty: [
    '{p} has developed a crust. It is referring to the inside as the old town.',
    '{p}: “Do not scrape that off. It has started bringing me things.”',
    '{p} tried to leave a footprint. The rest of it stayed attached.',
    '{p} smells like a damp coffin made for a grape.'
  ],
  full: [
    '{p} is full. The next crumb will need planning permission.',
    '{p}: “I have eaten enough to become slightly harder to bury.”',
    '{p} is lying beside its stomach like a proud homeowner.',
    '{p} has moved the emergency crumb to the other cheek. Both exits are blocked.'
  ],
  spotless: [
    '{p} is so clean the dust is arriving with references.',
    '{p} can see its reflection in itself. Neither looks pleased to be related.',
    '{p}: “You have washed off my camouflage. The shelf can see me now.”',
    '{p} is arranging a tiny funeral for the dirt. Open casket. Very open.'
  ],
  trust: [
    '{p} has stopped flinching at your hand. It now judges the cuticles.',
    '{p}: “If you ever lose me, check your sleeve. I have made improvements.”',
    '{p} is saving the softest patch of shelf for your fingertip.',
    '{p}: “I would bite someone for you. Someone proportionately sized.”'
  ],
  grudge: [
    '{p} has {count} grievances. The file is holding the resident upright.',
    '{p}: “Forgiveness would fit in my mouth. I have chosen the other thing.”',
    '{p} is polishing a grudge with the corner of a much older grudge.',
    '{p} has put its grievances under the mattress. It sleeps at an angle.'
  ],
  renamed: [
    '{p} tried to peel off “{old}”. The name came away with a little dignity.',
    '{p}: “{old} is dead. Same body, unfortunately.”',
    '{p} has crossed out {old} on its toe tag. The toe remains on probation.',
    '{p} is making {old} answer for its mistakes. An excellent arrangement for {p}.'
  ],
  promise: [
    '{p} has an accepted promise. It is keeping it warm under its least suspicious foot.',
    '{p}: “You promised. I have a short body and a very long memory.”',
    '{p} is pointing at its request. The finger is borrowed; the urgency is its own.',
    '{p} has left room beside the promise for the apology. Optimism takes up less space.'
  ],
  kept: [
    '{p} has had {count} requests fulfilled. It is running out of places to hide its affection.',
    '{p}: “You kept your word. I had already sharpened a response.”',
    '{p} is practising saying thank you without showing any of its vulnerable bits.',
    '{p} has folded a kept promise into a pillow. It is less lumpy than the grudges.'
  ],
  chase: [
    '{p} is reliving its last rewarded Crumb Chase. The crumbs have no right of reply.',
    '{p}: “I hunted dinner. At last, a reason for all this unnecessary leg.”',
    '{p} is stretching for another Crumb Chase. One joint has declined in writing.',
    '{p} has described Crumb Chase as a battle. The casualty was bread.'
  ],
  handshake: [
    '{p} is rehearsing the secret handshake behind its back. The back is not cleared to know.',
    '{p}: “You learned my handshake. We are now implicated together.”',
    '{p} is checking whether its shadow remembers the handshake. The shadow is one move behind.',
    '{p} has concealed the handshake in a normal itch. Please do not scratch the evidence.'
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
    '{p} is measuring {n} for a coffin. The immortality clause has delayed procurement.'
  ]
};

export const CARE_CONTEXT = {
  food: {
    urgent: ['Dinner. I had started looking at my own feet as a pair of courses.', 'My mouth was beginning to inventory the furniture.', 'Good. I can cancel the tasting of myself.'],
    promised: ['A promise you can chew. Already better than most promises.', 'That is the requested dinner. I will eat the receipt.', 'You remembered. I had saved a very nasty little silence.'],
    trusted: ['I saved the least wet crumb for you.', 'You know which end the food goes in. That means a lot.', 'Stay until I finish. It is less embarrassing with company.']
  },
  fuss: {
    urgent: ['Oh. The hand still knows my address.', 'I thought I had become decorative. A fate worse than the other one.', 'A fingertip. An entire visitor, at my scale.'],
    promised: ['There. The promised affection has a thumb.', 'You remembered the small end of the arrangement.', 'I am crossing this off with my whole face.'],
    trusted: ['Careful. I am getting attached to an enormous flight risk.', 'You may touch the soft bit. Do not tell the others where it is.', 'I like you. I am saying it into your fingerprint so it cannot travel.']
  },
  clean: {
    urgent: ['There goes a thriving civilisation. Keep the towel; it knows too much.', 'I can bend again. Horrifying range of possibilities.', 'The crust was load-bearing. Hold me while I reconsider.'],
    promised: ['You promised a wash. The dirt had promised to resist.', 'Clean, as requested. I will miss the extra height.', 'The agreed layer is gone. We will discuss the personality later.'],
    trusted: ['You kept all my parts in the same order. I appreciate that.', 'You remembered the crack behind my ear. So did the dirt.', 'Wrap me up. I am feeling unnecessarily visible.']
  }
};

export const CONTEXT_EXCHANGES = {
  hungry: [
    { turns: [['a', 'I am wasting away.'], ['b', 'Sideways, somehow.']] },
    { turns: [['a', 'If I eat the shelf, is that self-defence?'], ['b', 'It is an eviction with seasoning.']] },
    { turns: [['a', 'I have nothing in my stomach.'], ['b', 'Enjoy the privacy.']] }
  ],
  dirty: [
    { turns: [['a', 'This layer is part of me now.'], ['b', 'Then introduce us.']] },
    { turns: [['a', 'I am cultivating a protective crust.'], ['b', 'It just asked me for directions.']] },
    { turns: [['a', 'Do I smell alive?'], ['b', 'In several places.']] }
  ],
  promise: [
    { turns: [['a', 'The giant has promised.'], ['b', 'Get it in a footprint.']] },
    { turns: [['a', 'I have their word.'], ['b', 'Where will you keep something that big?']] },
    { turns: [['a', 'I believe they will do it.'], ['b', 'Tuck that in. Your hope is showing.']] }
  ],
  trusted: [
    { turns: [['a', 'I think the giant likes me.'], ['b', 'It keeps putting you down very carefully.']] },
    { turns: [['a', 'I would climb into that hand willingly.'], ['b', 'Disgusting. Is there room?']] },
    { turns: [['a', 'They know my soft side.'], ['b', 'All four inches of scandal.']] }
  ]
};

// Small anniversaries are keepsakes, not streaks. They use elapsed time from
// the resident's recorded move-in date and never punish a missed visit.
export const RESIDENT_TENURE = [
  {
    days: 1,
    title: 'A full day in residence',
    report: 'has spent a full day on the shelf. The dust has entered itself as next of kin.',
    callbacks: {
      attached: 'One day. Your hand is the size of the weather. I keep a place for it.',
      toothy: 'One day. I could bite the hand. I am giving it time to make a case for itself.',
      dramatic: 'Opening night. I played the corpse. The audience tried to feed me.',
      watchful: 'Day one. The shelf has an edge. I have logged its attitude.',
      old: 'A day is not a life. I have known shorter lives with better wardrobes.',
      plain: 'A day here. The dust introduced itself. It brought family.'
    }
  },
  {
    days: 7,
    title: 'A week on the shelf',
    report: 'has completed a week in residence. It recognises every creak except the one coming from itself.',
    callbacks: {
      attached: 'A week. I can tell the hand from its shadow. I like them both. Do not tell the shadow.',
      toothy: 'A week. I know the edge will not kill me. That is between me and the edge.',
      dramatic: 'A week. The play has no exit. My death scene has been moved to the interval.',
      watchful: 'A week. The house creaks in order. One noise keeps cutting the queue.',
      old: 'A week. The house is young. It still explains itself when it creaks.',
      plain: 'A week. I know which square stays warm. It is not a personality.'
    }
  },
  {
    days: 30,
    title: 'A month in residence',
    report: 'has spent a month on the shelf. Its evacuation plan has one arrow, marked DOWN.',
    callbacks: {
      attached: 'A month. I no longer rehearse being forgotten. I keep the script just in case.',
      toothy: 'A month. The hand and I have a treaty. It has not read the teeth clause.',
      dramatic: 'A month in the role. I requested a funeral scene. They gave me a dusting.',
      watchful: 'A month. The shelf has not fallen. I have opened a case against gravity anyway.',
      old: 'A month. The shelf has learned my weight. I am trying not to enjoy that.',
      plain: 'A month. The dust has stopped asking if I am visiting. Its children have not.'
    }
  },
  {
    days: 100,
    title: 'One hundred days on the shelf',
    report: 'has spent one hundred days in residence. Its draft eulogy now includes a rent clause.',
    callbacks: {
      attached: 'A hundred days. I can sit by the edge without imagining the bag. Almost.',
      toothy: 'A hundred days. I put the hand in my will. Under perishables.',
      dramatic: 'A hundred days. The critics stayed away; the understudy is a moth.',
      watchful: 'A hundred days. I no longer watch the door. I watch what opens it.',
      old: 'A hundred days. I own nothing here except the impression I leave in the wood.',
      plain: 'A hundred days. The shelf has taken my shape. It charges rent for the space.'
    }
  },
  {
    days: 365,
    title: 'A year in residence',
    report: 'has spent a year on the shelf. The house has moved it from guest to fixture without asking.',
    callbacks: {
      attached: 'A year. I know the shape of your hand. If it stops coming, I will remember it for both of us.',
      toothy: 'A year. Your hand is safe with me. The rest of you has not been discussed.',
      dramatic: 'A year. No final curtain. It filed for leave and has not come back.',
      watchful: 'A year. I know every sound the house makes. I still leave space for a new one.',
      old: 'A year. I used to ask which of us was temporary. The plank never answered.',
      plain: 'A year. I put my name in the dust. The dust put its name on me.'
    }
  }
];

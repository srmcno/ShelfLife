// Small anniversaries are keepsakes, not streaks. They use elapsed time from
// the resident's recorded move-in date and never punish a missed visit.
export const RESIDENT_TENURE = [
  {
    days: 1,
    title: 'A full day in residence',
    report: 'has spent a full day on the shelf. The dust has begun calling this "settling in."',
    callbacks: {
      attached: 'One day here. I know which hand comes back for me. I am not making you say it.',
      toothy: 'A full day. I have not bitten the hand. It has mistaken this for trust.',
      dramatic: 'One day in residence. Opening night was small; the audience was enormous.',
      watchful: 'One day. The bag made a noise at 3 a.m. I wrote it down.',
      old: 'One day. I have outlasted the arrangement, if not the furniture.',
      plain: 'A full day here. The dust is already acting like it owns the place.'
    }
  },
  {
    days: 7,
    title: 'A week on the shelf',
    report: 'has spent a week here. It now distinguishes the house settling from the house thinking.',
    callbacks: {
      attached: 'A week. I still know your hand by the pause before it lifts me.',
      toothy: 'A week here. I know the distance to the edge. I am using that knowledge kindly.',
      dramatic: 'A week in residence. No exit has been written. I have learned to improvise.',
      watchful: 'A week. The floor creaks before the hand appears.',
      old: 'A week in this house. Its mysteries remain mostly under the shelf.',
      plain: 'A week here. The bag has not reopened. I have lowered my expectations.'
    }
  },
  {
    days: 30,
    title: 'A month in residence',
    report: 'has spent a month on the shelf. The little dent beneath it is now part of its address.',
    callbacks: {
      attached: 'A month. I have stopped counting how long your hand is gone. Mostly.',
      toothy: 'A month here. The hand is still unbitten. Both of us know the arrangement.',
      dramatic: 'A month in the role. The cast is small; the silence has range.',
      watchful: 'A month. I know the night by the hinge that complains before you arrive.',
      old: 'A month. The shelf has learned my weight. I am trying not to enjoy that.',
      plain: 'A month here. The dust has stopped asking whether I am visiting.'
    }
  },
  {
    days: 100,
    title: 'One hundred days on the shelf',
    report: 'has spent one hundred days here. It has stopped asking what happens after the bag.',
    callbacks: {
      attached: 'A hundred days. I no longer flinch when you put me down. I have other flaws.',
      toothy: 'A hundred days unbitten. I am beginning to suspect you are keeping me.',
      dramatic: 'One hundred days. I have outlasted three endings and two scene partners.',
      watchful: 'A hundred days. I no longer watch the door. I watch what opens it.',
      old: 'A hundred days. Enough time to call a place home, then distrust the word.',
      plain: 'A hundred days here. I have stopped counting exits. There are fewer than I hoped.'
    }
  },
  {
    days: 365,
    title: 'A year in residence',
    report: 'has spent a year on the shelf. The varnish has learned its name and will not give it back.',
    callbacks: {
      attached: 'A year here. Your thumbprint still fits the soft patch on my back.',
      toothy: 'A year. I have kept your hand unbitten. The restraint is becoming hereditary.',
      dramatic: 'A year on the shelf. I survived the cast, the critics and the absent curtain call.',
      watchful: 'A year. The house has changed its noises. I still know the hand.',
      old: 'A year. I thought the plank was temporary. This is an apology to the plank.',
      plain: 'A year here. The shelf is not a home. I have put my name on it anyway.'
    }
  }
];

/* ================= MATURE MODE OVERLAY =================
   Opt-in extra lines mixed into the normal copy.js pools by engine/loop.js only when
   state.settings.matureMode is true (default OFF, explicit toggle in the UI). Mild-to-
   moderate profanity for comedic emphasis, same deadpan "small monster with a grudge"
   voice as the rest of the content — never slurs, never targeting real people or
   protected groups, never sexual content. These are additions, not replacements. */

export const MATURE_COMPLAINTS_EXTRA = {
  food: [
    'Says the bowl is empty and this is bullshit, frankly.',
    'Is hungry as hell and taking it personally.',
    'Announced, loudly, that this is "some shit," regarding dinner.',
    'Has decided starvation is your fault specifically, goddammit.',
    'Said "where the hell is dinner" in a voice clearly meant to be heard.',
    'Is one skipped meal away from eating something it will regret, and does not give a damn.'
  ],
  fuss: [
    'Says you have been a real ass about the attention thing lately.',
    'Is done waiting around like some kind of idiot, and said so.',
    'Muttered "screw this" and turned to face the wall.',
    'Has decided you do not give a damn, and is telling everyone.',
    'Called the whole situation bullshit and went to sulk about it professionally.',
    'Called you a stubborn bitch. Fondly. Ish.'
  ],
  clean: [
    'Smells like actual hell and has strong feelings about being told so.',
    'Says the mess is not that bad, which is a flat-out lie.',
    'Has gone full swamp creature and is weirdly proud of it, the little shit.',
    'Is sticky as hell and blaming the room for it.',
    'Says cleaning is bullshit and dignity is optional anyway.',
    'Has achieved a smell that could be legally classified as a weapon, goddamn it.'
  ]
};

export const MATURE_HAPPY_EXTRA = [
  'Had a genuinely good day and is pissed about how good it was.',
  'Admitted, once, quietly, that today did not suck.',
  'Said "fine, this is actually pretty damn nice" and immediately regretted saying it out loud.',
  'Is in a good mood and daring anyone to say a goddamn word about it.',
  "Told the mirror you're \"not the worst,\" which, for this one, is basically a love letter.",
  'Had a decent day and is furious there is no one to blame for that.',
  'Said today "didn\'t completely suck," which is the nicest thing it has said all month.'
];

export const MATURE_EVENTS_EXTRA = [
  'Someone wrote "this shelf is bullshit" on the wall in something that is hopefully paint.',
  'A voice at 3am said one word, clearly, and the word was profane. Nobody claimed it.',
  'Something knocked a single item off the shelf and left a note that just said "oops, my bad."',
  'There was swearing in the walls last night. Confirmed by three witnesses. Denied by all three in the morning.',
  'A jar labeled "do not open, for fuck\'s sake" has appeared. It has not been opened. Yet.',
  'Someone held a small, profane funeral for a dropped snack.',
  'Something scratched a single curse word into the underside of the shelf. Spelling questionable. Sentiment clear.'
];

export const MATURE_GRUDGE_EXTRA = {
  1: [
    '{n} called you a little bit of an ass under its breath.',
    '{n} muttered "screw this guy" and went back to what it was doing.',
    '{n} said this whole thing was bullshit and wrote it down anyway.',
    '{n} is giving you the silent treatment and swearing about it internally, loudly.',
    '{n} said "damn it" at you specifically, which is new.',
    '{n} has started a list. The list has a swear word for a title.'
  ],
  2: [
    '{n} told the others you\'re "kind of an asshole about this," and they agreed.',
    '{n} said, flatly, "I\'m done with this shit," and rearranged the shelf to prove it.',
    '{n} has recruited backup and used a lot of profanity doing it.',
    '{n} left a note that just says "screw you" and walked away, satisfied.',
    '{n} is telling everyone within earshot that you\'re "the actual worst," with feeling.',
    '{n} filed a complaint that opens with "this is bullshit" and gets worse from there.'
  ],
  3: [
    '{n} has a jar with your name on it and a label that says "for later, you bastard."',
    '{n} held a small, extremely profane ceremony and you were definitely the subject.',
    '{n} said, very calmly, "I am not going to swear about this," and then swore about it at length.',
    '{n} has started being suspiciously nice, and every kindness comes with a muttered "for now."',
    '{n} wrote your name on something in what might be permanent marker, might be worse, and added "asshole" underneath.',
    '{n} has stopped yelling entirely, which everyone agrees is the scariest goddamn thing it has ever done.'
  ]
};

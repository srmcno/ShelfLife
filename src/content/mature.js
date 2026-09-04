/* ================= MATURE MODE OVERLAY =================
   Opt-in extra lines mixed into the normal copy.js pools by engine/loop.js only when
   state.settings.matureMode is true (default OFF, explicit toggle in the UI). Mild-to-
   moderate profanity for comedic emphasis, same deadpan "small monster with a grudge"
   voice as the rest of the content — never slurs, never targeting real people or
   protected groups, never sexual content. These are additions, not replacements.

   The bar is the same as the base pools: the swearing is the emphasis, never the joke.
   If a line stops being funny with the profanity removed, it was never funny. */

export const MATURE_COMPLAINTS_EXTRA = {
  food: [
    'Says the bowl is empty and this is bullshit, frankly.',
    'Is hungry as hell and taking it personally.',
    'Looked in the bowl, said "you have got to be kidding me," and sat back down.',
    'Has decided this is your fault. Says your name like a swear word now.',
    'Said "where the hell is dinner" in a voice clearly meant to carry.',
    'Is one skipped meal from eating something with a face. Does not care whose.',
    'Has stopped calling it dinner and started calling it "the situation."'
  ],
  fuss: [
    'Says you have been a real ass lately and it has examples.',
    'Is done sitting by the door like an idiot. Said so. Loudly.',
    'Muttered "screw this" and turned to face the wall.',
    'Has decided you do not give a damn, and is telling everyone.',
    'Called the whole situation bullshit and went to sulk about it professionally.',
    'Called you a stubborn bitch. Fondly. Ish.',
    'Said it does not need this shit, then waited by the door anyway.'
  ],
  clean: [
    'Smells like hell and has strong feelings about being told so.',
    'Says the smell is "not that bad." The smell has reached the next room.',
    'Has gone full swamp creature and is weirdly proud of it, the little shit.',
    'Is sticky as hell and blaming the room for it.',
    'Says cleaning is bullshit and dignity is optional anyway.',
    'Has achieved a smell with legal implications.',
    'Told the others it is "curing." It is not curing. It is rotting, the little bastard.'
  ]
};

export const MATURE_HAPPY_EXTRA = [
  'Had a genuinely good day and is pissed about how good it was.',
  'Admitted, once, quietly, that today did not suck.',
  'Said "fine, this is nice, damn it," and left the room.',
  'Is in a good mood and daring anyone to say a goddamn word about it.',
  'Told the mirror you are "not the worst." That is the whole speech.',
  'Was happy for most of an hour and has not worked out who to blame.',
  'Let you pick it up without a single complaint, the absolute weirdo.'
];

export const MATURE_EVENTS_EXTRA = [
  'Someone wrote "this shelf is bullshit" on the wall in something that is hopefully paint.',
  'A voice at 3am said one word, clearly, and the word was profane. Nobody has claimed it.',
  'Something knocked one item off the shelf and left a note that just said "oops, my bad."',
  'There was swearing in the walls last night. Confirmed by three witnesses. Denied by all three in the morning.',
  'A jar labeled "do not open, for fuck\'s sake" has appeared. It has not been opened. Yet.',
  'Someone held a small, profane funeral for a dropped snack.',
  'A curse word has been scratched into the underside of the shelf. Spelling questionable. Sentiment clear.',
  'They held a vote at 2am. The result was one word and it was not a polite one.'
];

export const MATURE_GRUDGE_EXTRA = {
  1: [
    '{n} called you a little bit of an ass under its breath.',
    '{n} muttered "screw this guy" and went back to what it was doing.',
    '{n} said this whole thing was bullshit and wrote it down anyway.',
    '{n} is not speaking to you. Its face is swearing continuously.',
    '{n} has started saying your name the way other people say "damn it."',
    '{n} has started a list. The list has a swear word for a title.'
  ],
  2: [
    '{n} told the others you are "kind of an asshole about this," and they agreed.',
    '{n} said, flatly, "I am done with this shit," and rearranged the shelf to prove it.',
    '{n} has recruited backup and used a great deal of profanity doing it.',
    '{n} left a note that just says "screw you" and walked away, satisfied.',
    '{n} is telling everyone within earshot that you are "the actual worst," with feeling.',
    '{n} filed a complaint that opens with "this is bullshit" and gets worse from there.'
  ],
  3: [
    '{n} has a jar with your name on it and a label that reads "for later, you bastard."',
    '{n} held a small, extremely profane ceremony and you were definitely the subject.',
    '{n} said, very calmly, "I am not going to swear about this," and then swore about it at length.',
    '{n} has started being suspiciously nice, and every kindness comes with a muttered "for now."',
    '{n} wrote your name on something in what might be permanent marker and added "asshole" underneath.',
    '{n} has stopped swearing at you entirely, which everyone agrees is the scariest damn thing it has ever done.'
  ]
};

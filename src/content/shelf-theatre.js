// Small performances on the actual shelf. Dialogue is plain text; {a}/{b}
// refer only to the residents selected for this performance.
const line = (actor, text) => ({ actor, text });
const variant = (id, action, title, mode, summary, ...lines) => ({ id, action, title, mode, summary, lines });

export const SHELF_SCENES = [
  { kind: 'bath', title: 'An unrequested bath', propKind: 'tub', minActors: 1,
    requirements: 'An awake resident within two spaces of a tub. A nearby witness may get splashed.',
    variants: [
      variant('bath:inventory', 'bath', 'The water inventory', 'solo', '{a} counted the bubbles. One was missing before it started.',
        line(0, 'Forty-one bubbles. Forty-two. Who authorised forty-two?'), line(0, 'I shall be here until the figures agree.')),
      variant('bath:estate', 'bath', 'A very small estate', 'solo', '{a} lowered itself into the tub and declared the water an ancestral property.',
        line(0, 'This is my lake now.'), line(0, 'The ancestral duck will be arriving shortly.')),
      variant('bath:splash', 'bath', 'Collateral cleanliness', 'pair', '{a} took a bath. {b} received the overflow and an unsigned apology.',
        line(0, 'I am testing the water.'), line(1, 'You have tested it on me.'), line(0, 'And the results are extremely clean.')),
      variant('bath:weather', 'bath', 'A local weather event', 'pair', '{a} made one wave. {b} began keeping a flood diary.',
        line(0, 'A little movement is good for the circulation.'), line(1, 'My circulation is now outside my body.'), line(0, 'Excellent coverage.'))
    ] },
  { kind: 'lamp', title: 'Who owns the light?', propKind: 'lamp', minActors: 1,
    requirements: 'An awake resident near a lamp. Light-loving and shade-loving neighbours disagree about the switch.',
    variants: [
      variant('lamp:on', 'lamp', 'An audience of shadows', 'on', '{a} switched the lamp on. Its shadow was asked to pay attention.',
        line(0, 'There. Now somebody can see what I am putting up with.'), line(0, 'You too, shadow. Sit properly.')),
      variant('lamp:on-again', 'lamp', 'The inspection light', 'on', '{a} switched on the lamp to inspect a crumb. The crumb passed.',
        line(0, 'We need better visibility.'), line(0, 'It is a crumb. The investigation continues.')),
      variant('lamp:off', 'lamp', 'Privacy for four inches', 'off', '{a} switched off the lamp and became confidential.',
        line(0, 'Some of us do our best work unseen.'), line(0, 'I was doing nothing. Privately.')),
      variant('lamp:off-again', 'lamp', 'Closing time', 'off', '{a} turned out the light. The moon was given a warning.',
        line(0, 'Office closed.'), line(0, 'That includes you, enormous outdoor lamp.')),
      variant('lamp:dispute-on', 'lamp', 'The light committee', 'dispute-on', '{a} asked for darkness. {b} restored the light. The committee remains divided.',
        line(0, 'Darkness has a perfectly good reputation.'), line(1, 'I should like to see who is saying that.'), line(0, 'This is precisely the problem.')),
      variant('lamp:dispute-off', 'lamp', 'A majority of one', 'dispute-off', '{a} wanted the lamp on. {b} turned it off. Both claimed a majority.',
        line(0, 'I had the light arranged.'), line(1, 'I have arranged the absence of it.'), line(0, 'I am recording a strongly worded shadow.'))
    ] },
  { kind: 'musicbox', title: 'An almost musical duet', propKind: 'musicbox', minActors: 2,
    requirements: 'Two awake neighbours near a music box, with at least one who enjoys a performance.',
    variants: [
      variant('musicbox:duet', 'dance', 'Two parts, neither correct', 'pair', '{a} and {b} sang different verses at once. The music box kept its own counsel.',
        line(0, 'You take the high part.'), line(1, 'I am four inches tall.'), line(0, 'Ambition, then.')),
      variant('musicbox:encore', 'dance', 'The unsolicited encore', 'pair', '{a} took a bow. {b} mistook it for the beginning and started again.',
        line(0, 'Thank you. That concludes our performance.'), line(1, 'One, two, three—'), line(0, 'We appear to have been renewed.')),
      variant('musicbox:tempo', 'dance', 'A disagreement in waltz time', 'pair', '{a} counted the beat. {b} counted the complaints. Both reached three.',
        line(0, 'Try to follow me.'), line(1, 'I am following a better tune.'), line(0, 'It had better end at the same time.')),
      variant('musicbox:audition', 'dance', 'The audition', 'pair', '{a} and {b} auditioned for the music box. It offered them the lid.',
        line(0, 'We can also dance.'), line(1, 'We have just demonstrated why we should sing.'), line(0, 'Close the lid before it replies.'))
    ] },
  { kind: 'yarn', title: 'A question of ownership', propKind: 'yarn', minActors: 2,
    requirements: 'Two awake neighbours near yarn. At least one must fancy the yarn or a little trouble.',
    variants: [
      variant('yarn:ends', 'tug', 'Both ends belong to someone', 'pair', '{a} claimed one end of the yarn. {b} claimed the other. Neither had considered the middle.',
        line(0, 'This end is mine.'), line(1, 'Then stop moving my end.'), line(0, 'The middle is being unreasonable.')),
      variant('yarn:rope', 'tug', 'An extremely short expedition', 'pair', '{a} and {b} attempted a tug of war. The war occupied three inches.',
        line(0, 'Give ground.'), line(1, 'There is no more ground.'), line(0, 'Then give shelf.')),
      variant('yarn:knot', 'tug', 'Negotiations in a knot', 'pair', '{a} pulled. {b} pulled. The knot acquired diplomatic immunity.',
        line(0, 'We are making progress.'), line(1, 'We are making a knot.'), line(0, 'A very advanced form of progress.')),
      variant('yarn:inheritance', 'tug', 'The string succession', 'pair', '{a} bequeathed the yarn to {b}, then refused to let go of the estate.',
        line(0, 'You may have this after I am gone.'), line(1, 'You cannot die.'), line(0, 'A sound long-term arrangement.'))
    ] },
  { kind: 'mirror', title: 'Consulting the reflection', propKind: 'mirror', minActors: 1,
    requirements: 'An awake resident drawn to the mirror within two spaces of it.',
    variants: [
      variant('mirror:approval', 'mirror', 'The approval process', 'solo', '{a} asked its reflection for an honest opinion and interrupted the reply.',
        line(0, 'Be entirely honest.'), line(0, 'Yes, that is enough honesty.')),
      variant('mirror:rehearsal', 'mirror', 'A difficult role', 'solo', '{a} rehearsed looking innocent. The reflection asked for another actor.',
        line(0, 'I have never seen that crumb before.'), line(0, 'No. Too convincing. They will suspect training.')),
      variant('mirror:witness', 'mirror', 'An independent assessment', 'pair', '{a} admired itself. {b} inspected the crack in the mirror and offered it sympathy.',
        line(0, 'Would you say I have presence?'), line(1, 'You have been present here for quite some time.'), line(0, 'A glowing review.')),
      variant('mirror:double', 'mirror', 'Two against one', 'pair', '{a} introduced its reflection to {b}. The two appearances agreed to outvote the witness.',
        line(0, 'At last, somebody who understands me.'), line(1, 'That is you.'), line(0, 'We both resent the implication.'))
    ] },
  { kind: 'bowl', title: 'Table manners', propKind: 'bowl', minActors: 1,
    requirements: 'An awake resident near the bowl. Real snacks rest with the existing bowl refill timer.',
    variants: [
      variant('bowl:portion', 'meal', 'A generous portion', 'solo', '{a} divided the snack into two portions and assigned both to itself.',
        line(0, 'One for now. One for slightly later.'), line(0, 'Later has arrived.')),
      variant('bowl:sharing', 'meal', 'A lesson in sharing', 'pair', '{a} offered {b} the larger crumb, then checked whether anybody had witnessed it.',
        line(0, 'Please. After you.'), line(1, 'Are you ill?'), line(0, 'I am trying manners. They itch.')),
      variant('bowl:cutlery', 'meal', 'The correct small fork', 'pair', '{a} and {b} debated table manners until the crumb looked like a simple solution.',
        line(0, 'Which fork is for this?'), line(1, 'We have no forks.'), line(0, 'A scandal. Pass it here.')),
      variant('bowl:empty', 'meal', 'The invisible course', 'empty', '{a} inspected the empty bowl and left a review of the atmosphere.',
        line(0, 'Beautifully presented.'), line(0, 'There is an ambitious lack of dinner.'))
    ] },
  { kind: 'phone', title: 'A very local call', propKind: 'phone', minActors: 1,
    requirements: 'An awake gossip or sociable resident near the phone. An actual nearby listener may join.',
    variants: [
      variant('phone:operator', 'phone', 'The operator', 'solo', '{a} phoned the operator to report that the operator did not exist.',
        line(0, 'I should like to speak to someone responsible.'), line(0, 'Yes. That is the problem, everywhere.')),
      variant('phone:hold', 'phone', 'On hold', 'solo', '{a} put the disconnected phone on hold. It was an improvement.',
        line(0, 'I have another call.'), line(0, 'It is equally imaginary, but considerably more urgent.')),
      variant('phone:gossip', 'phone', 'A confidential broadcast', 'pair', '{a} whispered a secret into the phone. {b}, two inches away, received excellent reception.',
        line(0, 'This goes no further.'), line(1, 'It has already reached here.'), line(0, 'An appalling breach of distance.')),
      variant('phone:reference', 'phone', 'A character reference', 'pair', '{a} requested a character reference. {b} began with the phrase “technically house-trained.”',
        line(0, 'Say something nice about me.'), line(1, 'It remains the same height.'), line(0, 'We are putting that on the application.'))
    ] },
  { kind: 'pair', title: 'Neighbourly business', propKind: null, minActors: 2,
    requirements: 'Two awake residents within two spaces on the same row. Mood, compatibility and a remembered disagreement choose the scene.',
    variants: [
      variant('pair:comfort-tea', 'comfort', 'The imaginary cup', 'comfort', '{a} sat beside {b} and offered an imaginary cup. The company was real.',
        line(0, 'I have brought you something warm.'), line(1, 'There is no cup.'), line(0, 'Then you need not wash it.')),
      variant('pair:comfort-silence', 'comfort', 'Quietly, for once', 'comfort', '{a} kept {b} company without offering advice. Both noticed the effort.',
        line(0, 'I can sit here without making a point.'), line(1, 'That would be new.'), line(0, 'I am practising.')),
      variant('pair:argument-border', 'argument', 'A border dispute', 'argument', '{a} and {b} disagreed over an inch of shelf. Neither gained any shelf.',
        line(0, 'You are on my side.'), line(1, 'I am on my own underside.'), line(0, 'Your underside is provocative.')),
      variant('pair:argument-breath', 'argument', 'The volume of breathing', 'argument', '{a} asked {b} to exist more quietly. The request remains under review.',
        line(0, 'Must you do that so loudly?'), line(1, 'I am sitting.'), line(0, 'Exactly.')),
      variant('pair:makeup-crumb', 'makeup', 'A crumb between parties', 'makeup', '{a} and {b} set aside their recent shelf dispute. Larger grievances kept their own files.',
        line(0, 'I may have overstated the matter of the inch.'), line(1, 'I may have occupied it rather loudly.'), line(0, 'We shall blame the crumb.')),
      variant('pair:makeup-weather', 'makeup', 'A smaller apology', 'makeup', '{a} offered {b} a small apology for their last exchange. It fitted in the gap between them.',
        line(0, 'About what I said. The shelf was draughty.'), line(1, 'The shelf has no draught.'), line(0, 'Then this may actually be an apology.'))
    ] }
];

export const SHELF_SCENE_BY_KIND = Object.fromEntries(SHELF_SCENES.map(scene => [scene.kind, scene]));
export const SHELF_SCENE_VARIANTS = Object.fromEntries(SHELF_SCENES.flatMap(scene => scene.variants.map(item => [item.id, { ...item, kind: scene.kind }])));

/* Shelf Court twists, slice B: cases 12 to 23 of COURT_CASES.
   Each case gets one alternate truth. The opening statements are shared with
   the base case; the testimony, the case notes, the rulings and the hallway
   lines change. See the schema notes in the Court engine for the shape. */
import { alt } from './court.js';

export const TWISTS_B = {
  'loaned-leg': [{
    id: 'staked-leg', title: 'The Leg Was the Stake', truth: 'defendant',
    turn: alt([
      ['bailiff', 'Your Honour, a slip of paper has fallen out of {p}’s sock.'],
      ['judge', 'What does it say?'],
      ['bailiff', '“Three to one.” I do not think that is a lending form.']
    ], [
      ['narrator', '(A ghost in a flat cap in the gallery quietly folds up a sheet headed SACK RACE: FINAL ODDS, and leaves.)'],
      ['judge', 'Who was that?'],
      ['bailiff', 'Nobody, Your Honour. A bookmaker. He comes to everything.']
    ]),
    questions: {
      0: { herring: 'The leg has a name tape sewn in the top. It says {p}. So it is {p}’s leg, and that is that.', lines: alt([
        ['judge', '{d}. Whose name is on the leg?'],
        ['narrator', '(The bailiff folds back the top of the leg. Sewn inside, like a school jumper, is a neat name tape. It says {p}.)'],
        ['d', 'Of course it says {p}. People put their names on things they are about to lose. It is the first sign.']], [
        ['narrator', '(The bailiff folds back the top of the leg. Inside is a name tape, sewn on beautifully. It says {p}.)'],
        ['p', 'My mother sewed it in. She sewed one into everything. It is why I have never lost a sock.'],
        ['judge', 'You have lost a leg, {p}.'],
        ['p', 'That is not losing. That is lending. There is paperwork.']]) },
      1: { clue: 'Sir Reginald stewarded the race. {p} staked its own left leg on winning, shook on it, and lost to {d} by eleven minutes.', lines: alt([
        ['npc', 'I stewarded the sack race. At the start line {p} said it would win, and shook on it, with its left leg as the stake. Three to one.', 'cat'],
        ['judge', 'And did {p} win?'],
        ['npc', '{p} fell out of the sack at the first yard to wave at someone it knew. It was a coat stand. {d} won by eleven minutes.', 'cat']], [
        ['npc', 'I took the stakes at the start, Your Honour. {p} put up its left leg. {d} put up a biscuit.', 'cat'],
        ['judge', 'A leg against a biscuit?'],
        ['npc', '{p} said it was a very good biscuit. {p} said it twice. Then it came last in a race of two. I have the chart. It is a very short chart.', 'cat']]) },
      2: { lines: alt([
        ['narrator', '({d} strides to the bench, turns on a coin, and strides back. It is, by some distance, the best anybody has ever walked in this courtroom.)'],
        ['judge', 'That leg is very much at home, {d}.'],
        ['p', 'IT NEVER WALKED LIKE THAT FOR ME.'],
        ['d', 'It never had a medal for you.']], [
        ['narrator', '({d} walks to the bench and back in a perfect straight line. Halfway, the leg breaks into a little skip of its own. {d} lets it.)'],
        ['judge', 'Does it do that often?'],
        ['d', 'Only at the sound of a bell, Your Honour. It associates bells with winning.'],
        ['narrator', '(The bailiff rings his little bell. The leg skips again. {p} sits down on the floor.)']]) },
      3: { sass: true, lines: alt([
        ['judge', '{p}. You staked a leg on a race that begins with climbing into a bag. The bag was a warning. The sport was trying to tell you something.'],
        ['p', 'I had a good feeling.'],
        ['judge', 'You had two legs, {p}, and you spent one of them on a feeling.']], [
        ['judge', '{p}, in 1702 I staked my entire body on a coin toss. I was very sure. It was a Tuesday.'],
        ['p', 'What happened?'],
        ['judge', 'Look around.']]) },
      4: { clue: 'The winner’s medal is engraved “PRIZE: ONE LEG, THE LOSER’S”, signed at the start line by both of them.', lines: alt([
        ['d', 'Light training, Your Honour. A jog on Tuesdays. It sleeps with the medal tucked under its knee.'],
        ['narrator', '(The bailiff takes the medal and reads the back. It is engraved: “WINNER TAKES THE LOSER’S LEG. SIGNED: {p}. SIGNED: {d}.”)'],
        ['judge', '{p}. Is that your signature?'],
        ['p', 'It is a signature. It is not a CONSENTING signature.']], [
        ['d', 'It rests in the mornings, Your Honour. In the afternoons it shows people its medal.'],
        ['narrator', '({d} turns the medal over. Engraved on the back: “PRIZE: ONE LEG (THE LOSER’S). SIGNED, {p}. SIGNED, {d}. WITNESSED, A CAT.”)'],
        ['judge', '{p}, is that your signature?'],
        ['p', 'I WAS EXCITED. I SIGN THINGS WHEN I AM EXCITED. I ONCE SIGNED FOR A SOFA.']]) },
      5: { clue: '“BACK BY TEATIME. PROMISE.” is upside down on {p}’s leg: {p} wrote it itself, looking down, with the pen from its own sock.', lines: alt([
        ['p', 'There was, Your Honour. {d} wrote it on my other leg, so I would not lose it.'],
        ['narrator', '({p} holds up its other leg. In felt pen: “BACK BY TEATIME. PROMISE.” The writing is upside down. So is the smiley face.)'],
        ['bailiff', 'Written by a very tall person, Your Honour.'],
        ['judge', 'Written by somebody looking down at their own leg, Bailiff. That is a felt pen sticking out of {p}’s sock.'],
        ['p', 'It is for emergencies.']], [
        ['p', 'In writing, Your Honour. On my other leg. {d} did it.'],
        ['narrator', '({p} bends to show the court and has to be helped up. The note is upside down. The bailiff stands on his head to read it.)'],
        ['bailiff', 'It is a promise, Your Honour. I would know. I am upside down.'],
        ['judge', 'It is upside down because {p} wrote it looking at its own knee, Bailiff. Nobody else could reach.'],
        ['narrator', '({p} lowers the leg. A felt pen rolls out of its sock. Nobody mentions it.)']]) }
    },
    rulings: {
      plaintiff: alt([
        ['judge', 'Judgment for {p}. A leg lent is a leg owed. The court ignores the medal, the signature and the promise written upside down.'],
        ['d', 'The WHAT?'],
        ['judge', 'You heard me. I am being generous. I will regret it by teatime.']], [
        ['judge', 'Judgment for {p}. The leg goes home tonight, medal and all.'],
        ['narrator', '(That evening {p} gets both legs back. The leg walks in a straight line. {p} walks in a circle. They set off in opposite directions and are some time apart.)']]),
      defendant: alt([
        ['judge', 'Judgment for {d}. The leg was staked, lost and signed away at the start line, with a cat for a witness. {p}, you did not lend a leg. You lost a leg, and then you lent a story.'],
        ['p', 'May I at least visit it?'],
        ['judge', 'You may, {p}. You will have to hop, but you are used to that. Be back by teatime.']], [
        ['judge', 'Judgment for {d}. Stakes were laid, a cat took them, and {p} signed twice: once on the medal and once, very helpfully, on its own knee. I have rarely seen a loser so thorough about its own paperwork.'],
        ['narrator', '({d} leaves, walking in a perfect straight line. {p} watches it go. At the door the leg turns round and gives a small wave.)']]),
      both: alt([
        ['judge', 'You are both gamblers, which is the worst thing I can say about anyone, after “writer”.'],
        ['judge', 'The leg goes into the court’s safe keeping until one of you can prove it was not a bet. The bailiff will guard it.'],
        ['bailiff', 'I shall be extremely careful, Your Honour. I have never bet on anything. Apart from the leg. Just now. Four raisins.']], [
        ['judge', 'You are both beyond help. One of you staked a leg. The other won one and is walking round my courtroom like a man who has just bought a car.'],
        ['judge', 'Case dismissed. Go away and think about what you have done. One of you may do it on one leg.']])
    },
    hallway: {
      p: ['In my defence, I was winning until the coat stand.',
        'The leg and I had a good run. Four yards. I think about them often.',
        'Next year I’m entering again and staking the other leg. I can’t lose twice. I’ve done the sums with the cat.'],
      d: ['It fits like it was made for me. It was made for {p}, but I’ve never let that stop me.',
        'I don’t gloat. I just skip at the door. The leg insists.',
        'Next up, the three-legged race. I already own one and a half.']
    }
  }],
  'stolen-dust': [{
    id: 'late-mr-widow', title: 'Mr Widow Has Been Settling', truth: 'both',
    turn: alt([
      ['narrator', '(The jar of dust is carried in. In the gallery, Mrs Widow stands up, sits down, and takes out a handkerchief for no reason she can name.)'],
      ['judge', 'Mrs Widow, is something the matter?'],
      ['npc', 'It is only that I have not felt this peculiar since 1946, dear.', 'widow']
    ], [
      ['narrator', '(The bailiff sets the jar on the bench. The dust inside rearranges itself, faintly, into a moustache. Nobody is sure.)'],
      ['bailiff', 'It is only a draught, Your Honour.'],
      ['judge', 'Draughts do not do moustaches, Bailiff.']
    ]),
    questions: {
      0: { herring: '{d} is grey and {p} is spotless, so {d} wore {p}’s dust. Case closed for {p}.', lines: alt([
        ['narrator', '(The bailiff runs a finger down {d}’s back. It comes away grey. Underneath, {d} is spotless.)'],
        ['bailiff', 'It smells of pipe tobacco, Your Honour. And a little of sherry.'],
        ['judge', '{d}. Do you smoke a pipe?'],
        ['d', 'It is a very distinguished complexion.']], [
        ['narrator', '(The bailiff rubs a thumb along {d}’s arm. The grey comes off in a long stripe. Underneath, {d} is spotless and faintly pink.)'],
        ['judge', '{d}, you are wearing this.'],
        ['d', 'I am wearing it SPARINGLY.'],
        ['bailiff', 'There is a gentleman’s feel to it, Your Honour. I find I keep saying “after you”.']]) },
      1: { clue: 'Geoffrey says the dust landed on {p} in 1946, out of an urn on Mrs Widow’s mantel. The label read MR WIDOW.', lines: alt([
        ['npc', 'My grandfather was there when it arrived, Your Honour. 1946. An urn on the next shelf went over in a draught, and the contents came down on {p}.', 'woodlouse'],
        ['judge', 'The contents.'],
        ['npc', 'The label said MR WIDOW, and underneath, DO NOT SHAKE. My grandfather built a small chapel on the left shoulder.', 'woodlouse']], [
        ['npc', '1946, Your Honour. Mrs Widow’s mantel. The urn went over in a draught and what was inside settled on {p} like a snowfall.', 'woodlouse'],
        ['judge', 'What was inside?'],
        ['npc', 'It had a name on the side. We have been very careful since. We do not walk on him. We go round.', 'woodlouse']]) },
      2: { clue: '{d} swept the dust into a jar to claim Mrs Widow’s reward for her husband, missing since 1946: two souls, no questions.', lines: alt([
        ['d', 'A soft brush. A jar. A lid. And a notice from the shop window, which I kept very safe.'],
        ['narrator', '({d} produces a yellowed poster: “MISSING SINCE 1946: ONE HUSBAND, GREY, FORMERLY DISTINGUISHED. REWARD: TWO SOULS. NO QUESTIONS.”)'],
        ['judge', 'And you thought {p}’s dust was Mr Widow.'],
        ['d', 'I thought it was grey, Your Honour, and I thought two souls was two souls.']], [
        ['bailiff', 'There is a poster in {d}’s pocket, Your Honour. “MISSING SINCE 1946: ONE HUSBAND. REWARD: TWO SOULS.”'],
        ['judge', 'And what did you use for the dusting, {d}?'],
        ['d', 'A soft brush, a jar and a lid. I keep him fresh.'],
        ['judge', 'Him.'],
        ['d', 'It. I keep IT fresh. It is a turn of phrase.']]) },
      3: { sass: true, lines: alt([
        ['judge', 'Dust is usually uninvited, {p}. It arrives, it settles, and it will not leave a room.'],
        ['p', 'Mine used to apologise.'],
        ['judge', 'Then it is the only dust in history to have been brought up properly.']], [
        ['judge', '{p}, dust is not a personality.'],
        ['p', 'Mine lifted its hat to the moth.'],
        ['judge', 'Dust does not lift a hat.'],
        ['p', 'This one did, Your Honour. Every morning. It is why I did not like to shake it.']]) },
      4: { clue: '{p} knew the dust was Mr Widow and never told her. She has lived two inches away since 1946.', lines: alt([
        ['p', 'A crumb from 1964. The lid of a biro. A sequin. Geoffrey. Geoffrey’s furniture. And a gentleman.'],
        ['judge', 'A gentleman.'],
        ['p', 'Left shoulder. Very quiet. Excellent posture for a heap.'],
        ['judge', 'And you did not think to mention him to Mrs Widow, who has been looking for him for eighty years?'],
        ['p', 'She never asked, Your Honour. She only ever asked about the urn.']], [
        ['p', 'A crumb. A stamp. A sequin. A very small door. And Mr Widow.'],
        ['judge', 'You knew it was Mr Widow.'],
        ['p', 'It was on the label, Your Honour. I am not a monster. I read the label.'],
        ['judge', 'Mrs Widow lives two inches from you.'],
        ['p', 'And not once did she say “have you seen my husband”. It would have been so easy.']]) },
      5: { lines: alt([
        ['d', 'Gravitas, Your Honour. And, I will admit, a reward. But mostly gravitas. He has such a lovely voice.'],
        ['judge', 'The dust has a voice.'],
        ['d', 'Only at night. It does a very fine “harrumph”.'],
        ['p', 'HE HARRUMPHED FOR ME FIRST.']], [
        ['d', 'Company, Your Honour. Eighty years of dust is a great deal of company, and this one tells wonderful stories about the war.'],
        ['judge', 'Which war?'],
        ['d', 'He is not sure. He was mostly a cricket man.'],
        ['p', 'HE WAS MY CRICKET MAN.']]) }
    },
    rulings: {
      plaintiff: alt([
        ['judge', 'Judgment for {p}. {d} puts back every speck tonight, including the ones that smell of pipe.'],
        ['d', 'Of what?'],
        ['judge', 'The court has made a note of it, {d}. The court does not yet know why.']], [
        ['judge', 'Judgment for {p}. The dust goes back, grey side up.'],
        ['narrator', '(By morning it is back. {p} sleeps beautifully. Something on the left shoulder clears its throat, and nobody mentions it.)']]),
      defendant: alt([
        ['judge', 'Judgment for {d}. {p} looks better for it, and the dust looks better on {d}, which is a rare compliment to the dust.'],
        ['d', 'Thank you, Your Honour.'],
        ['judge', 'I was not talking to you. I was talking to the dust.']], [
        ['judge', 'Judgment for {d}. The dust was swept up, jarred and paid for, and what a person does with its own jar is its own business.'],
        ['narrator', '(In the gallery, Mrs Widow dabs her eyes with the handkerchief. She still cannot say why.)']]),
      both: alt([
        ['judge', 'You are both guilty, and you have both been sitting on a man.'],
        ['judge', '{p}, for eighty years of keeping quiet. {d}, for putting a husband in a jam jar and calling him fresh. Mr Widow goes home to Mrs Widow tonight, and somebody opens a window, because he has been asking.'],
        ['narrator', '(The jar is carried out. The dust inside lifts its hat.)']], [
        ['judge', 'You are both disgraceful. One of you let a widow look for her husband for eighty years while he lay two inches away, getting on its nerves. The other jarred him for a reward.'],
        ['judge', 'Mrs Widow gets her husband. {d} gets no reward. {p} gets dusted, thoroughly, by the bailiff.'],
        ['bailiff', 'I shall use the soft brush, Your Honour. And I shall say “after you” to every speck.']])
    },
    hallway: {
      p: ['In my defence, he never said a word. Eighty years. I assumed he was happy.',
        'I miss him on my left shoulder. He kept the draughts off. Now there is nothing between me and the moth.',
        'Mrs Widow has asked me to tea. I don’t think I can face a woman who knows I sat on her husband.'],
      d: ['It was a perfectly good jar. I have had to rinse it twice. He would not come out of the lid.',
        'He said “after you” to me once, in the dark, from the jar. I am a changed person. I let people through doors now.',
        'The reward was two souls, no questions. The questions were free, and I have had a great many today.']
    }
  }],
  'jumble-pulse': [{
    id: 'dinging-pulse', title: 'The Pulse That Dinged', truth: 'plaintiff',
    turn: alt([
      ['narrator', '(Somewhere near {d}, a very small bell goes ding. {d} coughs over it, a beat too late.)'],
      ['judge', 'What was that?'],
      ['d', 'A hiccup, Your Honour.'],
      ['judge', 'A hiccup that rings.']
    ], [
      ['narrator', '(The studio clock chimes the hour. A moment later, from inside {d}, comes a tiny, polite echo.)'],
      ['bailiff', 'Did that clock just get an answer, Your Honour?']
    ]),
    questions: {
      0: { clue: 'Mrs Widow found {d}’s pulse in her jumble box on Tuesday, shaken out of a sleeping resident. Her husband’s is in her sewing box.', lines: alt([
        ['npc', 'I sold {d} a pulse on Wednesday, dear. Two souls. I said it was my late husband’s.', 'widow'],
        ['judge', 'And was it?'],
        ['npc', 'His is in my sewing box, dear, waltzing. This one I found on Tuesday, ticking, in the jumble box under a wig.', 'widow'],
        ['judge', 'Then why say it was your husband’s?'],
        ['npc', '“Late husband” sells, dear. A found pulse is one soul. I am a businesswoman.', 'widow']], [
        ['npc', 'My husband still has his, dear. In the sewing box. It keeps time to the wireless.', 'widow'],
        ['judge', 'Then what did you sell {d}?'],
        ['npc', 'It fell out of a resident asleep in my jumble box, on Tuesday, when I shook the box for the spoons.', 'widow'],
        ['judge', 'And you did not hand it back?'],
        ['npc', 'It was ticking so nicely, dear. And there was a name in it, but I am short-sighted. It looked like “two souls”.', 'widow']]) },
      1: { clue: '{d}’s pulse ticks and dings on the hour, exactly as {p} says its own did. A late husband’s would not.', lines: alt([
        ['narrator', '(The bailiff holds {d}’s wrist and counts, moving his lips. Somewhere inside {d}, a clock begins to strike three.)'],
        ['bailiff', 'Tick. Tick. Tick. Ding, Your Honour.'],
        ['judge', 'Ding.'],
        ['bailiff', 'Once on the hour, very politely. Like a conscience.']], [
        ['narrator', '(The bailiff holds {d}’s wrist. After a moment there is a tiny ding, and {d} looks hard at its feet.)'],
        ['bailiff', 'Tick, tick, tick, ding, Your Honour. On the hour.'],
        ['d', 'That is the waltz, Your Honour. It is a very formal waltz.'],
        ['judge', 'Waltzes do not ding, {d}. Doorbells ding.']]) },
      2: { herring: 'Inside {p} is a pocket watch, swallowed in 1896. Perhaps the “pulse” was only the watch, and it ran down.', lines: alt([
        ['narrator', '(The bailiff holds {p} up to the studio light. Inside, clear as anything, is a small pocket watch, stopped at ten past four.)'],
        ['judge', '{p}. Why is there a watch in you?'],
        ['p', '1896, Your Honour. A Sunday. I thought it had gone through.'],
        ['judge', 'Through what?'],
        ['p', 'Me, Your Honour. That is what the rest of me is for.']], [
        ['narrator', '(The bailiff holds {p} up to the light. Inside, where a heart would go, is a little pocket watch, stopped at ten past four.)'],
        ['judge', '{p}. What is that?'],
        ['p', 'A watch, Your Honour. I swallowed it in 1896. I always meant to mention it.'],
        ['bailiff', 'There is your ticking, Your Honour. A watch that has run down.']]) },
      3: { clue: '{p} says its pulse ticked and dinged once an hour, and that the watch inside it has never ticked. “I have shaken it.”', lines: alt([
        ['p', 'Tick. Tick. Tick. And once an hour, very quietly, a little ding.'],
        ['judge', 'A ding.'],
        ['p', 'I always thought it was my conscience.'],
        ['judge', 'And the watch you swallowed?'],
        ['p', 'Never ticked once, Your Honour. I have shaken it. I have asked it nicely.']], [
        ['p', 'Tick, tick, tick, and then a ding on the hour. You could set a watch by it.'],
        ['judge', 'You have a watch in you, {p}.'],
        ['p', 'It has said ten past four since 1896, Your Honour. I would not set anything by it. I set my life by the other one.']]) },
      4: { sass: true, lines: alt([
        ['judge', '{p}, nobody on this shelf needs a pulse. You cannot die. What would you do with it?'],
        ['p', 'Listen to it.'],
        ['judge', 'That is the saddest thing I have heard today, and I have heard the adverts.']], [
        ['judge', '{p}, I have not had a pulse since 1702. People assume I am angry. I am simply not beating.'],
        ['p', 'Does it get easier?'],
        ['judge', 'No. But you stop checking.']]) },
      5: { lines: alt([
        ['jury', '{j} checks its wrist, then its neck, then, to be thorough, under its hat. Nothing. A button.'],
        ['judge', 'So the only pulse in this courtroom is in {d}.'],
        ['narrator', '(On the hour, politely, from {d}: ding.)'],
        ['p', 'THAT IS MY DING.']], [
        ['jury', '{j} puts two fingers to its own neck, frowns, and moves them to the juror next to it, who is very embarrassed.'],
        ['judge', 'Anything?'],
        ['jury', 'Only {d}, Your Honour. It dings.'],
        ['p', 'IT DINGS FOR ME.']]) }
    },
    rulings: {
      plaintiff: alt([
        ['judge', 'Judgment for {p}. The pulse ticks, it dings on the hour, and it was shaken out of a sleeping resident by a widow with a wig. That is not a jumble sale. That is a mugging with spoons.'],
        ['judge', '{d} hands it back. Mrs Widow refunds {d}, less one soul for “late husband”.'],
        ['narrator', '({p} holds the pulse to its chest. It dings. {p} says “that is my conscience”, and the whole gallery says “aww”.)']], [
        ['judge', 'Judgment for {p}. A pulse that dings is a pulse that belongs to somebody. I have never met two people with the same conscience.'],
        ['judge', '{d} returns it tonight. Mrs Widow returns {d}’s souls, with an apology, and keeps the wig.'],
        ['narrator', '(That night, in {p}’s slot, something goes tick, tick, tick, ding. {p} sleeps like a baby for the first time since 1896. The watch continues to say ten past four.)']]),
      defendant: alt([
        ['judge', 'Judgment for {d}. The pulse was bought in good faith, in a box, with a wig. {p}, you swallowed a watch, and I think that is what you were hearing.'],
        ['p', 'It DINGS.'],
        ['judge', 'So does the bailiff’s stomach, and nobody is suing for that.']], [
        ['judge', 'Judgment for {d}, who bought a pulse from a widow in good faith. {p} has a watch. Wind it and be grateful.'],
        ['narrator', '(The bailiff winds {p}. Somewhere inside, something goes tick. It has never gone tick before. {p} looks very surprised, and so does the watch.)']]),
      both: alt([
        ['judge', 'You are both muddled. The pulse is a pulse, the watch is a watch, and the only person here who knows the difference is Mrs Widow, and she is selling both.'],
        ['judge', 'The pulse goes to the court until you stop arguing about your insides.']], [
        ['judge', 'You are both wrong about your insides, and I am wrong about mine, and the bailiff has no idea.'],
        ['bailiff', 'I have a toffee in there, Your Honour.'],
        ['judge', 'Thank you, Bailiff. That is exactly the standard of evidence we have reached.']])
    },
    hallway: {
      p: ['It dings again. Every hour. I had forgotten how much I missed being told.',
        'I have forgiven Mrs Widow. I have not forgiven the wig.',
        'I still have the watch. It is right twice a day. It is the only part of me that is.'],
      d: ['I had a pulse for a week. I would have given it back if anyone had asked. Nobody asked. Mrs Widow sent a bill.',
        'It dinged at the wrong moment. Every hour. Always in the middle of something I was saying.',
        'Two souls for a pulse and I did not even get the wig.']
    }
  }],
  'museum-piece': [{
    id: 'staged-alibi', title: 'The Staged Alibi', truth: 'both',
    turn: alt([
      ['narrator', '(The studio camera swings round to {p} and stays there, red light on. {p} adjusts an imaginary tie.)'],
      ['judge', '{p}, why are you smiling?'],
      ['p', 'I am not smiling, Your Honour. This is my worried face.']
    ], [
      ['bailiff', 'Your Honour, {p} and {d} have both asked which of them is on the left side of the screen.'],
      ['judge', 'Which side is better?'],
      ['bailiff', 'The left, Your Honour. They have been practising.']
    ]),
    questions: {
      0: { clue: 'The letter asking the museum to display {d} was written by {p}. P.S. “It will need a really good alibi.”', lines: alt([
        ['d', 'A glass case. Locked. A little card, and a rope. A very nice curator, who wrote to me first.'],
        ['narrator', '({d} produces a carbon copy of a letter to the museum, asking them to take in one unknown creature, c. 1740, for a week. It is signed {p}. Underneath: “P.S. It will need a really good alibi.”)'],
        ['judge', '{p} wrote to a museum to have the defendant put behind glass.'],
        ['p', 'Nobody remembers who did it, Your Honour. They remember the alibi.']], [
        ['judge', 'How did you come to be in the museum, {d}?'],
        ['d', 'By invitation, Your Honour. A letter. It said I had “the look of a c. 1740”.'],
        ['narrator', '(The bailiff takes the letter and turns it over. On the back, in pencil: “P.S. WITH A REALLY GOOD ALIBI. LOVE, {p}.”)'],
        ['judge', '{p}. You wrote to a museum to have your own defendant displayed.'],
        ['p', 'It is a very good alibi. Nobody can say it is not.']]) },
      1: { herring: 'Susan, in the next case along, says {d} did not move all week, so {d} is innocent and {p} did it alone.', lines: alt([
        ['npc', 'I was in case fourteen. {d} was in case thirteen. Nobody moved all week.', 'susan'],
        ['judge', 'Not at all?'],
        ['npc', '{d} muttered. All week. “I was in a museum. I have a card.” In different voices. A deep one, an indignant one, a slightly tearful one.', 'susan'],
        ['judge', 'It was rehearsing.'],
        ['npc', 'I thought it was meditation. I gave it a mark out of ten.', 'susan']], [
        ['npc', 'Case thirteen, Your Honour. It did not move once. Not for the school trip, not for the licking. A natural.', 'susan'],
        ['judge', 'And at night?'],
        ['npc', 'I sleep at night, Your Honour. It is a museum. Sleeping is the exhibit.', 'susan']]) },
      2: { clue: 'The Lamp says {p} is wide awake at three, with a ruler and a chart. It pushes the bed exactly one inch, then ticks a box.', lines: alt([
        ['npc', 'Every night at three, {p} gets up, takes out a ruler, pushes the bed exactly one inch, and ticks a little chart.', 'lamp'],
        ['judge', 'Is {p} asleep?'],
        ['npc', 'It is looking straight at me, Your Honour. It winks. I assumed it was a sleepwalking thing.', 'lamp'],
        ['judge', 'And you said nothing?'],
        ['npc', 'I did not want it to stop.', 'lamp']], [
        ['npc', 'Three o’clock every night. {p} climbs out, measures, shoves the bed one inch and writes it in a little book. Then it checks my bulb to see if I am looking.', 'lamp'],
        ['judge', 'Are you looking?'],
        ['npc', 'I am a lamp, Your Honour. I am always looking. I am physically unable to blink.', 'lamp'],
        ['judge', 'So {p} is not asleep.'],
        ['npc', 'Not unless it sleepwalks with a pencil behind its ear.', 'lamp']]) },
      3: { clue: 'The bed has moved exactly one inch every night, to the hair. Sleepwalkers wobble. This is a schedule.', lines: alt([
        ['bailiff', 'Seven inches, Your Honour. Exactly. One inch a night, to the hair. No wobble.'],
        ['judge', 'And what does that tell us?'],
        ['bailiff', 'That {p} is the neatest sleepwalker in history, Your Honour. Or not asleep.'],
        ['judge', 'Bailiff, that is the first sensible thing you have said since 1998.'],
        ['bailiff', 'Thank you, Your Honour. I did not mean it.']], [
        ['bailiff', 'Seven inches, Your Honour. One a night. Dead straight, dead regular. There is not a single drift.'],
        ['judge', 'Sleepwalkers drift, Bailiff. They bump into things. They wander off and stand in a corner looking at the wall.'],
        ['bailiff', 'I do all of those, Your Honour. Every night. I am not asleep.'],
        ['judge', 'No, Bailiff. You are just like that.']]) },
      4: { sass: true, lines: alt([
        ['judge', '{d}. A week in a museum is not an alibi. It is a holiday with a rope.'],
        ['d', 'It was very restful.'],
        ['judge', 'Of course it was. Nobody has ever asked anything of you behind glass.']], [
        ['judge', '{p}, an inch a night. In seven nights you have moved a bed the length of a pencil. At this rate I will be dead twice before you reach the lamp.'],
        ['p', 'Somebody ELSE is moving it.'],
        ['judge', 'Then they are extremely patient, which is more than I can say for the audience.']]) },
      5: { lines: alt([
        ['d', 'A matchbox, Your Honour. It says SAFETY MATCHES on the lid. I would not touch it. I would not be seen near it. Not unless it were part of a plan.'],
        ['judge', 'A plan.'],
        ['d', 'A figure of speech.'],
        ['p', 'IT IS A VERY SAFE BED.']], [
        ['d', 'Cheap. Damp. It slides beautifully, Your Honour, I will give it that. An inch a night, smooth as butter.'],
        ['judge', 'How would you know how smoothly it slides?'],
        ['d', 'I have heard. From the lamp. Everybody has heard.'],
        ['p', 'YOU HAVE NEVER EVEN SEEN IT SLIDE.']]) }
    },
    rulings: {
      plaintiff: alt([
        ['judge', 'Judgment for {p}. {d} keeps its hands off the bed, and its alibi to itself.'],
        ['narrator', '(That night, at three, the bed moves one inch. {p} ticks a little chart. The lamp has stopped pretending not to see.)']], [
        ['judge', 'Judgment for {p}. The bed has moved seven inches, and somebody must pay for it. I decline to ask who is holding the ruler.'],
        ['p', 'Thank you, Your Honour.'],
        ['judge', 'I said I decline to ask. I did not say I do not know.']]),
      defendant: alt([
        ['judge', 'Judgment for {d}, whose alibi is so good it ought to be in the museum.'],
        ['p', 'I accept the verdict.'],
        ['judge', 'Of course you do, {p}. You wrote it.']], [
        ['judge', 'Judgment for {d}. A glass case, a rope, a card and a witness. It is the best alibi this court has ever heard, and I am beginning to suspect that is the problem.'],
        ['narrator', '(In the gallery a ghost says “told you”. Another ghost hands it a soul. It is not clear what they bet on.)']]),
      both: alt([
        ['judge', 'You are both frauds. One of you pushes its own bed an inch a night and calls it a crime. The other has itself put behind glass so there is a defence to be proud of.'],
        ['judge', 'You wanted a case on Shelf Court. You have one. It is the worst I have ever heard, and I have heard “the dog ate my coffin”.'],
        ['p', 'Was it good for ratings?'],
        ['judge', 'The bailiff cried. But the bailiff cries at the adverts.']], [
        ['judge', 'You staged a crime, to be tried for it, in front of an audience of ghosts. That is not justice. It is theatre, and I have been dead three hundred years and I have never been so flattered.'],
        ['judge', 'The bed is nailed down. {d} returns to the museum, where it will be labelled correctly this time.'],
        ['narrator', '(The new card reads: UNKNOWN CREATURE, c. 1740. ATTENTION-SEEKING. PLEASE DO NOT ENCOURAGE.)']])
    },
    hallway: {
      p: ['I regret nothing. We were on television. Do you know how long I have waited to be on television?',
        'The lamp was wonderful. A natural. It never missed a cue. I am sending it flowers.',
        'They have nailed the bed down. I measured it this morning. Still an inch nearer. I have no idea.'],
      d: ['A week behind glass, and they all talked about the bed. Nobody asked about the rope.',
        'I would do it again. Children pointed at me. One of them cried. It was the best week of my life.',
        'I have asked the museum for a reference. They have sent a leaflet about attention-seeking.']
    }
  }],
  'shared-headstone': [{
    id: 'washing-day', title: 'Socks on the Stone', truth: 'plaintiff',
    turn: alt([
      ['narrator', '(A very small sock drifts down from the ceiling and lands on the judge’s bench.)'],
      ['judge', 'Whose is this?'],
      ['bailiff', 'It says GEOFFREY II on the heel, Your Honour. It is not evidence. It is a sock.']
    ], [
      ['narrator', '(From under the witness stand comes the sound of someone pegging out washing, very quietly, as though the court might not notice.)'],
      ['judge', 'Bailiff. What is that?'],
      ['bailiff', 'A vest, Your Honour. Somebody has hung it on the gavel.']
    ]),
    questions: {
      0: { clue: 'There is one chisel in the evidence, under {d}’s pillow. {p}’s slot has a flask and a pencil rubber. Nothing for stone.', lines: alt([
        ['bailiff', 'One chisel, Your Honour. In {d}’s slot, under the pillow. Blunt, and white with stone dust.'],
        ['judge', 'And in {p}’s slot?'],
        ['bailiff', 'A flask, Your Honour, a half-eaten sandwich, and a sign that says BACK IN FIVE MINUTES. It has been up since Tuesday.'],
        ['d', 'It is a very ordinary chisel. I sleep with it for the company.']], [
        ['bailiff', 'Only one chisel, Your Honour. Under {d}’s pillow. In {p}’s slot I found a flask, a deckchair and a pencil rubber.'],
        ['judge', 'What is the rubber for?'],
        ['p', 'Crosswords.'],
        ['judge', 'Nobody has ever taken a name off a stone with a rubber, {p}.'],
        ['bailiff', 'I tried it, Your Honour. It took off a bit of moss and the whole of my afternoon.']]) },
      1: { clue: 'Geoffrey the Second hung his washing across {d}’s name on Tuesday. It was never scratched off. The chisel came on Wednesday.', lines: alt([
        ['npc', 'I live under that stone, Your Honour. Tuesday was washing day. I hung my line across the front, because it gets the sun.', 'geoffrey2'],
        ['judge', 'Across which part?'],
        ['npc', 'Across {d}, Your Honour. All of the name. Four pairs of socks and a vest. It looked like a blank. It was not a blank. It was washing.', 'geoffrey2'],
        ['judge', 'And the next day?'],
        ['npc', 'The next day, somebody took a chisel to {p}. I was inside. It sounded like a woodpecker with a grudge.', 'geoffrey2']], [
        ['npc', 'Tuesday was my day for washing, Your Honour. Very breezy. I pegged it out across the front of the stone.', 'geoffrey2'],
        ['judge', 'Across what?'],
        ['npc', 'Across {d}. Every letter. I took it in at teatime, but {d} had already been round. It must have seen the socks and not read behind them.', 'geoffrey2'],
        ['judge', 'So {d}’s name was never scratched off.'],
        ['npc', 'It was never scratched, Your Honour. It was a bit damp.', 'geoffrey2']]) },
      2: { herring: '{p} “tidied” the stone on Tuesday night to “make room”. That sounds like a name coming off first.', lines: alt([
        ['judge', '{p}. Did you touch the stone on Tuesday?'],
        ['p', 'I tidied, Your Honour. I made some room.'],
        ['judge', 'Room for what?'],
        ['p', 'For a bigger me. I was going to have my name done in gold leaf. I got as far as the quote.']], [
        ['judge', '{p}. What did you do to the stone on Tuesday night?'],
        ['p', 'Nothing. I polished the dove.'],
        ['judge', 'With what?'],
        ['p', 'A cloth.'],
        ['bailiff', 'A sock, Your Honour. A blue one. It says GEOFFREY II on the heel.']]) },
      3: { sass: true, lines: alt([
        ['judge', 'Neither of you is going to die. You have taken out a mortgage on a hole.'],
        ['d', 'It is an investment.'],
        ['judge', 'In what, {d}? Eternity does not pay interest. It just keeps going.']], [
        ['judge', 'You have two names, one dove and a very handsome font.'],
        ['d', 'It is a good font.'],
        ['judge', 'It is the font of a ransom note.']]) },
      4: { clue: '{d} admits re-cutting its own name in bold on Wednesday night. “It needed to match the dove.”', lines: alt([
        ['d', 'I paid for the dove. I chose it out of a catalogue. It is called Gordon.'],
        ['p', 'It is called Brenda.'],
        ['judge', '{d}. Why is your name in bold?'],
        ['d', 'I re-cut it on Wednesday night, Your Honour. So it would match the dove.']], [
        ['d', 'The dove is mine. Gordon is mine. I paid for him. I even gave him a small beak.'],
        ['judge', 'And what did you do to the lettering?'],
        ['d', 'I re-cut my name on Wednesday night, Your Honour, in bold, because next to Gordon it looked apologetic.'],
        ['p', 'And mine?'],
        ['d', 'Yours was in the way of the bold.']]) },
      5: { lines: alt([
        ['jury', '{j} says the top line should go to whoever has the best handwriting.'],
        ['judge', 'Which of you has the best handwriting?'],
        ['narrator', '(Both of them offer a sample. Both samples say HERE LIE. Both are signed with a flourish. The jury gives it to the dove.)']], [
        ['jury', '{j} suggests the stone is split down the middle, one name each, with the dove sitting on the join.'],
        ['judge', 'The dove is not a mediator, {j}.'],
        ['narrator', '(In the lamplight, on the stone, the dove looks slightly like a mediator.)']]) }
    },
    rulings: {
      plaintiff: alt([
        ['judge', 'Judgment for {p}. {d} found its name under a sock, mistook it for vandalism, and took it out on {p}, who was at its flask.'],
        ['judge', '{p}’s name goes back, the same size as {d}’s. And {d}’s goes back to normal size, in a font of {p}’s choosing.'],
        ['d', 'Which font?'],
        ['judge', 'Ransom note.']], [
        ['judge', 'Judgment for {p}. {d}’s name was never scratched off. It was merely damp, and wearing a vest.'],
        ['judge', '{d} will re-cut {p}’s name at its own expense, apologise to the stone, and then apologise to Geoffrey, who is owed a pair of socks.'],
        ['npc', 'Four pairs, Your Honour. And a vest.', 'geoffrey2']]),
      defendant: alt([
        ['judge', 'Judgment for {d}. {p} started it, and a name that goes missing on a Tuesday is a name that has been wronged.'],
        ['d', 'Thank you, Your Honour.'],
        ['judge', 'Do not thank me. I have a bad feeling about the washing.']], [
        ['judge', 'Judgment for {d}. You do not scratch somebody off a grave and expect them to take it lying down. That was a joke, because they do. It is a grave.'],
        ['narrator', '(Nobody laughs. The dove looks away.)']]),
      both: alt([
        ['judge', 'You are both vandals. One of you took a chisel to a friend. The other sat by with a flask while it happened and said nothing.'],
        ['judge', 'Both names go back, side by side, the same size. The dove stays in the middle to keep the peace.']], [
        ['judge', 'You are both fools. One of you assumed the worst of a sock. The other did nothing about it.'],
        ['judge', 'The names go back, the dove stays put, and the stone says HERE LIE, which has never been more accurate.']])
    },
    hallway: {
      p: ['I had nothing to do with it. I was at my flask. I have never been so innocent or so thirsty.',
        'Geoffrey and I are going halves on a washing line. Somewhere private. Not the stone.',
        'It still says HERE LIE. I have decided to take it personally. About {d}.'],
      d: ['It was washing. It was FOUR PAIRS OF SOCKS. Who hangs a vest on a grave?',
        'I have apologised to the stone. It did not say anything. It never does. That is the nice thing about a stone.',
        'Gordon has forgiven me. Brenda has not.']
    }
  }],
  'tontine': [{
    id: 'buttered-stairs', title: 'The Buttered Stairs', truth: 'defendant',
    turn: alt([
      ['narrator', '(A fine film of butter has appeared on the courtroom steps. The bailiff, arriving, goes the whole way down in one movement and comes to rest in the jury box.)'],
      ['judge', 'Bailiff?'],
      ['bailiff', 'Everything is fine, Your Honour. I have decided to sit here from now on.']
    ], [
      ['narrator', '(The Raven, in the gallery, opens a very large book, flips to a bookmark, and begins writing. It writes for some time. It looks at {p}. It writes more.)'],
      ['judge', 'What is the Raven writing?'],
      ['bailiff', 'It will not say, Your Honour. It just keeps saying “Thursday”.']
    ]),
    questions: {
      0: { clue: 'The buttons are painted in Rosy Dawn nail varnish. {p} is wearing Rosy Dawn. {d} does not own a nail.', lines: alt([
        ['narrator', '(The bailiff prises the lid off. The tin is full of buttons, each one painted to look like a sweet. The paint is a cheerful, glossy pink.)'],
        ['bailiff', 'Rosy Dawn, Your Honour. Nail varnish.'],
        ['judge', '{p}. Look at your hands.'],
        ['p', 'They are cold.'],
        ['judge', 'They are Rosy Dawn.']], [
        ['narrator', '(The bailiff eases the lid off. Buttons, painted with great care to look like sweets, in a high-gloss pink.)'],
        ['judge', 'Nail varnish. Hands up, both of you.'],
        ['narrator', '({d} holds up two plain hands. {p} holds up two hands the colour of the buttons. Slowly, {p} puts them in its pockets.)'],
        ['p', 'It is a very common shade.']]) },
      1: { clue: 'Asked what flavour the sweets were, {d} had no idea. {p} said “lemon” before it was asked, then went very pink.', lines: alt([
        ['d', 'I have no idea, Your Honour. I have never tasted one. I have never even seen one. I just have faith.'],
        ['p', 'Lemon. Slightly fizzy. They make your ears go hot.'],
        ['judge', '{p}. Nobody asked you.'],
        ['p', 'I mean I imagine. I imagine they would be lemon.']], [
        ['judge', 'What flavour were the sweets, {d}?'],
        ['d', 'I could not say, Your Honour. They have been shut in that tin since 1908. All I know is that it says ASSORTED.'],
        ['p', 'Lemon! Fizzy lemon! A bit dusty by the end, but lovely!'],
        ['judge', 'How do you know, {p}?'],
        ['p', '…It is a feeling.']]) },
      2: { herring: 'Years of scratches round the lid, and half a hairpin in the rim. The tin spends alternate months in {d}’s slot.', lines: alt([
        ['bailiff', 'Years of little scratches round the lid, Your Honour, and half a hairpin snapped in the rim. The tin spends alternate months in {d}’s slot.'],
        ['d', 'I do keep a hairpin, Your Honour. For letters.'],
        ['judge', 'And what else do you open, {d}?'],
        ['d', 'Only what I am sent.']], [
        ['bailiff', 'The lid is scratched all the way round, Your Honour, and the tin lives with {d} every other month.'],
        ['judge', '{d}. Have you been at the lid?'],
        ['d', 'I have looked at the lid, Your Honour. Long and lovingly. Looking is not opening.'],
        ['p', 'It is a very SUSPICIOUS look.']]) },
      3: { sass: true, lines: alt([
        ['judge', '{p}. The end is when the sun goes out. Then everything is dead and you still have to wait for {d}, because {d} is not dead, it is just in the dark.'],
        ['p', 'So I would win in the dark.'],
        ['judge', 'You would, {p}. You have always been good in the dark. It is where you keep your plans.']], [
        ['judge', '{p}. You have been waiting since 1908 for somebody to die on a shelf where nobody dies. That is not a bet. It is a hobby.'],
        ['p', 'It is a very good hobby.'],
        ['judge', 'It is a hobby, {p}, with a tin.']]) },
      4: { clue: 'The Raven’s log has the bet in 1908, then {p} buttering the stairs every Thursday since 1912. Nearly six thousand entries.', lines: alt([
        ['npc', 'I witnessed it. 1908. A Tuesday. They shook hands and I wrote it down.', 'raven'],
        ['judge', 'Anything since?'],
        ['npc', 'Every Thursday since 1912, {p}, with a pot of butter, on the stairs. Whistling. I write them all down.', 'raven'],
        ['judge', 'What do you write?'],
        ['npc', '“Nevermore.” It is the only word I have. I am sorry.', 'raven']], [
        ['npc', '1908, Your Honour. A Tuesday. They shook hands and I wrote it down. I have kept writing ever since.', 'raven'],
        ['judge', 'What have you written?'],
        ['npc', 'Every Thursday: “{p}. Stairs. Butter. Whistling.” Nearly six thousand entries.', 'raven'],
        ['judge', 'And you never said anything?'],
        ['npc', 'I am a raven, Your Honour. I write things down. Saying is a different department.', 'raven']]) },
      5: { lines: alt([
        ['p', 'Open it, Your Honour. Eat one. Visit {d}. Eat another.'],
        ['judge', 'You are very sure there are sweets in it.'],
        ['p', 'I have every faith in the sweets.'],
        ['d', 'I HAVE SEEN HOW YOU LOOK AT THE STAIRS.']], [
        ['p', 'I would put it on the mantelpiece, Your Honour. Unopened. As a symbol.'],
        ['judge', 'A symbol of what?'],
        ['p', 'That I won.'],
        ['d', 'OVER MY DEAD BODY. WHICH YOU KEEP ASKING FOR.']]) }
    },
    rulings: {
      plaintiff: alt([
        ['judge', 'Judgment for {p}. {d} is declared to have lost.'],
        ['narrator', '({p} opens the tin. Buttons. {p} sits very still. The bailiff puts a hand on its shoulder.)'],
        ['bailiff', 'There, there. They are lovely buttons.']], [
        ['judge', 'Judgment for {p}. The bet is won, the tin is yours, and I have a feeling about that tin that I intend to ignore.'],
        ['narrator', '({p} opens the tin. It is buttons. {p} says nothing. A cold draught blows through the courtroom, and somewhere outside, the stairs creak.)']]),
      defendant: alt([
        ['judge', 'Judgment for {d}. {p} ate the sweets in 1911, painted buttons to cover it, and has spent a century buttering the stairs so nobody would ever open the tin.'],
        ['judge', 'The tin goes to {d}, who has waited since 1908 for a lemon sweet that was never going to be there. That is not a prize. That is closure.']], [
        ['judge', 'Judgment for {d}, who has avoided the stairs for a hundred years, kept the faith, and never once opened a tin it was entitled to open.'],
        ['judge', '{p} ate the prize, painted the evidence, and spent a century trying to make {d} fall downstairs rather than own up to a lemon sweet.'],
        ['p', 'They were GOOD lemon sweets.'],
        ['judge', 'They were, {p}. That is the saddest part of this case.']]),
      both: alt([
        ['judge', 'You are both ridiculous. A bet is a bet, but nothing in a tin of travel sweets is worth a hundred years of anyone’s time.'],
        ['judge', 'The bet is cancelled. The tin goes to the bailiff.'],
        ['bailiff', 'Thank you, Your Honour. I will treat it with respect, and then I will eat it.']], [
        ['judge', 'You are both tiresome. The bet stands, the tin is confiscated, and the stairs are to be sanded by whichever of you has been up and down them most.'],
        ['d', 'I avoid the stairs, Your Honour.'],
        ['judge', 'Then you will have nothing to sand, {d}, and I will have a very pleasant afternoon.']])
    },
    hallway: {
      p: ['Sweets go missing over a hundred years. It is a documented phenomenon. I have read the leaflet.',
        'I have taken the butter off the stairs. I have not taken it off my mind.',
        'They were very good lemon sweets. That is all I will say. That is all I have ever said, in one form or another.'],
      d: ['A hundred years, and the stairs were the problem. I have never felt so seen by a staircase.',
        'I am going to go up the stairs. Slowly. Every one. It is going to be wonderful.',
        'I have the tin. It rattles. It is the best sound I have ever heard, and I know exactly what it is.']
    }
  }],
  'borrowed-name': [{
    id: 'rented-name', title: 'The Name Was a Rental', truth: 'both',
    turn: alt([
      ['narrator', '(A rosette is carried into court on a small velvet cushion. It is pink, it is slightly sticky, and the bailiff is holding it at arm’s length.)'],
      ['judge', 'Whose is that?'],
      ['bailiff', 'It says THIRD PLACE, Your Honour. It says JAM. I have not looked any closer.']
    ], [
      ['narrator', '(Somebody in the gallery does the noise. A second somebody does it back. It begins to travel round the room like a Mexican wave of damp.)'],
      ['judge', 'Order. Order. Bailiff, who started that?'],
      ['bailiff', 'The noise started itself, Your Honour. It does that now.']
    ]),
    questions: {
      0: { herring: '{d} is banned from the fête for the tombola, so {d} took the name without asking. {p} is blameless.', lines: alt([
        ['d', 'Last year. The tombola. I would rather not go into it.'],
        ['judge', 'Go into it.'],
        ['d', 'That was the problem. I went into it. Somebody won me. They had wanted the bath salts.'],
        ['judge', 'So you needed somebody else’s name to get back in.'],
        ['d', 'It was a very reasonable offer.']], [
        ['d', 'The tombola, Your Honour. I got in and went round twice. They banned me for life. There is a photograph of me on the gate, next to the wasp.'],
        ['judge', 'So you took {p}’s name to get back in.'],
        ['d', 'I took what I was given.']]) },
      1: { lines: alt([
        ['bailiff', 'Jam competition results, Your Honour. First, Mrs Widow’s damson. Second, Mrs Widow’s other damson. Third, “{p}”.'],
        ['judge', 'What was the entry?'],
        ['bailiff', '“Raspberry, with a small creature.” The judge has written, “firm, but with a lot of feeling”.']], [
        ['bailiff', 'There were three jars, Your Honour. Two were jam. The third was labelled “FÊTE ENTRY NO. 3: {p}”, and kept trying to climb out.'],
        ['judge', 'Did it win?'],
        ['bailiff', 'It came third out of three, Your Honour, but the judges say it had the best texture.']]) },
      2: { clue: 'The Raven heard {p} shouting “get in the jar, it’s only jam!” from the lane while {d} climbed in. “Not at the fête.”', lines: alt([
        ['npc', 'I judged the jam. Three jars. I did not know there was anybody in the third one until it waved.', 'raven'],
        ['judge', 'Did anyone encourage it?'],
        ['npc', 'From the lane, outside the gate, somebody was shouting, “Get in the jar, it’s only jam!” They were not at the fête. They had a stool.', 'raven'],
        ['judge', 'Did you see who?'],
        ['npc', 'They had their name on the stool, Your Honour. In capitals.', 'raven']], [
        ['npc', 'I judged the jam, Your Honour. I lifted the lid of the third jar, and something climbed out and asked if it had placed.', 'raven'],
        ['judge', 'And did anyone cheer?'],
        ['npc', 'Somebody in the lane, with a megaphone made of a rolled-up programme. “Get in, get in, it is only JAM.” Very technically not at the fête.', 'raven'],
        ['judge', 'Who?'],
        ['npc', 'It was {p}, Your Honour. Afterwards it shouted, “THAT IS MY NAME IN THAT JAR.” With pride.', 'raven']]) },
      3: { clue: 'Four days after the fête there is still raspberry jam in {d}’s ears. {d} went into the jar itself, under {p}’s name.', lines: alt([
        ['bailiff', 'Raspberry, Your Honour. Both ears. And a pip, wedged in, holding something up.'],
        ['judge', '{d}. How did jam get in your ears?'],
        ['d', 'I went in head first, Your Honour. I was told it would be like a warm bath.'],
        ['judge', 'Was it?'],
        ['d', 'It was like a bath that wanted to be friends.']], [
        ['narrator', '(The bailiff shines a torch into {d}’s ear and leans in.)'],
        ['bailiff', 'Raspberry jam and, I think, a bit of crust, Your Honour. Very well set.'],
        ['judge', '{d}. You were in the jar.'],
        ['d', 'Under {p}’s name, Your Honour. Face up. Eyes shut. I was a very good preserve.']]) },
      4: { sass: true, lines: alt([
        ['judge', '{p}, you lent your name to the one creature on this shelf who has been in a tombola. What did you think was going to happen?'],
        ['p', 'I thought it would be treated with respect.'],
        ['judge', 'It was treated with respect. It was treated with raspberry.']], [
        ['judge', '{p}, a nickname is a compliment from people who cannot be bothered to say what they mean.'],
        ['p', 'What do they mean?'],
        ['judge', 'They mean “squelch”, {p}. It is quite direct.']]) },
      5: { clue: '{p} rented out its name for a share of the rosette, and had the rosette pinned up for four days before anyone squelched.', lines: alt([
        ['d', 'On {p}’s slot, Your Honour. Pinned up where everybody can see it. Polished daily. {p} insisted.'],
        ['judge', 'Insisted?'],
        ['d', 'It was in the agreement. Two raisins and the rosette. I got the jam.'],
        ['p', 'THEY ONLY STARTED THE NOISE WHEN THEY SMELLED IT.']], [
        ['d', 'Pinned on {p}’s slot, Your Honour, since Monday. {p} gave it a little shelf of its own, and a lamp.'],
        ['judge', 'So {p} was proud of third place.'],
        ['d', 'For four days, Your Honour. Until somebody sat down quickly.'],
        ['p', 'IT WAS A LOVELY ROSETTE UNTIL THEY DID THE NOISE.']]) }
    },
    rulings: {
      plaintiff: alt([
        ['judge', 'Judgment for {p}. A name goes back unspotted, and {d} will stand on the top shelf every morning this week and tell everyone exactly who went squelch.'],
        ['d', 'They will call ME Squelch.'],
        ['judge', 'Yes. I notice nobody has asked me about the rosette. I am noticing it very hard.']], [
        ['judge', 'Judgment for {p}. A borrowed name should come back clean.'],
        ['narrator', '(It comes back clean. For a week. Then {p} sits down at the harvest supper, and the trifle makes the noise.)']]),
      defendant: alt([
        ['judge', 'Judgment for {d}. A name lent is a name used. What it does in the jam is the name’s business.'],
        ['p', 'It is MY name.'],
        ['judge', 'And a lovely one. It came third.']], [
        ['judge', 'Judgment for {d}. {p} lent the name, {p} kept the rosette, and I will not hear a rosette-holder complain about jam.'],
        ['p', 'I never SAID I had the rosette.'],
        ['judge', 'Nobody mentioned a rosette until you did, {p}.']]),
      both: alt([
        ['judge', 'You are both to blame. {p} rented out its name for a rosette and shouted encouragement from a lane, on a stool. {d} took a borrowed name into a jar of jam, head first.'],
        ['judge', 'The name goes back, washed. The rosette is awarded to the jam, which has done the only honest work in this case.'],
        ['narrator', '(In the evidence jar, the jam wobbles with what looks very much like pride.)']], [
        ['judge', 'You are both idiots. A rental is a rental and a jam is a jam, and the two should never be mixed, as every child at a fête learns by about four.'],
        ['judge', '{p} is Squelch on weekdays. {d} is Squelch at weekends. The bailiff is Squelch on bank holidays, because I feel like it.'],
        ['bailiff', 'I accept, Your Honour. I have always wanted a title.']])
    },
    hallway: {
      p: ['I regret nothing. A rosette is a rosette. I would do the stool again.',
        'The noise only started when I sat down. So I stand now. I have never been so respected, or so tired.',
        'I’ve changed my name again. It’s a secret. I’ve rented it to someone. Don’t ask who.'],
      d: ['I was a very good preserve. Third out of three is a podium in my book.',
        'I still taste of raspberry. {p} says it’s an improvement. {p} would.',
        'I’m banned from the fête under two names now. I’ve started looking at the harvest supper.']
    }
  }],
  'runaway-rock': [{
    id: 'nine-stamps', title: 'Nine Stamps at the Fox and Hounds', truth: 'defendant',
    turn: alt([
      ['narrator', '(A very small notebook falls off the underside of Colin’s exhibit tray and lands face down. {p} walks over and stands on it.)'],
      ['judge', '{p}. What are you standing on?'],
      ['p', 'Nothing, Your Honour. I am just resting.']
    ], [
      ['bailiff', 'Your Honour, {d} has been breathing very heavily since it came in. It says it has not recovered from Friday.'],
      ['judge', 'What happened on Friday?'],
      ['bailiff', 'It will not say, Your Honour. It just keeps whispering “stay”.']
    ]),
    questions: {
      0: { herring: 'The shelf has sloped towards {d} since Thursday night. Very convenient for {d}.', lines: alt([
        ['narrator', '(The bailiff sets a marble down at {p}’s end. It sets off for {d} at once, like a marble who knows somebody there.)'],
        ['judge', 'The shelf slopes towards {d}.'],
        ['bailiff', 'Since Thursday night, Your Honour. Before that, dead level. I could have played snooker on it.'],
        ['judge', 'Did you?'],
        ['bailiff', 'I did, Your Honour. I lost. To a pencil.']], [
        ['narrator', '(The bailiff places a spirit level on the shelf. The bubble slides all the way to {d}’s end and sits there, looking pleased with itself.)'],
        ['judge', 'Since when has it been like that?'],
        ['bailiff', 'Thursday night, Your Honour. Before that the bubble sat in the middle and said nothing, like a good bubble.']]) },
      1: { clue: 'The beer mat holding up {p}’s end is {p}’s own, with {p}’s name on it. {d} has been to the pub once.', lines: alt([
        ['narrator', '(The bailiff crawls under {p}’s end of the shelf and comes out with a beer mat, folded eight times, very hard. Unfolded, it is a loyalty card.)'],
        ['bailiff', 'Fox and Hounds, Your Honour. Nine stamps out of ten. In the name of {p}.'],
        ['judge', '{p}. You have been to the pub nine times.'],
        ['p', 'You get a free half on the tenth. I was nearly there.']], [
        ['bailiff', 'A beer mat, Your Honour, folded until it is harder than the shelf. It is holding up {p}’s end.'],
        ['judge', 'Whose beer mat is it?'],
        ['bailiff', 'There is a name on the back, Your Honour. In crayon. It says “{p}’S. DO NOT MOVE”.'],
        ['p', 'Everyone has a beer mat.'],
        ['judge', 'Not everybody labels theirs, {p}.']]) },
      2: { clue: 'Geoffrey saw Colin roll past at three on Friday, with {d} sprinting after him in a nightshirt, whispering “stay, good boy, STAY”.', lines: alt([
        ['npc', 'Three on Friday morning, Your Honour. I was up with my back. Colin came rolling past my door, quite slowly, with a lot of dignity.', 'woodlouse'],
        ['judge', 'On his own?'],
        ['npc', '{d} was running after him in its nightshirt, whispering, “Stay. Good boy. STAY.” Every inch.', 'woodlouse'],
        ['judge', 'Did it catch him?'],
        ['npc', 'Eventually. It had to throw itself at the end of the shelf. I think it cried a bit. It was a terrible, very tender thing to see.', 'woodlouse']], [
        ['npc', 'I was up at three, Your Honour. Colin went past me at a steady roll. I have never seen a rock look so determined.', 'woodlouse'],
        ['judge', 'And {d}?'],
        ['npc', '{d} overtook him twice and lay down across the shelf like a speed bump. Colin went over it. {d} said “oof”, and then, “good boy”.', 'woodlouse']]) },
      3: { sass: true, lines: alt([
        ['judge', '{p}, you have owned a rock for ninety-five years. At that point it is not a pet. It is geology.'],
        ['p', 'Geology has never walked out on me.'],
        ['judge', 'Geology walks out on everybody, {p}. It just takes a few million years to find its coat.']], [
        ['judge', '{p}, a rock is the ideal pet. It does not bark, it does not shed, and it will never, ever leave.'],
        ['p', 'Exactly.'],
        ['judge', 'Which makes me wonder, {p}, what you are doing in my court.']]) },
      4: { clue: 'A notebook taped under Colin, in {p}’s hand: “Loyalty trial. Tilt the shelf. Does he stay?” The result is a drawing of a rock leaving.', lines: alt([
        ['bailiff', 'Colin is up a gram since Friday, Your Honour. That is moss. And there is a notebook taped to his underside.'],
        ['judge', 'Read it.'],
        ['bailiff', '“LOYALTY TRIAL. Tilt shelf one inch. Leave Colin at the top. Does he stay? Night one.” It is {p}’s handwriting.'],
        ['judge', 'And the result?'],
        ['bailiff', 'Underlined twice. “NO.”']], [
        ['bailiff', 'Colin weighs the same, Your Honour, plus one notebook. It was taped under him. It is in {p}’s handwriting.'],
        ['judge', 'What does it say?'],
        ['bailiff', '“TEST: does he love me enough to stay on a slope? Hypothesis: yes. Result:” And then a long gap, and a drawing of a rock rolling away, with a small cross where the heart would be.'],
        ['p', 'IT WAS A DRAFT.']]) },
      5: { lines: alt([
        ['d', 'We sit, Your Honour. We watch the door. In the evenings I tell him it was not his fault.'],
        ['judge', 'What did he do wrong?'],
        ['d', 'He rolled. He is a rock. It is what they do when they are asked a question with a hill.'],
        ['p', 'NINETY-FIVE YEARS HE DID NOT MOVE. NINETY-FIVE YEARS. AND HE PICKS THE ONE NIGHT.']], [
        ['d', 'He sits, Your Honour. I sit. We take it in turns to be the one that says nothing. He is much better at it.'],
        ['judge', 'And what do you talk about?'],
        ['d', 'His feelings, Your Honour. I do all the talking. I do all of his.'],
        ['p', 'HE DOES NOT HAVE FEELINGS. HE HAS A GRADIENT.']]) }
    },
    rulings: {
      plaintiff: alt([
        ['judge', 'Judgment for {p}. Colin goes home tonight.'],
        ['narrator', '(The bailiff carries Colin back up the shelf. By teatime Colin is at {d}’s end again. {p} sits down beside him to see what he does. Colin does what Colin does.)']], [
        ['judge', 'Judgment for {p}. Rocks do not choose, {d}. Rocks go downhill.'],
        ['d', 'Then who built the hill?'],
        ['judge', 'Nobody built the hill, {d}. A hill is a thing that happens.'],
        ['d', 'Not on a Thursday.']]),
      defendant: alt([
        ['judge', 'Judgment for {d}. {p} tilted its own shelf with a pub loyalty card, left a rock at the top of it, and wrote in a notebook how surprised it would be if he left.'],
        ['judge', 'He left. He is a rock. It is what they do when they are asked a question with a hill.'],
        ['p', 'He could have stayed.'],
        ['judge', 'He could, {p}. He is the only rock in history to be tested on his feelings, and he did what any of us would do. He went downhill.']], [
        ['judge', 'Judgment for {d}, who spent three in the morning sprinting down a shelf in a nightshirt shouting “stay” at a boulder, and has looked after the creature ever since.'],
        ['judge', '{p}, you ran a loyalty trial on a rock. The rock failed it, as rocks fail everything, by not caring. Take your nine stamps and go and have your free half.'],
        ['p', 'I have one stamp to go.'],
        ['judge', 'Then go, {p}.']]),
      both: alt([
        ['judge', 'You are both hopeless. Colin is a rock. He does not love, he does not leave, and he does not take a position on hills.'],
        ['judge', 'He will be placed on a perfectly level windowsill with a notice that says THIS ROCK IS NOT A WITNESS.'],
        ['narrator', '(The notice goes up. Colin looks, as ever, wholly unmoved.)']], [
        ['judge', 'You are both ridiculous. Colin is a rock, and you are both treating him like a witness.'],
        ['judge', 'The shelf will be levelled, the beer mat returned to the Fox and Hounds, and the case marked “gravity”.']])
    },
    hallway: {
      p: ['Ninety-five years of staying and he picks the one night. I do not think I am a person who gets to have a rock.',
        'I am one stamp from a free half. I would like to be alone with it.',
        'I have run a new trial. On myself. I have been sitting very still for an hour. It is hard. I am sorry, Colin.'],
      d: ['I sprinted down a shelf in my nightshirt for a rock. I am told it was the most athletic thing anyone has done on this shelf since 1931.',
        'I slept at the downhill end last night in case he rolled again. Nothing rolled. I have never been so disappointed to be so useful.',
        'Colin has moss and a small plaque. It says WITNESS. He is not. He looks very proud.']
    }
  }],
  'ghost-writer': [{
    id: 'unlifted-pen', title: 'The Ghost Who Could Not Hold a Pen', truth: 'plaintiff',
    turn: alt([
      ['narrator', '(The bailiff hands the judge a pen. The judge hands it back through the bailiff. The ghost in row three nods slowly, as if this proves something.)'],
      ['judge', 'What does that prove?'],
      ['bailiff', 'I would rather not say, Your Honour. I did not catch it either.']
    ], [
      ['audience', '(A ghost in row three has been trying to turn the page of a programme for ten minutes. It has given up and is now blowing on it, with great concentration.)'],
      ['judge', 'Bailiff. Why is that ghost blowing on a programme?'],
      ['bailiff', 'It is the nearest it has got to reading in two hundred years, Your Honour.']
    ]),
    questions: {
      0: { herring: 'The ghost-writer was never paid. Unpaid work goes back to the ghost, who could sell it to {d}.', lines: alt([
        ['p', 'I paid him in tea, Your Honour. A cup every Thursday.'],
        ['judge', 'Did he drink it?'],
        ['p', 'It went straight through him, so I saved on the washing up.'],
        ['judge', 'So you paid him nothing.'],
        ['p', 'A very warm saucer, Your Honour. For forty years.']], [
        ['p', 'I offered him a credit, Your Honour. On the title page.'],
        ['judge', 'What did it say?'],
        ['p', '“With thanks to a friend.” He said it was the nicest thing anyone had ever written about him. It was in my handwriting.'],
        ['judge', 'Of course it was.']]) },
      1: { clue: 'The ghost-writer’s forty years of invoices are for “sighing” and “tutting at semicolons”. He cannot lift a pen.', lines: alt([
        ['narrator', '(A ghost in row three stands up. It is holding forty years of invoices, each marked FINAL DEMAND, in fainter and fainter ink.)'],
        ['judge', 'What do the invoices charge for?'],
        ['narrator', '(The ghost: “Sighing. Tutting at semicolons. Looking over the shoulder with disappointment. It is all itemised.”)'],
        ['judge', 'You do not charge for writing.'],
        ['narrator', '(The ghost holds up a pen. It falls through the hand and sticks in the floor. “I tried in 1790,” says the ghost. “It went through. So did the ink.”)']], [
        ['narrator', '(A ghost in row three drifts forward with a bundle of invoices, forty years of them. The top one just says PLEASE.)'],
        ['judge', 'What did you do for {p}?'],
        ['narrator', '(The ghost: “I supervised.” It indicates the invoice. It reads: SUPERVISION, 40 YRS. SIGHS, 11,000. A SINGLE KIND WORD, 1 (NOT USED).)'],
        ['judge', 'Did you write a word of it?'],
        ['narrator', '(The ghost reaches for the bailiff’s pen. The pen drops straight through and lands on the bailiff’s foot. The bailiff says nothing. He has had a day.)']]) },
      2: { clue: 'The manuscript is in {p}’s own leaning hand. On page 206 there is a real crumb, exactly where the book mentions the crumb.', lines: alt([
        ['p', '“Chapter One. 1840. I arrive on the shelf. It is a Wednesday.”'],
        ['bailiff', 'Your Honour, the manuscript is in a very small handwriting that leans to the left.'],
        ['judge', 'Like {p}.'],
        ['bailiff', 'Like {p}, Your Honour. And on page two hundred and six there is a crumb.'],
        ['p', '1961. It is the same one. I put it there myself, so it would not get lost.']], [
        ['p', '“Chapter One. It is 1840. I am on the shelf. To my left, {d}. To my right, a cotton reel.”'],
        ['judge', 'The manuscript is in your handwriting, {p}.'],
        ['p', 'It is a very good copy, Your Honour. I made it for the ghost.'],
        ['judge', 'And there is a crumb on page two hundred and six.'],
        ['p', 'He did not want to touch it.']]) },
      3: { lines: alt([
        ['bailiff', 'Two copies, Your Honour. I bought one. A ghost bought the other, and asked if the author would sign it.'],
        ['judge', 'Which author?'],
        ['bailiff', 'It did not say, Your Honour. It just turned a page, which took it twenty minutes, and sighed. It was the longest sigh I have heard in a bookshop.']], [
        ['bailiff', 'Nobody is buying it, Your Honour. But a lot of people are standing near it and nodding.'],
        ['judge', 'Why?'],
        ['bailiff', 'It has a very honest cover. A chin, and the word MEMOIRS. People feel they are being told something.'],
        ['judge', 'They are being told a chin, Bailiff.']]) },
      4: { sass: true, lines: alt([
        ['judge', '{p}. Four hundred pages. I have read plenty of lives, mostly from the inside, and I have never got to the end of one by choice.'],
        ['p', 'It picks up in the three hundreds.'],
        ['judge', 'So does my blood pressure, and I do not have any.']], [
        ['judge', '{p}, a memoir is where you tell the world how interesting you were. Yours is where you tell it how still.'],
        ['p', 'I was VERY still.'],
        ['judge', 'You were exceptional. It is the one achievement in the book, and it is a competitive field.']]) },
      5: { clue: 'The Ministry of Haunting says ghosts cannot lift pens (Rule One). His licence is “Moral Support (Prose)”, unpaid by law.', lines: alt([
        ['npc', 'Ministry of Haunting. The gentleman is registered with us. Moral Support, Prose division.', 'ghost'],
        ['judge', 'Moral support.'],
        ['npc', 'Rule One, Your Honour. Ghosts cannot lift pens. Any ghost-writing done in the last two hundred years was done by a living person with somebody sitting beside them.', 'ghost'],
        ['judge', 'So {p} wrote it.'],
        ['npc', 'Every word. The ghost sat in the chair and looked as though somebody important was watching. We call it a Muse, budget tier.', 'ghost']], [
        ['npc', 'Ministry of Haunting, Your Honour. Rule One. A ghost cannot lift a pen, a spoon or a pound of butter. Anything heavier than a sigh goes straight through.', 'ghost'],
        ['judge', 'And forty years of memoirs?'],
        ['npc', 'Considerably heavier than a sigh, Your Honour.', 'ghost'],
        ['judge', 'So who wrote it?'],
        ['npc', 'Whoever was holding the pen. We find it is usually the one with the pen.', 'ghost']]) }
    },
    rulings: {
      plaintiff: alt([
        ['judge', 'Judgment for {p}. Every word is in {p}’s hand, down to the crumb. The ghost-writer wrote nothing, so he sold nothing, and a receipt signed by a ghost is a receipt signed by a draught.'],
        ['judge', '{d} returns the book, and its chin, to the author who wrote it. Every word. With a pen. Leaning left.'],
        ['p', 'Can the ghost have a credit?'],
        ['judge', 'He may have the dedication. “To nobody.” It is the only part he supervised.']], [
        ['judge', 'Judgment for {p}. The book was written by the writer and sold by the sigh. A receipt signed in ectoplasm is not a signature. It is a stain.'],
        ['judge', '{d} hands it back. The ghost-writer is to be paid forty years of invoices in full, in tea.'],
        ['narrator', '(The ghost looks at the cup. It goes straight through. It is the best day of its afterlife.)']]),
      defendant: alt([
        ['judge', 'Judgment for {d}. An unpaid ghost is a free agent, and a free agent may sell what he likes to whoever lights him a candle.'],
        ['p', 'He did not even write it.'],
        ['judge', 'Then I cannot imagine what he sold, {p}, but {d} has it, and it is very photogenic.']], [
        ['judge', 'Judgment for {d}. {p} gave the ghost tea, and the ghost gave {d} a book. This court sees a fair trade.'],
        ['judge', 'If {p} wishes to dispute it, {p} may write a sequel. In its own hand.'],
        ['p', 'That is what I DID.']]),
      both: alt([
        ['judge', 'You are both pretending. One of you claims to have dictated a book. The other claims to have lived it. The book goes to the ghost-writer, who has at least stayed in the room.'],
        ['narrator', '(The ghost reaches for the book. It goes straight through. The book lands on the bailiff’s foot. He says nothing. He has had a day.)']], [
        ['judge', 'You are both responsible for this book, and I will not have it said that I read it.'],
        ['judge', 'It goes to the bailiff, who bought a copy and will now return it to the shelf at once.'],
        ['bailiff', 'I ate chapter nine, Your Honour.'],
        ['judge', 'Thank you, Bailiff. It is the only review it will ever get.']])
    },
    hallway: {
      p: ['I wrote it myself. Every word. In the dark, so nobody would see me enjoying it.',
        'I’m writing the sequel. STILL HERE, AGAIN. Chapter one is this hallway. I can hold the pen. I checked.',
        'The ghost can have the dedication. I have decided. “To nobody.” He is a quiet, supportive nobody.'],
      d: ['I paid two souls and a candle for a book that was mine in spirit. I am in every chapter. I was there for the crumb.',
        'The ghost has framed the soul. I have framed the candle. Neither of us could afford a pen.',
        'I have started my own memoirs. It is going well. I have written “Chapter One”. I have been looking at it since Tuesday.']
    }
  }],
  'stolen-shadow': [{
    id: 'shadow-for-a-thimble', title: 'A Shadow for a Thimble', truth: 'both',
    turn: alt([
      ['narrator', '(In the light of the lamp, a small shadow detaches itself from the wall behind {p} and stands there, arms folded, visibly waiting for something.)'],
      ['judge', 'Does that shadow want to say anything?'],
      ['bailiff', 'It is holding a very small piece of paper, Your Honour. I think it wants a receipt.']
    ], [
      ['narrator', '(A thimble rolls out from under the plaintiff’s podium, wobbles across the courtroom floor, and comes to rest at the defendant’s feet. Nobody has touched it.)'],
      ['judge', 'Whose is that?'],
      ['bailiff', 'It is trying to go home, Your Honour. I do not know to whom.']
    ]),
    questions: {
      0: { clue: '{p} last stood in the light at Easter 1953, and got its thimble from “a very nice person” at the sugar bowl that same afternoon.', lines: alt([
        ['p', 'Easter, 1953, Your Honour. Somebody opened the curtains by mistake. I got behind the sugar bowl, and I have not been in the light since.'],
        ['judge', 'And the thimble?'],
        ['p', 'A gift, Your Honour. From a very nice person. At the sugar bowl. That same afternoon.'],
        ['judge', 'Which person?'],
        ['p', 'I do not remember. It was a lovely afternoon.']], [
        ['judge', 'When did you last stand in the light, {p}?'],
        ['p', 'Easter, 1953. Somebody opened the curtains by mistake. It was the worst day of my life and the best bargain I ever made.'],
        ['judge', 'Bargain?'],
        ['p', 'Weather. I meant weather. It was very clear.']]) },
      1: { clue: 'The Lamp watched {p} hand over its shadow to {d} for a thimble across the sugar bowl at Easter 1953. They shook on it.', lines: alt([
        ['npc', 'Easter, 1953, Your Honour. I was on. {p} came out from behind the sugar bowl and {d} was waiting there with a thimble.', 'lamp'],
        ['judge', 'What happened?'],
        ['npc', '{p} peeled its shadow off the wall, rolled it up, and handed it over. {d} handed over the thimble. They shook on it. Neither of them looked at me.', 'lamp'],
        ['judge', 'And you said nothing?'],
        ['npc', 'Nobody asks the lamp, Your Honour. We just light the transaction.', 'lamp']], [
        ['npc', 'Easter, 1953. They did it in my light, Your Honour, which I think was the point. A shadow cannot be sold in the dark.', 'lamp'],
        ['judge', 'Sold.'],
        ['npc', '{p} lifted its own shadow off the wall like a rug. {d} counted out one thimble, silver, slightly, and tapped it with a pencil to show it rang.', 'lamp'],
        ['judge', 'And did it?'],
        ['npc', 'It went “tonk”, Your Honour. I think it was a very small bucket.', 'lamp']]) },
      2: { clue: 'In the light, the shadow has a tag on its heel: SOLD, ONE THIMBLE (SLIGHTLY SILVER). COLLECT ON DEMAND. Signed {d}.', lines: alt([
        ['narrator', '({d} stands in the studio light. Two shadows. The one with {p}’s ears stands a little apart, with its back to {p}.)'],
        ['bailiff', 'There is a tag on its heel, Your Honour. “SOLD: ONE THIMBLE (SLIGHTLY SILVER). COLLECT ON DEMAND. {d}.”'],
        ['judge', '{p}. Did you sell your shadow?'],
        ['p', '(small) It was a very slow week.']], [
        ['narrator', '({d} stands in the light. The second shadow keeps its back to {p} and puts an arm round the other one. Both look in excellent form.)'],
        ['bailiff', 'There is a receipt in its pocket, Your Honour. “1 SHADOW, USED, ONE CAREFUL OWNER. PAID IN FULL: 1 THIMBLE. SIGNED, {d}.”'],
        ['judge', 'Are those your ears on the receipt, {p}?'],
        ['p', 'They are very good ears. I had them valued.']]) },
      3: { sass: true, lines: alt([
        ['judge', '{p}, a shadow is the one possession that is free and always attached to you. You found a way to lose it. It is like losing a hat you are wearing.'],
        ['p', 'It was a very good hat.'],
        ['judge', 'It was not a hat, {p}. It was you, in black, and quieter.']], [
        ['judge', '{p}. Two hundred years your shadow spent in a drawer. I have met cellar mushrooms with a livelier social life.'],
        ['p', 'It was very safe.'],
        ['judge', 'It was filed, {p}. Safe is when somebody asks after it.']]) },
      4: { lines: alt([
        ['narrator', '(The bailiff creeps up on the second shadow with a drawing pin. The shadow turns, holds up a small ticket reading NO PINS, and strolls off with great dignity.)'],
        ['judge', 'Well, Bailiff?'],
        ['bailiff', 'I thought it was a cloakroom ticket, Your Honour. I was going to collect.']], [
        ['narrator', '(The bailiff tries to pin the shadow to the floor. The shadow catches the pin, examines it, and puts it in its pocket.)'],
        ['bailiff', 'Is it allowed to do that, Your Honour?'],
        ['judge', 'It is a shadow, Bailiff. It is allowed to do anything that is not a shape.']]) },
      5: { clue: 'The thimble {d} paid with is tin, stamped SLIGHTLY SILVER. {d} keeps forty of them, and a hatbox full of shadows.', lines: alt([
        ['d', 'Give it back, Your Honour? I can hardly. It is paid for.'],
        ['judge', 'What did you pay?'],
        ['d', 'A thimble. Silver, slightly.'],
        ['bailiff', 'It is tin, Your Honour. It says SLIGHTLY SILVER on the rim. There are forty more in {d}’s slot, and a hatbox full of shadows.'],
        ['p', 'THAT THIMBLE HAS NEVER LEFT ME.']], [
        ['d', 'It is not a question of giving back, Your Honour. It was a fair sale, with a receipt and a thimble.'],
        ['narrator', '(The bailiff takes the thimble off {p}’s head and bites it. It bends.)'],
        ['bailiff', 'Tin, Your Honour. Slightly silver. It says so on the rim. And there is a hatbox in {d}’s slot with eleven shadows in it, all labelled.'],
        ['p', 'THAT WAS MY THIMBLE.']]) }
    },
    rulings: {
      plaintiff: alt([
        ['judge', 'Judgment for {p}. The shadow goes home tonight, thimble and all.'],
        ['narrator', '(That night the shadow goes back into the drawer. It is carrying a very small, very neatly folded receipt.)']], [
        ['judge', 'Judgment for {p}. A shadow is an intimate thing and must be given back.'],
        ['narrator', '(The bailiff sews it back on. It takes an hour. The shadow keeps looking at the stitches, then at {d}, then at the stitches.)']]),
      defendant: alt([
        ['judge', 'Judgment for {d}. The shadow went willingly, in good light, wearing a tag. I will not stand between a shadow and a sale.'],
        ['p', 'It was a TIN thimble.'],
        ['judge', 'Then you are lucky it was not a tin shadow.']], [
        ['judge', 'Judgment for {d}. Two shadows are better than one. I have none and I envy both.'],
        ['narrator', '({d} leaves. Both shadows follow. One does a little skip. The other checks its heel.)']]),
      both: alt([
        ['judge', 'You are both crooks. {p} sold its shadow for a thimble and then called the police. {d} paid in tin, kept forty thimbles and a hatbox of other people’s shadows, and called it a coincidence.'],
        ['judge', 'The shadow goes to the Lamp, who has been the only honest party throughout. The hatbox goes with it.'],
        ['npc', 'Thank you, Your Honour. I have always wanted a collection.', 'lamp']], [
        ['judge', 'You deserve each other. One of you sells its shadow for a bad thimble and complains for seventy years. The other sells bad thimbles for good shadows and calls it a hobby.'],
        ['judge', 'The shadow will go to whoever it likes best, which, when I ask it, turns out to be the Lamp.'],
        ['narrator', '(The shadow crosses the courtroom, stands beside the Lamp, and leans on it. Both look extremely content.)']])
    },
    hallway: {
      p: ['A shadow for a thimble. It sounded so reasonable on Easter Sunday.',
        'The thimble is tin. It has never let me down, though, and a shadow lets you down every time the lights go off.',
        'I stood in the light for a full minute. I have never been so looked at. I would like my drawer back.'],
      d: ['Everybody thinks the shadows follow me. They don’t. They just like the way I stand. It is a different thing, and I charge for it.',
        'Tin is a very good metal. Slightly silver is a very good description. Nobody ever reads the rim.',
        'I would like it noted that the shadow came of its own accord. I just had the receipt ready.']
    }
  }],
  'teacup-timeshare': [{
    id: 'hot-water-claims', title: 'Hot Water Claims Ltd', truth: 'plaintiff',
    turn: alt([
      ['narrator', '(A kettle, somewhere in the gallery, starts to whistle. Mrs Widow looks at her watch. It says four. She stands up, apologises, and leaves in a hurry.)'],
      ['judge', 'Where is she going?'],
      ['bailiff', 'To pour, Your Honour. She is very punctual. Somebody pays her.']
    ], [
      ['bailiff', 'Your Honour, {d} has left a stack of leaflets on every seat in the gallery. “HAVE YOU BEEN STEEPED? YOU MAY BE ENTITLED TO COMPENSATION.”'],
      ['judge', 'Who is the firm?'],
      ['bailiff', 'It does not say, Your Honour. But there is a small drawing of a teacup, and it is winking.']
    ]),
    questions: {
      0: { clue: '{d} pays Mrs Widow a soul every Saturday to pour at four sharp on Sunday, “with milk”. She thought it was a kindness.', lines: alt([
        ['npc', 'It is my teacup, dear. A wedding present. I have tea in it every Sunday at four.', 'widow'],
        ['judge', 'Did you know there was somebody in it?'],
        ['npc', 'Not until the second sip, dear. But {d} leaves a soul in my saucer every Saturday, with a note. “Pour at four. Milk.” I thought it was a kindness.', 'widow'],
        ['judge', 'Was it?'],
        ['npc', 'Well, I do take milk, dear. So it was nice to be reminded.', 'widow']], [
        ['npc', 'That is my teacup, dear. I have my tea at four. A person in a hat pays me a soul to be punctual.', 'widow'],
        ['judge', '{d}?'],
        ['npc', '“Not a minute late,” it says. “Not a second early. And whatever you do, pour it slowly.”', 'widow'],
        ['judge', 'Why slowly?'],
        ['npc', 'So the customers have time to notice, dear. I assumed it was a spa.', 'widow']]) },
      1: { clue: 'Week thirty-two has been sold eleven times. All eleven owners were steeped, and all have the same pre-filled damages form.', lines: alt([
        ['bailiff', 'Week thirty-two has been sold eleven times, Your Honour. All by {d}. And August has been sold to you.'],
        ['judge', 'To me.'],
        ['bailiff', 'The whole of it. And there is a damages form in your name already, Your Honour. It says “milk”.'],
        ['judge', 'I take it black.']], [
        ['bailiff', 'Eleven owners for week thirty-two, Your Honour. Every one was steeped on the Sunday. Every one has a form. Every form says “four minutes” and “milk”.'],
        ['judge', 'Are they in the same handwriting?'],
        ['bailiff', 'They are in the same typeface, Your Honour. It is called Hot Water Claims.'],
        ['judge', 'Is that a font or a firm?'],
        ['bailiff', 'It is both, Your Honour. It is a very small firm.']]) },
      2: { clue: 'The damages form is printed by “Hot Water Claims”, which is {d}, and takes sixty per cent of any award. It came with the timeshare.', lines: alt([
        ['p', 'It came in the pack, Your Honour. Free. Already filled in. I only had to sign.'],
        ['bailiff', 'The letterhead says HOT WATER CLAIMS LTD, Your Honour. A subsidiary of {d}. Sixty per cent of any award.'],
        ['judge', '{d}. You sell the cup, steep the customer, and then sell the customer the claim.'],
        ['d', 'It is called vertical integration, Your Honour.']], [
        ['p', 'Straight after, Your Honour. Still dripping. {d} brought a pen.'],
        ['judge', 'Why is it dated two days before?'],
        ['bailiff', 'Because it is not {p}’s, Your Honour. It is printed. HOT WATER CLAIMS LTD. “A friend in need.”'],
        ['d', 'I am a very good friend.'],
        ['judge', 'You are a friend with a sixty per cent commission, {d}.']]) },
      3: { sass: true, lines: alt([
        ['judge', 'I have every sympathy, {p}. But you looked at a saucer and thought “sea”. At some point that is not a swindle. It is optimism.'],
        ['p', 'It said sea view.'],
        ['judge', 'So does a puddle, {p}. If you lean.']], [
        ['judge', '{p}, you went in pale and anxious and came out warm and strong. Many people pay good money to be changed by an experience.'],
        ['p', 'I did not CONSENT to the experience.'],
        ['judge', 'Nobody does, {p}. That is how you know it is working.']]) },
      4: { herring: '{p} signed for a free sugar lump and knows the damages form by heart. Perhaps {p} is a regular claimant.', lines: alt([
        ['p', 'There was a free gift, Your Honour. A sugar lump. {d} ate it while I was reading the small print.'],
        ['judge', 'You read the small print?'],
        ['p', 'I know the damages form by heart, Your Honour. I have had to.'],
        ['d', 'THAT WAS THE DEMONSTRATION LUMP.']], [
        ['p', 'There was a free tour of the cup, Your Honour. I have been on a lot of those.'],
        ['judge', 'A lot?'],
        ['p', 'Nine. I am very unlucky with cups. I always get the tea.'],
        ['d', 'THE TOUR IS ONLY FOR NEW CLIENTS.']]) },
      5: { lines: alt([
        ['d', 'Very flexible, Your Honour. You can swap your teacup week for a fortnight in the gravy boat.'],
        ['judge', 'What is the gravy boat like?'],
        ['d', 'Also hot, Your Honour. But with a sauce. People say it is more satisfying.']], [
        ['d', 'We have a sister property in the soup tureen, Your Honour. The view is of the ladle.'],
        ['judge', 'And the amenities?'],
        ['d', 'Hot, Your Honour. Seasonal. And the ladle comes round at one.']]) }
    },
    rulings: {
      plaintiff: alt([
        ['judge', 'Judgment for {p}. {d} sold one teacup to eleven residents and a judge, paid a widow to pour on time, and then sold every victim the claim form at sixty per cent. That is not a timeshare. It is a conveyor belt.'],
        ['judge', 'Full refunds, starting with mine. The forms are void. And my August is cancelled. I would like that in writing. Not in milk.']], [
        ['judge', 'Judgment for {p}. Nobody should pay nine souls to be made into a drink, and nobody should then be sold the paperwork.'],
        ['judge', '{d} refunds all eleven, and the judge, and goes into the teacup for four minutes, no milk, as an exchange scheme.'],
        ['narrator', '(Mrs Widow, in the gallery, quietly puts the kettle on.)']]),
      defendant: alt([
        ['judge', 'Judgment for {d}. The brochure said hot water on Sundays. The brochure was right. I will not punish a firm for being accurate.'],
        ['p', 'It was a SWINDLE.'],
        ['judge', 'It was a very accurate swindle, {p}. That counts for something in my court.']], [
        ['judge', 'Judgment for {d}. A person who goes into a teacup at four on a Sunday cannot complain of being poured on. That is the amenity.'],
        ['narrator', '({p} is shown out. Somebody in the gallery tries to dunk a biscuit in it. The judge allows it.)']]),
      both: alt([
        ['judge', 'You are both at fault. One of you sold a cup it did not own. The other signed a form it did not read.'],
        ['judge', 'No refunds. No damages. The teacup goes back to Mrs Widow, who may put in it whatever she likes.'],
        ['npc', 'Tea, dear. Just tea.', 'widow']], [
        ['judge', 'You are both ridiculous. A cup is a cup, and a week is a week, and the one certain thing is that it will be tea.'],
        ['judge', 'You will both spend week thirty-two in the teacup, together, on a Sunday, at four. I shall be watching from the sea view.']])
    },
    hallway: {
      p: ['I want it noted that I read the small print. The small print said “sixty per cent”. I took it for a temperature.',
        'I am still slightly brown. People ask where I’ve been. I say “the sea”. It is technically accurate.',
        'I would go back. The four minutes were lovely. It was the form I minded.'],
      d: ['Vertical integration. That’s all I’ll say. Eleven clients, one widow, one cup. The margins are extraordinary.',
        'We are rebranding. Hot Water Claims is now Cold Feet Claims. Same address, new kettle.',
        'I’ve always said the customer is always right. Right up until they come out brown.']
    }
  }],
  'radiator-raffle': [{
    id: 'ninety-nine-triangles', title: 'Ninety-Nine Triangles in a Hat', truth: 'defendant',
    turn: alt([
      ['narrator', '(The bailiff is carried in, asleep, on a tea tray by two ghosts. A single raisin is stuck to his cheek.)'],
      ['judge', 'What happened to him?'],
      ['bailiff', '(from the tray, not waking) …a very comfortable draw…']
    ], [
      ['narrator', '(A hat is placed on the evidence table. Something inside it rattles, like a bag of very small, very sharp knuckles.)'],
      ['judge', 'What is in the hat, Bailiff?'],
      ['bailiff', 'The raffle, Your Honour. Most of it is pointing at me.']
    ]),
    questions: {
      0: { clue: 'The winning ticket is the only flat one in the hat. The other ninety-nine are hard triangles, each with a tooth mark on the point.', lines: alt([
        ['bailiff', 'The winning ticket, Your Honour. Perfectly flat. Not a crease.'],
        ['judge', 'And the other ninety-nine?'],
        ['bailiff', 'All folded into hard little triangles, Your Honour. Every one, the same fold, with a tooth mark on the point.'],
        ['judge', '{p}. Open wide.'],
        ['narrator', '({p} opens wide. The tooth marks fit.)']], [
        ['bailiff', 'The winning ticket, Your Honour. Flat as a pancake. It was sitting on top of the hat.'],
        ['judge', 'On top?'],
        ['bailiff', 'The other ninety-nine are folded into triangles, Your Honour, as hard as knuckles. They had sunk. Nobody could have missed it.'],
        ['d', 'I did not even look. I just reached in.'],
        ['judge', 'You could not have drawn anything else, {d}. That hat was a trap, and it caught the wrong creature.']]) },
      1: { clue: 'The limit was one ticket each. {p} bought ninety-nine under false names, from “Mr Radiator” to a drawing of a hat.', lines: alt([
        ['judge', 'Read me the names, {p}.'],
        ['p', 'Ernest Radiator. Mrs Ernest Radiator. Little Ernest. Ernest’s Mother. A hat.'],
        ['judge', 'You bought tickets as a hat.'],
        ['p', 'It was a very enthusiastic hat, Your Honour. It wanted to win more than any of us.']], [
        ['bailiff', 'The stubs, Your Honour. “Mr Radiator.” “Not {p}.” “Definitely Not {p}.” “Somebody Else Entirely.”'],
        ['judge', '{p}. Is that your handwriting?'],
        ['p', 'It is a very common handwriting.'],
        ['bailiff', 'They are all underlined twice, Your Honour. In the same crayon.']]) },
      2: { herring: 'The radiator clanked three times at {d}’s name, then went very quiet. Radiators know a cheat.', lines: alt([
        ['narrator', '(The radiator is called. It clanks twice. It is six o’clock.)'],
        ['judge', 'Radiator. Did {d} tamper with the raffle?'],
        ['narrator', '(The radiator clanks three times, gurgles, and goes completely silent. The bailiff notes that it is shaking slightly.)'],
        ['bailiff', 'I think that was a yes, Your Honour. Or it wants bleeding.']], [
        ['judge', 'Radiator. Is {d} a cheat?'],
        ['narrator', '(The radiator hisses once, the loud hiss of an old pipe with no manners. Everyone in the front row moves back.)'],
        ['bailiff', 'I believe it is nervous, Your Honour. They are always nervous at six.'],
        ['judge', 'So it has told us nothing.'],
        ['bailiff', 'It has told us it is a radiator, Your Honour. It is a start.']]) },
      3: { sass: true, lines: alt([
        ['judge', '{p}. Ninety-nine souls on tickets, and you folded every one into a triangle. That is geometry. That is a hobby. You could have joined a club.'],
        ['p', 'I joined the raffle.'],
        ['judge', 'You joined the raffle, {p}, and then you tried to win it with arts and crafts.']], [
        ['judge', '{p}, for ninety-nine souls you could have bought a very good blanket.'],
        ['p', 'A blanket is not the radiator.'],
        ['judge', 'No. But a blanket does not need the bailiff to cheat, which I think you will find is the main difference.']]) },
      4: { lines: alt([
        ['d', 'Wonderful, Your Honour. At six the pipes start ticking. By ten past, my feet have gone pink.'],
        ['judge', 'And from seven until six?'],
        ['d', 'I tell {p} about it. Kindly. I do a little voice.'],
        ['p', 'NOBODY ASKED FOR THE VOICE.']], [
        ['d', 'I have not slept so well since 1897, Your Honour. I have a glow.'],
        ['judge', 'You have a glow.'],
        ['d', 'A little one. From the knees. It is the pipe.'],
        ['p', 'I HAD THAT GLOW FIRST. IN MY MIND.']]) },
      5: { clue: 'Only {p} bribed the bailiff: four raisins to “pick a triangle”. He fell asleep on them, so {d} drew instead.', lines: alt([
        ['bailiff', '{p} left four raisins on my chair the night before the draw, Your Honour, with a note. “Pick a triangle.”'],
        ['judge', 'And {d}?'],
        ['bailiff', 'Nothing, Your Honour. Not so much as a currant. It stood at the back and looked embarrassed.'],
        ['judge', 'And did you pick a triangle?'],
        ['bailiff', 'I fell asleep on the raisins, Your Honour. I woke up at the end and the draw was over. It was a very comfortable draw.']], [
        ['bailiff', 'Approached, Your Honour? Only by {p}. Four raisins in my cap and a note that said TRIANGLES. {d} approached me with a kind word, which I returned.'],
        ['judge', 'And what did you do with the raisins?'],
        ['bailiff', 'I ate them, Your Honour, and felt so guilty I took a nap. By the time I woke, {d} had drawn the ticket.'],
        ['judge', 'So you bribed yourself to sleep.'],
        ['bailiff', 'Four raisins is a very good sedative, Your Honour.']]) }
    },
    rulings: {
      plaintiff: alt([
        ['judge', 'Judgment for {p}. Ninety-nine tickets out of a hundred is a landslide, and I will not stand between a landslide and a radiator.'],
        ['narrator', '({p} moves in at six. At seven the radiator goes cold. {p} sits there until morning, out of principle, folding things into triangles to keep warm.)']], [
        ['judge', 'Judgment for {p}, who bought the most tickets. This is not a raffle. It is a mathematics.'],
        ['d', 'But I won.'],
        ['judge', 'You won a raffle, {d}. {p} won a mathematics. It is the higher honour.']]),
      defendant: alt([
        ['judge', 'Judgment for {d}. {p} bought ninety-nine tickets under false names, folded every one into a triangle, bribed the bailiff with raisins, and then watched {d} reach into the hat and take the only flat ticket in the room.'],
        ['judge', 'This court has seen cheating that failed. This is the first time I have seen cheating that picked the winner for the other side.'],
        ['p', 'I was SO CLOSE.'],
        ['judge', 'You were so close, {p}, that you gift-wrapped it in a hat.']], [
        ['judge', 'Judgment for {d}. One flat ticket, one honest hand, and ninety-nine triangles that did all the work for the wrong party. {p} rigged this raffle so well that nobody could fail to win it. It just won it for somebody else.'],
        ['narrator', '(From six until seven, {d} is very warm. From seven until six, it tells {p} about it. It does a voice.)']]),
      both: alt([
        ['judge', 'You are both rotten. One of you bought the raffle and the other drew it, and the bailiff slept through the lot.'],
        ['judge', 'The slot will be shared. {p} from six until half past. {d} from half past until seven.'],
        ['narrator', '(At half past six they both move at once, and the radiator, as if embarrassed, switches itself off.)']], [
        ['judge', 'You are both disgraceful, and the bailiff is sleeping off a plate of raisins.'],
        ['judge', 'The raffle will be drawn again. One ticket each. Flat. The hat will be held by the Lamp.'],
        ['npc', 'Do I get a vote? I am the only one here who is on.', 'lamp']])
    },
    hallway: {
      p: ['Ninety-nine triangles and not one of them won. I would like to speak to a mathematician. Or a priest.',
        'I have kept the triangles. I am going to build a small house. It will not be warm.',
        'I would like it noted that the bailiff slept through my crime. That is not justice. It is negligence.'],
      d: ['I did nothing. I reached in with my eyes shut. The hat did the rest. I have never been so lucky or so thoroughly framed.',
        'It is lovely and warm. Six until seven. And from seven until six I think about {p}’s face.',
        'I have kept the winning ticket. It is flat. I sleep on it. It is the most comfortable ticket in the world.']
    }
  }]
};

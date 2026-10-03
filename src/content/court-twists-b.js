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
  }]
};

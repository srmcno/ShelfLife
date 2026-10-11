/* ================= COVENS =================
   Small friend groups: six seats, a name from two word banks, a sigil from
   parts, a weekly rite, a chest, a notice board and the Monday awards.

   Writing rules for this file: dry, dark, specific and petty. The joke is the
   precise absurd detail, delivered flat. Curly quotes and apostrophes in
   anything a player reads, and no dashes of any kind.

   Everything here is chosen, never typed. A coven's name and sigil travel as
   the ids below, so the ids are permanent: add new entries at the end, retire
   old ones by leaving them in place. The goal ids, counters and daily caps
   must match supabase/migrations/0008_covens.sql (test/coven_sql.test.mjs
   checks). Data only: this module imports nothing. */

export const MAX_MEMBERS = 6;

/* ---------- the name ----------
   Every A reads both ways: “The Damp Sisterhood” and “Sisterhood of the Damp”. */
export const NAME_A = [
  ['damp', 'Damp'], ['second-drawer', 'Second Drawer'], ['unwashed', 'Unwashed'], ['cold-tea', 'Cold Tea'],
  ['late-fee', 'Late Fee'], ['wrong-spoon', 'Wrong Spoon'], ['lukewarm', 'Lukewarm'], ['small-print', 'Small Print'],
  ['back-step', 'Back Step'], ['spare-key', 'Spare Key'], ['unread-post', 'Unread Post'], ['moth', 'Moth'],
  ['seventh-candle', 'Seventh Candle'], ['low-tide', 'Low Tide'], ['last-biscuit', 'Last Biscuit'], ['dripping-tap', 'Dripping Tap'],
  ['borrowed-ladder', 'Borrowed Ladder'], ['airing-cupboard', 'Airing Cupboard'], ['lost-glove', 'Lost Glove'], ['good-china', 'Good China'],
  ['loose-floorboard', 'Loose Floorboard'], ['overdue-book', 'Overdue Book'], ['bleak-midweek', 'Bleak Midweek'], ['third-funeral', 'Third Funeral'],
  ['wet-weekend', 'Wet Weekend'], ['unclaimed-parcel', 'Unclaimed Parcel'], ['tepid-bath', 'Tepid Bath'], ['standing-order', 'Standing Order'],
  ['crooked-portrait', 'Crooked Portrait'], ['spare-room', 'Spare Room'], ['final-notice', 'Final Notice'], ['unmarked-jar', 'Unmarked Jar'],
  ['slow-cooker', 'Slow Cooker'], ['grey-cardigan', 'Grey Cardigan'], ['sunday-best', 'Sunday Best'], ['jumble-sale', 'Jumble Sale'],
  ['creaking-stair', 'Creaking Stair'], ['mildew', 'Mildew'], ['eternal-draught', 'Eternal Draught'], ['open-verdict', 'Open Verdict'],
  ['half-moon', 'Half Moon'], ['unread-minutes', 'Unread Minutes'], ['eternal-kettle', 'Eternal Kettle'], ['fourth-cousin', 'Fourth Cousin'],
  ['burnt-toast', 'Burnt Toast'], ['doily', 'Doily'], ['quiet-hour', 'Quiet Hour'], ['unpaid-invoice', 'Unpaid Invoice']
];
export const NAME_B = [
  ['sisterhood', 'Sisterhood'], ['society', 'Society'], ['committee', 'Committee'], ['order', 'Order'], ['guild', 'Guild'],
  ['coven', 'Coven'], ['circle', 'Circle'], ['parish-council', 'Parish Council'], ['residents', 'Residents’ Association'],
  ['book-club', 'Book Club'], ['brotherhood', 'Brotherhood'], ['fellowship', 'Fellowship'], ['lodge', 'Lodge'], ['syndicate', 'Syndicate'],
  ['chapter', 'Chapter'], ['congregation', 'Congregation'], ['auxiliary', 'Auxiliary'], ['consortium', 'Consortium'], ['tribunal', 'Tribunal'],
  ['league', 'League'], ['assembly', 'Assembly'], ['conclave', 'Conclave'], ['choir', 'Choir'], ['fan-club', 'Fan Club'],
  ['support-group', 'Support Group'], ['watch', 'Neighbourhood Watch'], ['working-group', 'Working Group'], ['benevolent-fund', 'Benevolent Fund'],
  ['quiz-team', 'Quiz Team'], ['rota', 'Rota'], ['whist-drive', 'Whist Drive'], ['historical-society', 'Historical Society']
];
// How the two halves meet. Ids 0 to 3 travel to the server.
export const NAME_FORMS = ['The {a} {b}', '{b} of the {a}', 'The {b} of the {a}', '{b} for the {a}'];
export const NAME_A_BY_ID = Object.fromEntries(NAME_A);
export const NAME_B_BY_ID = Object.fromEntries(NAME_B);

/* ---------- the sigil ---------- */
export const SIGIL_SHAPES = [
  { id: 'shield', name: 'Shield' }, { id: 'seal', name: 'Wax seal' }, { id: 'moon', name: 'Crescent' },
  { id: 'coffin', name: 'Coffin' }, { id: 'lozenge', name: 'Lozenge' }, { id: 'keyhole', name: 'Keyhole' }
];
export const SIGIL_SYMBOLS = [
  { id: 'spoon', name: 'Spoon' }, { id: 'key', name: 'Key' }, { id: 'moth', name: 'Moth' }, { id: 'candle', name: 'Candle' },
  { id: 'teacup', name: 'Teacup' }, { id: 'raven', name: 'Raven' }, { id: 'mushroom', name: 'Mushroom' }, { id: 'kettle', name: 'Kettle' },
  { id: 'bell', name: 'Bell' }, { id: 'spider', name: 'Spider' }, { id: 'snail', name: 'Snail' }, { id: 'jar', name: 'Jar' }
];
// Each colour has a light and a dark for member shares on the progress bar.
export const SIGIL_COLOURS = [
  { id: 'bruise', name: 'Bruise', hex: '#9a6bd6' }, { id: 'moss', name: 'Moss', hex: '#7fae55' }, { id: 'rust', name: 'Rust', hex: '#c8693d' },
  { id: 'ink', name: 'Ink', hex: '#5b8fd6' }, { id: 'bile', name: 'Bile', hex: '#cdbd4f' }, { id: 'ash', name: 'Ash', hex: '#a9a39b' },
  { id: 'blood', name: 'Blood', hex: '#c8404f' }, { id: 'tallow', name: 'Tallow', hex: '#e8b964' }
];
export const SHAPE_BY_ID = Object.fromEntries(SIGIL_SHAPES.map(s => [s.id, s]));
export const SYMBOL_BY_ID = Object.fromEntries(SIGIL_SYMBOLS.map(s => [s.id, s]));
export const COLOUR_BY_ID = Object.fromEntries(SIGIL_COLOURS.map(s => [s.id, s]));

/* ---------- the weekly rite ----------
   Built only from counters the Almanac already reads (engine/almanac.js
   readCounters). `per` is asked of each member; the server multiplies it by
   the members present when the week begins (two at least). */
export const COUNTERS = ['emergency', 'coffin', 'care', 'court', 'arcade', 'expedition', 'curio', 'omen', 'chore', 'docket', 'daily'];
export const DAILY_CAPS = { emergency: 130, coffin: 80, care: 400, court: 40, arcade: 150, expedition: 30, curio: 40, omen: 1, chore: 3, docket: 1, daily: 1 };
export const COUNTER_WORDS = {
  emergency: ['emergency', 'emergencies'], coffin: ['coffin', 'coffins'], care: ['act of care', 'acts of care'],
  court: ['Shelf Court case', 'Shelf Court cases'], arcade: ['arcade run', 'arcade runs'], expedition: ['expedition', 'expeditions'],
  curio: ['new curio', 'new curios'], omen: ['omen', 'omens'], chore: ['chore', 'chores'], docket: ['docket', 'dockets'],
  daily: ['daily challenge', 'daily challenges']
};
export const GOALS = [
  { id: 'emergency-12', counter: 'emergency', per: 12, title: 'Minor Catastrophes', line: 'Resolve {n} emergencies between you.', aside: 'Nothing ambitious. The ceiling can stay where it is.' },
  { id: 'emergency-15', counter: 'emergency', per: 15, title: 'Disaster Tourism', line: 'Resolve {n} emergencies between you.', aside: 'Bring a flask. Wave at the vicar.' },
  { id: 'emergency-18', counter: 'emergency', per: 18, title: 'A Week of Small Fires', line: 'Resolve {n} emergencies between you.', aside: 'Each one is somebody’s fault. The minutes will say whose.' },
  { id: 'emergency-24', counter: 'emergency', per: 24, title: 'Crisis Management, Loosely', line: 'Resolve {n} emergencies between you.', aside: 'The committee has bought a fire blanket. It is decorative.' },
  { id: 'coffin-3', counter: 'coffin', per: 3, title: 'Window Shopping at the Undertaker', line: 'Open {n} coffins between you.', aside: 'Just looking, thank you. Just looking inside.' },
  { id: 'coffin-4', counter: 'coffin', per: 4, title: 'Something in the Box', line: 'Open {n} coffins between you.', aside: 'Shake it first. Listen. Decide you did not hear that.' },
  { id: 'coffin-5', counter: 'coffin', per: 5, title: 'Bulk Coffins', line: 'Open {n} coffins between you.', aside: 'The undertaker has started saying “Ah, it’s you lot.”' },
  { id: 'care-25', counter: 'care', per: 25, title: 'The Laying On of Hands', line: 'Care for residents {n} times between you.', aside: 'Feed, fuss, wash. Mostly wash.' },
  { id: 'care-32', counter: 'care', per: 32, title: 'Bath Night, All Week', line: 'Care for residents {n} times between you.', aside: 'Someone will hide in the airing cupboard. Let them.' },
  { id: 'care-40', counter: 'care', per: 40, title: 'Smother Them', line: 'Care for residents {n} times between you.', aside: 'Affection, applied firmly and without warning.' },
  { id: 'court-2', counter: 'court', per: 2, title: 'Small Claims Season', line: 'Hear {n} Shelf Court cases between you.', aside: 'Everybody is suing everybody. It is very healthy.' },
  { id: 'court-3', counter: 'court', per: 3, title: 'The Bench Is Still Warm', line: 'Hear {n} Shelf Court cases between you.', aside: 'Bring your own wig. The communal one has a history.' },
  { id: 'arcade-6', counter: 'arcade', per: 6, title: 'Thumb Exercises', line: 'Finish {n} arcade runs between you.', aside: 'For the joints. Doctor’s orders. The doctor is a raven.' },
  { id: 'arcade-8', counter: 'arcade', per: 8, title: 'High Scores, Low Standards', line: 'Finish {n} arcade runs between you.', aside: 'Every run counts, including the bad ones. Especially those.' },
  { id: 'arcade-10', counter: 'arcade', per: 10, title: 'Repetitive Strain', line: 'Finish {n} arcade runs between you.', aside: 'Rest the wrist between waves. Do not rest the grudge.' },
  { id: 'expedition-2', counter: 'expedition', per: 2, title: 'Anywhere But Here', line: 'Send {n} expeditions between you.', aside: 'Pack a tool, a snack and a convincing excuse.' },
  { id: 'curio-1', counter: 'curio', per: 1, title: 'New Evidence', line: 'Find {n} curios you did not have, between you.', aside: 'The cabinet is not full. It is merely confident.' },
  { id: 'omen-4', counter: 'omen', per: 4, title: 'Reading the Signs', line: 'Turn over {n} omens between you.', aside: 'One a night each. The candle keeps count. The candle is petty.' },
  { id: 'omen-5', counter: 'omen', per: 5, title: 'Faith, of a Kind', line: 'Turn over {n} omens between you.', aside: 'Believe in nothing, but check it every evening.' },
  { id: 'chore-9', counter: 'chore', per: 9, title: 'Domestic Penance', line: 'Finish {n} chores between you.', aside: 'The unholy ones. The holy ones are somebody else’s department.' },
  { id: 'chore-12', counter: 'chore', per: 12, title: 'The Mop Rota', line: 'Finish {n} chores between you.', aside: 'Your name is on it. Twice. In different handwriting.' },
  { id: 'docket-3', counter: 'docket', per: 3, title: 'Court Is in Session, Apparently', line: 'Air the docket {n} times between you.', aside: 'One case a day each. The usher has been told.' },
  { id: 'daily-3', counter: 'daily', per: 3, title: 'Challenge Accepted, Grudgingly', line: 'Finish {n} daily challenges between you.', aside: 'Today’s modifier is unfair. So was yesterday’s. Carry on.' },
  { id: 'daily-4', counter: 'daily', per: 4, title: 'The Daily Grind', line: 'Finish {n} daily challenges between you.', aside: 'Four days each. The other three are for recovering.' }
];
export const GOAL_BY_ID = Object.fromEntries(GOALS.map(g => [g.id, g]));

/* ---------- the chest ----------
   Three tiers at a third, two thirds and all of the target. Each pays every
   member who did something towards the goal that week. */
export const CHEST_TIERS = [
  { tier: 1, name: 'The First Candle', souls: 40, line: 'A third of the way. Somebody lit a candle to mark it and then blew it out to save it.' },
  { tier: 2, name: 'The Cauldron', souls: 70, curio: true, line: 'Two thirds. The cauldron has something in it for each of you. Do not stir clockwise.' },
  { tier: 3, name: 'The Whole Chest', souls: 110, frame: true, line: 'The lot. A chest, a frame for the sigil, and a feeling that will pass.' }
];
// A curio already owned pays this instead; so does a frame when every frame is owned and every curio too.
export const DUPLICATE_SOULS = 45;

/* The coven cupboard: curios that only come out of the cauldron. */
export const COVEN_CURIOS = [
  { id: 'cv-minutes', name: 'The Minutes', line: 'Notes from a meeting nobody remembers calling. Item four is you.' },
  { id: 'cv-spoon', name: 'The Communal Spoon', line: 'Shared by all, washed by none. It is signed out on a sheet, and the sheet is overdue.' },
  { id: 'cv-candle', name: 'Candle Stub, Group Owned', line: 'Lit at every meeting. Never once allowed to finish.' },
  { id: 'cv-mug', name: 'Mug: World’s Okayest Coven', line: 'A gift from a member who has since left. The handle left first.' },
  { id: 'cv-rota', name: 'The Rota', line: 'Who does what, and when. Your name appears four times in pen and once in something darker.' },
  { id: 'cv-badge', name: 'Membership Badge, Laminated', line: 'Proof of belonging. The photograph is of someone else, and they look happier.' },
  { id: 'cv-tin', name: 'The Biscuit Tin of Dues', line: 'Dues are paid in custard creams. The treasurer is under investigation.' },
  { id: 'cv-gavel', name: 'A Very Small Gavel', line: 'For the chair. The chair is a stool. Nobody has said so.' }
];
export const COVEN_CURIO_BY_ID = Object.fromEntries(COVEN_CURIOS.map(c => [c.id, c]));

/* Sigil frames: worn round the coven sigil, seen by the whole coven. */
export const SIGIL_FRAMES = [
  { id: 'ivy', name: 'Ivy, Creeping', line: 'It was not planted. It arrived and made itself a fixture.' },
  { id: 'stubs', name: 'Ring of Stubs', line: 'Seven candles, all nearly finished, none permitted to be.' },
  { id: 'lace', name: 'Funeral Lace', line: 'Borrowed from a wake. Returned to nobody.' },
  { id: 'bunting', name: 'Bunting, Black', line: 'For the summer fête. The summer fête was cancelled. The bunting stays.' },
  { id: 'thorns', name: 'Thorns, Administrative', line: 'Each thorn is a form. Each form is in triplicate.' },
  { id: 'gilt', name: 'Gilt, Borrowed', line: 'From a frame in a house where nobody will notice for a while.' }
];
export const SIGIL_FRAME_BY_ID = Object.fromEntries(SIGIL_FRAMES.map(f => [f.id, f]));

/* Invite rewards: a matching pair of portrait frames for the resident card,
   one pair for each side. They live in content/collections.js PORTRAIT_FRAMES
   with reward: 'invite', so the Exchange never sells them. */
export const INVITE_FRAMES = ['accomplice-l', 'accomplice-r'];
export const INVITE_DAYS = 3;
export const INVITE_REWARD_CAP = 10;
export const INVITE_REPEAT_SOULS = 50;

/* ---------- the Shelfies: Monday awards ----------
   `stat` names what wins it. Every member wins one thing. The lowest
   contributor in a coven of two or more is given Least Help first; everybody
   else is given the first award they lead, in this order; anyone who did
   nothing at all gets one of the last three. Citations use {name} and {n}. */
export const AWARDS = [
  { id: 'carried', stat: 'goal', title: 'Carried the Coven', lines: [
    '{name} did {n} for the rite, which is more than the rest of you put together, if you round generously.',
    '{name} put in {n} towards the goal and would like that minuted. It has been minuted. In pencil.',
    'With {n} to their name, {name} carried the coven, and has asked for a small plaque. The plaque is on order. It will be smaller.'] },
  { id: 'emergencies', stat: 'emergency', title: 'Most Emergencies Survived', lines: [
    '{name} resolved {n} emergencies and caused, by the committee’s count, at least two of them.',
    '{n} emergencies. {name} has stopped asking what the noise is and started asking which noise.',
    '{name} survived {n} emergencies. The emergencies have filed a complaint.'] },
  { id: 'coffins', stat: 'coffin', title: 'Most Coffins Opened for No Reason', lines: [
    '{name} opened {n} coffins. When asked why, {name} said “to see”. The coffins would like privacy.',
    '{n} coffins, opened by {name}, mostly to check. Everything was in order. Some of it was in the wrong order.',
    '{name} opened {n} coffins this week. The undertaker now keeps a chair for them.'] },
  { id: 'omens', stat: 'omen', title: 'Most Suspicious Omen Streak', lines: [
    '{name} turned over {n} omens and claims not to believe in any of them. The candle disagrees.',
    '{n} omens, {name}. Nobody is that interested in the future unless they owe it money.',
    '{name} read the signs {n} times. The signs have started reading back.'] },
  { id: 'hands', stat: 'care', title: 'Most Hands On, Allegedly', lines: [
    '{name} cared for residents {n} times. The residents have asked for a little less of it.',
    '{n} acts of care from {name}. At least one resident has been washed against its will and is still damp about it.',
    '{name} fed, fussed and washed {n} times. The flannel has applied for leave.'] },
  { id: 'bench', stat: 'court', title: 'Most Time Spent in Court Voluntarily', lines: [
    '{name} heard {n} cases. Nobody made them. That is the troubling part.',
    '{n} Shelf Court cases. {name} has started saying “sustained” at dinner.',
    '{name} sat on the bench {n} times and now refers to the sofa as “the gallery”.'] },
  { id: 'thumbs', stat: 'arcade', title: 'Thumbs of the Week', lines: [
    '{name} finished {n} arcade runs. The thumbs are fine. The thumbs are tired. The thumbs wish to be left alone.',
    '{n} arcade runs from {name}, some of them on purpose.',
    '{name} played {n} runs and blamed the controls for at least {n} of them.'] },
  { id: 'elsewhere', stat: 'expedition', title: 'Most Frequently Elsewhere', lines: [
    '{name} sent {n} expeditions out, which is one way to avoid a meeting.',
    '{n} expeditions. {name} says it is for the parts. Nobody believes it is for the parts.',
    '{name} went somewhere {n} times and brought back, mostly, an attitude.'] },
  { id: 'hoarder', stat: 'curio', title: 'Hoarder of the Week', lines: [
    '{name} found {n} new curios and has nowhere to put them, and will not hear of giving any away.',
    '{n} new things in {name}’s cabinet. The cabinet has been quietly reinforced.',
    '{name} acquired {n} curios. Provenance: none of your business.'] },
  { id: 'martyr', stat: 'chore', title: 'Domestic Martyr', lines: [
    '{name} finished {n} chores and has mentioned it {n} times since.',
    '{n} chores from {name}. The mop has been nominated separately.',
    '{name} did {n} chores, sighing audibly through every one of them.'] },
  { id: 'regular', stat: 'docket', title: 'Court Regular, Unpaid', lines: [
    '{name} aired the docket {n} times. The usher knows them by their cough.',
    '{n} days on the docket. {name} has a usual seat and gets cross when a juror is in it.',
    '{name} came to court {n} days running, which in some places is a sentence.'] },
  { id: 'challenged', stat: 'daily', title: 'Accepted Every Challenge, Won Some', lines: [
    '{name} took on {n} daily challenges and would like you to know the modifiers were rigged.',
    '{n} daily challenges. {name} has opinions about the backwards séance and will share them unprompted.',
    '{name} rose to the challenge {n} times and sat back down again {n} times.'] },
  { id: 'steady', stat: 'days', title: 'Turned Up, Repeatedly', lines: [
    '{name} pitched in on {n} different days. Consistency, the committee notes, is a form of nagging.',
    '{n} days of effort from {name}, which is {n} more than the brochure promised.',
    '{name} turned up on {n} days, which in this coven counts as devotion.'] },
  { id: 'panic', stat: 'late', title: 'The Sunday Panic', lines: [
    '{name} did {n} things on Sunday, all of them at once, all of them loudly.',
    '{n} on the last day. {name} works best under pressure, by which we mean only under pressure.',
    'Nothing all week, then {n} on Sunday. {name} calls it “pacing”.'] },
  { id: 'opinions', stat: 'notes', title: 'Most Opinions Pinned to a Board', lines: [
    '{name} pinned {n} notes to the board. Several were about the board.',
    '{n} notes from {name}. The magnets have unionised.',
    '{name} left {n} notes. None of them were thank you notes. One was nearly a thank you note.'] },
  { id: 'least', stat: 'least', title: 'Least Help', lines: [
    '{name} contributed {n}, which the committee has decided to call a statement.',
    'With {n} to their name, {name} is this week’s Least Help. It is not an insult. It is a measurement.',
    '{name} did {n}. The coven would like to thank them for being so easy to beat.',
    '{name} gave {n}. The trophy is small, light and easy to carry, like their week.'] },
  { id: 'present', stat: 'zero', title: 'Lifetime Achievement in Being Present', lines: [
    '{name} was in the coven all week, technically, in the way a coat is in a cupboard.',
    '{name} did nothing, but did it reliably, and the committee respects a routine.'] },
  { id: 'asleep', stat: 'zero', title: 'Quietest Member, Possibly Asleep', lines: [
    'Nothing from {name} this week. A mirror has been held to their mouth. It fogged. Award confirmed.',
    '{name} has been very quiet. The coven has decided to take this as a compliment.'] },
  { id: 'attended', stat: 'zero', title: 'Certificate of Attendance', lines: [
    '{name} attended. That is the whole citation. The certificate is the size of a stamp.',
    'For being here, {name} receives this certificate, which is also a coaster.'] }
];
export const AWARD_BY_ID = Object.fromEntries(AWARDS.map(a => [a.id, a]));

/* The ceremony. Judge Mortis hosts, because nobody else would. */
export const CEREMONY = {
  openings: [
    'Good evening, and welcome to the Shelfies, live from a shelf, in front of a studio audience that cannot leave.',
    'Welcome to the Shelfies. The envelopes have been sealed, steamed open and sealed again. Nothing has changed. Probably.',
    'Ladies, gentlemen and others: the Shelfies. Please hold your applause until the end, and then hold it a little longer.',
    'Welcome back to the Shelfies, the only awards ceremony judged entirely on evidence and partly on spite.',
    'Good evening. I am Judge Mortis, and I was asked to host the Shelfies last, and said yes first.',
    'The Shelfies, live. The red carpet is a tea towel. The tea towel is red now. Do not ask.',
    'Welcome to the Shelfies. Our sponsor tonight is Keith Removals: we take it away, you stop asking where.',
    'Good evening. The Shelfies are a celebration of effort, of community, and of keeping a very close eye on each other.',
    'Welcome to the Shelfies, where every member wins something and some of them will wish they had not.',
    'The Shelfies are on. Somebody has brought a plus one. The plus one is a moth. The moth has been seated.',
    'Good evening, coven. The audience has been warmed up. The audience is a ghost, so this took some doing.',
    'Welcome to the Shelfies. The trophies are real. The gold is not. The grudges are both.'
  ],
  envelopes: [
    'The envelope, please.', 'May I have the envelope. Thank you. It is damp. Of course it is.',
    'The next award. The envelope has been licked. Not by me.', 'And now. The envelope has a fingerprint on it. Everyone stay where you are.',
    'The envelope, please. It has been opened already, which saves time.', 'Next. This envelope is heavier than the others. That is never good.'
  ],
  reactions: [
    'The studio audience applauds. One ghost does not. It has its reasons.',
    'Polite applause, and one long, low moan from the back, which may also be applause.',
    'The audience rises. The audience sits back down. The audience is very old.',
    'Applause. A single rose is thrown. It is a rose that was on a grave this morning.',
    'The APPLAUSE sign flickers. The audience does its best.',
    'A gasp from the gallery. The gallery is a moth. The moth is very invested.',
    'Somebody whistles. Somebody else says “shh”. They are the same ghost.',
    'Applause, and the sound of a coffin lid being tapped in time.'
  ],
  closings: [
    'That concludes the Shelfies. The trophies are yours to keep. The tea towel is not.',
    'Goodnight. Same time next week, or sooner if anything is stolen.',
    'Thank you and goodnight. The new week has started. It is already watching you.',
    'That is the Shelfies. Please collect your trophy on the way out and your dignity at the desk.',
    'Goodnight from the Shelfies. If you did not win something you liked, you won something anyway. Look again.',
    'And we are off the air. The audience may now stop clapping. The audience cannot stop clapping. Somebody help the audience.'
  ]
};

/* ---------- little lines ---------- */
export const COVEN_LINES = {
  pitch: [
    'Up to six friends, one sigil, one week at a time. Do things you already do, and do them in company.',
    'A small group of friends, a weekly rite, a shared chest and a board for passing remarks.',
    'Six seats round a very small table. Bring your own grudge.'
  ],
  founded: [
    '{coven} is founded. The candle is yours. Do not let it go out, or do, and see who notices.',
    '{coven} exists now. There is a sigil, a chest and a board. There are no members but you. Yet.',
    'The founding papers are signed. {coven} has one member and a very confident sigil.'
  ],
  joined: [
    'You are in {coven}. Somebody has already put you on the rota.',
    'Welcome to {coven}. The dues are a custard cream. Pay them to the tin.',
    'You join {coven}. Everyone looks up, nods, and goes back to what they were not doing.'
  ],
  left: [
    'You leave {coven}. Your mug stays. That is the rule about mugs.',
    'You are no longer in {coven}. The minutes will say you resigned. The minutes say a lot of things.'
  ],
  inviteSent: [
    'Invitation sent to {name}. It is on good paper. Not the best paper.',
    '{name} has been invited. The decision is theirs, and so, the committee notes, is the blame.'
  ],
  inviteLine: [
    'Six seats, a weekly rite and a tin of dues. One seat has your name on it, in pencil.',
    'You are invited to sit at a very small table and do slightly more than you would alone.',
    'A coven wants you. The coven has not said why. The coven rarely does.'
  ],
  chestReady: [
    'The {chest} is ready. You helped, a bit. That is all it asks.',
    '{chest}: open. There is something in it for everyone who did anything.'
  ],
  awardsReady: [
    'The Shelfies are on. Every member won something. Some of you will want a recount.',
    'Last week’s Shelfies are in. The envelopes are damp. Of course they are.'
  ],
  newNotes: [
    'Someone has pinned something to the board.',
    'New notes on the board. One of them is about you, probably.'
  ]
};

// What a fresh notice board says until someone writes on it.
export const EMPTY_BOARD = 'Nothing pinned yet. The magnets are waiting. The magnets have all the time in the world.';

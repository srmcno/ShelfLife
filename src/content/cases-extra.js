/* Nine more weekly case files, appended to CASES in content/stories.js. With
   the original three that is twelve, one a week, a quarter of a year before
   the first one comes round again.

   The shape is exactly CASES: six beats, then `good` and `messy` endings.
   The engine gates three of the beats, so the copy has to ask for the right
   thing in the right place:
     beats[1]  useful care or a game      (gate: care below 72, or an arcade score)
     beats[2]  move {p} to B1             (gate: the first witness is in slot B1)
     beats[4]  a game, or two more care   (gate: another score, or two more care actions)
   beats[3] and beats[5] are the two beats with a second button: a witness to
   dismiss, and a verdict to hand down by decree.

   {p} is the first witness and {q} the second (The Reflection if the shelf
   has one resident), so no beat may need {q} to be a different person from
   {p}, and every resident is an it. The endings are shown without any names
   being filled in, so `good` and `messy` never use {p} or {q}.

   Each file is a different kind of mystery with a different kind of answer:
   a resident dodging a bath, a witness who is the author, a sleepwalking
   cook, a stranger waiting for a bus, a rumour with a coat, a giant who is
   you, an imaginary guest, a debt of one biscuit and a drip with no payoff.

   No dashes of any kind and no straight quotes: test/daily_content.test.mjs
   holds every line in here to that. */

export const CASES_EXTRA = [
  { id: 'tuesday', title: 'The week with no Tuesday', object: 'calendar',
    beats: ['The calendar goes from Monday straight to Wednesday. {p} is certain there was a Tuesday. It remembers the weather. It remembers being owed money on it.',
      '{p} says memory is a paid service. Give useful care or a game together and it will try to recall the Tuesday. It would like that noted as a tip, not a bribe.',
      'The last sighting of Tuesday was from B1, where the light comes in sideways and days are easier to count. Move {p} there. It holds the calendar up to the light like a banknote.',
      '{p} says Monday ended and Wednesday began with nothing in between. {q} says Tuesday was perfectly ordinary and everyone had one. The two accounts agree only about the biscuits.',
      'The calendar has neat torn edges. Not one Tuesday: every Tuesday, for eleven weeks. Earn their confidence with a game, or two more useful care actions, to find out who has been tidying them away.',
      'The torn pages are under a pebble in {q}’s bowl. Tuesday is bath day. {q} has gone eleven weeks without a bath and regards this as a calendar matter. Decide whether Tuesday comes back.'],
    good: 'Tuesday returns. Bath day moves to a Thursday invented for the purpose, so the calendar now has two. Nobody has asked what the original Thursday thinks of this. It is not taking calls.',
    messy: 'Tuesday is restored by decree and bath day returns with it. On Wednesday the calendar is found with a smaller, neater gap where Thursday was. It has been countersigned.' },

  { id: 'letters', title: 'The letters under the lamp', object: 'letters',
    beats: ['An unsigned letter has appeared under the lamp. It begins: “I have noticed some things about the way you all chew.” {p} read it aloud twice. Everyone recognised themselves, then everyone else.',
      '{p} offers to trace the handwriting once it has had useful care or a game together. It wants to be treated as an expert, not a suspect, and has asked for this to be put in writing.',
      'The letters all slope the same way, and the slope is steepest from B1. Move {p} there to check the angle. It asks whether the letters were written from that spot, and whether that should worry it.',
      '{p} says the letters came from {q}, whose handwriting leans. {q} says they came from {p}, whose handwriting also leans, but accusingly. Neither will lend the other a pen.',
      'A fifth letter arrives in a different hand. It accuses {p}, {q} and whoever wrote the first four. Earn their confidence with a game, or two more useful care actions, to find out who. It is the wittiest so far.',
      'All five were written by {p}, in five hands, because nobody answered the first. They ask for nothing but a reply. The last ends: “P.S. I chew like this because I am nervous.” Decide whether to write back.'],
    good: 'You write back. One line: “Noted.” The letters stop. The next morning a thank you note is under the lamp, unsigned, in a sixth hand.',
    messy: 'The letters are burned unread. The ashes are found under the lamp the next morning, with a note: “Received. Reply sent by other means.”' },

  { id: 'soup', title: 'The soup nobody made', object: 'soup',
    beats: ['The bowl has been full every morning for nine days. It is soup. Nobody on the shelf can cook, and the soup is good. {p} has had three helpings and says that is not the point.',
      '{p} will keep watch overnight, once it has had useful care or a game together. It says a witness on an empty stomach would only taste the evidence.',
      'The steam rises from B1. Move {p} there for the night watch. It brings a spoon and says the spoon is for defence.',
      '{p} says the cook is a ghost who misses having a kitchen. {q} says it is mould with ambitions. Both have eaten more soup than their theories allow.',
      'The ladle is still warm. So is the pillow beside the bowl, which has a dent in it. Whoever cooks is also asleep. Earn their confidence with a game, or two more useful care actions, then stay up and see who gets out of bed.',
      'At three in the morning {q} sits up, makes soup with its eyes shut and goes back to bed. The recipe is in a grandmother’s handwriting. Nobody here has had a grandmother. It is excellent soup. Decide whether to wake the cook.'],
    good: 'The cook is left to sleep. The soup keeps coming, and a small chair has appeared at the table for the grandmother. Nobody has asked who she is. She has seconds.',
    messy: 'The cook is woken. The soup stops. For a week everyone is polite, hungry and unwilling to be the one who says whose grandmother it was.' },

  { id: 'hat', title: 'The man in the hat across the road', object: 'hat',
    beats: ['A man in a hat is standing across the road, writing in a notebook. {p} says he is from the council. {q} says he is from the other council, the one that does the consequences.',
      '{p} will not face him until it has been properly seen to. Give useful care or play a game together. It wants the household to look as though it has nothing to hide, which takes a bath and a snack.',
      'The best view of the road is from B1. Move {p} there with the binoculars, which are a teaspoon. It holds the teaspoon to its face and confirms that he is still across the road.',
      '{p} says he has stood there for eleven days. {q} says he has stood there since before the shelf was built, in a different hat. Neither can say where he goes at night. Both are sure it is somewhere cheaper.',
      'He is standing beside a bus timetable that is fifty years out of date and corrected in pencil. Earn their confidence with a game, or two more useful care actions, to get close enough to read it.',
      'The man is not an inspector. He is waiting for the 14, which stopped running in 1974. The notebook is a list of every time it did not come. The last page says: “The house across the road waves.” Decide whether to ask him in.'],
    good: 'He is invited to wait indoors, by the window, with a biscuit. The 14 still has not come. Several residents have promised to tell him it is running late. They are very good at it.',
    messy: 'He is told about the 14. He thanks everyone, closes the notebook and walks off with great dignity. He is back at breakfast. It was, he says, nice to have it confirmed.' },

  { id: 'frank', title: 'The rumour about Frank', object: 'rumour',
    beats: ['A rumour is going round the shelf. Somebody called Frank is coming, and he is cold. {p} heard it from {q}, who heard it from the pipes. Nobody here knows a Frank.',
      '{p} will help find out who Frank is, after useful care or a game together. It wants to be in good shape to meet him. It has never been introduced to anyone cold and in a hurry.',
      'Frank was last mentioned near B1. Move {p} there to wait for him. It sets out a chair, a biscuit and a short speech, and asks you not to look at the speech.',
      '{p} says Frank is tall and wears a long coat. {q} says Frank is short and wears the same coat. Both say he is cold. Neither knows who started it. Both have been very helpful about the details.',
      'A second rumour has joined the first. Frank is bringing his family. They are also cold. Earn their confidence with a game, or two more useful care actions, to find out where this began.',
      'The weather forecast said a cold front was coming. By the third retelling it had a first name, a coat and a family. There is no Frank. {p} has made up a bed for him anyway. Decide what to tell the shelf.'],
    good: 'Frank is declared real. A place is laid for him at the first frost every year. He never comes, but a window mists over in the shape of a coat, and his family is understood to be parking.',
    messy: 'Frank is cancelled. Half the shelf goes into mourning for a man they never met. The other half is relieved, and has started asking about Gillian.' },

  { id: 'slippers', title: 'The footprints too big to be real', object: 'footprints',
    beats: ['Enormous footprints have appeared in the crumbs. They cross the shelf, stop at the bowl and go back the way they came. {p} says there is a giant. It says this calmly, like someone who has been expecting one.',
      '{p} will help take measurements after useful care or a game together. It has no tape measure and plans to use you. It asks you to hold still, because it is going to start at the heel.',
      'The prints are deepest beside B1. Move {p} there to stand in the biggest one. It fits entirely. It says it feels safe, which is not a good sign, and asks for a moment.',
      '{p} says the giant wears slippers. {q} says the giant wears slippers and leaves a mug in the sink. The testimony is suspiciously domestic. Somebody is protecting somebody.',
      'A second set of prints runs beside the first, small and in step, like a very short escort. Earn their confidence with a game, or two more useful care actions, to see who has been walking with it.',
      'The giant is you. The slippers are yours and so is the mug. The residents have known for weeks and were too polite to say, in case you were embarrassed. {p} calls it a safe distance. {q} calls it a spacious arrangement. Decide whether to admit it.'],
    good: 'You admit it. The residents are enormously relieved. They ask only that you keep to the same route, as they have been using the prints as a map, a clock and a small church.',
    messy: 'You decree that the giant has left. The prints are swept up and the residents nod gravely, avoiding your eye. The next morning there is a very small apology on the step, addressed to the giant, for the record.' },

  { id: 'pelham', title: 'The place laid for Mr Pelham', object: 'place setting',
    beats: ['A place has been laid at the end of the shelf for someone who does not live here. There is a plate, a napkin and a name card in careful handwriting: “Mr Pelham.” {p} did not lay it. {q} did not lay it. Both are sitting with their backs to it.',
      '{p} will tell you what it knows about Mr Pelham, after useful care or a game together. It says it has never met him, but it has opinions about the way he eats.',
      'Mr Pelham’s place faces B1, where the draught is. Move {p} there so they can see each other. It calls this a standoff. The chair makes no comment, which {p} takes as a win and also as a threat.',
      '{p} says Mr Pelham is a retired inspector who pays board. {q} says he is a retired nothing who does not. Both agree that his plate is warmer than it should be and that the napkin has been used.',
      'The salt has moved to Mr Pelham’s side. Somebody asked for it. Earn their confidence with a game, or two more useful care actions, to find out who was listening that closely.',
      '{q} invented Mr Pelham in a bad week. He has been listening ever since. He never interrupts, always agrees, and once, in private, said it was all your fault. {q} says he is only being honest. Decide whether the chair stays.'],
    good: 'The chair stays. Mr Pelham is introduced to the rest of the shelf and agrees with each of them in turn. By the end of the month he is on the committee, and nobody has seen him vote.',
    messy: 'The chair is taken away. Mr Pelham receives a polite letter and leaves at once, taking the salt. A resident lays a place for him anyway, and now he comes to dinner with a grievance.' },

  { id: 'receipt', title: 'The receipt behind the bowl', object: 'receipt',
    beats: ['A receipt has turned up behind the bowl. It is for “one shelf, assorted residents, used.” The date is long gone. The balance owing is not. {p} reads it twice and asks to sit down. It is already sitting down.',
      '{p} wants a second opinion on the figures, after useful care or a game together. It can do sums, it says, but not the sort where it is one of the items.',
      'The receipt is stamped with the exact shape of the underside of B1. Move {p} there to compare. It fits so well that {p} checks its own underside, just in case.',
      '{p} says the residents were bought on a payment plan and the shelf was the deposit. {q} says the shelf was a gift and the receipt is a prank. Neither can explain the fee for “handling.”',
      'A man with a clipboard has been seen asking after the previous tenant, who paid in advance and has not been seen since. Earn their confidence with a game, or two more useful care actions, before the clipboard gets here.',
      'The balance owing is one biscuit, overdue since 1987. The interest is a second biscuit and an apology. The previous tenant left both unpaid. The handling fee is a handshake. Decide whether to settle.'],
    good: 'Both biscuits are paid. The apology is read out in the previous tenant’s voice, which everyone agrees is awful. The receipt is stamped PAID and kept as a bookmark by someone who has never read a book.',
    messy: 'The debt is cancelled by decree. Within the hour a letter arrives from the Department of Cancelled Debts, to say that this is also a debt. The balance is two biscuits, an apology and a form.' },

  { id: 'drip', title: 'The drip that counts down', object: 'drip',
    beats: ['Something drips onto B1 every nine seconds. {p} has been counting since breakfast and says it is a countdown. It will not say to what. It says only that the numbers are lower than last week.',
      '{p} will keep counting after useful care or a game together. It says a countdown cannot be rushed but it can be well fed. It has drawn a chart. The chart ends in a skull, drawn very small, for scale.',
      'The drip lands at B1. Move {p} there to catch it in a bowl. It holds the bowl out like someone receiving a sentence. The first drop lands. Someone in the room says “one.” Nobody will say who.',
      '{p} says the drip is keeping time for something enormous. {q} says it is a tap. They have placed bets. {p} has staked its whole collection of buttons. {q} has put up its dignity, which is smaller.',
      'The bowl is nearly full. {p} has called the shelf to the edge of B1 to watch. Earn their confidence with a game, or two more useful care actions, before the last drop falls. Somebody has made banners.',
      'The bowl overflows at seven past three. Nothing happens. The silence is described as “enormous,” which is the word they had ready. It is a tap in the flat upstairs, and {p} would like it left on. Decide whether to call the plumber.'],
    good: 'The tap is left to drip. A second bowl is set out, then a third, and a rota drawn up. By Friday it is the oldest tradition on the shelf. Nobody knows what it counts down to, and the tradition has asked not to be told.',
    messy: 'The tap is fixed. The silence that follows is declared the loneliest on record. By evening somebody is dripping onto B1 on purpose, every nine seconds, with a thimble.' }
];

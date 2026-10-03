/* Fourteen more unholy chores, appended to CHORES in content/mayhem.js.

   Every chore maps to a deed the game already counts, so nothing here needs
   new engine code:
     care:food, care:fuss, care:clean   one need, from careFor() when it helps
     care                               any of the three
     mayhem                             an emergency resolved
     rounds                             the trolley (60 second cooldown)
     game                               a scoring Playroom, arcade or court run
     coffin                             a coffin opened
     check                              Notes, Check the shelf (8 second cooldown)

   `label` is the joke and `line` is the plain instruction under it. Both must
   fit a phone row, so labels stay under 32 characters and lines under 40. No
   dashes of any kind: test/daily_content.test.mjs enforces it. */

export const CHORES_EXTRA = [
  { id: 'feed2', deed: 'care:food', need: 2, label: 'Quiet the rumbling in the walls', line: 'Feed residents 2 times' },
  { id: 'feed4', deed: 'care:food', need: 4, label: 'Cater a wake nobody died at', line: 'Feed residents 4 times' },
  { id: 'fuss2', deed: 'care:fuss', need: 2, label: 'Be fond in public', line: 'Fuss residents 2 times' },
  { id: 'fuss4', deed: 'care:fuss', need: 4, label: 'Stroke until it stops growling', line: 'Fuss residents 4 times' },
  { id: 'wash1', deed: 'care:clean', need: 1, label: 'Scrub the evidence off one', line: 'Wash a resident once' },
  { id: 'wash3', deed: 'care:clean', need: 3, label: 'Run a bath for the haunted', line: 'Wash residents 3 times' },
  { id: 'care4', deed: 'care', need: 4, label: 'Perform four small mercies', line: 'Care for residents 4 times' },
  { id: 'care6', deed: 'care', need: 6, label: 'Make yourself indispensable', line: 'Care for residents 6 times' },
  { id: 'mayhem1', deed: 'mayhem', need: 1, label: 'Put out one small fire', line: 'Resolve 1 emergency' },
  { id: 'mayhem4', deed: 'mayhem', need: 4, label: 'Survive the late shift', line: 'Resolve 4 emergencies' },
  { id: 'rounds2', deed: 'rounds', need: 2, label: 'Be seen caring, twice', line: 'Do the rounds twice' },
  { id: 'game2', deed: 'game', need: 2, label: 'Take play very seriously', line: 'Finish 2 Playroom games' },
  { id: 'coffin2', deed: 'coffin', need: 2, label: 'Pay the undertaker twice', line: 'Open 2 coffins' },
  { id: 'check2', deed: 'check', need: 2, label: 'Eavesdrop with commitment', line: 'Check the shelf for notes twice' }
];

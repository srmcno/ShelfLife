import { SCHEMES } from './schemes.js';
import { CASES, VISITORS } from './stories.js';
import { RELICS } from './life.js';
import { escapadeAtVersion } from './escapades-legacy.js';

// These directions reconstruct what was recorded. They do not roll a second
// outcome, invent an award, or replace the original written account.
const prop = (id, shape, label) => ({ id, shape, label });
const pos = (x, y = 0, extra = {}) => ({ x, y, rotate: 0, scale: 1, opacity: 1, ...extra });
const actor = (x = 25, y = 0, gesture = 'look', extra = {}) => ({ ...pos(x, y, extra), gesture });
const beat = (label, actors, props = {}) => ({ label, actors, props });
const hidden = (x = 50, y = 0) => pos(x, y, { opacity: 0 });
function complete(key, setting, props, beats, guest) {
  let lastProps = Object.fromEntries(props.map(p => [p.id, hidden()]));
  let lastActors = [actor(25), actor(70, 0, 'look', { opacity: 0 })];
  return {
    key, setting, props,
    beats: beats.map(b => {
      lastProps = Object.fromEntries(props.map(p => [p.id, { ...lastProps[p.id], ...(b.props[p.id] || {}) }]));
      lastActors = b.actors.map((a, i) => ({ ...(lastActors[i] || actor(i ? 70 : 25)), ...a }));
      return { label: b.label, actors: lastActors.map(a => ({ ...a })), props: Object.fromEntries(Object.entries(lastProps).map(([id, p]) => [id, { ...p }])) };
    }),
    ...(guest ? { guest } : {})
  };
}
function entry(setting, props, setup, branches) { return { setting, props, setup, branches }; }

// Each branch has its own physical consequence. Props persist between beats,
// then complete() materialises every state so replay and scrubbing agree.
const DIRECTIONS = {
  raisin: entry('shelf', [prop('raisin', 'raisin', 'The alleged uncle'), prop('shroud', 'tissue', 'Tissue shroud'), prop('grave', 'grave', 'The raisin’s grave'), prop('bed', 'pillow', 'Recovery bed')],
    beat('The deceased is a raisin', [actor(28, 0, 'look')], { raisin: pos(56) }), {
      0: [beat('A tissue burial', [actor(45, 0, 'fuss')], { raisin: hidden(56, -12), shroud: pos(56), grave: pos(61) }), beat('Recovered for the wake', [actor(53, 0, 'catch')], { raisin: pos(54, 35), shroud: pos(61, 0, { scale: .6 }) }), beat('The guest of honour is eaten', [actor(53, 0, 'eat')], { raisin: hidden(53, 38) })],
      1: [beat('The funeral is cancelled', [actor(43, 0, 'deny')], { raisin: pos(58, 10), bed: pos(58), grave: hidden() }), beat('Visiting hours are enforced', [actor(45, 0, 'guard')], { raisin: pos(58, 10), bed: pos(58) })],
      alone: [beat('An unaccompanied eulogy', [actor(43, 0, 'testify')], { raisin: pos(57) }), beat('Generosity, consumed', [actor(55, 0, 'eat')], { raisin: hidden(55, 36) })]
    }),
  heist: entry('shelf', [prop('crumb', 'crumb', 'The stolen crumb'), prop('mask', 'mask', 'Tiny disguise')],
    beat('The target is identified', [actor(18, 0, 'peek')], { crumb: pos(68), mask: pos(18, 38, { scale: .6 }) }), {
      0: [beat('The first theft', [actor(63, 0, 'catch')], { crumb: pos(62, 32), mask: pos(63, 38, { scale: .6 }) }), beat('Dropped at the getaway', [actor(43, 0, 'bump')], { crumb: pos(48), mask: pos(43, 38, { scale: .6 }) }), beat('Stolen a second time', [actor(46, 0, 'catch')], { crumb: pos(46, 34), mask: pos(46, 38, { scale: .6 }) })],
      1: [beat('An honest snack is offered', [actor(43, 0, 'look')], { crumb: pos(48, 20), mask: pos(43, 38, { scale: .6 }) }), beat('The disguise stays on', [actor(46, 0, 'eat')], { crumb: hidden(46, 35), mask: pos(46, 38, { scale: .6 }) })],
      alone: [beat('The crumb is taken', [actor(66, 0, 'catch')], { crumb: pos(63, 27), mask: pos(66, 38, { scale: .6 }) }), beat('Visible on both sides', [actor(62, 0, 'peek')], { crumb: pos(62, 12, { scale: .55 }), mask: pos(62, 38, { scale: .6 }) })]
    }),
  seance: entry('night', [prop('circle', 'spirit-circle', 'The spirit circle'), prop('cloth', 'tissue', 'Cleaning cloth')],
    beat('Dust is arranged in a circle', [actor(31, 0, 'fuss')], { circle: pos(53, 0, { scale: 1.5 }) }), {
      0: [beat('A message crosses the plank', [actor(39, 0, 'testify')], { circle: pos(53) }), beat('The other side of the shelf replies', [actor(77, 0, 'listen')], { circle: pos(53, 0, { scale: .8 }) })],
      1: [beat('The portal is wiped', [actor(48, 0, 'clean')], { cloth: pos(52, 5), circle: pos(53, 0, { scale: .7 }) }), beat('Only a clean patch remains', [actor(39, 0, 'deny')], { cloth: pos(73), circle: hidden(53) })],
      alone: [beat('Something builds in the nose', [actor(46, 0, 'anticipate')], { circle: pos(53) }), beat('A sneeze disperses the gathering', [actor(42, 8, 'bump')], { circle: pos(76, 26, { scale: 1.7, opacity: .2 }) })]
    }),
  escape: entry('shelf', [prop('thread', 'rope', 'Escape thread'), prop('card', 'paper', 'A very local postcard'), prop('bed', 'pillow', 'Improved accommodation')],
    beat('The thread is packed', [actor(24, 0, 'fuss')], { thread: pos(36) }), {
      0: [beat('Across to the next slot', [actor(72, 0, 'walk')], { thread: pos(48, 0, { rotate: 90 }) }), beat('A postcard from within sight', [actor(72, 0, 'write')], { card: pos(73, 22, { scale: .7 }) })],
      1: [beat('The accommodation improves', [actor(39, 0, 'look')], { bed: pos(55), thread: pos(27, 0, { scale: .6 }) }), beat('Departure is postponed', [actor(55, 10, 'nap')], { bed: pos(55) })],
      alone: [beat('An ambitious few inches', [actor(41, 0, 'walk')], { thread: pos(32) }), beat('An assumed posture at the nameplate', [actor(41, 0, 'peek', { rotate: -12 })], { card: pos(40, 9, { scale: .7 }) })]
    }),
  tooth: entry('shelf', [prop('bread', 'crumb', 'A tooth made of bread'), prop('pillow', 'pillow', 'The fairy’s collection point')],
    beat('The tooth is visibly bread', [actor(32, 0, 'look')], { bread: pos(57, 7, { scale: .85 }), pillow: pos(72) }), {
      0: [beat('Bread beneath the pillow', [actor(57, 0, 'fuss')], { bread: hidden(67), pillow: pos(67, 6) }), beat('A smaller piece in the morning', [actor(51, 0, 'look')], { bread: pos(64, 4, { scale: .35 }), pillow: pos(78, 0, { rotate: 18 }) })],
      1: [beat('The bread tooth is brushed', [actor(52, 0, 'clean')], { bread: pos(56, 17, { scale: .6 }) }), beat('Bread paste is the new business', [actor(42, 0, 'testify')], { bread: pos(58, 0, { scale: .25, rotate: 90 }), pillow: pos(76, 0, { opacity: .4 }) })],
      alone: [beat('Waiting for the fairy', [actor(57, 0, 'listen')], { bread: pos(58, 5) }), beat('A difficult night for bread', [actor(58, 7, 'nap', { rotate: 18 })], { bread: pos(58, 0, { scale: .35 }) })]
    }),
  haunt: entry('night', [prop('sheet', 'tissue', 'Haunting tissue'), prop('wall', 'wall', 'The actual wall'), prop('complaint', 'paper', 'Complaint about the haunting')],
    beat('Ghost training begins', [actor(36, 0, 'sneak')], { wall: pos(81, 20, { scale: 1.2 }) }), {
      0: [beat('A tissue says boo', [actor(44, 8, 'surprise')], { sheet: pos(44, 34, { scale: 1.1 }) }), beat('Scared through the tissue', [actor(29, 0, 'fuss')], { sheet: pos(29, 34, { scale: 1.1 }) })],
      1: [beat('Through an imaginary wall', [actor(63, 0, 'walk')]), beat('The real wall ends rehearsal', [actor(76, 0, 'bump', { rotate: -14 })], { wall: pos(81, 20, { rotate: 3 }) })],
      alone: [beat('Haunting the occupied slot', [actor(45, 8, 'sneak')]), beat('Investigating its own complaint', [actor(42, 0, 'read')], { complaint: pos(53, 18) })]
    }),
  coup: entry('shelf', [prop('border', 'hair', 'The national border'), prop('flag', 'flag', 'The sovereign claim')],
    beat('A hair becomes a frontier', [actor(29, 0, 'testify')], { border: pos(52), flag: pos(31, 24) }), {
      0: [beat('The victory speech', [actor(48, 0, 'testify')], { flag: pos(48, 27) }), beat('The border follows its foot', [actor(73, 0, 'walk')], { border: pos(70, 0, { rotate: 25 }), flag: pos(73, 27) })],
      1: [beat('A clean patch is negotiated', [actor(49, 0, 'clean')], { border: pos(71) }), beat('It elects itself', [actor(52, 0, 'celebrate')], { flag: pos(53, 32) })],
      alone: [beat('The coup is announced', [actor(35, 0, 'testify')]), beat('Nobody moves', [actor(35, 0, 'guard')], { border: pos(52), flag: pos(31, 24) })]
    }),
  pet: entry('shelf', [prop('lint', 'dust', 'The adopted lint'), prop('bed', 'pillow', 'A bed for something smaller')],
    beat('The lint stays perfectly', [actor(31, 0, 'point')], { lint: pos(57, 0, { scale: .45 }) }), {
      0: [beat('Tucked in once', [actor(49, 0, 'fuss')], { lint: pos(57, 6, { scale: .45 }), bed: pos(57, 0, { scale: .8 }) }), beat('Tucked in again', [actor(53, 0, 'fuss')], { lint: pos(57, 5, { scale: .45 }), bed: pos(57, 0, { scale: .8 }) })],
      1: [beat('A little bed is built', [actor(44, 0, 'clean')], { bed: pos(60, 0, { scale: .8 }) }), beat('The lint takes the diagonal', [actor(34, 0, 'look')], { lint: pos(60, 9, { scale: .75, rotate: 40 }) })],
      alone: [beat('The lint is missing', [actor(43, 0, 'look')], { lint: hidden(43, 19) }), beat('A reunion at no distance', [actor(43, 0, 'fuss')], { lint: pos(43, 19, { scale: .4 }) })]
    }),
  museum: entry('shelf', [prop('hair', 'hair', 'The museum’s hair'), prop('small', 'hair', 'Gift-shop hair'), prop('frame', 'frame', 'The exhibit frame')],
    beat('A museum opens around a hair', [actor(26, 0, 'testify')], { hair: pos(56, 22), frame: pos(56, 22) }), {
      0: [beat('A tour around the hair', [actor(70, 0, 'point')]), beat('The gift shop is smaller', [actor(44, 0, 'offer')], { small: pos(45, 27, { scale: .4 }) })],
      1: [beat('The exhibit is cleaned', [actor(52, 0, 'clean')], { hair: pos(59, 37, { opacity: .3 }) }), beat('The frame exhibits absence', [actor(31, 0, 'testify')], { hair: hidden(59, 45), frame: pos(56, 22) })],
      alone: [beat('The curator enters the exhibit', [actor(55, 0, 'walk')]), beat('Part of the collection', [actor(55, 0, 'bump', { rotate: 13 })], { hair: pos(55, 25, { scale: 1.4, rotate: 38 }) })]
    }),
  monster: entry('under-shelf', [prop('thread', 'rope', 'Safety thread'), prop('dust', 'dust', 'The larger dust bunny'), prop('light', 'lamp', 'Inspection lamp'), prop('shadow', 'ghost', 'Its own shadow')],
    beat('Bait volunteers itself', [actor(28, 0, 'peek')], { thread: pos(35, -15, { rotate: 15 }) }), {
      0: [beat('Under the shelf', [actor(47, -22, 'look')], { thread: pos(43, -4), dust: pos(69, -25, { scale: 1.5 }) }), beat('A larger candidate for management', [actor(43, -22, 'point')], { dust: pos(69, -25, { scale: 1.5 }) })],
      1: [beat('The lamp reveals a shadow', [actor(48, -18, 'look')], { light: pos(24, 22), shadow: pos(67, -18, { scale: 1.1, opacity: .5 }) }), beat('One claimant comes back', [actor(33, 0, 'walk')], { shadow: pos(67, -18, { opacity: .25 }) })],
      alone: [beat('It disappears below the edge', [actor(51, -29, 'peek')]), beat('The thing beneath is itself', [actor(51, -29, 'testify')], { thread: pos(43, -4) })]
    }),
  will: entry('shelf', [prop('will', 'paper', 'Its own will'), prop('pen', 'pen', 'Signing pen'), prop('crumb', 'crumb', 'The disputed inheritance')],
    beat('Everything is left to itself', [actor(30, 0, 'read')], { will: pos(52, 18), pen: pos(45, 5), crumb: pos(72) }), {
      0: [beat('Signed and immediately contested', [actor(46, 0, 'write')], { pen: pos(52, 23, { rotate: -30 }) }), beat('The crumb is retained', [actor(62, 0, 'guard')], { crumb: pos(62, 26) })],
      1: [beat('The will is torn up', [actor(48, 0, 'deny')], { will: pos(50, 10, { scale: .4, rotate: 65 }) }), beat('Both inches of a walk', [actor(69, 0, 'walk')], { will: pos(37, 0, { scale: .4, rotate: 90 }) })],
      alone: [beat('The will is read aloud', [actor(39, 0, 'testify')]), beat('The reader objects', [actor(57, 0, 'deny')], { will: pos(50, 24, { rotate: -10 }) })]
    }),
  shadow: entry('night', [prop('shadow', 'ghost', 'The resident’s shadow'), prop('pillow', 'pillow', 'The recommended nap')],
    beat('Standing still as a trap', [actor(34, 0, 'guard')], { shadow: pos(58, 0, { opacity: .4 }) }), {
      0: [beat('They approach together', [actor(44, 0, 'offer')], { shadow: pos(51, 0, { opacity: .4 }) }), beat('A simultaneous truce', [actor(47, 0, 'fuss')], { shadow: pos(49, 0, { opacity: .3 }) })],
      1: [beat('Eyes close', [actor(39, 9, 'nap')], { pillow: pos(39), shadow: pos(58, 0, { opacity: .4 }) }), beat('No shadow is reported', [actor(39, 9, 'nap')], { shadow: pos(58, 0, { opacity: .4 }) })],
      alone: [beat('Following the offender', [actor(71, 0, 'walk')], { shadow: pos(81, 0, { opacity: .4 }) }), beat('Back at the beginning', [actor(34, 0, 'point')], { shadow: pos(58, 0, { opacity: .4 }) })]
    }),
  medium: entry('night', [prop('board', 'board', 'The spirit board'), prop('raisin', 'raisin', 'The talkative raisin'), prop('pointer', 'button', 'The planchette')],
    beat('The raisin takes the line', [actor(30, 0, 'listen')], { board: pos(55), raisin: pos(74, 10), pointer: pos(50, 8, { scale: .45 }) }), {
      0: [beat('A follow-up about the previous owner', [actor(42, 0, 'testify')], { pointer: pos(55, 8, { scale: .45 }) }), beat('The planchette reaches GOODBYE', [actor(36, 0, 'look')], { pointer: pos(65, 8, { scale: .45 }) })],
      1: [beat('A polite GOODBYE', [actor(45, 0, 'offer')], { pointer: pos(65, 8, { scale: .45 }) }), beat('The raisin keeps talking', [actor(32, 0, 'deny')], { raisin: pos(74, 16, { rotate: -9 }) })],
      alone: [beat('The raisin comes through clearly', [actor(39, 0, 'listen')], { raisin: pos(66, 22) }), beat('The previous owner remains on hold', [actor(39, 0, 'listen')], { pointer: pos(48, 8, { scale: .45 }) })]
    }),
  bowlcoup: entry('shelf', [prop('bowl', 'bowl', 'Snack Bowl'), prop('crumb', 'crumb', 'The entire treasury'), prop('flag', 'flag', 'The claimant’s flag')],
    beat('The bowl refuses to comment', [actor(28, 0, 'testify')], { bowl: pos(63), crumb: pos(63, 12, { scale: .6 }), flag: pos(30, 26) }), {
      0: [beat('The treasury is taken from inside', [actor(63, 13, 'eat')], { crumb: hidden(63, 33), flag: pos(63, 48) }), beat('It installs itself as the bowl', [actor(63, 8, 'guard')], { bowl: pos(63), flag: pos(63, 43) })],
      1: [beat('The bowl’s surrender is accepted', [actor(47, 0, 'testify')]), beat('Eating in a supervisory capacity', [actor(52, 0, 'eat')], { crumb: hidden(54, 29), bowl: pos(63), flag: pos(45, 28) })],
      alone: [beat('The bowl is toppled', [actor(63, 0, 'bump')], { bowl: pos(63, 29, { rotate: 180 }), crumb: pos(77) }), beat('Government continues underneath', [actor(63, 0, 'testify', { scale: .75 })], { bowl: pos(63, 23, { rotate: 180 }) })]
    }),
  parachute: entry('shelf', [prop('tissue', 'tissue', 'One-ply parachute'), prop('pad', 'pillow', 'Landing pad')],
    beat('One ply at the edge', [actor(75, 36, 'peek')], { tissue: pos(75, 74) }), {
      0: [beat('The tissue opens', [actor(71, 13, 'jump')], { tissue: pos(71, 54, { scale: 1.3 }) }), beat('The tissue lands first', [actor(71, 7, 'bump')], { tissue: pos(71, -18, { rotate: 12 }) }), beat('A hammock by accident', [actor(71, -12, 'nap', { rotate: 15 })], { tissue: pos(71, -18) })],
      1: [beat('The landing pad is inspected', [actor(70, 36, 'look')], { pad: pos(70, -18) }), beat('The jump is postponed', [actor(48, 36, 'deny')], { tissue: pos(48, 37, { scale: .7, rotate: 35 }) })],
      alone: [beat('Neither parachute nor fall helps', [actor(72, -14, 'bump')], { tissue: pos(75, -19, { rotate: 60 }) }), beat('Back, with one eye covered', [actor(35, 0, 'look')], { tissue: pos(36, 39, { scale: .5, rotate: 25 }) })]
    }),
  trial: entry('court', [prop('gavel', 'gavel', 'The judge’s gavel'), prop('crumb', 'crumb', 'Crumb evidence'), prop('jury', 'dust', 'The dust jury')],
    beat('The defendant also presides', [actor(33, 0, 'testify')], { gavel: pos(36, 30), crumb: pos(57), jury: pos(79) }), {
      0: [beat('The jury blows away', [actor(42, 0, 'look')], { jury: pos(93, 24, { opacity: .2 }) }), beat('An acquittal consumes the evidence', [actor(53, 0, 'eat')], { crumb: hidden(53, 31), jury: hidden(98, 29) })],
      1: [beat('It finds itself guilty', [actor(38, 0, 'gavel')], { gavel: pos(43, 9, { rotate: 25 }) }), beat('Sentenced to the corner', [actor(87, 0, 'deny', { rotate: 12 })], { crumb: pos(57) })],
      alone: [beat('No verdict from the dust', [actor(47, 0, 'listen')], { jury: pos(79) }), beat('Serving life where it already lives', [actor(33, 0, 'guard')], { gavel: pos(36), crumb: pos(57) })]
    }),
  hostage: entry('shelf', [prop('crumb', 'crumb', 'The original hostage'), prop('large', 'crumb', 'The larger demand')],
    beat('A crumb is being held', [actor(39, 0, 'guard')], { crumb: pos(42, 24, { scale: .55 }) }), {
      0: [beat('An exchange releases the first crumb', [actor(53, 0, 'offer')], { crumb: pos(28), large: pos(56, 22, { scale: 1.2 }) }), beat('The larger hostage enters talks', [actor(56, 0, 'eat')], { large: pos(56, 33, { scale: .7 }), crumb: pos(28) })],
      1: [beat('The larger demand arrives', [actor(43, 0, 'catch')], { large: pos(59, 7, { scale: 1.2 }) }), beat('The original knew too much', [actor(43, 0, 'eat')], { crumb: hidden(43, 31), large: pos(59, 7, { scale: 1.2 }) })],
      alone: [beat('Nobody calls', [actor(39, 0, 'listen')]), beat('The hostage is blamed and eaten', [actor(39, 0, 'eat')], { crumb: hidden(39, 31) })]
    }),
  union: entry('night', [prop('sign', 'flag', 'Strike sign'), prop('lamp', 'lamp', 'The distant light')],
    beat('The switch has not been informed', [actor(26, 0, 'testify')], { sign: pos(28, 32), lamp: pos(81, 20) }), {
      0: [beat('Standing still is the strike', [actor(37, 0, 'guard')], { sign: pos(39, 33) }), beat('Bedtime darkness is claimed as victory', [actor(37, 0, 'celebrate')], { lamp: pos(81, 20, { opacity: .3 }) })],
      1: [beat('An extra hour is offered', [actor(46, 0, 'offer')], { lamp: pos(76, 20, { scale: 1.1 }) }), beat('Total victory is recorded', [actor(46, 0, 'celebrate')], { sign: pos(48, 34), lamp: pos(76, 20, { scale: 1.1 }) })],
      alone: [beat('No tools exist to be downed', [actor(36, 0, 'guard')]), beat('The ordinary bedtime arrives', [actor(36, 0, 'look')], { lamp: pos(81, 20, { opacity: .3 }) })]
    }),
  forgery: entry('shelf', [prop('will', 'paper', 'Your already-signed will'), prop('pen', 'pen', 'The accommodating crayon'), prop('mat', 'pillow', 'Filing mat')],
    beat('Your signature is ready', [actor(31, 0, 'write')], { will: pos(50, 18), pen: pos(44, 24), mat: pos(74) }), {
      0: [beat('Filed under the mat', [actor(66, 0, 'fuss')], { will: hidden(74), mat: pos(74, 4) }), beat('Checking on you closely', [actor(40, 0, 'peek')], { pen: pos(62) })],
      1: [beat('Your name is corrected', [actor(47, 0, 'write')], { pen: pos(52, 24, { rotate: -28 }) }), beat('Looking for a different you', [actor(73, 0, 'look')], { will: pos(59, 20), pen: pos(45) })],
      alone: [beat('Executor, beneficiary and witness sign', [actor(48, 0, 'write')], { pen: pos(54, 27) }), beat('The witness questions the executor', [actor(35, 0, 'deny')], { will: pos(50, 24, { rotate: -12 }) })]
    }),
  tunnel: entry('shelf', [prop('spoon', 'spoon', 'Digging spoon'), prop('scratch', 'hair', 'The scratch in solid wood')],
    beat('A scratch is the entire tunnel', [actor(34, 0, 'look')], { scratch: pos(54, 0, { scale: .65, rotate: 90 }) }), {
      0: [beat('Six hours with a spoon', [actor(47, 0, 'dig')], { spoon: pos(54, 10, { rotate: -30 }) }), beat('A longer scratch, no dirt', [actor(47, 0, 'offer')], { scratch: pos(57, 0, { scale: 1.2, rotate: 90 }), spoon: pos(62) })],
      1: [beat('The open shelf is noticed', [actor(39, 0, 'look')]), beat('Walking across works', [actor(79, 0, 'walk')], { scratch: pos(54, 0, { scale: .65, rotate: 90 }) })],
      alone: [beat('Digging reaches the varnish', [actor(48, 0, 'dig')]), beat('The varnish holds', [actor(47, 0, 'guard')], { scratch: pos(54, 0, { scale: .7, rotate: 90 }) })]
    }),
  insurance: entry('shelf', [prop('policy', 'paper', 'The insurance policy'), prop('pen', 'pen', 'Certificate pen'), prop('crumb', 'crumb', 'The funeral payout')],
    beat('An impermanent death is proposed', [actor(35, 0, 'read')], { policy: pos(58, 18), pen: pos(65) }), {
      0: [beat('The body signs its own certificate', [actor(46, 0, 'write', { rotate: 80 })], { pen: pos(53, 20), policy: pos(57, 10) }), beat('The crumb pays for the funeral', [actor(46, 0, 'nap', { rotate: 80 })], { crumb: pos(64), pen: pos(70) })],
      1: [beat('The permanence clause is found', [actor(48, 0, 'read')], { policy: pos(55, 24) }), beat('An appeal on grounds of tiredness', [actor(39, 0, 'testify')], { policy: pos(57, 17) })],
      alone: [beat('Up to check for a cheque', [actor(64, 0, 'peek')], { policy: pos(70, 15) }), beat('Dead again, more carefully', [actor(35, 0, 'nap', { rotate: 80 })], { policy: pos(57) })]
    }),
  moth: entry('night', [prop('moth', 'moth', 'The unconsenting pet moth'), prop('wing', 'wing', 'The one retained moth wing'), prop('lamp', 'lamp', 'The moth’s preferred company'), prop('bed', 'pillow', 'The moth’s bed')],
    beat('The moth has agreed to nothing', [actor(31, 0, 'offer')], { moth: pos(61, 46, { scale: 1.3 }), lamp: pos(80, 12) }), {
      0: [beat('The moth leaves its bed for the lamp', [actor(45, 0, 'fuss')], { bed: pos(51), moth: pos(79, 55, { rotate: -12 }) }), beat('The lamp is put to bed instead', [actor(71, 0, 'fuss')], { bed: pos(80), lamp: pos(80, 12), moth: pos(80, 57) })],
      1: [beat('The moth is formally released', [actor(40, 0, 'offer')]), beat('The moth stays', [actor(32, 0, 'deny')], { moth: pos(61, 46, { scale: 1.3 }) })],
      alone: [beat('The moth leaves', [actor(40, 0, 'look')], { moth: pos(95, 74, { opacity: .2 }) }), beat('One wing is kept as visiting rights', [actor(46, 0, 'fuss')], { moth: hidden(95, 74), wing: pos(47, 25, { scale: .7, rotate: 45 }), lamp: pos(80, 12) })]
    }),
  wedding: entry('night', [prop('lamp', 'lamp', 'The betrothed lamp'), prop('crumb', 'crumb', 'The reception crumb'), prop('dust', 'dust', 'The back-row guests')],
    beat('The lamp has flickered twice', [actor(39, 0, 'offer')], { lamp: pos(61, 8), crumb: pos(52), dust: pos(16) }), {
      0: [beat('Vows to a warm silence', [actor(49, 0, 'testify')]), beat('One inch left for the honeymoon', [actor(42, 0, 'fuss')], { lamp: pos(54, 8) })],
      1: [beat('The objection is heard', [actor(43, 0, 'listen')]), beat('Married faster, guests at the back', [actor(53, 0, 'celebrate')], { dust: pos(15, 0, { scale: 1.3 }), lamp: pos(61, 8) })],
      alone: [beat('No witnesses attend the vows', [actor(49, 0, 'testify')], { dust: hidden(16) }), beat('The lamp’s half remains', [actor(49, 0, 'eat')], { crumb: pos(61, 0, { scale: .45 }) })]
    }),
  duel: entry('shelf', [prop('pillow', 'pillow', 'Dawn duelling pillow'), prop('crumb', 'crumb', 'The crumb projectile')],
    beat('Honour requires lying down', [actor(35, 5, 'nap', { rotate: 75 })], { pillow: pos(35), crumb: pos(41, 16, { scale: .6 }) }), {
      0: [beat('Ten paces on its back', [actor(60, 5, 'walk', { rotate: 75 })], { pillow: pos(60), crumb: pos(62, 70, { scale: .6 }) }), beat('The shot lands on its own chest', [actor(60, 5, 'nap', { rotate: 75 })], { crumb: pos(60, 22, { scale: .6 }) })],
      1: [beat('Apology accepted, shot fired', [actor(35, 5, 'offer', { rotate: 75 })], { crumb: pos(35, 72, { scale: .6 }) }), beat('The projectile returns', [actor(35, 8, 'bump', { rotate: 75 })], { crumb: pos(35, 27, { scale: .6 }) })],
      alone: [beat('Counting ten without an opponent', [actor(35, 5, 'listen', { rotate: 75 })]), beat('Asleep before a shot', [actor(35, 5, 'nap', { rotate: 75 })], { crumb: pos(41, 16, { scale: .6 }) })]
    }),
  tuesday: entry('night', [prop('clock', 'clock', 'The appointment window'), prop('book', 'paper', 'The appointments book'), prop('door', 'door', 'The client’s door')],
    beat('Two till four is reserved', [actor(32, 0, 'read')], { clock: pos(75, 24), book: pos(45, 12), door: pos(62, 12) }), {
      0: [beat('Breathing behind the client at two', [actor(56, 0, 'sneak')], { clock: pos(75, 24, { rotate: -8 }) }), beat('At four, a request for feedback', [actor(38, 0, 'offer')], { clock: pos(75, 24, { rotate: 8 }), book: pos(46, 24) })],
      1: [beat('An empty room is haunted', [actor(63, 0, 'sneak')], { door: pos(63, 12, { opacity: .5 }) }), beat('Thursday is entered in the book', [actor(39, 0, 'write')], { book: pos(47, 22) })],
      alone: [beat('Haunting the absent client', [actor(62, 0, 'sneak')], { door: pos(63, 12, { opacity: .5 }) }), beat('An unsupported scream is written down', [actor(40, 0, 'write')], { book: pos(47, 22) })]
    }),
  exhume: entry('night', [prop('raisin', 'raisin', 'The buried raisin'), prop('small', 'raisin', 'The smaller raisin'), prop('grave', 'grave', 'The original burial'), prop('spoon', 'spoon', 'Tool and witness'), prop('crumbs', 'crumb', 'A crumb cairn'), prop('note', 'paper', 'A request to stay put')],
    beat('A spoon witnesses the grave', [actor(33, 0, 'look')], { grave: pos(59), spoon: pos(41, 9), raisin: hidden(59, -13) }), {
      0: [beat('The raisin is dug up', [actor(49, 0, 'dig')], { raisin: pos(60, 16), spoon: pos(56, 8, { rotate: -35 }) }), beat('Reburied with written instructions', [actor(43, 0, 'write')], { raisin: hidden(59, -13), note: pos(61, 0, { scale: .5 }), spoon: pos(72) })],
      1: [beat('The burial is left undisturbed', [actor(43, 0, 'fuss')], { crumbs: pos(59, 12), raisin: hidden(59, -13) }), beat('The cairn disappears, the raisin stays', [actor(34, 0, 'look')], { crumbs: hidden(59, 12), raisin: hidden(59, -13) })],
      alone: [beat('An exhumation at three', [actor(48, 0, 'dig')], { raisin: pos(57, 19), spoon: pos(52, 5, { rotate: -30 }) }), beat('A smaller relative is discovered', [actor(43, 0, 'surprise')], { small: pos(64, 9, { scale: .45 }), raisin: pos(56, 14) })]
    })
};

// Exact current prose is the strongest legacy signal. The narrow fallback
// phrases cover earlier edits without turning a title into an assumed ending.
const LEGACY = {
  raisin: [/buried.*tissue|ate it at the wake/i, /cancelled the funeral|raisin is in recovery/i, /service without you|deceased was eaten during/i],
  heist: [/stole the crumb, dropped|repeat offender/i, /accepted the snack|wore the tiny mask anyway/i, /hid behind the crumb|heist alone/i],
  seance: [/other side of the shelf|acoustics were excellent/i, /wiped away the spirit circle|afterlife smells of lemon/i, /summoned.*sneeze/i],
  escape: [/reached the next slot|sent a postcard/i, /postponed the escape/i, /as far as the nameplate|assumed posture/i],
  tooth: [/bread tooth under a pillow|smaller piece of bread/i, /brushed the bread tooth|become toothpaste/i, /fell asleep on the tooth/i],
  haunt: [/scared itself|held through the tissue/i, /real wall was behind|rehearsal ended early/i, /complaint about the haunting|investigate itself/i],
  coup: [/border stuck to its foot|country is mobile/i, /exchange for democracy|has elected itself/i, /continuity of government/i],
  pet: [/tucked the lint in/i, /lint sleeps diagonally/i, /lost the lint|tearful reunion, at no distance/i],
  museum: [/gift shop sold|led you round the hair/i, /museum of absence/i, /tangled in the exhibit|part of the collection/i],
  monster: [/bigger dust bunny|leaving it in charge/i, /met its shadow under|brought one back/i, /briefly the thing under/i],
  will: [/contested it.*settled out of court|kept the crumb/i, /torn up the will|both inches of it/i, /own will aloud|second opinion from itself/i],
  shadow: [/reached for each other|called it a truce/i, /closed its eyes|reported the shadow gone/i, /following its shadow|gave it a warning/i],
  medium: [/also very dry at the end|gone back to GOODBYE/i, /raisin has kept talking|boundaries.*cursive/i, /raisin came through clearly|waiting on the line/i],
  bowlcoup: [/ate the entire treasury|installed itself as the bowl/i, /bowl stays on|supervisory capacity/i, /under the bowl when it toppled|government continues from under/i],
  parachute: [/tissue.*landed first|like a hammock/i, /postponed the jump|bigger tissue and a smaller fall/i, /parachute did nothing|tissue over one eye/i],
  trial: [/was acquitted|ate the evidence in celebration/i, /was found guilty by itself|sentenced itself to the corner/i, /jury hung|life sentence in its slot/i],
  hostage: [/released the crumb for a bigger|talks are ongoing/i, /ate the hostage anyway|crumb knew too much/i, /nobody called|statement blaming the crumb/i],
  union: [/stood still for an hour|claiming that/i, /extra hour of lamp|recorded you as management/i, /downed tools|switch was not informed/i],
  forgery: [/filed the will under the mat|checking on you each morning/i, /corrected the spelling|slightly different you/i, /named itself executor|witness has raised concerns/i],
  tunnel: [/dug for six hours|scratch is longer/i, /walked across it|tunnel would have been quicker/i, /reached the varnish|varnish is holding/i],
  insurance: [/signed the certificate itself|payout is one crumb/i, /deaths must be permanent|grounds that it is very tired/i, /got up at five|dead again now/i],
  moth: [/put the lamp to bed|everyone is at the lamp/i, /letting it go every hour|moth stayed/i, /kept one wing|visiting rights/i],
  wedding: [/honeymooning one inch|lamp said nothing, warmly/i, /married the lamp anyway, faster|seated at the back/i, /without witnesses|lamp's half is still there/i],
  duel: [/ten paces on its back|honour is satisfied/i, /accepted your apology|hit by the crumb on the way down/i, /duelled alone|not mentioned again until lunch/i],
  tuesday: [/haunted you at two sharp|asked how it went/i, /rescheduled for Thursday|haunted an empty room/i, /reports that you screamed|while you were out/i],
  exhume: [/reburied with a note|raisin was fine/i, /cairn of crumbs|left the raisin where it lies/i, /smaller raisin underneath|treating this as a family/i]
};
const escaped = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function matchesTemplate(text, template) {
  const pattern = template.split(/\{[pq]\}/).map(escaped).join('[\\s\\S]+?');
  return new RegExp('^' + pattern + '$', 'i').test(text.trim());
}
function schemeBranch(scene, definition) {
  const declared = String(scene.stage?.branch ?? '');
  if (['0', '1', 'alone'].includes(declared)) return declared;
  const text = String(scene.text || '');
  const outcomes = [...definition.choices.map(choice => choice.outcome), definition.autonomous];
  const exact = outcomes.findIndex(value => matchesTemplate(text, value));
  if (exact >= 0) return ['0', '1', 'alone'][exact];
  const candidates = (LEGACY[definition.id] || []).map((pattern, i) => pattern.test(text) ? i : -1).filter(i => i >= 0);
  return candidates.length === 1 ? ['0', '1', 'alone'][candidates[0]] : null;
}

const GIFT_SHAPES = { moth: 'moon', lint: 'crown', bell: 'bell', undertow: 'paper', widow: 'button', spore: 'portrait', tooth: 'medal', echo: 'echo', needle: 'needle', clock: 'clock', receipt: 'receipt', rain: 'rain' };
const SHAPES = new Set(['moon','crown','bell','paper','button','portrait','medal','echo','needle','clock','receipt','rain','sock','pea','spoon','sun','tooth','key','raisin','scarf','crumb','bowl','tissue','pillow','rope','mask','board','ghost','hair','frame','flag','lamp','pen','grave','coffin','moth','door','dust','gavel','bag','wing','knot','wall','spirit-circle']);
function relicFor(scene) {
  const object = scene.stage?.object;
  const exact = RELICS.find(relic => relic.id === object);
  if (exact) return exact;
  if (object && SHAPES.has(object)) return { id: object, shape: object, name: object };
  return RELICS.find(relic => String(scene.text || '').toLowerCase().includes(relic.name.toLowerCase())) || null;
}
function visitorScene(scene) {
  const visitor = VISITORS.find(v => v.id === scene.stage?.guest) || VISITORS.find(v => String(scene.title || '').includes(v.name));
  if (!visitor) return null;
  const branch = scene.stage?.branch;
  const snack = branch === 'crumbs' || (!branch && String(scene.text || '').includes(visitor.crumbs));
  const tour = branch === 'tour' || (!branch && String(scene.text || '').includes(visitor.tour));
  const gift = { shape: GIFT_SHAPES[visitor.id], label: visitor.gift };
  const giftRecorded = /(?:gave|gift|left|brought)/i.test(scene.text || '') && (String(scene.text || '').includes(visitor.gift) || scene.stage?.object);
  const props = [prop('door', 'door', 'The caller’s entrance')];
  if (snack) props.push(prop('crumb', 'crumb', 'The offered crumb'));
  if (giftRecorded) props.push(prop('gift', gift.shape, gift.label));
  const cast = Math.min(2, (scene.cast || []).length);
  const residents = Array.from({ length: cast }, (_, i) => actor(i ? 33 : 18));
  const withGuest = guest => [...residents, guest];
  const beats = [beat(visitor.name + ' arrives', withGuest(actor(88, 0, 'walk')), { door: pos(89, 14), ...(snack ? { crumb: pos(42, 12) } : {}), ...(giftRecorded ? { gift: pos(87, 29, { scale: .7 }) } : {}) })];
  if (snack) {
    beats.push(beat('The offered crumb changes hands', withGuest(actor(58, 0, 'catch')), { crumb: pos(58, 31) }));
    beats.push(beat('The recorded hospitality', withGuest(actor(58, 0, 'eat')), { crumb: hidden(58, 31), ...(giftRecorded ? { gift: pos(42, 12) } : {}) }));
  } else if (tour) {
    beats.push(beat('A tour of the plank', withGuest(actor(51, 0, 'look'))));
    beats.push(beat('The caller completes the visit', withGuest(actor(68, 0, 'testify')), giftRecorded ? { gift: pos(47, 12) } : {}));
  } else {
    beats.push(beat('The caller is received', withGuest(actor(67, 0, 'offer'))));
    beats.push(beat('The actual visitor, on record', withGuest(actor(63, 0, 'testify')), giftRecorded ? { gift: pos(47, 12) } : {}));
  }
  return complete('visitor', 'shelf', props, beats, visitor.id);
}
function caseScene(scene, id) {
  const good = scene.stage?.branch === 'good' || (!scene.stage?.branch && String(scene.text || '').includes(CASES.find(c => c.id === id)?.good));
  const messy = scene.stage?.branch === 'messy' || (!scene.stage?.branch && String(scene.text || '').includes(CASES.find(c => c.id === id)?.messy));
  if (!good && !messy) return null;
  if (id === 'crumb') return complete('case:crumb', 'shelf', [prop('crumb','crumb','The doorway’s covering crumb'),prop('door','door','The communal doorway'),prop('board','wall','The committee’s board')], [
    beat('The crumb covers a small doorway', [actor(25),actor(72)], { crumb: pos(51), door: pos(51, 0, { scale: .45, opacity: .5 }) }),
    beat(good ? 'The doorway is kept open' : 'The doorway is boarded up', [actor(39,0,'offer'),actor(65,0,'look')], { crumb: pos(37,24), door: pos(51,0,{scale:.6}), ...(messy ? {board:pos(51,0,{scale:.8})}:{}) }),
    beat(good ? 'Crumbs pass where nobody fits' : 'A smaller doorway appears in the board', [actor(36,0,'offer'),actor(68,0,'look')], { crumb:pos(good?60:37,good?3:24), door:pos(51,0,{scale:good?.6:.25}) })
  ]);
  if (id === 'rattle') return complete('case:rattle','shelf',[prop('knot','knot','The loose wooden knot'),prop('ballot','paper','The honorary resident’s vote')],[
    beat('A loose knot taps the wall',[actor(28,0,'listen'),actor(73,0,'listen')],{knot:pos(54,12,{rotate:-12})}),
    beat(good?'An honorary resident is admitted':'The knot is asked to be quiet',[actor(39,0,'testify'),actor(67,0,'point')],{knot:pos(54,12,{rotate:12}),...(good?{ballot:pos(55,26,{scale:.5})}:{})}),
    beat(good?'No dinner, one deciding vote':'The tapping grows softer',[actor(31,0,'look'),actor(72,0,'listen')],{knot:pos(54,12,{rotate:good?0:3})})
  ]);
  if (id === 'lint') return complete('case:lint','shelf',[prop('scarf','scarf','The shared lint frontier'),prop('half','scarf','The divided frontier')],[
    beat('One scarf connects both sides',[actor(28),actor(72)],{scarf:pos(50,15,{scale:1.3})}),
    beat(good?'Both ends are worn':'The scarf is divided',[actor(39,0,'fuss'),actor(62,0,'fuss')],{scarf:pos(good?50:37,18,{scale:good?1.2:.6}),...(messy?{half:pos(66,18,{scale:.6,rotate:180})}:{})}),
    beat(good?'Peace, with nobody able to move':'Two halves unravel into new borders',[actor(good?39:28,0,good?'guard':'deny'),actor(good?62:75,0,good?'guard':'deny')],{scarf:pos(good?50:38,good?18:0,{scale:good?1.2:.35}),...(messy?{half:pos(65,0,{scale:.35,rotate:180})}:{})})
  ]);
  return null;
}
function reading(scene, key = 'record') {
  return complete(key, 'shelf', [prop('record','paper','The preserved account')], [
    beat('The account is opened',[actor(33,0,'look')],{record:pos(56,14)}),
    beat('The recorded words are read',[actor(43,0,'read')],{record:pos(56,23)}),
    beat('The account is preserved',[actor(33,0,'look')],{record:pos(56,14)})
  ]);
}

// These are a presentation of the earned object and its written ending. The
// director does not reconstruct unseen ghosts, dragons, or other residents.
const KEEPSAKE_RECOLLECTIONS = {
  'crumb-telescope': ["The paper telescope is brought out", "A thumb steadies the tube"],
  'orbit-saucer': ["The comet’s saucer is brought out", "The rim is inspected"],
  'ghost-bed': ["The matchbox guest room is brought out", "The lid is left ajar"],
  'holiday-bell': ["The bell is brought out", "The clapper hangs still"],
  'button-crown': ["The bottle-cap crown is brought out", "The edge catches the light"],
  'button-passport': ["The button’s passport is brought out", "The pages are opened"],
  'rain-bottle': ["The rain bottle is brought out", "The cork stays in place"],
  'rain-boat': ["The receipt boat is brought out", "The paper hull is examined"],
  'ever-candle': ["The candle is brought out", "The wick is inspected"],
  'unbirthday-rosette': ["The ribbon is brought out", "The knot is straightened"],
  'nobody-stamp': ["The postal stamp is brought out", "The inked face is shown"],
  'reply-envelope': ["The reply envelope is brought out", "The flap stays closed"],
  'silver-baton': ["The needle baton is brought out", "The point is kept away"],
  'choir-ticket': ["The opera ticket is brought out", "The printed side is shown"],
  'dragon-key': ["The treasury key is brought out", "The teeth are inspected"],
  'dragon-parcel': ["The velvet parcel is brought out", "The wrapping is held carefully"]
};

function escapadeScene(scene) {
  const episode = escapadeAtVersion(scene.stage?.branch,scene.stage?.contentVersion);
  const ending = episode?.endings.find(item => item.keepsake === scene.stage?.object);
  if (!ending) return null;
  const labels = KEEPSAKE_RECOLLECTIONS[ending.keepsake];
  if (!labels) return null;
  return complete('escapade', 'shelf', [prop('keepsake', 'keepsake:' + ending.keepsake, ending.title)], [
    beat(labels[0], [actor(27, 0, 'look')], { keepsake: pos(61, 0, { scale: 1.5 }) }),
    beat(labels[1], [actor(39, 0, 'offer')], { keepsake: pos(61, 24, { scale: 1.65 }) }),
    beat(ending.title + ', kept with the story', [actor(31, 0, 'look')], { keepsake: pos(63, 0, { scale: 1.5 }) })
  ]);
}

export function sceneDirection(scene = {}) {
  const declared = String(scene.stage?.key || '');
  if (declared === 'escapade' || scene.kind === 'escapade') return escapadeScene(scene) || reading(scene, 'escapade');
  if (declared === 'welcome') {
    const branch=scene.stage?.branch, sleepy=scene.stage?.object==='sleepy';
    const setup=beat('One bowl. Two interested faces. One of them is pricing a coffin.',[actor(27,0,sleepy?'nap':'look'),actor(77,8,'look')],{bowl:pos(50),crumb:pos(50,25)});
    const action=sleepy&&['share','keep'].includes(branch)?[
      beat('A quiet feeding beside the bowl',[actor(43,0,'nap'),actor(72,8,'look')],{crumb:pos(43,25,{scale:branch==='share'?.5:1})}),
      beat(branch==='share'?'Madam Moth takes her half':'Madam Moth studies the empty spoon',[actor(43,0,'nap'),actor(branch==='share'?60:72,4,branch==='share'?'eat':'look')],{crumb:branch==='share'?pos(60,23,{scale:.5}):hidden(43,25)}),
      beat(branch==='share'?'The visitor settles beside the bowl':'She quietly chews a loose thread',[actor(43,0,'nap'),actor(65,0,branch==='share'?'nap':'eat')],{crumb:hidden(60,23)})
    ]:branch==='share'?[
      beat('Half a serving changes hands',[actor(43,0,sleepy?'nap':'offer'),actor(65,8,'catch')],{crumb:pos(60,27,{scale:.55})}),
      beat('Madam Moth folds the crumb’s imaginary arms',[actor(43,0,sleepy?'nap':'look'),actor(64,8,'surprise')],{crumb:pos(59,27,{scale:.3})}),
      beat('She eats the mourners before the body',[actor(43,0,sleepy?'nap':'eat'),actor(62,8,'offer')],{crumb:hidden(45,27)})
    ]:branch==='keep'?[
      beat('The resident gets the whole serving',[actor(45,0,sleepy?'nap':'eat'),actor(77,8,'look')],{crumb:pos(45,28)}),
      beat('The visitor measures the bowl for a coffin',[actor(45,0,sleepy?'nap':'eat'),actor(72,0,'sad')],{crumb:hidden(45,28)}),
      beat('It spits back a crumb. She doubles the quote.',[actor(43,0,sleepy?'nap':'look'),actor(73,3,'deny')],{crumb:hidden(45,28)})
    ]:[];
    return complete('welcome','shelf',[prop('bowl','bowl','The housewarming bowl'),prop('crumb','crumb','One actual serving')],[setup,...action],'moth');
  }
  const scheme = SCHEMES.find(s => declared === 'scheme:' + s.id) || (!declared ? SCHEMES.find(s => s.id === scene.kind || s.title === scene.title) : null);
  if (scheme) {
    const direction = DIRECTIONS[scheme.id], branch = schemeBranch(scene, scheme);
    const setup = direction.setup;
    const beats = branch ? [setup, ...direction.branches[branch]] : [setup, { ...setup, label: 'The setup, as recorded' }, { ...setup, label: 'Read the preserved account for its outcome' }];
    return complete('scheme:' + scheme.id, direction.setting, direction.props, beats);
  }
  if (declared === 'visitor' || scene.kind === 'visitor') return visitorScene(scene) || reading(scene, 'visitor');
  const caseId = declared.startsWith('case:') ? declared.slice(5) : scene.kind === 'case' ? CASES.find(c => c.title === scene.title)?.id : null;
  if (caseId) return caseScene(scene, caseId) || reading(scene, 'case:' + caseId);
  if (declared === 'court' || declared === 'game:court' || scene.kind === 'court') return complete('court', 'court', [prop('gavel','gavel','The actual court gavel'),prop('record','paper','The recorded verdict')], [
    beat('The verdict is read',[actor(30,0,'read'),actor(72,0,'listen')],{record:pos(51,21),gavel:pos(33,33)}),
    beat('The court enters its decision',[actor(35,0,'gavel'),actor(72,0,'look')],{gavel:pos(44,7,{rotate:25})}),
    beat('The hearing is closed',[actor(30,0,'look'),actor(72,0,'look')],{record:pos(53,12),gavel:pos(37,9)})
  ]);
  const relic = relicFor(scene);
  const excursion = declared === 'outing' || declared === 'market' || ['outing','market'].includes(scene.kind);
  if (excursion && relic) {
    const market = declared === 'market' || scene.kind === 'market';
    const route = relic.id.split(':')[0], setting = ['drawer','fridge','cupboard'].includes(route) ? route : market ? 'night' : 'shelf';
    return complete(market?'market':'outing',setting,[prop('bag','bag','The returning bag'),prop('relic',relic.shape,relic.name)],[
      beat(market?'Back from the night market':'The expedition returns',[actor(19,0,'walk'),actor(34,0,'walk')],{bag:pos(27,8),relic:hidden(27,8)}),
      beat('The actual find is unpacked',[actor(39,0,'offer'),actor(71,0,'look')],{bag:pos(29),relic:pos(51,27)}),
      beat(relic.name,[actor(30,0,'look'),actor(74,0,'look')],{relic:pos(53,13),bag:pos(24)})
    ]);
  }
  if (excursion) return reading(scene, declared || scene.kind);
  const game = declared.startsWith('game:') ? declared.slice(5) : scene.kind === 'celebration' ? ({'The secret accomplice':'memory','The Ministry of Crumbs':'chase','An inconveniently observant landlord':'alibi','The household takes the stand':'court'})[scene.title] : null;
  if (game === 'chase') return complete('game:chase','shelf',[prop('crumb','crumb','A chase crumb')],[beat('A ministry claims a crumb',[actor(27,0,'point')],{crumb:pos(62,7)}),beat('The minister appoints itself',[actor(44,0,'testify')],{crumb:pos(62,7)}),beat('One employee, considerable overhead',[actor(49,0,'guard')],{crumb:pos(62,7)})]);
  if (game === 'memory') return complete('game:memory','shelf',[],[beat('The secret is demonstrated',[actor(30,0,'knock'),actor(70,0,'listen')]),beat('The answer comes back',[actor(30,0,'listen'),actor(70,0,'boop')]),beat('An accomplice is recognised',[actor(42,0,'fuss'),actor(60,0,'fuss')])]);
  if (game === 'alibi') return complete('game:alibi','shelf',[prop('record','paper','The checked statement')],[beat('The statement is offered',[actor(31,0,'testify')],{record:pos(57,19)}),beat('The landlord checks the record',[actor(46,0,'read')],{record:pos(55,27)}),beat('Observation has become inconvenient',[actor(30,0,'deny')],{record:pos(57,19)})]);
  if (game === 'court') return sceneDirection({ ...scene, stage:{...scene.stage,key:'court'} });
  if (declared === 'return' || scene.kind === 'return') return complete('return','shelf',[prop('report','paper','The household report')],[beat('The household notices your return',[actor(23,0,'look'),actor(74,0,'look')],{report:pos(53,12)}),beat('The report is brought forward',[actor(39,0,'offer'),actor(68,0,'testify')],{report:pos(51,25)}),beat('The recorded needs are read',[actor(38,0,'read'),actor(68,0,'listen')],{report:pos(51,25)})]);
  return reading(scene);
}

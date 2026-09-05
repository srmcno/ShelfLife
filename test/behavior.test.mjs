import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TRAIT_PROP_AFFINITY, PROP_USE, DEFAULT_ANATOMY,
  MOVE_THRESHOLD, MOVE_COOLDOWN_MS, PASS_INTERVAL_MS, CATCHUP_AFTER_MS, DEPLETE_AT, CLAIM_MS,
  affinityFor, socialPull, inertiaOf, moveCooldownFor, petsFeud, propName,
  anatomyOf, capabilitiesOf, reachableSlots, reachableProps,
  behaviorState, claimProp, claimantOf, isSpent, usedRecently, pruneBehavior,
  slotScore, decideMove, applyMove, performMove,
  useProp, claimAndHoard, contestProp, stealPhase, mischiefPhase,
  runBehavior, catchUpBehavior
} from '../src/engine/behavior.js';
import { TRAITS } from '../src/content/traits.js';
import { PROPS } from '../src/content/props.js';
import { blankState, defaultNeeds } from '../src/state.js';

const NOW = new Date(2024, 0, 10, 12, 0, 0).getTime();   // midday: nobody is asleep
const NIGHT = new Date(2024, 0, 10, 23, 0, 0).getTime();

function makePet(id, traits = [], overrides = {}) {
  return {
    id, name: id, traits,
    needs: defaultNeeds(),
    bond: 0, cared: 0, grudges: 0, grudgeStage: 0,
    ...overrides
  };
}

function makeProp(id, kind) { return { id, kind }; }

// Places pets/props into slots by index. `layout` is a sparse array of pieces.
function shelf(layout) {
  const s = blankState();
  layout.forEach((piece, i) => {
    if (!piece) return;
    if (piece.kind && !piece.traits) s.props.push(piece);
    else s.pets.push(piece);
    s.slots[i] = piece.id;
  });
  return s;
}

/* ---------------- affinity resolution ---------------- */

test('affinityFor sums the affinities of every trait a pet has', () => {
  const sugar = makePet('a', ['sugar']);
  assert.equal(affinityFor(sugar, 'bowl'), TRAIT_PROP_AFFINITY.sugar.bowl);
  const both = makePet('b', ['sugar', 'freegan']);
  assert.equal(affinityFor(both, 'bowl'), TRAIT_PROP_AFFINITY.sugar.bowl + TRAIT_PROP_AFFINITY.freegan.bowl);
});

test('affinityFor is signed: a nocturnal pet resents the lamp and likes the candle', () => {
  const owl = makePet('a', ['nocturnal']);
  assert.ok(affinityFor(owl, 'lamp') < 0);
  assert.ok(affinityFor(owl, 'candle') > 0);
});

test('affinityFor covers the themed pairings the design calls for', () => {
  assert.ok(affinityFor(makePet('a', ['damp']), 'tub') >= 2);
  assert.ok(affinityFor(makePet('b', ['cult']), 'candle') >= 2);
  assert.ok(affinityFor(makePet('c', ['magpie']), 'globe') >= 2);
  assert.ok(affinityFor(makePet('d', ['taxidermy']), 'skull') >= 2);
  assert.ok(affinityFor(makePet('e', ['clean']), 'fern') <= -2);
});

test('affinityFor skips trait ids and prop kinds that no longer exist in content', () => {
  const ghost = makePet('a', ['a-trait-that-was-deleted']);
  assert.equal(affinityFor(ghost, 'bowl'), 0);
  assert.equal(affinityFor(makePet('b', ['sugar']), 'nonexistent-prop'), 0);
  assert.equal(affinityFor(makePet('c', ['sugar']), undefined), 0);
  assert.equal(affinityFor(null, 'bowl'), 0);
  assert.equal(affinityFor({ id: 'x' }, 'bowl'), 0);      // no traits array at all
});

test('every id in the behaviour tables still exists in content (or is knowingly skipped)', () => {
  const traitIds = new Set(TRAITS.map(t => t.id));
  const propKinds = new Set(Object.keys(PROPS));
  Object.keys(TRAIT_PROP_AFFINITY).forEach(id => {
    // Unknown trait ids must not throw; they simply contribute nothing.
    if (!traitIds.has(id)) assert.equal(affinityFor(makePet('x', [id]), 'bowl'), 0);
    Object.keys(TRAIT_PROP_AFFINITY[id]).forEach(kind => {
      if (!propKinds.has(kind)) assert.equal(affinityFor(makePet('x', [id]), kind), 0);
    });
  });
});

test('propName falls back to the raw kind when content has no such prop', () => {
  assert.equal(propName('bowl'), PROPS.bowl.name);
  assert.equal(propName('not-a-prop'), 'not-a-prop');
  assert.equal(propName(undefined), 'thing');
});

test('socialPull separates the clingy from the solitary, clamped either way', () => {
  assert.ok(socialPull(makePet('a', ['clingy'])) > 0);
  assert.ok(socialPull(makePet('b', ['minimalist', 'cryptid'])) < 0);
  assert.equal(socialPull(makePet('c', [])), 0);
  assert.ok(Math.abs(socialPull(makePet('d', ['clingy', 'socialite', 'gossip', 'influencer']))) <= 3);
});

test('inertiaOf makes load-bearing pets hard to shift and furious pets easy', () => {
  assert.ok(inertiaOf(makePet('a', ['loadbearing'])) > inertiaOf(makePet('b', [])));
  const calm = makePet('c', [], { needs: { food: 90, fuss: 90, clean: 90 } });
  const furious = makePet('d', [], { needs: { food: 2, fuss: 2, clean: 2 } });
  assert.ok(inertiaOf(furious) < inertiaOf(calm));
});

test('petsFeud reads the content feud table and tolerates junk', () => {
  assert.equal(petsFeud(makePet('a', ['gossip']), makePet('b', ['spiteful'])), true);
  assert.equal(petsFeud(makePet('a', ['spiteful']), makePet('b', ['gossip'])), true);
  assert.equal(petsFeud(makePet('a', ['sugar']), makePet('b', ['clingy'])), false);
  assert.equal(petsFeud(makePet('a', ['gossip']), { id: 'x' }), false);
  assert.equal(petsFeud(null, null), false);
});

/* ---------------- anatomy ---------------- */

test('anatomyOf falls back to the default body for pets with no anatomy data', () => {
  assert.deepEqual(anatomyOf(makePet('a')), DEFAULT_ANATOMY);
  assert.deepEqual(anatomyOf(makePet('b', [], { art: { body: 'x', stamps: [] } })), DEFAULT_ANATOMY);
  assert.deepEqual(anatomyOf(null), DEFAULT_ANATOMY);
  assert.deepEqual(anatomyOf(makePet('c', [], { art: { anatomy: 'nonsense' } })), DEFAULT_ANATOMY);
});

test('anatomyOf reads the generator block from art.anatomy, art.creature.anatomy or pet.anatomy', () => {
  assert.equal(anatomyOf(makePet('a', [], { art: { anatomy: { hasWings: true } } })).hasWings, true);
  assert.equal(anatomyOf(makePet('b', [], { art: { creature: { anatomy: { hasWings: true } } } })).hasWings, true);
  assert.equal(anatomyOf(makePet('c', [], { anatomy: { hasWings: true } })).hasWings, true);
  // partial blocks are merged over the default, not replacing it
  assert.equal(anatomyOf(makePet('d', [], { anatomy: { hasArms: true } })).hasLegs, DEFAULT_ANATOMY.hasLegs);
});

test('capabilitiesOf: the default body walks, does not climb, does not fly', () => {
  const c = capabilitiesOf(makePet('a'));
  assert.equal(c.walk, true);
  assert.equal(c.climb, false);
  assert.equal(c.fly, false);
  assert.equal(c.ooze, false);
  assert.equal(c.range, 2);
});

test('capabilitiesOf: arms grant climbing, reaching and hanging', () => {
  const c = capabilitiesOf(makePet('a', [], { anatomy: { hasArms: true, armCount: 2 } }));
  assert.equal(c.climb, true);
  assert.equal(c.reach, true);
  assert.equal(c.hang, true);
});

test('capabilitiesOf: many or spindly legs stride further; a limbless blob oozes one slot', () => {
  const spider = capabilitiesOf(makePet('a', [], { anatomy: { hasLegs: true, legCount: 8 } }));
  assert.ok(spider.range > 2);
  assert.equal(spider.stride, true);
  const spindly = capabilitiesOf(makePet('b', [], { anatomy: { hasLegs: true, legStyle: 'spindly' } }));
  assert.ok(spindly.range > 2);
  const blob = capabilitiesOf(makePet('c', [], { anatomy: { isLimbless: true, hasLegs: false } }));
  assert.equal(blob.range, 1);
  assert.equal(blob.ooze, true);
  assert.equal(blob.climb, false);
  assert.equal(blob.fly, false);
});

test('capabilitiesOf: tentacles count as arms, wings grant flight', () => {
  const squid = capabilitiesOf(makePet('a', [], { anatomy: { hasLegs: false, hasTentacles: true } }));
  assert.equal(squid.climb, true);
  assert.equal(squid.sneak, true);
  const bat = capabilitiesOf(makePet('b', [], { anatomy: { hasWings: true } }));
  assert.equal(bat.fly, true);
});

test('capabilitiesOf honours the creature generator\'s stated capabilities over its own guesses', () => {
  // Shape produced by src/art/creatures.js describeAnatomy(): the `can` block wins.
  const generated = makePet('a', [], {
    art: {
      creature: {
        anatomy: {
          hasLegs: true, legCount: 2, legStyle: 'stubby',
          hasArms: true, armCount: 2, armReach: 8,
          hasWings: false, hasTail: true, hasTentacles: false,
          isLimbless: false, heightClass: 'squat', gait: 'walk',
          can: { walk: true, scuttle: false, hop: true, sneak: false, hang: false, climb: false, glide: false, wag: true }
        }
      }
    }
  });
  const c = capabilitiesOf(generated);
  assert.equal(c.climb, false, 'short arms cannot climb, whatever having arms implies');
  assert.equal(c.hang, false);
  assert.equal(c.reach, false, 'armReach below the threshold cannot reach over a neighbour');
  assert.equal(c.tail, true);

  const scuttler = capabilitiesOf(makePet('b', [], {
    art: { creature: { anatomy: { hasLegs: true, legCount: 8, legStyle: 'many', gait: 'scuttle',
      can: { scuttle: true, sneak: true, climb: true, hang: true, glide: false } } } }
  }));
  assert.equal(scuttler.range, 5);
  assert.equal(scuttler.stride, true);
  assert.equal(scuttler.sneak, true);

  const oozer = capabilitiesOf(makePet('c', [], {
    art: { creature: { anatomy: { hasLegs: true, legCount: 4, legStyle: 'tentacles', hasTentacles: true, gait: 'ooze',
      can: { sneak: true, climb: true } } } }
  }));
  assert.equal(oozer.ooze, true, 'the generator said it oozes');
  assert.equal(oozer.range, 1);
  assert.equal(oozer.climb, true, 'tentacles still get it up a shelf');
});

test('moveCooldownFor: blobs move rarely, spindly things move often', () => {
  const blob = makePet('a', [], { anatomy: { isLimbless: true, hasLegs: false } });
  const spider = makePet('b', [], { anatomy: { hasLegs: true, legCount: 8 } });
  assert.ok(moveCooldownFor(blob) > MOVE_COOLDOWN_MS);
  assert.ok(moveCooldownFor(spider) < MOVE_COOLDOWN_MS);
  assert.equal(moveCooldownFor(makePet('c')), MOVE_COOLDOWN_MS);
});

test('reachableSlots is gated by anatomy: rows for legs, shelves for arms, anywhere for wings', () => {
  const plain = makePet('a');
  const armed = makePet('b', [], { anatomy: { hasArms: true } });
  const winged = makePet('c', [], { anatomy: { hasWings: true } });
  const blob = makePet('d', [], { anatomy: { isLimbless: true, hasLegs: false } });
  const s = shelf([plain]);
  s.pets.push(armed, winged, blob);

  const walk = reachableSlots(s, plain, 0).map(x => x.to);
  assert.deepEqual(walk.sort((x, y) => x - y), [1, 2]);          // its own row only, range 2
  assert.equal(reachableSlots(s, blob, 0).length, 1);            // one slot, and that is that

  const climb = reachableSlots(s, armed, 0);
  assert.ok(climb.some(x => x.to === 6 && x.means === 'climb'));  // straight down to the next shelf
  const fly = reachableSlots(s, winged, 0);
  assert.ok(fly.some(x => x.to === 13 && x.means === 'fly'));
  assert.equal(reachableSlots(s, plain, 0).some(x => x.to === 6), false);
});

test('reachableProps: arms let a pet reach over a neighbour, plain bodies cannot', () => {
  const plain = makePet('a');
  const bowl = makeProp('q1', 'bowl');
  const mid = makePet('b');
  const s = shelf([plain, mid, bowl]);
  assert.equal(reachableProps(s, plain, NOW).length, 0);

  const armed = makePet('c', [], { anatomy: { hasArms: true } });
  const s2 = shelf([armed, mid, bowl]);
  const found = reachableProps(s2, armed, NOW);
  assert.equal(found.length, 1);
  assert.equal(found[0].distance, 2);
  assert.equal(found[0].over.id, 'b');
});

/* ---------------- motivated movement ---------------- */

test('decideMove moves a pet toward a prop its traits love', () => {
  const cultist = makePet('a', ['cult']);
  const candle = makeProp('q1', 'candle');
  const s = shelf([cultist, null, candle]);
  const move = decideMove(s, cultist, NOW);
  assert.ok(move, 'expected the cultist to want the candle');
  assert.equal(move.to, 1);
});

test('a starving pet walks to the bowl whatever its opinion of bowls', () => {
  const hungry = makePet('a', [], { needs: { food: 5, fuss: 80, clean: 80 } });
  const s = shelf([null, null, hungry, null, null, makeProp('q1', 'bowl')]);
  const move = decideMove(s, hungry, NOW);
  assert.ok(move, 'hunger should be a motive on its own');
  assert.equal(move.to, 4);
  const out = performMove(s, move, NOW);
  assert.equal(out.reason, 'prop-need');

  const fed = makePet('b', [], { needs: { food: 80, fuss: 80, clean: 80 } });
  const s2 = shelf([null, null, fed, null, null, makeProp('q1', 'bowl')]);
  assert.equal(decideMove(s2, fed, NOW), null, 'a fed pet has no reason to cross the shelf');
});

test('usedRecently stops one pet narrating the same prop every pass', () => {
  const pet = makePet('a', ['sugar'], { needs: { food: 30, fuss: 70, clean: 70 } });
  const bowl = makeProp('q1', 'bowl');
  const s = shelf([pet, bowl]);
  useProp(s, pet, bowl, NOW);
  assert.equal(usedRecently(s, pet, 'q1', NOW), true);
  assert.equal(usedRecently(s, makePet('b'), 'q1', NOW), false);
  assert.equal(usedRecently(s, pet, 'q1', NOW + 60 * 60 * 1000), false);
});

test('decideMove leaves a pet alone when there is nothing to want', () => {
  const plain = makePet('a', []);
  const s = shelf([plain]);
  assert.equal(decideMove(s, plain, NOW), null);
});

test('decideMove is a decision, not a dice roll: identical shelves give identical answers', () => {
  const build = () => shelf([makePet('a', ['cult']), null, makeProp('q1', 'candle')]);
  const answers = new Set();
  for (let i = 0; i < 25; i++) {
    const s = build();
    const m = decideMove(s, s.pets[0], NOW);
    answers.add(m ? m.to : 'stay');
  }
  assert.equal(answers.size, 1);
});

test('decideMove moves a pet away from a prop its traits hate', () => {
  const owl = makePet('a', ['nocturnal']);
  const lamp = makeProp('q1', 'lamp');
  const s = shelf([lamp, owl]);
  const move = decideMove(s, owl, NIGHT);      // awake, and unhappy about the lamp
  assert.ok(move);
  assert.ok(move.to > 1, 'expected it to put distance between itself and the lamp');
});

test('decideMove breaks up a feud: the pet moves out of reach of its enemy', () => {
  const a = makePet('a', ['gossip']);
  const b = makePet('b', ['spiteful']);
  const s = shelf([null, null, a, b]);
  const move = decideMove(s, a, NOW);
  assert.ok(move, 'a feuding pet should want out');
  performMove(s, move, NOW);
  assert.ok(Math.abs(s.slots.indexOf('a') - s.slots.indexOf('b')) > 1);
});

test('decideMove sends a solitary pet away from company and pulls a clingy one into it', () => {
  const hermit = makePet('a', ['minimalist', 'cryptid']);
  const s = shelf([makePet('b'), makePet('c'), hermit]);
  const move = decideMove(s, hermit, NOW);
  assert.ok(move, 'the hermit should want out');
  performMove(s, move, NOW);
  const at = s.slots.indexOf('a');
  [at - 1, at + 1].forEach(x => {
    const id = s.slots[x];
    assert.ok(!id || !s.pets.some(p => p.id === id), 'the hermit ended up with nobody beside it');
  });

  const clingy = makePet('d', ['clingy']);
  const s2 = shelf([makePet('e'), makePet('f'), null, clingy]);
  const m2 = decideMove(s2, clingy, NOW);
  assert.ok(m2, 'the clingy one should want in');
  assert.equal(m2.to, 2);
});

test('decideMove respects the per-pet cooldown', () => {
  const cultist = makePet('a', ['cult'], { lastMoveAt: NOW - 1000 });
  const s = shelf([cultist, null, makeProp('q1', 'candle')]);
  assert.equal(decideMove(s, cultist, NOW), null);
  assert.ok(decideMove(s, cultist, NOW + MOVE_COOLDOWN_MS * 3));
});

test('decideMove keeps a nocturnal pet in place while it is asleep', () => {
  const owl = makePet('a', ['nocturnal', 'cult']);
  const s = shelf([owl, null, makeProp('q1', 'candle')]);
  assert.equal(decideMove(s, owl, NOW), null);           // midday: asleep
  assert.ok(decideMove(s, owl, NIGHT));                  // 11pm: busy
});

test('decideMove will not cross shelves without the anatomy for it', () => {
  const plainCultist = makePet('a', ['cult']);
  const armedCultist = makePet('b', ['cult'], { anatomy: { hasArms: true } });
  const candleBelow = makeProp('q1', 'candle');
  const layout = new Array(18).fill(null);
  layout[0] = plainCultist;
  layout[7] = candleBelow;
  const s = shelf(layout);
  assert.equal(decideMove(s, plainCultist, NOW), null);

  const layout2 = new Array(18).fill(null);
  layout2[0] = armedCultist;
  layout2[7] = candleBelow;
  const s2 = shelf(layout2);
  const m = decideMove(s2, armedCultist, NOW);
  assert.ok(m, 'arms should make the shelf below reachable');
  assert.equal(m.means, 'climb');
  assert.equal(m.to, 6);
});

test('a move only happens when it clears MOVE_THRESHOLD', () => {
  const pet = makePet('a', ['cult']);
  const candle = makeProp('q1', 'candle');
  const s = shelf([pet, null, candle]);
  const from = 0;
  const stay = slotScore(s, pet, from, NOW) + inertiaOf(pet);
  const move = decideMove(s, pet, NOW);
  const slots = s.slots.slice();
  slots[from] = null; slots[move.to] = pet.id;
  assert.ok(slotScore(s, pet, move.to, NOW, slots) - stay >= MOVE_THRESHOLD);
});

test('performMove swaps the slots, stamps the cooldown and explains itself', () => {
  const cultist = makePet('a', ['cult']);
  const other = makePet('b');
  const s = shelf([cultist, other, makeProp('q1', 'candle')]);
  const move = decideMove(s, cultist, NOW);
  const out = performMove(s, move, NOW);
  assert.equal(s.slots[1], 'a');
  assert.equal(s.slots[0], 'b');
  assert.equal(cultist.lastMoveAt, NOW);
  assert.equal(other.lastMoveAt, NOW);
  assert.equal(out.reason, 'prop-love');
  assert.equal(s.notes.length, 1);
  assert.match(s.notes[0].text, new RegExp(PROPS.candle.name));
  assert.equal(s.notes[0].from, 'a');
});

test('a sneaky body moving at night gets a note that admits nothing', () => {
  const creeper = makePet('a', ['cult'], { anatomy: { hasTentacles: true, hasLegs: false } });
  const s = shelf([creeper, null, makeProp('q1', 'candle')]);
  const move = decideMove(s, creeper, NIGHT);
  assert.ok(move.sneaky);
  performMove(s, move, NIGHT);
  assert.match(s.notes[0].text, /Nobody saw it move|no footage/i);
});

test('a climbing move says so in the note', () => {
  const layout = new Array(18).fill(null);
  const climber = makePet('a', ['cult'], { anatomy: { hasArms: true } });
  layout[0] = climber;
  layout[7] = makeProp('q1', 'candle');
  const s = shelf(layout);
  performMove(s, decideMove(s, climber, NOW), NOW);
  assert.match(s.notes[0].text, /climb|arms/i);
});

/* ---------------- prop interaction ---------------- */

test('useProp restores the need the prop is for', () => {
  const pet = makePet('a', ['sugar'], { needs: { food: 40, fuss: 70, clean: 70 } });
  const bowl = makeProp('q1', 'bowl');
  const s = shelf([pet, bowl]);
  const out = useProp(s, pet, bowl, NOW);
  assert.equal(out.outcome, 'used');
  assert.equal(pet.needs.food, 40 + PROP_USE.bowl.gain);
  assert.equal(s.notes.length, 1);
});

test('useProp on the mirror makes the pet worse, which is the point of the mirror', () => {
  const pet = makePet('a', ['narcissist'], { needs: { food: 70, fuss: 70, clean: 70 } });
  const mirror = makeProp('q1', 'mirror');
  const s = shelf([pet, mirror]);
  useProp(s, pet, mirror, NOW);
  assert.ok(pet.needs.fuss < 70);
});

test('a depleting prop empties after DEPLETE_AT uses and refills later', () => {
  const pet = makePet('a', ['sugar'], { needs: { food: 20, fuss: 70, clean: 70 } });
  const bowl = makeProp('q1', 'bowl');
  const s = shelf([pet, bowl]);
  for (let i = 0; i < DEPLETE_AT; i++) useProp(s, pet, bowl, NOW);
  assert.equal(isSpent(s, 'q1', NOW), true);
  const before = pet.needs.food;
  assert.equal(useProp(s, pet, bowl, NOW).outcome, 'spent');
  assert.equal(pet.needs.food, before, 'an empty bowl feeds nobody');
  assert.equal(isSpent(s, 'q1', NOW + 60 * 60 * 1000), false);
});

test('claiming a prop shuts the neighbours out and earns them a grudge', () => {
  const owner = makePet('a', ['cult']);
  const other = makePet('b', ['cult']);
  const candle = makeProp('q1', 'candle');
  const s = shelf([owner, candle, other]);
  claimProp(s, owner, 'q1', NOW);
  assert.equal(claimantOf(s, 'q1', NOW).id, 'a');
  const out = useProp(s, other, candle, NOW);
  assert.equal(out.outcome, 'blocked');
  assert.equal(other.grudges, 1);
  assert.match(s.notes[0].text, /a/);
});

test('a claim lapses when the claimant is no longer next to the prop, and when it expires', () => {
  const owner = makePet('a', ['cult']);
  const candle = makeProp('q1', 'candle');
  const s = shelf([owner, candle]);
  claimProp(s, owner, 'q1', NOW);
  assert.ok(claimantOf(s, 'q1', NOW));
  assert.equal(claimantOf(s, 'q1', NOW + CLAIM_MS + 1), null);
  claimProp(s, owner, 'q1', NOW);
  s.slots[0] = null; s.slots[5] = 'a';                  // wandered off
  assert.equal(claimantOf(s, 'q1', NOW), null);
});

test('a hoarder drags a claimed prop round to its own side, out of the rival\'s reach', () => {
  const hoarder = makePet('a', ['hoarder']);
  const rival = makePet('b', ['magpie']);
  const globe = makeProp('q1', 'globe');
  const s = shelf([null, hoarder, globe, rival]);
  const out = claimAndHoard(s, hoarder, globe, NOW);
  assert.equal(out.outcome, 'hoarded');
  assert.equal(s.slots[0], 'q1');
  assert.equal(s.slots[2], null);
  assert.equal(Math.abs(s.slots.indexOf('q1') - s.slots.indexOf('b')), 3);
  assert.match(s.notes[0].text, new RegExp(PROPS.globe.name));
});

test('with nowhere to drag it to, a claim is just a claim', () => {
  const hoarder = makePet('a', ['hoarder']);
  const rival = makePet('b', ['magpie']);
  const globe = makeProp('q1', 'globe');
  const s = shelf([hoarder, globe, rival]);
  assert.equal(claimAndHoard(s, hoarder, globe, NOW).outcome, 'claimed');
  assert.equal(s.slots[1], 'q1');
});

test('contestProp resolves two rivals into a winner, a grudge and a deeper feud arc', () => {
  const strong = makePet('a', ['cult', 'prophet']);        // candle 3 + 3
  const weak = makePet('b', ['astrology']);                // candle 3
  const candle = makeProp('q1', 'candle');
  const s = shelf([strong, candle, weak]);
  const out = contestProp(s, candle, NOW);
  assert.equal(out.winner, 'a');
  assert.equal(out.loser, 'b');
  assert.equal(weak.grudges, 1);
  assert.equal(claimantOf(s, 'q1', NOW).id, 'a');
  assert.equal(Object.values(s.feudArcs)[0].level, 1);
  assert.ok(s.notes.some(n => n.kind === 'feud'));
  assert.equal(contestProp(s, candle, NOW), null, 'a claimed prop is not contested again');
});

test('contestProp ignores props only one pet cares about', () => {
  const keen = makePet('a', ['cult']);
  const indifferent = makePet('b', []);
  const candle = makeProp('q1', 'candle');
  const s = shelf([keen, candle, indifferent]);
  assert.equal(contestProp(s, candle, NOW), null);
});

test('the thief robs the neighbour with the most food, and arms extend its reach', () => {
  const thief = makePet('a', ['magpie'], { needs: { food: 10, fuss: 70, clean: 70 } });
  const poor = makePet('b', [], { needs: { food: 20, fuss: 70, clean: 70 } });
  const rich = makePet('c', [], { needs: { food: 90, fuss: 70, clean: 70 } });
  const s = shelf([poor, thief, rich]);
  const out = stealPhase(s, NOW);
  assert.equal(out.victim, 'c');
  assert.ok(rich.needs.food < 90);
  assert.ok(thief.needs.food > 10);
  assert.equal(rich.grudges, 1);

  const armedThief = makePet('d', ['magpie'], { needs: { food: 10, fuss: 70, clean: 70 }, anatomy: { hasArms: true } });
  const witness = makePet('e', [], { needs: { food: 30, fuss: 70, clean: 70 } });
  const mark = makePet('f', [], { needs: { food: 95, fuss: 70, clean: 70 } });
  const s2 = shelf([armedThief, witness, mark]);
  const out2 = stealPhase(s2, NOW);
  assert.equal(out2.victim, 'f');
  assert.equal(out2.reached, true);
  assert.match(s2.notes[0].text, /Reached|extended/i);
});

test('mischiefPhase does something anatomy-appropriate and never nothing', () => {
  const armed = makePet('a', [], { anatomy: { hasArms: true } });
  const s = shelf([armed]);
  const out = mischiefPhase(s, NOW);
  assert.ok(out);
  assert.ok(['hang', 'lurk'].includes(out.act));
  assert.equal(s.notes.length, 1);

  let sawNudge = false;
  for (let i = 0; i < 40 && !sawNudge; i++) {
    const blobShelf = shelf([
      makePet('b', [], { anatomy: { isLimbless: true, hasLegs: false } }),
      makeProp('q1', 'bowl')
    ]);
    const r = mischiefPhase(blobShelf, NOW);
    if (r && r.act === 'nudge') {
      sawNudge = true;
      assert.equal(blobShelf.slots[0], 'q1');           // the prop actually moved
      assert.equal(blobShelf.slots[1], 'b');
    }
  }
  assert.ok(sawNudge, 'a limbless pet beside a prop should sometimes roll into it');
});

/* ---------------- the pass ---------------- */

test('repeated lurking never reposts an observation still on the board', () => {
  const s = shelf([makePet('quiet')]);
  for (let i = 0; i < 50; i++) mischiefPhase(s, NOW + i * 3600000);
  const texts = s.notes.map(note => note.text);
  assert.ok(texts.length > 0);
  assert.equal(new Set(texts).size, texts.length);
});

test('runBehavior refuses to run again inside its own interval unless forced', () => {
  const s = shelf([makePet('a')]);
  assert.ok(runBehavior(s, NOW));
  assert.equal(runBehavior(s, NOW + 1000), null);
  assert.ok(runBehavior(s, NOW + 1000, { force: true }));
  assert.ok(runBehavior(s, NOW + 1000 + PASS_INTERVAL_MS + 1));
});

test('runBehavior caps how much happens in one pass', () => {
  const layout = [];
  for (let i = 0; i < 6; i++) layout.push(makePet('p' + i, ['cult']));
  const s = shelf(layout);
  s.props.push(makeProp('q1', 'candle'));
  s.slots[6] = 'q1';
  const out = runBehavior(s, NOW, { force: true });
  assert.ok(out.moves.length <= 2);
  assert.ok(s.notes.length <= 8);
});

test('runBehavior on an empty shelf does nothing and says nothing', () => {
  const s = blankState();
  const out = runBehavior(s, NOW, { force: true });
  assert.deepEqual(out.moves, []);
  assert.equal(s.notes.length, 0);
});

test('the shelf settles: repeated passes stop producing movement once everyone is happy', () => {
  const s = shelf([makePet('a', ['cult']), null, makeProp('q1', 'candle'), makePet('b', ['sugar'])]);
  let last = 0;
  for (let i = 0; i < 12; i++) {
    const out = runBehavior(s, NOW + i * MOVE_COOLDOWN_MS * 2, { force: true, maxUses: 0 });
    last = out.moves.length;
  }
  assert.equal(last, 0, 'a settled shelf should stop shuffling');
});

test('catchUpBehavior only fires after a real absence, and summarises it once', () => {
  const s = shelf([makePet('a', ['cult']), null, makeProp('q1', 'candle')]);
  assert.equal(catchUpBehavior(s, NOW), 0, 'first ever call just starts the clock');
  assert.equal(catchUpBehavior(s, NOW + 60000), 0, 'a minute away is not an absence');
  const added = catchUpBehavior(s, NOW + CATCHUP_AFTER_MS * 4);
  assert.ok(added > 0);
  assert.ok(s.notes.length <= 10, 'an absence must not flood the feed');
  assert.equal(s.notes[0].from, 'the shelf');
});

test('behaviorState defaults onto an old save without touching state.js', () => {
  const s = blankState();
  assert.equal(s.behavior, undefined);
  const b = behaviorState(s);
  assert.equal(b.lastRun, 0);
  assert.deepEqual(b.claims, {});
  s.behavior = 'corrupted';
  assert.equal(typeof behaviorState(s).claims, 'object');
});

test('pruneBehavior forgets props that are no longer on the shelf', () => {
  const s = shelf([makePet('a'), makeProp('q1', 'bowl')]);
  const pet = s.pets[0];
  useProp(s, pet, s.props[0], NOW);
  assert.ok(behaviorState(s).props.q1);
  s.props = [];
  s.slots[1] = null;
  pruneBehavior(s, NOW);
  assert.equal(behaviorState(s).props.q1, undefined);
});

/* ---------------- durability ---------------- */

function randomShelf(rand) {
  const traitIds = TRAITS.map(t => t.id).concat(['deleted-trait']);
  const kinds = Object.keys(PROPS).concat(['deleted-prop']);
  const s = blankState();
  const anatomies = [
    undefined,
    { hasArms: true },
    { hasWings: true },
    { isLimbless: true, hasLegs: false },
    { hasLegs: true, legCount: 8, legStyle: 'spindly' },
    { hasTentacles: true, hasLegs: false },
    { hasTail: true },
    'garbage',
    { hasLegs: 'yes', legCount: 'many', armCount: null }
  ];
  for (let i = 0; i < 18; i++) {
    if (rand() < 0.3) continue;
    if (rand() < 0.65) {
      const pet = makePet('p' + i, [
        traitIds[Math.floor(rand() * traitIds.length)],
        traitIds[Math.floor(rand() * traitIds.length)]
      ], {
        needs: { food: rand() * 100, fuss: rand() * 100, clean: rand() * 100 },
        bond: Math.floor(rand() * 25),
        grudges: Math.floor(rand() * 25),
        anatomy: anatomies[Math.floor(rand() * anatomies.length)]
      });
      s.pets.push(pet);
      s.slots[i] = pet.id;
    } else {
      const prop = makeProp('q' + i, kinds[Math.floor(rand() * kinds.length)]);
      s.props.push(prop);
      s.slots[i] = prop.id;
    }
  }
  return s;
}

test('runBehavior never throws across many randomized shelves, and never loses a piece', () => {
  let seed = 12345;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let trial = 0; trial < 120; trial++) {
    const s = randomShelf(rand);
    const ids = new Set(s.slots.filter(Boolean));
    for (let pass = 0; pass < 4; pass++) {
      assert.doesNotThrow(() => runBehavior(s, NOW + pass * MOVE_COOLDOWN_MS * 3, { force: true }));
    }
    const after = s.slots.filter(Boolean);
    assert.equal(new Set(after).size, after.length, 'no piece was duplicated');
    after.forEach(id => assert.ok(ids.has(id), 'no piece appeared from nowhere'));
    assert.equal(after.length, ids.size, 'no piece fell off the shelf');
    s.pets.forEach(p => {
      ['food', 'fuss', 'clean'].forEach(k => {
        assert.ok(p.needs[k] >= 0 && p.needs[k] <= 100, 'needs stay in range');
      });
    });
  }
});

test('every behaviour note is non-empty, has a source and leaves no placeholders behind', () => {
  let seed = 999;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let trial = 0; trial < 40; trial++) {
    const s = randomShelf(rand);
    for (let pass = 0; pass < 3; pass++) runBehavior(s, NOW + pass * MOVE_COOLDOWN_MS * 3, { force: true });
    s.notes.forEach(n => {
      assert.ok(n.text && n.text.length > 5, 'note has text');
      assert.ok(n.from, 'note has a source');
      assert.equal(/\{[pnmq]\}/.test(n.text), false, 'no unfilled placeholder: ' + n.text);
      assert.ok(['note', 'angry', 'feud', 'arrival'].includes(n.kind), 'known note kind: ' + n.kind);
    });
  }
});

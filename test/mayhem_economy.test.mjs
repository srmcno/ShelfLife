import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState, localDayKey } from '../src/state.js';
import { CURIOS, RARITIES } from '../src/content/mayhem.js';
import { normalizeMayhem, blankMayhem } from '../src/mayhem-state.js';
import {
  addSouls, rollCurio, drawOmen, accrueMayhem, describeEmergency, resolveEmergency, choiceOdds, outcomeWeight,
  commissionCurio, commissionCost, pityActive, rewardRounds, ROUNDS_PAID_PER_DAY, ROUNDS_SOULS, PITY_DRY_AT, COMMISSION_COST
} from '../src/engine/mayhem.js';
import { doRounds } from '../src/engine/care.js';

const NOW = new Date(2026, 8, 25, 14, 0, 0).getTime();
const DAY = 86400000;
function household(count = 3, over = {}) {
  const s = blankState();
  s.started = NOW - DAY; s.lastTick = NOW;
  s.pets = Array.from({ length: count }, (_, i) => ({ id: 'm' + i, name: ['Agnes', 'Pip', 'Oswald'][i], traits: ['damp'], needs: { food: 40, fuss: 40, clean: 40 }, bond: 0, cared: 0, grudges: 0, born: NOW - DAY, stats: { cute: 5, menace: 5, damp: 5, mystique: 5 }, ...over }));
  s.pets.forEach((p, i) => { s.slots[i] = p.id; });
  return s;
}

test('rounds pay for the first few each day and are still allowed afterwards', () => {
  const s = household();
  let paid = 0;
  for (let i = 0; i < ROUNDS_PAID_PER_DAY + 4; i++) paid += rewardRounds(s, NOW + i * 61000);
  assert.equal(paid, ROUNDS_PAID_PER_DAY * ROUNDS_SOULS);
  assert.equal(s.mayhem.souls, ROUNDS_PAID_PER_DAY * ROUNDS_SOULS);
  assert.equal(rewardRounds(s, NOW + DAY), ROUNDS_SOULS, 'a new day pays again');
  const t = household();
  assert.ok(doRounds(t, NOW).souls > 0, 'the real rounds action reports what it paid');
  for (let i = 1; i <= ROUNDS_PAID_PER_DAY; i++) doRounds(t, NOW + i * 61000);
  const late = doRounds(t, NOW + 20 * 61000);
  assert.equal(late.souls, 0);
  assert.ok(late.message, 'an unpaid round still answers');
});

test('one missed night is forgiven, once, and comes back after a seventh night', () => {
  const s = household();
  drawOmen(s, NOW, () => 0);
  const two = drawOmen(s, NOW + DAY, () => 0.1);
  assert.equal(two.streak, 2); assert.equal(two.graceUsed, false);
  // Skip a whole night: the candle holds.
  const held = drawOmen(s, NOW + 3 * DAY, () => 0.2);
  assert.equal(held.streak, 3); assert.equal(held.graceUsed, true);
  assert.equal(s.mayhem.omen.grace, 0);
  // Miss another and the count restarts.
  const gone = drawOmen(s, NOW + 5 * DAY, () => 0.3);
  assert.equal(gone.streak, 1); assert.equal(gone.graceUsed, false);
  // Seven nights in a row earn it back.
  let t = NOW + 5 * DAY;
  for (let i = 0; i < 6; i++) { t += DAY; drawOmen(s, t, () => 0.4); }
  assert.equal(s.mayhem.omen.streak, 7);
  assert.equal(s.mayhem.omen.grace, 1);
});

test('a first night cannot be forgiven, and older saves start with the grace available', () => {
  const s = household();
  drawOmen(s, NOW, () => 0);
  const skip = drawOmen(s, NOW + 2 * DAY, () => 0.1);
  assert.equal(skip.streak, 1, 'a streak of one has nothing to protect');
  const old = normalizeMayhem({ omen: { day: localDayKey(NOW), id: 'wet-hand', streak: 4, lastDay: localDayKey(NOW) } }, household(), NOW);
  assert.equal(old.omen.grace, 1);
  assert.equal(normalizeMayhem({ omen: { day: localDayKey(NOW), id: 'wet-hand', streak: 4, lastDay: localDayKey(NOW), grace: 0 } }, household(), NOW).omen.grace, 0);
});

test('a long dry spell ends in something cursed or better, then the count resets', () => {
  const s = household();
  s.mayhem.dry = PITY_DRY_AT;
  assert.ok(pityActive(s));
  for (let i = 0; i < 25; i++) {
    s.mayhem.dry = PITY_DRY_AT;
    // NOW is late September: outside the Thin Season (15 October to 2 November), so
    // these rolls never meet a seasonal curio however the real clock reads.
    const roll = rollCurio(s, () => 0, false, NOW);
    assert.ok(['cursed', 'unholy'].includes(roll.rarity.id), 'pity rolls only cursed or unholy');
    assert.equal(roll.pity, true);
    assert.equal(s.mayhem.dry, 0);
  }
  // Below the threshold rolls are ordinary, and commons count towards the drought.
  s.mayhem.dry = 0;
  const common = rollCurio(s, () => 0, false, NOW);
  assert.equal(common.rarity.id, 'common');
  assert.equal(s.mayhem.dry, 1);
  assert.ok(!pityActive(s));
});

test('the pity counter survives a reload and hostile values', () => {
  const s = household();
  s.mayhem.dry = 12; s.mayhem.roundsPaid = 3; s.mayhem.roundsDay = localDayKey(NOW);
  const back = normalizeState(JSON.parse(JSON.stringify(s)));
  assert.equal(back.mayhem.dry, 12); assert.equal(back.mayhem.roundsPaid, 3);
  const hostile = normalizeMayhem({ dry: -4, roundsPaid: 'x', roundsDay: 9 }, s, NOW);
  assert.equal(hostile.dry, 0); assert.equal(hostile.roundsPaid, 0); assert.equal(hostile.roundsDay, '');
  assert.equal(blankMayhem().dry, 0);
});

test('special orders buy exactly the curio you are missing and refuse duplicates', () => {
  const s = household();
  const target = CURIOS.find(c => c.rarity === 'rare');
  assert.equal(commissionCost(target.id), COMMISSION_COST.rare);
  assert.equal(commissionCurio(s, target.id), null, 'no souls, no order');
  addSouls(s, COMMISSION_COST.rare + 10);
  const got = commissionCurio(s, target.id);
  assert.equal(got.curio.id, target.id); assert.equal(got.cost, COMMISSION_COST.rare);
  assert.equal(s.mayhem.souls, 10);
  assert.equal(s.mayhem.curios[target.id], 1);
  addSouls(s, 1000);
  assert.equal(commissionCurio(s, target.id), null, 'you cannot order what you already own');
  assert.equal(commissionCurio(s, 'not-a-curio'), null);
  assert.ok(RARITIES.every(r => COMMISSION_COST[r.id] > 0));
  assert.ok(COMMISSION_COST.unholy > COMMISSION_COST.cursed && COMMISSION_COST.cursed > COMMISSION_COST.rare);
});

test('a menacing resident makes bad outcomes likelier, a trusted one turns them aside', () => {
  const bad = { tone: 'bad' }, good = { tone: 'good' }, weird = { tone: 'weird' };
  const plain = { stats: { cute: 5, menace: 5, mystique: 5 }, bond: 0 };
  for (const o of [bad, good, weird]) assert.equal(outcomeWeight(plain, o), 1, 'a plain resident rolls every outcome equally');
  assert.equal(outcomeWeight({}, bad), 1, 'missing stats are treated as plain');
  assert.ok(outcomeWeight({ ...plain, stats: { menace: 9 } }, bad) > 1);
  assert.ok(outcomeWeight({ ...plain, stats: { menace: 1 } }, bad) < 1);
  assert.ok(outcomeWeight({ ...plain, bond: 25 }, bad) < outcomeWeight({ ...plain, bond: 0 }, bad));
  assert.ok(outcomeWeight({ ...plain, bond: 25 }, good) > 1);
  assert.ok(outcomeWeight({ stats: { menace: 10 }, bond: 0 }, bad) <= 2);
  assert.ok(outcomeWeight({ stats: { menace: 1 }, bond: 25 }, bad) >= 0.2);
  const choice = { outcomes: [{ tone: 'good' }, { tone: 'bad' }] };
  const calm = choiceOdds(choice, { stats: { menace: 1 }, bond: 25 }), wild = choiceOdds(choice, { stats: { menace: 10 }, bond: 0 });
  assert.ok(calm.bad < wild.bad);
  assert.ok(calm.level < wild.level);
  assert.ok(Math.abs(calm.good + calm.bad + calm.weird - 1) < 1e-9);
  assert.equal(choiceOdds({ outcomes: [{ tone: 'good' }, { tone: 'weird' }] }, plain).label, 'Safe enough');
});

test('odds drive real outcomes: the same dice give different endings to different residents', () => {
  // The ouija board's first choice has a good, a bad and a weird ending.
  const tally = (over, rolls) => {
    const counts = { good: 0, bad: 0, weird: 0 };
    for (let i = 0; i < rolls; i++) {
      const s = household(1, over);
      s.mayhem.queue = [{ uid: 1, id: 'ouija', a: 'm0', at: NOW }];
      s.mayhem.serial = 1;
      counts[resolveEmergency(s, 1, 0, NOW, () => (i + 0.5) / rolls).tone]++;
    }
    return counts;
  };
  const menacing = tally({ stats: { cute: 5, menace: 10, damp: 5, mystique: 5 }, bond: 0 }, 300);
  const beloved = tally({ stats: { cute: 5, menace: 2, damp: 5, mystique: 5 }, bond: 25 }, 300);
  assert.ok(menacing.bad > beloved.bad + 30, 'menace ' + menacing.bad + ' vs trusted ' + beloved.bad);
  assert.ok(beloved.good > menacing.good);
});

test('describeEmergency exposes odds for both choices', () => {
  const s = household();
  accrueMayhem(s, NOW, () => 0);
  const info = describeEmergency(s, s.mayhem.queue[0]);
  assert.equal(info.odds.length, 2);
  for (const o of info.odds) assert.ok(typeof o.label === 'string' && o.level >= 0 && o.level <= 3);
});

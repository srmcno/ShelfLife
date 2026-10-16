import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState } from '../src/state.js';
import { JURY_ALL_DISAGREE } from '../src/content/court.js';
import { castEpisode, episodeRule, courtFinish, dissent } from '../src/engine/court.js';
import { seededRandom } from '../src/engine/arcade.js';

// A juror marked absent by the sleepy role used to be counted as a dissenter,
// so a summary could say "5 to 1" while also saying a juror slept, or use the
// unanimous "against you" line when the jurors who were awake were simply
// fewer. Dissent now counts only jurors who were awake.
const NOW = new Date(2026, 8, 25, 14, 0, 0).getTime();
function sleepyShelf() {
  const s = blankState();
  const traits = [['damp'], ['damp'], ['nocturnal'], ['nocturnal'], ['nocturnal'], ['nocturnal'], ['nocturnal'], ['nocturnal']];
  s.pets = traits.map((t, i) => ({ id: 'g' + i, name: 'Juror ' + i, traits: t, needs: { food: 50, fuss: 40, clean: 50 }, bond: 2, cared: 0, grudges: 0, born: NOW - 86400000 }));
  s.pets.forEach((p, i) => { s.slots[i] = p.id; });
  return s;
}
function rule(seed, ruling) {
  const s = sleepyShelf();
  const ep = castEpisode(s, { caseId: 'borrowed-coffin', plaintiffId: 'g0', defendantId: 'g1', twist: 'base', now: NOW }, seededRandom(seed));
  const out = episodeRule(ep, ruling, seededRandom(seed * 7 + 1));
  return { s, ep, out };
}

test('jurors who slept are neither for nor against: the tally and the wrap count only the awake', () => {
  let checked = 0, zeroWithSleepers = 0;
  for (let seed = 1; seed < 400; seed++) {
    for (const ruling of ['plaintiff', 'defendant', 'both']) {
      const { s, ep, out } = rule(seed, ruling);
      if (!out.absent.length) continue;
      checked++;
      const awake = ep.jury.length - out.absent.length;
      assert.equal(out.agree + out.disagree, awake, 'every awake juror is counted once');
      for (const i of out.absent) assert.equal(out.votes[i], false);
      const summary = out.jury[out.jury.length - 1].t;
      if (out.agree === ep.jury.length) continue;
      assert.ok(!JURY_ALL_DISAGREE.includes(summary), 'never the unanimous line while someone slept: ' + summary);
      assert.ok(summary.startsWith('The jury agrees, ' + out.agree + ' to ' + out.disagree + '.'), summary);
      assert.match(summary, /slept through it\.$/);
      if (out.agree === 0) zeroWithSleepers++;
      const res = courtFinish(s, ep, NOW);
      assert.equal(res.disagree, out.disagree, 'the wrap gets the same count');
      assert.equal(dissent(ep), out.disagree);
    }
  }
  assert.ok(checked > 50, 'enough episodes had a sleeper (' + checked + ')');
  assert.ok(zeroWithSleepers > 0, 'and some had nobody awake agreeing');
});

test('with nobody asleep the old lines are unchanged', () => {
  for (let seed = 1; seed < 200; seed++) {
    const { ep, out } = rule(seed, 'plaintiff');
    if (out.absent.length) continue;
    assert.equal(out.disagree, ep.jury.length - out.agree);
    const summary = out.jury[out.jury.length - 1].t;
    if (out.agree === 0) assert.ok(JURY_ALL_DISAGREE.includes(summary));
  }
});

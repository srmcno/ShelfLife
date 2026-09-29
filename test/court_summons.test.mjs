import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState } from '../src/state.js';
import { COURT_CASES, QUESTIONS_PER_EPISODE } from '../src/content/court.js';
import {
  castEpisode, episodeOpening, episodeQuestions, episodeAsk, episodeRule, courtFinish, docketToday, fill,
  summonsReward, SUMMONS_SOULS, VERDICT_SOULS, SUMMONS_DAILY_CAP
} from '../src/engine/court.js';
import { courtroomState, normalizeCourtroom } from '../src/court-state.js';
import { seededRandom } from '../src/engine/arcade.js';
import { guestPet } from '../src/cloud/social.js';
import { generateCreature } from '../src/art/creatures.js';

const NOW = new Date(2026, 8, 25, 14, 0, 0).getTime();
const DAY = 86400000;
const ID = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
function household(n = 3) {
  const s = blankState();
  s.pets = ['Agnes', 'Mort', 'Pip', 'Dot'].slice(0, n).map((name, i) => ({ id: 'g' + i, name, traits: ['damp'], needs: { food: 50, fuss: 40, clean: 50 },
    bond: 2, cared: 0, grudges: 0, born: NOW - DAY }));
  s.pets.forEach((p, i) => { s.slots[i] = p.id; });
  return normalizeState(s);
}
// A friend's resident, as the inbox delivers it. Its id is the same as one of
// ours on purpose: ids are only unique within a shelf.
const mabel = () => guestPet({ id: 'g1', name: 'Mabel', traits: ['spiteful'], mood: 'fine', bond: 3, art: { creature: generateCreature({ seed: 'mabel' }) } });
function hear(s, caseId, ruling, rnd = seededRandom(5)) {
  const ep = castEpisode(s, { caseId, defendantId: 'g2', guest: { side: 'p', pet: mabel() } }, rnd);
  episodeOpening(ep, rnd);
  for (const q of episodeQuestions(ep).slice(0, QUESTIONS_PER_EPISODE)) episodeAsk(ep, q.index, rnd);
  episodeRule(ep, ruling, rnd);
  return ep;
}

test('a guest plaintiff is seated as a guest and one of ours defends', () => {
  const s = household();
  const ep = castEpisode(s, { caseId: 'borrowed-coffin', defendantId: 'g2', guest: { side: 'p', pet: mabel() } }, seededRandom(1));
  assert.deepEqual(ep.p, { kind: 'guest', id: 'guest-g1', name: 'Mabel' });
  assert.deepEqual(ep.d, { kind: 'pet', id: 'g2', name: 'Pip' });
  assert.equal(ep.guest, 'p');
  assert.equal(ep.caseId, 'borrowed-coffin');
  assert.deepEqual(ep.jury.filter(j => j.kind === 'pet').map(j => j.id), ['g0', 'g1'], 'our own g1 still sits on the jury; the guest never does');
  assert.equal(ep.jury.length, 6);
  assert.ok(!ep.jury.some(j => j.kind === 'guest'));
  assert.match(fill(ep, '{p} v. {d}'), /^Mabel v\. Pip$/);
  const defending = castEpisode(s, { caseId: 'tontine', plaintiffId: 'g0', guest: { side: 'd', pet: mabel() } }, seededRandom(1));
  assert.deepEqual([defending.p.kind, defending.d.kind, defending.d.name], ['pet', 'guest', 'Mabel']);
  assert.equal(castEpisode(s, { caseId: 'tontine', defendantId: 'gone', guest: { side: 'p', pet: mabel() } }), null, 'no resident, no case');
  assert.equal(castEpisode(s, { caseId: 'tontine', defendantId: 'g2', guest: { side: 'p', pet: null } }), null);
});

test('hearing a summons pays the usual souls and leaves trust, grudges and records alone', () => {
  const s = household();
  const docket = docketToday(s, NOW);
  const wrong = COURT_CASES.find(k => k.id === docket.caseId).truth === 'plaintiff' ? 'defendant' : 'plaintiff';
  const before = JSON.parse(JSON.stringify(s));
  const ep = hear(s, docket.caseId, wrong);
  const souls = s.mayhem.souls;
  const res = courtFinish(s, ep, NOW);
  assert.equal(res.guest, true);
  assert.ok(res.souls > 0, 'the game purse pays as usual');
  assert.equal(s.mayhem.souls - souls, res.souls);
  assert.equal(res.trust, null);
  assert.equal(res.grudge, null);
  assert.equal(res.docket, null, 'someone else’s case never files today’s docket');
  assert.equal(res.firstAir, false);
  const c = courtroomState(s);
  assert.equal(c.episodes, 0);
  assert.equal(c.justice, 0);
  assert.deepEqual(c.best, {});
  assert.equal(c.docketDay, '');
  assert.deepEqual(s.pets.map(p => [p.courtCases, p.grudges, p.bonusTrust ?? null]), before.pets.map(p => [p.courtCases, p.grudges, p.bonusTrust ?? null]));
  assert.deepEqual(s.life.scenes, before.life.scenes, 'a friend’s resident is never written into our memories');
  assert.equal(courtFinish(s, ep, NOW), null, 'settled once');
});

test('summons rewards: once per summons, three a day of each kind, fresh each morning', () => {
  const s = household();
  const souls = () => s.mayhem.souls;
  assert.equal(summonsReward(s, ID(1), 'heard', NOW), SUMMONS_SOULS);
  assert.equal(summonsReward(s, ID(1), 'heard', NOW), 0, 'the same summons never pays twice');
  assert.equal(summonsReward(s, ID(1), 'verdict', NOW), 0);
  summonsReward(s, ID(2), 'heard', NOW);
  summonsReward(s, ID(3), 'heard', NOW);
  assert.equal(SUMMONS_DAILY_CAP, 3);
  const start = souls();
  assert.equal(summonsReward(s, ID(4), 'heard', NOW), 0, 'a fourth hearing today pays nothing');
  assert.equal(souls(), start);
  assert.equal(summonsReward(s, ID(5), 'verdict', NOW), VERDICT_SOULS, 'verdicts have their own three');
  assert.equal(summonsReward(s, ID(4), 'heard', NOW + DAY), 0, 'a summons remembered as heard stays paid');
  assert.equal(summonsReward(s, ID(6), 'heard', NOW + DAY), SUMMONS_SOULS, 'a new day, a new three');
  assert.equal(summonsReward(s, '', 'heard', NOW + DAY), 0);
  const c = courtroomState(s);
  assert.equal(c.summonsHeard, 1);
  assert.equal(c.summonsVerdicts, 0);
  assert.deepEqual(c.summonsPaid, [1, 2, 3, 4, 5, 6].map(ID));
  for (let i = 10; i < 60; i++) summonsReward(s, ID(i), 'verdict', NOW + 2 * DAY + i);
  assert.equal(courtroomState(s).summonsPaid.length, 40, 'the list of paid summonses is bounded');
});

test('summons records survive a reload and hostile data', () => {
  const s = household();
  summonsReward(s, ID(9), 'verdict', NOW);
  const back = normalizeState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(courtroomState(back).summonsPaid, [ID(9)]);
  assert.equal(courtroomState(back).summonsVerdicts, 1);
  const bad = normalizeCourtroom({ summonsDay: 'today', summonsHeard: -4, summonsVerdicts: 1e9, summonsPaid: [ID(1), ID(1), 'x', 42, { id: ID(2) }, 'ABCDEF00-0000-4000-8000-000000000003'] });
  assert.deepEqual([bad.summonsDay, bad.summonsHeard, bad.summonsVerdicts, bad.summonsPaid], ['', 0, 99, [ID(1)]]);
  const loose = { courtroom: { episodes: 2, best: {} } };
  assert.deepEqual(courtroomState(loose).summonsPaid, [], 'an older record gains the fields when read');
});

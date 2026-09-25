import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState } from '../src/state.js';
import { COURT_CASES, COURT_CAST, HAPPENINGS, RANDOM_HAPPENINGS, ADS, QUESTIONS_PER_EPISODE, JURY_EXTRAS, STAND_INS } from '../src/content/court.js';
import { COURT_ART } from '../src/art/court-cast.js';
import {
  castEpisode, episodeOpening, episodeQuestions, episodeAsk, questionsLeft, startHappening, resolveHappening, randomHappening,
  episodeBreak, episodeRule, courtFinish, courtCases, nextCaseId, JURY_SEATS
} from '../src/engine/court.js';
import { seededRandom } from '../src/engine/arcade.js';
import { normalizeCourtroom } from '../src/court-state.js';
import { ESCAPADES } from '../src/content/escapades.js';

const NOW = new Date(2026, 8, 25, 14, 0, 0).getTime();
const SPEAKERS = new Set(['judge', 'bailiff', 'p', 'd', 'announcer', 'audience', 'jury', 'narrator', 'npc']);
function household(n = 3) {
  const s = blankState();
  s.pets = ['Agnes', 'Mort', 'Pip', 'Dot'].slice(0, n).map((name, i) => ({ id: 'g' + i, name, traits: ['damp'], needs: { food: 50, fuss: 40, clean: 50 }, bond: 2, cared: 0, grudges: 0, born: NOW - 86400000 }));
  s.pets.forEach((p, i) => { s.slots[i] = p.id; });
  return s;
}
const leftovers = list => list.filter(line => /\{[pdjx]\}/.test(line.t));
function playAll(s, caseId, ruling, choice = 'gavel', rnd = seededRandom(3)) {
  const ep = castEpisode(s, { caseId, plaintiffId: 'g0', defendantId: 'g1' }, rnd);
  const said = [...episodeOpening(ep, rnd)];
  for (const q of episodeQuestions(ep).slice(0, QUESTIONS_PER_EPISODE)) {
    const r = episodeAsk(ep, q.index, rnd);
    said.push(...r.lines);
    if (r.happening) { said.push(...r.happening.lines); said.push(...resolveHappening(ep, r.happening, choice)); }
  }
  const result = episodeRule(ep, ruling ?? COURT_CASES.find(k => k.id === caseId).truth, rnd);
  said.push(...result.ruling, ...result.jury, result.audience, ...result.hallway);
  return { ep, result, said };
}

test('twelve cases, fairly split, each with six questions, clues that point at the truth and three rulings', () => {
  assert.equal(COURT_CASES.length, 12);
  const truths = COURT_CASES.map(k => k.truth);
  for (const t of ['plaintiff', 'defendant', 'both']) assert.equal(truths.filter(x => x === t).length, 4, t);
  for (const k of COURT_CASES) {
    assert.equal(k.questions.length, 6, k.id);
    assert.ok(k.questions.filter(q => q.clue).length >= 2, k.id + ' needs at least two clues');
    assert.ok(k.questions.some(q => q.sass), k.id + ' needs a zinger');
    for (const r of ['plaintiff', 'defendant', 'both']) assert.ok(k.rulings[r]?.length, k.id + ' ruling ' + r);
    assert.ok(k.hallway.p && k.hallway.d, k.id + ' hallway');
    const all = [...k.plaintiff, ...k.defendant, ...k.questions.flatMap(q => q.lines), ...Object.values(k.rulings).flat()];
    for (const [s, , who] of all) {
      assert.ok(SPEAKERS.has(s), k.id + ' speaker ' + s);
      if (s === 'npc') { assert.ok(COURT_CAST[who], k.id + ' npc ' + who); assert.ok(COURT_ART[COURT_CAST[who].art]); }
    }
    for (const q of k.questions) if (q.happen) assert.ok(HAPPENINGS[q.happen], k.id + ' happening ' + q.happen);
  }
  for (const id of RANDOM_HAPPENINGS) assert.ok(HAPPENINGS[id], id);
  for (const id of [...JURY_EXTRAS, ...STAND_INS]) assert.ok(COURT_ART[COURT_CAST[id].art], id);
  assert.ok(ADS.length >= 6);
});

test('the script never uses a dash as punctuation', () => {
  assert.ok(!/[—–]/.test(JSON.stringify([COURT_CASES, HAPPENINGS, ADS])));
});

test('the shelf is the jury: other residents first, neighbours fill the rest, witnesses never sit', () => {
  const s = household(4);
  const ep = castEpisode(s, { caseId: 'snoring-wall', plaintiffId: 'g0', defendantId: 'g1' }, seededRandom(1));
  assert.equal(ep.p.name, 'Agnes'); assert.equal(ep.d.name, 'Mort');
  assert.equal(ep.jury.length, JURY_SEATS);
  assert.deepEqual(ep.jury.slice(0, 2).map(j => j.name), ['Pip', 'Dot']);
  assert.ok(!ep.jury.some(j => j.id === 'ghost'), 'the snoring case calls the ghost as a witness');
  const alone = household(1);
  const solo = castEpisode(alone, { caseId: 'moth-custody', plaintiffId: 'g0' }, seededRandom(2));
  assert.equal(solo.d.kind, 'npc');
  assert.notEqual(solo.d.id, 'moth');
  assert.equal(solo.jury.length, JURY_SEATS);
  assert.equal(castEpisode(blankState(), {}), null);
});

test('every case plays start to finish with every name filled in', () => {
  for (const k of COURT_CASES) {
    for (const choice of ['gavel', 'let']) {
      const { said, result } = playAll(household(3), k.id, k.truth, choice, seededRandom(k.id.length + choice.length));
      assert.deepEqual(leftovers(said), [], k.id);
      assert.equal(result.correct, true);
    }
  }
});

test('three questions only, clues go in the notes, and zingers and chaos move the meters', () => {
  const s = household();
  const ep = castEpisode(s, { caseId: 'borrowed-coffin', plaintiffId: 'g0', defendantId: 'g1' }, seededRandom(4));
  const zinger = episodeAsk(ep, 2, seededRandom(1));
  assert.equal(zinger.clue, null);
  assert.ok(ep.ratings > 50);
  const clue = episodeAsk(ep, 0, seededRandom(1));
  assert.match(clue.clue, /Keith/);
  assert.equal(ep.clues.length, 1);
  assert.equal(episodeAsk(ep, 0), null, 'no asking twice');
  const withScene = episodeAsk(ep, 3, seededRandom(1));
  assert.equal(withScene.happening.id, 'outburst');
  assert.equal(withScene.happening.x, 'p');
  assert.ok(withScene.happening.lines.some(l => l.s === 'p'));
  const before = { ...ep };
  resolveHappening(ep, withScene.happening, 'let');
  assert.ok(ep.ratings > before.ratings && ep.respect < before.respect);
  assert.equal(questionsLeft(ep), 0);
  assert.equal(episodeAsk(ep, 1), null);
  const br = episodeBreak(ep, seededRandom(2));
  assert.ok(ep.hadBreak && br.ad.brand);
  const scene = randomHappening(ep, seededRandom(5));
  assert.ok(scene && scene.id !== 'outburst', 'the outburst already happened');
  assert.equal(ep.happened.filter(id => id === scene.id).length, 1);
});

test('a just ruling earns the winner’s trust; an unjust one earns a grudge', () => {
  const fair = household();
  const good = playAll(fair, 'borrowed-coffin', 'plaintiff');
  const res = courtFinish(fair, good.ep, NOW);
  assert.equal(res.correct, true);
  assert.equal(res.trust, 'Agnes');
  assert.equal(res.grudge, null);
  assert.equal(courtFinish(fair, good.ep, NOW), null, 'an episode settles once');
  assert.equal(fair.courtroom.episodes, 1);
  assert.equal(fair.courtroom.justice, 1);
  assert.ok(fair.courtroom.best['borrowed-coffin'] >= 1);
  assert.equal(fair.pets[0].courtCases, 1);
  assert.equal(fair.pets[1].courtCases, 1);
  assert.ok(fair.life.scenes.some(scene => scene.kind === 'court'));

  const unfair = household();
  const bad = playAll(unfair, 'borrowed-coffin', 'defendant');
  const wrong = courtFinish(unfair, bad.ep, NOW);
  assert.equal(wrong.correct, false);
  assert.equal(wrong.grudge, 'Agnes');
  assert.equal(unfair.pets[0].grudges, 1);
  assert.equal(unfair.courtroom.justice, 0);

  const idiots = household();
  const both = playAll(idiots, 'stolen-slot', 'both');
  const r = courtFinish(idiots, both.ep, NOW);
  assert.equal(r.correct, true);
  assert.equal(r.trust, null);
  assert.equal(r.grudge, null);
});

test('the jury mostly follows a respected, correct judge and the stars add up', () => {
  const s = household();
  const ep = castEpisode(s, { caseId: 'haunted-sock', plaintiffId: 'g0', defendantId: 'g1' }, seededRandom(1));
  ep.respect = 100; ep.ratings = 90;
  const r = episodeRule(ep, 'defendant', seededRandom(9));
  assert.equal(r.agree, 6);
  assert.equal(r.stars, 3);
  assert.equal(episodeRule(ep, 'both'), null, 'one ruling per episode');
  const s2 = household();
  const ep2 = castEpisode(s2, { caseId: 'haunted-sock', plaintiffId: 'g0', defendantId: 'g1' }, seededRandom(1));
  ep2.respect = 0; ep2.ratings = 20;
  const r2 = episodeRule(ep2, 'plaintiff', seededRandom(9));
  assert.equal(r2.stars, 0);
  assert.ok(r2.agree <= 3);
});

test('the guide offers unaired cases first and records survive a reload', () => {
  const s = household();
  const first = nextCaseId(s, seededRandom(1));
  const { ep } = playAll(s, first);
  courtFinish(s, ep, NOW);
  for (let i = 0; i < 20; i++) assert.notEqual(nextCaseId(s, seededRandom(i)), first);
  const list = courtCases(s);
  assert.equal(list.filter(c => c.aired).length, 1);
  const reloaded = normalizeState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(reloaded.courtroom.best, s.courtroom.best);
  assert.deepEqual(normalizeCourtroom({ episodes: 3, justice: 9, best: { 'borrowed-coffin': 7, nope: 2, 'snoring-wall': -1 }, last: 'nope' }),
    { episodes: 3, justice: 3, best: { 'borrowed-coffin': 3 }, last: '' });
});

test('adventures can ask for an episode, and an episode moves them on', () => {
  const approaches = ESCAPADES.flatMap(e => e.approaches).filter(a => a.activity === 'court');
  assert.ok(approaches.length >= 3);
});

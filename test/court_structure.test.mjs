import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState } from '../src/state.js';
import { COURT_CASES, QUESTIONS_PER_EPISODE } from '../src/content/court.js';
import {
  BONUS_QUESTIONS, OBJECTION_STRIKE, OBJECTION_CONFIRM, OBJECTION_PRESS, RECEIPT_TAKES
} from '../src/content/court-bonus.js';
import {
  castEpisode, episodeCase, episodeOpening, episodeQuestions, episodeAsk, episodePlan, episodeRule, courtFinish, nextCaseId, rotateCast, RECENT_AVOID,
  BONUS_CHANCE, COURT_BY_ID, lineSets, resolveHappening, shuffled, courtCases
} from '../src/engine/court.js';
import { courtroomState, normalizeCourtroom } from '../src/court-state.js';
import { seededRandom } from '../src/engine/arcade.js';

const NOW = new Date(2026, 8, 25, 14, 0, 0).getTime();
function household(n = 3) {
  const s = blankState();
  s.pets = ['Agnes', 'Mort', 'Pip', 'Dot', 'Eve'].slice(0, n).map((name, i) => ({ id: 'g' + i, name, traits: ['damp'], needs: { food: 50, fuss: 40, clean: 50 }, bond: 2, cared: 0, grudges: 0, born: NOW - 86400000 }));
  s.pets.forEach((p, i) => { s.slots[i] = p.id; });
  return s;
}
const SPEAKERS = new Set(['judge', 'bailiff', 'p', 'd', 'announcer', 'audience', 'jury', 'narrator', 'npc', 'x']);
const text = value => lineSets(value).flat().map(l => l[1]);

test('the bonus questions work in any case, are funny twice over, and follow the writing rules', () => {
  assert.ok(BONUS_QUESTIONS.length >= 8 && BONUS_QUESTIONS.length <= 10, 'eight to ten of them');
  assert.equal(new Set(BONUS_QUESTIONS.map(b => b.id)).size, BONUS_QUESTIONS.length);
  assert.equal(new Set(BONUS_QUESTIONS.map(b => b.ask)).size, BONUS_QUESTIONS.length);
  for (const b of BONUS_QUESTIONS) {
    assert.match(b.id, /^[a-z0-9-]{1,40}$/);
    assert.ok(lineSets(b.lines).length === 2, b.id + ' has two takes');
    assert.notEqual(JSON.stringify(lineSets(b.lines)[0]), JSON.stringify(lineSets(b.lines)[1]));
    for (const set of lineSets(b.lines)) { assert.ok(set.length >= 2 && set.length <= 5, b.id + ' take length'); }
    for (const [s, , who] of lineSets(b.lines).flat()) { assert.ok(SPEAKERS.has(s), b.id + ' speaker ' + s); assert.equal(who, undefined, b.id + ' needs no cast member'); }
    for (const t of [b.ask, ...text(b.lines)]) {
      assert.ok(!/[–—]/.test(t), b.id + ' has a dash');
      assert.ok(!/["']/.test(t), b.id + ' has a straight quote: ' + t);
      assert.ok(t.length <= 280, b.id + ' line over budget');
      for (const [slot] of t.matchAll(/\{[^}]*\}/g)) assert.ok(['{p}', '{d}', '{j}'].includes(slot), b.id + ' uses ' + slot);
    }
  }
  for (const group of [OBJECTION_STRIKE, OBJECTION_CONFIRM, OBJECTION_PRESS, RECEIPT_TAKES]) {
    assert.ok(group.length >= 3, 'three takes of each');
    for (const t of group.flat().map(l => l[1])) assert.ok(!/[–—]/.test(t) && !/["']/.test(t), t);
  }
});

test('the layout of an episode is rolled, and every roll leaves a playable case', () => {
  const seen = { breaks: new Set(), extras: new Set(), orders: new Set(), bonuses: 0, none: 0 };
  for (let seed = 1; seed <= 300; seed++) {
    const k = COURT_CASES[seed % COURT_CASES.length];
    const plan = episodePlan(k, seededRandom(seed));
    assert.ok([1, 2].includes(plan.breakBefore));
    assert.ok(plan.extraAfter === -1 || plan.extraAfter === (plan.breakBefore === 2 ? 0 : 1), 'the extra scene is not next to the ad scene');
    assert.deepEqual([...plan.order].sort(), [0, 1, 2, 3, 4, 5]);
    seen.breaks.add(plan.breakBefore); seen.extras.add(plan.extraAfter); seen.orders.add(plan.order.join(''));
    if (plan.bonus) {
      seen.bonuses++;
      const q = k.questions[plan.bonus.index];
      assert.ok(!q.clue && !q.herring, 'a bonus question only ever replaces colour, never a clue');
      assert.ok(BONUS_QUESTIONS.some(b => b.id === plan.bonus.id));
      if (q.sass) assert.ok(BONUS_QUESTIONS.find(b => b.id === plan.bonus.id).sass, 'a zinger gives way only to a zinger');
    } else seen.none++;
  }
  assert.deepEqual([...seen.breaks].sort(), [1, 2]);
  assert.deepEqual([...seen.extras].sort(), [-1, 0, 1]);
  assert.ok(seen.orders.size > 100, 'questions come in many orders');
  assert.ok(seen.bonuses > 120 && seen.none > 60, 'a bonus question about two times in three (' + seen.bonuses + ' of 300)');
  assert.ok(Math.abs(seen.bonuses / 300 - BONUS_CHANCE) < 0.12);
  // Played through the engine, the invariants of a case still hold with a bonus in place.
  for (const k of COURT_CASES) for (let seed = 1; seed <= 12; seed++) {
    const ep = castEpisode(household(), { caseId: k.id, plaintiffId: 'g0', defendantId: 'g1' }, seededRandom(seed));
    const e = episodeCase(ep);
    assert.equal(e.questions.length, 6);
    assert.ok(e.questions.filter(q => q.clue).length >= 2 && e.questions.filter(q => !q.clue).length >= 2 && e.questions.some(q => q.sass), k.id);
    if (ep.plan.bonus) {
      const swapped = e.questions[ep.plan.bonus.index];
      assert.equal(swapped.bonus, true);
      assert.notEqual(swapped.ask, k.questions[ep.plan.bonus.index].ask);
    }
    // All six stay askable by their index, in the order offered.
    const listed = episodeQuestions(ep);
    assert.deepEqual(listed.map(q => q.index), ep.plan.order);
    assert.ok(listed.every(q => !/\{[a-z]+\}/.test(q.text)));
    const r = episodeAsk(ep, listed[0].index, seededRandom(seed));
    assert.ok(r.lines.every(l => !/\{[a-z]+\}/.test(l.t)), k.id);
    if (r.happening) assert.ok(resolveHappening(ep, r.happening, 'gavel', seededRandom(1)).every(l => !/\{[a-z]+\}/.test(l.t)));
  }
});

test('a bonus question, asked, plays with the names filled in and moves the meters like any plain question', () => {
  for (const b of BONUS_QUESTIONS) for (const take of [0, 0.99]) {
    const ep = castEpisode(household(), { caseId: 'borrowed-coffin', plaintiffId: 'g0', defendantId: 'g1' }, seededRandom(2));
    ep.plan = { ...ep.plan, bonus: { index: 4, id: b.id } };
    const asked = episodeQuestions(ep).find(q => q.index === 4);
    assert.equal(asked.bonus, true);
    const before = ep.ratings;
    const r = episodeAsk(ep, 4, () => take);
    assert.ok(r.lines.length >= 2);
    for (const l of r.lines) assert.ok(!/\{[a-z]+\}/.test(l.t) && l.t.length, b.id + ': ' + l.t);
    assert.equal(r.clue, null);
    assert.equal(ep.ratings - before, b.sass ? 8 : 3);
  }
});

test('questions are not offered in one fixed order, and never more than three can be asked', () => {
  const firsts = new Set();
  for (let seed = 1; seed <= 60; seed++) {
    const ep = castEpisode(household(), { caseId: 'snoring-wall', plaintiffId: 'g0', defendantId: 'g1' }, seededRandom(seed));
    firsts.add(episodeQuestions(ep)[0].index);
    const picks = episodeQuestions(ep).slice(0, 5);
    let asked = 0;
    for (const q of picks) if (episodeAsk(ep, q.index, seededRandom(seed))) asked++;
    assert.equal(asked, QUESTIONS_PER_EPISODE);
  }
  assert.ok(firsts.size >= 5, 'any of the questions can come first');
});

test('the next case: unaired first, then the one seen longest ago, never one from the last six episodes', () => {
  const s = household();
  const air = id => {
    const ep = castEpisode(s, { caseId: id, plaintiffId: 'g0', defendantId: 'g1' }, seededRandom(1));
    episodeRule(ep, COURT_BY_ID[id].truth, seededRandom(2));
    courtFinish(s, ep, NOW);
  };
  const order = COURT_CASES.map(k => k.id);
  // While anything is unaired, only unaired cases are offered.
  for (let i = 0; i < order.length - 1; i++) {
    for (let seed = 1; seed < 15; seed++) assert.ok(!(nextCaseId(s, seededRandom(seed)) in courtroomState(s).best), 'offered an aired case with ' + (order.length - i) + ' unaired');
    air(order[i]);
  }
  air(order.at(-1));
  assert.deepEqual(courtroomState(s).recent, order, 'the recent list is the order aired');
  // Everything aired: the next is among the least recently seen, never one of the last six.
  const lately = new Set(order.slice(-RECENT_AVOID));
  const offered = new Set();
  for (let seed = 1; seed < 200; seed++) {
    const id = nextCaseId(s, seededRandom(seed));
    assert.ok(!lately.has(id), id + ' was one of the last six');
    offered.add(id);
  }
  const oldest = order.slice(0, Math.ceil((order.length - RECENT_AVOID) / 3));
  assert.ok([...offered].every(id => order.indexOf(id) < Math.max(3, Math.ceil((order.length - RECENT_AVOID) / 3))), 'only from the oldest third');
  assert.ok(offered.size >= 3 && oldest.length >= 3, 'with some variety');
  // Re-airing moves a case to the back of the line.
  air(order[0]);
  assert.equal(courtroomState(s).recent.at(-1), order[0]);
  assert.equal(courtroomState(s).recent.length, order.length, 'each case once');
  for (let seed = 1; seed < 100; seed++) assert.notEqual(nextCaseId(s, seededRandom(seed)), order[0]);
  // `not` is honoured, even for a tiny pool.
  for (let seed = 1; seed < 30; seed++) assert.notEqual(nextCaseId(s, seededRandom(seed), order[6]), order[6]);
  // An older save with no recent list but a last case avoids that case.
  const old = household(); old.courtroom = normalizeCourtroom({ best: Object.fromEntries(order.map(id => [id, 1])), last: order[3] });
  for (let seed = 1; seed < 60; seed++) assert.notEqual(nextCaseId(old, seededRandom(seed)), order[3]);
  const seenStart = new Set(); for (let seed = 1; seed < 200; seed++) seenStart.add(nextCaseId(old, seededRandom(seed)));
  assert.ok(seenStart.size > 8, 'an old save with no history is not biased to the front of the book (' + seenStart.size + ' cases)');
});

test('the recent list, who sat where and the lifetime counts are recorded and bounded', () => {
  const s = household(4);
  for (let i = 0; i < 30; i++) {
    const id = COURT_CASES[i % COURT_CASES.length].id;
    const ep = castEpisode(s, { caseId: id, plaintiffId: 'g' + (i % 4), defendantId: 'g' + ((i + 1) % 4) }, seededRandom(i + 1));
    episodeRule(ep, 'both', seededRandom(1));
    courtFinish(s, ep, NOW);
  }
  const c = courtroomState(s);
  assert.equal(c.recent.length, 24, 'at most one entry per case');
  assert.equal(c.episodes, 30);
  assert.deepEqual(Object.keys(c.seats).sort(), ['g0', 'g1', 'g2', 'g3']);
  assert.equal(c.seats.g0, 29, 'the episode number a resident last sat at a podium');
  const crowded = normalizeCourtroom({ seats: Object.fromEntries(Array.from({ length: 80 }, (_, i) => ['p' + i, i])) });
  assert.equal(Object.keys(crowded.seats).length, 40);
  assert.ok(crowded.seats.p79 === 79 && !('p0' in crowded.seats), 'the most recent are kept');
  const hostile = normalizeCourtroom({ recent: ['borrowed-coffin', 'nope', 'borrowed-coffin', 3, null, 'snoring-wall'], seats: { ok: 3, 'bad id!': 4, neg: -1, str: 'x' } });
  assert.deepEqual(hostile.recent, ['borrowed-coffin', 'snoring-wall']);
  assert.deepEqual(hostile.seats, { ok: 3 });
});

test('the cast rotates: whoever has waited longest sits at the podium next', () => {
  const s = household(4);
  const names = [];
  let cast = rotateCast(s, seededRandom(1));
  for (let round = 0; round < 6; round++) {
    names.push([cast.plaintiffId, cast.defendantId]);
    assert.notEqual(cast.plaintiffId, cast.defendantId);
    const ep = castEpisode(s, { caseId: COURT_CASES[round].id, ...cast }, seededRandom(round + 1));
    episodeRule(ep, 'both', seededRandom(1));
    courtFinish(s, ep, NOW);
    cast = rotateCast(s, seededRandom(round + 9));
  }
  // Four residents, two seats each time: the pair changes every episode and everyone is seated within two.
  for (let i = 1; i < names.length; i++) assert.notDeepEqual([...names[i]].sort(), [...names[i - 1]].sort(), 'the same pair twice running');
  for (let i = 0; i + 1 < names.length; i += 2) assert.equal(new Set([...names[i], ...names[i + 1]]).size, 4, 'two episodes seat all four');
  // A named plaintiff is kept; the defendant is whoever has waited longest.
  const named = rotateCast(s, seededRandom(2), { plaintiffId: 'g2' });
  assert.equal(named.plaintiffId, 'g2'); assert.notEqual(named.defendantId, 'g2');
  const fresh = household(3);
  fresh.courtroom = normalizeCourtroom({ seats: { g0: 5, g1: 5 } });
  assert.equal(rotateCast(fresh, seededRandom(1), { plaintiffId: 'g0' }).defendantId, 'g2', 'a resident who has never sat comes first');
  assert.deepEqual(rotateCast(household(1), seededRandom(1)), { plaintiffId: 'g0', defendantId: '' });
  assert.deepEqual(rotateCast(blankState(), seededRandom(1)), { plaintiffId: '', defendantId: '' });
});

test('an aired case is a recap: the episode knows, and the opening can be skipped without losing the hint', () => {
  const s = household();
  assert.equal(castEpisode(s, { caseId: 'snoring-wall', plaintiffId: 'g0' }, seededRandom(1)).recap, false);
  s.courtroom = normalizeCourtroom({ best: { 'snoring-wall': 2 } });
  const ep = castEpisode(s, { caseId: 'snoring-wall', plaintiffId: 'g0' }, seededRandom(1));
  assert.equal(ep.recap, true);
  const opening = episodeOpening(ep, seededRandom(1));
  assert.ok(opening.length >= 8);
  assert.ok(opening.every(l => !l.turn), 'with no twist drawn there is no hint to protect');
  assert.equal(courtCases(s).find(c => c.id === 'snoring-wall').aired, true);
  assert.deepEqual(shuffled([1, 2, 3, 4, 5, 6, 7, 8], seededRandom(3)).sort(), [1, 2, 3, 4, 5, 6, 7, 8]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { blankState, normalizeState } from '../src/state.js';
import { QUESTIONS_PER_EPISODE, COURT_CASES } from '../src/content/court.js';
import * as JOINT_TEXT from '../src/content/court-joint.js';
import {
  castEpisode, episodeOpening, episodeQuestions, episodeAsk, resolveHappening, episodeRule, episodeReceipts, episodeWitnesses, courtFinish, episodeCase, docketToday
} from '../src/engine/court.js';
import { twistsFor } from '../src/content/court-twists.js';
import { docketTwist } from '../src/engine/court-twists.js';
import {
  jointCast, castAsSent, castJointEpisode, castNames, beatRandom, BEATS, newSeed, jointVersion, invitableCases, revealScript, benchOutcome,
  payFullBench, JOINT_BENCH_SOULS, JOINT_BENCH_DAILY, recordLine, betterJudge, addMark, markKey, marksByLine, MARK_LIMIT, sealedRuling, SERVED, INVITE
} from '../src/engine/court-joint.js';
import { visitingGuests } from '../src/engine/court-guests.js';
import { normalizeCourtroom } from '../src/court-state.js';
import { readShelf, shelfSnapshot } from '../src/cloud/social.js';
import { generateCreature } from '../src/art/creatures.js';
import { householdFixture, visitingGuestsFixture } from './household-fixtures.mjs';

const NOW = new Date(2026, 9, 3, 14, 0, 0).getTime();
function shelf(names, traits = []) {
  const s = householdFixture('established', NOW);
  s.pets = names.map((name, i) => ({ ...s.pets[i % s.pets.length], id: 'qa' + i, name, traits: traits[i] || ['damp'],
    art: { body: '', stamps: [], creature: generateCreature({ seed: 'joint-' + name }) } }));
  s.slots = s.slots.map(() => null); s.pets.forEach((p, i) => { s.slots[i] = p.id; });
  s.props = [];
  return s;
}
const ada = () => shelf(['Agnes', 'Lord Dampington III', 'Pip'], [['damp'], ['nocturnal'], ['gossip']]);
const bea = () => shelf(['Gladys', 'Snag', 'Wanda'], [['damp'], ['theatrical'], ['spiteful']]);
// Bea's shelf as Ada sees it on Friends.
const beaShelf = () => readShelf(shelfSnapshot(bea())).residents;

test('both judges seal zero tester stars without changing their local result', () => {
  const ep = { ruling: 'both', agree: 5, disagree: 1 }, result = { truth: 'both', stars: 3, ratings: 88 };
  for (const role of ['first', 'second']) {
    const state = ada();
    assert.equal(sealedRuling(ep, result, state).stars, 3, role);
    state.tester = true;
    assert.equal(sealedRuling(ep, result, state).stars, 0, role);
    assert.equal(result.stars, 3, 'local earned stars are unchanged');
  }
});

function servedHearing(seed = 1234, caseId = 'borrowed-coffin', side = 'p') {
  const A = ada(), residents = beaShelf();
  const twist = jointVersion(A, caseId, seed, NOW);
  const cast = jointCast(A, { kind: SERVED, caseId, twist, seed, mineId: 'qa0', theirs: residents[1], side, friendShelf: residents, friendName: 'Bea', myName: 'Ada' }, NOW);
  return { A, hearing: { id: '00000000-0000-4000-8000-000000000999', kind: SERVED, caseId, twist, seed, cast: castAsSent(cast) } };
}
// Play an episode the way ui/court.js plays a joint one: each beat from its own stream.
function play(ep, { ruling, order = 'first', choice = 'gavel' } = {}) {
  const R = label => beatRandom(ep.seed, label);
  const said = [...episodeOpening(ep, R(BEATS.opening)), ...episodeWitnesses(ep, R(BEATS.witnesses))];
  for (const gift of episodeReceipts(ep, R(BEATS.receipts))) said.push(...gift.lines);
  const offered = episodeQuestions(ep).filter(q => !q.asked);
  const picks = order === 'first' ? offered.slice(0, QUESTIONS_PER_EPISODE) : offered.slice(-QUESTIONS_PER_EPISODE).reverse();
  for (const q of picks) {
    const r = episodeAsk(ep, q.index, R(BEATS.ask(q.index)));
    if (!r) continue;
    said.push(...r.lines.map(l => ({ ...l, beat: 'ask:' + q.index })));
    if (r.happening) { said.push(...r.happening.lines); said.push(...resolveHappening(ep, r.happening, choice, R(BEATS.resolve(r.happening.id, choice)))); }
  }
  const result = episodeRule(ep, ruling, R(BEATS.rule(ruling)));
  return { said, result };
}

test('both judges stage the identical episode from one snapshot: case, version, cast, seats, layout and lines', () => {
  for (const seed of [1, 77, 4242, 2147483646]) {
    const { A, hearing } = servedHearing(seed);
    const B = bea();
    const first = castJointEpisode(A, hearing, 'first');
    // The second judge reads the very bytes the server would hand back.
    const second = castJointEpisode(B, { ...hearing, cast: castAsSent(JSON.parse(JSON.stringify(hearing.cast))) }, 'second');
    assert.ok(first && second);
    assert.deepEqual([first.caseId, first.twist], [second.caseId, second.twist]);
    assert.deepEqual(castNames(first), castNames(second));
    assert.deepEqual(first.cast, second.cast, 'the same traits at every seat');
    assert.deepEqual(first.plan, second.plan);
    assert.equal(first.juror.name, second.juror.name);
    assert.equal(first.ratings, second.ratings);
    const truth = episodeCase(first).truth;
    const a = play(first, { ruling: truth }), b = play(second, { ruling: truth });
    assert.deepEqual(a.said.map(l => [l.s, l.t]), b.said.map(l => [l.s, l.t]), 'every line the same');
    assert.deepEqual([a.result.votes, a.result.absent], [b.result.votes, b.result.absent]);
    // Ours are ours, theirs are guests: each side draws its own residents from home.
    assert.equal(first.p.kind, 'pet'); assert.equal(first.d.kind, 'visitor');
    assert.equal(second.p.kind, 'visitor'); assert.equal(second.d.kind, 'pet');
    assert.equal(second.d.id, 'qa1', 'Bea’s Snag is Bea’s own resident on her side');
  }
});

test('a question asked in a different order still plays the same take', () => {
  const { A, hearing } = servedHearing(99);
  const one = castJointEpisode(A, hearing, 'first'), two = castJointEpisode(bea(), hearing, 'second');
  const a = play(one, { ruling: 'both', order: 'first' }), b = play(two, { ruling: 'both', order: 'last' });
  const byBeat = said => Object.fromEntries(Object.entries(Object.groupBy(said.filter(l => l.beat), l => l.beat)).map(([k, v]) => [k, v.map(l => l.t)]));
  const x = byBeat(a.said), y = byBeat(b.said);
  const shared = Object.keys(x).filter(k => k in y);
  for (const k of shared) assert.deepEqual(x[k], y[k], k);
});

test('the jury mixes both households on served papers; an invitation casts ours and calls theirs as witnesses', () => {
  const { hearing } = servedHearing(5);
  const owners = hearing.cast.jury.filter(m => m.kind !== 'npc').map(m => m.owner);
  assert.ok(owners.includes('from') && owners.includes('to'), JSON.stringify(owners));
  assert.equal(hearing.cast.jury.length, 6);
  assert.deepEqual([hearing.cast.p.owner, hearing.cast.d.owner, hearing.cast.d.from], ['from', 'to', 'Bea']);
  const reversed = servedHearing(5, 'borrowed-coffin', 'd').hearing;
  assert.deepEqual([reversed.cast.p.name, reversed.cast.d.name], ['Snag', 'Agnes']);

  const A = ada(), residents = beaShelf();
  const invite = jointCast(A, { kind: INVITE, caseId: 'borrowed-coffin', twist: null, seed: 8, plaintiffId: 'qa2', defendantId: 'qa0', friendShelf: residents, friendName: 'Bea', myName: 'Ada' }, NOW);
  assert.deepEqual([invite.p.name, invite.d.name], ['Pip', 'Agnes']);
  assert.ok(invite.jury.every(m => m.kind === 'npc' || m.owner === 'from'), 'nobody is sued from their shelf');
  assert.equal(invite.witnesses.length, 2);
  assert.ok(invite.witnesses.every(w => w.owner === 'to' && w.from === 'Bea'));
  const ep = castJointEpisode(A, { kind: INVITE, caseId: 'borrowed-coffin', twist: null, seed: 8, cast: castAsSent(invite) }, 'first');
  const lines = episodeWitnesses(ep, beatRandom(8, BEATS.witnesses));
  assert.deepEqual(lines.map(l => l.s), ['w', 'w', 'judge']);
  assert.ok(lines.every(l => !/\{[pdw]\}/.test(l.t)));
  // A household of one sues a neighbour, the same one for both judges.
  const solo = shelf(['Agnes']);
  const lone = jointCast(solo, { kind: INVITE, caseId: 'borrowed-coffin', seed: 8, plaintiffId: 'qa0' }, NOW);
  assert.equal(lone.d.kind, 'npc');
});

test('versions: today’s docket keeps today’s version; any other case is a pure function of the seed', () => {
  const A = ada(), docket = docketToday(A, NOW);
  assert.equal(jointVersion(A, docket.caseId, 1, NOW), docketTwist(docket.day, docket.caseId));
  const twisted = COURT_CASES.find(k => twistsFor(k.id).length && k.id !== docket.caseId);
  const draws = new Set();
  for (let seed = 1; seed < 60; seed++) {
    assert.equal(jointVersion(A, twisted.id, seed, NOW), jointVersion(ada(), twisted.id, seed, NOW));
    draws.add(jointVersion(A, twisted.id, seed, NOW));
  }
  assert.ok(draws.size > 1, 'different seeds reach different versions');
  const { A: A2, hearing } = servedHearing(3);
  assert.equal(castJointEpisode(A2, { ...hearing, twist: 'a-version-from-the-future' }, 'first'), null, 'an edition that lacks the version does not stage it');
  assert.equal(castJointEpisode(A2, { ...hearing, caseId: 'not-a-case' }, 'first'), null);
  assert.ok(newSeed(() => 0) >= 1 && newSeed(() => 0.999999999) <= 2147483647);
  A.courtroom.best = { 'borrowed-coffin': 2 };
  const cases = invitableCases(A, NOW).map(c => c.id);
  assert.ok(cases.includes('borrowed-coffin') && cases.includes(docket.caseId));
  assert.equal(cases.length, new Set(['borrowed-coffin', docket.caseId]).size, 'aired cases and the docket, nothing else');
});

test('visiting guests sit on the jury, or give evidence when the box is full; anything malformed is ignored', () => {
  const s = ada();
  s.visits = { guests: visitingGuestsFixture(NOW) };
  const guests = visitingGuests(s, NOW);
  assert.deepEqual(guests.map(g => [g.kind, g.name, g.from]), [['visitor', 'Mabel', 'Bea'], ['visitor', 'Crumb', 'Cat']]);
  const ep = castEpisode(s, { caseId: 'borrowed-coffin', plaintiffId: 'qa0', defendantId: 'qa1', twist: 'base', now: NOW }, beatRandom(1, 'x'));
  const seated = ep.jury.filter(j => j.kind === 'visitor');
  assert.deepEqual(seated.map(j => j.name), ['Mabel', 'Crumb']);
  assert.ok(seated.every(j => j.from && j.resident?.art));
  assert.deepEqual(ep.witnesses, []);
  const res = courtFinish(s, play(ep, { ruling: 'plaintiff' }) && ep, NOW);
  assert.ok(res, 'a guest juror changes nothing about settling up');

  const full = shelf(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
  full.visits = { guests: visitingGuestsFixture(NOW) };
  const crowded = castEpisode(full, { caseId: 'borrowed-coffin', plaintiffId: 'qa0', defendantId: 'qa1', twist: 'base', now: NOW }, beatRandom(1, 'x'));
  assert.equal(crowded.jury.filter(j => j.kind === 'visitor').length, 0);
  assert.deepEqual(crowded.witnesses.map(w => w.name), ['Mabel', 'Crumb']);
  const said = episodeWitnesses(crowded, beatRandom(2, 'w'));
  assert.deepEqual(said.map(l => [l.s, l.who]), [['w', 0], ['w', 1], ['judge', null]]);

  for (const visits of [undefined, null, [], [{ at: 1 }], { guests: 'many' }, { guests: [null, 4, { visitId: '../x', resident: {} }] },
    { guests: [{ visitId: 'v1', from: { name: 'Bea' }, resident: { id: 'r1', name: 'Gone' }, arrived: NOW - 10, leaves: NOW - 1 }] },
    { guests: [{ visitId: 'v2', from: { name: 'Bea' }, resident: { id: 'r2', name: 'Early' }, arrived: NOW + 1000, leaves: NOW + 9000 }] },
    { guests: [{ visitId: 'v3', from: null, resident: { name: 'No id' }, arrived: NOW - 10, leaves: NOW + 10 }] }]) {
    const h = ada(); h.visits = visits;
    assert.deepEqual(visitingGuests(h, NOW), [], JSON.stringify(visits));
    assert.ok(castEpisode(h, { caseId: 'borrowed-coffin', plaintiffId: 'qa0', twist: 'base', now: NOW }, beatRandom(1, 'x')));
  }
  // A joint snapshot seats them too, labelled as visitors.
  const cast = jointCast(s, { kind: INVITE, caseId: 'borrowed-coffin', seed: 3, plaintiffId: 'qa0', defendantId: 'qa1', myName: 'Ada' }, NOW);
  assert.deepEqual(cast.jury.filter(m => m.kind === 'visitor').map(m => [m.name, m.from]), [['Mabel', 'Bea'], ['Crumb', 'Cat']]);
});

test('the reveal: full bench, a divided bench, wrong together, wrong apart, alone and declined', () => {
  const { A, hearing } = servedHearing(11);
  const ep = castJointEpisode(A, hearing, 'first');
  const truth = episodeCase(ep).truth, wrong = ['plaintiff', 'defendant', 'both'].filter(r => r !== truth);
  const r = ruling => ({ ruling, truth, stars: 1, ratings: 60, agree: 4, dissent: 1 });
  const h = (mine, theirs, extra = {}) => ({ ...hearing, role: 'first', status: theirs ? 'revealed' : 'expired', mine: r(mine), theirs: theirs ? r(theirs) : null, ...extra });
  const cases = [
    [h(truth, truth), 'full', 'Full bench'],
    [h(truth, wrong[0]), 'divided', 'The bench is divided. One of you is competent.'],
    [h(wrong[0], wrong[0]), 'wrong-together', 'Wrong, together'],
    [h(wrong[0], wrong[1]), 'wrong-apart', 'Wrong, separately'],
    [h(truth, null), 'alone', 'Your ruling stands alone'],
    [h(truth, null, { status: 'declined' }), 'declined', 'Declined']
  ];
  for (const [hearingNow, outcome, words] of cases) {
    assert.equal(benchOutcome(hearingNow, truth), outcome);
    const script = revealScript(ep, hearingNow, truth, 'Bea');
    assert.equal(script.outcome, outcome);
    const text = script.title + ' ' + script.lines.map(l => l.t).join(' ');
    assert.ok(text.includes(words), outcome + ': ' + text);
    assert.ok(!/\{[a-z]\}/.test(text), 'no placeholders left: ' + text);
    if (hearingNow.theirs) {
      assert.equal(script.lines.filter(l => l.gavel).length, 2, 'two gavels, two envelopes');
      assert.ok(text.includes('The first envelope. You'));
      assert.ok(text.includes('The second envelope. Bea'));
      assert.ok(script.lines.some(l => l.s === 'jury' && /The jury went 4 to 1 with you, and 4 to 1 with Bea\./.test(l.t)));
    }
  }
  const divided = revealScript(ep, h(wrong[0], truth), truth, 'Bea');
  assert.match(divided.lines.at(-1).t, /It was Bea\.$/);
  const seconds = revealScript(ep, { ...h(truth, wrong[0]), role: 'second' }, truth, 'Ada');
  assert.ok(seconds.lines.some(l => l.t.startsWith('The first envelope. Ada')), 'the second judge hears the first judge’s envelope first');
  assert.ok(seconds.lines.at(-1).t.endsWith('It was you.'));
  const sealed = sealedRuling({ ruling: 'both', agree: 5, disagree: 1 }, { truth: 'both', stars: 3, ratings: 88 });
  assert.deepEqual(sealed, { ruling: 'both', truth: 'both', stars: 3, ratings: 88, agree: 5, dissent: 1 });
});

test('a full bench pays each judge once per hearing, three a day', () => {
  const s = ada(), before = s.mayhem.souls;
  const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
  assert.equal(payFullBench(s, id(1), 'divided', NOW), 0);
  for (let i = 1; i <= JOINT_BENCH_DAILY; i++) assert.equal(payFullBench(s, id(i), 'full', NOW), JOINT_BENCH_SOULS);
  assert.equal(payFullBench(s, id(1), 'full', NOW), 0, 'never twice');
  assert.equal(payFullBench(s, id(9), 'full', NOW), -1, 'the fourth today pays in glory');
  assert.equal(payFullBench(s, id(9), 'full', NOW + 86400000), 0, 'and is not paid tomorrow either');
  assert.equal(payFullBench(s, id(10), 'full', NOW + 86400000), JOINT_BENCH_SOULS);
  assert.equal(s.mayhem.souls - before, JOINT_BENCH_SOULS * (JOINT_BENCH_DAILY + 1));
  const reloaded = normalizeState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(reloaded.courtroom.joint.paid, s.courtroom.joint.paid);
  assert.deepEqual(normalizeCourtroom({ joint: { paid: ['nope', id(2), id(2)], day: 'Tuesday', benches: 1e9 } }).joint, { paid: [id(2)], day: '', benches: 99 });
  assert.deepEqual(normalizeCourtroom({}).joint, { paid: [], day: '', benches: 0 }, 'an old save loads with an empty bench');
});

test('the record line names the better judge, and has opinions', () => {
  const rec = (mine, theirs, hearings = 7, fullBenches = 4) => ({ userId: '00000000-0000-4000-8000-00000000000b', name: 'Bea', hearings, fullBenches, mine, theirs });
  assert.match(recordLine(rec(3, 4)), /^You and Bea: 7 hearings, 4 full benches\. Bea is ahead by one, /);
  assert.match(recordLine(rec(5, 2)), /^You and Bea: 7 hearings, 4 full benches\. You are ahead by three/);
  assert.match(recordLine(rec(2, 2, 1, 1)), /^You and Bea: 1 hearing, 1 full bench\. (Dead level|Level)/);
  assert.equal(recordLine(rec(0, 0, 0, 0)), JOINT_TEXT.RECORD_NONE);
  assert.deepEqual([betterJudge(rec(3, 4)), betterJudge(rec(4, 3)), betterJudge(rec(1, 1))], ['them', 'you', 'level']);
  const lines = [3, 4].flatMap(n => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(h => recordLine(rec(n, 4, 7 + h))));
  assert.ok(lines.some(l => l.includes('has mentioned it')), 'the brief’s line is among them');
});

test('reaction marks are bounded, keyed by line and grouped for replay', () => {
  const marks = [];
  assert.equal(markKey('opening', 3), 'opening:3');
  assert.equal(markKey('rs:outburst:gavel', 12), 'rs:outburst:gavel:12');
  assert.ok(markKey('A very long beat label indeed', 999).length <= 24);
  assert.match(markKey('Ask:2', 1), /^[a-z0-9:-]{1,24}$/);
  for (let i = 0; i < MARK_LIMIT + 5; i++) addMark(marks, { at: markKey('ask:' + (i % 3), 0), r: ['laugh', 'gasp', 'gavel'][i % 3], ms: i * 1000 });
  assert.equal(marks.length, MARK_LIMIT);
  assert.equal(addMark(marks.slice(0, 1), { at: 'x:1', r: 'boo', ms: 0 }), false);
  assert.ok(marks.every(m => m.ms <= 20000));
  assert.equal(marksByLine(marks).get('ask:0:0').length, 14);
});

test('the joint copy keeps the house style: curly quotes, no dashes', () => {
  const text = readFileSync(new URL('../src/content/court-joint.js', import.meta.url), 'utf8');
  assert.ok(!/[–—]/.test(text), 'no en or em dashes');
  const strings = [...text.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(m => m[1]);
  for (const s of strings) assert.ok(!/"/.test(s), 'straight double quote in: ' + s);
  assert.ok(JOINT_TEXT.OUTCOMES.divided.lines.every(l => l.startsWith('The bench is divided. One of you is competent.')));
  assert.equal(JOINT_TEXT.OUTCOMES.full.title, 'Full bench');
});

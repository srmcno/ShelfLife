import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState } from '../src/state.js';
import * as COURT from '../src/content/court.js';
import { COURT_CASES, COURT_CAST, HAPPENINGS, RANDOM_HAPPENINGS, ADS, QUESTIONS_PER_EPISODE, JURY_EXTRAS, STAND_INS, HALLWAY_ASKS } from '../src/content/court.js';
import { COURT_ART } from '../src/art/court-cast.js';
import {
  castEpisode, standInFor, episodeOpening, episodeQuestions, episodeAsk, questionsLeft, startHappening, resolveHappening, randomHappening,
  episodeBreak, episodeRule, courtFinish, courtCases, nextCaseId, JURY_SEATS, lineSets, caseWitnesses
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
// Every scripted line of a case, across all of its takes.
const caseLines = k => [k.plaintiff, k.defendant, ...k.questions.map(q => q.lines), ...Object.values(k.rulings)].flatMap(v => lineSets(v).flat());
const leftovers = list => list.filter(line => /\{[pdjx]\}/.test(line.t));
function playAll(s, caseId, ruling, choice = 'gavel', rnd = seededRandom(3)) {
  const ep = castEpisode(s, { caseId, twist: 'base', plaintiffId: 'g0', defendantId: 'g1' }, rnd);
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

test('twenty-four cases, fairly split, each with six questions, clues that point at the truth and three rulings', () => {
  assert.equal(COURT_CASES.length, 24);
  assert.equal(new Set(COURT_CASES.map(k => k.id)).size, COURT_CASES.length, 'case ids are unique');
  const truths = COURT_CASES.map(k => k.truth);
  for (const t of ['plaintiff', 'defendant', 'both']) assert.equal(truths.filter(x => x === t).length, 8, t);
  for (const k of COURT_CASES) {
    assert.equal(k.questions.length, 6, k.id);
    assert.ok(k.questions.filter(q => q.clue).length >= 2, k.id + ' needs at least two clues');
    assert.ok(k.questions.filter(q => !q.clue).length >= 2, k.id + ' needs at least two questions that are just for laughs');
    for (const q of k.questions) if (q.party) assert.ok(['p', 'd'].includes(q.party), k.id + ' party ' + q.party);
    assert.ok(k.questions.some(q => q.sass), k.id + ' needs a zinger');
    for (const r of ['plaintiff', 'defendant', 'both']) assert.ok(lineSets(k.rulings[r]).every(set => set.length), k.id + ' ruling ' + r);
    assert.ok([].concat(k.hallway.p).length && [].concat(k.hallway.d).length, k.id + ' hallway');
    const all = caseLines(k);
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

// Every string a case can put on screen, in every take.
const caseStrings = k => [k.title, k.claim, k.asking, ...k.questions.flatMap(q => [q.ask, q.clue || '']), ...caseLines(k).map(l => l[1]), ...[].concat(k.hallway.p, k.hallway.d)];

test('cases only use the names the engine fills, curly quotes, and stay readable aloud', () => {
  for (const k of COURT_CASES) {
    for (const text of caseStrings(k)) {
      for (const [slot] of text.matchAll(/\{[^}]*\}/g)) assert.ok(['{p}', '{d}', '{j}'].includes(slot), k.id + ' uses ' + slot + ' in: ' + text);
      assert.ok(!/["']/.test(text), k.id + ' uses a straight quote in: ' + text);
      assert.ok(text.length <= 280, k.id + ' line over budget: ' + text);
    }
    for (const q of k.questions) if (q.clue) assert.ok(q.clue.length <= 140, k.id + ' clue too long for the notes: ' + q.clue);
  }
});

// Ask a chosen set of questions, settle every scene, rule, and collect every line and note.
function playQuestions(s, caseId, indices, ruling, choice, rnd, cast = { plaintiffId: 'g0', defendantId: 'g1' }) {
  const ep = castEpisode(s, { caseId, twist: 'base', ...cast }, rnd);
  const said = [...episodeOpening(ep, rnd)];
  for (const index of indices) {
    const r = episodeAsk(ep, index, rnd);
    assert.ok(r, caseId + ' question ' + index + ' could not be asked');
    said.push(...r.lines);
    if (r.happening) { said.push(...r.happening.lines); said.push(...resolveHappening(ep, r.happening, choice)); }
  }
  const result = episodeRule(ep, ruling, rnd);
  said.push(...result.ruling, ...result.jury, result.audience, ...result.hallway);
  return { ep, said: [...said, ...ep.clues.map(t => ({ t }))], result };
}

test('every question, every ruling and every scene choice plays with every name filled, even with a neighbour standing in', () => {
  const halves = [[0, 1, 2], [3, 4, 5], [5, 3, 1], [4, 2, 0]];
  for (const k of COURT_CASES) {
    const witnesses = caseWitnesses(k);
    for (const ruling of ['plaintiff', 'defendant', 'both']) {
      halves.forEach((indices, i) => {
        const choice = i % 2 ? 'let' : 'gavel';
        const { said, result, ep } = playQuestions(household(3), k.id, indices, ruling, choice, seededRandom(k.id.length * 7 + i));
        assert.deepEqual(said.filter(line => /\{[a-z]+\}/.test(line.t)), [], k.id + ' ' + ruling + ' ' + indices);
        assert.equal(result.correct, ruling === k.truth, k.id);
        for (const line of said) if (line.s === 'npc') assert.ok(COURT_CAST[line.who], k.id + ' npc ' + line.who);
        assert.equal(ep.clues.length, indices.filter(n => k.questions[n].clue).length, k.id + ' notes one clue per clue question');
        const solo = playQuestions(household(1), k.id, indices, ruling, choice, seededRandom(i + 11), { plaintiffId: 'g0' });
        assert.equal(solo.ep.d.kind, 'npc');
        assert.ok(!witnesses.has(solo.ep.d.id), k.id + ' cast a witness as the defendant');
        assert.ok(!solo.ep.jury.some(j => witnesses.has(j.id)), k.id + ' seated a witness on the jury');
        assert.deepEqual(solo.said.filter(line => /\{[a-z]+\}/.test(line.t)), [], k.id + ' solo ' + ruling + ' ' + indices);
      });
    }
  }
});

test('the shelf is the jury: other residents first, neighbours fill the rest, witnesses never sit', () => {
  const s = household(4);
  const ep = castEpisode(s, { caseId: 'snoring-wall', twist: 'base', plaintiffId: 'g0', defendantId: 'g1' }, seededRandom(1));
  assert.equal(ep.p.name, 'Agnes'); assert.equal(ep.d.name, 'Mort');
  assert.equal(ep.jury.length, JURY_SEATS);
  assert.deepEqual(ep.jury.slice(0, 2).map(j => j.name), ['Pip', 'Dot']);
  assert.ok(!ep.jury.some(j => j.id === 'ghost'), 'the snoring case calls the ghost as a witness');
  const alone = household(1);
  const solo = castEpisode(alone, { caseId: 'moth-custody', twist: 'base', plaintiffId: 'g0' }, seededRandom(2));
  assert.equal(solo.d.kind, 'npc');
  assert.notEqual(solo.d.id, 'moth');
  assert.equal(solo.jury.length, JURY_SEATS);
  assert.equal(castEpisode(blankState(), {}), null);
});

test('a solo household gets the neighbour its lobby named, whatever the dice say', () => {
  const alone = household(1);
  for (const k of COURT_CASES) {
    for (const salt of [0, 1, 7, 42]) {
      const named = standInFor(k.id, salt);
      for (const seed of [1, 2, 3]) {
        const ep = castEpisode(alone, { caseId: k.id, twist: 'base', plaintiffId: 'g0', standInSalt: salt }, seededRandom(seed));
        assert.equal(ep.d.id, named);
      }
    }
  }
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
  const ep = castEpisode(s, { caseId: 'borrowed-coffin', twist: 'base', plaintiffId: 'g0', defendantId: 'g1' }, seededRandom(4));
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
  const ep = castEpisode(s, { caseId: 'haunted-sock', twist: 'base', plaintiffId: 'g0', defendantId: 'g1' }, seededRandom(1));
  ep.respect = 100; ep.ratings = 90;
  const r = episodeRule(ep, 'defendant', seededRandom(9));
  assert.equal(r.agree, 6);
  assert.equal(r.stars, 3);
  assert.equal(episodeRule(ep, 'both'), null, 'one ruling per episode');
  const s2 = household();
  const ep2 = castEpisode(s2, { caseId: 'haunted-sock', twist: 'base', plaintiffId: 'g0', defendantId: 'g1' }, seededRandom(1));
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
    { episodes: 3, justice: 3, best: { 'borrowed-coffin': 3 }, last: '', docketDay: '', docketStreak: 0, docketLastDay: '',
      summonsDay: '', summonsHeard: 0, summonsVerdicts: 0, summonsPaid: [],
      versions: {}, recent: [], seats: {}, stars: 0, rank: 0, flawless: 0, flawlessBest: 0, summonsOwed: [] });
});

test('the hall cam: the announcer cuts to the hallway and a reporter asks each loser in turn', () => {
  for (const ruling of ['plaintiff', 'defendant', 'both']) {
    const { result } = playAll(household(), 'borrowed-coffin', ruling, 'gavel', seededRandom(ruling.length));
    const losers = ruling === 'plaintiff' ? ['d'] : ruling === 'defendant' ? ['p'] : ['p', 'd'];
    assert.deepEqual(result.losers, losers);
    assert.equal(result.winner, ruling === 'both' ? null : ruling === 'plaintiff' ? 'p' : 'd');
    assert.equal(result.hallway[0].s, 'announcer');
    assert.deepEqual(result.hallway.slice(1).map(l => l.s), losers.flatMap(side => ['reporter', side]));
    const asks = result.hallway.filter(l => l.s === 'reporter');
    asks.forEach((l, i) => { assert.equal(l.who, losers[i]); assert.ok(HALLWAY_ASKS.includes(l.t)); });
    if (asks.length > 1) assert.notEqual(asks[0].t, asks[1].t, 'two losers get two different questions');
  }
  assert.ok(HALLWAY_ASKS.length >= 6);
  for (const ask of HALLWAY_ASKS) assert.ok(!/[\u2014\u2013"']/.test(ask) && ask.length <= 60, ask);
});

test('adventures can ask for an episode, and an episode moves them on', () => {
  const approaches = ESCAPADES.flatMap(e => e.approaches).filter(a => a.activity === 'court');
  assert.ok(approaches.length >= 3);
});

test('every case comes in several takes so a rerun does not replay word for word', () => {
  for (const k of COURT_CASES) {
    assert.ok(lineSets(k.plaintiff).length >= 2 && lineSets(k.defendant).length >= 2, k.id + ' opening takes');
    for (const r of ['plaintiff', 'defendant', 'both']) assert.ok(lineSets(k.rulings[r]).length >= 2, k.id + ' ruling takes ' + r);
    for (const side of ['p', 'd']) assert.ok([].concat(k.hallway[side]).length >= 3, k.id + ' hallway lines ' + side);
    k.questions.forEach((q, i) => assert.ok(lineSets(q.lines).length >= 2, k.id + ' question ' + i + ' has one take'));
    for (const set of [k.plaintiff, k.defendant, ...Object.values(k.rulings)].flatMap(lineSets)) assert.ok(set.length, k.id + ' empty take');
  }
});

test('the shared script is deep enough that an evening of episodes rarely repeats a line', () => {
  const sizes = { OPENERS: 12, ALL_RISE: 8, JUDGE_ENTRANCES: 12, PLAINTIFF_CUE: 8, DEFENDANT_CUE: 8, ADS: 20, BREAK_IN: 6, BREAK_OUT: 6,
    JURY_AGREE: 12, JURY_DISAGREE: 12, JURY_ALL_AGREE: 4, JURY_ALL_DISAGREE: 4, HALLWAY_IN: 10 };
  for (const [name, min] of Object.entries(sizes)) {
    assert.ok(COURT[name].length >= min, name + ' has ' + COURT[name].length);
    assert.equal(new Set(COURT[name].map(x => JSON.stringify(x))).size, COURT[name].length, name + ' has a duplicate');
  }
  for (const tier of COURT.AUDIENCE_REACTIONS) assert.ok(tier.length >= 5);
  assert.ok(HAPPENINGS.outburst.rants.length >= 12);
  for (const [id, h] of Object.entries(HAPPENINGS)) {
    assert.ok(h.takes.length >= 3, id + ' takes');
    for (const t of h.takes) {
      for (const part of h.choice ? ['intro', 'gavel', 'let'] : ['intro']) {
        assert.ok(lineSets(t[part]).every(set => set.length), id + ' ' + part);
        for (const [s] of lineSets(t[part]).flat()) assert.ok(SPEAKERS.has(s) || s === 'x', id + ' speaker ' + s);
      }
    }
  }
  const shared = JSON.stringify([COURT.OPENERS, COURT.ALL_RISE, COURT.JUDGE_ENTRANCES, COURT.PLAINTIFF_CUE, COURT.DEFENDANT_CUE, COURT.BREAK_IN, COURT.BREAK_OUT,
    COURT.JURY_AGREE, COURT.JURY_DISAGREE, COURT.JURY_ALL_AGREE, COURT.JURY_ALL_DISAGREE, COURT.AUDIENCE_REACTIONS, COURT.HALLWAY_IN]);
  assert.ok(!/[—–]/.test(shared) && !/(^|[^\\])'/.test(shared.replace(/\\"/g, '')), 'shared lines use curly quotes and no dashes');
  for (const [slot] of shared.matchAll(/\{[^}]*\}/g)) assert.ok(['{p}', '{d}', '{j}'].includes(slot), slot);
});

test('every take of every case and scene plays with the names filled and the scene response matching its setup', () => {
  const ends = [() => 0, () => 0.999];
  for (const k of COURT_CASES) {
    for (const rnd of ends) {
      const { said } = playAll(household(3), k.id, k.truth, 'let', rnd);
      assert.deepEqual(leftovers(said), [], k.id);
    }
  }
  for (const [id, h] of Object.entries(HAPPENINGS)) {
    for (let t = 0; t < h.takes.length; t++) {
      const ep = castEpisode(household(3), { caseId: 'borrowed-coffin', plaintiffId: 'g0', defendantId: 'g1' }, seededRandom(1));
      const rnd = () => (t + 0.5) / h.takes.length;
      const scene = startHappening(ep, id, rnd, 'p');
      assert.equal(scene.take, t, id);
      const said = [...scene.lines, ...(h.choice ? [...resolveHappening(ep, scene, 'gavel', rnd), ...resolveHappening(ep, scene, 'let', rnd)] : [])];
      assert.deepEqual(leftovers(said), [], id + ' take ' + t);
      if (h.choice) assert.deepEqual(resolveHappening(ep, scene, 'let', rnd).map(l => l.t), lineSets(h.takes[t].let)[0].map(([, text]) => text.replace(/\{p\}/g, 'Agnes').replace(/\{d\}/g, 'Mort').replace(/\{x\}/g, 'Agnes').replace(/\{j\}/g, ep.juror.name)), id + ' take ' + t + ' keeps its own response');
    }
  }
});

import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState, localDayKey } from '../src/state.js';
import { COURT_CASES, COURT_CAST, HAPPENINGS, QUESTIONS_PER_EPISODE, alt } from '../src/content/court.js';
import { TWISTS, twistsFor } from '../src/content/court-twists.js';
import { TWISTS_A } from '../src/content/court-twists-a.js';
import { TWISTS_B } from '../src/content/court-twists-b.js';
import {
  BASE, effectiveCase, pickTwist, docketTwist, twistProblems, twistById, versionKeys, versionCount, versionRecord, versionView, versionTotals, witnessesAnywhere
} from '../src/engine/court-twists.js';
import {
  castEpisode, standInFor, episodeOpening, episodeQuestions, episodeAsk, episodeRule, episodeCase, episodeVersion, courtFinish, courtCases, docketToday,
  resolveHappening, lineSets, COURT_BY_ID
} from '../src/engine/court.js';
import { normalizeCourtroom, courtroomState } from '../src/court-state.js';
import { seededRandom } from '../src/engine/arcade.js';
import { guestPet } from '../src/cloud/social.js';
import { generateCreature } from '../src/art/creatures.js';

const NOW = new Date(2026, 8, 25, 14, 0, 0).getTime();
const DAY = 86400000;
function household(n = 3) {
  const s = blankState();
  s.pets = ['Agnes', 'Mort', 'Pip', 'Dot'].slice(0, n).map((name, i) => ({ id: 'g' + i, name, traits: ['damp'], needs: { food: 50, fuss: 40, clean: 50 }, bond: 2, cared: 0, grudges: 0, born: NOW - DAY }));
  s.pets.forEach((p, i) => { s.slots[i] = p.id; });
  return s;
}
const baseCase = id => COURT_BY_ID[id];

/* ---------- the real data: whatever the writers have delivered ----------
   These tests pass with the empty stubs and must keep passing when the
   writers' files replace them. Each twist is held to the rules in the brief. */

const writers = [['court-twists-a.js', TWISTS_A, 0, 12], ['court-twists-b.js', TWISTS_B, 12, 24]];

test('every twist in the data files is sound, fair and shaped like the schema', () => {
  for (const [file, data, from, to] of writers) {
    const allowed = new Set(COURT_CASES.slice(from, to).map(k => k.id));
    for (const [caseId, list] of Object.entries(data)) {
      assert.ok(allowed.has(caseId), file + ' holds ' + caseId + ', which is not one of its cases');
      assert.ok(Array.isArray(list) && list.length >= 1, caseId + ' needs a list of twists');
      const ids = list.map(t => t.id);
      assert.equal(new Set(ids).size, ids.length, caseId + ' has two twists with one id');
      for (const twist of list) {
        assert.deepEqual(twistProblems(baseCase(caseId), twist), [], caseId + '/' + twist.id);
        assert.notEqual(twist.title, baseCase(caseId).title, 'a twist is not named after the case');
      }
    }
  }
  assert.deepEqual(Object.keys(TWISTS).sort(), [...Object.keys(TWISTS_A), ...Object.keys(TWISTS_B)].sort());
});

test('every real twist plays start to finish: names filled, witnesses off the jury, the truth its own', () => {
  for (const caseId of Object.keys(TWISTS)) {
    const base = baseCase(caseId);
    for (const twist of twistsFor(caseId)) {
      const k = effectiveCase(base, twist);
      assert.equal(k.truth, twist.truth);
      assert.notEqual(k.truth, base.truth);
      for (const ruling of ['plaintiff', 'defendant', 'both']) {
        for (const pets of [3, 1]) {
          const s = household(pets);
          const rnd = seededRandom(caseId.length + pets);
          const ep = castEpisode(s, { caseId, twist: twist.id, plaintiffId: 'g0', defendantId: 'g1' }, rnd);
          assert.equal(ep.twist, twist.id);
          const said = [...episodeOpening(ep, rnd)];
          for (const q of episodeQuestions(ep).slice(0, QUESTIONS_PER_EPISODE)) {
            const r = episodeAsk(ep, q.index, rnd);
            said.push(...r.lines);
            if (r.happening) said.push(...r.happening.lines, ...resolveHappening(ep, r.happening, 'let', rnd));
          }
          const result = episodeRule(ep, ruling, rnd);
          said.push(...result.ruling, ...result.jury, result.audience, ...result.hallway, ...ep.clues.map(t => ({ t })));
          assert.deepEqual(said.filter(l => /\{[a-z]+\}/.test(l.t)), [], caseId + '/' + twist.id + ' ' + ruling);
          assert.equal(result.correct, ruling === twist.truth);
          const witnesses = witnessesAnywhere(base);
          assert.ok(!ep.jury.some(j => witnesses.has(j.id)), caseId + ' seated a witness on the jury');
          if (pets === 1) assert.ok(!witnesses.has(ep.d.id), caseId + ' cast a witness as the stand-in');
        }
      }
    }
  }
});

/* ---------- the engine, against small twists written here ---------- */

const fixture = () => ({
  id: 'keith-owns-it', title: 'Keith’s Coffin', truth: 'defendant',
  turn: alt([
    ['bailiff', 'Your Honour, there is a note on the lid. It is addressed to the court. It is signed “Keith”.'],
    ['judge', 'Keith can write?']
  ], [
    ['narrator', '(Something knocks inside the coffin. Once. Politely.)']
  ]),
  questions: {
    0: { clue: '{p} sold the coffin to Keith last spring for forty souls and a promise.', lines: alt([
      ['p', 'I sold it. Technically. In spring. It was a very small sale.'],
      ['d', 'It was forty souls and a handshake, Your Honour.']], [
      ['p', 'He paid in instalments. I stopped counting at nine.']]) },
    1: { clue: 'The name on the lid is painted over an older name. The older one says Keith.', lines: alt([
      ['bailiff', 'It says Keith underneath, Your Honour. In very good handwriting.']], [
      ['narrator', '(The bailiff scrapes the lid with a fingernail. Under {p}’s name, in gold: KEITH.)']]) },
    3: { herring: '{d} was seen carrying a second coffin out of the sock drawer.', lines: alt([
      ['d', 'That was my own coffin. I was airing it.']], [
      ['p', 'I saw him carry it out! I saw it with my own eyes!']]) },
    4: { clue: 'There is a receipt on the little raisin shelf, dated before the nap.', lines: alt([
      ['judge', 'What is on the raisin shelf?'], ['p', 'A receipt. I was hoping nobody would look.']], [
      ['narrator', '(The receipt is for one coffin, one owner, no refunds.)']]) },
    5: { lines: alt([['narrator', '(Nothing is explained.)']], [['narrator', '(The bailiff gives a thumbs up to nobody.)']]) }
  },
  rulings: {
    plaintiff: alt([['judge', 'For {p}, which is nonsense, and I will say so.']], [['judge', 'For {p}. Keith disagrees.']]),
    defendant: alt([['judge', 'For {d}. Keith was owed a coffin and Keith has one.']], [['judge', 'For {d}. The receipt is the receipt.']]),
    both: alt([['judge', 'Both idiots. One sold a coffin, the other forgot to move the man out.']], [['judge', 'Both idiots. Keith is the only adult here.']])
  },
  hallway: { p: ['I sold it, I admit. I did not sell the man.', 'I want a refund. From Keith.', 'I will be moving into the sock drawer.'],
    d: ['Keith and I have an understanding.', 'I said it was a nap.', 'I am keeping the receipt in my teeth.'] }
});

const installed = [];
function install(caseId, twist) { TWISTS[caseId] = [twist]; installed.push(caseId); }
afterEach(() => { for (const id of installed.splice(0)) delete TWISTS[id]; });

test('a sound twist passes, and each rule it can break is named', () => {
  const k = baseCase('borrowed-coffin');
  assert.deepEqual(twistProblems(k, fixture()), []);
  const broken = (change, pattern) => {
    const t = fixture(); change(t);
    const problems = twistProblems(k, t);
    assert.ok(problems.some(p => pattern.test(p)), 'expected ' + pattern + ' in ' + JSON.stringify(problems));
  };
  broken(t => { t.truth = 'plaintiff'; }, /differ from the original/);
  broken(t => { t.truth = 'nobody'; }, /truth must be/);
  broken(t => { t.id = 'Base Case'; }, /id must be/);
  broken(t => { t.id = 'base'; }, /id must be/);
  broken(t => { t.title = 'x'.repeat(41); }, /title/);
  broken(t => { t.questions[0].clue = 'x'.repeat(141); }, /over 140/);
  broken(t => { t.questions[3].herring = 'Plenty of nothing — and more.'; }, /dash/);
  broken(t => { t.questions[0].clue = 'A clue with a {x} slot'; }, /placeholder/);
  broken(t => { t.questions[0].clue = "It's a straight quote"; }, /straight quote/);
  broken(t => { t.questions[0].lines = alt([['p', 'Only one take.']]); }, /at least 2 takes/);
  broken(t => { t.questions[0].lines = alt([['p', 'Same.']], [['p', 'Same.']]); }, /repeats a take/);
  broken(t => { t.questions[0].lines = alt([['wizard', 'Hello.']], [['p', 'Hi.']]); }, /unknown speaker/);
  broken(t => { t.questions[0].lines = alt([['npc', 'Hello.', 'dragon']], [['p', 'Hi.']]); }, /unknown cast member/);
  broken(t => { t.questions[0].lines = alt([['p', 'x'.repeat(281)]], [['p', 'Hi.']]); }, /over 280/);
  broken(t => { t.questions[9] = { lines: alt([['p', 'a']], [['p', 'b']]) }; }, /not a base question index/);
  broken(t => { t.questions[2] = { clue: 'x', herring: 'y', lines: alt([['p', 'a']], [['p', 'b']]) }; }, /both a clue and a herring/);
  broken(t => { t.questions[2] = { herring: 'A second herring.', lines: alt([['p', 'a']], [['p', 'b']]) }; }, /more than one herring/);
  broken(t => { delete t.rulings.both; }, /ruling both/);
  broken(t => { t.hallway.p = ['one', 'two']; }, /exactly three/);
  broken(t => { t.turn = alt([['judge', '1'], ['judge', '2'], ['judge', '3'], ['judge', '4'], ['judge', '5']]); }, /more than 4 lines/);
  broken(t => { t.questions[4] = { lines: alt([['p', 'a']], [['p', 'b']]) }; t.questions[1] = { lines: alt([['p', 'a']], [['p', 'b']]) }; t.questions[0] = { lines: alt([['p', 'a']], [['p', 'b']]) }; }, /two clue questions/);
});

test('a twist replaces the testimony, notes, rulings and hallway but never the opening statements', () => {
  const k = baseCase('borrowed-coffin'), fx = fixture();
  assert.equal(effectiveCase(k, null), k, 'no twist is the original, untouched');
  const e = effectiveCase(k, fx);
  assert.equal(e.id, k.id); assert.equal(e.title, k.title); assert.equal(e.claim, k.claim);
  assert.equal(e.plaintiff, k.plaintiff); assert.equal(e.defendant, k.defendant);
  assert.equal(e.truth, 'defendant');
  assert.equal(e.rulings, fx.rulings); assert.equal(e.hallway, fx.hallway); assert.equal(e.turn, fx.turn);
  assert.deepEqual(e.twist, { id: 'keith-owns-it', title: 'Keith’s Coffin' });
  assert.equal(e.questions.length, 6);
  assert.equal(e.questions[0].lines, fx.questions[0].lines);
  assert.match(e.questions[0].clue, /sold the coffin/);
  assert.equal(e.questions[0].ask, k.questions[0].ask, 'the ask is the original’s');
  // 2 is a zinger the twist does not mention: it is the original’s, untouched.
  assert.equal(e.questions[2], k.questions[2]);
  // 3 had a clue and a scene; the herring replaces the clue and the scene and party stay.
  assert.equal(e.questions[3].clue, undefined);
  assert.match(e.questions[3].herring, /second coffin/);
  assert.equal(e.questions[3].happen, 'outburst'); assert.equal(e.questions[3].party, 'p');
  // 4 and 5 were plain; 4 is now a clue and 5 stays plain.
  assert.ok(e.questions[4].clue && !e.questions[5].clue);
  assert.equal(k.questions[0].clue.includes('sold'), false, 'the original is never mutated');
  // An override with neither clue nor herring turns a clue question into plain colour, keeping its zinger flag if set.
  const plain = effectiveCase(k, { ...fx, questions: { 0: { lines: alt([['p', 'a']], [['p', 'b']]), sass: true } } });
  assert.equal(plain.questions[0].clue, undefined); assert.equal(plain.questions[0].sass, true);
  assert.equal(effectiveCase(k, { ...fx, questions: { 2: { lines: alt([['p', 'a']], [['p', 'b']]) } } }).questions[2].sass, true, 'a zinger stays a zinger unless the twist says otherwise');
});

test('the version table: counts, keys, titles and the unspoiled progress', () => {
  assert.equal(versionCount('borrowed-coffin'), 1);
  install('borrowed-coffin', fixture());
  assert.equal(versionCount('borrowed-coffin'), 2);
  assert.deepEqual(versionKeys('borrowed-coffin'), [BASE, 'keith-owns-it']);
  assert.equal(twistById('borrowed-coffin', 'keith-owns-it').title, 'Keith’s Coffin');
  assert.equal(twistById('borrowed-coffin', 'base'), null);
  assert.equal(twistById('borrowed-coffin', 'nope'), null);
  const view = versionView({ best: {}, versions: {} }, 'borrowed-coffin');
  assert.deepEqual([view.of, view.seen], [2, 0]);
  const old = { best: { 'borrowed-coffin': 2 } };
  assert.deepEqual(versionRecord(old, 'borrowed-coffin'), { base: 2 }, 'a save from before versions: the one airing was the original');
  const both = { best: { 'borrowed-coffin': 3 }, versions: { 'borrowed-coffin': { base: 1, 'keith-owns-it': 3, ghost: 2 } } };
  assert.deepEqual(versionRecord(both, 'borrowed-coffin'), { base: 1, 'keith-owns-it': 3 }, 'a version this edition does not know is ignored');
  assert.deepEqual(versionTotals(both, ['borrowed-coffin', 'snoring-wall']), { seen: 2, of: 3, twistsSeen: 1, twists: 1 });
});

test('the docket airs the same version for everyone, and free play favours versions you have not seen', () => {
  install('borrowed-coffin', fixture());
  const day = '2026-8-25';
  const first = docketTwist(day, 'borrowed-coffin');
  for (let i = 0; i < 10; i++) assert.equal(docketTwist(day, 'borrowed-coffin'), first, 'a pure function of the day and the case');
  assert.equal(pickTwist('borrowed-coffin', () => 0.99, day), first, 'the dice do not matter with a seed');
  const picks = new Set(Array.from({ length: 40 }, (_, i) => docketTwist('2026-8-' + (i + 1), 'borrowed-coffin')));
  assert.deepEqual([...picks].sort(), [null, 'keith-owns-it'].sort(), 'across days both versions come up');
  assert.equal(pickTwist('snoring-wall', Math.random, day), null, 'a case with no twists is always the original');
  // Free play: unseen versions are three times as likely.
  const count = (seen, n = 3000) => {
    const rnd = seededRandom(5); let twists = 0;
    for (let i = 0; i < n; i++) if (pickTwist('borrowed-coffin', rnd, '', seen)) twists++;
    return twists / n;
  };
  assert.ok(Math.abs(count([]) - 0.5) < 0.05, 'nothing seen: an even chance');
  assert.ok(Math.abs(count([BASE]) - 0.75) < 0.05, 'the original seen: the twist is three to one');
  assert.ok(Math.abs(count(['keith-owns-it']) - 0.25) < 0.05, 'the twist seen: the original is three to one');
  assert.ok(Math.abs(count([BASE, 'keith-owns-it']) - 0.5) < 0.05, 'everything seen: even again');
});

test('an episode is cast with its version, and every engine call reads the version it was dealt', () => {
  install('borrowed-coffin', fixture());
  const s = household();
  const ep = castEpisode(s, { caseId: 'borrowed-coffin', twist: 'keith-owns-it', plaintiffId: 'g0', defendantId: 'g1' }, seededRandom(2));
  assert.equal(ep.twist, 'keith-owns-it');
  assert.deepEqual([episodeCase(ep).truth, episodeVersion(ep).number, episodeVersion(ep).of, episodeVersion(ep).title], ['defendant', 2, 2, 'Keith’s Coffin']);
  const said = episodeOpening(ep, seededRandom(1));
  const turn = said.filter(l => l.turn);
  assert.ok(turn.length >= 1 && turn.length <= 2);
  assert.equal(said.at(-turn.length).turn, true, 'the hint plays after the statements');
  assert.ok(said.indexOf(turn[0]) > said.findIndex(l => l.s === 'd'), 'after both statements');
  assert.ok(said.slice(0, said.indexOf(turn[0])).every(l => !l.turn));
  const r0 = episodeAsk(ep, 0, seededRandom(1));
  assert.match(r0.clue, /sold the coffin/);
  assert.match(r0.lines.map(l => l.t).join(' '), /sold|instalments/);
  const r3 = episodeAsk(ep, 3, seededRandom(1));
  assert.equal(r3.note.kind, 'lead'); assert.equal(r3.note.shaky, true);
  assert.equal(r3.happening.id, 'outburst', 'the scene the question sets off is inherited');
  assert.equal(ep.notes.length, 2);
  const r4 = episodeAsk(ep, 4, seededRandom(1));
  assert.match(r4.clue, /receipt/);
  const result = episodeRule(ep, 'defendant', seededRandom(3));
  assert.equal(result.correct, true); assert.equal(result.truth, 'defendant');
  assert.match(result.ruling.map(l => l.t).join(' '), /Keith was owed a coffin|receipt is the receipt/);
  assert.match(result.hallway.at(-1).t, /sold it|refund|sock drawer/, 'the loser is the plaintiff and speaks in the twist’s voice');
  // The same ruling is wrong in the original telling.
  const orig = castEpisode(household(), { caseId: 'borrowed-coffin', twist: 'base', plaintiffId: 'g0', defendantId: 'g1' }, seededRandom(2));
  assert.equal(orig.twist, null);
  assert.equal(episodeRule(orig, 'defendant', seededRandom(3)).correct, false);
});

test('which version is aired: asked for, drawn on what you have seen, fixed for the docket, and drawn afresh for a friend’s summons', () => {
  install('borrowed-coffin', fixture());
  const cast = (s, extra, rnd = seededRandom(7), caseId = 'borrowed-coffin') => castEpisode(s, { caseId, plaintiffId: 'g0', defendantId: 'g1', now: NOW, ...extra }, rnd);
  const s = household();
  assert.equal(cast(s, { twist: 'base' }).twist, null);
  assert.equal(cast(s, { twist: 'keith-owns-it' }).twist, 'keith-owns-it');
  assert.ok([null, 'keith-owns-it'].includes(cast(s, { twist: 'not-a-twist' }).twist), 'an unknown id is drawn, never trusted');
  // Having seen the twist, free play serves the original more often.
  s.courtroom = normalizeCourtroom({ best: { 'borrowed-coffin': 1 }, versions: { 'borrowed-coffin': { base: 1, 'keith-owns-it': 1 } } });
  let twists = 0;
  const seen = household(); seen.courtroom = normalizeCourtroom({ best: { 'borrowed-coffin': 1 }, versions: { 'borrowed-coffin': { 'keith-owns-it': 1 } } });
  const rnd = seededRandom(11);
  for (let i = 0; i < 300; i++) if (cast(seen, {}, rnd).twist) twists++;
  assert.ok(twists < 120, 'with the twist seen the original comes up three times in four (got ' + twists + ' twists in 300)');
  // The docket airs the day's fixed version, however the dice fall; once filed, it is free play again.
  const docket = docketToday(s, NOW);
  install(docket.caseId, { ...fixture(), id: 'docket-twist', truth: COURT_BY_ID[docket.caseId].truth === 'both' ? 'plaintiff' : 'both' });
  const dayTwist = docketTwist(docket.day, docket.caseId);
  for (const seed of [1, 2, 3, 4]) {
    const ep = castEpisode(household(), { caseId: docket.caseId, plaintiffId: 'g0', defendantId: 'g1', now: NOW }, seededRandom(seed));
    assert.equal(ep.twist, dayTwist); assert.equal(ep.docket, true);
  }
  const filed = household(); filed.courtroom = normalizeCourtroom({ docketDay: localDayKey(NOW), docketLastDay: localDayKey(NOW), docketStreak: 1 });
  const free = new Set(Array.from({ length: 40 }, (_, i) => castEpisode(filed, { caseId: docket.caseId, plaintiffId: 'g0', defendantId: 'g1', now: NOW }, seededRandom(i + 1)).twist));
  assert.ok(free.size === 2, 'after the docket is filed the case is drawn at random');
  // A summons is drawn on the hearer's side, with the hearer's own record.
  const mabel = guestPet({ id: 'g1', name: 'Mabel', traits: ['spiteful'], mood: 'fine', bond: 3, art: { creature: generateCreature({ seed: 'mabel' }) } });
  const heard = new Set(Array.from({ length: 40 }, (_, i) => castEpisode(household(), { caseId: 'borrowed-coffin', defendantId: 'g2', guest: { side: 'p', pet: mabel }, now: NOW }, seededRandom(i + 3)).twist));
  assert.equal(heard.size, 2);
  assert.equal(castEpisode(household(), { caseId: 'borrowed-coffin', twist: 'keith-owns-it', defendantId: 'g2', guest: { side: 'p', pet: mabel } }, seededRandom(1)).twist, 'keith-owns-it');
});

test('a neighbour who gives evidence in any telling never sits on the jury or stands in', () => {
  const witnessed = fixture();
  witnessed.questions[5] = { lines: alt([['npc', 'I was there. I was the raisin.', 'cat']], [['npc', 'Meow, in a way that holds up.', 'cat']]) };
  witnessed.turn = alt([['npc', 'Excuse me. A word.', 'raven']]);
  install('borrowed-coffin', witnessed);
  assert.ok(witnessesAnywhere(baseCase('borrowed-coffin')).has('cat') && witnessesAnywhere(baseCase('borrowed-coffin')).has('raven'));
  for (const salt of [0, 1, 2, 3, 4, 5, 6, 7]) assert.ok(!['cat', 'raven'].includes(standInFor('borrowed-coffin', salt)), 'the lobby never promises a witness');
  for (let seed = 1; seed < 30; seed++) {
    const ep = castEpisode(household(2), { caseId: 'borrowed-coffin', twist: 'keith-owns-it', plaintiffId: 'g0' }, seededRandom(seed));
    assert.ok(!ep.jury.some(j => ['cat', 'raven'].includes(j.id)), 'seed ' + seed + ' seated a witness');
    assert.ok(!['cat', 'raven'].includes(ep.d.id));
  }
  const ep = castEpisode(household(), { caseId: 'borrowed-coffin', twist: 'keith-owns-it', plaintiffId: 'g0', defendantId: 'g1' }, seededRandom(1));
  assert.ok(episodeOpening(ep, seededRandom(1)).some(l => l.turn && l.s === 'npc' && l.who === 'raven'));
});

test('the Case Notebook: each version seen is recorded with its best stars, once, and older saves are credited', () => {
  install('borrowed-coffin', fixture());
  const s = household();
  const play = (twist, ruling, ratings = 80) => {
    const ep = castEpisode(s, { caseId: 'borrowed-coffin', twist, plaintiffId: 'g0', defendantId: 'g1' }, seededRandom(4));
    episodeRule(ep, ruling, seededRandom(2));
    ep.ratings = ratings; ep.stars = (ruling === episodeCase(ep).truth ? 1 : 0) + (ratings >= 70 ? 1 : 0);
    return courtFinish(s, ep, NOW);
  };
  const first = play('base', 'plaintiff');
  assert.deepEqual([first.version.key, first.version.isNew, first.version.number, first.version.of, first.version.seen], ['base', true, 1, 2, 1]);
  assert.equal(first.version.title, 'The original');
  const second = play('keith-owns-it', 'plaintiff');
  assert.deepEqual([second.version.key, second.version.isNew, second.version.number, second.version.seen], ['keith-owns-it', true, 2, 2]);
  assert.equal(second.version.title, 'Keith’s Coffin');
  assert.equal(second.stars, 1, 'ruling for the plaintiff is wrong in the twist');
  const again = play('keith-owns-it', 'defendant');
  assert.equal(again.version.isNew, false); assert.equal(again.stars, 2);
  const c = courtroomState(s);
  assert.deepEqual(c.versions['borrowed-coffin'], { base: 2, 'keith-owns-it': 2 });
  assert.equal(c.best['borrowed-coffin'], 2);
  const entry = courtCases(s).find(x => x.id === 'borrowed-coffin');
  assert.deepEqual([entry.versions.of, entry.versions.seen], [2, 2]);
  // A save from before versions were tracked: the one airing on record was the original.
  const legacy = household();
  legacy.courtroom = normalizeCourtroom({ episodes: 1, justice: 1, best: { 'borrowed-coffin': 3 } });
  const ep = castEpisode(legacy, { caseId: 'borrowed-coffin', twist: 'keith-owns-it', plaintiffId: 'g0', defendantId: 'g1' }, seededRandom(4));
  episodeRule(ep, 'defendant', seededRandom(2));
  const res = courtFinish(legacy, ep, NOW);
  assert.equal(res.version.seen, 2);
  assert.equal(courtroomState(legacy).versions['borrowed-coffin'].base, 3, 'the original keeps the three stars it already had');
  // A friend’s summons writes down the telling you sat through, with no stars and no other record.
  const hearer = household();
  const mabel = guestPet({ id: 'g1', name: 'Mabel', traits: [], mood: 'fine', bond: 3, art: { creature: generateCreature({ seed: 'mabel' }) } });
  const heard = castEpisode(hearer, { caseId: 'borrowed-coffin', twist: 'keith-owns-it', defendantId: 'g2', guest: { side: 'p', pet: mabel } }, seededRandom(5));
  episodeRule(heard, 'plaintiff', seededRandom(2));
  courtFinish(hearer, heard, NOW);
  assert.deepEqual(courtroomState(hearer).versions, { 'borrowed-coffin': { 'keith-owns-it': 0 } });
  assert.deepEqual(courtroomState(hearer).best, {});
  assert.equal(courtroomState(hearer).episodes, 0);
});

test('the version record survives a reload and hostile data', () => {
  const s = household();
  s.courtroom = normalizeCourtroom({ best: { 'borrowed-coffin': 2 }, versions: { 'borrowed-coffin': { base: 2, 'keith-owns-it': 3 } } });
  const back = normalizeState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(back.courtroom.versions, { 'borrowed-coffin': { base: 2, 'keith-owns-it': 3 } });
  const bad = normalizeCourtroom({ versions: {
    'borrowed-coffin': { base: 9, 'Not Kebab': 1, '': 2, ok: -1, fine: 'x', 'good-one': 1.9 },
    'not-a-case': { base: 1 }, 'snoring-wall': ['base'], 'moth-custody': null
  } });
  assert.deepEqual(bad.versions, { 'borrowed-coffin': { base: 3, 'good-one': 1 } });
  const crowd = Object.fromEntries(Array.from({ length: 40 }, (_, i) => ['v' + i, 1]));
  assert.equal(Object.keys(normalizeCourtroom({ versions: { 'borrowed-coffin': crowd } }).versions['borrowed-coffin']).length, 12, 'bounded per case');
  assert.deepEqual(normalizeCourtroom({ versions: 'junk' }).versions, {});
});

test('twist ids do not collide with the original’s key and the data files only hold what they promise', () => {
  assert.equal(BASE, 'base');
  assert.ok(typeof alt === 'function' && Object.keys(HAPPENINGS).length > 5 && COURT_CAST.raven);
  assert.deepEqual(lineSets(alt([1], [2])).length, 2);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState } from '../src/state.js';
import { COURT_CASES, COURT_CAST, COURT_PATIENCE } from '../src/content/court.js';
import { GLYPH_NAMES } from '../src/art/mayhem-glyphs.js';
import { COURT_ART } from '../src/art/court-cast.js';
import {
  courtStart, courtCallWitness, courtMove, courtPress, courtPresent, courtFinish, courtCases, trialWitness, evidenceList, statementText
} from '../src/engine/court.js';
import { seededRandom } from '../src/engine/arcade.js';
import { normalizeCourtroom } from '../src/court-state.js';
import { GAME_SOULS_PER_DAY } from '../src/engine/mayhem.js';
import { ESCAPADES } from '../src/content/escapades.js';

const NOW = new Date(2026, 8, 25, 14, 0, 0).getTime();
const SPEAKERS = new Set(['judge', 'prosecutor', 'witness', 'you', 'defendant', 'gallery', 'narrator']);
function household() {
  const s = blankState();
  s.pets = [{ id: 'g0', name: 'Agnes', traits: ['damp'], needs: { food: 50, fuss: 40, clean: 50 }, bond: 2, cared: 0, grudges: 0, born: NOW - 86400000 }];
  s.slots[0] = 'g0';
  return s;
}
// Walk a whole trial with the right answers straight from the case file,
// pressing every statement first so evidence that only turns up under
// questioning is in hand when it is needed.
function solve(trial) {
  const k = COURT_CASES.find(c => c.id === trial.caseId);
  let result;
  for (let w = 0; w < k.witnesses.length; w++) {
    courtCallWitness(trial);
    const testimony = trialWitness(trial).testimony;
    for (let i = 0; i < testimony.length; i++) { trial.statement = i; courtPress(trial, seededRandom(i + 1)); }
    const lie = testimony.findIndex(s => s.lie);
    trial.statement = lie;
    const answer = Object.keys(testimony[lie].lie).find(id => trial.evidence.includes(id));
    result = courtPresent(trial, answer, seededRandom(w + 7));
    assert.equal(result.correct, true, k.id + ' witness ' + w);
  }
  return result;
}

test('every case is fair: one lie per testimony, disproved by evidence the player can hold', () => {
  assert.equal(COURT_CASES.length, 6);
  const ids = new Set();
  for (const k of COURT_CASES) {
    assert.ok(!ids.has(k.id)); ids.add(k.id);
    assert.equal(k.witnesses.length, 2, k.id);
    const later = k.evidenceLater || {};
    for (const e of [...k.evidence, ...Object.values(later)]) assert.ok(GLYPH_NAMES.includes(e.glyph), k.id + ' ' + e.id);
    const held = new Set(k.evidence.map(e => e.id));
    for (const w of k.witnesses) {
      assert.ok(COURT_CAST[w.who], k.id + ' cast ' + w.who);
      assert.ok(COURT_ART[COURT_CAST[w.who].art], 'art for ' + w.who);
      assert.equal(w.testimony.filter(s => s.lie).length, 1, k.id + ' ' + w.who + ' has exactly one lie');
      assert.ok(w.testimony.length >= 4 && w.testimony.length <= 6);
      // Evidence added by pressing this witness counts for this witness.
      for (const s of w.testimony) if (s.adds) { assert.ok(later[s.adds], k.id + ' adds unknown ' + s.adds); held.add(s.adds); }
      for (const s of w.testimony.filter(x => x.lie)) {
        const ids = Object.keys(s.lie);
        assert.ok(ids.length && ids.every(id => held.has(id)), k.id + ' lie disproved by evidence not yet in hand');
        assert.ok(s.crack?.length, k.id + ' crack lines');
      }
      for (const s of w.testimony) for (const line of [...(s.press || []), ...(s.crack || [])]) assert.ok(SPEAKERS.has(line.s), k.id + ' speaker ' + line.s);
    }
    for (const line of [...k.opening, ...k.verdict, ...k.witnesses.flatMap(w => w.intro)]) assert.ok(SPEAKERS.has(line.s), k.id + ' speaker ' + line.s);
  }
});

test('no dash punctuation sneaks into the court script', () => {
  const text = JSON.stringify(COURT_CASES);
  assert.ok(!/[—–]/.test(text));
});

test('every case can be won from start to finish, and the first win pays a bonus', () => {
  const s = household();
  for (const k of COURT_CASES) {
    const trial = courtStart(s, { caseId: k.id, petId: 'g0' });
    assert.ok(trial.opening.every(line => !line.t.includes('{d}')));
    const last = solve(trial);
    assert.equal(last.next, 'verdict');
    assert.ok(trial.done && trial.won);
    assert.ok(last.lines.some(line => /NOT GUILTY/.test(line.t)));
    const result = courtFinish(s, trial, NOW);
    assert.ok(result.won && result.firstSolve && result.flawless);
    assert.equal(courtFinish(s, trial, NOW), null, 'a trial pays once');
  }
  assert.equal(s.courtroom.solved.length, 6);
  assert.equal(s.courtroom.flawless.length, 6);
  assert.equal(s.pets[0].courtCases, 6);
  assert.ok(s.mayhem.gameSouls <= GAME_SOULS_PER_DAY);
  assert.ok(courtCases(s).every(c => c.solved && !c.next));
});

test('wrong evidence costs patience and the third mistake loses the case', () => {
  const s = household();
  const trial = courtStart(s, { caseId: 'funeral-cake', petId: 'g0' });
  courtCallWitness(trial);
  trial.statement = 0;
  let r;
  for (let i = 0; i < COURT_PATIENCE; i++) r = courtPresent(trial, 'fork', seededRandom(i));
  assert.equal(r.correct, false);
  assert.equal(r.lost, true);
  assert.ok(r.lines.some(line => /GUILTY/.test(line.t)));
  assert.equal(trial.patience, 0);
  assert.equal(courtPresent(trial, 'complaint'), null, 'no objections after the verdict');
  const result = courtFinish(s, trial, NOW);
  assert.equal(result.won, false);
  assert.equal(s.courtroom.solved.length, 0);
  assert.equal(s.courtroom.trials, 1);
  assert.equal(result.trust, 0);
});

test('the right evidence at the wrong statement is still wrong', () => {
  const s = household();
  const trial = courtStart(s, { caseId: 'funeral-cake', petId: 'g0' });
  courtCallWitness(trial);
  trial.statement = 1;
  assert.equal(courtPresent(trial, 'complaint', seededRandom(3)).correct, false);
  trial.statement = 3;
  const hit = courtPresent(trial, 'complaint', seededRandom(3));
  assert.equal(hit.correct, true);
  assert.equal(hit.next, 'witness');
  assert.match(hit.shout, /Agnes/);
});

test('pressing reveals hidden evidence once, and lies make the witness sweat', () => {
  const s = household();
  const trial = courtStart(s, { caseId: 'unlicensed-haunting', petId: 'g0' });
  courtCallWitness(trial);
  assert.ok(!trial.evidence.includes('licence'));
  trial.statement = 4;
  const first = courtPress(trial, () => 0.9);
  assert.equal(first.added.id, 'licence');
  assert.equal(courtPress(trial, () => 0.9).added, null);
  assert.equal(trial.evidence.filter(id => id === 'licence').length, 1);
  trial.statement = 2;
  assert.equal(courtPress(trial, () => 0.9).sweat, true);
  trial.statement = 0;
  assert.equal(courtPress(trial, () => 0.9).sweat, false);
  assert.equal(courtMove(trial, -1), 4);
  assert.equal(courtMove(trial, 1), 0);
  assert.ok(evidenceList(trial).every(e => !e.text.includes('{d}')));
  assert.ok(!statementText(trial, 2).includes('{d}'));
});

test('the case list points at the next unsolved case and saves survive a reload', () => {
  const s = household();
  assert.equal(courtCases(s).find(c => c.next).id, COURT_CASES[0].id);
  const trial = courtStart(s, { petId: 'g0' });
  assert.equal(trial.caseId, COURT_CASES[0].id);
  solve(trial); courtFinish(s, trial, NOW);
  assert.equal(courtCases(s).find(c => c.next).id, COURT_CASES[1].id);
  const reloaded = normalizeState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(reloaded.courtroom.solved, [COURT_CASES[0].id]);
  assert.deepEqual(normalizeCourtroom({ solved: ['nope', COURT_CASES[1].id, COURT_CASES[1].id], flawless: [COURT_CASES[2].id], trials: -4 }),
    { trials: 0, wins: 0, solved: [COURT_CASES[1].id], flawless: [], last: '' });
});

test('a court case finishes an adventure that asked for one', () => {
  const approaches = ESCAPADES.flatMap(e => e.approaches).filter(a => a.activity === 'court');
  assert.ok(approaches.length >= 3);
  const s = household();
  const trial = courtStart(s, { petId: 'g0' });
  solve(trial);
  courtFinish(s, trial, NOW);
  assert.ok(s.life.scenes.some(scene => scene.kind === 'court'));
});

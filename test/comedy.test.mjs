import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  blankState, normalizeState, addNote, chooseForm, formAllowed, reconcile, recordCare,
  recordVisit, firstTouchCounts, totalGrudges, resetPickMemory, pick, rememberPick,
  FORMS, FORM_SHARE, AMBIENT_FORMS, defaultCareLog, defaultLedger, SLOT_COUNT
} from '../src/state.js';
import { checkShelf, petLine, shelfNote, fill, canFill, subsFor } from '../src/engine/loop.js';
import { careFor } from '../src/engine/care.js';
import * as COPY from '../src/content/copy.js';
import { TRAITS } from '../src/content/traits.js';
import { PROPS } from '../src/content/props.js';
import { FEUD_LINES, ESCALATION_LINES, TRUCE_LINES } from '../src/content/feuds.js';

const HOUR = 3600000;
const DAY = 24 * HOUR;

/* ---------------- a realistic multi-day shelf ---------------- */

function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
}

// Several pets, props, feuding trait pairs, absences, care events, a rename and a
// rehoming — the same shape as the scratch harness the content was read through.
function simulate(seed = 5, days = 10) {
  const real = Math.random;
  Math.random = seededRandom(seed);
  resetPickMemory();
  try {
    const s = blankState();
    s.started = Date.now() - 14 * DAY;
    const sets = [['spiteful', 'hummer'], ['gossip', 'porcelain'], ['damp', 'fungal'],
                  ['napoleon', 'steward'], ['auditor', 'magpie'], ['clingy', 'bitey']];
    const names = ['Gary', 'Doreen', 'Mildew', 'Small Kevin', 'The Auditor', 'Bisque'];
    sets.forEach((traits, i) => {
      const p = {
        id: 'p' + i, name: names[i], traits, art: { body: '', stamps: [] },
        stats: { cute: 4, menace: 4, damp: 3, mystique: 4 }, bio: '', born: Date.now() - 12 * DAY,
        needs: { food: 70, fuss: 66, clean: 74 }, bond: 2, cared: 0, grudges: 0, grudgeStage: 0
      };
      s.pets.push(p); s.slots[i] = p.id;
    });
    s.props.push({ id: 'r1', kind: 'bowl' }, { id: 'r2', kind: 'lamp' });
    s.slots[6] = 'r1'; s.slots[7] = 'r2';
    normalizeState(s);

    let now = Date.now() - days * DAY;
    s.lastTick = now;
    const all = [];
    const take = () => {
      const out = [];
      for (const n of s.notes) { if (all.indexOf(n) >= 0) break; out.push(n); }
      out.reverse().forEach(n => all.push(n));
    };
    for (let d = 0; d < days; d++) {
      for (let c = 0; c < 3; c++) {
        // deliberately lopsided: Gary gets gone to first far more often
        const pet = c === 0 ? s.pets[0] : s.pets[Math.floor(Math.random() * s.pets.length)];
        if (pet) careFor(s, pet, ['food', 'fuss', 'clean'][c % 3], now);
      }
      for (let c = 0; c < 4; c++) { checkShelf(s, now); now += 10 * 60000; take(); }
      if (d === 3) s.pets[2].name = 'Mould';                       // rename
      if (d === 5 && s.pets.length > 1) {                          // rehome
        s.pets = s.pets.filter(p => p.id !== 'p5');
        s.slots = s.slots.map(x => (x === 'p5' ? null : x));
        reconcile(s, now);
      }
      now += (d % 3 === 0 ? 30 : 20) * HOUR;                       // absences
    }
    return { state: s, notes: all };
  } finally {
    Math.random = real;
  }
}

/* ---------------- lever 4: form rotation ---------------- */

test('the two form-rotation rules hold over a long simulated run', () => {
  for (const seed of [3, 17, 44]) {
    const { notes } = simulate(seed);
    assert.ok(notes.length > 120, `run too short to prove anything: ${notes.length}`);
    for (let i = 1; i < notes.length; i++) {
      assert.notEqual(notes[i].form, notes[i - 1].form,
        `seed ${seed}: same form twice in a row at ${i} (${notes[i].form}): ${notes[i].text.slice(0, 50)}`);
    }
    for (let i = 0; i < notes.length; i++) {
      if (notes[i].form === 'line') continue;                      // rule 2 exempts the one-liner
      for (let j = Math.max(0, i - 3); j < i; j++) {
        assert.notEqual(notes[j].form, notes[i].form,
          `seed ${seed}: ${notes[i].form} twice within four notes at ${i}`);
      }
    }
  }
});

test('every note carries a known form, and the one-liner stays the load-bearing majority', () => {
  const { notes } = simulate(9);
  notes.forEach(n => assert.ok(FORMS.indexOf(n.form) >= 0, `unknown form: ${n.form}`));
  const share = notes.filter(n => n.form === 'line').length / notes.length;
  // The spec targets 40%. Rule 1 forbids two one-liners in a row, so the achievable
  // band is narrow; anything under a third means the corkboard has become homework.
  assert.ok(share >= 0.33 && share <= 0.60, `one-liner share out of band: ${(share * 100).toFixed(0)}%`);
});

test('chooseForm never breaks rule 1, and never widens past the fallback it was given', () => {
  const s = blankState();
  const prose = ['line', 'react', 'found', 'silence'];
  for (let i = 0; i < 400; i++) {
    const f = chooseForm(s, prose, Math.random, prose);
    assert.ok(prose.indexOf(f) >= 0, `chooseForm escaped its fallback: ${f}`);
    assert.notEqual(f, s.formLog[0], 'chooseForm returned the previous form');
    addNote(s, 'x' + i, 'test', 'note', f);
  }
});

test('AMBIENT_FORMS keeps the four-form guarantee that makes both rules satisfiable', () => {
  assert.ok(AMBIENT_FORMS.length >= 4, 'ambient set must offer four forms');
  assert.ok(AMBIENT_FORMS.indexOf('line') >= 0, 'ambient set must include the one-liner');
  // An untagged note must always find a legal form, whatever the last eight were.
  const s = blankState();
  for (let i = 0; i < 300; i++) {
    const n = addNote(s, 'note ' + i, 'the shelf');
    assert.ok(AMBIENT_FORMS.indexOf(n.form) >= 0);
    if (i > 0) assert.notEqual(s.formLog[0], s.formLog[1]);
  }
});

/* ---------------- length budget ---------------- */

test('the length budget holds: 60% at or under 90 chars, nothing over 280', () => {
  const { notes } = simulate(23);
  const lens = notes.map(n => n.text.length);
  const under90 = lens.filter(l => l <= 90).length / lens.length;
  const under160 = lens.filter(l => l <= 160).length / lens.length;
  assert.ok(under90 >= 0.6, `only ${(under90 * 100).toFixed(0)}% of notes are <=90 chars`);
  assert.ok(under160 >= 0.9, `only ${(under160 * 100).toFixed(0)}% of notes are <=160 chars`);
  assert.ok(Math.max(...lens) <= 280, `a note ran to ${Math.max(...lens)} chars`);
});

test('no single content string anywhere exceeds 280 characters', () => {
  const pools = [];
  Object.keys(COPY).forEach(k => {
    const v = COPY[k];
    if (Array.isArray(v)) pools.push([k, v]);
    else if (v && typeof v === 'object') {
      Object.keys(v).forEach(k2 => {
        const inner = v[k2];
        if (Array.isArray(inner)) pools.push([k + '.' + k2, inner]);
        else if (inner && typeof inner === 'object') {
          Object.keys(inner).forEach(k3 => { if (Array.isArray(inner[k3])) pools.push([k + '.' + k2 + '.' + k3, inner[k3]]); });
        }
      });
    }
  });
  pools.forEach(([name, pool]) => pool.forEach(line => {
    if (typeof line !== 'string') return;
    assert.ok(line.length <= 280, `${name} has a ${line.length}-char string: ${line.slice(0, 60)}`);
  }));
  TRAITS.forEach(t => t.notes.concat(t.social).forEach(l =>
    assert.ok(l.length <= 280, `trait ${t.id} has a ${l.length}-char line`)));
});

/* ---------------- lever 3: substitution can never leak ---------------- */

test('no unsubstituted placeholder can reach a rendered note', () => {
  for (const seed of [1, 12, 31]) {
    const { notes } = simulate(seed);
    notes.forEach(n => assert.ok(!/[{}]/.test(n.text),
      `seed ${seed}: unsubstituted placeholder reached the corkboard: ${n.text}`));
  }
});

test('canFill refuses a template the save file cannot back, and fill never invents', () => {
  assert.equal(canFill('{p} is at {g}.', { p: 'Gary' }), false);
  assert.equal(canFill('{p} is at {g}.', { p: 'Gary', g: '4' }), true);
  assert.equal(fill('{p} is at {g}.', { p: 'Gary', g: '4' }), 'Gary is at 4.');
  // A missing key is left visibly alone rather than silently blanked, and canFill
  // is what stops the engine ever handing fill() one of those.
  assert.equal(fill('{p} is at {g}.', { p: 'Gary' }), 'Gary is at {g}.');
});

test('every state-aware template only reaches for subs its pool declares', () => {
  Object.keys(COPY.TEMPLATE_SUBS).forEach(poolName => {
    const declared = COPY.TEMPLATE_SUBS[poolName];
    const pool = COPY[poolName];
    assert.ok(pool, `TEMPLATE_SUBS names a pool that does not exist: ${poolName}`);
    const lines = Array.isArray(pool) ? pool : Object.keys(pool).reduce((a, k) => a.concat(pool[k]), []);
    lines.forEach(line => {
      (String(line).match(/\{(\w+)\}/g) || []).forEach(tok => {
        const key = tok.slice(1, -1);
        assert.ok(declared.indexOf(key) >= 0,
          `${poolName} uses {${key}} but does not declare it: ${line.slice(0, 60)}`);
      });
    });
  });
});

test('subsFor only supplies numbers the save file can prove', () => {
  const s = blankState();
  const bare = subsFor(s, {});
  assert.equal(bare.h, undefined, 'no absence has happened yet');
  assert.equal(bare.fav, undefined, 'nobody has been gone to first yet');
  assert.equal(bare.d, undefined, 'no streak yet');
  assert.equal(bare.tot, null, 'a count of one or zero is withheld, not printed');

  const pet = { id: 'p1', name: 'Gary', traits: [], needs: { food: 50, fuss: 50, clean: 50 },
                bond: 0, cared: 0, grudges: 0, grudgeStage: 0 };
  s.pets.push(pet); s.slots[0] = 'p1';
  normalizeState(s);
  const now = Date.now();
  recordCare(s, pet, 'fuss', now);
  recordCare(s, pet, 'fuss', now);
  const first = subsFor(s, { pet }, now);
  assert.equal(first.fuss, '2', 'careLog is read straight off the pet');
  assert.equal(first.best, '2', 'two fusses in a row is a record of two');
  assert.equal(first.favN, null, 'one visit is not a pattern worth naming');

  // Three more visits, all of them starting with the same pet.
  let later = now;
  for (let v = 0; v < 3; v++) { later += 5 * HOUR; recordCare(s, pet, 'food', later); }
  const subs = subsFor(s, { pet }, later);
  assert.equal(subs.fav, 'Gary');
  assert.equal(subs.favN, '4');
  assert.equal(subs.tot, '4');
  assert.equal(subs.selfN, '4');
  // Never claim a favouritism figure larger than the visits it is drawn from.
  assert.ok(Number(subs.favN) <= Number(subs.tot));
});

test('{home} is withheld once a pet has moved, so "since it arrived" can never be a lie', () => {
  const s = blankState();
  s.pets.push({ id: 'p1', name: 'Gary', traits: [], art: { body: '', stamps: [] },
                needs: { food: 50, fuss: 50, clean: 50 }, bond: 0, cared: 0, grudges: 0, grudgeStage: 0 });
  s.slots[0] = 'p1';
  normalizeState(s);
  const pet = s.pets[0];
  reconcile(s, Date.now());
  assert.equal(subsFor(s, { pet }).home, '1');
  s.slots[0] = null; s.slots[3] = 'p1';
  reconcile(s, Date.now());
  assert.equal(subsFor(s, { pet }).home, undefined, 'a pet that has moved has no home slot to claim');
  assert.equal(subsFor(s, { pet }).slot, '4');
});

/* ---------------- recent-line suppression ---------------- */

test('no line repeats within a visible board over a long run', () => {
  for (const seed of [8, 21]) {
    const { notes } = simulate(seed);
    const texts = notes.map(n => n.text);
    let repeats = 0;
    texts.forEach((t, i) => {
      for (let j = Math.max(0, i - 40); j < i; j++) if (texts[j] === t) repeats++;
    });
    // The corkboard holds 40 notes, so a repeat inside that window is one the
    // player can see twice at once. A handful across ~200 notes is the floor
    // imposed by the smallest pools; three in a row is the bug this guards.
    assert.ok(repeats <= 6, `seed ${seed}: ${repeats} repeats inside a single 40-note board`);
    for (let i = 2; i < texts.length; i++) {
      assert.ok(!(texts[i] === texts[i - 1] || texts[i] === texts[i - 2]),
        `seed ${seed}: "${texts[i].slice(0, 40)}" repeated within three notes`);
    }
  }
});

test('pick is a shuffle bag: it exhausts a pool before it repeats anything', () => {
  resetPickMemory();
  const pool = ['a', 'b', 'c', 'd', 'e'];
  const first = [];
  for (let i = 0; i < pool.length; i++) first.push(pick(pool));
  assert.deepEqual(first.slice().sort(), pool.slice().sort(), 'a full cycle must use every line once');
  // Non-string pools (pets, props, trait objects) must be unaffected.
  const objs = [{ id: 1 }, { id: 2 }];
  for (let i = 0; i < 20; i++) assert.ok(objs.indexOf(pick(objs)) >= 0);
  assert.equal(pick([]), undefined);
  assert.equal(pick(null), undefined);
});

test('a one-line pool still returns its line instead of looping or throwing', () => {
  resetPickMemory();
  for (let i = 0; i < 50; i++) assert.equal(pick(['only']), 'only');
});

/* ---------------- old saves ---------------- */

test('every new state field defaults safely on a save written before any of this existed', () => {
  const old = {
    v: 4, pets: [{ id: 'p1', name: 'Gnash', img: 'data:x', traits: ['spiteful'],
                   needs: { food: 40, fuss: 40, clean: 40 }, bond: 3, cared: 2, grudges: 1 }],
    notes: [{ text: 'an old note', from: 'the shelf', kind: 'note', at: 1 }],
    seq: 2, lastTick: 1, started: 1, seenUnlocks: [], achievements: [], feudArcs: {}
  };
  const s = normalizeState(old);
  assert.ok(s, 'an old save must still load');
  assert.deepEqual(s.gone, []);
  assert.deepEqual(s.visits, []);
  assert.deepEqual(s.formLog, []);
  assert.equal(s.ledger.meeting, 1);
  assert.equal(s.ledger.carried, 0);
  assert.deepEqual(s.ledger.struck, {});
  assert.equal(s.rosterSeeded, false);
  assert.equal(typeof s.noteCount, 'number');
  assert.equal(s.notes[0].form, 'line', 'a note saved before forms existed gets one');

  const p = s.pets[0];
  assert.deepEqual(p.careLog, defaultCareLog());
  assert.equal(p.firstTouch, 0);
  assert.equal(p.bestFuss, 0);
  assert.deepEqual(p.names, [{ name: 'Gnash', at: 1 }]);
  assert.deepEqual(p.slotHist, []);

  // And it has to survive actually being played, not merely loaded.
  assert.doesNotThrow(() => { checkShelf(s, Date.now()); petLine(s, s.pets[0]); });
  assert.ok(s.notes.length > 1);
});

test('a save with half the new fields present and garbage in the rest is repaired, not trusted', () => {
  const s = normalizeState({
    pets: [{ id: 'p1', name: 'X', art: { body: '', stamps: [] }, careLog: { food: 'lots' }, names: [], slotHist: 'no' }],
    gone: 'not an array', visits: null, ledger: { meeting: 4 }, formLog: ['line', 'nonsense']
  });
  assert.deepEqual(s.gone, []);
  assert.deepEqual(s.visits, []);
  assert.equal(s.ledger.meeting, 4, 'a real value is kept');
  assert.deepEqual(s.ledger.struck, {}, 'a missing sub-object is filled in');
  assert.deepEqual(s.formLog, ['line'], 'an unknown form is dropped from the log');
  assert.equal(s.pets[0].careLog.food, 0, 'a non-number care count is reset');
  assert.deepEqual(s.pets[0].names, [{ name: 'X', at: s.started }]);
  assert.deepEqual(s.pets[0].slotHist, []);
});

/* ---------------- lever 3: the histories actually get written ---------------- */

test('reconcile records renames, slot history and rehoming without any caller reporting in', () => {
  const s = blankState();
  const blank = { body: '', stamps: [] };
  s.pets.push({ id: 'p1', name: 'Gary', traits: [], art: blank, needs: { food: 60, fuss: 60, clean: 60 }, bond: 0, cared: 0, grudges: 0, grudgeStage: 0 },
              { id: 'p2', name: 'Doreen', traits: [], art: { body: '', stamps: [] }, needs: { food: 60, fuss: 60, clean: 60 }, bond: 0, cared: 0, grudges: 0, grudgeStage: 0 });
  s.slots[0] = 'p1'; s.slots[1] = 'p2';
  normalizeState(s);
  const a = s.pets[0], b = s.pets[1];
  void b;
  const t0 = Date.now();
  reconcile(s, t0);
  assert.equal(s.gone.length, 0, 'the first reconcile seeds the roster and rehomes nobody');

  a.name = 'Gareth';                                   // as ui/card.js would rename it
  s.slots[0] = null; s.slots[4] = 'p1';                // as ui/drag.js would move it
  reconcile(s, t0 + DAY);
  assert.deepEqual(a.names.map(n => n.name), ['Gary', 'Gareth']);
  assert.deepEqual(a.slotHist.map(h => h.slot), [0, 4]);
  assert.equal(a.slotHist[1].from, 0, 'a move remembers where it came from');

  s.slots[4] = null; s.slots[0] = 'p1';                // back alongside Doreen
  reconcile(s, t0 + 36 * HOUR);
  s.pets = s.pets.filter(p => p.id !== 'p2');          // as ui/card.js would rehome it
  s.slots = s.slots.map(x => (x === 'p2' ? null : x));
  reconcile(s, t0 + 2 * DAY);
  assert.equal(s.gone.length, 1);
  assert.equal(s.gone[0].name, 'Doreen');
  assert.equal(s.gone[0].slot, 1);
  assert.deepEqual(s.gone[0].neighbors, ['Gareth'], 'it remembers who it was sitting next to, by the name they had then');

  reconcile(s, t0 + 3 * DAY);
  assert.equal(s.gone.length, 1, 'state.gone is a record, not a queue');
});

test('care is logged per need, first touch is per visit, and the fuss record only goes up', () => {
  const s = blankState();
  const pet = { id: 'p1', name: 'Gary', traits: [], needs: { food: 20, fuss: 20, clean: 20 }, bond: 0, cared: 0, grudges: 0, grudgeStage: 0 };
  const other = { id: 'p2', name: 'Doreen', traits: [], needs: { food: 20, fuss: 20, clean: 20 }, bond: 0, cared: 0, grudges: 0, grudgeStage: 0 };
  s.pets.push(pet, other); s.slots[0] = 'p1'; s.slots[1] = 'p2';
  normalizeState(s);
  let now = Date.now();
  careFor(s, pet, 'food', now);
  careFor(s, pet, 'fuss', now);
  careFor(s, pet, 'fuss', now);
  careFor(s, other, 'fuss', now);
  assert.deepEqual(pet.careLog, { food: 1, fuss: 2, clean: 0 });
  assert.equal(pet.bestFuss, 2);
  assert.equal(firstTouchCounts(s).p1, 1, 'one visit, one first touch');
  assert.equal(firstTouchCounts(s).p2, undefined);

  now += 5 * HOUR;                                     // long enough to be a new visit
  careFor(s, other, 'fuss', now);
  assert.equal(s.visits.length, 2);
  assert.equal(firstTouchCounts(s).p2, 1);

  careFor(s, pet, 'clean', now);                       // breaks the fuss run
  careFor(s, pet, 'fuss', now);
  assert.equal(pet.bestFuss, 2, 'the record survives a broken run');
  assert.equal(pet.fussRun, 1);
});

test('the Briefing fires once for a pet that arrives onto a deep shelf, and never again', () => {
  const s = blankState();
  const veteran = { id: 'p1', name: 'Gary', traits: ['spiteful'], needs: { food: 60, fuss: 60, clean: 60 },
                    bond: 0, cared: 0, grudges: 20, grudgeStage: 0 };
  s.pets.push(veteran); s.slots[0] = 'p1';
  normalizeState(s);
  reconcile(s, Date.now());
  assert.ok(!veteran.briefPending, 'a pet already on the shelf is not briefed');

  const arrival = { id: 'p2', name: 'Doreen', traits: ['gossip'], needs: { food: 80, fuss: 80, clean: 80 },
                    bond: 0, cared: 0, grudges: 0, grudgeStage: 0, art: { body: '', stamps: [] } };
  s.pets.push(arrival); s.slots[1] = 'p2';
  normalizeState(s);
  reconcile(s, Date.now());
  assert.equal(arrival.briefPending, true, 'it has been briefed on the way in');
  const line = petLine(s, arrival);
  assert.equal(line.form, 'direct');
  assert.ok(line.text.indexOf(String(totalGrudges(s))) >= 0, 'the briefing quotes the real total');
  assert.ok(!arrival.briefPending);
  assert.equal(arrival.briefed, true);
});

test('a pet whose Item 4 is struck is barred from documents and direct address forever', () => {
  const s = blankState();
  const pet = { id: 'p1', name: 'Gary', traits: ['spiteful'], needs: { food: 10, fuss: 10, clean: 10 },
                bond: 0, cared: 0, grudges: 24, grudgeStage: 3 };
  s.pets.push(pet); s.slots[0] = 'p1';
  normalizeState(s);
  s.ledger.struck[pet.id] = Date.now() - 3 * DAY;
  pet.careLog = { food: 9, fuss: 9, clean: 9 };
  for (let i = 0; i < 120; i++) {
    const line = petLine(s, pet, { allowDoc: true, allowDirect: true });
    assert.notEqual(line.form, 'doc', 'a struck pet must never file again');
    assert.notEqual(line.form, 'direct', 'a struck pet must never turn round again');
    addNote(s, line.text, 'observed', line.kind, line.form);
  }
});

test('a one-pet, first-hour shelf still gets full-strength material in four forms', () => {
  const real = Math.random;
  Math.random = seededRandom(4);
  resetPickMemory();
  try {
    const s = blankState();
    const pet = { id: 'p1', name: 'Gary', traits: ['spiteful', 'damp'], art: { body: '', stamps: [] },
                  needs: { food: 30, fuss: 30, clean: 30 }, bond: 0, cared: 0, grudges: 0, grudgeStage: 0 };
    s.pets.push(pet); s.slots[0] = 'p1';
    normalizeState(s);
    const forms = new Set();
    for (let i = 0; i < 60; i++) {
      const line = petLine(s, pet, { allowDoc: false, allowDirect: false });
      assert.ok(line.text && !/[{}]/.test(line.text), `bad solo line: ${line.text}`);
      forms.add(line.form);
      addNote(s, line.text, 'observed', line.kind, line.form);
    }
    assert.ok(forms.size >= 4, `a solo shelf only produced ${forms.size} forms: ${[...forms]}`);
  } finally { Math.random = real; }
});

/* ---------------- the kill list ---------------- */

function everyNoteString() {
  const out = [];
  const N = COPY;
  ['HAPPY_NOTES', 'ASLEEP_LINES', 'EVENTS', 'LIST_NOTES', 'SILENCE_NOTES', 'PET_LIST_NOTES',
   'PET_SILENCE_LINES', 'FOUND_PET_LINES', 'FAVOURITE_LINES', 'ABSENCE_LINES', 'STREAK_LINES',
   'RENAME_LINES', 'GONE_LINES', 'GRID_LINES', 'GRUDGE_COUNT_LINES', 'RECORD_LINES',
   'BRIEFING_LINES', 'STRUCK_LINES', 'DIRECT_LINES', 'EMPTY_SHELF_NOTES'].forEach(k => out.push(...N[k]));
  ['food', 'fuss', 'clean'].forEach(k => {
    out.push(...N.COMPLAINTS[k].annoyed, ...N.COMPLAINTS[k].furious, ...N.NEIGHBOR_COMPLAINTS[k],
             ...N.CARE_LINES[k], ...N.OVERFED[k]);
  });
  [1, 2, 3].forEach(st => out.push(...N.GRUDGE_LINES[st]));
  TRAITS.forEach(t => out.push(...t.notes, ...t.social));
  Object.values(PROPS).forEach(p => out.push(...p.lines, ...p.ambient));
  out.push(...FEUD_LINES, ...ESCALATION_LINES, ...TRUCE_LINES);
  return out;
}

test('the withheld ending is rationed to well under one line in ten', () => {
  const all = everyNoteString();
  const withhold = /would not say|will not say|nobody will say|will not disclose|will not elaborate|will not explain|refuses to (say|explain)|will not discuss|not been shared|nobody knows what|will not repeat/i;
  const hits = all.filter(l => withhold.test(l));
  const ratio = hits.length / all.length;
  assert.ok(ratio <= 0.05,
    `${hits.length} of ${all.length} strings (${(ratio * 100).toFixed(1)}%) end on a withheld fact:\n` +
    hits.slice(0, 8).map(h => '  ' + h).join('\n'));
});

test('no note string ends on an explanatory "which" clause', () => {
  everyNoteString().forEach(l => {
    assert.ok(!/,\s*which\b[^.!?]*[.!?]?$/i.test(l.trim()), `explanatory final clause: ${l}`);
  });
});

test('the raw-rendered pools carry no placeholders and no cast a solo shelf cannot supply', () => {
  const raw = [].concat(
    COPY.COMPLAINTS.food.annoyed, COPY.COMPLAINTS.food.furious,
    COPY.COMPLAINTS.fuss.annoyed, COPY.COMPLAINTS.fuss.furious,
    COPY.COMPLAINTS.clean.annoyed, COPY.COMPLAINTS.clean.furious,
    COPY.CARE_LINES.food, COPY.CARE_LINES.fuss, COPY.CARE_LINES.clean,
    COPY.HAPPY_NOTES, COPY.ASLEEP_LINES, COPY.EVENTS, COPY.LIST_NOTES,
    COPY.SILENCE_NOTES, COPY.EMPTY_SHELF_NOTES
  );
  raw.forEach(l => {
    assert.ok(!/[{}]/.test(l), `placeholder in a raw-rendered pool: ${l}`);
    assert.ok(!/\bthe others\b|\bone of them\b|\btwo of them\b/i.test(l),
      `cast-dependent line in a pool a one-pet shelf draws from: ${l}`);
  });
});

test('every new content pool is free of duplicates, within itself and against the others', () => {
  const seen = new Map();
  const named = {
    LIST_NOTES: COPY.LIST_NOTES, SILENCE_NOTES: COPY.SILENCE_NOTES,
    PET_LIST_NOTES: COPY.PET_LIST_NOTES, PET_SILENCE_LINES: COPY.PET_SILENCE_LINES,
    FOUND_PET_LINES: COPY.FOUND_PET_LINES, FAVOURITE_LINES: COPY.FAVOURITE_LINES,
    ABSENCE_LINES: COPY.ABSENCE_LINES, RENAME_LINES: COPY.RENAME_LINES,
    GONE_LINES: COPY.GONE_LINES, GRID_LINES: COPY.GRID_LINES,
    GRUDGE_COUNT_LINES: COPY.GRUDGE_COUNT_LINES, RECORD_LINES: COPY.RECORD_LINES,
    BRIEFING_LINES: COPY.BRIEFING_LINES, STRUCK_LINES: COPY.STRUCK_LINES,
    DIRECT_LINES: COPY.DIRECT_LINES, EMPTY_SHELF_NOTES: COPY.EMPTY_SHELF_NOTES,
    EVENTS: COPY.EVENTS, HAPPY_NOTES: COPY.HAPPY_NOTES
  };
  Object.keys(named).forEach(name => named[name].forEach(line => {
    assert.ok(!seen.has(line), `"${line.slice(0, 44)}" appears in both ${seen.get(line)} and ${name}`);
    seen.set(line, name);
  }));
});

test('the documents are the only multi-line forms, and they stay inside the length budget', () => {
  const docs = [].concat(COPY.MINUTES_DOCS, COPY.SOLO_MINUTES_DOCS, COPY.CARE_RECORD_DOCS,
                         COPY.ROTA_DOCS, COPY.STRIKE_DOCS);
  docs.forEach(d => {
    const rows = d.split('\n');
    assert.ok(rows.length >= 4 && rows.length <= 8, `a document has ${rows.length} lines: ${rows[0]}`);
    assert.ok(d.length <= 280, `document over budget (${d.length}): ${rows[0]}`);
    assert.match(rows[0], /^[A-Z0-9 —,{}\w-]+$/, `a document must open on a typed header: ${rows[0]}`);
    assert.equal(rows[0], rows[0].replace(/[a-z]+(?![^{]*\})/g, ''), `a document header must be typed in caps: ${rows[0]}`);
  });
  COPY.LIST_NOTES.concat(COPY.PET_LIST_NOTES).forEach(l => {
    const rows = l.split('\n');
    assert.ok(rows.length >= 4 && rows.length <= 6, `a list has ${rows.length} rows: ${rows[0]}`);
  });
});

test('at most one document reaches the corkboard per check of the shelf', () => {
  const real = Math.random;
  Math.random = seededRandom(77);
  resetPickMemory();
  try {
    const { state } = simulate(77, 4);
    for (let i = 0; i < 40; i++) {
      const before = state.notes.length;
      const mark = state.notes[0];
      checkShelf(state, Date.now() + i * HOUR);
      const fresh = [];
      for (const n of state.notes) { if (n === mark) break; fresh.push(n); }
      const docs = fresh.filter(n => n.form === 'doc').length;
      assert.ok(docs <= 1, `${docs} documents in one batch`);
      void before;
    }
  } finally { Math.random = real; }
});

/* ---------------- lever 1: the dialogue system actually reaches the board ---------------- */

test('scenes reach the note feed, and the two-hander gets a real share of it', () => {
  const { notes } = simulate(6);
  const scenes = notes.filter(n => n.form === 'two');
  assert.ok(scenes.length > 0, 'no two-hander ever reached the corkboard');
  const share = scenes.length / notes.length;
  // The spec budgets the two-hander at 18%. It is the biggest single change to
  // how the game reads, so a collapse back toward zero is a regression worth failing.
  assert.ok(share >= 0.07, `two-handers are only ${(share * 100).toFixed(1)}% of the feed`);
  const reactions = notes.filter(n => n.form === 'react');
  assert.ok(reactions.length > 0, 'no reaction shot ever reached the corkboard');
});

test('multi-turn dialogue survives as multiple lines with speakers attached', () => {
  const { notes } = simulate(6);
  const scenes = notes.filter(n => n.form === 'two');
  assert.ok(scenes.length > 0);
  scenes.forEach(n => {
    const rows = n.text.split('\n');
    assert.ok(rows.length >= 2, `a two-hander collapsed to one line: ${n.text}`);
    const spoken = rows.filter(r => /^[^:]{1,24}: .+/.test(r));
    assert.ok(spoken.length >= 2, `a two-hander has fewer than two speaking turns: ${n.text}`);
    // Two different creatures, which is the entire point of the form.
    const speakers = new Set(spoken.map(r => r.slice(0, r.indexOf(':'))));
    assert.ok(speakers.size >= 2, `both turns are the same speaker: ${n.text}`);
    assert.ok(!/[{}]/.test(n.text), `placeholder leaked through a scene: ${n.text}`);
  });
});

test('multi-line forms would render as multiple lines, not one run-on', async () => {
  // The CSS is the load-bearing half of this: renderNotes() writes escaped text
  // into innerHTML, where a newline is whitespace unless .note says otherwise.
  const { readFile } = await import('node:fs/promises');
  const css = await readFile(new URL('../css/style.css', import.meta.url), 'utf8');
  assert.match(css, /\.note\s*\{[^}]*white-space\s*:\s*pre-line/,
    '.note needs white-space:pre-line or every two-hander, list and document collapses');
  assert.match(css, /\.note--doc\s*\{/, 'the document treatment is missing');
  const render = await readFile(new URL('../src/ui/render.js', import.meta.url), 'utf8');
  assert.match(render, /note--doc/, 'render.js never applies the document class');
});

test('freshDialogue maps every form dialogue.js can emit onto a known rotation tag', async () => {
  const { DIALOGUE_FORM } = await import('../src/engine/loop.js');
  const dialogue = await import('../src/engine/dialogue.js');
  const emitted = ['two-hander', 'reaction', 'direct', 'line', 'chorus'];
  emitted.forEach(f => {
    assert.ok(DIALOGUE_FORM[f], `dialogue form "${f}" has no rotation tag`);
    assert.ok(FORMS.indexOf(DIALOGUE_FORM[f]) >= 0, `"${f}" maps to an unknown form`);
  });
  assert.ok(typeof dialogue.pickDialogue === 'function');
});

test('a scene is never repeated while it is still on the board', async () => {
  const { freshDialogue } = await import('../src/engine/loop.js');
  const real = Math.random;
  Math.random = seededRandom(15);
  resetPickMemory();
  try {
    const { state } = simulate(15, 3);
    const seen = [];
    for (let i = 0; i < 60; i++) {
      const scene = freshDialogue(state, { now: Date.now() });
      if (!scene) continue;                       // it would rather say nothing
      assert.equal(seen.indexOf(scene.text), -1, `a scene repeated: ${scene.text.slice(0, 50)}`);
      seen.push(scene.text);
    }
    assert.ok(seen.length > 10, `only ${seen.length} distinct scenes were offered`);
  } finally { Math.random = real; }
});

test('no interpolated count ever produces a singular/plural mismatch', () => {
  // "You have been coming to this shelf 1 days" is how an interpolated number
  // stops being funny. Caught on screen once; guarded here from now on.
  const bad = /\b1 (days|times|hours|inches|visits|others|entries|slots)\b/;
  for (const seed of [2, 19, 37]) {
    const { notes } = simulate(seed);
    notes.forEach(n => assert.ok(!bad.test(n.text), `singular/plural mismatch: ${n.text}`));
  }
  // And prove it directly at the boundary value rather than hoping a run hits it.
  const s = blankState();
  s.pets.push({ id: 'p1', name: 'Gary', traits: ['spiteful'], art: { body: '', stamps: [] },
                needs: { food: 60, fuss: 60, clean: 60 }, bond: 0, cared: 0, grudges: 0, grudgeStage: 0 });
  s.slots[0] = 'p1';
  normalizeState(s);
  s.streak.count = 1;
  const subs = subsFor(s, { pet: s.pets[0] });
  [].concat(COPY.STREAK_LINES, COPY.DIRECT_LINES, COPY.ABSENCE_LINES, COPY.GONE_LINES,
            COPY.FAVOURITE_LINES, COPY.RECORD_LINES, COPY.RENAME_LINES).forEach(t => {
    const filled = fill(t, Object.assign({}, subs, {
      // The smallest value each sub is ever actually supplied at: engine/loop.js
      // withholds an hour count below three and any plural count below two.
      h: '3', goneD: '2', gone: 'Bartholomew', days: '2', old: 'Gnash',
      fav: 'Gary', favN: '2', tot: '2', best: '2', bestDay: 'Tuesday', slot: '1', strk: '2'
    }));
    assert.ok(!bad.test(filled), `template reads badly at one: ${filled}`);
  });
});

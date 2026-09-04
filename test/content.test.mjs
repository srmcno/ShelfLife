import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRAITS, TRAIT_BY_ID } from '../src/content/traits.js';
import { FEUDS, FEUD_LINES, ESCALATION_LINES, TRUCE_LINES } from '../src/content/feuds.js';

test('at least 60 traits, each with the required shape', () => {
  assert.ok(TRAITS.length >= 60, `expected >=60 traits, got ${TRAITS.length}`);
  TRAITS.forEach(t => {
    assert.equal(typeof t.id, 'string');
    assert.equal(typeof t.name, 'string');
    assert.equal(typeof t.blurb, 'string');
    assert.ok(Array.isArray(t.notes) && t.notes.length >= 4, `${t.id} needs >=4 notes`);
    assert.ok(Array.isArray(t.social) && t.social.length >= 3, `${t.id} needs >=3 social lines`);
  });
});

test('trait stats and care multipliers stay inside the documented ranges', () => {
  const STAT_KEYS = ['cute', 'menace', 'damp', 'mystique'];
  const NEEDS = ['food', 'fuss', 'clean'];
  TRAITS.forEach(t => {
    assert.equal(typeof t.stats, 'object', `${t.id} needs a stats object`);
    Object.entries(t.stats).forEach(([k, v]) => {
      assert.ok(STAT_KEYS.includes(k), `${t.id} has unknown stat "${k}"`);
      assert.equal(typeof v, 'number');
      assert.ok(v >= -2 && v <= 5, `${t.id}.stats.${k} out of range: ${v}`);
    });
    assert.equal(typeof t.care, 'object', `${t.id} needs a care object`);
    Object.entries(t.care).forEach(([k, v]) => {
      assert.ok(NEEDS.includes(k), `${t.id} has unknown care key "${k}"`);
      assert.ok(v >= 0.4 && v <= 2.2, `${t.id}.care.${k} out of range: ${v}`);
    });
  });
});

// {n} is substituted with a neighbour's name by engine/loop.js. A social line with no
// {n} silently renders as a line about nobody; a note with a {n} renders the literal
// braces, because notes are never substituted.
test('social lines all use {n}, and trait notes never do', () => {
  TRAITS.forEach(t => {
    t.social.forEach(l => assert.ok(l.includes('{n}'), `${t.id} social line missing {n}: ${l}`));
    t.notes.forEach(l => assert.ok(!l.includes('{n}'), `${t.id} note has an unsubstituted {n}: ${l}`));
  });
});

test('no line is duplicated anywhere across the whole trait pool', () => {
  const seen = new Map();
  TRAITS.forEach(t => {
    t.notes.concat(t.social).forEach(line => {
      assert.ok(!seen.has(line), `duplicate line in ${seen.get(line)} and ${t.id}: ${line}`);
      seen.set(line, t.id);
    });
  });
});

test('trait ids are unique and TRAIT_BY_ID matches TRAITS', () => {
  const ids = TRAITS.map(t => t.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate trait id found');
  ids.forEach(id => assert.equal(TRAIT_BY_ID[id].id, id));
});

test('gameplay boolean flags are present on the traits the engine depends on', () => {
  // hasTrait(pet,'nocturnal'|'thief'|'wanderer') checks a literal flag property on the
  // trait definition, not the trait id — these four are load-bearing for engine/tick.js's
  // isAsleep() and engine/loop.js's autonomy() (self-moving/food-stealing pets).
  assert.equal(TRAIT_BY_ID.nocturnal.nocturnal, true);
  assert.equal(TRAIT_BY_ID.magpie.thief, true);
  assert.equal(TRAIT_BY_ID.cult.wanderer, true);
  assert.equal(TRAIT_BY_ID.clingy.wanderer, true);
});

test('every FEUDS pair references two real, distinct trait ids', () => {
  assert.ok(FEUDS.length >= 45, `expected >=45 feud pairs, got ${FEUDS.length}`);
  FEUDS.forEach(([a, b]) => {
    assert.ok(TRAIT_BY_ID[a], `unknown trait id in FEUDS: ${a}`);
    assert.ok(TRAIT_BY_ID[b], `unknown trait id in FEUDS: ${b}`);
    assert.notEqual(a, b);
  });
});

// activeFeuds() matches a pair in either order, so ['a','b'] and ['b','a'] are the same
// rule and a repeat is dead data.
test('FEUDS has no duplicate pairs in either direction', () => {
  const seen = new Set();
  FEUDS.forEach(([a, b]) => {
    const key = [a, b].sort().join('|');
    assert.ok(!seen.has(key), `duplicate feud pair: ${a}/${b}`);
    seen.add(key);
  });
});

test('feud/escalation/truce line pools use {a} and {b} placeholders', () => {
  [FEUD_LINES, ESCALATION_LINES, TRUCE_LINES].forEach(pool => {
    assert.ok(pool.length >= 10, `expected >=10 lines in pool, got ${pool.length}`);
    pool.forEach(line => {
      assert.ok(line.includes('{a}'), `missing {a} in: ${line}`);
      assert.ok(line.includes('{b}'), `missing {b} in: ${line}`);
    });
  });
});

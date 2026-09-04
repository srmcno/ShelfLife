import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRAITS, TRAIT_BY_ID } from '../src/content/traits.js';
import { FEUDS, FEUD_LINES, ESCALATION_LINES, TRUCE_LINES } from '../src/content/feuds.js';

test('at least 45 traits, each with the required shape', () => {
  assert.ok(TRAITS.length >= 45, `expected >=45 traits, got ${TRAITS.length}`);
  TRAITS.forEach(t => {
    assert.equal(typeof t.id, 'string');
    assert.equal(typeof t.name, 'string');
    assert.equal(typeof t.blurb, 'string');
    assert.ok(Array.isArray(t.notes) && t.notes.length >= 3, `${t.id} needs >=3 notes`);
    assert.ok(Array.isArray(t.social) && t.social.length >= 2, `${t.id} needs >=2 social lines`);
  });
});

test('trait ids are unique and TRAIT_BY_ID matches TRAITS', () => {
  const ids = TRAITS.map(t => t.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate trait id found');
  ids.forEach(id => assert.equal(TRAIT_BY_ID[id].id, id));
});

test('every FEUDS pair references two real, distinct trait ids', () => {
  assert.ok(FEUDS.length >= 20, `expected >=20 feud pairs, got ${FEUDS.length}`);
  FEUDS.forEach(([a, b]) => {
    assert.ok(TRAIT_BY_ID[a], `unknown trait id in FEUDS: ${a}`);
    assert.ok(TRAIT_BY_ID[b], `unknown trait id in FEUDS: ${b}`);
    assert.notEqual(a, b);
  });
});

test('feud/escalation/truce line pools use {a} and {b} placeholders', () => {
  [FEUD_LINES, ESCALATION_LINES, TRUCE_LINES].forEach(pool => {
    assert.ok(pool.length >= 8, 'expected >=8 lines in pool');
    pool.forEach(line => {
      assert.ok(line.includes('{a}'), `missing {a} in: ${line}`);
      assert.ok(line.includes('{b}'), `missing {b} in: ${line}`);
    });
  });
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE_STAMPS, UNLOCK_STAMPS, STAMP_LABELS, STAMP_SVG, STAMP_ANIM_CLASS, DEFAULT_STAMP_SIZE } from '../src/art/stamps.js';

test('every base and unlockable stamp kind has SVG markup and a label', () => {
  const allKinds = BASE_STAMPS.concat(UNLOCK_STAMPS.flatMap(u => u.stamps));
  assert.ok(allKinds.length >= 16, `expected >=16 stamp kinds, got ${allKinds.length}`);
  allKinds.forEach(kind => {
    assert.ok(STAMP_SVG[kind] && STAMP_SVG[kind].includes('<svg'), `missing/invalid SVG for ${kind}`);
    assert.ok(typeof STAMP_LABELS[kind] === 'string' && STAMP_LABELS[kind].length > 0, `missing label for ${kind}`);
    assert.ok(kind in STAMP_ANIM_CLASS, `missing STAMP_ANIM_CLASS entry for ${kind}`);
  });
});

test('DEFAULT_STAMP_SIZE is a positive number', () => {
  assert.equal(typeof DEFAULT_STAMP_SIZE, 'number');
  assert.ok(DEFAULT_STAMP_SIZE > 0);
});

test('UNLOCK_STAMPS thresholds are ascending', () => {
  const ats = UNLOCK_STAMPS.map(u => u.at);
  for (let i = 1; i < ats.length; i++) assert.ok(ats[i] > ats[i - 1], 'unlock thresholds must be ascending');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NEED_LABEL, DECAY, COMPLAINTS, CARE_LINES, OVERFED, HAPPY_NOTES,
  ASLEEP_LINES, EVENTS, FALLBACK_NAMES, ORIGINS, HABITS, CLOSERS,
  GRUDGE_LINES, STREAK_LINES
} from '../src/content/copy.js';
import { PROPS, PROP_ART } from '../src/content/props.js';
import { ROOMS, WALLS, WOODS, ACCENTS } from '../src/content/decor.js';
import {
  MATURE_COMPLAINTS_EXTRA, MATURE_HAPPY_EXTRA, MATURE_EVENTS_EXTRA, MATURE_GRUDGE_EXTRA
} from '../src/content/mature.js';

const NEEDS = ['food', 'fuss', 'clean'];

test('NEED_LABEL and DECAY have the three need keys with the right shapes', () => {
  NEEDS.forEach(k => {
    assert.equal(typeof NEED_LABEL[k], 'string');
    assert.ok(NEED_LABEL[k].length > 0);
    assert.equal(typeof DECAY[k], 'number');
    assert.ok(DECAY[k] > 0);
  });
  assert.equal(DECAY.food, 5.2);
  assert.equal(DECAY.fuss, 4.4);
  assert.equal(DECAY.clean, 3.4);
});

test('COMPLAINTS has annoyed/furious pools per need, each at/above the size floor', () => {
  NEEDS.forEach(k => {
    assert.ok(Array.isArray(COMPLAINTS[k].annoyed) && COMPLAINTS[k].annoyed.length >= 8, `${k}.annoyed too small`);
    assert.ok(Array.isArray(COMPLAINTS[k].furious) && COMPLAINTS[k].furious.length >= 10, `${k}.furious too small`);
    COMPLAINTS[k].annoyed.concat(COMPLAINTS[k].furious).forEach(line => {
      assert.equal(typeof line, 'string');
      assert.ok(line.length > 0);
    });
  });
});

test('CARE_LINES has >=10 lines per need', () => {
  NEEDS.forEach(k => {
    assert.ok(Array.isArray(CARE_LINES[k]) && CARE_LINES[k].length >= 10, `CARE_LINES.${k} too small`);
  });
});

test('OVERFED has >=6 lines per need', () => {
  NEEDS.forEach(k => {
    assert.ok(Array.isArray(OVERFED[k]) && OVERFED[k].length >= 6, `OVERFED.${k} too small`);
  });
});

test('HAPPY_NOTES, ASLEEP_LINES, EVENTS meet their size floors', () => {
  assert.ok(HAPPY_NOTES.length >= 16, `HAPPY_NOTES too small: ${HAPPY_NOTES.length}`);
  assert.ok(ASLEEP_LINES.length >= 8, `ASLEEP_LINES too small: ${ASLEEP_LINES.length}`);
  assert.ok(EVENTS.length >= 24, `EVENTS too small: ${EVENTS.length}`);
});

test('bio-composition pools meet their size floors and are non-empty strings', () => {
  assert.ok(FALLBACK_NAMES.length >= 30, `FALLBACK_NAMES too small: ${FALLBACK_NAMES.length}`);
  assert.ok(ORIGINS.length >= 30, `ORIGINS too small: ${ORIGINS.length}`);
  assert.ok(HABITS.length >= 24, `HABITS too small: ${HABITS.length}`);
  assert.ok(CLOSERS.length >= 20, `CLOSERS too small: ${CLOSERS.length}`);
  [FALLBACK_NAMES, ORIGINS, HABITS, CLOSERS].forEach(pool => {
    pool.forEach(line => {
      assert.equal(typeof line, 'string');
      assert.ok(line.length > 0);
    });
  });
});

test('GRUDGE_LINES has keys 1/2/3, each with >=5 lines using {n}', () => {
  [1, 2, 3].forEach(stage => {
    const pool = GRUDGE_LINES[stage];
    assert.ok(Array.isArray(pool) && pool.length >= 5, `GRUDGE_LINES[${stage}] too small`);
    pool.forEach(line => assert.ok(line.includes('{n}'), `missing {n} in: ${line}`));
  });
});

test('STREAK_LINES has >=8 entries, all including {d}', () => {
  assert.ok(STREAK_LINES.length >= 8, `STREAK_LINES too small: ${STREAK_LINES.length}`);
  STREAK_LINES.forEach(line => assert.ok(line.includes('{d}'), `missing {d} in: ${line}`));
});

test('PROPS has >=16 entries, each with a matching PROP_ART entry and the required shape', () => {
  const ids = Object.keys(PROPS);
  assert.ok(ids.length >= 16, `expected >=16 props, got ${ids.length}`);
  ids.forEach(id => {
    const p = PROPS[id];
    assert.equal(typeof p.name, 'string');
    assert.equal(typeof p.at, 'number');
    assert.equal(typeof p.aura, 'object');
    assert.equal(typeof p.desc, 'string');
    assert.ok(Array.isArray(p.lines) && p.lines.length > 0, `${id} needs lines`);
    assert.ok(Array.isArray(p.ambient) && p.ambient.length > 0, `${id} needs ambient`);
    assert.ok(PROP_ART[id] && PROP_ART[id].includes('<svg'), `missing/invalid PROP_ART for ${id}`);
    assert.ok(PROP_ART[id].includes('viewBox="0 0 60 60"'), `PROP_ART.${id} should use the 0 0 60 60 viewBox convention`);
  });
});

test('ROOMS/WALLS/WOODS/ACCENTS are non-empty objects with the expected sub-shapes', () => {
  assert.ok(Object.keys(ROOMS).length > 0, 'ROOMS is empty');
  Object.values(ROOMS).forEach(r => {
    assert.equal(typeof r.name, 'string');
    assert.equal(typeof r.swatch, 'string');
    assert.equal(typeof r.vars, 'object');
    assert.ok(Object.keys(r.vars).length > 0);
  });
  assert.ok(Object.keys(WALLS).length > 0, 'WALLS is empty');
  Object.values(WALLS).forEach(v => assert.equal(typeof v, 'string'));

  assert.ok(Object.keys(WOODS).length > 0, 'WOODS is empty');
  Object.values(WOODS).forEach(w => {
    assert.equal(typeof w.name, 'string');
    assert.equal(typeof w.wood, 'string');
    assert.equal(typeof w.lip, 'string');
  });

  assert.ok(Object.keys(ACCENTS).length > 0, 'ACCENTS is empty');
  Object.values(ACCENTS).forEach(a => {
    assert.equal(typeof a.name, 'string');
    assert.equal(typeof a.c, 'string');
  });
});

test('mature-mode overlay pools meet their size floors', () => {
  NEEDS.forEach(k => {
    assert.ok(Array.isArray(MATURE_COMPLAINTS_EXTRA[k]) && MATURE_COMPLAINTS_EXTRA[k].length >= 6, `MATURE_COMPLAINTS_EXTRA.${k} too small`);
  });
  assert.ok(MATURE_HAPPY_EXTRA.length >= 6, `MATURE_HAPPY_EXTRA too small: ${MATURE_HAPPY_EXTRA.length}`);
  assert.ok(MATURE_EVENTS_EXTRA.length >= 6, `MATURE_EVENTS_EXTRA too small: ${MATURE_EVENTS_EXTRA.length}`);
  [1, 2, 3].forEach(stage => {
    const pool = MATURE_GRUDGE_EXTRA[stage];
    assert.ok(Array.isArray(pool) && pool.length >= 6, `MATURE_GRUDGE_EXTRA[${stage}] too small`);
    pool.forEach(line => assert.ok(line.includes('{n}'), `missing {n} in: ${line}`));
  });
});

test('mature overlay pools are additive extras only (disjoint from the base pools)', () => {
  NEEDS.forEach(k => {
    MATURE_COMPLAINTS_EXTRA[k].forEach(line => {
      assert.ok(!COMPLAINTS[k].annoyed.includes(line) && !COMPLAINTS[k].furious.includes(line));
    });
  });
  MATURE_HAPPY_EXTRA.forEach(line => assert.ok(!HAPPY_NOTES.includes(line)));
  MATURE_EVENTS_EXTRA.forEach(line => assert.ok(!EVENTS.includes(line)));
});

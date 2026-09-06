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
  assert.equal(DECAY.food, 4.2);
  assert.equal(DECAY.fuss, 3.6);
  assert.equal(DECAY.clean, 2.8);
});

test('COMPLAINTS has annoyed/furious pools per need, each at/above the size floor', () => {
  NEEDS.forEach(k => {
    assert.ok(Array.isArray(COMPLAINTS[k].annoyed) && COMPLAINTS[k].annoyed.length >= 10, `${k}.annoyed too small`);
    assert.ok(Array.isArray(COMPLAINTS[k].furious) && COMPLAINTS[k].furious.length >= 12, `${k}.furious too small`);
    COMPLAINTS[k].annoyed.concat(COMPLAINTS[k].furious).forEach(line => {
      assert.equal(typeof line, 'string');
      assert.ok(line.length > 0);
    });
  });
});

test('CARE_LINES has >=12 lines per need', () => {
  NEEDS.forEach(k => {
    assert.ok(Array.isArray(CARE_LINES[k]) && CARE_LINES[k].length >= 12, `CARE_LINES.${k} too small`);
  });
});

test('OVERFED has >=7 lines per need', () => {
  NEEDS.forEach(k => {
    assert.ok(Array.isArray(OVERFED[k]) && OVERFED[k].length >= 7, `OVERFED.${k} too small`);
  });
});

test('HAPPY_NOTES, ASLEEP_LINES, EVENTS meet their size floors', () => {
  assert.ok(HAPPY_NOTES.length >= 18, `HAPPY_NOTES too small: ${HAPPY_NOTES.length}`);
  assert.ok(ASLEEP_LINES.length >= 10, `ASLEEP_LINES too small: ${ASLEEP_LINES.length}`);
  assert.ok(EVENTS.length >= 34, `EVENTS too small: ${EVENTS.length}`);
});

test('bio-composition pools meet their size floors and are non-empty strings', () => {
  assert.ok(FALLBACK_NAMES.length >= 40, `FALLBACK_NAMES too small: ${FALLBACK_NAMES.length}`);
  assert.ok(ORIGINS.length >= 34, `ORIGINS too small: ${ORIGINS.length}`);
  assert.ok(HABITS.length >= 26, `HABITS too small: ${HABITS.length}`);
  assert.ok(CLOSERS.length >= 22, `CLOSERS too small: ${CLOSERS.length}`);
  [FALLBACK_NAMES, ORIGINS, HABITS, CLOSERS].forEach(pool => {
    pool.forEach(line => {
      assert.equal(typeof line, 'string');
      assert.ok(line.length > 0);
    });
  });
});

// main.js builds a bio as ORIGIN + ' ' + HABIT + ' ' + trait.blurb + ' ' + CLOSER, so
// each fragment has to survive as a standalone sentence mid-paragraph: capitalised at
// the front, terminally punctuated at the back.
test('bio fragments are complete sentences so the assembled bio parses', () => {
  [ORIGINS, HABITS, CLOSERS].forEach(pool => {
    pool.forEach(line => {
      assert.match(line, /^[A-Z"']/, `bio fragment should start capitalised: ${line}`);
      assert.match(line, /[.!?"]$/, `bio fragment should end with terminal punctuation: ${line}`);
    });
  });
});

test('GRUDGE_LINES has keys 1/2/3, each with >=6 lines using {n}', () => {
  [1, 2, 3].forEach(stage => {
    const pool = GRUDGE_LINES[stage];
    assert.ok(Array.isArray(pool) && pool.length >= 6, `GRUDGE_LINES[${stage}] too small`);
    pool.forEach(line => assert.ok(line.includes('{n}'), `missing {n} in: ${line}`));
  });
});

test('STREAK_LINES has >=10 entries, all including {d}', () => {
  assert.ok(STREAK_LINES.length >= 10, `STREAK_LINES too small: ${STREAK_LINES.length}`);
  STREAK_LINES.forEach(line => assert.ok(line.includes('{d}'), `missing {d} in: ${line}`));
});

// {n}/{a}/{b}/{p}/{d} are the only placeholders any engine substitutes. A stray brace in
// a pool that is never run through .replace() renders literally in the note feed.
test('no unsubstituted placeholder leaks into a pool the engine renders raw', () => {
  const raw = [].concat(
    COMPLAINTS.food.annoyed, COMPLAINTS.food.furious,
    COMPLAINTS.fuss.annoyed, COMPLAINTS.fuss.furious,
    COMPLAINTS.clean.annoyed, COMPLAINTS.clean.furious,
    CARE_LINES.food, CARE_LINES.fuss, CARE_LINES.clean,
    OVERFED.food, OVERFED.fuss, OVERFED.clean,
    HAPPY_NOTES, ASLEEP_LINES, EVENTS, ORIGINS, HABITS, CLOSERS
  );
  raw.forEach(line => assert.ok(!/[{}]/.test(line), `unsubstituted placeholder in: ${line}`));
});

test('no copy line is duplicated across the pools that share a note feed', () => {
  const all = [].concat(
    COMPLAINTS.food.annoyed, COMPLAINTS.food.furious,
    COMPLAINTS.fuss.annoyed, COMPLAINTS.fuss.furious,
    COMPLAINTS.clean.annoyed, COMPLAINTS.clean.furious,
    CARE_LINES.food, CARE_LINES.fuss, CARE_LINES.clean,
    OVERFED.food, OVERFED.fuss, OVERFED.clean,
    HAPPY_NOTES, ASLEEP_LINES, EVENTS, FALLBACK_NAMES, ORIGINS, HABITS, CLOSERS,
    GRUDGE_LINES[1], GRUDGE_LINES[2], GRUDGE_LINES[3], STREAK_LINES
  );
  const seen = new Set();
  all.forEach(line => {
    assert.ok(!seen.has(line), `duplicate copy line: ${line}`);
    seen.add(line);
  });
});

test('PROPS has >=20 entries, each with a matching PROP_ART entry and the required shape', () => {
  const ids = Object.keys(PROPS);
  assert.ok(ids.length >= 20, `expected >=20 props, got ${ids.length}`);
  ids.forEach(id => {
    const p = PROPS[id];
    assert.equal(typeof p.name, 'string');
    assert.equal(typeof p.at, 'number');
    assert.equal(typeof p.aura, 'object');
    assert.equal(typeof p.desc, 'string');
    assert.ok(Array.isArray(p.lines) && p.lines.length >= 3, `${id} needs >=3 lines`);
    assert.ok(Array.isArray(p.ambient) && p.ambient.length >= 2, `${id} needs >=2 ambient lines`);
    assert.ok(PROP_ART[id] && PROP_ART[id].includes('<svg'), `missing/invalid PROP_ART for ${id}`);
    assert.ok(PROP_ART[id].includes('viewBox="0 0 60 60"'), `PROP_ART.${id} should use the 0 0 60 60 viewBox convention`);
  });
  Object.keys(PROP_ART).forEach(id => assert.ok(PROPS[id], `PROP_ART.${id} has no matching PROPS entry`));
});

// engine/loop.js substitutes {p} in `lines` only; `ambient` is rendered raw.
test('prop lines use {p} and ambient lines never do', () => {
  Object.entries(PROPS).forEach(([id, p]) => {
    p.lines.forEach(l => assert.ok(l.includes('{p}'), `${id} line missing {p}: ${l}`));
    p.ambient.forEach(l => assert.ok(!/[{}]/.test(l), `${id} ambient line has a placeholder: ${l}`));
  });
});

// PROP_ART strings are injected as innerHTML, so a malformed one fails silently as a
// blank icon rather than an error. This is a strict element-only well-formedness check:
// no text nodes, no unquoted attributes, every tag balanced.
function assertWellFormedSvg(id, svg) {
  assert.ok(svg.startsWith('<svg '), `PROP_ART.${id} must start with <svg`);
  assert.ok(svg.endsWith('</svg>'), `PROP_ART.${id} must end with </svg>`);
  const tagRe = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:-]+\s*=\s*"[^"<>]*")*)\s*(\/?)>/g;
  const stack = [];
  let cursor = 0;
  let m;
  while ((m = tagRe.exec(svg)) !== null) {
    assert.equal(m.index, cursor,
      `PROP_ART.${id} has stray or malformed markup at index ${cursor}: ${JSON.stringify(svg.slice(cursor, m.index + 24))}`);
    cursor = tagRe.lastIndex;
    const [, closing, tag, , selfClosing] = m;
    if (closing) {
      assert.equal(stack.pop(), tag, `PROP_ART.${id} closes </${tag}> out of order`);
    } else if (!selfClosing) {
      stack.push(tag);
    }
  }
  assert.equal(cursor, svg.length, `PROP_ART.${id} has trailing content: ${JSON.stringify(svg.slice(cursor))}`);
  assert.deepEqual(stack, [], `PROP_ART.${id} left tags unclosed: ${stack.join(', ')}`);
}

test('every PROP_ART string is well-formed, element-only SVG markup', () => {
  Object.entries(PROP_ART).forEach(([id, svg]) => assertWellFormedSvg(id, svg));
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
    assert.ok(Array.isArray(MATURE_COMPLAINTS_EXTRA[k]) && MATURE_COMPLAINTS_EXTRA[k].length >= 7, `MATURE_COMPLAINTS_EXTRA.${k} too small`);
  });
  assert.ok(MATURE_HAPPY_EXTRA.length >= 7, `MATURE_HAPPY_EXTRA too small: ${MATURE_HAPPY_EXTRA.length}`);
  assert.ok(MATURE_EVENTS_EXTRA.length >= 8, `MATURE_EVENTS_EXTRA too small: ${MATURE_EVENTS_EXTRA.length}`);
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

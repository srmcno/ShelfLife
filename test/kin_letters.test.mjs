// Pen pal letters: the pools, the generator and the replies. Letters are
// built on both shelves from the same seed and week, so they must be exact,
// clean and varied.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeLetter, replyOptions, walk, letterPools, caseTitle, LETTER_MAX, REPLY_MAX, HISTORY_KINDS } from '../src/engine/kin-letters.js';
import { OPENINGS, MIDDLES, SIGNOFFS, TRAIT_PS, GENERAL_PS, REPLIES, TRAIT_REPLIES, REPLY_SIGNOFFS, BIRTH_OPENINGS, BIRTH_FEATURES, BIRTH_INHERITANCES, HISTORY_LABELS } from '../src/content/kin.js';
import { TRAIT_BY_ID } from '../src/content/traits.js';

const NODASH = /[–—]/;
const STRAIGHT = /['"]/;
const MOODS = ['content', 'fine', 'annoyed', 'furious'];
const writer = (traits = ['spiteful', 'litigious'], mood = 'fine') => ({ id: 'w', name: 'Grubbs', traits, mood });
const reader = { id: 'r', name: 'Mabel', traits: ['theatrical'], mood: 'content' };

test('the pools are as big as promised and written in the house style', () => {
  assert.ok(OPENINGS.length >= 60, 'openings: ' + OPENINGS.length);
  const historyMiddles = Object.entries(MIDDLES).filter(([kind]) => kind !== 'any').reduce((n, [, list]) => n + list.length, 0);
  assert.ok(historyMiddles >= 80, 'middles about history: ' + historyMiddles);
  assert.ok(SIGNOFFS.length >= 40, 'sign-offs: ' + SIGNOFFS.length);
  for (const mood of MOODS) assert.ok(OPENINGS.filter(o => o.mood === mood).length >= 5, mood);
  for (const kind of HISTORY_KINDS) assert.ok(MIDDLES[kind]?.length >= 6, kind);
  const all = [...OPENINGS.map(o => o.text), ...Object.values(MIDDLES).flat(), ...SIGNOFFS, ...Object.values(TRAIT_PS), ...GENERAL_PS,
    ...Object.values(REPLIES).flat(), ...Object.values(TRAIT_REPLIES), ...REPLY_SIGNOFFS, ...BIRTH_OPENINGS, ...BIRTH_FEATURES, ...BIRTH_INHERITANCES, ...Object.values(HISTORY_LABELS)];
  for (const line of all) {
    assert.ok(!NODASH.test(line), 'no dashes: ' + line);
    assert.ok(!STRAIGHT.test(line), 'curly quotes and apostrophes: ' + line);
    assert.ok(!/\s{2,}|^\s|\s$/.test(line), 'tidy spacing: ' + line);
  }
  const lines = [...OPENINGS.map(o => o.text), ...Object.values(MIDDLES).flat(), ...SIGNOFFS];
  assert.equal(new Set(lines).size, lines.length, 'no line is written twice');
  for (const trait of [...Object.keys(TRAIT_PS), ...Object.keys(TRAIT_REPLIES)]) assert.ok(TRAIT_BY_ID[trait], 'a real trait: ' + trait);
  assert.ok(Object.keys(TRAIT_PS).length >= 40, 'most quirks have their own P.S.');
  for (const tone of ['warm', 'dry', 'petty']) assert.ok(REPLIES[tone].length >= 20, tone);
});

test('a walk visits every line before any comes round again', () => {
  for (const n of [1, 2, 12, 40, 45, 96]) {
    const seen = new Set(Array.from({ length: n }, (_, k) => walk(n, 'pal:7:x', 300 + k)));
    assert.equal(seen.size, n);
  }
});

test('letters are exact, clean, short and fully filled in, for every kind of history, mood and quirk', () => {
  const traitSets = [[], ['spiteful'], ['litigious', 'doom', 'fullname'], Object.keys(TRAIT_PS).slice(0, 6), ['not-a-trait']];
  let count = 0;
  for (const history of [...HISTORY_KINDS, 'unknown']) for (const mood of [...MOODS, 'odd']) for (const traits of traitSets) for (const week of [0, 151, 152, 999]) {
    const input = { seed: 2024 + count, week, history, writer: writer(traits, mood), reader, caseId: 'borrowed-coffin', child: 'Grubel' };
    const { text, parts } = writeLetter(input);
    assert.equal(text, writeLetter(input).text, 'deterministic');
    assert.ok(text.length <= LETTER_MAX, text.length + ': ' + text);
    assert.ok(!NODASH.test(text), text);
    assert.ok(!/[{}]/.test(text), 'no unresolved placeholders: ' + text);
    assert.ok(text.startsWith('Dear Mabel,\n\n'), text);
    assert.match(text, /\nGrubbs\n\nP\.S\. /);
    assert.ok(parts.ps.startsWith('P.S. '));
    count++;
  }
  // Names that look like placeholders stay names.
  const odd = writeLetter({ seed: 1, week: 1, history: 'twin', writer: { name: '{child}', traits: [], mood: 'fine' }, reader: { name: '{to}' } }).text;
  assert.ok(odd.startsWith('Dear {to},'));
  assert.equal(caseTitle('borrowed-coffin'), '“The Borrowed Coffin”');
  assert.equal(caseTitle('no-such-case'), 'our hearing');
});

test('a year of weekly letters between the same two residents does not repeat itself', () => {
  for (const history of HISTORY_KINDS) {
    const letters = Array.from({ length: 52 }, (_, i) => writeLetter({ seed: 777, week: 150 + i, history, writer: writer(['spiteful', 'gossip'], 'fine'), reader, caseId: 'tontine', child: 'Grubel' }));
    assert.equal(new Set(letters.map(l => l.text)).size, 52, history + ': every letter is different');
    const pools = letterPools(history, 'fine');
    assert.equal(new Set(letters.map(l => l.parts.opening)).size, Math.min(52, pools.openings.length), history + ': no opening twice until all have been used');
    assert.equal(new Set(letters.map(l => l.parts.middle)).size, Math.min(52, pools.middles.length), history + ': no middle twice until all have been used');
    assert.equal(new Set(letters.map(l => l.parts.signoff)).size, SIGNOFFS.length, history + ': every sign-off within the year');
  }
  // Mood colours the opening.
  const furious = new Set(Array.from({ length: 52 }, (_, i) => writeLetter({ seed: 3, week: i, history: 'hearing', writer: writer([], 'furious'), reader }).parts.body));
  assert.ok([...furious].some(body => OPENINGS.filter(o => o.mood === 'furious').some(o => body.startsWith(o.text))));
  assert.ok(![...furious].some(body => OPENINGS.filter(o => o.mood === 'content').some(o => body.startsWith(o.text))));
  // Quirks colour the P.S.
  const spiteful = Array.from({ length: 8 }, (_, i) => writeLetter({ seed: 3, week: i * 2, history: 'hearing', writer: writer(['spiteful'], 'fine'), reader }).parts.ps);
  assert.ok(spiteful.every(ps => ps === 'P.S. ' + TRAIT_PS.spiteful));
});

test('three plausible replies: fond, dry and petty, the quirk taking a place', () => {
  const options = replyOptions({ seed: 55, week: 160, writer: { name: 'Mabel', traits: [] }, reader: { name: 'Grubbs' } });
  assert.deepEqual(options.map(o => o.tone), ['warm', 'dry', 'petty']);
  assert.equal(new Set(options.map(o => o.line)).size, 3);
  for (const o of options) {
    assert.ok(o.text.startsWith('Dear Grubbs,\n\n') && o.text.endsWith('\nMabel'), o.text);
    assert.ok(o.text.length <= REPLY_MAX && !NODASH.test(o.text) && !/[{}]/.test(o.text), o.text);
  }
  assert.deepEqual(options, replyOptions({ seed: 55, week: 160, writer: { name: 'Mabel', traits: [] }, reader: { name: 'Grubbs' } }), 'both shelves write the same reply');
  const quirky = replyOptions({ seed: 55, week: 160, writer: { name: 'Mabel', traits: ['litigious'] }, reader: { name: 'Grubbs' } });
  assert.equal(quirky[0].line, options[0].line, 'the fond reply stays fond');
  assert.ok(quirky.slice(1).some(o => o.line === TRAIT_REPLIES.litigious));
  const weeks = new Set(Array.from({ length: 20 }, (_, i) => replyOptions({ seed: 55, week: 160 + i, writer: { name: 'Mabel' }, reader: { name: 'Grubbs' } })[0].line));
  assert.equal(weeks.size, 20, 'a different fond reply each week for twenty weeks');
});

// The writing for mischief: enough of it, in the house style, and safe for
// the victim (every outcome pays, nothing is taken).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/content/mischief.js';
import { GLYPH_NAMES } from '../src/art/mayhem-glyphs.js';
import { TRAIT_BY_ID } from '../src/content/traits.js';

const { HEX_DECK, TRICK_DECK, BOWLS } = C;
const strings = value => typeof value === 'string' ? [value] : Array.isArray(value) ? value.flatMap(strings)
  : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];
const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]);

test('there are at least thirty hexes and ten tricks, each a playable card', () => {
  assert.ok(HEX_DECK.length >= 30, HEX_DECK.length + ' hexes');
  assert.ok(TRICK_DECK.length >= 10, TRICK_DECK.length + ' tricks');
  const ids = [...HEX_DECK, ...TRICK_DECK].map(h => h.id);
  assert.equal(new Set(ids).size, ids.length, 'unique ids');
  assert.equal(new Set(HEX_DECK.map(h => h.name)).size, HEX_DECK.length, 'unique names');
  for (const card of [...HEX_DECK, ...TRICK_DECK]) {
    assert.match(card.id, /^[a-z0-9-]{1,40}$/);
    assert.ok(GLYPH_NAMES.includes(card.art), card.id + ' art ' + card.art);
    assert.ok(card.name && card.blurb && card.title, card.id);
    assert.ok(card.title.includes('{a}') || card.title.includes('{b}'), card.id + ' names someone');
    assert.ok(card.choices.length >= 2 && card.choices.length <= 3, card.id + ' has two or three choices');
    for (const choice of card.choices) {
      assert.ok(choice.label && /^(with|by) /.test(choice.how), card.id + ' / ' + choice.label + ' says how, for the sender');
      assert.ok(choice.outcomes.length >= 2, card.id + ' / ' + choice.label);
    }
  }
});

test('every outcome pays the victim and takes nothing', () => {
  for (const card of [...HEX_DECK, ...TRICK_DECK]) for (const choice of card.choices) for (const o of choice.outcomes) {
    const where = card.id + ' / ' + o.stamp;
    assert.ok(['good', 'bad', 'weird'].includes(o.tone), where);
    assert.match(o.stamp, /^[A-Z][A-Z -]{1,20}$/, where);
    assert.ok(Number.isInteger(o.souls) && o.souls >= 10 && o.souls <= 24, where + ' pays ' + o.souls);
    assert.equal(o.grudge, undefined, where + ' never files a grudge');
    assert.equal(o.b, undefined, where + ' never touches the culprit');
    if (o.a) for (const [need, delta] of Object.entries(o.a)) {
      assert.ok(['food', 'fuss', 'clean'].includes(need) && delta > 0 && delta <= 30, where + ' only ever helps a need');
    }
    if (o.fits) { assert.ok(o.fits.every(t => TRAIT_BY_ID[t] && t !== 'damp'), where + ' fits real traits'); assert.equal(o.bondAt, undefined); }
    if (o.bond) assert.equal(o.bond, 'a');
  }
});

test('hexes tell the sender how it went, and some rebound', () => {
  let rebounding = 0;
  for (const card of HEX_DECK) {
    if (card.choices.some(c => c.outcomes.some(o => o.rebound))) rebounding++;
    for (const choice of card.choices) for (const o of choice.outcomes) {
      assert.ok(typeof o.report === 'string' && o.report.length > 10, card.id + ' / ' + o.stamp + ' has a report');
      assert.ok(placeholders(o.report).every(p => ['f', 'c'].includes(p)), card.id + ' report uses {f} and {c} only');
      assert.ok(!/rebounded/i.test(o.report), 'the rebound line is added by the engine');
    }
  }
  assert.ok(rebounding >= HEX_DECK.length / 2, rebounding + ' cards can rebound');
  for (const card of TRICK_DECK) assert.ok(card.choices.every(c => c.outcomes.every(o => !o.rebound && !o.report)), card.id + ' is local only');
});

test('placeholders are the ones each pool is filled with', () => {
  const check = (lines, allowed, label) => { for (const line of strings(lines)) assert.ok(placeholders(line).every(p => allowed.includes(p)), label + ': ' + line); };
  for (const card of [...HEX_DECK, ...TRICK_DECK]) {
    check([card.title, ...card.choices.flatMap(c => [c.label, ...c.outcomes.map(o => o.text)])], ['a', 'b', 'f'], card.id);
  }
  check(C.HEX_DECLINED_LINES, ['f', 'c', 'hex'], 'declined');
  check(C.HEX_EXPIRED_LINES, ['f', 'c', 'hex'], 'expired');
  check(C.HAUNT_LINES, ['r', 'f'], 'haunt');
  check([C.SHOO_WIN_LINES, C.SHOO_MISS_LINES], ['g', 'f'], 'shoo');
  check([C.HAUNT_SHOOED_LINES, C.HAUNT_ENDED_LINES], ['f', 'g', 'taps'], 'haunt results');
  check(C.HELP_NOTE_TAILS, ['a', 'f'], 'help tails');
  check(C.HELP_DONE_LINES, ['a', 'f'], 'help done');
  check(C.DOORSTEP_LINES, ['n'], 'doorstep');
  check([C.KNOCK_TREAT_LINES, C.KNOCK_CURIO_LINES, C.KNOCK_TRICK_LINES], ['f', 's'], 'knocks');
});

test('pools are large enough that a daily player does not see repeats for weeks', () => {
  assert.ok(C.HAUNT_LINES.length >= 30 && new Set(C.HAUNT_LINES).size === C.HAUNT_LINES.length);
  assert.ok(C.SHOO_WIN_LINES.length >= 6 && C.SHOO_MISS_LINES.length >= 5);
  assert.ok(C.HEX_DECLINED_LINES.length >= 5 && C.HEX_EXPIRED_LINES.length >= 5);
  assert.ok(C.HELP_NOTE_TAILS.length >= 6 && Object.values(C.HELP_DONE_LINES).every(l => l.length >= 4));
  assert.ok(Object.values(C.DOORSTEP_LINES).every(l => l.length >= 3));
  assert.ok(C.KNOCK_TREAT_LINES.length >= 5 && C.KNOCK_TRICK_LINES.length >= 4);
});

test('bowls set sensible odds and never pay more than the server allows', () => {
  assert.ok(BOWLS.length >= 6);
  assert.equal(BOWLS[0].id, 'none', 'no bowl is the default');
  for (const b of BOWLS) {
    assert.match(b.id, /^[a-z0-9-]{1,24}$/);
    assert.ok(b.name && b.line);
    assert.ok(b.treat >= 0 && b.treat <= 100 && b.curio >= 0 && b.curio <= 100);
    assert.ok(Number.isInteger(b.lo) && Number.isInteger(b.hi) && b.lo >= 1 && b.lo <= b.hi && b.hi <= 30);
  }
  assert.ok(new Set(BOWLS.map(b => b.treat)).size >= 5, 'the bowl matters');
});

test('the house style: no dashes, curly quotes, no stray markup', () => {
  for (const line of strings(C)) {
    assert.ok(!/[\u2013\u2014]/.test(line), 'no en or em dash: ' + line);
    assert.ok(!/ - /.test(line), 'no hyphen used as a dash: ' + line);
    assert.ok(!/['"]/.test(line), 'curly quotes only: ' + line);
    assert.ok(!/[<>]/.test(line), 'no markup: ' + line);
  }
});

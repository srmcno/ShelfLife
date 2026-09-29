import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COURT_ART, COURT_PROPS, castSvg } from '../src/art/court-cast.js';

// The cast is injected as innerHTML, so a malformed string fails silently as a
// blank or half-drawn puppet. Same strict element-only check as PROP_ART in
// copy.test.mjs: no text nodes, every attribute quoted, every tag balanced.
function assertWellFormedSvg(id, svg) {
  assert.ok(svg.startsWith('<svg '), id + ' must start with <svg');
  assert.ok(svg.endsWith('</svg>'), id + ' must end with </svg>');
  const tagRe = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:-]+\s*=\s*"[^"<>]*")*)\s*(\/?)>/g;
  const stack = [];
  let cursor = 0, m;
  while ((m = tagRe.exec(svg)) !== null) {
    assert.equal(m.index, cursor, id + ' has stray or malformed markup at ' + cursor + ': ' + JSON.stringify(svg.slice(cursor, m.index + 24)));
    cursor = tagRe.lastIndex;
    const [, closing, tag, , selfClosing] = m;
    if (closing) assert.equal(stack.pop(), tag, id + ' closes </' + tag + '> out of order');
    else if (!selfClosing) stack.push(tag);
  }
  assert.equal(cursor, svg.length, id + ' has trailing content');
  assert.deepEqual(stack, [], id + ' left tags unclosed: ' + stack.join(', '));
  for (const [, d] of svg.matchAll(/\sd="([^"]*)"/g)) assert.ok(!/--|NaN|undefined/.test(d), id + ' has a broken path: ' + d.slice(0, 60));
}
const classes = svg => new Set([...svg.matchAll(/class="([^"]*)"/g)].flatMap(([, c]) => c.split(/\s+/)));

test('every cast portrait and prop is well-formed SVG', () => {
  for (const art of Object.keys(COURT_ART)) assertWellFormedSvg('COURT_ART.' + art, castSvg(art));
  for (const [id, svg] of Object.entries(COURT_PROPS)) assertWellFormedSvg('COURT_PROPS.' + id, svg);
});

test('Judge Mortis has every part the stylesheet moves', () => {
  const have = classes(castSvg('judge'));
  for (const part of ['cc-bob', 'cc-mouth', 'cc-brow', 'jm-sway', 'jm-body', 'jm-head', 'jm-jaw', 'jm-eyes', 'jm-pupil-l', 'jm-pupil-r', 'jm-glow', 'jm-lid',
    'jm-brow-l', 'jm-brow-r', 'jm-wig', 'jm-push', 'jm-hand', 'jm-f1', 'jm-f2', 'jm-f3', 'jm-arm', 'jm-gavel', 'jm-block', 'jm-flash', 'jm-desk']) {
    assert.ok(have.has(part), 'judge is missing .' + part);
  }
  // The jaw is the talking part, so it must be the element marked .cc-mouth.
  assert.match(castSvg('judge'), /class="cc-mouth jm-jaw"/);
});

test('Bailiff Rattigan has every part the stylesheet moves', () => {
  const have = classes(castSvg('rat'));
  for (const part of ['cc-bob', 'cc-mouth', 'cc-eye', 'cc-sweat', 'rb-jump', 'rb-tail', 'rb-ear-l', 'rb-ear-r', 'rb-whisk-l', 'rb-whisk-r', 'rb-look',
    'rb-nose', 'rb-teeth', 'rb-cap', 'rb-cheeks', 'rb-notebook', 'rb-arm-rest', 'rb-arm-salute', 'rb-arm-chomp']) {
    assert.ok(have.has(part), 'bailiff is missing .' + part);
  }
});

test('every judge and bailiff class in the stylesheet is drawn or set by the court', () => {
  const css = readFileSync(new URL('../css/court.css', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../src/ui/court.js', import.meta.url), 'utf8');
  const drawn = new Set([...classes(castSvg('judge')), ...classes(castSvg('rat'))]);
  const used = new Set([...css.matchAll(/\.((?:jm|rb)-[\w-]+)/g)].map(m => m[1]));
  for (const cls of used) assert.ok(drawn.has(cls) || ui.includes("'" + cls + "'") || ui.includes("'" + cls.replace(/^jm-/, '') + "'"), '.' + cls + ' is styled but never drawn or set');
});

import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

// The toast module reads #toast lazily, so a tiny stand-in element is enough.
function stage() {
  const classes = new Set();
  const node = { textContent: '', classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c) }, addEventListener() {}, appendChild() {} };
  globalThis.document = { getElementById: id => (id === 'toast' ? node : null), createElement: () => ({ classList: { add() {} }, setAttribute() {}, remove() {} }) };
  return { node, shown: () => (classes.has('show') ? node.textContent : '') };
}

test('two messages at once are both read, in order', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const { toast, dismissToast, readTime, restTime } = await import('../src/ui/toast.js?queue');
  const view = stage();
  toast('First message about the crumb.');
  toast('Second message about the coffin.');
  assert.equal(view.shown(), 'First message about the crumb.');
  t.mock.timers.tick(readTime('First message about the crumb.') - 1);
  assert.equal(view.shown(), 'First message about the crumb.', 'the first gets time to be read');
  t.mock.timers.tick(1);
  assert.equal(view.shown(), 'Second message about the coffin.');
  t.mock.timers.tick(restTime('Second message about the coffin.'));
  assert.equal(view.shown(), '', 'a lone message still leaves on its own');
  dismissToast();
});

test('a lone message lasts as long as it always did, and the same line is not stacked', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const { toast, dismissToast, restTime } = await import('../src/ui/toast.js?lone');
  const view = stage();
  toast('Notes restored. They kept copies.');
  t.mock.timers.tick(2000);
  toast('Notes restored. They kept copies.');
  assert.equal(view.shown(), 'Notes restored. They kept copies.');
  t.mock.timers.tick(restTime('Notes restored. They kept copies.') - 1);
  assert.equal(view.shown(), 'Notes restored. They kept copies.', 'repeating a line keeps it up, it does not queue a copy');
  t.mock.timers.tick(1);
  assert.equal(view.shown(), '');
  dismissToast();
});

test('a burst keeps the newest four and dismissing clears them all', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const { toast, dismissToast, readTime } = await import('../src/ui/toast.js?burst');
  const view = stage();
  for (let i = 1; i <= 8; i++) toast('Message number ' + i + ' arrives.');
  const seen = [view.shown()];
  for (let i = 0; i < 6; i++) { t.mock.timers.tick(readTime('Message number 1 arrives.') + 1); seen.push(view.shown()); }
  assert.deepEqual(seen.filter((x, i) => x && x !== seen[i - 1]), ['Message number 1 arrives.', 'Message number 5 arrives.', 'Message number 6 arrives.', 'Message number 7 arrives.', 'Message number 8 arrives.']);
  toast('Another one.'); toast('And one more.');
  dismissToast();
  assert.equal(view.shown(), '');
  t.mock.timers.tick(20000);
  assert.equal(view.shown(), '', 'nothing left in the queue after a dismissal');
});

test('empty and non-string messages are ignored', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const { toast, dismissToast } = await import('../src/ui/toast.js?empty');
  const view = stage();
  toast(''); toast(null); toast(undefined);
  assert.equal(view.shown(), '');
  toast(42);
  assert.equal(view.shown(), '42');
  dismissToast();
});

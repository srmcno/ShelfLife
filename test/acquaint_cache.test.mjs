import test from 'node:test';
import assert from 'node:assert/strict';

import { renderAcquainted } from '../src/ui/life.js';

// The page is only read when the function runs, so the stand-in goes in after the import.
const panel = { hidden: true, innerHTML: '', dataset: {} }, locked = { hidden: true, innerHTML: '' };
globalThis.document = { getElementById: id => (id === 'acquaintPanel' ? panel : id === 'lockedFolders' ? locked : null) };

test('the introduction is drawn again after it was cleared, for the same resident and stage', () => {
  const state = { pets: [{ name: 'Mabel', careLog: { food: 0, fuss: 0, clean: 0 } }] };
  renderAcquainted(state, state.pets[0]);
  assert.match(panel.innerHTML, /Getting acquainted/);
  renderAcquainted(state, null);
  assert.equal(panel.innerHTML, '');
  assert.equal(panel.hidden, true);
  // A restored pre-introduction backup with the same resident and stage.
  renderAcquainted(state, state.pets[0]);
  assert.match(panel.innerHTML, /Getting acquainted/);
  assert.notEqual(locked.innerHTML, '');
  assert.equal(panel.hidden, false);
});

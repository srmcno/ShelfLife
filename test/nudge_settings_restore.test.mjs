import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState } from '../src/state.js';

test('replacing the live settings repaints nudge categories before the next toggle', async () => {
  const events = new EventTarget(), handlers = new Map();
  const box = { hidden: false, innerHTML: '', addEventListener: (name, listener) => handlers.set(name, listener) };
  globalThis.document = { getElementById: id => id === 'nudgeCats' ? box : null, addEventListener() {} };
  globalThis.window = events;
  globalThis.Capacitor = { Plugins: { LocalNotifications: { cancel: async () => {}, schedule: async () => {} } } };
  const { initNudgeSettings } = await import('../src/ui/nudge-settings.js');
  const state = blankState(); state.settings.nudges = true;
  initNudgeSettings(state);
  assert.match(box.innerHTML, /data-nudge-cat="away" aria-pressed="true"/);
  state.settings = { ...state.settings, nudgeCats: { emergency: true, away: false, almanac: false, chest: true } };
  events.dispatchEvent(new CustomEvent('shelflife:state-replaced'));
  assert.match(box.innerHTML, /data-nudge-cat="away" aria-pressed="false"/);
  assert.match(box.innerHTML, /data-nudge-cat="almanac" aria-pressed="false"/);
  handlers.get('click')({ target: { closest: () => ({ dataset: { nudgeCat: 'away' } }) } });
  assert.equal(state.settings.nudgeCats.away, true);
  assert.match(box.innerHTML, /data-nudge-cat="away" aria-pressed="true"/);
  state.settings = { ...state.settings, nudges: false };
  events.dispatchEvent(new CustomEvent('shelflife:state-replaced'));
  assert.equal(box.hidden, true);
});

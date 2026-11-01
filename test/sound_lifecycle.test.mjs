import { test } from 'node:test';
import assert from 'node:assert/strict';

test('audio resume handles navigation cancellation but reports active-page failures', async () => {
  const oldWindow = globalThis.window, oldDocument = globalThis.document, oldError = console.error;
  const failures = [], pending = [];
  class AudioContext {
    state = 'suspended';
    resume() { return new Promise((resolve, reject) => pending.push({ resolve, reject })); }
  }
  const window = new EventTarget();
  window.AudioContext = AudioContext;
  globalThis.window = window;
  globalThis.document = { addEventListener() {} };
  console.error = (...args) => failures.push(args);
  try {
    const { kit } = await import('../src/audio/sound.js?lifecycle-test');
    kit.getCtx();
    kit.getCtx();
    window.dispatchEvent(new Event('pagehide'));
    pending.shift().reject(new DOMException('Navigated away from page', 'InvalidStateError'));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(failures.length, 0);

    window.dispatchEvent(new Event('pageshow'));
    pending.shift().reject(new DOMException('Navigated away from page', 'InvalidStateError'));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(failures.length, 0, 'a delayed cancellation stays harmless after returning from page cache');
    kit.getCtx();
    const error = new DOMException('Audio device failed', 'InvalidStateError');
    pending.shift().reject(error);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(failures, [['Audio could not resume.', error]]);
  } finally {
    globalThis.window = oldWindow;
    globalThis.document = oldDocument;
    console.error = oldError;
  }
});

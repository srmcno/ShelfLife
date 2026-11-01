import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAppleMobile } from '../src/ui/install.js';
test('recognises iPhone and desktop-mode iPad without treating a Mac as an iPad', () => {
  assert.equal(isAppleMobile({ userAgent: 'iPhone', platform: 'iPhone', maxTouchPoints: 5 }), true);
  assert.equal(isAppleMobile({ userAgent: 'Macintosh', platform: 'MacIntel', maxTouchPoints: 5 }), true);
  assert.equal(isAppleMobile({ userAgent: 'Macintosh', platform: 'MacIntel', maxTouchPoints: 0 }), false);
});

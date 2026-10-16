import test from 'node:test';
import assert from 'node:assert/strict';
import { registerFriendAction, friendActions, registerPostboxSource, postboxCount, postboxSources, registerFriendsSection, friendsSections, resetSocialRegistry } from '../src/ui/social-registry.js';

test('friend actions sort by order, hide when unavailable and keep a reason when blocked', () => {
  resetSocialRegistry();
  registerFriendAction({ id: 'b', label: 'B', order: 20, run() {} });
  registerFriendAction({ id: 'a', label: 'A', order: 10, run() {} });
  registerFriendAction({ id: 'hidden', label: 'H', available: () => false, run() {} });
  registerFriendAction({ id: 'later', label: 'L', order: 30, available: () => 'Busy until tomorrow', run() {} });
  assert.deepEqual(friendActions({}, {}).map(a => [a.id, a.state]), [['a', true], ['b', true], ['later', 'Busy until tomorrow']]);
});

test('a broken registrant cannot break the sheet', () => {
  resetSocialRegistry();
  const original = console.error; console.error = () => {};
  try {
    registerFriendAction({ id: 'boom', label: 'Boom', available() { throw new Error('x'); }, run() {} });
    registerPostboxSource({ id: 'bad', load: async () => [], count() { throw new Error('y'); } });
    registerPostboxSource({ id: 'bad-result', load: async () => [], count: () => Symbol('not a count') });
    registerPostboxSource({ id: 'good', load: async () => [], count: () => 2 });
    assert.deepEqual(friendActions({}, {}), []);
    assert.equal(postboxCount({}), 2);
  } finally { console.error = original; }
});

test('registering the same id twice replaces it', () => {
  resetSocialRegistry();
  registerPostboxSource({ id: 'mail', load: async () => [], count: () => 1 });
  registerPostboxSource({ id: 'mail', load: async () => [], count: () => 3 });
  assert.equal(postboxSources().length, 1);
  assert.equal(postboxCount({}), 3);
  registerFriendsSection({ id: 's', where: 'friend', render: () => 'x' });
  assert.equal(friendsSections('friend').length, 1);
  assert.equal(friendsSections('home').length, 0);
});

test('postbox badges count only finite nonnegative whole items', () => {
  resetSocialRegistry();
  for (const [id, count] of Object.entries({ negative: -2, infinite: Infinity, invalid: NaN, partial: 2.7, string: '3' })) {
    registerPostboxSource({ id, count: () => count, load: async () => [] });
  }
  assert.equal(postboxCount({}), 5);
});

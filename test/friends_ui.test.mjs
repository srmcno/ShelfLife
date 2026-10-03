import { test } from 'node:test';
import assert from 'node:assert/strict';
import { friendRow, requestRow, residentCard, friendName, traitNames, collectVerdicts, MOOD_LINES, REPORT_REASONS } from '../src/ui/friends.js';
import { blankState, localDayKey } from '../src/state.js';
import { SUMMONS_DAILY_CAP } from '../src/engine/court.js';
import { readResident, readFriends } from '../src/cloud/social.js';

const ID = '00000000-0000-4000-8000-000000000001';
const dashes = text => text.includes(String.fromCharCode(0x2013)) || text.includes(String.fromCharCode(0x2014));

test('friend rows, requests and resident cards print server text as text', () => {
  const [friend] = readFriends([{ user_id: ID, display_name: '<img src=x onerror=y>', friend_code: 'ABCDEFGH', status: 'accepted', direction: 'incoming' }]);
  for (const html of [friendRow(friend), friendRow(friend, { menu: true, confirm: 'report' }), friendRow(friend, { confirm: 'block' }), friendRow(friend, { confirm: 'remove' }),
    requestRow({ ...friend, status: 'pending' }, { confirm: 'report' })]) {
    assert.doesNotMatch(html, /<img/);
    assert.match(html, /&lt;img src=x onerror=y&gt;/);
    assert.ok(!dashes(html));
  }
  const resident = readResident({ id: 'r1', name: '"><script>x</script>', traits: ['damp'], mood: 'annoyed' });
  const card = residentCard(resident);
  assert.doesNotMatch(card, /<script/);
  assert.match(card, /Annoyed at someone\./);
  assert.match(card, /Perpetually Damp/);
});

test('a request we sent shows the code, never a name', () => {
  const html = requestRow({ userId: ID, name: 'Secret', code: 'ABCDEFGH', status: 'pending', direction: 'outgoing' });
  assert.match(html, /Code ABCD EFGH/);
  assert.doesNotMatch(html, /Secret/);
  assert.equal(friendName({ name: '', code: 'ABCDEFGH' }), 'Code ABCD EFGH');
  assert.equal(traitNames(['damp', 'nope']), 'Perpetually Damp');
});

test('the copy is short and free of em dashes', () => {
  for (const line of [...Object.values(MOOD_LINES), ...REPORT_REASONS]) {
    assert.ok(line.length <= 40, line);
    assert.ok(!dashes(line), line);
  }
});

test('verdicts over the daily cap are saved as owed before the server is told they were seen', async () => {
  const state = blankState();
  state.pets = [{ id: 'p1', name: 'Pip' }];
  const now = new Date(2026, 8, 12, 12).getTime();
  state.courtroom.summonsDay = localDayKey(now);
  state.courtroom.summonsVerdicts = SUMMONS_DAILY_CAP;   // today's verdicts are already paid
  const order = [];
  const social = { seen: id => { order.push('seen:' + id); return Promise.resolve(); } };
  const out = collectVerdicts(state, social, [{ id: 'v-late' }], now, () => order.push('saved'));
  assert.equal(out[0].souls, 0, 'nothing to pay today');
  assert.ok(state.courtroom.summonsOwed.some(x => x.id === 'v-late'), 'but it is written down as owed');
  assert.deepEqual(order, ['saved', 'seen:v-late'], 'and saved before the server forgets it');
  assert.deepEqual(collectVerdicts(state, social, [], now, () => order.push('again')), []);
  assert.ok(!order.includes('again'), 'an empty batch saves nothing');
});

// The markup mischief hands to the Friends sheet, checked without a page:
// friends' names are always escaped, the right controls appear in the right
// states, and every button carries the data-sx the registry routes by.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hexViewHTML, helpViewHTML, knockViewHTML, doorstepHTML, rowHTML, inThinSeason } from '../src/ui/mischief.js';
import { HEX_DECK, BOWLS } from '../src/content/mischief.js';

const EVIL = '<img src=x onerror=alert(1)>';
const friend = { userId: '00000000-0000-4000-8000-0000000000bb', name: EVIL };
const pets = [{ id: 'qa0', name: 'Agnes' }, { id: 'qa1', name: '"><script>' }];
const status = (extra = {}) => ({ hand: HEX_DECK.slice(0, 3).map(h => h.id), hexedToday: false, hauntReady: true, hauntNextAt: 0, helped: [], helpsGiven: 0, knocked: [], season: true, rebounds: [], ...extra });
const count = (html, pattern) => (html.match(pattern) || []).length;
const noRawMarkup = html => { assert.ok(!html.includes('<img src=x') && !html.includes('<script>'), 'escaped: ' + html.slice(0, 200)); };

test('the hand: three cards, the weekly haunting, a culprit, and one send button', () => {
  const html = hexViewHTML({ friend, status: status(), pets });
  noRawMarkup(html);
  assert.equal(count(html, /name="mxCard"/g), 4, 'three hexes and the haunting');
  assert.equal(count(html, /name="mxCulprit"/g), 2);
  assert.equal(count(html, /checked/g), 2, 'a card and a culprit are chosen to start with');
  assert.equal(count(html, /data-sx="send"/g), 1);
  for (const card of HEX_DECK.slice(0, 3)) assert.ok(html.includes(card.name.replace(/“|”/g, '')) || html.includes(card.id));
  assert.ok(html.includes('data-mx-friend="' + friend.userId + '"'));
  assert.ok(!/rebound ready/i.test(html));
});

test('the hand when today’s hex is spent, when a rebound is owed, and when nothing is left', () => {
  const spent = hexViewHTML({ friend, status: status({ hexedToday: true }), pets });
  assert.equal(count(spent, /name="mxCard"/g), 1, 'only the haunting is left');
  assert.match(spent, /Today’s hex has gone/);
  const owed = hexViewHTML({ friend, status: status({ hexedToday: true, rebounds: [{ id: 'r', toUser: friend.userId, card: '' }] }), pets });
  assert.equal(count(owed, /name="mxCard"/g), 4, 'a rebound reopens the hand for this friend');
  assert.match(owed, /Rebound ready/);
  assert.match(owed, /Send it, free/);
  const none = hexViewHTML({ friend, status: status({ hexedToday: true, hauntReady: false, hauntNextAt: Date.UTC(2026, 9, 25) }), pets });
  assert.equal(count(none, /data-sx=/g), 0);
  assert.match(none, /One hex a day/);
  assert.match(hexViewHTML({ friend, status: null, pets }), /Shuffling/);
  assert.match(hexViewHTML({ friend, status: status(), pets: [] }), /needs a culprit/);
});

test('help offers only what a resident lacks, and says so when nobody needs anything', () => {
  const residents = [
    { id: 'r1', name: EVIL, needs: { food: 20, fuss: 90, clean: 40 } },
    { id: 'r2', name: 'Snag', needs: { food: 80, fuss: 80, clean: 80 } },
    { id: 'r3', name: 'Old', needs: null }
  ];
  const html = helpViewHTML({ friend, residents, status: status() });
  noRawMarkup(html);
  assert.equal(count(html, /data-sx="help"/g), 2, 'feed and wash, not fuss');
  assert.ok(html.includes('data-mx-need="food"') && html.includes('data-mx-need="clean"') && !html.includes('data-mx-need="fuss"'));
  assert.ok(!html.includes('Snag'));
  assert.match(helpViewHTML({ friend, residents: [residents[1]], status: status() }), /spotless|showing off|picture/);
  assert.match(helpViewHTML({ friend, residents, status: status({ helped: [friend.userId] }) }), /already|today/);
  assert.match(helpViewHTML({ friend, residents: [residents[2]], status: status() }), /has not said/);
  assert.match(helpViewHTML({ friend, error: 'No connection.' }), /No connection/);
});

test('the door: a knock button, a result, or a polite refusal', () => {
  const html = knockViewHTML({ friend, status: status() });
  noRawMarkup(html);
  assert.equal(count(html, /data-sx="knock"/g), 1);
  assert.match(knockViewHTML({ friend, status: status({ knocked: [friend.userId] }) }), /Twice is a siege/);
  assert.match(knockViewHTML({ friend, status: status(), season: false }), /Thin Season only/);
  const treat = knockViewHTML({ friend, status: status(), result: { kind: 'souls', souls: 14, line: 'Treat. Something in a wrapper, worth 14 souls.', bowl: 'apples' } });
  assert.match(treat, /\+14 souls/);
  assert.match(treat, /Apples, suspiciously heavy/);
  assert.match(knockViewHTML({ friend, status: status(), result: { kind: 'trick', souls: 0, line: 'Trick. It is waiting on your shelf.' } }), /<b>Trick\.<\/b> It is waiting/);
});

test('the doorstep lists knocks and every bowl, and only in season', () => {
  const html = doorstepHTML({ doorstep: { bowl: 'raisins', count: 2, knocks: [{ id: 'k', fromName: EVIL, result: 'trick' }, { id: 'l', fromName: 'Cat', result: 'treat' }] } });
  noRawMarkup(html);
  assert.equal(count(html, /name="mxBowl"/g), BOWLS.length);
  assert.match(html, /value="raisins" checked/);
  assert.match(html, /Two knocks|2 knocks/);
  assert.equal(doorstepHTML({ doorstep: null, season: false }), '');
  assert.equal(typeof inThinSeason(Date.UTC(2026, 9, 20, 12)), 'boolean');
  assert.equal(inThinSeason(new Date(2026, 9, 20, 12).getTime()), true);
  assert.equal(inThinSeason(new Date(2026, 8, 20, 12).getTime()), false);
});

test('postbox rows escape everything and route every button', () => {
  const kinds = { hex: ['play', 'decline', 'block', 'report'], haunt: ['find', 'block', 'report'], result: ['seen'], rebound: ['rebound'], help: ['block', 'report'], knock: ['block', 'report'] };
  for (const [kind, actions] of Object.entries(kinds)) {
    const html = rowHTML({ id: kind + ':1', kind, title: EVIL, line: EVIL });
    noRawMarkup(html);
    assert.deepEqual([...html.matchAll(/data-sx="([a-z-]+)" data-sx-id="([^"]+)"/g)].map(m => [m[1], m[2]]), actions.map(a => [a, kind + ':1']), kind);
  }
});

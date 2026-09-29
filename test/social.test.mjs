import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankState, normalizeState } from '../src/state.js';
import { createCloud } from '../src/cloud/client.js';
import {
  createSocial, readShelf, readFriends, readInbox, readBoard, readPercentile, cleanArt, cleanText, cleanCode,
  shelfSnapshot, residentSnapshot, guestPet, isoDay, socialText, socialCode, MAX_IMAGE_CHARS, MAX_SHELF_CHARS, PUBLISH_GAP_MS
} from '../src/cloud/social.js';
import { generateCreature } from '../src/art/creatures.js';
import { CURIOS } from '../src/content/mayhem.js';
import { createFakeSupabase } from './support/fake-supabase.mjs';

const T0 = Date.UTC(2026, 8, 29, 12);
const png = n => 'data:image/png;base64,' + 'A'.repeat(n);
const ch = (...codes) => String.fromCodePoint(...codes);
function memory() {
  const items = new Map();
  return { getItem: k => items.has(k) ? items.get(k) : null, setItem: (k, v) => { items.set(k, String(v)); }, removeItem: k => { items.delete(k); } };
}
function household(names, customize = () => {}) {
  const s = blankState();
  s.pets = names.map((name, i) => ({ id: 'p' + i, name, traits: ['damp'], needs: { food: 80, fuss: 80, clean: 80 }, bond: 3,
    art: { body: '', stamps: [{ kind: 'eyes', x: 320, y: 300, size: 40, rotation: 0, color: '#F2E9DC' }], creature: generateCreature({ seed: 'c' + i }) } }));
  s.pets.forEach((p, i) => { s.slots[i] = p.id; });
  customize(s);
  return normalizeState(s);
}
// A world of players sharing one fake server and one clock.
function world() {
  let clock = T0;
  const fake = createFakeSupabase({ now: () => clock });
  async function player(name, shelf = household(['Mabel', 'Pip'])) {
    const cloud = createCloud({ config: fake.config, fetch: fake.fetch, storage: memory(), now: () => clock });
    await cloud.signInAnonymously();
    const social = createSocial({ cloud, getState: () => shelf, now: () => clock });
    social.optIn();
    await social.setName(name);
    const me = await social.profile();
    return { cloud, social, shelf, id: cloud.userId(), code: me.code, name };
  }
  return { fake, player, tick: ms => { clock += ms; }, get now() { return clock; } };
}
async function befriend(a, b) {
  await a.social.addFriend(b.code);
  await b.social.respond(a.id, true);
}
const refused = code => err => { assert.equal(socialCode(err), code, err.message); return true; };

test('readers turn hostile shelves into plain, bounded data', () => {
  const huge = png(MAX_IMAGE_CHARS + 10);
  const shelf = readShelf({
    name: ch(0x202e) + 'Ada' + ch(0) + ' the\n\tGreat and Terrible of the Upper Shelf', rank: 999, curios: -4,
    residents: [
      { id: 'a1', name: '<script>alert(1)</script>', traits: ['damp', '__proto__', 'constructor', 'no-such-trait', 7], mood: 'ecstatic', bond: 1e9,
        art: { body: huge, stamps: [{ kind: 'eyes', x: 1e9, y: -5, size: 40, rotation: 'x', color: 'red;background:url(x)' }, { kind: '__proto__', x: 1, y: 1, size: 1 }] } },
      { id: 'a2', name: { toString: () => 'x' }, art: { body: 'data:image/svg+xml;base64,PHN2Zz4=' } },
      { id: 'a3', name: 'Snag', art: { body: 'javascript:alert(1)', stamps: 'lots' } },
      { id: '../../etc', name: 'Bad id' },
      { id: 'a1', name: 'Duplicate' },
      { id: 'a4', name: 'Drawn', art: { body: png(4000), stamps: [], bounds: { x: 0.2, y: 0.1, width: 0.5, height: 7 } } },
      'not an object', null, 12
    ]
  });
  assert.equal(shelf.name, 'Ada the Great and Terrib');
  assert.ok([...shelf.name].every(c => c.codePointAt(0) > 0x1f && c.codePointAt(0) !== 0x202e));
  assert.equal(shelf.rank, 11, 'rank is clamped to a real rank');
  assert.equal(shelf.curios, 0);
  assert.deepEqual(shelf.residents.map(r => r.id), ['a1', 'a2', 'a3', 'a4']);
  const [a1, a2, a3, a4] = shelf.residents;
  assert.equal(a1.name, '<script>alert(1)</scri', 'text is kept as text and clamped; the UI escapes it');
  assert.deepEqual(a1.traits, ['damp']);
  assert.equal(a1.mood, 'fine');
  assert.equal(a1.bond, 25);
  assert.equal(a1.art.body, '', 'a drawing over 120 KB is dropped');
  assert.deepEqual(a1.art.stamps, [{ kind: 'eyes', x: 640, y: 0, size: 40, rotation: 0, color: '#F2E9DC' }]);
  assert.equal(a2.name, 'Someone');
  assert.equal(a2.art, null, 'only PNG data URLs are accepted');
  assert.equal(a3.art, null);
  assert.equal(a4.art.body.length, 4000 + 22);
  assert.deepEqual(a4.art.bounds, { x: 0.2, y: 0.1, width: 0.5, height: 1 });
  for (const bad of [null, 'shelf', [], 5]) assert.equal(readShelf(bad), null);
  assert.deepEqual(readShelf({ residents: 'many' }).residents, []);
});

test('creatures are rebuilt from known parts and colours are data, never markup', () => {
  const art = cleanArt({ creature: { body: 'constructor', palette: '__proto__', seed: '<img src=x>', parts: { eyes: 'toString', mouth: 'grin', top: { evil: 1 } },
    tune: { eyeScale: 99, lean: 'x' }, colors: { body: '"><script>alert(1)</script>', accent: '#ff0000', none: '#000000', __proto__: '#123456' }, rig: 'rigged', anatomy: { can: 'anything' } } });
  const c = art.creature;
  assert.equal(art.body, '');
  assert.deepEqual(art.stamps, []);
  assert.notEqual(c.body, 'constructor');
  assert.notEqual(c.palette, '__proto__');
  assert.equal(c.seed, 'imgsrcx');
  assert.equal(c.parts.eyes, 'pair');
  assert.equal(c.parts.mouth, 'grin');
  assert.equal(c.parts.top, 'none');
  assert.equal(c.tune.eyeScale, 1.4);
  assert.deepEqual(c.colors, { accent: '#ff0000' });
  assert.ok(c.anatomy && c.rig && typeof c.rig === 'object', 'anatomy and rig are derived here, not taken from the server');
  assert.equal(cleanArt({ creature: 'a string' }), null);
  assert.equal(cleanArt('art'), null);
});

test('names lose control characters, bidi overrides and zero-width marks', () => {
  assert.equal(cleanText('  Pip' + ch(0x200b, 0x200d, 0x2066) + ' the' + ch(7) + ' Lesser  ', 24), 'Pip the Lesser');
  assert.equal(cleanText(42), '');
  assert.equal(cleanText(ch(0x1f600).repeat(30), 24), ch(0x1f600).repeat(24), 'clamped by character, never mid-emoji');
  assert.equal(cleanCode(' abcd-efgh '), 'ABCDEFGH');
  assert.equal(cleanCode('ABCDEFG0'), '', 'no zeros, ones, I, L or O in a friend code');
});

test('friend lists, inboxes and boards drop anything malformed', () => {
  const ok = '00000000-0000-4000-8000-000000000001', other = '00000000-0000-4000-8000-000000000002';
  const friends = readFriends([
    { user_id: ok, display_name: 'Ada', friend_code: 'ABCDEFGH', status: 'accepted', direction: 'outgoing', shelf_updated_at: '2026-09-28T10:00:00Z' },
    { user_id: other, display_name: 'Should not show', friend_code: 'HGFEDCBA', status: 'pending', direction: 'outgoing' },
    { user_id: ok, display_name: 'Twice', status: 'accepted', direction: 'incoming' },
    { user_id: 'not-a-uuid', status: 'accepted', direction: 'incoming' },
    { user_id: other.replace('2', '3'), status: 'blocked', direction: 'incoming' }
  ]);
  assert.equal(friends.length, 2);
  assert.equal(friends[0].name, 'Ada');
  assert.equal(friends[0].shelfAt, Date.parse('2026-09-28T10:00:00Z'));
  assert.equal(friends[1].name, '', 'a request we sent does not show their name');
  const box = readInbox({
    cases: [
      { id: ok, from_user: other, from_name: 'Ada', case_id: 'borrowed-coffin', plaintiff: { id: 'm1', name: 'Mabel', art: { body: png(10) } }, defendant: { id: 'p1', name: 'Pip', art: { body: png(10) } } },
      { id: other, from_user: ok, case_id: 'DROP TABLE', plaintiff: { id: 'm1' }, defendant: { id: 'p1' } },
      { id: 'x', from_user: ok, case_id: 'borrowed-coffin', plaintiff: { id: 'm1' }, defendant: { id: 'p1' } }
    ],
    results: [
      { id: other, to_user: ok, to_name: 'Bea', case_id: 'tontine', verdict: 'both', stars: 9, ratings: -3, plaintiff: { id: 'm1', name: 'Mabel' }, defendant: null },
      { id: ok, to_user: ok, case_id: 'tontine', verdict: 'guilty' }
    ]
  });
  assert.equal(box.cases.length, 1);
  assert.equal(box.cases[0].defendant.art, null, 'a defendant never brings art: it already lives here');
  assert.equal(box.cases[0].plaintiff.art.body.length, 32);
  assert.deepEqual(box.results.map(r => [r.verdict, r.stars, r.ratings, r.defendant.name]), [['both', 3, 0, 'Someone']]);
  assert.deepEqual(readInbox('nonsense'), { cases: [], results: [] });
  const board = readBoard([{ user_id: ok, display_name: 'Ada', score: 12, rank: 1, me: true }, { user_id: other, score: 501, rank: 1 }, { user_id: other, score: 'lots' }], 'stack');
  assert.deepEqual(board, [{ userId: ok, name: 'Ada', score: 12, rank: 1, me: true }]);
  assert.deepEqual(readPercentile({ players: 12, beaten_percent: 64, top_score: 40, names: ['Ada'] }, 'stack'), { players: 12, beaten: 64, top: 40 });
  assert.deepEqual(readPercentile({ players: 'x', beaten_percent: null, top_score: 99999 }, 'stack'), { players: 0, beaten: null, top: null });
});

test('a shelf snapshot keeps 18 residents and as many drawings as fit', () => {
  const s = household(Array.from({ length: 18 }, (_, i) => 'R' + i), state => {
    state.pets.forEach((p, i) => { if (i < 6) p.art = { body: png(110000 + i), stamps: [{ kind: 'eyes', x: 1, y: 2, size: 3 }] }; });
    state.mayhem.lifetime = 600;
    state.mayhem.curios = { [CURIOS[0].id]: 1, [CURIOS[1].id]: 0, [CURIOS[2].id]: 3 };
  });
  const snap = shelfSnapshot(s, { name: 'Ada' });
  assert.equal(snap.residents.length, 18);
  assert.equal(snap.rank, 4);
  assert.equal(snap.curios, 2);
  const drawn = snap.residents.filter(r => r.art.body);
  assert.equal(drawn.length, 3, 'three drawings fit under the shelf limit; the rest keep their stamps');
  assert.ok(snap.residents.slice(3, 6).every(r => r.art.body === '' && r.art.stamps.length === 1));
  assert.ok(JSON.stringify(snap).length <= MAX_SHELF_CHARS);
  const creature = snap.residents[10].art.creature;
  assert.ok(creature.parts && !creature.rig && !creature.anatomy, 'creatures travel as choices only');
  assert.deepEqual(readShelf(snap).residents.map(r => r.name), snap.residents.map(r => r.name), 'a snapshot reads back cleanly');
  const tooBig = residentSnapshot({ id: 'x', name: 'Big', art: { body: png(MAX_IMAGE_CHARS), stamps: [] } });
  assert.equal(tooBig.art.body, '', 'a single drawing over 120 KB never leaves');
});

test('a guest resident can be drawn and seated but is never mistaken for one of ours', () => {
  const g = guestPet({ id: 'p1', name: 'Mabel', traits: ['damp'], mood: 'furious', bond: 4, art: { creature: generateCreature({ seed: 'm' }) } });
  assert.equal(g.id, 'guest-p1');
  assert.equal(g.sourceId, 'p1');
  assert.equal(g.guest, true);
  assert.equal(g.artMissing, false);
  assert.ok(g.art.creature && Array.isArray(g.art.stamps));
  assert.deepEqual(g.needs, { food: 14, fuss: 14, clean: 14 });
  const bare = guestPet({ id: 'p2', name: 'Faceless', art: { body: 'https://evil.example/x.png' } });
  assert.equal(bare.artMissing, true);
  assert.deepEqual(bare.art, { body: '', stamps: [] });
  assert.equal(guestPet({ id: '<b>', name: 'x' }), null);
  assert.equal(guestPet('Mabel'), null);
});

test('day keys count months from zero; the server gets a calendar date', () => {
  assert.equal(isoDay('2026-8-29'), '2026-09-29');
  assert.equal(isoDay('2026-11-31'), '2026-12-31');
  assert.equal(isoDay('2026-0-1'), '2026-01-01');
  assert.equal(isoDay('yesterday'), '');
});

test('friends: ask, accept, see names only once accepted, and refuse the silly cases', async () => {
  const w = world();
  const [ada, bea, cat] = [await w.player('Ada'), await w.player('Bea'), await w.player('Cat')];
  const asked = await ada.social.addFriend(bea.code.toLowerCase().replace(/(....)/, '$1-'));
  assert.deepEqual(asked, { status: 'pending', userId: bea.id, code: bea.code, name: '' });
  assert.deepEqual((await ada.social.friends()).map(f => [f.name, f.status, f.direction]), [['', 'pending', 'outgoing']]);
  assert.deepEqual((await bea.social.friends()).map(f => [f.name, f.status, f.direction]), [['Ada', 'pending', 'incoming']]);
  await assert.rejects(ada.social.addFriend(bea.code), refused('already_asked'));
  await assert.rejects(ada.social.addFriend(ada.code), refused('self'));
  await assert.rejects(ada.social.addFriend('NOPE'), refused('bad_code'));
  await assert.rejects(ada.social.addFriend('ZZZZZZZZ'), refused('not_found'));
  await bea.social.respond(ada.id, true);
  assert.deepEqual((await ada.social.friends()).map(f => [f.name, f.status]), [['Bea', 'accepted']]);
  await assert.rejects(bea.social.addFriend(ada.code), refused('already_friends'));
  // Asking someone who already asked you is a yes.
  await cat.social.addFriend(ada.code);
  const back = await ada.social.addFriend(cat.code);
  assert.deepEqual([back.status, back.name], ['accepted', 'Cat']);
  // Declining leaves no trace; removing works either way round.
  const dan = await w.player('Dan');
  await dan.social.addFriend(ada.code);
  await ada.social.respond(dan.id, false);
  assert.deepEqual((await dan.social.friends()), []);
  await bea.social.remove(ada.id);
  assert.deepEqual((await ada.social.friends()).map(f => f.name), ['Cat']);
});

test('blocking and reporting', async () => {
  const w = world();
  const [ada, bea] = [await w.player('Ada'), await w.player('Bea')];
  await befriend(ada, bea);
  await bea.social.publish({ force: true });
  await ada.social.block(bea.id);
  assert.deepEqual(await ada.social.friends(), []);
  await assert.rejects(bea.social.addFriend(ada.code), refused('not_found'), 'a block looks like a code that does not exist');
  await assert.rejects(ada.social.addFriend(bea.code), refused('blocked'));
  await assert.rejects(ada.social.shelf(bea.id), refused('not_friends'));
  await ada.social.report(bea.id, 'x'.repeat(500));
  const [filed] = w.fake.social.reports;
  assert.equal(filed.reason.length, 200);
  assert.equal(filed.evidence.display_name, 'Bea');
  assert.equal(filed.evidence.shelf.residents.length, 2, 'what the reporter could see is kept with the report');
  await assert.rejects(ada.social.report(ada.id, 'me'), refused('self'));
  await assert.rejects(ada.social.block('not-a-user'), refused('not_found'));
});

test('adding friends is rate limited to 20 attempts an hour, wrong codes included', async () => {
  const w = world();
  const [ada, bea] = [await w.player('Ada'), await w.player('Bea')];
  for (let i = 0; i < 20; i++) await assert.rejects(ada.social.addFriend('ZZZZZZZZ'), refused('not_found'));
  await assert.rejects(ada.social.addFriend(bea.code), refused('rate_limited'));
  w.tick(3600001);
  assert.equal((await ada.social.addFriend(bea.code)).status, 'pending');
});

test('two players serve, hear and learn the outcome of a summons', async () => {
  const w = world();
  const ada = await w.player('Ada', household(['Mabel', 'Gladys'], s => { s.pets[0].art = { body: png(3000), stamps: [] }; }));
  const bea = await w.player('Bea', household(['Pip', 'Snag']));
  const cat = await w.player('Cat');
  await befriend(ada, bea);
  await bea.social.publish({ force: true });
  const visit = await ada.social.shelf(bea.id);
  assert.equal(visit.name, 'Bea');
  assert.deepEqual(visit.shelf.residents.map(r => r.name), ['Pip', 'Snag']);
  await assert.rejects(cat.social.shelf(bea.id), refused('not_friends'), 'a stranger cannot look at a shelf');
  const pip = visit.shelf.residents[0];
  const { id } = await ada.social.serve({ to: bea.id, caseId: 'borrowed-coffin', plaintiff: ada.shelf.pets[0], defendant: pip });
  assert.ok(id);
  const sent = w.fake.social.summons.get(id);
  assert.equal(sent.defendant.art, undefined, 'the defendant goes back without its art');
  assert.equal(sent.plaintiff.art.body.length, 3022);
  await assert.rejects(cat.social.serve({ to: bea.id, caseId: 'borrowed-coffin', plaintiff: cat.shelf.pets[0], defendant: pip }), refused('not_friends'));
  await assert.rejects(ada.social.serve({ to: bea.id, caseId: 'Not A Case', plaintiff: ada.shelf.pets[0], defendant: pip }), refused('bad_case'));

  const box = await bea.social.inbox();
  assert.equal(box.cases.length, 1);
  const [c] = box.cases;
  assert.deepEqual([c.fromName, c.caseId, c.plaintiff.name, c.defendant.name, c.defendant.id], ['Ada', 'borrowed-coffin', 'Mabel', 'Pip', pip.id]);
  assert.equal(guestPet(c.plaintiff).art.body.length, 3022);
  assert.equal(bea.social.inboxCount(), 1);
  await assert.rejects(cat.social.rule(id, { verdict: 'both', stars: 3, ratings: 100 }), refused('not_found'), 'nobody else can rule on it');
  await assert.rejects(ada.social.rule(id, { verdict: 'both', stars: 3, ratings: 100 }), refused('not_found'), 'not even the sender');
  await bea.social.rule(id, { verdict: 'defendant', stars: 2.7, ratings: 180 });
  await assert.rejects(bea.social.rule(id, { verdict: 'both', stars: 1, ratings: 1 }), refused('not_open'));
  assert.deepEqual((await bea.social.inbox()).cases, []);

  const results = (await ada.social.inbox()).results;
  assert.deepEqual(results.map(r => [r.toName, r.verdict, r.stars, r.ratings, r.plaintiff.name, r.defendant.name]), [['Bea', 'defendant', 2, 100, 'Mabel', 'Pip']]);
  assert.equal(await ada.social.seen(results[0].id), true);
  assert.equal(await ada.social.seen(results[0].id), false, 'seen once only');
  assert.deepEqual((await ada.social.inbox()).results, []);
  assert.equal(ada.social.inboxCount(), 0);
});

test('five open summonses per pair, and declining clears one', async () => {
  const w = world();
  const [ada, bea] = [await w.player('Ada'), await w.player('Bea')];
  await befriend(ada, bea);
  const papers = () => ada.social.serve({ to: bea.id, caseId: 'tontine', plaintiff: ada.shelf.pets[0], defendant: { id: 'p0', name: 'Mabel' } });
  const ids = [];
  for (let i = 0; i < 5; i++) ids.push((await papers()).id);
  await assert.rejects(papers(), refused('too_many_open'));
  await bea.social.decline(ids[0]);
  assert.ok((await papers()).id);
  // Removing a friend withdraws what is still waiting.
  await ada.social.remove(bea.id);
  assert.deepEqual((await bea.social.inbox()).cases, []);
});

test('daily scores keep the best, refuse nonsense and show strangers only as numbers', async () => {
  const w = world();
  const [ada, bea, cat, dan] = [await w.player('Ada'), await w.player('Bea'), await w.player('Cat'), await w.player('Dan')];
  await befriend(ada, bea);
  const day = '2026-8-29';
  assert.deepEqual(await ada.social.submitScore({ game: 'stack', day, score: 12, mod: 'slim' }), { best: 12 });
  assert.deepEqual(await ada.social.submitScore({ game: 'stack', day, score: 7, mod: 'slim' }), { best: 12 });
  await bea.social.submitScore({ game: 'stack', day, score: 20, mod: 'slim' });
  await cat.social.submitScore({ game: 'stack', day, score: 3, mod: 'slim' });
  await dan.social.submitScore({ game: 'stack', day, score: 9, mod: 'slim' });
  await assert.rejects(ada.social.submitScore({ game: 'stack', day, score: 501 }), refused('bad_score'));
  await assert.rejects(ada.social.submitScore({ game: 'poker', day, score: 1 }), refused('bad_score'));
  await assert.rejects(ada.social.submitScore({ game: 'stack', day: '2026-8-20', score: 1 }), refused('bad_day'), 'a day long gone');
  // Even a client that skips its own checks meets the same caps on the server.
  await assert.rejects(ada.cloud.rpc('submit_score', { p_game: 'whack', p_day: '2026-09-29', p_score: 2501, p_mod: '' }), err => err.message === 'bad_score');
  const board = await ada.social.board('stack', day);
  assert.deepEqual(board.map(r => [r.name, r.score, r.rank, r.me]), [['Bea', 20, 1, false], ['Ada', 12, 2, true]]);
  assert.ok(board.every(r => r.userId !== cat.id && r.userId !== dan.id), 'strangers never appear by name');
  const place = await ada.social.percentile('stack', day);
  assert.deepEqual(place, { players: 4, beaten: 66, top: 20 });
  const raw = await ada.cloud.rpc('day_percentile', { p_game: 'stack', p_day: '2026-09-29' });
  assert.deepEqual(Object.keys(raw).sort(), ['beaten_percent', 'players', 'top_score']);
});

test('the shelf is published on opening Friends and after a cloud push, at most every ten minutes', async () => {
  const w = world();
  const ada = await w.player('Ada');
  const publishes = () => w.fake.calls('publish_shelf').length;
  assert.equal(await ada.social.publish(), true);
  assert.equal(await ada.social.publish({ force: true }), false, 'an unchanged shelf is not sent again');
  ada.shelf.pets[0].name = 'Mabel the Second';
  assert.equal(await ada.social.publish(), false, 'within ten minutes');
  assert.equal(await ada.social.publish({ force: true }), true, 'opening Friends always shows the latest');
  ada.shelf.pets[0].name = 'Mabel the Third';
  ada.social.syncStatus({ status: 'syncing' });
  ada.social.syncStatus({ status: 'idle' });
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(publishes(), 2, 'a push inside ten minutes does not publish');
  w.tick(PUBLISH_GAP_MS);
  ada.social.syncStatus({ status: 'idle' });
  assert.equal(publishes(), 2, 'only the step from syncing to idle counts');
  ada.social.syncStatus({ status: 'syncing' });
  ada.social.syncStatus({ status: 'idle' });
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(publishes(), 3);
  assert.equal(w.fake.social.shelves.get(ada.id).snapshot.residents[0].name, 'Mabel the Third');
});

test('nothing social is sent before the player opts in, or without cloud save at all', async () => {
  const w = world();
  const cloud = createCloud({ config: w.fake.config, fetch: w.fake.fetch, storage: memory(), now: () => w.now });
  await cloud.signInAnonymously();
  const social = createSocial({ cloud, getState: () => household(['Mabel']), now: () => w.now });
  const before = w.fake.requests.length;
  assert.equal(social.active(), false);
  assert.equal(await social.publish({ force: true }), false);
  social.syncStatus({ status: 'syncing' });
  social.syncStatus({ status: 'idle' });
  assert.equal(w.fake.requests.length, before);
  assert.equal(social.optIn(), true);

  let calls = 0;
  const off = createCloud({ config: { url: '', anonKey: '' }, fetch: () => { calls++; throw new Error('no'); }, storage: memory() });
  const inert = createSocial({ cloud: off, getState: () => household(['Mabel']) });
  assert.equal(inert.optIn(), false);
  assert.equal(await inert.publish({ force: true }), false);
  await assert.rejects(inert.friends(), refused('signed_out'));
  await assert.rejects(inert.inbox(), refused('signed_out'));
  assert.equal(calls, 0);
});

test('refusals read as short, plain sentences without em dashes', () => {
  for (const code of ['bad_code', 'not_found', 'self', 'blocked', 'already_friends', 'already_asked', 'rate_limited', 'not_friends', 'too_many_open',
    'not_open', 'too_large', 'bad_score', 'bad_day', 'bad_case', 'signed_out', 'mystery']) {
    const line = socialText({ code });
    assert.ok(line && line.length <= 80, line);
    assert.ok(!line.includes(ch(0x2013)) && !line.includes(ch(0x2014)), line);
  }
  assert.equal(socialText({ code: 'P0001', message: 'too_many_open' }), socialText({ code: 'too_many_open' }));
  assert.equal(socialCode({ code: '23514' }), 'too_large');
  assert.equal(socialCode({ offline: true, code: 'offline' }), 'offline');
  assert.match(socialText({ code: 'bad_day' }), /score was refused/);
});

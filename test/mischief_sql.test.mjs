// The mischief migration (0007) against a real Postgres (PGlite), on top of
// 0001 and 0002 only, loaded twice to prove it is idempotent. The clock is
// private.mischief_now(); these tests replace it to travel in time.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { HEX_IDS, TRICK_IDS, BOWLS } from '../src/content/mischief.js';
import { hexHand, mischiefRoll } from './support/fake-mischief.mjs';

const read = name => readFileSync(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8');
const ACCOUNTS = read('0001_accounts_and_saves.sql'), SOCIAL = read('0002_social.sql'), MISCHIEF = read('0007_mischief.sql');
const ids = 'abcdef12'.split('').map(x => '00000000-0000-4000-8000-00000000000' + x);
const [A, B, C, D, E, F, G, H] = ids;
const BOOTSTRAP = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, is_anonymous boolean not null default false, created_at timestamptz default now());
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  insert into auth.users (id) values ${ids.map(id => `('${id}')`).join(', ')};
`;
const TABLES = ['doorsteps', 'hauntings', 'helps', 'hexes', 'knocks'];
const RPCS = ['ack_helps', 'decline_hex', 'help_out', 'knock', 'mark_mischief_seen', 'mischief_inbox', 'resolve_hex', 'send_haunt', 'send_hex', 'set_bowl', 'shoo_haunt'];
const NOW = '2026-10-20T12:00:00Z';

let db;
const code = {};
before(async () => {
  db = new PGlite();
  await db.exec(BOOTSTRAP);
  for (let i = 0; i < 2; i++) { await db.exec(ACCOUNTS); await db.exec(SOCIAL); await db.exec(MISCHIEF); }
  for (const [id, name] of [[A, 'Ada'], [B, 'Bea'], [C, 'Cat'], [D, 'Dan'], [E, 'Eve'], [F, 'Fay'], [G, 'Gus'], [H, 'Hal']]) {
    code[id] = (await as(id, () => value('select public.ensure_profile($1)', [name]))).friend_code;
  }
  await at(NOW);
  // Ada's circle: Bea, Cat, Dan, Fay, Gus and Hal. Bea and Cat are friends too. Eve is nobody's friend.
  for (const [x, y] of [[A, B], [A, C], [A, D], [A, F], [A, G], [A, H], [B, C], [C, D], [D, B], [F, B], [G, B], [H, B]]) await friends(x, y);
  for (const id of ids) await call(id, 'public.publish_shelf($1::jsonb)', [shelf(id)]);
});

async function as(sub, work, role = 'authenticated') {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [sub || '']);
  await db.exec('set role ' + role);
  try { return await work(); }
  finally {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}
const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const value = async (sql, params) => Object.values(await one(sql, params))[0];
const call = (who, sql, params) => as(who, () => value('select ' + sql, params));
const rejects = (promise, pattern) => assert.rejects(promise, err => pattern.test(err.message) || pattern.test(err.code || ''));
async function friends(x, y) {
  await call(x, 'public.add_friend($1)', [code[y]]);
  assert.equal((await call(y, 'public.add_friend($1)', [code[x]])).status, 'accepted');
}
// Each player's shelf: three residents, the first one hungry.
function shelf(id, needs = { food: 30, fuss: 80, clean: 40 }) {
  const tag = id.slice(-1);
  return JSON.stringify({ v: 1, name: '', rank: 0, curios: 0, residents: [0, 1, 2].map(i => ({
    id: tag + 'r' + i, name: tag.toUpperCase() + ' resident ' + i, traits: [], mood: 'fine', bond: 3,
    art: { body: '', stamps: [] }, needs: i === 0 ? needs : { food: 90, fuss: 90, clean: 90 } })) });
}
const res = (id, i = 0) => id.slice(-1) + 'r' + i;
// Moves the server clock. Every function reads it through private.mischief_now().
async function at(iso) {
  await db.exec(`create or replace function private.mischief_now() returns timestamptz language sql stable set search_path = public as $$ select '${iso}'::timestamptz $$`);
}
const inbox = who => call(who, 'public.mischief_inbox()');
const hand = async who => (await inbox(who)).status.hand;
const sendHex = (from, to, card, culprit = res(from), rebound = null) =>
  call(from, 'public.send_hex($1, $2, $3, $4)', [to, card, culprit, rebound]);
// The same roll as private.mischief_roll.
const roll = seed => parseInt(createHash('md5').update(seed).digest('hex').slice(0, 7), 16);

test('the migration loads twice on 0001 and 0002 alone and locks everything down', async () => {
  const rls = (await db.query(`select c.relname, c.relrowsecurity from pg_class c where c.relkind = 'r' and c.relnamespace = 'public'::regnamespace and c.relname = any($1)`, [TABLES])).rows;
  assert.deepEqual(rls.map(r => r.relname).sort(), TABLES);
  assert.ok(rls.every(r => r.relrowsecurity), 'row level security on every new table');
  const policies = (await db.query("select tablename, count(*)::int as n from pg_policies where schemaname = 'public' and tablename = any($1) group by tablename order by tablename", [TABLES])).rows;
  assert.deepEqual(policies, TABLES.map(tablename => ({ tablename, n: 1 })), 'one policy each after two runs');
  for (const table of TABLES) for (const privilege of ['select', 'insert', 'update', 'delete']) {
    for (const role of ['anon', 'authenticated']) assert.equal(await value('select has_table_privilege($1, $2, $3)', [role, 'public.' + table, privilege]), false, role + ' ' + privilege + ' ' + table);
  }
  const functions = (await db.query("select p.proname, p.prosecdef, p.proconfig from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = any($1)", [RPCS])).rows;
  assert.deepEqual(functions.map(f => f.proname).sort(), RPCS, 'each function exists once');
  for (const f of functions) {
    assert.equal(f.prosecdef, true, f.proname + ' is security definer');
    assert.deepEqual(f.proconfig, ['search_path=public'], f.proname + ' pins its search_path');
    assert.equal(await value('select has_function_privilege($1, $2, $3)', ['anon', (await value("select oid::regprocedure::text from pg_proc where proname = $1", [f.proname])), 'execute']), false, 'anon cannot call ' + f.proname);
  }
  const helpers = (await db.query("select p.proname, p.proconfig from pg_proc p where p.pronamespace = 'private'::regnamespace and p.proname like any (array['mischief%', 'hex_%', 'trick_%', 'bowl_%', 'shelf_resident'])")).rows;
  assert.ok(helpers.length >= 14);
  for (const f of helpers) assert.deepEqual(f.proconfig, ['search_path=public'], f.proname + ' pins its search_path');
  await as(A, async () => {
    await rejects(db.query('select private.hex_deck()'), /permission denied/);
    await rejects(db.query(`insert into public.hexes (from_user, to_user, card, culprit, day, expires_at) values ('${A}', '${B}', 'sock-of-ill-omen', '{}', current_date, now())`), /permission denied/);
    await rejects(db.query('select * from public.helps'), /permission denied/);
  });
  await as('', () => rejects(db.query('select public.mischief_inbox()'), /permission denied/), 'anon');
  await as('', () => rejects(db.query('select public.mischief_inbox()'), /sign in first|28000/));
});

test('the decks match the game, and the server deals three different cards a day', async () => {
  assert.deepEqual(await value('select private.hex_deck()'), HEX_IDS, 'hex ids in the same order as content/mischief.js');
  assert.deepEqual(await value('select private.trick_deck()'), TRICK_IDS);
  for (const b of BOWLS) assert.deepEqual(await value('select private.bowl_odds($1)', [b.id]), [b.treat, b.curio, b.lo, b.hi], b.id);
  assert.equal(await value("select private.bowl_odds('caviar')"), null);
  const today = await hand(A);
  assert.equal(today.length, 3);
  assert.equal(new Set(today).size, 3);
  assert.ok(today.every(c => HEX_IDS.includes(c)));
  assert.deepEqual(await hand(A), today, 'the same hand all day');
  assert.notDeepEqual(await hand(B), today, 'each player has their own hand');
  const days = new Set();
  for (let i = 1; i <= 5; i++) { await at(`2026-10-${20 + i}T12:00:00Z`); days.add((await hand(A)).join()); }
  await at(NOW);
  assert.ok(days.size >= 4, 'tomorrow brings another hand');
});

test('one hex a day, from the hand, starring a resident from the sender’s own shelf', async () => {
  await at('2026-10-02T09:00:00Z');
  const cards = await hand(F);
  const other = HEX_IDS.find(c => !cards.includes(c));
  await rejects(sendHex(F, E, cards[0]), /not_friends/);
  await rejects(sendHex(F, B, 'no-such-hex'), /bad_card/);
  await rejects(sendHex(F, B, other), /not_in_hand/);
  await rejects(sendHex(F, B, cards[0], 'nobody-here'), /bad_culprit/);
  await rejects(sendHex(F, B, cards[0], res(B)), /bad_culprit/, 'only your own residents');
  const sent = await sendHex(F, B, cards[0]);
  assert.equal(sent.ok, true);
  await rejects(sendHex(F, A, cards[1]), /hexed_today/, 'one a day in total, not per friend');
  const row = await one('select card, culprit, day::text, expires_at - created_at as life from public.hexes where id = $1', [sent.id]);
  assert.equal(row.card, cards[0]);
  assert.equal(row.culprit.name, 'F resident 0', 'the culprit is copied from the published shelf');
  assert.equal(row.day, '2026-10-02');
  assert.equal(row.life.hours ?? 48, 48);
  await at('2026-10-03T09:00:00Z');
  assert.equal((await sendHex(F, A, (await hand(F))[0])).ok, true, 'tomorrow is another day');
  await at(NOW);
});

test('at most two hexes wait on a shelf, and expired ones stop counting', async () => {
  await at('2026-10-04T10:00:00Z');
  await db.exec(`delete from public.hexes where to_user = '${B}'`);
  assert.equal((await sendHex(G, B, (await hand(G))[0])).ok, true);
  assert.equal((await sendHex(H, B, (await hand(H))[0])).ok, true);
  await rejects(sendHex(D, B, (await hand(D))[0]), /shelf_full/);
  assert.equal((await inbox(B)).hexes.length, 2);
  await at('2026-10-06T11:00:00Z');
  assert.equal((await inbox(B)).hexes.length, 0, 'gone after 48 hours');
  assert.equal((await sendHex(D, B, (await hand(D))[0])).ok, true, 'expired hexes leave room');
  const results = (await inbox(G)).results;
  assert.deepEqual(results.map(r => [r.to_name, r.status]), [['Bea', 'expired']], 'the sender hears it expired');
  await at(NOW);
});

test('the victim plays it once; the sender reads how it went', async () => {
  await at('2026-10-08T08:00:00Z');
  await db.exec(`delete from public.hexes where to_user = '${C}'`);
  const card = (await hand(A))[0];
  const { id } = await sendHex(A, C, card);
  const box = await inbox(C);
  assert.equal(box.hexes.length, 1);
  assert.deepEqual([box.hexes[0].id, box.hexes[0].from_name, box.hexes[0].card, box.hexes[0].culprit.name, box.hexes[0].rebound], [id, 'Ada', card, 'A resident 0', false]);
  await rejects(call(B, 'public.resolve_hex($1, 0, 1, false)', [id]), /not_found/, 'only the victim');
  await rejects(call(A, 'public.resolve_hex($1, 0, 1, false)', [id]), /not_found/, 'not the sender either');
  await rejects(call(C, 'public.resolve_hex($1, 4, 1, false)', [id]), /bad_hex/);
  await rejects(call(C, 'public.resolve_hex($1, 0, -1, false)', [id]), /bad_hex/);
  assert.deepEqual(await call(C, 'public.resolve_hex($1, 1, 0, false)', [id]), { ok: true });
  await rejects(call(C, 'public.resolve_hex($1, 1, 1, true)', [id]), /not_open/, 'played once');
  await rejects(call(C, 'public.decline_hex($1)', [id]), /not_open/);
  assert.equal((await inbox(C)).hexes.length, 0);
  const results = (await inbox(A)).results.filter(r => r.id === id);
  assert.deepEqual(results.map(r => [r.to_name, r.card, r.culprit_name, r.status, r.choice, r.outcome, r.rebound]), [['Cat', card, 'A resident 0', 'resolved', 1, 0, false]]);
  assert.deepEqual(await call(B, "public.mark_mischief_seen('hex', $1)", [id]), { ok: false }, 'only the sender marks it read');
  assert.deepEqual(await call(A, "public.mark_mischief_seen('hex', $1)", [id]), { ok: true });
  assert.deepEqual(await call(A, "public.mark_mischief_seen('hex', $1)", [id]), { ok: false });
  await rejects(call(A, "public.mark_mischief_seen('gift', $1)", [id]), /bad_kind/);
  assert.equal((await inbox(A)).results.filter(r => r.id === id).length, 0);
  await at(NOW);
});

test('a hex can be declined, and an expired one can be neither played nor declined', async () => {
  await at('2026-10-09T08:00:00Z');
  await db.exec(`delete from public.hexes where to_user = '${C}'`);
  const first = await sendHex(A, C, (await hand(A))[0]);
  const second = await sendHex(B, C, (await hand(B))[0]);
  await rejects(call(A, 'public.decline_hex($1)', [first.id]), /not_found/);
  assert.deepEqual(await call(C, 'public.decline_hex($1)', [first.id]), { ok: true });
  assert.equal((await inbox(A)).results.find(r => r.id === first.id).status, 'declined');
  await at('2026-10-11T08:30:00Z');
  await rejects(call(C, 'public.resolve_hex($1, 0, 0, false)', [second.id]), /expired/);
  await rejects(call(C, 'public.decline_hex($1)', [second.id]), /expired/);
  await at(NOW);
});

test('a rebound buys one free counter-hex, back to the sender, within two days', async () => {
  await at('2026-10-12T08:00:00Z');
  await db.exec(`delete from public.hexes where '${D}' in (from_user, to_user)`);
  const { id } = await sendHex(A, D, (await hand(A))[0]);
  assert.equal((await sendHex(D, C, (await hand(D))[0])).ok, true, 'Dan has used today’s hex on Cat');
  await rejects(sendHex(D, A, HEX_IDS[5], res(D), id), /no_rebound/, 'not before it rebounded');
  await call(D, 'public.resolve_hex($1, 0, 1, true)', [id]);
  const rebounds = (await inbox(D)).status.rebounds;
  assert.deepEqual(rebounds.map(r => [r.id, r.to_user]), [[id, A]]);
  await rejects(sendHex(D, B, HEX_IDS[5], res(D), id), /no_rebound/, 'only back to the sender');
  await rejects(sendHex(B, A, HEX_IDS[5], res(B), id), /no_rebound/, 'only by the victim');
  const back = await sendHex(D, A, HEX_IDS[5], res(D), id);
  assert.equal(back.ok, true, 'free, though today’s hex is spent, and any card');
  assert.equal((await inbox(A)).hexes.find(h => h.id === back.id).rebound, true);
  await rejects(sendHex(D, A, HEX_IDS[6], res(D), id), /no_rebound/, 'once');
  assert.deepEqual((await inbox(D)).status.rebounds, []);
  // A rebound left too long goes stale.
  await at('2026-10-13T08:00:00Z');
  const late = await sendHex(A, D, (await hand(A))[0]);
  await call(D, 'public.resolve_hex($1, 0, 1, true)', [late.id]);
  await at('2026-10-15T09:00:00Z');
  await rejects(sendHex(D, A, HEX_IDS[7], res(D), late.id), /no_rebound/);
  await at(NOW);
});

test('Do not disturb is respected when the postbox migration provides it', async () => {
  await at('2026-10-21T08:00:00Z');
  await db.exec(`create table if not exists public.test_dnd (user_id uuid primary key);
    create or replace function private.dnd_on(p_user uuid) returns boolean language sql stable as $$ select exists (select 1 from public.test_dnd where user_id = p_user) $$;
    insert into public.test_dnd values ('${B}');`);
  try {
    await rejects(sendHex(A, B, (await hand(A))[0]), /dnd/);
    await rejects(call(A, 'public.send_haunt($1, $2)', [B, res(A)]), /dnd/);
    await rejects(call(A, 'public.help_out($1, $2, $3)', [B, res(B), 'food']), /dnd/);
    await rejects(call(A, 'public.knock($1)', [B]), /dnd/);
    assert.equal((await sendHex(B, A, (await hand(B))[0])).ok, true, 'it only stops what lands on their own shelf');
  } finally {
    await db.exec('drop function private.dnd_on(uuid); drop table public.test_dnd;');
    await db.exec(`delete from public.hexes where from_user = '${B}' and to_user = '${A}'`);
  }
  await at(NOW);
});

test('friendship levels are bumped through bump_friendship when it exists', async () => {
  await at('2026-10-22T08:00:00Z');
  await db.exec(`create table if not exists public.test_bumps (a uuid, b uuid, kind text);
    create or replace function private.bump_friendship(a uuid, b uuid, p_kind text) returns int language sql as $$ insert into public.test_bumps values (a, b, p_kind) returning 1 $$;`);
  try {
    await db.exec(`delete from public.hexes where to_user = '${C}'`);
    const { id } = await sendHex(B, C, (await hand(B))[0]);
    await call(C, 'public.resolve_hex($1, 0, 0, false)', [id]);
    assert.deepEqual((await db.query('select a, b, kind from public.test_bumps')).rows, [{ a: C, b: B, kind: 'hex' }]);
  } finally { await db.exec('drop function private.bump_friendship(uuid, uuid, text); drop table public.test_bumps;'); }
  await at(NOW);
});

test('blocking either way deletes the mischief between them and stops more', async () => {
  await at('2026-10-23T08:00:00Z');
  await db.exec(`delete from public.hexes where to_user in ('${G}', '${H}')`);
  await call(G, 'public.add_friend($1)', [code[H]]);
  await call(H, 'public.add_friend($1)', [code[G]]);
  await sendHex(G, H, (await hand(G))[0]);
  await call(G, 'public.send_haunt($1, $2)', [H, res(G)]);
  await call(G, 'public.help_out($1, $2, $3)', [H, res(H), 'food']);
  await call(G, 'public.knock($1)', [H]);
  const between = async () => value(`select (select count(*) from public.hexes where '${G}' in (from_user, to_user) and '${H}' in (from_user, to_user))
    + (select count(*) from public.hauntings where '${G}' in (from_user, to_user) and '${H}' in (from_user, to_user))
    + (select count(*) from public.helps where '${G}' in (from_user, to_user) and '${H}' in (from_user, to_user))
    + (select count(*) from public.knocks where '${G}' in (from_user, to_user) and '${H}' in (from_user, to_user))`);
  assert.equal(Number(await between()), 4);
  await call(H, 'public.block_user($1)', [G]);
  assert.equal(Number(await between()), 0, 'the block took all of it');
  await rejects(sendHex(G, H, HEX_IDS[0]), /not_friends/);
  const box = await inbox(H);
  assert.deepEqual([box.hexes, box.hauntings, box.helps], [[], [], []]);
  await at(NOW);
});

test('hauntings: one a week from each player, one at a time on each shelf, a day long', async () => {
  await at('2026-10-24T08:00:00Z');
  await db.exec('delete from public.hauntings');
  await rejects(call(A, 'public.send_haunt($1, $2)', [E, res(A)]), /not_friends/);
  await rejects(call(A, 'public.send_haunt($1, $2)', [C, 'nobody']), /bad_culprit/);
  const { id } = await call(A, 'public.send_haunt($1, $2)', [C, res(A, 1)]);
  assert.equal((await inbox(A)).status.haunt_ready, false);
  await rejects(call(A, 'public.send_haunt($1, $2)', [D, res(A)]), /haunted_this_week/);
  await rejects(call(B, 'public.send_haunt($1, $2)', [C, res(B)]), /already_haunted/, 'ghosts do not share');
  const box = await inbox(C);
  assert.deepEqual(box.hauntings.map(g => [g.id, g.from_name, g.ghost.name]), [[id, 'Ada', 'A resident 1']]);
  await rejects(call(B, 'public.shoo_haunt($1, 5)', [id]), /not_found/);
  assert.deepEqual(await call(C, 'public.shoo_haunt($1, 500)', [id]), { ok: true });
  await rejects(call(C, 'public.shoo_haunt($1, 5)', [id]), /not_open/);
  assert.equal(await value('select taps from public.hauntings where id = $1', [id]), 99, 'taps are clamped');
  assert.deepEqual((await inbox(A)).haunt_results.map(r => [r.to_name, r.ghost_name, r.status, r.taps]), [['Cat', 'A resident 1', 'shooed', 99]]);
  assert.equal((await call(B, 'public.send_haunt($1, $2)', [C, res(B)])).ok, true, 'a shooed ghost leaves the shelf free');
  await at('2026-10-25T09:00:00Z');
  assert.deepEqual((await inbox(C)).hauntings, [], 'a day long');
  assert.equal((await inbox(B)).haunt_results[0].status, 'ended');
  await at('2026-10-31T09:00:00Z');
  assert.equal((await inbox(A)).status.haunt_ready, true, 'a week later');
  assert.equal((await call(A, 'public.send_haunt($1, $2)', [D, res(A)])).ok, true);
  await at(NOW);
});

test('help: only for a low need, bounded, and applied once', async () => {
  await at('2026-10-26T08:00:00Z');
  await db.exec('delete from public.helps');
  await rejects(call(A, 'public.help_out($1, $2, $3)', [E, res(E), 'food']), /not_friends/);
  await rejects(call(A, 'public.help_out($1, $2, $3)', [B, res(B), 'gravy']), /bad_need/);
  await rejects(call(A, 'public.help_out($1, $2, $3)', [B, res(B), 'fuss']), /not_needed/, 'fuss is 80');
  await rejects(call(A, 'public.help_out($1, $2, $3)', [B, res(B, 1), 'food']), /not_needed/, 'that one is fed');
  await rejects(call(A, 'public.help_out($1, $2, $3)', [B, 'nobody', 'food']), /not_needed/);
  const first = await call(A, 'public.help_out($1, $2, $3)', [B, res(B), 'food']);
  assert.deepEqual([first.ok, first.amount], [true, 25]);
  await rejects(call(A, 'public.help_out($1, $2, $3)', [B, res(B), 'clean']), /helped_today/, 'once per friend per day');
  await rejects(call(C, 'public.help_out($1, $2, $3)', [B, res(B), 'food']), /resident_helped/, 'one help per resident per day');
  // Three helps a day received at most: give Bea two more hungry residents.
  await call(B, 'public.publish_shelf($1::jsonb)', [JSON.stringify({ residents: [0, 1, 2, 3].map(i => ({ id: res(B, i), name: 'B resident ' + i, needs: { food: 10, fuss: 10, clean: 10 } })) })]);
  await call(C, 'public.help_out($1, $2, $3)', [B, res(B, 1), 'fuss']);
  await call(D, 'public.help_out($1, $2, $3)', [B, res(B, 2), 'clean']);
  await rejects(call(F, 'public.help_out($1, $2, $3)', [B, res(B, 3), 'food']), /helps_full/);
  // Five a day given at most.
  for (const to of [C, D, F, G]) await call(A, 'public.help_out($1, $2, $3)', [to, res(to), 'food']);
  await rejects(call(A, 'public.help_out($1, $2, $3)', [H, res(H), 'food']), /helped_enough/);
  const box = await inbox(B);
  assert.deepEqual(box.helps.map(h => [h.from_name, h.resident_id, h.resident_name, h.need, h.amount]),
    [['Ada', res(B), 'B resident 0', 'food', 25], ['Cat', res(B, 1), 'B resident 1', 'fuss', 25], ['Dan', res(B, 2), 'B resident 2', 'clean', 25]]);
  assert.deepEqual((await inbox(A)).status.helped.sort(), [B, C, D, F, G].sort());
  await rejects(call(B, 'public.ack_helps($1)', [Array.from({ length: 21 }, () => box.helps[0].id)]), /bad_help/);
  assert.deepEqual(await call(C, 'public.ack_helps($1)', [[box.helps[0].id]]), { ok: true, count: 0 }, 'only the owner applies them');
  assert.deepEqual(await call(B, 'public.ack_helps($1)', [box.helps.map(h => h.id)]), { ok: true, count: 3 });
  assert.deepEqual(await call(B, 'public.ack_helps($1)', [box.helps.map(h => h.id)]), { ok: true, count: 0 }, 'applied once');
  assert.deepEqual((await inbox(B)).helps, []);
  await call(B, 'public.publish_shelf($1::jsonb)', [shelf(B)]);
  await at('2026-10-27T08:00:00Z');
  assert.equal((await call(A, 'public.help_out($1, $2, $3)', [B, res(B), 'food'])).ok, true, 'tomorrow, again');
  await at(NOW);
});

test('trick-or-treat: the server rolls it, the bowl sets the odds, once a friend a night, in season only', async () => {
  await db.exec('delete from public.knocks; delete from public.doorsteps;');
  await at('2026-09-30T20:00:00Z');
  await rejects(call(A, 'public.knock($1)', [B]), /out_of_season/);
  await at('2026-11-04T01:00:00Z');
  await rejects(call(A, 'public.knock($1)', [B]), /out_of_season/);
  await rejects(call(A, 'public.set_bowl($1)', ['caviar']), /bad_bowl/);
  assert.deepEqual(await call(B, 'public.set_bowl($1)', ['raisins']), { ok: true, bowl: 'raisins' });
  const knockers = [A, C, D, F, G, H];
  for (const night of ['2026-10-14T23:00:00Z', '2026-10-31T19:00:00Z', '2026-11-03T22:00:00Z']) {
    await at(night);
    const day = night.slice(0, 10);
    for (const bowl of ['toothbrushes', 'full-size', 'apples']) {
      await call(B, 'public.set_bowl($1)', [bowl]);
      const odds = BOWLS.find(b => b.id === bowl);
      for (const who of knockers) {
        await db.exec(`delete from public.knocks where from_user = '${who}'`);
        const got = await call(who, 'public.knock($1)', [B]);
        // What the server must have rolled, from the same seed.
        const seed = who + ':' + B + ':' + day;
        const treat = roll(seed + ':door') % 100 < odds.treat;
        assert.equal(got.result, treat ? 'treat' : 'trick', 'the server roll, for ' + bowl);
        assert.equal(got.bowl, bowl);
        if (treat && roll(seed + ':curio') % 100 < odds.curio) assert.deepEqual([got.prize, got.souls], ['curio', 0]);
        else if (treat) { assert.equal(got.prize, 'souls'); assert.equal(got.souls, odds.lo + roll(seed + ':souls') % (odds.hi - odds.lo + 1)); }
        else {
          assert.equal(got.prize, TRICK_IDS[roll(seed + ':trick') % TRICK_IDS.length]);
          assert.equal(got.culprit.id, res(B, roll(seed + ':who') % 3), 'a trick stars one of the door owner’s residents');
          assert.equal(got.souls, 0);
        }
      }
    }
  }
  await at('2026-10-20T19:00:00Z');
  await db.exec('delete from public.knocks');
  await call(A, 'public.knock($1)', [B]);
  await rejects(call(A, 'public.knock($1)', [B]), /knocked_tonight/);
  await rejects(call(A, 'public.knock($1)', [E]), /not_friends/);
  await call(C, 'public.knock($1)', [B]);
  const door = (await inbox(B)).doorstep;
  assert.equal(door.count, 2);
  assert.deepEqual(door.knocks.map(k => k.from_name).sort(), ['Ada', 'Cat']);
  assert.deepEqual((await inbox(A)).status.knocked, [B]);
  assert.equal((await inbox(A)).status.season, true);
  await at('2026-10-21T19:00:00Z');
  assert.equal((await call(A, 'public.knock($1)', [B])).ok, true, 'another night');
  // Twenty bowl changes a day.
  await db.exec('delete from public.doorsteps');
  for (let i = 0; i < 20; i++) await call(C, 'public.set_bowl($1)', [i % 2 ? 'apples' : 'pennies']);
  await rejects(call(C, 'public.set_bowl($1)', ['apples']), /rate_limited/);
  assert.equal(await value(`select bowl from public.doorsteps where user_id = '${C}'`), 'apples', 'the refused change was not kept');
  await at(NOW);
});

test('the in-memory fake deals the same hands and rolls the same knocks as the server', async () => {
  for (const id of ids) for (const day of ['2026-10-14', '2026-10-31', '2027-01-02']) {
    assert.deepEqual(await value('select private.hex_hand($1, $2::date)', [id, day]), hexHand(id, day), 'the hand for ' + id + ' on ' + day);
    for (const tail of [':door', ':curio', ':souls', ':trick', ':who']) {
      const seed = id + ':' + B + ':' + day + tail;
      assert.equal(await value('select private.mischief_roll($1)', [seed]), mischiefRoll(seed));
    }
  }
});

test('the bowl shifts the odds across many doors', async () => {
  // Every pair of friends knocks for a whole season under each bowl; generous bowls treat more.
  const rate = bowl => {
    let treats = 0, n = 0;
    for (let d = 14; d <= 31; d++) for (const who of ids) {
      n++;
      if (roll(who + ':' + B + ':2026-10-' + d + ':door') % 100 < BOWLS.find(b => b.id === bowl).treat) treats++;
    }
    return treats / n;
  };
  assert.ok(rate('full-size') > rate('fun-size') && rate('fun-size') > rate('raisins') && rate('raisins') > rate('empty-note'));
});

test('a read tidies away mischief older than thirty days', async () => {
  await at('2026-10-28T08:00:00Z');
  await db.exec(`delete from public.hexes where to_user = '${C}'`);
  const { id } = await sendHex(A, C, (await hand(A))[0]);
  await at('2026-11-28T09:00:00Z');
  await inbox(C);
  assert.equal(Number(await value('select count(*) from public.hexes where id = $1', [id])), 0);
  await at(NOW);
});

test('delete_my_account takes every mischief row with it', async () => {
  await at('2026-10-29T08:00:00Z');
  await db.exec(`delete from public.hexes where to_user = '${D}'; delete from public.hauntings where to_user = '${D}'`);
  await sendHex(C, D, (await hand(C))[0]);
  await call(C, 'public.set_bowl($1)', ['apples']).catch(() => {});
  await call(C, 'public.knock($1)', [D]);
  await call(C, 'public.help_out($1, $2, $3)', [D, res(D), 'food']);
  await call(C, 'public.send_haunt($1, $2)', [D, res(C)]).catch(() => {});
  const count = async () => Number(await value(`select (select count(*) from public.hexes where '${C}' in (from_user, to_user))
    + (select count(*) from public.hauntings where '${C}' in (from_user, to_user)) + (select count(*) from public.helps where '${C}' in (from_user, to_user))
    + (select count(*) from public.knocks where '${C}' in (from_user, to_user)) + (select count(*) from public.doorsteps where user_id = '${C}')`));
  assert.ok(await count() >= 4);
  await call(C, 'public.delete_my_account()');
  assert.equal(await count(), 0);
  await at(NOW);
});

// The Kin migration (foundlings and pen pals) against a real Postgres
// (PGlite), on top of 0001 and 0002 only, loaded twice to prove it is
// idempotent. Same Supabase-shaped bootstrap as social_sql.test.mjs.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const read = name => readFileSync(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8');
const ACCOUNTS = read('0001_accounts_and_saves.sql'), SOCIAL = read('0002_social.sql'), KIN = read('0010_kin.sql');
const IDS = ['a', 'b', 'c', 'd', 'e', 'f', '9'].map(x => '00000000-0000-4000-8000-00000000000' + x);
const [A, B, C, D, E, F, G] = IDS;
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
  insert into auth.users (id) values ${IDS.map(id => `('${id}')`).join(', ')};
`;
const TABLES = ['kin_baskets', 'kin_letters', 'kin_pals'];
const FUNCTIONS = ['kin_answer_basket', 'kin_collect', 'kin_end', 'kin_introduce', 'kin_leave_basket', 'kin_mail', 'kin_read', 'kin_reply', 'kin_withdraw_basket'];

let db;
const code = {};
before(async () => {
  db = new PGlite();
  await db.exec(BOOTSTRAP);
  for (let i = 0; i < 2; i++) { await db.exec(ACCOUNTS); await db.exec(SOCIAL); await db.exec(KIN); }
  for (const [id, name] of [[A, 'Ada'], [B, 'Bea'], [C, 'Cat'], [D, 'Dan'], [E, 'Eve'], [F, 'Fay'], [G, 'Gus']]) {
    code[id] = (await as(id, () => value('select public.ensure_profile($1)', [name]))).friend_code;
  }
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
const resident = (id, name, extra = {}) => ({ id, name, traits: ['spiteful', 'damp'], mood: 'fine', bond: 3, art: { creature: { body: 'pear', palette: 'mint', parts: {} } }, ...extra });
async function publish(who, residents) {
  await call(who, 'public.publish_shelf($1::jsonb)', [JSON.stringify({ v: 1, name: '', rank: 0, curios: 0, residents })]);
}
async function friends(x, y, { daysAgo = 0 } = {}) {
  await call(x, 'public.add_friend($1)', [code[y]]);
  const back = await call(y, 'public.add_friend($1)', [code[x]]);
  assert.equal(back.status, 'accepted');
  if (daysAgo) await db.query(`update public.friendships set created_at = now() - make_interval(days => $1)
    where least(requester, addressee) = least($2::uuid, $3::uuid) and greatest(requester, addressee) = greatest($2::uuid, $3::uuid)`, [daysAgo, x, y]);
}
const leave = (from, to, parent, theirs) => call(from, 'public.kin_leave_basket($1, $2::jsonb, $3)', [to, JSON.stringify(parent), theirs]);
const answer = (who, id, accept, parent = null, roll = 0) => call(who, 'public.kin_answer_basket($1, $2, $3::jsonb, $4)', [id, accept, parent && JSON.stringify(parent), roll]);
const mail = who => call(who, 'public.kin_mail()');
const age = (table, id, column, hours) => db.query(`update public.${table} set ${column} = ${column} - make_interval(hours => $2) where id = $1`, [id, hours]);

test('the migration is idempotent and every new table is locked down', async () => {
  const rls = (await db.query("select relname, relrowsecurity from pg_class where relkind = 'r' and relnamespace = 'public'::regnamespace and relname like 'kin_%' order by relname")).rows;
  assert.deepEqual(rls.map(r => r.relname), TABLES);
  assert.ok(rls.every(r => r.relrowsecurity));
  const policies = (await db.query("select tablename, count(*)::int as n from pg_policies where schemaname = 'public' and tablename like 'kin_%' group by tablename order by tablename")).rows;
  assert.deepEqual(policies, TABLES.map(tablename => ({ tablename, n: 1 })), 'one policy each after two runs');
  const triggers = (await db.query("select count(*)::int as n from pg_trigger where tgname = 'kin_unfriended'")).rows[0].n;
  assert.equal(triggers, 1, 'one unfriending trigger after two runs');
  const functions = (await db.query("select p.proname, p.prosecdef, p.proconfig from pg_proc p where p.pronamespace = 'public'::regnamespace order by p.proname")).rows;
  for (const name of FUNCTIONS) assert.equal(functions.filter(f => f.proname === name).length, 1, name + ' exists once');
  for (const f of functions) {
    assert.equal(f.prosecdef, true, f.proname + ' is security definer');
    assert.deepEqual(f.proconfig, ['search_path=public'], f.proname + ' pins its search_path');
  }
  for (const table of TABLES) for (const role of ['anon', 'authenticated']) for (const privilege of ['select', 'insert', 'update', 'delete']) {
    assert.equal(await value('select has_table_privilege($1, $2, $3)', [role, 'public.' + table, privilege]), false, role + ' ' + privilege + ' ' + table);
  }
  for (const name of FUNCTIONS) {
    const signature = (await one("select oid::regprocedure::text as s from pg_proc where proname = $1 and pronamespace = 'public'::regnamespace", [name])).s;
    assert.equal(await value('select has_function_privilege($1, $2, $3)', ['anon', signature, 'execute']), false, 'anon cannot call ' + name);
    assert.equal(await value('select has_function_privilege($1, $2, $3)', ['authenticated', signature, 'execute']), true, 'players can call ' + name);
  }
  await as(A, async () => {
    await rejects(db.query(`select private.kin_week(now())`), /permission denied/);
    await rejects(db.query(`select private.kin_deliver('${A}', 1)`), /permission denied/);
    await rejects(db.query('select * from public.kin_letters'), /permission denied/);
  });
  await as('', () => rejects(db.query('select public.kin_mail()'), /permission denied/), 'anon');
  await as('', () => rejects(db.query('select public.kin_mail()'), /sign in first|28000/));
});

test('a basket needs a friend, history, and a real resident on their shelf', async () => {
  await publish(A, [resident('a0', 'Mabel'), resident('a1', 'Pip')]);
  await publish(B, [resident('b0', 'Grubbs'), resident('b1', 'Snag')]);
  await rejects(leave(A, B, resident('a0', 'Mabel'), 'b0'), /not_friends/);
  await friends(A, B);
  await rejects(leave(A, B, resident('a0', 'Mabel'), 'b0'), /no_history/, 'a brand new friendship and no hearing is not history');
  await rejects(leave(A, B, resident('a0', 'Mabel'), 'nobody'), /not_found/, 'their resident must be on their shelf on show');
  await rejects(leave(A, B, { name: 'No id' }, 'b0'), /bad_basket/);
  await rejects(leave(A, B, resident('a0', 'Mabel'), 'b 0'), /bad_basket/);
  await rejects(leave(A, B, resident('a0', 'Mabel', { art: { body: 'x'.repeat(150000) } }), 'b0'), /too_large/);
  await rejects(leave(A, A, resident('a0', 'Mabel'), 'a1'), /not_friends/);
  // A hearing between the two residents is history.
  await call(A, `public.send_summons($1, 'borrowed-coffin', $2::jsonb, $3::jsonb)`, [B, JSON.stringify({ id: 'a0', name: 'Mabel' }), JSON.stringify({ id: 'b0', name: 'Grubbs' })]);
  await rejects(leave(A, B, resident('a1', 'Pip'), 'b0'), /no_history/, 'only the two residents in the hearing');
  const made = await leave(A, B, resident('a0', 'Mabel'), 'b0');
  assert.equal(made.ok, true);
  const row = await one('select * from public.kin_baskets where id = $1', [made.id]);
  assert.equal(row.history, 'hearing');
  assert.equal(row.to_parent_name, 'Grubbs');
  assert.ok(Number(row.seed) >= 0 && Number(row.seed) <= 2147483647, 'the server issued the seed');
  assert.ok(Math.abs(Date.parse(made.expires_at) - new Date(row.created_at).getTime() - 48 * 3600000) < 1000, 'it keeps for 48 hours');
  // The function takes no seed: there is nothing for a client to choose.
  const args = (await one("select pg_get_function_arguments(oid) as a from pg_proc where proname = 'kin_leave_basket'")).a;
  assert.ok(!/seed/.test(args), args);
});

test('one basket out at a time, the recipient alone sees the seed, and 48 hours is the window', async () => {
  const [open] = (await mail(B)).baskets.filter(b => b.direction === 'in');
  assert.equal(open.status, 'offered');
  assert.equal(open.from_name, 'Ada');
  assert.equal(open.from_parent.name, 'Mabel');
  assert.ok(open.from_parent.art, 'the recipient gets the whole parent to preview the foundling');
  assert.ok(Number.isInteger(open.seed));
  const [mine] = (await mail(A)).baskets.filter(b => b.direction === 'out');
  assert.equal(mine.status, 'offered');
  assert.equal(mine.seed, null, 'the leaver does not see the seed before the birth');
  await rejects(leave(A, B, resident('a0', 'Mabel'), 'b0'), /basket_waiting/);
  await rejects(leave(B, A, resident('b0', 'Grubbs'), 'a0'), /basket_waiting/, 'either direction');
  await rejects(answer(A, open.id, true, resident('b0', 'Grubbs')), /not_found/, 'only the recipient answers');
  await age('kin_baskets', open.id, 'created_at', 49);
  await rejects(answer(B, open.id, true, resident('b0', 'Grubbs')), /expired/);
  assert.equal((await mail(B)).baskets.length, 0, 'an expired basket leaves the postbox');
  assert.deepEqual((await mail(A)).baskets.map(b => [b.direction, b.status]), [['out', 'returned']], 'and goes back inside for the leaver');
  const again = await leave(A, B, resident('a0', 'Mabel'), 'b0');
  assert.deepEqual(await answer(B, again.id, false), { ok: true, id: again.id, status: 'declined' });
  await rejects(answer(B, again.id, true, resident('b0', 'Grubbs')), /not_open/);
  const back = await leave(A, B, resident('a0', 'Mabel'), 'b0');
  assert.deepEqual(await call(A, 'public.kin_withdraw_basket($1)', [back.id]), { ok: true });
  await rejects(call(B, 'public.kin_withdraw_basket($1)', [back.id]), /not_found/);
});

test('accepting makes a foundling for both, pen pals of the parents and twins, and starts the 14 day wait', async () => {
  const made = await leave(A, B, resident('a0', 'Mabel'), 'b0');
  await rejects(answer(B, made.id, true, resident('b1', 'Snag')), /bad_basket/, 'only the resident the basket was left for');
  await rejects(answer(B, made.id, true, resident('b0', 'Grubbs'), 50), /bad_basket/);
  await rejects(answer(B, made.id, true, resident('b0', 'Grubbs', { art: { body: 'x'.repeat(150000) } })), /too_large/);
  const born = await answer(B, made.id, true, resident('b0', 'Grubbs'), 3);
  assert.equal(born.status, 'born');
  assert.equal(born.name_roll, 3);
  assert.ok(Number.isInteger(born.seed));
  const row = await one('select * from public.kin_baskets where id = $1', [made.id]);
  assert.ok(row.to_collected_at && !row.from_collected_at, 'the recipient took theirs in when they agreed');
  const [step] = (await mail(A)).baskets;
  assert.deepEqual([step.direction, step.status, step.collected, step.seed, step.name_roll], ['out', 'born', false, born.seed, 3]);
  assert.equal(step.to_parent.name, 'Grubbs');
  assert.equal(step.from_parent.name, 'Mabel');
  assert.deepEqual(await call(A, 'public.kin_collect($1)', [made.id]), { ok: true });
  assert.deepEqual(await call(A, 'public.kin_collect($1)', [made.id]), { ok: true }, 'collecting twice is harmless');
  await rejects(call(B, 'public.kin_collect($1)', [made.id]), /not_found/);
  assert.equal((await mail(A)).baskets.filter(b => b.status === 'born').length, 0);
  const pals = (await mail(A)).pals.map(p => [p.history, p.mine.id, p.theirs.id]);
  const twin = 'kin' + made.id.replace(/-/g, '').slice(0, 12);
  assert.deepEqual(pals.sort(), [['foundling', 'a0', 'b0'], ['twin', twin, twin]], 'the parents and the twins write to each other (the hearing was never ruled)');
  // One foundling per pair per 14 days, whoever asks.
  await rejects(leave(A, B, resident('a1', 'Pip'), 'b1'), /no_history|too_soon/);
  await db.query(`update public.friendships set created_at = now() - interval '8 days' where least(requester, addressee) = least($1::uuid, $2::uuid) and greatest(requester, addressee) = greatest($1::uuid, $2::uuid)`, [A, B]);
  await rejects(leave(A, B, resident('a1', 'Pip'), 'b1'), /too_soon/);
  await rejects(leave(B, A, resident('b1', 'Snag'), 'a1'), /too_soon/);
  const friendsInfo = (await mail(A)).friends.find(f => f.user_id === B);
  assert.equal(friendsInfo.week_old, true);
  assert.ok(Date.parse(friendsInfo.next_basket_at) > Date.now() + 13 * 86400000);
  await age('kin_baskets', made.id, 'answered_at', 15 * 24);
  const next = await leave(B, A, resident('b1', 'Snag'), 'a1');
  assert.equal((await one('select history from public.kin_baskets where id = $1', [next.id])).history, 'friends', 'a week of friendship is history');
  await answer(A, next.id, false);
});

test('a full shelf cannot accept', async () => {
  await friends(C, D, { daysAgo: 8 });
  await publish(C, [resident('c0', 'Clod'), resident('c1', 'Cob')]);
  await publish(D, Array.from({ length: 18 }, (_, i) => resident('d' + i, 'Dweller ' + i)));
  const made = await leave(C, D, resident('c0', 'Clod'), 'd0');
  await rejects(answer(D, made.id, true, resident('d0', 'Dweller 0')), /shelf_full/);
  await publish(D, [resident('d0', 'Dweller 0')]);
  assert.equal((await answer(D, made.id, true, resident('d0', 'Dweller 0'))).status, 'born');
});

test('leaving baskets is rate limited', async () => {
  await friends(E, F, { daysAgo: 8 });
  await publish(E, [resident('e0', 'Eel')]);
  await publish(F, [resident('f0', 'Fen')]);
  for (let i = 0; i < 6; i++) {
    const made = await leave(E, F, resident('e0', 'Eel'), 'f0');
    await answer(F, made.id, false);
  }
  await rejects(leave(E, F, resident('e0', 'Eel'), 'f0'), /rate_limited/);
  await db.query(`delete from public.kin_baskets where from_user = $1`, [E]);
});

test('letters arrive once a week by the server week, from residents still on show', async () => {
  const week = await value('select private.kin_week(now())');
  const box = await mail(A);
  assert.equal(box.week, week, 'the week comes from the server clock; kin_mail takes no arguments');
  const pal = box.pals.find(p => p.history === 'foundling');
  const letters = box.letters.filter(l => l.pal_id === pal.id);
  assert.equal(letters.length, 1);
  assert.deepEqual([letters[0].kind, letters[0].week, letters[0].from_user, letters[0].writer.name, letters[0].reader.name], ['weekly', week, B, 'Grubbs', 'Mabel']);
  assert.deepEqual(letters[0].writer.traits, ['spiteful', 'damp']);
  const twins = box.pals.find(p => p.history === 'twin');
  assert.equal(box.letters.some(l => l.pal_id === twins.id), false, 'the twins write once both copies are on show');
  await mail(A);
  assert.equal(await value('select count(*)::int from public.kin_letters where pal_id = $1 and to_user = $2', [pal.id, A]), 1, 'checking again never writes twice');
  assert.equal(await value('select private.kin_deliver($1, $2)', [A, week]), 0);
  assert.equal(await value('select private.kin_deliver($1, $2)', [A, week + 1]), 1, 'next week brings the next letter');
  assert.equal(await value('select count(*)::int from public.kin_letters where to_user = $1 and week = $2', [A, week + 1]), 1);
  await db.query('delete from public.kin_letters where to_user = $1 and week = $2', [A, week + 1]);
  // B's side writes its own letter when B looks.
  const bBox = await mail(B);
  assert.equal(bBox.letters.filter(l => l.pal_id === pal.id && l.writer.name === 'Mabel').length, 1);
  // Names and moods come from the shelf on show, cleaned.
  await publish(B, [resident('b0', 'Grubbs the Unbearably Long Name', { mood: 'furious', traits: ['spiteful', 'Not-A-Trait', 7, 'damp'] }), resident('b1', 'Snag')]);
  await value('select private.kin_deliver($1, $2)', [A, week + 2]);
  const late = await one('select writer from public.kin_letters where to_user = $1 and week = $2', [A, week + 2]);
  assert.ok(late.writer.name.startsWith('Grubbs the Unbearably') && late.writer.name.length <= 22, late.writer.name);
  assert.equal(late.writer.mood, 'furious');
  assert.deepEqual(late.writer.traits, ['spiteful', 'damp']);
  await db.query('delete from public.kin_letters where week = $1', [week + 2]);
  // A resident who has left the shelf stops writing.
  await publish(B, [resident('b1', 'Snag')]);
  assert.equal(await value('select private.kin_deliver($1, $2)', [A, week + 3]), 0);
  await publish(B, [resident('b0', 'Grubbs'), resident('b1', 'Snag')]);
});

test('a reply is one of three, once, to a weekly letter, and arrives as the next letter', async () => {
  const letter = (await mail(A)).letters.find(l => l.kind === 'weekly' && l.from_user === B);
  await rejects(call(A, 'public.kin_reply($1, $2)', [letter.id, 3]), /bad_reply/);
  await rejects(call(B, 'public.kin_reply($1, $2)', [letter.id, 1]), /not_found/, 'only the reader replies');
  const sent = await call(A, 'public.kin_reply($1, $2)', [letter.id, 2]);
  assert.equal(sent.ok, true);
  await rejects(call(A, 'public.kin_reply($1, $2)', [letter.id, 0]), /already_replied/);
  assert.equal((await mail(A)).letters.some(l => l.id === letter.id), false, 'answering reads it');
  const reply = (await mail(B)).letters.find(l => l.id === sent.id);
  assert.deepEqual([reply.kind, reply.choice, reply.reply_to, reply.week, reply.writer.name, reply.reader.name], ['reply', 2, letter.id, letter.week, 'Mabel', 'Grubbs']);
  await rejects(call(B, 'public.kin_reply($1, $2)', [reply.id, 0]), /bad_reply/, 'a reply is not answered; the next letter comes next week');
  assert.deepEqual(await call(B, 'public.kin_read($1)', [reply.id]), { ok: true });
  assert.deepEqual(await call(A, 'public.kin_read($1)', [reply.id]), { ok: false }, 'only the reader marks it');
  assert.equal((await mail(B)).letters.some(l => l.id === reply.id), false);
});

test('do not disturb, when another migration adds it, holds baskets, replies and letters', async () => {
  await db.exec('alter table public.profiles add column if not exists dnd_until timestamptz');
  try {
    await friends(A, G, { daysAgo: 8 });
    await publish(G, [resident('g0', 'Gully')]);
    await db.query("update public.profiles set dnd_until = now() + interval '1 day' where user_id = $1", [G]);
    await rejects(leave(A, G, resident('a0', 'Mabel'), 'g0'), /do_not_disturb/);
    await rejects(call(A, 'public.kin_introduce($1, $2, $3)', [G, 'a0', 'g0']), /do_not_disturb/);
    await db.query("update public.profiles set dnd_until = null where user_id = $1", [G]);
    const pal = await call(A, 'public.kin_introduce($1, $2, $3)', [G, 'a0', 'g0']);
    assert.equal(pal.ok, true);
    await db.query("update public.profiles set dnd_until = now() + interval '1 day' where user_id = $1", [G]);
    assert.equal((await mail(G)).letters.length, 0, 'no new letters while Gus is not to be disturbed');
    const toA = (await mail(A)).letters.find(l => l.pal_id === pal.id);
    await rejects(call(A, 'public.kin_reply($1, $2)', [toA.id, 0]), /do_not_disturb/);
    await db.query("update public.profiles set dnd_until = null where user_id = $1", [G]);
    assert.equal((await mail(G)).letters.filter(l => l.pal_id === pal.id).length, 1);
  } finally {
    await db.exec('alter table public.profiles drop column if exists dnd_until');
  }
});

test('introductions need history, respect caps, and a stopped correspondence stays stopped', async () => {
  await friends(B, C);
  await rejects(call(B, 'public.kin_introduce($1, $2, $3)', [C, 'b0', 'c0']), /no_history/);
  await rejects(call(B, 'public.kin_introduce($1, $2, $3)', [C, 'b0', 'zz']), /not_found/);
  await rejects(call(B, 'public.kin_introduce($1, $2, $3)', [E, 'b0', 'e0']), /not_friends/);
  const pal = (await mail(A)).pals.find(p => p.theirs.id === 'g0');
  assert.deepEqual(await call(G, 'public.kin_end($1)', [pal.id]), { ok: true });
  await rejects(call(G, 'public.kin_end($1)', [pal.id]), /not_found/);
  assert.equal((await mail(A)).pals.some(p => p.id === pal.id), false);
  assert.equal(await value('select count(*)::int from public.kin_letters where pal_id = $1', [pal.id]), 0, 'its letters go with it');
  await rejects(call(A, 'public.kin_introduce($1, $2, $3)', [G, 'a0', 'g0']), /stopped/, 'the other side cannot simply restart it');
  assert.deepEqual(await call(G, 'public.kin_introduce($1, $2, $3)', [A, 'g0', 'a0']), { ok: true, id: pal.id }, 'whoever stopped it may start it again');
  // Twelve pairs at most between two players.
  const many = Array.from({ length: 14 }, (_, i) => resident('m' + i, 'Many ' + i));
  await publish(G, many);
  let refused = 0;
  for (let i = 0; i < 14; i++) {
    try { await call(A, 'public.kin_introduce($1, $2, $3)', [G, 'a1', 'm' + i]); }
    catch (error) { assert.match(error.message, /too_many_pals|rate_limited/); refused++; }
  }
  assert.ok(refused >= 3);
  assert.ok(await value('select count(*)::int from public.kin_pals where user_a = least($1::uuid, $2::uuid) and user_b = greatest($1::uuid, $2::uuid)', [A, G]) <= 12);
});

test('a ruled hearing makes pen pals of the two residents', async () => {
  const sent = await call(C, `public.send_summons($1, 'snoring-wall', $2::jsonb, $3::jsonb)`, [D, JSON.stringify({ id: 'c1', name: 'Cob' }), JSON.stringify({ id: 'd0', name: 'Dweller 0' })]);
  assert.equal((await mail(C)).pals.filter(p => p.history === 'hearing').length, 0, 'not until it is heard');
  await call(D, 'public.rule_summons($1, $2, 2, 70)', [sent.id, 'both']);
  const pal = (await mail(C)).pals.find(p => p.history === 'hearing');
  assert.deepEqual([pal.mine.id, pal.theirs.id, pal.case_id, pal.friend], ['c1', 'd0', 'snoring-wall', D]);
  assert.equal((await mail(D)).pals.filter(p => p.history === 'hearing').length, 1, 'one pair for both sides');
});

test('blocking ends the correspondence and takes in waiting baskets, but a born foundling can still be collected', async () => {
  await publish(E, [resident('e0', 'Eel')]);
  await publish(F, [resident('f0', 'Fen')]);
  const born = await leave(E, F, resident('e0', 'Eel'), 'f0');
  await answer(F, born.id, true, resident('f0', 'Fen'));
  await age('kin_baskets', born.id, 'answered_at', 15 * 24);
  const waiting = await leave(F, E, resident('f0', 'Fen'), 'e0');
  assert.ok((await mail(E)).letters.length >= 1);
  await call(F, 'public.block_user($1)', [E]);
  assert.equal(await value('select count(*)::int from public.kin_baskets where id = $1', [waiting.id]), 0, 'the waiting basket is taken in');
  assert.equal(await value('select count(*)::int from public.kin_pals where user_a = least($1::uuid, $2::uuid) and user_b = greatest($1::uuid, $2::uuid)', [E, F]), 0);
  const box = await mail(E);
  assert.equal(box.letters.length, 0);
  assert.equal(box.pals.length, 0);
  const step = box.baskets.find(b => b.id === born.id);
  assert.equal(step.status, 'born', 'nothing earned is taken away');
  assert.equal(step.to_name, '', 'the blocker is not named');
  await call(E, 'public.kin_collect($1)', [born.id]);
  await rejects(leave(E, F, resident('e0', 'Eel'), 'f0'), /not_friends/);
  await rejects(call(E, 'public.kin_introduce($1, $2, $3)', [F, 'e0', 'f0']), /not_friends/);
});

test('removing a friend withdraws waiting baskets both ways, and deleting an account removes everything', async () => {
  await friends(C, G, { daysAgo: 9 });
  await publish(G, [resident('g0', 'Gully')]);
  const waiting = await leave(C, G, resident('c0', 'Clod'), 'g0');
  await call(G, 'public.remove_friend($1)', [C]);
  assert.equal(await value('select count(*)::int from public.kin_baskets where id = $1', [waiting.id]), 0);
  await as(C, () => db.query('select public.delete_my_account()'));
  for (const table of TABLES) {
    const column = table === 'kin_pals' ? `'${C}' in (user_a, user_b)` : `'${C}' in (from_user, to_user)`;
    assert.equal(await value(`select count(*)::int from public.${table} where ${column}`), 0, table);
  }
});

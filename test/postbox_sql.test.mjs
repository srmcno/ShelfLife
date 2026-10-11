// The postbox migration (visits, gifts, guestbooks, waves, friendship levels,
// Do not disturb) against a real Postgres (PGlite), on top of 0001 and 0002.
// Time is moved by rewriting timestamps as the superuser.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const read = name => readFileSync(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8');
const ACCOUNTS = read('0001_accounts_and_saves.sql'), SOCIAL = read('0002_social.sql'), POSTBOX = read('0003_postbox_visits.sql');
const ids = 'abcdef01'.split('').map(x => '00000000-0000-4000-8000-0000000000a' + x);
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
const TABLES = ['friendship_points', 'gifts', 'guestbook', 'social_prefs', 'visits', 'waves'];
const RPCS = ['collect_visit', 'care_visit', 'decline_gift', 'guestbook', 'open_gift', 'postbox', 'postbox_clear', 'postbox_seen',
  'remove_signature', 'respond_visit', 'send_gift', 'send_visit', 'send_wave', 'set_dnd', 'sign_guestbook', 'withdraw_visit'];

let db;
const code = {};
before(async () => {
  db = new PGlite();
  await db.exec(BOOTSTRAP);
  await db.exec(ACCOUNTS); await db.exec(SOCIAL);
  for (let i = 0; i < 2; i++) await db.exec(POSTBOX);
  for (const [id, name] of [[A, 'Ada'], [B, 'Bea'], [C, 'Cat'], [D, 'Dan'], [E, 'Eve'], [F, 'Fay'], [G, 'Gus'], [H, 'Hal']]) {
    code[id] = (await as(id, () => value('select public.ensure_profile($1)', [name]))).friend_code;
  }
  for (const [x, y] of [[A, B], [A, C], [A, D], [A, E], [A, F], [A, G], [B, C], [B, D], [C, D], [E, F], [G, H]]) await friends(x, y);
  // Bea's shelf, so waves have someone to wave at.
  await call(B, 'public.publish_shelf($1)', [JSON.stringify({ v: 1, residents: [{ id: 'bea0', name: 'Mabel' }, { id: 'bea1', name: 'Snag' }] })]);
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
const rejects = (promise, token) => assert.rejects(promise, err => err.message === token || err.code === token, 'expected ' + token);
async function friends(x, y) {
  await call(x, 'public.add_friend($1)', [code[y]]);
  const back = await call(y, 'public.add_friend($1)', [code[x]]);
  assert.equal(back.status, 'accepted');
}
const resident = (id, name = 'Mabel', extra = {}) => JSON.stringify({ id, name, traits: ['damp'], mood: 'fine', bond: 3, art: { body: '', stamps: [] }, ...extra });
const visit = (from, to, id, days = 1, name = 'Mabel') => call(from, 'public.send_visit($1, $2, $3)', [to, resident(id, name), days]);
const postbox = who => call(who, 'public.postbox()');
const sql = (text, params) => db.query(text, params);

test('idempotent, locked down, and every function is a pinned security definer', async () => {
  const rls = (await sql(`select relname, relrowsecurity from pg_class where relkind = 'r' and relnamespace = 'public'::regnamespace and relname = any($1) order by relname`, [TABLES])).rows;
  assert.deepEqual(rls.map(r => r.relname), TABLES);
  assert.ok(rls.every(r => r.relrowsecurity));
  const policies = (await sql(`select tablename, count(*)::int as n from pg_policies where schemaname = 'public' and tablename = any($1) group by tablename order by tablename`, [TABLES])).rows;
  assert.deepEqual(policies.map(p => [p.tablename, p.n]), TABLES.map(t => [t, 1]), 'one policy each after two runs');
  for (const table of TABLES) for (const privilege of ['select', 'insert', 'update', 'delete']) {
    for (const role of ['anon', 'authenticated']) assert.equal(await value('select has_table_privilege($1, $2, $3)', [role, 'public.' + table, privilege]), false, role + ' ' + privilege + ' ' + table);
  }
  const fns = (await sql("select proname, prosecdef, proconfig from pg_proc where pronamespace = 'public'::regnamespace and proname = any($1)", [RPCS])).rows;
  assert.deepEqual(fns.map(f => f.proname).sort(), [...RPCS].sort(), 'each RPC exists once');
  for (const f of fns) {
    assert.equal(f.prosecdef, true, f.proname);
    assert.deepEqual(f.proconfig, ['search_path=public'], f.proname);
    assert.equal(await value("select has_function_privilege('anon', p.oid, 'execute') from pg_proc p where p.proname = $1 and p.pronamespace = 'public'::regnamespace", [f.proname]), false, 'anon cannot call ' + f.proname);
  }
  const helpers = (await sql("select proname from pg_proc where pronamespace = 'private'::regnamespace and proname = any($1)",
    [['bump_friendship', 'postbox_tidy', 'require_friend', 'blocked_either', 'dnd_on', 'utc_day']])).rows;
  assert.equal(helpers.length, 6);
  assert.equal(await value("select has_function_privilege('authenticated', 'private.bump_friendship(uuid, uuid, text)', 'execute')"), false);
  await rejects(as(null, () => value('select public.postbox()')), '28000');
});

test('a visit: request, accept, care, end, postcard and thank-you, each paid once', async () => {
  const sent = await visit(A, B, 'ada0', 2);
  assert.equal(sent.ok, true);
  let box = await postbox(B);
  assert.equal(box.requests.length, 1);
  assert.equal(box.requests[0].from_name, 'Ada');
  assert.equal(box.requests[0].resident.name, 'Mabel');
  assert.equal((await postbox(A)).away[0].status, 'pending');
  assert.equal((await postbox(C)).requests.length, 0, 'nobody else sees it');
  await rejects(call(C, 'public.respond_visit($1, true)', [sent.id]), 'not_found');
  await rejects(call(A, 'public.respond_visit($1, true)', [sent.id]), 'not_found');
  const yes = await call(B, 'public.respond_visit($1, true)', [sent.id]);
  assert.equal(yes.status, 'accepted');
  assert.ok(Date.parse(yes.ends_at) - Date.parse(yes.accepted_at) === 2 * 86400000);
  await rejects(call(B, 'public.respond_visit($1, false)', [sent.id]), 'not_open');
  box = await postbox(B);
  assert.deepEqual(box.guests.map(g => [g.from_name, g.resident.name, g.fed]), [['Ada', 'Mabel', 0]]);
  // Care: counts, a three second gap, a cap of 30 a kind, the host only.
  const fed = await call(B, "public.care_visit($1, 'food')", [sent.id]);
  assert.deepEqual([fed.fed, fed.fussed, fed.washed], [1, 0, 0]);
  await rejects(call(B, "public.care_visit($1, 'clean')", [sent.id]), 'too_soon');
  await rejects(call(A, "public.care_visit($1, 'food')", [sent.id]), 'not_found');
  await rejects(call(B, "public.care_visit($1, 'tickle')", [sent.id]), 'bad_visit');
  await sql("update public.visits set last_care_at = now() - interval '5 seconds' where id = $1", [sent.id]);
  assert.equal((await call(B, "public.care_visit($1, 'clean')", [sent.id])).washed, 1);
  await sql("update public.visits set fussed = 30, last_care_at = null where id = $1", [sent.id]);
  await rejects(call(B, "public.care_visit($1, 'fuss')", [sent.id]), 'care_full');
  // Nothing to collect while it is still on the shelf.
  await rejects(call(A, 'public.collect_visit($1)', [sent.id]), 'not_open');
  // Two days later it has ended; the next read records that.
  await sql("update public.visits set accepted_at = accepted_at - interval '3 days', ends_at = ends_at - interval '3 days' where id = $1", [sent.id]);
  box = await postbox(B);
  assert.equal(box.guests.length, 0);
  assert.deepEqual(box.endings.map(e => [e.role, e.status, e.other_name, e.fed, e.washed]), [['host', 'ended', 'Ada', 1, 1]]);
  const row = await one('select status, ended_at is not null as ended from public.visits where id = $1', [sent.id]);
  assert.deepEqual(row, { status: 'ended', ended: true }, 'the ending is recorded on the row');
  const ending = (await postbox(A)).endings[0];
  assert.deepEqual([ending.role, ending.resident_name, ending.fed, ending.fussed, ending.washed], ['sender', 'Mabel', 1, 30, 1]);
  const card = await call(A, 'public.collect_visit($1)', [sent.id]);
  assert.deepEqual([card.role, card.souls, card.other_name], ['sender', 8, 'Bea']);
  await rejects(call(A, 'public.collect_visit($1)', [sent.id]), 'not_open');
  assert.equal((await call(B, 'public.collect_visit($1)', [sent.id])).souls, 6);
  assert.equal((await postbox(A)).endings.length, 0);
  assert.equal((await postbox(B)).endings.length, 0);
  // Friendship moved on, by one.
  assert.equal((await postbox(A)).levels.find(l => l.user_id === B).kinds.visit, 1);
});

test('visit limits: one away per friend, one place at a time, 2 guests, 5 waiting, 6 a day, 1 to 3 days, size', async () => {
  const first = await visit(C, D, 'cat0');
  await rejects(visit(C, D, 'cat1'), 'already_visiting');
  await rejects(visit(C, A, 'cat0'), 'already_away');
  await rejects(call(C, 'public.send_visit($1, $2, 4)', [B, resident('cat1')]), 'bad_visit');
  await rejects(call(C, 'public.send_visit($1, $2, 0)', [B, resident('cat1')]), 'bad_visit');
  await rejects(call(C, 'public.send_visit($1, $2, 1)', [B, JSON.stringify({ id: '../x' })]), 'bad_visit');
  await rejects(call(C, 'public.send_visit($1, $2, 1)', [B, JSON.stringify([1])]), 'bad_visit');
  await rejects(call(C, 'public.send_visit($1, $2, 1)', [B, resident('cat1', 'Mabel', { art: { body: 'x'.repeat(150000) } })]), 'too_large');
  await rejects(visit(C, E, 'cat1'), 'not_friends');
  await rejects(visit(C, C, 'cat1'), 'not_friends');
  await call(C, 'public.withdraw_visit($1)', [first.id]);
  await rejects(call(C, 'public.withdraw_visit($1)', [first.id]), 'not_open');
  assert.equal((await postbox(D)).requests.length, 0, 'a withdrawn request disappears');

  // Ada's shelf: two guests, then full.
  const g1 = await visit(B, A, 'bea9'), g2 = await visit(C, A, 'cat2'), g3 = await visit(D, A, 'dan0');
  await call(A, 'public.respond_visit($1, true)', [g1.id]);
  await call(A, 'public.respond_visit($1, true)', [g2.id]);
  await rejects(call(A, 'public.respond_visit($1, true)', [g3.id]), 'shelf_full');
  await rejects(visit(E, A, 'eve0'), 'shelf_full');
  const declined = await call(A, 'public.respond_visit($1, false)', [g3.id]);
  assert.equal(declined.status, 'declined');
  assert.deepEqual((await postbox(D)).endings.map(e => [e.status, e.role]), [['declined', 'sender']]);
  assert.equal((await call(D, 'public.collect_visit($1)', [g3.id])).souls, 0, 'a declined visit pays nothing');
  await sql("delete from public.visits where to_user = $1", [A]);

  // Five waiting for one host.
  for (const [who, id] of [[B, 'b1'], [C, 'c1'], [D, 'd1'], [E, 'e1'], [F, 'f1']]) await visit(who, A, id);
  await rejects(visit(G, A, 'g1'), 'too_many_open');
  await sql("delete from public.visits");
  // Six a day from one sender.
  for (let i = 0; i < 6; i++) {
    const v = await visit(A, B, 'r' + i);
    await call(A, 'public.withdraw_visit($1)', [v.id]);
  }
  await rejects(visit(A, B, 'r7'), 'rate_limited');
  await sql("delete from public.visits");
});

test('an unanswered request lapses after 48 hours and the sender is told', async () => {
  const v = await visit(E, F, 'eve1');
  await sql("update public.visits set created_at = now() - interval '49 hours' where id = $1", [v.id]);
  assert.equal((await postbox(F)).requests.length, 0);
  await rejects(call(F, 'public.respond_visit($1, true)', [v.id]), 'expired');
  const box = await postbox(E);
  assert.deepEqual(box.endings.map(e => e.status), ['lapsed']);
  assert.equal(box.away.length, 0);
  assert.equal((await call(E, 'public.collect_visit($1)', [v.id])).souls, 0);
  await sql("delete from public.visits");
});

test('visit endings pay at most three a day per player', async () => {
  const made = [];
  for (const host of [B, C, D, E]) {
    const v = await visit(A, host, 'many-' + host.slice(-1));
    await call(host, 'public.respond_visit($1, true)', [v.id]);
    made.push(v.id);
  }
  await sql("update public.visits set ends_at = now() - interval '1 minute' where id = any($1)", [made]);
  const paid = [];
  for (const id of made) paid.push((await call(A, 'public.collect_visit($1)', [id])).souls);
  assert.deepEqual(paid, [8, 8, 8, 0]);
  await sql("delete from public.visits");
});

test('gifts: once a day per pair, five paid opens a day, seven days to open, decline', async () => {
  const g = await call(B, "public.send_gift($1, 'jar-of-teeth')", [A]);
  await rejects(call(B, "public.send_gift($1, 'moth-pie')", [A]), 'already_sent');
  await rejects(call(B, "public.send_gift($1, 'Not A Treat!')", [C]), 'bad_treat');
  await rejects(call(B, "public.send_gift($1, 'moth-pie')", [E]), 'not_friends');
  let box = await postbox(A);
  assert.deepEqual(box.gifts.map(x => [x.from_name, x.treat, x.status]), [['Bea', 'jar-of-teeth', 'sent']]);
  assert.deepEqual((await postbox(B)).gifted_today, [A]);
  await rejects(call(C, 'public.open_gift($1)', [g.id]), 'not_found');
  const opened = await call(A, 'public.open_gift($1)', [g.id]);
  assert.equal(opened.souls, 4);
  await rejects(call(A, 'public.open_gift($1)', [g.id]), 'not_open');
  // Four more pay, the sixth does not.
  const others = [];
  for (const from of [C, D, E, F, G]) others.push((await call(from, "public.send_gift($1, 'moth-pie')", [A])).id);
  const souls = [];
  for (const id of others) souls.push((await call(A, 'public.open_gift($1)', [id])).souls);
  assert.deepEqual(souls, [4, 4, 4, 4, 0]);
  // Expiry and declining.
  await sql("delete from public.gifts");
  const late = await call(B, "public.send_gift($1, 'moth-pie')", [C]);
  await sql("update public.gifts set created_at = now() - interval '8 days' where id = $1", [late.id]);
  assert.equal((await postbox(C)).gifts.length, 0, 'an unopened gift vanishes after seven days');
  await rejects(call(C, 'public.open_gift($1)', [late.id]), 'expired');
  await sql("delete from public.gifts");
  const no = await call(B, "public.send_gift($1, 'moth-pie')", [C]);
  await call(C, 'public.decline_gift($1)', [no.id]);
  await rejects(call(C, 'public.open_gift($1)', [no.id]), 'not_open');
  box = await postbox(C);
  assert.deepEqual(box.gifts.map(x => x.status), ['declined']);
  await call(C, 'public.postbox_clear()');
  assert.equal((await postbox(C)).gifts.length, 0, 'Clear read takes it away');
  await sql("delete from public.gifts");
});

test('guestbooks: one signature a day, the owner reads 30, a friend reads their own, either can remove', async () => {
  const s = await call(B, "public.sign_guestbook($1, 3, 'moth')", [A]);
  await rejects(call(B, "public.sign_guestbook($1, 4, 'moth')", [A]), 'already_signed');
  await rejects(call(C, "public.sign_guestbook($1, 24, 'moth')", [A]), 'bad_line');
  await rejects(call(C, "public.sign_guestbook($1, 2, 'glitter')", [A]), 'bad_stamp');
  await rejects(call(H, "public.sign_guestbook($1, 2, 'moth')", [A]), 'not_friends');
  await call(C, "public.sign_guestbook($1, 5, 'skull')", [A]);
  const mine = await call(A, 'public.guestbook($1)', [A]);
  assert.deepEqual(mine.entries.map(e => [e.signer_name, e.line, e.stamp]), [['Cat', 5, 'skull'], ['Bea', 3, 'moth']]);
  const theirs = await call(B, 'public.guestbook($1)', [A]);
  assert.deepEqual(theirs.entries.map(e => e.signer_name), ['Bea'], 'Bea sees only what she wrote');
  assert.equal(theirs.signed_today, true);
  await rejects(call(H, 'public.guestbook($1)', [A]), 'not_friends');
  let box = await postbox(A);
  assert.deepEqual(box.signatures.map(x => [x.signer_name, x.seen]), [['Cat', false], ['Bea', false]]);
  await call(A, 'public.postbox_seen()');
  await call(A, 'public.postbox_clear()');
  assert.equal((await postbox(A)).signatures.length, 0, 'cleared from the postbox');
  assert.equal((await call(A, 'public.guestbook($1)', [A])).entries.length, 2, 'but kept in the book');
  await rejects(call(D, 'public.remove_signature($1)', [s.id]), 'not_found');
  await call(A, 'public.remove_signature($1)', [s.id]);
  assert.equal((await call(A, 'public.guestbook($1)', [A])).entries.length, 1);
  // Thirty shown, sixty kept, sixty days at most.
  await sql("delete from public.guestbook");
  for (let i = 0; i < 70; i++) await sql("insert into public.guestbook (owner, signer, line, stamp, day, created_at) values ($1, $2, 1, 'eye', current_date - $3::int, now() - make_interval(mins => $3::int))", [A, B, i + 1]);
  await call(C, "public.sign_guestbook($1, 1, 'eye')", [A]);
  assert.equal(Number(await value('select count(*) from public.guestbook where owner = $1', [A])), 60);
  assert.equal((await call(A, 'public.guestbook($1)', [A])).entries.length, 30);
  await sql("update public.guestbook set created_at = now() - interval '61 days'");
  assert.equal((await call(A, 'public.guestbook($1)', [A])).entries.length, 0, 'entries older than 60 days are gone');
});

test('waves: the name comes from the shelf, three a pair a day, thirty a day', async () => {
  const w = await call(A, "public.send_wave($1, 'bea0', 'wave', 2)", [B]);
  assert.equal(w.resident_name, 'Mabel');
  await rejects(call(A, "public.send_wave($1, 'nobody', 'wave', 2)", [B]), 'not_found');
  await rejects(call(A, "public.send_wave($1, 'bea0', 'slap', 2)", [B]), 'bad_wave');
  await rejects(call(A, "public.send_wave($1, 'bea0', 'wave', 16)", [B]), 'bad_wave');
  await call(A, "public.send_wave($1, 'bea1', 'poke', 0)", [B]);
  await call(A, "public.send_wave($1, 'bea1', 'poke', 1)", [B]);
  await rejects(call(A, "public.send_wave($1, 'bea1', 'poke', 1)", [B]), 'rate_limited');
  const box = await postbox(B);
  assert.deepEqual(box.waves.map(x => [x.from_name, x.resident_name, x.kind]).at(-1), ['Ada', 'Mabel', 'wave']);
  assert.equal(box.waves.length, 3);
  await sql("update public.waves set day = day - 1");
  await sql("insert into public.waves (from_user, to_user, resident_id, resident_name, kind, line, day) select $1, $2, 'bea0', 'Mabel', 'wave', 0, (now() at time zone 'utc')::date from generate_series(1, 30)", [C, D]);
  await rejects(call(C, "public.send_wave($1, 'bea0', 'wave', 2)", [B]), 'rate_limited');
  await sql("delete from public.waves");
});

test('Do not disturb refuses visits, gifts, waves and summonses, and keeps what has arrived', async () => {
  const before = await call(C, "public.send_gift($1, 'moth-pie')", [B]);
  assert.equal((await call(B, 'public.set_dnd(true)')).dnd, true);
  assert.equal((await postbox(B)).dnd, true);
  await rejects(visit(A, B, 'quiet'), 'dnd');
  await rejects(call(A, "public.send_gift($1, 'moth-pie')", [B]), 'dnd');
  await rejects(call(A, "public.send_wave($1, 'bea0', 'wave', 1)", [B]), 'dnd');
  await rejects(call(A, "public.send_summons($1, 'borrowed-coffin', '{\"id\":\"p\"}', '{\"id\":\"d\"}')", [B]), 'dnd');
  assert.deepEqual((await postbox(B)).gifts.map(g => g.id), [before.id], 'existing mail stays');
  await call(A, "public.sign_guestbook($1, 1, 'candle')", [B]);
  await call(B, 'public.set_dnd(false)');
  assert.equal((await call(A, "public.send_gift($1, 'moth-pie')", [B])).ok, true);
  for (let i = 0; i < 18; i++) await call(B, 'public.set_dnd($1)', [i % 2 === 0]);
  await rejects(call(B, 'public.set_dnd(true)'), 'rate_limited');
  await sql("update public.social_prefs set toggled_at = now() - interval '2 hours' where user_id = $1", [B]);
  assert.equal((await call(B, 'public.set_dnd(false)')).ok, true);
  await db.exec("delete from public.gifts; delete from public.guestbook");
});

test('friendship levels: a cap a day per kind, cases count when heard, other migrations can bump', async () => {
  await sql("delete from public.friendship_points");
  for (let i = 0; i < 3; i++) await call(D, "public.send_wave($1, 'bea0', 'wave', 1)", [B]);
  const papers = await call(B, "public.send_summons($1, 'borrowed-coffin', '{\"id\":\"p\"}', '{\"id\":\"d\"}')", [D]);
  await call(D, "public.rule_summons($1, 'both', 2, 50)", [papers.id]);
  let level = (await postbox(D)).levels.find(l => l.user_id === B);
  assert.deepEqual([level.kinds.wave, level.kinds.case, level.total], [1, 1, 2], 'three waves count once today; a heard case counts');
  assert.equal(await value("select private.bump_friendship($1, $2, 'trade')", [B, D]), 1);
  assert.equal(await value("select private.bump_friendship($1, $2, 'hearing')", [D, B]), 1);
  assert.equal(await value("select private.bump_friendship($1, $2, 'gossip')", [D, B]), 0, 'an unknown kind does nothing');
  assert.equal(await value("select private.bump_friendship($1, $2, 'trade')", [B, H]), 0, 'strangers do nothing');
  await db.exec("update public.friendship_points set day = day - 1; update public.waves set day = day - 1");
  await call(D, "public.send_wave($1, 'bea0', 'wave', 1)", [B]);
  level = (await postbox(B)).levels.find(l => l.user_id === D);
  assert.equal(level.kinds.wave, 2, 'a new day, a new wave counts');
  assert.equal(level.total, 5);
  await value("select private.bump_friendship($1, $2, 'trade')", [G, H]);
  assert.deepEqual((await postbox(H)).levels.map(l => l.user_id), [G], 'Hal sees only his own pairs');
  await sql("delete from public.waves");
});

test('blocking tears everything up, both ways; unfriending sends guests home', async () => {
  const v = await visit(E, F, 'eve2');
  await call(F, 'public.respond_visit($1, true)', [v.id]);
  await call(E, "public.send_gift($1, 'moth-pie')", [F]);
  await call(F, "public.sign_guestbook($1, 1, 'eye')", [E]);
  await call(F, 'public.remove_friend($1)', [E]);
  let box = await postbox(F);
  assert.deepEqual([box.guests.length, box.gifts.length, box.endings.length], [0, 0, 0], 'guest gone, gift withdrawn, no thank-you');
  assert.equal((await postbox(E)).endings.length, 0, 'and no postcard');
  await rejects(call(E, 'public.guestbook($1)', [F]), 'not_friends');
  await friends(E, F);
  await call(E, "public.sign_guestbook($1, 2, 'eye')", [F]);
  await call(F, "public.send_wave($1, 'bea0', 'wave', 1)", [B]).catch(() => {});
  const w = await visit(G, H, 'gus0');
  await call(H, "public.sign_guestbook($1, 1, 'eye')", [G]);
  await call(G, 'public.block_user($1)', [H]);
  assert.equal(Number(await value('select count(*) from public.visits where id = $1', [w.id])), 0);
  assert.equal(Number(await value('select count(*) from public.guestbook where $1 in (owner, signer)', [G])), 0);
  box = await postbox(H);
  assert.deepEqual([box.requests.length, box.signatures.length, box.levels.length], [0, 0, 0]);
  await rejects(visit(H, G, 'hal0'), 'not_friends');
  await rejects(call(H, "public.send_gift($1, 'moth-pie')", [G]), 'not_friends');
});

test('a sixty day old row is tidied away by the next read', async () => {
  await sql("insert into public.waves (from_user, to_user, resident_id, resident_name, kind, line, day, created_at) values ($1, $2, 'x', 'X', 'wave', 0, current_date - 70, now() - interval '70 days')", [C, B]);
  await postbox(B);
  assert.equal(Number(await value("select count(*) from public.waves where created_at < now() - interval '60 days'")), 0);
});

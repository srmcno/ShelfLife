// The coven migration against a real Postgres (PGlite), on top of 0001 and
// 0002 only, with the same Supabase-shaped bootstrap as social_sql.test.mjs.
// It runs twice to prove it is idempotent.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { GOALS, COUNTERS, DAILY_CAPS } from '../src/content/coven.js';

const read = name => readFileSync(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8');
const ACCOUNTS = read('0001_accounts_and_saves.sql'), SOCIAL = read('0002_social.sql'), COVENS = read('0008_covens.sql');
const USERS = 'abcdefghijk'.split('');
const ID = Object.fromEntries(USERS.map((x, i) => [x.toUpperCase(), '00000000-0000-4000-8000-0000000000' + String(i + 10)]));
const { A, B, C, D, E, F, G, H, I, J, K } = ID;
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
  insert into auth.users (id) values ${Object.values(ID).map(id => `('${id}')`).join(', ')};
`;
const TABLES = ['active_days', 'coven_claims', 'coven_invites', 'coven_members', 'coven_notes', 'coven_tallies', 'coven_weeks', 'covens', 'referrals'];
const FUNCTIONS = ['claim_referral', 'coven_board', 'coven_cancel_invite', 'coven_claim', 'coven_contribute', 'coven_found', 'coven_invite', 'coven_leave',
  'coven_pass_candle', 'coven_post', 'coven_remove', 'coven_respond', 'coven_restyle', 'coven_set_frame', 'coven_status', 'coven_unpost',
  'mark_active_day', 'referral_status', 'register_referral'];

let db, today, yesterday, week;
const code = {};
before(async () => {
  db = new PGlite();
  await db.exec(BOOTSTRAP);
  for (let i = 0; i < 2; i++) { await db.exec(ACCOUNTS); await db.exec(SOCIAL); await db.exec(COVENS); }
  const row = (await db.query("select (now() at time zone 'utc')::date::text as t, ((now() at time zone 'utc')::date - 1)::text as y, private.coven_week_of((now() at time zone 'utc')::date) as w")).rows[0];
  [today, yesterday, week] = [row.t, row.y, row.w];
  for (const [name, id] of Object.entries(ID)) code[id] = (await as(id, () => value('select public.ensure_profile($1)', [name + 'ster']))).friend_code;
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
  const back = await call(y, 'public.add_friend($1)', [code[x]]);
  assert.equal(back.status, 'accepted');
}
const found = (who, a = 'damp', b = 'sisterhood') => call(who, `public.coven_found($1, $2, 0, 'shield', 'spoon', 'bruise')`, [a, b]);
const invite = (from, to) => call(from, 'public.coven_invite($1)', [to]);
const status = who => call(who, 'public.coven_status()');
async function join(founder, who) {
  await invite(founder, who);
  const box = await status(who);
  const id = box.invites.find(i => i.from_user === founder).id;
  return call(who, 'public.coven_respond($1, true)', [id]);
}
const contribute = (who, counts, day = today) => call(who, 'public.coven_contribute($1, $2::jsonb)', [day, JSON.stringify(counts)]);
const resetRate = who => db.query('delete from private.coven_actions where user_id = $1', [who]);

test('the migration is idempotent, every new table is locked down, and every function is a pinned security definer', async () => {
  const rls = (await db.query(`select c.relname, c.relrowsecurity from pg_class c where c.relkind = 'r'
    and (c.relnamespace = 'public'::regnamespace or c.relnamespace = 'private'::regnamespace) order by c.relname`)).rows;
  assert.ok(rls.every(r => r.relrowsecurity), 'row level security on every table: ' + JSON.stringify(rls));
  for (const t of TABLES) assert.ok(rls.some(r => r.relname === t), t + ' exists');
  assert.ok(rls.some(r => r.relname === 'coven_actions'));
  const functions = (await db.query("select p.proname, p.prosecdef, p.proconfig from pg_proc p where p.pronamespace = 'public'::regnamespace order by p.proname")).rows;
  for (const name of FUNCTIONS) assert.equal(functions.filter(f => f.proname === name).length, 1, name + ' exists once');
  for (const f of functions) {
    assert.equal(f.prosecdef, true, f.proname + ' is security definer');
    assert.deepEqual(f.proconfig, ['search_path=public'], f.proname + ' pins its search_path');
  }
  for (const table of TABLES) {
    for (const privilege of ['select', 'insert', 'update', 'delete']) {
      for (const role of ['authenticated', 'anon']) {
        assert.equal(await value('select has_table_privilege($1, $2, $3)', [role, 'public.' + table, privilege]), false, role + ' ' + privilege + ' ' + table);
      }
    }
  }
  const triggers = (await db.query("select count(*)::int as n from pg_trigger where tgname = 'coven_member_gone'")).rows[0].n;
  assert.equal(triggers, 1, 'one trigger after two runs');
});

test('anon cannot call anything, players cannot touch the tables or the helpers', async () => {
  await as('', async () => {
    for (const sql of ['public.coven_status()', 'public.coven_board()', `public.coven_found('a', 'b', 0, 'c', 'd', 'e')`, 'public.mark_active_day()',
      "public.register_referral('ABCDEFGH')", 'public.referral_status()', `public.coven_contribute('2026-1-1', '{}'::jsonb)`]) {
      await rejects(db.query('select ' + sql), /permission denied/);
    }
  }, 'anon');
  await as(A, async () => {
    await rejects(db.query('select * from public.covens'), /permission denied/);
    await rejects(db.query(`insert into public.coven_tallies (coven_id, user_id, day, counter, amount) values (gen_random_uuid(), '${A}', current_date, 'care', 5)`), /permission denied/);
    await rejects(db.query(`select private.coven_cap('care')`), /permission denied/);
    await rejects(db.query(`select private.coven_week_row(gen_random_uuid(), 1)`), /permission denied/);
  });
  await as('', () => rejects(db.query('select public.coven_status()'), /sign in first|28000/));
});

test('weeks start on Monday at midnight UTC, and the goal pool matches the game', async () => {
  const wk = d => value('select private.coven_week_of($1::date)', [d]);
  assert.equal(await wk('2026-10-11'), await wk('2026-10-05'), 'Sunday is in the same week as the Monday before it');
  assert.equal(await wk('2026-10-12'), (await wk('2026-10-11')) + 1, 'Monday starts a new week');
  assert.equal(await value('select private.coven_week_start($1)::text', [await wk('2026-10-14')]), '2026-10-12');
  assert.equal(await value("select extract(dow from private.coven_week_start(private.coven_week_of(current_date)))::int"), 1);
  const monday = await wk('2026-10-12');
  const originalZone = await value("select current_setting('TimeZone')");
  try {
    for (const zone of ['UTC', 'America/Chicago', 'Pacific/Auckland']) {
      await db.query("select set_config('TimeZone', $1, false)", [zone]);
      assert.equal(await value('select extract(epoch from private.coven_week_at($1))::double precision', [monday]),
        Date.UTC(2026, 9, 12) / 1000, 'week starts at the same UTC instant in ' + zone);
      const at = stamp => value("select private.coven_week_of(($1::timestamptz at time zone 'UTC')::date)", [stamp]);
      assert.equal(await at('2026-10-11T23:59:59Z'), monday - 1, 'the last second of Sunday in ' + zone);
      assert.equal(await at('2026-10-12T00:00:00Z'), monday, 'the first second of Monday in ' + zone);
    }
  } finally { await db.query("select set_config('TimeZone', $1, false)", [originalZone]); }
  const pool = (await db.query('select goal, counter, per from private.coven_goals()')).rows;
  assert.ok(pool.length >= 20, 'twenty goals at least');
  assert.deepEqual(pool.map(g => [g.goal, g.counter, g.per]), GOALS.map(g => [g.id, g.counter, g.per]), 'SQL and src/content/coven.js agree');
  for (const k of COUNTERS) assert.equal(await value('select private.coven_cap($1)', [k]), DAILY_CAPS[k], 'cap for ' + k);
  assert.equal(await value("select private.coven_cap('souls')"), null);
  assert.deepEqual(await Promise.all([1, 2, 3].map(t => value('select private.coven_threshold(100, $1)', [t]))), [34, 67, 100]);
});

test('founding: one coven a player, names and sigils are ids only', async () => {
  await rejects(call(A, `public.coven_found('Damp!', 'sisterhood', 0, 'shield', 'spoon', 'bruise')`), /bad_coven/);
  await rejects(call(A, `public.coven_found('damp', 'sisterhood', 9, 'shield', 'spoon', 'bruise')`), /bad_coven/);
  await rejects(call(A, `public.coven_found('damp', 'sisterhood', 0, 'shield', '<b>', 'bruise')`), /bad_coven/);
  const made = await found(A);
  assert.equal(made.ok, true);
  await rejects(found(A), /already_in_coven/);
  const s = await status(A);
  assert.deepEqual([s.coven.name_a, s.coven.name_b, s.coven.shape, s.coven.symbol, s.coven.colour, s.coven.role, s.coven.members], ['damp', 'sisterhood', 'shield', 'spoon', 'bruise', 'founder', 1]);
  assert.equal(s.week.no, week);
  assert.ok(GOALS.some(g => g.id === s.week.goal), 'a goal from the pool');
  assert.equal(s.week.target, GOALS.find(g => g.id === s.week.goal).per * 2, 'two members at least');
  assert.equal(s.last, null);
  await rejects(call(B, `public.coven_restyle('wet', 'committee', 1, 'moon', 'key', 'ash')`), /no_coven/);
  assert.deepEqual(await call(A, `public.coven_restyle('wet', 'committee', 1, 'moon', 'key', 'ash')`), { ok: true });
  assert.equal((await status(A)).coven.name_a, 'wet');
});

test('invitations: the candle holder invites friends, six at most, and blocks either way stop it', async () => {
  for (const x of [B, C, D, E, F, G, H]) await friends(A, x);
  await rejects(invite(A, I), /not_friends/);
  await rejects(invite(A, A), /self/);
  await rejects(invite(B, C), /no_coven/);
  // A block either way, between the invitee and anyone in the coven.
  await call(H, 'public.block_user($1)', [A]);
  await friends(A, H).catch(() => {});
  await rejects(invite(A, H), /not_friends|not_found/);
  const first = await join(A, B);
  assert.equal(first.status, 'joined');
  await rejects(invite(B, C), /not_founder/, 'members do not invite');
  // C is friends with A, but has blocked B, who is already in the coven.
  await call(C, 'public.block_user($1)', [B]);
  await rejects(invite(A, C), /not_found/);
  await db.query('delete from public.blocks where blocker = $1', [C]);
  for (const x of [C, D, E]) assert.equal((await join(A, x)).status, 'joined');
  // Five members. One pending invitation for F and one for G: G is too late.
  await invite(A, F); await invite(A, G);
  const box = await status(G);
  assert.equal(box.invites.length, 1);
  assert.deepEqual([box.invites[0].from_name, box.invites[0].coven.name_a, box.invites[0].coven.members], ['Aster', 'wet', 5]);
  assert.equal((await call(F, 'public.coven_respond($1, true)', [(await status(F)).invites[0].id])).status, 'joined');
  await rejects(call(G, 'public.coven_respond($1, true)', [box.invites[0].id]), /coven_full/);
  await rejects(invite(A, G), /in_a_coven|coven_full/);
  const s = await status(A);
  assert.equal(s.members.length, 6);
  assert.deepEqual(s.members.map(m => m.role), ['founder', 'member', 'member', 'member', 'member', 'member']);
  assert.ok(s.sent.some(x => x.to_user === G), 'the founder sees invitations still out');
  assert.deepEqual((await status(B)).sent, [], 'members do not');
  assert.equal(await value('select count(*)::int from public.coven_members'), 6);
});

test('one coven each: a member cannot join a second, and joining tears up the other invitations', async () => {
  await found(I, 'cold', 'society');
  await friends(I, B); await friends(I, G); await friends(I, J);
  await rejects(invite(I, B), /in_a_coven/);
  // G has an invitation from A's full coven and one from I's.
  await invite(I, G);
  assert.equal((await status(G)).invites.length, 2);
  assert.equal((await join(I, G)).status, 'joined');
  assert.deepEqual((await status(G)).invites, [], 'the other invitation is gone');
  await rejects(found(G), /already_in_coven/);
  // Declining.
  await invite(I, J);
  const id = (await status(J)).invites[0].id;
  await rejects(call(K, 'public.coven_respond($1, true)', [id]), /not_found/, 'only the invited player answers');
  assert.equal((await call(J, 'public.coven_respond($1, false)', [id])).status, 'declined');
  await rejects(call(J, 'public.coven_respond($1, true)', [id]), /not_found/);
  // An invitation is void once the inviter has gone, and after seven days.
  await invite(I, J);
  await db.query(`update public.coven_invites set created_at = now() - interval '8 days' where to_user = $1`, [J]);
  assert.deepEqual((await status(J)).invites, []);
  await rejects(call(J, 'public.coven_respond($1, true)', [id]), /not_found/);
  // Withdrawn by the candle holder.
  await call(I, 'public.coven_invite($1)', [J]);
  assert.deepEqual(await call(I, 'public.coven_cancel_invite($1)', [J]), { ok: true });
  assert.deepEqual((await status(J)).invites, []);
});

test('the candle passes, members are removed, and the last to leave puts it out', async () => {
  await rejects(call(B, 'public.coven_pass_candle($1)', [C]), /not_founder/);
  await rejects(call(A, 'public.coven_pass_candle($1)', [I]), /not_member/);
  assert.deepEqual(await call(A, 'public.coven_pass_candle($1)', [B]), { ok: true });
  assert.deepEqual((await status(A)).members.filter(m => m.role === 'founder').map(m => m.user_id), [B]);
  await rejects(call(A, 'public.coven_remove($1)', [C]), /not_founder/);
  assert.deepEqual(await call(B, 'public.coven_remove($1)', [F]), { ok: true });
  assert.equal((await status(F)).coven, null);
  await rejects(call(B, 'public.coven_remove($1)', [B]), /not_member/);
  // The candle holder leaves: the longest-standing member takes it.
  assert.deepEqual(await call(B, 'public.coven_leave()'), { ok: true });
  assert.deepEqual((await status(C)).members.filter(m => m.role === 'founder').map(m => m.user_id), [A]);
  await rejects(call(B, 'public.coven_leave()'), /no_coven/);
  // G's coven: I and G. Both leave, and the coven is gone.
  const covenId = (await status(I)).coven.id;
  await call(I, 'public.coven_leave()'); await call(G, 'public.coven_leave()');
  assert.equal(await value('select count(*)::int from public.covens where id = $1', [covenId]), 0);
  // B and F, now free, rejoin A's coven (A holds the candle again).
  assert.equal((await join(A, B)).status, 'joined');
  assert.equal((await join(A, F)).status, 'joined');
  await call(A, `public.coven_set_frame('moth-ring')`);
  await rejects(call(A, `public.coven_set_frame('<img>')`), /bad_coven/);
  assert.equal((await status(B)).members.find(m => m.user_id === A).frame, 'moth-ring');
});

test('contributions: running totals, idempotent, capped per player per day across covens, today or yesterday only', async () => {
  await rejects(contribute(G, { care: 3 }), /no_coven/);
  await rejects(contribute(A, { souls: 3 }), /bad_counts/);
  await rejects(contribute(A, { care: -3 }), /bad_counts/);
  await rejects(contribute(A, { care: 2.5 }), /bad_counts/);
  await rejects(contribute(A, { care: '3' }), /bad_counts/);
  await rejects(contribute(A, [1, 2]), /bad_counts/);
  const far = await value("select ((now() at time zone 'utc')::date - 2)::text");
  const ahead = await value("select ((now() at time zone 'utc')::date + 1)::text");
  await rejects(contribute(A, { care: 3 }, far), /bad_day/);
  await rejects(contribute(A, { care: 3 }, ahead), /bad_day/);
  await rejects(contribute(A, { care: 3 }, 'Tuesday'), /bad_day/);
  // The goal is drawn at random for each coven, so whichever counter it is, two or its daily cap.
  const s = await status(A), k = s.week.counter, two = Math.min(2, DAILY_CAPS[k]);
  const first = await contribute(A, { [k]: two });
  assert.equal(first.ok, true);
  assert.equal(first.mine, two);
  assert.equal((await contribute(A, { [k]: two })).mine, two, 'the same report twice changes nothing');
  assert.equal((await contribute(A, { [k]: 1 })).mine, two, 'a lower running total never takes anything back');
  assert.equal((await contribute(A, { omen: 5 })).ok, true);
  assert.equal(await value(`select amount from public.coven_tallies where user_id = $1 and counter = 'omen' and day = $2::date`, [A, today]), 1, 'one omen a day');
  const cap = DAILY_CAPS[k];
  assert.equal((await contribute(A, { [k]: cap + 500 })).mine, cap, 'a modified client gets the cap and no more');
  // Yesterday counts too, separately.
  await contribute(A, { chore: 3 }, yesterday);
  assert.equal(await value(`select amount from public.coven_tallies where user_id = $1 and counter = 'chore' and day = $2::date`, [A, yesterday]), 3);
  // Changing covens the same day does not reset the cap.
  await contribute(B, { omen: 1, chore: 2 });
  await call(B, 'public.coven_leave()');
  await found(B, 'second', 'drawer');
  await contribute(B, { omen: 1, chore: 3 });
  assert.equal(await value(`select coalesce(sum(amount), 0)::int from public.coven_tallies where user_id = $1 and counter = 'omen' and day = $2::date`, [B, today]), 1);
  assert.equal(await value(`select coalesce(sum(amount), 0)::int from public.coven_tallies where user_id = $1 and counter = 'chore' and day = $2::date`, [B, today]), 3);
  await call(B, 'public.coven_leave()');
  assert.equal((await join(A, B)).status, 'joined');
  // Progress for everyone, and each member's share.
  const after = await status(C);
  assert.equal(after.week.progress, after.week.members.reduce((n, m) => n + m.amount, 0), 'progress is the sum of the shares');
  assert.ok(after.week.members.find(m => m.user_id === A).amount >= cap);
  // 120 reports an hour.
  await resetRate(D);
  for (let i = 0; i < 120; i++) await contribute(D, { care: i });
  await rejects(contribute(D, { care: 200 }), /rate_limited/);
  await resetRate(D);
});

test('chests: thresholds, only for members who did something towards the goal, once per tier per week', async () => {
  const s = await status(A), k = s.week.counter, target = s.week.target;
  await db.query(`delete from public.coven_tallies where coven_id = $1`, [s.coven.id]);
  await rejects(call(A, 'public.coven_claim($1, 1)', [week]), /not_reached/);
  await rejects(call(A, 'public.coven_claim($1, 4)', [week]), /bad_tier/);
  await rejects(call(A, 'public.coven_claim($1, 1)', [week - 2]), /bad_week/);
  await rejects(call(A, 'public.coven_claim($1, 1)', [week + 1]), /bad_week/);
  await rejects(call(G, 'public.coven_claim($1, 1)', [week]), /no_coven/);
  const third = Math.ceil(target / 3);
  // The tallies for a big week, written by hand: the daily caps would make this take days.
  await db.query(`insert into public.coven_tallies (coven_id, user_id, day, counter, amount) values ($1, $2, $3::date, $4, $5)`, [s.coven.id, A, today, k, third]);
  const first = await call(A, 'public.coven_claim($1, 1)', [week]);
  assert.deepEqual([first.ok, first.fresh, first.tier], [true, true, 1]);
  assert.equal((await call(A, 'public.coven_claim($1, 1)', [week])).fresh, false, 'asking again pays nothing new');
  await rejects(call(A, 'public.coven_claim($1, 2)', [week]), /not_reached/);
  await rejects(call(C, 'public.coven_claim($1, 1)', [week]), /not_eligible/, 'nothing done towards the goal, no chest');
  await db.query(`insert into public.coven_tallies (coven_id, user_id, day, counter, amount) values ($1, $2, $3::date, $4, $5)`, [s.coven.id, C, today, k, target]);
  for (const t of [1, 2, 3]) assert.equal((await call(C, 'public.coven_claim($1, $2)', [week, t])).fresh, true);
  assert.deepEqual((await status(C)).week.claimed, [1, 2, 3]);
  assert.deepEqual((await status(A)).week.claimed, [1]);
  // Hopping covens does not open the same chest twice.
  await call(C, 'public.coven_leave()');
  await found(C, 'cold', 'parish');
  await status(C);
  await db.query(`insert into public.coven_tallies (coven_id, user_id, day, counter, amount)
    select (select coven_id from public.coven_members where user_id = $1), $1, $2::date, w.counter, w.target
      from public.coven_weeks w where w.coven_id = (select coven_id from public.coven_members where user_id = $1)`, [C, today]);
  assert.equal((await call(C, 'public.coven_claim($1, 1)', [week])).fresh, false);
  await call(C, 'public.coven_leave()');
  assert.equal((await join(A, C)).status, 'joined');
});

test('last week: the Monday ceremony gets every earlier member’s counts, and last week’s chest can still be opened', async () => {
  const s = await status(A), c = s.coven.id;
  // Everyone joined before this week, as far as last week is concerned.
  await db.query(`update public.coven_members set joined_at = now() - interval '10 days' where coven_id = $1`, [c]);
  await db.query(`select private.coven_week_row($1, $2)`, [c, week - 1]);
  const lw = await one(`select * from public.coven_weeks where coven_id = $1 and week = $2`, [c, week - 1]);
  const start = await value('select private.coven_week_start($1)::text', [week - 1]);
  const sunday = await value('select (private.coven_week_start($1) + 6)::text', [week - 1]);
  await db.query('delete from public.coven_tallies where coven_id = $1 and day between $2::date and $3::date', [c, start, sunday]);
  const [k1, k2] = COUNTERS.filter(k => k !== lw.counter);
  const rows = [[A, start, lw.counter, 9], [A, sunday, lw.counter, 4], [A, start, k1, 3], [D, sunday, k2, 30], [E, start, k1, 1]];
  for (const [u, d, counter, n] of rows) {
    await db.query(`insert into public.coven_tallies (coven_id, user_id, day, counter, amount) values ($1, $2, $3::date, $4, $5)`, [c, u, d, counter, n]);
  }
  const last = (await status(B)).last;
  assert.equal(last.no, week - 1);
  assert.equal(last.goal, lw.goal);
  assert.equal(last.members.length, 6);
  const a = last.members.find(m => m.user_id === A);
  assert.deepEqual([a.counts[lw.counter], a.counts[k1], a.days, a.late], [13, 3, 2, 4]);
  const d = last.members.find(m => m.user_id === D);
  assert.deepEqual([d.counts[k2], d.days, d.late], [30, 1, 30]);
  assert.deepEqual(last.members.find(m => m.user_id === B).counts, {});
  // A joined this week: not at last week's ceremony.
  await db.query(`update public.coven_members set joined_at = now() where user_id = $1`, [F]);
  assert.equal((await status(B)).last.members.length, 5);
  // Last week's first chest, if it was reached.
  const reached = a.counts[lw.counter] >= Math.ceil(lw.target / 3);
  if (reached) assert.equal((await call(A, 'public.coven_claim($1, 1)', [week - 1])).fresh, true);
  else await rejects(call(A, 'public.coven_claim($1, 1)', [week - 1]), /not_reached/);
});

test('the notice board: members only, bank-shaped tiles, mentions of members, twenty kept, removal by author, the named or the candle holder', async () => {
  const post = (who, tiles) => call(who, 'public.coven_post($1::jsonb)', [JSON.stringify(tiles)]);
  await rejects(post(G, ['the', 'spoon']), /no_coven/);
  await rejects(post(A, []), /bad_note/);
  await rejects(post(A, Array(13).fill('spoon')), /bad_note/);
  await rejects(post(A, ['Spoon']), /bad_note/);
  await rejects(post(A, ['spoon <script>']), /bad_note/);
  await rejects(post(A, [7]), /bad_note/);
  await rejects(post(A, ['@' + G, 'is', 'moist']), /bad_note/, 'only members can be named');
  await rejects(post(A, ['@' + B, '@' + C, '@' + D, '@' + E]), /bad_note/, 'three names at most');
  const named = await post(A, ['@' + B, 'owes', 'me', 'a', 'spoon', 'allegedly']);
  assert.equal(named.ok, true);
  const plain = await post(D, ['the', 'drawer', 'is', 'moist', 'again']);
  const fromB = await post(B, ['sorry']);
  const board = await call(B, 'public.coven_board()');
  assert.deepEqual(board.map(n => n.tiles.join(' ')), ['sorry', 'the drawer is moist again', '@' + B + ' owes me a spoon allegedly']);
  assert.deepEqual(board[2].mention_names, ['Bster']);
  assert.equal(board[2].author_name, 'Aster');
  assert.ok(fromB.id > plain.id);
  await rejects(call(C, 'public.coven_unpost($1)', [named.id]), /not_allowed/, 'neither author, named nor candle holder');
  assert.deepEqual(await call(B, 'public.coven_unpost($1)', [named.id]), { ok: true }, 'the named member takes it down');
  assert.deepEqual(await call(A, 'public.coven_unpost($1)', [plain.id]), { ok: true }, 'the candle holder may take anything down');
  await rejects(call(A, 'public.coven_unpost($1)', [plain.id]), /not_found/);
  await rejects(call(G, 'public.coven_unpost($1)', [1]), /no_coven/);
  // Blocks hide notes both ways.
  const fromE = await post(E, ['regret', 'is', 'a', 'drawer']);
  await call(B, 'public.block_user($1)', [E]);
  assert.ok(!(await call(B, 'public.coven_board()')).some(n => n.id === fromE.id), 'the blocker does not see it');
  assert.ok(!(await call(E, 'public.coven_board()')).some(n => n.author === B), 'nor the blocked');
  assert.ok((await call(C, 'public.coven_board()')).some(n => n.id === fromE.id), 'everyone else still does');
  await db.query('delete from public.blocks where blocker = $1', [B]);
  // Twenty kept; twelve an hour each.
  for (const who of [A, C, D]) {
    await resetRate(who);
    for (let i = 0; i < 9; i++) await post(who, ['spoon', String(i)]);
  }
  assert.equal(await value('select count(*)::int from public.coven_notes where coven_id = (select coven_id from public.coven_members where user_id = $1)', [A]), 20);
  assert.equal((await call(A, 'public.coven_board()')).length, 20);
  for (let i = 0; i < 3; i++) await post(A, ['again']);
  await rejects(post(A, ['again']), /rate_limited/);
  assert.equal((await status(A)).board.count, 20);
});

test('invite rewards: a new player names their inviter, becomes friends, plays three days, and both collect once', async () => {
  // K is the new player; J brings them in.
  const refused = (who, c) => call(who, 'public.register_referral($1)', [c]).then(r => r.ok === false ? r.error : 'accepted');
  assert.equal(await refused(K, 'ZZZZZZZZ'), 'not_found');
  assert.equal(await refused(K, code[K]), 'self');
  await db.query(`update auth.users set created_at = now() - interval '30 days' where id = $1`, [I]);
  assert.equal(await refused(I, code[J]), 'not_new');
  assert.equal((await call(I, 'public.referral_status()')).can_register, false);
  assert.equal((await call(K, 'public.referral_status()')).can_register, true);
  assert.equal((await call(K, 'public.register_referral($1)', [code[J]])).inviter, J);
  assert.equal(await refused(K, code[A]), 'already_referred');
  // Not friends yet: no names, no reward.
  let mine = await call(K, 'public.referral_status()');
  assert.deepEqual([mine.invited_by.user_id, mine.invited_by.name, mine.invited_by.friends, mine.invited_by.days], [J, '', false, 0]);
  await rejects(call(K, 'public.claim_referral($1)', [J]), /not_friends/);
  await friends(K, J);
  // Days count once each.
  for (let i = 0; i < 3; i++) await call(K, 'public.mark_active_day()');
  assert.equal((await call(K, 'public.referral_status()')).invited_by.days, 1);
  await rejects(call(K, 'public.claim_referral($1)', [J]), /not_ready/);
  await rejects(call(J, 'public.claim_referral($1)', [K]), /not_ready/);
  await db.query(`update public.referrals set created_at = now() - interval '3 days' where invitee = $1`, [K]);
  await db.query(`insert into public.active_days (user_id, day) values ($1, current_date - 1), ($1, current_date - 2) on conflict do nothing`, [K]);
  mine = await call(K, 'public.referral_status()');
  assert.deepEqual([mine.invited_by.name, mine.invited_by.days, mine.invited_by.claimed], ['Jster', 3, false]);
  assert.deepEqual(await call(K, 'public.claim_referral($1)', [J]), { ok: true, fresh: true, side: 'invitee' });
  assert.deepEqual(await call(K, 'public.claim_referral($1)', [J]), { ok: true, fresh: false, side: 'invitee' });
  assert.deepEqual(await call(J, 'public.claim_referral($1)', [K]), { ok: true, fresh: true, side: 'inviter' });
  assert.equal((await call(J, 'public.referral_status()')).rewarded, 1);
  await rejects(call(A, 'public.claim_referral($1)', [K]), /not_found/, 'a stranger to the referral');
  // Ten rewarded invitations per inviter, server enforced.
  const extra = [];
  for (let i = 0; i < 10; i++) {
    const id = '00000000-0000-4000-8000-0000000009' + String(i).padStart(2, '0');
    extra.push(id);
    await db.query(`insert into auth.users (id) values ($1)`, [id]);
    await db.query(`insert into public.referrals (invitee, inviter, created_at, inviter_claimed_at) values ($1, $2, now() - interval '5 days', $3)`, [id, J, i < 9 ? new Date().toISOString() : null]);
    await db.query(`insert into public.friendships (requester, addressee, status) values ($1, $2, 'accepted')`, [id, J]);
    await db.query(`insert into public.active_days (user_id, day) select $1, current_date - g from generate_series(0, 2) g`, [id]);
  }
  assert.equal((await call(J, 'public.referral_status()')).rewarded, 10);
  await rejects(call(J, 'public.claim_referral($1)', [extra[9]]), /cap_reached/);
  // A blocked inviter's code looks like nobody's.
  await db.query(`insert into auth.users (id) values ('00000000-0000-4000-8000-000000000999')`);
  await call('00000000-0000-4000-8000-000000000999', 'public.ensure_profile($1)', ['']);
  await call(A, 'public.block_user($1)', ['00000000-0000-4000-8000-000000000999']);
  assert.equal(await refused('00000000-0000-4000-8000-000000000999', code[A]), 'not_found');
  // Ten tries an hour, wrong guesses included.
  for (let i = 0; i < 10; i++) assert.equal(await refused(H, 'ZZZZZZZZ'), 'not_found');
  await rejects(call(H, 'public.register_referral($1)', [code[J]]), /rate_limited/);
});

test('delete_my_account takes every coven row with it and hands the candle on', async () => {
  const c = (await status(A)).coven.id;
  await call(A, 'public.coven_post($1::jsonb)', [JSON.stringify(['the', 'end'])]).catch(() => {});
  await db.query(`insert into public.coven_tallies (coven_id, user_id, day, counter, amount) values ($1, $2, current_date, 'care', 4) on conflict do nothing`, [c, A]);
  await call(A, 'public.mark_active_day()');
  const count = async () => Object.fromEntries(await Promise.all([
    ['members', `select count(*)::int from public.coven_members where user_id = '${A}'`],
    ['tallies', `select count(*)::int from public.coven_tallies where user_id = '${A}'`],
    ['claims', `select count(*)::int from public.coven_claims where user_id = '${A}'`],
    ['notes', `select count(*)::int from public.coven_notes where author = '${A}'`],
    ['days', `select count(*)::int from public.active_days where user_id = '${A}'`],
    ['actions', `select count(*)::int from private.coven_actions where user_id = '${A}'`]
  ].map(async ([k, sql]) => [k, await value(sql)])));
  const before = await count();
  for (const [table, n] of Object.entries(before)) assert.ok(n > 0, table + ' had rows to delete');
  await call(F, 'public.coven_leave()');
  await resetRate(A);
  assert.equal((await call(A, 'public.coven_invite($1)', [G])).ok, true);
  await call(A, 'public.delete_my_account()');
  for (const [table, n] of Object.entries(await count())) assert.equal(n, 0, table);
  const s = await status(B);
  assert.equal(s.coven.id, c, 'the coven carries on');
  assert.equal(s.members.filter(m => m.role === 'founder').length, 1, 'with someone holding the candle');
  assert.equal(await value(`select count(*)::int from public.coven_invites where from_user = '${A}'`), 0);
});

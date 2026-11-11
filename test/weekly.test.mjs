import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { weekNumber, weekEnds, daysLeftInWeek, weeklyCaseId, readTally, tallyLine } from '../src/engine/weekly.js';
import { COURT_CASES } from '../src/content/court.js';
import { createFakeWeekly } from './support/fake-weekly.mjs';

const DAY = 86400000;
test('weeks run Monday to Sunday in UTC and every week names a real case', () => {
  const monday = Date.UTC(2026, 10, 9), sunday = Date.UTC(2026, 10, 15, 23, 59, 59);
  assert.equal(weekNumber(monday), weekNumber(sunday));
  assert.equal(weekNumber(monday - 1), weekNumber(monday) - 1);
  assert.equal(weekNumber(sunday + 1000), weekNumber(monday) + 1);
  assert.equal(weekEnds(weekNumber(monday)), Date.UTC(2026, 10, 16));
  assert.equal(daysLeftInWeek(monday), 7); assert.equal(daysLeftInWeek(sunday), 1);
  const ids = new Set(COURT_CASES.map(c => c.id)), seen = new Set();
  for (let w = 2900; w < 2900 + COURT_CASES.length; w++) { const id = weeklyCaseId(w); assert.ok(ids.has(id)); seen.add(id); assert.notEqual(id, weeklyCaseId(w + 1)); }
  assert.equal(seen.size, COURT_CASES.length, 'every case gets its week before any repeats');
  assert.equal(weeklyCaseId(1.5), ''); assert.equal(weeklyCaseId(3, []), '');
});

test('a tally is read defensively and its shares always sum to 100', () => {
  assert.equal(readTally(null, 1, 'a'), null);
  assert.equal(readTally({ week: 2, case: 'a' }, 1, 'a'), null);
  const t = readTally({ week: 1, case: 'a', plaintiff: 1, defendant: 1, both: 1, mine: 'both' }, 1, 'a');
  assert.deepEqual(t.share, { plaintiff: 33, defendant: 33, both: 34 }); assert.equal(t.total, 3); assert.equal(t.mine, 'both');
  const odd = readTally({ week: 1, case: 'a', plaintiff: '7', defendant: -4, both: 'x', mine: '<b>' }, 1, 'a');
  assert.deepEqual(odd.counts, { plaintiff: 7, defendant: 0, both: 0 }); assert.equal(odd.mine, '');
  assert.equal(tallyLine(readTally({ week: 1, case: 'a', plaintiff: 0, defendant: 0, both: 0 }, 1, 'a')), 'Nobody has ruled yet. The bench is cold.');
  assert.equal(tallyLine(readTally({ week: 1, case: 'a', plaintiff: 3, defendant: 1, both: 0 }, 1, 'a')), '75% found for the plaintiff. 4 households ruled.');
  assert.equal(tallyLine(readTally({ week: 1, case: 'a', plaintiff: 1, defendant: 1, both: 0 }, 1, 'a')), 'The neighbourhood is split down the middle. 2 households ruled.');
  assert.equal(tallyLine(readTally({ week: 1, case: 'a', plaintiff: 0, defendant: 0, both: 1 }, 1, 'a')), '100% declared them both idiots. 1 household ruled.');
});

const dir = new URL('../supabase/migrations/', import.meta.url);
const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const a = id(1), b = id(2), c = id(3);
let db;
const value = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
async function as(user, fn, role = 'authenticated') {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]); await db.exec('set role ' + role);
  try { return await fn(); } finally { await db.exec('reset role'); }
}
before(async () => {
  db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create table auth.users (id uuid primary key default gen_random_uuid(), email text, is_anonymous boolean not null default false, created_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated, service_role; grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
    insert into auth.users(id) values ('${a}'), ('${b}'), ('${c}');`);
  const migrations = readdirSync(dir).filter(n => /^\d{4}_.*\.sql$/.test(n)).sort();
  for (let i = 0; i < 2; i++) for (const migration of migrations) await db.exec(readFileSync(new URL(migration, dir), 'utf8'));
});
after(async () => db?.close());

test('one ruling a week counts, the first stands, and only totals are readable', async () => {
  const week = await value('select private.weekly_now()');
  assert.equal(week, weekNumber(), 'the server and the game agree on the week');
  const fake = createFakeWeekly({ now: Date.now, json: (s, body) => body, rest: (s, c, m) => { throw new Error(m); } });
  assert.equal(fake.week(), week);
  assert.deepEqual(await as(a, () => value('select public.weekly_tally($1,$2)', [week, 'borrowed-coffin'])), { week, case: 'borrowed-coffin', plaintiff: 0, defendant: 0, both: 0, mine: null });
  assert.equal((await as(a, () => value('select public.weekly_rule($1,$2,$3)', [week, 'borrowed-coffin', 'plaintiff']))).mine, 'plaintiff');
  const again = await as(a, () => value('select public.weekly_rule($1,$2,$3)', [week, 'borrowed-coffin', 'both']));
  assert.deepEqual([again.plaintiff, again.both, again.mine], [1, 0, 'plaintiff'], 'a rerun cannot change the record');
  await as(b, () => value('select public.weekly_rule($1,$2,$3)', [week, 'borrowed-coffin', 'both']));
  assert.deepEqual(await as(c, () => value('select public.weekly_tally($1,$2)', [week, 'borrowed-coffin'])), { week, case: 'borrowed-coffin', plaintiff: 1, defendant: 0, both: 1, mine: null });
  await assert.rejects(as(c, () => value('select public.weekly_rule($1,$2,$3)', [week - 1, 'borrowed-coffin', 'both'])), /bad_week/);
  await assert.rejects(as(c, () => value('select public.weekly_rule($1,$2,$3)', [week, 'Not A Case', 'both'])), /bad_ruling/);
  await assert.rejects(as(c, () => value('select public.weekly_rule($1,$2,$3)', [week, 'borrowed-coffin', 'guilty'])), /bad_ruling/);
  await assert.rejects(as(c, () => value('select public.weekly_tally($1,$2)', [week - 2, 'borrowed-coffin'])), /bad_week/);
  await assert.rejects(as(c, () => value('select count(*) from public.weekly_rulings')), /permission denied/);
  await assert.rejects(as('', () => value('select public.weekly_tally($1,$2)', [week, 'borrowed-coffin']), 'anon'), /permission denied/);
  await db.query('insert into public.weekly_rulings(week, user_id, case_id, verdict) values ($1, $2, $3, $4)', [week - 20, c, 'old-case', 'both']);
  await as(c, () => value('select public.weekly_rule($1,$2,$3)', [week, 'borrowed-coffin', 'defendant']));
  assert.equal(await value('select count(*)::int from public.weekly_rulings where week < $1', [week - 8]), 0, 'old weeks are swept');
});

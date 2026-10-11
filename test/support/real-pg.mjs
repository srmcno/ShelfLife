// A real PostgreSQL for the tests PGlite cannot do: races between separate
// connections. Each call runs in its own `psql` process (its own backend), so
// N calls started together really do contend for rows and locks.
//
// Set SHELF_PG to a libpq connection string for a superuser, for example
//   SHELF_PG="host=/var/tmp port=54329 user=postgres"
// Without it the race tests skip and say so. No driver is needed: psql only.
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';

const DIR = new URL('../../supabase/migrations/', import.meta.url);
export const MIGRATIONS = readdirSync(DIR).filter(name => /^\d{4}_.*\.sql$/.test(name)).sort();
export const CONN = process.env.SHELF_PG || '';

export function available() {
  if (!CONN) return false;
  const r = spawnSync('psql', [CONN, '-tAc', 'select 1'], { encoding: 'utf8' });
  return r.status === 0 && r.stdout.trim() === '1';
}
export const skipReason = 'set SHELF_PG to a PostgreSQL superuser connection string to run the real-connection race tests';

const withDb = (conn, db) => conn + ' dbname=' + db;

function psql(conn, input) {
  return new Promise(resolve => {
    const p = spawn('psql', [conn, '-v', 'ON_ERROR_STOP=1', '-qtAX'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', d => { out += d; });
    p.stderr.on('data', d => { err += d; });
    p.on('close', status => resolve({ status, out: out.trim(), err: err.trim() }));
    p.stdin.end(input);
  });
}

const BOOTSTRAP = ids => `
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  end $$;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, is_anonymous boolean not null default false, created_at timestamptz default now());
  create function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  ${ids.length ? 'insert into auth.users (id) values ' + ids.map(id => "('" + id + "')").join(', ') + ';' : ''}
`;

let serial = 0;
// A fresh database with every migration loaded twice. Returns a handle.
export async function freshDatabase(ids = []) {
  const name = 'shelf_t' + process.pid + '_' + (++serial) + '_' + Date.now().toString(36);
  const made = await psql(CONN, 'create database ' + name + ';');
  if (made.status) throw new Error(made.err);
  const conn = withDb(CONN, name);
  const boot = await psql(conn, BOOTSTRAP(ids));
  if (boot.status) throw new Error(boot.err);
  for (let i = 0; i < 2; i++) {
    for (const file of MIGRATIONS) {
      const r = await psql(conn, readFileSync(new URL(file, DIR), 'utf8'));
      if (r.status) throw new Error(file + ': ' + r.err);
    }
  }
  return {
    name, conn,
    // As the superuser (setup and inspection). Returns the text output.
    async admin(sql) { const r = await psql(conn, sql); if (r.status) throw new Error(r.err); return r.out; },
    // As a signed-in player, in a connection of its own. Resolves { ok, value | error }.
    async as(user, sql) {
      const r = await psql(conn, `select set_config('request.jwt.claim.sub', '${user}', false);\nset role authenticated;\n` + sql);
      if (r.status) return { ok: false, error: r.err.replace(/^.*ERROR:\s*/s, '').split('\n')[0] };
      const lines = r.out.split('\n').filter(Boolean);
      const last = lines.at(-1) ?? '';
      try { return { ok: true, value: JSON.parse(last) }; } catch { return { ok: true, value: last }; }
    },
    // Start all calls at once, each on its own connection. A gate holds an
    // exclusive advisory lock while every racer connects and queues for a
    // shared one; when the gate lets go they are all released together.
    async race(calls) {
      const key = 7700 + serial;
      const gate = psql(conn, `select pg_advisory_lock(${key}); select pg_sleep(${Math.max(1.5, calls.length * 0.08)});`);
      await new Promise(resolve => setTimeout(resolve, 300));
      const wait = `select pg_advisory_lock_shared(${key}); select pg_advisory_unlock_shared(${key});\n`;
      const results = await Promise.all(calls.map(([user, sql]) => this.as(user, wait + sql)));
      await gate;
      return results;
    },
    async drop() { await psql(CONN, 'drop database if exists ' + name + ' with (force);'); }
  };
}

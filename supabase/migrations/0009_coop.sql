-- Shelf Life: co-op. Hired help on a friend's expedition, and seeded arcade
-- duels with ghosts.
--
-- Run after 0001_accounts_and_saves.sql and 0002_social.sql. Safe to run more
-- than once, and it follows the same rules as 0002:
--   * every table hangs off auth.users on delete cascade, so
--     delete_my_account() removes all of it without being edited;
--   * row level security is on everywhere and nobody reads or writes these
--     tables directly. Every call is a security definer function that starts
--     from private.require_user();
--   * refusals raise errcode P0001 with a short token as the message:
--     not_friends, dnd, not_for_hire, hired_today, fully_booked, bad_resident,
--     too_large, bad_report, not_found, not_open, not_your_turn, bad_game,
--     bad_stake, bad_score, bad_log, too_many_open, rate_limited,
--     needs_opening, insufficient_souls, bad_balance, bad_seq.
--     src/cloud/coop.js turns them into copy.
--
-- Hired help. A player puts up to two residents up for hire (coop_set_hires).
-- Friends see them on the expedition planner (coop_hire_board) and take one
-- along (coop_hire): one hire a day per hirer, three trips a day per resident
-- across every friend, days in UTC. The hire copies the resident as it was
-- listed, and nothing about the lender's resident changes. When the trip ends
-- the hirer files a report made of ids and numbers (coop_finish_hire) and the
-- server decides the lender's wages: 6, 9 or 12 souls by how the trip went,
-- at most 30 a day per lender. A hire nobody finishes comes home by itself
-- after 72 hours with the smallest wage. The lender reads the report and
-- collects the wages once (coop_reports, coop_collect).
--
-- Duels. A challenge (coop_duel_create) is a series of up to three rounds of
-- one arcade game. The server picks every round's seed. The first player
-- plays it and files a score and an input log (coop_duel_submit); the other
-- player then gets the seed and the log (coop_duel_play) and plays the same
-- seed against a ghost. The first score stays sealed until both have played.
-- The higher score takes the round and the first to two rounds takes the
-- series; after a round either player may ask for a rematch
-- (coop_duel_rematch). The optional stake (0 to 25 souls) is the same for
-- both: the challenger's is held from the start, the opponent's from their
-- first play. The winner is paid both stakes, a tie returns each, and a
-- series nobody finished is void and returns them. Souls live in the save,
-- so the server keeps the ledger and each player collects what it says once
-- (coop_duel_claim). A round lapses 48 hours after the last move: unplayed
-- it is void (the challenger's stake comes back), started and abandoned it
-- counts as a score of 0.
--
-- The money ledger. Souls live in the save, so every soul co-op moves is
-- written down as a receipt that belongs to one account:
-- { id, owner, seq, kind, source_id, delta, earned, created_at, detail }. seq counts 1, 2, 3...
-- per owner with no gaps; kind is 'stake' (a duel stake leaving the purse,
-- delta negative), 'duel' (a refund or winnings, delta positive) or 'hire'
-- (wages). earned is the profit part only: 0 for stakes and refunds, the
-- other player's stake for winnings, the whole wage for wages. A stake is
-- written in the same transaction that holds it (coop_duel_create for the
-- challenger, the opponent's first coop_duel_play), and a payout in the
-- transaction that collects it (coop_duel_claim, coop_collect). One receipt
-- per (owner, kind, source), so a retry answers the receipt already written.
-- A device reads what it missed with coop_receipts(after); receipts are kept
-- for as long as the account exists.
--
-- Funds. The server keeps a co-op balance per account: an opening balance
-- the client declares once (coop_open, with the last seq its souls already
-- include) plus every receipt after that seq. A stake that would take it
-- below zero is refused (insufficient_souls), and so is any stake before an
-- opening is declared (needs_opening). A payout comes only out of holds that
-- exist and have not been paid out, so a series pays out at most what was
-- staked into it.
--
-- Housekeeping runs in private.coop_tidy(uid) at the start of every call, so
-- nothing needs a scheduler. It also deletes settled duels and hires older
-- than 60 days, for the rows that player is in, once nothing in them is
-- still owed to anyone.
--
-- Locks. Every count-then-insert cap and every receipt first takes the
-- account's advisory lock (private.lock_account), which works before a
-- profile row exists; two accounts are locked in a fixed order.
--
-- Optional hooks from other migrations, used only when they exist:
-- private.bump_friendship(uuid, uuid, text) (kinds 'hire' and 'duel') and
-- public.social_prefs.dnd (Do not disturb).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- What a player has put up for hire: two residents at most, as listed.
create table if not exists public.coop_listings (
  owner uuid not null references auth.users (id) on delete cascade,
  pet_id text not null check (pet_id ~ '^[A-Za-z0-9_-]{1,100}$'),
  resident jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (owner, pet_id),
  constraint coop_listings_size check (octet_length(resident::text) < 150000)
);

create table if not exists public.coop_hires (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users (id) on delete cascade,
  hirer uuid not null references auth.users (id) on delete cascade,
  pet_id text not null check (pet_id ~ '^[A-Za-z0-9_-]{1,100}$'),
  resident jsonb not null,
  day date not null,
  status text not null default 'out' check (status in ('out', 'back')),
  report jsonb,
  wages int not null default 0 check (wages between 0 and 30),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  wage_day date,
  collected_at timestamptz,
  constraint coop_hires_not_self check (owner <> hirer),
  constraint coop_hires_size check (octet_length(resident::text) < 150000 and octet_length(coalesce(report, '{}'::jsonb)::text) < 2000)
);
create index if not exists coop_hires_owner on public.coop_hires (owner, status);
create index if not exists coop_hires_hirer on public.coop_hires (hirer, day);
create index if not exists coop_hires_pet on public.coop_hires (owner, pet_id, day);

create table if not exists public.coop_duels (
  id uuid primary key default gen_random_uuid(),
  challenger uuid not null references auth.users (id) on delete cascade,
  opponent uuid not null references auth.users (id) on delete cascade,
  game text not null check (game in ('frenzy', 'stack', 'seance', 'whack')),
  stake int not null default 0 check (stake between 0 and 25),
  opponent_staked boolean not null default false,
  status text not null default 'open' check (status in ('open', 'settled')),
  outcome text check (outcome in ('challenger', 'opponent', 'tie', 'void')),
  wins_challenger int not null default 0 check (wins_challenger between 0 and 3),
  wins_opponent int not null default 0 check (wins_opponent between 0 and 3),
  pay_challenger int not null default 0 check (pay_challenger between 0 and 50),
  pay_opponent int not null default 0 check (pay_opponent between 0 and 50),
  claimed_challenger boolean not null default false,
  claimed_opponent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  settled_at timestamptz,
  constraint coop_duels_not_self check (challenger <> opponent)
);
create index if not exists coop_duels_challenger on public.coop_duels (challenger, status);
create index if not exists coop_duels_opponent on public.coop_duels (opponent, status);

create table if not exists public.coop_rounds (
  duel_id uuid not null references public.coop_duels (id) on delete cascade,
  n int not null check (n between 1 and 3),
  first_player uuid not null references auth.users (id) on delete cascade,
  seed bigint not null check (seed between 1 and 2147483647),
  status text not null default 'first' check (status in ('first', 'second', 'done', 'void')),
  first_score int check (first_score >= 0),
  first_log jsonb,
  first_at timestamptz,
  second_started_at timestamptz,
  second_score int check (second_score >= 0),
  second_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (duel_id, n),
  constraint coop_rounds_log_size check (octet_length(coalesce(first_log, '{}'::jsonb)::text) < 40000)
);

-- Per friend, from each side: duels and rounds won and lost, the current and
-- best run of rounds won in a row, and hired-help trips taken together.
create table if not exists public.coop_records (
  user_id uuid not null references auth.users (id) on delete cascade,
  friend uuid not null references auth.users (id) on delete cascade,
  duels_won int not null default 0,
  duels_lost int not null default 0,
  duels_tied int not null default 0,
  rounds_won int not null default 0,
  rounds_lost int not null default 0,
  streak int not null default 0,
  best_streak int not null default 0,
  trips int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, friend),
  constraint coop_records_not_self check (user_id <> friend)
);

create table if not exists private.coop_attempts (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  at timestamptz not null default now()
);
create index if not exists coop_attempts_recent on private.coop_attempts (user_id, kind, at);

-- One row per account that has touched the ledger. total is the sum of every
-- receipt's delta; the co-op balance is opening + (total - opening_base),
-- where opening_base is the sum of the receipts up to opening_seq, which the
-- declared opening already includes. opening stays null until declared.
create table if not exists public.coop_wallets (
  owner uuid primary key references auth.users (id) on delete cascade,
  opening int check (opening between 0 and 100000000),
  opening_seq bigint not null default 0 check (opening_seq >= 0),
  opening_base bigint not null default 0,
  last_seq bigint not null default 0 check (last_seq >= 0),
  total bigint not null default 0,
  opened_at timestamptz,
  created_at timestamptz not null default now()
);

-- Every soul co-op moves, per owner, never deleted while the account exists.
-- source_id is the duel or the hire; there is no foreign key on it, so a
-- receipt outlives the row it came from. detail is a snapshot of what the
-- receipt is for, taken when it is written and never changed (see
-- private.coop_append's callers), so a device that lost an answer gets the
-- story back with the souls.
create table if not exists public.coop_receipts (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users (id) on delete cascade,
  seq bigint not null check (seq > 0),
  kind text not null,
  source_id uuid not null,
  delta int not null,
  earned int not null default 0 check (earned >= 0),
  created_at timestamptz not null default now(),
  constraint coop_receipts_seq unique (owner, seq),
  constraint coop_receipts_once unique (owner, kind, source_id)
);
alter table public.coop_receipts add column if not exists detail jsonb;
-- A stake is negative and earns nothing; a duel payout is positive and earns
-- at most itself; wages earn all of themselves and may be 0 (the day's cap
-- was spent), so every collected report has a receipt.
-- 'adjust' mirrors souls the player earned or spent elsewhere in the game (the
-- souls are one shared purse), so the server's balance stays honest; it never
-- moves souls on a device, and its source_id is the client's operation id.
alter table public.coop_receipts drop constraint if exists coop_receipts_kind;
alter table public.coop_receipts add constraint coop_receipts_kind check (kind in ('stake', 'duel', 'hire', 'adjust'));
-- A stake is negative and earns nothing; a duel settlement is zero or positive
-- and earns at most itself (a loser's or a stakeless duel's is 0, so every
-- settlement leaves a receipt); wages earn all of themselves and may be 0 (the
-- day's cap was spent), so every collected report has a receipt; an adjustment
-- is signed, bounded, and earns nothing.
alter table public.coop_receipts drop constraint if exists coop_receipts_sign;
alter table public.coop_receipts add constraint coop_receipts_sign check (
  (kind = 'stake' and delta between -25 and -1 and earned = 0)
  or (kind = 'duel' and delta between 0 and 50 and earned between 0 and delta)
  or (kind = 'hire' and delta between 0 and 50 and earned = delta)
  or (kind = 'adjust' and delta between -1000000 and 2000 and earned = 0));
alter table public.coop_receipts drop constraint if exists coop_receipts_detail_size;
alter table public.coop_receipts add constraint coop_receipts_detail_size
  check (detail is null or octet_length(detail::text) < 4000);

-- A stake held on a duel, per player. stake_receipt is null for a stake held
-- before the ledger existed (the save took it then). released_at is set when
-- it is paid out, to its owner (a refund) or to the winner.
create table if not exists public.coop_holds (
  duel_id uuid not null references public.coop_duels (id) on delete cascade,
  owner uuid not null references auth.users (id) on delete cascade,
  amount int not null check (amount between 1 and 25),
  stake_receipt uuid,
  released_at timestamptz,
  released_to uuid references auth.users (id) on delete cascade,
  release_receipt uuid,
  created_at timestamptz not null default now(),
  primary key (duel_id, owner)
);
create index if not exists coop_holds_owner on public.coop_holds (owner);

-- Wages paid per lender per UTC day, so the 30 a day cap is one locked row.
create table if not exists private.coop_wage_days (
  owner uuid not null references auth.users (id) on delete cascade,
  day date not null,
  paid int not null default 0 check (paid between 0 and 30),
  primary key (owner, day)
);

-- ---------------------------------------------------------------------------
-- Row level security. Nothing is granted: the functions below do every read
-- and write. The policies say who a row belongs to in case that ever changes.
-- ---------------------------------------------------------------------------

alter table public.coop_listings enable row level security;
alter table public.coop_hires enable row level security;
alter table public.coop_duels enable row level security;
alter table public.coop_rounds enable row level security;
alter table public.coop_records enable row level security;
alter table private.coop_attempts enable row level security;
alter table public.coop_wallets enable row level security;
alter table public.coop_receipts enable row level security;
alter table public.coop_holds enable row level security;
alter table private.coop_wage_days enable row level security;

revoke all on table public.coop_listings, public.coop_hires, public.coop_duels, public.coop_rounds, public.coop_records,
  public.coop_wallets, public.coop_receipts, public.coop_holds
  from public, anon, authenticated;
revoke all on table private.coop_attempts, private.coop_wage_days from public;

drop policy if exists "wallets are for their owner" on public.coop_wallets;
create policy "wallets are for their owner" on public.coop_wallets
  for select to authenticated using ((select auth.uid()) = owner);

drop policy if exists "receipts are for their owner" on public.coop_receipts;
create policy "receipts are for their owner" on public.coop_receipts
  for select to authenticated using ((select auth.uid()) = owner);

drop policy if exists "holds are for their owner" on public.coop_holds;
create policy "holds are for their owner" on public.coop_holds
  for select to authenticated using ((select auth.uid()) = owner);

-- ---------------------------------------------------------------------------
-- Rows from before the ledger. Safe to run again: it only adds what is
-- missing, and a duel made since already has its holds.
-- ---------------------------------------------------------------------------

-- Stakes the save already took: the challenger's from the start, the
-- opponent's once they played. No receipt (the souls left the save before
-- there was a ledger), so the co-op balance the client declares already
-- excludes them, and the refund or winnings collected later add them back.
-- A hold already paid out under the old rules is marked released: in a void
-- or tied series when its owner claimed, in a won series when the winner did.
insert into public.coop_holds (duel_id, owner, amount, released_at, released_to)
select d.id, x.owner, d.stake,
       case when d.status = 'settled' and d.outcome in ('void', 'tie') and x.claimed then coalesce(d.settled_at, now())
            when d.status = 'settled' and d.outcome = 'challenger' and d.claimed_challenger then coalesce(d.settled_at, now())
            when d.status = 'settled' and d.outcome = 'opponent' and d.claimed_opponent then coalesce(d.settled_at, now()) end,
       case when d.status = 'settled' and d.outcome in ('void', 'tie') and x.claimed then x.owner
            when d.status = 'settled' and d.outcome = 'challenger' and d.claimed_challenger then d.challenger
            when d.status = 'settled' and d.outcome = 'opponent' and d.claimed_opponent then d.opponent end
  from public.coop_duels d
 cross join lateral (values (d.challenger, d.claimed_challenger, true), (d.opponent, d.claimed_opponent, d.opponent_staked)) x(owner, claimed, staked)
 where d.stake > 0 and x.staked
   and not exists (select 1 from public.coop_receipts r where r.owner = x.owner and r.kind = 'stake' and r.source_id = d.id)
on conflict do nothing;

-- The wages already paid each lender per day, for the 30 a day cap.
insert into private.coop_wage_days (owner, day, paid)
select owner, wage_day, least(30, sum(wages))::int from public.coop_hires where wage_day is not null group by owner, wage_day
on conflict (owner, day) do update set paid = greatest(private.coop_wage_days.paid, excluded.paid);

drop policy if exists "listings are for their owner" on public.coop_listings;
create policy "listings are for their owner" on public.coop_listings
  for select to authenticated using ((select auth.uid()) = owner);

drop policy if exists "hires are for the two players in them" on public.coop_hires;
create policy "hires are for the two players in them" on public.coop_hires
  for select to authenticated using ((select auth.uid()) in (owner, hirer));

drop policy if exists "duels are for the two players in them" on public.coop_duels;
create policy "duels are for the two players in them" on public.coop_duels
  for select to authenticated using ((select auth.uid()) in (challenger, opponent));

drop policy if exists "rounds are for the two players in them" on public.coop_rounds;
create policy "rounds are for the two players in them" on public.coop_rounds
  for select to authenticated using (exists (select 1 from public.coop_duels d
    where d.id = coop_rounds.duel_id and (select auth.uid()) in (d.challenger, d.opponent)));

drop policy if exists "records are for their owner" on public.coop_records;
create policy "records are for their owner" on public.coop_records
  for select to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Helpers (not callable from the API)
-- ---------------------------------------------------------------------------

create or replace function private.coop_day()
returns date
language sql
stable
set search_path = public
as $$
  select (now() at time zone 'utc')::date;
$$;

-- Serialises one account's capped writes (count then insert), even before it
-- has a profile row. The same helper, byte for byte, is in every migration
-- that needs it, so each file loads on its own and the combined load agrees.
create or replace function private.lock_account(p_user uuid)
returns void
language sql
volatile
set search_path = public
as $$
  select pg_advisory_xact_lock(hashtextextended('shelf-account:' || coalesce(p_user::text, ''), 0));
$$;

-- Two accounts, always in the same order, so two callers cannot deadlock.
create or replace function private.lock_accounts(a uuid, b uuid)
returns void
language plpgsql
volatile
set search_path = public
as $$
begin
  perform private.lock_account(least(a, b));
  if a is distinct from b then perform private.lock_account(greatest(a, b)); end if;
end;
$$;
revoke all on function private.lock_account(uuid) from public;
revoke all on function private.lock_accounts(uuid, uuid) from public;

create or replace function private.coop_blocked(a uuid, b uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (select 1 from public.blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a));
$$;

-- Friends and not blocked either way, or a refusal.
create or replace function private.coop_require_friend(uid uuid, other uuid)
returns void
language plpgsql
stable
set search_path = public
as $$
begin
  if other is null or other = uid or not private.are_friends(uid, other) or private.coop_blocked(uid, other) then
    perform private.refuse('not_friends');
  end if;
end;
$$;

-- Do not disturb, when the postbox migration that adds it has been run.
create or replace function private.coop_dnd(p_user uuid)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  v boolean := false;
begin
  if to_regclass('public.social_prefs') is not null then
    begin
      execute 'select coalesce((select dnd from public.social_prefs where user_id = $1), false)' into v using p_user;
    exception when others then
      v := false;
    end;
  end if;
  return coalesce(v, false);
end;
$$;

-- A friendship point, when the postbox migration that keeps them has been run.
create or replace function private.coop_bump(a uuid, b uuid, p_kind text)
returns void
language plpgsql
set search_path = public
as $$
begin
  if to_regprocedure('private.bump_friendship(uuid,uuid,text)') is not null then
    execute 'select private.bump_friendship($1, $2, $3)' using a, b, p_kind;
  end if;
exception when others then
  null;
end;
$$;

-- Counts one more write of a kind, or refuses once the window is full.
create or replace function private.coop_limit(uid uuid, p_kind text, p_max int, p_window interval)
returns void
language plpgsql
set search_path = public
as $$
begin
  perform private.lock_account(uid);
  if (select count(*) from private.coop_attempts where user_id = uid and kind = p_kind and at > now() - p_window) >= p_max then
    perform private.refuse('rate_limited');
  end if;
  insert into private.coop_attempts (user_id, kind) values (uid, p_kind);
end;
$$;

-- A whole number in a range from a jsonb value, or null.
create or replace function private.coop_int(v jsonb, lo int, hi int)
returns int
language plpgsql
immutable
set search_path = public
as $$
declare
  n numeric;
begin
  if v is null or jsonb_typeof(v) <> 'number' then return null; end if;
  n := (v #>> '{}')::numeric;
  if n <> trunc(n) or n < lo or n > hi then return null; end if;
  return n::int;
end;
$$;

-- A resident as the expedition engine needs it: id, name, traits, the four
-- stats and its look. Anything else is dropped; the reader checks it again.
create or replace function private.coop_clean_resident(p jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  stats jsonb := '{}'::jsonb;
  k text;
  n int;
begin
  if p is null or jsonb_typeof(p) <> 'object' or coalesce(p ->> 'id', '') !~ '^[A-Za-z0-9_-]{1,100}$' then
    perform private.refuse('bad_resident');
  end if;
  if octet_length(p::text) >= 140000 then perform private.refuse('too_large'); end if;
  if jsonb_typeof(coalesce(p -> 'traits', '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p -> 'traits', '[]'::jsonb)) > 6
     or exists (select 1 from jsonb_array_elements(coalesce(p -> 'traits', '[]'::jsonb)) t
                 where jsonb_typeof(t) <> 'string' or (t #>> '{}') !~ '^[a-z0-9-]{1,24}$') then
    perform private.refuse('bad_resident');
  end if;
  if jsonb_typeof(p -> 'stats') is distinct from 'object' then perform private.refuse('bad_resident'); end if;
  foreach k in array array['cute', 'menace', 'damp', 'mystique'] loop
    n := private.coop_int(p -> 'stats' -> k, 1, 10);
    if n is null then perform private.refuse('bad_resident'); end if;
    stats := stats || jsonb_build_object(k, n);
  end loop;
  if jsonb_typeof(p -> 'art') is distinct from 'object' then perform private.refuse('bad_resident'); end if;
  return jsonb_build_object('id', p ->> 'id', 'name', coalesce(nullif(private.clean_text(p ->> 'name', 22), ''), 'Someone'),
    'traits', coalesce(p -> 'traits', '[]'::jsonb), 'stats', stats, 'art', p -> 'art');
end;
$$;

-- A trip report made only of ids and numbers, rebuilt field by field. The
-- crew names are resident names, which friends already see on each other's
-- shelves.
create or replace function private.coop_clean_report(p jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  choices jsonb;
  helped jsonb;
  crew jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' or octet_length(p::text) >= 2000
     or coalesce(p ->> 'route', '') not in ('drawer', 'fridge', 'cupboard')
     or coalesce(p ->> 'gear', '') not in ('thread', 'lantern', 'biscuit')
     or private.coop_int(p -> 'edition', 0, 7) is null or private.coop_int(p -> 'rev', 1, 2) is null
     or private.coop_int(p -> 'score', 0, 12) is null or private.coop_int(p -> 'tier', 0, 2) is null
     or private.coop_int(p -> 'returned', 0, 2) is null
     or jsonb_typeof(p -> 'built') is distinct from 'boolean'
     or jsonb_typeof(p -> 'choices') is distinct from 'array'
     or jsonb_array_length(p -> 'choices') not between 1 and 3
     or jsonb_typeof(coalesce(p -> 'helped', '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p -> 'helped', '[]'::jsonb)) > 3
     or jsonb_typeof(coalesce(p -> 'crew', '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p -> 'crew', '[]'::jsonb)) > 2 then
    perform private.refuse('bad_report');
  end if;
  if exists (select 1 from jsonb_array_elements(p -> 'choices') c where private.coop_int(c, 0, 2) is null)
     or exists (select 1 from jsonb_array_elements(coalesce(p -> 'helped', '[]'::jsonb)) h where private.coop_int(h, 0, 2) is null)
     or exists (select 1 from jsonb_array_elements(coalesce(p -> 'crew', '[]'::jsonb)) c where jsonb_typeof(c) <> 'string') then
    perform private.refuse('bad_report');
  end if;
  select jsonb_agg((c #>> '{}')::int) into choices from jsonb_array_elements(p -> 'choices') c;
  select coalesce(jsonb_agg(distinct (h #>> '{}')::int), '[]'::jsonb) into helped from jsonb_array_elements(coalesce(p -> 'helped', '[]'::jsonb)) h;
  select coalesce(jsonb_agg(coalesce(nullif(private.clean_text(c #>> '{}', 22), ''), 'Someone')), '[]'::jsonb) into crew
    from jsonb_array_elements(coalesce(p -> 'crew', '[]'::jsonb)) c;
  return jsonb_build_object('v', 1, 'route', p ->> 'route', 'gear', p ->> 'gear',
    'edition', private.coop_int(p -> 'edition', 0, 7), 'rev', private.coop_int(p -> 'rev', 1, 2),
    'score', private.coop_int(p -> 'score', 0, 12), 'tier', private.coop_int(p -> 'tier', 0, 2),
    'returned', private.coop_int(p -> 'returned', 0, 2), 'built', (p -> 'built')::boolean,
    'choices', choices, 'helped', helped, 'crew', crew);
end;
$$;

-- Wages for a finished trip, within the lender's 30 a day. The day's total is
-- one row, locked while it is read and raised, so two trips finishing at once
-- cannot both take the last of it.
drop function if exists private.coop_wages(uuid, int);
create or replace function private.coop_grant_wages(p_owner uuid, p_tier int)
returns int
language plpgsql
set search_path = public
as $$
declare
  today date := private.coop_day();
  old int;
  got int;
begin
  insert into private.coop_wage_days (owner, day) values (p_owner, today) on conflict do nothing;
  select paid into old from private.coop_wage_days where owner = p_owner and day = today for update;
  got := greatest(0, least(6 + 3 * coalesce(p_tier, 0), 30 - old));
  update private.coop_wage_days set paid = old + got where owner = p_owner and day = today;
  return got;
end;
$$;

-- A receipt as the API answers it.
create or replace function private.coop_receipt_json(r public.coop_receipts)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select case when r.id is null then null else jsonb_build_object('id', r.id, 'owner', r.owner, 'seq', r.seq, 'kind', r.kind,
    'source_id', r.source_id, 'delta', r.delta, 'earned', r.earned, 'created_at', r.created_at, 'detail', r.detail) end;
$$;

-- Writes the owner's receipt for (kind, source) once and answers it; a second
-- call answers the one already written. seq comes from the owner's wallet row
-- under the owner's lock, so it has no gaps and only goes up.
drop function if exists private.coop_append(uuid, text, uuid, int, int);
create or replace function private.coop_append(p_owner uuid, p_kind text, p_source uuid, p_delta int, p_earned int, p_detail jsonb)
returns public.coop_receipts
language plpgsql
set search_path = public
as $$
declare
  rc public.coop_receipts%rowtype;
  v_seq bigint;
begin
  perform private.lock_account(p_owner);
  select * into rc from public.coop_receipts where owner = p_owner and kind = p_kind and source_id = p_source;
  if found then return rc; end if;
  insert into public.coop_wallets (owner) values (p_owner) on conflict do nothing;
  update public.coop_wallets set last_seq = last_seq + 1, total = total + p_delta where owner = p_owner
  returning last_seq into v_seq;
  insert into public.coop_receipts (owner, seq, kind, source_id, delta, earned, detail)
  values (p_owner, v_seq, p_kind, p_source, p_delta, p_earned, p_detail)
  returning * into rc;
  return rc;
end;
$$;

-- What a 'stake' or 'duel' receipt is for, from the owner's side:
-- { duel_id, game, stake, against, against_name, outcome, wins_mine,
--   wins_theirs }. against_name is '' when either has blocked the other;
-- outcome is null while the series is open (a stake).
create or replace function private.coop_duel_detail(p_owner uuid, p_duel uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object('duel_id', d.id, 'game', d.game, 'stake', d.stake,
    'against', case when d.challenger = p_owner then d.opponent else d.challenger end,
    'against_name', case when private.coop_blocked(d.challenger, d.opponent) then ''
      else coalesce((select display_name from public.profiles
                      where user_id = case when d.challenger = p_owner then d.opponent else d.challenger end), '') end,
    'outcome', d.outcome,
    'wins_mine', case when d.challenger = p_owner then d.wins_challenger else d.wins_opponent end,
    'wins_theirs', case when d.challenger = p_owner then d.wins_opponent else d.wins_challenger end)
    from public.coop_duels d where d.id = p_duel;
$$;

-- What a 'hire' receipt is for, for the lender: the field report as
-- coop_reports shows it. { hire_id, pet_id, name, hirer, hirer_name, report,
-- wages, finished_at }; report is null for a trip that came home by itself,
-- and hirer_name and the report's crew are left out when either has blocked
-- the other.
create or replace function private.coop_hire_detail(p_hire uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object('hire_id', h.id, 'pet_id', h.pet_id, 'name', h.resident ->> 'name', 'hirer', h.hirer,
    'hirer_name', case when private.coop_blocked(h.owner, h.hirer) then ''
      else coalesce((select display_name from public.profiles where user_id = h.hirer), '') end,
    'report', case when private.coop_blocked(h.owner, h.hirer) then h.report - 'crew' else h.report end,
    'wages', h.wages, 'finished_at', h.finished_at)
    from public.coop_hires h where h.id = p_hire;
$$;

-- The owner's co-op balance, or null before an opening is declared.
create or replace function private.coop_available(p_owner uuid)
returns bigint
language sql
stable
set search_path = public
as $$
  select w.opening + (w.total - w.opening_base) from public.coop_wallets w where w.owner = p_owner and w.opening is not null;
$$;

-- Takes a stake out of the owner's balance and holds it on the duel, in the
-- caller's transaction: { the stake receipt }, or null for no stake.
create or replace function private.coop_stake(p_owner uuid, p_duel uuid, p_amount int)
returns public.coop_receipts
language plpgsql
set search_path = public
as $$
declare
  rc public.coop_receipts%rowtype;
  have bigint;
begin
  if coalesce(p_amount, 0) <= 0 then return rc; end if;
  perform private.lock_account(p_owner);
  if not exists (select 1 from public.coop_wallets where owner = p_owner and opening is not null) then
    perform private.refuse('needs_opening');
  end if;
  have := private.coop_available(p_owner);
  if have < p_amount then perform private.refuse('insufficient_souls'); end if;
  rc := private.coop_append(p_owner, 'stake', p_duel, -p_amount, 0, private.coop_duel_detail(p_owner, p_duel));
  insert into public.coop_holds (duel_id, owner, amount, stake_receipt) values (p_duel, p_owner, p_amount, rc.id)
  on conflict do nothing;
  return rc;
end;
$$;

-- The wallet as the API answers it.
create or replace function private.coop_wallet_json(p_owner uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object('ok', true, 'opening', w.opening, 'opening_seq', coalesce(w.opening_seq, 0),
    'balance', private.coop_available(p_owner), 'last_seq', coalesce(w.last_seq, 0))
    from (select 1) one left join public.coop_wallets w on w.owner = p_owner;
$$;

create or replace function private.coop_touch_record(a uuid, b uuid)
returns void
language sql
set search_path = public
as $$
  insert into public.coop_records (user_id, friend) values (a, b), (b, a) on conflict do nothing;
$$;

create or replace function private.coop_round_record(winner uuid, loser uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  perform private.coop_touch_record(winner, loser);
  update public.coop_records set rounds_won = rounds_won + 1, streak = streak + 1,
         best_streak = greatest(best_streak, streak + 1), updated_at = now()
   where user_id = winner and friend = loser;
  update public.coop_records set rounds_lost = rounds_lost + 1, streak = 0, updated_at = now()
   where user_id = loser and friend = winner;
end;
$$;

-- p_outcome is 'a' (a won), 'b' (b won) or 'tie'.
create or replace function private.coop_series_record(a uuid, b uuid, p_outcome text)
returns void
language plpgsql
set search_path = public
as $$
begin
  perform private.coop_touch_record(a, b);
  update public.coop_records set
         duels_won = duels_won + (case when p_outcome = 'a' then 1 else 0 end),
         duels_lost = duels_lost + (case when p_outcome = 'b' then 1 else 0 end),
         duels_tied = duels_tied + (case when p_outcome = 'tie' then 1 else 0 end), updated_at = now()
   where user_id = a and friend = b;
  update public.coop_records set
         duels_won = duels_won + (case when p_outcome = 'b' then 1 else 0 end),
         duels_lost = duels_lost + (case when p_outcome = 'a' then 1 else 0 end),
         duels_tied = duels_tied + (case when p_outcome = 'tie' then 1 else 0 end), updated_at = now()
   where user_id = b and friend = a;
end;
$$;

-- Closes a series and writes down what each player is owed, from the stakes
-- actually held on it. A void series (nobody finished a round, or the two are
-- no longer friends) and a tie return each held stake to its owner; the
-- winner is owed every held stake. Nothing is paid here: each player
-- collects with coop_duel_claim.
create or replace function private.coop_settle(p_duel uuid, p_void boolean)
returns void
language plpgsql
set search_path = public
as $$
declare
  d public.coop_duels%rowtype;
  v_outcome text;
  h_c int;
  h_o int;
begin
  select * into d from public.coop_duels where id = p_duel for update;
  if not found or d.status <> 'open' then return; end if;
  select coalesce(sum(amount) filter (where owner = d.challenger), 0)::int, coalesce(sum(amount) filter (where owner = d.opponent), 0)::int
    into h_c, h_o from public.coop_holds where duel_id = p_duel;
  update public.coop_rounds set status = 'void' where duel_id = p_duel and status in ('first', 'second');
  if p_void or not d.opponent_staked or not exists (select 1 from public.coop_rounds where duel_id = p_duel and status = 'done') then
    v_outcome := 'void';
  elsif d.wins_challenger > d.wins_opponent then v_outcome := 'challenger';
  elsif d.wins_opponent > d.wins_challenger then v_outcome := 'opponent';
  else v_outcome := 'tie';
  end if;
  update public.coop_duels set status = 'settled', outcome = v_outcome, settled_at = now(), updated_at = now(),
         pay_challenger = case v_outcome when 'challenger' then h_c + h_o when 'opponent' then 0 else h_c end,
         pay_opponent = case v_outcome when 'opponent' then h_c + h_o when 'challenger' then 0 else h_o end
   where id = p_duel;
  if v_outcome <> 'void' then
    perform private.coop_series_record(d.challenger, d.opponent,
      case v_outcome when 'challenger' then 'a' when 'opponent' then 'b' else 'tie' end);
  end if;
end;
$$;

-- The second score of a round is in: decide the round, then the series.
create or replace function private.coop_finish_round(p_duel uuid, p_n int, p_score int)
returns void
language plpgsql
set search_path = public
as $$
declare
  d public.coop_duels%rowtype;
  r public.coop_rounds%rowtype;
  second uuid;
begin
  select * into d from public.coop_duels where id = p_duel for update;
  select * into r from public.coop_rounds where duel_id = p_duel and n = p_n for update;
  if r.status <> 'second' then return; end if;
  second := case when r.first_player = d.challenger then d.opponent else d.challenger end;
  update public.coop_rounds set status = 'done', second_score = p_score, second_at = now() where duel_id = p_duel and n = p_n;
  if p_score > r.first_score then
    perform private.coop_round_record(second, r.first_player);
    if second = d.challenger then d.wins_challenger := d.wins_challenger + 1; else d.wins_opponent := d.wins_opponent + 1; end if;
  elsif p_score < r.first_score then
    perform private.coop_round_record(r.first_player, second);
    if r.first_player = d.challenger then d.wins_challenger := d.wins_challenger + 1; else d.wins_opponent := d.wins_opponent + 1; end if;
  end if;
  update public.coop_duels set wins_challenger = d.wins_challenger, wins_opponent = d.wins_opponent, updated_at = now() where id = p_duel;
  if greatest(d.wins_challenger, d.wins_opponent) >= 2 or p_n >= 3 then
    perform private.coop_settle(p_duel, false);
  end if;
end;
$$;

-- Moves this player's hires and duels on and clears out old rows.
create or replace function private.coop_tidy(uid uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  d public.coop_duels%rowtype;
  r record;
  last_round public.coop_rounds%rowtype;
begin
  -- A hire nobody finished comes home after 72 hours, with the smallest wage.
  -- In lender order, so two players tidying at once take the wage rows in the
  -- same order.
  for r in select h.id, h.owner from public.coop_hires h
            where h.status = 'out' and h.created_at <= now() - interval '72 hours' and uid in (h.owner, h.hirer)
            order by h.owner, h.id
            for update loop
    update public.coop_hires set status = 'back', finished_at = now(), wage_day = private.coop_day(),
           wages = private.coop_grant_wages(r.owner, 0)
     where id = r.id and status = 'out';
  end loop;
  -- Rounds that waited 48 hours for a move.
  for r in select x.duel_id, x.n, x.status, x.second_started_at from public.coop_rounds x
             join public.coop_duels y on y.id = x.duel_id
            where y.status = 'open' and uid in (y.challenger, y.opponent)
              and ((x.status = 'first' and x.created_at <= now() - interval '48 hours')
                or (x.status = 'second' and x.first_at <= now() - interval '48 hours')) loop
    if r.status = 'second' and r.second_started_at is not null then
      perform private.coop_finish_round(r.duel_id, r.n, 0);
    else
      update public.coop_rounds set status = 'void' where duel_id = r.duel_id and n = r.n;
    end if;
  end loop;
  for d in select * from public.coop_duels where status = 'open' and uid in (challenger, opponent) loop
    if not private.are_friends(d.challenger, d.opponent) or private.coop_blocked(d.challenger, d.opponent) then
      perform private.coop_settle(d.id, true);
      continue;
    end if;
    select * into last_round from public.coop_rounds where duel_id = d.id order by n desc limit 1;
    if last_round.status = 'void' or (last_round.status = 'done' and last_round.second_at <= now() - interval '48 hours') then
      perform private.coop_settle(d.id, false);
    end if;
  end loop;
  -- Old rows go once nothing in them is owed: a duel with a stake nobody has
  -- collected, or wages nobody has collected, stays until it is.
  delete from public.coop_duels gone where gone.status = 'settled' and gone.settled_at < now() - interval '60 days'
     and uid in (gone.challenger, gone.opponent)
     and not exists (select 1 from public.coop_holds h where h.duel_id = gone.id and h.released_at is null);
  delete from public.coop_hires where created_at < now() - interval '60 days' and uid in (owner, hirer)
     and status = 'back' and (collected_at is not null or wages = 0);
  delete from private.coop_attempts where user_id = uid and at < now() - interval '1 day';
  delete from private.coop_wage_days where owner = uid and day < private.coop_day() - 2;
end;
$$;

revoke all on function private.coop_day() from public;
revoke all on function private.coop_blocked(uuid, uuid) from public;
revoke all on function private.coop_require_friend(uuid, uuid) from public;
revoke all on function private.coop_dnd(uuid) from public;
revoke all on function private.coop_bump(uuid, uuid, text) from public;
revoke all on function private.coop_limit(uuid, text, int, interval) from public;
revoke all on function private.coop_int(jsonb, int, int) from public;
revoke all on function private.coop_clean_resident(jsonb) from public;
revoke all on function private.coop_clean_report(jsonb) from public;
revoke all on function private.coop_grant_wages(uuid, int) from public;
revoke all on function private.coop_receipt_json(public.coop_receipts) from public;
revoke all on function private.coop_append(uuid, text, uuid, int, int, jsonb) from public;
revoke all on function private.coop_duel_detail(uuid, uuid) from public;
revoke all on function private.coop_hire_detail(uuid) from public;
revoke all on function private.coop_available(uuid) from public;
revoke all on function private.coop_stake(uuid, uuid, int) from public;
revoke all on function private.coop_wallet_json(uuid) from public;
revoke all on function private.coop_touch_record(uuid, uuid) from public;
revoke all on function private.coop_round_record(uuid, uuid) from public;
revoke all on function private.coop_series_record(uuid, uuid, text) from public;
revoke all on function private.coop_settle(uuid, boolean) from public;
revoke all on function private.coop_finish_round(uuid, int, int) from public;
revoke all on function private.coop_tidy(uuid) from public;

-- ---------------------------------------------------------------------------
-- Hired help
-- ---------------------------------------------------------------------------

-- Replaces the caller's listings with these residents (two at most; an empty
-- list takes everyone off the board). Thirty changes an hour.
create or replace function public.coop_set_hires(p_residents jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  item jsonb;
  clean jsonb;
  ids text[] := '{}';
begin
  if p_residents is null or jsonb_typeof(p_residents) <> 'array' or jsonb_array_length(p_residents) > 2 then
    perform private.refuse('bad_resident');
  end if;
  perform private.lock_account(uid);
  perform private.coop_limit(uid, 'list', 30, interval '1 hour');
  delete from public.coop_listings where owner = uid;
  for item in select value from jsonb_array_elements(p_residents) loop
    clean := private.coop_clean_resident(item);
    if (clean ->> 'id') = any (ids) then perform private.refuse('bad_resident'); end if;
    ids := ids || (clean ->> 'id');
    insert into public.coop_listings (owner, pet_id, resident, updated_at) values (uid, clean ->> 'id', clean, now());
  end loop;
  return jsonb_build_object('ok', true, 'listed', to_jsonb(ids));
end;
$$;

-- Friends' residents for hire, for the expedition planner:
-- { hired_today, listings: [{ owner, owner_name, pet_id, resident, trips_today, available }] }.
create or replace function public.coop_hire_board()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  today date := private.coop_day();
  hired boolean;
begin
  perform private.coop_tidy(uid);
  hired := exists (select 1 from public.coop_hires where hirer = uid and day = today);
  return jsonb_build_object('hired_today', hired, 'listings', coalesce((
    select jsonb_agg(x.row order by x.sort, x.owner, x.pet_id) from (
      select lower(coalesce(p.display_name, '')) as sort, l.owner, l.pet_id,
             jsonb_build_object('owner', l.owner, 'owner_name', coalesce(p.display_name, ''), 'pet_id', l.pet_id,
               'resident', l.resident, 'trips_today', t.n, 'available', not hired and t.n < 3 and not private.coop_dnd(l.owner)) as row
        from public.coop_listings l
        left join public.profiles p on p.user_id = l.owner
        cross join lateral (select count(*)::int as n from public.coop_hires h
                             where h.owner = l.owner and h.pet_id = l.pet_id and h.day = today) t
       where l.owner <> uid and private.are_friends(uid, l.owner) and not private.coop_blocked(uid, l.owner)
       order by 1, 2, 3 limit 40) x), '[]'::jsonb));
end;
$$;

-- Takes a friend's resident along on today's trip:
-- { ok, id, owner, owner_name, resident }.
create or replace function public.coop_hire(p_owner uuid, p_pet text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  today date := private.coop_day();
  l public.coop_listings%rowtype;
  h public.coop_hires%rowtype;
begin
  perform private.coop_require_friend(uid, p_owner);
  if private.coop_dnd(p_owner) then perform private.refuse('dnd'); end if;
  -- One hire at a time per hirer and per lender, so two taps (or two hirers
  -- after the last trip of the day) cannot both get through.
  perform private.lock_accounts(uid, p_owner);
  select * into l from public.coop_listings where owner = p_owner and pet_id = p_pet for update;
  if not found then perform private.refuse('not_for_hire'); end if;
  if exists (select 1 from public.coop_hires where hirer = uid and day = today) then perform private.refuse('hired_today'); end if;
  if (select count(*) from public.coop_hires where owner = p_owner and pet_id = p_pet and day = today) >= 3 then
    perform private.refuse('fully_booked');
  end if;
  insert into public.coop_hires (owner, hirer, pet_id, resident, day) values (p_owner, uid, p_pet, l.resident, today)
  returning * into h;
  return jsonb_build_object('ok', true, 'id', h.id, 'owner', p_owner,
    'owner_name', coalesce((select display_name from public.profiles where user_id = p_owner), ''), 'resident', h.resident);
end;
$$;

-- The hirer's report when the trip ends. The server sets the wages.
create or replace function public.coop_finish_hire(p_hire uuid, p_report jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  h public.coop_hires%rowtype;
  clean jsonb := private.coop_clean_report(p_report);
  pay int;
begin
  perform private.coop_tidy(uid);
  select * into h from public.coop_hires where id = p_hire and hirer = uid for update;
  if not found then perform private.refuse('not_found'); end if;
  if h.status <> 'out' then perform private.refuse('not_open'); end if;
  pay := private.coop_grant_wages(h.owner, (clean ->> 'tier')::int);
  update public.coop_hires set status = 'back', report = clean, wages = pay, finished_at = now(), wage_day = private.coop_day()
   where id = p_hire;
  perform private.coop_touch_record(h.owner, uid);
  update public.coop_records set trips = trips + 1, updated_at = now()
   where (user_id = h.owner and friend = uid) or (user_id = uid and friend = h.owner);
  perform private.coop_bump(h.owner, uid, 'hire');
  return jsonb_build_object('ok', true, 'wages', pay);
end;
$$;

-- For the lender: what is listed, who is out, and reports waiting to be read.
-- { listed: [{ pet_id, name, trips_today }], away: [{ id, pet_id, name, hirer, hirer_name, since }],
--   reports: [{ id, hirer, hirer_name, pet_id, name, report, wages, finished_at }] }
create or replace function public.coop_reports()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  today date := private.coop_day();
begin
  perform private.coop_tidy(uid);
  return jsonb_build_object(
    'listed', coalesce((select jsonb_agg(jsonb_build_object('pet_id', l.pet_id, 'name', l.resident ->> 'name',
        'trips_today', (select count(*)::int from public.coop_hires h where h.owner = uid and h.pet_id = l.pet_id and h.day = today))
        order by l.updated_at, l.pet_id)
      from public.coop_listings l where l.owner = uid), '[]'::jsonb),
    'away', coalesce((select jsonb_agg(jsonb_build_object('id', h.id, 'pet_id', h.pet_id, 'name', h.resident ->> 'name',
        'hirer', h.hirer, 'hirer_name', coalesce(p.display_name, ''), 'since', h.created_at) order by h.created_at desc)
      from public.coop_hires h left join public.profiles p on p.user_id = h.hirer
     where h.owner = uid and h.status = 'out' and not private.coop_blocked(uid, h.hirer)), '[]'::jsonb),
    'reports', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'hirer', x.hirer, 'hirer_name', x.hirer_name,
        'pet_id', x.pet_id, 'name', x.name, 'report', x.report, 'wages', x.wages, 'finished_at', x.finished_at) order by x.finished_at desc)
      from (select h.id, h.hirer,
                   case when private.coop_blocked(uid, h.hirer) then '' else coalesce(p.display_name, '') end as hirer_name,
                   h.pet_id, h.resident ->> 'name' as name,
                   case when private.coop_blocked(uid, h.hirer) then h.report - 'crew' else h.report end as report,
                   h.wages, h.finished_at
              from public.coop_hires h left join public.profiles p on p.user_id = h.hirer
             where h.owner = uid and h.status = 'back' and h.collected_at is null
             order by h.finished_at desc limit 20) x), '[]'::jsonb));
end;
$$;

-- Reads a report and pays its wages into the ledger, once:
-- { ok, wages, receipt }. receipt is the lender's 'hire' receipt, the same one
-- on every call, written even when the wages were 0 so its detail keeps the
-- report (null only for a report collected before the ledger existed). wages is what this call newly paid: the receipt's delta
-- the first time, 0 after, kept for older clients. A report from someone the
-- lender blocked still pays.
create or replace function public.coop_collect(p_hire uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  h public.coop_hires%rowtype;
  rc public.coop_receipts%rowtype;
begin
  perform private.lock_account(uid);
  select * into h from public.coop_hires where id = p_hire and owner = uid for update;
  if not found then perform private.refuse('not_found'); end if;
  if h.status <> 'back' then perform private.refuse('not_open'); end if;
  select * into rc from public.coop_receipts where owner = uid and kind = 'hire' and source_id = p_hire;
  if found or h.collected_at is not null then
    return jsonb_build_object('ok', true, 'wages', 0, 'receipt', private.coop_receipt_json(rc));
  end if;
  rc := private.coop_append(uid, 'hire', p_hire, h.wages, h.wages, private.coop_hire_detail(p_hire));
  update public.coop_hires set collected_at = now() where id = p_hire;
  return jsonb_build_object('ok', true, 'wages', h.wages, 'receipt', private.coop_receipt_json(rc));
end;
$$;

-- ---------------------------------------------------------------------------
-- Duels
-- ---------------------------------------------------------------------------

-- A new challenge: { ok, id, game, stake, round, seed, receipt }. A stake
-- leaves the challenger's co-op balance in this transaction, as the 'stake'
-- receipt answered here (null for no stake), or the challenge is refused
-- (needs_opening, insufficient_souls).
create or replace function public.coop_duel_create(p_to uuid, p_game text, p_stake int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  d public.coop_duels%rowtype;
  rc public.coop_receipts%rowtype;
  v_seed bigint := 1 + floor(random() * 2147483646)::bigint;
begin
  perform private.coop_require_friend(uid, p_to);
  if private.coop_dnd(p_to) then perform private.refuse('dnd'); end if;
  perform private.check_game(p_game);
  if p_stake is null or p_stake < 0 or p_stake > 25 then perform private.refuse('bad_stake'); end if;
  -- Both accounts: the twelve open is counted from either side.
  perform private.lock_accounts(uid, p_to);
  perform private.coop_tidy(uid);
  if (select count(*) from public.coop_duels where status = 'open' and challenger = uid and opponent = p_to) >= 3
     or (select count(*) from public.coop_duels where status = 'open' and uid in (challenger, opponent)) >= 12 then
    perform private.refuse('too_many_open');
  end if;
  perform private.coop_limit(uid, 'duel', 10, interval '1 day');
  insert into public.coop_duels (challenger, opponent, game, stake) values (uid, p_to, p_game, p_stake) returning * into d;
  insert into public.coop_rounds (duel_id, n, first_player, seed) values (d.id, 1, uid, v_seed);
  rc := private.coop_stake(uid, d.id, d.stake);
  return jsonb_build_object('ok', true, 'id', d.id, 'game', d.game, 'stake', d.stake, 'round', 1, 'seed', v_seed,
    'receipt', private.coop_receipt_json(rc));
end;
$$;

-- The caller's turn in the current round: { round, seed, role, game, stake,
-- ghost, against }. The second player gets the first player's input log as
-- `ghost`, never their score. Playing the first round as the opponent puts
-- up the stake, in this transaction, or the play is refused (needs_opening,
-- insufficient_souls). `receipt` is the caller's 'stake' receipt for this
-- duel whenever one exists (the same one on every call), else null.
create or replace function public.coop_duel_play(p_duel uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  d public.coop_duels%rowtype;
  r public.coop_rounds%rowtype;
  rc public.coop_receipts%rowtype;
begin
  perform private.lock_account(uid);
  perform private.coop_tidy(uid);
  select * into d from public.coop_duels where id = p_duel and uid in (challenger, opponent) for update;
  if not found then perform private.refuse('not_found'); end if;
  if d.status <> 'open' then perform private.refuse('not_open'); end if;
  perform private.coop_require_friend(uid, case when uid = d.challenger then d.opponent else d.challenger end);
  select * into r from public.coop_rounds where duel_id = p_duel order by n desc limit 1 for update;
  if r.status = 'first' and r.first_player = uid then
    select * into rc from public.coop_receipts where owner = uid and kind = 'stake' and source_id = p_duel;
    return jsonb_build_object('ok', true, 'round', r.n, 'seed', r.seed, 'role', 'first', 'game', d.game, 'stake', d.stake,
      'ghost', null, 'against', '', 'receipt', private.coop_receipt_json(rc));
  end if;
  if r.status <> 'second' or r.first_player = uid then perform private.refuse('not_your_turn'); end if;
  if uid = d.opponent and not d.opponent_staked then
    perform private.coop_stake(uid, p_duel, d.stake);
    update public.coop_duels set opponent_staked = true, updated_at = now() where id = p_duel;
  end if;
  if r.second_started_at is null then
    update public.coop_rounds set second_started_at = now() where duel_id = p_duel and n = r.n;
  end if;
  select * into rc from public.coop_receipts where owner = uid and kind = 'stake' and source_id = p_duel;
  return jsonb_build_object('ok', true, 'round', r.n, 'seed', r.seed, 'role', 'second', 'game', d.game, 'stake', d.stake,
    'ghost', r.first_log, 'against', coalesce((select display_name from public.profiles where user_id = r.first_player), ''),
    'receipt', private.coop_receipt_json(rc));
end;
$$;

-- Files the caller's score for their round. The first score is sealed; the
-- second decides the round and answers with both scores.
create or replace function public.coop_duel_submit(p_duel uuid, p_round int, p_score int, p_log jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  d public.coop_duels%rowtype;
  r public.coop_rounds%rowtype;
begin
  perform private.coop_tidy(uid);
  select * into d from public.coop_duels where id = p_duel and uid in (challenger, opponent) for update;
  if not found then perform private.refuse('not_found'); end if;
  if p_score is null or p_score < 0 or p_score > private.score_cap(d.game) then perform private.refuse('bad_score'); end if;
  if d.status <> 'open' then perform private.refuse('not_open'); end if;
  select * into r from public.coop_rounds where duel_id = p_duel and n = p_round for update;
  if not found then perform private.refuse('not_found'); end if;
  if r.status = 'first' and r.first_player = uid then
    if p_log is not null and (jsonb_typeof(p_log) <> 'object' or octet_length(p_log::text) >= 38000
        or coalesce(p_log ->> 'game', '') <> d.game or jsonb_typeof(p_log -> 'inputs') is distinct from 'array') then
      perform private.refuse('bad_log');
    end if;
    update public.coop_rounds set status = 'second', first_score = p_score, first_log = p_log, first_at = now()
     where duel_id = p_duel and n = p_round;
    update public.coop_duels set updated_at = now() where id = p_duel;
    perform private.coop_bump(d.challenger, d.opponent, 'duel');
    return jsonb_build_object('ok', true, 'round', p_round, 'status', 'second');
  end if;
  if r.status <> 'second' or r.first_player = uid or r.second_started_at is null then perform private.refuse('not_your_turn'); end if;
  perform private.coop_finish_round(p_duel, p_round, p_score);
  select * into d from public.coop_duels where id = p_duel;
  return jsonb_build_object('ok', true, 'round', p_round, 'status', 'done', 'first_score', r.first_score, 'second_score', p_score,
    'wins_challenger', d.wins_challenger, 'wins_opponent', d.wins_opponent, 'settled', d.status = 'settled', 'outcome', d.outcome);
end;
$$;

-- Turns down the round waiting for the caller, or withdraws one the caller
-- has not played yet. The series closes on the rounds already decided.
create or replace function public.coop_duel_decline(p_duel uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  d public.coop_duels%rowtype;
  r public.coop_rounds%rowtype;
begin
  select * into d from public.coop_duels where id = p_duel and uid in (challenger, opponent) for update;
  if not found then perform private.refuse('not_found'); end if;
  if d.status <> 'open' then perform private.refuse('not_open'); end if;
  select * into r from public.coop_rounds where duel_id = p_duel order by n desc limit 1 for update;
  if not ((r.status = 'second' and r.first_player <> uid and r.second_started_at is null)
       or (r.status = 'first' and r.first_player = uid)) then
    perform private.refuse('not_your_turn');
  end if;
  update public.coop_rounds set status = 'void' where duel_id = p_duel and n = r.n;
  perform private.coop_settle(p_duel, false);
  return jsonb_build_object('ok', true);
end;
$$;

-- Another round after a decided one, while the series is still open: the
-- caller plays first. { ok, round, seed }.
create or replace function public.coop_duel_rematch(p_duel uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  d public.coop_duels%rowtype;
  r public.coop_rounds%rowtype;
  v_seed bigint := 1 + floor(random() * 2147483646)::bigint;
begin
  perform private.coop_tidy(uid);
  select * into d from public.coop_duels where id = p_duel and uid in (challenger, opponent) for update;
  if not found then perform private.refuse('not_found'); end if;
  perform private.coop_require_friend(uid, case when uid = d.challenger then d.opponent else d.challenger end);
  select * into r from public.coop_rounds where duel_id = p_duel order by n desc limit 1;
  if d.status <> 'open' or r.status <> 'done' or r.n >= 3 then perform private.refuse('not_open'); end if;
  insert into public.coop_rounds (duel_id, n, first_player, seed) values (p_duel, r.n + 1, uid, v_seed);
  update public.coop_duels set updated_at = now() where id = p_duel;
  return jsonb_build_object('ok', true, 'round', r.n + 1, 'seed', v_seed);
end;
$$;

-- The caller's duels: every open one and settled ones from the last 14 days
-- that still owe them something or have not been seen. Scores are only shown
-- once both have played, except the caller's own.
create or replace function public.coop_duels()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
begin
  perform private.coop_tidy(uid);
  return coalesce((select jsonb_agg(x.row order by x.updated_at desc) from (
    select d.updated_at, jsonb_build_object(
      'id', d.id, 'challenger', d.challenger, 'opponent', d.opponent,
      'challenger_name', case when private.coop_blocked(uid, d.challenger) then '' else coalesce(pc.display_name, '') end,
      'opponent_name', case when private.coop_blocked(uid, d.opponent) then '' else coalesce(po.display_name, '') end,
      'game', d.game, 'stake', d.stake, 'opponent_staked', d.opponent_staked, 'status', d.status, 'outcome', d.outcome,
      'wins_challenger', d.wins_challenger, 'wins_opponent', d.wins_opponent,
      'payout', case when uid = d.challenger then d.pay_challenger else d.pay_opponent end,
      'claimed', case when uid = d.challenger then d.claimed_challenger else d.claimed_opponent end,
      'created_at', d.created_at, 'updated_at', d.updated_at, 'settled_at', d.settled_at,
      'rounds', (select coalesce(jsonb_agg(jsonb_build_object('n', r.n, 'first_player', r.first_player, 'status', r.status,
          'first_score', case when r.status = 'done' or r.first_player = uid then r.first_score end,
          'second_score', case when r.status = 'done' then r.second_score end,
          'started', r.second_started_at is not null,
          'created_at', r.created_at, 'first_at', r.first_at, 'second_at', r.second_at) order by r.n), '[]'::jsonb)
        from public.coop_rounds r where r.duel_id = d.id)) as row
      from public.coop_duels d
      left join public.profiles pc on pc.user_id = d.challenger
      left join public.profiles po on po.user_id = d.opponent
     where uid in (d.challenger, d.opponent)
       and (d.status = 'open' or ((d.settled_at > now() - interval '14 days'
              or (case when uid = d.challenger then d.pay_challenger else d.pay_opponent end) > 0)
            and not (case when uid = d.challenger then d.claimed_challenger else d.claimed_opponent end)))
       and (d.status <> 'open' or not private.coop_blocked(d.challenger, d.opponent))
     order by d.updated_at desc limit 30) x), '[]'::jsonb);
end;
$$;

-- Collects what a settled series owes the caller into the ledger and marks it
-- seen: { ok, souls, receipt }. receipt is the caller's 'duel' receipt, the
-- same one on every call (null when nothing was owed). souls is what this
-- call newly paid: the receipt's delta the first time, 0 after, kept for
-- older clients. The payout comes only from stakes held on this series and
-- not yet paid out: a void or tied series returns the caller's own, the
-- winner takes every one. earned is the other player's stake, if any.
create or replace function public.coop_duel_claim(p_duel uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  d public.coop_duels%rowtype;
  rc public.coop_receipts%rowtype;
  won boolean;
  owed int;
  own int;
begin
  perform private.lock_account(uid);
  perform private.coop_tidy(uid);
  select * into d from public.coop_duels where id = p_duel and uid in (challenger, opponent) for update;
  if not found then perform private.refuse('not_found'); end if;
  if d.status <> 'settled' then perform private.refuse('not_open'); end if;
  select * into rc from public.coop_receipts where owner = uid and kind = 'duel' and source_id = p_duel;
  if found then
    return jsonb_build_object('ok', true, 'souls', 0, 'receipt', private.coop_receipt_json(rc));
  end if;
  won := d.outcome = case when uid = d.challenger then 'challenger' else 'opponent' end;
  select coalesce(sum(h.amount), 0)::int, coalesce(sum(h.amount) filter (where h.owner = uid), 0)::int into owed, own
    from public.coop_holds h
   where h.duel_id = p_duel and h.released_at is null
     and (won or (h.owner = uid and d.outcome in ('void', 'tie')));
  -- Every settlement leaves a receipt, a zero one for a loser or a duel with
  -- nothing staked, so the history replays from the ledger after the duel rows prune.
  rc := private.coop_append(uid, 'duel', p_duel, owed, case when owed > 0 then owed - own else 0 end, private.coop_duel_detail(uid, p_duel));
  if owed > 0 then
    update public.coop_holds h set released_at = now(), released_to = uid, release_receipt = rc.id
     where h.duel_id = p_duel and h.released_at is null
       and (won or (h.owner = uid and d.outcome in ('void', 'tie')));
  end if;
  if uid = d.challenger then
    update public.coop_duels set claimed_challenger = true where id = p_duel;
  else
    update public.coop_duels set claimed_opponent = true where id = p_duel;
  end if;
  return jsonb_build_object('ok', true, 'souls', owed, 'receipt', private.coop_receipt_json(rc));
end;
$$;

-- ---------------------------------------------------------------------------
-- The ledger
-- ---------------------------------------------------------------------------

-- Declares the caller's opening co-op balance, once per account: p_souls is
-- the souls in the save now, p_after the last receipt seq those souls
-- already include (0 for none). Later calls change nothing. p_souls is
-- clamped to 0..100000000 and p_after to the last seq written, both of which
-- only ever lower the balance. Answers the wallet (see coop_wallet) with
-- accepted: true when this call set the opening.
create or replace function public.coop_open(p_souls int, p_after bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  w public.coop_wallets%rowtype;
  v_seq bigint;
  accepted boolean := false;
begin
  if p_souls is null then perform private.refuse('bad_balance'); end if;
  if p_after is null or p_after < 0 then perform private.refuse('bad_seq'); end if;
  perform private.lock_account(uid);
  insert into public.coop_wallets (owner) values (uid) on conflict do nothing;
  select * into w from public.coop_wallets where owner = uid for update;
  if w.opening is null then
    v_seq := least(p_after, w.last_seq);
    update public.coop_wallets set opening = least(greatest(p_souls, 0), 100000000), opening_seq = v_seq,
           opening_base = coalesce((select sum(delta) from public.coop_receipts where owner = uid and seq <= v_seq), 0),
           opened_at = now()
     where owner = uid;
    accepted := true;
  end if;
  return private.coop_wallet_json(uid) || jsonb_build_object('accepted', accepted);
end;
$$;

-- The caller's wallet: { ok, opening, opening_seq, balance, last_seq }.
-- opening and balance are null until coop_open; balance is the co-op balance
-- a stake is checked against; last_seq is the newest receipt's seq (0 for none).
create or replace function public.coop_wallet()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select private.coop_wallet_json(private.require_user());
$$;

-- Mirrors souls the player earned or spent elsewhere in the game, so the
-- balance a stake is checked against follows the one shared purse. p_ops is
-- [{ op uuid, delta int, reason text }], at most 50, applied together or not at
-- all. Each op is idempotent by (account, op): a repeat answers the receipt
-- already written, and the same op with a different delta is refused bad_op.
-- A spend (negative) is never capped and may take the balance below zero (debt
-- from offline play): that only blocks new stakes. Earnings are capped at 2000
-- an op and 6000 a UTC day, the one control on what the server cannot see.
-- Answers { ok, receipts: [one per op, in order], balance, last_seq }. The
-- client does NOT apply these receipts to its souls: they mirror what it
-- already did. Needs coop_open first (needs_opening).
create or replace function public.coop_adjust(p_ops jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  item jsonb;
  v_op uuid;
  v_delta int;
  v_reason text;
  rc public.coop_receipts%rowtype;
  out jsonb := '[]'::jsonb;
  today_in bigint;
begin
  if p_ops is null or jsonb_typeof(p_ops) <> 'array' or jsonb_array_length(p_ops) not between 1 and 50 then
    perform private.refuse('bad_op');
  end if;
  perform private.lock_account(uid);
  if not exists (select 1 from public.coop_wallets where owner = uid and opening is not null) then
    perform private.refuse('needs_opening');
  end if;
  select coalesce(sum(delta), 0) into today_in from public.coop_receipts
   where owner = uid and kind = 'adjust' and delta > 0 and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  for item in select value from jsonb_array_elements(p_ops) loop
    if jsonb_typeof(item) <> 'object' or jsonb_typeof(item -> 'op') is distinct from 'string'
       or (item ->> 'op') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or jsonb_typeof(item -> 'delta') is distinct from 'number' or (item ->> 'delta') !~ '^-?[0-9]{1,7}$' then
      perform private.refuse('bad_op');
    end if;
    v_op := (item ->> 'op')::uuid;
    v_delta := (item ->> 'delta')::int;
    v_reason := lower(coalesce(item ->> 'reason', ''));
    if v_reason !~ '^[a-z0-9-]{0,24}$' then v_reason := ''; end if;
    if v_delta = 0 or v_delta < -1000000 or v_delta > 2000 then perform private.refuse('bad_op'); end if;
    select * into rc from public.coop_receipts where owner = uid and kind = 'adjust' and source_id = v_op;
    if found then
      if rc.delta <> v_delta then perform private.refuse('bad_op'); end if;
    else
      if v_delta > 0 then
        today_in := today_in + v_delta;
        if today_in > 6000 then perform private.refuse('cap_reached'); end if;
      end if;
      rc := private.coop_append(uid, 'adjust', v_op, v_delta, 0, jsonb_build_object('reason', v_reason));
    end if;
    out := out || jsonb_build_array(private.coop_receipt_json(rc));
  end loop;
  return jsonb_build_object('ok', true, 'receipts', out, 'balance', private.coop_available(uid),
    'last_seq', coalesce((select last_seq from public.coop_wallets where owner = uid), 0));
end;
$$;

-- The caller's receipts with seq > p_after, oldest first, 100 at a time:
-- { ok, receipts: [{ id, owner, seq, kind, source_id, delta, earned, created_at, detail }],
--   has_more, last_seq }. has_more says to ask again after the last seq in
-- this page; last_seq is the newest seq the caller has.
create or replace function public.coop_receipts(p_after bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  v_rows jsonb;
  n int;
begin
  select coalesce(jsonb_agg(private.coop_receipt_json(x.r) order by x.seq), '[]'::jsonb), count(*)::int into v_rows, n
    from (select r, r.seq from public.coop_receipts r where r.owner = uid and r.seq > greatest(coalesce(p_after, 0), 0)
           order by r.seq limit 101) x;
  if n > 100 then v_rows := v_rows - 100; end if;
  return jsonb_build_object('ok', true, 'receipts', v_rows, 'has_more', n > 100,
    'last_seq', coalesce((select last_seq from public.coop_wallets where owner = uid), 0));
end;
$$;

-- The caller's records against each current friend.
create or replace function public.coop_records()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('friend', r.friend, 'duels_won', r.duels_won, 'duels_lost', r.duels_lost,
      'duels_tied', r.duels_tied, 'rounds_won', r.rounds_won, 'rounds_lost', r.rounds_lost, 'streak', r.streak,
      'best_streak', r.best_streak, 'trips', r.trips) order by r.updated_at desc), '[]'::jsonb)
    from public.coop_records r
   where r.user_id = private.require_user() and private.are_friends(r.user_id, r.friend);
$$;

-- ---------------------------------------------------------------------------
-- Who may call what: signed-in players (anonymous ones included), nobody else.
-- ---------------------------------------------------------------------------

revoke all on function public.coop_set_hires(jsonb) from public, anon, authenticated;
revoke all on function public.coop_hire_board() from public, anon, authenticated;
revoke all on function public.coop_hire(uuid, text) from public, anon, authenticated;
revoke all on function public.coop_finish_hire(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.coop_reports() from public, anon, authenticated;
revoke all on function public.coop_collect(uuid) from public, anon, authenticated;
revoke all on function public.coop_duel_create(uuid, text, int) from public, anon, authenticated;
revoke all on function public.coop_duel_play(uuid) from public, anon, authenticated;
revoke all on function public.coop_duel_submit(uuid, int, int, jsonb) from public, anon, authenticated;
revoke all on function public.coop_duel_decline(uuid) from public, anon, authenticated;
revoke all on function public.coop_duel_rematch(uuid) from public, anon, authenticated;
revoke all on function public.coop_duels() from public, anon, authenticated;
revoke all on function public.coop_duel_claim(uuid) from public, anon, authenticated;
revoke all on function public.coop_records() from public, anon, authenticated;

grant execute on function public.coop_set_hires(jsonb) to authenticated;
grant execute on function public.coop_hire_board() to authenticated;
grant execute on function public.coop_hire(uuid, text) to authenticated;
grant execute on function public.coop_finish_hire(uuid, jsonb) to authenticated;
grant execute on function public.coop_reports() to authenticated;
grant execute on function public.coop_collect(uuid) to authenticated;
grant execute on function public.coop_duel_create(uuid, text, int) to authenticated;
grant execute on function public.coop_duel_play(uuid) to authenticated;
grant execute on function public.coop_duel_submit(uuid, int, int, jsonb) to authenticated;
grant execute on function public.coop_duel_decline(uuid) to authenticated;
grant execute on function public.coop_duel_rematch(uuid) to authenticated;
grant execute on function public.coop_duels() to authenticated;
grant execute on function public.coop_duel_claim(uuid) to authenticated;
grant execute on function public.coop_records() to authenticated;

revoke all on function public.coop_open(int, bigint) from public, anon, authenticated;
revoke all on function public.coop_wallet() from public, anon, authenticated;
revoke all on function public.coop_receipts(bigint) from public, anon, authenticated;
revoke all on function public.coop_adjust(jsonb) from public, anon, authenticated;

grant execute on function public.coop_open(int, bigint) to authenticated;
grant execute on function public.coop_wallet() to authenticated;
grant execute on function public.coop_receipts(bigint) to authenticated;
grant execute on function public.coop_adjust(jsonb) to authenticated;

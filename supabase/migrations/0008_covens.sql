-- Shelf Life: covens. Small friend groups (six at most) with a name, a sigil,
-- a weekly rite with a shared chest, a notice board of fridge-magnet notes,
-- Monday awards, and invite rewards for bringing a new player in.
--
-- Run after 0001_accounts_and_saves.sql and 0002_social.sql. Safe to run more
-- than once, and it keeps their rules:
--   * every table hangs off auth.users (directly or through a coven) on delete
--     cascade, so delete_my_account() removes all of it without being edited;
--   * row level security is on everywhere and nothing is granted on the
--     tables: every read and write is a security definer function that starts
--     from private.require_user();
--   * nothing a player sends is trusted. The server decides the week (UTC,
--     Monday to Sunday), the goal, who may join, what counts and who is paid.
--
-- Refusals raise errcode P0001 with a short token as the message:
--   no_coven, already_in_coven, in_a_coven, not_founder, not_member, not_friends,
--   not_found, coven_full, too_many_open, dnd, rate_limited, bad_coven,
--   bad_day, bad_counts, bad_week, bad_tier, not_reached, not_eligible,
--   bad_note, not_allowed, self, not_new, already_referred, too_many,
--   cap_reached, not_ready.
-- src/cloud/coven.js turns them into copy.
--
-- Nothing here is free text. A coven's name and sigil are ids from word banks
-- and part lists in src/content/coven.js; a note is a list of tile ids from the
-- magnet bank in src/content/magnets.js, plus "@<user id>" tiles that name a
-- member. The server checks the shape; readers draw only ids they know, so an
-- unknown id from a modified client is never shown.
--
-- Housekeeping happens as the functions run (old tallies, weeks, claims,
-- notes, active days and rate rows are trimmed). By hand, now and then:
--   delete from public.coven_invites where created_at < now() - interval '7 days';
--   delete from public.coven_tallies where day < current_date - 42;
--   delete from private.coven_actions where at < now() - interval '1 day';

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.covens (
  id uuid primary key default gen_random_uuid(),
  name_a text not null check (name_a ~ '^[a-z0-9-]{1,24}$'),
  name_b text not null check (name_b ~ '^[a-z0-9-]{1,24}$'),
  name_form smallint not null default 0 check (name_form between 0 and 3),
  sigil_shape text not null check (sigil_shape ~ '^[a-z0-9-]{1,24}$'),
  sigil_symbol text not null check (sigil_symbol ~ '^[a-z0-9-]{1,24}$'),
  sigil_colour text not null check (sigil_colour ~ '^[a-z0-9-]{1,24}$'),
  created_at timestamptz not null default now()
);

-- One row per player: the primary key is what makes it one coven each.
create table if not exists public.coven_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  coven_id uuid not null references public.covens (id) on delete cascade,
  role text not null default 'member' check (role in ('founder', 'member')),
  frame text not null default '' check (frame ~ '^[a-z0-9-]{0,24}$'),
  joined_at timestamptz not null default now()
);
create index if not exists coven_members_coven on public.coven_members (coven_id);
create unique index if not exists coven_members_one_founder on public.coven_members (coven_id) where role = 'founder';

create table if not exists public.coven_invites (
  id uuid primary key default gen_random_uuid(),
  coven_id uuid not null references public.covens (id) on delete cascade,
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint coven_invites_not_self check (from_user <> to_user),
  constraint coven_invites_once unique (coven_id, to_user)
);
create index if not exists coven_invites_to on public.coven_invites (to_user);

-- The rite for one coven for one week, fixed the first time anyone looks.
create table if not exists public.coven_weeks (
  coven_id uuid not null references public.covens (id) on delete cascade,
  week int not null,
  goal text not null check (goal ~ '^[a-z0-9-]{1,32}$'),
  counter text not null check (counter ~ '^[a-z]{1,16}$'),
  target int not null check (target between 1 and 10000),
  primary key (coven_id, week)
);

-- What each member did for the coven, per UTC day and counter. Each amount is
-- the day's running total, so reporting it twice changes nothing.
create table if not exists public.coven_tallies (
  coven_id uuid not null references public.covens (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  counter text not null check (counter ~ '^[a-z]{1,16}$'),
  amount int not null check (amount between 0 and 1000),
  updated_at timestamptz not null default now(),
  primary key (coven_id, user_id, day, counter)
);
create index if not exists coven_tallies_user_day on public.coven_tallies (user_id, day);

-- Chests paid, one per player per week per tier whichever coven they were in,
-- so hopping covens cannot open the same chest twice. No foreign key to the
-- coven for the same reason: the record outlives a dissolved coven.
create table if not exists public.coven_claims (
  user_id uuid not null references auth.users (id) on delete cascade,
  week int not null,
  tier smallint not null check (tier between 1 and 3),
  coven_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, week, tier)
);

create table if not exists public.coven_notes (
  id bigint generated always as identity primary key,
  coven_id uuid not null references public.covens (id) on delete cascade,
  author uuid not null references auth.users (id) on delete cascade,
  tiles text[] not null check (cardinality(tiles) between 1 and 12),
  mentions uuid[] not null default '{}' check (cardinality(mentions) <= 3),
  created_at timestamptz not null default now()
);
create index if not exists coven_notes_coven on public.coven_notes (coven_id, id desc);

-- Days a player opened the game while signed in, for invite rewards.
create table if not exists public.active_days (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);

-- Who brought whom in. One inviter per new player.
create table if not exists public.referrals (
  invitee uuid primary key references auth.users (id) on delete cascade,
  inviter uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  inviter_claimed_at timestamptz,
  invitee_claimed_at timestamptz,
  constraint referrals_not_self check (inviter <> invitee)
);
create index if not exists referrals_inviter on public.referrals (inviter);

-- Every write that can be repeated is counted here and rate limited.
create table if not exists private.coven_actions (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  at timestamptz not null default now()
);
create index if not exists coven_actions_recent on private.coven_actions (user_id, kind, at);

-- ---------------------------------------------------------------------------
-- Row level security: on, and nothing granted. The functions do all of it.
-- ---------------------------------------------------------------------------

alter table public.covens enable row level security;
alter table public.coven_members enable row level security;
alter table public.coven_invites enable row level security;
alter table public.coven_weeks enable row level security;
alter table public.coven_tallies enable row level security;
alter table public.coven_claims enable row level security;
alter table public.coven_notes enable row level security;
alter table public.active_days enable row level security;
alter table public.referrals enable row level security;
alter table private.coven_actions enable row level security;

revoke all on table public.covens, public.coven_members, public.coven_invites, public.coven_weeks, public.coven_tallies,
  public.coven_claims, public.coven_notes, public.active_days, public.referrals from public, anon, authenticated;
revoke all on table private.coven_actions from public;

-- ---------------------------------------------------------------------------
-- Helpers (not callable from the API)
-- ---------------------------------------------------------------------------

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

-- Weeks run Monday to Sunday in UTC. Day 0 (1970-01-01) was a Thursday, so
-- adding three puts every Monday at the start of a week. src/engine/coven.js
-- counts the same way.
create or replace function private.coven_week_of(p_day date)
returns int
language sql
immutable
set search_path = public
as $$
  select ((p_day - date '1970-01-01') + 3) / 7;
$$;

create or replace function private.coven_week_start(p_week int)
returns date
language sql
immutable
set search_path = public
as $$
  select date '1970-01-01' + (p_week * 7 - 3);
$$;

-- The moment a week starts, as a timestamp, whatever the session time zone.
create or replace function private.coven_week_at(p_week int)
returns timestamptz
language sql
immutable
set search_path = public
as $$
  select (date '1970-01-01' + (p_week * 7 - 3))::timestamp at time zone 'utc';
$$;

create or replace function private.coven_today()
returns date
language sql
stable
set search_path = public
as $$
  select (now() at time zone 'utc')::date;
$$;

-- What one player can do for a coven in one UTC day, per counter: about what a
-- heavy, honest player manages (an emergency every twelve minutes, the omen
-- once, three chores, one docket, one daily challenge). Unknown counters are null.
create or replace function private.coven_cap(p_counter text)
returns int
language sql
immutable
set search_path = public
as $$
  select case p_counter
    when 'emergency' then 130 when 'coffin' then 80 when 'care' then 400 when 'court' then 40
    when 'arcade' then 150 when 'expedition' then 30 when 'curio' then 40 when 'omen' then 1
    when 'chore' then 3 when 'docket' then 1 when 'daily' then 1 end;
$$;

-- The weekly goals: id, counter, and the amount asked of each member. The
-- copy lives in src/content/coven.js (GOALS), which a test keeps in step.
create or replace function private.coven_goals()
returns table (goal text, counter text, per int)
language sql
immutable
set search_path = public
as $$
  values
    ('emergency-12', 'emergency', 12), ('emergency-15', 'emergency', 15), ('emergency-18', 'emergency', 18),
    ('emergency-24', 'emergency', 24), ('coffin-3', 'coffin', 3), ('coffin-4', 'coffin', 4), ('coffin-5', 'coffin', 5),
    ('care-25', 'care', 25), ('care-32', 'care', 32), ('care-40', 'care', 40), ('court-2', 'court', 2), ('court-3', 'court', 3),
    ('arcade-6', 'arcade', 6), ('arcade-8', 'arcade', 8), ('arcade-10', 'arcade', 10), ('expedition-2', 'expedition', 2),
    ('curio-1', 'curio', 1), ('omen-4', 'omen', 4), ('omen-5', 'omen', 5), ('chore-9', 'chore', 9), ('chore-12', 'chore', 12),
    ('docket-3', 'docket', 3), ('daily-3', 'daily', 3), ('daily-4', 'daily', 4);
$$;

-- The three chests open at a third, two thirds and all of the target.
create or replace function private.coven_threshold(p_target int, p_tier int)
returns int
language sql
immutable
set search_path = public
as $$
  select case p_tier when 1 then ceil(p_target / 3.0)::int when 2 then ceil(p_target * 2 / 3.0)::int else p_target end;
$$;

create or replace function private.coven_of(p_user uuid)
returns uuid
language sql
stable
set search_path = public
as $$
  select coven_id from public.coven_members where user_id = p_user;
$$;

create or replace function private.coven_founder(p_coven uuid)
returns uuid
language sql
stable
set search_path = public
as $$
  select user_id from public.coven_members where coven_id = p_coven and role = 'founder';
$$;

-- A block either way between this player and anyone in the coven.
create or replace function private.coven_blocked(p_user uuid, p_coven uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.coven_members m join public.blocks b
      on (b.blocker = m.user_id and b.blocked = p_user) or (b.blocker = p_user and b.blocked = m.user_id)
     where m.coven_id = p_coven and m.user_id <> p_user);
$$;

-- Counts this action and refuses past the limit. The window is a day at most.
create or replace function private.coven_rate(p_user uuid, p_kind text, p_max int, p_window interval)
returns void
language plpgsql
set search_path = public
as $$
begin
  -- Counted and recorded under the player's lock, so a burst cannot pass the limit.
  perform private.lock_account(p_user);
  delete from private.coven_actions where user_id = p_user and at < now() - interval '1 day';
  if (select count(*) from private.coven_actions where user_id = p_user and kind = p_kind and at > now() - p_window) >= p_max then
    perform private.refuse('rate_limited');
  end if;
  insert into private.coven_actions (user_id, kind) values (p_user, p_kind);
end;
$$;

-- Do not disturb belongs to the postbox migration, which may or may not have
-- run. Asked only if it exists.
create or replace function private.coven_dnd(p_user uuid)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  busy boolean := false;
begin
  if to_regprocedure('private.dnd_on(uuid)') is not null then
    execute 'select coalesce(private.dnd_on($1), false)' into busy using p_user;
  end if;
  return coalesce(busy, false);
end;
$$;

-- Friendship levels belong to the postbox migration too.
create or replace function private.coven_bump(a uuid, b uuid, p_kind text)
returns void
language plpgsql
set search_path = public
as $$
begin
  if to_regprocedure('private.bump_friendship(uuid,uuid,text)') is not null then
    execute 'select private.bump_friendship($1, $2, $3)' using a, b, p_kind;
  end if;
end;
$$;

-- The week's rite, chosen the first time anyone needs it and fixed after
-- that. Never the same goal two weeks running. The target is the goal's
-- amount for each member who is in the coven at that moment, two at least.
create or replace function private.coven_week_row(p_coven uuid, p_week int)
returns public.coven_weeks
language plpgsql
set search_path = public
as $$
declare
  w public.coven_weeks%rowtype;
  size int;
  pick int;
  prev text;
  g record;
  members int;
begin
  select * into w from public.coven_weeks where coven_id = p_coven and week = p_week;
  if found then return w; end if;
  select count(*) into size from private.coven_goals();
  select goal into prev from public.coven_weeks where coven_id = p_coven and week = p_week - 1;
  pick := ((hashtext(p_coven::text || ':' || p_week)::bigint % size) + size) % size;
  select x.goal, x.counter, x.per into g from private.coven_goals() with ordinality as x(goal, counter, per, n) where x.n = pick + 1;
  if g.goal = prev then
    select x.goal, x.counter, x.per into g from private.coven_goals() with ordinality as x(goal, counter, per, n) where x.n = (pick + 1) % size + 1;
  end if;
  select count(*) into members from public.coven_members where coven_id = p_coven;
  insert into public.coven_weeks (coven_id, week, goal, counter, target)
  values (p_coven, p_week, g.goal, g.counter, g.per * greatest(2, least(6, members)))
  on conflict do nothing;
  delete from public.coven_weeks where coven_id = p_coven and week < p_week - 8;
  select * into w from public.coven_weeks where coven_id = p_coven and week = p_week;
  return w;
end;
$$;

create or replace function private.coven_progress(p_coven uuid, p_week int, p_counter text)
returns int
language sql
stable
set search_path = public
as $$
  select coalesce(sum(amount), 0)::int from public.coven_tallies
   where coven_id = p_coven and counter = p_counter
     and day between private.coven_week_start(p_week) and private.coven_week_start(p_week) + 6;
$$;

-- A coven's public face, as everything else returns it.
create or replace function private.coven_card(p_coven uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object('id', c.id, 'name_a', c.name_a, 'name_b', c.name_b, 'name_form', c.name_form,
    'shape', c.sigil_shape, 'symbol', c.sigil_symbol, 'colour', c.sigil_colour, 'created_at', c.created_at,
    'members', (select count(*) from public.coven_members m where m.coven_id = c.id))
    from public.covens c where c.id = p_coven;
$$;

-- When a member goes (leaving, removed, or their account deleted), the
-- longest-standing member takes the candle, the invitations they sent are
-- withdrawn, and an empty coven is dissolved.
create or replace function private.coven_member_gone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.coven_invites where coven_id = old.coven_id and from_user = old.user_id;
  if old.role = 'founder' and not exists (select 1 from public.coven_members where coven_id = old.coven_id and role = 'founder') then
    update public.coven_members set role = 'founder'
     where user_id = (select user_id from public.coven_members where coven_id = old.coven_id order by joined_at, user_id limit 1);
  end if;
  if not exists (select 1 from public.coven_members where coven_id = old.coven_id) then
    delete from public.covens where id = old.coven_id;
  end if;
  return null;
end;
$$;

drop trigger if exists coven_member_gone on public.coven_members;
create trigger coven_member_gone after delete on public.coven_members
  for each row execute function private.coven_member_gone();

revoke all on function private.coven_week_of(date) from public;
revoke all on function private.coven_week_start(int) from public;
revoke all on function private.coven_week_at(int) from public;
revoke all on function private.coven_today() from public;
revoke all on function private.coven_cap(text) from public;
revoke all on function private.coven_goals() from public;
revoke all on function private.coven_threshold(int, int) from public;
revoke all on function private.coven_of(uuid) from public;
revoke all on function private.coven_founder(uuid) from public;
revoke all on function private.coven_blocked(uuid, uuid) from public;
revoke all on function private.coven_rate(uuid, text, int, interval) from public;
revoke all on function private.coven_dnd(uuid) from public;
revoke all on function private.coven_bump(uuid, uuid, text) from public;
revoke all on function private.coven_week_row(uuid, int) from public;
revoke all on function private.coven_progress(uuid, int, text) from public;
revoke all on function private.coven_card(uuid) from public;
revoke all on function private.coven_member_gone() from public;

-- ---------------------------------------------------------------------------
-- Founding, joining and leaving
-- ---------------------------------------------------------------------------

create or replace function public.coven_found(p_name_a text, p_name_b text, p_form int, p_shape text, p_symbol text, p_colour text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  c uuid;
begin
  if private.coven_of(uid) is not null then perform private.refuse('already_in_coven'); end if;
  if coalesce(p_name_a, '') !~ '^[a-z0-9-]{1,24}$' or coalesce(p_name_b, '') !~ '^[a-z0-9-]{1,24}$'
     or p_form is null or p_form not between 0 and 3
     or coalesce(p_shape, '') !~ '^[a-z0-9-]{1,24}$' or coalesce(p_symbol, '') !~ '^[a-z0-9-]{1,24}$'
     or coalesce(p_colour, '') !~ '^[a-z0-9-]{1,24}$' then
    perform private.refuse('bad_coven');
  end if;
  perform private.coven_rate(uid, 'found', 3, interval '1 day');
  insert into public.covens (name_a, name_b, name_form, sigil_shape, sigil_symbol, sigil_colour)
  values (p_name_a, p_name_b, p_form, p_shape, p_symbol, p_colour) returning id into c;
  insert into public.coven_members (user_id, coven_id, role) values (uid, c, 'founder');
  return jsonb_build_object('ok', true, 'id', c);
end;
$$;

-- The candle holder may change the name and the sigil, six times a day.
create or replace function public.coven_restyle(p_name_a text, p_name_b text, p_form int, p_shape text, p_symbol text, p_colour text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  c uuid := private.coven_of(uid);
begin
  if c is null then perform private.refuse('no_coven'); end if;
  if private.coven_founder(c) is distinct from uid then perform private.refuse('not_founder'); end if;
  if coalesce(p_name_a, '') !~ '^[a-z0-9-]{1,24}$' or coalesce(p_name_b, '') !~ '^[a-z0-9-]{1,24}$'
     or p_form is null or p_form not between 0 and 3
     or coalesce(p_shape, '') !~ '^[a-z0-9-]{1,24}$' or coalesce(p_symbol, '') !~ '^[a-z0-9-]{1,24}$'
     or coalesce(p_colour, '') !~ '^[a-z0-9-]{1,24}$' then
    perform private.refuse('bad_coven');
  end if;
  perform private.coven_rate(uid, 'restyle', 6, interval '1 day');
  update public.covens set name_a = p_name_a, name_b = p_name_b, name_form = p_form,
    sigil_shape = p_shape, sigil_symbol = p_symbol, sigil_colour = p_colour where id = c;
  return jsonb_build_object('ok', true);
end;
$$;

-- Only the candle holder invites, and only their own friends, so everyone in
-- a coven was a friend of whoever held the candle when they joined.
create or replace function public.coven_invite(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  c uuid := private.coven_of(uid);
  i public.coven_invites%rowtype;
begin
  if c is null then perform private.refuse('no_coven'); end if;
  if private.coven_founder(c) is distinct from uid then perform private.refuse('not_founder'); end if;
  if p_user is null or p_user = uid then perform private.refuse('self'); end if;
  if not private.are_friends(uid, p_user) then perform private.refuse('not_friends'); end if;
  if private.coven_blocked(p_user, c) then perform private.refuse('not_found'); end if;
  if private.coven_dnd(p_user) then perform private.refuse('dnd'); end if;
  if private.coven_of(p_user) is not null then perform private.refuse('in_a_coven'); end if;
  perform 1 from public.covens where id = c for update;
  if (select count(*) from public.coven_members where coven_id = c) >= 6 then perform private.refuse('coven_full'); end if;
  delete from public.coven_invites where coven_id = c and created_at < now() - interval '7 days';
  if not exists (select 1 from public.coven_invites where coven_id = c and to_user = p_user)
     and (select count(*) from public.coven_invites where coven_id = c) >= 6 then
    perform private.refuse('too_many_open');
  end if;
  perform private.coven_rate(uid, 'invite', 20, interval '1 hour');
  insert into public.coven_invites (coven_id, from_user, to_user) values (c, uid, p_user)
  on conflict (coven_id, to_user) do update set from_user = excluded.from_user, created_at = now()
  returning * into i;
  return jsonb_build_object('ok', true, 'id', i.id);
end;
$$;

create or replace function public.coven_cancel_invite(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  c uuid := private.coven_of(uid);
begin
  if c is null then perform private.refuse('no_coven'); end if;
  if private.coven_founder(c) is distinct from uid then perform private.refuse('not_founder'); end if;
  delete from public.coven_invites where coven_id = c and to_user = p_user;
  return jsonb_build_object('ok', found);
end;
$$;

-- Accepting checks everything again: the inviter is still in the coven and
-- still a friend, nobody in it has a block either way, there is room, and the
-- player is not in a coven already. Joining tears up their other invitations.
create or replace function public.coven_respond(p_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  i public.coven_invites%rowtype;
begin
  select * into i from public.coven_invites where id = p_id and to_user = uid and created_at > now() - interval '7 days';
  if not found then perform private.refuse('not_found'); end if;
  if not coalesce(p_accept, false) then
    delete from public.coven_invites where id = p_id;
    return jsonb_build_object('ok', true, 'status', 'declined');
  end if;
  perform 1 from public.covens where id = i.coven_id for update;
  if private.coven_of(uid) is not null then perform private.refuse('already_in_coven'); end if;
  if private.coven_of(i.from_user) is distinct from i.coven_id or not private.are_friends(uid, i.from_user)
     or private.coven_blocked(uid, i.coven_id) then
    delete from public.coven_invites where id = p_id;
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if (select count(*) from public.coven_members where coven_id = i.coven_id) >= 6 then perform private.refuse('coven_full'); end if;
  insert into public.coven_members (user_id, coven_id, role) values (uid, i.coven_id, 'member');
  delete from public.coven_invites where to_user = uid;
  perform private.coven_bump(i.from_user, uid, 'coven');
  return jsonb_build_object('ok', true, 'status', 'joined', 'coven_id', i.coven_id);
end;
$$;

create or replace function public.coven_leave()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
begin
  delete from public.coven_members where user_id = uid;
  if not found then perform private.refuse('no_coven'); end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.coven_pass_candle(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  c uuid := private.coven_of(uid);
begin
  if c is null then perform private.refuse('no_coven'); end if;
  if private.coven_founder(c) is distinct from uid then perform private.refuse('not_founder'); end if;
  if p_user is null or p_user = uid or private.coven_of(p_user) is distinct from c then perform private.refuse('not_member'); end if;
  update public.coven_members set role = 'member' where user_id = uid;
  update public.coven_members set role = 'founder' where user_id = p_user;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.coven_remove(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  c uuid := private.coven_of(uid);
begin
  if c is null then perform private.refuse('no_coven'); end if;
  if private.coven_founder(c) is distinct from uid then perform private.refuse('not_founder'); end if;
  if p_user is null or p_user = uid or private.coven_of(p_user) is distinct from c then perform private.refuse('not_member'); end if;
  delete from public.coven_members where user_id = p_user;
  return jsonb_build_object('ok', true);
end;
$$;

-- A sigil frame the player has earned and chosen to wear. Cosmetic, and the
-- reader draws only frames it knows.
create or replace function public.coven_set_frame(p_frame text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
begin
  if coalesce(p_frame, '') !~ '^[a-z0-9-]{0,24}$' then perform private.refuse('bad_coven'); end if;
  if private.coven_of(uid) is null then perform private.refuse('no_coven'); end if;
  perform private.coven_rate(uid, 'frame', 30, interval '1 hour');
  update public.coven_members set frame = coalesce(p_frame, '') where user_id = uid;
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- The weekly rite
-- ---------------------------------------------------------------------------

-- p_counts is the day's running total per counter, e.g. {"emergency": 14,
-- "omen": 1}. Each total is kept if it is higher than the last one, and never
-- above what one player can do in a day, across every coven they were in that
-- day. p_day is the player's UTC date, today or yesterday by the server's clock.
create or replace function public.coven_contribute(p_day text, p_counts jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  c uuid := private.coven_of(uid);
  d date := private.score_day(p_day);
  today date := private.coven_today();
  w public.coven_weeks%rowtype;
  item record;
  v_amount int;
  v_room int;
begin
  if c is null then perform private.refuse('no_coven'); end if;
  if d > today or d < today - 1 then perform private.refuse('bad_day'); end if;
  if p_counts is null or jsonb_typeof(p_counts) <> 'object' or (select count(*) from jsonb_object_keys(p_counts)) > 11 then
    perform private.refuse('bad_counts');
  end if;
  for item in select key, value from jsonb_each(p_counts) loop
    if private.coven_cap(item.key) is null or jsonb_typeof(item.value) <> 'number' or item.value::text !~ '^\d{1,9}$' then
      perform private.refuse('bad_counts');
    end if;
  end loop;
  perform private.coven_rate(uid, 'contribute', 120, interval '1 hour');
  w := private.coven_week_row(c, private.coven_week_of(d));
  for item in select key, value from jsonb_each(p_counts) loop
    v_room := greatest(0, private.coven_cap(item.key) - coalesce((select sum(t.amount) from public.coven_tallies t
      where t.user_id = uid and t.day = d and t.counter = item.key and t.coven_id <> c), 0)::int);
    v_amount := least(item.value::text::int, v_room);
    if v_amount > 0 then
      insert into public.coven_tallies as kept (coven_id, user_id, day, counter, amount) values (c, uid, d, item.key, v_amount)
      on conflict (coven_id, user_id, day, counter) do update set amount = excluded.amount, updated_at = now()
       where excluded.amount > kept.amount;
    end if;
  end loop;
  delete from public.coven_tallies where coven_id = c and day < today - 42;
  return jsonb_build_object('ok', true, 'week', w.week, 'progress', private.coven_progress(c, w.week, w.counter),
    'mine', (select coalesce(sum(t.amount), 0)::int from public.coven_tallies t where t.coven_id = c and t.user_id = uid
      and t.counter = w.counter and t.day between private.coven_week_start(w.week) and private.coven_week_start(w.week) + 6));
end;
$$;

-- A chest, this week's or last week's. Paid to a player who did something
-- towards the goal in this coven that week, once per tier per week.
create or replace function public.coven_claim(p_week int, p_tier int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  c uuid := private.coven_of(uid);
  now_week int := private.coven_week_of(private.coven_today());
  w public.coven_weeks%rowtype;
begin
  if c is null then perform private.refuse('no_coven'); end if;
  if p_week is null or p_week not in (now_week, now_week - 1) then perform private.refuse('bad_week'); end if;
  if p_tier is null or p_tier not between 1 and 3 then perform private.refuse('bad_tier'); end if;
  select * into w from public.coven_weeks where coven_id = c and week = p_week;
  if not found or private.coven_progress(c, p_week, w.counter) < private.coven_threshold(w.target, p_tier) then
    perform private.refuse('not_reached');
  end if;
  if not exists (select 1 from public.coven_tallies t where t.coven_id = c and t.user_id = uid and t.counter = w.counter and t.amount > 0
      and t.day between private.coven_week_start(p_week) and private.coven_week_start(p_week) + 6) then
    perform private.refuse('not_eligible');
  end if;
  delete from public.coven_claims where user_id = uid and week < now_week - 8;
  insert into public.coven_claims (user_id, week, tier, coven_id) values (uid, p_week, p_tier, c) on conflict do nothing;
  return jsonb_build_object('ok', true, 'fresh', found, 'week', p_week, 'tier', p_tier, 'goal', w.goal);
end;
$$;

-- Everything the coven screens need in one reply:
--   { coven: null | { id, name_a, name_b, name_form, shape, symbol, colour, created_at, members, role, frame },
--     members: [{ user_id, display_name, role, frame, joined_at }],
--     week: { no, goal, counter, target, progress, starts, members: [{ user_id, amount }], claimed: [tier] },
--     last: null | { no, goal, counter, target, progress, claimed: [tier],
--                    members: [{ user_id, display_name, counts: { counter: n }, days, late, notes }] },
--     invites: [{ id, coven: {...}, from_user, from_name, created_at }],
--     sent: [{ to_user, display_name, created_at }],
--     board: { latest, count } }
-- Invitations from anyone the player has blocked, or who has blocked them, are
-- left out. Last week's members are the ones who were here before it ended.
create or replace function public.coven_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  c uuid := private.coven_of(uid);
  today date := private.coven_today();
  wk int := private.coven_week_of(today);
  w public.coven_weeks%rowtype;
  l public.coven_weeks%rowtype;
  invites jsonb;
  reply jsonb;
begin
  invites := coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'coven', private.coven_card(i.coven_id), 'from_user', i.from_user,
      'from_name', coalesce(p.display_name, ''), 'created_at', i.created_at) order by i.created_at desc)
    from (select * from public.coven_invites i where i.to_user = uid and i.created_at > now() - interval '7 days'
            and not exists (select 1 from public.blocks b where (b.blocker = uid and b.blocked = i.from_user) or (b.blocker = i.from_user and b.blocked = uid))
          order by i.created_at desc limit 10) i
    left join public.profiles p on p.user_id = i.from_user), '[]'::jsonb);
  if c is null then
    return jsonb_build_object('coven', null, 'members', '[]'::jsonb, 'week', null, 'last', null, 'invites', invites, 'sent', '[]'::jsonb, 'board', null);
  end if;
  w := private.coven_week_row(c, wk);
  select * into l from public.coven_weeks where coven_id = c and week = wk - 1;
  reply := jsonb_build_object(
    'coven', private.coven_card(c) || (select jsonb_build_object('role', m.role, 'frame', m.frame) from public.coven_members m where m.user_id = uid),
    'members', (select coalesce(jsonb_agg(jsonb_build_object('user_id', m.user_id, 'display_name', coalesce(p.display_name, ''), 'role', m.role,
        'frame', m.frame, 'joined_at', m.joined_at) order by m.joined_at, m.user_id), '[]'::jsonb)
      from public.coven_members m left join public.profiles p on p.user_id = m.user_id where m.coven_id = c),
    'week', jsonb_build_object('no', w.week, 'goal', w.goal, 'counter', w.counter, 'target', w.target,
      'progress', private.coven_progress(c, w.week, w.counter), 'starts', private.coven_week_start(w.week),
      'members', (select coalesce(jsonb_agg(jsonb_build_object('user_id', t.user_id, 'amount', t.amount) order by t.user_id), '[]'::jsonb)
        from (select user_id, sum(amount)::int as amount from public.coven_tallies
               where coven_id = c and counter = w.counter and day between private.coven_week_start(w.week) and private.coven_week_start(w.week) + 6
               group by user_id) t),
      'claimed', (select coalesce(jsonb_agg(tier order by tier), '[]'::jsonb) from public.coven_claims where user_id = uid and week = w.week)),
    'last', case when l.coven_id is null then null else jsonb_build_object('no', l.week, 'goal', l.goal, 'counter', l.counter, 'target', l.target,
      'progress', private.coven_progress(c, l.week, l.counter),
      'claimed', (select coalesce(jsonb_agg(tier order by tier), '[]'::jsonb) from public.coven_claims where user_id = uid and week = l.week),
      'members', (select coalesce(jsonb_agg(jsonb_build_object('user_id', m.user_id, 'display_name', coalesce(p.display_name, ''),
          'counts', coalesce((select jsonb_object_agg(x.counter, x.amount) from (select counter, sum(amount)::int as amount from public.coven_tallies t
              where t.coven_id = c and t.user_id = m.user_id and t.day between private.coven_week_start(l.week) and private.coven_week_start(l.week) + 6
              group by counter) x), '{}'::jsonb),
          'days', (select count(distinct t.day)::int from public.coven_tallies t where t.coven_id = c and t.user_id = m.user_id and t.amount > 0
              and t.day between private.coven_week_start(l.week) and private.coven_week_start(l.week) + 6),
          'late', (select coalesce(sum(t.amount), 0)::int from public.coven_tallies t where t.coven_id = c and t.user_id = m.user_id
              and t.day = private.coven_week_start(l.week) + 6),
          'notes', (select count(*)::int from public.coven_notes n where n.coven_id = c and n.author = m.user_id
              and n.created_at >= private.coven_week_at(l.week) and n.created_at < private.coven_week_at(w.week))
        ) order by m.joined_at, m.user_id), '[]'::jsonb)
        from public.coven_members m left join public.profiles p on p.user_id = m.user_id
       where m.coven_id = c and m.joined_at < private.coven_week_at(w.week))) end,
    'invites', invites,
    'sent', case when private.coven_founder(c) = uid then (select coalesce(jsonb_agg(jsonb_build_object('to_user', i.to_user,
        'display_name', coalesce(p.display_name, ''), 'created_at', i.created_at) order by i.created_at desc), '[]'::jsonb)
      from public.coven_invites i left join public.profiles p on p.user_id = i.to_user
     where i.coven_id = c and i.created_at > now() - interval '7 days') else '[]'::jsonb end,
    'board', (select jsonb_build_object('latest', coalesce(max(n.id), 0), 'count', count(*)::int) from public.coven_notes n
      where n.coven_id = c and not exists (select 1 from public.blocks b
        where (b.blocker = uid and b.blocked = n.author) or (b.blocker = n.author and b.blocked = uid))));
  return reply;
end;
$$;

-- ---------------------------------------------------------------------------
-- The notice board
-- ---------------------------------------------------------------------------

-- The last twenty notes, newest first, without anything from a player who
-- has a block with the reader either way. Mentioned members carry their
-- names while they are still in the coven.
create or replace function public.coven_board()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  c uuid := private.coven_of(uid);
begin
  if c is null then perform private.refuse('no_coven'); end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'author', n.author, 'author_name', coalesce(p.display_name, ''),
      'tiles', to_jsonb(n.tiles), 'mentions', to_jsonb(n.mentions),
      'mention_names', (select coalesce(jsonb_agg(coalesce((select pp.display_name from public.coven_members mm
          join public.profiles pp on pp.user_id = mm.user_id where mm.user_id = x.u and mm.coven_id = c), '') order by x.o), '[]'::jsonb)
        from unnest(n.mentions) with ordinality as x(u, o)),
      'created_at', n.created_at) order by n.id desc), '[]'::jsonb)
    from (select * from public.coven_notes n where n.coven_id = c
            and n.created_at > now() - interval '45 days'
            and not exists (select 1 from public.blocks b where (b.blocker = uid and b.blocked = n.author) or (b.blocker = n.author and b.blocked = uid))
          order by n.id desc limit 20) n
    left join public.profiles p on p.user_id = n.author);
end;
$$;

-- p_tiles: a json array of one to twelve tile ids, or "@<user id>" for a
-- member (three at most). Twelve notes an hour, forty a day; the board keeps
-- the newest twenty.
create or replace function public.coven_post(p_tiles jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  c uuid := private.coven_of(uid);
  tile text;
  v_tiles text[] := '{}';
  v_mentions uuid[] := '{}';
  who uuid;
  new_id bigint;
begin
  if c is null then perform private.refuse('no_coven'); end if;
  if p_tiles is null or jsonb_typeof(p_tiles) <> 'array' or jsonb_array_length(p_tiles) not between 1 and 12 then
    perform private.refuse('bad_note');
  end if;
  for tile in select case when jsonb_typeof(value) = 'string' then value #>> '{}' else '' end from jsonb_array_elements(p_tiles) loop
    if tile ~ '^@[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      who := substr(tile, 2)::uuid;
      if private.coven_of(who) is distinct from c then perform private.refuse('bad_note'); end if;
      if not who = any(v_mentions) then v_mentions := v_mentions || who; end if;
    elsif tile !~ '^[a-z0-9-]{1,20}$' then
      perform private.refuse('bad_note');
    end if;
    v_tiles := v_tiles || tile;
  end loop;
  if cardinality(v_mentions) > 3 then perform private.refuse('bad_note'); end if;
  perform private.coven_rate(uid, 'post-day', 40, interval '1 day');
  perform private.coven_rate(uid, 'post', 12, interval '1 hour');
  insert into public.coven_notes (coven_id, author, tiles, mentions) values (c, uid, v_tiles, v_mentions) returning coven_notes.id into new_id;
  delete from public.coven_notes where coven_id = c and coven_notes.id not in (select n.id from public.coven_notes n where n.coven_id = c order by n.id desc limit 20);
  delete from public.coven_notes where coven_id = c and created_at < now() - interval '45 days';
  return jsonb_build_object('ok', true, 'id', new_id);
end;
$$;

-- Its author, anyone it names, or the candle holder may take a note down.
create or replace function public.coven_unpost(p_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  c uuid := private.coven_of(uid);
  n public.coven_notes%rowtype;
begin
  if c is null then perform private.refuse('no_coven'); end if;
  select * into n from public.coven_notes where id = p_id and coven_id = c;
  if not found then perform private.refuse('not_found'); end if;
  if n.author <> uid and not uid = any(n.mentions) and private.coven_founder(c) is distinct from uid then
    perform private.refuse('not_allowed');
  end if;
  delete from public.coven_notes where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Invite rewards
-- ---------------------------------------------------------------------------

-- Once a day is enough; more calls change nothing.
create or replace function public.mark_active_day()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  today date := private.coven_today();
begin
  insert into public.active_days (user_id, day) values (uid, today) on conflict do nothing;
  delete from public.active_days where user_id = uid and day < today - 60;
  return jsonb_build_object('ok', true, 'days', (select count(*)::int from public.active_days where user_id = uid and day > today - 30));
end;
$$;

-- A new player (an account under fourteen days old) names who sent them.
-- Like add_friend, a refusal is an answer ({ ok: false, error }) rather than
-- an error, so that a wrong guess still counts towards the limit of ten an hour.
create or replace function public.register_referral(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  other uuid;
  refused text;
begin
  perform private.coven_rate(uid, 'referral', 10, interval '1 hour');
  if code ~ '^[A-HJKMNP-Z2-9]{8}$' then select user_id into other from public.profiles where friend_code = code; end if;
  refused := case
    when other is null then 'not_found'
    when other = uid then 'self'
    when exists (select 1 from public.blocks where (blocker = uid and blocked = other) or (blocker = other and blocked = uid)) then 'not_found'
    when exists (select 1 from public.referrals where invitee = uid) then 'already_referred'
    when not exists (select 1 from auth.users where id = uid and created_at > now() - interval '14 days') then 'not_new'
    when (select count(*) from public.referrals where inviter = other) >= 50 then 'too_many'
  end;
  if refused is not null then return jsonb_build_object('ok', false, 'error', refused); end if;
  insert into public.referrals (invitee, inviter) values (uid, other);
  return jsonb_build_object('ok', true, 'inviter', other);
end;
$$;

-- { invited_by: null | { user_id, name, friends, days, claimed },
--   invited: [{ user_id, name, friends, days, claimed }], rewarded, can_register }
-- days counts the new player's active days since the referral, three at most
-- matter. Names appear only between accepted friends.
create or replace function public.referral_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
begin
  return jsonb_build_object(
    'invited_by', (select jsonb_build_object('user_id', r.inviter,
        'name', case when private.are_friends(uid, r.inviter) then coalesce(p.display_name, '') else '' end,
        'friends', private.are_friends(uid, r.inviter),
        'days', (select count(*)::int from public.active_days a where a.user_id = uid and a.day >= r.created_at::date),
        'claimed', r.invitee_claimed_at is not null)
      from public.referrals r left join public.profiles p on p.user_id = r.inviter where r.invitee = uid),
    'invited', (select coalesce(jsonb_agg(jsonb_build_object('user_id', r.invitee,
        'name', case when private.are_friends(uid, r.invitee) then coalesce(p.display_name, '') else '' end,
        'friends', private.are_friends(uid, r.invitee),
        'days', (select count(*)::int from public.active_days a where a.user_id = r.invitee and a.day >= r.created_at::date),
        'claimed', r.inviter_claimed_at is not null) order by r.created_at desc), '[]'::jsonb)
      from (select * from public.referrals where inviter = uid order by created_at desc limit 20) r
      left join public.profiles p on p.user_id = r.invitee),
    'rewarded', (select count(*)::int from public.referrals where inviter = uid and inviter_claimed_at is not null),
    'can_register', not exists (select 1 from public.referrals where invitee = uid)
      and exists (select 1 from auth.users where id = uid and created_at > now() - interval '14 days'));
end;
$$;

-- Either side collects once they are friends and the new player has played
-- on three different days. An inviter is rewarded for ten new players at most.
create or replace function public.claim_referral(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  r public.referrals%rowtype;
  days int;
begin
  select * into r from public.referrals where (invitee = uid and inviter = p_user) or (inviter = uid and invitee = p_user) for update;
  if not found then perform private.refuse('not_found'); end if;
  if not private.are_friends(r.inviter, r.invitee) then perform private.refuse('not_friends'); end if;
  select count(*) into days from public.active_days a where a.user_id = r.invitee and a.day >= r.created_at::date;
  if days < 3 then perform private.refuse('not_ready'); end if;
  if r.invitee = uid then
    if r.invitee_claimed_at is not null then return jsonb_build_object('ok', true, 'fresh', false, 'side', 'invitee'); end if;
    update public.referrals set invitee_claimed_at = now() where invitee = r.invitee;
    return jsonb_build_object('ok', true, 'fresh', true, 'side', 'invitee');
  end if;
  if r.inviter_claimed_at is not null then return jsonb_build_object('ok', true, 'fresh', false, 'side', 'inviter'); end if;
  if (select count(*) from public.referrals where inviter = uid and inviter_claimed_at is not null) >= 10 then
    perform private.refuse('cap_reached');
  end if;
  update public.referrals set inviter_claimed_at = now() where invitee = r.invitee;
  return jsonb_build_object('ok', true, 'fresh', true, 'side', 'inviter');
end;
$$;

-- ---------------------------------------------------------------------------
-- Who may call what: signed-in players (anonymous ones included), nobody else.
-- ---------------------------------------------------------------------------

revoke all on function public.coven_found(text, text, int, text, text, text) from public, anon, authenticated;
revoke all on function public.coven_restyle(text, text, int, text, text, text) from public, anon, authenticated;
revoke all on function public.coven_invite(uuid) from public, anon, authenticated;
revoke all on function public.coven_cancel_invite(uuid) from public, anon, authenticated;
revoke all on function public.coven_respond(uuid, boolean) from public, anon, authenticated;
revoke all on function public.coven_leave() from public, anon, authenticated;
revoke all on function public.coven_pass_candle(uuid) from public, anon, authenticated;
revoke all on function public.coven_remove(uuid) from public, anon, authenticated;
revoke all on function public.coven_set_frame(text) from public, anon, authenticated;
revoke all on function public.coven_contribute(text, jsonb) from public, anon, authenticated;
revoke all on function public.coven_claim(int, int) from public, anon, authenticated;
revoke all on function public.coven_status() from public, anon, authenticated;
revoke all on function public.coven_board() from public, anon, authenticated;
revoke all on function public.coven_post(jsonb) from public, anon, authenticated;
revoke all on function public.coven_unpost(bigint) from public, anon, authenticated;
revoke all on function public.mark_active_day() from public, anon, authenticated;
revoke all on function public.register_referral(text) from public, anon, authenticated;
revoke all on function public.referral_status() from public, anon, authenticated;
revoke all on function public.claim_referral(uuid) from public, anon, authenticated;

grant execute on function public.coven_found(text, text, int, text, text, text) to authenticated;
grant execute on function public.coven_restyle(text, text, int, text, text, text) to authenticated;
grant execute on function public.coven_invite(uuid) to authenticated;
grant execute on function public.coven_cancel_invite(uuid) to authenticated;
grant execute on function public.coven_respond(uuid, boolean) to authenticated;
grant execute on function public.coven_leave() to authenticated;
grant execute on function public.coven_pass_candle(uuid) to authenticated;
grant execute on function public.coven_remove(uuid) to authenticated;
grant execute on function public.coven_set_frame(text) to authenticated;
grant execute on function public.coven_contribute(text, jsonb) to authenticated;
grant execute on function public.coven_claim(int, int) to authenticated;
grant execute on function public.coven_status() to authenticated;
grant execute on function public.coven_board() to authenticated;
grant execute on function public.coven_post(jsonb) to authenticated;
grant execute on function public.coven_unpost(bigint) to authenticated;
grant execute on function public.mark_active_day() to authenticated;
grant execute on function public.register_referral(text) to authenticated;
grant execute on function public.referral_status() to authenticated;
grant execute on function public.claim_referral(uuid) to authenticated;

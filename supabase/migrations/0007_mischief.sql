-- Shelf Life: mischief. Hexes, hauntings, neighbourly help and trick-or-treat.
--
-- Run after 0002_social.sql. It needs only 0001 and 0002, and it is safe to
-- run more than once. Same rules as before:
--   * every table hangs off auth.users on delete cascade, so
--     delete_my_account() removes all of it without being edited;
--   * row level security is on everywhere, nothing is granted to anon or
--     authenticated, and every read and write is a security definer function
--     that starts from private.require_user();
--   * a row is only ever shown to the two players in it, never once either has
--     blocked the other (a trigger on public.blocks deletes it), and never once
--     they stop being friends (every read checks).
--
-- Refusals raise errcode P0001 with a short token as the message:
--   not_friends, dnd, bad_card, bad_culprit, too_large, not_in_hand, hexed_today,
--   no_rebound, shelf_full, not_found, not_open, expired, bad_hex,
--   haunted_this_week, already_haunted, bad_need, not_needed, helped_today,
--   resident_helped, helps_full, helped_enough, bad_help, out_of_season,
--   knocked_tonight, rate_limited, bad_bowl, bad_kind.
-- src/cloud/mischief.js turns them into copy.
--
-- Days are UTC calendar days, decided here and never by the client. The
-- clock is private.mischief_now(), which is plain now(); the tests redefine
-- it to travel in time.
--
-- Limits, all enforced below:
--   hexes      one a day from each player, from a hand of three the server
--              deals; a free counter-hex once for each hex that rebounded,
--              within 48 hours, back to its sender only; at most two waiting
--              on any shelf; each expires after 48 hours; the culprit is
--              copied from the sender's own published shelf.
--   hauntings  one a week from each player; one at a time on any shelf; a day long.
--   helps      once per helper per friend per day; one per resident per day;
--              three a day received; five a day given; only for a resident
--              whose published need is under 50; 25 points, applied once.
--   knocks     only in the Thin Season (14 October to 3 November, UTC, a day
--              wider than the game's own window either side); once per
--              friend per night; thirty a night; the server rolls the result.
--   bowls      twenty changes a day.
--   everything older than 30 days is removed (private.mischief_tidy, on every read).
--
-- Optional links to other migrations, used only when they exist:
--   private.dnd_on(uuid)                       Do not disturb (0003)
--   private.bump_friendship(uuid, uuid, text)  friendship levels (0003)

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.hexes (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  card text not null check (card ~ '^[a-z0-9-]{1,40}$'),
  culprit jsonb not null,
  -- A counter-hex names the hex that rebounded. It is free: it does not use
  -- up the day's hex.
  rebound_of uuid,
  free boolean not null default false,
  status text not null default 'waiting' check (status in ('waiting', 'resolved', 'declined')),
  choice int check (choice between 0 and 3),
  outcome int check (outcome between 0 and 3),
  rebound boolean not null default false,
  day date not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  resolved_at timestamptz,
  sender_seen_at timestamptz,
  constraint hexes_not_self check (from_user <> to_user),
  constraint hexes_culprit_size check (octet_length(culprit::text) < 150000)
);
create unique index if not exists hexes_one_a_day on public.hexes (from_user, day) where not free;
create unique index if not exists hexes_one_rebound on public.hexes (rebound_of) where rebound_of is not null;
create index if not exists hexes_to on public.hexes (to_user, status);
create index if not exists hexes_from on public.hexes (from_user, created_at);

create table if not exists public.hauntings (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  ghost jsonb not null,
  status text not null default 'haunting' check (status in ('haunting', 'shooed')),
  taps int check (taps between 1 and 99),
  created_at timestamptz not null default now(),
  ends_at timestamptz not null,
  shooed_at timestamptz,
  sender_seen_at timestamptz,
  constraint hauntings_not_self check (from_user <> to_user),
  constraint hauntings_ghost_size check (octet_length(ghost::text) < 150000)
);
create index if not exists hauntings_to on public.hauntings (to_user, status);
create index if not exists hauntings_from on public.hauntings (from_user, created_at);

create table if not exists public.helps (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  resident_id text not null check (resident_id ~ '^[a-zA-Z0-9_-]{1,100}$'),
  resident_name text not null default '' check (char_length(resident_name) <= 22),
  need text not null check (need in ('food', 'fuss', 'clean')),
  amount int not null default 25 check (amount between 1 and 30),
  day date not null,
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  constraint helps_not_self check (from_user <> to_user)
);
create unique index if not exists helps_once_per_friend on public.helps (from_user, to_user, day);
create unique index if not exists helps_once_per_resident on public.helps (to_user, resident_id, day);
create index if not exists helps_to on public.helps (to_user, applied_at);

create table if not exists public.doorsteps (
  user_id uuid primary key references auth.users (id) on delete cascade,
  bowl text not null default 'none' check (bowl ~ '^[a-z0-9-]{1,24}$'),
  day date not null,
  changes int not null default 0 check (changes >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.knocks (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  night date not null,
  result text not null check (result in ('treat', 'trick')),
  prize text not null check (prize ~ '^[a-z0-9-]{1,40}$'),
  souls int not null default 0 check (souls between 0 and 30),
  bowl text not null default 'none',
  created_at timestamptz not null default now(),
  constraint knocks_not_self check (from_user <> to_user)
);
create unique index if not exists knocks_once_a_night on public.knocks (from_user, to_user, night);
create index if not exists knocks_to on public.knocks (to_user, night);

-- ---------------------------------------------------------------------------
-- Row level security. Nothing is granted: every read and write goes through
-- the functions below. The policies say who could see a row if that ever changed.
-- ---------------------------------------------------------------------------

alter table public.hexes enable row level security;
alter table public.hauntings enable row level security;
alter table public.helps enable row level security;
alter table public.doorsteps enable row level security;
alter table public.knocks enable row level security;

revoke all on table public.hexes, public.hauntings, public.helps, public.doorsteps, public.knocks
  from public, anon, authenticated;

drop policy if exists "hexes are for the two players in them" on public.hexes;
create policy "hexes are for the two players in them" on public.hexes
  for select to authenticated using ((select auth.uid()) in (from_user, to_user));
drop policy if exists "hauntings are for the two players in them" on public.hauntings;
create policy "hauntings are for the two players in them" on public.hauntings
  for select to authenticated using ((select auth.uid()) in (from_user, to_user));
drop policy if exists "helps are for the two players in them" on public.helps;
create policy "helps are for the two players in them" on public.helps
  for select to authenticated using ((select auth.uid()) in (from_user, to_user));
drop policy if exists "doorsteps are for their owner" on public.doorsteps;
create policy "doorsteps are for their owner" on public.doorsteps
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "knocks are for the two players in them" on public.knocks;
create policy "knocks are for the two players in them" on public.knocks
  for select to authenticated using ((select auth.uid()) in (from_user, to_user));

-- ---------------------------------------------------------------------------
-- Helpers (not callable from the API)
-- ---------------------------------------------------------------------------

create or replace function private.mischief_now()
returns timestamptz
language sql
stable
set search_path = public
as $$
  select now();
$$;

create or replace function private.mischief_day()
returns date
language sql
stable
set search_path = public
as $$
  select (private.mischief_now() at time zone 'utc')::date;
$$;

create or replace function private.mischief_blocked(a uuid, b uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (select 1 from public.blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a));
$$;

-- Do not disturb, if the postbox migration has added it.
create or replace function private.mischief_dnd(p_user uuid)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  quiet boolean := false;
begin
  if to_regprocedure('private.dnd_on(uuid)') is not null then
    execute 'select private.dnd_on($1)' into quiet using p_user;
  end if;
  return coalesce(quiet, false);
end;
$$;

-- Friends, not blocked either way, and (for anything that lands on their
-- shelf) not behind Do not disturb.
create or replace function private.mischief_friend(uid uuid, other uuid, respect_dnd boolean)
returns void
language plpgsql
stable
set search_path = public
as $$
begin
  if other is null or other = uid or not private.are_friends(uid, other) or private.mischief_blocked(uid, other) then
    perform private.refuse('not_friends');
  end if;
  if respect_dnd and private.mischief_dnd(other) then perform private.refuse('dnd'); end if;
end;
$$;

-- Friendship levels, if the postbox migration has added them.
create or replace function private.mischief_bump(a uuid, b uuid, p_kind text)
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

create or replace function private.mischief_name(p_user uuid)
returns text
language sql
stable
set search_path = public
as $$
  select coalesce((select display_name from public.profiles where user_id = p_user), '');
$$;

-- The same ids, in the same order, as HEX_DECK and TRICK_DECK in
-- src/content/mischief.js (test/mischief_content.test.mjs checks).
create or replace function private.hex_deck()
returns text[]
language sql
immutable
set search_path = public
as $$
  select array['sock-of-ill-omen', 'unsolicited-accordion', 'the-drawer-remembers', 'damp-invitation', 'eulogy-in-advance',
    'wrong-portrait', 'reverse-charge-seance', 'subscription-to-moths', 'tooth-under-the-pillow', 'the-midnight-bell',
    'jar-of-whispers', 'express-coffin', 'raven-with-opinions', 'spider-lodger', 'spoon-that-hums', 'spare-shadow',
    'fairy-ring', 'candle-that-wont', 'letter-from-the-landlord', 'sulking-mirror', 'cake-inscribed-sorry', 'reserved-grave',
    'bone-to-pick', 'ear-at-the-wall', 'a-hand-that-waves', 'unexpected-ring', 'nail-that-wants-out', 'brooch-for-the-living',
    'mouse-with-a-lease', 'plant-that-glows', 'chalk-outline', 'gossiping-lamp', 'borrowed-name', 'imaginary-friend']::text[];
$$;

create or replace function private.trick_deck()
returns text[]
language sql
immutable
set search_path = public
as $$
  select array['trick-wet-apple', 'trick-toilet-roll', 'trick-egg', 'trick-mask', 'trick-fun-size', 'trick-doorbell',
    'trick-pumpkin', 'trick-sheet', 'trick-candy-corn', 'trick-heavy-bag']::text[];
$$;

-- A bowl's odds: { treat chance %, curio chance % of treats, lowest souls, highest souls }.
-- The same numbers as BOWLS in src/content/mischief.js.
create or replace function private.bowl_odds(p_bowl text)
returns int[]
language sql
immutable
set search_path = public
as $$
  select case p_bowl
    when 'none' then array[50, 15, 6, 10]
    when 'full-size' then array[85, 20, 14, 22]
    when 'fun-size' then array[70, 15, 8, 14]
    when 'raisins' then array[35, 10, 6, 10]
    when 'apples' then array[55, 45, 8, 14]
    when 'toothbrushes' then array[30, 5, 8, 12]
    when 'pennies' then array[65, 30, 10, 18]
    when 'empty-note' then array[20, 25, 6, 10]
  end;
$$;

-- Today's hand: three different cards, the same all day for the same player.
create or replace function private.hex_hand(uid uuid, d date)
returns text[]
language sql
immutable
set search_path = public
as $$
  select array_agg(card order by k) from (
    select card, md5(uid::text || ':' || d::text || ':' || card) as k
      from unnest(private.hex_deck()) as card
     order by k limit 3) dealt;
$$;

-- A number from a seed, 0 to 2^28. The same seed always gives the same number.
create or replace function private.mischief_roll(seed text)
returns int
language sql
immutable
set search_path = public
as $$
  select ('x' || substr(md5(seed), 1, 7))::bit(28)::int;
$$;

-- One resident as its owner last published it, or null.
create or replace function private.shelf_resident(owner uuid, resident text)
returns jsonb
language sql
stable
set search_path = public
as $$
  select r from public.shelves s,
    jsonb_array_elements(case when jsonb_typeof(s.snapshot -> 'residents') = 'array' then s.snapshot -> 'residents' else '[]'::jsonb end) r
   where s.user_id = owner and jsonb_typeof(r) = 'object' and r ->> 'id' = resident
   limit 1;
$$;

create or replace function private.mischief_in_season(t timestamptz)
returns boolean
language sql
stable
set search_path = public
as $$
  select to_char(t at time zone 'utc', 'MMDD') between '1014' and '1103';
$$;

-- Removes this player's mischief older than 30 days. mischief_inbox() calls it
-- on every read, so nothing needs a scheduler.
create or replace function private.mischief_tidy(uid uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  cutoff timestamptz := private.mischief_now() - interval '30 days';
begin
  delete from public.hexes where created_at < cutoff and uid in (from_user, to_user);
  delete from public.hauntings where created_at < cutoff and uid in (from_user, to_user);
  delete from public.helps where created_at < cutoff and uid in (from_user, to_user);
  delete from public.knocks where created_at < cutoff and uid in (from_user, to_user);
end;
$$;

-- A block takes every hex, haunting, help and knock between the two with it.
create or replace function private.mischief_forget_pair()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.hexes where (from_user = new.blocker and to_user = new.blocked) or (from_user = new.blocked and to_user = new.blocker);
  delete from public.hauntings where (from_user = new.blocker and to_user = new.blocked) or (from_user = new.blocked and to_user = new.blocker);
  delete from public.helps where (from_user = new.blocker and to_user = new.blocked) or (from_user = new.blocked and to_user = new.blocker);
  delete from public.knocks where (from_user = new.blocker and to_user = new.blocked) or (from_user = new.blocked and to_user = new.blocker);
  return new;
end;
$$;
drop trigger if exists mischief_forget_pair on public.blocks;
create trigger mischief_forget_pair after insert on public.blocks for each row execute function private.mischief_forget_pair();

revoke all on function private.mischief_now() from public;
revoke all on function private.mischief_day() from public;
revoke all on function private.mischief_blocked(uuid, uuid) from public;
revoke all on function private.mischief_dnd(uuid) from public;
revoke all on function private.mischief_friend(uuid, uuid, boolean) from public;
revoke all on function private.mischief_bump(uuid, uuid, text) from public;
revoke all on function private.mischief_name(uuid) from public;
revoke all on function private.hex_deck() from public;
revoke all on function private.trick_deck() from public;
revoke all on function private.bowl_odds(text) from public;
revoke all on function private.hex_hand(uuid, date) from public;
revoke all on function private.mischief_roll(text) from public;
revoke all on function private.shelf_resident(uuid, text) from public;
revoke all on function private.mischief_in_season(timestamptz) from public;
revoke all on function private.mischief_tidy(uuid) from public;
revoke all on function private.mischief_forget_pair() from public;

-- ---------------------------------------------------------------------------
-- Everything a player needs, in one read
-- ---------------------------------------------------------------------------

-- {
--   status: { day, now, hand: [card ids], hexed_today, haunt_ready, haunt_next_at,
--             helped: [user ids helped today], helps_given, knocked: [user ids knocked tonight],
--             season, rebounds: [{ id, to_user, card }] },
--   hexes: [{ id, from_user, from_name, card, culprit, created_at, expires_at, rebound }]   waiting for the caller
--   hauntings: [{ id, from_user, from_name, ghost, created_at, ends_at }]                     on the caller's shelf now
--   helps: [{ id, from_user, from_name, resident_id, resident_name, need, amount, created_at }] not yet applied
--   results: [{ id, to_user, to_name, card, culprit_id, culprit_name, status, choice, outcome, rebound, at }]
--   haunt_results: [{ id, to_user, to_name, ghost_name, status, taps, at }]
--   doorstep: { bowl, count, knocks: [{ id, from_user, from_name, result, created_at }] }
-- }
create or replace function public.mischief_inbox()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  t timestamptz := private.mischief_now();
  d date := private.mischief_day();
begin
  perform private.mischief_tidy(uid);
  return jsonb_build_object(
    'status', jsonb_build_object(
      'day', d,
      'now', t,
      'hand', to_jsonb(private.hex_hand(uid, d)),
      'hexed_today', exists (select 1 from public.hexes where from_user = uid and day = d and not free),
      'haunt_ready', not exists (select 1 from public.hauntings where from_user = uid and created_at > t - interval '7 days'),
      'haunt_next_at', (select max(created_at) + interval '7 days' from public.hauntings where from_user = uid and created_at > t - interval '7 days'),
      'helped', coalesce((select jsonb_agg(distinct to_user) from public.helps where from_user = uid and day = d), '[]'::jsonb),
      'helps_given', (select count(*) from public.helps where from_user = uid and day = d),
      'knocked', coalesce((select jsonb_agg(distinct to_user) from public.knocks where from_user = uid and night = d), '[]'::jsonb),
      'season', private.mischief_in_season(t),
      'rebounds', coalesce((select jsonb_agg(jsonb_build_object('id', h.id, 'to_user', h.from_user, 'card', h.card) order by h.resolved_at desc)
        from public.hexes h
       where h.to_user = uid and h.status = 'resolved' and h.rebound and h.resolved_at > t - interval '48 hours'
         and not exists (select 1 from public.hexes r where r.rebound_of = h.id)
         and private.are_friends(uid, h.from_user) and not private.mischief_blocked(uid, h.from_user)), '[]'::jsonb)),
    'hexes', coalesce((select jsonb_agg(jsonb_build_object('id', h.id, 'from_user', h.from_user, 'from_name', private.mischief_name(h.from_user),
        'card', h.card, 'culprit', h.culprit, 'created_at', h.created_at, 'expires_at', h.expires_at, 'rebound', h.free) order by h.created_at)
      from (select * from public.hexes where to_user = uid and status = 'waiting' and expires_at > t order by created_at limit 5) h
     where private.are_friends(uid, h.from_user) and not private.mischief_blocked(uid, h.from_user)), '[]'::jsonb),
    'hauntings', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'from_user', g.from_user, 'from_name', private.mischief_name(g.from_user),
        'ghost', g.ghost, 'created_at', g.created_at, 'ends_at', g.ends_at) order by g.created_at)
      from (select * from public.hauntings where to_user = uid and status = 'haunting' and ends_at > t order by created_at limit 3) g
     where private.are_friends(uid, g.from_user) and not private.mischief_blocked(uid, g.from_user)), '[]'::jsonb),
    'helps', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'from_user', p.from_user, 'from_name', private.mischief_name(p.from_user),
        'resident_id', p.resident_id, 'resident_name', p.resident_name, 'need', p.need, 'amount', p.amount, 'created_at', p.created_at) order by p.created_at)
      from (select * from public.helps where to_user = uid and applied_at is null and created_at > t - interval '7 days' order by created_at limit 10) p
     where private.are_friends(uid, p.from_user) and not private.mischief_blocked(uid, p.from_user)), '[]'::jsonb),
    'results', coalesce((select jsonb_agg(jsonb_build_object('id', h.id, 'to_user', h.to_user, 'to_name', private.mischief_name(h.to_user),
        'card', h.card, 'culprit_id', h.culprit ->> 'id', 'culprit_name', h.culprit ->> 'name',
        'status', case when h.status = 'waiting' then 'expired' else h.status end, 'choice', h.choice, 'outcome', h.outcome,
        'rebound', h.rebound, 'at', coalesce(h.resolved_at, h.expires_at)) order by coalesce(h.resolved_at, h.expires_at) desc)
      from (select * from public.hexes where from_user = uid and sender_seen_at is null
              and (status in ('resolved', 'declined') or (status = 'waiting' and expires_at <= t))
            order by coalesce(resolved_at, expires_at) desc limit 20) h
     where not private.mischief_blocked(uid, h.to_user)), '[]'::jsonb),
    'haunt_results', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'to_user', g.to_user, 'to_name', private.mischief_name(g.to_user),
        'ghost_name', g.ghost ->> 'name', 'status', case when g.status = 'shooed' then 'shooed' else 'ended' end, 'taps', g.taps,
        'at', coalesce(g.shooed_at, g.ends_at)) order by coalesce(g.shooed_at, g.ends_at) desc)
      from (select * from public.hauntings where from_user = uid and sender_seen_at is null and (status = 'shooed' or ends_at <= t)
            order by coalesce(shooed_at, ends_at) desc limit 10) g
     where not private.mischief_blocked(uid, g.to_user)), '[]'::jsonb),
    'doorstep', jsonb_build_object(
      'bowl', coalesce((select bowl from public.doorsteps where user_id = uid), 'none'),
      'count', (select count(*) from public.knocks where to_user = uid and night = d),
      'knocks', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'from_user', k.from_user, 'from_name', private.mischief_name(k.from_user),
          'result', k.result, 'created_at', k.created_at) order by k.created_at desc)
        from (select * from public.knocks where to_user = uid and night = d order by created_at desc limit 30) k), '[]'::jsonb)));
end;
$$;

-- ---------------------------------------------------------------------------
-- Hexes
-- ---------------------------------------------------------------------------

-- One a day, from today's hand, starring one of the caller's residents as the
-- friend last saw it. With p_rebound, a free counter-hex for a hex of theirs
-- that rebounded: any card, once, within 48 hours.
create or replace function public.send_hex(p_to uuid, p_card text, p_culprit text, p_rebound uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  t timestamptz := private.mischief_now();
  d date := private.mischief_day();
  culprit jsonb;
  orig public.hexes%rowtype;
  h public.hexes%rowtype;
begin
  perform private.mischief_friend(uid, p_to, true);
  if p_card is null or not (p_card = any (private.hex_deck())) then perform private.refuse('bad_card'); end if;
  if p_culprit is null or p_culprit !~ '^[a-zA-Z0-9_-]{1,100}$' then perform private.refuse('bad_culprit'); end if;
  culprit := private.shelf_resident(uid, p_culprit);
  if culprit is null then perform private.refuse('bad_culprit'); end if;
  if octet_length(culprit::text) >= 150000 then perform private.refuse('too_large'); end if;
  -- One sender at a time per shelf, so two hexes cannot both take the last place.
  perform 1 from public.profiles where user_id = p_to for update;
  if p_rebound is not null then
    select * into orig from public.hexes where id = p_rebound and to_user = uid and from_user = p_to for update;
    if not found or orig.status <> 'resolved' or not orig.rebound or orig.resolved_at <= t - interval '48 hours'
       or exists (select 1 from public.hexes where rebound_of = p_rebound) then
      perform private.refuse('no_rebound');
    end if;
  else
    if not (p_card = any (private.hex_hand(uid, d))) then perform private.refuse('not_in_hand'); end if;
    if exists (select 1 from public.hexes where from_user = uid and day = d and not free) then perform private.refuse('hexed_today'); end if;
  end if;
  if (select count(*) from public.hexes where to_user = p_to and status = 'waiting' and expires_at > t) >= 2 then
    perform private.refuse('shelf_full');
  end if;
  begin
    insert into public.hexes (from_user, to_user, card, culprit, rebound_of, free, day, created_at, expires_at)
    values (uid, p_to, p_card, culprit, p_rebound, p_rebound is not null, d, t, t + interval '48 hours')
    returning * into h;
  exception when unique_violation then
    perform private.refuse(case when p_rebound is null then 'hexed_today' else 'no_rebound' end);
  end;
  return jsonb_build_object('ok', true, 'id', h.id, 'expires_at', h.expires_at);
end;
$$;

-- The victim played it. The outcome was rolled on their device, from cards
-- in the client; the server keeps the indexes so the sender can read the ending.
create or replace function public.resolve_hex(p_id uuid, p_choice int, p_outcome int, p_rebound boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  t timestamptz := private.mischief_now();
  h public.hexes%rowtype;
begin
  if p_choice is null or p_choice not between 0 and 3 or p_outcome is null or p_outcome not between 0 and 3 then
    perform private.refuse('bad_hex');
  end if;
  select * into h from public.hexes where id = p_id and to_user = uid for update;
  if not found then perform private.refuse('not_found'); end if;
  if h.status <> 'waiting' then perform private.refuse('not_open'); end if;
  if h.expires_at <= t then perform private.refuse('expired'); end if;
  update public.hexes set status = 'resolved', choice = p_choice, outcome = p_outcome, rebound = coalesce(p_rebound, false), resolved_at = t
   where id = p_id;
  perform private.mischief_bump(uid, h.from_user, 'hex');
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.decline_hex(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  t timestamptz := private.mischief_now();
  h public.hexes%rowtype;
begin
  select * into h from public.hexes where id = p_id and to_user = uid for update;
  if not found then perform private.refuse('not_found'); end if;
  if h.status <> 'waiting' then perform private.refuse('not_open'); end if;
  if h.expires_at <= t then perform private.refuse('expired'); end if;
  update public.hexes set status = 'declined', resolved_at = t where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- The sender has read how it went (or that it expired).
create or replace function public.mark_mischief_seen(p_kind text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  t timestamptz := private.mischief_now();
begin
  if p_kind = 'hex' then
    update public.hexes set sender_seen_at = t
     where id = p_id and from_user = uid and sender_seen_at is null and (status <> 'waiting' or expires_at <= t);
  elsif p_kind = 'haunt' then
    update public.hauntings set sender_seen_at = t
     where id = p_id and from_user = uid and sender_seen_at is null and (status = 'shooed' or ends_at <= t);
  else
    perform private.refuse('bad_kind');
  end if;
  return jsonb_build_object('ok', found);
end;
$$;

-- ---------------------------------------------------------------------------
-- Hauntings
-- ---------------------------------------------------------------------------

create or replace function public.send_haunt(p_to uuid, p_resident text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  t timestamptz := private.mischief_now();
  ghost jsonb;
  g public.hauntings%rowtype;
begin
  perform private.mischief_friend(uid, p_to, true);
  if p_resident is null or p_resident !~ '^[a-zA-Z0-9_-]{1,100}$' then perform private.refuse('bad_culprit'); end if;
  ghost := private.shelf_resident(uid, p_resident);
  if ghost is null then perform private.refuse('bad_culprit'); end if;
  if octet_length(ghost::text) >= 150000 then perform private.refuse('too_large'); end if;
  -- Both players, always in the same order, so two hauntings cannot deadlock.
  perform 1 from public.profiles where user_id in (uid, p_to) order by user_id for update;
  if exists (select 1 from public.hauntings where from_user = uid and created_at > t - interval '7 days') then
    perform private.refuse('haunted_this_week');
  end if;
  if exists (select 1 from public.hauntings where to_user = p_to and status = 'haunting' and ends_at > t) then
    perform private.refuse('already_haunted');
  end if;
  insert into public.hauntings (from_user, to_user, ghost, created_at, ends_at)
  values (uid, p_to, ghost, t, t + interval '24 hours')
  returning * into g;
  return jsonb_build_object('ok', true, 'id', g.id, 'ends_at', g.ends_at);
end;
$$;

create or replace function public.shoo_haunt(p_id uuid, p_taps int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  t timestamptz := private.mischief_now();
  g public.hauntings%rowtype;
begin
  select * into g from public.hauntings where id = p_id and to_user = uid for update;
  if not found then perform private.refuse('not_found'); end if;
  if g.status <> 'haunting' or g.ends_at <= t then perform private.refuse('not_open'); end if;
  update public.hauntings set status = 'shooed', shooed_at = t, taps = least(99, greatest(1, coalesce(p_taps, 1)))
   where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Neighbourly help
-- ---------------------------------------------------------------------------

-- Only for a resident whose need, as its owner last published it, is low.
-- The owner's device adds 25 the next time it looks, once.
create or replace function public.help_out(p_to uuid, p_resident text, p_need text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  t timestamptz := private.mischief_now();
  d date := private.mischief_day();
  r jsonb;
  level numeric;
  p public.helps%rowtype;
begin
  perform private.mischief_friend(uid, p_to, true);
  if p_need is null or p_need not in ('food', 'fuss', 'clean') then perform private.refuse('bad_need'); end if;
  if p_resident is null or p_resident !~ '^[a-zA-Z0-9_-]{1,100}$' then perform private.refuse('not_needed'); end if;
  r := private.shelf_resident(p_to, p_resident);
  if r is not null and jsonb_typeof(r -> 'needs') = 'object' and jsonb_typeof(r -> 'needs' -> p_need) = 'number' then
    level := (r -> 'needs' ->> p_need)::numeric;
  end if;
  if level is null or level >= 50 then perform private.refuse('not_needed'); end if;
  perform 1 from public.profiles where user_id in (uid, p_to) order by user_id for update;
  if exists (select 1 from public.helps where from_user = uid and to_user = p_to and day = d) then perform private.refuse('helped_today'); end if;
  if exists (select 1 from public.helps where to_user = p_to and resident_id = p_resident and day = d) then perform private.refuse('resident_helped'); end if;
  if (select count(*) from public.helps where to_user = p_to and day = d) >= 3 then perform private.refuse('helps_full'); end if;
  if (select count(*) from public.helps where from_user = uid and day = d) >= 5 then perform private.refuse('helped_enough'); end if;
  insert into public.helps (from_user, to_user, resident_id, resident_name, need, amount, day, created_at)
  values (uid, p_to, p_resident, left(private.clean_text(r ->> 'name', 22), 22), p_need, 25, d, t)
  returning * into p;
  perform private.mischief_bump(uid, p_to, 'help');
  return jsonb_build_object('ok', true, 'id', p.id, 'amount', p.amount);
end;
$$;

-- The owner's device applied these. Twenty at most at a time.
create or replace function public.ack_helps(p_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  n int;
begin
  if p_ids is null or cardinality(p_ids) > 20 then perform private.refuse('bad_help'); end if;
  update public.helps set applied_at = private.mischief_now()
   where to_user = uid and applied_at is null and id = any (p_ids);
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'count', n);
end;
$$;

-- ---------------------------------------------------------------------------
-- Trick-or-treat, in the Thin Season
-- ---------------------------------------------------------------------------

-- The server rolls, from a seed of the two players and the night, so the
-- answer is the same however often it is asked and nobody can reroll it.
-- The door's bowl sets the odds. A trick names a card from the trick deck and
-- one of the door owner's residents to star in it.
create or replace function public.knock(p_to uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  t timestamptz := private.mischief_now();
  d date := private.mischief_day();
  b text;
  odds int[];
  seed text;
  res text;
  prize text;
  s int := 0;
  tricks text[] := private.trick_deck();
  culprit jsonb;
  n int;
  k public.knocks%rowtype;
begin
  if not private.mischief_in_season(t) then perform private.refuse('out_of_season'); end if;
  perform private.mischief_friend(uid, p_to, true);
  perform 1 from public.profiles where user_id = uid for update;
  if exists (select 1 from public.knocks where from_user = uid and to_user = p_to and night = d) then
    perform private.refuse('knocked_tonight');
  end if;
  if (select count(*) from public.knocks where from_user = uid and night = d) >= 30 then perform private.refuse('rate_limited'); end if;
  b := coalesce((select bowl from public.doorsteps where user_id = p_to), 'none');
  odds := coalesce(private.bowl_odds(b), private.bowl_odds('none'));
  seed := uid::text || ':' || p_to::text || ':' || d::text;
  if private.mischief_roll(seed || ':door') % 100 < odds[1] then
    res := 'treat';
    if private.mischief_roll(seed || ':curio') % 100 < odds[2] then
      prize := 'curio';
    else
      prize := 'souls';
      s := odds[3] + private.mischief_roll(seed || ':souls') % (odds[4] - odds[3] + 1);
    end if;
  else
    res := 'trick';
    prize := tricks[1 + private.mischief_roll(seed || ':trick') % array_length(tricks, 1)];
    select jsonb_array_length(snapshot -> 'residents') into n
      from public.shelves where user_id = p_to and jsonb_typeof(snapshot -> 'residents') = 'array';
    if coalesce(n, 0) > 0 then
      select r into culprit from public.shelves sh, jsonb_array_elements(sh.snapshot -> 'residents') with ordinality as e(r, i)
       where sh.user_id = p_to order by i offset private.mischief_roll(seed || ':who') % n limit 1;
      if jsonb_typeof(culprit) <> 'object' or octet_length(culprit::text) >= 150000 then culprit := null; end if;
    end if;
  end if;
  insert into public.knocks (from_user, to_user, night, result, prize, souls, bowl, created_at)
  values (uid, p_to, d, res, prize, s, b, t)
  returning * into k;
  perform private.mischief_bump(uid, p_to, 'knock');
  return jsonb_build_object('ok', true, 'id', k.id, 'result', res, 'prize', prize, 'souls', s, 'bowl', b, 'culprit', culprit);
end;
$$;

create or replace function public.set_bowl(p_bowl text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  d date := private.mischief_day();
  ds public.doorsteps%rowtype;
begin
  if p_bowl is null or private.bowl_odds(p_bowl) is null then perform private.refuse('bad_bowl'); end if;
  insert into public.doorsteps (user_id, bowl, day, changes, updated_at) values (uid, p_bowl, d, 1, private.mischief_now())
  on conflict (user_id) do update
     set bowl = excluded.bowl, updated_at = excluded.updated_at, day = excluded.day,
         changes = case when doorsteps.day = excluded.day then doorsteps.changes + 1 else 1 end
  returning * into ds;
  if ds.changes > 20 then perform private.refuse('rate_limited'); end if;
  return jsonb_build_object('ok', true, 'bowl', ds.bowl);
end;
$$;

-- ---------------------------------------------------------------------------
-- Who may call what: signed-in players (anonymous ones included), nobody else.
-- ---------------------------------------------------------------------------

revoke all on function public.mischief_inbox() from public, anon, authenticated;
revoke all on function public.send_hex(uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.resolve_hex(uuid, int, int, boolean) from public, anon, authenticated;
revoke all on function public.decline_hex(uuid) from public, anon, authenticated;
revoke all on function public.mark_mischief_seen(text, uuid) from public, anon, authenticated;
revoke all on function public.send_haunt(uuid, text) from public, anon, authenticated;
revoke all on function public.shoo_haunt(uuid, int) from public, anon, authenticated;
revoke all on function public.help_out(uuid, text, text) from public, anon, authenticated;
revoke all on function public.ack_helps(uuid[]) from public, anon, authenticated;
revoke all on function public.knock(uuid) from public, anon, authenticated;
revoke all on function public.set_bowl(text) from public, anon, authenticated;

grant execute on function public.mischief_inbox() to authenticated;
grant execute on function public.send_hex(uuid, text, text, uuid) to authenticated;
grant execute on function public.resolve_hex(uuid, int, int, boolean) to authenticated;
grant execute on function public.decline_hex(uuid) to authenticated;
grant execute on function public.mark_mischief_seen(text, uuid) to authenticated;
grant execute on function public.send_haunt(uuid, text) to authenticated;
grant execute on function public.shoo_haunt(uuid, int) to authenticated;
grant execute on function public.help_out(uuid, text, text) to authenticated;
grant execute on function public.ack_helps(uuid[]) to authenticated;
grant execute on function public.knock(uuid) to authenticated;
grant execute on function public.set_bowl(text) to authenticated;

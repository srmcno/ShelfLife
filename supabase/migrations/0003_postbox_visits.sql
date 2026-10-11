-- Shelf Life: the postbox, visits, gifts, guestbooks, waves, friendship levels
-- and Do not disturb.
--
-- Run after 0002_social.sql. Safe to run more than once, and it follows the
-- same rules as 0001 and 0002:
--   * every table hangs off auth.users on delete cascade, so
--     delete_my_account() removes all of it without being edited;
--   * row level security is on everywhere, nothing is granted to anon or
--     authenticated, and every read and write is a security definer function
--     that starts from private.require_user();
--   * a row is only ever shown to the two players in it, and never to either
--     of them once one has blocked the other.
--
-- Refusals raise errcode P0001 with a short token as the message. The tokens
-- this file adds are: dnd, shelf_full, already_visiting, already_away,
-- already_sent, already_signed, too_soon, care_full, expired, bad_visit,
-- bad_treat, bad_line, bad_stamp, bad_wave. src/cloud/postbox.js turns them
-- into copy. Days are UTC calendar days, decided here and never by the client.
--
-- Limits, all enforced below:
--   visits      6 requests a day from one player; 5 waiting for one host;
--               1 resident away per friend; a resident in one place at a time;
--               2 guests on a shelf; 1, 2 or 3 days; a request lapses after
--               48 hours; care is 30 of each kind per visit, 3 seconds apart;
--               a resident copy is under 150,000 bytes.
--   gifts       1 per sender per receiver per day, 20 a day from one player;
--               the first 5 opened in a day pay souls; unopened ones expire
--               after 7 days.
--   guestbook   1 signature per signer per book per day, 20 a day from one
--               player; 24 lines and 6 stamps; a book keeps its newest 60.
--   waves       3 per sender per receiver per day, 30 a day from one player.
--   souls       3 visit endings a day pay each player.
--   everything  older than 60 days is removed (see private.postbox_tidy).
--
-- Housekeeping for the SQL editor, if nobody has opened a postbox in a while:
--   delete from public.visits where created_at < now() - interval '60 days';
--   delete from public.gifts where created_at < now() - interval '60 days';
--   delete from public.guestbook where created_at < now() - interval '60 days';
--   delete from public.waves where created_at < now() - interval '60 days';

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.social_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  dnd boolean not null default false,
  toggled_at timestamptz not null default now(),
  toggles int not null default 0 check (toggles >= 0)
);

-- One row per pair and kind, the lower id first. `today` counts towards the
-- per-day cap of that kind and resets when `day` moves on.
create table if not exists public.friendship_points (
  user_a uuid not null references auth.users (id) on delete cascade,
  user_b uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('case', 'visit', 'gift', 'signature', 'trade', 'hearing', 'wave')),
  total int not null default 0 check (total >= 0),
  day date not null,
  today int not null default 0 check (today >= 0),
  primary key (user_a, user_b, kind),
  constraint friendship_points_order check (user_a < user_b)
);

-- A copy of one resident staying on a friend's shelf. Ownership never moves:
-- `resident` is a snapshot in the readResident() shape, art included.
-- status: pending, accepted, ended (stayed its days), declined, lapsed
-- (nobody answered in 48 hours) or withdrawn (the sender changed their mind).
create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  resident_id text not null check (resident_id ~ '^[a-zA-Z0-9_-]{1,100}$'),
  resident_name text not null default '' check (char_length(resident_name) <= 22),
  resident jsonb not null,
  days int not null check (days between 1 and 3),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'ended', 'declined', 'lapsed', 'withdrawn')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  ends_at timestamptz,
  ended_at timestamptz,
  fed int not null default 0 check (fed between 0 and 30),
  fussed int not null default 0 check (fussed between 0 and 30),
  washed int not null default 0 check (washed between 0 and 30),
  last_care_at timestamptz,
  sender_seen_at timestamptz,
  host_seen_at timestamptz,
  sender_souls int not null default 0 check (sender_souls between 0 and 20),
  host_souls int not null default 0 check (host_souls between 0 and 20),
  constraint visits_not_self check (from_user <> to_user),
  constraint visits_resident_size check (octet_length(resident::text) < 150000)
);
create index if not exists visits_to on public.visits (to_user, status);
create index if not exists visits_from on public.visits (from_user, status);

create table if not exists public.gifts (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  treat text not null check (treat ~ '^[a-z0-9-]{1,24}$'),
  day date not null,
  status text not null default 'sent' check (status in ('sent', 'opened', 'declined')),
  souls int not null default 0 check (souls between 0 and 20),
  created_at timestamptz not null default now(),
  opened_at timestamptz,
  cleared_at timestamptz,
  constraint gifts_not_self check (from_user <> to_user)
);
create unique index if not exists gifts_daily on public.gifts (from_user, to_user, day);
create index if not exists gifts_to on public.gifts (to_user, status);

create table if not exists public.guestbook (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users (id) on delete cascade,
  signer uuid not null references auth.users (id) on delete cascade,
  line int not null check (line between 0 and 23),
  stamp text not null check (stamp in ('skull', 'candle', 'moth', 'teeth', 'coffin', 'eye')),
  day date not null,
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  cleared_at timestamptz,
  constraint guestbook_not_self check (owner <> signer)
);
create unique index if not exists guestbook_daily on public.guestbook (owner, signer, day);
create index if not exists guestbook_owner on public.guestbook (owner, created_at desc);

create table if not exists public.waves (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  resident_id text not null check (resident_id ~ '^[a-zA-Z0-9_-]{1,100}$'),
  resident_name text not null default '' check (char_length(resident_name) <= 22),
  kind text not null check (kind in ('wave', 'poke')),
  line int not null check (line between 0 and 15),
  day date not null,
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  cleared_at timestamptz,
  constraint waves_not_self check (from_user <> to_user)
);
create index if not exists waves_to on public.waves (to_user, created_at desc);
create index if not exists waves_from on public.waves (from_user, day);

-- ---------------------------------------------------------------------------
-- Row level security. Nothing is granted to the API roles, so these policies
-- are a second lock: even a future grant shows a row only to its two players.
-- ---------------------------------------------------------------------------

alter table public.social_prefs enable row level security;
alter table public.friendship_points enable row level security;
alter table public.visits enable row level security;
alter table public.gifts enable row level security;
alter table public.guestbook enable row level security;
alter table public.waves enable row level security;

revoke all on table public.social_prefs, public.friendship_points, public.visits, public.gifts, public.guestbook, public.waves
  from public, anon, authenticated;

drop policy if exists "prefs are for their owner" on public.social_prefs;
create policy "prefs are for their owner" on public.social_prefs
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "points are for the two players" on public.friendship_points;
create policy "points are for the two players" on public.friendship_points
  for select to authenticated using ((select auth.uid()) in (user_a, user_b));

drop policy if exists "visits are for the two players" on public.visits;
create policy "visits are for the two players" on public.visits
  for select to authenticated using ((select auth.uid()) in (from_user, to_user));

drop policy if exists "gifts are for the two players" on public.gifts;
create policy "gifts are for the two players" on public.gifts
  for select to authenticated using ((select auth.uid()) in (from_user, to_user));

drop policy if exists "signatures are for the two players" on public.guestbook;
create policy "signatures are for the two players" on public.guestbook
  for select to authenticated using ((select auth.uid()) in (owner, signer));

drop policy if exists "waves are for the two players" on public.waves;
create policy "waves are for the two players" on public.waves
  for select to authenticated using ((select auth.uid()) in (from_user, to_user));

-- ---------------------------------------------------------------------------
-- Helpers (not callable from the API)
-- ---------------------------------------------------------------------------

create or replace function private.utc_day()
returns date
language sql
stable
set search_path = public
as $$
  select (now() at time zone 'utc')::date;
$$;

-- Either player has blocked the other.
create or replace function private.blocked_either(a uuid, b uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (select 1 from public.blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a));
$$;

create or replace function private.dnd_on(p_user uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce((select dnd from public.social_prefs where user_id = p_user), false);
$$;

-- Friends, not blocked either way, and (for anything that lands in their
-- postbox) not hiding behind Do not disturb.
create or replace function private.require_friend(uid uuid, other uuid, respect_dnd boolean)
returns void
language plpgsql
stable
set search_path = public
as $$
begin
  if other is null or other = uid or not private.are_friends(uid, other) or private.blocked_either(uid, other) then
    perform private.refuse('not_friends');
  end if;
  if respect_dnd and private.dnd_on(other) then perform private.refuse('dnd'); end if;
end;
$$;

-- One more interaction between two friends, within that kind's daily cap.
-- Other migrations call this from their own functions (trades, joint
-- hearings). Returns the pair's new total for the kind, or the old one when
-- the cap is reached or they are not friends.
create or replace function private.bump_friendship(a uuid, b uuid, p_kind text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  lo uuid := least(a, b);
  hi uuid := greatest(a, b);
  d date := private.utc_day();
  cap int := case p_kind when 'case' then 3 when 'visit' then 2 when 'gift' then 1 when 'signature' then 1
    when 'trade' then 3 when 'hearing' then 3 when 'wave' then 1 end;
  pt public.friendship_points%rowtype;
begin
  if a is null or b is null or a = b or cap is null or not private.are_friends(a, b) then return 0; end if;
  insert into public.friendship_points (user_a, user_b, kind, total, day, today)
  values (lo, hi, p_kind, 0, d, 0)
  on conflict (user_a, user_b, kind) do nothing;
  select * into pt from public.friendship_points where user_a = lo and user_b = hi and kind = p_kind for update;
  if pt.day <> d then pt.day := d; pt.today := 0; end if;
  if pt.today >= cap then
    update public.friendship_points set day = pt.day, today = pt.today where user_a = lo and user_b = hi and kind = p_kind;
    return pt.total;
  end if;
  update public.friendship_points set total = pt.total + 1, day = pt.day, today = pt.today + 1
   where user_a = lo and user_b = hi and kind = p_kind;
  return pt.total + 1;
end;
$$;

-- Moves visits on (lapsed requests, finished stays) and removes anything
-- older than 60 days, for the rows this player is in. Called before every
-- read and write here, so the database never needs a scheduler.
create or replace function private.postbox_tidy(uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.visits set status = 'lapsed', ended_at = created_at + interval '48 hours'
   where status = 'pending' and created_at <= now() - interval '48 hours' and uid in (from_user, to_user);
  update public.visits set status = 'ended', ended_at = ends_at
   where status = 'accepted' and ends_at <= now() and uid in (from_user, to_user);
  delete from public.visits where created_at < now() - interval '60 days' and uid in (from_user, to_user);
  delete from public.gifts where created_at < now() - interval '60 days' and uid in (from_user, to_user);
  delete from public.guestbook where created_at < now() - interval '60 days' and uid in (owner, signer);
  delete from public.waves where created_at < now() - interval '60 days' and uid in (from_user, to_user);
end;
$$;

-- Rows a player's postbox may show. Everything is also filtered by block at
-- read time, in case a block was added while a request was in flight.
create or replace function private.name_of(p_user uuid)
returns text
language sql
stable
set search_path = public
as $$
  select coalesce((select display_name from public.profiles where user_id = p_user), '');
$$;

revoke all on function private.utc_day() from public;
revoke all on function private.blocked_either(uuid, uuid) from public;
revoke all on function private.dnd_on(uuid) from public;
revoke all on function private.require_friend(uuid, uuid, boolean) from public;
revoke all on function private.bump_friendship(uuid, uuid, text) from public;
revoke all on function private.postbox_tidy(uuid) from public;
revoke all on function private.name_of(uuid) from public;

-- ---------------------------------------------------------------------------
-- Triggers on 0002's tables, so its functions stay as they are
-- ---------------------------------------------------------------------------

-- Do not disturb also stops new summonses.
create or replace function private.summons_dnd()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if private.dnd_on(new.to_user) then perform private.refuse('dnd'); end if;
  return new;
end;
$$;
drop trigger if exists summons_dnd on public.summons;
create trigger summons_dnd before insert on public.summons for each row execute function private.summons_dnd();

-- A heard case is one more thing the two have done together.
create or replace function private.summons_ruled()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'ruled' and old.status = 'open' then perform private.bump_friendship(new.from_user, new.to_user, 'case'); end if;
  return new;
end;
$$;
drop trigger if exists summons_ruled on public.summons;
create trigger summons_ruled after update on public.summons for each row execute function private.summons_ruled();

-- A block tears up everything between the two, both ways, history included.
create or replace function private.postbox_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  a uuid := new.blocker;
  b uuid := new.blocked;
begin
  delete from public.visits where (from_user = a and to_user = b) or (from_user = b and to_user = a);
  delete from public.gifts where (from_user = a and to_user = b) or (from_user = b and to_user = a);
  delete from public.guestbook where (owner = a and signer = b) or (owner = b and signer = a);
  delete from public.waves where (from_user = a and to_user = b) or (from_user = b and to_user = a);
  delete from public.friendship_points where user_a = least(a, b) and user_b = greatest(a, b);
  return new;
end;
$$;
drop trigger if exists postbox_block on public.blocks;
create trigger postbox_block after insert on public.blocks for each row execute function private.postbox_block();

-- Unfriending sends guests home, withdraws waiting requests and unopened
-- gifts, and drops waves. Finished history stays for the record.
create or replace function private.postbox_unfriend()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  a uuid := old.requester;
  b uuid := old.addressee;
begin
  update public.visits set status = case when status = 'pending' then 'withdrawn' else 'ended' end, ended_at = now(),
         sender_seen_at = coalesce(sender_seen_at, now()), host_seen_at = coalesce(host_seen_at, now())
   where status in ('pending', 'accepted') and ((from_user = a and to_user = b) or (from_user = b and to_user = a));
  delete from public.gifts where status = 'sent' and ((from_user = a and to_user = b) or (from_user = b and to_user = a));
  delete from public.waves where (from_user = a and to_user = b) or (from_user = b and to_user = a);
  return old;
end;
$$;
drop trigger if exists postbox_unfriend on public.friendships;
create trigger postbox_unfriend after delete on public.friendships for each row execute function private.postbox_unfriend();

revoke all on function private.summons_dnd() from public;
revoke all on function private.summons_ruled() from public;
revoke all on function private.postbox_block() from public;
revoke all on function private.postbox_unfriend() from public;

-- ---------------------------------------------------------------------------
-- Do not disturb
-- ---------------------------------------------------------------------------

-- Twenty switches an hour is plenty of indecision.
create or replace function public.set_dnd(p_on boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  p public.social_prefs%rowtype;
begin
  insert into public.social_prefs (user_id) values (uid) on conflict do nothing;
  select * into p from public.social_prefs where user_id = uid for update;
  if p.toggled_at < now() - interval '1 hour' then p.toggles := 0; end if;
  if p.toggles >= 20 then perform private.refuse('rate_limited'); end if;
  update public.social_prefs set dnd = coalesce(p_on, false), toggles = p.toggles + 1,
         toggled_at = case when p.toggles = 0 then now() else p.toggled_at end
   where user_id = uid;
  return jsonb_build_object('ok', true, 'dnd', coalesce(p_on, false));
end;
$$;

-- ---------------------------------------------------------------------------
-- Visits
-- ---------------------------------------------------------------------------

create or replace function public.send_visit(p_to uuid, p_resident jsonb, p_days int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  rid text;
  v public.visits%rowtype;
begin
  perform private.require_friend(uid, p_to, true);
  if p_days is null or p_days not between 1 and 3 then perform private.refuse('bad_visit'); end if;
  if p_resident is null or jsonb_typeof(p_resident) <> 'object' then perform private.refuse('bad_visit'); end if;
  rid := p_resident ->> 'id';
  if rid is null or rid !~ '^[a-zA-Z0-9_-]{1,100}$' then perform private.refuse('bad_visit'); end if;
  if octet_length(p_resident::text) >= 150000 then perform private.refuse('too_large'); end if;
  -- One at a time per pair, so two requests cannot both slip under the caps.
  perform 1 from public.friendships
   where least(requester, addressee) = least(uid, p_to) and greatest(requester, addressee) = greatest(uid, p_to)
   for update;
  perform private.postbox_tidy(uid);
  perform private.postbox_tidy(p_to);
  if (select count(*) from public.visits where from_user = uid and created_at > now() - interval '1 day') >= 6 then
    perform private.refuse('rate_limited');
  end if;
  if exists (select 1 from public.visits where from_user = uid and to_user = p_to and status in ('pending', 'accepted')) then
    perform private.refuse('already_visiting');
  end if;
  if exists (select 1 from public.visits where from_user = uid and resident_id = rid and status in ('pending', 'accepted')) then
    perform private.refuse('already_away');
  end if;
  if (select count(*) from public.visits where to_user = p_to and status = 'pending') >= 5 then
    perform private.refuse('too_many_open');
  end if;
  if (select count(*) from public.visits where to_user = p_to and status = 'accepted') >= 2 then
    perform private.refuse('shelf_full');
  end if;
  insert into public.visits (from_user, to_user, resident_id, resident_name, resident, days)
  values (uid, p_to, rid, private.clean_text(p_resident ->> 'name', 22), p_resident, p_days)
  returning * into v;
  return jsonb_build_object('ok', true, 'id', v.id, 'created_at', v.created_at);
end;
$$;

create or replace function public.withdraw_visit(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
begin
  perform private.postbox_tidy(uid);
  update public.visits set status = 'withdrawn', ended_at = now(), sender_seen_at = now()
   where id = p_id and from_user = uid and status = 'pending';
  if not found then perform private.refuse('not_open'); end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- Answers { ok, status, accepted_at, ends_at }. A full shelf cannot accept.
create or replace function public.respond_visit(p_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  v public.visits%rowtype;
begin
  perform private.postbox_tidy(uid);
  select * into v from public.visits where id = p_id and to_user = uid for update;
  if not found or private.blocked_either(uid, v.from_user) then perform private.refuse('not_found'); end if;
  if v.status = 'lapsed' then perform private.refuse('expired'); end if;
  if v.status <> 'pending' then perform private.refuse('not_open'); end if;
  if coalesce(p_accept, false) then
    if not private.are_friends(uid, v.from_user) then perform private.refuse('not_friends'); end if;
    perform 1 from public.profiles where user_id = uid for update;
    if (select count(*) from public.visits where to_user = uid and status = 'accepted') >= 2 then
      perform private.refuse('shelf_full');
    end if;
    update public.visits set status = 'accepted', accepted_at = now(), ends_at = now() + make_interval(days => v.days)
     where id = p_id returning * into v;
    perform private.bump_friendship(uid, v.from_user, 'visit');
  else
    update public.visits set status = 'declined', ended_at = now() where id = p_id returning * into v;
  end if;
  return jsonb_build_object('ok', true, 'status', v.status, 'accepted_at', v.accepted_at, 'ends_at', v.ends_at);
end;
$$;

-- The host feeds, fusses or washes a guest. Answers the running counts.
create or replace function public.care_visit(p_id uuid, p_kind text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  v public.visits%rowtype;
begin
  if p_kind is null or p_kind not in ('food', 'fuss', 'clean') then perform private.refuse('bad_visit'); end if;
  perform private.postbox_tidy(uid);
  select * into v from public.visits where id = p_id and to_user = uid for update;
  if not found or private.blocked_either(uid, v.from_user) then perform private.refuse('not_found'); end if;
  if v.status <> 'accepted' then perform private.refuse('not_open'); end if;
  if v.last_care_at is not null and v.last_care_at > now() - interval '3 seconds' then perform private.refuse('too_soon'); end if;
  if (p_kind = 'food' and v.fed >= 30) or (p_kind = 'fuss' and v.fussed >= 30) or (p_kind = 'clean' and v.washed >= 30) then
    perform private.refuse('care_full');
  end if;
  update public.visits
     set fed = fed + (p_kind = 'food')::int, fussed = fussed + (p_kind = 'fuss')::int, washed = washed + (p_kind = 'clean')::int,
         last_care_at = now()
   where id = p_id returning * into v;
  return jsonb_build_object('ok', true, 'fed', v.fed, 'fussed', v.fussed, 'washed', v.washed);
end;
$$;

-- Reading the end of a visit. The sender reads the postcard (an ended,
-- declined or lapsed visit) and the host reads the thank-you (an ended one).
-- Souls are paid once, for a stay that happened, three times a day each.
create or replace function public.collect_visit(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  v public.visits%rowtype;
  d date := private.utc_day();
  paid int;
  pay int := 0;
  v_role text;
begin
  perform private.postbox_tidy(uid);
  select * into v from public.visits where id = p_id and uid in (from_user, to_user) for update;
  if not found or private.blocked_either(v.from_user, v.to_user) then perform private.refuse('not_found'); end if;
  v_role := case when v.from_user = uid then 'sender' else 'host' end;
  if (v_role = 'sender' and (v.status not in ('ended', 'declined', 'lapsed') or v.sender_seen_at is not null))
     or (v_role = 'host' and (v.status <> 'ended' or v.host_seen_at is not null)) then
    perform private.refuse('not_open');
  end if;
  if v.status = 'ended' then
    perform 1 from public.profiles where user_id = uid for update;
    select count(*) into paid from public.visits
     where ((from_user = uid and sender_souls > 0 and (sender_seen_at at time zone 'utc')::date = d)
         or (to_user = uid and host_souls > 0 and (host_seen_at at time zone 'utc')::date = d));
    if paid < 3 then pay := case when v_role = 'sender' then 8 else 6 end; end if;
  end if;
  if v_role = 'sender' then
    update public.visits set sender_seen_at = now(), sender_souls = pay where id = p_id returning * into v;
  else
    update public.visits set host_seen_at = now(), host_souls = pay where id = p_id returning * into v;
  end if;
  return jsonb_build_object('ok', true, 'id', v.id, 'role', v_role, 'status', v.status, 'souls', pay,
    'fed', v.fed, 'fussed', v.fussed, 'washed', v.washed, 'days', v.days,
    'resident_id', v.resident_id, 'resident_name', v.resident_name,
    'other_user', case when v_role = 'sender' then v.to_user else v.from_user end,
    'other_name', private.name_of(case when v_role = 'sender' then v.to_user else v.from_user end));
end;
$$;

-- ---------------------------------------------------------------------------
-- Gifts
-- ---------------------------------------------------------------------------

create or replace function public.send_gift(p_to uuid, p_treat text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  d date := private.utc_day();
  g public.gifts%rowtype;
begin
  perform private.require_friend(uid, p_to, true);
  if p_treat is null or p_treat !~ '^[a-z0-9-]{1,24}$' then perform private.refuse('bad_treat'); end if;
  perform 1 from public.friendships
   where least(requester, addressee) = least(uid, p_to) and greatest(requester, addressee) = greatest(uid, p_to)
   for update;
  if exists (select 1 from public.gifts where from_user = uid and to_user = p_to and day = d) then
    perform private.refuse('already_sent');
  end if;
  if (select count(*) from public.gifts where from_user = uid and day = d) >= 20 then perform private.refuse('rate_limited'); end if;
  insert into public.gifts (from_user, to_user, treat, day) values (uid, p_to, p_treat, d) returning * into g;
  return jsonb_build_object('ok', true, 'id', g.id, 'created_at', g.created_at);
end;
$$;

create or replace function public.open_gift(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  g public.gifts%rowtype;
  d date := private.utc_day();
  pay int := 0;
begin
  select * into g from public.gifts where id = p_id and to_user = uid for update;
  if not found or private.blocked_either(uid, g.from_user) then perform private.refuse('not_found'); end if;
  if g.status <> 'sent' then perform private.refuse('not_open'); end if;
  if g.created_at <= now() - interval '7 days' then perform private.refuse('expired'); end if;
  perform 1 from public.profiles where user_id = uid for update;
  if (select count(*) from public.gifts where to_user = uid and souls > 0 and (opened_at at time zone 'utc')::date = d) < 5 then
    pay := 4;
  end if;
  update public.gifts set status = 'opened', opened_at = now(), souls = pay where id = p_id returning * into g;
  perform private.bump_friendship(uid, g.from_user, 'gift');
  return jsonb_build_object('ok', true, 'id', g.id, 'treat', g.treat, 'souls', g.souls);
end;
$$;

create or replace function public.decline_gift(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
begin
  update public.gifts set status = 'declined', opened_at = now() where id = p_id and to_user = uid and status = 'sent';
  if not found then perform private.refuse('not_found'); end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Guestbooks
-- ---------------------------------------------------------------------------

create or replace function public.sign_guestbook(p_owner uuid, p_line int, p_stamp text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  d date := private.utc_day();
  s public.guestbook%rowtype;
begin
  perform private.require_friend(uid, p_owner, false);
  if p_line is null or p_line not between 0 and 23 then perform private.refuse('bad_line'); end if;
  if p_stamp is null or p_stamp not in ('skull', 'candle', 'moth', 'teeth', 'coffin', 'eye') then perform private.refuse('bad_stamp'); end if;
  perform 1 from public.friendships
   where least(requester, addressee) = least(uid, p_owner) and greatest(requester, addressee) = greatest(uid, p_owner)
   for update;
  if exists (select 1 from public.guestbook where owner = p_owner and signer = uid and day = d) then
    perform private.refuse('already_signed');
  end if;
  if (select count(*) from public.guestbook where signer = uid and day = d) >= 20 then perform private.refuse('rate_limited'); end if;
  insert into public.guestbook (owner, signer, line, stamp, day) values (p_owner, uid, p_line, p_stamp, d) returning * into s;
  -- A book keeps its newest sixty.
  delete from public.guestbook where owner = p_owner and id not in
    (select id from public.guestbook where owner = p_owner order by created_at desc, id desc limit 60);
  perform private.bump_friendship(uid, p_owner, 'signature');
  return jsonb_build_object('ok', true, 'id', s.id, 'created_at', s.created_at);
end;
$$;

-- The owner can remove any entry in their book; a signer can take back their own.
create or replace function public.remove_signature(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
begin
  delete from public.guestbook where id = p_id and uid in (owner, signer);
  if not found then perform private.refuse('not_found'); end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- The owner reads the newest 30 in their own book. A friend reads only the
-- entries they wrote in it, and whether they have signed it today.
create or replace function public.guestbook(p_owner uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
begin
  if p_owner is null or (p_owner <> uid and (not private.are_friends(uid, p_owner) or private.blocked_either(uid, p_owner))) then
    perform private.refuse('not_friends');
  end if;
  perform private.postbox_tidy(uid);
  return jsonb_build_object(
    'owner', p_owner,
    'signed_today', exists (select 1 from public.guestbook where owner = p_owner and signer = uid and day = private.utc_day()),
    'entries', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'signer', e.signer, 'signer_name', private.name_of(e.signer),
        'line', e.line, 'stamp', e.stamp, 'created_at', e.created_at) order by e.created_at desc)
      from (select * from public.guestbook g
             where g.owner = p_owner and (p_owner = uid or g.signer = uid)
               and not private.blocked_either(g.owner, g.signer)
             order by g.created_at desc limit 30) e), '[]'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------
-- Waves and pokes
-- ---------------------------------------------------------------------------

-- The resident must be on the friend's published shelf; its name comes from
-- there, never from the sender.
create or replace function public.send_wave(p_to uuid, p_resident text, p_kind text, p_line int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  d date := private.utc_day();
  who text;
  w public.waves%rowtype;
begin
  perform private.require_friend(uid, p_to, true);
  if p_kind is null or p_kind not in ('wave', 'poke') or p_line is null or p_line not between 0 and 15
     or p_resident is null or p_resident !~ '^[a-zA-Z0-9_-]{1,100}$' then
    perform private.refuse('bad_wave');
  end if;
  select r ->> 'name' into who
    from public.shelves s, jsonb_array_elements(case when jsonb_typeof(s.snapshot -> 'residents') = 'array' then s.snapshot -> 'residents' else '[]'::jsonb end) r
   where s.user_id = p_to and r ->> 'id' = p_resident
   limit 1;
  if who is null then perform private.refuse('not_found'); end if;
  if (select count(*) from public.waves where from_user = uid and to_user = p_to and day = d) >= 3 then perform private.refuse('rate_limited'); end if;
  if (select count(*) from public.waves where from_user = uid and day = d) >= 30 then perform private.refuse('rate_limited'); end if;
  insert into public.waves (from_user, to_user, resident_id, resident_name, kind, line, day)
  values (uid, p_to, p_resident, private.clean_text(who, 22), p_kind, p_line, d)
  returning * into w;
  perform private.bump_friendship(uid, p_to, 'wave');
  return jsonb_build_object('ok', true, 'id', w.id, 'resident_name', w.resident_name);
end;
$$;

-- ---------------------------------------------------------------------------
-- The postbox
-- ---------------------------------------------------------------------------

-- Everything this file sends the caller, in one reply:
--   { dnd,
--     requests:   visit requests waiting for the caller (resident with art),
--     guests:     residents staying on the caller's shelf now,
--     away:       the caller's residents waiting at or staying with a friend,
--     endings:    visits the caller has yet to read the end of,
--     gifts:      treats, unopened ones for 7 days, opened ones until cleared,
--     signatures: the newest 30 guestbook entries not cleared,
--     waves:      the newest 30 waves and pokes not cleared,
--     levels:     interaction counts with each friend,
--     gifted_today, signed_today: friends already given a treat or a
--                 signature today }
create or replace function public.postbox()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  d date := private.utc_day();
begin
  perform private.postbox_tidy(uid);
  return jsonb_build_object(
    'dnd', private.dnd_on(uid),
    'requests', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'from_user', v.from_user, 'from_name', private.name_of(v.from_user),
        'resident', v.resident, 'days', v.days, 'created_at', v.created_at) order by v.created_at desc)
      from (select * from public.visits where to_user = uid and status = 'pending'
              and not private.blocked_either(from_user, to_user) order by created_at desc limit 10) v), '[]'::jsonb),
    'guests', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'from_user', v.from_user, 'from_name', private.name_of(v.from_user),
        'resident', v.resident, 'days', v.days, 'accepted_at', v.accepted_at, 'ends_at', v.ends_at,
        'fed', v.fed, 'fussed', v.fussed, 'washed', v.washed) order by v.accepted_at)
      from (select * from public.visits where to_user = uid and status = 'accepted'
              and not private.blocked_either(from_user, to_user) order by accepted_at limit 2) v), '[]'::jsonb),
    'away', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'to_user', v.to_user, 'to_name', private.name_of(v.to_user),
        'resident_id', v.resident_id, 'resident_name', v.resident_name, 'status', v.status, 'days', v.days,
        'created_at', v.created_at, 'ends_at', v.ends_at) order by v.created_at desc)
      from (select * from public.visits where from_user = uid and status in ('pending', 'accepted')
              and not private.blocked_either(from_user, to_user) order by created_at desc limit 50) v), '[]'::jsonb),
    'endings', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'role', v.role, 'other_user', v.other, 'other_name', private.name_of(v.other),
        'resident_id', v.resident_id, 'resident_name', v.resident_name, 'status', v.status, 'days', v.days,
        'fed', v.fed, 'fussed', v.fussed, 'washed', v.washed, 'ended_at', v.ended_at) order by v.ended_at desc)
      from (select x.*, case when x.from_user = uid then 'sender' else 'host' end as role,
                   case when x.from_user = uid then x.to_user else x.from_user end as other
              from public.visits x
             where not private.blocked_either(x.from_user, x.to_user)
               and ((x.from_user = uid and x.sender_seen_at is null and x.status in ('ended', 'declined', 'lapsed'))
                 or (x.to_user = uid and x.host_seen_at is null and x.status = 'ended'))
             order by x.ended_at desc limit 20) v), '[]'::jsonb),
    'gifts', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'from_user', g.from_user, 'from_name', private.name_of(g.from_user),
        'treat', g.treat, 'status', g.status, 'souls', g.souls, 'created_at', g.created_at) order by g.created_at desc)
      from (select * from public.gifts where to_user = uid and cleared_at is null
              and (status <> 'sent' or created_at > now() - interval '7 days')
              and not private.blocked_either(from_user, to_user) order by created_at desc limit 30) g), '[]'::jsonb),
    'signatures', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'signer', s.signer, 'signer_name', private.name_of(s.signer),
        'line', s.line, 'stamp', s.stamp, 'created_at', s.created_at, 'seen', s.seen_at is not null) order by s.created_at desc)
      from (select * from public.guestbook where owner = uid and cleared_at is null
              and not private.blocked_either(owner, signer) order by created_at desc limit 30) s), '[]'::jsonb),
    'waves', coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'from_user', w.from_user, 'from_name', private.name_of(w.from_user),
        'resident_id', w.resident_id, 'resident_name', w.resident_name, 'kind', w.kind, 'line', w.line,
        'created_at', w.created_at, 'seen', w.seen_at is not null) order by w.created_at desc)
      from (select * from public.waves where to_user = uid and cleared_at is null
              and not private.blocked_either(from_user, to_user) order by created_at desc limit 30) w), '[]'::jsonb),
    'levels', coalesce((select jsonb_agg(jsonb_build_object('user_id', l.other, 'kinds', l.kinds, 'total', l.total))
      from (select case when p.user_a = uid then p.user_b else p.user_a end as other,
                   jsonb_object_agg(p.kind, p.total) as kinds, sum(p.total)::int as total
              from public.friendship_points p
             where uid in (p.user_a, p.user_b) and private.are_friends(p.user_a, p.user_b)
             group by 1) l), '[]'::jsonb),
    'gifted_today', coalesce((select jsonb_agg(distinct g.to_user) from public.gifts g where g.from_user = uid and g.day = d), '[]'::jsonb),
    'signed_today', coalesce((select jsonb_agg(distinct s.owner) from public.guestbook s where s.signer = uid and s.day = d), '[]'::jsonb));
end;
$$;

-- Opening the postbox has read the waves and signatures in it.
create or replace function public.postbox_seen()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
begin
  update public.waves set seen_at = now() where to_user = uid and seen_at is null;
  update public.guestbook set seen_at = now() where owner = uid and seen_at is null;
  return jsonb_build_object('ok', true);
end;
$$;

-- "Clear read": seen waves and signatures, and opened or declined gifts, leave
-- the postbox. Signatures stay in the guestbook.
create or replace function public.postbox_clear()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
begin
  update public.waves set cleared_at = now() where to_user = uid and seen_at is not null and cleared_at is null;
  update public.guestbook set cleared_at = now() where owner = uid and seen_at is not null and cleared_at is null;
  update public.gifts set cleared_at = now() where to_user = uid and status <> 'sent' and cleared_at is null;
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Who may call what: signed-in players (anonymous ones included), nobody else.
-- ---------------------------------------------------------------------------

revoke all on function public.set_dnd(boolean) from public, anon, authenticated;
revoke all on function public.send_visit(uuid, jsonb, int) from public, anon, authenticated;
revoke all on function public.withdraw_visit(uuid) from public, anon, authenticated;
revoke all on function public.respond_visit(uuid, boolean) from public, anon, authenticated;
revoke all on function public.care_visit(uuid, text) from public, anon, authenticated;
revoke all on function public.collect_visit(uuid) from public, anon, authenticated;
revoke all on function public.send_gift(uuid, text) from public, anon, authenticated;
revoke all on function public.open_gift(uuid) from public, anon, authenticated;
revoke all on function public.decline_gift(uuid) from public, anon, authenticated;
revoke all on function public.sign_guestbook(uuid, int, text) from public, anon, authenticated;
revoke all on function public.remove_signature(uuid) from public, anon, authenticated;
revoke all on function public.guestbook(uuid) from public, anon, authenticated;
revoke all on function public.send_wave(uuid, text, text, int) from public, anon, authenticated;
revoke all on function public.postbox() from public, anon, authenticated;
revoke all on function public.postbox_seen() from public, anon, authenticated;
revoke all on function public.postbox_clear() from public, anon, authenticated;

grant execute on function public.set_dnd(boolean) to authenticated;
grant execute on function public.send_visit(uuid, jsonb, int) to authenticated;
grant execute on function public.withdraw_visit(uuid) to authenticated;
grant execute on function public.respond_visit(uuid, boolean) to authenticated;
grant execute on function public.care_visit(uuid, text) to authenticated;
grant execute on function public.collect_visit(uuid) to authenticated;
grant execute on function public.send_gift(uuid, text) to authenticated;
grant execute on function public.open_gift(uuid) to authenticated;
grant execute on function public.decline_gift(uuid) to authenticated;
grant execute on function public.sign_guestbook(uuid, int, text) to authenticated;
grant execute on function public.remove_signature(uuid) to authenticated;
grant execute on function public.guestbook(uuid) to authenticated;
grant execute on function public.send_wave(uuid, text, text, int) to authenticated;
grant execute on function public.postbox() to authenticated;
grant execute on function public.postbox_seen() to authenticated;
grant execute on function public.postbox_clear() to authenticated;

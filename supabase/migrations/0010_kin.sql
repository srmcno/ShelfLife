-- Shelf Life: Kin. Foundlings born of two friends' residents, and pen pals
-- between residents on different shelves.
--
-- Run after 0001_accounts_and_saves.sql and 0002_social.sql. Safe to run more
-- than once, and it follows their rules:
--   * every table hangs off auth.users on delete cascade, so
--     delete_my_account() removes all of it without being edited;
--   * row level security is on everywhere and nobody writes a table directly.
--     Every write is a security definer function that starts from
--     private.require_user();
--   * nothing here is free text. Letters are written on each device from
--     canned templates; the server stores only which template week it is,
--     which reply was chosen and the residents' names, traits and moods as
--     their owners already show them to friends.
--
-- Refusals raise errcode P0001 with a short token as the message:
--   not_friends, do_not_disturb, bad_basket, too_large, not_found, no_history,
--   basket_waiting, too_soon, rate_limited, not_open, expired, shelf_full,
--   bad_reply, already_replied, too_many_pals, stopped.
-- src/cloud/kin.js turns them into copy.
--
-- Foundlings. A player "leaves a basket out" for a friend: one of their own
-- residents (a snapshot, as src/cloud/social.js residentSnapshot() writes it)
-- and the id of one of the friend's residents. The server issues the seed. If
-- the friend agrees within 48 hours they send their own resident's snapshot,
-- and both devices blend the same two snapshots with the same seed into a new
-- resident. Each household keeps its own copy. One foundling per pair of
-- friends per 14 days; one basket out between them at a time.
--
-- Pen pals. Two residents on friends' shelves with history together (a
-- hearing in Shelf Court, a foundling, being one, or an introduction after a
-- week of friendship) write to each other. Once a week, by the server's week
-- number, each side's postbox gets a letter from the other shelf's resident.
-- A reply is one of three generated lines, sent as its index.
--
-- Do not disturb: private.kin_dnd() reads public.profiles.dnd_until
-- (timestamptz) or public.profiles.dnd (boolean) when either column exists,
-- and is false otherwise. Nothing here creates them.
--
-- Housekeeping runs inside kin_mail() for the caller's own rows. For the SQL
-- editor now and then:
--   delete from public.kin_letters where created_at < now() - interval '60 days';
--   delete from public.kin_baskets where status <> 'born' and created_at < now() - interval '30 days';
--   delete from public.kin_baskets where status = 'born' and answered_at < now() - interval '90 days';

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.kin_baskets (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  from_parent jsonb not null,
  to_parent_id text not null check (to_parent_id ~ '^[a-zA-Z0-9_-]{1,100}$'),
  to_parent_name text not null default '' check (char_length(to_parent_name) <= 22),
  to_parent jsonb,
  seed bigint not null check (seed between 0 and 2147483647),
  name_roll int not null default 0 check (name_roll between 0 and 49),
  history text not null check (history in ('hearing', 'letters', 'foundling', 'friends')),
  status text not null default 'offered' check (status in ('offered', 'born', 'declined', 'withdrawn')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  from_collected_at timestamptz,
  to_collected_at timestamptz,
  constraint kin_baskets_not_self check (from_user <> to_user),
  constraint kin_baskets_size check (octet_length(from_parent::text) < 150000
    and (to_parent is null or octet_length(to_parent::text) < 150000))
);
create index if not exists kin_baskets_to on public.kin_baskets (to_user, status);
create index if not exists kin_baskets_from on public.kin_baskets (from_user, status);
create index if not exists kin_baskets_pair on public.kin_baskets (least(from_user, to_user), greatest(from_user, to_user), status);

-- One row per pair of residents, the lower user id first.
create table if not exists public.kin_pals (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users (id) on delete cascade,
  user_b uuid not null references auth.users (id) on delete cascade,
  res_a text not null check (res_a ~ '^[a-zA-Z0-9_-]{1,100}$'),
  res_b text not null check (res_b ~ '^[a-zA-Z0-9_-]{1,100}$'),
  name_a text not null default '' check (char_length(name_a) <= 22),
  name_b text not null default '' check (char_length(name_b) <= 22),
  history text not null check (history in ('hearing', 'foundling', 'twin', 'introduced')),
  case_id text check (case_id ~ '^[a-z0-9-]{1,40}$'),
  basket_id uuid references public.kin_baskets (id) on delete set null,
  seed bigint not null check (seed between 0 and 2147483647),
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_by uuid references auth.users (id) on delete set null,
  constraint kin_pals_order check (user_a < user_b),
  constraint kin_pals_unique unique (user_a, res_a, user_b, res_b)
);
create index if not exists kin_pals_b on public.kin_pals (user_b);

create table if not exists public.kin_letters (
  id uuid primary key default gen_random_uuid(),
  pal_id uuid not null references public.kin_pals (id) on delete cascade,
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('weekly', 'reply')),
  week int not null check (week between 0 and 100000),
  reply_to uuid references public.kin_letters (id) on delete cascade,
  choice smallint check (choice between 0 and 2),
  writer jsonb not null,
  reader jsonb not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint kin_letters_not_self check (from_user <> to_user),
  constraint kin_letters_size check (octet_length(writer::text) < 2000 and octet_length(reader::text) < 2000),
  constraint kin_letters_reply check ((kind = 'reply') = (reply_to is not null and choice is not null))
);
create unique index if not exists kin_letters_weekly on public.kin_letters (pal_id, to_user, week) where kind = 'weekly';
create unique index if not exists kin_letters_one_reply on public.kin_letters (reply_to) where kind = 'reply';
create index if not exists kin_letters_to on public.kin_letters (to_user, read_at);
create index if not exists kin_letters_from on public.kin_letters (from_user, created_at);

-- ---------------------------------------------------------------------------
-- Row level security. Nothing is granted: the client only calls functions.
-- ---------------------------------------------------------------------------

alter table public.kin_baskets enable row level security;
alter table public.kin_pals enable row level security;
alter table public.kin_letters enable row level security;
revoke all on table public.kin_baskets, public.kin_pals, public.kin_letters from public, anon, authenticated;

drop policy if exists "baskets are for the two players in them" on public.kin_baskets;
create policy "baskets are for the two players in them" on public.kin_baskets
  for select to authenticated using ((select auth.uid()) in (from_user, to_user));
drop policy if exists "pen pals are for the two players in them" on public.kin_pals;
create policy "pen pals are for the two players in them" on public.kin_pals
  for select to authenticated using ((select auth.uid()) in (user_a, user_b));
drop policy if exists "letters are for the two players in them" on public.kin_letters;
create policy "letters are for the two players in them" on public.kin_letters
  for select to authenticated using ((select auth.uid()) in (from_user, to_user));

-- ---------------------------------------------------------------------------
-- Helpers (not callable from the API)
-- ---------------------------------------------------------------------------

-- Week 0 began on Monday 1 January 2024, in the server's UTC.
create or replace function private.kin_week(t timestamptz)
returns int
language sql
stable
set search_path = public
as $$
  select ((t at time zone 'UTC')::date - date '2024-01-01') / 7;
$$;

create or replace function private.kin_blocked(a uuid, b uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (select 1 from public.blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a));
$$;

-- Do not disturb belongs to another migration. Read it if it is there.
create or replace function private.kin_dnd(target uuid)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  v boolean := false;
begin
  begin
    -- The postbox migration (0003) keeps the switch in social_prefs behind private.dnd_on.
    if to_regprocedure('private.dnd_on(uuid)') is not null then
      execute 'select private.dnd_on($1)' into v using target;
      return coalesce(v, false);
    end if;
    if exists (select 1 from pg_attribute where attrelid = 'public.profiles'::regclass and attname = 'dnd_until' and not attisdropped) then
      execute 'select coalesce(dnd_until > now(), false) from public.profiles where user_id = $1' into v using target;
    elsif exists (select 1 from pg_attribute where attrelid = 'public.profiles'::regclass and attname = 'dnd' and not attisdropped) then
      execute 'select coalesce(dnd::boolean, false) from public.profiles where user_id = $1' into v using target;
    end if;
  exception when others then
    v := false;
  end;
  return coalesce(v, false);
end;
$$;

-- A resident as letters carry it: id, name, up to six trait ids and a mood.
create or replace function private.kin_card(r jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select case when r is null or jsonb_typeof(r) <> 'object' or coalesce(r ->> 'id', '') !~ '^[a-zA-Z0-9_-]{1,100}$' then null
  else jsonb_build_object(
    'id', r ->> 'id',
    'name', coalesce(nullif(private.clean_text(r ->> 'name', 22), ''), 'Someone'),
    'traits', coalesce((select jsonb_agg(t) from (
        select value as t from jsonb_array_elements_text(case when jsonb_typeof(r -> 'traits') = 'array' then r -> 'traits' else '[]'::jsonb end)
         where value ~ '^[a-z]{1,24}$' limit 6) x), '[]'::jsonb),
    'mood', case when r ->> 'mood' in ('content', 'fine', 'annoyed', 'furious') then r ->> 'mood' else 'fine' end)
  end;
$$;

-- One resident on a player's shelf on show, as a card, or null when it is not there.
create or replace function private.kin_shelf_card(owner uuid, rid text)
returns jsonb
language sql
stable
set search_path = public
as $$
  select private.kin_card(r)
    from public.shelves s,
         jsonb_array_elements(case when jsonb_typeof(s.snapshot -> 'residents') = 'array' then s.snapshot -> 'residents' else '[]'::jsonb end) r
   where s.user_id = owner and r ->> 'id' = rid
   limit 1;
$$;

-- What two residents have been through together, or null. The best reason
-- wins; a week of friendship lets any two residents count.
create or replace function private.kin_history(a uuid, ra text, b uuid, rb text)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when exists (select 1 from public.summons s
       where (s.from_user = a and s.to_user = b and s.plaintiff ->> 'id' = ra and s.defendant ->> 'id' = rb)
          or (s.from_user = b and s.to_user = a and s.plaintiff ->> 'id' = rb and s.defendant ->> 'id' = ra)) then 'hearing'
    when exists (select 1 from public.kin_pals p
       where p.ended_at is null
         and ((p.user_a = a and p.res_a = ra and p.user_b = b and p.res_b = rb)
           or (p.user_a = b and p.res_a = rb and p.user_b = a and p.res_b = ra))) then 'letters'
    when exists (select 1 from public.kin_baskets k
       where k.status = 'born'
         and ((k.from_user = a and k.to_user = b and k.from_parent ->> 'id' = ra and k.to_parent_id = rb)
           or (k.from_user = b and k.to_user = a and k.from_parent ->> 'id' = rb and k.to_parent_id = ra))) then 'foundling'
    when exists (select 1 from public.friendships f
       where f.status = 'accepted' and least(f.requester, f.addressee) = least(a, b) and greatest(f.requester, f.addressee) = greatest(a, b)
         and f.created_at <= now() - interval '7 days') then 'friends'
  end;
$$;

-- A pair of pen pals, in canonical order, within the caps: twelve pairs
-- between two players and forty for any one player. Returns the id, or null.
create or replace function private.kin_pal(u1 uuid, r1 text, n1 text, u2 uuid, r2 text, n2 text, p_history text, p_case text, p_basket uuid)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  ua uuid := least(u1, u2);
  ub uuid := greatest(u1, u2);
  ra text := case when u1 < u2 then r1 else r2 end;
  rb text := case when u1 < u2 then r2 else r1 end;
  na text := private.clean_text(case when u1 < u2 then n1 else n2 end, 22);
  nb text := private.clean_text(case when u1 < u2 then n2 else n1 end, 22);
  made uuid;
begin
  if u1 = u2 or coalesce(r1, '') !~ '^[a-zA-Z0-9_-]{1,100}$' or coalesce(r2, '') !~ '^[a-zA-Z0-9_-]{1,100}$' then return null; end if;
  select id into made from public.kin_pals where user_a = ua and res_a = ra and user_b = ub and res_b = rb;
  if found then return made; end if;
  if (select count(*) from public.kin_pals where user_a = ua and user_b = ub) >= 12 then return null; end if;
  if (select count(*) from public.kin_pals where u1 in (user_a, user_b)) >= 40 then return null; end if;
  if (select count(*) from public.kin_pals where u2 in (user_a, user_b)) >= 40 then return null; end if;
  insert into public.kin_pals (user_a, user_b, res_a, res_b, name_a, name_b, history, case_id, basket_id, seed)
  values (ua, ub, ra, rb, na, nb, p_history, case when p_case ~ '^[a-z0-9-]{1,40}$' then p_case end, p_basket,
          floor(random() * 2147483647)::bigint)
  on conflict on constraint kin_pals_unique do nothing
  returning id into made;
  return made;
end;
$$;

-- This week's letter to p_user from every pen pal, written once. A resident
-- must still be on its owner's shelf on show to write or be written to.
create or replace function private.kin_deliver(p_user uuid, p_week int)
returns int
language plpgsql
set search_path = public
as $$
declare
  p record;
  other uuid;
  w jsonb;
  r jsonb;
  made int := 0;
begin
  if p_user is null or private.kin_dnd(p_user) then return 0; end if;
  for p in select * from public.kin_pals k where p_user in (k.user_a, k.user_b) and k.ended_at is null order by k.created_at, k.id limit 40 loop
    other := case when p.user_a = p_user then p.user_b else p.user_a end;
    if not private.are_friends(p_user, other) or private.kin_blocked(p_user, other) then continue; end if;
    w := private.kin_shelf_card(other, case when p.user_a = p_user then p.res_b else p.res_a end);
    r := private.kin_shelf_card(p_user, case when p.user_a = p_user then p.res_a else p.res_b end);
    if w is null or r is null then continue; end if;
    insert into public.kin_letters (pal_id, from_user, to_user, kind, week, writer, reader)
    values (p.id, other, p_user, 'weekly', p_week, w, r)
    on conflict (pal_id, to_user, week) where kind = 'weekly' do nothing;
    if found then made := made + 1; end if;
  end loop;
  return made;
end;
$$;

-- Another feature's friendship levels, when that migration is present.
create or replace function private.kin_bump(a uuid, b uuid, kind text)
returns void
language plpgsql
set search_path = public
as $$
begin
  if to_regprocedure('private.bump_friendship(uuid,uuid,text)') is not null then
    execute 'select private.bump_friendship($1, $2, $3)' using a, b, kind;
  end if;
exception when others then
  null; -- a friendship level is never worth losing a foundling over
end;
$$;

-- Unfriending or blocking ends the correspondence and takes in any basket
-- still waiting. A foundling already born stays collectable on both sides:
-- nothing either player earned is taken away.
create or replace function private.kin_unfriended()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.kin_pals
   where user_a = least(old.requester, old.addressee) and user_b = greatest(old.requester, old.addressee);
  delete from public.kin_baskets
   where status <> 'born'
     and ((from_user = old.requester and to_user = old.addressee) or (from_user = old.addressee and to_user = old.requester));
  return old;
end;
$$;

drop trigger if exists kin_unfriended on public.friendships;
create trigger kin_unfriended after delete on public.friendships
  for each row execute function private.kin_unfriended();

revoke all on function private.kin_week(timestamptz) from public;
revoke all on function private.kin_blocked(uuid, uuid) from public;
revoke all on function private.kin_dnd(uuid) from public;
revoke all on function private.kin_card(jsonb) from public;
revoke all on function private.kin_shelf_card(uuid, text) from public;
revoke all on function private.kin_history(uuid, text, uuid, text) from public;
revoke all on function private.kin_pal(uuid, text, text, uuid, text, text, text, text, uuid) from public;
revoke all on function private.kin_deliver(uuid, int) from public;
revoke all on function private.kin_bump(uuid, uuid, text) from public;
revoke all on function private.kin_unfriended() from public;

-- ---------------------------------------------------------------------------
-- Foundlings
-- ---------------------------------------------------------------------------

-- { ok, id, expires_at }. p_parent is the caller's resident snapshot; p_theirs
-- the id of a resident on the friend's shelf on show.
create or replace function public.kin_leave_basket(p_to uuid, p_parent jsonb, p_theirs text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  theirs jsonb;
  why text;
  made public.kin_baskets%rowtype;
begin
  if p_to is null or p_to = uid or not private.are_friends(uid, p_to) or private.kin_blocked(uid, p_to) then
    perform private.refuse('not_friends');
  end if;
  if private.kin_dnd(p_to) then perform private.refuse('do_not_disturb'); end if;
  if p_parent is null or jsonb_typeof(p_parent) <> 'object' or coalesce(p_parent ->> 'id', '') !~ '^[a-zA-Z0-9_-]{1,100}$'
     or coalesce(p_theirs, '') !~ '^[a-zA-Z0-9_-]{1,100}$' then
    perform private.refuse('bad_basket');
  end if;
  if octet_length(p_parent::text) >= 150000 then perform private.refuse('too_large'); end if;
  theirs := private.kin_shelf_card(p_to, p_theirs);
  if theirs is null then perform private.refuse('not_found'); end if;
  why := private.kin_history(uid, p_parent ->> 'id', p_to, p_theirs);
  if why is null then perform private.refuse('no_history'); end if;
  -- One decision at a time per pair of players.
  perform 1 from public.friendships
   where least(requester, addressee) = least(uid, p_to) and greatest(requester, addressee) = greatest(uid, p_to)
   for update;
  if exists (select 1 from public.kin_baskets
     where least(from_user, to_user) = least(uid, p_to) and greatest(from_user, to_user) = greatest(uid, p_to)
       and status = 'offered' and created_at > now() - interval '48 hours') then
    perform private.refuse('basket_waiting');
  end if;
  if exists (select 1 from public.kin_baskets
     where least(from_user, to_user) = least(uid, p_to) and greatest(from_user, to_user) = greatest(uid, p_to)
       and status = 'born' and answered_at > now() - interval '14 days') then
    perform private.refuse('too_soon');
  end if;
  if (select count(*) from public.kin_baskets where from_user = uid and created_at > now() - interval '1 day') >= 6 then
    perform private.refuse('rate_limited');
  end if;
  insert into public.kin_baskets (from_user, to_user, from_parent, to_parent_id, to_parent_name, seed, history)
  values (uid, p_to, p_parent, p_theirs, theirs ->> 'name', floor(random() * 2147483647)::bigint, why)
  returning * into made;
  return jsonb_build_object('ok', true, 'id', made.id, 'expires_at', made.created_at + interval '48 hours');
end;
$$;

-- Accept with the caller's own resident snapshot and the name they settled on,
-- or decline. { ok, id, status, seed, name_roll, answered_at }
create or replace function public.kin_answer_basket(p_id uuid, p_accept boolean, p_parent jsonb default null, p_name_roll int default 0)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  b public.kin_baskets%rowtype;
  on_show int;
begin
  select * into b from public.kin_baskets where id = p_id and to_user = uid for update;
  if not found then perform private.refuse('not_found'); end if;
  if b.status <> 'offered' then perform private.refuse('not_open'); end if;
  if b.created_at <= now() - interval '48 hours' then perform private.refuse('expired'); end if;
  if not coalesce(p_accept, false) then
    update public.kin_baskets set status = 'declined', answered_at = now() where id = p_id;
    return jsonb_build_object('ok', true, 'id', p_id, 'status', 'declined');
  end if;
  if not private.are_friends(uid, b.from_user) or private.kin_blocked(uid, b.from_user) then perform private.refuse('not_friends'); end if;
  if p_parent is null or jsonb_typeof(p_parent) <> 'object' or p_parent ->> 'id' is distinct from b.to_parent_id
     or p_name_roll is null or p_name_roll not between 0 and 49 then
    perform private.refuse('bad_basket');
  end if;
  if octet_length(p_parent::text) >= 150000 then perform private.refuse('too_large'); end if;
  -- The device checks its own free space; a shelf on show with eighteen residents is full whatever it says.
  select jsonb_array_length(case when jsonb_typeof(snapshot -> 'residents') = 'array' then snapshot -> 'residents' else '[]'::jsonb end)
    into on_show from public.shelves where user_id = uid;
  if coalesce(on_show, 0) >= 18 then perform private.refuse('shelf_full'); end if;
  if exists (select 1 from public.kin_baskets
     where least(from_user, to_user) = least(uid, b.from_user) and greatest(from_user, to_user) = greatest(uid, b.from_user)
       and status = 'born' and answered_at > now() - interval '14 days') then
    perform private.refuse('too_soon');
  end if;
  update public.kin_baskets
     set status = 'born', to_parent = p_parent, name_roll = p_name_roll, answered_at = now(), to_collected_at = now()
   where id = p_id
  returning * into b;
  -- The parents write to each other, and so do the two copies of the child.
  perform private.kin_pal(b.from_user, b.from_parent ->> 'id', b.from_parent ->> 'name', uid, b.to_parent_id, p_parent ->> 'name', 'foundling', null, b.id);
  perform private.kin_pal(b.from_user, 'kin' || left(replace(b.id::text, '-', ''), 12), '', uid, 'kin' || left(replace(b.id::text, '-', ''), 12), '', 'twin', null, b.id);
  perform private.kin_bump(uid, b.from_user, 'foundling');
  return jsonb_build_object('ok', true, 'id', b.id, 'status', b.status, 'seed', b.seed, 'name_roll', b.name_roll, 'answered_at', b.answered_at);
end;
$$;

create or replace function public.kin_withdraw_basket(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
begin
  update public.kin_baskets set status = 'withdrawn', answered_at = now()
   where id = p_id and from_user = uid and status = 'offered';
  if not found then perform private.refuse('not_found'); end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- The leaver's copy has been taken in on their device. Idempotent.
create or replace function public.kin_collect(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
begin
  update public.kin_baskets set from_collected_at = coalesce(from_collected_at, now())
   where id = p_id and from_user = uid and status = 'born';
  if not found then perform private.refuse('not_found'); end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Pen pals
-- ---------------------------------------------------------------------------

-- Two residents who have history write to each other. { ok, id }
create or replace function public.kin_introduce(p_friend uuid, p_mine text, p_theirs text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  mine jsonb;
  theirs jsonb;
  existing public.kin_pals%rowtype;
  made uuid;
begin
  if p_friend is null or p_friend = uid or not private.are_friends(uid, p_friend) or private.kin_blocked(uid, p_friend) then
    perform private.refuse('not_friends');
  end if;
  if private.kin_dnd(p_friend) then perform private.refuse('do_not_disturb'); end if;
  mine := private.kin_shelf_card(uid, p_mine);
  theirs := private.kin_shelf_card(p_friend, p_theirs);
  if mine is null or theirs is null then perform private.refuse('not_found'); end if;
  select * into existing from public.kin_pals
   where user_a = least(uid, p_friend) and user_b = greatest(uid, p_friend)
     and res_a = case when uid < p_friend then p_mine else p_theirs end
     and res_b = case when uid < p_friend then p_theirs else p_mine end
   for update;
  if found then
    if existing.ended_at is null then return jsonb_build_object('ok', true, 'id', existing.id); end if;
    if existing.ended_by is distinct from uid then perform private.refuse('stopped'); end if;
    update public.kin_pals set ended_at = null, ended_by = null where id = existing.id;
    return jsonb_build_object('ok', true, 'id', existing.id);
  end if;
  if private.kin_history(uid, p_mine, p_friend, p_theirs) is null then perform private.refuse('no_history'); end if;
  if (select count(*) from public.kin_pals where (user_a = uid or user_b = uid) and created_at > now() - interval '1 day' and history = 'introduced') >= 10 then
    perform private.refuse('rate_limited');
  end if;
  made := private.kin_pal(uid, p_mine, mine ->> 'name', p_friend, p_theirs, theirs ->> 'name', 'introduced', null, null);
  if made is null then perform private.refuse('too_many_pals'); end if;
  return jsonb_build_object('ok', true, 'id', made);
end;
$$;

-- Stops a correspondence for both sides. Its letters go with it; copies
-- already kept on a device stay there. It is not recreated by itself.
create or replace function public.kin_end(p_pal uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
begin
  update public.kin_pals set ended_at = now(), ended_by = uid
   where id = p_pal and uid in (user_a, user_b) and ended_at is null;
  if not found then perform private.refuse('not_found'); end if;
  delete from public.kin_letters where pal_id = p_pal;
  return jsonb_build_object('ok', true);
end;
$$;

-- Answers a weekly letter with one of the three generated replies. { ok, id }
create or replace function public.kin_reply(p_letter uuid, p_choice int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  l public.kin_letters%rowtype;
  writer jsonb;
  made uuid;
begin
  if p_choice is null or p_choice not between 0 and 2 then perform private.refuse('bad_reply'); end if;
  select * into l from public.kin_letters where id = p_letter and to_user = uid for update;
  if not found then perform private.refuse('not_found'); end if;
  if l.kind <> 'weekly' then perform private.refuse('bad_reply'); end if;
  if exists (select 1 from public.kin_letters where reply_to = l.id) then perform private.refuse('already_replied'); end if;
  if not private.are_friends(uid, l.from_user) or private.kin_blocked(uid, l.from_user) then perform private.refuse('not_friends'); end if;
  if private.kin_dnd(l.from_user) then perform private.refuse('do_not_disturb'); end if;
  if (select count(*) from public.kin_letters where from_user = uid and kind = 'reply' and created_at > now() - interval '1 day') >= 20 then
    perform private.refuse('rate_limited');
  end if;
  -- Both devices write the reply from the same cards, so it reads the same on each.
  writer := l.reader;
  insert into public.kin_letters (pal_id, from_user, to_user, kind, week, reply_to, choice, writer, reader)
  values (l.pal_id, uid, l.from_user, 'reply', l.week, l.id, p_choice, writer, l.writer)
  returning id into made;
  update public.kin_letters set read_at = coalesce(read_at, now()) where id = l.id;
  perform private.kin_bump(uid, l.from_user, 'letter');
  return jsonb_build_object('ok', true, 'id', made);
end;
$$;

create or replace function public.kin_read(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
begin
  update public.kin_letters set read_at = coalesce(read_at, now()) where id = p_id and to_user = uid;
  return jsonb_build_object('ok', found);
end;
$$;

-- ---------------------------------------------------------------------------
-- The postbox
-- ---------------------------------------------------------------------------

-- Everything Kin has for the caller, after writing this week's letters:
--   { now, week,
--     baskets: [{ id, direction: 'in' | 'out', status: 'offered' | 'born' | 'returned', from_user, to_user,
--                 from_name, to_name, from_parent, to_parent_id, to_parent_name, to_parent, seed, name_roll,
--                 history, created_at, expires_at, answered_at, collected }],
--     pals: [{ id, friend, mine: { id, name }, theirs: { id, name }, history, case_id, basket_id, seed, created_at }],
--     letters: [{ id, pal_id, from_user, kind, week, reply_to, choice, writer, reader, created_at }],   unread, to the caller
--     friends: [{ user_id, since, week_old, open_basket, next_basket_at, hearings: [[mine, theirs], ...] }] }
-- An incoming basket's seed is shown so the recipient can see what they are
-- agreeing to; the leaver sees it only once the foundling is born.
create or replace function public.kin_mail()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  s record;
begin
  -- Housekeeping, for the caller's own rows.
  delete from public.kin_letters where uid in (from_user, to_user) and created_at < now() - interval '60 days';
  delete from public.kin_baskets where uid in (from_user, to_user)
     and ((status <> 'born' and created_at < now() - interval '30 days') or (status = 'born' and answered_at < now() - interval '90 days'));
  -- Recent hearings between friends make pen pals of the two residents.
  for s in select x.* from public.summons x
            where x.status = 'ruled' and uid in (x.from_user, x.to_user) and x.ruled_at > now() - interval '60 days'
              and private.are_friends(x.from_user, x.to_user) and not private.kin_blocked(x.from_user, x.to_user)
            order by x.ruled_at desc limit 6 loop
    perform private.kin_pal(s.from_user, s.plaintiff ->> 'id', s.plaintiff ->> 'name', s.to_user, s.defendant ->> 'id', s.defendant ->> 'name', 'hearing', s.case_id, null);
  end loop;
  perform private.kin_deliver(uid, private.kin_week(now()));
  return jsonb_build_object(
    'now', now(),
    'week', private.kin_week(now()),
    'baskets', coalesce((select jsonb_agg(x.item order by x.item ->> 'created_at' desc) from (
      select jsonb_build_object(
        'id', k.id,
        'direction', case when k.from_user = uid then 'out' else 'in' end,
        'status', case when k.status in ('declined', 'withdrawn') or (k.status = 'offered' and k.created_at <= now() - interval '48 hours') then 'returned' else k.status end,
        'from_user', k.from_user, 'to_user', k.to_user,
        'from_name', case when private.kin_blocked(k.from_user, k.to_user) then '' else coalesce(pf.display_name, '') end,
        'to_name', case when private.kin_blocked(k.from_user, k.to_user) then '' else coalesce(pt.display_name, '') end,
        'from_parent', case when (k.to_user = uid and k.status = 'offered') or k.status = 'born' then k.from_parent
                            else jsonb_build_object('id', k.from_parent -> 'id', 'name', k.from_parent -> 'name') end,
        'to_parent_id', k.to_parent_id, 'to_parent_name', k.to_parent_name,
        'to_parent', case when k.status = 'born' then k.to_parent end,
        'seed', case when k.status = 'born' or (k.to_user = uid and k.status = 'offered') then k.seed end,
        'name_roll', k.name_roll, 'history', k.history,
        'created_at', k.created_at, 'expires_at', k.created_at + interval '48 hours', 'answered_at', k.answered_at,
        'collected', case when k.from_user = uid then k.from_collected_at is not null else k.to_collected_at is not null end) as item
        from public.kin_baskets k
        left join public.profiles pf on pf.user_id = k.from_user
        left join public.profiles pt on pt.user_id = k.to_user
       where (k.to_user = uid and k.status = 'offered' and k.created_at > now() - interval '48 hours'
              and private.are_friends(k.from_user, uid) and not private.kin_blocked(k.from_user, uid))
          or (k.from_user = uid and k.status = 'offered' and k.created_at > now() - interval '48 hours')
          or (k.from_user = uid and k.status = 'born' and k.from_collected_at is null)
          or (k.from_user = uid and k.status <> 'born' and coalesce(k.answered_at, k.created_at + interval '48 hours') > now() - interval '3 days'
              and (k.status <> 'offered' or k.created_at <= now() - interval '48 hours'))
       order by k.created_at desc limit 12) x), '[]'::jsonb),
    'pals', coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'friend', case when p.user_a = uid then p.user_b else p.user_a end,
        'mine', jsonb_build_object('id', case when p.user_a = uid then p.res_a else p.res_b end,
          'name', coalesce(private.kin_shelf_card(uid, case when p.user_a = uid then p.res_a else p.res_b end) ->> 'name',
                           case when p.user_a = uid then p.name_a else p.name_b end)),
        'theirs', jsonb_build_object('id', case when p.user_a = uid then p.res_b else p.res_a end,
          'name', coalesce(private.kin_shelf_card(case when p.user_a = uid then p.user_b else p.user_a end, case when p.user_a = uid then p.res_b else p.res_a end) ->> 'name',
                           case when p.user_a = uid then p.name_b else p.name_a end)),
        'history', p.history, 'case_id', p.case_id, 'basket_id', p.basket_id, 'seed', p.seed, 'created_at', p.created_at)
        order by p.created_at)
        from public.kin_pals p
       where uid in (p.user_a, p.user_b) and p.ended_at is null
         and private.are_friends(p.user_a, p.user_b) and not private.kin_blocked(p.user_a, p.user_b)), '[]'::jsonb),
    'letters', coalesce((select jsonb_agg(jsonb_build_object(
        'id', l.id, 'pal_id', l.pal_id, 'from_user', l.from_user, 'kind', l.kind, 'week', l.week,
        'reply_to', l.reply_to, 'choice', l.choice, 'writer', l.writer, 'reader', l.reader, 'created_at', l.created_at)
        order by l.created_at)
        from (select * from public.kin_letters x
               where x.to_user = uid and x.read_at is null and not private.kin_blocked(x.from_user, uid)
               order by x.created_at desc limit 30) l), '[]'::jsonb),
    'friends', coalesce((select jsonb_agg(jsonb_build_object(
        'user_id', fr.other,
        'since', fr.created_at,
        'week_old', fr.created_at <= now() - interval '7 days',
        'open_basket', exists (select 1 from public.kin_baskets k
            where least(k.from_user, k.to_user) = least(uid, fr.other) and greatest(k.from_user, k.to_user) = greatest(uid, fr.other)
              and k.status = 'offered' and k.created_at > now() - interval '48 hours'),
        'next_basket_at', (select max(k.answered_at) + interval '14 days' from public.kin_baskets k
            where least(k.from_user, k.to_user) = least(uid, fr.other) and greatest(k.from_user, k.to_user) = greatest(uid, fr.other)
              and k.status = 'born' and k.answered_at > now() - interval '14 days'),
        'hearings', coalesce((select jsonb_agg(h.pair) from (
            select distinct jsonb_build_array(
                case when x.from_user = uid then x.plaintiff ->> 'id' else x.defendant ->> 'id' end,
                case when x.from_user = uid then x.defendant ->> 'id' else x.plaintiff ->> 'id' end) as pair
              from public.summons x
             where (x.from_user = uid and x.to_user = fr.other) or (x.from_user = fr.other and x.to_user = uid)
             limit 12) h), '[]'::jsonb)))
        from (select case when f.requester = uid then f.addressee else f.requester end as other, f.created_at
                from public.friendships f
               where f.status = 'accepted' and uid in (f.requester, f.addressee)
               limit 200) fr), '[]'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------
-- Who may call what: signed-in players (anonymous ones included), nobody else.
-- ---------------------------------------------------------------------------

revoke all on function public.kin_leave_basket(uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.kin_answer_basket(uuid, boolean, jsonb, int) from public, anon, authenticated;
revoke all on function public.kin_withdraw_basket(uuid) from public, anon, authenticated;
revoke all on function public.kin_collect(uuid) from public, anon, authenticated;
revoke all on function public.kin_introduce(uuid, text, text) from public, anon, authenticated;
revoke all on function public.kin_end(uuid) from public, anon, authenticated;
revoke all on function public.kin_reply(uuid, int) from public, anon, authenticated;
revoke all on function public.kin_read(uuid) from public, anon, authenticated;
revoke all on function public.kin_mail() from public, anon, authenticated;

grant execute on function public.kin_leave_basket(uuid, jsonb, text) to authenticated;
grant execute on function public.kin_answer_basket(uuid, boolean, jsonb, int) to authenticated;
grant execute on function public.kin_withdraw_basket(uuid) to authenticated;
grant execute on function public.kin_collect(uuid) to authenticated;
grant execute on function public.kin_introduce(uuid, text, text) to authenticated;
grant execute on function public.kin_end(uuid) to authenticated;
grant execute on function public.kin_reply(uuid, int) to authenticated;
grant execute on function public.kin_read(uuid) to authenticated;
grant execute on function public.kin_mail() to authenticated;

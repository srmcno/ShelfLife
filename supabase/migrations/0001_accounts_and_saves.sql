-- Shelf Life: optional accounts and cloud saves.
--
-- Safe to run more than once (paste it into the Supabase SQL editor twice and
-- nothing changes the second time). Conventions later migrations rely on:
--   * every per-player table is keyed by user_id and references auth.users
--     on delete cascade, so delete_my_account() never needs editing;
--   * players never write tables directly. Every write is a security definer
--     function that checks auth.uid(); tables are read-only, owner-only;
--   * helpers that clients must not call live in the private schema, which
--     the Supabase API does not expose.
-- 0002_social.sql can add friends, summons, shelves and scores the same way,
-- looking players up by profiles.friend_code, without touching this file.

create schema if not exists private;
revoke all on schema private from public;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  friend_code text unique not null check (friend_code ~ '^[A-HJKMNP-Z2-9]{8}$'),
  display_name text not null default '' check (char_length(display_name) <= 24),
  created_at timestamptz default now()
);

create table if not exists public.saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  rev bigint not null default 0,
  data jsonb not null,
  device_id text not null default '' check (char_length(device_id) <= 100),
  updated_at timestamptz not null default now(),
  constraint saves_data_size check (octet_length(data::text) < 6000000)
);

-- ---------------------------------------------------------------------------
-- Row level security: each player sees only their own rows. Supabase grants
-- new tables to anon and authenticated by default, so take that back first.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.saves enable row level security;

revoke all on table public.profiles, public.saves from public, anon, authenticated;
grant select on table public.profiles, public.saves to authenticated;

drop policy if exists "profiles are private to their owner" on public.profiles;
create policy "profiles are private to their owner" on public.profiles
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "saves are private to their owner" on public.saves;
create policy "saves are private to their owner" on public.saves
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Helpers (not callable from the API)
-- ---------------------------------------------------------------------------

-- Eight characters with no 0/O, 1/I or L, so a code survives being read aloud.
create or replace function private.new_friend_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text := '';
begin
  for i in 1..8 loop
    code := code || substr(alphabet, 1 + get_byte(uuid_send(gen_random_uuid()), 0) % 31, 1);
  end loop;
  return code;
end;
$$;

create or replace function private.require_user()
returns uuid
language plpgsql
stable
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'sign in first' using errcode = '28000';
  end if;
  return uid;
end;
$$;

revoke all on function private.new_friend_code() from public;
revoke all on function private.require_user() from public;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create or replace function public.ensure_profile(p_name text default '')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  p public.profiles%rowtype;
  tries int := 0;
begin
  select * into p from public.profiles where user_id = uid;
  while not found loop
    tries := tries + 1;
    begin
      insert into public.profiles (user_id, friend_code, display_name)
      values (uid, private.new_friend_code(), left(btrim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]]', '', 'g')), 24))
      returning * into p;
    exception when unique_violation then
      -- A friend code collision, or a second tab got there first.
      if tries >= 8 then raise; end if;
      select * into p from public.profiles where user_id = uid;
    end;
  end loop;
  return jsonb_build_object('friend_code', p.friend_code, 'display_name', p.display_name);
end;
$$;

create or replace function public.set_display_name(p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  p public.profiles%rowtype;
begin
  perform public.ensure_profile('');
  update public.profiles
     set display_name = left(btrim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]]', '', 'g')), 24)
   where user_id = uid
  returning * into p;
  return jsonb_build_object('friend_code', p.friend_code, 'display_name', p.display_name);
end;
$$;

-- ---------------------------------------------------------------------------
-- Saves: one row per player, written only when the caller saw the latest rev.
-- ---------------------------------------------------------------------------

create or replace function public.push_save(p_base_rev bigint, p_data jsonb, p_device text default '')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  cur public.saves%rowtype;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'save must be a json object' using errcode = '22023';
  end if;
  select * into cur from public.saves where user_id = uid for update;
  if not found then
    if coalesce(p_base_rev, 0) <> 0 then
      return jsonb_build_object('ok', false, 'conflict', true, 'rev', 0, 'updated_at', null, 'device', null);
    end if;
    insert into public.saves (user_id, rev, data, device_id)
    values (uid, 1, p_data, left(coalesce(p_device, ''), 100))
    on conflict (user_id) do nothing
    returning * into cur;
    if not found then
      -- Another first push won the race; report it like any other conflict.
      select * into cur from public.saves where user_id = uid;
      return jsonb_build_object('ok', false, 'conflict', true, 'rev', cur.rev, 'updated_at', cur.updated_at, 'device', cur.device_id);
    end if;
    return jsonb_build_object('ok', true, 'rev', cur.rev, 'updated_at', cur.updated_at);
  end if;
  if cur.rev <> coalesce(p_base_rev, -1) then
    return jsonb_build_object('ok', false, 'conflict', true, 'rev', cur.rev, 'updated_at', cur.updated_at, 'device', cur.device_id);
  end if;
  update public.saves
     set rev = cur.rev + 1, data = p_data, device_id = left(coalesce(p_device, ''), 100), updated_at = now()
   where user_id = uid
  returning * into cur;
  return jsonb_build_object('ok', true, 'rev', cur.rev, 'updated_at', cur.updated_at);
end;
$$;

create or replace function public.pull_save()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('rev', s.rev, 'data', s.data, 'updated_at', s.updated_at, 'device', s.device_id)
    from public.saves s
   where s.user_id = private.require_user();
$$;

-- ---------------------------------------------------------------------------
-- Account deletion (Google Play requires an in-app path). Everything keyed by
-- user_id cascades from auth.users.
-- ---------------------------------------------------------------------------

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users where id = private.require_user();
end;
$$;

-- ---------------------------------------------------------------------------
-- Who may call what: signed-in players (anonymous ones included), nobody else.
-- ---------------------------------------------------------------------------

revoke all on function public.ensure_profile(text) from public, anon, authenticated;
revoke all on function public.set_display_name(text) from public, anon, authenticated;
revoke all on function public.push_save(bigint, jsonb, text) from public, anon, authenticated;
revoke all on function public.pull_save() from public, anon, authenticated;
revoke all on function public.delete_my_account() from public, anon, authenticated;

grant execute on function public.ensure_profile(text) to authenticated;
grant execute on function public.set_display_name(text) to authenticated;
grant execute on function public.push_save(bigint, jsonb, text) to authenticated;
grant execute on function public.pull_save() to authenticated;
grant execute on function public.delete_my_account() to authenticated;

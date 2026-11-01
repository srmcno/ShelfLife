-- Players choose whether their display name appears in the directory. Existing
-- accounts stay unlisted until their owner explicitly joins.
create table if not exists private.discovery_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  listed boolean not null default false,
  changed_at timestamptz not null default now()
);
create table if not exists private.discovery_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('search', 'setting', 'request')),
  at timestamptz not null default now()
);
-- Directory requests did not disclose either player's friend code. Retain that
-- distinction until the friendship is removed or accepted.
create table if not exists private.discovery_requests (
  requester uuid not null,
  addressee uuid not null,
  primary key (requester, addressee),
  foreign key (requester, addressee) references public.friendships(requester, addressee) on delete cascade
);
-- Only whole-cell identifiers are stored. Cell height is one degree and
-- longitude widths are adjusted by latitude to remain broadly comparable.
create table if not exists private.discovery_areas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  latitude_band smallint not null check (latitude_band between 0 and 179),
  longitude_band smallint not null,
  check (longitude_band >= 0 and longitude_band < greatest(1, floor(360 * cos(radians(latitude_band - 89.5)))::int))
);
alter table private.discovery_areas enable row level security;
revoke all on private.discovery_areas from public, anon, authenticated;
-- Retain only when an area was last shared, not its contents, after removal.
create table if not exists private.discovery_area_changes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_shared_at timestamptz not null
);
alter table private.discovery_area_changes enable row level security;
revoke all on private.discovery_area_changes from public, anon, authenticated;
create index if not exists discovery_attempts_recent on private.discovery_attempts(user_id, kind, at);
alter table private.discovery_preferences enable row level security;
alter table private.discovery_attempts enable row level security;
alter table private.discovery_requests enable row level security;
revoke all on private.discovery_preferences, private.discovery_attempts, private.discovery_requests from public, anon, authenticated;

create or replace function private.discovery_rate(p_user uuid, p_kind text) returns void
language plpgsql security definer set search_path = '' as $$
declare maximum int;
begin
  maximum := case p_kind when 'search' then 120 when 'setting' then 30 when 'request' then 40 else 0 end;
  perform pg_advisory_xact_lock(hashtextextended('discovery-rate:' || p_user::text || ':' || p_kind, 0));
  delete from private.discovery_attempts where user_id = p_user and at < now() - interval '1 day';
  if maximum = 0 or (select count(*) from private.discovery_attempts where user_id = p_user and kind = p_kind and at > now() - interval '1 hour') >= maximum then
    perform private.refuse('rate_limited');
  end if;
  insert into private.discovery_attempts(user_id, kind) values (p_user, p_kind);
end $$;

create or replace function public.discovery_status() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user();
begin
  return jsonb_build_object('listed', coalesce((select listed from private.discovery_preferences where user_id = uid), false), 'nearby', exists(select 1 from private.discovery_areas where user_id = uid));
end $$;

create or replace function public.discovery_set(p_on boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user(); name text;
begin
  if p_on is null then perform private.refuse('bad_discovery'); end if;
  if p_on then
    perform private.discovery_rate(uid, 'setting');
  else
    -- Removal must remain possible even when the setting rate limit is full.
    perform pg_advisory_xact_lock(hashtextextended('discovery-rate:' || uid::text || ':setting', 0));
  end if;
  perform public.ensure_profile('');
  select display_name into name from public.profiles where user_id = uid;
  if p_on and coalesce(btrim(name), '') = '' then perform private.refuse('name_required'); end if;
  insert into private.discovery_preferences(user_id, listed) values (uid, p_on)
    on conflict (user_id) do update set listed = excluded.listed, changed_at = now();
  if not p_on then delete from private.discovery_areas where user_id = uid; end if;
  return jsonb_build_object('listed', p_on);
end $$;

create or replace function public.discovery_find(p_query text default '', p_offset int default 0) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user(); result jsonb;
begin
  if p_query is null or char_length(p_query) > 24 or p_query ~ '[[:cntrl:]]' or p_offset is null or p_offset < 0 or p_offset > 1000 then
    perform private.refuse('bad_discovery');
  end if;
  perform private.discovery_rate(uid, 'search');
  select coalesce(jsonb_agg(jsonb_build_object('user_id', item.user_id, 'display_name', item.display_name) order by item.sort_name, item.user_id), '[]'::jsonb)
    into result from (
      select p.user_id, p.display_name, lower(p.display_name) as sort_name
      from private.discovery_preferences d join public.profiles p on p.user_id = d.user_id
      where d.listed and p.user_id <> uid and char_length(btrim(p.display_name)) > 0
        and strpos(lower(p.display_name), lower(btrim(p_query))) > 0
        and not private.blocked_either(uid, p.user_id)
        and not exists (select 1 from public.friendships f where (f.requester = uid and f.addressee = p.user_id) or (f.requester = p.user_id and f.addressee = uid))
      order by lower(p.display_name), p.user_id limit 21 offset p_offset
    ) item;
  return jsonb_build_object('players', result, 'offset', p_offset);
end $$;

-- Passing two nulls removes a shared area; mixed or out-of-grid values fail.
create or replace function public.discovery_location_set(p_lat_band int, p_lon_band int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user(); n int;
begin
  if p_lat_band is null and p_lon_band is null then
    perform pg_advisory_xact_lock(hashtextextended('discovery-rate:' || uid::text || ':setting', 0));
    delete from private.discovery_areas where user_id = uid;
    return jsonb_build_object('nearby', false);
  end if;
  perform private.discovery_rate(uid, 'setting');
  if p_lat_band is null or p_lon_band is null or p_lat_band < 0 or p_lat_band > 179 then perform private.refuse('bad_discovery'); end if;
  n := greatest(1, floor(360 * cos(radians(p_lat_band - 89.5)))::int);
  if p_lon_band < 0 or p_lon_band >= n then perform private.refuse('bad_discovery'); end if;
  perform 1 from private.discovery_preferences where user_id = uid and listed for update;
  if not found then perform private.refuse('listing_required'); end if;
  if exists (select 1 from private.discovery_areas where user_id = uid and latitude_band = p_lat_band and longitude_band = p_lon_band) then
    return jsonb_build_object('nearby', true);
  end if;
  if exists (select 1 from private.discovery_area_changes where user_id = uid and last_shared_at > now() - interval '24 hours') then
    perform private.refuse('location_cooldown');
  end if;
  insert into private.discovery_areas(user_id, latitude_band, longitude_band) values (uid,p_lat_band,p_lon_band)
    on conflict (user_id) do update set latitude_band=excluded.latitude_band, longitude_band=excluded.longitude_band;
  insert into private.discovery_area_changes(user_id, last_shared_at) values (uid, now())
    on conflict (user_id) do update set last_shared_at=excluded.last_shared_at;
  return jsonb_build_object('nearby', true);
end $$;

create or replace function public.discovery_nearby(p_offset int default 0) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user(); result jsonb;
begin
  if p_offset is null or p_offset < 0 or p_offset > 1000 then perform private.refuse('bad_discovery'); end if;
  perform private.discovery_rate(uid, 'search');
  if not exists (select 1 from private.discovery_areas a join private.discovery_preferences d using(user_id) where a.user_id=uid and d.listed) then perform private.refuse('location_required'); end if;
  with cells as (
    select a.user_id, radians(a.latitude_band - 89.5) lat,
      radians(-180 + (a.longitude_band + 0.5) * 360.0 / greatest(1, floor(360 * cos(radians(a.latitude_band - 89.5)))::int)) lon
    from private.discovery_areas a join private.discovery_preferences d using(user_id) where d.listed
  ), distances as (
    select p.user_id, p.display_name,
      6371 * acos(least(1.0, greatest(-1.0, sin(me.lat)*sin(other.lat) + cos(me.lat)*cos(other.lat)*cos(me.lon-other.lon)))) km
    from cells me join cells other on other.user_id <> me.user_id join public.profiles p on p.user_id=other.user_id
    where me.user_id=uid and char_length(btrim(p.display_name)) > 0 and not private.blocked_either(uid, p.user_id)
      and not exists (select 1 from public.friendships f where (f.requester=uid and f.addressee=p.user_id) or (f.requester=p.user_id and f.addressee=uid))
  ), banded as (
    select user_id, display_name, case when km < 120 then 'local' else 'regional' end distance_band
    from distances where km < 250
  )
  select coalesce(jsonb_agg(jsonb_build_object('user_id', item.user_id, 'display_name', item.display_name,
    'distance_band', item.distance_band) order by item.distance_band, lower(item.display_name), item.user_id), '[]'::jsonb)
    into result from (select * from banded order by distance_band, lower(display_name), user_id limit 21 offset p_offset) item;
  return jsonb_build_object('players',result,'offset',p_offset);
end $$;
revoke all on function public.discovery_location_set(int,int), public.discovery_nearby(int) from public, anon, authenticated;
grant execute on function public.discovery_location_set(int,int), public.discovery_nearby(int) to authenticated;

-- Serialize requests and blocks for the same pair until each transaction ends.
-- Canonical ordering makes the lock identical from either player's side.
create or replace function private.friend_pair_lock(p_first uuid, p_second uuid) returns void
language plpgsql set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'friend-pair:' || least(p_first, p_second)::text || ':' || greatest(p_first, p_second)::text, 0));
end $$;
revoke all on function private.friend_pair_lock(uuid, uuid) from public, anon, authenticated;

-- Keep established request and cleanup behavior, with the lock acquired before
-- checking blocks or changing the pair's friendship.
create or replace function public.add_friend(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  other uuid;
  f public.friendships%rowtype;
  refused text;
begin
  if (select count(*) from private.friend_attempts where user_id = uid and at > now() - interval '1 hour') >= 20 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  insert into private.friend_attempts (user_id) values (uid);
  perform public.ensure_profile('');
  if code ~ '^[A-HJKMNP-Z2-9]{8}$' then
    select user_id into other from public.profiles where friend_code = code;
  end if;
  if other is not null and other <> uid then perform private.friend_pair_lock(uid, other); end if;
  refused := case
    when other is null then 'not_found'
    when other = uid then 'self'
    when exists (select 1 from public.blocks where blocker = uid and blocked = other) then 'blocked'
    when exists (select 1 from public.blocks where blocker = other and blocked = uid) then 'not_found'
  end;
  if refused is not null then
    return jsonb_build_object('ok', false, 'error', refused);
  end if;
  for attempt in 1..2 loop
    select * into f from public.friendships
     where (requester = uid and addressee = other) or (requester = other and addressee = uid)
     for update;
    if found then
      if f.status = 'accepted' then return jsonb_build_object('ok', false, 'error', 'already_friends'); end if;
      if f.requester = uid then return jsonb_build_object('ok', false, 'error', 'already_asked'); end if;
      -- They asked first: asking back is saying yes.
      update public.friendships set status = 'accepted' where requester = other and addressee = uid;
      return (select jsonb_build_object('ok', true, 'status', 'accepted', 'user_id', other,
        'friend_code', p.friend_code, 'display_name', p.display_name) from public.profiles p where p.user_id = other);
    end if;
    insert into public.friendships (requester, addressee) values (uid, other) on conflict do nothing;
    if found then
      return jsonb_build_object('ok', true, 'status', 'pending', 'user_id', other, 'friend_code', code, 'display_name', '');
    end if;
    -- The other side asked at the same moment. Look again and accept theirs.
  end loop;
  return jsonb_build_object('ok', false, 'error', 'already_asked');
end;
$$;

create or replace function public.block_user(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
begin
  if p_user is null or p_user = uid then perform private.refuse('self'); end if;
  if not exists (select 1 from auth.users where id = p_user) then perform private.refuse('not_found'); end if;
  perform private.friend_pair_lock(uid, p_user);
  insert into public.blocks (blocker, blocked) values (uid, p_user) on conflict do nothing;
  delete from public.friendships
   where (requester = uid and addressee = p_user) or (requester = p_user and addressee = uid);
  delete from public.summons
   where (from_user = uid and to_user = p_user) or (from_user = p_user and to_user = uid);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.discovery_request(p_user uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user(); code text; answer jsonb;
begin
  if p_user is null or p_user = uid then perform private.refuse('bad_discovery'); end if;
  perform private.discovery_rate(uid, 'request');
  perform public.ensure_profile('');
  perform private.friend_pair_lock(uid, p_user);
  -- Lock the listing so a simultaneous opt-out takes effect before a later request.
  perform 1 from private.discovery_preferences where user_id = p_user and listed for update;
  if not found or private.blocked_either(uid, p_user) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  select friend_code into code from public.profiles where user_id = p_user and char_length(btrim(display_name)) > 0;
  if code is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  answer := public.add_friend(code);
  if (answer->>'ok')::boolean and answer->>'status' = 'pending' then
    insert into private.discovery_requests(requester, addressee) values (uid, p_user) on conflict do nothing;
  end if;
  return jsonb_build_object('ok', coalesce((answer->>'ok')::boolean, false), 'status', answer->>'status', 'error', answer->>'error');
end $$;

-- Preserve ordinary code-based requests while keeping both codes private for
-- a directory-origin request until the recipient accepts it.
create or replace function public.list_friends() returns jsonb
language sql stable security definer set search_path = '' as $$
  with me as (select private.require_user() as uid), pairs as (
    select case when f.requester = me.uid then f.addressee else f.requester end as other, f.status, f.created_at,
      case when f.requester = me.uid then 'outgoing' else 'incoming' end as direction,
      exists (select 1 from private.discovery_requests d where d.requester = f.requester and d.addressee = f.addressee) as directory_request
    from public.friendships f, me where me.uid in (f.requester, f.addressee)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', r.other,
    'display_name', case when r.status = 'accepted' or r.direction = 'incoming' or r.directory_request then coalesce(p.display_name, '') else '' end,
    'friend_code', case when r.status = 'pending' and r.directory_request then '' else coalesce(p.friend_code, '') end,
    'status', r.status, 'direction', r.direction,
    'shelf_updated_at', case when r.status = 'accepted' then s.updated_at end
  ) || case when r.directory_request then jsonb_build_object('directory_request', true) else '{}'::jsonb end
    order by r.status desc, lower(coalesce(p.display_name, '')), r.created_at), '[]'::jsonb)
  from pairs r left join public.profiles p on p.user_id = r.other left join public.shelves s on s.user_id = r.other;
$$;

revoke all on function private.discovery_rate(uuid, text) from public, anon, authenticated;
revoke all on function public.discovery_status(), public.discovery_set(boolean), public.discovery_find(text, int), public.discovery_request(uuid), public.list_friends() from public, anon, authenticated;
grant execute on function public.discovery_status(), public.discovery_set(boolean), public.discovery_find(text, int), public.discovery_request(uuid) to authenticated;
grant execute on function public.list_friends() to authenticated;

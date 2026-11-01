-- The neighbourhood paper. Reads are limited to the current circle and all
-- mutations are RPCs; no player receives direct access to these tables.
create table if not exists public.gazette_events (
  id uuid primary key default gen_random_uuid(),
  actor uuid not null references auth.users(id) on delete cascade,
  event_key uuid not null,
  kind text not null check (kind in ('adopted','coffin','verdict','arcade_best','collection','almanac','bond')),
  data jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 512),
  created_at timestamptz not null default now(),
  unique (actor, event_key)
);
create index if not exists gazette_events_recent on public.gazette_events (created_at desc, id desc);
create index if not exists gazette_events_actor on public.gazette_events (actor, created_at desc);
create table if not exists public.gazette_reactions (
  event_id uuid not null references public.gazette_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sticker text not null check (sticker in ('candle','skull','lily','popcorn','rude','moth')),
  primary key (event_id, user_id)
);
create table if not exists private.gazette_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sharing boolean not null default true,
  generation integer not null default 0,
  seen_at timestamptz not null default now()
);
alter table private.gazette_preferences add column if not exists generation integer not null default 0;
create table if not exists private.gazette_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  at timestamptz not null default now()
);
create index if not exists gazette_requests_recent on private.gazette_requests(user_id, at);
alter table public.gazette_events enable row level security;
alter table public.gazette_reactions enable row level security;
alter table private.gazette_preferences enable row level security;
alter table private.gazette_requests enable row level security;
revoke all on public.gazette_events, public.gazette_reactions from public, anon, authenticated;
revoke all on private.gazette_preferences, private.gazette_requests from public, anon, authenticated;

create or replace function private.gazette_can_see(viewer uuid, owner uuid)
returns boolean language sql stable set search_path = public as $$
  select (viewer = owner or private.are_friends(viewer, owner))
    and not exists (select 1 from public.blocks b where (b.blocker = viewer and b.blocked = owner) or (b.blocker = owner and b.blocked = viewer));
$$;
create or replace function private.gazette_event_visible(viewer uuid, owner uuid)
returns boolean language sql stable set search_path = public as $$
  select private.gazette_can_see(viewer, owner) and
    (viewer = owner or coalesce((select sharing from private.gazette_preferences where user_id = owner),true));
$$;
create or replace function private.gazette_tidy()
returns void language sql set search_path = public as $$
  delete from public.gazette_events where created_at < now() - interval '30 days';
$$;
create or replace function private.gazette_rate(uid uuid)
returns void language plpgsql set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('gazette-rate:' || uid::text, 0));
  delete from private.gazette_requests where at < now() - interval '1 hour';
  if (select count(*) from private.gazette_requests where user_id=uid) >= 300 then perform private.refuse('rate_limited'); end if;
  insert into private.gazette_requests(user_id) values(uid);
end;
$$;
create or replace function private.gazette_valid(p_kind text, d jsonb)
returns boolean language plpgsql immutable set search_path = public as $$
declare n int;
begin
  if jsonb_typeof(d) <> 'object' or octet_length(d::text) > 512 then return false; end if;
  if p_kind in ('adopted', 'bond') then
    if not (d ? 'resident') or jsonb_typeof(d->'resident') <> 'string' or d->>'resident' !~ '^[A-Za-z0-9_-]{1,100}$' then return false; end if;
    if p_kind = 'adopted' then return d - 'resident' = '{}'::jsonb; end if;
    if d - 'resident' - 'level' <> '{}'::jsonb or jsonb_typeof(d->'level') <> 'number' or d->>'level' !~ '^(5|10|15|20|25)$' then return false; end if;
    return true;
  elsif p_kind in ('coffin', 'verdict', 'collection') then
    return d - 'item' = '{}'::jsonb and jsonb_typeof(d->'item') = 'string' and d->>'item' ~ '^[a-z0-9_-]{1,40}$';
  elsif p_kind = 'almanac' then
    return d - 'tier' = '{}'::jsonb and jsonb_typeof(d->'tier') = 'number' and d->>'tier' ~ '^([1-9]|[12][0-9]|30)$';
  elsif p_kind = 'arcade_best' then
    if d - 'game' - 'score' <> '{}'::jsonb or jsonb_typeof(d->'game') <> 'string' or jsonb_typeof(d->'score') <> 'number' or d->>'score' !~ '^[1-9][0-9]{0,3}$' then return false; end if;
    n := (d->>'score')::int;
    return private.score_cap(d->>'game') is not null and n <= private.score_cap(d->>'game');
  end if;
  return false;
end;
$$;
create or replace function public.gazette_post(p_events jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := private.require_user(); e jsonb; k uuid; n int := 0; allowed boolean; share_generation integer;
begin
  perform private.gazette_rate(uid);
  if jsonb_typeof(p_events) is distinct from 'array' then perform private.refuse('bad_events'); end if;
  if jsonb_array_length(p_events) > 10 or octet_length(p_events::text) > 8192 then perform private.refuse('bad_events'); end if;
  perform pg_advisory_xact_lock(hashtextextended('gazette:' || uid::text, 0));
  perform private.gazette_tidy();
  select coalesce((select sharing from private.gazette_preferences where user_id = uid), true),
    coalesce((select generation from private.gazette_preferences where user_id = uid), 0) into allowed, share_generation;
  if not allowed then return jsonb_build_object('posted', 0, 'sharing', false, 'generation', share_generation, 'stale', true); end if;
  for e in select value from jsonb_array_elements(p_events) loop
    if jsonb_typeof(e) is distinct from 'object' or e - 'key' - 'kind' - 'data' - 'generation' <> '{}'::jsonb or jsonb_typeof(e->'key') is distinct from 'string'
      or e->>'key' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or jsonb_typeof(e->'generation') is distinct from 'number' or e->>'generation' !~ '^(0|[1-9][0-9]{0,9})$'
      or not coalesce(private.gazette_valid(e->>'kind', e->'data'), false) then perform private.refuse('bad_events'); end if;
    if (e->>'generation')::bigint > 2147483647 then perform private.refuse('bad_events'); end if;
    if (e->>'generation')::bigint <> share_generation then
      return jsonb_build_object('posted', 0, 'sharing', true, 'generation', share_generation, 'stale', true);
    end if;
  end loop;
  for e in select value from jsonb_array_elements(p_events) loop
    k := (e->>'key')::uuid;
    if not exists (select 1 from public.gazette_events where actor = uid and event_key = k) then
      if (select count(*) from public.gazette_events where actor = uid and created_at > now() - interval '1 hour') >= 100 then perform private.refuse('rate_limited'); end if;
      insert into public.gazette_events(actor,event_key,kind,data) values (uid,k,e->>'kind',e->'data') on conflict (actor,event_key) do nothing;
      n := n + 1;
    end if;
  end loop;
  return jsonb_build_object('posted', n, 'sharing', true, 'generation', share_generation, 'stale', false);
end;
$$;
create or replace function public.gazette_feed(p_before uuid default null, p_limit int default 20)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := private.require_user(); result jsonb; cursor_at timestamptz;
begin
  if p_limit is null or p_limit < 1 or p_limit > 50 then perform private.refuse('bad_limit'); end if;
  perform private.gazette_tidy();
  if p_before is not null then
    select created_at into cursor_at from public.gazette_events where id = p_before and private.gazette_event_visible(uid,actor);
    if cursor_at is null then perform private.refuse('not_found'); end if;
  end if;
  select coalesce(jsonb_agg(row_data order by created_at desc, id desc), '[]'::jsonb) into result from (
    select e.id, e.created_at, jsonb_build_object('id',e.id,'actor',e.actor,'name',coalesce(p.display_name,''),
      'kind',e.kind,'data',e.data,'created_at',e.created_at,
      'counts',coalesce((select jsonb_object_agg(sticker,n) from (select sticker,count(*)::int n from public.gazette_reactions r where r.event_id=e.id and private.gazette_can_see(uid,r.user_id) group by sticker) x),'{}'::jsonb),
      'my_reaction',(select sticker from public.gazette_reactions r where r.event_id=e.id and r.user_id=uid)) row_data
    from public.gazette_events e left join public.profiles p on p.user_id=e.actor
    where e.created_at >= now() - interval '30 days' and private.gazette_event_visible(uid,e.actor)
      and (p_before is null or (e.created_at,e.id) < (cursor_at,p_before))
    order by e.created_at desc,e.id desc limit p_limit
  ) rows;
  return jsonb_build_object('events',result,'sharing',coalesce((select sharing from private.gazette_preferences where user_id=uid),true),
    'generation',coalesce((select generation from private.gazette_preferences where user_id=uid),0));
end;
$$;
create or replace function public.gazette_react(p_event uuid, p_sticker text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := private.require_user(); owner uuid;
begin
  perform private.gazette_rate(uid);
  if p_sticker is not null and p_sticker not in ('candle','skull','lily','popcorn','rude','moth') then perform private.refuse('bad_sticker'); end if;
  select actor into owner from public.gazette_events where id=p_event and created_at >= now() - interval '30 days';
  if owner is null or not private.gazette_event_visible(uid,owner) then perform private.refuse('not_found'); end if;
  if p_sticker is null then delete from public.gazette_reactions where event_id=p_event and user_id=uid;
  else insert into public.gazette_reactions(event_id,user_id,sticker) values(p_event,uid,p_sticker)
    on conflict(event_id,user_id) do update set sticker=excluded.sticker; end if;
  return jsonb_build_object('ok',true);
end;
$$;
create or replace function public.gazette_unread()
returns integer language plpgsql security definer set search_path = public as $$
declare uid uuid := private.require_user(); n integer;
begin
  select count(*)::int into n from public.gazette_events e where e.actor <> uid and e.created_at >= now() - interval '30 days'
    and e.created_at > coalesce((select seen_at from private.gazette_preferences where user_id=uid),'-infinity'::timestamptz)
    and private.gazette_event_visible(uid,e.actor);
  return n;
end;
$$;
create or replace function public.gazette_seen()
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := private.require_user();
begin
  perform private.gazette_rate(uid);
  insert into private.gazette_preferences(user_id,seen_at) values(uid,now()) on conflict(user_id) do update set seen_at=excluded.seen_at;
  return jsonb_build_object('ok',true);
end;
$$;
create or replace function public.gazette_status()
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := private.require_user();
begin
  return jsonb_build_object('sharing',coalesce((select sharing from private.gazette_preferences where user_id=uid),true),
    'generation',coalesce((select generation from private.gazette_preferences where user_id=uid),0));
end;
$$;
create or replace function public.gazette_set_sharing(p_on boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := private.require_user(); new_generation integer;
begin
  perform private.gazette_rate(uid);
  if p_on is null then perform private.refuse('bad_sharing'); end if;
  perform pg_advisory_xact_lock(hashtextextended('gazette:' || uid::text, 0));
  insert into private.gazette_preferences as p(user_id,sharing,generation) values(uid,p_on,case when p_on then 0 else 1 end)
    on conflict(user_id) do update set sharing=excluded.sharing,
      generation=case when p.sharing is distinct from excluded.sharing then p.generation + 1 else p.generation end
    returning generation into new_generation;
  return jsonb_build_object('sharing',p_on,'generation',new_generation);
end;
$$;
revoke all on function private.gazette_can_see(uuid,uuid), private.gazette_event_visible(uuid,uuid), private.gazette_tidy(), private.gazette_valid(text,jsonb), private.gazette_rate(uuid) from public, anon, authenticated;
revoke all on function public.gazette_post(jsonb), public.gazette_feed(uuid,int), public.gazette_react(uuid,text), public.gazette_unread(), public.gazette_seen(), public.gazette_status(), public.gazette_set_sharing(boolean) from public, anon, authenticated;
grant execute on function public.gazette_post(jsonb), public.gazette_feed(uuid,int), public.gazette_react(uuid,text), public.gazette_unread(), public.gazette_seen(), public.gazette_status(), public.gazette_set_sharing(boolean) to authenticated;

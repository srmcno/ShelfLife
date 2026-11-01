-- Opt-in Web Push. Tables are private to the functions below, including for
-- authenticated callers; no subscription endpoint is visible to other users.
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null,
  auth_secret text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user on public.push_subscriptions(user_id);
create table if not exists public.push_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  friends boolean not null default true,
  court boolean not null default true,
  gifts boolean not null default true,
  games boolean not null default true,
  covens boolean not null default true,
  kin boolean not null default true,
  changes int not null default 0,
  change_day date not null default current_date
);
create table if not exists private.push_queue (
  id bigint generated always as identity primary key,
  recipient uuid not null references auth.users(id) on delete cascade,
  actor uuid not null references auth.users(id) on delete cascade,
  event_group text not null check (event_group in ('friends','court','gifts','games','covens','kin')),
  created_at timestamptz not null default now(),
  lease uuid,
  leased_at timestamptz,
  available_at timestamptz not null default now()
);
alter table private.push_queue add column if not exists available_at timestamptz not null default now();
create index if not exists push_queue_recipient on private.push_queue(recipient, created_at);
create table if not exists private.push_deliveries (
  queue_id bigint not null references private.push_queue(id) on delete cascade,
  endpoint text not null references public.push_subscriptions(endpoint) on delete cascade,
  primary key(queue_id, endpoint)
);
create table if not exists private.push_config (key text primary key, value text not null);
alter table public.push_subscriptions enable row level security;
alter table public.push_preferences enable row level security;
revoke all on public.push_subscriptions, public.push_preferences from public, anon, authenticated;
revoke all on private.push_queue, private.push_deliveries, private.push_config from public, anon, authenticated;

create or replace function private.push_endpoint_ok(p text) returns boolean language sql immutable set search_path = '' as $$
  select p is not null and length(p) between 20 and 2048 and p ~ '^https://(fcm[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|web[.]push[.]apple[.]com|([a-z0-9-]+[.])+push[.]apple[.]com|([a-z0-9-]+[.])+notify[.]windows[.]com)/[^[:space:]#]*$';
$$;

create or replace function private.push_rate(p_user uuid) returns void language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  insert into public.push_preferences(user_id) values (p_user) on conflict do nothing;
  update public.push_preferences set changes = case when change_day = current_date then changes + 1 else 1 end, change_day = current_date
    where user_id = p_user returning changes into n;
  if n > 100 then perform private.refuse('rate_limited'); end if;
end $$;

create or replace function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text) returns boolean language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user(); owner_id uuid;
begin
  if not private.push_endpoint_ok(p_endpoint) or p_p256dh is null or p_p256dh !~ '^[A-Za-z0-9_-]{87}$' or p_auth is null or p_auth !~ '^[A-Za-z0-9_-]{22}$' then perform private.refuse('bad_subscription'); end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 12012));
  perform private.push_rate(uid);
  select user_id into owner_id from public.push_subscriptions where endpoint = p_endpoint;
  if owner_id is not null and owner_id <> uid then perform private.refuse('subscription_in_use'); end if;
  if owner_id is null and (select count(*) from public.push_subscriptions where user_id = uid) >= 5 then perform private.refuse('too_many_subscriptions'); end if;
  insert into public.push_subscriptions(endpoint, user_id, p256dh, auth_secret) values (p_endpoint, uid, p_p256dh, p_auth)
    on conflict (endpoint) do update set p256dh = excluded.p256dh, auth_secret = excluded.auth_secret, updated_at = now()
    where public.push_subscriptions.user_id = uid;
  if not found then perform private.refuse('subscription_in_use'); end if;
  return true;
end $$;

create or replace function public.push_unsubscribe(p_endpoint text) returns boolean language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user();
begin
  if not private.push_endpoint_ok(p_endpoint) then perform private.refuse('bad_subscription'); end if;
  perform private.push_rate(uid);
  delete from public.push_subscriptions where user_id = uid and endpoint = p_endpoint;
  return true;
end $$;

create or replace function public.push_settings() returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user(); p public.push_preferences%rowtype;
begin
  select * into p from public.push_preferences where user_id = uid;
  return jsonb_build_object('friends',coalesce(p.friends,true),'court',coalesce(p.court,true),'gifts',coalesce(p.gifts,true),
    'games',coalesce(p.games,true),'covens',coalesce(p.covens,true),'kin',coalesce(p.kin,true));
end $$;

create or replace function public.push_set(p_group text, p_on boolean) returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user();
begin
  if p_group is null or p_group not in ('friends','court','gifts','games','covens','kin') or p_on is null then perform private.refuse('bad_push_setting'); end if;
  perform private.push_rate(uid);
  update public.push_preferences set friends = case when p_group='friends' then p_on else friends end,
    court = case when p_group='court' then p_on else court end, gifts = case when p_group='gifts' then p_on else gifts end,
    games = case when p_group='games' then p_on else games end, covens = case when p_group='covens' then p_on else covens end,
    kin = case when p_group='kin' then p_on else kin end where user_id=uid;
  return public.push_settings();
end $$;

-- A wakeup is deliberately best-effort. It never changes the source action.
create or replace function private.push_kick() returns boolean language plpgsql security definer set search_path = '' as $$
declare cfg_url text; cfg_secret text;
begin
  if not exists (select 1 from private.push_queue where available_at <= now() and (lease is null or leased_at < now() - interval '5 minutes')) then return false; end if;
  select value into cfg_url from private.push_config where key='url';
  select value into cfg_secret from private.push_config where key='secret';
  if cfg_url is null or cfg_secret is null or to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then return false; end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 60000)' using cfg_url, '{}'::jsonb,
    jsonb_build_object('Content-Type','application/json','x-push-secret',cfg_secret);
  return true;
exception when others then
  raise warning 'push wake failed: %', sqlstate;
  return false;
end $$;

-- One trigger handles all the source tables. A notification failure must not
-- roll back the player's actual action.
create or replace function private.push_enqueue() returns trigger language plpgsql security definer set search_path = '' as $$
declare a uuid; b uuid; g text; row_data jsonb := to_jsonb(new);
begin
  if tg_table_name = 'friendships' then
    if tg_op = 'UPDATE' then
      if old.status <> 'pending' or new.status <> 'accepted' then return new; end if;
      a := new.addressee; b := new.requester;
    else a := new.requester; b := new.addressee; end if;
    g := 'friends';
  elsif tg_table_name = 'coop_duels' then a := new.challenger; b := new.opponent; g := 'games';
  else
    a := (row_data->>'from_user')::uuid; b := (row_data->>'to_user')::uuid;
    g := case when tg_table_name in ('summons','hearings') then 'court' when tg_table_name in ('visits','gifts','trades') then 'gifts' when tg_table_name = 'coven_invites' then 'covens' else 'kin' end;
  end if;
  if a is null or b is null or a = b or private.blocked_either(a,b) or private.dnd_on(b) then return new; end if;
  if not exists (select 1 from public.push_subscriptions where user_id=b) then return new; end if;
  if not coalesce((select case g when 'friends' then friends when 'court' then court when 'gifts' then gifts when 'games' then games when 'covens' then covens else kin end from public.push_preferences where user_id=b), true) then return new; end if;
  delete from private.push_queue where created_at < now() - interval '30 days';
  insert into private.push_queue(recipient, actor, event_group) values (b,a,g);
  perform private.push_kick();
  return new;
exception when others then
  raise warning 'push enqueue failed: %', sqlstate;
  return new;
end $$;

do $$ declare t text; begin
  foreach t in array array['friendships','summons','hearings','trades','visits','gifts','coop_duels','coven_invites','kin_baskets','kin_letters'] loop
    execute format('drop trigger if exists push_enqueue on public.%I', t);
    execute format('create trigger push_enqueue after insert on public.%I for each row execute function private.push_enqueue()', t);
  end loop;
end $$;
drop trigger if exists push_friend_accept on public.friendships;
create trigger push_friend_accept after update of status on public.friendships for each row execute function private.push_enqueue();

-- Claim a small batch with an expiring lease so concurrent invocations do not
-- send the same queue rows. Filtering is repeated at delivery time.
create or replace function private.push_take() returns jsonb language plpgsql security definer set search_path = '' as $$
declare token uuid := gen_random_uuid(); result jsonb;
begin
  delete from private.push_queue q where q.created_at < now() - interval '30 days' or private.blocked_either(q.actor,q.recipient)
    or private.dnd_on(q.recipient) or not exists (select 1 from public.push_subscriptions s where s.user_id=q.recipient)
    or not coalesce((select case q.event_group when 'friends' then p.friends when 'court' then p.court when 'gifts' then p.gifts when 'games' then p.games when 'covens' then p.covens else p.kin end from public.push_preferences p where p.user_id=q.recipient), true);
  with selected as (select id from private.push_queue where available_at <= now() and (lease is null or leased_at < now() - interval '5 minutes') order by created_at limit 4 for update skip locked)
    update private.push_queue q set lease=token, leased_at=now() from selected where q.id=selected.id;
  select coalesce(jsonb_agg(jsonb_build_object('user_id',u.recipient,'lease',token,'count',u.n,
    'subscriptions',(select coalesce(jsonb_agg(jsonb_build_object('endpoint',s.endpoint,'p256dh',s.p256dh,'auth',s.auth_secret,
      'count',(select count(*) from private.push_queue q where q.lease=token and q.recipient=u.recipient and not exists
        (select 1 from private.push_deliveries d where d.queue_id=q.id and d.endpoint=s.endpoint)))),'[]'::jsonb)
      from public.push_subscriptions s where s.user_id=u.recipient and exists
        (select 1 from private.push_queue q where q.lease=token and q.recipient=u.recipient and not exists
          (select 1 from private.push_deliveries d where d.queue_id=q.id and d.endpoint=s.endpoint))))), '[]'::jsonb)
    into result from (select recipient,count(*) n from private.push_queue where lease=token group by recipient) u;
  return result;
end $$;
create or replace function private.push_result(p_lease uuid, p_user uuid, p_ok boolean, p_dead text[], p_sent text[]) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_lease is null or p_user is null or p_ok is null or coalesce(array_length(p_dead,1),0) > 5 or coalesce(array_length(p_sent,1),0) > 5 then raise exception 'invalid push result'; end if;
  insert into private.push_deliveries(queue_id, endpoint)
    select q.id, s.endpoint from private.push_queue q join public.push_subscriptions s on s.user_id=q.recipient
    where q.recipient=p_user and q.lease=p_lease and s.endpoint = any(coalesce(p_sent,array[]::text[])) on conflict do nothing;
  delete from public.push_subscriptions where user_id=p_user and endpoint = any(coalesce(p_dead,array[]::text[]));
  if p_ok then delete from private.push_queue where recipient=p_user and lease=p_lease;
  else update private.push_queue set lease=null, leased_at=null, available_at=now() + interval '5 minutes' where recipient=p_user and lease=p_lease; end if;
  return true;
end $$;
-- PostgREST exposes public only. These wrappers remain service-role-only.
create or replace function public.push_wake() returns boolean language sql security definer set search_path = '' as $$ select private.push_kick() $$;
create or replace function public.push_take() returns jsonb language sql security definer set search_path = '' as $$ select private.push_take() $$;
create or replace function public.push_result(p_lease uuid, p_user uuid, p_ok boolean, p_dead text[], p_sent text[]) returns boolean language sql security definer set search_path = '' as $$ select private.push_result(p_lease,p_user,p_ok,p_dead,p_sent) $$;

revoke all on function private.push_endpoint_ok(text), private.push_rate(uuid), private.push_kick(), private.push_enqueue(), private.push_take(), private.push_result(uuid,uuid,boolean,text[],text[]) from public, anon, authenticated;
revoke all on function public.push_subscribe(text,text,text), public.push_unsubscribe(text), public.push_settings(), public.push_set(text,boolean), public.push_wake(), public.push_take(), public.push_result(uuid,uuid,boolean,text[],text[]) from public, anon, authenticated;
grant execute on function public.push_subscribe(text,text,text), public.push_unsubscribe(text), public.push_settings(), public.push_set(text,boolean) to authenticated;
grant usage on schema private to service_role;
grant execute on function private.push_kick(), private.push_take(), private.push_result(uuid,uuid,boolean,text[],text[]), public.push_wake(), public.push_take(), public.push_result(uuid,uuid,boolean,text[],text[]) to service_role;

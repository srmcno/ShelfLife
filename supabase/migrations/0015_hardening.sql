-- Shelf Life: hardening after the 1.2.0 review. Safe to run more than once.
--   * The Gazette reads only the caller's own circle instead of testing every
--     event in the paper, and reading it is rate limited.
--   * Find players needs an email account. Free guest accounts could
--     otherwise be minted to map who shares which area, or to flood listed
--     players with requests. Withdrawing a listing or an area stays open.
--   * A listed player holds at most 50 pending requests.
--   * A push that keeps failing is dropped after five tries, with a growing wait.
--   * The private push tables get row level security like every other table.

-- ---------------------------------------------------------------------------
-- Gazette
-- ---------------------------------------------------------------------------

create index if not exists gazette_requests_at on private.gazette_requests (at);

-- The caller and their accepted friends: the only people whose news can show.
create or replace function private.gazette_circle(viewer uuid)
returns setof uuid language sql stable set search_path = public as $$
  select viewer
  union
  select case when f.requester = viewer then f.addressee else f.requester end
    from public.friendships f
   where f.status = 'accepted' and viewer in (f.requester, f.addressee);
$$;
revoke all on function private.gazette_circle(uuid) from public, anon, authenticated;

create or replace function public.gazette_feed(p_before uuid default null, p_limit int default 20)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := private.require_user(); result jsonb; cursor_at timestamptz;
begin
  if p_limit is null or p_limit < 1 or p_limit > 50 then perform private.refuse('bad_limit'); end if;
  perform private.gazette_rate(uid);
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
    where e.actor in (select private.gazette_circle(uid))
      and e.created_at >= now() - interval '30 days' and private.gazette_event_visible(uid,e.actor)
      and (p_before is null or (e.created_at,e.id) < (cursor_at,p_before))
    order by e.created_at desc,e.id desc limit p_limit
  ) rows;
  return jsonb_build_object('events',result,'sharing',coalesce((select sharing from private.gazette_preferences where user_id=uid),true),
    'generation',coalesce((select generation from private.gazette_preferences where user_id=uid),0));
end;
$$;

create or replace function public.gazette_unread()
returns integer language plpgsql security definer set search_path = public as $$
declare uid uuid := private.require_user(); n integer;
begin
  select count(*)::int into n from public.gazette_events e
   where e.actor <> uid and e.actor in (select private.gazette_circle(uid))
     and e.created_at >= now() - interval '30 days'
     and e.created_at > coalesce((select seen_at from private.gazette_preferences where user_id=uid),'-infinity'::timestamptz)
     and private.gazette_event_visible(uid,e.actor);
  return n;
end;
$$;

revoke all on function public.gazette_feed(uuid, int) from public, anon, authenticated;
revoke all on function public.gazette_unread() from public, anon, authenticated;
grant execute on function public.gazette_feed(uuid, int) to authenticated;
grant execute on function public.gazette_unread() to authenticated;

-- ---------------------------------------------------------------------------
-- Find players
-- ---------------------------------------------------------------------------

create index if not exists discovery_areas_band on private.discovery_areas (latitude_band, longitude_band);

-- Every Find players action that reads or adds passes through this limiter,
-- so the account rule lives here. Withdrawals do not call it.
create or replace function private.discovery_rate(p_user uuid, p_kind text) returns void
language plpgsql security definer set search_path = '' as $$
declare maximum int;
begin
  if coalesce((select u.is_anonymous from auth.users u where u.id = p_user), true) then
    perform private.refuse('account_required');
  end if;
  maximum := case p_kind when 'search' then 120 when 'setting' then 30 when 'request' then 40 else 0 end;
  perform pg_advisory_xact_lock(hashtextextended('discovery-rate:' || p_user::text || ':' || p_kind, 0));
  delete from private.discovery_attempts where user_id = p_user and at < now() - interval '1 day';
  if maximum = 0 or (select count(*) from private.discovery_attempts where user_id = p_user and kind = p_kind and at > now() - interval '1 hour') >= maximum then
    perform private.refuse('rate_limited');
  end if;
  insert into private.discovery_attempts(user_id, kind) values (p_user, p_kind);
end $$;
revoke all on function private.discovery_rate(uuid, text) from public, anon, authenticated;

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
  -- A full doormat looks the same as an absent player; the listing lock above serialises the count.
  if (select count(*) from public.friendships where addressee = p_user and status = 'pending') >= 50 then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  select friend_code into code from public.profiles where user_id = p_user and char_length(btrim(display_name)) > 0;
  if code is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  answer := public.add_friend(code);
  if (answer->>'ok')::boolean and answer->>'status' = 'pending' then
    insert into private.discovery_requests(requester, addressee) values (uid, p_user) on conflict do nothing;
  end if;
  return jsonb_build_object('ok', coalesce((answer->>'ok')::boolean, false), 'status', answer->>'status', 'error', answer->>'error');
end $$;
revoke all on function public.discovery_request(uuid) from public, anon, authenticated;
grant execute on function public.discovery_request(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Push
-- ---------------------------------------------------------------------------

alter table private.push_queue enable row level security;
alter table private.push_deliveries enable row level security;
alter table private.push_config enable row level security;

alter table private.push_queue add column if not exists attempts smallint not null default 0;

-- A browser's key is a 65 byte uncompressed point: 87 base64url characters starting with B.
alter table public.push_subscriptions drop constraint if exists push_subscriptions_key_shape;
alter table public.push_subscriptions add constraint push_subscriptions_key_shape check (p256dh ~ '^B[A-Za-z0-9_-]{86}$') not valid;

create or replace function private.push_result(p_lease uuid, p_user uuid, p_ok boolean, p_dead text[], p_sent text[]) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_lease is null or p_user is null or p_ok is null or coalesce(array_length(p_dead,1),0) > 5 or coalesce(array_length(p_sent,1),0) > 5 then raise exception 'invalid push result'; end if;
  insert into private.push_deliveries(queue_id, endpoint)
    select q.id, s.endpoint from private.push_queue q join public.push_subscriptions s on s.user_id=q.recipient
    where q.recipient=p_user and q.lease=p_lease and s.endpoint = any(coalesce(p_sent,array[]::text[])) on conflict do nothing;
  delete from public.push_subscriptions where user_id=p_user and endpoint = any(coalesce(p_dead,array[]::text[]));
  if p_ok then delete from private.push_queue where recipient=p_user and lease=p_lease;
  else
    -- Five tries, waiting 5, 10, 20 and 40 minutes between them. Then it is let go.
    delete from private.push_queue where recipient=p_user and lease=p_lease and attempts >= 4;
    update private.push_queue set lease=null, leased_at=null, attempts=attempts+1,
      available_at=now() + interval '5 minutes' * power(2, attempts)
      where recipient=p_user and lease=p_lease;
  end if;
  return true;
end $$;
revoke all on function private.push_result(uuid, uuid, boolean, text[], text[]) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Parlour predictions: room for more questions (the game ships 36, up from 18)
-- ---------------------------------------------------------------------------

alter table public.parlour_rounds drop constraint if exists parlour_rounds_prompt_check;
alter table public.parlour_rounds add constraint parlour_rounds_prompt_check check (prompt between 0 and 63);

create or replace function public.parlour_send(p_id uuid, p_to uuid, p_prompt integer, p_choice integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user(); existing public.parlour_rounds%rowtype;
begin
  if p_id is null or p_to is null or p_prompt is null or p_prompt not between 0 and 63 or p_choice is null or p_choice not between 0 and 2 then perform private.refuse('bad_parlour'); end if;
  -- Keep the same lock order as other parlour writes without charging a retry.
  perform pg_advisory_xact_lock(hashtextextended('parlour-rate:' || uid::text, 0));
  perform private.parlour_friend(uid, p_to, false);
  perform pg_advisory_xact_lock(hashtextextended('parlour-send:' || uid::text, 0));
  select * into existing from public.parlour_rounds where id = p_id;
  if found then
    if existing.from_user <> uid or existing.to_user <> p_to or existing.prompt <> p_prompt or existing.first_choice <> p_choice then perform private.refuse('bad_parlour'); end if;
    return jsonb_build_object('id',existing.id,'sent',true);
  end if;
  perform private.parlour_rate(uid);
  perform private.require_friend(uid, p_to, true);
  if (select count(*) from public.parlour_rounds where from_user=uid and created_at > now()-interval '1 day') >= 12 then perform private.refuse('rate_limited'); end if;
  if exists (select 1 from public.parlour_rounds where from_user=uid and to_user=p_to and created_at > now()-interval '1 day') then perform private.refuse('parlour_wait'); end if;
  delete from public.parlour_rounds where created_at < now()-interval '30 days';
  insert into public.parlour_rounds(id,from_user,to_user,prompt,first_choice) values (p_id,uid,p_to,p_prompt,p_choice);
  return jsonb_build_object('id',p_id,'sent',true);
end $$;
revoke all on function public.parlour_send(uuid, uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.parlour_send(uuid, uuid, integer, integer) to authenticated;

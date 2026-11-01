-- A two-player prediction game. Choices stay sealed until the invited friend answers.
create table if not exists public.parlour_rounds (
  id uuid primary key,
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  prompt smallint not null check (prompt between 0 and 17),
  first_choice smallint not null check (first_choice between 0 and 2),
  second_choice smallint check (second_choice between 0 and 2),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  seen_at timestamptz,
  recipient_seen_at timestamptz,
  declined_at timestamptz,
  check (from_user <> to_user),
  check ((second_choice is null) = (answered_at is null)),
  check (declined_at is null or second_choice is null)
);
alter table public.parlour_rounds add column if not exists recipient_seen_at timestamptz;
alter table public.parlour_rounds add column if not exists declined_at timestamptz;
create index if not exists parlour_rounds_inbox on public.parlour_rounds(to_user, created_at);
create index if not exists parlour_rounds_sender on public.parlour_rounds(from_user, created_at);
create table if not exists private.parlour_answers (
  round_id uuid primary key references public.parlour_rounds(id) on delete cascade,
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists parlour_answers_from on private.parlour_answers(from_user);
create index if not exists parlour_answers_to on private.parlour_answers(to_user);
create table if not exists private.parlour_attempts (user_id uuid not null references auth.users(id) on delete cascade, at timestamptz not null default now());
create index if not exists parlour_attempts_recent on private.parlour_attempts(user_id, at);
alter table public.parlour_rounds enable row level security;
alter table private.parlour_answers enable row level security;
alter table private.parlour_attempts enable row level security;
revoke all on public.parlour_rounds, private.parlour_answers, private.parlour_attempts from public, anon, authenticated;

create or replace function private.parlour_rate(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('parlour-rate:' || p_user::text, 0));
  delete from private.parlour_attempts where user_id=p_user and at<now()-interval '1 day';
  if (select count(*) from private.parlour_attempts where user_id=p_user and at>now()-interval '1 hour') >= 100 then perform private.refuse('rate_limited'); end if;
  insert into private.parlour_attempts(user_id) values (p_user);
end $$;

create or replace function private.parlour_friend(p_user uuid, p_other uuid, p_dnd boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.friend_pair_lock(p_user,p_other);
  perform 1 from public.friendships where status='accepted' and
    ((requester=p_user and addressee=p_other) or (requester=p_other and addressee=p_user)) for key share;
  if not found then perform private.refuse('not_friends'); end if;
  perform private.require_friend(p_user,p_other,p_dnd);
end $$;

create or replace function private.parlour_unfriend() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.parlour_rounds where (from_user=old.requester and to_user=old.addressee) or (from_user=old.addressee and to_user=old.requester);
  return old;
end $$;
drop trigger if exists parlour_unfriend on public.friendships;
create trigger parlour_unfriend after delete on public.friendships for each row execute function private.parlour_unfriend();

create or replace function public.parlour_send(p_id uuid, p_to uuid, p_prompt integer, p_choice integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user(); existing public.parlour_rounds%rowtype;
begin
  if p_id is null or p_to is null or p_prompt is null or p_prompt not between 0 and 17 or p_choice is null or p_choice not between 0 and 2 then perform private.refuse('bad_parlour'); end if;
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

create or replace function public.parlour_reply(p_id uuid, p_choice integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user(); r public.parlour_rounds%rowtype;
begin
  if p_id is null or p_choice is null or p_choice not between 0 and 2 then perform private.refuse('bad_parlour'); end if;
  perform private.parlour_rate(uid);
  select * into r from public.parlour_rounds where id=p_id and to_user=uid;
  if not found or r.created_at < now()-interval '14 days' then perform private.refuse('not_found'); end if;
  perform private.parlour_friend(uid,r.from_user,true);
  select * into r from public.parlour_rounds where id=p_id and to_user=uid for update;
  if not found then perform private.refuse('not_found'); end if;
  if r.declined_at is not null then perform private.refuse('already_answered'); end if;
  if r.second_choice is not null and r.second_choice <> p_choice then perform private.refuse('already_answered'); end if;
  if r.second_choice is null then
    update public.parlour_rounds set second_choice=p_choice, answered_at=now() where id=p_id;
    insert into private.parlour_answers(round_id,from_user,to_user) values (p_id,uid,r.from_user) on conflict do nothing;
  end if;
  return jsonb_build_object('id',r.id,'prompt',r.prompt,'first',r.first_choice,'second',p_choice);
end $$;

create or replace function public.parlour_decline(p_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user(); r public.parlour_rounds%rowtype;
begin
  if p_id is null then perform private.refuse('bad_parlour'); end if;
  perform private.parlour_rate(uid);
  select * into r from public.parlour_rounds where id=p_id and to_user=uid;
  if not found or r.created_at < now()-interval '14 days' then perform private.refuse('not_found'); end if;
  perform private.parlour_friend(uid,r.from_user,false);
  select * into r from public.parlour_rounds where id=p_id and to_user=uid for update;
  if not found then perform private.refuse('not_found'); end if;
  if r.second_choice is not null then perform private.refuse('already_answered'); end if;
  if r.declined_at is null then
    update public.parlour_rounds set declined_at=now() where id=p_id;
    insert into private.parlour_answers(round_id,from_user,to_user) values (p_id,uid,r.from_user) on conflict do nothing;
  end if;
  return true;
end $$;

create or replace function public.parlour_inbox() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user(); result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'from_user',r.from_user,'to_user',r.to_user,'prompt',r.prompt,
    'first',case when r.second_choice is not null then r.first_choice else null end,'second',r.second_choice,
    'created_at',r.created_at,'answered_at',r.answered_at,'declined',r.declined_at is not null,'name',r.name) order by r.created_at desc),'[]'::jsonb)
    into result from (select q.*,coalesce(p.display_name,'') as name from public.parlour_rounds q
      left join public.profiles p on p.user_id=case when q.from_user=uid then q.to_user else q.from_user end
      where q.created_at>now()-interval '30 days' and ((q.to_user=uid and q.second_choice is null and q.declined_at is null and q.created_at>now()-interval '14 days') or
             (q.from_user=uid and (q.second_choice is not null or q.declined_at is not null) and q.seen_at is null) or
             (q.to_user=uid and q.second_choice is not null and q.recipient_seen_at is null))
        and private.are_friends(q.from_user,q.to_user) and not private.blocked_either(q.from_user,q.to_user)
      order by q.created_at desc limit 50) r;
  return result;
end $$;

create or replace function public.parlour_seen(p_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user(); r public.parlour_rounds%rowtype;
begin
  perform private.parlour_rate(uid);
  select * into r from public.parlour_rounds where id=p_id and uid in (from_user,to_user) and (second_choice is not null or (uid=from_user and declined_at is not null));
  if not found then perform private.refuse('not_found'); end if;
  perform private.parlour_friend(uid,case when uid=r.from_user then r.to_user else r.from_user end,false);
  select * into r from public.parlour_rounds where id=p_id and uid in (from_user,to_user) and (second_choice is not null or (uid=from_user and declined_at is not null)) for update;
  if not found then perform private.refuse('not_found'); end if;
  update public.parlour_rounds set seen_at=case when uid=from_user then coalesce(seen_at,now()) else seen_at end,
    recipient_seen_at=case when uid=to_user then coalesce(recipient_seen_at,now()) else recipient_seen_at end where id=p_id;
  return true;
end $$;

drop trigger if exists push_enqueue on public.parlour_rounds;
create trigger push_enqueue after insert on public.parlour_rounds for each row execute function private.push_enqueue();
drop trigger if exists push_enqueue on private.parlour_answers;
create trigger push_enqueue after insert on private.parlour_answers for each row execute function private.push_enqueue();
revoke all on function private.parlour_rate(uuid), private.parlour_friend(uuid,uuid,boolean), private.parlour_unfriend() from public, anon, authenticated;
revoke all on function public.parlour_send(uuid,uuid,integer,integer), public.parlour_reply(uuid,integer), public.parlour_decline(uuid), public.parlour_inbox(), public.parlour_seen(uuid) from public, anon, authenticated;
grant execute on function public.parlour_send(uuid,uuid,integer,integer), public.parlour_reply(uuid,integer), public.parlour_decline(uuid), public.parlour_inbox(), public.parlour_seen(uuid) to authenticated;

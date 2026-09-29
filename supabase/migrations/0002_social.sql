-- Shelf Life: friends, shelves on show, Shelf Court summonses and daily scores.
--
-- Run after 0001_accounts_and_saves.sql. Safe to run more than once, and it
-- follows the same rules as 0001:
--   * every table hangs off auth.users on delete cascade, so
--     delete_my_account() removes all of it without being edited;
--   * row level security is on everywhere and nobody writes a table directly.
--     Every write is a security definer function that starts from
--     private.require_user();
--   * nothing a player writes is public. Names, shelves and drawings reach
--     accepted friends only, and scores reach strangers only as an anonymous
--     percentile.
--
-- Refusals raise errcode P0001 with a short token as the message (not_friends,
-- too_many_open, bad_score...). src/cloud/social.js turns tokens into copy.
-- add_friend is the exception: it answers { ok: false, error } so that a
-- refused attempt still counts towards its rate limit.
--
-- The shelf snapshot, as src/cloud/social.js shelfSnapshot() writes it:
--   {
--     v: 1,
--     name: text (24 characters at most, the owner's display name),
--     rank: integer (index into RANKS in src/content/mayhem.js),
--     curios: integer (how many curios are in the cabinet),
--     residents: [                        -- 18 at most
--       { id: text, name: text (22 at most), traits: [trait ids], bond: 0..25,
--         mood: 'content' | 'fine' | 'annoyed' | 'furious',
--         art: { creature: {...} }                     -- a generated resident
--            | { body: 'data:image/png;base64,...',    -- a drawn one, under 120 KB,
--                stamps: [...], bounds: {...} } }      -- or '' when it did not fit
--     ]
--   }
-- The server checks only the outline and the size. Every reader validates
-- the contents again before anything is drawn.
--
-- Housekeeping, for the SQL editor now and then:
--   delete from public.scores where day < current_date - 30;
--   delete from public.summons where created_at < now() - interval '60 days';
--   delete from private.friend_attempts where at < now() - interval '1 day';

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.shelves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  snapshot jsonb not null,
  updated_at timestamptz not null default now(),
  constraint shelves_snapshot_size check (octet_length(snapshot::text) < 400000)
);

-- One row per pair, whoever asked. The unique index below stops a second row
-- the other way round.
create table if not exists public.friendships (
  requester uuid not null references auth.users (id) on delete cascade,
  addressee uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  constraint friendships_not_self check (requester <> addressee)
);
create unique index if not exists friendships_pair on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index if not exists friendships_addressee on public.friendships (addressee);

create table if not exists public.blocks (
  blocker uuid not null references auth.users (id) on delete cascade,
  blocked uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  constraint blocks_not_self check (blocker <> blocked)
);
create index if not exists blocks_blocked on public.blocks (blocked);

-- For a person to read by hand. Nobody can select from it through the API.
create table if not exists public.reports (
  id bigint generated always as identity primary key,
  reporter uuid not null references auth.users (id) on delete cascade,
  reported uuid not null references auth.users (id) on delete cascade,
  reason text not null default '' check (char_length(reason) <= 200),
  evidence jsonb,
  created_at timestamptz not null default now()
);
create index if not exists reports_reporter on public.reports (reporter, created_at);

create table if not exists public.summons (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  case_id text not null check (case_id ~ '^[a-z0-9-]{1,40}$'),
  plaintiff jsonb not null,
  defendant jsonb not null,
  status text not null default 'open' check (status in ('open', 'ruled', 'declined')),
  verdict text check (verdict in ('plaintiff', 'defendant', 'both')),
  stars int check (stars between 0 and 3),
  ratings int check (ratings between 0 and 100),
  created_at timestamptz not null default now(),
  ruled_at timestamptz,
  sender_seen_at timestamptz,
  constraint summons_not_self check (from_user <> to_user),
  constraint summons_payload_size check (octet_length(plaintiff::text) < 150000 and octet_length(defendant::text) < 150000)
);
create index if not exists summons_to on public.summons (to_user, status);
create index if not exists summons_from on public.summons (from_user, status);

-- The daily challenge. `day` is the player's own calendar date.
create table if not exists public.scores (
  user_id uuid not null references auth.users (id) on delete cascade,
  game text not null check (game in ('frenzy', 'stack', 'seance', 'whack')),
  day date not null,
  score int not null check (score >= 0),
  mod text not null default '' check (mod ~ '^[a-z0-9-]{0,24}$'),
  updated_at timestamptz not null default now(),
  primary key (user_id, game, day)
);
create index if not exists scores_board on public.scores (game, day, score desc);

create table if not exists private.friend_attempts (
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now()
);
create index if not exists friend_attempts_recent on private.friend_attempts (user_id, at);

-- ---------------------------------------------------------------------------
-- Row level security. Reads are narrow; writes go through the functions.
-- ---------------------------------------------------------------------------

alter table public.shelves enable row level security;
alter table public.friendships enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.summons enable row level security;
alter table public.scores enable row level security;
alter table private.friend_attempts enable row level security;

revoke all on table public.shelves, public.friendships, public.blocks, public.reports, public.summons, public.scores
  from public, anon, authenticated;
revoke all on table private.friend_attempts from public;
grant select on table public.shelves, public.friendships, public.blocks, public.summons, public.scores to authenticated;

drop policy if exists "shelves are for their owner and accepted friends" on public.shelves;
create policy "shelves are for their owner and accepted friends" on public.shelves
  for select to authenticated using (
    auth.uid() = user_id or exists (
      select 1 from public.friendships f
       where f.status = 'accepted'
         and ((f.requester = auth.uid() and f.addressee = shelves.user_id)
           or (f.addressee = auth.uid() and f.requester = shelves.user_id))));

drop policy if exists "friendships are for the two players in them" on public.friendships;
create policy "friendships are for the two players in them" on public.friendships
  for select to authenticated using (auth.uid() in (requester, addressee));

drop policy if exists "blocks are for the blocker" on public.blocks;
create policy "blocks are for the blocker" on public.blocks
  for select to authenticated using (auth.uid() = blocker);

drop policy if exists "summonses are for the two players in them" on public.summons;
create policy "summonses are for the two players in them" on public.summons
  for select to authenticated using (auth.uid() in (from_user, to_user));

drop policy if exists "scores are private to their owner" on public.scores;
create policy "scores are private to their owner" on public.scores
  for select to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Helpers (not callable from the API)
-- ---------------------------------------------------------------------------

create or replace function private.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.friendships f
     where f.status = 'accepted'
       and ((f.requester = a and f.addressee = b) or (f.requester = b and f.addressee = a)));
$$;

create or replace function private.refuse(token text)
returns void
language plpgsql
set search_path = public
as $$
begin
  raise exception '%', token using errcode = 'P0001';
end;
$$;

-- Control characters out, trimmed, clamped.
create or replace function private.clean_text(value text, max_length int)
returns text
language sql
immutable
set search_path = public
as $$
  select left(btrim(regexp_replace(coalesce(value, ''), '[[:cntrl:]]', ' ', 'g')), max_length);
$$;

create or replace function private.score_cap(p_game text)
returns int
language sql
immutable
set search_path = public
as $$
  select case p_game when 'frenzy' then 3000 when 'stack' then 500 when 'seance' then 150 when 'whack' then 2500 end;
$$;

-- A calendar date as YYYY-M-D (zero padding optional), or a refusal.
create or replace function private.score_day(p_day text)
returns date
language plpgsql
stable
set search_path = public
as $$
declare
  d date;
begin
  if p_day is null or p_day !~ '^\d{4}-\d{1,2}-\d{1,2}$' then
    perform private.refuse('bad_day');
  end if;
  begin
    d := make_date(split_part(p_day, '-', 1)::int, split_part(p_day, '-', 2)::int, split_part(p_day, '-', 3)::int);
  exception when others then
    perform private.refuse('bad_day');
  end;
  return d;
end;
$$;

create or replace function private.check_game(p_game text)
returns void
language plpgsql
stable
set search_path = public
as $$
begin
  if private.score_cap(p_game) is null then perform private.refuse('bad_game'); end if;
end;
$$;

revoke all on function private.are_friends(uuid, uuid) from public;
revoke all on function private.refuse(text) from public;
revoke all on function private.clean_text(text, int) from public;
revoke all on function private.score_cap(text) from public;
revoke all on function private.score_day(text) from public;
revoke all on function private.check_game(text) from public;

-- ---------------------------------------------------------------------------
-- Friends
-- ---------------------------------------------------------------------------

-- Answers { ok, status: 'pending' | 'accepted', user_id, friend_code, display_name }
-- or { ok: false, error: rate_limited | not_found | self | blocked | already_friends | already_asked }.
-- A player who has blocked the caller looks exactly like a code that does not
-- exist. The other player's name is only returned once they are a friend.
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

create or replace function public.respond_friend(p_user uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
begin
  if coalesce(p_accept, false) then
    update public.friendships set status = 'accepted' where requester = p_user and addressee = uid and status = 'pending';
  else
    delete from public.friendships where requester = p_user and addressee = uid and status = 'pending';
  end if;
  if not found then perform private.refuse('not_found'); end if;
  return jsonb_build_object('ok', true, 'status', case when p_accept then 'accepted' else 'declined' end);
end;
$$;

-- Unfriends, or withdraws a request either way. Open summonses between the
-- two are withdrawn with it.
create or replace function public.remove_friend(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
begin
  delete from public.friendships
   where (requester = uid and addressee = p_user) or (requester = p_user and addressee = uid);
  delete from public.summons
   where status = 'open' and ((from_user = uid and to_user = p_user) or (from_user = p_user and to_user = uid));
  return jsonb_build_object('ok', true);
end;
$$;

-- Removes the friendship and every summons between the two, and stops them
-- adding the caller again. They are not told.
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
  insert into public.blocks (blocker, blocked) values (uid, p_user) on conflict do nothing;
  delete from public.friendships
   where (requester = uid and addressee = p_user) or (requester = p_user and addressee = uid);
  delete from public.summons
   where (from_user = uid and to_user = p_user) or (from_user = p_user and to_user = uid);
  return jsonb_build_object('ok', true);
end;
$$;

-- Keeps what the reporter could see (the name and the shelf) with the report,
-- so a later rename does not erase the evidence. Five an hour.
create or replace function public.report_user(p_user uuid, p_reason text)
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
  if (select count(*) from public.reports where reporter = uid and created_at > now() - interval '1 hour') >= 5 then
    perform private.refuse('rate_limited');
  end if;
  insert into public.reports (reporter, reported, reason, evidence)
  values (uid, p_user, private.clean_text(p_reason, 200), jsonb_build_object(
    'display_name', (select display_name from public.profiles where user_id = p_user),
    'shelf', (select snapshot from public.shelves where user_id = p_user)));
  return jsonb_build_object('ok', true);
end;
$$;

-- [{ user_id, display_name, friend_code, status, direction, shelf_updated_at }].
-- Pending requests come first. A request the caller sent does not show the
-- other player's name until they accept.
create or replace function public.list_friends()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with me as (select private.require_user() as uid),
  pairs as (
    select case when f.requester = me.uid then f.addressee else f.requester end as other, f.status, f.created_at,
           case when f.requester = me.uid then 'outgoing' else 'incoming' end as direction
      from public.friendships f, me
     where me.uid in (f.requester, f.addressee)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', r.other,
      'display_name', case when r.status = 'accepted' or r.direction = 'incoming' then coalesce(p.display_name, '') else '' end,
      'friend_code', coalesce(p.friend_code, ''),
      'status', r.status,
      'direction', r.direction,
      'shelf_updated_at', case when r.status = 'accepted' then s.updated_at end
    ) order by r.status desc, lower(coalesce(p.display_name, '')), r.created_at), '[]'::jsonb)
    from pairs r
    left join public.profiles p on p.user_id = r.other
    left join public.shelves s on s.user_id = r.other;
$$;

-- ---------------------------------------------------------------------------
-- Shelves
-- ---------------------------------------------------------------------------

create or replace function public.publish_shelf(p_snapshot jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  saved public.shelves%rowtype;
begin
  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object'
     or jsonb_typeof(coalesce(p_snapshot -> 'residents', '[]'::jsonb)) <> 'array' then
    perform private.refuse('bad_shelf');
  end if;
  if jsonb_array_length(coalesce(p_snapshot -> 'residents', '[]'::jsonb)) > 18 then
    perform private.refuse('bad_shelf');
  end if;
  insert into public.shelves (user_id, snapshot, updated_at) values (uid, p_snapshot, now())
  on conflict (user_id) do update set snapshot = excluded.snapshot, updated_at = excluded.updated_at
  returning * into saved;
  return jsonb_build_object('ok', true, 'updated_at', saved.updated_at);
end;
$$;

create or replace function public.get_shelf(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
begin
  if p_user is null or (p_user <> uid and not private.are_friends(uid, p_user)) then
    perform private.refuse('not_friends');
  end if;
  return (select jsonb_build_object('user_id', p_user, 'display_name', coalesce(p.display_name, ''),
      'snapshot', s.snapshot, 'updated_at', s.updated_at)
    from (select p_user as id) x
    left join public.profiles p on p.user_id = x.id
    left join public.shelves s on s.user_id = x.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Shelf Court summonses
-- ---------------------------------------------------------------------------

create or replace function public.send_summons(p_to uuid, p_case text, p_plaintiff jsonb, p_defendant jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  s public.summons%rowtype;
begin
  if p_to is null or not private.are_friends(uid, p_to) then perform private.refuse('not_friends'); end if;
  if p_case is null or p_case !~ '^[a-z0-9-]{1,40}$' then perform private.refuse('bad_case'); end if;
  if p_plaintiff is null or jsonb_typeof(p_plaintiff) <> 'object' or p_defendant is null or jsonb_typeof(p_defendant) <> 'object' then
    perform private.refuse('bad_summons');
  end if;
  if octet_length(p_plaintiff::text) >= 150000 or octet_length(p_defendant::text) >= 150000 then
    perform private.refuse('too_large');
  end if;
  -- At most five waiting from one player to another, so papers cannot pile up.
  perform 1 from public.friendships
   where least(requester, addressee) = least(uid, p_to) and greatest(requester, addressee) = greatest(uid, p_to)
   for update;
  if (select count(*) from public.summons where from_user = uid and to_user = p_to and status = 'open') >= 5 then
    perform private.refuse('too_many_open');
  end if;
  insert into public.summons (from_user, to_user, case_id, plaintiff, defendant)
  values (uid, p_to, p_case, p_plaintiff, p_defendant)
  returning * into s;
  return jsonb_build_object('ok', true, 'id', s.id, 'created_at', s.created_at);
end;
$$;

create or replace function public.rule_summons(p_id uuid, p_verdict text, p_stars int, p_ratings int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  s public.summons%rowtype;
begin
  if p_verdict is null or p_verdict not in ('plaintiff', 'defendant', 'both') then perform private.refuse('bad_verdict'); end if;
  if p_stars is null or p_stars not between 0 and 3 or p_ratings is null or p_ratings not between 0 and 100 then
    perform private.refuse('bad_verdict');
  end if;
  select * into s from public.summons where id = p_id and to_user = uid for update;
  if not found then perform private.refuse('not_found'); end if;
  if s.status <> 'open' then perform private.refuse('not_open'); end if;
  update public.summons
     set status = 'ruled', verdict = p_verdict, stars = p_stars, ratings = p_ratings, ruled_at = now()
   where id = p_id
  returning * into s;
  return jsonb_build_object('ok', true, 'id', s.id, 'status', s.status, 'ruled_at', s.ruled_at);
end;
$$;

create or replace function public.decline_summons(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
begin
  update public.summons set status = 'declined', ruled_at = now()
   where id = p_id and to_user = uid and status = 'open';
  if not found then perform private.refuse('not_found'); end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- Open summonses waiting for the caller, and verdicts on ones the caller sent
-- that they have not seen yet. Each names the other player. Verdicts carry
-- only the residents' ids and names: the sender already has their own art.
create or replace function public.inbox()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with me as (select private.require_user() as uid),
  waiting as (
    select s.* from public.summons s, me
     where s.to_user = me.uid and s.status = 'open' and s.created_at > now() - interval '30 days'
       and not exists (select 1 from public.blocks b where b.blocker = me.uid and b.blocked = s.from_user)
     order by s.created_at desc limit 20
  ),
  ruled as (
    select s.* from public.summons s, me
     where s.from_user = me.uid and s.status = 'ruled' and s.sender_seen_at is null
       and not exists (select 1 from public.blocks b where b.blocker = me.uid and b.blocked = s.to_user)
     order by s.ruled_at desc limit 20
  )
  select jsonb_build_object(
    'cases', coalesce((select jsonb_agg(jsonb_build_object(
        'id', w.id, 'from_user', w.from_user, 'from_name', coalesce(p.display_name, ''), 'case_id', w.case_id,
        'plaintiff', w.plaintiff, 'defendant', w.defendant, 'created_at', w.created_at) order by w.created_at desc)
      from waiting w left join public.profiles p on p.user_id = w.from_user), '[]'::jsonb),
    'results', coalesce((select jsonb_agg(jsonb_build_object(
        'id', r.id, 'to_user', r.to_user, 'to_name', coalesce(p.display_name, ''), 'case_id', r.case_id,
        'plaintiff', jsonb_build_object('id', r.plaintiff -> 'id', 'name', r.plaintiff -> 'name'),
        'defendant', jsonb_build_object('id', r.defendant -> 'id', 'name', r.defendant -> 'name'),
        'verdict', r.verdict, 'stars', r.stars, 'ratings', r.ratings, 'ruled_at', r.ruled_at) order by r.ruled_at desc)
      from ruled r left join public.profiles p on p.user_id = r.to_user), '[]'::jsonb));
$$;

create or replace function public.mark_summons_seen(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
begin
  update public.summons set sender_seen_at = now()
   where id = p_id and from_user = uid and status = 'ruled' and sender_seen_at is null;
  return jsonb_build_object('ok', found);
end;
$$;

-- ---------------------------------------------------------------------------
-- Daily challenge scores
-- ---------------------------------------------------------------------------

-- Keeps the best score per game per day. A score above the game's sanity cap
-- is refused rather than trimmed, and so is a day more than two from today.
create or replace function public.submit_score(p_game text, p_day text, p_score int, p_mod text default '')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  d date := private.score_day(p_day);
  v_mod text := lower(coalesce(p_mod, ''));
  best int;
begin
  perform private.check_game(p_game);
  if abs(d - current_date) > 2 then perform private.refuse('bad_day'); end if;
  if p_score is null or p_score < 0 or p_score > private.score_cap(p_game) then perform private.refuse('bad_score'); end if;
  if v_mod !~ '^[a-z0-9-]{0,24}$' then perform private.refuse('bad_mod'); end if;
  insert into public.scores as kept (user_id, game, day, score, mod) values (uid, p_game, d, p_score, v_mod)
  on conflict (user_id, game, day) do update
     set score = excluded.score, mod = excluded.mod, updated_at = now()
   where excluded.score > kept.score;
  select kept.score into best from public.scores kept where kept.user_id = uid and kept.game = p_game and kept.day = d;
  return jsonb_build_object('ok', true, 'best', best);
end;
$$;

-- The caller and their accepted friends, best first. Nobody else.
create or replace function public.friends_board(p_game text, p_day text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  d date := private.score_day(p_day);
begin
  perform private.check_game(p_game);
  return (
    with circle as (
      select uid as id
      union
      select case when f.requester = uid then f.addressee else f.requester end
        from public.friendships f
       where f.status = 'accepted' and uid in (f.requester, f.addressee)
    ),
    ranked as (
      select s.user_id, s.score, rank() over (order by s.score desc) as place
        from public.scores s join circle c on c.id = s.user_id
       where s.game = p_game and s.day = d
    )
    select coalesce(jsonb_agg(jsonb_build_object('user_id', r.user_id, 'display_name', coalesce(p.display_name, ''),
        'score', r.score, 'rank', r.place, 'me', r.user_id = uid) order by r.place, lower(coalesce(p.display_name, ''))), '[]'::jsonb)
      from (select * from ranked order by place limit 50) r
      left join public.profiles p on p.user_id = r.user_id);
end;
$$;

-- Everyone who played, as numbers only: { players, beaten_percent, top_score }.
-- beaten_percent is the share of the other players the caller beat, or null
-- when the caller has no score or played alone.
create or replace function public.day_percentile(p_game text, p_day text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  d date := private.score_day(p_day);
  players int;
  top int;
  mine int;
  beaten int;
begin
  perform private.check_game(p_game);
  select count(*), max(score) into players, top from public.scores where game = p_game and day = d;
  select score into mine from public.scores where user_id = uid and game = p_game and day = d;
  if mine is not null then
    select count(*) into beaten from public.scores where game = p_game and day = d and score < mine;
  end if;
  return jsonb_build_object('players', players, 'top_score', top,
    'beaten_percent', case when mine is null or players <= 1 then null else floor(100.0 * beaten / (players - 1))::int end);
end;
$$;

-- ---------------------------------------------------------------------------
-- Who may call what: signed-in players (anonymous ones included), nobody else.
-- ---------------------------------------------------------------------------

revoke all on function public.add_friend(text) from public, anon, authenticated;
revoke all on function public.respond_friend(uuid, boolean) from public, anon, authenticated;
revoke all on function public.remove_friend(uuid) from public, anon, authenticated;
revoke all on function public.block_user(uuid) from public, anon, authenticated;
revoke all on function public.report_user(uuid, text) from public, anon, authenticated;
revoke all on function public.list_friends() from public, anon, authenticated;
revoke all on function public.publish_shelf(jsonb) from public, anon, authenticated;
revoke all on function public.get_shelf(uuid) from public, anon, authenticated;
revoke all on function public.send_summons(uuid, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.rule_summons(uuid, text, int, int) from public, anon, authenticated;
revoke all on function public.decline_summons(uuid) from public, anon, authenticated;
revoke all on function public.inbox() from public, anon, authenticated;
revoke all on function public.mark_summons_seen(uuid) from public, anon, authenticated;
revoke all on function public.submit_score(text, text, int, text) from public, anon, authenticated;
revoke all on function public.friends_board(text, text) from public, anon, authenticated;
revoke all on function public.day_percentile(text, text) from public, anon, authenticated;

grant execute on function public.add_friend(text) to authenticated;
grant execute on function public.respond_friend(uuid, boolean) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.report_user(uuid, text) to authenticated;
grant execute on function public.list_friends() to authenticated;
grant execute on function public.publish_shelf(jsonb) to authenticated;
grant execute on function public.get_shelf(uuid) to authenticated;
grant execute on function public.send_summons(uuid, text, jsonb, jsonb) to authenticated;
grant execute on function public.rule_summons(uuid, text, int, int) to authenticated;
grant execute on function public.decline_summons(uuid) to authenticated;
grant execute on function public.inbox() to authenticated;
grant execute on function public.mark_summons_seen(uuid) to authenticated;
grant execute on function public.submit_score(text, text, int, text) to authenticated;
grant execute on function public.friends_board(text, text) to authenticated;
grant execute on function public.day_percentile(text, text) to authenticated;

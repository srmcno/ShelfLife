-- Shelf Life: the Joint Bench. Two friends judge the same Shelf Court hearing
-- blind, then the rulings are revealed together.
--
-- Run after 0002_social.sql. Safe to run more than once, and it follows the
-- same rules as 0001 and 0002:
--   * every table hangs off auth.users on delete cascade, so
--     delete_my_account() removes all of it without being edited;
--   * row level security is on and nobody reads or writes these tables
--     directly: there is no grant and no policy at all, because the first
--     judge's sealed ruling lives in the same row the second judge is shown.
--     Every read and write is a security definer function that starts from
--     private.require_user() and decides, field by field, what the caller may
--     see (private.hearing_json);
--   * nothing reaches anyone but the two judges, and only while they are
--     friends who have not blocked each other.
--
-- How a hearing goes:
--   1. The first judge watches the episode and rules. open_hearing() stores
--      the case, the version (twist), the seed, the cast and that ruling,
--      sealed, with the reactions they made while watching. Status 'open'.
--   2. The second judge fetches it (get_hearing): the case, the version, the
--      seed, the cast and the first judge's reactions, never the ruling, the
--      truth they were told, their stars or their jury. They rule
--      (rule_hearing) and the row is 'revealed'; the reply is the reveal.
--   3. Either judge reads the reveal (reveal_hearing). A hearing nobody
--      answers expires after 14 days, and then the first judge may read their
--      own ruling "standing alone".
-- The second judge may decline; the first may withdraw while it is open.
--
-- A ruling, as src/cloud/hearings.js sends it:
--   { ruling: 'plaintiff' | 'defendant' | 'both', truth: (the same three),
--     stars: 0..3, ratings: 0..100, agree: 0..6, dissent: 0..6 }
-- `truth` is what the judge's own edition says the right answer was. The
-- server cannot read case files, so the bench record only counts who was
-- right when both judges' editions agree on the truth.
--
-- Reactions are at most 40 marks per judge: { at: 'ask:3:2', r: 'laugh' |
-- 'gasp' | 'gavel', ms: 0..20000 }, where `at` names the line of script.
--
-- The cast is the snapshot the first judge's game made (the podiums, the jury
-- box and any character witnesses, with their art as residentSnapshot writes
-- it). The server checks its outline and size; every reader rebuilds it.
--
-- Housekeeping happens as hearings are opened: the caller's hearings older
-- than 90 days are deleted. For the SQL editor now and then:
--   delete from public.hearings where created_at < now() - interval '90 days';

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.hearings (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('served', 'invite')),
  case_id text not null check (case_id ~ '^[a-z0-9-]{1,40}$'),
  twist text check (twist ~ '^[a-z0-9-]{1,40}$'),
  seed int not null check (seed between 1 and 2147483647),
  cast_snapshot jsonb not null,
  status text not null default 'open' check (status in ('open', 'revealed', 'declined', 'withdrawn')),
  first_ruling jsonb not null,
  first_marks jsonb not null default '[]'::jsonb,
  second_ruling jsonb,
  second_marks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  ruled_at timestamptz,
  first_seen_at timestamptz,
  second_seen_at timestamptz,
  constraint hearings_not_self check (from_user <> to_user),
  constraint hearings_cast_size check (octet_length(cast_snapshot::text) < 150000),
  constraint hearings_marks check (jsonb_typeof(first_marks) = 'array' and jsonb_typeof(second_marks) = 'array'
    and jsonb_array_length(first_marks) <= 40 and jsonb_array_length(second_marks) <= 40)
);
create index if not exists hearings_to on public.hearings (to_user, status);
create index if not exists hearings_from on public.hearings (from_user, status);
create index if not exists hearings_pair on public.hearings (least(from_user, to_user), greatest(from_user, to_user), status);

-- One row per pair (user_a < user_b): hearings revealed together, full
-- benches, and how often each was right. Kept when a friendship ends, so a
-- pair who make up find their old rivalry waiting. Blocking deletes it.
create table if not exists public.bench_records (
  user_a uuid not null references auth.users (id) on delete cascade,
  user_b uuid not null references auth.users (id) on delete cascade,
  hearings int not null default 0 check (hearings >= 0),
  full_benches int not null default 0 check (full_benches >= 0),
  a_right int not null default 0 check (a_right >= 0),
  b_right int not null default 0 check (b_right >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_a, user_b),
  constraint bench_records_order check (user_a < user_b)
);
create index if not exists bench_records_b on public.bench_records (user_b);

alter table public.hearings enable row level security;
alter table public.bench_records enable row level security;
revoke all on table public.hearings, public.bench_records from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers (not callable from the API)
-- ---------------------------------------------------------------------------

create or replace function private.blocked_either(a uuid, b uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (select 1 from public.blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a));
$$;

-- An open hearing past its expiry reads as 'expired'. Nothing rewrites the row.
create or replace function private.hearing_status(p_status text, p_expires timestamptz)
returns text
language sql
stable
set search_path = public
as $$
  select case when p_status = 'open' and p_expires <= now() then 'expired' else p_status end;
$$;

-- A ruling as stored, or a refusal. Only the six known fields survive.
create or replace function private.clean_ruling(p jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
begin
  if p is null or jsonb_typeof(p) <> 'object'
     or coalesce(p ->> 'ruling', '') not in ('plaintiff', 'defendant', 'both')
     or coalesce(p ->> 'truth', '') not in ('plaintiff', 'defendant', 'both') then
    perform private.refuse('bad_ruling');
  end if;
  if jsonb_typeof(p -> 'stars') is distinct from 'number' or jsonb_typeof(p -> 'ratings') is distinct from 'number'
     or jsonb_typeof(p -> 'agree') is distinct from 'number' or jsonb_typeof(p -> 'dissent') is distinct from 'number' then
    perform private.refuse('bad_ruling');
  end if;
  if (p ->> 'stars')::numeric not in (0, 1, 2, 3) or (p ->> 'ratings')::numeric not between 0 and 100
     or (p ->> 'ratings')::numeric <> floor((p ->> 'ratings')::numeric)
     or (p ->> 'agree')::numeric not in (0, 1, 2, 3, 4, 5, 6) or (p ->> 'dissent')::numeric not in (0, 1, 2, 3, 4, 5, 6)
     or (p ->> 'agree')::numeric + (p ->> 'dissent')::numeric > 6 then
    perform private.refuse('bad_ruling');
  end if;
  return jsonb_build_object('ruling', p ->> 'ruling', 'truth', p ->> 'truth', 'stars', (p ->> 'stars')::int,
    'ratings', (p ->> 'ratings')::int, 'agree', (p ->> 'agree')::int, 'dissent', (p ->> 'dissent')::int);
end;
$$;

-- Reaction marks: the first 40 that make sense, rebuilt field by field.
-- Anything else is dropped rather than refused: a reaction is never worth
-- losing a ruling over.
create or replace function private.clean_marks(p jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('at', m ->> 'at', 'r', m ->> 'r', 'ms', (m ->> 'ms')::int) order by n), '[]'::jsonb)
    from (
      select m, n from jsonb_array_elements(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end) with ordinality as x(m, n)
       where jsonb_typeof(m) = 'object'
         and coalesce(m ->> 'at', '') ~ '^[a-z0-9:-]{1,24}$'
         and coalesce(m ->> 'r', '') in ('laugh', 'gasp', 'gavel')
         and jsonb_typeof(m -> 'ms') = 'number'
         and (m ->> 'ms') ~ '^[0-9]{1,5}$' and (m ->> 'ms')::int <= 20000
       order by n
       limit 40
    ) kept;
$$;

-- The cast's outline: an object under the size cap, a jury of at most six and
-- at most three character witnesses, each a member with an id and a name.
create or replace function private.check_cast(p jsonb)
returns void
language plpgsql
immutable
set search_path = public
as $$
begin
  if p is null or jsonb_typeof(p) <> 'object'
     or jsonb_typeof(p -> 'p') is distinct from 'object' or jsonb_typeof(p -> 'd') is distinct from 'object'
     or jsonb_typeof(p -> 'jury') is distinct from 'array'
     or jsonb_typeof(coalesce(p -> 'witnesses', '[]'::jsonb)) <> 'array' then
    perform private.refuse('bad_cast');
  end if;
  if jsonb_array_length(p -> 'jury') > 6 or jsonb_array_length(coalesce(p -> 'witnesses', '[]'::jsonb)) > 3 then
    perform private.refuse('bad_cast');
  end if;
  if octet_length(p::text) >= 150000 then perform private.refuse('too_large'); end if;
end;
$$;

-- The one place that decides what a judge may see of a hearing. The other
-- judge's ruling, the truth they were told and their reactions-after-the-fact
-- appear only once the hearing is revealed; a first judge whose hearing
-- expired unanswered sees their own ruling "standing alone". With p_full the
-- cast and the marks come too.
create or replace function private.hearing_json(h public.hearings, uid uuid, p_full boolean)
returns jsonb
language sql
stable
set search_path = public
as $$
  with v as (
    select case when h.from_user = uid then 'first' else 'second' end as role,
           private.hearing_status(h.status, h.expires_at) as status
  )
  select jsonb_build_object(
      'id', h.id, 'kind', h.kind, 'role', v.role,
      'other_user', case when v.role = 'first' then h.to_user else h.from_user end,
      'other_name', coalesce((select display_name from public.profiles
                               where user_id = case when v.role = 'first' then h.to_user else h.from_user end), ''),
      'case_id', h.case_id, 'twist', h.twist, 'seed', h.seed, 'status', v.status,
      'created_at', h.created_at, 'expires_at', h.expires_at, 'ruled_at', h.ruled_at,
      'mine', case when v.role = 'first' then h.first_ruling else h.second_ruling end,
      'theirs', case when v.status = 'revealed' then (case when v.role = 'first' then h.second_ruling else h.first_ruling end) end,
      'alone', v.role = 'first' and v.status = 'expired',
      'seen', case when v.role = 'first' then h.first_seen_at is not null else h.second_seen_at is not null end)
    || case when p_full then jsonb_build_object(
      'cast', h.cast_snapshot,
      -- The second judge hears the first judge's reactions as the gallery; the
      -- first judge hears the second's only once it is all over.
      'their_marks', case when v.role = 'second' then h.first_marks when v.status = 'revealed' then h.second_marks else '[]'::jsonb end,
      'my_marks', case when v.role = 'first' then h.first_marks else h.second_marks end)
    else '{}'::jsonb end
  from v;
$$;

revoke all on function private.blocked_either(uuid, uuid) from public;
revoke all on function private.hearing_status(text, timestamptz) from public;
revoke all on function private.clean_ruling(jsonb) from public;
revoke all on function private.clean_marks(jsonb) from public;
revoke all on function private.check_cast(jsonb) from public;
revoke all on function private.hearing_json(public.hearings, uuid, boolean) from public;

-- Blocking tears up every hearing between the two and their record; ending a
-- friendship withdraws the open ones, as remove_friend does with summonses.
create or replace function private.hearings_on_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.hearings
   where (from_user = new.blocker and to_user = new.blocked) or (from_user = new.blocked and to_user = new.blocker);
  delete from public.bench_records
   where user_a = least(new.blocker, new.blocked) and user_b = greatest(new.blocker, new.blocked);
  return new;
end;
$$;
create or replace function private.hearings_on_unfriend()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.hearings
   where status = 'open'
     and ((from_user = old.requester and to_user = old.addressee) or (from_user = old.addressee and to_user = old.requester));
  return old;
end;
$$;
revoke all on function private.hearings_on_block() from public;
revoke all on function private.hearings_on_unfriend() from public;

drop trigger if exists hearings_on_block on public.blocks;
create trigger hearings_on_block after insert on public.blocks
  for each row execute function private.hearings_on_block();
drop trigger if exists hearings_on_unfriend on public.friendships;
create trigger hearings_on_unfriend after delete on public.friendships
  for each row execute function private.hearings_on_unfriend();

-- ---------------------------------------------------------------------------
-- The Joint Bench
-- ---------------------------------------------------------------------------

-- Do not disturb, if the postbox migration (0003) is there. Checked dynamically
-- so this file still loads on its own.
create or replace function private.hearing_dnd(p_user uuid)
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
revoke all on function private.hearing_dnd(uuid) from public;

-- The first judge has watched and ruled. Answers { ok, id, created_at, expires_at }.
-- Twenty a day per player, five open between any pair (either way round).
create or replace function public.open_hearing(p_to uuid, p_kind text, p_case text, p_twist text, p_seed int,
  p_cast jsonb, p_ruling jsonb, p_marks jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  ruling jsonb;
  h public.hearings%rowtype;
begin
  if p_to is null or p_to = uid or not private.are_friends(uid, p_to) or private.blocked_either(uid, p_to) then
    perform private.refuse('not_friends');
  end if;
  if p_kind is null or p_kind not in ('served', 'invite') then perform private.refuse('bad_hearing'); end if;
  -- A new invitation, served or not, does not reach a player who asked for quiet.
  if private.hearing_dnd(p_to) then perform private.refuse('dnd'); end if;
  if p_case is null or p_case !~ '^[a-z0-9-]{1,40}$' then perform private.refuse('bad_case'); end if;
  if nullif(p_twist, '') is not null and p_twist !~ '^[a-z0-9-]{1,40}$' then perform private.refuse('bad_hearing'); end if;
  if p_seed is null or p_seed < 1 then perform private.refuse('bad_hearing'); end if;
  perform private.check_cast(p_cast);
  ruling := private.clean_ruling(p_ruling);
  if (select count(*) from public.hearings where from_user = uid and created_at > now() - interval '1 day') >= 20 then
    perform private.refuse('rate_limited');
  end if;
  -- One at a time per pair, so the cap below cannot be raced past.
  perform 1 from public.friendships
   where least(requester, addressee) = least(uid, p_to) and greatest(requester, addressee) = greatest(uid, p_to)
   for update;
  if (select count(*) from public.hearings
       where least(from_user, to_user) = least(uid, p_to) and greatest(from_user, to_user) = greatest(uid, p_to)
         and status = 'open' and expires_at > now()) >= 5 then
    perform private.refuse('too_many_open');
  end if;
  delete from public.hearings where (from_user = uid or to_user = uid) and created_at < now() - interval '90 days';
  insert into public.hearings (from_user, to_user, kind, case_id, twist, seed, cast_snapshot, first_ruling, first_marks, first_seen_at)
  values (uid, p_to, p_kind, p_case, nullif(p_twist, ''), p_seed, p_cast, ruling, private.clean_marks(p_marks), null)
  returning * into h;
  return jsonb_build_object('ok', true, 'id', h.id, 'created_at', h.created_at, 'expires_at', h.expires_at);
end;
$$;

-- The second judge rules. The hearing is revealed at once, the pair's record
-- moves, and the reply is the reveal (as reveal_hearing answers it).
create or replace function public.rule_hearing(p_id uuid, p_ruling jsonb, p_marks jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  ruling jsonb := private.clean_ruling(p_ruling);
  h public.hearings%rowtype;
  first_right boolean;
  second_right boolean;
  agreed boolean;
begin
  select * into h from public.hearings where id = p_id and to_user = uid for update;
  if not found or private.blocked_either(h.from_user, h.to_user) then perform private.refuse('not_found'); end if;
  if private.hearing_status(h.status, h.expires_at) <> 'open' then perform private.refuse('not_open'); end if;
  if not private.are_friends(h.from_user, h.to_user) then perform private.refuse('not_friends'); end if;
  update public.hearings
     set second_ruling = ruling, second_marks = private.clean_marks(p_marks), status = 'revealed', ruled_at = now(), second_seen_at = now()
   where id = p_id
  returning * into h;
  -- Who was right counts only when both editions agree on what right was.
  agreed := (h.first_ruling ->> 'truth') = (h.second_ruling ->> 'truth');
  first_right := agreed and (h.first_ruling ->> 'ruling') = (h.first_ruling ->> 'truth');
  second_right := agreed and (h.second_ruling ->> 'ruling') = (h.second_ruling ->> 'truth');
  insert into public.bench_records as r (user_a, user_b, hearings, full_benches, a_right, b_right)
  values (least(h.from_user, h.to_user), greatest(h.from_user, h.to_user), 1,
          case when first_right and second_right then 1 else 0 end,
          case when (h.from_user < h.to_user and first_right) or (h.to_user < h.from_user and second_right) then 1 else 0 end,
          case when (h.from_user > h.to_user and first_right) or (h.to_user > h.from_user and second_right) then 1 else 0 end)
  on conflict (user_a, user_b) do update
     set hearings = r.hearings + 1, full_benches = r.full_benches + excluded.full_benches,
         a_right = r.a_right + excluded.a_right, b_right = r.b_right + excluded.b_right, updated_at = now();
  -- Friendship levels belong to another migration, which may not be installed.
  if to_regprocedure('private.bump_friendship(uuid, uuid, text)') is not null then
    execute 'select private.bump_friendship($1, $2, $3)' using h.from_user, h.to_user, 'hearing';
  end if;
  return private.hearing_json(h, uid, true);
end;
$$;

-- { hearings: [...], records: [...] }. Hearings: open ones between friends,
-- and anything settled in the last 30 days, newest first, 40 at most. Never a
-- cast or a mark, and never the other judge's ruling before the reveal.
-- Records: one line per friend the caller has judged with.
create or replace function public.hearings()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
begin
  return jsonb_build_object(
    'hearings', coalesce((
      select jsonb_agg(private.hearing_json(h, uid, false) order by coalesce(h.ruled_at, h.created_at) desc)
        from (select * from public.hearings h
               where uid in (h.from_user, h.to_user)
                 and not private.blocked_either(h.from_user, h.to_user)
                 and (h.status <> 'open' or private.are_friends(h.from_user, h.to_user))
                 and coalesce(h.ruled_at, h.created_at) > now() - interval '30 days'
                 and not (h.status = 'withdrawn' and h.to_user = uid)
                 and not (h.to_user = uid and private.hearing_status(h.status, h.expires_at) = 'expired')
               order by coalesce(h.ruled_at, h.created_at) desc
               limit 40) h), '[]'::jsonb),
    'records', coalesce((
      select jsonb_agg(jsonb_build_object(
          'user_id', x.other, 'display_name', coalesce(p.display_name, ''), 'hearings', x.hearings, 'full_benches', x.full_benches,
          'mine_right', x.mine, 'theirs_right', x.theirs) order by x.updated_at desc)
        from (select case when r.user_a = uid then r.user_b else r.user_a end as other, r.hearings, r.full_benches, r.updated_at,
                     case when r.user_a = uid then r.a_right else r.b_right end as mine,
                     case when r.user_a = uid then r.b_right else r.a_right end as theirs
                from public.bench_records r
               where uid in (r.user_a, r.user_b)
               order by r.updated_at desc limit 50) x
        left join public.profiles p on p.user_id = x.other
       where private.are_friends(uid, x.other) and not private.blocked_either(uid, x.other)), '[]'::jsonb));
end;
$$;

-- One hearing in full: the cast and the reactions as the caller may see them.
-- The second judge gets everything needed to hear the identical episode and
-- nothing that says how the first judge ruled.
create or replace function public.get_hearing(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  h public.hearings%rowtype;
begin
  select * into h from public.hearings where id = p_id and uid in (from_user, to_user);
  if not found or private.blocked_either(h.from_user, h.to_user)
     or (h.status = 'withdrawn' and h.to_user = uid) then
    perform private.refuse('not_found');
  end if;
  if h.status = 'open' and not private.are_friends(h.from_user, h.to_user) then perform private.refuse('not_friends'); end if;
  return private.hearing_json(h, uid, true);
end;
$$;

-- The second judge declines an open hearing, or the first withdraws it.
create or replace function public.decline_hearing(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  h public.hearings%rowtype;
begin
  select * into h from public.hearings where id = p_id and uid in (from_user, to_user) for update;
  if not found or private.hearing_status(h.status, h.expires_at) <> 'open' then perform private.refuse('not_found'); end if;
  update public.hearings
     set status = case when h.to_user = uid then 'declined' else 'withdrawn' end,
         ruled_at = now(),
         second_seen_at = case when h.to_user = uid then now() else second_seen_at end,
         first_seen_at = case when h.from_user = uid then now() else first_seen_at end
   where id = p_id
  returning * into h;
  return jsonb_build_object('ok', true, 'status', h.status);
end;
$$;

-- The reveal, once there is one: both rulings, both truths, both sets of
-- reactions and the cast, and the caller's copy is marked as seen. A first
-- judge whose hearing expired unanswered gets theirs alone. Anything still
-- sealed is refused, whoever asks.
create or replace function public.reveal_hearing(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  h public.hearings%rowtype;
  status text;
begin
  select * into h from public.hearings where id = p_id and uid in (from_user, to_user) for update;
  if not found or private.blocked_either(h.from_user, h.to_user) then perform private.refuse('not_found'); end if;
  status := private.hearing_status(h.status, h.expires_at);
  if not (status = 'revealed' or (status in ('expired', 'declined') and h.from_user = uid)) then
    perform private.refuse('sealed');
  end if;
  update public.hearings
     set first_seen_at = case when from_user = uid then coalesce(first_seen_at, now()) else first_seen_at end,
         second_seen_at = case when to_user = uid then coalesce(second_seen_at, now()) else second_seen_at end
   where id = p_id
  returning * into h;
  return private.hearing_json(h, uid, true);
end;
$$;

-- One friend: the record between you and the last ten revealed hearings, for
-- the profile and for replays.
create or replace function public.bench_record(p_friend uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  r public.bench_records%rowtype;
begin
  if p_friend is null or p_friend = uid or not private.are_friends(uid, p_friend) or private.blocked_either(uid, p_friend) then
    perform private.refuse('not_friends');
  end if;
  select * into r from public.bench_records where user_a = least(uid, p_friend) and user_b = greatest(uid, p_friend);
  return jsonb_build_object(
    'user_id', p_friend,
    'display_name', coalesce((select display_name from public.profiles where user_id = p_friend), ''),
    'hearings', coalesce(r.hearings, 0), 'full_benches', coalesce(r.full_benches, 0),
    'mine_right', coalesce(case when r.user_a = uid then r.a_right else r.b_right end, 0),
    'theirs_right', coalesce(case when r.user_a = uid then r.b_right else r.a_right end, 0),
    'recent', coalesce((
      select jsonb_agg(private.hearing_json(h, uid, false) order by h.ruled_at desc)
        from (select * from public.hearings h
               where h.status = 'revealed'
                 and ((h.from_user = uid and h.to_user = p_friend) or (h.from_user = p_friend and h.to_user = uid))
               order by h.ruled_at desc limit 10) h), '[]'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------
-- Who may call what: signed-in players (anonymous ones included), nobody else.
-- ---------------------------------------------------------------------------

revoke all on function public.open_hearing(uuid, text, text, text, int, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.rule_hearing(uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.hearings() from public, anon, authenticated;
revoke all on function public.get_hearing(uuid) from public, anon, authenticated;
revoke all on function public.decline_hearing(uuid) from public, anon, authenticated;
revoke all on function public.reveal_hearing(uuid) from public, anon, authenticated;
revoke all on function public.bench_record(uuid) from public, anon, authenticated;

grant execute on function public.open_hearing(uuid, text, text, text, int, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.rule_hearing(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.hearings() to authenticated;
grant execute on function public.get_hearing(uuid) to authenticated;
grant execute on function public.decline_hearing(uuid) to authenticated;
grant execute on function public.reveal_hearing(uuid) to authenticated;
grant execute on function public.bench_record(uuid) to authenticated;

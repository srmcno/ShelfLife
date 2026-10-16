-- Shelf Life: trading curios and residents between friends.
--
-- Run after 0001_accounts_and_saves.sql and 0002_social.sql. It does not need
-- 0003 (the postbox), and calls private.bump_friendship only when that exists.
-- Safe to run more than once, and it follows the rules of 0001 and 0002:
--   * every table hangs off auth.users on delete cascade, so
--     delete_my_account() removes all of it without being edited;
--   * row level security is on everywhere and nobody reads or writes a table
--     directly. Every call is a security definer function that starts from
--     private.require_user();
--   * friends only, and a block either way stops everything.
--
-- Refusals raise errcode P0001 with a short token as the message:
--   not_friends, dnd, bad_trade, too_large, too_many_open, rate_limited,
--   resident_limit, in_escrow, already_traded, too_soon, not_found, not_open,
--   expired, no_counter, not_enough. src/cloud/trades.js turns tokens into copy.
--
-- An offer, as the client sends it:
--   p_give: { curios: [{ id, n }], resident: <snapshot> | null }   what the sender hands over
--   p_want: { curios: [{ id, n }], resident: { id, name } | null } what the sender asks for
-- A curio trade moves at most 3 curios each way (or is a gift: nothing asked).
-- A resident trade moves one resident, as a gift or a one for one swap, and
-- carries no curios. A resident snapshot is { id, name, traits, stats, bio,
-- art } as src/cloud/trades.js tradeSnapshot() writes it, under 150,000 bytes
-- (the summons cap). The server checks the outline, the ids and the size;
-- every reader validates the contents again before anything is drawn.
--
-- Escrow. Proposing an offer is the sender's promise to hand over exactly
-- what the offer holds; the client marks it as held, and the server keeps the
-- resident snapshot.
--
-- Reservations. Curios live in the client's save, so whoever gives curios
-- (an offer, a counter, or an acceptance that hands curios back) declares
-- what the save holds of each one, as of the last ledger entry it applied:
--   p_have: { seq: <ledger cursor>, curios: { id: copies owned } }
-- With the account locked, the server takes off what the account has already
-- promised in open offers (from any device) and what the ledger says left
-- after that cursor, keeps the last copy in the cabinet, and refuses
-- not_enough when what is left is short. Open offers are the reservation, so
-- declining, cancelling, countering, expiry, blocking and unfriending release
-- it with the offer itself.
--
-- The ledger. Every sealed trade writes one row per player to
-- public.trade_ledger: what left and what arrived for that player, in a
-- sequence of their own (1, 2, 3 ...). It is never pruned while the account
-- exists. trade_ledger(p_after, p_limit) pages through it, so any device or
-- any restored backup catches up from the cursor it saved, however old. Accepting is one transaction on a locked row: the
-- receiver's half (a resident snapshot, for a swap) is written and the offer
-- becomes 'accepted', or nothing happens. Each side then applies the trade
-- once, by its id. Declining, cancelling, countering, blocking, unfriending
-- and the 7 day expiry all release escrow.
--
-- Housekeeping runs inside list_trades for the caller's own rows: closed
-- offers that never happened go after 30 days, accepted trades lose their
-- snapshots after 90 days and go entirely after 400. The ledger keeps its
-- own copy, so none of that loses a settlement. For the SQL editor:
--   delete from public.trades where status not in ('open', 'accepted') and closed_at < now() - interval '30 days';

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('curio', 'resident')),
  status text not null default 'open' check (status in ('open', 'accepted', 'declined', 'cancelled', 'countered', 'expired')),
  parent uuid references public.trades (id) on delete set null,
  line text not null default '' check (line ~ '^[a-z0-9-]{0,40}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  closed_at timestamptz,
  constraint trades_not_self check (from_user <> to_user)
);
create index if not exists trades_from on public.trades (from_user, status);
create index if not exists trades_to on public.trades (to_user, status);

-- side 'from' is what the sender gives, side 'to' what the receiver gives.
-- A wanted resident holds only { id, name } until the receiver accepts.
create table if not exists public.trade_items (
  id bigint generated always as identity primary key,
  trade_id uuid not null references public.trades (id) on delete cascade,
  side text not null check (side in ('from', 'to')),
  kind text not null check (kind in ('curio', 'resident')),
  ref text not null check (ref ~ '^[a-zA-Z0-9_-]{1,100}$'),
  qty int not null default 1 check (qty between 1 and 3),
  snapshot jsonb,
  constraint trade_items_snapshot_size check (snapshot is null or octet_length(snapshot::text) < 150000),
  constraint trade_items_once unique (trade_id, side, kind, ref)
);
create index if not exists trade_items_resident on public.trade_items (ref) where kind = 'resident';

-- What a player would like and what they have spare, for friends to read.
create table if not exists public.trade_books (
  user_id uuid primary key references auth.users (id) on delete cascade,
  wishlist jsonb not null default '[]'::jsonb,
  spares jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint trade_books_size check (octet_length(wishlist::text) + octet_length(spares::text) < 8000)
);

-- The settlement ledger: one row per player per sealed trade, from that
-- player's side. seq counts up from 1 per owner, written under the owner's
-- account lock. Nothing deletes from it but the owner's account going.
create table if not exists public.trade_ledger (
  owner uuid not null references auth.users (id) on delete cascade,
  seq bigint not null check (seq > 0),
  trade_id uuid not null,
  kind text not null check (kind in ('curio', 'resident')),
  role text not null check (role in ('from', 'to')),
  partner_name text not null default '',
  curios_out jsonb not null default '[]'::jsonb,
  curios_in jsonb not null default '[]'::jsonb,
  resident_out jsonb,
  resident_in jsonb,
  settled_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  primary key (owner, seq),
  constraint trade_ledger_once unique (owner, trade_id),
  constraint trade_ledger_size check (resident_in is null or octet_length(resident_in::text) < 150000)
);

-- Answers (accept, decline, cancel), for their rate limit.
create table if not exists private.trade_answers (
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now()
);
create index if not exists trade_answers_user on private.trade_answers (user_id, at);
revoke all on table private.trade_answers from public, anon, authenticated;

alter table public.trades enable row level security;
alter table public.trade_ledger enable row level security;
alter table public.trade_items enable row level security;
alter table public.trade_books enable row level security;

revoke all on table public.trades, public.trade_items, public.trade_books, public.trade_ledger from public, anon, authenticated;

-- Nothing is granted, so these only matter if a grant is ever added by hand.
drop policy if exists "trades are for the two players in them" on public.trades;
create policy "trades are for the two players in them" on public.trades
  for select to authenticated using ((select auth.uid()) in (from_user, to_user));
drop policy if exists "trade items are for the two players in the trade" on public.trade_items;
create policy "trade items are for the two players in the trade" on public.trade_items
  for select to authenticated using (exists (
    select 1 from public.trades t where t.id = trade_items.trade_id and (select auth.uid()) in (t.from_user, t.to_user)));
drop policy if exists "the trade ledger is for its owner" on public.trade_ledger;
create policy "the trade ledger is for its owner" on public.trade_ledger
  for select to authenticated using ((select auth.uid()) = owner);
drop policy if exists "trade books are for their owner" on public.trade_books;
create policy "trade books are for their owner" on public.trade_books
  for select to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Helpers (not callable from the API)
-- ---------------------------------------------------------------------------

-- Serialises one account's capped writes (count then insert), even before it
-- has a profile row. The same helper, byte for byte, is in every migration
-- that needs it, so each file loads on its own and the combined load agrees.
create or replace function private.lock_account(p_user uuid)
returns void
language sql
volatile
set search_path = public
as $$
  select pg_advisory_xact_lock(hashtextextended('shelf-account:' || coalesce(p_user::text, ''), 0));
$$;

-- Two accounts, always in the same order, so two callers cannot deadlock.
create or replace function private.lock_accounts(a uuid, b uuid)
returns void
language plpgsql
volatile
set search_path = public
as $$
begin
  perform private.lock_account(least(a, b));
  if a is distinct from b then perform private.lock_account(greatest(a, b)); end if;
end;
$$;
revoke all on function private.lock_account(uuid) from public;
revoke all on function private.lock_accounts(uuid, uuid) from public;

create or replace function private.trade_blocked(a uuid, b uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (select 1 from public.blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a));
$$;

-- Do not disturb, if the postbox migration added one: private.dnd_on when it
-- exists, otherwise a profiles column (a boolean `dnd` or a timestamp `dnd_until`).
-- Checked dynamically so this file never depends on 0003.
create or replace function private.trade_dnd(p_user uuid)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  quiet boolean := false;
begin
  -- The postbox migration (0003) keeps the switch in social_prefs behind private.dnd_on.
  if to_regprocedure('private.dnd_on(uuid)') is not null then
    execute 'select private.dnd_on($1)' into quiet using p_user;
    return coalesce(quiet, false);
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles'
             and column_name = 'dnd' and data_type = 'boolean') then
    execute 'select coalesce(dnd, false) from public.profiles where user_id = $1' into quiet using p_user;
  elsif exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles'
                and column_name = 'dnd_until' and data_type like 'timestamp%') then
    execute 'select coalesce(dnd_until > now(), false) from public.profiles where user_id = $1' into quiet using p_user;
  end if;
  return coalesce(quiet, false);
end;
$$;

-- Open offers past their week become 'expired' the next time either player looks.
create or replace function private.expire_trades(uid uuid)
returns void
language sql
set search_path = public
as $$
  update public.trades set status = 'expired', closed_at = expires_at
   where status = 'open' and expires_at <= now() and uid in (from_user, to_user);
$$;

-- [{ id, n }] with known-shaped ids, no repeats, at most 3 in all. Anything
-- else is refused rather than trimmed.
create or replace function private.trade_curios(p jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  out jsonb := '[]'::jsonb;
  item jsonb;
  total int := 0;
  seen text[] := '{}';
begin
  if p is null or p = 'null'::jsonb then return out; end if;
  if jsonb_typeof(p) <> 'array' or jsonb_array_length(p) > 3 then perform private.refuse('bad_trade'); end if;
  for item in select value from jsonb_array_elements(p) loop
    if jsonb_typeof(item) <> 'object' or jsonb_typeof(item -> 'id') is distinct from 'string'
       or (item ->> 'id') !~ '^[a-z0-9-]{1,40}$' or (item ->> 'id') = any(seen)
       or jsonb_typeof(item -> 'n') is distinct from 'number' or (item ->> 'n') !~ '^[1-3]$' then
      perform private.refuse('bad_trade');
    end if;
    seen := seen || (item ->> 'id');
    total := total + (item ->> 'n')::int;
    out := out || jsonb_build_array(jsonb_build_object('id', item ->> 'id', 'n', (item ->> 'n')::int));
  end loop;
  if total > 3 then perform private.refuse('bad_trade'); end if;
  return out;
end;
$$;

-- Whether a resident may leave this player's shelf now. Raises in_escrow (it is
-- already in one of their open offers), already_traded (this player handed it
-- over in a sealed trade) or too_soon (it arrived by trade under 7 days ago).
create or replace function private.trade_resident_ok(p_user uuid, p_ref text, p_except uuid default null)
returns void
language plpgsql
stable
set search_path = public
as $$
begin
  if exists (select 1 from public.trades t join public.trade_items i on i.trade_id = t.id
              where t.status = 'open' and t.from_user = p_user and i.side = 'from' and i.kind = 'resident' and i.ref = p_ref
                and t.id is distinct from p_except) then
    perform private.refuse('in_escrow');
  end if;
  if exists (select 1 from public.trades t join public.trade_items i on i.trade_id = t.id
              where t.status = 'accepted' and i.kind = 'resident' and i.ref = p_ref
                and ((t.from_user = p_user and i.side = 'from') or (t.to_user = p_user and i.side = 'to')))
     or exists (select 1 from public.trade_ledger l where l.owner = p_user and l.resident_out ->> 'id' = p_ref) then
    perform private.refuse('already_traded');
  end if;
  if p_ref ~ '^tr-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and exists (
       select 1 from public.trades t where t.id = substr(p_ref, 4)::uuid and t.status = 'accepted'
          and p_user in (t.from_user, t.to_user) and t.closed_at > now() - interval '7 days') then
    perform private.refuse('too_soon');
  end if;
end;
$$;

-- Resident trades sealed by this player in the last 7 days, plus the resident
-- offers they have waiting. At most 2.
create or replace function private.resident_trades(p_user uuid)
returns int
language sql
stable
set search_path = public
as $$
  select (select count(*) from public.trades where kind = 'resident' and status = 'accepted'
            and p_user in (from_user, to_user) and closed_at > now() - interval '7 days')::int
       + (select count(*) from public.trades where kind = 'resident' and status = 'open' and from_user = p_user)::int;
$$;

-- A resident snapshot: an object with a usable id and a name, under the cap.
create or replace function private.trade_resident(p jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
begin
  if p is null or p = 'null'::jsonb then return null; end if;
  if jsonb_typeof(p) <> 'object' or jsonb_typeof(p -> 'id') is distinct from 'string'
     or (p ->> 'id') !~ '^[a-zA-Z0-9_-]{1,100}$' or jsonb_typeof(p -> 'name') is distinct from 'string' then
    perform private.refuse('bad_trade');
  end if;
  if octet_length(p::text) >= 150000 then perform private.refuse('too_large'); end if;
  return p;
end;
$$;

-- Whether uid can give `p_items` ([{ id, n }]) on top of everything already
-- promised. p_have is { seq, curios: { id: copies } }, what the client's save
-- holds as of ledger entry `seq`. Taken off: curios in uid's open offers (any
-- device; p_except leaves one offer out) and curios that left in ledger
-- entries after `seq`, which that save has not applied yet. The last copy
-- stays. The caller holds uid's account lock, so two calls cannot both spend
-- the same copies.
create or replace function private.trade_holdings_ok(uid uuid, p_have jsonb, p_items jsonb, p_except uuid default null)
returns void
language plpgsql
set search_path = public
as $$
declare
  item jsonb;
  after bigint;
  have int;
  promised int;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then return; end if;
  if p_have is null or jsonb_typeof(p_have) <> 'object' or jsonb_typeof(p_have -> 'curios') is distinct from 'object'
     or jsonb_typeof(p_have -> 'seq') is distinct from 'number' or (p_have ->> 'seq') !~ '^[0-9]{1,15}$' then
    perform private.refuse('bad_trade');
  end if;
  after := least((p_have ->> 'seq')::bigint, (select coalesce(max(seq), 0) from public.trade_ledger where owner = uid));
  for item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(p_have -> 'curios' -> (item ->> 'id')) is distinct from 'number'
       or (p_have -> 'curios' ->> (item ->> 'id')) !~ '^[0-9]{1,4}$' then
      perform private.refuse('bad_trade');
    end if;
    have := (p_have -> 'curios' ->> (item ->> 'id'))::int;
    -- One statement, one snapshot: an offer sealed meanwhile is counted once,
    -- as open or as settled, never neither.
    select (select coalesce(sum(i.qty), 0) from public.trades t join public.trade_items i on i.trade_id = t.id
             where t.from_user = uid and t.status = 'open' and t.expires_at > now() and t.id is distinct from p_except
               and i.side = 'from' and i.kind = 'curio' and i.ref = item ->> 'id')
         + (select coalesce(sum((c ->> 'n')::int), 0) from public.trade_ledger l, jsonb_array_elements(l.curios_out) c
             where l.owner = uid and l.seq > after and c ->> 'id' = item ->> 'id')
      into promised;
    if have - 1 - promised < (item ->> 'n')::int then perform private.refuse('not_enough'); end if;
  end loop;
end;
$$;

-- Writes one player's side of a sealed trade to their ledger, once. The
-- caller holds p_owner's account lock, so seq is the next one.
create or replace function private.trade_ledger_write(p_owner uuid, t public.trades, p_role text)
returns bigint
language plpgsql
set search_path = public
as $$
declare
  mine text := p_role;
  theirs text := case p_role when 'from' then 'to' else 'from' end;
  next_seq bigint;
  existing bigint;
begin
  select seq into existing from public.trade_ledger where owner = p_owner and trade_id = t.id;
  if found then return existing; end if;
  select coalesce(max(seq), 0) + 1 into next_seq from public.trade_ledger where owner = p_owner;
  insert into public.trade_ledger (owner, seq, trade_id, kind, role, partner_name, curios_out, curios_in, resident_out, resident_in, settled_at)
  values (p_owner, next_seq, t.id, t.kind, p_role,
    coalesce((select display_name from public.profiles where user_id = case p_role when 'from' then t.to_user else t.from_user end), ''),
    coalesce((select jsonb_agg(jsonb_build_object('id', i.ref, 'n', i.qty) order by i.id) from public.trade_items i
               where i.trade_id = t.id and i.side = mine and i.kind = 'curio'), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('id', i.ref, 'n', i.qty) order by i.id) from public.trade_items i
               where i.trade_id = t.id and i.side = theirs and i.kind = 'curio'), '[]'::jsonb),
    (select jsonb_build_object('id', i.ref, 'name', coalesce(i.snapshot ->> 'name', '')) from public.trade_items i
      where i.trade_id = t.id and i.side = mine and i.kind = 'resident' limit 1),
    (select coalesce(i.snapshot, jsonb_build_object('id', i.ref, 'name', 'Someone')) || jsonb_build_object('id', i.ref) from public.trade_items i
      where i.trade_id = t.id and i.side = theirs and i.kind = 'resident' limit 1),
    coalesce(t.closed_at, now()));
  return next_seq;
end;
$$;

-- Both sides of a sealed trade. The caller holds both account locks.
create or replace function private.trade_settle(p_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  t public.trades%rowtype;
begin
  select * into t from public.trades where id = p_id and status = 'accepted';
  if not found then return; end if;
  perform private.trade_ledger_write(t.from_user, t, 'from');
  perform private.trade_ledger_write(t.to_user, t, 'to');
end;
$$;

-- Accepts, declines and cancels: 100 a day per player, counted and written
-- with the account locked.
create or replace function private.trade_answer_tick(uid uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  perform private.lock_account(uid);
  delete from private.trade_answers where user_id = uid and at < now() - interval '1 day';
  if (select count(*) from private.trade_answers where user_id = uid) >= 100 then perform private.refuse('rate_limited'); end if;
  insert into private.trade_answers (user_id) values (uid);
end;
$$;

-- One trade as the client reads it. Drawn art is left out unless `full`, so a
-- list of offers stays small; trade_payload fetches the rest.
create or replace function private.trade_json(p_id uuid, p_full boolean)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'id', t.id, 'from_user', t.from_user, 'to_user', t.to_user,
    'from_name', coalesce((select display_name from public.profiles where user_id = t.from_user), ''),
    'to_name', coalesce((select display_name from public.profiles where user_id = t.to_user), ''),
    'kind', t.kind, 'status', t.status, 'parent', t.parent, 'line', t.line,
    'created_at', t.created_at, 'expires_at', t.expires_at, 'closed_at', t.closed_at,
    'items', coalesce((select jsonb_agg(jsonb_build_object('side', i.side, 'kind', i.kind, 'ref', i.ref, 'qty', i.qty,
        'snapshot', case
          when i.snapshot is null or p_full then i.snapshot
          when jsonb_typeof(i.snapshot -> 'art') = 'object' and (i.snapshot -> 'art' -> 'creature') is null
            then jsonb_set(i.snapshot, '{art}', (i.snapshot -> 'art') - 'body')
          else i.snapshot end) order by i.side, i.id)
      from public.trade_items i where i.trade_id = t.id), '[]'::jsonb))
  from public.trades t where t.id = p_id;
$$;

-- Validates and stores a new offer from uid. Shared by propose and counter.
drop function if exists private.trade_insert(uuid, uuid, jsonb, jsonb, text, uuid, text);
create or replace function private.trade_insert(uid uuid, p_to uuid, p_give jsonb, p_want jsonb, p_line text, p_parent uuid, p_kind text, p_have jsonb)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  want jsonb := coalesce(nullif(p_want, 'null'::jsonb), '{}'::jsonb);
  give_curios jsonb;
  want_curios jsonb;
  give_resident jsonb;
  want_resident jsonb;
  v_kind text;
  new_id uuid;
  item jsonb;
begin
  if p_to is null or p_to = uid or not private.are_friends(uid, p_to) or private.trade_blocked(uid, p_to) then
    perform private.refuse('not_friends');
  end if;
  if private.trade_dnd(p_to) then perform private.refuse('dnd'); end if;
  if p_give is null or jsonb_typeof(p_give) <> 'object' or jsonb_typeof(want) <> 'object' or coalesce(p_line, '') !~ '^[a-z0-9-]{0,40}$' then
    perform private.refuse('bad_trade');
  end if;
  give_curios := private.trade_curios(p_give -> 'curios');
  want_curios := private.trade_curios(want -> 'curios');
  give_resident := private.trade_resident(p_give -> 'resident');
  want_resident := private.trade_resident(want -> 'resident');
  if want_resident is not null then
    want_resident := jsonb_build_object('id', want_resident ->> 'id', 'name', left(want_resident ->> 'name', 22));
  end if;
  if give_resident is not null or want_resident is not null then
    -- A resident moves on its own: one each way at most, and the sender gives one.
    if give_resident is null or jsonb_array_length(give_curios) > 0 or jsonb_array_length(want_curios) > 0 then
      perform private.refuse('bad_trade');
    end if;
    v_kind := 'resident';
  else
    if jsonb_array_length(give_curios) = 0 then perform private.refuse('bad_trade'); end if;
    v_kind := 'curio';
  end if;
  if p_kind is not null and p_kind <> v_kind then perform private.refuse('bad_trade'); end if;

  -- One decision at a time per player (escrow, reservations, limits), and per pair (open offers).
  perform private.lock_account(uid);
  perform 1 from public.friendships
   where least(requester, addressee) = least(uid, p_to) and greatest(requester, addressee) = greatest(uid, p_to)
   for update;
  if (select count(*) from public.trades where from_user = uid and created_at > now() - interval '1 day') >= 20 then
    perform private.refuse('rate_limited');
  end if;
  if (select count(*) from public.trades where status = 'open'
        and ((from_user = uid and to_user = p_to) or (from_user = p_to and to_user = uid))) >= 5 then
    perform private.refuse('too_many_open');
  end if;
  if v_kind = 'resident' then
    perform private.trade_resident_ok(uid, give_resident ->> 'id');
    if private.resident_trades(uid) >= 2 then perform private.refuse('resident_limit'); end if;
  end if;
  perform private.trade_holdings_ok(uid, p_have, give_curios);

  insert into public.trades (from_user, to_user, kind, parent, line)
  values (uid, p_to, v_kind, p_parent, coalesce(p_line, ''))
  returning id into new_id;
  for item in select value from jsonb_array_elements(give_curios) loop
    insert into public.trade_items (trade_id, side, kind, ref, qty) values (new_id, 'from', 'curio', item ->> 'id', (item ->> 'n')::int);
  end loop;
  for item in select value from jsonb_array_elements(want_curios) loop
    insert into public.trade_items (trade_id, side, kind, ref, qty) values (new_id, 'to', 'curio', item ->> 'id', (item ->> 'n')::int);
  end loop;
  if give_resident is not null then
    insert into public.trade_items (trade_id, side, kind, ref, snapshot) values (new_id, 'from', 'resident', give_resident ->> 'id', give_resident);
  end if;
  if want_resident is not null then
    insert into public.trade_items (trade_id, side, kind, ref, snapshot) values (new_id, 'to', 'resident', want_resident ->> 'id', want_resident);
  end if;
  return new_id;
end;
$$;

-- Blocking or unfriending tears up the offers waiting between the two.
-- Sealed trades stay, so each side can still finish applying them.
create or replace function private.trades_on_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.trades set status = 'cancelled', closed_at = now()
   where status = 'open' and ((from_user = new.blocker and to_user = new.blocked) or (from_user = new.blocked and to_user = new.blocker));
  return new;
end;
$$;
create or replace function private.trades_on_unfriend()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.trades set status = 'cancelled', closed_at = now()
   where status = 'open' and ((from_user = old.requester and to_user = old.addressee) or (from_user = old.addressee and to_user = old.requester));
  return old;
end;
$$;
drop trigger if exists trades_on_block on public.blocks;
create trigger trades_on_block after insert on public.blocks for each row execute function private.trades_on_block();
drop trigger if exists trades_on_unfriend on public.friendships;
create trigger trades_on_unfriend after delete on public.friendships for each row execute function private.trades_on_unfriend();

revoke all on function private.trade_blocked(uuid, uuid) from public;
revoke all on function private.trade_dnd(uuid) from public;
revoke all on function private.expire_trades(uuid) from public;
revoke all on function private.trade_curios(jsonb) from public;
revoke all on function private.trade_resident_ok(uuid, text, uuid) from public;
revoke all on function private.resident_trades(uuid) from public;
revoke all on function private.trade_resident(jsonb) from public;
revoke all on function private.trade_json(uuid, boolean) from public;
revoke all on function private.trade_insert(uuid, uuid, jsonb, jsonb, text, uuid, text, jsonb) from public;
revoke all on function private.trade_holdings_ok(uuid, jsonb, jsonb, uuid) from public;
revoke all on function private.trade_ledger_write(uuid, public.trades, text) from public;
revoke all on function private.trade_settle(uuid) from public;
revoke all on function private.trade_answer_tick(uuid) from public;
revoke all on function private.trades_on_block() from public;
revoke all on function private.trades_on_unfriend() from public;

-- ---------------------------------------------------------------------------
-- Offers
-- ---------------------------------------------------------------------------

-- Answers the new offer, as list_trades shows it. p_have declares the
-- offered curios as the save holds them (see Reservations, above).
drop function if exists public.propose_trade(uuid, jsonb, jsonb, text);
create or replace function public.propose_trade(p_to uuid, p_give jsonb, p_want jsonb, p_line text default '', p_have jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  new_id uuid;
begin
  -- Every call that takes an account lock takes it before any row lock.
  perform private.lock_account(uid);
  perform private.expire_trades(uid);
  -- Two statements, so trade_json (stable) reads the rows the insert wrote.
  new_id := private.trade_insert(uid, p_to, p_give, p_want, p_line, null, null, p_have);
  return private.trade_json(new_id, false);
end;
$$;

-- The receiver answers an offer with one of their own, once. The original
-- closes as 'countered' (its escrow is released) and the counter is a new
-- offer the other way, of the same kind, which cannot itself be countered.
drop function if exists public.counter_trade(uuid, jsonb, jsonb, text);
create or replace function public.counter_trade(p_id uuid, p_give jsonb, p_want jsonb, p_line text default '', p_have jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  t public.trades%rowtype;
  new_id uuid;
begin
  -- Account locks first, then rows, as in accept_trade, so the two never deadlock.
  perform private.lock_account(uid);
  perform private.expire_trades(uid);
  select * into t from public.trades where id = p_id and to_user = uid for update;
  if not found then perform private.refuse('not_found'); end if;
  if t.status = 'expired' then perform private.refuse('expired'); end if;
  if t.status <> 'open' then perform private.refuse('not_open'); end if;
  if t.parent is not null then perform private.refuse('no_counter'); end if;
  update public.trades set status = 'countered', closed_at = now() where id = t.id;
  new_id := private.trade_insert(uid, t.from_user, p_give, p_want, p_line, t.id, t.kind, p_have);
  return private.trade_json(new_id, false);
end;
$$;

-- The atomic step. The row is locked, so of two accepts, or an accept and a
-- cancel, exactly one wins and the other is refused with not_open. For a swap
-- the receiver sends their resident's snapshot in p_give.resident; it must be
-- the one the offer asked for. When the offer asks for curios, p_have declares
-- them as the receiver's save holds them. Sealing writes both ledger rows in
-- the same transaction. Answers the whole trade, art included, plus
-- ledger_seq: the caller's ledger entry for it.
drop function if exists public.accept_trade(uuid, jsonb);
create or replace function public.accept_trade(p_id uuid, p_give jsonb default '{}'::jsonb, p_have jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  t public.trades%rowtype;
  wanted public.trade_items%rowtype;
  mine jsonb;
  partner uuid;
  my_seq bigint;
begin
  -- Both accounts, in a fixed order, before any row: reservations on either
  -- side and both ledgers move together.
  select from_user into partner from public.trades where id = p_id and to_user = uid;
  if not found then perform private.refuse('not_found'); end if;
  perform private.lock_accounts(uid, partner);
  perform private.trade_answer_tick(uid);
  perform private.expire_trades(uid);
  select * into t from public.trades where id = p_id and to_user = uid for update;
  if not found then perform private.refuse('not_found'); end if;
  if t.status = 'expired' then perform private.refuse('expired'); end if;
  if t.status <> 'open' then perform private.refuse('not_open'); end if;
  if not private.are_friends(uid, t.from_user) or private.trade_blocked(uid, t.from_user) then perform private.refuse('not_friends'); end if;
  if t.kind = 'resident' then
    if private.resident_trades(uid) >= 2 then perform private.refuse('resident_limit'); end if;
    select * into wanted from public.trade_items where trade_id = t.id and side = 'to' and kind = 'resident';
    if found then
      if p_give is null or jsonb_typeof(p_give) <> 'object' then perform private.refuse('bad_trade'); end if;
      mine := private.trade_resident(p_give -> 'resident');
      if mine is null or mine ->> 'id' <> wanted.ref then perform private.refuse('bad_trade'); end if;
      perform private.trade_resident_ok(uid, wanted.ref);
      update public.trade_items set snapshot = mine where id = wanted.id;
    end if;
  end if;
  perform private.trade_holdings_ok(uid, p_have, coalesce((select jsonb_agg(jsonb_build_object('id', i.ref, 'n', i.qty) order by i.id)
    from public.trade_items i where i.trade_id = t.id and i.side = 'to' and i.kind = 'curio'), '[]'::jsonb));
  update public.trades set status = 'accepted', closed_at = now() where id = t.id;
  perform private.trade_settle(t.id);
  select seq into my_seq from public.trade_ledger where owner = uid and trade_id = t.id;
  if to_regprocedure('private.bump_friendship(uuid,uuid,text)') is not null then
    execute 'select private.bump_friendship($1, $2, $3)' using t.from_user, t.to_user, 'trade';
  end if;
  return private.trade_json(t.id, true) || jsonb_build_object('ledger_seq', my_seq);
end;
$$;

create or replace function public.decline_trade(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  t public.trades%rowtype;
begin
  perform private.trade_answer_tick(uid);
  perform private.expire_trades(uid);
  select * into t from public.trades where id = p_id and to_user = uid for update;
  if not found then perform private.refuse('not_found'); end if;
  if t.status <> 'open' then perform private.refuse('not_open'); end if;
  update public.trades set status = 'declined', closed_at = now() where id = t.id;
  return jsonb_build_object('ok', true, 'id', t.id, 'status', 'declined');
end;
$$;

create or replace function public.cancel_trade(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  t public.trades%rowtype;
begin
  perform private.trade_answer_tick(uid);
  perform private.expire_trades(uid);
  select * into t from public.trades where id = p_id and from_user = uid for update;
  if not found then perform private.refuse('not_found'); end if;
  if t.status <> 'open' then perform private.refuse('not_open'); end if;
  update public.trades set status = 'cancelled', closed_at = now() where id = t.id;
  return jsonb_build_object('ok', true, 'id', t.id, 'status', 'cancelled');
end;
$$;

-- { now, count, trades } for the postbox and for applying sealed trades:
-- every open offer either way, everything closed in the last 60 days, and
-- any of p_ids (the caller's escrowed offers, 50 at most) whatever their age.
-- An id in p_ids that is not in the answer no longer exists. `count` is the
-- open offers waiting for the caller.
create or replace function public.list_trades(p_ids uuid[] default '{}')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  wanted uuid[] := coalesce(p_ids, '{}');
begin
  if cardinality(wanted) > 50 then perform private.refuse('bad_trade'); end if;
  perform private.expire_trades(uid);
  delete from public.trades where uid in (from_user, to_user) and status in ('declined', 'cancelled', 'countered', 'expired')
     and closed_at < now() - interval '30 days';
  delete from public.trades where uid in (from_user, to_user) and status = 'accepted' and closed_at < now() - interval '400 days';
  update public.trade_items i set snapshot = null from public.trades t
   where i.trade_id = t.id and uid in (t.from_user, t.to_user) and t.status = 'accepted'
     and t.closed_at < now() - interval '90 days' and i.snapshot is not null;
  return jsonb_build_object(
    'now', now(),
    'count', (select count(*) from public.trades where to_user = uid and status = 'open'),
    'trades', coalesce((select jsonb_agg(private.trade_json(x.id, false) order by x.at desc, x.id)
      from (select t.id, coalesce(t.closed_at, t.created_at) as at from public.trades t
             where uid in (t.from_user, t.to_user)
               and (t.id = any(wanted) or t.id in (
                 select r.id from public.trades r
                  where uid in (r.from_user, r.to_user) and (r.status = 'open' or r.closed_at > now() - interval '60 days')
                  order by coalesce(r.closed_at, r.created_at) desc limit 100))) x), '[]'::jsonb));
end;
$$;

-- One trade with its art: an open offer (to preview what would arrive) or a
-- sealed trade (to apply it). Only the two players in it may fetch it.
create or replace function public.trade_payload(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
begin
  if not exists (select 1 from public.trades where id = p_id and uid in (from_user, to_user) and status in ('open', 'accepted')) then
    perform private.refuse('not_found');
  end if;
  return private.trade_json(p_id, true);
end;
$$;

-- The caller's settled trades after a cursor, oldest first:
--   { now, head, next, more, effects: [{ seq, trade_id, kind, role,
--     partner_name, settled_at, curios_out, curios_in, resident_out,
--     resident_in }] }
-- curios_* are [{ id, n }] from the caller's side; resident_out is { id, name }
-- of the caller's resident that left, resident_in the full snapshot of the one
-- that arrived (art included). `head` is the newest seq, `next` the cursor to
-- ask from next (the last seq here, or p_after when there is nothing), `more`
-- whether anything is left after it. p_limit is 1 to 50.
create or replace function public.trade_ledger(p_after bigint default 0, p_limit int default 25)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  head bigint;
  page jsonb;
  last_seq bigint;
begin
  if p_after is null or p_after < 0 or p_limit is null or p_limit < 1 or p_limit > 50 then perform private.refuse('bad_trade'); end if;
  select coalesce(max(seq), 0) into head from public.trade_ledger where owner = uid;
  select coalesce(jsonb_agg(jsonb_build_object('seq', l.seq, 'trade_id', l.trade_id, 'kind', l.kind, 'role', l.role,
           'partner_name', l.partner_name, 'settled_at', l.settled_at, 'curios_out', l.curios_out, 'curios_in', l.curios_in,
           'resident_out', l.resident_out, 'resident_in', l.resident_in) order by l.seq), '[]'::jsonb), max(l.seq)
    into page, last_seq
    from (select * from public.trade_ledger where owner = uid and seq > p_after order by seq limit p_limit) l;
  last_seq := coalesce(last_seq, least(p_after, head));
  return jsonb_build_object('now', now(), 'head', head, 'next', last_seq, 'more', last_seq < head, 'effects', page);
end;
$$;

-- ---------------------------------------------------------------------------
-- The trading book: a wishlist (12 curio ids at most) and spares
-- ({ curio id: how many spare, 1 to 99 }, 60 entries at most).
-- ---------------------------------------------------------------------------

create or replace function public.publish_trade_book(p_wishlist jsonb, p_spares jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  last timestamptz;
  entry record;
begin
  if p_wishlist is null or jsonb_typeof(p_wishlist) <> 'array' or jsonb_array_length(p_wishlist) > 12
     or exists (select 1 from jsonb_array_elements(p_wishlist) w where jsonb_typeof(w.value) <> 'string' or (w.value #>> '{}') !~ '^[a-z0-9-]{1,40}$')
     or (select count(distinct w.value) from jsonb_array_elements(p_wishlist) w) <> jsonb_array_length(p_wishlist) then
    perform private.refuse('bad_trade');
  end if;
  if p_spares is null or jsonb_typeof(p_spares) <> 'object' or (select count(*) from jsonb_object_keys(p_spares)) > 60 then
    perform private.refuse('bad_trade');
  end if;
  for entry in select key, value from jsonb_each(p_spares) loop
    if entry.key !~ '^[a-z0-9-]{1,40}$' or jsonb_typeof(entry.value) <> 'number' or (entry.value #>> '{}') !~ '^[1-9][0-9]?$' then
      perform private.refuse('bad_trade');
    end if;
  end loop;
  -- Writing the same small row over and over is pointless: once every 5 seconds,
  -- with the account locked so a first write and a second cannot both get in.
  perform private.lock_account(uid);
  select updated_at into last from public.trade_books where user_id = uid for update;
  if last is not null and last > now() - interval '5 seconds' then
    return jsonb_build_object('ok', true, 'skipped', true);
  end if;
  insert into public.trade_books (user_id, wishlist, spares, updated_at) values (uid, p_wishlist, p_spares, now())
  on conflict (user_id) do update set wishlist = excluded.wishlist, spares = excluded.spares, updated_at = excluded.updated_at;
  return jsonb_build_object('ok', true);
end;
$$;

-- A friend's book, or null when they have not published one.
create or replace function public.get_trade_book(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
begin
  if p_user is null or (p_user <> uid and (not private.are_friends(uid, p_user) or private.trade_blocked(uid, p_user))) then
    perform private.refuse('not_friends');
  end if;
  return (select jsonb_build_object('user_id', b.user_id, 'wishlist', b.wishlist, 'spares', b.spares, 'updated_at', b.updated_at)
    from public.trade_books b where b.user_id = p_user);
end;
$$;

-- ---------------------------------------------------------------------------
-- Who may call what: signed-in players (anonymous ones included), nobody else.
-- ---------------------------------------------------------------------------

revoke all on function public.propose_trade(uuid, jsonb, jsonb, text, jsonb) from public, anon, authenticated;
revoke all on function public.counter_trade(uuid, jsonb, jsonb, text, jsonb) from public, anon, authenticated;
revoke all on function public.accept_trade(uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.decline_trade(uuid) from public, anon, authenticated;
revoke all on function public.cancel_trade(uuid) from public, anon, authenticated;
revoke all on function public.list_trades(uuid[]) from public, anon, authenticated;
revoke all on function public.trade_payload(uuid) from public, anon, authenticated;
revoke all on function public.trade_ledger(bigint, int) from public, anon, authenticated;
revoke all on function public.publish_trade_book(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.get_trade_book(uuid) from public, anon, authenticated;

grant execute on function public.propose_trade(uuid, jsonb, jsonb, text, jsonb) to authenticated;
grant execute on function public.counter_trade(uuid, jsonb, jsonb, text, jsonb) to authenticated;
grant execute on function public.accept_trade(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.decline_trade(uuid) to authenticated;
grant execute on function public.cancel_trade(uuid) to authenticated;
grant execute on function public.list_trades(uuid[]) to authenticated;
grant execute on function public.trade_payload(uuid) to authenticated;
grant execute on function public.trade_ledger(bigint, int) to authenticated;
grant execute on function public.publish_trade_book(jsonb, jsonb) to authenticated;
grant execute on function public.get_trade_book(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Trades sealed before the ledger existed go into it once, in the order they
-- were sealed. A trade already there is skipped, so a second run adds nothing.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in select t.id from public.trades t where t.status = 'accepted'
             and (not exists (select 1 from public.trade_ledger l where l.owner = t.from_user and l.trade_id = t.id)
               or not exists (select 1 from public.trade_ledger l where l.owner = t.to_user and l.trade_id = t.id))
           order by t.closed_at, t.id loop
    perform private.trade_settle(r.id);
  end loop;
end;
$$;

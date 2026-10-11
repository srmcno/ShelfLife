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
--   expired, no_counter. src/cloud/trades.js turns tokens into copy.
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
-- resident snapshot. Accepting is one transaction on a locked row: the
-- receiver's half (a resident snapshot, for a swap) is written and the offer
-- becomes 'accepted', or nothing happens. Each side then applies the trade
-- once, by its id. Declining, cancelling, countering, blocking, unfriending
-- and the 7 day expiry all release escrow.
--
-- Housekeeping runs inside list_trades for the caller's own rows: closed
-- offers that never happened go after 30 days, accepted trades lose their
-- snapshots after 90 days and go entirely after 400. For the SQL editor:
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

alter table public.trades enable row level security;
alter table public.trade_items enable row level security;
alter table public.trade_books enable row level security;

revoke all on table public.trades, public.trade_items, public.trade_books from public, anon, authenticated;

-- Nothing is granted, so these only matter if a grant is ever added by hand.
drop policy if exists "trades are for the two players in them" on public.trades;
create policy "trades are for the two players in them" on public.trades
  for select to authenticated using ((select auth.uid()) in (from_user, to_user));
drop policy if exists "trade items are for the two players in the trade" on public.trade_items;
create policy "trade items are for the two players in the trade" on public.trade_items
  for select to authenticated using (exists (
    select 1 from public.trades t where t.id = trade_items.trade_id and (select auth.uid()) in (t.from_user, t.to_user)));
drop policy if exists "trade books are for their owner" on public.trade_books;
create policy "trade books are for their owner" on public.trade_books
  for select to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Helpers (not callable from the API)
-- ---------------------------------------------------------------------------

create or replace function private.trade_blocked(a uuid, b uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (select 1 from public.blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a));
$$;

-- Do not disturb, if the postbox migration added one. Checked by column so
-- this file never depends on it: a boolean `dnd` or a timestamp `dnd_until`.
create or replace function private.trade_dnd(p_user uuid)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  quiet boolean := false;
begin
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
                and ((t.from_user = p_user and i.side = 'from') or (t.to_user = p_user and i.side = 'to'))) then
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
create or replace function private.trade_insert(uid uuid, p_to uuid, p_give jsonb, p_want jsonb, p_line text, p_parent uuid, p_kind text)
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

  -- One decision at a time per player (escrow, limits), and per pair (open offers).
  perform 1 from public.profiles where user_id = uid for update;
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
revoke all on function private.trade_insert(uuid, uuid, jsonb, jsonb, text, uuid, text) from public;
revoke all on function private.trades_on_block() from public;
revoke all on function private.trades_on_unfriend() from public;

-- ---------------------------------------------------------------------------
-- Offers
-- ---------------------------------------------------------------------------

-- Answers the new offer, as list_trades shows it.
create or replace function public.propose_trade(p_to uuid, p_give jsonb, p_want jsonb, p_line text default '')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  new_id uuid;
begin
  perform private.expire_trades(uid);
  -- Two statements, so trade_json (stable) reads the rows the insert wrote.
  new_id := private.trade_insert(uid, p_to, p_give, p_want, p_line, null, null);
  return private.trade_json(new_id, false);
end;
$$;

-- The receiver answers an offer with one of their own, once. The original
-- closes as 'countered' (its escrow is released) and the counter is a new
-- offer the other way, of the same kind, which cannot itself be countered.
create or replace function public.counter_trade(p_id uuid, p_give jsonb, p_want jsonb, p_line text default '')
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
  perform private.expire_trades(uid);
  -- The same lock order as accept_trade (player, then offer), so the two never deadlock.
  perform 1 from public.profiles where user_id = uid for update;
  select * into t from public.trades where id = p_id and to_user = uid for update;
  if not found then perform private.refuse('not_found'); end if;
  if t.status = 'expired' then perform private.refuse('expired'); end if;
  if t.status <> 'open' then perform private.refuse('not_open'); end if;
  if t.parent is not null then perform private.refuse('no_counter'); end if;
  update public.trades set status = 'countered', closed_at = now() where id = t.id;
  new_id := private.trade_insert(uid, t.from_user, p_give, p_want, p_line, t.id, t.kind);
  return private.trade_json(new_id, false);
end;
$$;

-- The atomic step. The row is locked, so of two accepts, or an accept and a
-- cancel, exactly one wins and the other is refused with not_open. For a swap
-- the receiver sends their resident's snapshot in p_give.resident; it must be
-- the one the offer asked for. Answers the whole trade, art included.
create or replace function public.accept_trade(p_id uuid, p_give jsonb default '{}'::jsonb)
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
begin
  perform private.expire_trades(uid);
  perform 1 from public.profiles where user_id = uid for update;
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
  update public.trades set status = 'accepted', closed_at = now() where id = t.id;
  if to_regprocedure('private.bump_friendship(uuid,uuid,text)') is not null then
    execute 'select private.bump_friendship($1, $2, $3)' using t.from_user, t.to_user, 'trade';
  end if;
  return private.trade_json(t.id, true);
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
  -- Writing the same small row over and over is pointless: once every 5 seconds.
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

revoke all on function public.propose_trade(uuid, jsonb, jsonb, text) from public, anon, authenticated;
revoke all on function public.counter_trade(uuid, jsonb, jsonb, text) from public, anon, authenticated;
revoke all on function public.accept_trade(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.decline_trade(uuid) from public, anon, authenticated;
revoke all on function public.cancel_trade(uuid) from public, anon, authenticated;
revoke all on function public.list_trades(uuid[]) from public, anon, authenticated;
revoke all on function public.trade_payload(uuid) from public, anon, authenticated;
revoke all on function public.publish_trade_book(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.get_trade_book(uuid) from public, anon, authenticated;

grant execute on function public.propose_trade(uuid, jsonb, jsonb, text) to authenticated;
grant execute on function public.counter_trade(uuid, jsonb, jsonb, text) to authenticated;
grant execute on function public.accept_trade(uuid, jsonb) to authenticated;
grant execute on function public.decline_trade(uuid) to authenticated;
grant execute on function public.cancel_trade(uuid) to authenticated;
grant execute on function public.list_trades(uuid[]) to authenticated;
grant execute on function public.trade_payload(uuid) to authenticated;
grant execute on function public.publish_trade_book(jsonb, jsonb) to authenticated;
grant execute on function public.get_trade_book(uuid) to authenticated;

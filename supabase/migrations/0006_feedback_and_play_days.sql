-- Shelf Life: feedback from players, "how is it going?" check-ins, and the
-- days people play (for retention numbers, counted only with consent).
--
-- Run after 0002_social.sql. Safe to run more than once, and it follows the
-- same rules as 0001 and 0002:
--   * every table hangs off auth.users on delete cascade, so
--     delete_my_account() removes all of it without being edited;
--   * row level security is on everywhere and nobody writes a table directly.
--     Every write is a security definer function that starts from
--     private.require_user();
--   * nothing here can be read through the API at all. There are no select
--     grants and no policies on either table. The project owner reads them in
--     the Supabase dashboard (Table Editor, or the SQL editor with the queries
--     in README.md), which does not go through the API.
--
-- Refusals raise errcode P0001 with a short token as the message, as in 0002:
--   bad_feedback, bad_kind, too_large, rate_limited, bad_day.
-- src/cloud/feedback.js turns tokens into copy.
--
-- What a report holds (src/diagnostics.js builds `diagnostics`):
--   kind        'bug' | 'confusing' | 'idea' | 'love' | 'pulse'
--   body        what the player typed, 1000 characters at most
--   doing       what they were doing, a short token such as 'court' or ''
--   rating      1 to 5, for kind 'pulse' only
--   moment      'day2' | 'court' | 'day7', for kind 'pulse' only
--   diagnostics a json object under 16 KB: version, platform, screen, effects,
--               residents, save size, the open sheet, online and cloud state,
--               and the last 20 captured errors. Never the email, never the save.
--
-- Housekeeping happens as rows are written: feedback older than a year and
-- play days older than 400 days are removed. By hand, if ever needed:
--   delete from public.feedback where created_at < now() - interval '365 days';
--   delete from public.play_days where day < current_date - 400;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id text not null check (client_id ~ '^[a-z0-9-]{8,40}$'),
  kind text not null check (kind in ('bug', 'confusing', 'idea', 'love', 'pulse')),
  body text not null default '' check (char_length(body) <= 1000),
  doing text not null default '' check (doing ~ '^[a-z-]{0,24}$'),
  rating int check (rating between 1 and 5),
  moment text not null default '' check (moment in ('', 'day2', 'court', 'day7')),
  app_version text not null default '' check (char_length(app_version) <= 24),
  platform text not null default '' check (platform in ('', 'web', 'android')),
  diagnostics jsonb,
  created_at timestamptz not null default now(),
  constraint feedback_diagnostics_size check (diagnostics is null or octet_length(diagnostics::text) < 16000),
  constraint feedback_pulse_rating check ((kind = 'pulse') = (rating is not null))
);
-- The game sends each report with its own id, so a retry after a lost reply
-- is recognised instead of being filed twice.
create unique index if not exists feedback_client on public.feedback (user_id, client_id);
create index if not exists feedback_newest on public.feedback (created_at desc);

-- One row per player per day they opened the game, and nothing else: no
-- times, no counts, no device. A player can switch it off in More.
create table if not exists public.play_days (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);
create index if not exists play_days_day on public.play_days (day);

-- Players who switched the day count off. Their switch covers every day count
-- the game keeps (play_days here, and active_days for coven invite rewards in
-- 0008): forget_play_days erases both and records this. Only resume_play_days,
-- called when the player actively switches it on, clears it; passive marks from
-- any device are refused while it stands.
create table if not exists private.play_day_optouts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  at timestamptz not null default now()
);
alter table private.play_day_optouts enable row level security;
revoke all on table private.play_day_optouts from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row level security: on, with no policies and no grants. Nobody reads or
-- writes these through the API; the functions below are the only way in.
-- ---------------------------------------------------------------------------

alter table public.feedback enable row level security;
alter table public.play_days enable row level security;

revoke all on table public.feedback, public.play_days from public, anon, authenticated;

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

-- Like private.clean_text, but a report may keep its line breaks: other
-- control characters become spaces, runs of blank lines shrink to one.
create or replace function private.clean_note(value text, max_length int)
returns text
language sql
immutable
set search_path = public
as $$
  select left(btrim(regexp_replace(regexp_replace(replace(coalesce(value, ''), E'\r', ''),
    E'[\\x01-\\x09\\x0B-\\x1F\\x7F]', ' ', 'g'), E'\n{3,}', E'\n\n', 'g'), E' \n'), max_length);
$$;

revoke all on function private.clean_note(text, int) from public;

-- ---------------------------------------------------------------------------
-- Feedback
-- ---------------------------------------------------------------------------

-- Ten a day per player. A report already filed under the same client id
-- answers { ok: true, duplicate: true } and does not count again.
create or replace function public.submit_feedback(
  p_client_id text, p_kind text, p_body text default '', p_doing text default '', p_rating int default null,
  p_moment text default '', p_version text default '', p_platform text default '', p_diagnostics jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  v_kind text := lower(coalesce(p_kind, ''));
  v_doing text := lower(coalesce(p_doing, ''));
  v_moment text := lower(coalesce(p_moment, ''));
  v_platform text := lower(coalesce(p_platform, ''));
begin
  -- One report at a time per account, so a burst cannot count past the cap.
  perform private.lock_account(uid);
  if p_client_id is null or p_client_id !~ '^[a-z0-9-]{8,40}$' then perform private.refuse('bad_feedback'); end if;
  if v_kind not in ('bug', 'confusing', 'idea', 'love', 'pulse') then perform private.refuse('bad_kind'); end if;
  if exists (select 1 from public.feedback where user_id = uid and client_id = p_client_id) then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;
  if (select count(*) from public.feedback where user_id = uid and created_at > now() - interval '1 day') >= 10 then
    perform private.refuse('rate_limited');
  end if;
  if char_length(coalesce(p_body, '')) > 4000 then perform private.refuse('too_large'); end if;
  if p_diagnostics is not null and (jsonb_typeof(p_diagnostics) <> 'object' or octet_length(p_diagnostics::text) >= 16000) then
    perform private.refuse('too_large');
  end if;
  if v_kind = 'pulse' then
    if p_rating is null or p_rating not between 1 and 5 or v_moment not in ('day2', 'court', 'day7') then
      perform private.refuse('bad_feedback');
    end if;
  elsif p_rating is not null or v_moment <> '' then
    perform private.refuse('bad_feedback');
  end if;
  if v_doing !~ '^[a-z-]{0,24}$' then v_doing := ''; end if;
  if v_platform not in ('web', 'android') then v_platform := ''; end if;
  insert into public.feedback (user_id, client_id, kind, body, doing, rating, moment, app_version, platform, diagnostics)
  values (uid, p_client_id, v_kind, private.clean_note(p_body, 1000), v_doing, p_rating, v_moment,
    private.clean_text(p_version, 24), v_platform, p_diagnostics);
  delete from public.feedback where created_at < now() - interval '365 days';
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Play days
-- ---------------------------------------------------------------------------

-- The player's own calendar date, which can only be today give or take the
-- time zones. Once a day per player, however often it is called.
create or replace function public.mark_play_day(p_day text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  d date := private.score_day(p_day);
  added boolean;
begin
  if abs(d - current_date) > 1 then perform private.refuse('bad_day'); end if;
  -- Forgetting, marking and resuming happen one at a time per player, so a mark
  -- already in flight (or from an older device) cannot slip past a switch-off.
  perform private.lock_account(uid);
  -- A passive mark never turns the count back on: only resume_play_days() does.
  if exists (select 1 from private.play_day_optouts where user_id = uid) then
    return jsonb_build_object('ok', true, 'counted', false, 'opted_out', true);
  end if;
  insert into public.play_days (user_id, day) values (uid, d) on conflict do nothing;
  added := found;
  delete from public.play_days where user_id = uid and day < current_date - 400;
  return jsonb_build_object('ok', true, 'counted', added);
end;
$$;

-- Switching the count off in More forgets the days already counted, here and
-- for coven invite rewards, and stops both counting until it is switched on.
create or replace function public.forget_play_days()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
  removed int;
begin
  perform private.lock_account(uid);
  delete from public.play_days where user_id = uid;
  get diagnostics removed = row_count;
  -- The same switch covers the days counted for coven invite rewards (0008), if that is installed.
  if to_regclass('public.active_days') is not null then
    execute 'delete from public.active_days where user_id = $1' using uid;
  end if;
  insert into private.play_day_optouts (user_id) values (uid)
  on conflict (user_id) do update set at = now();
  return jsonb_build_object('ok', true, 'removed', removed);
end;
$$;

-- Switching the count back on is an explicit act, made by the player in More,
-- never a side effect of opening the game. Nothing is restored: counting just
-- starts again from the next mark.
create or replace function public.resume_play_days()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := private.require_user();
begin
  perform private.lock_account(uid);
  delete from private.play_day_optouts where user_id = uid;
  return jsonb_build_object('ok', true, 'opted_out', false);
end;
$$;

-- ---------------------------------------------------------------------------
-- Who may call what: signed-in players (anonymous ones included), nobody else.
-- ---------------------------------------------------------------------------

revoke all on function public.submit_feedback(text, text, text, text, int, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.mark_play_day(text) from public, anon, authenticated;
revoke all on function public.forget_play_days() from public, anon, authenticated;
revoke all on function public.resume_play_days() from public, anon, authenticated;

grant execute on function public.submit_feedback(text, text, text, text, int, text, text, text, jsonb) to authenticated;
grant execute on function public.mark_play_day(text) to authenticated;
grant execute on function public.forget_play_days() to authenticated;
grant execute on function public.resume_play_days() to authenticated;

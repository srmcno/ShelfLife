-- Shelf Life: the Case of the Week. Safe to run more than once.
-- Every household hears the same Shelf Court case in a week (the game picks
-- it from the week number). A signed-in judge's ruling is counted once, and
-- anyone signed in may read the totals: how the whole neighbourhood ruled.
-- Only counts ever leave this table; nobody can see how another player ruled.

create table if not exists public.weekly_rulings (
  week int not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  case_id text not null check (case_id ~ '^[a-z0-9_-]{1,40}$'),
  verdict text not null check (verdict in ('plaintiff', 'defendant', 'both')),
  created_at timestamptz not null default now(),
  primary key (week, user_id)
);
create index if not exists weekly_rulings_case on public.weekly_rulings (week, case_id, verdict);

alter table public.weekly_rulings enable row level security;
revoke all on table public.weekly_rulings from public, anon, authenticated;

-- Weeks run Monday to Sunday in UTC, numbered from 1970 like the coven weeks.
create or replace function private.weekly_now()
returns int language sql stable set search_path = public as $$
  select (((now() at time zone 'utc')::date - date '1970-01-01') + 3) / 7;
$$;
revoke all on function private.weekly_now() from public, anon, authenticated;

create or replace function private.weekly_counts(p_week int, p_case text, p_user uuid)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object('week', p_week, 'case', p_case,
    'plaintiff', count(*) filter (where verdict = 'plaintiff'),
    'defendant', count(*) filter (where verdict = 'defendant'),
    'both', count(*) filter (where verdict = 'both'),
    'mine', (select verdict from public.weekly_rulings where week = p_week and user_id = p_user and case_id = p_case))
    from public.weekly_rulings where week = p_week and case_id = p_case;
$$;
revoke all on function private.weekly_counts(int, text, uuid) from public, anon, authenticated;

-- One ruling a week, and the first one stands: a rerun cannot change the record.
create or replace function public.weekly_rule(p_week int, p_case text, p_verdict text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := private.require_user();
begin
  if p_week is null or p_week <> private.weekly_now() then perform private.refuse('bad_week'); end if;
  if p_case is null or p_case !~ '^[a-z0-9_-]{1,40}$' or p_verdict is null or p_verdict not in ('plaintiff', 'defendant', 'both') then
    perform private.refuse('bad_ruling');
  end if;
  insert into public.weekly_rulings (week, user_id, case_id, verdict) values (p_week, uid, p_case, p_verdict)
  on conflict (week, user_id) do nothing;
  -- Old weeks are of no further interest to anyone.
  delete from public.weekly_rulings where week < private.weekly_now() - 8;
  return private.weekly_counts(p_week, p_case, uid);
end;
$$;

-- This week or last week only.
create or replace function public.weekly_tally(p_week int, p_case text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := private.require_user();
begin
  if p_week is null or p_week not between private.weekly_now() - 1 and private.weekly_now() then perform private.refuse('bad_week'); end if;
  if p_case is null or p_case !~ '^[a-z0-9_-]{1,40}$' then perform private.refuse('bad_ruling'); end if;
  return private.weekly_counts(p_week, p_case, uid);
end;
$$;

revoke all on function public.weekly_rule(int, text, text) from public, anon, authenticated;
revoke all on function public.weekly_tally(int, text) from public, anon, authenticated;
grant execute on function public.weekly_rule(int, text, text) to authenticated;
grant execute on function public.weekly_tally(int, text) to authenticated;

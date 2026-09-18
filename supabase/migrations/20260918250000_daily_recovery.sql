-- Device-synced daily recovery observations (HRV, RHR, sleep, stress).
-- These are raw-ish measurements. Potential computes recoveryΔ from the
-- athlete's own 7-day vs 28-day medians. Do not store vendor "Recovery %".

create table if not exists public.daily_recovery (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  source text not null default 'coros',
  resting_hr integer,
  sleep_hrv_ms double precision,
  sleep_minutes integer,
  sleep_score integer,
  stress_avg double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (athlete_id, date)
);

create index if not exists daily_recovery_athlete_date_idx
  on public.daily_recovery (athlete_id, date desc);

alter table public.daily_recovery enable row level security;

drop policy if exists "Athletes can read own daily recovery" on public.daily_recovery;
create policy "Athletes can read own daily recovery"
  on public.daily_recovery
  for select
  to authenticated
  using (athlete_id = auth.uid());

grant select on table public.daily_recovery to authenticated;

drop trigger if exists daily_recovery_set_updated_at on public.daily_recovery;
create trigger daily_recovery_set_updated_at
  before update on public.daily_recovery
  for each row execute function public.set_updated_at();

insert into public.daily_recovery (
  athlete_id,
  date,
  source,
  resting_hr,
  sleep_hrv_ms,
  sleep_minutes,
  stress_avg
)
select
  athlete_id,
  date,
  coalesce(nullif(source, ''), 'coros'),
  resting_hr,
  hrv_ms,
  sleep_minutes,
  stress
from public.wellness_days
on conflict (athlete_id, date) do nothing;

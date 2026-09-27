-- Vendor recovery observations resolve into daily_recovery.
-- Google Health is recovery-only: never write activities from this pipe.

alter table public.profiles
  add column if not exists recovery_source_preference jsonb not null default '{}'::jsonb;

create table if not exists public.recovery_observations (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  source text not null,
  payload jsonb not null default '{}'::jsonb,
  coverage text not null default 'partial'
    check (coverage in ('pending', 'partial', 'complete')),
  retrieved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (athlete_id, date, source)
);

create index if not exists recovery_observations_athlete_date_idx
  on public.recovery_observations (athlete_id, date desc);

alter table public.recovery_observations enable row level security;

drop policy if exists "Athletes can read own recovery observations" on public.recovery_observations;
create policy "Athletes can read own recovery observations"
  on public.recovery_observations
  for select
  to authenticated
  using (athlete_id = auth.uid());

grant select on table public.recovery_observations to authenticated;

drop trigger if exists recovery_observations_set_updated_at on public.recovery_observations;
create trigger recovery_observations_set_updated_at
  before update on public.recovery_observations
  for each row execute function public.set_updated_at();

alter table public.daily_recovery
  add column if not exists coverage text not null default 'partial'
    check (coverage in ('pending', 'partial', 'complete')),
  add column if not exists sleep_source text,
  add column if not exists hrv_source text,
  add column if not exists resting_hr_source text,
  add column if not exists respiratory_rate double precision,
  add column if not exists spo2_pct double precision,
  add column if not exists sleep_temperature_c double precision,
  add column if not exists sleep_temperature_baseline_c double precision,
  add column if not exists sleep_temperature_delta_c double precision,
  add column if not exists sleep_start timestamptz,
  add column if not exists sleep_end timestamptz;

-- Existing COROS rows become observations so Google can merge instead of overwrite.
insert into public.recovery_observations (
  athlete_id,
  date,
  source,
  payload,
  coverage,
  retrieved_at
)
select
  athlete_id,
  date,
  coalesce(nullif(source, ''), 'coros'),
  jsonb_strip_nulls(
    jsonb_build_object(
      'restingHrBpm', resting_hr,
      'hrvRmssdMs', sleep_hrv_ms,
      'sleep', jsonb_build_object('durationMinutes', sleep_minutes)
    )
  ),
  case
    when sleep_minutes is not null and sleep_hrv_ms is not null and resting_hr is not null
      then 'complete'
    when sleep_minutes is not null or sleep_hrv_ms is not null or resting_hr is not null
      then 'partial'
    else 'pending'
  end,
  updated_at
from public.daily_recovery
on conflict (athlete_id, date, source) do nothing;

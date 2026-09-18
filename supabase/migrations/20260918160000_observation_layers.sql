-- Observation layers: store what happened, derive what it means.
-- Vendor load/recovery/VO2 stay on activities.vendor only.

alter table public.activities
  add column if not exists subsport text,
  add column if not exists elapsed_seconds integer,
  add column if not exists moving_seconds integer,
  add column if not exists avg_speed_mps double precision,
  add column if not exists normalized_power integer,
  add column if not exists session_type text
    check (session_type is null or session_type in ('training', 'race', 'test')),
  add column if not exists session_importance text
    check (session_importance is null or session_importance in ('normal', 'priority'));

alter table public.activity_metrics
  add column if not exists hr_zone_seconds jsonb,
  add column if not exists training_mix jsonb;

create table if not exists public.activity_laps (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  source_index integer not null default 0,
  started_at timestamptz,
  duration_seconds integer,
  distance_m double precision,
  avg_hr integer,
  avg_power integer,
  created_at timestamptz not null default now(),
  unique (activity_id, source_index)
);

create index if not exists activity_laps_activity_idx on public.activity_laps (activity_id);

alter table public.activity_laps enable row level security;

create policy "Athletes can read own activity laps"
  on public.activity_laps
  for select
  to authenticated
  using (athlete_id = auth.uid());

grant select on table public.activity_laps to authenticated;

create table if not exists public.wellness_days (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  resting_hr integer,
  sleep_minutes integer,
  hrv_ms double precision,
  stress double precision,
  source text not null default 'coros',
  vendor jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (athlete_id, date)
);

create index if not exists wellness_days_athlete_date_idx
  on public.wellness_days (athlete_id, date desc);

alter table public.wellness_days enable row level security;

create policy "Athletes can read own wellness"
  on public.wellness_days
  for select
  to authenticated
  using (athlete_id = auth.uid());

grant select on table public.wellness_days to authenticated;

create table if not exists public.daily_loads (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  training_load double precision,
  fitness double precision,
  fatigue double precision,
  form double precision,
  aerobic_reserve double precision,
  specific_capacity double precision,
  acute_fatigue double precision,
  development double precision,
  potential double precision,
  race_readiness double precision,
  formula_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (athlete_id, date)
);

create index if not exists daily_loads_athlete_date_idx
  on public.daily_loads (athlete_id, date desc);

alter table public.daily_loads enable row level security;

create policy "Athletes can read own daily loads"
  on public.daily_loads
  for select
  to authenticated
  using (athlete_id = auth.uid());

grant select on table public.daily_loads to authenticated;

drop trigger if exists wellness_days_set_updated_at on public.wellness_days;
create trigger wellness_days_set_updated_at
  before update on public.wellness_days
  for each row execute function public.set_updated_at();

drop trigger if exists daily_loads_set_updated_at on public.daily_loads;
create trigger daily_loads_set_updated_at
  before update on public.daily_loads
  for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('activity-originals', 'activity-originals', false, 52428800),
  ('activity-streams', 'activity-streams', false, 20971520)
on conflict (id) do nothing;

drop policy if exists "Athletes read own activity originals" on storage.objects;
create policy "Athletes read own activity originals"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'activity-originals'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "Athletes read own activity streams" on storage.objects;
create policy "Athletes read own activity streams"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'activity-streams'
    and split_part(name, '/', 1) = auth.uid()::text
  );

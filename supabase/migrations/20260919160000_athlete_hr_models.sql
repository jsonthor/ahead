create table public.athlete_hr_models (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  hr_max integer not null check (hr_max >= 140 and hr_max <= 220),
  source text not null check (source in ('manual', 'provider_profile', 'observed')),
  confidence text not null check (confidence in ('high', 'moderate', 'low')),
  valid_from date not null,
  valid_to date,
  provider text,
  provider_value_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_to is null or valid_to > valid_from)
);

create index athlete_hr_models_athlete_valid_idx
  on public.athlete_hr_models (athlete_id, valid_from desc);

alter table public.athlete_hr_models enable row level security;
revoke all on table public.athlete_hr_models from anon, authenticated;
grant select on table public.athlete_hr_models to authenticated;
grant all on table public.athlete_hr_models to service_role;

create policy "Athletes can read own HR models"
  on public.athlete_hr_models for select to authenticated
  using (athlete_id = auth.uid());

create trigger athlete_hr_models_set_updated_at
  before update on public.athlete_hr_models
  for each row execute function public.set_updated_at();

alter table public.activity_metrics
  add column if not exists hr_model_max integer,
  add column if not exists hr_model_source text,
  add column if not exists hr_model_confidence text,
  add column if not exists hr_z1_max integer,
  add column if not exists hr_z2_max integer,
  add column if not exists hr_z3_max integer,
  add column if not exists hr_z4_max integer,
  add column if not exists hr_zone_model_version text,
  add column if not exists intensity_classification text,
  add column if not exists intensity_classification_reason text;

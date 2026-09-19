alter table public.athlete_hr_models
  add column if not exists cycling_lthr integer check (cycling_lthr is null or (cycling_lthr >= 140 and cycling_lthr <= 210)),
  add column if not exists running_lthr integer check (running_lthr is null or (running_lthr >= 140 and running_lthr <= 210)),
  add column if not exists threshold_source text check (threshold_source is null or threshold_source in ('manual', 'provider_profile', 'observed')),
  add column if not exists threshold_confidence text check (threshold_confidence is null or threshold_confidence in ('high', 'moderate', 'low'));

alter table public.activity_metrics
  add column if not exists threshold_hr integer,
  add column if not exists threshold_source text,
  add column if not exists threshold_confidence text,
  add column if not exists zone_method text;

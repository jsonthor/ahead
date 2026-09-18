-- Potential activity contract: summaries are enough for load.
-- FIT / streams enrich confidence; they do not unlock the model.

alter table public.activities
  add column if not exists rpe integer
    check (rpe is null or (rpe >= 1 and rpe <= 10));

alter table public.activity_metrics
  add column if not exists load_method text
    check (
      load_method is null
      or load_method in (
        'hr_stream',
        'hr_duration',
        'power_duration',
        'pace_duration',
        'duration_rpe',
        'duration_sport'
      )
    ),
  add column if not exists data_quality text
    check (
      data_quality is null
      or data_quality in ('rich', 'good', 'estimated')
    ),
  add column if not exists capabilities jsonb;

alter table public.daily_loads
  add column if not exists data_quality text
    check (
      data_quality is null
      or data_quality in ('rich', 'good', 'estimated')
    );

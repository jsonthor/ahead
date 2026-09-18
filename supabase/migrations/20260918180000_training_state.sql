-- Actual vs forecast Fitness/Fatigue/Form. Forecast never overwrites actuals.
alter table public.daily_loads
  add column if not exists status text
    default 'actual'
    check (status is null or status in ('actual', 'forecast'));

update public.daily_loads
  set status = 'actual'
  where status is null;

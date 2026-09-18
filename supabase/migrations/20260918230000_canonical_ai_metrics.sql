-- Canonical AI headline metrics. Must match dashboard display rounding:
--   displayPotential        = round(potential)
--   displayTrainingState    = round(fitness, 1), round(fatigue, 1),
--                             form = round(roundedFitness - roundedFatigue, 1)
-- Latest actual daily_loads row on or before the requested date — same as Today cards.

create or replace function public.ai_format_duration(p_seconds numeric)
returns text
language sql
immutable
as $$
  select case
    when p_seconds is null or p_seconds <= 0 then '0m'
    when floor(p_seconds / 60.0) = 0 then '<1m'
    when mod(floor(p_seconds / 60.0)::int, 60) = 0
      then (floor(p_seconds / 3600.0)::int)::text || 'h'
    when floor(p_seconds / 3600.0) = 0
      then (floor(p_seconds / 60.0)::int)::text || 'm'
    else
      (floor(p_seconds / 3600.0)::int)::text
      || 'h '
      || (mod(floor(p_seconds / 60.0)::int, 60))::text
      || 'm'
  end;
$$;

create or replace function public.ai_displayed_daily_state(
  p_date date,
  p_load double precision,
  p_fitness double precision,
  p_fatigue double precision,
  p_potential double precision,
  p_aerobic double precision,
  p_specific double precision,
  p_acute double precision
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'asOf', p_date,
    'source', 'daily_loads',
    'potential', round(p_potential::numeric, 0)::int,
    'fitness', round(p_fitness::numeric, 1),
    'fatigue', round(p_fatigue::numeric, 1),
    'form', round(
      (round(p_fitness::numeric, 1) - round(p_fatigue::numeric, 1)),
      1
    ),
    'load', round(coalesce(p_load, 0)::numeric, 0)::int,
    'aerobicReserve', round(coalesce(p_aerobic, 0)::numeric, 0)::int,
    'specificCapacity', round(coalesce(p_specific, 0)::numeric, 0)::int,
    'fatigueSuppression', round(coalesce(p_acute, 0)::numeric, 0)::int
  );
$$;

create or replace function public.ai_training_summary(p_start date, p_end date)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  tz text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_start is null or p_end is null or p_end < p_start then
    raise exception 'invalid period';
  end if;
  if (p_end - p_start) > 400 then
    raise exception 'period too long';
  end if;

  select coalesce(nullif(timezone, ''), 'UTC') into tz
  from public.profiles
  where id = uid;

  return (
    with acts as (
      select
        a.duration_seconds,
        m.potential_load,
        m.training_mix
      from public.activities a
      left join public.activity_metrics m on m.activity_id = a.id
      where a.athlete_id = uid
        and a.intelligence_eligible
        and a.status = 'ready'
        and (a.started_at at time zone tz)::date between p_start and p_end
    ),
    agg as (
      select
        coalesce(sum(duration_seconds), 0)::numeric as duration_seconds,
        coalesce(sum(potential_load), 0)::numeric as load,
        count(*)::int as sessions,
        coalesce(sum(coalesce((training_mix ->> 'easy_seconds')::numeric, 0)), 0) as easy_seconds,
        coalesce(sum(
          coalesce((training_mix ->> 'specific_seconds')::numeric, 0)
          + coalesce((training_mix ->> 'high_seconds')::numeric, 0)
        ), 0) as specific_seconds
      from acts
    ),
    races as (
      select count(*)::int as n
      from public.calendar_items
      where athlete_id = uid
        and intent = 'race'
        and date between p_start and p_end
    ),
    start_load as (
      select date, fitness, potential
      from public.daily_loads
      where athlete_id = uid
        and date >= p_start
        and date <= p_end
        and coalesce(status, 'actual') = 'actual'
        and potential is not null
      order by date asc
      limit 1
    ),
    end_load as (
      select
        date,
        training_load,
        fitness,
        fatigue,
        form,
        potential,
        aerobic_reserve,
        specific_capacity,
        acute_fatigue
      from public.daily_loads
      where athlete_id = uid
        and date <= p_end
        and coalesce(status, 'actual') = 'actual'
        and potential is not null
        and fitness is not null
        and fatigue is not null
      order by date desc
      limit 1
    )
    select jsonb_build_object(
      'period', jsonb_build_object('start', p_start, 'end', p_end),
      'sessions', (select sessions from agg),
      'durationSeconds', (select duration_seconds from agg),
      'duration', public.ai_format_duration((select duration_seconds from agg)),
      'load', round((select load from agg), 0)::int,
      'easySeconds', (select easy_seconds from agg),
      'easy', public.ai_format_duration((select easy_seconds from agg)),
      'specificSeconds', (select specific_seconds from agg),
      'specific', public.ai_format_duration((select specific_seconds from agg)),
      'races', (select n from races),
      'start', (
        select jsonb_build_object(
          'asOf', date,
          'potential', round(potential::numeric, 0)::int,
          'fitness', round(fitness::numeric, 1)
        )
        from start_load
      ),
      'end', (
        select public.ai_displayed_daily_state(
          date,
          training_load,
          fitness,
          fatigue,
          potential,
          aerobic_reserve,
          specific_capacity,
          acute_fatigue
        )
        from end_load
      )
    )
  );
end;
$$;

create or replace function public.ai_current_training_state(p_date date default current_date)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  as_of date := coalesce(p_date, current_date);
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  return coalesce(
    (
      select public.ai_displayed_daily_state(
        date,
        training_load,
        fitness,
        fatigue,
        potential,
        aerobic_reserve,
        specific_capacity,
        acute_fatigue
      )
      from public.daily_loads
      where athlete_id = uid
        and date <= as_of
        and coalesce(status, 'actual') = 'actual'
        and potential is not null
        and fitness is not null
        and fatigue is not null
      order by date desc
      limit 1
    ),
    jsonb_build_object(
      'asOf', as_of,
      'source', 'daily_loads',
      'potential', null,
      'fitness', null,
      'fatigue', null,
      'form', null
    )
  );
end;
$$;

grant execute on function public.ai_format_duration(numeric) to authenticated;
grant execute on function public.ai_displayed_daily_state(date, double precision, double precision, double precision, double precision, double precision, double precision, double precision) to authenticated;
grant execute on function public.ai_training_summary(date, date) to authenticated;
grant execute on function public.ai_current_training_state(date) to authenticated;

grant execute on function public.ai_format_duration(numeric) to service_role;
grant execute on function public.ai_displayed_daily_state(date, double precision, double precision, double precision, double precision, double precision, double precision, double precision) to service_role;
grant execute on function public.ai_training_summary(date, date) to service_role;
grant execute on function public.ai_current_training_state(date) to service_role;

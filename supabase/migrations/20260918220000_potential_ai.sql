-- Potential AI: athlete memory, calendar proposals, period-summary RPCs.
-- Long-term memory is Potential's. OpenAI conversation ids are short-term only.
-- The LLM never writes SQL; these functions are the tools.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- athlete_memories
-- ---------------------------------------------------------------------------

create table public.athlete_memories (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('fact', 'preference', 'constraint', 'decision')),
  content text not null check (char_length(trim(content)) between 1 and 800),
  confidence double precision not null default 0.8
    check (confidence >= 0 and confidence <= 1),
  importance double precision not null default 0.5
    check (importance >= 0 and importance <= 1),
  source_conversation_id uuid references public.conversations (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  superseded_at timestamptz
);

create index athlete_memories_athlete_live_idx
  on public.athlete_memories (athlete_id, importance desc)
  where superseded_at is null;

create index athlete_memories_content_trgm_idx
  on public.athlete_memories using gin (content gin_trgm_ops);

alter table public.athlete_memories enable row level security;
revoke all on table public.athlete_memories from anon, authenticated;
grant select, insert, update, delete on table public.athlete_memories to authenticated;
grant all on table public.athlete_memories to service_role;

create policy "Athletes can read own memories"
  on public.athlete_memories for select to authenticated
  using (athlete_id = auth.uid());

create policy "Athletes can insert own memories"
  on public.athlete_memories for insert to authenticated
  with check (athlete_id = auth.uid());

create policy "Athletes can update own memories"
  on public.athlete_memories for update to authenticated
  using (athlete_id = auth.uid())
  with check (athlete_id = auth.uid());

create policy "Athletes can delete own memories"
  on public.athlete_memories for delete to authenticated
  using (athlete_id = auth.uid());

create trigger athlete_memories_set_updated_at
  before update on public.athlete_memories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- calendar_proposals  (potential-ai writes these; apply-calendar-proposal commits)
-- ---------------------------------------------------------------------------

create table public.calendar_proposals (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  operations jsonb not null check (jsonb_typeof(operations) = 'array'),
  snapshot jsonb not null default '[]'::jsonb,
  rationale text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'applied', 'dismissed', 'expired')),
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create index calendar_proposals_athlete_idx
  on public.calendar_proposals (athlete_id, created_at desc);

alter table public.calendar_proposals enable row level security;
revoke all on table public.calendar_proposals from anon, authenticated;
grant select, insert, update on table public.calendar_proposals to authenticated;
grant all on table public.calendar_proposals to service_role;

create policy "Athletes can read own proposals"
  on public.calendar_proposals for select to authenticated
  using (athlete_id = auth.uid());

create policy "Athletes can insert own proposals"
  on public.calendar_proposals for insert to authenticated
  with check (athlete_id = auth.uid());

create policy "Athletes can update own proposals"
  on public.calendar_proposals for update to authenticated
  using (athlete_id = auth.uid())
  with check (athlete_id = auth.uid());

-- ---------------------------------------------------------------------------
-- agent_actions  (audit of applied diffs)
-- ---------------------------------------------------------------------------

create table public.agent_actions (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  proposal_id uuid references public.calendar_proposals (id) on delete set null,
  conversation_id uuid references public.conversations (id) on delete set null,
  operations jsonb not null,
  created_at timestamptz not null default now(),
  undone_at timestamptz
);

create index agent_actions_athlete_idx
  on public.agent_actions (athlete_id, created_at desc);

alter table public.agent_actions enable row level security;
revoke all on table public.agent_actions from anon, authenticated;
grant select, insert, update on table public.agent_actions to authenticated;
grant all on table public.agent_actions to service_role;

create policy "Athletes can read own agent actions"
  on public.agent_actions for select to authenticated
  using (athlete_id = auth.uid());

create policy "Athletes can insert own agent actions"
  on public.agent_actions for insert to authenticated
  with check (athlete_id = auth.uid());

create policy "Athletes can update own agent actions"
  on public.agent_actions for update to authenticated
  using (athlete_id = auth.uid())
  with check (athlete_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Thread continuity (OpenAI short-term only)
-- ---------------------------------------------------------------------------

alter table public.conversations
  add column if not exists openai_response_id text,
  add column if not exists memory_extracted_at timestamptz;

alter table public.messages
  add column if not exists proposal_id uuid references public.calendar_proposals (id) on delete set null;

-- Seed memories from the jsonb prototype.
insert into public.athlete_memories (athlete_id, type, content, confidence, importance)
select
  p.id,
  'fact',
  left(trim(fact), 800),
  0.7,
  0.5
from public.profiles p
cross join lateral jsonb_array_elements_text(
  coalesce(p.assistant_memory -> 'facts', '[]'::jsonb)
) as fact
where char_length(trim(fact)) > 0;

-- ---------------------------------------------------------------------------
-- Period maths (deterministic). security invoker so RLS still applies.
-- ---------------------------------------------------------------------------

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
      select fitness, potential
      from public.daily_loads
      where athlete_id = uid
        and date = p_start
        and coalesce(status, 'actual') = 'actual'
      limit 1
    ),
    end_load as (
      select fitness, potential, fatigue, form
      from public.daily_loads
      where athlete_id = uid
        and date = p_end
        and coalesce(status, 'actual') = 'actual'
      limit 1
    )
    select jsonb_build_object(
      'period', jsonb_build_object('start', p_start, 'end', p_end),
      'hours', round((select duration_seconds from agg) / 3600.0, 1),
      'load', round((select load from agg), 1),
      'sessions', (select sessions from agg),
      'easyHours', round((select easy_seconds from agg) / 3600.0, 1),
      'specificHours', round((select specific_seconds from agg) / 3600.0, 1),
      'races', (select n from races),
      'fitnessStart', (select fitness from start_load),
      'fitnessEnd', (select fitness from end_load),
      'potentialStart', (select potential from start_load),
      'potentialEnd', (select potential from end_load),
      'fatigueEnd', (select fatigue from end_load),
      'formEnd', (select form from end_load)
    )
  );
end;
$$;

create or replace function public.ai_compare_training_periods(
  a_start date,
  a_end date,
  b_start date,
  b_end date
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'periodA', public.ai_training_summary(a_start, a_end),
    'periodB', public.ai_training_summary(b_start, b_end)
  );
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

  return (
    with today as (
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
        and date = as_of
        and coalesce(status, 'actual') = 'actual'
      limit 1
    ),
    upcoming as (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', id,
            'date', date,
            'sport', sport,
            'title', title,
            'intent', intent,
            'planned_seconds', planned_seconds
          )
          order by date, title
        ),
        '[]'::jsonb
      ) as items
      from public.calendar_items
      where athlete_id = uid
        and date between as_of and (as_of + 7)
    ),
    races as (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', id,
            'date', date,
            'title', title,
            'importance', importance
          )
          order by date
        ),
        '[]'::jsonb
      ) as items
      from (
        select id, date, title, importance
        from public.calendar_items
        where athlete_id = uid
          and intent = 'race'
          and date >= as_of
        order by date
        limit 5
      ) r
    )
    select jsonb_build_object(
      'date', as_of,
      'load', (select training_load from today),
      'fitness', (select fitness from today),
      'fatigue', (select fatigue from today),
      'form', (select form from today),
      'potential', (select potential from today),
      'aerobicReserve', (select aerobic_reserve from today),
      'specificCapacity', (select specific_capacity from today),
      'fatigueSuppression', (select acute_fatigue from today),
      'upcomingCalendar', (select items from upcoming),
      'upcomingRaces', (select items from races)
    )
  );
end;
$$;

create or replace function public.search_athlete_memory(
  p_query text default '',
  p_limit integer default 8
)
returns table (
  id uuid,
  type text,
  content text,
  importance double precision,
  confidence double precision,
  created_at timestamptz
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  q text := trim(coalesce(p_query, ''));
  cap integer := least(greatest(coalesce(p_limit, 8), 1), 20);
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  return query
  select
    m.id,
    m.type,
    m.content,
    m.importance,
    m.confidence,
    m.created_at
  from public.athlete_memories m
  where m.athlete_id = uid
    and m.superseded_at is null
    and (
      char_length(q) < 2
      or m.content ilike '%' || q || '%'
      or extensions.similarity(m.content, q) > 0.12
    )
  order by
    case
      when char_length(q) >= 2 and m.content ilike '%' || q || '%' then 0
      else 1
    end,
    m.importance desc,
    m.created_at desc
  limit cap;
end;
$$;

grant execute on function public.ai_training_summary(date, date) to authenticated;
grant execute on function public.ai_compare_training_periods(date, date, date, date) to authenticated;
grant execute on function public.ai_current_training_state(date) to authenticated;
grant execute on function public.search_athlete_memory(text, integer) to authenticated;

grant execute on function public.ai_training_summary(date, date) to service_role;
grant execute on function public.ai_compare_training_periods(date, date, date, date) to service_role;
grant execute on function public.ai_current_training_state(date) to service_role;
grant execute on function public.search_athlete_memory(text, integer) to service_role;

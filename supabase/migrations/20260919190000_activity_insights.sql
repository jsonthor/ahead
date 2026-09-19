create table public.activity_insights (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  activity_id uuid not null references public.activities (id) on delete cascade,
  status text not null default 'ready',
  headline text not null,
  summary text not null,
  findings jsonb not null default '[]'::jsonb,
  implications text,
  next_action text,
  planned_vs_actual jsonb,
  confidence text not null default 'moderate',
  fingerprint text not null,
  model text,
  prompt_version integer not null default 1,
  packet_version integer not null default 1,
  input_tokens integer,
  cached_input_tokens integer,
  output_tokens integer,
  estimated_cost numeric,
  latency_ms integer,
  generated_at timestamptz not null default now(),
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index activity_insights_activity_idx
  on public.activity_insights (activity_id, generated_at desc);

create index activity_insights_athlete_idx
  on public.activity_insights (athlete_id, generated_at desc);

create index activity_insights_current_idx
  on public.activity_insights (activity_id)
  where superseded_at is null;

alter table public.activity_insights enable row level security;
revoke all on table public.activity_insights from anon, authenticated;
grant select, insert, update, delete on table public.activity_insights to authenticated;
grant all on table public.activity_insights to service_role;

create policy "Athletes can read own activity insights"
  on public.activity_insights for select to authenticated
  using (athlete_id = auth.uid());

create policy "Athletes can insert own activity insights"
  on public.activity_insights for insert to authenticated
  with check (athlete_id = auth.uid());

create policy "Athletes can update own activity insights"
  on public.activity_insights for update to authenticated
  using (athlete_id = auth.uid())
  with check (athlete_id = auth.uid());

create policy "Athletes can delete own activity insights"
  on public.activity_insights for delete to authenticated
  using (athlete_id = auth.uid());

create trigger activity_insights_set_updated_at
  before update on public.activity_insights
  for each row execute function public.set_updated_at();

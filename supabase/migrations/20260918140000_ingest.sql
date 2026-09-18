-- Ingest: integrations (tokens server-only), activities (observations),
-- activity_metrics (Potential interpretation). RLS on from create.

create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null,
  status text not null default 'connected'
    check (status in ('connected', 'error', 'revoked')),
  external_user_id text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  token_type text,
  scope text,
  mcp_url text,
  last_sync_at timestamptz,
  cursor text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (athlete_id, provider)
);

create index integrations_athlete_idx on public.integrations (athlete_id);

alter table public.integrations enable row level security;

revoke all on table public.integrations from anon, authenticated;

grant select (
  id,
  athlete_id,
  provider,
  status,
  last_sync_at,
  created_at,
  updated_at
) on table public.integrations to authenticated;

create policy "Athletes can read own integration metadata"
  on public.integrations
  for select
  to authenticated
  using (athlete_id = auth.uid());

create table public.oauth_handoffs (
  state text primary key,
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  return_path text not null default '/onboarding',
  mcp_url text,
  code_verifier text,
  discovery_state jsonb,
  expires_at timestamptz not null default (now() + interval '10 minutes')
);

alter table public.oauth_handoffs enable row level security;
revoke all on table public.oauth_handoffs from anon, authenticated;

create table public.mcp_oauth_clients (
  issuer text primary key,
  client_information jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.mcp_oauth_clients enable row level security;
revoke all on table public.mcp_oauth_clients from anon, authenticated;

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  source text not null,
  source_activity_id text not null,
  sport text not null default 'other',
  started_at timestamptz not null,
  duration_seconds integer,
  distance_m double precision,
  elevation_m double precision,
  avg_hr integer,
  max_hr integer,
  avg_power integer,
  max_power integer,
  avg_cadence integer,
  raw_fit_key text,
  vendor jsonb,
  intelligence_eligible boolean generated always as (source <> 'strava') stored,
  status text not null default 'ready'
    check (status in ('pending', 'ready', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (athlete_id, source, source_activity_id)
);

create index activities_athlete_started_idx
  on public.activities (athlete_id, started_at desc);

alter table public.activities enable row level security;

create policy "Athletes can read own activities"
  on public.activities
  for select
  to authenticated
  using (athlete_id = auth.uid());

grant select on table public.activities to authenticated;

create table public.activity_metrics (
  activity_id uuid primary key references public.activities (id) on delete cascade,
  potential_load double precision,
  intensity double precision,
  aerobic_load double precision,
  specific_load double precision,
  formula_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.activity_metrics enable row level security;

create policy "Athletes can read own activity metrics"
  on public.activity_metrics
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.activities a
      where a.id = activity_metrics.activity_id
        and a.athlete_id = auth.uid()
    )
  );

grant select on table public.activity_metrics to authenticated;

create trigger integrations_set_updated_at
  before update on public.integrations
  for each row execute function public.set_updated_at();

create trigger activities_set_updated_at
  before update on public.activities
  for each row execute function public.set_updated_at();

create trigger activity_metrics_set_updated_at
  before update on public.activity_metrics
  for each row execute function public.set_updated_at();

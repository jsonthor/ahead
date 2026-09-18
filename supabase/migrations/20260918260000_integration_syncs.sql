-- Athlete-visible log of each integration sync. Tokens stay on integrations.

create table if not exists public.integration_syncs (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null,
  started_at timestamptz not null,
  finished_at timestamptz not null default now(),
  status text not null default 'ok'
    check (status in ('ok', 'error')),
  activities_saved integer,
  recovery_days integer,
  message text,
  created_at timestamptz not null default now()
);

create index if not exists integration_syncs_athlete_provider_idx
  on public.integration_syncs (athlete_id, provider, started_at desc);

alter table public.integration_syncs enable row level security;

drop policy if exists "Athletes can read own integration syncs" on public.integration_syncs;
create policy "Athletes can read own integration syncs"
  on public.integration_syncs
  for select
  to authenticated
  using (athlete_id = auth.uid());

grant select on table public.integration_syncs to authenticated;

insert into public.integration_syncs (
  athlete_id,
  provider,
  started_at,
  finished_at,
  status,
  message
)
select
  athlete_id,
  provider,
  last_sync_at,
  last_sync_at,
  'ok',
  'Recorded from last known sync'
from public.integrations
where last_sync_at is not null
  and not exists (
    select 1
    from public.integration_syncs s
    where s.athlete_id = integrations.athlete_id
      and s.provider = integrations.provider
  );

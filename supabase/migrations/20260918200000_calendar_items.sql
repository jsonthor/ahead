-- Planned future events (training or race). Later matched to a completed activity.

create table public.calendar_items (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  sport text not null default 'other',
  title text not null,
  intent text not null default 'training'
    check (intent in ('training', 'race')),
  importance text
    check (importance is null or importance in ('A', 'B', 'C')),
  planned_seconds integer,
  planned_distance_m double precision,
  notes text,
  linked_activity_id uuid references public.activities (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (intent = 'race' or importance is null)
);

create index calendar_items_athlete_date_idx
  on public.calendar_items (athlete_id, date);

create unique index calendar_items_linked_activity_uidx
  on public.calendar_items (linked_activity_id)
  where linked_activity_id is not null;

alter table public.calendar_items enable row level security;

revoke all on table public.calendar_items from anon, authenticated;
grant select, insert, update, delete on table public.calendar_items to authenticated;
grant all on table public.calendar_items to service_role;

create policy "Athletes can read own calendar items"
  on public.calendar_items
  for select
  to authenticated
  using (athlete_id = auth.uid());

create policy "Athletes can insert own calendar items"
  on public.calendar_items
  for insert
  to authenticated
  with check (athlete_id = auth.uid());

create policy "Athletes can update own calendar items"
  on public.calendar_items
  for update
  to authenticated
  using (athlete_id = auth.uid())
  with check (athlete_id = auth.uid());

create policy "Athletes can delete own calendar items"
  on public.calendar_items
  for delete
  to authenticated
  using (athlete_id = auth.uid());

create trigger calendar_items_set_updated_at
  before update on public.calendar_items
  for each row execute function public.set_updated_at();

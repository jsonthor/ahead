create table public.race_results (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  calendar_item_id uuid unique references public.calendar_items (id) on delete set null,
  activity_id uuid unique references public.activities (id) on delete set null,
  place integer,
  field_size integer,
  category text,
  gap text,
  feel text,
  factor text,
  status text not null default 'completed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint race_results_has_anchor
    check (calendar_item_id is not null or activity_id is not null),
  constraint race_results_place_ok
    check (place is null or place > 0),
  constraint race_results_field_ok
    check (field_size is null or field_size > 0),
  constraint race_results_status_ok
    check (status in ('completed', 'dnf', 'dns')),
  constraint race_results_feel_ok
    check (feel is null or feel in ('good', 'ok', 'hard', 'rough')),
  constraint race_results_factor_ok
    check (
      factor is null
      or factor in ('none', 'crash', 'mechanical', 'weather', 'illness', 'other')
    )
);

create index race_results_athlete_idx
  on public.race_results (athlete_id, created_at desc);

alter table public.race_results enable row level security;
revoke all on table public.race_results from anon, authenticated;
grant select, insert, update, delete on table public.race_results to authenticated;
grant all on table public.race_results to service_role;

create policy "Athletes can read own race results"
  on public.race_results for select to authenticated
  using (athlete_id = auth.uid());

create policy "Athletes can insert own race results"
  on public.race_results for insert to authenticated
  with check (athlete_id = auth.uid());

create policy "Athletes can update own race results"
  on public.race_results for update to authenticated
  using (athlete_id = auth.uid())
  with check (athlete_id = auth.uid());

create policy "Athletes can delete own race results"
  on public.race_results for delete to authenticated
  using (athlete_id = auth.uid());

create trigger race_results_set_updated_at
  before update on public.race_results
  for each row execute function public.set_updated_at();

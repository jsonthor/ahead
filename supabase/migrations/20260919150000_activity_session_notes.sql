create table public.activity_session_notes (
  activity_id uuid primary key references public.activities (id) on delete cascade,
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  note jsonb not null,
  composed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index activity_session_notes_athlete_idx
  on public.activity_session_notes (athlete_id, composed_at desc);

alter table public.activity_session_notes enable row level security;
revoke all on table public.activity_session_notes from anon, authenticated;
grant select, insert, update, delete on table public.activity_session_notes to authenticated;
grant all on table public.activity_session_notes to service_role;

create policy "Athletes can read own session notes"
  on public.activity_session_notes for select to authenticated
  using (athlete_id = auth.uid());

create policy "Athletes can insert own session notes"
  on public.activity_session_notes for insert to authenticated
  with check (athlete_id = auth.uid());

create policy "Athletes can update own session notes"
  on public.activity_session_notes for update to authenticated
  using (athlete_id = auth.uid())
  with check (athlete_id = auth.uid());

create policy "Athletes can delete own session notes"
  on public.activity_session_notes for delete to authenticated
  using (athlete_id = auth.uid());

create trigger activity_session_notes_set_updated_at
  before update on public.activity_session_notes
  for each row execute function public.set_updated_at();

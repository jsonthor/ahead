create table public.coach_reviews (
  id uuid primary key,
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'month' check (kind in ('week', 'month')),
  period_start date not null,
  period_end date not null,
  source text,
  title text not null,
  review jsonb not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index coach_reviews_athlete_period_idx
  on public.coach_reviews (athlete_id, period_end desc);

alter table public.coach_reviews enable row level security;
revoke all on table public.coach_reviews from anon, authenticated;
grant select, insert, update, delete on table public.coach_reviews to authenticated;
grant all on table public.coach_reviews to service_role;

create policy "Athletes can read own coach reviews"
  on public.coach_reviews for select to authenticated
  using (athlete_id = auth.uid());

create policy "Athletes can insert own coach reviews"
  on public.coach_reviews for insert to authenticated
  with check (athlete_id = auth.uid());

create policy "Athletes can update own coach reviews"
  on public.coach_reviews for update to authenticated
  using (athlete_id = auth.uid())
  with check (athlete_id = auth.uid());

create policy "Athletes can delete own coach reviews"
  on public.coach_reviews for delete to authenticated
  using (athlete_id = auth.uid());

create trigger coach_reviews_set_updated_at
  before update on public.coach_reviews
  for each row execute function public.set_updated_at();

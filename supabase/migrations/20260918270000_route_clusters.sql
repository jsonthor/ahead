-- Repeated-route fingerprints. GPS streams stay in storage; this is the
-- 100-point distance-normalised polyline used to cluster same-route rides.

create table public.route_clusters (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  sport text not null,
  representative_activity_id uuid not null references public.activities (id) on delete cascade,
  typical_distance_m double precision,
  typical_elevation_m double precision,
  attempt_count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index route_clusters_athlete_sport_idx
  on public.route_clusters (athlete_id, sport, typical_distance_m);

create table public.activity_routes (
  activity_id uuid primary key references public.activities (id) on delete cascade,
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  sport text not null,
  distance_m double precision not null,
  elevation_m double precision,
  start_lat double precision not null,
  start_lng double precision not null,
  end_lat double precision not null,
  end_lng double precision not null,
  bbox_min_lat double precision not null,
  bbox_min_lng double precision not null,
  bbox_max_lat double precision not null,
  bbox_max_lng double precision not null,
  points jsonb not null,
  route_cluster_id uuid references public.route_clusters (id) on delete set null,
  route_similarity double precision,
  route_overlap double precision,
  direction_match boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index activity_routes_athlete_sport_distance_idx
  on public.activity_routes (athlete_id, sport, distance_m);

create index activity_routes_cluster_idx
  on public.activity_routes (route_cluster_id);

alter table public.route_clusters enable row level security;
alter table public.activity_routes enable row level security;

create policy "Athletes can read own route clusters"
  on public.route_clusters
  for select
  to authenticated
  using (athlete_id = auth.uid());

create policy "Athletes can read own activity routes"
  on public.activity_routes
  for select
  to authenticated
  using (athlete_id = auth.uid());

grant select on table public.route_clusters to authenticated;
grant select on table public.activity_routes to authenticated;

create trigger route_clusters_set_updated_at
  before update on public.route_clusters
  for each row execute function public.set_updated_at();

create trigger activity_routes_set_updated_at
  before update on public.activity_routes
  for each row execute function public.set_updated_at();

alter table public.profiles
  add column if not exists hr_zone_notices jsonb not null default '[]'::jsonb;

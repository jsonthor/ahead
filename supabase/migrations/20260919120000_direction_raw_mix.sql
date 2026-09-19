alter table public.daily_loads
  add column if not exists aerobic_raw double precision,
  add column if not exists specific_raw double precision;

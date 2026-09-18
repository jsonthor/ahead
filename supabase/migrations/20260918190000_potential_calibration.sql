-- Frozen athlete-relative anchors for Potential (p10 → 0, p90 → 100).
-- Written by recompute, not moved every day.
alter table public.profiles
  add column if not exists potential_calibration jsonb;

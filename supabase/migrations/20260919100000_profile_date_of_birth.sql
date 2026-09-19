-- Date of birth on the athlete profile. Age is derived in application
-- code. Nullable so existing accounts are not blocked.

alter table public.profiles
  add column if not exists date_of_birth date;

alter table public.profiles
  drop constraint if exists profiles_date_of_birth_past;

alter table public.profiles
  add constraint profiles_date_of_birth_past
  check (date_of_birth is null or date_of_birth <= current_date);

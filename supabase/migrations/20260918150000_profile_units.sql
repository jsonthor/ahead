-- PRD A2: units live on the athlete profile. Distances stay metres in
-- activities; display converts from this preference.

alter table public.profiles
  add column if not exists units text not null default 'metric';

alter table public.profiles
  drop constraint if exists profiles_units_check;

alter table public.profiles
  add constraint profiles_units_check check (units in ('metric', 'imperial'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, timezone, units)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'display_name', ''),
      split_part(new.email, '@', 1)
    ),
    coalesce(nullif(new.raw_user_meta_data->>'timezone', ''), 'UTC'),
    case
      when new.raw_user_meta_data->>'units' = 'imperial' then 'imperial'
      else 'metric'
    end
  );
  return new;
end;
$$;

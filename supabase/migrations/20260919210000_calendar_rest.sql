alter table public.calendar_items
  drop constraint if exists calendar_items_intent_check;

alter table public.calendar_items
  add constraint calendar_items_intent_check
  check (intent in ('training', 'race', 'rest'));

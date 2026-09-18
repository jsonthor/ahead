-- Prescribed sessions from Ask Potential, plus enough audit to undo an Apply.

alter table public.calendar_items
  add column if not exists planned_load numeric,
  add column if not exists purpose text,
  add column if not exists created_by text not null default 'athlete',
  add column if not exists workout jsonb;

alter table public.calendar_items
  drop constraint if exists calendar_items_created_by_check;

alter table public.calendar_items
  add constraint calendar_items_created_by_check
  check (created_by in ('athlete', 'potential_ai'));

alter table public.agent_actions
  add column if not exists result jsonb not null default '{}'::jsonb;

alter table public.calendar_proposals
  drop constraint if exists calendar_proposals_status_check;

alter table public.calendar_proposals
  add constraint calendar_proposals_status_check
  check (status in ('pending', 'applied', 'dismissed', 'expired', 'undone'));

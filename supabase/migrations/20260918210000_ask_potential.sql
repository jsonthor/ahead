-- Ask Potential: persistent conversation, durable athlete memory, calendar diffs.

alter table public.profiles
  add column if not exists assistant_memory jsonb not null default '{"facts":[]}'::jsonb;

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index conversations_athlete_updated_idx
  on public.conversations (athlete_id, updated_at desc);

alter table public.conversations enable row level security;
revoke all on table public.conversations from anon, authenticated;
grant select, insert, update, delete on table public.conversations to authenticated;
grant all on table public.conversations to service_role;

create policy "Athletes can read own conversations"
  on public.conversations for select to authenticated
  using (athlete_id = auth.uid());

create policy "Athletes can insert own conversations"
  on public.conversations for insert to authenticated
  with check (athlete_id = auth.uid());

create policy "Athletes can update own conversations"
  on public.conversations for update to authenticated
  using (athlete_id = auth.uid())
  with check (athlete_id = auth.uid());

create policy "Athletes can delete own conversations"
  on public.conversations for delete to authenticated
  using (athlete_id = auth.uid());

create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  proposal jsonb,
  created_at timestamptz not null default now()
);

create index messages_conversation_idx
  on public.messages (conversation_id, created_at);

alter table public.messages enable row level security;
revoke all on table public.messages from anon, authenticated;
grant select, insert, update, delete on table public.messages to authenticated;
grant all on table public.messages to service_role;

create policy "Athletes can read own messages"
  on public.messages for select to authenticated
  using (athlete_id = auth.uid());

create policy "Athletes can insert own messages"
  on public.messages for insert to authenticated
  with check (athlete_id = auth.uid());

create policy "Athletes can update own messages"
  on public.messages for update to authenticated
  using (athlete_id = auth.uid())
  with check (athlete_id = auth.uid());

create policy "Athletes can delete own messages"
  on public.messages for delete to authenticated
  using (athlete_id = auth.uid());

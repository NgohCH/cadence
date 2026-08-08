-- Cadence v0.1
-- Migration: append-only message version history and current message view

create table public.message_versions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  content text not null,
  editor_user_id uuid references public.users(id) on delete set null,
  editor_type text not null check (editor_type in ('human', 'agent', 'system')),
  change_reason text,
  created_at timestamptz not null default now(),
  unique (message_id, version_number),
  constraint message_versions_human_editor_check check (
    editor_type <> 'human' or editor_user_id is not null
  )
);

create trigger message_versions_immutable
before update or delete on public.message_versions
for each row execute function public.prevent_immutable_mutation();

create view public.current_messages
with (security_invoker = true)
as
select
  m.id,
  m.project_id,
  m.author_user_id,
  m.author_type,
  m.thread_parent_id,
  m.current_version,
  mv.content,
  m.created_at,
  m.edited_at
from public.messages m
join public.message_versions mv
  on mv.message_id = m.id
 and mv.version_number = m.current_version
where m.deleted_at is null;

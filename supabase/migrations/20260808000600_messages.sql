-- Cadence v0.1
-- Migration: native discussion message envelope
-- Message text is stored in immutable message_versions rows.

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  author_user_id uuid references public.users(id) on delete set null,
  author_type text not null check (author_type in ('human', 'agent', 'system')),
  thread_parent_id uuid references public.messages(id) on delete set null,
  current_version integer not null default 1 check (current_version > 0),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,
  constraint messages_human_author_check check (
    author_type <> 'human' or author_user_id is not null
  )
);

create trigger messages_prevent_hard_delete
before delete on public.messages
for each row execute function public.prevent_hard_delete();

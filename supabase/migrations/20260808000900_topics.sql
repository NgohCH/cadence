-- Cadence v0.1
-- Migration: topics under exploration

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  summary text,
  status text not null default 'exploring'
    check (status in ('exploring', 'proposed', 'decided', 'deferred', 'closed')),
  owner_user_id uuid references public.users(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  created_by_type text not null default 'human'
    check (created_by_type in ('human', 'agent', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint topics_human_creator_check check (
    created_by_type <> 'human' or created_by is not null
  )
);

create trigger topics_touch_updated_at
before update on public.topics
for each row execute function public.touch_updated_at();

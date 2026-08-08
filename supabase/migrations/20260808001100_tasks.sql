-- Cadence v0.1
-- Migration: project tasks

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  assigned_to uuid references public.users(id) on delete set null,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'completed', 'cancelled')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'critical')),
  due_date timestamptz,
  completed_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_by_type text not null default 'human'
    check (created_by_type in ('human', 'agent', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_human_creator_check check (
    created_by_type <> 'human' or created_by is not null
  ),
  constraint tasks_completed_timestamp_check check (
    status <> 'completed' or completed_at is not null
  )
);

create trigger tasks_touch_updated_at
before update on public.tasks
for each row execute function public.touch_updated_at();

-- Cadence v0.1
-- Migration: project blockers

create table public.blockers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  owner_user_id uuid references public.users(id) on delete set null,
  severity text not null default 'medium'
    check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open'
    check (status in ('open', 'monitoring', 'resolved')),
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_by_type text not null default 'human'
    check (created_by_type in ('human', 'agent', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blockers_human_creator_check check (
    created_by_type <> 'human' or created_by is not null
  ),
  constraint blockers_resolved_timestamp_check check (
    status <> 'resolved' or resolved_at is not null
  )
);

create trigger blockers_touch_updated_at
before update on public.blockers
for each row execute function public.touch_updated_at();

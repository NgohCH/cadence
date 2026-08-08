-- Cadence v0.1
-- Migration: project milestones

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  owner_user_id uuid references public.users(id) on delete set null,
  target_date timestamptz not null,
  status text not null default 'upcoming'
    check (status in ('upcoming', 'due_soon', 'slipped', 'completed')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint milestones_completed_timestamp_check check (
    status <> 'completed' or completed_at is not null
  )
);

create trigger milestones_touch_updated_at
before update on public.milestones
for each row execute function public.touch_updated_at();

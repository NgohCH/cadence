-- Cadence v0.1
-- Migration: project/user alerts and event notifications

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  title text not null,
  message text not null,
  source_type text,
  source_id uuid,
  dismissible boolean not null default true,
  dismissed_at timestamptz,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

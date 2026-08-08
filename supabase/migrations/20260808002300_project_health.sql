-- Cadence v0.1
-- Migration: current project health and append-only health history

create table public.project_health (
  project_id uuid primary key references public.projects(id) on delete cascade,
  health_status text not null default 'on_track'
    check (health_status in ('on_track', 'at_risk', 'delayed', 'blocked')),
  reasons jsonb not null default '[]'::jsonb,
  source text not null default 'system'
    check (source in ('system', 'manual', 'agent')),
  changed_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint project_health_manual_actor_check check (
    source <> 'manual' or changed_by is not null
  )
);

create table public.project_health_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  previous_health text,
  new_health text not null
    check (new_health in ('on_track', 'at_risk', 'delayed', 'blocked')),
  reasons jsonb not null default '[]'::jsonb,
  source text not null check (source in ('system', 'manual', 'agent')),
  changed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint project_health_history_manual_actor_check check (
    source <> 'manual' or changed_by is not null
  )
);

create trigger project_health_touch_updated_at
before update on public.project_health
for each row execute function public.touch_updated_at();

create trigger project_health_history_immutable
before update or delete on public.project_health_history
for each row execute function public.prevent_immutable_mutation();

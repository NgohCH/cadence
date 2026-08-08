-- Cadence v0.1
-- Migration: projects
-- Project health is intentionally owned by the Project Health module, not this table.

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  goal text,
  lifecycle_status text not null default 'draft'
    check (lifecycle_status in ('draft', 'active', 'on_hold', 'completed', 'cancelled')),
  progress_percent smallint not null default 0
    check (progress_percent between 0 and 100),
  owner_user_id uuid not null references public.users(id) on delete restrict,
  start_date date,
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger projects_touch_updated_at
before update on public.projects
for each row execute function public.touch_updated_at();

create trigger projects_prevent_hard_delete
before delete on public.projects
for each row execute function public.prevent_hard_delete();

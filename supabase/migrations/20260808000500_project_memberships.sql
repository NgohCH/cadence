-- Cadence v0.1
-- Migration: project-scoped role assignments

create table public.project_memberships (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete restrict,
  role_id uuid not null references public.roles(id) on delete restrict,
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  joined_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create or replace function public.enforce_project_role_scope()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.roles r
    where r.id = new.role_id and r.scope = 'project'
  ) then
    raise exception 'role_id must reference a project-scoped role'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger project_membership_role_scope_check
before insert or update on public.project_memberships
for each row execute function public.enforce_project_role_scope();

create trigger project_memberships_touch_updated_at
before update on public.project_memberships
for each row execute function public.touch_updated_at();

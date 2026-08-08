-- Cadence v0.1
-- Migration: RBAC definitions and platform-level assignments

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  scope text not null check (scope in ('project', 'platform')),
  is_system_role boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table public.platform_role_assignments (
  user_id uuid not null references public.users(id) on delete restrict,
  role_id uuid not null references public.roles(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.users(id) on delete set null,
  primary key (user_id, role_id)
);

create or replace function public.enforce_platform_role_scope()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.roles r
    where r.id = new.role_id and r.scope = 'platform'
  ) then
    raise exception 'role_id must reference a platform-scoped role'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger platform_role_scope_check
before insert or update on public.platform_role_assignments
for each row execute function public.enforce_platform_role_scope();

create trigger roles_touch_updated_at
before update on public.roles
for each row execute function public.touch_updated_at();

create trigger permissions_touch_updated_at
before update on public.permissions
for each row execute function public.touch_updated_at();

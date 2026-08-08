-- Cadence v0.1
-- Migration: RLS helper functions
-- SECURITY DEFINER is intentional. search_path is fixed to reduce object-hijacking risk.

create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.id
  from public.users u
  where u.auth_user_id = auth.uid()
    and u.status = 'active'
  limit 1
$$;

create or replace function public.is_project_member(
  p_project_id uuid,
  p_user_id uuid default public.current_app_user_id()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.project_memberships pm
    join public.users u on u.id = pm.user_id
    where pm.project_id = p_project_id
      and pm.user_id = p_user_id
      and pm.status = 'active'
      and u.status = 'active'
  )
$$;

create or replace function public.has_project_permission(
  p_project_id uuid,
  p_permission_code text,
  p_user_id uuid default public.current_app_user_id()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.project_memberships pm
    join public.users u on u.id = pm.user_id
    join public.roles r on r.id = pm.role_id and r.scope = 'project'
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions p on p.id = rp.permission_id
    where pm.project_id = p_project_id
      and pm.user_id = p_user_id
      and pm.status = 'active'
      and u.status = 'active'
      and p.code = p_permission_code
  )
$$;

create or replace function public.has_platform_permission(
  p_permission_code text,
  p_user_id uuid default public.current_app_user_id()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.platform_role_assignments pra
    join public.users u on u.id = pra.user_id
    join public.roles r on r.id = pra.role_id and r.scope = 'platform'
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions p on p.id = rp.permission_id
    where pra.user_id = p_user_id
      and u.status = 'active'
      and p.code = p_permission_code
  )
$$;

create or replace function public.can_view_user(
  p_target_user_id uuid,
  p_viewer_user_id uuid default public.current_app_user_id()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p_target_user_id = p_viewer_user_id
    or public.has_platform_permission('platform.user_manage', p_viewer_user_id)
    or exists (
      select 1
      from public.project_memberships a
      join public.project_memberships b on b.project_id = a.project_id
      where a.user_id = p_viewer_user_id
        and b.user_id = p_target_user_id
        and a.status = 'active'
        and b.status = 'active'
    )
$$;

create or replace function public.can_access_message(
  p_message_id uuid,
  p_user_id uuid default public.current_app_user_id()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.messages m
    where m.id = p_message_id
      and public.is_project_member(m.project_id, p_user_id)
  )
$$;

create or replace function public.can_access_file(
  p_file_id uuid,
  p_user_id uuid default public.current_app_user_id()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.files f
    where f.id = p_file_id
      and public.is_project_member(f.project_id, p_user_id)
  )
$$;

create or replace function public.can_access_decision(
  p_decision_id uuid,
  p_user_id uuid default public.current_app_user_id()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.decisions d
    where d.id = p_decision_id
      and public.is_project_member(d.project_id, p_user_id)
  )
$$;

revoke all on function public.current_app_user_id() from public;
revoke all on function public.is_project_member(uuid, uuid) from public;
revoke all on function public.has_project_permission(uuid, text, uuid) from public;
revoke all on function public.has_platform_permission(text, uuid) from public;
revoke all on function public.can_view_user(uuid, uuid) from public;
revoke all on function public.can_access_message(uuid, uuid) from public;
revoke all on function public.can_access_file(uuid, uuid) from public;
revoke all on function public.can_access_decision(uuid, uuid) from public;

grant execute on function public.current_app_user_id() to authenticated, service_role;
grant execute on function public.is_project_member(uuid, uuid) to authenticated, service_role;
grant execute on function public.has_project_permission(uuid, text, uuid) to authenticated, service_role;
grant execute on function public.has_platform_permission(text, uuid) to authenticated, service_role;
grant execute on function public.can_view_user(uuid, uuid) to authenticated, service_role;
grant execute on function public.can_access_message(uuid, uuid) to authenticated, service_role;
grant execute on function public.can_access_file(uuid, uuid) to authenticated, service_role;
grant execute on function public.can_access_decision(uuid, uuid) to authenticated, service_role;

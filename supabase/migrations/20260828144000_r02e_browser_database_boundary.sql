-- Cadence R02E
-- Browser database authority retirement.
--
-- Target architecture:
--
--   Browser -> Supabase Auth/session only
--   Browser -> Cadence API for all business data
--   Cadence API -> ProjectAuthorisationService
--   Cadence API -> service-role persistence
--
-- anon/authenticated therefore require no direct authority over the
-- Cadence public business schema.
--
-- This migration:
--   * removes all browser RLS policies;
--   * removes browser relation/sequence privileges;
--   * removes browser public-schema usage;
--   * hardens postgres/public default privileges;
--   * retires legacy VS-001 authorization helpers;
--   * removes direct browser execution from remaining Cadence functions.
--
-- Supabase-owned default privileges are intentionally not modified.


/*
 * ============================================================
 * 1. Remove the obsolete browser RLS layer.
 * ============================================================
 */

drop policy if exists
  ai_proposals_select_agent_users
on public.ai_proposals;

drop policy if exists
  alerts_select_visible
on public.alerts;

drop policy if exists
  audit_events_select_authorized
on public.audit_events;

drop policy if exists
  blockers_select_project_member
on public.blockers;

drop policy if exists
  decision_supersedes_select_project_member
on public.decision_supersedes;

drop policy if exists
  decisions_select_project_member
on public.decisions;

drop policy if exists
  entity_links_select_project_member
on public.entity_links;

drop policy if exists
  file_links_select_project_member
on public.file_links;

drop policy if exists
  files_select_project_member
on public.files;

drop policy if exists
  message_mentions_select_project_member
on public.message_mentions;

drop policy if exists
  message_reactions_select_project_member
on public.message_reactions;

drop policy if exists
  message_versions_select_project_member
on public.message_versions;

drop policy if exists
  messages_select_project_member
on public.messages;

drop policy if exists
  milestones_select_project_member
on public.milestones;

drop policy if exists
  notifications_select_self
on public.notifications;

drop policy if exists
  permissions_select_authenticated
on public.permissions;

drop policy if exists
  platform_role_assignments_select_self
on public.platform_role_assignments;

drop policy if exists
  project_health_select_member
on public.project_health;

drop policy if exists
  project_health_history_select_member
on public.project_health_history;

drop policy if exists
  memberships_select_project_member
on public.project_memberships;

drop policy if exists
  projects_select_member
on public.projects;

drop policy if exists
  role_permissions_select_authenticated
on public.role_permissions;

drop policy if exists
  roles_select_authenticated
on public.roles;

drop policy if exists
  source_links_select_project_member
on public.source_links;

drop policy if exists
  tasks_select_project_member
on public.tasks;

drop policy if exists
  topics_select_project_member
on public.topics;

drop policy if exists
  users_select_visible
on public.users;


/*
 * ============================================================
 * 2. Remove existing direct browser relation authority.
 *
 * ALL TABLES includes public tables and views such as
 * current_messages.
 * ============================================================
 */

revoke all privileges
on all tables in schema public
from anon, authenticated;

revoke all privileges
on all sequences in schema public
from anon, authenticated;


/*
 * ============================================================
 * 3. Harden future Cadence objects.
 *
 * Cadence migrations are created by postgres. New public
 * relations/functions must not silently reacquire browser grants.
 *
 * Supabase-managed supabase_admin defaults are intentionally left alone.
 * Browser roles are structurally excluded from public below.
 * ============================================================
 */

alter default privileges
for role postgres
in schema public
revoke all privileges
on tables
from public, anon, authenticated;

alter default privileges
for role postgres
in schema public
revoke all privileges
on sequences
from public, anon, authenticated;

alter default privileges
for role postgres
in schema public
revoke execute
on functions
from public, anon, authenticated;


/*
 * ============================================================
 * 4. Remove direct browser execution from remaining
 *    Cadence-owned internal/trigger functions.
 *
 * Extension-owned functions are deliberately untouched.
 * ============================================================
 */

revoke execute on function
  public.enforce_platform_role_scope()
from public, anon, authenticated;

revoke execute on function
  public.enforce_project_role_scope()
from public, anon, authenticated;

revoke execute on function
  public.enforce_protected_role_membership_continuity()
from public, anon, authenticated;

revoke execute on function
  public.fan_out_domain_event()
from public, anon, authenticated;

revoke execute on function
  public.prevent_hard_delete()
from public, anon, authenticated;

revoke execute on function
  public.prevent_immutable_mutation()
from public, anon, authenticated;

revoke execute on function
  public.prevent_membership_termination_rewrite()
from public, anon, authenticated;

revoke execute on function
  public.prevent_project_role_transfer_update()
from public, anon, authenticated;

revoke execute on function
  public.touch_updated_at()
from public, anon, authenticated;


/*
 * ============================================================
 * 5. Retire legacy wrapper authorization functions first.
 * ============================================================
 */

drop function if exists
  public.can_access_decision(uuid, uuid);

drop function if exists
  public.can_access_file(uuid, uuid);

drop function if exists
  public.can_access_message(uuid, uuid);

drop function if exists
  public.can_view_user(uuid, uuid);


/*
 * ============================================================
 * 6. Guard against an undiscovered function or policy still
 *    depending on the underlying legacy authorization helpers.
 *
 * Do this before dropping the helpers. We intentionally do not
 * use CASCADE.
 * ============================================================
 */

do $$
declare
  v_function_dependencies text;
  v_policy_dependencies text;
begin
  select
    string_agg(
      format(
        '%I.%I(%s)',
        n.nspname,
        p.proname,
        pg_get_function_identity_arguments(p.oid)
      ),
      ', '
      order by n.nspname, p.proname
    )
  into v_function_dependencies
  from pg_proc p
  join pg_namespace n
    on n.oid = p.pronamespace
  where p.prosrc ~
    'public[.](current_app_user_id|is_project_member|has_project_permission|has_platform_permission|can_view_user|can_access_message|can_access_file|can_access_decision)[[:space:]]*[(]';


  if v_function_dependencies is not null then
    raise exception using
      errcode = '55000',
      message =
        'R02E_LEGACY_AUTH_FUNCTION_DEPENDENCY_REMAINS',
      detail =
        v_function_dependencies;
  end if;


  select
    string_agg(
      format(
        '%I.%I:%I',
        schemaname,
        tablename,
        policyname
      ),
      ', '
      order by schemaname, tablename, policyname
    )
  into v_policy_dependencies
  from pg_policies
  where
    coalesce(qual, '') ~
      '(current_app_user_id|is_project_member|has_project_permission|has_platform_permission|can_view_user|can_access_message|can_access_file|can_access_decision)'
    or
    coalesce(with_check, '') ~
      '(current_app_user_id|is_project_member|has_project_permission|has_platform_permission|can_view_user|can_access_message|can_access_file|can_access_decision)';


  if v_policy_dependencies is not null then
    raise exception using
      errcode = '55000',
      message =
        'R02E_LEGACY_AUTH_POLICY_DEPENDENCY_REMAINS',
      detail =
        v_policy_dependencies;
  end if;
end;
$$;


/*
 * ============================================================
 * 7. Retire the obsolete VS-001 authorization helpers.
 *
 * Project authorization is now ProjectAuthorisationService.
 * Platform/browser authorization is API-side.
 * ============================================================
 */

drop function if exists
  public.has_project_permission(uuid, text, uuid);

drop function if exists
  public.is_project_member(uuid, uuid);

drop function if exists
  public.has_platform_permission(text, uuid);

drop function if exists
  public.current_app_user_id();


/*
 * ============================================================
 * 8. Finally remove browser access to the Cadence public schema.
 *
 * service_role retains schema access.
 * Supabase Auth itself is a separate service and does not depend
 * on browser-role access to Cadence public business objects.
 * ============================================================
 */

revoke usage
on schema public
from public, anon, authenticated;

grant usage
on schema public
to service_role;


/*
 * ============================================================
 * 9. Migration postconditions.
 * ============================================================
 */

do $$
declare
  v_browser_policy_count bigint;
  v_browser_relation_grant_count bigint;
  v_browser_function_count bigint;
  v_browser_default_count bigint;
begin
  /*
   * No anon/authenticated/public browser RLS policies remain.
   */
  select count(*)
  into v_browser_policy_count
  from pg_policies
  where schemaname = 'public'
    and (
      roles::text ilike '%anon%'
      or roles::text ilike '%authenticated%'
      or roles::text ilike '%public%'
    );


  if v_browser_policy_count <> 0 then
    raise exception using
      errcode = '55000',
      message =
        'R02E_BROWSER_RLS_POLICY_REMAINS',
      detail =
        v_browser_policy_count::text;
  end if;


  /*
   * No direct relation privileges remain.
   */
  select count(*)
  into v_browser_relation_grant_count
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee in (
      'anon',
      'authenticated'
    );


  if v_browser_relation_grant_count <> 0 then
    raise exception using
      errcode = '55000',
      message =
        'R02E_BROWSER_RELATION_GRANT_REMAINS',
      detail =
        v_browser_relation_grant_count::text;
  end if;


  /*
   * Browser roles must not execute any non-extension function
   * in the Cadence public schema.
   */
  select count(*)
  into v_browser_function_count
  from pg_proc p
  join pg_namespace n
    on n.oid = p.pronamespace

  left join pg_depend d
    on d.classid = 'pg_proc'::regclass
   and d.objid = p.oid
   and d.deptype = 'e'

  left join pg_extension e
    on e.oid = d.refobjid

  where n.nspname = 'public'
    and e.oid is null
    and (
      has_function_privilege(
        'anon',
        p.oid,
        'EXECUTE'
      )
      or
      has_function_privilege(
        'authenticated',
        p.oid,
        'EXECUTE'
      )
    );


  if v_browser_function_count <> 0 then
    raise exception using
      errcode = '55000',
      message =
        'R02E_BROWSER_FUNCTION_EXECUTE_REMAINS',
      detail =
        v_browser_function_count::text;
  end if;


  /*
   * postgres/public defaults must not recreate direct browser
   * table, sequence or function privileges.
   */
  select count(*)
  into v_browser_default_count
  from pg_default_acl d

  join pg_roles owner_role
    on owner_role.oid = d.defaclrole

  left join pg_namespace n
    on n.oid = d.defaclnamespace

  cross join lateral
    aclexplode(d.defaclacl) acl

  left join pg_roles grantee_role
    on grantee_role.oid = acl.grantee

  where owner_role.rolname = 'postgres'
    and n.nspname = 'public'
    and grantee_role.rolname in (
      'anon',
      'authenticated'
    );


  if v_browser_default_count <> 0 then
    raise exception using
      errcode = '55000',
      message =
        'R02E_BROWSER_DEFAULT_PRIVILEGE_REMAINS',
      detail =
        v_browser_default_count::text;
  end if;


  /*
   * The schema boundary itself must be closed.
   */
  if has_schema_privilege(
    'anon',
    'public',
    'USAGE'
  ) then
    raise exception using
      errcode = '55000',
      message =
        'R02E_ANON_PUBLIC_SCHEMA_USAGE_REMAINS';
  end if;


  if has_schema_privilege(
    'authenticated',
    'public',
    'USAGE'
  ) then
    raise exception using
      errcode = '55000',
      message =
        'R02E_AUTHENTICATED_PUBLIC_SCHEMA_USAGE_REMAINS';
  end if;


  if not has_schema_privilege(
    'service_role',
    'public',
    'USAGE'
  ) then
    raise exception using
      errcode = '55000',
      message =
        'R02E_SERVICE_ROLE_PUBLIC_SCHEMA_USAGE_MISSING';
  end if;
end;
$$;
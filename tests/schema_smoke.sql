-- Cadence v0.1 schema smoke test.
-- Run after all migrations. This test intentionally avoids application data.

do $$
declare
  required_tables text[] := array[
    'users','persons','authentication_identities','organisational_affiliations',
    'roles','permissions','role_permissions','platform_role_assignments',
    'projects','project_memberships','project_role_assignments','project_role_transfers',
    'messages','message_versions','message_mentions','message_reactions',
    'topics','decisions','decision_supersedes','tasks','blockers','milestones','files','file_links',
    'entity_links','source_links','ai_prompt_versions','ai_runs','ai_proposals','alerts','notifications',
    'idempotency_keys','domain_events','audit_events','project_health','project_health_history'
  ];
  t text;
  missing_count integer;
  role_count integer;
  permission_count integer;
  unmapped_user_count integer;
  unmapped_membership_count integer;
  membership_audit_subscription_count integer;
begin
  foreach t in array required_tables loop
    if to_regclass('public.' || t) is null then
      raise exception 'Missing required table: public.%', t;
    end if;
  end loop;

  select count(*) into role_count from public.roles;
  if role_count < 6 then
    raise exception 'Expected at least 6 baseline roles, found %', role_count;
  end if;

  select count(*) into permission_count from public.permissions;
  if permission_count < 40 then
    raise exception 'Expected baseline permission seed, found only % permissions', permission_count;
  end if;

  select count(*) into missing_count
  from public.roles r
  where r.code = 'SYSTEM_ADMIN' and r.scope <> 'platform';
  if missing_count <> 0 then
    raise exception 'SYSTEM_ADMIN must remain platform-scoped';
  end if;

  select count(*) into unmapped_user_count
  from public.users u
  left join public.persons p
    on p.id = u.person_id
  where p.id is null
     or u.person_id <> u.id;

  if unmapped_user_count <> 0 then
    raise exception
      'Expected deterministic VS-001 user-to-Person mappings, found % invalid rows',
      unmapped_user_count;
  end if;

  select count(*) into unmapped_membership_count
  from public.project_memberships pm
  left join public.users u
    on u.id = pm.user_id
  where pm.person_id is null
     or (
       pm.user_id is not null
       and pm.person_id <> u.person_id
     );

  if unmapped_membership_count <> 0 then
    raise exception
      'Expected stable Person mappings for VS-001 memberships, found % invalid rows',
      unmapped_membership_count;
  end if;

  if to_regprocedure(
    'public.change_project_ordinary_role(uuid,uuid,uuid,text,timestamptz,uuid,text,timestamptz,uuid)'
  ) is null then
    raise exception 'Missing VS002-05B ordinary role-change RPC';
  end if;

  if to_regprocedure(
    'public.transfer_project_protected_role(uuid,uuid,uuid,uuid,text,timestamptz,uuid,text,uuid,timestamptz)'
  ) is null then
    raise exception 'Missing VS002-05B protected role-transfer RPC';
  end if;

  select count(*)
  into membership_audit_subscription_count
  from public.domain_event_subscriptions
  where consumer_name = 'audit.domain-events.v1'
    and event_version = 1
    and is_active
    and event_type in (
      'ProjectMemberAdded',
      'ProjectMemberRemoved',
      'ProjectMembershipExpired',
      'ProjectRoleAssigned',
      'ProjectRoleRevoked',
      'ProjectRoleTransferred'
    );

  if membership_audit_subscription_count <> 6 then
    raise exception
      'Expected 6 active VS002 membership Audit subscriptions, found %',
      membership_audit_subscription_count;
  end if;

  raise notice 'Cadence schema smoke test passed.';
end;
$$;

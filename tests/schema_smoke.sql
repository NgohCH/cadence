-- Cadence v0.1 schema smoke test.
-- Run after all migrations. This test intentionally avoids application data.

do $$
declare
  required_tables text[] := array[
    'users','roles','permissions','role_permissions','platform_role_assignments',
    'projects','project_memberships','messages','message_versions','message_mentions','message_reactions',
    'topics','decisions','decision_supersedes','tasks','blockers','milestones','files','file_links',
    'entity_links','source_links','ai_prompt_versions','ai_runs','ai_proposals','alerts','notifications',
    'idempotency_keys','domain_events','audit_events','project_health','project_health_history'
  ];
  t text;
  missing_count integer;
  role_count integer;
  permission_count integer;
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

  raise notice 'Cadence schema smoke test passed.';
end;
$$;

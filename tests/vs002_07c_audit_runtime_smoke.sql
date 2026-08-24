-- VS002-07C local Audit projection and idempotency verification.
-- All fixtures and projections roll back.

\set ON_ERROR_STOP on

begin;

insert into public.persons (id, display_name)
values (
  '07c10000-0000-4000-8000-000000000001',
  'VS007 Audit Actor'
);

insert into public.users (
  id, username, display_name, email, person_id
)
values (
  '07c10000-0000-4000-8000-000000000001',
  'vs007_audit_actor',
  'VS007 Audit Actor',
  'vs007_audit_actor@example.test',
  '07c10000-0000-4000-8000-000000000001'
);

insert into public.projects (
  id, name, owner_user_id
)
values (
  '07c20000-0000-4000-8000-000000000001',
  'VS002-07C Audit Runtime Project',
  '07c10000-0000-4000-8000-000000000001'
);

insert into public.domain_events (
  id,
  event_type,
  event_version,
  aggregate_type,
  aggregate_id,
  project_id,
  actor_type,
  actor_id,
  payload,
  correlation_id,
  occurred_at
)
values
  (
    '07c30000-0000-4000-8000-000000000001',
    'ProjectMemberAdded',
    1,
    'project_membership',
    '07c40000-0000-4000-8000-000000000001',
    '07c20000-0000-4000-8000-000000000001',
    'person',
    '07c10000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'project_id', '07c20000-0000-4000-8000-000000000001',
      'membership_id', '07c40000-0000-4000-8000-000000000001',
      'affected_person_id', '07c50000-0000-4000-8000-000000000001',
      'effective_at', '2026-08-26T08:00:00Z',
      'reason', null,
      'before', null,
      'after', jsonb_build_object('status', 'ACTIVE'),
      'initial_role_assignment', jsonb_build_object(
        'assignment_id', '07c60000-0000-4000-8000-000000000001',
        'role', 'PROJECT_MEMBER'
      )
    ),
    '07c70000-0000-4000-8000-000000000001',
    '2026-08-26T08:00:01Z'
  ),
  (
    '07c30000-0000-4000-8000-000000000002',
    'ProjectMemberRemoved',
    1,
    'project_membership',
    '07c40000-0000-4000-8000-000000000002',
    '07c20000-0000-4000-8000-000000000001',
    'person',
    '07c10000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'project_id', '07c20000-0000-4000-8000-000000000001',
      'membership_id', '07c40000-0000-4000-8000-000000000002',
      'affected_person_id', '07c50000-0000-4000-8000-000000000002',
      'effective_at', '2026-08-26T09:00:00Z',
      'reason', 'Administrative removal',
      'before', jsonb_build_object('status', 'ACTIVE'),
      'after', jsonb_build_object('status', 'ENDED'),
      'closed_role_assignments', jsonb_build_array(
        jsonb_build_object('role', 'PROJECT_MEMBER')
      ),
      'termination', jsonb_build_object(
        'termination_kind', 'ADMINISTRATIVE_REMOVAL',
        'correlation_id', '07c70000-0000-4000-8000-000000000002'
      )
    ),
    '07c70000-0000-4000-8000-000000000002',
    '2026-08-26T09:00:01Z'
  ),
  (
    '07c30000-0000-4000-8000-000000000003',
    'ProjectMembershipExpired',
    1,
    'project_membership',
    '07c40000-0000-4000-8000-000000000003',
    '07c20000-0000-4000-8000-000000000001',
    'system',
    null,
    jsonb_build_object(
      'project_id', '07c20000-0000-4000-8000-000000000001',
      'membership_id', '07c40000-0000-4000-8000-000000000003',
      'affected_person_id', '07c50000-0000-4000-8000-000000000003',
      'effective_at', '2026-08-20T00:00:00Z',
      'materialized_at', '2026-08-26T10:00:00Z',
      'reason', null,
      'before', jsonb_build_object('status', 'ACTIVE'),
      'after', jsonb_build_object('status', 'ENDED'),
      'ended_role_assignments', jsonb_build_array(
        jsonb_build_object('role', 'PROJECT_OBSERVER')
      ),
      'termination', jsonb_build_object(
        'termination_kind', 'EXPIRY',
        'terminated_by_person_id', null
      )
    ),
    '07c70000-0000-4000-8000-000000000003',
    '2026-08-26T10:00:00Z'
  ),
  (
    '07c30000-0000-4000-8000-000000000004',
    'ProjectRoleAssigned',
    1,
    'project_membership',
    '07c40000-0000-4000-8000-000000000004',
    '07c20000-0000-4000-8000-000000000001',
    'person',
    '07c10000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'project_id', '07c20000-0000-4000-8000-000000000001',
      'membership_id', '07c40000-0000-4000-8000-000000000004',
      'affected_person_id', '07c50000-0000-4000-8000-000000000004',
      'assignment_kind', 'ORDINARY_CHANGE',
      'effective_at', '2026-08-26T11:00:00Z',
      'reason', 'Observe only',
      'before', null,
      'after', jsonb_build_object('role', 'PROJECT_OBSERVER')
    ),
    '07c70000-0000-4000-8000-000000000004',
    '2026-08-26T11:00:01Z'
  ),
  (
    '07c30000-0000-4000-8000-000000000005',
    'ProjectRoleRevoked',
    1,
    'project_membership',
    '07c40000-0000-4000-8000-000000000005',
    '07c20000-0000-4000-8000-000000000001',
    'person',
    '07c10000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'project_id', '07c20000-0000-4000-8000-000000000001',
      'membership_id', '07c40000-0000-4000-8000-000000000005',
      'affected_person_id', '07c50000-0000-4000-8000-000000000005',
      'effective_at', '2026-08-26T12:00:00Z',
      'reason', 'Replace role',
      'before', jsonb_build_object(
        'assignment_id', '07c60000-0000-4000-8000-000000000005',
        'role', 'PROJECT_MEMBER',
        'effective_to', null
      ),
      'after', jsonb_build_object(
        'assignment_id', '07c60000-0000-4000-8000-000000000005',
        'role', 'PROJECT_MEMBER',
        'effective_to', '2026-08-26T12:00:00Z'
      ),
      'successor_assignment_id', '07c60000-0000-4000-8000-000000000006'
    ),
    '07c70000-0000-4000-8000-000000000005',
    '2026-08-26T12:00:01Z'
  ),
  (
    '07c30000-0000-4000-8000-000000000006',
    'ProjectRoleTransferred',
    1,
    'project_role_transfer',
    '07c80000-0000-4000-8000-000000000001',
    '07c20000-0000-4000-8000-000000000001',
    'person',
    '07c10000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'project_id', '07c20000-0000-4000-8000-000000000001',
      'outgoing_membership_id', '07c40000-0000-4000-8000-000000000006',
      'incoming_membership_id', '07c40000-0000-4000-8000-000000000007',
      'outgoing_person_id', '07c50000-0000-4000-8000-000000000006',
      'incoming_person_id', '07c50000-0000-4000-8000-000000000007',
      'affected_person_ids', jsonb_build_array(
        '07c50000-0000-4000-8000-000000000006',
        '07c50000-0000-4000-8000-000000000007'
      ),
      'role', 'PROJECT_MANAGER',
      'effective_at', '2026-08-26T13:00:00Z',
      'reason', 'Transfer Manager',
      'before', jsonb_build_object('role', 'PROJECT_MANAGER'),
      'after', jsonb_build_object(
        'outgoing_assignment', jsonb_build_object('effective_to', '2026-08-26T13:00:00Z'),
        'incoming_assignment', jsonb_build_object('effective_from', '2026-08-26T13:00:00Z')
      ),
      'transfer', jsonb_build_object(
        'transfer_id', '07c80000-0000-4000-8000-000000000001',
        'outgoing_assignment_id', '07c60000-0000-4000-8000-000000000007',
        'incoming_assignment_id', '07c60000-0000-4000-8000-000000000008',
        'correlation_id', '07c70000-0000-4000-8000-000000000006'
      )
    ),
    '07c70000-0000-4000-8000-000000000006',
    '2026-08-26T13:00:01Z'
  );


do $$
declare
  v_event_id uuid;
  v_first_projection boolean;
  v_retry_projection boolean;
begin
  for v_event_id in
    select id
    from public.domain_events
    where id between
      '07c30000-0000-4000-8000-000000000001'
      and
      '07c30000-0000-4000-8000-000000000006'
    order by id
  loop
    v_first_projection :=
      public.project_domain_event_to_audit(
        v_event_id
      );

    if not v_first_projection then
      raise exception 'First projection was not inserted: %', v_event_id;
    end if;
  end loop;

  v_retry_projection :=
    public.project_domain_event_to_audit(
      '07c30000-0000-4000-8000-000000000001'
    );

  if v_retry_projection then
    raise exception 'Duplicate projection inserted another audit row';
  end if;
end;
$$;


do $$
declare
  v_actions text[];
begin
  if (
    select count(*)
    from public.audit_events
    where event_id between
      '07c30000-0000-4000-8000-000000000001'
      and
      '07c30000-0000-4000-8000-000000000006'
  ) <> 6 then
    raise exception 'Expected exactly six idempotent Audit projections';
  end if;

  select array_agg(action order by action)
  into v_actions
  from public.audit_events
  where event_id between
    '07c30000-0000-4000-8000-000000000001'
    and
    '07c30000-0000-4000-8000-000000000006';

  if v_actions <> array[
    'project_member.added',
    'project_member.removed',
    'project_membership.expired',
    'project_role.assigned',
    'project_role.revoked',
    'project_role.transferred'
  ] then
    raise exception 'Audit actions invalid: %', v_actions;
  end if;

  if not exists (
    select 1
    from public.audit_events
    where event_id =
      '07c30000-0000-4000-8000-000000000005'
      and before_state ->> 'effective_to' is null
      and after_state ->> 'effective_to' =
        '2026-08-26T12:00:00Z'
      and metadata ->> 'affected_person_id' =
        '07c50000-0000-4000-8000-000000000005'
      and metadata ->> 'reason' = 'Replace role'
      and metadata ->> 'effective_at' =
        '2026-08-26T12:00:00Z'
      and correlation_id =
        '07c70000-0000-4000-8000-000000000005'
  ) then
    raise exception 'Role before/after or provenance was not preserved';
  end if;

  if not exists (
    select 1
    from public.audit_events
    where event_id =
      '07c30000-0000-4000-8000-000000000003'
      and actor_type = 'system'
      and actor_id is null
      and metadata ->> 'effective_at' =
        '2026-08-20T00:00:00Z'
      and metadata ->> 'materialized_at' =
        '2026-08-26T10:00:00Z'
      and created_at =
        '2026-08-26T10:00:00Z'::timestamptz
  ) then
    raise exception 'Expiry actor or temporal provenance invalid';
  end if;

  if not exists (
    select 1
    from public.audit_events
    where event_id =
      '07c30000-0000-4000-8000-000000000006'
      and actor_type = 'person'
      and actor_id =
        '07c10000-0000-4000-8000-000000000001'
      and entity_type = 'project_role_transfer'
      and entity_id =
        '07c80000-0000-4000-8000-000000000001'
      and metadata ->> 'outgoing_person_id' =
        '07c50000-0000-4000-8000-000000000006'
      and metadata ->> 'incoming_person_id' =
        '07c50000-0000-4000-8000-000000000007'
      and metadata -> 'transfer' ->> 'incoming_assignment_id' =
        '07c60000-0000-4000-8000-000000000008'
  ) then
    raise exception 'Transfer provenance invalid';
  end if;

  if (
    select count(*)
    from public.domain_event_subscriptions
    where consumer_name = 'audit.domain-events.v1'
      and event_type in (
        'ProjectMemberAdded',
        'ProjectMemberRemoved',
        'ProjectMembershipExpired',
        'ProjectRoleAssigned',
        'ProjectRoleRevoked',
        'ProjectRoleTransferred'
      )
      and event_version = 1
      and is_active
  ) <> 6 then
    raise exception 'Audit subscription set incomplete';
  end if;
end;
$$;

rollback;

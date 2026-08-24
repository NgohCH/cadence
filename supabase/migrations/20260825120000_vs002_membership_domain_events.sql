-- Cadence v0.1
-- VS002-07B: transactional Project Membership domain-event producers.
--
-- This migration is prospective. It does not backfill historical events.


/* VS002 events identify a human actor by stable Person identity. */
alter table public.domain_events
  drop constraint domain_events_actor_type_check;

alter table public.domain_events
  add constraint domain_events_actor_type_check
  check (
    actor_type in (
      'human',
      'person',
      'agent',
      'system'
    )
  );


/*
 * Preserve the already runtime-verified state-transition implementations.
 * The public RPC wrappers below call these functions and emit events in the
 * same PostgreSQL transaction. The helpers are not executable API surfaces.
 */
alter function public.add_project_member(
  uuid, uuid, uuid, timestamptz, timestamptz,
  uuid, timestamptz, uuid, uuid, timestamptz
) rename to vs002_07_add_project_member_state;

alter function public.change_project_ordinary_role(
  uuid, uuid, uuid, text, timestamptz,
  uuid, text, timestamptz
) rename to vs002_07_change_ordinary_role_state;

alter function public.transfer_project_protected_role(
  uuid, uuid, uuid, uuid, text, timestamptz,
  uuid, text, uuid, timestamptz
) rename to vs002_07_transfer_protected_role_state;

alter function public.terminate_project_membership(
  uuid, uuid, timestamptz, uuid, text, uuid
) rename to vs002_07_terminate_membership_state;

alter function public.finalize_project_membership_expiry(
  uuid, uuid, timestamptz, text, uuid
) rename to vs002_07_finalize_expiry_state;


revoke all on function public.vs002_07_add_project_member_state(
  uuid, uuid, uuid, timestamptz, timestamptz,
  uuid, timestamptz, uuid, uuid, timestamptz
) from public, anon, authenticated, service_role;

revoke all on function public.vs002_07_change_ordinary_role_state(
  uuid, uuid, uuid, text, timestamptz,
  uuid, text, timestamptz
) from public, anon, authenticated, service_role;

revoke all on function public.vs002_07_transfer_protected_role_state(
  uuid, uuid, uuid, uuid, text, timestamptz,
  uuid, text, uuid, timestamptz
) from public, anon, authenticated, service_role;

revoke all on function public.vs002_07_terminate_membership_state(
  uuid, uuid, timestamptz, uuid, text, uuid
) from public, anon, authenticated, service_role;

revoke all on function public.vs002_07_finalize_expiry_state(
  uuid, uuid, timestamptz, text, uuid
) from public, anon, authenticated, service_role;


/* Payload snapshots use the existing snake_case event convention. */
create function public.vs002_07_membership_event_state(
  p_membership public.project_memberships
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'membership_id', p_membership.id,
    'person_id', p_membership.person_id,
    'project_id', p_membership.project_id,
    'effective_from', p_membership.effective_from,
    'effective_to', p_membership.effective_to,
    'status', p_membership.membership_status,
    'granted_by_person_id', p_membership.granted_by_person_id,
    'created_at', p_membership.created_at,
    'termination_kind', p_membership.termination_kind,
    'terminated_by_person_id', p_membership.terminated_by_person_id,
    'termination_reason', p_membership.termination_reason,
    'termination_correlation_id', p_membership.termination_correlation_id,
    'terminated_at', p_membership.terminated_at
  );
$$;


create function public.vs002_07_role_event_state(
  p_assignment public.project_role_assignments
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'assignment_id', p_assignment.id,
    'project_id', p_assignment.project_id,
    'membership_id', p_assignment.membership_id,
    'role', p_assignment.role,
    'effective_from', p_assignment.effective_from,
    'effective_to', p_assignment.effective_to,
    'assigned_by_person_id', p_assignment.assigned_by_person_id,
    'change_reason', p_assignment.change_reason,
    'created_at', p_assignment.created_at
  );
$$;


create function public.vs002_07_role_event_states(
  p_assignments jsonb
)
returns jsonb
language sql
immutable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'assignment_id', item -> 'id',
        'project_id', item -> 'project_id',
        'membership_id', item -> 'membership_id',
        'role', item -> 'role',
        'effective_from', item -> 'effective_from',
        'effective_to', item -> 'effective_to',
        'assigned_by_person_id', item -> 'assigned_by_person_id',
        'change_reason', item -> 'change_reason',
        'created_at', item -> 'created_at'
      )
      order by item ->> 'effective_from', item ->> 'id'
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(
    coalesce(p_assignments, '[]'::jsonb)
  ) as item;
$$;


revoke all on function public.vs002_07_membership_event_state(
  public.project_memberships
) from public, anon, authenticated, service_role;

revoke all on function public.vs002_07_role_event_state(
  public.project_role_assignments
) from public, anon, authenticated, service_role;

revoke all on function public.vs002_07_role_event_states(
  jsonb
) from public, anon, authenticated, service_role;


create function public.add_project_member(
  p_membership_id uuid,
  p_project_id uuid,
  p_person_id uuid,
  p_effective_from timestamptz,
  p_effective_to timestamptz,
  p_granted_by_person_id uuid,
  p_membership_created_at timestamptz,
  p_role_assignment_id uuid,
  p_assigned_by_person_id uuid,
  p_role_created_at timestamptz,
  p_correlation_id uuid
)
returns table (
  membership_id uuid,
  membership_person_id uuid,
  membership_project_id uuid,
  membership_effective_from timestamptz,
  membership_effective_to timestamptz,
  membership_status text,
  membership_granted_by_person_id uuid,
  membership_created_at timestamptz,
  membership_termination_reason text,
  role_assignment_id uuid,
  role_assignment_project_id uuid,
  role_assignment_membership_id uuid,
  role_assignment_role text,
  role_assignment_effective_from timestamptz,
  role_assignment_effective_to timestamptz,
  role_assignment_assigned_by_person_id uuid,
  role_assignment_change_reason text,
  role_assignment_created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_correlation_id is null then
    raise exception using
      errcode = '22023',
      message = 'PROJECT_MEMBER_ADMISSION_REFERENCE_MISSING';
  end if;

  return query
  with mutation as materialized (
    select *
    from public.vs002_07_add_project_member_state(
      p_membership_id,
      p_project_id,
      p_person_id,
      p_effective_from,
      p_effective_to,
      p_granted_by_person_id,
      p_membership_created_at,
      p_role_assignment_id,
      p_assigned_by_person_id,
      p_role_created_at
    )
  ),
  event_rows as (
    select
      'ProjectMemberAdded'::text as event_type,
      jsonb_build_object(
        'project_id', m.membership_project_id,
        'membership_id', m.membership_id,
        'affected_person_id', m.membership_person_id,
        'effective_at', m.membership_effective_from,
        'reason', null,
        'before', null,
        'after', jsonb_build_object(
          'membership_id', m.membership_id,
          'person_id', m.membership_person_id,
          'project_id', m.membership_project_id,
          'effective_from', m.membership_effective_from,
          'effective_to', m.membership_effective_to,
          'status', m.membership_status,
          'granted_by_person_id', m.membership_granted_by_person_id,
          'created_at', m.membership_created_at,
          'termination_kind', null,
          'terminated_by_person_id', null,
          'termination_reason', m.membership_termination_reason,
          'termination_correlation_id', null,
          'terminated_at', null
        ),
        'initial_role_assignment', jsonb_build_object(
          'assignment_id', m.role_assignment_id,
          'project_id', m.role_assignment_project_id,
          'membership_id', m.role_assignment_membership_id,
          'role', m.role_assignment_role,
          'effective_from', m.role_assignment_effective_from,
          'effective_to', m.role_assignment_effective_to,
          'assigned_by_person_id', m.role_assignment_assigned_by_person_id,
          'change_reason', m.role_assignment_change_reason,
          'created_at', m.role_assignment_created_at
        )
      ) as payload
    from mutation m

    union all

    select
      'ProjectRoleAssigned'::text,
      jsonb_build_object(
        'project_id', m.membership_project_id,
        'membership_id', m.membership_id,
        'affected_person_id', m.membership_person_id,
        'assignment_kind', 'INITIAL_ORDINARY',
        'effective_at', m.role_assignment_effective_from,
        'reason', null,
        'previous_assignment_id', null,
        'before', null,
        'after', jsonb_build_object(
          'assignment_id', m.role_assignment_id,
          'project_id', m.role_assignment_project_id,
          'membership_id', m.role_assignment_membership_id,
          'role', m.role_assignment_role,
          'effective_from', m.role_assignment_effective_from,
          'effective_to', m.role_assignment_effective_to,
          'assigned_by_person_id', m.role_assignment_assigned_by_person_id,
          'change_reason', m.role_assignment_change_reason,
          'created_at', m.role_assignment_created_at
        ),
        'transfer', null
      )
    from mutation m
  ),
  emitted as (
    insert into public.domain_events (
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
    select
      e.event_type,
      1,
      'project_membership',
      p_membership_id,
      p_project_id,
      'person',
      p_granted_by_person_id,
      e.payload,
      p_correlation_id,
      p_membership_created_at
    from event_rows e
    returning id
  )
  select m.*
  from mutation m
  cross join (
    select count(*) as emitted_count
    from emitted
  ) event_count
  where event_count.emitted_count = 2;
end;
$$;


create function public.change_project_ordinary_role(
  p_assignment_id uuid,
  p_project_id uuid,
  p_membership_id uuid,
  p_role text,
  p_effective_at timestamptz,
  p_assigned_by_person_id uuid,
  p_change_reason text,
  p_created_at timestamptz,
  p_correlation_id uuid
)
returns table (
  closed_assignment_id uuid,
  closed_assignment_project_id uuid,
  closed_assignment_membership_id uuid,
  closed_assignment_role text,
  closed_assignment_effective_from timestamptz,
  closed_assignment_effective_to timestamptz,
  closed_assignment_assigned_by_person_id uuid,
  closed_assignment_change_reason text,
  closed_assignment_created_at timestamptz,
  new_assignment_id uuid,
  new_assignment_project_id uuid,
  new_assignment_membership_id uuid,
  new_assignment_role text,
  new_assignment_effective_from timestamptz,
  new_assignment_effective_to timestamptz,
  new_assignment_assigned_by_person_id uuid,
  new_assignment_change_reason text,
  new_assignment_created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_membership public.project_memberships%rowtype;
  v_before public.project_role_assignments%rowtype;
  v_had_before boolean := false;
begin
  if p_correlation_id is null then
    raise exception using
      errcode = '22023',
      message = 'PROJECT_ROLE_REFERENCE_MISSING';
  end if;

  select membership.*
  into v_membership
  from public.project_memberships membership
  where membership.id = p_membership_id
  for update;

  if found then
    select assignment.*
    into v_before
    from public.project_role_assignments assignment
    where assignment.project_id = p_project_id
      and assignment.membership_id = p_membership_id
      and assignment.role in (
        'PROJECT_MEMBER',
        'PROJECT_OBSERVER',
        'PROJECT_AUDITOR'
      )
      and assignment.effective_from <= p_effective_at
      and (
        assignment.effective_to is null
        or p_effective_at < assignment.effective_to
      )
    for update;

    v_had_before := found;
  end if;

  return query
  with mutation as materialized (
    select *
    from public.vs002_07_change_ordinary_role_state(
      p_assignment_id,
      p_project_id,
      p_membership_id,
      p_role,
      p_effective_at,
      p_assigned_by_person_id,
      p_change_reason,
      p_created_at
    )
  ),
  event_rows as (
    select
      'ProjectRoleRevoked'::text as event_type,
      jsonb_build_object(
        'project_id', m.closed_assignment_project_id,
        'membership_id', m.closed_assignment_membership_id,
        'affected_person_id', v_membership.person_id,
        'effective_at', p_effective_at,
        'reason', p_change_reason,
        'revocation_kind', 'ORDINARY_REPLACEMENT',
        'before', public.vs002_07_role_event_state(v_before),
        'after', jsonb_build_object(
          'assignment_id', m.closed_assignment_id,
          'project_id', m.closed_assignment_project_id,
          'membership_id', m.closed_assignment_membership_id,
          'role', m.closed_assignment_role,
          'effective_from', m.closed_assignment_effective_from,
          'effective_to', m.closed_assignment_effective_to,
          'assigned_by_person_id', m.closed_assignment_assigned_by_person_id,
          'change_reason', m.closed_assignment_change_reason,
          'created_at', m.closed_assignment_created_at
        ),
        'successor_assignment_id', m.new_assignment_id
      ) as payload
    from mutation m
    where v_had_before

    union all

    select
      'ProjectRoleAssigned'::text,
      jsonb_build_object(
        'project_id', m.new_assignment_project_id,
        'membership_id', m.new_assignment_membership_id,
        'affected_person_id', v_membership.person_id,
        'assignment_kind', 'ORDINARY_CHANGE',
        'effective_at', m.new_assignment_effective_from,
        'reason', m.new_assignment_change_reason,
        'previous_assignment_id', m.closed_assignment_id,
        'before', null,
        'after', jsonb_build_object(
          'assignment_id', m.new_assignment_id,
          'project_id', m.new_assignment_project_id,
          'membership_id', m.new_assignment_membership_id,
          'role', m.new_assignment_role,
          'effective_from', m.new_assignment_effective_from,
          'effective_to', m.new_assignment_effective_to,
          'assigned_by_person_id', m.new_assignment_assigned_by_person_id,
          'change_reason', m.new_assignment_change_reason,
          'created_at', m.new_assignment_created_at
        ),
        'transfer', null
      )
    from mutation m
  ),
  emitted as (
    insert into public.domain_events (
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
    select
      e.event_type,
      1,
      'project_membership',
      p_membership_id,
      p_project_id,
      'person',
      p_assigned_by_person_id,
      e.payload,
      p_correlation_id,
      p_created_at
    from event_rows e
    returning id
  )
  select m.*
  from mutation m
  cross join (
    select count(*) as emitted_count
    from emitted
  ) event_count
  where event_count.emitted_count =
    case when v_had_before then 2 else 1 end;
end;
$$;


create function public.transfer_project_protected_role(
  p_transfer_id uuid,
  p_incoming_assignment_id uuid,
  p_project_id uuid,
  p_incoming_membership_id uuid,
  p_role text,
  p_effective_at timestamptz,
  p_authorised_by_person_id uuid,
  p_reason text,
  p_correlation_id uuid,
  p_created_at timestamptz
)
returns table (
  closed_assignment_id uuid,
  closed_assignment_project_id uuid,
  closed_assignment_membership_id uuid,
  closed_assignment_role text,
  closed_assignment_effective_from timestamptz,
  closed_assignment_effective_to timestamptz,
  closed_assignment_assigned_by_person_id uuid,
  closed_assignment_change_reason text,
  closed_assignment_created_at timestamptz,
  new_assignment_id uuid,
  new_assignment_project_id uuid,
  new_assignment_membership_id uuid,
  new_assignment_role text,
  new_assignment_effective_from timestamptz,
  new_assignment_effective_to timestamptz,
  new_assignment_assigned_by_person_id uuid,
  new_assignment_change_reason text,
  new_assignment_created_at timestamptz,
  transfer_id uuid,
  transfer_project_id uuid,
  transfer_role text,
  transfer_outgoing_assignment_id uuid,
  transfer_incoming_assignment_id uuid,
  transfer_authorised_by_person_id uuid,
  transfer_reason text,
  transfer_correlation_id uuid,
  transfer_effective_at timestamptz,
  transfer_created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_outgoing public.project_role_assignments%rowtype;
  v_outgoing_person_id uuid;
  v_incoming_person_id uuid;
  v_had_outgoing boolean := false;
begin
  perform 1
  from public.projects project
  where project.id = p_project_id
  for update;

  if found then
    select assignment.*
    into v_outgoing
    from public.project_role_assignments assignment
    where assignment.project_id = p_project_id
      and assignment.role = p_role
      and assignment.effective_from <= p_effective_at
      and (
        assignment.effective_to is null
        or p_effective_at < assignment.effective_to
      )
    for update;

    v_had_outgoing := found;

    if v_had_outgoing then
      select membership.person_id
      into v_outgoing_person_id
      from public.project_memberships membership
      where membership.id = v_outgoing.membership_id;
    end if;

    select membership.person_id
    into v_incoming_person_id
    from public.project_memberships membership
    where membership.id = p_incoming_membership_id;
  end if;

  return query
  with mutation as materialized (
    select *
    from public.vs002_07_transfer_protected_role_state(
      p_transfer_id,
      p_incoming_assignment_id,
      p_project_id,
      p_incoming_membership_id,
      p_role,
      p_effective_at,
      p_authorised_by_person_id,
      p_reason,
      p_correlation_id,
      p_created_at
    )
  ),
  emitted as (
    insert into public.domain_events (
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
    select
      case
        when v_had_outgoing then 'ProjectRoleTransferred'
        else 'ProjectRoleAssigned'
      end,
      1,
      case
        when v_had_outgoing then 'project_role_transfer'
        else 'project_membership'
      end,
      case
        when v_had_outgoing then m.transfer_id
        else m.new_assignment_membership_id
      end,
      p_project_id,
      'person',
      p_authorised_by_person_id,
      case
        when v_had_outgoing then
          jsonb_build_object(
            'project_id', p_project_id,
            'outgoing_membership_id', m.closed_assignment_membership_id,
            'incoming_membership_id', m.new_assignment_membership_id,
            'outgoing_person_id', v_outgoing_person_id,
            'incoming_person_id', v_incoming_person_id,
            'affected_person_ids', jsonb_build_array(
              v_outgoing_person_id,
              v_incoming_person_id
            ),
            'role', m.transfer_role,
            'effective_at', m.transfer_effective_at,
            'reason', m.transfer_reason,
            'before', public.vs002_07_role_event_state(v_outgoing),
            'after', jsonb_build_object(
              'outgoing_assignment', jsonb_build_object(
                'assignment_id', m.closed_assignment_id,
                'project_id', m.closed_assignment_project_id,
                'membership_id', m.closed_assignment_membership_id,
                'role', m.closed_assignment_role,
                'effective_from', m.closed_assignment_effective_from,
                'effective_to', m.closed_assignment_effective_to,
                'assigned_by_person_id', m.closed_assignment_assigned_by_person_id,
                'change_reason', m.closed_assignment_change_reason,
                'created_at', m.closed_assignment_created_at
              ),
              'incoming_assignment', jsonb_build_object(
                'assignment_id', m.new_assignment_id,
                'project_id', m.new_assignment_project_id,
                'membership_id', m.new_assignment_membership_id,
                'role', m.new_assignment_role,
                'effective_from', m.new_assignment_effective_from,
                'effective_to', m.new_assignment_effective_to,
                'assigned_by_person_id', m.new_assignment_assigned_by_person_id,
                'change_reason', m.new_assignment_change_reason,
                'created_at', m.new_assignment_created_at
              )
            ),
            'transfer', jsonb_build_object(
              'transfer_id', m.transfer_id,
              'project_id', m.transfer_project_id,
              'role', m.transfer_role,
              'outgoing_assignment_id', m.transfer_outgoing_assignment_id,
              'incoming_assignment_id', m.transfer_incoming_assignment_id,
              'authorised_by_person_id', m.transfer_authorised_by_person_id,
              'reason', m.transfer_reason,
              'correlation_id', m.transfer_correlation_id,
              'effective_at', m.transfer_effective_at,
              'created_at', m.transfer_created_at
            )
          )
        else
          jsonb_build_object(
            'project_id', p_project_id,
            'membership_id', m.new_assignment_membership_id,
            'affected_person_id', v_incoming_person_id,
            'assignment_kind', 'PROTECTED_APPOINTMENT',
            'effective_at', m.new_assignment_effective_from,
            'reason', m.transfer_reason,
            'previous_assignment_id', null,
            'before', null,
            'after', jsonb_build_object(
              'assignment_id', m.new_assignment_id,
              'project_id', m.new_assignment_project_id,
              'membership_id', m.new_assignment_membership_id,
              'role', m.new_assignment_role,
              'effective_from', m.new_assignment_effective_from,
              'effective_to', m.new_assignment_effective_to,
              'assigned_by_person_id', m.new_assignment_assigned_by_person_id,
              'change_reason', m.new_assignment_change_reason,
              'created_at', m.new_assignment_created_at
            ),
            'transfer', jsonb_build_object(
              'transfer_id', m.transfer_id,
              'project_id', m.transfer_project_id,
              'role', m.transfer_role,
              'outgoing_assignment_id', m.transfer_outgoing_assignment_id,
              'incoming_assignment_id', m.transfer_incoming_assignment_id,
              'authorised_by_person_id', m.transfer_authorised_by_person_id,
              'reason', m.transfer_reason,
              'correlation_id', m.transfer_correlation_id,
              'effective_at', m.transfer_effective_at,
              'created_at', m.transfer_created_at
            )
          )
      end,
      p_correlation_id,
      p_created_at
    from mutation m
    returning id
  )
  select m.*
  from mutation m
  cross join (
    select count(*) as emitted_count
    from emitted
  ) event_count
  where event_count.emitted_count = 1;
end;
$$;


create function public.terminate_project_membership(
  p_project_id uuid,
  p_membership_id uuid,
  p_effective_at timestamptz,
  p_terminated_by_person_id uuid,
  p_termination_reason text,
  p_correlation_id uuid
)
returns table (
  lifecycle_outcome text,
  result_membership_id uuid,
  result_person_id uuid,
  result_project_id uuid,
  result_effective_from timestamptz,
  result_effective_to timestamptz,
  result_membership_status text,
  result_granted_by_person_id uuid,
  result_created_at timestamptz,
  result_termination_kind text,
  result_terminated_by_person_id uuid,
  result_termination_reason text,
  result_termination_correlation_id uuid,
  result_terminated_at timestamptz,
  closed_assignments jsonb
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before public.project_memberships%rowtype;
begin
  perform 1
  from public.projects project
  where project.id = p_project_id
  for update;

  if found then
    select membership.*
    into v_before
    from public.project_memberships membership
    where membership.id = p_membership_id
    for update;
  end if;

  return query
  with mutation as materialized (
    select *
    from public.vs002_07_terminate_membership_state(
      p_project_id,
      p_membership_id,
      p_effective_at,
      p_terminated_by_person_id,
      p_termination_reason,
      p_correlation_id
    )
  ),
  emitted as (
    insert into public.domain_events (
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
    select
      'ProjectMemberRemoved',
      1,
      'project_membership',
      m.result_membership_id,
      m.result_project_id,
      'person',
      m.result_terminated_by_person_id,
      jsonb_build_object(
        'project_id', m.result_project_id,
        'membership_id', m.result_membership_id,
        'affected_person_id', m.result_person_id,
        'effective_at', m.result_effective_to,
        'reason', m.result_termination_reason,
        'before', public.vs002_07_membership_event_state(v_before),
        'after', jsonb_build_object(
          'membership_id', m.result_membership_id,
          'person_id', m.result_person_id,
          'project_id', m.result_project_id,
          'effective_from', m.result_effective_from,
          'effective_to', m.result_effective_to,
          'status', m.result_membership_status,
          'granted_by_person_id', m.result_granted_by_person_id,
          'created_at', m.result_created_at,
          'termination_kind', m.result_termination_kind,
          'terminated_by_person_id', m.result_terminated_by_person_id,
          'termination_reason', m.result_termination_reason,
          'termination_correlation_id', m.result_termination_correlation_id,
          'terminated_at', m.result_terminated_at
        ),
        'closed_role_assignments',
          public.vs002_07_role_event_states(m.closed_assignments),
        'termination', jsonb_build_object(
          'termination_kind', m.result_termination_kind,
          'terminated_by_person_id', m.result_terminated_by_person_id,
          'termination_reason', m.result_termination_reason,
          'correlation_id', m.result_termination_correlation_id,
          'terminated_at', m.result_terminated_at
        )
      ),
      m.result_termination_correlation_id,
      m.result_terminated_at
    from mutation m
    where m.lifecycle_outcome = 'ENDED'
    returning id
  )
  select m.*
  from mutation m
  cross join (
    select count(*) as emitted_count
    from emitted
  ) event_count;
end;
$$;


create function public.finalize_project_membership_expiry(
  p_project_id uuid,
  p_membership_id uuid,
  p_finalized_at timestamptz,
  p_termination_reason text,
  p_correlation_id uuid
)
returns table (
  lifecycle_outcome text,
  result_membership_id uuid,
  result_person_id uuid,
  result_project_id uuid,
  result_effective_from timestamptz,
  result_effective_to timestamptz,
  result_membership_status text,
  result_granted_by_person_id uuid,
  result_created_at timestamptz,
  result_termination_kind text,
  result_terminated_by_person_id uuid,
  result_termination_reason text,
  result_termination_correlation_id uuid,
  result_terminated_at timestamptz,
  closed_assignments jsonb
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before public.project_memberships%rowtype;
begin
  perform 1
  from public.projects project
  where project.id = p_project_id
  for update;

  if found then
    select membership.*
    into v_before
    from public.project_memberships membership
    where membership.id = p_membership_id
    for update;
  end if;

  return query
  with mutation as materialized (
    select *
    from public.vs002_07_finalize_expiry_state(
      p_project_id,
      p_membership_id,
      p_finalized_at,
      p_termination_reason,
      p_correlation_id
    )
  ),
  emitted as (
    insert into public.domain_events (
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
    select
      'ProjectMembershipExpired',
      1,
      'project_membership',
      m.result_membership_id,
      m.result_project_id,
      'system',
      null,
      jsonb_build_object(
        'project_id', m.result_project_id,
        'membership_id', m.result_membership_id,
        'affected_person_id', m.result_person_id,
        'effective_at', m.result_effective_to,
        'materialized_at', m.result_terminated_at,
        'reason', m.result_termination_reason,
        'before', public.vs002_07_membership_event_state(v_before),
        'after', jsonb_build_object(
          'membership_id', m.result_membership_id,
          'person_id', m.result_person_id,
          'project_id', m.result_project_id,
          'effective_from', m.result_effective_from,
          'effective_to', m.result_effective_to,
          'status', m.result_membership_status,
          'granted_by_person_id', m.result_granted_by_person_id,
          'created_at', m.result_created_at,
          'termination_kind', m.result_termination_kind,
          'terminated_by_person_id', m.result_terminated_by_person_id,
          'termination_reason', m.result_termination_reason,
          'termination_correlation_id', m.result_termination_correlation_id,
          'terminated_at', m.result_terminated_at
        ),
        'ended_role_assignments',
          public.vs002_07_role_event_states(m.closed_assignments),
        'termination', jsonb_build_object(
          'termination_kind', m.result_termination_kind,
          'terminated_by_person_id', m.result_terminated_by_person_id,
          'termination_reason', m.result_termination_reason,
          'correlation_id', m.result_termination_correlation_id,
          'terminated_at', m.result_terminated_at
        )
      ),
      m.result_termination_correlation_id,
      m.result_terminated_at
    from mutation m
    where m.lifecycle_outcome = 'ENDED'
    returning id
  )
  select m.*
  from mutation m
  cross join (
    select count(*) as emitted_count
    from emitted
  ) event_count;
end;
$$;


/* Public role-management RPCs remain backend-only. */
revoke all on function public.add_project_member(
  uuid, uuid, uuid, timestamptz, timestamptz,
  uuid, timestamptz, uuid, uuid, timestamptz, uuid
) from public, anon, authenticated;
grant execute on function public.add_project_member(
  uuid, uuid, uuid, timestamptz, timestamptz,
  uuid, timestamptz, uuid, uuid, timestamptz, uuid
) to service_role;

revoke all on function public.change_project_ordinary_role(
  uuid, uuid, uuid, text, timestamptz,
  uuid, text, timestamptz, uuid
) from public, anon, authenticated;
grant execute on function public.change_project_ordinary_role(
  uuid, uuid, uuid, text, timestamptz,
  uuid, text, timestamptz, uuid
) to service_role;

revoke all on function public.transfer_project_protected_role(
  uuid, uuid, uuid, uuid, text, timestamptz,
  uuid, text, uuid, timestamptz
) from public, anon, authenticated;
grant execute on function public.transfer_project_protected_role(
  uuid, uuid, uuid, uuid, text, timestamptz,
  uuid, text, uuid, timestamptz
) to service_role;

revoke all on function public.terminate_project_membership(
  uuid, uuid, timestamptz, uuid, text, uuid
) from public, anon, authenticated;
grant execute on function public.terminate_project_membership(
  uuid, uuid, timestamptz, uuid, text, uuid
) to service_role;

revoke all on function public.finalize_project_membership_expiry(
  uuid, uuid, timestamptz, text, uuid
) from public, anon, authenticated;
grant execute on function public.finalize_project_membership_expiry(
  uuid, uuid, timestamptz, text, uuid
) to service_role;

-- Cadence v0.1
-- VS002-07C: Audit consumption of Project Membership domain events.
--
-- This migration registers prospective subscriptions only. It deliberately
-- does not replay or backfill historical membership mutations.


/* Audit preserves the stable Person actor literal from VS002 envelopes. */
alter table public.audit_events
  drop constraint audit_events_actor_type_check;

alter table public.audit_events
  add constraint audit_events_actor_type_check
  check (
    actor_type in (
      'human',
      'person',
      'agent',
      'system'
    )
  );


create or replace function public.project_domain_event_to_audit(
  p_event_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.domain_events%rowtype;
  v_action text;
  v_before_state jsonb;
  v_after_state jsonb;
  v_metadata jsonb;
  v_inserted_rows integer;
begin
  /* Audit consumes the immutable event envelope and payload only. */
  select *
  into v_event
  from public.domain_events
  where id = p_event_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'AUDIT_DOMAIN_EVENT_NOT_FOUND';
  end if;

  if v_event.event_version <> 1
     or v_event.event_type not in (
       'MessageCreated',
       'AIProposalCreated',
       'AIProposalConfirmed',
       'AIProposalEdited',
       'AIProposalRejected',
       'TaskCreated',
       'ProjectMemberAdded',
       'ProjectMemberRemoved',
       'ProjectMembershipExpired',
       'ProjectRoleAssigned',
       'ProjectRoleRevoked',
       'ProjectRoleTransferred'
     ) then
    raise exception using
      errcode = '22023',
      message = 'AUDIT_DOMAIN_EVENT_UNSUPPORTED';
  end if;

  v_action :=
    case v_event.event_type
      when 'MessageCreated' then
        'message.created'
      when 'AIProposalCreated' then
        'ai_proposal.created'
      when 'AIProposalConfirmed' then
        'ai_proposal.confirmed'
      when 'AIProposalEdited' then
        'ai_proposal.edited'
      when 'AIProposalRejected' then
        'ai_proposal.rejected'
      when 'TaskCreated' then
        'task.created'
      when 'ProjectMemberAdded' then
        'project_member.added'
      when 'ProjectMemberRemoved' then
        'project_member.removed'
      when 'ProjectMembershipExpired' then
        'project_membership.expired'
      when 'ProjectRoleAssigned' then
        'project_role.assigned'
      when 'ProjectRoleRevoked' then
        'project_role.revoked'
      when 'ProjectRoleTransferred' then
        'project_role.transferred'
    end;

  if v_event.event_type in (
    'ProjectMemberAdded',
    'ProjectMemberRemoved',
    'ProjectMembershipExpired',
    'ProjectRoleAssigned',
    'ProjectRoleRevoked',
    'ProjectRoleTransferred'
  ) then
    /* Producer snapshots are authoritative; Audit does not reconstruct. */
    v_before_state :=
      v_event.payload -> 'before';
    v_after_state :=
      v_event.payload -> 'after';
  else
    v_before_state :=
      case
        when v_event.event_type in (
          'AIProposalConfirmed',
          'AIProposalEdited',
          'AIProposalRejected'
        ) then
          jsonb_build_object(
            'status',
            v_event.payload -> 'previous_status'
          )
        else
          null
      end;
    v_after_state :=
      v_event.payload;
  end if;

  v_metadata :=
    jsonb_build_object(
      'domain_event_type',
        v_event.event_type,
      'domain_event_version',
        v_event.event_version,
      'causation_id',
        v_event.causation_id,
      'correlation_id',
        v_event.correlation_id,
      'occurred_at',
        v_event.occurred_at,
      'projection',
        'domain_event'
    );

  if v_event.event_type in (
    'ProjectMemberAdded',
    'ProjectMemberRemoved',
    'ProjectMembershipExpired',
    'ProjectRoleAssigned',
    'ProjectRoleRevoked',
    'ProjectRoleTransferred'
  ) then
    v_metadata :=
      v_metadata ||
      jsonb_strip_nulls(
        jsonb_build_object(
          'affected_person_id',
            v_event.payload -> 'affected_person_id',
          'affected_person_ids',
            v_event.payload -> 'affected_person_ids',
          'membership_id',
            v_event.payload -> 'membership_id',
          'outgoing_person_id',
            v_event.payload -> 'outgoing_person_id',
          'incoming_person_id',
            v_event.payload -> 'incoming_person_id',
          'outgoing_membership_id',
            v_event.payload -> 'outgoing_membership_id',
          'incoming_membership_id',
            v_event.payload -> 'incoming_membership_id',
          'role',
            v_event.payload -> 'role',
          'assignment_kind',
            v_event.payload -> 'assignment_kind',
          'effective_at',
            v_event.payload -> 'effective_at',
          'materialized_at',
            v_event.payload -> 'materialized_at',
          'reason',
            v_event.payload -> 'reason',
          'previous_assignment_id',
            v_event.payload -> 'previous_assignment_id',
          'successor_assignment_id',
            v_event.payload -> 'successor_assignment_id',
          'initial_role_assignment',
            v_event.payload -> 'initial_role_assignment',
          'closed_role_assignments',
            v_event.payload -> 'closed_role_assignments',
          'ended_role_assignments',
            v_event.payload -> 'ended_role_assignments',
          'termination',
            v_event.payload -> 'termination',
          'transfer',
            v_event.payload -> 'transfer'
        )
      );
  end if;

  insert into public.audit_events (
    event_id,
    correlation_id,
    project_id,
    actor_type,
    actor_id,
    actor_role,
    event_type,
    entity_type,
    entity_id,
    action,
    before_state,
    after_state,
    source_type,
    source_id,
    metadata,
    created_at
  )
  values (
    v_event.id,
    v_event.correlation_id,
    v_event.project_id,
    v_event.actor_type,
    v_event.actor_id,
    null,
    v_event.event_type
      || '.v'
      || v_event.event_version::text,
    v_event.aggregate_type,
    v_event.aggregate_id,
    v_action,
    v_before_state,
    v_after_state,
    case
      when v_event.causation_id is not null then
        'domain_event'
      else
        null
    end,
    v_event.causation_id,
    v_metadata,
    v_event.occurred_at
  )
  on conflict (event_id)
  do nothing;

  get diagnostics
    v_inserted_rows = row_count;

  return v_inserted_rows = 1;
end;
$$;


/* Prospective Audit subscriptions; existing events are not replayed. */
insert into public.domain_event_subscriptions (
  consumer_name,
  event_type,
  event_version,
  is_active
)
values
  ('audit.domain-events.v1', 'ProjectMemberAdded', 1, true),
  ('audit.domain-events.v1', 'ProjectMemberRemoved', 1, true),
  ('audit.domain-events.v1', 'ProjectMembershipExpired', 1, true),
  ('audit.domain-events.v1', 'ProjectRoleAssigned', 1, true),
  ('audit.domain-events.v1', 'ProjectRoleRevoked', 1, true),
  ('audit.domain-events.v1', 'ProjectRoleTransferred', 1, true)
on conflict (
  consumer_name,
  event_type,
  event_version
)
do update
set is_active = excluded.is_active;


revoke all on function public.project_domain_event_to_audit(
  uuid
) from public, anon, authenticated;

grant execute on function public.project_domain_event_to_audit(
  uuid
) to service_role;

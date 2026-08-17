-- Cadence v0.1
-- VS001-09: Audit Domain-Event Projection
--
-- The Audit module does not own authoritative business state.
--
-- Material domain events are projected into the append-only
-- public.audit_events accountability store.
--
-- Existing VS-001 events are deliberately backfilled because
-- domain-event subscriptions do not replay historical events
-- automatically.
--
-- Future events are delivered asynchronously through the generic
-- domain-event subscription infrastructure.

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

  v_inserted_rows integer;
begin
  /*
   * Load the authoritative domain-event envelope.
   */
  select *
  into v_event
  from public.domain_events
  where id = p_event_id;


  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'AUDIT_DOMAIN_EVENT_NOT_FOUND';
  end if;


  /*
   * VS001-09 initially projects the material events that make up
   * the complete Discussion -> Team Agent -> human review -> Task
   * journey.
   *
   * Additional event types can be added without changing producers.
   */
  if v_event.event_version <> 1
     or v_event.event_type not in (
       'MessageCreated',
       'AIProposalCreated',
       'AIProposalConfirmed',
       'AIProposalEdited',
       'AIProposalRejected',
       'TaskCreated'
     ) then
    raise exception using
      errcode = '22023',
      message = 'AUDIT_DOMAIN_EVENT_UNSUPPORTED';
  end if;


  /*
   * Convert technical event names into audit-facing business actions.
   */
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
    end;


  /*
   * Human-review events contain the previous proposal status.
   *
   * Preserve that as the audit before-state while retaining the full
   * domain-event payload as the after-state.
   */
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


  /*
   * event_id is the idempotency key.
   *
   * A delivery may be retried after Audit persistence succeeds but
   * before the delivery itself is marked complete. ON CONFLICT
   * therefore turns that retry into a harmless no-op.
   *
   * created_at deliberately uses the original domain-event timestamp.
   * This keeps historical backfill ordered according to when the
   * business action happened rather than when Audit projected it.
   */
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
    v_event.payload,

    case
      when v_event.causation_id is not null then
        'domain_event'
      else
        null
    end,

    v_event.causation_id,

    jsonb_build_object(
      'domain_event_type',
        v_event.event_type,

      'domain_event_version',
        v_event.event_version,

      'causation_id',
        v_event.causation_id,

      'occurred_at',
        v_event.occurred_at,

      'projection',
        'domain_event'
    ),

    v_event.occurred_at
  )
  on conflict (event_id)
  do nothing;


  get diagnostics
    v_inserted_rows =
      row_count;


  return
    v_inserted_rows = 1;
end;
$$;


/*
 * Register Audit as an independent consumer of all material VS-001
 * domain events.
 *
 * Producers remain unaware of the Audit module.
 */
insert into public.domain_event_subscriptions (
  consumer_name,
  event_type,
  event_version,
  is_active
)
values
  (
    'audit.domain-events.v1',
    'MessageCreated',
    1,
    true
  ),
  (
    'audit.domain-events.v1',
    'AIProposalCreated',
    1,
    true
  ),
  (
    'audit.domain-events.v1',
    'AIProposalConfirmed',
    1,
    true
  ),
  (
    'audit.domain-events.v1',
    'AIProposalEdited',
    1,
    true
  ),
  (
    'audit.domain-events.v1',
    'AIProposalRejected',
    1,
    true
  ),
  (
    'audit.domain-events.v1',
    'TaskCreated',
    1,
    true
  )
on conflict (
  consumer_name,
  event_type,
  event_version
)
do update
set
  is_active =
    excluded.is_active;


/*
 * Deliberately backfill existing material VS-001 domain events.
 *
 * Newly-added subscriptions do not automatically create deliveries for
 * historical events. Audit nevertheless needs to reconstruct journeys
 * that occurred before VS001-09 was introduced.
 *
 * Projection is idempotent because audit_events.event_id is unique.
 */
do $$
declare
  v_event_id uuid;
begin
  for v_event_id in
    select e.id
    from public.domain_events e
    where e.event_version = 1
      and e.event_type in (
        'MessageCreated',
        'AIProposalCreated',
        'AIProposalConfirmed',
        'AIProposalEdited',
        'AIProposalRejected',
        'TaskCreated'
      )
    order by e.occurred_at asc
  loop
    perform
      public.project_domain_event_to_audit(
        v_event_id
      );
  end loop;
end;
$$;


/*
 * Audit projection is server-side infrastructure.
 */
revoke all on function public.project_domain_event_to_audit(
  uuid
) from public;

revoke all on function public.project_domain_event_to_audit(
  uuid
) from anon;

revoke all on function public.project_domain_event_to_audit(
  uuid
) from authenticated;

grant execute on function public.project_domain_event_to_audit(
  uuid
) to service_role;
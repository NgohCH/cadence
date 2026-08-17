-- Cadence v0.1
-- VS001-09: Task Audit Journey Reconstruction
--
-- Reconstruct one complete Discussion -> Team Agent -> human review
-- -> authoritative Task business journey.
--
-- A business journey may legitimately span multiple request
-- correlation IDs.
--
-- Reconstruction therefore follows durable provenance:
--
-- Task
--   -> source_links
--   -> AI proposal
--   -> AI run
--   -> originating MessageCreated.v1
--
-- together with the proposal lifecycle and TaskCreated.v1 events.
--
-- audit_events enrich the reconstruction with accountability data.
-- Domain-event provenance remains authoritative for causation.

create or replace function public.get_task_audit_journey(
  p_project_id uuid,
  p_task_id uuid,
  p_requesting_user_id uuid
)
returns table (
  audit_event_id uuid,
  domain_event_id uuid,
  event_type text,
  event_version integer,
  entity_type text,
  entity_id uuid,
  action text,
  actor_type text,
  actor_id uuid,
  correlation_id uuid,
  causation_id uuid,
  source_type text,
  source_id uuid,
  occurred_at timestamptz,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  /*
   * Required stable references.
   */
  if p_project_id is null
     or p_task_id is null
     or p_requesting_user_id is null then
    raise exception using
      errcode = '22023',
      message = 'AUDIT_REFERENCE_MISSING';
  end if;


  /*
   * Defence in depth.
   *
   * The API service also checks audit.view before calling this
   * function. Revalidate the permission at the persistence boundary
   * because the API uses a service-role database connection.
   */
  if not public.has_project_permission(
    p_project_id,
    'audit.view',
    p_requesting_user_id
  ) then
    raise exception using
      errcode = '42501',
      message = 'AUDIT_VIEW_PERMISSION_DENIED';
  end if;


  return query
  with task_source as (
    select
      sl.entity_id as task_id,
      sl.source_id as proposal_id
    from public.source_links sl
    where sl.project_id =
        p_project_id
      and sl.entity_type =
        'task'
      and sl.entity_id =
        p_task_id
      and sl.source_type =
        'ai_proposal'
    limit 1
  ),

  proposal as (
    select
      ap.id as proposal_id,
      ap.ai_run_id
    from public.ai_proposals ap
    join task_source ts
      on ts.proposal_id =
        ap.id
    where ap.project_id =
      p_project_id
  ),

  run_source as (
    select
      ar.source_event_id
    from public.ai_runs ar
    join proposal p
      on p.ai_run_id =
        ar.id
    where ar.project_id =
      p_project_id
  ),

  journey_events as (
    /*
     * Originating Discussion event.
     */
    select
      e.*
    from public.domain_events e
    join run_source rs
      on rs.source_event_id =
        e.id
    where e.project_id =
      p_project_id


    union all


    /*
     * AI proposal creation and human-review lifecycle.
     */
    select
      e.*
    from public.domain_events e
    join proposal p
      on e.aggregate_type =
        'ai_proposal'
      and e.aggregate_id =
        p.proposal_id
    where e.project_id =
      p_project_id


    union all


    /*
     * Authoritative Task creation.
     */
    select
      e.*
    from public.domain_events e
    join task_source ts
      on e.aggregate_type =
        'task'
      and e.aggregate_id =
        ts.task_id
    where e.project_id =
      p_project_id
  )

  select
    a.id,
    e.id,
    e.event_type,
    e.event_version,
    e.aggregate_type,
    e.aggregate_id,

    coalesce(
      a.action,

      case e.event_type
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

        else
          e.event_type
      end
    ),

    e.actor_type,
    e.actor_id,
    e.correlation_id,
    e.causation_id,
    a.source_type,
    a.source_id,
    e.occurred_at,
    a.before_state,
    a.after_state,
    a.metadata

  from journey_events e

  left join public.audit_events a
    on a.event_id =
      e.id

  order by
    e.occurred_at asc,
    e.id asc;
end;
$$;


/*
 * Audit reconstruction is available only through server-side
 * application infrastructure.
 */
revoke all on function public.get_task_audit_journey(
  uuid,
  uuid,
  uuid
) from public;

revoke all on function public.get_task_audit_journey(
  uuid,
  uuid,
  uuid
) from anon;

revoke all on function public.get_task_audit_journey(
  uuid,
  uuid,
  uuid
) from authenticated;

grant execute on function public.get_task_audit_journey(
  uuid,
  uuid,
  uuid
) to service_role;
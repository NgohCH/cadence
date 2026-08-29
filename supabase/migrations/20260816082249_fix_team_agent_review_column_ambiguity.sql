-- Cadence v0.1
-- VS001-06 corrective migration
--
-- Fix PL/pgSQL ambiguity between RETURNS TABLE output variables
-- and ai_proposals column names.
--
-- The business behaviour of the review operation is unchanged.

create or replace function public.review_team_agent_task_proposal(
  p_project_id uuid,
  p_proposal_id uuid,
  p_reviewer_user_id uuid,
  p_action text,
  p_reviewed_payload jsonb,
  p_correlation_id uuid
)
returns table (
  proposal_id uuid,
  project_id uuid,
  status text,
  reviewed_payload jsonb,
  reviewed_by uuid,
  reviewed_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_proposal public.ai_proposals%rowtype;
  v_status text;
  v_reviewed_payload jsonb;
  v_reviewed_at timestamptz;
  v_event_type text;
begin
  /*
   * Validate stable required references.
   */
  if p_project_id is null
     or p_proposal_id is null
     or p_reviewer_user_id is null
     or p_correlation_id is null then
    raise exception using
      errcode = '22023',
      message = 'TEAM_AGENT_REVIEW_REFERENCE_MISSING';
  end if;


  /*
   * Validate the requested review action.
   */
  if p_action is null
     or p_action not in ('confirm', 'edit', 'reject') then
    raise exception using
      errcode = '22023',
      message = 'TEAM_AGENT_REVIEW_ACTION_INVALID';
  end if;


  /*
   * Defence in depth:
   * revalidate agent.approve immediately before persistence.
   */
  if not public.has_project_permission(
    p_project_id,
    'agent.approve',
    p_reviewer_user_id
  ) then
    raise exception using
      errcode = '42501',
      message = 'TEAM_AGENT_REVIEW_PERMISSION_DENIED';
  end if;


  /*
   * Lock the proposal so only one reviewer can transition a pending
   * proposal.
   *
   * Table columns are explicitly qualified because RETURNS TABLE
   * creates PL/pgSQL variables with names such as project_id and
   * status.
   */
  select proposal.*
  into v_proposal
  from public.ai_proposals as proposal
  where proposal.id = p_proposal_id
    and proposal.project_id = p_project_id
    and proposal.proposal_type = 'task'
  for update;


  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'TEAM_AGENT_PROPOSAL_NOT_FOUND';
  end if;


  /*
   * Human review is terminal for this proposal.
   */
  if v_proposal.status <> 'pending' then
    raise exception using
      errcode = '55000',
      message = 'TEAM_AGENT_PROPOSAL_ALREADY_REVIEWED';
  end if;


  case p_action
    when 'confirm' then
      if p_reviewed_payload is not null then
        raise exception using
          errcode = '22023',
          message = 'TEAM_AGENT_CONFIRM_PAYLOAD_NOT_ALLOWED';
      end if;


      v_status :=
        'confirmed';

      v_reviewed_payload :=
        v_proposal.payload;

      v_event_type :=
        'AIProposalConfirmed';


    when 'edit' then
      /*
       * Edited task proposals must remain valid proposal objects.
       */
      if p_reviewed_payload is null
         or jsonb_typeof(
           p_reviewed_payload
         ) <> 'object' then
        raise exception using
          errcode = '22023',
          message = 'TEAM_AGENT_EDIT_PAYLOAD_REQUIRED';
      end if;


      if nullif(
        btrim(
          p_reviewed_payload ->> 'title'
        ),
        ''
      ) is null then
        raise exception using
          errcode = '22023',
          message = 'TEAM_AGENT_TASK_TITLE_REQUIRED';
      end if;


      /*
       * Discussion provenance cannot be rewritten during review.
       */
      if (
        p_reviewed_payload ->>
          'source_message_id'
      ) is distinct from (
        v_proposal.payload ->>
          'source_message_id'
      )
      or (
        p_reviewed_payload ->>
          'source_message_version_id'
      ) is distinct from (
        v_proposal.payload ->>
          'source_message_version_id'
      ) then
        raise exception using
          errcode = '22023',
          message = 'TEAM_AGENT_PROPOSAL_PROVENANCE_IMMUTABLE';
      end if;


      v_status :=
        'edited';

      v_reviewed_payload :=
        p_reviewed_payload;

      v_event_type :=
        'AIProposalEdited';


    when 'reject' then
      if p_reviewed_payload is not null then
        raise exception using
          errcode = '22023',
          message = 'TEAM_AGENT_REJECT_PAYLOAD_NOT_ALLOWED';
      end if;


      v_status :=
        'rejected';

      v_reviewed_payload :=
        null;

      v_event_type :=
        'AIProposalRejected';
  end case;


  v_reviewed_at :=
    now();


  update public.ai_proposals as proposal
  set
    status =
      v_status,

    reviewed_payload =
      v_reviewed_payload,

    reviewed_by =
      p_reviewer_user_id,

    reviewed_at =
      v_reviewed_at
  where proposal.id =
    p_proposal_id;


  /*
   * Transactional business event.
   *
   * This still does not create or modify an authoritative Task.
   */
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
    causation_id
  )
  values (
    v_event_type,
    1,
    'ai_proposal',
    p_proposal_id,
    p_project_id,
    'human',
    p_reviewer_user_id,
    jsonb_build_object(
      'proposal_id',
        p_proposal_id,

      'ai_run_id',
        v_proposal.ai_run_id,

      'proposal_type',
        v_proposal.proposal_type,

      'previous_status',
        v_proposal.status,

      'status',
        v_status,

      'reviewed_by',
        p_reviewer_user_id,

      'reviewed_at',
        v_reviewed_at
    ),
    p_correlation_id,
    null
  );


  return query
  select
    proposal.id,
    proposal.project_id,
    proposal.status,
    proposal.reviewed_payload,
    proposal.reviewed_by,
    proposal.reviewed_at
  from public.ai_proposals as proposal
  where proposal.id =
    p_proposal_id;
end;
$$;


/*
 * Preserve the API-only execution boundary.
 */
revoke all on function public.review_team_agent_task_proposal(
  uuid,
  uuid,
  uuid,
  text,
  jsonb,
  uuid
) from public;

revoke all on function public.review_team_agent_task_proposal(
  uuid,
  uuid,
  uuid,
  text,
  jsonb,
  uuid
) from anon;

revoke all on function public.review_team_agent_task_proposal(
  uuid,
  uuid,
  uuid,
  text,
  jsonb,
  uuid
) from authenticated;

grant execute on function public.review_team_agent_task_proposal(
  uuid,
  uuid,
  uuid,
  text,
  jsonb,
  uuid
) to service_role;
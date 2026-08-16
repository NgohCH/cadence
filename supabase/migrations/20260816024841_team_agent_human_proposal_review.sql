-- Cadence v0.1
-- VS001-06: Human Proposal Review
--
-- Preserve the original AI-generated proposal payload while allowing
-- an authorised human reviewer to confirm or edit the proposal.
--
-- payload:
--   original AI-generated proposal values
--
-- reviewed_payload:
--   final human-reviewed values used by later authoritative workflows

alter table public.ai_proposals
  add column reviewed_payload jsonb;


/*
 * Backfill any pre-existing confirmed or edited proposals.
 *
 * VS001-05 creates proposals only as pending, so this is primarily
 * defensive migration behaviour for databases that may contain
 * manually created or earlier test data.
 */
update public.ai_proposals
set reviewed_payload = payload
where status in ('confirmed', 'edited')
  and reviewed_payload is null;


/*
 * A confirmed or edited proposal must have an explicit reviewed
 * payload.
 *
 * Pending, rejected, and expired proposals do not represent approved
 * task values and therefore must not carry a reviewed payload.
 */
alter table public.ai_proposals
  add constraint ai_proposals_reviewed_payload_check
  check (
    (
      status in ('confirmed', 'edited')
      and reviewed_payload is not null
    )
    or
    (
      status in ('pending', 'rejected', 'expired')
      and reviewed_payload is null
    )
  );


comment on column public.ai_proposals.reviewed_payload is
  'Final human-reviewed proposal values. Original AI-generated values remain in payload.';

/*
 * Atomically review a pending Team Agent task proposal.
 *
 * This function:
 *   - scopes the proposal to the supplied project;
 *   - revalidates agent.approve as defence in depth;
 *   - permits only pending proposals to be reviewed;
 *   - preserves the original AI payload;
 *   - stores the final human-reviewed payload for confirm/edit;
 *   - records the human reviewer and review timestamp;
 *   - emits a versioned domain event describing the outcome.
 *
 * It does NOT create or modify Tasks.
 */
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
   *
   * NULL must be checked explicitly because SQL NULL comparisons do
   * not evaluate to TRUE.
   */
  if p_action is null
     or p_action not in ('confirm', 'edit', 'reject') then
    raise exception using
      errcode = '22023',
      message = 'TEAM_AGENT_REVIEW_ACTION_INVALID';
  end if;

  /*
   * Revalidate agent.approve immediately before persistence.
   *
   * The API must also perform this check. Repeating it here protects
   * against access being revoked between application authorization
   * and the database write.
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
   * Lock the proposal so two reviewers cannot successfully review the
   * same pending proposal concurrently.
   */
  select *
  into v_proposal
  from public.ai_proposals
  where id = p_proposal_id
    and project_id = p_project_id
    and proposal_type = 'task'
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'TEAM_AGENT_PROPOSAL_NOT_FOUND';
  end if;

  /*
   * A proposal receives one terminal human-review outcome.
   */
  if v_proposal.status <> 'pending' then
    raise exception using
      errcode = '55000',
      message = 'TEAM_AGENT_PROPOSAL_ALREADY_REVIEWED';
  end if;

  /*
   * Resolve the final status and reviewed payload.
   *
   * Confirm:
   *   Human accepts the AI values as-is.
   *
   * Edit:
   *   Human supplies the final reviewed values.
   *
   * Reject:
   *   No approved reviewed payload exists.
   */
  case p_action
    when 'confirm' then
      if p_reviewed_payload is not null then
        raise exception using
          errcode = '22023',
          message = 'TEAM_AGENT_CONFIRM_PAYLOAD_NOT_ALLOWED';
      end if;

      v_status := 'confirmed';
      v_reviewed_payload := v_proposal.payload;
      v_event_type := 'AIProposalConfirmed';

    when 'edit' then
      /*
       * Edited task proposals must remain valid task-proposal objects.
       */
      if p_reviewed_payload is null
         or jsonb_typeof(p_reviewed_payload) <> 'object' then
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
       * Source-message provenance is immutable.
       *
       * Human review may change proposed task values such as title,
       * description, assignee, or due date, but it must not rewrite
       * which Discussion message produced the proposal.
       */
      if (
        p_reviewed_payload ->> 'source_message_id'
      ) is distinct from (
        v_proposal.payload ->> 'source_message_id'
      )
      or (
        p_reviewed_payload ->> 'source_message_version_id'
      ) is distinct from (
        v_proposal.payload ->> 'source_message_version_id'
      ) then
        raise exception using
          errcode = '22023',
          message = 'TEAM_AGENT_PROPOSAL_PROVENANCE_IMMUTABLE';
      end if;


      v_status := 'edited';
      v_reviewed_payload := p_reviewed_payload;
      v_event_type := 'AIProposalEdited';

    when 'reject' then
      if p_reviewed_payload is not null then
        raise exception using
          errcode = '22023',
          message = 'TEAM_AGENT_REJECT_PAYLOAD_NOT_ALLOWED';
      end if;

      v_status := 'rejected';
      v_reviewed_payload := null;
      v_event_type := 'AIProposalRejected';
  end case;

  v_reviewed_at := now();

  update public.ai_proposals
  set
    status = v_status,
    reviewed_payload = v_reviewed_payload,
    reviewed_by = p_reviewer_user_id,
    reviewed_at = v_reviewed_at
  where id = p_proposal_id;

  /*
   * Record the business transition in the transactional outbox.
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
      'proposal_id', p_proposal_id,
      'ai_run_id', v_proposal.ai_run_id,
      'proposal_type', v_proposal.proposal_type,
      'previous_status', v_proposal.status,
      'status', v_status,
      'reviewed_by', p_reviewer_user_id,
      'reviewed_at', v_reviewed_at
    ),
    p_correlation_id,
    null
  );

  return query
  select
    p.id,
    p.project_id,
    p.status,
    p.reviewed_payload,
    p.reviewed_by,
    p.reviewed_at
  from public.ai_proposals p
  where p.id = p_proposal_id;
end;
$$;


/*
 * API service only.
 *
 * Browser-authenticated clients must not invoke this persistence
 * function directly.
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

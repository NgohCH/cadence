-- Cadence v0.1
-- VS001-05
-- Idempotent Team Agent AI-run and pending task-proposal persistence.
--
-- A MessageCreated.v1 event may be delivered more than once because
-- asynchronous processing is retryable. source_event_id provides the
-- stable idempotency anchor for one Team Agent processing run.
--
-- The proposal remains non-authoritative. Tasks are created only later
-- through the Tasks module after human confirmation.

alter table public.ai_runs
  add column source_event_id uuid
    references public.domain_events(id)
    on delete restrict;

create unique index ai_runs_source_event_uidx
  on public.ai_runs(source_event_id)
  where source_event_id is not null;


create or replace function public.create_team_agent_task_proposal(
  p_source_event_id uuid,
  p_project_id uuid,
  p_triggered_by_user_id uuid,
  p_message_id uuid,
  p_message_version_id uuid,
  p_version_number integer,
  p_correlation_id uuid,
  p_model_provider text,
  p_model_name text,
  p_prompt_version_id uuid,
  p_proposal_payload jsonb,
  p_confidence numeric,
  p_reason text,
  p_output_raw jsonb default null
)
returns table (
  ai_run_id uuid,
  proposal_id uuid,
  created boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ai_run_id uuid;
  v_proposal_id uuid;
  v_proposal_event_id uuid;
begin
  /*
   * Validate stable required fields.
   */
  if p_source_event_id is null
     or p_project_id is null
     or p_message_id is null
     or p_message_version_id is null
     or p_correlation_id is null then
    raise exception using
      errcode = '22023',
      message = 'TEAM_AGENT_REQUIRED_REFERENCE_MISSING';
  end if;

  if p_version_number is null
     or p_version_number <= 0 then
    raise exception using
      errcode = '22023',
      message = 'TEAM_AGENT_MESSAGE_VERSION_INVALID';
  end if;

  if p_model_provider is null
     or length(btrim(p_model_provider)) = 0
     or p_model_name is null
     or length(btrim(p_model_name)) = 0 then
    raise exception using
      errcode = '22023',
      message = 'TEAM_AGENT_MODEL_METADATA_REQUIRED';
  end if;

  if p_proposal_payload is null
     or jsonb_typeof(p_proposal_payload) <> 'object'
     or nullif(
       btrim(
         p_proposal_payload ->> 'title'
       ),
       ''
     ) is null then
    raise exception using
      errcode = '22023',
      message = 'TEAM_AGENT_TASK_TITLE_REQUIRED';
  end if;

  if p_confidence is not null
     and (
       p_confidence < 0
       or p_confidence > 1
     ) then
    raise exception using
      errcode = '22023',
      message = 'TEAM_AGENT_CONFIDENCE_INVALID';
  end if;

  /*
   * Retry/idempotency path.
   *
   * If this source event has already produced a Team Agent run,
   * return the existing run and proposal instead of creating duplicates.
   */
  select
    ar.id
  into
    v_ai_run_id
  from public.ai_runs ar
  where ar.source_event_id =
    p_source_event_id;

  if v_ai_run_id is not null then
    select
      ap.id
    into
      v_proposal_id
    from public.ai_proposals ap
    where ap.ai_run_id =
      v_ai_run_id
      and ap.proposal_type = 'task'
    order by ap.created_at asc
    limit 1;

    if v_proposal_id is null then
      raise exception using
        errcode = 'P0001',
        message = 'TEAM_AGENT_EXISTING_RUN_MISSING_PROPOSAL';
    end if;

    return query
    select
      v_ai_run_id,
      v_proposal_id,
      false;

    return;
  end if;

  /*
   * Validate the originating MessageCreated.v1 envelope.
   */
  if not exists (
    select 1
    from public.domain_events e
    where e.id =
      p_source_event_id
      and e.event_type =
        'MessageCreated'
      and e.event_version = 1
      and e.aggregate_type =
        'message'
      and e.aggregate_id =
        p_message_id
      and e.project_id =
        p_project_id
      and e.correlation_id =
        p_correlation_id
  ) then
    raise exception using
      errcode = '22023',
      message = 'TEAM_AGENT_SOURCE_EVENT_INVALID';
  end if;

  /*
   * Validate the exact immutable Discussion version referenced by
   * the event handler.
   */
  if not exists (
    select 1
    from public.message_versions mv
    join public.messages m
      on m.id = mv.message_id
    where mv.id =
      p_message_version_id
      and mv.message_id =
        p_message_id
      and mv.version_number =
        p_version_number
      and m.project_id =
        p_project_id
  ) then
    raise exception using
      errcode = '22023',
      message = 'TEAM_AGENT_MESSAGE_VERSION_INVALID';
  end if;

  /*
   * Create the completed processing run.
   *
   * source_event_id is the idempotency key. ON CONFLICT also protects
   * against a rare race where an expired worker and a newly-claimed
   * worker attempt the same source event concurrently.
   */
  insert into public.ai_runs (
    project_id,
    triggered_by_user_id,
    agent_type,
    model_provider,
    model_name,
    prompt_version_id,
    correlation_id,
    status,
    input_reference,
    output_raw,
    started_at,
    completed_at,
    source_event_id
  )
  values (
    p_project_id,
    p_triggered_by_user_id,
    'team-agent',
    p_model_provider,
    p_model_name,
    p_prompt_version_id,
    p_correlation_id,
    'completed',
    jsonb_build_object(
      'source_event_id',
        p_source_event_id,
      'message_id',
        p_message_id,
      'message_version_id',
        p_message_version_id,
      'version_number',
        p_version_number
    ),
    p_output_raw,
    now(),
    now(),
    p_source_event_id
  )
  on conflict (source_event_id)
    where source_event_id is not null
  do nothing
  returning id
  into v_ai_run_id;

  /*
   * If another transaction won the source_event_id race, PostgreSQL
   * waits for that transaction and this statement returns no new row.
   * Read the already-created run and return its proposal.
   */
  if v_ai_run_id is null then
    select
      ar.id
    into
      v_ai_run_id
    from public.ai_runs ar
    where ar.source_event_id =
      p_source_event_id;

    select
      ap.id
    into
      v_proposal_id
    from public.ai_proposals ap
    where ap.ai_run_id =
      v_ai_run_id
      and ap.proposal_type = 'task'
    order by ap.created_at asc
    limit 1;

    if v_proposal_id is null then
      raise exception using
        errcode = 'P0001',
        message = 'TEAM_AGENT_EXISTING_RUN_MISSING_PROPOSAL';
    end if;

    return query
    select
      v_ai_run_id,
      v_proposal_id,
      false;

    return;
  end if;

  /*
   * Store the human-reviewable task proposal.
   *
   * This is not an authoritative Task.
   */
  insert into public.ai_proposals (
    project_id,
    ai_run_id,
    proposal_type,
    payload,
    confidence,
    reason,
    status
  )
  values (
    p_project_id,
    v_ai_run_id,
    'task',
    p_proposal_payload,
    p_confidence,
    p_reason,
    'pending'
  )
  returning id
  into v_proposal_id;

  /*
   * Emit the material Team Agent state change.
   *
   * The proposal event retains the original business correlation and
   * identifies MessageCreated.v1 as its immediate cause.
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
    'AIProposalCreated',
    1,
    'ai_proposal',
    v_proposal_id,
    p_project_id,
    'agent',
    null,
    jsonb_build_object(
      'proposal_id',
        v_proposal_id,
      'ai_run_id',
        v_ai_run_id,
      'proposal_type',
        'task',
      'status',
        'pending',
      'source_event_id',
        p_source_event_id,
      'message_id',
        p_message_id,
      'message_version_id',
        p_message_version_id
    ),
    p_correlation_id,
    p_source_event_id
  )
  returning id
  into v_proposal_event_id;

  return query
  select
    v_ai_run_id,
    v_proposal_id,
    true;
end;
$$;


/*
 * Team Agent persistence is a server-side operation.
 */

revoke all on function public.create_team_agent_task_proposal(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  integer,
  uuid,
  text,
  text,
  uuid,
  jsonb,
  numeric,
  text,
  jsonb
) from public;

revoke all on function public.create_team_agent_task_proposal(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  integer,
  uuid,
  text,
  text,
  uuid,
  jsonb,
  numeric,
  text,
  jsonb
) from anon;

revoke all on function public.create_team_agent_task_proposal(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  integer,
  uuid,
  text,
  text,
  uuid,
  jsonb,
  numeric,
  text,
  jsonb
) from authenticated;

grant execute on function public.create_team_agent_task_proposal(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  integer,
  uuid,
  text,
  text,
  uuid,
  jsonb,
  numeric,
  text,
  jsonb
) to service_role;

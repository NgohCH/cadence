-- Cadence R02E
-- Authoritative Task creation authorization reconciliation.
--
-- Project authorization belongs exclusively to TasksService through
-- ProjectAuthorisationService.
--
-- p_created_by_user_id remains creator/event attribution identity.
-- p_assigned_to remains the Cadence User receiving the Task.
--
-- Persistence resolves the assigned User to stable Person identity and
-- requires an effective project membership at transaction time.

create or replace function public.create_authoritative_task(
  p_project_id uuid,
  p_title text,
  p_description text,
  p_assigned_to uuid,
  p_priority text,
  p_due_date timestamptz,
  p_created_by_user_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_correlation_id uuid,
  p_causation_id uuid
)
returns table (
  task_id uuid,
  project_id uuid,
  title text,
  description text,
  assigned_to uuid,
  status text,
  priority text,
  due_date timestamptz,
  completed_at timestamptz,
  created_by uuid,
  created_by_type text,
  created_at timestamptz,
  updated_at timestamptz,
  created boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task public.tasks%rowtype;

  v_created boolean :=
    false;
begin
  /*
   * Required stable references.
   */
  if p_project_id is null
     or p_created_by_user_id is null
     or p_source_id is null
     or p_correlation_id is null then
    raise exception using
      errcode = '22023',
      message = 'TASK_REFERENCE_MISSING';
  end if;


  /*
   * Validate authoritative Task values again at the persistence
   * boundary. The API performs these checks first, but RPC callers
   * must not be trusted solely because the application validated them.
   */
  if nullif(
    btrim(
      p_title
    ),
    ''
  ) is null then
    raise exception using
      errcode = '22023',
      message = 'TASK_TITLE_REQUIRED';
  end if;


  if p_priority is null
     or p_priority not in (
       'low',
       'normal',
       'high',
       'critical'
     ) then
    raise exception using
      errcode = '22023',
      message = 'TASK_PRIORITY_INVALID';
  end if;


  /*
   * VS001-07 supports authoritative creation from a reviewed
   * AI proposal.
   */
  if p_source_type is null
     or p_source_type <> 'ai_proposal' then
    raise exception using
      errcode = '22023',
      message = 'TASK_SOURCE_INVALID';
  end if;


  /*
   * Assignment authorization is enforced by TasksService.
   *
   * Persistence independently protects target integrity. The assigned
   * Cadence User must resolve to a stable Person whose project membership
   * is effective at transaction time.
   */
  if p_assigned_to is not null then
/*
     * An authoritative project Task cannot be assigned to a user
     * outside the project or to an inactive project member.
     */
    if not exists (
      select 1
      from public.users assignee_user
      join public.project_memberships pm
        on pm.person_id =
          assignee_user.person_id
      where assignee_user.id =
          p_assigned_to
        and pm.project_id =
          p_project_id
        and pm.membership_status =
          'ACTIVE'
        and pm.effective_from <=
          now()
        and (
          pm.effective_to is null
          or pm.effective_to >
            now()
        )
    ) then
      raise exception using
        errcode = '22023',
        message = 'TASK_ASSIGNEE_NOT_PROJECT_MEMBER';
    end if;
  end if;


  /*
   * Fast path for a normal retry.
   *
   * If this AI proposal has already materialized into a Task,
   * return that authoritative Task instead of creating another one.
   */
  select
    t.*
  into
    v_task
  from public.source_links sl
  join public.tasks t
    on t.id =
      sl.entity_id
  where sl.project_id =
      p_project_id
    and sl.entity_type =
      'task'
    and sl.source_type =
      'ai_proposal'
    and sl.source_id =
      p_source_id
  limit 1;


  if found then
    return query
    select
      v_task.id,
      v_task.project_id,
      v_task.title,
      v_task.description,
      v_task.assigned_to,
      v_task.status,
      v_task.priority,
      v_task.due_date,
      v_task.completed_at,
      v_task.created_by,
      v_task.created_by_type,
      v_task.created_at,
      v_task.updated_at,
      false;

    return;
  end if;


  /*
   * Concurrency-safe creation.
   *
   * Two requests may both pass the fast-path lookup before either
   * inserts its provenance row.
   *
   * The partial unique index is the final arbiter. If another
   * transaction wins, this nested block is rolled back and the
   * already-created Task is returned.
   */
  begin
    insert into public.tasks (
      project_id,
      title,
      description,
      assigned_to,
      status,
      priority,
      due_date,
      completed_at,
      created_by,
      created_by_type
    )
    values (
      p_project_id,
      btrim(
        p_title
      ),
      case
        when p_description is null then
          null
        when nullif(
          btrim(
            p_description
          ),
          ''
        ) is null then
          null
        else
          btrim(
            p_description
          )
      end,
      p_assigned_to,
      'open',
      p_priority,
      p_due_date,
      null,
      p_created_by_user_id,
      'human'
    )
    returning *
    into v_task;


    /*
     * Preserve business provenance independently from Task state.
     */
    insert into public.source_links (
      project_id,
      entity_type,
      entity_id,
      source_type,
      source_id,
      source_version
    )
    values (
      p_project_id,
      'task',
      v_task.id,
      'ai_proposal',
      p_source_id,
      null
    );


    v_created :=
      true;


  exception
    when unique_violation then
      /*
       * The expected unique violation means another transaction
       * materialized this proposal first.
       *
       * Because this is an exception subtransaction, the Task row
       * inserted above is rolled back before execution continues.
       */
      select
        t.*
      into
        v_task
      from public.source_links sl
      join public.tasks t
        on t.id =
          sl.entity_id
      where sl.project_id =
        p_project_id
        and sl.entity_type =
          'task'
        and sl.source_type =
          'ai_proposal'
        and sl.source_id =
          p_source_id
      limit 1;


      /*
       * Do not hide an unrelated unique-constraint problem.
       */
      if not found then
        raise;
      end if;


      v_created :=
        false;
  end;


  /*
   * Only the transaction that actually created the authoritative
   * Task emits TaskCreated.v1.
   *
   * A retry returning an existing Task must not emit another event.
   */
  if v_created then
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
      'TaskCreated',
      1,
      'task',
      v_task.id,
      p_project_id,
      'human',
      p_created_by_user_id,
      jsonb_build_object(
        'task_id',
          v_task.id,

        'project_id',
          v_task.project_id,

        'title',
          v_task.title,

        'assigned_to',
          v_task.assigned_to,

        'status',
          v_task.status,

        'priority',
          v_task.priority,

        'due_date',
          v_task.due_date,

        'source_type',
          'ai_proposal',

        'source_id',
          p_source_id
      ),
      p_correlation_id,
      p_causation_id
    );
  end if;


  return query
  select
    v_task.id,
    v_task.project_id,
    v_task.title,
    v_task.description,
    v_task.assigned_to,
    v_task.status,
    v_task.priority,
    v_task.due_date,
    v_task.completed_at,
    v_task.created_by,
    v_task.created_by_type,
    v_task.created_at,
    v_task.updated_at,
    v_created;
end;
$$;

revoke all on function public.create_authoritative_task(
  uuid,
  text,
  text,
  uuid,
  text,
  timestamptz,
  uuid,
  text,
  uuid,
  uuid,
  uuid
)
from public;

revoke all on function public.create_authoritative_task(
  uuid,
  text,
  text,
  uuid,
  text,
  timestamptz,
  uuid,
  text,
  uuid,
  uuid,
  uuid
)
from anon, authenticated;

grant execute on function public.create_authoritative_task(
  uuid,
  text,
  text,
  uuid,
  text,
  timestamptz,
  uuid,
  text,
  uuid,
  uuid,
  uuid
)
to service_role;

comment on function public.create_authoritative_task(
  uuid,
  text,
  text,
  uuid,
  text,
  timestamptz,
  uuid,
  text,
  uuid,
  uuid,
  uuid
) is
  'Server-only authoritative Task persistence RPC. Caller project authorization is enforced by TasksService through ProjectAuthorisationService; assignee integrity uses stable Person effective membership.';

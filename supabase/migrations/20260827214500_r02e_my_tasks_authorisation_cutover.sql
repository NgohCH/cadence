-- Cadence R02E
-- My Tasks authorization reconciliation.
--
-- Project permission decisions now belong exclusively to the canonical
-- application ProjectAuthorisationService.
--
-- public.list_my_tasks(uuid) remains a trusted service-role read-model RPC.
-- Its responsibility is limited to data scoping:
--   * Tasks assigned to the supplied Cadence User;
--   * current actionable statuses; and
--   * deterministic ordering.
--
-- The supplied User ID is attribution/query identity, not project
-- authorization evidence.

create or replace function public.list_my_tasks(
  p_user_id uuid
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
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    t.id as task_id,
    t.project_id,
    t.title,
    t.description,
    t.assigned_to,
    t.status,
    t.priority,
    t.due_date,
    t.completed_at,
    t.created_by,
    t.created_by_type,
    t.created_at,
    t.updated_at
  from public.tasks t
  where t.assigned_to =
      p_user_id

    and t.status in (
      'open',
      'in_progress'
    )

  order by
    t.due_date asc nulls last,
    t.created_at desc,
    t.id asc;
$$;


-- This is an internal API persistence/read-model function.
-- Browser roles must not be able to invoke it directly.
revoke all on function public.list_my_tasks(uuid)
from public;

revoke all on function public.list_my_tasks(uuid)
from anon, authenticated;

grant execute on function public.list_my_tasks(uuid)
to service_role;


comment on function public.list_my_tasks(uuid) is
  'Server-only My Tasks candidate read model. User ID scopes assignment; project authorization is enforced by TasksService through ProjectAuthorisationService.';

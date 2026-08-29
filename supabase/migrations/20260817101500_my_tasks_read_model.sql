-- Cadence v0.1
-- VS001-08B: My Tasks Read Model
--
-- Provides the authenticated-user Task read model used by:
--
--   GET /api/v1/me/tasks
--
-- The API supplies the authenticated Cadence user ID.
--
-- This function returns only:
--
--   - Tasks assigned to that user;
--   - Tasks that are currently actionable;
--   - Tasks from projects where the user remains an active member;
--   - Tasks from projects where the user's current role includes
--     task.view.
--
-- General Task history and project-wide Task listing remain outside
-- VS001-08.


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

    and public.has_project_permission(
      t.project_id,
      'task.view',
      p_user_id
    )

  order by
    t.due_date asc nulls last,
    t.created_at desc,
    t.id asc;
$$;


/*
 * The read model belongs behind the Cadence API boundary.
 *
 * Browser-authenticated clients must not call this server-side
 * read model directly.
 */
revoke all on function public.list_my_tasks(
  uuid
)
from public;

revoke all on function public.list_my_tasks(
  uuid
)
from anon;

revoke all on function public.list_my_tasks(
  uuid
)
from authenticated;

grant execute on function public.list_my_tasks(
  uuid
)
to service_role;
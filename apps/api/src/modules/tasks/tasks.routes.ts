import {
  Router,
} from "express";

import {
  success,
} from "../../bootstrap/api-response";

import type {
  AuthenticatedRequestState,
} from "../../middleware/authenticate";

import {
  TasksService,
} from "./tasks.service";


export function createTasksRouter(
  tasksService: TasksService
): Router {
  const router =
    Router();


  /*
   * GET /api/v1/me/tasks
   *
   * Returns the authenticated Cadence user's current actionable
   * Tasks.
   *
   * Identity is derived exclusively from RequestContext.
   *
   * The client cannot supply another user ID.
   */
  router.get(
    "/me/tasks",

    async (
      _req,
      res,
      next
    ) => {
      try {
        const authenticated =
          res.locals
            .authenticated as
              AuthenticatedRequestState;

        const {
          context,
        } = authenticated;


        const tasks =
          await tasksService
            .listMyTasks(
              context
            );


        res.status(
          200
        ).json(
          success(
            {
              tasks:
                tasks.map(
                  (task) => ({
                    id:
                      task.id,

                    project_id:
                      task.projectId,

                    title:
                      task.title,

                    description:
                      task.description,

                    assigned_to:
                      task.assignedTo,

                    status:
                      task.status,

                    priority:
                      task.priority,

                    due_date:
                      task.dueDate,

                    completed_at:
                      task.completedAt,

                    created_by:
                      task.createdBy,

                    created_by_type:
                      task.createdByType,

                    created_at:
                      task.createdAt,

                    updated_at:
                      task.updatedAt,
                  })
                ),
            },

            {
              correlation_id:
                context.correlationId,

              request_id:
                context.requestId,

              next_cursor:
                null,
            }
          )
        );
      } catch (error) {
        next(
          error
        );
      }
    }
  );


  return router;
}
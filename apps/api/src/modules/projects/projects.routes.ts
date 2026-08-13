import { Router } from "express";

import {
  failure,
  success,
} from "../../bootstrap/api-response";

import type {
  AuthenticatedRequestState,
} from "../../middleware/authenticate";

import {
  ProjectNotFoundError,
  ProjectPermissionDeniedError,
} from "./projects.errors";

import type {
  ProjectsService,
} from "./projects.service";

export function createProjectsRouter(
  projectsService: ProjectsService
): Router {
  const router = Router();

  router.get(
    "/projects/:projectId/summary",
    async (req, res, next) => {
      try {
        const authenticated =
          res.locals.authenticated as AuthenticatedRequestState;

        const { context } = authenticated;

        const projectId =
          req.params.projectId;

        const summary =
          await projectsService.getProjectSummary(
            context,
            projectId
          );

        res.status(200).json(
          success(
            {
              project: {
                id: summary.project.id,
                name: summary.project.name,
                description:
                  summary.project.description,
                goal: summary.project.goal,
                lifecycle_status:
                  summary.project.lifecycleStatus,
                health_status:
                  summary.project.healthStatus,
                progress_percent:
                  summary.project.progressPercent,
                owner_user_id:
                  summary.project.ownerUserId,
                start_date:
                  summary.project.startDate,
                target_date:
                  summary.project.targetDate,
                created_at:
                  summary.project.createdAt,
                updated_at:
                  summary.project.updatedAt,
              },

              my_tasks: {
                pending:
                  summary.myTasks.pending,
                overdue:
                  summary.myTasks.overdue,
              },

              blockers:
                summary.blockers,

              next_milestone:
                summary.nextMilestone
                  ? {
                      id:
                        summary.nextMilestone.id,

                      project_id:
                        summary.nextMilestone.projectId,

                      title:
                        summary.nextMilestone.title,

                      description:
                        summary.nextMilestone.description,

                      owner_user_id:
                        summary.nextMilestone.ownerUserId,

                      target_date:
                        summary.nextMilestone.targetDate,

                      status:
                        summary.nextMilestone.status,

                      completed_at:
                        summary.nextMilestone.completedAt,
                    }
                  : null,

              alerts:
                summary.alerts.map(
                  (alert) => ({
                    id: alert.id,
                    severity: alert.severity,
                    title: alert.title,
                    message: alert.message,
                    dismissible:
                      alert.dismissible,
                  })
                ),
            },

            {
              correlation_id:
                context.correlationId,

              request_id:
                context.requestId,

              next_cursor: null,
            }
          )
        );
      } catch (error) {
        const authenticated =
          res.locals.authenticated as AuthenticatedRequestState;

        const correlationId =
          authenticated.context.correlationId;

        if (
          error instanceof
          ProjectNotFoundError
        ) {
          res.status(404).json(
            failure(
              "NOT_FOUND",
              "Project not found.",
              correlationId
            )
          );

          return;
        }

        if (
          error instanceof
          ProjectPermissionDeniedError
        ) {
          res.status(403).json(
            failure(
              "PERMISSION_DENIED",
              "You do not have permission to view this project.",
              correlationId
            )
          );

          return;
        }
        next(error);
      }
    }
  );

  return router;
}
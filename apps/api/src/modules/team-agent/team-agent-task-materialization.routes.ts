import {
  Router,
} from "express";

import {
  failure,
  success,
} from "../../bootstrap/api-response";

import type {
  AuthenticatedRequestState,
} from "../../middleware/authenticate";

import {
  TasksPermissionDeniedError,
  TasksProjectNotFoundError,
  TasksValidationError,
} from "../tasks/tasks.errors";

import {
  TeamAgentProjectNotFoundError,
  TeamAgentProposalNotFoundError,
  TeamAgentValidationError,
} from "./team-agent.errors";

import type {
  TeamAgentTaskMaterializationService,
} from "./team-agent-task-materialization.service";


function isUuid(
  value: string
): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}


export function createTeamAgentTaskMaterializationRouter(
  materializationService:
    TeamAgentTaskMaterializationService
): Router {
  const router =
    Router();


  /*
   * Materialize a human-reviewed Team Agent proposal into an
   * authoritative Task.
   *
   * Team Agent does not persist the Task itself. The service
   * delegates authoritative creation to TasksService.
   */
  router.post(
    "/projects/:projectId/task-proposals/:proposalId/task",

    async (
      req,
      res,
      next
    ) => {
      const authenticated =
        res.locals
          .authenticated as
          AuthenticatedRequestState;

      const {
        context,
      } = authenticated;


      try {
        const projectId =
          req.params.projectId;

        const proposalId =
          req.params.proposalId;


        if (
          !isUuid(
            projectId
          )
        ) {
          res.status(
            400
          ).json(
            failure(
              "VALIDATION_ERROR",

              "Project ID must be a valid UUID.",

              context.correlationId
            )
          );

          return;
        }


        if (
          !isUuid(
            proposalId
          )
        ) {
          res.status(
            400
          ).json(
            failure(
              "VALIDATION_ERROR",

              "Proposal ID must be a valid UUID.",

              context.correlationId
            )
          );

          return;
        }


        const result =
          await materializationService
            .createTaskFromReviewedProposal(
              context,
              projectId,
              proposalId
            );


        res.status(
          result.created
            ? 201
            : 200
        ).json(
          success(
            {
              task: {
                id:
                  result.task.id,

                project_id:
                  result.task.projectId,

                title:
                  result.task.title,

                description:
                  result.task.description,

                assigned_to:
                  result.task.assignedTo,

                status:
                  result.task.status,

                priority:
                  result.task.priority,

                due_date:
                  result.task.dueDate,

                completed_at:
                  result.task.completedAt,

                created_by:
                  result.task.createdBy,

                created_by_type:
                  result.task.createdByType,

                created_at:
                  result.task.createdAt,

                updated_at:
                  result.task.updatedAt,
              },

              created:
                result.created,
            },

            {
              /*
               * API response metadata describes this HTTP request.
               *
               * TaskCreated.v1 separately continues the original
               * proposal-review business correlation.
               */
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
        if (
          error instanceof
            TeamAgentValidationError ||
          error instanceof
            TasksValidationError
        ) {
          res.status(
            400
          ).json(
            failure(
              "VALIDATION_ERROR",

              error.message,

              context.correlationId
            )
          );

          return;
        }


        if (
          error instanceof
            TeamAgentProjectNotFoundError ||
          error instanceof
            TasksProjectNotFoundError
        ) {
          res.status(
            404
          ).json(
            failure(
              "NOT_FOUND",

              "Project not found.",

              context.correlationId
            )
          );

          return;
        }


        if (
          error instanceof
            TeamAgentProposalNotFoundError
        ) {
          res.status(
            404
          ).json(
            failure(
              "NOT_FOUND",

              "Task proposal not found.",

              context.correlationId
            )
          );

          return;
        }


        if (
          error instanceof
            TasksPermissionDeniedError
        ) {
          res.status(
            403
          ).json(
            failure(
              "PERMISSION_DENIED",

              "You do not have permission to create or assign Tasks for this project.",

              context.correlationId
            )
          );

          return;
        }


        next(
          error
        );
      }
    }
  );


  return router;
}

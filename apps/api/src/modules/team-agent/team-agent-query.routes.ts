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
  TeamAgentPermissionDeniedError,
  TeamAgentProjectNotFoundError,
} from "./team-agent.errors";

import type {
  TeamAgentQueryService,
} from "./team-agent-query.service";


function isUuid(
  value: string
): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}


export function createTeamAgentQueryRouter(
  queryService:
    TeamAgentQueryService
): Router {
  const router =
    Router();


  /*
   * GET /api/v1/projects/:projectId/task-proposals
   *
   * Current VS-001 behaviour:
   *
   * Returns pending human-reviewable task proposals
   * for the authenticated project reviewer.
   */
  router.get(
    "/projects/:projectId/task-proposals",

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


        const proposals =
          await queryService
            .listPendingTaskProposals(
              context,
              projectId
            );


        res.status(
          200
        ).json(
          success(
            {
              proposals:
                proposals.map(
                  (proposal) => ({
                    id:
                      proposal.id,

                    project_id:
                      proposal.projectId,

                    ai_run_id:
                      proposal.aiRunId,

                    status:
                      proposal.status,

                    payload:
                      proposal.payload,

                    confidence:
                      proposal.confidence,

                    reason:
                      proposal.reason,

                    created_at:
                      proposal.createdAt,
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
        if (
          error instanceof
          TeamAgentProjectNotFoundError
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
          TeamAgentPermissionDeniedError
        ) {
          res.status(
            403
          ).json(
            failure(
              "PERMISSION_DENIED",

              "You do not have permission to review Team Agent proposals for this project.",

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
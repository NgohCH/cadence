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
  AuditJourneyNotFoundError,
  AuditPermissionDeniedError,
  AuditProjectNotFoundError,
  AuditValidationError,
} from "./audit.errors";

import {
  AuditQueryService,
} from "./audit-query.service";


function isUuid(
  value: string
): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}


export function createAuditRouter(
  auditQueryService:
    AuditQueryService
): Router {
  const router =
    Router();


  /*
   * GET /api/v1/projects/:projectId/tasks/:taskId/audit
   *
   * Reconstructs the complete VS-001 business journey for an
   * authoritative Task.
   *
   * The current HTTP request correlation remains in response meta.
   *
   * Business-journey correlation IDs are returned separately because
   * one workflow may span multiple human requests.
   */
  router.get(
    "/projects/:projectId/tasks/:taskId/audit",

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
          req.params
            .projectId ??
          "";

        const taskId =
          req.params
            .taskId ??
          "";


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
            taskId
          )
        ) {
          res.status(
            400
          ).json(
            failure(
              "VALIDATION_ERROR",

              "Task ID must be a valid UUID.",

              context.correlationId
            )
          );

          return;
        }


        const journey =
          await auditQueryService
            .getTaskJourney(
              context,
              projectId,
              taskId
            );


        res.status(
          200
        ).json(
          success(
            {
              journey: {
                project_id:
                  journey.projectId,

                task_id:
                  journey.taskId,

                correlation_ids:
                  journey.correlationIds,

                correlation_count:
                  journey
                    .correlationIds
                    .length,

                events:
                  journey.events.map(
                    (event) => ({
                      audit_event_id:
                        event.auditEventId,

                      domain_event_id:
                        event.domainEventId,

                      event_type:
                        event.eventType,

                      event_version:
                        event.eventVersion,

                      entity_type:
                        event.entityType,

                      entity_id:
                        event.entityId,

                      action:
                        event.action,

                      actor_type:
                        event.actorType,

                      actor_id:
                        event.actorId,

                      correlation_id:
                        event.correlationId,

                      causation_id:
                        event.causationId,

                      source_type:
                        event.sourceType,

                      source_id:
                        event.sourceId,

                      occurred_at:
                        event.occurredAt,

                      before_state:
                        event.beforeState,

                      after_state:
                        event.afterState,

                      metadata:
                        event.metadata,
                    })
                  ),
              },
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
          AuditValidationError
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
          AuditProjectNotFoundError
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
          AuditJourneyNotFoundError
        ) {
          res.status(
            404
          ).json(
            failure(
              "NOT_FOUND",

              "Task audit journey not found.",

              context.correlationId
            )
          );

          return;
        }


        if (
          error instanceof
          AuditPermissionDeniedError
        ) {
          res.status(
            403
          ).json(
            failure(
              "PERMISSION_DENIED",

              "You do not have permission to view project audit history.",

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
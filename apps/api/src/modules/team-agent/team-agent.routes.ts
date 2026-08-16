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
  TeamAgentProposalAlreadyReviewedError,
  TeamAgentProposalNotFoundError,
  TeamAgentValidationError,
} from "./team-agent.errors";

import type {
  TeamAgentService,
} from "./team-agent.service";

import type {
  TaskProposalPayload,
  TaskProposalReviewAction,
} from "./team-agent.types";


function isUuid(
  value: string
): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}


function isNullableString(
  value: unknown
): value is string | null {
  return (
    value === null ||
    typeof value === "string"
  );
}


function parseReviewedPayload(
  value: unknown
): TaskProposalPayload | null | undefined {
  if (value === null) {
    return null;
  }


  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return undefined;
  }


  const payload =
    value as
      Record<string, unknown>;


  if (
    typeof payload.title !==
      "string" ||
    !isNullableString(
      payload.description
    ) ||
    !isNullableString(
      payload.assigned_to
    ) ||
    !isNullableString(
      payload.due_date
    ) ||
    typeof payload.source_message_id !==
      "string" ||
    typeof payload.source_message_version_id !==
      "string"
  ) {
    return undefined;
  }


  if (
    !isUuid(
      payload.source_message_id
    ) ||
    !isUuid(
      payload.source_message_version_id
    )
  ) {
    return undefined;
  }


  if (
    payload.assigned_to !== null &&
    !isUuid(
      payload.assigned_to
    )
  ) {
    return undefined;
  }


  return {
    title:
      payload.title,

    description:
      payload.description,

    assigned_to:
      payload.assigned_to,

    due_date:
      payload.due_date,

    source_message_id:
      payload.source_message_id,

    source_message_version_id:
      payload.source_message_version_id,
  };
}


export function createTeamAgentRouter(
  teamAgentService:
    TeamAgentService
): Router {
  const router =
    Router();


  router.post(
    "/projects/:projectId/task-proposals/:proposalId/review",

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


        const rawAction =
          req.body?.action;


        let action:
          TaskProposalReviewAction;


        if (
          rawAction ===
            "confirm" ||
          rawAction ===
            "edit" ||
          rawAction ===
            "reject"
        ) {
          action =
            rawAction;
        } else {
          res.status(
            400
          ).json(
            failure(
              "VALIDATION_ERROR",

              "Review action must be confirm, edit, or reject.",

              context.correlationId
            )
          );

          return;
        }


        let reviewedPayload:
          TaskProposalPayload | null =
            null;


        if (
          req.body &&
          Object.prototype
            .hasOwnProperty
            .call(
              req.body,
              "reviewed_payload"
            )
        ) {
          const parsed =
            parseReviewedPayload(
              req.body
                .reviewed_payload
            );


          if (
            parsed ===
            undefined
          ) {
            res.status(
              400
            ).json(
              failure(
                "VALIDATION_ERROR",

                "reviewed_payload must contain valid task proposal values.",

                context.correlationId
              )
            );

            return;
          }


          reviewedPayload =
            parsed;
        }


        const result =
          await teamAgentService
            .reviewTaskProposal(
              context,
              projectId,
              proposalId,
              action,
              reviewedPayload
            );


        res.status(
          200
        ).json(
          success(
            {
              proposal_id:
                result.proposalId,

              project_id:
                result.projectId,

              status:
                result.status,

              reviewed_payload:
                result.reviewedPayload,

              reviewed_by:
                result.reviewedBy,

              reviewed_at:
                result.reviewedAt,
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
          TeamAgentValidationError
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


        if (
          error instanceof
          TeamAgentProposalAlreadyReviewedError
        ) {
          res.status(
            409
          ).json(
            failure(
              "CONFLICT",

              "Task proposal has already been reviewed.",

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
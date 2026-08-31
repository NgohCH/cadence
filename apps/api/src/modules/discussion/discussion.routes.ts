import { Router } from "express";

import {
  failure,
  success,
} from "../../bootstrap/api-response";

import type {
  AuthenticatedRequestState,
} from "../../middleware/authenticate";

import {
  DiscussionParentMessageNotFoundError,
  DiscussionPermissionDeniedError,
  DiscussionProjectNotFoundError,
  DiscussionValidationError,
} from "./discussion.errors";

import type {
  DiscussionService,
} from "./discussion.service";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export function createDiscussionRouter(
  discussionService: DiscussionService
): Router {
  const router = Router();

  router.get(
    "/projects/:projectId/messages",
    async (req, res, next) => {
      const authenticated =
        res.locals.authenticated as AuthenticatedRequestState;

      const { context } = authenticated;

      try {
        const projectId =
          req.params.projectId;

        if (!isUuid(projectId)) {
          res.status(400).json(
            failure(
              "VALIDATION_ERROR",
              "Project ID must be a valid UUID.",
              context.correlationId
            )
          );

          return;
        }

        const messages =
          await discussionService.listProjectMessages(
            context,
            projectId
          );

        res.status(200).json(
          success(
            {
              messages: messages.map(
                (message) => ({
                  id: message.id,
                  project_id:
                    message.projectId,
                  author_user_id:
                    message.authorUserId,
                  author_type:
                    message.authorType,
                  thread_parent_id:
                    message.threadParentId,
                  current_version:
                    message.currentVersion,
                  content:
                    message.content,
                  created_at:
                    message.createdAt,
                  edited_at:
                    message.editedAt,
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
        if (
          error instanceof
          DiscussionProjectNotFoundError
        ) {
          res.status(404).json(
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
          DiscussionPermissionDeniedError
        ) {
          res.status(403).json(
            failure(
              "PERMISSION_DENIED",
              "You do not have permission to view messages in this project.",
              context.correlationId
            )
          );

          return;
        }

        next(error);
      }
    }
  );

  router.post(
    "/projects/:projectId/messages",
    async (req, res, next) => {
      const authenticated =
        res.locals.authenticated as AuthenticatedRequestState;

      const { context } =
        authenticated;

      try {
        const projectId =
          req.params.projectId;

        if (!isUuid(projectId)) {
          res.status(400).json(
            failure(
              "VALIDATION_ERROR",
              "Project ID must be a valid UUID.",
              context.correlationId
            )
          );

          return;
        }

        const content =
          req.body?.content;

        const threadParentId =
          req.body?.thread_parent_id ?? null;

        if (typeof content !== "string") {
          res.status(400).json(
            failure(
              "VALIDATION_ERROR",
              "Message content is required.",
              context.correlationId
            )
          );

          return;
        }

        if (
          threadParentId !== null &&
          (
            typeof threadParentId !== "string" ||
            !isUuid(threadParentId)
          )
        ) {
          res.status(400).json(
            failure(
              "VALIDATION_ERROR",
              "Thread parent ID must be a valid UUID.",
              context.correlationId
            )
          );

          return;
        }

        const message =
          await discussionService.postMessage(
            context,
            projectId,
            content,
            threadParentId
          );

        res.status(201).json(
          success(
            {
              id: message.id,
              project_id:
                message.projectId,
              author_user_id:
                message.authorUserId,
              author_type:
                message.authorType,
              thread_parent_id:
                message.threadParentId,
              current_version:
                message.currentVersion,
              content:
                message.content,
              created_at:
                message.createdAt,
              edited_at:
                message.editedAt,
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
        if (
          error instanceof
          DiscussionValidationError
        ) {
          res.status(400).json(
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
          DiscussionParentMessageNotFoundError
        ) {
          res.status(400).json(
            failure(
              "VALIDATION_ERROR",
              "Parent message was not found in this project.",
              context.correlationId
            )
          );

          return;
        }

        if (
          error instanceof
          DiscussionProjectNotFoundError
        ) {
          res.status(404).json(
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
          DiscussionPermissionDeniedError
        ) {
          res.status(403).json(
            failure(
              "PERMISSION_DENIED",
              "You do not have permission to post messages to this project.",
              context.correlationId
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

import type {
  RequestContext,
} from "../../bootstrap/request-context";

import { RbacService } from "../rbac/rbac.service";

import type {
  DiscussionRepository,
} from "./discussion.repository";

import type {
  DiscussionMessage,
} from "./discussion.types";

import {
  DiscussionPermissionDeniedError,
  DiscussionProjectNotFoundError,
  DiscussionValidationError,
} from "./discussion.errors";

export class DiscussionService {
  constructor(
    private readonly rbacService: RbacService,
    private readonly repository: DiscussionRepository
  ) {}

  async postMessage(
    context: RequestContext,
    projectId: string,
    content: string,
    threadParentId: string | null = null
  ): Promise<DiscussionMessage> {
    const trimmedContent =
      content.trim();

    if (trimmedContent.length === 0) {
      throw new DiscussionValidationError(
        "Message content is required."
      );
    }

    if (trimmedContent.length > 20000) {
      throw new DiscussionValidationError(
        "Message content must not exceed 20000 characters."
      );
    }

    const access =
      await this.rbacService.getProjectAccess(
        context.actorUserId,
        projectId
      );

    if (!access) {
      throw new DiscussionProjectNotFoundError();
    }

    if (
      !access.permissions.includes(
        "message.create"
      )
    ) {
      throw new DiscussionPermissionDeniedError();
    }

    return this.repository.createMessage({
      projectId,
      authorUserId:
        context.actorUserId,
      content: trimmedContent,
      threadParentId,
      correlationId:
        context.correlationId,
      causationId: null,
    });
  }
}
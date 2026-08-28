import type {
  RequestContext,
} from "../../bootstrap/request-context";

import type {
  EffectiveProjectAuthorisation,
} from "../project-membership/project-authorisation.types";

import type {
  DiscussionRepository,
} from "./discussion.repository";

import type {
  DiscussionMessage,
  DiscussionMessageVersion,
} from "./discussion.types";

import {
  DiscussionPermissionDeniedError,
  DiscussionProjectNotFoundError,
  DiscussionValidationError,
} from "./discussion.errors";


export interface DiscussionAuthorisationService {
  getEffectiveProjectAuthorisation(
    personId: string,
    projectId: string
  ): Promise<EffectiveProjectAuthorisation>;
}


export class DiscussionService {
  constructor(
    private readonly authorisationService:
      DiscussionAuthorisationService,

    private readonly repository:
      DiscussionRepository
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

    const authorisation =
      await this.authorisationService
        .getEffectiveProjectAuthorisation(
          context.actorPersonId,
          projectId
        );

    /*
     * Preserve the existing concealment behaviour.
     */
    if (
      authorisation.membershipIds.length === 0
    ) {
      throw new DiscussionProjectNotFoundError();
    }

    if (
      !authorisation.permissions.includes(
        "message.create"
      )
    ) {
      throw new DiscussionPermissionDeniedError();
    }

    /*
     * Messages remain User-oriented application records.
     * actorUserId is attribution, not authorization evidence.
     */
    return this.repository.createMessage({
      projectId,

      authorUserId:
        context.actorUserId,

      content:
        trimmedContent,

      threadParentId,

      correlationId:
        context.correlationId,

      causationId:
        null,
    });
  }


  async getMessageVersion(
    projectId: string,
    messageId: string,
    versionNumber: number
  ): Promise<DiscussionMessageVersion | null> {
    return this.repository.getMessageVersion(
      projectId,
      messageId,
      versionNumber
    );
  }
}

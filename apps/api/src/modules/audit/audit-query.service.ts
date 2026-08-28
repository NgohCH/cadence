import type {
  RequestContext,
} from "../../bootstrap/request-context";

import type {
  EffectiveProjectAuthorisation,
} from "../project-membership/project-authorisation.types";

import {
  AuditJourneyNotFoundError,
  AuditPermissionDeniedError,
  AuditProjectNotFoundError,
  AuditValidationError,
} from "./audit.errors";

import type {
  AuditQueryRepository,
} from "./audit-query.repository";

import type {
  TaskAuditJourney,
} from "./audit.types";


export interface AuditAuthorizationService {
  getEffectiveProjectAuthorisation(
    personId: string,
    projectId: string
  ): Promise<EffectiveProjectAuthorisation>;
}


export class AuditQueryService {
  constructor(
    private readonly authorizationService:
      AuditAuthorizationService,

    private readonly repository:
      AuditQueryRepository
  ) {}


  async getTaskJourney(
    context: RequestContext,
    projectIdInput: string,
    taskIdInput: string
  ): Promise<TaskAuditJourney> {
    const projectId =
      projectIdInput.trim();

    const taskId =
      taskIdInput.trim();


    if (
      projectId.length === 0 ||
      taskId.length === 0
    ) {
      throw new AuditValidationError(
        "Project ID and Task ID are required."
      );
    }


    /*
     * Resolve effective project authorisation before revealing
     * project audit data.
     */
    const authorisation =
      await this.authorizationService
        .getEffectiveProjectAuthorisation(
          context.actorPersonId,
          projectId
        );


    if (
      authorisation.membershipIds.length === 0
    ) {
      throw new AuditProjectNotFoundError();
    }


    if (
      !authorisation.permissions.includes(
        "audit.view"
      )
    ) {
      throw new AuditPermissionDeniedError();
    }


    const events =
      await this.repository
        .getTaskJourney(
          projectId,
          taskId
        );


    if (
      !events ||
      events.length === 0
    ) {
      throw new AuditJourneyNotFoundError();
    }


    /*
     * Preserve first-seen ordering.
     *
     * A journey may contain more than one correlation ID because
     * separate human HTTP interactions remain truthful separate
     * request contexts.
     */
    const correlationIds =
      Array.from(
        new Set(
          events.map(
            (event) =>
              event.correlationId
          )
        )
      );


    return {
      projectId,
      taskId,
      correlationIds,
      events,
    };
  }
}

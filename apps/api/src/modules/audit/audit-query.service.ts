import type {
  RequestContext,
} from "../../bootstrap/request-context";

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


interface AuditProjectAccess {
  permissions:
    string[];
}


export interface AuditAuthorizationService {
  getProjectAccess(
    userId: string,
    projectId: string
  ): Promise<AuditProjectAccess | null>;
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
     * Resolve project access before revealing project audit data.
     */
    const access =
      await this.authorizationService
        .getProjectAccess(
          context.actorUserId,
          projectId
        );


    if (!access) {
      throw new AuditProjectNotFoundError();
    }


    if (
      !access.permissions.includes(
        "audit.view"
      )
    ) {
      throw new AuditPermissionDeniedError();
    }


    /*
     * The repository passes actor identity to the database RPC,
     * which independently revalidates audit.view.
     */
    const events =
      await this.repository
        .getTaskJourney(
          projectId,
          taskId,
          context.actorUserId
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
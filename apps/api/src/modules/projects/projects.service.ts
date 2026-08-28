import type {
  RequestContext,
} from "../../bootstrap/request-context";

import type {
  EffectiveProjectAuthorisation,
} from "../project-membership/project-authorisation.types";

import type {
  ProjectSummary,
} from "./projects.types";

import type {
  ProjectWorkspaceReadRepository,
} from "./projects.repository";

import {
  ProjectNotFoundError,
  ProjectPermissionDeniedError,
} from "./projects.errors";


export interface ProjectsAuthorisationService {
  getEffectiveProjectAuthorisation(
    personId: string,
    projectId: string
  ): Promise<EffectiveProjectAuthorisation>;
}


export class ProjectsService {
  constructor(
    private readonly authorisationService:
      ProjectsAuthorisationService,

    private readonly repository:
      ProjectWorkspaceReadRepository
  ) {}


  async getProjectSummary(
    context: RequestContext,
    projectId: string
  ): Promise<ProjectSummary> {
    const authorisation =
      await this.authorisationService
        .getEffectiveProjectAuthorisation(
          context.actorPersonId,
          projectId
        );

    /*
     * Preserve the existing concealment behaviour:
     * an actor with no effective project membership sees
     * the project as not found.
     */
    if (
      authorisation.membershipIds.length === 0
    ) {
      throw new ProjectNotFoundError();
    }

    /*
     * An effective membership without project.view fails closed.
     *
     * This should not occur for a valid frozen role because every
     * current VS-002 project role includes project.view, but retaining
     * the distinction preserves the previous service contract and
     * exposes malformed authority rather than silently widening it.
     */
    if (
      !authorisation.permissions.includes(
        "project.view"
      )
    ) {
      throw new ProjectPermissionDeniedError();
    }

    /*
     * The existing workspace read model is still User-oriented.
     * actorUserId identifies that read-model projection; it is not
     * authorization evidence.
     */
    const summary =
      await this.repository.getSummary(
        projectId,
        context.actorUserId
      );

    if (!summary) {
      throw new ProjectNotFoundError();
    }

    return summary;
  }
}

import type { RequestContext } from "../../bootstrap/request-context";
import type { ProjectSummary } from "./projects.types";
import type { ProjectWorkspaceReadRepository } from "./projects.repository";

import { RbacService } from "../rbac/rbac.service";

import {
  ProjectNotFoundError,
  ProjectPermissionDeniedError,
} from "./projects.errors";

export class ProjectsService {
  constructor(
    private readonly rbacService: RbacService,
    private readonly repository: ProjectWorkspaceReadRepository
  ) {}

  async getProjectSummary(
    context: RequestContext,
    projectId: string
  ): Promise<ProjectSummary> {
    const access =
      await this.rbacService.getProjectAccess(
        context.actorUserId,
        projectId
      );

    if (!access) {
      throw new ProjectNotFoundError();
    }

    if (
      !access.permissions.includes("project.view")
    ) {
      throw new ProjectPermissionDeniedError();
    }

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
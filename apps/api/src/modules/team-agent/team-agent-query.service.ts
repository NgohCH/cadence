import type {
  RequestContext,
} from "../../bootstrap/request-context";

import {
  RbacService,
} from "../rbac/rbac.service";

import {
  TeamAgentPermissionDeniedError,
  TeamAgentProjectNotFoundError,
} from "./team-agent.errors";

import type {
  TeamAgentQueryRepository,
} from "./team-agent-query.repository";

import type {
  PendingTaskProposal,
} from "./team-agent.types";


export class TeamAgentQueryService {
  constructor(
    private readonly rbacService:
      RbacService,

    private readonly repository:
      TeamAgentQueryRepository
  ) {}


  async listPendingTaskProposals(
    context: RequestContext,
    projectId: string
  ): Promise<PendingTaskProposal[]> {
    const access =
      await this.rbacService
        .getProjectAccess(
          context.actorUserId,
          projectId
        );


    if (!access) {
      throw new TeamAgentProjectNotFoundError();
    }


    /*
     * The pending-proposal queue exists specifically
     * for human proposal review.
     *
     * Do not expose it to project members who cannot
     * perform that review.
     */
    if (
      !access.permissions.includes(
        "agent.approve"
      )
    ) {
      throw new TeamAgentPermissionDeniedError();
    }


    return this.repository
      .listPendingTaskProposals(
        projectId
      );
  }
}
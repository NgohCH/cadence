import type {
  RequestContext,
} from "../../bootstrap/request-context";

import type {
  EffectiveProjectAuthorisation,
} from "../project-membership/project-authorisation.types";

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


export interface TeamAgentQueryAuthorisationService {
  getEffectiveProjectAuthorisation(
    personId: string,
    projectId: string
  ): Promise<EffectiveProjectAuthorisation>;
}


export class TeamAgentQueryService {
  constructor(
    private readonly authorisationService:
      TeamAgentQueryAuthorisationService,

    private readonly repository:
      TeamAgentQueryRepository
  ) {}


  async listPendingTaskProposals(
    context: RequestContext,
    projectId: string
  ): Promise<PendingTaskProposal[]> {
    const authorisation =
      await this.authorisationService
        .getEffectiveProjectAuthorisation(
          context.actorPersonId,
          projectId
        );


    if (
      authorisation.membershipIds.length === 0
    ) {
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
      !authorisation.permissions.includes(
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

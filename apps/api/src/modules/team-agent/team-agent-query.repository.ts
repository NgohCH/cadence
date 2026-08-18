import type {
  PendingTaskProposal,
} from "./team-agent.types";


export interface TeamAgentQueryRepository {
  listPendingTaskProposals(
    projectId: string
  ): Promise<PendingTaskProposal[]>;
}
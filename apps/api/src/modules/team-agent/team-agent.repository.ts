import type {
  CreateTaskProposalInput,
  TaskProposalProcessingResult,
} from "./team-agent.types";

export interface TeamAgentRepository {
  createTaskProposal(
    input: CreateTaskProposalInput
  ): Promise<TaskProposalProcessingResult>;
}
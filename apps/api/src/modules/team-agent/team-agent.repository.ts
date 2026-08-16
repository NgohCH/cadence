import type {
  CreateTaskProposalInput,
  ReviewTaskProposalInput,
  TaskProposalProcessingResult,
  TaskProposalReviewResult,
} from "./team-agent.types";


export interface TeamAgentRepository {
  createTaskProposal(
    input: CreateTaskProposalInput
  ): Promise<TaskProposalProcessingResult>;

  reviewTaskProposal(
    input: ReviewTaskProposalInput
  ): Promise<TaskProposalReviewResult>;
}
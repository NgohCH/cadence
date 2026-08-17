import type {
  TaskProposalPayload,
} from "./team-agent.types";


export type MaterializableProposalStatus =
  | "pending"
  | "confirmed"
  | "edited"
  | "rejected"
  | "expired";


export interface ReviewedTaskProposalForMaterialization {
  proposalId: string;

  projectId: string;

  status:
    MaterializableProposalStatus;

  reviewedPayload:
    TaskProposalPayload | null;

  reviewedBy:
    string | null;

  reviewedAt:
    string | null;

  reviewEventId:
    string | null;

  reviewCorrelationId:
    string | null;

  resultEntityType:
    string | null;

  resultEntityId:
    string | null;
}


export interface TeamAgentTaskMaterializationRepository {
  getReviewedTaskProposal(
    projectId: string,
    proposalId: string
  ): Promise<ReviewedTaskProposalForMaterialization | null>;


  recordTaskResult(
    projectId: string,
    proposalId: string,
    taskId: string
  ): Promise<void>;
}

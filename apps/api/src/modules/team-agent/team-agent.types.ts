export interface ProcessMessageForTaskProposalInput {
  sourceEventId: string;

  projectId: string;

  messageId: string;
  messageVersionId: string;
  versionNumber: number;

  content: string;

  triggeredByUserId: string | null;

  correlationId: string;

  occurredAt: string;
}


export interface TaskProposalPayload {
  title: string;

  description: string | null;

  assigned_to: string | null;

  due_date: string | null;

  source_message_id: string;

  source_message_version_id: string;
}
export type TaskProposalReviewAction =
  | "confirm"
  | "edit"
  | "reject";


export type TaskProposalReviewStatus =
  | "confirmed"
  | "edited"
  | "rejected";


export interface ReviewTaskProposalInput {
  projectId: string;

  proposalId: string;

  reviewerUserId: string;

  action: TaskProposalReviewAction;

  reviewedPayload:
    TaskProposalPayload | null;

  correlationId: string;
}


export interface TaskProposalReviewResult {
  proposalId: string;

  projectId: string;

  status: TaskProposalReviewStatus;

  reviewedPayload:
    TaskProposalPayload | null;

  reviewedBy: string;

  reviewedAt: string;
}


export interface CreateTaskProposalInput {
  sourceEventId: string;

  projectId: string;

  triggeredByUserId: string | null;

  messageId: string;

  messageVersionId: string;

  versionNumber: number;

  correlationId: string;

  modelProvider: string;

  modelName: string;

  promptVersionId: string | null;

  proposalPayload:
    TaskProposalPayload;

  confidence: number | null;

  reason: string | null;

  outputRaw: unknown | null;
}


export interface TaskProposalProcessingResult {
  aiRunId: string;

  proposalId: string;

  created: boolean;
}
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
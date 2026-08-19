export interface TaskProposalPayload {
  title: string
  description: string | null
  assigned_to: string | null
  due_date: string | null
  source_message_id: string
  source_message_version_id: string
}


export interface PendingTaskProposal {
  id: string
  project_id: string
  ai_run_id: string
  status: 'pending'
  payload: TaskProposalPayload
  confidence: number | null
  reason: string | null
  created_at: string
}


export interface PendingTaskProposalsResponse {
  proposals: PendingTaskProposal[]
}


export type TaskProposalReviewStatus =
  | 'confirmed'
  | 'edited'
  | 'rejected'


export interface TaskProposalReviewResult {
  proposal_id: string
  project_id: string
  status: TaskProposalReviewStatus
  reviewed_payload: TaskProposalPayload | null
  reviewed_by: string
  reviewed_at: string
}
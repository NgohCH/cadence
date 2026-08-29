export type AuditActorType =
  | 'human'
  | 'agent'
  | 'system'

export interface AuditJourneyEvent {
  audit_event_id: string | null
  domain_event_id: string
  event_type: string
  event_version: number
  entity_type: string
  entity_id: string
  action: string
  actor_type: AuditActorType
  actor_id: string | null
  correlation_id: string
  causation_id: string | null
  source_type: string | null
  source_id: string | null
  occurred_at: string
  before_state: unknown | null
  after_state: unknown | null
  metadata: unknown | null
}

export interface TaskAuditJourney {
  project_id: string
  task_id: string
  correlation_ids: string[]
  correlation_count: number
  events: AuditJourneyEvent[]
}

export interface TaskAuditResponse {
  journey: TaskAuditJourney
}
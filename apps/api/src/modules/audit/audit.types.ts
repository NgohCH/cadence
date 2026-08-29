export interface AuditJourneyEvent {
  auditEventId:
    string | null;

  domainEventId:
    string;

  eventType:
    string;

  eventVersion:
    number;

  entityType:
    string;

  entityId:
    string;

  action:
    string;

  actorType:
    | "human"
    | "agent"
    | "system";

  actorId:
    string | null;

  correlationId:
    string;

  causationId:
    string | null;

  sourceType:
    string | null;

  sourceId:
    string | null;

  occurredAt:
    string;

  beforeState:
    unknown | null;

  afterState:
    unknown | null;

  metadata:
    unknown | null;
}


export interface TaskAuditJourney {
  projectId:
    string;

  taskId:
    string;

  correlationIds:
    string[];

  events:
    AuditJourneyEvent[];
}
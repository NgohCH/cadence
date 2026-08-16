export interface DomainEvent<TPayload = unknown> {
  eventId: string;
  eventType: string;
  eventVersion: number;

  aggregateType: string;
  aggregateId: string;

  correlationId: string;
  causationId?: string;

  occurredAt: string;

  actorType:
    | "human"
    | "agent"
    | "system";

  actorId?: string;

  projectId?: string;

  payload: TPayload;
}
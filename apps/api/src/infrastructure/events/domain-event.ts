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
    | "person"
    | "agent"
    | "system";

  actorId?: string | null;

  projectId?: string;

  payload: TPayload;
}

export interface DomainEvent<TPayload = unknown> {
  eventId: string;
  eventType: string;

  correlationId: string;
  causationId?: string;

  occurredAt: string;

  actorUserId?: string;
  projectId?: string;

  payload: TPayload;
}
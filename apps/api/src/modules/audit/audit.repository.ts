export interface AuditRepository {
  projectDomainEvent(
    eventId: string
  ): Promise<boolean>;
}
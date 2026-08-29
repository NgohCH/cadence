import type {
  AuditRepository,
} from "./audit.repository";


export class AuditService {
  constructor(
    private readonly repository:
      AuditRepository
  ) {}


  async projectDomainEvent(
    eventId: string
  ): Promise<boolean> {
    return this.repository
      .projectDomainEvent(
        eventId
      );
  }
}
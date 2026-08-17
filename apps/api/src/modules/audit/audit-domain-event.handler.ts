import type {
  DomainEvent,
} from "../../infrastructure/events/domain-event";

import type {
  DomainEventHandler,
} from "../../infrastructure/events/domain-event.handler";

import {
  AuditService,
} from "./audit.service";


export class AuditDomainEventHandler
  implements DomainEventHandler
{
  readonly consumerName =
    "audit.domain-events.v1";


  constructor(
    private readonly auditService:
      AuditService
  ) {}


  async handle(
    event: DomainEvent
  ): Promise<void> {
    if (
      event.eventVersion !== 1
    ) {
      throw new Error(
        "Audit received an unsupported domain-event version."
      );
    }


    switch (
      event.eventType
    ) {
      case "MessageCreated":
      case "AIProposalCreated":
      case "AIProposalConfirmed":
      case "AIProposalEdited":
      case "AIProposalRejected":
      case "TaskCreated":
        break;

      default:
        throw new Error(
          "Audit received an unsupported domain event."
        );
    }


    if (!event.projectId) {
      throw new Error(
        "Auditable VS-001 domain event is missing projectId."
      );
    }


    await this.auditService
      .projectDomainEvent(
        event.eventId
      );
  }
}
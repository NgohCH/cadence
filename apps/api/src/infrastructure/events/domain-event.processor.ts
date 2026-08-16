import type {
  DomainEventHandler,
} from "./domain-event.handler";

import type {
  DomainEventRepository,
} from "./domain-event.repository";

export class DomainEventProcessor {
  constructor(
    private readonly repository:
      DomainEventRepository
  ) {}

  async processNext(
    handler: DomainEventHandler
  ): Promise<boolean> {
    const claimed =
      await this.repository.claimNext(
        handler.consumerName
      );

    if (!claimed) {
      return false;
    }

    try {
      await handler.handle(
        claimed.event
      );

      const completed =
        await this.repository.complete(
          claimed.event.eventId,
          claimed.consumerName,
          claimed.claimToken
        );

      if (!completed) {
        throw new Error(
          "Domain event delivery could not be completed because the claim is no longer valid."
        );
      }

      return true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown domain event processing error.";

      await this.repository.fail(
        claimed.event.eventId,
        claimed.consumerName,
        claimed.claimToken,
        message
      );

      throw error;
    }
  }
}
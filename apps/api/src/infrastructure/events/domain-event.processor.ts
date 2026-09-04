import type {
  DomainEventHandler,
} from "./domain-event.handler";

import type {
  DomainEventRepository,
} from "./domain-event.repository";

import type {
  DeliveryRetryPolicy,
} from "../../runtime/worker-retry-policy";

export interface DomainEventProcessorOptions {
  retryPolicy?: DeliveryRetryPolicy;
  currentTime?: () => Date;
}

function toSafeDeliveryError(
  error: unknown
): string {
  const name =
    error instanceof Error &&
    /^[A-Za-z0-9_.-]{1,48}$/.test(
      error.name
    )
      ? error.name
      : "UnknownError";

  return `HANDLER_FAILED:${name}`;
}

export class DomainEventProcessor {
  constructor(
    private readonly repository:
      DomainEventRepository,
    private readonly options:
      DomainEventProcessorOptions = {}
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
      const retryAt =
        this.options.retryPolicy?.({
          processingAttempts:
            claimed.processingAttempts,
          failedAt:
            (
              this.options.currentTime ??
              (() => new Date())
            )().toISOString(),
        });

      await this.repository.fail(
        claimed.event.eventId,
        claimed.consumerName,
        claimed.claimToken,
        toSafeDeliveryError(error),
        retryAt
      );

      throw error;
    }
  }
}

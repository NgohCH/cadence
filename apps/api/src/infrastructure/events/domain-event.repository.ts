import type {
  DomainEvent,
} from "./domain-event";

export interface ClaimedDomainEvent {
  event: DomainEvent;

  consumerName: string;
  claimToken: string;
  processingAttempts: number;
}

export interface DomainEventRepository {
  claimNext(
    consumerName: string,
    leaseSeconds?: number
  ): Promise<ClaimedDomainEvent | null>;

  complete(
    eventId: string,
    consumerName: string,
    claimToken: string
  ): Promise<boolean>;

  fail(
    eventId: string,
    consumerName: string,
    claimToken: string,
    error: string,
    retryAt?: string
  ): Promise<boolean>;
}
import type {
  DomainEvent,
} from "./domain-event";

export interface DomainEventHandler {
  readonly consumerName: string;

  handle(
    event: DomainEvent
  ): Promise<void>;
}
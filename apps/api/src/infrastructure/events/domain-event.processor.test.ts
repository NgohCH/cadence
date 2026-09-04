import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  DomainEvent,
} from "./domain-event";

import type {
  DomainEventHandler,
} from "./domain-event.handler";

import {
  DomainEventProcessor,
} from "./domain-event.processor";

import {
  createDeliveryRetryPolicy,
} from "../../runtime/worker-retry-policy";

import type {
  ClaimedDomainEvent,
  DomainEventRepository,
} from "./domain-event.repository";


const event: DomainEvent = {
  eventId:
    "11111111-1111-4111-8111-111111111111",

  eventType:
    "MessageCreated",

  eventVersion: 1,

  aggregateType:
    "message",

  aggregateId:
    "22222222-2222-4222-8222-222222222222",

  projectId:
    "33333333-3333-4333-8333-333333333333",

  actorType:
    "human",

  actorId:
    "44444444-4444-4444-8444-444444444444",

  correlationId:
    "55555555-5555-4555-8555-555555555555",

  occurredAt:
    "2026-08-15T13:13:38.000Z",

  payload: {
    message_id:
      "22222222-2222-4222-8222-222222222222",

    project_id:
      "33333333-3333-4333-8333-333333333333",

    author_user_id:
      "44444444-4444-4444-8444-444444444444",

    thread_parent_id:
      null,

    version_number: 1,
  },
};


const claimedEvent: ClaimedDomainEvent = {
  event,

  consumerName:
    "team-agent.message-created.v1",

  claimToken:
    "66666666-6666-4666-8666-666666666666",

  processingAttempts: 1,
};


class FakeDomainEventRepository
  implements DomainEventRepository
{
  public claimed:
    ClaimedDomainEvent | null =
      claimedEvent;

  public claimCalls:
    string[] = [];

  public completeCalls: {
    eventId: string;
    consumerName: string;
    claimToken: string;
  }[] = [];

  public failCalls: {
    eventId: string;
    consumerName: string;
    claimToken: string;
    error: string;
    retryAt?: string;
  }[] = [];


  async claimNext(
    consumerName: string,
    _leaseSeconds?: number
  ): Promise<ClaimedDomainEvent | null> {
    this.claimCalls.push(
      consumerName
    );

    return this.claimed;
  }


  async complete(
    eventId: string,
    consumerName: string,
    claimToken: string
  ): Promise<boolean> {
    this.completeCalls.push({
      eventId,
      consumerName,
      claimToken,
    });

    return true;
  }


  async fail(
    eventId: string,
    consumerName: string,
    claimToken: string,
    error: string,
    retryAt?: string
  ): Promise<boolean> {
    this.failCalls.push({
      eventId,
      consumerName,
      claimToken,
      error,
      retryAt,
    });

    return true;
  }
}


class FakeDomainEventHandler
  implements DomainEventHandler
{
  readonly consumerName =
    "team-agent.message-created.v1";

  public events:
    DomainEvent[] = [];

  public error:
    Error | null = null;


  async handle(
    handledEvent: DomainEvent
  ): Promise<void> {
    this.events.push(
      handledEvent
    );

    if (this.error) {
      throw this.error;
    }
  }
}


test(
  "processNext claims, handles, and completes one delivery",
  async () => {
    const repository =
      new FakeDomainEventRepository();

    const handler =
      new FakeDomainEventHandler();

    const processor =
      new DomainEventProcessor(
        repository
      );

    const processed =
      await processor.processNext(
        handler
      );

    assert.equal(
      processed,
      true
    );

    assert.deepEqual(
      repository.claimCalls,
      [
        "team-agent.message-created.v1",
      ]
    );

    assert.equal(
      handler.events.length,
      1
    );

    assert.equal(
      handler.events[0].eventId,
      event.eventId
    );

    assert.deepEqual(
      repository.completeCalls,
      [
        {
          eventId:
            event.eventId,

          consumerName:
            claimedEvent.consumerName,

          claimToken:
            claimedEvent.claimToken,
        },
      ]
    );

    assert.equal(
      repository.failCalls.length,
      0
    );
  }
);


test(
  "processNext returns false when no delivery is available",
  async () => {
    const repository =
      new FakeDomainEventRepository();

    repository.claimed =
      null;

    const handler =
      new FakeDomainEventHandler();

    const processor =
      new DomainEventProcessor(
        repository
      );

    const processed =
      await processor.processNext(
        handler
      );

    assert.equal(
      processed,
      false
    );

    assert.equal(
      handler.events.length,
      0
    );

    assert.equal(
      repository.completeCalls.length,
      0
    );

    assert.equal(
      repository.failCalls.length,
      0
    );
  }
);


test(
  "processNext marks the delivery failed when the handler throws",
  async () => {
    const repository =
      new FakeDomainEventRepository();

    const handler =
      new FakeDomainEventHandler();

    handler.error =
      new Error(
        "Team Agent processing failed."
      );

    const processor =
      new DomainEventProcessor(
        repository,
        {
          retryPolicy:
            createDeliveryRetryPolicy(
              [60, 300, 900, 3600]
            ),
          currentTime:
            () =>
              new Date(
                "2026-09-04T00:00:00.000Z"
              ),
        }
      );

    await assert.rejects(
      () =>
        processor.processNext(
          handler
        ),
      /Team Agent processing failed/
    );

    assert.equal(
      repository.completeCalls.length,
      0
    );

    assert.deepEqual(
      repository.failCalls,
      [
        {
          eventId:
            event.eventId,

          consumerName:
            claimedEvent.consumerName,

          claimToken:
            claimedEvent.claimToken,

          error:
            "HANDLER_FAILED:Error",

          retryAt:
            "2026-09-04T00:01:00.000Z",
        },
      ]
    );
  }
);


test(
  "failure persistence stores a bounded safe category, not the raw handler message",
  async () => {
    const repository =
      new FakeDomainEventRepository();

    const handler =
      new FakeDomainEventHandler();

    handler.error =
      new Error(
        "SUPABASE_SECRET_KEY=do-not-store"
      );

    const processor =
      new DomainEventProcessor(
        repository,
        {
          retryPolicy:
            createDeliveryRetryPolicy(
              [60, 300, 900, 3600]
            ),
          currentTime:
            () =>
              new Date(
                "2026-09-04T00:00:00.000Z"
              ),
        }
      );

    await assert.rejects(
      () =>
        processor.processNext(
          handler
        )
    );

    assert.equal(
      repository.failCalls[0]?.error,
      "HANDLER_FAILED:Error"
    );

    assert.equal(
      repository.failCalls[0]?.retryAt,
      "2026-09-04T00:01:00.000Z"
    );

    assert.doesNotMatch(
      JSON.stringify(
        repository.failCalls
      ),
      /do-not-store/
    );
  }
);

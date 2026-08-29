import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  DomainEvent,
} from "../../infrastructure/events/domain-event";

import {
  AuditDomainEventHandler,
} from "./audit-domain-event.handler";

import type {
  AuditRepository,
} from "./audit.repository";

import {
  AuditService,
} from "./audit.service";


class FakeAuditRepository
  implements AuditRepository
{
  public eventIds:
    string[] = [];

  public result =
    true;

  public error:
    Error | null = null;


  async projectDomainEvent(
    eventId: string
  ): Promise<boolean> {
    this.eventIds.push(
      eventId
    );


    if (this.error) {
      throw this.error;
    }


    return this.result;
  }
}


function createEvent(
  overrides:
    Partial<DomainEvent> = {}
): DomainEvent {
  return {
    eventId:
      "11111111-1111-4111-8111-111111111111",

    eventType:
      "TaskCreated",

    eventVersion:
      1,

    aggregateType:
      "task",

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

    causationId:
      "66666666-6666-4666-8666-666666666666",

    occurredAt:
      "2026-08-17T12:00:00.000Z",

    payload: {
      task_id:
        "22222222-2222-4222-8222-222222222222",
    },

    ...overrides,
  };
}


test(
  "AuditDomainEventHandler projects a supported VS-001 event",
  async () => {
    const repository =
      new FakeAuditRepository();

    const service =
      new AuditService(
        repository
      );

    const handler =
      new AuditDomainEventHandler(
        service
      );


    const event =
      createEvent();


    await handler.handle(
      event
    );


    assert.deepEqual(
      repository.eventIds,
      [
        event.eventId,
      ]
    );
  }
);


test(
  "AuditDomainEventHandler accepts an idempotent existing projection",
  async () => {
    const repository =
      new FakeAuditRepository();

    repository.result =
      false;


    const service =
      new AuditService(
        repository
      );

    const handler =
      new AuditDomainEventHandler(
        service
      );


    const event =
      createEvent();


    await handler.handle(
      event
    );


    assert.deepEqual(
      repository.eventIds,
      [
        event.eventId,
      ]
    );
  }
);


test(
  "AuditDomainEventHandler rejects unsupported domain events",
  async () => {
    const repository =
      new FakeAuditRepository();

    const service =
      new AuditService(
        repository
      );

    const handler =
      new AuditDomainEventHandler(
        service
      );


    await assert.rejects(
      () =>
        handler.handle(
          createEvent({
            eventType:
              "SomethingElse",
          })
        ),
      /unsupported domain event/
    );


    assert.equal(
      repository.eventIds.length,
      0
    );
  }
);


test(
  "AuditDomainEventHandler rejects unsupported versions",
  async () => {
    const repository =
      new FakeAuditRepository();

    const service =
      new AuditService(
        repository
      );

    const handler =
      new AuditDomainEventHandler(
        service
      );


    await assert.rejects(
      () =>
        handler.handle(
          createEvent({
            eventVersion:
              2,
          })
        ),
      /unsupported domain-event version/
    );


    assert.equal(
      repository.eventIds.length,
      0
    );
  }
);


test(
  "AuditDomainEventHandler requires project provenance",
  async () => {
    const repository =
      new FakeAuditRepository();

    const service =
      new AuditService(
        repository
      );

    const handler =
      new AuditDomainEventHandler(
        service
      );


    await assert.rejects(
      () =>
        handler.handle(
          createEvent({
            projectId:
              undefined,
          })
        ),
      /missing projectId/
    );


    assert.equal(
      repository.eventIds.length,
      0
    );
  }
);


test(
  "AuditDomainEventHandler accepts all six VS002 membership v1 events with Person and system provenance",
  async () => {
    const repository =
      new FakeAuditRepository();
    const handler =
      new AuditDomainEventHandler(
        new AuditService(
          repository
        )
      );

    const eventTypes = [
      "ProjectMemberAdded",
      "ProjectMemberRemoved",
      "ProjectMembershipExpired",
      "ProjectRoleAssigned",
      "ProjectRoleRevoked",
      "ProjectRoleTransferred",
    ] as const;

    for (const [index, eventType]
      of eventTypes.entries()) {
      const expiry =
        eventType ===
          "ProjectMembershipExpired";

      await handler.handle(
        createEvent({
          eventId:
            `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
          eventType,
          actorType:
            expiry
              ? "system"
              : "person",
          actorId:
            expiry
              ? null
              : "44444444-4444-4444-8444-444444444444",
        })
      );
    }

    assert.equal(
      repository.eventIds.length,
      6
    );
  }
);


test(
  "AuditDomainEventHandler rejects unsupported versions for every VS002 membership event",
  async () => {
    const repository =
      new FakeAuditRepository();
    const handler =
      new AuditDomainEventHandler(
        new AuditService(
          repository
        )
      );

    for (const eventType of [
      "ProjectMemberAdded",
      "ProjectMemberRemoved",
      "ProjectMembershipExpired",
      "ProjectRoleAssigned",
      "ProjectRoleRevoked",
      "ProjectRoleTransferred",
    ]) {
      await assert.rejects(
        () =>
          handler.handle(
            createEvent({
              eventType,
              eventVersion: 2,
            })
          ),
        /unsupported domain-event version/
      );
    }

    assert.equal(
      repository.eventIds.length,
      0
    );
  }
);

import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  RequestContext,
} from "../../bootstrap/request-context";

import type {
  EffectiveProjectAuthorisation,
} from "../project-membership/project-authorisation.types";

import {
  AuditJourneyNotFoundError,
  AuditPermissionDeniedError,
  AuditProjectNotFoundError,
} from "./audit.errors";

import type {
  AuditQueryRepository,
} from "./audit-query.repository";

import {
  AuditQueryService,
} from "./audit-query.service";

import type {
  AuditAuthorizationService,
} from "./audit-query.service";

import type {
  AuditJourneyEvent,
} from "./audit.types";


const context =
  {
    actorUserId:
      "11111111-1111-4111-8111-111111111111",

    actorPersonId:
      "aaaaaaaa-1111-4111-8111-111111111111",

    requestId:
      "22222222-2222-4222-8222-222222222222",

    correlationId:
      "33333333-3333-4333-8333-333333333333",
  } as RequestContext;


const projectId =
  "44444444-4444-4444-8444-444444444444";

const taskId =
  "55555555-5555-4555-8555-555555555555";

const membershipId =
  "aaaaaaaa-5555-4555-8555-555555555555";


const events:
  AuditJourneyEvent[] = [
    {
      auditEventId:
        "61111111-1111-4111-8111-111111111111",

      domainEventId:
        "62111111-1111-4111-8111-111111111111",

      eventType:
        "MessageCreated",

      eventVersion:
        1,

      entityType:
        "message",

      entityId:
        "63111111-1111-4111-8111-111111111111",

      action:
        "message.created",

      actorType:
        "human",

      actorId:
        context.actorUserId,

      correlationId:
        "64111111-1111-4111-8111-111111111111",

      causationId:
        null,

      sourceType:
        null,

      sourceId:
        null,

      occurredAt:
        "2026-08-17T03:00:00.000Z",

      beforeState:
        null,

      afterState:
        {},

      metadata:
        {},
    },

    {
      auditEventId:
        "65111111-1111-4111-8111-111111111111",

      domainEventId:
        "66111111-1111-4111-8111-111111111111",

      eventType:
        "AIProposalCreated",

      eventVersion:
        1,

      entityType:
        "ai_proposal",

      entityId:
        "67111111-1111-4111-8111-111111111111",

      action:
        "ai_proposal.created",

      actorType:
        "agent",

      actorId:
        null,

      correlationId:
        "64111111-1111-4111-8111-111111111111",

      causationId:
        "62111111-1111-4111-8111-111111111111",

      sourceType:
        "domain_event",

      sourceId:
        "62111111-1111-4111-8111-111111111111",

      occurredAt:
        "2026-08-17T03:01:00.000Z",

      beforeState:
        null,

      afterState:
        {},

      metadata:
        {},
    },

    {
      auditEventId:
        "68111111-1111-4111-8111-111111111111",

      domainEventId:
        "69111111-1111-4111-8111-111111111111",

      eventType:
        "AIProposalEdited",

      eventVersion:
        1,

      entityType:
        "ai_proposal",

      entityId:
        "67111111-1111-4111-8111-111111111111",

      action:
        "ai_proposal.edited",

      actorType:
        "human",

      actorId:
        context.actorUserId,

      correlationId:
        "70111111-1111-4111-8111-111111111111",

      causationId:
        null,

      sourceType:
        null,

      sourceId:
        null,

      occurredAt:
        "2026-08-17T03:02:00.000Z",

      beforeState:
        {
          status:
            "pending",
        },

      afterState:
        {},

      metadata:
        {},
    },

    {
      auditEventId:
        "71111111-1111-4111-8111-111111111111",

      domainEventId:
        "72111111-1111-4111-8111-111111111111",

      eventType:
        "TaskCreated",

      eventVersion:
        1,

      entityType:
        "task",

      entityId:
        taskId,

      action:
        "task.created",

      actorType:
        "human",

      actorId:
        context.actorUserId,

      correlationId:
        "70111111-1111-4111-8111-111111111111",

      causationId:
        "69111111-1111-4111-8111-111111111111",

      sourceType:
        "domain_event",

      sourceId:
        "69111111-1111-4111-8111-111111111111",

      occurredAt:
        "2026-08-17T03:03:00.000Z",

      beforeState:
        null,

      afterState:
        {},

      metadata:
        {},
    },
  ];


class FakeAuthorizationService
  implements AuditAuthorizationService
{
  public permissions:
    string[] = [
      "audit.view",
    ];

  public accessible =
    true;

  public calls: Array<{
    personId: string;
    projectId: string;
  }> = [];


  async getEffectiveProjectAuthorisation(
    requestedPersonId: string,
    requestedProjectId: string
  ): Promise<EffectiveProjectAuthorisation> {
    this.calls.push({
      personId:
        requestedPersonId,

      projectId:
        requestedProjectId,
    });


    return {
      personId:
        requestedPersonId,

      projectId:
        requestedProjectId,

      membershipIds:
        this.accessible
          ? [
              membershipId,
            ]
          : [],

      roles:
        this.accessible
          ? [
              "PROJECT_AUDITOR",
            ]
          : [],

      permissions:
        this.accessible
          ? this.permissions
          : [],

      evaluatedAt:
        "2026-08-27T13:00:00.000Z",
    };
  }
}

class FakeAuditQueryRepository
  implements AuditQueryRepository
{
  public result:
    AuditJourneyEvent[] | null =
      events;

  public calls: {
    projectId: string;
    taskId: string;
  }[] = [];


  async getTaskJourney(
    requestedProjectId: string,
    requestedTaskId: string
  ): Promise<AuditJourneyEvent[] | null> {
    this.calls.push({
      projectId:
        requestedProjectId,

      taskId:
        requestedTaskId,

    });

    return this.result;
  }
}


test(
  "audit reconstruction returns one business journey across multiple correlations",
  async () => {
    const authorization =
      new FakeAuthorizationService();

    const repository =
      new FakeAuditQueryRepository();

    const service =
      new AuditQueryService(
        authorization,
        repository
      );


    const journey =
      await service.getTaskJourney(
        context,
        projectId,
        taskId
      );


    assert.equal(
      journey.events.length,
      4
    );

    assert.deepEqual(
      journey.correlationIds,
      [
        "64111111-1111-4111-8111-111111111111",
        "70111111-1111-4111-8111-111111111111",
      ]
    );

        assert.deepEqual(
      authorization.calls,
      [
        {
          personId:
            context.actorPersonId,

          projectId,
        },
      ]
    );

assert.deepEqual(
      repository.calls,
      [
        {
          projectId,
          taskId,
        },
      ]
    );
  }
);


test(
  "audit reconstruction hides inaccessible projects",
  async () => {
    const authorization =
      new FakeAuthorizationService();

    authorization.accessible =
      false;

    const repository =
      new FakeAuditQueryRepository();

    const service =
      new AuditQueryService(
        authorization,
        repository
      );


    await assert.rejects(
      () =>
        service.getTaskJourney(
          context,
          projectId,
          taskId
        ),
      AuditProjectNotFoundError
    );

    assert.equal(
      repository.calls.length,
      0
    );
  }
);


test(
  "audit reconstruction requires audit.view",
  async () => {
    const authorization =
      new FakeAuthorizationService();

    authorization.permissions =
      [];

    const repository =
      new FakeAuditQueryRepository();

    const service =
      new AuditQueryService(
        authorization,
        repository
      );


    await assert.rejects(
      () =>
        service.getTaskJourney(
          context,
          projectId,
          taskId
        ),
      AuditPermissionDeniedError
    );

    assert.equal(
      repository.calls.length,
      0
    );
  }
);


test(
  "audit reconstruction reports a missing task journey",
  async () => {
    const authorization =
      new FakeAuthorizationService();

    const repository =
      new FakeAuditQueryRepository();

    repository.result =
      null;

    const service =
      new AuditQueryService(
        authorization,
        repository
      );


    await assert.rejects(
      () =>
        service.getTaskJourney(
          context,
          projectId,
          taskId
        ),
      AuditJourneyNotFoundError
    );
  }
);

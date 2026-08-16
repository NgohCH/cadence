import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  DomainEvent,
} from "../../infrastructure/events/domain-event";

import type {
  ProjectAccess,
} from "../rbac/rbac.types";

import type {
  RbacRepository,
} from "../rbac/rbac.repository";

import {
  RbacService,
} from "../rbac/rbac.service";

import type {
  DiscussionRepository,
} from "../discussion/discussion.repository";

import type {
  CreateDiscussionMessageInput,
  DiscussionMessage,
  DiscussionMessageVersion,
} from "../discussion/discussion.types";

import {
  DiscussionService,
} from "../discussion/discussion.service";

import type {
  TeamAgentRepository,
} from "./team-agent.repository";

import type {
  CreateTaskProposalInput,
  TaskProposalProcessingResult,
} from "./team-agent.types";

import {
  TeamAgentService,
} from "./team-agent.service";

import {
  MessageCreatedV1Handler,
} from "./message-created.handler";


const projectId =
  "11111111-1111-4111-8111-111111111111";

const messageId =
  "22222222-2222-4222-8222-222222222222";

const messageVersionId =
  "33333333-3333-4333-8333-333333333333";

const authorUserId =
  "44444444-4444-4444-8444-444444444444";

const eventId =
  "55555555-5555-4555-8555-555555555555";

const correlationId =
  "66666666-6666-4666-8666-666666666666";

const aiRunId =
  "77777777-7777-4777-8777-777777777777";

const proposalId =
  "88888888-8888-4888-8888-888888888888";

const occurredAt =
  "2026-08-15T13:13:38.000Z";

const messageContent =
  "Daniel, please finalise the syllabus by Friday.";


class FakeRbacRepository
  implements RbacRepository
{
  async getProjectAccess(
    _userId: string,
    _projectId: string
  ): Promise<ProjectAccess | null> {
    return null;
  }
}


class FakeDiscussionRepository
  implements DiscussionRepository
{
  constructor(
    private readonly version:
      DiscussionMessageVersion | null
  ) {}

  async createMessage(
    _input: CreateDiscussionMessageInput
  ): Promise<DiscussionMessage> {
    throw new Error(
      "createMessage is not used by this test."
    );
  }

  async getMessageVersion(
    requestedProjectId: string,
    requestedMessageId: string,
    requestedVersionNumber: number
  ): Promise<DiscussionMessageVersion | null> {
    if (!this.version) {
      return null;
    }

    if (
      this.version.projectId !==
        requestedProjectId ||
      this.version.messageId !==
        requestedMessageId ||
      this.version.versionNumber !==
        requestedVersionNumber
    ) {
      return null;
    }

    return this.version;
  }
}


class FakeTeamAgentRepository
  implements TeamAgentRepository
{
  public calls:
    CreateTaskProposalInput[] = [];

  public result:
    TaskProposalProcessingResult = {
      aiRunId,
      proposalId,
      created: true,
    };

  async createTaskProposal(
    input: CreateTaskProposalInput
  ): Promise<TaskProposalProcessingResult> {
    this.calls.push(
      input
    );

    return this.result;
  }
}


function createMessageVersion():
DiscussionMessageVersion {
  return {
    id:
      messageVersionId,

    messageId,

    projectId,

    versionNumber: 1,

    content:
      messageContent,

    editorUserId:
      authorUserId,

    editorType:
      "human",

    changeReason:
      null,

    createdAt:
      occurredAt,
  };
}


function createEvent():
DomainEvent {
  return {
    eventId,

    eventType:
      "MessageCreated",

    eventVersion: 1,

    aggregateType:
      "message",

    aggregateId:
      messageId,

    projectId,

    actorType:
      "human",

    actorId:
      authorUserId,

    correlationId,

    occurredAt,

    payload: {
      message_id:
        messageId,

      project_id:
        projectId,

      author_user_id:
        authorUserId,

      thread_parent_id:
        null,

      version_number: 1,
    },
  };
}


function createHandler(
  version:
    DiscussionMessageVersion | null =
      createMessageVersion()
): {
  handler: MessageCreatedV1Handler;
  teamAgentRepository:
    FakeTeamAgentRepository;
} {
  const discussionRepository =
    new FakeDiscussionRepository(
      version
    );

  const rbacRepository =
    new FakeRbacRepository();

  const discussionService =
    new DiscussionService(
      new RbacService(
        rbacRepository
      ),
      discussionRepository
    );

  const teamAgentRepository =
    new FakeTeamAgentRepository();

  const teamAgentService =
    new TeamAgentService(
      teamAgentRepository
    );

  return {
    handler:
      new MessageCreatedV1Handler(
        discussionService,
        teamAgentService
      ),

    teamAgentRepository,
  };
}


test(
  "MessageCreated.v1 creates a deterministic pending task proposal input",
  async () => {
    const {
      handler,
      teamAgentRepository,
    } = createHandler();

    await handler.handle(
      createEvent()
    );

    assert.equal(
      teamAgentRepository.calls.length,
      1
    );

    const input =
      teamAgentRepository.calls[0];

    assert.equal(
      input.sourceEventId,
      eventId
    );

    assert.equal(
      input.projectId,
      projectId
    );

    assert.equal(
      input.triggeredByUserId,
      authorUserId
    );

    assert.equal(
      input.messageId,
      messageId
    );

    assert.equal(
      input.messageVersionId,
      messageVersionId
    );

    assert.equal(
      input.versionNumber,
      1
    );

    assert.equal(
      input.correlationId,
      correlationId
    );

    assert.equal(
      input.modelProvider,
      "cadence-development"
    );

    assert.equal(
      input.modelName,
      "deterministic-task-proposal-v1"
    );

    assert.equal(
      input.promptVersionId,
      null
    );

    assert.equal(
      input.proposalPayload.title,
      messageContent
    );

    assert.equal(
      input.proposalPayload.description,
      messageContent
    );

    assert.equal(
      input.proposalPayload.assigned_to,
      null
    );

    assert.equal(
      input.proposalPayload.due_date,
      null
    );

    assert.equal(
      input.proposalPayload.source_message_id,
      messageId
    );

    assert.equal(
      input.proposalPayload.source_message_version_id,
      messageVersionId
    );

    assert.equal(
      input.confidence,
      null
    );

    assert.equal(
      input.reason,
      "VS001-05 deterministic development proposal generated from MessageCreated.v1."
    );

    assert.deepEqual(
      input.outputRaw,
      {
        generator:
          "deterministic-task-proposal-v1",

        occurred_at:
          occurredAt,
      }
    );
  }
);


test(
  "MessageCreated.v1 rejects unsupported event versions",
  async () => {
    const {
      handler,
      teamAgentRepository,
    } = createHandler();

    const event =
      createEvent();

    event.eventVersion = 2;

    await assert.rejects(
      () =>
        handler.handle(
          event
        ),
      /unsupported domain event/
    );

    assert.equal(
      teamAgentRepository.calls.length,
      0
    );
  }
);


test(
  "MessageCreated.v1 rejects an inconsistent project",
  async () => {
    const {
      handler,
      teamAgentRepository,
    } = createHandler();

    const event =
      createEvent();

    event.payload = {
      ...(
        event.payload as
          Record<string, unknown>
      ),

      project_id:
        "99999999-9999-4999-8999-999999999999",
    };

    await assert.rejects(
      () =>
        handler.handle(
          event
        ),
      /project does not match/
    );

    assert.equal(
      teamAgentRepository.calls.length,
      0
    );
  }
);


test(
  "MessageCreated.v1 fails when the immutable message version cannot be found",
  async () => {
    const {
      handler,
      teamAgentRepository,
    } = createHandler(
      null
    );

    await assert.rejects(
      () =>
        handler.handle(
          createEvent()
        ),
      /message version was not found/
    );

    assert.equal(
      teamAgentRepository.calls.length,
      0
    );
  }
);
import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  RequestContext,
} from "../../bootstrap/request-context";

import type {
  DomainEvent,
} from "../../infrastructure/events/domain-event";

import type {
  EffectiveProjectAuthorisation,
} from "../project-membership/project-authorisation.types";

import type {
  DiscussionAuthorisationService,
} from "../discussion/discussion.service";
import type {
  DiscussionRepository,
} from "../discussion/discussion.repository";

import {
  DiscussionService,
} from "../discussion/discussion.service";

import type {
  CreateDiscussionMessageInput,
  DiscussionMessage,
  DiscussionMessageVersion,
} from "../discussion/discussion.types";

import {
  TeamAgentPermissionDeniedError,
  TeamAgentProjectNotFoundError,
  TeamAgentValidationError,
} from "./team-agent.errors";

import {
  MessageCreatedV1Handler,
} from "./message-created.handler";

import type {
  TeamAgentRepository,
} from "./team-agent.repository";

import {
  TeamAgentService,
} from "./team-agent.service";

import type {
  TeamAgentAuthorisationService,
} from "./team-agent.service";

import type {
  CreateTaskProposalInput,
  ReviewTaskProposalInput,
  TaskProposalPayload,
  TaskProposalProcessingResult,
  TaskProposalReviewResult,
} from "./team-agent.types";


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

const reviewerUserId =
  "99999999-9999-4999-8999-999999999999";

const reviewerPersonId =
  "eeeeeeee-9999-4999-8999-999999999999";

const reviewRequestId =
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const reviewCorrelationId =
  "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const membershipId =
  "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const occurredAt =
  "2026-08-15T13:13:38.000Z";

const reviewedAt =
  "2026-08-16T03:00:00.000Z";

const messageContent =
  "Daniel, please finalise the syllabus by Friday.";


class FakeTeamAgentAuthorisationService
  implements TeamAgentAuthorisationService
{
  public readonly calls: Array<{
    personId: string;
    projectId: string;
  }> = [];


  constructor(
    private readonly result:
      EffectiveProjectAuthorisation
  ) {}


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

    return this.result;
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
      "createMessage is not used by Team Agent tests."
    );
  }


  async listProjectMessages(): Promise<DiscussionMessage[]> {
    return [];
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


  public reviewCalls:
    ReviewTaskProposalInput[] = [];


  public result:
    TaskProposalProcessingResult = {
      aiRunId,

      proposalId,

      created:
        true,
    };


  public reviewResult:
    TaskProposalReviewResult = {
      proposalId,

      projectId,

      status:
        "confirmed",

      reviewedPayload:
        null,

      reviewedBy:
        reviewerUserId,

      reviewedAt,
    };


  async createTaskProposal(
    input: CreateTaskProposalInput
  ): Promise<TaskProposalProcessingResult> {
    this.calls.push(
      input
    );

    return this.result;
  }


  async reviewTaskProposal(
    input: ReviewTaskProposalInput
  ): Promise<TaskProposalReviewResult> {
    this.reviewCalls.push(
      input
    );

    return this.reviewResult;
  }
}


function createMessageVersion():
DiscussionMessageVersion {
  return {
    id:
      messageVersionId,

    messageId,

    projectId,

    versionNumber:
      1,

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

    eventVersion:
      1,

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

      version_number:
        1,
    },
  };
}


class FakeDiscussionAuthorisationService
  implements DiscussionAuthorisationService
{
  async getEffectiveProjectAuthorisation(
    personId: string,
    projectId: string
  ): Promise<EffectiveProjectAuthorisation> {
    return {
      personId,
      projectId,

      membershipIds: [
        "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      ],

      roles: [
        "PROJECT_MEMBER",
      ],

      permissions: [
        "project.view",
        "message.view",
        "message.create",
      ],

      evaluatedAt:
        "2026-08-27T08:00:00.000Z",
    };
  }
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
const discussionService =
    new DiscussionService(
      new FakeDiscussionAuthorisationService(),
      discussionRepository
    );

  const teamAgentRepository =
    new FakeTeamAgentRepository();

  const teamAgentService =
    new TeamAgentService(
      new FakeTeamAgentAuthorisationService(createAuthorisation()),
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


function createReviewContext():
RequestContext {
  return {
    actorUserId:
      reviewerUserId,

    actorPersonId:
      reviewerPersonId,

    projectId,

    correlationId:
      reviewCorrelationId,

    requestId:
      reviewRequestId,

    source:
      "api",

    identityProvider:
      "test",
  };
}


function createAuthorisation(
  permissions:
    string[] = [
      "agent.approve",
    ],

  overrides:
    Partial<EffectiveProjectAuthorisation> = {}
): EffectiveProjectAuthorisation {
  return {
    personId:
      reviewerPersonId,

    projectId,

    membershipIds: [
      membershipId,
    ],

    roles: [
      "PROJECT_MANAGER",
    ],

    permissions,

    evaluatedAt:
      "2026-08-27T12:30:00.000Z",

    ...overrides,
  };
}

function createReviewedPayload():
TaskProposalPayload {
  return {
    title:
      "  Finalise revised syllabus  ",

    description:
      "Finalise the revised syllabus after human review.",

    assigned_to:
      null,

    due_date:
      null,

    source_message_id:
      messageId,

    source_message_version_id:
      messageVersionId,
  };
}


function createReviewService(
  authorisation:
    EffectiveProjectAuthorisation | null =
      createAuthorisation()
): {
  service:
    TeamAgentService;

  repository:
    FakeTeamAgentRepository;

  authorisationService:
    FakeTeamAgentAuthorisationService;
} {
  const effectiveAuthorisation =
    authorisation ??
    createAuthorisation(
      [],
      {
        membershipIds:
          [],

        roles:
          [],
      }
    );

  const authorisationService =
    new FakeTeamAgentAuthorisationService(
      effectiveAuthorisation
    );

  const repository =
    new FakeTeamAgentRepository();

  const service =
    new TeamAgentService(
      authorisationService,
      repository
    );


  return {
    service,
    repository,
    authorisationService,
  };
}

test(
  "proposal review uses Person identity for project authorization",
  async () => {
    const {
      service,
      authorisationService,
    } = createReviewService(
      createAuthorisation(
        []
      )
    );


    await assert.rejects(
      () =>
        service.reviewTaskProposal(
          createReviewContext(),
          projectId,
          proposalId,
          "confirm"
        ),

      TeamAgentPermissionDeniedError
    );


    assert.deepEqual(
      authorisationService.calls,
      [
        {
          personId:
            reviewerPersonId,

          projectId,
        },
      ]
    );
  }
);

/*
 * VS001-05
 *
 * MessageCreated.v1
 *   ->
 * deterministic Team Agent proposal
 */
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
      input.proposalPayload
        .source_message_id,
      messageId
    );

    assert.equal(
      input.proposalPayload
        .source_message_version_id,
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

    event.eventVersion =
      2;


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
        reviewerUserId,
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


/*
 * VS001-06
 *
 * Pending task proposal
 *   ->
 * authorised human review
 *   ->
 * confirm / edit / reject
 */
test(
  "authorised human can confirm a pending task proposal",
  async () => {
    const {
      service,
      repository,
    } = createReviewService();


    repository.reviewResult = {
      proposalId,

      projectId,

      status:
        "confirmed",

      reviewedPayload:
        createReviewedPayload(),

      reviewedBy:
        reviewerUserId,

      reviewedAt,
    };


    const result =
      await service.reviewTaskProposal(
        createReviewContext(),
        projectId,
        proposalId,
        "confirm"
      );


    assert.equal(
      repository.reviewCalls.length,
      1
    );


    const input =
      repository.reviewCalls[0];


    assert.equal(
      input.projectId,
      projectId
    );

    assert.equal(
      input.proposalId,
      proposalId
    );

    assert.equal(
      input.reviewerUserId,
      reviewerUserId
    );

    assert.equal(
      input.correlationId,
      reviewCorrelationId
    );

    assert.equal(
      input.action,
      "confirm"
    );

    assert.equal(
      input.reviewedPayload,
      null
    );

    assert.equal(
      result.status,
      "confirmed"
    );
  }
);


test(
  "authorised human can edit a pending task proposal",
  async () => {
    const {
      service,
      repository,
    } = createReviewService();

    const payload =
      createReviewedPayload();


    repository.reviewResult = {
      proposalId,

      projectId,

      status:
        "edited",

      reviewedPayload: {
        ...payload,

        title:
          payload.title.trim(),
      },

      reviewedBy:
        reviewerUserId,

      reviewedAt,
    };


    const result =
      await service.reviewTaskProposal(
        createReviewContext(),
        projectId,
        proposalId,
        "edit",
        payload
      );


    assert.equal(
      repository.reviewCalls.length,
      1
    );


    const input =
      repository.reviewCalls[0];


    assert.equal(
      input.action,
      "edit"
    );

    assert.equal(
      input.reviewerUserId,
      reviewerUserId
    );

    assert.equal(
      input.correlationId,
      reviewCorrelationId
    );

    assert.equal(
      input.reviewedPayload?.title,
      "Finalise revised syllabus"
    );

    assert.equal(
      input.reviewedPayload
        ?.source_message_id,
      messageId
    );

    assert.equal(
      input.reviewedPayload
        ?.source_message_version_id,
      messageVersionId
    );

    assert.equal(
      result.status,
      "edited"
    );
  }
);


test(
  "authorised human can reject a pending task proposal",
  async () => {
    const {
      service,
      repository,
    } = createReviewService();


    repository.reviewResult = {
      proposalId,

      projectId,

      status:
        "rejected",

      reviewedPayload:
        null,

      reviewedBy:
        reviewerUserId,

      reviewedAt,
    };


    const result =
      await service.reviewTaskProposal(
        createReviewContext(),
        projectId,
        proposalId,
        "reject"
      );


    assert.equal(
      repository.reviewCalls.length,
      1
    );

    assert.equal(
      repository.reviewCalls[0]
        .action,
      "reject"
    );

    assert.equal(
      repository.reviewCalls[0]
        .reviewedPayload,
      null
    );

    assert.equal(
      result.status,
      "rejected"
    );
  }
);


test(
  "human without agent.approve cannot review a task proposal",
  async () => {
    const {
      service,
      repository,
    } = createReviewService(
      createAuthorisation(
        [
          "message.create",
        ]
      )
    );


    await assert.rejects(
      () =>
        service.reviewTaskProposal(
          createReviewContext(),
          projectId,
          proposalId,
          "confirm"
        ),
      TeamAgentPermissionDeniedError
    );


    assert.equal(
      repository.reviewCalls.length,
      0
    );
  }
);


test(
  "non-member cannot review a task proposal",
  async () => {
    const {
      service,
      repository,
    } = createReviewService(
      null
    );


    await assert.rejects(
      () =>
        service.reviewTaskProposal(
          createReviewContext(),
          projectId,
          proposalId,
          "confirm"
        ),
      TeamAgentProjectNotFoundError
    );


    assert.equal(
      repository.reviewCalls.length,
      0
    );
  }
);


test(
  "edit requires reviewed proposal values",
  async () => {
    const {
      service,
      repository,
    } = createReviewService();


    await assert.rejects(
      () =>
        service.reviewTaskProposal(
          createReviewContext(),
          projectId,
          proposalId,
          "edit",
          null
        ),
      TeamAgentValidationError
    );


    assert.equal(
      repository.reviewCalls.length,
      0
    );
  }
);


test(
  "edit requires a non-empty task title",
  async () => {
    const {
      service,
      repository,
    } = createReviewService();

    const payload =
      createReviewedPayload();

    payload.title =
      "   ";


    await assert.rejects(
      () =>
        service.reviewTaskProposal(
          createReviewContext(),
          projectId,
          proposalId,
          "edit",
          payload
        ),
      TeamAgentValidationError
    );


    assert.equal(
      repository.reviewCalls.length,
      0
    );
  }
);


test(
  "confirm does not accept edited proposal values",
  async () => {
    const {
      service,
      repository,
    } = createReviewService();


    await assert.rejects(
      () =>
        service.reviewTaskProposal(
          createReviewContext(),
          projectId,
          proposalId,
          "confirm",
          createReviewedPayload()
        ),
      TeamAgentValidationError
    );


    assert.equal(
      repository.reviewCalls.length,
      0
    );
  }
);


test(
  "reject does not accept edited proposal values",
  async () => {
    const {
      service,
      repository,
    } = createReviewService();


    await assert.rejects(
      () =>
        service.reviewTaskProposal(
          createReviewContext(),
          projectId,
          proposalId,
          "reject",
          createReviewedPayload()
        ),
      TeamAgentValidationError
    );


    assert.equal(
      repository.reviewCalls.length,
      0
    );
  }
);

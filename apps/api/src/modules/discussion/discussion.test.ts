import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  RequestContext,
} from "../../bootstrap/request-context";

import type {
  EffectiveProjectAuthorisation,
} from "../project-membership/project-authorisation.types";

import type {
  DiscussionRepository,
} from "./discussion.repository";

import type {
  CreateDiscussionMessageInput,
  DiscussionMessage,
  DiscussionMessageVersion,
} from "./discussion.types";

import {
  DiscussionPermissionDeniedError,
  DiscussionProjectNotFoundError,
  DiscussionValidationError,
} from "./discussion.errors";

import {
  DiscussionService,
} from "./discussion.service";

import type {
  DiscussionAuthorisationService,
} from "./discussion.service";


const userId =
  "11111111-1111-4111-8111-111111111111";

const personId =
  "aaaaaaaa-1111-4111-8111-111111111111";

const projectId =
  "44444444-4444-4444-8444-444444444444";

const membershipId =
  "66666666-6666-4666-8666-666666666666";

const parentMessageId =
  "55555555-5555-4555-8555-555555555555";

const evaluatedAt =
  "2026-08-27T06:00:00.000Z";


const context: RequestContext = {
  actorUserId:
    userId,

  actorPersonId:
    personId,

  correlationId:
    "22222222-2222-4222-8222-222222222222",

  requestId:
    "33333333-3333-4333-8333-333333333333",

  source:
    "web",

  identityProvider:
    "local",
};


function authorisation(
  overrides:
    Partial<EffectiveProjectAuthorisation> = {}
): EffectiveProjectAuthorisation {
  return {
    personId,
    projectId,

    membershipIds:
      [membershipId],

    roles:
      ["PROJECT_MEMBER"],

    permissions: [
      "project.view",
      "message.view",
      "message.create",
    ],

    evaluatedAt,

    ...overrides,
  };
}


class FakeDiscussionAuthorisationService
  implements DiscussionAuthorisationService
{
  public readonly calls:
    Array<{
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
  public calls:
    CreateDiscussionMessageInput[] = [];

  public versions:
    DiscussionMessageVersion[] = [];


  async createMessage(
    input: CreateDiscussionMessageInput
  ): Promise<DiscussionMessage> {
    this.calls.push(input);

    return {
      id:
        "88888888-8888-4888-8888-888888888888",

      projectId:
        input.projectId,

      authorUserId:
        input.authorUserId,

      authorType:
        "human",

      threadParentId:
        input.threadParentId,

      currentVersion:
        1,

      content:
        input.content,

      createdAt:
        "2026-08-14T00:00:00.000Z",

      editedAt:
        null,
    };
  }


  async listProjectMessages(): Promise<DiscussionMessage[]> {
    return [];
  }


  async getMessageVersion(
    requestedProjectId: string,
    messageId: string,
    versionNumber: number
  ): Promise<DiscussionMessageVersion | null> {
    return (
      this.versions.find(
        (version) =>
          version.projectId ===
            requestedProjectId &&
          version.messageId ===
            messageId &&
          version.versionNumber ===
            versionNumber
      ) ?? null
    );
  }
}


function createService(
  result:
    EffectiveProjectAuthorisation = authorisation()
): {
  service: DiscussionService;
  repository: FakeDiscussionRepository;
  authorisationService:
    FakeDiscussionAuthorisationService;
} {
  const authorisationService =
    new FakeDiscussionAuthorisationService(
      result
    );

  const repository =
    new FakeDiscussionRepository();

  const service =
    new DiscussionService(
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
  "postMessage creates a message with trimmed content",
  async () => {
    const {
      service,
      repository,
    } = createService();

    const result =
      await service.postMessage(
        context,
        projectId,
        "  Hello Cadence  ",
        parentMessageId
      );

    assert.equal(
      result.content,
      "Hello Cadence"
    );

    assert.equal(
      repository.calls.length,
      1
    );

    assert.equal(
      repository.calls[0].content,
      "Hello Cadence"
    );

    assert.equal(
      repository.calls[0].threadParentId,
      parentMessageId
    );
  }
);


test(
  "postMessage uses Person for authority and User for message attribution",
  async () => {
    const {
      service,
      repository,
      authorisationService,
    } = createService();

    await service.postMessage(
      context,
      projectId,
      "Trace this message"
    );

    assert.deepEqual(
      authorisationService.calls,
      [
        {
          personId,
          projectId,
        },
      ]
    );

    assert.equal(
      repository.calls.length,
      1
    );

    const input =
      repository.calls[0];

    assert.equal(
      input.projectId,
      projectId
    );

    assert.equal(
      input.authorUserId,
      userId
    );

    assert.equal(
      input.correlationId,
      context.correlationId
    );

    assert.equal(
      input.causationId,
      null
    );
  }
);


test(
  "postMessage rejects whitespace-only content",
  async () => {
    const {
      service,
      repository,
      authorisationService,
    } = createService();

    await assert.rejects(
      () =>
        service.postMessage(
          context,
          projectId,
          "   "
        ),
      DiscussionValidationError
    );

    assert.equal(
      repository.calls.length,
      0
    );

    assert.deepEqual(
      authorisationService.calls,
      []
    );
  }
);


test(
  "postMessage rejects content longer than 20000 characters",
  async () => {
    const {
      service,
      repository,
      authorisationService,
    } = createService();

    await assert.rejects(
      () =>
        service.postMessage(
          context,
          projectId,
          "x".repeat(20001)
        ),
      DiscussionValidationError
    );

    assert.equal(
      repository.calls.length,
      0
    );

    assert.deepEqual(
      authorisationService.calls,
      []
    );
  }
);


test(
  "postMessage returns project not found when effective membership does not exist",
  async () => {
    const {
      service,
      repository,
    } = createService(
      authorisation({
        membershipIds:
          [],

        roles:
          [],

        permissions:
          [],
      })
    );

    await assert.rejects(
      () =>
        service.postMessage(
          context,
          projectId,
          "Hello"
        ),
      DiscussionProjectNotFoundError
    );

    assert.equal(
      repository.calls.length,
      0
    );
  }
);


test(
  "postMessage denies an effective member without message.create",
  async () => {
    const {
      service,
      repository,
    } = createService(
      authorisation({
        roles:
          ["PROJECT_OBSERVER"],

        permissions: [
          "project.view",
          "message.view",
        ],
      })
    );

    await assert.rejects(
      () =>
        service.postMessage(
          context,
          projectId,
          "Hello"
        ),
      DiscussionPermissionDeniedError
    );

    assert.equal(
      repository.calls.length,
      0
    );
  }
);


test(
  "getMessageVersion returns the exact immutable message version",
  async () => {
    const {
      service,
      repository,
    } = createService();

    const messageId =
      "99999999-9999-4999-8999-999999999999";

    repository.versions.push({
      id:
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",

      messageId,

      projectId,

      versionNumber:
        1,

      content:
        "Daniel, please finalise the syllabus by Friday.",

      editorUserId:
        userId,

      editorType:
        "human",

      changeReason:
        null,

      createdAt:
        "2026-08-15T00:00:00.000Z",
    });

    const result =
      await service.getMessageVersion(
        projectId,
        messageId,
        1
      );

    assert.ok(result);

    assert.equal(
      result.messageId,
      messageId
    );

    assert.equal(
      result.projectId,
      projectId
    );

    assert.equal(
      result.versionNumber,
      1
    );

    assert.equal(
      result.content,
      "Daniel, please finalise the syllabus by Friday."
    );

    assert.equal(
      result.editorUserId,
      userId
    );

    assert.equal(
      result.editorType,
      "human"
    );
  }
);


test(
  "getMessageVersion returns null when the exact version does not exist",
  async () => {
    const {
      service,
    } = createService();

    const result =
      await service.getMessageVersion(
        projectId,
        "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        1
      );

    assert.equal(
      result,
      null
    );
  }
);

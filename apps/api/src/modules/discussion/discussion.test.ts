import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  RequestContext,
} from "../../bootstrap/request-context";

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


const context: RequestContext = {
  actorUserId:
    "11111111-1111-4111-8111-111111111111",

  actorPersonId:
    "11111111-1111-4111-8111-111111111111",

  correlationId:
    "22222222-2222-4222-8222-222222222222",

  requestId:
    "33333333-3333-4333-8333-333333333333",

  source: "web",

  identityProvider: "local",
};


const projectId =
  "44444444-4444-4444-8444-444444444444";

const parentMessageId =
  "55555555-5555-4555-8555-555555555555";


function createProjectAccess(
  permissions: string[]
): ProjectAccess {
  return {
    membershipId:
      "66666666-6666-4666-8666-666666666666",

    projectId,

    userId:
      context.actorUserId,

    roleId:
      "77777777-7777-4777-8777-777777777777",

    roleCode:
      "CONTRIBUTOR",

    permissions,
  };
}


class FakeRbacRepository
  implements RbacRepository
{
  constructor(
    private readonly access:
      ProjectAccess | null
  ) {}

  async getProjectAccess(
    _userId: string,
    _projectId: string
  ): Promise<ProjectAccess | null> {
    return this.access;
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

      currentVersion: 1,

      content:
        input.content,

      createdAt:
        "2026-08-14T00:00:00.000Z",

      editedAt: null,
    };
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
  access:
    ProjectAccess | null
): {
  service: DiscussionService;
  repository: FakeDiscussionRepository;
} {
  const rbacRepository =
    new FakeRbacRepository(
      access
    );

  const rbacService =
    new RbacService(
      rbacRepository
    );

  const repository =
    new FakeDiscussionRepository();

  const service =
    new DiscussionService(
      rbacService,
      repository
    );

  return {
    service,
    repository,
  };
}


test(
  "postMessage creates a message with trimmed content",
  async () => {
    const {
      service,
      repository,
    } = createService(
      createProjectAccess([
        "message.create",
      ])
    );

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
  "postMessage preserves actor and correlation metadata",
  async () => {
    const {
      service,
      repository,
    } = createService(
      createProjectAccess([
        "message.create",
      ])
    );

    await service.postMessage(
      context,
      projectId,
      "Trace this message"
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
      context.actorUserId
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
    } = createService(
      createProjectAccess([
        "message.create",
      ])
    );

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
  }
);


test(
  "postMessage rejects content longer than 20000 characters",
  async () => {
    const {
      service,
      repository,
    } = createService(
      createProjectAccess([
        "message.create",
      ])
    );

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
  }
);


test(
  "postMessage returns project not found when membership does not exist",
  async () => {
    const {
      service,
      repository,
    } = createService(
      null
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
  "postMessage denies an active member without message.create",
  async () => {
    const {
      service,
      repository,
    } = createService(
      createProjectAccess([
        "project.view",
        "message.view",
      ])
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
    } = createService(
      createProjectAccess([
        "message.view",
      ])
    );

    const messageId =
      "99999999-9999-4999-8999-999999999999";

    repository.versions.push({
      id:
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",

      messageId,

      projectId,

      versionNumber: 1,

      content:
        "Daniel, please finalise the syllabus by Friday.",

      editorUserId:
        context.actorUserId,

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
      context.actorUserId
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
    } = createService(
      createProjectAccess([
        "message.view",
      ])
    );

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

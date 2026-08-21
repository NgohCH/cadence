import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  RequestContext,
} from "../../bootstrap/request-context";

import type {
  RbacRepository,
} from "../rbac/rbac.repository";

import {
  RbacService,
} from "../rbac/rbac.service";

import type {
  ProjectAccess,
} from "../rbac/rbac.types";

import {
  TasksPermissionDeniedError,
  TasksProjectNotFoundError,
  TasksValidationError,
} from "./tasks.errors";

import type {
  TasksRepository,
} from "./tasks.repository";

import {
  TasksService,
} from "./tasks.service";

import type {
  CreateTaskInput,
  PersistTaskInput,
  Task,
  TaskCreationResult,
  TaskPriority,
} from "./tasks.types";


const actorUserId =
  "11111111-1111-4111-8111-111111111111";

const projectId =
  "22222222-2222-4222-8222-222222222222";

const proposalId =
  "33333333-3333-4333-8333-333333333333";

const taskId =
  "44444444-4444-4444-8444-444444444444";

const assigneeUserId =
  "55555555-5555-4555-8555-555555555555";

const correlationId =
  "66666666-6666-4666-8666-666666666666";

const causationId =
  "77777777-7777-4777-8777-777777777777";

const membershipId =
  "88888888-8888-4888-8888-888888888888";

const roleId =
  "99999999-9999-4999-8999-999999999999";


const context:
  RequestContext = {
    actorUserId,
    actorPersonId:
      actorUserId,

    projectId,

    correlationId,

    requestId:
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",

    source:
      "api",

    identityProvider:
      "test",
  };


class FakeRbacRepository
  implements RbacRepository
{
  constructor(
    public access:
      ProjectAccess | null
  ) {}


  async getProjectAccess(
    _userId: string,
    _projectId: string
  ): Promise<ProjectAccess | null> {
    return this.access;
  }
}


class FakeTasksRepository
  implements TasksRepository
{
  public calls:
    PersistTaskInput[] = [];


  public listMyTasksCalls:
    string[] = [];


  public listMyTasksResult:
    Task[] = [];


  public result:
    TaskCreationResult = {
      task: {
        id:
          taskId,

        projectId,

        title:
          "Finalise syllabus",

        description:
          "Complete the revised syllabus.",

        assignedTo:
          null,

        status:
          "open",

        priority:
          "normal",

        dueDate:
          null,

        completedAt:
          null,

        createdBy:
          actorUserId,

        createdByType:
          "human",

        createdAt:
          "2026-08-16T12:00:00.000Z",

        updatedAt:
          "2026-08-16T12:00:00.000Z",
      },

      created:
        true,
    };


  async createTask(
    input: PersistTaskInput
  ): Promise<TaskCreationResult> {
    this.calls.push(
      input
    );

    return this.result;
  }


  async listMyTasks(
    userId: string
  ): Promise<Task[]> {
    this.listMyTasksCalls.push(
      userId
    );

    return this.listMyTasksResult;
  }
}


function createProjectAccess(
  permissions:
    string[]
): ProjectAccess {
  return {
    membershipId,

    projectId,

    userId:
      actorUserId,

    roleId,

    roleCode:
      "TEST_ROLE",

    permissions,
  };
}


function createInput():
CreateTaskInput {
  return {
    projectId,

    title:
      "  Finalise syllabus  ",

    description:
      "  Complete the revised syllabus.  ",

    assignedTo:
      null,

    dueDate:
      null,

    source: {
      sourceType:
        "ai_proposal",

      sourceId:
        proposalId,
    },

    causationId,
  };
}


function createService(
  access:
    ProjectAccess | null
): {
  service:
    TasksService;

  repository:
    FakeTasksRepository;
} {
  const rbacRepository =
    new FakeRbacRepository(
      access
    );

  const repository =
    new FakeTasksRepository();


  return {
    service:
      new TasksService(
        new RbacService(
          rbacRepository
        ),

        repository
      ),

    repository,
  };
}


/*
 * VS001-07A
 *
 * Authoritative Task creation
 *   ->
 * TasksService
 *   ->
 * permission enforcement
 *   ->
 * Tasks-owned persistence boundary
 */
test(
  "authorised user creates an authoritative task",
  async () => {
    const {
      service,
      repository,
    } = createService(
      createProjectAccess([
        "task.create",
      ])
    );


    const result =
      await service.createTask(
        context,
        createInput()
      );


    assert.equal(
      result.created,
      true
    );

    assert.equal(
      repository.calls.length,
      1
    );


    const persisted =
      repository.calls[0];


    assert.equal(
      persisted.projectId,
      projectId
    );

    assert.equal(
      persisted.title,
      "Finalise syllabus"
    );

    assert.equal(
      persisted.description,
      "Complete the revised syllabus."
    );

    assert.equal(
      persisted.priority,
      "normal"
    );

    assert.equal(
      persisted.createdByUserId,
      actorUserId
    );

    assert.equal(
      persisted.correlationId,
      correlationId
    );

    assert.equal(
      persisted.causationId,
      causationId
    );

    assert.deepEqual(
      persisted.source,
      {
        sourceType:
          "ai_proposal",

        sourceId:
          proposalId,
      }
    );
  }
);


test(
  "authorised user can create an unassigned task without task.assign",
  async () => {
    const {
      service,
      repository,
    } = createService(
      createProjectAccess([
        "task.create",
      ])
    );


    const input =
      createInput();

    input.assignedTo =
      null;


    await service.createTask(
      context,
      input
    );


    assert.equal(
      repository.calls.length,
      1
    );

    assert.equal(
      repository.calls[0].assignedTo,
      null
    );
  }
);


test(
  "task assignment requires task.assign",
  async () => {
    const {
      service,
      repository,
    } = createService(
      createProjectAccess([
        "task.create",
      ])
    );


    const input =
      createInput();

    input.assignedTo =
      assigneeUserId;


    await assert.rejects(
      () =>
        service.createTask(
          context,
          input
        ),

      TasksPermissionDeniedError
    );


    assert.equal(
      repository.calls.length,
      0
    );
  }
);


test(
  "user with task.create and task.assign can create an assigned task",
  async () => {
    const {
      service,
      repository,
    } = createService(
      createProjectAccess([
        "task.create",
        "task.assign",
      ])
    );


    const input =
      createInput();

    input.assignedTo =
      assigneeUserId;


    await service.createTask(
      context,
      input
    );


    assert.equal(
      repository.calls.length,
      1
    );

    assert.equal(
      repository.calls[0].assignedTo,
      assigneeUserId
    );
  }
);


test(
  "task creation requires active project membership",
  async () => {
    const {
      service,
      repository,
    } = createService(
      null
    );


    await assert.rejects(
      () =>
        service.createTask(
          context,
          createInput()
        ),

      TasksProjectNotFoundError
    );


    assert.equal(
      repository.calls.length,
      0
    );
  }
);


test(
  "active project member without task.create cannot create a task",
  async () => {
    const {
      service,
      repository,
    } = createService(
      createProjectAccess([
        "project.view",
      ])
    );


    await assert.rejects(
      () =>
        service.createTask(
          context,
          createInput()
        ),

      TasksPermissionDeniedError
    );


    assert.equal(
      repository.calls.length,
      0
    );
  }
);


test(
  "task title is required",
  async () => {
    const {
      service,
      repository,
    } = createService(
      createProjectAccess([
        "task.create",
      ])
    );


    const input =
      createInput();

    input.title =
      "   ";


    await assert.rejects(
      () =>
        service.createTask(
          context,
          input
        ),

      TasksValidationError
    );


    assert.equal(
      repository.calls.length,
      0
    );
  }
);


test(
  "empty description is normalized to null",
  async () => {
    const {
      service,
      repository,
    } = createService(
      createProjectAccess([
        "task.create",
      ])
    );


    const input =
      createInput();

    input.description =
      "   ";


    await service.createTask(
      context,
      input
    );


    assert.equal(
      repository.calls[0].description,
      null
    );
  }
);


test(
  "explicit task priority is preserved",
  async () => {
    const {
      service,
      repository,
    } = createService(
      createProjectAccess([
        "task.create",
      ])
    );


    const input =
      createInput();

    input.priority =
      "high";


    await service.createTask(
      context,
      input
    );


    assert.equal(
      repository.calls[0].priority,
      "high"
    );
  }
);


test(
  "unsupported task priority is rejected at runtime",
  async () => {
    const {
      service,
      repository,
    } = createService(
      createProjectAccess([
        "task.create",
      ])
    );


    const input =
      createInput();

    input.priority =
      "urgent" as
        TaskPriority;


    await assert.rejects(
      () =>
        service.createTask(
          context,
          input
        ),

      TasksValidationError
    );


    assert.equal(
      repository.calls.length,
      0
    );
  }
);


test(
  "valid due date is normalized to ISO UTC",
  async () => {
    const {
      service,
      repository,
    } = createService(
      createProjectAccess([
        "task.create",
      ])
    );


    const input =
      createInput();

    input.dueDate =
      "2026-08-20T09:30:00+08:00";


    await service.createTask(
      context,
      input
    );


    assert.equal(
      repository.calls[0].dueDate,
      "2026-08-20T01:30:00.000Z"
    );
  }
);


test(
  "invalid due date is rejected",
  async () => {
    const {
      service,
      repository,
    } = createService(
      createProjectAccess([
        "task.create",
      ])
    );


    const input =
      createInput();

    input.dueDate =
      "not-a-date";


    await assert.rejects(
      () =>
        service.createTask(
          context,
          input
        ),

      TasksValidationError
    );


    assert.equal(
      repository.calls.length,
      0
    );
  }
);


/*
 * VS001-08A
 *
 * Authenticated user
 *   ->
 * TasksService.listMyTasks()
 *   ->
 * authenticated actor identity
 *   ->
 * Tasks-owned read boundary
 */
test(
  "my tasks uses the authenticated actor identity",
  async () => {
    const {
      service,
      repository,
    } = createService(
      createProjectAccess([
        "task.view",
      ])
    );


    repository.listMyTasksResult = [
      {
        id:
          taskId,

        projectId,

        title:
          "Finalise syllabus",

        description:
          "Complete the revised syllabus.",

        assignedTo:
          actorUserId,

        status:
          "open",

        priority:
          "normal",

        dueDate:
          null,

        completedAt:
          null,

        createdBy:
          actorUserId,

        createdByType:
          "human",

        createdAt:
          "2026-08-16T12:00:00.000Z",

        updatedAt:
          "2026-08-16T12:00:00.000Z",
      },
    ];


    const result =
      await service.listMyTasks(
        context
      );


    assert.deepEqual(
      repository.listMyTasksCalls,
      [
        actorUserId,
      ]
    );

    assert.equal(
      result.length,
      1
    );

    assert.equal(
      result[0].id,
      taskId
    );

    assert.equal(
      result[0].assignedTo,
      actorUserId
    );
  }
);


test(
  "my tasks returns an empty list when repository finds no visible tasks",
  async () => {
    const {
      service,
      repository,
    } = createService(
      createProjectAccess([
        "task.view",
      ])
    );


    repository.listMyTasksResult =
      [];


    const result =
      await service.listMyTasks(
        context
      );


    assert.deepEqual(
      repository.listMyTasksCalls,
      [
        actorUserId,
      ]
    );

    assert.deepEqual(
      result,
      []
    );
  }
);

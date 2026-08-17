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

import type {
  CreateTaskInput,
  TaskCreationResult,
} from "../tasks/tasks.types";

import {
  TeamAgentProjectNotFoundError,
  TeamAgentProposalNotFoundError,
  TeamAgentValidationError,
} from "./team-agent.errors";

import type {
  ReviewedTaskProposalForMaterialization,
  TeamAgentTaskMaterializationRepository,
} from "./team-agent-materialization.repository";

import {
  TeamAgentTaskMaterializationService,
} from "./team-agent-task-materialization.service";


const actorUserId =
  "11111111-1111-4111-8111-111111111111";

const projectId =
  "22222222-2222-4222-8222-222222222222";

const proposalId =
  "33333333-3333-4333-8333-333333333333";

const reviewEventId =
  "44444444-4444-4444-8444-444444444444";

const reviewCorrelationId =
  "55555555-5555-4555-8555-555555555555";

const taskId =
  "66666666-6666-4666-8666-666666666666";

const assigneeUserId =
  "77777777-7777-4777-8777-777777777777";

const membershipId =
  "88888888-8888-4888-8888-888888888888";

const roleId =
  "99999999-9999-4999-8999-999999999999";


const context:
  RequestContext = {
    actorUserId,

    projectId,

    correlationId:
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",

    requestId:
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",

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


class FakeMaterializationRepository
  implements TeamAgentTaskMaterializationRepository
{
  public proposal:
    ReviewedTaskProposalForMaterialization | null;

  public recordCalls:
    Array<{
      projectId: string;
      proposalId: string;
      taskId: string;
    }> = [];


  constructor(
    proposal:
      ReviewedTaskProposalForMaterialization | null
  ) {
    this.proposal =
      proposal;
  }


  async getReviewedTaskProposal(
    _projectId: string,
    _proposalId: string
  ): Promise<ReviewedTaskProposalForMaterialization | null> {
    return this.proposal;
  }


  async recordTaskResult(
    projectId: string,
    proposalId: string,
    createdTaskId: string
  ): Promise<void> {
    this.recordCalls.push({
      projectId,
      proposalId,
      taskId:
        createdTaskId,
    });
  }
}


class FakeTasksService {
  public calls:
    Array<{
      context:
        RequestContext;

      input:
        CreateTaskInput;
    }> = [];


  public result:
    TaskCreationResult = {
      task: {
        id:
          taskId,

        projectId,

        title:
          "Reviewed task",

        description:
          "Reviewed description",

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
          "2026-08-16T13:00:00.000Z",

        updatedAt:
          "2026-08-16T13:00:00.000Z",
      },

      created:
        true,
    };


  async createTask(
    callContext:
      RequestContext,

    input:
      CreateTaskInput
  ): Promise<TaskCreationResult> {
    this.calls.push({
      context:
        callContext,

      input,
    });

    return this.result;
  }
}


function createProjectAccess():
ProjectAccess {
  return {
    membershipId,

    projectId,

    userId:
      actorUserId,

    roleId,

    roleCode:
      "PROJECT_LEAD",

    permissions: [
      "project.view",
      "task.create",
      "task.assign",
    ],
  };
}


function createProposal(
  status:
    ReviewedTaskProposalForMaterialization["status"] =
      "confirmed"
): ReviewedTaskProposalForMaterialization {
  return {
    proposalId,

    projectId,

    status,

    reviewedPayload: {
      title:
        "Reviewed task",

      description:
        "Reviewed description",

      assigned_to:
        null,

      due_date:
        null,

      source_message_id:
        "cccccccc-cccc-4ccc-8ccc-cccccccccccc",

      source_message_version_id:
        "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    },

    reviewedBy:
      actorUserId,

    reviewedAt:
      "2026-08-16T12:30:00.000Z",

    reviewEventId,

    reviewCorrelationId,

    resultEntityType:
      null,

    resultEntityId:
      null,
  };
}


function createService(
  proposal:
    ReviewedTaskProposalForMaterialization | null,

  access:
    ProjectAccess | null =
      createProjectAccess()
): {
  service:
    TeamAgentTaskMaterializationService;

  repository:
    FakeMaterializationRepository;

  tasksService:
    FakeTasksService;
} {
  const repository =
    new FakeMaterializationRepository(
      proposal
    );

  const tasksService =
    new FakeTasksService();


  return {
    service:
      new TeamAgentTaskMaterializationService(
        new RbacService(
          new FakeRbacRepository(
            access
          )
        ),

        repository,

        tasksService
      ),

    repository,

    tasksService,
  };
}


test(
  "confirmed proposal uses reviewed payload and review provenance",
  async () => {
    const {
      service,
      repository,
      tasksService,
    } = createService(
      createProposal(
        "confirmed"
      )
    );


    const result =
      await service
        .createTaskFromReviewedProposal(
          context,
          projectId,
          proposalId
        );


    assert.equal(
      result.created,
      true
    );

    assert.equal(
      tasksService.calls.length,
      1
    );


    const call =
      tasksService.calls[0];


    assert.equal(
      call.input.projectId,
      projectId
    );

    assert.equal(
      call.input.title,
      "Reviewed task"
    );

    assert.equal(
      call.input.description,
      "Reviewed description"
    );

    assert.equal(
      call.input.assignedTo,
      null
    );

    assert.equal(
      call.input.dueDate,
      null
    );

    assert.equal(
      call.input.priority,
      "normal"
    );

    assert.deepEqual(
      call.input.source,
      {
        sourceType:
          "ai_proposal",

        sourceId:
          proposalId,
      }
    );

    assert.equal(
      call.input.correlationId,
      reviewCorrelationId
    );

    assert.equal(
      call.input.causationId,
      reviewEventId
    );


    assert.deepEqual(
      repository.recordCalls,
      [
        {
          projectId,

          proposalId,

          taskId,
        },
      ]
    );
  }
);


test(
  "edited proposal uses the final human-reviewed values",
  async () => {
    const proposal =
      createProposal(
        "edited"
      );

    proposal.reviewedPayload = {
      ...proposal.reviewedPayload!,

      title:
        "Human edited title",

      description:
        "Human edited description",

      assigned_to:
        assigneeUserId,

      due_date:
        "2026-08-20T01:30:00.000Z",
    };


    const {
      service,
      tasksService,
    } = createService(
      proposal
    );


    await service
      .createTaskFromReviewedProposal(
        context,
        projectId,
        proposalId
      );


    const input =
      tasksService.calls[0].input;


    assert.equal(
      input.title,
      "Human edited title"
    );

    assert.equal(
      input.description,
      "Human edited description"
    );

    assert.equal(
      input.assignedTo,
      assigneeUserId
    );

    assert.equal(
      input.dueDate,
      "2026-08-20T01:30:00.000Z"
    );
  }
);


for (
  const status of [
    "pending",
    "rejected",
    "expired",
  ] as const
) {
  test(
    `${status} proposal cannot create an authoritative task`,
    async () => {
      const {
        service,
        repository,
        tasksService,
      } = createService(
        createProposal(
          status
        )
      );


      await assert.rejects(
        () =>
          service
            .createTaskFromReviewedProposal(
              context,
              projectId,
              proposalId
            ),

        TeamAgentValidationError
      );


      assert.equal(
        tasksService.calls.length,
        0
      );

      assert.equal(
        repository.recordCalls.length,
        0
      );
    }
  );
}


test(
  "proposal requires reviewed payload before materialization",
  async () => {
    const proposal =
      createProposal();

    proposal.reviewedPayload =
      null;


    const {
      service,
      repository,
      tasksService,
    } = createService(
      proposal
    );


    await assert.rejects(
      () =>
        service
          .createTaskFromReviewedProposal(
            context,
            projectId,
            proposalId
          ),

      TeamAgentValidationError
    );


    assert.equal(
      tasksService.calls.length,
      0
    );

    assert.equal(
      repository.recordCalls.length,
      0
    );
  }
);


test(
  "proposal requires review event ID before materialization",
  async () => {
    const proposal =
      createProposal();

    proposal.reviewEventId =
      null;


    const {
      service,
      tasksService,
    } = createService(
      proposal
    );


    await assert.rejects(
      () =>
        service
          .createTaskFromReviewedProposal(
            context,
            projectId,
            proposalId
          ),

      TeamAgentValidationError
    );


    assert.equal(
      tasksService.calls.length,
      0
    );
  }
);


test(
  "proposal requires review correlation ID before materialization",
  async () => {
    const proposal =
      createProposal();

    proposal.reviewCorrelationId =
      null;


    const {
      service,
      tasksService,
    } = createService(
      proposal
    );


    await assert.rejects(
      () =>
        service
          .createTaskFromReviewedProposal(
            context,
            projectId,
            proposalId
          ),

      TeamAgentValidationError
    );


    assert.equal(
      tasksService.calls.length,
      0
    );
  }
);


test(
  "proposal not found does not reach TasksService",
  async () => {
    const {
      service,
      repository,
      tasksService,
    } = createService(
      null
    );


    await assert.rejects(
      () =>
        service
          .createTaskFromReviewedProposal(
            context,
            projectId,
            proposalId
          ),

      TeamAgentProposalNotFoundError
    );


    assert.equal(
      tasksService.calls.length,
      0
    );

    assert.equal(
      repository.recordCalls.length,
      0
    );
  }
);


test(
  "non-member cannot inspect or materialize the proposal",
  async () => {
    const {
      service,
      repository,
      tasksService,
    } = createService(
      createProposal(),
      null
    );


    await assert.rejects(
      () =>
        service
          .createTaskFromReviewedProposal(
            context,
            projectId,
            proposalId
          ),

      TeamAgentProjectNotFoundError
    );


    assert.equal(
      tasksService.calls.length,
      0
    );

    assert.equal(
      repository.recordCalls.length,
      0
    );
  }
);


test(
  "existing proposal result still delegates retry to TasksService",
  async () => {
    const proposal =
      createProposal();

    proposal.resultEntityType =
      "task";

    proposal.resultEntityId =
      taskId;


    const {
      service,
      repository,
      tasksService,
    } = createService(
      proposal
    );


    tasksService.result = {
      ...tasksService.result,

      created:
        false,
    };


    const result =
      await service
        .createTaskFromReviewedProposal(
          context,
          projectId,
          proposalId
        );


    /*
     * Team Agent must not return authoritative Task state from its
     * own result_entity_id. TasksService owns the retry decision.
     */
    assert.equal(
      tasksService.calls.length,
      1
    );

    assert.equal(
      result.task.id,
      taskId
    );

    assert.equal(
      result.created,
      false
    );


    assert.deepEqual(
      repository.recordCalls,
      [
        {
          projectId,

          proposalId,

          taskId,
        },
      ]
    );
  }
);

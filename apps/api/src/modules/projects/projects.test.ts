import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  RequestContext,
} from "../../bootstrap/request-context";

import type {
  EffectiveProjectAuthorisation,
} from "../project-membership/project-authorisation.types";

import {
  ProjectNotFoundError,
  ProjectPermissionDeniedError,
} from "./projects.errors";

import type {
  ProjectWorkspaceReadRepository,
} from "./projects.repository";

import {
  ProjectsService,
} from "./projects.service";

import type {
  ProjectsAuthorisationService,
} from "./projects.service";

import type {
  ProjectSummary,
} from "./projects.types";


const projectId =
  "11111111-1111-4111-8111-111111111111";

const userId =
  "22222222-2222-4222-8222-222222222222";

const personId =
  "33333333-3333-4333-8333-333333333333";

const membershipId =
  "44444444-4444-4444-8444-444444444444";

const evaluatedAt =
  "2026-08-27T06:00:00.000Z";


const context: RequestContext = {
  actorUserId:
    userId,

  actorPersonId:
    personId,

  correlationId:
    "55555555-5555-4555-8555-555555555555",

  requestId:
    "66666666-6666-4666-8666-666666666666",

  source:
    "api",

  identityProvider:
    "test",
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
      ["PROJECT_OBSERVER"],

    permissions:
      ["project.view"],

    evaluatedAt,

    ...overrides,
  };
}


const summary: ProjectSummary = {
  project: {
    id:
      projectId,

    name:
      "R02 Project",

    description:
      null,

    goal:
      null,

    lifecycleStatus:
      "active",

    healthStatus:
      "on_track",

    progressPercent:
      0,

    ownerUserId:
      userId,

    startDate:
      null,

    targetDate:
      null,

    createdAt:
      evaluatedAt,

    updatedAt:
      evaluatedAt,
  },

  myTasks: {
    pending:
      0,

    overdue:
      0,
  },

  blockers:
    0,

  nextMilestone:
    null,

  alerts:
    [],
};


class FakeProjectsAuthorisationService
  implements ProjectsAuthorisationService
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


class FakeProjectWorkspaceReadRepository
  implements ProjectWorkspaceReadRepository
{
  public readonly calls:
    Array<{
      projectId: string;
      userId: string;
    }> = [];


  constructor(
    private readonly result:
      ProjectSummary | null
  ) {}


  async getSummary(
    requestedProjectId: string,
    requestedUserId: string
  ): Promise<ProjectSummary | null> {
    this.calls.push({
      projectId:
        requestedProjectId,

      userId:
        requestedUserId,
    });

    return this.result;
  }
}


test(
  "project summary uses stable Person authority and retains User-oriented read-model identity",
  async () => {
    const authorisationService =
      new FakeProjectsAuthorisationService(
        authorisation()
      );

    const repository =
      new FakeProjectWorkspaceReadRepository(
        summary
      );

    const result =
      await new ProjectsService(
        authorisationService,
        repository
      ).getProjectSummary(
        context,
        projectId
      );

    assert.deepEqual(
      result,
      summary
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

    assert.deepEqual(
      repository.calls,
      [
        {
          projectId,
          userId,
        },
      ]
    );
  }
);


test(
  "actor without an effective project membership sees project as not found",
  async () => {
    const repository =
      new FakeProjectWorkspaceReadRepository(
        summary
      );

    const service =
      new ProjectsService(
        new FakeProjectsAuthorisationService(
          authorisation({
            membershipIds:
              [],

            roles:
              [],

            permissions:
              [],
          })
        ),

        repository
      );

    await assert.rejects(
      service.getProjectSummary(
        context,
        projectId
      ),
      ProjectNotFoundError
    );

    assert.deepEqual(
      repository.calls,
      []
    );
  }
);


test(
  "effective membership without project.view fails closed",
  async () => {
    const repository =
      new FakeProjectWorkspaceReadRepository(
        summary
      );

    const service =
      new ProjectsService(
        new FakeProjectsAuthorisationService(
          authorisation({
            roles:
              [],

            permissions:
              [],
          })
        ),

        repository
      );

    await assert.rejects(
      service.getProjectSummary(
        context,
        projectId
      ),
      ProjectPermissionDeniedError
    );

    assert.deepEqual(
      repository.calls,
      []
    );
  }
);


test(
  "authorized actor receives not found when the workspace read model has no project summary",
  async () => {
    const service =
      new ProjectsService(
        new FakeProjectsAuthorisationService(
          authorisation()
        ),

        new FakeProjectWorkspaceReadRepository(
          null
        )
      );

    await assert.rejects(
      service.getProjectSummary(
        context,
        projectId
      ),
      ProjectNotFoundError
    );
  }
);

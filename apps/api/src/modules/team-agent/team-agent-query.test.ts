import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  RequestContext,
} from "../../bootstrap/request-context";

import type {
  EffectiveProjectAuthorisation,
} from "../project-membership/project-authorisation.types";

import {
  TeamAgentPermissionDeniedError,
  TeamAgentProjectNotFoundError,
} from "./team-agent.errors";

import type {
  TeamAgentQueryRepository,
} from "./team-agent-query.repository";

import {
  TeamAgentQueryService,
} from "./team-agent-query.service";

import type {
  TeamAgentQueryAuthorisationService,
} from "./team-agent-query.service";

import type {
  PendingTaskProposal,
} from "./team-agent.types";


const projectId =
  "11111111-1111-4111-8111-111111111111";

const userId =
  "22222222-2222-4222-8222-222222222222";

const personId =
  "aaaaaaaa-2222-4222-8222-222222222222";

const membershipId =
  "33333333-3333-4333-8333-333333333333";

const requestId =
  "55555555-5555-4555-8555-555555555555";

const correlationId =
  "66666666-6666-4666-8666-666666666666";

const proposalId =
  "77777777-7777-4777-8777-777777777777";

const aiRunId =
  "88888888-8888-4888-8888-888888888888";

const sourceMessageId =
  "99999999-9999-4999-8999-999999999999";

const sourceMessageVersionId =
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";


class FakeTeamAgentQueryAuthorisationService
  implements TeamAgentQueryAuthorisationService
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


class FakeTeamAgentQueryRepository
  implements TeamAgentQueryRepository
{
  public calls:
    string[] = [];


  public proposals:
    PendingTaskProposal[] = [];


  async listPendingTaskProposals(
    requestedProjectId: string
  ): Promise<PendingTaskProposal[]> {
    this.calls.push(
      requestedProjectId
    );

    return this.proposals;
  }
}


function createContext():
RequestContext {
  return {
    actorUserId:
      userId,

    actorPersonId:
      personId,

    projectId,

    correlationId,

    requestId,

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
    personId,

    projectId,

    membershipIds: [
      membershipId,
    ],

    roles: [
      "PROJECT_MANAGER",
    ],

    permissions,

    evaluatedAt:
      "2026-08-27T09:30:00.000Z",

    ...overrides,
  };
}


function createProposal():
PendingTaskProposal {
  return {
    id:
      proposalId,

    projectId,

    aiRunId,

    status:
      "pending",

    payload: {
      title:
        "Prepare project briefing",

      description:
        "Prepare the project briefing by Friday.",

      assigned_to:
        null,

      due_date:
        null,

      source_message_id:
        sourceMessageId,

      source_message_version_id:
        sourceMessageVersionId,
    },

    confidence:
      null,

    reason:
      "Deterministic VS001 development proposal.",

    createdAt:
      "2026-08-18T08:00:00.000Z",
  };
}


function createService(
  authorisation:
    EffectiveProjectAuthorisation
): {
  service:
    TeamAgentQueryService;

  repository:
    FakeTeamAgentQueryRepository;

  authorisationService:
    FakeTeamAgentQueryAuthorisationService;
} {
  const authorisationService =
    new FakeTeamAgentQueryAuthorisationService(
      authorisation
    );

  const repository =
    new FakeTeamAgentQueryRepository();

  const service =
    new TeamAgentQueryService(
      authorisationService,
      repository
    );


  return {
    service,
    repository,
    authorisationService,
  };
}


/*
 * VS001-10F
 *
 * Pending Team Agent proposal
 *   ->
 * authorised human review queue
 */
test(
  "authorised reviewer can list pending task proposals",
  async () => {
    const {
      service,
      repository,
      authorisationService,
    } = createService(
      createAuthorisation()
    );


    repository.proposals = [
      createProposal(),
    ];


    const result =
      await service
        .listPendingTaskProposals(
          createContext(),
          projectId
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

    assert.equal(
      repository.calls[0],
      projectId
    );

    assert.equal(
      result.length,
      1
    );

    assert.equal(
      result[0].id,
      proposalId
    );

    assert.equal(
      result[0].status,
      "pending"
    );

    assert.equal(
      result[0].payload.title,
      "Prepare project briefing"
    );
  }
);


test(
  "non-member cannot list pending task proposals",
  async () => {
    const {
      service,
      repository,
    } = createService(
      createAuthorisation(
        [],
        {
          membershipIds:
            [],

          roles:
            [],
        }
      )
    );


    await assert.rejects(
      () =>
        service
          .listPendingTaskProposals(
            createContext(),
            projectId
          ),

      TeamAgentProjectNotFoundError
    );


    assert.equal(
      repository.calls.length,
      0
    );
  }
);


test(
  "project member without agent.approve cannot list pending task proposals",
  async () => {
    const {
      service,
      repository,
    } = createService(
      createAuthorisation(
        [
          "message.create",
          "project.view",
        ]
      )
    );


    await assert.rejects(
      () =>
        service
          .listPendingTaskProposals(
            createContext(),
            projectId
          ),

      TeamAgentPermissionDeniedError
    );


    assert.equal(
      repository.calls.length,
      0
    );
  }
);

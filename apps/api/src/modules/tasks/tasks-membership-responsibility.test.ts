import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  AssessMembershipResponsibilitiesInput,
  MembershipResponsibilityAssessment,
  TasksMembershipResponsibilityService,
} from "./tasks-membership-responsibility";

import {
  DefaultTasksMembershipResponsibilityService,
} from "./tasks-membership-responsibility";

import type {
  TasksMembershipResponsibilityRepository,
} from "./tasks-membership-responsibility";


class FakeTasksMembershipResponsibilityService
  implements TasksMembershipResponsibilityService
{
  public readonly calls:
    AssessMembershipResponsibilitiesInput[] = [];

  constructor(
    private readonly decision:
      MembershipResponsibilityAssessment
  ) {}


  async assessMembershipResponsibilities(
    input: AssessMembershipResponsibilitiesInput
  ): Promise<MembershipResponsibilityAssessment> {
    this.calls.push(input);

    return this.decision;
  }
}


class FakeTasksMembershipResponsibilityRepository
  implements TasksMembershipResponsibilityRepository
{
  public readonly calls: Array<{
    projectId: string;
    personId: string;
  }> = [];

  public hasBlocking = false;


  async hasActionableAssignedResponsibilities(
    projectId: string,
    personId: string
  ): Promise<boolean> {
    this.calls.push({
      projectId,
      personId,
    });

    return this.hasBlocking;
  }
}


test(
  "Tasks publishes only its membership-responsibility decision",
  async () => {
    const service =
      new FakeTasksMembershipResponsibilityService({
        hasBlockingResponsibilities:
          true,
      });

    const input = {
      projectId:
        "11111111-1111-4111-8111-111111111111",
      personId:
        "22222222-2222-4222-8222-222222222222",
      evaluatedAt:
        "2026-08-24T10:00:00.000Z",
    };

    assert.deepEqual(
      await service
        .assessMembershipResponsibilities(
          input
        ),
      {
        hasBlockingResponsibilities:
          true,
      }
    );

    assert.deepEqual(
      service.calls,
      [input]
    );
  }
);


test(
  "Tasks resolves a stable Person assessment inside its own boundary",
  async () => {
    const repository =
      new FakeTasksMembershipResponsibilityRepository();
    repository.hasBlocking = true;

    const service =
      new DefaultTasksMembershipResponsibilityService(
        repository
      );

    const assessment =
      await service
        .assessMembershipResponsibilities({
          projectId:
            "11111111-1111-4111-8111-111111111111",
          personId:
            "22222222-2222-4222-8222-222222222222",
          evaluatedAt:
            "2026-08-24T10:00:00.000Z",
        });

    assert.deepEqual(
      repository.calls,
      [{
        projectId:
          "11111111-1111-4111-8111-111111111111",
        personId:
          "22222222-2222-4222-8222-222222222222",
      }]
    );
    assert.deepEqual(
      assessment,
      {
        hasBlockingResponsibilities:
          true,
      }
    );
    assert.deepEqual(
      Object.keys(assessment),
      ["hasBlockingResponsibilities"]
    );
  }
);


test(
  "Tasks returns a non-blocking business assessment when no actionable responsibility exists",
  async () => {
    const repository =
      new FakeTasksMembershipResponsibilityRepository();

    const assessment =
      await new DefaultTasksMembershipResponsibilityService(
        repository
      ).assessMembershipResponsibilities({
        projectId:
          "11111111-1111-4111-8111-111111111111",
        personId:
          "22222222-2222-4222-8222-222222222222",
        evaluatedAt:
          "2026-08-24T10:00:00.000Z",
      });

    assert.equal(
      assessment.hasBlockingResponsibilities,
      false
    );
  }
);

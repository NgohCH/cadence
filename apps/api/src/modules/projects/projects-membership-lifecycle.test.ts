import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DefaultProjectsMembershipLifecycleService,
  classifyProjectMembershipLifecycle,
} from "./projects-membership-lifecycle";

import type {
  ProjectLifecycleReadRepository,
} from "./projects-membership-lifecycle";

import type {
  ProjectLifecycleStatus,
} from "./projects.types";


class FakeProjectLifecycleReadRepository
  implements ProjectLifecycleReadRepository
{
  public readonly calls: string[] = [];

  constructor(
    public status:
      ProjectLifecycleStatus | null
  ) {}


  async findLifecycleStatus(
    projectId: string
  ): Promise<ProjectLifecycleStatus | null> {
    this.calls.push(projectId);
    return this.status;
  }
}


test(
  "Projects owns the frozen membership lifecycle classifications",
  () => {
    assert.equal(
      classifyProjectMembershipLifecycle(
        "draft"
      ),
      "MUTABLE_NON_OPERATIONAL"
    );
    assert.equal(
      classifyProjectMembershipLifecycle(
        "active"
      ),
      "OPERATIONAL"
    );
    assert.equal(
      classifyProjectMembershipLifecycle(
        "on_hold"
      ),
      "OPERATIONAL"
    );
    assert.equal(
      classifyProjectMembershipLifecycle(
        "completed"
      ),
      "LIFECYCLE_READ_ONLY"
    );
    assert.equal(
      classifyProjectMembershipLifecycle(
        "cancelled"
      ),
      "LIFECYCLE_READ_ONLY"
    );
  }
);


test(
  "Projects publishes only lifecycle state needed by Project Membership",
  async () => {
    const repository =
      new FakeProjectLifecycleReadRepository(
        "active"
      );

    const result =
      await new DefaultProjectsMembershipLifecycleService(
        repository
      ).getMembershipLifecycleState(
        "project-a"
      );

    assert.deepEqual(
      result,
      {
        projectId: "project-a",
        status: "active",
        classification:
          "OPERATIONAL",
      }
    );
    assert.deepEqual(
      result === null
        ? []
        : Object.keys(result),
      [
        "projectId",
        "status",
        "classification",
      ]
    );
    assert.deepEqual(
      repository.calls,
      ["project-a"]
    );
  }
);


test(
  "Projects lifecycle boundary returns null for an unknown project",
  async () => {
    const result =
      await new DefaultProjectsMembershipLifecycleService(
        new FakeProjectLifecycleReadRepository(
          null
        )
      ).getMembershipLifecycleState(
        "missing-project"
      );

    assert.equal(result, null);
  }
);

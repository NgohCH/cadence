import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ActiveResponsibilitiesExistError,
  LastRequiredRoleHolderError,
  MemberRemovalNotPermittedError,
  ProjectMembershipExpiredError,
  ProjectMembershipNotFoundError,
} from "./project-membership.errors";

import {
  MEMBERSHIP_LIFECYCLE_READ_ONLY_PROJECT_STATUSES,
  OPERATIONAL_PROJECT_STATUSES,
  PROJECT_MEMBERSHIP_TERMINATION_TYPES,
  isMembershipLifecycleReadOnlyProject,
  isOperationalProject,
  requiresExpiryContinuityMechanism,
  requiresProtectedRoleContinuity,
} from "./project-membership-lifecycle.types";

import type {
  ProjectMembershipTermination,
  ProjectMembershipTerminationResult,
} from "./project-membership-lifecycle.types";


test(
  "VS002-06 termination vocabulary excludes self-leave",
  () => {
    assert.deepEqual(
      PROJECT_MEMBERSHIP_TERMINATION_TYPES,
      [
        "ADMINISTRATIVE_REMOVAL",
        "EXPIRY",
      ]
    );

    assert.equal(
      PROJECT_MEMBERSHIP_TERMINATION_TYPES
        .includes("SELF_LEAVE" as never),
      false
    );
  }
);


test(
  "administrative removal requires Person provenance while system expiry does not",
  () => {
    const administrative:
      ProjectMembershipTermination = {
      type:
        "ADMINISTRATIVE_REMOVAL",
      projectId:
        "11111111-1111-4111-8111-111111111111",
      membershipId:
        "22222222-2222-4222-8222-222222222222",
      terminatedByPersonId:
        "33333333-3333-4333-8333-333333333333",
      terminationReason:
        "Access no longer required",
      correlationId:
        "44444444-4444-4444-8444-444444444444",
      terminatedAt:
        "2026-08-24T10:00:00.000Z",
    };

    const expiry:
      ProjectMembershipTermination = {
      projectId:
        administrative.projectId,
      membershipId:
        administrative.membershipId,
      type: "EXPIRY",
      terminatedByPersonId: null,
      terminationReason: null,
      correlationId:
        administrative.correlationId,
      terminatedAt:
        administrative.terminatedAt,
    };

    assert.equal(
      administrative
        .terminatedByPersonId,
      "33333333-3333-4333-8333-333333333333"
    );
    assert.equal(
      expiry.terminatedByPersonId,
      null
    );
  }
);


test(
  "completed and cancelled projects are read-only for membership lifecycle",
  () => {
    assert.deepEqual(
      MEMBERSHIP_LIFECYCLE_READ_ONLY_PROJECT_STATUSES,
      ["completed", "cancelled"]
    );

    for (const status of [
      "completed",
      "cancelled",
    ] as const) {
      assert.equal(
        isMembershipLifecycleReadOnlyProject(
          status
        ),
        true
      );
    }

    for (const status of [
      "draft",
      "active",
      "on_hold",
    ] as const) {
      assert.equal(
        isMembershipLifecycleReadOnlyProject(
          status
        ),
        false
      );
    }
  }
);


test(
  "active and on-hold projects require operational Manager continuity",
  () => {
    assert.deepEqual(
      OPERATIONAL_PROJECT_STATUSES,
      ["active", "on_hold"]
    );

    assert.equal(
      isOperationalProject("draft"),
      false
    );
    assert.equal(
      isOperationalProject("active"),
      true
    );
    assert.equal(
      isOperationalProject("on_hold"),
      true
    );
    assert.equal(
      isOperationalProject("completed"),
      false
    );
    assert.equal(
      isOperationalProject("cancelled"),
      false
    );
  }
);


test(
  "Owner continuity is mandatory and Sponsor continuity is optional",
  () => {
    for (const status of [
      "draft",
      "active",
      "on_hold",
      "completed",
      "cancelled",
    ] as const) {
      assert.equal(
        requiresProtectedRoleContinuity(
          "PROJECT_OWNER",
          status
        ),
        true
      );
      assert.equal(
        requiresProtectedRoleContinuity(
          "PROJECT_SPONSOR",
          status
        ),
        false
      );
    }

    assert.equal(
      requiresProtectedRoleContinuity(
        "PROJECT_MANAGER",
        "active"
      ),
      true
    );
    assert.equal(
      requiresProtectedRoleContinuity(
        "PROJECT_MANAGER",
        "draft"
      ),
      false
    );
  }
);


test(
  "expiring Owner and Manager assignments require a continuity mechanism",
  () => {
    assert.equal(
      requiresExpiryContinuityMechanism(
        "PROJECT_OWNER"
      ),
      true
    );
    assert.equal(
      requiresExpiryContinuityMechanism(
        "PROJECT_MANAGER"
      ),
      true
    );
    assert.equal(
      requiresExpiryContinuityMechanism(
        "PROJECT_SPONSOR"
      ),
      false
    );
  }
);


test(
  "expiry materialisation result explicitly represents an idempotent retry",
  () => {
    const result:
      ProjectMembershipTerminationResult = {
        outcome:
          "ALREADY_ENDED",
        membership: {
          id:
            "22222222-2222-4222-8222-222222222222",
          personId:
            "55555555-5555-4555-8555-555555555555",
          projectId:
            "11111111-1111-4111-8111-111111111111",
          effectiveFrom:
            "2026-08-01T00:00:00.000Z",
          effectiveTo:
            "2026-08-24T10:00:00.000Z",
          status:
            "ENDED",
          grantedBy:
            "33333333-3333-4333-8333-333333333333",
          createdAt:
            "2026-08-01T00:00:00.000Z",
          terminationReason:
            null,
        },
        closedAssignments: [],
        termination: {
          type:
            "EXPIRY",
          projectId:
            "11111111-1111-4111-8111-111111111111",
          membershipId:
            "22222222-2222-4222-8222-222222222222",
          terminatedByPersonId:
            null,
          terminationReason:
            null,
          correlationId:
            "44444444-4444-4444-8444-444444444444",
          terminatedAt:
            "2026-08-24T10:00:00.000Z",
        },
      };

    assert.equal(
      result.outcome,
      "ALREADY_ENDED"
    );
    assert.equal(
      result.membership.status,
      "ENDED"
    );
    assert.equal(
      result.termination
        .terminatedByPersonId,
      null
    );
  }
);


test(
  "VS002-06 errors retain stable application identities",
  () => {
    const errors = [
      [
        new ProjectMembershipNotFoundError(),
        "ProjectMembershipNotFoundError",
      ],
      [
        new ProjectMembershipExpiredError(),
        "ProjectMembershipExpiredError",
      ],
      [
        new ActiveResponsibilitiesExistError(),
        "ActiveResponsibilitiesExistError",
      ],
      [
        new LastRequiredRoleHolderError(),
        "LastRequiredRoleHolderError",
      ],
      [
        new MemberRemovalNotPermittedError(),
        "MemberRemovalNotPermittedError",
      ],
    ] as const;

    for (const [error, name] of errors) {
      assert.equal(error.name, name);
      assert.notEqual(
        error.message.trim(),
        ""
      );
    }
  }
);

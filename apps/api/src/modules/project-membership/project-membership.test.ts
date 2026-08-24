import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ProjectRoleAssignmentInvalidError,
  ProjectRoleTransferRequiredError,
  ProjectMembershipValidationError,
} from "./project-membership.errors";

import {
  getProtectedRolePermission,
} from "./project-permissions";

import {
  createProjectMembership,
  isProjectMembershipEffectiveAt,
} from "./project-membership";

import type {
  CreateProjectMembershipInput,
  ProjectMembership,
} from "./project-membership.types";

import {
  ORDINARY_PROJECT_ROLES,
  PROJECT_ROLES,
  isOrdinaryProjectRole,
  isProtectedProjectRole,
  isReadOnlyProjectRole,
} from "./project-role.types";

import type {
  ProjectRoleAssignment,
} from "./project-role.types";


const membershipId =
  "11111111-1111-4111-8111-111111111111";

const personId =
  "22222222-2222-4222-8222-222222222222";

const projectId =
  "33333333-3333-4333-8333-333333333333";

const grantedByPersonId =
  "44444444-4444-4444-8444-444444444444";


function createInput(
  overrides: Partial<CreateProjectMembershipInput> = {}
): CreateProjectMembershipInput {
  return {
    id:
      membershipId,
    personId,
    projectId,
    effectiveFrom:
      "2026-09-01T00:00:00.000Z",
    effectiveTo:
      null,
    status:
      "ACTIVE",
    grantedBy:
      grantedByPersonId,
    createdAt:
      "2026-08-20T00:00:00.000Z",
    terminationReason:
      null,
    ...overrides,
  };
}


test(
  "project-role vocabulary is exactly the frozen VS-002 baseline",
  () => {
    assert.deepEqual(
      PROJECT_ROLES,
      [
        "PROJECT_SPONSOR",
        "PROJECT_OWNER",
        "PROJECT_MANAGER",
        "PROJECT_MEMBER",
        "PROJECT_OBSERVER",
        "PROJECT_AUDITOR",
      ]
    );

    assert.equal(
      PROJECT_ROLES.includes(
        "TEMPORARY_PROJECT_MEMBER" as never
      ),
      false
    );
  }
);


test(
  "Sponsor Owner and Manager are protected responsibility roles",
  () => {
    assert.equal(
      isProtectedProjectRole(
        "PROJECT_SPONSOR"
      ),
      true
    );

    assert.equal(
      isProtectedProjectRole(
        "PROJECT_OWNER"
      ),
      true
    );

    assert.equal(
      isProtectedProjectRole(
        "PROJECT_MANAGER"
      ),
      true
    );
  }
);


test(
  "Member Observer and Auditor are exactly the ordinary project roles",
  () => {
    assert.deepEqual(
      ORDINARY_PROJECT_ROLES,
      [
        "PROJECT_MEMBER",
        "PROJECT_OBSERVER",
        "PROJECT_AUDITOR",
      ]
    );

    for (const role of PROJECT_ROLES) {
      assert.equal(
        isOrdinaryProjectRole(role),
        !isProtectedProjectRole(role),
        `${role} must be classified as either ordinary or protected.`
      );
    }
  }
);


test(
  "Member Observer and Auditor are not protected responsibility roles",
  () => {
    assert.equal(
      isProtectedProjectRole(
        "PROJECT_MEMBER"
      ),
      false
    );

    assert.equal(
      isProtectedProjectRole(
        "PROJECT_OBSERVER"
      ),
      false
    );

    assert.equal(
      isProtectedProjectRole(
        "PROJECT_AUDITOR"
      ),
      false
    );
  }
);


test(
  "protected roles map to their exact frozen permission codes",
  () => {
    assert.equal(
      getProtectedRolePermission(
        "PROJECT_MANAGER"
      ),
      "member.assign_manager"
    );

    assert.equal(
      getProtectedRolePermission(
        "PROJECT_OWNER"
      ),
      "member.assign_owner"
    );

    assert.equal(
      getProtectedRolePermission(
        "PROJECT_SPONSOR"
      ),
      "member.assign_sponsor"
    );
  }
);


test(
  "VS002-05 role errors retain stable application identities",
  () => {
    assert.equal(
      new ProjectRoleTransferRequiredError()
        .name,
      "ProjectRoleTransferRequiredError"
    );

    assert.equal(
      new ProjectRoleAssignmentInvalidError()
        .name,
      "ProjectRoleAssignmentInvalidError"
    );
  }
);


test(
  "Observer and Auditor are classified as read-only role concepts",
  () => {
    assert.equal(
      isReadOnlyProjectRole(
        "PROJECT_OBSERVER"
      ),
      true
    );

    assert.equal(
      isReadOnlyProjectRole(
        "PROJECT_AUDITOR"
      ),
      true
    );

    assert.equal(
      isReadOnlyProjectRole(
        "PROJECT_MEMBER"
      ),
      false
    );
  }
);


test(
  "open-ended membership is effective from effectiveFrom onward",
  () => {
    const membership =
      createProjectMembership(
        createInput()
      );

    assert.equal(
      isProjectMembershipEffectiveAt(
        membership,
        "2026-09-01T00:00:00.000Z"
      ),
      true
    );

    assert.equal(
      isProjectMembershipEffectiveAt(
        membership,
        "2028-01-01T00:00:00.000Z"
      ),
      true
    );
  }
);


test(
  "future membership is not yet effective",
  () => {
    const membership =
      createProjectMembership(
        createInput()
      );

    assert.equal(
      isProjectMembershipEffectiveAt(
        membership,
        "2026-08-31T23:59:59.999Z"
      ),
      false
    );
  }
);


test(
  "time-bounded membership is effective within its half-open period",
  () => {
    const membership =
      createProjectMembership(
        createInput({
          effectiveTo:
            "2026-12-01T00:00:00.000Z",
        })
      );

    assert.equal(
      isProjectMembershipEffectiveAt(
        membership,
        "2026-11-30T23:59:59.999Z"
      ),
      true
    );

    assert.equal(
      isProjectMembershipEffectiveAt(
        membership,
        "2026-12-01T00:00:00.000Z"
      ),
      false
    );
  }
);


test(
  "expired membership is not effective at a later supplied time",
  () => {
    const membership =
      createProjectMembership(
        createInput({
          effectiveTo:
            "2026-10-01T00:00:00.000Z",
          status:
            "ENDED",
        })
      );

    assert.equal(
      isProjectMembershipEffectiveAt(
        membership,
        "2026-10-01T00:00:00.001Z"
      ),
      false
    );
  }
);


test(
  "ended membership retains its historical effective interval",
  () => {
    const membership =
      createProjectMembership(
        createInput({
          effectiveTo:
            "2026-10-01T00:00:00.000Z",
          status:
            "ENDED",
        })
      );

    assert.equal(
      isProjectMembershipEffectiveAt(
        membership,
        "2026-09-15T00:00:00.000Z"
      ),
      true
    );
  }
);


test(
  "membership duration does not alter role meaning",
  () => {
    const openMembership =
      createProjectMembership(
        createInput()
      );

    const boundedMembership =
      createProjectMembership(
        createInput({
          id:
            "55555555-5555-4555-8555-555555555555",
          effectiveTo:
            "2026-12-01T00:00:00.000Z",
        })
      );

    const openRole:
      ProjectRoleAssignment = {
        id:
          "66666666-6666-4666-8666-666666666666",
        projectId,
        membershipId:
          openMembership.id,
        role:
          "PROJECT_MEMBER",
        effectiveFrom:
          openMembership.effectiveFrom,
        effectiveTo:
          null,
        assignedBy:
          grantedByPersonId,
        changeReason:
          null,
        createdAt:
          openMembership.createdAt,
      };

    const boundedRole:
      ProjectRoleAssignment = {
        ...openRole,
        id:
          "77777777-7777-4777-8777-777777777777",
        membershipId:
          boundedMembership.id,
        effectiveTo:
          boundedMembership.effectiveTo,
      };

    assert.equal(
      openRole.role,
      "PROJECT_MEMBER"
    );

    assert.equal(
      boundedRole.role,
      "PROJECT_MEMBER"
    );
  }
);


test(
  "membership uses stable personId and projectId without login data",
  () => {
    const membership =
      createProjectMembership(
        createInput()
      );

    assert.equal(
      membership.personId,
      personId
    );

    assert.equal(
      membership.projectId,
      projectId
    );

    assert.equal(
      "email" in membership,
      false
    );

    assert.equal(
      "loginIdentifier" in membership,
      false
    );

    assert.equal(
      "providerSubjectId" in membership,
      false
    );
  }
);


test(
  "persisted historical membership can represent unavailable grantor provenance",
  () => {
    const historicalMembership = {
      ...createInput(),
      grantedBy: null,
    } satisfies ProjectMembership;

    assert.equal(
      historicalMembership.grantedBy,
      null
    );
  }
);


test(
  "new membership creation requires a stable Person grantor",
  () => {
    assert.throws(
      () =>
        createProjectMembership(
          createInput({
            grantedBy: "   ",
          })
        ),
      ProjectMembershipValidationError
    );

    assert.throws(
      () =>
        createProjectMembership({
          ...createInput(),
          // @ts-expect-error New membership creation cannot use null provenance.
          grantedBy: null,
        }),
      ProjectMembershipValidationError
    );
  }
);


test(
  "invalid membership date ranges are rejected",
  () => {
    assert.throws(
      () =>
        createProjectMembership(
          createInput({
            effectiveTo:
              "2026-09-01T00:00:00.000Z",
          })
        ),
      ProjectMembershipValidationError
    );

    assert.throws(
      () =>
        createProjectMembership(
          createInput({
            effectiveTo:
              "2026-08-31T23:59:59.999Z",
          })
        ),
      ProjectMembershipValidationError
    );
  }
);


test(
  "ended membership requires a bounded effective period",
  () => {
    assert.throws(
      () =>
        createProjectMembership(
          createInput({
            status:
              "ENDED",
          })
        ),
      ProjectMembershipValidationError
    );
  }
);

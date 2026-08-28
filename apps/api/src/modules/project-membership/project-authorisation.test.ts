import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  ProjectMembershipRepository,
} from "./project-membership.repository";

import type {
  CreateProjectMembershipInput,
  ProjectMembership,
} from "./project-membership.types";

import {
  ProjectAuthorisationService,
} from "./project-authorisation.service";

import {
  ProjectRoleAssignmentInvalidError,
} from "./project-membership.errors";

import type {
  ProjectAuthorisationContext,
} from "./project-authorisation.types";

import type {
  ProjectRole,
  ProjectRoleAssignment,
} from "./project-role.types";

import {
  PROJECT_ROLES,
} from "./project-role.types";

import {
  PROJECT_MEMBER_REMOVAL_PERMISSION,
} from "./project-permissions";


const personId =
  "11111111-1111-4111-8111-111111111111";

const userId =
  "22222222-2222-4222-8222-222222222222";

const projectId =
  "33333333-3333-4333-8333-333333333333";

const otherProjectId =
  "44444444-4444-4444-8444-444444444444";

const membershipId =
  "55555555-5555-4555-8555-555555555555";

const evaluatedAt =
  "2026-08-21T06:00:00.000Z";


const context:
  ProjectAuthorisationContext = {
    actorPersonId:
      personId,
  };


class InMemoryProjectMembershipRepository
  implements ProjectMembershipRepository
{
  constructor(
    public memberships:
      ProjectMembership[] = [],
    public assignments:
      ProjectRoleAssignment[] = []
  ) {}


  async createMembership(
    membership: CreateProjectMembershipInput
  ): Promise<ProjectMembership> {
    this.memberships.push(membership);
    return membership;
  }


  async findMembershipById(
    requestedMembershipId: string
  ): Promise<ProjectMembership | null> {
    return this.memberships.find(
      (membership) =>
        membership.id ===
          requestedMembershipId
    ) ?? null;
  }


   async listMembershipsForProject(
    requestedProjectId: string
  ): Promise<ProjectMembership[]> {
    return this.memberships.filter(
      (membership) =>
        membership.projectId ===
          requestedProjectId
    );
  }
  async listMembershipsForPersonInProject(
    requestedPersonId: string,
    requestedProjectId: string
  ): Promise<ProjectMembership[]> {
    return this.memberships.filter(
      (membership) =>
        membership.personId ===
          requestedPersonId &&
        membership.projectId ===
          requestedProjectId
    );
  }


  async createRoleAssignment(
    assignment: ProjectRoleAssignment
  ): Promise<ProjectRoleAssignment> {
    this.assignments.push(assignment);
    return assignment;
  }


  async listRoleAssignments(
    requestedMembershipId: string
  ): Promise<ProjectRoleAssignment[]> {
    return this.assignments.filter(
      (assignment) =>
        assignment.membershipId ===
          requestedMembershipId
    );
  }
}


function createMembership(
  overrides: Partial<ProjectMembership> = {}
): ProjectMembership {
  return {
    id:
      membershipId,
    personId,
    projectId,
    effectiveFrom:
      "2026-08-01T00:00:00.000Z",
    effectiveTo:
      null,
    status:
      "ACTIVE",
    grantedBy:
      "66666666-6666-4666-8666-666666666666",
    createdAt:
      "2026-08-01T00:00:00.000Z",
    terminationReason:
      null,
    ...overrides,
  };
}


function createAssignment(
  role: ProjectRole,
  overrides: Partial<ProjectRoleAssignment> = {}
): ProjectRoleAssignment {
  return {
    id:
      "77777777-7777-4777-8777-777777777777",
    projectId,
    membershipId,
    role,
    effectiveFrom:
      "2026-08-01T00:00:00.000Z",
    effectiveTo:
      null,
    assignedBy:
      "66666666-6666-4666-8666-666666666666",
    changeReason:
      null,
    createdAt:
      "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}


function createService(
  repository:
    InMemoryProjectMembershipRepository
): ProjectAuthorisationService {
  return new ProjectAuthorisationService(
    repository,
    () => evaluatedAt
  );
}

test(
  "effective frozen role authorises project access and returns stable Person authority",
  async () => {
    const repository =
      new InMemoryProjectMembershipRepository(
        [createMembership()],
        [createAssignment("PROJECT_MEMBER")]
      );

    const service =
      createService(repository);

    assert.equal(
      await service.canAccessProject(
        context,
        projectId
      ),
      true
    );

    const authorisation =
      await service
        .getEffectiveProjectAuthorisation(
          personId,
          projectId
        );

    assert.deepEqual(
      authorisation.roles,
      ["PROJECT_MEMBER"]
    );

    assert.deepEqual(
      authorisation.membershipIds,
      [membershipId]
    );

    assert.equal(
      authorisation.permissions.includes(
        "project.view"
      ),
      true
    );
  }
);


test(
  "authenticated Person without an effective project membership is denied",
  async () => {
    const service =
      createService(
        new InMemoryProjectMembershipRepository()
      );

    assert.equal(
      await service.canAccessProject(
        context,
        projectId
      ),
      false
    );

    assert.deepEqual(
      await service.getEffectiveProjectRoles(
        personId,
        projectId
      ),
      []
    );
  }
);


test(
  "Observer can read but cannot mutate project state",
  async () => {
    const service =
      createService(
        new InMemoryProjectMembershipRepository(
          [createMembership()],
          [
            createAssignment(
              "PROJECT_OBSERVER"
            ),
          ]
        )
      );

    assert.equal(
      await service.hasProjectPermission(
        context,
        projectId,
        "message.view"
      ),
      true
    );

    assert.equal(
      await service.hasProjectPermission(
        context,
        projectId,
        "message.create"
      ),
      false
    );

    assert.equal(
      await service.hasProjectPermission(
        context,
        projectId,
        "member.invite"
      ),
      false
    );
  }
);


test(
  "Auditor receives specialised audit read access but no mutation permission",
  async () => {
    const service =
      createService(
        new InMemoryProjectMembershipRepository(
          [createMembership()],
          [
            createAssignment(
              "PROJECT_AUDITOR"
            ),
          ]
        )
      );

    assert.equal(
      await service.hasProjectPermission(
        context,
        projectId,
        "audit.view"
      ),
      true
    );

    assert.equal(
      await service.hasProjectPermission(
        context,
        projectId,
        "task.create"
      ),
      false
    );
  }
);


test(
  "ordinary role changes follow the frozen Owner and Manager permission matrix",
  async () => {
    const expectations = {
      PROJECT_SPONSOR: false,
      PROJECT_OWNER: true,
      PROJECT_MANAGER: true,
      PROJECT_MEMBER: false,
      PROJECT_OBSERVER: false,
      PROJECT_AUDITOR: false,
    } as const satisfies Record<
      ProjectRole,
      boolean
    >;

    for (const role of PROJECT_ROLES) {
      const service =
        createService(
          new InMemoryProjectMembershipRepository(
            [createMembership()],
            [createAssignment(role)]
          )
        );

      assert.equal(
        await service.hasProjectPermission(
          context,
          projectId,
          "member.change_role"
        ),
        expectations[role],
        `${role} ordinary-role permission must match the frozen matrix.`
      );
    }
  }
);


test(
  "administrative membership removal follows the frozen Owner and Manager permission matrix",
  async () => {
    const expectations = {
      PROJECT_SPONSOR: false,
      PROJECT_OWNER: true,
      PROJECT_MANAGER: true,
      PROJECT_MEMBER: false,
      PROJECT_OBSERVER: false,
      PROJECT_AUDITOR: false,
    } as const satisfies Record<
      ProjectRole,
      boolean
    >;

    for (const role of PROJECT_ROLES) {
      const service =
        createService(
          new InMemoryProjectMembershipRepository(
            [createMembership()],
            [createAssignment(role)]
          )
        );

      assert.equal(
        await service.hasProjectPermission(
          context,
          projectId,
          PROJECT_MEMBER_REMOVAL_PERMISSION
        ),
        expectations[role],
        `${role} member-removal permission must match the frozen matrix.`
      );
    }
  }
);


test(
  "protected appointments and transfers follow the frozen permission matrix",
  async () => {
    const protectedPermissions = [
      "member.assign_manager",
      "member.assign_owner",
      "member.assign_sponsor",
    ] as const;

    const permittedActors =
      new Set<ProjectRole>([
        "PROJECT_SPONSOR",
        "PROJECT_OWNER",
      ]);

    for (const permission of protectedPermissions) {
      for (const role of PROJECT_ROLES) {
        const service =
          createService(
            new InMemoryProjectMembershipRepository(
              [createMembership()],
              [createAssignment(role)]
            )
          );

        assert.equal(
          await service.hasProjectPermission(
            context,
            projectId,
            permission
          ),
          permittedActors.has(role),
          `${role} permission for ${permission} must match the frozen matrix.`
        );
      }
    }
  }
);


test(
  "an effective frozen-role decision fails closed when the permission is absent",
  async () => {
    const service =
      createService(
        new InMemoryProjectMembershipRepository(
          [createMembership()],
          [
            createAssignment(
              "PROJECT_MANAGER"
            ),
          ]
        )
      );

    assert.equal(
      await service.hasProjectPermission(
        context,
        projectId,
        "member.assign_owner"
      ),
      false
    );
  }
);

test(
  "project membership does not authorise a different project",
  async () => {
    const service =
      createService(
        new InMemoryProjectMembershipRepository(
          [createMembership()],
          [createAssignment("PROJECT_OWNER")]
        )
      );

    assert.equal(
      await service.canAccessProject(
        context,
        otherProjectId
      ),
      false
    );
  }
);


test(
  "future expired and ended memberships do not grant current access",
  async () => {
    const repository =
      new InMemoryProjectMembershipRepository(
        [
          createMembership({
            id:
              "88888888-8888-4888-8888-888888888888",
            effectiveFrom:
              "2026-09-01T00:00:00.000Z",
          }),
          createMembership({
            id:
              "99999999-9999-4999-8999-999999999999",
            effectiveFrom:
              "2026-07-01T00:00:00.000Z",
            effectiveTo:
              "2026-08-01T00:00:00.000Z",
          }),
          createMembership({
            id:
              "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            status:
              "ENDED",
            effectiveTo:
              "2026-09-01T00:00:00.000Z",
          }),
        ],
        [
          createAssignment(
            "PROJECT_OWNER",
            {
              membershipId:
                "88888888-8888-4888-8888-888888888888",
            }
          ),
          createAssignment(
            "PROJECT_OWNER",
            {
              membershipId:
                "99999999-9999-4999-8999-999999999999",
            }
          ),
          createAssignment(
            "PROJECT_OWNER",
            {
              membershipId:
                "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            }
          ),
        ]
      );

    assert.equal(
      await createService(repository)
        .canAccessProject(
          context,
          projectId
        ),
      false
    );
  }
);


test(
  "expired role assignment does not grant access through an active membership",
  async () => {
    const service =
      createService(
        new InMemoryProjectMembershipRepository(
          [createMembership()],
          [
            createAssignment(
              "PROJECT_MANAGER",
              {
                effectiveTo:
                  "2026-08-21T06:00:00.000Z",
              }
            ),
          ]
        )
      );

    assert.equal(
      await service.canAccessProject(
        context,
        projectId
      ),
      false,
      "Role periods use an exclusive effectiveTo boundary."
    );
  }
);


test(
  "one ordinary role can coexist with a protected role",
  async () => {
    const service =
      createService(
        new InMemoryProjectMembershipRepository(
          [createMembership()],
          [
            createAssignment(
              "PROJECT_MANAGER"
            ),
            createAssignment(
              "PROJECT_MEMBER",
              {
                id:
                  "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              }
            ),
          ]
        )
      );

    assert.deepEqual(
      await service.getEffectiveProjectRoles(
        personId,
        projectId
      ),
      [
        "PROJECT_MANAGER",
        "PROJECT_MEMBER",
      ]
    );

    assert.equal(
      await service.hasProjectPermission(
        context,
        projectId,
        "task.create"
      ),
      true
    );
  }
);


test(
  "multiple effective ordinary roles on one membership are invalid",
  async () => {
    const service =
      createService(
        new InMemoryProjectMembershipRepository(
          [createMembership()],
          [
            createAssignment(
              "PROJECT_MEMBER"
            ),
            createAssignment(
              "PROJECT_OBSERVER",
              {
                id:
                  "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              }
            ),
          ]
        )
      );

    await assert.rejects(
      service.getEffectiveProjectRoles(
        personId,
        projectId
      ),
      ProjectRoleAssignmentInvalidError
    );
  }
);


test(
  "active membership without an effective frozen role fails closed",
  async () => {
    const service =
      createService(
        new InMemoryProjectMembershipRepository(
          [createMembership()]
        )
      );

    assert.equal(
      await service.hasProjectPermission(
        context,
        projectId,
        "project.view"
      ),
      false
    );
  }
);


test(
  "multiple effective assignments for the same protected role are invalid",
  async () => {
    const service =
      createService(
        new InMemoryProjectMembershipRepository(
          [createMembership()],
          [
            createAssignment(
              "PROJECT_OWNER"
            ),
            createAssignment(
              "PROJECT_OWNER",
              {
                id:
                  "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              }
            ),
          ]
        )
      );

    await assert.rejects(
      service.getEffectiveProjectRoles(
        personId,
        projectId
      ),
      ProjectRoleAssignmentInvalidError
    );
  }
);

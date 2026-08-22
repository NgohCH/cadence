import assert from "node:assert/strict";
import test from "node:test";

import type {
  CadencePerson,
  OrganisationalAffiliation,
} from "../identity/identity.types";

import type {
  ProjectAuthorisationContext,
} from "./project-authorisation.types";

import type {
  ProjectMemberAdmissionInput,
  ProjectMemberAdmissionRepository,
  ProjectMemberAdmissionResult,
} from "./project-member-admission.repository";

import {
  ProjectMemberPersonNotFoundError,
  ProjectMembershipAlreadyActiveError,
  ProjectMembershipPermissionDeniedError,
  ProjectMembershipValidationError,
} from "./project-membership.errors";

import type {
  ProjectMembershipRepository,
} from "./project-membership.repository";

import {
  ProjectMembershipService,
} from "./project-membership.service";

import type {
  ProjectAuthorisationPort,
  ProjectMemberIdentityPort,
} from "./project-membership.service";

import type {
  CreateProjectMembershipInput,
  ProjectMembership,
} from "./project-membership.types";

import type {
  ProjectRole,
  ProjectRoleAssignment,
} from "./project-role.types";


const projectId =
  "11111111-1111-4111-8111-111111111111";

const otherProjectId =
  "22222222-2222-4222-8222-222222222222";

const actorUserId =
  "33333333-3333-4333-8333-333333333333";

const actorPersonId =
  "44444444-4444-4444-8444-444444444444";

const internalPersonId =
  "55555555-5555-4555-8555-555555555555";

const externalPersonId =
  "66666666-6666-4666-8666-666666666666";

const evaluatedAt =
  "2026-09-15T00:00:00.000Z";


const context:
  ProjectAuthorisationContext = {
    actorUserId,
    actorPersonId,
  };


class InMemoryMembershipRepository
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
    this.memberships.push(
      membership
    );

    return membership;
  }


  async findMembershipById(
    membershipId: string
  ): Promise<ProjectMembership | null> {
    return (
      this.memberships.find(
        (membership) =>
          membership.id ===
            membershipId
      ) ?? null
    );
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
    personId: string,
    requestedProjectId: string
  ): Promise<ProjectMembership[]> {
    return this.memberships.filter(
      (membership) =>
        membership.personId ===
          personId &&
        membership.projectId ===
          requestedProjectId
    );
  }


  async createRoleAssignment(
    assignment: ProjectRoleAssignment
  ): Promise<ProjectRoleAssignment> {
    this.assignments.push(
      assignment
    );

    return assignment;
  }


  async listRoleAssignments(
    membershipId: string
  ): Promise<ProjectRoleAssignment[]> {
    return this.assignments.filter(
      (assignment) =>
        assignment.membershipId ===
          membershipId
    );
  }
}


class InMemoryAdmissionRepository
  implements ProjectMemberAdmissionRepository
{
  public calls:
    ProjectMemberAdmissionInput[] = [];


  async addProjectMember(
    input: ProjectMemberAdmissionInput
  ): Promise<ProjectMemberAdmissionResult> {
    this.calls.push(
      input
    );

    return {
      membership:
        input.membership,

      roleAssignment:
        input.roleAssignment,
    };
  }
}


class FakeIdentityRepository
  implements ProjectMemberIdentityPort
{
  constructor(
    private readonly persons:
      CadencePerson[] = [],

    private readonly affiliations:
      OrganisationalAffiliation[] = []
  ) {}


  async findPersonById(
    personId: string
  ): Promise<CadencePerson | null> {
    return (
      this.persons.find(
        (person) =>
          person.id === personId
      ) ?? null
    );
  }


  async listOrganisationalAffiliations(
    personId: string
  ): Promise<OrganisationalAffiliation[]> {
    return this.affiliations.filter(
      (affiliation) =>
        affiliation.personId ===
          personId
    );
  }
}


class FakeAuthorisation
  implements ProjectAuthorisationPort
{
  public permissions =
    new Map<string, boolean>();

  public roles =
    new Map<string, ProjectRole[]>();

  public permissionCalls:
    Array<{
      projectId: string;
      permission: string;
    }> = [];


  allow(
    permission: string
  ): void {
    this.permissions.set(
      permission,
      true
    );
  }


  deny(
    permission: string
  ): void {
    this.permissions.set(
      permission,
      false
    );
  }


  setRoles(
    personId: string,
    roles: ProjectRole[]
  ): void {
    this.roles.set(
      personId,
      roles
    );
  }


  async hasProjectPermission(
    _context:
      ProjectAuthorisationContext,

    requestedProjectId: string,
    permission: string
  ): Promise<boolean> {
    this.permissionCalls.push({
      projectId:
        requestedProjectId,

      permission,
    });

    return (
      this.permissions.get(
        permission
      ) ?? false
    );
  }


  async getEffectiveProjectRoles(
    personId: string,
    _requestedProjectId: string
  ): Promise<ProjectRole[]> {
    return (
      this.roles.get(
        personId
      ) ?? []
    );
  }
}


function createPerson(
  id: string,
  displayName: string
): CadencePerson {
  return {
    id,
    displayName,
  };
}


function createMembership(
  overrides:
    Partial<ProjectMembership> = {}
): ProjectMembership {
  return {
    id:
      "77777777-7777-4777-8777-777777777777",

    personId:
      internalPersonId,

    projectId,

    effectiveFrom:
      "2026-09-01T00:00:00.000Z",

    effectiveTo:
      null,

    status:
      "ACTIVE",

    grantedBy:
      actorPersonId,

    createdAt:
      "2026-09-01T00:00:00.000Z",

    terminationReason:
      null,

    ...overrides,
  };
}


function createService(
  membershipRepository:
    InMemoryMembershipRepository,

  admissionRepository:
    InMemoryAdmissionRepository,

  identityRepository:
    FakeIdentityRepository,

  authorisation:
    FakeAuthorisation,

  ids: string[] = [
    "88888888-8888-4888-8888-888888888888",
    "99999999-9999-4999-8999-999999999999",
  ]
): ProjectMembershipService {
  let index = 0;

  return new ProjectMembershipService(
    authorisation,
    membershipRepository,
    admissionRepository,
    identityRepository,
    () => evaluatedAt,
    () => {
      const id =
        ids[index];

      index += 1;

      if (!id) {
        throw new Error(
          "Test ID generator exhausted."
        );
      }

      return id;
    }
  );
}


test(
  "authorised project participant can list current project members",
  async () => {
    const membershipRepository =
      new InMemoryMembershipRepository([
        createMembership(),

        createMembership({
          id:
            "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",

          personId:
            externalPersonId,
        }),

        createMembership({
          id:
            "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",

          personId:
            "cccccccc-cccc-4ccc-8ccc-cccccccccccc",

          projectId:
            otherProjectId,
        }),

        createMembership({
          id:
            "dddddddd-dddd-4ddd-8ddd-dddddddddddd",

          personId:
            "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",

          effectiveTo:
            "2026-09-10T00:00:00.000Z",
        }),
      ]);

    const admissionRepository =
      new InMemoryAdmissionRepository();

    const identityRepository =
      new FakeIdentityRepository(
        [
          createPerson(
            internalPersonId,
            "Internal Member"
          ),

          createPerson(
            externalPersonId,
            "External Member"
          ),
        ],

        [
          {
            personId:
              internalPersonId,

            classification:
              "INTERNAL",

            organisationName:
              "HELP University",

            effectiveFrom:
              "2026-01-01T00:00:00.000Z",

            effectiveTo:
              null,
          },

          {
            personId:
              externalPersonId,

            classification:
              "EXTERNAL",

            organisationName:
              "ABC Consulting",

            effectiveFrom:
              "2026-01-01T00:00:00.000Z",

            effectiveTo:
              null,
          },
        ]
      );

    const authorisation =
      new FakeAuthorisation();

    authorisation.allow(
      "member.view"
    );

    authorisation.setRoles(
      internalPersonId,
      ["PROJECT_MEMBER"]
    );

    authorisation.setRoles(
      externalPersonId,
      ["PROJECT_OBSERVER"]
    );

    const service =
      createService(
        membershipRepository,
        admissionRepository,
        identityRepository,
        authorisation
      );

    const members =
      await service
        .listProjectMembers(
          context,
          projectId
        );

    assert.equal(
      members.length,
      2
    );

    assert.equal(
      members[0]?.person.displayName,
      "Internal Member"
    );

    assert.equal(
      members[0]?.affiliation
        ?.classification,
      "INTERNAL"
    );

    assert.deepEqual(
      members[0]?.roles,
      ["PROJECT_MEMBER"]
    );

    assert.equal(
      members[1]?.person.displayName,
      "External Member"
    );

    assert.equal(
      members[1]?.affiliation
        ?.classification,
      "EXTERNAL"
    );

    assert.deepEqual(
      members[1]?.roles,
      ["PROJECT_OBSERVER"]
    );
  }
);


test(
  "member listing requires member.view",
  async () => {
    const membershipRepository =
      new InMemoryMembershipRepository();

    const admissionRepository =
      new InMemoryAdmissionRepository();

    const identityRepository =
      new FakeIdentityRepository();

    const authorisation =
      new FakeAuthorisation();

    authorisation.deny(
      "member.view"
    );

    const service =
      createService(
        membershipRepository,
        admissionRepository,
        identityRepository,
        authorisation
      );

    await assert.rejects(
      service.listProjectMembers(
        context,
        projectId
      ),
      ProjectMembershipPermissionDeniedError
    );

    assert.deepEqual(
      authorisation.permissionCalls,
      [
        {
          projectId,
          permission:
            "member.view",
        },
      ]
    );
  }
);


test(
  "authorised actor can add an open-ended ordinary member",
  async () => {
    const membershipRepository =
      new InMemoryMembershipRepository();

    const admissionRepository =
      new InMemoryAdmissionRepository();

    const identityRepository =
      new FakeIdentityRepository([
        createPerson(
          internalPersonId,
          "Internal Member"
        ),
      ]);

    const authorisation =
      new FakeAuthorisation();

    authorisation.allow(
      "member.invite"
    );

    const service =
      createService(
        membershipRepository,
        admissionRepository,
        identityRepository,
        authorisation
      );

    const result =
      await service.addProjectMember(
        context,
        projectId,
        {
          personId:
            internalPersonId,

          role:
            "PROJECT_MEMBER",

          effectiveFrom:
            "2026-09-20T00:00:00+08:00",

          effectiveTo:
            null,
        }
      );

    assert.equal(
      admissionRepository.calls.length,
      1
    );

    assert.equal(
      result.membership.personId,
      internalPersonId
    );

    assert.equal(
      result.membership.projectId,
      projectId
    );

    assert.equal(
      result.membership.effectiveFrom,
      "2026-09-19T16:00:00.000Z"
    );

    assert.equal(
      result.membership.effectiveTo,
      null
    );

    assert.equal(
      result.membership.status,
      "ACTIVE"
    );

    assert.equal(
      result.membership.grantedBy,
      actorPersonId
    );

    assert.equal(
      result.roleAssignment.role,
      "PROJECT_MEMBER"
    );

    assert.equal(
      result.roleAssignment.membershipId,
      result.membership.id
    );

    assert.equal(
      result.roleAssignment.assignedBy,
      actorPersonId
    );
  }
);


test(
  "authorised actor can add a time-bounded external Person",
  async () => {
    const membershipRepository =
      new InMemoryMembershipRepository();

    const admissionRepository =
      new InMemoryAdmissionRepository();

    const identityRepository =
      new FakeIdentityRepository(
        [
          createPerson(
            externalPersonId,
            "External Consultant"
          ),
        ],

        [
          {
            personId:
              externalPersonId,

            classification:
              "EXTERNAL",

            organisationName:
              "ABC Consulting",

            effectiveFrom:
              "2026-01-01T00:00:00.000Z",

            effectiveTo:
              null,
          },
        ]
      );

    const authorisation =
      new FakeAuthorisation();

    authorisation.allow(
      "member.invite"
    );

    const service =
      createService(
        membershipRepository,
        admissionRepository,
        identityRepository,
        authorisation
      );

    const result =
      await service.addProjectMember(
        context,
        projectId,
        {
          personId:
            externalPersonId,

          role:
            "PROJECT_MEMBER",

          effectiveFrom:
            "2026-10-01T00:00:00.000Z",

          effectiveTo:
            "2026-12-01T00:00:00.000Z",
        }
      );

    assert.equal(
      result.membership.personId,
      externalPersonId
    );

    assert.equal(
      result.membership.effectiveTo,
      "2026-12-01T00:00:00.000Z"
    );

    assert.equal(
      result.roleAssignment.effectiveTo,
      result.membership.effectiveTo
    );
  }
);


test(
  "add-member flow requires member.invite",
  async () => {
    const membershipRepository =
      new InMemoryMembershipRepository();

    const admissionRepository =
      new InMemoryAdmissionRepository();

    const identityRepository =
      new FakeIdentityRepository([
        createPerson(
          internalPersonId,
          "Internal Member"
        ),
      ]);

    const authorisation =
      new FakeAuthorisation();

    authorisation.deny(
      "member.invite"
    );

    const service =
      createService(
        membershipRepository,
        admissionRepository,
        identityRepository,
        authorisation
      );

    await assert.rejects(
      service.addProjectMember(
        context,
        projectId,
        {
          personId:
            internalPersonId,

          role:
            "PROJECT_MEMBER",

          effectiveFrom:
            evaluatedAt,

          effectiveTo:
            null,
        }
      ),
      ProjectMembershipPermissionDeniedError
    );

    assert.equal(
      admissionRepository.calls.length,
      0
    );
  }
);


test(
  "add-member flow requires an existing stable Cadence Person",
  async () => {
    const membershipRepository =
      new InMemoryMembershipRepository();

    const admissionRepository =
      new InMemoryAdmissionRepository();

    const identityRepository =
      new FakeIdentityRepository();

    const authorisation =
      new FakeAuthorisation();

    authorisation.allow(
      "member.invite"
    );

    const service =
      createService(
        membershipRepository,
        admissionRepository,
        identityRepository,
        authorisation
      );

    await assert.rejects(
      service.addProjectMember(
        context,
        projectId,
        {
          personId:
            internalPersonId,

          role:
            "PROJECT_MEMBER",

          effectiveFrom:
            evaluatedAt,

          effectiveTo:
            null,
        }
      ),
      ProjectMemberPersonNotFoundError
    );

    assert.equal(
      admissionRepository.calls.length,
      0
    );
  }
);


test(
  "overlapping active membership is rejected",
  async () => {
    const membershipRepository =
      new InMemoryMembershipRepository([
        createMembership({
          effectiveFrom:
            "2026-09-01T00:00:00.000Z",

          effectiveTo:
            "2026-11-01T00:00:00.000Z",
        }),
      ]);

    const admissionRepository =
      new InMemoryAdmissionRepository();

    const identityRepository =
      new FakeIdentityRepository([
        createPerson(
          internalPersonId,
          "Returning Member"
        ),
      ]);

    const authorisation =
      new FakeAuthorisation();

    authorisation.allow(
      "member.invite"
    );

    const service =
      createService(
        membershipRepository,
        admissionRepository,
        identityRepository,
        authorisation
      );

    await assert.rejects(
      service.addProjectMember(
        context,
        projectId,
        {
          personId:
            internalPersonId,

          role:
            "PROJECT_MEMBER",

          effectiveFrom:
            "2026-10-01T00:00:00.000Z",

          effectiveTo:
            null,
        }
      ),
      ProjectMembershipAlreadyActiveError
    );

    assert.equal(
      admissionRepository.calls.length,
      0
    );
  }
);


test(
  "half-open membership boundary allows a new period to start exactly when the previous active period ends",
  async () => {
    const membershipRepository =
      new InMemoryMembershipRepository([
        createMembership({
          effectiveFrom:
            "2026-09-01T00:00:00.000Z",

          effectiveTo:
            "2026-10-01T00:00:00.000Z",
        }),
      ]);

    const admissionRepository =
      new InMemoryAdmissionRepository();

    const identityRepository =
      new FakeIdentityRepository([
        createPerson(
          internalPersonId,
          "Continuing Member"
        ),
      ]);

    const authorisation =
      new FakeAuthorisation();

    authorisation.allow(
      "member.invite"
    );

    const service =
      createService(
        membershipRepository,
        admissionRepository,
        identityRepository,
        authorisation
      );

    const result =
      await service.addProjectMember(
        context,
        projectId,
        {
          personId:
            internalPersonId,

          role:
            "PROJECT_MEMBER",

          effectiveFrom:
            "2026-10-01T00:00:00.000Z",

          effectiveTo:
            null,
        }
      );

    assert.equal(
      result.membership.effectiveFrom,
      "2026-10-01T00:00:00.000Z"
    );

    assert.equal(
      admissionRepository.calls.length,
      1
    );
  }
);


test(
  "ended historical membership does not prevent a returning Person from receiving a new membership",
  async () => {
    const membershipRepository =
      new InMemoryMembershipRepository([
        createMembership({
          effectiveFrom:
            "2025-01-01T00:00:00.000Z",

          effectiveTo:
            "2025-07-01T00:00:00.000Z",

          status:
            "ENDED",

          terminationReason:
            "Previous participation ended.",
        }),
      ]);

    const admissionRepository =
      new InMemoryAdmissionRepository();

    const identityRepository =
      new FakeIdentityRepository([
        createPerson(
          internalPersonId,
          "Returning Member"
        ),
      ]);

    const authorisation =
      new FakeAuthorisation();

    authorisation.allow(
      "member.invite"
    );

    const service =
      createService(
        membershipRepository,
        admissionRepository,
        identityRepository,
        authorisation
      );

    const result =
      await service.addProjectMember(
        context,
        projectId,
        {
          personId:
            internalPersonId,

          role:
            "PROJECT_MEMBER",

          effectiveFrom:
            "2026-09-01T00:00:00.000Z",

          effectiveTo:
            null,
        }
      );

    assert.equal(
      result.membership.status,
      "ACTIVE"
    );

    assert.notEqual(
      result.membership.id,
      membershipRepository
        .memberships[0]?.id
    );

    assert.equal(
      admissionRepository.calls.length,
      1
    );
  }
);


test(
  "membership in another project does not prevent admission",
  async () => {
    const membershipRepository =
      new InMemoryMembershipRepository([
        createMembership({
          projectId:
            otherProjectId,
        }),
      ]);

    const admissionRepository =
      new InMemoryAdmissionRepository();

    const identityRepository =
      new FakeIdentityRepository([
        createPerson(
          internalPersonId,
          "Multi Project Member"
        ),
      ]);

    const authorisation =
      new FakeAuthorisation();

    authorisation.allow(
      "member.invite"
    );

    const service =
      createService(
        membershipRepository,
        admissionRepository,
        identityRepository,
        authorisation
      );

    const result =
      await service.addProjectMember(
        context,
        projectId,
        {
          personId:
            internalPersonId,

          role:
            "PROJECT_MEMBER",

          effectiveFrom:
            evaluatedAt,

          effectiveTo:
            null,
        }
      );

    assert.equal(
      result.membership.projectId,
      projectId
    );

    assert.equal(
      admissionRepository.calls.length,
      1
    );
  }
);


test(
  "invalid time-bounded membership period is rejected before persistence",
  async () => {
    const membershipRepository =
      new InMemoryMembershipRepository();

    const admissionRepository =
      new InMemoryAdmissionRepository();

    const identityRepository =
      new FakeIdentityRepository([
        createPerson(
          internalPersonId,
          "Internal Member"
        ),
      ]);

    const authorisation =
      new FakeAuthorisation();

    authorisation.allow(
      "member.invite"
    );

    const service =
      createService(
        membershipRepository,
        admissionRepository,
        identityRepository,
        authorisation
      );

    await assert.rejects(
      service.addProjectMember(
        context,
        projectId,
        {
          personId:
            internalPersonId,

          role:
            "PROJECT_MEMBER",

          effectiveFrom:
            "2026-12-01T00:00:00.000Z",

          effectiveTo:
            "2026-11-01T00:00:00.000Z",
        }
      ),
      ProjectMembershipValidationError
    );

    assert.equal(
      admissionRepository.calls.length,
      0
    );
  }
);

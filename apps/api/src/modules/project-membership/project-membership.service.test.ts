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
  ProjectRoleAssignmentInvalidError,
  ProjectRoleTransferRequiredError,
} from "./project-membership.errors";

import type {
  ProjectMembershipRepository,
} from "./project-membership.repository";

import type {
  ChangeOrdinaryRolePersistenceInput,
  ChangeOrdinaryRolePersistenceResult,
  ProjectRoleManagementRepository,
  TransferProtectedRolePersistenceInput,
  TransferProtectedRolePersistenceResult,
} from "./project-role-management.repository";

import {
  ProjectMembershipService,
} from "./project-membership.service";

import type {
  ProjectAuthorisationPort,
  ProjectMembershipLifecycleDependencies,
  ProjectMemberIdentityPort,
  ProjectRoleCommandContext,
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
  ProjectRoleCommandContext = {
    actorUserId,
    actorPersonId,
    correlationId:
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  };

const roleContext:
  ProjectRoleCommandContext = {
    ...context,
    correlationId:
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  };


class InMemoryMembershipRepository
  implements ProjectMembershipRepository
{
  public findMembershipCalls = 0;
  public listRoleAssignmentCalls = 0;

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
    this.findMembershipCalls += 1;

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
    this.listRoleAssignmentCalls += 1;

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
  public affiliationCalls = 0;

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
    this.affiliationCalls += 1;

    return this.affiliations.filter(
      (affiliation) =>
        affiliation.personId ===
          personId
    );
  }
}


class FakeRoleManagementRepository
  implements ProjectRoleManagementRepository
{
  public ordinaryCalls:
    ChangeOrdinaryRolePersistenceInput[] = [];

  public protectedCalls:
    TransferProtectedRolePersistenceInput[] = [];

  public ordinaryError: unknown = null;
  public protectedError: unknown = null;

  public closedOrdinaryAssignment:
    ProjectRoleAssignment | null = null;

  public outgoingProtectedAssignment:
    ProjectRoleAssignment | null = null;


  async changeOrdinaryRole(
    input: ChangeOrdinaryRolePersistenceInput
  ): Promise<ChangeOrdinaryRolePersistenceResult> {
    this.ordinaryCalls.push(input);

    if (this.ordinaryError !== null) {
      throw this.ordinaryError;
    }

    return {
      closedAssignment:
        this.closedOrdinaryAssignment,
      roleAssignment:
        assignmentFromOrdinaryInput(input),
    };
  }


  async transferProtectedRole(
    input: TransferProtectedRolePersistenceInput
  ): Promise<TransferProtectedRolePersistenceResult> {
    this.protectedCalls.push(input);

    if (this.protectedError !== null) {
      throw this.protectedError;
    }

    return {
      outgoingAssignment:
        this.outgoingProtectedAssignment,
      roleAssignment: {
        id:
          input.incomingAssignmentId,
        projectId:
          input.projectId,
        membershipId:
          input.incomingMembershipId,
        role:
          input.role,
        effectiveFrom:
          input.effectiveAt,
        effectiveTo:
          null,
        assignedBy:
          input.authorisedByPersonId,
        changeReason:
          input.reason,
        createdAt:
          input.createdAt,
      },
      transfer: {
        id:
          input.transferId,
        projectId:
          input.projectId,
        role:
          input.role,
        outgoingAssignmentId:
          this.outgoingProtectedAssignment
            ?.id ?? null,
        incomingAssignmentId:
          input.incomingAssignmentId,
        authorisedByPersonId:
          input.authorisedByPersonId,
        reason:
          input.reason,
        correlationId:
          input.correlationId,
        effectiveAt:
          input.effectiveAt,
        createdAt:
          input.createdAt,
      },
    };
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
  ],

  roleManagementRepository?:
    ProjectRoleManagementRepository
): ProjectMembershipService {
  let index = 0;

  return new ProjectMembershipService(
    authorisation,
    membershipRepository,
    admissionRepository,
    identityRepository,
    roleManagementRepository ??
      new FakeRoleManagementRepository(),
    {} as ProjectMembershipLifecycleDependencies,
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


function assignmentFromOrdinaryInput(
  input: ChangeOrdinaryRolePersistenceInput
): ProjectRoleAssignment {
  return {
    id:
      input.assignmentId,
    projectId:
      input.projectId,
    membershipId:
      input.membershipId,
    role:
      input.role,
    effectiveFrom:
      input.effectiveAt,
    effectiveTo:
      null,
    assignedBy:
      input.assignedByPersonId,
    changeReason:
      input.changeReason,
    createdAt:
      input.createdAt,
  };
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
      admissionRepository.calls[0]
        ?.correlationId,
      context.correlationId
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


function createRoleAssignment(
  overrides:
    Partial<ProjectRoleAssignment> = {}
): ProjectRoleAssignment {
  return {
    id:
      "abababab-abab-4bab-8bab-abababababab",
    projectId,
    membershipId:
      createMembership().id,
    role:
      "PROJECT_MEMBER",
    effectiveFrom:
      "2026-09-01T00:00:00.000Z",
    effectiveTo:
      null,
    assignedBy:
      actorPersonId,
    changeReason:
      "Existing assignment",
    createdAt:
      "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}


function createRoleHarness(
  membership:
    ProjectMembership = createMembership(),
  assignments:
    ProjectRoleAssignment[] = []
) {
  const membershipRepository =
    new InMemoryMembershipRepository(
      [membership],
      assignments
    );
  const admissionRepository =
    new InMemoryAdmissionRepository();
  const identityRepository =
    new FakeIdentityRepository();
  const authorisation =
    new FakeAuthorisation();
  const roleManagementRepository =
    new FakeRoleManagementRepository();
  const service = createService(
    membershipRepository,
    admissionRepository,
    identityRepository,
    authorisation,
    [
      "cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd",
      "dededede-dede-4ede-8ede-dededededede",
      "efefefef-efef-4fef-8fef-efefefefefef",
    ],
    roleManagementRepository
  );

  return {
    service,
    membershipRepository,
    identityRepository,
    authorisation,
    roleManagementRepository,
  };
}


test(
  "Owner can change Member to Observer with clock and provenance forwarding",
  async () => {
    const harness = createRoleHarness(
      createMembership(),
      [createRoleAssignment()]
    );
    harness.authorisation.allow(
      "member.change_role"
    );

    const result =
      await harness.service.changeOrdinaryRole(
        roleContext,
        projectId,
        {
          membershipId:
            createMembership().id,
          role:
            "PROJECT_OBSERVER",
          reason:
            "  Oversight period  ",
        }
      );

    assert.deepEqual(
      harness.authorisation.permissionCalls,
      [{
        projectId,
        permission:
          "member.change_role",
      }]
    );
    assert.deepEqual(
      harness.roleManagementRepository
        .ordinaryCalls,
      [{
        assignmentId:
          "cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd",
        projectId,
        membershipId:
          createMembership().id,
        role:
          "PROJECT_OBSERVER",
        effectiveAt:
          evaluatedAt,
        assignedByPersonId:
          actorPersonId,
        changeReason:
          "Oversight period",
        correlationId:
          roleContext.correlationId,
        createdAt:
          evaluatedAt,
      }]
    );
    assert.equal(result.closedAssignment, null);
    assert.equal(result.effectiveAt, evaluatedAt);
    assert.equal(
      harness.identityRepository
        .affiliationCalls,
      0
    );
  }
);


test(
  "Manager can change Observer to Auditor and preserves closed history",
  async () => {
    const existing = createRoleAssignment({
      role:
        "PROJECT_OBSERVER",
    });
    const harness = createRoleHarness(
      createMembership(),
      [existing]
    );
    harness.authorisation.allow(
      "member.change_role"
    );
    harness.roleManagementRepository
      .closedOrdinaryAssignment = {
        ...existing,
        effectiveTo:
          evaluatedAt,
      };

    const result =
      await harness.service.changeOrdinaryRole(
        roleContext,
        projectId,
        {
          membershipId:
            createMembership().id,
          role:
            "PROJECT_AUDITOR",
          reason:
            null,
        }
      );

    assert.equal(
      result.closedAssignment?.role,
      "PROJECT_OBSERVER"
    );
    assert.equal(
      result.closedAssignment?.effectiveTo,
      evaluatedAt
    );
    assert.equal(
      result.roleAssignment.role,
      "PROJECT_AUDITOR"
    );
  }
);


test(
  "Sponsor Member Observer and Auditor are denied ordinary role change before membership lookup",
  async (t) => {
    for (const actorRole of [
      "PROJECT_SPONSOR",
      "PROJECT_MEMBER",
      "PROJECT_OBSERVER",
      "PROJECT_AUDITOR",
    ] as const) {
      await t.test(
        actorRole,
        async () => {
          const harness =
            createRoleHarness();
          harness.authorisation.deny(
            "member.change_role"
          );

          await assert.rejects(
            harness.service.changeOrdinaryRole(
              roleContext,
              projectId,
              {
                membershipId:
                  createMembership().id,
                role:
                  "PROJECT_OBSERVER",
                reason:
                  null,
              }
            ),
            ProjectMembershipPermissionDeniedError
          );
          assert.equal(
            harness.membershipRepository
              .findMembershipCalls,
            0
          );
          assert.equal(
            harness.roleManagementRepository
              .ordinaryCalls.length,
            0
          );
        }
      );
    }
  }
);


test(
  "ordinary operation rejects protected role through the stable transfer-required error",
  async () => {
    const harness = createRoleHarness();

    await assert.rejects(
      harness.service.changeOrdinaryRole(
        roleContext,
        projectId,
        {
          membershipId:
            createMembership().id,
          role:
            "PROJECT_MANAGER" as never,
          reason:
            null,
        }
      ),
      ProjectRoleTransferRequiredError
    );
    assert.equal(
      harness.authorisation
        .permissionCalls.length,
      0
    );
  }
);


test(
  "ordinary operation rejects wrong-project future and ended memberships",
  async (t) => {
    const cases: Array<{
      name: string;
      membership: ProjectMembership;
    }> = [
      {
        name:
          "wrong project",
        membership:
          createMembership({
            projectId:
              otherProjectId,
          }),
      },
      {
        name:
          "future",
        membership:
          createMembership({
            effectiveFrom:
              "2026-10-01T00:00:00.000Z",
          }),
      },
      {
        name:
          "ended",
        membership:
          createMembership({
            status:
              "ENDED",
            effectiveTo:
              "2026-10-01T00:00:00.000Z",
            terminationReason:
              "Ended",
          }),
      },
    ];

    for (const item of cases) {
      await t.test(
        item.name,
        async () => {
          const harness =
            createRoleHarness(
              item.membership
            );
          harness.authorisation.allow(
            "member.change_role"
          );

          await assert.rejects(
            harness.service.changeOrdinaryRole(
              roleContext,
              projectId,
              {
                membershipId:
                  item.membership.id,
                role:
                  "PROJECT_OBSERVER",
                reason:
                  null,
              }
            ),
            ProjectRoleAssignmentInvalidError
          );
          assert.equal(
            harness.roleManagementRepository
              .ordinaryCalls.length,
            0
          );
        }
      );
    }
  }
);


test(
  "ordinary operation allows zero frozen role and rejects multiple effective ordinary roles",
  async () => {
    const compatible =
      createRoleHarness();
    compatible.authorisation.allow(
      "member.change_role"
    );

    const compatibleResult =
      await compatible.service
        .changeOrdinaryRole(
          roleContext,
          projectId,
          {
            membershipId:
              createMembership().id,
            role:
              "PROJECT_MEMBER",
            reason:
              null,
          }
        );
    assert.equal(
      compatibleResult.closedAssignment,
      null
    );

    const invalid = createRoleHarness(
      createMembership(),
      [
        createRoleAssignment({
          role:
            "PROJECT_MEMBER",
        }),
        createRoleAssignment({
          id:
            "fafafafa-fafa-4afa-8afa-fafafafafafa",
          role:
            "PROJECT_OBSERVER",
        }),
      ]
    );
    invalid.authorisation.allow(
      "member.change_role"
    );

    await assert.rejects(
      invalid.service.changeOrdinaryRole(
        roleContext,
        projectId,
        {
          membershipId:
            createMembership().id,
          role:
            "PROJECT_AUDITOR",
          reason:
            null,
        }
      ),
      ProjectRoleAssignmentInvalidError
    );
    assert.equal(
      invalid.roleManagementRepository
        .ordinaryCalls.length,
      0
    );
  }
);


test(
  "ordinary persistence failures are abstracted as stable role errors",
  async () => {
    const harness = createRoleHarness();
    harness.authorisation.allow(
      "member.change_role"
    );
    harness.roleManagementRepository
      .ordinaryError =
        new Error("raw database failure");

    await assert.rejects(
      harness.service.changeOrdinaryRole(
        roleContext,
        projectId,
        {
          membershipId:
            createMembership().id,
          role:
            "PROJECT_OBSERVER",
          reason:
            null,
        }
      ),
      (error: unknown) =>
        error instanceof
          ProjectRoleAssignmentInvalidError &&
        !error.message.includes("database")
    );
  }
);


test(
  "protected role orchestration requests the exact frozen permission matrix",
  async (t) => {
    const roles = [
      {
        role:
          "PROJECT_MANAGER" as const,
        permission:
          "member.assign_manager",
      },
      {
        role:
          "PROJECT_OWNER" as const,
        permission:
          "member.assign_owner",
      },
      {
        role:
          "PROJECT_SPONSOR" as const,
        permission:
          "member.assign_sponsor",
      },
    ];
    const actors = [
      { role: "PROJECT_SPONSOR", allowed: true },
      { role: "PROJECT_OWNER", allowed: true },
      { role: "PROJECT_MANAGER", allowed: false },
      { role: "PROJECT_MEMBER", allowed: false },
      { role: "PROJECT_OBSERVER", allowed: false },
      { role: "PROJECT_AUDITOR", allowed: false },
    ] as const;

    for (const protectedRole of roles) {
      for (const actor of actors) {
        await t.test(
          `${actor.role} -> ${protectedRole.role}`,
          async () => {
            const harness =
              createRoleHarness();
            if (actor.allowed) {
              harness.authorisation.allow(
                protectedRole.permission
              );
            } else {
              harness.authorisation.deny(
                protectedRole.permission
              );
            }

            const operation =
              harness.service
                .transferProtectedRole(
                  roleContext,
                  projectId,
                  {
                    newMembershipId:
                      createMembership().id,
                    role:
                      protectedRole.role,
                    reason:
                      "Governance decision",
                  }
                );

            if (actor.allowed) {
              await operation;
              assert.equal(
                harness.roleManagementRepository
                  .protectedCalls.length,
                1
              );
            } else {
              await assert.rejects(
                operation,
                ProjectMembershipPermissionDeniedError
              );
              assert.equal(
                harness.membershipRepository
                  .findMembershipCalls,
                0
              );
              assert.equal(
                harness.roleManagementRepository
                  .protectedCalls.length,
                0
              );
            }

            assert.deepEqual(
              harness.authorisation.permissionCalls,
              [{
                projectId,
                permission:
                  protectedRole.permission,
              }]
            );
          }
        );
      }
    }
  }
);


test(
  "EXTERNAL member can become Project Manager without affiliation authorization",
  async () => {
    const externalMembership =
      createMembership({
        personId:
          externalPersonId,
      });
    const harness =
      createRoleHarness(
        externalMembership
      );
    harness.authorisation.allow(
      "member.assign_manager"
    );

    const result =
      await harness.service
        .transferProtectedRole(
          roleContext,
          projectId,
          {
            newMembershipId:
              externalMembership.id,
            role:
              "PROJECT_MANAGER",
            reason:
              "  External delivery lead  ",
          }
        );

    assert.equal(result.operation, "APPOINTMENT");
    assert.equal(result.outgoingAssignment, null);
    assert.deepEqual(
      harness.roleManagementRepository
        .protectedCalls,
      [{
        transferId:
          "cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd",
        incomingAssignmentId:
          "dededede-dede-4ede-8ede-dededededede",
        projectId,
        incomingMembershipId:
          externalMembership.id,
        role:
          "PROJECT_MANAGER",
        effectiveAt:
          evaluatedAt,
        authorisedByPersonId:
          actorPersonId,
        reason:
          "External delivery lead",
        correlationId:
          roleContext.correlationId,
        createdAt:
          evaluatedAt,
      }]
    );
    assert.equal(
      harness.identityRepository
        .affiliationCalls,
      0
    );
    assert.equal(
      harness.membershipRepository
        .listRoleAssignmentCalls,
      0,
      "Application service must not inspect protected holder state."
    );
  }
);


test(
  "protected operation rejects ordinary role and invalid incoming memberships",
  async (t) => {
    const invalidRoleHarness =
      createRoleHarness();

    await assert.rejects(
      invalidRoleHarness.service
        .transferProtectedRole(
          roleContext,
          projectId,
          {
            newMembershipId:
              createMembership().id,
            role:
              "PROJECT_MEMBER" as never,
            reason:
              "Invalid",
          }
        ),
      ProjectRoleAssignmentInvalidError
    );
    assert.equal(
      invalidRoleHarness.authorisation
        .permissionCalls.length,
      0
    );

    const membershipCases = [
      {
        name: "wrong project",
        membership: createMembership({
          projectId:
            otherProjectId,
        }),
      },
      {
        name: "future",
        membership: createMembership({
          effectiveFrom:
            "2026-10-01T00:00:00.000Z",
        }),
      },
      {
        name: "ended",
        membership: createMembership({
          status:
            "ENDED",
          effectiveTo:
            "2026-10-01T00:00:00.000Z",
          terminationReason:
            "Ended",
        }),
      },
    ];

    for (const item of membershipCases) {
      await t.test(item.name, async () => {
        const harness =
          createRoleHarness(
            item.membership
          );
        harness.authorisation.allow(
          "member.assign_manager"
        );

        await assert.rejects(
          harness.service
            .transferProtectedRole(
              roleContext,
              projectId,
              {
                newMembershipId:
                  item.membership.id,
                role:
                  "PROJECT_MANAGER",
                reason:
                  "Governance decision",
              }
            ),
          ProjectRoleAssignmentInvalidError
        );
        assert.equal(
          harness.roleManagementRepository
            .protectedCalls.length,
          0
        );
      });
    }
  }
);


test(
  "role operations reject missing memberships and blank protected reason",
  async () => {
    const harness = createRoleHarness();
    harness.membershipRepository.memberships = [];
    harness.authorisation.allow(
      "member.change_role"
    );
    harness.authorisation.allow(
      "member.assign_manager"
    );

    await assert.rejects(
      harness.service.changeOrdinaryRole(
        roleContext,
        projectId,
        {
          membershipId:
            createMembership().id,
          role:
            "PROJECT_OBSERVER",
          reason:
            null,
        }
      ),
      ProjectRoleAssignmentInvalidError
    );

    await assert.rejects(
      harness.service.transferProtectedRole(
        roleContext,
        projectId,
        {
          newMembershipId:
            createMembership().id,
          role:
            "PROJECT_MANAGER",
          reason:
            "Governance decision",
        }
      ),
      ProjectRoleAssignmentInvalidError
    );

    await assert.rejects(
      harness.service.transferProtectedRole(
        roleContext,
        projectId,
        {
          newMembershipId:
            createMembership().id,
          role:
            "PROJECT_MANAGER",
          reason:
            "   ",
        }
      ),
      ProjectRoleAssignmentInvalidError
    );
    assert.equal(
      harness.roleManagementRepository
        .ordinaryCalls.length,
      0
    );
    assert.equal(
      harness.roleManagementRepository
        .protectedCalls.length,
      0
    );
  }
);


test(
  "protected result reflects persistence-owned appointment and transfer outcomes",
  async () => {
    const appointment =
      createRoleHarness();
    appointment.authorisation.allow(
      "member.assign_owner"
    );

    const appointed =
      await appointment.service
        .transferProtectedRole(
          roleContext,
          projectId,
          {
            newMembershipId:
              createMembership().id,
            role:
              "PROJECT_OWNER",
            reason:
              "First owner",
          }
        );
    assert.equal(
      appointed.operation,
      "APPOINTMENT"
    );
    assert.equal(
      appointed.outgoingAssignment,
      null
    );

    const transfer =
      createRoleHarness();
    transfer.authorisation.allow(
      "member.assign_sponsor"
    );
    transfer.roleManagementRepository
      .outgoingProtectedAssignment =
        createRoleAssignment({
          role:
            "PROJECT_SPONSOR",
          effectiveTo:
            evaluatedAt,
        });

    const transferred =
      await transfer.service
        .transferProtectedRole(
          roleContext,
          projectId,
          {
            newMembershipId:
              createMembership().id,
            role:
              "PROJECT_SPONSOR",
            reason:
              "Sponsor succession",
          }
        );
    assert.equal(
      transferred.operation,
      "TRANSFER"
    );
    assert.equal(
      transferred.outgoingAssignment
        ?.role,
      "PROJECT_SPONSOR"
    );
    assert.equal(
      transferred.roleAssignment.role,
      "PROJECT_SPONSOR"
    );
    assert.equal(
      transferred.correlationId,
      roleContext.correlationId
    );
  }
);


test(
  "protected persistence failures are abstracted as stable role errors",
  async () => {
    const harness = createRoleHarness();
    harness.authorisation.allow(
      "member.assign_manager"
    );
    harness.roleManagementRepository
      .protectedError =
        new Error("raw postgres failure");

    await assert.rejects(
      harness.service.transferProtectedRole(
        roleContext,
        projectId,
        {
          newMembershipId:
            createMembership().id,
          role:
            "PROJECT_MANAGER",
          reason:
            "Governance decision",
        }
      ),
      (error: unknown) =>
        error instanceof
          ProjectRoleAssignmentInvalidError &&
        !error.message.includes("postgres")
    );
  }
);

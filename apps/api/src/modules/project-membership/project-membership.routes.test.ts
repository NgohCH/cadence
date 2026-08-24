import assert from "node:assert/strict";
import {
  once,
} from "node:events";
import type {
  AddressInfo,
} from "node:net";
import test from "node:test";

import express from "express";

import type {
  CadencePerson,
  OrganisationalAffiliation,
} from "../identity/identity.types";

import type {
  AuthenticatedRequestState,
} from "../../middleware/authenticate";

import type {
  ProjectAuthorisationContext,
} from "./project-authorisation.types";

import type {
  ProjectMemberAdmissionInput,
  ProjectMemberAdmissionRepository,
  ProjectMemberAdmissionResult,
} from "./project-member-admission.repository";

import type {
  ProjectMembershipRepository,
} from "./project-membership.repository";

import type {
  AdministrativeMembershipTerminationPersistenceInput,
  BoundedProtectedRoleViolation,
  MembershipExpiryFinalisationPersistenceInput,
  ProjectMembershipLifecycleRepository,
} from "./project-membership-lifecycle.repository";

import type {
  ProjectMembershipTerminationResult,
} from "./project-membership-lifecycle.types";

import type {
  ProjectMembershipLifecycleState,
  ProjectsMembershipLifecycleService,
} from "../projects/projects-membership-lifecycle";

import type {
  TasksMembershipResponsibilityService,
} from "../tasks/tasks-membership-responsibility";

import type {
  ChangeOrdinaryRolePersistenceInput,
  ChangeOrdinaryRolePersistenceResult,
  ProjectRoleManagementRepository,
  TransferProtectedRolePersistenceInput,
  TransferProtectedRolePersistenceResult,
} from "./project-role-management.repository";

import {
  createProjectMembershipRouter,
} from "./project-membership.routes";

import {
  ProjectMembershipService,
} from "./project-membership.service";

import type {
  ProjectAuthorisationPort,
  ProjectMemberIdentityPort,
} from "./project-membership.service";

import {
  LastRequiredRoleHolderError,
} from "./project-membership.errors";

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

const actorUserId =
  "22222222-2222-4222-8222-222222222222";

const actorPersonId =
  "33333333-3333-4333-8333-333333333333";

const targetPersonId =
  "44444444-4444-4444-8444-444444444444";

const requestId =
  "55555555-5555-4555-8555-555555555555";

const correlationId =
  "66666666-6666-4666-8666-666666666666";

const membershipId =
  "77777777-7777-4777-8777-777777777777";

const roleAssignmentId =
  "88888888-8888-4888-8888-888888888888";

const evaluatedAt =
  "2026-09-15T00:00:00.000Z";


const context:
  ProjectAuthorisationContext = {
    actorUserId,
    actorPersonId,
  };


type JsonObject =
  Record<string, unknown>;


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
    requestedMembershipId: string
  ): Promise<ProjectMembership | null> {
    return (
      this.memberships.find(
        (membership) =>
          membership.id ===
            requestedMembershipId
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
    requestedMembershipId: string
  ): Promise<ProjectRoleAssignment[]> {
    return this.assignments.filter(
      (assignment) =>
        assignment.membershipId ===
          requestedMembershipId
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


class FakeRoleManagementRepository
  implements ProjectRoleManagementRepository
{
  public ordinaryCalls:
    ChangeOrdinaryRolePersistenceInput[] = [];
  public protectedCalls:
    TransferProtectedRolePersistenceInput[] = [];
  public ordinaryError: unknown = null;
  public protectedError: unknown = null;
  public ordinaryClosed:
    ProjectRoleAssignment | null = null;
  public protectedOutgoing:
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
        this.ordinaryClosed,
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

    const roleAssignment: ProjectRoleAssignment = {
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
    };

    return {
      outgoingAssignment:
        this.protectedOutgoing,
      roleAssignment,
      transfer: {
        id:
          input.transferId,
        projectId:
          input.projectId,
        role:
          input.role,
        outgoingAssignmentId:
          this.protectedOutgoing
            ?.id ?? null,
        incomingAssignmentId:
          roleAssignment.id,
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


class FakeLifecycleRepository
  implements ProjectMembershipLifecycleRepository
{
  public calls:
    AdministrativeMembershipTerminationPersistenceInput[] = [];
  public error: unknown = null;

  async terminateAdministratively(
    input: AdministrativeMembershipTerminationPersistenceInput
  ): Promise<ProjectMembershipTerminationResult> {
    this.calls.push(input);
    if (this.error !== null) throw this.error;

    return {
      outcome: "ENDED",
      membership: {
        ...createMembership(),
        status: "ENDED",
        effectiveTo: evaluatedAt,
        terminationReason:
          input.terminationReason,
      },
      closedAssignments: [{
        ...createAssignment(),
        effectiveTo: evaluatedAt,
      }],
      termination: {
        type: "ADMINISTRATIVE_REMOVAL",
        projectId: input.projectId,
        membershipId: input.membershipId,
        terminatedByPersonId:
          input.terminatedByPersonId,
        terminationReason:
          input.terminationReason,
        correlationId:
          input.correlationId,
        terminatedAt:
          input.effectiveAt,
      },
    };
  }

  async listDueMemberships(): Promise<ProjectMembership[]> { return []; }
  async finaliseExpiry(_input: MembershipExpiryFinalisationPersistenceInput): Promise<ProjectMembershipTerminationResult> { throw new Error("not used"); }
  async listBoundedProtectedRoleViolations(): Promise<BoundedProtectedRoleViolation[]> { return []; }
}


class FakeProjectsLifecycle
  implements ProjectsMembershipLifecycleService
{
  public state: ProjectMembershipLifecycleState | null = {
    projectId,
    status: "active",
    classification: "OPERATIONAL",
  };

  async getMembershipLifecycleState(): Promise<ProjectMembershipLifecycleState | null> {
    return this.state;
  }
}


class FakeTasksResponsibilities
  implements TasksMembershipResponsibilityService
{
  public blocking = false;
  public calls: Array<{ projectId: string; personId: string; evaluatedAt: string }> = [];

  async assessMembershipResponsibilities(
    input: { projectId: string; personId: string; evaluatedAt: string }
  ): Promise<{ hasBlockingResponsibilities: boolean }> {
    this.calls.push(input);
    return { hasBlockingResponsibilities: this.blocking };
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
          person.id ===
            personId
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

    _requestedProjectId: string,
    permission: string
  ): Promise<boolean> {
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


function createMembership(
  overrides:
    Partial<ProjectMembership> = {}
): ProjectMembership {
  return {
    id:
      membershipId,

    personId:
      targetPersonId,

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


function createAssignment(
  overrides:
    Partial<ProjectRoleAssignment> = {}
): ProjectRoleAssignment {
  return {
    id:
      "abababab-abab-4bab-8bab-abababababab",
    projectId,
    membershipId,
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


function createService(
  options: {
    memberships?:
      ProjectMembership[];

    assignments?:
      ProjectRoleAssignment[];

    persons?:
      CadencePerson[];

    affiliations?:
      OrganisationalAffiliation[];

    permissions?:
      Record<string, boolean>;

    roles?:
      Record<string, ProjectRole[]>;

    lifecycleError?: unknown;
    tasksBlocking?: boolean;
    lifecycleState?:
      ProjectMembershipLifecycleState;
  } = {}
): {
  service:
    ProjectMembershipService;

  admissionRepository:
    InMemoryAdmissionRepository;

  roleManagementRepository:
    FakeRoleManagementRepository;

  lifecycleRepository:
    FakeLifecycleRepository;

  tasksResponsibilities:
    FakeTasksResponsibilities;
} {
  const membershipRepository =
    new InMemoryMembershipRepository(
      options.memberships ?? [],
      options.assignments ?? []
    );

  const admissionRepository =
    new InMemoryAdmissionRepository();

  const roleManagementRepository =
    new FakeRoleManagementRepository();

  const lifecycleRepository =
    new FakeLifecycleRepository();
  lifecycleRepository.error =
    options.lifecycleError ?? null;

  const projectsLifecycle =
    new FakeProjectsLifecycle();
  if (options.lifecycleState) {
    projectsLifecycle.state =
      options.lifecycleState;
  }

  const tasksResponsibilities =
    new FakeTasksResponsibilities();
  tasksResponsibilities.blocking =
    options.tasksBlocking ?? false;

  const identityRepository =
    new FakeIdentityRepository(
      options.persons ?? [],
      options.affiliations ?? []
    );

  const authorisation =
    new FakeAuthorisation();

  for (
    const [
      permission,
      allowed,
    ] of Object.entries(
      options.permissions ?? {}
    )
  ) {
    if (allowed) {
      authorisation.allow(
        permission
      );
    } else {
      authorisation.deny(
        permission
      );
    }
  }

  for (
    const [
      personId,
      roles,
    ] of Object.entries(
      options.roles ?? {}
    )
  ) {
    authorisation.setRoles(
      personId,
      roles
    );
  }

  const ids = [
    membershipId,
    roleAssignmentId,
    "99999999-9999-4999-8999-999999999999",
  ];

  let nextId =
    0;

  return {
    service:
      new ProjectMembershipService(
        authorisation,
        membershipRepository,
        admissionRepository,
        identityRepository,
        roleManagementRepository,
        {
          repository:
            lifecycleRepository,
          projects:
            projectsLifecycle,
          tasks:
            tasksResponsibilities,
        },
        () =>
          evaluatedAt,
        () => {
          const id =
            ids[nextId];

          nextId += 1;

          if (!id) {
            throw new Error(
              "Test ID generator exhausted."
            );
          }

          return id;
        }
      ),

    admissionRepository,
    roleManagementRepository,
    lifecycleRepository,
    tasksResponsibilities,
  };
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


async function request(
  service:
    ProjectMembershipService,

  path: string,

  init?: RequestInit,

  authenticated = true
): Promise<{
  status: number;
  body: JsonObject;
}> {
  const app =
    express();

  app.use(
    express.json()
  );

  app.use(
    (
      _req,
      res,
      next
    ) => {
      if (!authenticated) {
        res.status(401).json({
          success:
            false,
          error: {
            code:
              "UNAUTHENTICATED",
            message:
              "Authentication is required.",
            correlation_id:
              correlationId,
            details: {},
          },
        });

        return;
      }

      res.locals.authenticated = {
        user: {
          id:
            actorUserId,

          personId:
            actorPersonId,

          displayName:
            "Project Owner",

          email:
            "owner@example.test",

          status:
            "active",

          identityProvider:
            "test",
        },

        context: {
          ...context,

          correlationId,
          requestId,

          source:
            "api",

          identityProvider:
            "test",
        },
      } satisfies AuthenticatedRequestState;

      next();
    }
  );

  app.use(
    "/api/v1",
    createProjectMembershipRouter(
      service
    )
  );

  const server =
    app.listen(
      0,
      "127.0.0.1"
    );

  await once(
    server,
    "listening"
  );

  const address =
    server.address() as AddressInfo;

  try {
    const response =
      await fetch(
        `http://127.0.0.1:${address.port}${path}`,
        init
      );

    const body =
      await response.json() as
        JsonObject;

    return {
      status:
        response.status,

      body,
    };
  } finally {
    await new Promise<void>(
      (
        resolve,
        reject
      ) => {
        server.close(
          (error) => {
            if (error) {
              reject(
                error
              );

              return;
            }

            resolve();
          }
        );
      }
    );
  }
}


test(
  "GET members returns current project members",
  async () => {
    const {
      service,
    } = createService({
      memberships: [
        createMembership(),
      ],

      persons: [
        {
          id:
            targetPersonId,

          displayName:
            "External Consultant",
        },
      ],

      affiliations: [
        {
          personId:
            targetPersonId,

          classification:
            "EXTERNAL",

          organisationName:
            "ABC Consulting",

          effectiveFrom:
            "2026-01-01T00:00:00.000Z",

          effectiveTo:
            null,
        },
      ],

      permissions: {
        "member.view":
          true,
      },

      roles: {
        [targetPersonId]: [
          "PROJECT_MEMBER",
        ],
      },
    });

    const response =
      await request(
        service,
        `/api/v1/projects/${projectId}/members`
      );

    assert.equal(
      response.status,
      200
    );

    assert.equal(
      response.body.success,
      true
    );

    const data =
      response.body.data as
        JsonObject;

    const members =
      data.members as
        JsonObject[];

    assert.equal(
      members.length,
      1
    );

    assert.equal(
      members[0]?.person_id,
      targetPersonId
    );

    assert.equal(
      members[0]?.display_name,
      "External Consultant"
    );

    assert.deepEqual(
      members[0]?.roles,
      ["PROJECT_MEMBER"]
    );

    assert.deepEqual(
      members[0]?.affiliation,
      {
        classification:
          "EXTERNAL",

        organisation_name:
          "ABC Consulting",

        effective_from:
          "2026-01-01T00:00:00.000Z",

        effective_to:
          null,
      }
    );
  }
);


test(
  "GET members maps missing member.view to PROJECT_ACCESS_DENIED",
  async () => {
    const {
      service,
    } = createService({
      permissions: {
        "member.view":
          false,
      },
    });

    const response =
      await request(
        service,
        `/api/v1/projects/${projectId}/members`
      );

    assert.equal(
      response.status,
      403
    );

    assert.equal(
      response.body.success,
      false
    );

    const error =
      response.body.error as
        JsonObject;

    assert.equal(
      error.code,
      "PROJECT_ACCESS_DENIED"
    );

    assert.equal(
      error.correlation_id,
      correlationId
    );
  }
);


test(
  "POST member creates an open-ended PROJECT_MEMBER",
  async () => {
    const {
      service,
      admissionRepository,
    } = createService({
      persons: [
        {
          id:
            targetPersonId,

          displayName:
            "New Member",
        },
      ],

      permissions: {
        "member.invite":
          true,
      },
    });

    const response =
      await request(
        service,
        `/api/v1/projects/${projectId}/members`,
        {
          method:
            "POST",

          headers: {
            "content-type":
              "application/json",
          },

          body:
            JSON.stringify({
              person_id:
                targetPersonId,

              role:
                "PROJECT_MEMBER",

              effective_from:
                "2026-10-01T00:00:00.000Z",

              effective_to:
                null,
            }),
        }
      );

    assert.equal(
      response.status,
      201
    );

    assert.equal(
      admissionRepository.calls.length,
      1
    );

    const data =
      response.body.data as
        JsonObject;

    const membership =
      data.membership as
        JsonObject;

    const roleAssignment =
      data.role_assignment as
        JsonObject;

    assert.equal(
      membership.person_id,
      targetPersonId
    );

    assert.equal(
      membership.effective_to,
      null
    );

    assert.equal(
      roleAssignment.role,
      "PROJECT_MEMBER"
    );
  }
);


test(
  "POST member creates a time-bounded membership",
  async () => {
    const {
      service,
    } = createService({
      persons: [
        {
          id:
            targetPersonId,

          displayName:
            "Temporary Member",
        },
      ],

      permissions: {
        "member.invite":
          true,
      },
    });

    const response =
      await request(
        service,
        `/api/v1/projects/${projectId}/members`,
        {
          method:
            "POST",

          headers: {
            "content-type":
              "application/json",
          },

          body:
            JSON.stringify({
              person_id:
                targetPersonId,

              role:
                "PROJECT_MEMBER",

              effective_from:
                "2026-10-01T00:00:00.000Z",

              effective_to:
                "2026-12-01T00:00:00.000Z",
            }),
        }
      );

    assert.equal(
      response.status,
      201
    );

    const data =
      response.body.data as
        JsonObject;

    const membership =
      data.membership as
        JsonObject;

    assert.equal(
      membership.effective_to,
      "2026-12-01T00:00:00.000Z"
    );
  }
);


test(
  "POST member maps overlapping membership to PROJECT_MEMBERSHIP_ALREADY_ACTIVE",
  async () => {
    const {
      service,
    } = createService({
      memberships: [
        createMembership({
          effectiveFrom:
            "2026-09-01T00:00:00.000Z",

          effectiveTo:
            null,
        }),
      ],

      persons: [
        {
          id:
            targetPersonId,

          displayName:
            "Existing Member",
        },
      ],

      permissions: {
        "member.invite":
          true,
      },
    });

    const response =
      await request(
        service,
        `/api/v1/projects/${projectId}/members`,
        {
          method:
            "POST",

          headers: {
            "content-type":
              "application/json",
          },

          body:
            JSON.stringify({
              person_id:
                targetPersonId,

              role:
                "PROJECT_MEMBER",

              effective_from:
                "2026-10-01T00:00:00.000Z",

              effective_to:
                null,
            }),
        }
      );

    assert.equal(
      response.status,
      409
    );

    const error =
      response.body.error as
        JsonObject;

    assert.equal(
      error.code,
      "PROJECT_MEMBERSHIP_ALREADY_ACTIVE"
    );
  }
);


test(
  "POST member rejects malformed request payload",
  async () => {
    const {
      service,
    } = createService({
      permissions: {
        "member.invite":
          true,
      },
    });

    const response =
      await request(
        service,
        `/api/v1/projects/${projectId}/members`,
        {
          method:
            "POST",

          headers: {
            "content-type":
              "application/json",
          },

          body:
            JSON.stringify({
              person_id:
                targetPersonId,

              role:
                "PROJECT_MANAGER",

              effective_from:
                evaluatedAt,
            }),
        }
      );

    assert.equal(
      response.status,
      400
    );

    const error =
      response.body.error as
        JsonObject;

    assert.equal(
      error.code,
      "VALIDATION_ERROR"
    );
  }
);


test(
  "POST member returns NOT_FOUND for unknown stable Person",
  async () => {
    const {
      service,
    } = createService({
      permissions: {
        "member.invite":
          true,
      },
    });

    const response =
      await request(
        service,
        `/api/v1/projects/${projectId}/members`,
        {
          method:
            "POST",

          headers: {
            "content-type":
              "application/json",
          },

          body:
            JSON.stringify({
              person_id:
                targetPersonId,

              role:
                "PROJECT_MEMBER",

              effective_from:
                evaluatedAt,

              effective_to:
                null,
            }),
        }
      );

    assert.equal(
      response.status,
      404
    );

    const error =
      response.body.error as
        JsonObject;

    assert.equal(
      error.code,
      "NOT_FOUND"
    );
  }
);


test(
  "membership responses preserve request and correlation metadata",
  async () => {
    const {
      service,
    } = createService({
      permissions: {
        "member.view":
          true,
      },
    });

    const response =
      await request(
        service,
        `/api/v1/projects/${projectId}/members`
      );

    assert.equal(
      response.status,
      200
    );

    const meta =
      response.body.meta as
        JsonObject;

    assert.equal(
      meta.correlation_id,
      correlationId
    );

    assert.equal(
      meta.request_id,
      requestId
    );

    assert.equal(
      meta.next_cursor,
      null
    );
  }
);


test(
  "PATCH member lets Owner change Member to Observer using route and request context",
  async () => {
    const {
      service,
      roleManagementRepository,
    } = createService({
      memberships: [
        createMembership(),
      ],
      assignments: [
        createAssignment(),
      ],
      permissions: {
        "member.change_role":
          true,
      },
    });

    const response = await request(
      service,
      `/api/v1/projects/${projectId}/members/${membershipId}`,
      {
        method: "PATCH",
        headers: {
          "content-type":
            "application/json",
        },
        body: JSON.stringify({
          role:
            "PROJECT_OBSERVER",
          reason:
            "Oversight period",
        }),
      }
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.deepEqual(
      roleManagementRepository.ordinaryCalls,
      [{
        assignmentId:
          membershipId,
        projectId,
        membershipId,
        role:
          "PROJECT_OBSERVER",
        effectiveAt:
          evaluatedAt,
        assignedByPersonId:
          actorPersonId,
        changeReason:
          "Oversight period",
        createdAt:
          evaluatedAt,
      }]
    );

    const data =
      response.body.data as JsonObject;
    const assignment =
      data.role_assignment as JsonObject;
    assert.equal(
      assignment.role,
      "PROJECT_OBSERVER"
    );
    assert.equal(
      assignment.assigned_by_person_id,
      actorPersonId
    );
    assert.equal(
      data.effective_at,
      evaluatedAt
    );
    assert.equal(
      data.closed_assignment,
      null
    );

    const meta =
      response.body.meta as JsonObject;
    assert.equal(
      meta.correlation_id,
      correlationId
    );
  }
);


test(
  "PATCH member lets Manager change Observer to Auditor with closed history",
  async () => {
    const existing = createAssignment({
      role:
        "PROJECT_OBSERVER",
    });
    const {
      service,
      roleManagementRepository,
    } = createService({
      memberships: [createMembership()],
      assignments: [existing],
      permissions: {
        "member.change_role": true,
      },
    });
    roleManagementRepository.ordinaryClosed = {
      ...existing,
      effectiveTo:
        evaluatedAt,
    };

    const response = await request(
      service,
      `/api/v1/projects/${projectId}/members/${membershipId}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          role: "PROJECT_AUDITOR",
          reason: null,
        }),
      }
    );

    assert.equal(response.status, 200);
    const data =
      response.body.data as JsonObject;
    const closed =
      data.closed_assignment as JsonObject;
    assert.equal(
      closed.role,
      "PROJECT_OBSERVER"
    );
    assert.equal(
      closed.effective_to,
      evaluatedAt
    );
  }
);


test(
  "PATCH member rejects unauthenticated and denied actors",
  async () => {
    const unauthenticated = createService();
    const unauthenticatedResponse =
      await request(
        unauthenticated.service,
        `/api/v1/projects/${projectId}/members/${membershipId}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            role: "PROJECT_OBSERVER",
          }),
        },
        false
      );
    assert.equal(
      unauthenticatedResponse.status,
      401
    );
    assert.equal(
      (unauthenticatedResponse.body.error as JsonObject).code,
      "UNAUTHENTICATED"
    );

    const denied = createService({
      permissions: {
        "member.change_role": false,
      },
    });
    const deniedResponse = await request(
      denied.service,
      `/api/v1/projects/${projectId}/members/${membershipId}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          role: "PROJECT_OBSERVER",
        }),
      }
    );
    assert.equal(deniedResponse.status, 403);
    assert.equal(
      (deniedResponse.body.error as JsonObject).code,
      "PROJECT_ACCESS_DENIED"
    );
    assert.equal(
      denied.roleManagementRepository
        .ordinaryCalls.length,
      0
    );
  }
);


test(
  "PATCH member maps protected and invalid roles to stable errors",
  async () => {
    const protectedAttempt = createService();
    const protectedResponse = await request(
      protectedAttempt.service,
      `/api/v1/projects/${projectId}/members/${membershipId}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          role: "PROJECT_MANAGER",
        }),
      }
    );
    assert.equal(protectedResponse.status, 409);
    assert.equal(
      (protectedResponse.body.error as JsonObject).code,
      "PROJECT_ROLE_TRANSFER_REQUIRED"
    );

    const invalidAttempt = createService();
    const invalidResponse = await request(
      invalidAttempt.service,
      `/api/v1/projects/${projectId}/members/${membershipId}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          role: "PROJECT_UNKNOWN",
        }),
      }
    );
    assert.equal(invalidResponse.status, 409);
    assert.equal(
      (invalidResponse.body.error as JsonObject).code,
      "PROJECT_ROLE_ASSIGNMENT_INVALID"
    );
  }
);


test(
  "PATCH member rejects malformed and caller-controlled fields",
  async () => {
    for (const body of [
      [],
      {},
      {
        role: "PROJECT_OBSERVER",
        effective_at:
          "2030-01-01T00:00:00.000Z",
      },
      {
        role: "PROJECT_OBSERVER",
        actor_person_id:
          "not-the-actor",
      },
    ]) {
      const harness = createService();
      const response = await request(
        harness.service,
        `/api/v1/projects/${projectId}/members/${membershipId}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );
      assert.equal(response.status, 400);
      assert.equal(
        (response.body.error as JsonObject).code,
        "VALIDATION_ERROR"
      );
      assert.equal(
        harness.roleManagementRepository
          .ordinaryCalls.length,
        0
      );
    }
  }
);


test(
  "PATCH member maps wrong-project future ended and persistence failures without raw details",
  async () => {
    const cases = [
      createMembership({
        projectId:
          "aaaaaaaa-0000-4000-8000-000000000001",
      }),
      createMembership({
        effectiveFrom:
          "2026-10-01T00:00:00.000Z",
      }),
      createMembership({
        status: "ENDED",
        effectiveTo:
          "2026-10-01T00:00:00.000Z",
        terminationReason: "Ended",
      }),
    ];

    for (const membership of cases) {
      const harness = createService({
        memberships: [membership],
        permissions: {
          "member.change_role": true,
        },
      });
      const response = await request(
        harness.service,
        `/api/v1/projects/${projectId}/members/${membershipId}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            role: "PROJECT_OBSERVER",
          }),
        }
      );
      assert.equal(response.status, 409);
      assert.equal(
        (response.body.error as JsonObject).code,
        "PROJECT_ROLE_ASSIGNMENT_INVALID"
      );
    }

    const failed = createService({
      memberships: [createMembership()],
      permissions: {
        "member.change_role": true,
      },
    });
    failed.roleManagementRepository.ordinaryError =
      new Error("sensitive postgres detail");
    const failureResponse = await request(
      failed.service,
      `/api/v1/projects/${projectId}/members/${membershipId}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          role: "PROJECT_OBSERVER",
        }),
      }
    );
    const error =
      failureResponse.body.error as JsonObject;
    assert.equal(failureResponse.status, 409);
    assert.equal(
      error.code,
      "PROJECT_ROLE_ASSIGNMENT_INVALID"
    );
    assert.doesNotMatch(
      String(error.message),
      /postgres|sensitive/i
    );
  }
);


test(
  "POST role-transfers creates external Manager first appointment with request context",
  async () => {
    const {
      service,
      roleManagementRepository,
    } = createService({
      memberships: [
        createMembership({
          personId: targetPersonId,
        }),
      ],
      affiliations: [{
        personId: targetPersonId,
        classification: "EXTERNAL",
        organisationName: "Delivery Ltd",
        effectiveFrom:
          "2026-01-01T00:00:00.000Z",
        effectiveTo: null,
      }],
      permissions: {
        "member.assign_manager": true,
      },
    });

    const response = await request(
      service,
      `/api/v1/projects/${projectId}/role-transfers`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          role: "PROJECT_MANAGER",
          new_membership_id: membershipId,
          reason: "External delivery lead",
        }),
      }
    );

    assert.equal(response.status, 200);
    assert.deepEqual(
      roleManagementRepository.protectedCalls,
      [{
        transferId: membershipId,
        incomingAssignmentId:
          roleAssignmentId,
        projectId,
        incomingMembershipId:
          membershipId,
        role: "PROJECT_MANAGER",
        effectiveAt: evaluatedAt,
        authorisedByPersonId:
          actorPersonId,
        reason:
          "External delivery lead",
        correlationId,
        createdAt: evaluatedAt,
      }]
    );
    const data =
      response.body.data as JsonObject;
    assert.equal(data.role, "PROJECT_MANAGER");
    assert.equal(data.operation, "APPOINTMENT");
    assert.equal(data.outgoing_assignment, null);
    assert.equal(data.effective_at, evaluatedAt);
    const incoming =
      data.incoming_assignment as JsonObject;
    assert.equal(
      incoming.membership_id,
      membershipId
    );
    assert.equal(
      incoming.assigned_by_person_id,
      actorPersonId
    );
    assert.equal(
      (response.body.meta as JsonObject)
        .correlation_id,
      correlationId
    );
  }
);


test(
  "POST role-transfers returns Manager transfer history",
  async () => {
    const existing = createAssignment({
      role: "PROJECT_MANAGER",
      effectiveTo: evaluatedAt,
    });
    const harness = createService({
      memberships: [createMembership()],
      permissions: {
        "member.assign_manager": true,
      },
    });
    harness.roleManagementRepository
      .protectedOutgoing = existing;

    const response = await request(
      harness.service,
      `/api/v1/projects/${projectId}/role-transfers`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          role: "PROJECT_MANAGER",
          new_membership_id: membershipId,
          reason: "Manager succession",
        }),
      }
    );

    assert.equal(response.status, 200);
    const data =
      response.body.data as JsonObject;
    assert.equal(data.operation, "TRANSFER");
    assert.equal(
      (data.outgoing_assignment as JsonObject).role,
      "PROJECT_MANAGER"
    );
  }
);


test(
  "POST role-transfers supports Owner and Sponsor operations",
  async () => {
    for (const item of [
      {
        role: "PROJECT_OWNER",
        permission: "member.assign_owner",
      },
      {
        role: "PROJECT_SPONSOR",
        permission: "member.assign_sponsor",
      },
    ]) {
      const harness = createService({
        memberships: [createMembership()],
        permissions: {
          [item.permission]: true,
        },
      });
      const response = await request(
        harness.service,
        `/api/v1/projects/${projectId}/role-transfers`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            role: item.role,
            new_membership_id: membershipId,
            reason: "Governance succession",
          }),
        }
      );
      assert.equal(response.status, 200);
      assert.equal(
        (response.body.data as JsonObject).role,
        item.role
      );
    }
  }
);


test(
  "POST role-transfers rejects unauthenticated and denied Manager Member Observer Auditor actors",
  async () => {
    const unauthenticated = createService();
    const unauthenticatedResponse =
      await request(
        unauthenticated.service,
        `/api/v1/projects/${projectId}/role-transfers`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            role: "PROJECT_MANAGER",
            new_membership_id: membershipId,
            reason: "Denied",
          }),
        },
        false
      );
    assert.equal(
      unauthenticatedResponse.status,
      401
    );

    for (const actorRole of [
      "PROJECT_MANAGER",
      "PROJECT_MEMBER",
      "PROJECT_OBSERVER",
      "PROJECT_AUDITOR",
    ]) {
      const harness = createService({
        permissions: {
          "member.assign_manager": false,
        },
      });
      const response = await request(
        harness.service,
        `/api/v1/projects/${projectId}/role-transfers`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-test-role": actorRole,
          },
          body: JSON.stringify({
            role: "PROJECT_MANAGER",
            new_membership_id: membershipId,
            reason: "Denied",
          }),
        }
      );
      assert.equal(response.status, 403);
      assert.equal(
        (response.body.error as JsonObject).code,
        "PROJECT_ACCESS_DENIED"
      );
      assert.equal(
        harness.roleManagementRepository
          .protectedCalls.length,
        0
      );
    }
  }
);


test(
  "POST role-transfers rejects ordinary role malformed body and caller-controlled state",
  async () => {
    const cases = [
      {
        body: {
          role: "PROJECT_MEMBER",
          new_membership_id: membershipId,
          reason: "Invalid role",
        },
        status: 409,
        code: "PROJECT_ROLE_ASSIGNMENT_INVALID",
      },
      {
        body: {
          role: "PROJECT_MANAGER",
          new_membership_id: membershipId,
          reason: "",
        },
        status: 400,
        code: "VALIDATION_ERROR",
      },
      {
        body: {
          role: "PROJECT_MANAGER",
          new_membership_id: membershipId,
        },
        status: 400,
        code: "VALIDATION_ERROR",
      },
      {
        body: {
          role: "PROJECT_MANAGER",
          new_membership_id: membershipId,
          reason: "Invalid control",
          outgoing_assignment_id:
            "caller-controlled",
        },
        status: 400,
        code: "VALIDATION_ERROR",
      },
      {
        body: {
          role: "PROJECT_MANAGER",
          new_membership_id: membershipId,
          reason: "Invalid control",
          effective_at:
            "2030-01-01T00:00:00.000Z",
        },
        status: 400,
        code: "VALIDATION_ERROR",
      },
    ];

    for (const item of cases) {
      const harness = createService();
      const response = await request(
        harness.service,
        `/api/v1/projects/${projectId}/role-transfers`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(item.body),
        }
      );
      assert.equal(response.status, item.status);
      assert.equal(
        (response.body.error as JsonObject).code,
        item.code
      );
      assert.equal(
        harness.roleManagementRepository
          .protectedCalls.length,
        0
      );
    }
  }
);


test(
  "POST role-transfers maps invalid membership state and persistence failure safely",
  async () => {
    for (const membership of [
      createMembership({
        projectId:
          "aaaaaaaa-0000-4000-8000-000000000001",
      }),
      createMembership({
        effectiveFrom:
          "2026-10-01T00:00:00.000Z",
      }),
      createMembership({
        status: "ENDED",
        effectiveTo:
          "2026-10-01T00:00:00.000Z",
        terminationReason: "Ended",
      }),
    ]) {
      const harness = createService({
        memberships: [membership],
        permissions: {
          "member.assign_manager": true,
        },
      });
      const response = await request(
        harness.service,
        `/api/v1/projects/${projectId}/role-transfers`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            role: "PROJECT_MANAGER",
            new_membership_id: membershipId,
            reason: "Invalid membership",
          }),
        }
      );
      assert.equal(response.status, 409);
      assert.equal(
        (response.body.error as JsonObject).code,
        "PROJECT_ROLE_ASSIGNMENT_INVALID"
      );
    }

    const failed = createService({
      memberships: [createMembership()],
      permissions: {
        "member.assign_manager": true,
      },
    });
    failed.roleManagementRepository.protectedError =
      new Error("sensitive supabase conflict");
    const response = await request(
      failed.service,
      `/api/v1/projects/${projectId}/role-transfers`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          role: "PROJECT_MANAGER",
          new_membership_id: membershipId,
          reason: "Persistence conflict",
        }),
      }
    );
    const error =
      response.body.error as JsonObject;
    assert.equal(response.status, 409);
    assert.equal(
      error.code,
      "PROJECT_ROLE_ASSIGNMENT_INVALID"
    );
    assert.doesNotMatch(
      String(error.message),
      /supabase|sensitive/i
    );
  }
);


test("DELETE member lets Owner and Manager terminate through authenticated context", async (t) => {
  for (const actorRole of ["PROJECT_OWNER", "PROJECT_MANAGER"]) {
    await t.test(actorRole, async () => {
      const harness = createService({
        memberships: [createMembership()],
        permissions: { "member.remove": true },
      });
      const response = await request(
        harness.service,
        `/api/v1/projects/${projectId}/members/${membershipId}`,
        {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reason: "  Contract ended  " }),
        }
      );

      assert.equal(response.status, 200);
      assert.equal(response.body.success, true);
      assert.deepEqual(harness.lifecycleRepository.calls, [{
        projectId,
        membershipId,
        effectiveAt: evaluatedAt,
        terminatedByPersonId: actorPersonId,
        terminationReason: "Contract ended",
        correlationId,
      }]);
      assert.deepEqual(harness.tasksResponsibilities.calls, [{
        projectId,
        personId: targetPersonId,
        evaluatedAt,
      }]);

      const data = response.body.data as JsonObject;
      const termination = data.termination as JsonObject;
      assert.equal(data.outcome, "ENDED");
      assert.equal(termination.kind, "ADMINISTRATIVE_REMOVAL");
      assert.equal(termination.terminated_by_person_id, actorPersonId);
      assert.equal(termination.correlation_id, correlationId);
      assert.equal((response.body.meta as JsonObject).request_id, requestId);
    });
  }
});


test("DELETE member rejects unauthenticated, unauthorized, and self-removal attempts", async () => {
  const unauthenticated = createService();
  const noAuth = await request(
    unauthenticated.service,
    `/api/v1/projects/${projectId}/members/${membershipId}`,
    { method: "DELETE" },
    false
  );
  assert.equal(noAuth.status, 401);
  assert.equal((noAuth.body.error as JsonObject).code, "UNAUTHENTICATED");

  const denied = createService({
    memberships: [createMembership()],
    permissions: { "member.remove": false },
  });
  const forbidden = await request(
    denied.service,
    `/api/v1/projects/${projectId}/members/${membershipId}`,
    { method: "DELETE" }
  );
  assert.equal(forbidden.status, 403);
  assert.equal((forbidden.body.error as JsonObject).code, "PROJECT_ACCESS_DENIED");
  assert.equal(denied.lifecycleRepository.calls.length, 0);

  const self = createService({
    memberships: [createMembership({ personId: actorPersonId })],
    permissions: { "member.remove": true },
  });
  const selfResponse = await request(
    self.service,
    `/api/v1/projects/${projectId}/members/${membershipId}`,
    { method: "DELETE" }
  );
  assert.equal(selfResponse.status, 409);
  assert.equal((selfResponse.body.error as JsonObject).code, "MEMBER_REMOVAL_NOT_PERMITTED");
  assert.equal(self.lifecycleRepository.calls.length, 0);
});


test("DELETE member maps Tasks, continuity, and lifecycle-read-only conflicts", async (t) => {
  const cases = [
    {
      name: "Tasks blocker",
      options: { tasksBlocking: true },
      code: "ACTIVE_RESPONSIBILITIES_EXIST",
    },
    {
      name: "Owner continuity",
      options: { lifecycleError: new LastRequiredRoleHolderError() },
      code: "LAST_REQUIRED_ROLE_HOLDER",
    },
    {
      name: "Manager continuity",
      options: { lifecycleError: new LastRequiredRoleHolderError() },
      code: "LAST_REQUIRED_ROLE_HOLDER",
    },
    {
      name: "read-only project",
      options: {
        lifecycleState: {
          projectId,
          status: "completed" as const,
          classification: "LIFECYCLE_READ_ONLY" as const,
        },
      },
      code: "MEMBER_REMOVAL_NOT_PERMITTED",
    },
  ];

  for (const item of cases) {
    await t.test(item.name, async () => {
      const harness = createService({
        memberships: [createMembership()],
        permissions: { "member.remove": true },
        ...item.options,
      });
      const response = await request(
        harness.service,
        `/api/v1/projects/${projectId}/members/${membershipId}`,
        { method: "DELETE" }
      );
      assert.equal(response.status, 409);
      assert.equal((response.body.error as JsonObject).code, item.code);
    });
  }
});


test("DELETE member maps missing and ended membership without persistence details", async () => {
  const missing = createService({ permissions: { "member.remove": true } });
  const missingResponse = await request(
    missing.service,
    `/api/v1/projects/${projectId}/members/${membershipId}`,
    { method: "DELETE" }
  );
  assert.equal(missingResponse.status, 404);
  assert.equal((missingResponse.body.error as JsonObject).code, "PROJECT_MEMBERSHIP_NOT_FOUND");

  const ended = createService({
    memberships: [createMembership({
      status: "ENDED",
      effectiveTo: "2026-08-01T00:00:00.000Z",
    })],
    permissions: { "member.remove": true },
  });
  const endedResponse = await request(
    ended.service,
    `/api/v1/projects/${projectId}/members/${membershipId}`,
    { method: "DELETE" }
  );
  assert.equal(endedResponse.status, 409);
  assert.equal((endedResponse.body.error as JsonObject).code, "PROJECT_MEMBERSHIP_EXPIRED");

  const failed = createService({
    memberships: [createMembership()],
    permissions: { "member.remove": true },
    lifecycleError: new Error("sensitive postgres failure"),
  });
  const failedResponse = await request(
    failed.service,
    `/api/v1/projects/${projectId}/members/${membershipId}`,
    { method: "DELETE" }
  );
  assert.equal(failedResponse.status, 409);
  assert.equal((failedResponse.body.error as JsonObject).code, "MEMBER_REMOVAL_NOT_PERMITTED");
  assert.doesNotMatch(
    String((failedResponse.body.error as JsonObject).message),
    /postgres|sensitive/i
  );
});


test("DELETE member accepts only optional reason provenance", async () => {
  for (const body of [
    { actor_person_id: actorPersonId },
    { correlation_id: correlationId },
    { termination_kind: "EXPIRY" },
    { effective_at: evaluatedAt },
  ]) {
    const harness = createService({
      memberships: [createMembership()],
      permissions: { "member.remove": true },
    });
    const response = await request(
      harness.service,
      `/api/v1/projects/${projectId}/members/${membershipId}`,
      {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    assert.equal(response.status, 400);
    assert.equal((response.body.error as JsonObject).code, "VALIDATION_ERROR");
    assert.equal(harness.lifecycleRepository.calls.length, 0);
  }
});

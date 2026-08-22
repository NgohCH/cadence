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


function createService(
  options: {
    memberships?:
      ProjectMembership[];

    persons?:
      CadencePerson[];

    affiliations?:
      OrganisationalAffiliation[];

    permissions?:
      Record<string, boolean>;

    roles?:
      Record<string, ProjectRole[]>;
  } = {}
): {
  service:
    ProjectMembershipService;

  admissionRepository:
    InMemoryAdmissionRepository;
} {
  const membershipRepository =
    new InMemoryMembershipRepository(
      options.memberships ?? []
    );

  const admissionRepository =
    new InMemoryAdmissionRepository();

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
  };
}


async function request(
  service:
    ProjectMembershipService,

  path: string,

  init?: RequestInit
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

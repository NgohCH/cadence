import assert from "node:assert/strict";
import test from "node:test";

import type {
  IdentityPersistenceRepository,
} from "../identity/identity.repository";

import type {
  ProjectMembershipLifecycleState,
  ProjectsMembershipLifecycleService,
} from "../projects/projects-membership-lifecycle";

import type {
  MembershipResponsibilityAssessment,
  TasksMembershipResponsibilityService,
} from "../tasks/tasks-membership-responsibility";

import type {
  ProjectMemberAdmissionRepository,
} from "./project-member-admission.repository";

import {
  ActiveResponsibilitiesExistError,
  LastRequiredRoleHolderError,
  MemberRemovalNotPermittedError,
  ProjectMembershipExpiredError,
  ProjectMembershipNotFoundError,
  ProjectMembershipPermissionDeniedError,
} from "./project-membership.errors";

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
  ProjectMembershipRepository,
} from "./project-membership.repository";

import {
  ProjectMembershipService,
} from "./project-membership.service";

import type {
  ProjectAuthorisationPort,
  ProjectRoleCommandContext,
} from "./project-membership.service";

import type {
  CreateProjectMembershipInput,
  ProjectMembership,
} from "./project-membership.types";

import type {
  ProjectRoleAssignment,
} from "./project-role.types";

import type {
  ProjectRoleManagementRepository,
} from "./project-role-management.repository";


const projectId = "11111111-1111-4111-8111-111111111111";
const otherProjectId = "22222222-2222-4222-8222-222222222222";
const membershipId = "33333333-3333-4333-8333-333333333333";
const personId = "44444444-4444-4444-8444-444444444444";
const actorPersonId = "55555555-5555-4555-8555-555555555555";
const evaluatedAt = "2026-08-24T12:00:00.000Z";
const correlationId = "66666666-6666-4666-8666-666666666666";

const context: ProjectRoleCommandContext = {
  actorPersonId,
  correlationId,
};


function membership(
  overrides: Partial<ProjectMembership> = {}
): ProjectMembership {
  return {
    id: membershipId,
    personId,
    projectId,
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    effectiveTo: null,
    status: "ACTIVE",
    grantedBy: actorPersonId,
    createdAt: "2026-01-01T00:00:00.000Z",
    terminationReason: null,
    ...overrides,
  };
}


function terminationResult(
  closedAssignments: ProjectRoleAssignment[] = []
): ProjectMembershipTerminationResult {
  return {
    outcome: "ENDED",
    membership: membership({
      status: "ENDED",
      effectiveTo: evaluatedAt,
      terminationReason: "Administrative change",
    }),
    closedAssignments,
    termination: {
      type: "ADMINISTRATIVE_REMOVAL",
      projectId,
      membershipId,
      terminatedByPersonId: actorPersonId,
      terminationReason: "Administrative change",
      correlationId,
      terminatedAt: evaluatedAt,
    },
  };
}


class MembershipRepository implements ProjectMembershipRepository {
  public findCalls = 0;
  public roleCalls = 0;

  constructor(public value: ProjectMembership | null = membership()) {}

  async findMembershipById(): Promise<ProjectMembership | null> {
    this.findCalls += 1;
    return this.value;
  }

  async listRoleAssignments(): Promise<ProjectRoleAssignment[]> {
    this.roleCalls += 1;
    return [];
  }

  async createMembership(value: CreateProjectMembershipInput): Promise<ProjectMembership> { return value; }
  async listMembershipsForProject(): Promise<ProjectMembership[]> { return []; }
  async listMembershipsForPersonInProject(): Promise<ProjectMembership[]> { return []; }
  async createRoleAssignment(value: ProjectRoleAssignment): Promise<ProjectRoleAssignment> { return value; }
}


class Authorisation implements ProjectAuthorisationPort {
  public allowed = true;
  public calls: string[] = [];

  async hasProjectPermission(
    _context: ProjectRoleCommandContext,
    _projectId: string,
    permission: string
  ): Promise<boolean> {
    this.calls.push(permission);
    return this.allowed;
  }

  async getEffectiveProjectRoles(): Promise<[]> { return []; }
}


class LifecycleRepository implements ProjectMembershipLifecycleRepository {
  public calls: AdministrativeMembershipTerminationPersistenceInput[] = [];
  public error: unknown = null;
  public response = terminationResult();

  async terminateAdministratively(
    input: AdministrativeMembershipTerminationPersistenceInput
  ): Promise<ProjectMembershipTerminationResult> {
    this.calls.push(input);
    if (this.error !== null) throw this.error;
    return this.response;
  }

  async listDueMemberships(): Promise<ProjectMembership[]> { return []; }
  async finaliseExpiry(_input: MembershipExpiryFinalisationPersistenceInput): Promise<ProjectMembershipTerminationResult> { return terminationResult(); }
  async listBoundedProtectedRoleViolations(): Promise<BoundedProtectedRoleViolation[]> { return []; }
}


class ProjectsLifecycle implements ProjectsMembershipLifecycleService {
  public state: ProjectMembershipLifecycleState | null = {
    projectId,
    status: "active",
    classification: "OPERATIONAL",
  };
  public calls = 0;

  async getMembershipLifecycleState(): Promise<ProjectMembershipLifecycleState | null> {
    this.calls += 1;
    return this.state;
  }
}


class TasksResponsibilities implements TasksMembershipResponsibilityService {
  public blocking = false;
  public calls: Array<{ projectId: string; personId: string; evaluatedAt: string }> = [];

  async assessMembershipResponsibilities(
    input: { projectId: string; personId: string; evaluatedAt: string }
  ): Promise<MembershipResponsibilityAssessment> {
    this.calls.push(input);
    return { hasBlockingResponsibilities: this.blocking };
  }
}


function harness() {
  const authorisation = new Authorisation();
  const memberships = new MembershipRepository();
  const lifecycle = new LifecycleRepository();
  const projects = new ProjectsLifecycle();
  const tasks = new TasksResponsibilities();

  const service = new ProjectMembershipService(
    authorisation,
    memberships,
    {} as ProjectMemberAdmissionRepository,
    {} as IdentityPersistenceRepository,
    {} as ProjectRoleManagementRepository,
    {
      repository: lifecycle,
      projects,
      tasks,
    },
    () => evaluatedAt,
    () => "88888888-8888-4888-8888-888888888888"
  );

  return { service, authorisation, memberships, lifecycle, projects, tasks };
}


test("Owner and Manager authority use only member.remove", async (t) => {
  for (const actorRole of ["PROJECT_OWNER", "PROJECT_MANAGER"]) {
    await t.test(actorRole, async () => {
      const h = harness();
      await h.service.removeProjectMember(context, projectId, {
        membershipId,
        reason: "Administrative change",
      });
      assert.deepEqual(h.authorisation.calls, ["member.remove"]);
      assert.equal(h.lifecycle.calls.length, 1);
    });
  }
});


test("Sponsor, Member, Observer, and Auditor denial occurs before membership disclosure", async (t) => {
  for (const role of ["PROJECT_SPONSOR", "PROJECT_MEMBER", "PROJECT_OBSERVER", "PROJECT_AUDITOR"]) {
    await t.test(role, async () => {
      const h = harness();
      h.authorisation.allowed = false;
      await assert.rejects(
        h.service.removeProjectMember(context, projectId, { membershipId, reason: null }),
        ProjectMembershipPermissionDeniedError
      );
      assert.equal(h.memberships.findCalls, 0);
      assert.equal(h.lifecycle.calls.length, 0);
    });
  }
});


test("Projects and Tasks boundaries precede the exclusive lifecycle mutation", async () => {
  const h = harness();
  const result = await h.service.removeProjectMember(context, projectId, {
    membershipId,
    reason: "  Administrative change  ",
  });

  assert.equal(result.outcome, "ENDED");
  assert.deepEqual(h.tasks.calls, [{ projectId, personId, evaluatedAt }]);
  assert.deepEqual(h.lifecycle.calls, [{
    projectId,
    membershipId,
    effectiveAt: evaluatedAt,
    terminatedByPersonId: actorPersonId,
    terminationReason: "Administrative change",
    correlationId,
  }]);
  assert.equal(h.memberships.roleCalls, 0, "service must not duplicate SQL continuity inspection");
});


test("Tasks blocker prevents lifecycle persistence", async () => {
  const h = harness();
  h.tasks.blocking = true;
  await assert.rejects(
    h.service.removeProjectMember(context, projectId, { membershipId, reason: null }),
    ActiveResponsibilitiesExistError
  );
  assert.equal(h.lifecycle.calls.length, 0);
});


test("administrative self-removal is rejected before cross-module checks", async () => {
  const h = harness();
  h.memberships.value = membership({
    personId: actorPersonId,
  });

  await assert.rejects(
    h.service.removeProjectMember(
      context,
      projectId,
      { membershipId, reason: null }
    ),
    MemberRemovalNotPermittedError
  );
  assert.equal(h.projects.calls, 0);
  assert.equal(h.tasks.calls.length, 0);
  assert.equal(h.lifecycle.calls.length, 0);
});


test("Sponsor and ordinary role history can close without service-side role interpretation", async () => {
  const h = harness();
  h.lifecycle.response = terminationResult([
    {
      id: "99999999-9999-4999-8999-999999999999",
      projectId,
      membershipId,
      role: "PROJECT_SPONSOR",
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      effectiveTo: evaluatedAt,
      assignedBy: actorPersonId,
      changeReason: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      projectId,
      membershipId,
      role: "PROJECT_MEMBER",
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      effectiveTo: evaluatedAt,
      assignedBy: actorPersonId,
      changeReason: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ]);

  const result = await h.service.removeProjectMember(
    context,
    projectId,
    { membershipId, reason: null }
  );

  assert.deepEqual(
    result.closedAssignments.map((assignment) => assignment.role),
    ["PROJECT_SPONSOR", "PROJECT_MEMBER"]
  );
  assert.equal(h.memberships.roleCalls, 0);
});


test("draft and operational projects are mutable while completed and cancelled are read-only", async (t) => {
  const cases = [
    ["draft", "MUTABLE_NON_OPERATIONAL", true],
    ["active", "OPERATIONAL", true],
    ["on_hold", "OPERATIONAL", true],
    ["completed", "LIFECYCLE_READ_ONLY", false],
    ["cancelled", "LIFECYCLE_READ_ONLY", false],
  ] as const;

  for (const [status, classification, allowed] of cases) {
    await t.test(status, async () => {
      const h = harness();
      h.projects.state = { projectId, status, classification };
      const operation = h.service.removeProjectMember(context, projectId, { membershipId, reason: null });
      if (allowed) await operation;
      else await assert.rejects(operation, MemberRemovalNotPermittedError);
      assert.equal(h.lifecycle.calls.length, allowed ? 1 : 0);
      assert.equal(h.tasks.calls.length, allowed ? 1 : 0);
    });
  }
});


test("wrong-project, future, and ended targets use stable lifecycle errors", async (t) => {
  const cases = [
    [membership({ projectId: otherProjectId }), ProjectMembershipNotFoundError],
    [membership({ effectiveFrom: "2030-01-01T00:00:00.000Z" }), MemberRemovalNotPermittedError],
    [membership({ status: "ENDED", effectiveTo: "2026-08-01T00:00:00.000Z" }), ProjectMembershipExpiredError],
  ] as const;

  for (const [target, ErrorType] of cases) {
    const h = harness();
    h.memberships.value = target;
    await assert.rejects(
      h.service.removeProjectMember(context, projectId, { membershipId, reason: null }),
      ErrorType
    );
    assert.equal(h.projects.calls, 0);
    assert.equal(h.lifecycle.calls.length, 0);
  }
});


test("Owner and Manager continuity failures retain the stable error", async (t) => {
  for (const role of ["PROJECT_OWNER", "PROJECT_MANAGER"]) {
    await t.test(role, async () => {
      const h = harness();
      h.lifecycle.error = new LastRequiredRoleHolderError();
      await assert.rejects(
        h.service.removeProjectMember(context, projectId, { membershipId, reason: null }),
        LastRequiredRoleHolderError
      );
    });
  }
});


test("unknown persistence failures are abstracted", async () => {
  const h = harness();
  h.lifecycle.error = new Error("raw postgres detail");
  await assert.rejects(
    h.service.removeProjectMember(context, projectId, { membershipId, reason: null }),
    (error: unknown) => error instanceof MemberRemovalNotPermittedError && !error.message.includes("postgres")
  );
});

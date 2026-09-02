import assert from "node:assert/strict";
import test from "node:test";

import type {
  ChangeOrdinaryRolePersistenceInput,
  ChangeOrdinaryRolePersistenceResult,
  ProjectRoleManagementRepository,
  ProjectRoleTransferRecord,
  TransferProtectedRolePersistenceInput,
  TransferProtectedRolePersistenceResult,
} from "./project-role-management.repository";
import type {
  ProjectMemberAdmissionInput,
  ProjectMemberAdmissionRepository,
  ProjectMemberAdmissionResult,
} from "./project-member-admission.repository";
import type {
  ProjectMembershipRepository,
} from "./project-membership.repository";
import type {
  ProjectMembership,
} from "./project-membership.types";
import type {
  ProjectRoleAssignment,
} from "./project-role.types";
import {
  ProjectMembershipPilotPreparationService,
} from "./pilot-preparation.service";
import type {
  PilotMembershipPreparationRequest,
  PilotOrdinaryRolePreparationRequest,
  PilotProtectedRolePreparationRequest,
} from "./pilot-preparation.types";
import type {
  ProjectRoleTransferReadRepository,
} from "./project-role-transfer-read.repository";
import type {
  ProjectRoleAssignmentReadRepository,
} from "./project-role-assignment-read.repository";


const projectId = "00440000-0000-4000-8000-000000000001";
const operatorPersonId = "00441000-0000-4000-8000-000000000001";
const personId = "00441000-0000-4000-8000-000000000002";
const membershipId = "00442000-0000-4000-8000-000000000002";
const initialRoleAssignmentId = "00443000-0000-4000-8000-000000000002";
const roleAssignmentId = "00444000-0000-4000-8000-000000000002";
const transferId = "00447000-0000-4000-8000-000000000002";
const correlationId = "00449000-0000-4000-8000-000000000001";
const effectiveFrom = "2026-09-01T00:00:00.000Z";
const effectiveAt = effectiveFrom;


function membership(): ProjectMembership {
  return {
    id: membershipId,
    projectId,
    personId,
    effectiveFrom,
    effectiveTo: null,
    status: "ACTIVE",
    grantedBy: operatorPersonId,
    createdAt: effectiveFrom,
    terminationReason: null,
  };
}


function roleAssignment(
  role: ProjectRoleAssignment["role"] = "PROJECT_MEMBER",
  id = initialRoleAssignmentId,
): ProjectRoleAssignment {
  return {
    id,
    projectId,
    membershipId,
    role,
    effectiveFrom,
    effectiveTo: null,
    assignedBy: operatorPersonId,
    changeReason: null,
    createdAt: effectiveFrom,
  };
}


function membershipRequest(
  action: "CREATE" | "REUSE" = "CREATE",
): PilotMembershipPreparationRequest {
  return {
    action,
    intent: {
      resourceKey: "membership:owner",
      membershipId,
      projectId,
      personId,
      effectiveFrom,
      effectiveTo: null,
      status: "ACTIVE",
      grantedByPersonId: operatorPersonId,
      initialRoleAssignmentId,
    },
    context: { operatorPersonId, runCorrelationId: correlationId },
  };
}


function ordinaryRequest(
  action: "CREATE" | "REUSE" = "CREATE",
  role: ProjectRoleAssignment["role"] = "PROJECT_MEMBER",
): PilotOrdinaryRolePreparationRequest {
  return {
    action,
    intent: {
      resourceKey: "role-assignment:owner",
      assignmentId: role === "PROJECT_MEMBER" ? initialRoleAssignmentId : roleAssignmentId,
      projectId,
      membershipId,
      role: role as "PROJECT_MEMBER" | "PROJECT_OBSERVER" | "PROJECT_AUDITOR",
      effectiveFrom,
      effectiveTo: null,
      assignedByPersonId: operatorPersonId,
      changeReason: null,
      ...(role !== "PROJECT_MEMBER" && action === "CREATE" ? {
        expectedPredecessor: {
          assignmentId: initialRoleAssignmentId,
          projectId,
          membershipId,
          role: "PROJECT_MEMBER" as const,
          effectiveFrom,
          effectiveTo: null,
          assignedByPersonId: operatorPersonId,
          changeReason: null,
        },
      } : {}),
    },
    context: { operatorPersonId, runCorrelationId: correlationId },
  };
}


function protectedRequest(
  action: "APPOINT" | "REUSE" = "APPOINT",
  role: "PROJECT_OWNER" | "PROJECT_MANAGER" | "PROJECT_SPONSOR" = "PROJECT_OWNER",
): PilotProtectedRolePreparationRequest {
  return {
    action,
    intent: {
      resourceKey: "protected-role:PROJECT_OWNER",
      assignmentId: roleAssignmentId,
      transferId,
      projectId,
      membershipId,
      role,
      effectiveAt,
      effectiveTo: null,
      authorisedByPersonId: operatorPersonId,
      reason: "VS004 pilot owner appointment",
    },
    context: { operatorPersonId, runCorrelationId: correlationId },
  };
}


class FakeMembershipRepository implements ProjectMembershipRepository {
  current: ProjectMembership | null = null;
  memberships: ProjectMembership[] = [];
  assignments: ProjectRoleAssignment[] = [];

  async findMembershipById(): Promise<ProjectMembership | null> {
    return this.current;
  }

  async listMembershipsForPersonInProject(): Promise<ProjectMembership[]> {
    return this.memberships;
  }

  async listMembershipsForProject(): Promise<ProjectMembership[]> { return []; }
  async createMembership(): Promise<ProjectMembership> { throw new Error("not used"); }
  async createRoleAssignment(): Promise<ProjectRoleAssignment> { throw new Error("not used"); }
  async listRoleAssignments(): Promise<ProjectRoleAssignment[]> { return this.assignments; }
}


class FakeRoleAssignmentReadRepository implements ProjectRoleAssignmentReadRepository {
  assignments: ProjectRoleAssignment[] = [];

  async listRoleAssignmentsForProject(): Promise<ProjectRoleAssignment[]> {
    return this.assignments;
  }
}


class FakeAdmissionRepository implements ProjectMemberAdmissionRepository {
  calls: ProjectMemberAdmissionInput[] = [];
  failure: Error | undefined;
  afterCall: (() => void) | undefined;
  result: ProjectMemberAdmissionResult = {
    membership: membership(),
    roleAssignment: roleAssignment(),
  };

  async addProjectMember(input: ProjectMemberAdmissionInput): Promise<ProjectMemberAdmissionResult> {
    this.calls.push(input);
    this.afterCall?.();
    if (this.failure) throw this.failure;
    return this.result;
  }
}


class FakeRoleManagementRepository implements ProjectRoleManagementRepository {
  ordinaryCalls: ChangeOrdinaryRolePersistenceInput[] = [];
  protectedCalls: TransferProtectedRolePersistenceInput[] = [];
  ordinaryFailure: Error | undefined;
  protectedFailure: Error | undefined;
  afterOrdinaryCall: (() => void) | undefined;
  afterProtectedCall: (() => void) | undefined;
  ordinaryResult: ChangeOrdinaryRolePersistenceResult = {
    closedAssignment: null,
    roleAssignment: roleAssignment("PROJECT_OBSERVER", roleAssignmentId),
  };
  protectedResult: TransferProtectedRolePersistenceResult = {
    outgoingAssignment: null,
    roleAssignment: {
      ...roleAssignment("PROJECT_OWNER", roleAssignmentId),
      changeReason: "VS004 pilot owner appointment",
    },
    transfer: {
      id: transferId,
      projectId,
      role: "PROJECT_OWNER",
      outgoingAssignmentId: null,
      incomingAssignmentId: roleAssignmentId,
      authorisedByPersonId: operatorPersonId,
      reason: "VS004 pilot owner appointment",
      correlationId,
      effectiveAt,
      createdAt: effectiveFrom,
    },
  };

  async changeOrdinaryRole(input: ChangeOrdinaryRolePersistenceInput): Promise<ChangeOrdinaryRolePersistenceResult> {
    this.ordinaryCalls.push(input);
    this.afterOrdinaryCall?.();
    if (this.ordinaryFailure) throw this.ordinaryFailure;
    return this.ordinaryResult;
  }

  async transferProtectedRole(input: TransferProtectedRolePersistenceInput): Promise<TransferProtectedRolePersistenceResult> {
    this.protectedCalls.push(input);
    this.afterProtectedCall?.();
    if (this.protectedFailure) throw this.protectedFailure;
    return this.protectedResult;
  }
}


class FakeTransferReadRepository implements ProjectRoleTransferReadRepository {
  transfers: ProjectRoleTransferRecord[] = [];
  async listProtectedRoleTransfers(): Promise<ProjectRoleTransferRecord[]> {
    return this.transfers;
  }
}


function service(): {
  service: ProjectMembershipPilotPreparationService;
  memberships: FakeMembershipRepository;
  admission: FakeAdmissionRepository;
  roles: FakeRoleManagementRepository;
  transfers: FakeTransferReadRepository;
  projectAssignments: FakeRoleAssignmentReadRepository;
} {
  const memberships = new FakeMembershipRepository();
  const admission = new FakeAdmissionRepository();
  const roles = new FakeRoleManagementRepository();
  const transfers = new FakeTransferReadRepository();
  const projectAssignments = new FakeRoleAssignmentReadRepository();
  return {
    service: new ProjectMembershipPilotPreparationService(
      memberships,
      admission,
      roles,
      transfers,
      projectAssignments,
      () => "2026-09-01T00:00:00.000Z",
    ),
    memberships,
    admission,
    roles,
    transfers,
    projectAssignments,
  };
}


test("planned Membership CREATE creates absent canonical membership with exact provenance", async () => {
  const setup = service();
  const result = await setup.service.prepareMembership(membershipRequest(),);

  assert.equal(result.actualResult, "CREATED");
  assert.equal(setup.admission.calls[0].membership.id, membershipId);
  assert.equal(setup.admission.calls[0].membership.grantedBy, operatorPersonId);
  assert.equal(setup.admission.calls[0].correlationId, correlationId);
});


test("planned Membership CREATE reuses exact race state and rejects conflicting or overlapping state", async () => {
  const setup = service();
  setup.memberships.current = membership();
  setup.memberships.memberships = [membership()];
  assert.equal((await setup.service.prepareMembership(membershipRequest())).actualResult, "REUSED");
  assert.equal(setup.admission.calls.length, 0);

  const conflict = service();
  conflict.memberships.current = { ...membership(), personId: "00441000-0000-4000-8000-000000000099" };
  await assert.rejects(conflict.service.prepareMembership(membershipRequest()), /MEMBERSHIP_CONFLICT/);

  const overlap = service();
  overlap.memberships.memberships = [{ ...membership(), id: "00442000-0000-4000-8000-000000000099" }];
  await assert.rejects(overlap.service.prepareMembership(membershipRequest()), /MEMBERSHIP_CONFLICT/);
});


test("planned Membership REUSE never creates and missing state is stale", async () => {
  const setup = service();
  await assert.rejects(setup.service.prepareMembership(membershipRequest("REUSE")), /STALE_PLAN/);
  assert.equal(setup.admission.calls.length, 0);
});


test("planned CREATE reuses exact state that appears during persistence", async () => {
  const membershipSetup = service();
  membershipSetup.admission.failure = new Error("duplicate membership");
  membershipSetup.admission.afterCall = () => {
    membershipSetup.memberships.current = membership();
  };
  assert.equal(
    (await membershipSetup.service.prepareMembership(membershipRequest())).actualResult,
    "REUSED",
  );

  const ordinarySetup = service();
  ordinarySetup.memberships.current = membership();
  ordinarySetup.memberships.assignments = [roleAssignment()];
  ordinarySetup.roles.ordinaryFailure = new Error("duplicate assignment");
  ordinarySetup.roles.afterOrdinaryCall = () => {
    ordinarySetup.memberships.assignments = [
      { ...roleAssignment(), effectiveTo: effectiveFrom },
      roleAssignment("PROJECT_OBSERVER", roleAssignmentId),
    ];
  };
  assert.equal(
    (await ordinarySetup.service.prepareOrdinaryRoleAssignment(ordinaryRequest("CREATE", "PROJECT_OBSERVER"))).actualResult,
    "REUSED",
  );

  const protectedSetup = service();
  protectedSetup.memberships.current = membership();
  protectedSetup.roles.protectedFailure = new Error("duplicate protected assignment");
  protectedSetup.roles.afterProtectedCall = () => {
    protectedSetup.projectAssignments.assignments = [{
      ...roleAssignment("PROJECT_OWNER", roleAssignmentId),
      changeReason: "VS004 pilot owner appointment",
    }];
    protectedSetup.transfers.transfers = [protectedSetup.roles.protectedResult.transfer];
  };
  assert.equal(
    (await protectedSetup.service.prepareProtectedRoleAppointment(protectedRequest())).actualResult,
    "REUSED",
  );
});


test("ordinary role preparation reuses admission-created PROJECT_MEMBER and creates exact missing ordinary role", async () => {
  const setup = service();
  setup.memberships.current = membership();
  setup.memberships.assignments = [roleAssignment()];
  assert.equal((await setup.service.prepareOrdinaryRoleAssignment(ordinaryRequest())).actualResult, "REUSED");
  assert.equal(setup.roles.ordinaryCalls.length, 0);

  const missing = service();
  missing.memberships.current = membership();
  missing.memberships.assignments = [roleAssignment()];
  missing.roles.ordinaryResult = {
    closedAssignment: { ...roleAssignment(), effectiveTo: effectiveFrom },
    roleAssignment: roleAssignment("PROJECT_OBSERVER", roleAssignmentId),
  };
  const result = await missing.service.prepareOrdinaryRoleAssignment(ordinaryRequest("CREATE", "PROJECT_OBSERVER"));
  assert.equal(result.actualResult, "CREATED");
  assert.equal(missing.roles.ordinaryCalls[0].assignmentId, roleAssignmentId);
  assert.equal(missing.roles.ordinaryCalls[0].assignedByPersonId, operatorPersonId);
});


test("an admitted PROJECT_MEMBER can be replaced by a prepared Observer predecessor", async () => {
  const setup = service();
  setup.memberships.current = membership();
  setup.memberships.assignments = [roleAssignment()];
  setup.roles.ordinaryResult = {
    closedAssignment: {
      ...roleAssignment(),
      effectiveTo: effectiveFrom,
    },
    roleAssignment: {
      ...roleAssignment("PROJECT_OBSERVER", roleAssignmentId),
      changeReason: null,
    },
  };

  const result = await setup.service.prepareOrdinaryRoleAssignment(
    ordinaryRequest("CREATE", "PROJECT_OBSERVER"),
  );

  assert.equal(result.actualResult, "CREATED");
  assert.equal(setup.roles.ordinaryCalls[0]?.assignmentId, roleAssignmentId);
  assert.equal(setup.roles.ordinaryCalls[0]?.role, "PROJECT_OBSERVER");
});


test("a CREATE Observer reuses the exact final assignment after its predecessor was closed", async () => {
  const setup = service();
  setup.memberships.current = membership();
  setup.memberships.assignments = [
    { ...roleAssignment(), effectiveTo: effectiveFrom },
    roleAssignment("PROJECT_OBSERVER", roleAssignmentId),
  ];

  const result = await setup.service.prepareOrdinaryRoleAssignment(
    ordinaryRequest("CREATE", "PROJECT_OBSERVER"),
  );

  assert.equal(result.actualResult, "REUSED");
  assert.equal(setup.roles.ordinaryCalls.length, 0);
});


test("a canonical ordinary replacement result with the declared predecessor is accepted", async () => {
  const setup = service();
  setup.memberships.current = membership();
  setup.memberships.assignments = [roleAssignment()];
  setup.roles.ordinaryResult = {
    closedAssignment: {
      ...roleAssignment(),
      effectiveTo: effectiveFrom,
    },
    roleAssignment: {
      ...roleAssignment("PROJECT_AUDITOR", roleAssignmentId),
      changeReason: null,
    },
  };

  const result = await setup.service.prepareOrdinaryRoleAssignment(
    ordinaryRequest("CREATE", "PROJECT_AUDITOR"),
  );

  assert.equal(result.actualResult, "CREATED");
});


test("an admitted PROJECT_MEMBER can be replaced by a prepared Auditor", async () => {
  const setup = service();
  setup.memberships.current = membership();
  setup.memberships.assignments = [roleAssignment()];
  setup.roles.ordinaryResult = {
    closedAssignment: { ...roleAssignment(), effectiveTo: effectiveFrom },
    roleAssignment: {
      ...roleAssignment("PROJECT_AUDITOR", roleAssignmentId),
      changeReason: null,
    },
  };

  const result = await setup.service.prepareOrdinaryRoleAssignment(
    ordinaryRequest("CREATE", "PROJECT_AUDITOR"),
  );

  assert.equal(result.actualResult, "CREATED");
});


test("ordinary replacement requires the exact declared predecessor and rejects undeclared overlap", async () => {
  const wrongId = service();
  wrongId.memberships.current = membership();
  wrongId.memberships.assignments = [roleAssignment()];
  const wrongIdRequest = ordinaryRequest("CREATE", "PROJECT_OBSERVER");
  wrongIdRequest.intent.expectedPredecessor = {
    ...wrongIdRequest.intent.expectedPredecessor!,
    assignmentId: "00443000-0000-4000-8000-000000000099",
  };
  await assert.rejects(
    wrongId.service.prepareOrdinaryRoleAssignment(wrongIdRequest),
    /ORDINARY_ROLE_CONFLICT/,
  );

  const wrongRole = service();
  wrongRole.memberships.current = membership();
  wrongRole.memberships.assignments = [roleAssignment()];
  const wrongRoleRequest = ordinaryRequest("CREATE", "PROJECT_OBSERVER");
  wrongRoleRequest.intent.expectedPredecessor = {
    ...wrongRoleRequest.intent.expectedPredecessor!,
    role: "PROJECT_AUDITOR",
  };
  await assert.rejects(
    wrongRole.service.prepareOrdinaryRoleAssignment(wrongRoleRequest),
    /ORDINARY_ROLE_CONFLICT/,
  );

  const wrongPeriod = service();
  wrongPeriod.memberships.current = membership();
  wrongPeriod.memberships.assignments = [roleAssignment()];
  const wrongPeriodRequest = ordinaryRequest("CREATE", "PROJECT_OBSERVER");
  wrongPeriodRequest.intent.expectedPredecessor = {
    ...wrongPeriodRequest.intent.expectedPredecessor!,
    effectiveFrom: "2026-09-02T00:00:00.000Z",
  };
  await assert.rejects(
    wrongPeriod.service.prepareOrdinaryRoleAssignment(wrongPeriodRequest),
    /ORDINARY_ROLE_CONFLICT/,
  );

  const undeclared = service();
  undeclared.memberships.current = membership();
  undeclared.memberships.assignments = [roleAssignment()];
  const undeclaredRequest = ordinaryRequest("CREATE", "PROJECT_OBSERVER");
  undeclaredRequest.intent.expectedPredecessor = undefined;
  await assert.rejects(
    undeclared.service.prepareOrdinaryRoleAssignment(undeclaredRequest),
    /ORDINARY_ROLE_CONFLICT/,
  );

  const unrelated = service();
  unrelated.memberships.current = membership();
  unrelated.memberships.assignments = [
    roleAssignment(),
    {
      ...roleAssignment("PROJECT_AUDITOR", "00444000-0000-4000-8000-000000000099"),
      changeReason: "Unrelated overlapping role",
    },
  ];
  await assert.rejects(
    unrelated.service.prepareOrdinaryRoleAssignment(ordinaryRequest("CREATE", "PROJECT_OBSERVER")),
    /ORDINARY_ROLE_CONFLICT/,
  );
});


test("ordinary replacement rejects a persistence result that closes the wrong predecessor", async () => {
  const setup = service();
  setup.memberships.current = membership();
  setup.memberships.assignments = [roleAssignment()];
  setup.roles.ordinaryResult = {
    closedAssignment: {
      ...roleAssignment(),
      role: "PROJECT_AUDITOR",
      effectiveTo: effectiveFrom,
    },
    roleAssignment: roleAssignment("PROJECT_OBSERVER", roleAssignmentId),
  };

  await assert.rejects(
    setup.service.prepareOrdinaryRoleAssignment(ordinaryRequest("CREATE", "PROJECT_OBSERVER")),
    /ORDINARY_ROLE_CONFLICT/,
  );
});


test("ordinary role REUSE is read-only and conflicting/overlapping roles fail closed", async () => {
  const setup = service();
  setup.memberships.current = membership();
  await assert.rejects(setup.service.prepareOrdinaryRoleAssignment(ordinaryRequest("REUSE")), /STALE_PLAN/);
  assert.equal(setup.roles.ordinaryCalls.length, 0);

  const conflict = service();
  conflict.memberships.current = membership();
  conflict.memberships.assignments = [roleAssignment("PROJECT_OBSERVER", initialRoleAssignmentId)];
  await assert.rejects(conflict.service.prepareOrdinaryRoleAssignment(ordinaryRequest()), /ORDINARY_ROLE_CONFLICT/);
  assert.equal(conflict.roles.ordinaryCalls.length, 0);
});


test("ordinary role REUSE reuses an exact canonical assignment", async () => {
  const setup = service();
  setup.memberships.current = membership();
  setup.memberships.assignments = [roleAssignment("PROJECT_OBSERVER", roleAssignmentId)];

  const result = await setup.service.prepareOrdinaryRoleAssignment(
    ordinaryRequest("REUSE", "PROJECT_OBSERVER"),
  );

  assert.equal(result.actualResult, "REUSED");
  assert.equal(setup.roles.ordinaryCalls.length, 0);
});


test("protected APPOINT creates only a first appointment and never accepts transfer reconciliation", async () => {
  const setup = service();
  setup.memberships.current = membership();
  const result = await setup.service.prepareProtectedRoleAppointment(protectedRequest());
  assert.equal(result.actualResult, "CREATED");
  assert.equal(setup.roles.protectedCalls.length, 1);
  assert.equal(setup.roles.protectedCalls[0].incomingMembershipId, membershipId);
  assert.equal(setup.roles.protectedCalls[0].authorisedByPersonId, operatorPersonId);
  assert.equal(setup.roles.protectedCalls[0].correlationId, correlationId);
});


test("protected APPOINT reuses exact holder/history and rejects different or contradictory state", async () => {
  const setup = service();
  setup.memberships.current = membership();
  setup.projectAssignments.assignments = [{
    ...roleAssignment("PROJECT_OWNER", roleAssignmentId),
    changeReason: "VS004 pilot owner appointment",
  }];
  setup.transfers.transfers = [setup.roles.protectedResult.transfer];
  assert.equal((await setup.service.prepareProtectedRoleAppointment(protectedRequest())).actualResult, "REUSED");
  assert.equal(setup.roles.protectedCalls.length, 0);

  const different = service();
  different.memberships.current = membership();
  different.projectAssignments.assignments = [{ ...roleAssignment("PROJECT_OWNER", roleAssignmentId), membershipId: "00442000-0000-4000-8000-000000000099" }];
  await assert.rejects(different.service.prepareProtectedRoleAppointment(protectedRequest()), /PROTECTED_ROLE_CONFLICT/);

  const history = service();
  history.memberships.current = membership();
  history.projectAssignments.assignments = [roleAssignment("PROJECT_OWNER", "00444000-0000-4000-8000-000000000099")];
  await assert.rejects(history.service.prepareProtectedRoleAppointment(protectedRequest()), /PROTECTED_ROLE_CONFLICT/);
});


test("protected REUSE is read-only and missing state is stale", async () => {
  const setup = service();
  setup.memberships.current = membership();
  await assert.rejects(setup.service.prepareProtectedRoleAppointment(protectedRequest("REUSE")), /STALE_PLAN/);
  assert.equal(setup.roles.protectedCalls.length, 0);
});


test("protected REUSE reuses exact holder and rejects multiple project holders", async () => {
  const setup = service();
  setup.memberships.current = membership();
  setup.projectAssignments.assignments = [{
    ...roleAssignment("PROJECT_OWNER", roleAssignmentId),
    changeReason: "VS004 pilot owner appointment",
  }];
  setup.transfers.transfers = [setup.roles.protectedResult.transfer];

  const result = await setup.service.prepareProtectedRoleAppointment(
    protectedRequest("REUSE"),
  );
  assert.equal(result.actualResult, "REUSED");
  assert.equal(setup.roles.protectedCalls.length, 0);

  const multiple = service();
  multiple.memberships.current = membership();
  multiple.projectAssignments.assignments = [
    {
      ...roleAssignment("PROJECT_OWNER", roleAssignmentId),
      changeReason: "VS004 pilot owner appointment",
    },
    {
      ...roleAssignment("PROJECT_OWNER", "00444000-0000-4000-8000-000000000099"),
      membershipId: "00442000-0000-4000-8000-000000000099",
      changeReason: "Conflicting owner appointment",
    },
  ];
  await assert.rejects(
    multiple.service.prepareProtectedRoleAppointment(protectedRequest()),
    /PROTECTED_ROLE_CONFLICT/,
  );
  assert.equal(multiple.roles.protectedCalls.length, 0);
});


test("persistence failures and unexpected protected outgoing assignment are safe failures", async () => {
  const membershipSetup = service();
  membershipSetup.admission.failure = new Error("database password leaked");
  await assert.rejects(
    membershipSetup.service.prepareMembership(membershipRequest()),
    (error: unknown) => {
      assert.match((error as Error).message, /PERSISTENCE_FAILURE/);
      assert.doesNotMatch((error as Error).message, /password/);
      return true;
    },
  );

  const protectedSetup = service();
  protectedSetup.memberships.current = membership();
  protectedSetup.roles.protectedResult = {
    ...protectedSetup.roles.protectedResult,
    outgoingAssignment: roleAssignment("PROJECT_OWNER", "00444000-0000-4000-8000-000000000099"),
  };
  await assert.rejects(protectedSetup.service.prepareProtectedRoleAppointment(protectedRequest()), /PROTECTED_ROLE_CONFLICT/);
});


test("preparation evidence is credential-free and retains operator/correlation", async () => {
  const setup = service();
  const result = await setup.service.prepareMembership(membershipRequest());
  assert.equal(result.operatorPersonId, operatorPersonId);
  assert.equal(result.runCorrelationId, correlationId);
  assert.doesNotMatch(JSON.stringify(result), /password|secret|token|user_id|role_id|joined_at|created_by/i);
});

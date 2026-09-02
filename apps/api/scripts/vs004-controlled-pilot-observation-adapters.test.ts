import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  AdministrativeAuthAccount,
  AdministrativeAuthLookup,
  AdministrativeAuthProvider,
} from "../src/infrastructure/auth/administrative-auth-provider";
import type {
  ProjectMembershipRepository,
} from "../src/modules/project-membership/project-membership.repository";
import type {
  ProjectRoleAssignmentReadRepository,
} from "../src/modules/project-membership/project-role-assignment-read.repository";
import type {
  ProjectRoleTransferReadRepository,
} from "../src/modules/project-membership/project-role-transfer-read.repository";
import type {
  ProjectMembershipPilotObservationRepository,
} from "../src/modules/project-membership/pilot-observation.repository";
import type {
  ProjectMembership,
} from "../src/modules/project-membership/project-membership.types";
import type {
  ProjectRoleAssignment,
} from "../src/modules/project-membership/project-role.types";
import type {
  ProjectRoleTransferRecord,
} from "../src/modules/project-membership/project-role-management.repository";
import {
  createMembershipPilotObservationSource,
  createReadOnlyAuthAccountReader,
} from "./vs004-controlled-pilot-observation-adapters";


const projectId = "00640000-0000-4000-8000-000000000001";
const membershipId = "00642000-0000-4000-8000-000000000001";
const assignmentId = "00644000-0000-4000-8000-000000000001";
const transferId = "00646000-0000-4000-8000-000000000001";

const membership: ProjectMembership = {
  id: membershipId,
  projectId,
  personId: "00641000-0000-4000-8000-000000000001",
  effectiveFrom: "2026-09-02T00:00:00.000Z",
  effectiveTo: null,
  status: "ACTIVE",
  grantedBy: "00641000-0000-4000-8000-000000000002",
  createdAt: "2026-09-02T00:00:00.000Z",
  terminationReason: null,
};

const assignment: ProjectRoleAssignment = {
  id: assignmentId,
  projectId,
  membershipId: "00642000-0000-4000-8000-000000000099",
  role: "PROJECT_MEMBER",
  effectiveFrom: "2026-09-02T00:00:00.000Z",
  effectiveTo: null,
  assignedBy: "00641000-0000-4000-8000-000000000002",
  changeReason: null,
  createdAt: "2026-09-02T00:00:00.000Z",
};

const transfer: ProjectRoleTransferRecord = {
  id: transferId,
  projectId,
  role: "PROJECT_OWNER",
  outgoingAssignmentId: null,
  incomingAssignmentId: assignmentId,
  authorisedByPersonId: "00641000-0000-4000-8000-000000000002",
  reason: "initial appointment",
  correlationId: "00648000-0000-4000-8000-000000000001",
  effectiveAt: "2026-09-02T00:00:00.000Z",
  createdAt: "2026-09-02T00:00:00.000Z",
};


test("maps all membership observation reads to their owning read ports", async () => {
  const calls: string[] = [];
  const memberships: Pick<
    ProjectMembershipRepository,
    "listMembershipsForProject"
  > = {
    listMembershipsForProject: async (requestedProjectId) => {
      calls.push(`memberships:${requestedProjectId}`);
      return [membership];
    },
  };
  const roleAssignments: Pick<
    ProjectRoleAssignmentReadRepository,
    "listRoleAssignmentsForProject"
  > = {
    listRoleAssignmentsForProject: async (requestedProjectId) => {
      calls.push(`assignments:${requestedProjectId}`);
      return [assignment];
    },
  };
  const protectedTransfers: Pick<
    ProjectRoleTransferReadRepository,
    "listProtectedRoleTransfers"
  > = {
    listProtectedRoleTransfers: async (requestedProjectId) => {
      calls.push(`transfers:${requestedProjectId}`);
      return [transfer];
    },
  };

  const source: ProjectMembershipPilotObservationRepository =
    createMembershipPilotObservationSource({
      memberships,
      roleAssignments,
      protectedTransfers,
    });

  assert.deepEqual(await source.listMembershipsForProject(projectId), [membership]);
  assert.deepEqual(await source.listRoleAssignmentsForProject(projectId), [assignment]);
  assert.deepEqual(await source.listProtectedRoleTransfers(projectId), [transfer]);
  assert.deepEqual(calls, [
    `memberships:${projectId}`,
    `assignments:${projectId}`,
    `transfers:${projectId}`,
  ]);
});


test("preserves project-wide orphan assignments for 04A", async () => {
  const orphanAssignment: ProjectRoleAssignment = {
    ...assignment,
    id: "00644000-0000-4000-8000-000000000099",
    membershipId: "00642000-0000-4000-8000-000000000099",
  };
  const source = createMembershipPilotObservationSource({
    memberships: {
      listMembershipsForProject: async () => [membership],
    },
    roleAssignments: {
      listRoleAssignmentsForProject: async () => [orphanAssignment],
    },
    protectedTransfers: {
      listProtectedRoleTransfers: async () => [],
    },
  });

  assert.deepEqual(
    await source.listRoleAssignmentsForProject(projectId),
    [orphanAssignment],
  );
});


test("passes project IDs unchanged and propagates read failures", async () => {
  const requestedProjectIds: string[] = [];
  const expectedFailure = new Error("role read failed");
  const source = createMembershipPilotObservationSource({
    memberships: {
      listMembershipsForProject: async (requestedProjectId) => {
        requestedProjectIds.push(requestedProjectId);
        return [];
      },
    },
    roleAssignments: {
      listRoleAssignmentsForProject: async (requestedProjectId) => {
        requestedProjectIds.push(requestedProjectId);
        throw expectedFailure;
      },
    },
    protectedTransfers: {
      listProtectedRoleTransfers: async (requestedProjectId) => {
        requestedProjectIds.push(requestedProjectId);
        return [];
      },
    },
  });

  await source.listMembershipsForProject(projectId);
  await assert.rejects(
    source.listRoleAssignmentsForProject(projectId),
    (error: unknown) => error === expectedFailure,
  );
  await source.listProtectedRoleTransfers(projectId);
  assert.deepEqual(requestedProjectIds, [projectId, projectId, projectId]);
});


test("exposes only the three read-only membership methods", () => {
  const source = createMembershipPilotObservationSource({
    memberships: { listMembershipsForProject: async () => [] },
    roleAssignments: { listRoleAssignmentsForProject: async () => [] },
    protectedTransfers: { listProtectedRoleTransfers: async () => [] },
  });

  assert.deepEqual(Object.keys(source).sort(), [
    "listMembershipsForProject",
    "listProtectedRoleTransfers",
    "listRoleAssignmentsForProject",
  ]);
  for (const prohibited of [
    "create",
    "insert",
    "update",
    "upsert",
    "delete",
    "save",
    "execute",
    "rpc",
  ]) {
    assert.equal(prohibited in source, false, prohibited);
  }
});


test("maps Auth observation without exposing account creation", async () => {
  const lookup: AdministrativeAuthLookup = {
    provider: "entra",
    loginIdentifier: "pilot@example.test",
    providerSubjectId: "provider-subject",
  };
  const account: AdministrativeAuthAccount = {
    provider: lookup.provider,
    providerSubjectId: lookup.providerSubjectId!,
    loginIdentifier: lookup.loginIdentifier,
    status: "active",
  };
  let receivedLookup: AdministrativeAuthLookup | undefined;
  const provider: Pick<AdministrativeAuthProvider, "findAccounts"> = {
    findAccounts: async (received) => {
      receivedLookup = received;
      return [account];
    },
  };

  const reader = createReadOnlyAuthAccountReader(provider);

  assert.deepEqual(await reader.findAccounts(lookup), [account]);
  assert.deepEqual(receivedLookup, lookup);
  assert.equal("createAccount" in reader, false);
});

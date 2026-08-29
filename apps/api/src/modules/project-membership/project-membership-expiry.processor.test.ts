import assert from "node:assert/strict";
import test from "node:test";

import {
  LastRequiredRoleHolderError,
} from "./project-membership.errors";

import {
  ProjectMembershipExpiryProcessor,
} from "./project-membership-expiry.processor";

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
  ProjectMembership,
} from "./project-membership.types";


const now = "2026-08-24T12:00:00.000Z";
const boundary = "2026-08-24T10:00:00.000Z";


function membership(overrides: Partial<ProjectMembership> = {}): ProjectMembership {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    personId: "22222222-2222-4222-8222-222222222222",
    projectId: "33333333-3333-4333-8333-333333333333",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    effectiveTo: boundary,
    status: "ACTIVE",
    grantedBy: "44444444-4444-4444-8444-444444444444",
    createdAt: "2026-01-01T00:00:00.000Z",
    terminationReason: null,
    ...overrides,
  };
}


function result(outcome: "ENDED" | "ALREADY_ENDED" = "ENDED"): ProjectMembershipTerminationResult {
  const due = membership({ status: "ENDED" });
  return {
    outcome,
    membership: due,
    closedAssignments: [],
    termination: {
      type: "EXPIRY",
      projectId: due.projectId,
      membershipId: due.id,
      terminatedByPersonId: null,
      terminationReason: null,
      correlationId: "55555555-5555-4555-8555-555555555555",
      terminatedAt: now,
    },
  };
}


class Repository implements ProjectMembershipLifecycleRepository {
  public due: ProjectMembership[] = [];
  public calls: MembershipExpiryFinalisationPersistenceInput[] = [];
  public response = result();
  public error: unknown = null;
  public evaluatedAt: string | null = null;

  async listDueMemberships(evaluatedAt: string): Promise<ProjectMembership[]> {
    this.evaluatedAt = evaluatedAt;
    return this.due;
  }

  async finaliseExpiry(input: MembershipExpiryFinalisationPersistenceInput): Promise<ProjectMembershipTerminationResult> {
    this.calls.push(input);
    if (this.error !== null) throw this.error;
    return this.response;
  }

  async terminateAdministratively(_input: AdministrativeMembershipTerminationPersistenceInput): Promise<ProjectMembershipTerminationResult> { return result(); }
  async listBoundedProtectedRoleViolations(): Promise<BoundedProtectedRoleViolation[]> { return []; }
}


function processor(repository: Repository) {
  return new ProjectMembershipExpiryProcessor(
    repository,
    () => now,
    () => "55555555-5555-4555-8555-555555555555"
  );
}


test("due membership is finalised with system provenance inputs and original boundary preserved", async () => {
  const repository = new Repository();
  repository.due = [membership()];
  const processed = await processor(repository).processDueMemberships();

  assert.equal(repository.evaluatedAt, now);
  assert.deepEqual(repository.calls, [{
    projectId: membership().projectId,
    membershipId: membership().id,
    finalisedAt: now,
    terminationReason: null,
    correlationId: "55555555-5555-4555-8555-555555555555",
  }]);
  assert.equal(processed.finalised[0]?.membership.effectiveTo, boundary);
  assert.equal(processed.finalised[0]?.termination.terminatedByPersonId, null);
});


test("not-due candidates are not mutated", async () => {
  const repository = new Repository();
  repository.due = [membership({ effectiveTo: "2030-01-01T00:00:00.000Z" })];
  const processed = await processor(repository).processDueMemberships();
  assert.deepEqual(processed, { finalised: [], conflicts: [] });
  assert.equal(repository.calls.length, 0);
});


test("idempotent repository retry retains ALREADY_ENDED result", async () => {
  const repository = new Repository();
  repository.due = [membership()];
  repository.response = result("ALREADY_ENDED");
  const processed = await processor(repository).processDueMemberships();
  assert.equal(processed.finalised[0]?.outcome, "ALREADY_ENDED");
  assert.equal(processed.finalised[0]?.termination.correlationId, "55555555-5555-4555-8555-555555555555");
});


test("protected continuity conflict is surfaced for administrative resolution", async () => {
  const repository = new Repository();
  repository.due = [membership()];
  repository.error = new LastRequiredRoleHolderError();
  const processed = await processor(repository).processDueMemberships();
  assert.deepEqual(processed.finalised, []);
  assert.deepEqual(processed.conflicts, [{
    projectId: membership().projectId,
    membershipId: membership().id,
    code: "LAST_REQUIRED_ROLE_HOLDER",
  }]);
});


test("unexpected expiry persistence failures are not swallowed", async () => {
  const repository = new Repository();
  repository.due = [membership()];
  repository.error = new Error("persistence unavailable");
  await assert.rejects(
    processor(repository).processDueMemberships(),
    /persistence unavailable/
  );
});

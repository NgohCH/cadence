import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  LastRequiredRoleHolderError,
  MemberRemovalNotPermittedError,
  ProjectMembershipExpiredError,
  ProjectMembershipNotFoundError,
} from "../../modules/project-membership/project-membership.errors";

import {
  SupabaseProjectMembershipLifecycleRepository,
} from "./supabase-project-membership-lifecycle.repository";


const projectId = "11111111-1111-4111-8111-111111111111";
const membershipId = "22222222-2222-4222-8222-222222222222";
const personId = "33333333-3333-4333-8333-333333333333";
const actorId = "44444444-4444-4444-8444-444444444444";
const correlationId = "55555555-5555-4555-8555-555555555555";
const endedAt = "2026-08-24T12:00:00.000Z";


type RpcResponse = {
  data: unknown;
  error: { message: string } | null;
};


class FakeSupabaseClient {
  public readonly calls: Array<{
    name: string;
    args: Record<string, unknown>;
  }> = [];

  constructor(private readonly response: RpcResponse) {}

  async rpc(
    name: string,
    args: Record<string, unknown>
  ): Promise<RpcResponse> {
    this.calls.push({ name, args });
    return this.response;
  }
}


function client(fake: FakeSupabaseClient): SupabaseClient {
  return fake as unknown as SupabaseClient;
}


class DueMembershipQuery {
  public readonly calls: Array<unknown[]> = [];

  constructor(private readonly response: RpcResponse) {}

  select(columns: string): this { this.calls.push(["select", columns]); return this; }
  eq(column: string, value: unknown): this { this.calls.push(["eq", column, value]); return this; }
  not(column: string, operator: string, value: unknown): this { this.calls.push(["not", column, operator, value]); return this; }
  lte(column: string, value: unknown): this { this.calls.push(["lte", column, value]); return this; }
  order(column: string, options: unknown): this { this.calls.push(["order", column, options]); return this; }

  then<TResult1 = RpcResponse>(
    onfulfilled?: ((value: RpcResponse) => TResult1 | PromiseLike<TResult1>) | null
  ): Promise<TResult1> {
    return Promise.resolve(this.response).then(onfulfilled ?? undefined);
  }
}


class DueMembershipClient {
  public readonly query: DueMembershipQuery;
  public table: string | null = null;

  constructor(response: RpcResponse) {
    this.query = new DueMembershipQuery(response);
  }

  from(table: string): DueMembershipQuery {
    this.table = table;
    return this.query;
  }
}


function lifecycleRow(
  options: {
    outcome?: "ENDED" | "ALREADY_ENDED";
    kind?: "ADMINISTRATIVE_REMOVAL" | "EXPIRY";
    actor?: string | null;
    effectiveTo?: string;
    terminatedAt?: string;
  } = {}
) {
  const kind = options.kind ?? "ADMINISTRATIVE_REMOVAL";
  const effectiveTo = options.effectiveTo ?? endedAt;

  return {
    lifecycle_outcome: options.outcome ?? "ENDED",
    result_membership_id: membershipId,
    result_person_id: personId,
    result_project_id: projectId,
    result_effective_from: "2026-01-01T00:00:00.000Z",
    result_effective_to: effectiveTo,
    result_membership_status: "ENDED",
    result_granted_by_person_id: actorId,
    result_created_at: "2026-01-01T00:00:00.000Z",
    result_termination_kind: kind,
    result_terminated_by_person_id:
      options.actor === undefined
        ? (kind === "EXPIRY" ? null : actorId)
        : options.actor,
    result_termination_reason: "Lifecycle reason",
    result_termination_correlation_id: correlationId,
    result_terminated_at: options.terminatedAt ?? endedAt,
    closed_assignments: [{
      id: "66666666-6666-4666-8666-666666666666",
      project_id: projectId,
      membership_id: membershipId,
      role: "PROJECT_SPONSOR",
      effective_from: "2026-01-01T00:00:00.000Z",
      effective_to: effectiveTo,
      assigned_by_person_id: actorId,
      change_reason: null,
      created_at: "2026-01-01T00:00:00.000Z",
    }],
  };
}


test("due-membership discovery is lifecycle-owned, bounded, and read-only", async () => {
  const fake = new DueMembershipClient({
    data: [{
      id: membershipId,
      person_id: personId,
      project_id: projectId,
      effective_from: "2026-01-01T00:00:00.000Z",
      effective_to: endedAt,
      membership_status: "ACTIVE",
      granted_by_person_id: actorId,
      created_at: "2026-01-01T00:00:00.000Z",
      termination_reason: null,
    }],
    error: null,
  });
  const repository = new SupabaseProjectMembershipLifecycleRepository(
    fake as unknown as SupabaseClient
  );

  const due = await repository.listDueMemberships(endedAt);

  assert.equal(fake.table, "project_memberships");
  assert.deepEqual(fake.query.calls.slice(1), [
    ["eq", "membership_status", "ACTIVE"],
    ["not", "effective_to", "is", null],
    ["lte", "effective_to", endedAt],
    ["order", "effective_to", { ascending: true }],
    ["order", "id", { ascending: true }],
  ]);
  assert.equal(due[0]?.id, membershipId);
  assert.equal(due[0]?.effectiveTo, endedAt);
});


test("administrative termination uses one RPC and maps preserved history and provenance", async () => {
  const fake = new FakeSupabaseClient({ data: [lifecycleRow()], error: null });
  const repository = new SupabaseProjectMembershipLifecycleRepository(client(fake));

  const result = await repository.terminateAdministratively({
    projectId,
    membershipId,
    effectiveAt: endedAt,
    terminatedByPersonId: actorId,
    terminationReason: "Lifecycle reason",
    correlationId,
  });

  assert.deepEqual(fake.calls, [{
    name: "terminate_project_membership",
    args: {
      p_project_id: projectId,
      p_membership_id: membershipId,
      p_effective_at: endedAt,
      p_terminated_by_person_id: actorId,
      p_termination_reason: "Lifecycle reason",
      p_correlation_id: correlationId,
    },
  }]);
  assert.equal(result.outcome, "ENDED");
  assert.equal(result.membership.status, "ENDED");
  assert.equal(result.closedAssignments[0]?.role, "PROJECT_SPONSOR");
  assert.equal(result.closedAssignments[0]?.effectiveTo, endedAt);
  assert.deepEqual(result.termination, {
    type: "ADMINISTRATIVE_REMOVAL",
    projectId,
    membershipId,
    terminatedByPersonId: actorId,
    terminationReason: "Lifecycle reason",
    correlationId,
    terminatedAt: endedAt,
  });
});


test("expiry finalisation preserves expiry boundary and nullable system actor", async () => {
  const boundary = "2026-08-01T00:00:00.000Z";
  const finalizedAt = "2026-08-24T12:00:00.000Z";
  const fake = new FakeSupabaseClient({
    data: [lifecycleRow({ kind: "EXPIRY", effectiveTo: boundary, terminatedAt: finalizedAt })],
    error: null,
  });
  const repository = new SupabaseProjectMembershipLifecycleRepository(client(fake));

  const result = await repository.finaliseExpiry({
    projectId,
    membershipId,
    finalisedAt: finalizedAt,
    terminationReason: "Lifecycle reason",
    correlationId,
  });

  assert.equal(fake.calls[0]?.name, "finalize_project_membership_expiry");
  assert.equal(result.membership.effectiveTo, boundary);
  assert.equal(result.closedAssignments[0]?.effectiveTo, boundary);
  assert.equal(result.termination.type, "EXPIRY");
  assert.equal(result.termination.terminatedByPersonId, null);
  assert.equal(result.termination.terminatedAt, finalizedAt);
});


test("idempotent result returns original lifecycle provenance", async () => {
  const originalTime = "2026-08-20T10:00:00.000Z";
  const fake = new FakeSupabaseClient({
    data: [lifecycleRow({ outcome: "ALREADY_ENDED", terminatedAt: originalTime })],
    error: null,
  });
  const repository = new SupabaseProjectMembershipLifecycleRepository(client(fake));

  const result = await repository.terminateAdministratively({
    projectId,
    membershipId,
    effectiveAt: endedAt,
    terminatedByPersonId: actorId,
    terminationReason: "Lifecycle reason",
    correlationId,
  });

  assert.equal(result.outcome, "ALREADY_ENDED");
  assert.equal(result.termination.terminatedAt, originalTime);
  assert.equal(result.termination.correlationId, correlationId);
});


test("bounded Owner and Manager violation query maps only business identifiers", async () => {
  const fake = new FakeSupabaseClient({
    data: [{
      project_id: projectId,
      membership_id: membershipId,
      assignment_id: "66666666-6666-4666-8666-666666666666",
      role: "PROJECT_MANAGER",
      membership_effective_to: endedAt,
      ignored_database_column: "not exposed",
    }],
    error: null,
  });
  const repository = new SupabaseProjectMembershipLifecycleRepository(client(fake));

  const result = await repository.listBoundedProtectedRoleViolations(endedAt);

  assert.deepEqual(fake.calls, [{
    name: "list_bounded_protected_role_violations",
    args: { p_evaluated_at: endedAt },
  }]);
  assert.deepEqual(result, [{
    projectId,
    membershipId,
    assignmentId: "66666666-6666-4666-8666-666666666666",
    role: "PROJECT_MANAGER",
    membershipEffectiveTo: endedAt,
  }]);
});


for (const [message, ErrorType] of [
  ["PROJECT_MEMBERSHIP_NOT_FOUND", ProjectMembershipNotFoundError],
  ["PROJECT_MEMBERSHIP_EXPIRED", ProjectMembershipExpiredError],
  ["LAST_REQUIRED_ROLE_HOLDER", LastRequiredRoleHolderError],
  ["MEMBER_REMOVAL_NOT_PERMITTED", MemberRemovalNotPermittedError],
] as const) {
  test(`maps ${message} to a stable lifecycle error`, async () => {
    const fake = new FakeSupabaseClient({ data: null, error: { message } });
    const repository = new SupabaseProjectMembershipLifecycleRepository(client(fake));

    await assert.rejects(
      repository.terminateAdministratively({
        projectId,
        membershipId,
        effectiveAt: endedAt,
        terminatedByPersonId: actorId,
        terminationReason: null,
        correlationId,
      }),
      ErrorType
    );
  });
}

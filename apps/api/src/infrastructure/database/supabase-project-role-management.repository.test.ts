import assert from "node:assert/strict";

import test from "node:test";

import type {
  SupabaseClient,
} from "@supabase/supabase-js";

import {
  ProjectRoleAssignmentInvalidError,
  ProjectRoleTransferRequiredError,
} from "../../modules/project-membership/project-membership.errors";

import {
  SupabaseProjectRoleManagementRepository,
} from "./supabase-project-role-management.repository";


const projectId =
  "11111111-1111-4111-8111-111111111111";
const membershipId =
  "22222222-2222-4222-8222-222222222222";
const incomingMembershipId =
  "33333333-3333-4333-8333-333333333333";
const assignmentId =
  "44444444-4444-4444-8444-444444444444";
const outgoingAssignmentId =
  "55555555-5555-4555-8555-555555555555";
const transferId =
  "66666666-6666-4666-8666-666666666666";
const actorPersonId =
  "77777777-7777-4777-8777-777777777777";
const correlationId =
  "88888888-8888-4888-8888-888888888888";
const effectiveAt =
  "2026-08-22T12:00:00.000Z";
const membershipEnd =
  "2026-12-31T00:00:00.000Z";
const createdAt =
  "2026-08-22T12:00:00.000Z";


type RpcResponse = {
  data: unknown;
  error: { message: string } | null;
};


class FakeSupabaseClient {
  public readonly calls: Array<{
    name: string;
    args: Record<string, unknown>;
  }> = [];


  constructor(
    private readonly response: RpcResponse
  ) {}


  async rpc(
    name: string,
    args: Record<string, unknown>
  ): Promise<RpcResponse> {
    this.calls.push({ name, args });
    return this.response;
  }
}


function asSupabaseClient(
  fake: FakeSupabaseClient
): SupabaseClient {
  return fake as unknown as SupabaseClient;
}


function assignmentColumns(
  prefix: "closed_assignment" | "new_assignment",
  options: {
    id: string | null;
    membership: string | null;
    role: string | null;
    from: string | null;
    to: string | null;
  }
): Record<string, unknown> {
  const present = options.id !== null;

  return {
    [`${prefix}_id`]: options.id,
    [`${prefix}_project_id`]: present ? projectId : null,
    [`${prefix}_membership_id`]: options.membership,
    [`${prefix}_role`]: options.role,
    [`${prefix}_effective_from`]: options.from,
    [`${prefix}_effective_to`]: options.to,
    [`${prefix}_assigned_by_person_id`]:
      present ? actorPersonId : null,
    [`${prefix}_change_reason`]:
      present ? "Role changed" : null,
    [`${prefix}_created_at`]: present ? createdAt : null,
  };
}


function ordinaryRow(
  closed = true
): Record<string, unknown> {
  return {
    ...assignmentColumns(
      "closed_assignment",
      closed
        ? {
            id: outgoingAssignmentId,
            membership: membershipId,
            role: "PROJECT_MEMBER",
            from: "2026-01-01T00:00:00.000Z",
            to: effectiveAt,
          }
        : {
            id: null,
            membership: null,
            role: null,
            from: null,
            to: null,
          }
    ),
    ...assignmentColumns(
      "new_assignment",
      {
        id: assignmentId,
        membership: membershipId,
        role: "PROJECT_OBSERVER",
        from: effectiveAt,
        to: membershipEnd,
      }
    ),
  };
}


test(
  "ordinary role repository calls one transactional RPC and maps closed history",
  async () => {
    const fake = new FakeSupabaseClient({
      data: [ordinaryRow()],
      error: null,
    });
    const repository =
      new SupabaseProjectRoleManagementRepository(
        asSupabaseClient(fake)
      );

    const result = await repository.changeOrdinaryRole({
      assignmentId,
      projectId,
      membershipId,
      role: "PROJECT_OBSERVER",
      effectiveAt,
      assignedByPersonId: actorPersonId,
      changeReason: "Role changed",
      createdAt,
    });

    assert.deepEqual(fake.calls, [{
      name: "change_project_ordinary_role",
      args: {
        p_assignment_id: assignmentId,
        p_project_id: projectId,
        p_membership_id: membershipId,
        p_role: "PROJECT_OBSERVER",
        p_effective_at: effectiveAt,
        p_assigned_by_person_id: actorPersonId,
        p_change_reason: "Role changed",
        p_created_at: createdAt,
      },
    }]);
    assert.equal(
      result.closedAssignment?.id,
      outgoingAssignmentId
    );
    assert.equal(
      result.closedAssignment?.effectiveTo,
      effectiveAt
    );
    assert.equal(result.roleAssignment.id, assignmentId);
    assert.equal(
      result.roleAssignment.effectiveTo,
      membershipEnd
    );
  }
);


test(
  "ordinary role repository preserves zero-assignment VS001 compatibility",
  async () => {
    const fake = new FakeSupabaseClient({
      data: [ordinaryRow(false)],
      error: null,
    });
    const repository =
      new SupabaseProjectRoleManagementRepository(
        asSupabaseClient(fake)
      );

    const result = await repository.changeOrdinaryRole({
      assignmentId,
      projectId,
      membershipId,
      role: "PROJECT_OBSERVER",
      effectiveAt,
      assignedByPersonId: actorPersonId,
      changeReason: null,
      createdAt,
    });

    assert.equal(result.closedAssignment, null);
    assert.equal(
      result.roleAssignment.assignedBy,
      actorPersonId
    );
  }
);


test(
  "protected repository maps first appointment and immutable ledger provenance",
  async () => {
    const row = {
      ...ordinaryRow(false),
      ...assignmentColumns("new_assignment", {
        id: assignmentId,
        membership: incomingMembershipId,
        role: "PROJECT_MANAGER",
        from: effectiveAt,
        to: membershipEnd,
      }),
      transfer_id: transferId,
      transfer_project_id: projectId,
      transfer_role: "PROJECT_MANAGER",
      transfer_outgoing_assignment_id: null,
      transfer_incoming_assignment_id: assignmentId,
      transfer_authorised_by_person_id: actorPersonId,
      transfer_reason: "First delivery lead",
      transfer_correlation_id: correlationId,
      transfer_effective_at: effectiveAt,
      transfer_created_at: createdAt,
    };
    const fake = new FakeSupabaseClient({
      data: [row],
      error: null,
    });
    const repository =
      new SupabaseProjectRoleManagementRepository(
        asSupabaseClient(fake)
      );

    const result = await repository.transferProtectedRole({
      transferId,
      incomingAssignmentId: assignmentId,
      projectId,
      incomingMembershipId,
      role: "PROJECT_MANAGER",
      effectiveAt,
      authorisedByPersonId: actorPersonId,
      reason: "First delivery lead",
      correlationId,
      createdAt,
    });

    assert.equal(result.outgoingAssignment, null);
    assert.equal(
      result.roleAssignment.membershipId,
      incomingMembershipId
    );
    assert.deepEqual(result.transfer, {
      id: transferId,
      projectId,
      role: "PROJECT_MANAGER",
      outgoingAssignmentId: null,
      incomingAssignmentId: assignmentId,
      authorisedByPersonId: actorPersonId,
      reason: "First delivery lead",
      correlationId,
      effectiveAt,
      createdAt,
    });
    assert.deepEqual(
      Object.keys(fake.calls[0]?.args ?? {}).filter(
        (key) => key.includes("affiliation")
      ),
      [],
      "INTERNAL/EXTERNAL affiliation is not persistence input."
    );
  }
);


test(
  "protected repository maps outgoing history for transfer",
  async () => {
    const row = {
      ...ordinaryRow(true),
      ...assignmentColumns("new_assignment", {
        id: assignmentId,
        membership: incomingMembershipId,
        role: "PROJECT_OWNER",
        from: effectiveAt,
        to: membershipEnd,
      }),
      transfer_id: transferId,
      transfer_project_id: projectId,
      transfer_role: "PROJECT_OWNER",
      transfer_outgoing_assignment_id: outgoingAssignmentId,
      transfer_incoming_assignment_id: assignmentId,
      transfer_authorised_by_person_id: actorPersonId,
      transfer_reason: "Succession",
      transfer_correlation_id: correlationId,
      transfer_effective_at: effectiveAt,
      transfer_created_at: createdAt,
    };
    const repository =
      new SupabaseProjectRoleManagementRepository(
        asSupabaseClient(
          new FakeSupabaseClient({ data: [row], error: null })
        )
      );

    const result = await repository.transferProtectedRole({
      transferId,
      incomingAssignmentId: assignmentId,
      projectId,
      incomingMembershipId,
      role: "PROJECT_OWNER",
      effectiveAt,
      authorisedByPersonId: actorPersonId,
      reason: "Succession",
      correlationId,
      createdAt,
    });

    assert.equal(
      result.outgoingAssignment?.id,
      outgoingAssignmentId
    );
    assert.equal(
      result.outgoingAssignment?.effectiveTo,
      effectiveAt
    );
  }
);


test(
  "repository maps protected-through-ordinary rejection to stable error",
  async () => {
    const repository =
      new SupabaseProjectRoleManagementRepository(
        asSupabaseClient(new FakeSupabaseClient({
          data: null,
          error: { message: "PROJECT_ROLE_TRANSFER_REQUIRED" },
        }))
      );

    await assert.rejects(
      repository.changeOrdinaryRole({
        assignmentId,
        projectId,
        membershipId,
        role: "PROJECT_MEMBER",
        effectiveAt,
        assignedByPersonId: actorPersonId,
        changeReason: null,
        createdAt,
      }),
      ProjectRoleTransferRequiredError
    );
  }
);


test(
  "repository maps transactional role validation to stable error",
  async () => {
    const repository =
      new SupabaseProjectRoleManagementRepository(
        asSupabaseClient(new FakeSupabaseClient({
          data: null,
          error: {
            message: "PROJECT_ROLE_PROTECTED_HOLDER_UNCHANGED",
          },
        }))
      );

    await assert.rejects(
      repository.transferProtectedRole({
        transferId,
        incomingAssignmentId: assignmentId,
        projectId,
        incomingMembershipId,
        role: "PROJECT_MANAGER",
        effectiveAt,
        authorisedByPersonId: actorPersonId,
        reason: "Same holder",
        correlationId,
        createdAt,
      }),
      ProjectRoleAssignmentInvalidError
    );
  }
);

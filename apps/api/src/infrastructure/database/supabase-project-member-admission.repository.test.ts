import assert from "node:assert/strict";

import test from "node:test";

import type {
  SupabaseClient,
} from "@supabase/supabase-js";

import {
  ProjectMembershipAlreadyActiveError,
  ProjectMembershipValidationError,
} from "../../modules/project-membership/project-membership.errors";

import type {
  ProjectMemberAdmissionInput,
} from "../../modules/project-membership/project-member-admission.repository";

import {
  SupabaseProjectMemberAdmissionRepository,
} from "./supabase-project-member-admission.repository";


const membershipId =
  "11111111-1111-4111-8111-111111111111";

const projectId =
  "22222222-2222-4222-8222-222222222222";

const personId =
  "33333333-3333-4333-8333-333333333333";

const actorPersonId =
  "44444444-4444-4444-8444-444444444444";

const roleAssignmentId =
  "55555555-5555-4555-8555-555555555555";

const effectiveFrom =
  "2026-09-01T00:00:00.000Z";

const effectiveTo =
  "2026-12-01T00:00:00.000Z";

const createdAt =
  "2026-08-21T14:00:00.000Z";


type RpcResponse = {
  data: unknown;
  error:
    | {
        message: string;
      }
    | null;
};


class FakeSupabaseClient {
  public calls:
    Array<{
      name: string;
      args: Record<string, unknown>;
    }> = [];


  constructor(
    private readonly response:
      RpcResponse
  ) {}


  async rpc(
    name: string,
    args: Record<string, unknown>
  ): Promise<RpcResponse> {
    this.calls.push({
      name,
      args,
    });

    return this.response;
  }
}


function asSupabaseClient(
  fake: FakeSupabaseClient
): SupabaseClient {
  return fake as unknown as
    SupabaseClient;
}


function createInput():
  ProjectMemberAdmissionInput {
  return {
    membership: {
      id:
        membershipId,

      personId,

      projectId,

      effectiveFrom,

      effectiveTo,

      status:
        "ACTIVE",

      grantedBy:
        actorPersonId,

      createdAt,

      terminationReason:
        null,
    },

    roleAssignment: {
      id:
        roleAssignmentId,

      projectId,

      membershipId,

      role:
        "PROJECT_MEMBER",

      effectiveFrom,

      effectiveTo,

      assignedBy:
        actorPersonId,

      changeReason:
        null,

      createdAt,
    },
  };
}


test(
  "Supabase admission repository invokes atomic RPC and maps both records",
  async () => {
    const fake =
      new FakeSupabaseClient({
        data: [
          {
            membership_id:
              membershipId,

            membership_person_id:
              personId,

            membership_project_id:
              projectId,

            membership_effective_from:
              effectiveFrom,

            membership_effective_to:
              effectiveTo,

            membership_status:
              "ACTIVE",

            membership_granted_by_person_id:
              actorPersonId,

            membership_created_at:
              createdAt,

            membership_termination_reason:
              null,

            role_assignment_id:
              roleAssignmentId,

            role_assignment_project_id:
              projectId,

            role_assignment_membership_id:
              membershipId,

            role_assignment_role:
              "PROJECT_MEMBER",

            role_assignment_effective_from:
              effectiveFrom,

            role_assignment_effective_to:
              effectiveTo,

            role_assignment_assigned_by_person_id:
              actorPersonId,

            role_assignment_change_reason:
              null,

            role_assignment_created_at:
              createdAt,
          },
        ],

        error:
          null,
      });

    const repository =
      new SupabaseProjectMemberAdmissionRepository(
        asSupabaseClient(
          fake
        )
      );

    const result =
      await repository
        .addProjectMember(
          createInput()
        );

    assert.deepEqual(
      fake.calls,
      [
        {
          name:
            "add_project_member",

          args: {
            p_membership_id:
              membershipId,

            p_project_id:
              projectId,

            p_person_id:
              personId,

            p_effective_from:
              effectiveFrom,

            p_effective_to:
              effectiveTo,

            p_granted_by_person_id:
              actorPersonId,

            p_membership_created_at:
              createdAt,

            p_role_assignment_id:
              roleAssignmentId,

            p_assigned_by_person_id:
              actorPersonId,

            p_role_created_at:
              createdAt,
          },
        },
      ]
    );

    assert.equal(
      result.membership.id,
      membershipId
    );

    assert.equal(
      result.membership.status,
      "ACTIVE"
    );

    assert.equal(
      result.roleAssignment.role,
      "PROJECT_MEMBER"
    );

    assert.equal(
      result.roleAssignment.membershipId,
      membershipId
    );
  }
);


test(
  "Supabase admission repository maps database duplicate protection",
  async () => {
    const fake =
      new FakeSupabaseClient({
        data:
          null,

        error: {
          message:
            "PROJECT_MEMBERSHIP_ALREADY_ACTIVE",
        },
      });

    const repository =
      new SupabaseProjectMemberAdmissionRepository(
        asSupabaseClient(
          fake
        )
      );

    await assert.rejects(
      repository.addProjectMember(
        createInput()
      ),
      ProjectMembershipAlreadyActiveError
    );
  }
);


test(
  "Supabase admission repository refuses a non-member initial role",
  async () => {
    const fake =
      new FakeSupabaseClient({
        data:
          [],

        error:
          null,
      });

    const repository =
      new SupabaseProjectMemberAdmissionRepository(
        asSupabaseClient(
          fake
        )
      );

    const input =
      createInput();

    input.roleAssignment.role =
      "PROJECT_MANAGER";

    await assert.rejects(
      repository.addProjectMember(
        input
      ),
      ProjectMembershipValidationError
    );

    assert.equal(
      fake.calls.length,
      0
    );
  }
);

import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  SupabaseClient,
} from "@supabase/supabase-js";

import type {
  AuthenticationIdentity,
  OrganisationalAffiliation,
} from "../../modules/identity/identity.types";

import type {
  CreateProjectMembershipInput,
  ProjectMembership,
} from "../../modules/project-membership/project-membership.types";

import type {
  ProjectRoleAssignment,
} from "../../modules/project-membership/project-role.types";

import {
  SupabaseIdentityPersistenceRepository,
} from "./supabase-identity-persistence.repository";

import {
  SupabaseProjectMembershipRepository,
} from "./supabase-project-membership.repository";


type FakeResponse = {
  data: unknown;
  error: null;
};

type FakeCall = {
  table: string;
  operation: "insert" | "select";
  payload?: Record<string, unknown>;
  filters: Array<{
    column: string;
    value: unknown;
  }>;
};


class FakeQuery {
  constructor(
    private readonly response: FakeResponse,
    private readonly call: FakeCall
  ) {}


  select(): this {
    return this;
  }


  eq(
    column: string,
    value: unknown
  ): this {
    this.call.filters.push({
      column,
      value,
    });

    return this;
  }


  order(): Promise<FakeResponse> {
    return Promise.resolve(
      this.response
    );
  }


  single(): Promise<FakeResponse> {
    return Promise.resolve(
      this.response
    );
  }


  maybeSingle(): Promise<FakeResponse> {
    return Promise.resolve(
      this.response
    );
  }
}


function createFakeClient(
  responses: FakeResponse[]
): {
  client: SupabaseClient;
  calls: FakeCall[];
} {
  const calls: FakeCall[] = [];

  const client = {
    from(table: string) {
      return {
        insert(
          payload: Record<string, unknown>
        ) {
          const call: FakeCall = {
            table,
            operation: "insert",
            payload,
            filters: [],
          };

          calls.push(call);

          return new FakeQuery(
            requireResponse(responses),
            call
          );
        },

        select() {
          const call: FakeCall = {
            table,
            operation: "select",
            filters: [],
          };

          calls.push(call);

          return new FakeQuery(
            requireResponse(responses),
            call
          );
        },
      };
    },
  } as unknown as SupabaseClient;

  return {
    client,
    calls,
  };
}


function requireResponse(
  responses: FakeResponse[]
): FakeResponse {
  const response =
    responses.shift();

  if (!response) {
    throw new Error(
      "Fake Supabase response was not configured."
    );
  }

  return response;
}


test(
  "stable Person persists independently from replaceable authentication identities",
  async () => {
    const personId =
      "11111111-1111-4111-8111-111111111111";

    const identityOne:
      AuthenticationIdentity = {
        id:
          "22222222-2222-4222-8222-222222222222",
        personId,
        provider:
          "local",
        providerSubjectId:
          "subject-one",
        loginIdentifier:
          "old-login@example.test",
        validFrom:
          "2025-01-01T00:00:00.000Z",
        validTo:
          "2026-01-01T00:00:00.000Z",
        status:
          "DISABLED",
      };

    const identityTwo:
      AuthenticationIdentity = {
        ...identityOne,
        id:
          "33333333-3333-4333-8333-333333333333",
        providerSubjectId:
          "subject-two",
        loginIdentifier:
          "new-login@example.test",
        validFrom:
          "2026-01-01T00:00:00.000Z",
        validTo:
          null,
        status:
          "ACTIVE",
      };

    const fake = createFakeClient([
      {
        data: {
          id: personId,
          display_name: "Sarah Tan",
        },
        error: null,
      },
      {
        data: toAuthenticationIdentityRow(
          identityOne
        ),
        error: null,
      },
      {
        data: toAuthenticationIdentityRow(
          identityTwo
        ),
        error: null,
      },
      {
        data: [
          toAuthenticationIdentityRow(
            identityOne
          ),
          toAuthenticationIdentityRow(
            identityTwo
          ),
        ],
        error: null,
      },
    ]);

    const repository =
      new SupabaseIdentityPersistenceRepository(
        fake.client
      );

    const person =
      await repository.createPerson({
        id: personId,
        displayName: "Sarah Tan",
      });

    await repository.createAuthenticationIdentity(
      identityOne
    );

    await repository.createAuthenticationIdentity(
      identityTwo
    );

    const identities =
      await repository.listAuthenticationIdentities(
        personId
      );

    assert.deepEqual(
      person,
      {
        id: personId,
        displayName: "Sarah Tan",
      }
    );

    assert.deepEqual(
      identities,
      [
        identityOne,
        identityTwo,
      ]
    );

    assert.equal(
      "email" in person,
      false
    );

    assert.equal(
      fake.calls.some(
        (call) =>
          call.table ===
            "project_memberships"
      ),
      false,
      "Authentication persistence must not grant project membership."
    );
  }
);


test(
  "EXTERNAL affiliation and PROJECT_MANAGER assignment persist through separate owners",
  async () => {
    const personId =
      "11111111-1111-4111-8111-111111111111";

    const membershipId =
      "44444444-4444-4444-8444-444444444444";

    const projectId =
      "55555555-5555-4555-8555-555555555555";

    const grantorId =
      "66666666-6666-4666-8666-666666666666";

    const affiliation:
      OrganisationalAffiliation = {
        personId,
        classification:
          "EXTERNAL",
        organisationName:
          "Delivery Partner",
        effectiveFrom:
          "2026-01-01T00:00:00.000Z",
        effectiveTo:
          null,
      };

    const membership:
      CreateProjectMembershipInput = {
        id: membershipId,
        personId,
        projectId,
        effectiveFrom:
          "2026-09-01T00:00:00.000Z",
        effectiveTo:
          null,
        status:
          "ACTIVE",
        grantedBy:
          grantorId,
        createdAt:
          "2026-08-20T00:00:00.000Z",
        terminationReason:
          null,
      };

    const assignment:
      ProjectRoleAssignment = {
        id:
          "77777777-7777-4777-8777-777777777777",
        projectId,
        membershipId,
        role:
          "PROJECT_MANAGER",
        effectiveFrom:
          "2026-09-01T00:00:00.000Z",
        effectiveTo:
          null,
        assignedBy:
          grantorId,
        changeReason:
          "Operational leadership",
        createdAt:
          "2026-08-20T00:00:00.000Z",
      };

    const identityFake = createFakeClient([
      {
        data: toAffiliationRow(
          affiliation
        ),
        error: null,
      },
    ]);

    const membershipFake = createFakeClient([
      {
        data: toMembershipRow(
          membership
        ),
        error: null,
      },
      {
        data: toAssignmentRow(
          assignment
        ),
        error: null,
      },
    ]);

    const identityRepository =
      new SupabaseIdentityPersistenceRepository(
        identityFake.client
      );

    const membershipRepository =
      new SupabaseProjectMembershipRepository(
        membershipFake.client
      );

    const storedAffiliation =
      await identityRepository
        .createOrganisationalAffiliation(
          affiliation
        );

    const storedMembership =
      await membershipRepository
        .createMembership(
          membership
        );

    const storedAssignment =
      await membershipRepository
        .createRoleAssignment(
          assignment
        );

    assert.equal(
      storedAffiliation.classification,
      "EXTERNAL"
    );

    assert.equal(
      storedAssignment.role,
      "PROJECT_MANAGER"
    );

    assert.equal(
      storedMembership.effectiveTo,
      null
    );

    const membershipInsert =
      membershipFake.calls[0]?.payload;

    assert.equal(
      membershipInsert?.person_id,
      personId
    );

    assert.equal(
      membershipInsert?.effective_from,
      membership.effectiveFrom
    );

    assert.equal(
      membershipInsert?.membership_status,
      membership.status
    );

    assert.equal(
      "joined_at" in
        (membershipInsert ?? {}),
      false,
      "R03B must not derive canonical start from legacy joined_at."
    );

    assert.equal(
      "status" in
        (membershipInsert ?? {}),
      false,
      "R03B must not derive canonical lifecycle from legacy status."
    );

    assert.equal(
      "user_id" in
        (membershipInsert ?? {}),
      false,
      "R03A must not extend the legacy user membership shape."
    );

    assert.equal(
      "role_id" in
        (membershipInsert ?? {}),
      false,
      "R03A must not extend the legacy role membership shape."
    );

    assert.equal(
      "classification" in
        (membershipInsert ?? {}),
      false,
      "Affiliation must not influence project-role persistence."
    );
  }
);


test(
  "time-bounded membership and role assignment preserve independent periods",
  async () => {
    const membership:
      CreateProjectMembershipInput = {
        id:
          "11111111-1111-4111-8111-111111111111",
        personId:
          "22222222-2222-4222-8222-222222222222",
        projectId:
          "33333333-3333-4333-8333-333333333333",
        effectiveFrom:
          "2026-09-01T00:00:00.000Z",
        effectiveTo:
          "2026-12-01T00:00:00.000Z",
        status:
          "ENDED",
        grantedBy:
          "44444444-4444-4444-8444-444444444444",
        createdAt:
          "2026-08-20T00:00:00.000Z",
        terminationReason:
          "Engagement completed",
      };

    const assignment:
      ProjectRoleAssignment = {
        id:
          "55555555-5555-4555-8555-555555555555",
        projectId:
          membership.projectId,
        membershipId:
          membership.id,
        role:
          "PROJECT_AUDITOR",
        effectiveFrom:
          "2026-10-01T00:00:00.000Z",
        effectiveTo:
          "2026-11-01T00:00:00.000Z",
        assignedBy:
          membership.grantedBy,
        changeReason:
          null,
        createdAt:
          membership.createdAt,
      };

    const fake = createFakeClient([
      {
        data: toMembershipRow(
          membership
        ),
        error: null,
      },
      {
        data: [
          toAssignmentRow(
            assignment
          ),
        ],
        error: null,
      },
    ]);

    const repository =
      new SupabaseProjectMembershipRepository(
        fake.client
      );

    const storedMembership =
      await repository.createMembership(
        membership
      );

    const storedAssignments =
      await repository.listRoleAssignments(
        membership.id
      );

    assert.equal(
      storedMembership.effectiveTo,
      "2026-12-01T00:00:00.000Z"
    );

    assert.equal(
      storedMembership.status,
      "ENDED"
    );

    assert.equal(
      storedAssignments[0]?.effectiveFrom,
      "2026-10-01T00:00:00.000Z"
    );

    assert.equal(
      storedAssignments[0]?.effectiveTo,
      "2026-11-01T00:00:00.000Z"
    );

    assert.notEqual(
      storedAssignments[0]?.effectiveFrom,
      storedMembership.effectiveFrom
    );
  }
);


test(
  "legacy membership with unavailable grantor provenance can be read",
  async () => {
    const historicalMembership:
      ProjectMembership = {
        id:
          "11111111-1111-4111-8111-111111111111",
        personId:
          "22222222-2222-4222-8222-222222222222",
        projectId:
          "33333333-3333-4333-8333-333333333333",
        effectiveFrom:
          "2025-01-01T00:00:00.000Z",
        effectiveTo:
          null,
        status:
          "ACTIVE",
        grantedBy:
          null,
        createdAt:
          "2025-01-01T00:00:00.000Z",
        terminationReason:
          null,
      };

    const fake = createFakeClient([
      {
        data: toMembershipRow(
          historicalMembership
        ),
        error: null,
      },
    ]);

    const repository =
      new SupabaseProjectMembershipRepository(
        fake.client
      );

    const storedMembership =
      await repository.findMembershipById(
        historicalMembership.id
      );

    assert.deepEqual(
      storedMembership,
      historicalMembership
    );
  }
);


test(
  "authorisation membership lookup is scoped by stable Person and Project",
  async () => {
    const membership:
      ProjectMembership = {
        id:
          "11111111-1111-4111-8111-111111111111",
        personId:
          "22222222-2222-4222-8222-222222222222",
        projectId:
          "33333333-3333-4333-8333-333333333333",
        effectiveFrom:
          "2026-08-01T00:00:00.000Z",
        effectiveTo:
          null,
        status:
          "ACTIVE",
        grantedBy:
          "44444444-4444-4444-8444-444444444444",
        createdAt:
          "2026-08-01T00:00:00.000Z",
        terminationReason:
          null,
      };

    const fake = createFakeClient([
      {
        data: [
          toMembershipRow(
            membership
          ),
        ],
        error: null,
      },
    ]);

    const repository =
      new SupabaseProjectMembershipRepository(
        fake.client
      );

    assert.deepEqual(
      await repository
        .listMembershipsForPersonInProject(
          membership.personId,
          membership.projectId
        ),
      [membership]
    );

    assert.deepEqual(
      fake.calls[0]?.filters,
      [
        {
          column:
            "person_id",
          value:
            membership.personId,
        },
        {
          column:
            "project_id",
          value:
            membership.projectId,
        },
      ]
    );
  }
);


function toAuthenticationIdentityRow(
  identity: AuthenticationIdentity
): Record<string, unknown> {
  return {
    id: identity.id,
    person_id: identity.personId,
    provider: identity.provider,
    provider_subject_id:
      identity.providerSubjectId,
    login_identifier:
      identity.loginIdentifier,
    valid_from: identity.validFrom,
    valid_to: identity.validTo,
    status: identity.status,
  };
}


function toAffiliationRow(
  affiliation: OrganisationalAffiliation
): Record<string, unknown> {
  return {
    person_id: affiliation.personId,
    classification:
      affiliation.classification,
    organisation_name:
      affiliation.organisationName,
    effective_from:
      affiliation.effectiveFrom,
    effective_to:
      affiliation.effectiveTo,
  };
}


function toMembershipRow(
  membership: ProjectMembership
): Record<string, unknown> {
  return {
    id: membership.id,
    person_id: membership.personId,
    project_id: membership.projectId,
    effective_from:
      membership.effectiveFrom,
    effective_to: membership.effectiveTo,
    membership_status:
      membership.status,
    granted_by_person_id:
      membership.grantedBy,
    created_at: membership.createdAt,
    termination_reason:
      membership.terminationReason,
  };
}


function toAssignmentRow(
  assignment: ProjectRoleAssignment
): Record<string, unknown> {
  return {
    id: assignment.id,
    project_id: assignment.projectId,
    membership_id:
      assignment.membershipId,
    role: assignment.role,
    effective_from:
      assignment.effectiveFrom,
    effective_to: assignment.effectiveTo,
    assigned_by_person_id:
      assignment.assignedBy,
    change_reason:
      assignment.changeReason,
    created_at: assignment.createdAt,
  };
}

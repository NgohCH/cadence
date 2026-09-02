import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  SupabaseProjectMembershipPilotPreparationRepository,
} from "./supabase-project-membership-pilot-preparation.repository";


const projectId = "00440000-0000-4000-8000-000000000001";


type Response = { data: unknown; error: null };


class FakeQuery {
  constructor(private readonly response: Response) {}

  select(): this { return this; }
  eq(): this { return this; }
  order(): Promise<Response> { return Promise.resolve(this.response); }
}


class FakeClient {
  readonly calls: Array<{ table: string; operation: string }> = [];
  private readonly responses: Response[];

  constructor(responses: Response[]) {
    this.responses = responses;
  }

  from(table: string) {
    this.calls.push({ table, operation: "select" });
    return new FakeQuery(this.responses.shift() ?? { data: [], error: null });
  }
}


test("membership pilot read adapter reads project assignments and protected ledger without writes", async () => {
  const fake = new FakeClient([
    {
      data: [{
        id: "00444000-0000-4000-8000-000000000001",
        project_id: projectId,
        membership_id: "00442000-0000-4000-8000-000000000001",
        role: "PROJECT_OWNER",
        effective_from: "2026-09-01T00:00:00.000Z",
        effective_to: null,
        assigned_by_person_id: "00441000-0000-4000-8000-000000000001",
        change_reason: "First owner appointment",
        created_at: "2026-09-01T00:00:00.000Z",
      }],
      error: null,
    },
    {
      data: [{
        id: "00447000-0000-4000-8000-000000000001",
        project_id: projectId,
        role: "PROJECT_OWNER",
        outgoing_assignment_id: null,
        incoming_assignment_id: "00444000-0000-4000-8000-000000000001",
        authorised_by_person_id: "00441000-0000-4000-8000-000000000001",
        reason: "First owner appointment",
        correlation_id: "00449000-0000-4000-8000-000000000001",
        effective_at: "2026-09-01T00:00:00.000Z",
        created_at: "2026-09-01T00:00:00.000Z",
      }],
      error: null,
    },
  ]);

  const repository = new SupabaseProjectMembershipPilotPreparationRepository(
    fake as unknown as SupabaseClient,
  );
  const assignments = await repository.listRoleAssignmentsForProject(projectId);
  const transfers = await repository.listProtectedRoleTransfers(projectId);

  assert.equal(assignments[0]?.role, "PROJECT_OWNER");
  assert.equal(transfers[0]?.outgoingAssignmentId, null);
  assert.deepEqual(fake.calls, [
    { table: "project_role_assignments", operation: "select" },
    { table: "project_role_transfers", operation: "select" },
  ]);
});

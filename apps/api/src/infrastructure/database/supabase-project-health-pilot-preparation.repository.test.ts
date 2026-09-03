import assert from "node:assert/strict";
import { test } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  SupabaseProjectHealthPilotPreparationRepository,
} from "./supabase-project-health-pilot-preparation.repository";


const projectId = "00440000-0000-4000-8000-000000000001";


class FakeQuery {
  inserted: unknown;

  constructor(
    private readonly response: unknown,
  ) {}

  select(): this {
    return this;
  }

  eq(): this {
    return this;
  }

  insert(value: unknown): this {
    this.inserted = value;
    return this;
  }

  async maybeSingle(): Promise<{ data: unknown; error: null }> {
    return { data: this.response, error: null };
  }

  async single(): Promise<{ data: unknown; error: null }> {
    return { data: this.response, error: null };
  }
}


function fakeClient(
  response: unknown,
): {
  client: SupabaseClient;
  query: FakeQuery;
  tables: string[];
} {
  const query = new FakeQuery(response);
  const tables: string[] = [];
  return {
    client: {
      from(table: string) {
        tables.push(table);
        return query;
      },
    } as unknown as SupabaseClient,
    query,
    tables,
  };
}


test("Project Health adapter reads only the current Health row", async () => {
  const fake = fakeClient({
    project_id: projectId,
    health_status: "on_track",
    reasons: ["Ready"],
    source: "system",
    changed_by: null,
    updated_at: "2026-09-01T00:00:00.000Z",
  });

  const result = await new SupabaseProjectHealthPilotPreparationRepository(
    fake.client,
  ).findCurrentProjectHealth(projectId);

  assert.deepEqual(result, {
    projectId,
    healthStatus: "on_track",
    reasons: ["Ready"],
    source: "system",
    changedBy: null,
    updatedAt: "2026-09-01T00:00:00.000Z",
  });
  assert.deepEqual(fake.tables, ["project_health"]);
});


test("Project Health adapter creates only current Health state", async () => {
  const fake = fakeClient({
    project_id: projectId,
    health_status: "on_track",
    reasons: [],
    source: "system",
    changed_by: null,
    updated_at: "2026-09-01T00:00:00.000Z",
  });

  await new SupabaseProjectHealthPilotPreparationRepository(
    fake.client,
  ).createCurrentProjectHealth({
    projectId,
    healthStatus: "on_track",
    reasons: [],
    source: "system",
    changedBy: null,
  });

  assert.deepEqual(fake.tables, ["project_health"]);
  assert.deepEqual(fake.query.inserted, {
    project_id: projectId,
    health_status: "on_track",
    reasons: [],
    source: "system",
    changed_by: null,
  });
});


test("Project Health adapter does not access Projects or Health history", async () => {
  const fake = fakeClient(null);

  await new SupabaseProjectHealthPilotPreparationRepository(
    fake.client,
  ).findCurrentProjectHealth(projectId);

  assert.equal(fake.tables.includes("projects"), false);
  assert.equal(fake.tables.includes("project_health_history"), false);
});

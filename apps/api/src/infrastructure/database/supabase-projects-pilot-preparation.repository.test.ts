import assert from "node:assert/strict";
import { test } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  SupabaseProjectsPilotPreparationRepository,
} from "./supabase-projects-pilot-preparation.repository";


const projectId = "00440000-0000-4000-8000-000000000001";
const ownerUserId = "00448000-0000-4000-8000-000000000001";


type Operation = {
  name: string;
  args: unknown[];
};


class FakeQuery {
  readonly operations: Operation[] = [];
  inserted: unknown;

  constructor(
    private readonly response: unknown,
  ) {}

  select(...args: unknown[]): this {
    this.operations.push({ name: "select", args });
    return this;
  }

  eq(...args: unknown[]): this {
    this.operations.push({ name: "eq", args });
    return this;
  }

  insert(value: unknown): this {
    this.inserted = value;
    this.operations.push({ name: "insert", args: [value] });
    return this;
  }

  async maybeSingle(): Promise<{ data: unknown; error: null }> {
    this.operations.push({ name: "maybeSingle", args: [] });
    return { data: this.response, error: null };
  }

  async single(): Promise<{ data: unknown; error: null }> {
    this.operations.push({ name: "single", args: [] });
    return { data: this.response, error: null };
  }
}


function fakeClient(
  responses: Record<string, unknown>,
): {
  client: SupabaseClient;
  queries: Record<string, FakeQuery>;
  tables: string[];
} {
  const tables: string[] = [];
  const queries: Record<string, FakeQuery> = {};

  return {
    client: {
      from(table: string) {
        tables.push(table);
        const query = new FakeQuery(responses[table]);
        queries[table] = query;
        return query;
      },
    } as unknown as SupabaseClient,
    queries,
    tables,
  };
}


test("Projects pilot repository maps and reads an exact Project", async () => {
  const fake = fakeClient({
    projects: {
      id: projectId,
      name: "Controlled Pilot",
      description: "Description",
      goal: "Goal",
      lifecycle_status: "active",
      progress_percent: 0,
      owner_user_id: ownerUserId,
      start_date: "2026-09-01",
      target_date: "2026-12-31",
      created_at: "2026-09-01T00:00:00.000Z",
      updated_at: "2026-09-01T00:00:00.000Z",
    },
  });

  const result = await new SupabaseProjectsPilotPreparationRepository(
    fake.client,
  ).findProjectById(projectId);

  assert.equal(result?.id, projectId);
  assert.equal(result?.ownerUserId, ownerUserId);
  assert.deepEqual(fake.tables, ["projects"]);
  assert.deepEqual(fake.queries.projects.operations, [
    {
      name: "select",
      args: [expectProjectSelect],
    },
    { name: "eq", args: ["id", projectId] },
    { name: "maybeSingle", args: [] },
  ]);
});


test("Projects pilot repository creates only Project-owned fields", async () => {
  const fake = fakeClient({
    projects: {
      id: projectId,
      name: "Controlled Pilot",
      description: null,
      goal: null,
      lifecycle_status: "draft",
      progress_percent: 0,
      owner_user_id: ownerUserId,
      start_date: null,
      target_date: null,
      created_at: "2026-09-01T00:00:00.000Z",
      updated_at: "2026-09-01T00:00:00.000Z",
    },
  });

  const result = await new SupabaseProjectsPilotPreparationRepository(
    fake.client,
  ).createProject({
    id: projectId,
    name: "Controlled Pilot",
    description: null,
    goal: null,
    lifecycleStatus: "draft",
    progressPercent: 0,
    ownerUserId,
    startDate: null,
    targetDate: null,
  });

  assert.equal(result.id, projectId);
  assert.deepEqual(fake.queries.projects.inserted, {
    id: projectId,
    name: "Controlled Pilot",
    description: null,
    goal: null,
    lifecycle_status: "draft",
    progress_percent: 0,
    owner_user_id: ownerUserId,
    start_date: null,
    target_date: null,
  });
});


const expectProjectSelect = `
        id,
        name,
        description,
        goal,
        lifecycle_status,
        progress_percent,
        owner_user_id,
        start_date,
        target_date,
        created_at,
        updated_at
      `;

import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  SupabaseClient,
} from "@supabase/supabase-js";

import {
  SupabaseProjectLifecycleRepository,
} from "./supabase-project-lifecycle.repository";


type Operation = {
  name: string;
  args: unknown[];
};


class FakeProjectQuery {
  public readonly operations:
    Operation[] = [];

  constructor(
    private readonly data:
      unknown
  ) {}


  select(...args: unknown[]): this {
    this.operations.push({
      name: "select",
      args,
    });
    return this;
  }


  eq(...args: unknown[]): this {
    this.operations.push({
      name: "eq",
      args,
    });
    return this;
  }


  async maybeSingle(): Promise<{
    data: unknown;
    error: null;
  }> {
    this.operations.push({
      name: "maybeSingle",
      args: [],
    });

    return {
      data: this.data,
      error: null,
    };
  }
}


function createClient(
  data: unknown
): {
  client: SupabaseClient;
  query: FakeProjectQuery;
  tables: string[];
} {
  const query =
    new FakeProjectQuery(data);
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


test(
  "Projects lifecycle repository reads only the requested project's lifecycle status",
  async () => {
    const fake = createClient({
      lifecycle_status:
        "on_hold",
    });

    const result =
      await new SupabaseProjectLifecycleRepository(
        fake.client
      ).findLifecycleStatus(
        "project-a"
      );

    assert.equal(result, "on_hold");
    assert.deepEqual(
      fake.tables,
      ["projects"]
    );
    assert.deepEqual(
      fake.query.operations,
      [
        {
          name: "select",
          args: ["lifecycle_status"],
        },
        {
          name: "eq",
          args: ["id", "project-a"],
        },
        {
          name: "maybeSingle",
          args: [],
        },
      ]
    );
  }
);


test(
  "Projects lifecycle repository preserves unknown-project semantics",
  async () => {
    const fake = createClient(null);

    assert.equal(
      await new SupabaseProjectLifecycleRepository(
        fake.client
      ).findLifecycleStatus(
        "missing-project"
      ),
      null
    );
  }
);

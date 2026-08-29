import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  SupabaseClient,
} from "@supabase/supabase-js";

import {
  SupabaseTasksMembershipResponsibilityRepository,
} from "./supabase-tasks-membership-responsibility.repository";


type FakeResponse = {
  data?: unknown;
  count?: number | null;
  error: null;
};


type QueryCall = {
  table: string;
  operations: Array<{
    name: string;
    args: unknown[];
  }>;
};


class FakeQuery
  implements PromiseLike<FakeResponse>
{
  constructor(
    private readonly response:
      FakeResponse,
    private readonly call:
      QueryCall
  ) {}


  select(...args: unknown[]): this {
    this.record("select", args);
    return this;
  }


  eq(...args: unknown[]): this {
    this.record("eq", args);
    return this;
  }


  in(...args: unknown[]): this {
    this.record("in", args);
    return this;
  }


  then<TResult1 = FakeResponse, TResult2 = never>(
    onfulfilled?: (
      value: FakeResponse
    ) => TResult1 | PromiseLike<TResult1>,
    onrejected?: (
      reason: unknown
    ) => TResult2 | PromiseLike<TResult2>
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(
      this.response
    ).then(onfulfilled, onrejected);
  }


  private record(
    name: string,
    args: unknown[]
  ): void {
    this.call.operations.push({
      name,
      args,
    });
  }
}


function createFakeClient(
  responses: FakeResponse[]
): {
  client: SupabaseClient;
  calls: QueryCall[];
} {
  const calls: QueryCall[] = [];
  let responseIndex = 0;

  const client = {
    from(table: string) {
      const call: QueryCall = {
        table,
        operations: [],
      };
      calls.push(call);

      const response =
        responses[responseIndex++];

      if (!response) {
        throw new Error(
          `Unexpected query for ${table}.`
        );
      }

      return new FakeQuery(
        response,
        call
      );
    },
  } as unknown as SupabaseClient;

  return {
    client,
    calls,
  };
}


test(
  "Tasks resolves all user IDs for a stable Person and scopes actionable work to one project",
  async () => {
    const fake = createFakeClient([
      {
        data: [
          { id: "user-1" },
          { id: "user-2" },
        ],
        error: null,
      },
      {
        count: 1,
        error: null,
      },
    ]);

    const result =
      await new SupabaseTasksMembershipResponsibilityRepository(
        fake.client
      ).hasActionableAssignedResponsibilities(
        "project-a",
        "person-a"
      );

    assert.equal(result, true);
    assert.deepEqual(
      fake.calls,
      [
        {
          table: "users",
          operations: [
            {
              name: "select",
              args: ["id"],
            },
            {
              name: "eq",
              args: [
                "person_id",
                "person-a",
              ],
            },
          ],
        },
        {
          table: "tasks",
          operations: [
            {
              name: "select",
              args: [
                "id",
                {
                  count: "exact",
                  head: true,
                },
              ],
            },
            {
              name: "eq",
              args: [
                "project_id",
                "project-a",
              ],
            },
            {
              name: "in",
              args: [
                "assigned_to",
                ["user-1", "user-2"],
              ],
            },
            {
              name: "in",
              args: [
                "status",
                ["open", "in_progress"],
              ],
            },
          ],
        },
      ]
    );
  }
);


test(
  "Tasks excludes completed and cancelled work from the blocking assessment",
  async () => {
    const fake = createFakeClient([
      {
        data: [{ id: "user-1" }],
        error: null,
      },
      {
        count: 0,
        error: null,
      },
    ]);

    const result =
      await new SupabaseTasksMembershipResponsibilityRepository(
        fake.client
      ).hasActionableAssignedResponsibilities(
        "project-a",
        "person-a"
      );

    assert.equal(result, false);

    const statusFilter =
      fake.calls[1]?.operations.find(
        (operation) =>
          operation.name === "in" &&
          operation.args[0] === "status"
      );

    assert.deepEqual(
      statusFilter?.args[1],
      ["open", "in_progress"]
    );
  }
);


test(
  "Tasks returns non-blocking without querying Task rows when Person has no user identity",
  async () => {
    const fake = createFakeClient([
      {
        data: [],
        error: null,
      },
    ]);

    const result =
      await new SupabaseTasksMembershipResponsibilityRepository(
        fake.client
      ).hasActionableAssignedResponsibilities(
        "project-a",
        "person-a"
      );

    assert.equal(result, false);
    assert.equal(fake.calls.length, 1);
    assert.equal(
      fake.calls[0]?.table,
      "users"
    );
  }
);

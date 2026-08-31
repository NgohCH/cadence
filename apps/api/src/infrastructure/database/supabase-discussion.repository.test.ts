import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  SupabaseDiscussionRepository,
} from "./supabase-discussion.repository";


const requestedProjectId =
  "11111111-1111-4111-8111-111111111111";


type QueryResponse = {
  data: unknown;
  error: { message: string } | null;
};


type QueryCall =
  | ["select", string]
  | ["eq", string, unknown]
  | ["order", string, unknown];


class FakeDiscussionQuery {
  public readonly calls: QueryCall[] = [];


  constructor(
    private readonly response: QueryResponse
  ) {}


  select(columns: string): this {
    this.calls.push(["select", columns]);
    return this;
  }


  eq(column: string, value: unknown): this {
    this.calls.push(["eq", column, value]);
    return this;
  }


  order(column: string, options: unknown): this {
    this.calls.push(["order", column, options]);
    return this;
  }


  then<TResult1 = QueryResponse>(
    onfulfilled?:
      ((value: QueryResponse) => TResult1 | PromiseLike<TResult1>) | null
  ): Promise<TResult1> {
    return Promise.resolve(this.response).then(
      onfulfilled ?? undefined
    );
  }
}


class FakeSupabaseClient {
  public readonly query: FakeDiscussionQuery;
  public table: string | null = null;


  constructor(response: QueryResponse) {
    this.query = new FakeDiscussionQuery(response);
  }


  from(table: string): FakeDiscussionQuery {
    this.table = table;
    return this.query;
  }
}


function client(
  fake: FakeSupabaseClient
): SupabaseClient {
  return fake as unknown as SupabaseClient;
}


function messageRow() {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    project_id: requestedProjectId,
    author_user_id: "33333333-3333-4333-8333-333333333333",
    author_type: "human",
    thread_parent_id: null,
    current_version: 2,
    content: "Persisted discussion message",
    created_at: "2026-08-30T10:00:00.000Z",
    edited_at: "2026-08-30T10:05:00.000Z",
  };
}


test("lists current project messages with the required query and deterministic ordering", async () => {
  const fake = new FakeSupabaseClient({
    data: [messageRow()],
    error: null,
  });
  const repository = new SupabaseDiscussionRepository(client(fake));

  await repository.listProjectMessages(requestedProjectId);

  assert.equal(fake.table, "current_messages");
  assert.deepEqual(
    fake.query.calls.filter((call) => call[0] === "select"),
    [[
      "select",
      "id, project_id, author_user_id, author_type, thread_parent_id, current_version, content, created_at, edited_at",
    ]]
  );
  assert.deepEqual(
    fake.query.calls.filter((call) => call[0] === "eq"),
    [["eq", "project_id", requestedProjectId]]
  );
  assert.deepEqual(
    fake.query.calls.filter((call) => call[0] === "order"),
    [
      ["order", "created_at", { ascending: true }],
      ["order", "id", { ascending: true }],
    ]
  );
});


test("maps persisted current message fields into DiscussionMessage", async () => {
  const fake = new FakeSupabaseClient({
    data: [messageRow()],
    error: null,
  });
  const repository = new SupabaseDiscussionRepository(client(fake));

  const messages = await repository.listProjectMessages(
    requestedProjectId
  );

  assert.deepEqual(messages, [{
    id: "22222222-2222-4222-8222-222222222222",
    projectId: requestedProjectId,
    authorUserId: "33333333-3333-4333-8333-333333333333",
    authorType: "human",
    threadParentId: null,
    currentVersion: 2,
    content: "Persisted discussion message",
    createdAt: "2026-08-30T10:00:00.000Z",
    editedAt: "2026-08-30T10:05:00.000Z",
  }]);
});


test("returns an empty list when current project messages are absent", async () => {
  const fake = new FakeSupabaseClient({
    data: [],
    error: null,
  });
  const repository = new SupabaseDiscussionRepository(client(fake));

  const messages = await repository.listProjectMessages(
    requestedProjectId
  );

  assert.deepEqual(messages, []);
});


test("throws a clear infrastructure error when the message query fails", async () => {
  const fake = new FakeSupabaseClient({
    data: null,
    error: { message: "database unavailable" },
  });
  const repository = new SupabaseDiscussionRepository(client(fake));

  await assert.rejects(
    repository.listProjectMessages(requestedProjectId),
    (error: unknown) =>
      error instanceof Error &&
      error.message ===
        "Failed to read discussion messages: database unavailable"
  );
});


test("uses id ascending as the tie-breaker after created_at ascending", async () => {
  const fake = new FakeSupabaseClient({
    data: [],
    error: null,
  });
  const repository = new SupabaseDiscussionRepository(client(fake));

  await repository.listProjectMessages(requestedProjectId);

  const orderCalls = fake.query.calls.filter(
    (call): call is ["order", string, unknown] =>
      call[0] === "order"
  );

  assert.equal(orderCalls[0]?.[1], "created_at");
  assert.deepEqual(orderCalls[0]?.[2], { ascending: true });
  assert.equal(orderCalls[1]?.[1], "id");
  assert.deepEqual(orderCalls[1]?.[2], { ascending: true });
});

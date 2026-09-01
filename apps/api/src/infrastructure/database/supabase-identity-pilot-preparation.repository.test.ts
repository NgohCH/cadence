import assert from "node:assert/strict";
import { test } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AuthenticationIdentity,
} from "../../modules/identity/identity.types";
import type {
  PilotCadenceUserRecord,
} from "../../modules/identity/pilot-preparation.types";
import {
  SupabaseIdentityPilotPreparationRepository,
} from "./supabase-identity-pilot-preparation.repository";


type Response = { data: unknown; error: null };


class Query {
  readonly filters: Array<[string, unknown]> = [];

  constructor(
    private readonly response: Response,
  ) {}

  select(): this {
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push([column, value]);
    return this;
  }

  order(): this {
    return this;
  }

  maybeSingle(): Promise<Response> {
    return Promise.resolve(this.response);
  }

  single(): Promise<Response> {
    return Promise.resolve(this.response);
  }
}


function fakeClient(
  responses: Response[],
): { client: SupabaseClient; calls: Array<{ table: string; method: string; payload?: Record<string, unknown> }> } {
  const calls: Array<{ table: string; method: string; payload?: Record<string, unknown> }> = [];
  const client = {
    from(table: string) {
      return {
        insert(payload: Record<string, unknown>) {
          calls.push({ table, method: "insert", payload });
          return new Query(responses.shift()!);
        },
        select() {
          calls.push({ table, method: "select" });
          return new Query(responses.shift()!);
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}


test("Identity preparation persistence writes only Identity-owned canonical rows", async () => {
  const user: PilotCadenceUserRecord = {
    id: "00448000-0000-4000-8000-000000000002",
    authUserId: "00446000-0000-4000-8000-000000000002",
    personId: "00441000-0000-4000-8000-000000000002",
    username: "pilot_owner",
    displayName: "Pilot Owner",
    email: "owner@cadence.test",
    status: "active",
    identityProvider: "local",
  };
  const identity: AuthenticationIdentity = {
    id: "00445000-0000-4000-8000-000000000002",
    personId: user.personId,
    provider: "local",
    providerSubjectId: user.authUserId,
    loginIdentifier: user.email,
    validFrom: "2026-09-01T00:00:00.000Z",
    validTo: null,
    status: "ACTIVE",
  };
  const fake = fakeClient([
    { data: { id: user.id }, error: null },
    { data: { id: identity.id }, error: null },
  ]);
  const repository = new SupabaseIdentityPilotPreparationRepository(fake.client);

  await repository.createCadenceUser(user);
  await repository.createAuthenticationIdentity(identity);

  assert.deepEqual(fake.calls.map((call) => call.table), ["users", "authentication_identities"]);
  assert.equal("project_id" in (fake.calls[0].payload ?? {}), false);
  assert.equal("role" in (fake.calls[1].payload ?? {}), false);
  assert.equal(fake.calls[0].payload?.auth_user_id, user.authUserId);
  assert.equal(fake.calls[0].payload?.person_id, user.personId);
});

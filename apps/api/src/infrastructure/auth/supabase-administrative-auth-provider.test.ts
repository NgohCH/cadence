import assert from "node:assert/strict";
import { test } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  SupabaseAdministrativeAuthProvider,
} from "./supabase-administrative-auth-provider";


test("administrative Auth lookup is read-only, exact, and paginated", async () => {
  const calls: Array<{ page: number; perPage: number }> = [];
  const client = {
    auth: {
      admin: {
        async listUsers(input: { page: number; perPage: number }) {
          calls.push(input);
          if (input.page === 1) {
            return {
              data: {
                users: [
                  {
                    id: "auth-1",
                    email: "other@cadence.test",
                    banned_until: null,
                  },
                  {
                    id: "auth-2",
                    email: "owner@cadence.test",
                    banned_until: null,
                  },
                  ...Array.from({ length: 998 }, (_, index) => ({
                    id: `auth-filler-${index}`,
                    email: `filler-${index}@cadence.test`,
                    banned_until: null,
                  })),
                ],
              },
              error: null,
            };
          }
          return {
            data: {
              users: [
                {
                  id: "auth-3",
                  email: "owner@cadence.test",
                  banned_until: null,
                },
              ],
            },
            error: null,
          };
        },
      },
    },
  } as unknown as SupabaseClient;

  const provider = new SupabaseAdministrativeAuthProvider(client);
  const accounts = await provider.findAccounts({
    provider: "local",
    loginIdentifier: "owner@cadence.test",
  });

  assert.deepEqual(accounts.map((account) => account.providerSubjectId), [
    "auth-2",
    "auth-3",
  ]);
  assert.deepEqual(calls, [
    { page: 1, perPage: 1000 },
    { page: 2, perPage: 1000 },
  ]);
});


test("administrative Auth creation accepts protected runtime credential but never returns it", async () => {
  let received: Record<string, unknown> | undefined;
  const client = {
    auth: {
      admin: {
        async createUser(input: Record<string, unknown>) {
          received = input;
          return {
            data: {
              user: {
                id: "auth-created",
                email: input.email,
                banned_until: null,
              },
            },
            error: null,
          };
        },
      },
    },
  } as unknown as SupabaseClient;

  const provider = new SupabaseAdministrativeAuthProvider(client);
  const account = await provider.createAccount(
    {
      provider: "local",
      loginIdentifier: "owner@cadence.test",
      manifestUserKey: "owner",
    },
    { password: "runtime-only-secret" },
  );

  assert.equal(account.providerSubjectId, "auth-created");
  assert.equal(account.loginIdentifier, "owner@cadence.test");
  assert.equal(JSON.stringify(account).includes("runtime-only-secret"), false);
  assert.equal(received?.password, "runtime-only-secret");
  assert.equal(received?.email_confirm, true);
});

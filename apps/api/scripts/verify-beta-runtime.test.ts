import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

import {
  loadCadenceRuntimeConfig,
  type CadenceRuntimeConfig,
} from "../src/bootstrap/cadence-config";
import {
  verifyBetaRuntime,
  type BetaRuntimeVerificationSources,
} from "./verify-beta-runtime";

const betaConfig = loadCadenceRuntimeConfig(resolve(
  process.cwd(),
  "../../config/cadence.runtime.ci.json",
));

function passingSources(
  counts: Record<string, number> = {},
  options: { visibleAnonymousTable?: string } = {},
): BetaRuntimeVerificationSources {
  return {
    criticalTableAvailable: async () => true,
    tableCount: async (table) => counts[table] ?? 0,
    subscriptionCount: async () => 1,
    anonymousRowVisible: async (table) =>
      table === options.visibleAnonymousTable,
  };
}

test("fresh verification rejects existing application data", async () => {
  await assert.rejects(
    () => verifyBetaRuntime({
      config: betaConfig,
      secretKey: "server-secret",
      requireEmptyApplicationData: true,
      sources: passingSources({ persons: 1 }),
    }),
    /Fresh Beta invariant failed/,
  );
});

test("deployed verification allows existing application data while keeping safety checks", async () => {
  const result = await verifyBetaRuntime({
    config: betaConfig,
    secretKey: "server-secret",
    requireEmptyApplicationData: false,
    sources: passingSources({ persons: 7, project_memberships: 12 }),
  });
  assert.equal(result.outcome, "PASS");
  assert.equal(result.requireEmptyApplicationData, false);
});

test("deployed verification still rejects anonymous sensitive-table exposure", async () => {
  await assert.rejects(
    () => verifyBetaRuntime({
      config: betaConfig,
      secretKey: "server-secret",
      requireEmptyApplicationData: false,
      sources: passingSources({}, { visibleAnonymousTable: "persons" }),
    }),
    /Anonymous Beta access exposed persons/,
  );
});

void (betaConfig satisfies CadenceRuntimeConfig);

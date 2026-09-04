import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  createCadenceWorkerServices,
} from "./create-cadence-worker-services";

const source = readFileSync(
  resolve(process.cwd(), "src/runtime/create-cadence-worker-services.ts"),
  "utf8",
);

test("worker service composition preserves governed repositories and services", () => {
  for (const constructor of [
    "SupabaseProjectMembershipLifecycleRepository",
    "ProjectMembershipExpiryProcessor",
    "SupabaseAuditRepository",
    "AuditService",
    "AuditDomainEventHandler",
    "SupabaseDiscussionRepository",
    "SupabaseTeamAgentRepository",
    "ProjectAuthorisationService",
    "DiscussionService",
    "TeamAgentService",
    "MessageCreatedV1Handler",
    "DomainEventProcessor",
  ]) {
    assert.match(source, new RegExp(`new ${constructor}\\b`));
  }
});

test("worker service boundary exposes only bounded callable jobs", () => {
  assert.match(source, /processMembershipExpiry/);
  assert.match(source, /processAuditNext/);
  assert.match(source, /processTeamAgentNext/);
  assert.doesNotMatch(source, /return\s*{[\s\S]*databaseClient/);

  const config = {
    configVersion: 1 as const,
    application: {
      name: "cadence" as const,
      environment: "beta" as const,
      publicUrl: "https://cadence-ci.example.invalid",
      apiBaseUrl: "",
      requestBodyLimitBytes: 1048576,
    },
    runtime: { provider: "cloudflare" as const },
    supabase: {
      url: "https://abc123.supabase.co",
      projectRef: "abc123",
      publishableKey: "sb_publishable_test",
      secretKeySecretRef: "SUPABASE_SECRET_KEY",
    },
    pilot: {
      projectId: "11111111-1111-4111-8111-111111111111",
      safeTargetMarker: "cadence-ci",
    },
    worker: {
      schedule: "* * * * *",
      maxRounds: 10,
      maxDeliveryAttempts: 20,
      maxMembershipExpiryAttempts: 20,
      softDeadlineSeconds: 20,
    },
    retry: { delaysSeconds: [60, 300, 900, 3600] },
  };
  const services = createCadenceWorkerServices({
    config,
    secrets: { supabaseSecretKey: "server-secret-fixture" },
  });

  assert.deepEqual(Object.keys(services).sort(), [
    "processAuditNext",
    "processMembershipExpiry",
    "processTeamAgentNext",
  ]);
  assert.equal("databaseClient" in services, false);
});

test("both event consumers share the canonical delivery retry policy", () => {
  assert.match(
    source,
    /createDeliveryRetryPolicy\(\s*input\.config\.retry\.delaysSeconds\s*,?\s*\)/,
  );
  assert.equal(
    [...source.matchAll(/new DomainEventProcessor\b/g)].length,
    2,
  );
  assert.equal(
    [...source.matchAll(/\{\s*retryPolicy\s*\}/g)].length,
    2,
  );
  assert.doesNotMatch(
    source,
    /\[60,\s*300,\s*900,\s*3600\]/,
  );
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  runCadenceWorkerCycle,
  type CadenceWorkerCycleServices,
} from "./cadence-worker-cycle";
import type { CadenceRuntimeConfig } from "../bootstrap/cadence-config";
import type { CadenceReleaseIdentity } from "../bootstrap/cadence-release";

const release: CadenceReleaseIdentity = {
  version: "1.2.3",
  commitSha: "0123456789abcdef0123456789abcdef01234567",
  buildId: "build-123",
};

const baseConfig: CadenceRuntimeConfig = {
  configVersion: 1,
  application: {
    name: "cadence",
    environment: "beta",
    publicUrl: "https://cadence-ci.example.invalid",
    apiBaseUrl: "",
    requestBodyLimitBytes: 1048576,
  },
  runtime: { provider: "cloudflare" },
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
    maxRounds: 3,
    maxDeliveryAttempts: 6,
    maxMembershipExpiryAttempts: 20,
    softDeadlineSeconds: 20,
  },
  retry: { delaysSeconds: [60, 300, 900, 3600] },
};

const noExpiry = {
  finalised: [],
  conflicts: [],
  remainingDue: false,
};

function services(
  overrides: Partial<CadenceWorkerCycleServices> = {},
): CadenceWorkerCycleServices {
  return {
    processMembershipExpiry: async () => noExpiry,
    processAuditNext: async () => false,
    processTeamAgentNext: async () => false,
    ...overrides,
  };
}

function run(
  serviceOverrides: Partial<CadenceWorkerCycleServices> = {},
  configOverrides: Partial<CadenceRuntimeConfig["worker"]> = {},
  clock: () => Date = () => new Date("2026-09-04T00:00:00.000Z"),
) {
  return runCadenceWorkerCycle({
    config: {
      ...baseConfig,
      worker: { ...baseConfig.worker, ...configOverrides },
    },
    release,
    runtime: "node",
    servicesFactory: async () => services(serviceOverrides),
    clock,
    generateRunId: () => "run-123",
  });
}

test("Audit failure does not suppress the Team Agent attempt", async () => {
  let teamAgentCalls = 0;
  const result = await run({
    processAuditNext: async () => { throw new Error("secret=do-not-log"); },
    processTeamAgentNext: async () => { teamAgentCalls += 1; return false; },
  }, { maxRounds: 1 });

  assert.equal(teamAgentCalls, 1);
  assert.equal(result.outcome, "DEGRADED");
  assert.deepEqual(result.failures, [{ job: "audit", code: "AUDIT_DELIVERY_FAILED" }]);
  assert.equal(JSON.stringify(result).includes("secret=do-not-log"), false);
});

test("Team Agent failure does not erase successful Audit work", async () => {
  const result = await run({
    processAuditNext: async () => true,
    processTeamAgentNext: async () => { throw new Error("team-agent-secret"); },
  }, { maxRounds: 1 });

  assert.equal(result.audit.processedCount, 1);
  assert.equal(result.teamAgent.failureCount, 1);
  assert.equal(result.outcome, "DEGRADED");
  assert.equal(JSON.stringify(result).includes("team-agent-secret"), false);
});

test("membership-expiry failure does not suppress Audit or Team Agent", async () => {
  let auditCalls = 0;
  let teamAgentCalls = 0;
  const result = await run({
    processMembershipExpiry: async () => { throw new Error("expiry-secret"); },
    processAuditNext: async () => { auditCalls += 1; return false; },
    processTeamAgentNext: async () => { teamAgentCalls += 1; return false; },
  }, { maxRounds: 1 });

  assert.equal(auditCalls, 1);
  assert.equal(teamAgentCalls, 1);
  assert.equal(result.membershipExpiry.failureCount, 1);
  assert.equal(JSON.stringify(result).includes("expiry-secret"), false);
});

test("membership expiry receives the configured attempt bound", async () => {
  let requested = 0;
  await run({
    processMembershipExpiry: async (maxMemberships) => {
      requested = maxMemberships;
      return noExpiry;
    },
  });

  assert.equal(requested, 20);
});

test("round robin stops when both event consumers return false", async () => {
  let auditCalls = 0;
  let teamAgentCalls = 0;
  const result = await run({
    processAuditNext: async () => { auditCalls += 1; return false; },
    processTeamAgentNext: async () => { teamAgentCalls += 1; return false; },
  }, { maxRounds: 3 });

  assert.equal(auditCalls, 1);
  assert.equal(teamAgentCalls, 1);
  assert.equal(result.remainingWorkDetected, false);
  assert.equal(result.outcome, "SUCCESS");
});

test("total delivery attempts never exceed the configured bound", async () => {
  let attempts = 0;
  const result = await run({
    processAuditNext: async () => { attempts += 1; return true; },
    processTeamAgentNext: async () => { attempts += 1; return true; },
  }, { maxDeliveryAttempts: 3, maxRounds: 5 });

  assert.equal(attempts, 3);
  assert.equal(result.maxDeliveryAttemptsReached, true);
  assert.equal(result.remainingWorkDetected, true);
});

test("cycle stops at maxRounds when work keeps being reported", async () => {
  let attempts = 0;
  const result = await run({
    processAuditNext: async () => { attempts += 1; return true; },
    processTeamAgentNext: async () => { attempts += 1; return true; },
  }, { maxRounds: 2, maxDeliveryAttempts: 20 });

  assert.equal(attempts, 4);
  assert.equal(result.maxRoundsReached, true);
  assert.equal(result.remainingWorkDetected, true);
});

test("soft deadline stops later work", async () => {
  const times = [
    new Date("2026-09-04T00:00:00.000Z"),
    new Date("2026-09-04T00:00:00.000Z"),
    new Date("2026-09-04T00:00:21.000Z"),
  ];
  const deadline = new Date("2026-09-04T00:00:21.000Z");
  let teamAgentCalls = 0;
  const result = await run({
    processAuditNext: async () => true,
    processTeamAgentNext: async () => { teamAgentCalls += 1; return true; },
  }, { maxRounds: 3, softDeadlineSeconds: 20 }, () => times.shift() ?? deadline);

  assert.equal(teamAgentCalls, 0);
  assert.equal(result.softDeadlineReached, true);
  assert.equal(result.remainingWorkDetected, true);
});

test("expiry look-ahead marks bounded remaining work", async () => {
  const result = await run({
    processMembershipExpiry: async () => ({
      finalised: [],
      conflicts: [],
      remainingDue: true,
    }),
  });

  assert.equal(result.membershipExpiry.remainingDueDetected, true);
  assert.equal(result.maxMembershipExpiryAttemptsReached, true);
  assert.equal(result.remainingWorkDetected, true);
});

test("service-establishment failure performs no jobs and returns safe FAILED", async () => {
  let jobs = 0;
  const result = await runCadenceWorkerCycle({
    config: baseConfig,
    release,
    runtime: "node",
    servicesFactory: () => { throw new Error("secret=runtime"); },
    clock: () => new Date("2026-09-04T00:00:00.000Z"),
    generateRunId: () => "run-123",
  });

  jobs += result.audit.processedCount + result.teamAgent.processedCount;
  assert.equal(jobs, 0);
  assert.equal(result.outcome, "FAILED");
  assert.deepEqual(result.failures, [{ job: "runtime", code: "RUNTIME_ESTABLISHMENT_FAILED" }]);
  assert.equal(JSON.stringify(result).includes("secret=runtime"), false);
});

test("no-work cycle returns SUCCESS without remaining work", async () => {
  const result = await run();

  assert.equal(result.outcome, "SUCCESS");
  assert.equal(result.remainingWorkDetected, false);
  assert.equal(result.failures.length, 0);
});

test("caught job errors are represented only by safe failure codes", async () => {
  const result = await run({
    processAuditNext: async () => { throw new Error("secret=do-not-log"); },
    processTeamAgentNext: async () => { throw new Error("service-role-value"); },
  }, { maxRounds: 1 });

  assert.deepEqual(result.failures, [
    { job: "audit", code: "AUDIT_DELIVERY_FAILED" },
    { job: "team-agent", code: "TEAM_AGENT_DELIVERY_FAILED" },
  ]);
  assert.equal(JSON.stringify(result).includes("secret=do-not-log"), false);
  assert.equal(JSON.stringify(result).includes("service-role-value"), false);
});

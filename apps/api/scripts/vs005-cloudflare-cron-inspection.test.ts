import assert from "node:assert/strict";
import test from "node:test";

import { inspectCronSchedules } from "./vs005-cloudflare-cron-inspection";
import type {
  CloudflareReadOnlyTransport,
  CloudflareReadOnlyTransportResult,
  CloudflareWorkerInspectionTarget,
} from "./vs005-cloudflare-readonly-transport";

const target: CloudflareWorkerInspectionTarget = {
  accountId: "account-test",
  workerName: "worker-test",
  publicHostname: "worker.example.test",
  configFingerprint: "fingerprint-test",
  generatedAccountId: "account-test",
  generatedWorkerName: "worker-test",
  profile: "FIRST_DEPLOYMENT_READINESS",
};

const canarySchedule = {
  cron: "0 0 * * *",
  created_on: "timestamp-canary",
  modified_on: "timestamp-canary-2",
  metadata: "metadata-canary",
};

function schedules(result: unknown, extra: Record<string, unknown> = {}): { success: true; result: unknown } {
  return { success: true, result, ...extra };
}

function transportFor(
  envelope: { success: true; result: unknown } | { success: false; errors: unknown[] },
): CloudflareReadOnlyTransport {
  return {
    read: async (): Promise<CloudflareReadOnlyTransportResult> => {
      if (envelope.success) return { kind: "SUCCESS", operation: "CRON_SCHEDULES", result: envelope.result };
      return {
        kind: "PROVIDER_FAILURE",
        operation: "CRON_SCHEDULES",
        errorCodes: [],
        errorsWellFormed: false,
      };
    },
  };
}

function unavailableTransport(kind: "AUTHENTICATION_FAILED" | "AUTHORIZATION_FAILED" | "NETWORK_UNAVAILABLE" | "UNEXPECTED_PROVIDER_ERROR"): CloudflareReadOnlyTransport {
  return {
    read: async (): Promise<CloudflareReadOnlyTransportResult> => ({
      kind: "UNAVAILABLE",
      failure: { operation: "CRON_SCHEDULES", kind },
    }),
  };
}

function assertUnavailable(value: unknown): void {
  assert.deepEqual(value, { state: "UNAVAILABLE", code: "CRON_SCHEDULES_UNAVAILABLE" });
  assert.doesNotMatch(JSON.stringify(value), /timestamp-canary|metadata-canary|message-canary|header-canary/);
}

test("parses one valid Cron expression and discards provider metadata", async () => {
  const result = await inspectCronSchedules(transportFor(schedules({ schedules: [canarySchedule] })), target);
  assert.deepEqual(result, { state: "OBSERVED_VALUE", value: ["0 0 * * *"] });
  assert.doesNotMatch(JSON.stringify(result), /timestamp-canary|metadata-canary/);
});

test("preserves provider order for multiple valid schedules", async () => {
  const result = await inspectCronSchedules(transportFor(schedules({
    schedules: [
      { cron: "0 0 * * *" },
      { cron: "*/15 * * * *" },
      { cron: "30 6 * * 1-5" },
    ],
  })), target);
  assert.deepEqual(result, { state: "OBSERVED_VALUE", value: ["0 0 * * *", "*/15 * * * *", "30 6 * * 1-5"] });
});

test("successful empty schedules are explicitly absent", async () => {
  assert.deepEqual(await inspectCronSchedules(transportFor(schedules({ schedules: [] })), target), { state: "OBSERVED_ABSENT" });
});

test("duplicate, malformed, invalid, oversized, or incomplete schedules are unavailable", async () => {
  const cases: unknown[] = [
    [{ cron: "0 0 * * *" }, { cron: "0 0 * * *" }],
    { schedules: [{ cron: "0 0 * * *" }, { cron: "0 0 * * *" }] },
    { schedules: [{ name: "missing-cron" }] },
    { schedules: [{ cron: "0 0 * * *\n" }] },
    { schedules: [{ cron: "not a cron expression" }] },
    { schedules: Array.from({ length: 129 }, () => ({ cron: "0 0 * * *" })) },
    {},
    { schedules: "not-an-array" },
    null,
    "not-an-object",
  ];
  for (const result of cases) {
    assertUnavailable(await inspectCronSchedules(transportFor(schedules(result)), target));
  }
});

test("provider failures never become an empty schedule result", async () => {
  assertUnavailable(await inspectCronSchedules(transportFor({ success: false, errors: [{ code: 10007, message: "message-canary" }] }), target));
  for (const kind of ["AUTHENTICATION_FAILED", "AUTHORIZATION_FAILED", "NETWORK_UNAVAILABLE", "UNEXPECTED_PROVIDER_ERROR"] as const) {
    assertUnavailable(await inspectCronSchedules(unavailableTransport(kind), target));
  }
});

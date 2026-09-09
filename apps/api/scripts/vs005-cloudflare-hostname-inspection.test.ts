import assert from "node:assert/strict";
import test from "node:test";

import {
  correlateWorkersDevHostname,
  inspectAccountWorkersDevSubdomain,
  inspectWorkersDevState,
  type CloudflareHostnameFacts,
} from "./vs005-cloudflare-hostname-inspection";
import type {
  CloudflareReadOnlyTransport,
  CloudflareReadOnlyTransportResult,
  CloudflareWorkerInspectionTarget,
} from "./vs005-cloudflare-readonly-transport";

const target: CloudflareWorkerInspectionTarget = {
  accountId: "portable-account",
  workerName: "portable-worker",
  publicHostname: "portable-worker.portable-team.workers.dev",
  configFingerprint: "a".repeat(64),
  generatedAccountId: "portable-account",
  generatedWorkerName: "portable-worker",
  profile: "POST_DEPLOYMENT_VERIFICATION",
};

function transport(result: CloudflareReadOnlyTransportResult): CloudflareReadOnlyTransport {
  return {
    read: async (route) => {
      assert.deepEqual(route.target, target);
      return result;
    },
  };
}

function success(operation: "WORKER_SUBDOMAIN" | "ACCOUNT_SUBDOMAIN", result: unknown): CloudflareReadOnlyTransportResult {
  return { kind: "SUCCESS", operation, result };
}

function unavailable(operation: "WORKER_SUBDOMAIN" | "ACCOUNT_SUBDOMAIN", kind = "NETWORK_UNAVAILABLE"): CloudflareReadOnlyTransportResult {
  return { kind: "UNAVAILABLE", failure: { operation, kind: kind as never } };
}

function providerFailure(operation: "WORKER_SUBDOMAIN" | "ACCOUNT_SUBDOMAIN"): CloudflareReadOnlyTransportResult {
  return { kind: "PROVIDER_FAILURE", operation, errorCodes: [1000], errorsWellFormed: true };
}

test("parses enabled and disabled Worker workers.dev state", async () => {
  assert.deepEqual(await inspectWorkersDevState(transport(success("WORKER_SUBDOMAIN", { enabled: true, metadata: "canary" })), target), { state: "OBSERVED_VALUE", value: true });
  assert.deepEqual(await inspectWorkersDevState(transport(success("WORKER_SUBDOMAIN", { enabled: false })), target), { state: "OBSERVED_ABSENT" });
});

test("fails closed for missing or malformed enabled state and provider failures", async () => {
  for (const result of [
    success("WORKER_SUBDOMAIN", {}),
    success("WORKER_SUBDOMAIN", { enabled: "true" }),
    providerFailure("WORKER_SUBDOMAIN"),
    unavailable("WORKER_SUBDOMAIN", "UNEXPECTED_PROVIDER_ERROR"),
  ]) {
    assert.equal((await inspectWorkersDevState(transport(result), target)).state, "UNAVAILABLE");
  }
});

test("parses only a bounded account workers.dev subdomain label", async () => {
  assert.deepEqual(await inspectAccountWorkersDevSubdomain(transport(success("ACCOUNT_SUBDOMAIN", { subdomain: "portable-team", metadata: "canary" })), target), { state: "OBSERVED_VALUE", value: "portable-team" });
  for (const value of [undefined, "", "bad.label", "bad label", "-bad", "x".repeat(64)]) {
    assert.equal((await inspectAccountWorkersDevSubdomain(transport(success("ACCOUNT_SUBDOMAIN", { subdomain: value })), target)).state, "UNAVAILABLE");
  }
});

test("account inspection is target-bound and does not expose standalone accountId API", async () => {
  let routeTarget: CloudflareWorkerInspectionTarget | undefined;
  const accountTransport: CloudflareReadOnlyTransport = {
    read: async (route) => {
      assert.equal(route.operation, "ACCOUNT_SUBDOMAIN");
      routeTarget = route.target;
      return success("ACCOUNT_SUBDOMAIN", { subdomain: "portable-team" });
    },
  };
  await inspectAccountWorkersDevSubdomain(accountTransport, target);
  assert.equal(routeTarget?.workerName, target.workerName);
  assert.equal(routeTarget?.configFingerprint, target.configFingerprint);
});

test("account provider failures and incomplete responses are unavailable", async () => {
  for (const result of [
    success("ACCOUNT_SUBDOMAIN", { metadata: "only" }),
    success("ACCOUNT_SUBDOMAIN", { subdomain: 42 }),
    providerFailure("ACCOUNT_SUBDOMAIN"),
    unavailable("ACCOUNT_SUBDOMAIN", "AUTHORIZATION_FAILED"),
  ]) {
    assert.equal((await inspectAccountWorkersDevSubdomain(transport(result), target)).state, "UNAVAILABLE");
  }
});

test("correlates only the canonical hostname from enabled state and account label", () => {
  const facts: CloudflareHostnameFacts = {
    workersDevEnabled: { state: "OBSERVED_VALUE", value: true },
    accountWorkersDevSubdomain: { state: "OBSERVED_VALUE", value: "portable-team" },
    hostname: { state: "UNAVAILABLE", code: "not-used" },
  };
  assert.deepEqual(correlateWorkersDevHostname({ target, workersDevEnabled: facts.workersDevEnabled, accountSubdomain: facts.accountWorkersDevSubdomain }), { state: "OBSERVED_VALUE", value: target.publicHostname });
  assert.deepEqual(correlateWorkersDevHostname({ target: { ...target, publicHostname: "wrong.workers.dev" }, workersDevEnabled: facts.workersDevEnabled, accountSubdomain: facts.accountWorkersDevSubdomain }), { state: "UNAVAILABLE", code: "WORKERS_DEV_HOSTNAME_UNAVAILABLE" });
  assert.deepEqual(correlateWorkersDevHostname({ target, workersDevEnabled: { state: "OBSERVED_ABSENT" }, accountSubdomain: facts.accountWorkersDevSubdomain }), { state: "OBSERVED_ABSENT" });
  for (const enabled of [{ state: "UNAVAILABLE", code: "x" } as const]) {
    assert.equal(correlateWorkersDevHostname({ target, workersDevEnabled: enabled, accountSubdomain: facts.accountWorkersDevSubdomain }).state, "UNAVAILABLE");
  }
  assert.equal(correlateWorkersDevHostname({ target, workersDevEnabled: facts.workersDevEnabled, accountSubdomain: { state: "UNAVAILABLE", code: "x" } }).state, "UNAVAILABLE");
});

test("correlation retains no provider metadata or alternate hostname", () => {
  const result = correlateWorkersDevHostname({
    target: { ...target, publicHostname: "portable-worker.portable-team.workers.dev", },
    workersDevEnabled: { state: "OBSERVED_VALUE", value: true },
    accountSubdomain: { state: "OBSERVED_VALUE", value: "portable-team" },
  });
  assert.deepEqual(result, { state: "OBSERVED_VALUE", value: "portable-worker.portable-team.workers.dev" });
  assert.doesNotMatch(JSON.stringify(result), /metadata|message|header|canary|cadence-beta|mycadence/);
});

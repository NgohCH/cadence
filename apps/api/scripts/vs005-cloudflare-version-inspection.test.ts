import assert from "node:assert/strict";
import test from "node:test";

import {
  inspectDeployableVersions,
  inspectVersion,
  type CloudflareVersionIdentity,
} from "./vs005-cloudflare-version-inspection";
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
  profile: "ROLLBACK_READINESS",
};

const fingerprint = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const release = {
  version: "1.2.3",
  commitSha: "0123456789abcdef0123456789abcdef01234567",
  buildId: "2026-09-09T00:00:00Z",
};

const versionBindings = [
  { name: "CADENCE_CONFIG_FINGERPRINT", type: "plain_text", value: fingerprint },
  { name: "CADENCE_RELEASE_VERSION", type: "plain_text", value: release.version },
  { name: "CADENCE_COMMIT_SHA", type: "plain_text", value: release.commitSha },
  { name: "CADENCE_BUILD_ID", type: "plain_text", value: release.buildId },
  { name: "CADENCE_RUNTIME_CONFIG_JSON", type: "json", value: "runtime-json-canary" },
  { name: "ARBITRARY_BINDING", type: "plain_text", value: "arbitrary-canary" },
  { name: "SECRET_LOOKING", type: "secret_text", value: "secret-value-canary" },
];

function transportFor(
  result: unknown,
  operation: "DEPLOYABLE_VERSIONS" | "VERSION" = "DEPLOYABLE_VERSIONS",
  requestedVersionId = "version-a",
  failure?: CloudflareReadOnlyTransportResult,
): CloudflareReadOnlyTransport {
  return {
    read: async (route): Promise<CloudflareReadOnlyTransportResult> => {
      assert.equal(route.operation, operation);
      if (operation === "VERSION") assert.equal((route as { versionId: string }).versionId, requestedVersionId);
      return failure ?? { kind: "SUCCESS", operation, result };
    },
  };
}

function unavailable(value: unknown): void {
  assert.deepEqual(value, { state: "UNAVAILABLE", code: "CLOUDFLARE_VERSION_UNAVAILABLE" });
  assert.doesNotMatch(JSON.stringify(value), /canary|author|annotation|metadata|secret-value|runtime-json/);
}

test("returns the complete bounded deployable version ID list without rollback selection", async () => {
  const result = await inspectDeployableVersions(
    transportFor({ items: [{ id: "version-a" }, { id: "version-b" }] }),
    target,
  );
  assert.deepEqual(result, { state: "OBSERVED_VALUE", value: ["version-a", "version-b"] });
  assert.equal("expectedPriorVersion" in result, false);
  assert.equal("rollbackTarget" in result, false);
});

test("a complete empty deployable version list is an observed empty value", async () => {
  assert.deepEqual(
    await inspectDeployableVersions(transportFor({ items: [] }), target),
    { state: "OBSERVED_VALUE", value: [] },
  );
});

test("deployable version parsing rejects pagination, malformed, duplicate, invalid, incomplete, and oversized results", async () => {
  const cases: unknown[] = [
    { items: [{ id: "version-a" }, { id: "version-a" }] },
    { items: [{ id: "not a safe version" }] },
    { versions: [{ id: "version-a" }] },
    { items: [{ id: "version-a" }], complete: false },
    { items: Array.from({ length: 129 }, (_, index) => ({ id: `version-${index}` })) },
    { items: [{ id: "version-a" }], page: 1 },
    null,
    "not-an-object",
  ];
  for (const result of cases) unavailable(await inspectDeployableVersions(transportFor(result), target));
});

test("deployable version provider and transport failures remain unavailable", async () => {
  unavailable(await inspectDeployableVersions(transportFor(null, "DEPLOYABLE_VERSIONS", "version-a", {
    kind: "PROVIDER_FAILURE",
    operation: "DEPLOYABLE_VERSIONS",
    errorCodes: [99999],
    errorsWellFormed: true,
  }), target));
  unavailable(await inspectDeployableVersions(transportFor(null, "DEPLOYABLE_VERSIONS", "version-a", {
    kind: "UNAVAILABLE",
    failure: { operation: "DEPLOYABLE_VERSIONS", kind: "NETWORK_UNAVAILABLE" },
  }), target));
});

test("exact version inspection requires the caller-supplied version ID and validates all identities", async () => {
  const result = await inspectVersion(
    transportFor({ id: "version-a", bindings: versionBindings, author: "author-canary", annotations: "annotation-canary", metadata: "metadata-canary" }, "VERSION"),
    target,
    "version-a",
  );
  assert.equal(result.state, "OBSERVED_VALUE");
  if (result.state === "OBSERVED_VALUE") {
    const identity: CloudflareVersionIdentity = result.value;
    assert.deepEqual(identity, { providerVersionId: "version-a", release, configFingerprint: fingerprint });
  }
});

test("wrong requested or returned version IDs are unavailable", async () => {
  unavailable(await inspectVersion(transportFor({ id: "version-b", bindings: versionBindings }, "VERSION"), target, "version-a"));
  unavailable(await inspectVersion(transportFor({ bindings: versionBindings }, "VERSION"), target, "version-a"));
});

test("exact version identity detail rejects malformed or incomplete identity bindings", async () => {
  const cases = [
    versionBindings.filter((binding) => binding.name !== "CADENCE_BUILD_ID"),
    versionBindings.map((binding) => binding.name === "CADENCE_CONFIG_FINGERPRINT" ? { ...binding, value: "invalid" } : binding),
    versionBindings.map((binding) => binding.name === "CADENCE_COMMIT_SHA" ? { ...binding, value: "invalid" } : binding),
    [...versionBindings, { name: "CADENCE_BUILD_ID", type: "plain_text", value: release.buildId }],
  ];
  for (const bindings of cases) unavailable(await inspectVersion(transportFor({ id: "version-a", bindings }, "VERSION"), target, "version-a"));
});

test("exact version provider failures and unapproved errors are unavailable without raw material", async () => {
  unavailable(await inspectVersion(transportFor(null, "VERSION", "version-a", {
    kind: "PROVIDER_FAILURE",
    operation: "VERSION",
    errorCodes: [10007],
    errorsWellFormed: true,
  }), target, "version-a"));
  unavailable(await inspectVersion(transportFor(null, "VERSION", "version-a", {
    kind: "UNAVAILABLE",
    failure: { operation: "VERSION", kind: "AUTHORIZATION_FAILED" },
  }), target, "version-a"));
});

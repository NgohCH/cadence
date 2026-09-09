import assert from "node:assert/strict";
import test from "node:test";

import {
  inspectWorkerSettings,
  type CloudflareWorkerSettingsFacts,
} from "./vs005-cloudflare-worker-settings";
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

const fingerprint = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const release = {
  version: "1.2.3",
  commitSha: "0123456789abcdef0123456789abcdef01234567",
  buildId: "2026-09-09T00:00:00Z",
};

function binding(name: string, type: string, value: unknown = "value-canary"): Record<string, unknown> {
  return { name, type, value };
}

function settings(bindings: readonly unknown[], extra: Record<string, unknown> = {}): { success: true; result: unknown } {
  return {
    success: true,
    result: {
      bindings,
      providerMetadata: "metadata-canary",
      ...extra,
    },
  };
}

function transportFor(
  envelope: { success: true; result: unknown } | { success: false; errors: unknown[] },
): CloudflareReadOnlyTransport {
  return {
    read: async (): Promise<CloudflareReadOnlyTransportResult> => {
      if (envelope.success) return { kind: "SUCCESS", operation: "WORKER_SETTINGS", result: envelope.result };
      return {
        kind: "PROVIDER_FAILURE",
        operation: "WORKER_SETTINGS",
        errorCodes: [],
        errorsWellFormed: false,
      };
    },
  };
}

function factsUnavailable(facts: CloudflareWorkerSettingsFacts): void {
  assert.equal(facts.workerConfigFingerprint.state, "UNAVAILABLE");
  assert.equal(facts.nonSecretBindingNames.state, "UNAVAILABLE");
  assert.equal(facts.secretNames.state, "UNAVAILABLE");
  assert.equal(facts.currentRelease.state, "UNAVAILABLE");
  assert.doesNotMatch(JSON.stringify(facts), /canary|metadata|message|credential|secret-value/);
}

function completeBindings(): Record<string, unknown>[] {
  return [
    binding("SUPABASE_SECRET_KEY", "secret_text", "secret-value-canary"),
    binding("CADENCE_CONFIG_FINGERPRINT", "plain_text", fingerprint),
    binding("CADENCE_RELEASE_VERSION", "plain_text", release.version),
    binding("CADENCE_COMMIT_SHA", "plain_text", release.commitSha),
    binding("CADENCE_BUILD_ID", "plain_text", release.buildId),
    binding("CADENCE_RUNTIME_CONFIG_JSON", "json", "runtime-json-canary"),
    binding("ARBITRARY_PLAIN", "plain_text", "arbitrary-canary"),
    binding("ARBITRARY_JSON", "json", { secret: "json-canary" }),
    binding("OTHER_SECRET", "secret_text", "other-secret-canary"),
  ];
}

test("exactly one required secret and four identities produce bounded settings facts", async () => {
  const facts = await inspectWorkerSettings(transportFor(settings(completeBindings())), target);
  assert.deepEqual(facts, {
    workerConfigFingerprint: { state: "OBSERVED_VALUE", value: fingerprint },
    nonSecretBindingNames: {
      state: "OBSERVED_VALUE",
      value: [
        "CADENCE_CONFIG_FINGERPRINT",
        "CADENCE_RELEASE_VERSION",
        "CADENCE_COMMIT_SHA",
        "CADENCE_BUILD_ID",
        "CADENCE_RUNTIME_CONFIG_JSON",
        "ARBITRARY_PLAIN",
        "ARBITRARY_JSON",
      ],
    },
    secretNames: { state: "OBSERVED_VALUE", value: ["SUPABASE_SECRET_KEY"] },
    currentRelease: { state: "OBSERVED_VALUE", value: release },
  });
  assert.doesNotMatch(JSON.stringify(facts), /runtime-json-canary|arbitrary-canary|json-canary|secret-value-canary|other-secret-canary|metadata-canary/);
});

test("a complete settings result without the required secret reports explicit absence", async () => {
  const facts = await inspectWorkerSettings(
    transportFor(settings(completeBindings().filter((entry) => entry.name !== "SUPABASE_SECRET_KEY"))),
    target,
  );
  assert.equal(facts.secretNames.state, "OBSERVED_ABSENT");
  assert.equal(facts.workerConfigFingerprint.state, "OBSERVED_VALUE");
  assert.equal(facts.currentRelease.state, "OBSERVED_VALUE");
});

test("wrong or duplicate required secret bindings fail closed", async () => {
  for (const bindings of [
    completeBindings().map((entry) => entry.name === "SUPABASE_SECRET_KEY" ? binding(entry.name, "plain_text", "secret-value-canary") : entry),
    [...completeBindings(), binding("SUPABASE_SECRET_KEY", "secret_text", "another-secret-canary")],
  ]) {
    const facts = await inspectWorkerSettings(transportFor(settings(bindings)), target);
    assert.equal(facts.secretNames.state, "UNAVAILABLE");
    assert.equal(facts.workerConfigFingerprint.state, "OBSERVED_VALUE");
    assert.equal(facts.currentRelease.state, "OBSERVED_VALUE");
    assert.doesNotMatch(JSON.stringify(facts), /secret-value-canary|another-secret-canary/);
  }
});

test("complete empty bindings report absent secret and unavailable identity facts", async () => {
  const facts = await inspectWorkerSettings(transportFor(settings([])), target);
  assert.equal(facts.secretNames.state, "OBSERVED_ABSENT");
  assert.equal(facts.nonSecretBindingNames.state, "OBSERVED_VALUE");
  assert.deepEqual(facts.nonSecretBindingNames, { state: "OBSERVED_VALUE", value: [] });
  assert.equal(facts.workerConfigFingerprint.state, "UNAVAILABLE");
  assert.equal(facts.currentRelease.state, "UNAVAILABLE");
});

test("malformed, incomplete, and oversized settings are unavailable", async () => {
  for (const envelope of [
    settings([{ name: "BROKEN" }]),
    { success: true as const, result: {} },
    settings(Array.from({ length: 129 }, (_, index) => binding(`BINDING_${index}`, "plain_text"))),
    settings(completeBindings(), { complete: false }),
  ]) {
    factsUnavailable(await inspectWorkerSettings(transportFor(envelope), target));
  }
});

test("identity bindings require exact plain_text types, uniqueness, and existing validators", async () => {
  const cases = [
    ["wrong type", completeBindings().map((entry) => entry.name === "CADENCE_BUILD_ID" ? binding(entry.name, "json", release.buildId) : entry)],
    ["duplicate", [...completeBindings(), binding("CADENCE_CONFIG_FINGERPRINT", "plain_text", fingerprint)]],
    ["fingerprint", completeBindings().map((entry) => entry.name === "CADENCE_CONFIG_FINGERPRINT" ? binding(entry.name, "plain_text", "not-a-fingerprint") : entry)],
    ["commit", completeBindings().map((entry) => entry.name === "CADENCE_COMMIT_SHA" ? binding(entry.name, "plain_text", "not-a-sha") : entry)],
    ["release", completeBindings().map((entry) => entry.name === "CADENCE_RELEASE_VERSION" ? binding(entry.name, "plain_text", "bad release\nvalue") : entry)],
    ["build", completeBindings().map((entry) => entry.name === "CADENCE_BUILD_ID" ? binding(entry.name, "plain_text", "bad build value") : entry)],
    ["missing component", completeBindings().filter((entry) => entry.name !== "CADENCE_RELEASE_VERSION")],
  ] as const;
  for (const [name, bindings] of cases) {
    const facts = await inspectWorkerSettings(transportFor(settings(bindings)), target);
    assert.equal(
      facts.workerConfigFingerprint.state,
      name === "fingerprint" || name === "duplicate" ? "UNAVAILABLE" : "OBSERVED_VALUE",
    );
    assert.equal(
      facts.currentRelease.state,
      name === "duplicate" || name === "fingerprint" ? "OBSERVED_VALUE" : "UNAVAILABLE",
    );
  }
});

test("provider failures remain bounded and retain no settings material", async () => {
  factsUnavailable(await inspectWorkerSettings(transportFor({ success: false, errors: [{ code: 10007, message: "message-canary" }] }), target));
});

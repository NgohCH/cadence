import assert from "node:assert/strict";
import test from "node:test";

import {
  fingerprintCadenceRuntimeConfig,
  validateCadenceRuntimeConfig,
} from "../src/bootstrap/cadence-config";
import type { CadenceReleaseIdentity } from "../src/bootstrap/cadence-release";
import { buildCloudflareDeployment } from "./vs005-generate-deployment";
import {
  createCloudflareStructuredReadOnlyProvider,
  inspectCloudflareReadOnly,
  type CloudflareStructuredReadOnlyProvider,
} from "./vs005-cloudflare-structured-inspection";
import type { CloudflareReadOnlyTransport } from "./vs005-cloudflare-readonly-transport";
import type { Vs005Observation } from "./vs005-provider-observations";

const release: CadenceReleaseIdentity = {
  version: "1.2.3",
  commitSha: "0123456789abcdef0123456789abcdef01234567",
  buildId: "2026-09-09T00:00:00Z",
};

const config = validateCadenceRuntimeConfig({
  configVersion: 1,
  application: {
    name: "cadence",
    environment: "qa",
    publicUrl: "https://portable-worker.portable-team.workers.dev",
    apiBaseUrl: "",
    requestBodyLimitBytes: 1_048_576,
  },
  runtime: { provider: "cloudflare" },
  cloudflare: { accountId: "portable-account", workerName: "portable-worker" },
  supabase: {
    url: "https://portableproject.supabase.co",
    projectRef: "portableproject",
    publishableKey: "publishable-portable",
    secretKeySecretRef: "SUPABASE_SECRET_KEY",
  },
  pilot: {
    projectId: "11111111-1111-4111-8111-111111111111",
    safeTargetMarker: "portable-safe-target",
  },
  worker: {
    schedule: "0 * * * *",
    maxRounds: 10,
    maxDeliveryAttempts: 20,
    maxMembershipExpiryAttempts: 20,
    softDeadlineSeconds: 20,
  },
  retry: { delaysSeconds: [60, 300] },
});

const generatedConfig = buildCloudflareDeployment({ config, release }).wrangler;
const fingerprint = fingerprintCadenceRuntimeConfig(config);
const observed = <T>(value: T): Vs005Observation<T> => ({ state: "OBSERVED_VALUE", value });
const absent = <T>(): Vs005Observation<T> => ({ state: "OBSERVED_ABSENT" });
const unavailable = <T>(code = "TEST_UNAVAILABLE"): Vs005Observation<T> => ({ state: "UNAVAILABLE", code });

function fakeProvider(input: {
  workerExists?: Vs005Observation<boolean>;
  deployableVersions?: Vs005Observation<readonly string[]>;
  version?: Vs005Observation<{
    providerVersionId: string;
    release: CadenceReleaseIdentity;
    configFingerprint: string;
  }>;
} = {}) {
  const calls: string[] = [];
  const versionIds: string[] = [];
  const provider: CloudflareStructuredReadOnlyProvider = {
    inspectCurrentDeployment: async (target) => {
      calls.push("CURRENT_DEPLOYMENT");
      assert.equal(target.accountId, "portable-account");
      assert.equal(target.workerName, "portable-worker");
      assert.equal(target.configFingerprint, fingerprint);
      return {
        workerExists: input.workerExists ?? observed(true),
        currentDeployment: input.workerExists?.state === "OBSERVED_ABSENT"
          ? absent()
          : observed({ deploymentId: "deployment-current", versions: [{ providerVersionId: "version-current", percentage: 100 }] }),
      };
    },
    inspectWorkerSettings: async () => {
      calls.push("WORKER_SETTINGS");
      return {
        workerConfigFingerprint: observed(fingerprint),
        nonSecretBindingNames: observed(["ASSETS", "CADENCE_RUNTIME_CONFIG_JSON"]),
        secretNames: observed(["SUPABASE_SECRET_KEY"]),
        currentRelease: observed(release),
        raw: "metadata-canary",
      } as never;
    },
    inspectCronSchedules: async () => {
      calls.push("CRON_SCHEDULES");
      return observed(["0 * * * *"]);
    },
    inspectDeployableVersions: async () => {
      calls.push("DEPLOYABLE_VERSIONS");
      return input.deployableVersions ?? observed(["version-current", "version-prior"]);
    },
    inspectVersion: async (_target, versionId) => {
      calls.push("VERSION");
      versionIds.push(versionId);
      return input.version ?? observed({ providerVersionId: versionId, release, configFingerprint: fingerprint });
    },
    inspectWorkersDevState: async () => {
      calls.push("WORKER_SUBDOMAIN");
      return observed(true);
    },
    inspectAccountWorkersDevSubdomain: async () => {
      calls.push("ACCOUNT_SUBDOMAIN");
      return observed("portable-team");
    },
  };
  return { provider, calls, versionIds };
}

function request(profile: "FIRST_DEPLOYMENT_READINESS" | "POST_DEPLOYMENT_VERIFICATION" | "ROLLBACK_READINESS") {
  return { config, release, generatedConfig, profile } as const;
}

test("composes the complete Worker-present first-deployment snapshot and correlation", async () => {
  const fake = fakeProvider();
  const result = await inspectCloudflareReadOnly(fake.provider, request("FIRST_DEPLOYMENT_READINESS"), () => new Date("2026-09-09T01:02:03Z"));

  assert.deepEqual(fake.calls, ["CURRENT_DEPLOYMENT", "WORKER_SETTINGS", "CRON_SCHEDULES", "WORKER_SUBDOMAIN", "ACCOUNT_SUBDOMAIN"]);
  assert.deepEqual(result.correlation, {
    accountId: "portable-account",
    workerName: "portable-worker",
    configFingerprint: fingerprint,
    providerOrigin: "api.cloudflare.com",
    profile: "FIRST_DEPLOYMENT_READINESS",
    completedOperations: ["CURRENT_DEPLOYMENT", "WORKER_SETTINGS", "CRON_SCHEDULES", "WORKER_SUBDOMAIN", "ACCOUNT_SUBDOMAIN"],
    observedAt: "2026-09-09T01:02:03.000Z",
  });
  assert.deepEqual(result.observations.accountId, observed("portable-account"));
  assert.deepEqual(result.observations.workerName, observed("portable-worker"));
  assert.deepEqual(result.observations.workerExists, observed(true));
  assert.deepEqual(result.observations.workerConfigFingerprint, observed(fingerprint));
  assert.deepEqual(result.observations.hostname, observed("portable-worker.portable-team.workers.dev"));
  assert.deepEqual(result.observations.priorVersion, absent());
  assert.doesNotMatch(JSON.stringify(result), /metadata-canary|author-canary|header-canary/);
});

test("proven absent Worker skips Worker-owned operations and preserves absence", async () => {
  const fake = fakeProvider({ workerExists: absent() });
  const result = await inspectCloudflareReadOnly(fake.provider, request("FIRST_DEPLOYMENT_READINESS"), () => new Date("2026-09-09T01:02:03Z"));

  assert.deepEqual(fake.calls, ["CURRENT_DEPLOYMENT", "ACCOUNT_SUBDOMAIN"]);
  assert.deepEqual(result.correlation.completedOperations, ["CURRENT_DEPLOYMENT", "ACCOUNT_SUBDOMAIN"]);
  assert.deepEqual(result.observations.accountId, observed("portable-account"));
  assert.deepEqual(result.observations.workerName, observed("portable-worker"));
  assert.deepEqual(result.observations.workerExists, absent());
  assert.deepEqual(result.observations.currentDeployment, absent());
  assert.deepEqual(result.observations.workerConfigFingerprint, absent());
  assert.deepEqual(result.observations.cronSchedules, absent());
  assert.deepEqual(result.observations.nonSecretBindingNames, absent());
  assert.deepEqual(result.observations.secretNames, absent());
  assert.deepEqual(result.observations.currentRelease, absent());
  assert.deepEqual(result.observations.workersDevEnabled, absent());
  assert.deepEqual(result.observations.hostname, absent());
});

test("unavailable Worker state skips dependent calls and does not promote canonical facts", async () => {
  const fake = fakeProvider({ workerExists: unavailable() });
  const result = await inspectCloudflareReadOnly(fake.provider, request("POST_DEPLOYMENT_VERIFICATION"), () => new Date("2026-09-09T01:02:03Z"));

  assert.deepEqual(fake.calls, ["CURRENT_DEPLOYMENT", "ACCOUNT_SUBDOMAIN"]);
  assert.deepEqual(result.correlation.completedOperations, ["ACCOUNT_SUBDOMAIN"]);
  assert.equal(result.observations.accountId.state, "UNAVAILABLE");
  assert.equal(result.observations.workerName.state, "UNAVAILABLE");
  assert.equal(result.observations.currentDeployment.state, "UNAVAILABLE");
  assert.equal(result.observations.workerConfigFingerprint.state, "UNAVAILABLE");
  assert.equal(result.observations.cronSchedules.state, "UNAVAILABLE");
  assert.equal(result.observations.currentRelease.state, "UNAVAILABLE");
  assert.equal(result.observations.hostname.state, "UNAVAILABLE");
});

test("post-deployment records the exact deterministic operation set", async () => {
  const fake = fakeProvider();
  const result = await inspectCloudflareReadOnly(fake.provider, request("POST_DEPLOYMENT_VERIFICATION"), () => new Date("2026-09-09T01:02:03Z"));
  assert.deepEqual(result.correlation.completedOperations, ["CURRENT_DEPLOYMENT", "WORKER_SETTINGS", "CRON_SCHEDULES", "WORKER_SUBDOMAIN", "ACCOUNT_SUBDOMAIN"]);
  assert.equal(result.correlation.profile, "POST_DEPLOYMENT_VERIFICATION");
});

test("rollback interprets only explicit expected version membership at composition", async () => {
  const fake = fakeProvider({ deployableVersions: observed(["version-other", "version-prior"]) });
  const expectedPriorVersion = { providerVersionId: "version-prior", release, configFingerprint: fingerprint };
  const result = await inspectCloudflareReadOnly(fake.provider, { ...request("ROLLBACK_READINESS"), expectedPriorVersion }, () => new Date("2026-09-09T01:02:03Z"));

  assert.deepEqual(fake.versionIds, ["version-prior"]);
  assert.deepEqual(result.observations.priorVersion, observed(expectedPriorVersion));
  assert.deepEqual(result.correlation.completedOperations, ["CURRENT_DEPLOYMENT", "WORKER_SETTINGS", "CRON_SCHEDULES", "DEPLOYABLE_VERSIONS", "VERSION", "WORKER_SUBDOMAIN", "ACCOUNT_SUBDOMAIN"]);
});

test("rollback maps missing explicit version to absence without selecting another", async () => {
  for (const ids of [[], ["version-other", "version-latest"]]) {
    const fake = fakeProvider({ deployableVersions: observed(ids) });
    const result = await inspectCloudflareReadOnly(fake.provider, {
      ...request("ROLLBACK_READINESS"),
      expectedPriorVersion: { providerVersionId: "version-prior", release, configFingerprint: fingerprint },
    }, () => new Date("2026-09-09T01:02:03Z"));
    assert.deepEqual(result.observations.priorVersion, absent());
    assert.deepEqual(fake.versionIds, []);
    assert.deepEqual(result.correlation.completedOperations, ["CURRENT_DEPLOYMENT", "WORKER_SETTINGS", "CRON_SCHEDULES", "DEPLOYABLE_VERSIONS", "WORKER_SUBDOMAIN", "ACCOUNT_SUBDOMAIN"]);
  }
});

test("rollback leaves unavailable list or detail unavailable", async () => {
  const expectedPriorVersion = { providerVersionId: "version-prior", release, configFingerprint: fingerprint };
  const listFailure = fakeProvider({ deployableVersions: unavailable() });
  assert.equal((await inspectCloudflareReadOnly(listFailure.provider, { ...request("ROLLBACK_READINESS"), expectedPriorVersion }, () => new Date())).observations.priorVersion.state, "UNAVAILABLE");
  assert.deepEqual(listFailure.versionIds, []);

  const detailFailure = fakeProvider({ version: unavailable() });
  assert.equal((await inspectCloudflareReadOnly(detailFailure.provider, { ...request("ROLLBACK_READINESS"), expectedPriorVersion }, () => new Date())).observations.priorVersion.state, "UNAVAILABLE");
  assert.deepEqual(detailFailure.versionIds, ["version-prior"]);
});

test("rejects generated account or Worker drift before provider calls", async () => {
  const fake = fakeProvider();
  await assert.rejects(
    inspectCloudflareReadOnly(fake.provider, { ...request("FIRST_DEPLOYMENT_READINESS"), generatedConfig: { ...generatedConfig, name: "other-worker" } }, () => new Date()),
    /target/i,
  );
  assert.deepEqual(fake.calls, []);
});

test("transport-backed structured provider exposes only seven read operations", () => {
  const transport: CloudflareReadOnlyTransport = { read: async () => unavailableTransport() };
  assert.deepEqual(Object.keys(createCloudflareStructuredReadOnlyProvider(transport)).sort(), [
    "inspectAccountWorkersDevSubdomain",
    "inspectCronSchedules",
    "inspectCurrentDeployment",
    "inspectDeployableVersions",
    "inspectVersion",
    "inspectWorkerSettings",
    "inspectWorkersDevState",
  ]);
});

function unavailableTransport() {
  return { kind: "UNAVAILABLE", failure: { operation: "CURRENT_DEPLOYMENT", kind: "NETWORK_UNAVAILABLE" } } as const;
}

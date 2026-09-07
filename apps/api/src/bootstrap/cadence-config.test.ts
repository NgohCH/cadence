import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  fingerprintCadenceRuntimeConfig,
  resolveCadenceConfigPath,
  resolveCadenceSecrets,
  validateCadenceRuntimeConfig,
} from "./cadence-config";
import { CADENCE_RUNTIME_CONFIG_SCHEMA } from "./cadence-config-schema";

const valid = {
  configVersion: 1,
  application: {
    name: "cadence",
    environment: "beta",
    publicUrl: "https://cadence-beta.example.test",
    apiBaseUrl: "",
    requestBodyLimitBytes: 1048576,
  },
  runtime: { provider: "cloudflare" },
  cloudflare: {
    accountId: "account-123",
    workerName: "worker-test",
  },
  supabase: {
    url: "https://abc123.supabase.co",
    projectRef: "abc123",
    publishableKey: "sb_publishable_test",
    secretKeySecretRef: "SUPABASE_SECRET_KEY",
  },
  pilot: {
    projectId: "11111111-1111-4111-8111-111111111111",
    safeTargetMarker: "cadence-beta",
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

test("accepts one valid beta configuration", () => {
  assert.deepEqual(validateCadenceRuntimeConfig(valid), valid);
});

test("rejects a Cloudflare config without accountId", () => {
  assert.throws(
    () => validateCadenceRuntimeConfig({
      ...valid,
      cloudflare: { workerName: "worker-test" },
    }),
    /accountId/,
  );
});

test("rejects a Cloudflare config without workerName", () => {
  assert.throws(
    () => validateCadenceRuntimeConfig({
      ...valid,
      cloudflare: { accountId: "account-123" },
    }),
    /workerName/,
  );
});

test("accepts a structurally valid alternate Cloudflare target", () => {
  assert.doesNotThrow(() => validateCadenceRuntimeConfig({
    ...valid,
    application: {
      ...valid.application,
      publicUrl: "https://alternate.example.test",
    },
    cloudflare: {
      accountId: "account-alternate",
      workerName: "worker-alternate",
    },
    supabase: {
      ...valid.supabase,
      url: "https://alternate.supabase.co",
      projectRef: "alternate",
    },
  }));
});

test("configuration fingerprint is deterministic and changes with material config", () => {
  const config = validateCadenceRuntimeConfig(valid);
  const first = fingerprintCadenceRuntimeConfig(config);
  const second = fingerprintCadenceRuntimeConfig({ ...config });
  const changed = fingerprintCadenceRuntimeConfig({
    ...config,
    worker: { ...config.worker, maxRounds: config.worker.maxRounds + 1 },
  });

  assert.match(first, /^[0-9a-f]{64}$/);
  assert.equal(first, second);
  assert.notEqual(first, changed);
});

test("configuration fingerprint includes every mutable non-secret setting", () => {
  const config = validateCadenceRuntimeConfig(valid);
  const baseline = fingerprintCadenceRuntimeConfig(config);
  const mutations: Array<[string, (base: typeof config) => typeof config]> = [
    ["environment", (base) => ({
      ...base,
      application: { ...base.application, environment: "qa" },
    })],
    ["publicUrl", (base) => ({
      ...base,
      application: { ...base.application, publicUrl: "https://cadence-beta-2.example.test" },
    })],
    ["apiBaseUrl", (base) => ({
      ...base,
      application: { ...base.application, apiBaseUrl: "http://127.0.0.1:3000" },
    })],
    ["requestBodyLimitBytes", (base) => ({
      ...base,
      application: { ...base.application, requestBodyLimitBytes: 524288 },
    })],
    ["runtime.provider", (base) => ({
      ...base,
      runtime: { provider: "node" },
    })],
    ["cloudflare.accountId", (base) => ({
      ...base,
      cloudflare: {
        accountId: "account-other",
        workerName: base.cloudflare?.workerName ?? "worker-test",
      },
    })],
    ["cloudflare.workerName", (base) => ({
      ...base,
      cloudflare: {
        accountId: base.cloudflare?.accountId ?? "account-123",
        workerName: "worker-other",
      },
    })],
    ["supabase.url/projectRef", (base) => ({
      ...base,
      supabase: {
        ...base.supabase,
        url: "https://xyz789.supabase.co",
        projectRef: "xyz789",
      },
    })],
    ["supabase.publishableKey", (base) => ({
      ...base,
      supabase: { ...base.supabase, publishableKey: "sb_publishable_other" },
    })],
    ["supabase.secretKeySecretRef", (base) => ({
      ...base,
      supabase: { ...base.supabase, secretKeySecretRef: "CADENCE_SUPABASE_SECRET_KEY" },
    })],
    ["pilot.projectId", (base) => ({
      ...base,
      pilot: { ...base.pilot, projectId: "22222222-2222-4222-8222-222222222222" },
    })],
    ["pilot.safeTargetMarker", (base) => ({
      ...base,
      pilot: { ...base.pilot, safeTargetMarker: "cadence-beta-2" },
    })],
    ["worker.schedule", (base) => ({
      ...base,
      worker: { ...base.worker, schedule: "*/2 * * * *" },
    })],
    ["worker.maxRounds", (base) => ({
      ...base,
      worker: { ...base.worker, maxRounds: 9 },
    })],
    ["worker.maxDeliveryAttempts", (base) => ({
      ...base,
      worker: { ...base.worker, maxDeliveryAttempts: 19 },
    })],
    ["worker.maxMembershipExpiryAttempts", (base) => ({
      ...base,
      worker: { ...base.worker, maxMembershipExpiryAttempts: 19 },
    })],
    ["worker.softDeadlineSeconds", (base) => ({
      ...base,
      worker: { ...base.worker, softDeadlineSeconds: 19 },
    })],
    ["retry.delaysSeconds", (base) => ({
      ...base,
      retry: { delaysSeconds: [60, 600, 1800] },
    })],
  ];

  for (const [name, mutate] of mutations) {
    assert.notEqual(
      fingerprintCadenceRuntimeConfig(mutate(config)),
      baseline,
      `${name} must change the canonical config fingerprint`,
    );
  }
});

test("rejects beta Supabase URL/project-ref mismatch", () => {
  assert.throws(
    () => validateCadenceRuntimeConfig({
      ...valid,
      supabase: { ...valid.supabase, projectRef: "wrong" },
    }),
    /Supabase project reference does not match/,
  );
});

test("rejects invalid worker resource bounds", () => {
  assert.throws(
    () => validateCadenceRuntimeConfig({
      ...valid,
      worker: { ...valid.worker, maxDeliveryAttempts: 0 },
    }),
    /maxDeliveryAttempts/,
  );
});

test("rejects resource settings outside the M1 safety envelope", () => {
  for (const value of [
    { application: { ...valid.application, requestBodyLimitBytes: 1048577 } },
    { worker: { ...valid.worker, maxRounds: 101 } },
    { worker: { ...valid.worker, maxDeliveryAttempts: 201 } },
    { worker: { ...valid.worker, maxMembershipExpiryAttempts: 0 } },
    { worker: { ...valid.worker, softDeadlineSeconds: 31 } },
  ]) {
    assert.throws(() => validateCadenceRuntimeConfig({ ...valid, ...value }));
  }
});

test("resolves only the configured server secret reference", () => {
  const config = validateCadenceRuntimeConfig(valid);
  const resolved = resolveCadenceSecrets(config, {
    SUPABASE_SECRET_KEY: "server-secret",
    EXTRA_VALUE: "must-not-be-consumed",
  });
  assert.deepEqual(resolved, { supabaseSecretKey: "server-secret" });
});

test("local accepts loopback Supabase with no hosted project ref", () => {
  assert.doesNotThrow(() => validateCadenceRuntimeConfig({
    ...valid,
    application: {
      ...valid.application,
      environment: "local",
      publicUrl: "http://127.0.0.1:5173",
      apiBaseUrl: "http://127.0.0.1:3000",
    },
    runtime: { provider: "node" },
    supabase: {
      ...valid.supabase,
      url: "http://127.0.0.1:54321",
      projectRef: null,
    },
  }));
});

test("rejects malformed public/Supabase URLs", () => {
  assert.throws(
    () => validateCadenceRuntimeConfig({
      ...valid,
      application: { ...valid.application, publicUrl: "not-a-url" },
    }),
    /URL/,
  );
  assert.throws(
    () => validateCadenceRuntimeConfig({
      ...valid,
      supabase: { ...valid.supabase, url: "not-a-url" },
    }),
    /URL/,
  );
  assert.throws(
    () => validateCadenceRuntimeConfig({
      ...valid,
      application: { ...valid.application, apiBaseUrl: "http://not-allowed.example" },
    }),
    /apiBaseUrl|same-origin/,
  );
});

test("rejects unsupported environment and provider", () => {
  assert.throws(
    () => validateCadenceRuntimeConfig({
      ...valid,
      application: { ...valid.application, environment: "production" },
    }),
    /environment/,
  );
  assert.throws(
    () => validateCadenceRuntimeConfig({
      ...valid,
      runtime: { provider: "unknown" },
    }),
    /provider/,
  );
});

test("rejects invalid pilot project id and empty secret reference", () => {
  assert.throws(
    () => validateCadenceRuntimeConfig({
      ...valid,
      pilot: { ...valid.pilot, projectId: "not-a-uuid" },
    }),
    /projectId/,
  );
  assert.throws(
    () => validateCadenceRuntimeConfig({
      ...valid,
      supabase: { ...valid.supabase, secretKeySecretRef: "" },
    }),
    /secretKeySecretRef/,
  );
});

test("rejects retry delays that are nonpositive or decreasing", () => {
  for (const delaysSeconds of [[0, 60], [60, 30]]) {
    assert.throws(
      () => validateCadenceRuntimeConfig({
        ...valid,
        retry: { delaysSeconds },
      }),
      /delaysSeconds/,
    );
  }
});

test("config path uses --config before CADENCE_CONFIG_PATH and otherwise fails closed", () => {
  assert.equal(
    resolveCadenceConfigPath({
      argv: ["node", "server", "--config", "config/cadence.runtime.beta.json"],
      environment: { CADENCE_CONFIG_PATH: "wrong.json" },
    }),
    "config/cadence.runtime.beta.json",
  );

  assert.equal(
    resolveCadenceConfigPath({
      argv: ["node", "server"],
      environment: { CADENCE_CONFIG_PATH: "config/cadence.runtime.local.json" },
    }),
    "config/cadence.runtime.local.json",
  );

  assert.throws(
    () => resolveCadenceConfigPath({ argv: ["node", "server"], environment: {} }),
    /Cadence config path is required/,
  );
});

test("tracked JSON schema is serialization-equivalent to the executable schema", () => {
  const trackedSchema = JSON.parse(readFileSync(
    resolve(process.cwd(), "../../config/cadence.runtime.schema.json"),
    "utf8",
  ));
  assert.deepEqual(trackedSchema, CADENCE_RUNTIME_CONFIG_SCHEMA);
});

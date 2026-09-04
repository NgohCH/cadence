import assert from "node:assert/strict";
import test from "node:test";

import { buildCadencePublicWebConfig } from "./vs005-generate-web-config";
import type { CadenceRuntimeConfig } from "../src/bootstrap/cadence-config";

const betaConfig: CadenceRuntimeConfig = {
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
    maxRounds: 10,
    maxDeliveryAttempts: 20,
    maxMembershipExpiryAttempts: 20,
    softDeadlineSeconds: 20,
  },
  retry: { delaysSeconds: [60, 300, 900, 3600] },
};

const localConfig: CadenceRuntimeConfig = {
  ...betaConfig,
  application: {
    ...betaConfig.application,
    environment: "local",
    publicUrl: "http://127.0.0.1:5173",
    apiBaseUrl: "http://127.0.0.1:3000",
  },
  runtime: { provider: "node" },
  supabase: {
    ...betaConfig.supabase,
    url: "http://127.0.0.1:54321",
    projectRef: null,
  },
};

test("derives the six public hosted browser values from canonical config", () => {
  assert.deepEqual(buildCadencePublicWebConfig(betaConfig), {
    cadenceEnvironment: "beta",
    apiBaseUrl: "",
    supabaseUrl: "https://abc123.supabase.co",
    supabasePublishableKey: "sb_publishable_test",
    supabaseProjectRef: "abc123",
    projectId: "11111111-1111-4111-8111-111111111111",
  });
});

test("derives local API and null local project ref", () => {
  assert.deepEqual(buildCadencePublicWebConfig(localConfig), {
    cadenceEnvironment: "local",
    apiBaseUrl: "http://127.0.0.1:3000",
    supabaseUrl: "http://127.0.0.1:54321",
    supabasePublishableKey: "sb_publishable_test",
    supabaseProjectRef: null,
    projectId: "11111111-1111-4111-8111-111111111111",
  });
});

test("generated browser shape contains no server-only or worker values", () => {
  const publicConfig = buildCadencePublicWebConfig(betaConfig);

  assert.deepEqual(Object.keys(publicConfig).sort(), [
    "apiBaseUrl",
    "cadenceEnvironment",
    "projectId",
    "supabaseProjectRef",
    "supabasePublishableKey",
    "supabaseUrl",
  ]);
  assert.equal("SUPABASE_SECRET_KEY" in publicConfig, false);
  assert.equal("secretKeySecretRef" in publicConfig, false);
  assert.equal("safeTargetMarker" in publicConfig, false);
  assert.equal("worker" in publicConfig, false);
  assert.equal(JSON.stringify(publicConfig).includes("service_role"), false);
});

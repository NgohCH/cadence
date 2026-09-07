import assert from "node:assert/strict";
import test from "node:test";
import {
  validateCadenceRuntimeConfig,
  type CadenceRuntimeConfig,
} from "./cadence-config";
import {
  assertCadenceTargetPolicy,
  getCadenceTargetFacts,
  VS005_BETA_TARGET_POLICY,
  type CadenceTargetPolicy,
} from "./cadence-target-policy";

const betaConfig: CadenceRuntimeConfig = validateCadenceRuntimeConfig({
  configVersion: 1,
  application: {
    name: "cadence",
    environment: "beta",
    publicUrl: "https://mycadence.ngohch-3d6.workers.dev",
    apiBaseUrl: "",
    requestBodyLimitBytes: 1048576,
  },
  runtime: { provider: "cloudflare" },
  cloudflare: {
    accountId: "3d6a31905ac44e9563a523f9c86cbb8d",
    workerName: "mycadence",
  },
  supabase: {
    url: "https://pwmhasbmacmeerbsagda.supabase.co",
    projectRef: "pwmhasbmacmeerbsagda",
    publishableKey: "sb_publishable_test",
    secretKeySecretRef: "SUPABASE_SECRET_KEY",
  },
  pilot: {
    projectId: "3503f8c7-1996-44d1-8b63-1fca36db89f8",
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
});

function configWith(changes: {
  application?: Partial<CadenceRuntimeConfig["application"]>;
  cloudflare?: Partial<NonNullable<CadenceRuntimeConfig["cloudflare"]>>;
  pilot?: Partial<CadenceRuntimeConfig["pilot"]>;
  supabase?: Partial<CadenceRuntimeConfig["supabase"]>;
}): CadenceRuntimeConfig {
  return validateCadenceRuntimeConfig({
    ...betaConfig,
    application: { ...betaConfig.application, ...changes.application },
    cloudflare: { ...betaConfig.cloudflare, ...changes.cloudflare },
    pilot: { ...betaConfig.pilot, ...changes.pilot },
    supabase: { ...betaConfig.supabase, ...changes.supabase },
  });
}

test("exact canonical Beta target is accepted", () => {
  assert.deepEqual(getCadenceTargetFacts(betaConfig), {
    environment: "beta",
    safeTargetMarker: "cadence-beta",
    cloudflare: {
      accountId: "3d6a31905ac44e9563a523f9c86cbb8d",
      workerName: "mycadence",
    },
    publicUrl: "https://mycadence.ngohch-3d6.workers.dev",
    supabaseProjectRef: "pwmhasbmacmeerbsagda",
    pilotProjectId: "3503f8c7-1996-44d1-8b63-1fca36db89f8",
  });
  assert.doesNotThrow(() => assertCadenceTargetPolicy(
    betaConfig,
    VS005_BETA_TARGET_POLICY,
  ));
});

test("wrong environment is rejected", () => {
  assert.throws(
    () => assertCadenceTargetPolicy(
      configWith({ application: { environment: "qa" } }),
      VS005_BETA_TARGET_POLICY,
    ),
    /TARGET_POLICY_MISMATCH: environment/,
  );
});

test("wrong safe marker is rejected", () => {
  assert.throws(
    () => assertCadenceTargetPolicy(
      configWith({ pilot: { safeTargetMarker: "cadence-other" } }),
      VS005_BETA_TARGET_POLICY,
    ),
    /TARGET_POLICY_MISMATCH: safeTargetMarker/,
  );
});

test("wrong Cloudflare account is rejected", () => {
  assert.throws(
    () => assertCadenceTargetPolicy(
      configWith({ cloudflare: { accountId: "account-other" } }),
      VS005_BETA_TARGET_POLICY,
    ),
    /TARGET_POLICY_MISMATCH: cloudflare\.accountId/,
  );
});

test("wrong Worker is rejected", () => {
  assert.throws(
    () => assertCadenceTargetPolicy(
      configWith({ cloudflare: { workerName: "worker-other" } }),
      VS005_BETA_TARGET_POLICY,
    ),
    /TARGET_POLICY_MISMATCH: cloudflare\.workerName/,
  );
});

test("wrong public URL is rejected", () => {
  assert.throws(
    () => assertCadenceTargetPolicy(
      configWith({ application: { publicUrl: "https://other.example.test" } }),
      VS005_BETA_TARGET_POLICY,
    ),
    /TARGET_POLICY_MISMATCH: publicUrl/,
  );
});

test("wrong Supabase ref is rejected", () => {
  assert.throws(
    () => assertCadenceTargetPolicy(
      configWith({
        supabase: {
          url: "https://otherref.supabase.co",
          projectRef: "otherref",
        },
      }),
      VS005_BETA_TARGET_POLICY,
    ),
    /TARGET_POLICY_MISMATCH: supabaseProjectRef/,
  );
});

test("wrong controlled Project is rejected", () => {
  assert.throws(
    () => assertCadenceTargetPolicy(
      configWith({
        pilot: { projectId: "22222222-2222-4222-8222-222222222222" },
      }),
      VS005_BETA_TARGET_POLICY,
    ),
    /TARGET_POLICY_MISMATCH: pilotProjectId/,
  );
});

test("cadence-dev is rejected", () => {
  assert.throws(
    () => assertCadenceTargetPolicy(
      configWith({ cloudflare: { workerName: "cadence-dev" } }),
      VS005_BETA_TARGET_POLICY,
    ),
    /TARGET_POLICY_MISMATCH: cloudflare\.workerName/,
  );
});

test("alternate structurally valid target is rejected by Beta policy", () => {
  const alternate = validateCadenceRuntimeConfig({
    ...betaConfig,
    application: {
      ...betaConfig.application,
      publicUrl: "https://worker-alternate.example.test",
    },
    cloudflare: {
      accountId: "account-alternate",
      workerName: "worker-alternate",
    },
    supabase: {
      ...betaConfig.supabase,
      url: "https://alternate.supabase.co",
      projectRef: "alternate",
    },
    pilot: {
      ...betaConfig.pilot,
      projectId: "22222222-2222-4222-8222-222222222222",
      safeTargetMarker: "cadence-alternate",
    },
  });

  assert.doesNotThrow(() => validateCadenceRuntimeConfig(alternate));
  assert.throws(
    () => assertCadenceTargetPolicy(alternate, VS005_BETA_TARGET_POLICY),
    /TARGET_POLICY_MISMATCH: safeTargetMarker/,
  );
});

test("policy exports only non-secret target authority", () => {
  const text = JSON.stringify(VS005_BETA_TARGET_POLICY);
  assert.doesNotMatch(text, /server-secret|SUPABASE_SECRET_KEY=|api[_-]?token/i);
  assert.equal("supabaseProjectName" in VS005_BETA_TARGET_POLICY.expected, false);
});

test("same assertion function accepts a separately authorized target policy", () => {
  const alternate = validateCadenceRuntimeConfig({
    ...betaConfig,
    application: {
      ...betaConfig.application,
      environment: "qa",
      publicUrl: "https://qa-worker.example.test",
    },
    cloudflare: {
      accountId: "account-qa",
      workerName: "worker-qa",
    },
    supabase: {
      ...betaConfig.supabase,
      url: "https://qaref.supabase.co",
      projectRef: "qaref",
    },
    pilot: {
      ...betaConfig.pilot,
      projectId: "22222222-2222-4222-8222-222222222222",
      safeTargetMarker: "cadence-qa",
    },
  });
  const policy: CadenceTargetPolicy = {
    name: "separately-authorized-target",
    expected: getCadenceTargetFacts(alternate),
  };

  assert.doesNotThrow(() => assertCadenceTargetPolicy(alternate, policy));
});

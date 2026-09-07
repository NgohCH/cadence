import assert from "node:assert/strict";
import test from "node:test";

import {
  fingerprintCadenceRuntimeConfig,
  validateCadenceRuntimeConfig,
  type CadenceRuntimeConfig,
} from "../src/bootstrap/cadence-config";
import { VS005_BETA_TARGET_POLICY } from "../src/bootstrap/cadence-target-policy";
import type { CadenceReleaseIdentity } from "../src/bootstrap/cadence-release";
import {
  runVs005DeployPlan,
  type Vs005DeployPlanDependencies,
  type Vs005PlanInspection,
} from "./vs005-deploy-plan";
import {
  type Vs005ProviderObservationSnapshot,
  validateVs005ObservationCompleteness,
} from "./vs005-provider-observations";

const release: CadenceReleaseIdentity = {
  version: "1.0.0",
  commitSha: "0123456789abcdef0123456789abcdef01234567",
  buildId: "2026-09-04T10:00:00Z",
};

const observed = <T>(value: T) => ({ state: "OBSERVED_VALUE" as const, value });
const absent = () => ({ state: "OBSERVED_ABSENT" as const });
const unavailable = (code: string) => ({ state: "UNAVAILABLE" as const, code });

function betaConfig(): CadenceRuntimeConfig {
  return validateCadenceRuntimeConfig({
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
      publishableKey: "sb_publishable_beta",
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
}

function observations(
  config: CadenceRuntimeConfig,
  overrides: Partial<Vs005ProviderObservationSnapshot> = {},
): Vs005ProviderObservationSnapshot {
  return {
    accountId: observed(config.cloudflare!.accountId),
    workerName: observed(config.cloudflare!.workerName),
    workerExists: observed(true),
    workerConfigFingerprint: observed(fingerprintCadenceRuntimeConfig(config)),
    cronSchedules: observed([config.worker.schedule]),
    nonSecretBindingNames: observed(["ASSETS"]),
    secretNames: observed([config.supabase.secretKeySecretRef]),
    currentRelease: observed(release),
    priorVersion: absent(),
    hostname: observed(new URL(config.application.publicUrl).hostname),
    ...overrides,
  };
}

function inspection(
  config: CadenceRuntimeConfig,
  overrides: Partial<Vs005PlanInspection> = {},
): Vs005PlanInspection {
  return {
    observations: observations(config),
    hostnameReady: true,
    generatedConfigValid: true,
    webBuildReady: true,
    ...overrides,
  };
}

function makeDependencies(
  config: CadenceRuntimeConfig,
  overrides: Partial<Vs005DeployPlanDependencies> = {},
): Vs005DeployPlanDependencies {
  return {
    targetPolicy: VS005_BETA_TARGET_POLICY,
    loadConfig: () => config,
    loadRelease: () => release,
    inspect: async () => inspection(config),
    generatePlanId: () => "plan-1",
    writePlan: async () => undefined,
    ...overrides,
  };
}

test("exact Beta tuple produces a PASS plan", async () => {
  const config = betaConfig();
  const plan = await runVs005DeployPlan(
    { configPath: "beta.json", outputPath: "plan.json" },
    makeDependencies(config),
  );

  assert.equal(plan.formatVersion, 2);
  assert.equal(plan.readiness, "PASS");
  assert.deepEqual(plan.intendedTarget, VS005_BETA_TARGET_POLICY.expected);
  assert.deepEqual(plan.targetPolicy, { name: VS005_BETA_TARGET_POLICY.name });
  assert.equal(plan.observationPhase, "FIRST_DEPLOYMENT_READINESS");
  assert.equal(plan.observedProvider.workerExists.state, "OBSERVED_VALUE");
  assert.deepEqual(plan.mutationEnvelope, {
    workerAction: "CREATE_OR_UPDATE",
    cronAction: "NO_CHANGE",
    secretNamesToSet: [],
  });
  assert.equal(plan.database.migrationAction, "NONE");
  assert.deepEqual(plan.destructiveActions, []);
  assert.doesNotMatch(JSON.stringify(plan), /server-secret|secret-value|token=/i);
});

test("Beta policy rejects alternate generic target", async () => {
  const config = betaConfig();
  const alternate = validateCadenceRuntimeConfig({
    ...config,
    cloudflare: { accountId: "other-account", workerName: "other-worker" },
    application: { ...config.application, publicUrl: "https://other.example.test" },
    supabase: {
      ...config.supabase,
      url: "https://otherref.supabase.co",
      projectRef: "otherref",
    },
    pilot: { ...config.pilot, projectId: "11111111-1111-4111-8111-111111111111" },
  });
  let inspectCalls = 0;

  await assert.rejects(
    () => runVs005DeployPlan(
      { configPath: "alternate.json", outputPath: "plan.json" },
      makeDependencies(alternate, {
        inspect: async () => {
          inspectCalls += 1;
          return inspection(alternate);
        },
      }),
    ),
    /TARGET_POLICY_MISMATCH/,
  );
  assert.equal(inspectCalls, 0);
});

test("missing required observation blocks", async () => {
  const config = betaConfig();
  const plan = await runVs005DeployPlan(
    { configPath: "beta.json", outputPath: "plan.json" },
    makeDependencies(config, {
      inspect: async () => inspection(config, {
        observations: observations(config, {
          accountId: unavailable("ACCOUNT_ID_UNAVAILABLE"),
        }),
      }),
    }),
  );

  assert.equal(plan.readiness, "BLOCKED");
  assert.ok(plan.blockers.some((blocker) => blocker.code === "ACCOUNT_ID_OBSERVATION_REQUIRED"));
});

test("expected absent Worker is represented", async () => {
  const config = betaConfig();
  const plan = await runVs005DeployPlan(
    { configPath: "beta.json", outputPath: "plan.json" },
    makeDependencies(config, {
      inspect: async () => inspection(config, {
        observations: observations(config, {
          workerExists: absent(),
          currentRelease: absent(),
          cronSchedules: absent(),
          workerConfigFingerprint: absent(),
          nonSecretBindingNames: absent(),
          priorVersion: absent(),
        }),
      }),
    }),
  );

  assert.equal(plan.readiness, "PASS");
  assert.deepEqual(plan.observedProvider.workerExists, { state: "OBSERVED_ABSENT" });
  assert.equal(plan.providerTarget.workerExists, false);
  assert.equal(plan.rollback.application, "UNAVAILABLE");
});

test("unexpected absence outside mutation envelope blocks", async () => {
  const config = betaConfig();
  const providerFacts = observations(config, {
    workerExists: observed(true),
    cronSchedules: absent(),
    secretNames: absent(),
  });
  const unplannedBlockers = validateVs005ObservationCompleteness({
    phase: "FIRST_DEPLOYMENT_READINESS",
    observations: providerFacts,
    mutationEnvelope: {
      workerAction: "CREATE_OR_UPDATE",
      cronAction: "NO_CHANGE",
      secretNamesToSet: [],
    },
  });
  assert.ok(unplannedBlockers.some((blocker) => blocker.code === "CRON_ABSENCE_NOT_PLANNED"));

  const plan = await runVs005DeployPlan(
    { configPath: "beta.json", outputPath: "plan.json" },
    makeDependencies(config, {
      inspect: async () => inspection(config, { observations: providerFacts }),
    }),
  );

  assert.equal(plan.readiness, "PASS");
  assert.deepEqual(plan.mutationEnvelope, {
    workerAction: "CREATE_OR_UPDATE",
    cronAction: "CREATE_OR_CHANGE",
    secretNamesToSet: ["SUPABASE_SECRET_KEY"],
  });
});

test("first deployment does not require prior version", async () => {
  const config = betaConfig();
  const plan = await runVs005DeployPlan(
    { configPath: "beta.json", outputPath: "plan.json" },
    makeDependencies(config, {
      inspect: async () => inspection(config, {
        observations: observations(config, {
          workerExists: absent(),
          workerConfigFingerprint: absent(),
          cronSchedules: absent(),
          nonSecretBindingNames: absent(),
          currentRelease: absent(),
          priorVersion: absent(),
        }),
      }),
    }),
  );

  assert.equal(plan.readiness, "PASS");
  assert.deepEqual(plan.observedProvider.priorVersion, { state: "OBSERVED_ABSENT" });
});

test("account and Worker observation mismatches block the plan", async () => {
  const config = betaConfig();
  const plan = await runVs005DeployPlan(
    { configPath: "beta.json", outputPath: "plan.json" },
    makeDependencies(config, {
      inspect: async () => inspection(config, {
        observations: observations(config, {
          accountId: observed("other-account"),
          workerName: observed("other-worker"),
        }),
      }),
    }),
  );

  assert.equal(plan.readiness, "BLOCKED");
  assert.ok(plan.blockers.some((blocker) => blocker.code === "PROVIDER_ACCOUNT_MISMATCH"));
  assert.ok(plan.blockers.some((blocker) => blocker.code === "PROVIDER_WORKER_MISMATCH"));
});

test("existing Worker missing configuration observation blocks", async () => {
  const config = betaConfig();
  const plan = await runVs005DeployPlan(
    { configPath: "beta.json", outputPath: "plan.json" },
    makeDependencies(config, {
      inspect: async () => inspection(config, {
        observations: observations(config, {
          workerConfigFingerprint: unavailable("CONFIG_UNAVAILABLE"),
        }),
      }),
    }),
  );

  assert.equal(plan.readiness, "BLOCKED");
  assert.ok(plan.blockers.some((blocker) => blocker.code === "WORKER_CONFIG_OBSERVATION_REQUIRED"));
});

test("existing Worker release mismatch blocks the plan", async () => {
  const config = betaConfig();
  const plan = await runVs005DeployPlan(
    { configPath: "beta.json", outputPath: "plan.json" },
    makeDependencies(config, {
      inspect: async () => inspection(config, {
        observations: observations(config, {
          currentRelease: observed({ ...release, version: "2.0.0" }),
        }),
      }),
    }),
  );

  assert.equal(plan.readiness, "BLOCKED");
  assert.ok(plan.blockers.some((blocker) => blocker.code === "PROVIDER_RELEASE_MISMATCH"));
});

test("existing Worker configuration fingerprint mismatch blocks the plan", async () => {
  const config = betaConfig();
  const plan = await runVs005DeployPlan(
    { configPath: "beta.json", outputPath: "plan.json" },
    makeDependencies(config, {
      inspect: async () => inspection(config, {
        observations: observations(config, {
          workerConfigFingerprint: observed("different-config-fingerprint"),
        }),
      }),
    }),
  );

  assert.equal(plan.readiness, "BLOCKED");
  assert.ok(plan.blockers.some((blocker) => blocker.code === "PROVIDER_CONFIG_FINGERPRINT_MISMATCH"));
});

test("secret-looking provider fixture fields do not enter the serialized plan", async () => {
  const config = betaConfig();
  const unsafeFacts = {
    ...observations(config),
    secretValue: "server-secret-must-not-escape",
    currentRelease: {
      ...observations(config).currentRelease,
      providerToken: "provider-token-must-not-escape",
    },
  } as unknown as Vs005ProviderObservationSnapshot;
  const plan = await runVs005DeployPlan(
    { configPath: "beta.json", outputPath: "plan.json" },
    makeDependencies(config, {
      inspect: async () => inspection(config, { observations: unsafeFacts }),
    }),
  );

  assert.doesNotMatch(JSON.stringify(plan), /server-secret-must-not-escape|provider-token-must-not-escape/);
  assert.doesNotMatch(JSON.stringify(plan.blockers), /server-secret-must-not-escape|provider-token-must-not-escape/);
});

test("planning dependencies expose no mutation capability", () => {
  const config = betaConfig();
  const dependencies = makeDependencies(config);
  assert.equal("deploy" in dependencies, false);
  assert.equal("apply" in dependencies, false);
  assert.equal("mutate" in dependencies, false);
  assert.equal("rollback" in dependencies, false);
  assert.equal("uploadSecret" in dependencies, false);
});

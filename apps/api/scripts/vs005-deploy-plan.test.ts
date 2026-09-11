import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import {
  fingerprintCadenceRuntimeConfig,
  validateCadenceRuntimeConfig,
  type CadenceRuntimeConfig,
} from "../src/bootstrap/cadence-config";
import { VS005_BETA_TARGET_POLICY } from "../src/bootstrap/cadence-target-policy";
import type { CadenceReleaseIdentity } from "../src/bootstrap/cadence-release";
import { buildCloudflareDeployment } from "./vs005-generate-deployment";
import {
  inspectVs005PlanInputs,
  runVs005DeployPlan,
  runCli,
  resolveDeployPlanOperatorPaths,
  type Vs005DeployPlanDependencies,
} from "./vs005-deploy-plan";
import type { Vs005LocalDeploymentReadiness } from "./vs005-local-deployment-readiness";
import {
  type Vs005CorrelatedProviderInspection,
  type Vs005ProviderObservationSnapshot,
  type Vs005StructuredProviderObservationSnapshot,
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
const repositoryRoot = resolve(process.cwd(), "../..");

test("normalizes deploy-plan operator paths from the Cadence repository root", () => {
  const paths = resolveDeployPlanOperatorPaths({ configPath: "./config/../config/cadence.runtime.beta.json", outputPath: ".cadence/vs005/../vs005/plan.json" });
  assert.equal(paths.configPath, resolve(repositoryRoot, "config/cadence.runtime.beta.json"));
  assert.equal(paths.outputPath, resolve(repositoryRoot, ".cadence/vs005/plan.json"));
});

test("normalization ignores INIT_CWD and preserves absolute paths", () => {
  const original = process.env.INIT_CWD;
  process.env.INIT_CWD = "C:\\unrelated";
  try {
    const paths = resolveDeployPlanOperatorPaths({ configPath: "C:/Operator Files/../Operator Files/config.json", outputPath: ".cadence/plan.json" });
    assert.equal(paths.configPath, "C:\\Operator Files\\config.json");
    assert.equal(paths.outputPath, resolve(repositoryRoot, ".cadence/plan.json"));
  } finally {
    if (original === undefined) delete process.env.INIT_CWD;
    else process.env.INIT_CWD = original;
  }
});

test("CLI orchestration uses identical repository-root paths from every caller cwd", async () => {
  const observed: Array<{ configPath: string; outputPath: string; publicConfigPath: string; webDistPath: string }> = [];
  const unrelatedCwd = mkdtempSync(resolve(tmpdir(), "cadence-unrelated-"));
  const originalCwd = process.cwd();
  try {
    for (const callerCwd of [repositoryRoot, resolve(repositoryRoot, "apps/api"), unrelatedCwd]) {
      process.chdir(callerCwd);
      await runCli(["--config", "config/cadence.runtime.beta.json", "--out", resolve(repositoryRoot, ".cadence/vs005/plan.json")], {
        onResolvedPaths: (paths) => {
          observed.push(paths);
          throw new Error("STOP_BEFORE_PROVIDER");
        },
      });
    }
  } finally {
    process.chdir(originalCwd);
    rmSync(unrelatedCwd, { recursive: true, force: true });
  }
  assert.equal(new Set(observed.map((paths) => JSON.stringify(paths))).size, 1);
  assert.deepEqual(observed[0], {
    configPath: resolve(repositoryRoot, "config/cadence.runtime.beta.json"),
    outputPath: resolve(repositoryRoot, ".cadence/vs005/plan.json"),
    publicConfigPath: resolve(repositoryRoot, "apps/web/.generated/cadence-public-config.json"),
    webDistPath: resolve(repositoryRoot, "apps/web/dist"),
  });
});

test("production CLI has no caller root override and writes nothing when root identity fails", async () => {
  const source = readFileSync(resolve(__dirname, "vs005-deploy-plan.ts"), "utf8");
  assert.doesNotMatch(source, /resolveRepositoryRoot\?:/);
  const fixtureRoot = mkdtempSync(resolve(tmpdir(), "cadence-plan-invalid-root-"));
  const outputPath = resolve(fixtureRoot, "failure.json");
  try {
    cpSync(resolve(__dirname), resolve(fixtureRoot, "apps/api/scripts"), { recursive: true });
    cpSync(resolve(__dirname, "../src"), resolve(fixtureRoot, "apps/api/src"), { recursive: true });
    symlinkSync(resolve(repositoryRoot, "apps/api/node_modules"), resolve(fixtureRoot, "apps/api/node_modules"), "junction");
    mkdirSync(resolve(fixtureRoot, "apps/web"), { recursive: true });
    writeFileSync(resolve(fixtureRoot, "package.json"), JSON.stringify({ name: "not-cadence" }));
    writeFileSync(resolve(fixtureRoot, "apps/api/package.json"), JSON.stringify({ name: "api" }));
    writeFileSync(resolve(fixtureRoot, "apps/web/package.json"), JSON.stringify({ name: "web" }));
    const loaded = await import(`${pathToFileURL(resolve(fixtureRoot, "apps/api/scripts/vs005-deploy-plan.ts")).href}?invalid-root=${Date.now()}`) as {
      runCli: (args: readonly string[]) => Promise<void>;
    };
    await loaded.runCli(["--config", "config/cadence.runtime.beta.json", "--out", outputPath]);
    assert.equal(existsSync(outputPath), false);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

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
  overrides: Partial<Vs005StructuredProviderObservationSnapshot> = {},
): Vs005StructuredProviderObservationSnapshot {
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
    currentDeployment: observed({
      deploymentId: "deployment-current",
      versions: [{ providerVersionId: "version-current", percentage: 100 }],
    }),
    workersDevEnabled: observed(true),
    accountWorkersDevSubdomain: observed("ngohch-3d6"),
    ...overrides,
  };
}

function inspection(
  config: CadenceRuntimeConfig,
  overrides: Partial<Vs005CorrelatedProviderInspection> = {},
): Vs005CorrelatedProviderInspection {
  const providerObservations = overrides.observations ?? observations(config);
  const workerAbsent = providerObservations.workerExists.state === "OBSERVED_ABSENT";
  return {
    correlation: {
      accountId: config.cloudflare!.accountId,
      workerName: config.cloudflare!.workerName,
      configFingerprint: fingerprintCadenceRuntimeConfig(config),
      providerOrigin: "api.cloudflare.com",
      profile: "FIRST_DEPLOYMENT_READINESS",
      completedOperations: workerAbsent
        ? ["CURRENT_DEPLOYMENT", "ACCOUNT_SUBDOMAIN"]
        : ["CURRENT_DEPLOYMENT", "WORKER_SETTINGS", "CRON_SCHEDULES", "WORKER_SUBDOMAIN", "ACCOUNT_SUBDOMAIN"],
      observedAt: "2026-09-10T00:00:00.000Z",
    },
    observations: providerObservations,
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
    inspectStructured: async () => inspection(config),
    inspectLocalReadiness: async () => ({ generatedConfigValid: true, webBuildReady: true }),
    generatePlanId: () => "plan-1",
    writePlan: async () => undefined,
    ...overrides,
  };
}

test("planner inputs derive local readiness independently from provider facts", async () => {
  const config = betaConfig();
  let localCalls = 0;
  const result = await inspectVs005PlanInputs({
    config,
    release,
    generatedConfig: buildCloudflareDeployment({ config, release }).wrangler,
    inspectStructured: async () => ({
      ...inspection(config),
      generatedConfigValid: false,
      webBuildReady: false,
    } as never),
    inspectLocalReadiness: async (): Promise<Vs005LocalDeploymentReadiness> => {
      localCalls += 1;
      return { generatedConfigValid: true, webBuildReady: true };
    },
  });

  assert.equal(localCalls, 1);
  assert.equal(result.generatedConfigValid, true);
  assert.equal(result.webBuildReady, true);
});

test("exact Beta tuple produces a PASS plan", async () => {
  const config = betaConfig();
  let structuredCalls = 0;
  const plan = await runVs005DeployPlan(
    { configPath: "beta.json", outputPath: "plan.json" },
    makeDependencies(config, {
      inspectStructured: async () => {
        structuredCalls += 1;
        return inspection(config);
      },
    }),
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
  assert.equal(structuredCalls, 1);
});

test("structured correlation mismatch blocks planning without legacy authority", async () => {
  const config = betaConfig();
  const cases: Array<Partial<Vs005CorrelatedProviderInspection["correlation"]>> = [
    { accountId: "other-account" },
    { workerName: "other-worker" },
    { configFingerprint: "b".repeat(64) },
    { providerOrigin: "other.example" as "api.cloudflare.com" },
    { profile: "POST_DEPLOYMENT_VERIFICATION" },
    { completedOperations: ["CURRENT_DEPLOYMENT", "ACCOUNT_SUBDOMAIN"] },
  ];
  for (const correlationOverride of cases) {
    let structuredCalls = 0;
    const plan = await runVs005DeployPlan(
      { configPath: "beta.json", outputPath: "plan.json" },
      makeDependencies(config, {
        inspectStructured: async () => {
          structuredCalls += 1;
          return inspection(config, {
            correlation: { ...inspection(config).correlation, ...correlationOverride },
          });
        },
      }),
    );
    assert.equal(plan.readiness, "BLOCKED");
    assert.equal(structuredCalls, 1);
  }
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
        inspectStructured: async () => {
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
      inspectStructured: async () => inspection(config, {
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
      inspectStructured: async () => inspection(config, {
        observations: observations(config, {
          workerExists: absent(),
          currentRelease: absent(),
          cronSchedules: absent(),
          workerConfigFingerprint: absent(),
          nonSecretBindingNames: absent(),
          priorVersion: absent(),
          currentDeployment: absent(),
          workersDevEnabled: absent(),
          hostname: absent(),
        }),
      }),
    }),
  );

  assert.equal(plan.readiness, "PASS");
  assert.deepEqual(plan.observedProvider.workerExists, { state: "OBSERVED_ABSENT" });
  assert.deepEqual(plan.observedProvider.hostname, { state: "OBSERVED_ABSENT" });
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
      inspectStructured: async () => inspection(config, { observations: providerFacts }),
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
      inspectStructured: async () => inspection(config, {
        observations: observations(config, {
          workerExists: absent(),
          workerConfigFingerprint: absent(),
          cronSchedules: absent(),
          nonSecretBindingNames: absent(),
          currentRelease: absent(),
          priorVersion: absent(),
          currentDeployment: absent(),
          workersDevEnabled: absent(),
          hostname: absent(),
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
      inspectStructured: async () => inspection(config, {
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
      inspectStructured: async () => inspection(config, {
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
      inspectStructured: async () => inspection(config, {
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
      inspectStructured: async () => inspection(config, {
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
      inspectStructured: async () => inspection(config, {
        observations: unsafeFacts as Vs005StructuredProviderObservationSnapshot,
      }),
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

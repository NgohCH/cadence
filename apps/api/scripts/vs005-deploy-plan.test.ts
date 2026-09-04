import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  fingerprintCadenceRuntimeConfig,
  validateCadenceRuntimeConfig,
  type CadenceRuntimeConfig,
} from "../src/bootstrap/cadence-config";
import type { CadenceReleaseIdentity } from "../src/bootstrap/cadence-release";
import {
  runVs005DeployPlan,
  type Vs005DeployPlanDependencies,
  type Vs005DeploymentPlan,
  type Vs005PlanInspection,
} from "./vs005-deploy-plan";

const ciConfig = JSON.parse(
  readFileSync(resolve(process.cwd(), "../../config/cadence.runtime.ci.json"), "utf8"),
);

const release: CadenceReleaseIdentity = {
  version: "1.0.0",
  commitSha: "0123456789abcdef0123456789abcdef01234567",
  buildId: "2026-09-04T10:00:00Z",
};

function validBetaConfig(): CadenceRuntimeConfig {
  return validateCadenceRuntimeConfig(ciConfig);
}

function inspection(
  overrides: Partial<Vs005PlanInspection> = {},
): Vs005PlanInspection {
  return {
    providerReachable: true,
    providerAuthReady: true,
    providerAccountId: "account-123",
    generatedWorkerName: "cadence-beta",
    hostnameReady: true,
    generatedConfigValid: true,
    webBuildReady: true,
    workerExists: true,
    priorVersionAvailable: true,
    secretStatus: {
      SUPABASE_SECRET_KEY: {
        providerPresent: true,
        bootstrapInputAvailable: false,
      },
    },
    ...overrides,
  };
}

function makeDependencies(
  overrides: Partial<Vs005DeployPlanDependencies> = {},
): Vs005DeployPlanDependencies {
  return {
    loadConfig: () => ciConfig,
    loadRelease: () => release,
    inspect: async () => inspection(),
    generatePlanId: () => "plan-1",
    writePlan: async () => undefined,
    ...overrides,
  };
}

test("invalid config blocks before read-only provider inspection", async () => {
  let inspectCalls = 0;
  await assert.rejects(
    () => runVs005DeployPlan(
      { configPath: "invalid.json", outputPath: "plan.json" },
      makeDependencies({
        loadConfig: () => ({ ...ciConfig, configVersion: 99 }),
        inspect: async () => {
          inspectCalls += 1;
          throw new Error("must not run");
        },
      }),
    ),
    /config/i,
  );
  assert.equal(inspectCalls, 0);
});

test("missing secret blocks by secret name without exposing a value", async () => {
  const plan = await runVs005DeployPlan(
    { configPath: "beta.json", outputPath: "plan.json" },
    makeDependencies({
      inspect: async () => inspection({
        workerExists: false,
        priorVersionAvailable: false,
        secretStatus: {
          SUPABASE_SECRET_KEY: {
            providerPresent: false,
            bootstrapInputAvailable: false,
          },
        },
      }),
    }),
  );

  assert.equal(plan.readiness, "BLOCKED");
  assert.deepEqual(plan.secrets, [{
    name: "SUPABASE_SECRET_KEY",
    providerPresent: false,
    bootstrapInputAvailable: false,
    ready: false,
  }]);
  assert.deepEqual(plan.blockers, [{
    code: "MISSING_REQUIRED_SECRET",
    message:
      "Required secret SUPABASE_SECRET_KEY is neither configured remotely nor available as authorized bootstrap input.",
  }]);
  assert.doesNotMatch(JSON.stringify(plan), /server-secret|secret-value/);
});

test("fresh Worker may plan when the required secret is available only as bootstrap input", async () => {
  const plan = await runVs005DeployPlan(
    { configPath: "beta.json", outputPath: "plan.json" },
    makeDependencies({
      inspect: async () => inspection({
        workerExists: false,
        priorVersionAvailable: false,
        secretStatus: {
          SUPABASE_SECRET_KEY: {
            providerPresent: false,
            bootstrapInputAvailable: true,
          },
        },
      }),
    }),
  );

  assert.equal(plan.readiness, "PASS");
  assert.deepEqual(plan.secrets, [{
    name: "SUPABASE_SECRET_KEY",
    providerPresent: false,
    bootstrapInputAvailable: true,
    ready: true,
  }]);
  assert.equal(plan.rollback.application, "UNAVAILABLE");
  assert.equal(plan.rollback.database, "NOT_PERFORMED");
});

test("missing Cloudflare deployment authentication blocks without exposing credentials", async () => {
  const plan = await runVs005DeployPlan(
    { configPath: "beta.json", outputPath: "plan.json" },
    makeDependencies({
      inspect: async () => inspection({
        providerAuthReady: false,
        providerAccountId: null,
      }),
    }),
  );

  assert.equal(plan.readiness, "BLOCKED");
  assert.ok(plan.blockers.some((blocker) => blocker.code === "CLOUDFLARE_AUTH_UNAVAILABLE"));
});

test("authenticated but unresolved Cloudflare account identity blocks planning", async () => {
  const plan = await runVs005DeployPlan(
    { configPath: "beta.json", outputPath: "plan.json" },
    makeDependencies({
      inspect: async () => inspection({
        providerAccountId: null,
        workerExists: false,
        priorVersionAvailable: false,
        secretStatus: {
          SUPABASE_SECRET_KEY: {
            providerPresent: false,
            bootstrapInputAvailable: true,
          },
        },
      }),
    }),
  );

  assert.equal(plan.readiness, "BLOCKED");
  assert.ok(plan.blockers.some((blocker) => blocker.code === "CLOUDFLARE_TARGET_UNRESOLVED"));
});

test("custom hostname not ready blocks the reviewed deployment target", async () => {
  const plan = await runVs005DeployPlan(
    { configPath: "beta.json", outputPath: "plan.json" },
    makeDependencies({
      inspect: async () => inspection({
        hostnameReady: false,
        workerExists: false,
        priorVersionAvailable: false,
        secretStatus: {
          SUPABASE_SECRET_KEY: {
            providerPresent: false,
            bootstrapInputAvailable: true,
          },
        },
      }),
    }),
  );

  assert.equal(plan.readiness, "BLOCKED");
  assert.ok(plan.blockers.some((blocker) => blocker.code === "HOSTNAME_NOT_READY"));
});

test("ready plan is deterministic and explicitly non-destructive", async () => {
  const writtenPlans: Vs005DeploymentPlan[] = [];
  const dependencies = makeDependencies({
    writePlan: async (_path, plan) => {
      writtenPlans.push(plan);
    },
  });

  const first = await runVs005DeployPlan(
    { configPath: "beta.json", outputPath: "one.json" },
    dependencies,
  );
  const second = await runVs005DeployPlan(
    { configPath: "beta.json", outputPath: "two.json" },
    dependencies,
  );

  assert.equal(first.readiness, "PASS");
  assert.equal(first.database.migrationAction, "NONE");
  assert.deepEqual(first.destructiveActions, []);
  assert.equal(first.configFingerprint, second.configFingerprint);
  assert.equal(first.release.commitSha, release.commitSha);
  assert.equal(first.configVersion, 1);
  assert.deepEqual(first.providerTarget, {
    accountId: "account-123",
    workerName: "cadence-beta",
    workerExists: true,
  });
  assert.deepEqual(first.changes, [
    "WEB_STATIC_ASSETS",
    "API_WORKER",
    "SCHEDULED_WORKER",
  ]);
  assert.deepEqual(first.rollback, {
    application: "SUPPORTED",
    database: "NOT_PERFORMED",
  });
  assert.equal(writtenPlans.length, 2);
  assert.equal(first.configFingerprint, fingerprintCadenceRuntimeConfig(validBetaConfig()));
});

test("planning dependencies expose no mutation capability", () => {
  const dependencies = makeDependencies();
  assert.equal("deploy" in dependencies, false);
  assert.equal("apply" in dependencies, false);
  assert.equal("mutate" in dependencies, false);
  assert.equal("rollback" in dependencies, false);
  assert.equal("uploadSecret" in dependencies, false);
});

import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import {
  fingerprintCadenceRuntimeConfig,
  validateCadenceRuntimeConfig,
  type CadenceRuntimeConfig,
} from "../src/bootstrap/cadence-config";
import { getCadenceTargetFacts, VS005_BETA_TARGET_POLICY } from "../src/bootstrap/cadence-target-policy";
import type { CadenceReleaseIdentity } from "../src/bootstrap/cadence-release";
import type { CloudflareStructuredInspectionRequest } from "./vs005-cloudflare-structured-inspection";
import type { Vs005CorrelatedDeploymentResult, Vs005DeploymentResult } from "./vs005-deploy-apply";
import type { Vs005DeploymentVerification } from "./vs005-deploy-verify";
import {
  rollbackVs005Application,
  validateVs005RollbackRequest,
  type Vs005RollbackProvider,
  type Vs005RollbackRequest,
} from "./vs005-rollback";
import type {
  Vs005CorrelatedProviderInspection,
  Vs005Observation,
  Vs005StructuredProviderObservationSnapshot,
} from "./vs005-provider-observations";

const repositoryRoot = resolve(process.cwd(), "../..");
const tsxLoader = pathToFileURL(resolve(repositoryRoot, "apps/api/node_modules/tsx/dist/loader.mjs")).href;
const rollbackCli = resolve(__dirname, "vs005-rollback.ts");

test("rollback CLI resolves every relative path from repository root across caller cwd", () => {
  const unrelated = mkdtempSync(resolve(tmpdir(), "cadence-rollback-cwd-"));
  const original = process.cwd();
  try {
    for (const cwd of [repositoryRoot, resolve(repositoryRoot, "apps/api"), unrelated]) {
      const result = spawnSync(process.execPath, ["--import", tsxLoader, rollbackCli, "--current-deployment", "missing-current.json", "--target-deployment", "missing-target.json", "--config", "missing-config.json", "--out", ".cadence/vs005/task3-rollback-failure.json"], { cwd, encoding: "utf8" });
      assert.equal(result.status, 0);
      assert.equal(existsSync(resolve(repositoryRoot, ".cadence/vs005/task3-rollback-failure.json")), true);
      rmSync(resolve(repositoryRoot, ".cadence/vs005/task3-rollback-failure.json"), { force: true });
    }
  } finally {
    process.chdir(original);
    rmSync(unrelated, { recursive: true, force: true });
  }
});

function makeBetaConfig(): CadenceRuntimeConfig {
  const value = JSON.parse(readFileSync(resolve(process.cwd(), "../../config/cadence.runtime.ci.json"), "utf8"));
  value.application.publicUrl = "https://mycadence.ngohch-3d6.workers.dev";
  value.cloudflare = { accountId: "3d6a31905ac44e9563a523f9c86cbb8d", workerName: "mycadence" };
  value.supabase.url = "https://pwmhasbmacmeerbsagda.supabase.co";
  value.supabase.projectRef = "pwmhasbmacmeerbsagda";
  value.pilot.projectId = "3503f8c7-1996-44d1-8b63-1fca36db89f8";
  value.pilot.safeTargetMarker = "cadence-beta";
  return validateCadenceRuntimeConfig(value);
}

const config = makeBetaConfig();
const target = getCadenceTargetFacts(config);
const fingerprint = fingerprintCadenceRuntimeConfig(config);
const previousRelease: CadenceReleaseIdentity = {
  version: "1.0.0",
  commitSha: "0123456789abcdef0123456789abcdef01234567",
  buildId: "2026-09-04T10:00:00Z",
};
const currentRelease: CadenceReleaseIdentity = {
  version: "1.0.1",
  commitSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  buildId: "2026-09-04T11:00:00Z",
};
const observed = <T>(value: T): Vs005Observation<T> => ({ state: "OBSERVED_VALUE", value });

const priorSnapshot: Vs005StructuredProviderObservationSnapshot = {
  accountId: observed(target.cloudflare.accountId),
  workerName: observed(target.cloudflare.workerName),
  workerExists: observed(true),
  workerConfigFingerprint: observed(fingerprint),
  cronSchedules: observed([config.worker.schedule]),
  nonSecretBindingNames: observed(["ASSETS"]),
  secretNames: observed(["SUPABASE_SECRET_KEY"]),
  currentRelease: observed(previousRelease),
  priorVersion: { state: "OBSERVED_ABSENT" },
  hostname: observed(new URL(target.publicUrl).hostname),
  currentDeployment: observed({ deploymentId: "deployment-previous", versions: [{ providerVersionId: "version-previous", percentage: 100 }] }),
  workersDevEnabled: observed(true),
  accountWorkersDevSubdomain: observed("ngohch-3d6"),
};

const baseCorrelation = {
  accountId: target.cloudflare.accountId,
  workerName: target.cloudflare.workerName,
  configFingerprint: fingerprint,
  providerOrigin: "api.cloudflare.com" as const,
  profile: "FIRST_DEPLOYMENT_READINESS" as const,
  completedOperations: ["CURRENT_DEPLOYMENT", "WORKER_SETTINGS", "CRON_SCHEDULES", "WORKER_SUBDOMAIN", "ACCOUNT_SUBDOMAIN"] as const,
  observedAt: "2026-09-04T10:09:00.000Z",
};

const previousDeployment: Vs005CorrelatedDeploymentResult = {
  artifactType: "cadence.vs005.deployment-result",
  formatVersion: 1,
  planId: "plan-previous",
  deploymentId: "deployment-previous",
  providerVersionId: "version-previous",
  deployedAt: "2026-09-04T10:10:00.000Z",
  environment: "beta",
  provider: "cloudflare",
  providerTarget: { ...target.cloudflare, workerExists: true },
  publicUrl: target.publicUrl,
  configVersion: 1,
  release: previousRelease,
  configFingerprint: fingerprint,
  databaseAction: "NONE",
  destructiveActions: [],
  intendedTarget: target,
  observedProvider: priorSnapshot,
  providerCorrelation: baseCorrelation,
};
const currentDeploymentEvidence: Vs005CorrelatedDeploymentResult = {
  ...previousDeployment,
  planId: "plan-current",
  deploymentId: "deployment-current",
  providerVersionId: "version-current",
  release: currentRelease,
  observedProvider: {
    ...priorSnapshot,
    currentRelease: observed(currentRelease),
    priorVersion: observed({
      providerVersionId: previousDeployment.providerVersionId,
      release: previousDeployment.release,
      configFingerprint: previousDeployment.configFingerprint,
    }),
    currentDeployment: observed({ deploymentId: "deployment-current", versions: [{ providerVersionId: "version-current", percentage: 100 }] }),
  },
  providerCorrelation: { ...baseCorrelation, observedAt: "2026-09-04T11:09:00.000Z" },
};

function passingVerification(deployment = previousDeployment): Vs005DeploymentVerification {
  return {
    artifactType: "cadence.vs005.deployment-verification",
    formatVersion: 1,
    deploymentId: deployment.deploymentId,
    environment: "beta",
    release: deployment.release,
    configVersion: 1,
    checks: [{ name: "release", outcome: "PASS", code: "RELEASE_MATCH" }],
    outcome: "PASS",
    pilotActivation: "NOT_AUTHORISED",
  };
}

class FakeRollbackProvider implements Vs005RollbackProvider {
  rollbackCalls: string[] = [];
  structuredRequests: CloudflareStructuredInspectionRequest[] = [];
  legacyCalls = 0;
  constructor(readonly inspection: Vs005CorrelatedProviderInspection = rollbackInspection()) {}
  async inspectStructured(request: CloudflareStructuredInspectionRequest) {
    this.structuredRequests.push(request);
    return this.inspection;
  }
  async rollback(providerVersionId: string) {
    this.rollbackCalls.push(providerVersionId);
    return { deploymentId: "deployment-after-rollback", activeProviderVersionId: providerVersionId };
  }
}

function rollbackInspection(
  observations: Partial<Vs005StructuredProviderObservationSnapshot> = {},
  correlation: Partial<Vs005CorrelatedProviderInspection["correlation"]> = {},
): Vs005CorrelatedProviderInspection {
  return {
    correlation: {
      accountId: target.cloudflare.accountId,
      workerName: target.cloudflare.workerName,
      configFingerprint: fingerprint,
      providerOrigin: "api.cloudflare.com",
      profile: "ROLLBACK_READINESS",
      completedOperations: ["CURRENT_DEPLOYMENT", "WORKER_SETTINGS", "CRON_SCHEDULES", "DEPLOYABLE_VERSIONS", "VERSION", "WORKER_SUBDOMAIN", "ACCOUNT_SUBDOMAIN"],
      observedAt: "2026-09-04T11:30:00.000Z",
      ...correlation,
    },
    observations: {
      ...currentDeploymentEvidence.observedProvider,
      currentDeployment: observed({ deploymentId: "deployment-current", versions: [{ providerVersionId: "version-current", percentage: 100 }] }),
      priorVersion: observed({ providerVersionId: "version-previous", release: previousRelease, configFingerprint: fingerprint }),
      ...observations,
    },
  };
}

const rollbackRequest: Vs005RollbackRequest = {
  providerVersionId: previousDeployment.providerVersionId,
  expectedRelease: previousDeployment.release,
  expectedConfigFingerprint: previousDeployment.configFingerprint,
  expectedEnvironment: previousDeployment.environment,
  expectedProvider: previousDeployment.provider,
  expectedProviderTarget: previousDeployment.providerTarget,
  expectedPublicUrl: previousDeployment.publicUrl,
  expectedPriorVersionA: {
    providerVersionId: previousDeployment.providerVersionId,
    release: previousDeployment.release,
    configFingerprint: previousDeployment.configFingerprint,
  },
  databaseAction: "NONE",
};

test("rollback requires explicit retained version A", async () => {
  await assert.rejects(
    () => rollbackVs005Application({
      request: {
        ...rollbackRequest,
        expectedPriorVersionA: undefined as unknown as Vs005RollbackRequest["expectedPriorVersionA"],
      },
      currentDeploymentEvidence,
      targetDeploymentEvidence: previousDeployment,
      currentConfig: config,
      targetPolicy: VS005_BETA_TARGET_POLICY,
      provider: new FakeRollbackProvider(),
      verify: async (deployment) => passingVerification(deployment),
    }),
    /PRIOR VERSION A REQUIRED/,
  );
});

test("rollback rejects unavailable rollback observations", async () => {
  const unavailableInspection = rollbackInspection({ priorVersion: { state: "UNAVAILABLE", code: "VERSION_UNAVAILABLE" } });
  const provider = new FakeRollbackProvider(unavailableInspection);
  await assert.rejects(
    () => rollbackVs005Application({
      request: rollbackRequest,
      currentDeploymentEvidence,
      targetDeploymentEvidence: previousDeployment,
      currentConfig: config,
      targetPolicy: VS005_BETA_TARGET_POLICY,
      provider,
      verify: async (deployment) => passingVerification(deployment),
    }),
    /ROLLBACK PRIOR VERSION MISMATCH/,
  );
  assert.deepEqual(provider.rollbackCalls, []);
});

test("rollback rejects changed account or Worker before mutation", async () => {
  for (const inspection of [
    rollbackInspection({}, { accountId: "other-account" }),
    rollbackInspection({}, { workerName: "other-worker" }),
  ]) {
    const provider = new FakeRollbackProvider(inspection);
    await assert.rejects(
      () => rollbackVs005Application({
        request: rollbackRequest,
        currentDeploymentEvidence,
        targetDeploymentEvidence: previousDeployment,
        currentConfig: config,
        targetPolicy: VS005_BETA_TARGET_POLICY,
        provider,
        verify: async (deployment) => passingVerification(deployment),
      }),
      /ROLLBACK PROVIDER INSPECTION FAILED/,
    );
    assert.deepEqual(provider.rollbackCalls, []);
  }
});

test("rollback preserves release/config target", async () => {
  const provider = new FakeRollbackProvider();
  let reconstructed: Vs005DeploymentResult | undefined;
  await rollbackVs005Application({
    request: rollbackRequest,
    currentDeploymentEvidence,
    targetDeploymentEvidence: previousDeployment,
    currentConfig: config,
    targetPolicy: VS005_BETA_TARGET_POLICY,
    provider,
    verify: async (deployment) => {
      reconstructed = deployment;
      return passingVerification(deployment);
    },
  });
  assert.deepEqual(reconstructed?.release, previousRelease);
  assert.equal(reconstructed?.configFingerprint, fingerprint);
  assert.equal(reconstructed?.databaseAction, "NONE");
  assert.deepEqual(reconstructed?.destructiveActions, []);
  assert.equal(provider.structuredRequests.length, 1);
  assert.equal(provider.structuredRequests[0]?.profile, "ROLLBACK_READINESS");
  assert.deepEqual(provider.structuredRequests[0]?.expectedPriorVersion, rollbackRequest.expectedPriorVersionA);
  assert.deepEqual(provider.rollbackCalls, ["version-previous"]);
});

test("rollback requires correlated persisted evidence before structured inspection", async () => {
  const provider = new FakeRollbackProvider();
  const base = { ...currentDeploymentEvidence, providerCorrelation: undefined } as unknown as Vs005DeploymentResult;
  await assert.rejects(() => rollbackVs005Application({
    request: rollbackRequest,
    currentDeploymentEvidence: base,
    targetDeploymentEvidence: previousDeployment,
    currentConfig: config,
    targetPolicy: VS005_BETA_TARGET_POLICY,
    provider,
    verify: async (deployment) => passingVerification(deployment),
  }), /INVALID_DEPLOYMENT_EVIDENCE/);
  assert.equal(provider.structuredRequests.length, 0);
  assert.deepEqual(provider.rollbackCalls, []);
});

test("rollback blocks empty or unavailable deployable proof and missing exact version detail", async () => {
  const cases = [
    rollbackInspection({ priorVersion: { state: "OBSERVED_ABSENT" } }, { completedOperations: ["CURRENT_DEPLOYMENT", "WORKER_SETTINGS", "CRON_SCHEDULES", "DEPLOYABLE_VERSIONS", "WORKER_SUBDOMAIN", "ACCOUNT_SUBDOMAIN"] }),
    rollbackInspection({ priorVersion: { state: "UNAVAILABLE", code: "DEPLOYABLE_VERSIONS_UNAVAILABLE" } }, { completedOperations: ["CURRENT_DEPLOYMENT", "WORKER_SETTINGS", "CRON_SCHEDULES", "WORKER_SUBDOMAIN", "ACCOUNT_SUBDOMAIN"] }),
  ];
  for (const inspection of cases) {
    const provider = new FakeRollbackProvider(inspection);
    await assert.rejects(() => rollbackVs005Application({
      request: rollbackRequest, currentDeploymentEvidence, targetDeploymentEvidence: previousDeployment,
      currentConfig: config, targetPolicy: VS005_BETA_TARGET_POLICY, provider,
      verify: async (deployment) => passingVerification(deployment),
    }), /ROLLBACK PROVIDER INSPECTION FAILED|ROLLBACK PRIOR VERSION MISMATCH/);
    assert.deepEqual(provider.rollbackCalls, []);
  }
});

test("rollback rejects correlation, current deployment, active version, and exact version identity drift", async () => {
  const cases = [
    rollbackInspection({}, { configFingerprint: "a".repeat(64) }),
    rollbackInspection({}, { providerOrigin: "api.cloudflare.com", profile: "POST_DEPLOYMENT_VERIFICATION" }),
    rollbackInspection({}, { completedOperations: ["CURRENT_DEPLOYMENT", "WORKER_SETTINGS"] }),
    rollbackInspection({ currentDeployment: observed({ deploymentId: "other", versions: [{ providerVersionId: "version-current", percentage: 100 }] }) }),
    rollbackInspection({ currentDeployment: observed({ deploymentId: "deployment-current", versions: [{ providerVersionId: "other", percentage: 100 }] }) }),
    rollbackInspection({ priorVersion: observed({ providerVersionId: "version-B", release: previousRelease, configFingerprint: fingerprint }) }),
    rollbackInspection({ priorVersion: observed({ providerVersionId: "version-previous", release: { ...previousRelease, version: "2.0.0" }, configFingerprint: fingerprint }) }),
    rollbackInspection({ priorVersion: observed({ providerVersionId: "version-previous", release: previousRelease, configFingerprint: "b".repeat(64) }) }),
  ];
  for (const inspection of cases) {
    const provider = new FakeRollbackProvider(inspection);
    await assert.rejects(() => rollbackVs005Application({
      request: rollbackRequest, currentDeploymentEvidence, targetDeploymentEvidence: previousDeployment,
      currentConfig: config, targetPolicy: VS005_BETA_TARGET_POLICY, provider,
      verify: async (deployment) => passingVerification(deployment),
    }));
    assert.deepEqual(provider.rollbackCalls, []);
  }
});

test("rollback requires complete Cron secret and workers dev observations", async () => {
  const cases = [
    rollbackInspection({ cronSchedules: { state: "UNAVAILABLE", code: "CRON_UNAVAILABLE" } }),
    rollbackInspection({ secretNames: { state: "OBSERVED_ABSENT" } }),
    rollbackInspection({ workersDevEnabled: observed(false) }),
    rollbackInspection({ accountWorkersDevSubdomain: observed("other-subdomain") }),
    rollbackInspection({ hostname: { state: "UNAVAILABLE", code: "HOSTNAME_UNAVAILABLE" } }),
  ];
  for (const inspection of cases) {
    const provider = new FakeRollbackProvider(inspection);
    await assert.rejects(() => rollbackVs005Application({
      request: rollbackRequest, currentDeploymentEvidence, targetDeploymentEvidence: previousDeployment,
      currentConfig: config, targetPolicy: VS005_BETA_TARGET_POLICY, provider,
      verify: async (deployment) => passingVerification(deployment),
    }));
    assert.deepEqual(provider.rollbackCalls, []);
  }
});

test("provider order cannot select version B over explicit governed version A", async () => {
  const provider = new FakeRollbackProvider();
  await rollbackVs005Application({
    request: rollbackRequest, currentDeploymentEvidence, targetDeploymentEvidence: previousDeployment,
    currentConfig: config, targetPolicy: VS005_BETA_TARGET_POLICY, provider,
    verify: async (deployment) => passingVerification(deployment),
  });
  assert.deepEqual(provider.structuredRequests[0]?.expectedPriorVersion, {
    providerVersionId: "version-previous", release: previousRelease, configFingerprint: fingerprint,
  });
  assert.deepEqual(provider.rollbackCalls, ["version-previous"]);
});

test("rollback keeps database NONE", () => {
  assert.throws(
    () => validateVs005RollbackRequest({ ...rollbackRequest, databaseAction: "ROLLBACK" }),
    /DATABASE ROLLBACK IS NOT A VS005 OPERATION/,
  );
});

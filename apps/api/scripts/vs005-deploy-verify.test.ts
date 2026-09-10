import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  fingerprintCadenceRuntimeConfig,
  validateCadenceRuntimeConfig,
  type CadenceRuntimeConfig,
} from "../src/bootstrap/cadence-config";
import {
  getCadenceTargetFacts,
  VS005_BETA_TARGET_POLICY,
  type CadenceTargetFacts,
} from "../src/bootstrap/cadence-target-policy";
import {
  verifyVs005Deployment,
  type Vs005DeploymentVerification,
  type Vs005VerificationReaders,
} from "./vs005-deploy-verify";
import type { CloudflareStructuredInspectionRequest } from "./vs005-cloudflare-structured-inspection";
import type { Vs005CorrelatedDeploymentResult, Vs005DeploymentResult } from "./vs005-deploy-apply";
import type {
  Vs005CorrelatedProviderInspection,
  Vs005Observation,
  Vs005StructuredProviderObservationSnapshot,
} from "./vs005-provider-observations";

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
const release = {
  version: "1.0.0",
  commitSha: "0123456789abcdef0123456789abcdef01234567",
  buildId: "2026-09-04T10:00:00Z",
};
const configFingerprint = fingerprintCadenceRuntimeConfig(config);
const target = getCadenceTargetFacts(config);
const observed = <T>(value: T): Vs005Observation<T> => ({ state: "OBSERVED_VALUE", value });
const unavailable = <T>(code = "NOT_AVAILABLE"): Vs005Observation<T> => ({ state: "UNAVAILABLE", code });
const absent = <T>(): Vs005Observation<T> => ({ state: "OBSERVED_ABSENT" });

const providerSnapshot: Vs005StructuredProviderObservationSnapshot = {
  accountId: observed(target.cloudflare.accountId),
  workerName: observed(target.cloudflare.workerName),
  workerExists: observed(true),
  workerConfigFingerprint: observed(configFingerprint),
  cronSchedules: observed([config.worker.schedule]),
  nonSecretBindingNames: observed(["ASSETS"]),
  secretNames: observed(["SUPABASE_SECRET_KEY"]),
  currentRelease: observed(release),
  priorVersion: absent(),
  hostname: observed(new URL(target.publicUrl).hostname),
  currentDeployment: observed({
    deploymentId: "deployment-1",
    versions: [{ providerVersionId: "version-1", percentage: 100 }],
  }),
  workersDevEnabled: observed(true),
  accountWorkersDevSubdomain: observed("ngohch-3d6"),
};

const deployment: Vs005CorrelatedDeploymentResult = {
  artifactType: "cadence.vs005.deployment-result",
  formatVersion: 1,
  planId: "plan-1",
  deploymentId: "deployment-1",
  providerVersionId: "version-1",
  deployedAt: "2026-09-04T12:34:56.000Z",
  environment: "beta",
  provider: "cloudflare",
  providerTarget: { ...target.cloudflare, workerExists: true },
  publicUrl: target.publicUrl,
  configVersion: 1,
  release,
  configFingerprint,
  databaseAction: "NONE",
  destructiveActions: [],
  intendedTarget: target,
  observedProvider: providerSnapshot,
  providerCorrelation: {
    accountId: target.cloudflare.accountId,
    workerName: target.cloudflare.workerName,
    configFingerprint,
    providerOrigin: "api.cloudflare.com",
    profile: "FIRST_DEPLOYMENT_READINESS",
    completedOperations: ["CURRENT_DEPLOYMENT", "WORKER_SETTINGS", "CRON_SCHEDULES", "WORKER_SUBDOMAIN", "ACCOUNT_SUBDOMAIN"],
    observedAt: "2026-09-04T12:33:00.000Z",
  },
};

function structuredInspection(
  observations: Vs005StructuredProviderObservationSnapshot = providerSnapshot,
  correlationOverrides: Partial<Vs005CorrelatedProviderInspection["correlation"]> = {},
): Vs005CorrelatedProviderInspection {
  return {
    correlation: {
      accountId: target.cloudflare.accountId,
      workerName: target.cloudflare.workerName,
      configFingerprint,
      providerOrigin: "api.cloudflare.com",
      profile: "POST_DEPLOYMENT_VERIFICATION",
      completedOperations: ["CURRENT_DEPLOYMENT", "WORKER_SETTINGS", "CRON_SCHEDULES", "WORKER_SUBDOMAIN", "ACCOUNT_SUBDOMAIN"],
      observedAt: "2026-09-04T12:35:00.000Z",
      ...correlationOverrides,
    },
    observations,
  };
}

function passReaders(overrides: Partial<Vs005VerificationReaders> = {}): Vs005VerificationReaders {
  return {
    getWeb: async () => ({ status: 200 }),
    inspectBrowserBundle: async () => ({ status: 200, forbiddenServerMarkersFound: false }),
    getHealth: async () => ({
      status: 200,
      json: {
        status: "ok",
        service: "cadence-api",
        environment: deployment.environment,
        configVersion: deployment.configVersion,
        configFingerprint,
        version: release.version,
        commitSha: release.commitSha,
        buildId: release.buildId,
      },
    }),
    probeApi: async () => ({ status: 401 }),
    inspectProvider: async () => structuredInspection(),
    inspectRuntimeTarget: async () => ({
      environment: target.environment,
      safeTargetMarker: target.safeTargetMarker,
      supabaseProjectRef: target.supabaseProjectRef,
      pilotProjectId: target.pilotProjectId,
    }),
    probeControlledProject: async () => ({ status: 200, projectId: target.pilotProjectId }),
    ...overrides,
  };
}

async function verify(
  readers: Vs005VerificationReaders,
  currentDeployment: Vs005CorrelatedDeploymentResult = deployment,
  expectedConfig: CadenceRuntimeConfig = config,
): Promise<Vs005DeploymentVerification> {
  return verifyVs005Deployment({
    deployment: currentDeployment,
    expectedConfig,
    targetPolicy: VS005_BETA_TARGET_POLICY,
    readers,
  });
}

test("verification uses a fresh complete structured post-deployment inspection", async () => {
  const requests: CloudflareStructuredInspectionRequest[] = [];
  const result = await verify(passReaders());
  const captured = await verify(passReaders({
    inspectProvider: async (request) => {
      requests.push(request);
      return structuredInspection();
    },
  }));
  assert.equal(result.outcome, "PASS");
  assert.equal(captured.outcome, "PASS");
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.profile, "POST_DEPLOYMENT_VERIFICATION");
  assert.deepEqual(requests[0]?.config, config);
  assert.deepEqual(requests[0]?.release, deployment.release);
  assert.equal(requests[0]?.generatedConfig.name, target.cloudflare.workerName);
  assert.equal(result.pilotActivation, "NOT_AUTHORISED");
});

test("verification checks exact fresh correlation account and Worker", async () => {
  const drift = await verify(passReaders({
    inspectProvider: async () => structuredInspection(providerSnapshot, { accountId: "other-account" }),
  }));
  assert.ok(drift.checks.some((item) => item.code === "PROVIDER_ACCOUNT_DRIFT" && item.outcome === "FAIL"));

  const workerDrift = await verify(passReaders({
    inspectProvider: async () => structuredInspection(providerSnapshot, { workerName: "other-worker" }),
  }));
  assert.ok(workerDrift.checks.some((item) => item.code === "PROVIDER_WORKER_DRIFT" && item.outcome === "FAIL"));
});

test("verification checks public URL and environment", async () => {
  const wrongUrl = await verify(passReaders(), { ...deployment, publicUrl: "https://other.example.test" });
  assert.ok(wrongUrl.checks.some((item) => item.code === "PUBLIC_URL_DRIFT" && item.outcome === "FAIL"));
  const wrongEnvironment = await verify(passReaders(), { ...deployment, environment: "qa" });
  assert.ok(wrongEnvironment.checks.some((item) => item.code === "ENVIRONMENT_DRIFT" && item.outcome === "FAIL"));
});

test("verification checks safe marker and Supabase ref", async () => {
  const result = await verify(passReaders({
    inspectRuntimeTarget: async () => ({
      environment: "beta",
      safeTargetMarker: "wrong-marker",
      supabaseProjectRef: "wrong-ref",
      pilotProjectId: target.pilotProjectId,
    }),
  }));
  assert.ok(result.checks.some((item) => item.code === "SAFE_TARGET_MARKER_DRIFT" && item.outcome === "FAIL"));
  assert.ok(result.checks.some((item) => item.code === "SUPABASE_TARGET_DRIFT" && item.outcome === "FAIL"));
});

test("verification checks controlled Project through governed application probe", async () => {
  const result = await verify(passReaders({
    probeControlledProject: async () => ({ status: 200, projectId: "07e20000-0000-4000-8000-000000000001" }),
  }));
  assert.ok(result.checks.some((item) => item.code === "CONTROLLED_PROJECT_DRIFT" && item.outcome === "FAIL"));
});

test("verification checks release and fingerprint", async () => {
  const result = await verify(passReaders(), { ...deployment, release: { ...release, version: "2.0.0" } });
  assert.ok(result.checks.some((item) => item.code === "RELEASE_DRIFT" && item.outcome === "FAIL"));
  const fingerprintDrift = await verify(passReaders(), { ...deployment, configFingerprint: "a".repeat(64) });
  assert.ok(fingerprintDrift.checks.some((item) => item.code === "CONFIG_DRIFT" && item.outcome === "FAIL"));
});

test("verification checks Cron and named secret", async () => {
  const result = await verify(passReaders({
    inspectProvider: async () => structuredInspection({ ...providerSnapshot, cronSchedules: observed([]), secretNames: observed([]) }),
  }));
  assert.ok(result.checks.some((item) => item.code === "SCHEDULE_DRIFT" && item.outcome === "FAIL"));
  assert.ok(result.checks.some((item) => item.code === "SECRET_BINDING_DRIFT" && item.outcome === "FAIL"));
});

test("verification rejects unavailable provider fact", async () => {
  const result = await verify(passReaders({
    inspectProvider: async () => structuredInspection({ ...providerSnapshot, workerConfigFingerprint: unavailable("CONFIG_UNAVAILABLE") }),
  }));
  assert.equal(result.outcome, "FAIL");
  assert.ok(result.checks.some((item) => item.code === "PROVIDER_OBSERVATION_UNAVAILABLE" && item.outcome === "FAIL"));
});

test("verification rejects an absent Worker after deployment", async () => {
  const result = await verify(passReaders({
    inspectProvider: async () => structuredInspection({ ...providerSnapshot, workerExists: absent() }),
  }));
  assert.ok(result.checks.some((item) => item.code === "WORKER_ABSENT" && item.outcome === "FAIL"));
});

test("verification preserves browser secret absence", async () => {
  const result = await verify(passReaders({ inspectBrowserBundle: async () => ({ status: 200, forbiddenServerMarkersFound: true }) }));
  assert.ok(result.checks.some((item) => item.code === "BROWSER_SERVER_CONFIG_EXPOSURE" && item.outcome === "FAIL"));
  assert.doesNotMatch(JSON.stringify(result), /server-secret|SUPABASE_SECRET_KEY=|token=/i);
});

test("verification always records NOT_AUTHORISED", async () => {
  const result = await verify(passReaders());
  assert.equal(result.outcome, "PASS");
  assert.equal(result.pilotActivation, "NOT_AUTHORISED");
});

test("legacy evidence without v2 target/provider provenance cannot become PASS", async () => {
  const legacy: Record<string, unknown> = { ...deployment };
  delete legacy.intendedTarget;
  delete legacy.observedProvider;
  const result = await verify(passReaders(), legacy as unknown as Vs005CorrelatedDeploymentResult);
  assert.equal(result.outcome, "FAIL");
  assert.ok(result.checks.some((item) => item.code === "INSUFFICIENT_DEPLOYMENT_PROVENANCE"));
  assert.equal(result.pilotActivation, "NOT_AUTHORISED");
});

test("verification rejects base or malformed correlated deployment evidence before inspection", async () => {
  for (const candidate of [
    { ...deployment, providerCorrelation: undefined },
    { ...deployment, observedProvider: undefined },
    { ...deployment, providerCorrelation: { ...deployment.providerCorrelation, providerOrigin: "example.test" } },
  ]) {
    let calls = 0;
    const result = await verify(passReaders({ inspectProvider: async () => { calls += 1; return structuredInspection(); } }), candidate as unknown as Vs005CorrelatedDeploymentResult);
    assert.equal(result.outcome, "FAIL");
    assert.equal(calls, 0);
    assert.ok(result.checks.some((item) => item.code === "INSUFFICIENT_DEPLOYMENT_PROVENANCE"));
  }
});

test("verification fails closed on fresh correlation, operation, deployment, version, and hostname drift", async () => {
  const cases: Vs005CorrelatedProviderInspection[] = [
    structuredInspection(providerSnapshot, { configFingerprint: "a".repeat(64) }),
    structuredInspection(providerSnapshot, { providerOrigin: "api.cloudflare.com", profile: "ROLLBACK_READINESS" }),
    structuredInspection(providerSnapshot, { completedOperations: ["CURRENT_DEPLOYMENT"] }),
    structuredInspection({ ...providerSnapshot, currentDeployment: observed({ deploymentId: "other-deployment", versions: [{ providerVersionId: "version-1", percentage: 100 }] }) }),
    structuredInspection({ ...providerSnapshot, currentDeployment: observed({ deploymentId: "deployment-1", versions: [{ providerVersionId: "other-version", percentage: 100 }] }) }),
    structuredInspection({ ...providerSnapshot, workersDevEnabled: absent() }),
    structuredInspection({ ...providerSnapshot, accountWorkersDevSubdomain: unavailable("SUBDOMAIN_UNAVAILABLE") }),
    structuredInspection({ ...providerSnapshot, hostname: observed("other.example.test") }),
  ];
  for (const inspection of cases) {
    const result = await verify(passReaders({ inspectProvider: async () => inspection }));
    assert.equal(result.outcome, "FAIL");
  }
});

test("verification rejects runtime secret-looking provider output without retaining it", async () => {
  const result = await verify(passReaders({
    getHealth: async () => ({ status: 500, json: { secretValue: "server-secret-must-not-escape" } }),
  }));
  assert.equal(result.outcome, "FAIL");
  assert.doesNotMatch(JSON.stringify(result), /server-secret-must-not-escape|response body|stack/i);
});

test("verification accepts another target only through explicit policy input", () => {
  const alternateFacts: CadenceTargetFacts = {
    ...target,
    cloudflare: { accountId: "alternate-account", workerName: "alternate-worker" },
    publicUrl: "https://alternate.example.test",
    supabaseProjectRef: "alternate-ref",
    pilotProjectId: "22222222-2222-4222-8222-222222222222",
  };
  assert.notDeepEqual(alternateFacts, VS005_BETA_TARGET_POLICY.expected);
});

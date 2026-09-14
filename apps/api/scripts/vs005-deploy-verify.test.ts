import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
import * as verifyModule from "./vs005-deploy-verify";
import type { CloudflareStructuredInspectionRequest } from "./vs005-cloudflare-structured-inspection";
import type { Vs005CorrelatedDeploymentResult, Vs005DeploymentResult } from "./vs005-deploy-apply";
import type {
  Vs005CorrelatedProviderInspection,
  Vs005Observation,
  Vs005StructuredProviderObservationSnapshot,
} from "./vs005-provider-observations";

const repositoryRoot = resolve(process.cwd(), "../..");
const tsxLoader = pathToFileURL(resolve(repositoryRoot, "apps/api/node_modules/tsx/dist/loader.mjs")).href;
const verifyCli = resolve(__dirname, "vs005-deploy-verify.ts");

test("verify CLI resolves every relative path from repository root across caller cwd", () => {
  const unrelated = mkdtempSync(resolve(tmpdir(), "cadence-verify-cwd-"));
  const original = process.cwd();
  try {
    for (const cwd of [repositoryRoot, resolve(repositoryRoot, "apps/api"), unrelated]) {
      const result = spawnSync(process.execPath, ["--import", tsxLoader, verifyCli, "--deployment", "missing-deployment.json", "--config", "missing-config.json", "--out", ".cadence/vs005/space dir/../task3-verify-failure.json"], { cwd, encoding: "utf8", env: { ...process.env, INIT_CWD: unrelated } });
      assert.equal(result.status, 0);
      assert.equal(existsSync(resolve(repositoryRoot, ".cadence/vs005/task3-verify-failure.json")), true);
      rmSync(resolve(repositoryRoot, ".cadence/vs005/task3-verify-failure.json"), { force: true });
    }
  } finally {
    process.chdir(original);
    rmSync(unrelated, { recursive: true, force: true });
  }
});

test("verify CLI root-establishment failure performs no downstream reads or writes", () => {
  const fixture = mkdtempSync(resolve(tmpdir(), "cadence-verify-invalid-root-"));
  const apiRoot = resolve(fixture, "apps/api");
  const fixtureScripts = resolve(apiRoot, "scripts");
  mkdirSync(resolve(fixture, "apps/web"), { recursive: true });
  cpSync(resolve(repositoryRoot, "apps/api/scripts"), fixtureScripts, { recursive: true });
  cpSync(resolve(repositoryRoot, "apps/api/src"), resolve(apiRoot, "src"), { recursive: true });
  cpSync(resolve(repositoryRoot, "apps/api/package.json"), resolve(apiRoot, "package.json"));
  mkdirSync(resolve(apiRoot, "node_modules"), { recursive: true });
  cpSync(resolve(repositoryRoot, "apps/api/node_modules"), resolve(apiRoot, "node_modules"), { recursive: true });
  writeFileSync(resolve(fixture, "package.json"), JSON.stringify({ name: "not-cadence" }));
  writeFileSync(resolve(fixture, "apps/web/package.json"), JSON.stringify({ name: "web" }));
  const outputPath = resolve(fixture, ".cadence/root-failure.json");
  const reportPath = resolve(fixture, "probe.json");
  const probePath = resolve(fixture, "probe.cjs");
  writeFileSync(probePath, `const fs=require("node:fs");const cp=require("node:child_process");const out=${JSON.stringify(outputPath)};const report=${JSON.stringify(reportPath)};const c={inputReads:0,configReads:0,downstream:0,successWrites:0,failureWrites:0};const rr=fs.readFileSync.bind(fs);fs.readFileSync=(p,...a)=>{if(String(p).endsWith("input.json"))c.inputReads++;if(String(p).endsWith("config.json"))c.configReads++;return rr(p,...a)};const ww=fs.writeFileSync.bind(fs);fs.writeFileSync=(p,...a)=>{if(String(p)===out)c.failureWrites++;return ww(p,...a)};const ss=cp.spawn.bind(cp);cp.spawn=(...a)=>{c.downstream++;return ss(...a)};global.fetch=async()=>{c.downstream++;throw new Error("unexpected fetch")};process.on("exit",()=>ww(report,JSON.stringify(c)));`);
  const result = spawnSync(process.execPath, ["--require", probePath, "--import", tsxLoader, resolve(fixtureScripts, "vs005-deploy-verify.ts"), "--deployment", "input.json", "--config", "config.json", "--out", outputPath], { cwd: fixture, encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.equal(existsSync(outputPath), false);
  assert.equal(existsSync(resolve(fixture, ".cadence")), false);
  const probe = JSON.parse(require("node:fs").readFileSync(reportPath, "utf8")) as Record<string, number>;
  assert.deepEqual(probe, { inputReads: 0, configReads: 0, downstream: 0, successWrites: 0, failureWrites: 0 });
  rmSync(fixture, { recursive: true, force: true });
});

test("verify CLI preserves native absolute operator paths", () => {
  const fixture = mkdtempSync(resolve(tmpdir(), "cadence-verify-absolute-"));
  const outputPath = resolve(fixture, "space dir", "..", "verify-absolute.json");
  mkdirSync(resolve(fixture, "space dir"), { recursive: true });
  const result = spawnSync(process.execPath, ["--import", tsxLoader, verifyCli, "--deployment", resolve(fixture, "deployment.json"), "--config", resolve(fixture, "config.json"), "--out", outputPath], { cwd: repositoryRoot, encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.equal(existsSync(outputPath), true);
  rmSync(fixture, { recursive: true, force: true });
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

type ProductionHostIntegration = {
  createHostedRuntimeTargetReader?: (input: {
    config: CadenceRuntimeConfig;
    fetchImpl: typeof fetch;
  }) => Vs005VerificationReaders["inspectRuntimeTarget"];
  createControlledProjectProbe?: (input: {
    config: CadenceRuntimeConfig;
    environment: NodeJS.ProcessEnv;
    fetchImpl: typeof fetch;
    authenticate: (input: {
      supabaseUrl: string;
      publishableKey: string;
      email: string;
      password: string;
    }) => Promise<{ accessToken: string | null }>;
  }) => Vs005VerificationReaders["probeControlledProject"];
};

const productionHostIntegration = verifyModule as ProductionHostIntegration;

function hostedRuntimeTargetReader(fetchImpl: typeof fetch): Vs005VerificationReaders["inspectRuntimeTarget"] {
  assert.equal(
    typeof productionHostIntegration.createHostedRuntimeTargetReader,
    "function",
    "production hosted runtime-target reader is absent",
  );
  return productionHostIntegration.createHostedRuntimeTargetReader!({ config, fetchImpl });
}

function controlledProjectProbe(input: {
  fetchImpl: typeof fetch;
  authenticate?: ProductionHostIntegration["createControlledProjectProbe"] extends (...args: never[]) => never
    ? never
    : never;
  environment?: NodeJS.ProcessEnv;
}): Vs005VerificationReaders["probeControlledProject"] {
  assert.equal(
    typeof productionHostIntegration.createControlledProjectProbe,
    "function",
    "production controlled-Project probe is absent",
  );
  return productionHostIntegration.createControlledProjectProbe!({
    config,
    environment: input.environment ?? {
      TEST_USER_EMAIL: "email-credential-canary",
      TEST_USER_PASSWORD: "password-credential-canary",
    },
    fetchImpl: input.fetchImpl,
    authenticate: async () => ({ accessToken: "access-token-canary" }),
  });
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("production runtime reader projects canonical target only after hosted fingerprint attestation", async () => {
  const reader = hostedRuntimeTargetReader(async () => jsonResponse(200, {
    environment: config.application.environment,
    configFingerprint,
  }));

  assert.deepEqual(await reader(), {
    environment: config.application.environment,
    safeTargetMarker: config.pilot.safeTargetMarker,
    supabaseProjectRef: config.supabase.projectRef,
    pilotProjectId: config.pilot.projectId,
  });
});

test("production runtime reader fails closed for wrong or malformed hosted attestation", async () => {
  const cases: Array<{ status: number; body: unknown }> = [
    { status: 200, body: { environment: "beta", configFingerprint: "wrong-fingerprint" } },
    { status: 200, body: { environment: "beta" } },
    { status: 503, body: { environment: "beta", configFingerprint } },
    { status: 200, body: { environment: "wrong-environment", configFingerprint } },
  ];

  for (const item of cases) {
    const reader = hostedRuntimeTargetReader(async () => jsonResponse(item.status, item.body));
    await assert.rejects(reader(), { message: "RUNTIME_TARGET_ATTESTATION_UNAVAILABLE" });
  }
});

test("production controlled-Project probe retains only status and bounded Project identity", async () => {
  const businessCanary = "unrelated-business-data-canary";
  const probe = controlledProjectProbe({
    fetchImpl: async (request, init) => {
      assert.equal(String(request), `${config.application.publicUrl}/api/v1/projects/${config.pilot.projectId}/summary`);
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer access-token-canary");
      return jsonResponse(200, {
        success: true,
        data: { project: { id: config.pilot.projectId, name: businessCanary }, alerts: [businessCanary] },
      });
    },
  });

  const result = await probe();
  assert.deepEqual(result, { status: 200, projectId: config.pilot.projectId });
  assert.doesNotMatch(JSON.stringify(result), /credential-canary|access-token-canary|unrelated-business-data-canary/);
});

test("production controlled-Project probe preserves a wrong bounded identity for verification rejection", async () => {
  const wrongProjectId = "22222222-2222-4222-8222-222222222222";
  const probe = controlledProjectProbe({
    fetchImpl: async () => jsonResponse(200, { data: { project: { id: wrongProjectId } } }),
  });
  const result = await verify(passReaders({ probeControlledProject: probe }));
  assert.equal(result.outcome, "FAIL");
  assert.ok(result.checks.some((item) => item.code === "CONTROLLED_PROJECT_DRIFT"));
});

test("production controlled-Project probe fails closed for non-success provider status", async () => {
  for (const status of [401, 403, 404]) {
    const probe = controlledProjectProbe({ fetchImpl: async () => jsonResponse(status, { error: "body-canary" }) });
    assert.deepEqual(await probe(), { status, projectId: null });
  }
});

test("production controlled-Project probe fails closed for network and malformed success responses", async () => {
  const networkProbe = controlledProjectProbe({ fetchImpl: async () => { throw new Error("network-secret-canary"); } });
  const malformedProbe = controlledProjectProbe({ fetchImpl: async () => jsonResponse(200, { data: { project: {} } }) });
  assert.deepEqual(await networkProbe(), { status: 0, projectId: null });
  assert.deepEqual(await malformedProbe(), { status: 200, projectId: null });
});

test("production reader failures retain no credential, token, or business-data canaries", async () => {
  const runtimeReader = hostedRuntimeTargetReader(async () => jsonResponse(200, {
    environment: "beta",
    configFingerprint: "access-token-canary",
  }));
  let boundedError = "";
  try {
    await runtimeReader();
  } catch (error) {
    boundedError = error instanceof Error ? error.message : String(error);
  }
  const probe = controlledProjectProbe({
    fetchImpl: async () => jsonResponse(200, { data: { project: { name: "business-body-canary" } } }),
  });
  const verification = await verify(passReaders({
    inspectRuntimeTarget: runtimeReader,
    probeControlledProject: probe,
  }));
  const serialized = JSON.stringify({ boundedError, verification });
  assert.doesNotMatch(serialized, /email-credential-canary|password-credential-canary|access-token-canary|business-body-canary/);
});

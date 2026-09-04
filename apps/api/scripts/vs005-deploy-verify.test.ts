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
  verifyVs005Deployment,
  type Vs005DeploymentVerification,
  type Vs005VerificationReaders,
} from "./vs005-deploy-verify";
import type { Vs005DeploymentResult } from "./vs005-deploy-apply";

const config = validateCadenceRuntimeConfig(JSON.parse(
  readFileSync(resolve(process.cwd(), "../../config/cadence.runtime.ci.json"), "utf8"),
));

const deployment: Vs005DeploymentResult = {
  artifactType: "cadence.vs005.deployment-result",
  formatVersion: 1,
  planId: "plan-1",
  deploymentId: "deployment-1",
  providerVersionId: "version-1",
  deployedAt: "2026-09-04T12:34:56.000Z",
  environment: "beta",
  provider: "cloudflare",
  providerTarget: {
    accountId: "account-123",
    workerName: "cadence-beta",
    workerExists: true,
  },
  publicUrl: config.application.publicUrl,
  configVersion: 1,
  release: {
    version: "1.0.0",
    commitSha: "0123456789abcdef0123456789abcdef01234567",
    buildId: "2026-09-04T10:00:00Z",
  },
  configFingerprint: fingerprintCadenceRuntimeConfig(config),
  databaseAction: "NONE",
  destructiveActions: [],
};

function passReaders(
  overrides: Partial<Vs005VerificationReaders> = {},
): Vs005VerificationReaders {
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
        configFingerprint: deployment.configFingerprint,
        version: deployment.release.version,
        commitSha: deployment.release.commitSha,
        buildId: deployment.release.buildId,
      },
    }),
    probeApi: async () => ({ status: 401 }),
    inspectProvider: async () => ({
      accountId: "account-123",
      workerName: "cadence-beta",
      schedule: config.worker.schedule,
      configuredSecrets: ["SUPABASE_SECRET_KEY"],
      configFingerprint: deployment.configFingerprint,
      supabaseProjectRef: config.supabase.projectRef,
    }),
    ...overrides,
  };
}

async function verify(
  readers: Vs005VerificationReaders,
  expectedConfig: CadenceRuntimeConfig = config,
  currentDeployment: Vs005DeploymentResult = deployment,
): Promise<Vs005DeploymentVerification> {
  return verifyVs005Deployment({
    deployment: currentDeployment,
    expectedConfig,
    readers,
  });
}

test("matching deployed readers produce PASS without pilot authorization", async () => {
  const result = await verify(passReaders());
  assert.equal(result.outcome, "PASS");
  assert.equal(result.pilotActivation, "NOT_AUTHORISED");
  assert.ok(result.checks.every((check) => check.outcome === "PASS"));
});

for (const [name, currentDeployment, code] of [
  ["release", { ...deployment, release: { ...deployment.release, version: "2.0.0" } }, "RELEASE_DRIFT"],
  ["environment", { ...deployment, environment: "qa" }, "ENVIRONMENT_DRIFT"],
  ["config fingerprint", { ...deployment, configFingerprint: "different" }, "CONFIG_DRIFT"],
] as const) {
  test(`${name} drift is reported`, async () => {
    const result = await verify(passReaders(), config, currentDeployment);
    assert.ok(result.checks.some((check) => check.code === code && check.outcome === "FAIL"));
  });
}

test("schedule drift is reported", async () => {
  const result = await verify(passReaders({
    inspectProvider: async () => ({
      accountId: "account-123",
      workerName: "cadence-beta",
      schedule: "*/5 * * * *",
      configuredSecrets: ["SUPABASE_SECRET_KEY"],
      configFingerprint: deployment.configFingerprint,
      supabaseProjectRef: config.supabase.projectRef,
    }),
  }));
  assert.ok(result.checks.some((check) => check.code === "SCHEDULE_DRIFT" && check.outcome === "FAIL"));
});

test("required secret binding drift is reported by name only", async () => {
  const result = await verify(passReaders({
    inspectProvider: async () => ({
      accountId: "account-123",
      workerName: "cadence-beta",
      schedule: config.worker.schedule,
      configuredSecrets: [],
      configFingerprint: deployment.configFingerprint,
      supabaseProjectRef: config.supabase.projectRef,
    }),
  }));
  assert.ok(result.checks.some((check) => check.code === "SECRET_BINDING_DRIFT" && check.outcome === "FAIL"));
  assert.doesNotMatch(JSON.stringify(result), /server-secret|password|token/i);
});

test("provider target drift is reported", async () => {
  const result = await verify(passReaders({
    inspectProvider: async () => ({
      accountId: "other-account",
      workerName: "cadence-other",
      schedule: config.worker.schedule,
      configuredSecrets: ["SUPABASE_SECRET_KEY"],
      configFingerprint: deployment.configFingerprint,
      supabaseProjectRef: config.supabase.projectRef,
    }),
  }));
  assert.ok(result.checks.some((check) => check.code === "PROVIDER_TARGET_DRIFT" && check.outcome === "FAIL"));
});

test("Supabase target drift is reported", async () => {
  const result = await verify(passReaders({
    inspectProvider: async () => ({
      accountId: "account-123",
      workerName: "cadence-beta",
      schedule: config.worker.schedule,
      configuredSecrets: ["SUPABASE_SECRET_KEY"],
      configFingerprint: deployment.configFingerprint,
      supabaseProjectRef: "other-ref",
    }),
  }));
  assert.ok(result.checks.some((check) => check.code === "SUPABASE_TARGET_DRIFT" && check.outcome === "FAIL"));
});

test("browser server-config exposure is reported without retaining the bundle", async () => {
  const result = await verify(passReaders({
    inspectBrowserBundle: async () => ({ status: 200, forbiddenServerMarkersFound: true }),
  }));
  assert.ok(result.checks.some((check) => check.code === "BROWSER_SERVER_CONFIG_EXPOSURE" && check.outcome === "FAIL"));
  assert.doesNotMatch(JSON.stringify(result), /asset body|SUPABASE_SECRET_KEY=|server-secret/i);
});

test("unavailable API is reported while 401 and 403 are accepted", async () => {
  const pass = await verify(passReaders({ probeApi: async () => ({ status: 403 }) }));
  assert.equal(pass.checks.find((check) => check.name === "api")?.outcome, "PASS");

  const fail = await verify(passReaders({ probeApi: async () => ({ status: 404 }) }));
  assert.ok(fail.checks.some((check) => check.code === "API_UNAVAILABLE" && check.outcome === "FAIL"));
});

test("web and health failures are reported without persisting bodies", async () => {
  const result = await verify(passReaders({
    getWeb: async () => ({ status: 503 }),
    getHealth: async () => ({ status: 500, json: { secret: "server-secret" } }),
  }));
  assert.ok(result.checks.some((check) => check.name === "web" && check.outcome === "FAIL"));
  assert.ok(result.checks.some((check) => check.name === "health" && check.outcome === "FAIL"));
  assert.doesNotMatch(JSON.stringify(result), /server-secret|response body|stack/i);
});

test("same-origin hosted configuration records CORS as not applicable", async () => {
  const result = await verify(passReaders());
  assert.deepEqual(result.checks.find((check) => check.name === "cors"), {
    name: "cors",
    outcome: "PASS",
    code: "SAME_ORIGIN_CORS_NOT_APPLICABLE",
  });
});

test("future cross-origin API topology is rejected", async () => {
  const changedConfig = JSON.parse(JSON.stringify(config));
  changedConfig.application.apiBaseUrl = "https://api-other.example.test";
  await assert.rejects(
    () => verify(passReaders(), changedConfig),
    /cross-origin/i,
  );
});

test("verification result contains no response/provider body or raw exception", async () => {
  const result = await verify(passReaders());
  assert.doesNotMatch(JSON.stringify(result), /body|response|provider error|stack|server-secret|token/i);
});

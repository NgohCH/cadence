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
import type {
  Vs005DeploymentResult,
} from "./vs005-deploy-apply";
import type {
  Vs005DeploymentVerification,
} from "./vs005-deploy-verify";
import {
  rollbackVs005Application,
  validateVs005RollbackRequest,
  type Vs005RollbackProvider,
  type Vs005RollbackRequest,
} from "./vs005-rollback";

const validConfig: CadenceRuntimeConfig = validateCadenceRuntimeConfig(JSON.parse(
  readFileSync(resolve(process.cwd(), "../../config/cadence.runtime.ci.json"), "utf8"),
));
const rollbackFingerprint = fingerprintCadenceRuntimeConfig(validConfig);
const previousRelease: CadenceReleaseIdentity = {
  version: "1.0.0",
  commitSha: "0123456789abcdef0123456789abcdef01234567",
  buildId: "2026-09-04T10:00:00Z",
};

const previousDeployment: Vs005DeploymentResult = {
  artifactType: "cadence.vs005.deployment-result",
  formatVersion: 1,
  planId: "plan-previous",
  deploymentId: "deployment-previous",
  providerVersionId: "version-previous",
  deployedAt: "2026-09-04T10:10:00.000Z",
  environment: "beta",
  provider: "cloudflare",
  providerTarget: { accountId: "account-123", workerName: "cadence-beta", workerExists: true },
  publicUrl: validConfig.application.publicUrl,
  configVersion: 1,
  release: previousRelease,
  configFingerprint: rollbackFingerprint,
  databaseAction: "NONE",
  destructiveActions: [],
};

const currentDeploymentEvidence: Vs005DeploymentResult = {
  ...previousDeployment,
  planId: "plan-current",
  deploymentId: "deployment-current",
  providerVersionId: "version-current",
  deployedAt: "2026-09-04T11:00:00.000Z",
  release: {
    version: "1.0.1",
    commitSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    buildId: "2026-09-04T11:00:00Z",
  },
};

function passingVerification(overrides: {
  deploymentId?: string;
  release?: CadenceReleaseIdentity;
} = {}): Vs005DeploymentVerification {
  return {
    artifactType: "cadence.vs005.deployment-verification",
    formatVersion: 1,
    deploymentId: overrides.deploymentId ?? previousDeployment.deploymentId,
    environment: "beta",
    release: overrides.release ?? previousRelease,
    configVersion: 1,
    checks: [{ name: "release", outcome: "PASS", code: "RELEASE_MATCH" }],
    outcome: "PASS",
    pilotActivation: "NOT_AUTHORISED",
  };
}

function failingVerification(code: string): Vs005DeploymentVerification {
  return {
    ...passingVerification(),
    checks: [{ name: "release", outcome: "FAIL", code }],
    outcome: "FAIL",
  };
}

class FakeRollbackProvider implements Vs005RollbackProvider {
  rollbackCalls: string[] = [];

  constructor(
    readonly target = {
      accountId: currentDeploymentEvidence.providerTarget.accountId,
      workerName: currentDeploymentEvidence.providerTarget.workerName,
    },
  ) {}

  async inspectTarget() {
    return this.target;
  }

  async rollback(providerVersionId: string) {
    this.rollbackCalls.push(providerVersionId);
    return {
      deploymentId: "deployment-after-rollback",
      activeProviderVersionId: providerVersionId,
    };
  }
}

const rollbackRequest: Vs005RollbackRequest = {
  providerVersionId: previousDeployment.providerVersionId,
  expectedRelease: previousDeployment.release,
  expectedConfigFingerprint: previousDeployment.configFingerprint,
  expectedEnvironment: previousDeployment.environment,
  expectedProvider: previousDeployment.provider,
  expectedProviderTarget: previousDeployment.providerTarget,
  expectedPublicUrl: previousDeployment.publicUrl,
  databaseAction: "NONE",
};

test("rollback request validation refuses database rollback intent", () => {
  assert.throws(
    () => validateVs005RollbackRequest({ ...rollbackRequest, databaseAction: "ROLLBACK" }),
    /DATABASE ROLLBACK IS NOT A VS005 OPERATION/,
  );
});

test("rollback targets one explicit prior application version then verifies reconstructed evidence", async () => {
  const provider = new FakeRollbackProvider();
  const verifyCalls: Vs005DeploymentResult[] = [];

  const verification = await rollbackVs005Application({
    request: rollbackRequest,
    currentDeploymentEvidence,
    targetDeploymentEvidence: previousDeployment,
    currentConfig: validConfig,
    provider,
    clock: () => new Date("2026-09-04T12:00:00.000Z"),
    verify: async (deployment, config) => {
      verifyCalls.push(deployment);
      assert.equal(config, validConfig);
      return passingVerification({ deploymentId: deployment.deploymentId, release: deployment.release });
    },
  });

  assert.deepEqual(provider.rollbackCalls, [previousDeployment.providerVersionId]);
  assert.equal(verifyCalls[0]?.deploymentId, "deployment-after-rollback");
  assert.equal(verifyCalls[0]?.providerVersionId, previousDeployment.providerVersionId);
  assert.deepEqual(verifyCalls[0]?.release, previousDeployment.release);
  assert.equal(verifyCalls[0]?.configFingerprint, previousDeployment.configFingerprint);
  assert.equal(verifyCalls[0]?.deployedAt, "2026-09-04T12:00:00.000Z");
  assert.equal(verification.outcome, "PASS");
});

test("rollback refuses mismatched reviewed target evidence before provider inspection", async () => {
  for (const target of [
    { ...previousDeployment, environment: "qa" as const },
    { ...previousDeployment, publicUrl: "https://other.example.test" },
    { ...previousDeployment, providerTarget: { ...previousDeployment.providerTarget, accountId: "other-account" } },
    { ...previousDeployment, providerTarget: { ...previousDeployment.providerTarget, workerName: "other-worker" } },
    { ...previousDeployment, configFingerprint: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" },
  ]) {
    const provider = new FakeRollbackProvider();
    await assert.rejects(
      () => rollbackVs005Application({
        request: {
          ...rollbackRequest,
          expectedEnvironment: target.environment,
          expectedProviderTarget: target.providerTarget,
          expectedPublicUrl: target.publicUrl,
          expectedConfigFingerprint: target.configFingerprint,
        },
        currentDeploymentEvidence,
        targetDeploymentEvidence: target,
        currentConfig: validConfig,
        provider,
        verify: async () => passingVerification(),
      }),
      /ROLLBACK (TARGET|CONFIGURATION) MISMATCH/,
    );
    assert.deepEqual(provider.rollbackCalls, []);
  }
});

test("rollback refuses a changed live Cloudflare account or Worker before mutation", async () => {
  const provider = new FakeRollbackProvider({
    accountId: "wrong-account",
    workerName: currentDeploymentEvidence.providerTarget.workerName,
  });

  await assert.rejects(
    () => rollbackVs005Application({
      request: rollbackRequest,
      currentDeploymentEvidence,
      targetDeploymentEvidence: previousDeployment,
      currentConfig: validConfig,
      provider,
      verify: async () => passingVerification(),
    }),
    /ROLLBACK PROVIDER TARGET MISMATCH/,
  );
  assert.deepEqual(provider.rollbackCalls, []);
});

test("rollback verification failure remains a failed rollback outcome", async () => {
  const provider = new FakeRollbackProvider();
  const verification = await rollbackVs005Application({
    request: rollbackRequest,
    currentDeploymentEvidence,
    targetDeploymentEvidence: previousDeployment,
    currentConfig: validConfig,
    provider,
    verify: async () => failingVerification("RELEASE_DRIFT"),
  });

  assert.equal(verification.outcome, "FAIL");
});

test("rollback refuses contradictory request identity and wrong active version", async () => {
  const provider = new FakeRollbackProvider();
  await assert.rejects(
    () => rollbackVs005Application({
      request: { ...rollbackRequest, providerVersionId: "version-other" },
      currentDeploymentEvidence,
      targetDeploymentEvidence: previousDeployment,
      currentConfig: validConfig,
      provider,
      verify: async () => passingVerification(),
    }),
    /ROLLBACK TARGET MISMATCH/,
  );
  assert.deepEqual(provider.rollbackCalls, []);

  const wrongVersionProvider: Vs005RollbackProvider = {
    inspectTarget: async () => ({ accountId: "account-123", workerName: "cadence-beta" }),
    rollback: async (providerVersionId) => ({
      deploymentId: "deployment-after-rollback",
      activeProviderVersionId: `${providerVersionId}-different`,
    }),
  };
  await assert.rejects(
    () => rollbackVs005Application({
      request: rollbackRequest,
      currentDeploymentEvidence,
      targetDeploymentEvidence: previousDeployment,
      currentConfig: validConfig,
      provider: wrongVersionProvider,
      verify: async () => passingVerification(),
    }),
    /ROLLBACK ACTIVE VERSION MISMATCH/,
  );
});

test("rollback preserves target release/configuration identity and database NONE", async () => {
  const provider = new FakeRollbackProvider();
  let reconstructed: Vs005DeploymentResult | undefined;
  await rollbackVs005Application({
    request: rollbackRequest,
    currentDeploymentEvidence,
    targetDeploymentEvidence: previousDeployment,
    currentConfig: validConfig,
    provider,
    verify: async (deployment) => {
      reconstructed = deployment;
      return passingVerification();
    },
  });

  assert.deepEqual(reconstructed?.release, previousDeployment.release);
  assert.equal(reconstructed?.configFingerprint, rollbackFingerprint);
  assert.equal(reconstructed?.environment, "beta");
  assert.deepEqual(reconstructed?.providerTarget, previousDeployment.providerTarget);
  assert.equal(reconstructed?.publicUrl, previousDeployment.publicUrl);
  assert.equal(reconstructed?.databaseAction, "NONE");
  assert.deepEqual(reconstructed?.destructiveActions, []);
});

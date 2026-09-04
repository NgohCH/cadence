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
  applyVs005Deployment,
  type Vs005DeploymentProvider,
  type Vs005DeploymentProviderInspection,
  type Vs005DeploymentResult,
} from "./vs005-deploy-apply";
import type { Vs005DeploymentPlan } from "./vs005-deployment-artifacts";

const config = validateCadenceRuntimeConfig(JSON.parse(
  readFileSync(resolve(process.cwd(), "../../config/cadence.runtime.ci.json"), "utf8"),
));

const release: CadenceReleaseIdentity = {
  version: "1.0.0",
  commitSha: "0123456789abcdef0123456789abcdef01234567",
  buildId: "2026-09-04T10:00:00Z",
};

const inspection: Vs005DeploymentProviderInspection = {
  accountId: "account-123",
  workerName: "cadence-beta",
  workerExists: true,
  configuredSecrets: ["SUPABASE_SECRET_KEY"],
  configFingerprint: fingerprintCadenceRuntimeConfig(config),
};

function validPlan(overrides: Partial<Vs005DeploymentPlan> = {}): Vs005DeploymentPlan {
  return {
    artifactType: "cadence.vs005.deployment-plan",
    formatVersion: 1,
    planId: "plan-1",
    configFingerprint: fingerprintCadenceRuntimeConfig(config),
    release,
    environment: "beta",
    provider: "cloudflare",
    providerTarget: {
      accountId: "account-123",
      workerName: "cadence-beta",
      workerExists: true,
    },
    publicUrl: config.application.publicUrl,
    supabaseProjectRef: config.supabase.projectRef,
    configVersion: 1,
    worker: {
      schedule: config.worker.schedule,
      maxRounds: config.worker.maxRounds,
      maxDeliveryAttempts: config.worker.maxDeliveryAttempts,
      maxMembershipExpiryAttempts: config.worker.maxMembershipExpiryAttempts,
      softDeadlineSeconds: config.worker.softDeadlineSeconds,
    },
    secrets: [{
      name: "SUPABASE_SECRET_KEY",
      providerPresent: true,
      bootstrapInputAvailable: false,
      ready: true,
    }],
    database: { migrationAction: "NONE" },
    rollback: { application: "SUPPORTED", database: "NOT_PERFORMED" },
    changes: ["WEB_STATIC_ASSETS", "API_WORKER", "SCHEDULED_WORKER"],
    destructiveActions: [],
    readiness: "PASS",
    blockers: [],
    ...overrides,
  };
}

function makeProvider(
  state: Vs005DeploymentProviderInspection = inspection,
): Vs005DeploymentProvider & {
  inspectCalls: number;
  deployCalls: Array<Record<string, unknown>>;
} {
  const provider = {
    inspectCalls: 0,
    deployCalls: [] as Array<Record<string, unknown>>,
    async inspect() {
      provider.inspectCalls += 1;
      return state;
    },
    async deploy(input: Record<string, unknown>) {
      provider.deployCalls.push(input);
      return { deploymentId: "deployment-1", providerVersionId: "version-1" };
    },
  };
  return provider;
}

function makePreparation(order: string[], throws = false) {
  return async () => {
    order.push("prepare");
    if (throws) throw new Error("local artifact failure");
    return { generatedWranglerPath: "wrangler.generated.jsonc" };
  };
}

function apply(
  plan: unknown,
  overrides: Partial<Parameters<typeof applyVs005Deployment>[0]> = {},
) {
  return applyVs005Deployment({
    plan,
    config,
    currentRelease: release,
    currentSecrets: { supabaseSecretKey: "server-secret" },
    provider: makeProvider(),
    prepareArtifacts: makePreparation([]),
    clock: () => new Date("2026-09-04T12:34:56.000Z"),
    ...overrides,
  });
}

test("current config fingerprint mismatch rejects before inspection or deployment", async () => {
  const provider = makeProvider();
  const changedConfig = JSON.parse(JSON.stringify(config));
  changedConfig.worker.maxRounds = 11;

  await assert.rejects(
    () => apply(validPlan(), { config: changedConfig, provider }),
    /fingerprint|config/i,
  );
  assert.equal(provider.inspectCalls, 0);
  assert.equal(provider.deployCalls.length, 0);
});

test("release mismatch rejects without deployment", async () => {
  const provider = makeProvider();
  await assert.rejects(
    () => apply(validPlan(), {
      provider,
      currentRelease: { ...release, commitSha: "abcdefabcdefabcdefabcdefabcdefabcdefabcd" },
    }),
    /release/i,
  );
  assert.equal(provider.deployCalls.length, 0);
});

test("blocked plan rejects without provider mutation", async () => {
  const provider = makeProvider();
  await assert.rejects(
    () => apply(validPlan({ readiness: "BLOCKED" }), { provider }),
    /readiness|blocked/i,
  );
  assert.equal(provider.deployCalls.length, 0);
});

test("destructive plan artifact rejects before provider deployment", async () => {
  const provider = makeProvider();
  const destructivePlan = { ...validPlan(), destructiveActions: ["DELETE_TARGET"] };
  await assert.rejects(
    () => apply(destructivePlan, { provider }),
    /destructive/i,
  );
  assert.equal(provider.deployCalls.length, 0);
});

for (const [name, state] of [
  ["account", { ...inspection, accountId: "other-account" }],
  ["worker name", { ...inspection, workerName: "cadence-other" }],
  ["worker existence", { ...inspection, workerExists: false }],
] as const) {
  test(`${name} drift requires a new deployment plan`, async () => {
    const provider = makeProvider(state);
    await assert.rejects(
      () => apply(validPlan(), { provider }),
      /new deployment plan|drift/i,
    );
    assert.equal(provider.deployCalls.length, 0);
  });
}

test("remote secret state drift rejects without deployment", async () => {
  const provider = makeProvider({ ...inspection, configuredSecrets: [] });
  await assert.rejects(
    () => apply(validPlan(), { provider }),
    /secret|drift/i,
  );
  assert.equal(provider.deployCalls.length, 0);
});

test("existing Worker config drift rejects without overwriting it", async () => {
  const provider = makeProvider({
    ...inspection,
    configFingerprint: "different-fingerprint",
  });
  await assert.rejects(
    () => apply(validPlan(), { provider }),
    /new deployment plan|config|drift/i,
  );
  assert.equal(provider.deployCalls.length, 0);
});

test("artifact preparation failure prevents provider deployment", async () => {
  const provider = makeProvider();
  await assert.rejects(
    () => apply(validPlan(), {
      provider,
      prepareArtifacts: makePreparation([], true),
    }),
    /artifact/i,
  );
  assert.equal(provider.deployCalls.length, 0);
});

test("provider inspection precedes preparation and preparation precedes deployment", async () => {
  const order: string[] = [];
  const provider = makeProvider();
  const originalInspect = provider.inspect;
  provider.inspect = async (...args) => {
    order.push("inspect");
    return originalInspect(...args);
  };
  provider.deploy = async (input) => {
    order.push("deploy");
    provider.deployCalls.push(input);
    return { deploymentId: "deployment-1", providerVersionId: "version-1" };
  };

  await apply(validPlan(), {
    provider,
    prepareArtifacts: makePreparation(order),
  });
  assert.deepEqual(order, ["inspect", "prepare", "deploy"]);
});

test("bootstrap secret is forwarded only for a first deployment", async () => {
  const provider = makeProvider({ ...inspection, workerExists: false, configuredSecrets: [] });
  const result = await apply(validPlan({
    providerTarget: { ...validPlan().providerTarget, workerExists: false },
    rollback: { application: "UNAVAILABLE", database: "NOT_PERFORMED" },
    secrets: [{
      name: "SUPABASE_SECRET_KEY",
      providerPresent: false,
      bootstrapInputAvailable: true,
      ready: true,
    }],
  }), { provider });
  assert.deepEqual(provider.deployCalls[0]?.bootstrapSecrets, {
    supabaseSecretKey: "server-secret",
  });
  assert.doesNotMatch(JSON.stringify(result), /server-secret/);
});

test("missing bootstrap secret rejects before provider deployment", async () => {
  const provider = makeProvider({ ...inspection, workerExists: false, configuredSecrets: [] });
  await assert.rejects(
    () => apply(validPlan({
      providerTarget: { ...validPlan().providerTarget, workerExists: false },
      rollback: { application: "UNAVAILABLE", database: "NOT_PERFORMED" },
      secrets: [{
        name: "SUPABASE_SECRET_KEY",
        providerPresent: false,
        bootstrapInputAvailable: true,
        ready: true,
      }],
    }), { provider, currentSecrets: undefined }),
    /secret/i,
  );
  assert.equal(provider.deployCalls.length, 0);
});

test("existing remote secret does not forward an unnecessary local bootstrap value", async () => {
  const provider = makeProvider();
  await apply(validPlan(), { provider, currentSecrets: { supabaseSecretKey: "server-secret" } });
  assert.equal("bootstrapSecrets" in (provider.deployCalls[0] ?? {}), false);
});

test("apply result is safe provenance and does not self-certify verification", async () => {
  const result: Vs005DeploymentResult = await apply(validPlan());
  assert.deepEqual(result, {
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
    release,
    configFingerprint: fingerprintCadenceRuntimeConfig(config),
    databaseAction: "NONE",
    destructiveActions: [],
  });
  assert.doesNotMatch(JSON.stringify(result), /server-secret|password|token|stack/i);
});

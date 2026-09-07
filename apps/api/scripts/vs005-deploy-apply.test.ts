import assert from "node:assert/strict";
import test from "node:test";

import {
  fingerprintCadenceRuntimeConfig,
  validateCadenceRuntimeConfig,
  type CadenceRuntimeConfig,
} from "../src/bootstrap/cadence-config";
import {
  getCadenceTargetFacts,
  VS005_BETA_TARGET_POLICY,
} from "../src/bootstrap/cadence-target-policy";
import type { CadenceReleaseIdentity } from "../src/bootstrap/cadence-release";
import {
  applyVs005Deployment,
  type Vs005DeploymentProvider,
  type Vs005DeploymentProviderInspection,
  type Vs005DeploymentResult,
} from "./vs005-deploy-apply";
import type { Vs005DeploymentPlanV2 } from "./vs005-deployment-artifacts";
import type {
  Vs005MutationEnvelope,
  Vs005Observation,
  Vs005ProviderObservationSnapshot,
} from "./vs005-provider-observations";

const observed = <T>(value: T): Vs005Observation<T> => ({
  state: "OBSERVED_VALUE",
  value,
});
const absent = <T>(): Vs005Observation<T> => ({ state: "OBSERVED_ABSENT" });
const unavailable = <T>(code: string): Vs005Observation<T> => ({
  state: "UNAVAILABLE",
  code,
});

const config = validateCadenceRuntimeConfig({
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

const release: CadenceReleaseIdentity = {
  version: "1.0.0",
  commitSha: "0123456789abcdef0123456789abcdef01234567",
  buildId: "2026-09-04T10:00:00Z",
};

function observations(
  currentConfig: CadenceRuntimeConfig = config,
  overrides: Partial<Vs005ProviderObservationSnapshot> = {},
): Vs005ProviderObservationSnapshot {
  return {
    accountId: observed(currentConfig.cloudflare!.accountId),
    workerName: observed(currentConfig.cloudflare!.workerName),
    workerExists: observed(true),
    workerConfigFingerprint: observed(fingerprintCadenceRuntimeConfig(currentConfig)),
    cronSchedules: observed([currentConfig.worker.schedule]),
    nonSecretBindingNames: observed(["ASSETS"]),
    secretNames: observed([currentConfig.supabase.secretKeySecretRef]),
    currentRelease: observed(release),
    priorVersion: absent(),
    hostname: observed(new URL(currentConfig.application.publicUrl).hostname),
    ...overrides,
  };
}

function providerInspection(
  providerObservations: Vs005ProviderObservationSnapshot,
): Vs005DeploymentProviderInspection {
  return {
    accountId: providerObservations.accountId.state === "OBSERVED_VALUE"
      ? providerObservations.accountId.value
      : "",
    workerName: providerObservations.workerName.state === "OBSERVED_VALUE"
      ? providerObservations.workerName.value
      : "",
    workerExists: providerObservations.workerExists.state === "OBSERVED_VALUE"
      ? providerObservations.workerExists.value
      : false,
    configuredSecrets: providerObservations.secretNames.state === "OBSERVED_VALUE"
      ? providerObservations.secretNames.value
      : [],
    configFingerprint: providerObservations.workerConfigFingerprint.state === "OBSERVED_VALUE"
      ? providerObservations.workerConfigFingerprint.value
      : null,
    observations: providerObservations,
  };
}

const defaultEnvelope: Vs005MutationEnvelope = {
  workerAction: "CREATE_OR_UPDATE",
  cronAction: "NO_CHANGE",
  secretNamesToSet: [],
};

function validPlan(
  overrides: Partial<Vs005DeploymentPlanV2> = {},
): Vs005DeploymentPlanV2 {
  const providerObservations = observations();
  const target = getCadenceTargetFacts(config);
  return {
    artifactType: "cadence.vs005.deployment-plan",
    formatVersion: 2,
    planId: "plan-1",
    intendedTarget: target,
    targetPolicy: { name: VS005_BETA_TARGET_POLICY.name },
    observedProvider: providerObservations,
    observationPhase: "FIRST_DEPLOYMENT_READINESS",
    mutationEnvelope: defaultEnvelope,
    configFingerprint: fingerprintCadenceRuntimeConfig(config),
    release,
    database: { migrationAction: "NONE" },
    destructiveActions: [],
    readiness: "PASS",
    blockers: [],
    environment: config.application.environment,
    provider: "cloudflare",
    providerTarget: {
      accountId: target.cloudflare.accountId,
      workerName: target.cloudflare.workerName,
      workerExists: true,
    },
    publicUrl: config.application.publicUrl,
    supabaseProjectRef: config.supabase.projectRef,
    configVersion: config.configVersion,
    worker: {
      schedule: config.worker.schedule,
      maxRounds: config.worker.maxRounds,
      maxDeliveryAttempts: config.worker.maxDeliveryAttempts,
      maxMembershipExpiryAttempts: config.worker.maxMembershipExpiryAttempts,
      softDeadlineSeconds: config.worker.softDeadlineSeconds,
    },
    secrets: [{
      name: config.supabase.secretKeySecretRef,
      providerPresent: true,
      bootstrapInputAvailable: false,
      ready: true,
    }],
    rollback: { application: "UNAVAILABLE", database: "NOT_PERFORMED" },
    changes: ["WEB_STATIC_ASSETS", "API_WORKER", "SCHEDULED_WORKER"],
    ...overrides,
  };
}

function makeProvider(
  providerObservations: Vs005ProviderObservationSnapshot = observations(),
): Vs005DeploymentProvider & {
  inspectCalls: number;
  deployCalls: Array<Record<string, unknown>>;
} {
  const provider = {
    inspectCalls: 0,
    deployCalls: [] as Array<Record<string, unknown>>,
    async inspect() {
      provider.inspectCalls += 1;
      return providerInspection(providerObservations);
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
    targetPolicy: VS005_BETA_TARGET_POLICY,
    currentRelease: release,
    currentSecrets: { supabaseSecretKey: "server-secret" },
    provider: makeProvider(),
    prepareArtifacts: makePreparation([]),
    clock: () => new Date("2026-09-04T12:34:56.000Z"),
    ...overrides,
  });
}

test("exact reviewed state reaches the injected mutation boundary", async () => {
  const provider = makeProvider();
  const result = await apply(validPlan(), { provider });

  assert.equal(provider.deployCalls.length, 1);
  assert.deepEqual(result.intendedTarget, VS005_BETA_TARGET_POLICY.expected);
  assert.deepEqual(result.observedProvider, observations());
  assert.equal(result.databaseAction, "NONE");
  assert.deepEqual(result.destructiveActions, []);
  assert.doesNotMatch(JSON.stringify(result), /server-secret|password|token|stack/i);
});

test("legacy mutation plan is rejected before provider deployment", async () => {
  const provider = makeProvider();
  await assert.rejects(
    () => apply({ ...validPlan(), formatVersion: 1 }, { provider }),
    /plan|version|unsupported/i,
  );
  assert.equal(provider.deployCalls.length, 0);
});

for (const [field, changedPatch, expectedError] of [
  ["account", { cloudflare: { ...config.cloudflare!, accountId: "other-account" } }, /target|account/i],
  ["Worker", { cloudflare: { ...config.cloudflare!, workerName: "other-worker" } }, /target|worker/i],
  ["URL", { application: { ...config.application, publicUrl: "https://other.example.test" } }, /target|url/i],
  ["Supabase ref", {
    supabase: { ...config.supabase, projectRef: "otherref", url: "https://otherref.supabase.co" },
  }, /target|supabase/i],
  ["safe marker", { pilot: { ...config.pilot, safeTargetMarker: "other-marker" } }, /target|marker/i],
  ["controlled Project", {
    pilot: { ...config.pilot, projectId: "11111111-1111-4111-8111-111111111111" },
  }, /target|project/i],
] as const) {
  test(`apply rejects wrong ${field} before provider deployment`, async () => {
    const provider = makeProvider();
    const changedConfig = validateCadenceRuntimeConfig({ ...config, ...changedPatch });
    await assert.rejects(
      () => apply(validPlan(), { config: changedConfig, provider }),
      expectedError,
    );
    assert.equal(provider.inspectCalls, 0);
    assert.equal(provider.deployCalls.length, 0);
  });
}

test("apply rejects stale intended target", async () => {
  const provider = makeProvider();
  await assert.rejects(
    () => apply(validPlan({
      intendedTarget: { ...getCadenceTargetFacts(config), safeTargetMarker: "stale-marker" },
    }), { provider }),
    /target|stale|marker/i,
  );
  assert.equal(provider.deployCalls.length, 0);
});

test("apply rejects stale config fingerprint", async () => {
  const provider = makeProvider();
  const changedConfig = validateCadenceRuntimeConfig({
    ...config,
    worker: { ...config.worker, maxRounds: 11 },
  });
  await assert.rejects(
    () => apply(validPlan(), { config: changedConfig, provider }),
    /fingerprint|config/i,
  );
  assert.equal(provider.inspectCalls, 0);
  assert.equal(provider.deployCalls.length, 0);
});

test("apply rejects stale release", async () => {
  const provider = makeProvider();
  await assert.rejects(
    () => apply(validPlan(), {
      provider,
      currentRelease: { ...release, commitSha: "abcdefabcdefabcdefabcdefabcdefabcdefabcd" },
    }),
    /release/i,
  );
  assert.equal(provider.inspectCalls, 0);
  assert.equal(provider.deployCalls.length, 0);
});

test("apply rejects required unavailable observation", async () => {
  const provider = makeProvider(observations(config, {
    accountId: unavailable("ACCOUNT_UNAVAILABLE"),
  }));
  await assert.rejects(
    () => apply(validPlan(), { provider }),
    /observation|account|unavailable/i,
  );
  assert.equal(provider.deployCalls.length, 0);
});

test("apply accepts absent Worker only for first deployment envelope", async () => {
  const firstDeploymentObservations = observations(config, {
    workerExists: absent(),
    workerConfigFingerprint: absent(),
    nonSecretBindingNames: absent(),
    cronSchedules: absent(),
    secretNames: absent(),
    currentRelease: absent(),
    priorVersion: absent(),
  });
  const provider = makeProvider(firstDeploymentObservations);
  const result = await apply(validPlan({
    observedProvider: firstDeploymentObservations,
    providerTarget: { ...validPlan().providerTarget, workerExists: false },
    mutationEnvelope: {
      workerAction: "CREATE_OR_UPDATE",
      cronAction: "CREATE_OR_CHANGE",
      secretNamesToSet: ["SUPABASE_SECRET_KEY"],
    },
    secrets: [{
      name: "SUPABASE_SECRET_KEY",
      providerPresent: false,
      bootstrapInputAvailable: true,
      ready: true,
    }],
    rollback: { application: "UNAVAILABLE", database: "NOT_PERFORMED" },
  }), { provider });

  assert.equal(provider.deployCalls.length, 1);
  assert.deepEqual(provider.deployCalls[0]?.bootstrapSecrets, {
    supabaseSecretKey: "server-secret",
  });
  assert.doesNotMatch(JSON.stringify(result), /server-secret/);
});

test("apply rejects absent secret without planned setting", async () => {
  const providerObservations = observations(config, { secretNames: absent() });
  const provider = makeProvider(providerObservations);
  await assert.rejects(
    () => apply(validPlan({
      observedProvider: providerObservations,
      mutationEnvelope: defaultEnvelope,
      secrets: [{
        name: "SUPABASE_SECRET_KEY",
        providerPresent: false,
        bootstrapInputAvailable: true,
        ready: false,
      }],
    }), { provider }),
    /secret|envelope/i,
  );
  assert.equal(provider.deployCalls.length, 0);
});

test("apply rejects unexpected secret-state change", async () => {
  const planObservations = observations(config, { secretNames: absent() });
  const provider = makeProvider(observations(config));
  await assert.rejects(
    () => apply(validPlan({
      observedProvider: planObservations,
      mutationEnvelope: {
        workerAction: "CREATE_OR_UPDATE",
        cronAction: "NO_CHANGE",
        secretNamesToSet: ["SUPABASE_SECRET_KEY"],
      },
      secrets: [{
        name: "SUPABASE_SECRET_KEY",
        providerPresent: false,
        bootstrapInputAvailable: true,
        ready: true,
      }],
    }), { provider }),
    /secret|drift/i,
  );
  assert.equal(provider.deployCalls.length, 0);
});

test("apply rejects provider account and Worker drift", async () => {
  for (const changed of [
    observations(config, { accountId: observed("other-account") }),
    observations(config, { workerName: observed("other-worker") }),
    observations(config, { workerExists: absent() }),
  ]) {
    const provider = makeProvider(changed);
    await assert.rejects(() => apply(validPlan(), { provider }), /drift|provider|worker|account/i);
    assert.equal(provider.deployCalls.length, 0);
  }
});

test("apply rejects Cron precondition drift", async () => {
  const provider = makeProvider(observations(config, { cronSchedules: absent() }));
  await assert.rejects(() => apply(validPlan(), { provider }), /cron|drift|observation|unavailable/i);
  assert.equal(provider.deployCalls.length, 0);
});

test("apply rejects database action", async () => {
  const provider = makeProvider();
  await assert.rejects(
    () => apply({ ...validPlan(), database: { migrationAction: "NEW_MIGRATION" } } as unknown, { provider }),
    /database|migration/i,
  );
  assert.equal(provider.deployCalls.length, 0);
});

test("apply rejects destructive action", async () => {
  const provider = makeProvider();
  await assert.rejects(
    () => apply({ ...validPlan(), destructiveActions: ["DELETE_TARGET"] } as unknown, { provider }),
    /destructive/i,
  );
  assert.equal(provider.deployCalls.length, 0);
});

test("apply rejects missing approved Worker action without mutation", async () => {
  const provider = makeProvider();
  await assert.rejects(
    () => apply(validPlan({
      mutationEnvelope: {
        workerAction: "NOT_ALLOWED",
        cronAction: "NO_CHANGE",
        secretNamesToSet: [],
      } as unknown as Vs005MutationEnvelope,
    }), { provider }),
    /envelope|worker/i,
  );
  assert.equal(provider.deployCalls.length, 0);
});

test("apply rejects unavailable secret observation without mutation", async () => {
  const provider = makeProvider(observations(config, {
    secretNames: unavailable("SECRET_UNAVAILABLE"),
  }));
  await assert.rejects(
    () => apply(validPlan(), { provider }),
    /secret|observation|unavailable/i,
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

test("missing bootstrap secret prevents provider deployment", async () => {
  const firstDeploymentObservations = observations(config, {
    workerExists: absent(),
    workerConfigFingerprint: absent(),
    nonSecretBindingNames: absent(),
    cronSchedules: absent(),
    secretNames: absent(),
    currentRelease: absent(),
    priorVersion: absent(),
  });
  const provider = makeProvider(firstDeploymentObservations);
  await assert.rejects(
    () => apply(validPlan({
      observedProvider: firstDeploymentObservations,
      providerTarget: { ...validPlan().providerTarget, workerExists: false },
      mutationEnvelope: {
        workerAction: "CREATE_OR_UPDATE",
        cronAction: "CREATE_OR_CHANGE",
        secretNamesToSet: ["SUPABASE_SECRET_KEY"],
      },
      secrets: [{
        name: "SUPABASE_SECRET_KEY",
        providerPresent: false,
        bootstrapInputAvailable: true,
        ready: true,
      }],
      rollback: { application: "UNAVAILABLE", database: "NOT_PERFORMED" },
    }), { provider, currentSecrets: undefined }),
    /secret/i,
  );
  assert.equal(provider.deployCalls.length, 0);
});

test("present remote secret does not receive unnecessary bootstrap input", async () => {
  const provider = makeProvider();
  await apply(validPlan(), { provider, currentSecrets: { supabaseSecretKey: "server-secret" } });
  assert.equal("bootstrapSecrets" in (provider.deployCalls[0] ?? {}), false);
});

test("apply reinspection occurs before local artifact preparation", async () => {
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

test("secret-looking provider fields never enter apply evidence or errors", async () => {
  const unsafe = observations(config, {
    accountId: observed("token=secret-value"),
  }) as Vs005ProviderObservationSnapshot & { secretValue: string };
  unsafe.secretValue = "server-secret-must-not-escape";
  const provider = makeProvider(unsafe);

  await assert.rejects(() => apply(validPlan(), { provider }), /target|account|provider|drift/i);
  assert.equal(provider.deployCalls.length, 0);
});

test("exact reviewed result has safe deployment provenance", async () => {
  const result: Vs005DeploymentResult = await apply(validPlan());
  assert.equal(result.artifactType, "cadence.vs005.deployment-result");
  assert.equal(result.providerVersionId, "version-1");
  assert.deepEqual(result.intendedTarget, VS005_BETA_TARGET_POLICY.expected);
  assert.equal(result.release.commitSha, release.commitSha);
  assert.equal(result.configFingerprint, fingerprintCadenceRuntimeConfig(config));
  assert.equal(result.databaseAction, "NONE");
  assert.deepEqual(result.destructiveActions, []);
});

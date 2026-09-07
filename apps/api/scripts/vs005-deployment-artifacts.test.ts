import assert from "node:assert/strict";
import test from "node:test";

import type { CadenceReleaseIdentity } from "../src/bootstrap/cadence-release";
import type { CadenceTargetFacts } from "../src/bootstrap/cadence-target-policy";
import type {
  Vs005MutationEnvelope,
  Vs005ProviderObservationSnapshot,
} from "./vs005-provider-observations";
import {
  makeVs005OperatorFailure,
  type Vs005DeploymentPlan,
} from "./vs005-deployment-artifacts";

test("operator failure records actionable safe context without a raw exception", () => {
  const failure = makeVs005OperatorFailure({
    stage: "apply",
    code: "CONFIG_FINGERPRINT_MISMATCH",
    mutationOccurred: false,
    existingService: "UNCHANGED",
    canonicalConfigPath: "config/cadence.runtime.beta.json",
    safeExpected: { configFingerprint: "expected" },
    safeObserved: { configFingerprint: "observed" },
    nextAction: "Run cadence:deploy:plan again with the reviewed canonical config.",
  });

  assert.equal(failure.artifactType, "cadence.vs005.operator-failure");
  assert.equal(failure.formatVersion, 1);
  assert.equal(failure.mutationOccurred, false);
  assert.equal(failure.existingService, "UNCHANGED");
  assert.doesNotMatch(JSON.stringify(failure), /server-secret|stack|password|token/i);
  assert.deepEqual(
    Object.keys(failure).filter((key) =>
      ["error", "cause", "stack", "messageBody"].includes(key),
    ),
    [],
  );
  assert.equal(Object.isFrozen(failure), true);
});

test("deployment plan records intended target, observations, envelope, and no database action", () => {
  const release: CadenceReleaseIdentity = {
    version: "1.0.0",
    commitSha: "0123456789abcdef0123456789abcdef01234567",
    buildId: "build-1",
  };
  const intendedTarget: CadenceTargetFacts = {
    environment: "beta",
    safeTargetMarker: "cadence-beta",
    cloudflare: { accountId: "account-1", workerName: "worker-1" },
    publicUrl: "https://worker-1.example.test",
    supabaseProjectRef: "project-1",
    pilotProjectId: "11111111-1111-4111-8111-111111111111",
  };
  const observedProvider: Vs005ProviderObservationSnapshot = {
    accountId: { state: "OBSERVED_VALUE", value: "account-1" },
    workerName: { state: "OBSERVED_VALUE", value: "worker-1" },
    workerExists: { state: "OBSERVED_ABSENT" },
    workerConfigFingerprint: { state: "OBSERVED_ABSENT" },
    cronSchedules: { state: "OBSERVED_ABSENT" },
    nonSecretBindingNames: { state: "OBSERVED_ABSENT" },
    secretNames: { state: "OBSERVED_VALUE", value: ["SUPABASE_SECRET_KEY"] },
    currentRelease: { state: "OBSERVED_ABSENT" },
    priorVersion: { state: "OBSERVED_ABSENT" },
    hostname: { state: "OBSERVED_VALUE", value: "worker-1.example.test" },
  };
  const mutationEnvelope: Vs005MutationEnvelope = {
    workerAction: "CREATE_OR_UPDATE",
    cronAction: "CREATE_OR_CHANGE",
    secretNamesToSet: [],
  };
  const plan: Vs005DeploymentPlan = {
    artifactType: "cadence.vs005.deployment-plan",
    formatVersion: 2,
    planId: "plan-1",
    intendedTarget,
    targetPolicy: { name: "separate-policy" },
    observedProvider,
    observationPhase: "FIRST_DEPLOYMENT_READINESS",
    mutationEnvelope,
    configFingerprint: "a".repeat(64),
    release,
    database: { migrationAction: "NONE" },
    destructiveActions: [],
    readiness: "PASS",
    blockers: [],
    environment: "beta",
    provider: "cloudflare",
    providerTarget: {
      accountId: intendedTarget.cloudflare.accountId,
      workerName: intendedTarget.cloudflare.workerName,
      workerExists: false,
    },
    publicUrl: intendedTarget.publicUrl,
    supabaseProjectRef: intendedTarget.supabaseProjectRef,
    configVersion: 1,
    worker: {
      schedule: "* * * * *",
      maxRounds: 10,
      maxDeliveryAttempts: 20,
      maxMembershipExpiryAttempts: 20,
      softDeadlineSeconds: 20,
    },
    secrets: [{
      name: "SUPABASE_SECRET_KEY",
      providerPresent: true,
      bootstrapInputAvailable: false,
      ready: true,
    }],
    rollback: { application: "UNAVAILABLE", database: "NOT_PERFORMED" },
    changes: ["WEB_STATIC_ASSETS", "API_WORKER", "SCHEDULED_WORKER"],
  };

  assert.equal(plan.formatVersion, 2);
  assert.deepEqual(plan.intendedTarget, intendedTarget);
  assert.deepEqual(plan.observedProvider, observedProvider);
  assert.deepEqual(plan.mutationEnvelope, mutationEnvelope);
  assert.equal(plan.database.migrationAction, "NONE");
  assert.deepEqual(plan.destructiveActions, []);
  assert.doesNotMatch(JSON.stringify(plan), /server-secret|secret-value|token=/i);
});

import assert from "node:assert/strict";
import test from "node:test";
import type { CadenceReleaseIdentity } from "../src/bootstrap/cadence-release";
import {
  validateVs005ObservationCompleteness,
  type Vs005MutationEnvelope,
  type Vs005Observation,
  type Vs005ProviderObservationSnapshot,
} from "./vs005-provider-observations";

const release: CadenceReleaseIdentity = {
  version: "0.0.0-test",
  commitSha: "0123456789abcdef0123456789abcdef01234567",
  buildId: "2026-09-04T00:00:00Z",
};

function observed<T>(value: T): Vs005Observation<T> {
  return { state: "OBSERVED_VALUE", value };
}

function absent<T>(): Vs005Observation<T> {
  return { state: "OBSERVED_ABSENT" };
}

function unavailable<T>(code = "PROVIDER_READ_UNAVAILABLE"): Vs005Observation<T> {
  return { state: "UNAVAILABLE", code };
}

function firstDeploymentObservations(
  overrides: Partial<Vs005ProviderObservationSnapshot> = {},
): Vs005ProviderObservationSnapshot {
  return {
    accountId: observed("account-123"),
    workerName: observed("worker-test"),
    workerExists: observed(true),
    workerConfigFingerprint: observed("config-fingerprint"),
    cronSchedules: observed(["* * * * *"]),
    nonSecretBindingNames: observed(["ASSETS"]),
    secretNames: observed(["SUPABASE_SECRET_KEY"]),
    currentRelease: observed(release),
    priorVersion: absent(),
    hostname: observed("worker.example.test"),
    ...overrides,
  };
}

function rollbackObservations(
  overrides: Partial<Vs005ProviderObservationSnapshot> = {},
): Vs005ProviderObservationSnapshot {
  return {
    ...firstDeploymentObservations(),
    priorVersion: observed({
      providerVersionId: "version-a",
      release,
      configFingerprint: "config-fingerprint-a",
    }),
    ...overrides,
  };
}

function firstDeploymentEnvelope(overrides: Partial<Vs005MutationEnvelope> = {}): Vs005MutationEnvelope {
  return {
    workerAction: "CREATE_OR_UPDATE",
    cronAction: "NO_CHANGE",
    secretNamesToSet: [],
    ...overrides,
  };
}

function blockerCodes(blockers: readonly { code: string; message: string }[]): string[] {
  return blockers.map((blocker) => blocker.code);
}

test("OBSERVED_VALUE retains a bounded value", () => {
  assert.deepEqual(observed("account-123"), {
    state: "OBSERVED_VALUE",
    value: "account-123",
  });
});

test("OBSERVED_ABSENT is not UNAVAILABLE", () => {
  const observation = absent<string>();
  assert.equal(observation.state, "OBSERVED_ABSENT");
  assert.notEqual(observation.state, "UNAVAILABLE");
  assert.equal("value" in observation, false);
});

test("UNAVAILABLE is explicit", () => {
  assert.deepEqual(unavailable("ACCOUNT_READ_FAILED"), {
    state: "UNAVAILABLE",
    code: "ACCOUNT_READ_FAILED",
  });
});

test("first deployment permits absent Worker with no prior version requirement", () => {
  const blockers = validateVs005ObservationCompleteness({
    phase: "FIRST_DEPLOYMENT_READINESS",
    observations: firstDeploymentObservations({
      workerExists: absent(),
      workerConfigFingerprint: absent(),
      cronSchedules: absent(),
      nonSecretBindingNames: absent(),
      secretNames: absent(),
      currentRelease: absent(),
      priorVersion: unavailable("NO_PRIOR_VERSION_LOOKUP"),
    }),
    mutationEnvelope: firstDeploymentEnvelope({
      cronAction: "CREATE_OR_CHANGE",
      secretNamesToSet: ["SUPABASE_SECRET_KEY"],
    }),
  });

  assert.deepEqual(blockers, []);
});

test("first deployment permits absent Cron only when planned", () => {
  const observations = firstDeploymentObservations({ cronSchedules: absent() });

  assert.deepEqual(
    validateVs005ObservationCompleteness({
      phase: "FIRST_DEPLOYMENT_READINESS",
      observations,
      mutationEnvelope: firstDeploymentEnvelope({ cronAction: "CREATE_OR_CHANGE" }),
    }),
    [],
  );

  assert.ok(blockerCodes(validateVs005ObservationCompleteness({
    phase: "FIRST_DEPLOYMENT_READINESS",
    observations,
    mutationEnvelope: firstDeploymentEnvelope(),
  })).includes("CRON_ABSENCE_NOT_PLANNED"));
});

test("first deployment permits absent secret only when planned", () => {
  const observations = firstDeploymentObservations({ secretNames: absent() });

  assert.deepEqual(
    validateVs005ObservationCompleteness({
      phase: "FIRST_DEPLOYMENT_READINESS",
      observations,
      mutationEnvelope: firstDeploymentEnvelope({
        secretNamesToSet: ["SUPABASE_SECRET_KEY"],
      }),
    }),
    [],
  );

  assert.ok(blockerCodes(validateVs005ObservationCompleteness({
    phase: "FIRST_DEPLOYMENT_READINESS",
    observations,
    mutationEnvelope: firstDeploymentEnvelope(),
  })).includes("SECRET_ABSENCE_NOT_PLANNED"));
});

test("existing Worker requires configuration Cron secret and release observations", () => {
  const cases: Array<[keyof Vs005ProviderObservationSnapshot, string]> = [
    ["workerConfigFingerprint", "WORKER_CONFIG_OBSERVATION_REQUIRED"],
    ["cronSchedules", "CRON_ABSENCE_NOT_PLANNED"],
    ["secretNames", "SECRET_ABSENCE_NOT_PLANNED"],
    ["currentRelease", "CURRENT_RELEASE_OBSERVATION_REQUIRED"],
  ];

  for (const [field, expectedCode] of cases) {
    const blockers = validateVs005ObservationCompleteness({
      phase: "FIRST_DEPLOYMENT_READINESS",
      observations: firstDeploymentObservations({ [field]: absent() }),
      mutationEnvelope: firstDeploymentEnvelope({
        cronAction: "NO_CHANGE",
        secretNamesToSet: [],
      }),
    });
    assert.ok(blockerCodes(blockers).includes(expectedCode), field);
  }
});

test("missing required observation blocks", () => {
  const blockers = validateVs005ObservationCompleteness({
    phase: "FIRST_DEPLOYMENT_READINESS",
    observations: firstDeploymentObservations({
      accountId: unavailable("provider output contains server-secret"),
    }),
    mutationEnvelope: firstDeploymentEnvelope(),
  });

  assert.ok(blockerCodes(blockers).includes("ACCOUNT_ID_OBSERVATION_REQUIRED"));
  assert.doesNotMatch(JSON.stringify(blockers), /server-secret/);
});

test("required Cron and secret UNAVAILABLE observations block", () => {
  const cronBlockers = validateVs005ObservationCompleteness({
    phase: "FIRST_DEPLOYMENT_READINESS",
    observations: firstDeploymentObservations({
      cronSchedules: unavailable("cron output contains secret-value"),
    }),
    mutationEnvelope: firstDeploymentEnvelope(),
  });
  const secretBlockers = validateVs005ObservationCompleteness({
    phase: "FIRST_DEPLOYMENT_READINESS",
    observations: firstDeploymentObservations({
      secretNames: unavailable("secret payload unavailable"),
    }),
    mutationEnvelope: firstDeploymentEnvelope(),
  });

  assert.ok(blockerCodes(cronBlockers).includes("CRON_OBSERVATION_REQUIRED"));
  assert.ok(blockerCodes(secretBlockers).includes("SECRET_OBSERVATION_REQUIRED"));
  assert.doesNotMatch(JSON.stringify([...cronBlockers, ...secretBlockers]), /secret-value|secret payload/);
});

test("rollback requires current release and explicit prior version A", () => {
  assert.deepEqual(
    validateVs005ObservationCompleteness({
      phase: "ROLLBACK_READINESS",
      observations: rollbackObservations(),
      mutationEnvelope: firstDeploymentEnvelope(),
    }),
    [],
  );

  const missingRelease = validateVs005ObservationCompleteness({
    phase: "ROLLBACK_READINESS",
    observations: rollbackObservations({ currentRelease: absent() }),
    mutationEnvelope: firstDeploymentEnvelope(),
  });
  assert.ok(blockerCodes(missingRelease).includes("CURRENT_RELEASE_OBSERVATION_REQUIRED"));
});

test("rollback rejects absent prior version", () => {
  const blockers = validateVs005ObservationCompleteness({
    phase: "ROLLBACK_READINESS",
    observations: rollbackObservations({ priorVersion: absent() }),
    mutationEnvelope: firstDeploymentEnvelope(),
  });

  assert.ok(blockerCodes(blockers).includes("PRIOR_VERSION_OBSERVATION_REQUIRED"));
});

test("rollback rejects unavailable rollback observations", () => {
  const blockers = validateVs005ObservationCompleteness({
    phase: "ROLLBACK_READINESS",
    observations: rollbackObservations({
      priorVersion: unavailable("rollback response contains provider-secret"),
    }),
    mutationEnvelope: firstDeploymentEnvelope(),
  });

  assert.ok(blockerCodes(blockers).includes("PRIOR_VERSION_OBSERVATION_REQUIRED"));
  assert.doesNotMatch(JSON.stringify(blockers), /provider-secret/);
});

test("secret values cannot enter bounded observation structures or blockers", () => {
  const observations = firstDeploymentObservations({
    secretNames: observed(["SUPABASE_SECRET_KEY"]),
  });
  const blockers = validateVs005ObservationCompleteness({
    phase: "FIRST_DEPLOYMENT_READINESS",
    observations,
    mutationEnvelope: firstDeploymentEnvelope(),
  });

  assert.doesNotMatch(JSON.stringify(observations), /server-secret|secret-value/);
  assert.doesNotMatch(JSON.stringify(blockers), /server-secret|secret-value/);
});

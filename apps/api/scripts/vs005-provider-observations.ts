import type { CadenceReleaseIdentity } from "../src/bootstrap/cadence-release";

export type Vs005Observation<T> =
  | { state: "OBSERVED_VALUE"; value: T }
  | { state: "OBSERVED_ABSENT" }
  | { state: "UNAVAILABLE"; code: string };

export type Vs005ObservationPhase =
  | "FIRST_DEPLOYMENT_READINESS"
  | "POST_DEPLOYMENT_VERIFICATION"
  | "ROLLBACK_READINESS";

export type Vs005ProviderInspectionProfile = Vs005ObservationPhase;

export type Vs005CloudflareOperationName =
  | "CURRENT_DEPLOYMENT"
  | "WORKER_SETTINGS"
  | "CRON_SCHEDULES"
  | "DEPLOYABLE_VERSIONS"
  | "VERSION"
  | "WORKER_SUBDOMAIN"
  | "ACCOUNT_SUBDOMAIN";

export interface Vs005ProviderObservationCorrelation {
  accountId: string;
  workerName: string;
  configFingerprint: string;
  providerOrigin: "api.cloudflare.com";
  profile: Vs005ProviderInspectionProfile;
  completedOperations: readonly Vs005CloudflareOperationName[];
  observedAt: string;
}

export interface Vs005ProviderObservationSnapshot {
  accountId: Vs005Observation<string>;
  workerName: Vs005Observation<string>;
  workerExists: Vs005Observation<boolean>;
  workerConfigFingerprint: Vs005Observation<string>;
  cronSchedules: Vs005Observation<readonly string[]>;
  nonSecretBindingNames: Vs005Observation<readonly string[]>;
  secretNames: Vs005Observation<readonly string[]>;
  currentRelease: Vs005Observation<CadenceReleaseIdentity>;
  priorVersion: Vs005Observation<{
    providerVersionId: string;
    release: CadenceReleaseIdentity;
    configFingerprint: string;
  }>;
  hostname: Vs005Observation<string>;
}

export interface Vs005CurrentDeploymentIdentity {
  deploymentId: string;
  versions: readonly { providerVersionId: string; percentage: number }[];
}

export interface Vs005StructuredProviderObservationSnapshot
  extends Vs005ProviderObservationSnapshot {
  currentDeployment: Vs005Observation<Vs005CurrentDeploymentIdentity>;
  workersDevEnabled: Vs005Observation<boolean>;
  accountWorkersDevSubdomain: Vs005Observation<string>;
}

export interface Vs005CorrelatedProviderInspection {
  correlation: Vs005ProviderObservationCorrelation;
  observations: Vs005StructuredProviderObservationSnapshot;
}

export interface Vs005MutationEnvelope {
  workerAction: "CREATE_OR_UPDATE";
  cronAction: "NO_CHANGE" | "CREATE_OR_CHANGE";
  secretNamesToSet: readonly string[];
}

export interface Vs005ProviderInspection {
  observations: Vs005ProviderObservationSnapshot;
}

const REQUIRED_SECRET_NAME = "SUPABASE_SECRET_KEY";

export function validateVs005ObservationCompleteness(input: {
  phase: Vs005ObservationPhase;
  observations: Vs005ProviderObservationSnapshot;
  mutationEnvelope: Vs005MutationEnvelope;
}): readonly { code: string; message: string }[] {
  const blockers: Array<{ code: string; message: string }> = [];
  const { observations, mutationEnvelope, phase } = input;

  requireObservedValue(
    blockers,
    observations.accountId,
    "ACCOUNT_ID_OBSERVATION_REQUIRED",
    "accountId",
    phase,
  );
  requireObservedValue(
    blockers,
    observations.workerName,
    "WORKER_NAME_OBSERVATION_REQUIRED",
    "workerName",
    phase,
  );

  const workerExists = observations.workerExists;
  if (workerExists.state === "UNAVAILABLE") {
    addBlocker(
      blockers,
      "WORKER_EXISTENCE_OBSERVATION_REQUIRED",
      "workerExists",
      phase,
    );
  } else if (workerExists.state === "OBSERVED_VALUE" && workerExists.value) {
    requireObservedValue(
      blockers,
      observations.workerConfigFingerprint,
      "WORKER_CONFIG_OBSERVATION_REQUIRED",
      "workerConfigFingerprint",
      phase,
    );
    requireObservedValue(
      blockers,
      observations.nonSecretBindingNames,
      "NON_SECRET_BINDING_OBSERVATION_REQUIRED",
      "nonSecretBindingNames",
      phase,
    );

    validateCronObservation(
      blockers,
      observations.cronSchedules,
      mutationEnvelope,
      phase,
    );
    requireObservedValue(
      blockers,
      observations.currentRelease,
      "CURRENT_RELEASE_OBSERVATION_REQUIRED",
      "currentRelease",
      phase,
    );
  }

  validateSecretObservation(
    blockers,
    observations.secretNames,
    mutationEnvelope,
    phase,
  );

  if (phase === "ROLLBACK_READINESS") {
    if (workerExists.state !== "OBSERVED_VALUE" || !workerExists.value) {
      if (workerExists.state !== "UNAVAILABLE") {
        addBlocker(
          blockers,
          "WORKER_EXISTENCE_OBSERVATION_REQUIRED",
          "workerExists",
          phase,
        );
      }
    }
    requireObservedValue(
      blockers,
      observations.workerConfigFingerprint,
      "WORKER_CONFIG_OBSERVATION_REQUIRED",
      "workerConfigFingerprint",
      phase,
    );
    requireObservedValue(
      blockers,
      observations.currentRelease,
      "CURRENT_RELEASE_OBSERVATION_REQUIRED",
      "currentRelease",
      phase,
    );
    requireObservedValue(
      blockers,
      observations.priorVersion,
      "PRIOR_VERSION_OBSERVATION_REQUIRED",
      "priorVersion",
      phase,
    );
    requireObservedValue(
      blockers,
      observations.hostname,
      "HOSTNAME_OBSERVATION_REQUIRED",
      "hostname",
      phase,
    );
  }

  return blockers;
}

function requireObservedValue<T>(
  blockers: Array<{ code: string; message: string }>,
  observation: Vs005Observation<T>,
  code: string,
  field: string,
  phase: Vs005ObservationPhase,
): T | undefined {
  if (observation.state !== "OBSERVED_VALUE") {
    addBlocker(blockers, code, field, phase);
    return undefined;
  }
  return observation.value;
}

function validateCronObservation(
  blockers: Array<{ code: string; message: string }>,
  observation: Vs005Observation<readonly string[]>,
  mutationEnvelope: Vs005MutationEnvelope,
  phase: Vs005ObservationPhase,
): void {
  if (observation.state === "UNAVAILABLE") {
    addBlocker(blockers, "CRON_OBSERVATION_REQUIRED", "cronSchedules", phase);
  } else if (
    observation.state === "OBSERVED_ABSENT"
    && mutationEnvelope.cronAction !== "CREATE_OR_CHANGE"
  ) {
    addBlocker(blockers, "CRON_ABSENCE_NOT_PLANNED", "cronSchedules", phase);
  }
}

function validateSecretObservation(
  blockers: Array<{ code: string; message: string }>,
  observation: Vs005Observation<readonly string[]>,
  mutationEnvelope: Vs005MutationEnvelope,
  phase: Vs005ObservationPhase,
): void {
  if (observation.state === "UNAVAILABLE") {
    addBlocker(blockers, "SECRET_OBSERVATION_REQUIRED", "secretNames", phase);
    return;
  }

  if (observation.state === "OBSERVED_ABSENT") {
    if (!mutationEnvelope.secretNamesToSet.includes(REQUIRED_SECRET_NAME)) {
      addBlocker(blockers, "SECRET_ABSENCE_NOT_PLANNED", "secretNames", phase);
    }
    return;
  }

  if (!observation.value.includes(REQUIRED_SECRET_NAME)) {
    addBlocker(blockers, "SECRET_NAME_MISSING", "secretNames", phase);
  }
}

function addBlocker(
  blockers: Array<{ code: string; message: string }>,
  code: string,
  field: string,
  phase: Vs005ObservationPhase,
): void {
  blockers.push({
    code,
    message: `${field} observation is not complete for ${phase}`,
  });
}

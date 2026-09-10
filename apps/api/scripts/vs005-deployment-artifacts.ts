import type { CadenceReleaseIdentity } from "../src/bootstrap/cadence-release";
import type { CadenceTargetFacts } from "../src/bootstrap/cadence-target-policy";
import type {
  Vs005MutationEnvelope,
  Vs005ProviderObservationCorrelation,
  Vs005ProviderObservationSnapshot,
  Vs005StructuredProviderObservationSnapshot,
} from "./vs005-provider-observations";

export interface Vs005OperatorFailure {
  artifactType: "cadence.vs005.operator-failure";
  formatVersion: 1;
  stage: "setup" | "plan" | "apply" | "verify" | "rollback";
  code: string;
  mutationOccurred: boolean;
  existingService: "HEALTHY" | "UNHEALTHY" | "UNCHANGED" | "UNKNOWN";
  canonicalConfigPath: string;
  safeExpected?: Readonly<Record<string, string | number | boolean | null>>;
  safeObserved?: Readonly<Record<string, string | number | boolean | null>>;
  nextAction: string;
}

export interface Vs005DeploymentPlan {
  artifactType: "cadence.vs005.deployment-plan";
  formatVersion: 1 | 2;
  planId: string;
  configFingerprint: string;
  release: CadenceReleaseIdentity;
  environment: "local" | "qa" | "beta";
  provider: "cloudflare";
  providerTarget: {
    accountId: string;
    workerName: string;
    workerExists: boolean;
  };
  publicUrl: string;
  supabaseProjectRef: string | null;
  configVersion: 1;
  worker: {
    schedule: string;
    maxRounds: number;
    maxDeliveryAttempts: number;
    maxMembershipExpiryAttempts: number;
    softDeadlineSeconds: number;
  };
  secrets: {
    name: string;
    providerPresent: boolean;
    bootstrapInputAvailable: boolean;
    ready: boolean;
  }[];
  database: { migrationAction: "NONE" };
  rollback: {
    application: "SUPPORTED" | "UNAVAILABLE";
    database: "NOT_PERFORMED";
  };
  changes: readonly ["WEB_STATIC_ASSETS", "API_WORKER", "SCHEDULED_WORKER"];
  destructiveActions: readonly [];
  readiness: "PASS" | "BLOCKED";
  blockers: readonly { code: string; message: string }[];
  intendedTarget?: CadenceTargetFacts;
  targetPolicy?: { name: string };
  observedProvider?: Vs005ProviderObservationSnapshot;
  observationPhase?: "FIRST_DEPLOYMENT_READINESS";
  mutationEnvelope?: Vs005MutationEnvelope;
}

export interface Vs005DeploymentPlanV2 extends Vs005DeploymentPlan {
  formatVersion: 2;
  intendedTarget: CadenceTargetFacts;
  targetPolicy: { name: string };
  providerCorrelation: Vs005ProviderObservationCorrelation;
  observedProvider: Vs005StructuredProviderObservationSnapshot;
  observationPhase: "FIRST_DEPLOYMENT_READINESS";
  mutationEnvelope: Vs005MutationEnvelope;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const OPERATION_ORDER = [
  "CURRENT_DEPLOYMENT",
  "WORKER_SETTINGS",
  "CRON_SCHEDULES",
  "DEPLOYABLE_VERSIONS",
  "VERSION",
  "WORKER_SUBDOMAIN",
  "ACCOUNT_SUBDOMAIN",
] as const;

function isBoundedIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9._-]{1,128}$/.test(value);
}

function isObservationOf(value: unknown, validValue: (value: unknown) => boolean): boolean {
  if (!isRecord(value)) return false;
  if (value.state === "OBSERVED_ABSENT") return Object.keys(value).length === 1;
  if (value.state === "UNAVAILABLE") {
    return typeof value.code === "string" && /^[A-Z0-9_]{1,80}$/.test(value.code);
  }
  return value.state === "OBSERVED_VALUE" && validValue(value.value);
}

function isBoundedText(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9._:/-]{1,256}$/.test(value);
}

function isStringList(value: unknown, pattern: RegExp): boolean {
  return Array.isArray(value) && value.length <= 128
    && value.every((item) => typeof item === "string" && pattern.test(item));
}

function isRelease(value: unknown): boolean {
  return isRecord(value)
    && isBoundedText(value.version)
    && typeof value.commitSha === "string"
    && /^[0-9a-f]{40}$/.test(value.commitSha)
    && isBoundedText(value.buildId);
}

function isPriorVersion(value: unknown): boolean {
  return isRecord(value)
    && isBoundedIdentifier(value.providerVersionId)
    && isRelease(value.release)
    && isBoundedIdentifier(value.configFingerprint);
}

export function isVs005ProviderObservationCorrelation(
  value: unknown,
): value is Vs005ProviderObservationCorrelation {
  if (!isRecord(value)
    || !isBoundedIdentifier(value.accountId)
    || !isBoundedIdentifier(value.workerName)
    || !isBoundedIdentifier(value.configFingerprint)
    || value.providerOrigin !== "api.cloudflare.com"
    || !["FIRST_DEPLOYMENT_READINESS", "POST_DEPLOYMENT_VERIFICATION", "ROLLBACK_READINESS"].includes(value.profile as string)
    || !Array.isArray(value.completedOperations)
    || value.completedOperations.length > OPERATION_ORDER.length) return false;
  const completedOperations = value.completedOperations;
  const ordered = OPERATION_ORDER.filter((operation) => completedOperations.includes(operation));
  if (ordered.length !== completedOperations.length
    || ordered.some((operation, index) => operation !== completedOperations[index])) return false;
  if (typeof value.observedAt !== "string") return false;
  const observedAt = new Date(value.observedAt);
  return Number.isFinite(observedAt.getTime()) && observedAt.toISOString() === value.observedAt;
}

export function isVs005StructuredProviderObservationSnapshot(
  value: unknown,
): value is Vs005StructuredProviderObservationSnapshot {
  if (!isRecord(value)) return false;
  if (!isObservationOf(value.accountId, isBoundedIdentifier)
    || !isObservationOf(value.workerName, isBoundedIdentifier)
    || !isObservationOf(value.workerExists, (item) => typeof item === "boolean")
    || !isObservationOf(value.workerConfigFingerprint, isBoundedIdentifier)
    || !isObservationOf(value.cronSchedules, (item) => isStringList(item, /^[A-Za-z0-9*/,_? -]{1,128}$/))
    || !isObservationOf(value.nonSecretBindingNames, (item) => isStringList(item, /^[A-Za-z0-9._-]{1,128}$/))
    || !isObservationOf(value.secretNames, (item) => isStringList(item, /^[A-Za-z0-9._-]{1,128}$/))
    || !isObservationOf(value.currentRelease, isRelease)
    || !isObservationOf(value.priorVersion, isPriorVersion)
    || !isObservationOf(value.hostname, isBoundedText)
    || !isObservationOf(value.currentDeployment, () => true)
    || !isObservationOf(value.workersDevEnabled, (item) => typeof item === "boolean")
    || !isObservationOf(value.accountWorkersDevSubdomain, (item) => (
      typeof item === "string" && item.length <= 63
      && /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(item)
    ))) return false;
  if (isRecord(value.currentDeployment) && value.currentDeployment.state === "OBSERVED_VALUE") {
    const current = value.currentDeployment.value;
    if (!isRecord(current) || !isBoundedIdentifier(current.deploymentId)
      || !Array.isArray(current.versions) || current.versions.length > 128) return false;
    const seen = new Set<string>();
    for (const version of current.versions) {
      if (!isRecord(version) || !isBoundedIdentifier(version.providerVersionId)
        || seen.has(version.providerVersionId) || typeof version.percentage !== "number"
        || !Number.isFinite(version.percentage) || version.percentage < 0 || version.percentage > 100) return false;
      seen.add(version.providerVersionId);
    }
  }
  return true;
}

export function isVs005DeploymentPlanV2(value: unknown): value is Vs005DeploymentPlanV2 {
  return isRecord(value)
    && value.artifactType === "cadence.vs005.deployment-plan"
    && value.formatVersion === 2
    && typeof value.planId === "string"
    && typeof value.configFingerprint === "string"
    && value.provider === "cloudflare"
    && (value.readiness === "PASS" || value.readiness === "BLOCKED")
    && isRecord(value.intendedTarget)
    && isRecord(value.targetPolicy)
    && typeof value.targetPolicy.name === "string"
    && isVs005ProviderObservationCorrelation(value.providerCorrelation)
    && value.providerCorrelation.profile === "FIRST_DEPLOYMENT_READINESS"
    && isVs005StructuredProviderObservationSnapshot(value.observedProvider)
    && value.observationPhase === "FIRST_DEPLOYMENT_READINESS"
    && isRecord(value.mutationEnvelope)
    && isRecord(value.database)
    && Array.isArray(value.destructiveActions);
}

export function makeVs005OperatorFailure(
  input: Omit<Vs005OperatorFailure, "artifactType" | "formatVersion">,
): Vs005OperatorFailure {
  return Object.freeze({
    artifactType: "cadence.vs005.operator-failure",
    formatVersion: 1,
    ...input,
  });
}

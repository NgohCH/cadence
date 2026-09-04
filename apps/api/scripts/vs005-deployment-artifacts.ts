import type { CadenceReleaseIdentity } from "../src/bootstrap/cadence-release";

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
  formatVersion: 1;
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

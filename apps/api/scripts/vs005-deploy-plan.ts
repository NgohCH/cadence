import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import {
  fingerprintCadenceRuntimeConfig,
  loadCadenceRuntimeConfig,
  validateCadenceRuntimeConfig,
  type CadenceRuntimeConfig,
} from "../src/bootstrap/cadence-config";
import {
  assertCadenceTargetPolicy,
  VS005_BETA_TARGET_POLICY,
  getCadenceTargetFacts,
  type CadenceTargetPolicy,
} from "../src/bootstrap/cadence-target-policy";
import {
  loadCadenceReleaseIdentity,
  type CadenceReleaseIdentity,
} from "../src/bootstrap/cadence-release";
import {
  makeVs005OperatorFailure,
  type Vs005DeploymentPlanV2,
} from "./vs005-deployment-artifacts";
import {
  type Vs005MutationEnvelope,
  type Vs005Observation,
  type Vs005ProviderObservationSnapshot,
  validateVs005ObservationCompleteness,
} from "./vs005-provider-observations";
import type { Vs005DeploymentProviderInspection } from "./vs005-deploy-apply";
import {
  createCloudflareDeploymentProvider,
  createDefaultCloudflareProviderIo,
} from "./vs005-cloudflare-deployment-provider";

export interface Vs005PlanInspection {
  observations: Vs005ProviderObservationSnapshot;
  hostnameReady: boolean;
  generatedConfigValid: boolean;
  webBuildReady: boolean;
}

export interface Vs005DeployPlanDependencies {
  targetPolicy: CadenceTargetPolicy;
  loadConfig(path: string): unknown;
  loadRelease(): CadenceReleaseIdentity;
  inspect(config: CadenceRuntimeConfig): Promise<Vs005PlanInspection>;
  generatePlanId(): string;
  writePlan(path: string, plan: Vs005DeploymentPlanV2): Promise<void>;
}

export type { Vs005DeploymentPlan, Vs005DeploymentPlanV2 } from "./vs005-deployment-artifacts";

const CHANGES = [
  "WEB_STATIC_ASSETS",
  "API_WORKER",
  "SCHEDULED_WORKER",
] as const;

function blocker(code: string, message: string): { code: string; message: string } {
  return { code, message };
}

function observationValue<T>(observation: Vs005Observation<T>): T | undefined {
  return observation.state === "OBSERVED_VALUE" ? observation.value : undefined;
}

function equalJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeObservationCode(value: unknown): string {
  return typeof value === "string" && /^[A-Z0-9_]{1,80}$/.test(value)
    ? value
    : "OBSERVATION_UNAVAILABLE";
}

function copyObservation<T>(
  input: unknown,
  copyValue: (value: unknown) => T | undefined,
  unavailableCode: string,
): Vs005Observation<T> {
  if (!isRecord(input)) return { state: "UNAVAILABLE", code: unavailableCode };
  if (input.state === "OBSERVED_ABSENT") return { state: "OBSERVED_ABSENT" };
  if (input.state === "UNAVAILABLE") {
    return { state: "UNAVAILABLE", code: safeObservationCode(input.code) };
  }
  if (input.state !== "OBSERVED_VALUE") {
    return { state: "UNAVAILABLE", code: unavailableCode };
  }
  const copied = copyValue(input.value);
  return copied === undefined
    ? { state: "UNAVAILABLE", code: unavailableCode }
    : { state: "OBSERVED_VALUE", value: copied };
}

function copySafeString(value: unknown): string | undefined {
  return typeof value === "string" && /^[A-Za-z0-9._:/-]{1,256}$/.test(value)
    ? value
    : undefined;
}

function copySafeIdentifier(value: unknown): string | undefined {
  return typeof value === "string" && /^[A-Za-z0-9._-]{1,128}$/.test(value)
    ? value
    : undefined;
}

function copySafeStringList(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value) || value.length > 128) return undefined;
  const copied = value.map((item) => copySafeIdentifier(item));
  return copied.every((item): item is string => item !== undefined) ? copied : undefined;
}

function copySafeCronList(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value) || value.length > 128) return undefined;
  const copied = value.map((item) => (
    typeof item === "string" && /^[A-Za-z0-9*/,_? -]{1,128}$/.test(item) ? item : undefined
  ));
  return copied.every((item): item is string => item !== undefined) ? copied : undefined;
}

function copySafeRelease(value: unknown): CadenceReleaseIdentity | undefined {
  if (!isRecord(value)) return undefined;
  const version = copySafeString(value.version);
  const commitSha = typeof value.commitSha === "string"
    && /^[0-9a-f]{40}$/.test(value.commitSha)
    ? value.commitSha
    : undefined;
  const buildId = copySafeString(value.buildId);
  return version && commitSha && buildId ? { version, commitSha, buildId } : undefined;
}

interface SafePriorVersion {
  providerVersionId: string;
  release: CadenceReleaseIdentity;
  configFingerprint: string;
}

function copySafePriorVersion(value: unknown): SafePriorVersion | undefined {
  if (!isRecord(value)) return undefined;
  const providerVersionId = copySafeIdentifier(value.providerVersionId);
  const release = copySafeRelease(value.release);
  const configFingerprint = copySafeIdentifier(value.configFingerprint);
  return providerVersionId && release && configFingerprint
    ? { providerVersionId, release, configFingerprint }
    : undefined;
}

function sanitizeProviderObservations(
  input: Vs005ProviderObservationSnapshot,
): Vs005ProviderObservationSnapshot {
  return {
    accountId: copyObservation(input.accountId, copySafeIdentifier, "ACCOUNT_ID_UNAVAILABLE"),
    workerName: copyObservation(input.workerName, copySafeIdentifier, "WORKER_NAME_UNAVAILABLE"),
    workerExists: copyObservation(
      input.workerExists,
      (value) => typeof value === "boolean" ? value : undefined,
      "WORKER_EXISTENCE_UNAVAILABLE",
    ),
    workerConfigFingerprint: copyObservation(
      input.workerConfigFingerprint,
      copySafeIdentifier,
      "WORKER_CONFIG_UNAVAILABLE",
    ),
    cronSchedules: copyObservation(input.cronSchedules, copySafeCronList, "CRON_UNAVAILABLE"),
    nonSecretBindingNames: copyObservation(
      input.nonSecretBindingNames,
      copySafeStringList,
      "BINDINGS_UNAVAILABLE",
    ),
    secretNames: copyObservation(input.secretNames, copySafeStringList, "SECRET_NAMES_UNAVAILABLE"),
    currentRelease: copyObservation(input.currentRelease, copySafeRelease, "RELEASE_UNAVAILABLE"),
    priorVersion: copyObservation(input.priorVersion, copySafePriorVersion, "PRIOR_VERSION_UNAVAILABLE"),
    hostname: copyObservation(input.hostname, copySafeString, "HOSTNAME_UNAVAILABLE"),
  };
}

function buildMutationEnvelope(
  config: CadenceRuntimeConfig,
  observations: Vs005ProviderObservationSnapshot,
): Vs005MutationEnvelope {
  return {
    workerAction: "CREATE_OR_UPDATE",
    cronAction: observations.cronSchedules.state === "OBSERVED_ABSENT"
      ? "CREATE_OR_CHANGE"
      : "NO_CHANGE",
    secretNamesToSet: observations.secretNames.state === "OBSERVED_ABSENT"
      ? [config.supabase.secretKeySecretRef]
      : [],
  };
}

function makeBlockers(
  config: CadenceRuntimeConfig,
  release: CadenceReleaseIdentity,
  configFingerprint: string,
  inspection: Vs005PlanInspection,
  mutationEnvelope: Vs005MutationEnvelope,
): { code: string; message: string }[] {
  const blockers = [
    ...validateVs005ObservationCompleteness({
      phase: "FIRST_DEPLOYMENT_READINESS",
      observations: inspection.observations,
      mutationEnvelope,
    }),
  ];
  const intendedTarget = getCadenceTargetFacts(config);
  const observedAccount = observationValue(inspection.observations.accountId);
  const observedWorker = observationValue(inspection.observations.workerName);
  const workerExists = observationValue(inspection.observations.workerExists);
  const observedConfigFingerprint = observationValue(inspection.observations.workerConfigFingerprint);
  const observedRelease = observationValue(inspection.observations.currentRelease);

  if (observedAccount !== undefined && observedAccount !== intendedTarget.cloudflare.accountId) {
    blockers.push(blocker(
      "PROVIDER_ACCOUNT_MISMATCH",
      "Observed Cloudflare account does not match the intended target.",
    ));
  }
  if (observedWorker !== undefined && observedWorker !== intendedTarget.cloudflare.workerName) {
    blockers.push(blocker(
      "PROVIDER_WORKER_MISMATCH",
      "Observed Cloudflare Worker does not match the intended target.",
    ));
  }
  if (workerExists === true
    && observedConfigFingerprint !== undefined
    && observedConfigFingerprint !== configFingerprint) {
    blockers.push(blocker(
      "PROVIDER_CONFIG_FINGERPRINT_MISMATCH",
      "Observed Worker configuration does not match the intended configuration.",
    ));
  }
  if (workerExists === true && observedRelease !== undefined) {
    if (!equalJson(observedRelease, release)) {
      blockers.push(blocker(
        "PROVIDER_RELEASE_MISMATCH",
        "Observed Worker release does not match the intended release.",
      ));
    }
  }

  if (!inspection.hostnameReady) {
    blockers.push(blocker(
      "HOSTNAME_NOT_READY",
      "The reviewed application hostname is not ready.",
    ));
  }
  if (!inspection.generatedConfigValid) {
    blockers.push(blocker(
      "GENERATED_CONFIG_INVALID",
      "The generated provider configuration is invalid.",
    ));
  }
  if (!inspection.webBuildReady) {
    blockers.push(blocker(
      "WEB_BUILD_NOT_READY",
      "The browser build is not ready.",
    ));
  }

  if (inspection.observations.secretNames.state === "OBSERVED_VALUE"
    && inspection.observations.secretNames.value.includes(config.supabase.secretKeySecretRef)
    && mutationEnvelope.secretNamesToSet.length !== 0) {
    blockers.push(blocker(
      "SECRET_MUTATION_ENVELOPE_MISMATCH",
      "Secret mutation envelope conflicts with observed secret state.",
    ));
  }
  return blockers;
}

function legacyUnavailableInspection(): Vs005ProviderObservationSnapshot {
  const unavailable = <T>(code: string): Vs005Observation<T> => ({ state: "UNAVAILABLE", code });
  return {
    accountId: unavailable("CLOUDFLARE_INSPECTION_UNAVAILABLE"),
    workerName: unavailable("CLOUDFLARE_INSPECTION_UNAVAILABLE"),
    workerExists: unavailable("CLOUDFLARE_INSPECTION_UNAVAILABLE"),
    workerConfigFingerprint: unavailable("CLOUDFLARE_INSPECTION_UNAVAILABLE"),
    cronSchedules: unavailable("CLOUDFLARE_INSPECTION_UNAVAILABLE"),
    nonSecretBindingNames: unavailable("CLOUDFLARE_INSPECTION_UNAVAILABLE"),
    secretNames: unavailable("CLOUDFLARE_INSPECTION_UNAVAILABLE"),
    currentRelease: unavailable("CLOUDFLARE_INSPECTION_UNAVAILABLE"),
    priorVersion: unavailable("CLOUDFLARE_INSPECTION_UNAVAILABLE"),
    hostname: unavailable("CLOUDFLARE_INSPECTION_UNAVAILABLE"),
  };
}

function observationsFromProviderInspection(
  inspection: Vs005DeploymentProviderInspection,
): Vs005ProviderObservationSnapshot {
  if (!inspection.observations) throw new Error("CLOUDFLARE_INSPECTION_UNAVAILABLE");
  return inspection.observations;
}

export async function runVs005DeployPlan(
  input: { configPath: string; outputPath: string },
  dependencies: Vs005DeployPlanDependencies,
): Promise<Vs005DeploymentPlanV2> {
  const rawConfig = dependencies.loadConfig(input.configPath);
  const config = validateCadenceRuntimeConfig(rawConfig);
  if (config.runtime.provider !== "cloudflare") {
    throw new Error("Deployment planning requires the cloudflare runtime provider");
  }

  assertCadenceTargetPolicy(config, dependencies.targetPolicy);
  const release = loadCadenceReleaseIdentity(dependencies.loadRelease());
  const configFingerprint = fingerprintCadenceRuntimeConfig(config);
  const rawInspection = await dependencies.inspect(config);
  const inspection: Vs005PlanInspection = {
    ...rawInspection,
    observations: sanitizeProviderObservations(rawInspection.observations),
  };
  const mutationEnvelope = buildMutationEnvelope(config, inspection.observations);
  const blockers = makeBlockers(config, release, configFingerprint, inspection, mutationEnvelope);
  const target = getCadenceTargetFacts(config);
  const observedWorkerExists = inspection.observations.workerExists.state === "OBSERVED_VALUE"
    ? inspection.observations.workerExists.value
    : false;
  const secretObserved = inspection.observations.secretNames.state === "OBSERVED_VALUE"
    && inspection.observations.secretNames.value.includes(config.supabase.secretKeySecretRef);
  const priorVersionAvailable = inspection.observations.priorVersion.state === "OBSERVED_VALUE";

  const plan: Vs005DeploymentPlanV2 = {
    artifactType: "cadence.vs005.deployment-plan",
    formatVersion: 2,
    planId: dependencies.generatePlanId(),
    intendedTarget: target,
    targetPolicy: { name: dependencies.targetPolicy.name },
    observedProvider: inspection.observations,
    observationPhase: "FIRST_DEPLOYMENT_READINESS",
    mutationEnvelope,
    configFingerprint,
    release,
    database: { migrationAction: "NONE" },
    destructiveActions: [],
    readiness: blockers.length === 0 ? "PASS" : "BLOCKED",
    blockers,
    environment: config.application.environment,
    provider: "cloudflare",
    providerTarget: {
      accountId: target.cloudflare.accountId,
      workerName: target.cloudflare.workerName,
      workerExists: observedWorkerExists,
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
      providerPresent: secretObserved,
      bootstrapInputAvailable: false,
      ready: secretObserved || mutationEnvelope.secretNamesToSet.includes(config.supabase.secretKeySecretRef),
    }],
    rollback: {
      application: priorVersionAvailable ? "SUPPORTED" : "UNAVAILABLE",
      database: "NOT_PERFORMED",
    },
    changes: CHANGES,
  };

  await dependencies.writePlan(input.outputPath, plan);
  return plan;
}

function parseArguments(args: readonly string[]): { configPath: string; outputPath: string } {
  let configPath: string | undefined;
  let outputPath: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const value = args[index + 1];
    if (argument === "--config" && value) {
      configPath = value;
      index += 1;
    } else if (argument === "--out" && value) {
      outputPath = value;
      index += 1;
    } else {
      throw new Error("Usage: vs005-deploy-plan.ts --config <path> --out <path>");
    }
  }

  if (!configPath || !outputPath) {
    throw new Error("Usage: vs005-deploy-plan.ts --config <path> --out <path>");
  }
  return { configPath, outputPath };
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function loadReleaseFromEnvironment(): CadenceReleaseIdentity {
  return loadCadenceReleaseIdentity({
    version: process.env.CADENCE_RELEASE_VERSION,
    commitSha: process.env.CADENCE_COMMIT_SHA,
    buildId: process.env.CADENCE_BUILD_ID,
  });
}

async function runCli(args: readonly string[]): Promise<void> {
  let configPath = "<unspecified>";
  let outputPath = ".cadence/vs005/deployment-plan.json";

  try {
    ({ configPath, outputPath } = parseArguments(args));
    const provider = createCloudflareDeploymentProvider(createDefaultCloudflareProviderIo());
    const dependencies: Vs005DeployPlanDependencies = {
      targetPolicy: VS005_BETA_TARGET_POLICY,
      loadConfig: (path) => loadCadenceRuntimeConfig(path),
      loadRelease: loadReleaseFromEnvironment,
      inspect: async (config) => {
        let providerInspection: Vs005DeploymentProviderInspection;
        try {
          providerInspection = await provider.inspect(config);
        } catch {
          return {
            observations: legacyUnavailableInspection(),
            hostnameReady: false,
            generatedConfigValid: false,
            webBuildReady: false,
          };
        }
        if (!providerInspection.observations) {
          return {
            observations: legacyUnavailableInspection(),
            hostnameReady: false,
            generatedConfigValid: false,
            webBuildReady: false,
          };
        }
        return {
          observations: observationsFromProviderInspection(providerInspection),
          hostnameReady: providerInspection.observations.hostname.state === "OBSERVED_VALUE"
            && providerInspection.observations.hostname.value === new URL(config.application.publicUrl).hostname,
          generatedConfigValid: false,
          webBuildReady: false,
        };
      },
      generatePlanId: () => `plan-${new Date().toISOString()}`,
      writePlan: async (path, plan) => writeJson(path, plan),
    };

    const plan = await runVs005DeployPlan({ configPath, outputPath }, dependencies);
    console.log(`DEPLOYMENT READINESS: ${plan.readiness}`);
    console.log("NO DEPLOYMENT PERFORMED");
  } catch {
    const failure = makeVs005OperatorFailure({
      stage: "plan",
      code: "SETUP_OR_PLAN_BLOCKED",
      mutationOccurred: false,
      existingService: "UNCHANGED",
      canonicalConfigPath: configPath,
      nextAction: "Review the canonical config and read-only setup prerequisites, then rerun the deployment plan.",
    });
    writeJson(outputPath, failure);
    console.log("DEPLOYMENT READINESS: BLOCKED");
    console.log("NO DEPLOYMENT PERFORMED");
  }
}

if (require.main === module) {
  void runCli(process.argv.slice(2));
}

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";

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
  type Vs005CorrelatedProviderInspection,
  type Vs005ProviderObservationCorrelation,
  type Vs005StructuredProviderObservationSnapshot,
} from "./vs005-provider-observations";
import {
  createCloudflareDeploymentProvider,
  createDefaultCloudflareProviderIo,
} from "./vs005-cloudflare-deployment-provider";
import type { CloudflareStructuredInspectionRequest } from "./vs005-cloudflare-structured-inspection";
import { buildCloudflareDeployment, type GeneratedCloudflareDeployment } from "./vs005-generate-deployment";
import {
  inspectVs005LocalDeploymentReadiness,
  type Vs005LocalDeploymentReadiness,
} from "./vs005-local-deployment-readiness";
import {
  resolveCadenceOperatorPath,
  resolveCadenceRepositoryRoot,
} from "./cadence-operator-path";

export interface Vs005PlanInspection {
  correlation: Vs005ProviderObservationCorrelation;
  observations: Vs005StructuredProviderObservationSnapshot;
  hostnameReady: boolean;
  generatedConfigValid: boolean;
  webBuildReady: boolean;
}

export interface Vs005DeployPlanDependencies {
  targetPolicy: CadenceTargetPolicy;
  loadConfig(path: string): unknown;
  loadRelease(): CadenceReleaseIdentity;
  inspectStructured(input: CloudflareStructuredInspectionRequest): Promise<Vs005CorrelatedProviderInspection>;
  inspectLocalReadiness(
    config: CadenceRuntimeConfig,
    release: CadenceReleaseIdentity,
  ): Promise<Vs005LocalDeploymentReadiness>;
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
  input: Vs005StructuredProviderObservationSnapshot,
): Vs005StructuredProviderObservationSnapshot {
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
    currentDeployment: copyObservation(
      input.currentDeployment,
      (value) => {
        if (!isRecord(value)) return undefined;
        const deploymentId = copySafeIdentifier(value.deploymentId);
        if (!deploymentId || !Array.isArray(value.versions) || value.versions.length > 128) return undefined;
        const seen = new Set<string>();
        const versions: Array<{ providerVersionId: string; percentage: number }> = [];
        for (const version of value.versions) {
          if (!isRecord(version)) return undefined;
          const providerVersionId = copySafeIdentifier(version.providerVersionId);
          if (!providerVersionId || seen.has(providerVersionId) || typeof version.percentage !== "number"
            || !Number.isFinite(version.percentage) || version.percentage < 0 || version.percentage > 100) return undefined;
          seen.add(providerVersionId);
          versions.push({ providerVersionId, percentage: version.percentage });
        }
        return { deploymentId, versions };
      },
      "CURRENT_DEPLOYMENT_UNAVAILABLE",
    ),
    workersDevEnabled: copyObservation(
      input.workersDevEnabled,
      (value) => typeof value === "boolean" ? value : undefined,
      "WORKERS_DEV_STATE_UNAVAILABLE",
    ),
    accountWorkersDevSubdomain: copyObservation(
      input.accountWorkersDevSubdomain,
      copySafeIdentifier,
      "ACCOUNT_SUBDOMAIN_UNAVAILABLE",
    ),
  };
}

const PRESENT_OPERATIONS = [
  "CURRENT_DEPLOYMENT",
  "WORKER_SETTINGS",
  "CRON_SCHEDULES",
  "WORKER_SUBDOMAIN",
  "ACCOUNT_SUBDOMAIN",
] as const;
const ABSENT_OPERATIONS = ["CURRENT_DEPLOYMENT", "ACCOUNT_SUBDOMAIN"] as const;

function expectedOperations(observations: Vs005StructuredProviderObservationSnapshot) {
  return observations.workerExists.state === "OBSERVED_ABSENT" ? ABSENT_OPERATIONS : PRESENT_OPERATIONS;
}

function sanitizeCorrelation(value: Vs005ProviderObservationCorrelation): Vs005ProviderObservationCorrelation {
  return {
    accountId: value.accountId,
    workerName: value.workerName,
    configFingerprint: value.configFingerprint,
    providerOrigin: value.providerOrigin,
    profile: value.profile,
    completedOperations: [...value.completedOperations],
    observedAt: value.observedAt,
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
  const expectedTarget = getCadenceTargetFacts(config);

  if (inspection.correlation.accountId !== expectedTarget.cloudflare.accountId) {
    blockers.push(blocker("PROVIDER_CORRELATION_ACCOUNT_MISMATCH", "Structured correlation account does not match the intended target."));
  }
  if (inspection.correlation.workerName !== expectedTarget.cloudflare.workerName) {
    blockers.push(blocker("PROVIDER_CORRELATION_WORKER_MISMATCH", "Structured correlation Worker does not match the intended target."));
  }
  if (inspection.correlation.configFingerprint !== configFingerprint) {
    blockers.push(blocker("PROVIDER_CORRELATION_FINGERPRINT_MISMATCH", "Structured correlation fingerprint does not match the intended configuration."));
  }
  if (inspection.correlation.providerOrigin !== "api.cloudflare.com") {
    blockers.push(blocker("PROVIDER_CORRELATION_ORIGIN_MISMATCH", "Structured correlation provider origin is unavailable."));
  }
  if (inspection.correlation.profile !== "FIRST_DEPLOYMENT_READINESS") {
    blockers.push(blocker("PROVIDER_CORRELATION_PROFILE_MISMATCH", "Structured correlation profile does not match planning."));
  }
  if (!equalJson(inspection.correlation.completedOperations, expectedOperations(inspection.observations))) {
    blockers.push(blocker("PROVIDER_COMPLETED_OPERATIONS_MISMATCH", "Structured inspection operation set is incomplete or unexpected."));
  }

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

export async function inspectVs005PlanInputs(input: {
  config: CadenceRuntimeConfig;
  release: CadenceReleaseIdentity;
  generatedConfig: GeneratedCloudflareDeployment["wrangler"];
  inspectStructured(request: CloudflareStructuredInspectionRequest): Promise<Vs005CorrelatedProviderInspection>;
  inspectLocalReadiness(): Promise<Vs005LocalDeploymentReadiness>;
}): Promise<Vs005PlanInspection> {
  const localReadiness = await input.inspectLocalReadiness();
  const providerInspection = await input.inspectStructured({
    config: input.config,
    release: input.release,
    generatedConfig: input.generatedConfig,
    profile: "FIRST_DEPLOYMENT_READINESS",
  });
  const providerObservations = sanitizeProviderObservations(providerInspection.observations);
  const workerAbsent = providerObservations.workerExists.state === "OBSERVED_ABSENT";
  const accountSubdomain = observationValue(providerObservations.accountWorkersDevSubdomain);
  const expectedHostname = accountSubdomain
    ? `${input.config.cloudflare!.workerName}.${accountSubdomain}.workers.dev`
    : undefined;
  return {
    correlation: sanitizeCorrelation(providerInspection.correlation),
    observations: providerObservations,
    hostnameReady: workerAbsent
      ? input.generatedConfig.workers_dev === true
        && expectedHostname === new URL(input.config.application.publicUrl).hostname
      : providerObservations.hostname.state === "OBSERVED_VALUE"
        && providerObservations.hostname.value === new URL(input.config.application.publicUrl).hostname,
    ...localReadiness,
  };
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
  const generatedConfig = buildCloudflareDeployment({ config, release }).wrangler;
  const rawProviderInspection = await dependencies.inspectStructured({
    config,
    release,
    generatedConfig,
    profile: "FIRST_DEPLOYMENT_READINESS",
  });
  const localReadiness = await dependencies.inspectLocalReadiness(config, release);
  const inspection: Vs005PlanInspection = {
    correlation: sanitizeCorrelation(rawProviderInspection.correlation),
    observations: sanitizeProviderObservations(rawProviderInspection.observations),
    hostnameReady: false,
    ...localReadiness,
  };
  const workerAbsent = inspection.observations.workerExists.state === "OBSERVED_ABSENT";
  const accountSubdomain = observationValue(inspection.observations.accountWorkersDevSubdomain);
  const providerHostname = observationValue(inspection.observations.hostname);
  inspection.hostnameReady = workerAbsent
    ? generatedConfig.workers_dev === true
      && accountSubdomain !== undefined
      && `${config.cloudflare!.workerName}.${accountSubdomain}.workers.dev` === new URL(config.application.publicUrl).hostname
    : providerHostname === new URL(config.application.publicUrl).hostname;
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
    providerCorrelation: inspection.correlation,
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

function runLocalCommand(argv: readonly string[]): Promise<void> {
  return new Promise((resolveCommand, reject) => {
    const [command, ...args] = argv;
    if (!command) {
      reject(new Error("LOCAL_COMMAND_INVALID"));
      return;
    }
    const child = spawn(command, args, { shell: false, windowsHide: true });
    child.on("close", (exitCode) => {
      if (exitCode === 0) resolveCommand();
      else reject(new Error("LOCAL_COMMAND_FAILED"));
    });
    child.on("error", () => reject(new Error("LOCAL_COMMAND_FAILED")));
  });
}

export async function runCli(args: readonly string[]): Promise<void> {
  let configPath = "<unspecified>";
  let outputPath = ".cadence/vs005/deployment-plan.json";
  let rootEstablished = false;

  try {
    const parsed = parseArguments(args);
    const repositoryRoot = resolveCadenceRepositoryRoot();
    ({ configPath, outputPath } = {
      configPath: resolveCadenceOperatorPath({ repositoryRoot, inputPath: parsed.configPath }),
      outputPath: resolveCadenceOperatorPath({ repositoryRoot, inputPath: parsed.outputPath }),
    });
    const publicConfigPath = resolve(repositoryRoot, "apps/web/.generated/cadence-public-config.json");
    const webDistPath = resolve(repositoryRoot, "apps/web/dist");
    rootEstablished = true;
    const release = loadReleaseFromEnvironment();
    const provider = createCloudflareDeploymentProvider(createDefaultCloudflareProviderIo());
    const dependencies: Vs005DeployPlanDependencies = {
      targetPolicy: VS005_BETA_TARGET_POLICY,
      loadConfig: (path) => loadCadenceRuntimeConfig(path),
      loadRelease: () => release,
      inspectStructured: (request) => provider.inspectStructured(request),
      inspectLocalReadiness: (config, currentRelease) => inspectVs005LocalDeploymentReadiness({
          config,
          configPath,
          release: currentRelease,
          publicConfigPath,
          webDistPath,
          io: {
            platform: process.platform,
            runCommand: runLocalCommand,
            readText: (path) => readFileSync(path, "utf8"),
            fileExists: existsSync,
          },
        }),
      generatePlanId: () => `plan-${new Date().toISOString()}`,
      writePlan: async (path, plan) => writeJson(path, plan),
    };

    const plan = await runVs005DeployPlan({ configPath, outputPath }, dependencies);
    console.log(`DEPLOYMENT READINESS: ${plan.readiness}`);
    console.log("NO DEPLOYMENT PERFORMED");
  } catch {
    if (!rootEstablished) {
      console.log("DEPLOYMENT READINESS: BLOCKED");
      console.log("NO DEPLOYMENT PERFORMED");
      return;
    }
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

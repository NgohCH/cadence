import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";

import {
  fingerprintCadenceRuntimeConfig,
  loadCadenceRuntimeConfig,
  resolveCadenceSecrets,
  validateCadenceRuntimeConfig,
  type CadenceResolvedSecrets,
  type CadenceRuntimeConfig,
} from "../src/bootstrap/cadence-config";
import {
  assertCadenceTargetPolicy,
  getCadenceTargetFacts,
  VS005_BETA_TARGET_POLICY,
  type CadenceTargetPolicy,
  type CadenceTargetFacts,
} from "../src/bootstrap/cadence-target-policy";
import {
  loadCadenceReleaseIdentity,
  type CadenceReleaseIdentity,
} from "../src/bootstrap/cadence-release";
import {
  isVs005DeploymentPlanV2,
  makeVs005OperatorFailure,
  type Vs005DeploymentPlanV2,
} from "./vs005-deployment-artifacts";
import {
  type Vs005MutationEnvelope,
  type Vs005Observation,
  type Vs005ProviderObservationSnapshot,
  validateVs005ObservationCompleteness,
} from "./vs005-provider-observations";
import {
  createCloudflareDeploymentProvider,
  createDefaultCloudflareProviderIo,
} from "./vs005-cloudflare-deployment-provider";

export interface Vs005DeploymentProviderInspection {
  accountId: string;
  workerName: string;
  workerExists: boolean;
  configuredSecrets: readonly string[];
  configFingerprint: string | null;
  observations: Vs005ProviderObservationSnapshot;
}

export interface Vs005DeploymentProvider {
  inspect(config: CadenceRuntimeConfig): Promise<Vs005DeploymentProviderInspection>;
  deploy(input: {
    config: CadenceRuntimeConfig;
    generatedWranglerPath: string;
    bootstrapSecrets?: CadenceResolvedSecrets;
  }): Promise<{ deploymentId: string; providerVersionId: string }>;
}

export interface Vs005DeploymentResult {
  artifactType: "cadence.vs005.deployment-result";
  formatVersion: 1;
  planId: string;
  deploymentId: string;
  providerVersionId: string;
  deployedAt: string;
  environment: "local" | "qa" | "beta";
  provider: "cloudflare";
  providerTarget: {
    accountId: string;
    workerName: string;
    workerExists: boolean;
  };
  publicUrl: string;
  configVersion: 1;
  release: CadenceReleaseIdentity;
  configFingerprint: string;
  databaseAction: "NONE";
  destructiveActions: readonly [];
  intendedTarget?: CadenceTargetFacts;
  observedProvider?: Vs005ProviderObservationSnapshot;
}

export class Vs005ApplyError extends Error {
  readonly mutationAttempted: boolean;
  readonly safeCode: string;

  constructor(code: string, mutationAttempted = false) {
    super(code);
    this.name = "Vs005ApplyError";
    this.safeCode = code;
    this.mutationAttempted = mutationAttempted;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertPlan(value: unknown): Vs005DeploymentPlanV2 {
  if (!isVs005DeploymentPlanV2(value)) {
    throw new Vs005ApplyError("INVALID_DEPLOYMENT_PLAN");
  }
  return value;
}

function equalJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function requireMatch(condition: boolean, code: string): asserts condition {
  if (!condition) throw new Vs005ApplyError(code);
}

function copyObservation<T>(
  input: unknown,
  copyValue: (value: unknown) => T | undefined,
  unavailableCode: string,
): Vs005Observation<T> {
  if (!isRecord(input)) return { state: "UNAVAILABLE", code: unavailableCode };
  if (input.state === "OBSERVED_ABSENT") return { state: "OBSERVED_ABSENT" };
  if (input.state === "UNAVAILABLE") {
    return {
      state: "UNAVAILABLE",
      code: typeof input.code === "string" && /^[A-Z0-9_]{1,80}$/.test(input.code)
        ? input.code
        : unavailableCode,
    };
  }
  if (input.state !== "OBSERVED_VALUE") {
    return { state: "UNAVAILABLE", code: unavailableCode };
  }
  const copied = copyValue(input.value);
  return copied === undefined
    ? { state: "UNAVAILABLE", code: unavailableCode }
    : { state: "OBSERVED_VALUE", value: copied };
}

function safeIdentifier(value: unknown): string | undefined {
  return typeof value === "string" && /^[A-Za-z0-9._-]{1,128}$/.test(value)
    ? value
    : undefined;
}

function safeText(value: unknown): string | undefined {
  return typeof value === "string" && /^[A-Za-z0-9._:/-]{1,256}$/.test(value)
    ? value
    : undefined;
}

function safeStringList(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value) || value.length > 128) return undefined;
  const result = value.map((item) => safeIdentifier(item));
  return result.every((item): item is string => item !== undefined) ? result : undefined;
}

function safeCronList(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value) || value.length > 128) return undefined;
  const result = value.map((item) => (
    typeof item === "string" && /^[A-Za-z0-9*/,_? -]{1,128}$/.test(item) ? item : undefined
  ));
  return result.every((item): item is string => item !== undefined) ? result : undefined;
}

function safeRelease(value: unknown): CadenceReleaseIdentity | undefined {
  if (!isRecord(value)) return undefined;
  const version = safeText(value.version);
  const commitSha = typeof value.commitSha === "string"
    && /^[0-9a-f]{40}$/.test(value.commitSha)
    ? value.commitSha
    : undefined;
  const buildId = safeText(value.buildId);
  return version && commitSha && buildId ? { version, commitSha, buildId } : undefined;
}

function safePriorVersion(value: unknown): {
  providerVersionId: string;
  release: CadenceReleaseIdentity;
  configFingerprint: string;
} | undefined {
  if (!isRecord(value)) return undefined;
  const providerVersionId = safeIdentifier(value.providerVersionId);
  const release = safeRelease(value.release);
  const configFingerprint = safeIdentifier(value.configFingerprint);
  return providerVersionId && release && configFingerprint
    ? { providerVersionId, release, configFingerprint }
    : undefined;
}

function normalizeProviderInspection(value: unknown): Vs005ProviderObservationSnapshot {
  const input = isRecord(value) && isRecord(value.observations) ? value.observations : {};
  return {
    accountId: copyObservation(input.accountId, safeIdentifier, "ACCOUNT_ID_UNAVAILABLE"),
    workerName: copyObservation(input.workerName, safeIdentifier, "WORKER_NAME_UNAVAILABLE"),
    workerExists: copyObservation(
      input.workerExists,
      (item) => typeof item === "boolean" ? item : undefined,
      "WORKER_EXISTENCE_UNAVAILABLE",
    ),
    workerConfigFingerprint: copyObservation(
      input.workerConfigFingerprint,
      safeIdentifier,
      "WORKER_CONFIG_UNAVAILABLE",
    ),
    cronSchedules: copyObservation(input.cronSchedules, safeCronList, "CRON_UNAVAILABLE"),
    nonSecretBindingNames: copyObservation(
      input.nonSecretBindingNames,
      safeStringList,
      "BINDINGS_UNAVAILABLE",
    ),
    secretNames: copyObservation(input.secretNames, safeStringList, "SECRET_NAMES_UNAVAILABLE"),
    currentRelease: copyObservation(input.currentRelease, safeRelease, "RELEASE_UNAVAILABLE"),
    priorVersion: copyObservation(input.priorVersion, safePriorVersion, "PRIOR_VERSION_UNAVAILABLE"),
    hostname: copyObservation(input.hostname, safeText, "HOSTNAME_UNAVAILABLE"),
  };
}

function expectedMutationEnvelope(
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

function assertObservationCompleteness(
  observations: Vs005ProviderObservationSnapshot,
  mutationEnvelope: Vs005MutationEnvelope,
  code: string,
): void {
  const blockers = validateVs005ObservationCompleteness({
    phase: "FIRST_DEPLOYMENT_READINESS",
    observations,
    mutationEnvelope,
  });
  requireMatch(blockers.length === 0, code);
}

function assertObservationEquality(
  planned: Vs005ProviderObservationSnapshot,
  current: Vs005ProviderObservationSnapshot,
): void {
  const fields: ReadonlyArray<readonly [keyof Vs005ProviderObservationSnapshot, string]> = [
    ["accountId", "PROVIDER_ACCOUNT_DRIFT"],
    ["workerName", "PROVIDER_WORKER_DRIFT"],
    ["workerExists", "WORKER_STATE_DRIFT"],
    ["workerConfigFingerprint", "CONFIG_DRIFT"],
    ["cronSchedules", "CRON_STATE_DRIFT"],
    ["nonSecretBindingNames", "BINDING_STATE_DRIFT"],
    ["secretNames", "SECRET_STATE_DRIFT"],
    ["currentRelease", "RELEASE_DRIFT"],
    ["priorVersion", "PRIOR_VERSION_DRIFT"],
    ["hostname", "HOSTNAME_DRIFT"],
  ];
  for (const [field, code] of fields) {
    requireMatch(equalJson(planned[field], current[field]), code);
  }
}

export async function applyVs005Deployment(input: {
  plan: unknown;
  config: unknown;
  targetPolicy: CadenceTargetPolicy;
  currentRelease: unknown;
  currentSecrets?: CadenceResolvedSecrets;
  provider: Vs005DeploymentProvider;
  prepareArtifacts: (input: {
    config: CadenceRuntimeConfig;
    release: CadenceReleaseIdentity;
  }) => Promise<{ generatedWranglerPath: string }>;
  clock?: () => Date;
}): Promise<Vs005DeploymentResult> {
  const plan = assertPlan(input.plan);
  requireMatch(plan.readiness === "PASS", "DEPLOYMENT_PLAN_BLOCKED");
  requireMatch(plan.database.migrationAction === "NONE", "DATABASE_ACTION_NOT_ALLOWED");
  requireMatch(plan.destructiveActions.length === 0, "DESTRUCTIVE_ACTIONS_PRESENT");

  const config = validateCadenceRuntimeConfig(input.config);
  requireMatch(config.runtime.provider === "cloudflare", "PROVIDER_MISMATCH");
  const release = loadCadenceReleaseIdentity(input.currentRelease);
  const fingerprint = fingerprintCadenceRuntimeConfig(config);
  let target: CadenceTargetFacts;
  try {
    assertCadenceTargetPolicy(config, input.targetPolicy);
    target = getCadenceTargetFacts(config);
  } catch {
    throw new Vs005ApplyError("TARGET_POLICY_MISMATCH");
  }

  requireMatch(plan.environment === config.application.environment, "ENVIRONMENT_MISMATCH");
  requireMatch(plan.intendedTarget !== undefined && equalJson(plan.intendedTarget, target), "INTENDED_TARGET_MISMATCH");
  requireMatch(plan.targetPolicy.name === input.targetPolicy.name, "TARGET_POLICY_MISMATCH");
  requireMatch(plan.publicUrl === config.application.publicUrl, "PUBLIC_URL_MISMATCH");
  requireMatch(plan.supabaseProjectRef === config.supabase.projectRef, "SUPABASE_TARGET_MISMATCH");
  requireMatch(plan.configVersion === config.configVersion, "CONFIG_VERSION_MISMATCH");
  requireMatch(plan.configFingerprint === fingerprint, "CONFIG_FINGERPRINT_MISMATCH");
  requireMatch(equalJson(plan.release, release), "RELEASE_MISMATCH");
  requireMatch(equalJson(plan.worker, config.worker), "WORKER_CONFIG_MISMATCH");
  requireMatch(plan.providerTarget.accountId === target.cloudflare.accountId, "ACCOUNT_TARGET_MISMATCH");
  requireMatch(plan.providerTarget.workerName === target.cloudflare.workerName, "WORKER_TARGET_MISMATCH");
  requireMatch(plan.observationPhase === "FIRST_DEPLOYMENT_READINESS", "OBSERVATION_PHASE_UNSUPPORTED");
  requireMatch(
    equalJson(plan.mutationEnvelope, expectedMutationEnvelope(config, plan.observedProvider)),
    "MUTATION_ENVELOPE_MISMATCH",
  );
  assertObservationCompleteness(
    plan.observedProvider,
    plan.mutationEnvelope,
    "PLAN_OBSERVATION_INCOMPLETE",
  );

  const requiredSecret = plan.secrets.find(
    (secret) => secret.name === config.supabase.secretKeySecretRef,
  );
  requireMatch(plan.secrets.length === 1 && requiredSecret !== undefined, "SECRET_PLAN_MISMATCH");

  let observed: Vs005ProviderObservationSnapshot;
  try {
    observed = normalizeProviderInspection(await input.provider.inspect(config));
  } catch {
    throw new Vs005ApplyError("PROVIDER_INSPECTION_FAILED");
  }

  assertObservationCompleteness(
    observed,
    plan.mutationEnvelope,
    "PROVIDER_INSPECTION_UNAVAILABLE",
  );
  const observedWorkerExists = observed.workerExists.state === "OBSERVED_VALUE"
    ? observed.workerExists.value
    : false;
  requireMatch(observedWorkerExists === plan.providerTarget.workerExists, "WORKER_STATE_DRIFT");
  if (observedWorkerExists) {
    requireMatch(
      observed.workerConfigFingerprint.state === "OBSERVED_VALUE"
        && observed.workerConfigFingerprint.value === plan.configFingerprint,
      "CONFIG_DRIFT",
    );
    requireMatch(
      observed.currentRelease.state === "OBSERVED_VALUE"
        && equalJson(observed.currentRelease.value, plan.release),
      "RELEASE_DRIFT",
    );
  }
  assertObservationEquality(plan.observedProvider, observed);
  const observedAccountId = observed.accountId.state === "OBSERVED_VALUE"
    ? observed.accountId.value
    : undefined;
  const observedWorkerName = observed.workerName.state === "OBSERVED_VALUE"
    ? observed.workerName.value
    : undefined;
  requireMatch(observedAccountId !== undefined, "PROVIDER_ACCOUNT_UNAVAILABLE");
  requireMatch(observedWorkerName !== undefined, "PROVIDER_WORKER_UNAVAILABLE");

  const remoteSecretPresent = observed.secretNames.state === "OBSERVED_VALUE"
    && observed.secretNames.value.includes(config.supabase.secretKeySecretRef);
  requireMatch(requiredSecret.providerPresent === remoteSecretPresent, "SECRET_STATE_DRIFT");
  if (remoteSecretPresent) {
    requireMatch(!plan.mutationEnvelope.secretNamesToSet.includes(config.supabase.secretKeySecretRef), "MUTATION_ENVELOPE_MISMATCH");
  } else {
    requireMatch(plan.mutationEnvelope.secretNamesToSet.includes(config.supabase.secretKeySecretRef), "SECRET_MUTATION_REQUIRED");
    requireMatch(requiredSecret.bootstrapInputAvailable, "BOOTSTRAP_SECRET_NOT_AUTHORIZED");
    requireMatch(Boolean(input.currentSecrets?.supabaseSecretKey), "BOOTSTRAP_SECRET_MISSING");
  }

  let prepared: { generatedWranglerPath: string };
  try {
    prepared = await input.prepareArtifacts({ config, release });
  } catch {
    throw new Vs005ApplyError("ARTIFACT_PREPARATION_FAILED");
  }

  let deployed: { deploymentId: string; providerVersionId: string };
  try {
    deployed = await input.provider.deploy({
      config,
      generatedWranglerPath: prepared.generatedWranglerPath,
      ...(requiredSecret.providerPresent
        ? {}
        : { bootstrapSecrets: input.currentSecrets }),
    });
  } catch {
    throw new Vs005ApplyError("PROVIDER_DEPLOYMENT_FAILED", true);
  }

  return {
    artifactType: "cadence.vs005.deployment-result",
    formatVersion: 1,
    planId: plan.planId,
    deploymentId: deployed.deploymentId,
    providerVersionId: deployed.providerVersionId,
    deployedAt: (input.clock ?? (() => new Date()))().toISOString(),
    environment: config.application.environment,
    provider: "cloudflare",
    providerTarget: {
      accountId: observedAccountId,
      workerName: observedWorkerName,
      workerExists: observedWorkerExists,
    },
    publicUrl: config.application.publicUrl,
    configVersion: config.configVersion,
    release,
    configFingerprint: fingerprint,
    databaseAction: "NONE",
    destructiveActions: [],
    intendedTarget: target,
    observedProvider: observed,
  };
}

function runLocalCommand(args: readonly string[]): Promise<void> {
  return new Promise((resolveCommand, rejectCommand) => {
    const [command, ...commandArgs] = args;
    const child = spawn(command, commandArgs, { shell: false, windowsHide: true });
    child.on("close", (exitCode) => {
      if (exitCode === 0) resolveCommand();
      else rejectCommand(new Vs005ApplyError("LOCAL_ARTIFACT_COMMAND_FAILED"));
    });
    child.on("error", () => rejectCommand(new Vs005ApplyError("LOCAL_ARTIFACT_COMMAND_FAILED")));
  });
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function planNeedsBootstrapSecret(plan: unknown): boolean {
  if (!isRecord(plan) || !Array.isArray(plan.secrets) || plan.secrets.length !== 1) return false;
  const secret = plan.secrets[0];
  return isRecord(secret)
    && secret.providerPresent === false
    && secret.bootstrapInputAvailable === true;
}

function parseCliArguments(args: readonly string[]): {
  planPath: string;
  configPath: string;
  outputPath: string;
} {
  let planPath: string | undefined;
  let configPath: string | undefined;
  let outputPath: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index + 1];
    if (args[index] === "--plan" && value) {
      planPath = value;
      index += 1;
    } else if (args[index] === "--config" && value) {
      configPath = value;
      index += 1;
    } else if (args[index] === "--out" && value) {
      outputPath = value;
      index += 1;
    } else {
      throw new Vs005ApplyError("INVALID_APPLY_ARGUMENTS");
    }
  }
  if (!planPath || !configPath || !outputPath) throw new Vs005ApplyError("INVALID_APPLY_ARGUMENTS");
  return { planPath, configPath, outputPath };
}

async function runApplyCli(args: readonly string[]): Promise<void> {
  let configPath = "<unspecified>";
  let outputPath = ".cadence/vs005/deployment-result.json";
  let mutationAttempted = false;
  try {
    const parsed = parseCliArguments(args);
    configPath = parsed.configPath;
    outputPath = parsed.outputPath;
    const config = loadCadenceRuntimeConfig(parsed.configPath);
    const plan = JSON.parse(readFileSync(parsed.planPath, "utf8")) as unknown;
    const release = loadCadenceReleaseIdentity({
      version: process.env.CADENCE_RELEASE_VERSION,
      commitSha: process.env.CADENCE_COMMIT_SHA,
      buildId: process.env.CADENCE_BUILD_ID,
    });
    const provider = createCloudflareDeploymentProvider(createDefaultCloudflareProviderIo());
    const result = await applyVs005Deployment({
      plan,
      config,
      targetPolicy: VS005_BETA_TARGET_POLICY,
      currentRelease: release,
      currentSecrets: planNeedsBootstrapSecret(plan)
        ? resolveCadenceSecrets(config, process.env)
        : undefined,
      provider,
      prepareArtifacts: async ({ config: currentConfig, release: currentRelease }) => {
        const publicConfigPath = resolve(process.cwd(), "../web/.generated/cadence-public-config.json");
        const wranglerPath = resolve(process.cwd(), "../runtime-cloudflare/wrangler.generated.jsonc");
        await runLocalCommand([
          "node",
          "--import",
          "tsx",
          "scripts/vs005-generate-web-config.ts",
          "--config",
          parsed.configPath,
          "--out",
          publicConfigPath,
        ]);
        await runLocalCommand(["npm.cmd", "--prefix", "../web", "exec", "--", "tsc", "-b"]);
        await runLocalCommand(["npm.cmd", "--prefix", "../web", "exec", "--", "vite", "build", "--mode", "ci"]);
        await runLocalCommand([
          "node",
          "--import",
          "tsx",
          "scripts/vs005-generate-deployment.ts",
          "--config",
          parsed.configPath,
          "--out",
          wranglerPath,
          "--release-version",
          currentRelease.version,
          "--commit-sha",
          currentRelease.commitSha,
          "--build-id",
          currentRelease.buildId,
        ]);
        await runLocalCommand(["wrangler", "deploy", "--config", wranglerPath, "--dry-run"]);
        return { generatedWranglerPath: wranglerPath };
      },
    });
    mutationAttempted = true;
    writeJson(parsed.outputPath, result);
  } catch (error) {
    mutationAttempted = error instanceof Vs005ApplyError && error.mutationAttempted;
    writeJson(outputPath, makeVs005OperatorFailure({
      stage: "apply",
      code: error instanceof Vs005ApplyError ? error.safeCode : "APPLY_BLOCKED",
      mutationOccurred: mutationAttempted,
      existingService: mutationAttempted ? "UNKNOWN" : "UNCHANGED",
      canonicalConfigPath: configPath,
      nextAction: mutationAttempted
        ? "Run the read-only deployment verification before taking further action."
        : "Review the deployment plan and current canonical configuration, then retry the apply checkpoint.",
    }));
  }
}

if (require.main === module) {
  void runApplyCli(process.argv.slice(2));
}

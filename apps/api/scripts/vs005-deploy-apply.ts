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
  loadCadenceReleaseIdentity,
  type CadenceReleaseIdentity,
} from "../src/bootstrap/cadence-release";
import type { Vs005DeploymentPlan } from "./vs005-deployment-artifacts";
import { makeVs005OperatorFailure } from "./vs005-deployment-artifacts";
import type { Vs005ProviderObservationSnapshot } from "./vs005-provider-observations";
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
  observations?: Vs005ProviderObservationSnapshot;
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

function assertPlan(value: unknown): Vs005DeploymentPlan {
  if (!isRecord(value)
    || value.artifactType !== "cadence.vs005.deployment-plan"
    || value.formatVersion !== 1
    || typeof value.planId !== "string"
    || typeof value.configFingerprint !== "string"
    || value.provider !== "cloudflare"
    || (value.readiness !== "PASS" && value.readiness !== "BLOCKED")
    || !Array.isArray(value.destructiveActions)) {
    throw new Vs005ApplyError("INVALID_DEPLOYMENT_PLAN");
  }
  return value as unknown as Vs005DeploymentPlan;
}

function equalJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function requireMatch(condition: boolean, code: string): asserts condition {
  if (!condition) throw new Vs005ApplyError(code);
}

function normalizeProviderInspection(
  value: Vs005DeploymentProviderInspection,
): Vs005DeploymentProviderInspection {
  if (!value.observations) return value;

  const { observations } = value;
  if (observations.accountId.state !== "OBSERVED_VALUE"
    || observations.workerName.state !== "OBSERVED_VALUE"
    || observations.workerExists.state === "UNAVAILABLE") {
    throw new Vs005ApplyError("PROVIDER_INSPECTION_UNAVAILABLE");
  }

  const configuredSecrets = observations.secretNames.state === "OBSERVED_VALUE"
    ? observations.secretNames.value
    : [];
  const configFingerprint = observations.workerConfigFingerprint.state === "OBSERVED_VALUE"
    ? observations.workerConfigFingerprint.value
    : null;
  return {
    accountId: observations.accountId.value,
    workerName: observations.workerName.value,
    workerExists: observations.workerExists.state === "OBSERVED_VALUE"
      ? observations.workerExists.value
      : false,
    configuredSecrets,
    configFingerprint,
  };
}

export async function applyVs005Deployment(input: {
  plan: unknown;
  config: unknown;
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
  requireMatch(plan.destructiveActions.length === 0, "DESTRUCTIVE_ACTIONS_PRESENT");

  const config = validateCadenceRuntimeConfig(input.config);
  const release = loadCadenceReleaseIdentity(input.currentRelease);
  const fingerprint = fingerprintCadenceRuntimeConfig(config);

  requireMatch(plan.environment === config.application.environment, "ENVIRONMENT_MISMATCH");
  requireMatch(plan.publicUrl === config.application.publicUrl, "PUBLIC_URL_MISMATCH");
  requireMatch(plan.supabaseProjectRef === config.supabase.projectRef, "SUPABASE_TARGET_MISMATCH");
  requireMatch(plan.configVersion === config.configVersion, "CONFIG_VERSION_MISMATCH");
  requireMatch(plan.configFingerprint === fingerprint, "CONFIG_FINGERPRINT_MISMATCH");
  requireMatch(equalJson(plan.release, release), "RELEASE_MISMATCH");
  requireMatch(equalJson(plan.worker, config.worker), "WORKER_CONFIG_MISMATCH");
  requireMatch(plan.providerTarget.workerName === `cadence-${config.application.environment}`, "WORKER_TARGET_MISMATCH");

  const requiredSecret = plan.secrets.find(
    (secret) => secret.name === config.supabase.secretKeySecretRef,
  );
  requireMatch(plan.secrets.length === 1 && requiredSecret !== undefined, "SECRET_PLAN_MISMATCH");

  let observed: Vs005DeploymentProviderInspection;
  try {
    observed = normalizeProviderInspection(await input.provider.inspect(config));
  } catch {
    throw new Vs005ApplyError("PROVIDER_INSPECTION_FAILED");
  }

  requireMatch(observed.accountId === plan.providerTarget.accountId, "PROVIDER_TARGET_DRIFT");
  requireMatch(observed.workerName === plan.providerTarget.workerName, "PROVIDER_TARGET_DRIFT");
  requireMatch(observed.workerExists === plan.providerTarget.workerExists, "PROVIDER_TARGET_DRIFT");

  if (plan.providerTarget.workerExists && observed.configFingerprint !== null) {
    requireMatch(observed.configFingerprint === plan.configFingerprint, "CONFIG_DRIFT");
  }

  const remoteSecretPresent = observed.configuredSecrets.includes(config.supabase.secretKeySecretRef);
  if (requiredSecret.providerPresent) {
    requireMatch(remoteSecretPresent, "SECRET_STATE_DRIFT");
  } else {
    requireMatch(!remoteSecretPresent, "SECRET_STATE_DRIFT");
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
      accountId: observed.accountId,
      workerName: observed.workerName,
      workerExists: observed.workerExists,
    },
    publicUrl: config.application.publicUrl,
    configVersion: config.configVersion,
    release,
    configFingerprint: fingerprint,
    databaseAction: "NONE",
    destructiveActions: [],
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

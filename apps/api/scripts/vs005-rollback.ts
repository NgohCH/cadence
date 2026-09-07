import {
  fingerprintCadenceRuntimeConfig,
  loadCadenceRuntimeConfig,
  validateCadenceRuntimeConfig,
  type CadenceRuntimeConfig,
} from "../src/bootstrap/cadence-config";
import {
  assertCadenceTargetPolicy,
  getCadenceTargetFacts,
  VS005_BETA_TARGET_POLICY,
  type CadenceTargetPolicy,
} from "../src/bootstrap/cadence-target-policy";
import {
  loadCadenceReleaseIdentity,
  type CadenceReleaseIdentity,
} from "../src/bootstrap/cadence-release";
import type { Vs005DeploymentResult } from "./vs005-deploy-apply";
import {
  verifyVs005Deployment,
  type Vs005DeploymentVerification,
} from "./vs005-deploy-verify";
import { makeVs005OperatorFailure } from "./vs005-deployment-artifacts";
import {
  createCloudflareDeploymentProvider,
  createDefaultCloudflareProviderIo,
} from "./vs005-cloudflare-deployment-provider";
import {
  validateVs005ObservationCompleteness,
  type Vs005MutationEnvelope,
  type Vs005ProviderInspection,
} from "./vs005-provider-observations";

export interface Vs005RollbackRequest {
  providerVersionId: string;
  expectedRelease: CadenceReleaseIdentity;
  expectedConfigFingerprint: string;
  expectedEnvironment: "local" | "qa" | "beta";
  expectedProvider: "cloudflare";
  expectedProviderTarget: {
    accountId: string;
    workerName: string;
  };
  expectedPublicUrl: string;
  expectedPriorVersionA: {
    providerVersionId: string;
    release: CadenceReleaseIdentity;
    configFingerprint: string;
  };
  databaseAction: "NONE";
}

export interface Vs005RollbackProvider {
  inspectTarget(input?: { accountId: string; workerName: string }): Promise<Vs005ProviderInspection | {
    accountId: string;
    workerName: string;
  }>;

  rollback(providerVersionId: string): Promise<{
    deploymentId: string;
    activeProviderVersionId: string;
  }>;
}

export class Vs005RollbackError extends Error {
  readonly mutationAttempted: boolean;
  readonly safeCode: string;

  constructor(code: string, mutationAttempted = false) {
    super(code);
    this.name = "Vs005RollbackError";
    this.safeCode = code;
    this.mutationAttempted = mutationAttempted;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEnvironment(value: unknown): value is Vs005RollbackRequest["expectedEnvironment"] {
  return value === "local" || value === "qa" || value === "beta";
}

function isSafeIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9._-]{1,128}$/.test(value);
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function isPublicOrigin(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:")
      && url.username === ""
      && url.password === ""
      && url.pathname === "/"
      && url.search === ""
      && url.hash === "";
  } catch {
    return false;
  }
}

function equalJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function assertRequestShape(value: unknown): asserts value is Record<string, unknown> {
  if (!isRecord(value)) throw new Vs005RollbackError("INVALID_ROLLBACK_REQUEST");
}

export function validateVs005RollbackRequest(value: unknown): Vs005RollbackRequest {
  assertRequestShape(value);
  if (value.databaseAction !== "NONE") {
    throw new Vs005RollbackError("DATABASE ROLLBACK IS NOT A VS005 OPERATION");
  }

  let expectedRelease: CadenceReleaseIdentity;
  try {
    expectedRelease = loadCadenceReleaseIdentity(value.expectedRelease);
  } catch {
    throw new Vs005RollbackError("INVALID_ROLLBACK_RELEASE");
  }

  const target = value.expectedProviderTarget;
  if (!isSafeIdentifier(value.providerVersionId)
    || !isSha256(value.expectedConfigFingerprint)
    || !isEnvironment(value.expectedEnvironment)
    || value.expectedProvider !== "cloudflare"
    || !isRecord(target)
    || !isSafeIdentifier(target.accountId)
    || !isSafeIdentifier(target.workerName)
    || !isPublicOrigin(value.expectedPublicUrl)) {
    throw new Vs005RollbackError("INVALID_ROLLBACK_REQUEST");
  }

  if (!isRecord(value.expectedPriorVersionA)
    || !isSafeIdentifier(value.expectedPriorVersionA.providerVersionId)
    || !isSha256(value.expectedPriorVersionA.configFingerprint)) {
    throw new Vs005RollbackError("PRIOR VERSION A REQUIRED");
  }

  let priorRelease: CadenceReleaseIdentity;
  try {
    priorRelease = loadCadenceReleaseIdentity(value.expectedPriorVersionA.release);
  } catch {
    throw new Vs005RollbackError("PRIOR VERSION A REQUIRED");
  }

  return {
    providerVersionId: value.providerVersionId,
    expectedRelease,
    expectedConfigFingerprint: value.expectedConfigFingerprint,
    expectedEnvironment: value.expectedEnvironment,
    expectedProvider: "cloudflare",
    expectedProviderTarget: {
      accountId: target.accountId,
      workerName: target.workerName,
    },
    expectedPublicUrl: value.expectedPublicUrl,
    expectedPriorVersionA: {
      providerVersionId: value.expectedPriorVersionA.providerVersionId,
      release: priorRelease,
      configFingerprint: value.expectedPriorVersionA.configFingerprint,
    },
    databaseAction: "NONE",
  };
}

export function validateVs005DeploymentEvidence(value: unknown): Vs005DeploymentResult {
  if (!isRecord(value)
    || value.artifactType !== "cadence.vs005.deployment-result"
    || value.formatVersion !== 1
    || !isSafeIdentifier(value.planId)
    || !isSafeIdentifier(value.deploymentId)
    || !isSafeIdentifier(value.providerVersionId)
    || typeof value.deployedAt !== "string"
    || !isEnvironment(value.environment)
    || value.provider !== "cloudflare"
    || !isRecord(value.providerTarget)
    || !isSafeIdentifier(value.providerTarget.accountId)
    || !isSafeIdentifier(value.providerTarget.workerName)
    || typeof value.providerTarget.workerExists !== "boolean"
    || !isPublicOrigin(value.publicUrl)
    || value.configVersion !== 1
    || !isSha256(value.configFingerprint)
    || value.databaseAction !== "NONE"
    || !Array.isArray(value.destructiveActions)
    || value.destructiveActions.length !== 0) {
    throw new Vs005RollbackError("INVALID_DEPLOYMENT_EVIDENCE");
  }

  let release: CadenceReleaseIdentity;
  try {
    release = loadCadenceReleaseIdentity(value.release);
  } catch {
    throw new Vs005RollbackError("INVALID_DEPLOYMENT_EVIDENCE");
  }

  const result: Vs005DeploymentResult = {
    artifactType: "cadence.vs005.deployment-result",
    formatVersion: 1,
    planId: value.planId,
    deploymentId: value.deploymentId,
    providerVersionId: value.providerVersionId,
    deployedAt: value.deployedAt,
    environment: value.environment,
    provider: "cloudflare",
    providerTarget: {
      accountId: value.providerTarget.accountId,
      workerName: value.providerTarget.workerName,
      workerExists: value.providerTarget.workerExists,
    },
    publicUrl: value.publicUrl,
    configVersion: 1,
    release,
    configFingerprint: value.configFingerprint,
    databaseAction: "NONE",
    destructiveActions: [],
  };
  if (value.intendedTarget !== undefined) result.intendedTarget = value.intendedTarget as Vs005DeploymentResult["intendedTarget"];
  if (value.observedProvider !== undefined) result.observedProvider = value.observedProvider as Vs005DeploymentResult["observedProvider"];
  return result;
}

function requireMatch(condition: boolean, code: string): asserts condition {
  if (!condition) throw new Vs005RollbackError(code);
}

function normalizeRollbackTarget(
  value: Awaited<ReturnType<Vs005RollbackProvider["inspectTarget"]>>,
): Vs005ProviderInspection {
  if (!("observations" in value)) {
    throw new Vs005RollbackError("ROLLBACK PROVIDER INSPECTION UNAVAILABLE");
  }
  if (value.observations.accountId.state !== "OBSERVED_VALUE"
    || value.observations.workerName.state !== "OBSERVED_VALUE"
    || value.observations.workerExists.state !== "OBSERVED_VALUE"
    || value.observations.workerExists.value !== true
    || value.observations.currentRelease.state !== "OBSERVED_VALUE"
    || value.observations.priorVersion.state !== "OBSERVED_VALUE"
    || value.observations.workerConfigFingerprint.state !== "OBSERVED_VALUE"
    || value.observations.hostname.state !== "OBSERVED_VALUE") {
    throw new Vs005RollbackError("ROLLBACK PROVIDER INSPECTION UNAVAILABLE");
  }
  return value;
}

export async function rollbackVs005Application(input: {
  request: Vs005RollbackRequest;
  currentDeploymentEvidence: Vs005DeploymentResult;
  targetDeploymentEvidence: Vs005DeploymentResult;
  currentConfig: CadenceRuntimeConfig;
  targetPolicy: CadenceTargetPolicy;
  provider: Vs005RollbackProvider;
  verify: (
    deployment: Vs005DeploymentResult,
    expectedConfig: CadenceRuntimeConfig
  ) => Promise<Vs005DeploymentVerification>;
  clock?: () => Date;
}): Promise<Vs005DeploymentVerification> {
  const request = validateVs005RollbackRequest(input.request);
  const currentEvidence = validateVs005DeploymentEvidence(input.currentDeploymentEvidence);
  const targetEvidence = validateVs005DeploymentEvidence(input.targetDeploymentEvidence);
  validateCadenceRuntimeConfig(input.currentConfig);
  const currentConfig = input.currentConfig;
  const currentFingerprint = fingerprintCadenceRuntimeConfig(currentConfig);
  const currentTarget = getCadenceTargetFacts(currentConfig);

  try {
    assertCadenceTargetPolicy(currentConfig, input.targetPolicy);
  } catch {
    throw new Vs005RollbackError("ROLLBACK TARGET POLICY MISMATCH");
  }

  requireMatch(Boolean(targetEvidence.intendedTarget && targetEvidence.observedProvider), "ROLLBACK DEPLOYMENT PROVENANCE REQUIRED");
  requireMatch(Boolean(currentEvidence.intendedTarget && currentEvidence.observedProvider), "ROLLBACK DEPLOYMENT PROVENANCE REQUIRED");
  requireMatch(equalJson(currentTarget, targetEvidence.intendedTarget), "ROLLBACK TARGET MISMATCH");
  requireMatch(equalJson(currentTarget, currentEvidence.intendedTarget), "ROLLBACK TARGET MISMATCH");

  requireMatch(request.expectedConfigFingerprint === currentFingerprint, "ROLLBACK CONFIGURATION MISMATCH");
  requireMatch(targetEvidence.configFingerprint === currentFingerprint, "ROLLBACK CONFIGURATION MISMATCH");
  requireMatch(request.providerVersionId === targetEvidence.providerVersionId, "ROLLBACK TARGET MISMATCH");
  requireMatch(equalJson(request.expectedRelease, targetEvidence.release), "ROLLBACK TARGET MISMATCH");
  requireMatch(request.expectedConfigFingerprint === targetEvidence.configFingerprint, "ROLLBACK TARGET MISMATCH");
  requireMatch(request.expectedEnvironment === targetEvidence.environment, "ROLLBACK TARGET MISMATCH");
  requireMatch(request.expectedProvider === targetEvidence.provider, "ROLLBACK TARGET MISMATCH");
  requireMatch(equalJson(request.expectedProviderTarget, {
    accountId: targetEvidence.providerTarget.accountId,
    workerName: targetEvidence.providerTarget.workerName,
  }), "ROLLBACK TARGET MISMATCH");
  requireMatch(request.expectedPublicUrl === targetEvidence.publicUrl, "ROLLBACK TARGET MISMATCH");
  requireMatch(equalJson(request.expectedPriorVersionA, {
    providerVersionId: targetEvidence.providerVersionId,
    release: targetEvidence.release,
    configFingerprint: targetEvidence.configFingerprint,
  }), "PRIOR VERSION A REQUIRED");

  requireMatch(currentEvidence.environment === targetEvidence.environment, "ROLLBACK TARGET MISMATCH");
  requireMatch(currentEvidence.provider === targetEvidence.provider, "ROLLBACK TARGET MISMATCH");
  requireMatch(currentEvidence.publicUrl === targetEvidence.publicUrl, "ROLLBACK TARGET MISMATCH");
  requireMatch(currentEvidence.providerTarget.accountId === targetEvidence.providerTarget.accountId, "ROLLBACK TARGET MISMATCH");
  requireMatch(currentEvidence.providerTarget.workerName === targetEvidence.providerTarget.workerName, "ROLLBACK TARGET MISMATCH");
  requireMatch(currentEvidence.databaseAction === "NONE" && targetEvidence.databaseAction === "NONE", "ROLLBACK DATABASE ACTION INVALID");
  requireMatch(currentEvidence.destructiveActions.length === 0 && targetEvidence.destructiveActions.length === 0, "ROLLBACK DESTRUCTIVE ACTION INVALID");

  let liveInspection: Vs005ProviderInspection;
  try {
    liveInspection = normalizeRollbackTarget(await input.provider.inspectTarget({
      accountId: targetEvidence.providerTarget.accountId,
      workerName: targetEvidence.providerTarget.workerName,
    }));
  } catch {
    throw new Vs005RollbackError("ROLLBACK PROVIDER INSPECTION FAILED");
  }
  const liveTarget = liveInspection.observations;
  const rollbackObservationBlockers = validateVs005ObservationCompleteness({
    phase: "ROLLBACK_READINESS",
    observations: liveTarget,
    mutationEnvelope: {
      workerAction: "CREATE_OR_UPDATE",
      cronAction: "NO_CHANGE",
      secretNamesToSet: [],
    } satisfies Vs005MutationEnvelope,
  });
  requireMatch(rollbackObservationBlockers.length === 0, "ROLLBACK PROVIDER INSPECTION FAILED");
  requireMatch(
    liveTarget.accountId.state === "OBSERVED_VALUE"
      && liveTarget.accountId.value === targetEvidence.providerTarget.accountId
      && liveTarget.workerName.state === "OBSERVED_VALUE"
      && liveTarget.workerName.value === targetEvidence.providerTarget.workerName,
    "ROLLBACK PROVIDER TARGET MISMATCH",
  );
  requireMatch(
    liveTarget.currentRelease.state === "OBSERVED_VALUE"
      && equalJson(liveTarget.currentRelease.value, currentEvidence.release),
    "ROLLBACK RELEASE MISMATCH",
  );
  requireMatch(
    liveTarget.workerConfigFingerprint.state === "OBSERVED_VALUE"
      && liveTarget.workerConfigFingerprint.value === currentEvidence.configFingerprint,
    "ROLLBACK CONFIGURATION MISMATCH",
  );
  requireMatch(
    liveTarget.priorVersion.state === "OBSERVED_VALUE"
      && equalJson(liveTarget.priorVersion.value, request.expectedPriorVersionA),
    "ROLLBACK PRIOR VERSION MISMATCH",
  );
  requireMatch(
    liveTarget.hostname.state === "OBSERVED_VALUE"
      && liveTarget.hostname.value === new URL(request.expectedPublicUrl).hostname,
    "ROLLBACK HOSTNAME MISMATCH",
  );

  let rollbackResult: { deploymentId: string; activeProviderVersionId: string };
  try {
    rollbackResult = await input.provider.rollback(request.providerVersionId);
  } catch {
    throw new Vs005RollbackError("ROLLBACK PROVIDER FAILED", true);
  }
  requireMatch(
    rollbackResult.activeProviderVersionId === request.providerVersionId,
    "ROLLBACK ACTIVE VERSION MISMATCH",
  );

  const reconstructed: Vs005DeploymentResult = {
    ...targetEvidence,
    deploymentId: rollbackResult.deploymentId,
    providerVersionId: rollbackResult.activeProviderVersionId,
    deployedAt: (input.clock ?? (() => new Date()))().toISOString(),
    databaseAction: "NONE",
    destructiveActions: [],
  };

  try {
    return await input.verify(reconstructed, currentConfig);
  } catch {
    throw new Vs005RollbackError("ROLLBACK VERIFICATION FAILED", true);
  }
}

function writeJson(path: string, value: unknown): void {
  const { mkdirSync, writeFileSync } = require("node:fs") as typeof import("node:fs");
  const { dirname } = require("node:path") as typeof import("node:path");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseCliArguments(args: readonly string[]): {
  currentDeploymentPath: string;
  targetDeploymentPath: string;
  configPath: string;
  outputPath: string;
} {
  let currentDeploymentPath: string | undefined;
  let targetDeploymentPath: string | undefined;
  let configPath: string | undefined;
  let outputPath: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index + 1];
    if (args[index] === "--current-deployment" && value) {
      currentDeploymentPath = value;
      index += 1;
    } else if (args[index] === "--target-deployment" && value) {
      targetDeploymentPath = value;
      index += 1;
    } else if (args[index] === "--config" && value) {
      configPath = value;
      index += 1;
    } else if (args[index] === "--out" && value) {
      outputPath = value;
      index += 1;
    } else {
      throw new Vs005RollbackError("INVALID_ROLLBACK_ARGUMENTS");
    }
  }
  if (!currentDeploymentPath || !targetDeploymentPath || !configPath || !outputPath) {
    throw new Vs005RollbackError("INVALID_ROLLBACK_ARGUMENTS");
  }
  return { currentDeploymentPath, targetDeploymentPath, configPath, outputPath };
}

function createVerificationReaders(
  config: CadenceRuntimeConfig,
  provider: ReturnType<typeof createCloudflareDeploymentProvider>,
) {
  const origin = new URL(config.application.publicUrl);
  const response = async (path: string): Promise<Response> => fetch(new URL(path, origin));
  return {
    getWeb: async () => ({ status: (await response("/")).status }),
    inspectBrowserBundle: async () => {
      const browserResponse = await response("/");
      const body = await browserResponse.text();
      return {
        status: browserResponse.status,
        forbiddenServerMarkersFound: /SUPABASE_SECRET_KEY|SERVICE_ROLE|SECRET_KEY/i.test(body),
      };
    },
    getHealth: async () => {
      const healthResponse = await response("/health");
      return {
        status: healthResponse.status,
        json: healthResponse.status === 200 ? await healthResponse.json() : null,
      };
    },
    probeApi: async () => ({ status: (await response("/api/v1")).status }),
    inspectProvider: async () => (await provider.inspect(config)).observations,
    inspectRuntimeTarget: async () => ({ environment: "", safeTargetMarker: "", supabaseProjectRef: null, pilotProjectId: null }),
    probeControlledProject: async () => ({ status: 0, projectId: null }),
  };
}

async function runRollbackCli(args: readonly string[]): Promise<void> {
  let outputPath = ".cadence/vs005/rollback-verification.json";
  let configPath = "<unspecified>";
  let mutationAttempted = false;
  try {
    const parsed = parseCliArguments(args);
    outputPath = parsed.outputPath;
    configPath = parsed.configPath;
    const currentDeployment = validateVs005DeploymentEvidence(
      JSON.parse(require("node:fs").readFileSync(parsed.currentDeploymentPath, "utf8")),
    );
    const targetDeployment = validateVs005DeploymentEvidence(
      JSON.parse(require("node:fs").readFileSync(parsed.targetDeploymentPath, "utf8")),
    );
    const config = loadCadenceRuntimeConfig(parsed.configPath);
    const request: Vs005RollbackRequest = {
      providerVersionId: targetDeployment.providerVersionId,
      expectedRelease: targetDeployment.release,
      expectedConfigFingerprint: targetDeployment.configFingerprint,
      expectedEnvironment: targetDeployment.environment,
      expectedProvider: targetDeployment.provider,
      expectedProviderTarget: targetDeployment.providerTarget,
      expectedPublicUrl: targetDeployment.publicUrl,
      expectedPriorVersionA: {
        providerVersionId: targetDeployment.providerVersionId,
        release: targetDeployment.release,
        configFingerprint: targetDeployment.configFingerprint,
      },
      databaseAction: targetDeployment.databaseAction,
    };

    console.log(`Application rollback target: ${request.providerVersionId}`);
    console.log("Database action: NONE");
    console.log("Database reset: NO");
    console.log("Migration reversal: NO");
    console.log("Post-rollback verification: REQUIRED");

    const provider = createCloudflareDeploymentProvider(
      createDefaultCloudflareProviderIo(),
      { workerName: targetDeployment.providerTarget.workerName },
    );
    const verification = await rollbackVs005Application({
      request,
      currentDeploymentEvidence: currentDeployment,
      targetDeploymentEvidence: targetDeployment,
      currentConfig: config,
      targetPolicy: VS005_BETA_TARGET_POLICY,
      provider,
      verify: (deployment, expectedConfig) => verifyVs005Deployment({
        deployment,
        expectedConfig,
        targetPolicy: VS005_BETA_TARGET_POLICY,
        readers: createVerificationReaders(expectedConfig, provider),
      }),
    });
    writeJson(parsed.outputPath, verification);
  } catch (error) {
    mutationAttempted = error instanceof Vs005RollbackError && error.mutationAttempted;
    writeJson(outputPath, makeVs005OperatorFailure({
      stage: "rollback",
      code: error instanceof Vs005RollbackError ? error.safeCode : "ROLLBACK_BLOCKED",
      mutationOccurred: mutationAttempted,
      existingService: mutationAttempted ? "UNKNOWN" : "UNCHANGED",
      canonicalConfigPath: configPath,
      nextAction: mutationAttempted
        ? "Run read-only deployment verification before taking further action."
        : "Review the current and target deployment evidence, then retry the rollback checkpoint.",
    }));
  }
}

if (require.main === module) {
  void runRollbackCli(process.argv.slice(2));
}

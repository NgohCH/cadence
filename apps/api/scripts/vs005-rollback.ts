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
import {
  isVs005CorrelatedDeploymentResult,
  type Vs005CorrelatedDeploymentResult,
  type Vs005DeploymentResult,
} from "./vs005-deploy-apply";
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
  type Vs005CorrelatedProviderInspection,
} from "./vs005-provider-observations";
import type { CloudflareStructuredInspectionRequest } from "./vs005-cloudflare-structured-inspection";
import { buildCloudflareDeployment } from "./vs005-generate-deployment";
import { resolveCadenceOperatorPath, resolveCadenceRepositoryRoot } from "./cadence-operator-path";

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
  inspectStructured(request: CloudflareStructuredInspectionRequest): Promise<Vs005CorrelatedProviderInspection>;

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

export function validateVs005DeploymentEvidence(value: unknown): Vs005CorrelatedDeploymentResult {
  if (!isVs005CorrelatedDeploymentResult(value)) {
    throw new Vs005RollbackError("INVALID_DEPLOYMENT_EVIDENCE");
  }
  return value;
}

function requireMatch(condition: boolean, code: string): asserts condition {
  if (!condition) throw new Vs005RollbackError(code);
}

export async function rollbackVs005Application(input: {
  request: Vs005RollbackRequest;
  currentDeploymentEvidence: Vs005DeploymentResult;
  targetDeploymentEvidence: Vs005DeploymentResult;
  currentConfig: CadenceRuntimeConfig;
  targetPolicy: CadenceTargetPolicy;
  provider: Vs005RollbackProvider;
  verify: (
    deployment: Vs005CorrelatedDeploymentResult,
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

  let liveInspection: Vs005CorrelatedProviderInspection;
  try {
    liveInspection = await input.provider.inspectStructured({
      config: currentConfig,
      release: currentEvidence.release,
      generatedConfig: buildCloudflareDeployment({ config: currentConfig, release: currentEvidence.release }).wrangler,
      profile: "ROLLBACK_READINESS",
      expectedPriorVersion: request.expectedPriorVersionA,
    });
  } catch {
    throw new Vs005RollbackError("ROLLBACK PROVIDER INSPECTION FAILED");
  }
  const liveTarget = liveInspection.observations;
  const expectedOperations = ["CURRENT_DEPLOYMENT", "WORKER_SETTINGS", "CRON_SCHEDULES", "DEPLOYABLE_VERSIONS", "VERSION", "WORKER_SUBDOMAIN", "ACCOUNT_SUBDOMAIN"];
  requireMatch(
    liveInspection.correlation.accountId === targetEvidence.providerTarget.accountId
      && liveInspection.correlation.workerName === targetEvidence.providerTarget.workerName
      && liveInspection.correlation.configFingerprint === currentFingerprint
      && liveInspection.correlation.providerOrigin === "api.cloudflare.com"
      && liveInspection.correlation.profile === "ROLLBACK_READINESS"
      && equalJson(liveInspection.correlation.completedOperations, expectedOperations),
    "ROLLBACK PROVIDER INSPECTION FAILED",
  );
  requireMatch(
    liveTarget.accountId.state === "OBSERVED_VALUE"
      && liveTarget.accountId.value === targetEvidence.providerTarget.accountId
      && liveTarget.workerName.state === "OBSERVED_VALUE"
      && liveTarget.workerName.value === targetEvidence.providerTarget.workerName,
    "ROLLBACK PROVIDER TARGET MISMATCH",
  );
  requireMatch(
    liveTarget.currentDeployment.state === "OBSERVED_VALUE"
      && liveTarget.currentDeployment.value.deploymentId === currentEvidence.deploymentId
      && liveTarget.currentDeployment.value.versions.some(
        (version) => version.providerVersionId === currentEvidence.providerVersionId,
      ),
    "ROLLBACK CURRENT DEPLOYMENT MISMATCH",
  );
  requireMatch(
    liveTarget.currentRelease.state === "OBSERVED_VALUE"
      && equalJson(liveTarget.currentRelease.value, currentEvidence.release),
    "ROLLBACK RELEASE MISMATCH",
  );
  requireMatch(
    liveTarget.workerExists.state === "OBSERVED_VALUE"
      && liveTarget.workerExists.value === true
      && liveTarget.cronSchedules.state === "OBSERVED_VALUE"
      && liveTarget.cronSchedules.value.includes(currentConfig.worker.schedule)
      && liveTarget.secretNames.state === "OBSERVED_VALUE"
      && liveTarget.secretNames.value.includes(currentConfig.supabase.secretKeySecretRef)
      && liveTarget.workersDevEnabled.state === "OBSERVED_VALUE"
      && liveTarget.workersDevEnabled.value === true
      && liveTarget.accountWorkersDevSubdomain.state === "OBSERVED_VALUE"
      && `${targetEvidence.providerTarget.workerName}.${liveTarget.accountWorkersDevSubdomain.value}.workers.dev`
        === new URL(request.expectedPublicUrl).hostname,
    "ROLLBACK PROVIDER INSPECTION FAILED",
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

  const reconstructed: Vs005CorrelatedDeploymentResult = {
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
    inspectProvider: async (request: CloudflareStructuredInspectionRequest) => provider.inspectStructured(request),
    inspectRuntimeTarget: async () => ({ environment: "", safeTargetMarker: "", supabaseProjectRef: null, pilotProjectId: null }),
    probeControlledProject: async () => ({ status: 0, projectId: null }),
  };
}

async function runRollbackCli(args: readonly string[]): Promise<void> {
  let outputPath = ".cadence/vs005/rollback-verification.json";
  let configPath = "<unspecified>";
  let mutationAttempted = false;
  let rootEstablished = false;
  try {
    const parsed = parseCliArguments(args);
    const repositoryRoot = resolveCadenceRepositoryRoot();
    const resolvedPaths = {
      currentDeploymentPath: resolveCadenceOperatorPath({ repositoryRoot, inputPath: parsed.currentDeploymentPath }),
      targetDeploymentPath: resolveCadenceOperatorPath({ repositoryRoot, inputPath: parsed.targetDeploymentPath }),
      configPath: resolveCadenceOperatorPath({ repositoryRoot, inputPath: parsed.configPath }),
      outputPath: resolveCadenceOperatorPath({ repositoryRoot, inputPath: parsed.outputPath }),
    };
    outputPath = resolvedPaths.outputPath;
    configPath = resolvedPaths.configPath;
    rootEstablished = true;
    const currentDeployment = validateVs005DeploymentEvidence(
      JSON.parse(require("node:fs").readFileSync(resolvedPaths.currentDeploymentPath, "utf8")),
    );
    const targetDeployment = validateVs005DeploymentEvidence(
      JSON.parse(require("node:fs").readFileSync(resolvedPaths.targetDeploymentPath, "utf8")),
    );
    const config = loadCadenceRuntimeConfig(resolvedPaths.configPath);
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
    writeJson(resolvedPaths.outputPath, verification);
  } catch (error) {
    if (!rootEstablished) return;
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

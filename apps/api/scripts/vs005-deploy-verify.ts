import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import {
  loadCadenceRuntimeConfig,
  fingerprintCadenceRuntimeConfig,
  validateCadenceRuntimeConfig,
  type CadenceRuntimeConfig,
} from "../src/bootstrap/cadence-config";
import {
  assertCadenceTargetPolicy,
  getCadenceTargetFacts,
  VS005_BETA_TARGET_POLICY,
  type CadenceTargetFacts,
  type CadenceTargetPolicy,
} from "../src/bootstrap/cadence-target-policy";
import {
  isVs005CorrelatedDeploymentResult,
  type Vs005CorrelatedDeploymentResult,
  type Vs005DeploymentResult,
} from "./vs005-deploy-apply";
import { makeVs005OperatorFailure } from "./vs005-deployment-artifacts";
import {
  createCloudflareDeploymentProvider,
  createDefaultCloudflareProviderIo,
} from "./vs005-cloudflare-deployment-provider";
import {
  buildCloudflareDeployment,
} from "./vs005-generate-deployment";
import type { CloudflareStructuredInspectionRequest } from "./vs005-cloudflare-structured-inspection";
import type {
  Vs005CorrelatedProviderInspection,
  Vs005Observation,
  Vs005StructuredProviderObservationSnapshot,
} from "./vs005-provider-observations";

export interface Vs005VerificationReaders {
  getWeb(): Promise<{ status: number }>;
  inspectBrowserBundle(): Promise<{ status: number; forbiddenServerMarkersFound: boolean }>;
  getHealth(): Promise<{ status: number; json: unknown }>;
  probeApi(): Promise<{ status: number }>;
  inspectProvider(request: CloudflareStructuredInspectionRequest): Promise<Vs005CorrelatedProviderInspection>;
  inspectRuntimeTarget(): Promise<{
    environment: string;
    safeTargetMarker: string;
    supabaseProjectRef: string | null;
    pilotProjectId: string | null;
  }>;
  probeControlledProject(): Promise<{ status: number; projectId: string | null }>;
}

export interface Vs005DeploymentVerificationCheck {
  name:
    | "web"
    | "browser-config"
    | "health"
    | "api"
    | "environment"
    | "safe-target-marker"
    | "release"
    | "provider-target"
    | "provider-observation"
    | "supabase-target"
    | "controlled-project"
    | "schedule"
    | "secret-binding"
    | "config-drift"
    | "deployment-provenance"
    | "database"
    | "cors";
  outcome: "PASS" | "FAIL";
  code: string;
}

export interface Vs005DeploymentVerification {
  artifactType: "cadence.vs005.deployment-verification";
  formatVersion: 1;
  deploymentId: string;
  environment: "local" | "qa" | "beta";
  release: Vs005DeploymentResult["release"];
  configVersion: 1;
  checks: readonly Vs005DeploymentVerificationCheck[];
  outcome: "PASS" | "FAIL";
  pilotActivation: "NOT_AUTHORISED";
}

function unavailable<T>(code: string): Vs005Observation<T> {
  return { state: "UNAVAILABLE", code };
}

function healthMatches(value: unknown, deployment: Vs005DeploymentResult): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const health = value as Record<string, unknown>;
  return health.status === "ok"
    && health.service === "cadence-api"
    && health.environment === deployment.environment
    && health.configVersion === deployment.configVersion
    && health.configFingerprint === deployment.configFingerprint
    && health.version === deployment.release.version
    && health.commitSha === deployment.release.commitSha
    && health.buildId === deployment.release.buildId;
}

function check(
  name: Vs005DeploymentVerificationCheck["name"],
  passed: boolean,
  passCode: string,
  failCode: string,
): Vs005DeploymentVerificationCheck {
  return { name, outcome: passed ? "PASS" : "FAIL", code: passed ? passCode : failCode };
}

function resultFor(
  deployment: Vs005DeploymentResult,
  checks: readonly Vs005DeploymentVerificationCheck[],
): Vs005DeploymentVerification {
  return {
    artifactType: "cadence.vs005.deployment-verification",
    formatVersion: 1,
    deploymentId: deployment.deploymentId,
    environment: deployment.environment,
    release: deployment.release,
    configVersion: deployment.configVersion,
    checks,
    outcome: checks.every((item) => item.outcome === "PASS") ? "PASS" : "FAIL",
    pilotActivation: "NOT_AUTHORISED",
  };
}

function observedValue<T>(observation: Vs005Observation<T>): T | undefined {
  return observation.state === "OBSERVED_VALUE" ? observation.value : undefined;
}

function equalJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function targetFromDeployment(deployment: Vs005DeploymentResult): CadenceTargetFacts | undefined {
  return deployment.intendedTarget;
}

function providerObservationMatches(
  observations: Vs005StructuredProviderObservationSnapshot,
  deployment: Vs005CorrelatedDeploymentResult,
  expectedConfig: CadenceRuntimeConfig,
  target: CadenceTargetFacts,
): { checks: Vs005DeploymentVerificationCheck[]; complete: boolean } {
  const checks: Vs005DeploymentVerificationCheck[] = [];
  const accountId = observedValue(observations.accountId);
  const workerName = observedValue(observations.workerName);
  const workerExists = observedValue(observations.workerExists);
  const configFingerprint = observedValue(observations.workerConfigFingerprint);
  const schedules = observedValue(observations.cronSchedules);
  const bindingNames = observedValue(observations.nonSecretBindingNames);
  const secretNames = observedValue(observations.secretNames);
  const currentRelease = observedValue(observations.currentRelease);
  const hostname = observedValue(observations.hostname);
  const currentDeployment = observedValue(observations.currentDeployment);
  const workersDevEnabled = observedValue(observations.workersDevEnabled);
  const accountSubdomain = observedValue(observations.accountWorkersDevSubdomain);

  checks.push(check(
    "provider-target",
    observations.accountId.state === "OBSERVED_VALUE" && accountId === target.cloudflare.accountId,
    "PROVIDER_ACCOUNT_MATCH",
    observations.accountId.state === "UNAVAILABLE" ? "PROVIDER_OBSERVATION_UNAVAILABLE" : "PROVIDER_ACCOUNT_DRIFT",
  ));
  checks.push(check(
    "deployment-provenance",
    observations.currentDeployment.state === "OBSERVED_VALUE"
      && currentDeployment?.deploymentId === deployment.deploymentId,
    "CURRENT_DEPLOYMENT_MATCH",
    "CURRENT_DEPLOYMENT_DRIFT",
  ));
  checks.push(check(
    "deployment-provenance",
    observations.currentDeployment.state === "OBSERVED_VALUE"
      && currentDeployment?.versions.some((version) => version.providerVersionId === deployment.providerVersionId) === true,
    "ACTIVE_PROVIDER_VERSION_MATCH",
    "ACTIVE_PROVIDER_VERSION_DRIFT",
  ));
  checks.push(check(
    "provider-observation",
    observations.workersDevEnabled.state === "OBSERVED_VALUE" && workersDevEnabled === true,
    "WORKERS_DEV_ENABLED",
    "WORKERS_DEV_STATE_DRIFT",
  ));
  checks.push(check(
    "provider-observation",
    observations.accountWorkersDevSubdomain.state === "OBSERVED_VALUE"
      && `${target.cloudflare.workerName}.${accountSubdomain}.workers.dev` === new URL(target.publicUrl).hostname,
    "ACCOUNT_SUBDOMAIN_MATCH",
    "ACCOUNT_SUBDOMAIN_DRIFT",
  ));
  checks.push(check(
    "provider-target",
    observations.workerName.state === "OBSERVED_VALUE" && workerName === target.cloudflare.workerName,
    "PROVIDER_WORKER_MATCH",
    observations.workerName.state === "UNAVAILABLE" ? "PROVIDER_OBSERVATION_UNAVAILABLE" : "PROVIDER_WORKER_DRIFT",
  ));
  checks.push(check(
    "provider-observation",
    observations.workerExists.state === "OBSERVED_VALUE" && workerExists === true,
    "WORKER_PRESENT",
    observations.workerExists.state === "UNAVAILABLE" ? "PROVIDER_OBSERVATION_UNAVAILABLE" : "WORKER_ABSENT",
  ));
  checks.push(check(
    "provider-observation",
    observations.workerConfigFingerprint.state === "OBSERVED_VALUE"
      && configFingerprint === deployment.configFingerprint,
    "WORKER_CONFIG_MATCH",
    observations.workerConfigFingerprint.state === "UNAVAILABLE" ? "PROVIDER_OBSERVATION_UNAVAILABLE" : "WORKER_CONFIG_DRIFT",
  ));
  checks.push(check(
    "provider-observation",
    observations.nonSecretBindingNames.state === "OBSERVED_VALUE" && bindingNames !== undefined,
    "NON_SECRET_BINDINGS_OBSERVED",
    observations.nonSecretBindingNames.state === "UNAVAILABLE" ? "PROVIDER_OBSERVATION_UNAVAILABLE" : "NON_SECRET_BINDINGS_UNAVAILABLE",
  ));
  checks.push(check(
    "schedule",
    observations.cronSchedules.state === "OBSERVED_VALUE" && schedules?.includes(expectedConfig.worker.schedule) === true,
    "SCHEDULE_MATCH",
    observations.cronSchedules.state === "UNAVAILABLE" ? "PROVIDER_OBSERVATION_UNAVAILABLE" : "SCHEDULE_DRIFT",
  ));
  checks.push(check(
    "secret-binding",
    observations.secretNames.state === "OBSERVED_VALUE"
      && secretNames?.includes(expectedConfig.supabase.secretKeySecretRef) === true,
    "SECRET_BINDING_PRESENT",
    observations.secretNames.state === "UNAVAILABLE" ? "PROVIDER_OBSERVATION_UNAVAILABLE" : "SECRET_BINDING_DRIFT",
  ));
  checks.push(check(
    "release",
    observations.currentRelease.state === "OBSERVED_VALUE" && equalJson(currentRelease, deployment.release),
    "PROVIDER_RELEASE_MATCH",
    observations.currentRelease.state === "UNAVAILABLE" ? "PROVIDER_OBSERVATION_UNAVAILABLE" : "PROVIDER_RELEASE_DRIFT",
  ));
  checks.push(check(
    "provider-observation",
    observations.hostname.state === "OBSERVED_VALUE"
      && hostname === new URL(target.publicUrl).hostname,
    "HOSTNAME_MATCH",
    observations.hostname.state === "UNAVAILABLE" ? "PROVIDER_OBSERVATION_UNAVAILABLE" : "HOSTNAME_DRIFT",
  ));

  return { checks, complete: checks.every((item) => item.outcome === "PASS") };
}

export async function verifyVs005Deployment(input: {
  deployment: Vs005CorrelatedDeploymentResult;
  expectedConfig: CadenceRuntimeConfig;
  targetPolicy: CadenceTargetPolicy;
  readers: Vs005VerificationReaders;
}): Promise<Vs005DeploymentVerification> {
  if (input.expectedConfig.application.environment !== "local"
    && input.expectedConfig.application.apiBaseUrl !== "") {
    throw new Error("UNSUPPORTED_CROSS_ORIGIN_CONFIG: unsupported cross-origin config");
  }
  const expectedConfig = validateCadenceRuntimeConfig(input.expectedConfig);
  const expectedTarget = getCadenceTargetFacts(expectedConfig);
  const checks: Vs005DeploymentVerificationCheck[] = [];

  if (!isVs005CorrelatedDeploymentResult(input.deployment)) {
    return resultFor(input.deployment, [
      check("deployment-provenance", false, "DEPLOYMENT_PROVENANCE_COMPLETE", "INSUFFICIENT_DEPLOYMENT_PROVENANCE"),
    ]);
  }

  try {
    assertCadenceTargetPolicy(expectedConfig, input.targetPolicy);
  } catch {
    return resultFor(input.deployment, [check("deployment-provenance", false, "TARGET_POLICY_MATCH", "TARGET_POLICY_MISMATCH")]);
  }

  const intendedTarget = targetFromDeployment(input.deployment);
  if (!intendedTarget || !input.deployment.observedProvider) {
    return resultFor(input.deployment, [
      check("deployment-provenance", false, "DEPLOYMENT_PROVENANCE_COMPLETE", "INSUFFICIENT_DEPLOYMENT_PROVENANCE"),
    ]);
  }

  checks.push(check(
    "deployment-provenance",
    equalJson(intendedTarget, expectedTarget)
      && input.deployment.providerTarget.accountId === expectedTarget.cloudflare.accountId
      && input.deployment.providerTarget.workerName === expectedTarget.cloudflare.workerName
      && input.deployment.publicUrl === expectedTarget.publicUrl
      && input.deployment.configFingerprint === fingerprintCadenceRuntimeConfig(expectedConfig)
      && input.deployment.databaseAction === "NONE"
      && input.deployment.destructiveActions.length === 0,
    "DEPLOYMENT_PROVENANCE_MATCH",
    "DEPLOYMENT_PROVENANCE_DRIFT",
  ));
  checks.push(check(
    "environment",
    intendedTarget.environment === expectedTarget.environment
      && input.deployment.environment === expectedTarget.environment,
    "ENVIRONMENT_MATCH",
    "ENVIRONMENT_DRIFT",
  ));
  checks.push(check(
    "provider-target",
    input.deployment.providerTarget.accountId === expectedTarget.cloudflare.accountId
      && input.deployment.providerTarget.workerName === expectedTarget.cloudflare.workerName,
    "TARGET_IDENTITY_MATCH",
    "TARGET_IDENTITY_DRIFT",
  ));
  checks.push(check(
    "supabase-target",
    intendedTarget.supabaseProjectRef === expectedTarget.supabaseProjectRef,
    "SUPABASE_TARGET_MATCH",
    "SUPABASE_TARGET_DRIFT",
  ));
  checks.push(check(
    "web",
    input.deployment.publicUrl === expectedTarget.publicUrl,
    "PUBLIC_URL_MATCH",
    "PUBLIC_URL_DRIFT",
  ));

  const inspectionRequest: CloudflareStructuredInspectionRequest = {
    config: expectedConfig,
    release: input.deployment.release,
    generatedConfig: buildCloudflareDeployment({ config: expectedConfig, release: input.deployment.release }).wrangler,
    profile: "POST_DEPLOYMENT_VERIFICATION",
  };
  const [web, browser, health, api, providerInspection, runtimeTarget, controlledProject] = await Promise.all([
    input.readers.getWeb().catch(() => ({ status: 0 })),
    input.readers.inspectBrowserBundle().catch(() => ({ status: 0, forbiddenServerMarkersFound: false })),
    input.readers.getHealth().catch(() => ({ status: 0, json: null })),
    input.readers.probeApi().catch(() => ({ status: 0 })),
    input.readers.inspectProvider(inspectionRequest).catch(() => undefined),
    input.readers.inspectRuntimeTarget().catch(() => ({
      environment: "",
      safeTargetMarker: "",
      supabaseProjectRef: null,
      pilotProjectId: null,
    })),
    input.readers.probeControlledProject().catch(() => ({ status: 0, projectId: null })),
  ]);

  if (!providerInspection) {
    checks.push(check("provider-observation", false, "PROVIDER_INSPECTION_COMPLETE", "PROVIDER_OBSERVATION_UNAVAILABLE"));
    return resultFor(input.deployment, checks);
  }
  const provider = providerInspection.observations;
  const expectedOperations = ["CURRENT_DEPLOYMENT", "WORKER_SETTINGS", "CRON_SCHEDULES", "WORKER_SUBDOMAIN", "ACCOUNT_SUBDOMAIN"];
  checks.push(check(
    "provider-target",
    providerInspection.correlation.accountId === expectedTarget.cloudflare.accountId,
    "PROVIDER_ACCOUNT_MATCH",
    "PROVIDER_ACCOUNT_DRIFT",
  ));
  checks.push(check(
    "provider-target",
    providerInspection.correlation.workerName === expectedTarget.cloudflare.workerName,
    "PROVIDER_WORKER_MATCH",
    "PROVIDER_WORKER_DRIFT",
  ));
  checks.push(check(
    "provider-observation",
    providerInspection.correlation.configFingerprint === input.deployment.configFingerprint
      && providerInspection.correlation.providerOrigin === "api.cloudflare.com"
      && providerInspection.correlation.profile === "POST_DEPLOYMENT_VERIFICATION"
      && equalJson(providerInspection.correlation.completedOperations, expectedOperations),
    "PROVIDER_CORRELATION_MATCH",
    "PROVIDER_CORRELATION_DRIFT",
  ));

  checks.push(check("web", web.status === 200, "WEB_REACHABLE", "WEB_UNAVAILABLE"));
  checks.push(check(
    "browser-config",
    browser.status === 200 && !browser.forbiddenServerMarkersFound,
    "BROWSER_CONFIG_SAFE",
    browser.forbiddenServerMarkersFound ? "BROWSER_SERVER_CONFIG_EXPOSURE" : "BROWSER_UNAVAILABLE",
  ));
  checks.push(check(
    "health",
    health.status === 200 && healthMatches(health.json, input.deployment),
    "HEALTH_IDENTITY_MATCH",
    "HEALTH_UNAVAILABLE_OR_MALFORMED",
  ));
  checks.push(check("api", api.status === 401 || api.status === 403, "API_ROUTE_REACHABLE", "API_UNAVAILABLE"));
  checks.push(check(
    "release",
    health.status === 200 && healthMatches(health.json, input.deployment),
    "RELEASE_MATCH",
    "RELEASE_DRIFT",
  ));
  checks.push(check(
    "safe-target-marker",
    runtimeTarget.environment === expectedTarget.environment
      && runtimeTarget.safeTargetMarker === expectedTarget.safeTargetMarker,
    "SAFE_TARGET_MATCH",
    "SAFE_TARGET_MARKER_DRIFT",
  ));
  checks.push(check(
    "supabase-target",
    runtimeTarget.supabaseProjectRef === expectedTarget.supabaseProjectRef,
    "RUNTIME_SUPABASE_TARGET_MATCH",
    "SUPABASE_TARGET_DRIFT",
  ));
  checks.push(check(
    "controlled-project",
    controlledProject.status === 200 && controlledProject.projectId === expectedTarget.pilotProjectId,
    "CONTROLLED_PROJECT_MATCH",
    "CONTROLLED_PROJECT_DRIFT",
  ));

  const providerResult = providerObservationMatches(provider, input.deployment, expectedConfig, expectedTarget);
  checks.push(...providerResult.checks);
  checks.push(check(
    "config-drift",
    input.deployment.configFingerprint === fingerprintCadenceRuntimeConfig(expectedConfig)
      && observedValue(provider.workerConfigFingerprint) === input.deployment.configFingerprint,
    "CONFIG_MATCH",
    "CONFIG_DRIFT",
  ));
  checks.push(check(
    "database",
    input.deployment.databaseAction === "NONE" && input.deployment.destructiveActions.length === 0,
    "DATABASE_NONE",
    "DATABASE_ACTION_INVALID",
  ));
  checks.push(check(
    "cors",
    expectedConfig.application.apiBaseUrl === "",
    "SAME_ORIGIN_CORS_NOT_APPLICABLE",
    "UNSUPPORTED_CROSS_ORIGIN_CONFIG",
  ));

  return resultFor(input.deployment, checks);
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseCliArguments(args: readonly string[]): { deploymentPath: string; configPath: string; outputPath: string } {
  let deploymentPath: string | undefined;
  let configPath: string | undefined;
  let outputPath: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index + 1];
    if (args[index] === "--deployment" && value) { deploymentPath = value; index += 1; }
    else if (args[index] === "--config" && value) { configPath = value; index += 1; }
    else if (args[index] === "--out" && value) { outputPath = value; index += 1; }
    else throw new Error("INVALID_VERIFY_ARGUMENTS");
  }
  if (!deploymentPath || !configPath || !outputPath) throw new Error("INVALID_VERIFY_ARGUMENTS");
  return { deploymentPath, configPath, outputPath };
}

async function runVerifyCli(args: readonly string[]): Promise<void> {
  let configPath = "<unspecified>";
  let outputPath = ".cadence/vs005/deployment-verification.json";
  try {
    const parsed = parseCliArguments(args);
    configPath = parsed.configPath;
    outputPath = parsed.outputPath;
    const config = loadCadenceRuntimeConfig(parsed.configPath);
    const deployment = JSON.parse(readFileSync(parsed.deploymentPath, "utf8"));
    if (!isVs005CorrelatedDeploymentResult(deployment)) throw new Error("INVALID_DEPLOYMENT_EVIDENCE");
    const provider = createCloudflareDeploymentProvider(createDefaultCloudflareProviderIo());
    const origin = new URL(config.application.publicUrl);
    const response = async (path: string): Promise<Response> => fetch(new URL(path, origin));
    const result = await verifyVs005Deployment({
      deployment,
      expectedConfig: config,
      targetPolicy: VS005_BETA_TARGET_POLICY,
      readers: {
        getWeb: async () => ({ status: (await response("/")).status }),
        inspectBrowserBundle: async () => {
          const browserResponse = await response("/");
          const body = await browserResponse.text();
          return { status: browserResponse.status, forbiddenServerMarkersFound: /SUPABASE_SECRET_KEY|SERVICE_ROLE|SECRET_KEY/i.test(body) };
        },
        getHealth: async () => {
          const healthResponse = await response("/health");
          return { status: healthResponse.status, json: healthResponse.status === 200 ? await healthResponse.json() : null };
        },
        probeApi: async () => ({ status: (await response("/api/v1")).status }),
        inspectProvider: async (request) => provider.inspectStructured(request),
        inspectRuntimeTarget: async () => ({ environment: "", safeTargetMarker: "", supabaseProjectRef: null, pilotProjectId: null }),
        probeControlledProject: async () => ({ status: 0, projectId: null }),
      },
    });
    writeJson(parsed.outputPath, result);
  } catch {
    writeJson(outputPath, makeVs005OperatorFailure({
      stage: "verify", code: "VERIFICATION_BLOCKED", mutationOccurred: false, existingService: "UNKNOWN",
      canonicalConfigPath: configPath, nextAction: "Review the deployment result and rerun read-only verification.",
    }));
  }
}

if (require.main === module) void runVerifyCli(process.argv.slice(2));

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import {
  loadCadenceRuntimeConfig,
  fingerprintCadenceRuntimeConfig,
  validateCadenceRuntimeConfig,
  type CadenceRuntimeConfig,
} from "../src/bootstrap/cadence-config";
import type { Vs005DeploymentResult } from "./vs005-deploy-apply";
import { makeVs005OperatorFailure } from "./vs005-deployment-artifacts";
import {
  createCloudflareDeploymentProvider,
  createDefaultCloudflareProviderIo,
} from "./vs005-cloudflare-deployment-provider";

export interface Vs005VerificationReaders {
  getWeb(): Promise<{ status: number }>;
  inspectBrowserBundle(): Promise<{
    status: number;
    forbiddenServerMarkersFound: boolean;
  }>;
  getHealth(): Promise<{ status: number; json: unknown }>;
  probeApi(): Promise<{ status: number }>;
  inspectProvider(): Promise<{
    accountId: string;
    workerName: string;
    schedule: string;
    configuredSecrets: readonly string[];
    configFingerprint: string;
    supabaseProjectRef: string | null;
  }>;
}

export interface Vs005DeploymentVerificationCheck {
  name:
    | "web"
    | "browser-config"
    | "health"
    | "api"
    | "environment"
    | "release"
    | "provider-target"
    | "supabase-target"
    | "schedule"
    | "secret-binding"
    | "config-drift"
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

export async function verifyVs005Deployment(input: {
  deployment: Vs005DeploymentResult;
  expectedConfig: CadenceRuntimeConfig;
  readers: Vs005VerificationReaders;
}): Promise<Vs005DeploymentVerification> {
  if (input.expectedConfig.application.environment !== "local"
    && input.expectedConfig.application.apiBaseUrl !== "") {
    throw new Error("UNSUPPORTED_CROSS_ORIGIN_CONFIG: unsupported cross-origin config");
  }
  const expectedConfig = validateCadenceRuntimeConfig(input.expectedConfig);

  const checks: Vs005DeploymentVerificationCheck[] = [];
  const noConfiguredSecrets: readonly string[] = [];
  const [web, browser, health, api, provider] = await Promise.all([
    input.readers.getWeb().catch(() => ({ status: 0 })),
    input.readers.inspectBrowserBundle().catch(() => ({ status: 0, forbiddenServerMarkersFound: false })),
    input.readers.getHealth().catch(() => ({ status: 0, json: null })),
    input.readers.probeApi().catch(() => ({ status: 0 })),
    input.readers.inspectProvider().catch(() => ({
      accountId: "",
      workerName: "",
      schedule: "",
      configuredSecrets: noConfiguredSecrets,
      configFingerprint: "",
      supabaseProjectRef: null,
    })),
  ]);

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
  checks.push(check(
    "api",
    api.status === 401 || api.status === 403,
    "API_ROUTE_REACHABLE",
    "API_UNAVAILABLE",
  ));
  checks.push(check(
    "environment",
    input.deployment.environment === expectedConfig.application.environment,
    "ENVIRONMENT_MATCH",
    "ENVIRONMENT_DRIFT",
  ));
  checks.push(check(
    "release",
    typeof health.json === "object"
      && health.json !== null
      && !Array.isArray(health.json)
      && (health.json as Record<string, unknown>).version === input.deployment.release.version
      && (health.json as Record<string, unknown>).commitSha === input.deployment.release.commitSha
      && (health.json as Record<string, unknown>).buildId === input.deployment.release.buildId,
    "RELEASE_MATCH",
    "RELEASE_DRIFT",
  ));
  checks.push(check(
    "provider-target",
    provider.accountId === input.deployment.providerTarget.accountId
      && provider.workerName === input.deployment.providerTarget.workerName,
    "PROVIDER_TARGET_MATCH",
    "PROVIDER_TARGET_DRIFT",
  ));
  checks.push(check(
    "supabase-target",
    provider.supabaseProjectRef === expectedConfig.supabase.projectRef,
    "SUPABASE_TARGET_MATCH",
    "SUPABASE_TARGET_DRIFT",
  ));
  checks.push(check(
    "schedule",
    provider.schedule === expectedConfig.worker.schedule,
    "SCHEDULE_MATCH",
    "SCHEDULE_DRIFT",
  ));
  checks.push(check(
    "secret-binding",
    provider.configuredSecrets.includes(expectedConfig.supabase.secretKeySecretRef),
    "SECRET_BINDING_PRESENT",
    "SECRET_BINDING_DRIFT",
  ));
  checks.push(check(
    "config-drift",
    provider.configFingerprint === input.deployment.configFingerprint
      && input.deployment.configFingerprint === fingerprintCadenceRuntimeConfig(expectedConfig),
    "CONFIG_MATCH",
    "CONFIG_DRIFT",
  ));
  checks.push(check(
    "cors",
    expectedConfig.application.apiBaseUrl === "",
    "SAME_ORIGIN_CORS_NOT_APPLICABLE",
    "UNSUPPORTED_CROSS_ORIGIN_CONFIG",
  ));

  return {
    artifactType: "cadence.vs005.deployment-verification",
    formatVersion: 1,
    deploymentId: input.deployment.deploymentId,
    environment: input.deployment.environment,
    release: input.deployment.release,
    configVersion: input.deployment.configVersion,
    checks,
    outcome: checks.every((item) => item.outcome === "PASS") ? "PASS" : "FAIL",
    pilotActivation: "NOT_AUTHORISED",
  };
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseCliArguments(args: readonly string[]): {
  deploymentPath: string;
  configPath: string;
  outputPath: string;
} {
  let deploymentPath: string | undefined;
  let configPath: string | undefined;
  let outputPath: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index + 1];
    if (args[index] === "--deployment" && value) {
      deploymentPath = value;
      index += 1;
    } else if (args[index] === "--config" && value) {
      configPath = value;
      index += 1;
    } else if (args[index] === "--out" && value) {
      outputPath = value;
      index += 1;
    } else {
      throw new Error("INVALID_VERIFY_ARGUMENTS");
    }
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
    const deployment = JSON.parse(readFileSync(parsed.deploymentPath, "utf8")) as Vs005DeploymentResult;
    const provider = createCloudflareDeploymentProvider(createDefaultCloudflareProviderIo());
    const origin = new URL(config.application.publicUrl);
    const response = async (path: string): Promise<Response> => fetch(new URL(path, origin));
    const result = await verifyVs005Deployment({
      deployment,
      expectedConfig: config,
      readers: {
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
        inspectProvider: async () => {
          const inspected = await provider.inspect(config);
          return {
            accountId: inspected.accountId,
            workerName: inspected.workerName,
            schedule: config.worker.schedule,
            configuredSecrets: inspected.configuredSecrets,
            configFingerprint: inspected.configFingerprint ?? "",
            supabaseProjectRef: config.supabase.projectRef,
          };
        },
      },
    });
    writeJson(parsed.outputPath, result);
  } catch {
    writeJson(outputPath, makeVs005OperatorFailure({
      stage: "verify",
      code: "VERIFICATION_BLOCKED",
      mutationOccurred: false,
      existingService: "UNKNOWN",
      canonicalConfigPath: configPath,
      nextAction: "Review the deployment result and rerun read-only verification.",
    }));
  }
}

if (require.main === module) {
  void runVerifyCli(process.argv.slice(2));
}

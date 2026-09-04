import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import {
  fingerprintCadenceRuntimeConfig,
  loadCadenceRuntimeConfig,
  validateCadenceRuntimeConfig,
  type CadenceRuntimeConfig,
} from "../src/bootstrap/cadence-config";
import {
  loadCadenceReleaseIdentity,
  type CadenceReleaseIdentity,
} from "../src/bootstrap/cadence-release";
import {
  makeVs005OperatorFailure,
  type Vs005DeploymentPlan,
} from "./vs005-deployment-artifacts";

export interface Vs005PlanInspection {
  providerReachable: boolean;
  providerAuthReady: boolean;
  providerAccountId: string | null;
  generatedWorkerName: string;
  hostnameReady: boolean;
  generatedConfigValid: boolean;
  webBuildReady: boolean;
  workerExists: boolean;
  priorVersionAvailable: boolean;
  secretStatus: Readonly<Record<string, {
    providerPresent: boolean;
    bootstrapInputAvailable: boolean;
  }>>;
}

export interface Vs005DeployPlanDependencies {
  loadConfig(path: string): unknown;
  loadRelease(): CadenceReleaseIdentity;
  inspect(config: CadenceRuntimeConfig): Promise<Vs005PlanInspection>;
  generatePlanId(): string;
  writePlan(path: string, plan: Vs005DeploymentPlan): Promise<void>;
}

export type { Vs005DeploymentPlan } from "./vs005-deployment-artifacts";

const CHANGES = [
  "WEB_STATIC_ASSETS",
  "API_WORKER",
  "SCHEDULED_WORKER",
] as const;

function makeBlockers(
  config: CadenceRuntimeConfig,
  inspection: Vs005PlanInspection,
): { code: string; message: string }[] {
  const blockers: { code: string; message: string }[] = [];
  const expectedWorkerName = `cadence-${config.application.environment}`;

  if (!inspection.providerReachable) {
    blockers.push({
      code: "CLOUDFLARE_PROVIDER_UNREACHABLE",
      message: "Cloudflare provider inspection is unavailable.",
    });
  }

  if (!inspection.providerAuthReady) {
    blockers.push({
      code: "CLOUDFLARE_AUTH_UNAVAILABLE",
      message: "Cloudflare deployment authentication is unavailable.",
    });
  } else if (!inspection.providerAccountId) {
    blockers.push({
      code: "CLOUDFLARE_TARGET_UNRESOLVED",
      message: "The authenticated Cloudflare account identity is unresolved.",
    });
  }

  if (inspection.generatedWorkerName !== expectedWorkerName) {
    blockers.push({
      code: "WORKER_TARGET_MISMATCH",
      message: `Generated Worker target must be ${expectedWorkerName}.`,
    });
  }

  if (!inspection.hostnameReady) {
    blockers.push({
      code: "HOSTNAME_NOT_READY",
      message: "The reviewed application hostname is not ready.",
    });
  }

  if (!inspection.generatedConfigValid) {
    blockers.push({
      code: "GENERATED_CONFIG_INVALID",
      message: "The generated provider configuration is invalid.",
    });
  }

  if (!inspection.webBuildReady) {
    blockers.push({
      code: "WEB_BUILD_NOT_READY",
      message: "The browser build is not ready.",
    });
  }

  const status = inspection.secretStatus[config.supabase.secretKeySecretRef] ?? {
    providerPresent: false,
    bootstrapInputAvailable: false,
  };
  if (!status.providerPresent && !status.bootstrapInputAvailable) {
    blockers.push({
      code: "MISSING_REQUIRED_SECRET",
      message:
        `Required secret ${config.supabase.secretKeySecretRef} is neither configured remotely nor available as authorized bootstrap input.`,
    });
  }

  return blockers;
}

export async function runVs005DeployPlan(
  input: { configPath: string; outputPath: string },
  dependencies: Vs005DeployPlanDependencies,
): Promise<Vs005DeploymentPlan> {
  const rawConfig = dependencies.loadConfig(input.configPath);
  const config = validateCadenceRuntimeConfig(rawConfig);
  if (config.runtime.provider !== "cloudflare") {
    throw new Error("Deployment planning requires the cloudflare runtime provider");
  }

  const release = loadCadenceReleaseIdentity(dependencies.loadRelease());
  const configFingerprint = fingerprintCadenceRuntimeConfig(config);
  const inspection = await dependencies.inspect(config);
  const blockers = makeBlockers(config, inspection);
  const secretStatus = inspection.secretStatus[config.supabase.secretKeySecretRef] ?? {
    providerPresent: false,
    bootstrapInputAvailable: false,
  };

  const plan: Vs005DeploymentPlan = {
    artifactType: "cadence.vs005.deployment-plan",
    formatVersion: 1,
    planId: dependencies.generatePlanId(),
    configFingerprint,
    release,
    environment: config.application.environment,
    provider: "cloudflare",
    providerTarget: {
      accountId: inspection.providerAccountId ?? "",
      workerName: inspection.generatedWorkerName,
      workerExists: inspection.workerExists,
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
      providerPresent: secretStatus.providerPresent,
      bootstrapInputAvailable: secretStatus.bootstrapInputAvailable,
      ready: secretStatus.providerPresent || secretStatus.bootstrapInputAvailable,
    }],
    database: { migrationAction: "NONE" },
    rollback: {
      application: inspection.priorVersionAvailable ? "SUPPORTED" : "UNAVAILABLE",
      database: "NOT_PERFORMED",
    },
    changes: CHANGES,
    destructiveActions: [],
    readiness: blockers.length === 0 ? "PASS" : "BLOCKED",
    blockers,
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
    const dependencies: Vs005DeployPlanDependencies = {
      loadConfig: (path) => loadCadenceRuntimeConfig(path),
      loadRelease: loadReleaseFromEnvironment,
      inspect: async (config) => ({
        providerReachable: false,
        providerAuthReady: false,
        providerAccountId: null,
        generatedWorkerName: `cadence-${config.application.environment}`,
        hostnameReady: false,
        generatedConfigValid: false,
        webBuildReady: false,
        workerExists: false,
        priorVersionAvailable: false,
        secretStatus: {
          [config.supabase.secretKeySecretRef]: {
            providerPresent: false,
            bootstrapInputAvailable: Boolean(process.env[config.supabase.secretKeySecretRef]),
          },
        },
      }),
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

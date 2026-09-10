import { chmod, mkdir, open, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

import type { CadenceRuntimeConfig } from "../src/bootstrap/cadence-config";
import { loadCadenceReleaseIdentity, type CadenceReleaseIdentity } from "../src/bootstrap/cadence-release";
import {
  type Vs005DeploymentProvider,
  type Vs005DeploymentProviderInspection,
} from "./vs005-deploy-apply";
import {
  type Vs005Observation,
  type Vs005CorrelatedProviderInspection,
  type Vs005ProviderObservationSnapshot,
  type Vs005StructuredProviderObservationSnapshot,
} from "./vs005-provider-observations";
import type { GeneratedCloudflareDeployment } from "./vs005-generate-deployment";
import type { Vs005RollbackProvider } from "./vs005-rollback";
import {
  createCloudflareStructuredReadOnlyProvider,
  inspectCloudflareReadOnly,
  type CloudflareStructuredInspectionRequest,
} from "./vs005-cloudflare-structured-inspection";
import {
  createCloudflareReadOnlyTransport,
  createEnvironmentCloudflareCredentialProvider,
  createCloudflareWorkerInspectionTarget,
  type CloudflareCredentialProvider,
} from "./vs005-cloudflare-readonly-transport";

export interface CloudflareReadOnlyProviderFacts extends Vs005ProviderObservationSnapshot {}

export interface CloudflareDeploymentProviderIo {
  createTemporarySecretFile(content: string, mode: number): Promise<string>;
  deleteFile(path: string): Promise<void>;
  runWrangler(
    args: readonly string[],
    childEnvironment?: NodeJS.ProcessEnv,
  ): Promise<{ exitCode: number; stdout: string }>;
  environment?: Readonly<Record<string, string | undefined>>;
  inspectReadOnly(input: CloudflareStructuredInspectionRequest): Promise<Vs005CorrelatedProviderInspection>;
  inspectLegacyReadOnly?(input: {
    accountId: string;
    workerName: string;
  }): Promise<CloudflareReadOnlyProviderFacts>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function withoutCloudflareInspectionCredential(
  parentEnvironment: Readonly<Record<string, string | undefined>>,
): NodeJS.ProcessEnv {
  const childEnvironment = { ...parentEnvironment };
  delete childEnvironment.CLOUDFLARE_INSPECTION_API_TOKEN;
  return childEnvironment;
}

function unavailable<T>(code: string): Vs005Observation<T> {
  return { state: "UNAVAILABLE", code };
}

function observedValue<T>(value: T): Vs005Observation<T> {
  return { state: "OBSERVED_VALUE", value };
}

function sanitizeObservation<T>(
  value: unknown,
  parse: (value: unknown) => T | undefined,
  code: string,
): Vs005Observation<T> {
  if (!isRecord(value)) return unavailable(code);
  if (value.state === "OBSERVED_ABSENT") return { state: "OBSERVED_ABSENT" };
  if (value.state === "UNAVAILABLE") return unavailable(code);
  if (value.state !== "OBSERVED_VALUE") return unavailable(code);
  const parsed = parse(value.value);
  return parsed === undefined ? unavailable(code) : observedValue(parsed);
}

function parseSafeText(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^[A-Za-z0-9._:/-]{1,256}$/.test(value)) return undefined;
  return value;
}

function parseSafeIdentifier(value: unknown): string | undefined {
  return typeof value === "string" ? boundedIdentifier(value) : undefined;
}

function parseSafeBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function parseSafeStringList(value: unknown, pattern: RegExp): readonly string[] | undefined {
  if (!Array.isArray(value) || value.length > 128) return undefined;
  const result = value.map((item) => (
    typeof item === "string" && pattern.test(item) ? item : undefined
  ));
  return result.every((item): item is string => item !== undefined) ? result : undefined;
}

function parseSafeRelease(value: unknown): CadenceReleaseIdentity | undefined {
  try {
    return loadCadenceReleaseIdentity(value);
  } catch {
    return undefined;
  }
}

interface SafePriorVersion {
  providerVersionId: string;
  release: CadenceReleaseIdentity;
  configFingerprint: string;
}

function parseSafePriorVersion(value: unknown): SafePriorVersion | undefined {
  if (!isRecord(value)) return undefined;
  const providerVersionId = parseSafeIdentifier(value.providerVersionId);
  const release = parseSafeRelease(value.release);
  const configFingerprint = parseSafeIdentifier(value.configFingerprint);
  if (!providerVersionId || !release || !configFingerprint) return undefined;
  return { providerVersionId, release, configFingerprint };
}

function sanitizeReadOnlyFacts(value: unknown): CloudflareReadOnlyProviderFacts {
  const facts = isRecord(value) ? value : {};
  return {
    accountId: sanitizeObservation(
      facts.accountId,
      (item) => parseSafeIdentifier(item),
      "CLOUDFLARE_ACCOUNT_UNAVAILABLE",
    ),
    workerName: sanitizeObservation(
      facts.workerName,
      (item) => parseSafeIdentifier(item),
      "CLOUDFLARE_WORKER_UNAVAILABLE",
    ),
    workerExists: sanitizeObservation(
      facts.workerExists,
      parseSafeBoolean,
      "CLOUDFLARE_WORKER_EXISTENCE_UNAVAILABLE",
    ),
    workerConfigFingerprint: sanitizeObservation(
      facts.workerConfigFingerprint,
      (item) => parseSafeIdentifier(item),
      "CLOUDFLARE_WORKER_CONFIG_UNAVAILABLE",
    ),
    cronSchedules: sanitizeObservation(
      facts.cronSchedules,
      (item) => parseSafeStringList(item, /^[A-Za-z0-9*/,_? -]{1,128}$/),
      "CLOUDFLARE_CRON_UNAVAILABLE",
    ),
    nonSecretBindingNames: sanitizeObservation(
      facts.nonSecretBindingNames,
      (item) => parseSafeStringList(item, /^[A-Za-z0-9._-]{1,128}$/),
      "CLOUDFLARE_BINDINGS_UNAVAILABLE",
    ),
    secretNames: sanitizeObservation(
      facts.secretNames,
      (item) => parseSafeStringList(item, /^[A-Za-z0-9._-]{1,128}$/),
      "CLOUDFLARE_SECRET_NAMES_UNAVAILABLE",
    ),
    currentRelease: sanitizeObservation(
      facts.currentRelease,
      parseSafeRelease,
      "CLOUDFLARE_RELEASE_UNAVAILABLE",
    ),
    priorVersion: sanitizeObservation(
      facts.priorVersion,
      parseSafePriorVersion,
      "CLOUDFLARE_PRIOR_VERSION_UNAVAILABLE",
    ),
    hostname: sanitizeObservation(
      facts.hostname,
      parseSafeText,
      "CLOUDFLARE_HOSTNAME_UNAVAILABLE",
    ),
  };
}

const STRUCTURED_OPERATION_ORDER = [
  "CURRENT_DEPLOYMENT",
  "WORKER_SETTINGS",
  "CRON_SCHEDULES",
  "DEPLOYABLE_VERSIONS",
  "VERSION",
  "WORKER_SUBDOMAIN",
  "ACCOUNT_SUBDOMAIN",
] as const;

function parseCurrentDeployment(value: unknown) {
  if (!isRecord(value)) return undefined;
  const deploymentId = parseSafeIdentifier(value.deploymentId);
  if (!deploymentId || !Array.isArray(value.versions) || value.versions.length > 128) return undefined;
  const versions: Array<{ providerVersionId: string; percentage: number }> = [];
  const ids = new Set<string>();
  for (const entry of value.versions) {
    if (!isRecord(entry)) return undefined;
    const providerVersionId = parseSafeIdentifier(entry.providerVersionId);
    if (!providerVersionId || ids.has(providerVersionId) || typeof entry.percentage !== "number"
      || !Number.isFinite(entry.percentage) || entry.percentage < 0 || entry.percentage > 100) return undefined;
    ids.add(providerVersionId);
    versions.push({ providerVersionId, percentage: entry.percentage });
  }
  return { deploymentId, versions };
}

function sanitizeStructuredObservations(
  value: unknown,
  expectedTarget: ReturnType<typeof createCloudflareWorkerInspectionTarget>,
): Vs005StructuredProviderObservationSnapshot {
  const facts = isRecord(value) ? value : {};
  const base = sanitizeReadOnlyFacts(facts);
  return {
    ...base,
    accountId: base.accountId.state === "OBSERVED_VALUE" && base.accountId.value !== expectedTarget.accountId
      ? unavailable("CLOUDFLARE_ACCOUNT_UNAVAILABLE")
      : base.accountId,
    workerName: base.workerName.state === "OBSERVED_VALUE" && base.workerName.value !== expectedTarget.workerName
      ? unavailable("CLOUDFLARE_WORKER_UNAVAILABLE")
      : base.workerName,
    currentDeployment: sanitizeObservation(
      facts.currentDeployment,
      parseCurrentDeployment,
      "CLOUDFLARE_CURRENT_DEPLOYMENT_UNAVAILABLE",
    ),
    workersDevEnabled: sanitizeObservation(
      facts.workersDevEnabled,
      parseSafeBoolean,
      "CLOUDFLARE_WORKERS_DEV_UNAVAILABLE",
    ),
    accountWorkersDevSubdomain: sanitizeObservation(
      facts.accountWorkersDevSubdomain,
      (item) => typeof item === "string" && /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(item)
        && item.length <= 63 ? item : undefined,
      "CLOUDFLARE_ACCOUNT_SUBDOMAIN_UNAVAILABLE",
    ),
  };
}

function sanitizeStructuredInspection(
  value: unknown,
  request: CloudflareStructuredInspectionRequest,
): Vs005CorrelatedProviderInspection {
  if (!isRecord(value) || !isRecord(value.correlation)) {
    throw new Error("CLOUDFLARE_STRUCTURED_INSPECTION_UNAVAILABLE");
  }
  const expectedTarget = createCloudflareWorkerInspectionTarget({
    config: request.config,
    generatedConfig: { wrangler: request.generatedConfig },
    profile: request.profile,
  });
  const correlation = value.correlation;
  const rawCompletedOperations = correlation.completedOperations;
  if (correlation.accountId !== expectedTarget.accountId
    || correlation.workerName !== expectedTarget.workerName
    || correlation.configFingerprint !== expectedTarget.configFingerprint
    || correlation.providerOrigin !== "api.cloudflare.com"
    || correlation.profile !== request.profile
    || !Array.isArray(rawCompletedOperations)
    || rawCompletedOperations.length > STRUCTURED_OPERATION_ORDER.length
    || !rawCompletedOperations.every((operation) => STRUCTURED_OPERATION_ORDER.includes(operation as never))) {
    throw new Error("CLOUDFLARE_STRUCTURED_CORRELATION_UNAVAILABLE");
  }
  const completedOperations = STRUCTURED_OPERATION_ORDER.filter((operation) => rawCompletedOperations.includes(operation));
  if (completedOperations.length !== rawCompletedOperations.length
    || completedOperations.some((operation, index) => operation !== rawCompletedOperations[index])) {
    throw new Error("CLOUDFLARE_STRUCTURED_CORRELATION_UNAVAILABLE");
  }
  if (typeof correlation.observedAt !== "string") throw new Error("CLOUDFLARE_STRUCTURED_CORRELATION_UNAVAILABLE");
  const observedAt = new Date(correlation.observedAt);
  if (!Number.isFinite(observedAt.getTime()) || observedAt.toISOString() !== correlation.observedAt) {
    throw new Error("CLOUDFLARE_STRUCTURED_CORRELATION_UNAVAILABLE");
  }
  return {
    correlation: {
      accountId: expectedTarget.accountId,
      workerName: expectedTarget.workerName,
      configFingerprint: expectedTarget.configFingerprint,
      providerOrigin: "api.cloudflare.com",
      profile: request.profile,
      completedOperations,
      observedAt: correlation.observedAt,
    },
    observations: sanitizeStructuredObservations(value.observations, expectedTarget),
  };
}

function unavailableReadOnlyFacts(code: string): CloudflareReadOnlyProviderFacts {
  return {
    accountId: unavailable(code),
    workerName: unavailable(code),
    workerExists: unavailable(code),
    workerConfigFingerprint: unavailable(code),
    cronSchedules: unavailable(code),
    nonSecretBindingNames: unavailable(code),
    secretNames: unavailable(code),
    currentRelease: unavailable(code),
    priorVersion: unavailable(code),
    hostname: unavailable(code),
  };
}

function legacyInspectionProjection(
  observations: CloudflareReadOnlyProviderFacts,
): Vs005DeploymentProviderInspection {
  return {
    accountId: observations.accountId.state === "OBSERVED_VALUE" ? observations.accountId.value : "",
    workerName: observations.workerName.state === "OBSERVED_VALUE" ? observations.workerName.value : "",
    workerExists: observations.workerExists.state === "OBSERVED_VALUE"
      ? observations.workerExists.value
      : false,
    configuredSecrets: observations.secretNames.state === "OBSERVED_VALUE"
      ? observations.secretNames.value
      : [],
    configFingerprint: observations.workerConfigFingerprint.state === "OBSERVED_VALUE"
      ? observations.workerConfigFingerprint.value
      : null,
    observations,
  };
}

function boundedIdentifier(value: string | undefined): string | undefined {
  if (!value || !/^[A-Za-z0-9._-]{1,128}$/.test(value)) return undefined;
  return value;
}

export interface CloudflareWorkerInspectionTarget {
  accountId: string;
  workerName: string;
  generatedWranglerPath: string;
}

export interface CloudflareWorkerReadOnlyRequest {
  target: CloudflareWorkerInspectionTarget;
  argv: readonly string[];
}

function boundedConfigPath(value: string | undefined): string | undefined {
  if (!value || value.length > 4096 || /[\0\r\n]/.test(value)) return undefined;
  return value;
}

export function buildCloudflareWorkerStatusInspectionRequest(input: {
  accountId: string;
  workerName: string;
  generatedWranglerPath: string;
  generatedConfig: Pick<
    GeneratedCloudflareDeployment["wrangler"],
    "account_id" | "name"
  >;
}): CloudflareWorkerReadOnlyRequest {
  const accountId = boundedIdentifier(input.accountId);
  const workerName = boundedIdentifier(input.workerName);
  const generatedWranglerPath = boundedConfigPath(input.generatedWranglerPath);
  const configuredAccountId = boundedIdentifier(input.generatedConfig.account_id);
  const configuredWorkerName = boundedIdentifier(input.generatedConfig.name);

  if (
    !accountId
    || !workerName
    || !generatedWranglerPath
    || configuredAccountId !== accountId
    || configuredWorkerName !== workerName
  ) {
    throw new Error("CLOUDFLARE_INSPECTION_TARGET_UNAVAILABLE");
  }

  return {
    target: { accountId, workerName, generatedWranglerPath },
    argv: [
      "wrangler",
      "deployments",
      "status",
      "--config",
      generatedWranglerPath,
      "--name",
      workerName,
      "--json",
    ],
  };
}

function parseDeploymentIdentifiers(stdout: string): {
  deploymentId: string;
  providerVersionId: string;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    parsed = undefined;
  }

  const record = typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {};
  const deploymentId = boundedIdentifier(
    typeof record.deployment_id === "string" ? record.deployment_id : undefined,
  ) ?? boundedIdentifier(stdout.match(/deployment_id\s*[:=]\s*([A-Za-z0-9._-]{1,128})/)?.[1]);
  const providerVersionId = boundedIdentifier(
    typeof record.version_id === "string" ? record.version_id : undefined,
  ) ?? boundedIdentifier(stdout.match(/version_id\s*[:=]\s*([A-Za-z0-9._-]{1,128})/)?.[1]);

  if (!deploymentId || !providerVersionId) {
    throw new Error("CLOUDFLARE_DEPLOYMENT_IDENTIFIERS_UNAVAILABLE");
  }
  return { deploymentId, providerVersionId };
}

export async function inspectCloudflareAccountMembership(input: {
  expectedAccountId: string;
  runWrangler: CloudflareDeploymentProviderIo["runWrangler"];
}): Promise<Vs005Observation<string>> {
  let identity: { exitCode: number; stdout: string };
  try {
    identity = await input.runWrangler(["wrangler", "whoami", "--json"]);
  } catch {
    return unavailable("CLOUDFLARE_AUTH_UNAVAILABLE");
  }
  if (identity.exitCode !== 0) {
    return unavailable("CLOUDFLARE_AUTH_UNAVAILABLE");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(identity.stdout);
  } catch {
    return unavailable("CLOUDFLARE_ACCOUNT_UNAVAILABLE");
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.accounts)) {
    return unavailable("CLOUDFLARE_ACCOUNT_UNAVAILABLE");
  }

  const expectedAccountId = boundedIdentifier(input.expectedAccountId);
  if (!expectedAccountId) {
    return unavailable("CLOUDFLARE_ACCOUNT_UNAVAILABLE");
  }
  const expectedMembershipExists = parsed.accounts.some((account) => (
    isRecord(account)
    && typeof account.id === "string"
    && boundedIdentifier(account.id) === expectedAccountId
  ));
  return expectedMembershipExists
    ? observedValue(expectedAccountId)
    : unavailable("CLOUDFLARE_ACCOUNT_UNAVAILABLE");
}

function parseRollbackIdentifiers(stdout: string): {
  deploymentId: string;
  activeProviderVersionId: string;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    parsed = undefined;
  }
  const record = typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {};
  const deploymentId = boundedIdentifier(
    typeof record.deployment_id === "string" ? record.deployment_id : undefined,
  ) ?? boundedIdentifier(stdout.match(/deployment_id\s*[:=]\s*([A-Za-z0-9._-]{1,128})/)?.[1]);
  const activeProviderVersionId = boundedIdentifier(
    typeof record.active_provider_version_id === "string"
      ? record.active_provider_version_id
      : typeof record.version_id === "string" ? record.version_id : undefined,
  ) ?? boundedIdentifier(stdout.match(/(?:active_)?(?:provider_)?version_id\s*[:=]\s*([A-Za-z0-9._-]{1,128})/)?.[1]);
  if (!deploymentId || !activeProviderVersionId) {
    throw new Error("CLOUDFLARE_ROLLBACK_IDENTIFIERS_UNAVAILABLE");
  }
  return { deploymentId, activeProviderVersionId };
}

export function createCloudflareDeploymentProvider(
  io: CloudflareDeploymentProviderIo,
  rollbackTarget?: { workerName?: string },
): Omit<Vs005DeploymentProvider, "inspect"> & Vs005RollbackProvider & {
  inspectStructured(input: CloudflareStructuredInspectionRequest): Promise<Vs005CorrelatedProviderInspection>;
} {
  return {
    async inspectStructured(input) {
      try {
        return sanitizeStructuredInspection(await io.inspectReadOnly(input), input);
      } catch {
        throw new Error("CLOUDFLARE_STRUCTURED_INSPECTION_UNAVAILABLE");
      }
    },

    async deploy(input) {
      let temporaryPath: string | undefined;
      try {
        const args = ["wrangler", "deploy", "--config", input.generatedWranglerPath];
        if (input.bootstrapSecrets) {
          temporaryPath = await io.createTemporarySecretFile(
            JSON.stringify({
              [input.config.supabase.secretKeySecretRef]: input.bootstrapSecrets.supabaseSecretKey,
            }),
            0o600,
          );
          args.push("--secrets-file", temporaryPath);
        }

        const result = await io.runWrangler(
          args,
          withoutCloudflareInspectionCredential(input.childEnvironment ?? io.environment ?? process.env),
        );
        if (result.exitCode !== 0) throw new Error("CLOUDFLARE_DEPLOYMENT_FAILED");
        return parseDeploymentIdentifiers(result.stdout);
      } finally {
        if (temporaryPath) await io.deleteFile(temporaryPath);
      }
    },

    async rollback(providerVersionId: string) {
      let result: { exitCode: number; stdout: string };
      try {
        result = await io.runWrangler(
          ["wrangler", "rollback", providerVersionId, "--yes"],
          withoutCloudflareInspectionCredential(io.environment ?? process.env),
        );
      } catch {
        throw new Error("CLOUDFLARE_ROLLBACK_FAILED");
      }
      if (result.exitCode !== 0) throw new Error("CLOUDFLARE_ROLLBACK_FAILED");
      return parseRollbackIdentifiers(result.stdout);
    },
  };
}

export async function inspectCloudflareLegacyReadOnlyNonAuthoritative(
  io: CloudflareDeploymentProviderIo,
  config: CadenceRuntimeConfig,
): Promise<Vs005DeploymentProviderInspection> {
  if (!config.cloudflare) {
    return legacyInspectionProjection(unavailableReadOnlyFacts("CLOUDFLARE_TARGET_UNAVAILABLE"));
  }
  if (!io.inspectLegacyReadOnly) {
    return legacyInspectionProjection(unavailableReadOnlyFacts("CLOUDFLARE_STRUCTURED_INSPECTION_REQUIRED"));
  }
  try {
    const facts = await io.inspectLegacyReadOnly({
      accountId: config.cloudflare.accountId,
      workerName: config.cloudflare.workerName,
    });
    return legacyInspectionProjection(sanitizeReadOnlyFacts(facts));
  } catch {
    return legacyInspectionProjection(unavailableReadOnlyFacts("CLOUDFLARE_INSPECTION_UNAVAILABLE"));
  }
}

function runWrangler(
  args: readonly string[],
  childEnvironment?: NodeJS.ProcessEnv,
): Promise<{ exitCode: number; stdout: string }> {
  return new Promise((resolve) => {
    const [command, ...commandArgs] = args;
    const child = spawn(command, commandArgs, {
      shell: false,
      windowsHide: true,
      ...(childEnvironment ? { env: childEnvironment } : {}),
    });
    let stdout = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.on("close", (exitCode) => resolve({ exitCode: exitCode ?? 1, stdout }));
    child.on("error", () => resolve({ exitCode: 1, stdout }));
  });
}

export function createDefaultCloudflareProviderIo(input: {
  credentialProvider?: CloudflareCredentialProvider;
  fetchImpl?: typeof fetch;
  clock?: () => Date;
  runWrangler?: CloudflareDeploymentProviderIo["runWrangler"];
} = {}): CloudflareDeploymentProviderIo {
  const transport = createCloudflareReadOnlyTransport({
    credentialProvider: input.credentialProvider
      ?? createEnvironmentCloudflareCredentialProvider(process.env),
    fetchImpl: input.fetchImpl,
  });
  const structuredProvider = createCloudflareStructuredReadOnlyProvider(transport);
  return {
    environment: process.env,
    async createTemporarySecretFile(content, mode) {
      const directory = join(tmpdir(), "cadence-vs005-secret");
      await mkdir(directory, { recursive: true });
      const path = join(directory, `secret-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
      const handle = await open(path, "wx", mode);
      try {
        await handle.writeFile(content, "utf8");
        await chmod(path, mode);
      } finally {
        await handle.close();
      }
      return path;
    },
    deleteFile: async (path) => {
      await rm(path, { force: true });
    },
    runWrangler: input.runWrangler ?? runWrangler,
    inspectReadOnly: (request) => inspectCloudflareReadOnly(
      structuredProvider,
      request,
      input.clock ?? (() => new Date()),
    ),
  };
}

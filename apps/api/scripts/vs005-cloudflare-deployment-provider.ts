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
  type Vs005ProviderObservationSnapshot,
} from "./vs005-provider-observations";
import type { Vs005RollbackProvider } from "./vs005-rollback";

export interface CloudflareReadOnlyProviderFacts extends Vs005ProviderObservationSnapshot {}

export interface CloudflareDeploymentProviderIo {
  createTemporarySecretFile(content: string, mode: number): Promise<string>;
  deleteFile(path: string): Promise<void>;
  runWrangler(args: readonly string[]): Promise<{ exitCode: number; stdout: string }>;
  inspectReadOnly(input: {
    accountId: string;
    workerName: string;
  }): Promise<CloudflareReadOnlyProviderFacts>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function parseAccountId(stdout: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    parsed = undefined;
  }
  const record = typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {};
  const accountId = typeof record.account_id === "string"
    ? record.account_id
    : stdout.match(/account[_-]?id\s*[:=]\s*([A-Za-z0-9_-]{1,128})/)?.[1];
  if (!accountId || !/^[A-Za-z0-9_-]{1,128}$/.test(accountId)) {
    throw new Error("CLOUDFLARE_ACCOUNT_UNAVAILABLE");
  }
  return accountId;
}

function parseWorkerName(stdout: string, expectedWorkerName?: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    parsed = undefined;
  }
  const record = typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {};
  const workerName = expectedWorkerName
    ?? (typeof record.worker_name === "string" ? record.worker_name : undefined)
    ?? (typeof record.workerName === "string" ? record.workerName : undefined)
    ?? stdout.match(/worker[_-]?name\s*[:=]\s*([A-Za-z0-9._-]{1,128})/)?.[1];
  if (!workerName || !/^[A-Za-z0-9._-]{1,128}$/.test(workerName)) {
    throw new Error("CLOUDFLARE_WORKER_UNAVAILABLE");
  }
  return workerName;
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
): Vs005DeploymentProvider & Vs005RollbackProvider {
  return {
    async inspect(config: CadenceRuntimeConfig): Promise<Vs005DeploymentProviderInspection> {
      if (!config.cloudflare) {
        return legacyInspectionProjection(unavailableReadOnlyFacts("CLOUDFLARE_TARGET_UNAVAILABLE"));
      }

      try {
        const facts = await io.inspectReadOnly({
          accountId: config.cloudflare.accountId,
          workerName: config.cloudflare.workerName,
        });
        return legacyInspectionProjection(sanitizeReadOnlyFacts(facts));
      } catch {
        return legacyInspectionProjection(unavailableReadOnlyFacts("CLOUDFLARE_INSPECTION_UNAVAILABLE"));
      }
    },

    async inspectTarget(input?: { accountId: string; workerName: string }) {
      if (input) {
        try {
          const facts = await io.inspectReadOnly(input);
          return { observations: sanitizeReadOnlyFacts(facts) };
        } catch {
          return { observations: unavailableReadOnlyFacts("CLOUDFLARE_INSPECTION_UNAVAILABLE") };
        }
      }
      const identity = await io.runWrangler(["wrangler", "whoami", "--json"]);
      if (identity.exitCode !== 0) throw new Error("CLOUDFLARE_AUTH_UNAVAILABLE");
      return {
        accountId: parseAccountId(identity.stdout),
        workerName: parseWorkerName(identity.stdout, rollbackTarget?.workerName),
      };
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

        const result = await io.runWrangler(args);
        if (result.exitCode !== 0) throw new Error("CLOUDFLARE_DEPLOYMENT_FAILED");
        return parseDeploymentIdentifiers(result.stdout);
      } finally {
        if (temporaryPath) await io.deleteFile(temporaryPath);
      }
    },

    async rollback(providerVersionId: string) {
      let result: { exitCode: number; stdout: string };
      try {
        result = await io.runWrangler(["wrangler", "rollback", providerVersionId, "--yes"]);
      } catch {
        throw new Error("CLOUDFLARE_ROLLBACK_FAILED");
      }
      if (result.exitCode !== 0) throw new Error("CLOUDFLARE_ROLLBACK_FAILED");
      return parseRollbackIdentifiers(result.stdout);
    },
  };
}

function runWrangler(args: readonly string[]): Promise<{ exitCode: number; stdout: string }> {
  return new Promise((resolve) => {
    const [command, ...commandArgs] = args;
    const child = spawn(command, commandArgs, { shell: false, windowsHide: true });
    let stdout = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.on("close", (exitCode) => resolve({ exitCode: exitCode ?? 1, stdout }));
    child.on("error", () => resolve({ exitCode: 1, stdout }));
  });
}

export function createDefaultCloudflareProviderIo(): CloudflareDeploymentProviderIo {
  return {
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
    runWrangler,
    async inspectReadOnly() {
      try {
        const identity = await runWrangler(["wrangler", "whoami", "--json"]);
        if (identity.exitCode !== 0) return unavailableReadOnlyFacts("CLOUDFLARE_AUTH_UNAVAILABLE");
        return sanitizeReadOnlyFacts({
          accountId: { state: "OBSERVED_VALUE", value: parseAccountId(identity.stdout) },
          workerName: { state: "UNAVAILABLE" },
          workerExists: { state: "UNAVAILABLE" },
          workerConfigFingerprint: { state: "UNAVAILABLE" },
          cronSchedules: { state: "UNAVAILABLE" },
          nonSecretBindingNames: { state: "UNAVAILABLE" },
          secretNames: { state: "UNAVAILABLE" },
          currentRelease: { state: "UNAVAILABLE" },
          priorVersion: { state: "UNAVAILABLE" },
          hostname: { state: "UNAVAILABLE" },
        });
      } catch {
        return unavailableReadOnlyFacts("CLOUDFLARE_AUTH_UNAVAILABLE");
      }
    },
  };
}

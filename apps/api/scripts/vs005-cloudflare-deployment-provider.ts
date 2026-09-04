import { chmod, mkdir, open, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

import type { CadenceRuntimeConfig } from "../src/bootstrap/cadence-config";
import {
  type Vs005DeploymentProvider,
  type Vs005DeploymentProviderInspection,
} from "./vs005-deploy-apply";

export interface CloudflareDeploymentProviderIo {
  createTemporarySecretFile(content: string, mode: number): Promise<string>;
  deleteFile(path: string): Promise<void>;
  runWrangler(args: readonly string[]): Promise<{ exitCode: number; stdout: string }>;
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

export function createCloudflareDeploymentProvider(
  io: CloudflareDeploymentProviderIo,
): Vs005DeploymentProvider {
  return {
    async inspect(config: CadenceRuntimeConfig): Promise<Vs005DeploymentProviderInspection> {
      const identity = await io.runWrangler(["wrangler", "whoami", "--json"]);
      if (identity.exitCode !== 0) throw new Error("CLOUDFLARE_AUTH_UNAVAILABLE");
      return {
        accountId: parseAccountId(identity.stdout),
        workerName: `cadence-${config.application.environment}`,
        workerExists: false,
        configuredSecrets: [],
        configFingerprint: null,
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
  };
}

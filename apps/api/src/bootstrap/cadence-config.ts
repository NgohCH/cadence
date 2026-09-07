import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import Ajv from "ajv";

import { CADENCE_RUNTIME_CONFIG_SCHEMA } from "./cadence-config-schema";
import { validateCadenceEnvironmentSafety } from "./environment-safety";

export type CadenceEnvironment = "local" | "qa" | "beta";
export type CadenceRuntimeProvider = "node" | "cloudflare";

export interface CadenceCloudflareTarget {
  accountId: string;
  workerName: string;
}

export interface CadenceRuntimeConfig {
  configVersion: 1;
  application: {
    name: "cadence";
    environment: CadenceEnvironment;
    publicUrl: string;
    apiBaseUrl: string;
    requestBodyLimitBytes: number;
  };
  runtime: {
    provider: CadenceRuntimeProvider;
  };
  cloudflare?: CadenceCloudflareTarget;
  supabase: {
    url: string;
    projectRef: string | null;
    publishableKey: string;
    secretKeySecretRef: string;
  };
  pilot: {
    projectId: string;
    safeTargetMarker: string;
  };
  worker: {
    schedule: string;
    maxRounds: number;
    maxDeliveryAttempts: number;
    maxMembershipExpiryAttempts: number;
    softDeadlineSeconds: number;
  };
  retry: {
    delaysSeconds: readonly number[];
  };
}

export interface CadenceResolvedSecrets {
  supabaseSecretKey: string;
}

const validateSchema = new Ajv({ allErrors: true }).compile<CadenceRuntimeConfig>(
  CADENCE_RUNTIME_CONFIG_SCHEMA,
);

export function loadCadenceRuntimeConfig(path: string): CadenceRuntimeConfig {
  let parsed: unknown;

  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to load Cadence runtime config from ${path}: ${message}`);
  }

  return validateCadenceRuntimeConfig(parsed);
}

export function validateCadenceRuntimeConfig(value: unknown): CadenceRuntimeConfig {
  if (!validateSchema(value)) {
    const details = validateSchema.errors
      ?.map((error) => `${error.instancePath || "/"} ${error.message}`)
      .join("; ");
    throw new Error(`Cadence runtime configuration is invalid: ${details ?? "schema validation failed"}`);
  }

  const config = value as CadenceRuntimeConfig;
  validateSemanticConfiguration(config);
  const safety = validateCadenceEnvironmentSafety({
    cadenceEnv: config.application.environment,
    supabaseUrl: config.supabase.url,
    supabaseProjectRef: config.supabase.projectRef ?? undefined,
  });

  return Object.freeze({
    ...config,
    application: Object.freeze({
      ...config.application,
      environment: safety.cadenceEnv,
    }),
    supabase: Object.freeze({
      ...config.supabase,
      url: safety.supabaseUrl,
      projectRef: safety.supabaseProjectRef,
    }),
    cloudflare: config.cloudflare
      ? Object.freeze({ ...config.cloudflare })
      : undefined,
  });
}

export function fingerprintCadenceRuntimeConfig(config: CadenceRuntimeConfig): string {
  const canonical = {
    configVersion: config.configVersion,
    application: {
      name: config.application.name,
      environment: config.application.environment,
      publicUrl: config.application.publicUrl,
      apiBaseUrl: config.application.apiBaseUrl,
      requestBodyLimitBytes: config.application.requestBodyLimitBytes,
    },
    runtime: {
      provider: config.runtime.provider,
    },
    cloudflare: config.cloudflare
      ? {
        accountId: config.cloudflare.accountId,
        workerName: config.cloudflare.workerName,
      }
      : null,
    supabase: {
      url: config.supabase.url,
      projectRef: config.supabase.projectRef,
      publishableKey: config.supabase.publishableKey,
      secretKeySecretRef: config.supabase.secretKeySecretRef,
    },
    pilot: {
      projectId: config.pilot.projectId,
      safeTargetMarker: config.pilot.safeTargetMarker,
    },
    worker: {
      schedule: config.worker.schedule,
      maxRounds: config.worker.maxRounds,
      maxDeliveryAttempts: config.worker.maxDeliveryAttempts,
      maxMembershipExpiryAttempts: config.worker.maxMembershipExpiryAttempts,
      softDeadlineSeconds: config.worker.softDeadlineSeconds,
    },
    retry: {
      delaysSeconds: [...config.retry.delaysSeconds],
    },
  };

  return createHash("sha256")
    .update(JSON.stringify(canonical), "utf8")
    .digest("hex");
}

export function resolveCadenceConfigPath(input: {
  argv: readonly string[];
  environment: Readonly<Record<string, string | undefined>>;
}): string {
  const configIndex = input.argv.indexOf("--config");
  const configArgument = configIndex >= 0 ? input.argv[configIndex + 1] : undefined;
  const inlineConfigArgument = input.argv.find((argument) => argument.startsWith("--config="));
  const selected = inlineConfigArgument?.slice("--config=".length)
    ?? configArgument
    ?? input.environment.CADENCE_CONFIG_PATH;

  if (!selected?.trim()) {
    throw new Error("Cadence config path is required");
  }

  return selected.trim();
}

export function resolveCadenceSecrets(
  config: CadenceRuntimeConfig,
  source: Readonly<Record<string, string | undefined>>,
): CadenceResolvedSecrets {
  const secret = source[config.supabase.secretKeySecretRef]?.trim();
  if (!secret) {
    throw new Error(`Configured secret ${config.supabase.secretKeySecretRef} is required`);
  }

  return { supabaseSecretKey: secret };
}

function validateSemanticConfiguration(config: CadenceRuntimeConfig): void {
  if (config.runtime.provider === "cloudflare") {
    if (!config.cloudflare) {
      throw new Error("cloudflare target is required for the Cloudflare provider");
    }
    validateCloudflareIdentifier(config.cloudflare.accountId, "cloudflare.accountId");
    validateCloudflareIdentifier(config.cloudflare.workerName, "cloudflare.workerName");
  }

  const publicUrl = parseHttpUrl(config.application.publicUrl, "application.publicUrl");
  if (publicUrl.pathname !== "/" || publicUrl.search || publicUrl.hash) {
    throw new Error("application.publicUrl must be an origin URL with no path, query, or fragment");
  }

  const supabaseUrl = parseHttpUrl(config.supabase.url, "supabase.url");
  if (config.application.environment === "local") {
    const isLoopback = supabaseUrl.hostname === "127.0.0.1" || supabaseUrl.hostname === "localhost";
    if (supabaseUrl.protocol !== "http:" || !isLoopback || supabaseUrl.port !== "54321") {
      throw new Error("local environment requires a loopback Supabase URL on port 54321");
    }
    if (config.supabase.projectRef !== null) {
      throw new Error("local environment requires a null Supabase project reference");
    }
  } else {
    const projectRef = config.supabase.projectRef;
    if (!projectRef || supabaseUrl.protocol !== "https:" || supabaseUrl.hostname !== `${projectRef}.supabase.co`) {
      throw new Error("Supabase project reference does not match the configured hosted URL");
    }
  }

  if (config.application.environment === "beta"
    && config.runtime.provider === "cloudflare"
    && config.application.apiBaseUrl !== "") {
    throw new Error("hosted Cloudflare Beta apiBaseUrl must be empty for same-origin API access");
  }

  if (config.application.apiBaseUrl !== ""
    && config.application.apiBaseUrl !== "http://127.0.0.1:3000") {
    throw new Error("apiBaseUrl must be empty or the approved local Node loopback origin");
  }

  if (config.pilot.safeTargetMarker.trim() !== config.pilot.safeTargetMarker) {
    throw new Error("pilot.safeTargetMarker must be a nonblank safe target marker");
  }

  if (config.supabase.secretKeySecretRef.trim() !== config.supabase.secretKeySecretRef) {
    throw new Error("supabase.secretKeySecretRef must be a nonblank secret reference");
  }

  for (let index = 1; index < config.retry.delaysSeconds.length; index += 1) {
    if (config.retry.delaysSeconds[index] < config.retry.delaysSeconds[index - 1]) {
      throw new Error("retry.delaysSeconds must be nondecreasing");
    }
  }
}

function validateCloudflareIdentifier(value: string, field: string): void {
  if (value.trim() !== value || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) {
    throw new Error(`${field} must be a nonblank safe identifier`);
  }
}

function parseHttpUrl(value: string, field: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${field} must be a valid URL`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${field} must be a valid HTTP(S) URL`);
  }
  return parsed;
}

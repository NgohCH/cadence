import {
  fingerprintCadenceRuntimeConfig,
  type CadenceRuntimeConfig,
} from "../src/bootstrap/cadence-config";
import type { GeneratedCloudflareDeployment } from "./vs005-generate-deployment";
import type {
  Vs005CloudflareOperationName,
  Vs005ProviderInspectionProfile,
} from "./vs005-provider-observations";

export type {
  Vs005CloudflareOperationName,
  Vs005ProviderInspectionProfile,
} from "./vs005-provider-observations";

const CLOUDFLARE_API_ORIGIN = "https://api.cloudflare.com/client/v4" as const;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 1_048_576;

export interface CloudflareCredentialProvider {
  getCredential(): Promise<string>;
}

export interface CloudflareWorkerInspectionTarget {
  accountId: string;
  workerName: string;
  publicHostname: string;
  configFingerprint: string;
  generatedAccountId: string;
  generatedWorkerName: string;
  profile: Vs005ProviderInspectionProfile;
}

type CloudflareReadOnlyRoute =
  | { operation: "CURRENT_DEPLOYMENT"; target: CloudflareWorkerInspectionTarget }
  | { operation: "WORKER_SETTINGS"; target: CloudflareWorkerInspectionTarget }
  | { operation: "CRON_SCHEDULES"; target: CloudflareWorkerInspectionTarget }
  | { operation: "DEPLOYABLE_VERSIONS"; target: CloudflareWorkerInspectionTarget }
  | { operation: "VERSION"; target: CloudflareWorkerInspectionTarget; versionId: string }
  | { operation: "WORKER_SUBDOMAIN"; target: CloudflareWorkerInspectionTarget }
  | { operation: "ACCOUNT_SUBDOMAIN"; target: CloudflareWorkerInspectionTarget };

export type CloudflareInspectionFailureKind =
  | "WORKER_NOT_FOUND"
  | "AUTHENTICATION_FAILED"
  | "AUTHORIZATION_FAILED"
  | "NETWORK_UNAVAILABLE"
  | "TLS_UNAVAILABLE"
  | "TIMEOUT"
  | "MALFORMED_RESPONSE"
  | "UNEXPECTED_PROVIDER_ERROR"
  | "TARGET_BINDING_MISMATCH";

export type CloudflareReadOnlyTransportResult =
  | { kind: "SUCCESS"; operation: Vs005CloudflareOperationName; result: unknown }
  | { kind: "PROVIDER_FAILURE"; operation: Vs005CloudflareOperationName; errorCodes: readonly number[]; errorsWellFormed: boolean }
  | { kind: "UNAVAILABLE"; failure: { operation: Vs005CloudflareOperationName; kind: Exclude<CloudflareInspectionFailureKind, "WORKER_NOT_FOUND"> } };

export interface CloudflareReadOnlyTransport {
  read(route: CloudflareReadOnlyRoute): Promise<CloudflareReadOnlyTransportResult>;
}

export function createEnvironmentCloudflareCredentialProvider(
  environment: Readonly<Record<string, string | undefined>>,
): CloudflareCredentialProvider {
  return {
    async getCredential(): Promise<string> {
      const credential = environment.CLOUDFLARE_INSPECTION_API_TOKEN?.trim();
      if (!credential) throw new Error("Cloudflare inspection credential is unavailable");
      return credential;
    },
  };
}

export function createCloudflareWorkerInspectionTarget(input: {
  config: CadenceRuntimeConfig;
  generatedConfig: GeneratedCloudflareDeployment;
  profile: Vs005ProviderInspectionProfile;
}): CloudflareWorkerInspectionTarget {
  const canonical = input.config.cloudflare;
  const generated = input.generatedConfig.wrangler;
  const configFingerprint = fingerprintCadenceRuntimeConfig(input.config);
  if (!canonical || canonical.accountId !== generated.account_id || canonical.workerName !== generated.name
    || generated.vars.CADENCE_CONFIG_FINGERPRINT !== configFingerprint) {
    throw new Error("Cloudflare target binding mismatch");
  }
  const publicUrl = new URL(input.config.application.publicUrl);
  return {
    accountId: canonical.accountId,
    workerName: canonical.workerName,
    publicHostname: publicUrl.hostname,
    configFingerprint,
    generatedAccountId: generated.account_id,
    generatedWorkerName: generated.name,
    profile: input.profile,
  };
}

export function createCloudflareReadOnlyTransport(input: {
  credentialProvider: CloudflareCredentialProvider;
  fetchImpl?: typeof fetch;
  clock?: () => Date;
}): CloudflareReadOnlyTransport {
  const fetchImpl = input.fetchImpl ?? fetch;
  return {
    async read(route): Promise<CloudflareReadOnlyTransportResult> {
      const operation = route.operation;
      if (route.target.accountId !== route.target.generatedAccountId
        || route.target.workerName !== route.target.generatedWorkerName) {
        throw new Error("Cloudflare target binding mismatch");
      }

      let credential: string;
      try {
        credential = await input.credentialProvider.getCredential();
      } catch {
        return unavailable(operation, "AUTHENTICATION_FAILED");
      }
      const url = routeUrl(route);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetchImpl(url, {
          method: "GET",
          headers: { Authorization: `Bearer ${credential}` },
          redirect: "manual",
          signal: controller.signal,
        });
      } catch (error) {
        clearTimeout(timeout);
        return unavailable(operation, isTimeout(error)
          ? "TIMEOUT"
          : isTlsFailure(error) ? "TLS_UNAVAILABLE" : "NETWORK_UNAVAILABLE");
      }
      clearTimeout(timeout);

      if (response.status >= 300 && response.status < 400) return unavailable(operation, "UNEXPECTED_PROVIDER_ERROR");
      if (response.status === 401) return unavailable(operation, "AUTHENTICATION_FAILED");
      if (response.status === 403) return unavailable(operation, "AUTHORIZATION_FAILED");
      if (response.status < 200 || response.status >= 300) return unavailable(operation, "UNEXPECTED_PROVIDER_ERROR");

      const body = await readBodyWithinLimit(response);
      if (!body.ok) return unavailable(operation, "MALFORMED_RESPONSE");
      let parsed: unknown;
      try { parsed = JSON.parse(body.text); } catch { return unavailable(operation, "MALFORMED_RESPONSE"); }
      if (!isRecord(parsed) || typeof parsed.success !== "boolean") return unavailable(operation, "MALFORMED_RESPONSE");
      if (parsed.success === true && "result" in parsed) return { kind: "SUCCESS", operation, result: parsed.result };
      if (parsed.success === false && Array.isArray(parsed.errors)) {
        const errorCodes = parsed.errors.map((entry) => isRecord(entry) && typeof entry.code === "number" ? entry.code : undefined);
        return { kind: "PROVIDER_FAILURE", operation, errorCodes: errorCodes.filter((code): code is number => code !== undefined), errorsWellFormed: errorCodes.every((code) => code !== undefined) && parsed.errors.length > 0 };
      }
      return unavailable(operation, "MALFORMED_RESPONSE");
    },
  };
}

function routeUrl(route: CloudflareReadOnlyRoute): string {
  const account = encodeURIComponent(route.target.accountId);
  const worker = encodeURIComponent(route.target.workerName);
  const base = `${CLOUDFLARE_API_ORIGIN}/accounts/${account}`;
  switch (route.operation) {
    case "CURRENT_DEPLOYMENT": return `${base}/workers/scripts/${worker}/deployments`;
    case "WORKER_SETTINGS": return `${base}/workers/scripts/${worker}/settings`;
    case "CRON_SCHEDULES": return `${base}/workers/scripts/${worker}/schedules`;
    case "DEPLOYABLE_VERSIONS": return `${base}/workers/scripts/${worker}/versions?deployable=true`;
    case "VERSION": return `${base}/workers/scripts/${worker}/versions/${encodeURIComponent(route.versionId)}`;
    case "WORKER_SUBDOMAIN": return `${base}/workers/scripts/${worker}/subdomain`;
    case "ACCOUNT_SUBDOMAIN": return `${base}/workers/subdomain`;
  }
}

async function readBodyWithinLimit(response: Response): Promise<{ ok: true; text: string } | { ok: false }> {
  const length = response.headers.get("content-length");
  if (length && /^\d+$/.test(length) && Number(length) > MAX_RESPONSE_BYTES) return { ok: false };
  if (!response.body) return { ok: false };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        return { ok: false };
      }
      chunks.push(next.value);
    }
  } catch {
    return { ok: false };
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return { ok: true, text: new TextDecoder().decode(bytes) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTimeout(error: unknown): boolean {
  return isRecord(error) && (error.name === "AbortError" || error.code === "ETIMEDOUT");
}

function isTlsFailure(error: unknown): boolean {
  return isRecord(error) && ["CERT_HAS_EXPIRED", "ERR_TLS_CERT_ALTNAME_INVALID", "DEPTH_ZERO_SELF_SIGNED_CERT"].includes(String(error.code));
}

function unavailable(operation: Vs005CloudflareOperationName, kind: Exclude<CloudflareInspectionFailureKind, "WORKER_NOT_FOUND">): CloudflareReadOnlyTransportResult {
  return { kind: "UNAVAILABLE", failure: { operation, kind } };
}

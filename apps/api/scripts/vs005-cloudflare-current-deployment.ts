import type {
  CloudflareReadOnlyTransport,
  CloudflareWorkerInspectionTarget,
} from "./vs005-cloudflare-readonly-transport";
import type {
  Vs005CurrentDeploymentIdentity,
  Vs005Observation,
} from "./vs005-provider-observations";

export interface CloudflareCurrentDeploymentFacts {
  workerExists: Vs005Observation<boolean>;
  currentDeployment: Vs005Observation<Vs005CurrentDeploymentIdentity>;
}

const WORKER_NOT_FOUND_CODES = new Set([10007, 10090]);
const MAX_DEPLOYMENTS = 128;
const MAX_VERSIONS = 128;

export async function inspectCurrentDeployment(
  transport: CloudflareReadOnlyTransport,
  target: CloudflareWorkerInspectionTarget,
): Promise<CloudflareCurrentDeploymentFacts> {
  const result = await transport.read({ operation: "CURRENT_DEPLOYMENT", target });
  if (result.kind === "PROVIDER_FAILURE") {
    const workerMissing = result.operation === "CURRENT_DEPLOYMENT"
      && result.errorsWellFormed
      && result.errorCodes.length > 0
      && result.errorCodes.every((code) => WORKER_NOT_FOUND_CODES.has(code));
    if (workerMissing) {
      return {
        workerExists: { state: "OBSERVED_ABSENT" },
        currentDeployment: { state: "OBSERVED_ABSENT" },
      };
    }
    return unavailableFacts("CURRENT_DEPLOYMENT_PROVIDER_FAILURE");
  }
  if (result.kind === "UNAVAILABLE" || result.operation !== "CURRENT_DEPLOYMENT") {
    return unavailableFacts("CURRENT_DEPLOYMENT_UNAVAILABLE");
  }
  if (!Array.isArray(result.result) || result.result.length > MAX_DEPLOYMENTS) {
    return unavailableFacts("CURRENT_DEPLOYMENT_MALFORMED");
  }
  if (result.result.length === 0) {
    return {
      workerExists: { state: "OBSERVED_VALUE", value: true },
      currentDeployment: { state: "OBSERVED_ABSENT" },
    };
  }

  const current = parseDeployment(result.result[0]);
  if (!current) return unavailableFacts("CURRENT_DEPLOYMENT_MALFORMED");
  return {
    workerExists: { state: "OBSERVED_VALUE", value: true },
    currentDeployment: { state: "OBSERVED_VALUE", value: current },
  };
}

function parseDeployment(value: unknown): Vs005CurrentDeploymentIdentity | undefined {
  if (!isRecord(value) || !boundedIdentifier(value.id) || !Array.isArray(value.versions)
    || value.versions.length === 0 || value.versions.length > MAX_VERSIONS) return undefined;
  const versions = value.versions.map(parseVersion);
  if (versions.some((version) => version === undefined)) return undefined;
  const boundedVersions = versions as Array<{ providerVersionId: string; percentage: number }>;
  const ids = new Set<string>();
  for (const version of boundedVersions) {
    if (ids.has(version.providerVersionId)) return undefined;
    ids.add(version.providerVersionId);
  }
  return { deploymentId: value.id, versions: boundedVersions };
}

function parseVersion(value: unknown): { providerVersionId: string; percentage: number } | undefined {
  if (!isRecord(value) || !boundedIdentifier(value.version_id) || typeof value.percentage !== "number"
    || !Number.isFinite(value.percentage) || value.percentage < 0 || value.percentage > 100) return undefined;
  return { providerVersionId: value.version_id, percentage: value.percentage };
}

function boundedIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9._-]{1,128}$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unavailableFacts(code: string): CloudflareCurrentDeploymentFacts {
  return {
    workerExists: { state: "UNAVAILABLE", code },
    currentDeployment: { state: "UNAVAILABLE", code },
  };
}

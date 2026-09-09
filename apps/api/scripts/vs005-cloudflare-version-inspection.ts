import type {
  CloudflareReadOnlyTransport,
  CloudflareWorkerInspectionTarget,
} from "./vs005-cloudflare-readonly-transport";
import {
  reduceCloudflareIdentityBindings,
} from "./vs005-cloudflare-worker-settings";
import type { Vs005Observation } from "./vs005-provider-observations";
import type { CadenceReleaseIdentity } from "../src/bootstrap/cadence-release";

export interface CloudflareVersionIdentity {
  providerVersionId: string;
  release: CadenceReleaseIdentity;
  configFingerprint: string;
}

const MAX_VERSIONS = 128;

export async function inspectDeployableVersions(
  transport: CloudflareReadOnlyTransport,
  target: CloudflareWorkerInspectionTarget,
): Promise<Vs005Observation<readonly string[]>> {
  const result = await transport.read({ operation: "DEPLOYABLE_VERSIONS", target });
  if (result.kind !== "SUCCESS" || result.operation !== "DEPLOYABLE_VERSIONS" || !isRecord(result.result)) return unavailable();
  if (result.result.complete === false
    || "page" in result.result
    || "cursor" in result.result
    || "per_page" in result.result
    || !Array.isArray(result.result.items)
    || result.result.items.length > MAX_VERSIONS) return unavailable();
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const item of result.result.items) {
    if (!isRecord(item) || !boundedIdentifier(item.id) || seen.has(item.id)) return unavailable();
    seen.add(item.id);
    ids.push(item.id);
  }
  return { state: "OBSERVED_VALUE", value: ids };
}

export async function inspectVersion(
  transport: CloudflareReadOnlyTransport,
  target: CloudflareWorkerInspectionTarget,
  versionId: string,
): Promise<Vs005Observation<CloudflareVersionIdentity>> {
  if (!boundedIdentifier(versionId)) return unavailable();
  const result = await transport.read({ operation: "VERSION", target, versionId });
  if (result.kind !== "SUCCESS" || result.operation !== "VERSION" || !isRecord(result.result)
    || result.result.id !== versionId || !Array.isArray(result.result.bindings)) return unavailable();
  const identity = reduceCloudflareIdentityBindings(result.result.bindings);
  if (identity.workerConfigFingerprint.state !== "OBSERVED_VALUE"
    || identity.currentRelease.state !== "OBSERVED_VALUE") return unavailable();
  return {
    state: "OBSERVED_VALUE",
    value: {
      providerVersionId: versionId,
      configFingerprint: identity.workerConfigFingerprint.value,
      release: identity.currentRelease.value,
    },
  };
}

function boundedIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9._-]{1,128}$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unavailable<T>(value?: never): Vs005Observation<T> {
  return { state: "UNAVAILABLE", code: "CLOUDFLARE_VERSION_UNAVAILABLE" };
}

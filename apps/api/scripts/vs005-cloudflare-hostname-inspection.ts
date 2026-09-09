import type {
  CloudflareReadOnlyTransport,
  CloudflareWorkerInspectionTarget,
} from "./vs005-cloudflare-readonly-transport";
import type { Vs005Observation } from "./vs005-provider-observations";

const MAX_SUBDOMAIN_LABEL_LENGTH = 63;
const UNAVAILABLE_CODE = "WORKERS_DEV_HOSTNAME_UNAVAILABLE";

export interface CloudflareHostnameFacts {
  workersDevEnabled: Vs005Observation<boolean>;
  accountWorkersDevSubdomain: Vs005Observation<string>;
  hostname: Vs005Observation<string>;
}

export async function inspectWorkersDevState(
  transport: CloudflareReadOnlyTransport,
  target: CloudflareWorkerInspectionTarget,
): Promise<Vs005Observation<boolean>> {
  const result = await transport.read({ operation: "WORKER_SUBDOMAIN", target });
  if (result.kind !== "SUCCESS" || result.operation !== "WORKER_SUBDOMAIN" || !isRecord(result.result)) {
    return unavailable();
  }
  if (typeof result.result.enabled !== "boolean") return unavailable();
  return result.result.enabled
    ? { state: "OBSERVED_VALUE", value: true }
    : { state: "OBSERVED_ABSENT" };
}

export async function inspectAccountWorkersDevSubdomain(
  transport: CloudflareReadOnlyTransport,
  target: CloudflareWorkerInspectionTarget,
): Promise<Vs005Observation<string>> {
  const result = await transport.read({ operation: "ACCOUNT_SUBDOMAIN", target });
  if (result.kind !== "SUCCESS" || result.operation !== "ACCOUNT_SUBDOMAIN" || !isRecord(result.result)) {
    return unavailable();
  }
  const subdomain = result.result.subdomain;
  if (!isBoundedSubdomainLabel(subdomain)) return unavailable();
  return { state: "OBSERVED_VALUE", value: subdomain };
}

export function correlateWorkersDevHostname(input: {
  target: CloudflareWorkerInspectionTarget;
  workersDevEnabled: Vs005Observation<boolean>;
  accountSubdomain: Vs005Observation<string>;
}): Vs005Observation<string> {
  if (input.workersDevEnabled.state === "OBSERVED_ABSENT") return { state: "OBSERVED_ABSENT" };
  if (input.workersDevEnabled.state !== "OBSERVED_VALUE" || !input.workersDevEnabled.value) return unavailable();
  if (input.accountSubdomain.state !== "OBSERVED_VALUE"
    || !isBoundedSubdomainLabel(input.accountSubdomain.value)) return unavailable();

  const expectedHostname = `${input.target.workerName}.${input.accountSubdomain.value}.workers.dev`;
  if (expectedHostname !== input.target.publicHostname) return unavailable();
  return { state: "OBSERVED_VALUE", value: input.target.publicHostname };
}

function isBoundedSubdomainLabel(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= MAX_SUBDOMAIN_LABEL_LENGTH
    && /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unavailable(): Vs005Observation<never> {
  return { state: "UNAVAILABLE", code: UNAVAILABLE_CODE };
}

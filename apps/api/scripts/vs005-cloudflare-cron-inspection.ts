import type {
  CloudflareReadOnlyTransport,
  CloudflareWorkerInspectionTarget,
} from "./vs005-cloudflare-readonly-transport";
import type { Vs005Observation } from "./vs005-provider-observations";

const MAX_SCHEDULES = 128;

export async function inspectCronSchedules(
  transport: CloudflareReadOnlyTransport,
  target: CloudflareWorkerInspectionTarget,
): Promise<Vs005Observation<readonly string[]>> {
  const result = await transport.read({ operation: "CRON_SCHEDULES", target });
  if (result.kind !== "SUCCESS" || result.operation !== "CRON_SCHEDULES" || !Array.isArray(result.result)) {
    return unavailable();
  }
  if (result.result.length === 0) return { state: "OBSERVED_ABSENT" };
  if (result.result.length > MAX_SCHEDULES) return unavailable();

  const schedules: string[] = [];
  const seen = new Set<string>();
  for (const entry of result.result) {
    if (!isRecord(entry) || !isCronExpression(entry.cron) || seen.has(entry.cron)) return unavailable();
    seen.add(entry.cron);
    schedules.push(entry.cron);
  }
  return { state: "OBSERVED_VALUE", value: schedules };
}

function isCronExpression(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 128 || /[\u0000-\u001f\u007f]/.test(value)) return false;
  const fields = value.split(" ");
  return fields.length === 5 && fields.every((field) => /^[A-Za-z0-9*/,?\-]+$/.test(field));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unavailable(): Vs005Observation<readonly string[]> {
  return { state: "UNAVAILABLE", code: "CRON_SCHEDULES_UNAVAILABLE" };
}

import { loadCadenceReleaseIdentity, type CadenceReleaseIdentity } from "../src/bootstrap/cadence-release";
import type {
  CloudflareReadOnlyTransport,
  CloudflareWorkerInspectionTarget,
} from "./vs005-cloudflare-readonly-transport";
import type { Vs005Observation } from "./vs005-provider-observations";

export interface CloudflareWorkerSettingsFacts {
  workerConfigFingerprint: Vs005Observation<string>;
  nonSecretBindingNames: Vs005Observation<readonly string[]>;
  secretNames: Vs005Observation<readonly string[]>;
  currentRelease: Vs005Observation<CadenceReleaseIdentity>;
}

export interface CloudflareIdentityBindingFacts {
  workerConfigFingerprint: Vs005Observation<string>;
  currentRelease: Vs005Observation<CadenceReleaseIdentity>;
}

const REQUIRED_SECRET_NAME = "SUPABASE_SECRET_KEY";
const IDENTITY_BINDINGS = new Set([
  "CADENCE_CONFIG_FINGERPRINT",
  "CADENCE_RELEASE_VERSION",
  "CADENCE_COMMIT_SHA",
  "CADENCE_BUILD_ID",
]);
const MAX_BINDINGS = 128;

export async function inspectWorkerSettings(
  transport: CloudflareReadOnlyTransport,
  target: CloudflareWorkerInspectionTarget,
): Promise<CloudflareWorkerSettingsFacts> {
  const result = await transport.read({ operation: "WORKER_SETTINGS", target });
  if (result.kind !== "SUCCESS" || result.operation !== "WORKER_SETTINGS" || !isRecord(result.result)) {
    return unavailableFacts("WORKER_SETTINGS_UNAVAILABLE");
  }
  const bindings = result.result.bindings;
  if (!Array.isArray(bindings) || bindings.length > MAX_BINDINGS || result.result.complete === false) {
    return unavailableFacts("WORKER_SETTINGS_INCOMPLETE");
  }

  const nonSecretNames: string[] = [];
  let requiredSecretCount = 0;
  let requiredSecretHasCorrectType = true;

  for (const binding of bindings) {
    if (!isRecord(binding) || !boundedName(binding.name) || typeof binding.type !== "string") {
      return unavailableFacts("WORKER_SETTINGS_MALFORMED");
    }
    if (binding.type !== "secret_text") nonSecretNames.push(binding.name);
    if (binding.name === REQUIRED_SECRET_NAME) {
      requiredSecretCount += 1;
      requiredSecretHasCorrectType = requiredSecretHasCorrectType && binding.type === "secret_text";
    }
  }

  const identityFacts = reduceCloudflareIdentityBindings(bindings);
  return {
    workerConfigFingerprint: identityFacts.workerConfigFingerprint,
    nonSecretBindingNames: { state: "OBSERVED_VALUE", value: nonSecretNames },
    secretNames: requiredSecretCount === 0
      ? { state: "OBSERVED_ABSENT" }
      : requiredSecretCount === 1 && requiredSecretHasCorrectType
        ? { state: "OBSERVED_VALUE", value: [REQUIRED_SECRET_NAME] }
        : unavailable("REQUIRED_SECRET_BINDING_UNAVAILABLE"),
    currentRelease: identityFacts.currentRelease,
  };
}

export function reduceCloudflareIdentityBindings(
  bindings: readonly unknown[],
): CloudflareIdentityBindingFacts {
  const identityValues = new Map<string, string>();
  const invalidIdentityNames = new Set<string>();
  for (const binding of bindings) {
    if (!isRecord(binding) || !boundedName(binding.name) || !IDENTITY_BINDINGS.has(binding.name)) continue;
    if (invalidIdentityNames.has(binding.name)
      || binding.type !== "plain_text"
      || typeof binding.text !== "string"
      || identityValues.has(binding.name)) {
      invalidIdentityNames.add(binding.name);
      identityValues.delete(binding.name);
      continue;
    }
    identityValues.set(binding.name, binding.text);
  }
  const workerConfigFingerprint = parseFingerprint(identityValues.get("CADENCE_CONFIG_FINGERPRINT"));
  const release = parseRelease(identityValues);
  return {
    workerConfigFingerprint: workerConfigFingerprint
      ? { state: "OBSERVED_VALUE", value: workerConfigFingerprint }
      : unavailable("WORKER_CONFIG_FINGERPRINT_UNAVAILABLE"),
    currentRelease: release
      ? { state: "OBSERVED_VALUE", value: release }
      : unavailable("CURRENT_RELEASE_UNAVAILABLE"),
  };
}

function parseFingerprint(value: string | undefined): string | undefined {
  return value && /^[0-9a-f]{64}$/.test(value) ? value : undefined;
}

function parseRelease(values: ReadonlyMap<string, string>): CadenceReleaseIdentity | undefined {
  const version = values.get("CADENCE_RELEASE_VERSION");
  const commitSha = values.get("CADENCE_COMMIT_SHA");
  const buildId = values.get("CADENCE_BUILD_ID");
  if (version === undefined || commitSha === undefined || buildId === undefined) return undefined;
  try {
    return loadCadenceReleaseIdentity({ version, commitSha, buildId });
  } catch {
    return undefined;
  }
}

function boundedName(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9._-]{1,128}$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unavailable<T>(code: string): Vs005Observation<T> {
  return { state: "UNAVAILABLE", code };
}

function unavailableFacts(code: string): CloudflareWorkerSettingsFacts {
  return {
    workerConfigFingerprint: unavailable(code),
    nonSecretBindingNames: unavailable(code),
    secretNames: unavailable(code),
    currentRelease: unavailable(code),
  };
}

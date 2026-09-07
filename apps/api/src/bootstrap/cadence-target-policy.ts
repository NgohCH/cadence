import type {
  CadenceCloudflareTarget,
  CadenceEnvironment,
  CadenceRuntimeConfig,
} from "./cadence-config";

export interface CadenceTargetFacts {
  environment: CadenceEnvironment;
  safeTargetMarker: string;
  cloudflare: CadenceCloudflareTarget;
  publicUrl: string;
  supabaseProjectRef: string;
  pilotProjectId: string;
}

export interface CadenceTargetPolicy {
  name: string;
  expected: CadenceTargetFacts;
}

export const VS005_BETA_TARGET_POLICY: Readonly<CadenceTargetPolicy> = Object.freeze({
  name: "vs005-beta",
  expected: {
    environment: "beta",
    safeTargetMarker: "cadence-beta",
    cloudflare: {
      accountId: "3d6a31905ac44e9563a523f9c86cbb8d",
      workerName: "mycadence",
    },
    publicUrl: "https://mycadence.ngohch-3d6.workers.dev",
    supabaseProjectRef: "pwmhasbmacmeerbsagda",
    pilotProjectId: "3503f8c7-1996-44d1-8b63-1fca36db89f8",
  } satisfies CadenceTargetFacts,
});

export function getCadenceTargetFacts(config: CadenceRuntimeConfig): CadenceTargetFacts {
  if (!config.cloudflare) {
    throw new Error("TARGET_POLICY_INPUT_INVALID: cloudflare target is required");
  }
  if (!config.supabase.projectRef) {
    throw new Error("TARGET_POLICY_INPUT_INVALID: hosted Supabase project ref is required");
  }

  return {
    environment: config.application.environment,
    safeTargetMarker: config.pilot.safeTargetMarker,
    cloudflare: {
      accountId: config.cloudflare.accountId,
      workerName: config.cloudflare.workerName,
    },
    publicUrl: config.application.publicUrl,
    supabaseProjectRef: config.supabase.projectRef,
    pilotProjectId: config.pilot.projectId,
  };
}

export function assertCadenceTargetPolicy(
  config: CadenceRuntimeConfig,
  policy: CadenceTargetPolicy,
): void {
  const actual = getCadenceTargetFacts(config);
  const comparisons: ReadonlyArray<readonly [string, string, string]> = [
    ["environment", actual.environment, policy.expected.environment],
    ["safeTargetMarker", actual.safeTargetMarker, policy.expected.safeTargetMarker],
    ["cloudflare.accountId", actual.cloudflare.accountId, policy.expected.cloudflare.accountId],
    ["cloudflare.workerName", actual.cloudflare.workerName, policy.expected.cloudflare.workerName],
    ["publicUrl", actual.publicUrl, policy.expected.publicUrl],
    ["supabaseProjectRef", actual.supabaseProjectRef, policy.expected.supabaseProjectRef],
    ["pilotProjectId", actual.pilotProjectId, policy.expected.pilotProjectId],
  ];

  for (const [field, actualValue, expectedValue] of comparisons) {
    if (actualValue !== expectedValue) {
      throw new Error(`TARGET_POLICY_MISMATCH: ${field}`);
    }
  }
}

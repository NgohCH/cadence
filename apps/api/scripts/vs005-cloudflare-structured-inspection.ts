import type { CadenceRuntimeConfig } from "../src/bootstrap/cadence-config";
import type { CadenceReleaseIdentity } from "../src/bootstrap/cadence-release";
import { inspectCurrentDeployment, type CloudflareCurrentDeploymentFacts } from "./vs005-cloudflare-current-deployment";
import { inspectCronSchedules } from "./vs005-cloudflare-cron-inspection";
import {
  correlateWorkersDevHostname,
  inspectAccountWorkersDevSubdomain,
  inspectWorkersDevState,
} from "./vs005-cloudflare-hostname-inspection";
import {
  createCloudflareWorkerInspectionTarget,
  type CloudflareReadOnlyTransport,
  type CloudflareWorkerInspectionTarget,
} from "./vs005-cloudflare-readonly-transport";
import { inspectDeployableVersions, inspectVersion, type CloudflareVersionIdentity } from "./vs005-cloudflare-version-inspection";
import { inspectWorkerSettings, type CloudflareWorkerSettingsFacts } from "./vs005-cloudflare-worker-settings";
import type { GeneratedCloudflareDeployment } from "./vs005-generate-deployment";
import type {
  Vs005CloudflareOperationName,
  Vs005CorrelatedProviderInspection,
  Vs005CurrentDeploymentIdentity,
  Vs005Observation,
  Vs005ProviderInspectionProfile,
  Vs005StructuredProviderObservationSnapshot,
} from "./vs005-provider-observations";

const OPERATION_ORDER: readonly Vs005CloudflareOperationName[] = [
  "CURRENT_DEPLOYMENT",
  "WORKER_SETTINGS",
  "CRON_SCHEDULES",
  "DEPLOYABLE_VERSIONS",
  "VERSION",
  "WORKER_SUBDOMAIN",
  "ACCOUNT_SUBDOMAIN",
];

export interface CloudflareStructuredReadOnlyProvider {
  inspectCurrentDeployment(target: CloudflareWorkerInspectionTarget): Promise<CloudflareCurrentDeploymentFacts>;
  inspectWorkerSettings(target: CloudflareWorkerInspectionTarget): Promise<CloudflareWorkerSettingsFacts>;
  inspectCronSchedules(target: CloudflareWorkerInspectionTarget): Promise<Vs005Observation<readonly string[]>>;
  inspectDeployableVersions(target: CloudflareWorkerInspectionTarget): Promise<Vs005Observation<readonly string[]>>;
  inspectVersion(target: CloudflareWorkerInspectionTarget, versionId: string): Promise<Vs005Observation<CloudflareVersionIdentity>>;
  inspectWorkersDevState(target: CloudflareWorkerInspectionTarget): Promise<Vs005Observation<boolean>>;
  inspectAccountWorkersDevSubdomain(target: CloudflareWorkerInspectionTarget): Promise<Vs005Observation<string>>;
}

export interface CloudflareStructuredInspectionRequest {
  config: CadenceRuntimeConfig;
  release: CadenceReleaseIdentity;
  generatedConfig: GeneratedCloudflareDeployment["wrangler"];
  profile: Vs005ProviderInspectionProfile;
  expectedPriorVersion?: CloudflareVersionIdentity;
}

export function createCloudflareStructuredReadOnlyProvider(
  transport: CloudflareReadOnlyTransport,
): CloudflareStructuredReadOnlyProvider {
  return {
    inspectCurrentDeployment: (target) => inspectCurrentDeployment(transport, target),
    inspectWorkerSettings: (target) => inspectWorkerSettings(transport, target),
    inspectCronSchedules: (target) => inspectCronSchedules(transport, target),
    inspectDeployableVersions: (target) => inspectDeployableVersions(transport, target),
    inspectVersion: (target, versionId) => inspectVersion(transport, target, versionId),
    inspectWorkersDevState: (target) => inspectWorkersDevState(transport, target),
    inspectAccountWorkersDevSubdomain: (target) => inspectAccountWorkersDevSubdomain(transport, target),
  };
}

export async function inspectCloudflareReadOnly(
  provider: CloudflareStructuredReadOnlyProvider,
  request: CloudflareStructuredInspectionRequest,
  clock: () => Date,
): Promise<Vs005CorrelatedProviderInspection> {
  const target = createCloudflareWorkerInspectionTarget({
    config: request.config,
    generatedConfig: { wrangler: request.generatedConfig },
    profile: request.profile,
  });
  const completed = new Set<Vs005CloudflareOperationName>();
  const current = await provider.inspectCurrentDeployment(target);
  const workerExists = current.workerExists.state === "OBSERVED_VALUE" && current.workerExists.value !== true
    ? unavailable<boolean>("WORKER_EXISTENCE_UNAVAILABLE")
    : current.workerExists;
  const currentDeployment: Vs005Observation<Vs005CurrentDeploymentIdentity> = workerExists.state === "UNAVAILABLE"
    ? unavailable("CURRENT_DEPLOYMENT_UNAVAILABLE")
    : workerExists.state === "OBSERVED_ABSENT"
      ? absent()
      : current.currentDeployment;
  if (isComplete(workerExists) && isComplete(currentDeployment)) completed.add("CURRENT_DEPLOYMENT");

  const workerProven = workerExists.state !== "UNAVAILABLE";
  const workerPresent = workerExists.state === "OBSERVED_VALUE" && workerExists.value === true;
  const workerAbsent = workerExists.state === "OBSERVED_ABSENT";
  const accountId: Vs005Observation<string> = workerProven
    ? observed(target.accountId)
    : unavailable("CLOUDFLARE_ACCOUNT_UNAVAILABLE");
  const workerName: Vs005Observation<string> = workerProven
    ? observed(target.workerName)
    : unavailable("CLOUDFLARE_WORKER_UNAVAILABLE");

  let settings = workerAbsent ? absentSettings() : unavailableSettings();
  let cronSchedules: Vs005Observation<readonly string[]> = workerAbsent ? absent() : unavailable("CRON_SCHEDULES_UNAVAILABLE");
  let workersDevEnabled: Vs005Observation<boolean> = workerAbsent ? absent() : unavailable("WORKERS_DEV_STATE_UNAVAILABLE");
  if (workerPresent) {
    settings = await provider.inspectWorkerSettings(target);
    if ([
      settings.workerConfigFingerprint,
      settings.nonSecretBindingNames,
      settings.secretNames,
      settings.currentRelease,
    ].some(isComplete)) completed.add("WORKER_SETTINGS");
    cronSchedules = await provider.inspectCronSchedules(target);
    if (isComplete(cronSchedules)) completed.add("CRON_SCHEDULES");
    workersDevEnabled = await provider.inspectWorkersDevState(target);
    if (isComplete(workersDevEnabled)) completed.add("WORKER_SUBDOMAIN");
  }

  const accountWorkersDevSubdomain = await provider.inspectAccountWorkersDevSubdomain(target);
  if (isComplete(accountWorkersDevSubdomain)) completed.add("ACCOUNT_SUBDOMAIN");
  const hostname = workerAbsent
    ? absent<string>()
    : correlateWorkersDevHostname({ target, workersDevEnabled, accountSubdomain: accountWorkersDevSubdomain });

  let priorVersion: Vs005Observation<CloudflareVersionIdentity> = workerAbsent
    ? absent()
    : request.profile === "ROLLBACK_READINESS"
      ? unavailable("PRIOR_VERSION_UNAVAILABLE")
      : absent();
  if (workerPresent && request.profile === "ROLLBACK_READINESS") {
    const deployableVersions = await provider.inspectDeployableVersions(target);
    if (isComplete(deployableVersions)) completed.add("DEPLOYABLE_VERSIONS");
    if (deployableVersions.state === "OBSERVED_VALUE" && request.expectedPriorVersion) {
      if (!deployableVersions.value.includes(request.expectedPriorVersion.providerVersionId)) {
        priorVersion = absent();
      } else {
        priorVersion = await provider.inspectVersion(target, request.expectedPriorVersion.providerVersionId);
        if (isComplete(priorVersion)) completed.add("VERSION");
        if (priorVersion.state === "OBSERVED_VALUE" && !sameVersion(priorVersion.value, request.expectedPriorVersion)) {
          priorVersion = unavailable("PRIOR_VERSION_MISMATCH");
        }
      }
    }
  }

  const observations: Vs005StructuredProviderObservationSnapshot = {
    accountId,
    workerName,
    workerExists,
    currentDeployment,
    workerConfigFingerprint: settings.workerConfigFingerprint,
    cronSchedules,
    nonSecretBindingNames: settings.nonSecretBindingNames,
    secretNames: settings.secretNames,
    currentRelease: settings.currentRelease,
    priorVersion,
    workersDevEnabled,
    accountWorkersDevSubdomain,
    hostname,
  };
  return {
    correlation: {
      accountId: target.accountId,
      workerName: target.workerName,
      configFingerprint: target.configFingerprint,
      providerOrigin: "api.cloudflare.com",
      profile: target.profile,
      completedOperations: OPERATION_ORDER.filter((operation) => completed.has(operation)),
      observedAt: clock().toISOString(),
    },
    observations,
  };
}

function isComplete(value: Vs005Observation<unknown>): boolean {
  return value.state !== "UNAVAILABLE";
}

function sameVersion(left: CloudflareVersionIdentity, right: CloudflareVersionIdentity): boolean {
  return left.providerVersionId === right.providerVersionId
    && left.configFingerprint === right.configFingerprint
    && left.release.version === right.release.version
    && left.release.commitSha === right.release.commitSha
    && left.release.buildId === right.release.buildId;
}

function observed<T>(value: T): Vs005Observation<T> {
  return { state: "OBSERVED_VALUE", value };
}

function absent<T>(): Vs005Observation<T> {
  return { state: "OBSERVED_ABSENT" };
}

function unavailable<T>(code: string): Vs005Observation<T> {
  return { state: "UNAVAILABLE", code };
}

function absentSettings(): CloudflareWorkerSettingsFacts {
  return {
    workerConfigFingerprint: absent(),
    nonSecretBindingNames: absent(),
    secretNames: absent(),
    currentRelease: absent(),
  };
}

function unavailableSettings(): CloudflareWorkerSettingsFacts {
  return {
    workerConfigFingerprint: unavailable("WORKER_SETTINGS_UNAVAILABLE"),
    nonSecretBindingNames: unavailable("WORKER_SETTINGS_UNAVAILABLE"),
    secretNames: unavailable("WORKER_SETTINGS_UNAVAILABLE"),
    currentRelease: unavailable("WORKER_SETTINGS_UNAVAILABLE"),
  };
}

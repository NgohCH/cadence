# VS005 Cloudflare Structured Read-Only Inspection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Wrangler CLI output as authoritative Cloudflare inspection evidence with a fixed-origin, GET-only, structured REST boundary; complete deterministic local planner readiness; and bind the resulting evidence through plan, apply, verify, and rollback without authorizing a remote operation.

**Architecture:** Canonical configuration remains intended-target authority, an injected target policy remains authorization authority, and a correlated structured provider inspection remains observation only. Focused parser modules consume one private bounded transport, compose behind the existing `inspectReadOnly` seam, and produce the existing tri-state observations plus a target/profile/operation correlation envelope. Wrangler remains isolated behind the mutation boundary and never receives the inspection credential.

**Tech Stack:** Node.js 24 built-in `fetch`, `AbortController`, Web Streams, TypeScript 7, Node test runner with `tsx`, Ajv-backed canonical configuration, Vite 8, Wrangler 4.127.1 for local dry-run and later separately authorized mutation only, PowerShell and `npm.cmd` for Windows verification.

**Spec path:** `docs/superpowers/specs/2026-09-08-vs005-cloudflare-structured-readonly-inspection-design.md`

**Global Constraints:**

- Every task is local and offline. Inject `fetch`, credentials, clocks, streams, file readers, command runners, and process spawners in tests. Do not contact Cloudflare, Supabase, or a hosted Cadence endpoint.
- Production inspection origin is the module-owned literal `https://api.cloudflare.com/client/v4`. Production origin overrides, redirects, non-HTTPS URLs, caller-supplied absolute paths, and credentials in URLs or query strings are prohibited.
- The private transport can express only fixed named routes and literal `GET`. No public generic request surface and no inspection path for `POST`, `PUT`, `PATCH`, or `DELETE` may exist.
- Keep the 15-second timeout and 1 MiB pre-parse body ceiling. Reject a trustworthy oversized `Content-Length`; otherwise stream through a bounded reader, reject immediately after accumulated bytes exceed 1 MiB, and parse JSON only after the bounded read completes.
- `CloudflareCredentialProvider` supplies opaque credential material only. The initial source reads only `CLOUDFLARE_INSPECTION_API_TOKEN`. It cannot supply target, policy, endpoint, path, or method data and cannot scrape Wrangler authentication state.
- Every inspection is correlated to canonical `accountId`, canonical `workerName`, `fingerprintCadenceRuntimeConfig(config)`, generated `account_id`, generated `name`, a phase/profile, a completed-operation set, fixed origin identity, and observation time. Provider data cannot rewrite those values.
- Keep `OBSERVED_VALUE`, `OBSERVED_ABSENT`, and `UNAVAILABLE` distinct. Only the strict all-error `{10007, 10090}` current-deployment rule may prove Worker absence. No prose matching or generic HTTP-status absence rule is permitted.
- Derive `SUPABASE_SECRET_KEY` presence only from complete Worker settings and exact `secret_text` type. Do not add a `/secrets` operation. Retain values only for `CADENCE_CONFIG_FINGERPRINT`, `CADENCE_RELEASE_VERSION`, `CADENCE_COMMIT_SHA`, and `CADENCE_BUILD_ID` after exact name/type/value validation. Discard `CADENCE_RUNTIME_CONFIG_JSON` and all other plaintext or secret values.
- `generatedConfigValid` and `webBuildReady` are deterministic local evidence. They never enter `Vs005ProviderObservationSnapshot` and never become true from provider data.
- Before every Wrangler or deployment/mutation child process is spawned, explicitly remove `CLOUDFLARE_INSPECTION_API_TOKEN` from the child environment. Do not alter Wrangler's separate deployment-authentication design.
- Preserve the Beta policy boundary: `cadence-beta` is the environment/safe marker; `mycadence` is the Worker. Do not hard-code the Beta account, Worker, Supabase ref, or controlled Project in generic transport, parsers, observations, or integration code.
- `NEW MIGRATION = NO`, `DATABASE RESET = NO`, `DATABASE REPAIR = NO`, `MIGRATION REVERSAL = NO`, `DATABASE ROLLBACK = NO`, and `AD HOC DESTRUCTIVE SQL = NO` for every task. Preserve all 44 parent commitments and 178 child traceability records.
- Certificate pinning remains **DEFERRED**. New dependencies and paid components remain **NO**. Host inspection, provider mutation, clean-room work, hosted Task 15, and Pilot Activation remain **NOT AUTHORIZED**.
- Before each commit run the task's focused GREEN command, listed regressions, `git diff --check`, and inspect the complete task diff. Stage only the files listed for that task and do not push.

## File and interface map

### Files created

- `apps/api/scripts/vs005-cloudflare-readonly-transport.ts` — credential source, validated target/correlation types, fixed route descriptors, bounded failures, GET-only transport, timeout, redirect policy, and bounded body reader.
- `apps/api/scripts/vs005-cloudflare-readonly-transport.test.ts` — complete transport, credential, target-binding, response-bound, and leakage matrix.
- `apps/api/scripts/vs005-cloudflare-current-deployment.ts` and `.test.ts` — deployments envelope parser, strict Worker-not-found classifier, Worker presence, deployment ID, and version traffic.
- `apps/api/scripts/vs005-cloudflare-worker-settings.ts` and `.test.ts` — settings bindings, required secret presence, non-secret binding names, fingerprint, and release identity.
- `apps/api/scripts/vs005-cloudflare-cron-inspection.ts` and `.test.ts` — Cron schedule parsing with explicit empty and unavailable states.
- `apps/api/scripts/vs005-cloudflare-version-inspection.ts` and `.test.ts` — fixed deployable-version collection and one exact-version identity parser.
- `apps/api/scripts/vs005-cloudflare-hostname-inspection.ts` and `.test.ts` — Worker workers.dev state, target-bound account subdomain, and public-hostname correlation.
- `apps/api/scripts/vs005-cloudflare-structured-inspection.ts` and `.test.ts` — named provider interface and phase-aware composition into a correlated safe snapshot.
- `apps/api/scripts/vs005-local-deployment-readiness.ts` and `.test.ts` — deterministic generated-config and Beta web-build readiness checks.

### Existing files modified

- `apps/api/scripts/vs005-provider-observations.ts` and `.test.ts` — add structured deployment and correlation contracts while preserving the tri-state model and phase completeness.
- `apps/api/scripts/vs005-cloudflare-deployment-provider.ts` and `.test.ts` — delegate authoritative inspection to the structured provider; retain Wrangler only for mutation and explicitly sanitize mutation child environments.
- `apps/api/scripts/vs005-deployment-artifacts.ts` and `.test.ts` — require provider correlation in reviewed v2 plans.
- `apps/api/scripts/vs005-deploy-plan.ts` and `.test.ts` — consume correlated structured inspection and real local readiness.
- `apps/api/scripts/vs005-deploy-apply.ts` and `.test.ts` — require fresh correlated reinspection and sanitize all child environments before spawn.
- `apps/api/scripts/vs005-deploy-verify.ts` and `.test.ts` — require post-deploy structured inspection and deployed version/target correlation.
- `apps/api/scripts/vs005-rollback.ts` and `.test.ts` — require the explicitly selected retained version A in the complete deployable set and exact version detail.
- `apps/api/scripts/vs005-t15a-readiness.ts` and `.test.ts` — record local extension verification and the still-unauthorized host gate without claiming provider state.
- `HANDOFF.md` — one final checkpoint reconciliation after every local gate passes.

No schema, migration, database, Beta config, frozen VS005 record, T15-A record, or approved structured-inspection design file is modified.

## Task 1: Add the fixed-origin GET-only transport and correlation contracts

**Files:**

- Create: `apps/api/scripts/vs005-cloudflare-readonly-transport.ts`
- Create: `apps/api/scripts/vs005-cloudflare-readonly-transport.test.ts`
- Modify: `apps/api/scripts/vs005-provider-observations.ts`
- Test: `apps/api/scripts/vs005-provider-observations.test.ts`

**Interfaces consumed:** `CadenceRuntimeConfig`, `fingerprintCadenceRuntimeConfig`, `GeneratedCloudflareDeployment["wrangler"]`, `Vs005Observation`, Node `fetch`, `AbortController`, `ReadableStream`, and the current safe identifier/release validators.

**Interfaces produced:**

```ts
export type Vs005ProviderInspectionProfile =
  | "FIRST_DEPLOYMENT_READINESS"
  | "POST_DEPLOYMENT_VERIFICATION"
  | "ROLLBACK_READINESS";

export type Vs005CloudflareOperationName =
  | "CURRENT_DEPLOYMENT"
  | "WORKER_SETTINGS"
  | "CRON_SCHEDULES"
  | "DEPLOYABLE_VERSIONS"
  | "VERSION"
  | "WORKER_SUBDOMAIN"
  | "ACCOUNT_SUBDOMAIN";

export interface Vs005ProviderObservationCorrelation {
  accountId: string;
  workerName: string;
  configFingerprint: string;
  providerOrigin: "api.cloudflare.com";
  profile: Vs005ProviderInspectionProfile;
  completedOperations: readonly Vs005CloudflareOperationName[];
  observedAt: string;
}

export interface Vs005CurrentDeploymentIdentity {
  deploymentId: string;
  versions: readonly { providerVersionId: string; percentage: number }[];
}

export interface Vs005StructuredProviderObservationSnapshot
  extends Vs005ProviderObservationSnapshot {
  currentDeployment: Vs005Observation<Vs005CurrentDeploymentIdentity>;
  workersDevEnabled: Vs005Observation<boolean>;
  accountWorkersDevSubdomain: Vs005Observation<string>;
}

export interface Vs005CorrelatedProviderInspection {
  correlation: Vs005ProviderObservationCorrelation;
  observations: Vs005StructuredProviderObservationSnapshot;
}

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
  | {
      kind: "PROVIDER_FAILURE";
      operation: Vs005CloudflareOperationName;
      errorCodes: readonly number[];
      errorsWellFormed: boolean;
    }
  | {
      kind: "UNAVAILABLE";
      failure: {
        operation: Vs005CloudflareOperationName;
        kind: Exclude<CloudflareInspectionFailureKind, "WORKER_NOT_FOUND">;
      };
    };

export interface CloudflareReadOnlyTransport {
  read(route: CloudflareReadOnlyRoute): Promise<CloudflareReadOnlyTransportResult>;
}
```

The private `CloudflareReadOnlyRoute` is a closed discriminated union over the seven operation names. `CloudflareReadOnlyTransport.read(route)` always constructs a URL from the fixed origin and route template, supplies literal `GET`, `redirect: "manual"`, a 15-second abort signal, and a bearer header obtained from the credential provider. A success exposes `result` only to the named operation parser. A structured failure retains numeric codes plus a well-formedness flag but discards messages. It never returns body text, headers, exception text, or the credential. `WORKER_NOT_FOUND` is deliberately excluded from transport classification because only Task 2 has enough operation/target context to assign it.

- [ ] **Step 1: Write the focused failing transport and type tests**

  Add cases for the environment credential's missing/blank/value behavior; exact target/generated account/generated Worker/fingerprint equality; a portable non-Beta target; fixed HTTPS origin and independently encoded path segments; seven fixed route URLs; literal GET; manual redirects; no caller origin/method/path control; 15-second abort; 401, 403, generic 404, 429, 5xx, redirect, network rejection, TLS-shaped rejection, timeout, malformed JSON, empty body, and malformed envelopes. Add body tests for trustworthy `Content-Length` over 1,048,576 bytes, stream overflow without a usable length, acceptable length that still overflows, exactly 1,048,576 bytes accepted, and a parser spy proving JSON parsing starts only after the final bounded chunk. Add canaries in bearer credentials, headers, messages, bodies, and exceptions and assert that serialized results and logger capture contain none of them.

  Update `vs005-provider-observations.test.ts` to prove the new correlated/structured types do not alter `OBSERVED_VALUE`, `OBSERVED_ABSENT`, `UNAVAILABLE`, first-deployment absence, or rollback completeness behavior.

- [ ] **Step 2: Run RED and record the missing-contract failure**

  ```powershell
  cd apps/api
  node --import tsx --test scripts/vs005-cloudflare-readonly-transport.test.ts scripts/vs005-provider-observations.test.ts
  ```

  Expected RED: the new transport module and exported correlation/structured observation types do not exist. Existing observation tests remain green; new assertions fail because no fixed route, timeout, bounded reader, credential provider, or correlated target constructor exists.

- [ ] **Step 3: Implement the minimum credential, target, route, failure, and transport code**

  Implement `createEnvironmentCloudflareCredentialProvider(environment)`, `createCloudflareWorkerInspectionTarget({ config, generatedConfig, profile })`, `createCloudflareReadOnlyTransport({ credentialProvider, fetchImpl, clock })`, and a private `readBodyWithinLimit(response, 1_048_576)`.

  ```ts
  const CLOUDFLARE_API_ORIGIN = "https://api.cloudflare.com/client/v4" as const;
  const REQUEST_TIMEOUT_MS = 15_000;
  const MAX_RESPONSE_BYTES = 1_048_576;

  const response = await fetchImpl(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${credential}` },
    redirect: "manual",
    signal: controller.signal,
  });
  ```

  Reject target mismatches before credential access or fetch. Validate route descriptors through the closed union, reject every 3xx before body classification, read response streams incrementally, cancel after overflow, parse once after complete bounded accumulation, and reduce every failure to operation plus enum kind. Do not export an arbitrary URL or HTTP-method function.

- [ ] **Step 4: Run focused GREEN**

  ```powershell
  node --import tsx --test scripts/vs005-cloudflare-readonly-transport.test.ts scripts/vs005-provider-observations.test.ts
  ```

  Expected GREEN: all transport matrix cases pass offline and no injected fetch sees a mutation verb, alternate origin, unencoded target segment, query credential, or redirect follow.

- [ ] **Step 5: Run Task 1 regressions**

  ```powershell
  node --import tsx --test scripts/vs005-generate-deployment.test.ts scripts/vs005-cloudflare-deployment-provider.test.ts
  npm.cmd exec -- tsc --noEmit -p tsconfig.scripts.json
  ```

  Expected: existing generated target and provider tests pass; script typecheck confirms the additive structured contracts do not break current consumers.

- [ ] **Step 6: Inspect Task 1 safety and diff**

  ```powershell
  cd ..\..\
  git diff --check
  git diff -- apps/api/scripts/vs005-cloudflare-readonly-transport.ts apps/api/scripts/vs005-cloudflare-readonly-transport.test.ts apps/api/scripts/vs005-provider-observations.ts apps/api/scripts/vs005-provider-observations.test.ts
  ```

  Confirm no Beta tuple in generic code, no production origin parameter, no generic pagination, no response-body retention, no mutation route, no dependency change, and no credential in any safe output.

- [ ] **Step 7: Commit Task 1**

  ```powershell
  git add apps/api/scripts/vs005-cloudflare-readonly-transport.ts apps/api/scripts/vs005-cloudflare-readonly-transport.test.ts apps/api/scripts/vs005-provider-observations.ts apps/api/scripts/vs005-provider-observations.test.ts
  git diff --cached --check
  git diff --cached --stat
  git diff --cached
  git commit -m "feat(vs005): add bounded Cloudflare read transport"
  ```

## Task 2: Parse current deployment and strict Worker presence

**Files:**

- Create: `apps/api/scripts/vs005-cloudflare-current-deployment.ts`
- Create: `apps/api/scripts/vs005-cloudflare-current-deployment.test.ts`
- Test: `apps/api/scripts/vs005-cloudflare-readonly-transport.test.ts`

**Interfaces consumed:** `CloudflareReadOnlyTransport`, the `CURRENT_DEPLOYMENT` route, `CloudflareWorkerInspectionTarget`, `CloudflareInspectionFailureKind`, `Vs005CurrentDeploymentIdentity`, and `Vs005Observation`.

**Interfaces produced:**

```ts
export interface CloudflareCurrentDeploymentFacts {
  workerExists: Vs005Observation<boolean>;
  currentDeployment: Vs005Observation<Vs005CurrentDeploymentIdentity>;
}

export async function inspectCurrentDeployment(
  transport: CloudflareReadOnlyTransport,
  target: CloudflareWorkerInspectionTarget,
): Promise<CloudflareCurrentDeploymentFacts>;
```

The success parser accepts only `success: true` with a bounded `result.deployments` array. Index zero is the latest deployment, and only `id` plus bounded `versions[].version_id` and finite percentages from 0 through 100 survive. A successful empty array yields Worker present plus current deployment absent. The failure parser yields Worker absent only for an exact current-deployment route whose `success:false` envelope has a non-empty errors array where every entry is a record with numeric code `10007` or `10090`.

- [ ] **Step 1: Write the focused failing deployment-parser tests**

  Cover Worker present; latest deployment index zero; bounded deployment ID; bounded version IDs and traffic; unrelated later deployments ignored; successful empty deployment list; `10007` only; `10090` only; both approved codes; mixed approved and unknown code; empty errors; malformed error entry; same approved code on an uncorrelated operation; generic 404; generic nonzero/provider failure; malformed result; duplicate version ID; invalid percentage; oversized collection; and canaries in author email, annotations, messages, arbitrary metadata, headers, and exception text. Assert no canary survives and no rollback target is selected.

- [ ] **Step 2: Run RED and record the absent parser**

  ```powershell
  cd apps/api
  node --import tsx --test scripts/vs005-cloudflare-current-deployment.test.ts scripts/vs005-cloudflare-readonly-transport.test.ts
  ```

  Expected RED: `inspectCurrentDeployment` and `CloudflareCurrentDeploymentFacts` are missing; the strict all-errors and latest-deployment behaviors cannot be exercised.

- [ ] **Step 3: Implement the minimum current-deployment operation**

  ```ts
  const WORKER_NOT_FOUND_CODES = new Set([10007, 10090]);

  const workerMissing = errors.length > 0 && errors.every(
    (entry) => isRecord(entry)
      && typeof entry.code === "number"
      && WORKER_NOT_FOUND_CODES.has(entry.code),
  );
  ```

  Build only the fixed `/accounts/{accountId}/workers/scripts/{workerName}/deployments` route. Correlate the route descriptor to the exact target. Do not use HTTP 404, response prose, error messages, empty output, or empty deployments as Worker absence. Return bounded IDs and traffic only.

- [ ] **Step 4: Run focused GREEN**

  ```powershell
  node --import tsx --test scripts/vs005-cloudflare-current-deployment.test.ts scripts/vs005-cloudflare-readonly-transport.test.ts
  ```

  Expected GREEN: only strict correlated all-approved codes produce `OBSERVED_ABSENT`; all mixed, malformed, uncorrelated, auth, permission, transport, and generic-status cases produce `UNAVAILABLE`.

- [ ] **Step 5: Run Task 2 regressions**

  ```powershell
  node --import tsx --test scripts/vs005-provider-observations.test.ts scripts/vs005-cloudflare-deployment-provider.test.ts
  npm.cmd exec -- tsc --noEmit -p tsconfig.scripts.json
  ```

- [ ] **Step 6: Inspect Task 2 safety and diff**

  ```powershell
  cd ..\..\
  git diff --check
  git diff -- apps/api/scripts/vs005-cloudflare-current-deployment.ts apps/api/scripts/vs005-cloudflare-current-deployment.test.ts
  ```

  Confirm no raw-text matching, no generic 404 absence, no auto-selected rollback version, no raw metadata, and no new route or verb.

- [ ] **Step 7: Commit Task 2**

  ```powershell
  git add apps/api/scripts/vs005-cloudflare-current-deployment.ts apps/api/scripts/vs005-cloudflare-current-deployment.test.ts
  git diff --cached --check
  git diff --cached --stat
  git diff --cached
  git commit -m "feat(vs005): inspect current Cloudflare deployment"
  ```

## Task 3: Parse Worker settings, secret presence, and identity bindings

**Files:**

- Create: `apps/api/scripts/vs005-cloudflare-worker-settings.ts`
- Create: `apps/api/scripts/vs005-cloudflare-worker-settings.test.ts`
- Test: `apps/api/src/bootstrap/cadence-release.test.ts`

**Interfaces consumed:** `CloudflareReadOnlyTransport`, the `WORKER_SETTINGS` route, `CloudflareWorkerInspectionTarget`, `CadenceReleaseIdentity`, `loadCadenceReleaseIdentity`, and `Vs005Observation`.

**Interfaces produced:**

```ts
export interface CloudflareWorkerSettingsFacts {
  workerConfigFingerprint: Vs005Observation<string>;
  nonSecretBindingNames: Vs005Observation<readonly string[]>;
  secretNames: Vs005Observation<readonly string[]>;
  currentRelease: Vs005Observation<CadenceReleaseIdentity>;
}

export async function inspectWorkerSettings(
  transport: CloudflareReadOnlyTransport,
  target: CloudflareWorkerInspectionTarget,
): Promise<CloudflareWorkerSettingsFacts>;
```

The parser requires one complete bounded settings binding array. Exactly one `SUPABASE_SECRET_KEY` with type `secret_text` yields `secretNames=OBSERVED_VALUE(["SUPABASE_SECRET_KEY"])`; none yields `OBSERVED_ABSENT`; wrong type, duplicate, incomplete, malformed, or oversized settings yields affected observations unavailable. Non-secret names include safe binding names/types but no values. The four retained `plain_text` identity values feed existing fingerprint and release validators; every other value is discarded.

- [ ] **Step 1: Write the focused failing settings tests**

  Cover exact secret name/type; missing secret; wrong type; duplicate secret; complete empty bindings; malformed/incomplete bindings; bounded collection overflow; each of the four allowed identity bindings; all four together producing a release and fingerprint; wrong `plain_text` types; duplicate identity name; invalid SHA/fingerprint/release/build value; missing one release component; `CADENCE_RUNTIME_CONFIG_JSON` name/type retained only as a non-secret binding name while its value is discarded; arbitrary `plain_text`, `json`, and `secret_text` values discarded; canaries in settings metadata, arbitrary vars, secret values, credential-like values, and error messages absent from facts and diagnostics.

- [ ] **Step 2: Run RED and record the absent settings parser**

  ```powershell
  cd apps/api
  node --import tsx --test scripts/vs005-cloudflare-worker-settings.test.ts src/bootstrap/cadence-release.test.ts
  ```

  Expected RED: the settings parser and bounded facts do not exist; no code derives the required secret state or four allowed identity values from settings.

- [ ] **Step 3: Implement the minimum allowlisted settings parser**

  ```ts
  const IDENTITY_BINDINGS = new Set([
    "CADENCE_CONFIG_FINGERPRINT",
    "CADENCE_RELEASE_VERSION",
    "CADENCE_COMMIT_SHA",
    "CADENCE_BUILD_ID",
  ]);

  const requiredSecret = bindings.filter(
    (binding) => binding.name === "SUPABASE_SECRET_KEY",
  );
  ```

  Require exact binding name/type/value shapes. Validate fingerprint as 64 lowercase hex and release through `loadCadenceReleaseIdentity`. Copy only safe names and the four validated values into local variables; construct observations from those variables; never copy a binding object or raw settings result into returned data.

- [ ] **Step 4: Run focused GREEN**

  ```powershell
  node --import tsx --test scripts/vs005-cloudflare-worker-settings.test.ts src/bootstrap/cadence-release.test.ts
  ```

- [ ] **Step 5: Run Task 3 regressions**

  ```powershell
  node --import tsx --test scripts/vs005-provider-observations.test.ts scripts/vs005-generate-deployment.test.ts scripts/vs005-cloudflare-readonly-transport.test.ts
  npm.cmd exec -- tsc --noEmit -p tsconfig.scripts.json
  ```

- [ ] **Step 6: Inspect Task 3 safety and diff**

  ```powershell
  cd ..\..\
  git diff --check
  git diff -- apps/api/scripts/vs005-cloudflare-worker-settings.ts apps/api/scripts/vs005-cloudflare-worker-settings.test.ts
  ```

  Confirm there is no `/secrets` path, no secret value field, no retained runtime-config JSON, and no fifth plaintext identity value.

- [ ] **Step 7: Commit Task 3**

  ```powershell
  git add apps/api/scripts/vs005-cloudflare-worker-settings.ts apps/api/scripts/vs005-cloudflare-worker-settings.test.ts
  git diff --cached --check
  git diff --cached --stat
  git diff --cached
  git commit -m "feat(vs005): inspect Cloudflare worker settings safely"
  ```

## Task 4: Parse Cron schedules with explicit empty semantics

**Files:**

- Create: `apps/api/scripts/vs005-cloudflare-cron-inspection.ts`
- Create: `apps/api/scripts/vs005-cloudflare-cron-inspection.test.ts`
- Test: `apps/api/scripts/vs005-provider-observations.test.ts`

**Interfaces consumed:** `CloudflareReadOnlyTransport`, the `CRON_SCHEDULES` route, `CloudflareWorkerInspectionTarget`, and `Vs005Observation<readonly string[]>`.

**Interfaces produced:**

```ts
export async function inspectCronSchedules(
  transport: CloudflareReadOnlyTransport,
  target: CloudflareWorkerInspectionTarget,
): Promise<Vs005Observation<readonly string[]>>;
```

- [ ] **Step 1: Write the focused failing Cron tests**

  Cover one bounded Cron expression, multiple deterministic expressions, duplicate expressions rejected, successful empty array as `OBSERVED_ABSENT`, malformed result, missing `cron`, invalid/control-character expression, oversized list, provider-indicated incomplete data, auth/permission/transport/provider failures as `UNAVAILABLE`, and canaries in timestamps, metadata, messages, and headers absent from output.

- [ ] **Step 2: Run RED and record the absent Cron operation**

  ```powershell
  cd apps/api
  node --import tsx --test scripts/vs005-cloudflare-cron-inspection.test.ts scripts/vs005-provider-observations.test.ts
  ```

  Expected RED: `inspectCronSchedules` does not exist and explicit empty schedule results cannot be distinguished from unavailable inspection.

- [ ] **Step 3: Implement the minimum Cron parser**

  Use only `/accounts/{accountId}/workers/scripts/{workerName}/schedules`. Accept a bounded complete result array, copy only validated `cron` strings, preserve provider order, and return absent only for a successful empty result. All failed or ambiguous cases return a stable unavailable code.

- [ ] **Step 4: Run focused GREEN**

  ```powershell
  node --import tsx --test scripts/vs005-cloudflare-cron-inspection.test.ts scripts/vs005-provider-observations.test.ts
  ```

- [ ] **Step 5: Run Task 4 regressions**

  ```powershell
  node --import tsx --test scripts/vs005-cloudflare-readonly-transport.test.ts scripts/vs005-cloudflare-current-deployment.test.ts
  npm.cmd exec -- tsc --noEmit -p tsconfig.scripts.json
  ```

- [ ] **Step 6: Inspect Task 4 safety and diff**

  ```powershell
  cd ..\..\
  git diff --check
  git diff -- apps/api/scripts/vs005-cloudflare-cron-inspection.ts apps/api/scripts/vs005-cloudflare-cron-inspection.test.ts
  ```

  Confirm no trigger mutation route, no generic empty-on-error mapping, and no provider metadata retention.

- [ ] **Step 7: Commit Task 4**

  ```powershell
  git add apps/api/scripts/vs005-cloudflare-cron-inspection.ts apps/api/scripts/vs005-cloudflare-cron-inspection.test.ts
  git diff --cached --check
  git diff --cached --stat
  git diff --cached
  git commit -m "feat(vs005): inspect Cloudflare cron schedules"
  ```

## Task 5: Parse deployable versions and one explicit version

**Files:**

- Create: `apps/api/scripts/vs005-cloudflare-version-inspection.ts`
- Create: `apps/api/scripts/vs005-cloudflare-version-inspection.test.ts`
- Modify: `apps/api/scripts/vs005-cloudflare-worker-settings.ts`
- Modify: `apps/api/scripts/vs005-cloudflare-worker-settings.test.ts`
- Test: `apps/api/scripts/vs005-rollback.test.ts`

**Interfaces consumed:** `CloudflareReadOnlyTransport`, `DEPLOYABLE_VERSIONS` and `VERSION` routes, `CloudflareWorkerInspectionTarget`, `CadenceReleaseIdentity`, `loadCadenceReleaseIdentity`, and the existing `priorVersion` shape.

**Interfaces produced:**

```ts
export interface CloudflareVersionIdentity {
  providerVersionId: string;
  release: CadenceReleaseIdentity;
  configFingerprint: string;
}

export async function inspectDeployableVersions(
  transport: CloudflareReadOnlyTransport,
  target: CloudflareWorkerInspectionTarget,
): Promise<Vs005Observation<readonly string[]>>;

export async function inspectVersion(
  transport: CloudflareReadOnlyTransport,
  target: CloudflareWorkerInspectionTarget,
  versionId: string,
): Promise<Vs005Observation<CloudflareVersionIdentity>>;
```

- [ ] **Step 1: Write the focused failing version tests**

  Assert the exact URL ends in `/versions?deployable=true`; no page, cursor, or per-page parameter is accepted; a complete bounded `result.items` list yields IDs; empty list yields absent only for the explicitly sought retained version; required retained version present and absent are distinguished; duplicate/invalid/oversized IDs and incomplete collection markers yield unavailable. For exact version detail, require the requested ID and the same four validated identity bindings used by settings; mismatch, missing detail, malformed metadata, or unapproved error yields unavailable. Include author/annotation/arbitrary-binding/secret canaries and prove none survive. Assert the API never selects a prior version from ordering and requires a caller-provided `versionId` for detail.

- [ ] **Step 2: Run RED and record the absent version operations**

  ```powershell
  cd apps/api
  node --import tsx --test scripts/vs005-cloudflare-version-inspection.test.ts scripts/vs005-rollback.test.ts
  ```

  Expected RED: fixed deployable-version and exact-version operations do not exist; current rollback fixtures cannot obtain provider-confirmed version A through structured data.

- [ ] **Step 3: Implement the minimum version parsers**

  Implement the fixed query route and a target-bound, encoded exact-version route. Reuse one private identity-binding reducer from `vs005-cloudflare-worker-settings.ts` rather than duplicating value acceptance rules; export that reducer only to the parser modules, not deployment business code. Return the complete bounded deployable ID set and one exact `CloudflareVersionIdentity`. Do not infer or rank rollback candidates.

- [ ] **Step 4: Run focused GREEN**

  ```powershell
  node --import tsx --test scripts/vs005-cloudflare-version-inspection.test.ts scripts/vs005-cloudflare-worker-settings.test.ts
  ```

- [ ] **Step 5: Run Task 5 regressions**

  ```powershell
  node --import tsx --test scripts/vs005-cloudflare-readonly-transport.test.ts scripts/vs005-provider-observations.test.ts scripts/vs005-rollback.test.ts
  npm.cmd exec -- tsc --noEmit -p tsconfig.scripts.json
  ```

- [ ] **Step 6: Inspect Task 5 safety and diff**

  ```powershell
  cd ..\..\
  git diff --check
  git diff -- apps/api/scripts/vs005-cloudflare-version-inspection.ts apps/api/scripts/vs005-cloudflare-version-inspection.test.ts apps/api/scripts/vs005-cloudflare-worker-settings.ts apps/api/scripts/vs005-cloudflare-worker-settings.test.ts
  ```

  Confirm the only collection query is `deployable=true`, no pagination framework exists, no rollback target is selected, and no raw version metadata survives.

- [ ] **Step 7: Commit Task 5**

  ```powershell
  git add apps/api/scripts/vs005-cloudflare-version-inspection.ts apps/api/scripts/vs005-cloudflare-version-inspection.test.ts apps/api/scripts/vs005-cloudflare-worker-settings.ts apps/api/scripts/vs005-cloudflare-worker-settings.test.ts
  git diff --cached --check
  git diff --cached --stat
  git diff --cached
  git commit -m "feat(vs005): inspect deployable Cloudflare versions"
  ```

## Task 6: Correlate workers.dev state and target-bound account subdomain

**Files:**

- Create: `apps/api/scripts/vs005-cloudflare-hostname-inspection.ts`
- Create: `apps/api/scripts/vs005-cloudflare-hostname-inspection.test.ts`
- Test: `apps/api/scripts/vs005-cloudflare-readonly-transport.test.ts`

**Interfaces consumed:** `CloudflareReadOnlyTransport`, `WORKER_SUBDOMAIN` and `ACCOUNT_SUBDOMAIN` routes, complete `CloudflareWorkerInspectionTarget`, and `Vs005Observation`.

**Interfaces produced:**

```ts
export interface CloudflareHostnameFacts {
  workersDevEnabled: Vs005Observation<boolean>;
  accountWorkersDevSubdomain: Vs005Observation<string>;
  hostname: Vs005Observation<string>;
}

export async function inspectWorkersDevState(
  transport: CloudflareReadOnlyTransport,
  target: CloudflareWorkerInspectionTarget,
): Promise<Vs005Observation<boolean>>;

export async function inspectAccountWorkersDevSubdomain(
  transport: CloudflareReadOnlyTransport,
  target: CloudflareWorkerInspectionTarget,
): Promise<Vs005Observation<string>>;

export function correlateWorkersDevHostname(input: {
  target: CloudflareWorkerInspectionTarget;
  workersDevEnabled: Vs005Observation<boolean>;
  accountSubdomain: Vs005Observation<string>;
}): Vs005Observation<string>;
```

- [ ] **Step 1: Write the focused failing hostname tests**

  Cover Worker subdomain enabled and disabled; account subdomain bounded label; exact expected `${workerName}.${subdomain}.workers.dev` match; public-hostname mismatch; missing/malformed enabled state; missing/empty/invalid account label; redirects and provider failures; account-subdomain route accepts the complete target and cannot accept a standalone account ID; correlation carries the same Worker and fingerprint even though the account endpoint path omits Worker; non-Beta target; and canaries in metadata/headers/messages absent from facts.

- [ ] **Step 2: Run RED and record the absent hostname operations**

  ```powershell
  cd apps/api
  node --import tsx --test scripts/vs005-cloudflare-hostname-inspection.test.ts scripts/vs005-cloudflare-readonly-transport.test.ts
  ```

  Expected RED: Worker/account subdomain parsers and hostname correlation do not exist; no target-bound account-subdomain API is available.

- [ ] **Step 3: Implement the minimum workers.dev parsers and correlation**

  Use fixed GET paths `/accounts/{accountId}/workers/scripts/{workerName}/subdomain` and `/accounts/{accountId}/workers/subdomain`. Accept only explicit booleans and bounded account labels. Produce hostname value only from a successful enabled Worker state, successful account label, and exact canonical public-hostname equality. Disabled yields `OBSERVED_ABSENT`; malformed, mismatch, or failed state yields `UNAVAILABLE`. Keep the account operation's argument type as the complete target.

- [ ] **Step 4: Run focused GREEN**

  ```powershell
  node --import tsx --test scripts/vs005-cloudflare-hostname-inspection.test.ts scripts/vs005-cloudflare-readonly-transport.test.ts
  ```

- [ ] **Step 5: Run Task 6 regressions**

  ```powershell
  node --import tsx --test scripts/vs005-generate-deployment.test.ts scripts/vs005-provider-observations.test.ts
  npm.cmd exec -- tsc --noEmit -p tsconfig.scripts.json
  ```

- [ ] **Step 6: Inspect Task 6 safety and diff**

  ```powershell
  cd ..\..\
  git diff --check
  git diff -- apps/api/scripts/vs005-cloudflare-hostname-inspection.ts apps/api/scripts/vs005-cloudflare-hostname-inspection.test.ts
  ```

  Confirm the account operation is target-bound, public host is not provider-selected, and no route update or subdomain registration path exists.

- [ ] **Step 7: Commit Task 6**

  ```powershell
  git add apps/api/scripts/vs005-cloudflare-hostname-inspection.ts apps/api/scripts/vs005-cloudflare-hostname-inspection.test.ts
  git diff --cached --check
  git diff --cached --stat
  git diff --cached
  git commit -m "feat(vs005): inspect Cloudflare workers dev state"
  ```

## Task 7: Compose named operations behind `inspectReadOnly`

**Files:**

- Create: `apps/api/scripts/vs005-cloudflare-structured-inspection.ts`
- Create: `apps/api/scripts/vs005-cloudflare-structured-inspection.test.ts`
- Modify: `apps/api/scripts/vs005-cloudflare-deployment-provider.ts`
- Modify: `apps/api/scripts/vs005-cloudflare-deployment-provider.test.ts`
- Modify: `apps/api/scripts/vs005-provider-observations.ts`
- Modify: `apps/api/scripts/vs005-provider-observations.test.ts`

**Interfaces consumed:** all Task 1-6 named operations, `Vs005StructuredProviderObservationSnapshot`, `Vs005CorrelatedProviderInspection`, `validateVs005ObservationCompleteness`, `buildCloudflareDeployment`, canonical config/release/fingerprint, and existing `CloudflareDeploymentProviderIo.inspectReadOnly`.

**Interfaces produced:**

```ts
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
  expectedPriorVersion?: {
    providerVersionId: string;
    release: CadenceReleaseIdentity;
    configFingerprint: string;
  };
}

export async function inspectCloudflareReadOnly(
  provider: CloudflareStructuredReadOnlyProvider,
  request: CloudflareStructuredInspectionRequest,
  clock: () => Date,
): Promise<Vs005CorrelatedProviderInspection>;
```

The operation profile is phase-aware. First-deployment and verification profiles call current deployment, settings, Cron, Worker subdomain, and account subdomain when the Worker exists. A strict correlated Worker-not-found result yields account/Worker observations as values, Worker existence absent, and Worker-owned config/Cron/binding/secret/release/deployment facts absent without calling their endpoints; account subdomain remains independently inspected for workers.dev namespace readiness. Rollback additionally calls fixed deployable versions and exact detail for the caller-supplied prior version A. `completedOperations` is sorted in the module's fixed operation order.

- [ ] **Step 1: Write the focused failing composition tests**

  Cover complete first-deployment Worker-present snapshot; strict Worker-absent snapshot and no dependent calls; unavailable Worker state and no fabricated canonical observations; complete post-deploy profile; rollback profile with explicit prior version present/detail matched; missing prior version; operation failure propagation; exact operation-set recording; fixed origin/account/Worker/fingerprint/profile/timestamp correlation; operation-set variation for proven absent Worker; non-Beta policy target; no generic method; no mutation function; and a full canary fixture serialized through observations, bounded failures, and logger capture.

  Update provider tests so default authoritative `inspectReadOnly` is injected structured REST composition, does not call `inspectCloudflareAccountMembership`, does not execute `wrangler whoami`, preserves the existing deployment/rollback Wrangler methods, and sanitizes every structured field before exposing it.

- [ ] **Step 2: Run RED and record missing composition**

  ```powershell
  cd apps/api
  node --import tsx --test scripts/vs005-cloudflare-structured-inspection.test.ts scripts/vs005-cloudflare-deployment-provider.test.ts scripts/vs005-provider-observations.test.ts
  ```

  Expected RED: no named provider/composer exists, default inspection still invokes Wrangler membership and leaves all Worker facts unavailable, and no correlated operation profile is returned.

- [ ] **Step 3: Implement minimum phase-aware composition and provider delegation**

  Create the named provider from the Task 1 transport and Task 2-6 functions. Build the target from validated config plus `buildCloudflareDeployment({ config, release }).wrangler`; reject generated account/name drift. Compose a fresh snapshot with safe observations and correlation. Retain `inspectCloudflareAccountMembership` only as a non-authoritative compatibility utility; remove it from `createDefaultCloudflareProviderIo().inspectReadOnly`.

  Change `CloudflareDeploymentProviderIo.inspectReadOnly` to consume `CloudflareStructuredInspectionRequest` and return `Vs005CorrelatedProviderInspection`. Add a correlated inspection method on the deployment-provider facade while retaining the legacy projection only for non-authoritative compatibility until Tasks 9-10 migrate every consumer.

- [ ] **Step 4: Run focused GREEN**

  ```powershell
  node --import tsx --test scripts/vs005-cloudflare-structured-inspection.test.ts scripts/vs005-cloudflare-deployment-provider.test.ts scripts/vs005-provider-observations.test.ts
  ```

- [ ] **Step 5: Run Task 7 regressions**

  ```powershell
  node --import tsx --test scripts/vs005-cloudflare-readonly-transport.test.ts scripts/vs005-cloudflare-current-deployment.test.ts scripts/vs005-cloudflare-worker-settings.test.ts scripts/vs005-cloudflare-cron-inspection.test.ts scripts/vs005-cloudflare-version-inspection.test.ts scripts/vs005-cloudflare-hostname-inspection.test.ts scripts/vs005-deploy-plan.test.ts scripts/vs005-deploy-apply.test.ts scripts/vs005-deploy-verify.test.ts scripts/vs005-rollback.test.ts
  npm.cmd exec -- tsc --noEmit -p tsconfig.scripts.json
  ```

- [ ] **Step 6: Inspect Task 7 safety and diff**

  ```powershell
  cd ..\..\
  git diff --check
  git diff -- apps/api/scripts/vs005-cloudflare-structured-inspection.ts apps/api/scripts/vs005-cloudflare-structured-inspection.test.ts apps/api/scripts/vs005-cloudflare-deployment-provider.ts apps/api/scripts/vs005-cloudflare-deployment-provider.test.ts apps/api/scripts/vs005-provider-observations.ts apps/api/scripts/vs005-provider-observations.test.ts
  ```

  Confirm authoritative observation contains no Wrangler call or CLI prose parser, credential source cannot select a target, absent Worker does not trigger dependent requests, and unsupported facts remain unavailable rather than copied from config.

- [ ] **Step 7: Commit Task 7**

  ```powershell
  git add apps/api/scripts/vs005-cloudflare-structured-inspection.ts apps/api/scripts/vs005-cloudflare-structured-inspection.test.ts apps/api/scripts/vs005-cloudflare-deployment-provider.ts apps/api/scripts/vs005-cloudflare-deployment-provider.test.ts apps/api/scripts/vs005-provider-observations.ts apps/api/scripts/vs005-provider-observations.test.ts
  git diff --cached --check
  git diff --cached --stat
  git diff --cached
  git commit -m "feat(vs005): compose structured Cloudflare inspection"
  ```

## Task 8: Replace constant planner flags with deterministic local readiness

**Files:**

- Create: `apps/api/scripts/vs005-local-deployment-readiness.ts`
- Create: `apps/api/scripts/vs005-local-deployment-readiness.test.ts`
- Modify: `apps/api/scripts/vs005-deploy-plan.ts`
- Modify: `apps/api/scripts/vs005-deploy-plan.test.ts`
- Test: `apps/api/scripts/vs005-generate-deployment.test.ts`
- Test: `apps/api/scripts/vs005-generate-web-config.test.ts`

**Interfaces consumed:** `buildCloudflareDeployment`, `buildCadencePublicWebConfig`, `fingerprintCadenceRuntimeConfig`, `CadenceRuntimeConfig`, `CadenceReleaseIdentity`, generated Wrangler shape, injected local command runner, injected file reader/existence checks, `.generated/cadence-public-config.json`, `apps/web/dist/index.html`, and its local asset references.

**Interfaces produced:**

```ts
export interface Vs005LocalDeploymentReadiness {
  generatedConfigValid: boolean;
  webBuildReady: boolean;
}

export interface Vs005LocalDeploymentReadinessIo {
  runCommand(argv: readonly string[]): Promise<void>;
  readText(path: string): string;
  fileExists(path: string): boolean;
}

export async function inspectVs005LocalDeploymentReadiness(input: {
  config: CadenceRuntimeConfig;
  configPath: string;
  release: CadenceReleaseIdentity;
  publicConfigPath: string;
  webDistPath: string;
  io: Vs005LocalDeploymentReadinessIo;
}): Promise<Vs005LocalDeploymentReadiness>;
```

- [ ] **Step 1: Write the focused failing local-readiness tests**

  Prove `generatedConfigValid` checks exact generated account, Worker, fingerprint, release values, assets, Cron, required secret name, workers.dev/routes, runtime-config canonical value, and compatibility fields; each tamper makes it false. Prove `webBuildReady` runs the existing config generation, TypeScript, and Vite Beta build argv; compares generated public JSON exactly with `buildCadencePublicWebConfig(config)`; rejects extra/server-only keys; requires `dist/index.html`; parses every generated `/assets/...` script/style reference; requires each referenced file; rejects traversal/non-local references; and fails on command/read/parse/missing-asset errors. Assert injected provider and hosted-HTTP call counts remain zero.

  Add a CLI dependency test showing `vs005-deploy-plan.ts` no longer supplies literal `generatedConfigValid: false` or `webBuildReady: false` and uses the helper result independently of provider observations.

- [ ] **Step 2: Run RED and record the constant-readiness defect**

  ```powershell
  cd apps/api
  node --import tsx --test scripts/vs005-local-deployment-readiness.test.ts scripts/vs005-deploy-plan.test.ts scripts/vs005-generate-deployment.test.ts scripts/vs005-generate-web-config.test.ts
  ```

  Expected RED: the helper is missing and the default planner still hard-codes both local readiness flags false.

- [ ] **Step 3: Implement the minimum local checks and planner wiring**

  Build and compare the deployment object in memory, then execute only local argv-array commands:

  ```ts
  ["node", "--import", "tsx", "scripts/vs005-generate-web-config.ts", "--config", configPath, "--out", publicConfigPath]
  ["npm.cmd", "--prefix", "../web", "exec", "--", "tsc", "-b"]
  ["npm.cmd", "--prefix", "../web", "exec", "--", "vite", "build", "--mode", "beta"]
  ```

  Validate generated public config and the built HTML/assets after successful commands. Return two bounded booleans; do not throw raw command errors into plan evidence. In `runCli`, call local readiness separately from `provider.inspect`, then copy the two values into `Vs005PlanInspection`. Provider observations cannot alter them.

- [ ] **Step 4: Run focused GREEN**

  ```powershell
  node --import tsx --test scripts/vs005-local-deployment-readiness.test.ts scripts/vs005-deploy-plan.test.ts scripts/vs005-generate-deployment.test.ts scripts/vs005-generate-web-config.test.ts
  ```

- [ ] **Step 5: Run Task 8 regressions and one real local Beta build**

  ```powershell
  cd ..\..\
  npm.cmd --prefix apps/web run build:beta
  npm.cmd --prefix apps/web test
  npm.cmd --prefix apps/web run lint
  npm.cmd --prefix apps/api run vs005:generate:ci
  npm.cmd run api:scripts:typecheck
  ```

  Expected: local Beta config generation, TypeScript, Vite build, referenced assets, CI deployment generation, and script typecheck pass without DNS or provider access.

- [ ] **Step 6: Inspect Task 8 safety and diff**

  ```powershell
  git diff --check
  git diff -- apps/api/scripts/vs005-local-deployment-readiness.ts apps/api/scripts/vs005-local-deployment-readiness.test.ts apps/api/scripts/vs005-deploy-plan.ts apps/api/scripts/vs005-deploy-plan.test.ts
  git status -sb
  ```

  Confirm ignored `.generated`, `dist`, and `wrangler.generated.jsonc` outputs are unstaged; no provider/hosted reader is called; no Beta config, HANDOFF, or DOCX change exists.

- [ ] **Step 7: Commit Task 8**

  ```powershell
  git add apps/api/scripts/vs005-local-deployment-readiness.ts apps/api/scripts/vs005-local-deployment-readiness.test.ts apps/api/scripts/vs005-deploy-plan.ts apps/api/scripts/vs005-deploy-plan.test.ts
  git diff --cached --check
  git diff --cached --stat
  git diff --cached
  git commit -m "fix(vs005): derive local deployment readiness"
  ```

## Task 9: Bind correlated inspection into planning and fresh apply reinspection

**Files:**

- Modify: `apps/api/scripts/vs005-deployment-artifacts.ts`
- Modify: `apps/api/scripts/vs005-deployment-artifacts.test.ts`
- Modify: `apps/api/scripts/vs005-deploy-plan.ts`
- Modify: `apps/api/scripts/vs005-deploy-plan.test.ts`
- Modify: `apps/api/scripts/vs005-deploy-apply.ts`
- Modify: `apps/api/scripts/vs005-deploy-apply.test.ts`
- Modify: `apps/api/scripts/vs005-cloudflare-deployment-provider.ts`
- Modify: `apps/api/scripts/vs005-cloudflare-deployment-provider.test.ts`

**Interfaces consumed:** `Vs005CorrelatedProviderInspection`, `Vs005ProviderObservationCorrelation`, `Vs005StructuredProviderObservationSnapshot`, `Vs005DeploymentPlanV2`, current config/target policy/fingerprint/release loaders, `validateVs005ObservationCompleteness`, exact mutation envelope, `CloudflareStructuredInspectionRequest`, local artifact preparation, and Wrangler provider mutation seam.

**Interfaces produced/changed:**

```ts
export interface Vs005DeploymentPlanV2 extends Vs005DeploymentPlan {
  formatVersion: 2;
  providerCorrelation: Vs005ProviderObservationCorrelation;
  observedProvider: Vs005StructuredProviderObservationSnapshot;
}

// Add these required members to the existing Vs005DeploymentResult.
interface Vs005DeploymentResultProviderEvidence {
  providerCorrelation: Vs005ProviderObservationCorrelation;
  observedProvider: Vs005StructuredProviderObservationSnapshot;
}

export interface Vs005DeploymentProvider {
  inspect(input: CloudflareStructuredInspectionRequest): Promise<Vs005CorrelatedProviderInspection>;
  deploy(input: Vs005DeploymentMutationInput): Promise<Vs005DeploymentMutationResult>;
}

export function withoutCloudflareInspectionCredential(
  parentEnvironment: Readonly<Record<string, string | undefined>>,
): NodeJS.ProcessEnv;
```

Keep plan format version 2 because it is the current pre-host reviewed plan authority, but make `providerCorrelation` mandatory and make `isVs005DeploymentPlanV2` reject artifacts that lack it. There is no hosted v2 artifact to migrate. Planning stores only safe correlation plus safe observations.

- [ ] **Step 1: Write the focused failing plan/apply/security tests**

  Planning tests: complete correlated first-deployment inspection produces PASS; target/fingerprint/profile mismatch blocks; completed-operation mismatch or missing required operation blocks; required unavailable blocks; absent Worker profile is accepted only with its exact completed-operation set and mutation envelope; local readiness stays independent; plan serialization rejects canaries and raw response fields.

  Apply tests: plan without correlation fails before inspection; current config/policy/fingerprint/release are revalidated; fresh `provider.inspect` receives a newly built first-deployment structured request; account, Worker, fingerprint, profile, operation-set, observation, Cron, secret, current deployment, or release drift fails with deploy call count zero; missing credential/required operation fails with mutationAttempted false; reviewed exact state reaches deploy once. Add an injected parent environment containing `CLOUDFLARE_INSPECTION_API_TOKEN` and a separate Wrangler deployment credential, capture the environment passed to the fake Wrangler/deployment spawn, and assert the inspection variable is absent while unrelated deployment authentication is unchanged. Test both deploy and rollback mutation paths plus apply's local `wrangler deploy --dry-run` child.

- [ ] **Step 2: Run RED and record missing correlation and child-env firewall**

  ```powershell
  cd apps/api
  node --import tsx --test scripts/vs005-deployment-artifacts.test.ts scripts/vs005-deploy-plan.test.ts scripts/vs005-deploy-apply.test.ts scripts/vs005-cloudflare-deployment-provider.test.ts
  ```

  Expected RED: v2 plans do not require correlation, apply's provider interface cannot request a fresh structured profile, and spawned child processes inherit `CLOUDFLARE_INSPECTION_API_TOKEN`.

- [ ] **Step 3: Implement minimum plan/apply correlation and child-environment sanitization**

  Store required correlation in v2 plans and compare it to intended target/fingerprint/profile before readiness PASS. At apply, reconstruct generated deployment identity from the revalidated current config/release, call structured inspection immediately before artifact preparation, require correlation equality and relevant observation equality with the reviewed plan, and retain existing database/destructive/mutation-envelope gates.

  For a proven absent Worker, calculate planner `hostnameReady` only from the correlated account-subdomain observation, canonical public hostname, canonical Worker, and generated `workers_dev` setting. Keep `observations.hostname` absent because no deployed Worker hostname was observed. For an existing Worker, require the observed Worker hostname value to match. This permits reviewed first creation without converting canonical values into provider evidence.

  ```ts
  export function withoutCloudflareInspectionCredential(parentEnvironment: NodeJS.ProcessEnv) {
    const childEnvironment = { ...parentEnvironment };
    delete childEnvironment.CLOUDFLARE_INSPECTION_API_TOKEN;
    return childEnvironment;
  }
  ```

  Pass this explicit environment to every local artifact/deployment Wrangler spawn and to provider deploy/rollback execution. If environment construction or injected spawn validation fails, throw a bounded pre-mutation error. Do not modify how Wrangler receives its separately governed deployment authentication.

- [ ] **Step 4: Run focused GREEN**

  ```powershell
  node --import tsx --test scripts/vs005-deployment-artifacts.test.ts scripts/vs005-deploy-plan.test.ts scripts/vs005-deploy-apply.test.ts scripts/vs005-cloudflare-deployment-provider.test.ts
  ```

- [ ] **Step 5: Run Task 9 regressions**

  ```powershell
  node --import tsx --test scripts/vs005-provider-observations.test.ts scripts/vs005-cloudflare-structured-inspection.test.ts scripts/vs005-local-deployment-readiness.test.ts scripts/vs005-deploy-verify.test.ts scripts/vs005-rollback.test.ts
  npm.cmd exec -- tsc --noEmit -p tsconfig.scripts.json
  ```

- [ ] **Step 6: Inspect Task 9 safety and diff**

  ```powershell
  cd ..\..\
  git diff --check
  git diff -- apps/api/scripts/vs005-deployment-artifacts.ts apps/api/scripts/vs005-deployment-artifacts.test.ts apps/api/scripts/vs005-deploy-plan.ts apps/api/scripts/vs005-deploy-plan.test.ts apps/api/scripts/vs005-deploy-apply.ts apps/api/scripts/vs005-deploy-apply.test.ts apps/api/scripts/vs005-cloudflare-deployment-provider.ts apps/api/scripts/vs005-cloudflare-deployment-provider.test.ts
  ```

  Confirm manual/plan-time evidence cannot substitute for fresh apply inspection, no mutation occurs before all gates, child env lacks the inspection token, and no plan/evidence contains credentials or raw provider material.

- [ ] **Step 7: Commit Task 9**

  ```powershell
  git add apps/api/scripts/vs005-deployment-artifacts.ts apps/api/scripts/vs005-deployment-artifacts.test.ts apps/api/scripts/vs005-deploy-plan.ts apps/api/scripts/vs005-deploy-plan.test.ts apps/api/scripts/vs005-deploy-apply.ts apps/api/scripts/vs005-deploy-apply.test.ts apps/api/scripts/vs005-cloudflare-deployment-provider.ts apps/api/scripts/vs005-cloudflare-deployment-provider.test.ts
  git diff --cached --check
  git diff --cached --stat
  git diff --cached
  git commit -m "fix(vs005): bind structured inspection before apply"
  ```

## Task 10: Bind post-deploy verification and explicit rollback version A

**Files:**

- Modify: `apps/api/scripts/vs005-deploy-verify.ts`
- Modify: `apps/api/scripts/vs005-deploy-verify.test.ts`
- Modify: `apps/api/scripts/vs005-rollback.ts`
- Modify: `apps/api/scripts/vs005-rollback.test.ts`
- Modify: `apps/api/scripts/vs005-cloudflare-deployment-provider.ts`
- Modify: `apps/api/scripts/vs005-cloudflare-deployment-provider.test.ts`

**Interfaces consumed:** correlated deployment result from Task 9, `POST_DEPLOYMENT_VERIFICATION`, `ROLLBACK_READINESS`, `currentDeployment`, current release/fingerprint, deployable version IDs, exact `CloudflareVersionIdentity`, existing verification readers/runtime probes, `Vs005RollbackRequest.expectedPriorVersionA`, and application-only Wrangler rollback.

**Interfaces produced/changed:** `Vs005VerificationReaders.inspectProvider` returns `Vs005CorrelatedProviderInspection`; `Vs005RollbackProvider.inspectTarget` consumes a `CloudflareStructuredInspectionRequest` with explicit `expectedPriorVersion`; verification and rollback accept no uncorrelated provider snapshot. Task 9's correlated `Vs005DeploymentResult` is consumed without another result format or authority.

- [ ] **Step 1: Write the focused failing verify/rollback tests**

  Verification: exact reviewed plan/apply correlation plus fresh post-deployment profile, Worker present, deployment ID, active provider version, account/Worker, release, fingerprint, Cron, secret name, and hostname yields PASS with `pilotActivation=NOT_AUTHORISED`; missing/mismatched correlation, operation set, deployment ID, provider version, account, Worker, release, fingerprint, Cron, secret, workers.dev, account subdomain, or required unavailable yields FAIL. Prove runtime/browser/health readers remain injected and no provider response can satisfy canonical policy.

  Rollback: explicit version A appears in complete `deployable=true` IDs and exact version detail matches request/evidence; absent ID, unavailable list, missing detail, ID/release/fingerprint mismatch, incomplete operation set, or current deployment mismatch fails before rollback call. Provide two eligible versions and prove no automatic selection; only request `expectedPriorVersionA.providerVersionId` is inspected and sent to rollback. Preserve database NONE and post-rollback structured verification.

  Serialize provider observations, errors, deployment plans/results, verification, and rollback evidence with canaries in headers/messages/authors/annotations/bindings/runtime JSON/secrets/exceptions and assert none survive except four validated identity values.

- [ ] **Step 2: Run RED and record uncorrelated verify/rollback behavior**

  ```powershell
  cd apps/api
  node --import tsx --test scripts/vs005-deploy-verify.test.ts scripts/vs005-rollback.test.ts scripts/vs005-deploy-apply.test.ts scripts/vs005-cloudflare-deployment-provider.test.ts
  ```

  Expected RED: verify readers currently return an uncorrelated snapshot, deployed provider version is not checked against fresh current-deployment facts, and rollback does not drive fixed deployable-list plus explicit-version inspection.

- [ ] **Step 3: Implement minimum verification and rollback integration**

  Require deployment correlation to match intended target and fresh verification correlation. Match `deployment.deploymentId` and `deployment.providerVersionId` to the current-deployment observation's bounded IDs/traffic before PASS. Use structured settings/Cron/hostname facts for existing checks. For rollback, construct the rollback profile with the exact prior version from governed request/evidence, require it in deployable IDs, require exact detail equality, then invoke the unchanged application rollback mutation boundary. Never derive version A from provider ordering.

- [ ] **Step 4: Run focused GREEN**

  ```powershell
  node --import tsx --test scripts/vs005-deploy-verify.test.ts scripts/vs005-rollback.test.ts scripts/vs005-deploy-apply.test.ts scripts/vs005-cloudflare-deployment-provider.test.ts
  ```

- [ ] **Step 5: Run Task 10 regressions**

  ```powershell
  node --import tsx --test scripts/vs005-cloudflare-structured-inspection.test.ts scripts/vs005-cloudflare-version-inspection.test.ts scripts/vs005-provider-observations.test.ts scripts/vs005-deployment-artifacts.test.ts scripts/vs005-deploy-plan.test.ts src/runtime/create-cadence-app.test.ts
  npm.cmd exec -- tsc --noEmit -p tsconfig.scripts.json
  ```

- [ ] **Step 6: Inspect Task 10 safety and diff**

  ```powershell
  cd ..\..\
  git diff --check
  git diff -- apps/api/scripts/vs005-deploy-verify.ts apps/api/scripts/vs005-deploy-verify.test.ts apps/api/scripts/vs005-rollback.ts apps/api/scripts/vs005-rollback.test.ts apps/api/scripts/vs005-cloudflare-deployment-provider.ts apps/api/scripts/vs005-cloudflare-deployment-provider.test.ts
  ```

  Confirm verification is read-only, rollback remains application-only and explicit, provider data cannot choose a target or version, and Pilot Activation remains not authorized.

- [ ] **Step 7: Commit Task 10**

  ```powershell
  git add apps/api/scripts/vs005-deploy-verify.ts apps/api/scripts/vs005-deploy-verify.test.ts apps/api/scripts/vs005-rollback.ts apps/api/scripts/vs005-rollback.test.ts apps/api/scripts/vs005-cloudflare-deployment-provider.ts apps/api/scripts/vs005-cloudflare-deployment-provider.test.ts
  git diff --cached --check
  git diff --cached --stat
  git diff --cached
  git commit -m "feat(vs005): bind structured verification and rollback"
  ```

## Task 11: Complete the local extension gate and readiness checkpoint

**Files:**

- Modify: `apps/api/scripts/vs005-t15a-readiness.ts`
- Modify: `apps/api/scripts/vs005-t15a-readiness.test.ts`
- Modify: `HANDOFF.md`
- Generate locally, keep ignored: `.cadence/vs005/t15a-local-readiness.json`
- Test: all structured inspection, VS005 deployment, VS003, VS004, API, web, and runtime-cloudflare suites listed below.

**Interfaces consumed:** all Task 1-10 interfaces, approved structured-inspection design and plan hashes, current source commit, canonical Beta config/fingerprint, existing T15-A hashes, focused/full test evidence, and governance counts.

**Interfaces produced:** extend `Vs005LocalReadinessArtifact` with:

```ts
structuredInspection: {
  designSha256: string;
  planSha256: string;
  status: "LOCAL_PROVIDER_INSPECTION_EXTENSION_VERIFIED";
  providerState: "NOT_OBSERVED";
  hostInspection: "NOT_AUTHORIZED";
  nextGate: "READY_FOR_HOST_READ_ONLY_PROVIDER_INSPECTION_REVIEW";
};
```

This remains ignored local evidence. It cannot contain credentials, provider responses, or claims about Worker/Cron/secret/release/hostname state.

- [ ] **Step 1: Write the final readiness RED test**

  In `vs005-t15a-readiness.test.ts`, require the two new approved-document hashes, local extension status, provider state not observed, host inspection not authorized, and exact next gate. Reject missing/invalid hashes, any PASS/observed hosted claim, and canaries in test summaries or evidence. Preserve target, database NONE, destructive empty, remote mutation not authorized, and Pilot Activation not authorized assertions.

- [ ] **Step 2: Run RED and record the missing final evidence fields**

  ```powershell
  cd apps/api
  node --import tsx --test scripts/vs005-t15a-readiness.test.ts
  ```

  Expected RED: `Vs005LocalReadinessArtifact` has no structured-inspection design/plan hashes, local extension status, unobserved-provider declaration, host-inspection firewall, or next-gate field.

- [ ] **Step 3: Implement minimum readiness fields and reconcile HANDOFF**

  Add required CLI arguments `--structured-inspection-design-sha256` and `--structured-inspection-plan-sha256`, validate them as SHA-256, emit only the fixed local statuses above, and preserve the existing sensitive-content filter.

  After Tasks 1-10 are committed, record `git rev-parse HEAD` as the implementation checkpoint before the HANDOFF edit. Add one concise HANDOFF checkpoint entry containing the approved design checkpoints `d9cd51d`, `8321b78`, and `9db8c29`; this plan's commit; Tasks 1-10 commits; local-only verification; structured host facts still unobserved; host inspection, remote mutation, clean-room, and Pilot Activation not authorized; VS004 recovery verified/closed; and unchanged 44/178 counts. Do not duplicate the technical design or claim hosted Task 15 evidence.

- [ ] **Step 4: Run readiness GREEN**

  ```powershell
  node --import tsx --test scripts/vs005-t15a-readiness.test.ts scripts/vs005-beta-config.test.ts scripts/vs005-package-wiring.test.ts
  ```

- [ ] **Step 5: Run the complete focused structured-inspection and VS005 suite**

  ```powershell
  node --import tsx --test `
    src/bootstrap/cadence-config.test.ts `
    src/bootstrap/cadence-release.test.ts `
    src/bootstrap/cadence-target-policy.test.ts `
    src/runtime/create-cadence-app.test.ts `
    scripts/vs005-cloudflare-readonly-transport.test.ts `
    scripts/vs005-cloudflare-current-deployment.test.ts `
    scripts/vs005-cloudflare-worker-settings.test.ts `
    scripts/vs005-cloudflare-cron-inspection.test.ts `
    scripts/vs005-cloudflare-version-inspection.test.ts `
    scripts/vs005-cloudflare-hostname-inspection.test.ts `
    scripts/vs005-cloudflare-structured-inspection.test.ts `
    scripts/vs005-local-deployment-readiness.test.ts `
    scripts/vs005-provider-observations.test.ts `
    scripts/vs005-cloudflare-deployment-provider.test.ts `
    scripts/vs005-deployment-artifacts.test.ts `
    scripts/vs005-deploy-plan.test.ts `
    scripts/vs005-deploy-apply.test.ts `
    scripts/vs005-deploy-verify.test.ts `
    scripts/vs005-rollback.test.ts `
    scripts/vs005-generate-deployment.test.ts `
    scripts/vs005-generate-web-config.test.ts `
    scripts/vs005-beta-config.test.ts `
    scripts/vs005-package-wiring.test.ts `
    scripts/vs005-t15a-readiness.test.ts
  ```

  Expected: PASS offline, including the full transport/parser/security matrices, real-local-readiness unit seam, correlation chain, fresh apply inspection, explicit rollback version, browser secret boundary, and authorization firewalls.

- [ ] **Step 6: Run VS003, VS004, and repository-wide regressions**

  ```powershell
  node --import tsx --test scripts/bootstrap-vs003-runtime.test.ts
  node --import tsx --test `
    scripts/vs004-controlled-pilot-artifact.test.ts `
    scripts/vs004-controlled-pilot-execute-cli.test.ts `
    scripts/vs004-controlled-pilot-execute-command.test.ts `
    scripts/vs004-controlled-pilot-execution.test.ts `
    scripts/vs004-controlled-pilot-file.test.ts `
    scripts/vs004-controlled-pilot-observation-adapters.test.ts `
    scripts/vs004-controlled-pilot-package.test.ts `
    scripts/vs004-controlled-pilot-preflight.test.ts `
    scripts/vs004-controlled-pilot-preflight-cli.test.ts `
    scripts/vs004-controlled-pilot-preflight-command.test.ts `
    scripts/vs004-controlled-pilot-runtime.test.ts `
    scripts/vs004-controlled-pilot-runtime-config.test.ts `
    scripts/vs004-pilot-manifest.test.ts `
    scripts/vs004-preflight.test.ts
  cd ..\..\
  npm.cmd --prefix apps/api run typecheck
  npm.cmd --prefix apps/api test
  npm.cmd run api:scripts:typecheck
  npm.cmd --prefix apps/web test
  npm.cmd --prefix apps/web run lint
  npm.cmd --prefix apps/web run build:beta
  npm.cmd --prefix apps/api run vs005:generate:ci
  npm.cmd --prefix apps/runtime-cloudflare test
  npm.cmd --prefix apps/runtime-cloudflare run typecheck
  npm.cmd --prefix apps/runtime-cloudflare run deploy:dry-run
  npm.cmd run quality
  ```

  Expected: all commands PASS locally. `build:beta`, `vs005:generate:ci`, and Wrangler `--dry-run` operate on local generated/build artifacts only. Do not run any plan/apply/verify/rollback CLI against a host and do not supply the inspection token.

- [ ] **Step 7: Run security, database, governance, coverage, and diff audits**

  ```powershell
  git grep -n "request(method\|request (method\|apiBase\|follow" -- apps/api/scripts/vs005-cloudflare-*.ts
  git grep -n "POST\|PUT\|PATCH\|DELETE\|/secrets" -- apps/api/scripts/vs005-cloudflare-readonly-transport.ts apps/api/scripts/vs005-cloudflare-structured-inspection.ts
  git grep -n "CLOUDFLARE_INSPECTION_API_TOKEN" -- apps/api/scripts
  git grep -n "SUPABASE_SECRET_KEY=" -- apps/api apps/web apps/runtime-cloudflare config
  git grep -n "44" -- docs/governance/CADENCE_PROJECT_SCOPE_BASELINE.md docs/governance/CADENCE_REQUIREMENT_TRACEABILITY.md
  git grep -n "178" -- docs/governance/CADENCE_REQUIREMENT_TRACEABILITY.md
  git diff --name-only -- supabase/migrations config/cadence.runtime.beta.json docs/superpowers/specs/2026-09-08-vs005-cloudflare-structured-readonly-inspection-design.md docs/2026-09-04-vs005-portable-deployment-runtime-implementation-plan.docx
  git diff --check
  git status -sb
  ```

  Inspect every match. Require no public generic client, mutation verb/secret endpoint in the inspection route set, all token references confined to credential intake/removal/tests, no secret assignment value, no migration/config/design/DOCX change, and exact 44/178 governance counts. Review the complete diff and map Sections 1-30 plus all 18 acceptance criteria using the matrices below. Any P0/P1 defect, database change, secret leak, remote operation, or unmapped criterion blocks the checkpoint.

- [ ] **Step 8: Commit Task 11, refresh ignored evidence, and verify final state**

  ```powershell
  git add apps/api/scripts/vs005-t15a-readiness.ts apps/api/scripts/vs005-t15a-readiness.test.ts HANDOFF.md
  git diff --cached --check
  git diff --cached --stat
  git diff --cached
  git commit -m "chore(vs005): verify structured inspection extension"
  $providerExtensionCommit = git rev-parse HEAD
  $structuredDesignHash = (Get-FileHash docs/superpowers/specs/2026-09-08-vs005-cloudflare-structured-readonly-inspection-design.md -Algorithm SHA256).Hash.ToLowerInvariant()
  $structuredPlanHash = (Get-FileHash docs/superpowers/plans/2026-09-08-vs005-cloudflare-structured-readonly-inspection.md -Algorithm SHA256).Hash.ToLowerInvariant()
  node --import tsx apps/api/scripts/vs005-t15a-readiness.ts --config config/cadence.runtime.beta.json --source-commit $providerExtensionCommit --t15a-design-sha256 0ac81c0fbd0fe3490d3181a80961517a49dfa99bcf03bf91e11125d667c6ddb8 --frozen-design-sha256 5b39d77044f3264a4181642b7e3081ee7eedcdc63ffd7f3c0e65d26dc91ff2a8 --frozen-plan-sha256 f1fb71197756ddc45606b062068c53703cffdf6f2dad69c00120178aa27949e1 --structured-inspection-design-sha256 $structuredDesignHash --structured-inspection-plan-sha256 $structuredPlanHash --release-version 0.0.0-structured-inspection --release-commit-sha $providerExtensionCommit --release-build-id 2026-09-08T00:00:00Z --test "structured inspection focused suite" --test "VS003 and VS004 regressions" --test "full API, web, and runtime-cloudflare quality" --out .cadence/vs005/t15a-local-readiness.json
  git status -sb
  git log -1 --oneline
  ```

  Expected final verdict: `LOCAL_PROVIDER_INSPECTION_EXTENSION_VERIFIED` and `READY_FOR_HOST_READ_ONLY_PROVIDER_INSPECTION_REVIEW`. The evidence remains ignored, the DOCX remains the only Git-visible untracked file, no staged change remains, and host inspection, deployment, remote mutation, clean-room work, and Pilot Activation remain unauthorized.

## Operation and test matrix

| Named operation | Fixed route | Task | RED/GREEN proof |
|---|---|---:|---|
| `inspectCurrentDeployment` | `/accounts/{accountId}/workers/scripts/{workerName}/deployments` | 2 | Worker present/latest/empty plus strict all-error not-found matrix |
| `inspectWorkerSettings` | `/accounts/{accountId}/workers/scripts/{workerName}/settings` | 3 | Binding completeness, required secret type, four identity values, all value exclusions |
| `inspectCronSchedules` | `/accounts/{accountId}/workers/scripts/{workerName}/schedules` | 4 | Bounded schedules, successful empty, malformed/incomplete/failure |
| `inspectDeployableVersions` | `/accounts/{accountId}/workers/scripts/{workerName}/versions?deployable=true` | 5 | Fixed query, complete IDs, retained version present/absent, no pagination |
| `inspectVersion` | `/accounts/{accountId}/workers/scripts/{workerName}/versions/{versionId}` | 5 | Exact ID, bounded identity/fingerprint, mismatch/unavailable |
| `inspectWorkersDevState` | `/accounts/{accountId}/workers/scripts/{workerName}/subdomain` | 6 | Enabled, disabled, malformed/missing |
| `inspectAccountWorkersDevSubdomain` | `/accounts/{accountId}/workers/subdomain` | 6 | Complete target argument, bounded label, Worker/fingerprint correlation |

## Design Section 1-30 mapping

| Design section | Implementation task(s) | Test/evidence |
|---:|---|---|
| 1. Purpose and blocker | 2, 7 | Strict structured not-found tests; default path contains no authoritative CLI parsing |
| 2. Scope/non-scope | All, 11 | Fixed file/operation scope; final remote/database/activation audit |
| 3. Authority model | 1, 7, 9, 10 | Target constructor, explicit policy regressions, correlation comparisons |
| 4. Transport trust | 1 | Fixed HTTPS origin, TLS/network, redirects, timeout, bounded-stream tests |
| 5. Credential abstraction | 1, 9 | Credential-only interface and mutation child-env exclusion tests |
| 6. M1 credential source | 1 | Missing/blank/value environment-provider tests and leakage assertions |
| 7. Least privilege | 1, 11 | No mutation route/verb; local documentation/evidence retains `Workers Scripts Read` host prerequisite |
| 8. Endpoint/redirect policy | 1 | Closed route union, encoded segments, manual redirect rejection |
| 9. Named GET-only interface | 1-7 | Seven operation signatures and inexpressible mutation tests |
| 10. Canonical target binding | 1, 6, 7, 9 | Generated account/name/fingerprint equality and non-Beta tests |
| 11. Structured errors | 1, 2 | Bounded failure enum and HTTP/provider/transport matrix |
| 12. Worker not found | 2 | Non-empty all-approved codes only; mixed/malformed/uncorrelated rejection |
| 13. Response allowlisting | 2-7, 10 | Per-parser canary tests and serialized evidence audit |
| 14. Secret from settings | 3 | Exact name/type, absent, wrong/duplicate, no `/secrets` route |
| 15. Operations/endpoints | 1-6 | Exact route assertions in operation matrix |
| 16. Observation mapping | 2-7 | Value/absent/unavailable matrix plus phase completeness |
| 17. Target/evidence correlation | 1, 7, 9, 10 | Correlation envelope in plan/apply/result/verify/rollback |
| 18. `inspectReadOnly` integration | 7, 8 | Structured default delegation and real local readiness |
| 19. Apply reinspection | 9 | Fresh call/order/drift/mutationAttempted=false tests |
| 20. Post-deploy verification | 10 | Fresh verification profile and deployment/version correlation |
| 21. Rollback readiness | 5, 7, 10 | Explicit version A list/detail and no auto-selection |
| 22. Offline TDD | All | Every code task has focused RED, minimum GREEN, and offline regressions |
| 23. Secret leakage | 1-3, 7, 9-11 | Credential/binding/raw-response/child-env/evidence canaries |
| 24. Portability | 1-7, 9-10 | Non-Beta target fixtures and injected policy boundaries |
| 25. Cost/dependency | 1, 11 | Built-in fetch; package diff confirms no dependency or paid component |
| 26. Certificate pinning | 1, 11 | Normal Node fetch only; no custom TLS agent/pinning controls |
| 27. Database/governance | All, 11 | No migration diff; database NONE; 44/178 grep and full regressions |
| 28. Migration path | 1-11 | Ordered commits from transport through final local evidence |
| 29. Acceptance criteria | 1-11 | Eighteen-row matrix below and final gate |
| 30. Decomposition | 1-11 | Eleven independently testable commits in approved order |

## Acceptance criteria mapping

| # | Approved acceptance criterion | Task(s) | Proof |
|---:|---|---:|---|
| 1 | Fixed production origin and GET only | 1 | URL/init assertions for all routes |
| 2 | Redirects, alternate origins, mutation verbs, and generic requests impossible/rejected | 1, 11 | Transport matrix and source audit |
| 3 | Credential provider only; no target influence | 1, 7 | Interface/fixture tests |
| 4 | Account/Worker/generated target/fingerprint correlation | 1, 6, 7, 9 | Target and evidence correlation tests |
| 5 | Worker absent only for correlated non-empty all-approved errors | 2 | 10007/10090/mixed/malformed matrix |
| 6 | Every uncertain condition unavailable | 1-7 | HTTP, transport, parser, and completeness cases |
| 7 | All required operations bounded; no raw response retention | 2-7 | Parser allowlists and canaries |
| 8 | 1 MiB bound before JSON parsing | 1 | Length/stream/exact-limit/parser-order tests |
| 9 | Secret presence from exact settings binding; no secret-list operation | 3, 11 | Secret matrix and route audit |
| 10 | Four plaintext identity values only | 3, 5 | Identity allowlist and runtime-JSON/arbitrary-value exclusion |
| 11 | Fixed `deployable=true`; no generic pagination | 5 | Exact URL and no pagination input tests |
| 12 | Existing plan/apply/verify/rollback authority/fingerprint chain reused | 9, 10 | Artifact and chain regressions |
| 13 | Task 6 fresh structured reinspection | 9 | Call ordering and stale-state failures before mutation |
| 14 | Inspection token removed from every mutation child | 9 | Injected spawn environments for dry-run/deploy/rollback |
| 15 | Real local `generatedConfigValid` and `webBuildReady` | 8 | Tamper/build/artifact tests and local Beta build |
| 16 | Adversarial credential/secret/plaintext/raw-output non-leakage | 1-3, 7, 9-11 | Serialized observations/plans/apply/verify/readiness/logger canaries |
| 17 | Generic non-Beta portability | 1-7, 9-10 | Alternate target/policy fixtures |
| 18 | No dependency, paid component, database action, remote operation, or mutation | All, 11 | Package/diff/database/command audits |

**Coverage result:** Design sections mapped `30/30`. Acceptance criteria mapped `18/18`. Original governed commitments removed `0`; original governed commitments moved beyond M3 `0`; parent commitments preserved `44`; child records preserved `178`.

## Execution stop conditions

Stop and return for governance review if implementation requires a new dependency, production API-origin override, non-GET inspection, generic provider client, credential-selected target, secret-list endpoint, raw response retention, write-capable inspection permission, certificate pinning, schema migration, database operation, weakened tri-state/completeness rule, automatic rollback selection, provider-state-to-canonical-authority promotion, or change to the 44/178 governance baseline.

Stop as blocked if the approved fixed endpoint cannot produce its required bounded fact under the read-only permission, a required response shape cannot be validated without retaining unsafe data, local build evidence cannot be made deterministic with existing scripts, or a P0/P1 regression remains after root-cause analysis.

No implementation task authorizes host inspection. Successful execution ends at `LOCAL_PROVIDER_INSPECTION_EXTENSION_VERIFIED` and `READY_FOR_HOST_READ_ONLY_PROVIDER_INSPECTION_REVIEW`; it does not mean ready for deployment, pilot readiness, or Pilot Activation.

# VS005 Task 9 / Task 10 Transition Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the structured Cloudflare inspection authority transition through a strict Task 9 plan/apply bridge and a separately reviewed Task 10 verification/rollback migration that closes the bridge.

**Architecture:** Task 9 uses the existing explicit `inspectStructured` facade for planning and fresh apply inspection, adds mandatory correlation to format-v2 plans, and returns a distinct strict `Vs005CorrelatedDeploymentResult` while leaving the shared base result and Task 10 consumers temporarily unchanged. Task 10 migrates verification and rollback to correlated structured authority, then removes deployment-workflow reliance on the legacy projection without introducing an overloaded or ambiguous inspection method.

**Tech Stack:** Node.js 24, TypeScript 7, Node test runner with `tsx`, existing Cadence canonical configuration and target policy, existing Cloudflare structured read-only provider facade, Wrangler 4.127.1 behind injected shell-free mutation seams, PowerShell and `npm.cmd` for Windows verification.

**Spec:** `docs/superpowers/specs/2026-09-09-vs005-task9-task10-transition-reconciliation-design.md`

## Authority and inheritance

- The original plan at `docs/superpowers/plans/2026-09-08-vs005-cloudflare-structured-readonly-inspection.md` remains authoritative for Tasks 1-8 and 11.
- This amendment supersedes the original Task 9 and Task 10 sequencing only where the reconciliation design conflicts with it.
- Every unaffected Task 9 and Task 10 requirement, test boundary, security control, regression, and commit gate remains inherited from the original plan.
- The reconciliation design is controlling authority for the temporary bridge and its closure.
- Creating this amendment authorizes no implementation, RED test, host inspection, Cloudflare or Supabase operation, deployment, rollback, database action, clean-room work, or Pilot Activation.

## Global constraints

- Execute exactly two implementation tasks and stop for review after each commit.
- Use strict RED -> GREEN sequencing. No production change may precede the observed RED for its task.
- Keep `Vs005DeploymentPlanV2.formatVersion` equal to `2`; require safe `providerCorrelation` and structured `observedProvider`.
- Keep base `Vs005DeploymentResult` unchanged during Task 9. Task 9 introduces `Vs005CorrelatedDeploymentResult` with mandatory correlation and structured observations.
- Task 9 planning and apply call the actual existing `inspectStructured(input)` method. They must not call legacy `inspect(config)` or `inspectTarget(...)` for authority.
- Do not add an overload or one method that accepts both legacy and structured authority shapes.
- Local readiness remains independent from provider observations.
- Preserve the exact apply event order `artifactPrepare -> dryRun -> freshInspection -> finalGate -> deploy`.
- Remove `CLOUDFLARE_INSPECTION_API_TOKEN` from every covered Wrangler or mutation child environment while preserving unrelated deployment authentication.
- Keep provider observations tri-state and bounded. Do not retain raw provider material, credentials, secret values, headers, messages, or exception text.
- Keep the Cloudflare inspection origin fixed and GET-only. No task here adds an inspection endpoint or mutation method.
- Keep database action `NONE`, destructive actions empty, and application rollback separate from database rollback.
- Use only injected provider, command, environment, filesystem, clock, and hosted-reader seams in tests. Do not perform a remote operation.
- Do not modify the frozen design, frozen original plan, Beta config, HANDOFF, known DOCX, dependency files, schema, or migrations.
- Do not push.

## Current interface map

Repository inspection at amendment time established these actual seams:

```ts
// vs005-cloudflare-deployment-provider.ts
inspectStructured(
  input: CloudflareStructuredInspectionRequest,
): Promise<Vs005CorrelatedProviderInspection>;

// Temporary legacy seams used by not-yet-migrated Task 10 consumers.
inspect(config: CadenceRuntimeConfig): Promise<Vs005DeploymentProviderInspection>;
inspectTarget(input?: { accountId: string; workerName: string }): Promise<unknown>;

// vs005-cloudflare-structured-inspection.ts
export interface CloudflareStructuredInspectionRequest {
  config: CadenceRuntimeConfig;
  release: CadenceReleaseIdentity;
  generatedConfig: GeneratedCloudflareDeployment["wrangler"];
  profile: Vs005ProviderInspectionProfile;
  expectedPriorVersion?: CloudflareVersionIdentity;
}
```

Task 9 must use `inspectStructured` explicitly and preserve the two legacy seams only for unchanged verification/rollback compilation. Task 10 migrates those consumers and then applies the bridge-closure rule.

## Original Task 9 / Task 10 reconciliation table

| Original requirement | Disposition | Amended authority and proof |
|---|---|---|
| Format-v2 plan correlation | Retained unchanged | Amended Task 9 requires `providerCorrelation` and structured `observedProvider`; the type guard rejects either missing field. |
| Deterministic local readiness | Retained unchanged | Amended Task 9 preserves Task 8 local booleans outside provider observations and proves provider values cannot set them. |
| Fresh apply inspection | Retained unchanged | Amended Task 9 calls `inspectStructured` after artifact preparation and dry-run. |
| Apply adjacency | Retained unchanged | Amended Task 9 records and asserts the exact five-event order. |
| Account/Worker/fingerprint/profile/operation/observation drift | Retained unchanged | Amended Task 9 table-driven drift tests require zero deploy calls. |
| Child-environment sanitization | Retained unchanged | Amended Task 9 covers dry-run, deploy, and the shared rollback mutation spawn environment without migrating rollback authority. Task 10 rechecks rollback use. |
| Mandatory correlation on shared `Vs005DeploymentResult` | Superseded by bridge | Amended Task 9 leaves the base result unchanged and introduces mandatory `Vs005CorrelatedDeploymentResult`. |
| Global replacement of `Vs005DeploymentProvider.inspect` | Superseded by bridge | Amended Task 9 uses existing `inspectStructured` explicitly; Task 10 later removes deployment-workflow legacy authority. |
| Post-deployment verification | Retained and kept in Task 10 | Amended Task 10 requires a fresh `POST_DEPLOYMENT_VERIFICATION` correlated inspection. |
| Rollback version A | Retained and kept in Task 10 | Amended Task 10 requires the explicit governed ID in the complete deployable set plus exact version detail. |
| Deployment/version correlation | Retained and kept in Task 10 | Amended Task 10 matches fresh current deployment and active provider version to correlated deployment evidence. |
| Evidence leakage controls | Retained unchanged | Both tasks serialize plans/results/errors and reject provider and credential canaries. |
| Database and Pilot firewalls | Retained unchanged | Both tasks assert database `NONE`, no destructive action, and Pilot Activation not authorized. |
| Legacy projection cannot authorize newly migrated paths | New bridge-specific requirement | Task 9 rejects it for plan/apply; Task 10 eliminates it from verification/rollback authority. |
| Independent apply and verify/rollback checkpoints | New bridge-specific requirement | Task 9 commits and stops before Task 10 begins. |

---

## Task 1: Amended Task 9 — Correlated plan/apply authority with staged compatibility bridge

**Files:**

- Modify: `apps/api/scripts/vs005-deployment-artifacts.ts`
- Modify: `apps/api/scripts/vs005-deployment-artifacts.test.ts`
- Modify: `apps/api/scripts/vs005-deploy-plan.ts`
- Modify: `apps/api/scripts/vs005-deploy-plan.test.ts`
- Modify: `apps/api/scripts/vs005-deploy-apply.ts`
- Modify: `apps/api/scripts/vs005-deploy-apply.test.ts`
- Modify: `apps/api/scripts/vs005-cloudflare-deployment-provider.ts`
- Modify: `apps/api/scripts/vs005-cloudflare-deployment-provider.test.ts`
- Must not modify: `apps/api/scripts/vs005-deploy-verify.ts`
- Must not modify: `apps/api/scripts/vs005-rollback.ts`

**Interfaces consumed:**

- `CloudflareStructuredInspectionRequest`
- existing `createCloudflareDeploymentProvider(...).inspectStructured(input)`
- `Vs005CorrelatedProviderInspection`
- `Vs005ProviderObservationCorrelation`
- `Vs005StructuredProviderObservationSnapshot`
- `buildCloudflareDeployment({ config, release }).wrangler`
- `validateVs005ObservationCompleteness`
- Task 8 `Vs005LocalDeploymentReadiness`
- current target-policy, release, fingerprint, mutation-envelope, database, and destructive-action gates

**Interfaces produced:**

```ts
// vs005-deployment-artifacts.ts
export interface Vs005DeploymentPlanV2 extends Vs005DeploymentPlan {
  formatVersion: 2;
  providerCorrelation: Vs005ProviderObservationCorrelation;
  observedProvider: Vs005StructuredProviderObservationSnapshot;
  observationPhase: "FIRST_DEPLOYMENT_READINESS";
  mutationEnvelope: Vs005MutationEnvelope;
}

// vs005-deploy-apply.ts
export interface Vs005CorrelatedDeploymentResult extends Vs005DeploymentResult {
  providerCorrelation: Vs005ProviderObservationCorrelation;
  observedProvider: Vs005StructuredProviderObservationSnapshot;
}

export interface Vs005DeploymentMutationInput {
  config: CadenceRuntimeConfig;
  generatedWranglerPath: string;
  childEnvironment: NodeJS.ProcessEnv;
  bootstrapSecrets?: CadenceResolvedSecrets;
}

export interface Vs005DeploymentMutationResult {
  deploymentId: string;
  providerVersionId: string;
}

export interface Vs005StructuredDeploymentProvider {
  inspectStructured(
    input: CloudflareStructuredInspectionRequest,
  ): Promise<Vs005CorrelatedProviderInspection>;
  deploy(input: Vs005DeploymentMutationInput): Promise<Vs005DeploymentMutationResult>;
}

export interface Vs005PreparedDeploymentArtifacts {
  generatedWranglerPath: string;
  generatedConfig: GeneratedCloudflareDeployment["wrangler"];
}

// applyVs005Deployment input additions/replacements
prepareArtifacts(input: {
  config: CadenceRuntimeConfig;
  release: CadenceReleaseIdentity;
}): Promise<Vs005PreparedDeploymentArtifacts>;
dryRun(input: {
  generatedWranglerPath: string;
  childEnvironment: NodeJS.ProcessEnv;
}): Promise<void>;
recordEvent(event: "finalGate"): void;

// vs005-cloudflare-deployment-provider.ts
export function withoutCloudflareInspectionCredential(
  parentEnvironment: Readonly<Record<string, string | undefined>>,
): NodeJS.ProcessEnv;
```

`Vs005DeploymentResult` remains byte-for-byte unchanged in Task 1. The new
correlated result is the only success type returned by `applyVs005Deployment`.
It is not a union with the base result and it has no optional correlation.

- [ ] **Step 1: Inspect the exact current Task 9 interfaces and freeze the file boundary**

  Read the eight listed implementation/test files, plus the Task 7 structured
  inspection and Task 8 local readiness modules. Record the current signatures
  of `isVs005DeploymentPlanV2`, `inspectVs005PlanInputs`,
  `applyVs005Deployment`, `inspectStructured`, `runWrangler`, and the base
  `Vs005DeploymentResult` before editing.

  Run:

  ```powershell
  cd apps/api
  rg -n "Vs005DeploymentPlanV2|isVs005DeploymentPlanV2|Vs005DeploymentResult|inspectVs005PlanInputs|applyVs005Deployment|inspectStructured|runWrangler" scripts
  cd ..\..\
  git status -sb
  ```

  Require only the known DOCX to be untracked. If a production file outside
  the Task 1 file list is required, stop for plan review before writing tests.

- [ ] **Step 2: Write the specific failing Task 9 tests**

  In `vs005-deployment-artifacts.test.ts`, add executable guard cases that use
  a complete literal format-v2 plan and assert:

  ```ts
  assert.equal(isVs005DeploymentPlanV2(completeCorrelatedPlan), true);
  assert.equal(isVs005DeploymentPlanV2({ ...completeCorrelatedPlan, providerCorrelation: undefined }), false);
  assert.equal(isVs005DeploymentPlanV2({ ...completeCorrelatedPlan, observedProvider: undefined }), false);
  ```

  The valid literal must use `profile: "FIRST_DEPLOYMENT_READINESS"`,
  `providerOrigin: "api.cloudflare.com"`, a canonical account/Worker/fingerprint,
  deterministic operation order, and a structured snapshot containing
  `currentDeployment`, `workersDevEnabled`, and
  `accountWorkersDevSubdomain`. Add a type-level assignment proving the base
  `Vs005DeploymentResult` is still constructible without correlation, and a
  runtime guard/helper assertion proving that base value cannot satisfy the
  correlated Task 9 result boundary.

  In `vs005-deploy-plan.test.ts`, change the provider fixture to return a full
  `Vs005CorrelatedProviderInspection`. Add concrete cases for:

  - exact correlated existing-Worker evidence produces `PASS` and stores only
    sanitized correlation plus structured observations;
  - account, Worker, config fingerprint, provider origin, and profile mismatch
    each produce `BLOCKED`;
  - a missing operation and an extra/reordered operation each produce
    `BLOCKED`;
  - every required `UNAVAILABLE` observation produces `BLOCKED`;
  - a proven absent Worker passes only with completed operations
    `CURRENT_DEPLOYMENT, ACCOUNT_SUBDOMAIN`, absent Worker-owned facts, and the
    exact create/change mutation envelope;
  - absent-Worker `observations.hostname` stays `OBSERVED_ABSENT` while
    `hostnameReady` derives from the account subdomain, canonical Worker,
    canonical public hostname, and generated `workers_dev`;
  - an existing Worker requires an actual matching observed hostname;
  - local readiness values come only from the injected local helper; and
  - legacy fixture fields, raw responses, messages, headers, and credential
    canaries are absent from serialized plans and blockers.

  Use a provider double with separate methods and counters:

  ```ts
  const provider = {
    structuredCalls: 0,
    legacyCalls: 0,
    async inspectStructured(request: CloudflareStructuredInspectionRequest) {
      provider.structuredCalls += 1;
      return correlatedInspection;
    },
    async inspect() {
      provider.legacyCalls += 1;
      throw new Error("LEGACY_AUTHORITY_FORBIDDEN");
    },
  };
  ```

  Assert planning calls `inspectStructured` once and legacy `inspect` zero
  times.

  In `vs005-deploy-apply.test.ts`, introduce an event recorder and separate
  injected `prepareArtifacts`, `dryRun`, `inspectStructured`, `finalGate`, and
  `deploy` seams. The valid case must assert exactly:

  ```ts
  assert.deepEqual(events, [
    "artifactPrepare",
    "dryRun",
    "freshInspection",
    "finalGate",
    "deploy",
  ]);
  ```

  Add cases proving:

  - a format-v2 plan without correlation fails before artifact preparation,
    either inspection method, or deployment;
  - canonical config, target policy, release, and fingerprint are freshly
    revalidated before artifact preparation;
  - structured inspection receives a newly built request with the exact
    canonical config, release, generated Wrangler object, and
    `FIRST_DEPLOYMENT_READINESS` profile;
  - legacy `inspect` is never called and cannot satisfy fresh inspection;
  - account, Worker, fingerprint, origin, profile, operation set, every
    structured observation, Cron, required secret, current deployment,
    release, and mutation-envelope drift each reject with deploy count `0`;
  - missing credential or required operation rejects with
    `mutationAttempted === false` and deploy count `0`;
  - every failure after `freshInspection` records no later artifact, build,
    file-preparation, dry-run, or second provider/network event;
  - successful apply returns `Vs005CorrelatedDeploymentResult` with mandatory
    safe correlation and structured observations;
  - a base result without correlation is rejected by the Task 9 correlated
    result assertion and cannot reach deploy; and
  - database or destructive-action failure remains pre-mutation.

  In `vs005-cloudflare-deployment-provider.test.ts`, change the fake
  `runWrangler` seam to capture both argv and child environment. With a parent
  environment containing:

  ```ts
  {
    CLOUDFLARE_INSPECTION_API_TOKEN: "inspection-token-canary",
    CLOUDFLARE_API_TOKEN: "deployment-auth-canary",
    UNRELATED_SETTING: "preserved",
  }
  ```

  assert dry-run, deploy, and rollback mutation children omit only
  `CLOUDFLARE_INSPECTION_API_TOKEN`; preserve `CLOUDFLARE_API_TOKEN` and
  `UNRELATED_SETTING`; use argv arrays; and never serialize either credential.
  The rollback case tests shared spawn sanitization only and does not add
  rollback readiness or structured rollback authority.

  Name each test after the concrete break it detects. Keep all fixtures local;
  no test may call DNS, Cloudflare, Supabase, or hosted Cadence.

- [ ] **Step 3: Run the exact Task 9 RED command and record the missing behavior**

  Run:

  ```powershell
  cd apps/api
  node --import tsx --test scripts/vs005-deployment-artifacts.test.ts scripts/vs005-deploy-plan.test.ts scripts/vs005-deploy-apply.test.ts scripts/vs005-cloudflare-deployment-provider.test.ts
  ```

  Expected RED reasons:

  - format-v2 plans without `providerCorrelation` are still accepted;
  - planner/apply do not yet require `inspectStructured`;
  - apply inspection currently precedes artifact preparation and dry-run;
  - no distinct mandatory correlated result exists; and
  - Wrangler child environments still inherit the inspection token.

  Confirm failures are caused by those missing Task 9 behaviors rather than a
  malformed fixture. Do not edit production code until this RED is observed.

- [ ] **Step 4: Implement the minimum Task 9 bridge and authority changes**

  In `vs005-deployment-artifacts.ts`, import the existing correlation and
  structured snapshot types, add required `providerCorrelation` to
  `Vs005DeploymentPlanV2`, narrow its `observedProvider` to
  `Vs005StructuredProviderObservationSnapshot`, and make
  `isVs005DeploymentPlanV2` fail closed unless both are structurally present.
  Validate the correlation's account, Worker, fingerprint, literal origin,
  profile, deterministic completed-operation array, and canonical timestamp
  shape before returning true.

  In `vs005-deploy-plan.ts`:

  - make `Vs005PlanInspection` carry a sanitized
    `Vs005CorrelatedProviderInspection` plus Task 8 local booleans;
  - call the existing `provider.inspectStructured(...)` with
    `buildCloudflareDeployment({ config, release }).wrangler` and profile
    `FIRST_DEPLOYMENT_READINESS`;
  - reject correlation target, fingerprint, origin, profile, and exact
    operation-set mismatch before `PASS`;
  - sanitize and store correlation and the full structured snapshot;
  - keep local readiness separate from provider data; and
  - calculate absent-Worker hostname readiness without changing
    `observations.hostname`.

  Use one module-owned expected-operation function whose literal outputs are:

  ```ts
  // Existing Worker
  [
    "CURRENT_DEPLOYMENT",
    "WORKER_SETTINGS",
    "CRON_SCHEDULES",
    "WORKER_SUBDOMAIN",
    "ACCOUNT_SUBDOMAIN",
  ]

  // Strictly proven absent Worker
  ["CURRENT_DEPLOYMENT", "ACCOUNT_SUBDOMAIN"]
  ```

  In `vs005-deploy-apply.ts`, leave `Vs005DeploymentResult` unchanged, define
  `Vs005CorrelatedDeploymentResult`, define the explicitly structured provider
  dependency, and return only the correlated result from
  `applyVs005Deployment`. Split preparation and dry-run dependencies so the
  production and test paths expose the required ordering. Build the structured
  request from freshly validated config/release and the deterministic generated
  Wrangler object.

  Complete all deterministic and bootstrap-secret preconditions before
  `inspectStructured`. After it returns, perform only bounded correlation,
  exact operation/observation equality, mutation-envelope, database,
  destructive-action, and sanitized-environment gates. Invoke the injected
  `finalGate` recorder immediately before `provider.deploy`.

  In `vs005-cloudflare-deployment-provider.ts`, implement:

  ```ts
  export function withoutCloudflareInspectionCredential(
    parentEnvironment: Readonly<Record<string, string | undefined>>,
  ): NodeJS.ProcessEnv {
    const childEnvironment = { ...parentEnvironment };
    delete childEnvironment.CLOUDFLARE_INSPECTION_API_TOKEN;
    return childEnvironment;
  }
  ```

  Extend the injected `runWrangler` seam to require an explicit sanitized child
  environment. Apply the helper before dry-run, deployment, and rollback
  mutation spawn. The default `spawn` call must remain argv-array based with
  `shell: false`. Do not remove or alter unrelated environment entries or the
  separately governed Wrangler deployment credential.

  Retain legacy `inspect(config)` and `inspectTarget(...)` only so unchanged
  Task 10 production consumers compile. Do not call them from planner or apply,
  do not convert their output to correlation, and do not add an overload.

- [ ] **Step 5: Run focused Task 9 GREEN**

  Run:

  ```powershell
  node --import tsx --test scripts/vs005-deployment-artifacts.test.ts scripts/vs005-deploy-plan.test.ts scripts/vs005-deploy-apply.test.ts scripts/vs005-cloudflare-deployment-provider.test.ts
  ```

  Require zero failures and the exact event-order, drift, correlated-result,
  legacy-rejection, and child-environment tests to pass offline.

- [ ] **Step 6: Run inherited Task 9 regressions**

  Run:

  ```powershell
  node --import tsx --test scripts/vs005-provider-observations.test.ts scripts/vs005-cloudflare-structured-inspection.test.ts scripts/vs005-local-deployment-readiness.test.ts scripts/vs005-deploy-verify.test.ts scripts/vs005-rollback.test.ts
  ```

  Require unchanged verification/rollback tests to pass through the temporary
  compatibility bridge. A failure requiring edits to `vs005-deploy-verify.ts`
  or `vs005-rollback.ts` stops Task 9 for plan review.

- [ ] **Step 7: Run Task 9 script typecheck**

  Run:

  ```powershell
  npm.cmd exec -- tsc --noEmit -p tsconfig.scripts.json
  ```

  Require success without changing Task 10-owned production files or making
  correlation optional.

- [ ] **Step 8: Inspect the complete Task 9 diff and safety boundary**

  Run from the repository root:

  ```powershell
  cd ..\..\
  git diff --check
  git diff -- apps/api/scripts/vs005-deployment-artifacts.ts apps/api/scripts/vs005-deployment-artifacts.test.ts apps/api/scripts/vs005-deploy-plan.ts apps/api/scripts/vs005-deploy-plan.test.ts apps/api/scripts/vs005-deploy-apply.ts apps/api/scripts/vs005-deploy-apply.test.ts apps/api/scripts/vs005-cloudflare-deployment-provider.ts apps/api/scripts/vs005-cloudflare-deployment-provider.test.ts
  git status -sb
  ```

  Confirm the full diff contains no Task 10 production edit, optional
  correlation, inspection overload, legacy Task 9 authority, post-inspection
  preparation, credential/raw-provider leakage, dependency change, database
  change, frozen-document change, remote operation, or Task 10 behavior.

- [ ] **Step 9: Stage exactly the Task 9 files**

  Run:

  ```powershell
  git add apps/api/scripts/vs005-deployment-artifacts.ts apps/api/scripts/vs005-deployment-artifacts.test.ts apps/api/scripts/vs005-deploy-plan.ts apps/api/scripts/vs005-deploy-plan.test.ts apps/api/scripts/vs005-deploy-apply.ts apps/api/scripts/vs005-deploy-apply.test.ts apps/api/scripts/vs005-cloudflare-deployment-provider.ts apps/api/scripts/vs005-cloudflare-deployment-provider.test.ts
  ```

- [ ] **Step 10: Run the cached whitespace and file-boundary checks**

  Run:

  ```powershell
  git diff --cached --check
  git diff --cached --stat
  git diff --cached --name-only
  ```

  Require exactly the eight Task 9 files listed above.

- [ ] **Step 11: Inspect the complete staged Task 9 diff**

  Run:

  ```powershell
  git diff --cached
  ```

  Reconfirm mandatory plan/result correlation, explicit `inspectStructured`
  use, exact apply order, zero legacy authorization, token removal, base-result
  compatibility, and unchanged Task 10 production files.

- [ ] **Step 12: Commit amended Task 9**

  Run:

  ```powershell
  git commit -m "fix(vs005): bind structured inspection before apply"
  ```

- [ ] **Step 13: Report Task 9 and stop for independent review**

  Report starting HEAD; exact RED and observed failures; GREEN, regression,
  and typecheck results; the exact correlated result type; confirmation that
  the base result is unchanged; structured planner and fresh apply call paths;
  legacy-path rejection; exact event order; every drift class; deploy count
  zero for failures; dry-run/deploy/rollback-spawn token firewall; preserved
  Wrangler deployment authentication; changed files; diff checks; commit SHA;
  final status; push `NO`; and Task 10 started `NO`.

  Stop Task 1 immediately if implementation requires modifying
  `vs005-deploy-verify.ts`, modifying `vs005-rollback.ts` for correlated
  authority/readiness, optional correlation, an ambiguous overload, legacy
  evidence satisfying a Task 9 gate, weakened apply adjacency, a remote
  provider/database operation, or Task 10 behavior.

---

## Task 2: Amended Task 10 — Verification/rollback migration and bridge closure

**Files:**

- Modify: `apps/api/scripts/vs005-deploy-verify.ts`
- Modify: `apps/api/scripts/vs005-deploy-verify.test.ts`
- Modify: `apps/api/scripts/vs005-rollback.ts`
- Modify: `apps/api/scripts/vs005-rollback.test.ts`
- Modify: `apps/api/scripts/vs005-cloudflare-deployment-provider.ts`
- Modify: `apps/api/scripts/vs005-cloudflare-deployment-provider.test.ts`
- Consume without expected modification: `apps/api/scripts/vs005-deploy-apply.ts`
- Consume without expected modification: `apps/api/scripts/vs005-deployment-artifacts.ts`

**Interfaces consumed:**

- Task 1 `Vs005CorrelatedDeploymentResult`
- `Vs005CorrelatedProviderInspection`
- `CloudflareStructuredInspectionRequest`
- actual `createCloudflareDeploymentProvider(...).inspectStructured(input)`
- `POST_DEPLOYMENT_VERIFICATION`
- `ROLLBACK_READINESS`
- `Vs005CurrentDeploymentIdentity`
- `Vs005RollbackRequest.expectedPriorVersionA`
- exact `CloudflareVersionIdentity`
- existing target policy, runtime/browser/health readers, application-only
  rollback mutation, database-`NONE`, and destructive-action gates

**Interfaces produced/changed:**

```ts
// vs005-deploy-verify.ts
export interface Vs005VerificationReaders {
  getWeb(): Promise<{ status: number }>;
  inspectBrowserBundle(): Promise<{
    status: number;
    forbiddenServerMarkersFound: boolean;
  }>;
  getHealth(): Promise<{ status: number; json: unknown }>;
  probeApi(): Promise<{ status: number }>;
  inspectProvider(
    request: CloudflareStructuredInspectionRequest,
  ): Promise<Vs005CorrelatedProviderInspection>;
  inspectRuntimeTarget(): Promise<{
    environment: string;
    safeTargetMarker: string;
    supabaseProjectRef: string | null;
    pilotProjectId: string | null;
  }>;
  probeControlledProject(): Promise<{
    status: number;
    projectId: string | null;
  }>;
}

// vs005-rollback.ts
export interface Vs005RollbackProvider {
  inspectStructured(
    request: CloudflareStructuredInspectionRequest,
  ): Promise<Vs005CorrelatedProviderInspection>;
  rollback(providerVersionId: string): Promise<{
    deploymentId: string;
    activeProviderVersionId: string;
  }>;
}
```

No shared or overloaded `inspect` method may accept both authority shapes.
After this task, deployment-workflow verification and rollback use only the
explicit structured method.

- [ ] **Step 1: Inspect the exact Task 10 consumers and Task 9 bridge commit**

  Read the committed Task 1 diff and the six Task 2 files. Confirm
  `Vs005CorrelatedDeploymentResult`, `inspectStructured`, correlation fields,
  child-environment sanitizer, and structured operation names exactly as
  committed.

  Run:

  ```powershell
  cd apps/api
  rg -n "Vs005CorrelatedDeploymentResult|inspectProvider|inspectStructured|inspectTarget|expectedPriorVersionA|ROLLBACK_READINESS|POST_DEPLOYMENT_VERIFICATION|currentDeployment|rollback\(" scripts/vs005-deploy-apply.ts scripts/vs005-deploy-verify.ts scripts/vs005-rollback.ts scripts/vs005-cloudflare-deployment-provider.ts
  cd ..\..\
  git status -sb
  ```

  Require a clean Task 1 checkpoint except the known DOCX. If Task 2 needs any
  production file beyond the six listed files, stop for plan review before
  tests.

- [ ] **Step 2: Write the specific failing Task 10 tests**

  In `vs005-deploy-verify.test.ts`, make the valid deployment fixture a
  `Vs005CorrelatedDeploymentResult` and make the provider reader accept a
  complete `CloudflareStructuredInspectionRequest`. Assert the request uses:

  ```ts
  {
    config: currentCanonicalConfig,
    release: deployment.release,
    generatedConfig: expectedGeneratedWrangler,
    profile: "POST_DEPLOYMENT_VERIFICATION",
  }
  ```

  Add one passing case requiring exact correlation, the complete expected
  operation set, Worker presence, matching current deployment ID, matching
  active provider version, release, fingerprint, Cron, required secret,
  workers.dev state, account subdomain, and hostname. Assert the result retains
  `pilotActivation: "NOT_AUTHORISED"`.

  Add individual fail-closed cases for missing or mismatched:

  - deployment-result correlation;
  - fresh account, Worker, fingerprint, origin, profile, or completed-operation
    set;
  - current deployment ID;
  - deployed provider version in `currentDeployment.versions`;
  - release or config fingerprint;
  - Cron schedule or required secret name;
  - `workersDevEnabled`, account subdomain, or hostname; and
  - any required `UNAVAILABLE` or unexpected `OBSERVED_ABSENT` fact.

  Give the provider double separate `inspectStructured` and legacy `inspect`
  counters. Assert verification calls structured once and legacy zero times.
  Keep browser, health, API, runtime-target, and controlled-project readers
  injected and prove no provider observation can replace canonical policy.

  In `vs005-rollback.test.ts`, use correlated current and target deployment
  evidence plus a request containing the explicit governed
  `expectedPriorVersionA`. Assert the structured request uses profile
  `ROLLBACK_READINESS` and carries exactly that expected version identity.

  Add concrete cases proving rollback is blocked before mutation when:

  - deployable versions are `OBSERVED_VALUE([])`;
  - a non-empty deployable list omits version A;
  - the list is `UNAVAILABLE` or malformed through the bounded facade;
  - exact version detail is absent or unavailable;
  - detail ID, release, or fingerprint differs from expected version A;
  - current deployment identity or active version differs from the rollback
    precondition;
  - correlation account, Worker, fingerprint, origin, profile, or operation set
    differs; or
  - database/destructive gates differ from `NONE`/empty.

  Add a two-version fixture:

  ```ts
  deployableVersions: observed(["version-B", "version-A"]),
  expectedPriorVersionA: {
    providerVersionId: "version-A",
    release: expectedReleaseA,
    configFingerprint: expectedFingerprintA,
  },
  ```

  Assert only `version-A` is passed to exact version inspection and rollback;
  list order never selects `version-B`. Assert the generic deployable-list
  observation remains `OBSERVED_VALUE([])` when empty and is not rewritten to
  `OBSERVED_ABSENT`.

  In `vs005-cloudflare-deployment-provider.test.ts`, prove verification and
  rollback call `inspectStructured`, rollback mutation still receives the
  sanitized environment, and legacy `inspect`/`inspectTarget` are not exposed
  as deployment-workflow authority after closure. If a legacy parser utility
  remains, assert it is separately named, isolated, and has no deploy,
  verification, rollback, correlation, or mutation-authority capability.

  Across verification and rollback tests, serialize results, failures, and
  captured logs containing provider header/message/author/annotation/runtime
  JSON/secret/exception canaries. Assert none survive except the four already
  approved validated identity values.

- [ ] **Step 3: Run the exact Task 10 RED command and record the legacy behavior**

  Run:

  ```powershell
  cd apps/api
  node --import tsx --test scripts/vs005-deploy-verify.test.ts scripts/vs005-rollback.test.ts scripts/vs005-deploy-apply.test.ts scripts/vs005-cloudflare-deployment-provider.test.ts
  ```

  Expected RED reasons:

  - verification still accepts an uncorrelated snapshot;
  - verification does not yet bind fresh deployment/version facts;
  - rollback still uses the legacy target projection;
  - rollback does not yet require structured deployable-list plus exact-version
    proof for governed version A; and
  - deployment-workflow legacy authority remains exposed.

  Confirm those missing Task 10 behaviors cause RED before editing production
  files.

- [ ] **Step 4: Implement the minimum verification/rollback migration and close the bridge**

  In `vs005-deploy-verify.ts`, require `Vs005CorrelatedDeploymentResult` and a
  structured provider reader. Build a fresh request from validated canonical
  config, deterministic generated Wrangler config, deployment release, and
  `POST_DEPLOYMENT_VERIFICATION`. Require exact correlation and the complete
  profile operation set. Match the fresh `currentDeployment.deploymentId` to
  `deployment.deploymentId` and require
  `deployment.providerVersionId` in its bounded active versions. Preserve all
  existing browser, health, API, runtime target, controlled Project, release,
  fingerprint, Cron, secret, workers.dev, hostname, database, and Pilot
  Activation gates.

  In `vs005-rollback.ts`, require correlated deployment evidence and replace
  legacy `inspectTarget` authority with `inspectStructured`. Build the
  `ROLLBACK_READINESS` request with the exact governed
  `expectedPriorVersionA`. Require:

  1. current deployment facts match the rollback precondition;
  2. deployable versions are a complete `OBSERVED_VALUE` list;
  3. that exact list contains `expectedPriorVersionA.providerVersionId`;
  4. the exact `VERSION` operation completed for that ID; and
  5. exact detail ID, release, and fingerprint equal governed version A.

  Interpret an empty list only at this composition boundary as proof that
  version A is not deployable. Do not alter the generic observation from
  `OBSERVED_VALUE([])`, inspect another ID, rank versions, or select from list
  order. Invoke application-only rollback with the explicit version A ID and
  retain database action `NONE`.

  In `vs005-cloudflare-deployment-provider.ts`, remove deployment-workflow
  reliance on legacy `inspect(config)` and `inspectTarget(...)` after both
  consumers migrate. Delete those facade methods unless a concrete isolated
  non-governed/test utility still requires them. A retained utility must have a
  separate non-authoritative name and must not return correlation or sit on the
  provider object used by plan/apply/verify/rollback. Keep
  `inspectStructured`, deploy, rollback, and the child-environment sanitizer.

  Do not add an overload, optional correlation, automatic version selection,
  database action, hosted operation, or Pilot authorization.

- [ ] **Step 5: Run focused Task 10 GREEN**

  Run:

  ```powershell
  node --import tsx --test scripts/vs005-deploy-verify.test.ts scripts/vs005-rollback.test.ts scripts/vs005-deploy-apply.test.ts scripts/vs005-cloudflare-deployment-provider.test.ts
  ```

  Require zero failures, legacy counters at zero, exact version-A selection,
  empty-list semantics, deployment/version correlation, and sanitized rollback
  mutation environment.

- [ ] **Step 6: Run inherited Task 10 regressions and bridge-closure audit**

  Run:

  ```powershell
  node --import tsx --test scripts/vs005-cloudflare-structured-inspection.test.ts scripts/vs005-cloudflare-version-inspection.test.ts scripts/vs005-provider-observations.test.ts scripts/vs005-deployment-artifacts.test.ts scripts/vs005-deploy-plan.test.ts src/runtime/create-cadence-app.test.ts
  rg -n "\.inspect\(config\)|inspectTarget\(" scripts/vs005-deploy-plan.ts scripts/vs005-deploy-apply.ts scripts/vs005-deploy-verify.ts scripts/vs005-rollback.ts
  ```

  The test command must pass. The authority audit must return no legacy
  inspection call from plan, apply, verify, or rollback. Inspect any textual
  match rather than relying on its presence or absence alone.

- [ ] **Step 7: Run Task 10 script typecheck**

  Run:

  ```powershell
  npm.cmd exec -- tsc --noEmit -p tsconfig.scripts.json
  ```

  Require success with the correlated result flowing through plan -> apply ->
  verify -> rollback as applicable and no ambiguous provider overload.

- [ ] **Step 8: Inspect the complete Task 10 diff and closure boundary**

  Run from the repository root:

  ```powershell
  cd ..\..\
  git diff --check
  git diff -- apps/api/scripts/vs005-deploy-verify.ts apps/api/scripts/vs005-deploy-verify.test.ts apps/api/scripts/vs005-rollback.ts apps/api/scripts/vs005-rollback.test.ts apps/api/scripts/vs005-cloudflare-deployment-provider.ts apps/api/scripts/vs005-cloudflare-deployment-provider.test.ts
  git status -sb
  ```

  Confirm verification and rollback are structured and correlated; no
  deployment workflow authority uses legacy projection; no overload exists;
  version A is explicit; list order has no authority; inspection token remains
  absent from rollback mutation children; database remains `NONE`; Pilot
  Activation remains unauthorized; and no dependency, schema, migration,
  frozen-document, Beta-config, HANDOFF, remote-operation, or raw-evidence
  change exists.

- [ ] **Step 9: Stage exactly the Task 10 files**

  ```powershell
  git add apps/api/scripts/vs005-deploy-verify.ts apps/api/scripts/vs005-deploy-verify.test.ts apps/api/scripts/vs005-rollback.ts apps/api/scripts/vs005-rollback.test.ts apps/api/scripts/vs005-cloudflare-deployment-provider.ts apps/api/scripts/vs005-cloudflare-deployment-provider.test.ts
  ```

- [ ] **Step 10: Run the cached whitespace and file-boundary checks**

  Run:

  ```powershell
  git diff --cached --check
  git diff --cached --stat
  git diff --cached --name-only
  ```

  Require exactly the six Task 10 files.

- [ ] **Step 11: Inspect the complete staged Task 10 diff**

  Run:

  ```powershell
  git diff --cached
  ```

  Reconfirm fresh post-deployment correlation, current deployment/version
  matching, explicit version A, complete list plus exact detail, no legacy
  deployment-workflow authority, token removal, database `NONE`, and no Pilot
  authorization.

- [ ] **Step 12: Commit amended Task 10**

  Run:

  ```powershell
  git commit -m "feat(vs005): bind structured verification and rollback"
  ```

- [ ] **Step 13: Report Task 10 and stop for independent review**

  Report starting HEAD; exact RED and observed failures; GREEN, regression,
  audit, and typecheck results; correlated result consumption; fresh
  verification profile and operation set; deployment/version matching; exact
  rollback version A request, list-membership proof, exact-detail proof, and
  two-version no-auto-selection evidence; legacy authority closure; rollback
  token firewall; database `NONE`; Pilot Activation not authorized; changed
  files; diff checks; commit SHA; final status; and push `NO`.

  Task 2 is not complete unless no plan/apply/verify/rollback authority depends
  on legacy projection. Stop for plan review if closure would require optional
  correlation, an ambiguous overload, provider-selected rollback target,
  database action, remote operation, or a production file outside the stated
  boundary.

---

## Reconciliation design coverage

| Reconciliation design section | Implementing step or proof |
|---|---|
| 1. Purpose and authority | Authority/inheritance header; both tasks' scope and stop gates |
| 2. Sequencing defect | Original-requirement table; Task 1 base/correlated split; Task 2 migration |
| 3. Option A bridge | Task 1 Steps 2-4 and Task 2 Steps 2-4 |
| 4. Task 9 authority | Task 1 planner/apply RED and GREEN steps |
| 5. Correlated result bridge | Task 1 interface block and artifact/apply tests |
| 6. Provider interface bridge | Current interface map; Task 1 explicit `inspectStructured` tests |
| 7. Legacy projection firewall | Task 1 legacy counters and rejection tests; Task 2 closure audit |
| 8. Apply adjacency | Task 1 exact five-event test and bounded post-inspection implementation |
| 9. First-deployment absence | Task 1 absent-Worker operation, hostname, and envelope cases |
| 10. Task 10 closure | Task 2 verification/rollback migration and closure audit |
| 11. Rejected alternatives | Global constraints and both tasks' stop conditions |
| 12. Unchanged invariants | Global constraints plus both tasks' security/diff reviews |
| 13. Authorization firewall | Global offline constraints and no-remote verification commands |
| 14. Success criteria | Task 1 and Task 2 report/stop steps |
| 15. Implementation review gates | Focused GREEN, regressions, typecheck, full/cached diff steps |
| 16. Governance reconciliation | Database/Pilot/frozen-document checks in both task diff reviews |

Coverage requirement: all 16 reconciliation-design sections are mapped. A
missing row blocks amendment execution.

## Original structured-inspection acceptance coverage

| Original acceptance criterion | Preserved proof after amendment |
|---|---|
| 1. Fixed production origin and GET only | Inherited Tasks 1-7 tests; neither amended task changes the transport. |
| 2. No redirect, arbitrary origin, mutation verb, or generic request | Inherited transport tests and both task diff audits. |
| 3. Credential provider cannot select target | Inherited target tests; amended structured requests derive target from canonical config. |
| 4. Account/Worker/generated target/fingerprint correlation | Task 1 plan/apply correlation tests; Task 2 verify/rollback correlation tests. |
| 5. Worker absence only from strict structured codes | Inherited Task 2 parser; Task 1 accepts only the correlated absent profile. |
| 6. Uncertainty remains `UNAVAILABLE` | Both tasks' required-unavailable matrices. |
| 7. Bounded observations and no raw response retention | Both tasks' serialization canaries and inherited parser tests. |
| 8. One-MiB bound before parsing | Inherited Task 1 transport tests. |
| 9. Secret presence from exact settings binding | Inherited Task 3 parser; Task 1/2 secret-state comparisons. |
| 10. Four plaintext identity values only | Inherited Tasks 3/5; both task evidence-leakage tests. |
| 11. Fixed `deployable=true`, no generic pagination | Inherited Task 5; Task 2 consumes the complete list without altering it. |
| 12. Plan/apply/verify/rollback authority chain | Task 1 establishes plan/apply correlation; Task 2 extends it through verify/rollback. |
| 13. Fresh structured apply reinspection | Task 1 exact adjacency and stale-state tests. |
| 14. Inspection token removed from mutation children | Task 1 dry-run/deploy/shared rollback-spawn tests; Task 2 rollback recheck. |
| 15. Real deterministic local readiness | Inherited Task 8 plus Task 1 provider-independence regression. |
| 16. Credential/secret/plaintext/raw-output non-leakage | Both tasks' adversarial serialization tests. |
| 17. Generic non-Beta portability | Inherited Tasks 1-7 and existing target-policy injection retained by both tasks. |
| 18. No dependency, paid component, database action, remote operation, or mutation during implementation | Both tasks' offline commands and complete diff audits. |

Coverage requirement: all 18 original acceptance criteria remain mapped. The
amendment removes none of the original Task 9/10 acceptance intent.

## Amendment execution stop conditions

Stop and return for plan review if either task requires optional correlation,
an ambiguous provider overload, legacy evidence at a newly migrated authority
gate, automatic rollback selection, post-inspection long-running preparation,
a new dependency, schema/migration/database action, frozen-document or Beta
target change, host/provider operation, clean-room operation, or Pilot
Activation. Task 1 additionally stops before any Task 10 production edit. Task
2 stops unless the legacy deployment-workflow authority bridge is fully closed.

No implementation is authorized by this amendment document itself.

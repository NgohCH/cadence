# VS005 T15-A Target Contract Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile Cadence's canonical runtime configuration, deployment plan, provider observation, apply, verify, rollback, Beta configuration, and local evidence boundaries so the reviewed Beta target is fail-closed without preventing a separately authorized future target.

**Architecture:** Keep generic canonical configuration validation portable and put the exact reviewed Beta tuple in an injected Task 15 target policy. Represent provider facts as safe tri-state observations with phase-specific completeness, then bind the intended target, observed snapshot, release, fingerprint, mutation envelope, and database `NONE` declaration through the existing plan -> apply -> verify -> rollback artifacts. Cloudflare remains an adapter boundary; Supabase remains authoritative persistence and is not contacted by T15-A implementation work.

**Tech Stack:** TypeScript 7, Node 24, Node test runner through `tsx`, Ajv 8, JSON Schema draft-07, Express runtime composition, Cloudflare Workers adapter, Wrangler 4.127.1, Vite, npm workspaces-by-prefix, PowerShell, and Git.

**Spec:** `docs/superpowers/specs/2026-09-07-vs005-task15a-target-contract-reconciliation-design.md`

## Source Provenance

- Starting repository HEAD: `7f2f03f` (`docs(vs005): refine Task 15 target contract`).
- T15-A design freeze: `7800e04` (`docs(vs005): define Task 15 target contract`).
- T15-A design amendment: `7f2f03f` (`docs(vs005): refine Task 15 target contract`).
- Approved T15-A design at starting HEAD `7f2f03f`: `0ac81c0fbd0fe3490d3181a80961517a49dfa99bcf03bf91e11125d667c6ddb8`.
- Frozen VS005 design: `5b39d77044f3264a4181642b7e3081ee7eedcdc63ffd7f3c0e65d26dc91ff2a8`.
- Frozen VS005 implementation plan: `f1fb71197756ddc45606b062068c53703cffdf6f2dad69c00120178aa27949e1`.

These hashes are read-only provenance. The three source records remain unmodified by this plan-creation checkpoint.

## Global Constraints

- Preserve the exact reviewed target: `environment=beta`, `safeTargetMarker=cadence-beta`, Cloudflare account `3d6a31905ac44e9563a523f9c86cbb8d`, Worker `mycadence`, public URL `https://mycadence.ngohch-3d6.workers.dev`, Supabase ref `pwmhasbmacmeerbsagda`, and controlled Project `3503f8c7-1996-44d1-8b63-1fca36db89f8`.
- `cadence-beta` is the Beta environment/safe marker and Supabase operator-facing display label; `mycadence` is the reviewed Cloudflare Worker name.
- Generic configuration validation must not hard-code the reviewed Beta account, Worker, Supabase ref, or controlled Project IDs.
- The exact Beta target policy must reject `cadence-dev`, the unrelated QA Project `07e20000-0000-4000-8000-000000000001`, and every structurally valid alternate target.
- No provider credential, API token, OAuth material, Supabase privileged secret, or secret value may enter canonical JSON, plan artifacts, evidence, logs, browser/static output, Git, or command arguments.
- `SUPABASE_SECRET_KEY` remains a named external Worker secret binding. Secret values remain outside the repository and are handled only at the existing Task 12 provider boundary.
- Every inspected provider fact uses `OBSERVED_VALUE`, `OBSERVED_ABSENT`, or `UNAVAILABLE`. `UNAVAILABLE` hard-fails a phase-required fact; expected `OBSERVED_ABSENT` is accepted only when the reviewed mutation envelope explicitly creates or sets the absent item.
- First-deployment readiness does not require a prior deployment/version. Rollback readiness requires explicit retained version A, current version identity, target identity, rollback availability, and applicable release/configuration fingerprints.
- `database.migrationAction=NONE` is mandatory. New migration, reset, repair, reversal, database rollback, and ad hoc destructive SQL are prohibited.
- All provider tests use injected offline fixtures. T15-A implementation tasks perform no Cloudflare call, Supabase call, remote deployment, Cron operation, hosted HTTP verification, or hosted application write.
- Plan generation remains read-only. Apply remains blocked by stale target, stale fingerprint, stale release, target drift, observation incompleteness, unexpected secret-state change, database action, or destructive action.
- Preserve VS001-VS004 behavior, `ProjectAuthorisationService`, module ownership, API-only browser business data, R03 history hardening, the 44 governed parent commitments, and the 178 child traceability records.
- Pilot Activation, real-user admission, production launch, M1 closure, clean-room infrastructure selection, and clean-room execution remain separately unauthorized.
- Do not modify the frozen VS005 design or frozen VS005 implementation plan.

## Repository Map and Existing Boundaries

The implementation follows the existing repository names and contracts:

- `apps/api/src/bootstrap/cadence-config-schema.ts` is the executable Ajv schema source.
- `config/cadence.runtime.schema.json` is the serialization-equivalent tracked schema.
- `apps/api/src/bootstrap/cadence-config.ts` owns `CadenceRuntimeConfig`, loading, semantic checks, secret resolution, and `fingerprintCadenceRuntimeConfig`.
- `apps/api/src/bootstrap/environment-safety.ts` owns general environment/Supabase URL safety and must not become the Beta target singleton.
- `apps/api/scripts/vs005-generate-deployment.ts` produces `GeneratedCloudflareDeployment` and currently derives the Worker name from environment; T15-A changes this to the explicit Cloudflare target.
- `apps/api/scripts/vs005-deployment-artifacts.ts` owns versioned safe deployment-plan/failure contracts.
- `apps/api/scripts/vs005-deploy-plan.ts` owns read-only planning and currently accepts a boolean/string inspection shape that must become phase-scoped observations.
- `apps/api/scripts/vs005-deploy-apply.ts` owns plan-bound revalidation and the provider deployment boundary.
- `apps/api/scripts/vs005-deploy-verify.ts` owns injected web/API/provider verification and `pilotActivation: "NOT_AUTHORISED"`.
- `apps/api/scripts/vs005-cloudflare-deployment-provider.ts` owns Cloudflare I/O, safe secret transport, bounded provider identifiers, and rollback provider calls.
- `apps/api/scripts/vs005-rollback.ts` owns application-version rollback only and already rejects database rollback intent.
- `docs/runbooks/VS005_DEPLOYMENT.md` is the current operator deployment boundary.
- `config/cadence.runtime.beta.json` is the known untracked early-preparation file and is reconciled only in Task 8 of this plan.
- `HANDOFF.md` is stale at `305d123`; its narrow reconciliation is performed only in Tasks 9 and 10.

The current history establishes the reason for the boundaries: Tasks 3-4 centralized configuration and target safety, Task 10 added the Cloudflare adapter, Task 11 added read-only plan artifacts, Task 12 added plan-bound apply/verify and secret transport, Task 13 added application rollback, and Task 14 added CI/runbook wiring. The T15-A changes extend those boundaries without replacing them.

---

### Task 1: Extend the canonical Cloudflare target model and generic validation

**Files:**
- Modify: `config/cadence.runtime.schema.json`
- Modify: `config/cadence.runtime.example.json`
- Modify: `config/cadence.runtime.ci.json`
- Modify: `apps/api/src/bootstrap/cadence-config-schema.ts`
- Modify: `apps/api/src/bootstrap/cadence-config.ts`
- Modify: `apps/api/src/bootstrap/cadence-config.test.ts`
- Modify: `apps/api/scripts/vs005-generate-deployment.ts`
- Modify: `apps/api/scripts/vs005-generate-deployment.test.ts`

**Interfaces:**
- Consumes: `CADENCE_RUNTIME_CONFIG_SCHEMA`, `CadenceRuntimeConfig`, `validateCadenceRuntimeConfig`, `fingerprintCadenceRuntimeConfig`, `buildCloudflareDeployment`, `GeneratedCloudflareDeployment`.
- Produces: `CadenceCloudflareTarget { accountId: string; workerName: string }`; `CadenceRuntimeConfig.cloudflare?: CadenceCloudflareTarget`; the generated Cloudflare name is `config.cloudflare.workerName` after Cloudflare-provider validation.

- [ ] **Step 1: Write the failing generic-model and generator tests**

  Extend the existing `valid` fixture in `apps/api/src/bootstrap/cadence-config.test.ts` and the generator fixture in `apps/api/scripts/vs005-generate-deployment.test.ts` with:

  ```ts
  cloudflare: {
    accountId: "account-123",
    workerName: "worker-test",
  }
  ```

  Add tests named `rejects a Cloudflare config without accountId`, `rejects a Cloudflare config without workerName`, `accepts a structurally valid alternate Cloudflare target`, `fingerprint includes the Cloudflare target`, and `generator uses the explicit Worker name`. The alternate target must use non-Beta values and must pass generic validation. The generator assertion must prove `wrangler.name === config.cloudflare.workerName` and must prove the embedded canonical JSON contains the same block.

- [ ] **Step 2: Run the focused tests to observe RED**

  Run:

  ```powershell
  cd apps/api
  node --import tsx --test src/bootstrap/cadence-config.test.ts scripts/vs005-generate-deployment.test.ts
  ```

  Expected: FAIL because the current schema rejects the new top-level `cloudflare` property, `CadenceRuntimeConfig` has no Cloudflare target field, the fingerprint omits it, and the generator still emits `cadence-${environment}`.

- [ ] **Step 3: Add the provider-specific JSON Schema extension**

  Add an optional top-level `cloudflare` object with `additionalProperties: false`, `accountId` and `workerName` string fields, and a conditional schema rule requiring both fields when `runtime.provider` is `cloudflare`. Keep the top-level schema portable: do not place `3d6a31905ac44e9563a523f9c86cbb8d`, `mycadence`, `pwmhasbmacmeerbsagda`, or `3503f8c7-1996-44d1-8b63-1fca36db89f8` in either generic schema source.

- [ ] **Step 4: Extend TypeScript loading, semantic validation, and fingerprinting**

  Add `CadenceCloudflareTarget` and the optional `cloudflare` property to `CadenceRuntimeConfig`. In `validateSemanticConfiguration`, require the object and both nonblank safe identifiers only when `runtime.provider === "cloudflare"`; permit the Node local path without the Cloudflare block. Include `cloudflare.accountId` and `cloudflare.workerName` in the canonical fingerprint in a fixed object position, using `null` for the Node path. Preserve the existing URL, Supabase, retry, secret-reference, resource-limit, and environment safety checks.

- [ ] **Step 5: Change the Cloudflare generator to consume explicit Worker identity**

  After the provider check, read the validated `config.cloudflare.workerName` and assign it to `wrangler.name`. Keep `config.cloudflare.accountId` as canonical target metadata and do not emit it as a secret or infer a Worker name from `application.environment`. Keep `CADENCE_RUNTIME_CONFIG_JSON`, the fingerprint, release metadata, Cron, assets, and named secret declarations derived from the same config.

- [ ] **Step 6: Update portable fixtures and executable-schema serialization**

  Add non-secret example values such as `account-example`/`worker-example` and CI values such as `account-ci`/`worker-ci` to the tracked example and CI fixtures. Run `apps/api/scripts/vs005-write-config-schema.ts` only if its existing generation path requires it, then ensure `config/cadence.runtime.schema.json` is byte-for-byte serialization-equivalent to `CADENCE_RUNTIME_CONFIG_SCHEMA` through the existing test. Do not add Beta IDs to generic fixtures.

- [ ] **Step 7: Run GREEN and regression checks**

  Run:

  ```powershell
  cd apps/api
  node --import tsx --test src/bootstrap/cadence-config.test.ts scripts/vs005-generate-deployment.test.ts
  npx.cmd tsc --noEmit -p tsconfig.json
  cd ..\..\
  git diff --check
  ```

  Expected: PASS, including the alternate-target generic acceptance and explicit Worker-name generation. No test may assert that a generic Beta or production target is mandatory.

- [ ] **Step 8: Commit the canonical model boundary**

  ```powershell
  git add config/cadence.runtime.schema.json config/cadence.runtime.example.json config/cadence.runtime.ci.json apps/api/src/bootstrap/cadence-config-schema.ts apps/api/src/bootstrap/cadence-config.ts apps/api/src/bootstrap/cadence-config.test.ts apps/api/scripts/vs005-generate-deployment.ts apps/api/scripts/vs005-generate-deployment.test.ts
  git diff --cached --check
  git commit -m "feat(vs005): add explicit Cloudflare target model"
  ```

**Checkpoint deliverable:** Generic canonical configuration accepts any structurally valid authorized provider target, Cloudflare configurations require explicit account/Worker identity, the fingerprint carries both values, and generation no longer derives Worker identity from environment.

---

### Task 2: Add the explicit Task 15 Beta target policy

**Files:**
- Create: `apps/api/src/bootstrap/cadence-target-policy.ts`
- Create: `apps/api/src/bootstrap/cadence-target-policy.test.ts`

**Interfaces:**
- Consumes: `CadenceRuntimeConfig`, `CadenceEnvironment`, `CadenceCloudflareTarget` from `apps/api/src/bootstrap/cadence-config.ts`.
- Produces:

  ```ts
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

  export const VS005_BETA_TARGET_POLICY: Readonly<CadenceTargetPolicy>;
  export function getCadenceTargetFacts(config: CadenceRuntimeConfig): CadenceTargetFacts;
  export function assertCadenceTargetPolicy(config: CadenceRuntimeConfig, policy: CadenceTargetPolicy): void;
  ```

- [ ] **Step 1: Write the failing policy tests**

  Add tests for `exact canonical Beta target is accepted`, `wrong environment is rejected`, `wrong safe marker is rejected`, `wrong Cloudflare account is rejected`, `wrong Worker is rejected`, `wrong public URL is rejected`, `wrong Supabase ref is rejected`, `wrong controlled Project is rejected`, `cadence-dev is rejected`, and `alternate structurally valid target is rejected by Beta policy`. Construct the alternate target with the Task 1 generic schema-valid fields and prove generic validation succeeds before `assertCadenceTargetPolicy` rejects it. Assert error codes identify the mismatched governed field without including credentials or secret values.

- [ ] **Step 2: Run the policy tests to observe RED**

  Run:

  ```powershell
  cd apps/api
  node --import tsx --test src/bootstrap/cadence-target-policy.test.ts
  ```

  Expected: FAIL because the policy module and its exact comparison contract do not exist.

- [ ] **Step 3: Implement target-fact extraction and the portable policy interface**

  Implement `getCadenceTargetFacts` as a pure projection of validated configuration. It must retain `cadence-beta` in `safeTargetMarker`, `mycadence` in `cloudflare.workerName`, and `pwmhasbmacmeerbsagda` in `supabaseProjectRef` as separate fields. Do not add a Supabase display-name authority field. `assertCadenceTargetPolicy` must compare all seven governed facts and report a bounded field-specific failure on the first mismatch.

- [ ] **Step 4: Define the reviewed Beta policy constant**

  Set `VS005_BETA_TARGET_POLICY.name` to `vs005-beta` and its expected tuple to the exact approved values:

  ```ts
  environment: "beta"
  safeTargetMarker: "cadence-beta"
  cloudflare: {
    accountId: "3d6a31905ac44e9563a523f9c86cbb8d",
    workerName: "mycadence",
  }
  publicUrl: "https://mycadence.ngohch-3d6.workers.dev"
  supabaseProjectRef: "pwmhasbmacmeerbsagda"
  pilotProjectId: "3503f8c7-1996-44d1-8b63-1fca36db89f8"
  ```

  Keep this constant in the policy module, never in generic schema/parser semantics. Its comparison must reject the forbidden `cadence-dev` Worker or environment path and the unrelated QA Project through ordinary exact-tuple mismatch.

- [ ] **Step 5: Add policy safety and portability assertions**

  Assert the module exports no secret value, no Cloudflare credential, and no Supabase display-name authority. Add a test using a second `CadenceTargetPolicy` with a different non-secret tuple and prove the same assertion function accepts that tuple, demonstrating clean-room policy injection without a hidden singleton.

- [ ] **Step 6: Run GREEN and API regression checks**

  Run:

  ```powershell
  cd apps/api
  node --import tsx --test src/bootstrap/cadence-target-policy.test.ts src/bootstrap/cadence-config.test.ts
  npx.cmd tsc --noEmit -p tsconfig.json
  ```

  Expected: PASS with exact Beta rejection and future-policy portability.

- [ ] **Step 7: Inspect the policy diff for authority separation**

  ```powershell
  git diff --check
  git diff -- apps/api/src/bootstrap/cadence-target-policy.ts apps/api/src/bootstrap/cadence-target-policy.test.ts
  ```

  Confirm the exact Beta IDs occur only in the explicit policy fixture/module and its tests, never in `cadence-config-schema.ts`, generic loader semantics, or generic fixtures.

- [ ] **Step 8: Commit the Beta policy boundary**

  ```powershell
  git add apps/api/src/bootstrap/cadence-target-policy.ts apps/api/src/bootstrap/cadence-target-policy.test.ts
  git diff --cached --check
  git commit -m "feat(vs005): add reviewed Beta target policy"
  ```

**Checkpoint deliverable:** Task 15 has a named exact Beta policy that can be injected at the deployment boundary, while generic validation and future clean-room policies remain portable.

---

### Task 3: Implement tri-state provider observations and phase completeness

**Files:**
- Create: `apps/api/scripts/vs005-provider-observations.ts`
- Create: `apps/api/scripts/vs005-provider-observations.test.ts`

**Interfaces:**
- Consumes: `CadenceReleaseIdentity` and `CadenceTargetFacts`.
- Produces:

  ```ts
  export type Vs005Observation<T> =
    | { state: "OBSERVED_VALUE"; value: T }
    | { state: "OBSERVED_ABSENT" }
    | { state: "UNAVAILABLE"; code: string };

  export type Vs005ObservationPhase =
    | "FIRST_DEPLOYMENT_READINESS"
    | "ROLLBACK_READINESS";

  export interface Vs005ProviderObservationSnapshot {
    accountId: Vs005Observation<string>;
    workerName: Vs005Observation<string>;
    workerExists: Vs005Observation<boolean>;
    workerConfigFingerprint: Vs005Observation<string>;
    cronSchedules: Vs005Observation<readonly string[]>;
    nonSecretBindingNames: Vs005Observation<readonly string[]>;
    secretNames: Vs005Observation<readonly string[]>;
    currentRelease: Vs005Observation<CadenceReleaseIdentity>;
    priorVersion: Vs005Observation<{
      providerVersionId: string;
      release: CadenceReleaseIdentity;
      configFingerprint: string;
    }>;
    hostname: Vs005Observation<string>;
  }

  export interface Vs005MutationEnvelope {
    workerAction: "CREATE_OR_UPDATE";
    cronAction: "NO_CHANGE" | "CREATE_OR_CHANGE";
    secretNamesToSet: readonly string[];
  }

  export interface Vs005ProviderInspection {
    observations: Vs005ProviderObservationSnapshot;
  }

  export function validateVs005ObservationCompleteness(input: {
    phase: Vs005ObservationPhase;
    observations: Vs005ProviderObservationSnapshot;
    mutationEnvelope: Vs005MutationEnvelope;
  }): readonly { code: string; message: string }[];
  ```

- [ ] **Step 1: Write the failing observation-state tests**

  Add tests named `OBSERVED_VALUE retains a bounded value`, `OBSERVED_ABSENT is not UNAVAILABLE`, `UNAVAILABLE is explicit`, `first deployment permits absent Worker with no prior version requirement`, `first deployment permits absent Cron only when planned`, `first deployment permits absent secret only when planned`, `existing Worker requires configuration Cron secret and release observations`, `missing required observation blocks`, `rollback requires current release and explicit prior version A`, and `rollback rejects absent prior version`.

- [ ] **Step 2: Run the observation tests to observe RED**

  Run:

  ```powershell
  cd apps/api
  node --import tsx --test scripts/vs005-provider-observations.test.ts
  ```

  Expected: FAIL because the tri-state types and phase validator do not exist.

- [ ] **Step 3: Implement the immutable tri-state representation**

  Use the exact `state` discriminant values. Store no raw provider response, response body, credential, secret value, unrestricted exception, or log text. A value observation carries only the bounded typed fact; an absent observation carries no value; an unavailable observation carries only a stable safe code.

- [ ] **Step 4: Implement first-deployment completeness**

  Require `accountId` and `workerName` as `OBSERVED_VALUE` facts matching the intended target supplied by the caller. Require a Worker existence observation. When `workerExists` is `OBSERVED_ABSENT`, do not require prior version, current release, Worker configuration, or existing Cron state; permit absent Cron only when `cronAction === "CREATE_OR_CHANGE"`. Require named-secret presence observation and permit absence only when that exact name appears in `secretNamesToSet`. When the Worker exists, require Worker configuration, Cron, named secret, and current release observations.

- [ ] **Step 5: Implement rollback completeness**

  Require observed account, Worker name, `workerExists: OBSERVED_VALUE(true)`, current release, prior version A, Worker configuration fingerprint, and hostname/release facts required by the provider contract. The prior version fact must include `providerVersionId`, release identity, and configuration fingerprint. No first-deployment path may call this requirement.

- [ ] **Step 6: Implement safe blocker reporting**

  Return deterministic `{ code, message }` blockers for required `UNAVAILABLE`, invalid expected absence, missing version A, and missing phase facts. Do not treat `OBSERVED_ABSENT` as a generic failure and do not turn `UNAVAILABLE` into an empty string, `false`, `null`, or an inferred match.

- [ ] **Step 7: Run GREEN and focused type verification**

  Run:

  ```powershell
  cd apps/api
  node --import tsx --test scripts/vs005-provider-observations.test.ts
  npx.cmd tsc --noEmit -p tsconfig.scripts.json
  ```

  Expected: PASS, with first-deployment and rollback profiles enforcing different completeness requirements.

- [ ] **Step 8: Commit the observation contract**

  ```powershell
  git add apps/api/scripts/vs005-provider-observations.ts apps/api/scripts/vs005-provider-observations.test.ts
  git diff --cached --check
  git commit -m "feat(vs005): add phase-scoped provider observations"
  ```

**Checkpoint deliverable:** All provider facts have safe tri-state semantics, expected absence is phase/envelope-aware, and first deployment no longer depends on a nonexistent prior version while rollback does.

---

### Task 4: Replace the Cloudflare identity stub with bounded read-only inspection

**Files:**
- Modify: `apps/api/scripts/vs005-cloudflare-deployment-provider.ts`
- Modify: `apps/api/scripts/vs005-cloudflare-deployment-provider.test.ts`
- Modify: `apps/api/scripts/vs005-deploy-apply.ts`
- Modify: `apps/api/scripts/vs005-rollback.ts`

**Interfaces:**
- Consumes: `Vs005ProviderObservationSnapshot`, `Vs005Observation`, `CadenceRuntimeConfig`, `CadenceReleaseIdentity`, existing `CloudflareDeploymentProviderIo`, `Vs005DeploymentProvider`, and `Vs005RollbackProvider`.
- Produces:

  ```ts
  export interface CloudflareReadOnlyProviderFacts {
    accountId: Vs005Observation<string>;
    workerName: Vs005Observation<string>;
    workerExists: Vs005Observation<boolean>;
    workerConfigFingerprint: Vs005Observation<string>;
    cronSchedules: Vs005Observation<readonly string[]>;
    nonSecretBindingNames: Vs005Observation<readonly string[]>;
    secretNames: Vs005Observation<readonly string[]>;
    currentRelease: Vs005Observation<CadenceReleaseIdentity>;
    priorVersion: Vs005ProviderObservationSnapshot["priorVersion"];
    hostname: Vs005Observation<string>;
  }

  export interface CloudflareDeploymentProviderIo {
    inspectReadOnly(input: { accountId: string; workerName: string }): Promise<CloudflareReadOnlyProviderFacts>;
    createTemporarySecretFile(content: string, mode: number): Promise<string>;
    deleteFile(path: string): Promise<void>;
    runWrangler(args: readonly string[]): Promise<{ exitCode: number; stdout: string }>;
  }
  ```

  `createCloudflareDeploymentProvider(io).inspect(config)` produces `Vs005ProviderInspection`, whose `observations` property is the `Vs005ProviderObservationSnapshot` consumed by the planner, apply path, and rollback path. The existing `Vs005DeploymentProviderInspection` alias in `vs005-deploy-apply.ts` must resolve to this wrapper.

- [ ] **Step 1: Write failing adapter capability tests**

  Extend the existing injected provider fixture with `inspectReadOnly`. Add tests named `inspection returns account and Worker identity`, `inspection distinguishes absent Worker`, `inspection preserves absent Cron and secret states`, `inspection returns release and fingerprint facts without raw output`, `inspection never returns secret values`, `inspection has no deploy or rollback capability`, and `provider failure maps to UNAVAILABLE`.

- [ ] **Step 2: Run the adapter tests to observe RED**

  Run:

  ```powershell
  cd apps/api
  node --import tsx --test scripts/vs005-cloudflare-deployment-provider.test.ts scripts/vs005-provider-observations.test.ts
  ```

  Expected: FAIL because the current default provider calls only `wrangler whoami --json`, fabricates `workerExists=false`, returns no Cron/config/secret/release facts, and the injected I/O contract has no read-only inspection capability.

- [ ] **Step 3: Implement the injected read-only capability boundary**

  Add `inspectReadOnly` to the provider I/O interface and map its bounded result into `Vs005ProviderInspection`. The provider must request the reviewed account and explicit `workerName` from the caller. It must not derive `cadence-beta`, accept a Worker name from an unrelated identity response, or use provider state as business state.

- [ ] **Step 4: Map provider-supported capabilities without inventing command strings**

  Keep the production adapter limited to the provider-supported read-only inspection capability confirmed for the installed Wrangler/provider version. The implementation may retain `runWrangler` for the existing deploy/rollback paths, but it must not add an unverified CLI command to tests or documentation. If the installed provider mechanism cannot prove account, Worker existence, relevant configuration, Cron, named secret presence, current release, required prior version, and hostname facts for the active phase, return `UNAVAILABLE` for that fact and stop planning before mutation.

- [ ] **Step 5: Bound all inspection parsing**

  Parse only allowlisted account IDs, Worker names, version IDs, release values, configuration fingerprints, Cron strings, binding names, secret names, and hostname values. Convert absent provider resources to `OBSERVED_ABSENT`. Convert failed or unsupported reads to `UNAVAILABLE` with stable codes. Never expose provider stdout, response bodies, secret values, or raw exceptions in the returned snapshot.

- [ ] **Step 6: Preserve secret transport and rollback seams**

  Keep `createTemporarySecretFile`, `deleteFile`, `runWrangler`, deploy-time `--secrets-file` handling, cleanup in `finally`, argv-array execution, and bounded rollback identifier parsing unchanged in behavior. Update `Vs005DeploymentProviderInspection` to be the `Vs005ProviderInspection` wrapper and update `Vs005RollbackProvider.inspectTarget()` to consume the same wrapper without adding a second authority.

- [ ] **Step 7: Run GREEN and regression checks**

  Run:

  ```powershell
  cd apps/api
  node --import tsx --test scripts/vs005-cloudflare-deployment-provider.test.ts scripts/vs005-provider-observations.test.ts scripts/vs005-rollback.test.ts
  npx.cmd tsc --noEmit -p tsconfig.scripts.json
  ```

  Expected: PASS with offline injected provider facts and no secret-value or raw-provider-output leakage.

- [ ] **Step 8: Commit the provider observation adapter**

  ```powershell
  git add apps/api/scripts/vs005-cloudflare-deployment-provider.ts apps/api/scripts/vs005-cloudflare-deployment-provider.test.ts apps/api/scripts/vs005-deploy-apply.ts apps/api/scripts/vs005-rollback.ts
  git diff --cached --check
  git commit -m "feat(vs005): add bounded Cloudflare inspection"
  ```

**Checkpoint deliverable:** The Cloudflare boundary can supply safe read-only capability results for planning/apply/rollback without fabricating Worker state, exposing secrets, or prescribing an unverified provider command.

---

### Task 5: Bind intended target, observations, policy, and mutation envelope into deployment plans

**Files:**
- Modify: `apps/api/scripts/vs005-deployment-artifacts.ts`
- Modify: `apps/api/scripts/vs005-deploy-plan.ts`
- Modify: `apps/api/scripts/vs005-deploy-plan.test.ts`
- Modify: `apps/api/scripts/vs005-cloudflare-deployment-provider.ts`
- Modify: `apps/api/package.json`
- Modify: `package.json`

**Interfaces:**
- Consumes: `CadenceTargetPolicy`, `VS005_BETA_TARGET_POLICY`, `getCadenceTargetFacts`, `assertCadenceTargetPolicy`, `Vs005ProviderInspection`, `Vs005ProviderObservationSnapshot`, `Vs005MutationEnvelope`, `validateVs005ObservationCompleteness`, `loadCadenceRuntimeConfig`, `loadCadenceReleaseIdentity`, `fingerprintCadenceRuntimeConfig`.
- Produces:

  ```ts
  export interface Vs005DeploymentPlan {
    artifactType: "cadence.vs005.deployment-plan";
    formatVersion: 2;
    planId: string;
    intendedTarget: CadenceTargetFacts;
    targetPolicy: { name: string };
    observedProvider: Vs005ProviderObservationSnapshot;
    observationPhase: "FIRST_DEPLOYMENT_READINESS";
    mutationEnvelope: Vs005MutationEnvelope;
    configFingerprint: string;
    release: CadenceReleaseIdentity;
    database: { migrationAction: "NONE" };
    destructiveActions: readonly [];
    readiness: "PASS" | "BLOCKED";
    blockers: readonly { code: string; message: string }[];
  }

  export interface Vs005PlanInspection {
    observations: Vs005ProviderObservationSnapshot;
    hostnameReady: boolean;
    generatedConfigValid: boolean;
    webBuildReady: boolean;
  }

  export interface Vs005DeployPlanDependencies {
    targetPolicy: CadenceTargetPolicy;
    loadConfig(path: string): unknown;
    loadRelease(): CadenceReleaseIdentity;
    inspect(config: CadenceRuntimeConfig): Promise<Vs005PlanInspection>;
    generatePlanId(): string;
    writePlan(path: string, plan: Vs005DeploymentPlan): Promise<void>;
  }
  ```

  `Vs005PlanInspection.observations` is the `observations` property from `Vs005ProviderInspection`; the provider adapter does not expose a second observation shape.

- [ ] **Step 1: Write failing plan-artifact and plan-policy tests**

  Update `vs005-deployment-artifacts.test.ts` to prove a plan contains intended facts, named policy, observed tri-state facts, phase, mutation envelope, release, fingerprint, `database.migrationAction: "NONE"`, and an empty destructive-action list without secret values. Update `vs005-deploy-plan.test.ts` with tests named `exact Beta tuple produces a PASS plan`, `Beta policy rejects alternate generic target`, `missing required observation blocks`, `expected absent Worker is represented`, `unexpected absence outside mutation envelope blocks`, `first deployment does not require prior version`, and `planning dependencies expose no mutation capability`.

- [ ] **Step 2: Run the plan tests to observe RED**

  Run:

  ```powershell
  cd apps/api
  node --import tsx --test scripts/vs005-deployment-artifacts.test.ts scripts/vs005-deploy-plan.test.ts
  ```

  Expected: FAIL because the current artifact is version 1, has no intended target/policy/observation profile/mutation envelope, derives `cadence-beta`, and requires only a boolean provider inspection shape.

- [ ] **Step 3: Extend the versioned plan artifact**

  Add the exact produced fields while preserving safe failure fields and `database.migrationAction: "NONE"`. Version the artifact at `formatVersion: 2`; reject version 1 at new apply boundaries rather than silently accepting an artifact without target authority. Keep `providerTarget` as a compatibility projection of intended account/Worker plus observed existence only where rollback evidence still consumes it.

- [ ] **Step 4: Implement plan target-policy validation**

  Validate the canonical config generically, require the Cloudflare provider, derive `intendedTarget`, and call `assertCadenceTargetPolicy(config, dependencies.targetPolicy)`. The CLI supplies `VS005_BETA_TARGET_POLICY`; tests inject a separate policy to prove the planner has no hidden Beta singleton. Reject target mismatch before provider inspection.

- [ ] **Step 5: Implement phase-aware plan blockers**

  Build a `FIRST_DEPLOYMENT_READINESS` mutation envelope with `workerAction: "CREATE_OR_UPDATE"`, Cron action based on the reviewed plan, and `secretNamesToSet` only when named-secret absence is intentionally handled by the envelope. Run `validateVs005ObservationCompleteness`. Do not block an absent prior version for a first deployment. Block account/Worker mismatch, required `UNAVAILABLE`, invalid absent facts, generated artifact invalidity, hostname/build failure, missing secret readiness, non-`NONE` database action, and any destructive action.

- [ ] **Step 6: Wire the real default dependency shape without executing it**

  Replace the current CLI inspection stub with the provider adapter capability and explicit policy input. Preserve the current console contract `DEPLOYMENT READINESS: PASS|BLOCKED` and `NO DEPLOYMENT PERFORMED`. Keep plan generation free of deploy, Worker update, secret upload, Cron mutation, business write, and database operation.

- [ ] **Step 7: Run GREEN and script regressions**

  Run:

  ```powershell
  cd apps/api
  node --import tsx --test scripts/vs005-deployment-artifacts.test.ts scripts/vs005-deploy-plan.test.ts scripts/vs005-cloudflare-deployment-provider.test.ts
  npx.cmd tsc --noEmit -p tsconfig.scripts.json
  cd ..\..\
  git diff --check
  ```

  Expected: PASS with exact Beta policy enforcement, phase-specific absence handling, deterministic fingerprint, safe plan artifact, and no mutation dependency.

- [ ] **Step 8: Commit the plan binding**

  ```powershell
  git add apps/api/scripts/vs005-deployment-artifacts.ts apps/api/scripts/vs005-deploy-plan.ts apps/api/scripts/vs005-deploy-plan.test.ts apps/api/scripts/vs005-cloudflare-deployment-provider.ts apps/api/package.json package.json
  git diff --cached --check
  git commit -m "feat(vs005): bind target observations into deployment plans"
  ```

**Checkpoint deliverable:** A read-only plan captures the exact intended tuple, injected Beta policy, phase-scoped observed provider state, mutation envelope, release/config identity, explicit no-database-action state, and bounded blockers.

---

### Task 6: Revalidate the target and observations immediately before apply

**Files:**
- Modify: `apps/api/scripts/vs005-deploy-apply.ts`
- Modify: `apps/api/scripts/vs005-deploy-apply.test.ts`
- Modify: `apps/api/scripts/vs005-deployment-artifacts.ts`

**Interfaces:**
- Consumes: version-2 `Vs005DeploymentPlan`, `CadenceRuntimeConfig`, `CadenceTargetPolicy`, `assertCadenceTargetPolicy`, `getCadenceTargetFacts`, `Vs005ProviderInspection`, `Vs005MutationEnvelope`, `validateVs005ObservationCompleteness`, `Vs005DeploymentProvider.inspect`, `Vs005DeploymentProvider.deploy`, `fingerprintCadenceRuntimeConfig`, `loadCadenceReleaseIdentity`.
- Produces: `applyVs005Deployment(input): Promise<Vs005DeploymentResult>` with result fields for `intendedTarget`, `observedProvider`, `release`, `configFingerprint`, `databaseAction: "NONE"`, and `destructiveActions: []`; `Vs005DeploymentProvider.inspect(config): Promise<Vs005ProviderInspection>`.

- [ ] **Step 1: Write failing apply revalidation tests**

  Update the existing fixture to the explicit Beta tuple and add tests named `apply rejects wrong account before provider deployment`, `apply rejects wrong Worker before provider deployment`, `apply rejects stale intended target`, `apply rejects stale config fingerprint`, `apply rejects stale release`, `apply rejects required unavailable observation`, `apply accepts absent Worker only for first deployment envelope`, `apply rejects absent secret without planned setting`, `apply rejects unexpected secret-state change`, `apply rejects database action`, `apply rejects destructive action`, `apply reinspection occurs before local artifact preparation`, and `exact reviewed state reaches the injected mutation boundary`.

- [ ] **Step 2: Run the apply tests to observe RED**

  Run:

  ```powershell
  cd apps/api
  node --import tsx --test scripts/vs005-deploy-apply.test.ts
  ```

  Expected: FAIL because current apply accepts the old artifact shape, compares the derived Worker name `cadence-beta`, lacks Beta policy validation, compares only partial provider facts, and does not enforce tri-state phase completeness.

- [ ] **Step 3: Validate the plan and current canonical inputs**

  Require plan format version 2, `readiness: "PASS"`, empty destructive actions, `database.migrationAction: "NONE"`, generic config validity, exact Beta policy validation, current release identity, recomputed fingerprint, exact intended target equality, exact worker-policy equality, and exact mutation-envelope equality before provider inspection.

- [ ] **Step 4: Reinspect and compare the provider snapshot**

  Call `provider.inspect(config)` immediately before local artifact preparation and read its `observations` property. Compare every plan-observed fact relevant to `FIRST_DEPLOYMENT_READINESS`. Use tri-state equality, reject `UNAVAILABLE` for required facts, accept expected absent resources only under the reviewed envelope, and reject account/Worker/config/release/Cron/secret drift. Never compare raw provider JSON.

- [ ] **Step 5: Preserve local preparation and secret boundaries**

  Keep the existing `prepareArtifacts` order: generated browser config, Vite build, generated Wrangler artifact, and local dry-run bundle check. Rebuild from the revalidated config/release. Resolve `SUPABASE_SECRET_KEY` only when the reviewed plan declares provider absence plus planned bootstrap; pass it only through the existing in-memory/provider temporary-file seam. Do not put the value into result, error, plan, or log output.

- [ ] **Step 6: Produce safe deployment evidence after injected mutation**

  Return the expanded `Vs005DeploymentResult` using the intended target and bounded observed provider facts. Preserve `databaseAction: "NONE"`, empty destructive actions, and the rule that apply does not self-certify verification. Pre-provider failures remain `mutationOccurred=false`; provider invocation failures retain the existing safe failure contract.

- [ ] **Step 7: Run GREEN and regression checks**

  Run:

  ```powershell
  cd apps/api
  node --import tsx --test scripts/vs005-deploy-apply.test.ts scripts/vs005-deploy-plan.test.ts scripts/vs005-cloudflare-deployment-provider.test.ts scripts/vs005-deployment-artifacts.test.ts
  npx.cmd tsc --noEmit -p tsconfig.scripts.json
  ```

  Expected: PASS with zero injected deployment calls on every stale/mismatch/unavailable failure and one injected call only for exact reviewed state.

- [ ] **Step 8: Commit apply revalidation**

  ```powershell
  git add apps/api/scripts/vs005-deploy-apply.ts apps/api/scripts/vs005-deploy-apply.test.ts apps/api/scripts/vs005-deployment-artifacts.ts
  git diff --cached --check
  git commit -m "feat(vs005): revalidate deployment target before apply"
  ```

**Checkpoint deliverable:** Apply is bound to the reviewed plan, canonical Beta policy, exact fingerprint/release, phase-complete observations, and explicit no-database-action envelope before the injected deployment boundary.

---

### Task 7: Bind post-deployment verification and application rollback to the same target contract

**Files:**
- Modify: `apps/api/scripts/vs005-deploy-verify.ts`
- Modify: `apps/api/scripts/vs005-deploy-verify.test.ts`
- Modify: `apps/api/scripts/vs005-rollback.ts`
- Modify: `apps/api/scripts/vs005-rollback.test.ts`
- Modify: `apps/api/scripts/vs005-cloudflare-deployment-provider.ts`
- Modify: `apps/api/src/runtime/create-cadence-app.test.ts`

**Interfaces:**
- Consumes: `Vs005DeploymentResult`, `CadenceRuntimeConfig`, `Vs005ProviderObservationSnapshot`, `Vs005TargetFacts`, `Vs005VerificationReaders`, `Vs005RollbackRequest`, `Vs005RollbackProvider`.
- Produces:

  ```ts
  export interface Vs005VerificationReaders {
    getWeb(): Promise<{ status: number }>;
    inspectBrowserBundle(): Promise<{ status: number; forbiddenServerMarkersFound: boolean }>;
    getHealth(): Promise<{ status: number; json: unknown }>;
    probeApi(): Promise<{ status: number }>;
    inspectProvider(): Promise<Vs005ProviderObservationSnapshot>;
    inspectRuntimeTarget(): Promise<{
      environment: string;
      safeTargetMarker: string;
      supabaseProjectRef: string | null;
      pilotProjectId: string | null;
    }>;
    probeControlledProject(): Promise<{ status: number; projectId: string | null }>;
  }

  export interface Vs005RollbackProvider {
    inspectTarget(): Promise<Vs005ProviderInspection>;
    rollback(providerVersionId: string): Promise<{ deploymentId: string; activeProviderVersionId: string }>;
  }
  ```

- [ ] **Step 1: Write failing verification and rollback tests**

  Extend pass readers with injected runtime-target and controlled-project facts. Add tests named `verification checks exact account and Worker`, `verification checks public URL and environment`, `verification checks safe marker and Supabase ref`, `verification checks controlled Project through governed application probe`, `verification checks release and fingerprint`, `verification checks Cron and named secret`, `verification rejects unavailable provider fact`, `verification preserves browser secret absence`, and `verification always records NOT_AUTHORISED`. Add rollback tests named `rollback requires explicit retained version A`, `rollback rejects unavailable rollback observations`, `rollback rejects changed account or Worker before mutation`, `rollback preserves release/config target`, and `rollback keeps database NONE`.

- [ ] **Step 2: Run verification and rollback tests to observe RED**

  Run:

  ```powershell
  cd apps/api
  node --import tsx --test scripts/vs005-deploy-verify.test.ts scripts/vs005-rollback.test.ts
  ```

  Expected: FAIL because verification currently has no runtime-target or controlled-project reader, consumes the old provider inspection shape, and rollback accepts only account/Worker projections without explicit version-A observation completeness.

- [ ] **Step 3: Implement safe verification identity checks**

  Compare the deployment result and expected config against the same intended target: account, Worker, public URL, environment, safe marker, Supabase ref, controlled Project ID, release identity, configuration fingerprint, Cron state, and named secret presence. Use `inspectRuntimeTarget` and `probeControlledProject` as injected safe readers; retain only status and bounded identity fields. Do not add pilot Project identity to the public `/health` body because the existing runtime test explicitly protects that boundary.

- [ ] **Step 4: Preserve browser/API and health safety**

  Keep `/health` release/config identity checks, same-origin API status probing, browser/static secret-marker scan, and no-response-body artifact behavior. The controlled-project probe must use the existing governed authenticated project-summary route in its host implementation and must retain no business response body. Tests remain offline and injected.

- [ ] **Step 5: Implement rollback-readiness binding**

  Extend rollback validation to require current deployment evidence, explicit retained prior version A evidence, current target identity, current release, prior release/configuration fingerprint, provider rollback availability, and `databaseAction: "NONE"`. Reinspect the full `Vs005ProviderInspection` immediately before the provider rollback mutation. Compare `inspection.observations` against intended account/Worker and all applicable fingerprints before invoking `provider.rollback`.

- [ ] **Step 6: Preserve application-only rollback semantics**

  Keep reconstruction of the target application result after the provider returns the active version. Run the same verification function against the reconstructed result. Reject any database rollback action, reset, migration reversal, destructive action, or raw provider error. Continue recording `pilotActivation: "NOT_AUTHORISED"`.

- [ ] **Step 7: Run GREEN and regression checks**

  Run:

  ```powershell
  cd apps/api
  node --import tsx --test scripts/vs005-deploy-verify.test.ts scripts/vs005-rollback.test.ts scripts/vs005-deploy-apply.test.ts scripts/vs005-cloudflare-deployment-provider.test.ts src/runtime/create-cadence-app.test.ts
  npx.cmd tsc --noEmit -p tsconfig.scripts.json
  ```

  Expected: PASS with exact target verification, safe browser boundary, explicit version-A rollback evidence, and no database rollback path.

- [ ] **Step 8: Commit verify/rollback binding**

  ```powershell
  git add apps/api/scripts/vs005-deploy-verify.ts apps/api/scripts/vs005-deploy-verify.test.ts apps/api/scripts/vs005-rollback.ts apps/api/scripts/vs005-rollback.test.ts apps/api/scripts/vs005-cloudflare-deployment-provider.ts apps/api/src/runtime/create-cadence-app.test.ts
  git diff --cached --check
  git commit -m "feat(vs005): bind verification and rollback targets"
  ```

**Checkpoint deliverable:** Verification and application rollback use the same reviewed target identity and safe observation model, while public health and browser boundaries continue to exclude privileged Project and secret data.

---

### Task 8: Reconcile and govern the early Beta configuration

**Files:**
- Modify: `config/cadence.runtime.beta.json`
- Create: `apps/api/scripts/vs005-beta-config.test.ts`
- Modify: `apps/api/scripts/vs005-package-wiring.test.ts`

**Interfaces:**
- Consumes: `config/cadence.runtime.beta.json`, `loadCadenceRuntimeConfig`, `validateCadenceRuntimeConfig`, `fingerprintCadenceRuntimeConfig`, `VS005_BETA_TARGET_POLICY`, `assertCadenceTargetPolicy`.
- Produces: a tracked, non-secret canonical Beta configuration containing explicit `cloudflare.accountId` and `cloudflare.workerName`, with provenance recorded by the following documentation task; no new runtime API.

- [ ] **Step 1: Write the failing reconciliation tests**

  Create `vs005-beta-config.test.ts` with tests named `Beta config contains explicit reviewed Cloudflare account and Worker`, `Beta config passes generic validation`, `Beta config passes exact Beta policy`, `Beta config fingerprint is deterministic`, `Beta config has no privileged secret value`, and `Beta config retains cadence-beta as marker rather than Worker identity`. Add a package-wiring assertion that this file is source-controlled once reconciled and that it is not an ignored developer-only path.

- [ ] **Step 2: Run the reconciliation tests to observe RED**

  Run:

  ```powershell
  cd apps/api
  node --import tsx --test scripts/vs005-beta-config.test.ts scripts/vs005-package-wiring.test.ts
  ```

  Expected: FAIL because the current untracked Beta file has no `cloudflare` block and the new focused test does not exist.

- [ ] **Step 3: Reconcile the file without changing legitimate values**

  Add exactly:

  ```json
  "cloudflare": {
    "accountId": "3d6a31905ac44e9563a523f9c86cbb8d",
    "workerName": "mycadence"
  }
  ```

  Retain the existing environment, public URL, Supabase URL/ref/publishable key/secret reference, controlled Project, safe marker, worker bounds/schedule, and retry policy. Do not add a privileged secret value, Supabase display-name authority field, credential, token, or alternate operator-edited setting.

- [ ] **Step 4: Prove exact policy and secret safety**

  Load the file through `loadCadenceRuntimeConfig`, call `assertCadenceTargetPolicy` with `VS005_BETA_TARGET_POLICY`, compute the fingerprint, and scan serialized content only for forbidden privileged-value patterns. The test may assert the named reference `SUPABASE_SECRET_KEY`; it must not assert or print a secret value.

- [ ] **Step 5: Review the file before staging**

  ```powershell
  Get-Content -Raw config/cadence.runtime.beta.json
  git diff -- config/cadence.runtime.beta.json
  git diff --check
  ```

  Confirm the file is the one early-created under narrow VS004 bootstrap/preflight authorization, that the reconciliation is a controlled sequencing deviation, and that only the reviewed non-secret target extension is present.

- [ ] **Step 6: Run GREEN and config regressions**

  Run:

  ```powershell
  cd apps/api
  node --import tsx --test scripts/vs005-beta-config.test.ts scripts/vs005-package-wiring.test.ts src/bootstrap/cadence-config.test.ts src/bootstrap/cadence-target-policy.test.ts
  npx.cmd tsc --noEmit -p tsconfig.scripts.json
  ```

  Expected: PASS with the exact reviewed Beta tuple and no privileged secret material.

- [ ] **Step 7: Stage only the now-governed Beta config and its tests**

  ```powershell
  git add config/cadence.runtime.beta.json apps/api/scripts/vs005-beta-config.test.ts apps/api/scripts/vs005-package-wiring.test.ts
  git diff --cached --check
  git diff --cached --stat
  ```

  Confirm the implementation-plan DOCX is not staged and no `.cadence` artifact is staged.

- [ ] **Step 8: Commit the reconciled Beta configuration**

  ```powershell
  git commit -m "chore(vs005): reconcile governed Beta configuration"
  ```

**Checkpoint deliverable:** The early untracked Beta file becomes the governed non-secret canonical source with explicit `mycadence` and account identity, preserving provenance and without implying hosted authorization.

---

### Task 9: Add local T15-A readiness evidence and narrow operator documentation reconciliation

**Files:**
- Create: `apps/api/scripts/vs005-t15a-readiness.ts`
- Create: `apps/api/scripts/vs005-t15a-readiness.test.ts`
- Modify: `HANDOFF.md`
- Modify: `docs/runbooks/VS005_DEPLOYMENT.md`

**Interfaces:**
- Consumes: `CadenceRuntimeConfig`, `fingerprintCadenceRuntimeConfig`, `CadenceTargetFacts`, `VS005_BETA_TARGET_POLICY`, `CadenceReleaseIdentity`, and injected local provenance/test-summary values.
- Produces:

  ```ts
  export interface Vs005LocalReadinessInput {
    sourceCommit: string;
    t15aDesignSha256: string;
    frozenDesignSha256: string;
    frozenPlanSha256: string;
    configPath: string;
    config: CadenceRuntimeConfig;
    configFingerprint: string;
    release: CadenceReleaseIdentity;
    focusedTests: readonly { command: string; outcome: "PASS" }[];
  }

  export interface Vs005LocalReadinessArtifact {
    artifactType: "cadence.vs005.t15a-local-readiness";
    formatVersion: 1;
    sourceCommit: string;
    designSha256: string;
    frozenDesignSha256: string;
    frozenPlanSha256: string;
    intendedTarget: CadenceTargetFacts;
    configPath: string;
    configFingerprint: string;
    release: CadenceReleaseIdentity;
    database: { migrationAction: "NONE" };
    destructiveActions: readonly [];
    focusedTests: readonly { command: string; outcome: "PASS" }[];
    betaConfigProvenance: "EARLY_NARROW_BOOTSTRAP_AUTHORIZATION_RECONCILED";
    task15RemoteMutation: "NOT_AUTHORIZED";
    pilotActivation: "NOT_AUTHORISED";
  }

  export function buildVs005LocalReadinessArtifact(input: Vs005LocalReadinessInput): Vs005LocalReadinessArtifact;
  ```

- [ ] **Step 1: Write the failing readiness-artifact tests**

  Add tests named `readiness records source and frozen hashes`, `readiness records exact intended Beta tuple`, `readiness records config fingerprint and release`, `readiness declares database NONE and no destructive actions`, `readiness records Beta-config provenance`, `readiness records remote and Pilot Activation firewalls`, and `readiness excludes secret values and raw provider output`.

- [ ] **Step 2: Run the readiness tests to observe RED**

  Run:

  ```powershell
  cd apps/api
  node --import tsx --test scripts/vs005-t15a-readiness.test.ts
  ```

  Expected: FAIL because the local readiness artifact constructor does not exist.

- [ ] **Step 3: Implement the pure local readiness constructor**

  Validate hash formats, release identity, canonical config fingerprint, exact Beta policy, and the all-PASS focused test summary. Emit only non-secret facts and fixed firewall fields. The constructor must reject non-`NONE` database intent, nonempty destructive actions, missing frozen provenance, or a secret-looking serialized value.

- [ ] **Step 4: Add the local-only CLI writer**

  Add a CLI path that receives explicit local inputs and writes only under the ignored `.cadence/` directory. It must not invoke provider I/O, fetch hosted URLs, invoke Supabase tooling, run migrations, or create business data. Its output is local readiness evidence, not hosted evidence.

- [ ] **Step 5: Reconcile HANDOFF lineage and state**

  Update only the stale VS005 execution-state portions of `HANDOFF.md`. Record VS004 recovery closure baseline `3378e15`, T15-A design freeze `7800e04`, T15-A design amendment `7f2f03f`, Tasks 1-14 locally completed/prepared, no hosted Task 15 evidence, VS004 recovery `VERIFIED / CLOSED`, target-contract reconciliation, the distinction between `cadence-beta` and `mycadence`, early Beta-config provenance, remote mutation unauthorized, Pilot Activation unauthorized, and unchanged 44-parent/178-child governance baseline. Do not turn HANDOFF into a duplicate technical specification.

- [ ] **Step 6: Reconcile the deployment runbook without adding remote execution**

  Update `docs/runbooks/VS005_DEPLOYMENT.md` to name the explicit Beta target tuple, state `cadence-beta != mycadence`, identify `pwmhasbmacmeerbsagda` as authoritative Supabase identity, describe the provider observation capability and phase profiles without adding an unverified provider command, state that the first deployment has no prior-version prerequisite, state that rollback requires version A, and preserve the explicit remote/Pilot Activation gates. Keep secret handling by name only and keep all database prohibitions.

- [ ] **Step 7: Run GREEN and documentation checks**

  Run:

  ```powershell
  cd apps/api
  node --import tsx --test scripts/vs005-t15a-readiness.test.ts scripts/vs005-beta-config.test.ts
  npx.cmd tsc --noEmit -p tsconfig.scripts.json
  cd ..\..\
  git diff --check
  git grep -n "3378e15\|7800e04\|7f2f03f\|cadence-beta\|mycadence\|NOT_AUTHORISED\|NOT_AUTHORIZED" -- HANDOFF.md docs/runbooks/VS005_DEPLOYMENT.md apps/api/scripts/vs005-t15a-readiness.ts
  ```

  Expected: PASS with no claim of hosted evidence or authorization.

- [ ] **Step 8: Commit local evidence and documentation reconciliation**

  ```powershell
  git add apps/api/scripts/vs005-t15a-readiness.ts apps/api/scripts/vs005-t15a-readiness.test.ts HANDOFF.md docs/runbooks/VS005_DEPLOYMENT.md
  git diff --cached --check
  git commit -m "docs(vs005): reconcile T15-A readiness handoff"
  ```

**Checkpoint deliverable:** Local readiness evidence and concise operator documentation identify the reconciled target and all authorization/database/secret boundaries without claiming hosted proof.

---

### Task 10: Execute the final local T15-A gate and record the implementation checkpoint

**Files:**
- Modify: `HANDOFF.md`
- Test: `apps/api/src/bootstrap/cadence-config.test.ts`
- Test: `apps/api/src/bootstrap/cadence-target-policy.test.ts`
- Test: `apps/api/src/runtime/create-cadence-app.test.ts`
- Test: `apps/api/scripts/vs005-provider-observations.test.ts`
- Test: `apps/api/scripts/vs005-cloudflare-deployment-provider.test.ts`
- Test: `apps/api/scripts/vs005-deployment-artifacts.test.ts`
- Test: `apps/api/scripts/vs005-deploy-plan.test.ts`
- Test: `apps/api/scripts/vs005-deploy-apply.test.ts`
- Test: `apps/api/scripts/vs005-deploy-verify.test.ts`
- Test: `apps/api/scripts/vs005-rollback.test.ts`
- Test: `apps/api/scripts/vs005-generate-deployment.test.ts`
- Test: `apps/api/scripts/vs005-beta-config.test.ts`
- Test: `apps/api/scripts/vs005-t15a-readiness.test.ts`

**Interfaces:**
- Consumes: all Task 1-9 interfaces, focused test outputs, local readiness artifact, source/frozen/design hashes, and current Git checkpoint.
- Produces: final local T15-A readiness decision in `HANDOFF.md`; no hosted operation and no new runtime interface.

- [ ] **Step 1: Record the implementation checkpoint before the final documentation edit**

  After Tasks 1-9 are committed and before editing `HANDOFF.md`, run:

  ```powershell
  git log -1 --format=%H
  ```

  Record that actual returned commit SHA as the T15-A implementation checkpoint. Do not label `3378e15` as the current HEAD; it remains the VS004 recovery closure baseline.

- [ ] **Step 2: Run the complete focused T15-A suite**

  ```powershell
  cd apps/api
  node --import tsx --test `
    src/bootstrap/cadence-config.test.ts `
    src/bootstrap/cadence-target-policy.test.ts `
    src/runtime/create-cadence-app.test.ts `
    scripts/vs005-provider-observations.test.ts `
    scripts/vs005-cloudflare-deployment-provider.test.ts `
    scripts/vs005-deployment-artifacts.test.ts `
    scripts/vs005-deploy-plan.test.ts `
    scripts/vs005-deploy-apply.test.ts `
    scripts/vs005-deploy-verify.test.ts `
    scripts/vs005-rollback.test.ts `
    scripts/vs005-generate-deployment.test.ts `
    scripts/vs005-beta-config.test.ts `
    scripts/vs005-t15a-readiness.test.ts
  ```

  Expected: PASS with no network/provider operation and no skipped target-safety or secret-safety case.

- [ ] **Step 3: Run the repository regression boundary**

  ```powershell
  cd ..\..\
  npm run quality
  npm --prefix apps/api test
  npm --prefix apps/web test
  npm run api:scripts:typecheck
  npm --prefix apps/runtime-cloudflare test
  npm --prefix apps/runtime-cloudflare run typecheck
  npm --prefix apps/runtime-cloudflare run deploy:dry-run
  git diff --check
  ```

  Expected: PASS. These commands are local/CI checks; no hosted target, Cloudflare account, Supabase project, Cron trigger, or hosted HTTP endpoint is contacted by the T15-A implementation checkpoint.

- [ ] **Step 4: Run the authorization and portability audit**

  ```powershell
  git grep -n "wrangler whoami\|wrangler deploy\|wrangler rollback\|supabase db push\|supabase db reset\|Pilot Activation" -- apps/api apps/runtime-cloudflare docs/runbooks/VS005_DEPLOYMENT.md
  git grep -n "3d6a31905ac44e9563a523f9c86cbb8d\|mycadence\|pwmhasbmacmeerbsagda\|3503f8c7-1996-44d1-8b63-1fca36db89f8" -- apps/api/src/bootstrap/cadence-config-schema.ts apps/api/src/bootstrap/cadence-config.ts config/cadence.runtime.example.json config/cadence.runtime.ci.json
  git grep -n "SUPABASE_SECRET_KEY=" -- apps/web apps/runtime-cloudflare config
  ```

  Expected: exact Beta IDs are absent from generic schema/parser/fixture sources, secret assignments contain no value, remote command text is confined to the documented provider boundary, database mutation commands are absent from the implementation path, and Pilot Activation remains unauthorized.

- [ ] **Step 5: Rebuild and record local readiness evidence**

  Recompute the approved T15-A design hash, frozen VS005 design hash, and frozen VS005 plan hash. Build the local readiness artifact with the exact source commit, target facts, config fingerprint, schema version, release identity, all-PASS focused command list, `database.migrationAction=NONE`, empty destructive actions, Beta-config provenance, `Task 15 remote mutation=NOT_AUTHORIZED`, and `Pilot Activation=NOT_AUTHORISED`. Do not copy provider output or secret values into it.

- [ ] **Step 6: Update HANDOFF with the actual implementation checkpoint**

  Add one concise final T15-A status paragraph to `HANDOFF.md` containing the SHA recorded in Step 1, the local test/readiness result, no hosted Task 15 evidence, VS004 `VERIFIED / CLOSED`, remote mutation unauthorized, Pilot Activation unauthorized, clean-room selection still separate, and the unchanged 44/178 governance counts. Preserve the earlier lineage entries and early Beta-config provenance.

- [ ] **Step 7: Run the final local gate after the documentation edit**

  ```powershell
  git diff --check
  git status -sb
  git diff --cached --name-only
  git diff --name-only -- config/cadence.runtime.beta.json docs/2026-09-04-vs005-portable-deployment-runtime-implementation-plan.docx
  ```

  Expected: only the intended `HANDOFF.md` edit is unstaged before staging; the Beta config is tracked from Task 8, the DOCX remains untracked and untouched, no `.cadence` artifact is staged, and no frozen VS005 source record is modified.

- [ ] **Step 8: Commit the final local T15-A gate**

  ```powershell
  git add HANDOFF.md
  git diff --cached --check
  git diff --cached --stat
  git commit -m "chore(vs005): complete T15-A local readiness gate"
  ```

**Checkpoint deliverable:** T15-A implementation is locally complete and evidence-backed, with provider read-only inspection prepared for a later host-operated checkpoint. No hosted rehearsal or remote mutation is performed.

## Execution Order and Authorization Stop Conditions

Execute Tasks 1 through 10 in order. Each task ends in an independently reviewable commit. The implementation sequence stops before provider operations.

The next host-operated action is a separately approved read-only provider inspection after the final local commit, green tests, code review, and local readiness review. The implementation plan does not execute it. The provider inspection must use the exact Beta policy and target tuple and must fail closed if the provider cannot prove a required phase fact.

The first hosted mutation requires a later explicit written authorization naming:

- Cloudflare account `3d6a31905ac44e9563a523f9c86cbb8d`, Worker `mycadence`, and public URL `https://mycadence.ngohch-3d6.workers.dev`;
- Supabase display label `cadence-beta`, authoritative ref `pwmhasbmacmeerbsagda`, and controlled Project `3503f8c7-1996-44d1-8b63-1fca36db89f8`;
- permitted hosted deployment/configuration, binding/secret configuration, Cron change, controlled suspension/restoration, drift/restoration, second version, application rollback, and normal hosted rehearsal writes;
- explicit prohibition of `cadence-dev`, unrelated QA Project mutation, database reset, migration creation, repair, reversal, database rollback, ad hoc destructive SQL, and Pilot Activation.

Stop and return for governance review if a schema migration, database reset/repair/reversal, database rollback, destructive SQL, provider-state-to-business-state coupling, generic Beta hard-coding, personal credential dependency, unsupported provider observation, raw secret/provider-output leakage, VS001-VS004 regression, or P0/P1 defect appears.

## Expected Implementation File Set

### New files

- `apps/api/src/bootstrap/cadence-target-policy.ts`
- `apps/api/src/bootstrap/cadence-target-policy.test.ts`
- `apps/api/scripts/vs005-provider-observations.ts`
- `apps/api/scripts/vs005-provider-observations.test.ts`
- `apps/api/scripts/vs005-beta-config.test.ts`
- `apps/api/scripts/vs005-t15a-readiness.ts`
- `apps/api/scripts/vs005-t15a-readiness.test.ts`

### Modified implementation/config files

- `config/cadence.runtime.schema.json`
- `config/cadence.runtime.example.json`
- `config/cadence.runtime.ci.json`
- `config/cadence.runtime.beta.json`
- `apps/api/src/bootstrap/cadence-config-schema.ts`
- `apps/api/src/bootstrap/cadence-config.ts`
- `apps/api/src/bootstrap/cadence-config.test.ts`
- `apps/api/scripts/vs005-generate-deployment.ts`
- `apps/api/scripts/vs005-generate-deployment.test.ts`
- `apps/api/scripts/vs005-cloudflare-deployment-provider.ts`
- `apps/api/scripts/vs005-cloudflare-deployment-provider.test.ts`
- `apps/api/scripts/vs005-deployment-artifacts.ts`
- `apps/api/scripts/vs005-deployment-artifacts.test.ts`
- `apps/api/scripts/vs005-deploy-plan.ts`
- `apps/api/scripts/vs005-deploy-plan.test.ts`
- `apps/api/scripts/vs005-deploy-apply.ts`
- `apps/api/scripts/vs005-deploy-apply.test.ts`
- `apps/api/scripts/vs005-deploy-verify.ts`
- `apps/api/scripts/vs005-deploy-verify.test.ts`
- `apps/api/scripts/vs005-rollback.ts`
- `apps/api/scripts/vs005-rollback.test.ts`
- `apps/api/scripts/vs005-package-wiring.test.ts`
- `apps/api/src/runtime/create-cadence-app.test.ts`
- `apps/api/package.json`
- `package.json`
- `HANDOFF.md`
- `docs/runbooks/VS005_DEPLOYMENT.md`

No frozen VS005 source record, implementation-plan DOCX, `.cadence` evidence artifact, unrelated QA resource, or clean-room target is modified by this plan.

## TDD and Regression Command Matrix

| Boundary | RED/GREEN test command | Required regression |
|---|---|---|
| Generic config and generator | `node --import tsx --test src/bootstrap/cadence-config.test.ts scripts/vs005-generate-deployment.test.ts` | API typecheck and full quality |
| Beta policy | `node --import tsx --test src/bootstrap/cadence-target-policy.test.ts` | Generic config tests |
| Observation model | `node --import tsx --test scripts/vs005-provider-observations.test.ts` | Script typecheck |
| Provider adapter | `node --import tsx --test scripts/vs005-cloudflare-deployment-provider.test.ts` | Rollback/provider tests |
| Plan artifacts | `node --import tsx --test scripts/vs005-deployment-artifacts.test.ts scripts/vs005-deploy-plan.test.ts` | Plan/apply/provider tests |
| Apply | `node --import tsx --test scripts/vs005-deploy-apply.test.ts` | Plan/artifact/provider tests |
| Verify/rollback | `node --import tsx --test scripts/vs005-deploy-verify.test.ts scripts/vs005-rollback.test.ts` | Runtime health and provider tests |
| Beta config | `node --import tsx --test scripts/vs005-beta-config.test.ts` | Package wiring and policy tests |
| Local readiness | `node --import tsx --test scripts/vs005-t15a-readiness.test.ts` | Hash, diff, and full quality gates |
| Final repository gate | `npm run quality` plus the focused suite in Task 10 | API, web, adapter, typecheck, dry-run, and `git diff --check` |

## Acceptance Mapping: Approved T15-A Design Sections 1-18

| Design section | Implementation task | Test/evidence proving coverage |
|---:|---|---|
| 1. Context | Tasks 8-10 | Beta-config provenance test; HANDOFF lineage; local readiness source commit and hashes |
| 2. Problem | Task 1 and Task 4 | Explicit Worker-name generator test; provider inspection tests prove no fabricated Worker state |
| 3. Approved decision | Task 2 and Task 8 | Exact `VS005_BETA_TARGET_POLICY`; reconciled Beta-config exact-tuple test |
| 4. Canonical target model | Task 1 | Schema/parser/type/fingerprint/generator tests and schema serialization-equivalence test |
| 5. Fail-closed target semantics | Tasks 2, 5, 6, 7 | Field-by-field policy mismatch tests; stale plan/apply/verify drift tests |
| 6. Provider observation model | Task 3 and Task 4 | Tri-state tests; first-deployment and rollback completeness tests; injected adapter fixtures |
| 7. Deployment plan/apply/verify integration | Tasks 5, 6, 7 | Version-2 artifact tests; plan binding; apply reinspection; post-deploy verification; `NOT_AUTHORISED` assertion |
| 8. Beta config provenance/reconciliation | Task 8 and Task 9 | Exact config test; no-privileged-secret test; provenance artifact and HANDOFF evidence |
| 9. HANDOFF reconciliation | Task 9 and Task 10 | Lineage grep, actual implementation checkpoint recording, and documentation diff review |
| 10. Clean-room separation | Tasks 2, 9, 10 | Injected alternate policy test; local readiness firewall; explicit no clean-room operation in final gate |
| 11. Secret boundary | Tasks 4, 6, 7, 8, 9 | Secret-name-only provider tests; temporary-file cleanup tests; artifact/browser/log leakage tests |
| 12. Database boundary | Tasks 5, 6, 7, 9, 10 | `NONE` artifact assertions; destructive-action rejection; command audit; no migration/reset operation |
| 13. T15-A implementation scope | Tasks 1-10 | Expected file set, per-task commits, local-only regression matrix, no hosted step |
| 14. Testing requirements | Tasks 1-7 and Task 10 | Named RED cases for generic config, Beta policy, observations, plan, apply, verify, rollback, and leakage |
| 15. Evidence/governance | Tasks 9-10 | `Vs005LocalReadinessArtifact`, frozen hashes, source commit, target fingerprint, authorization fields |
| 16. Authorization gates | Tasks 5, 6, 9, 10 | Read-only plan boundary; apply gate; runbook gate; explicit next-step authorization text |
| 17. Non-goals | Tasks 9-10 | Command audit and final status confirm no hosted deploy, Cron, drift, rollback, clean-room, or Pilot Activation |
| 18. Risks/stop conditions | All tasks, consolidated in Task 10 | Stable blocker codes, failed-phase tests, governance stop list, and final local gate |

Requirements unmapped: **0**.

Original governed commitments removed: **0**.

Original governed commitments moved beyond M3: **0**.

44 parent commitments preserved: **YES**.

178 child records preserved: **YES**.

## Authorization and Portability Audit

- Generic schema/parser semantics contain no reviewed Beta IDs.
- Exact Beta IDs exist only in `cadence-target-policy.ts`, its tests, and the reconciled governed Beta config where exact target authority is intended.
- `cadence-beta` remains environment/safe marker/operator display label; `mycadence` remains Worker identity.
- Supabase authority is `projectRef`, not a redundant display-name field.
- First deployment accepts an absent Worker and does not require prior version A.
- Rollback requires explicit retained version A and current release/configuration identity.
- No implementation task contacts Cloudflare or Supabase.
- No implementation task performs a provider mutation, hosted HTTP verification, Cron change, normal hosted business write, clean-room initialization, or Pilot Activation.
- Clean-room target policy remains separately injectable and separately authorized before T15-K.
- No implementation task creates a migration, resets a database, repairs or reverses migration history, rolls back database state, or runs ad hoc destructive SQL.
- Secrets are externally supplied by name only; values never enter canonical config, plan, evidence, logs, browser/static output, or Git.

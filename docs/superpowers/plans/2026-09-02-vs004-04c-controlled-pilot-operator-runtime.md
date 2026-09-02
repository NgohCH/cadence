# VS004-04C — Controlled Pilot Operator Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two safe operator commands that transport a reviewed VS004 prepared execution artifact into the committed 04B mutation executor without creating a second authority model.

**Architecture:** A transport layer validates thin versioned envelopes and a filesystem layer reserves and publishes artifacts without silent replacement. A runtime composition boundary constructs the existing provider, read-only observation views, and module-owned preparation services; testable preflight and execute command handlers receive only the capability set for their phase. The handlers call the committed 04A and 04B boundaries once and perform no planning, reconciliation, retry, or compensation.

**Tech Stack:** Node.js CommonJS runtime with TypeScript/tsx, Node `fs/promises`, `node:crypto`, `@supabase/supabase-js`, the existing `node:test` test runner, npm package scripts, and TypeScript strict checking.

**Spec:** `docs/superpowers/specs/2026-09-02-vs004-04c-controlled-pilot-operator-runtime-design.md`

## Global Constraints

- `pilot:preflight` accepts a manifest and runtime configuration, invokes read-only 04A, and writes a prepared artifact; it never invokes 04B.
- `pilot:execute` accepts only a prepared artifact and independently loaded runtime configuration; it never accepts a manifest as execution authority and never invokes 04A or `buildPilotPreflightPlan()`.
- Prepared, result, and failure artifacts use `artifactType` plus `formatVersion: 1`; wrong type, missing version, and unsupported version fail without migration.
- `PreparedPilotExecution` remains the canonical prepared authority payload; envelopes add transport metadata only.
- Execute must reserve both success and failure output destinations before constructing or invoking mutation execution.
- Existing final output paths are refused; no `--force`, silent overwrite, automatic command chaining, `--yes`, or `--execute-after-preflight` option is added.
- A successful 04B run followed by success-publication failure is reported as completed execution with failed durable success evidence; it is never retried or compensated.
- Runtime secrets are loaded only from process configuration and never enter artifacts, result/error objects, or normal console output.
- `CADENCE_SAFE_TARGET_MARKER` is target metadata only. `SUPABASE_PUBLISHABLE_KEY` is not an 04C requirement unless a later audit proves a committed 04C adapter needs it.
- `ProjectAuthorisationService` remains the sole normal application Project authority. 04C does not expose a browser route, HTTP route, or alternate authorization model.
- Projects, Project Health, Identity, and Project Membership persistence remain module-owned. The command handlers receive application contracts, not repositories, RPCs, or raw Supabase clients.
- Stable Person identity, canonical membership/role/protected-transfer history, R03 retained-field rules, VS001/VS002/VS003 behavior, and the VS004 frozen contract remain unchanged.
- No database reset, live bootstrap, schema change, migration, VS005 deployment/worker work, or VS006 operations work is permitted during implementation.

---

## Audited Repository Facts and File Map

The implementation must use these committed facts:

- `apps/api/scripts/vs004-pilot-manifest.ts` exports `validatePilotManifest()`, `computeManifestHash()`, `PilotTargetDeclaration`, and `ValidatedPilotManifest`.
- `apps/api/scripts/vs004-preflight.ts` exports `PilotRuntimeTarget`, `validatePilotRuntimeTarget()`, `PilotPlanOperationKind`, `PilotPreflightPlan`, and `buildPilotPreflightPlan()`.
- `apps/api/scripts/vs004-controlled-pilot-preflight.ts` exports `PreparedPilotExecution` and `preparePilotExecution()`; it already deep-freezes the result and uses read-only observation sources.
- `apps/api/scripts/vs004-controlled-pilot-execution.ts` exports `ControlledPilotExecutionServices`, `executeControlledPilot()`, `PilotExecutionResult`, and `ControlledPilotExecutionError`; it already enforces prepared-plan integrity, target revalidation, the six dependency phases, and no compensation.
- `apps/api/src/bootstrap/environment-safety.ts` is the canonical validator for `CADENCE_ENV`, `SUPABASE_URL`, and `CADENCE_SUPABASE_PROJECT_REF`. It accepts `local`, `qa`, and `beta`; local requires loopback Supabase URL and no project reference; hosted targets require HTTPS and a matching project reference.
- `AdministrativeAuthProvider` exposes `findAccounts()` and `createAccount()`. `SupabaseAdministrativeAuthProvider` is the only provider-specific administrative Auth adapter audited for this work.
- `SupabaseIdentityPilotPreparationRepository`, `SupabaseProjectsPilotPreparationRepository`, `SupabaseProjectHealthPilotPreparationRepository`, `SupabaseProjectMembershipRepository`, `SupabaseProjectMemberAdmissionRepository`, `SupabaseProjectRoleManagementRepository`, and `SupabaseProjectMembershipPilotPreparationRepository` are the existing module-owned adapters used by 03A, 03B, and 04B0.
- 04A's `ControlledPilotObservationSources` requires a narrower `PilotAuthAccountReader`, `IdentityPilotObservationRepository`, `ProjectsPilotObservationRepository`, `ProjectHealthPilotObservationRepository`, and `ProjectMembershipPilotObservationRepository`. Runtime composition must pass read-only views even when a concrete adapter also has writes.
- The current Membership adapters split the necessary read methods: `SupabaseProjectMembershipRepository` supplies canonical memberships and per-membership role assignments; `SupabaseProjectMembershipPilotPreparationRepository` supplies project-wide role-assignment and protected-transfer read ports. A composition mapper will combine only those read methods into 04A's observation shape. It will not write persistence or create a new domain authority.
- The existing server and worker construct a server-side `createClient()` with `SUPABASE_URL` and `SUPABASE_SECRET_KEY`, with session persistence and refresh disabled. No shared 04C client factory or artifact utility exists.
- The API package uses npm scripts and `node --import tsx`; its normal `typecheck` includes `src/**/*.ts` and excludes scripts. Script tests therefore use explicit `node --import tsx --test ...` commands, and 04C adds an explicit script typecheck project rather than weakening the API typecheck.
- The repository has root npm wrappers and separate `apps/api/package.json` scripts. There is no pnpm workspace file. Package command wiring belongs in the last implementation task.

Final planned files:

- Create `apps/api/scripts/vs004-controlled-pilot-artifact.ts` and `.test.ts` for versioned envelope types, structural validation, and credential-free serialization.
- Create `apps/api/scripts/vs004-controlled-pilot-file.ts` and `.test.ts` for JSON file reads, no-overwrite publication, and output reservation.
- Create `apps/api/scripts/vs004-controlled-pilot-runtime-config.ts` and `.test.ts` for environment-to-target/configuration loading.
- Create `apps/api/scripts/vs004-controlled-pilot-observation-adapters.ts` and `.test.ts` for read-only composition mapping where existing module read ports have different method shapes.
- Create `apps/api/scripts/vs004-controlled-pilot-runtime.ts` and `.test.ts` for concrete adapter/service composition.
- Create `apps/api/scripts/vs004-controlled-pilot-preflight-command.ts` and `.test.ts` for the testable preflight handler.
- Create `apps/api/scripts/vs004-controlled-pilot-preflight-cli.ts` as a thin process entrypoint.
- Create `apps/api/scripts/vs004-controlled-pilot-execute-command.ts` and `.test.ts` for the testable execute handler.
- Create `apps/api/scripts/vs004-controlled-pilot-execute-cli.ts` as a thin process entrypoint.
- Create `apps/api/tsconfig.scripts.json` to typecheck the 04C scripts without changing the existing `src`-only API typecheck.
- Modify `apps/api/package.json` and root `package.json` only in the final package-wiring task.

No existing source, migration, fixture, governance, or web file is otherwise in scope.

## Task 1: Versioned Artifact Transport

**Files:**

- Create: `apps/api/scripts/vs004-controlled-pilot-artifact.ts`
- Test: `apps/api/scripts/vs004-controlled-pilot-artifact.test.ts`
- Read: `apps/api/scripts/vs004-controlled-pilot-preflight.ts`
- Read: `apps/api/scripts/vs004-controlled-pilot-execution.ts`
- Read: `apps/api/scripts/vs004-pilot-manifest.ts`
- Read: `apps/api/scripts/vs004-preflight.ts`

**Interfaces:**

- Consumes: `PreparedPilotExecution`, `PilotExecutionResult`, `ControlledPilotExecutionError`, `PilotExecutionOutcome`, `PilotPlanOperationKind`, `validatePilotManifest()`, and `computeManifestHash()`.
- Produces:

```ts
export const PREPARED_ARTIFACT_TYPE =
  "cadence.vs004.prepared-pilot-execution" as const;
export const RESULT_ARTIFACT_TYPE =
  "cadence.vs004.pilot-execution-result" as const;
export const FAILURE_ARTIFACT_TYPE =
  "cadence.vs004.pilot-execution-failure" as const;
export const CURRENT_ARTIFACT_FORMAT_VERSION = 1 as const;

export interface PreparedPilotExecutionEnvelope {
  readonly artifactType: typeof PREPARED_ARTIFACT_TYPE;
  readonly formatVersion: typeof CURRENT_ARTIFACT_FORMAT_VERSION;
  readonly preparedExecution: PreparedPilotExecution;
}

export interface PilotExecutionResultEnvelope {
  readonly artifactType: typeof RESULT_ARTIFACT_TYPE;
  readonly formatVersion: typeof CURRENT_ARTIFACT_FORMAT_VERSION;
  readonly result: PilotExecutionResult;
}

export interface PilotExecutionFailureEvidence {
  readonly manifestId?: string;
  readonly manifestHash?: string;
  readonly runCorrelationId: string;
  readonly target?: PreparedPilotExecution["target"];
  readonly category: string;
  readonly failedOperation?: Readonly<{ resourceKey: string; kind: string }>;
  readonly completedOutcomes: readonly PilotExecutionOutcome[];
  readonly executionCompleted: boolean;
  readonly completedResult?: PilotExecutionResult;
  readonly recordedAt: string;
}

export interface PilotExecutionFailureEnvelope {
  readonly artifactType: typeof FAILURE_ARTIFACT_TYPE;
  readonly formatVersion: typeof CURRENT_ARTIFACT_FORMAT_VERSION;
  readonly failure: PilotExecutionFailureEvidence;
}

export function parsePreparedPilotExecutionArtifact(
  serialized: string,
): PreparedPilotExecution;
export function serializePreparedPilotExecutionArtifact(
  prepared: PreparedPilotExecution,
): string;
export function serializePilotExecutionResultArtifact(
  result: PilotExecutionResult,
): string;
export function serializePilotExecutionFailureArtifact(
  failure: PilotExecutionFailureEvidence,
): string;
```

The parser must return the exact inner payload after explicit runtime guards; it must not use a direct TypeScript cast from `JSON.parse()`. Validate envelope discriminator/version before validating nested payload. Re-run canonical manifest validation and manifest-hash consistency while validating a prepared payload, but leave current-state and operation semantic integrity to 04B.

- [ ] **Step 1: Write failing transport tests**

Add tests for:

1. current prepared envelope round trip returns a deep-equal `PreparedPilotExecution`;
2. current result and failure envelopes round trip;
3. malformed JSON fails;
4. missing envelope fields fail;
5. wrong `artifactType` fails;
6. missing `formatVersion` fails;
7. future/unsupported `formatVersion` fails without migration;
8. nested invalid prepared payload fails;
9. unsupported nested operation kind fails;
10. an unexpected credential-shaped field or credential value fails;
11. serialized payload does not contain secret/password/token/provider-key values;
12. the prepared inner payload is not changed by envelope serialization/deserialization.

Use a valid in-memory prepared fixture assembled from the committed 04A test fixture helpers or a local factory in this test file. Do not read a live manifest or database.

- [ ] **Step 2: Run the focused tests and confirm RED**

Run from `apps/api`:

```text
node --import tsx --test scripts/vs004-controlled-pilot-artifact.test.ts
```

Expected RED: the artifact module and its envelope parsers are not yet defined, so the test file cannot import the required exports or reports the missing transport behavior. Record the failing command and the intended missing behavior before adding production code.

- [ ] **Step 3: Implement the minimum transport layer**

Implement literal discriminator/version constants, explicit object/array/string/number/boolean guards, nested validation for the committed prepared/result shapes, and stable JSON serialization. Reject secret-shaped fields rather than stripping them. Build failure evidence from selected safe fields only; never serialize `Error` objects, stack traces, raw provider responses, or raw database responses.

- [ ] **Step 4: Run focused GREEN tests**

Run the same `node --import tsx --test scripts/vs004-controlled-pilot-artifact.test.ts` command. Expected result: all artifact tests pass, including wrong-type/version rejection and credential scans.

- [ ] **Step 5: Commit the transport checkpoint**

```text
git add apps/api/scripts/vs004-controlled-pilot-artifact.ts apps/api/scripts/vs004-controlled-pilot-artifact.test.ts
git commit -m "feat(vs004): add operator artifact transport"
```

## Task 2: Atomic Publication and Execute-Output Reservation

**Files:**

- Create: `apps/api/scripts/vs004-controlled-pilot-file.ts`
- Test: `apps/api/scripts/vs004-controlled-pilot-file.test.ts`
- Read: Node `fs/promises` documentation and current Windows PowerShell behavior during implementation; do not assume `rename()` is no-replace on every supported platform.

**Interfaces:**

- Consumes: envelope serializers from Task 1 and output paths supplied by command handlers.
- Produces:

```ts
export interface PilotArtifactFileSystem {
  readUtf8(path: string): Promise<string>;
  fileExists(path: string): Promise<boolean>;
  directoryIsWritable(path: string): Promise<boolean>;
  createExclusiveSibling(path: string): Promise<{
    readonly tempPath: string;
    readonly close: () => Promise<void>;
  }>;
  writeAndFlush(tempPath: string, content: string): Promise<void>;
  publishNoReplace(tempPath: string, finalPath: string): Promise<void>;
  removeIfPresent(path: string): Promise<void>;
}

export interface ExecutionOutputReservation {
  readonly successPath: string;
  readonly failurePath: string;
  publishSuccess(content: string): Promise<void>;
  publishFailure(content: string): Promise<void>;
  releaseUnused(): Promise<void>;
}

export async function readJsonFile(
  fileSystem: PilotArtifactFileSystem,
  path: string,
): Promise<string>;
export async function publishJsonNoReplace(
  fileSystem: PilotArtifactFileSystem,
  path: string,
  content: string,
): Promise<void>;
export async function reserveExecutionOutputs(
  fileSystem: PilotArtifactFileSystem,
  successPath: string,
  failurePath: string,
): Promise<ExecutionOutputReservation>;
```

The concrete Node adapter must create sibling temporary files exclusively, flush and close them, and publish with a verified no-replace mechanism. The reservation must check both final paths, parent directory availability/writability, and exclusive reservation collisions before 04B. If the supported platform cannot guarantee no silent replacement, `reserveExecutionOutputs()` fails before returning a reservation. Keep reservation cleanup idempotent and never delete a pre-existing final artifact.

For Windows, explicitly test destination-exists behavior and the selected no-replace publication primitive. If the cross-platform primitive cannot satisfy the invariant, keep the operation behind the injected port and fail closed; do not weaken the invariant by calling plain replacement semantics.

- [ ] **Step 1: Write failing filesystem and reservation tests**

Use an in-memory fake `PilotArtifactFileSystem` for deterministic failures and a temporary test directory only for the concrete adapter tests. Cover:

1. existing prepared/result final path is refused;
2. existing failure destination is refused when required evidence could not be published;
3. missing parent directory fails;
4. unusable parent directory fails;
5. exclusive reservation collision fails;
6. successful prepared publication leaves one complete final file;
7. successful result/failure reservation publishes each destination without overwrite;
8. simulated write failure removes temporary state and leaves no accepted final file;
9. simulated rename/publication failure leaves no accepted partial final file;
10. unused success/failure reservations clean up their temporary resources;
11. publication after successful 04B can fail deterministically for command-layer testing;
12. reservation exposes no database/provider/mutation capability.

- [ ] **Step 2: Run the focused tests and confirm RED**

```text
node --import tsx --test scripts/vs004-controlled-pilot-file.test.ts
```

Expected RED: the file-system port, reservation implementation, and no-replace publication behavior are absent.

- [ ] **Step 3: Implement the narrow file and reservation layer**

Implement the injected port, the Node `fs/promises` adapter, exclusive sibling creation, UTF-8 write/flush/close, no-replace publication, and safe cleanup. Do not expose a generic delete or overwrite operation to command handlers. Make `reserveExecutionOutputs()` reserve both success and `<successPath>.failed.json` before it returns.

- [ ] **Step 4: Run focused GREEN tests**

Run the same focused command and confirm all reservation/publication tests pass, including the Windows-specific no-overwrite assertion on the supported development platform.

- [ ] **Step 5: Commit the publication checkpoint**

```text
git add apps/api/scripts/vs004-controlled-pilot-file.ts apps/api/scripts/vs004-controlled-pilot-file.test.ts
git commit -m "feat(vs004): add atomic pilot artifact publication"
```

## Task 3: Runtime Configuration and Target Loading

**Files:**

- Create: `apps/api/scripts/vs004-controlled-pilot-runtime-config.ts`
- Test: `apps/api/scripts/vs004-controlled-pilot-runtime-config.test.ts`
- Read: `apps/api/src/bootstrap/environment-safety.ts`
- Read: `apps/api/scripts/assert-environment.ts`
- Read: `apps/api/src/server.ts`
- Read: `apps/api/src/worker.ts`
- Read: `apps/api/scripts/bootstrap-local-dev.ts`

**Interfaces:**

- Consumes: `NodeJS.ProcessEnv`, `validateCadenceEnvironmentSafety()`, and `PilotRuntimeTarget`.
- Produces:

```ts
export interface ControlledPilotRuntimeConfiguration {
  readonly runtimeTarget: PilotRuntimeTarget;
  readonly supabaseSecretKey: string;
  readonly firstAccountPassword: string | undefined;
}

export function loadControlledPilotRuntimeConfiguration(
  environment: NodeJS.ProcessEnv,
): ControlledPilotRuntimeConfiguration;
```

`runtimeTarget` contains only `cadenceEnv`, `supabaseUrl`, `supabaseProjectRef`, and `safeTargetMarker`. Project ID remains manifest-bound and is checked by 04A/04B against the prepared target. Require nonblank `CADENCE_SAFE_TARGET_MARKER` and map it exactly to `safeTargetMarker`. Reuse `validateCadenceEnvironmentSafety()`; do not duplicate URL, environment, or project-reference rules.

Require `CADENCE_ENV`, `SUPABASE_URL`, `CADENCE_SAFE_TARGET_MARKER`, and `SUPABASE_SECRET_KEY`. Require `CADENCE_SUPABASE_PROJECT_REF` only through the existing hosted-environment validator. Load the audited first-account credential `CADENCE_LOCAL_DEV_PASSWORD` as protected runtime-only input when present; do not add another password variable. Do not read or require `SUPABASE_PUBLISHABLE_KEY` for 04C.

- [ ] **Step 1: Write failing configuration tests**

Cover missing/blank required values, malformed environment, local URL/project-reference mismatch, hosted URL/project-reference mismatch, unsupported environment, safe-marker loading and target binding, secret presence without leakage into the returned safe target, and absence of publishable-key dependency.

- [ ] **Step 2: Run the focused tests and confirm RED**

```text
node --import tsx --test scripts/vs004-controlled-pilot-runtime-config.test.ts
```

Expected RED: the canonical 04C configuration loader is not defined.

- [ ] **Step 3: Implement the minimum loader**

Call `validateCadenceEnvironmentSafety()` once, require the safe marker separately, and return the server credential/password only in the runtime configuration object. Ensure error messages name safe configuration categories without echoing values.

- [ ] **Step 4: Run focused GREEN tests and the existing safety suite**

```text
node --import tsx --test scripts/vs004-controlled-pilot-runtime-config.test.ts src/bootstrap/environment-safety.test.ts src/bootstrap/environment-safety.wiring.test.ts
```

Expected result: the new configuration tests and existing environment-safety tests pass.

- [ ] **Step 5: Commit the configuration checkpoint**

```text
git add apps/api/scripts/vs004-controlled-pilot-runtime-config.ts apps/api/scripts/vs004-controlled-pilot-runtime-config.test.ts
git commit -m "feat(vs004): load controlled pilot runtime target"
```

## Task 4: Read-Only Observation Composition Mapper

**Files:**

- Create: `apps/api/scripts/vs004-controlled-pilot-observation-adapters.ts`
- Test: `apps/api/scripts/vs004-controlled-pilot-observation-adapters.test.ts`
- Read: `apps/api/scripts/vs004-controlled-pilot-preflight.ts`
- Read: `apps/api/src/modules/project-membership/project-membership.repository.ts`
- Read: `apps/api/src/modules/project-membership/project-role-assignment-read.repository.ts`
- Read: `apps/api/src/modules/project-membership/project-role-transfer-read.repository.ts`

**Interfaces:**

- Consumes: `ControlledPilotObservationSources`, `ProjectMembershipRepository`, and `ProjectRoleTransferReadRepository`.
- Produces:

```ts
export interface MembershipObservationReads {
  readonly memberships: Pick<
    ProjectMembershipRepository,
    "listMembershipsForProject" | "listRoleAssignments"
  >;
  readonly protectedTransfers: Pick<
    ProjectRoleTransferReadRepository,
    "listProtectedRoleTransfers"
  >;
}

export function createMembershipPilotObservationSource(
  reads: MembershipObservationReads,
): ProjectMembershipPilotObservationRepository;

export function createReadOnlyAuthAccountReader(
  provider: Pick<AdministrativeAuthProvider, "findAccounts">,
): PilotAuthAccountReader;
```

The mapper must expose only the three 04A membership observation methods. It must not accept a `ProjectMembershipPilotPreparationService`, a write repository, an RPC, or a raw Supabase client. Its `listRoleAssignments(membershipId)` delegates only to the existing canonical membership read port; protected transfer reads delegate only to the existing transfer read port.

- [ ] **Step 1: Write failing mapper and capability tests**

Test that all required reads are delegated, returned values are preserved, read failures propagate, and the mapper's TypeScript dependency surface contains no write method, service, raw client, or RPC operation. Test the Auth read facade separately and prove `createAccount` is not part of its type.

- [ ] **Step 2: Run the focused tests and confirm RED**

```text
node --import tsx --test scripts/vs004-controlled-pilot-observation-adapters.test.ts
```

Expected RED: the composition mapper and read-only facades are not defined.

- [ ] **Step 3: Implement the read-only mapper**

Return object-literal facades with only the required methods. Do not import or instantiate any Supabase client in this file.

- [ ] **Step 4: Run focused GREEN tests**

Run the same focused command and confirm read delegation and no-write capability tests pass.

- [ ] **Step 5: Commit the observation-boundary checkpoint**

```text
git add apps/api/scripts/vs004-controlled-pilot-observation-adapters.ts apps/api/scripts/vs004-controlled-pilot-observation-adapters.test.ts
git commit -m "feat(vs004): compose read-only pilot observations"
```

## Task 5: Controlled Pilot Runtime Composition

**Files:**

- Create: `apps/api/scripts/vs004-controlled-pilot-runtime.ts`
- Test: `apps/api/scripts/vs004-controlled-pilot-runtime.test.ts`
- Read: `apps/api/src/infrastructure/auth/supabase-administrative-auth-provider.ts`
- Read: `apps/api/src/infrastructure/database/supabase-identity-pilot-preparation.repository.ts`
- Read: `apps/api/src/infrastructure/database/supabase-projects-pilot-preparation.repository.ts`
- Read: `apps/api/src/infrastructure/database/supabase-project-health-pilot-preparation.repository.ts`
- Read: `apps/api/src/infrastructure/database/supabase-project-membership.repository.ts`
- Read: `apps/api/src/infrastructure/database/supabase-project-member-admission.repository.ts`
- Read: `apps/api/src/infrastructure/database/supabase-project-role-management.repository.ts`
- Read: `apps/api/src/infrastructure/database/supabase-project-membership-pilot-preparation.repository.ts`
- Read: `apps/api/src/modules/identity/pilot-preparation.service.ts`
- Read: `apps/api/src/modules/projects/pilot-preparation.service.ts`
- Read: `apps/api/src/modules/project-health/pilot-preparation.service.ts`
- Read: `apps/api/src/modules/project-membership/pilot-preparation.service.ts`

**Interfaces:**

- Consumes: `ControlledPilotRuntimeConfiguration`, the audited Supabase adapter constructors, `ControlledPilotObservationSources`, and `ControlledPilotExecutionServices`.
- Produces:

```ts
export interface ControlledPilotRuntime {
  readonly observationSources: ControlledPilotObservationSources;
  readonly executionServices: ControlledPilotExecutionServices;
}

export function buildControlledPilotRuntime(
  configuration: ControlledPilotRuntimeConfiguration,
): ControlledPilotRuntime;
```

Construct one server-side Supabase client with `SUPABASE_URL` and `SUPABASE_SECRET_KEY`, disabling auto-refresh, session persistence, and URL session detection as the existing server/worker do. Construct `SupabaseAdministrativeAuthProvider`, the Identity preparation repository/service, Projects preparation repository/service, Project Health preparation repository/service, canonical Membership/admission/role repositories, the 04B0 pilot-preparation read adapter, and `ProjectMembershipPilotPreparationService` using their committed constructors.

Return read-only object views for 04A: the administrative provider is narrowed to `findAccounts`; Identity, Projects, and Project Health adapters are narrowed to their observation interfaces; the Membership mapper from Task 4 is used. Return 04B application services through `ControlledPilotExecutionServices`; do not return repositories or the raw client.

The Identity service facade must bind `configuration.firstAccountPassword` into the existing `PilotIdentityPreparationContext.password` only when invoking the committed Identity service. The password must not be included in `PreparedPilotExecution`, `PilotExecutionResult`, `ControlledPilotExecutionError`, or console output. This facade does not create a new provider or authority model.

- [ ] **Step 1: Write failing composition tests**

Use fake Supabase client construction and fake module repositories/services. Test that the runtime exposes both capability groups, 04A can call every required read, 04B can call every committed preparation method, the Identity password is bound only inside the service call, and no handler-facing dependency exposes raw Supabase, repository mutation methods, direct RPCs, `ProjectAuthorisationService`, or HTTP routes. Verify Projects and Project Health are separate and that Project Health is not passed through the Projects observation/preparation boundary.

- [ ] **Step 2: Run the focused tests and confirm RED**

```text
node --import tsx --test scripts/vs004-controlled-pilot-runtime.test.ts
```

Expected RED: `buildControlledPilotRuntime()` and its service/read-only capability boundaries are absent.

- [ ] **Step 3: Implement the composition boundary**

Implement only construction and narrowing. Keep all business decisions in 04A, 04B, and the existing module services. Do not add table queries, RPC calls, or operation derivation in the runtime composition file.

- [ ] **Step 4: Run focused GREEN tests and script typecheck**

Run:

```text
node --import tsx --test scripts/vs004-controlled-pilot-runtime.test.ts
npx tsc --noEmit -p tsconfig.scripts.json
```

Expected result: composition tests and the current script typecheck project pass.

- [ ] **Step 5: Commit the composition checkpoint**

```text
git add apps/api/scripts/vs004-controlled-pilot-runtime.ts apps/api/scripts/vs004-controlled-pilot-runtime.test.ts
git commit -m "feat(vs004): compose controlled pilot runtime"
```

## Task 6: Testable Preflight Command Handler

**Files:**

- Create: `apps/api/scripts/vs004-controlled-pilot-preflight-command.ts`
- Test: `apps/api/scripts/vs004-controlled-pilot-preflight-command.test.ts`
- Read: `apps/api/scripts/vs004-controlled-pilot-preflight.ts`
- Read: `apps/api/scripts/vs004-controlled-pilot-artifact.ts`
- Read: `apps/api/scripts/vs004-controlled-pilot-file.ts`
- Read: `apps/api/scripts/vs004-controlled-pilot-runtime-config.ts`

**Interfaces:**

- Consumes: manifest path, output path, `preparePilotExecution()`, read-only `ControlledPilotObservationSources`, runtime target configuration, and prepared-envelope/file publication functions.
- Produces:

```ts
export interface PreflightCommandArguments {
  readonly manifestPath: string;
  readonly outputPath: string;
}

export type PreflightCommandParseResult =
  | { readonly kind: "RUN"; readonly arguments: PreflightCommandArguments }
  | { readonly kind: "HELP" };

export interface PreflightCommandDependencies {
  readonly readManifest: (path: string) => Promise<string>;
  readonly loadConfiguration: () => ControlledPilotRuntimeConfiguration;
  readonly observationSources: ControlledPilotObservationSources;
  readonly prepare: typeof preparePilotExecution;
  readonly publishPrepared: (path: string, content: string) => Promise<void>;
  readonly createRunCorrelationId: () => string;
  readonly writeLine: (line: string) => void;
}

export interface PreflightCommandResult {
  readonly exitCode: 0 | 1;
  readonly prepared?: PreparedPilotExecution;
}

export function parsePreflightArguments(
  argv: readonly string[],
): PreflightCommandParseResult;
export async function runPreflightCommand(
  args: PreflightCommandArguments,
  dependencies: PreflightCommandDependencies,
): Promise<PreflightCommandResult>;
```

Parse only `--manifest <path>` and `--out <path>`, with one occurrence of each, or the exclusive `--help` flag. Reject unknown, missing, duplicate, empty, and extra arguments. `--help` prints fixed usage and exits zero without loading configuration or constructing runtime services. The handler reads the manifest, loads target configuration, creates one fresh correlation ID, passes only read-only sources to 04A, serializes the prepared envelope, and calls the no-overwrite publisher. It never accepts or constructs 04B services. On success it prints manifest ID, environment, Project ID, correlation ID, counts, `PREPARED — NOT EXECUTED`, and `NO MUTATIONS PERFORMED`. It never prints the complete manifest, login list, credentials, provider response, or arbitrary caught errors.

- [ ] **Step 1: Write failing preflight command tests**

Cover valid argument parsing, unknown/missing/duplicate argument rejection, manifest read/validation failure before observation, target failure before observation, exactly one 04A invocation, one generated correlation ID, prepared envelope publication, safe summary, no 04B dependency, and nonzero results for read/planning/publication failures.

- [ ] **Step 2: Run the focused tests and confirm RED**

```text
node --import tsx --test scripts/vs004-controlled-pilot-preflight-command.test.ts
```

Expected RED: the handler parser and command function are absent.

- [ ] **Step 3: Implement the testable preflight handler**

Use injected reads/publication/logging for deterministic tests. Call the committed 04A function exactly once and wrap its return in `PreparedPilotExecutionEnvelope`. Do not call the planner directly from the handler.

- [ ] **Step 4: Run focused GREEN tests**

Run the same focused command and confirm all preflight tests pass, including the type-level absence of mutation services.

- [ ] **Step 5: Commit the preflight-handler checkpoint**

```text
git add apps/api/scripts/vs004-controlled-pilot-preflight-command.ts apps/api/scripts/vs004-controlled-pilot-preflight-command.test.ts
git commit -m "feat(vs004): add pilot preflight command handler"
```

## Task 7: Testable Execute Command Handler

**Files:**

- Create: `apps/api/scripts/vs004-controlled-pilot-execute-command.ts`
- Test: `apps/api/scripts/vs004-controlled-pilot-execute-command.test.ts`
- Read: `apps/api/scripts/vs004-controlled-pilot-execution.ts`
- Read: `apps/api/scripts/vs004-controlled-pilot-artifact.ts`
- Read: `apps/api/scripts/vs004-controlled-pilot-file.ts`
- Read: `apps/api/scripts/vs004-controlled-pilot-runtime-config.ts`

**Interfaces:**

- Consumes: prepared-artifact path, result path, `PreparedPilotExecutionEnvelope`, independently loaded runtime configuration, `ControlledPilotExecutionServices`, output reservation, and `executeControlledPilot()`.
- Produces:

```ts
export interface ExecuteCommandArguments {
  readonly preparedPath: string;
  readonly resultPath: string;
}

export type ExecuteCommandParseResult =
  | { readonly kind: "RUN"; readonly arguments: ExecuteCommandArguments }
  | { readonly kind: "HELP" };

export interface ExecuteCommandDependencies {
  readonly readPrepared: (path: string) => Promise<string>;
  readonly loadConfiguration: () => ControlledPilotRuntimeConfiguration;
  readonly reserveOutputs: (
    resultPath: string,
    failurePath: string,
  ) => Promise<ExecutionOutputReservation>;
  readonly buildExecutionServices: (
    configuration: ControlledPilotRuntimeConfiguration,
  ) => ControlledPilotExecutionServices;
  readonly execute: typeof executeControlledPilot;
  readonly now: () => string;
  readonly writeLine: (line: string) => void;
}

export interface ExecuteCommandResult {
  readonly exitCode: 0 | 1;
  readonly result?: PilotExecutionResult;
}

export function parseExecuteArguments(
  argv: readonly string[],
): ExecuteCommandParseResult;
export async function runExecuteCommand(
  args: ExecuteCommandArguments,
  dependencies: ExecuteCommandDependencies,
): Promise<ExecuteCommandResult>;
```

Parse only `--prepared <path>` and `--out <path>`, with one occurrence of each, or the exclusive `--help` flag. Reject `--manifest`, unknown/missing/duplicate/empty/extra arguments. `--help` prints fixed usage and exits zero without loading configuration or constructing runtime services. Read and structurally validate the versioned prepared envelope, load runtime configuration independently, derive `<resultPath>.failed.json`, and reserve both destinations before constructing or invoking 04B. Only after reservation succeeds call `buildExecutionServices(configuration)`; pass its `ControlledPilotExecutionServices` to 04B. Pass the exact inner `PreparedPilotExecution` unchanged to 04B. Do not call 04A, `buildPilotPreflightPlan()`, or any module repository.

Validate transport before reservation and let 04B perform semantic integrity/target/current-state validation. On normal 04B failure, construct a safe failure envelope from selected error fields and completed outcomes, publish it through the reserved failure sink, release unused reservation resources, and return nonzero. Never serialize a raw error or stack trace.

On successful 04B return, publish the versioned result envelope once. If that publication fails, do not rerun, compensate, call 04A, or claim pre-mutation failure. Construct failure evidence with `executionCompleted: true`, the completed `PilotExecutionResult`, publication-failure category, and completed outcomes; attempt one publication through the already reserved failure sink. Return nonzero even if failure evidence publication succeeds. If both publications fail, retain both safe facts in the console summary and return nonzero. Release any unused reservation resources after the terminal publication attempt.

The handler must accept planned CREATE results of `CREATED` or race-safe `REUSED`, while 04B itself rejects a planned REUSE that attempts to create. The handler does not reinterpret these outcomes.

- [ ] **Step 1: Write failing execute command tests**

Cover valid prepared-artifact loading, malformed/wrong-type/missing/future-version rejection before runtime composition, missing/forged plan operation rejection through transport/04B boundary before writes, independent target load, output reservation before 04B, result/failure destination refusal before 04B, exactly one 04B call, no 04A/planner/manifest loading, phase-service injection only, prepared payload unchanged, safe success result, normal failure artifact, stale failure requiring a new preflight, no retry, and no compensation.

Add explicit tests for:

1. existing result output fails before any 04B call;
2. unavailable publication fails before any 04B call;
3. existing failure destination fails before mutation when evidence cannot be reserved;
4. successful 04B followed by success-publication failure preserves completed outcomes and `executionCompleted: true` through the failure sink;
5. success-publication failure invokes neither 04B nor 04A a second time;
6. no password, token, service key, provider secret, raw error, or stack trace occurs in result/failure JSON or safe console output.

- [ ] **Step 2: Run the focused tests and confirm RED**

```text
node --import tsx --test scripts/vs004-controlled-pilot-execute-command.test.ts
```

Expected RED: the execute handler, reservation-before-execution sequence, and failure-after-success-publication branch are absent.

- [ ] **Step 3: Implement the thin execute handler**

Keep operation allowlisting, plan consistency, phase ordering, race semantics, and current-state revalidation inside committed 04B. The handler maps no new operations and does not infer dependencies. Use `try/finally`-equivalent cleanup for unused reservations without deleting final artifacts.

- [ ] **Step 4: Run focused GREEN tests**

Run the same focused command and confirm all execute tests pass, including output readiness before the first service call and completed-execution evidence on publication failure.

- [ ] **Step 5: Commit the execute-handler checkpoint**

```text
git add apps/api/scripts/vs004-controlled-pilot-execute-command.ts apps/api/scripts/vs004-controlled-pilot-execute-command.test.ts
git commit -m "feat(vs004): add pilot execute command handler"
```

## Task 8: Thin CLI Entrypoints

**Files:**

- Create: `apps/api/scripts/vs004-controlled-pilot-preflight-cli.ts`
- Create: `apps/api/scripts/vs004-controlled-pilot-execute-cli.ts`
- Create: `apps/api/tsconfig.scripts.json`
- Test through: command-handler tests and package command checks in Task 9

**Interfaces:**

- Consumes: exported command handlers, runtime configuration loader, runtime composition, Node process arguments/environment, Node file adapter, and console writer.
- Produces: two process entrypoints only; no new domain or persistence interface.

Each entrypoint must be a small `main()` adapter that obtains `process.argv.slice(2)`, delegates `--help` without loading runtime configuration, uses the runtime configuration loader and Node file adapter, and narrows `buildControlledPilotRuntime()` to the handler's capability group. The execute entrypoint must pass a `buildExecutionServices(configuration)` factory so runtime composition occurs only after the handler has reserved both output sinks. It invokes the handler once and sets `process.exitCode` to the returned `exitCode`. It must not contain business logic, table access, RPC calls, planner invocation, or a second error model. `pilot:preflight` receives only `observationSources`; `pilot:execute` receives only the deferred execution-service factory.

Add `apps/api/tsconfig.scripts.json` with `extends: "./tsconfig.json"`, `rootDir: "."`, `include` for `scripts/vs004-controlled-pilot-*.ts` plus the committed 04A/04B/preflight scripts imported by them, and the same strict compiler options as the API config. Do not alter the existing `apps/api/tsconfig.json` include/exclude behavior.

- [ ] **Step 1: Write failing entrypoint/typecheck checks**

Add handler-level assertions that entrypoint dependencies are phase-specific, add `--help` assertions that do not load runtime configuration, and run a script typecheck command that references the not-yet-created `tsconfig.scripts.json`.

- [ ] **Step 2: Run checks and confirm RED**

```text
npx tsc --noEmit -p tsconfig.scripts.json
```

Expected RED: the script typecheck project and entrypoint files do not yet exist.

- [ ] **Step 3: Implement thin entrypoints and script tsconfig**

Implement only argument delegation, runtime composition narrowing, safe top-level failure handling, and exit-code assignment. Top-level errors must use concise safe text and must not print caught objects.

- [ ] **Step 4: Run GREEN typecheck**

```text
npx tsc --noEmit -p tsconfig.scripts.json
```

Expected result: all 04C scripts and their committed imported script/module types compile under strict checking.

- [ ] **Step 5: Commit the entrypoint checkpoint**

```text
git add apps/api/scripts/vs004-controlled-pilot-preflight-cli.ts apps/api/scripts/vs004-controlled-pilot-execute-cli.ts apps/api/tsconfig.scripts.json
git commit -m "feat(vs004): add pilot operator entrypoints"
```

## Task 9: Package Command Wiring

**Files:**

- Modify: `apps/api/package.json`
- Modify: root `package.json`
- Read: `apps/api/package-lock.json` and root `package-lock.json`; scripts-only changes must not alter lockfiles.

**Interfaces:**

- Consumes: the two thin entrypoints from Task 8.
- Produces these npm commands:

```json
{
  "pilot:preflight": "node --import tsx scripts/vs004-controlled-pilot-preflight-cli.ts",
  "pilot:execute": "node --import tsx scripts/vs004-controlled-pilot-execute-cli.ts"
}
```

Add API-package scripts with those exact commands. Add root wrappers using the existing convention:

```json
{
  "pilot:preflight": "npm --prefix apps/api run pilot:preflight --",
  "pilot:execute": "npm --prefix apps/api run pilot:execute --"
}
```

Do not load a fixed `.env.local`, `.env.qa`, or `.env.beta` file in the generic commands; runtime configuration must come from the operator's explicitly selected process environment. Do not add `--force`, `--yes`, `--execute-after-preflight`, manifest input to execute, a live database command, or a package command that chains preflight into execute.

- [ ] **Step 1: Write failing package-command checks**

Add or extend a package/script test that asserts both command names are absent before wiring and that the desired API entrypoint strings are the expected command targets. Add help/argument checks using injected handler dependencies so no live target is accessed.

- [ ] **Step 2: Run the checks and confirm RED**

```text
npm --prefix apps/api run pilot:preflight -- --help
npm --prefix apps/api run pilot:execute -- --help
```

Expected RED before wiring: npm reports the scripts are not defined. The test must not reach Supabase.

- [ ] **Step 3: Add only the two package scripts**

Modify the two package manifests with the exact wrappers above. Do not modify dependencies or lockfiles.

- [ ] **Step 4: Run GREEN help/argument checks**

From the repository root:

```text
npm run pilot:preflight -- --help
npm run pilot:execute -- --help
npm run pilot:preflight -- --unknown value
npm run pilot:execute -- --manifest manifest.json --out result.json
```

Expected results: help is safe and non-mutating; invalid/manifest-to-execute arguments are nonzero; no Supabase client is constructed for parser failures.

- [ ] **Step 5: Commit package wiring**

```text
git add package.json apps/api/package.json
git commit -m "chore(vs004): wire pilot operator commands"
```

## Task 10: Full Regression, Security, and Scope Verification

**Files:**

- Modify only files required by a failing test from Tasks 1–9. Do not update governance documents, VS004 status, fixtures, migrations, schema, web code, `HANDOFF.md`, `CHANGELOG.md`, or traceability in this task.

**Interfaces:**

- Consumes: all 04C tests and the committed VS004/VS001/VS002 regression suites.
- Produces: verified implementation with no live bootstrap execution.

- [ ] **Step 1: Run all focused 04C script tests**

From `apps/api` run:

```text
node --import tsx --test scripts/vs004-controlled-pilot-artifact.test.ts scripts/vs004-controlled-pilot-file.test.ts scripts/vs004-controlled-pilot-runtime-config.test.ts scripts/vs004-controlled-pilot-observation-adapters.test.ts scripts/vs004-controlled-pilot-runtime.test.ts scripts/vs004-controlled-pilot-preflight-command.test.ts scripts/vs004-controlled-pilot-execute-command.test.ts
```

Expected result: all 04C artifact, reservation, composition, preflight, execute, and security tests pass with zero failures.

- [ ] **Step 2: Run committed VS004 script regressions**

```text
node --import tsx --test scripts/vs004-pilot-manifest.test.ts scripts/vs004-preflight.test.ts scripts/vs004-controlled-pilot-preflight.test.ts scripts/vs004-controlled-pilot-execution.test.ts
```

Expected result: manifest/hash, pure planner, 04A read barrier, and 04B executor tests pass unchanged.

- [ ] **Step 3: Run relevant module and environment regressions**

```text
npm --prefix apps/api test
```

This runs the full existing `src/**/*.test.ts` suite, including Identity 03A, Projects/Project Health 03B, Membership 04B0, role/protected-transfer, authorization, R03, environment, provider, and API regressions. If a focused rerun is needed while diagnosing a failure, use the exact existing test path under `apps/api/src` and do not alter production behavior solely to avoid a regression.

- [ ] **Step 4: Run strict typechecks**

```text
npm --prefix apps/api run typecheck
npx tsc --noEmit -p apps/api/tsconfig.scripts.json
```

Expected result: both the existing API source typecheck and explicit VS004 script typecheck pass.

- [ ] **Step 5: Run package-level safe command checks**

Run the help and invalid-argument commands from Task 9. Run preflight only with injected/fake observations in tests; do not point it at the validated local database. Confirm execute cannot be invoked without a prepared artifact and cannot accept a manifest argument.

- [ ] **Step 6: Run static authority and secret scans**

From the repository root run:

```text
rg -n "buildPilotPreflightPlan|\.rpc\(|\.insert\(|\.update\(|\.delete\(" apps/api/scripts/vs004-controlled-pilot-preflight-command.ts apps/api/scripts/vs004-controlled-pilot-preflight-cli.ts apps/api/scripts/vs004-controlled-pilot-execute-command.ts apps/api/scripts/vs004-controlled-pilot-execute-cli.ts
rg -n "SUPABASE_SECRET_KEY|CADENCE_LOCAL_DEV_PASSWORD|password|bearer|token|service.role|access_token|refresh_token" apps/api/scripts/vs004-controlled-pilot-artifact.ts apps/api/scripts/vs004-controlled-pilot-file.ts apps/api/scripts/vs004-controlled-pilot-preflight-command.ts apps/api/scripts/vs004-controlled-pilot-execute-command.ts
git diff --check
```

The first scan must find no direct planner, RPC, or table-write usage in command handlers/entrypoints. The second scan is reviewed rather than blindly treated as zero matches: runtime-only configuration names may appear only where configuration is intentionally loaded, while serialized artifact/result/failure code and console summaries must not contain secret values or raw credential-bearing objects.

- [ ] **Step 7: Review the final scope and ownership diff**

```text
git status --short
git diff --stat
git diff --name-only
git diff --check
```

Confirm the only implementation files are the planned 04C files plus the two package manifests and script tsconfig; no lockfile changed; no schema/migration/database-reset command was added; no module ownership, permission semantics, governance status, VS003 fixture, or browser code changed; and no 04C command can invoke mutation without a prepared artifact and pre-reserved output sinks.

- [ ] **Step 8: Commit the verification checkpoint**

```text
git add apps/api/scripts/vs004-controlled-pilot-artifact.ts apps/api/scripts/vs004-controlled-pilot-artifact.test.ts apps/api/scripts/vs004-controlled-pilot-file.ts apps/api/scripts/vs004-controlled-pilot-file.test.ts apps/api/scripts/vs004-controlled-pilot-runtime-config.ts apps/api/scripts/vs004-controlled-pilot-runtime-config.test.ts apps/api/scripts/vs004-controlled-pilot-observation-adapters.ts apps/api/scripts/vs004-controlled-pilot-observation-adapters.test.ts apps/api/scripts/vs004-controlled-pilot-runtime.ts apps/api/scripts/vs004-controlled-pilot-runtime.test.ts apps/api/scripts/vs004-controlled-pilot-preflight-command.ts apps/api/scripts/vs004-controlled-pilot-preflight-command.test.ts apps/api/scripts/vs004-controlled-pilot-preflight-cli.ts apps/api/scripts/vs004-controlled-pilot-execute-command.ts apps/api/scripts/vs004-controlled-pilot-execute-command.test.ts apps/api/scripts/vs004-controlled-pilot-execute-cli.ts apps/api/tsconfig.scripts.json package.json apps/api/package.json
git commit -m "test(vs004): verify controlled pilot operator runtime"
```

## Checkpoint Commit Sequence

The intended reviewable history is:

1. `feat(vs004): add operator artifact transport`
2. `feat(vs004): add atomic pilot artifact publication`
3. `feat(vs004): load controlled pilot runtime target`
4. `feat(vs004): compose read-only pilot observations`
5. `feat(vs004): compose controlled pilot runtime`
6. `feat(vs004): add pilot preflight command handler`
7. `feat(vs004): add pilot execute command handler`
8. `feat(vs004): add pilot operator entrypoints`
9. `chore(vs004): wire pilot operator commands`
10. `test(vs004): verify controlled pilot operator runtime`

Each commit must be made only after its task's RED test, minimal GREEN implementation, focused regression, and scope review. No commit in this plan may include a database reset, live bootstrap invocation, migration, governance update, or VS005/VS006 work.

## Plan Self-Review

- Every design section is covered by a task: two-command separation, thin transport envelopes, strict structural validation, output readiness before 04B, post-success publication failure, runtime configuration, module composition, safe logging, trust/security rules, package commands, and M1/VS005/VS006 boundaries.
- The current committed names are used for `PreparedPilotExecution`, `PilotExecutionResult`, `ControlledPilotExecutionError`, `preparePilotExecution()`, `executeControlledPilot()`, `ControlledPilotObservationSources`, and `ControlledPilotExecutionServices`.
- The only new cross-module read code is a method-shape mapper; it has no persistence ownership and no writes.
- Preflight receives observation-only capabilities; execute receives application preparation services only.
- Execute reserves result and failure destinations before runtime composition and before 04B.
- Unsupported envelope versions fail before 04B and are never migrated.
- Secret-bearing configuration terminates in runtime composition and never enters transport/evidence/logging.
- Package wiring is last and adds exactly two commands without chaining or live-database convenience behavior.
- The plan contains no open implementation decision.

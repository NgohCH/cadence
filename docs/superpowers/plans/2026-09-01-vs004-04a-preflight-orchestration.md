# VS004-04A Read-Only Whole-Pilot Preflight Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert a validated VS004 pilot manifest and a complete read-only snapshot of the target into an immutable `PreparedPilotExecution` without exposing or invoking any mutation capability.

**Architecture:** Keep the existing pure VS004-02 planner as the only reconciliation decision-maker. Add explicit read-only observation ports for Identity, Projects, Project Health, Project Membership, protected transfer history, and administrative Auth lookup; the script-level coordinator maps their owner-specific records into `ObservedPilotState`, invokes the planner once, and returns a frozen prepared result.

**Tech Stack:** TypeScript, Node test runner, `tsx`, existing Supabase repository/provider boundaries, existing `validateCadenceEnvironmentSafety`, and the VS004-02 manifest/preflight scripts.

**Spec:** `docs/vertical-slices/VS-004.md`

## Global Constraints

- VS004-04A is read-only: no Auth, Person, Cadence User, Project, Health, membership, role, transfer, password, event, or audit mutation.
- The flow is `READ ALL -> PLAN ALL -> PreparedPilotExecution -> STOP`.
- `ProjectAuthorisationService` remains the normal application project-authority boundary and is not used to observe bootstrap state.
- Stable Person identity, replaceable authentication identities, canonical membership/role/history state, R03 protections, and all VS001/VS002/VS003 behavior remain unchanged.
- `safeTargetMarker` is runtime/manifest target identity only; it is never read from or compared with a Project row.
- `progressPercent` is explicit manifest intent and part of all nine Project compatibility fields shared semantically with VS004-03B.
- No CLI, package write command, migration, schema change, database reset, governance status update, HANDOFF update, CHANGELOG update, or traceability update.
- A successful preflight is a snapshot, not a lock; VS004-04B must re-read and fail closed through module-owned mutation contracts.

---

### Task 1: Add module-owned read-only observation ports

**Files:**
- Create: `apps/api/src/modules/identity/pilot-observation.repository.ts`
- Create: `apps/api/src/modules/projects/pilot-observation.repository.ts`
- Create: `apps/api/src/modules/project-health/pilot-observation.repository.ts`
- Create: `apps/api/src/modules/project-membership/pilot-observation.repository.ts`
- Test: `apps/api/src/scripts/` is not used; port behavior is exercised by the coordinator tests in Task 2.

**Interfaces:**
- `IdentityPilotObservationRepository` exposes only `findPersonById`, `findCadenceUserById`, `listAuthenticationIdentities`, `findAuthenticationIdentitiesByProviderSubject`, and `findAuthenticationIdentitiesById`.
- `ProjectsPilotObservationRepository` exposes only `findProjectById` and returns the existing `PilotProjectRecord` shape, including `progressPercent`.
- `ProjectHealthPilotObservationRepository` exposes only `findCurrentProjectHealth` and returns the existing `PilotProjectHealthRecord` shape.
- `ProjectMembershipPilotObservationRepository` exposes only canonical membership reads, role-assignment reads, and protected transfer-ledger reads. Its types are existing `ProjectMembership`, `ProjectRoleAssignment`, and `ProjectRoleTransferRecord` shapes.
- The coordinator separately defines `PilotAuthAccountReader` as the read-only `findAccounts` shape of the existing administrative Auth provider.

- [ ] **Step 1: Write a compile-level boundary test fixture in the coordinator test**

Define reader fakes that implement only the read methods above. Do not pass `IdentityPilotPreparationRepository`, `PilotProjectPreparationRepository`, `PilotProjectHealthPreparationRepository`, `ProjectMembershipRepository`, `ProjectRoleManagementRepository`, or a raw Supabase client to the coordinator.

- [ ] **Step 2: Run the boundary-focused test command**

Run: `node --import tsx --test scripts/vs004-controlled-pilot-preflight.test.ts`

Expected: FAIL because the coordinator and read-only port files do not yet exist.

- [ ] **Step 3: Add the four explicit read-only module interfaces**

Keep each interface free of `create`, `insert`, `update`, `delete`, `upsert`, RPC mutation, password, or credential methods. Reuse existing module-owned record types instead of importing persistence adapters into the script.

- [ ] **Step 4: Run the boundary-focused test command again**

Run: `node --import tsx --test scripts/vs004-controlled-pilot-preflight.test.ts`

Expected: The test proceeds to the missing coordinator behavior; no write method is available through its dependency types.

### Task 2: Implement read-all observation and immutable prepared execution

**Files:**
- Create: `apps/api/scripts/vs004-controlled-pilot-preflight.ts`
- Test: `apps/api/scripts/vs004-controlled-pilot-preflight.test.ts`
- Modify: `apps/api/scripts/vs004-preflight.ts` only if needed to export the existing target validator without duplicating target rules.

**Interfaces:**

```ts
export interface ControlledPilotPreflightInput {
  readonly manifest: unknown;
  readonly runtimeTarget: PilotRuntimeTarget;
  readonly runCorrelationId?: string;
}

export interface ControlledPilotObservationSources {
  readonly auth: PilotAuthAccountReader;
  readonly identity: IdentityPilotObservationRepository;
  readonly projects: ProjectsPilotObservationRepository;
  readonly projectHealth: ProjectHealthPilotObservationRepository;
  readonly membership: ProjectMembershipPilotObservationRepository;
}

export interface PreparedPilotExecution {
  readonly manifestId: string;
  readonly manifestHash: string;
  readonly target: {
    readonly environment: PilotEnvironment;
    readonly supabaseUrl: string;
    readonly supabaseProjectRef: string | null;
    readonly safeTargetMarker: string;
    readonly projectId: string;
  };
  readonly operatorPersonId: string;
  readonly runCorrelationId: string;
  readonly validatedManifest: ValidatedPilotManifest;
  readonly preflightPlan: PilotPreflightPlan;
  readonly observedEvidence: {
    readonly observedAt: string;
    readonly userCount: number;
    readonly personCount: number;
    readonly cadenceUserCount: number;
    readonly authenticationIdentityCount: number;
    readonly authAccountCount: number;
    readonly projectCount: number;
    readonly roleAssignmentCount: number;
    readonly protectedTransferCount: number;
    readonly membershipCount: number;
  };
}

export class ControlledPilotPreflightError extends Error {
  readonly category: "INPUT" | "TARGET" | "IDENTITY_OBSERVATION" | "PROJECT_OBSERVATION" | "PROJECT_HEALTH_OBSERVATION" | "MEMBERSHIP_OBSERVATION" | "PREFLIGHT_CONFLICT";
  readonly runCorrelationId: string;
  readonly manifestId?: string;
  readonly manifestHash?: string;
}

export async function preparePilotExecution(
  input: ControlledPilotPreflightInput,
  sources: ControlledPilotObservationSources,
  planner?: PilotPreflightPlanner,
): Promise<PreparedPilotExecution>;
```

- [ ] **Step 1: Write failing tests for validation and target gates**

Cover valid input reaching observation, invalid manifest stopping before any reader call, unsafe environment stopping before readers, Supabase project-ref mismatch stopping before readers, and safe-target-marker mismatch stopping before readers. Assert errors retain the run ID when available and contain no secrets.

- [ ] **Step 2: Run the tests to verify RED**

Run: `node --import tsx --test --test-name-pattern="manifest|environment|project-ref|safeTargetMarker" scripts/vs004-controlled-pilot-preflight.test.ts`

Expected: FAIL because `preparePilotExecution` is not implemented.

- [ ] **Step 3: Implement manifest, target, run-ID, and hash binding**

Call `validatePilotManifest(input.manifest)` before readers. Generate `randomUUID()` when no run ID is supplied; never derive it from the manifest. Reuse the existing target-safety implementation before any authoritative read. Compute `computeManifestHash(validatedManifest)` and never include runtime target credentials or run evidence in the hash.

- [ ] **Step 4: Write failing tests for the read-all barrier**

Use read-only fakes and assert that all manifest users, operator Person, Project, current Project Health, canonical memberships, ordinary assignments, protected assignments, transfer ledger, Auth accounts, and authentication identity history are read before the injected planner is called. Add one failure test per observation boundary and assert the planner is not called and no prepared result is returned.

- [ ] **Step 5: Run the read-all tests to verify RED**

Run: `node --import tsx --test --test-name-pattern="observation|reader|planner|partial|failure" scripts/vs004-controlled-pilot-preflight.test.ts`

Expected: FAIL because the observation collector is not implemented.

- [ ] **Step 6: Implement complete owner-boundary observation**

Read the whole manifest before planning. Map only authoritative fields into the existing `ObservedPilotState`:

```text
Auth account -> provider/providerSubjectId/loginIdentifier/status, with the provider subject serving as the existing Auth identity key
Identity -> Person/Cadence User/authentication identity history
Projects -> id/name/description/goal/lifecycleStatus/progressPercent/ownerUserId/startDate/targetDate
Project Health -> projectId/status/reasons/source/changedBy
Membership -> canonical id/projectId/personId/period/status/grantor/createdAt
Assignments -> canonical assignment facts
Transfers -> immutable protected-role ledger facts
```

Deduplicate exact records by stable ID only for aggregation; preserve contradictory records so the pure planner can fail closed. Validate malformed source records before planner invocation. Wrap each reader failure in its category without exposing provider credentials or business secrets.

- [ ] **Step 7: Write failing tests for planner integration and prepared execution**

Inject a planner spy around the existing `buildPilotPreflightPlan` and assert it is called exactly once with the complete observed state. Assert CREATE and REUSE operations are preserved, planner conflicts become `PREFLIGHT_CONFLICT`, and the coordinator contains no role/reconciliation implementation. Assert the result binds manifest ID/hash, target identity, operator Person, run ID, validated manifest, immutable plan, observation counts, and no credential material.

- [ ] **Step 8: Run the integration tests to verify RED**

Run: `node --import tsx --test --test-name-pattern="planner|prepared|CREATE|REUSE|conflict|immutable|credential" scripts/vs004-controlled-pilot-preflight.test.ts`

Expected: FAIL until the planner integration and frozen result are implemented.

- [ ] **Step 9: Implement planner invocation and immutable result**

Invoke the existing pure planner exactly once after the complete state is collected. Do not copy project, identity, membership, role, protected-role, or safe-resume reconciliation rules into the coordinator. Deep-freeze the validated manifest, target, observation evidence, and plan before returning `PreparedPilotExecution` as `validatedManifest`, `preflightPlan`, and `observedEvidence`.

- [ ] **Step 10: Run the focused 04A suite**

Run: `node --import tsx --test scripts/vs004-controlled-pilot-preflight.test.ts`

Expected: all 04A orchestration tests pass.

### Task 3: Verify zero-mutation and repository-wide regressions

**Files:**
- No additional production files unless a failing test identifies a type-only boundary defect.

- [ ] **Step 1: Verify the coordinator dependency surface**

Confirm the coordinator accepts only `ControlledPilotObservationSources`, no preparation service, mutation repository, provider-admin write interface, or raw Supabase client. Confirm no CLI or package write command was added.

- [ ] **Step 2: Run VS004-02 and VS004-03 regressions**

Run:

```text
node --import tsx --test scripts/vs004-pilot-manifest.test.ts scripts/vs004-preflight.test.ts
node --import tsx --test src/modules/identity/pilot-preparation.service.test.ts
node --import tsx --test src/modules/projects/pilot-preparation.service.test.ts src/modules/project-health/pilot-preparation.service.test.ts
node --import tsx --test src/bootstrap/environment-safety.test.ts src/modules/project-membership/project-authorisation.test.ts
```

- [ ] **Step 3: Run typechecks and the full API suite**

Run:

```text
npm.cmd run typecheck
node node_modules/typescript/bin/tsc --ignoreConfig --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --esModuleInterop --skipLibCheck --types node scripts/vs004-pilot-manifest.ts scripts/vs004-preflight.ts scripts/vs004-controlled-pilot-preflight.ts scripts/vs004-pilot-manifest.test.ts scripts/vs004-preflight.test.ts scripts/vs004-controlled-pilot-preflight.test.ts
npm.cmd test
git diff --check
```

- [ ] **Step 4: Perform the final scope review**

Confirm no database reset or database client execution occurred; no migration, schema, governance, VS001/VS002/VS003, web, or package-command changes exist; and no mutation method is reachable from the 04A coordinator dependency types.

---

## Completion evidence

The checkpoint is complete only when focused 04A tests, VS004-02/03 regressions, relevant membership/history and environment tests, the full API suite, API and script typechecks, and `git diff --check` pass. Report the RED evidence, final observation sequence, immutable `PreparedPilotExecution` shape, planner-once boundary, zero-mutation proof, files changed, database/reset/migration status, and P0/P1 counts. Stop before commit and do not begin VS004-04B.

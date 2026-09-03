# VS004-04B Controlled Mutation Executor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute a previously prepared VS004 pilot plan through the existing Identity, Projects, Project Health, and Project Membership preparation services with strict integrity, ordering, safe-resume, and evidence guarantees.

**Architecture:** Add a thin server-side executor at the existing `apps/api/scripts` orchestration boundary. It accepts only `PreparedPilotExecution`, validates its manifest/hash/target/operation binding before mutation, orders the existing `PilotPlanOperation` union into dependency phases, and dispatches exact intents to module-owned application services. It has no planner, repository, Supabase client, RPC, HTTP, CLI, or compensation dependency.

**Tech Stack:** TypeScript, Node test runner, `tsx`, existing VS004 manifest/preflight types, existing Identity/Projects/Project Health/Project Membership preparation services.

**Spec:** `docs/vertical-slices/VS-004.md` and the VS004-04B checkpoint request.

## Global Constraints

- `PreparedPilotExecution` is the only primary execution input; raw manifests are not independently reconciled.
- Every attempted resource action must match one validated prepared operation.
- The executor must not call `buildPilotPreflightPlan()` or derive, repair, substitute, delete, rewrite, terminate, close, or transfer state.
- Phase order is Identity, Project, Project Health, Membership, ordinary roles, then protected roles.
- CREATE may accept an owning service's exact race-safe `REUSED` result; REUSE may return only `REUSED` and must fail when absent or conflicting.
- Existing module ownership, stable Person authority, protected-role first-appointment semantics, R03 history, and retained legacy-field non-authority remain unchanged.
- No CLI, package command, browser route, migration, database reset, live bootstrap, governance update, or VS004-04C work is included.

---

### Task 1: Lock the executor boundary with RED tests

**Files:**
- Create: `apps/api/scripts/vs004-controlled-pilot-execution.test.ts`

**Interfaces:**
- Consumes: `PreparedPilotExecution`, `PilotPlanOperation`, `PilotRuntimeTarget`, and the four committed preparation service method signatures.
- Produces: failing examples for the executor API and its safe error/result contracts.

- [ ] **Step 1: Write failing tests** for prepared-execution integrity, target revalidation, unknown/duplicate/malformed operations, service-only dependencies, and the absence of planner/direct-persistence seams.
- [ ] **Step 2: Run the focused executor test** with `node --import tsx --test scripts/vs004-controlled-pilot-execution.test.ts` and confirm it fails because the executor module and behavior do not exist.
- [ ] **Step 3: Keep the RED evidence** in the checkpoint report before adding production code.

### Task 2: Add immutable executor types and pre-mutation validation

**Files:**
- Create: `apps/api/scripts/vs004-controlled-pilot-execution.ts`
- Test: `apps/api/scripts/vs004-controlled-pilot-execution.test.ts`
- Modify: `apps/api/src/modules/identity/pilot-preparation.types.ts`, `apps/api/src/modules/identity/pilot-preparation.service.ts`
- Modify: `apps/api/src/modules/projects/pilot-preparation.types.ts`, `apps/api/src/modules/projects/pilot-preparation.service.ts`
- Modify: `apps/api/src/modules/project-health/pilot-preparation.types.ts`, `apps/api/src/modules/project-health/pilot-preparation.service.ts`

**Interfaces:**
- `ControlledPilotExecutionServices` exposes only `preparePilotIdentity`, `preparePilotProject`, `preparePilotHealth`, `prepareMembership`, `prepareOrdinaryRoleAssignment`, and `prepareProtectedRoleAppointment`.
- Existing Identity preparation accepts a per-resource CREATE/REUSE action map for AUTH_ACCOUNT, PERSON, CADENCE_USER, and AUTHENTICATION_IDENTITY; Projects/Project Health preparation accept an explicit CREATE/REUSE action, preserving their existing default CREATE callers while preventing a prepared REUSE from creating missing state.
- `ControlledPilotExecutionInput` contains `prepared: PreparedPilotExecution`, `runtimeTarget: PilotRuntimeTarget`, and `services`.
- `PilotExecutionOutcome` contains `resourceKey`, prepared operation kind, owning module, resource ID, actual `CREATED | REUSED`, and safe provenance.
- `PilotExecutionResult` contains manifest ID/hash, run correlation ID, target identity, timestamps, and immutable outcomes.
- `ControlledPilotExecutionError` contains category, manifest/hash/run context, failed operation, and completed outcomes without raw causes or secrets.

- [ ] **Step 1: Add tests** for hash/ID/operator/project/target/correlation checks, recomputed hash, target URL/project-ref/marker validation, operation allowlist, resource-key/manifest binding, duplicate operations, required metadata, and operation/manifest role or ID mismatches.
- [ ] **Step 2: Extend the three previously committed Identity/Projects/Project Health preparation contracts with explicit action enforcement, preserving existing default behavior and returning STALE_PLAN before any write for a missing planned REUSE resource.
- [ ] **Step 3: Implement validation** using `computeManifestHash()` and `validatePilotRuntimeTarget()`; do not invoke any service until the entire plan passes.
- [ ] **Step 4: Add exhaustive operation handling** for `CREATE_PERSON`, `CREATE_CADENCE_USER`, `CREATE_AUTH_ACCOUNT`, `CREATE_AUTH_IDENTITY`, `CREATE_PROJECT`, `CREATE_PROJECT_HEALTH`, `ADD_PROJECT_MEMBER`, `CHANGE_ORDINARY_ROLE`, `APPOINT_PROTECTED_ROLE`, and `REUSE`.
- [ ] **Step 5: Run focused tests** and confirm all validation tests pass with zero service calls.

### Task 3: Implement fixed phase ordering and module mappings

**Files:**
- Modify: `apps/api/scripts/vs004-controlled-pilot-execution.ts`
- Test: `apps/api/scripts/vs004-controlled-pilot-execution.test.ts`

**Interfaces:**
- `executeControlledPilot(input, now?)` returns `Promise<PilotExecutionResult>`.
- Identity operations map to one exact `PilotIdentityPreparationIntent` per manifest user; the committed Identity service owns the provider call, but AUTH_ACCOUNT itself is independently authorized by the prepared operation and action map.
- Project operations map to `PilotProjectPreparationIntent` without marker, health, role, or membership data.
- Health operations map to `PilotProjectHealthPreparationIntent` without Project persistence access.
- Membership/ordinary/protected operations map to their exact `PilotMembershipPreparationRequest`, `PilotOrdinaryRolePreparationRequest`, and `PilotProtectedRolePreparationRequest`.

- [ ] **Step 1: Add RED tests** proving all Identity calls precede Project, Project precedes Health, Health precedes Membership, Membership precedes ordinary roles, and ordinary roles precede protected roles regardless of plan-array order.
- [ ] **Step 2: Add RED tests** proving exact manifest intent mapping, including unchanged `expectedPredecessor`, protected APPOINT-only dispatch, and no planner invocation.
- [ ] **Step 3: Implement phase grouping and dispatch** without generating operations or independently reconciling state.
- [ ] **Step 4: Map each owning-service result** back to its prepared operation—including one AUTH_ACCOUNT outcome per user; accept CREATE→REUSED, require REUSE→REUSED, and reject any unsupported result or missing resource evidence.
- [ ] **Step 5: Run focused tests** and verify order and mappings.

### Task 4: Implement stop-on-failure, race, and immutable evidence behavior

**Files:**
- Modify: `apps/api/scripts/vs004-controlled-pilot-execution.ts`
- Test: `apps/api/scripts/vs004-controlled-pilot-execution.test.ts`

**Interfaces:**
- Execution stops at the first categorized service failure.
- Failure evidence retains completed outcomes and failed resource context.
- No dependency exposes delete, update, termination, transfer, raw database, or provider methods to the executor.

- [ ] **Step 1: Add RED tests** for CREATE race reuse, REUSE stale-plan failure, first-failure stop, preserved prior outcomes, no compensation, credential-free result/error, and deep immutability.
- [ ] **Step 2: Implement safe failure translation** that omits raw persistence/provider errors and never retries internally or invokes a new preflight.
- [ ] **Step 3: Freeze successful results and nested evidence** consistently with 04A.
- [ ] **Step 4: Run the full focused executor suite** and confirm green.

### Task 5: Regression and scope verification

**Files:**
- No additional production files.

- [ ] **Step 1: Run focused 04B, 04A, VS004-02, 03A, 03B, and 04B0 tests.**
- [ ] **Step 2: Run membership, ordinary/protected-role, authorization, and R03 regressions.**
- [ ] **Step 3: Run the full API suite, API typecheck, explicit production VS004 script typecheck, and `git diff --check`.**
- [ ] **Step 4: Confirm no CLI/package command, HTTP route, migration, database access, governance edit, or 04C work was added.**
- [ ] **Step 5: Stop before staging or committing.**

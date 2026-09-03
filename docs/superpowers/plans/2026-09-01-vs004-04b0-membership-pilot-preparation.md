# VS004-04B0 Project Membership Pilot Preparation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Project Membership-owned, server-side preparation contract that executes only prepared membership, ordinary-role, and first protected-role actions with exact reuse and fail-closed conflict semantics.

**Architecture:** Keep normal `ProjectMembershipService` authorization unchanged. Add a separate application service inside the Project Membership module that accepts an explicit prepared action and exact canonical intent, reads current canonical state through module-owned ports, and invokes existing service-role persistence boundaries only when the action remains authorized. The service never receives Projects, Identity, Project Health, `ProjectAuthorisationService`, raw Supabase clients, or a manifest.

**Tech Stack:** TypeScript, Node test runner, `tsx`, existing Project Membership repositories and service-role RPC adapters, canonical membership/role/transfer models, and the existing R03 append-only database invariants.

**Spec:** `docs/vertical-slices/VS-004.md`, especially sections 6, 10, 11, 13–16, and 20.

## Global Constraints

- VS004-04B0 is a Membership-module prerequisite only; do not implement the cross-module executor, CLI, package command, or live pilot operation.
- Normal runtime authorization remains exclusively in `ProjectAuthorisationService`; do not modify `ProjectMembershipService` or add a skip-authorization flag.
- The service accepts only explicit prepared actions: `CREATE`, `REUSE`, and protected first-appointment `APPOINT`.
- `CREATE` may safely return `REUSED` when exact state appeared between preflight and execution; `REUSE` must return `STALE_PLAN` when state is absent or conflicting.
- Protected bootstrap never transfers a role. A protected `APPOINT` is valid only with no effective holder and no contradictory history; an exact existing holder/history is `REUSED`.
- Use canonical `person_id`, `project_id`, effective periods, canonical membership status, grantor/assigner Person provenance, reason, and correlation. Never use retained `user_id`, `role_id`, `joined_at`, legacy `status`, or `created_by` for compatibility decisions.
- Existing admission and role RPC adapters remain the persistence boundary; no direct SQL, raw Supabase client, migration, schema change, reset, or database mutation is allowed in this checkpoint.
- Preserve immutable membership/role/transfer history and existing domain-event behavior. Do not add artificial history or compensating deletes/updates.
- Do not modify VS004 contract, VS001–VS003, HANDOFF, CHANGELOG, requirement traceability, web code, or package scripts.

---

### Task 1: Define the Membership-owned preparation contract and read ports

**Files:**
- Create: `apps/api/src/modules/project-membership/pilot-preparation.types.ts`
- Create: `apps/api/src/modules/project-membership/pilot-preparation.service.ts`
- Create: `apps/api/src/modules/project-membership/pilot-preparation.service.test.ts`
- Create: `apps/api/src/modules/project-membership/project-role-transfer-read.repository.ts`
- Create: `apps/api/src/modules/project-membership/project-role-assignment-read.repository.ts`
- Test: `apps/api/src/modules/project-membership/pilot-preparation.service.test.ts`

**Interfaces:**

```ts
export type PilotPreparedAction = "CREATE" | "REUSE";
export type PilotProtectedPreparedAction = "APPOINT" | "REUSE";
export type PilotPreparationResult = "CREATED" | "REUSED";

export interface PilotMembershipPreparationIntent {
  resourceKey: string;
  membershipId: string;
  projectId: string;
  personId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: "ACTIVE";
  grantedByPersonId: string;
  initialRoleAssignmentId: string;
}

export interface PilotOrdinaryRolePreparationIntent {
  resourceKey: string;
  assignmentId: string;
  projectId: string;
  membershipId: string;
  role: "PROJECT_MEMBER" | "PROJECT_OBSERVER" | "PROJECT_AUDITOR";
  effectiveFrom: string;
  effectiveTo: string | null;
  assignedByPersonId: string;
  changeReason: string | null;
}

export interface PilotProtectedRolePreparationIntent {
  resourceKey: string;
  assignmentId: string;
  transferId: string;
  projectId: string;
  membershipId: string;
  role: "PROJECT_OWNER" | "PROJECT_MANAGER" | "PROJECT_SPONSOR";
  effectiveAt: string;
  effectiveTo: string | null;
  authorisedByPersonId: string;
  reason: string;
}

export interface PilotPreparationContext {
  operatorPersonId: string;
  runCorrelationId: string;
}

export interface PilotPreparationOutcome {
  resourceKey: string;
  plannedAction: "CREATE" | "REUSE" | "APPOINT";
  actualResult: "CREATED" | "REUSED";
  resourceId: string;
  projectId: string;
  operatorPersonId: string;
  runCorrelationId: string;
}

export interface ProjectMembershipPilotPreparationService {
  prepareMembership(
    request: PilotMembershipPreparationRequest,
  ): Promise<PilotPreparationOutcome>;

  prepareOrdinaryRoleAssignment(
    request: PilotOrdinaryRolePreparationRequest,
  ): Promise<PilotPreparationOutcome>;

  prepareProtectedRoleAppointment(
    request: PilotProtectedRolePreparationRequest,
  ): Promise<PilotPreparationOutcome>;
}
```

The service composes existing `ProjectMembershipRepository`, `ProjectMemberAdmissionRepository`, and `ProjectRoleManagementRepository` write ports only inside this explicit preparation capability. Add separate read-only `ProjectRoleTransferReadRepository` and `ProjectRoleAssignmentReadRepository` ports. The assignment port provides project-wide role observations so protected holders on other memberships cannot be hidden; neither read port has a mutation method. The implementation uses request-object signatures so the prepared action, intent, and provenance remain bound together.

Ordinary Observer/Auditor preparation carries an optional exact
`expectedPredecessor` assignment. When the final assignment is absent, a
non-Member replacement must declare that predecessor; the existing atomic role
operation must return the same predecessor closed at the final assignment's
effective time. A declared predecessor is the manifest's initial
`initialRoleAssignmentId` for a newly admitted pilot member, or the exact
canonical predecessor observed by preflight.

- [ ] **Step 1: Write failing service tests for prepared action validation and Membership CREATE/REUSE**

Add real service tests proving blank context, unsupported action, mismatched IDs, invalid periods, and invalid canonical status fail before repository writes. Add tests for planned `CREATE` with absent membership returning `CREATED`, exact state returning `REUSED`, incompatible/overlapping canonical membership returning conflict, planned `REUSE` exact returning `REUSED`, planned `REUSE` absent returning `STALE_PLAN`, and planned `REUSE` conflict returning `STALE_PLAN` without admission calls. Assert results contain operator/correlation and no legacy fields or secrets.

- [ ] **Step 2: Run the Membership-focused tests and verify RED**

Run: `node --import tsx --test src/modules/project-membership/pilot-preparation.service.test.ts`

Expected: FAIL because the preparation types/service and transfer read port do not exist.

- [ ] **Step 3: Implement the minimum Membership preparation behavior**

Read `findMembershipById` and `listMembershipsForPersonInProject` before mutation. Compare only canonical ID, project, Person, effective period, `ACTIVE` status, and `grantedBy`. Reject overlapping active canonical periods. For `CREATE` + exact, return `REUSED`; for `REUSE` + absent/conflict, return `STALE_PLAN`. For absent `CREATE`, call the existing `ProjectMemberAdmissionRepository` with exact prepared membership and initial `PROJECT_MEMBER` assignment values, then verify the returned membership and initial assignment postconditions. Never populate or compare retained fields.

- [ ] **Step 4: Run the Membership tests and verify GREEN**

Run: `node --import tsx --test src/modules/project-membership/pilot-preparation.service.test.ts`

Expected: Membership CREATE/REUSE, conflict, provenance, and no-legacy-authority tests pass.

### Task 2: Add ordinary-role preparation with admission-aware reuse

**Files:**
- Modify: `apps/api/src/modules/project-membership/pilot-preparation.service.ts`
- Modify: `apps/api/src/modules/project-membership/pilot-preparation.service.test.ts`
- Modify: `apps/api/scripts/vs004-preflight.ts`
- Modify: `apps/api/scripts/vs004-preflight.test.ts`

**Interfaces:**

`prepareOrdinaryRoleAssignment(action, intent, context)` reads `listRoleAssignments(intent.membershipId)` and compares assignment ID, project, membership, ordinary role, effective period, assigner, and reason. It may invoke the existing `ProjectRoleManagementRepository.changeOrdinaryRole` only for a prepared `CREATE` when no exact assignment exists and the canonical membership is effective. A prepared `PROJECT_MEMBER` assignment already created atomically by admission must return `REUSED`, not be written again.

- [ ] **Step 1: Write failing ordinary-role tests**

Cover absent `CREATE` -> `CREATED`, exact admission-created assignment -> `REUSED`, conflicting and overlapping ordinary assignments -> conflict, exact `REUSE` -> `REUSED`, missing/conflicting `REUSE` -> `STALE_PLAN`, and no-write behavior for all `REUSE` outcomes. Assert assignedBy, reason, and effective period are passed/verified as canonical provenance.

- [ ] **Step 2: Run ordinary-role tests and verify RED**

Run: `node --import tsx --test --test-name-pattern="ordinary role" src/modules/project-membership/pilot-preparation.service.test.ts`

Expected: FAIL because ordinary-role preparation is not implemented.

- [ ] **Step 3: Implement ordinary-role preparation**

Reject protected roles in this method. Verify the membership belongs to the intended project and is effective for the prepared period. Return `REUSED` for an exact assignment. For `CREATE` + absent assignment, invoke the existing ordinary-role persistence boundary with the exact prepared assignment identity and provenance, reject an unexpected closed-history outcome that would imply reconciliation, and verify the returned assignment exactly. Never interpret the role as a permission.

- [ ] **Step 4: Run ordinary-role tests and verify GREEN**

Run: `node --import tsx --test --test-name-pattern="ordinary role" src/modules/project-membership/pilot-preparation.service.test.ts`

Expected: all ordinary-role tests pass.

### Task 3: Add protected first-appointment preparation and strict transfer guard

**Files:**
- Modify: `apps/api/src/modules/project-membership/pilot-preparation.service.ts`
- Modify: `apps/api/src/modules/project-membership/pilot-preparation.service.test.ts`
- Create: `apps/api/src/infrastructure/database/supabase-project-membership-pilot-preparation.repository.ts`
- Create: `apps/api/src/infrastructure/database/supabase-project-membership-pilot-preparation.repository.test.ts`

**Interfaces:**

`prepareProtectedRoleAppointment(action, intent, context)` uses the existing membership read plus the project-wide `ProjectRoleAssignmentReadRepository` and immutable `ProjectRoleTransferReadRepository`. It accepts only protected roles and `APPOINT` or `REUSE`; it never accepts a transfer action.

- [ ] **Step 1: Write failing protected-role tests**

Cover `APPOINT` + effective membership/no holder/no history -> appointment `CREATED`; exact holder and matching immutable ledger -> `REUSED`; different holder, multiple effective holders, missing/mismatched ledger, inactive membership, and contradictory history -> conflict; `REUSE` exact -> `REUSED`; `REUSE` absent/conflict -> `STALE_PLAN`; `REUSE` never writes; and a persistence result containing an unexpected outgoing assignment fails without accepting a transfer. Assert no outgoing assignment is supplied to the persistence input and no transfer-repair operation is available.

- [ ] **Step 2: Run protected-role tests and verify RED**

Run: `node --import tsx --test --test-name-pattern="protected|appointment|transfer" src/modules/project-membership/pilot-preparation.service.test.ts`

Expected: FAIL because protected preparation and the transfer read adapter are absent.

- [ ] **Step 3: Implement protected first-appointment behavior**

Read canonical assignments and immutable transfer records before mutation. For `APPOINT`, require no effective holder, no protected assignment/history contradiction, an effective intended membership, and exact prepared provenance. Call the existing role-management persistence boundary with the exact assignment/transfer IDs, operator, reason, effective time, and correlation; verify `outgoingAssignment === null` and exact postconditions. For exact existing state, verify the incoming assignment and one matching ledger entry and return `REUSED`. Never invoke a separate transfer or pass an outgoing holder.

- [ ] **Step 4: Implement the read-only assignment/transfer adapter**

Add a Supabase adapter that selects only protected transfer-ledger columns from `project_role_transfers`, filters by project and protected roles, orders deterministically, maps to `ProjectRoleTransferRecord`, and exposes no insert/update/delete/RPC method. Add adapter tests using the repository’s existing Supabase query fake pattern. Do not query or write Projects, Identity, Health, or legacy membership fields.

- [ ] **Step 5: Run protected-role tests and verify GREEN**

The adapter in this task owns both project-wide role-assignment observation and
protected transfer-ledger observation; it remains read-only and has no RPC or
table mutation methods.

Run: `node --import tsx --test --test-name-pattern="protected|appointment|transfer" src/modules/project-membership/pilot-preparation.service.test.ts src/infrastructure/database/supabase-project-membership-pilot-preparation.repository.test.ts`

Expected: first-appointment, exact reuse, conflict, no-transfer, and read-only adapter tests pass.

### Task 4: Failure, evidence, architecture, and regression verification

**Files:**
- Modify: `apps/api/src/modules/project-membership/pilot-preparation.service.test.ts`
- Modify: `apps/api/src/modules/project-membership/README.md` only if a concise new application-boundary paragraph is required; do not change existing ownership statements.

- [ ] **Step 1: Add failure/evidence and architectural tests**

Cover repository read failure, admission failure, ordinary-role failure, protected-role failure, postcondition mismatch, stop-before-later-operation behavior, no compensation/delete/update/termination/history rewrite, exact operator/correlation evidence, credential-free results/errors, and no dependency on Projects, Identity, Project Health, or `ProjectAuthorisationService`. Prove the service’s input and repository dependencies do not expose a raw Supabase client or other-module persistence.

- [ ] **Step 2: Run the complete focused 04B0 suite**

Run: `node --import tsx --test src/modules/project-membership/pilot-preparation.service.test.ts src/infrastructure/database/supabase-project-membership-pilot-preparation.repository.test.ts`

Expected: all focused 04B0 tests pass.

- [ ] **Step 3: Run Membership and VS004 regressions**

Run:

```text
node --import tsx --test src/modules/project-membership/project-membership.service.test.ts src/modules/project-membership/project-authorisation.test.ts src/modules/project-membership/project-membership.events.test.ts
node --import tsx --test scripts/vs004-pilot-manifest.test.ts scripts/vs004-preflight.test.ts scripts/vs004-controlled-pilot-preflight.test.ts
node --import tsx --test src/modules/identity/pilot-preparation.service.test.ts src/modules/projects/pilot-preparation.service.test.ts src/modules/project-health/pilot-preparation.service.test.ts
```

- [ ] **Step 4: Run full API suite and typechecks**

Run:

```text
npm.cmd test
npm.cmd run typecheck
node node_modules/typescript/bin/tsc --ignoreConfig --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --esModuleInterop --skipLibCheck --types node scripts/vs004-pilot-manifest.ts scripts/vs004-preflight.ts scripts/vs004-controlled-pilot-preflight.ts
git diff --check
```

- [ ] **Step 5: Perform final scope review**

Confirm no cross-module executor, CLI, package command, manifest/preflight change, HTTP route, web change, migration, schema change, reset, live database call, legacy-authority path, or ProjectAuthorisationService change exists. Confirm normal Project Membership authorization tests remain green and protected bootstrap exposes appointment only, never transfer reconciliation.

## Completion evidence

The checkpoint is complete only when the Membership-owned service has exact CREATE/REUSE and APPOINT/REUSE semantics, canonical provenance, safe errors/evidence, first-appointment-only protected behavior, no destructive reconciliation, and all focused, regression, full API, typecheck, and diff checks pass. Stop before implementing the cross-module VS004-04B executor or VS004-04C CLI.

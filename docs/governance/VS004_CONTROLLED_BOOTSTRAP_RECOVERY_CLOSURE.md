# VS004 Controlled Beta Bootstrap Recovery Closure

Status: VERIFIED / CLOSED
Date: 2026-09-07
Scope: VS004 controlled Beta bootstrap recovery under VS005
Target: `beta` / `cadence-beta` / `pwmhasbmacmeerbsagda`

This record closes the controlled Beta bootstrap recovery evidence. It does
not close the VS005 vertical slice, complete the M1 rehearsal, authorize Task
15, or authorize Pilot Activation.

## Governance basis

The approved recovery decision is recorded in
`VS004_CONTROLLED_BOOTSTRAP_RECOVERY_DECISION.md`. The governing principles
remain:

- `ProjectAuthorisationService` remains the normal project-authority boundary.
- PostgreSQL/R03 temporal and role-history invariants remain authoritative.
- Membership admission creates the canonical initial `PROJECT_MEMBER` role.
- No database schema, migration, reset, repair, reversal, compensation, or
  historical rewrite is required or authorized by this closure.

## Original recovery problem

Controlled Beta bootstrap attempts `-a`, `-b`, and `-c` exposed three separate
VS004 defects:

1. Identity postcondition verification compared equivalent timestamp
   serializations as raw strings.
2. Membership and admission-created initial-role postcondition verification
   compared equivalent timestamp serializations as raw strings.
3. The controlled Observer transition requested its successor at the same
   instant as the admission-created `PROJECT_MEMBER` predecessor. Canonical
   role-transition semantics require the successor to begin strictly after
   the predecessor start, so the same-instant request was invalid.

An independent protected-role timestamp compatibility defect was also found:
protected assignment validity and transfer `effectiveAt` comparisons used
raw timestamp-string equality. This was a compatibility defect, not a change
to protected-role or transfer-ledger domain semantics.

None of these findings was a database or R03 defect. The canonical invariants
were preserved.

## Approved corrections

The production correction is committed at `635a67f`:
`fix(vs004): reconcile bootstrap role timing`.

The verified correction implemented:

- admission-created `PROJECT_MEMBER` remains at time `T`;
- a different controlled-bootstrap ordinary role begins deterministically at
  exactly `T + 1 ms`;
- `successor effectiveAt <= predecessor effectiveFrom` fails closed before
  hosted execution;
- timestamp comparisons whose contract is “same instant” use fail-closed
  instant-equivalence semantics rather than raw serialization equality;
- protected-role assignment and transfer timestamp compatibility uses instant
  semantics without changing protected-role authority, first-holder rules, or
  transfer-ledger semantics;
- no migration, reset, repair, reversal, compensation, or history rewrite was
  required.

## Recovery manifest and preflight evidence

Recovery manifest:
`.cadence/preflight/vs005-beta-pilot-recovery-manifest-20260906.json`

- Manifest ID: `vs005-beta-controlled-pilot-recovery-20260906`
- Raw SHA-256:
  `d6ec1d8d1db68db0a1970d6e1beedd352364814f24be3e4be62fce7b004b4f82`
- Canonical manifest hash:
  `4672acee6aead00562f685a1713154374ce683e0f306096e968c8313ba1d4d3e`
- Original canonical manifest hash:
  `c7d2039d4bb4f8a330415b402d044e174ac553b50b378aced56cb2dd19dd7c3d`

The recovery manifest preserved the governed identities, project, membership,
role, protected-role, target, and provenance IDs. Its Observer successor time
is derived by the controlled-bootstrap contract from the membership start,
not stored as an unrelated direct timestamp intent. The derived value is
exactly `2026-09-05T00:00:00.001Z`.

Prepared recovery artifact:
`.cadence/preflight/vs005-beta-pilot-recovery-prepared-20260907-a.json`

- Correlation ID: `e2a4285c-a8c6-473a-9156-54249aa7c8ba`
- Raw SHA-256:
  `74fe6aff0472695dfda592e0f56dc7b0b3e6a226c5c07c1e80b0e231ee88241f`
- Observed state before recovery: users 5, persons 6, Cadence Users 5,
  authentication identities 5, Auth accounts 5, projects 1, memberships 5,
  role assignments 5, protected transfers 0.
- Prepared plan: 32 total operations, 28 `REUSE`, 4 mutations.

The earlier expectation of 31 / 27 / 4 was reconciled as an
`EXPECTATION_ERROR`: the legitimate additional reuse was the existing
Member `PROJECT_MEMBER` assignment. No planner defect resulted.

## Authorized recovery mutations

Exactly four mutations were executed:

| Mutation | Governed identity |
|---|---|
| Observer ordinary-role transition to `PROJECT_OBSERVER` at `2026-09-05T00:00:00.001Z`; predecessor `81a5c33d-985a-4a22-88da-1d0ffa34abda`, successor `91d3aea2-400b-4c9d-b3a5-0994f400ae8a` | Observer |
| First protected appointment, assignment `8246cc8e-0b0b-4045-a614-0c6f50269384` | `PROJECT_OWNER` |
| First protected appointment, assignment `2e748c8a-672e-4273-820a-1e2db0941b33` | `PROJECT_MANAGER` |
| First protected appointment, assignment `2798b74f-3fa9-4da2-8b50-66beeb5fab9e` | `PROJECT_SPONSOR` |

There was no fifth mutation.

## Execution result

Result artifact:
`.cadence/preflight/vs005-beta-pilot-recovery-result-20260907-a.json`

- Raw SHA-256:
  `0a981adf769aec4eb44dfed48dc1de23471e0ad85516cfa63f4846623e4a0c08`
- Manifest ID: `vs005-beta-controlled-pilot-recovery-20260906`
- Correlation ID: `e2a4285c-a8c6-473a-9156-54249aa7c8ba`
- Execution: `EXECUTION COMPLETED`
- Outcomes: 32 total, 28 `REUSED`, 4 successful mutations, 0 failed.

No reset, migration, repair, reversal, compensation, or unrelated resource
mutation was performed.

## Independent post-execution reconciliation

The final independent read-only live reconciliation reported:

```text
TARGET_SAFETY=PASS
IDENTITY_BUNDLES=5
PROJECT=PASS
PROJECT_HEALTH=PASS
MEMBERSHIPS=5
UNEXPECTED_MEMBERSHIPS=0
UNEXPECTED_ROLE_ASSIGNMENTS=0
ORDINARY_ROLE_OVERLAP=0
OBSERVER_PREDECESSOR=PASS
OBSERVER_PREDECESSOR_CLOSED_AT=2026-09-05T00:00:00.001Z
OBSERVER_SUCCESSOR=PASS
OBSERVER_SUCCESSOR_EFFECTIVE_FROM=2026-09-05T00:00:00.001Z
PROTECTED_ASSIGNMENT_COUNT=3
OWNER_PROTECTED_ROLE=PASS
MANAGER_PROTECTED_ROLE=PASS
SPONSOR_PROTECTED_ROLE=PASS
PROTECTED_TRANSFER_COUNT=3
PROTECTED_TRANSFER_LEDGER=PASS
UNEXPECTED_PROTECTED_TRANSFERS=0
UNRELATED_QA_PROJECT_OBSERVATION=PASS
UNRELATED_QA_PROJECT_NOT_TARGETED_BY_RESULT=PASS
FINAL_RECONCILIATION=PASS
```

## QA project evidence limitation

The unrelated `VS002-07E QA Runtime Project` was observed with its expected
identity/name and was not a mutation target in the recovery result. However,
there was no complete historical byte/row-level baseline. Therefore:

```text
UNRELATED_QA_PROJECT_UNCHANGED=NOT_PROVEN
Reason=NO_BYTE_LEVEL_QA_BASELINE
```

This limitation does not invalidate the controlled Beta recovery. It prevents
only an unsupported claim of complete historical equality for the unrelated
project.

## Diagnostic-only issues

The temporary ignored reconciliation diagnostic exposed and corrected two
diagnostic-contract issues during verification:

- an opaque `TARGET_SAFETY` failure was instrumented into individual checks;
  all target checks subsequently passed;
- direct repository authentication identities use uppercase `ACTIVE` /
  `DISABLED`, while the diagnostic initially expected lowercase `active` and
  imposed stricter active-cardinality semantics than governed preflight.

This was classified as `DIAGNOSTIC_CONTRACT_ERROR`, not a Beta identity
defect. Owner evidence showed one exact identity, one governed match, status
`ACTIVE`, and one exact Auth account. The diagnostic was corrected and the
final reconciliation passed. The diagnostic remains evidence tooling only at:
`.cadence/diagnostics/vs005-post-recovery-reconciliation.ts`; it is ignored
and is not promoted into production behavior.

## Historical evidence preservation

The following remain immutable evidence and were not rewritten, deleted,
renamed, or reused as new execution artifacts:

- original manifest;
- attempt `-a` prepared and failed-result artifacts;
- attempt `-b` prepared and failed-result artifacts;
- attempt `-c` prepared and failed-result artifacts;
- recovery manifest;
- recovery prepared artifact;
- recovery result artifact.

## Closure verdict

**VS004 CONTROLLED BETA BOOTSTRAP RECOVERY: VERIFIED / CLOSED**

Basis:

- approved contract correction implemented and locally regression-verified;
- fresh governed recovery manifest prepared;
- fresh live read-only preflight reviewed;
- exactly four governed mutations executed;
- execution completed with 32 outcomes, 28 reuse, 4 mutations, and 0 failure;
- independent post-execution live reconciliation passed;
- no unexpected memberships, role assignments, protected transfers, or
  ordinary-role overlap were observed;
- the QA-project historical-baseline limitation is explicit.

This verdict does not mean VS005 Task 15 completed, the M1 rehearsal
completed, or Pilot Activation was approved.

## Task 15 boundary

Task 15 has **not started**. It still requires separate explicit
authorization for hosted Cloudflare/Beta mutation activities. This closure
does not authorize Cloudflare deployment, Cron changes, controlled
suspension/restoration, drift/restoration mutation, second-version deployment,
rollback, clean-room hosted reconstruction, or Pilot Activation.

## Baseline Closure Reconciliation

Baseline status transitions:

Original commitments removed: 0
Original commitments moved beyond M3: 0
Unmapped implementation changes: 0

VS002/R03 invariants weakened: No
Database migration required: No
Database reset required: No
Historical evidence rewritten: No
Task 15 started: No
Pilot Activation authorized: No

Frozen VS005 source-record hashes remain:

- Design Markdown:
  `5b39d77044f3264a4181642b7e3081ee7eedcdc63ffd7f3c0e65d26dc91ff2a8`
- Implementation plan:
  `f1fb71197756ddc45606b062068c53703cffdf6f2dad69c00120178aa27949e1`

# VS004 Controlled Bootstrap Recovery Decision

Status: Approved governance decision for local implementation planning
Date: 2026-09-06
Scope: Cadence VS005 controlled Beta bootstrap recovery

## Decision

The VS004 controlled bootstrap preserves the canonical membership-admission
contract: admission creates the initial `PROJECT_MEMBER` assignment.

When controlled bootstrap intent requires a different ordinary role, the
successor assignment begins at a deterministic instant exactly 1 millisecond
after the admission-created predecessor begins:

```text
T       PROJECT_MEMBER
T+1 ms  intended successor ordinary role
```

Same-instant ordinary-role transitions are invalid. VS004 must fail closed
before hosted execution when:

```text
successor effectiveAt <= predecessor effectiveFrom
```

This decision does not alter VS002 membership semantics, R03 temporal
invariants, database constraints, or normal runtime role-transition
semantics. The existing database/domain rules remain authoritative and are
not weakened.

No database migration is required. No reset, repair, reversal, compensation,
or rewriting of existing Beta history is authorized.

## Evidence and current Beta state

The controlled Project is
`3503f8c7-1996-44d1-8b63-1fca36db89f8`.

The controlled Beta state currently contains:

- the Project and Project Health;
- all five controlled identity bundles;
- all five active memberships, beginning at `2026-09-05T00:00:00Z`;
- each admission-created initial `PROJECT_MEMBER` assignment;
- no protected-role assignments or transfer-ledger entries;
- no Observer `PROJECT_OBSERVER` successor assignment.

The failed Observer transition attempted to start at the same instant as its
admission-created predecessor. The canonical transition function rejects
that equality because closing the predecessor at `T` would create a
zero-duration `[T,T)` assignment.

## Separate protected-role compatibility defect

Protected-role first appointments remain domain-valid at membership start and
the protected transfer-ledger contract is unchanged.

Independently, VS004 protected-role execution and preflight compatibility
currently contain raw-string timestamp comparisons for assignment
`effectiveFrom`, assignment `effectiveTo`, and transfer `effectiveAt`.
Supabase may serialize the same instant as either
`2026-09-05T00:00:00.000Z` or `2026-09-05T00:00:00+00:00`. Before another
hosted bootstrap execution, these compatibility checks must use the existing
shared fail-closed instant-equivalence semantics. This is a code compatibility
correction only; it does not change protected-role domain semantics or the
transfer-ledger contract.

## Recovery and implementation boundary

Recovery will use a new governed recovery manifest and prepared artifact
after local implementation and verification. The recovery intent must
preserve the historical admission at `T` and place the Observer successor at
`T+1 ms`.

The next local implementation batch is recorded but not authorized for
execution by this document:

1. Add deterministic `+1 ms` successor timing and fail-fast validation for
   `successor <= predecessor start`, with focused TDD coverage.
2. Reconcile protected-role execution and preflight timestamp compatibility
   using instant equivalence, retaining fail-closed invalid-timestamp
   behavior.
3. Run the focused Project Membership, VS004 preflight, controlled-pilot,
   full API, typecheck, and `git diff --check` verification gates.
4. Create a new recovery manifest/artifact, run a fresh read-only Beta
   preflight, and review it before any further execution authorization.

No implementation, preflight, execution, Supabase mutation, Cloudflare
mutation, Task 15, or Pilot Activation is authorized by this record.

## Historical evidence preservation

The prepared and failed-result artifacts from attempts `-a`, `-b`, and `-c`
remain immutable historical evidence. They must not be overwritten, deleted,
executed, or rewritten.

## Governance reconciliation

- Original commitments removed: 0
- Original commitments moved beyond M3: 0
- Database migration authorized: No
- Database reset/repair/reversal authorized: No
- Existing Beta history rewrite or compensation authorized: No
- Pilot Activation authorized: No
- Task 15 started: No
- Remote mutation performed by this documentation checkpoint: No

Frozen VS005 source-record provenance remains unchanged:

- Design Markdown SHA-256:
  `5b39d77044f3264a4181642b7e3081ee7eedcdc63ffd7f3c0e65d26dc91ff2a8`
- Implementation plan SHA-256:
  `f1fb71197756ddc45606b062068c53703cffdf6f2dad69c00120178aa27949e1`

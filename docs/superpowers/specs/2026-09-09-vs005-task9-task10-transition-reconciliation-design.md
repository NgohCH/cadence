# VS005 Task 9 / Task 10 Transition Reconciliation Design

**Status:** Approved transition reconciliation for design review

**Date:** 2026-09-09

**Branch:** `feature/vs-005-portable-deployment-runtime`

**Applies to:** The transition between Tasks 9 and 10 of the approved VS005
structured Cloudflare read-only inspection implementation plan.

## 1. Purpose and authority

This document records the human-approved reconciliation of an execution-found
sequencing defect between Task 9 and Task 10. It does not redesign the approved
provider architecture. It clarifies how that architecture is introduced in two
independently reviewable implementation checkpoints without weakening an
authority boundary.

The approved source records remain authoritative and unchanged:

- `docs/superpowers/specs/2026-09-08-vs005-cloudflare-structured-readonly-inspection-design.md`
- `docs/superpowers/plans/2026-09-08-vs005-cloudflare-structured-readonly-inspection.md`

This reconciliation authorizes no implementation task, host inspection,
provider mutation, database action, clean-room work, or Pilot Activation.

## 2. Execution-discovered sequencing defect

The original Task 9 sequence attempted to make shared correlated deployment
contracts mandatory before all consumers of those shared contracts were
scheduled for migration.

The concrete conflict is:

1. Making `providerCorrelation` and structured observations mandatory on the
   shared `Vs005DeploymentResult` immediately requires production changes in
   `apps/api/scripts/vs005-rollback.ts`.
2. Changing the shared `Vs005DeploymentProvider.inspect` signature to require
   `CloudflareStructuredInspectionRequest` immediately requires production
   changes in:
   - `apps/api/scripts/vs005-deploy-verify.ts`; and
   - `apps/api/scripts/vs005-rollback.ts`.
3. Deploy verification and rollback are explicitly reserved for Task 10.

This is a plan-sequencing defect, not a defect in or change to the approved
structured provider architecture.

The following apparent shortcuts were rejected during execution review:

- making correlation optional on shared authority-bearing results;
- overloading one provider inspection method to accept legacy and structured
  authority shapes;
- silently projecting legacy evidence into a correlated shape; and
- merging Task 9 and Task 10.

Those approaches would either weaken or obscure authority, cross the Task 10
scope boundary, or remove the independent review checkpoint between apply and
verification/rollback integration.

## 3. Approved decision: Option A — staged compatibility bridge

The approved resolution is **Option A — Staged Compatibility Bridge**.

The bridge exists only between completion of Task 9 and completion of Task 10.
It is a type and consumer-migration boundary. It is not an alternative source
of authority, a fallback inspection path for Task 9, or permission to weaken a
correlation invariant.

During the bridge:

```text
Task 9 authoritative consumers
  plan  -> structured correlated inspection
  apply -> fresh structured correlated inspection

Temporarily unmigrated Task 10 consumers
  verify   -> legacy non-authoritative projection
  rollback -> legacy non-authoritative projection
```

Task 10 closes the bridge by migrating verification and rollback to structured
correlated authority.

## 4. Task 9 authority boundary

Task 9 migrates only deploy planning and deploy apply.

### 4.1 Deployment plan

`Vs005DeploymentPlanV2` remains the strict reviewed plan contract:

```text
formatVersion: 2
providerCorrelation: REQUIRED
observedProvider: REQUIRED structured safe snapshot
```

Neither field is optional. A format-v2 plan without either field is invalid.
The plan's correlation must match the canonical account, Worker, configuration
fingerprint, provider origin, required inspection profile, and exact completed
operation set. Its provider observations must satisfy the existing tri-state
and phase-completeness rules.

No legacy observation, manual command output, prior host-inspection artifact,
or canonical configuration value may substitute for structured provider
evidence in Task 9 planning readiness.

### 4.2 Deploy apply

Apply reloads and revalidates canonical configuration, target policy, release,
and configuration fingerprint. It then performs the approved local preparation
and dry-run work before obtaining a fresh structured correlated inspection.

Plan-time evidence and manual evidence cannot satisfy the fresh apply
inspection. Legacy projection cannot authorize Task 9 mutation. Any required
unavailable fact, target mismatch, correlation mismatch, operation-set
mismatch, observation drift, or mutation-envelope mismatch fails before the
deployment mutation boundary.

Task 9 tests must prove that the legacy path cannot satisfy either planning or
fresh apply authority.

## 5. Correlated deployment result bridge

Task 9 does not mutate the existing shared `Vs005DeploymentResult` contract.
That base result remains temporarily unchanged so the not-yet-migrated Task 10
consumers can continue compiling until their authorized migration checkpoint.

Task 9 introduces a distinct strict correlated deployment result contract with
the following fixed semantics:

```text
Vs005CorrelatedDeploymentResult
  extends Vs005DeploymentResult
  + providerCorrelation REQUIRED
  + observedProvider REQUIRED structured safe snapshot
```

The exact TypeScript name may be finalized during implementation according to
existing repository naming conventions. The semantic distinction may not be
changed.

### 5.1 Base result

`Vs005DeploymentResult` is the temporarily compatible base result. During the
bridge it may still be consumed by unchanged Task 10 code, but it is not the
authoritative Task 9 apply result and cannot satisfy a Task 9 correlation or
mutation gate.

### 5.2 Correlated authoritative result

The new correlated result is the authoritative Task 9 apply result. Its
`providerCorrelation` and structured `observedProvider` fields are mandatory,
not optional. Apply must produce this result only after fresh structured
inspection and all approved final gates succeed.

This separation is a type-boundary bridge. It preserves strict Task 9 authority
without prematurely changing Task 10 production consumers.

## 6. Provider interface bridge

Task 9 preserves the transition architecture established by Task 7.

The authoritative Task 9 path uses the existing correlated structured facade
or method:

```text
plan  -> CloudflareStructuredInspectionRequest
      -> Vs005CorrelatedProviderInspection

apply -> fresh CloudflareStructuredInspectionRequest
      -> Vs005CorrelatedProviderInspection
```

Task 9 does not globally replace the legacy provider interface still used by
verification and rollback. It does not add an overloaded inspection method
that silently chooses between legacy and structured authority. The two paths
remain explicitly named and distinguishable.

Until Task 10, the legacy projection may remain available only for the existing
unmigrated verification and rollback consumers. It does not become a
correlated inspection merely because it is returned by the same provider
adapter.

## 7. Legacy projection firewall

Throughout the temporary bridge, the legacy provider projection is explicitly
non-authoritative for:

- Task 9 planning readiness;
- Task 9 `providerCorrelation`;
- Task 9 fresh apply reinspection;
- Task 9 provider-state drift comparison; and
- Task 9 mutation authorization.

Legacy values must not be copied, defaulted, or silently converted into the
mandatory Task 9 correlation envelope. Canonical configuration may validate
correlation but may not fill a provider-observation gap.

Legacy projection remains usable only by the not-yet-migrated Task 10
verification and rollback consumers. This temporary use does not make it an
approved authority source for any newly migrated workflow.

## 8. Apply ordering and inspection-to-mutation adjacency

The approved Task 9 event order is unchanged:

```text
artifactPrepare
  -> dryRun
  -> freshInspection
  -> finalGate
  -> deploy
```

Before `freshInspection`, apply must complete canonical reload and validation,
target-policy validation, release/fingerprint validation, artifact preparation,
deterministic local validation, Wrangler dry-run, and every other non-provider
deterministic precondition.

After `freshInspection`, only the following work is permitted before mutation:

- bounded in-memory correlation and observation comparison;
- exact mutation-envelope enforcement;
- existing database-`NONE` and destructive-action gates;
- sanitized child-environment construction or reconfirmation;
- the `finalGate` marker; and
- immediate deployment spawn.

After `freshInspection`, apply must not perform a build, artifact generation,
file or filesystem preparation, dry-run, another provider or network call, or
meaningful long-running provider-independent work.

The reconciliation does not weaken the child-process credential firewall.
Every covered Wrangler or deployment child environment must omit
`CLOUDFLARE_INSPECTION_API_TOKEN` while preserving the separately governed
Wrangler deployment authentication.

## 9. First-deployment absence semantics

The staged bridge does not alter first-deployment tri-state semantics.

For a Worker proven absent by the strict structured rule:

- `observations.hostname` remains `OBSERVED_ABSENT`;
- no canonical hostname is promoted into provider observation;
- hostname readiness may be calculated only from the correlated account
  subdomain observation, canonical Worker name, canonical public hostname, and
  generated `workers_dev` setting; and
- the exact approved first-deployment mutation envelope is still required.

For an existing Worker, the actual observed Worker hostname must match the
canonical public hostname. Unknown or mismatched state remains unavailable or
blocking according to the approved completeness contract.

## 10. Task 10 closure obligation

Task 10 must migrate deploy verification and rollback to:

- `Vs005CorrelatedProviderInspection`;
- explicit structured inspection requests;
- the correlated deployment result contract;
- the explicit governed prior version A;
- structured proof from the complete deployable-version list; and
- exact-version identity and fingerprint proof.

Task 10 must prove that verification and rollback no longer use the legacy
provider projection as deployment-workflow authority. After Task 10 succeeds,
no deployment workflow consumer may depend on that projection for authority.

The compatibility bridge must then be either:

- removed from the deployment workflow; or
- retained only as an isolated, explicitly non-authoritative utility when a
  legitimate non-governed or test-only use still requires it.

Task 10 must include tests that prove this migration and bridge closure are
complete. It must preserve the explicit governed version-A selection and must
not infer or select a rollback target from provider list order.

## 11. Rejected alternatives

### A. Optional correlation fields on the shared result

Rejected because optional authority fields permit ambiguous evidence and allow
callers to accept an uncorrelated result where correlated authority is
required.

### B. Overloaded shared inspection interface

Rejected because one method accepting both legacy and structured shapes creates
ambiguous authority, obscures call-site intent, and makes accidental fallback
possible.

### C. Expand Task 9 into verification and rollback

Rejected because it crosses the approved Task 10 production and review
boundary.

### D. Merge Tasks 9 and 10

Rejected because it increases the change blast radius and removes the
independent review gate for plan/apply authority before verification and
rollback migration.

## 12. Unchanged authority and security invariants

This reconciliation changes none of the following:

- canonical configuration remains intended-target authority;
- explicit target policy remains authorization authority;
- provider evidence remains observation only;
- structured REST inspection remains the authoritative inspection architecture
  for migrated consumers;
- `OBSERVED_VALUE`, `OBSERVED_ABSENT`, and `UNAVAILABLE` remain distinct;
- the production Cloudflare origin remains fixed;
- inspection remains GET-only;
- secret values remain outside plans, results, observations, logs, and source;
- fresh structured apply reinspection remains mandatory;
- `CLOUDFLARE_INSPECTION_API_TOKEN` remains excluded from covered child
  processes;
- rollback authority remains bound to explicit prior version A;
- automatic rollback-target selection remains prohibited;
- database action remains `NONE`;
- the 44 governed parent commitments remain unchanged;
- the 178 child traceability records remain unchanged;
- the reviewed Beta environment and safe-target marker remain `cadence-beta`;
- the reviewed Cloudflare account remains
  `3d6a31905ac44e9563a523f9c86cbb8d`;
- the Cloudflare Worker remains `mycadence` and its reviewed public URL remains
  `https://mycadence.ngohch-3d6.workers.dev`;
- the Supabase target label remains `cadence-beta` and its authoritative
  project ref remains `pwmhasbmacmeerbsagda`;
- the controlled Project remains
  `3503f8c7-1996-44d1-8b63-1fca36db89f8`; and
- Pilot Activation remains unauthorized.

The generic provider architecture does not hard-code the Beta tuple. This
reconciliation changes neither the target nor the target-policy boundary.

## 13. Authorization firewall

This design reconciliation authorizes documentation only.

```text
HOST INSPECTION   = NOT AUTHORIZED
REMOTE MUTATION   = NOT AUTHORIZED
CLEAN-ROOM WORK   = NOT AUTHORIZED
PILOT ACTIVATION  = NOT AUTHORIZED
DATABASE ACTION   = NONE
```

It does not authorize Task 9 implementation, Task 10 implementation, RED
tests, Cloudflare or Supabase access, deployment, rollback, configuration
mutation, schema or migration changes, or hosted Cadence calls.

## 14. Success criteria

This reconciliation is complete when review confirms all of the following:

1. Task 9 can be implemented without modifying Task 10 production files.
2. Task 9 planning and apply use mandatory correlated structured authority.
3. `Vs005DeploymentPlanV2` requires both correlation and structured provider
   observations.
4. The existing base `Vs005DeploymentResult` remains temporarily compatible
   and unchanged during Task 9.
5. The new Task 9 correlated result requires correlation and structured
   observations.
6. Legacy projection cannot authorize Task 9 planning, apply reinspection, or
   mutation.
7. Verification and rollback remain unchanged until Task 10.
8. Task 10 has an explicit obligation to eliminate legacy projection as
   deployment-workflow authority.
9. No optional correlation or overloaded inspection ambiguity is introduced.
10. The approved provider architecture and frozen source records remain
    unchanged.

## 15. Implementation review gates

The later Task 9 implementation review must verify:

- strict format-v2 plan correlation;
- use of the explicitly named structured provider facade by plan and apply;
- rejection of legacy evidence at every Task 9 authority gate;
- the exact apply event order and inspection-to-mutation adjacency;
- zero deployment attempts on correlation, completeness, drift, envelope,
  database, destructive-action, or child-environment failure;
- a mandatory correlated deployment result without raw provider material or
  credentials; and
- no production changes in Task 10-owned verification or rollback files.

The later Task 10 implementation review must verify:

- verification and rollback consume correlated structured authority;
- rollback uses the explicit governed prior version A;
- deployable-list and exact-version proof are both required;
- no automatic rollback selection exists; and
- no deployment workflow authority remains on the legacy projection.

## 16. Governance reconciliation

This document adds no governed capability, removes no original commitment,
and changes no requirement status or milestone assignment. It preserves the
VS005 mapping to F13.3, F17.1, F17.3, F17.4, F18.3, and F19.1 and does not claim
closure evidence for those requirements.

```text
Original commitments removed: 0
Original commitments moved beyond M3: 0
Governed parent commitments: 44
Child traceability records: 178
Database migration: NO
Remote operation: NO
Pilot Activation: NOT AUTHORIZED
```

# VS005 Task 15 Staged Hosted Rehearsal Amendment

Status: additive governance design only. This amendment does not execute or
authorize hosted deployment, provider mutation, database work, T15-C, or Pilot
Activation.

## Authority and purpose

The frozen Task 15 contract remains in
`docs/superpowers/plans/2026-09-04-vs005-portable-deployment-runtime.md` and
its design. This document adds an explicit execution decomposition without
rewriting that record:

- T15-C — Controlled Hosted Beta Deployment and Immediate Verification
- T15-D — Scheduled Worker and Missed-Schedule/Backlog Recovery
- T15-E — Controlled Provider Configuration/Cron Drift and Restoration
- T15-F — Explicit Application Rollback to Retained Version A
- T15-G — Clean-Room Reconstruction and Separately Authorized Fresh-Target Initialization

T15-B is closed for read-only planning evidence in the current HANDOFF
checkpoint. Its historical release identity and plan are not reusable for a
later subtask. Any future execution requires a fresh release identity and
canonical plan bound to the then-current source HEAD.

## Common invariants

Every subtask requires separate explicit authorization. Target identity,
configuration fingerprint, and release identity must be exact and correlated
before mutation. Required pre/post inspection evidence must be fresh where
the frozen contract requires it. Operations outside the authorized subtask
boundary are prohibited.

Database reset, migration rollback, and migration reversal are prohibited.
Unexpected destructive database intent, target/config/release drift, failed
mandatory verification, unsafe credential handling, or unauthorized mutation
is an immediate stop. Tokens, secrets, raw provider payloads, and raw stacks
must not be retained. Pilot Activation is a separate later gate and remains
unauthorized.

## T15-C — Controlled Hosted Beta Deployment and Immediate Verification

### 1. Purpose

Apply one reviewed PASS plan to the authorized Beta target and establish fresh
immediate hosted verification evidence.

### 2. Scope

One controlled Cloudflare Worker deployment/configuration, canonical Cron
configuration required for the baseline, and immediate structured hosted
verification. Scheduling recovery, drift experiments, rollback rehearsal,
clean-room reconstruction, and Pilot Activation are deferred.

### 3. Preconditions

- T15-B read-only planning is closed.
- A separately authorized target and mutation set are named.
- The repository state is clean and the release identity is bound to current
  HEAD.
- A fresh canonical plan exists at `.cadence/vs005/deployment-plan.json` with
  `readiness: PASS`, exact target/config correlation, and
  `database.migrationAction = NONE`.
- Approved inspection and deployment credentials are available without
  exposing values.
- Any required owner-supplied secret source is separately authorized.

### 4. Authoritative target

Use the reviewed Beta tuple in `config/cadence.runtime.beta.json`: Cloudflare
account `3d6a31905ac44e9563a523f9c86cbb8d`, Worker `mycadence`, public URL
`https://mycadence.ngohch-3d6.workers.dev`, environment `beta`, safe marker
`cadence-beta`, and the reviewed Supabase identifiers. Credentials cannot
select or rewrite this target.

### 5. Release identity

Use a newly established release version, full commit SHA, and build ID for the
source actually acted upon. Do not reuse the T15-B identity after any HEAD
change.

### 6. Canonical plan prerequisite

Generate and review the root-exposed plan command and canonical artifact.
`apps/api/.cadence` is never authoritative.

### 7. Permitted provider mutations

- One existing `cadence:deploy:apply` Worker create/update boundary.
- Canonical Cron configuration required for the baseline.
- Explicitly authorized required named-secret upload through the existing
  temporary secret transport when necessary; retain only secret-name outcome.

### 8. Prohibited operations

No arbitrary provider command, alternate origin/target, database operation,
reset, migration reversal, rollback, drift experiment, clean-room work,
hosted business call, or Pilot Activation.

### 9. Database action

`database.migrationAction = NONE`. Deployment does not run migrations or reset
database state.

### 10. Deployment boundary

Use only the existing `cadence:deploy:apply` boundary against the reviewed
fresh plan. No direct provider mutation API or alternate launcher is added.

### 11. Immediate hosted verification

Use only the existing `cadence:deploy:verify` boundary. Require fresh exact
correlation for account, Worker, deployment/version, release, configuration
fingerprint, settings, Cron, required secret-name state, hostname, and other
facts required by the verification profile.

### 12. Worker baseline

T15-C owns the immediate post-deployment Worker/settings/Cron/hostname and
release baseline. Ongoing scheduled execution and recovery belong to T15-D.

### 13. Required evidence

Retain safe deployment and verification artifacts containing source commit,
release identity, build ID, target correlation, configuration fingerprint,
bounded deployment/version identifiers, bounded observations, database NONE,
and mutation outcome. Never retain credentials, secrets, raw responses, or
raw stacks.

### 14. Stop conditions

Stop before or after mutation on target/config/release drift, missing required
facts, failed local preparation, verification failure, unsafe credential
handling, unexpected database intent, or any unauthorized operation.

### 15. Recovery/rollback boundary

T15-C does not execute rollback. A failed immediate verification stops the
sequence and returns for separately authorized recovery. T15-F owns rollback
after an explicit retained Version A exists.

### 16. Deferred responsibilities

T15-D owns schedule/recovery; T15-E owns drift/restoration; T15-F owns
Version-A rollback; T15-G owns clean-room reconstruction and any separately
authorized fresh-target initialization.

### 17. Closure criteria

Apply and immediate verification pass with exact target/release/configuration
correlation, safe evidence is retained, database action remains NONE, and no
unauthorized operation occurs.

### 18. Pilot Activation relationship

T15-C does not authorize or imply Pilot Activation.

## T15-D — Scheduled Worker and Missed-Schedule/Backlog Recovery

T15-D owns natural or controlled scheduled execution evidence, bounded worker
summaries, expected application effects, controlled trigger suspend/restore
when required, durable pending-work evidence, backlog recovery, and retry or
resumption evidence. Trigger suspension is limited to the recovery proof and
does not include unrelated provider drift experiments. It requires a closed
T15-C baseline, separately authorized trigger changes, normal governed
application activity, and no manual delivery-row mutation.

## T15-E — Controlled Provider Configuration/Cron Drift and Restoration

T15-E owns one deliberate bounded provider configuration/Cron drift, provider
observation of the changed state, expected verification failure/block evidence,
canonical restoration, and post-restoration verification. It requires a
closed T15-C baseline and separate authorization. Propagation delay is not
interpreted as drift.

## T15-F — Explicit Application Rollback to Retained Version A

T15-F is blocked until an explicit retained Version A exists. The current
state is `FIRST_DEPLOYMENT_NO_PRIOR_VERSION_A`. When authorized, T15-F owns a
harmless second application release, explicit Version-A identity, application-
only rollback, exact target/config/release correlation, post-rollback
verification, and `database.migrationAction = NONE`. It never performs a
database rollback, reset, or migration reversal.

## T15-G — Clean-Room Reconstruction

T15-G owns reconstruction in an owner-controlled fresh environment without
developer credentials, including deployment, verification, scheduled behavior,
and credential-boundary evidence. If required for a truly fresh Supabase
target, existing migration history may be applied only as a separately
authorized database-initialization action after a reviewed dry run. Reset,
migration rollback, and migration reversal remain prohibited. The existing
VS004 bootstrap and VS005 tooling are reused; no new schema change is implied.

## Execution ordering

```text
T15-B CLOSED
  -> T15-C separately authorized, executed, and closed
  -> T15-D and T15-E only when separately authorized
  -> retained Version A established
  -> T15-F only when separately authorized
  -> T15-G only when separately authorized
  -> Task 16 reconciliation
  -> separate Pilot Activation decision
```

Closure of one subtask never authorizes the next.

## Frozen Task 15 traceability

| Frozen requirement | Owner | Repeated evidence | Status |
|---|---|---|---|
| Hosted deployment/apply | T15-C | Fresh plan before apply | Mapped |
| Immediate hosted verification | T15-C | Fresh post-deployment verification | Mapped |
| Scheduled worker behavior | T15-D | Hosted scheduled run evidence | Mapped |
| Missed-schedule/backlog recovery | T15-D | Trigger restore and backlog resumption | Mapped |
| Configuration/Cron drift | T15-E | Drift failure and restoration PASS | Mapped |
| Application rollback | T15-F | Explicit Version A and post-rollback verification | Mapped |
| Clean-room portability | T15-G | Owner-controlled reconstruction evidence | Mapped |
| Fresh-target migration initialization | T15-G | Separate dry-run and authorized push | Mapped |
| Safe evidence retention | T15-C through T15-G; Task 16 | Safe artifacts and final reconciliation | Mapped |
| Stop conditions and safety invariants | Each owning subtask | Boundary/authorization audit | Mapped |
| Pilot Activation separation | Separate later gate | Explicit NOT AUTHORIZED status | Mapped |

Orphan frozen requirements: 0. Removed requirements: 0. Silently weakened
requirements: 0. Requirements that genuinely need repeated pre/post evidence
remain repeated in their owning subtask.

## Governance status

This amendment changes no parent or child requirement, no milestone, no
configuration, no migration, and no frozen record. Governance remains 44
parents and 178 child traceability records; removed commitments remain 0 and
nothing moves beyond M3. T15-C through T15-G are proposed separately governed
execution units, not executed or authorized by this document. Pilot Activation
remains NOT AUTHORIZED.

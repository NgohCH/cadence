# VS005 T15-A - Target Contract Reconciliation Design

Status: design freeze for local T15-A implementation only. This document does
not start Task 15, authorize a hosted mutation, edit the Beta configuration,
or authorize Pilot Activation.

Date: 2026-09-07

## 1. Context

VS005 Tasks 1-14 established a provider-neutral Cadence runtime, a Cloudflare
adapter, canonical runtime configuration, bounded worker processing, and
plan-bound deployment/verification controls. VS004 controlled Beta bootstrap
recovery is `VERIFIED / CLOSED` at `3378e15`.

The first hosted Task 15 mutation is not yet authorized. The current local
Beta configuration was created earlier under narrow authorization for the
controlled Beta bootstrap/preflight. It is known, untracked preparation and
must not be discarded or silently reused as proof of a hosted deployment.

The review found that the current implementation conflates two different
identities:

```text
cadence-beta  = governed Beta environment and safe-target marker
mycadence     = reviewed Cloudflare Worker name
```

They are separate concepts. The target contract must represent and compare
both explicitly.

## 2. Problem

The existing runtime configuration contains the environment, public URL,
Supabase target, pilot Project, and worker policy, but it does not contain the
reviewed Cloudflare account ID or Worker name. The current deployment
generator derives the Worker name from the environment, producing
`cadence-beta`, while the reviewed Beta Worker is `mycadence`.

The current concrete Cloudflare provider inspection also proves only the
authenticated identity. It does not establish the actual Worker state,
relevant configuration, Cron schedule, secret binding presence, or deployed
version/fingerprint. A plan that records only whatever account is currently
authenticated cannot prove that it is the reviewed account.

Task 15 therefore requires a focused local contract reconciliation before any
hosted deployment, schedule change, hosted Discussion write, drift test,
rollback, or clean-room operation.

## 3. Approved decision

The canonical Beta target is:

| Concept | Canonical value |
|---|---|
| Application environment | `beta` |
| Safe target marker | `cadence-beta` |
| Cloudflare account ID | `3d6a31905ac44e9563a523f9c86cbb8d` |
| Cloudflare Worker name | `mycadence` |
| Public URL | `https://mycadence.ngohch-3d6.workers.dev` |
| Supabase project | `cadence-beta` |
| Supabase project ref | `pwmhasbmacmeerbsagda` |
| Controlled Project | `3503f8c7-1996-44d1-8b63-1fca36db89f8` |
| Forbidden alternate operational target | `cadence-dev` |
| Unrelated QA Project | `07e20000-0000-4000-8000-000000000001` |

The design explicitly preserves this identity rule:

```text
cadence-beta != Cloudflare Worker name
```

`cadence-beta` identifies the governed Beta environment/safe target.
`mycadence` identifies the reviewed Cloudflare Worker.

The Cloudflare account ID and Worker name are non-secret target facts. No
Cloudflare credential, API token, OAuth material, or Supabase privileged secret
is part of the target model.

## 4. Canonical target model

### 4.1 Smallest compatible extension

Existing fields retain their names and meanings:

- `application.environment` remains the runtime environment;
- `application.publicUrl` remains the reviewed application origin;
- `pilot.safeTargetMarker` remains the existing safe-target marker field;
- `supabase.projectRef` remains the canonical Supabase target reference;
- `pilot.projectId` remains the controlled Project identity.

Add one provider-specific non-secret block to the canonical configuration:

```json
{
  "cloudflare": {
    "accountId": "3d6a31905ac44e9563a523f9c86cbb8d",
    "workerName": "mycadence"
  }
}
```

The block is required when `runtime.provider` is `cloudflare`. It is not
required for the Node-only local provider path. The existing JSON Schema,
TypeScript configuration type, semantic validation, canonical fingerprint,
example/CI fixtures, and generated deployment artifact must all adopt this
same extension during the later implementation checkpoint.

For the reviewed Beta target, semantic validation additionally requires the
exact approved tuple in Section 3. A different marker, account, Worker, URL,
Supabase ref, or controlled Project fails before provider mutation. The
validator must not derive `workerName` from `environment`.

### 4.2 Canonical fingerprint

The canonical configuration fingerprint includes:

- `application.environment` and `application.publicUrl`;
- `pilot.safeTargetMarker` and `pilot.projectId`;
- `cloudflare.accountId` and `cloudflare.workerName`;
- Supabase URL/project ref and publishable key;
- provider, worker policy, retry policy, and schema version.

This keeps the target facts in the existing one-source-of-truth model. A
generated provider file is derived output, not a second operator-edited
configuration.

## 5. Fail-closed target semantics

The deployment system distinguishes two records:

### Intended target facts

These come from the validated canonical configuration and the reviewed target
contract:

```text
environment
safeTargetMarker
cloudflare.accountId
cloudflare.workerName
application.publicUrl
supabase.projectRef
pilot.projectId
```

The Beta validator must reject `cadence-dev`, a different safe marker, a
different project/ref, or any other alternate tuple. A config path alone is
not authorization and a config value alone is not provider-state proof.

### Observed provider facts

These are obtained through read-only provider inspection and safe runtime
verification. They include the authenticated account, Worker identity and
existence state, relevant deployed settings, and release/configuration
identity. Application verification separately confirms the runtime's
environment, target ref, controlled Project, and release identity through
credential-free safe surfaces and governed API behavior.

Planning fails closed when any required intended fact is invalid, any
required observed fact is unavailable, or any intended/observed comparison
differs. Unknown is not equivalent to matching. A first deployment may report
`workerExists=false` as an observed absence, but it must still prove the
reviewed account and intended Worker name before mutation.

The minimum mismatch failures are:

- environment mismatch;
- safe-target-marker mismatch;
- Cloudflare account mismatch;
- Worker-name mismatch;
- public-URL mismatch;
- Supabase project-ref mismatch;
- controlled-Project mismatch;
- missing required provider observation;
- stale or mismatched configuration fingerprint;
- stale or mismatched release identity.

No mismatch may be repaired by silently substituting another config path,
account, Worker, Supabase ref, Project, or safe marker.

## 6. Provider observation model

The provider adapter must expose a read-only inspection capability sufficient
for the deployment plan and rollback preflight. The capability is an
interface/contract, not a command prescription. Implementation planning must
map it to provider-supported inspection APIs or CLI operations after confirming
their exact behavior; this design does not invent provider commands.

For the reviewed Worker/account, inspection must establish, where the
provider permits:

- authenticated Cloudflare account ID;
- Worker name and existence state;
- relevant Worker deployment/configuration identity;
- current Cron schedule and trigger state;
- relevant non-secret vars/bindings, including the embedded config fingerprint
  and release identity where available;
- presence-by-name of `SUPABASE_SECRET_KEY`, never its value;
- current deployed version and prior-version availability where available;
- hostname/public-route readiness where applicable.

Every field is either an observed safe value, an explicit observed absence,
or an unavailable fact. An unavailable fact that is required by the plan is a
hard blocker. Raw provider output, credentials, secret values, response
bodies, and unrestricted exceptions are not passed into evidence artifacts.

The adapter must never make Cloudflare state canonical business state. It only
reports provider/deployment state to the deployment boundary.

## 7. Deployment plan, apply, and verify integration

The existing plan-bound architecture remains intact.

### Plan

The plan records:

- the complete intended target tuple;
- the complete safe observed provider snapshot;
- the exact release and configuration fingerprint;
- the exact mutation envelope: Web Static Assets, API Worker, scheduled
  Worker, required bindings, and named secret configuration if needed;
- `database.migrationAction=NONE`;
- an empty destructive-action list;
- rollback availability without implying database rollback;
- readiness `PASS` only when all required comparisons and observations pass.

Planning is read-only. It must not create a Worker, change a binding, upload
a secret, change Cron, write business data, or reset/migrate the database.

### Apply

Apply revalidates the canonical config and release, recomputes the
fingerprint, compares the plan's intended target to the current config, and
repeats provider inspection immediately before mutation. It refuses:

- a plan whose target contract is stale or different;
- a plan whose observed account or Worker differs from the current observation;
- a plan whose required secret state differs;
- a plan whose generated artifact does not carry `mycadence` and the reviewed
  account target;
- any plan containing a database action or destructive action.

Apply cannot silently retarget the Worker or account. Mutation failures retain
the existing safe failure contract and record whether mutation was attempted,
without raw provider text.

### Verify

Post-deployment verification checks the same target identity again:

- public web and health reachability;
- API reachability through the same-origin `/api/v1` boundary;
- environment and safe runtime identity;
- Cloudflare account/Worker identity;
- public URL and Supabase ref;
- controlled Project identity through the safe governed runtime/application
  path;
- release, schema version, and configuration fingerprint;
- Cron schedule and named secret binding;
- browser absence of server-secret material;
- no material configuration drift.

Verification always records `pilotActivation=NOT_AUTHORISED`. A deployment
PASS is not Pilot Activation approval.

## 8. Beta config provenance and reconciliation

`config/cadence.runtime.beta.json` was created early under explicit narrow
authorization for controlled Beta bootstrap/preflight. That is an approved
sequencing deviation, not a governance violation. Its presence does not mean
Task 15 started and it is not hosted evidence.

The actual file remains untouched during this design checkpoint. During local
T15-A implementation it will be reconciled, not discarded, by:

1. retaining the existing environment, marker, Supabase, Project, worker
   policy, retry, and public configuration values;
2. adding the explicit Cloudflare account ID and `mycadence` Worker name;
3. validating the exact Section 3 Beta tuple;
4. recording the early-creation provenance in the local reconciliation and
   Handoff update; and
5. checking that no privileged secret value is present.

The reconciled non-secret Beta file becomes governed/tracked as part of the
local T15-A reconciliation checkpoint, subject to the normal review and
commit gate. It must not be staged or committed by this design checkpoint.

This controlled deviation is limited to moving an already-authorized local
non-secret target file into the canonical T15-A model. It does not alter the
frozen VS005 design/plan, requirement counts, database history, or hosted
authorization boundary.

Clean-room proof must be reproducible from the governed repository/release,
the canonical template/model, owner-supplied non-secret target facts, and
externally supplied secrets. It must not depend on an ignored developer-only
file.

## 9. HANDOFF reconciliation

The later narrow `HANDOFF.md` update must reconcile the stale `305d123`
reference by recording:

- current pre-T15-A checkpoint `3378e15`;
- VS005 Tasks 1-14 locally completed/prepared, with no hosted Task 15 evidence;
- VS004 controlled Beta recovery `VERIFIED / CLOSED`;
- T15-A target-contract reconciliation in progress;
- the reviewed Beta target tuple and the distinction between `cadence-beta`
  and `mycadence`;
- the early untracked Beta config provenance;
- Task 15 remote mutation not authorized;
- Pilot Activation not authorized; and
- unchanged governance counts: 44 parent commitments and 178 child records.

This is documentation reconciliation, not hosted evidence. It must not claim
deployment, scheduling, drift, rollback, clean-room, or Pilot Activation
results that do not exist.

## 10. Clean-room separation

T15-A through the normal hosted Beta rehearsal do not require a clean-room
target to be selected. The current `cadence-beta` target remains the
authoritative existing Beta state for the hosted rehearsal, and it must not
be reset or reconstructed as part of T15-A.

Clean-room is a separate gate before T15-K. It must identify exact
owner-controlled infrastructure:

- Cloudflare account and Worker;
- Supabase project and ref;
- provider/operator authentication;
- externally supplied runtime and database secrets.

The developer's personal Cloudflare or Supabase credentials cannot satisfy
the proof. A separate fresh Supabase target may receive the existing governed
migration history only after a reviewed preflight. No clean-room step may
reset, destroy, repair, reverse, or rewrite database history.

## 11. Secret boundary

The canonical target model, plan, verification artifacts, and logs may contain
secret names and readiness booleans only.

| Value | Boundary | Treatment |
|---|---|---|
| `SUPABASE_SECRET_KEY` | Cloudflare Worker secret / operator or approved CI source | External only; never canonical JSON, plan, logs, or Git |
| `SUPABASE_DB_PASSWORD` | Operator host for separate fresh-database initialization | Not part of normal hosted deployment; never logged or committed |
| Wrangler/Cloudflare credential | Provider/operator-managed authentication | Never canonicalized or copied into Worker runtime |
| Supabase publishable key | Public/non-secret canonical config | May be embedded in browser-safe generated config where required |
| Release/config metadata | Non-secret runtime vars | Safe bounded identity only |

Task 12's temporary secret transport remains the only deployment upload
boundary. The transport file is owner-only where supported and removed in a
`finally` path. Secret values must not appear in command arguments, history,
chat, artifacts, browser assets, or raw exception output.

## 12. Database boundary

T15-A and normal Task 15 deployment require:

```text
NEW MIGRATION       = NO
DATABASE RESET      = NO
DATABASE REPAIR     = NO
MIGRATION REVERSAL  = NO
DATABASE ROLLBACK   = NO
AD HOC DESTRUCTIVE SQL = NO
```

Existing `cadence-beta` persistence remains authoritative. Normal hosted
Discussion and worker rehearsal writes must use the existing governed API,
application services, repositories, and event-delivery contracts. They are
not database repair operations.

For a later truly fresh clean-room Supabase target, the existing governed
migration history may be applied as a separate initialization action after
read-only preflight. That conditional operation is not a new VS005 migration
and must never be invoked implicitly by deployment, rollback, or verification.

## 13. T15-A implementation scope

The subsequent local implementation checkpoint may cover only:

1. canonical `cloudflare.accountId`/`cloudflare.workerName` model extension;
2. schema, TypeScript, semantic-validation, and fingerprint extension;
3. exact Beta target validation and `cadence-dev` fail-closed protection;
4. provider read-only observation interface and safe completeness handling;
5. intended/observed target capture in plan artifacts;
6. apply and verify target binding without weakening Tasks 11-14 controls;
7. reconciliation of the untracked Beta config;
8. the narrow Handoff reconciliation described in Section 9;
9. focused tests and existing regression tests; and
10. local non-mutating plan/readiness evidence.

The implementation checkpoint must not deploy, change Cron, create hosted
Discussion work, perform drift, deploy a second version, roll back, execute a
clean-room reconstruction, or authorize Pilot Activation.

## 14. Testing requirements

Strict RED -> GREEN -> fresh verification is required for each behavior
change. Focused coverage must prove rejection of:

- wrong Cloudflare account ID;
- wrong Worker name;
- wrong public URL;
- wrong Supabase project ref;
- wrong safe target marker;
- wrong controlled Project ID;
- `cadence-dev` or any alternate Beta target;
- missing account, Worker, schedule, binding, secret-name, release, or
  fingerprint observation;
- observed account or Worker mismatch;
- stale plan/config/release target mismatch; and
- secret-value leakage in plans, failures, logs, and generated artifacts.

Coverage must also prove success for the exact Section 3 canonical Beta tuple,
including the deliberate distinction between `cadence-beta` and `mycadence`.

Provider tests use injected read-only observation fixtures and must not contact
Cloudflare. Apply/verify tests use injected provider and HTTP readers. A
separate operator-host inspection is required before any remote mutation.

Existing VS001-VS004 behavior, API/web regressions, Node runtime behavior,
worker bounds, retry semantics, browser secret boundary, and application
rollback/database-`NONE` controls remain protected.

## 15. Evidence and governance

The local T15-A evidence set must identify:

- source commit and frozen design/plan hashes;
- canonical schema version and target fingerprint;
- intended target tuple;
- safe observed provider fields and completeness outcome;
- explicit `database.migrationAction=NONE` and empty destructive actions;
- focused test results and regression result;
- Beta config provenance and tracking disposition;
- Handoff reconciliation disposition;
- `Task 15 remote mutation: NOT AUTHORIZED`; and
- `Pilot Activation: NOT AUTHORIZED`.

No local readiness or plan artifact is hosted evidence. Hosted evidence begins
only after the later explicit mutation authorization checkpoint and must be
recorded under the frozen Task 15 evidence path without secret values or
sensitive business data.

The design preserves the VS005 governed capability mapping and does not alter
the 44-parent/178-child baseline. It does not close F17.1, F17.3, F17.4, or
F18.3; those remain evidence-based and subject to the frozen plan.

## 16. Authorization gates

The gates are deliberately separate:

```text
T15-A design freeze
    -> local T15-A implementation approval
    -> local tests and non-mutating readiness evidence
    -> host-operated provider read-only inspection
    -> reviewed deployment plan
    -> explicit user authorization for named hosted mutations
    -> hosted Beta rehearsal
    -> separate clean-room target authorization before T15-K
    -> separate VS006/VS007/rehearsal/Pilot Activation gates
```

This design commit is not authorization. The first hosted mutation remains
unauthorized until the canonical target contract is implemented, provider
inspection is complete, the plan is reviewed, and the user explicitly names
the permitted mutation classes and exact targets.

## 17. Non-goals

This design does not:

- perform a hosted deployment or Worker update;
- create, change, suspend, or restore a Cron trigger;
- create hosted Discussion work or any hosted application data;
- perform drift detection or restoration;
- deploy a second application version;
- execute application rollback;
- execute clean-room reconstruction or database initialization;
- contact Cloudflare or Supabase;
- edit the Beta config, `HANDOFF.md`, frozen VS005 records, or implementation
  code;
- create the VS005 implementation plan; or
- authorize Pilot Activation, production launch, real-user admission, or M1
  closure.

## 18. Risks and stop conditions

Stop local T15-A work and return for review if:

- the reviewed `mycadence` target cannot be represented without weakening a
  frozen authority or safety boundary;
- provider-supported read-only inspection cannot prove a required target fact;
- a change would make Cloudflare state canonical business state;
- a deployment path requires implicit migration, reset, repair, reversal, or
  ad hoc SQL;
- the Beta config contains a privileged secret or a second operator-owned
  setting source;
- `cadence-dev` or the unrelated QA Project can pass the exact Beta target
  validator;
- a test or verification exposes secret values or raw provider output;
- a T15-A change affects VS001-VS004 behavior; or
- any P0/P1 issue appears in frozen behavior.

The frozen VS005 design and implementation-plan hashes are preserved as
provenance for this checkpoint:

```text
design SHA-256 = 5b39d77044f3264a4181642b7e3081ee7eedcdc63ffd7f3c0e65d26dc91ff2a8
plan SHA-256   = f1fb71197756ddc45606b062068c53703cffdf6f2dad69c00120178aa27949e1
```

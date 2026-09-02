# VS004-04C — Controlled Pilot Operator Runtime Design

Status: design specification only. This document does not implement the
operator runtime, add commands, or alter the database.

## 1. Purpose and authority model

VS004-04C defines the controlled operator transport for the already committed
VS004-04A preflight and VS004-04B execution boundaries. It provides two
separate commands and two reviewable artifact steps:

```text
pilot:preflight
  manifest + runtime target
    -> 04A read-only preflight
    -> PreparedPilotExecution artifact
    -> stop

pilot:execute
  PreparedPilotExecution artifact + independently loaded runtime target
    -> 04B plan-bound execution
    -> result or failure artifact
    -> stop
```

04C transports authority; it does not create authority. The authority chain is
manifest intent, 04A's prepared execution, an operator review/decision, and
04B's execution of that bound plan. 04C must not add, remove, alter, infer,
replan, repair, retry, compensate, or reconcile operations. It must preserve
the prepared run correlation ID.

There is no automatic preflight-to-execute chain and no `--yes` or
`--execute-after-preflight` convenience option.

## 2. Audited committed interfaces

The design is based on the current committed interfaces rather than a parallel
artifact model.

### 2.1 Manifest and target

`apps/api/scripts/vs004-pilot-manifest.ts` provides the canonical
`validatePilotManifest()` and `computeManifestHash()` functions. The validated
manifest includes `manifestId`, `target`, `operator`, exactly one `project`,
and the pilot user, identity, membership, role, health, and provenance intent.
The target declaration includes `environment`, `supabaseProjectRef`,
`safeTargetMarker`, and `projectId`. Project marker metadata is not Project
database state.

`apps/api/scripts/vs004-preflight.ts` provides `PilotRuntimeTarget` and
`validatePilotRuntimeTarget()`. Runtime target identity includes `cadenceEnv`,
`supabaseUrl`, `supabaseProjectRef`, `safeTargetMarker`, and `projectId`.
Target validation requires the declared target and runtime target to agree;
the safe-target marker is never compared with a Project row.

### 2.2 Prepared execution

`apps/api/scripts/vs004-controlled-pilot-preflight.ts` provides
`PreparedPilotExecution` with these committed fields:

- `manifestId`;
- `manifestHash`;
- `target`: `environment`, `supabaseUrl`, `supabaseProjectRef`, `projectId`,
  and `safeTargetMarker`;
- `operatorPersonId`;
- `runCorrelationId`;
- `validatedManifest`;
- `observedEvidence`: observation timestamp and credential-free counts for
  users, Persons, Cadence Users, authentication identities, Auth accounts,
  Project, memberships, role assignments, and protected transfers;
- `preflightPlan`.

`preparePilotExecution()` validates the manifest and target, observes all
required state through read-only sources, invokes the existing pure
`buildPilotPreflightPlan()` once, and returns a deeply frozen prepared
execution. The prepared object is a snapshot, not a lock or a permission
grant.

### 2.3 Execution

`apps/api/scripts/vs004-controlled-pilot-execution.ts` provides
`executeControlledPilot()`, `ControlledPilotExecutionServices`,
`PilotExecutionResult`, and `ControlledPilotExecutionError`.

The result currently contains `manifestId`, `manifestHash`,
`runCorrelationId`, the bound `target`, `startedAt`, `completedAt`, and
credential-free `outcomes`. Each outcome contains `resourceKey`, planned
operation kind, owning module, resource ID, `CREATED` or `REUSED`, operator,
and correlation ID. The error contains a safe category, prepared context,
failed operation when known, and completed outcomes.

The executor accepts application preparation services only: Identity,
Projects, Project Health, and Project Membership. It does not accept a raw
manifest as execution authority and does not invoke the planner.

### 2.4 Runtime and provider conventions

`apps/api/src/bootstrap/environment-safety.ts` is the current environment
authority. It recognizes `CADENCE_ENV`, `SUPABASE_URL`, and
`CADENCE_SUPABASE_PROJECT_REF`, with local loopback and hosted HTTPS/project
reference checks. The existing server-side Supabase client uses
`SUPABASE_SECRET_KEY`; the publishable application key is
`SUPABASE_PUBLISHABLE_KEY`.

The administrative provider boundary is
`AdministrativeAuthProvider`, with `findAccounts()` and `createAccount()`.
The Supabase adapter is the provider-specific implementation. Runtime
composition may close over protected first-account password configuration when
constructing the Identity preparation service, but the password is never part
of a manifest, prepared artifact, result, error, or normal log.

No existing artifact utility or pilot operator command was found. Existing
bootstrap scripts are fixtures/evidence and are not to become the 04C command
implementation.

## 3. Command model

The implementation will add two independently invoked commands, using the
repository's package conventions when implementation begins:

```text
pnpm pilot:preflight --manifest <manifest.json> --out <prepared.json>
pnpm pilot:execute --prepared <prepared.json> --out <result.json>
```

The exact package/workspace wiring is intentionally deferred to implementation
planning. It is not part of this design checkpoint.

`pilot:execute` accepts only `--prepared`; it does not accept a manifest and
cannot use a manifest to establish new execution authority. There is no
automatic chaining between commands.

## 4. Preflight command design

The preflight handler is CLI/input orchestration only. Its deterministic flow
is:

1. Parse and validate required arguments, including input and output paths.
2. Load JSON from the operator-supplied manifest path.
3. Pass the value through `validatePilotManifest()` exactly as the canonical
   manifest validator requires.
4. Load the current runtime target/configuration and validate it with the
   existing environment-safety rules and `validatePilotRuntimeTarget()`.
5. Establish one fresh nonblank run correlation ID for this preparation
   attempt. It is not derived from the manifest hash.
6. Build 04A read-only observation dependencies. No preparation service,
   mutation repository, raw Supabase client, RPC, or provider write method is
   exposed to the command handler.
7. Call `preparePilotExecution()` once.
8. Serialize the returned `PreparedPilotExecution` without credentials and
   write it atomically.
9. Print a concise safe summary containing manifest ID, environment, Project
   ID, run correlation ID, CREATE/REUSE counts, and output path.
10. End with `PREPARED — NOT EXECUTED` and `NO MUTATIONS PERFORMED`.

The handler never invokes 04B. Invalid input, target failure, observation
failure, planner conflict, or artifact failure produces nonzero exit status
and no executable partial artifact.

## 5. Execute command design

The execute handler is CLI/input orchestration only. Its flow is:

1. Parse and validate `--prepared` and `--out` paths.
2. Load the prepared JSON artifact.
3. Structurally validate and deserialize the exact
   `PreparedPilotExecution` shape before use, including nested manifest,
   target, evidence, and plan data.
4. Load the current runtime target independently; do not trust a target read
   from a command-line manifest or from stale ambient state.
5. Build the committed runtime composition boundary.
6. Call `executeControlledPilot()` once with the loaded prepared execution.
7. Rely on 04B to recompute the manifest hash and revalidate the target,
   operation allowlist, plan consistency, and module-owned current state.
8. Atomically write the credential-free `PilotExecutionResult` on success.
9. Print a concise safe summary containing manifest ID, run correlation ID,
   CREATED/REUSED counts, and result path.

The execute handler never loads a separate manifest, calls 04A, invokes
`buildPilotPreflightPlan()`, modifies the prepared plan, creates a replacement
correlation ID, retries stale execution, or repairs a conflict. A stale or
conflicting plan fails and requires a new preflight.

## 6. Prepared artifact contract

The serialized `PreparedPilotExecution` is the canonical prepared artifact;
04C does not invent a competing authority schema or a consumed-artifact
ledger. The serialized fields are the exact committed fields listed in
Section 2.2. In particular, the artifact binds the validated manifest, its
credential-free deterministic hash, target identity, operator Person,
per-attempt correlation ID, observed evidence, and complete preflight plan.

Deserialization must reject malformed JSON, missing fields, wrong primitive or
array shapes, invalid identifiers, unsupported operation kinds, inconsistent
nested manifest/target values, and credential-shaped fields. Structural
validation is a transport guard; 04B remains responsible for semantic
prepared-execution integrity and current-state revalidation.

The artifact must not contain passwords, Supabase service-role or secret
keys, database passwords, access or refresh tokens, Auth provider admin
credentials, Entra secrets, bearer tokens, or any other environment secret.
Manifest hashing remains deterministic over the validated credential-free
manifest and independent of JSON formatting, runtime secrets, and the run
correlation ID.

## 7. Runtime composition boundary

Implementation will introduce a dedicated composition boundary, separate from
CLI parsing. The expected responsibilities are:

```text
buildControlledPilotRuntime()
  -> current environment/configuration validation
  -> provider and database adapter construction
  -> typed read-only observation views for 04A
  -> Identity/Projects/Health/Membership preparation services for 04B
```

The likely implementation boundary, subject to the implementation audit, is:

- `apps/api/scripts/vs004-controlled-pilot-artifact.ts` and its tests for
  safe JSON loading, structural validation, and atomic writing;
- `apps/api/scripts/vs004-controlled-pilot-runtime.ts` and its tests for
  service composition;
- `apps/api/scripts/vs004-controlled-pilot-preflight-cli.ts` and its tests;
- `apps/api/scripts/vs004-controlled-pilot-execute-cli.ts` and its tests.

These are design-level file responsibilities, not files to create in this
checkpoint.

Runtime composition will construct the administrative Auth provider and the
committed Identity, Projects, Project Health, and Project Membership adapters
and services. Where a committed adapter has both read and write capability,
the 04A dependency is passed as a narrow read-only typed view; the command
handler is never given the adapter or raw client. The 04B dependency is the
module-owned application preparation service, not its repository, RPC, or
Supabase client.

The Identity composition facade may bind protected runtime-only account
creation credentials while exposing the existing preparation service shape to
04B. No credential-bearing value crosses into a prepared execution or result.
Projects and Project Health remain independently owned. Project Membership
continues to provide its canonical observation and pilot preparation
contracts. `ProjectAuthorisationService` is not used to infer bootstrap state
and is not changed.

Neither command handler directly accesses a table, repository implementation,
RPC, browser route, or HTTP endpoint.

## 8. Artifact write and overwrite semantics

All prepared, success, and failure artifacts use one atomic writer:

1. Refuse an existing final output path by default.
2. Serialize complete credential-free JSON with stable formatting.
3. Create a temporary sibling file exclusively, with restrictive permissions
   where supported.
4. Write UTF-8 content and flush/close it.
5. Atomically rename the temporary sibling to the requested final path.
6. Remove the temporary file after a handled failure when safe.

There is no `--force` option in VS004-04C and no silent overwrite. If the
platform cannot provide the required exclusive-create and rename behavior,
the command fails rather than accepting a possibly partial or replaced
artifact. Cross-platform implementation must treat rename/replace behavior as
an explicit adapter concern and must verify that the final path was not
silently replaced.

An existing prepared artifact or result artifact is therefore preserved by
default. A failed temporary write never counts as an accepted final artifact.

## 9. Failure artifact semantics

If 04B fails after one or more safe outcomes, the execute command exits
nonzero, writes no success result, and attempts to write a separate
credential-free failure artifact at `<requested-result-path>.failed.json`.
The failure artifact includes only safe context: manifest ID/hash, run
correlation ID, bound target identity, failure category, failed operation when
known, completed outcomes, and safe timestamps/status. It does not serialize
the raw provider response, raw database error, credentials, or unauthorized
business rows.

Failure evidence is written only after execution has stopped; writing it does
not authorize another execution, mark the prepared artifact consumed, or
create a persistent execution ledger. If failure-artifact writing itself
fails, the process remains nonzero and emits a concise safe diagnostic that
the evidence could not be persisted. It must not replace the original
execution failure with a success status or attempt compensation.

Preflight failures do not produce an executable prepared artifact. If a
previous output path exists, it is not overwritten while reporting the
failure.

## 10. Runtime configuration and secrets

The implementation must reuse current configuration names and environment
validation:

| Purpose | Current name/boundary | Artifact/log rule |
| --- | --- | --- |
| Environment | `CADENCE_ENV` | target identity only; never secret |
| Supabase URL | `SUPABASE_URL` | target validation; not serialized as a secret-bearing config object |
| Supabase project reference | `CADENCE_SUPABASE_PROJECT_REF` | target identity only |
| Safe target marker | new 04C runtime target setting, proposed as `CADENCE_SAFE_TARGET_MARKER` because no committed equivalent exists | safe target metadata may be serialized only as target identity; never Project state |
| Server Supabase credential | `SUPABASE_SECRET_KEY` | runtime composition only; never artifact/log |
| Publishable application key | `SUPABASE_PUBLISHABLE_KEY` | runtime composition only; never artifact/log |
| First-account credential | existing protected runtime input such as `CADENCE_LOCAL_DEV_PASSWORD`, where required by 03A | runtime/provider input only; never artifact/log |

The proposed safe-marker variable is target metadata, not a new authority
store. Implementation must confirm there is no repository-standard name
before adding configuration wiring. No duplicate secret variable or provider
credential format is introduced.

Runtime configuration is independently loaded for each command. Execute does
not trust serialized credentials or configuration from the prepared artifact.

## 11. Logging and exit behavior

No existing stable numeric CLI taxonomy was found, so the initial design uses
exit code `0` for success and a nonzero exit code for every failure class:
invalid input, target failure, prepared-artifact failure, stale/conflict,
runtime composition failure, execution failure, or artifact write failure.
The implementation may introduce named internal categories without making
numeric codes part of the authority contract.

Preflight output is concise and safe and ends with:

```text
PREPARED — NOT EXECUTED
NO MUTATIONS PERFORMED
```

Execute output reports only safe summary facts: manifest ID, correlation ID,
CREATED/REUSED counts, and output path. It must not dump the complete
manifest, login lists unless operationally necessary, raw database rows,
provider responses, passwords, tokens, or arbitrary caught exception text.
Detailed safe evidence belongs in the artifacts.

## 12. Preserved execution boundaries

The operator runtime preserves these boundaries:

- 04A remains `READ ALL -> PLAN ALL -> PreparedPilotExecution -> STOP`.
- 04B remains the sole plan-bound mutation executor and independently
  re-reads/fails closed through module-owned services.
- The fixed 04B phase order remains Identity, Project, Project Health,
  Membership, ordinary roles, and protected roles.
- A prepared CREATE may return `REUSED` when exact state appeared; a prepared
  REUSE never upgrades to CREATE.
- No protected-role transfer is used for bootstrap reconciliation.
- There is no compensation, internal retry, new preflight, or stale-plan
  repair.
- Project Health is not written through Projects, and Project Membership is
  not written through the coordinator.
- `ProjectAuthorisationService` remains the sole normal application project
  authority. Bootstrap remains narrow, server-side, operator-only, and is not
  a browser or public HTTP authority path.

## 13. Implementation test strategy

Implementation must use isolated tests and must not execute bootstrap against
the validated local database. At minimum it must cover:

### Artifact utility

- valid `PreparedPilotExecution` round trip;
- malformed JSON and structurally invalid nested data;
- invalid credential-shaped fields and a credential scan;
- existing final output refusal;
- successful atomic write;
- write/rename failure leaves no accepted partial final artifact;
- success/result/failure artifacts remain credential-free.

### Preflight command

- manifest load and canonical validation;
- malformed manifest and target mismatch failures;
- exactly one 04A invocation;
- no 04B invocation or mutation-capable dependency in the handler;
- prepared artifact output and safe summary;
- nonzero status on every failure class.

### Execute command

- prepared-artifact-only loading;
- no separate manifest, planner, or 04A invocation;
- independent runtime target loading;
- exactly one 04B invocation;
- successful result artifact;
- partial execution failure artifact with completed outcomes;
- stale/conflict failure requires a new preflight;
- no retry, repair, overwrite, or compensation.

### Runtime composition and boundaries

- committed adapters/services are composed in the correct owning modules;
- 04A receives typed read-only observation views;
- 04B receives application preparation services only;
- no raw Supabase client, direct table access, membership RPC, HTTP route, or
  browser exposure is available to command handlers;
- no second authority model is introduced.

## 14. VS004, M1, VS005, and VS006 boundary

04C completes the controlled bootstrap operator mechanism: controlled manifest
input, reviewable read-only preflight, prepared execution transport, and
controlled mutation execution with audit evidence.

It does not complete M1 Pilot Activation. After VS004, VS005 still owns the
deployed runtime, HTTPS/CORS/environment production or pilot configuration,
and supervised worker scheduling/operation. VS006 still owns backup
technology, isolated restore proof, support ownership, and operational
recovery evidence. The complete live Discussion -> scheduled worker ->
proposal review -> Task -> My Tasks -> Audit journey remains subject to the
M1 activation/rehearsal gate after those capabilities are delivered.

`C01` remains outstanding overall and `C01.2` remains M2. This design does not
close C05, Entra/M3 commitments, external participation, or any other governed
commitment, and it moves no commitment beyond M3.

No migration, schema change, database reset, local live bootstrap, or package
command is part of this design-only checkpoint.

## 15. Design self-review checklist

- Preflight uses the canonical validator and 04A read-only orchestration; it
  cannot mutate.
- Execute consumes only a structurally validated prepared execution and calls
  04B; it cannot plan.
- Prepared, result, and failure artifacts exclude credentials and secrets.
- Atomic output refuses existing final paths and has no force/overwrite mode.
- Failure evidence preserves completed outcomes without becoming execution
  authority.
- Runtime composition, not CLI parsing, constructs adapters and services.
- No alternate authorization path, protected-role transfer reconciliation,
  browser route, migration, or database operation is introduced.
- VS005 and VS006 responsibilities and the M1 activation gate remain
  unchanged.
- The design contains no unresolved implementation question.

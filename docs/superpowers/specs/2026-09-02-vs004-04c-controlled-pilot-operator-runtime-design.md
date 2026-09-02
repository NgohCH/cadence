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
The current committed `PilotRuntimeTarget` type does not yet include
`projectId`; adding that required field and its safety checks is a prerequisite
before 04C operator implementation. The future validator must require
`runtimeTarget.projectId === manifest.project.id` in addition to the committed
environment, Supabase, and safe-marker checks. The safe-target marker is never
compared with a Project row.

`CADENCE_SUPABASE_PROJECT_REF` identifies the Supabase deployment target.
`CADENCE_PILOT_PROJECT_ID` independently identifies the Cadence Project that
the operator-selected runtime is allowed to target. The latter is target
metadata, not manifest authority, Project state, or application authorization.
The safety chain is:

```text
CADENCE_PILOT_PROJECT_ID
  -> PilotRuntimeTarget.projectId
  -> manifest.project.id
  -> PreparedPilotExecution.target.projectId
  -> 04B revalidation before mutation
```

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
`SUPABASE_SECRET_KEY`.

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
8. Wrap the returned `PreparedPilotExecution` in the current versioned
   prepared-artifact envelope, serialize it without credentials, and write it
   atomically.
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
5. Reserve the success-result and failure-evidence output sinks before any
   mutation. This includes checking both final paths, validating the parent
   directory and output capability, and proving exclusive temporary-file and
   no-overwrite publication semantics.
6. Build the phase-specific execution composition boundary only after output
   readiness succeeds.
7. Call `executeControlledPilot()` once with the loaded prepared execution.
8. Rely on 04B to recompute the manifest hash and revalidate the target,
   operation allowlist, plan consistency, and module-owned current state.
9. Wrap the credential-free `PilotExecutionResult` in the current versioned
   result envelope and atomically publish it through the already reserved
   success sink.
10. Print a concise safe summary containing manifest ID, run correlation ID,
   CREATED/REUSED counts, and result path.

The execute handler never loads a separate manifest, calls 04A, invokes
`buildPilotPreflightPlan()`, modifies the prepared plan, creates a replacement
correlation ID, retries stale execution, or repairs a conflict. A stale or
conflicting plan fails and requires a new preflight.

If output reservation cannot establish the required no-overwrite publication
semantics, execute fails before runtime composition and before any 04B call.
If 04B succeeds but success-artifact publication unexpectedly fails, the
process remains nonzero, performs no compensation or retry, and reports that
execution completed but durable success-artifact publication failed. It uses
the already reserved failure/evidence sink on a best-effort basis to preserve
the completed `PilotExecutionResult`; this condition is never reported as a
failure before mutation.

## 6. Prepared artifact contract

The serialized `PreparedPilotExecution` remains the canonical authority
payload. Its transport envelope is:

```json
{
  "artifactType": "cadence.vs004.prepared-pilot-execution",
  "formatVersion": 1,
  "preparedExecution": "<exact PreparedPilotExecution>"
}
```

The envelope is thin and non-authoritative: it adds no operations, identity,
or authority. 04B receives the exact inner `PreparedPilotExecution`.
04C does not invent a competing authority schema or a consumed-artifact
ledger. The payload fields are the exact committed fields listed in Section
2.2. In particular, the artifact binds the validated manifest, its
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

The current prepared envelope is `formatVersion: 1`. Execute rejects a wrong
`artifactType`, a missing version, or any unsupported version before runtime
composition or mutation. It does not silently migrate an unknown or future
prepared-artifact version. The same structural rules apply when the envelope
is read from disk as when the inner payload is validated.

VS004 artifacts are not cryptographically signed. For the M1 controlled pilot,
operator access and the operator filesystem are trusted boundaries. Structural
validation detects malformed or incompatible transport, while 04B verifies
semantic plan integrity, current target, and current state. VS004 does not
claim to protect against a malicious privileged operator deliberately forging a
new internally consistent artifact. Cryptographic signing or an enterprise
execution registry requires separate future change control.

## 7. Runtime composition boundary

Implementation will introduce dedicated phase-specific composition boundaries,
separate from CLI parsing. The expected responsibilities are:

```text
buildControlledPilotObservationRuntime(configuration, factories)
  -> current environment/configuration validation
  -> typed read-only observation views for 04A

buildControlledPilotExecutionServices(configuration, factories)
  -> provider and database adapter construction
  -> Identity/Projects/Health/Membership preparation services for 04B
```

The implementation boundary is:

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
Supabase client. Mutation-capable services are not constructed by the
preflight composition and are not constructed by execute until output
readiness has succeeded.

Both builders accept one explicit injected factory bundle for deterministic
tests. The bundle can construct the server-side Supabase client, administrative
Auth provider, module repositories/adapters, observation views, and preparation
services. Production defaults use the committed concrete constructors; tests
provide fakes without module-global monkeypatching. Raw clients remain private
to composition and never cross into either command handler.

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

All prepared, success, and failure artifacts use one atomic writer and an
execution output reservation abstraction. Conceptually, the reservation
provides `reserveExecutionOutputs(successPath, failurePath)`, exclusive
temporary/reservation resources for both destinations, and publication or
cleanup operations. It is a transport/file capability, not an execution
authority.

Before 04B is constructed or invoked, the execute command must:

1. Refuse an existing success final path.
2. Refuse an existing failure final path when it would prevent required
   failure evidence.
3. Validate the parent directory, permissions, and output capability.
4. Create required sibling temporary/reservation resources exclusively.
5. Establish same-directory hard-link publication capability and prove that
   final publication cannot silently replace an existing artifact.
6. Fail before mutation if the platform cannot provide these semantics.

After this reservation succeeds, all prepared, success, and failure artifacts
use the reserved atomic writer:

1. Serialize complete credential-free JSON with stable formatting.
2. Write to the reserved temporary sibling file with restrictive permissions
   where supported.
3. Call `FileHandle.sync()` and close it.
4. Publish by hard-linking the completed sibling temporary file to the final
   path, which fails with an existing-destination error rather than replacing
   the destination.
5. Unlink the temporary sibling after successful publication and remove
   temporary/reservation files after a handled failure when safe.

There is no `--force` option in VS004-04C and no silent overwrite. On the
validated Windows environment (`win32 x64`, Node `v24.13.0`, npm `11.19.1`),
`open(path, "wx")` and `link(temp, final)` both reject an existing destination
with `EEXIST`, while `rename(temp, final)` replaces an existing destination.
Therefore replacement `rename()` is prohibited as the final publication
primitive. The temporary file must be a sibling of the final file so the hard
link is on the same filesystem.

The readiness boundary cannot prevent an uncooperative external process from
creating the final path after readiness succeeds. If that race occurs after
mutation begins, `link()` returns an existing-destination failure and the
post-success publication-failure semantics apply. Unsupported hard links,
network/FAT filesystems, permission failures, or any platform unable to
provide the same no-replace guarantee fail before 04B; the implementation must
not fall back to replacement rename or copy semantics.

An existing prepared artifact, result artifact, or required failure artifact is
therefore preserved by default. A failed temporary write never counts as an
accepted final artifact. The implementation plan must audit the exact
cross-platform reservation and rename mechanism.

## 9. Failure artifact semantics

If 04B fails after one or more safe outcomes, the execute command exits
nonzero, writes no success result, and publishes a separate credential-free
failure artifact at `<requested-result-path>.failed.json` through the already
reserved failure sink.
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

If 04B completes successfully but publishing the success artifact fails, the
failure/evidence sink is used on a best-effort basis for a failure envelope
whose safe evidence records `executionCompleted`, the success-publication
failure, and the completed `PilotExecutionResult`. The process remains
nonzero, does not rerun 04B or start a new preflight, and does not claim that
execution failed before mutation. If this evidence publication also fails,
the process reports both the completed execution and the inability to persist
durable evidence.

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
| Safe target marker | `CADENCE_SAFE_TARGET_MARKER` | safe target metadata may be serialized only as target identity; never Project state |
| Cadence pilot Project ID | `CADENCE_PILOT_PROJECT_ID` | independent non-secret target assertion; may appear in credential-free target evidence; never Project authority |
| Server Supabase credential | `SUPABASE_SECRET_KEY` | runtime composition only; never artifact/log |
| First-account credential | existing protected runtime input such as `CADENCE_LOCAL_DEV_PASSWORD`, where required by 03A | runtime/provider input only; never artifact/log |

`CADENCE_SAFE_TARGET_MARKER` is target metadata, not a new authority store.
It remains unrelated to Project database state. No duplicate secret variable or
provider credential format is introduced.

Runtime configuration is independently loaded for each command. Execute does
not trust serialized credentials or configuration from the prepared artifact.

## 11. Result and failure transport envelopes

The successful result uses the committed `PilotExecutionResult` as its exact
authority payload in this thin envelope:

```json
{
  "artifactType": "cadence.vs004.pilot-execution-result",
  "formatVersion": 1,
  "result": "<exact PilotExecutionResult>"
}
```

Failure evidence uses an analogous thin envelope:

```json
{
  "artifactType": "cadence.vs004.pilot-execution-failure",
  "formatVersion": 1,
  "failure": "<credential-free failure evidence>"
}
```

The failure payload contains the committed safe error context and completed
outcomes. In the exceptional post-success-publication case it additionally
records that execution completed and carries the completed result as safe
evidence. These envelopes add no operations or execution authority. Readers
reject wrong artifact types, missing versions, and unsupported future versions
without silently migrating them.

## 12. Logging and exit behavior

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

## 13. Preserved execution boundaries

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

## 14. Implementation test strategy

Implementation must use isolated tests and must not execute bootstrap against
the validated local database. At minimum it must cover:

### Artifact utility

- valid `PreparedPilotExecution` round trip;
- malformed JSON and structurally invalid nested data;
- invalid credential-shaped fields and a credential scan;
- existing final output refusal;
- existing result output fails before any 04B call;
- unavailable output directory/publication capability fails before 04B;
- existing failure-evidence destination fails before mutation when it would
  prevent required evidence;
- successful atomic write;
- write/rename failure leaves no accepted partial final artifact;
- success/result/failure artifacts remain credential-free.
- unexpected success-artifact publication failure preserves completed outcomes
  through the reserved failure/evidence sink without compensation or retry.
- valid current prepared/result/failure envelope versions;
- wrong artifact type, missing version, and unsupported future version;
- prepared payload is unchanged through envelope round trip;
- unsupported prepared artifact is rejected before 04B.
- `CADENCE_PILOT_PROJECT_ID` mismatch fails before planning or mutation, while
  an exact project-target match succeeds.
- final publication uses the no-replace hard-link contract and never uses
  replacement `rename()` semantics.

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
- success-publication failure after successful 04B is distinguished from
  execution failure and preserves safe completed evidence;
- stale/conflict failure requires a new preflight;
- no retry, repair, overwrite, or compensation.

### Runtime composition and boundaries

- committed adapters/services are composed in the correct owning modules;
- 04A receives typed read-only observation views;
- 04B receives application preparation services only;
- no raw Supabase client, direct table access, membership RPC, HTTP route, or
  browser exposure is available to command handlers;
- no second authority model is introduced.

### Observation completeness and target safety

- 04A obtains project-wide role assignments through the existing
  `ProjectRoleAssignmentReadRepository.listRoleAssignmentsForProject()` port
  in addition to membership and protected-transfer reads.
- Assignments that cannot be matched to an observed membership are retained
  as evidence and cause fail-closed preflight validation; they are never
  filtered out.
- A prepared Project ID mismatch against independently loaded
  `CADENCE_PILOT_PROJECT_ID` fails before 04B.

## 15. VS004, M1, VS005, and VS006 boundary

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

## 16. Design self-review checklist

- Preflight uses the canonical validator and 04A read-only orchestration; it
  cannot mutate.
- Runtime target identity includes the independently loaded
  `CADENCE_PILOT_PROJECT_ID`, and it is checked against the manifest and
  prepared target.
- 04A observes project-wide role assignments and fails closed on unmappable
  or contradictory assignments.
- Execute consumes only a structurally validated prepared execution and calls
  04B; it cannot plan.
- Prepared, result, and failure artifacts exclude credentials and secrets.
- Prepared, result, and failure artifacts use explicit type/version envelopes;
  unknown versions are rejected without migration.
- Execute reserves success and failure output sinks before 04B; post-success
  publication failure is reported as completed execution with evidence loss,
  never as pre-mutation failure.
- Atomic output uses same-directory hard-link publication, refuses existing
  final paths, and has no force/overwrite mode; replacement `rename()` is not
  used.
- Failure evidence preserves completed outcomes without becoming execution
  authority.
- Runtime composition, not CLI parsing, constructs adapters and services.
- No alternate authorization path, protected-role transfer reconciliation,
  browser route, migration, or database operation is introduced.
- VS005 and VS006 responsibilities and the M1 activation gate remain
  unchanged.
- The design contains no unresolved implementation question.

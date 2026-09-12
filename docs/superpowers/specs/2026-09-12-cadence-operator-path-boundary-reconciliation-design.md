# Cadence Operator Path Boundary Reconciliation

**Status: APPROVED DESIGN AMENDMENT — IMPLEMENTATION NOT STARTED**

## Purpose and chronology

The original operator-path architecture established the repository root as
the stable namespace for filesystem paths supplied to root-exposed Cadence
management commands. Tasks 1–3 implemented that CLI boundary normalization.

During Task 4 acceptance inspection, an additional requirement was identified:
independent proof that every APPLY, VERIFY, and ROLLBACK programmatic API
preserves explicit filesystem paths under changed `cwd` and `INIT_CWD`.
Repeated test attempts established that those APIs do not own filesystem
paths. Filesystem paths are CLI/tooling concerns; downstream APIs consume
already-loaded domain, configuration, and evidence objects. Adding paths to
those APIs solely to make a test observable would worsen the architecture.

This is a design-to-interface acceptance mismatch, not an implementation
defect. A controlled architectural reconciliation is therefore approved.

T15-B remains **BLOCKED**. T15-C remains **NOT AUTHORIZED**.

## Actual boundary ownership

### Path-bearing CLI/tooling boundaries

The following boundaries own operator filesystem strings and their meaning:

- `cadence:deploy:plan` CLI;
- `cadence:deploy:apply` CLI;
- `cadence:deploy:verify` CLI;
- `cadence:rollback` CLI;
- `cadence:setup:check`, which remains the existing transport alias through
  the deploy-plan CLI.

These boundaries establish the Cadence repository root, call
`resolveCadenceOperatorPath()`, and own relative-path normalization,
absolute-path preservation, canonical `<repo>/.cadence` evidence ownership,
artifact/config loading, and output paths. They are independent of operator
`cwd` and `INIT_CWD`.

### Path-free downstream APIs

The programmatic/application APIs intentionally consume domain data rather
than operator filesystem strings:

- `applyVs005Deployment(...)` consumes plan/config/domain data plus injected
  provider, artifact-preparation, and dry-run dependencies;
- `verifyVs005Deployment(...)` consumes deployment/config data plus injected
  readers and verification dependencies;
- `rollbackVs005Application(...)` consumes rollback request, deployment
  evidence, and config data plus injected provider and verifier dependencies.

None of these APIs has an operator filesystem-path parameter. Their existing
provider, validation, mutation-gate, rollback-target, and database-action
contracts remain unchanged.

## Authoritative boundary rule

> Path-bearing tooling APIs retain explicit-path semantics. Path-free domain/
> programmatic APIs remain path-free. Neither boundary may acquire operator
> `cwd` or repository-root authority outside its intended responsibility.

CLI/tooling resolves each operator path exactly once at the command boundary.
Already-loaded domain/configuration/evidence data then crosses into the
downstream API. Downstream APIs do not reconstruct or reinterpret operator
paths. No filesystem path is introduced into a downstream API solely to make
an acceptance test observable.

## Acceptance and evidence model

### Path-bearing boundary evidence

CLI/tooling tests must prove, for all five root-exposed command names:

- repository-root authority and exact `cadence`/`api`/`web` identity markers;
- relative-path normalization and native absolute-path preservation;
- spaces and dot-segment behavior;
- equivalent results from repository-root, `apps/api`, and unrelated cwd;
- conflicting `INIT_CWD` has no authority;
- canonical output is under `<repo>/.cadence`, never authoritative under
  `apps/api/.cadence`;
- root-establishment failure occurs before downstream work or output;
- exact resolved paths reach the existing loading and writing boundaries.

### Path-free API evidence

For `applyVs005Deployment`, `verifyVs005Deployment`, and
`rollbackVs005Application`, tests and structural audits must prove:

- public signatures contain no operator filesystem-path parameters;
- the APIs do not import or call `resolveCadenceRepositoryRoot()` or
  `resolveCadenceOperatorPath()`;
- the APIs do not inspect `process.cwd()` or `INIT_CWD`;
- they consume domain/configuration/evidence inputs and existing injected
  dependencies;
- existing provider/domain behavior remains covered by its established tests.

Absence of filesystem-path semantics is valid architectural evidence here.
A runtime test cannot be required to observe a path that does not exist in the
API contract.

## Superseded acceptance wording

Only the following interpretations from the original design/plan are
superseded, and only where they imply that every downstream API is
path-bearing:

- global wording that programmatic/application/domain APIs “retain explicit
  path semantics”;
- the Task 4 blanket requirement for “programmatic explicit-path APIs”.

The original design and implementation plan remain historical and
authoritative in all other respects. They are not edited by this amendment.
Tasks 1–3 are not reopened generally; their CLI boundary behavior remains the
approved implementation to be verified under the corrected evidence model.

## Rejected alternatives

1. Adding filesystem-path parameters to APPLY, VERIFY, or ROLLBACK would leak
   CLI concerns into path-free domain interfaces solely for testing.
2. Adding production callbacks or path observers would create a production
   seam that exists only to satisfy evidence rather than application behavior.
3. Adding repository-root or cwd injection to downstream APIs would introduce
   the operator-path authority the architecture explicitly excludes.
4. Treating equal early-rejection behavior under changed cwd as path proof is
   invalid because it does not prove valid-path preservation.

## Disposition of existing probes

Tests introduced while investigating programmatic cwd/`INIT_CWD` independence
must not be described as explicit-path proof unless they actually observe
filesystem paths at a path-bearing boundary. The later implementation-plan
amendment must inspect those probes and either retain them only for behavior
they genuinely prove or remove them when they add no meaningful regression
value. No production change is required merely because an insufficient probe
was written.

## Corrected Task 4 acceptance

Task 4 remains verification-only. Its first step must confirm that committed
Task 1–3 evidence covers:

**Path-bearing CLI/tooling:** all five command names, the path-normalization
matrix, cwd/`INIT_CWD` independence, root-marker failure, exact downstream
absolute path arguments, and canonical evidence ownership.

**Path-free domain/programmatic:** no filesystem-path parameters, no
repository-root/operator-path resolver dependency, no cwd/`INIT_CWD`
dependency, and domain/configuration/evidence-only semantics.

The existing consolidated tests, local recertification, and authority audit
remain required. A failed acceptance check returns to the owning Task 1, 2,
or 3 boundary; Task 4 itself does not patch behavior.

## Boundary Reality Check

Future plans must apply a **Boundary Reality Check** before freezing
interface-specific acceptance criteria. Each requirement must map an
acceptance obligation to its owning production boundary, actual production
inputs, and a legitimate observable evidence point.

The check confirms that:

1. the named boundary exists;
2. the required data actually crosses it;
3. a legitimate evidence point can observe that data; and
4. testing does not require adding production semantics merely to make the
   evidence observable.

Never infer that a downstream API owns a concern merely because the CLI above
it owns that concern. This is planning discipline, not a new governance layer.

## Unchanged invariants and authority

This amendment preserves the original operator-path architecture, shared
repository-root resolver, canonical `<repo>/.cadence` root, and
non-authoritative `apps/api/.cadence` status. It preserves the prohibition on
`process.chdir()`, provider semantics and structured-inspection authority,
Cloudflare target/origin/permission rules, rollback-target rules, database
action `NONE`, canonical config and migrations, historical evidence, and all
frozen VS005 records.

Governance remains 44 governed parents and 178 child traceability records;
removed commitments remain 0 and no requirement is moved beyond M3.

T15-B remains **BLOCKED** pending separately authorized provider reinspection.
T15-C remains **NOT AUTHORIZED**. Pilot Activation remains **NOT AUTHORIZED**.
This design amendment authorizes no provider, database, deployment, rollback,
hosted, clean-room, or mutation action.

## Success criteria

The amendment is complete when it clearly establishes that:

1. filesystem path ownership is confined to path-bearing tooling boundaries;
2. downstream APPLY/VERIFY/ROLLBACK APIs remain intentionally path-free;
3. acceptance evidence matches actual interfaces;
4. no production seam or interface change is required;
5. the original approved records remain immutable;
6. Task 4 can be restarted under the corrected evidence semantics; and
7. governance, security, and runtime behavior are unchanged.

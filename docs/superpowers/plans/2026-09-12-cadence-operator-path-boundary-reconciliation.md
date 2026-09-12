# Cadence Operator Path Boundary Reconciliation Plan

> **For agentic workers:** Read the approved design and execute this plan task-by-task with review checkpoints. Task A may change only the three named test files; Task B is verification-only.

**Goal:** Reconcile Task 3/Task 4 evidence with the actual split between path-bearing CLI/tooling boundaries and path-free domain APIs, without changing production behavior.

**Architecture:** Root-exposed CLI wrappers establish the repository root and normalize operator paths once. `runVs005DeployPlan({ configPath, outputPath }, ...)` remains a path-bearing tooling API that uses explicit paths without resolving operator authority. APPLY, VERIFY, and ROLLBACK domain APIs remain path-free and consume loaded objects.

**Tech Stack:** Node.js, TypeScript, `node:test`, `tsx`, npm scripts, Git.

**Spec:** `docs/superpowers/specs/2026-09-12-cadence-operator-path-boundary-reconciliation-design.md` (SHA256 `74d330568d05f7f086573fd0c01590d63bd2042aa31b5aa196ab6c189a9855aa`).

**Original plan preserved:** `docs/superpowers/plans/2026-09-11-cadence-operator-path-contract-reconciliation.md` (SHA256 `82b59a6ef5a86c1488b73fe9ed723adb6f8659ca10656629bcea86d230835ea1`).

## Global constraints

- This is a narrow additive amendment; it supersedes only the contradictory acceptance interpretation that treated every programmatic/application/domain API as path-bearing.
- Do not modify the original design, original plan, production source, configuration, migrations, provider code, package files, HANDOFF, governance records, or historical evidence.
- Category 1 is the five root-exposed CLI wrappers (`cadence:setup:check`, `cadence:deploy:plan`, `cadence:deploy:apply`, `cadence:deploy:verify`, and `cadence:rollback`). They own repository-root establishment, relative operator-path interpretation, `resolveCadenceOperatorPath()`, cwd/`INIT_CWD` independence, and canonical `<repo>/.cadence` interpretation.
- Category 2 is path-bearing tooling API `runVs005DeployPlan({ configPath, outputPath }, ...)`. It retains explicit-path semantics, receives resolved paths from the CLI, and does not establish repository identity or reinterpret paths through cwd metadata.
- Category 3 is path-free domain APIs `applyVs005Deployment(...)`, `verifyVs005Deployment(...)`, and `rollbackVs005Application(...)`. They consume loaded domain/config/evidence objects and must not gain filesystem-path semantics for testing.
- No provider access, database operation, deployment, rollback execution, hosted Cadence call, clean-room work, or Pilot Activation is authorized. T15-B remains BLOCKED; T15-C and Pilot Activation remain NOT AUTHORIZED.
- Governance remains 44 governed parents and 178 child traceability records; removed commitments remain 0 and nothing moves beyond M3.

---

### Task A: Reconcile Task 3 programmatic evidence probes

**Files:**

- Modify only when the chosen removal is executed: `apps/api/scripts/vs005-deploy-apply.test.ts`
- Modify only when the chosen removal is executed: `apps/api/scripts/vs005-deploy-verify.test.ts`
- Modify only when the chosen removal is executed: `apps/api/scripts/vs005-rollback.test.ts`
- Inspect production signatures only: `apps/api/scripts/vs005-deploy-apply.ts`, `apps/api/scripts/vs005-deploy-verify.ts`, `apps/api/scripts/vs005-rollback.ts`

**Interfaces consumed:**

- `applyVs005Deployment(input)` accepts plan/config/domain data and injected provider, preparation, and dry-run dependencies.
- `verifyVs005Deployment(input)` accepts deployment/config data and injected readers.
- `rollbackVs005Application(input)` accepts rollback request/evidence/config data and injected provider/verifier dependencies.

**Chosen disposition: REMOVE all three investigation probes.**

Remove these exact tests from their respective files:

- `apply programmatic API is independent of caller cwd and INIT_CWD`
- `verify programmatic API is independent of caller cwd and INIT_CWD`
- `rollback programmatic API is independent of caller cwd and INIT_CWD`

They invoke the real functions, but pass empty/invalid domain objects, terminate at early validation, observe only bounded rejection/equal stdout, and never supply or observe filesystem paths at an API dependency boundary. They therefore add no distinct path evidence and duplicate existing domain validation tests. The path-bearing CLI tests and existing valid domain/provider tests remain the meaningful evidence.

- [ ] **Step 1: Verify the probe disposition before editing.**

  **CWD: repository root**

  Inspect the three probe titles and the production signatures. Confirm each probe has the exact empty/invalid invocation described above, and confirm none of the three programmatic signatures contains a filesystem-path parameter. Do not edit production code or add a replacement probe.

  Also run this boundary-specific source inspection from the repository root:

  ```text
  rg -n "resolveCadenceRepositoryRoot|resolveCadenceOperatorPath|process\.cwd\(\)|INIT_CWD|applyVs005Deployment|verifyVs005Deployment|rollbackVs005Application" apps/api/scripts/vs005-deploy-apply.ts apps/api/scripts/vs005-deploy-verify.ts apps/api/scripts/vs005-rollback.ts
  ```

  Read the surrounding signatures and implementation, not only the matching lines. For each of `applyVs005Deployment(...)`, `verifyVs005Deployment(...)`, and `rollbackVs005Application(...)`, record PASS only when its public/programmatic signature has no operator filesystem-path parameter, it has no import or call of either operator-path resolver, it has no operator path interpretation through `process.cwd()` or `INIT_CWD`, and its inputs remain domain/config/evidence/provider-oriented. Resolver matches in the CLI-wrapper portions are permitted and are not evidence of leakage into the path-free domain function.

- [ ] **Step 2: Remove only the three probes.**

  Delete the one named test block from each of the three allowed test files. Preserve all existing fixtures, valid domain/provider tests, CLI cwd/path tests, and root-failure probes. Do not alter production files.

- [ ] **Step 3: Run focused tests.**

  **CWD: apps/api**

  ```text
  node --import tsx --test scripts/vs005-deploy-apply.test.ts scripts/vs005-deploy-verify.test.ts scripts/vs005-rollback.test.ts
  ```

  Expected result: PASS with zero failures. The removed probes must no longer appear; all remaining CLI, root-failure, provider, validation, and rollback tests must pass.

- [ ] **Step 4: Run scripts typecheck.**

  **CWD: apps/api**

  ```text
  npm.cmd exec -- tsc --noEmit -p tsconfig.scripts.json
  ```

  Expected result: PASS with no diagnostics.

- [ ] **Step 5: Run the Task 3 command-level regression.**

  **CWD: apps/api**

  ```text
  node --import tsx --test scripts/vs005-package-wiring.test.ts scripts/vs005-local-deployment-readiness.test.ts scripts/vs005-deploy-plan.test.ts scripts/vs005-deploy-apply.test.ts scripts/vs005-deploy-verify.test.ts scripts/vs005-rollback.test.ts scripts/vs005-deployment-artifacts.test.ts
  ```

  Expected result: all tests pass with zero provider/database operations.

- [ ] **Step 6: Audit and commit the isolated test cleanup.**

  **CWD: repository root**

  Run:

  ```text
  git diff --check
  git diff --name-only
  git diff -- apps/api/scripts/vs005-deploy-apply.test.ts apps/api/scripts/vs005-deploy-verify.test.ts apps/api/scripts/vs005-rollback.test.ts
  ```

  Confirm only the three allowed test files changed, with only the three named probe blocks removed. Confirm production files, Task 1/2 files, package wiring, provider, config, database, governance, and frozen records are unchanged.

  If a test edit occurred, commit exactly:

  ```text
  git add apps/api/scripts/vs005-deploy-apply.test.ts apps/api/scripts/vs005-deploy-verify.test.ts apps/api/scripts/vs005-rollback.test.ts
  git diff --cached --check
  git commit -m "test(cadence): reconcile programmatic path evidence"
  ```

  If inspection proves the blocks are already absent, make no edit and create no empty commit; record that Task A was verification-only.

**Task A acceptance:** The three invalid early-rejection probes are removed, or demonstrably absent with no empty commit; no production seam or API change exists; valid domain/provider behavior and path-bearing CLI evidence remain covered.

**Task A review gate:** After Task A verification and any tests-only commit, stop and request an independent review. Record:

```text
TASK_A_COMPLETE
AWAITING_TASK_A_REVIEW
```

Task B may begin only after that review returns Critical = 0, Important = 0, Task A contract compliance = YES, and `READY_FOR_TASK_B`. Task A completion alone does not authorize Task B.

---

### Task B: Corrected Task 4 acceptance and full local recertification

**Files:**

- Inspect only the Task 1-3 tests and production boundaries listed in the original plan.
- Do not modify source, tests, HANDOFF, governance, config, migrations, frozen records, or historical `.cadence/vs005/t15a-local-readiness.json`.

**Interfaces consumed:**

- Category 1 root-exposed CLI wrappers and their shared resolver evidence.
- Category 2 `runVs005DeployPlan({ configPath, outputPath }, ...)` explicit-path tooling contract.
- Category 3 path-free APPLY/VERIFY/ROLLBACK domain contracts.

Task B is verification-only. It adds no behavior, tests, or commit. If any check fails, stop and return to the owning Task 1, Task 2, Task 3, or Task A boundary; do not patch during Task B.

- [ ] **Step 1: Inspect the three evidence categories.**

  **CWD: repository root**

  Confirm Category 1 tests collectively cover all five command names, exact `cadence`/`api`/`web` markers, repository-root/`apps/api`/unrelated cwd equivalence, `INIT_CWD`, native Windows/POSIX paths, relative and absolute paths, spaces, dot segments, root failure, no production `process.chdir()`, canonical `<repo>/.cadence`, non-authoritative `apps/api/.cadence`, and exact resolved load/write paths.

  Confirm Category 2 by inspecting `runVs005DeployPlan` and its tests: its `{ configPath: string; outputPath: string }` parameters exist, explicit paths are passed to the existing load/write dependencies, CLI callers provide resolved paths, and the function does not call either resolver or inspect cwd metadata.

  Confirm Category 3 signatures contain no filesystem-path parameters and their source imports/calls neither resolver, `process.cwd()`, nor `INIT_CWD`; existing domain/config/evidence and injected provider/reader tests remain authoritative.

  Run:

  ```text
  rg -n "resolveCadenceRepositoryRoot|resolveCadenceOperatorPath|process\.cwd\(\)|INIT_CWD|process\.chdir\(|apps/api/.cadence|runVs005DeployPlan|applyVs005Deployment|verifyVs005Deployment|rollbackVs005Application" apps/api/scripts/cadence-operator-path.ts apps/api/scripts/vs005-deploy-plan.ts apps/api/scripts/vs005-deploy-apply.ts apps/api/scripts/vs005-deploy-verify.ts apps/api/scripts/vs005-rollback.ts
  ```

  Interpret imports/calls by boundary: resolver calls belong only in CLI wrappers; `runVs005DeployPlan` may use explicit parameters but not resolver authority; path-free APIs must have no operator-path dependency. Textual matches in tests or legitimate CLI imports are not failures.

- [ ] **Step 2: Run consolidated acceptance.**

  **CWD: apps/api**

  ```text
  node --import tsx --test scripts/cadence-operator-path.test.ts scripts/vs005-package-wiring.test.ts scripts/vs005-deploy-plan.test.ts scripts/vs005-deploy-apply.test.ts scripts/vs005-deploy-verify.test.ts scripts/vs005-rollback.test.ts
  ```

  Expected result: zero failures. This is the corrected three-category acceptance gate; do not require runtime observation of nonexistent paths in path-free APIs.

- [ ] **Step 3: Run the complete structured/VS005 suite.**

  **CWD: apps/api**

  ```text
  node --import tsx --test src/bootstrap/cadence-config.test.ts src/bootstrap/cadence-release.test.ts src/bootstrap/cadence-target-policy.test.ts src/runtime/create-cadence-app.test.ts scripts/vs005-cloudflare-readonly-transport.test.ts scripts/vs005-cloudflare-current-deployment.test.ts scripts/vs005-cloudflare-worker-settings.test.ts scripts/vs005-cloudflare-cron-inspection.test.ts scripts/vs005-cloudflare-version-inspection.test.ts scripts/vs005-cloudflare-hostname-inspection.test.ts scripts/vs005-cloudflare-structured-inspection.test.ts scripts/vs005-local-deployment-readiness.test.ts scripts/vs005-provider-observations.test.ts scripts/vs005-cloudflare-deployment-provider.test.ts scripts/vs005-deployment-artifacts.test.ts scripts/vs005-deploy-plan.test.ts scripts/vs005-deploy-apply.test.ts scripts/vs005-deploy-verify.test.ts scripts/vs005-rollback.test.ts scripts/vs005-generate-deployment.test.ts scripts/vs005-generate-web-config.test.ts scripts/vs005-beta-config.test.ts scripts/vs005-package-wiring.test.ts scripts/vs005-t15a-readiness.test.ts
  ```

  Expected result: all tests pass; no provider request is made by these fixtures.

- [ ] **Step 4: Run VS003 and the complete VS004 suite.**

  **CWD: apps/api**

  ```text
  node --import tsx --test scripts/bootstrap-vs003-runtime.test.ts
  node --import tsx --test scripts/vs004-controlled-pilot-artifact.test.ts scripts/vs004-controlled-pilot-execute-cli.test.ts scripts/vs004-controlled-pilot-execute-command.test.ts scripts/vs004-controlled-pilot-execution.test.ts scripts/vs004-controlled-pilot-file.test.ts scripts/vs004-controlled-pilot-observation-adapters.test.ts scripts/vs004-controlled-pilot-package.test.ts scripts/vs004-controlled-pilot-preflight.test.ts scripts/vs004-controlled-pilot-preflight-cli.test.ts scripts/vs004-controlled-pilot-preflight-command.test.ts scripts/vs004-controlled-pilot-runtime.test.ts scripts/vs004-controlled-pilot-runtime-config.test.ts scripts/vs004-pilot-manifest.test.ts scripts/vs004-preflight.test.ts
  ```

  Record both summaries; neither command authorizes provider or database work.

- [ ] **Step 5: Run repository quality gates.**

  **CWD: repository root**

  Run each command separately and require PASS:

  ```text
  npm.cmd --prefix apps/api run typecheck
  npm.cmd --prefix apps/api test
  npm.cmd run api:scripts:typecheck
  npm.cmd --prefix apps/web test
  npm.cmd --prefix apps/web run lint
  npm.cmd --prefix apps/web run build:beta
  npm.cmd --prefix apps/api run vs005:generate:ci
  npm.cmd --prefix apps/runtime-cloudflare test
  npm.cmd --prefix apps/runtime-cloudflare run typecheck
  npm.cmd --prefix apps/runtime-cloudflare run deploy:dry-run
  ```

  The Wrangler command is local dry-run only. Do not run any live deploy-plan, deploy-apply, deploy-verify, or rollback command.

- [ ] **Step 6: Audit immutability, authority, and governance.**

  **CWD: repository root**

  Run:

  ```text
  git diff --check
  git status -sb
  git diff --name-only
  rg -n "cadence:setup:check|cadence:deploy:plan|cadence:deploy:apply|cadence:deploy:verify|cadence:rollback" package.json apps/api/package.json apps/api/scripts/vs005-package-wiring.test.ts
  ```

  Confirm no provider, database, config, migration, package-script, frozen-document, HANDOFF, or governance change; historical evidence is untouched; governance is 44/178; T15-B remains BLOCKED; T15-C and Pilot Activation remain NOT AUTHORIZED.

- [ ] **Step 7: Record the verification-only outcome.**

  If every Task B gate passes, record `TASK_4_LOCAL_RECERTIFICATION_PASS` and `READY_FOR_TASK_5`. Do not create a Task B commit. If any gate fails, record the failed command and return to its owning boundary without patching Task B.

**Task B acceptance:** The three-category evidence model is verified, all consolidated/local gates pass, and no Task B file or commit is created.

## Resumption of original Task 5

After Task B passes, resume Task 5 unchanged from the original plan. Its HANDOFF/change-control entry may cross-reference the original design and plan, this approved design amendment and its hash, this amendment plan and its hash, the Task A reconciliation commit if one exists, and the Task B recertification result. Do not execute Task 5 as part of this plan-writing operation.

## Boundary Reality Check

Before freezing any interface-specific acceptance requirement, map the
acceptance obligation, owning production boundary, actual production inputs,
and legitimate observable proof. Confirm that the boundary exists, the data
crosses it, an evidence point can observe it, and testing does not require
adding production semantics solely for observability.

Never infer that a downstream API owns a concern merely because the CLI above
it owns that concern. This is planning discipline, not a governance baseline
change.

## Plan self-review checklist

- [ ] Every section of the approved reconciliation design maps to Task A or Task B.
- [ ] No requirement is orphaned; the three categories and corrected evidence model are explicit.
- [ ] No placeholder or unresolved disposition appears.
- [ ] Every command has an explicit working directory.
- [ ] Task B is verification-only and has no patch or commit step.
- [ ] Original Task 5 remains authoritative and is only cross-referenced.
- [ ] T15-B/T15-C/Pilot Activation remain blocked or unauthorized as stated.
- [ ] Original design and original implementation plan remain unmodified.

# Cadence Operator Path Contract Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every initial root-exposed Cadence management CLI resolve relative operator filesystem paths from the proven repository root while preserving absolute paths and canonical evidence ownership.

**Architecture:** Add one CLI/tooling resolver whose root identity is derived from the shared module location and verified by the exact `cadence`, `api`, and `web` package markers. Each CLI normalizes parsed path arguments immediately and passes absolute paths to its existing application boundary; no downstream API gains cwd authority.

**Tech Stack:** Node.js 24, TypeScript, `node:path`, `node:fs`, existing `node --import tsx` CLIs, Node test runner, npm package scripts.

**Spec:** `docs/superpowers/specs/2026-09-11-cadence-operator-path-contract-reconciliation-design.md` (SHA-256 `6a40f26362fe4de11eff9589b33d2a69769af2f782cbcfbb790e916b7c2405bf`)

## Global Constraints

- Relative operator paths resolve from the proven Cadence repository root.
- Absolute operator paths remain absolute.
- Root identity is derived from the shared module location; do not use `process.cwd()`, `INIT_CWD`, npm/package cwd, shell cwd, Git, or upward package search.
- Verify exact package identities: root `package.json.name = "cadence"`, `apps/api/package.json.name = "api"`, and `apps/web/package.json.name = "web"`.
- Do not call `process.chdir()`.
- Root package scripts remain execution transport only; do not rewrite package scripts for path policy.
- The shared resolver contract is exactly `resolveCadenceOperatorPath({ repositoryRoot, inputPath })` and has no semantic path-kind parameter.
- Canonical evidence is `<repository>/.cadence/`; `apps/api/.cadence` is non-authoritative diagnostic residue.
- Historical evidence is not silently migrated, deleted, overwritten, or relabeled.
- Programmatic/application/domain APIs retain explicit path semantics and do not inspect operator cwd metadata.
- Initial migration covers `cadence:setup:check`, `cadence:deploy:plan`, `cadence:deploy:apply`, `cadence:deploy:verify`, and `cadence:rollback` only.
- No Cloudflare provider semantic, permission, target, or origin change; no Supabase/database/schema/migration operation; no deployment, rollback execution, hosted Cadence call, clean-room work, or Pilot Activation.
- T15-B remains **BLOCKED** until separately authorized provider reinspection passes; T15-C remains **NOT AUTHORIZED**.
- Governance remains 44 parent commitments and 178 child traceability records; no commitment is removed or moved beyond M3.

## Current implementation map

| Boundary | Current source | Current parsing/operation boundary | Existing tests |
|---|---|---|---|
| `cadence:setup:check` | Root `package.json` aliases `npm --prefix apps/api run vs005:deploy:plan` | Reuses `apps/api/scripts/vs005-deploy-plan.ts` argument parser and CLI | `apps/api/scripts/vs005-package-wiring.test.ts`, `vs005-deploy-plan.test.ts` |
| `cadence:deploy:plan` | `apps/api/scripts/vs005-deploy-plan.ts` | `parseArguments()` returns `{ configPath, outputPath }`; `runCli()` loads config, inspects, writes plan | `apps/api/scripts/vs005-deploy-plan.test.ts` |
| `cadence:deploy:apply` | `apps/api/scripts/vs005-deploy-apply.ts` | `parseApplyArguments()` returns `{ planPath, configPath, outputPath }`; `runApplyCli()` reads plan/config and writes result | `apps/api/scripts/vs005-deploy-apply.test.ts` |
| `cadence:deploy:verify` | `apps/api/scripts/vs005-deploy-verify.ts` | `parseCliArguments()` returns `{ deploymentPath, configPath, outputPath }`; `runVerifyCli()` reads deployment/config and writes verification | `apps/api/scripts/vs005-deploy-verify.test.ts` |
| `cadence:rollback` | `apps/api/scripts/vs005-rollback.ts` | `parseRollbackArguments()` returns `{ currentDeploymentPath, targetDeploymentPath, configPath, outputPath }`; `runRollbackCli()` reads inputs and writes verification | `apps/api/scripts/vs005-rollback.test.ts` |

The plan must preserve these application functions and their existing explicit
path parameters. Only the CLI boundary changes how operator strings become
those parameters.

---

### Task 1: Shared canonical repository-root/operator-path resolver

**Files:**

- Create: `apps/api/scripts/cadence-operator-path.ts`
- Create: `apps/api/scripts/cadence-operator-path.test.ts`

**Interfaces:**

- Produces `resolveCadenceRepositoryRoot(): string`, which derives the candidate root from `cadence-operator-path.ts`'s own stable module location and verifies the exact root/API/web package identities. Production callers pass no root hint.
- Test-only seam: tests may call an explicitly internal fixture helper that accepts a fixture module location; this helper is not exported through the operator-path production contract and is never consumed by production CLIs.
- Produces `resolveCadenceOperatorPath(input: { repositoryRoot: string; inputPath: string }): string`, which returns an absolute normalized path.
- Produces bounded stable failures for invalid root identity and invalid operator path input.
- Consumes only Node built-ins (`node:fs`, `node:path`) and explicit arguments; it does not consume cwd/environment/provider/domain state.

- [ ] **Step 1: Write the failing resolver tests.**

  Add tests for the exact current package markers (`cadence`, `api`, `web`), three-level source-relative root derivation from `apps/api/scripts`, root-marker mismatch/missing package failures, relative path normalization, absolute-path preservation, Windows/POSIX separators, spaces, dot segments, empty/malformed inputs, and the absence of `process.chdir()` or cwd/environment authority. The core assertions have this shape:

  ```ts
  test("resolves a relative path from the proven repository root", () => {
    assert.equal(
      resolveCadenceOperatorPath({ repositoryRoot: "C:/repo", inputPath: "./.cadence/../plan.json" }),
      normalize("C:/repo/plan.json"),
    );
  });
  test("rejects a root whose exact package markers do not match", () => {
    assert.throws(() => resolveCadenceRepositoryRootFromFixture("C:/fixture"), /CADENCE_REPOSITORY_ROOT_INVALID/);
  });
  ```

  `resolveCadenceRepositoryRootFromFixture` is an explicitly internal test-only seam; production code exports and calls only `resolveCadenceRepositoryRoot()`. Use temporary in-memory or test-fixture marker paths through that seam; do not create canonical evidence or call Git.

- [ ] **Step 2: Run the resolver tests and observe RED.**

  CWD: apps/api

  ```text
  node --import tsx --test scripts/cadence-operator-path.test.ts
  ```

  Expected result: FAIL because the resolver module and exported functions do not yet exist.

- [ ] **Step 3: Implement the minimum resolver.**

  Implement the production exports with this shape and no caller-supplied root hint:

  ```ts
  export function resolveCadenceRepositoryRoot(): string;
  export function resolveCadenceOperatorPath(input: {
    repositoryRoot: string;
    inputPath: string;
  }): string;
  ```

  Inside `resolveCadenceRepositoryRoot()`, derive the candidate from this module's own stable location (`apps/api/scripts/cadence-operator-path.ts`) using exactly three parent traversals. Read and parse only the candidate's `package.json`, `apps/api/package.json`, and `apps/web/package.json`; require exact names `cadence`, `api`, and `web` and the direct `apps` relationship. Reject mismatch, malformed JSON, missing files, non-directory relationships, or a non-absolute candidate. Implement `resolveCadenceOperatorPath` with `isAbsolute(inputPath) ? normalize(inputPath) : resolve(repositoryRoot, inputPath)`, rejecting empty, non-string, NUL-containing, or newline-containing values. The test-only fixture helper may accept an explicit fixture module location but is not exported through the production contract or called by production CLIs. Do not add cwd fallback, upward search, Git, semantic path classification, or `process.chdir()`.

- [ ] **Step 4: Run the resolver tests and observe GREEN.**

  CWD: apps/api

  ```text
  node --import tsx --test scripts/cadence-operator-path.test.ts
  ```

  Expected result: all resolver tests pass with zero failures.

- [ ] **Step 5: Run the scripts typecheck.**

  CWD: apps/api

  ```text
  npm.cmd exec -- tsc --noEmit -p tsconfig.scripts.json
  ```

  Expected result: exit code 0.

- [ ] **Step 6: Commit the isolated resolver gate.**

  CWD: repository root

  ```text
  git add apps/api/scripts/cadence-operator-path.ts apps/api/scripts/cadence-operator-path.test.ts
  git diff --cached --check
  git commit -m "feat(cadence): add canonical operator path resolver"
  ```

### Task 2: Integrate setup-check and deploy-plan

**Files:**

- Modify: `apps/api/scripts/vs005-deploy-plan.ts`
- Modify: `apps/api/scripts/vs005-deploy-plan.test.ts`
- Modify: `apps/api/scripts/vs005-package-wiring.test.ts` only for command-boundary assertions required by the existing setup-check alias

**Interfaces:**

- Consumes `resolveCadenceRepositoryRoot()` and `resolveCadenceOperatorPath({ repositoryRoot, inputPath })` from Task 1. The production CLI passes no root hint.
- `parseArguments()` continues to produce `{ configPath: string; outputPath: string }` as raw parsed values.
- `runCli()` resolves `configPath` and `outputPath` immediately after parsing, then passes resolved paths to `runVs005DeployPlan()` and `writePlan()`.
- The root `cadence:setup:check` alias remains transport-only and continues to invoke the same plan entrypoint.

- [ ] **Step 1: Add RED tests for plan/setup path normalization.**

  Add tests that invoke the CLI boundary with repository-root, `apps/api`, and unrelated cwd simulations and assert identical absolute `configPath`/`outputPath` values reach the plan dependency and writer. The boundary assertion has this shape:

  ```ts
  const observed = await runPlanCliForTest({ argv, simulatedCwd, initCwd });
  assert.deepEqual(observed.paths, {
    configPath: join(repositoryRoot, "config/cadence.runtime.beta.json"),
    outputPath: join(repositoryRoot, ".cadence/vs005/deployment-plan.json"),
  });
  ```

  Add absolute-path, spaces, dot-segment, root-marker failure, and `INIT_CWD`/cwd-independence cases. Assert the programmatic `runVs005DeployPlan({ configPath, outputPath }, dependencies)` path remains explicit and does not call the resolver itself. Assert setup-check package wiring remains the root transport alias. `runPlanCliForTest` is an internal test seam around the existing CLI dependency boundary; it is not a production export.

- [ ] **Step 2: Run the focused plan/setup tests and observe RED.**

  CWD: apps/api

  ```text
  node --import tsx --test scripts/vs005-deploy-plan.test.ts scripts/vs005-package-wiring.test.ts
  ```

  Expected result: FAIL because the current CLI forwards raw relative paths and derives local paths from runtime cwd.

- [ ] **Step 3: Implement minimum CLI integration.**

  Import `resolveCadenceRepositoryRoot` and `resolveCadenceOperatorPath`. Immediately after parsing, use this exact boundary:

  ```ts
  const parsed = parseArguments(args);
  const repositoryRoot = resolveCadenceRepositoryRoot();
  const configPath = resolveCadenceOperatorPath({ repositoryRoot, inputPath: parsed.configPath });
  const outputPath = resolveCadenceOperatorPath({ repositoryRoot, inputPath: parsed.outputPath });
  await runVs005DeployPlan({ configPath, outputPath }, dependencies);
  ```

  Use the resolved `configPath` for config loading and local-readiness inputs, and the resolved `outputPath` for success and bounded failure output. Keep `runVs005DeployPlan({ configPath, outputPath }, dependencies)` unchanged as a programmatic explicit-path API. Do not modify the root npm script or provider code.

- [ ] **Step 4: Run focused GREEN.**

  CWD: apps/api

  ```text
  node --import tsx --test scripts/vs005-deploy-plan.test.ts scripts/vs005-package-wiring.test.ts
  ```

  Expected result: zero failures.

- [ ] **Step 5: Run local plan/readiness regressions without provider access.**

  CWD: apps/api

  ```text
  node --import tsx --test scripts/vs005-local-deployment-readiness.test.ts scripts/vs005-deploy-plan.test.ts scripts/vs005-generate-deployment.test.ts scripts/vs005-generate-web-config.test.ts
  ```

  Expected result: all tests pass; no live plan CLI is run.

- [ ] **Step 6: Commit the isolated plan/setup gate.**

  CWD: repository root

  ```text
  git add apps/api/scripts/vs005-deploy-plan.ts apps/api/scripts/vs005-deploy-plan.test.ts apps/api/scripts/vs005-package-wiring.test.ts
  git diff --cached --check
  git commit -m "fix(cadence): normalize setup and plan paths"
  ```

### Task 3: Integrate deploy-apply, deploy-verify, and rollback

**Files:**

- Modify: `apps/api/scripts/vs005-deploy-apply.ts`
- Modify: `apps/api/scripts/vs005-deploy-apply.test.ts`
- Modify: `apps/api/scripts/vs005-deploy-verify.ts`
- Modify: `apps/api/scripts/vs005-deploy-verify.test.ts`
- Modify: `apps/api/scripts/vs005-rollback.ts`
- Modify: `apps/api/scripts/vs005-rollback.test.ts`

**Interfaces:**

- Each CLI consumes `resolveCadenceRepositoryRoot()` and establishes the root from the resolver module's own stable `apps/api/scripts` location; no CLI passes `__dirname`, cwd, `INIT_CWD`, or another root hint.
- `parseApplyArguments()` remains `{ planPath, configPath, outputPath }`; `parseCliArguments()` in verify remains `{ deploymentPath, configPath, outputPath }`; rollback parsing remains `{ currentDeploymentPath, targetDeploymentPath, configPath, outputPath }`.
- Each `run*Cli()` resolves every parsed path immediately and passes only resolved paths to existing read/write/application APIs.
- No provider, deployment, rollback-execution, database, or hosted API behavior changes.

- [ ] **Step 1: Add RED tests for all three CLI boundaries.**

  For apply, verify, and rollback, assert root-relative paths are identical from repository-root, `apps/api`, and unrelated cwd simulations. Each test captures the existing downstream call and checks the exact resolved fields:

  ```ts
  const call = await runApplyCliForTest({ argv, simulatedCwd, initCwd });
  assert.equal(call.planPath, join(repositoryRoot, "plan.json"));
  assert.equal(call.configPath, join(repositoryRoot, "config/cadence.runtime.beta.json"));
  assert.equal(call.outputPath, join(repositoryRoot, ".cadence/vs005/deployment-result.json"));
  ```

  Use equivalent explicit field assertions for `runVerifyCliForTest` (`deploymentPath`) and `runRollbackCliForTest` (`currentDeploymentPath`, `targetDeploymentPath`). Assert absolute paths remain absolute, spaces and dot segments normalize, root-marker failure blocks before reading or writing, and `apps/api/.cadence` is never selected as authoritative output. These named helpers are internal test seams around existing CLI boundaries, not production exports. Assert each programmatic API still accepts explicit paths without consulting cwd or `INIT_CWD`.

- [ ] **Step 2: Run focused tests and observe RED.**

  CWD: apps/api

  ```text
  node --import tsx --test scripts/vs005-deploy-apply.test.ts scripts/vs005-deploy-verify.test.ts scripts/vs005-rollback.test.ts
  ```

  Expected result: FAIL because the current CLIs read raw relative paths and use `process.cwd()` for generated local artifacts.

- [ ] **Step 3: Implement minimum integration.**

  Normalize every parsed path immediately after parsing. Apply uses this exact shape:

  ```ts
  const parsed = parseApplyArguments(args);
  const repositoryRoot = resolveCadenceRepositoryRoot();
  const resolved = {
    planPath: resolveCadenceOperatorPath({ repositoryRoot, inputPath: parsed.planPath }),
    configPath: resolveCadenceOperatorPath({ repositoryRoot, inputPath: parsed.configPath }),
    outputPath: resolveCadenceOperatorPath({ repositoryRoot, inputPath: parsed.outputPath }),
  };
  ```

  Verify uses `parseCliArguments(args)` and constructs the same object with `deploymentPath`, `configPath`, and `outputPath`; rollback uses `parseRollbackArguments(args)` and constructs it with `currentDeploymentPath`, `targetDeploymentPath`, `configPath`, and `outputPath`. Each field is resolved by its own `resolveCadenceOperatorPath({ repositoryRoot, inputPath: parsed.<field> })` call. Pass the resolved object to the existing explicit-path readers, gates, and writers. Replace only operator-path interpretation; retain existing mutation gates, structured inspection authority, rollback rules, error envelopes, and explicit programmatic APIs. Do not add a resolver semantic classification parameter or alter root package scripts.

- [ ] **Step 4: Run focused GREEN.**

  CWD: apps/api

  ```text
  node --import tsx --test scripts/vs005-deploy-apply.test.ts scripts/vs005-deploy-verify.test.ts scripts/vs005-rollback.test.ts
  ```

  Expected result: zero failures.

- [ ] **Step 5: Run the complete local VS005 command-level regression set.**

  CWD: apps/api

  ```text
  node --import tsx --test scripts/vs005-package-wiring.test.ts scripts/vs005-local-deployment-readiness.test.ts scripts/vs005-deploy-plan.test.ts scripts/vs005-deploy-apply.test.ts scripts/vs005-deploy-verify.test.ts scripts/vs005-rollback.test.ts scripts/vs005-deployment-artifacts.test.ts
  ```

  Expected result: all tests pass; no provider or database operation occurs.

- [ ] **Step 6: Commit the isolated apply/verify/rollback gate.**

  CWD: repository root

  ```text
  git add apps/api/scripts/vs005-deploy-apply.ts apps/api/scripts/vs005-deploy-apply.test.ts apps/api/scripts/vs005-deploy-verify.ts apps/api/scripts/vs005-deploy-verify.test.ts apps/api/scripts/vs005-rollback.ts apps/api/scripts/vs005-rollback.test.ts
  git diff --cached --check
  git commit -m "fix(cadence): normalize deployment management paths"
  ```

### Task 4: Cross-cwd, canonical-evidence acceptance and local recertification

**Files:**

- Inspect only: `apps/api/scripts/cadence-operator-path.test.ts`
- Inspect only: `apps/api/scripts/vs005-deploy-plan.test.ts`
- Inspect only: `apps/api/scripts/vs005-deploy-apply.test.ts`
- Inspect only: `apps/api/scripts/vs005-deploy-verify.test.ts`
- Inspect only: `apps/api/scripts/vs005-rollback.test.ts`
- Inspect only: `apps/api/scripts/vs005-package-wiring.test.ts`
- Do not modify `.cadence/vs005/t15a-local-readiness.json` or any frozen design/plan/config document.

**Interfaces:**

- Consumes the final Task 1–3 CLI boundaries and their explicit path contracts.
- Produces executable proof that all five commands use one resolver, canonical evidence remains `<repo>/.cadence/`, and non-canonical `apps/api/.cadence` cannot become authoritative.

- [ ] **Step 1: Confirm Task 1–3 tests contain the complete behavior coverage.**

  Review the committed tests and confirm they already cover all five root-exposed names, Windows/POSIX path forms, spaces, dot segments, absolute paths, unrelated cwd values, `INIT_CWD` values, root-marker failure, no `process.chdir()`, exact downstream absolute arguments, canonical `<repo>/.cadence`, rejection of `apps/api/.cadence` as authority, and programmatic explicit-path APIs. Do not add behavior or tests in Task 4.

- [ ] **Step 2: Run consolidated acceptance tests and require GREEN.**

  CWD: apps/api

  ```text
  node --import tsx --test scripts/cadence-operator-path.test.ts scripts/vs005-package-wiring.test.ts scripts/vs005-deploy-plan.test.ts scripts/vs005-deploy-apply.test.ts scripts/vs005-deploy-verify.test.ts scripts/vs005-rollback.test.ts
  ```

  Expected result: all tests pass. If any test fails, STOP and return to the owning Task 1, 2, or 3 using systematic-debugging and TDD; do not patch during Task 4.

- [ ] **Step 3: Run the complete local structured/VS005 suite.**

  CWD: apps/api

  ```text
  node --import tsx --test src/bootstrap/cadence-config.test.ts src/bootstrap/cadence-release.test.ts src/bootstrap/cadence-target-policy.test.ts src/runtime/create-cadence-app.test.ts scripts/vs005-cloudflare-readonly-transport.test.ts scripts/vs005-cloudflare-current-deployment.test.ts scripts/vs005-cloudflare-worker-settings.test.ts scripts/vs005-cloudflare-cron-inspection.test.ts scripts/vs005-cloudflare-version-inspection.test.ts scripts/vs005-cloudflare-hostname-inspection.test.ts scripts/vs005-cloudflare-structured-inspection.test.ts scripts/vs005-local-deployment-readiness.test.ts scripts/vs005-provider-observations.test.ts scripts/vs005-cloudflare-deployment-provider.test.ts scripts/vs005-deployment-artifacts.test.ts scripts/vs005-deploy-plan.test.ts scripts/vs005-deploy-apply.test.ts scripts/vs005-deploy-verify.test.ts scripts/vs005-rollback.test.ts scripts/vs005-generate-deployment.test.ts scripts/vs005-generate-web-config.test.ts scripts/vs005-beta-config.test.ts scripts/vs005-package-wiring.test.ts scripts/vs005-t15a-readiness.test.ts
  ```

  CWD: apps/api

  ```text
  node --import tsx --test scripts/bootstrap-vs003-runtime.test.ts
  ```

  CWD: apps/api

  ```text
  node --import tsx --test scripts/vs004-controlled-pilot-artifact.test.ts scripts/vs004-controlled-pilot-execute-cli.test.ts scripts/vs004-controlled-pilot-execute-command.test.ts scripts/vs004-controlled-pilot-execution.test.ts scripts/vs004-controlled-pilot-file.test.ts scripts/vs004-controlled-pilot-observation-adapters.test.ts scripts/vs004-controlled-pilot-package.test.ts scripts/vs004-controlled-pilot-preflight.test.ts scripts/vs004-controlled-pilot-preflight-cli.test.ts scripts/vs004-controlled-pilot-preflight-command.test.ts scripts/vs004-controlled-pilot-runtime.test.ts scripts/vs004-controlled-pilot-runtime-config.test.ts scripts/vs004-pilot-manifest.test.ts scripts/vs004-preflight.test.ts
  ```

  CWD: repository root

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

  Do not run `cadence:deploy:plan`, `cadence:deploy:apply`, `cadence:deploy:verify`, or rollback during this recertification; these commands are provider/mutation-gated. Expected result: all local checks pass with zero remote calls.

- [ ] **Step 4: Audit the final diff and authority boundaries.**

  CWD: repository root

  Run:

  ```text
  git diff --check
  rg -n "process\.cwd\(\)|INIT_CWD|process\.chdir\(|apps/api/.cadence|resolveCadenceOperatorPath|resolveCadenceRepositoryRoot" apps/api/scripts/cadence-operator-path.ts apps/api/scripts/vs005-deploy-plan.ts apps/api/scripts/vs005-deploy-apply.ts apps/api/scripts/vs005-deploy-verify.ts apps/api/scripts/vs005-rollback.ts
  rg -n "cadence:setup:check|cadence:deploy:plan|cadence:deploy:apply|cadence:deploy:verify|cadence:rollback" package.json apps/api/package.json apps/api/scripts/vs005-package-wiring.test.ts
  ```

  Confirm no provider semantic, database, config, frozen-document, or package-script path-policy change.

Task 4 creates no test-only commit and adds no behavior after Tasks 1–3. Its
only outcome is consolidated acceptance evidence. If acceptance fails, no
Task 4 patch is permitted; return to the owning implementation task.

### Task 5: Handoff and change-control reconciliation

**Files:**

- Modify: `HANDOFF.md`
- Inspect only: `docs/governance/CADENCE_CHANGE_CONTROL.md`, `docs/governance/CADENCE_REQUIREMENT_TRACEABILITY.md`, `docs/governance/CADENCE_PROJECT_SCOPE_BASELINE.md`, and the approved operator-path spec
- Do not modify: `config/cadence.runtime.beta.json`, `supabase/migrations/**`, frozen VS005 design/plan records, structured-inspection design/plan records, transition amendments, or historical `.cadence/vs005/t15a-local-readiness.json`

**Interfaces:**

- Consumes local recertification evidence from Tasks 1–4 and the approved spec hash.
- Produces one concise HANDOFF entry recording the bounded operator-path reconciliation, implementation commit lineage, local-only verification, canonical evidence rule, unchanged governance (44/178), T15-B BLOCKED, T15-C NOT AUTHORIZED, and absence of provider/database/mutation work.
- No change-control baseline or requirement-traceability count changes are produced because intended outcomes and governance scope remain unchanged.

- [ ] **Step 1: Review governance evidence requirements.**

  Verify the current change-control and traceability documents require only an evidence/handoff update for this bounded tooling reconciliation and do not require a new parent, child, migration, or frozen-record edit.

- [ ] **Step 2: Record the pre-edit HANDOFF baseline.**

  CWD: repository root

  Run `rg -n "VS005|T15-B|T15-C|44|178|NOT AUTHORIZED" HANDOFF.md` and retain the output as the documentation baseline. Confirm the existing handoff has no entry for this implementation checkpoint before adding the new bounded entry.

- [ ] **Step 3: Add the bounded HANDOFF entry.**

  Record the completed local reconciliation, exact commit SHAs, verification commands/results, unchanged frozen/config/database/provider boundaries, and the requirement for a separately authorized T15-B reinspection. Do not claim provider PASS or Worker presence/absence.

- [ ] **Step 4: Run the HANDOFF verification.**

  CWD: repository root

  ```text
  git diff --check
  rg -n "operator path|canonical|apps/api/.cadence|T15-B|T15-C|44|178|NOT AUTHORIZED" HANDOFF.md
  ```

  Expected result: the entry is bounded, complete, and contains no secret, provider response, deployment authorization, or scope change.

- [ ] **Step 5: Commit the handoff evidence.**

  CWD: repository root

  ```text
  git add HANDOFF.md
  git diff --cached --check
  git commit -m "docs(cadence): record operator path reconciliation"
  ```

## Final acceptance gate

- [ ] Verify all five initial CLI commands use the same `resolveCadenceOperatorPath({ repositoryRoot, inputPath })` contract.
- [ ] Verify relative inputs resolve from the proven root from repository-root, `apps/api`, and unrelated cwd contexts.
- [ ] Verify absolute inputs remain absolute, including Windows/POSIX forms, spaces, and dot segments.
- [ ] Verify exact `cadence`/`api`/`web` root markers and direct `apps` relationships are required; root failure blocks closed.
- [ ] Verify no `process.cwd()`, `INIT_CWD`, npm/package cwd, shell cwd, Git, upward search, or `process.chdir()` supplies authority.
- [ ] Verify root scripts remain transport only and programmatic APIs remain explicit-path APIs.
- [ ] Verify canonical evidence is `<repo>/.cadence/`; `apps/api/.cadence` is never authoritative; historical evidence is untouched.
- [ ] Verify no provider, database, deployment, rollback execution, hosted Cadence, clean-room, or Pilot Activation action occurred.
- [ ] Verify frozen records, canonical Beta config, migrations, and package dependencies are unchanged.
- [ ] Verify governance remains 44 parents / 178 children, with zero removed commitments and zero moved beyond M3.
- [ ] Verify T15-B remains BLOCKED pending separately authorized provider reinspection and T15-C remains NOT AUTHORIZED.

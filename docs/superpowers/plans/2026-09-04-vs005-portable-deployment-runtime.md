# VS005 Portable Deployment and Supervised Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Cadence reproducibly deployable to Cloudflare Workers for M1 while preserving a provider-neutral Node runtime, centralized configuration, bounded supervised background processing, safe deployment evidence, and clean-room portability.

**Architecture:** Keep Cadence domain/application logic independent of Cloudflare. Extract runtime-neutral API and worker composition from the current Node entrypoints, add one canonical JSON configuration boundary, and place Cloudflare-specific HTTP, Static Assets, Cron, secret binding, and deployment mechanics in a separate adapter package. Deployment follows fail-closed plan -> apply -> verify semantics; persistent event-delivery state remains the retry authority.

**Tech Stack:** TypeScript, Node.js, Express 5, Supabase JS, Vite/React, Node test runner, JSON Schema/Ajv, Cloudflare Workers, Wrangler 4, Workers Static Assets, Cron Triggers.

**Spec:** `docs/superpowers/specs/2026-09-04-vs005-portable-deployment-runtime-design.md`

## Global Constraints

- Cloudflare Workers is the M1 hosting platform; Workers Static Assets serves the Vite application.
- Web, API, and scheduled adapter are one versioned Cloudflare deployment unit for M1.
- Cloudflare is a runtime/deployment adapter only; no Cloudflare API may enter domain/application-service logic.
- Supabase remains canonical persistence/authentication for the current M1 architecture.
- `ProjectAuthorisationService` remains the sole normal application project-authority boundary.
- Browser business-data access remains behind `/api/v1`; do not add browser direct Supabase business-table authority.
- Canonical `Person`, Project Membership, protected roles, and protected transfer-ledger semantics remain unchanged.
- Legacy membership fields remain frozen and non-authoritative.
- Do not reset the database. Do not rewrite historical migrations. Do not add ad hoc SQL to normal operation.
- A database migration is not expected for VS005. If a task proves one is required, STOP before creating it and return for design/governance review.
- Node API and one-shot worker execution must remain valid after Cloudflare support is added.
- Every operator-modifiable non-secret setting has exactly one canonical source of truth per environment.
- Secret values never enter committed runtime configuration, generated browser assets, result artifacts, or logs.
- Platform-assigned transport bindings such as the Node process `PORT` are adapter inputs, not operator-owned Cadence runtime configuration; they may remain at the process adapter boundary.
- M1 default worker schedule is `* * * * *` (UTC under Cloudflare Cron).
- The membership-expiry pass is also hard-bounded for M1: `worker.maxMembershipExpiryAttempts = 20`; this is a planning-level resource bound required by the approved no-unbounded-work rule, not a new business invariant.
- M1 worker defaults: `maxRounds=10`, `maxDeliveryAttempts=20`, `maxMembershipExpiryAttempts=20`, `softDeadlineSeconds=20`.
- M1 retry delays: 60s, 300s, 900s, then 3600s for attempt 4 and later.
- Cloudflare scheduled invocation must call `controller.noRetry()` so provider retry does not compete with Cadence persistent retry authority.
- Configuration mismatch and deployment-target mismatch fail closed.
- Deployment PASS never means M1 Pilot Activation PASS.
- VS006 backup/restore/support, VS007 broader M1 AI, enterprise SSO, evaluation limits, permanent admin bootstrap, document export, and full upgrade product lifecycle are out of VS005 implementation scope.
- Keep the governed parent count at 44 and child-record count at 178.
- Use strict RED -> GREEN -> fresh verification for every behavior-changing task.
- One checkpoint commit per task. Do not proceed past a failed verification gate.

---

## File Structure Locked by This Plan

The implementation should converge on these responsibilities. Do not move provider-specific logic into Cadence modules to save a file.

```text
config/
  cadence.runtime.schema.json              # canonical non-secret config schema
  cadence.runtime.example.json             # documented operator template only
  cadence.runtime.ci.json                  # deterministic non-secret CI fixture

apps/api/src/bootstrap/
  cadence-config-schema.ts                  # executable JSON Schema object; single schema authority
  cadence-config.ts                         # config types, Ajv schema validation, target invariants
  cadence-config.test.ts
  cadence-release.ts                        # safe release/build identity
  cadence-release.test.ts

apps/api/src/runtime/
  create-cadence-app.ts                     # runtime-neutral Express composition
  create-cadence-app.test.ts
  cadence-worker-cycle.ts                   # runtime-neutral bounded worker orchestration
  cadence-worker-cycle.test.ts
  create-cadence-worker-services.ts         # shared Node/Cloudflare worker dependency composition
  create-cadence-worker-services.test.ts
  worker-retry-policy.ts                    # deterministic retry calculation
  worker-retry-policy.test.ts

apps/api/src/server.ts                      # thin Node HTTP adapter only
apps/api/src/worker.ts                      # thin Node one-shot worker adapter only
apps/api/src/server.wiring.test.ts
apps/api/src/worker.wiring.test.ts
apps/api/src/infrastructure/events/domain-event.processor.ts
apps/api/src/infrastructure/events/domain-event.processor.test.ts

apps/api/scripts/vs005-generate-web-config.ts # canonical config -> generated browser-safe config
apps/api/scripts/vs005-generate-web-config.test.ts
apps/web/.generated/cadence-public-config.json # generated/ignored build input
apps/web/vite.config.ts                     # consumes generated browser-safe config
apps/web/src/lib/env.ts                     # consumes generated/defined public values, no operator-owned .env values
apps/web/src/lib/env.test.ts                 # public-config/same-origin safety

apps/runtime-cloudflare/
  package.json
  package-lock.json
  tsconfig.json
  src/compatibility-probe.ts                 # Task 2 gate; removed when final adapter lands
  src/index.ts                               # final fetch + scheduled adapter
  src/index.test.ts
  wrangler.generated.jsonc                   # generated, ignored; never operator-edited
  .gitignore

apps/api/scripts/
  vs005-write-config-schema.ts              # writes tracked config/cadence.runtime.schema.json from schema authority
  vs005-generate-deployment.ts               # canonical config -> provider build/deploy inputs
  vs005-generate-deployment.test.ts
  vs005-deployment-artifacts.ts              # shared safe plan/apply/verify/rollback evidence contracts
  vs005-deployment-artifacts.test.ts
  vs005-deploy-plan.ts                       # read-only plan artifact
  vs005-deploy-plan.test.ts
  vs005-deploy-apply.ts                      # plan-bound Cloudflare apply orchestration
  vs005-deploy-apply.test.ts
  vs005-deploy-verify.ts                     # post-deploy health/identity/drift verification
  vs005-deploy-verify.test.ts

.github/workflows/quality.yml                # include Cloudflare adapter/config verification
package.json                                 # root operator commands
apps/api/package.json                        # runtime/deploy helper commands and Ajv dependency

docs/runbooks/
  VS005_DEPLOYMENT.md                        # quick operator path and failure consequences
  VS005_CLEAN_ROOM_REHEARSAL.md              # recorded fresh-environment proof

docs/vertical-slices/VS-005.md               # frozen slice contract
docs/milestones/M1_CONTROLLED_PILOT.md       # activation sequencing only
docs/governance/CADENCE_MILESTONE_ROADMAP.md # VS005/VS006/VS007 sequencing only
docs/governance/CADENCE_REQUIREMENT_TRACEABILITY.md # evidence/status reconciliation only
HANDOFF.md
CHANGELOG.md
```

`wrangler.generated.jsonc` is generated from canonical Cadence configuration and must be ignored by Git. It is not a second operator source of truth.

The plan creates the schema, example, and deterministic CI configuration, but it does **not invent real local/QA/Beta target values**. A real `config/cadence.runtime.<environment>.json` is an operator-owned canonical input created from approved environment facts before hosted planning. It may be committed only after explicit review of its non-secret contents; otherwise the operator supplies its path through `--config`/`CADENCE_CONFIG_PATH`. Commands must fail closed if the selected real target config is absent or incomplete.

---

### Task 1: Freeze the VS005 Vertical-Slice Contract and M1 Sequence

**Files:**
- Create: `docs/vertical-slices/VS-005.md`
- Modify: `docs/milestones/M1_CONTROLLED_PILOT.md`
- Modify: `docs/governance/CADENCE_MILESTONE_ROADMAP.md`
- Modify: `docs/governance/CADENCE_REQUIREMENT_TRACEABILITY.md`
- Modify: `docs/governance/CADENCE_GOVERNANCE_INDEX.md`
- Modify: `HANDOFF.md`
- Modify: `CHANGELOG.md`
- Add/reference: `docs/superpowers/specs/2026-09-04-vs005-portable-deployment-runtime-design.md`
- Add/reference: `docs/superpowers/plans/2026-09-04-vs005-portable-deployment-runtime.md`

**Interfaces:**
- Consumes: the approved VS005 design specification and existing M1/traceability authorities.
- Produces: one frozen VS005 scope/acceptance contract. No executable code, schema, migration, or requirement-count change.

- [ ] **Step 1: Add the approved design spec and reviewed implementation plan to the repository if not already present**

Expected paths:

```text
docs/superpowers/specs/2026-09-04-vs005-portable-deployment-runtime-design.md
docs/superpowers/plans/2026-09-04-vs005-portable-deployment-runtime.md
```

Verify both byte-for-byte against the reviewed records before staging. Do not recreate either document from memory.

- [ ] **Step 2: Write the VS005 contract with explicit in-scope, non-scope, invariants, and closure evidence**

The contract must contain these exact outcome headings and rules:

```markdown
# VS-005 - Portable Deployment and Supervised Runtime

Status: FROZEN FOR IMPLEMENTATION
Milestone: M1 - Controlled Pilot

## Outcome
Cadence can be reproducibly built, deployed, scheduled, observed, verified, and reconstructed on the selected M1 hosting platform without making Cloudflare a business-architecture dependency or requiring access to the original developer's personal infrastructure.

## Mandatory implementation outcomes
- Cloudflare Workers + Workers Static Assets + Cron Trigger.
- Same-origin web and `/api/v1` hosted runtime.
- Node API and Node one-shot worker remain valid.
- Canonical provider-neutral configuration with one editable source per setting.
- Secret-reference boundary and no browser/server-secret leakage.
- Bounded worker cycle with independent membership-expiry, Audit, and Team Agent attempts.
- Persistent retry backoff owned by Cadence.
- Plan -> apply -> verify deployment semantics.
- Safe health, worker-run, release, and deployment evidence.
- Configuration/target mismatch fail-closed behavior and material drift detection.
- Application rollback that never implies database rollback/reset.
- Clean-room fresh-environment proof independent of developer personal credentials.

## Non-scope
- VS006 backup/restore/support and recovery rehearsal.
- VS007 broader M1 Team Agent/AI assistance.
- Enterprise SSO implementation.
- Evaluation/Standard/Enterprise profile enforcement and 30-project cap.
- Permanent initial-admin product bootstrap.
- Document generation/business export.
- Full patch/upgrade product lifecycle.
- Commercial entitlement/licensing.

## Closure rule
VS005 PASS does not authorise M1 Pilot Activation.
```

- [ ] **Step 3: Reconcile M1 sequencing without changing baseline counts**

The M1 documents must show this activation sequence:

```text
VS005 portable deployment/runtime
  -> VS006 backup/restore/support and recovery proof
      -> VS007 M1 Team Agent/AI assistance
          -> complete M1 rehearsal
              -> Pilot Activation decision
```

Do not mark C17 complete. Record only that a useful C17-C19 subset is now expected before Pilot Activation; full baseline closure remains by M3.

- [ ] **Step 4: Run governance text checks**

Run from repo root:

```powershell
git grep -n "VS005\|VS-005\|VS006\|VS007\|Pilot Activation" -- docs HANDOFF.md CHANGELOG.md
git grep -n "44" -- docs/governance/CADENCE_PROJECT_SCOPE_BASELINE.md docs/governance/CADENCE_REQUIREMENT_TRACEABILITY.md
git grep -n "178" -- docs/governance/CADENCE_REQUIREMENT_TRACEABILITY.md
```

Expected: VS005/6/7 sequencing is consistent; 44/178 remain unchanged; no text says VS005 alone activates the pilot.

- [ ] **Step 5: Inspect the documentation-only diff**

Run:

```powershell
git diff --check
git diff -- docs/vertical-slices/VS-005.md docs/milestones/M1_CONTROLLED_PILOT.md docs/governance/CADENCE_MILESTONE_ROADMAP.md docs/governance/CADENCE_REQUIREMENT_TRACEABILITY.md docs/governance/CADENCE_GOVERNANCE_INDEX.md HANDOFF.md CHANGELOG.md
```

Expected: documentation only; no app code, package, migration, or schema changes.

- [ ] **Step 6: Commit the governance checkpoint**

```powershell
git add docs/superpowers/specs/2026-09-04-vs005-portable-deployment-runtime-design.md docs/superpowers/plans/2026-09-04-vs005-portable-deployment-runtime.md docs/vertical-slices/VS-005.md docs/milestones/M1_CONTROLLED_PILOT.md docs/governance/CADENCE_MILESTONE_ROADMAP.md docs/governance/CADENCE_REQUIREMENT_TRACEABILITY.md docs/governance/CADENCE_GOVERNANCE_INDEX.md HANDOFF.md CHANGELOG.md
git diff --cached --check
git diff --cached --stat
git commit -m "docs(vs005): freeze portable runtime contract"
```

**Checkpoint deliverable:** A reviewable frozen VS005 contract exists before runtime code begins, with M1 activation sequencing reconciled and governed counts unchanged.

---

### Task 2: Prove the Existing Cadence Stack Can Bundle and Run Under Workers

**Files:**
- Create: `apps/runtime-cloudflare/package.json`
- Create: `apps/runtime-cloudflare/package-lock.json`
- Create: `apps/runtime-cloudflare/tsconfig.json`
- Create: `apps/runtime-cloudflare/src/compatibility-probe.ts`
- Create: `apps/runtime-cloudflare/src/compatibility-probe.test.ts`
- Create: `apps/runtime-cloudflare/wrangler.probe.jsonc`
- Create: `apps/runtime-cloudflare/.gitignore`
- Modify: `package.json`

**Interfaces:**
- Consumes: the current committed `apps/api/src/server.ts`, current Vite `apps/web/dist`, and current Node-compatible API dependencies.
- Produces: a compatibility gate proving Workers can bundle the real current API stack, route `/health` into the Node HTTP server, expose a scheduled handler, and include static assets. This is a probe, not the final adapter.

- [ ] **Step 1: Write the probe test before adding the adapter**

Create `apps/runtime-cloudflare/src/compatibility-probe.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const source = readFileSync(
  resolve(process.cwd(), "src/compatibility-probe.ts"),
  "utf8"
);

const wrangler = readFileSync(
  resolve(process.cwd(), "wrangler.probe.jsonc"),
  "utf8"
);

test("probe routes HTTP through Cloudflare Node integration", () => {
  assert.match(source, /handleAsNodeRequest/);
  assert.match(source, /\.\.\/\.\.\/api\/src\/server/);
});

test("probe exposes a scheduled handler with platform retry disabled", () => {
  assert.match(source, /scheduled\s*\(/);
  assert.match(source, /controller\.noRetry\(\)/);
});

test("probe uses Workers Static Assets and a post-2026-08-04 compatibility date", () => {
  assert.match(wrangler, /"assets"/);
  assert.match(wrangler, /"directory"\s*:\s*"\.\.\/web\/dist"/);
  assert.match(wrangler, /"compatibility_date"\s*:\s*"2026-09-04"/);
  assert.match(wrangler, /"compatibility_flags"\s*:\s*\[\s*"nodejs_compat"\s*\]/);
});
```

- [ ] **Step 2: Run the probe test and verify RED**

Run:

```powershell
npm --prefix apps/runtime-cloudflare test
```

Expected: FAIL because the package/probe files do not exist yet.

- [ ] **Step 3: Add the minimal Cloudflare probe package**

`apps/runtime-cloudflare/package.json`:

```json
{
  "name": "@cadence/runtime-cloudflare",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --import tsx --test src/*.test.ts",
    "typecheck": "tsc --noEmit",
    "probe:bundle": "wrangler deploy --config wrangler.probe.jsonc --dry-run"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "5.20260903.1",
    "tsx": "4.23.12",
    "typescript": "7.0.2",
    "wrangler": "4.127.1"
  }
}
```

`apps/runtime-cloudflare/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["src/**/*.ts"]
}
```

`apps/runtime-cloudflare/wrangler.probe.jsonc`:

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "cadence-vs005-compatibility-probe",
  "main": "src/compatibility-probe.ts",
  "compatibility_date": "2026-09-04",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": "../web/dist",
    "binding": "ASSETS",
    "run_worker_first": ["/api/*", "/health"],
    "not_found_handling": "single-page-application"
  },
  "triggers": {
    "crons": ["* * * * *"]
  }
}
```

`apps/runtime-cloudflare/src/compatibility-probe.ts` must use Cloudflare's Node HTTP bridge without moving Cadence business logic:

```ts
import "../../api/src/server";
import { handleAsNodeRequest } from "cloudflare:node";

export default {
  fetch(request: Request): Promise<Response> {
    return handleAsNodeRequest(3000, request);
  },

  async scheduled(controller: ScheduledController): Promise<void> {
    controller.noRetry();
    console.log(JSON.stringify({
      kind: "cadence.vs005.compatibility-probe",
      outcome: "ok"
    }));
  }
};
```

The probe intentionally imports the existing Node entrypoint. It exists only to prove bundle/runtime compatibility before the later extraction.

- [ ] **Step 4: Install and build the current web assets**

```powershell
npm --prefix apps/runtime-cloudflare install
npm --prefix apps/web run build:ci
```

Expected: web build PASS.

- [ ] **Step 5: Run probe unit/type/bundle checks**

```powershell
npm --prefix apps/runtime-cloudflare test
npm --prefix apps/runtime-cloudflare run typecheck
npm --prefix apps/runtime-cloudflare run probe:bundle
```

Expected: PASS; Wrangler dry-run produces a Worker bundle with assets and no remote deployment.

If bundling fails because Express, Supabase, Node HTTP, crypto, or another required API is incompatible, STOP here. Do not rewrite core logic around Cloudflare.

- [ ] **Step 6: Add the root compatibility command and rerun**

Add to root `package.json`:

```json
"vs005:cloudflare:probe": "npm --prefix apps/web run build:ci && npm --prefix apps/runtime-cloudflare run probe:bundle"
```

Run:

```powershell
npm run vs005:cloudflare:probe
```

Expected: PASS.

- [ ] **Step 7: Commit the compatibility gate**

```powershell
git add apps/runtime-cloudflare package.json
git diff --cached --check
git commit -m "test(vs005): prove Cloudflare runtime compatibility"
```

**Checkpoint deliverable:** The existing stack bundles under the selected Workers runtime before broader runtime refactoring begins. No Cloudflare deployment has occurred.

---

### Task 3: Add Canonical Runtime Configuration and Release Identity

**Files:**
- Create: `config/cadence.runtime.schema.json`
- Create: `config/cadence.runtime.example.json`
- Create: `config/cadence.runtime.ci.json`
- Create: `apps/api/src/bootstrap/cadence-config-schema.ts`
- Create: `apps/api/src/bootstrap/cadence-config.ts`
- Create: `apps/api/src/bootstrap/cadence-config.test.ts`
- Create: `apps/api/src/bootstrap/cadence-release.ts`
- Create: `apps/api/src/bootstrap/cadence-release.test.ts`
- Create: `apps/api/scripts/vs005-write-config-schema.ts`
- Modify: `apps/api/tsconfig.scripts.json`
- Modify: `apps/api/package.json`
- Modify: `apps/api/package-lock.json`

**Interfaces:**
- Produces:
  - `CadenceRuntimeConfig`
  - `CadenceResolvedSecrets`
  - `loadCadenceRuntimeConfig(path: string): CadenceRuntimeConfig`
  - `validateCadenceRuntimeConfig(value: unknown): CadenceRuntimeConfig`
  - `fingerprintCadenceRuntimeConfig(config: CadenceRuntimeConfig): string`
  - `resolveCadenceConfigPath(input): string`
  - `resolveCadenceSecrets(config, source): CadenceResolvedSecrets`
  - `CadenceReleaseIdentity`
  - `loadCadenceReleaseIdentity(source): CadenceReleaseIdentity`
- Consumed by Node API/worker, Vite build adapter, Cloudflare adapter, deployment plan/apply/verify.

- [ ] **Step 1: Write configuration RED tests**

`apps/api/src/bootstrap/cadence-config.test.ts` must include these concrete cases:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  fingerprintCadenceRuntimeConfig,
  resolveCadenceConfigPath,
  resolveCadenceSecrets,
  validateCadenceRuntimeConfig,
} from "./cadence-config";

const valid = {
  configVersion: 1,
  application: {
    name: "cadence",
    environment: "beta",
    publicUrl: "https://cadence-beta.example.test",
    apiBaseUrl: "",
    requestBodyLimitBytes: 1048576
  },
  runtime: { provider: "cloudflare" },
  supabase: {
    url: "https://abc123.supabase.co",
    projectRef: "abc123",
    publishableKey: "sb_publishable_test",
    secretKeySecretRef: "SUPABASE_SECRET_KEY"
  },
  pilot: {
    projectId: "11111111-1111-4111-8111-111111111111",
    safeTargetMarker: "cadence-beta"
  },
  worker: {
    schedule: "* * * * *",
    maxRounds: 10,
    maxDeliveryAttempts: 20,
    maxMembershipExpiryAttempts: 20,
    softDeadlineSeconds: 20
  },
  retry: { delaysSeconds: [60, 300, 900, 3600] }
};

test("accepts one valid beta configuration", () => {
  assert.deepEqual(validateCadenceRuntimeConfig(valid), valid);
});

test("configuration fingerprint is deterministic and changes with material config", () => {
  const config = validateCadenceRuntimeConfig(valid);
  const first = fingerprintCadenceRuntimeConfig(config);
  const second = fingerprintCadenceRuntimeConfig({ ...config });
  const changed = fingerprintCadenceRuntimeConfig({
    ...config,
    worker: { ...config.worker, maxRounds: config.worker.maxRounds + 1 }
  });

  assert.match(first, /^[0-9a-f]{64}$/);
  assert.equal(first, second);
  assert.notEqual(first, changed);
});

test("configuration fingerprint includes every mutable non-secret setting", () => {
  const config = validateCadenceRuntimeConfig(valid);
  const baseline = fingerprintCadenceRuntimeConfig(config);
  const mutations: Array<[string, (base: typeof config) => typeof config]> = [
    ["environment", (base) => ({
      ...base, application: { ...base.application, environment: "qa" }
    })],
    ["publicUrl", (base) => ({
      ...base, application: { ...base.application, publicUrl: "https://cadence-beta-2.example.test" }
    })],
    ["apiBaseUrl", (base) => ({
      ...base, application: { ...base.application, apiBaseUrl: "http://127.0.0.1:3000" }
    })],
    ["requestBodyLimitBytes", (base) => ({
      ...base, application: { ...base.application, requestBodyLimitBytes: 524288 }
    })],
    ["runtime.provider", (base) => ({
      ...base, runtime: { provider: "node" }
    })],
    ["supabase.url/projectRef", (base) => ({
      ...base, supabase: {
        ...base.supabase, url: "https://xyz789.supabase.co", projectRef: "xyz789"
      }
    })],
    ["supabase.publishableKey", (base) => ({
      ...base, supabase: { ...base.supabase, publishableKey: "sb_publishable_other" }
    })],
    ["supabase.secretKeySecretRef", (base) => ({
      ...base, supabase: { ...base.supabase, secretKeySecretRef: "CADENCE_SUPABASE_SECRET_KEY" }
    })],
    ["pilot.projectId", (base) => ({
      ...base, pilot: { ...base.pilot, projectId: "22222222-2222-4222-8222-222222222222" }
    })],
    ["pilot.safeTargetMarker", (base) => ({
      ...base, pilot: { ...base.pilot, safeTargetMarker: "cadence-beta-2" }
    })],
    ["worker.schedule", (base) => ({
      ...base, worker: { ...base.worker, schedule: "*/2 * * * *" }
    })],
    ["worker.maxRounds", (base) => ({
      ...base, worker: { ...base.worker, maxRounds: 9 }
    })],
    ["worker.maxDeliveryAttempts", (base) => ({
      ...base, worker: { ...base.worker, maxDeliveryAttempts: 19 }
    })],
    ["worker.maxMembershipExpiryAttempts", (base) => ({
      ...base, worker: { ...base.worker, maxMembershipExpiryAttempts: 19 }
    })],
    ["worker.softDeadlineSeconds", (base) => ({
      ...base, worker: { ...base.worker, softDeadlineSeconds: 19 }
    })],
    ["retry.delaysSeconds", (base) => ({
      ...base, retry: { delaysSeconds: [60, 600, 1800] }
    })]
  ];

  for (const [name, mutate] of mutations) {
    assert.notEqual(
      fingerprintCadenceRuntimeConfig(mutate(config)),
      baseline,
      `${name} must change the canonical config fingerprint`
    );
  }
});

test("rejects beta Supabase URL/project-ref mismatch", () => {
  assert.throws(
    () => validateCadenceRuntimeConfig({
      ...valid,
      supabase: { ...valid.supabase, projectRef: "wrong" }
    }),
    /Supabase project reference does not match/
  );
});

test("rejects invalid worker resource bounds", () => {
  assert.throws(
    () => validateCadenceRuntimeConfig({
      ...valid,
      worker: { ...valid.worker, maxDeliveryAttempts: 0 }
    }),
    /maxDeliveryAttempts/
  );
});

test("rejects resource settings outside the M1 safety envelope", () => {
  for (const value of [
    { application: { ...valid.application, requestBodyLimitBytes: 1048577 } },
    { worker: { ...valid.worker, maxRounds: 101 } },
    { worker: { ...valid.worker, maxDeliveryAttempts: 201 } },
    { worker: { ...valid.worker, maxMembershipExpiryAttempts: 0 } },
    { worker: { ...valid.worker, softDeadlineSeconds: 31 } }
  ]) {
    assert.throws(() => validateCadenceRuntimeConfig({ ...valid, ...value }));
  }
});

test("resolves only the configured server secret reference", () => {
  const config = validateCadenceRuntimeConfig(valid);
  const resolved = resolveCadenceSecrets(config, {
    SUPABASE_SECRET_KEY: "server-secret",
    EXTRA_VALUE: "must-not-be-consumed"
  });
  assert.deepEqual(resolved, { supabaseSecretKey: "server-secret" });
});
```

Add these explicit semantic-validation cases after the happy-path tests:

```ts
test("local accepts loopback Supabase with no hosted project ref", () => {
  assert.doesNotThrow(() => validateCadenceRuntimeConfig({
    ...valid,
    application: {
      ...valid.application,
      environment: "local",
      publicUrl: "http://127.0.0.1:5173",
      apiBaseUrl: "http://127.0.0.1:3000"
    },
    runtime: { provider: "node" },
    supabase: {
      ...valid.supabase,
      url: "http://127.0.0.1:54321",
      projectRef: null
    }
  }));
});

test("rejects malformed public/Supabase URLs", () => {
  assert.throws(
    () => validateCadenceRuntimeConfig({
      ...valid,
      application: { ...valid.application, publicUrl: "not-a-url" }
    }),
    /URL/
  );
  assert.throws(
    () => validateCadenceRuntimeConfig({
      ...valid,
      supabase: { ...valid.supabase, url: "not-a-url" }
    }),
    /URL/
  );
  assert.throws(
    () => validateCadenceRuntimeConfig({
      ...valid,
      application: { ...valid.application, apiBaseUrl: "http://not-allowed.example" }
    }),
    /apiBaseUrl|same-origin/
  );
});

test("rejects unsupported environment and provider", () => {
  assert.throws(
    () => validateCadenceRuntimeConfig({
      ...valid,
      application: { ...valid.application, environment: "production" }
    }),
    /environment/
  );
  assert.throws(
    () => validateCadenceRuntimeConfig({
      ...valid,
      runtime: { provider: "unknown" }
    }),
    /provider/
  );
});

test("rejects invalid pilot project id and empty secret reference", () => {
  assert.throws(
    () => validateCadenceRuntimeConfig({
      ...valid,
      pilot: { ...valid.pilot, projectId: "not-a-uuid" }
    }),
    /projectId/
  );
  assert.throws(
    () => validateCadenceRuntimeConfig({
      ...valid,
      supabase: { ...valid.supabase, secretKeySecretRef: "" }
    }),
    /secretKeySecretRef/
  );
});

test("rejects retry delays that are nonpositive or decreasing", () => {
  for (const delaysSeconds of [[0, 60], [60, 30]]) {
    assert.throws(
      () => validateCadenceRuntimeConfig({
        ...valid,
        retry: { delaysSeconds }
      }),
      /delaysSeconds/
    );
  }
});
```

Add the config-locator test:

```ts
test("config path uses --config before CADENCE_CONFIG_PATH and otherwise fails closed", () => {
  assert.equal(
    resolveCadenceConfigPath({
      argv: ["node", "server", "--config", "config/cadence.runtime.beta.json"],
      environment: { CADENCE_CONFIG_PATH: "wrong.json" }
    }),
    "config/cadence.runtime.beta.json"
  );

  assert.equal(
    resolveCadenceConfigPath({
      argv: ["node", "server"],
      environment: { CADENCE_CONFIG_PATH: "config/cadence.runtime.local.json" }
    }),
    "config/cadence.runtime.local.json"
  );

  assert.throws(
    () => resolveCadenceConfigPath({ argv: ["node", "server"], environment: {} }),
    /Cadence config path is required/
  );
});
```

Also assert the tracked JSON schema is an exact serialization-equivalent of `CADENCE_RUNTIME_CONFIG_SCHEMA`; this prevents a second hand-maintained schema authority.

- [ ] **Step 2: Write release-identity RED tests**

`cadence-release.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { loadCadenceReleaseIdentity } from "./cadence-release";

test("normalizes safe release identity", () => {
  assert.deepEqual(
    loadCadenceReleaseIdentity({
      version: "1.0.0",
      commitSha: "0123456789abcdef0123456789abcdef01234567",
      buildId: "2026-09-04T10:00:00Z"
    }),
    {
      version: "1.0.0",
      commitSha: "0123456789abcdef0123456789abcdef01234567",
      buildId: "2026-09-04T10:00:00Z"
    }
  );
});

test("rejects an invalid commit SHA", () => {
  assert.throws(
    () => loadCadenceReleaseIdentity({
      version: "1.0.0",
      commitSha: "main",
      buildId: "2026-09-04T10:00:00Z"
    }),
    /commit SHA/
  );
});
```

- [ ] **Step 3: Run focused tests and verify RED**

```powershell
cd apps/api
node --import tsx --test src/bootstrap/cadence-config.test.ts src/bootstrap/cadence-release.test.ts
```

Expected: FAIL because modules do not exist.

- [ ] **Step 4: Add Ajv and implement the minimal validator/loader**

Install:

```powershell
npm install --save-exact ajv@8.17.1
```

Define `CADENCE_RUNTIME_CONFIG_SCHEMA` as a plain JSON-compatible object in `cadence-config-schema.ts`. `cadence-config.ts` compiles that object with Ajv, so runtime validation works in Node and Workers without reading a schema file through `node:fs`. `vs005-write-config-schema.ts` writes the same object to `config/cadence.runtime.schema.json` using stable two-space JSON; the JSON file is generated documentation/tooling input, not a hand-edited second schema.

Define exact public interfaces in `cadence-config.ts`:

```ts
export type CadenceEnvironment = "local" | "qa" | "beta";
export type CadenceRuntimeProvider = "node" | "cloudflare";

export interface CadenceRuntimeConfig {
  configVersion: 1;
  application: {
    name: "cadence";
    environment: CadenceEnvironment;
    publicUrl: string;
    apiBaseUrl: string;
    requestBodyLimitBytes: number;
  };
  runtime: {
    provider: CadenceRuntimeProvider;
  };
  supabase: {
    url: string;
    projectRef: string | null;
    publishableKey: string;
    secretKeySecretRef: string;
  };
  pilot: {
    projectId: string;
    safeTargetMarker: string;
  };
  worker: {
    schedule: string;
    maxRounds: number;
    maxDeliveryAttempts: number;
    maxMembershipExpiryAttempts: number;
    softDeadlineSeconds: number;
  };
  retry: {
    delaysSeconds: readonly number[];
  };
}

export interface CadenceResolvedSecrets {
  supabaseSecretKey: string;
}

export function loadCadenceRuntimeConfig(path: string): CadenceRuntimeConfig;
export function validateCadenceRuntimeConfig(value: unknown): CadenceRuntimeConfig;
export function fingerprintCadenceRuntimeConfig(config: CadenceRuntimeConfig): string;
export function resolveCadenceConfigPath(input: {
  argv: readonly string[];
  environment: Readonly<Record<string, string | undefined>>;
}): string;
export function resolveCadenceSecrets(
  config: CadenceRuntimeConfig,
  source: Readonly<Record<string, string | undefined>>
): CadenceResolvedSecrets;
```

The fingerprint is lowercase SHA-256 over a deliberately constructed JSON object containing **all** validated non-secret config fields in fixed schema order (including `configVersion`, application, runtime, Supabase public/ref/key + secret reference name, pilot target, worker bounds/schedule, and retry policy). Do not fingerprint the original file text, whitespace, file path, or any secret value. This single helper is reused by plan/apply/health/provider generation; do not create a second fingerprint algorithm.

Configuration schema/semantic validation must enforce the M1 resource envelope exactly:

```text
application.requestBodyLimitBytes: integer 1024..1048576
worker.maxRounds: integer 1..100
worker.maxDeliveryAttempts: integer 1..200
worker.maxMembershipExpiryAttempts: integer 1..100
worker.softDeadlineSeconds: integer 1..30
retry.delaysSeconds: 1..8 entries, each integer 1..86400, nondecreasing
```

The committed CI/example default remains `1048576 / 10 / 20 / 20 / 20` respectively. A future need outside this envelope requires an explicit config-schema review rather than silently weakening M1 cost/resource safety.

The loader must parse the selected runtime JSON file, validate it with the in-code `CADENCE_RUNTIME_CONFIG_SCHEMA` compiled by Ajv, then apply semantic invariants equivalent to the current `environment-safety.ts`. The planning choice is deliberate: `supabase.publishableKey` is stored as a canonical **public** value because the approved design classifies the browser publishable key as public configuration; only the privileged Supabase secret key remains a secret reference/value outside committed config. The tracked `config/cadence.runtime.schema.json` is generated from that same object for tooling/documentation and is never loaded as a second runtime authority. `application.apiBaseUrl` is the single browser API-location setting: hosted Cloudflare Beta requires `""` for same-origin `/api/v1`; local Node development may use `http://127.0.0.1:3000`. `application.publicUrl` must be an origin URL with `/` path and no query/fragment so the Cloudflare adapter can derive a stable route/custom-domain target without another hostname setting. Do not let structural schema validation become the sole target-safety control.

`cadence-release.ts`:

```ts
export interface CadenceReleaseIdentity {
  version: string;
  commitSha: string;
  buildId: string;
}
```

Broaden `apps/api/tsconfig.scripts.json` so **all** API scripts, their tests, existing VS004 scripts, and every new VS005 helper are typechecked without enumerating files one by one:

```json
"include": [
  "scripts/**/*.ts",
  "src/**/*.ts"
]
```

Do not drop existing VS004 script coverage. This broader include is intentional because Task 4 also adds config/DB-safety helpers whose filenames are not prefixed `vs005-`.

- [ ] **Step 5: Generate the schema file and add deterministic config files**

Run:

```powershell
cd apps/api
node --import tsx scripts/vs005-write-config-schema.ts
```

Expected: `config/cadence.runtime.schema.json` is regenerated deterministically from `CADENCE_RUNTIME_CONFIG_SCHEMA`.

`config/cadence.runtime.ci.json` must be exactly this deterministic, non-secret hosted fixture so every later CI/test helper has one concrete input:

```json
{
  "configVersion": 1,
  "application": {
    "name": "cadence",
    "environment": "beta",
    "publicUrl": "https://cadence-ci.example.invalid",
    "apiBaseUrl": "",
    "requestBodyLimitBytes": 1048576
  },
  "runtime": { "provider": "cloudflare" },
  "supabase": {
    "url": "https://abc123.supabase.co",
    "projectRef": "abc123",
    "publishableKey": "sb_publishable_ci",
    "secretKeySecretRef": "SUPABASE_SECRET_KEY"
  },
  "pilot": {
    "projectId": "11111111-1111-4111-8111-111111111111",
    "safeTargetMarker": "cadence-ci"
  },
  "worker": {
    "schedule": "* * * * *",
    "maxRounds": 10,
    "maxDeliveryAttempts": 20,
    "maxMembershipExpiryAttempts": 20,
    "softDeadlineSeconds": 20
  },
  "retry": { "delaysSeconds": [60, 300, 900, 3600] }
}
```

`config/cadence.runtime.example.json` documents the same schema with `.example.invalid`/test identifiers and explanatory values, not real credentials. Do not commit a real `SUPABASE_SECRET_KEY` or any private development credential.

- [ ] **Step 6: Run focused and API type checks**

```powershell
cd apps/api
node --import tsx --test src/bootstrap/cadence-config.test.ts src/bootstrap/cadence-release.test.ts
npx.cmd tsc --noEmit -p tsconfig.scripts.json
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit the configuration foundation**

```powershell
cd ..\..
git add config apps/api/src/bootstrap/cadence-config-schema.ts apps/api/src/bootstrap/cadence-config.ts apps/api/src/bootstrap/cadence-config.test.ts apps/api/src/bootstrap/cadence-release.ts apps/api/src/bootstrap/cadence-release.test.ts apps/api/scripts/vs005-write-config-schema.ts apps/api/tsconfig.scripts.json apps/api/package.json apps/api/package-lock.json
git diff --cached --check
git commit -m "feat(vs005): add canonical runtime configuration"
```

**Checkpoint deliverable:** Cadence has one typed/schema-validated provider-neutral runtime configuration model and safe release identity, with secret values excluded.

---

### Task 4: Cut Existing Environment and Database Targeting Over to Canonical Configuration

**Files:**
- Create: `apps/api/scripts/assert-runtime-config.ts`
- Create: `apps/api/scripts/assert-runtime-config.test.ts`
- Create: `apps/api/scripts/assert-supabase-target.ts`
- Create: `apps/api/scripts/assert-supabase-target.test.ts`
- Create: `apps/api/scripts/run-supabase-db-push.ts`
- Create: `apps/api/scripts/run-supabase-db-push.test.ts`
- Delete: `apps/api/scripts/assert-environment.ts`
- Modify: `apps/api/scripts/vs004-controlled-pilot-runtime-config.ts`
- Modify: `apps/api/scripts/vs004-controlled-pilot-runtime-config.test.ts`
- Modify: `apps/api/scripts/verify-beta-runtime.ts`
- Create: `apps/api/scripts/verify-beta-runtime.test.ts`
- Modify: `apps/api/scripts/bootstrap-local-dev.ts`
- Modify: `apps/api/scripts/bootstrap-vs003-runtime.ts`
- Modify: `apps/api/scripts/get-test-token.ts`
- Delete: `scripts/assert-supabase-link.cjs`
- Delete: `scripts/assert-supabase-explicit-target.cjs`
- Delete: `scripts/run-supabase-db-push.cjs`
- Modify: `apps/api/.env.example`
- Modify: `apps/api/package.json`
- Modify: `package.json`

**Interfaces:**
- Consumes: `loadCadenceRuntimeConfig()` and the semantic target checks from Task 3.
- Produces one config-driven environment/database safety path. Existing DB credentials remain secret-store/environment inputs, but `CADENCE_ENV`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `CADENCE_SUPABASE_PROJECT_REF`, `WEB_ORIGIN`, pilot project ID, safety marker, and the currently hardcoded Beta project ref cease to be independently maintained environment/script values. `PORT` remains an adapter-only platform transport binding.

- [ ] **Step 1: Write RED tests proving there is no second target source**

`assert-runtime-config.test.ts`:

```ts
import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { assertRuntimeConfig } from "./assert-runtime-config";

const ciConfigPath = resolve(
  process.cwd(),
  "../../config/cadence.runtime.ci.json"
);

test("accepts the expected environment from canonical config", () => {
  const result = assertRuntimeConfig({
    expectedEnvironment: "beta",
    configPath: ciConfigPath
  });
  assert.equal(result.environment, "beta");
  assert.equal(result.supabaseProjectRef, "abc123");
});

test("rejects a command/environment mismatch", () => {
  assert.throws(
    () => assertRuntimeConfig({
      expectedEnvironment: "qa",
      configPath: ciConfigPath
    }),
    /requires environment qa/
  );
});
```

`assert-supabase-target.test.ts` must inject a linked-project-ref reader and prove all three facts agree:

```ts
canonical config projectRef === Supabase URL host project ref === linked CLI project ref
```

It must also contain a source regression assertion that is RED against the current repository and remains valid after the old file is deleted:

```ts
const candidates = [
  resolve(repoRoot, "scripts/assert-supabase-explicit-target.cjs"),
  resolve(repoRoot, "scripts/assert-supabase-link.cjs"),
  resolve(repoRoot, "scripts/run-supabase-db-push.cjs"),
  resolve(repoRoot, "package.json")
];

const executableTargetSources = candidates
  .filter(existsSync)
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");

assert.doesNotMatch(
  executableTargetSources,
  /pwmhasbmacmeerbsagda/
);
```

At RED, the current hardcoded Beta target makes this fail. At GREEN, the obsolete script is removed and no replacement source owns that project ref.

`run-supabase-db-push.test.ts` must inject `spawnSync` and assert the generated command uses only the validated `projectRef` returned by `assertSupabaseTarget`, never a hardcoded constant.

- [ ] **Step 2: Run RED against the current duplicated/hardcoded configuration paths**

```powershell
cd apps/api
node --import tsx --test `
  scripts/assert-runtime-config.test.ts `
  scripts/assert-supabase-target.test.ts `
  scripts/run-supabase-db-push.test.ts
```

Expected: FAIL because the new config-driven scripts do not exist and the old root Beta script still owns a hardcoded project ref.

- [ ] **Step 3: Implement one config-driven environment assertion**

`assert-runtime-config.ts` exports:

```ts
export function assertRuntimeConfig(input: {
  expectedEnvironment: "local" | "qa" | "beta";
  configPath: string;
}): {
  environment: "local" | "qa" | "beta";
  supabaseUrl: string;
  supabaseProjectRef: string | null;
};
```

It loads canonical JSON through `loadCadenceRuntimeConfig()`, checks the command's expected environment, and prints only the environment and safe Supabase host/project ref.

- [ ] **Step 4: Implement one config-driven remote Supabase target assertion**

`assert-supabase-target.ts` exports:

```ts
export function assertSupabaseTarget(input: {
  expectedEnvironment: "qa" | "beta";
  configPath: string;
  linkedProjectRef: string;
  dbPasswordPresent: boolean;
}): {
  environment: "qa" | "beta";
  projectRef: string;
};
```

Rules:

```text
- load canonical config;
- require config.environment === expectedEnvironment;
- require hosted `https://${projectRef}.supabase.co` target;
- require nonblank projectRef;
- require linked Supabase CLI project ref === config projectRef;
- require DB password presence by boolean only;
- never log the password;
- no environment-specific project-ref constant exists in source.
```

- [ ] **Step 5: Replace the DB push wrapper with a TypeScript config-driven wrapper**

`run-supabase-db-push.ts` accepts:

```text
--env qa|beta
--config config/cadence.runtime.beta.json
--dry-run (optional flag)
```

It reads `SUPABASE_DB_PASSWORD` only as a secret value, calls `assertSupabaseTarget()`, and then invokes:

```text
npx supabase db push --project-ref ${validatedProjectRef} --dry-run
# omit --dry-run only for the separately authorized push command
```

No project ref, URL, or environment identity is read from `.env`.

- [ ] **Step 6: Remove the old duplicate/hardcoded target scripts and reduce `.env.example` to secrets/locators**

`apps/api/.env.example` may document values such as:

```dotenv
# Locator/build metadata, not Cadence business/runtime settings
CADENCE_CONFIG_PATH=../../config/cadence.runtime.example.json

# Secret values only
SUPABASE_SECRET_KEY=
SUPABASE_DB_PASSWORD=
CADENCE_LOCAL_DEV_PASSWORD=
```

Do not retain `CADENCE_ENV`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `CADENCE_SUPABASE_PROJECT_REF`, `WEB_ORIGIN`, `CADENCE_PILOT_PROJECT_ID`, or `CADENCE_SAFE_TARGET_MARKER` as independently maintained `.env` settings after the cutover. The Node `PORT` variable may remain because it is supplied by the process host rather than representing Cadence configuration.

In this same checkpoint, change `loadControlledPilotRuntimeConfiguration()` so it loads those non-secret values from `CADENCE_CONFIG_PATH` through `loadCadenceRuntimeConfig()` and reads only `SUPABASE_SECRET_KEY` plus the optional `CADENCE_LOCAL_DEV_PASSWORD` from the environment. Preserve the existing `ControlledPilotRuntimeConfiguration` return shape so VS004 preflight/execute behavior does not change.

Likewise, change `verify-beta-runtime.ts`, `get-test-token.ts`, `bootstrap-local-dev.ts`, and `bootstrap-vs003-runtime.ts` so Supabase URL/project/public-key/pilot-target facts come from canonical config while passwords/test-user credentials remain secret/fixture inputs. Existing script tests must remain green; add direct config-cutover assertions where a script already has a focused test file.

Preserve the current **fresh-Beta emptiness check** as an explicit mode rather than making normal deployed verification depend on an empty database. Refactor `verify-beta-runtime.ts` to expose:

```ts
export async function verifyBetaRuntime(input: {
  config: CadenceRuntimeConfig;
  secretKey: string;
  requireEmptyApplicationData: boolean;
  sources: BetaRuntimeVerificationSources;
}): Promise<BetaRuntimeVerification>;
```

Preserve `beta:verify` as the backward-compatible fresh-target command and add the explicit alias `beta:verify:fresh`; both use `requireEmptyApplicationData=true`. Add `beta:verify:deployed` with `requireEmptyApplicationData=false` for VS005 deployment planning/verification after VS004 bootstrap. Both modes still verify critical tables, subscriptions, target safety, and anonymous sensitive-table exposure. Do not treat existing project/person/event rows as deployment drift once the pilot is initialized.

Make the data inspection injectable for tests:

```ts
export interface BetaRuntimeVerification {
  outcome: "PASS";
  requireEmptyApplicationData: boolean;
  criticalTablesVerified: readonly string[];
  subscriptionCount: number;
}

export interface BetaRuntimeVerificationSources {
  criticalTableAvailable(table: string): Promise<boolean>;
  tableCount(table: string): Promise<number>;
  subscriptionCount(): Promise<number>;
  anonymousRowVisible(table: string): Promise<boolean>;
}
```

The CLI path creates these sources from the validated Supabase clients and passes them explicitly into `verifyBetaRuntime()`. The verification function itself does not read process environment variables or construct a second target/configuration authority.

Add `verify-beta-runtime.test.ts` with these exact mode regressions:

```ts
test("fresh verification rejects existing application data", async () => {
  const sources = passingSources({ persons: 1 });
  await assert.rejects(
    () => verifyBetaRuntime({
      config: betaConfig,
      secretKey: "server-secret",
      requireEmptyApplicationData: true,
      sources
    }),
    /Fresh Beta invariant failed/
  );
});

test("deployed verification allows existing application data while keeping safety checks", async () => {
  const sources = passingSources({ persons: 7, project_memberships: 12 });
  const result = await verifyBetaRuntime({
    config: betaConfig,
    secretKey: "server-secret",
    requireEmptyApplicationData: false,
    sources
  });
  assert.equal(result.outcome, "PASS");
});

test("deployed verification still rejects anonymous sensitive-table exposure", async () => {
  const sources = passingSources({}, { visibleAnonymousTable: "persons" });
  await assert.rejects(
    () => verifyBetaRuntime({
      config: betaConfig,
      secretKey: "server-secret",
      requireEmptyApplicationData: false,
      sources
    }),
    /Anonymous Beta access exposed persons/
  );
});
```

`passingSources()` is a local fake whose critical tables exist, subscription count is nonzero, and anonymous rows are hidden unless overridden.

- [ ] **Step 7: Rewire package commands**

Use `--config`/`CADENCE_CONFIG_PATH` as the locator and keep secrets in the environment. Do not hardcode a real QA/Beta config filename inside executable package scripts because the plan does not invent target values. The root commands should forward an operator-supplied `--config` argument to one config-validating implementation:

```json
"db:qa:check": "npm --prefix apps/api run supabase:target:check -- --env qa",
"db:qa:preflight": "npm --prefix apps/api run supabase:db:push -- --env qa --dry-run",
"db:qa:push": "npm --prefix apps/api run supabase:db:push -- --env qa",
"db:beta:check": "npm --prefix apps/api run supabase:target:check -- --env beta",
"db:beta:preflight": "npm --prefix apps/api run supabase:db:push -- --env beta --dry-run",
"db:beta:push": "npm --prefix apps/api run supabase:db:push -- --env beta"
```

For example:

```powershell
npm run db:beta:preflight -- --config config/cadence.runtime.beta.json
npm run db:beta:push -- --config config/cadence.runtime.beta.json
```

`run-supabase-db-push.ts` performs `assertSupabaseTarget()` itself before invoking the CLI, so preflight/push do not chain a second target check that could consume a different locator. `db:*:check` remains a read-only convenience command. QA/Beta commands must never fall back to the old duplicated target variables.

- [ ] **Step 8: Run RED-to-GREEN checks and scan for the old hardcoded Beta ref**

```powershell
cd apps/api
node --import tsx --test `
  scripts/assert-runtime-config.test.ts `
  scripts/assert-supabase-target.test.ts `
  scripts/run-supabase-db-push.test.ts `
  scripts/verify-beta-runtime.test.ts
npx.cmd tsc --noEmit -p tsconfig.scripts.json
node --import tsx --test scripts/vs004-controlled-pilot-runtime-config.test.ts scripts/bootstrap-vs003-runtime.test.ts
cd ..\..
git grep -n "pwmhasbmacmeerbsagda" -- .
git grep -n "CADENCE_ENV\|SUPABASE_URL\|SUPABASE_PUBLISHABLE_KEY\|CADENCE_SUPABASE_PROJECT_REF\|WEB_ORIGIN\|CADENCE_PILOT_PROJECT_ID\|CADENCE_SAFE_TARGET_MARKER" -- apps/api scripts package.json
```

Expected: the hardcoded Beta ref is absent from executable source/config duplicated locations; remaining old variable names are only compatibility tests/comments that are explicitly justified or are removed in the same checkpoint.

- [ ] **Step 9: Commit the config-authority cutover**

```powershell
cd ..\..
git add apps/api/scripts apps/api/.env.example apps/api/package.json package.json scripts
git diff --cached --check
git commit -m "refactor(vs005): centralize runtime target configuration"
```

**Checkpoint deliverable:** Existing API/DB safety commands no longer own duplicated environment/project-target settings, including the previously hardcoded Beta project ref; canonical config is the single operator source.

---

### Task 5: Extract Runtime-Neutral API Composition and Thin the Node Server Adapter

**Files:**
- Create: `apps/api/src/runtime/create-cadence-app.ts`
- Create: `apps/api/src/runtime/create-cadence-app.test.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/server.wiring.test.ts`
- Modify: `apps/api/src/bootstrap/environment-safety.ts`
- Modify: `apps/api/src/bootstrap/environment-safety.test.ts`
- Modify: `apps/api/src/bootstrap/environment-safety.wiring.test.ts`
- Modify: `apps/api/package.json`

**Interfaces:**
- Consumes: `CadenceRuntimeConfig`, `CadenceResolvedSecrets`, `CadenceReleaseIdentity` from Task 3.
- Produces:

```ts
export interface CadenceAppRuntime {
  config: CadenceRuntimeConfig;
  secrets: CadenceResolvedSecrets;
  release: CadenceReleaseIdentity;
}

export function createCadenceApp(runtime: CadenceAppRuntime): Express;
```

`server.ts` becomes a Node-only adapter that loads config + secrets + release identity, creates the app, and listens.

- [ ] **Step 1: Write RED app-composition tests**

`create-cadence-app.test.ts` must use these exact local HTTP helpers so tests do not require another library:

```ts
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { Express } from "express";

async function startTestApp(app: Express): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    })
  };
}

async function requestHealth(app: Express): Promise<{ status: number; body: unknown }> {
  const { baseUrl, close } = await startTestApp(app);
  try {
    const response = await fetch(`${baseUrl}/health`);
    return { status: response.status, body: await response.json() };
  } finally {
    await close();
  }
}
```

Then assert:

```ts
test("health exposes safe release/config identity", async () => {
  const response = await requestHealth(app);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    status: "ok",
    service: "cadence-api",
    environment: "beta",
    configVersion: 1,
    configFingerprint: fingerprintCadenceRuntimeConfig(runtime.config),
    version: "1.0.0",
    commitSha: "0123456789abcdef0123456789abcdef01234567",
    buildId: "2026-09-04T10:00:00Z"
  });
});

test("health does not expose server secrets or pilot project identity", async () => {
  const text = JSON.stringify((await requestHealth(app)).body);
  assert.doesNotMatch(text, /server-secret/);
  assert.doesNotMatch(text, /11111111-1111-4111-8111-111111111111/);
  assert.doesNotMatch(text, /safeTargetMarker/);
});
```

Add this concrete request-size regression in the same test file (the helper starts the app on an ephemeral port and returns the base URL):

```ts
test("request body limit rejects oversized JSON before business routing", async () => {
  const { baseUrl, close } = await startTestApp(app);
  try {
    const response = await fetch(`${baseUrl}/api/v1/projects/not-a-real-project`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: "x".repeat(runtime.config.application.requestBodyLimitBytes + 1) })
    });

    assert.equal(response.status, 413);
  } finally {
    await close();
  }
});
```

The test runtime uses a small limit such as `256`; it must not depend on a live Supabase call because the body parser rejects the request before route/auth execution.

- [ ] **Step 2: Update wiring test before moving composition**

Change `server.wiring.test.ts` to inspect `src/runtime/create-cadence-app.ts`, not `src/server.ts`, for the existing role-management/membership-lifecycle wiring. Add a second assertion that `server.ts` no longer constructs module repositories/services directly.

Rewrite `environment-safety.wiring.test.ts` for the new bootstrap boundary instead of deleting the invariant. It must prove:

```text
server.ts: resolve/load validated canonical config -> resolve secrets -> createCadenceApp
worker.ts: resolve/load validated canonical config -> resolve secrets -> runCadenceWorkerCycle
cadence-config.ts: semantic validation calls validateCadenceEnvironmentSafety
create-cadence-app.ts/create-cadence-worker-services.ts: no process.env reads
```

The test must fail if Supabase-backed runtime composition can be reached from a Node adapter before canonical config validation.

- [ ] **Step 3: Run focused tests and verify RED**

```powershell
cd apps/api
node --import tsx --test src/runtime/create-cadence-app.test.ts src/server.wiring.test.ts
```

Expected: FAIL because `create-cadence-app.ts` does not exist and server is still monolithic.

- [ ] **Step 4: Move composition without changing authority behavior**

Move the existing Express middleware/routes/service/repository composition from `server.ts` into `createCadenceApp(runtime)` with minimal semantic changes. Preserve `ProjectAuthorisationService`, repositories, route prefixes, auth middleware, and request tracing.

Use the configured request limit:

```ts
app.use(express.json({
  limit: runtime.config.application.requestBodyLimitBytes,
}));
```

Derive CORS from the canonical public origin rather than `WEB_ORIGIN`:

```ts
const allowedOrigin = new URL(runtime.config.application.publicUrl).origin;
app.use(cors({ origin: allowedOrigin }));
```

For the hosted same-origin M1 path, this keeps browser/API origin authority in `application.publicUrl`; for local Node development the canonical local public URL supplies the allowed Vite origin. Do not retain a second `WEB_ORIGIN` setting.

Use one safe health object constructed only from `runtime.config.application.environment`, `runtime.config.configVersion`, `fingerprintCadenceRuntimeConfig(runtime.config)`, and `runtime.release`.

- [ ] **Step 5: Make `server.ts` a thin Node adapter**

The final `server.ts` bootstrap shape must be:

```ts
const configPath = resolveCadenceConfigPath({
  argv: process.argv,
  environment: process.env
});
const config = loadCadenceRuntimeConfig(configPath);
const secrets = resolveCadenceSecrets(config, process.env);
const release = loadCadenceReleaseIdentity({
  version: process.env.CADENCE_RELEASE_VERSION,
  commitSha: process.env.CADENCE_COMMIT_SHA,
  buildId: process.env.CADENCE_BUILD_ID,
});

const app = createCadenceApp({ config, secrets, release });
const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`Cadence API listening on ${port}`));
```

Only the bootstrap adapter may read `process.env`. Domain/application modules may not.

- [ ] **Step 6: Reconcile `environment-safety.ts` as the pure semantic target guard**

Keep `validateCadenceEnvironmentSafety()` as a pure value-in/value-out helper and make `cadence-config.ts` its only runtime-configuration caller. It must not read `process.env`, a file, or provider bindings itself. In `cadence-config.ts`, invoke it exactly from validated canonical fields:

```ts
const safety = validateCadenceEnvironmentSafety({
  cadenceEnv: config.application.environment,
  supabaseUrl: config.supabase.url,
  supabaseProjectRef: config.supabase.projectRef ?? undefined
});

return Object.freeze({
  ...config,
  application: Object.freeze({ ...config.application, environment: safety.cadenceEnv }),
  supabase: Object.freeze({
    ...config.supabase,
    url: safety.supabaseUrl,
    projectRef: safety.supabaseProjectRef
  })
});
```

Update `environment-safety.wiring.test.ts` so it no longer requires `server.ts`/`worker.ts` to read `process.env.CADENCE_ENV` or `CADENCE_SUPABASE_PROJECT_REF`; instead assert that `cadence-config.ts` calls `validateCadenceEnvironmentSafety()` and that the Node adapters call `loadCadenceRuntimeConfig()`. This leaves one operator configuration authority while preserving the existing semantic guard.

- [ ] **Step 7: Run focused and full API checks**

```powershell
cd apps/api
node --import tsx --test src/runtime/create-cadence-app.test.ts src/server.wiring.test.ts src/bootstrap/environment-safety.test.ts src/bootstrap/environment-safety.wiring.test.ts
npm run typecheck
npm test
```

Expected: all PASS.

- [ ] **Step 8: Commit**

```powershell
cd ..\..
git add apps/api/src/runtime apps/api/src/server.ts apps/api/src/server.wiring.test.ts apps/api/src/bootstrap/environment-safety.ts apps/api/src/bootstrap/environment-safety.test.ts apps/api/src/bootstrap/environment-safety.wiring.test.ts apps/api/package.json
git diff --cached --check
git commit -m "refactor(vs005): extract portable API composition"
```

**Checkpoint deliverable:** The same governed API composition is callable independently of the Node process adapter, with safe health/release identity and bounded request bodies.

---

### Task 6: Derive Browser Configuration from the Canonical Source

**Files:**
- Create: `apps/api/scripts/vs005-generate-web-config.ts`
- Create: `apps/api/scripts/vs005-generate-web-config.test.ts`
- Modify: `apps/api/package.json`
- Modify: `apps/web/vite.config.ts`
- Modify: `apps/web/src/lib/env.ts`
- Create: `apps/web/src/lib/env.test.ts`
- Modify: `apps/web/package.json`
- Delete: `apps/web/scripts/assert-environment.cjs`
- Modify: `apps/web/.env.example`
- Delete: `apps/web/.env.ci`
- Create generated/ignored target: `apps/web/.generated/cadence-public-config.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: the canonical JSON configuration from Task 3.
- Produces one generated browser-safe config artifact per build. The artifact is derived, ignored, and never operator-edited.
- The browser no longer owns separate `VITE_CADENCE_ENV`, `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_REF`, or `VITE_PROJECT_ID` settings.

Use this exact generated shape:

```ts
export interface CadencePublicWebConfig {
  cadenceEnvironment: "local" | "qa" | "beta";
  apiBaseUrl: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
  supabaseProjectRef: string | null;
  projectId: string;
}

export function buildCadencePublicWebConfig(
  config: CadenceRuntimeConfig
): CadencePublicWebConfig;

export interface BrowserEnvironmentSource {
  VITE_CADENCE_ENV?: string;
  VITE_API_BASE_URL?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLIC_KEY?: string;
  VITE_SUPABASE_PROJECT_REF?: string;
  VITE_PROJECT_ID?: string;
}

export function getBrowserEnvironment(
  source?: BrowserEnvironmentSource
): BrowserEnvironment;
```

`getBrowserEnvironment()` defaults `source` to the Vite-defined `import.meta.env` values in normal browser execution; tests pass an explicit source object. This is dependency injection for parsing only, not a second operator configuration path.

- [ ] **Step 1: Write RED public-config generation tests**

`apps/api/scripts/vs005-generate-web-config.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { buildCadencePublicWebConfig } from "./vs005-generate-web-config";

const betaConfig = validBetaConfig();

test("hosted web config uses the canonical same-origin API base", () => {
  const result = buildCadencePublicWebConfig(betaConfig);
  assert.equal(result.apiBaseUrl, "");
  assert.equal(result.cadenceEnvironment, "beta");
  assert.equal(result.supabaseUrl, "https://abc123.supabase.co");
  assert.equal(result.supabaseProjectRef, "abc123");
});

test("generated browser config exposes no server secret reference or value", () => {
  const text = JSON.stringify(buildCadencePublicWebConfig(betaConfig));
  assert.doesNotMatch(text, /SUPABASE_SECRET_KEY|secretKeySecretRef|server-secret/i);
});

test("local web config derives the canonical local API URL", () => {
  const local = validLocalConfig({
    application: {
      publicUrl: "http://127.0.0.1:5173",
      apiBaseUrl: "http://127.0.0.1:3000"
    }
  });
  assert.equal(buildCadencePublicWebConfig(local).apiBaseUrl, "http://127.0.0.1:3000");
});
```

`validBetaConfig()` / `validLocalConfig()` are local test fixtures using the exact Task 3 config interface.

- [ ] **Step 2: Write RED browser-consumer tests**

`apps/web/src/lib/env.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getBrowserEnvironment } from "./env";

it("accepts generated same-origin hosted values", () => {
  const result = getBrowserEnvironment({
    VITE_CADENCE_ENV: "beta",
    VITE_API_BASE_URL: "",
    VITE_SUPABASE_URL: "https://abc123.supabase.co",
    VITE_SUPABASE_PUBLIC_KEY: "sb_publishable_test",
    VITE_SUPABASE_PROJECT_REF: "abc123",
    VITE_PROJECT_ID: "11111111-1111-4111-8111-111111111111"
  });
  expect(result.apiBaseUrl).toBe("");
});

it("browser source contains no privileged Supabase credential path", () => {
  const source = readFileSync("src/lib/env.ts", "utf8");
  expect(source).not.toMatch(/SECRET_KEY|SERVICE_ROLE/);
});
```

- [ ] **Step 3: Run RED**

```powershell
cd apps/api
node --import tsx --test scripts/vs005-generate-web-config.test.ts
cd ..\web
npm test -- src/lib/env.test.ts
```

Expected: FAIL because the generator/browser contract is not implemented yet.

- [ ] **Step 4: Implement the validated public-config generator**

`vs005-generate-web-config.ts` must load canonical config through `loadCadenceRuntimeConfig()` in its CLI path, call `buildCadencePublicWebConfig()`, and write stable two-space JSON to the requested `--out` path. It must never copy `supabase.secretKeySecretRef` or any environment secret.

CLI shape:

```text
node --import tsx scripts/vs005-generate-web-config.ts \
  --config ../../config/cadence.runtime.ci.json \
  --out ../web/.generated/cadence-public-config.json
```

- [ ] **Step 5: Make Vite consume only the generated public artifact**

`vite.config.ts` reads `apps/web/.generated/cadence-public-config.json` and defines exactly:

```ts
"import.meta.env.VITE_CADENCE_ENV"
"import.meta.env.VITE_API_BASE_URL"
"import.meta.env.VITE_SUPABASE_URL"
"import.meta.env.VITE_SUPABASE_PUBLIC_KEY"
"import.meta.env.VITE_SUPABASE_PROJECT_REF"
"import.meta.env.VITE_PROJECT_ID"
```

It must fail with an actionable message if the generated artifact is absent. It must not read the old `VITE_*` values from `.env` as operator authority.

- [ ] **Step 6: Rewire Web commands and remove duplicate `.env` configuration**

Use generator-first commands. For example:

```json
"config:ci": "npm --prefix ../api run vs005:web-config -- --config ../../config/cadence.runtime.ci.json --out ../web/.generated/cadence-public-config.json",
"build:ci": "npm run config:ci && tsc -b && vite build --mode ci",
"config:local": "npm --prefix ../api run vs005:web-config -- --config ../../config/cadence.runtime.local.json --out ../web/.generated/cadence-public-config.json",
"build:local": "npm run config:local && tsc -b && vite build --mode development"
```

Add these exact commands as well:

```json
"config:qa": "npm --prefix ../api run vs005:web-config -- --config ../../config/cadence.runtime.qa.json --out ../web/.generated/cadence-public-config.json",
"config:beta": "npm --prefix ../api run vs005:web-config -- --config ../../config/cadence.runtime.beta.json --out ../web/.generated/cadence-public-config.json"
```

Deployment orchestration may invoke the generator directly with another explicit `--config` path; every public value still comes only from that selected canonical file.

Delete `apps/web/scripts/assert-environment.cjs` and `.env.ci`. Reduce `.env.example` to a note pointing operators to canonical config rather than listing duplicate values.

Add to root `.gitignore`:

```gitignore
apps/web/.generated/
```

Remove the obsolete `!apps/web/.env.ci` exception if no longer needed.

- [ ] **Step 7: Run Web/config checks**

```powershell
cd apps/api
node --import tsx --test scripts/vs005-generate-web-config.test.ts
npx.cmd tsc --noEmit -p tsconfig.scripts.json
cd ..\web
npm test -- src/lib/env.test.ts
npm test
npm run lint
npm run build:ci
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
cd ..\..
git add apps/api/scripts/vs005-generate-web-config.ts apps/api/scripts/vs005-generate-web-config.test.ts apps/api/package.json apps/web .gitignore config/cadence.runtime.ci.json
git diff --cached --check
git commit -m "refactor(vs005): centralize browser runtime configuration"
```

**Checkpoint deliverable:** Browser build settings are generated from the canonical Cadence configuration, hosted API calls are same-origin, and no privileged server setting is browser-build authority.

---

### Task 7: Implement the Runtime-Neutral Bounded Worker Cycle

**Files:**
- Create: `apps/api/src/runtime/cadence-worker-cycle.ts`
- Create: `apps/api/src/runtime/cadence-worker-cycle.test.ts`
- Create: `apps/api/src/runtime/create-cadence-worker-services.ts`
- Create: `apps/api/src/runtime/create-cadence-worker-services.test.ts`
- Modify: `apps/api/src/modules/project-membership/project-membership-lifecycle.repository.ts`
- Modify: `apps/api/src/modules/project-membership/project-membership-expiry.processor.ts`
- Modify: `apps/api/src/modules/project-membership/project-membership-expiry.processor.test.ts`
- Modify: `apps/api/src/infrastructure/database/supabase-project-membership-lifecycle.repository.ts`
- Modify: `apps/api/src/infrastructure/database/supabase-project-membership-lifecycle.repository.test.ts`
- Modify: `apps/api/src/worker.ts`
- Modify: `apps/api/src/worker.wiring.test.ts`

**Interfaces:**
- Produces:

```ts
export type WorkerCycleOutcome = "SUCCESS" | "DEGRADED" | "FAILED";

export interface CadenceWorkerCycleResult {
  runId: string;
  runtime: "node" | "cloudflare";
  environment: "local" | "qa" | "beta";
  release: CadenceReleaseIdentity;
  startedAt: string;
  completedAt: string;
  outcome: WorkerCycleOutcome;
  membershipExpiry: {
    finalisedCount: number;
    conflictCount: number;
    failureCount: number;
    remainingDueDetected: boolean;
  };
  audit: { processedCount: number; failureCount: number };
  teamAgent: { processedCount: number; failureCount: number };
  maxRoundsReached: boolean;
  maxDeliveryAttemptsReached: boolean;
  maxMembershipExpiryAttemptsReached: boolean;
  softDeadlineReached: boolean;
  remainingWorkDetected: boolean;
  failures: readonly { job: "runtime" | "membership-expiry" | "audit" | "team-agent"; code: string }[];
}

// Extend the existing Project Membership result in
// project-membership-expiry.processor.ts with the look-ahead fact:
export interface MembershipExpiryProcessingResult {
  finalised: ProjectMembershipTerminationResult[];
  conflicts: MembershipExpiryConflict[];
  remainingDue: boolean;
}

export interface CadenceWorkerCycleServices {
  processMembershipExpiry(maxMemberships: number): Promise<MembershipExpiryProcessingResult>;
  processAuditNext(): Promise<boolean>;
  processTeamAgentNext(): Promise<boolean>;
}

export async function runCadenceWorkerCycle(input: {
  config: CadenceRuntimeConfig;
  release: CadenceReleaseIdentity;
  runtime: "node" | "cloudflare";
  servicesFactory: () => CadenceWorkerCycleServices | Promise<CadenceWorkerCycleServices>;
  clock?: () => Date;
  generateRunId?: () => string;
}): Promise<CadenceWorkerCycleResult>;

export function createCadenceWorkerServices(input: {
  config: CadenceRuntimeConfig;
  secrets: CadenceResolvedSecrets;
}): CadenceWorkerCycleServices;
```

- [ ] **Step 1: Write RED worker-cycle tests**

Use this core test set:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import type { CadenceRuntimeConfig } from "../bootstrap/cadence-config";
import type { CadenceReleaseIdentity } from "../bootstrap/cadence-release";
import { runCadenceWorkerCycle } from "./cadence-worker-cycle";

const config: CadenceRuntimeConfig = {
  configVersion: 1,
  application: {
    name: "cadence",
    environment: "beta",
    publicUrl: "https://cadence-beta.example.test",
    apiBaseUrl: "",
    requestBodyLimitBytes: 1048576
  },
  runtime: { provider: "node" },
  supabase: {
    url: "https://abc123.supabase.co",
    projectRef: "abc123",
    publishableKey: "sb_publishable_test",
    secretKeySecretRef: "SUPABASE_SECRET_KEY"
  },
  pilot: {
    projectId: "11111111-1111-4111-8111-111111111111",
    safeTargetMarker: "cadence-beta"
  },
  worker: {
    schedule: "* * * * *",
    maxRounds: 10,
    maxDeliveryAttempts: 20,
    maxMembershipExpiryAttempts: 20,
    softDeadlineSeconds: 20
  },
  retry: { delaysSeconds: [60, 300, 900, 3600] }
};

const release: CadenceReleaseIdentity = {
  version: "1.0.0",
  commitSha: "0123456789abcdef0123456789abcdef01234567",
  buildId: "2026-09-04T10:00:00Z"
};

const baseInput = {
  config,
  release,
  runtime: "node" as const,
  generateRunId: () => "run-1"
};

const noExpiry = async (_maxMemberships: number) => ({ finalised: [], conflicts: [], remainingDue: false });

test("Audit failure does not suppress Team Agent attempt", async () => {
  const calls: string[] = [];
  const result = await runCadenceWorkerCycle({
    ...baseInput,
    servicesFactory: () => ({
      processMembershipExpiry: noExpiry,
      processAuditNext: async () => {
        calls.push("audit");
        throw new Error("audit failed secret=do-not-log");
      },
      processTeamAgentNext: async () => {
        calls.push("team-agent");
        return false;
      }
    })
  });

  assert.deepEqual(calls.slice(0, 2), ["audit", "team-agent"]);
  assert.equal(result.outcome, "DEGRADED");
  assert.deepEqual(result.failures, [
    { job: "audit", code: "AUDIT_DELIVERY_FAILED" }
  ]);
  assert.doesNotMatch(JSON.stringify(result), /do-not-log/);
});

test("membership expiry failure does not suppress event consumers", async () => {
  const calls: string[] = [];
  const result = await runCadenceWorkerCycle({
    ...baseInput,
    servicesFactory: () => ({
      processMembershipExpiry: async (_maxMemberships) => {
        calls.push("expiry");
        throw new Error("expiry storage failed secret=do-not-log");
      },
      processAuditNext: async () => {
        calls.push("audit");
        return false;
      },
      processTeamAgentNext: async () => {
        calls.push("team-agent");
        return false;
      }
    })
  });

  assert.deepEqual(calls, ["expiry", "audit", "team-agent"]);
  assert.equal(result.outcome, "DEGRADED");
  assert.deepEqual(result.failures, [
    { job: "membership-expiry", code: "MEMBERSHIP_EXPIRY_FAILED" }
  ]);
  assert.doesNotMatch(JSON.stringify(result), /do-not-log/);
});

test("membership expiry is attempted once per cycle with its configured hard bound", async () => {
  const expiryLimits: number[] = [];
  let auditCalls = 0;
  let teamAgentCalls = 0;
  const boundedConfig: CadenceRuntimeConfig = {
    ...config,
    worker: { ...config.worker, maxRounds: 3, maxDeliveryAttempts: 6 }
  };

  await runCadenceWorkerCycle({
    ...baseInput,
    config: boundedConfig,
    servicesFactory: () => ({
      processMembershipExpiry: async (maxMemberships) => {
        expiryLimits.push(maxMemberships);
        return { finalised: [], conflicts: [], remainingDue: false };
      },
      processAuditNext: async () => { auditCalls += 1; return true; },
      processTeamAgentNext: async () => { teamAgentCalls += 1; return true; }
    })
  });

  assert.deepEqual(expiryLimits, [boundedConfig.worker.maxMembershipExpiryAttempts]);
  assert.equal(auditCalls + teamAgentCalls, 6);
});

test("round robin stops when both consumers report no work", async () => {
  let auditCalls = 0;
  let teamAgentCalls = 0;
  const result = await runCadenceWorkerCycle({
    ...baseInput,
    servicesFactory: () => ({
      processMembershipExpiry: noExpiry,
      processAuditNext: async () => { auditCalls += 1; return false; },
      processTeamAgentNext: async () => { teamAgentCalls += 1; return false; }
    })
  });

  assert.equal(auditCalls, 1);
  assert.equal(teamAgentCalls, 1);
  assert.equal(result.audit.processedCount, 0);
  assert.equal(result.teamAgent.processedCount, 0);
  assert.equal(result.remainingWorkDetected, false);
  assert.equal(result.outcome, "SUCCESS");
});

test("total event attempts never exceeds maxDeliveryAttempts", async () => {
  let auditCalls = 0;
  let teamAgentCalls = 0;
  const boundedConfig: CadenceRuntimeConfig = {
    ...config,
    worker: { ...config.worker, maxDeliveryAttempts: 3 }
  };

  const result = await runCadenceWorkerCycle({
    ...baseInput,
    config: boundedConfig,
    servicesFactory: () => ({
      processMembershipExpiry: noExpiry,
      processAuditNext: async () => { auditCalls += 1; return true; },
      processTeamAgentNext: async () => { teamAgentCalls += 1; return true; }
    })
  });

  assert.equal(auditCalls + teamAgentCalls, 3);
  assert.equal(result.maxDeliveryAttemptsReached, true);
  assert.equal(result.remainingWorkDetected, true);
});

test("soft deadline stops further rounds", async () => {
  let auditCalls = 0;
  let teamAgentCalls = 0;
  let clockCalls = 0;
  const clock = () => {
    const value = new Date(Date.parse("2026-09-04T10:00:00.000Z") + clockCalls * 21_000);
    clockCalls += 1;
    return value;
  };

  const result = await runCadenceWorkerCycle({
    ...baseInput,
    clock,
    servicesFactory: () => ({
      processMembershipExpiry: noExpiry,
      processAuditNext: async () => { auditCalls += 1; return true; },
      processTeamAgentNext: async () => { teamAgentCalls += 1; return true; }
    })
  });

  assert.equal(result.softDeadlineReached, true);
  assert.ok(auditCalls + teamAgentCalls < config.worker.maxDeliveryAttempts);
  assert.equal(result.remainingWorkDetected, true);
});

test("service-establishment failure returns FAILED without attempting jobs", async () => {
  const result = await runCadenceWorkerCycle({
    ...baseInput,
    servicesFactory: () => {
      throw new Error("connection bootstrap failed with secret=do-not-log");
    }
  });

  assert.equal(result.outcome, "FAILED");
  assert.deepEqual(result.failures, [
    { job: "runtime", code: "RUNTIME_ESTABLISHMENT_FAILED" }
  ]);
  assert.doesNotMatch(JSON.stringify(result), /do-not-log/);
});
```


Add focused expiry-bound tests before implementation. In `project-membership-expiry.processor.test.ts`, extend the existing fake repository with the requested limit and add:

```ts
class Repository implements ProjectMembershipLifecycleRepository {
  public due: ProjectMembership[] = [];
  public requestedLimit: number | null = null;
  // keep the existing calls/response/error/evaluatedAt fields

  async listDueMemberships(
    evaluatedAt: string,
    limit: number
  ): Promise<ProjectMembership[]> {
    this.evaluatedAt = evaluatedAt;
    this.requestedLimit = limit;
    return this.due.slice(0, limit);
  }

  // keep existing finaliseExpiry/terminateAdministratively/violation methods
}

test("expiry processor uses one look-ahead row and finalises only the configured bound", async () => {
  const repository = new Repository();
  repository.due = Array.from({ length: 4 }, (_, index) => membership({
    id: `11111111-1111-4111-8111-${String(index + 1).padStart(12, "0")}`
  }));

  const processed = await processor(repository).processDueMemberships(3);

  assert.equal(repository.requestedLimit, 4);
  assert.equal(repository.calls.length, 3);
  assert.equal(processed.remainingDue, true);
});
```

In `supabase-project-membership-lifecycle.repository.test.ts`, add the query method to the existing `DueMembershipQuery` fake and change the existing discovery test to pass a bound:

```ts
limit(value: number): this {
  this.calls.push(["limit", value]);
  return this;
}

test("due-membership discovery is lifecycle-owned, hard-bounded, and read-only", async () => {
  const fake = new DueMembershipClient({
    data: [{
      id: membershipId,
      person_id: personId,
      project_id: projectId,
      effective_from: "2026-01-01T00:00:00.000Z",
      effective_to: endedAt,
      membership_status: "ACTIVE",
      granted_by_person_id: actorId,
      created_at: "2026-01-01T00:00:00.000Z",
      termination_reason: null
    }],
    error: null
  });
  const repository = new SupabaseProjectMembershipLifecycleRepository(
    fake as unknown as SupabaseClient
  );

  const due = await repository.listDueMemberships(endedAt, 21);

  assert.equal(fake.table, "project_memberships");
  assert.deepEqual(fake.query.calls.slice(-3), [
    ["order", "effective_to", { ascending: true }],
    ["order", "id", { ascending: true }],
    ["limit", 21]
  ]);
  assert.equal(due[0]?.id, membershipId);
});
```

Update the lifecycle persistence interface to the exact signature:

```ts
listDueMemberships(evaluatedAt: string, limit: number): Promise<ProjectMembership[]>;
```

Update `ProjectMembershipExpiryProcessor.processDueMemberships(maxMemberships: number)` so it validates a positive integer bound, asks the repository for `maxMemberships + 1` rows, processes only the first `maxMemberships`, and returns `remainingDue = true` when the look-ahead row exists. Conflicts count against the same expiry-attempt bound because each candidate can invoke the lifecycle RPC. This adds no migration and changes no lifecycle semantics; it only prevents an unbounded scheduled pass. Before editing, run `git grep -n "listDueMemberships\|processDueMemberships" -- apps/api/src` and STOP if an unexpected production caller exists outside the known worker/runtime/tests.


- [ ] **Step 2: Run RED**

```powershell
cd apps/api
node --import tsx --test src/runtime/cadence-worker-cycle.test.ts src/modules/project-membership/project-membership-expiry.processor.test.ts src/infrastructure/database/supabase-project-membership-lifecycle.repository.test.ts
```

Expected: FAIL because worker-cycle module does not exist.

- [ ] **Step 3: Implement the minimal cycle**

Rules:

```text
validate input/config already resolved
record startedAt + runId
call servicesFactory inside a guarded establishment step; factory failure returns FAILED with safe code and no job attempts
attempt membership expiry once inside its own try/catch, passing config.worker.maxMembershipExpiryAttempts
for round 1..maxRounds:
  attempt Audit if attempt budget/time remain
  attempt Team Agent if attempt budget/time remain
  if both return false and neither fails -> queue exhausted, stop
  if bounds/time reached -> stop
record completedAt
SUCCESS if no failures/conflicts requiring inspection
DEGRADED if at least one independent job failed or governed conflict exists
FAILED is reserved for inability to establish the cycle before service attempts
```

Use these exact safe failure codes so Node/Cloudflare adapters and tests share one contract:

```ts
const WORKER_FAILURE_CODES = {
  runtime: "RUNTIME_ESTABLISHMENT_FAILED",
  membershipExpiry: "MEMBERSHIP_EXPIRY_FAILED",
  audit: "AUDIT_DELIVERY_FAILED",
  teamAgent: "TEAM_AGENT_DELIVERY_FAILED"
} as const;
```

`remainingWorkDetected` is `false` only when the expiry pass reports no remaining due candidate and a completed event round observes `false` from both event consumers without a failure. It is `true` when the expiry look-ahead reports more due memberships, or when event processing stops because rounds, attempt budget, or the soft deadline is reached after work was observed. Set `maxMembershipExpiryAttemptsReached=true` when the expiry look-ahead reports remaining due work after the configured cap. Do not swallow provider/storage errors silently; convert them into the safe code for that job and allow the adapter to choose its exit signal.

- [ ] **Step 4: Extract shared worker service composition**

Move the current Supabase client/repository/service/handler/processor construction from `worker.ts` into `createCadenceWorkerServices({ config, secrets })`. Preserve the existing `ProjectAuthorisationService`, Audit handler, Team Agent handler, membership-expiry processor, and one shared `SupabaseDomainEventRepository`. The returned `processMembershipExpiry(maxMemberships)` callable must forward the hard bound into `ProjectMembershipExpiryProcessor.processDueMemberships(maxMemberships)`; it must not hide an unbounded expiry query behind the cycle boundary.

`create-cadence-worker-services.test.ts` must source-inspect/wire-test the moved composition with explicit assertions:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const source = readFileSync(
  resolve(process.cwd(), "src/runtime/create-cadence-worker-services.ts"),
  "utf8"
);

test("shared worker factory preserves canonical service composition", () => {
  for (const pattern of [
    /new SupabaseProjectMembershipLifecycleRepository/,
    /new ProjectMembershipExpiryProcessor/,
    /new SupabaseAuditRepository/,
    /new AuditService/,
    /new AuditDomainEventHandler/,
    /new SupabaseDiscussionRepository/,
    /new SupabaseTeamAgentRepository/,
    /new ProjectAuthorisationService/,
    /new DiscussionService/,
    /new TeamAgentService/,
    /new MessageCreatedV1Handler/,
    /new DomainEventProcessor/
  ]) {
    assert.match(source, pattern);
  }
});

test("cycle boundary exposes only three callable jobs, not the raw database client", () => {
  assert.match(source, /processMembershipExpiry\s*:/);
  assert.match(source, /processAuditNext\s*:/);
  assert.match(source, /processTeamAgentNext\s*:/);
  assert.doesNotMatch(source, /return\s*\{[^}]*databaseClient/s);
});
```

The test is deliberately about wiring/encapsulation; behavior of each callable remains covered by its owning module tests.

- [ ] **Step 5: Thin `worker.ts` into the Node adapter**

Replace the current orchestration body with this adapter shape; repository/handler construction moves behind `createCadenceWorkerServices()`:

```ts
import { resolveCadenceConfigPath, loadCadenceRuntimeConfig, resolveCadenceSecrets } from "./bootstrap/cadence-config";
import { loadCadenceReleaseIdentity } from "./bootstrap/cadence-release";
import { runCadenceWorkerCycle } from "./runtime/cadence-worker-cycle";
import { createCadenceWorkerServices } from "./runtime/create-cadence-worker-services";

async function main(): Promise<void> {
  const configPath = resolveCadenceConfigPath({ argv: process.argv.slice(2), environment: process.env });
  const config = loadCadenceRuntimeConfig(configPath);
  const secrets = resolveCadenceSecrets(config, process.env);
  const release = loadCadenceReleaseIdentity({
    version: process.env.CADENCE_RELEASE_VERSION,
    commitSha: process.env.CADENCE_COMMIT_SHA,
    buildId: process.env.CADENCE_BUILD_ID
  });

  const result = await runCadenceWorkerCycle({
    config,
    release,
    runtime: "node",
    servicesFactory: () => createCadenceWorkerServices({ config, secrets })
  });

  console.log(JSON.stringify(result));
  if (result.outcome !== "SUCCESS") process.exitCode = 1;
}

void main().catch(() => {
  console.error(JSON.stringify({
    artifactType: "cadence.vs005.worker-bootstrap-failure",
    formatVersion: 1,
    code: "WORKER_BOOTSTRAP_FAILED"
  }));
  process.exitCode = 1;
});
```

The adapter performs one cycle only; it does not loop or retry the cycle. It must not log raw caught errors.

- [ ] **Step 6: Update `worker.wiring.test.ts`**

The wiring test must now inspect the runtime composition location and assert:

```ts
assert.match(workerSource, /runCadenceWorkerCycle/);
assert.doesNotMatch(workerSource, /processNext\([\s\S]*processNext/);
```

Keep the invariant that API startup does not invoke membership expiry.

- [ ] **Step 7: Run focused + API regression**

```powershell
cd apps/api
node --import tsx --test src/runtime/cadence-worker-cycle.test.ts src/runtime/create-cadence-worker-services.test.ts src/modules/project-membership/project-membership-expiry.processor.test.ts src/infrastructure/database/supabase-project-membership-lifecycle.repository.test.ts src/worker.wiring.test.ts
npm run typecheck
npm test
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
cd ..\..
git add apps/api/src/runtime/cadence-worker-cycle.ts apps/api/src/runtime/cadence-worker-cycle.test.ts apps/api/src/runtime/create-cadence-worker-services.ts apps/api/src/runtime/create-cadence-worker-services.test.ts apps/api/src/modules/project-membership/project-membership-lifecycle.repository.ts apps/api/src/modules/project-membership/project-membership-expiry.processor.ts apps/api/src/modules/project-membership/project-membership-expiry.processor.test.ts apps/api/src/infrastructure/database/supabase-project-membership-lifecycle.repository.ts apps/api/src/infrastructure/database/supabase-project-membership-lifecycle.repository.test.ts apps/api/src/worker.ts apps/api/src/worker.wiring.test.ts
git diff --cached --check
git commit -m "feat(vs005): add bounded supervised worker cycle"
```

**Checkpoint deliverable:** One runtime-neutral worker operation hard-bounds both the membership-expiry pass and round-robin event work, isolates independent job failures, and is used directly by Node.

---

### Task 8: Add Persistent Retry Backoff Without a Schema Change

**Files:**
- Create: `apps/api/src/runtime/worker-retry-policy.ts`
- Create: `apps/api/src/runtime/worker-retry-policy.test.ts`
- Modify: `apps/api/src/infrastructure/events/domain-event.processor.ts`
- Modify: `apps/api/src/infrastructure/events/domain-event.processor.test.ts`
- Modify: `apps/api/src/runtime/create-cadence-worker-services.ts`
- Modify: `apps/api/src/runtime/create-cadence-worker-services.test.ts`
- Modify: `apps/api/src/worker.ts`

**Interfaces:**
- Produces:

```ts
export type DeliveryRetryPolicy = (input: {
  processingAttempts: number;
  failedAt: string;
}) => string;

export function createDeliveryRetryPolicy(
  delaysSeconds: readonly number[]
): DeliveryRetryPolicy;
```

`DomainEventProcessor` keeps its existing repository contract and gains this exact optional constructor input:

```ts
export interface DomainEventProcessorOptions {
  retryPolicy?: DeliveryRetryPolicy;
  currentTime?: () => Date;
}

new DomainEventProcessor(repository, options?)
```

When `retryPolicy` is configured, the processor passes an explicit `retryAt` as the fifth existing positional argument to `repository.fail(eventId, consumerName, claimToken, error, retryAt)`.

- [ ] **Step 1: Write RED retry-policy tests**

```ts
test("uses 60, 300, 900, then 3600 second delays", () => {
  const policy = createDeliveryRetryPolicy([60, 300, 900, 3600]);
  const failedAt = "2026-09-04T00:00:00.000Z";
  assert.equal(policy({ processingAttempts: 1, failedAt }), "2026-09-04T00:01:00.000Z");
  assert.equal(policy({ processingAttempts: 2, failedAt }), "2026-09-04T00:05:00.000Z");
  assert.equal(policy({ processingAttempts: 3, failedAt }), "2026-09-04T00:15:00.000Z");
  assert.equal(policy({ processingAttempts: 4, failedAt }), "2026-09-04T01:00:00.000Z");
  assert.equal(policy({ processingAttempts: 9, failedAt }), "2026-09-04T01:00:00.000Z");
});
```

- [ ] **Step 2: Change the existing processor error expectation first**

Update the handler-error test to construct the processor with a deterministic clock/policy and expect the existing fake repository call shape:

```ts
const processor = new DomainEventProcessor(repository, {
  retryPolicy: createDeliveryRetryPolicy([60, 300, 900, 3600]),
  currentTime: () => new Date("2026-09-04T00:00:00.000Z")
});

await assert.rejects(
  () => processor.processNext(handler),
  /Team Agent processing failed/
);

assert.deepEqual(repository.failCalls, [
  {
    eventId: event.eventId,
    consumerName: claimedEvent.consumerName,
    claimToken: claimedEvent.claimToken,
    error: "HANDLER_FAILED:Error",
    retryAt: "2026-09-04T00:01:00.000Z"
  }
]);
```

Keep the assertion that `processNext()` rejects after recording the failure; the worker cycle, not the processor, owns cross-consumer failure isolation. Add this credential-safety case:

```ts
test("failure persistence stores a bounded safe category, not the raw handler message", async () => {
  const repository = new FakeDomainEventRepository();
  const handler = new FakeDomainEventHandler();
  handler.error = new Error("SUPABASE_SECRET_KEY=do-not-store");

  const processor = new DomainEventProcessor(repository, {
    retryPolicy: createDeliveryRetryPolicy([60, 300, 900, 3600]),
    currentTime: () => new Date("2026-09-04T00:00:00.000Z")
  });

  await assert.rejects(() => processor.processNext(handler));

  assert.equal(repository.failCalls[0]?.error, "HANDLER_FAILED:Error");
  assert.equal(repository.failCalls[0]?.retryAt, "2026-09-04T00:01:00.000Z");
  assert.doesNotMatch(JSON.stringify(repository.failCalls), /do-not-store/);
});
```

- [ ] **Step 3: Run RED**

```powershell
cd apps/api
node --import tsx --test src/runtime/worker-retry-policy.test.ts src/infrastructure/events/domain-event.processor.test.ts
```

Expected: FAIL on missing retry policy / current undefined retryAt.

- [ ] **Step 4: Implement retry calculation and inject it**

In `DomainEventProcessor`, use the claimed delivery's `processingAttempts` and injected clock. Define the safe persistence helper in this same file:

```ts
function toSafeDeliveryError(error: unknown): string {
  const name =
    error instanceof Error && /^[A-Za-z0-9_.-]{1,48}$/.test(error.name)
      ? error.name
      : "UnknownError";

  return `HANDLER_FAILED:${name}`;
}

const retryAt = this.retryPolicy?.({
  processingAttempts: claimed.processingAttempts,
  failedAt: this.currentTime().toISOString()
});

await this.repository.fail(
  claimed.event.eventId,
  claimed.consumerName,
  claimed.claimToken,
  toSafeDeliveryError(error),
  retryAt
);
```

Do not persist the raw handler message in `last_error`. Do not add a new delivery status or table column.

- [ ] **Step 5: Wire configured policy into Audit and Team Agent processors**

In `createCadenceWorkerServices()`, construct one policy from canonical config and pass it to both event-processor instances:

```ts
const retryPolicy = createDeliveryRetryPolicy(config.retry.delaysSeconds);

const auditProcessor = new DomainEventProcessor(domainEventRepository, {
  retryPolicy
});
const teamAgentProcessor = new DomainEventProcessor(domainEventRepository, {
  retryPolicy
});

return {
  processMembershipExpiry: (maxMemberships) =>
    membershipExpiryProcessor.processDueMemberships(maxMemberships),
  processAuditNext: () => auditProcessor.processNext(auditDomainEventHandler),
  processTeamAgentNext: () => teamAgentProcessor.processNext(messageCreatedHandler)
};
```

Do not hardcode separate retry tables in `worker.ts` or the Cloudflare adapter.

- [ ] **Step 6: Run focused and full API regression**

```powershell
cd apps/api
node --import tsx --test src/runtime/worker-retry-policy.test.ts src/infrastructure/events/domain-event.processor.test.ts src/runtime/cadence-worker-cycle.test.ts
npm test
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
cd ..\..
git add apps/api/src/runtime/worker-retry-policy.ts apps/api/src/runtime/worker-retry-policy.test.ts apps/api/src/infrastructure/events/domain-event.processor.ts apps/api/src/infrastructure/events/domain-event.processor.test.ts apps/api/src/runtime/create-cadence-worker-services.ts apps/api/src/runtime/create-cadence-worker-services.test.ts apps/api/src/worker.ts
git diff --cached --check
git commit -m "feat(vs005): add persistent delivery retry backoff"
```

**Checkpoint deliverable:** Failed deliveries use persisted delayed `available_at` retry times derived from processing-attempt count; no hot-loop retry and no database migration.

---

### Task 9: Prove Membership-Expiry Overlap Safety Before Adding Any Global Lock

**Files:**
- Modify: `apps/api/src/infrastructure/database/project-membership-lifecycle.migration.test.ts`
- Verify unchanged: `apps/api/src/modules/project-membership/project-membership-expiry.processor.test.ts`
- Reference only: `supabase/migrations/20260824120000_vs002_membership_lifecycle.sql`
- Reference only: R03 membership hardening migrations

**Interfaces:**
- Consumes: the existing canonical `finalize_project_membership_expiry` RPC, whose row locks serialize overlapping finalisation attempts, and the existing `ALREADY_ENDED` result mapping.
- Produces: explicit regression evidence that two scheduled invocations cannot both invent a termination. No Cloudflare lock, Durable Object, schema change, or migration is added while this proof holds.

This is a **characterisation/evidence checkpoint**, not a behavior-change task. Therefore do not manufacture a failing production test when the committed SQL already provides the required semantics; the gate is that the new assertions prove the existing locking/idempotency contract.

- [ ] **Step 1: Inspect the canonical RPC before editing tests**

Run:

```powershell
git grep -n "finalize_project_membership_expiry" -- supabase/migrations apps/api/src
```

Confirm in `20260824120000_vs002_membership_lifecycle.sql` that `finalize_project_membership_expiry`:

1. locks the Project row `FOR UPDATE`;
2. then locks the Membership row `FOR UPDATE`;
3. checks already-materialised termination only after those locks;
4. returns `ALREADY_ENDED` with the originally persisted provenance when termination already exists;
5. updates the original membership/assignment history rather than inserting a second termination record.

If any of those five facts is absent, **STOP** and return to design review. Do not add a Cloudflare-specific lock as a shortcut.

- [ ] **Step 2: Add an executable migration-characterisation test**

Append this exact shape to `project-membership-lifecycle.migration.test.ts` using its existing `functionBody()` helper:

```ts
test(
  "expiry finalisation serializes overlap before its idempotent already-ended branch",
  () => {
    const body = functionBody("finalize_project_membership_expiry");
    const projectLock = body.indexOf("from public.projects as project");
    const membershipLock = body.indexOf("from public.project_memberships as membership");
    const alreadyEnded = body.indexOf("'ALREADY_ENDED'::text");

    assert.ok(projectLock >= 0);
    assert.ok(membershipLock > projectLock);
    assert.ok(alreadyEnded > membershipLock);
    assert.match(
      body,
      /from public\.projects as project[\s\S]*for update/
    );
    assert.match(
      body,
      /from public\.project_memberships as membership[\s\S]*for update/
    );
    assert.match(
      body,
      /membership_status = 'ENDED'[\s\S]*termination_kind is not null[\s\S]*'ALREADY_ENDED'/
    );
    assert.match(
      body,
      /project_membership_role_history_at\([\s\S]*v_membership\.effective_to/
    );
  }
);
```

This test makes the concurrency reasoning executable: overlapping transactions serialize on the same locked rows, and the second transaction observes/returns the first transition rather than rewriting it.

- [ ] **Step 3: Re-run the existing application-level idempotency evidence**

Do not replace the already committed processor test:

```ts
test("idempotent repository retry retains ALREADY_ENDED result", ...)
```

Run both layers:

```powershell
cd apps/api
node --import tsx --test src/infrastructure/database/project-membership-lifecycle.migration.test.ts src/modules/project-membership/project-membership-expiry.processor.test.ts
```

Expected: PASS. If the new migration assertion fails, stop; do not proceed to Cloudflare scheduling.

- [ ] **Step 4: Run the lifecycle regression set**

```powershell
npm test
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit the evidence checkpoint**

```powershell
cd ..\..
git add apps/api/src/infrastructure/database/project-membership-lifecycle.migration.test.ts
git diff --cached --check
git commit -m "test(vs005): prove membership expiry overlap safety"
```

**Checkpoint deliverable:** Existing PostgreSQL row locking + idempotent `ALREADY_ENDED` behavior is explicitly regression-protected as the reason VS005 does not add a provider-specific global worker lock.

---

### Task 10: Replace the Probe with the Final Cloudflare Runtime Adapter

**Files:**
- Create: `apps/runtime-cloudflare/src/index.ts`
- Create: `apps/runtime-cloudflare/src/index.test.ts`
- Delete: `apps/runtime-cloudflare/src/compatibility-probe.ts`
- Delete: `apps/runtime-cloudflare/src/compatibility-probe.test.ts`
- Delete: `apps/runtime-cloudflare/wrangler.probe.jsonc`
- Create generated/ignored target: `apps/runtime-cloudflare/wrangler.generated.jsonc`
- Modify: `apps/runtime-cloudflare/.gitignore`
- Modify: `apps/runtime-cloudflare/package.json`
- Create: `apps/api/scripts/vs005-generate-deployment.ts`
- Create: `apps/api/scripts/vs005-generate-deployment.test.ts`
- Modify: `apps/api/package.json`
- Modify: `package.json`

**Interfaces:**
- Consumes: `createCadenceApp`, `runCadenceWorkerCycle`, canonical config, resolved Cloudflare bindings, release identity.
- Produces: one Cloudflare Worker with:
  - Worker-first routes `/api/*` and `/health`;
  - Static Assets for all other web routes with SPA fallback;
  - scheduled handler using the same worker-cycle operation;
  - `controller.noRetry()`;
  - required secret declarations generated from canonical secret refs.

The deployment generator exposes:

```ts
export interface GeneratedCloudflareDeployment {
  wrangler: {
    name: string;
    main: string;
    compatibility_date: "2026-09-04";
    compatibility_flags: readonly ["nodejs_compat"];
    assets: {
      directory: "../web/dist";
      binding: "ASSETS";
      run_worker_first: readonly ["/api/*", "/health"];
      not_found_handling: "single-page-application";
    };
    triggers: { crons: readonly string[] };
    secrets: { required: readonly string[] };
    workers_dev: boolean;
    routes?: readonly [{ pattern: string; custom_domain: true }];
    vars: {
      CADENCE_RUNTIME_CONFIG_JSON: string;
      CADENCE_CONFIG_FINGERPRINT: string;
      CADENCE_RELEASE_VERSION: string;
      CADENCE_COMMIT_SHA: string;
      CADENCE_BUILD_ID: string;
    };
  };
}

export function buildCloudflareDeployment(input: {
  config: CadenceRuntimeConfig;
  release: CadenceReleaseIdentity;
}): GeneratedCloudflareDeployment;
```

`CADENCE_RUNTIME_CONFIG_JSON` is generated from validated non-secret canonical config; it is not a second operator-owned config file.

- [ ] **Step 1: Write RED generator tests**

Given the CI config, assert the generated Wrangler object is exactly constrained:

```ts
test("generator derives one safe Cloudflare deployment from canonical config", () => {
  const result = buildCloudflareDeployment({ config: ciConfig, release });
  const embeddedConfig = JSON.parse(result.wrangler.vars.CADENCE_RUNTIME_CONFIG_JSON);

  assert.equal(result.wrangler.name, "cadence-beta");
  assert.equal(result.wrangler.compatibility_date, "2026-09-04");
  assert.deepEqual(result.wrangler.compatibility_flags, ["nodejs_compat"]);
  assert.deepEqual(result.wrangler.assets.run_worker_first, ["/api/*", "/health"]);
  assert.equal(result.wrangler.assets.not_found_handling, "single-page-application");
  assert.deepEqual(result.wrangler.triggers.crons, ["* * * * *"]);
  assert.deepEqual(result.wrangler.secrets.required, ["SUPABASE_SECRET_KEY"]);
  assert.equal(embeddedConfig.application.environment, "beta");
  assert.equal(embeddedConfig.configVersion, 1);
  assert.equal(
    result.wrangler.vars.CADENCE_CONFIG_FINGERPRINT,
    fingerprintCadenceRuntimeConfig(ciConfig)
  );
  assert.equal(result.wrangler.vars.CADENCE_RELEASE_VERSION, release.version);
  assert.equal(result.wrangler.vars.CADENCE_COMMIT_SHA, release.commitSha);
  assert.equal(result.wrangler.vars.CADENCE_BUILD_ID, release.buildId);
  assert.doesNotMatch(JSON.stringify(result), /server-secret|SUPABASE_SECRET_KEY=/);
});

test("generator does not bind Cloudflare data services", () => {
  const text = JSON.stringify(buildCloudflareDeployment({ config: ciConfig, release }));
  assert.doesNotMatch(text, /durable_objects|d1_databases|kv_namespaces|queues/i);
});

test("custom public origin becomes one declarative custom-domain route", () => {
  const result = buildCloudflareDeployment({ config: ciConfig, release });
  assert.equal(result.wrangler.workers_dev, false);
  assert.deepEqual(result.wrangler.routes, [
    { pattern: "cadence-beta.example.test", custom_domain: true }
  ]);
});

test("workers.dev public origin uses the Workers development domain without a custom route", () => {
  const workersDevConfig = {
    ...ciConfig,
    application: {
      ...ciConfig.application,
      publicUrl: "https://cadence-beta.example-account.workers.dev"
    }
  };
  const result = buildCloudflareDeployment({ config: workersDevConfig, release });
  assert.equal(result.wrangler.workers_dev, true);
  assert.equal(result.wrangler.routes, undefined);
});
```

`ciConfig` is the Task 3 validated CI fixture and `release` is the Task 3 deterministic release fixture.

- [ ] **Step 2: Write RED Cloudflare-adapter source tests**

`index.test.ts` should assert the adapter imports only runtime/bootstrap/infrastructure composition and contains:

```ts
assert.match(source, /handleAsNodeRequest/);
assert.match(source, /runCadenceWorkerCycle/);
assert.match(source, /controller\.noRetry\(\)/);
assert.doesNotMatch(source, /from\s+["'].*modules\/.*service/); // no direct business-module shortcuts
```

- [ ] **Step 3: Run RED**

```powershell
cd apps/api
node --import tsx --test scripts/vs005-generate-deployment.test.ts
cd ..\runtime-cloudflare
npm test
```

Expected: FAIL because final generator/adapter do not exist.

- [ ] **Step 4: Implement generated Wrangler config**

`vs005-generate-deployment.ts` must:

1. load/validate canonical config;
2. load/validate release identity supplied to the CLI (`--release-version`, `--commit-sha`, `--build-id`) or injected directly by deployment orchestration;
3. reject provider other than `cloudflare` for this adapter and derive Worker name deterministically as `cadence-<environment>`;
4. emit non-secret Worker vars including the canonical config fingerprint and declare required secret names through `secrets.required`;
5. emit `assets.directory = "../web/dist"`;
6. emit `run_worker_first = ["/api/*", "/health"]`;
7. emit SPA not-found handling;
8. emit Cron from `worker.schedule`;
9. derive hosting from `application.publicUrl`: `.workers.dev` => `workers_dev=true` with no custom route; any other HTTPS host => `workers_dev=false` plus exactly one `custom_domain=true` route for that host, preserving one public application origin;
10. emit compatibility date `2026-09-04` and explicit `nodejs_compat`;
11. write `GeneratedCloudflareDeployment.wrangler` to `wrangler.generated.jsonc` using deterministic key order, including `secrets.required` as a declaration of secret **names only**; current Wrangler validates these required bindings during deployment and uses them for generated binding types;
12. never write a secret value.

Add these scripts to `apps/api/package.json` / `apps/runtime-cloudflare/package.json`:

```json
"vs005:generate:ci": "node --import tsx scripts/vs005-generate-deployment.ts --config ../../config/cadence.runtime.ci.json --out ../runtime-cloudflare/wrangler.generated.jsonc --release-version 0.0.0-ci --commit-sha 0000000000000000000000000000000000000000 --build-id 2026-09-04T00:00:00Z",
"deploy:dry-run": "wrangler deploy --config wrangler.generated.jsonc --dry-run"
```

The fixed CI release identity is only for non-deploying bundle verification; hosted plan/apply uses the actual release identity.

Current Wrangler supports `secrets.required`, so do not maintain a parallel `requiredSecrets` metadata list. For a first Worker deployment where the required secret does not yet exist remotely, Task 12 must use Wrangler's supported `--secrets-file` deployment path with a short-lived, ignored secret transport file generated from the already-resolved local secret input and deleted in `finally`. Subsequent deployments may preserve the existing provider secret when no rotation is requested. The secret value must never enter `wrangler.generated.jsonc`, the deployment plan/result, console arguments, or Git.

- [ ] **Step 5: Implement the final Cloudflare entrypoint**

Use Node HTTP integration to host the same Express app, but construct it from Cloudflare bindings rather than `process.env`. The entrypoint should have the conceptual structure:

```ts
import { createServer } from "node:http";
import { handleAsNodeRequest } from "cloudflare:node";
import { createCadenceApp } from "../../api/src/runtime/create-cadence-app";
import { runCadenceWorkerCycle } from "../../api/src/runtime/cadence-worker-cycle";

let started = false;

function ensureHttpRuntime(env: Env): void {
  if (started) return;
  const runtime = buildCloudflareCadenceRuntime(env);
  const server = createServer(createCadenceApp(runtime));
  server.listen(3000);
  started = true;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    ensureHttpRuntime(env);
    return handleAsNodeRequest(3000, request);
  },

  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    controller.noRetry();
    const result = await runCadenceWorkerCycle(buildCloudflareWorkerInput(env));
    console.log(JSON.stringify(result));
    if (result.outcome !== "SUCCESS") {
      throw new Error(`Cadence worker cycle ${result.outcome}`);
    }
  }
};
```

Define these exact adapter-local helpers in `apps/runtime-cloudflare/src/index.ts` or `apps/runtime-cloudflare/src/runtime-bindings.ts`:

```ts
interface Env {
  CADENCE_RUNTIME_CONFIG_JSON: string;
  CADENCE_CONFIG_FINGERPRINT: string;
  CADENCE_RELEASE_VERSION: string;
  CADENCE_COMMIT_SHA: string;
  CADENCE_BUILD_ID: string;
  SUPABASE_SECRET_KEY: string;
}

function buildCloudflareCadenceRuntime(env: Env): CadenceAppRuntime;
function buildCloudflareWorkerInput(env: Env): Parameters<typeof runCadenceWorkerCycle>[0];
// buildCloudflareWorkerInput supplies:
// servicesFactory: () => createCadenceWorkerServices({ config, secrets })
```

Both helpers validate `CADENCE_RUNTIME_CONFIG_JSON` through Task 3's validator. They are adapter code only; no provider logic enters domain modules.

- [ ] **Step 6: Build and locally exercise static/HTTP/scheduled paths**

```powershell
npm --prefix apps/web run build:ci
npm --prefix apps/api run typecheck
npm --prefix apps/api run vs005:generate:ci
npm --prefix apps/runtime-cloudflare run typecheck
npm --prefix apps/runtime-cloudflare test
npm --prefix apps/runtime-cloudflare run deploy:dry-run
```

Then run local Wrangler development with `--test-scheduled` and test bindings, and verify:

```text
GET /health -> 200 safe JSON
GET / -> 200 static app
GET /some/client/route -> SPA asset fallback
GET /__scheduled?cron=*+*+*+*+* -> scheduled handler executes and noRetry=true is observed in the local structured result/log evidence
```

For current JavaScript Workers, `/__scheduled` is the Wrangler `--test-scheduled` development route; do not expose a custom production HTTP endpoint that invokes scheduled work.

Do not point local verification at a destructive/production Supabase target.

- [ ] **Step 7: Re-run Node portability paths**

```powershell
npm --prefix apps/api run typecheck
npm --prefix apps/api test
```

Expected: Node API/worker tests still PASS after Cloudflare adapter replacement.

- [ ] **Step 8: Commit**

```powershell
git add apps/runtime-cloudflare apps/api/scripts/vs005-generate-deployment.ts apps/api/scripts/vs005-generate-deployment.test.ts apps/api/package.json package.json
git diff --cached --check
git commit -m "feat(vs005): add portable Cloudflare runtime adapter"
```

**Checkpoint deliverable:** One generated Cloudflare deployment unit serves Vite assets, the governed API, and Cron-triggered worker execution while the same API/worker logic remains runnable in Node.

---

### Task 11: Add Read-Only Deployment Plan and Setup Readiness

**Files:**
- Create: `apps/api/scripts/vs005-deployment-artifacts.ts`
- Create: `apps/api/scripts/vs005-deployment-artifacts.test.ts`
- Create: `apps/api/scripts/vs005-deploy-plan.ts`
- Create: `apps/api/scripts/vs005-deploy-plan.test.ts`
- Modify: `apps/api/package.json`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Produces a versioned, credential-free plan artifact:

```ts
export interface Vs005OperatorFailure {
  artifactType: "cadence.vs005.operator-failure";
  formatVersion: 1;
  stage: "setup" | "plan" | "apply" | "verify" | "rollback";
  code: string;
  mutationOccurred: boolean;
  existingService: "HEALTHY" | "UNHEALTHY" | "UNCHANGED" | "UNKNOWN";
  canonicalConfigPath: string;
  safeExpected?: Readonly<Record<string, string | number | boolean | null>>;
  safeObserved?: Readonly<Record<string, string | number | boolean | null>>;
  nextAction: string;
}

export function makeVs005OperatorFailure(
  input: Omit<Vs005OperatorFailure, "artifactType" | "formatVersion">
): Vs005OperatorFailure;

export interface Vs005DeploymentPlan {
  artifactType: "cadence.vs005.deployment-plan";
  formatVersion: 1;
  planId: string;
  configFingerprint: string;
  release: CadenceReleaseIdentity;
  environment: "local" | "qa" | "beta";
  provider: "cloudflare";
  providerTarget: { accountId: string; workerName: string; workerExists: boolean };
  publicUrl: string;
  supabaseProjectRef: string | null;
  configVersion: 1;
  worker: {
    schedule: string;
    maxRounds: number;
    maxDeliveryAttempts: number;
    maxMembershipExpiryAttempts: number;
    softDeadlineSeconds: number;
  };
  secrets: {
    name: string;
    providerPresent: boolean;
    bootstrapInputAvailable: boolean;
    ready: boolean;
  }[];
  database: { migrationAction: "NONE" };
  rollback: {
    application: "SUPPORTED" | "UNAVAILABLE";
    database: "NOT_PERFORMED";
  };
  changes: readonly ["WEB_STATIC_ASSETS", "API_WORKER", "SCHEDULED_WORKER"];
  destructiveActions: readonly [];
  readiness: "PASS" | "BLOCKED";
  blockers: readonly { code: string; message: string }[];
}
```

- [ ] **Step 1: Write RED shared failure-artifact and plan tests**

`vs005-deployment-artifacts.test.ts` must prove operator failures are bounded and credential-free:

```ts
test("operator failure records actionable safe context without a raw exception", () => {
  const failure = makeVs005OperatorFailure({
    stage: "apply",
    code: "CONFIG_FINGERPRINT_MISMATCH",
    mutationOccurred: false,
    existingService: "UNCHANGED",
    canonicalConfigPath: "config/cadence.runtime.beta.json",
    safeExpected: { configFingerprint: "expected" },
    safeObserved: { configFingerprint: "observed" },
    nextAction: "Run cadence:deploy:plan again with the reviewed canonical config."
  });

  assert.equal(failure.mutationOccurred, false);
  assert.equal(failure.existingService, "UNCHANGED");
  assert.doesNotMatch(JSON.stringify(failure), /server-secret|stack|password|token/i);
});
```

`Vs005OperatorFailure` deliberately has no `error`, `cause`, `stack`, or unrestricted message-body field. If safe expected/observed values are unavailable, omit them rather than copying a raw provider response.

Then write the deployment-plan tests below.

Define the command boundary explicitly so read-only behavior is testable without Cloudflare:

```ts
export interface Vs005PlanInspection {
  providerReachable: boolean;
  providerAuthReady: boolean;
  providerAccountId: string | null;
  generatedWorkerName: string;
  hostnameReady: boolean;
  generatedConfigValid: boolean;
  webBuildReady: boolean;
  workerExists: boolean;
  priorVersionAvailable: boolean;
  secretStatus: Readonly<Record<string, {
    providerPresent: boolean;
    bootstrapInputAvailable: boolean;
  }>>;
}

export interface Vs005DeployPlanDependencies {
  loadConfig(path: string): unknown;
  loadRelease(): CadenceReleaseIdentity;
  inspect(config: CadenceRuntimeConfig): Promise<Vs005PlanInspection>;
  generatePlanId(): string;
  writePlan(path: string, plan: Vs005DeploymentPlan): Promise<void>;
}

export async function runVs005DeployPlan(input: {
  configPath: string;
  outputPath: string;
}, dependencies: Vs005DeployPlanDependencies): Promise<Vs005DeploymentPlan>;
```

Use a valid config fixture from Task 3 and concrete tests like:

```ts
test("invalid config blocks before read-only provider inspection", async () => {
  let inspectCalls = 0;
  const dependencies = makeDependencies({
    loadConfig: () => ({ configVersion: 99 }),
    inspect: async () => {
      inspectCalls += 1;
      throw new Error("must not run");
    }
  });

  await assert.rejects(
    () => runVs005DeployPlan({ configPath: "invalid.json", outputPath: "plan.json" }, dependencies),
    /config/i
  );
  assert.equal(inspectCalls, 0);
});

test("missing secret blocks by secret name without exposing a value", async () => {
  const dependencies = makeDependencies({
    inspect: async () => ({
      providerReachable: true,
      providerAuthReady: true,
      providerAccountId: "account-123",
      generatedWorkerName: "cadence-beta",
      hostnameReady: true,
      generatedConfigValid: true,
      webBuildReady: true,
      workerExists: false,
      priorVersionAvailable: false,
      secretStatus: {
        SUPABASE_SECRET_KEY: { providerPresent: false, bootstrapInputAvailable: false }
      }
    })
  });

  const plan = await runVs005DeployPlan(
    { configPath: "beta.json", outputPath: "plan.json" },
    dependencies
  );

  assert.equal(plan.readiness, "BLOCKED");
  assert.deepEqual(plan.secrets, [{
    name: "SUPABASE_SECRET_KEY",
    providerPresent: false,
    bootstrapInputAvailable: false,
    ready: false
  }]);
  assert.deepEqual(plan.blockers, [
    { code: "MISSING_REQUIRED_SECRET", message: "Required secret SUPABASE_SECRET_KEY is neither configured remotely nor available as authorized bootstrap input." }
  ]);
  assert.doesNotMatch(JSON.stringify(plan), /server-secret|secret-value/);
});

test("fresh Worker may plan when the required secret is available only as bootstrap input", async () => {
  const dependencies = makeDependencies({
    inspect: async () => ({
      providerReachable: true,
      providerAuthReady: true,
      providerAccountId: "account-123",
      generatedWorkerName: "cadence-beta",
      hostnameReady: true,
      generatedConfigValid: true,
      webBuildReady: true,
      workerExists: false,
      priorVersionAvailable: false,
      secretStatus: {
        SUPABASE_SECRET_KEY: { providerPresent: false, bootstrapInputAvailable: true }
      }
    })
  });

  const plan = await runVs005DeployPlan(
    { configPath: "beta.json", outputPath: "plan.json" },
    dependencies
  );

  assert.equal(plan.readiness, "PASS");
  assert.deepEqual(plan.secrets, [{
    name: "SUPABASE_SECRET_KEY",
    providerPresent: false,
    bootstrapInputAvailable: true,
    ready: true
  }]);
  assert.equal(plan.rollback.application, "UNAVAILABLE");
  assert.equal(plan.rollback.database, "NOT_PERFORMED");
});

test("missing Cloudflare deployment authentication blocks without exposing credentials", async () => {
  const dependencies = makeDependencies({
    inspect: async () => ({
      providerReachable: true,
      providerAuthReady: false,
      providerAccountId: null,
      generatedWorkerName: "cadence-beta",
      hostnameReady: true,
      generatedConfigValid: true,
      webBuildReady: true,
      workerExists: true,
      priorVersionAvailable: true,
      secretStatus: {
        SUPABASE_SECRET_KEY: { providerPresent: true, bootstrapInputAvailable: false }
      }
    })
  });

  const plan = await runVs005DeployPlan(
    { configPath: "beta.json", outputPath: "plan.json" },
    dependencies
  );
  assert.equal(plan.readiness, "BLOCKED");
  assert.ok(plan.blockers.some((blocker) => blocker.code === "CLOUDFLARE_AUTH_UNAVAILABLE"));
});

test("authenticated but unresolved Cloudflare account identity blocks planning", async () => {
  const plan = await runVs005DeployPlan(
    { configPath: "beta.json", outputPath: "plan.json" },
    makeDependencies({
      inspect: async () => ({
        providerReachable: true,
        providerAuthReady: true,
        providerAccountId: null,
        generatedWorkerName: "cadence-beta",
        hostnameReady: true,
        generatedConfigValid: true,
        webBuildReady: true,
        workerExists: false,
        priorVersionAvailable: false,
        secretStatus: {
          SUPABASE_SECRET_KEY: { providerPresent: false, bootstrapInputAvailable: true }
        }
      })
    })
  );
  assert.equal(plan.readiness, "BLOCKED");
  assert.ok(plan.blockers.some((blocker) => blocker.code === "CLOUDFLARE_TARGET_UNRESOLVED"));
});

test("custom hostname not ready blocks the reviewed deployment target", async () => {
  const plan = await runVs005DeployPlan(
    { configPath: "beta.json", outputPath: "plan.json" },
    makeDependencies({
      inspect: async () => ({
        providerReachable: true,
        providerAuthReady: true,
        providerAccountId: "account-123",
        generatedWorkerName: "cadence-beta",
        hostnameReady: false,
        generatedConfigValid: true,
        webBuildReady: true,
        workerExists: false,
        priorVersionAvailable: false,
        secretStatus: {
          SUPABASE_SECRET_KEY: { providerPresent: false, bootstrapInputAvailable: true }
        }
      })
    })
  );
  assert.equal(plan.readiness, "BLOCKED");
  assert.ok(plan.blockers.some((blocker) => blocker.code === "HOSTNAME_NOT_READY"));
});

test("ready plan is deterministic and explicitly non-destructive", async () => {
  const dependencies = makeDependencies({
    inspect: async () => ({
      providerReachable: true,
      providerAuthReady: true,
      providerAccountId: "account-123",
      generatedWorkerName: "cadence-beta",
      hostnameReady: true,
      generatedConfigValid: true,
      webBuildReady: true,
      workerExists: true,
      priorVersionAvailable: true,
      secretStatus: {
        SUPABASE_SECRET_KEY: { providerPresent: true, bootstrapInputAvailable: false }
      }
    }),
    generatePlanId: () => "plan-1"
  });

  const first = await runVs005DeployPlan(
    { configPath: "beta.json", outputPath: "one.json" },
    dependencies
  );
  const second = await runVs005DeployPlan(
    { configPath: "beta.json", outputPath: "two.json" },
    dependencies
  );

  assert.equal(first.readiness, "PASS");
  assert.equal(first.database.migrationAction, "NONE");
  assert.deepEqual(first.destructiveActions, []);
  assert.equal(first.configFingerprint, second.configFingerprint);
  assert.equal(first.release.commitSha, "0123456789abcdef0123456789abcdef01234567");
  assert.equal(first.configVersion, 1);
  assert.deepEqual(first.providerTarget, {
    accountId: "account-123",
    workerName: "cadence-beta",
    workerExists: true
  });
  assert.deepEqual(first.changes, [
    "WEB_STATIC_ASSETS",
    "API_WORKER",
    "SCHEDULED_WORKER"
  ]);
  assert.deepEqual(first.rollback, {
    application: "SUPPORTED",
    database: "NOT_PERFORMED"
  });
});
```

Define `makeDependencies()` in the test file exactly as a read-only fixture; it has no deploy/mutation method:

```ts
const ciConfig = JSON.parse(readFileSync(
  resolve(process.cwd(), "../../config/cadence.runtime.ci.json"),
  "utf8"
));
const writtenPlans: Vs005DeploymentPlan[] = [];

function makeDependencies(
  overrides: Partial<Vs005DeployPlanDependencies> = {}
): Vs005DeployPlanDependencies {
  return {
    loadConfig: () => ciConfig,
    loadRelease: () => ({
      version: "1.0.0",
      commitSha: "0123456789abcdef0123456789abcdef01234567",
      buildId: "2026-09-04T10:00:00Z"
    }),
    inspect: async () => ({
      providerReachable: true,
      providerAuthReady: true,
      providerAccountId: "account-123",
      generatedWorkerName: "cadence-beta",
      hostnameReady: true,
      generatedConfigValid: true,
      webBuildReady: true,
      workerExists: true,
      priorVersionAvailable: true,
      secretStatus: {
        SUPABASE_SECRET_KEY: { providerPresent: true, bootstrapInputAvailable: false }
      }
    }),
    generatePlanId: () => "plan-1",
    writePlan: async (_path, plan) => { writtenPlans.push(plan); },
    ...overrides
  };
}
```

Import `readFileSync` from `node:fs` and `resolve` from `node:path`. The helper's structural absence of any mutation method is part of the read-only plan boundary.

- [ ] **Step 2: Run RED**

```powershell
cd apps/api
node --import tsx --test scripts/vs005-deployment-artifacts.test.ts scripts/vs005-deploy-plan.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement shared safe failure evidence and read-only readiness/plan**

Implement `makeVs005OperatorFailure()` in `vs005-deployment-artifacts.ts` as a pure constructor that accepts only the typed safe fields above and freezes/returns the result. Plan/setup failures use `mutationOccurred=false` and `existingService="UNCHANGED"`. They must identify the canonical config path and one next safe action; raw provider exceptions are mapped to a bounded code before artifact creation.

The command accepts:

```text
--config config/cadence.runtime.beta.json
--out .cadence/vs005/deployment-plan.json
```

It must validate canonical config, Cloudflare deployment authentication/account reachability (for example through a read-only Wrangler identity check), the observed authenticated account ID, deterministic generated Worker name, hostname/custom-domain readiness where inspectable, required Worker secret readiness, generated provider config/custom-domain target, **deployed-mode** Beta Supabase target/schema/security rules, build readiness, and release identity. A PASS plan requires a non-empty observed provider account ID; apply must later compare the live account ID/Worker name against `providerTarget` before mutation. Secret readiness is true when the named secret is already present on the Worker **or**, for a first deployment/authorized rotation, the corresponding local secret source is available for Task 12's secure deploy-time upload; only booleans are recorded. The plan also records whether a prior provider version is inspectable, yielding `rollback.application=SUPPORTED` only when true. Cloudflare deployment credentials are never copied into Worker runtime bindings or plan artifacts. It must not require Beta application tables to be empty after pilot bootstrap. It may inspect Cloudflare account/Worker metadata only through read-only commands/APIs.

It must end with either:

```text
DEPLOYMENT READINESS: PASS
NO DEPLOYMENT PERFORMED
```

or:

```text
DEPLOYMENT READINESS: BLOCKED
NO DEPLOYMENT PERFORMED
```

- [ ] **Step 4: Ignore generated local deployment evidence**

Add to root `.gitignore`:

```gitignore
# Local/generated VS005 deployment evidence; safe summaries are copied to governed docs only when approved
.cadence/
```

`apps/runtime-cloudflare/.gitignore` must already ignore `wrangler.generated.jsonc`. Neither generated target files nor plan/result artifacts become a second source of truth.

- [ ] **Step 5: Wire operator scripts**

Root `package.json`:

```json
"cadence:setup:check": "npm --prefix apps/api run vs005:deploy:plan",
"cadence:deploy:plan": "npm --prefix apps/api run vs005:deploy:plan"
```

Use one implementation; `setup:check` is a friendly alias at this stage, not an auto-provisioner.

- [ ] **Step 6: Run focused + script typecheck**

```powershell
cd apps/api
node --import tsx --test scripts/vs005-deployment-artifacts.test.ts scripts/vs005-deploy-plan.test.ts
npx.cmd tsc --noEmit -p tsconfig.scripts.json
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
cd ..\..
git add apps/api/scripts/vs005-deployment-artifacts.ts apps/api/scripts/vs005-deployment-artifacts.test.ts apps/api/scripts/vs005-deploy-plan.ts apps/api/scripts/vs005-deploy-plan.test.ts apps/api/package.json package.json .gitignore
git diff --cached --check
git commit -m "feat(vs005): add fail-closed deployment planning"
```

**Checkpoint deliverable:** An operator can obtain a deterministic, safe, read-only deployment plan showing target, release, secret readiness, rollback availability, worker policy, and explicit no-migration/no-destructive-action status; setup/plan failures are actionable safe artifacts rather than raw exceptions.

---

### Task 12: Add Plan-Bound Deployment Apply, Verification, and Drift Detection

**Files:**
- Create: `apps/api/scripts/vs005-deploy-apply.ts`
- Create: `apps/api/scripts/vs005-deploy-apply.test.ts`
- Create: `apps/api/scripts/vs005-deploy-verify.ts`
- Create: `apps/api/scripts/vs005-deploy-verify.test.ts`
- Create: `apps/api/scripts/vs005-cloudflare-deployment-provider.ts`
- Create: `apps/api/scripts/vs005-cloudflare-deployment-provider.test.ts`
- Modify: `apps/api/package.json`
- Modify: `package.json`

**Interfaces:**
- Apply consumes only a versioned deployment-plan artifact plus current canonical config and current release identity.
- Apply re-computes the config fingerprint/target before calling Wrangler.
- Verify returns a versioned credential-free verification artifact with checks for web, health, API, environment/release/config identity, Supabase target, scheduled runtime, and config drift.

Use these explicit orchestration contracts:

```ts
export interface Vs005DeploymentProvider {
  deploy(input: {
    config: CadenceRuntimeConfig;
    generatedWranglerPath: string;
    bootstrapSecrets?: CadenceResolvedSecrets;
  }): Promise<{ deploymentId: string; providerVersionId: string }>;

  inspect(): Promise<{
    accountId: string;
    workerName: string;
    workerExists: boolean;
    schedule: string | null;
    configuredSecrets: readonly string[];
    configFingerprint: string | null;
    supabaseProjectRef: string | null;
  }>;
}

export interface Vs005DeploymentResult {
  artifactType: "cadence.vs005.deployment-result";
  formatVersion: 1;
  planId: string;
  deploymentId: string;
  providerVersionId: string;
  deployedAt: string;
  environment: "local" | "qa" | "beta";
  provider: "cloudflare";
  providerTarget: { accountId: string; workerName: string };
  publicUrl: string;
  configVersion: 1;
  release: CadenceReleaseIdentity;
  configFingerprint: string;
  databaseAction: "NONE";
  destructiveActions: readonly [];
}

export async function applyVs005Deployment(input: {
  plan: Vs005DeploymentPlan;
  currentConfig: CadenceRuntimeConfig;
  currentRelease: CadenceReleaseIdentity;
  currentSecrets?: CadenceResolvedSecrets;
  prepareArtifacts: (input: {
    config: CadenceRuntimeConfig;
    release: CadenceReleaseIdentity;
  }) => Promise<{ generatedWranglerPath: string }>;
  provider: Vs005DeploymentProvider;
  clock?: () => Date;
}): Promise<Vs005DeploymentResult>;
```

Verification uses injected HTTP/provider readers so unit tests never contact the network.

Use these exact local fixtures at the top of `vs005-deploy-apply.test.ts` and reuse the same values in `vs005-deploy-verify.test.ts`; do not depend on an undeclared helper from Task 11:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  fingerprintCadenceRuntimeConfig,
  validateCadenceRuntimeConfig
} from "../src/bootstrap/cadence-config";

const validConfig = validateCadenceRuntimeConfig(JSON.parse(readFileSync(
  resolve(process.cwd(), "../../config/cadence.runtime.ci.json"),
  "utf8"
)));

const validRelease: CadenceReleaseIdentity = {
  version: "1.0.0",
  commitSha: "0123456789abcdef0123456789abcdef01234567",
  buildId: "2026-09-04T10:00:00Z"
};

function validPlan(): Vs005DeploymentPlan {
  return {
    artifactType: "cadence.vs005.deployment-plan",
    formatVersion: 1,
    planId: "plan-1",
    configFingerprint: fingerprintCadenceRuntimeConfig(validConfig),
    release: validRelease,
    environment: "beta",
    provider: "cloudflare",
    providerTarget: { accountId: "account-123", workerName: "cadence-beta", workerExists: true },
    publicUrl: validConfig.application.publicUrl,
    supabaseProjectRef: validConfig.supabase.projectRef,
    configVersion: 1,
    worker: { ...validConfig.worker },
    secrets: [{
      name: validConfig.supabase.secretKeySecretRef,
      providerPresent: true,
      bootstrapInputAvailable: false,
      ready: true
    }],
    database: { migrationAction: "NONE" },
    rollback: { application: "SUPPORTED", database: "NOT_PERFORMED" },
    changes: ["WEB_STATIC_ASSETS", "API_WORKER", "SCHEDULED_WORKER"],
    destructiveActions: [],
    readiness: "PASS",
    blockers: []
  };
}

const plan = validPlan();
const deployment: Vs005DeploymentResult = {
  artifactType: "cadence.vs005.deployment-result",
  formatVersion: 1,
  planId: plan.planId,
  deploymentId: "deployment-1",
  providerVersionId: "version-1",
  deployedAt: "2026-09-04T12:34:56.000Z",
  environment: plan.environment,
  provider: "cloudflare",
  providerTarget: {
    accountId: plan.providerTarget.accountId,
    workerName: plan.providerTarget.workerName
  },
  publicUrl: plan.publicUrl,
  configVersion: 1,
  release: plan.release,
  configFingerprint: plan.configFingerprint,
  databaseAction: "NONE",
  destructiveActions: []
};
```

- [ ] **Step 1: Write RED stale-plan tests**

In `vs005-deploy-apply.test.ts`, use the fixture above and a fake provider that only records deploy calls:

```ts
class FakeDeploymentProvider implements Vs005DeploymentProvider {
  deployCalls: Array<{
    config: CadenceRuntimeConfig;
    bootstrapSecrets?: CadenceResolvedSecrets;
  }> = [];

  inspection: Awaited<ReturnType<Vs005DeploymentProvider["inspect"]>>;

  constructor(overrides: Partial<Awaited<ReturnType<Vs005DeploymentProvider["inspect"]>>> = {}) {
    this.inspection = {
      accountId: "account-123",
      workerName: "cadence-beta",
      workerExists: true,
      schedule: "* * * * *",
      configuredSecrets: ["SUPABASE_SECRET_KEY"],
      configFingerprint: plan.configFingerprint,
      supabaseProjectRef: "abc123",
      ...overrides
    };
  }

  async deploy(input: {
    config: CadenceRuntimeConfig;
    generatedWranglerPath: string;
    bootstrapSecrets?: CadenceResolvedSecrets;
  }) {
    this.deployCalls.push({
      config: input.config,
      bootstrapSecrets: input.bootstrapSecrets
    });
    return { deploymentId: "deployment-1", providerVersionId: "version-1" };
  }

  async inspect() {
    return this.inspection;
  }
}

test("apply rejects config changed after plan", async () => {
  const provider = new FakeDeploymentProvider();
  const changedConfig = {
    ...validConfig,
    worker: { ...validConfig.worker, maxRounds: 9 }
  };

  await assert.rejects(
    () => applyVs005Deployment({
      plan,
      currentConfig: changedConfig,
      currentRelease: plan.release,
      currentSecrets: { supabaseSecretKey: "server-secret" },
      prepareArtifacts: async () => ({ generatedWranglerPath: "wrangler.generated.jsonc" }),
      provider
    }),
    /NEW DEPLOYMENT PLAN REQUIRED/
  );
  assert.equal(provider.deployCalls.length, 0);
});

test("apply rejects release identity changed after plan", async () => {
  const provider = new FakeDeploymentProvider();
  await assert.rejects(
    () => applyVs005Deployment({
      plan,
      currentConfig: validConfig,
      currentRelease: { ...plan.release, commitSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
      currentSecrets: { supabaseSecretKey: "server-secret" },
      prepareArtifacts: async () => ({ generatedWranglerPath: "wrangler.generated.jsonc" }),
      provider
    }),
    /NEW DEPLOYMENT PLAN REQUIRED/
  );
  assert.equal(provider.deployCalls.length, 0);
});

test("apply refuses BLOCKED or destructive plans", async () => {
  for (const unsafePlan of [
    { ...plan, readiness: "BLOCKED" as const },
    { ...plan, destructiveActions: ["database-reset"] as never }
  ]) {
    const provider = new FakeDeploymentProvider();
    await assert.rejects(
      () => applyVs005Deployment({
        plan: unsafePlan,
        currentConfig: validConfig,
        currentRelease: plan.release,
        currentSecrets: { supabaseSecretKey: "server-secret" },
        prepareArtifacts: async () => ({ generatedWranglerPath: "wrangler.generated.jsonc" }),
        provider
      })
    );
    assert.equal(provider.deployCalls.length, 0);
  }
});
```

Add target-revalidation and local-preparation gates:

```ts
test("apply rejects a changed authenticated Cloudflare account before mutation", async () => {
  const provider = new FakeDeploymentProvider({ accountId: "wrong-account" });

  await assert.rejects(
    () => applyVs005Deployment({
      plan,
      currentConfig: validConfig,
      currentRelease: plan.release,
      prepareArtifacts: async () => ({ generatedWranglerPath: "wrangler.generated.jsonc" }),
      provider
    }),
    /NEW DEPLOYMENT PLAN REQUIRED/
  );
  assert.equal(provider.deployCalls.length, 0);
});

test("first deployment passes bootstrap secret only to the provider boundary", async () => {
  const provider = new FakeDeploymentProvider({
    workerExists: false,
    schedule: null,
    configuredSecrets: [],
    configFingerprint: null,
    supabaseProjectRef: null
  });
  const firstPlan = {
    ...plan,
    providerTarget: { ...plan.providerTarget, workerExists: false },
    rollback: { application: "UNAVAILABLE" as const, database: "NOT_PERFORMED" as const },
    secrets: [{
      name: "SUPABASE_SECRET_KEY",
      providerPresent: false,
      bootstrapInputAvailable: true,
      ready: true
    }]
  };

  await applyVs005Deployment({
    plan: firstPlan,
    currentConfig: validConfig,
    currentRelease: plan.release,
    currentSecrets: { supabaseSecretKey: "server-secret" },
    prepareArtifacts: async () => ({ generatedWranglerPath: "wrangler.generated.jsonc" }),
    provider
  });

  assert.equal(provider.deployCalls.length, 1);
  assert.deepEqual(provider.deployCalls[0]?.bootstrapSecrets, {
    supabaseSecretKey: "server-secret"
  });
  assert.doesNotMatch(JSON.stringify(firstPlan), /server-secret/);
});

test("artifact preparation failure cannot reach provider deployment", async () => {
  const provider = new FakeDeploymentProvider();
  await assert.rejects(
    () => applyVs005Deployment({
      plan,
      currentConfig: validConfig,
      currentRelease: plan.release,
      currentSecrets: { supabaseSecretKey: "server-secret" },
      prepareArtifacts: async () => {
        throw new Error("web build failed");
      },
      provider
    }),
    /web build failed/
  );
  assert.equal(provider.deployCalls.length, 0);
});
```

Task 3's table-driven fingerprint test is the single field-coverage proof; Task 12 must not invent a second fingerprint algorithm. Add this exact apply-result provenance test:

```ts
test("apply result identity comes from validated config/release and the inspected provider target", async () => {
  const provider = new FakeDeploymentProvider();
  const result = await applyVs005Deployment({
    plan,
    currentConfig: validConfig,
    currentRelease: plan.release,
    prepareArtifacts: async () => ({ generatedWranglerPath: "wrangler.generated.jsonc" }),
    provider,
    clock: () => new Date("2026-09-04T12:34:56.000Z")
  });

  assert.equal(result.deployedAt, "2026-09-04T12:34:56.000Z");
  assert.equal(result.environment, validConfig.application.environment);
  assert.equal(result.provider, "cloudflare");
  assert.deepEqual(result.providerTarget, {
    accountId: plan.providerTarget.accountId,
    workerName: plan.providerTarget.workerName
  });
  assert.equal(result.publicUrl, validConfig.application.publicUrl);
  assert.equal(result.configVersion, validConfig.configVersion);
  assert.deepEqual(result.release, plan.release);
  assert.equal(result.configFingerprint, plan.configFingerprint);
  assert.equal(result.databaseAction, "NONE");
  assert.deepEqual(result.destructiveActions, []);
});
```

- [ ] **Step 2: Write RED verification/drift tests**

Define:

```ts
export interface Vs005VerificationReaders {
  getWeb(): Promise<{ status: number }>;
  inspectBrowserBundle(): Promise<{
    status: number;
    forbiddenServerMarkersFound: boolean;
  }>;
  getHealth(): Promise<{ status: number; json: unknown }>;
  probeApi(): Promise<{ status: number }>;
  inspectProvider(): Promise<{
    accountId: string;
    workerName: string;
    schedule: string;
    configuredSecrets: readonly string[];
    configFingerprint: string;
    supabaseProjectRef: string | null;
  }>;
}

export async function verifyVs005Deployment(input: {
  deployment: Vs005DeploymentResult;
  expectedConfig: CadenceRuntimeConfig;
  readers: Vs005VerificationReaders;
}): Promise<Vs005DeploymentVerification>;
```

Use this exact PASS reader fixture, then override one fact per test:

```ts
type ReaderOverrides = {
  web?: { status: number };
  browserBundle?: { status: number; forbiddenServerMarkersFound: boolean };
  health?: { status: number; json: unknown };
  api?: { status: number };
  provider?: Awaited<ReturnType<Vs005VerificationReaders["inspectProvider"]>>;
};

function passReaders(overrides: ReaderOverrides = {}): Vs005VerificationReaders {
  return {
    getWeb: async () => overrides.web ?? { status: 200 },
    inspectBrowserBundle: async () => overrides.browserBundle ?? {
      status: 200,
      forbiddenServerMarkersFound: false
    },
    getHealth: async () => overrides.health ?? {
      status: 200,
      json: {
        status: "ok",
        service: "cadence-api",
        environment: deployment.environment,
        configVersion: deployment.configVersion,
        configFingerprint: deployment.configFingerprint,
        version: deployment.release.version,
        commitSha: deployment.release.commitSha,
        buildId: deployment.release.buildId
      }
    },
    probeApi: async () => overrides.api ?? { status: 401 },
    inspectProvider: async () => overrides.provider ?? {
      accountId: deployment.providerTarget.accountId,
      workerName: deployment.providerTarget.workerName,
      schedule: validConfig.worker.schedule,
      configuredSecrets: [validConfig.supabase.secretKeySecretRef],
      configFingerprint: deployment.configFingerprint,
      supabaseProjectRef: validConfig.supabase.projectRef
    }
  };
}

test("verification reports release drift without copying business bodies", async () => {
  const readers = passReaders({
    health: {
      status: 200,
      json: {
        status: "ok",
        service: "cadence-api",
        environment: "beta",
        configVersion: 1,
        configFingerprint: deployment.configFingerprint,
        version: deployment.release.version,
        commitSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        buildId: deployment.release.buildId
      }
    }
  });

  const result = await verifyVs005Deployment({ deployment, expectedConfig: validConfig, readers });
  assert.equal(result.outcome, "FAIL");
  assert.ok(result.checks.some((check) => check.code === "RELEASE_DRIFT"));
  assert.equal(result.pilotActivation, "NOT_AUTHORISED");
});

test("verification detects schedule and secret-binding drift", async () => {
  const readers = passReaders({
    provider: {
      accountId: deployment.providerTarget.accountId,
      workerName: deployment.providerTarget.workerName,
      schedule: "*/5 * * * *",
      configuredSecrets: [],
      configFingerprint: deployment.configFingerprint,
      supabaseProjectRef: "abc123"
    }
  });

  const result = await verifyVs005Deployment({ deployment, expectedConfig: validConfig, readers });
  assert.ok(result.checks.some((check) => check.code === "SCHEDULE_DRIFT"));
  assert.ok(result.checks.some((check) => check.code === "SECRET_BINDING_DRIFT"));
});

test("verification fails if the deployed browser bundle contains a server-only marker", async () => {
  const readers = passReaders({
    browserBundle: { status: 200, forbiddenServerMarkersFound: true }
  });
  const result = await verifyVs005Deployment({ deployment, expectedConfig: validConfig, readers });
  assert.ok(result.checks.some((check) => check.code === "BROWSER_SERVER_CONFIG_EXPOSURE"));
});

test("verification detects provider-account or Worker-name drift", async () => {
  const readers = passReaders({
    provider: {
      accountId: "wrong-account",
      workerName: deployment.providerTarget.workerName,
      schedule: "* * * * *",
      configuredSecrets: ["SUPABASE_SECRET_KEY"],
      configFingerprint: deployment.configFingerprint,
      supabaseProjectRef: "abc123"
    }
  });
  const result = await verifyVs005Deployment({ deployment, expectedConfig: validConfig, readers });
  assert.ok(result.checks.some((check) => check.code === "PROVIDER_TARGET_DRIFT"));
});

test("verification reports an unreachable governed API route", async () => {
  const readers = passReaders({ api: { status: 404 } });
  const result = await verifyVs005Deployment({ deployment, expectedConfig: validConfig, readers });
  assert.ok(result.checks.some((check) => check.code === "API_UNAVAILABLE"));
});
```

`inspectBrowserBundle()` fetches the deployed index/assets in memory and returns only a boolean after scanning for server-only markers such as `secretKeySecretRef`, the configured secret-reference name, `SUPABASE_SECRET_KEY`, and service-role terminology; it never returns or persists asset bodies. `probeApi()` checks only status/reachability of a known `/api/v1` route (an authentication denial such as 401/403 is acceptable proof that the route exists); its response body is never stored in the verification artifact. Provider inspection compares configured secret **names** only and never reads values. Add these exact one-fact verification cases:

```ts
test("verification detects environment drift", async () => {
  const readers = passReaders({
    health: {
      status: 200,
      json: {
        status: "ok",
        service: "cadence-api",
        environment: "qa",
        configVersion: deployment.configVersion,
        configFingerprint: deployment.configFingerprint,
        version: deployment.release.version,
        commitSha: deployment.release.commitSha,
        buildId: deployment.release.buildId
      }
    }
  });
  const result = await verifyVs005Deployment({ deployment, expectedConfig: validConfig, readers });
  assert.ok(result.checks.some((check) => check.code === "ENVIRONMENT_DRIFT"));
});

test("verification detects canonical config fingerprint drift", async () => {
  const readers = passReaders({
    provider: {
      accountId: deployment.providerTarget.accountId,
      workerName: deployment.providerTarget.workerName,
      schedule: validConfig.worker.schedule,
      configuredSecrets: [validConfig.supabase.secretKeySecretRef],
      configFingerprint: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      supabaseProjectRef: validConfig.supabase.projectRef
    }
  });
  const result = await verifyVs005Deployment({ deployment, expectedConfig: validConfig, readers });
  assert.ok(result.checks.some((check) => check.code === "CONFIG_DRIFT"));
});

test("verification detects Supabase target drift", async () => {
  const readers = passReaders({
    provider: {
      accountId: deployment.providerTarget.accountId,
      workerName: deployment.providerTarget.workerName,
      schedule: validConfig.worker.schedule,
      configuredSecrets: [validConfig.supabase.secretKeySecretRef],
      configFingerprint: deployment.configFingerprint,
      supabaseProjectRef: "wrong-ref"
    }
  });
  const result = await verifyVs005Deployment({ deployment, expectedConfig: validConfig, readers });
  assert.ok(result.checks.some((check) => check.code === "SUPABASE_TARGET_DRIFT"));
});

test("verification detects required-secret binding drift by name only", async () => {
  const readers = passReaders({
    provider: {
      accountId: deployment.providerTarget.accountId,
      workerName: deployment.providerTarget.workerName,
      schedule: validConfig.worker.schedule,
      configuredSecrets: [],
      configFingerprint: deployment.configFingerprint,
      supabaseProjectRef: validConfig.supabase.projectRef
    }
  });
  const result = await verifyVs005Deployment({ deployment, expectedConfig: validConfig, readers });
  assert.ok(result.checks.some((check) => check.code === "SECRET_BINDING_DRIFT"));
});

test("verification records same-origin CORS as not applicable", async () => {
  const result = await verifyVs005Deployment({
    deployment,
    expectedConfig: validConfig,
    readers: passReaders()
  });
  assert.ok(result.checks.some((check) =>
    check.name === "cors" &&
    check.outcome === "PASS" &&
    check.code === "SAME_ORIGIN_CORS_NOT_APPLICABLE"
  ));
});

test("verification rejects a future cross-origin API topology until separately designed", async () => {
  await assert.rejects(
    () => verifyVs005Deployment({
      deployment,
      expectedConfig: {
        ...validConfig,
        application: {
          ...validConfig.application,
          apiBaseUrl: "https://api-other.example.test"
        }
      },
      readers: passReaders()
    }),
    /UNSUPPORTED_CROSS_ORIGIN_CONFIG/
  );
});
```

`PROVIDER_TARGET_DRIFT` is already proved by the explicit provider-account/Worker-name test immediately above; do not duplicate it. The scheduled handler itself is exercised automatically in Task 10's local Wrangler verification and by real Cron evidence in Task 15; deployment verification confirms the canonical Cron trigger is present.

Add RED provider-boundary tests in `vs005-cloudflare-deployment-provider.test.ts` using injected filesystem/spawn functions rather than a real Cloudflare account:

```ts
test("bootstrap secret is transported through a temporary secrets file and deleted after deploy", async () => {
  const io = fakeProviderIo();
  const provider = createCloudflareDeploymentProvider(io);

  await provider.deploy({
    config: validConfig,
    generatedWranglerPath: "wrangler.generated.jsonc",
    bootstrapSecrets: { supabaseSecretKey: "server-secret" }
  });

  assert.deepEqual(io.spawnArgv, [
    "wrangler", "deploy",
    "--config", "wrangler.generated.jsonc",
    "--secrets-file", io.createdSecretPath
  ]);
  assert.deepEqual(JSON.parse(io.secretFileContent), {
    SUPABASE_SECRET_KEY: "server-secret"
  });
  assert.equal(io.secretFileMode, 0o600);
  assert.equal(io.deletedPaths.includes(io.createdSecretPath), true);
  assert.doesNotMatch(JSON.stringify(io.spawnArgv), /server-secret/);
});

test("provider cleanup still deletes the temporary secret file when Wrangler fails", async () => {
  const io = fakeProviderIo({ deployError: new Error("provider failed token=do-not-copy") });
  const provider = createCloudflareDeploymentProvider(io);

  await assert.rejects(() => provider.deploy({
    config: validConfig,
    generatedWranglerPath: "wrangler.generated.jsonc",
    bootstrapSecrets: { supabaseSecretKey: "server-secret" }
  }));

  assert.equal(io.deletedPaths.includes(io.createdSecretPath), true);
});

test("existing remote secret is preserved without a local secret transport file", async () => {
  const io = fakeProviderIo();
  const provider = createCloudflareDeploymentProvider(io);

  await provider.deploy({
    config: validConfig,
    generatedWranglerPath: "wrangler.generated.jsonc"
  });

  assert.equal(io.createdSecretPath, null);
  assert.doesNotMatch(JSON.stringify(io.spawnArgv), /--secrets-file/);
});
```

Use this explicit provider-I/O seam in `vs005-cloudflare-deployment-provider.ts`:

```ts
export interface CloudflareDeploymentProviderIo {
  createTemporarySecretFile(content: string, mode: number): Promise<string>;
  deleteFile(path: string): Promise<void>;
  runWrangler(args: readonly string[]): Promise<{ exitCode: number; stdout: string }>;
}

export function createCloudflareDeploymentProvider(
  io: CloudflareDeploymentProviderIo
): Vs005DeploymentProvider;
```

The production `createTemporarySecretFile()` uses an OS temp directory, exclusive create, and owner-only `0o600` mode where supported. Define the deterministic test double exactly:

```ts
type FakeProviderIo = CloudflareDeploymentProviderIo & {
  createdSecretPath: string | null;
  secretFileContent: string;
  secretFileMode: number | null;
  deletedPaths: string[];
  spawnArgv: string[];
};

function fakeProviderIo(options: { deployError?: Error } = {}): FakeProviderIo {
  const state: FakeProviderIo = {
    createdSecretPath: null,
    secretFileContent: "",
    secretFileMode: null,
    deletedPaths: [],
    spawnArgv: [],
    async createTemporarySecretFile(content, mode) {
      const path = "/tmp/cadence-vs005-secrets.json";
      state.createdSecretPath = path;
      state.secretFileContent = content;
      state.secretFileMode = mode;
      return path;
    },
    async deleteFile(path) {
      state.deletedPaths.push(path);
    },
    async runWrangler(args) {
      state.spawnArgv = ["wrangler", ...args];
      if (options.deployError) throw options.deployError;
      return { exitCode: 0, stdout: JSON.stringify({ id: "deployment-1", version_id: "version-1" }) };
    }
  };
  return state;
}
```

Production code uses argv-array spawning, never a shell-concatenated command.

- [ ] **Step 3: Run RED**

```powershell
cd apps/api
node --import tsx --test scripts/vs005-deploy-apply.test.ts scripts/vs005-deploy-verify.test.ts scripts/vs005-cloudflare-deployment-provider.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement apply with exact ordering**

```text
read + validate plan artifact
load + validate current canonical config
load current release identity
recompute config fingerprint
compare target/release/fingerprint with plan
verify plan readiness PASS and destructiveActions empty
read-only inspect the authenticated Cloudflare account/Worker/secret state again
require account ID, Worker name, Worker existence, and remote-secret presence to match the reviewed plan; if not, NEW DEPLOYMENT PLAN REQUIRED
if an existing Worker reports a Cadence config fingerprint that differs from the reviewed plan, require a new plan rather than blindly overwriting drift
prepare local artifacts from the validated current config/release:
  generate browser config
  rebuild Vite static assets
  regenerate Wrangler config (including secrets.required names only)
  run local Wrangler dry-run bundle check
if plan says providerPresent=false, re-resolve the required local secret value at the bootstrap boundary and prepare deploy-time secret upload from that resolved value; if providerPresent=true, no local secret value is required for apply
ONLY NOW invoke Wrangler deploy
capture provider deployment ID/version safely
write deployment result artifact
return with verification still REQUIRED; do not self-certify the deployment inside apply
```

`prepareArtifacts` is local-only and must not call Cloudflare mutation APIs. It runs through the same Task 6/10 generators used by CI, so the uploaded static assets and Worker config are rebuilt from the current canonical config rather than trusting stale `dist` or generated files.

`vs005-cloudflare-deployment-provider.ts` implements the provider boundary. It must not place secret values on the command line. When the plan shows a missing remote secret but authorized bootstrap input is available, create a unique temporary JSON secrets file using exclusive creation, require `currentSecrets` and write only `{ [config.supabase.secretKeySecretRef]: currentSecrets.supabaseSecretKey }`, pass its path to `wrangler deploy --secrets-file <path>`, and delete the file in `finally` whether deployment succeeds or fails. Use the operating-system temp directory; request owner-only file mode where the platform supports it. The path and value are never persisted in VS005 evidence. If a secret is already present remotely and no explicit rotation is in scope, deploy without `--secrets-file`; Wrangler preserves existing secrets.

There is no database push/reset/migration command in apply. Any failure before provider invocation uses the Task 11 safe failure artifact with `mutationOccurred=false` and `existingService="UNCHANGED"`. If provider invocation was attempted and then failed, set `mutationOccurred=true`; perform only a read-only health check to classify `existingService` as `HEALTHY`, `UNHEALTHY`, or `UNKNOWN`, and never copy the raw provider exception/body into evidence.
Add provider-boundary tests that inject temp-file/spawn dependencies and prove: the secret value appears only in the temporary file content, not argv/log/result; `--secrets-file` is used only when the reviewed plan needs bootstrap secret upload; and cleanup runs on both success and thrown provider failure.

- [ ] **Step 5: Implement verification**

Verification must use only safe endpoints/provider metadata and return a structured list. It compares the health endpoint's environment, config schema version, canonical config fingerprint, and release identity against the deployment artifact; it must not accept a provider-only success response as application verification. Verification failures also use the Task 11 failure contract for operator-facing diagnostics: identify the safe drift code, expected/observed non-secret fact when available, canonical config path, and the next safe action; never persist response bodies or unrestricted provider errors.

Return:

```ts
export interface Vs005DeploymentVerification {
  artifactType: "cadence.vs005.deployment-verification";
  formatVersion: 1;
  deploymentId: string;
  environment: string;
  release: CadenceReleaseIdentity;
  configVersion: 1;
  checks: {
    name: "web" | "browser-config" | "health" | "api" | "environment" | "release" | "provider-target" | "supabase-target" | "schedule" | "secret-binding" | "config-drift" | "cors";
    outcome: "PASS" | "FAIL";
    code: string;
  }[];
  outcome: "PASS" | "FAIL";
  pilotActivation: "NOT_AUTHORISED";
}
```

- [ ] **Step 6: Add root commands**

```json
"cadence:deploy:apply": "npm --prefix apps/api run vs005:deploy:apply",
"cadence:deploy:verify": "npm --prefix apps/api run vs005:deploy:verify"
```

- [ ] **Step 7: Run focused/script/API checks**

```powershell
cd apps/api
node --import tsx --test scripts/vs005-deploy-apply.test.ts scripts/vs005-deploy-verify.test.ts scripts/vs005-cloudflare-deployment-provider.test.ts
npx.cmd tsc --noEmit -p tsconfig.scripts.json
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
cd ..\..
git add apps/api/scripts/vs005-deploy-apply.ts apps/api/scripts/vs005-deploy-apply.test.ts apps/api/scripts/vs005-deploy-verify.ts apps/api/scripts/vs005-deploy-verify.test.ts apps/api/scripts/vs005-cloudflare-deployment-provider.ts apps/api/scripts/vs005-cloudflare-deployment-provider.test.ts apps/api/package.json package.json
git diff --cached --check
git commit -m "feat(vs005): add plan-bound deployment verification"
```

**Checkpoint deliverable:** Cadence can apply only a current PASS plan, and the separate mandatory verify command proves hosted identity/runtime and reports drift; neither operation resets or migrates the database.

---

### Task 13: Add Safe Rollback Evidence and Release/Provider Inspection

**Files:**
- Create: `apps/api/scripts/vs005-rollback.ts`
- Create: `apps/api/scripts/vs005-rollback.test.ts`
- Modify: `apps/api/scripts/vs005-cloudflare-deployment-provider.ts`
- Modify: `apps/api/scripts/vs005-cloudflare-deployment-provider.test.ts`
- Modify: `apps/api/package.json`
- Modify: `package.json`

**Interfaces:**
- Rollback is application-version rollback only.
- It consumes an explicit provider deployment/version identifier and current deployment evidence.
- It refuses to claim or perform DB rollback.

Use this explicit request/provider contract:

```ts
export interface Vs005RollbackRequest {
  providerVersionId: string;
  expectedRelease: CadenceReleaseIdentity;
  expectedConfigFingerprint: string;
  expectedEnvironment: "local" | "qa" | "beta";
  expectedProvider: "cloudflare";
  expectedProviderTarget: { accountId: string; workerName: string };
  expectedPublicUrl: string;
  databaseAction: "NONE";
}

export function validateVs005RollbackRequest(value: unknown): Vs005RollbackRequest;

export interface Vs005RollbackProvider {
  inspectTarget(): Promise<{ accountId: string; workerName: string }>;
  rollback(providerVersionId: string): Promise<{
    deploymentId: string;
    activeProviderVersionId: string;
  }>;
}

export async function rollbackVs005Application(input: {
  request: Vs005RollbackRequest;
  currentDeploymentEvidence: Vs005DeploymentResult;
  targetDeploymentEvidence: Vs005DeploymentResult;
  currentConfig: CadenceRuntimeConfig;
  provider: Vs005RollbackProvider;
  verify: (
    deployment: Vs005DeploymentResult,
    expectedConfig: CadenceRuntimeConfig
  ) => Promise<Vs005DeploymentVerification>;
  clock?: () => Date;
}): Promise<Vs005DeploymentVerification>;
```

The CLI/JSON request validator accepts only `databaseAction: "NONE"`; any other value is a validation error before provider invocation. The CLI accepts `--current-deployment <current-result.json>`, `--target-deployment <previous-result.json>`, `--config <canonical-config.json>`, and `--out <rollback-verification.json>`. It derives the provider version, prior release identity, expected config fingerprint, environment, provider, and public origin from the reviewed target deployment artifact rather than asking the operator to retype them. Rollback is blocked unless (a) the target deployment fingerprint equals the freshly recomputed current canonical-config fingerprint, (b) current and target deployment evidence share the same environment/provider/public origin, and (c) their `providerTarget.accountId` and `providerTarget.workerName` are identical. Immediately before the rollback mutation, the provider performs one read-only target inspection and must match that reviewed account/Worker identity; otherwise rollback stops without mutation.

- [ ] **Step 1: Write RED rollback tests**

```ts
const validConfig = validateCadenceRuntimeConfig(JSON.parse(readFileSync(
  resolve(process.cwd(), "../../config/cadence.runtime.ci.json"),
  "utf8"
)));
const rollbackFingerprint = fingerprintCadenceRuntimeConfig(validConfig);
const previousRelease: CadenceReleaseIdentity = {
  version: "1.0.0",
  commitSha: "0123456789abcdef0123456789abcdef01234567",
  buildId: "2026-09-04T10:00:00Z"
};
const previousDeployment: Vs005DeploymentResult = {
  artifactType: "cadence.vs005.deployment-result",
  formatVersion: 1,
  planId: "plan-previous",
  deploymentId: "deployment-previous",
  providerVersionId: "version-previous",
  deployedAt: "2026-09-04T10:10:00.000Z",
  environment: "beta",
  provider: "cloudflare",
  providerTarget: { accountId: "account-123", workerName: "cadence-beta" },
  publicUrl: validConfig.application.publicUrl,
  configVersion: 1,
  release: previousRelease,
  configFingerprint: rollbackFingerprint,
  databaseAction: "NONE",
  destructiveActions: []
};
const currentDeploymentEvidence: Vs005DeploymentResult = {
  ...previousDeployment,
  planId: "plan-current",
  deploymentId: "deployment-current",
  providerVersionId: "version-current",
  deployedAt: "2026-09-04T11:00:00.000Z",
  release: {
    version: "1.0.1",
    commitSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    buildId: "2026-09-04T11:00:00Z"
  }
};

function passingVerification(overrides: {
  deploymentId?: string;
  release?: CadenceReleaseIdentity;
} = {}): Vs005DeploymentVerification {
  return {
    artifactType: "cadence.vs005.deployment-verification",
    formatVersion: 1,
    deploymentId: overrides.deploymentId ?? previousDeployment.deploymentId,
    environment: "beta",
    release: overrides.release ?? previousRelease,
    configVersion: 1,
    checks: [{ name: "release", outcome: "PASS", code: "RELEASE_MATCH" }],
    outcome: "PASS",
    pilotActivation: "NOT_AUTHORISED"
  };
}

function failingVerification(code: string): Vs005DeploymentVerification {
  return {
    ...passingVerification(),
    checks: [{ name: "release", outcome: "FAIL", code }],
    outcome: "FAIL"
  };
}

class FakeRollbackProvider implements Vs005RollbackProvider {
  rollbackCalls: string[] = [];

  constructor(
    readonly target = {
      accountId: currentDeploymentEvidence.providerTarget.accountId,
      workerName: currentDeploymentEvidence.providerTarget.workerName
    }
  ) {}

  async inspectTarget() {
    return this.target;
  }

  async rollback(providerVersionId: string) {
    this.rollbackCalls.push(providerVersionId);
    return {
      deploymentId: "deployment-after-rollback",
      activeProviderVersionId: providerVersionId
    };
  }
}

const rollbackRequest: Vs005RollbackRequest = {
  providerVersionId: previousDeployment.providerVersionId,
  expectedRelease: previousDeployment.release,
  expectedConfigFingerprint: previousDeployment.configFingerprint,
  expectedEnvironment: previousDeployment.environment,
  expectedProvider: previousDeployment.provider,
  expectedProviderTarget: previousDeployment.providerTarget,
  expectedPublicUrl: previousDeployment.publicUrl,
  databaseAction: "NONE"
};

test("rollback request validation refuses database rollback intent", () => {
  assert.throws(
    () => validateVs005RollbackRequest({
      ...rollbackRequest,
      databaseAction: "ROLLBACK"
    }),
    /DATABASE ROLLBACK IS NOT A VS005 OPERATION/
  );
});

test("rollback targets one explicit prior application version then verifies reconstructed evidence", async () => {
  const provider = new FakeRollbackProvider();
  const verifyCalls: Vs005DeploymentResult[] = [];

  const verification = await rollbackVs005Application({
    request: rollbackRequest,
    currentDeploymentEvidence,
    targetDeploymentEvidence: previousDeployment,
    currentConfig: validConfig,
    provider,
    clock: () => new Date("2026-09-04T12:00:00.000Z"),
    verify: async (deployment, config) => {
      verifyCalls.push(deployment);
      assert.equal(config, validConfig);
      return passingVerification({
        deploymentId: deployment.deploymentId,
        release: deployment.release
      });
    }
  });

  assert.deepEqual(provider.rollbackCalls, [previousDeployment.providerVersionId]);
  assert.equal(verifyCalls[0]?.deploymentId, "deployment-after-rollback");
  assert.equal(verifyCalls[0]?.providerVersionId, previousDeployment.providerVersionId);
  assert.deepEqual(verifyCalls[0]?.release, previousDeployment.release);
  assert.equal(verifyCalls[0]?.configFingerprint, previousDeployment.configFingerprint);
  assert.equal(verification.outcome, "PASS");
});

test("rollback refuses a target from another environment, public origin, provider account/Worker, or canonical config", async () => {
  for (const target of [
    { ...previousDeployment, environment: "qa" as const },
    { ...previousDeployment, publicUrl: "https://other.example.test" },
    { ...previousDeployment, providerTarget: { ...previousDeployment.providerTarget, accountId: "other-account" } },
    { ...previousDeployment, providerTarget: { ...previousDeployment.providerTarget, workerName: "other-worker" } },
    { ...previousDeployment, configFingerprint: "different-config" }
  ]) {
    const provider = new FakeRollbackProvider();
    await assert.rejects(
      () => rollbackVs005Application({
        request: {
          ...rollbackRequest,
          expectedEnvironment: target.environment,
          expectedProviderTarget: target.providerTarget,
          expectedPublicUrl: target.publicUrl,
          expectedConfigFingerprint: target.configFingerprint
        },
        currentDeploymentEvidence,
        targetDeploymentEvidence: target,
        currentConfig: validConfig,
        provider,
        verify: async () => passingVerification({
          deploymentId: "unused",
          release: previousDeployment.release
        })
      }),
      /ROLLBACK (TARGET|CONFIGURATION) MISMATCH/
    );
    assert.deepEqual(provider.rollbackCalls, []);
  }
});

test("rollback refuses a changed live Cloudflare account or Worker before mutation", async () => {
  const provider = new FakeRollbackProvider({
    accountId: "wrong-account",
    workerName: currentDeploymentEvidence.providerTarget.workerName
  });

  await assert.rejects(
    () => rollbackVs005Application({
      request: rollbackRequest,
      currentDeploymentEvidence,
      targetDeploymentEvidence: previousDeployment,
      currentConfig: validConfig,
      provider,
      verify: async () => passingVerification({
        deploymentId: "unused",
        release: previousDeployment.release
      })
    }),
    /ROLLBACK PROVIDER TARGET MISMATCH/
  );
  assert.deepEqual(provider.rollbackCalls, []);
});

test("rollback verification failure remains a failed rollback outcome", async () => {
  const provider = new FakeRollbackProvider();
  const verification = await rollbackVs005Application({
    request: rollbackRequest,
    currentDeploymentEvidence,
    targetDeploymentEvidence: previousDeployment,
    currentConfig: validConfig,
    provider,
    verify: async () => failingVerification("RELEASE_DRIFT")
  });

  assert.equal(verification.outcome, "FAIL");
});
```

Import `readFileSync` from `node:fs`, `resolve` from `node:path`, and the Task 3 config/fingerprint helpers used above. These fixtures share one canonical config fingerprint/environment/provider/public origin **and the same Cloudflare account ID/Worker name**. No fixture contains real credentials or makes provider calls.

- [ ] **Step 2: Run RED**

```powershell
cd apps/api
node --import tsx --test scripts/vs005-rollback.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement the minimal application rollback command and package wiring**

The command must print/persist:

```text
Application rollback target: version-previous
Database action: NONE
Database reset: NO
Migration reversal: NO
Post-rollback verification: REQUIRED
```

Add exact package commands:

```json
// apps/api/package.json
"vs005:rollback": "node --import tsx scripts/vs005-rollback.ts"

// root package.json
"cadence:rollback": "npm --prefix apps/api run vs005:rollback --"
```

Implement `inspectTarget()` in `vs005-cloudflare-deployment-provider.ts` using a read-only Wrangler/account/Worker inspection and compare it with the reviewed current/target deployment evidence **before** any rollback command. Implement the Cloudflare rollback call using Wrangler's explicit application-version rollback command with an argv array, never shell concatenation. After provider rollback, construct a new in-memory `Vs005DeploymentResult` from the reviewed target deployment evidence plus the newly returned deployment ID/time, then automatically run the same `vs005-deploy-verify` logic against that expected prior release/configuration identity. Rollback failures use the Task 11 safe failure contract; because rollback itself is a remote mutation, a provider-invocation failure records `mutationOccurred=true` and a read-only post-failure health classification when available. Task 11 already records plan-time rollback availability; Task 13 must not create a second rollback-compatibility authority.

- [ ] **Step 4: Run focused + script typecheck**

```powershell
cd apps/api
node --import tsx --test scripts/vs005-rollback.test.ts scripts/vs005-cloudflare-deployment-provider.test.ts scripts/vs005-deploy-verify.test.ts
npx.cmd tsc --noEmit -p tsconfig.scripts.json
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
cd ..\..
git add apps/api/scripts/vs005-rollback.ts apps/api/scripts/vs005-rollback.test.ts apps/api/scripts/vs005-cloudflare-deployment-provider.ts apps/api/scripts/vs005-cloudflare-deployment-provider.test.ts apps/api/package.json package.json
git diff --cached --check
git commit -m "feat(vs005): add safe application rollback evidence"
```

**Checkpoint deliverable:** A bad app release can be rolled back to an explicit prior provider version without pretending to roll back database state.

---

### Task 14: Extend CI/Quality Gates and Write the Operator Runbook

**Files:**
- Create: `.node-version`
- Modify: `.github/workflows/quality.yml`
- Modify: `package.json`
- Create: `apps/api/scripts/vs005-package-wiring.test.ts`
- Create: `docs/runbooks/VS005_DEPLOYMENT.md`
- Modify: `README.md`

**Interfaces:**
- Produces one documented, repeatable operator path and CI evidence that config, web, API, and Cloudflare adapter remain buildable together.

- [ ] **Step 1: Add a RED package/quality wiring test**

Create `apps/api/scripts/vs005-package-wiring.test.ts` with explicit source assertions:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const repoRoot = resolve(process.cwd(), "../..");
const rootPackage = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));
const apiPackage = JSON.parse(readFileSync(resolve(repoRoot, "apps/api/package.json"), "utf8"));
const cloudflarePackage = JSON.parse(readFileSync(resolve(repoRoot, "apps/runtime-cloudflare/package.json"), "utf8"));
const workflow = readFileSync(resolve(repoRoot, ".github/workflows/quality.yml"), "utf8");
const nodeVersion = readFileSync(resolve(repoRoot, ".node-version"), "utf8").trim();

test("root exposes the governed VS005 operator commands", () => {
  for (const name of [
    "cadence:setup:check",
    "cadence:deploy:plan",
    "cadence:deploy:apply",
    "cadence:deploy:verify",
    "cadence:rollback"
  ]) {
    assert.equal(typeof rootPackage.scripts[name], "string", name);
  }
});

test("release toolchain declares the same Node major used by CI", () => {
  assert.equal(rootPackage.engines.node, ">=24 <25");
  assert.equal(nodeVersion, "24");
  assert.match(workflow, /node-version:\s*['"]?24['"]?/);
});

test("authoritative quality includes config, web tests, and non-mutating Cloudflare checks", () => {
  assert.equal(typeof apiPackage.scripts["vs005:generate:ci"], "string");
  assert.equal(typeof cloudflarePackage.scripts.test, "string");
  assert.equal(typeof cloudflarePackage.scripts.typecheck, "string");
  assert.equal(typeof cloudflarePackage.scripts["deploy:dry-run"], "string");

  const quality = rootPackage.scripts.quality;
  assert.match(quality, /api:scripts:typecheck/);
  assert.match(quality, /apps\/web test/);
  assert.match(quality, /vs005:generate:ci/);
  assert.match(quality, /apps\/runtime-cloudflare test/);
  assert.match(quality, /apps\/runtime-cloudflare run typecheck/);
  assert.match(quality, /deploy:dry-run/);

  assert.match(workflow, /working-directory:\s*apps\/runtime-cloudflare/);
  assert.match(workflow, /npm run quality/);
  assert.doesNotMatch(workflow, /wrangler\s+deploy(?![^\n]*--dry-run)/);
});
```

- [ ] **Step 2: Run RED**

```powershell
cd apps/api
node --import tsx --test scripts/vs005-package-wiring.test.ts
```

Expected: FAIL until quality workflow is updated.

- [ ] **Step 3: Extend root quality without deploying remotely**

Add a cross-platform root script:

```json
"api:scripts:typecheck": "npm --prefix apps/api exec -- tsc --noEmit -p tsconfig.scripts.json"
```

Set root `package.json` to `"engines": { "node": ">=24 <25" }` and create `.node-version` containing `24`, matching the existing GitHub Actions Node 24 runtime. Do not introduce a second toolchain major for the Cloudflare adapter.

Then extend the root `quality` script with this non-mutating sequence:

```text
npm --prefix apps/api run typecheck
npm --prefix apps/api test
npm run api:scripts:typecheck
npm --prefix apps/web test
npm --prefix apps/web run lint
npm --prefix apps/web run build:ci
npm --prefix apps/api run vs005:generate:ci
npm --prefix apps/runtime-cloudflare test
npm --prefix apps/runtime-cloudflare run typecheck
npm --prefix apps/runtime-cloudflare run deploy:dry-run
```

Update the Actions cache dependency list to include `apps/runtime-cloudflare/package-lock.json` and add an `npm ci` step with `working-directory: apps/runtime-cloudflare` before the existing authoritative `npm run quality` step. Do **not** duplicate the quality subcommands as separate workflow steps; the root script remains the single quality authority. CI must not contain a remote-mutating Wrangler invocation and must not require enterprise/developer deployment secrets for normal PR quality. The generated Wrangler file uses the deterministic CI config/release fixture and remains ignored.

- [ ] **Step 4: Write the quick operator runbook**

`docs/runbooks/VS005_DEPLOYMENT.md` must first state that the operator must prepare one reviewed real target configuration from `config/cadence.runtime.example.json` using approved non-secret environment facts; no script may guess a public URL, Supabase project ref, pilot project ID, or safety marker. Then document provider authentication and secret bootstrap **before** the deployment sequence:

```text
1. Authenticate Wrangler to the explicitly intended Cloudflare account and confirm the account identity with the read-only `npx.cmd wrangler whoami` command; record only the safe account identifier, never the credential.
2. Do not paste Cloudflare API tokens or Supabase keys into commands, config JSON, chat, or Git.
3. If the Worker already has `SUPABASE_SECRET_KEY`, leave it in the provider secret store; normal deploy preserves it.
4. If the first deployment needs the secret, make `SUPABASE_SECRET_KEY` available only in the current operator process/approved CI secret source. `cadence:deploy:apply` transports it with Wrangler's supported deploy-time secret upload and deletes its temporary transport file.
5. Clear the local process secret after deployment/verification.
```

For interactive PowerShell, show a no-command-history secret prompt:

```powershell
$secureSupabaseKey = Read-Host "Supabase secret key" -AsSecureString
$env:SUPABASE_SECRET_KEY = [System.Net.NetworkCredential]::new("", $secureSupabaseKey).Password
# run setup/plan/apply/verify
Remove-Item Env:SUPABASE_SECRET_KEY -ErrorAction SilentlyContinue
$secureSupabaseKey = $null
```

The plaintext exists only in the current process environment/memory and the short-lived deploy transport created by the tool; the runbook must tell the operator not to echo or persist it.

Then it must contain this exact sequence:

```powershell
npm run quality
npm run cadence:setup:check -- --config config/cadence.runtime.beta.json --out .cadence/vs005/setup-readiness.json
npm run cadence:deploy:plan -- --config config/cadence.runtime.beta.json --out .cadence/vs005/deployment-plan.json
# review .cadence/vs005/deployment-plan.json and console summary
npm run cadence:deploy:apply -- --plan .cadence/vs005/deployment-plan.json --config config/cadence.runtime.beta.json --out .cadence/vs005/deployment-result.json
npm run cadence:deploy:verify -- --deployment .cadence/vs005/deployment-result.json --config config/cadence.runtime.beta.json --out .cadence/vs005/deployment-verification.json
```

For an explicitly authorized application rollback, retain the prior deployment result and use:

```powershell
npm run cadence:rollback -- --current-deployment .cadence/vs005/deployment-result.json --target-deployment .cadence/vs005/previous-deployment-result.json --config config/cadence.runtime.beta.json --out .cadence/vs005/rollback-verification.json
```

The rollback command refuses a target whose configuration fingerprint does not match the current canonical configuration; it never performs database rollback/reset/migration reversal.

Document consequences explicitly:

```text
- No command above resets the database.
- VS005 deploy does not run database migrations.
- Secret values live in the provider/local secret store, not canonical JSON.
- A changed config/release invalidates an old plan.
- Deployment PASS does not authorise M1 Pilot Activation.
- Application rollback does not restore database data.
```

Also include the Cloudflare-first-but-portable architecture and the rule that enterprise reconstruction must not require developer personal credentials. Add an explicit M1 resource/abuse note: business/API routes retain their existing authentication/authorisation boundaries, JSON request bodies are hard-capped at 1 MiB, scheduled work and retries are hard-bounded, and each worker invocation emits one bounded structured summary rather than raw payload/error logs. Do not introduce a Cloudflare-specific stateful rate-limit store in VS005 for the 5-10 named-user controlled pilot; if anonymous/public business traffic or materially larger usage is introduced, that requires a separate rate/abuse-control design rather than silently relying on this pilot assumption.

- [ ] **Step 5: Run package wiring + full quality**

```powershell
cd apps/api
node --import tsx --test scripts/vs005-package-wiring.test.ts
cd ..\..
npm run quality
git diff --check
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add .node-version .github/workflows/quality.yml package.json apps/api/scripts/vs005-package-wiring.test.ts docs/runbooks/VS005_DEPLOYMENT.md README.md
git diff --cached --check
git commit -m "docs(vs005): add deployment operator and CI gates"
```

**Checkpoint deliverable:** A non-author can follow one safe deployment path, and PR quality proves the Cloudflare/runtime artifacts build without performing a remote deployment.

---

### Task 15: Hosted Beta Rehearsal, Missed-Schedule Evidence, Drift, and Clean-Room Proof

**Files:**
- Create: `docs/runbooks/VS005_CLEAN_ROOM_REHEARSAL.md`
- Create after target authorization: `config/cadence.runtime.beta.json` containing only reviewed non-secret Beta facts
- Create runtime evidence under ignored directory: `.cadence/vs005/`
- Modify: `docs/runbooks/VS005_CLEAN_ROOM_REHEARSAL.md` only after the rehearsal evidence passes.

If live evidence reveals a defect, STOP Task 15 and open a new focused RED/GREEN checkpoint against the owning file before resuming this rehearsal; do not patch production code inside the evidence task.

**Interfaces:**
- Consumes: all prior tasks plus a user-authorized hosted Cloudflare/Supabase Beta target.
- Produces: live evidence for VS005 closure. This task must not run until the user explicitly authorizes remote deployment/use of the target.

- [ ] **Step 1: Confirm target and authorization before any remote mutation**

Fresh local checks:

```powershell
git status -sb
git log -1 --oneline
npm run quality
```

Expected: clean feature branch, all checks PASS.

Do not infer deployment authorization from earlier discussion. Obtain explicit authorization for the specific hosted Beta target and enumerate the remote mutations requested: Cloudflare deployment/configuration and, for a fresh clean-room Supabase target only, application of the already-governed migration history. No database reset is permitted.

- [ ] **Step 2: Create a fresh canonical Beta config from non-secret target facts**

The config must contain the authorized public URL, exact Supabase URL/project ref, pilot project ID/safe marker, default worker policy, and secret reference names. Secret values stay outside Git and are supplied only from the authorized provider/CI/operator secret source. Because the approved VS005 design requires one source-controlled declarative non-secret configuration per environment, `config/cadence.runtime.beta.json` becomes the reviewed Beta source of truth once the target facts are authorized; it must contain no private credential value.

Run:

```powershell
npm run cadence:deploy:plan -- --config config/cadence.runtime.beta.json --out .cadence/vs005/deployment-plan.json
```

Expected: PASS, `database.migrationAction=NONE`, no destructive actions.

- [ ] **Step 3: Apply and verify the hosted Beta release**

```powershell
npm run cadence:deploy:apply -- --plan .cadence/vs005/deployment-plan.json --config config/cadence.runtime.beta.json --out .cadence/vs005/deployment-result.json
npm run cadence:deploy:verify -- --deployment .cadence/vs005/deployment-result.json --config config/cadence.runtime.beta.json --out .cadence/vs005/deployment-verification.json
```

Expected: verification PASS and `pilotActivation=NOT_AUTHORISED`.

- [ ] **Step 4: Prove normal scheduled worker behavior and retain deterministic fault evidence**

Create controlled event work through the normal governed Discussion path, then observe:

```text
Discussion event persists
-> scheduled worker invocation occurs without manual worker command
-> Audit and Team Agent work is attempted by the scheduled cycle
-> expected proposal/audit effects appear
-> structured worker-run evidence identifies run/release/env
```

Do **not** inject a production fault merely to manufacture live failure evidence. Re-run and record the Task 7 deterministic failure-isolation tests showing that membership-expiry/Audit failures do not suppress independent consumers. If a naturally occurring hosted failure happens during rehearsal, preserve its safe evidence, but do not create one with ad hoc SQL, credential sabotage, or test-only business behavior.

- [ ] **Step 5: Prove missed-schedule recovery and retain deterministic retry evidence**

Re-run and record the Task 8 retry-policy/processor tests proving `processingAttempts -> available_at` delayed retry behavior and safe persisted failure categories.

For hosted recovery, suspend/disable the scheduled trigger only through the provider's controlled deployment/config mechanism, create eligible work through the normal Discussion path, confirm it remains durably pending, restore the canonical trigger, and prove the persisted backlog resumes. Cloudflare Cron changes can take several minutes to propagate; allow up to 15 minutes and confirm provider-visible trigger state before interpreting a missed or resumed invocation. Do not mutate delivery rows manually to manufacture the result.

- [ ] **Step 6: Prove drift detection**

Change one non-destructive Cloudflare-managed setting through a controlled test deployment (use the Cron schedule), wait until Cloudflare's provider metadata reports the changed trigger state, then run verification and require `SCHEDULE_DRIFT`/config-drift FAIL. Re-apply the canonical configuration, wait until provider metadata again reports the canonical trigger state, and require PASS. Do not treat propagation delay as application drift.

Record both outcomes.

- [ ] **Step 7: Prove application rollback**

Deploy a harmless second application release/version, roll back to the previous explicit provider version, then verify:

```text
application release identity reverted
health/API/static web remain healthy
database action NONE
migration reversal NO
data reset NO
```

- [ ] **Step 8: Perform the clean-room reconstruction**

Against a fresh environment owned by the target operator/enterprise (or a fresh separately controlled rehearsal account if enterprise account is not yet available), establish Cadence from:

```text
governed repo/release
canonical non-secret config
existing migration history
new owner-supplied secrets
VS004 controlled pilot bootstrap
VS005 deploy tooling
```

For a truly fresh Supabase target, apply the **existing governed migration history as a separate database-initialisation action**, never from `cadence:deploy:*`:

```powershell
npm run db:beta:preflight -- --config config/cadence.runtime.beta.json
# review the dry-run output against the authorized fresh target
npm run db:beta:push -- --config config/cadence.runtime.beta.json
```

These commands use the Task 4 canonical-config target guard and require the fresh-target `SUPABASE_DB_PASSWORD`. This is not a VS005 schema change and is not a database reset. If the dry run shows an unexpected/destructive migration, STOP.

The operator must not use the developer's personal Cloudflare/Supabase credentials. For a first Worker deployment, obtain the new owner-supplied Supabase secret through the Task 14 secure prompt/approved CI secret source; the Task 12 provider transports it only via the temporary `--secrets-file` path and deletes that file in `finally`. Record only the secret-name readiness outcome, never the value.

Record exact evidence in `docs/runbooks/VS005_CLEAN_ROOM_REHEARSAL.md`:

```markdown
- source commit
- config schema version
- target ownership statement
- Supabase project ref (non-secret)
- Cloudflare account ID and deterministic Worker name (non-secret)
- Cloudflare deployment/version ID
- canonical config fingerprint
- deployment verification outcome
- scheduled worker evidence
- VS004 bootstrap evidence reference
- confirmation developer credentials were not required
- database reset: NO
- migration reversal: NO
- Pilot Activation: NOT AUTHORISED
```

- [ ] **Step 9: Commit only the safe rehearsal record**

Do not commit secret values, access tokens, raw credentials, or sensitive business data.

```powershell
git add config/cadence.runtime.beta.json docs/runbooks/VS005_CLEAN_ROOM_REHEARSAL.md
git diff --cached --check
git diff --cached -- config/cadence.runtime.beta.json docs/runbooks/VS005_CLEAN_ROOM_REHEARSAL.md
git commit -m "test(vs005): record hosted portability rehearsal"
```

**Checkpoint deliverable:** VS005 has hosted evidence for scheduling, missed-schedule/backlog recovery, drift detection, rollback, and clean-room portability without developer credentials, plus fresh deterministic evidence for independent failure handling and delayed retry semantics.

---

### Task 16: Final VS005 Regression, Governance Closure, and Handoff

**Files:**
- Modify: `docs/vertical-slices/VS-005.md`
- Modify: `docs/governance/CADENCE_REQUIREMENT_TRACEABILITY.md`
- Modify: `docs/governance/CADENCE_MILESTONE_ROADMAP.md`
- Modify: `HANDOFF.md`
- Modify: `CHANGELOG.md`
- Modify: `README.md` only for final operational accuracy

**Interfaces:**
- Consumes: all implementation and hosted evidence.
- Produces: a closure record. Does not start VS006/VS007 and does not authorise Pilot Activation.

- [ ] **Step 1: Run the exact fresh final verification suite**

From repo root:

```powershell
npm run quality
npm --prefix apps/api test
npm --prefix apps/web test
npm run api:scripts:typecheck
npm --prefix apps/api run vs005:generate:ci
npm --prefix apps/runtime-cloudflare test
npm --prefix apps/runtime-cloudflare run typecheck
npm --prefix apps/runtime-cloudflare run deploy:dry-run
git diff --check
```

Also run the focused VS005 tests explicitly so their evidence is visible rather than hidden in aggregate output:

```powershell
cd apps/api
node --import tsx --test `
  src/bootstrap/cadence-config.test.ts `
  src/bootstrap/cadence-release.test.ts `
  src/bootstrap/environment-safety.wiring.test.ts `
  src/runtime/create-cadence-app.test.ts `
  src/runtime/cadence-worker-cycle.test.ts `
  src/runtime/create-cadence-worker-services.test.ts `
  src/runtime/worker-retry-policy.test.ts `
  src/infrastructure/events/domain-event.processor.test.ts `
  src/infrastructure/database/project-membership-lifecycle.migration.test.ts `
  src/infrastructure/database/supabase-project-membership-lifecycle.repository.test.ts `
  src/modules/project-membership/project-membership-expiry.processor.test.ts `
  scripts/assert-runtime-config.test.ts `
  scripts/assert-supabase-target.test.ts `
  scripts/run-supabase-db-push.test.ts `
  scripts/vs005-generate-web-config.test.ts `
  scripts/vs005-generate-deployment.test.ts `
  scripts/vs005-deployment-artifacts.test.ts `
  scripts/vs005-deploy-plan.test.ts `
  scripts/vs005-deploy-apply.test.ts `
  scripts/vs005-deploy-verify.test.ts `
  scripts/vs005-cloudflare-deployment-provider.test.ts `
  scripts/vs005-rollback.test.ts `
  scripts/vs005-package-wiring.test.ts
```

Expected: all PASS, no skipped VS005 closure test, no database reset.

- [ ] **Step 2: Verify frozen authority boundaries**

Run:

```powershell
git grep -n "ProjectAuthorisationService" -- apps/api/src
git grep -n "createClient" -- apps/web/src
git grep -n "SUPABASE_SECRET_KEY\|secretKeySecretRef\|SERVICE_ROLE" -- apps/web/src
git grep -n "SUPABASE_SECRET_KEY=" -- apps/web apps/runtime-cloudflare config
git grep -n "D1\|Durable Object\|KV\|Queue" -- apps/runtime-cloudflare/src apps/api/src/runtime
```

Expected:
- normal API business authority still composes `ProjectAuthorisationService`;
- no new browser business-table authority;
- no server-secret reference/value appears in browser source, and no literal `SUPABASE_SECRET_KEY=<value>` assignment is embedded in web/provider/config artifacts (the **name** `SUPABASE_SECRET_KEY` may legitimately appear in server-side secret-reference declarations);
- no Cloudflare proprietary state introduced as canonical business state.

- [ ] **Step 3: Reconcile VS005 acceptance evidence line by line**

For each of the 19 acceptance items in the design spec, add a concrete evidence reference to `docs/vertical-slices/VS-005.md`. No `PASS` may rely only on intent or a Codex report.

Mandatory final statements:

```text
VS005 P0 = 0
VS005 P1 = 0
Database reset performed = NO
New VS005 database migration = NO (unless a separately approved design review changed this)
Node runtime preserved = YES
Cloudflare runtime verified = YES
Clean-room reconstruction independent of developer credentials = YES
VS006 complete = NO
VS007 complete = NO
M1 Pilot Activation authorised = NO
```

- [ ] **Step 4: Update traceability/status without overclaiming**

F17.1 may be closed at its M1 obligation only if hosted deployment/rehearsal evidence proves reproducible frontend/API/worker deployment. F18.3 may receive bounded M1 evidence for supervised retry/recovery, but do not close its full M3 production monitoring/alerting obligation. F18.1/F18.2 remain VS006/production resilience work as governed.

Do not alter 44/178 counts.

- [ ] **Step 5: Run documentation consistency checks**

```powershell
git grep -n "VS005\|VS-005\|VS006\|VS007\|Pilot Activation" -- docs HANDOFF.md CHANGELOG.md
git grep -n "44" -- docs/governance/CADENCE_PROJECT_SCOPE_BASELINE.md docs/governance/CADENCE_REQUIREMENT_TRACEABILITY.md
git grep -n "178" -- docs/governance/CADENCE_REQUIREMENT_TRACEABILITY.md
git diff --check
```

Expected: consistent boundaries/counts; no claim that VS005 alone activates M1.

- [ ] **Step 6: Stage and inspect closure diff**

```powershell
git add docs/vertical-slices/VS-005.md docs/governance/CADENCE_REQUIREMENT_TRACEABILITY.md docs/governance/CADENCE_MILESTONE_ROADMAP.md HANDOFF.md CHANGELOG.md README.md
git diff --cached --check
git diff --cached --stat
git diff --cached
```

Expected: closure/evidence documentation only in this commit.

- [ ] **Step 7: Commit closure**

```powershell
git commit -m "chore(vs005): complete portable runtime closure"
```

- [ ] **Step 8: Final branch cleanliness check**

```powershell
git status -sb
git log --oneline --decorate -15
```

Expected: clean VS005 feature branch. Do not push, open a PR, merge, or delete branches unless the user explicitly authorizes that remote action.

**Checkpoint deliverable:** VS005 is either demonstrably CLOSED with fresh evidence and P0/P1=0, or remains OPEN with the exact failing gate documented. M1 Pilot Activation remains blocked pending VS006, VS007, and the full M1 rehearsal/activation decision.

---

## Execution Order and Stop Conditions

Execute Tasks 1 through 16 in order. A task may not be skipped because a later task appears to cover similar ground.

Stop immediately and return for review if any of these occurs:

```text
- Cloudflare cannot bundle/run the actual Cadence Express/Supabase stack without core rewrite.
- A database migration appears necessary for VS005.
- A fix would weaken ProjectAuthorisationService or browser/API boundaries.
- Membership-expiry overlap is not safe under current canonical persistence semantics.
- Provider-specific state would need to become canonical business state.
- Central configuration would require duplicate operator-owned values.
- A deployment command would need implicit DB reset/migration/ad hoc SQL.
- Hosted verification requires developer personal credentials in the clean-room target.
- A P0/P1 issue is discovered in frozen VS001-VS004 behavior.
```

## Final Acceptance Evidence Matrix

| # | VS005 design acceptance | Primary task/evidence |
|---:|---|---|
| 1 | Cloudflare compatibility proof for the actual Cadence stack | Task 2 |
| 2 | One canonical schema/config path with no duplicated operator-edited application settings | Tasks 3-6 |
| 3 | Static web + API + scheduled worker through the source-controlled Cloudflare adapter | Task 10; hosted proof Task 15 |
| 4 | Node API and one-shot worker still work | Tasks 5, 7, 10, 16 |
| 5 | Scheduled worker bounded draining with independent consumer/job attempts | Task 7; hosted proof Task 15 |
| 6 | Retry backoff against persistent delivery state | Task 8; hosted evidence Task 15 |
| 7 | Missed-schedule recovery/backlog behavior | Task 15 |
| 8 | Membership-expiry overlap/concurrency explicitly tested | Task 9 |
| 9 | Safe structured worker evidence | Tasks 7, 8, 10; hosted proof Task 15 |
| 10 | Deployment plan/apply/verify exercised against a hosted target | Tasks 11-12; hosted proof Task 15 |
| 11 | Release/commit/config identity visible in safe runtime/deployment evidence | Tasks 3, 5, 10, 12, 15 |
| 12 | Application rollback demonstrated without DB reset or migration reversal | Tasks 13 and 15 |
| 13 | Configuration/target mismatch fails closed | Tasks 3, 4, 11, 12 |
| 14 | Material configuration drift is detectable | Task 12; hosted drift proof Task 15 |
| 15 | Resource-boundary tests cover worker limits plus request/log safety | Tasks 5, 7, 8, 16 |
| 16 | Clean-room/fresh-environment deployment without developer personal hosting/database credentials | Task 15 |
| 17 | Existing API/application regression suite remains green | Every checkpoint as applicable; final Task 16 |
| 18 | Existing VS001-VS004 frozen invariants remain protected | Tasks 1, 5, 7, 9, 16 |
| 19 | No new P0/P1 pilot-readiness issue remains within frozen VS005 scope | Task 16 closure gate |

The plan intentionally does not contain implementation tasks for VS006 backup/restore/support, VS007 AI, SSO, evaluation limits, admin bootstrap, document export, or the complete future upgrade product lifecycle.

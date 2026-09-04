# VS005 - Portable Deployment and Supervised Runtime Design

Status: design specification only. This document does not deploy Cadence, alter
the database, reset any environment, change the governed requirement counts, or
authorise M1 Pilot Activation.

Date: 2026-09-04

## 1. Purpose

VS005 makes Cadence reproducibly deployable, portable, observable, and
operational as a controlled hosted runtime for M1 engineering and later pilot
activation.

The design has two equally important goals:

1. provide a low-cost hosted M1 runtime using Cloudflare Workers; and
2. preserve a clean provider boundary so that moving Cadence to another hosting
   platform is an infrastructure exercise rather than an application rewrite.

VS005 therefore treats Cloudflare as the selected M1 hosting platform, not as a
Cadence business-architecture dependency.

The design preserves all existing frozen governance and application authority
boundaries. In particular:

- `ProjectAuthorisationService` remains the normal application project-authority
  boundary;
- browser business data remains behind `/api/v1`;
- canonical `Person` identity, Project Membership, role assignments, protected
  roles, and the protected transfer ledger remain unchanged;
- legacy membership fields remain frozen and non-authoritative;
- no direct ad hoc SQL becomes normal operation;
- no database reset is introduced;
- no governed commitment is silently moved beyond M3;
- VS005 deployment success does not constitute M1 Pilot Activation approval.

## 2. Scope boundary

### 2.1 VS005 implements

VS005 shall implement or prove the following:

- Cloudflare Workers as the M1 deployment platform;
- Workers Static Assets for the Vite web application;
- a Cloudflare HTTP entry adapter for the existing Cadence API/application
  composition;
- a Cloudflare scheduled entry adapter for Cadence background processing;
- continued Node execution for the API and one-shot worker as the portability
  baseline;
- one canonical, provider-neutral runtime configuration source per environment;
- configuration schema validation and configuration versioning;
- explicit separation of public, server-only, and secret configuration;
- provider secret references without secret values in source control;
- deployment setup/readiness checks;
- deployment plan, apply, and automatic post-deployment verification;
- bounded scheduled worker draining;
- independent worker job/consumer attempts within a cycle;
- retry backoff using existing persistent event-delivery state;
- structured worker, deployment, health, and release evidence;
- application release identity including version, commit, configuration schema,
  environment, and deployment identity;
- safe application rollback rules that do not imply database rollback;
- configuration-drift detection for Cadence-managed deployment settings;
- clean-room deployment evidence showing that a fresh environment can be built
  without access to the developer's personal hosting/database accounts;
- resource/cost safety boundaries for worker execution, retry, request handling,
  and logging.

### 2.2 VS005 does not implement

The following are explicit non-scope for VS005:

- backup technology, restore proof, recovery rehearsal, and support ownership,
  which remain VS006 responsibilities;
- the broader M1 Team Agent/AI assistance capability, which is intended for a
  later M1 slice before Pilot Activation;
- production enterprise SSO implementation;
- Evaluation, Standard, and Enterprise profile enforcement;
- the 30-project Evaluation limit;
- commercial licensing or signed entitlement enforcement;
- permanent initial-admin product bootstrap;
- full patch/upgrade product lifecycle and release-channel governance;
- document generation or governed business-data export;
- D1, Durable Objects, KV, or Cloudflare Queues as canonical Cadence business
  storage;
- production go-live, M3 institutional ownership closure, or production SLA;
- broad application feature work unrelated to deployment/runtime operation.

These deferred directions are recorded in this design only where VS005 must
avoid preventing them later.

## 3. Audited current state

The current repository already provides useful foundations:

- `apps/api/src/server.ts` is a conventional Node/Express API composition;
- `apps/api/src/worker.ts` validates runtime environment, creates the service
  Supabase client, processes membership expiry, then attempts Audit and Team
  Agent event delivery;
- `DomainEventProcessor.processNext()` claims one delivery, invokes one handler,
  completes on success, records failure on error, and rethrows the error;
- event-delivery persistence already supports per-consumer state, leases, claim
  tokens, `processing_attempts`, `available_at`, `failed` status, and a retry
  timestamp;
- event claiming uses row locking and `SKIP LOCKED` and can reclaim failed or
  expired leased deliveries;
- environment safety already distinguishes `local`, `qa`, and `beta` and binds
  hosted runtime to an expected Supabase project reference;
- API and web packages already contain beta-oriented scripts and build paths;
- web configuration already supports a hosted HTTPS API target;
- GitHub Actions currently runs the repository quality gate but does not deploy;
- there is currently no provider-specific hosting/scheduler manifest in the
  repository;
- VS004 explicitly leaves deployment hosting, stable runtime targets, and worker
  scheduling to VS005;
- VS006 remains the owner of backup, restore, support, and recovery rehearsal.

Three pilot-readiness weaknesses drive the worker design in this specification:

1. there is no complete deployment operating model;
2. one worker invocation is process-failure-coupled, so an earlier failure can
   prevent later independent work from being attempted; and
3. failed event deliveries can become immediately available again, creating a
   practical starvation risk for later work in the same consumer queue.

## 4. Deployment topology

The selected M1 topology is one Cloudflare Workers deployment unit containing
web static assets, HTTP entry, and scheduled entry:

```text
Cloudflare Workers deployment
|
+-- Vite static assets
|
+-- HTTP fetch adapter
|     -> Cadence API/application services
|
+-- scheduled adapter
      -> Cadence worker cycle

                 |
                 v
              Supabase
```

The hosted application should normally expose one public origin:

```text
https://<cadence-environment-host>/
    -> web application

https://<cadence-environment-host>/api/v1/*
    -> Cadence API

https://<cadence-environment-host>/health
    -> safe health endpoint
```

The scheduled worker is not a public HTTP endpoint.

A single origin is preferred for M1 because it reduces duplicate URL, CORS,
TLS, DNS, and browser configuration while preserving the API boundary.

## 5. Portability contract

Cadence shall run on Cloudflare without becoming dependent on Cloudflare for
its business semantics.

The runtime design has three conceptual layers:

```text
Cadence core/application
    domain rules
    application services
    authorisation
    repository/service interfaces
    worker jobs
        |
        v
Runtime adapters
    Node API adapter
    Node one-shot worker adapter
    Cloudflare HTTP adapter
    Cloudflare scheduled adapter
        |
        v
Infrastructure
    Supabase
    Cloudflare deployment
    future provider adapters
```

The following are hard portability rules:

- Cloudflare APIs must not appear in domain or application-service logic;
- canonical business state remains in the existing governed persistence model;
- runtime configuration must be provider-neutral at the Cadence boundary;
- the same worker-cycle application operation must be callable from Cloudflare
  scheduled execution and from the Node one-shot worker path;
- the same API/application services must remain callable from the Node/Express
  path after Cloudflare support is added;
- business behavior, authorisation, event semantics, and retry truth must not be
  delegated to proprietary Cloudflare state;
- changing hostname, account, or hosting provider must not require edits to
  Cadence domain/application code;
- provider-specific deployment metadata may exist only as a deployment adapter
  concern and must not duplicate operator-owned Cadence settings.

The portability acceptance test is practical: if Cloudflare were replaced, the
Cadence domain/application, Supabase schema/data contracts, authorisation model,
and event model should remain usable while only runtime/deployment adapters and
provider bindings change.

## 6. Canonical configuration design

### 6.1 Single operator source of truth

Every operator-modifiable non-secret Cadence setting shall have exactly one
editable source of truth per environment.

VS005 shall establish a provider-neutral canonical configuration model with a
shape conceptually similar to:

```yaml
configVersion: 1

application:
  name: cadence
  environment: beta
  publicUrl: https://cadence-beta.example.invalid

runtime:
  provider: cloudflare

supabase:
  url: https://example.supabase.co
  projectRef: example
  publishableKeySecretRef: SUPABASE_PUBLISHABLE_KEY
  secretKeySecretRef: SUPABASE_SECRET_KEY

pilot:
  projectId: 00000000-0000-0000-0000-000000000000
  safeTargetMarker: cadence-beta

worker:
  schedule: "* * * * *"
  maxRounds: 10
  maxDeliveryAttempts: 20
  softDeadlineSeconds: 20

retry:
  delaysSeconds:
    - 60
    - 300
    - 900
    - 3600
```

The exact file format chosen during implementation planning may be YAML, JSON,
or another source-controlled declarative format, but all environments must use
one schema and one configuration-loading boundary.

### 6.2 Configuration classes

Configuration is classified into three categories:

1. Public configuration - values safe to expose to the browser, such as the
   public application URL, environment label, Supabase public URL, and
   publishable browser key.
2. Server configuration - non-secret runtime settings that the browser must not
   own, such as worker limits, retry policy, project reference, and safety
   markers.
3. Secret configuration - credentials and sensitive keys that must never be
   committed or bundled into client assets.

The canonical configuration contains secret references, not secret values.
Secret values are supplied by the runtime secret store or local development
secret mechanism.

### 6.3 Configuration access rule

Application/domain modules shall not independently read environment variables
or provider bindings. Environment variables, Cloudflare bindings, and local
secret sources are consumed at the bootstrap/configuration boundary and
translated into validated `CadenceConfig` data.

Generated Vite/public configuration and generated provider deployment settings
must derive from the same canonical source rather than becoming independent
operator-edited copies.

### 6.4 Validation and drift

Configuration shall validate before build/deploy/startup. Validation must catch
at least:

- unsupported environment;
- missing required values;
- malformed URLs/identifiers;
- inconsistent Supabase URL/project reference;
- wrong environment/target combinations;
- missing required secret references;
- unsafe browser exposure of server/secret values;
- invalid worker bounds or retry policy;
- invalid deployment profile/provider value when those fields exist.

Post-deployment verification shall compare Cadence-managed runtime settings
against the expected canonical release/configuration and report material drift.
The provider dashboard is not a second source of truth.

## 7. Environment and ownership model

VS005 preserves `local`, `qa`, and `beta`; production remains a later governed
environment.

Environment purpose and account ownership are distinct concepts. During
engineering, the single developer may use personally controlled Cloudflare and
Supabase accounts for local/QA demonstration and development. A real enterprise
pilot target must be reproducible under enterprise-controlled infrastructure
before Pilot Activation.

The intended lifecycle is:

```text
Developer-owned engineering environment
    -> proven release/package
    -> fresh enterprise Cloudflare account
    -> fresh enterprise Supabase target
    -> enterprise domain/secrets/admin ownership
    -> controlled bootstrap
    -> VS005 verification
    -> VS006 resilience/support proof
    -> later M1 AI proof
    -> Pilot Activation gate
```

Account transfer from the developer is not a required deployment mechanism.
Clean environment reconstruction is the required portability mechanism.

A hosted environment must be distinguishable through multiple agreeing facts:

- declared Cadence environment;
- expected Supabase project reference;
- public application hostname;
- safe-target marker;
- selected deployment target/account metadata where available.

Cadence must fail closed on material mismatch.

## 8. Cloudflare compatibility proof

Before broad VS005 refactoring, implementation shall prove that the actual
Cadence stack can operate under the selected Cloudflare Workers runtime. The
proof must cover at minimum:

- static Vite asset serving;
- HTTP routing into the existing API/application composition;
- Supabase client operation from the Worker runtime;
- required Node compatibility APIs used by the application;
- scheduled entry invocation;
- canonical configuration loading/binding translation;
- safe logging and health response behavior.

The Node/Express API and Node one-shot worker paths must continue to work during
and after this proof.

If a required dependency is incompatible, implementation must stop and report
the incompatibility before introducing a Cloudflare-specific rewrite of core
application logic.

## 9. Scheduled worker architecture

### 9.1 Runtime-neutral worker cycle

Cloudflare Cron shall schedule Cadence; it shall not own Cadence execution
semantics.

VS005 shall establish a runtime-neutral operation conceptually equivalent to:

```text
runCadenceWorkerCycle(config, services, clock)
```

Both adapters invoke the same operation:

```text
Cloudflare scheduled() -> runCadenceWorkerCycle()
Node worker CLI         -> runCadenceWorkerCycle()
```

### 9.2 Schedule

The initial M1 hosted schedule is every minute:

```text
* * * * *
```

The schedule is configuration-owned, not embedded in business logic.

### 9.3 Bounded drain

The current one-item-per-consumer invocation is replaced by bounded round-robin
attempts. A cycle performs:

1. target/configuration validation;
2. one membership-expiry pass;
3. one Audit delivery attempt;
4. one Team Agent delivery attempt;
5. repeat event-consumer rounds while eligible work remains and bounds permit;
6. stop on queue exhaustion, maximum rounds, maximum delivery attempts, or soft
   runtime deadline;
7. emit one structured cycle result.

Initial M1 defaults are:

- `maxRounds = 10`;
- `maxDeliveryAttempts = 20` total event-delivery attempts per cycle;
- `softDeadlineSeconds = 20`.

These are centrally configured and may be tuned from pilot evidence without
changing worker architecture.

### 9.4 Independent failure handling

Membership expiry, Audit, and Team Agent work are independently attempted
within one supervised cycle. Failure in one must not automatically prevent the
other independent jobs from being attempted.

A worker-cycle result has three high-level outcomes:

- `SUCCESS` - all attempted jobs succeeded or no work was available;
- `DEGRADED` - useful work completed, but at least one independent job failed
  or reported a governed conflict requiring inspection;
- `FAILED` - the worker could not safely establish execution at all, for
  example because configuration, target, credentials, or core persistence was
  unavailable.

The process/runtime adapter may return a nonzero/error signal for degraded or
failed operation as required by the hosting platform, but it must preserve the
structured Cadence cycle result first where possible.

### 9.5 Retry policy

Cadence, not the hosting scheduler, owns delivery retry semantics. Existing
persistent event-delivery state and `available_at` shall remain the retry truth.

The initial retry schedule is:

```text
attempt/failure 1 -> 60 seconds
attempt/failure 2 -> 300 seconds
attempt/failure 3 -> 900 seconds
attempt/failure 4+ -> 3600 seconds
```

Retry calculation shall use persisted processing-attempt state and shall avoid
immediate hot-loop retries.

VS005 does not add a dead-letter schema unless implementation evidence proves
that one is required for M1. Persistent-failure support procedure belongs with
VS006 operational support/recovery design.

### 9.6 Scheduler retry authority

Where the hosting platform supports automatic retry of scheduled invocation,
VS005 shall prevent duplicated retry authority where practical. The next normal
schedule plus Cadence persistent retry state should determine delivery retry.

### 9.7 Missed schedules and outages

A missed Cron invocation is not data loss. Event deliveries remain persisted.
When scheduled execution returns, the bounded worker resumes eligible backlog.
Membership expiry similarly evaluates overdue memberships against current time
and does not depend on exact-time invocation.

No separate Cloudflare queue is required for this M1 behavior.

### 9.8 Concurrency

The event-delivery subsystem already provides per-delivery concurrency safety
through database row locking, `SKIP LOCKED`, leases, claim tokens, and stale
claim protection. VS005 shall not introduce a Cloudflare-specific global lock
without demonstrated need.

VS005 must add or run explicit evidence for concurrent membership-expiry
finalisation. If the canonical lifecycle RPC is safely idempotent/conflict
controlled, no global lock is added. If not, the fix must address that
application/persistence boundary rather than making Cloudflare the authority.

## 10. Deployment command model

The operator experience shall be guided, fail closed, and reproducible.
Conceptually the lifecycle is:

```text
setup/check
    -> deployment plan
    -> operator review
    -> deployment apply
    -> runtime verification
    -> deployment evidence
```

Exact package script names are implementation-plan details, but the design
requires distinct plan and apply boundaries.

### 10.1 Setup/readiness

A first-environment readiness check shall validate at least:

- canonical configuration and schema;
- selected runtime provider support;
- provider credentials/access required for deployment;
- Supabase target and migration state;
- required secret presence by reference;
- hostname/DNS assumptions where inspectable;
- environment/target safety;
- worker schedule validity;
- repository/build readiness.

Setup/readiness must not silently create or mutate all missing resources. It
shall identify missing prerequisites and state clearly whether any mutation has
occurred.

### 10.2 Deployment plan

Deployment plan is read-only with respect to the deployed application target.
It shall report at minimum:

- intended environment;
- provider/runtime target;
- public application URL;
- Supabase target/project reference;
- application release/commit;
- configuration schema version;
- worker schedule/bounds;
- expected application/static/worker changes;
- database migration requirement, including `NONE` when no migration exists;
- secret presence status without revealing values;
- destructive-operation status;
- rollback compatibility known at plan time;
- overall readiness PASS/BLOCKED.

Normal VS005 deployment must never imply a database reset.

### 10.3 Deployment apply

Apply must revalidate target/configuration immediately before mutation and must
not blindly trust an old plan. It shall deploy source-controlled/generated
provider configuration and the tested application build.

Material provider settings required to run Cadence must be reproducible from
source plus canonical configuration and secret bindings. Manual dashboard-only
configuration is a bootstrap exception, not the normal release path.

### 10.4 Verification

Deployment success is not merely a provider API success response. Automatic
verification shall prove at least:

- web application is reachable;
- `/health` is reachable over HTTPS;
- API routing is reachable;
- deployed environment identity matches expected configuration;
- deployed release/commit identity matches the planned release;
- Supabase target identity is correct;
- browser public configuration contains no server secret;
- worker schedule is present/consistent;
- scheduled/worker runtime can execute a safe verification path;
- configured CORS/origin behavior is correct if any cross-origin path remains;
- Cadence-managed configuration has not materially drifted.

The final output must explicitly state that deployment PASS does not equal M1
Pilot Activation approval.

## 11. Health, observability, and safe evidence

VS005 shall provide minimum operational visibility sufficient to diagnose M1
runtime problems without source-code debugging.

### 11.1 Health

The public health surface shall remain credential-free and safe. It may expose
only operationally necessary information such as:

- service status;
- release/version identifier;
- commit/build identity where policy allows;
- environment label;
- configuration schema version;
- basic readiness state that does not expose credentials, project data, or
  internal topology details.

If liveness and readiness need separate semantics, the design should keep them
logically distinct even if M1 uses one public endpoint plus internal checks.

### 11.2 Worker cycle evidence

Every worker invocation shall emit one structured safe summary containing at
least:

- worker run/correlation ID;
- runtime kind (`cloudflare` or `node`);
- environment;
- release/commit identity;
- start/completion timestamps;
- overall outcome;
- membership-expiry finalised/conflict/failure counts;
- Audit processed/failure counts;
- Team Agent processed/failure counts;
- bound reached indicators;
- remaining-work/backlog signal when safely knowable;
- safe failure category/code where applicable.

Worker evidence must not contain passwords, secret keys, access tokens,
message bodies, unnecessary PII, or unrestricted raw exception objects.

### 11.3 Deployment evidence

Each deployment shall produce or retain enough evidence to identify:

- deployed version/commit;
- environment/provider target;
- configuration schema version;
- deployment timestamp/ID;
- verification outcome;
- database migration action or explicit no-migration result;
- rollback compatibility declared for that release when known.

### 11.4 Failure diagnostics

Operator-facing failures shall be actionable. They should identify:

- what failed;
- whether any mutation/deployment occurred;
- whether existing service remains active;
- the safe expected/configured values involved in the mismatch;
- the canonical configuration location to correct;
- the next safe command/action.

## 12. Request, resource, and cost safety

Because cost is a design constraint, Cadence shall apply bounded resource usage
rather than relying only on provider billing limits.

VS005 shall define or preserve centrally configured safeguards for:

- worker round/attempt/time bounds;
- retry backoff;
- request/body size limits appropriate to current API behavior;
- safe rate/abuse protection at the application/provider boundary where
  practical;
- bounded log volume and structured summaries rather than repeated raw payloads;
- no unbounded recursive/background retry;
- no unbounded work loop in a single scheduled invocation.

Cloudflare may provide enforcement assistance, but material Cadence policy must
remain documented/configured so another provider can reproduce equivalent
behavior.

## 13. Reproducible build and release identity

VS005 shall establish a minimum reproducible-release foundation:

- dependency lockfiles remain authoritative;
- supported Node/toolchain versions are explicit enough for deterministic CI
  and operator execution;
- the same quality/build commands are used for release evidence;
- deployed runtime identifies the exact Git commit/release it came from;
- configuration schema version is embedded in release/runtime evidence;
- generated provider artifacts are derived from source-controlled inputs;
- the release does not depend on unrecorded files from the developer machine.

A heavyweight signing/attestation system is not required for M1, but the design
must leave room for later SBOM, signature, and enterprise supply-chain controls.

## 14. Rollback and correction

Application rollback and database rollback are different operations.

VS005 may use the hosting provider's application-version rollback capability
for a bad application deployment, but normal rollback must never:

- reset the database;
- automatically reverse historical migrations;
- run ad hoc corrective SQL;
- claim data rollback occurred when only application code changed.

Each future release that contains a migration must declare whether rolling the
application back to the prior version remains compatible with the migrated
schema. If compatibility is not safe, the recovery path is forward correction
or the governed restore/recovery process owned by VS006/later operations.

## 15. Clean-room enterprise packaging test

VS005 shall prove that a working Cadence release is not tied to the original
developer's personal infrastructure.

The acceptance exercise shall demonstrate that a fresh environment can be
established from:

- governed source/release;
- canonical configuration template/environment file;
- migration history;
- deployment tooling;
- required secret values supplied by the new environment owner;
- controlled project/account bootstrap where required by current M1 process.

The exercise must not require access to the developer's personal Cloudflare or
Supabase account credentials.

It is acceptable during VS005 engineering for the developer to demonstrate the
working product using personal accounts. It is not acceptable for enterprise
runtime reconstruction to depend on those accounts.

## 16. Patch and upgrade foundation

VS005 does not implement the full product upgrade lifecycle, but it shall avoid
creating a deployment path that must be replaced later.

The intended future model is:

```text
versioned Cadence release
    -> enterprise upgrade plan
    -> consequence review
    -> upgrade apply
    -> verification
```

Future release metadata is expected to identify application version, commit,
configuration schema compatibility, migration requirements, and rollback
compatibility.

Enterprise-owned configuration and secrets must survive software upgrades.
An upgrade must not require copying the developer's configuration over the
enterprise's configuration.

## 17. Future deployment-profile direction

Cadence is intended to support one codebase with deployment baselines and
composable assurance controls rather than separate product editions.

The intended future profiles are:

- `EVALUATION` - temporary evaluator-controlled deployment, eventually subject
  to a bounded project limit such as 30 canonical project identities;
- `STANDARD` - permanent smaller-organisation baseline with core security and
  operational invariants;
- `ENTERPRISE` - mandatory higher-assurance baseline with institutional
  ownership and enterprise controls.

Standard deployments may opt into selected enhanced controls such as enterprise
SSO, multiple administrators, monitoring ownership, enhanced recovery, or
formal release governance. Enterprise deployments may add controls but may not
disable mandatory Enterprise controls.

Profile and control enforcement are not VS005 implementation scope. The
configuration architecture must simply avoid preventing this future model.

## 18. Future identity-provider direction

Cadence authentication remains provider-neutral. Canonical `Person` remains the
authorisation identity and authentication identities remain replaceable
mappings.

The intended first-class enterprise identity-provider direction is:

- Microsoft Entra ID;
- Google Workspace;
- Okta.

Longer-term extensibility should prefer standards-based integration, principally
OIDC and SAML where required.

Provider availability for login does not automatically satisfy a future
Enterprise SSO control. Enterprise readiness will depend on whether the
identity source is organisation-controlled and meets the configured assurance
policy.

No Entra, Google, or Okta implementation is added by VS005.

## 19. Future M1 AI sequencing

The original Cadence baseline is AI-native and already requires a Team Agent
that can summarise, extract, recall, identify impediments, and suggest next
steps while preserving human authority and AI provenance.

VS005 does not implement this broader AI capability. The intended M1 sequence
is:

```text
VS005 - portable deployment/runtime
VS006 - backup/restore/support and recovery proof
VS007 - M1 Team Agent / AI assistance
M1 Pilot Activation
```

The future M1 AI slice should bring forward a useful subset of existing C17-C19
commitments before real pilot activation, including summarisation,
categorisation, recall, action extraction, potential blocker/decision signals,
next-step suggestions, provider abstraction, prompt/version management, token
and cost accounting, and context budgeting.

This sequencing does not add a new governed parent requirement and does not
change the authoritative 44-parent / 178-child counts.

## 20. Future document generation and data export

Document generation and governed business-data export remain a future slice.
They are distinct from VS006 backup/restore. Future design must cover
permission-aware export, provenance, audit evidence, redaction/minimisation,
template/version control, and provider-neutral generation where appropriate.

VS005 does not implement export or document generation.

## 21. Security and authority invariants

VS005 must regression-protect these invariants:

- normal project authority remains server-side;
- platform/runtime administrator status does not grant automatic project read
  authority;
- browser code does not receive server secrets;
- service-role credentials remain server/runtime only;
- Cloudflare account ownership does not become project authorization;
- scheduled worker execution does not bypass owning-module contracts;
- consequential AI-derived state continues to require the existing governed
  proposal/human-review model where applicable;
- deployment tooling does not become a path for ad hoc business-data mutation;
- configuration mismatch fails closed rather than silently switching targets;
- no deployment or runtime command performs an implicit database reset.

## 22. VS005 acceptance evidence

VS005 closure requires fresh evidence, not only design intent. The detailed
implementation plan may split this into multiple tasks, but final closure shall
include at least:

1. Cloudflare compatibility proof for the actual Cadence stack.
2. One canonical configuration path with schema validation and no duplicated
   operator-edited application settings across runtime files.
3. Static web + API + scheduled worker deployed through the selected
   source-controlled Cloudflare adapter.
4. Node API and one-shot worker execution still working.
5. Scheduled worker performing bounded draining with independent consumer/job
   attempts.
6. Retry backoff verified against persistent delivery state.
7. Missed-schedule recovery/backlog behavior verified.
8. Membership-expiry overlap/concurrency behavior explicitly tested.
9. Safe structured worker evidence verified.
10. Deployment plan/apply/verify path exercised against a hosted target.
11. Release/commit/configuration identity visible in safe runtime/deployment
    evidence.
12. Application rollback behavior demonstrated without database reset or
    migration reversal.
13. Configuration/target mismatch fails closed.
14. Material configuration drift is detectable.
15. Resource-boundary tests cover worker limits and relevant request/log safety.
16. Clean-room/fresh-environment deployment demonstrated without the
    developer's personal hosting/database credentials.
17. Existing API/application regression suite remains green.
18. Existing VS001-VS004 frozen invariants remain protected.
19. No new P0/P1 pilot-readiness issue remains within the VS005 frozen scope.

VS005 closure does not itself satisfy the M1 Pilot Activation Gate. Pilot
Activation still requires the additional VS006 resilience/support evidence,
the planned M1 AI slice, complete multi-user rehearsal, and all other governed
M1 activation prerequisites.

## 23. Design decisions frozen by this specification

The following decisions are intended to be frozen for VS005 implementation:

1. Cloudflare Workers is the M1 hosting platform.
2. Vite is served through Workers Static Assets, not a separate Pages product.
3. Web, API, and scheduled adapter belong to one versioned Cloudflare deployment
   unit for M1.
4. One public application origin is preferred for M1.
5. Cadence remains provider-portable and retains Node API/worker execution.
6. Supabase remains the canonical persistence/authentication platform for the
   current M1 architecture.
7. Cloudflare-specific state is not introduced as canonical business state.
8. All operator-modifiable non-secret settings have one canonical source of
   truth; secrets are references to an external secret store.
9. Application modules do not independently read environment variables or
   provider bindings.
10. Scheduled work uses a runtime-neutral worker-cycle operation.
11. M1 scheduled execution runs every minute by default.
12. Worker execution is bounded and round-robin across independent consumers.
13. Failure of one independent worker job does not suppress attempts of the
    others in the same cycle.
14. Delivery retry is Cadence-owned, persisted, and delayed with backoff.
15. Provider scheduler retry must not become a competing delivery-retry
    authority.
16. Deployment uses explicit plan -> apply -> verify semantics.
17. Deployment PASS is not Pilot Activation approval.
18. Application rollback does not imply database rollback.
19. Enterprise deployment is reconstructed in enterprise-owned infrastructure;
    account transfer from the developer is not required.
20. Future profile, SSO, AI, upgrade, document-export, and licensing directions
    must remain possible but are not silently pulled into VS005 implementation.

## 24. Implementation transition

After this design is approved, the next step is a detailed implementation plan
under `docs/superpowers/plans/`.

Implementation shall use strict TDD where behavior changes. Each implementation
task must identify the RED test/evidence first, the minimum GREEN change, and
fresh verification before commit. Unexpected production callers, new database
migration requirements, or a need to weaken any frozen authority/safety rule
must stop the task and return to design/governance review.

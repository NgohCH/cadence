# Cadence Requirement Traceability Register

Register version: 1.0
Scope authority: `CADENCE_PROJECT_SCOPE_BASELINE.md`
Purpose: canonical status, implementation, evidence, and closure ledger

This register answers where a baseline requirement currently stands. It does
not redefine, narrow, or remove the commitment in the Scope Baseline.

## Register conventions

Source codes:

- `PTS` — `Cadence Product and Technical Spec v0.1.docx`
- `DSS` — `Cadence v0.1 Database Schema Specification.docx`
- `MIC` — `Cadence v0.1 Module Interface Contracts.docx`
- `API` — `Cadence v0.1 API Contract.docx` and OpenAPI
- `BASE` — initial README, migrations, and Git baseline
- `VS001` / `VS002` — frozen vertical-slice contracts and closure evidence

Prospective workstream codes are roadmap mappings, not approved implementation
contracts:

- `M1-01` — Controlled Pilot Enablement
- `M2-01` — Self-Service Project Foundation
- `M2-02` — Durable Collaboration
- `M2-03` — Useful Task Lifecycle
- `M3-01` — Complete Project State and Structured Knowledge
- `M3-02` — Files and Discussion Completion
- `M3-03` — Agent, Notifications, Audit, Search, Export, and Reporting
- `M3-04` — Production Identity and Operations
- `M3-05` — Governance, Release, and Handoff Completion

An empty closure-evidence outcome is never implied. `Required` means evidence
must be added before closure.

## Parent-level reconciliation

| Parent category/status | Count |
|---|---:|
| Product DELIVERED | 3 |
| Product INCORPORATED | 0 |
| Product PARTIAL | 13 |
| Product OUTSTANDING | 9 |
| Product parents | 25 |
| Foundation FOUNDATIONAL — ACTIVE | 16 |
| Foundation AT RISK | 2 |
| Foundation PARTIAL | 1 |
| Foundation parents | 19 |
| `INITIATION` product parents | 24 |
| `INITIATION` foundation parents | 19 |
| Initiation parent commitments | 43 |
| `APPROVED_ADDITION` parent commitments | 1 |
| Authoritative parent commitments | 44 |

Child requirements are excluded from these parent counts.

The Scope Baseline is authoritative for origin and committed outcome. This
register is the canonical status and implementation ledger only: it records
where each requirement stands and what evidence closes it, but cannot redefine
or reduce the baseline. C01-C24 and F01-F19 are `INITIATION`; C25 is the sole
`APPROVED_ADDITION`, sourced from frozen VS-002 sections 15-28 and AC-04-06.

## VS003 sequencing reconciliation

The VS003 documentation freeze recorded an approved milestone sequencing
change within M0–M3. This closure reconciliation records implementation
evidence and does not change the Scope Baseline.

| Requirement | Previous milestone | Current milestone | Current status treatment | Reason and closure path |
|---|---|---|---|---|
| C08.1 | M2 | M1 | `DELIVERED` by VS003 closure evidence. | Durable project rooms/messages are required before Pilot Activation; authenticated persisted read and post/return evidence pass. |
| C08.2 | M1 | M1 | `DELIVERED` by VS003 closure evidence. | Persisted Discussion is reconstructed by a fresh GET after reload and after leaving/returning. |
| INIT-AC-03 | M2 | M1 | `DELIVERED` by VS003 closure evidence. | The exact criterion is “Hold project discussions.”; authenticated posting, shared persisted visibility, reload, return, and role-protected use are evidenced. |
| C08.3 | M2 | M2 | `PARTIAL` advancement only. | Deterministic manual refresh/shared visibility and fresh GET convergence are evidenced; realtime/automatic convergence remains due M2. |
| C08.4 | M0 | M0 | Remains `DELIVERED` and regression protected. | Existing asynchronous Discussion event behavior remains under VS001 closure evidence. |

This is a sequencing reconciliation, not a deferral: moving C08.1 and
INIT-AC-03 earlier does not weaken their intended outcomes. The implementation
closure evidence includes the actual API, browser, authorization, isolation,
and two-user runtime evidence recorded below and in the VS003 contract. Original
commitments moved beyond M3: **0**.

## Product parent register

| Requirement ID | Parent ID | Original commitment | Source | Intended outcome | Type | Current status | Milestone due | Vertical slice(s) | Implementation evidence | Test/evidence | Remaining gap | Closure evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| C01 | — | Create a governed project. | PTS §§4,46–47; API | Usable project, initial state and accountable access. | Product parent | OUTSTANDING | M2 | M2-01 | Project table/repository only. | No create route/UI evidence. | Authorised create/bootstrap contract. | M2 acceptance and runtime proof required. |
| C02 | — | Project lifecycle and archive. | PTS §§6,23,47 | Manage five states and preserve history. | Product parent | PARTIAL | M3 | VS002 partial; M3-01 | Lifecycle values/read-only classifications. | VS002 lifecycle tests. | User lifecycle/archive workflow. | All C02 children proven. |
| C03 | — | Project Workspace / Project State. | PTS §§1,4–5,46 | Immediate condition, responsibility, urgency and state. | Product parent | PARTIAL | M2 | VS001 partial; M2-01 | Workspace summary UI/API. | VS001 workspace evidence. | Coherent navigation and complete core state. | M2 workspace acceptance. |
| C04 | — | Health, status and milestone condition. | PTS §§5–8,15,23 | Accessible execution condition and change history. | Product parent | PARTIAL | M3 | VS001 partial; M3-01 | Health/alerts/next milestone read model. | VS001 project tests. | Management and complete history UX. | M3 project-state acceptance. |
| C05 | — | Multi-project support. | PTS §§20–22; VS002 AC-02 | Multiple memberships, roles and usable navigation. | Product parent | PARTIAL | M2 | VS002 partial; M2-01 | Backend multi-project membership model. | VS002 AC-02 evidence. | Project discovery/switching UI. | Multi-project browser acceptance. |
| C06 | — | User/Person/authentication/Entra identity. | PTS §§20,22,30–31,45; VS002 | Stable identity and replaceable production login. | Product parent | PARTIAL | M3 | VS001; VS002; M2-01; M3-04 | Supabase Auth, stable Person, auth identity. | VS001 auth and VS002 identity tests. | Self-service onboarding and Entra lifecycle. | Production identity acceptance. |
| C07 | — | Membership, roles, permissions and protected responsibility. | PTS §§20–21,45,47; VS002 | Project access and authority are explicit and auditable. | Product parent | DELIVERED | M0 | VS002 | Canonical ProjectAuthorisationService and Members flows. | Frozen VS002 closure, P0/P1=0. | Preserve regression. | VS002 closure plus ongoing regression. |
| C08 | — | Native durable project Discussion. | PTS §§1,9,46–47 | Conversation remains shared project context. | Product parent | PARTIAL | M2 | VS001 partial; VS003; M2-02 | Authorised message creation, persisted read, and deterministic refresh. | VS001 Discussion evidence; VS003 API/browser/runtime evidence. | Realtime/automatic convergence and broader Discussion remain due. | Durable-return acceptance plus M2 C08.3 closure. |
| C09 | — | Discussion collaboration features. | PTS §9 | Threads, mentions, attachments, reactions, read state, search, AI hooks. | Product parent | OUTSTANDING | M3 | M2-02; M3-02 | Message support tables; AI event hook partial. | Schema evidence only for most items. | Product/API/UI capability. | All C09 children proven. |
| C10 | — | Message edit/version history. | PTS §10; §47 | Editing never destroys history. | Product parent | PARTIAL | M3 | VS001 foundation; M3-02 | MessageVersion and immutable retrieval. | VS001 immutable-version evidence. | Edit command, read history, UI. | Edit/history acceptance. |
| C11 | — | Basic project files. | PTS §16; §47 | Upload/view/download/link/audit files. | Product parent | OUTSTANDING | M3 | M3-02 | File/file-link schema only. | Initial migration/RLS evidence. | Owning module, API, storage and UI. | File journey acceptance. |
| C12 | — | Topics. | PTS §§11,23,47 | Track open reasoning to decision/deferment. | Product parent | OUTSTANDING | M3 | M3-01 | Topic schema only. | Initial migration evidence. | Module/API/UI/history. | Topic lifecycle acceptance. |
| C13 | — | Decisions. | PTS §§12,23,47 | Decisions preserve approval, rationale and source. | Product parent | OUTSTANDING | M3 | M3-01 | Decision/source-link schema only. | Initial migration/RLS evidence. | Module/API/UI/revision workflow. | Decision traceability acceptance. |
| C14 | — | Create and manage Tasks. | PTS §§8,13,23,47 | Owned, linked Tasks move through full lifecycle. | Product parent | PARTIAL | M3 | VS001 partial; M2-03 | Authoritative creation and My Tasks read. | VS001 Task tests/audit journey. | Update/complete/cancel/assign/link UX. | Full Task lifecycle acceptance. |
| C15 | — | Blockers. | PTS §§5,14,23,47 | Impediments are owned, linked and resolved. | Product parent | OUTSTANDING | M3 | M3-01 | Blocker schema/read count only. | Initial migration evidence. | Module/API/UI/lifecycle. | Blocker journey acceptance. |
| C16 | — | Milestones. | PTS §§6,15,23,47 | Delivery checkpoints and slippage are managed. | Product parent | PARTIAL | M3 | VS001 partial; M3-01 | Earliest incomplete milestone read. | VS001 project tests. | Create/update/complete/link/slippage UX. | Milestone lifecycle acceptance. |
| C17 | — | Shared Team Agent abilities. | PTS §§17,24,43,46–47 | Summarise, extract, recall, identify, suggest. | Product parent | PARTIAL | M3 | VS001 partial; M3-03 | Deterministic Task proposal extraction. | VS001 Team Agent tests. | Other abilities and production provider abstraction. | Five-ability acceptance. |
| C18 | — | AI proposals and human authority. | PTS §§18–19,45–47 | Consequential AI change is validated and human-controlled. | Product parent | DELIVERED | M0 | VS001 | Confirm/edit/reject and Tasks-owned materialisation. | Frozen VS001 closure. | Extend pattern to future AI actions. | Existing closure plus per-action regression. |
| C19 | — | AI provenance. | PTS §§26,32–34,45 | Reconstruct input, prompt, output, decision and result. | Product parent | DELIVERED | M0 | VS001 | AI runs/proposals/source links/audit journey. | Frozen VS001 closure. | Apply to every future AI action. | Existing closure plus per-action lineage. |
| C20 | — | Alerts and notifications. | PTS §§7,24,27,47 | Sparse meaningful project/personal alerts reach users. | Product parent | PARTIAL | M3 | VS001 partial; M3-03 | Workspace alert read model; notification schema. | VS001 project tests. | Rules, delivery and user experience. | Alert/notification acceptance. |
| C21 | — | Activity and Audit. | PTS §§4–5,10,32–35,47 | Human/AI operational history is visible and reconstructable. | Product parent | PARTIAL | M3 | VS001 partial; VS002 partial; M3-03 | Task journey and membership audit. | Frozen VS closures. | General Activity/query coverage. | Full activity/audit acceptance. |
| C22 | — | Project search. | PTS §§9,47 | Permission-aware retrieval of project knowledge. | Product parent | OUTSTANDING | M3 | M3-03 | No product search. | None. | Search contracts/indexing/UI. | Search acceptance. |
| C23 | — | Essential project export. | PTS §§21,47 | Authorised export with traceability. | Product parent | OUTSTANDING | M3 | M3-03 | Permission seed only. | Schema/seed evidence. | Export service/format/UI/audit. | Export acceptance. |
| C24 | — | Essential Project State dashboard/reporting. | PTS §§3,5,24 | Role-sensitive project reporting, excluding enterprise analytics. | Product parent | OUTSTANDING | M3 | M3-03 | Workspace summary is not complete reporting. | Partial visual/read evidence. | Define and deliver essential report outcome. | M3 reporting acceptance. |
| C25 | — | Internal/external participation. | `APPROVED_ADDITION` — VS002 §§15–28, AC-04–06 | External participation/provider independence with internal accountability. | Product parent | PARTIAL | M3 | VS002 partial; M2-01; M3-04 | External affiliation and external PM authorization. | Frozen VS002 closure. | Production external onboarding. | External onboarding acceptance. |

## Foundational parent register

| Requirement ID | Parent ID | Original commitment | Source | Intended outcome | Type | Current status | Milestone due | Vertical slice(s) | Implementation evidence | Test/evidence | Remaining gap | Closure evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F01 | — | Modular monolith. | PTS §§24,40,48–49 | Simple deployable with strong module boundaries. | Foundation parent | FOUNDATIONAL — ACTIVE | M0 | VS001; VS002 | API modules and contracts. | Closure/regression evidence. | Preserve. | Architectural audit each slice. |
| F02 | — | Explicit versioned interfaces/events. | PTS §§25,28,48 | Compatible published contracts. | Foundation parent | FOUNDATIONAL — ACTIVE | M0 | VS001; VS002; VS003 | Published Discussion read service/repository/API contract and existing versioned events. | 404/404 API suite, API typecheck, browser/runtime evidence. | Preserve and add versions when incompatible. | Slice contract evidence. |
| F03 | — | Module ownership/no cross-persistence. | PTS §§25–26,48 | Owners alone mutate authoritative state. | Foundation parent | FOUNDATIONAL — ACTIVE | M0 | VS001; VS002; VS003 | Discussion repository/service boundary; browser uses `/api/v1` for business data. | Boundary tests and Stage 7B network inspection. | Preserve. | Boundary scan/tests. |
| F04 | — | Database source of truth/migrations. | PTS §§26,29,36,49; BASE | Reproducible authoritative persistence. | Foundation parent | FOUNDATIONAL — ACTIVE | M0 | VS001; VS002; VS003 (regression) | Ordered migrations remain authoritative; VS003 reads persisted state and introduced no migration. | Stage 7A database read-only cross-check; no VS003 schema change. | Preserve. | Migration gate. |
| F05 | — | Project-scoped RBAC. | PTS §§20–21,45,49 | Membership and permissions control projects. | Foundation parent | FOUNDATIONAL — ACTIVE | M0 | VS001; VS002; VS003 | `ProjectAuthorisationService` gates Discussion reads and existing writes. | 404/404 API suite; Stage 7A role matrix; Stage 7B Observer/Auditor denial. | Preserve. | Permission regression. |
| F06 | — | Auth/authz separation. | PTS §§22,45,49 | Provider replacement leaves authority intact. | Foundation parent | FOUNDATIONAL — ACTIVE | M0 | VS001; VS002 | Stable Person/auth identity. | VS002 tests. | Entra proof by M3. | M3 identity evidence. |
| F07 | — | Least privilege/project isolation. | PTS §§20,30,45 | Safe defaults and no universal admin access. | Foundation parent | FOUNDATIONAL — ACTIVE | M0 | VS001; VS002; VS003 | Canonical read/write decisions preserve project concealment and role-scoped access. | Stage 7A P1/P2 isolation and role matrix; Stage 7B shared visibility without leakage. | Production review. | M3 security assessment. |
| F08 | — | Backend authority. | PTS §§21,25–26,45; BASE | UI cannot grant or bypass authority. | Foundation parent | FOUNDATIONAL — ACTIVE | M0 | VS001; VS002; VS003 | GET/POST remain behind API, service, and permission boundaries; no browser business-table path. | 404/404 API suite; Stage 7A 401/403/404; Stage 7B network inspection. | Preserve. | Boundary regression. |
| F09 | — | Immutable significant history. | PTS §§10,32,45,49 | Historical truth survives change/removal. | Foundation parent | FOUNDATIONAL — ACTIVE | M0 | VS001; VS002; VS003 (regression) | VS003 returns current committed message versions without changing immutable history. | Current-version repository/API tests; Stage 7A repeated-read and database cross-check. | Extend to new modules. | Per-module history tests. |
| F10 | — | Events/transactional outbox. | PTS §§27–28; BASE | Decoupled retryable reactions. | Foundation parent | FOUNDATIONAL — ACTIVE | M0 | VS001; VS002; VS003 (regression) | Existing POST/event boundary remains unchanged; VS003 adds reads and no event producer. | API regression and Stage 7A unauthorized-mutation count of 0. | Production hosting under F18. | Event integrity gates. |
| F11 | — | AI cannot directly mutate core state. | PTS §§18–19,25,45,49 | Owning module and human authority preserved. | Foundation parent | FOUNDATIONAL — ACTIVE | M0 | VS001 | Team Agent→Tasks contract. | VS001 tests. | Apply to future actions. | Per-action contract proof. |
| F12 | — | Correlation/causation/provenance. | PTS §§32–35,45,48 | Complete truthful journey reconstruction. | Foundation parent | FOUNDATIONAL — ACTIVE | M0 | VS001; VS002; VS003 | Discussion read responses preserve request/correlation metadata while message state remains module-owned. | API envelope/metadata checks; Stage 7A fresh-return read. | Extend to all modules. | Journey tests. |
| F13 | — | Secrets/environment/account safety. | PTS §§29–31,45; BASE | Correct targets and protected credentials/data. | Foundation parent | FOUNDATIONAL — ACTIVE | M0 | Platform hardening | Env guards and ignored secrets. | Environment tests/CI. | Institutional ownership by M3. | M3 environment/account audit. |
| F14 | — | Optional-module/feature isolation. | PTS §§27,37,47 | Experimental/optional failure is contained. | Foundation parent | FOUNDATIONAL — ACTIVE | M0 | VS001 partial; M3-04 | Independent consumers and core transaction separation. | Processor tests. | General feature flags/module disable proof. | INIT-AC-20 acceptance. |
| F15 | — | Testing and release gates. | PTS §38 | Critical defects block deployment. | Foundation parent | FOUNDATIONAL — ACTIVE | M0 | VS001; VS002; VS003 | Discussion unit/contract/browser suites, fixture tests, and quality gates. | 404/404 API; 58/58 web including 47 DiscussionPanel; 75/75 fixture; lint/build/typecheck. | Broader DB integration as modules grow. | M3 quality matrix. |
| F16 | — | Maintainability/handoff. | PTS §§30,40–43,48–49 | New engineer can own and operate Cadence. | Foundation parent | FOUNDATIONAL — ACTIVE | M0 | VS001; VS002; VS003; M3-05 | VS003 contract, Discussion README, HANDOFF, and concise closure evidence. | Documentation reconciliation and independent read-only review. | Independent handoff test. | M3 handoff sign-off. |
| F17 | — | Reproducible controlled deployment. | PTS §§29–31,43,45,49 | Promote and transfer frontend/API/worker safely. | Foundation parent | AT RISK | M3 | M1-01; M3-04 | Env/build/db guards. | Beta build/push evidence. | Hosting, staging, supervision, ownership. | Production deployment rehearsal. |
| F18 | — | Backup/recovery/resilience. | PTS §§29,43,45; BASE | Restore and recover safely under owned procedures. | Foundation parent | AT RISK | M3 | M1-01; M3-04 | Forward migrations/manual logical baseline. | Beta recorded no physical PITR. | PITR, restore test, monitoring, incidents. | Production recovery exercise. |
| F19 | — | Change/version/ADR/release traceability. | PTS §§28,32,35–36,39,44,48 | Every material change and decision is reconstructable. | Foundation parent | PARTIAL | M3 | VS001; VS002; M3-05 | Git, CHANGELOG, migrations, contracts. | Closure docs. | ADR set, semantic release and operational-change discipline. | M3 governance audit. |

## Original initiation acceptance-criterion register

| Requirement ID | Parent ID | Original commitment | Source | Intended outcome | Type | Current status | Milestone due | Vertical slice(s) | Implementation evidence | Test/evidence | Remaining gap | Closure evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| INIT-AC-01 | C01 | Create a project. | PTS §47.1 | Usable governed project. | Acceptance child | OUTSTANDING | M2 | M2-01 | None beyond schema/bootstrap. | No product route. | Create workflow. | Runtime acceptance required. |
| INIT-AC-02 | C07 | Assign members and RBAC roles. | PTS §47.2 | Project-specific access/authority. | Acceptance child | DELIVERED | M0 | VS002 | Members and role workflows. | VS002 closure. | Preserve. | Frozen closure/regression. |
| INIT-AC-03 | C08 | Hold project discussions. | PTS §47.3 | Durable shared collaboration. | Acceptance child | DELIVERED | M1 | VS001; VS003; M2-02 | Authenticated message posting plus persisted read/return path. | VS001 regression; 404/404 API; 58/58 web; Stage 7A and 7B runtime evidence. | Realtime/automatic convergence remains C08.3/M2, not part of this criterion's closure. | VS003 return-context and two-user evidence. |
| INIT-AC-04 | C11 | Upload files. | PTS §47.4 | File enters project context. | Acceptance child | OUTSTANDING | M3 | M3-02 | Schema only. | Migration evidence. | Module/API/UI/storage. | File acceptance. |
| INIT-AC-05 | C10, F09 | Edit messages without losing history. | PTS §47.5 | Immutable revision chain. | Acceptance child | PARTIAL | M3 | VS001 foundation; M3-02 | MessageVersion exists. | Immutable retrieval proof. | Edit/history UX. | Revision acceptance. |
| INIT-AC-06 | C14 | Create and manage tasks. | PTS §47.6 | Full useful Task lifecycle. | Acceptance child | PARTIAL | M3 | VS001; M2-03 | Create/read. | VS001 Task evidence. | Update/complete/cancel/assign. | Lifecycle acceptance. |
| INIT-AC-07 | C13 | Track decisions. | PTS §47.7 | Decision/rationale/source visible. | Acceptance child | OUTSTANDING | M3 | M3-01 | Schema only. | Migration evidence. | Product capability. | Decision acceptance. |
| INIT-AC-08 | C12 | Track open topics. | PTS §47.8 | Unresolved reasoning explicit. | Acceptance child | OUTSTANDING | M3 | M3-01 | Schema only. | Migration evidence. | Product capability. | Topic acceptance. |
| INIT-AC-09 | C15 | Identify blockers. | PTS §47.9 | Impediments visible and managed. | Acceptance child | OUTSTANDING | M3 | M3-01 | Schema/count only. | Migration/read evidence. | Product lifecycle. | Blocker acceptance. |
| INIT-AC-10 | C16 | Manage milestones. | PTS §47.10 | Checkpoints/slippage managed. | Acceptance child | PARTIAL | M3 | VS001; M3-01 | Next milestone read. | VS001 tests. | Management lifecycle. | Milestone acceptance. |
| INIT-AC-11 | C02, C04 | See lifecycle and health. | PTS §47.11 | Condition is understandable. | Acceptance child | PARTIAL | M3 | VS001; M3-01 | Workspace read. | VS001 tests. | Manage/history. | Project-state acceptance. |
| INIT-AC-12 | C14 | See personal pending-task counts. | PTS §47.12 | Current workload visible. | Acceptance child | DELIVERED | M0 | VS001 | Summary and My Tasks. | VS001 closure. | Preserve. | Regression evidence. |
| INIT-AC-13 | C20 | Receive meaningful project alerts. | PTS §47.13 | Important conditions surfaced sparsely. | Acceptance child | PARTIAL | M3 | VS001; M3-03 | Alert read display. | Workspace tests. | Rules/delivery/full evidence. | Alert acceptance. |
| INIT-AC-14 | C17 | Team Agent identifies state changes. | PTS §47.14 | Conversation produces explainable proposals. | Acceptance child | PARTIAL | M3 | VS001; M3-03 | Task proposal extraction. | VS001 tests. | Decisions/blockers/topics and broader abilities. | Agent acceptance. |
| INIT-AC-15 | C18 | Confirm or reject AI proposals. | PTS §47.15 | Human authority controls AI outcome. | Acceptance child | DELIVERED | M0 | VS001 | Confirm/edit/reject UI/API. | VS001 closure. | Preserve/extend. | Regression per proposal type. |
| INIT-AC-16 | C13, C19, C21 | Trace decisions to source conversations. | PTS §47.16 | “Why” reaches original evidence. | Acceptance child | OUTSTANDING | M3 | VS001 foundation; M3-01 | Task lineage pattern only. | Task Audit proof. | Decision capability and navigation. | Decision lineage acceptance. |
| INIT-AC-17 | C21 | View human and AI activity history. | PTS §47.17 | General operational history visible. | Acceptance child | PARTIAL | M3 | VS001; VS002; M3-03 | Task/membership history. | Frozen closures. | General Activity coverage. | Activity acceptance. |
| INIT-AC-18 | C22 | Search project information. | PTS §47.18 | Permission-aware retrieval. | Acceptance child | OUTSTANDING | M3 | M3-03 | None. | None. | Search capability. | Search acceptance. |
| INIT-AC-19 | C23 | Export essential project information. | PTS §47.19 | Permissioned export. | Acceptance child | OUTSTANDING | M3 | M3-03 | Permission seed only. | Seed evidence. | Export capability. | Export acceptance. |
| INIT-AC-20 | F14 | Optional-module failure isolation. | PTS §47.20 | Unrelated core functions continue. | Acceptance child | PARTIAL | M3 | VS001 partial; M3-04 | Independent consumer processing. | Processor tests. | General optional-module/flag proof. | Fault-injection acceptance. |

## Hierarchical product child register

The rows below inherit no authority from this register: their commitments are
defined in the Scope Baseline. Each row has one parent and a closure path.

| Requirement ID | Parent ID | Original commitment | Source | Intended outcome | Type | Current status | Milestone due | Vertical slice(s) | Implementation evidence | Test/evidence | Remaining gap | Closure evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| C01.1 | C01 | Authorised project creation contract. | PTS §§46–47; API | Create without ad hoc SQL. | Product child | OUTSTANDING | M2 | M2-01 | None. | None. | Service/API/operator contract. | M2 runtime proof. |
| C01.2 | C01 | Initialise required health/state atomically. | PTS §§6,47; HANDOFF project-create note | New project is immediately usable. | Product child | OUTSTANDING | M2 | M2-01 | Health backfill only. | Migration evidence. | Creation transaction. | Atomic create test. |
| C01.3 | C01 | Establish initial leadership/access. | PTS §§20–21; VS002 | Owner/Manager/Sponsor and creator access are valid. | Product child | OUTSTANDING | M2 | M2-01 | Local bootstrap only. | Bootstrap evidence. | Supported non-dev flow. | Leadership bootstrap acceptance. |
| C02.1 | C02 | Five original lifecycle states. | PTS §6 | Draft/Active/On Hold/Completed/Cancelled work correctly. | Product child | PARTIAL | M3 | VS002 partial; M3-01 | Values/read classifications. | VS002 tests. | Authorised transitions/UI. | Lifecycle matrix. |
| C02.2 | C02 | Preserve completed/cancelled/archive history. | PTS §§6,32 | Historical projects remain governed/readable. | Product child | PARTIAL | M3 | VS002 partial; M3-01 | Membership read-only classification. | VS002 tests. | Project archive/custody behavior. | Archive acceptance. |
| C03.1 | C03 | Workspace is primary UI. | PTS §5 | Users enter a coherent project workspace. | Product child | PARTIAL | M2 | VS001; M2-01 | Workspace shell. | Web build/manual proof. | Project selection/navigation. | M2 UX acceptance. |
| C03.2 | C03 | Show project condition. | PTS §§1,5 | State, health and progress are immediate. | Product child | PARTIAL | M2 | VS001; M2-01 | Summary cards. | VS001 evidence. | Complete state composition. | Workspace acceptance. |
| C03.3 | C03 | Show user responsibilities. | PTS §§1,5,8 | User sees owned work quickly. | Product child | PARTIAL | M2 | VS001; M2-03 | My Tasks/count. | VS001 closure. | Broader responsibility state. | M2 workflow proof. |
| C03.4 | C03 | Show urgency and recent activity. | PTS §§5,7 | Urgent issues and changes are visible. | Product child | PARTIAL | M3 | VS001 partial; M3-03 | Alerts; Task audit. | Partial tests. | General Activity/urgent-state coverage. | M3 workspace proof. |
| C04.1 | C04 | Lifecycle and health are distinct. | PTS §6 | Position and execution condition are not conflated. | Product child | DELIVERED | M0 | VS001 | Separate fields/read model. | VS001 project tests. | Preserve. | Regression. |
| C04.2 | C04 | Accessible health labels and colour. | PTS §6 | Status is accessible/unambiguous. | Product child | PARTIAL | M3 | VS001 partial; M3-01 | Text labels present. | UI inspection. | Formal accessibility proof/full palette. | Accessibility acceptance. |
| C04.3 | C04 | Progress/blockers/next milestone visible. | PTS §5 | Delivery condition is summarised. | Product child | PARTIAL | M2 | VS001 | Summary read model. | VS001 tests. | Complete authoritative inputs. | M2 workspace proof. |
| C04.4 | C04 | Preserve health history. | PTS §§6,23,32 | Health changes remain traceable. | Product child | PARTIAL | M3 | M3-01 | History table exists. | Migration evidence. | Owning workflow/query/UI. | Health-history acceptance. |
| C05.1 | C05 | One Person belongs to multiple projects. | PTS §20; VS002 AC-02 | Membership is many-project capable. | Product child | DELIVERED | M0 | VS002 | Canonical memberships. | VS002 AC-02. | Preserve. | Regression. |
| C05.2 | C05 | Discover/navigate authorised projects with different roles. | PTS §§5,20 | Multi-project use is coherent. | Product child | OUTSTANDING | M2 | M2-01 | Fixed VITE_PROJECT_ID only. | Source inspection. | Project list/switching/navigation. | Browser acceptance. |
| C06.1 | C06 | Pilot authentication. | PTS §22 | Controlled users authenticate safely. | Product child | DELIVERED | M0 | VS001 | Supabase password auth. | VS001 closure. | Pilot provisioning under M1. | Pilot rehearsal. |
| C06.2 | C06 | Stable Person identity. | VS002 | Attribution survives login change. | Product child | DELIVERED | M0 | VS002 | Persons/user bridge. | VS002 closure. | Preserve. | Regression. |
| C06.3 | C06 | Replaceable authentication identities. | PTS §22; VS002 | Login changes do not rewrite history/access. | Product child | DELIVERED | M0 | VS002 | Authentication identities. | VS002 closure. | Production linking ops. | M3 identity proof. |
| C06.4 | C06 | Entra SSO/MFA/account lifecycle. | PTS §22 | Institutional identity controls production access. | Product child | OUTSTANDING | M3 | M3-04 | Provider abstraction only. | Architecture evidence. | Entra integration and lifecycle. | Production identity acceptance. |
| C06.5 | C06 | Provider replacement preserves permissions. | PTS §22 | No RBAC redesign for Entra. | Product child | FOUNDATIONAL — ACTIVE | M3 | VS002; M3-04 | Stable Person boundary. | VS002 identity tests. | Live Entra proof. | Integration regression. |
| C07.1 | C07 | Membership determines access. | PTS §20; VS002 | No active membership means no project access. | Product child | DELIVERED | M0 | VS002 | Authorisation service. | Frozen closure. | Preserve. | Regression. |
| C07.2 | C07 | Roles/permissions determine authority. | PTS §§20–21 | Actions require explicit permission. | Product child | DELIVERED | M0 | VS001; VS002 | Permission evaluation. | Security tests. | Preserve. | Regression. |
| C07.3 | C07 | Backend permissions are authoritative. | PTS §21 | Hidden controls never grant security. | Product child | DELIVERED | M0 | VS001; VS002 | Service/RPC checks. | Boundary tests. | Preserve. | Regression. |
| C07.4 | C07 | Platform admin is not universal reader. | PTS §20 | Project confidentiality remains scoped. | Product child | DELIVERED | M0 | VS002 | Separate platform/project authority. | VS002 closure. | Preserve. | Security regression. |
| C07.5 | C07 | Protected roles/history auditable. | VS002 | Responsibility succession preserves truth. | Product child | DELIVERED | M0 | VS002 | Transfer ledger/history/Audit. | Frozen closure. | Preserve. | Regression. |
| C08.1 | C08 | Project rooms/messages. | PTS §9 | Members can converse in project context. | Product child | DELIVERED | M1 | VS001; VS003; M2-02 | Existing POST plus authenticated persisted project-message list/read path. | 404/404 API; 58/58 web; Stage 7A/7B authorized posting and shared visibility. | Preserve existing write behavior; broader Discussion features remain later scope. | Discussion acceptance. |
| C08.2 | C08 | Persisted conversations reload after return. | PTS §§1,9,46 | Context survives session/navigation. | Product child | DELIVERED | M1 | VS003 | Fresh GET reconstructs current committed messages after reload and leave/return. | 47 DiscussionPanel tests; 58/58 web; Stage 7B reload/return fresh GET 200 with no duplicates. | Preserve; no realtime implication. | Return-context proof. |
| C08.3 | C08 | Members see committed messages/realtime updates. | PTS §46 | Shared project view converges. | Product child | PARTIAL | M2 | VS003 partial; M2-02 | Deterministic manual Refresh and fresh GET expose another user's committed message. | 47 DiscussionPanel tests; Stage 7A User B visibility; Stage 7B cross-session visibility/repeated refresh with no duplicates. | Realtime/push-based automatic convergence is not delivered and remains due M2. | Multi-user acceptance including realtime/automatic convergence. |
| C08.4 | C08 | Discussion emits AI hooks asynchronously. | PTS §§9,27 | AI consumes without blocking Discussion. | Product child | DELIVERED | M0 | VS001; VS003 (regression) | Existing MessageCreated outbox/delivery remains unchanged; VS003 adds no event producer. | VS001 closure; VS003 API regression and Stage 7A unauthorized-mutation count of 0. | Preserve existing asynchronous behavior. | Regression. |
| C09.1 | C09 | Replies/threads. | PTS §9 | Related conversation remains grouped. | Product child | OUTSTANDING | M3 | M3-02 | Parent ID accepted on write only. | Validation tests. | Thread query/UI. | Thread acceptance. |
| C09.2 | C09 | Mentions. | PTS §9 | Users can direct attention. | Product child | OUTSTANDING | M3 | M3-02 | Schema only. | Migration evidence. | API/UI/notification link. | Mention acceptance. |
| C09.3 | C09 | Message attachments. | PTS §§9–10 | Files remain associated with messages/history. | Product child | OUTSTANDING | M3 | M3-02 | Schema relation only. | Migration evidence. | File/message integration. | Attachment acceptance. |
| C09.4 | C09 | Reactions. | PTS §9 | Lightweight response is preserved. | Product child | OUTSTANDING | M3 | M3-02 | Schema only. | Migration evidence. | API/UI. | Reaction acceptance. |
| C09.5 | C09 | Timestamps. | PTS §9 | Message chronology is explicit. | Product child | DELIVERED | M0 | VS001 | created_at/edited_at response. | VS001 tests. | Preserve. | Regression. |
| C09.6 | C09 | Read status. | PTS §9 | Users know unseen/new context. | Product child | OUTSTANDING | M3 | M3-02 | No capability. | None. | Model/API/UI. | Read-state acceptance. |
| C09.7 | C09 | Discussion search. | PTS §9 | Conversation is retrievable. | Product child | OUTSTANDING | M3 | M3-03 | No search. | None. | Permission-aware search. | Search acceptance. |
| C09.8 | C09 | AI event hooks. | PTS §9 | Agent reacts through decoupled events. | Product child | DELIVERED | M0 | VS001 | MessageCreated consumer. | VS001 tests. | Extend as needed. | Regression. |
| C10.1 | C10 | Edit messages. | PTS §10 | Author can correct content under policy. | Product child | OUTSTANDING | M3 | M3-02 | No edit command. | None. | Service/API/UI. | Edit acceptance. |
| C10.2 | C10 | Append immutable versions. | PTS §10 | Prior content is never overwritten. | Product child | PARTIAL | M3 | VS001 foundation; M3-02 | Version 1/immutability. | VS001 evidence. | Multi-version edit path. | Version-chain test. |
| C10.3 | C10 | Retain full edit and derived-state traceability. | PTS §10 | Actor/time/content/links/state changes reconstruct. | Product child | PARTIAL | M3 | VS001 foundation; M3-02 | Initial source/event lineage. | Task audit proof. | Edit/history query and links. | Reconstruction acceptance. |
| C11.1 | C11 | Upload files. | PTS §16 | Authorised file reaches project storage. | Product child | OUTSTANDING | M3 | M3-02 | Storage/schema only. | Schema evidence. | Module/API/UI. | Upload test. |
| C11.2 | C11 | View/download files. | PTS §16 | Authorised users retrieve files. | Product child | OUTSTANDING | M3 | M3-02 | RLS helper only. | Schema/RLS evidence. | Signed access/API/UI. | View/download test. |
| C11.3 | C11 | Associate files with project entities. | PTS §16 | File context is explicit. | Product child | OUTSTANDING | M3 | M3-02 | file_links schema. | Migration evidence. | Owning contract/UI. | Link acceptance. |
| C11.4 | C11 | Preserve file activity/provenance. | PTS §16 | Upload/change activity is auditable. | Product child | OUTSTANDING | M3 | M3-02 | Audit infrastructure only. | None for files. | Events/Audit/query. | File audit acceptance. |
| C12.1 | C12 | Topic state model. | PTS §11 | Exploring/Proposed/Decided/Deferred are managed. | Product child | OUTSTANDING | M3 | M3-01 | Schema only. | Migration evidence. | Domain/service/UI. | State-transition tests. |
| C12.2 | C12 | Discussion and alternatives. | PTS §11 | Reasoning journey is preserved. | Product child | OUTSTANDING | M3 | M3-01 | No product flow. | None. | Data/contracts/UI. | Topic-history test. |
| C12.3 | C12 | Linked messages/proposals. | PTS §11 | Topic evidence remains navigable. | Product child | OUTSTANDING | M3 | M3-01 | Generic links only. | Schema evidence. | Topic-owned links/query. | Link acceptance. |
| C12.4 | C12 | Final decision/rationale. | PTS §11 | Topic closes truthfully. | Product child | OUTSTANDING | M3 | M3-01 | No flow. | None. | Topic→Decision/defer workflow. | Closure acceptance. |
| C13.1 | C13 | Decision identity/status/owner/date. | PTS §12 | Authoritative decision record. | Product child | OUTSTANDING | M3 | M3-01 | Schema only. | Migration evidence. | Module/API/UI. | Decision CRUD/lifecycle tests. |
| C13.2 | C13 | Human/AI creator and approver. | PTS §12 | Authority and origin are explicit. | Product child | OUTSTANDING | M3 | M3-01 | Schema fields only. | Migration evidence. | Authorised workflow. | Approval tests. |
| C13.3 | C13 | Source messages. | PTS §12 | Original evidence is navigable. | Product child | OUTSTANDING | M3 | M3-01 | Generic source links only. | Schema evidence. | Decision source contract/UI. | Source-navigation test. |
| C13.4 | C13 | Revision/supersession history. | PTS §12 | Later decisions do not erase earlier truth. | Product child | OUTSTANDING | M3 | M3-01 | decision_supersedes schema. | Migration evidence. | Workflow/query/UI. | Supersession tests. |
| C13.5 | C13 | Rationale and why navigation. | PTS §§12,47 | Users can answer why a decision was made. | Product child | OUTSTANDING | M3 | M3-01 | No product capability. | None. | Rationale/source/activity view. | INIT-AC-16 proof. |
| C14.1 | C14 | Human/AI-sourced Task creation. | PTS §13 | Authoritative tasks record origin. | Product child | PARTIAL | M2 | VS001; M2-03 | AI-proposal creation path. | VS001 tests. | Normal human create path. | Creation matrix. |
| C14.2 | C14 | Assign Task owner. | PTS §13 | Responsibility is explicit. | Product child | PARTIAL | M2 | VS001; M2-03 | Assignee validation supported. | Task tests. | Usable assignment UI/change. | Assignment acceptance. |
| C14.3 | C14 | Manage four Task states. | PTS §13 | Work can start, complete or cancel. | Product child | OUTSTANDING | M2 | M2-03 | Read only open/in-progress. | Schema only for states. | Update commands/UI/history. | Lifecycle tests. |
| C14.4 | C14 | Due date and priority. | PTS §13 | Urgency/schedule are explicit. | Product child | PARTIAL | M2 | VS001; M2-03 | Fields/validation/display. | Task tests. | Edit/manage UI. | Update acceptance. |
| C14.5 | C14 | Link decision/blocker/source message. | PTS §13 | Work retains context. | Product child | PARTIAL | M3 | VS001 source partial; M3-01 | AI proposal/source lineage. | Audit journey. | Decision/blocker/general source links. | Link matrix. |
| C14.6 | C14 | Personal pending/overdue visibility. | PTS §8 | User sees current workload quickly. | Product child | DELIVERED | M0 | VS001 | My Tasks/count/overdue. | VS001 closure. | Preserve. | Regression. |
| C15.1 | C15 | Blocker core fields. | PTS §14 | Authoritative blocker record. | Product child | OUTSTANDING | M3 | M3-01 | Schema only. | Migration evidence. | Module/API/UI. | Blocker tests. |
| C15.2 | C15 | Link Tasks/Milestones. | PTS §14 | Impacted work/checkpoints are visible. | Product child | OUTSTANDING | M3 | M3-01 | Generic/schema links only. | Schema evidence. | Owning contracts/UI. | Link tests. |
| C15.3 | C15 | Blocker source provenance. | PTS §14 | Origin is traceable. | Product child | OUTSTANDING | M3 | M3-01 | Source-link foundation. | Generic evidence. | Blocker integration. | Provenance test. |
| C15.4 | C15 | Resolution and dates. | PTS §14 | Opening/resolution history is preserved. | Product child | OUTSTANDING | M3 | M3-01 | Schema fields only. | Migration evidence. | Lifecycle/events/Audit/UI. | Resolution acceptance. |
| C16.1 | C16 | Milestone identity/owner/dates. | PTS §15 | Delivery checkpoint is accountable. | Product child | PARTIAL | M3 | VS001 read; M3-01 | Read model/schema. | Project tests. | Create/update UI. | Milestone tests. |
| C16.2 | C16 | Original milestone states. | PTS §6 | Upcoming/Due Soon/Slipped/Completed work. | Product child | PARTIAL | M3 | M3-01 | Schema status differs/narrow read. | Migration evidence. | Reconciled domain behavior. | State matrix. |
| C16.3 | C16 | Linked Tasks/Blockers. | PTS §15 | Milestone composition/impediments visible. | Product child | OUTSTANDING | M3 | M3-01 | Schema/generic links only. | Schema evidence. | Module query/UI. | Link acceptance. |
| C16.4 | C16 | Slippage informs but differs from health. | PTS §§6,15 | Health derivation remains explainable. | Product child | OUTSTANDING | M3 | M3-01 | No owning behavior. | None. | Event/rule/history design. | Health/slippage tests. |
| C17.1 | C17 | Summarise a chosen period. | PTS §17 | Users understand what happened. | Product child | OUTSTANDING | M3 | M3-03 | No capability. | None. | Agent contract/UI/provenance. | Summary acceptance. |
| C17.2 | C17 | Extract Tasks/Decisions/Blockers/Topics. | PTS §17 | Conversation becomes structured proposals. | Product child | PARTIAL | M3 | VS001 Task partial; M3-03 | Task proposal only. | VS001 tests. | Other entity proposals. | Extraction matrix. |
| C17.3 | C17 | Recall reasoning. | PTS §17 | Prior choices are explainable. | Product child | OUTSTANDING | M3 | M3-03 | Audit foundation only. | None. | Retrieval/answer/provenance. | Recall acceptance. |
| C17.4 | C17 | Identify impediments. | PTS §17 | Current blockers are surfaced. | Product child | OUTSTANDING | M3 | M3-03 | No blocker capability. | None. | Blocker integration. | Identification acceptance. |
| C17.5 | C17 | Suggest next steps. | PTS §17 | Safe explainable recommendations. | Product child | OUTSTANDING | M3 | M3-03 | No capability. | None. | Proposal/approval/UI. | Suggestion acceptance. |
| C18.1 | C18 | Structured AI proposals. | PTS §18 | AI output is validated structure. | Product child | DELIVERED | M0 | VS001 | Task proposals. | VS001 closure. | Extend by type. | Per-type tests. |
| C18.2 | C18 | Application validation. | PTS §18 | Invalid proposals cannot alter state. | Product child | DELIVERED | M0 | VS001 | Review/materialisation services. | VS001 tests. | Preserve/extend. | Regression. |
| C18.3 | C18 | Authorised confirm/edit/reject. | PTS §§18–19 | Human controls outcome. | Product child | DELIVERED | M0 | VS001 | UI/API review. | VS001 closure. | Extend by type. | Per-type acceptance. |
| C18.4 | C18 | No autonomous high-impact action. | PTS §§3,19,45 | Safety boundary remains intact. | Product child | FOUNDATIONAL — ACTIVE | M0 | VS001 | Proposal-only flow. | Boundary tests. | Preserve. | Security regression. |
| C19.1 | C19 | AI run identity/provider abstraction. | PTS §§29,33 | Meaningful AI operation is identifiable/replaceable. | Product child | DELIVERED | M0 | VS001 | ai_runs/repository. | VS001 evidence. | Production provider implementation. | M3 provider proof. |
| C19.2 | C19 | Prompt version and source input. | PTS §33 | Inputs/prompts are reconstructable. | Product child | DELIVERED | M0 | VS001 | prompt_versions/source version. | VS001 evidence. | Apply to future runs. | Lineage regression. |
| C19.3 | C19 | Output/proposal/human decision. | PTS §33 | AI and human contribution are distinct. | Product child | DELIVERED | M0 | VS001 | proposals/review events. | VS001 closure. | Extend by type. | Per-type lineage. |
| C19.4 | C19 | Resulting entity/full lineage. | PTS §§33–34 | Source-to-result journey reconstructs. | Product child | DELIVERED | M0 | VS001 | source links/Audit journey. | VS001 closure. | Extend by entity. | Journey regression. |
| C20.1 | C20 | Information/warning/critical alerts. | PTS §7 | Severity is meaningful. | Product child | PARTIAL | M3 | VS001; M3-03 | Alert schema/read display. | Project tests. | Rule/management proof. | Severity acceptance. |
| C20.2 | C20 | User-specific alerts. | PTS §7 | Personal urgency is surfaced. | Product child | PARTIAL | M3 | VS001 partial; M3-03 | Overdue count separate from alert delivery. | My Tasks evidence. | User-alert model/delivery. | Personal alert acceptance. |
| C20.3 | C20 | Sparse/meaningful presentation. | PTS §7 | Avoid notification fatigue. | Product child | PARTIAL | M3 | VS001 partial; M3-03 | Workspace alert banners. | UI inspection. | Rules/preferences/evidence. | Pilot/M3 usability proof. |
| C20.4 | C20 | Event-driven notification delivery. | PTS §§24,27 | Relevant changes reach users independently. | Product child | OUTSTANDING | M3 | M3-03 | Notification schema only. | Migration evidence. | Consumer/channel/read state. | Delivery acceptance. |
| C21.1 | C21 | Software change history. | PTS §32 | Product changes are traceable. | Product child | PARTIAL | M3 | VS001; VS002; M3-05 | Git/CHANGELOG/migrations. | Closure evidence. | ADR/release/prompt completeness. | Governance audit. |
| C21.2 | C21 | Operational append audit. | PTS §32 | Actions survive mutable state changes. | Product child | PARTIAL | M3 | VS001; VS002; M3-03 | Task/membership Audit. | Frozen closure. | All material modules/actions. | Coverage matrix. |
| C21.3 | C21 | Actor/role/action/before/after/source/time. | PTS §32 | Audit explains who/what/why/when. | Product child | PARTIAL | M3 | VS001; VS002; M3-03 | Supported event payloads. | Audit tests. | Full entity coverage/role evidence. | Audit-field acceptance. |
| C21.4 | C21 | General Activity view. | PTS §§4–5,47 | Users can view project history. | Product child | OUTSTANDING | M3 | M3-03 | Task-only panel. | Browser evidence. | Project Activity query/UI. | Activity acceptance. |
| C21.5 | C21 | Cross-module journey reconstruction. | PTS §§33–34 | Complete business journeys are truthful. | Product child | DELIVERED | M0 | VS001 | Task Audit reconstruction. | VS001 closure. | Extend to future entities. | Per-journey regression. |
| C22.1 | C22 | Search project information. | PTS §§9,47 | Users find relevant knowledge. | Product child | OUTSTANDING | M3 | M3-03 | None. | None. | Search service/UI. | Search acceptance. |
| C22.2 | C22 | Permission-aware cross-content results. | PTS §§20–21,45 | Search never leaks project/content data. | Product child | OUTSTANDING | M3 | M3-03 | Auth foundation only. | Security foundation. | Search authorization/index model. | Isolation tests. |
| C23.1 | C23 | Export essential project information. | PTS §47 | Portable essential state. | Product child | OUTSTANDING | M3 | M3-03 | None. | None. | Define format/service/UI. | Export acceptance. |
| C23.2 | C23 | Permissioned/audited export. | PTS §21 | Export requires authority and trace. | Product child | OUTSTANDING | M3 | M3-03 | `project.export` seed only. | Seed evidence. | Enforcement/event/Audit. | Security/audit test. |
| C24.1 | C24 | Role-sensitive Project State dashboard. | PTS §§5,24 | Relevant status/actions differ by authority. | Product child | PARTIAL | M3 | VS001 partial; M3-03 | Workspace summary. | VS001 evidence. | Full core-state composition/roles. | Dashboard acceptance. |
| C24.2 | C24 | Essential project reporting only. | PTS §§3,5 | Useful project reports without enterprise-analytics expansion. | Product child | OUTSTANDING | M3 | M3-03 | No report/export surface. | None. | Define minimum essential reports. | M3 reporting proof. |
| C25.1 | C25 | Internal participant. | VS002 AC-04 | Internal Person participates securely. | Product child | DELIVERED | M0 | VS002 | Affiliation/membership. | VS002 closure. | Preserve. | Regression. |
| C25.2 | C25 | External participant. | VS002 AC-05 | External Person participates securely. | Product child | DELIVERED | M0 | VS002 | External affiliation/membership. | VS002 closure. | Onboarding separately C25.4. | Regression. |
| C25.3 | C25 | External Project Manager/internal accountability. | VS002 AC-06; §§22–23 | External operation does not erase internal governance. | Product child | DELIVERED | M0 | VS002 | Protected roles/scenario. | VS002 closure. | Preserve. | Regression. |
| C25.4 | C25 | Production external onboarding/provider independence. | VS002 §25 | External accounts enter without membership coupling. | Product child | OUTSTANDING | M3 | M2-01; M3-04 | Provider-independent model only. | Architecture tests. | Invitation/onboarding/lifecycle. | Production external-user acceptance. |

## Hierarchical foundational child register

| Requirement ID | Parent ID | Original commitment | Source | Intended outcome | Type | Current status | Milestone due | Vertical slice(s) | Implementation evidence | Test/evidence | Remaining gap | Closure evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F01.1 | F01 | One deployable modular monolith. | PTS §24 | Simple deployment with internal separation. | Foundation child | FOUNDATIONAL — ACTIVE | M0 | VS001; VS002 | API composition/modules. | Build/closure. | Preserve. | Architecture review. |
| F01.2 | F01 | Boundaries permit later extraction. | PTS §§24,49 | Scale need does not require redesign now. | Foundation child | FOUNDATIONAL — ACTIVE | M0 | VS001; VS002 | Contract/repository boundaries. | Boundary tests. | Preserve. | Slice reconciliation. |
| F02.1 | F02 | Documented public interfaces. | PTS §§28,42,48 | Consumers depend on explicit contracts. | Foundation child | FOUNDATIONAL — ACTIVE | M0 | VS001; VS002; VS003 | Discussion read repository/service/API contract and module README. | API route tests, typecheck, and runtime envelope/metadata evidence. | Extend to new modules. | Documentation/test gate. |
| F02.2 | F02 | New version for incompatible changes. | PTS §28 | Existing behavior is not silently altered. | Foundation child | FOUNDATIONAL — ACTIVE | M0 | VS001; VS002 | `.v1` events. | Event tests. | Enforce for future changes. | Version review. |
| F03.1 | F03 | Modules own authoritative data/rules. | PTS §§25–26 | Ownership remains clear. | Foundation child | FOUNDATIONAL — ACTIVE | M0 | VS001; VS002; VS003 | Discussion owns message reads through its repository/service/API boundary. | Discussion service/repository/API tests; Stage 7A database cross-check. | Extend to new modules. | Architecture review. |
| F03.2 | F03 | No direct cross-module persistence. | PTS §§25–26,48 | Consumers use contracts/events. | Foundation child | FOUNDATIONAL — ACTIVE | M0 | VS001; VS002; VS003 | Browser Discussion business path is `/api/v1`; no direct table/RPC access. | Stage 7B Network inspection observed zero direct Supabase business calls. | Preserve. | Regression scan. |
| F04.1 | F04 | PostgreSQL authoritative. | PTS §§26,29,49 | Durable state has one source of truth. | Foundation child | FOUNDATIONAL — ACTIVE | M0 | BASE; VS001; VS002 | Supabase persistence. | Runtime/smoke. | Preserve. | Data-ownership review. |
| F04.2 | F04 | Structural changes are migrations. | PTS §36 | Schema is reproducible/versioned. | Foundation child | FOUNDATIONAL — ACTIVE | M0 | BASE; VS001; VS002 | Ordered SQL migrations. | Reset/smokes. | Preserve. | Migration gate. |
| F04.3 | F04 | No manual production schema changes. | PTS §36 | Production schema remains source-controlled. | Foundation child | FOUNDATIONAL — ACTIVE | M0 | Platform scripts | Guarded db push/runbook baseline. | Deployment evidence. | Operational enforcement by M3. | Production audit. |
| F05.1 | F05 | Membership scopes access. | PTS §20 | Project boundary is explicit. | Foundation child | FOUNDATIONAL — ACTIVE | M0 | VS002; VS003 | ProjectAuthorisationService gates requested project reads. | Stage 7A P1/P2 member/nonmember matrix and 404 concealment. | Preserve. | Security regression. |
| F05.2 | F05 | Permissions, not role names, authorise. | PTS §21 | Policy remains explicit/evolvable. | Foundation child | FOUNDATIONAL — ACTIVE | M0 | VS001; VS002; VS003 | Discussion read/write decisions use `message.view`/`message.create` permission codes. | API 403 evidence for Observer/Auditor writes; service/API tests. | Preserve. | Regression. |
| F05.3 | F05 | Roles differ by project. | PTS §20 | Same user has contextual authority. | Foundation child | FOUNDATIONAL — ACTIVE | M0 | VS002 | Role assignments by membership/project. | VS002 tests. | Preserve. | Multi-project regression. |
| F06.1 | F06 | Authentication proves identity; authorisation decides access. | PTS §22 | Login success is not access. | Foundation child | FOUNDATIONAL — ACTIVE | M0 | VS001; VS002 | `/me` then authorisation. | Auth/security tests. | Preserve. | Regression. |
| F06.2 | F06 | Provider replacement preserves membership/permission logic. | PTS §22 | Entra does not redesign project authority. | Foundation child | FOUNDATIONAL — ACTIVE | M3 | VS002; M3-04 | Stable Person boundary. | Identity tests. | Production Entra proof. | M3 integration acceptance. |
| F07.1 | F07 | Least privilege. | PTS §45 | Minimum authority only. | Foundation child | FOUNDATIONAL — ACTIVE | M0 | VS001; VS002; VS003 | Separate read and create permissions; Observer/Auditor remain read-only. | Stage 7A role matrix and Stage 7B denied-write evidence. | Production review. | M3 security report. |
| F07.2 | F07 | Project isolation. | PTS §45 | Unauthorised Persons cannot see project content. | Foundation child | FOUNDATIONAL — ACTIVE | M0 | VS001; VS002; VS003 | Project-scoped GET/POST preserve P1/P2 concealment. | Stage 7A P1/P2 leakage count 0; Stage 7B shared P1 visibility only. | Preserve. | Isolation regression. |
| F07.3 | F07 | Platform admin not universal project reader. | PTS §20 | Confidential projects remain scoped. | Foundation child | FOUNDATIONAL — ACTIVE | M0 | VS002 | Separate authority model. | VS002 closure. | Preserve. | Security regression. |
| F08.1 | F08 | Mutations use owning backend contracts. | PTS §§25–26 | No browser/direct cross-owner mutation. | Foundation child | FOUNDATIONAL — ACTIVE | M0 | VS001; VS002; VS003 | Discussion POST and GET use owning service/API contracts; browser has no business-table path. | 404/404 API; Stage 7A/7B boundary evidence. | Extend to new modules. | Slice review. |
| F08.2 | F08 | Server validates permissions. | PTS §§21,45 | Client cannot assert authority. | Foundation child | FOUNDATIONAL — ACTIVE | M0 | VS001; VS002; VS003 | Server re-evaluates `ProjectAuthorisationService` access at the read boundary. | 401/403/404 API results; Observer/Auditor denied writes. | Preserve. | Regression. |
| F08.3 | F08 | Database/RLS defence in depth. | BASE; PTS §45 | Boundary race/bypass is contained. | Foundation child | FOUNDATIONAL — ACTIVE | M0 | VS001; VS002; VS003 | Existing RLS/service-role boundaries remain; VS003 adds no privileged browser path. | Stage 7A database read-only cross-check and unauthorized-mutation count 0. | Production review. | M3 security evidence. |
| F09.1 | F09 | Message revisions preserve history. | PTS §10 | Edits never destroy original text. | Foundation child | PARTIAL | M3 | VS001 foundation; VS003 (regression); M3-02 | VS003 reads current committed versions without adding edit behavior. | Current-version repository/API tests and repeated-read evidence. | Full edit/version chain. | C10 closure. |
| F09.2 | F09 | Audit/health history append-oriented. | PTS §32; BASE | Significant history is durable. | Foundation child | FOUNDATIONAL — ACTIVE | M0 | VS001; VS002 | Audit/health history tables. | Audit/R03 tests. | Extend to new actions. | Coverage matrix. |
| F09.3 | F09 | Membership/role provenance retained. | VS002 | Access history remains truthful. | Foundation child | FOUNDATIONAL — ACTIVE | M0 | VS002 | R03 hardening. | Frozen closure. | Preserve. | Regression. |
| F10.1 | F10 | Material changes emit events. | PTS §27 | Other modules react independently. | Foundation child | FOUNDATIONAL — ACTIVE | M0 | VS001; VS002 | Versioned domain events. | Event tests. | Extend to new modules. | Event coverage. |
| F10.2 | F10 | Transactional outbox/fan-out. | BASE; PTS §27 | Core write and event do not diverge. | Foundation child | FOUNDATIONAL — ACTIVE | M0 | VS001; VS002 | DB RPC/event deliveries. | Atomicity smokes. | Preserve. | Runtime gate. |
| F10.3 | F10 | Independent retryable consumers. | PTS §27 | One consumer failure does not rewrite core state. | Foundation child | FOUNDATIONAL — ACTIVE | M0 | VS001; VS002 | Leased deliveries/retry. | Processor tests. | Production supervision F18. | Recovery/fault test. |
| F11.1 | F11 | AI cannot write owning tables directly. | PTS §§18,25 | Module authority is preserved. | Foundation child | FOUNDATIONAL — ACTIVE | M0 | VS001 | Team Agent has no Tasks persistence. | Boundary tests. | Extend per AI action. | Static/contract proof. |
| F11.2 | F11 | Owning modules revalidate. | PTS §18 | Human approval cannot bypass target permissions. | Foundation child | FOUNDATIONAL — ACTIVE | M0 | VS001 | TasksService/RPC checks. | Task tests. | Extend. | Per-action tests. |
| F11.3 | F11 | Consequential AI change requires authorised human approval. | PTS §§18–19 | Human authority remains final. | Foundation child | FOUNDATIONAL — ACTIVE | M0 | VS001 | Review workflow. | Frozen closure. | Extend. | Proposal-type acceptance. |
| F12.1 | F12 | Correlation and causation. | PTS §34 | Operations can be linked truthfully. | Foundation child | FOUNDATIONAL — ACTIVE | M0 | VS001; VS002; VS003 | Discussion responses retain request/correlation metadata. | Stage 7A envelope/metadata representation and fresh GET evidence. | Extend. | Journey tests. |
| F12.2 | F12 | Source links. | PTS §§10,33 | Derived state points to evidence. | Foundation child | FOUNDATIONAL — ACTIVE | M0 | VS001 | source_links. | Task journey. | Extend entities. | Link tests. |
| F12.3 | F12 | Cross-request journey reconstruction without false correlation. | PTS §§33–34; VS001 clarification | Truthful complete lineage. | Foundation child | FOUNDATIONAL — ACTIVE | M0 | VS001 | Audit reconstruction. | Frozen closure. | Extend. | Per-journey regression. |
| F13.1 | F13 | No hard-coded/committed secrets. | PTS §§30,45 | Credentials remain protected. | Foundation child | FOUNDATIONAL — ACTIVE | M0 | Platform hardening | `.gitignore`, examples. | Repository scan/CI. | Preserve. | Secret scan. |
| F13.2 | F13 | Server keys stay server-side. | PTS §45; BASE | Browser cannot use privileged credentials. | Foundation child | FOUNDATIONAL — ACTIVE | M0 | VS001; VS002 | env boundary/browser checks. | Security tests. | Preserve. | Production bundle audit. |
| F13.3 | F13 | Environment/target guards. | PTS §§30–31 | Commands cannot hit wrong environment silently. | Foundation child | FOUNDATIONAL — ACTIVE | M0 | Platform hardening | CADENCE_ENV/project-ref guards. | Env tests. | Hosting integration. | Deployment rehearsal. |
| F13.4 | F13 | Separate experimental/production data and account ownership. | PTS §30 | Sensitive production state has institutional custody. | Foundation child | PARTIAL | M3 | M3-04 | Local/qa/beta modes. | Guard tests. | Production/institution ownership register. | M3 ownership audit. |
| F14.1 | F14 | Feature flags for experimental capability. | PTS §37 | Experiments need not expose globally. | Foundation child | OUTSTANDING | M3 | M3-04 | No general flag system. | None. | Minimal flag/control model. | Flag acceptance. |
| F14.2 | F14 | Optional modules disable independently. | PTS §37 | Optional capability does not block core. | Foundation child | PARTIAL | M3 | VS001 partial; M3-04 | Consumers separate from server. | Composition tests. | Explicit disable/config proof. | Module-disable acceptance. |
| F14.3 | F14 | Optional failure containment. | PTS §§27,47 | Unrelated functions continue. | Foundation child | PARTIAL | M3 | VS001; M3-04 | Discussion commits before consumers. | Processor/service tests. | End-to-end fault injection. | INIT-AC-20 proof. |
| F15.1 | F15 | Unit/contract/permission tests. | PTS §38 | Modules and boundaries are verified. | Foundation child | FOUNDATIONAL — ACTIVE | M0 | VS001; VS002; VS003 | Discussion repository/service/API/browser coverage. | 404/404 API; 58/58 web including 47 DiscussionPanel; 75/75 fixture. | Add with every module. | Quality gate. |
| F15.2 | F15 | Integration/regression tests. | PTS §38 | Complete journeys remain intact. | Foundation child | FOUNDATIONAL — ACTIVE | M0 | VS001; VS002; VS003 | VS003 API/runtime and browser regression evidence. | Stage 7A/7B; repeated reads, isolation, role denial, and no duplicates. | Broader automation as scope grows. | M3 quality matrix. |
| F15.3 | F15 | Critical failure blocks release. | PTS §38 | Unsafe build is not deployed. | Foundation child | FOUNDATIONAL — ACTIVE | M0 | CI; VS003 | Quality command remains the release gate. | `npm.cmd run quality`, lint/build/typecheck/API tests, and `git diff --check`. | Production promotion gate. | M3 release proof. |
| F16.1 | F16 | Readable code/explicit dependencies. | PTS §40 | New engineers understand modules. | Foundation child | FOUNDATIONAL — ACTIVE | M0 | VS001; VS002; VS003 | Discussion read contract and implementation references are documented. | Read-only review and quality verification. | Preserve. | Handoff audit. |
| F16.2 | F16 | Module README completeness. | PTS §42 | Purpose/ownership/interfaces/events/permissions/tests known. | Foundation child | PARTIAL | M3 | VS001; VS002; VS003; M3-05 | Discussion README now documents the persisted read contract and limits. | Documentation review. | New modules and stale sections. | M3 doc audit. |
| F16.3 | F16 | HANDOFF completeness. | PTS §43 | Setup/deploy/auth/migrations/recovery/support knowledge transfers. | Foundation child | PARTIAL | M3 | VS001; VS002; VS003; M3-05 | HANDOFF records VS003 current state, fixture, runtime/browser evidence, and next-slice gate. | Closure documentation and independent read-only review. | Governance/deploy/recovery/support reconciliation. | Handoff checklist. |
| F16.4 | F16 | Independent engineer handoff test. | PTS §43 | Product can be run/changed/deployed/recovered without tribal knowledge. | Foundation child | OUTSTANDING | M3 | M3-05 | No independent sign-off. | None. | Conduct recorded handoff exercise. | Named sign-off. |
| F17.1 | F17 | Reproducible frontend/API/worker deployment. | PTS §§29,43 | Complete application deploys predictably. | Foundation child | AT RISK | M1 | M1-01; M3-04 | Build/start scripts only. | Beta build evidence. | Hosting/process/scheduler definitions. | Pilot then production rehearsal. |
| F17.2 | F17 | Development/Staging/Production separation. | PTS §31 | Promotion happens through isolated environments. | Foundation child | AT RISK | M3 | M3-04 | Local/qa/beta guards. | Env tests. | Formal staging/production ownership. | Promotion acceptance. |
| F17.3 | F17 | Controlled promotion/correction. | PTS §§31,43,45 | Release and rollback/correction are safe. | Foundation child | AT RISK | M3 | M3-04 | db dry-run/push guards. | Migration evidence. | Full app release/rollback procedure. | Release rehearsal. |
| F17.4 | F17 | Institutional account/service ownership. | PTS §30 | Original developer is not infrastructure dependency. | Foundation child | AT RISK | M3 | M3-04 | Personal/beta development evidence. | No institutional proof. | Transfer accounts/register/owners. | Ownership sign-off. |
| F18.1 | F18 | Backup/PITR. | PTS §§29,43; BASE | Recoverable production data. | Foundation child | AT RISK | M1 | M1-01; M3-04 | Manual logical baseline only. | Beta PITR unavailable record. | Confirm pilot/production backup. | Backup evidence. |
| F18.2 | F18 | Tested restore. | PTS §43 | Recovery works in practice. | Foundation child | AT RISK | M3 | M3-04 | No full restore exercise. | None. | Rehearse and record restore. | Restore report. |
| F18.3 | F18 | Monitored/supervised retry and recovery. | PTS §§29,43,45 | Failures are visible and recoverable. | Foundation child | AT RISK | M3 | M1-01; M3-04 | Console logs/one-shot worker. | Processor tests. | Monitoring, alerting, supervision. | Failure exercise. |
| F18.4 | F18 | Incident/emergency ownership. | PTS §43 | Named people can respond safely. | Foundation child | AT RISK | M3 | M1-01; M3-04 | No production ownership. | None. | Runbook/on-call/escalation. | Sign-off/exercise. |
| F19.1 | F19 | Git/CHANGELOG traceability. | PTS §§32,35,48 | Software changes reconstruct. | Foundation child | FOUNDATIONAL — ACTIVE | M0 | VS001; VS002 | Git/CHANGELOG. | Closure evidence. | Preserve. | Release audit. |
| F19.2 | F19 | Migration/release traceability. | PTS §§32,35–36 | Schema/release state reconstructs. | Foundation child | PARTIAL | M3 | VS001; VS002; M3-05 | Migrations and build scripts. | Push/closure evidence. | Formal release records. | M3 release audit. |
| F19.3 | F19 | Prompt/AI change traceability. | PTS §§32,35 | AI behavior changes are attributable. | Foundation child | PARTIAL | M3 | VS001; M3-05 | Prompt-version schema/records. | VS001 provenance. | Operational prompt release discipline. | AI change audit. |
| F19.4 | F19 | Semantic versioning. | PTS §39 | Releases communicate compatibility/stability. | Foundation child | OUTSTANDING | M3 | M3-05 | Package versions not governed product releases. | None. | Release/version policy and evidence. | 1.0.0 gate. |
| F19.5 | F19 | Architecture Decision Records. | PTS §44 | Major choices retain context/reason/consequences. | Foundation child | OUTSTANDING | M3 | M3-05 | Decisions scattered in HANDOFF/contracts. | No ADR set. | Establish/reconcile ADR record. | ADR audit. |

## Coverage controls

- Authoritative parent commitments: **44**.
- Product parents: **25**.
- Foundation parents: **19**.
- Hierarchical C/F child requirements: **158**.
- Original initiation acceptance children: **20**.
- Total child traceability records: **178**.
- Child traceability coverage: **178 of 178**.
- These 178 records are traceability/detail records, not 178 independent
  scope commitments. `INIT-AC` records may cross-reference underlying C/F
  obligations and do not inflate the authoritative parent count.
- Acceptance children represented: **20 of 20**.
- Original core entity/capability mappings: **complete**.
- Orphan child requirements: **0**.
- Unmapped initiation requirements: **0**.
- Original commitments removed: **0**.
- Original commitments targeted beyond M3: **0**.

These controls must be re-evaluated at every vertical-slice closure. A numeric
check does not replace outcome evidence.

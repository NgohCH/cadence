# Cadence Project Scope Baseline

Baseline version: 1.0
Status: Authoritative
Applies to: M0 through M3 and all future vertical slices

## 1. Authority and purpose

This document is the authoritative source of what Cadence must deliver. The
project-initiation specification is the minimum committed product baseline.
Cadence may become better, broader, easier to use, and easier to operate, but
development must not weaken, omit, or silently remove a baseline commitment.

The living status of each requirement is recorded in
`CADENCE_REQUIREMENT_TRACEABILITY.md`. That register may record implementation
and evidence, but it cannot redefine or reduce this baseline.

By M3 — Production Go-Live, every baseline parent commitment and every child
obligation must be `DELIVERED` or demonstrably `INCORPORATED`. Omission from M1
or M2 changes sequencing only. It does not remove the requirement. No baseline
requirement may be targeted beyond M3.

## 2. Purpose and immutable core product idea

Cadence is an AI-native project collaboration workspace intended to reduce
friction between discussion, decision, and execution. Conversation must become
shared, structured, durable, and traceable project state instead of disappearing
into chat history.

The fundamental object is Project State. Cadence must help authorised users
understand what is happening, what has been decided, what must happen next, who
owns it, what is blocking progress, what changed, and why.

The core idea is immutable unless the project mandate itself is formally
replaced: AI assists and proposes; authorised humans and owning modules retain
authority over consequential project state.

## 3. Source hierarchy

Sources are interpreted from earliest commitment to later implementation
evidence. A later document does not silently supersede an earlier commitment.

1. `docs/Cadence Product and Technical Spec v0.1.docx` — original product,
   architecture, acceptance, security, operational, and handoff commitments.
2. `docs/Cadence v0.1 Database Schema Specification.docx` — original entities,
   integrity model, relationships, history, and security design.
3. `docs/Cadence v0.1 Module Interface Contracts.docx` — original ownership,
   public interface, event, permission, and failure contracts.
4. `docs/Cadence v0.1 API Contract.docx` and
   `api/Cadence_v0.1_openapi.yaml` — original external capability contract.
5. Initial repository baseline, migrations, `README.md`, and Git history.
6. Frozen vertical-slice contracts `docs/vertical-slices/VS-001.md` and
   `docs/vertical-slices/VS-002.md`.
7. `HANDOFF.md`, `CHANGELOG.md`, module READMEs, implementation, migrations,
   and tests — current-state and closure evidence.

Explicitly accepted later commitments may add to the baseline. They cannot
reduce the original baseline. C25 is such an additive frozen commitment from
VS-002 and is labelled accordingly.

Origin is explicit and immutable for governance purposes:

- `INITIATION` means the commitment was made in the original project-initiation
  sources.
- `APPROVED_ADDITION` means the commitment was formally added later and accepted
  into governed Cadence scope. It does not weaken or redefine the initiation
  baseline.

The origin reconciliation is evidence-based: C01-C24 and F01-F19 are supported
by the original initiation material; C25 is supported by the later frozen
VS-002 contract (VS-002 sections 15-28 and AC-04-06) and is therefore the sole
approved additive parent commitment.

## 4. Requirement identity and counting

- `C01`–`C25` are the 25 stable product-capability parent commitments.
- `F01`–`F19` are the 19 stable foundational parent commitments.
- The authoritative parent commitment count is therefore 44.
- Hierarchical IDs such as `C08.2` and `F10.3` preserve independently testable
  obligations within a parent.
- `INIT-AC-01`–`INIT-AC-20` preserve the 20 original v0.1 acceptance criteria.
- Child requirements do not increase the authoritative parent count.
- Every child must map to at least one C/F parent. Orphan children are
  prohibited.

Parent-origin reconciliation:

| Origin | Parent IDs | Count |
|---|---|---:|
| `INITIATION` product | C01-C24 | 24 |
| `INITIATION` foundation | F01-F19 | 19 |
| `APPROVED_ADDITION` | C25 | 1 |
| Initiation parent commitments | C01-C24, F01-F19 | 43 |
| Approved additive parent commitments | C25 | 1 |
| Total governed parent commitments | C01-C25, F01-F19 | 44 |

The 44 parent commitments are the authoritative scope count. Hierarchical
children and `INIT-AC` records preserve traceability and independently
testable obligations; they are not additional parent commitments.

## 5. Status definitions

| Status | Meaning |
|---|---|
| DELIVERED | Implemented sufficiently to satisfy the intended outcome, with evidence. |
| INCORPORATED | A broader implemented capability satisfies the full intended outcome, with explicit mapping and closure evidence. |
| PARTIAL | Some implementation exists, but the original outcome is not fully satisfied. |
| OUTSTANDING | The intended outcome is not materially implemented. |
| FOUNDATIONAL — ACTIVE | The architectural/security principle is established and governing current work. |
| AT RISK | A foundational commitment is weakened, contradicted, or lacks required operational proof. |

`DROPPED`, `REMOVED`, and `UNNECESSARY` are not valid baseline statuses.

## 6. Product capability parent commitments

| ID | Original commitment and intended outcome | Initiation source | Child requirement IDs | M3 rule |
|---|---|---|---|---|
| C01 | Create a project and initialise a usable, governed project context. | Product Spec §§4, 46–47; API contract project creation | C01.1–C01.3; INIT-AC-01 | Must be delivered/incorporated by M3. |
| C02 | Manage project lifecycle through Draft, Active, On Hold, Completed, and Cancelled while preserving completed/archived history. | Product Spec §§6, 23, 47 | C02.1–C02.2 | Must be delivered/incorporated by M3. |
| C03 | Provide the Project Workspace as the primary role-sensitive view of project condition, responsibilities, urgent issues, and shared Project State. | Product Spec §§1, 4–5, 46 | C03.1–C03.4 | Must be delivered/incorporated by M3. |
| C04 | Make lifecycle, health, progress, alerts, blockers, and milestone condition visible and understandable. | Product Spec §§5–8, 15, 23 | C04.1–C04.4; INIT-AC-11–13 | Must be delivered/incorporated by M3. |
| C05 | Support users participating in multiple projects with project-specific roles, access, and navigation. | Product Spec §§20–22; VS-002 AC-02 | C05.1–C05.2 | Must be delivered/incorporated by M3. |
| C06 | Provide User/Person/authentication identity, pilot authentication, and production Entra ID without coupling project authority to the login provider. | Product Spec §§20, 22, 30–31, 45; initial README; VS-002 identity contract | C06.1–C06.5 | Must be delivered/incorporated by M3. |
| C07 | Provide project membership, project-scoped roles, explicit permissions, protected responsibility, and backend-enforced RBAC. | Product Spec §§20–21, 45, 47; VS-002 | C07.1–C07.5; INIT-AC-02 | Must remain delivered and active. |
| C08 | Provide native, durable project Discussion as organisational context and the source of project/AI actions. | Product Spec §§1, 9, 46–47 | C08.1–C08.4; INIT-AC-03 | Must be delivered/incorporated by M3. |
| C09 | Provide Discussion collaboration features: project rooms, replies/threads, mentions, attachments, reactions, timestamps, read status, project search, and AI hooks. | Product Spec §9 | C09.1–C09.8 | Must be delivered/incorporated by M3. |
| C10 | Permit message editing without losing original content, revisions, actors, timestamps, attachments, replies, or resulting state changes. | Product Spec §10; Acceptance §47 | C10.1–C10.3; INIT-AC-05 | Must be delivered/incorporated by M3. |
| C11 | Upload, view, download, associate, and audit basic project files. | Product Spec §16; Acceptance §47 | C11.1–C11.4; INIT-AC-04 | Must be delivered/incorporated by M3. |
| C12 | Track open Topics, their discussion history, alternatives, proposals, links, outcomes, and rationale. | Product Spec §§11, 23, 47 | C12.1–C12.4; INIT-AC-08 | Must be delivered/incorporated by M3. |
| C13 | Track Decisions with ownership, status, approval, rationale, revision history, and source conversations. | Product Spec §§12, 23, 47 | C13.1–C13.5; INIT-AC-07, INIT-AC-16 | Must be delivered/incorporated by M3. |
| C14 | Create and manage Tasks with ownership, creator, due date, status, priority, relationships, provenance, and timestamps. | Product Spec §§8, 13, 23, 47 | C14.1–C14.6; INIT-AC-06, INIT-AC-12 | Must be delivered/incorporated by M3. |
| C15 | Identify, own, prioritise, link, track, and resolve Blockers. | Product Spec §§5, 14, 23, 47 | C15.1–C15.4; INIT-AC-09 | Must be delivered/incorporated by M3. |
| C16 | Manage Milestones, target/completion dates, status, owners, linked work, and slippage. | Product Spec §§6, 15, 23, 47 | C16.1–C16.4; INIT-AC-10 | Must be delivered/incorporated by M3. |
| C17 | Provide one shared Team Agent that can summarise, extract, recall, identify blockers, and suggest next steps. | Product Spec §§17, 24, 43, 46–47 | C17.1–C17.5; INIT-AC-14 | Must be delivered/incorporated by M3. |
| C18 | Use structured AI proposals, application validation, and authorised human confirm/edit/reject before consequential state changes. | Product Spec §§18–19, 45–47 | C18.1–C18.4; INIT-AC-15 | Must remain delivered for existing flow and expand with new AI actions. |
| C19 | Preserve AI run, prompt version, input/source, output, human decision, and resulting entity provenance. | Product Spec §§26, 32–34, 45 | C19.1–C19.4 | Must remain delivered for existing flow and expand with new AI actions. |
| C20 | Provide meaningful sparse project alerts, user-specific alerts, and notifications generated from authoritative changes. | Product Spec §§7, 24, 27, 47 | C20.1–C20.4; INIT-AC-13 | Must be delivered/incorporated by M3. |
| C21 | Provide human and AI Activity/Audit history separate from software change history and reconstruct actions, actors, reasons, state, source, and time. | Product Spec §§4–5, 10, 32–35, 47 | C21.1–C21.5; INIT-AC-17 | Must be delivered/incorporated by M3. |
| C22 | Search project information and preserve project-search capability across relevant project content. | Product Spec §§9, 47 | C22.1–C22.2; INIT-AC-18 | Must be delivered/incorporated by M3. |
| C23 | Export essential project information under explicit permission. | Product Spec §§21, 47 | C23.1–C23.2; INIT-AC-19 | Must be delivered/incorporated by M3. |
| C24 | Provide the essential role-sensitive Project State dashboard/reporting outcome described by the Workspace; enterprise analytics remains an explicit non-goal. | Product Spec §§3, 5, 24 | C24.1–C24.2 | Must be delivered/incorporated by M3. |
| C25 | Support internal and external participants, including external Project Managers, without coupling membership to identity provider or organisational hierarchy. | `APPROVED_ADDITION` — additive frozen VS-002 §§15–28, AC-04–06 | C25.1–C25.4 | Must remain delivered where implemented and complete onboarding by M3. |

## 7. Product child requirements

The following child requirements are independently testable. They refine, but
do not replace, their parent commitments.

| Parent | Child requirements |
|---|---|
| C01 | **C01.1** create a project through an authorised product/operator contract; **C01.2** initialise required health/state atomically; **C01.3** establish initial accountable leadership and access. |
| C02 | **C02.1** support all five original lifecycle states; **C02.2** preserve completed/cancelled/archive history and enforce appropriate read-only behaviour. |
| C03 | **C03.1** Workspace is the primary UI; **C03.2** show project condition; **C03.3** show the user’s responsibilities; **C03.4** show urgent issues and recent activity. |
| C04 | **C04.1** lifecycle and health are distinct; **C04.2** health uses accessible labels as well as colour; **C04.3** progress/blockers/next milestone are visible; **C04.4** history of health changes is preserved. |
| C05 | **C05.1** one Person may belong to multiple projects; **C05.2** users can discover/navigate authorised projects and hold different roles per project. |
| C06 | **C06.1** pilot authentication; **C06.2** stable Person identity; **C06.3** replaceable authentication identities; **C06.4** production Entra SSO/MFA/lifecycle; **C06.5** authentication replacement does not redesign project permissions. |
| C07 | **C07.1** membership determines access; **C07.2** role/permissions determine authority; **C07.3** permissions are server-authoritative; **C07.4** platform admin is not automatically a project reader; **C07.5** protected roles and membership history remain auditable. |
| C08 | **C08.1** project rooms/messages; **C08.2** persisted conversations reload after return; **C08.3** authorised members see committed messages, including realtime/update behaviour; **C08.4** Discussion emits AI/event hooks without synchronous coupling. |
| C09 | **C09.1** replies/threads; **C09.2** mentions; **C09.3** message attachments; **C09.4** reactions; **C09.5** timestamps; **C09.6** read status; **C09.7** project Discussion search; **C09.8** AI event hooks. |
| C10 | **C10.1** edit messages; **C10.2** append immutable versions; **C10.3** retain actor, timestamp, original/revised content, links, replies, attachments, and derived-state traceability. |
| C11 | **C11.1** upload; **C11.2** view/download; **C11.3** associate files with project entities/context; **C11.4** preserve file activity/provenance. |
| C12 | **C12.1** Exploring/Proposed/Decided/Deferred states; **C12.2** discussion and alternatives; **C12.3** linked messages/proposals; **C12.4** final decision and rationale. |
| C13 | **C13.1** decision identity/status/owner/date; **C13.2** human/AI creator and approver; **C13.3** source messages; **C13.4** revision/supersession history; **C13.5** rationale and “why” navigation. |
| C14 | **C14.1** create human/AI-sourced Tasks; **C14.2** assign owner; **C14.3** manage Open/In Progress/Completed/Cancelled; **C14.4** due date and priority; **C14.5** link decision/blocker/source message; **C14.6** personal pending and overdue visibility. |
| C15 | **C15.1** blocker identity/description/owner/severity/status; **C15.2** link Tasks/Milestones; **C15.3** source provenance; **C15.4** resolution and opened/resolved dates. |
| C16 | **C16.1** milestone identity/owner/dates; **C16.2** original milestone states; **C16.3** linked Tasks/Blockers; **C16.4** slippage informs but remains distinct from health. |
| C17 | **C17.1** summarise; **C17.2** extract Tasks/Decisions/Blockers/Topics; **C17.3** recall reasoning; **C17.4** identify impediments; **C17.5** suggest next steps. |
| C18 | **C18.1** structured proposals; **C18.2** application validation; **C18.3** authorised confirm/edit/reject; **C18.4** autonomous high-impact action remains prohibited. |
| C19 | **C19.1** AI run identity/provider abstraction; **C19.2** prompt version and input/source; **C19.3** output/proposal and human decision; **C19.4** resulting entity and full lineage. |
| C20 | **C20.1** information/warning/critical alerts; **C20.2** user-specific alerts; **C20.3** sparse/meaningful presentation; **C20.4** notification delivery from events. |
| C21 | **C21.1** software change history; **C21.2** operational append-oriented audit; **C21.3** actor/role/action/before/after/source/time; **C21.4** general Activity view; **C21.5** cross-module journey reconstruction. |
| C22 | **C22.1** project information search; **C22.2** permission-aware results across implemented content types. |
| C23 | **C23.1** export essential project information; **C23.2** enforce `project.export` and preserve export audit. |
| C24 | **C24.1** role-sensitive Project State dashboard; **C24.2** essential project reporting without expanding into the original enterprise-analytics non-goal. |
| C25 | **C25.1** internal participant; **C25.2** external participant; **C25.3** external Project Manager with internal accountability; **C25.4** production external identity onboarding/provider independence. |

## 8. Foundational parent commitments

| ID | Original commitment and intended outcome | Initiation source | Child requirement IDs | M3 rule |
|---|---|---|---|---|
| F01 | Modular monolith with strongly separated modules and future extraction allowance. | Product Spec §§24, 40, 48–49 | F01.1–F01.2 | Must remain active through M3. |
| F02 | Explicit, published, versioned interfaces and events. | Product Spec §§25, 28, 48 | F02.1–F02.2 | Must remain active through M3. |
| F03 | Module data ownership and no direct cross-module persistence manipulation. | Product Spec §§25–26, 48 | F03.1–F03.2 | Must remain active through M3. |
| F04 | PostgreSQL/Supabase is authoritative; schema changes are versioned migrations. | Product Spec §§26, 29, 36, 49; initial README | F04.1–F04.3 | Must remain active through M3. |
| F05 | Project-scoped RBAC; roles bundle permissions, permissions are authoritative. | Product Spec §§20–21, 45, 49 | F05.1–F05.3 | Must remain active through M3. |
| F06 | Authentication and authorisation remain separate and replaceable. | Product Spec §§22, 45, 49 | F06.1–F06.2 | Must remain active through M3. |
| F07 | Least privilege, project isolation, safe defaults, and no universal admin project access. | Product Spec §§20, 30, 45 | F07.1–F07.3 | Must remain active through M3. |
| F08 | Browser/UI is not authoritative; backend and database boundaries validate permissions. | Product Spec §§21, 25–26, 45; initial README | F08.1–F08.3 | Must remain active through M3. |
| F09 | Significant message, audit, health, membership, and role history is immutable or append-oriented. | Product Spec §§10, 32, 45, 49; initial schema | F09.1–F09.3 | Must remain active through M3. |
| F10 | Important changes emit versioned domain events through a retryable transactional-outbox model. | Product Spec §§27–28; initial README | F10.1–F10.3 | Must remain active through M3. |
| F11 | AI proposes through owning module contracts and cannot directly alter authoritative state. | Product Spec §§18–19, 25, 45, 49 | F11.1–F11.3 | Must remain active through M3. |
| F12 | Material operations preserve correlation, causation, source, and AI provenance. | Product Spec §§32–35, 45, 48 | F12.1–F12.3 | Must remain active through M3. |
| F13 | Secrets, environments, accounts, and production data are separated and safely configured. | Product Spec §§29–31, 45; initial README | F13.1–F13.4 | Must remain active through M3. |
| F14 | Experimental/optional capabilities are controllable and one optional module failure does not collapse unrelated functions. | Product Spec §§27, 37, 47 | F14.1–F14.3; INIT-AC-20 | Must remain active through M3. |
| F15 | Every module has unit, interface/contract, permission, integration, and regression evidence; critical failure blocks deployment. | Product Spec §38 | F15.1–F15.3 | Must remain active through M3. |
| F16 | Engineering is readable, documented, maintainable, and transferable without original-developer dependency. | Product Spec §§30, 40–43, 48–49 | F16.1–F16.4 | Must remain active through M3. |
| F17 | Deployment is reproducible, controlled, promotable through Development/Staging/Production, and transferable to institutional ownership. | Product Spec §§29–31, 43, 45, 49 | F17.1–F17.4 | Must be fully active and evidenced by M3. |
| F18 | Backup, restore, rollback/forward correction, resilience, monitoring, and emergency recovery are defined and tested. | Product Spec §§29, 43, 45; initial README production caution | F18.1–F18.4 | Must be fully active and evidenced by M3. |
| F19 | Material software/schema/configuration/AI/operational change is traceable through Git, CHANGELOG, migrations, semantic versions, ADRs, and release evidence. | Product Spec §§28, 32, 35–36, 39, 44, 48 | F19.1–F19.5 | Must be fully active and evidenced by M3. |

## 9. Foundational child requirements

| Parent | Child requirements |
|---|---|
| F01 | **F01.1** one deployable modular monolith; **F01.2** boundaries permit later extraction without premature microservices. |
| F02 | **F02.1** documented public interfaces; **F02.2** incompatible contracts/events introduce a new version. |
| F03 | **F03.1** modules own authoritative data and rules; **F03.2** consumers use contracts/events, never another module’s persistence. |
| F04 | **F04.1** PostgreSQL authoritative; **F04.2** every structural change is a committed migration; **F04.3** no manual production schema changes. |
| F05 | **F05.1** memberships scope access; **F05.2** permissions, not role names, authorise operations; **F05.3** roles may differ by project. |
| F06 | **F06.1** authentication proves identity, authorisation decides access; **F06.2** provider replacement leaves membership/permission logic intact. |
| F07 | **F07.1** least privilege; **F07.2** project isolation; **F07.3** platform administration does not imply confidential project access. |
| F08 | **F08.1** mutations pass through owning backend contracts; **F08.2** server validates permissions; **F08.3** database/RLS provides defence in depth. |
| F09 | **F09.1** message revisions preserve history; **F09.2** audit and health history are append-oriented; **F09.3** membership/role provenance is retained. |
| F10 | **F10.1** material changes emit events; **F10.2** transactional fan-out/outbox avoids partial coupling; **F10.3** consumers retry independently. |
| F11 | **F11.1** AI cannot write owning tables directly; **F11.2** owning modules revalidate; **F11.3** consequential AI action requires authorised human approval. |
| F12 | **F12.1** correlation and causation; **F12.2** source links; **F12.3** reconstruct complete cross-request journeys without rewriting truthful request history. |
| F13 | **F13.1** no committed/hard-coded secrets; **F13.2** server keys stay server-side; **F13.3** environment/target guards; **F13.4** experimental and production data/account ownership are separated. |
| F14 | **F14.1** feature flags/control for experimental capabilities; **F14.2** optional modules can be disabled; **F14.3** one optional consumer failure does not block unrelated core work. |
| F15 | **F15.1** unit/contract/permission coverage; **F15.2** integration/regression coverage; **F15.3** critical test failure blocks release. |
| F16 | **F16.1** readable code and explicit dependencies; **F16.2** module README contents; **F16.3** complete HANDOFF; **F16.4** unfamiliar engineer passes ownership/handoff test. |
| F17 | **F17.1** reproducible frontend/API/worker deployment; **F17.2** Development/Staging/Production separation; **F17.3** controlled promotion/rollback; **F17.4** institutional account and service ownership. |
| F18 | **F18.1** backup/PITR; **F18.2** tested restore; **F18.3** monitored/supervised recovery and retry; **F18.4** documented incident/emergency ownership. |
| F19 | **F19.1** Git/CHANGELOG traceability; **F19.2** migration/release traceability; **F19.3** prompt/AI change traceability; **F19.4** semantic versioning; **F19.5** ADRs for major architectural decisions. |

## 10. Original v0.1 acceptance criteria

These are child requirements and are not included again in the 44-parent count.

| ID | Original acceptance criterion | Parent mapping | Intended outcome | Source |
|---|---|---|---|---|
| INIT-AC-01 | Create a project. | C01 | Authorised creation produces a usable governed project. | Product Spec §47 item 1 |
| INIT-AC-02 | Assign project members and RBAC roles. | C07 | Users receive project-specific access and authority. | §47 item 2 |
| INIT-AC-03 | Hold project discussions. | C08 | Authorised collaboration is durable project context. | §47 item 3 |
| INIT-AC-04 | Upload files. | C11 | Files can enter and remain linked to project context. | §47 item 4 |
| INIT-AC-05 | Edit messages without losing history. | C10, F09 | Editing preserves immutable revision history. | §47 item 5 |
| INIT-AC-06 | Create and manage tasks. | C14 | Tasks move through a useful owned lifecycle. | §47 item 6 |
| INIT-AC-07 | Track decisions. | C13 | Decisions, approval, rationale, and sources remain visible. | §47 item 7 |
| INIT-AC-08 | Track open topics. | C12 | Unresolved matters and their reasoning are explicit. | §47 item 8 |
| INIT-AC-09 | Identify blockers. | C15 | Impediments are visible, owned, linked, and resolved. | §47 item 9 |
| INIT-AC-10 | Manage milestones. | C16 | Delivery checkpoints and slippage are managed. | §47 item 10 |
| INIT-AC-11 | See project lifecycle and health. | C02, C04 | Lifecycle and execution condition are understandable. | §47 item 11 |
| INIT-AC-12 | See personal pending-task counts. | C14 | Users can identify their current workload quickly. | §47 item 12 |
| INIT-AC-13 | Receive meaningful project alerts. | C20 | Important conditions are surfaced without notification fatigue. | §47 item 13 |
| INIT-AC-14 | Use Team Agent to identify project-state changes. | C17 | AI converts conversation into explainable proposed structure. | §47 item 14 |
| INIT-AC-15 | Confirm or reject AI proposals. | C18 | Human authority controls consequential AI outcomes. | §47 item 15 |
| INIT-AC-16 | Trace decisions back to source conversations. | C13, C19, C21 | “Why” navigation reaches original evidence. | §47 item 16 |
| INIT-AC-17 | View human and AI activity history. | C21 | Operational history is visible and reconstructable. | §47 item 17 |
| INIT-AC-18 | Search project information. | C22 | Authorised users can retrieve project knowledge. | §47 item 18 |
| INIT-AC-19 | Export essential project information. | C23 | Essential state can be exported under permission. | §47 item 19 |
| INIT-AC-20 | Operate without one optional module failure bringing down unrelated functions. | F14 | Optional-module failure is contained. | §47 item 20 |

## 11. Original core entity/capability traceability

| Original core entity/capability | Baseline mapping |
|---|---|
| User / Person / authentication identity | C06 |
| Project | C01, C02, C03 |
| ProjectMembership / Role / Permission | C07, F05 |
| Message / MessageVersion / Thread | C08, C09, C10 |
| Topic | C12 |
| Decision | C13 |
| Task | C14 |
| Blocker | C15 |
| Milestone | C16 |
| File | C11 |
| AIProposal / AIRun / prompt version | C17, C18, C19 |
| Alert / Notification | C20 |
| AuditEvent / Activity | C21, F09, F12 |
| Project Health / history | C04, F09 |
| Domain event / idempotency / source and entity links | F10, F12 |
| Project Workspace / Project State | C03, C24 |

Original core entities/capabilities unmapped: **0**.

## 12. M3 completeness rule

Every governed parent commitment is `DELIVERED` or demonstrably
`INCORPORATED`, and every applicable child traceability record has closure
evidence demonstrating satisfaction of its underlying obligation.

For a foundational parent, `FOUNDATIONAL — ACTIVE` is the evidence-backed
architectural outcome that permits the parent to reach a final `DELIVERED` or
`INCORPORATED` disposition.

M3 may close only when:

1. all 44 governed parent commitments, comprising 43 `INITIATION` parents and
   1 `APPROVED_ADDITION`, satisfy the rule above;
2. every applicable child obligation and `INIT-AC` record has closure evidence;
3. no child is orphaned;
4. no baseline requirement is targeted beyond M3;
5. all incorporation decisions prove the full original intended outcome;
6. production identity, security, privacy, deployment, resilience, backup,
   recovery, monitoring, governance, support, and ownership gates pass; and
7. original commitments removed = 0 and unmapped initiation requirements = 0.

## 13. Explicit exclusions

Original non-goals are not baseline deliverables unless later formally added:
formal document control/classification, retention and sensitivity labelling,
complex workflow design, personal/specialist agents, autonomous high-impact AI,
enterprise-system integrations, enterprise analytics beyond essential Project
State reporting, conferencing, Slack/Teams parity, native mobile, and premature
microservices. They may enter M4+ only as genuine additions.

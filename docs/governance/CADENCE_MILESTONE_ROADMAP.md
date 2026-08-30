# Cadence Milestone Roadmap

Roadmap version: 1.0
Scope authority: `CADENCE_PROJECT_SCOPE_BASELINE.md`
Status authority: `CADENCE_REQUIREMENT_TRACEABILITY.md`

This roadmap controls delivery sequence, not whether a baseline commitment is
required. No date is assigned here. No initiation requirement may move beyond
M3.

## M0 — Foundation

### Purpose

Establish the core architecture, security-by-design, identity, authorisation,
auditability, and Cadence orchestration needed for later capabilities.

M0 currently comprises the closed VS-001 and VS-002 contracts plus the active
foundational commitments they established.

### Entry conditions

- Accepted project-initiation product and technical specification.
- Migration and module-boundary baseline.
- Frozen VS-001 and VS-002 contracts for their respective work.

### Required baseline capabilities

- C07 project membership/RBAC.
- C18 structured AI proposal and human-review path for the implemented Task
  journey.
- C19 AI provenance for the implemented Task journey.
- Partial foundations for C03, C05, C06, C08, C14, C17, C21, and C25.
- F01–F16 active and governing.

### Allowed temporary workarounds

- Fixed/configured project ID for development verification.
- Operator-created identities, projects, and fixtures.
- One-shot worker invocation.
- Manual/live verification where automated integration coverage is not yet
  available.

These are M0 execution allowances, not removal of later commitments.

### Exit criteria and evidence

- VS-001 and VS-002 frozen acceptance, security, regression, migration, and
  runtime closure gates pass.
- Project isolation and backend authorisation are verified.
- Discussion → proposal → human review → Task → Audit behavior remains intact.
- Stable Person, membership lifecycle, role succession, and Audit behavior are
  verified.
- Foundational P0/P1 issues within the frozen contracts are zero.

### Still mandatory after M0

Every partial/outstanding C requirement and F17–F19 remains mandatory no later
than M3. M0 closure does not represent completion of the initiation baseline.

## M1 — Controlled Pilot

### Purpose

Permit a small controlled group to use Cadence on real projects with explicit
operator support. Operator-assisted setup is acceptable; repeated developer
intervention in normal workflow is not.

### Entry conditions

- M0 closure evidence remains valid.
- Pilot environment and data classification are approved.
- Named pilot operator and support owner exist.
- A recovery baseline exists before real project data is introduced.

### Required baseline capabilities

- Stable deployed frontend and API.
- Scheduled/supervised worker execution adequate for pilot volume.
- Repeatable pilot project and account preparation.
- Initial Owner/Manager/Sponsor and ordinary members established.
- Durable Discussion reload so users can leave and return with context.
- Working proposal review, Task materialisation, My Tasks, Members, and Task
  Audit journey.
- Pilot logging, failure inspection, support, backup, and recovery runbook.

### Allowed temporary workarounds

- Operator-assisted project creation and account provisioning.
- One or a small number of preselected projects.
- Manual operator remediation for known low-frequency delivery conflicts.
- Documented external onboarding performed by an operator.
- Narrow Task lifecycle, provided pilot purpose and limitations are explicit.

Direct ad hoc SQL manipulation, developer fixture repair for routine use, and
manual worker invocation for every message are not acceptable normal pilot
operations.

### Exit criteria and evidence

- Five to ten real users complete a rehearsed multi-user journey.
- User login → project access → Discussion → worker → proposal review → Task →
  Audit succeeds without developer repair.
- Users can return later and recover visible collaboration context.
- Access denial, read-only roles, membership changes, and external participant
  scenarios remain secure.
- Pilot deployment, backup, restore/recovery, support, and failure procedures
  have named owners and one recorded rehearsal.
- Pilot observations and incidents are recorded as evidence for M2.

### Still mandatory after M1

All original project entities, acceptance criteria, self-service capabilities,
enterprise identity, production operations, and M3 completeness requirements
remain mandatory even when unnecessary for the controlled pilot.

## M2 — MVP

### Purpose

Make Cadence a coherent self-service internal product with minimal developer or
operator intervention for normal use.

### Entry conditions

- M1 controlled pilot completed with documented evidence and lessons.
- Pilot safety and reliability issues required for normal use are resolved.
- MVP scope reconciles every affected baseline ID.

### Required baseline capabilities

- C01 project creation and initial accountable leadership.
- C03 coherent Project Workspace and normal navigation.
- C05 project discovery and multi-project use.
- C06 normal account/member onboarding for the selected internal identity
  model.
- C08 durable persistent collaboration context.
- C14 useful Task lifecycle, including status/completion and ownership.
- Reliable background processing with no routine developer intervention.
- Permission-aware empty/error states and supportable user recovery.
- M2 evidence sufficient to define production security, governance, capacity,
  and operational controls.

### Allowed temporary workarounds

- Administrative approval for project creation.
- Operator support for exceptional account recovery or protected-role conflict.
- Some original M3 capabilities may remain absent if they are clearly mapped,
  funded in the roadmap, and not needed for coherent MVP use.

Normal project access, navigation, Discussion recovery, Task completion, and
background processing may not depend on developer intervention.

### Exit criteria and evidence

- Authorised users can create/access projects, onboard members, collaborate,
  manage useful work, and return with context intact.
- Multi-project navigation and role-sensitive behavior pass acceptance tests.
- Operational staff, not developers, can perform routine administration.
- MVP use provides evidence for production identity, availability, monitoring,
  governance, privacy, support, and resilience requirements.
- Every baseline requirement still incomplete has an explicit M3 closure slice
  and evidence plan.

### Still mandatory after M2

Files, full Discussion capability, Topics, Decisions, Blockers, Milestones,
complete Agent abilities, notifications, general Activity/Audit, search,
export, essential reporting, enterprise identity, and all production
foundations remain mandatory by M3 unless already delivered or incorporated.

## M3 — Production Go-Live

### Purpose

Deliver the complete committed Cadence product and prove it can be operated
safely, securely, resiliently, and independently in institutional production.

### Entry conditions

- M2 coherent self-service product evidence is accepted.
- Production environment, data governance, identity, security, operational,
  and support owners are named.
- Traceability contains no orphan or unmapped requirement.

### Required baseline capabilities

- All C01–C25 parent outcomes and all product children.
- All INIT-AC-01–INIT-AC-20 acceptance criteria.
- F01–F19 fully active and evidenced.
- Entra ID/SSO/MFA/account lifecycle or demonstrably equivalent incorporated
  production identity outcome.
- Development/Staging/Production promotion and institutional ownership.
- Monitoring, logs, worker supervision, alerting, backup/PITR, tested restore,
  correction/rollback procedure, incident response, and support ownership.
- Security, privacy, project isolation, governance, release, ADR, handoff, and
  maintainability evidence.

### Allowed temporary workarounds

No workaround may leave an original initiation outcome unsatisfied. A limited
operational procedure is acceptable only when it is safe, support-owned,
tested, documented, and satisfies the full intended outcome.

### Exit criteria and evidence

- Every governed parent commitment is `DELIVERED` or demonstrably
  `INCORPORATED`, and every applicable child traceability record has closure
  evidence demonstrating satisfaction of its underlying obligation.
- The governed parent total is 44: 43 `INITIATION` parents and 1
  `APPROVED_ADDITION` parent. Foundational `FOUNDATIONAL — ACTIVE` evidence
  must support the final `DELIVERED` or `INCORPORATED` disposition.
- Parent commitments: 44 of 44 closed under the rule above.
- Child traceability records: 178 of 178 have evidence for their underlying
  obligations; this is separate from the parent commitment count.
- Initiation acceptance criteria: 20 of 20 closed.
- Core entity/capability mappings: complete.
- Unmapped initiation requirements: 0.
- Orphan child requirements: 0.
- Original commitments removed: 0.
- Original commitments targeted beyond M3: 0.
- Every `INCORPORATED` status has explicit outcome-equivalence evidence.
- Production security, migration, deployment, resilience, recovery, support,
  and handoff gates pass.

### Still mandatory after M3

Delivered/incorporated outcomes remain regression-protected. Go-live does not
authorise later weakening of the baseline.

## M4+ — Live Product Evolution

### Purpose

Add genuinely post-initiation capabilities and improvements informed by live
usage, scale, new integrations, or new institutional needs.

### Entry conditions

- M3 hard gate is closed.
- Proposed work is proven to be new rather than an uncompleted initiation
  requirement.
- Baseline regression and foundational integrity remain protected.

### Eligible capabilities

Examples include personal or specialist agents, complex workflow design,
native mobile, conferencing, enterprise-system integrations, advanced
enterprise analytics, advanced document classification/retention, temporary
leadership delegation, resource-capacity management, and other capabilities
not committed at initiation.

### Prohibited classification

No C, F, hierarchical child, or INIT-AC requirement may be moved to M4+.

### Exit criteria and evidence

- The enhancement/evolution has an approved change-control classification.
- It does not weaken a baseline outcome.
- Its vertical slice identifies affected baseline IDs and all new M4+ IDs.
- Regression and production governance evidence pass.

## Milestone dependency summary

```text
M0 foundation and frozen slices
  -> M1 controlled real-user evidence
      -> M2 self-service product evidence
          -> M3 complete baseline + production hard gate
              -> M4+ post-initiation evolution
```

Parallel work is allowed inside a milestone when dependencies are explicit.
Milestone evidence must feed the next milestone; it does not rewrite the scope
baseline.

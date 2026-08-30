# M1 — Controlled Pilot

Milestone contract version: 1.0
Scope Baseline: [`CADENCE_PROJECT_SCOPE_BASELINE.md`](../governance/CADENCE_PROJECT_SCOPE_BASELINE.md) v1.0
Status: Active
Milestone: M1 — Controlled Pilot

## Purpose

M1 proves that Cadence can support a small controlled group on one real
project with explicit operator support, stable operation, durable
collaboration context, and no repeated developer intervention during normal
workflow.

M1 is not MVP. It controls delivery sequence, not total committed scope.
Every governed baseline commitment remains due no later than M3 unless it is
demonstrably delivered or incorporated earlier.

## M1 Work Entry Gate

M1 engineering may begin when all of the following are true:

- M0 governance closure is accepted.
- VS-001 and VS-002 remain closed, with no concrete frozen-contract violation.
- This M1 contract and the VS003–VS006 boundaries are approved.
- The default pilot assumption is accepted: 5–10 named internal users, one
  real project, and Owner, Manager, Sponsor, and ordinary Member roles.
- Observer/Auditor permission scenarios are identified where useful for
  rehearsal.
- Pilot environment, hosting, backup, and bootstrap decisions are understood
  well enough to design the M1 slices. The final hosting target remains a
  VS005 design decision; backup technology remains a VS006 design decision.
- No new work is being used to weaken, remove, or move a governed commitment
  beyond M3.

The following are M1 deliverables and Pilot Activation prerequisites. They are
not prerequisites for beginning M1 engineering:

- stable frontend and API URLs;
- prepared users, Persons, project, and memberships;
- valid Owner, Manager, and Sponsor assignments;
- scheduled and supervised worker execution;
- backup and successful isolated restore;
- support ownership and escalation procedure;
- pilot runbook; and
- completed multi-user rehearsal.

## Pilot Activation / Go-Live Gate

No real project content or live pilot user operation begins until the Pilot
Activation Gate passes. Empty pilot account, Person, project, and membership
preparation may occur earlier under controlled procedures.

The activation gate is defined in [Pilot Activation Gate](#pilot-activation-gate).

## In-scope pilot

- 5–10 named internal users.
- One real project.
- Operator-assisted preparation.
- Owner, Manager, Sponsor, and ordinary Member participation.
- Observer and Auditor permission scenarios where appropriate.
- The existing Discussion → proposal → review → Task → My Tasks → Audit
  journey.
- Durable Discussion reload and deterministic manual refresh.
- Controlled worker scheduling and operational support.

External participation is optional and outside the default M1 pilot scope.
C25 remains governed and mandatory by M3; C25.1–C25.3 are not mandatory VS004
scope for the default internal pilot.

## Required M1 capability mapping

| Capability | Baseline IDs | M1 boundary |
|---|---|---|
| Durable Discussion read/reload | C08, C08.1, C08.2, INIT-AC-03 | VS003 is expected to provide the read, reload, return, and manual-refresh path. The status remains evidence-based until implementation closes. |
| Deterministic cross-user visibility | C08.3 | VS003 advances C08.3 partially through explicit refresh/shared visibility. Realtime or automatic convergence remains due M2. |
| Existing Discussion write and event behavior | C08.4 | Existing delivered behavior is regression protected; VS003 must not change VS001 POST/event flow. |
| Proposal review and Task materialisation | C14, C18, C19 | Existing VS-001 behavior is exercised in the deployed pilot; no new Task lifecycle is required by M1. |
| My Tasks and Task Audit | C03.3, C14, C21, INIT-AC-12, INIT-AC-15, INIT-AC-17 | Existing read-side and Audit paths are exercised end-to-end. Full Task lifecycle and general Activity remain later scope. |
| Controlled account and project preparation | C01.1, C01.3, C06.1–C06.3, C07 | VS004 provides a repeatable operator procedure. It does not close self-service creation or discovery commitments. |
| Deployment and environment safety | F13.3, F17.1, F17.3 | VS005 establishes the pilot deployment/process boundary; M3 retains full promotion and institutional ownership. |
| Worker scheduling and supervision | F10.3, F18.3 | VS005 provides supervised pilot execution adequate for pilot volume. |
| Pilot backup and restore | F18.1, pilot subset of F18.2 | VS006 selects suitable technology and proves an isolated restore. Full production PITR and resilience remain M3 requirements. |
| Support and incident ownership | F16.3, F18.4 | VS006 names the operator/support owner and records the pilot escalation procedure. |

## Allowed temporary workarounds

- Operator-created users, Persons, project, and memberships.
- One preselected project.
- Operator-established Owner, Manager, and Sponsor assignments.
- Manual Discussion, proposal, and Task refresh.
- Controlled operator remediation for exceptional, low-frequency conflicts.
- A scheduled one-shot worker invocation, provided scheduling and supervision
  are reliable enough for the pilot and every failure is inspectable.
- Provider-managed or otherwise suitable backup technology, provided an
  isolated restore succeeds.
- Documented operator-led account recovery.
- Operator-led external onboarding only if an optional external scenario is
  explicitly added to the pilot plan.

## Prohibited workarounds

- Manual worker invocation for every message.
- Developer repair of routine project or Task state.
- Direct ad hoc SQL during normal pilot workflow.
- Browser-side business-table access.
- Bypassing backend authorization or module boundaries.
- Running the pilot from a developer workstation as the operating model.
- Starting live user operation before the Pilot Activation Gate.

## Pilot Activation Gate

The gate is a go/no-go decision before real project content or live pilot
operation. All conditions must pass:

- Frontend is deployed at a stable pilot URL.
- API is deployed at a stable pilot URL.
- HTTPS, CORS, environment targets, and secret placement are verified.
- Supabase migration state is current and verified against the target.
- Pilot users have authenticated identities and Cadence Person mappings.
- One real project exists and its membership records are valid.
- Owner, Manager, Sponsor, and ordinary Member assignments are valid.
- Observer/Auditor accounts or permission scenarios are available where
  required by the pilot plan.
- Discussion initial load, page reload, return, retry, and manual cross-user
  refresh pass.
- Worker execution is scheduled and supervised.
- Proposal review → Task materialisation → My Tasks → Audit passes.
- Logs and failure inspection are available to the support owner.
- A usable backup exists and an isolated restore succeeds.
- Recovery, escalation, and correction instructions are available.
- Pilot operator and support owner are named.
- No known activation P0 or P1 issue remains.

## Dependency map

```text
M1 Work Entry Gate
        │
        ├───────────────┐
        ↓               ↓
VS003 Discussion   VS004 Bootstrap/Access
        │               │
        └───────┬───────┘
                ↓
       VS005 Runtime and Worker
                ↓
       VS006 Operations, Recovery
       and Support
                ↓
       Pilot Activation Gate
                ↓
       Real pilot operation
                ↓
       M1 rehearsal and closure gate
```

VS003 and VS004 may proceed in parallel after the M1 Work Entry Gate. VS005
owns the hosting target and worker scheduling design. VS006 owns the backup
technology choice, restore proof, support ownership, and recovery procedure.
No real project content or live pilot user operation begins until the Pilot
Activation Gate passes. No separate M1 closure vertical slice is created.

## Pilot user rehearsal

After activation, 5–10 named internal users use one real project. The default
scenario includes Owner, Manager, Sponsor, and ordinary Member roles, with
Observer/Auditor permission scenarios where applicable.

The rehearsal must demonstrate:

1. authenticate;
2. access the configured project;
3. load persisted Discussion;
4. post a message;
5. have a second authorised browser session see it after explicit refresh;
6. leave, reload or sign out, return, and recover Discussion context;
7. allow the worker to process the message;
8. review a proposal where authorised;
9. materialise a Task;
10. inspect My Tasks;
11. inspect the resulting Task Audit journey;
12. inspect Members and exercise read-only/permission-denial behavior; and
13. confirm project isolation and backend authorization in the relevant role
    scenarios.

The pilot does not require project discovery, self-service project creation,
full Task lifecycle management, realtime Discussion, Entra identity,
external-user participation, Files, Topics, Decisions, Blockers, Milestones,
or full M3 operations. Their exclusion from M1 changes sequence only; those
baseline commitments remain due under M2 or M3 as recorded in the baseline and
traceability register.

## Operational rehearsal

The pilot operator/support owner must demonstrate:

- deployment from the documented process;
- API health and frontend/API connectivity;
- scheduled worker execution and supervision;
- inspection of a worker failure or retry condition;
- correlation/request identifiers sufficient for failure tracing;
- backup capture;
- restore into an isolated target;
- recovery and correction/rollback instructions; and
- escalation without developer intervention.

## M1 closure gate

M1 closes only after the activated pilot produces evidence. The milestone gate
is separate from individual VS003–VS006 closure gates.

| Evidence category | Required evidence |
|---|---|
| Automated acceptance | API, authorization, isolation, Discussion, proposal, Task, and Audit regression evidence. |
| Runtime smoke | Stable URLs, health, migrations, worker schedule, event processing, and restore evidence. |
| Browser/user rehearsal | Two authenticated sessions, Discussion load/refresh/reload/return, role behavior, and the complete Discussion → proposal → review → Task → My Tasks → Audit journey. |
| Operational rehearsal | Logs, failure inspection, backup, isolated restore, escalation, and support-owner execution. |
| Governance/documentation | Updated traceability, pilot findings, M2 backlog, runbook, ownership record, and closure reconciliation. |

M1 exit requires all of the following:

- 5–10 named internal users complete the rehearsed journey on one real
  project.
- No routine step requires developer intervention.
- Users can leave and later return with durable Discussion context.
- Role and project-isolation scenarios pass.
- Worker scheduling, supervision, and failure inspection are demonstrated.
- Backup and isolated restore succeed.
- Support ownership and escalation are exercised.
- Pilot findings and M2 lessons are recorded.
- The following reconciliation remains true:

```text
Original commitments removed: 0
Original commitments moved beyond M3: 0
Unmapped M1 work: 0
```

## Baseline commitments deliberately not completed by M1

The following remain mandatory and are not removed by this milestone.

### Due M2

- C01 project creation and initial accountable leadership.
- C03 coherent Project Workspace and normal navigation.
- C05 project discovery and multi-project use.
- C06 normal internal account/member onboarding for the selected identity
  model.
- C08 full durable collaboration outcome, including the remaining C08.3
  automatic/realtime convergence boundary.
- C14 useful Task lifecycle beyond the narrow pilot path.
- normal user recovery and background processing without developer
  intervention.

### Due M3

- C09–C13 and C15–C17 remaining product outcomes.
- C20–C25 remaining product outcomes, including C25.4 production external
  onboarding.
- full C21 Activity/Audit, C22 search, C23 export, and C24 reporting.
- Entra SSO/MFA/account lifecycle or demonstrably equivalent production
  identity outcome.
- F17 production deployment separation, promotion, rollback, and institutional
  ownership.
- F18 production backup/PITR, tested restore, resilience, monitoring,
  incident, and emergency recovery.
- F19 complete release, semantic-version, ADR, and governance traceability.
- all remaining product children and all 20 INIT-AC records.

## M1 scope protection

M1 controls sequence, not total Cadence scope. The Scope Baseline remains the
authority for committed outcomes, and the Requirement Traceability Register
remains the canonical status/evidence ledger. No M1 document may mark C08.1,
C08.2, or INIT-AC-03 delivered merely because this contract exists.

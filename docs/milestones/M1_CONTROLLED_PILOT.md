# M1 — Controlled Pilot

Milestone contract version: 1.1
Scope Baseline: [`CADENCE_PROJECT_SCOPE_BASELINE.md`](../governance/CADENCE_PROJECT_SCOPE_BASELINE.md) v1.0
Status: Active; sequencing revision 1.1 effective only upon merge of its enactment PR
Milestone: M1 — Controlled Pilot

## Sponsor-approved sequencing revision

Sponsor **NgohCH** explicitly **APPROVED** and authorised enactment on
**14 October 2026** ([decision evidence](https://github.com/NgohCH/cadence/pull/12#issuecomment-6167888761)).
The [decision record](../governance/CADENCE_V1_0_M1_SEQUENCE_SPONSOR_DECISION.md)
pins the unchanged proposal at source commit
`1058a0d96385a26630c5a9193dca6cffd4027458`, Git blob
`f0f21db5e0f4312c3163d6b728f916f6977e9e0a`, SHA-256
`679efe3c0db8e13fa9c1fc26e5039d23ff842ce99028b89db38fff274de9940a`.

For the frozen v1.8.0 pathway, the packet successors below replace the
VS005 -> VS006 -> VS007 execution dependencies. This revision takes effect
**only when its governance enactment PR is merged**; approval is recorded,
but an unmerged branch does not replace main's governing contract.
Historical slice contracts and worktrees remain retained, without completion,
acceptance, deployment or successful pilot claims.

The frozen 68-packet definitions and dependencies remain unchanged.
CAD-WP-001/002 formal acceptance remains pending. Legal/IP ownership and the
HELP written licence remain unresolved; draft terms and proprietary metadata
are not legal authority or an executed grant. CAD-WP-003 cannot be dispatched
until CAD-WP-001 and CAD-WP-002 satisfy their frozen formal acceptance
requirements. Institutional signing remains a separate live-deployment gate.

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
- This M1 contract and its sponsor-approved frozen V1.0 successor sequencing
  are governing after the enactment merge; VS003/VS004 closure remains protected.
- Each packet is dispatched only after its own frozen dependencies are
  formally accepted; this milestone gate does not waive packet acceptance.
- The default pilot assumption is accepted: 5–10 named internal users, one
  real project, and Owner, Manager, Sponsor, and ordinary Member roles.
- Observer/Auditor permission scenarios are identified where useful for
  rehearsal.
- Pilot environment, hosting, backup, and bootstrap decisions are understood
  well enough to design eligible M1 packets. CAD-WP-008 owns the bounded
  hosting-route decision; CAD-WP-052 owns independent application-data restore
  proof within the frozen operating pathway.
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
| Deployment and environment safety | F13.3, F17.1, F17.3 | CAD-WP-008 owns the bounded hosting route; CAD-WP-009–016 own runtime, configuration, hosted web/API, rollback and release identity. M3 retains full promotion and institutional ownership. |
| Worker scheduling and supervision | F10.3, F18.3 | CAD-WP-010/011/014 own independent worker, durable retry/restart and hosted supervision evidence adequate for pilot volume. |
| Pilot backup and restore | F18.1, pilot subset of F18.2 | CAD-WP-052 proves independent application-data restore into an isolated target. The source archive is not restore evidence. Full production PITR and resilience remain M3 requirements. |
| Support and incident ownership | F16.3, F18.4 | CAD-WP-051 owns support, incident and recovery instructions; CAD-WP-067 owns configurable primary/backup operators without implicit project access. |
| Configured federated identity | C06.1–C06.3, C07, F06, F07 | CAD-WP-063/064 own OAuth, stable Person mapping and tenant/revocation safeguards; authentication never grants project membership. Existing delivered outcomes remain regression protected. |
| Controlled rehearsal, activation and real use | C08, C14, C18, C19, C21; F10–F13, F16–F19 | CAD-WP-049 is synthetic pre-activation rehearsal; CAD-WP-053 is sponsor GO/NO-GO; CAD-WP-054 is the five-working-day real-user pilot. Acceptance evidence is still required. |
| Real AI before V1.0 release | C17, C18, C19; F11, F12 | CAD-WP-017–023/065 and real-user CAD-WP-055 UAT remain mandatory; CAD-WP-057/058 retain separate release decisions. |

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

This map implements the approved execution substitution, not new packet
dependencies or dispatch permission. The immutable
[68-packet register](../governance/CADENCE_V1_0_FROZEN_PACKET_REGISTER_v1_8_0.json)
remains authoritative for all direct and transitive prerequisites.

```text
M1 Work Entry Gate + formally accepted CAD-WP-001/002
  -> eligible foundation/interface/baseline packets
  -> CAD-WP-008 hosting route; CAD-WP-009–016 runtime/configuration
     + CAD-WP-063/064 identity + CAD-WP-067 operators
  -> CAD-WP-049 controlled synthetic pre-activation rehearsal
     + CAD-WP-051 support + CAD-WP-052 independent isolated restore
     + accepted CAD-WP-063/064/067 and all transitive prerequisites
  -> CAD-WP-053 sponsor Pilot Activation GO/NO-GO
  -> CAD-WP-054 five-working-day real-user pilot
  -> original M1 closure evidence and acceptance

Separate mandatory V1.0 real AI/UAT and release gates:
CAD-WP-017–023/065 + CAD-WP-055 -> CAD-WP-057 -> CAD-WP-058
```

CAD-WP-053's frozen direct dependencies are **CAD-WP-049, 051, 052, 063,
064 and 067**. All transitive prerequisites and every original Pilot Activation
condition above must pass. Zero activation P0/P1, support ownership, usable
backup, successful independent isolated restore and controlled rehearsal are
mandatory. No real project content or live operation begins before GO.
CAD-WP-053 alone is not M1 closure; neither CI nor this governance merge is GO.

VS003/VS004 remain historical accepted foundations; their behavior and
permission boundaries must be preserved by the eligible baseline packets.
No separate M1 closure vertical slice or new numbered packet is created.

## Controlled pre-activation rehearsal

CAD-WP-049 runs two authorised sessions using **synthetic/non-live content**
before CAD-WP-053. It covers sign-in, project access, durable Discussion,
refresh/reload/return, automatic worker, proposal review, Task creation,
My Tasks, Audit, read-only roles, access denial and project isolation.
The existing deterministic development proposer is permitted only when
explicitly labelled **deterministic**; this is not evidence of real AI.
An unsuccessful rehearsal or missing restore/support/identity evidence blocks
GO; no live content is used to obtain pre-activation evidence.

## Pilot user rehearsal

After CAD-WP-053 GO, CAD-WP-054 records **five working days** of controlled
real use by 5–10 named internal users on one real project without routine
developer intervention. The default scenario includes Owner, Manager, Sponsor,
and ordinary Member roles, with Observer/Auditor permission scenarios where
applicable. Synthetic CAD-WP-049 evidence does not substitute for this use.

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
full Task lifecycle management, realtime Discussion, full production enterprise
identity/lifecycle, external-user participation, Files, Topics, Decisions,
Blockers, Milestones,
or full M3 operations. Their exclusion from M1 changes sequence only; those
baseline commitments remain due under M2 or M3 as recorded in the baseline and
traceability register. Configured federated sign-in and stable Person/tenant/
revocation safeguards through CAD-WP-063/064 are nevertheless mandatory for
this frozen V1.0 pilot pathway; HELP selects tenant-restricted Entra sign-in.
This does not declare full M3 production identity conformity.

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

M1 closes only after the activated CAD-WP-054 pilot produces its five-working-day
real-user evidence. The milestone gate remains separate from individual packet
acceptance and CAD-WP-053 GO. All original evidence categories and exit criteria
below remain mandatory.

| Evidence category | Required evidence |
|---|---|
| Automated acceptance | API, authorization, isolation, Discussion, proposal, Task, and Audit regression evidence. |
| Runtime smoke | Stable URLs, health, migrations, worker schedule, event processing, and restore evidence. |
| Browser/user rehearsal | Two authenticated sessions, Discussion load/refresh/reload/return, role behavior, and the complete Discussion → proposal → review → Task → My Tasks → Audit journey. |
| Operational rehearsal | Logs, failure inspection, backup, isolated restore, escalation, and support-owner execution. |
| Governance/documentation | Updated traceability, pilot findings, M2 backlog, runbook, ownership record, and closure reconciliation. |

M1 exit requires all of the following:

- 5–10 named internal users complete the rehearsed journey on one real
  project during five working days of controlled real use (CAD-WP-054).
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

## Sequencing reconciliation

Previous milestone / current milestone: **M1 / M1**. The sponsor-approved
sequence substitutes existing frozen packets for VS005/VS006/VS007 execution,
without changing any requirement's completion status or milestone assignment.
Original activation and closure outcomes, protected permission/history/module
boundaries, all M3 commitments and the 17 November 2026 V1.0 release target
remain unchanged. No commitment is incorporated by assertion.

Real LLM acceptance through CAD-WP-017–023/065 and CAD-WP-055 remains mandatory
before V1.0 release, independently of labelled deterministic M1 evidence.
CAD-WP-057/058 retain their separate release GO gates.

Baseline status transitions: **None**.
Original commitments removed / moved beyond M3: **0 / 0**.
New numbered packets / application changes: **0 / 0**.

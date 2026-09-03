# Cadence Architectural Design Horizons

Status: Deferred architectural considerations
Baseline authority: None
Requirement-count effect: None
Milestone effect: None unless separately approved through Change Control

This document records architectural directions that Cadence should preserve for
future design work without silently turning them into committed product scope.

A design horizon is not a governed C/F requirement, does not change the Scope
Baseline, does not change the Requirement Traceability Register, and does not
create a delivery commitment by itself.

A design horizon may be promoted into governed scope only through explicit
Change Control, requirement and milestone assignment, an owning vertical-slice
contract, and applicable implementation and closure evidence.

## DH-001 — Progressive Project Formalisation and Complex Governance

Recorded: 2026-09-03
Status: DEFERRED / NOT BASELINED
Current implementation impact: None
Current milestone impact: None
VS005 scope impact: None

### Intent

Cadence must remain architecturally capable of supporting a Project that begins
with minimal structure and progressively becomes more formal and complex.

A Project may begin as a single-person discovery or exploratory initiative and
later acquire sponsorship, management, members, external participants,
organisational scope, governance bodies, workstreams, vendors, geographic
scope, and other controls without losing its canonical Project identity or
historical lineage.

Complexity is progressive and optional. Cadence must support simple Projects
without forcing governance structures that they do not need merely because the
platform is capable of supporting them.

Conceptually:

minimal discovery
  -> one Person / one idea
  -> minimal formal structure

formal project
  -> Sponsor / Owner / Manager as required
  -> internal and external members
  -> governed delivery and reporting

complex initiative
  -> multiple organisations or legal entities
  -> multiple geographies
  -> vendors and external advisers
  -> Executive Sponsor / Co-Sponsor structures
  -> Steering Committee and other governance bodies
  -> workstreams, sub-structures, and cross-project dependencies

### Stable Project identity and lineage

Progressive formalisation should evolve the same canonical Project rather than
requiring creation of a replacement Project merely because governance becomes
more sophisticated.

Early discussions, decisions, membership, responsibility changes, provenance,
and later governance history should remain reconstructable as one Project
lineage.

Future lifecycle or project-class rules may require stronger controls as a
Project matures, but those controls must not rewrite or erase earlier history.

### Protected responsibility roles

The existing protected responsibility roles remain:

- PROJECT_OWNER
- PROJECT_SPONSOR
- PROJECT_MANAGER

The current singleton invariant means at most one effective holder for each
protected role within a Project.

It does not require Owner, Sponsor and Manager to be held by three different
Persons.

A single Person may therefore hold more than one protected responsibility role
unless a future project type, risk rule, or governance policy explicitly
requires separation of duties.

Any future separation-of-duties rule should be policy-driven rather than
encoded as a universal assumption.

### Future governance positions

Future complex Projects may require formal positions such as:

- Executive Sponsor
- Co-Sponsor
- Steering Committee Chair
- Steering Committee Member
- advisory-board or working-group positions
- other project-scoped governance appointments

These positions should not casually weaken or duplicate the canonical
PROJECT_SPONSOR accountability model.

The preferred future direction is to distinguish:

Project Membership
  -> who formally participates in the Project

Authorization
  -> what that Person is permitted to do

Governance Appointment
  -> what formal governance position that Person holds

A governance title must not automatically imply Sponsor, Owner, Manager, or
other mutation/approval authority unless an approved authorization policy
explicitly maps that position to bounded permissions.

Formal governance participants should normally remain grounded in the same
canonical Person and Project Membership architecture used by other internal
and external participants.

### Multi-organisation and geographic growth

Future Cadence design must not assume that a Project is a flat team belonging
to one organisation, legal entity, department, vendor, or geography.

The architecture should remain compatible with Projects involving:

- multiple internal departments
- multiple companies or legal entities
- internal and external delivery teams
- external Project Managers
- multiple vendors
- advisers or auditors
- regional or multi-country participation
- shared or layered governance structures

Internal/external affiliation must remain distinct from Project authority.

Canonical Person identity, Project Membership, explicit authorization, and
truthful historical provenance remain the underlying foundations.

### Current invariants preserved

DH-001 does not change any current VS002/R03 invariant.

In particular:

- stable Person remains the canonical authorization identity;
- Project Membership remains project-scoped;
- authorization remains explicit and server-side;
- protected Owner, Sponsor and Manager roles retain their current singleton
  and historical-transfer semantics;
- frozen legacy membership fields remain non-authoritative historical or
  compatibility data; and
- browser business data remains API-bound.

### Explicit non-commitments

Recording DH-001 does not:

- add a Cxx or Fxx parent requirement;
- change the governed parent count of 44;
- change the governed child-record count of 178;
- change an existing Requirement Traceability status;
- reopen VS002 or R03;
- commit Executive Sponsor, Co-Sponsor, Steering Committee, programme,
  multi-entity, or multi-geography functionality to M1;
- change the VS005 contract or scope; or
- authorize implementation without a future governed design decision.

### Promotion path

If a future milestone needs a DH-001 capability, the owning work must first:

1. identify the concrete business outcome and applicable baseline IDs;
2. determine its Change Control treatment;
3. add or update governed requirement records only where explicitly approved;
4. assign the capability to a milestone without weakening existing M0-M3
   commitments;
5. freeze the owning vertical-slice contract and relevant invariants;
6. implement with migration, security, audit, history and compatibility
   evidence where applicable; and
7. close through normal Baseline Closure Reconciliation.

Until that promotion occurs, DH-001 remains a recorded architectural horizon,
not an implementation commitment.

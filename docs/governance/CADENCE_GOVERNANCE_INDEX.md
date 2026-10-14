# Cadence Governance Index

This directory governs what Cadence must deliver, when it must be complete,
how status is evidenced, and how future changes are controlled.

Read in this order before planning or changing a vertical slice:

1. [Project Scope Baseline](CADENCE_PROJECT_SCOPE_BASELINE.md) — authoritative
   committed scope and intended outcomes.
2. [Milestone Roadmap](CADENCE_MILESTONE_ROADMAP.md) — M0–M4+ sequencing and
   milestone gates.
3. [Applicable Milestone Contract](../milestones/M1_CONTROLLED_PILOT.md) — the
   current milestone's approved contract and gates.
4. [Requirement Traceability](CADENCE_REQUIREMENT_TRACEABILITY.md) — canonical
   current status, implementation, evidence, gap, and closure ledger.
5. [Change Control](CADENCE_CHANGE_CONTROL.md) — enhancement, evolution,
   incorporation, deferral, and vertical-slice governance rules.
6. [Architectural Design Horizons](CADENCE_ARCHITECTURAL_DESIGN_HORIZONS.md)
   — deferred architectural directions that future designs must consider but
   that do not alter governed scope until promoted through Change Control.
7. The current applicable vertical-slice contract.
8. `HANDOFF.md` — current execution state and engineering handoff.

Authority rule: the Scope Baseline defines what Cadence must deliver. The
Traceability Register records where it stands. The Milestone Roadmap sequences
delivery. Change Control governs change. Architectural Design Horizons inform
future architecture but do not redefine the Scope Baseline, Traceability
Register, Milestone Roadmap, or Change Control. `HANDOFF.md` records current
execution state and does not redefine, reduce, or supersede committed project
scope.

No governed baseline requirement may be moved beyond M3. Every future vertical
slice must identify the baseline IDs it advances and update traceability at
closure.

## Frozen V1.0 execution reconciliation

The merged [v1.8.0 execution contract](CADENCE_V1_0_FROZEN_EXECUTION_CONTRACT_v1_8_0.md)
and [68-packet register](CADENCE_V1_0_FROZEN_PACKET_REGISTER_v1_8_0.json) remain
unchanged. Read the [CAD-WP-002 reconciliation](CADENCE_V1_0_CAD_WP_002_VS005_RECONCILIATION.md)
and [commit inventory](CADENCE_V1_0_CAD_WP_002_VS005_COMMIT_INVENTORY.json) for
the retained VS005 work and selective successor routes.

The unchanged [M1 sequence proposal](CADENCE_V1_0_M1_SEQUENCE_AMENDMENT_PROPOSAL.md)
has **SPONSOR APPROVAL RECORDED**, with exact pins and decision evidence in the
[M1 decision record](CADENCE_V1_0_M1_SEQUENCE_SPONSOR_DECISION.md).
[M1 contract v1.1](../milestones/M1_CONTROLLED_PILOT.md) enacts the frozen packet
successor sequence **only upon enactment PR merge**. Approval/merge neither
closes VS005 requirements, accepts CAD-WP-001/002 nor activates the pilot.
The Scope Baseline remains authoritative; the prior main M1 contract governs
until merge.

## Dependency-clearance review documents

- [Draft copyright and HELP academic licence](../legal/CADENCE_COPYRIGHT_AND_LICENCE.md).
- [Exact-source M1 sponsor decision record](CADENCE_V1_0_M1_SEQUENCE_SPONSOR_DECISION.md).
- [CAD-WP-001/002 acceptance evidence checklist](CADENCE_V1_0_DEPENDENCY_ACCEPTANCE_CHECKLIST.md).

Legal/IP authority, institutional execution, sponsor sequencing approval,
enactment and formal packet acceptance remain distinct. Sponsor approval and
enactment authority are recorded; enactment is effective only upon PR merge.
Legal/IP, the HELP written licence and CAD-WP-001/002 formal acceptance remain
unresolved. The 68 frozen packet definitions/dependencies remain unchanged.

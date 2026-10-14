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

The [M1 sequence amendment](CADENCE_V1_0_M1_SEQUENCE_AMENDMENT_PROPOSAL.md) is
**PROPOSED — NOT APPROVED OR APPLIED**. The Owner's decision to stop selecting
VS005 does not close its requirements, accept CAD-WP-001/002, approve the
amendment or activate the pilot. The Scope Baseline and existing M1 contract
retain their authority pending explicit governance disposition.

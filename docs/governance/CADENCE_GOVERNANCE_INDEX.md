# Cadence Governance Index

This directory governs what Cadence must deliver, when it must be complete,
how status is evidenced, and how future changes are controlled.

Read in this order before planning or changing a vertical slice:

1. [Project Scope Baseline](CADENCE_PROJECT_SCOPE_BASELINE.md) — authoritative
   committed scope and intended outcomes.
2. [Milestone Roadmap](CADENCE_MILESTONE_ROADMAP.md) — M0–M4+ sequencing and
   milestone gates.
3. [Requirement Traceability](CADENCE_REQUIREMENT_TRACEABILITY.md) — canonical
   current status, implementation, evidence, gap, and closure ledger.
4. [Change Control](CADENCE_CHANGE_CONTROL.md) — enhancement, evolution,
   incorporation, deferral, and vertical-slice governance rules.
5. The current applicable vertical-slice contract.
6. `HANDOFF.md` — current execution state and engineering handoff.

Authority rule: the Scope Baseline defines what Cadence must deliver. The
Traceability Register records where it stands. The Milestone Roadmap sequences
delivery. Change Control governs change. `HANDOFF.md` records current execution
state and does not redefine, reduce, or supersede committed project scope.

No governed baseline requirement may be moved beyond M3. Every future vertical slice
must identify the baseline IDs it advances and update traceability at closure.

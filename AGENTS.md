Cadence Engineering Rules

1. Read docs/governance/CADENCE_GOVERNANCE_INDEX.md and
   docs/governance/CADENCE_PROJECT_SCOPE_BASELINE.md before planning a new
   vertical slice.
2. Read HANDOFF.md before making architectural changes.
3. Read the applicable vertical-slice contract.
4. Never silently remove, weaken, or omit an original initiation commitment.
5. Every new vertical slice must identify the baseline C/F parent and child
   requirement IDs it advances.
6. Every vertical-slice closure must update
   docs/governance/CADENCE_REQUIREMENT_TRACEABILITY.md.
7. Original commitments take precedence over discretionary enhancements.
8. Foundational security and architecture commitments may not be weakened.
9. No governed baseline requirement, including an approved addition, may be
   moved beyond M3.
10. Scope incorporation requires explicit intended-outcome equivalence and
    closure evidence under CADENCE_CHANGE_CONTROL.md.
11. Respect module boundaries.
12. Do not access another module's persistence directly.
13. Prefer published service/repository contracts.
14. Every behavior change requires appropriate tests.
15. Preserve VS-001 behavior.
16. Do not modify .env or commit secrets.
17. Do not introduce dependencies without justification.
18. Keep code readable and handoff-ready.
19. Update CHANGELOG.md, HANDOFF.md and module documentation
    when required by the checkpoint.
20. Do not implement functionality outside the active vertical
    slice/checkpoint.
21. Stop when the requested checkpoint is complete.

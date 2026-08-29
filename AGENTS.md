Cadence Engineering Rules

1. Read HANDOFF.md before making architectural changes.
2. Read the applicable vertical-slice contract.
3. Respect module boundaries.
4. Do not access another module's persistence directly.
5. Prefer published service/repository contracts.
6. Every behavior change requires appropriate tests.
7. Preserve VS-001 behavior.
8. Do not modify .env or commit secrets.
9. Do not introduce dependencies without justification.
10. Keep code readable and handoff-ready.
11. Update CHANGELOG.md, HANDOFF.md and module documentation
    when required by the checkpoint.
12. Do not implement functionality outside the active vertical
    slice/checkpoint.
13. Stop when the requested checkpoint is complete.
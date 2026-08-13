# Projects Module

## Ownership

The Projects module owns authoritative project state.

This includes:

- project identity,
- project metadata,
- project membership relationships,
- Project Workspace read models.

The Projects module does not own:

- discussion messages,
- tasks,
- blockers,
- milestones,
- alerts,
- Project Health state,
- AI proposals.

Those capabilities remain owned by their respective modules.

The Project Workspace may aggregate information from those modules for reading without taking ownership of their authoritative state.

---

## Boundary Rules

Other modules may reference a project but must not directly modify authoritative project state.

Project access must respect server-side RBAC permissions.

The Projects module must not invent its own interpretation of role names.

Authorization decisions use permission codes resolved through the RBAC module.

For VS001-03, Project Workspace access requires:

```text
project.view
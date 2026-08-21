# Projects Module

## Ownership

The Projects module owns authoritative project state.

This includes:

- project identity,
- project metadata,
- Project Workspace read models.

The Projects module does not own:

- project membership relationships,
- project-role assignments,
- discussion messages,
- tasks,
- blockers,
- milestones,
- alerts,
- Project Health state,
- AI proposals.

Those capabilities remain owned by their respective modules.

The Project Workspace may aggregate information from those modules for reading without taking ownership of their authoritative state.

VS002-02 assigns project membership lifecycle, membership duration, and
project-role assignment concepts to the dedicated Project Membership module.
Projects owns Project identity and lifecycle state; it must not independently
interpret membership persistence or authentication-provider data.

The new `public.project_role_assignments` table is not read or written by
Projects. Its `project_id` is referential integrity only; Project Membership
remains the persistence owner.

---

## Boundary Rules

Other modules may reference a project but must not directly modify authoritative project state.

Project access must respect server-side RBAC permissions.

The Projects module must not invent its own interpretation of role names.

Authorization decisions use permission codes resolved through the RBAC module.

The existing VS-001 RBAC/persistence path remains active until later VS-002
checkpoints introduce and integrate the frozen Project Authorisation boundary.
VS002-02 does not change runtime project access behaviour.

For VS001-03, Project Workspace access requires:

```text
project.view

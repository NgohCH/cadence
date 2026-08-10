# Projects Module

## Ownership

The Projects module owns authoritative project state.

This includes:

- project identity
- project metadata
- project membership relationships
- Project Workspace read models

## Boundary Rules

Other modules may reference a project but must not directly modify authoritative project state.

Project access must respect RBAC permissions.

The Projects module does not own discussion messages, tasks or AI proposals.
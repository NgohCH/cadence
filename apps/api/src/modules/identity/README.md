# Identity Module

## Ownership

The Identity module owns Cadence user identity resolution.

This includes:

- resolving an authenticated identity to a Cadence user
- maintaining the relationship between identity providers and Cadence users
- providing the current-user identity used by protected operations

## Boundary Rules

Authentication and Cadence authorization are separate concerns.

The Identity module establishes who the user is.

It does not decide what the user is allowed to do inside a project.

Project permissions are owned by the RBAC module.

Cadence v0.1 may use local authentication.

The identity boundary must allow local authentication to be replaced by Microsoft Entra ID without changing project-role or permission logic.
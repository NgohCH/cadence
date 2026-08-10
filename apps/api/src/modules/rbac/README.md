# RBAC Module

## Ownership

The RBAC module owns Cadence authorization decisions.

This includes:

- project roles
- permissions
- role-to-permission relationships
- project membership authorization
- permission checks for protected operations

## Boundary Rules

RBAC answers whether an authenticated Cadence user may perform an operation.

RBAC does not authenticate users.

Authentication identity is provided by the Identity module.

Business modules must not invent their own authorization rules.

Protected operations must perform server-side permission checks.
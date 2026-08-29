# RBAC Module (Retired Compatibility Boundary)

## Current Status

R02 retired the VS-001 RBAC application service and Supabase repository after
truthful legacy role reconciliation and the cross-module cutover to
`ProjectAuthorisationService`. The remaining zero-length TypeScript files keep
historical module paths visible during the staged cleanup; they publish no
runtime contract and must not receive new consumers.

Project authorization now follows:

```text
authenticated Cadence Person
  -> ProjectAuthorisationService
  -> effective stable Person membership
  -> effective frozen project role assignments
  -> permission codes
```

Discussion, Projects, Tasks, Team Agent, Audit, member management, API
composition, and worker composition use that published boundary. Database RPCs
own persistence integrity only and do not independently decide project
permissions. Browser roles have no direct authority over the Cadence public
business schema.

## R03 Membership-Schema Retirement

R03A did not drop the retained membership compatibility columns. It froze
historical `user_id`, `role_id`, `joined_at`, and `created_by` values and
rejected new legacy-shaped rows. R03B has now made canonical `effective_from`
and `membership_status` independently persisted domain fields, moved admission
and lifecycle helpers to them, and frozen legacy `status` as well.

All five compatibility columns remain present. R03B removes dependencies, not
columns; physical removal remains reserved for separately accepted R03D work.

R03C now makes canonical overlap, role-period containment, ordinary-role
coverage, and protected transfer-ledger consistency database invariants. The
service role remains the trusted persistence boundary, but direct DML is still
subject to these constraints and triggers; browser roles retain no mutation
authority.

Required sequence:

```text
R03A retain and freeze
R03B decouple canonical membership fields
R03C prove database/application retirement and soak
R03D separately approve destructive column removal
```

Historical migrations and tests may still describe the VS-001 RBAC shape.
They are migration history, not current authorization guidance. Do not restore
`RbacService`, direct `project_memberships.user_id`/`role_id` interpretation,
role-name checks in consuming modules, browser RLS authorization, or direct
cross-module membership persistence reads.

## Current Boundary Rules

1. Authentication establishes identity; it does not grant project access.
2. Stable Person membership and frozen role history are authoritative.
3. Consuming modules check permission codes through
   `ProjectAuthorisationService`.
4. Client-supplied User or Person IDs never replace authenticated request
   context for actor authority.
5. Business modules preserve their established not-found/permission-denied
   response semantics.
6. Project Membership remains the sole owner of membership and role-assignment
   persistence.
7. Historical membership and role records are retained; cleanup must follow
   the accepted R03 gates.

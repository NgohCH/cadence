# Project Membership Module

## VS002-01 Ownership

The Project Membership module owns the domain concepts for an authorised
relationship between a stable Cadence Person and a Project.

VS002-01 introduces domain foundations only:

- `ProjectMembership` for the Person-to-Project relationship;
- open-ended and time-bounded membership periods;
- `ProjectRoleAssignment` as a concept separate from membership;
- the frozen six-role VS-002 vocabulary;
- protected-responsibility-role classification;
- Observer/Auditor read-only classification; and
- pure, explicit membership-effectiveness evaluation.

It does not introduce persistence, repositories, API routes, permission
evaluation, role transfer, expiry processing, events, or frontend behaviour.

## Domain Boundary

Project Membership depends on stable `personId` and `projectId` references.
It does not depend on:

- email address;
- login identifier;
- authentication provider;
- provider subject identifier; or
- organisational affiliation.

Authentication establishes who a Person is. Membership establishes whether
that Person has an authorised relationship with a Project. Role assignment
describes responsibility or authority within that relationship. Later
permission enforcement will remain a separate Project Authorisation concern.

Organisational affiliation never creates a membership and never changes role
meaning. In particular, an `EXTERNAL` Person can hold `PROJECT_MANAGER`.

## Membership and Role Separation

`ProjectMembership` deliberately contains no `role` or permission fields.

`ProjectRoleAssignment` refers to a membership and carries one role from the
frozen vocabulary:

```text
PROJECT_SPONSOR
PROJECT_OWNER
PROJECT_MANAGER
PROJECT_MEMBER
PROJECT_OBSERVER
PROJECT_AUDITOR
```

There is no `TEMPORARY_PROJECT_MEMBER`. Duration answers how long a Person may
participate; role answers what responsibility or authority the Person holds.

The protected responsibility roles are:

```text
PROJECT_SPONSOR
PROJECT_OWNER
PROJECT_MANAGER
```

Role-transfer behaviour is not implemented in VS002-01.

`PROJECT_OBSERVER` and `PROJECT_AUDITOR` are classified as read-only concepts.
The backend permission rules that enforce read-only access are deferred to
VS002-03.

## Membership Effectiveness

Call `isProjectMembershipEffectiveAt(membership, evaluatedAt)` with an explicit
timestamp. Core domain logic does not call `Date.now()`.

Membership uses a half-open interval:

```text
[effectiveFrom, effectiveTo)
```

Therefore:

- `effectiveFrom` is inclusive;
- `effectiveTo` is exclusive; and
- `effectiveTo = null` means open-ended.

This boundary avoids overlap at an exact handover instant. An `ENDED`
membership retains its historical effective interval; ending membership does
not erase past participation.

`createProjectMembership(...)` rejects invalid timestamps, ranges where
`effectiveTo <= effectiveFrom`, and an `ENDED` membership without an
`effectiveTo` timestamp.

## VS-001 Compatibility

VS-001 currently resolves active rows in `public.project_memberships` through
the RBAC repository using `user_id`, one `role_id`, and `active`/`inactive`
status. That path remains unchanged in VS002-01.

The new domain model is not wired to the VS-001 table yet. Mapping stable
Person identity, temporal membership, and role-assignment history into
persistence belongs to VS002-02. Until then, existing VS-001 authorization
continues to use its established RBAC contracts and permission codes.

## Deliberately Deferred

VS002-02 and later checkpoints own:

- schema and migrations;
- membership and role repositories;
- historical role-assignment persistence;
- Project Authorisation and permission decisions;
- member query/add/remove flows;
- expiry workers and events;
- protected-role transfer and responsibility guards;
- membership audit events; and
- Members frontend integration.

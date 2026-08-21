# Project Membership Module

## VS002-03 Project Authorisation

Project Membership now publishes the single project-authorisation decision
boundary:

```text
canAccessProject(context, projectId)
hasProjectPermission(context, projectId, permission)
getEffectiveProjectRoles(personId, projectId)
```

`ProjectAuthorisationService` evaluates the authenticated stable Person's
current `ACTIVE` membership, the membership's half-open effective period, and
effective frozen role assignments. It returns permission-code decisions;
consuming modules must not reproduce frozen-role logic.

All six frozen roles can read ordinary authorised project information.
`PROJECT_OBSERVER` has read permissions only. `PROJECT_AUDITOR` has ordinary
read permissions plus `audit.view`; neither receives create, update, delete,
member-management, or other mutation permissions. Owner, Manager, Member, and
Sponsor follow the frozen baseline in `project-permissions.ts`. Sponsor and
Owner receive protected-transfer permission codes; Manager does not.
Specialised `audit.view` requires effective Auditor authority rather than
being implied by another frozen role.

Authentication provider, login identifier, email, affiliation, department,
and platform-administrator status do not participate in the decision. A new
authentication identity linked to the same Person can use that Person's
current authority; linking the identity creates no membership and restores no
ended membership.

Existing VS-001 role codes remain available through an explicit legacy RBAC
fallback. This is necessary because several legacy roles have no truthful
one-to-one frozen-role mapping. No data mapping is invented.

Project-facing modules continue to call the existing RBAC service until the
controlled VS002-09 integration. VS002-03 adds no member route, transfer,
expiry process, event, RLS browser grant, or frontend control.

## VS002-02 Persistence Ownership

Project Membership owns the authorised stable Person-to-Project relationship
and project-role assignment history. VS002-02 adds durable persistence for the
VS002-01 domain foundations without adding member APIs or authorisation.

## Domain Boundary

Project Membership depends on stable `personId` and `projectId` references. It
does not depend on email, login identifier, authentication provider, provider
subject, or organisational affiliation.

Authentication establishes who a Person is. Membership establishes whether
that Person has an authorised relationship with a Project. Role assignment
describes responsibility or authority within that membership. Affiliation
never creates membership or changes role meaning; an `EXTERNAL` Person may
hold `PROJECT_MANAGER`.

## Membership and Role Separation

`ProjectMembership` contains no role or permission fields.
`ProjectRoleAssignment` carries exactly one frozen role:

```text
PROJECT_SPONSOR
PROJECT_OWNER
PROJECT_MANAGER
PROJECT_MEMBER
PROJECT_OBSERVER
PROJECT_AUDITOR
```

There is no `TEMPORARY_PROJECT_MEMBER`. Duration describes how long
participation is authorised; role describes responsibility or authority.

Sponsor, Owner, and Manager remain protected responsibility roles, but
VS002-03 implements no transfer logic. Observer and Auditor are enforced as
read-only by the VS002-03 Project Authorisation service.

## Membership Effectiveness

Membership intervals are half-open:

```text
[effectiveFrom, effectiveTo)
```

The start is inclusive, the end is exclusive, and null end is open-ended.
`createProjectMembership(...)` rejects invalid timestamps, non-positive
ranges, and `ENDED` membership without an end timestamp. Ending membership
does not erase its historical effective interval.

## Persistence

Project Membership owns both persistence structures:

```text
public.project_memberships
public.project_role_assignments
```

`public.project_memberships` is the evolved VS-001 table, not a duplicate.
VS002-02 adds stable `person_id`, bounded/open-ended dates, a frozen lifecycle
projection, stable-Person grantor provenance, creation time, and optional
termination reason. `effective_from` is generated from retained `joined_at`;
`membership_status` is generated from retained `active`/`inactive` status.

Persisted `ProjectMembership` state permits `grantedBy: null` only for genuine
VS-001 history where nullable `created_by` did not record a grantor. Null means
the historical provenance is unavailable; it is not an anonymous or system
grant. `CreateProjectMembershipInput` requires `grantedBy: string`, and both
domain validation and the database reject new Person-only memberships without
a stable Person grantor.

`public.project_role_assignments` stores role history independently with its
own half-open period, stable-Person assigner, reason, and creation time. A
composite FK guarantees that an assignment's `project_id` matches its
membership project.

`ProjectMembershipRepository` and `SupabaseProjectMembershipRepository`
provide foundational create/read operations only. They do not implement
duplicate handling, lifecycle commands, transfer, expiry, authorisation, or
events. A new VS-002 membership leaves legacy `user_id` and `role_id` null;
persisting it cannot silently activate the current VS-001 RBAC path.

## Database Invariants

The migration enforces:

- stable Person and Project foreign keys;
- positive bounded membership and role-assignment intervals;
- `ENDED` membership requiring an end timestamp;
- the exact frozen six-role vocabulary;
- assignment-to-membership project consistency;
- compatibility user-to-Person consistency and paired legacy user/role fields;
- a stable Person grantor for every new Person-only membership while allowing
  unavailable grantor provenance on VS-001 compatibility rows;
- nonblank optional reasons;
- indexes for Person/project/period and role-history reads;
- one active VS-001 compatibility membership per project/user; and
- no hard deletion of membership or role-assignment history.

No SQL trigger implements protected-role transfer, automatic expiry, or future
authorization policy.

The migration is forward-only. It has no destructive down script; post-apply
corrections must use a reviewed forward migration or an explicit backup/PITR
operational recovery decision.

## VS-001 Compatibility

VS-001 continues to resolve `public.project_memberships.user_id`, `role_id`,
and lowercase `active`/`inactive` status. Those columns and values remain in
place, and the existing RBAC repository/security helpers remain unchanged.

Existing membership rows map through `users.person_id`. `joined_at` supplies
their `effective_from` and missing creation timestamp. An existing `inactive`
row has no explicit end column; `updated_at` is the only recorded lifecycle
boundary, so the migration uses it for `effective_to`, adding one microsecond
only when needed to keep the interval positive. Nullable legacy `created_by`
maps to a stable grantor only through its exact user FK. If `created_by` is
null, `granted_by_person_id` and the persisted model remain null; no member,
administrator, system Person, or other identity is substituted.

Existing role IDs remain authoritative for VS-001. No broad role backfill is
invented: `PROJECT_LEAD`, `CONTRIBUTOR`, `REVIEWER`, and `VIEWER` do not have
exact one-to-one meanings in the frozen vocabulary. Migrating those historical
codes to frozen role assignments remains an explicit later data decision.
Their current permissions and access are preserved unchanged.

## Security

`public.project_role_assignments` has RLS enabled and no browser grants in this
checkpoint. The existing `memberships_select_project_member` policy is
recreated under the same name so authenticated direct reads can see only rows
with the complete VS-001 compatibility shape (`user_id` and `role_id` both
non-null) after the existing project-membership check passes. Person-only
VS-002 rows therefore remain server-side. Service-role repository access is
unchanged. Authoritative VS002-03 decisions are server-side; no browser
mutation grant or membership route is added here.

## Deliberately Deferred

Later checkpoints own:

- member query/add/update/remove flows;
- duplicate-membership application behaviour;
- protected-role transfer and responsibility guards;
- expiry workers and events;
- membership Audit projection;
- Tasks integration;
- Members frontend integration; and
- cross-module adoption of the Project Authorisation service.

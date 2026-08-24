# Project Membership Module

## VS002-05 Role Management HTTP Contract

Immediate ordinary role changes and protected responsibility operations use:

```text
PATCH /api/v1/projects/:projectId/members/:membershipId
POST  /api/v1/projects/:projectId/role-transfers
```

The PATCH body accepts `role` and optional `reason`. The protected POST body
accepts `role`, `new_membership_id`, and a required nonblank `reason`. Neither
endpoint accepts caller-supplied effective time, actor identity, correlation
identity, outgoing holder, or appointment/transfer mode.

Both return HTTP 200 in the standard Cadence envelope. Role assignment
history is returned using `closed_assignment`/`role_assignment` for ordinary
changes and `outgoing_assignment`/`incoming_assignment` for protected
operations. Protected results also identify `APPOINTMENT` or `TRANSFER` as
determined by transactional persistence.

The routes call `ProjectMembershipService` only. Authorization remains owned
by `ProjectAuthorisationService`, and mutations pass exclusively through the
service-role-only `ProjectRoleManagementRepository` RPC adapter. Affiliation
does not participate; an EXTERNAL member may hold PROJECT_MANAGER.

```text
PROJECT_ACCESS_DENIED             -> 403
PROJECT_ROLE_TRANSFER_REQUIRED    -> 409
PROJECT_ROLE_ASSIGNMENT_INVALID   -> 409
request validation failure        -> 400
```

VS002-05 is complete. Migration
`20260822120000_vs002_role_management.sql` is applied remotely. Local
PostgreSQL runtime, rollback, security, immutability, and real concurrency
verification passed, as did controlled remote-backed live API verification.
The final API suite passes 209/209 tests and API typecheck passes.

## VS002-04 — Member Query and Add-Member Flow

VS002-04 adds the first HTTP member-management surface on top of the
VS002-03 Project Authorisation boundary:

```text
GET  /api/v1/projects/:projectId/members
POST /api/v1/projects/:projectId/members
```

`ProjectMembershipService` owns the application flow. The routes do not
interpret membership persistence or frozen roles directly.

Member listing requires `member.view`. It returns only memberships that are
currently `ACTIVE` and effective at the evaluation time, together with the
stable Person display name, effective frozen project roles, and current
organisational affiliation when one exists. Affiliation is presentation
context only and does not participate in project authorisation.

Ordinary admission requires `member.invite`. VS002-04 accepts only the initial
`PROJECT_MEMBER` role. General role assignment, role changes, Observer/Auditor
assignment, and protected Sponsor/Owner/Manager transfer are exposed by the
VS002-05 role-management endpoints above.

Admission requires an existing stable Cadence Person. The flow does not create
an authentication identity, login account, or organisational affiliation.
Internal and external Persons therefore follow the same project-membership
authorisation rules.

An admission atomically creates:

```text
ProjectMembership
  +
initial PROJECT_MEMBER ProjectRoleAssignment
```

through the service-role-only `public.add_project_member(...)` RPC introduced
by migration:

```text
20260821144400_vs002_member_admission.sql
```

The new membership is Person-only: legacy `user_id` and `role_id` remain null.
The stable actor Person is persisted as both membership grantor and initial
role assigner.

Membership periods remain half-open:

```text
[effectiveFrom, effectiveTo)
```

Null `effectiveTo` means open-ended participation. A bounded membership may
start exactly when an earlier period ends.

Duplicate protection exists at both layers. The application rejects an
overlapping `ACTIVE` membership for the same Person and Project for immediate
business feedback. The database repeats the overlap check while holding a row
lock on the target stable Person, preventing concurrent admissions from both
observing an apparently free period and inserting overlapping memberships.

Historical `ENDED` membership does not block re-entry. A returning Person
receives a new membership period; earlier membership history remains intact.

The member API maps the principal VS002-04 outcomes to HTTP semantics:

```text
PROJECT_ACCESS_DENIED              -> 403
PROJECT_MEMBERSHIP_ALREADY_ACTIVE  -> 409
unknown stable Person              -> 404
invalid request / membership       -> 400
```

The admission RPC is not executable through the publishable/browser key.
Remote verification returned PostgreSQL `42501` for publishable-key execution,
while service-role execution reached the function's own validation boundary.

Live verification against the remote Supabase project proved:

- authenticated member listing;
- open-ended INTERNAL participation;
- time-bounded EXTERNAL participation;
- initial `PROJECT_MEMBER` role creation;
- organisational affiliation remaining independent of project authority;
- stable Person grantor and assigner provenance;
- Person-only membership persistence with null legacy user/role fields;
- duplicate overlapping membership rejection; and
- successful retrieval of both new members through the HTTP API.

VS002-04 closed with 130 passing automated API tests, including eight HTTP
contract tests for the member routes. The current VS002-05 total is recorded
above.

Existing migrated VS-001 members may appear in the VS002 member listing with
an empty frozen-role array because historical `PROJECT_LEAD`, `CONTRIBUTOR`,
`REVIEWER`, and `VIEWER` roles were deliberately not assigned invented VS002
role meanings. Their existing authority continues through the explicit legacy
RBAC fallback in `ProjectAuthorisationService`. This is a transitional
compatibility condition, not loss of access.

At its closure, VS002-04 deliberately excluded membership removal, automatic
expiry processing, general role assignment/change, protected-role transfer,
membership domain events, Audit projection, Tasks responsibility guards,
Members frontend controls, and broad cross-module authorisation migration.
VS002-05 subsequently added role changes and protected appointments/transfers.


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

Project Membership owns these persistence structures:

```text
public.project_memberships
public.project_role_assignments
public.project_role_transfers
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
provide foundational create/read operations only. Atomic admission is owned by
`ProjectMemberAdmissionRepository`; immediate ordinary changes and protected
appointments/transfers are owned by `ProjectRoleManagementRepository`. These
repositories do not authorize, expire memberships, or emit events. A new
VS-002 membership leaves legacy `user_id` and `role_id` null; persisting it
cannot silently activate the current VS-001 RBAC path.

Role management closes an effective assignment and inserts its successor. It
never overwrites or deletes historical assignment identity or provenance.
Protected first appointments have no outgoing assignment; later transfers
close and link the outgoing assignment. The immutable transfer ledger retains
the incoming assignment, optional outgoing assignment, stable-Person
authoriser, reason, effective time, and request correlation ID.

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
- no hard deletion of membership or role-assignment history;
- only the three protected responsibility roles in the transfer ledger; and
- immutable transfer-ledger history with mandatory incoming assignment,
  authoriser, reason, correlation, and effective time.

Transactional service-role-only RPCs implement immediate ordinary role changes
and protected first appointment/transfer. Membership-row locks serialize
ordinary changes; project-row locks serialize protected operations. No SQL
trigger implements automatic expiry or future authorization policy.

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

`public.project_role_assignments` and `public.project_role_transfers` have RLS
enabled with no browser mutation grants. The role-management RPCs are
executable only by `service_role`. The existing
`memberships_select_project_member` policy is
recreated under the same name so authenticated direct reads can see only rows
with the complete VS-001 compatibility shape (`user_id` and `role_id` both
non-null) after the existing project-membership check passes. Person-only
VS-002 rows therefore remain server-side. Service-role repository access is
unchanged. `ProjectAuthorisationService` remains the sole VS002 authorization
boundary. Member admission and role management are exposed only through
server-side HTTP services; no browser database mutation grant is added.

## Deliberately Deferred

Later checkpoints own:

- membership removal/expiry and protected-responsibility removal guards;
- expiry workers and events;
- membership Audit projection;
- Tasks integration;
- Members frontend integration; and
- cross-module adoption of the Project Authorisation service.

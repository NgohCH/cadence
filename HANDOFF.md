# Cadence Engineering Handoff

## Project

Cadence

Conceptualized and prepared by Ngoh Chee Hung.

## Current Version

v0.1 - Development

## Current Branch

`feature/vs-002`

## Current Implementation Work

Vertical Slice:

`VS-002 - Project Membership & Collaboration`

Status:

**VS002-02 implemented in the working tree; pending human review and
source-control checkpoint.**

Current checkpoint:

**VS002-02 Membership Persistence and Database Migration is implemented without
runtime authorization or member-management behaviour. Review and apply/verify
the migration through the human-controlled Supabase workflow, then create the
source-control checkpoint. Do not begin VS002-03 until VS002-02 is accepted.**

Latest VS002-02 validation:

```text
API typecheck = passed
API build = passed
API test suite = 93 passed, 0 failed
VS002-02 focused tests added = 13
```

---

# VS002-02 Membership Persistence and Database Migration

## Implemented

Forward-only migration:

```text
supabase/migrations/20260820000100_vs002_membership_persistence.sql
```

Identity persistence now includes:

```text
public.persons
public.authentication_identities
public.organisational_affiliations
```

Project Membership persistence now includes the evolved existing table plus
separate history:

```text
public.project_memberships
public.project_role_assignments
```

Identity and Project Membership each publish explicit foundational repository
contracts with Supabase adapters. They provide create/read persistence only;
no HTTP route, member-management service, Project Authorisation decision,
transfer command, expiry worker, or event projection is included.

## Stable Identity and Backfill

The safe deterministic VS-001 bridge is:

```text
public.users.id
  = initial public.persons.id

public.users.person_id
  -> public.persons.id
```

This preserves every current `CadenceUser.id`, `actorUserId`, and historical
user FK. The migration does not compare names, usernames, or email addresses.

Existing authentication identities are created only for rows with an explicit
`auth_user_id`. The existing `identity_provider` and exact `auth_user_id`
become provider/subject data; email is copied only as mutable login data.
`users.created_at` supplies the Cadence mapping start. Disabled users become
disabled authentication identities without changing Person identity and keep
null `valid_to` because there is no dedicated disable timestamp. No affiliation
is inferred because VS-001 has no safe source.

## Membership Compatibility Bridge

`public.project_memberships` is evolved in place. Existing columns remain:

```text
user_id
role_id
status = active | inactive
joined_at
created_by
updated_at
```

They continue to serve the existing RBAC repository, RLS helpers, task guards,
and other VS-001 database functions. New fields provide stable `person_id`,
half-open effective dates, generated frozen lifecycle status, stable grantor,
creation time, and termination reason.

Existing memberships map to Person through the exact user FK. `joined_at`
supplies the historical start/creation timestamp. Existing inactive rows have
no end column, so their recorded `updated_at` supplies the end boundary, with a
one-microsecond floor only when needed for a positive interval.

Historical `created_by` is nullable in VS-001. The migration maps it only
through its exact user-to-Person relationship; when it is null,
`granted_by_person_id` remains null. Persisted `ProjectMembership` therefore
represents `grantedBy: string | null`, while `CreateProjectMembershipInput`
requires a real stable Person grantor. A database constraint permits unknown
provenance only on legacy-shaped rows and prevents grantor-less Person-only
membership creation.

The old all-history `(project_id, user_id)` uniqueness constraint becomes a
partial unique index for active compatibility rows. This preserves the
existing `maybeSingle()` RBAC assumption while permitting historical ended
membership records.

## Role History Compatibility

Frozen roles are persisted separately in `public.project_role_assignments`
with role period, assigning Person, reason, creation time, and a composite FK
that guarantees membership/project consistency.

The legacy roles `PROJECT_LEAD`, `CONTRIBUTOR`, `REVIEWER`, and `VIEWER` do not
have exact frozen semantic equivalents. VS002-02 therefore does not invent a
mapping. Existing `role_id` values and permission bundles remain authoritative
for VS-001. An explicit approved role-data migration remains required before a
later checkpoint makes frozen role assignments authoritative at runtime.

## Security and Historical Preservation

New tables have RLS enabled. Anonymous and authenticated browser roles receive
no direct access in VS002-02; the server service role receives explicit
persistence privileges. The pre-existing authenticated
`memberships_select_project_member` policy is recreated under the same name
with `user_id is not null` and `role_id is not null` compatibility predicates.
Existing VS-001 rows retain their current project-member read path; new
Person-only rows are not exposed. This is a temporary VS002-02 restriction,
not the VS002-03 Project Authorisation implementation.

Database constraints enforce provider-subject uniqueness, exact status and
affiliation vocabularies, positive bounded intervals, frozen project roles,
FK integrity, membership/project consistency, and paired legacy user/role
access fields referencing the same Person. Delete-prevention triggers
preserve Person, identity, affiliation, membership, and role history. No SQL
trigger implements protected-role transfer, expiry, or future permission
policy.

## Manual Supabase Action

The migration has not been pushed or applied to the linked remote project.
After human review:

```text
npx supabase db push --dry-run
npx supabase db push
```

Then run `tests/schema_smoke.sql` and `tests/rls_manual_test.md` against the
reviewed target. Do not reset or destroy remote data.

There is no destructive down migration. Confirm backup/PITR readiness before
application. Any schema correction should be a new reviewed forward migration;
backup restoration is an explicit operational recovery action.

## Deliberately Deferred

All VS002-03+ runtime authorization, member APIs, transfers, removal/expiry,
Tasks responsibility guards, Audit projection, frontend, invitations, Entra,
and organisational hierarchy remain incomplete.

---

# VS002-01 Identity and Membership Domain Foundations

## Implemented

Identity now owns explicit, separate domain representations for:

* stable `CadencePerson` identity;
* replaceable provider-neutral `AuthenticationIdentity`;
* authentication identity validity and active/disabled status; and
* time-varying `INTERNAL`/`EXTERNAL` organisational affiliation.

The new Project Membership module owns domain representations for:

* `ProjectMembership` as an authorised stable Person-to-Project relationship;
* membership status, grantor, duration, and optional termination reason;
* `ProjectRoleAssignment` separately from membership;
* the exact frozen six-role vocabulary;
* protected responsibility role classification;
* Observer/Auditor read-only classification; and
* deterministic membership-effectiveness evaluation.

Membership intervals use `[effectiveFrom, effectiveTo)`: the start is
inclusive, the end is exclusive, and null end means open-ended. The caller
supplies the evaluation timestamp; domain logic does not depend on `Date.now()`.
Invalid timestamps and non-positive ranges are rejected explicitly. An ended
membership retains its historical effective interval.

## Architectural Boundaries

The following distinctions are mandatory:

```text
Cadence Person
!= Authentication Identity
!= Organisational Affiliation
!= Project Membership
!= Project Role Assignment
```

Authentication data carries no membership, role, permission, or project
authority. Affiliation grants no project access. Project Membership depends on
stable Person and Project identifiers and does not understand authentication
providers, email addresses, or login identifiers.

An `EXTERNAL` Person can hold `PROJECT_MANAGER`. Temporary access is membership
duration and is not a role. `PROJECT_SPONSOR`, `PROJECT_OWNER`, and
`PROJECT_MANAGER` are protected responsibility roles, but transfer behaviour is
not part of this checkpoint.

Identity linking/relinking remains an explicit trusted operation. No name,
email, or username matching/merging logic was introduced. Linking a replacement
authentication identity cannot itself recreate a membership or role.

## VS-001 Compatibility

The current runtime flow remains unchanged:

```text
Supabase Auth
  -> public.users.auth_user_id
  -> CadenceUser.id
  -> RequestContext.actorUserId
  -> existing RBAC repository
  -> permission codes
```

`CadenceUser` remains the compatibility projection for `GET /api/v1/me` and
existing protected operations. The VS-001 `public.project_memberships` table,
RBAC service, routes, server composition, and permission behaviour were not
redesigned in VS002-01.

## Deliberately Deferred

VS002-01 adds no:

* migration, table, persistence adapter, or repository;
* member API or membership application flow;
* Project Authorisation service or permission engine;
* expiry job, membership event, or Audit integration;
* role transfer, removal, or responsibility guard;
* Tasks integration or Members frontend;
* Entra-specific implementation, invitation delivery, or hierarchy; or
* temporary leadership delegation.

That checkpoint intentionally contained no persistence. VS002-02 now provides
the reviewed-next persistence implementation described above; VS002-03 and all
later checkpoints remain incomplete.

---

# VS-001 Objective

Validate the core Cadence architecture through one complete user journey:

```text
Login
  ->
Project Workspace
  ->
Discussion
  ->
Team Agent task proposal
  ->
Human confirmation
  ->
Task creation
  ->
Audit trail
```

VS-001 is intended to prove the architecture through a narrow vertical slice rather than implementing the entire product at once.

The slice must demonstrate:

* modular boundaries,
* authentication,
* project-scoped authorization,
* discussion state,
* Team Agent interaction,
* human confirmation,
* authoritative task creation,
* domain events,
* provenance,
* auditability,
* request tracing,
* maintainable engineering structure.

---

# Engineering Principles

Cadence must remain modular, traceable, maintainable, and suitable for handoff between competent IT engineers.

The following principles apply throughout development.

1. PostgreSQL/Supabase is the authoritative state store.
2. Authentication and Cadence authorization are separate concerns.
3. Browser clients must not perform authoritative cross-module writes.
4. Each module owns its state and business rules.
5. Modules interact through defined service interfaces.
6. Team Agent must never write directly to Tasks persistence.
7. Protected commands enforce RBAC server-side.
8. Human confirmation does not bypass target-module authorization.
9. Material state changes produce traceable domain events.
10. AI-generated state requires provenance.
11. Request IDs identify individual HTTP requests.
12. Correlation IDs identify truthful request or processing contexts; a complete business journey may span multiple correlation IDs and is reconstructed through durable provenance, aggregate identity, causation, Audit projection, and correlation metadata.
13. Causation IDs identify which event directly caused another event.
14. Retryable commands must support idempotency where required.
15. Security controls should be designed into modules rather than added later.
16. Module implementation changes must not silently alter another module's behaviour.
17. Significant technical and functional changes must be recorded in `CHANGELOG.md`.
18. Public interfaces and architectural boundaries must be understandable without tribal knowledge.
19. Code should favour clarity over cleverness.
20. Secrets must never be committed to source control.
21. Database structural changes must be delivered through versioned migrations.
22. Missing authoritative state should not be silently fabricated by application code.
23. Permission codes, rather than role names, are the primary authorization primitive.

---

# Repository Structure

Primary repository structure:

```text
cadence/
|
+-- apps/
|   +-- api/
|   |   +-- src/
|   |   +-- .env
|   |   +-- .env.example
|   |   +-- package.json
|   |
|   +-- web/
|
+-- api/
|   +-- openapi.yaml
|
+-- supabase/
|   +-- migrations/
|
+-- tests/
|
+-- docs/
|   +-- adr/
|   +-- vertical-slices/
|
+-- CHANGELOG.md
+-- HANDOFF.md
+-- .gitignore
```

Important locations:

* `apps/api` - backend API implementation
* `apps/web` - frontend application
* `api/openapi.yaml` - API contract
* `supabase/migrations` - Supabase/PostgreSQL migrations
* `tests` - contract, integration, RBAC, and end-to-end tests
* `docs/adr` - architecture decision records
* `docs/vertical-slices` - vertical slice implementation records
* `CHANGELOG.md` - implementation and architecture change record
* `HANDOFF.md` - current engineering state and continuation guide

---

# API Application

Location:

```text
apps/api
```

Current stack:

* Node.js 24.13.0
* TypeScript
* Express 5.2.1
* tsx
* Supabase JavaScript client 2.112.2

The repository root also currently includes the Supabase CLI package as a development dependency.

Current default development port:

```text
3000
```

Health endpoint:

```text
GET /health
```

Authenticated identity endpoint:

```text
GET /api/v1/me
```

Project Workspace endpoint:

```text
GET /api/v1/projects/{projectId}/summary
```

Authenticated My Tasks endpoint:

```text
GET /api/v1/me/tasks
```

Authenticated Task Audit endpoint:

```text
GET /api/v1/projects/{projectId}/tasks/{taskId}/audit
```

---

# API Development Commands

Run API commands from:

```text
C:\Users\chngo\cadence\apps\api
```

Development mode:

```powershell
npm run dev
```

Current development script:

```text
node --env-file=.env --watch --import tsx src/server.ts
```

Normal API start:

```powershell
npm start
```

Current API start script:

```text
node --env-file=.env --import tsx src/server.ts
```

One-shot Team Agent worker:

```powershell
npm run worker:once
```

Current worker script:

```text
node --env-file=.env --import tsx src/worker.ts
```

The current one-shot worker processes Audit and Team Agent consumers independently.

Per invocation it attempts:

```text
one Audit domain-event delivery
+
one Team Agent MessageCreated.v1 delivery
```

and then exits.

It does not run a permanent polling loop.

Type checking:

```powershell
npm run typecheck
```

Automated tests:

```powershell
npm test
```

Build:

```powershell
npm run build
```

Latest reported automated implementation verification:

```text
npm run typecheck = passed
npm test = 64 passed, 0 failed
```

The current API gate is 64/64 after VS001-10G browser integration. Run the gate again after the final documentation changes before committing.

---

# Environment Configuration

The API loads local configuration from:

```text
apps/api/.env
```

This file contains real local credentials and must never be committed.

Required variables:

```text
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

A safe template is committed at:

```text
apps/api/.env.example
```

Example structure:

```text
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here
SUPABASE_SECRET_KEY=sb_secret_your_key_here
```

Real credentials must never be placed in `.env.example`.

The repository `.gitignore` protects environment files using:

```text
.env
.env.*
!.env.example
```

Previous verification:

```powershell
git check-ignore -v apps\api\.env
```

confirmed that:

```text
apps/api/.env
```

is ignored by Git.

## Secret-Key Rule

`SUPABASE_SECRET_KEY` is server-side only.

It must never be:

* committed to Git,
* sent to the browser,
* included in frontend environment variables,
* written into documentation,
* pasted into logs.

---

# Supabase Database Workflow

Cadence uses versioned migrations under:

```text
supabase/migrations
```

The remote Supabase database is the current hosted database environment used during VS-001 development.

Useful commands should be run from the repository root:

```text
C:\Users\chngo\cadence
```

Check migration state:

```powershell
npx supabase migration list
```

Preview pending migrations:

```powershell
npx supabase db push --dry-run
```

Apply migrations:

```powershell
npx supabase db push
```

A Docker-related catalogue/cache warning may occur on development machines where Docker Desktop is not running.

During the Project Health backfill deployment, the migration itself completed successfully despite a Docker catalogue-cache warning.

The migration state should always be verified after a push rather than assuming that a warning represents migration failure.

---

# VS001-01 Walking Skeleton

Status:

**Completed**

Implemented:

* Node.js/TypeScript API application
* Express server
* `/health`
* standard API response envelope
* request ID generation
* correlation ID generation
* request tracing middleware
* `RequestContext`
* shared `DomainEvent` type
* correlation ID concept
* causation ID concept
* module ownership documentation
* Team Agent to Tasks module boundary
* `CHANGELOG.md`
* `HANDOFF.md`
* `feature/vs-001` branch
* draft pull request

---

# Request Tracing

Each API request receives:

* `request_id`
* `correlation_id`

Definitions:

### Request ID

Identifies one HTTP request.

### Correlation ID

Identifies one truthful request or processing context.

Correlation may continue across asynchronous processing that belongs to the same originating context, but separate human HTTP interactions may legitimately begin different correlations.

A complete business journey is reconstructed using:

```text
durable provenance
+ aggregate identity
+ causation
+ Audit projection
+ one or more truthful correlation IDs
```

Do not rewrite later request correlations merely to make a multi-request workflow appear to use one correlation ID.

### Causation ID

Identifies the event that directly caused another event.

These identifiers must remain available as VS-001 progresses into Discussion, Team Agent proposals, task creation, and audit reconstruction.

---

# API Response Envelope

Cadence uses a standard success/error response structure.

Successful responses include:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "correlation_id": "...",
    "request_id": "...",
    "next_cursor": null
  }
}
```

Failure responses use:

```json
{
  "success": false,
  "error": {
    "code": "...",
    "message": "...",
    "correlation_id": "...",
    "details": {}
  }
}
```

Authentication failures use a consistent external response rather than exposing internal authentication state.

Example:

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHENTICATED",
    "message": "Authentication is required.",
    "correlation_id": "...",
    "details": {}
  }
}
```

Internal logs retain more specific diagnostic reasons where appropriate.

---

# RequestContext

Authenticated application operations use the shared `RequestContext`.

Important values include:

```text
context.actorUserId
context.correlationId
context.requestId
```

The authenticated actor must come from the verified server-side authentication path.

Client input must never be trusted to specify the authoritative acting Cadence user.

Project authorization therefore uses:

```text
context.actorUserId
```

rather than a user ID supplied in the request body or query string.

---

# VS001-02 Authentication

Status:

**Implementation and manual verification complete**

## Components Implemented

* `AuthProvider`
* `SupabaseAuthProvider`
* `IdentityRepository`
* `SupabaseIdentityRepository`
* `IdentityService`
* authentication middleware
* authenticated `RequestContext`
* `GET /api/v1/me`

---

# Authentication Flow

Cadence v0.1 uses Supabase Auth as its authentication provider.

Current flow:

```text
Client
  ->
Supabase Auth login
  ->
Supabase access token / JWT
  ->
Authorization: Bearer <token>
  ->
Cadence authenticate middleware
  ->
SupabaseAuthProvider.verifyAccessToken()
  ->
Supabase auth.getUser(jwt)
  ->
Supabase authenticated user ID
  ->
IdentityService
  ->
SupabaseIdentityRepository
  ->
public.users.auth_user_id
  ->
Cadence user
  ->
RequestContext
```

---

# Supabase-to-Cadence Identity Mapping

The verified v0.1 relationship is:

```text
auth.users.id
      =
public.users.auth_user_id
```

Example verified identity:

```text
Supabase Auth user:

de97ae2b-cc72-4c0d-9d6d-35cea1300aff
```

maps to:

```text
Cadence user:

afec9f7c-eb66-46b9-9668-cb57b26394b5
```

for:

```text
alice@cadence.test
```

## Important Correction Made During VS001-02

`SupabaseIdentityRepository` originally queried:

```text
public.users.external_user_id
```

This was incorrect for the current database schema and seed data.

It was corrected to query:

```text
public.users.auth_user_id
```

The repository lookup uses:

```typescript
.eq("auth_user_id", authSubject)
```

---

# `auth_user_id` and `external_user_id`

The `public.users` table currently contains both:

```text
auth_user_id       uuid
external_user_id   text
identity_provider  text
```

Current use:

```text
auth_user_id
```

links Cadence v0.1 users to Supabase Auth.

Current Supabase relationship:

```text
auth.users.id
  ->
public.users.auth_user_id
```

`external_user_id` is currently unused for Supabase identity resolution.

It should not be removed casually.

It remains available for future external identity-provider integration.

Cadence is expected eventually to move institutional authentication to Microsoft Entra ID.

The authentication abstraction must allow that provider transition without changing Cadence project roles or permission logic.

---

# Authentication vs Authorization

Authentication answers:

```text
Who is this user?
```

Authorization answers:

```text
What is this user allowed to do in this project?
```

These concerns remain separate.

VS001-02 established authenticated Cadence identity.

VS001-03 integrated project membership and RBAC into the protected API execution path.

Current protected-project progression is:

```text
Supabase authentication
  ->
Cadence identity
  ->
RequestContext
  ->
project membership
  ->
project role
  ->
permission
  ->
project resource
```

Authentication success does not imply authorization success.

---

# Identity Service Rules

After Supabase successfully validates a JWT, Cadence resolves the authenticated Supabase user to a Cadence user.

The Identity Service rejects:

### Missing Cadence mapping

Internal reason:

```text
CADENCE_USER_NOT_FOUND
```

### Disabled Cadence user

Internal reason:

```text
CADENCE_USER_DISABLED
```

External clients receive the same generic response:

```text
401 UNAUTHENTICATED
```

This prevents the API from unnecessarily exposing internal user-provisioning or account-status information.

---

# Authentication Failure Logging

Authentication middleware logs the specific internal reason for troubleshooting.

Examples:

```text
AUTH_TOKEN_INVALID
CADENCE_USER_NOT_FOUND
CADENCE_USER_DISABLED
```

Infrastructure errors are also logged where a useful `message` property exists.

The API response remains generic.

This behaviour is intentional.

Internal diagnostic information must not be exposed simply because an authentication request failed.

---

# VS001-02 Manual Verification

The following scenarios have been manually verified.

## 1. Missing Token

Protected API request without a bearer token.

Expected:

```text
401 UNAUTHENTICATED
```

Verified.

## 2. Invalid JWT

Protected API request with invalid authentication material.

Expected:

```text
401 UNAUTHENTICATED
```

Verified.

## 3. Valid Supabase User Without Cadence Mapping

Test account:

```text
cadence-unmapped-test@example.com
```

Supabase Auth ID:

```text
66533bdf-d8ed-45e0-8464-76389a690a4b
```

Supabase authentication succeeds.

No corresponding row exists in `public.users`.

Expected internal result:

```text
CADENCE_USER_NOT_FOUND
```

Expected external result:

```text
401 UNAUTHENTICATED
```

Verified.

## 4. Disabled Cadence User

Supabase authentication succeeds.

Cadence identity exists but user status is not active.

Expected internal result:

```text
CADENCE_USER_DISABLED
```

Expected external result:

```text
401 UNAUTHENTICATED
```

Verified.

## 5. Active Cadence User

Alice test account:

```text
alice@cadence.test
```

Supabase Auth ID:

```text
de97ae2b-cc72-4c0d-9d6d-35cea1300aff
```

Cadence user ID:

```text
afec9f7c-eb66-46b9-9668-cb57b26394b5
```

Expected:

```text
HTTP 200
```

Verified `/api/v1/me` response:

```json
{
  "success": true,
  "data": {
    "id": "afec9f7c-eb66-46b9-9668-cb57b26394b5",
    "display_name": "Alice Test",
    "email": "alice@cadence.test",
    "status": "active",
    "identity_provider": "local"
  }
}
```

Request and correlation metadata were also returned.

---

# Verified Test Identities

Current known active mappings include:

## Alice

```text
Email:
alice@cadence.test

Supabase Auth ID:
de97ae2b-cc72-4c0d-9d6d-35cea1300aff

Cadence user ID:
afec9f7c-eb66-46b9-9668-cb57b26394b5

Status:
active
```

## Bob

```text
Email:
bob@cadence.test

Supabase Auth ID:
0c687f67-12b3-46cd-9257-ea41811c6483

Cadence user ID:
0764e5bf-1f67-41e2-9aeb-39c39209ae61

Status:
active
```

## Unmapped Test Identity

```text
Supabase Auth ID:
66533bdf-d8ed-45e0-8464-76389a690a4b

Email:
cadence-unmapped-test@example.com

Cadence user:
none
```

This unmapped identity exists intentionally for negative authentication testing.

---

# Supabase Client Separation

Two Supabase client responsibilities currently exist.

## Authentication Client

Used by:

```text
SupabaseAuthProvider
```

Purpose:

Validate user access tokens through:

```text
auth.getUser(jwt)
```

Configured using:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
```

## Server Database Client

Used by backend repositories including:

```text
SupabaseIdentityRepository
SupabaseRbacRepository
SupabaseProjectsRepository
```

Purpose:

Perform trusted backend access to Cadence database records.

Configured using:

```text
SUPABASE_URL
SUPABASE_SECRET_KEY
```

The server database secret must remain server-side.

A shared server-side Supabase database client is currently created during API bootstrap and supplied to these repositories.

---

# Authentication Configuration Issue Resolved

During VS001-02 testing, two runtime configuration issues were identified.

## Incorrect Secret Key

An invalid value was initially supplied through:

```text
SUPABASE_SECRET_KEY
```

This caused Supabase database access to return:

```text
Invalid API key
```

The configuration was corrected to use the server-side Supabase secret key.

## Inconsistent PowerShell Environment

Manual Supabase authentication tests and the Cadence API process were temporarily using different Supabase environment values.

This resulted in a valid JWT being accepted directly by Supabase while Cadence rejected it.

The issue was resolved by:

1. aligning the Supabase URL,
2. aligning the publishable key,
3. setting the correct server secret key,
4. moving configuration into `apps/api/.env`,
5. loading `.env` automatically when the API starts.

This eliminates reliance on temporary PowerShell environment variables for normal API startup.

---

# Current Authentication Acceptance Test

VS001-02 acceptance criterion:

> A valid Supabase JWT for an active, provisioned Cadence user resolves to the correct Cadence identity.

Status:

**Passed**

Additional negative cases:

* missing token - passed
* invalid JWT - passed
* unmapped user - passed
* disabled user - passed

TypeScript type checking:

**Passed**

---

# Project RBAC

Project-scoped RBAC now participates in the VS-001 API request path.

Implemented RBAC components include:

```text
apps/api/src/modules/rbac/rbac.types.ts
apps/api/src/modules/rbac/rbac.repository.ts
apps/api/src/modules/rbac/rbac.service.ts
apps/api/src/infrastructure/database/supabase-rbac.repository.ts
```

The RBAC repository resolves:

```text
Cadence user
  +
project
  ->
active project_membership
  ->
role
  ->
role_permissions
  ->
permissions
```

The resulting project access model includes:

```text
membershipId
projectId
userId
roleId
roleCode
permissions[]
```

Authorization code checks permission codes rather than hard-coding access decisions around role names.

For VS001-03, the required permission is:

```text
project.view
```

---

# Project Authorization Behaviour

For protected Project Workspace access, authorization distinguishes between two different denial conditions.

## No Active Membership

If the authenticated user has no active membership in the requested project:

```text
404 NOT_FOUND
```

is returned.

This is intentional.

It avoids confirming the existence of a protected project to an authenticated user who is not a member.

## Active Membership but Missing Permission

If an active membership exists but the user's role does not contain:

```text
project.view
```

Cadence returns:

```text
403 PERMISSION_DENIED
```

This distinction has been manually verified.

---

# VS001-03 Project Workspace Read Model

Status:

**Implementation and manual verification complete**

Endpoint:

```text
GET /api/v1/projects/{projectId}/summary
```

Acceptance criterion:

> An authenticated Cadence user who is a member of the requested project and has `project.view` permission can load the Project Workspace summary.

Status:

**Passed**

VS001-03 is the first API checkpoint where:

```text
authenticated Cadence identity
  +
active project membership
  +
project role
  +
project.view permission
```

are evaluated together in the request path.

---

# VS001-03 Request Flow

Current flow:

```text
HTTP request
  ->
authentication middleware
  ->
authenticated RequestContext
  ->
Projects route
  ->
ProjectsService
  ->
RbacService
  ->
SupabaseRbacRepository
  ->
active project membership
  ->
role
  ->
permissions
  ->
project.view
  ->
SupabaseProjectsRepository
  ->
Project Workspace read aggregation
  ->
standard API response
```

Project Workspace code does not duplicate authentication logic.

Authentication completes before project authorization begins.

The authenticated actor is obtained from:

```text
RequestContext.actorUserId
```

not from client-supplied user identity.

---

# VS001-03 Project Module Files

Current Project Workspace implementation includes:

```text
apps/api/src/modules/projects/projects.types.ts
apps/api/src/modules/projects/projects.repository.ts
apps/api/src/modules/projects/projects.errors.ts
apps/api/src/modules/projects/projects.service.ts
apps/api/src/modules/projects/projects.routes.ts
apps/api/src/infrastructure/database/supabase-projects.repository.ts
```

Server composition is performed in:

```text
apps/api/src/server.ts
```

---

# Project Workspace Read Model

The Project Workspace summary currently aggregates:

```text
project
my_tasks
blockers
next_milestone
alerts
```

The project portion includes:

```text
id
name
description
goal
lifecycle_status
health_status
progress_percent
owner_user_id
start_date
target_date
created_at
updated_at
```

The logged-in user's task summary includes:

```text
pending
overdue
```

The endpoint also returns:

```text
blockers
next_milestone
alerts
```

and standard:

```text
correlation_id
request_id
next_cursor
```

metadata.

---

# Project Workspace v0.1 Requirements

The Project Workspace requirements established for v0.1 include:

* clear project status indicator,
* project summary,
* logged-in user's project context,
* visible count of tasks pending for the logged-in user,
* alert banner for important:

  * issues,
  * deadlines,
  * blockers,
  * announcements.

VS001-03 establishes the backend read model required to support these elements.

Document control and document classification remain deferred to a later version.

---

# Project Health Integration

Project Health is maintained separately from the core `projects` table.

Current authoritative tables include:

```text
public.projects
public.project_health
public.project_health_history
```

The current Project Health state belongs in:

```text
public.project_health
```

Historical changes belong in:

```text
public.project_health_history
```

This separation must be preserved.

Project Workspace may read and aggregate Project Health but must not assume ownership of Project Health state.

---

# Project Health Schema Correction During VS001-03

The first Project Workspace repository implementation incorrectly attempted to select:

```text
projects.health_status
```

The live schema does not contain that column.

The actual `public.projects` columns include:

```text
id
name
description
goal
lifecycle_status
progress_percent
owner_user_id
start_date
target_date
created_at
updated_at
```

Current health is stored separately in:

```text
public.project_health.health_status
```

The repository was corrected so that:

```text
SupabaseProjectsRepository
  ->
public.projects
```

reads project metadata, while:

```text
SupabaseProjectsRepository
  ->
public.project_health
```

reads current Project Health.

The values are then assembled into the Project Workspace read model.

This is intentional read aggregation and does not transfer Project Health ownership to the Projects module.

---

# Project Health Baseline Migration

During VS001-03, existing projects were found to have no corresponding current-health rows.

The schema defines:

```text
on_track
```

as the default Project Health state, but creation of the `project_health` table did not automatically backfill projects that already existed.

A migration was therefore added:

```text
supabase/migrations/20260812201900_project_health_backfill.sql
```

Purpose:

> Create a current Project Health baseline for projects that do not yet have one.

The migration inserts:

```text
health_status = on_track
source = system
reasons = []
changed_by = null
```

only where a `project_health` row does not already exist.

It uses:

```text
on conflict (project_id) do nothing
```

to remain safe if a current-health record already exists.

The migration intentionally writes only current state and does not manufacture historical health-change events.

---

# Project Health Verification

After the backfill migration, the following current states were verified.

## Alice Project

```text
Project ID:
ff571613-672d-4424-813c-5114bdca53a4

Health:
on_track

Source:
system
```

## Bob Project

```text
Project ID:
51780d65-4b6a-4be1-bd35-c205ed6210e5

Health:
on_track

Source:
system
```

The Project Workspace happy path subsequently returned:

```text
health_status = on_track
```

for Alice Project.

---

# Project Health Data Invariant

The Project Workspace repository does not silently substitute:

```text
on_track
```

if a project has no `project_health` record.

Instead, absence of current health after project retrieval is treated as an internal data-integrity problem.

This is intentional.

After the backfill, an existing project should have current Project Health state.

Future project-creation workflow must initialise Project Health explicitly as part of the appropriate documented application/module workflow.

Do not introduce a hidden database trigger for this behaviour without an explicit architectural decision.

---

# Project Owner Schema Detail

The live schema defines:

```text
projects.owner_user_id
```

as:

```text
NOT NULL
```

The Project Workspace database-row type has been aligned with this database constraint.

Code and future schema changes should avoid reintroducing unnecessary nullability unless the authoritative schema changes.

---

# VS001-03 Manual Verification

VS001-03 has been manually tested through the running API.

## 1. Authorized Happy Path

Actor:

```text
Alice
```

Project:

```text
Alice Project
ff571613-672d-4424-813c-5114bdca53a4
```

Alice has:

```text
active project membership
PROJECT_LEAD role
project.view
```

Request:

```text
GET /api/v1/projects/ff571613-672d-4424-813c-5114bdca53a4/summary
```

Result:

```text
HTTP 200
success = true
```

Verified response included:

```text
project.name = Alice Project
project.lifecycle_status = active
project.health_status = on_track
project.progress_percent = 0
my_tasks.pending = 1
my_tasks.overdue = 0
blockers = 0
next_milestone = null
alerts = []
```

Request and correlation IDs were present.

---

## 2. Cross-Project Isolation

Actor:

```text
Alice
```

Requested project:

```text
Bob Project
51780d65-4b6a-4be1-bd35-c205ed6210e5
```

Alice does not have the required active membership in Bob Project for this test.

Expected:

```text
404 NOT_FOUND
```

Verified:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Project not found.",
    "correlation_id": "...",
    "details": {}
  }
}
```

Status:

**Passed**

This confirms that knowledge of a project UUID is not sufficient to retrieve protected project data.

---

## 3. Active Membership Without `project.view`

A controlled temporary RBAC test was used.

Bob already had an active membership in Alice Project using the normal:

```text
VIEWER
```

role.

The normal `VIEWER` role includes:

```text
project.view
```

along with other read permissions.

The normal `VIEWER` role was not modified.

Instead, a temporary project-scoped role was created:

```text
TEST_NO_PROJECT_VIEW
```

with no permissions.

Bob's Alice Project membership was temporarily changed to this test role.

This produced the exact required condition:

```text
authenticated Bob
+
active membership in Alice Project
+
no project.view
```

Request:

```text
GET /api/v1/projects/ff571613-672d-4424-813c-5114bdca53a4/summary
```

Expected:

```text
403 PERMISSION_DENIED
```

Verified:

```json
{
  "success": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "You do not have permission to view this project.",
    "correlation_id": "...",
    "details": {}
  }
}
```

Status:

**Passed**

After testing:

* Bob's Alice Project membership was restored to the normal `VIEWER` role.
* the temporary `TEST_NO_PROJECT_VIEW` role was deleted.
* no permanent change was made to normal role permissions.

---

# Current Verified Project Membership Context

Useful test context:

## Alice Project

```text
Project ID:
ff571613-672d-4424-813c-5114bdca53a4
```

Alice is a member using:

```text
PROJECT_LEAD
```

Bob is also an active member using:

```text
VIEWER
```

after restoration of the temporary permission-denial test.

## Bob Project

```text
Project ID:
51780d65-4b6a-4be1-bd35-c205ed6210e5
```

Bob is a member using:

```text
PROJECT_LEAD
```

Do not alter normal system-role permissions merely to create negative authorization tests.

Use isolated test fixtures when required and restore normal project state immediately afterward.

---

# `VIEWER` Permission Context

During VS001-03 testing, the existing `VIEWER` role was confirmed to include read permissions including:

```text
activity.view
alert.view
blocker.view
decision.view
file.view
member.view
message.view
milestone.view
notification.view
project_health.view
project.view
task.view
topic.view
```

Therefore `VIEWER` is not suitable for testing the missing-`project.view` branch without changing legitimate system-role behaviour.

This is why an isolated temporary role was used.

---

# VS001-03 Error Behaviour

Current Project Workspace service-level authorization behaviour includes:

### No active membership

```text
ProjectNotFoundError
  ->
404 NOT_FOUND
```

### Active membership but missing `project.view`

```text
ProjectPermissionDeniedError
  ->
403 PERMISSION_DENIED
```

Unexpected repository/infrastructure errors continue through normal Express error handling rather than being exposed as authorization responses.

Temporary diagnostic `console.log` / `console.error` statements used during live troubleshooting have been removed.

The API was retested after their removal.

---

# VS001-03 Final Sanity Check

After:

* Project Health repository correction,
* Project Health backfill migration,
* RBAC testing,
* temporary RBAC fixture cleanup,
* diagnostic-log removal,

the Alice Project endpoint was called again.

Result:

```text
success = true
HTTP 200
```

Response included:

```text
Alice Project
active
on_track
pending tasks = 1
overdue tasks = 0
blockers = 0
next milestone = null
alerts = []
```

Request and correlation metadata remained present.

TypeScript type checking was then run again.

Result:

```text
Passed
```

---

# Server Composition

The HTTP API composition root is:

```text
apps/api/src/server.ts
```

It currently creates and composes:

```text
SupabaseAuthProvider
SupabaseIdentityRepository
SupabaseRbacRepository
SupabaseProjectsRepository
SupabaseDiscussionRepository
SupabaseTeamAgentRepository
SupabaseTeamAgentMaterializationRepository
SupabaseTasksRepository
SupabaseAuditRepository

IdentityService
RbacService
ProjectsService
DiscussionService
TeamAgentService
TeamAgentTaskMaterializationService
TasksService
AuditQueryService

authentication middleware

identity router
projects router
discussion router
tasks router
audit router
team-agent review router
team-agent task-materialization router
```

A shared server-side Supabase database client is used for backend database repositories.

Protected API routes are mounted under:

```text
/api/v1
```

Authentication middleware executes before protected Identity, Projects, Discussion, Tasks, Audit, Team Agent review, and Task-materialization route handlers.

The current protected Discussion endpoint is:

```text
POST /api/v1/projects/{projectId}/messages
```

The current protected My Tasks endpoint is:

```text
GET /api/v1/me/tasks
```

The current protected Task Audit endpoint is:

```text
GET /api/v1/projects/{projectId}/tasks/{taskId}/audit
```

Server composition remains explicit in `src/server.ts`.

The Discussion module depends on the `DiscussionRepository` abstraction rather than directly on Supabase.

The concrete Supabase persistence adapter remains under:

```text
src/infrastructure/database
```

## Worker Composition

Asynchronous Team Agent processing uses a separate composition root:

```text
apps/api/src/worker.ts
```

The one-shot worker composes independent Audit and Team Agent consumers around the shared domain-event delivery infrastructure.

Conceptually:

```text
SupabaseDomainEventRepository
  ->
DomainEventProcessor
  ->
AuditDomainEventHandler
  ->
AuditService
  ->
SupabaseAuditRepository

SupabaseDomainEventRepository
  ->
DomainEventProcessor
  ->
MessageCreatedV1Handler
  ->
DiscussionService
  ->
TeamAgentService
```

Audit projection and Team Agent processing use independent per-consumer delivery records.

The worker attempts Audit processing before Team Agent processing in each invocation. A failure or retry state for one consumer must not be treated as the processing state of the other consumer.

`DiscussionService` currently requires `RbacService` in its constructor even though the trusted internal `getMessageVersion()` path does not perform an RBAC check. The worker therefore composes the existing Discussion service rather than bypassing the module boundary and reading Discussion tables directly.

The worker is intentionally not embedded in `server.ts`.

Do not introduce a permanent polling loop into the HTTP server process merely for convenience. Production worker hosting, supervision, cadence, and scaling remain future operational decisions.

Both composition roots should remain explicit and easy to trace.

Avoid introducing hidden dependency resolution, service locators, or implicit cross-module wiring without a clear architectural reason.

---

# Current Projects Service Boundary

`ProjectsService` currently coordinates the Project Workspace read operation.

Conceptually:

```text
ProjectsService.getProjectSummary(
  RequestContext,
  projectId
)
  ->
RbacService.getProjectAccess(
  actorUserId,
  projectId
)
  ->
require active membership
  ->
require project.view
  ->
ProjectWorkspaceReadRepository.getSummary(
  projectId,
  actorUserId
)
```

This preserves the separation between:

```text
Identity
RBAC
Projects
database infrastructure
HTTP routing
```

The route layer should not absorb authorization or persistence logic that belongs in the service/repository layers.

---

# Project Workspace Repository Boundary

The domain-level contract is:

```text
ProjectWorkspaceReadRepository
```

with:

```text
getSummary(
  projectId,
  userId
)
```

The Supabase implementation is:

```text
SupabaseProjectsRepository
```

The interface allows the database implementation to be replaced without changing the Projects service contract.

This pattern should continue for later modules.

---

# Project Workspace Read Aggregation

`SupabaseProjectsRepository` currently reads from multiple tables to construct one workspace response.

Conceptually:

```text
projects
  ->
project metadata

project_health
  ->
current health

tasks
  ->
logged-in user's task counts

blockers
  ->
active blocker count

milestones
  ->
next incomplete milestone

alerts
  ->
active project/user alerts
```

This is a read-model aggregation.

It does not mean the Projects module owns Tasks, Blockers, Milestones, Alerts, or Project Health state.

As those modules gain dedicated application services, maintain the established ownership contracts and avoid cross-module authoritative writes through the workspace read model.

---

# VS001-04 Discussion Message Creation

VS001-04 implements the first authoritative Discussion write through the Cadence API.

Implemented application command:

```text
DiscussionService.postMessage()
```

HTTP endpoint:

```text
POST /api/v1/projects/{projectId}/messages
```

Required permission:

```text
message.create
```

## VS001-04 Request Flow

```text
authenticated HTTP request
  ->
authentication middleware
  ->
RequestContext
  ->
Discussion route
  ->
DiscussionService.postMessage()
  ->
RbacService.getProjectAccess()
  ->
active project membership
  ->
message.create
  ->
DiscussionRepository.createMessage()
  ->
SupabaseDiscussionRepository
  ->
public.post_discussion_message(...)
  ->
PostgreSQL transaction
```

The route does not own persistence logic.

The Discussion service depends on the `DiscussionRepository` abstraction rather than directly on Supabase.

## Implementation Files

```text
apps/api/src/modules/discussion/
  discussion.errors.ts
  discussion.repository.ts
  discussion.routes.ts
  discussion.service.ts
  discussion.test.ts
  discussion.types.ts
  README.md

apps/api/src/infrastructure/database/
  supabase-discussion.repository.ts

supabase/migrations/
  20260813000100_post_discussion_message.sql
```

## Atomic Persistence

`public.post_discussion_message(...)` atomically persists:

```text
messages
  +
message_versions version 1
  +
MessageCreated.v1 domain event
```

`MessageCreated.v1` is inserted as:

```text
event_type = MessageCreated
event_version = 1
aggregate_type = message
aggregate_id = new message ID
status = pending
```

With the VS001-05 fan-out trigger now present, matching consumer deliveries are materialised in the same database transaction and the domain-event fan-out status is then marked `processed`.

Consumer completion is tracked separately in:

```text
public.domain_event_deliveries
```

All writes occur in one PostgreSQL transaction.

If validation, authorization, message creation, version creation, or event creation fails, the transaction must not leave a partial Discussion message.

## Authorization

Application authorization follows:

```text
authenticated Cadence identity
  ->
active project membership
  ->
project role
  ->
permission codes
  ->
message.create
```

An active project member without `message.create` receives `403 PERMISSION_DENIED`.

Authorization remains based on permission codes rather than hard-coded role names.

## Defence in Depth

The PostgreSQL function performs a second `message.create` permission check immediately before persistence.

This supplements application-service RBAC rather than replacing it.

The write function is:

```text
SECURITY DEFINER
search_path = public, pg_temp
```

Execution is revoked from:

```text
public
anon
authenticated
```

and granted only to:

```text
service_role
```

Browser clients must not invoke the Discussion persistence RPC directly.

## Validation

VS001-04 validates:

* content must be supplied as a string at the HTTP boundary,
* trimmed content must not be empty,
* content must not exceed 20,000 characters,
* project IDs must be valid UUIDs,
* optional thread-parent IDs must be valid UUIDs,
* a supplied thread parent must exist,
* the parent must belong to the same project,
* a deleted message cannot be used as a thread parent.

Content is trimmed before persistence.

## Correlation and Causation

Correlation flows through:

```text
HTTP request
  ->
RequestContext.correlationId
  ->
DiscussionService
  ->
DiscussionRepository
  ->
post_discussion_message(...)
  ->
domain_events.correlation_id
```

Live verification confirmed that the API response correlation ID matched the resulting `MessageCreated.v1` event correlation ID.

For the current human-originated HTTP command:

```text
causation_id = null
```

## Team Agent Boundary

Discussion message creation does not synchronously call Team Agent.

VS001-05 now implements the asynchronous continuation:

```text
Discussion transaction
  ->
MessageCreated.v1
  ->
domain-event fan-out
  ->
independent Team Agent delivery
  ->
worker
  ->
Team Agent task proposal
```

A downstream Team Agent failure does not roll back or prevent a successfully committed human Discussion message.

Discussion remains unaware of which downstream consumers subscribe to `MessageCreated.v1`.

## VS001-04 Verification

Live verification confirmed:

* authorised message creation returns HTTP `201`,
* one message row is created,
* one immutable version-1 row is created,
* one `MessageCreated.v1` event is created,
* message author, version editor, and event actor match the authenticated Cadence user,
* response and event correlation IDs match,
* whitespace-only content returns `400 VALIDATION_ERROR`,
* an invalid thread parent returns `400 VALIDATION_ERROR`,
* invalid operations leave no partial message row,
* a normal VIEWER lacking `message.create` receives `403 PERMISSION_DENIED`,
* the denied operation persists no message,
* the temporary Viewer fixture was removed after verification.

## Automated Tests

VS001-04 adds six substantive Discussion service unit tests.

Run:

```powershell
npm run typecheck
npm test
```

Verified result:

```text
Discussion tests: 6 passed
Discussion tests: 0 failed
```

The full Node test command now reports 20 passing entries after VS001-05 additions. Several module `*.test.ts` files remain placeholder test files, so the passing entry count should not be interpreted as uniform coverage across all modules.

## Current Limitations

VS001-04 does not yet implement:

* message listing,
* individual message retrieval,
* message-history retrieval,
* message editing or deletion,
* reactions,
* mentions,
* file-link handling,
* Discussion-specific audit processing,
* message-command idempotency.

The broader API contract includes `mention_user_ids` and `file_ids`, but VS001-04 does not yet implement those capabilities.

Automatic retries of state-changing Discussion commands should not be introduced until idempotency is implemented.

---

# VS001-05 Asynchronous Team Agent Task-Proposal Processing

Status:

**Implementation, live verification, automated tests, documentation, and source-control checkpoint complete.**

VS001-05 implements the first asynchronous downstream consumer in Cadence.

The verified flow is:

```text
Discussion message
  ->
MessageCreated.v1
  ->
domain-event subscription fan-out
  ->
per-consumer Team Agent delivery
  ->
one-shot worker
  ->
DomainEventProcessor
  ->
MessageCreatedV1Handler
  ->
exact immutable Discussion message version
  ->
TeamAgentService
  ->
completed AI run
  ->
pending task proposal
  ->
AIProposalCreated.v1
```

No authoritative Task is created in VS001-05.

Human review remains the boundary between AI-generated proposal state and authoritative project task state.

## Architectural Boundary

The following dependency must not exist:

```text
DiscussionService.postMessage()
  -X->
TeamAgentService
```

Discussion owns the message transaction and emits `MessageCreated.v1`.

Generic event infrastructure materialises consumer deliveries.

Team Agent consumes the event later.

This prevents Team Agent availability or execution failure from becoming a prerequisite for a human to post a Discussion message.

## New Database Migrations

VS001-05 adds four migrations:

```text
supabase/migrations/20260815200500_domain_event_deliveries.sql
supabase/migrations/20260815201000_domain_event_delivery_processing.sql
supabase/migrations/20260815202000_domain_event_subscriptions.sql
supabase/migrations/20260815203000_team_agent_task_proposals.sql
```

All four migrations have been applied to the linked remote Supabase database.

The final migration push completed successfully. A Docker catalogue/cache warning occurred after application because Docker Desktop was not running; the migration itself completed and the required database objects were verified directly.

## Domain Event Subscriptions

VS001-05 adds:

```text
public.domain_event_subscriptions
```

The first active subscription is:

```text
consumer_name = team-agent.message-created.v1
event_type = MessageCreated
event_version = 1
is_active = true
```

Subscription registration is infrastructure configuration.

Discussion does not register or call its consumers directly.

## Per-Consumer Deliveries

VS001-05 adds:

```text
public.domain_event_deliveries
```

Delivery identity is:

```text
event_id
+
consumer_name
```

This separates event fan-out state from downstream consumer-processing state.

Conceptually:

```text
MessageCreated.v1
        |
        +--> Team Agent delivery
        |
        +--> future Notifications delivery
        |
        +--> future Project Health delivery
```

Each consumer may independently be pending, processing, processed, or failed.

One consumer's status must not represent another consumer's status.

## Fan-Out Semantics

The database function:

```text
public.fan_out_domain_event()
```

runs after a domain event is inserted.

For each active matching subscription it creates a delivery row using conflict-safe insertion.

After fan-out, the domain event itself is marked:

```text
status = processed
```

This means:

```text
domain_events.status
```

represents completion of outbox fan-out, not completion of every downstream consumer.

Actual consumer state is represented by:

```text
domain_event_deliveries.status
```

This distinction is important when troubleshooting.

## Legacy Event Cutover

When VS001-05 subscriptions were introduced, old pre-VS001-05 pending events were explicitly marked processed before registering the new Team Agent subscription.

This was a deliberate cutover decision:

```text
no automatic replay of pre-VS001-05 pending events
```

The verified VS001-05 test message was created after the subscription existed and therefore received a normal Team Agent delivery.

## Delivery Claiming

Atomic claiming is performed through:

```text
public.claim_domain_event_delivery(...)
```

The claim uses PostgreSQL:

```text
FOR UPDATE OF d SKIP LOCKED
```

This allows concurrent workers to claim different available deliveries without claiming the same delivery simultaneously.

A claim records:

```text
status = processing
processing_attempts += 1
claimed_at
claim_token
lease_expires_at
```

The current default lease is:

```text
900 seconds
```

## Claim-Token and Lease Protection

The claim token prevents stale workers from completing another worker's reclaimed delivery.

Conceptually:

```text
Worker A claims delivery with token A
  ->
Worker A stalls
  ->
lease expires
  ->
Worker B reclaims with token B
  ->
Worker A later attempts completion with token A
  ->
rejected
```

Expired processing leases can be reclaimed.

## Delivery Completion and Failure

Successful completion uses:

```text
public.complete_domain_event_delivery(...)
```

and succeeds only when the supplied:

```text
event_id
consumer_name
claim_token
```

still identify the active processing claim.

Failure uses:

```text
public.fail_domain_event_delivery(...)
```

which stores:

```text
status = failed
last_error
available_at
```

and clears the active claim.

Failed deliveries remain retryable according to their availability timestamp.

## Generic Event Processing Infrastructure

Reusable application event-processing contracts are located under:

```text
apps/api/src/infrastructure/events/
```

Files:

```text
domain-event.ts
domain-event.handler.ts
domain-event.repository.ts
domain-event.processor.ts
domain-event.processor.test.ts
```

Database adapter:

```text
apps/api/src/infrastructure/database/supabase-domain-event.repository.ts
```

The shared `DomainEvent` envelope now includes:

```text
eventId
eventType
eventVersion
aggregateType
aggregateId
correlationId
causationId
occurredAt
actorType
actorId
projectId
payload
```

`DomainEventProcessor.processNext(handler)` performs:

```text
claim
  ->
handler
  ->
complete
```

On handler failure it attempts to mark the claim failed and then rethrows the processing error.

The generic processor contains no Team Agent business logic.

## Discussion Immutable-Version Query

`MessageCreated.v1` references the immutable Discussion message version rather than copying the full message body into the event.

VS001-05 adds:

```text
DiscussionService.getMessageVersion(
  projectId,
  messageId,
  versionNumber
)
```

and the corresponding Discussion repository query.

The Supabase Discussion adapter reads the exact immutable version while verifying the message belongs to the expected project.

Team Agent must not bypass this boundary by querying:

```text
public.messages
public.message_versions
```

directly.

This matters because an event referring to version 1 must still be processed against version 1 even if the message has subsequently been edited.

The current `getMessageVersion()` method is a trusted internal module query. If message-history retrieval is later exposed over HTTP, that HTTP path must perform its own project membership and RBAC checks.

## Team Agent Event Handler

Handler:

```text
apps/api/src/modules/team-agent/message-created.handler.ts
```

Consumer name:

```text
team-agent.message-created.v1
```

The handler validates:

```text
event_type = MessageCreated
event_version = 1
aggregate_type = message
project envelope consistency
message aggregate consistency
```

It validates that the payload's:

```text
project_id
message_id
version_number
```

match the event envelope and retrieves the exact Discussion version.

If the immutable version cannot be found, processing fails rather than silently using different content.

## Team Agent Service

The handler calls:

```text
TeamAgentService.processMessageForTaskProposal()
```

The current implementation is deliberately deterministic and is used to prove the architecture before external LLM integration.

Current model metadata:

```text
model_provider = cadence-development
model_name = deterministic-task-proposal-v1
prompt_version_id = null
```

The current implementation does not fabricate AI confidence.

```text
confidence = null
```

## Verified Development Proposal

Verified source message:

```text
Daniel, please finalise the syllabus by Friday.
```

Current deterministic proposal:

```text
title       = Daniel, please finalise the syllabus by Friday.
description = Daniel, please finalise the syllabus by Friday.
assigned_to = null
due_date    = null
confidence  = null
status      = pending
```

`assigned_to` is deliberately null because VS001-05 does not yet implement authoritative human-name-to-user resolution.

`due_date` is deliberately null because VS001-05 does not yet implement relative-date resolution with timezone/calendar context.

These values must not be guessed merely to make the proposal appear more complete.

## Team Agent Persistence

Repository contract:

```text
apps/api/src/modules/team-agent/team-agent.repository.ts
```

Supabase adapter:

```text
apps/api/src/infrastructure/database/supabase-team-agent.repository.ts
```

Persistence RPC:

```text
public.create_team_agent_task_proposal(...)
```

The function validates the source `MessageCreated.v1`, its project/message/correlation references, and the exact immutable message version before creating Team Agent state.

## AI Run Idempotency

VS001-05 adds:

```text
ai_runs.source_event_id
```

with a foreign key to:

```text
public.domain_events(id)
```

and a unique partial index:

```text
ai_runs_source_event_uidx
```

This makes the source event the idempotency key for the Team Agent run.

Normal retries of the same source event return the existing run/proposal rather than creating duplicates.

Database conflict handling also protects against a race between a stale worker and a newly reclaimed worker attempting the same source event concurrently.

## AI Proposal Persistence

The Team Agent persistence function creates:

```text
public.ai_runs
+
public.ai_proposals
```

The current task proposal is stored as:

```text
proposal_type = task
status = pending
```

A pending proposal is non-authoritative.

The function does not create or modify:

```text
public.tasks
```

## AIProposalCreated.v1

Successful persistence emits:

```text
AIProposalCreated.v1
```

with:

```text
aggregate_type = ai_proposal
aggregate_id = proposal_id
actor_type = agent
```

The event payload includes the proposal/run/source references required for downstream traceability.

The new event goes through the same generic fan-out infrastructure. If there are no active subscriptions for `AIProposalCreated.v1`, fan-out still completes and the domain-event status becomes processed.

## Correlation and Causation

The proposal event preserves the original business correlation ID.

Its causation ID is the source `MessageCreated.v1` event ID.

Verified chain:

```text
MessageCreated.v1
  event_id = 2cecb0d3-93a5-41b6-9a78-5c2fe32b5c32
  correlation_id = 0b02f7ba-649d-447d-862e-6f1f7bfd46bd
        |
        v
AIProposalCreated.v1
  event_id = d13d11b0-a8a2-45d4-8ac4-0012ad7f906b
  correlation_id = 0b02f7ba-649d-447d-862e-6f1f7bfd46bd
  causation_id = 2cecb0d3-93a5-41b6-9a78-5c2fe32b5c32
```

## One-Shot Worker

Entry point:

```text
apps/api/src/worker.ts
```

Command:

```powershell
npm run worker:once
```

The current worker:

```text
claims at most one Team Agent delivery
  ->
processes it
  ->
exits
```

It does not run a permanent polling loop.

If no delivery is available:

```text
Cadence worker: no pending Team Agent delivery.
```

A production worker-hosting model, scheduler, polling cadence, health monitoring, supervision, retry backoff, and horizontal scaling strategy remain future operational work.

## Live Verification

The following VS001-05 flow was verified against the linked Supabase database.

Source event:

```text
event_id =
2cecb0d3-93a5-41b6-9a78-5c2fe32b5c32

event_type =
MessageCreated

correlation_id =
0b02f7ba-649d-447d-862e-6f1f7bfd46bd

message_id =
e2f2d384-380b-4fd0-9dca-b3049600d1b3
```

Before processing:

```text
consumer_name = team-agent.message-created.v1
delivery_status = pending
processing_attempts = 0
```

After processing:

```text
delivery_status = processed
processing_attempts = 1
last_error = null
```

Created AI run:

```text
079dee92-d47f-4b66-8e24-e8f458552c70
```

Verified AI run:

```text
status = completed
model_provider = cadence-development
model_name = deterministic-task-proposal-v1
```

Created proposal:

```text
2312c92f-43aa-4584-ade7-532a49c3eb08
```

Verified proposal:

```text
proposal_type = task
status = pending
assigned_to = null
due_date = null
confidence = null
```

Created derived event:

```text
AIProposalCreated.v1
d13d11b0-a8a2-45d4-8ac4-0012ad7f906b
```

The derived event retained the original correlation ID and used the source message event as its causation ID.

## Duplicate-Safety Verification

For the verified source event:

```text
ai_run_count = 1
proposal_count = 1
```

A subsequent worker execution returned:

```text
Cadence worker: no pending Team Agent delivery.
```

This confirms the verified delivery was consumed once and did not produce duplicate run/proposal records.

## Automated Tests

Current verification:

```powershell
npm run typecheck
npm test
```

Result:

```text
typecheck = passed

tests = 20
pass = 20
fail = 0
cancelled = 0
skipped = 0
todo = 0
```

VS001-05 adds substantive coverage for:

```text
successful delivery claim/handle/complete
empty delivery queue
handler failure -> failed delivery
exact immutable Discussion version retrieval
missing immutable version
MessageCreated.v1 validation
event/payload project consistency
deterministic Team Agent proposal generation
```

Some other module `*.test.ts` files remain placeholders and should not be mistaken for deep coverage.

## VS001-05 Implementation Files

Team Agent:

```text
apps/api/src/modules/team-agent/team-agent.types.ts
apps/api/src/modules/team-agent/team-agent.repository.ts
apps/api/src/modules/team-agent/team-agent.service.ts
apps/api/src/modules/team-agent/message-created.handler.ts
apps/api/src/modules/team-agent/team-agent.test.ts
apps/api/src/modules/team-agent/README.md
```

Event infrastructure:

```text
apps/api/src/infrastructure/events/domain-event.ts
apps/api/src/infrastructure/events/domain-event.handler.ts
apps/api/src/infrastructure/events/domain-event.repository.ts
apps/api/src/infrastructure/events/domain-event.processor.ts
apps/api/src/infrastructure/events/domain-event.processor.test.ts
```

Database adapters:

```text
apps/api/src/infrastructure/database/supabase-domain-event.repository.ts
apps/api/src/infrastructure/database/supabase-discussion.repository.ts
apps/api/src/infrastructure/database/supabase-team-agent.repository.ts
```

Worker:

```text
apps/api/src/worker.ts
```

Package script:

```text
apps/api/package.json
```

Migrations:

```text
supabase/migrations/20260815200500_domain_event_deliveries.sql
supabase/migrations/20260815201000_domain_event_delivery_processing.sql
supabase/migrations/20260815202000_domain_event_subscriptions.sql
supabase/migrations/20260815203000_team_agent_task_proposals.sql
```

## Current VS001-05 Limitations

Not yet implemented:

* external LLM provider invocation,
* production model-provider integration,
* real prompt execution,
* prompt-version selection,
* AI confidence scoring,
* assignee name resolution,
* natural-language due-date resolution,
* proposal listing/review API,
* proposal editing,
* proposal confirmation,
* proposal rejection,
* `agent.approve` review flow,
* confirmed-proposal integration with `TasksService`,
* authoritative Task creation,
* continuous worker hosting and supervision.

These are deliberate boundaries and must not be represented as implemented capabilities.

---

# Module Boundary

For reviewed Team Agent task proposals, the established boundary is now implemented as:

```text
TeamAgentTaskMaterializationService
  ->
load confirmed/edited reviewed proposal
  ->
TasksService.createTask()
  ->
check task.create
  ->
check task.assign when required
  ->
TasksRepository
  ->
Tasks-owned persistence
  ->
TaskCreated.v1
```

Team Agent must never write directly to Tasks persistence.

Tasks owns:

* task creation,
* task state,
* assignment authorization,
* persistence,
* proposal-to-Task provenance,
* task domain events,
* task-creation idempotency.

`agent.approve` remains separate from `task.create` and `task.assign`.

This boundary was live-verified in VS001-07.

---

# Current VS-001 Progress

## Completed

* VS001-01 walking skeleton
* repository engineering structure
* Express API
* TypeScript API
* `/health`
* RequestContext
* request ID middleware
* correlation ID middleware
* shared DomainEvent type
* standard API response envelope
* module ownership documentation
* Team Agent to Tasks module boundary
* Supabase authentication provider
* bearer-token extraction
* JWT validation
* Cadence identity repository
* Cadence identity service
* `auth.users.id` to `public.users.auth_user_id` mapping
* disabled-user rejection
* unprovisioned-user rejection
* authenticated RequestContext
* `GET /api/v1/me`
* authentication diagnostic logging
* local `.env` configuration
* `.env.example`
* Git exclusion of secrets
* authentication manual testing
* Project RBAC types and repository contract
* Project RBAC service
* Supabase RBAC repository
* active project-membership resolution
* role-permission resolution
* `project.view` enforcement
* Project Workspace domain/read-model types
* Project Workspace repository contract
* Project Workspace service
* Project Workspace route
* Supabase Project Workspace read repository
* `GET /api/v1/projects/{projectId}/summary`
* Project Health integration
* Project Health baseline migration for existing projects
* authorized Project Workspace `200` verification
* cross-project `404` verification
* same-project missing-permission `403` verification
* Project Workspace temporary RBAC fixture cleanup
* final Project Workspace live sanity check
* VS001-04 Discussion message types
* VS001-04 Discussion repository contract
* `DiscussionService.postMessage()`
* Supabase Discussion repository
* Discussion HTTP router
* `POST /api/v1/projects/{projectId}/messages`
* `message.create` enforcement
* message-content validation
* optional thread-parent validation
* atomic message creation
* immutable message version 1 creation
* `MessageCreated.v1` persistence
* Discussion correlation-ID propagation
* Discussion database defence-in-depth authorization
* service-role-only Discussion write RPC
* successful Discussion `201` live verification
* Discussion `400 VALIDATION_ERROR` verification
* Discussion `403 PERMISSION_DENIED` verification
* Discussion no-partial-write verification
* temporary Viewer fixture cleanup
* six substantive Discussion service unit tests
* VS001-04 Discussion README documentation
* VS001-05 per-consumer domain-event subscriptions
* VS001-05 per-consumer delivery persistence
* transactional event fan-out
* atomic delivery claiming with `FOR UPDATE SKIP LOCKED`
* processing lease and claim-token protection
* delivery completion/failure RPCs
* generic `DomainEventRepository`
* generic `DomainEventHandler`
* generic `DomainEventProcessor`
* Supabase domain-event repository
* expanded shared DomainEvent envelope
* Discussion immutable message-version query
* `MessageCreatedV1Handler`
* Team Agent service/repository task-proposal boundary
* deterministic development proposal generator
* Supabase Team Agent repository
* `ai_runs.source_event_id` idempotency
* idempotent Team Agent task-proposal persistence RPC
* pending AI task proposal persistence
* `AIProposalCreated.v1`
* correlation and causation continuity across Discussion and Team Agent
* one-shot `worker:once` composition root
* live VS001-05 Supabase verification
* duplicate-safety verification
* 61 passing automated test entries at the latest reported VS001-09 implementation gate
* TypeScript type checking
* Team Agent README documentation
* `CHANGELOG.md`
* `HANDOFF.md`
* VS001-06 human proposal review with confirm/edit/reject and `agent.approve` enforcement
* VS001-07 authoritative Task creation through `TasksService`
* independent `task.create` / conditional `task.assign` enforcement
* Tasks-owned proposal idempotency and provenance
* `TaskCreated.v1` with review-event correlation and causation
* live fresh Discussion -> proposal -> human review -> authoritative Task verification
* VS001-08 authenticated `GET /api/v1/me/tasks`
* Tasks-owned My Tasks read-model contract through `TasksService.listMyTasks()`
* `task.view` enforcement for My Tasks visibility
* service-role-only `public.list_my_tasks(uuid)`
* My Tasks migration `20260817101500_my_tasks_read_model.sql`
* unauthenticated My Tasks `401` verification
* live assigned open Task visibility for Alice
* live fresh Discussion -> proposal -> human assignment -> authoritative Task -> My Tasks verification
* VS001-09 independent Audit domain-event consumer `audit.domain-events.v1`
* idempotent projection of six material VS-001 event types into `public.audit_events`
* historical Audit backfill
* 20 supported domain events -> 20 Audit projections -> 0 missing
* service-role-only `public.project_domain_event_to_audit(uuid)`
* service-role-only `public.get_task_audit_journey(...)`
* authenticated Task Audit endpoint
* `audit.view` application authorization
* `audit.view` database revalidation
* complete Task business-journey reconstruction
* live 4-event / 2-correlation reconstruction verification
* separation of current Audit HTTP request correlation from historical journey correlations

# VS001-06 Human Proposal Review

Status:

**Implementation, remote database deployment, automated verification, live confirm/edit/reject verification, documentation, and source-control checkpoint complete.**

VS001-06 implements the human-review boundary for Team Agent task proposals while keeping proposals non-authoritative with respect to Tasks.

Verified flow:

```text
pending Team Agent task proposal
  ->
authenticated project member
  ->
agent.approve
  ->
confirm / edit / reject
  ->
reviewed proposal state
```

No VS001-06 review operation creates or modifies an authoritative Task.

## API

Authenticated endpoint:

```text
POST /api/v1/projects/{projectId}/task-proposals/{proposalId}/review
```

Supported actions:

```text
confirm
edit
reject
```

The authoritative reviewer identity comes from:

```text
RequestContext.actorUserId
```

## Authorization

Application authorization:

```text
TeamAgentService.reviewTaskProposal()
  ->
RbacService.getProjectAccess()
  ->
active project membership
  ->
agent.approve
```

The database persistence function revalidates the same `agent.approve` permission immediately before persistence.

Permission codes remain the authorization primitive. Role names are not hard-coded into review logic.

## Proposal Review State

VS001-06 adds:

```text
public.ai_proposals.reviewed_payload
```

The original AI proposal remains in:

```text
payload
```

State rules:

```text
pending
  reviewed_payload = null

confirmed
  reviewed_payload = original AI payload

edited
  reviewed_payload = final human-reviewed payload

rejected
  reviewed_payload = null
```

All terminal review outcomes record:

```text
reviewed_by
reviewed_at
```

## Provenance

Human edit may change task proposal values such as title and description but may not rewrite:

```text
source_message_id
source_message_version_id
```

This preserves the Discussion -> AI proposal lineage after human modification.

## Atomic Review Persistence

Primary function:

```text
public.review_team_agent_task_proposal(...)
```

The function:

* validates stable references and review action,
* revalidates `agent.approve`,
* locks the proposal using `FOR UPDATE`,
* accepts only `pending` proposals,
* records the review outcome,
* preserves original AI payload,
* records reviewer and timestamp,
* emits the corresponding review domain event,
* performs no Tasks persistence.

The function remains restricted to trusted service-role execution.

## VS001-06 Migrations

```text
supabase/migrations/20260816024841_team_agent_human_proposal_review.sql
supabase/migrations/20260816082249_fix_team_agent_review_column_ambiguity.sql
```

Both are synchronized with the linked remote Supabase database.

### Corrective migration

The first live confirm request reached the database successfully but exposed a PostgreSQL naming ambiguity:

```text
column reference "project_id" is ambiguous
```

Cause:

`RETURNS TABLE` created a PL/pgSQL output variable named `project_id`, while the proposal query used an unqualified column with the same name.

The failed transaction rolled back; the proposal remained pending with no partial reviewer state.

The corrective migration qualifies proposal-table column references explicitly and preserves the intended review behaviour.

## Review Domain Events

VS001-06 adds:

```text
AIProposalConfirmed.v1
AIProposalEdited.v1
AIProposalRejected.v1
```

Review events use:

```text
aggregate_type = ai_proposal
aggregate_id = proposal ID
actor_type = human
actor_id = authenticated reviewer
```

and preserve the request correlation ID.

## Live Confirm Verification

Proposal:

```text
2312c92f-43aa-4584-ade7-532a49c3eb08
```

Verified:

```text
pending -> confirmed
reviewed_payload = original AI payload
reviewed_by = afec9f7c-eb66-46b9-9668-cb57b26394b5
reviewed_at populated
AIProposalConfirmed.v1 emitted
```

## Live Edit Verification

Proposal:

```text
def8f97f-adf7-444a-a1dd-919b3467464b
```

Verified:

```text
pending -> edited
original payload unchanged
reviewed title = Finalise revised syllabus for faculty review
reviewed description stored separately
source_message_id unchanged
source_message_version_id unchanged
AIProposalEdited.v1 emitted
```

## Live Reject Verification

Proposal:

```text
90b6a7b3-2e57-436e-af74-8821482cdb65
```

Verified:

```text
pending -> rejected
reviewed_payload = null
reviewer/timestamp recorded
AIProposalRejected.v1 emitted
```

## Tasks Boundary Verification

The live review flow did not create a new `public.tasks` row.

The only inspected Task in the test project predates VS001-06 review activity.

Required boundary remains:

```text
Team Agent
  ->
human-reviewed proposal
  ->
later TasksService integration
```

and never:

```text
Team Agent -> public.tasks
```

## Automated Verification

Latest gate:

```text
npm run typecheck -> pass
npm test          -> 29 tests / 29 pass / 0 fail
git diff --check  -> clean
```

VS001-06 tests cover confirm, edit, reject, permission denial, non-membership, missing edit payload, empty title, and invalid confirm/reject payload usage.

## VS001-06 Implementation Files

```text
apps/api/src/infrastructure/database/supabase-team-agent.repository.ts
apps/api/src/modules/team-agent/team-agent.errors.ts
apps/api/src/modules/team-agent/team-agent.repository.ts
apps/api/src/modules/team-agent/team-agent.routes.ts
apps/api/src/modules/team-agent/team-agent.service.ts
apps/api/src/modules/team-agent/team-agent.test.ts
apps/api/src/modules/team-agent/team-agent.types.ts
apps/api/src/server.ts
apps/api/src/worker.ts
supabase/migrations/20260816024841_team_agent_human_proposal_review.sql
supabase/migrations/20260816082249_fix_team_agent_review_column_ambiguity.sql
```

## VS001-06 Source-Control Checkpoint

VS001-06 was committed and pushed before VS001-07 began.

Checkpoint commit:

```text
3cdf5ef feat(team-agent): add human proposal review
```

VS001-07 subsequently implemented the reviewed-proposal-to-authoritative-Task continuation described below.

---

# VS001-07 Authoritative Task Creation

Status:

**Implementation, remote database deployment, automated verification, live end-to-end verification, documentation, and source-control checkpoint complete.**

VS001-07 completes the reviewed-proposal-to-authoritative-Task boundary.

Verified flow:

```text
confirmed / edited proposal
  ->
TeamAgentTaskMaterializationService
  ->
TasksService
  ->
task.create
  ->
task.assign when required
  ->
SupabaseTasksRepository
  ->
public.create_authoritative_task(...)
  ->
authoritative Task
  ->
TaskCreated.v1
```

## API

```text
POST /api/v1/projects/{projectId}/task-proposals/{proposalId}/task
```

First creation returns HTTP `201` with `created = true`.

Idempotent retry returns HTTP `200` with `created = false` and the same Task.

## Authorization

`TasksService` independently enforces `task.create` and, when an assignee is supplied, `task.assign`.

`agent.approve` does not imply either Tasks permission.

The Tasks-owned database function repeats the permission checks for defence in depth.

## Module Ownership

The required dependency direction is:

```text
Team Agent
  ->
TasksService
  ->
TasksRepository
  ->
SupabaseTasksRepository
  ->
Tasks-owned persistence
```

A source scan confirmed that the Team Agent module does not reference `TasksRepository`, `SupabaseTasksRepository`, or `public.tasks`.

## Reviewed Values

Only `confirmed` and `edited` proposals may materialize.

Authoritative Task candidate values come from `ai_proposals.reviewed_payload`.

Pending, rejected, and expired proposals are rejected.

## Database Migration

```text
supabase/migrations/20260816123000_authoritative_task_creation.sql
```

The migration adds `public.create_authoritative_task(...)` and Tasks-specific proposal-to-Task idempotency protection.

The RPC is restricted to trusted `service_role` execution.

## Idempotency and Provenance

One AI proposal may create at most one authoritative Task.

Tasks records proposal provenance through `public.source_links`.

Team Agent records the resulting authoritative entity through `ai_proposals.result_entity_type` and `result_entity_id` only after TasksService succeeds.

Retries return the existing Task and do not emit a duplicate `TaskCreated.v1`.

## Live Verification

Confirmed proposal:

```text
2312c92f-43aa-4584-ade7-532a49c3eb08
```

created Task:

```text
8e7e70dd-d650-4c7d-a605-ff6ad2a68eae
```

Retry returned the same Task with `created = false` and one `TaskCreated.v1` total.

Edited proposal:

```text
def8f97f-adf7-444a-a1dd-919b3467464b
```

created Task:

```text
4b4ed424-c4f7-4aab-bbad-138e0b609ab4
```

using the final human-reviewed title and description.

A transaction-scoped negative test with `task.create = true` and `task.assign = false` returned `TASK_ASSIGN_PERMISSION_DENIED` and produced zero Task, source-link, or TaskCreated writes.

Fresh end-to-end API verification used:

```text
Discussion message = 591a4b9f-26f6-46f1-b9cf-13f943f77999
proposal           = fce47383-11c0-4be0-863e-8a0277fb6bc4
Task               = 3169f627-3fcc-4141-a3b7-c6f93cbd84b0
```

First materialization returned:

```text
HTTP 201
created = true
```

Final database lineage verified:

```text
result_entity_type = task
result_entity_id = authoritative Task ID
source_type = ai_proposal
source_link_count = 1
TaskCreated.v1 count = 1
```

Review event:

```text
AIProposalConfirmed.v1
329ed710-5278-430d-901b-8ea757b05a2e
correlation = b67f55ed-24f9-40dc-b11f-318c7771cd02
```

Task event:

```text
TaskCreated.v1
3a44204f-3b20-4548-9b9e-20dcc0692b53
correlation = b67f55ed-24f9-40dc-b11f-318c7771cd02
causation = 329ed710-5278-430d-901b-8ea757b05a2e
```

## Correlation Boundary Resolved by VS001-09

VS001-07 correctly continues the human-review correlation into `TaskCreated.v1`.

The fresh Discussion request used a different correlation ID from the later human-review request. VS001-09 established that this is truthful behaviour rather than a defect.

Cadence now distinguishes:

```text
request correlation
    = one technical request / processing context

business journey
    = a logical workflow reconstructed from durable evidence
```

The complete Discussion-to-Task journey may therefore span multiple correlation IDs.

VS001-09 reconstructs the journey through provenance, aggregate identity, causation, and Audit projection without rewriting the original correlations.

## Automated Verification

```text
npm run typecheck -> pass
npm test          -> 51 tests / 51 pass / 0 fail
```

## Implementation Files

```text
apps/api/src/modules/tasks/tasks.types.ts
apps/api/src/modules/tasks/tasks.errors.ts
apps/api/src/modules/tasks/tasks.repository.ts
apps/api/src/modules/tasks/tasks.service.ts
apps/api/src/modules/tasks/tasks.test.ts
apps/api/src/infrastructure/database/supabase-tasks.repository.ts
apps/api/src/modules/team-agent/team-agent-materialization.repository.ts
apps/api/src/modules/team-agent/team-agent-task-materialization.service.ts
apps/api/src/modules/team-agent/team-agent-task-materialization.routes.ts
apps/api/src/modules/team-agent/team-agent-task-materialization.test.ts
apps/api/src/infrastructure/database/supabase-team-agent-materialization.repository.ts
apps/api/src/server.ts
supabase/migrations/20260816123000_authoritative_task_creation.sql
```


---

# VS001-08 My Tasks Read Model

Status:

**Implementation, remote database deployment, automated verification, live end-to-end verification, documentation, and source-control checkpoint complete.**

VS001-08 checkpoint commit:

```text
85a05e9 feat(tasks): add my tasks read model
```

VS001-08 implements the authenticated current-actionable-task read model required by the vertical slice.

## API

```text
GET /api/v1/me/tasks
```

The endpoint is authenticated.

The client cannot supply another user ID.

The authoritative target identity comes from:

```text
RequestContext.actorUserId
```

The standard success envelope includes:

```text
correlation_id
request_id
next_cursor = null
```

## Read Contract

The endpoint returns Tasks where:

```text
assigned_to = authenticated Cadence user
status IN (open, in_progress)
```

and where the user's current project access includes:

```text
task.view
```

This is intentionally a narrow current-actionable-task read model rather than a general Task-history API.

Completed and cancelled Tasks are outside the current My Tasks read model.

## Architecture

The dependency direction is:

```text
Tasks route
  ->
TasksService.listMyTasks()
  ->
TasksRepository.listMyTasks()
  ->
SupabaseTasksRepository.listMyTasks()
  ->
public.list_my_tasks(...)
```

The Tasks module owns the read model.

Team Agent is not involved in Task retrieval.

The existing authoritative creation boundary remains unchanged:

```text
Team Agent
  ->
TasksService
  ->
Tasks-owned persistence
```

## Authorization

My Tasks visibility requires current:

```text
task.view
```

for the Task's project.

Assignment alone is not treated as sufficient authorization.

The database read function uses the existing project-permission helper, which in turn requires active project membership, an active user, and the current role permission.

The application does not accept a client-supplied user identity for My Tasks.

## Database Migration

```text
supabase/migrations/20260817101500_my_tasks_read_model.sql
```

The migration adds:

```text
public.list_my_tasks(uuid)
```

The function:

* restricts results to the supplied authenticated Cadence user;
* returns only `open` and `in_progress` Tasks;
* requires current `task.view` project permission;
* orders due Tasks first with null due dates last;
* uses deterministic creation-time and Task-ID tie-breaking.

Current ordering is:

```text
due_date ASC NULLS LAST
created_at DESC
id ASC
```

The RPC is revoked from:

```text
public
anon
authenticated
```

and granted only to:

```text
service_role
```

Browser clients must not call this server-side read function directly.

## Live Verification

Authenticated test identity:

```text
Alice Test
afec9f7c-eb66-46b9-9668-cb57b26394b5
```

Anonymous access was verified:

```text
GET /api/v1/me/tasks
  ->
401
```

Authenticated My Tasks initially returned Alice's existing open assigned Task.

The three previously verified VS001-07 authoritative Tasks were inspected and found to be:

```text
status = open
assigned_to = null
```

They correctly did not appear in Alice's My Tasks response.

A fresh complete vertical-slice verification then used:

```text
Discussion message =
b6494274-379e-4347-9109-ae843cba9b9a

Team Agent proposal =
f82e2320-45d8-42b8-9dd2-e7280d857c51

authoritative Task =
c132b53e-e9b9-4389-81bc-6d4011bf1e2f
```

The deterministic Team Agent initially generated:

```text
status = pending
assigned_to = null
```

Alice's verified project permissions for this acceptance path were:

```text
agent.approve = true
task.create   = true
task.assign   = true
task.view     = true
```

Human review used:

```text
action = edit
assigned_to = afec9f7c-eb66-46b9-9668-cb57b26394b5
```

and completed as:

```text
status = edited
```

Authoritative materialization through the established Tasks boundary returned:

```text
created = true
status = open
assigned_to = Alice
```

The resulting Task was:

```text
c132b53e-e9b9-4389-81bc-6d4011bf1e2f
```

The exact Task was then returned by:

```text
GET /api/v1/me/tasks
```

Final assertions:

```text
exact Task visible = true
assigned_to matches authenticated Alice = true
```

This proves:

```text
Discussion
  ->
MessageCreated.v1
  ->
Team Agent task proposal
  ->
human review and assignment
  ->
TasksService
  ->
authoritative Task
  ->
GET /me/tasks
```

## Automated Verification

Latest gate:

```text
npm run typecheck -> pass
npm test          -> 53 tests / 53 pass / 0 fail
```

New Tasks coverage verifies:

```text
My Tasks uses authenticated actor identity
empty visible-task result is handled correctly
```

## VS001-08 Implementation Files

```text
apps/api/src/modules/tasks/tasks.repository.ts
apps/api/src/modules/tasks/tasks.service.ts
apps/api/src/modules/tasks/tasks.routes.ts
apps/api/src/modules/tasks/tasks.test.ts
apps/api/src/infrastructure/database/supabase-tasks.repository.ts
apps/api/src/server.ts
supabase/migrations/20260817101500_my_tasks_read_model.sql
```

## VS001-08 Definition of Done

```text
[x] authenticated GET /api/v1/me/tasks exists
[x] caller cannot supply another user identity
[x] RequestContext.actorUserId scopes My Tasks
[x] only open/in_progress Tasks are part of the read model
[x] task.view is enforced by the server-side read model
[x] database read function is service_role only
[x] deterministic ordering is defined
[x] remote migration is synchronized
[x] unauthenticated request returns 401
[x] authenticated assigned Task visibility is live-verified
[x] unassigned Tasks are excluded
[x] fresh reviewed proposal can assign authenticated user
[x] fresh authoritative Task is visible through My Tasks
[x] TypeScript typecheck passes
[x] all 53 automated tests pass
```

---

# VS001-09 Complete Audit Reconstruction

Status:

**Implementation, both remote migrations, direct database reconstruction, authenticated API reconstruction, post-hardening verification, documentation, and source-control checkpoint complete.**

VS001-09 completes the backend Audit portion of the vertical slice.

The verified business journey is:

```text
Discussion
  ->
MessageCreated.v1
  ->
AIProposalCreated.v1
  ->
human proposal review
  ->
AIProposalEdited.v1 / AIProposalConfirmed.v1
  ->
TaskCreated.v1
  ->
Audit reconstruction
```

## Audit Ownership

Audit owns:

```text
audit projection
audit reconstruction
audit-facing views
```

Audit does not own authoritative:

```text
Discussion state
AI proposal state
Task state
project membership
RBAC state
```

Business modules continue to create authoritative state and versioned domain events.

Audit consumes those records.

The dependency direction is:

```text
business module
  ->
domain event
  ->
independent Audit delivery
  ->
Audit projection
  ->
audit_events
```

Business modules must not call Audit directly.

## Audit Projection Consumer

Consumer:

```text
audit.domain-events.v1
```

Supported v1 events:

```text
MessageCreated
AIProposalCreated
AIProposalConfirmed
AIProposalEdited
AIProposalRejected
TaskCreated
```

Projection function:

```text
public.project_domain_event_to_audit(uuid)
```

The function is restricted to:

```text
service_role
```

Projection uses:

```text
audit_events.event_id = domain event ID
```

as the idempotency key.

Because `audit_events.event_id` is unique, duplicate delivery does not create duplicate Audit records.

## Audit Projection Migration

Migration:

```text
supabase/migrations/20260817120000_audit_domain_event_projection.sql
```

The migration:

* creates the projection function;
* registers the Audit consumer subscriptions;
* projects the six supported VS-001 event types;
* retains actor, project, entity, correlation, causation, state, and event metadata;
* preserves the original domain-event occurrence time;
* backfills existing supported domain events;
* keeps RPC execution restricted to trusted server-side service-role access.

The migration is synchronized with the linked remote Supabase database.

## Historical Backfill

New subscriptions do not automatically replay domain events that already existed before registration.

VS001-09 therefore performs an explicit supported-event backfill.

Live verification:

```text
supported domain events = 20
projected Audit events  = 20
missing projections     = 0
```

Six active `audit.domain-events.v1` subscriptions were also verified.

## Correlation Model

VS001-09 resolves the earlier one-correlation-ID question.

The verified workflow contains two truthful historical request correlations.

First context:

```text
MessageCreated.v1
  correlation = b1e9c88c-0b50-44fa-9392-d8ca11395a00
        |
        v
AIProposalCreated.v1
  correlation = b1e9c88c-0b50-44fa-9392-d8ca11395a00
```

Later human-review context:

```text
AIProposalEdited.v1
  correlation = ea7ff31c-ad52-405c-9d1f-b2cc2f73b512
        |
        v
TaskCreated.v1
  correlation = ea7ff31c-ad52-405c-9d1f-b2cc2f73b512
```

This is expected.

Do not force the later review request to reuse the earlier Discussion request correlation.

The correct rule is:

```text
One business journey
    !=
One HTTP correlation
```

Instead:

```text
One business journey
    =
durable provenance
+ aggregate identity
+ causation
+ Audit projection
+ one or more truthful request correlations
```

## Reconstruction Path

For a Task created from a Team Agent proposal:

```text
Task
  ->
source_links
  ->
AI Proposal
  ->
AI Run
  ->
source_event_id
  ->
MessageCreated.v1
```

Proposal lifecycle events are connected using:

```text
aggregate_type = ai_proposal
aggregate_id = proposal ID
```

`TaskCreated.v1` preserves causation to the successful proposal-review event.

This provides a durable cross-request reconstruction path.

## Reconstruction RPC

Migration:

```text
supabase/migrations/20260817140000_audit_task_journey_reconstruction.sql
```

Function:

```text
public.get_task_audit_journey(
  p_project_id uuid,
  p_task_id uuid,
  p_requesting_user_id uuid
)
```

The function:

* validates required references;
* revalidates `audit.view`;
* finds Task-to-proposal provenance;
* resolves the AI run;
* resolves the originating `MessageCreated.v1`;
* includes the AI proposal lifecycle;
* includes authoritative `TaskCreated.v1`;
* joins corresponding Audit projections;
* returns the journey chronologically.

The RPC is restricted to:

```text
service_role
```

The migration is synchronized with the linked remote Supabase database.

## Audit API

Endpoint:

```text
GET /api/v1/projects/{projectId}/tasks/{taskId}/audit
```

Required permission:

```text
audit.view
```

Application flow:

```text
authenticated RequestContext
  ->
AuditQueryService
  ->
RbacService.getProjectAccess()
  ->
audit.view
  ->
SupabaseAuditRepository
  ->
get_task_audit_journey(...)
```

The database rechecks `audit.view` for defence in depth.

The route validates project and Task UUIDs and maps expected Audit errors into the standard API error envelope.

## Live Verified Journey

Project:

```text
ff571613-672d-4424-813c-5114bdca53a4
```

Task:

```text
c132b53e-e9b9-4389-81bc-6d4011bf1e2f
```

Reconstructed events:

```text
1. MessageCreated.v1
2. AIProposalCreated.v1
3. AIProposalEdited.v1
4. TaskCreated.v1
```

Direct database verification returned:

```text
event_count       = 4
correlation_count = 2
```

All four domain events joined to their corresponding Audit records.

## Audit API Verification

A live authenticated Audit request deliberately supplied:

```text
X-Correlation-ID =
aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
```

The response returned:

```text
success = true
journey.events.Count = 4
journey.correlation_count = 2
```

Historical journey correlations:

```text
b1e9c88c-0b50-44fa-9392-d8ca11395a00
ea7ff31c-ad52-405c-9d1f-b2cc2f73b512
```

Current request correlation:

```text
aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
```

Verification:

```text
journey.correlation_ids -contains meta.correlation_id
=
False
```

This proves the Audit inspection request is not confused with the historical business workflow being inspected.

## Automated Tests

VS001-09 adds coverage for:

```text
supported Audit domain-event projection
idempotent existing projection
unsupported event rejection
unsupported version rejection
missing project provenance
multi-correlation journey reconstruction
inaccessible project handling
audit.view authorization
missing Task journey handling
```

Latest reported automated implementation gate:

```text
npm run typecheck -> pass
npm test          -> 61 tests / 61 pass / 0 fail
```

Because Audit route hardening and documentation changes followed that reported gate, rerun typecheck and all tests before commit.

## VS001-09 Implementation Files

```text
apps/api/src/modules/audit/audit.repository.ts
apps/api/src/modules/audit/audit.service.ts
apps/api/src/modules/audit/audit.types.ts
apps/api/src/modules/audit/audit.errors.ts
apps/api/src/modules/audit/audit.test.ts
apps/api/src/modules/audit/audit-domain-event.handler.ts
apps/api/src/modules/audit/audit-query.repository.ts
apps/api/src/modules/audit/audit-query.service.ts
apps/api/src/modules/audit/audit-query.test.ts
apps/api/src/modules/audit/audit.routes.ts
apps/api/src/modules/audit/README.md
apps/api/src/infrastructure/database/supabase-audit.repository.ts
apps/api/src/worker.ts
apps/api/src/server.ts
supabase/migrations/20260817120000_audit_domain_event_projection.sql
supabase/migrations/20260817140000_audit_task_journey_reconstruction.sql
```

## VS001-09 Definition of Done

```text
[x] Audit consumer exists
[x] six material VS-001 event types subscribed
[x] idempotent Audit projection exists
[x] Audit backfill exists
[x] 20 supported events -> 20 Audit rows -> 0 missing
[x] Audit worker integration exists
[x] Task journey reconstruction RPC exists
[x] audit.view checked application-side
[x] audit.view revalidated database-side
[x] Task Audit HTTP endpoint exists
[x] complete four-event Task journey reconstructed
[x] two truthful historical correlations preserved
[x] current Audit request correlation kept separate
[x] direct database reconstruction live-verified
[x] authenticated Audit API reconstruction live-verified
[x] post-hardening Audit happy path live-verified
[x] Audit README updated
[x] final post-documentation/post-hardening typecheck rerun
[x] final post-documentation/post-hardening test rerun
[x] final staged diff and secret scan
[x] VS001-09 commit and push
```

---

# VS001-10G Authoritative Task Materialisation

Status:

Browser integration, automated verification, and live acceptance verification are complete. Final documentation and source-control checkpoint are in progress.

VS001-10G connects the browser human-review flow to the authoritative Task creation boundary already established by VS001-07.

The verified browser flow is:

pending Team Agent task proposal
  ->
human review
  ->
confirm / edit + approve / reject
  ->
review API
  ->
confirmed / edited proposal
  ->
authoritative materialisation API
  ->
TeamAgentTaskMaterializationService
  ->
TasksService
  ->
Tasks-owned persistence
  ->
authoritative Task
  ->
TaskCreated.v1

Rejected proposals stop after review and do not create Tasks.

## Browser Integration

The browser proposal-review component now automatically calls:

POST /api/v1/projects/{projectId}/task-proposals/{proposalId}/task

after a successful Confirm or Edit + Approve operation.

This endpoint and its backend architecture already existed from VS001-07.

VS001-10G does not introduce another Task creation service or another database write path.

## Required Module Boundary

The required dependency direction remains:

browser
  ->
Team Agent HTTP materialisation route
  ->
TeamAgentTaskMaterializationService
  ->
TasksService
  ->
TasksRepository
  ->
SupabaseTasksRepository
  ->
public.create_authoritative_task(...)

Team Agent must not write directly to public.tasks.

## Review and Task Authorization

Human proposal review requires:

agent.approve

Authoritative Task creation independently requires:

task.create

When the reviewed proposal assigns a user, Task creation also requires:

task.assign

agent.approve must never be interpreted as implicit Task authorization.

## Partial-Success Semantics

Review and Task materialisation are distinct protected operations.

A browser may observe:

review successfully committed
  ->
Task materialisation response lost or Task creation fails

The UI therefore distinguishes review success from Task-materialisation failure.

It provides a safe Task-creation retry.

The retry is safe because the Tasks module owns idempotency by AI-proposal source.

If a Task already exists, the authoritative endpoint returns the same Task with created = false rather than creating a duplicate.


## Automated Verification

API verification:

npm run typecheck
  -> passed

targeted authoritative materialisation tests
  -> 11 passed
  -> 0 failed

npm test
  -> 64 passed
  -> 0 failed

Web verification:

npm run build
  -> passed

npm run lint
  -> 0 warnings
  -> 0 errors

git diff --check was also clean before documentation updates.


## Live Acceptance Verification

Browser-reviewed proposal:

a9beb552-5d4c-469d-a8e7-d250879892c3

Review outcome:

status = confirmed
reviewed_by = afec9f7c-eb66-46b9-9668-cb57b26394b5

Resulting authoritative Task:

8d26632d-1ac1-4516-84f7-019aab307eab

Proposal result linkage:

result_entity_type = task
result_entity_id = 8d26632d-1ac1-4516-84f7-019aab307eab

Task provenance:

entity_type = task
entity_id = 8d26632d-1ac1-4516-84f7-019aab307eab
source_type = ai_proposal
source_id = a9beb552-5d4c-469d-a8e7-d250879892c3

Verified uniqueness:

task_links = 1
task_created_events = 1

Human-review event:

AIProposalConfirmed.v1
event_id = 4857a3fe-012f-4983-803d-d1b1c99ea898
correlation_id = 90ef1d6e-9345-4fad-aea9-742ee5fc05e4

Task event:

TaskCreated.v1
event_id = 8e04a51b-68f6-41bf-a428-c6c295584d84
correlation_id = 90ef1d6e-9345-4fad-aea9-742ee5fc05e4
causation_id = 4857a3fe-012f-4983-803d-d1b1c99ea898

This verifies that TaskCreated.v1 preserves the successful human-review correlation and directly references the successful human-review event as its causation.

## Historical Development Data Watch Item

Development-era data contains older reviewed proposals that predate the complete browser-materialisation flow.

Confirmed proposal:

5b6df7fe-ec92-458a-9a11-fe4fb62325f6

currently has no recorded resulting Task.

Edited proposal:

def8f97f-adf7-444a-a1dd-919b3467464b

has an authoritative Task and source provenance but currently has a null proposal-side result entity.

This historical state does not invalidate VS001-10G.

It demonstrates why Task materialisation retry and later reconciliation must remain idempotent.

Do not repair these records by directly creating or modifying authoritative Tasks through Team Agent persistence.

Any later reconciliation must preserve the Tasks module as the authoritative boundary and must remain retry-safe.

## VS001-10G Definition of Done

[x] browser proposal review integrated
[x] Confirm automatically continues to Task materialisation
[x] Edit + Approve automatically continues to Task materialisation
[x] Reject does not materialise a Task
[x] existing TasksService boundary is reused
[x] no duplicate authoritative Task persistence path introduced
[x] Team Agent does not write directly to Tasks persistence
[x] agent.approve remains separate from task.create
[x] task.assign remains independently enforced when required
[x] reviewed_payload supplies authoritative candidate values
[x] authoritative Task materialisation remains idempotent
[x] browser distinguishes review success from Task-materialisation failure
[x] safe Task-materialisation retry exists
[x] proposal result linkage live-verified
[x] Task provenance live-verified
[x] exactly one Task link live-verified
[x] exactly one TaskCreated.v1 live-verified
[x] human-review correlation continuity live-verified
[x] TaskCreated.v1 causation to human-review event live-verified
[x] API typecheck passed
[x] targeted materialisation suite passed: 11/11
[x] complete API suite passed: 64/64
[x] web production build passed
[x] web lint passed with zero warnings and zero errors
[x] live browser-driven authoritative Task materialisation verified

# Not Yet Implemented in VS-001

The following work remains outstanding or deliberately deferred:

* external LLM provider integration
* prompt execution and prompt-version selection
* assignee name resolution
* natural-language due-date resolution
* AI confidence scoring
* continuous production worker hosting and supervision
* automated regression coverage for manually verified authentication paths
* automated regression coverage for Project Workspace integration paths
* broader database-backed integration coverage
* Discussion listing/history/editing/deletion/reactions/mentions/file-link handling
* Discussion command idempotency
* `mention_user_ids` handling
* `file_ids` handling
* general Task listing and Task-history APIs beyond the narrow My Tasks read model

Authoritative Task creation from reviewed proposals is implemented and must not be listed as deferred work.

Authenticated My Tasks visibility is implemented and must not be listed as deferred work.

Complete Audit reconstruction is implemented and must not be listed as deferred work.

The one-correlation-ID question is resolved: a complete business journey may truthfully span multiple request correlations and is reconstructed through durable provenance, aggregate identity, causation, and Audit projection.

---

# Security Rules

1. Never commit `.env`.
2. Never commit Supabase secret keys.
3. Never expose Supabase server secrets to browser clients.
4. Authentication must not imply project authorization.
5. Protected project operations must evaluate RBAC server-side.
6. Do not trust project IDs supplied by clients without authorization checks.
7. Do not trust client-supplied user IDs as the authenticated actor.
8. Use `RequestContext.actorUserId` for the authoritative Cadence actor.
9. Permission codes are the authorization primitive; do not hard-code endpoint access around role names.
10. Missing project membership should not expose protected project existence.
11. Human confirmation does not override permissions.
12. Team Agent does not bypass module permissions.
13. AI output is not authoritative until accepted through the appropriate human/module boundary.
14. Security-relevant failures should retain traceable request and correlation IDs.
15. External error responses should avoid unnecessary internal security details.
16. Authentication-provider replacement must not require rewriting Cadence project-role logic.
17. Server database credentials remain server-side only.
18. Negative authorization testing should not mutate legitimate role definitions where isolated fixtures can be used.
19. Temporary test fixtures must be restored or removed after verification.
20. Structural database changes must remain migration-driven and traceable.
21. Discussion message creation requires `message.create`.
22. Discussion performs application-level RBAC before persistence.
23. The Discussion persistence function performs a second `message.create` check for defence in depth.
24. `public.post_discussion_message(...)` must remain unavailable to `public`, `anon`, and `authenticated` roles.
25. The Discussion write RPC is an internal server-side persistence mechanism and is executable only through trusted service-role access.
26. Discussion message creation must not directly invoke Team Agent.
27. Downstream Team Agent failure must not roll back or prevent a successfully committed human Discussion message.
28. Automatic retries of Discussion write commands must not be introduced without an idempotency strategy.
29. Correlation and causation metadata must remain intact across asynchronous event processing.
30. Domain-event delivery claim, complete, and fail RPCs are server-side infrastructure functions and must remain restricted to trusted service-role execution.
31. Per-consumer delivery state must not be exposed as authority to perform another module's write.
32. Team Agent must retrieve Discussion content through the Discussion module boundary rather than directly reading Discussion persistence.
33. `ai_runs.source_event_id` must remain protected as the idempotency anchor for event-triggered Team Agent processing.
34. A pending AI proposal must not be treated as an authoritative Task.
35. Proposal confirmation must enforce `agent.approve` server-side.
36. `agent.approve` does not imply `task.create` or `task.assign`; target-module authorization must be re-evaluated.
37. Team Agent must never insert or update authoritative Tasks persistence directly.
38. External model inputs/outputs and raw AI-run data must remain server-controlled according to the existing AI provenance/security model.
39. `public.review_team_agent_task_proposal(...)` must remain unavailable to `public`, `anon`, and `authenticated` roles and executable only through trusted service-role access.
40. Human edit must not rewrite source-message provenance stored on the AI proposal.
41. `GET /api/v1/me/tasks` must derive the target user exclusively from `RequestContext.actorUserId`; client-supplied user IDs must not control My Tasks visibility.
42. `public.list_my_tasks(...)` must remain unavailable to `public`, `anon`, and `authenticated` roles and executable only through trusted service-role access.
43. My Tasks visibility must continue to require current `task.view` project permission rather than treating assignment alone as authorization.
44. `public.project_domain_event_to_audit(...)` must remain unavailable to `public`, `anon`, and `authenticated` roles and executable only through trusted service-role access.
45. `public.get_task_audit_journey(...)` must remain unavailable to `public`, `anon`, and `authenticated` roles and executable only through trusted service-role access.
46. Task Audit reads must require current `audit.view` project permission.
47. Audit reconstruction must preserve truthful historical correlation IDs rather than rewriting separate request contexts into one artificial correlation.
48. The current Audit inspection request correlation must remain distinct from the historical journey correlations returned in Audit data.

---

# Handoff and Maintainability Rules

Future engineers working on Cadence should be able to understand the system without relying on verbal history.

When adding or changing functionality:

1. Identify the owning module.
2. Avoid direct writes into another module's persistence.
3. Use defined interfaces between modules.
4. Keep public interfaces documented.
5. Record significant changes in `CHANGELOG.md`.
6. Update `HANDOFF.md` when the current implementation state changes materially.
7. Add or update architecture decision records where a durable design decision is made.
8. Use clear names and simple control flow.
9. Avoid hidden dependencies.
10. Keep secrets outside source control.
11. Preserve request, correlation, and domain-event traceability.
12. Verify TypeScript before committing.
13. Test both successful and failure paths.
14. Include authorization-denied cases when introducing protected functionality.
15. Prefer small, reviewable implementation checkpoints.
16. Leave the repository in a state another engineer can run and inspect.
17. Keep database migrations in source control.
18. Do not resolve schema mismatches by inventing application defaults without understanding the authoritative data model.
19. Keep temporary diagnostics temporary.
20. Restore modified test data after destructive or permission-boundary tests.

---

# Immediate Next Engineering Step

VS001-10H My Tasks and Audit browser integration and live acceptance verification are complete.

The immediate activity is the final VS001-10H documentation and source-control checkpoint.

From the repository root:

C:\Users\chngo\cadence

perform:

1. rerun API typecheck;
2. rerun all 64 API tests;
3. rerun web production build;
4. rerun web lint;
5. run git diff --check;
6. inspect the complete working tree;
7. confirm `.env` files and generated `dist` output remain ignored and unstaged;
8. stage only intended VS001-10H browser and documentation changes;
9. run git diff --cached --check;
10. scan the staged diff for Supabase secrets, JWTs, bearer tokens, passwords, and temporary credentials;
11. inspect git diff --cached --stat and git diff --cached --name-only;
12. commit the VS001-10H checkpoint;
13. push feature/vs-001;
14. confirm the branch is clean and synchronized with origin.

After that checkpoint, VS-001 is complete.

Historical development-data reconciliation remains separate maintenance work and must preserve existing Tasks and Audit boundaries.

Do not create another authoritative Task persistence path.

The established architecture remains:

Discussion -> asynchronous domain events
Team Agent -> human review
Team Agent materialisation -> TasksService -> Tasks-owned persistence
Audit -> domain-event consumer / read reconstruction

Historical development-data reconciliation should be handled separately from the VS001-10G checkpoint.
```

Do not reintroduce the old one-correlation-ID requirement.

Do not weaken:

```text
Discussion -> asynchronous domain events
Team Agent -> TasksService -> Tasks-owned persistence
Audit -> domain-event consumer / read reconstruction
```

Do not broaden `GET /me/tasks` into a general Task-history API as part of final UI work.

---

# Known Issues / Watch Items

## Discussion Idempotency

VS001-04 does not yet implement idempotency for message creation.

The broader API design anticipates retry-safe commands, but automatic retries of:

```text
POST /api/v1/projects/{projectId}/messages
```

could create duplicate messages until an idempotency mechanism is implemented.

Do not introduce automatic retries for this command without addressing idempotency.

## Domain Event Delivery and Worker Hosting

VS001-05 introduced domain-event subscription fan-out and per-consumer delivery processing. VS001-09 adds Audit as another independent consumer.

For new matching `MessageCreated.v1` events, the domain event itself normally becomes:

```text
status = processed
```

after fan-out, while Team Agent consumer state is represented separately in:

```text
public.domain_event_deliveries
```

Do not interpret `domain_events.status = processed` as proof that every downstream consumer completed successfully.

The current worker is one-shot:

```powershell
npm run worker:once
```

Each invocation attempts at most one Audit delivery and one Team Agent delivery before exiting.

Continuous worker hosting, scheduling, supervision, health monitoring, and retry/backoff policy remain future work.

When diagnosing an event-processing problem, inspect the consumer delivery rather than relying only on the parent domain-event status.

## Team Agent Development Generator

The current Team Agent proposal generator is deterministic:

```text
model_provider = cadence-development
model_name = deterministic-task-proposal-v1
```

It is not a production LLM integration.

`assigned_to`, `due_date`, and `confidence` remain null when not authoritatively resolved.

Do not replace these null values with guessed values without implementing the corresponding resolution rules and provenance.

## Team Agent Internal Discussion Query

The worker currently composes `DiscussionService` to retrieve the exact immutable message version.

`DiscussionService.getMessageVersion()` is treated as a trusted internal module query.

Do not expose this method directly as an HTTP history endpoint without adding the appropriate project-membership and RBAC checks.

## Event Delivery Retry Semantics

Failed deliveries are retryable and expired processing leases may be reclaimed.

A failed Team Agent delivery may therefore be processed more than once at the application level.

Idempotent persistence through `ai_runs.source_event_id` is required to keep repeated processing from producing duplicate AI runs/proposals.

Do not remove the unique source-event constraint without replacing the idempotency strategy.

## Discussion API Contract Gaps

The broader API contract includes:

```text
mention_user_ids
file_ids
```

VS001-04 does not implement those fields.

Do not silently claim those capabilities are supported.

## Discussion Automated Coverage

Six substantive Discussion service unit tests exist.

The persistence transaction and HTTP integration paths have been manually verified against the linked Supabase environment.

Database-backed automated integration tests remain future work.

## `external_user_id`

`public.users.external_user_id` currently exists but is not used by Supabase authentication.

Do not reconnect Supabase authentication to this field without an explicit schema or architecture decision.

---

## Environment Configuration

Local development depends on:

```text
apps/api/.env
```

If authentication suddenly reports invalid Supabase credentials on a new machine, confirm that `.env` exists and contains the correct:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
```

Do not copy real credentials into committed files.

---

## Access Tokens During Manual Testing

Supabase access tokens expire.

A Project Workspace request returning:

```text
401 UNAUTHENTICATED
```

does not automatically indicate an RBAC problem.

When manually testing authorization:

1. obtain a fresh user token if required,
2. verify `/api/v1/me`,
3. only then interpret the Project Workspace authorization response.

This distinction was important during VS001-03 testing.

---

## Project Health Initialisation for Future Projects

Existing projects were backfilled with current Project Health state.

The future project-creation application workflow must ensure that every newly created project receives its corresponding current `project_health` state.

This has not yet been implemented through a project-creation API workflow in VS-001.

Do not solve this by silently returning `on_track` when the row is absent.

Do not add a hidden database trigger without an explicit design decision.

---

## Project Health Failure Isolation

The current Project Workspace implementation requires a valid Project Health record and treats its absence as a data-integrity error.

The broader module contract expects optional-module failures such as Project Health eventually to degrade gracefully where appropriate.

As Project Health becomes a complete application module, review whether the workspace read model should distinguish:

```text
missing/corrupt authoritative health state
```

from:

```text
temporarily unavailable Project Health service
```

without weakening data integrity.

---

## Automated Authentication Tests

VS001-02 authentication has been manually verified.

Automated regression tests should be added as the test harness is established so future changes cannot silently break:

* missing-token rejection,
* invalid-token rejection,
* unmapped-user rejection,
* disabled-user rejection,
* active-user `/me`.

---

## Automated Project Authorization Tests

VS001-03 authorization has been manually verified.

Automated regression coverage should eventually include:

```text
authorized member + project.view
  ->
200
```

```text
no active membership
  ->
404
```

```text
active membership + missing project.view
  ->
403
```

Automated tests should use isolated fixtures and must not rely on permanently weakening normal role definitions.

---

## Temporary Diagnostic Logging

Temporary Project Workspace diagnostic logging used while identifying the original `health_status` schema mismatch has been removed.

If troubleshooting is required later, prefer structured application logging rather than leaving ad hoc `console.log` statements in production paths.

---

## Error Handling

Unexpected Project Workspace errors currently pass to the general Express error path.

As API infrastructure matures, ensure unexpected errors are rendered through a consistent structured error envelope and logged with appropriate request and correlation identifiers.

Do not expose raw Supabase/PostgreSQL error objects to clients.

---

## Current Test Data

Alice and Bob are development test identities.

Project IDs and user IDs recorded in this handoff are useful for the current development environment but should not be treated as portable production configuration.

Tests should progressively move toward repeatable seeded or automated fixture creation.

---

# Troubleshooting Project Workspace

When:

```text
GET /api/v1/projects/{projectId}/summary
```

fails, diagnose the request in this order.

### 1. Authentication

Verify:

```text
GET /api/v1/me
```

with the same bearer token.

If `/me` fails with:

```text
401
```

resolve authentication before investigating project authorization.

### 2. Cadence Identity

Confirm the authenticated Supabase subject maps through:

```text
auth.users.id
  ->
public.users.auth_user_id
```

and that the Cadence user is active.

### 3. Active Project Membership

Check:

```text
public.project_memberships
```

for:

```text
project_id
user_id
status = active
```

### 4. Role and Permission

Resolve:

```text
project_memberships.role_id
  ->
roles
  ->
role_permissions
  ->
permissions
```

and confirm:

```text
project.view
```

exists.

### 5. Project Data

Confirm the project exists in:

```text
public.projects
```

### 6. Current Project Health

Confirm the project has a row in:

```text
public.project_health
```

### 7. Supporting Read-Model Data

If the request still fails, inspect:

```text
tasks
blockers
milestones
alerts
```

against the actual live schema rather than assuming column names.

### 8. TypeScript

Run:

```powershell
npm run typecheck
```

after code changes.

---

# Troubleshooting Discussion Message Creation

For failures involving:

```text
POST /api/v1/projects/{projectId}/messages
```

check the following in order.

### 1. Authentication

Confirm the request has a valid bearer token and resolves to an active Cadence user.

### 2. RequestContext

Confirm these values are present:

```text
actorUserId
correlationId
requestId
```

### 3. Active Project Membership

Check:

```text
public.project_memberships
```

for an active membership matching the authenticated actor and requested project.

### 4. Permission

Resolve the project role and confirm:

```text
message.create
```

is present.

Project membership alone does not grant message creation.

### 5. Request Validation

Check:

```text
content
projectId
thread_parent_id
```

for validation errors.

Message content must remain within the 20,000-character limit after trimming.

### 6. Thread Parent

If a thread parent is supplied, verify:

* it exists,
* it belongs to the same project,
* it is not deleted.

### 7. Persistence Migration

Confirm migration:

```text
20260813000100_post_discussion_message.sql
```

has been applied to the linked Supabase database.

Confirm:

```text
public.post_discussion_message(...)
```

exists.

### 8. Atomic Persistence

For a successful command, inspect:

```text
messages
message_versions
domain_events
```

using the returned message ID.

A valid initial write should show:

```text
messages.current_version = 1
message_versions.version_number = 1
domain_events.event_type = MessageCreated
domain_events.event_version = 1
```

### 9. Correlation

Compare the API response correlation ID with:

```text
domain_events.correlation_id
```

They should match.

### 10. TypeScript and Tests

From:

```text
apps/api
```

run:

```powershell
npm run typecheck
npm test
```

### 11. Server Process During Manual Testing

During manual testing, distinguish an application failure from a development watch-process restart.

If necessary, stop stale Node watch processes and restart the API cleanly with:

```powershell
npm start
```

Because message creation is not yet idempotent, inspect the database before retrying a request whose outcome is uncertain.

---

# Troubleshooting Team Agent Event Processing

When a Discussion message exists but a Team Agent proposal is missing, diagnose the flow in this order.

### 1. Source Domain Event

Confirm the expected source event exists in:

```text
public.domain_events
```

Check:

```text
event_type = MessageCreated
event_version = 1
aggregate_type = message
project_id
aggregate_id
correlation_id
```

For new VS001-05-era messages, remember that the parent domain-event status reflects fan-out rather than downstream completion.

### 2. Subscription

Confirm an active subscription exists in:

```text
public.domain_event_subscriptions
```

for:

```text
consumer_name = team-agent.message-created.v1
event_type = MessageCreated
event_version = 1
is_active = true
```

### 3. Consumer Delivery

Inspect:

```text
public.domain_event_deliveries
```

for the source event and consumer.

Check:

```text
status
processing_attempts
available_at
claimed_at
claim_token
lease_expires_at
processed_at
last_error
```

If no delivery exists for a post-subscription `MessageCreated.v1`, investigate fan-out rather than the Team Agent handler.

### 4. Worker

From:

```text
apps/api
```

run:

```powershell
npm run worker:once
```

Expected when a delivery is available:

```text
Cadence worker: processed one Team Agent delivery.
```

Expected when none is available:

```text
Cadence worker: no pending Team Agent delivery.
```

Do not repeatedly rerun a failing worker without first inspecting `last_error` and delivery state.

### 5. Immutable Message Version

Confirm the event payload references an existing immutable message version.

Check:

```text
message_id
version_number
project_id
```

against:

```text
public.messages
public.message_versions
```

The application handler should obtain this through the Discussion module boundary.

### 6. Team Agent AI Run

Inspect:

```text
public.ai_runs
```

using:

```text
source_event_id
```

There should be at most one AI run for a non-null source event because of:

```text
ai_runs_source_event_uidx
```

### 7. Pending Proposal

Inspect:

```text
public.ai_proposals
```

using the AI run ID.

Current VS001-05 output should use:

```text
proposal_type = task
status = pending
```

### 8. Derived Domain Event

Inspect:

```text
public.domain_events
```

for:

```text
event_type = AIProposalCreated
event_version = 1
causation_id = source MessageCreated event ID
```

Confirm the derived event correlation ID matches the original message-event correlation ID.

### 9. Idempotency

If processing was retried, verify:

```text
count(ai_runs for source_event_id) = 1
count(ai_proposals for ai_run_id) = 1
```

If duplicates ever appear, stop and investigate before adding more retries.

### 10. TypeScript and Tests

From:

```text
apps/api
```

run:

```powershell
npm run typecheck
npm test
```

Current expected automated result after the final VS001-09 gate:

```text
61 passed
0 failed
```

### 11. Database Migration State

Confirm the four VS001-05 migrations are applied to the linked database:

```text
20260815200500_domain_event_deliveries.sql
20260815201000_domain_event_delivery_processing.sql
20260815202000_domain_event_subscriptions.sql
20260815203000_team_agent_task_proposals.sql
```

Use:

```powershell
npx supabase db push --dry-run
```

from the repository root when checking for unapplied migrations.

A Docker catalogue/cache warning after a successful Supabase push does not by itself mean the database migration failed. Verify the actual database objects if uncertain.

---

# Troubleshooting Reviewed Proposal -> Task Materialization

For failures involving:

```text
POST /api/v1/projects/{projectId}/task-proposals/{proposalId}/task
```

check the following in order.

### 1. Authentication

Verify `GET /api/v1/me` with the same bearer token.

### 2. Project Membership

Confirm the actor has an active membership in the requested project.

### 3. Proposal State

Confirm the proposal exists in the same project and has status `confirmed` or `edited`.

Confirm `reviewed_payload`, the review event ID, and the review correlation ID are present.

### 4. Tasks Permissions

Confirm the actor has `task.create`.

If `assigned_to` is non-null, also confirm `task.assign`.

If an assignee is present, confirm that user is an active member of the same project.

### 5. Tasks Persistence Migration

Confirm migration:

```text
20260816123000_authoritative_task_creation.sql
```

is applied and `public.create_authoritative_task(...)` exists.

### 6. Idempotency / Provenance

Inspect `public.source_links` for:

```text
entity_type = task
source_type = ai_proposal
source_id = proposal ID
```

A retry should return the existing Task with `created = false`.

### 7. Task Event

For first-time materialization, verify exactly one `TaskCreated.v1` exists for the Task.

Its correlation ID should match the human review event correlation, and its causation ID should equal the human review event ID.

### 8. Proposal Result Link

After a successful API materialization, verify:

```text
ai_proposals.result_entity_type = task
ai_proposals.result_entity_id = Task ID
```

### 9. Architecture Boundary

If troubleshooting leads toward direct Team Agent writes to `public.tasks`, stop. The correct path is always through `TasksService`.

### 10. TypeScript and Tests

From `apps/api` run:

```powershell
npm run typecheck
npm test
```

Current expected result after the final VS001-09 gate:

```text
61 passed
0 failed
```


---

# Troubleshooting My Tasks

For failures involving:

```text
GET /api/v1/me/tasks
```

check the following in order.

### 1. Authentication

Verify:

```text
GET /api/v1/me
```

with the same bearer token.

If `/me` fails, resolve authentication before investigating Tasks visibility.

### 2. Cadence Identity

Confirm the authenticated user resolves to an active Cadence user.

The My Tasks target identity must come from:

```text
RequestContext.actorUserId
```

The client must not control the target user ID.

### 3. Assignment

Confirm the expected Task contains:

```text
assigned_to = authenticated Cadence user ID
```

Unassigned Tasks do not appear.

### 4. Task Status

Confirm:

```text
status = open
```

or:

```text
status = in_progress
```

Completed and cancelled Tasks are outside the current My Tasks read model.

### 5. Project Membership and Permission

Confirm the authenticated user has active membership in the Task project and the current role includes:

```text
task.view
```

Assignment alone is not sufficient authorization.

### 6. Database Migration

Confirm:

```text
20260817101500_my_tasks_read_model.sql
```

is applied.

Confirm:

```text
public.list_my_tasks(uuid)
```

exists.

### 7. RPC Security

The function must remain executable through trusted server-side service-role access only.

Do not expose it directly to browser clients merely to troubleshoot a read failure.

### 8. Ordering

Current ordering is:

```text
due_date ASC NULLS LAST
created_at DESC
id ASC
```

Do not treat a different position in the returned list as a missing Task until the complete result has been inspected.

### 9. TypeScript and Tests

From:

```text
apps/api
```

run:

```powershell
npm run typecheck
npm test
```

Current expected result after the final VS001-09 gate:

```text
61 passed
0 failed
```

---

# Troubleshooting Audit Reconstruction

For failures involving:

```text
GET /api/v1/projects/{projectId}/tasks/{taskId}/audit
```

diagnose the flow in this order.

### 1. Authentication

Verify:

```text
GET /api/v1/me
```

with the same bearer token.

An expired Supabase access token can produce:

```text
401 UNAUTHENTICATED
```

before Audit authorization is reached.

### 2. Request UUIDs

Confirm both:

```text
projectId
taskId
```

are valid UUIDs.

The Audit route rejects invalid UUIDs with the standard validation error envelope.

### 3. Project Membership and `audit.view`

Confirm the authenticated Cadence user has:

```text
active project membership
+
audit.view
```

No active membership should be treated as a protected-resource not-found condition.

An active member without `audit.view` must be denied.

### 4. Audit Migrations

Confirm both migrations are applied:

```text
20260817120000_audit_domain_event_projection.sql
20260817140000_audit_task_journey_reconstruction.sql
```

Use:

```powershell
npx supabase migration list
```

from the repository root.

### 5. Audit Subscriptions

Confirm active `audit.domain-events.v1` subscriptions exist for the six supported v1 event types.

### 6. Audit Projection

For the journey's domain events, confirm corresponding rows exist in:

```text
public.audit_events
```

using:

```text
audit_events.event_id = domain_events.id
```

The projection is idempotent.

A missing Audit row for a supported event indicates a projection/backfill/consumer problem.

### 7. Task Provenance

Confirm the Task has:

```text
public.source_links
```

with:

```text
entity_type = task
source_type = ai_proposal
```

The `source_id` should identify the proposal that produced the Task.

### 8. Proposal and AI Run

Confirm the proposal exists in:

```text
public.ai_proposals
```

and has an:

```text
ai_run_id
```

Resolve that run in:

```text
public.ai_runs
```

and inspect:

```text
source_event_id
```

The source event should lead back to the originating `MessageCreated.v1`.

### 9. Proposal Aggregate Events

Inspect:

```text
public.domain_events
```

for:

```text
aggregate_type = ai_proposal
aggregate_id = proposal ID
```

The normal successful reviewed path should include proposal creation and either confirmation or edit before Task creation.

### 10. Task Event Causation

Confirm `TaskCreated.v1` exists for the authoritative Task.

Its:

```text
causation_id
```

should reference the successful proposal-review event.

### 11. Correlation Expectations

Do not expect all journey rows to have the same correlation ID.

For the verified VS001-09 journey:

```text
MessageCreated.v1
AIProposalCreated.v1
```

share one correlation, while:

```text
AIProposalEdited.v1
TaskCreated.v1
```

share a later human-request correlation.

This is expected.

### 12. Request Correlation vs Historical Correlation

The Audit API response `meta.correlation_id` represents the current inspection request.

`data.journey.correlation_ids` represents historical business contexts.

These values do not need to match.

### 13. Direct RPC Verification

When application behavior is uncertain, use the trusted SQL environment to verify:

```text
public.get_task_audit_journey(...)
```

with the correct project, Task, and requesting Cadence user IDs.

Do not expose the RPC directly to browser clients.

### 14. TypeScript and Tests

From:

```text
apps/api
```

run:

```powershell
npm run typecheck
npm test
```

Expected final VS001-09 gate:

```text
61 passed
0 failed
```

---

# Current Architecture Checkpoint

The working VS-001 backend now demonstrates:

```text
Supabase Auth
  ->
Cadence Identity
  ->
RequestContext
  ->
Project Membership
  ->
RBAC Role
  ->
Permission Code
  ->
Application Service
```

Discussion write path:

```text
Discussion route
  ->
DiscussionService
  ->
message.create
  ->
DiscussionRepository
  ->
post_discussion_message()
  ->
message + immutable version + MessageCreated.v1
```

Asynchronous Team Agent proposal path:

```text
MessageCreated.v1
  ->
domain_event_deliveries
  ->
DomainEventProcessor
  ->
MessageCreatedV1Handler
  ->
DiscussionService.getMessageVersion()
  ->
TeamAgentService
  ->
ai_run + pending ai_proposal + AIProposalCreated.v1
```

Human review path:

```text
pending ai_proposal
  ->
TeamAgentService.reviewTaskProposal()
  ->
agent.approve
  ->
confirm / edit / reject
  ->
reviewed_payload
  ->
AIProposalConfirmed.v1 / AIProposalEdited.v1 / AIProposalRejected.v1
```

Authoritative Task path:

```text
confirmed / edited proposal
  ->
TeamAgentTaskMaterializationService
  ->
TasksService
  ->
task.create
  ->
task.assign when required
  ->
SupabaseTasksRepository
  ->
create_authoritative_task()
     |
     +-- authoritative Task
     +-- source_links provenance
     +-- TaskCreated.v1
```

My Tasks read path:

```text
authenticated user
  ->
GET /api/v1/me/tasks
  ->
RequestContext.actorUserId
  ->
TasksService.listMyTasks()
  ->
SupabaseTasksRepository
  ->
list_my_tasks()
  ->
assigned open/in_progress Tasks with current task.view
```

Audit projection path:

```text
material domain event
  ->
audit.domain-events.v1 delivery
  ->
DomainEventProcessor
  ->
AuditDomainEventHandler
  ->
AuditService
  ->
project_domain_event_to_audit()
  ->
append-only audit_events
```

Task Audit reconstruction path:

```text
authenticated user
  ->
GET /api/v1/projects/{projectId}/tasks/{taskId}/audit
  ->
AuditQueryService
  ->
active project membership
  ->
audit.view
  ->
SupabaseAuditRepository
  ->
get_task_audit_journey()
  ->
Task provenance + AI proposal aggregate + causation + Audit projection
  ->
chronological business journey
```

This validates the major backend architecture requirements through complete Audit reconstruction:

* authentication remains separate from authorization;
* authorization is project-scoped and permission-code based;
* modules depend on explicit service/repository boundaries;
* Discussion and Team Agent remain asynchronously separated;
* Team Agent retrieves exact Discussion content through the Discussion module;
* AI proposal state remains non-authoritative until human review and Tasks authorization;
* `agent.approve` does not imply `task.create` or `task.assign`;
* Team Agent never writes directly to Tasks persistence;
* Tasks owns Task creation, assignment authorization, persistence, provenance, idempotency, and Task events;
* material writes emit versioned domain events;
* proposal materialization is retry-safe;
* authenticated My Tasks visibility is self-scoped and re-evaluates current `task.view`;
* Audit consumes events independently rather than becoming authoritative business storage;
* Audit projection is idempotent;
* Audit reconstruction requires current `audit.view`;
* Audit reconstructs a complete journey across multiple truthful request correlations;
* the current Audit inspection request correlation remains distinct from historical journey correlations.

Task visibility and backend Audit reconstruction are complete for VS-001.

The correlation-model question is resolved.

Remaining VS-001 work is limited to final VS001-10H regression verification, staged security review, source-control checkpoint, and branch synchronization. No functional VS-001 implementation work remains.

---

# Handoff Principle

Cadence should remain understandable, maintainable, and transferable to a competent IT engineer without undocumented dependencies or tribal knowledge.

A new engineer should be able to determine:

* what the system currently does,
* how to run the HTTP API,
* how to run the one-shot domain-event worker,
* where configuration lives,
* which module owns each responsibility,
* how authentication works,
* how project authorization works,
* how Project Workspace is assembled,
* how Discussion message creation works,
* how Discussion persistence remains atomic,
* how `MessageCreated.v1` fans out to independent consumers,
* how event deliveries are claimed, leased, completed, failed, and retried,
* how Team Agent retrieves the exact immutable Discussion message version,
* how Team Agent run/proposal persistence remains idempotent,
* how AI proposal state remains non-authoritative,
* how reviewed proposals are materialized through `TasksService`,
* how `task.create` and `task.assign` remain independent from `agent.approve`,
* how Task materialization remains idempotent,
* how proposal-to-Task provenance and result linkage are stored,
* how `TaskCreated.v1` causation is derived from the review event,
* how authenticated My Tasks visibility is scoped and authorized,
* how Audit domain-event projection works,
* how Audit backfill handles pre-subscription events,
* how Audit projection remains idempotent,
* how `audit.view` protects Task Audit reads,
* how Task audit reconstruction traverses provenance and aggregate identity,
* why a complete business journey may contain multiple truthful correlation IDs,
* why the current Audit inspection request correlation is separate from historical journey correlations,
* where current Project Health is stored,
* what migrations have been introduced,
* what has been manually verified,
* what automated tests exist,
* what remains unfinished,
* what known watch items exist,
* how to troubleshoot the current implementation,
* and what the next implementation checkpoint is,

by reading the repository documentation and inspecting the code.

The immediate continuation point is:

```text
complete VS001-10H documentation
  ->
rerun final API and web regression gate
  ->
perform staged security review
  ->
commit and push VS001-10H
  ->
VS-001 complete

Do not bypass established module boundaries merely to complete the vertical slice more quickly.

In particular:

```text
Discussion must not call Team Agent synchronously
Team Agent must not read Discussion persistence directly
Team Agent must not write Tasks persistence directly
human proposal approval must not bypass Tasks permissions
Audit must not become authoritative business state
Audit reconstruction must not falsify request correlation history
```

Cadence was conceptualized and prepared by Ngoh Chee Hung.

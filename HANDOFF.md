# Cadence Engineering Handoff

## Project

Cadence

Conceptualized and prepared by Ngoh Chee Hung.

## Current Version

v0.1 - Development

## Current Branch

`feature/vs-001`

A draft pull request has been created for Vertical Slice VS-001.

## Current Implementation Work

Vertical Slice:

`VS-001 - Login to Discussion to AI-Proposed Task to Human Confirmation to Task Creation to Audit Trail`

Status:

**In Progress**

Current checkpoint:

**VS001-03 Project Workspace Read Model implementation and manual verification complete. Documentation and source-control checkpoint in progress.**

Next implementation area after the VS001-03 source-control checkpoint:

**Discussion portion of VS-001**

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
12. Correlation IDs trace a complete business journey.
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

Normal start:

```powershell
npm start
```

Current start script:

```text
node --env-file=.env --import tsx src/server.ts
```

Type checking:

```powershell
npm run typecheck
```

Build:

```powershell
npm run build
```

Type checking currently passes with:

```text
tsc --noEmit
```

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

Identifies the complete business journey across requests, services, and domain events.

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

The API bootstrap currently creates and composes:

```text
SupabaseAuthProvider
SupabaseIdentityRepository
SupabaseRbacRepository
SupabaseProjectsRepository
IdentityService
RbacService
ProjectsService
authentication middleware
identity router
projects router
```

A shared server-side Supabase database client is used for backend database repositories.

Protected API routes are mounted under:

```text
/api/v1
```

Authentication middleware executes before the protected Identity and Projects route handlers.

This composition should remain explicit and easy to trace.

Avoid introducing hidden dependency resolution or implicit cross-module wiring without a clear architectural reason.

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

# Module Boundary

For AI-proposed task confirmation, the established boundary remains:

```text
TeamAgentService.confirmProposal()
  ->
validate proposal
  ->
check agent.approve
  ->
TasksService.createTask()
  ->
check task.create
  ->
check task.assign when required
  ->
persist authoritative task
  ->
emit TaskCreated.v1
```

Team Agent must never write directly to Tasks persistence.

Tasks owns:

* task creation,
* task state,
* assignment authorization,
* persistence,
* provenance,
* task domain events.

This remains a critical requirement for the later portion of VS-001.

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
* temporary RBAC fixture cleanup
* final Project Workspace live sanity check
* TypeScript type checking
* `CHANGELOG.md`
* `HANDOFF.md`

## Current Documentation / Source-Control Checkpoint

Before continuing into Discussion:

* ensure `CHANGELOG.md` contains the VS001-03 changes,
* ensure `HANDOFF.md` reflects this current state,
* inspect the Git working tree,
* inspect staged changes carefully,
* confirm `.env` and all credentials remain unstaged,
* review the final diff,
* commit the VS001-03 checkpoint,
* update the draft pull request if required.

## Next Implementation Area

After the VS001-03 checkpoint is safely committed:

```text
Discussion
```

within the existing VS-001 vertical slice.

The next implementation should continue the same pattern:

```text
authenticated RequestContext
  ->
project membership
  ->
required permission
  ->
Discussion service
  ->
Discussion-owned persistence
  ->
standard response
  ->
traceable domain event where state changes
```

Do not skip module ownership or server-side authorization because Project Workspace authorization now works.

---

# Not Yet Implemented in VS-001

The following portions of the vertical slice are still outstanding:

* Discussion persistence through the VS-001 API flow
* Discussion API authorization integration
* discussion message creation through VS-001
* discussion message domain-event persistence through VS-001
* Team Agent execution
* Team Agent task proposal generation
* proposal provenance through the VS-001 flow
* human proposal confirmation
* `agent.approve` enforcement through the VS-001 flow
* authoritative task creation through `TasksService`
* `task.create` enforcement through the VS-001 flow
* `task.assign` enforcement where required
* task domain-event persistence through VS-001
* complete correlated audit reconstruction across the vertical slice
* end-to-end VS-001 UI
* automated regression coverage for the manually verified authentication and Project Workspace paths

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
13. AI output is not authoritative until accepted by the owning module.
14. Security-relevant failures should retain traceable request and correlation IDs.
15. External error responses should avoid unnecessary internal security details.
16. Authentication-provider replacement must not require rewriting Cadence project-role logic.
17. Server database credentials remain server-side only.
18. Negative authorization testing should not mutate legitimate role definitions where isolated fixtures can be used.
19. Temporary test fixtures must be restored or removed after verification.
20. Structural database changes must remain migration-driven and traceable.

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

VS001-03 implementation is complete.

Do **not** begin Discussion code until the current checkpoint is safely recorded in source control.

From the repository root:

```text
C:\Users\chngo\cadence
```

the next activity is:

```text
VS001-03 source-control checkpoint
```

Perform the following:

1. inspect the current Git working tree,
2. review all files changed during VS001-03,
3. confirm `20260812201900_project_health_backfill.sql` is present,
4. confirm `.env` is ignored and is not staged,
5. inspect the staged diff before committing,
6. confirm `CHANGELOG.md` and `HANDOFF.md` accurately describe the checkpoint,
7. commit the VS001-03 changes,
8. update the existing draft pull request if required.

Only after that checkpoint should development continue into the Discussion portion of VS-001.

---

# Known Issues / Watch Items

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

# Current Architecture Checkpoint

At the end of VS001-03, the working backend architecture now demonstrates:

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
Projects Service
  ->
Read Repository
  ->
Supabase/PostgreSQL
  ->
Standard API Response
```

This validates a major portion of the Cadence security and modularity model.

The same architectural discipline should now be carried forward into Discussion and later modules rather than implementing each feature as an isolated endpoint.

---

# Handoff Principle

Cadence should remain understandable, maintainable, and transferable to a competent IT engineer without undocumented dependencies or tribal knowledge.

A new engineer should be able to determine:

* what the system currently does,
* how to run it,
* where configuration lives,
* which module owns each responsibility,
* how authentication works,
* how project authorization works,
* what security rules apply,
* how Project Workspace is assembled,
* where current Project Health is stored,
* what migrations have been introduced,
* what has been manually verified,
* what remains unfinished,
* what known watch items exist,
* how to troubleshoot the current implementation,
* and what the next implementation checkpoint is,

by reading the repository documentation and inspecting the code.

The immediate continuation point is:

```text
complete the VS001-03 source-control checkpoint
```

followed by:

```text
begin the Discussion portion of VS-001
```
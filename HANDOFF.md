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

**VS001-02 Authentication implementation and verification complete. Documentation and source-control checkpoint in progress.**

Next implementation checkpoint:

**VS001-03 Project Workspace Read Model**

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

* Node.js
* TypeScript
* Express
* tsx
* Supabase JavaScript client

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

---

# API Development Commands

Run commands from:

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

The repository `.gitignore` currently protects environment files using:

```text
.env
.env.*
!.env.example
```

Verification performed:

```powershell
git check-ignore -v apps\api\.env
```

confirmed that `apps/api/.env` is ignored by Git.

## Secret-Key Rule

`SUPABASE_SECRET_KEY` is server-side only.

It must never be:

* committed to Git,
* sent to the browser,
* included in frontend environment variables,
* written into documentation,
* pasted into logs.

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

These identifiers must remain available as VS-001 progresses into discussions, Team Agent proposals, task creation, and audit reconstruction.

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

Internal logs retain more specific diagnostic reasons.

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

The current repository lookup uses:

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

These concerns must remain separate.

VS001-02 proves authentication only.

Project membership and RBAC join the API execution path in VS001-03.

The intended progression is:

```text
Supabase authentication
  ->
Cadence identity
  ->
project membership
  ->
project role
  ->
permission
  ->
project resource
```

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
Supabase Auth ID:
de97ae2b-cc72-4c0d-9d6d-35cea1300aff

Cadence user ID:
afec9f7c-eb66-46b9-9668-cb57b26394b5

Status:
active
```

## Bob

```text
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

Used by:

```text
SupabaseIdentityRepository
```

Purpose:

Perform trusted backend access to Cadence database records.

Configured using:

```text
SUPABASE_URL
SUPABASE_SECRET_KEY
```

The server database secret must remain server-side.

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

The configuration was corrected to use the server-side Supabase secret key beginning with:

```text
sb_secret_
```

## Inconsistent PowerShell Environment

Manual Supabase authentication tests and the Cadence API process were temporarily using different Supabase environment values.

This resulted in a valid JWT being accepted directly by Supabase while Cadence rejected it.

The issue was resolved by:

1. aligning the Supabase URL,
2. aligning the publishable key,
3. setting the correct server secret key,
4. moving configuration into `apps/api/.env`,
5. loading `.env` automatically when the API starts.

This eliminates reliance on temporary PowerShell environment variables.

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

Project-scoped RBAC already exists at the database level and has previously been manually tested.

It has **not yet been integrated into the new VS-001 API request flow**.

This is intentional.

Authentication was completed first.

The first API checkpoint combining authentication and RBAC is VS001-03.

---

# VS001-03 Project Workspace Read Model

Status:

**Next**

Initial endpoint:

```text
GET /api/v1/projects/{projectId}/summary
```

or the corresponding route defined by the API contract.

Acceptance criterion:

> An authenticated Cadence user who is a member of the requested project and has `project.view` permission can load the Project Workspace summary.

This is the first point where:

```text
authenticated Cadence identity
  +
project membership
  +
project role
  +
project.view
```

must combine within the API request flow.

---

# Intended VS001-03 Request Flow

Target architecture:

```text
HTTP request
  ->
authenticate
  ->
RequestContext
  ->
project membership lookup
  ->
RBAC permission evaluation
  ->
project.view
  ->
Project Workspace service
  ->
Project Workspace read repository
  ->
Supabase/PostgreSQL
  ->
standard API response
```

Project Workspace code must not duplicate authentication logic.

Authentication should already be complete before project authorization begins.

---

# Project Workspace v0.1 Requirements

The Project Workspace should eventually expose the v0.1 information already established in the product specification.

This includes:

* clear project status indicator,
* project summary,
* logged-in user's project context,
* visible count of tasks pending for the logged-in user,
* alert banner for important:

  * issues,
  * deadlines,
  * blockers,
  * announcements.

Document control and document classification are deferred to a later version.

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
* TypeScript type checking
* `CHANGELOG.md`
* `HANDOFF.md`

## Next

* source-control checkpoint for VS001-02
* inspect current Git diff
* commit VS001-02 changes
* update draft pull request if required
* begin VS001-03
* implement Project Workspace read model
* integrate project membership
* integrate `project.view`
* return first Project Workspace summary

## Not Yet Implemented in VS-001

* Project Workspace API read model
* API-level project membership enforcement
* API-level RBAC enforcement
* Discussion persistence through the VS-001 API flow
* Team Agent execution
* Team Agent task proposal generation
* human proposal confirmation
* authoritative task creation through VS-001
* task domain event persistence through VS-001
* full audit reconstruction
* end-to-end VS-001 UI

---

# Security Rules

1. Never commit `.env`.
2. Never commit Supabase secret keys.
3. Never expose Supabase server secrets to browser clients.
4. Authentication must not imply project authorization.
5. Protected project operations must evaluate RBAC server-side.
6. Do not trust project IDs supplied by clients without authorization checks.
7. Human confirmation does not override permissions.
8. Team Agent does not bypass module permissions.
9. AI output is not authoritative until accepted by the owning module.
10. Security-relevant failures should retain traceable request and correlation IDs.
11. External error responses should avoid unnecessary internal security details.
12. Authentication-provider replacement must not require rewriting Cadence project-role logic.

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
14. Prefer small, reviewable implementation checkpoints.
15. Leave the repository in a state another engineer can run and inspect.

---

# Immediate Next Engineering Step

Before beginning VS001-03:

1. inspect the current Git diff,
2. confirm no secrets are present,
3. commit the VS001-02 authentication checkpoint,
4. ensure the draft PR reflects the latest changes.

Then begin:

```text
VS001-03 - Project Workspace Read Model
```

with:

```text
GET /projects/{projectId}/summary
```

The first goal is deliberately narrow:

> An authenticated, active Cadence user with membership in the requested project and `project.view` permission can retrieve the project's workspace summary.

Do not introduce Discussion, Team Agent, or task-creation code until this authorization boundary is working correctly.

---

# Known Issues / Watch Items

## `external_user_id`

`public.users.external_user_id` currently exists but is not used by Supabase authentication.

Do not reconnect Supabase authentication to this field without an explicit schema or architecture decision.

## Environment Configuration

Local development depends on:

```text
apps/api/.env
```

If authentication suddenly reports invalid Supabase credentials on a new machine, confirm that `.env` exists and contains the correct project URL, publishable key, and server secret key.

## Automated Authentication Tests

VS001-02 authentication has been manually verified.

Automated regression tests should be added as the test harness is established so future changes cannot silently break:

* missing-token rejection,
* invalid-token rejection,
* unmapped-user rejection,
* disabled-user rejection,
* active-user `/me`.

---

# Handoff Principle

Cadence should remain understandable, maintainable, and transferable to a competent IT engineer without undocumented dependencies or tribal knowledge.

A new engineer should be able to determine:

* what the system currently does,
* how to run it,
* where configuration lives,
* which module owns each responsibility,
* what security rules apply,
* what has been verified,
* what remains unfinished,
* and what the next implementation checkpoint is,

by reading the repository documentation and inspecting the code.

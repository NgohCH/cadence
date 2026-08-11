# Cadence Changelog

All notable changes to Cadence will be documented in this file.

Cadence was conceptualized and prepared by Ngoh Chee Hung.

## Unreleased

### Added

* Started Vertical Slice VS-001 covering the end-to-end workflow:

  * Login
  * Project Workspace
  * Discussion
  * Team Agent task proposal
  * Human confirmation
  * Task creation
  * Audit trail
* Added initial modular API application structure.
* Added shared `RequestContext` definition.
* Added request ID generation and middleware.
* Added correlation ID generation and middleware.
* Added shared `DomainEvent` structure with correlation and causation IDs.
* Added standard API success and error response envelopes.
* Added API health endpoint.
* Defined Team Agent and Tasks module ownership boundaries.
* Added Supabase authentication adapter.
* Added bearer JWT validation for protected API routes.
* Added Cadence identity resolution for authenticated users.
* Added rejection of disabled Cadence users.
* Added rejection of authenticated Supabase users without a Cadence user mapping.
* Added authenticated `RequestContext` creation.
* Added `GET /api/v1/me`.
* Added request and correlation ID handling for authenticated API calls.
* Added local API environment configuration through `apps/api/.env`.
* Added committed `apps/api/.env.example` containing non-secret configuration placeholders.
* Updated API development and start commands to load `.env` through Node.
* Improved authentication failure logging so infrastructure errors retain useful diagnostic messages without exposing internal details to API clients.

### Changed

* Corrected Supabase identity resolution in `SupabaseIdentityRepository`.
* Changed the Supabase-to-Cadence identity lookup from `public.users.external_user_id` to `public.users.auth_user_id`.
* Updated local API startup configuration to use Node's environment-file support.
* Updated development startup to use Node watch mode with `tsx` for TypeScript execution.

### Verified

* Verified the API application starts successfully on port `3000`.
* Verified `GET /health` returns HTTP `200`.
* Verified missing bearer-token requests are rejected.
* Verified invalid JWT requests are rejected.
* Verified valid Supabase users without a corresponding Cadence user are rejected.
* Verified disabled Cadence users are rejected.
* Verified active Cadence users authenticate successfully.
* Verified `auth.users.id = public.users.auth_user_id` for active Cadence test identities.
* Verified Alice Test resolves successfully from Supabase authentication to Cadence user ID `afec9f7c-eb66-46b9-9668-cb57b26394b5`.
* Verified `GET /api/v1/me` returns the correct Cadence identity for an active mapped user.
* Verified an authenticated but unprovisioned Supabase identity produces the internal reason `CADENCE_USER_NOT_FOUND`.
* Verified a disabled Cadence identity produces the internal reason `CADENCE_USER_DISABLED`.
* Verified Supabase JWT validation independently against Supabase Auth.
* Verified Cadence authentication succeeds using configuration loaded solely from `apps/api/.env`.
* Verified `.env` is excluded from Git.
* Verified `.env.example` remains available for source control.
* Verified Supabase secret credentials are not stored in committed configuration.
* Verified TypeScript type checking passes with `tsc --noEmit`.

### Architecture

* PostgreSQL/Supabase remains the authoritative state store.

* Authentication and Cadence authorization remain separate concerns.

* Supabase Auth is the authentication provider for Cadence v0.1.

* Supabase v0.1 authentication maps:

  `auth.users.id` → `public.users.auth_user_id` → Cadence user

* `public.users.external_user_id` is not currently used for Supabase identity resolution.

* `external_user_id` remains available for future external identity-provider integration.

* The authentication abstraction remains designed so Supabase/local authentication can later be replaced by Microsoft Entra ID without changing Cadence project-role or permission logic.

* Supabase publishable credentials may be used by authentication components as appropriate.

* Supabase secret keys remain server-side only and must never be committed to Git or exposed to browser clients.

* Environment-specific credentials must remain outside source-controlled files.

* Team Agent must not create or modify authoritative task state directly.

* Confirmed Team Agent task proposals must invoke `TasksService`.

* The Tasks module remains responsible for task creation, assignment permissions, persistence, provenance, and task domain events.

* Request IDs identify individual HTTP requests.

* Correlation IDs identify the complete business journey across requests and events.

* Causation IDs identify the event that directly caused another event.

* Protected commands must enforce RBAC server-side.

* Human confirmation does not bypass target-module authorization.

* Material writes must produce traceable domain events.

* Changes affecting interfaces, architecture, security, or operational behaviour must be recorded in project documentation.

### Security

* Real Supabase credentials are stored only in local environment configuration.
* `.env` and related environment files are ignored by Git.
* `.env.example` contains placeholders only.
* Authentication API responses intentionally use the same external `UNAUTHENTICATED` response for:

  * invalid tokens,
  * unmapped Cadence users,
  * disabled Cadence users.
* Internal logs retain the specific authentication failure reason for troubleshooting without disclosing that information to API clients.
* Server-side Supabase access uses the Supabase secret API key.
* Authentication token verification uses the configured Supabase authentication client.

### Documentation

* Standardised the implementation permission name on `agent.approve` to align with the v0.1 API contract.
* Maintained module ownership documentation for VS-001.
* Maintained `HANDOFF.md` as the operational engineering handoff record.
* Maintained `CHANGELOG.md` as the traceable record of implementation and architecture changes.

### Current VS-001 Status

Completed:

* VS001-01 walking skeleton.
* Express + TypeScript API.
* Health endpoint.
* Request and correlation IDs.
* `RequestContext`.
* Standard API response envelope.
* Shared `DomainEvent` type.
* Module ownership documentation.
* Supabase authentication provider.
* Supabase JWT verification.
* Cadence identity repository.
* Cadence identity service.
* Authentication middleware.
* Authenticated `RequestContext`.
* `GET /api/v1/me`.
* Active-user authentication verification.
* Invalid-token verification.
* Missing-token verification.
* Unprovisioned-user verification.
* Disabled-user verification.
* Supabase-to-Cadence identity linkage verification.
* Local API environment configuration.
* Git protection of local secrets.
* TypeScript type checking.

Next:

* Complete VS001-02 documentation and source-control checkpoint.
* Begin VS001-03 Project Workspace read model.
* Implement `GET /projects/{projectId}/summary`.
* Introduce project membership and `project.view` authorization into the API request flow.

---

## 0.1.0 - 2026-08-08

### Added

* Initial executable Supabase/PostgreSQL migration sequence.
* Application identity and Supabase Auth mapping.
* Project-scoped RBAC and platform-role separation.
* Native discussion model with immutable message versions.
* Topics, decisions, tasks, blockers, milestones, and file metadata.
* Provenance and generic entity-link structures.
* Team Agent run/proposal tracking and prompt versioning.
* Transactional outbox domain events and idempotency registry.
* Append-only operational audit trail.
* Independent Project Health module state and history.
* RLS helper functions.
* Read policies.
* Database indexes.
* Full-text search baseline.
* Explicit Project Owner transfer permission and security invariants.
* Raw AI-run records restricted to server-side access.
* Seed roles and permissions.
* Schema smoke test.
* Manual RLS verification checklist.

### Architecture

* Established PostgreSQL/Supabase as the authoritative state store.
* Established project-scoped RBAC.
* Established separation between platform roles and project roles.
* Established module ownership boundaries.
* Established append-only operational audit principles.
* Established transactional outbox architecture for domain events.
* Established provenance requirements for AI-generated state.
* Established independent Project Health state and history.
* Established security invariants for Project Owner transfer.

### Verified

* Verified core Supabase migrations execute successfully.
* Verified seeded roles and permissions.
* Verified project-scoped RLS behaviour through manual testing.
* Verified permission behaviour within the same project.
* Verified baseline database schema smoke tests.

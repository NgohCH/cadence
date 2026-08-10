# Cadence Database Migration Package Changelog

# Changelog

All notable changes to Cadence will be documented in this file.

## Unreleased ## 0.1.0 - 2026-08-10

### Added

- Started Vertical Slice VS-001 covering the discussion-to-task workflow.
- Added initial modular API application structure.
- Added shared RequestContext definition.
- Added request and correlation ID middleware.
- Added shared domain event structure with correlation and causation IDs.
- Added standard API success and error response envelopes.
- Added API health endpoint.
- Defined Team Agent and Tasks module ownership boundaries.
- Added Supabase authentication adapter.
- Added bearer JWT validation for protected API routes.
- Added Cadence identity resolution for authenticated users.
- Added disabled-user and unprovisioned-user rejection.
- Added GET /api/v1/me.
- Added authenticated RequestContext creation.
- Added request and correlation ID handling for authenticated API calls.

### Verified

- Manually verified authentication scenarios for missing, invalid,
  unprovisioned, disabled and active identities.

### Architecture

- Team Agent must not create or modify authoritative task state directly.
- Confirmed task proposals must invoke TasksService.
- Tasks module remains responsible for task creation, assignment permissions, persistence, provenance, and task domain events.
- Request IDs identify individual HTTP requests.
- Correlation IDs identify the complete business journey across requests and events.
- Causation IDs identify the event that directly caused another event.

### Documentation

- Standardised implementation permission name on `agent.approve` to align with the v0.1 API contract.

## 0.1.0 - 2026-08-08

### Added
- Initial executable Supabase/PostgreSQL migration sequence.
- Application identity and Supabase Auth mapping.
- Project-scoped RBAC and platform-role separation.
- Native discussion model with immutable message versions.
- Topics, decisions, tasks, blockers, milestones, and file metadata.
- Provenance and generic entity-link structures.
- Team Agent run/proposal tracking and prompt versioning.
- Transactional outbox domain events and idempotency registry.
- Append-only operational audit trail.
- Independent Project Health module state/history.
- RLS helper functions, read policies, indexes, full-text search baseline.
- Explicit Project Owner transfer permission and security invariants.
- Raw AI-run records kept server-only.
- Seed roles and permissions.
- Schema smoke test and manual RLS checklist.

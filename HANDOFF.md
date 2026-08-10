# Cadence Engineering Handoff

## Project

Cadence

Conceptualized and prepared by Ngoh Chee Hung.

## Current Version

v0.1 — Development

## Current Implementation Work

Vertical Slice: VS-001 — Discussion to AI-Proposed Task

Status: In Progress

## VS-001 Objective

Validate the core Cadence architecture through one end-to-end journey:

Login
→ Project Workspace
→ Discussion
→ Team Agent task proposal
→ Human confirmation
→ Task creation
→ Audit trace

## Current Progress

Completed:

- Repository engineering structure created.
- API Node.js/TypeScript application initialized.
- Express API application runs successfully.
- `/health` endpoint returns HTTP 200.
- Shared RequestContext created.
- Request ID generation implemented.
- Correlation ID generation implemented.
- Correlation IDs returned in API responses.
- Shared DomainEvent structure created.
- Causation ID concept established.
- Standard API success and error envelopes created.
- Team Agent → Tasks module boundary documented.

Not yet implemented:

- Database connectivity.
- RBAC enforcement.
- Project Workspace read model.
- Discussion persistence.
- Domain event persistence.
- AI execution.
- AI task proposal generation.
- Proposal confirmation.
- Task persistence.
- Audit reconstruction.
- End-to-end UI.

## API Application

Location:

`apps/api`

Current stack:

- Node.js
- TypeScript
- Express
- tsx

Development command:

`npm run dev`

Type checking:

`npm run typecheck`

Current development endpoint:

`GET /health`

Default development port:

`3000`

## Repository Structure

- `apps/api` — backend API implementation
- `apps/web` — frontend application
- `api/openapi.yaml` — API contract
- `supabase/migrations` — database migrations
- `tests` — contract, integration, RBAC and end-to-end tests
- `docs/adr` — architecture decision records
- `docs/vertical-slices` — vertical slice implementation records

## Architectural Rules

1. PostgreSQL/Supabase is the authoritative state store.
2. Authentication and Cadence authorization remain separate.
3. Browser clients do not perform authoritative cross-module writes.
4. Each module owns its state.
5. Team Agent never writes directly to Tasks.
6. Protected commands enforce RBAC server-side.
7. Material writes produce versioned domain events.
8. AI-generated state requires provenance.
9. Human confirmation does not bypass target-module permissions.
10. Correlation IDs trace the complete operation.
11. Retryable commands must be idempotent.
12. Changes affecting contracts are recorded in CHANGELOG.md.

## Module Boundary

For AI-proposed task confirmation:

TeamAgentService.confirmProposal()
→ validate proposal
→ check agent.approve
→ TasksService.createTask()
→ check task.create
→ check task.assign when required
→ persist authoritative task
→ emit TaskCreated.v1

Team Agent must never write directly to Tasks persistence.

## Completed

- Supabase authentication adapter implemented.
- Bearer JWT validation implemented.
- Cadence identity resolution implemented.
- Disabled and unprovisioned identities rejected.
- Authenticated RequestContext implemented.
- GET /api/v1/me implemented and manually verified.

Acceptance test:

A valid JWT resolves to a Cadence user.

## Authentication Flow

Supabase Auth authenticates v0.1 users.

Supabase Auth user ID
    ↓
users.external_user_id
    ↓
Cadence user ID
    ↓
project membership / RBAC

Authentication is intentionally isolated from Cadence
project authorization so the authentication provider
can later be replaced with Microsoft Entra ID.

External authentication failures return the same
UNAUTHENTICATED response whether the token is invalid,
the Cadence user is missing, or the Cadence user is disabled.

Internal application logs retain the specific failure reason
for troubleshooting.

## Next Implementation Checkpoint

VS001-03 — Project Workspace Read Model

Acceptance test:

An authorised project member can load the project summary.

## Known Issues

None currently recorded.

## Handoff Principle

Cadence should be understandable and maintainable by a competent IT engineer without relying on undocumented knowledge.
# Cadence Changelog

All notable changes to Cadence will be documented in this file.

Cadence was conceptualized and prepared by Ngoh Chee Hung.

## Unreleased

### VS001-05 — Asynchronous Team Agent Task-Proposal Processing

#### Added

- Added generic per-consumer domain-event delivery infrastructure.
- Added `public.domain_event_deliveries`.
- Added `public.domain_event_subscriptions`.
- Added transactional domain-event fan-out.
- Registered `team-agent.message-created.v1` as a consumer of `MessageCreated.v1`.
- Added atomic delivery claiming using PostgreSQL `FOR UPDATE SKIP LOCKED`.
- Added processing leases and claim tokens for stale-worker protection.
- Added retry state and processing-attempt tracking.
- Added reusable `DomainEventRepository`, `DomainEventHandler`, and `DomainEventProcessor`.
- Added Supabase-backed domain-event processing repository.
- Expanded the shared `DomainEvent` envelope with version, aggregate, actor, and project metadata.
- Added `DiscussionService.getMessageVersion()` for exact immutable message-version retrieval.
- Added `MessageCreatedV1Handler`.
- Added Team Agent task-proposal processing service and repository contracts.
- Added deterministic VS001-05 development task-proposal generation.
- Added Supabase Team Agent persistence adapter.
- Added `ai_runs.source_event_id` as the source-event idempotency key.
- Added idempotent `create_team_agent_task_proposal()` database function.
- Added pending task-proposal persistence in `public.ai_proposals`.
- Added `AIProposalCreated.v1`.
- Added one-shot asynchronous worker entry point.
- Added `npm run worker:once`.
- Added domain-event processor and Team Agent tests.

#### Architecture

- Preserved the asynchronous Discussion-to-Team-Agent boundary.
- `DiscussionService.postMessage()` does not call Team Agent.
- Discussion publishes `MessageCreated.v1`; event infrastructure performs consumer fan-out.
- Consumer processing state is independent per consumer.
- Team Agent retrieves Discussion content through a Discussion-owned query rather than reading Discussion tables directly.
- Team Agent remains prohibited from writing directly to Tasks.
- Pending AI proposals remain non-authoritative until human confirmation.
- Correlation IDs propagate from `MessageCreated.v1` to `AIProposalCreated.v1`.
- `AIProposalCreated.v1.causation_id` references the originating `MessageCreated.v1`.

#### Verified

- Verified a Discussion message generated one pending Team Agent delivery.
- Verified the delivery changed from `pending` to `processed`.
- Verified `processing_attempts = 1`.
- Verified one completed AI run was created.
- Verified one pending task proposal was created.
- Verified no authoritative Task was created.
- Verified `assigned_to`, `due_date`, and confidence remain null where those capabilities are not yet implemented.
- Verified `AIProposalCreated.v1` was emitted.
- Verified correlation ID continuity across Discussion and Team Agent processing.
- Verified causation links the proposal event to the originating message event.
- Verified the source event produced exactly one AI run and one proposal.
- Verified a subsequent worker execution found no pending Team Agent delivery.
- Verified `npm run typecheck` passes.
- Verified all 20 automated tests pass.

#### Current Limitations

- External LLM invocation is not yet implemented.
- Prompt-version selection is not yet implemented.
- User-name resolution is not yet implemented.
- Natural-language due-date resolution is not yet implemented.
- Proposal review and confirmation APIs are not yet implemented.
- Authoritative Task creation is not yet implemented.
- The VS001-05 worker is one-shot and is not yet hosted as a continuous production worker.

### Added

- Started Vertical Slice VS-001 covering the end-to-end workflow:
  - Login
  - Project Workspace
  - Discussion
  - Team Agent task proposal
  - Human confirmation
  - Task creation
  - Audit trail

- Added initial modular API application structure.
- Added shared `RequestContext` definition.
- Added request ID generation and middleware.
- Added correlation ID generation and middleware.
- Added shared `DomainEvent` structure with correlation and causation IDs.
- Added standard API success and error response envelopes.
- Added API health endpoint.
- Defined Team Agent and Tasks module ownership boundaries.

- Added Supabase authentication adapter.
- Added bearer JWT validation for protected API routes.
- Added Cadence identity resolution for authenticated users.
- Added rejection of disabled Cadence users.
- Added rejection of authenticated Supabase users without a Cadence user mapping.
- Added authenticated `RequestContext` creation.
- Added `GET /api/v1/me`.
- Added request and correlation ID handling for authenticated API calls.
- Added local API environment configuration through `apps/api/.env`.
- Added committed `apps/api/.env.example` containing non-secret configuration placeholders.
- Updated API development and start commands to load `.env` through Node.
- Improved authentication failure logging so infrastructure errors retain useful diagnostic messages without exposing internal details to API clients.

- Added project-scoped RBAC types, repository contract, and service.
- Added Supabase-backed project membership, role, and permission resolution.
- Added Project Workspace domain/read-model types.
- Added Project Workspace repository contract.
- Added Project Workspace service.
- Added Supabase-backed Project Workspace read repository.
- Added Project Workspace API route:

  `GET /api/v1/projects/{projectId}/summary`

- Added server-side `project.view` authorization for Project Workspace access.
- Added active project-membership enforcement for Project Workspace access.
- Added Project Workspace aggregation of:
  - project metadata,
  - current Project Health,
  - logged-in user's pending task count,
  - logged-in user's overdue task count,
  - active blocker count,
  - next milestone,
  - active project/user alerts.

- Added migration:

  `20260812201900_project_health_backfill.sql`

  to establish missing current Project Health baseline rows for existing projects.

- Added the first implemented Discussion command:

  `DiscussionService.postMessage()`

- Added Discussion repository contract and message types.
- Added Supabase-backed Discussion repository.
- Added Discussion HTTP route:

  `POST /api/v1/projects/{projectId}/messages`

- Added server-side `message.create` authorization for posting project messages.
- Added Discussion validation for:
  - required message content,
  - maximum 20,000-character message content,
  - project UUID format,
  - optional thread-parent UUID format,
  - thread-parent existence,
  - thread-parent project ownership,
  - deleted thread-parent rejection.

- Added migration:

  `20260813000100_post_discussion_message.sql`

- Added PostgreSQL function:

  `public.post_discussion_message(...)`

  to atomically persist:
  - the message,
  - immutable message version 1,
  - `MessageCreated.v1` domain event.

- Added defence-in-depth `message.create` authorization inside the Discussion persistence function.
- Added service-role-only execution controls for the Discussion write function.
- Added request correlation propagation into `MessageCreated.v1`.
- Added Node built-in test runner integration for the API.
- Added `npm test` API test command.
- Added six executable Discussion service unit tests.

### Changed

- Corrected Supabase identity resolution in `SupabaseIdentityRepository`.
- Changed the Supabase-to-Cadence identity lookup from `public.users.external_user_id` to `public.users.auth_user_id`.
- Updated local API startup configuration to use Node's environment-file support.
- Updated development startup to use Node watch mode with `tsx` for TypeScript execution.

- Integrated project membership and RBAC authorization into the authenticated API request flow.
- Reused the authenticated `RequestContext.actorUserId` for project-scoped authorization rather than accepting user identity from client input.
- Reused the server-side Supabase database client across identity, RBAC, Project Workspace, and Discussion repositories.
- Corrected the Project Workspace repository to read current health from `public.project_health` rather than incorrectly expecting `health_status` on `public.projects`.
- Aligned the Project Workspace project-owner read type with the live `projects.owner_user_id NOT NULL` database schema.
- Removed temporary Project Workspace diagnostic logging after successful live verification.

- Extended the authenticated API server composition to include the Discussion module.
- Established Discussion write flow as:

  `Route -> DiscussionService -> RBAC -> DiscussionRepository -> PostgreSQL RPC`

- Established human-originated Discussion messages as root commands with:

  `causation_id = null`

- Standardised Discussion message content by trimming leading and trailing whitespace before persistence.

### Verified

- Verified the API application starts successfully on port `3000`.
- Verified `GET /health` returns HTTP `200`.
- Verified missing bearer-token requests are rejected.
- Verified invalid JWT requests are rejected.
- Verified valid Supabase users without a corresponding Cadence user are rejected.
- Verified disabled Cadence users are rejected.
- Verified active Cadence users authenticate successfully.
- Verified `auth.users.id = public.users.auth_user_id` for active Cadence test identities.
- Verified Alice Test resolves successfully from Supabase authentication to Cadence user ID `afec9f7c-eb66-46b9-9668-cb57b26394b5`.
- Verified `GET /api/v1/me` returns the correct Cadence identity for an active mapped user.
- Verified an authenticated but unprovisioned Supabase identity produces the internal reason `CADENCE_USER_NOT_FOUND`.
- Verified a disabled Cadence identity produces the internal reason `CADENCE_USER_DISABLED`.
- Verified Supabase JWT validation independently against Supabase Auth.
- Verified Cadence authentication succeeds using configuration loaded solely from `apps/api/.env`.
- Verified `.env` is excluded from Git.
- Verified `.env.example` remains available for source control.
- Verified Supabase secret credentials are not stored in committed configuration.

- Verified Project Health backfill migration was applied to the remote Supabase database.
- Verified existing Alice Project and Bob Project both have current Project Health state:

  `on_track`

  with source:

  `system`

- Verified an authenticated active project member with `project.view` can retrieve the Project Workspace summary.
- Verified Alice can retrieve Alice Project through `GET /api/v1/projects/{projectId}/summary`.
- Verified the Project Workspace response includes project lifecycle state, Project Health, task counts, blocker count, next milestone, alerts, request ID, and correlation ID.
- Verified Alice Project currently returns one pending task and zero overdue tasks for Alice.
- Verified an authenticated user without active membership in the requested project receives:

  `404 NOT_FOUND`

- Verified the `404 NOT_FOUND` behaviour intentionally avoids disclosing project existence to a non-member.
- Verified an authenticated active project member without `project.view` receives:

  `403 PERMISSION_DENIED`

- Verified the `403 PERMISSION_DENIED` path using a temporary isolated test role without modifying normal system-role permissions.
- Verified the temporary RBAC test fixture was removed and Bob's Alice Project membership was restored to the normal `VIEWER` role.
- Verified the Project Workspace endpoint continues to return HTTP `200` after removal of temporary diagnostic logging.

- Verified migration `20260813000100_post_discussion_message.sql` was applied successfully to the linked remote Supabase database.
- Verified an authenticated authorised user can post a Discussion message through:

  `POST /api/v1/projects/{projectId}/messages`

- Verified successful Discussion message creation returns HTTP `201`.
- Verified successful message creation persists exactly one message with:
  - `author_type = human`,
  - `current_version = 1`,
  - expected authenticated Cadence author,
  - expected project,
  - expected content.

- Verified successful message creation persists exactly one immutable message version with:
  - `version_number = 1`,
  - matching message ID,
  - matching content,
  - authenticated Cadence user as editor,
  - `editor_type = human`.

- Verified successful message creation persists exactly one domain event with:
  - `event_type = MessageCreated`,
  - `event_version = 1`,
  - `aggregate_type = message`,
  - aggregate ID matching the new message,
  - expected project ID,
  - authenticated Cadence user as actor,
  - `actor_type = human`.

- Verified the API response correlation ID matches `domain_events.correlation_id`.
- Verified the human-originated message event stores:

  `causation_id = null`

- Verified whitespace-only Discussion content returns:

  `400 VALIDATION_ERROR`

- Verified an invalid/non-existent thread parent returns:

  `400 VALIDATION_ERROR`

- Verified invalid thread-parent processing creates no partial message row.
- Verified an active project member using the normal `VIEWER` role receives:

  `403 PERMISSION_DENIED`

  when attempting to post a Discussion message because `VIEWER` does not contain `message.create`.

- Verified the denied Discussion operation creates no message.
- Verified the temporary Viewer authentication, Cadence user, and project-membership fixture used for the negative authorization test was removed successfully.
- Verified six Discussion service unit tests pass.
- Verified the complete API test command reports zero failures.
- Verified TypeScript type checking passes with `tsc --noEmit`.

### Architecture

- PostgreSQL/Supabase remains the authoritative state store.

- Authentication and Cadence authorization remain separate concerns.

- Supabase Auth is the authentication provider for Cadence v0.1.

- Supabase v0.1 authentication maps:

  `auth.users.id -> public.users.auth_user_id -> Cadence user`

- `public.users.external_user_id` is not currently used for Supabase identity resolution.

- `external_user_id` remains available for future external identity-provider integration.

- The authentication abstraction remains designed so Supabase/local authentication can later be replaced by Microsoft Entra ID without changing Cadence project-role or permission logic.

- Supabase publishable credentials may be used by authentication components as appropriate.

- Supabase secret keys remain server-side only and must never be committed to Git or exposed to browser clients.

- Environment-specific credentials must remain outside source-controlled files.

- Project-scoped authorization follows:

  `authenticated Cadence identity -> active project membership -> project role -> permission codes -> project resource`

- Project membership and permissions are resolved server-side.

- Client-supplied project IDs are not trusted as authorization evidence.

- A missing active membership is treated externally as `404 NOT_FOUND` for protected project resources.

- An active membership without the required permission is treated as `403 PERMISSION_DENIED`.

- Permission codes remain the authorization primitive; endpoint logic does not depend directly on role names.

- Project Workspace authorization requires `project.view`.

- Discussion message creation requires `message.create`.

- Project Health remains independently stored in `public.project_health`.

- Project Workspace may aggregate Project Health for read purposes without moving ownership of health state into the Projects module.

- Missing current Project Health is treated as a data-integrity failure rather than silently defaulting application responses to `on_track`.

- Existing projects were backfilled with the schema-defined `on_track` current-health baseline without manufacturing historical health-change events.

- Discussion owns authoritative message state and immutable message-version history.

- Discussion message creation follows:

  `authenticated request -> RequestContext -> DiscussionService -> RBAC -> DiscussionRepository -> Supabase/PostgreSQL`

- Discussion application code depends on the repository abstraction rather than directly on Supabase.

- The concrete Supabase Discussion adapter remains under infrastructure rather than inside the Discussion domain module.

- Message creation persists message state, immutable version history, and `MessageCreated.v1` atomically in one PostgreSQL transaction.

- The Discussion write RPC is an internal persistence mechanism and not a public application interface.

- Discussion write RPC execution is restricted to `service_role`.

- Application-level RBAC and database-level permission enforcement are both retained for defence in depth.

- `MessageCreated.v1` is represented by:
  - `event_type = MessageCreated`
  - `event_version = 1`

- Human HTTP message creation is currently a root command and therefore uses:

  `causation_id = null`

- Team Agent is not called synchronously from the Discussion write transaction.

- Team Agent consumes `MessageCreated.v1` asynchronously through the domain-event/outbox boundary.

- `MessageCreated.v1` fan-out creates independent per-consumer delivery state in `public.domain_event_deliveries`.

- Team Agent delivery claiming uses processing leases, claim tokens, and PostgreSQL `FOR UPDATE SKIP LOCKED`.

- A Team Agent processing failure does not prevent humans from posting Discussion messages.

- Team Agent retrieves the exact immutable Discussion message version through the Discussion module rather than reading Discussion persistence directly.

- Team Agent task-proposal processing is idempotent on the originating domain-event ID.

- Team Agent emits `AIProposalCreated.v1` after successfully persisting a pending proposal.

- Pending Team Agent proposals remain non-authoritative until human confirmation.

- Team Agent must not create or modify authoritative task state directly.

- Confirmed Team Agent task proposals must invoke `TasksService`.

- The Tasks module remains responsible for task creation, assignment permissions, persistence, provenance, and task domain events.

- Request IDs identify individual HTTP requests.

- Correlation IDs identify the complete business journey across requests and events.

- Causation IDs identify the event that directly caused another event.

- Protected commands must enforce RBAC server-side.

- Human confirmation does not bypass target-module authorization.

- Material writes must produce traceable domain events.

- Changes affecting interfaces, architecture, security, or operational behaviour must be recorded in project documentation.

### Security

- Real Supabase credentials are stored only in local environment configuration.
- `.env` and related environment files are ignored by Git.
- `.env.example` contains placeholders only.
- Authentication API responses intentionally use the same external `UNAUTHENTICATED` response for:
  - invalid tokens,
  - unmapped Cadence users,
  - disabled Cadence users.

- Internal logs retain the specific authentication failure reason for troubleshooting without disclosing that information to API clients.
- Server-side Supabase access uses the Supabase secret API key.
- Authentication token verification uses the configured Supabase authentication client.
- Authentication does not imply project authorization.
- Project membership is checked before protected Project Workspace data is returned.
- `project.view` is enforced server-side.
- `message.create` is enforced server-side for Discussion writes.
- Project resources are intentionally hidden with `404 NOT_FOUND` when no active project membership exists.
- Active project members lacking the required permission receive `403 PERMISSION_DENIED`.
- Normal system-role permissions were not modified during negative authorization testing.
- The Discussion write function is restricted to `service_role`.
- The Discussion write function uses `SECURITY DEFINER` with a fixed `search_path`.
- The Discussion write function performs its own `message.create` permission check before persistence.
- Browser or client applications must not invoke the Discussion write RPC directly.
- Discussion negative authorization testing used an isolated temporary user fixture and did not weaken the normal `VIEWER` role.

### Documentation

- Standardised the implementation permission name on `agent.approve` to align with the v0.1 API contract.
- Maintained module ownership documentation for VS-001.
- Maintained `HANDOFF.md` as the operational engineering handoff record.
- Maintained `CHANGELOG.md` as the traceable record of implementation and architecture changes.
- Recorded VS001-03 Project Workspace architecture, authorization behaviour, Project Health correction, migration, and verification results.
- Expanded the Discussion module README to document VS001-04 ownership, interfaces, validation, errors, persistence, security, correlation, testing, verification, known limitations, and module boundaries.
- Recorded VS001-04 Discussion message-creation implementation, migration, architecture decisions, security controls, and verification results.
- Expanded the Team Agent module README to document VS001-05 asynchronous processing, delivery semantics, immutable Discussion-version retrieval, idempotency, AI proposal persistence, provenance, worker behaviour, verification results, and current limitations.
- Recorded VS001-05 asynchronous Team Agent architecture and live verification results.

### Current VS-001 Status

Completed:

- VS001-01 walking skeleton.
- Express + TypeScript API.
- Health endpoint.
- Request and correlation IDs.
- `RequestContext`.
- Standard API response envelope.
- Shared `DomainEvent` type.
- Module ownership documentation.
- Supabase authentication provider.
- Supabase JWT verification.
- Cadence identity repository.
- Cadence identity service.
- Authentication middleware.
- Authenticated `RequestContext`.
- `GET /api/v1/me`.
- Active-user authentication verification.
- Invalid-token verification.
- Missing-token verification.
- Unprovisioned-user verification.
- Disabled-user verification.
- Supabase-to-Cadence identity linkage verification.
- Local API environment configuration.
- Git protection of local secrets.
- VS001-03 Project Workspace read model.
- Project-scoped API membership enforcement.
- Project-scoped API RBAC enforcement.
- `project.view` permission enforcement.
- `GET /api/v1/projects/{projectId}/summary`.
- Project Health integration into the workspace read model.
- Project Health baseline backfill for existing projects.
- Project Workspace `200 OK` happy-path verification.
- Cross-project `404 NOT_FOUND` isolation verification.
- Same-project `403 PERMISSION_DENIED` verification.
- Request and correlation tracing on Project Workspace responses.
- VS001-04 Discussion message creation.
- `POST /api/v1/projects/{projectId}/messages`.
- `message.create` permission enforcement.
- Discussion repository abstraction.
- Supabase Discussion persistence adapter.
- Atomic Message + Message Version + `MessageCreated.v1` persistence.
- Discussion correlation-ID propagation.
- Discussion content validation.
- Discussion thread-parent validation.
- Discussion `400 VALIDATION_ERROR` verification.
- Discussion `403 PERMISSION_DENIED` verification.
- Discussion rollback/no-partial-write verification.
- Six Discussion service unit tests.
- API-wide `npm test` command.
- TypeScript type checking.
- VS001-05 asynchronous Team Agent task-proposal processing.
- Per-consumer domain-event subscriptions and deliveries.
- Atomic domain-event delivery claiming.
- Processing leases and stale-worker claim protection.
- Generic `DomainEventProcessor`.
- `MessageCreated.v1` Team Agent consumer.
- Exact immutable Discussion message-version retrieval.
- Deterministic development task-proposal generation.
- Idempotent AI run persistence using `source_event_id`.
- Pending AI task-proposal persistence.
- `AIProposalCreated.v1`.
- Correlation and causation tracing across the asynchronous flow.
- One-shot Team Agent worker.
- Twenty passing automated tests.
- Live VS001-05 Supabase verification.

In progress:

- Complete VS001-05 engineering handoff documentation.
- Update VS-001 vertical-slice documentation.
- Inspect the complete VS001-05 Git diff.
- Confirm no secrets or local environment files are staged.
- Create the VS001-05 source-control checkpoint.
- Push the VS001-05 checkpoint to `feature/vs-001`.

Next:

- Begin VS001-06 human proposal review.
- Add authorised review of pending Team Agent proposals.
- Support confirm, edit, and reject outcomes.
- Enforce `agent.approve` server-side.
- Preserve the Tasks module boundary for eventual authoritative Task creation.

### Known Limitations / Deferred Work

- Discussion message listing is not yet implemented.
- Individual Discussion message retrieval is not yet implemented.
- Discussion message-history retrieval is not yet implemented.
- Discussion editing and deletion are not yet implemented.
- Discussion reactions are not yet implemented.
- Discussion mentions are not yet implemented.
- Discussion file-link handling is not yet implemented.
- `mention_user_ids` and `file_ids` from the broader API contract are not yet implemented by VS001-04.
- Discussion command idempotency is not yet implemented.
- Automatic retries of state-changing Discussion commands should not be introduced until idempotency is implemented.
- Discussion-specific audit processing is not yet implemented.
- External LLM invocation is not yet implemented.
- Prompt-version selection is not yet implemented.
- Assignee name resolution is not yet implemented.
- Natural-language due-date resolution is not yet implemented.
- AI confidence scoring is not yet implemented.
- Proposal listing and review APIs are not yet implemented.
- Proposal confirmation, editing, and rejection are not yet implemented.
- Confirmed proposals are not yet integrated with `TasksService`.
- Authoritative Task creation from confirmed proposals is not yet implemented.
- The Team Agent worker is currently one-shot; continuous production worker hosting and supervision are not yet implemented.
- Several module `*.test.ts` files remain empty placeholders; Node counts those files as successful test entries even though they contain no substantive assertions.

---

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
- Independent Project Health module state and history.
- RLS helper functions.
- Read policies.
- Database indexes.
- Full-text search baseline.
- Explicit Project Owner transfer permission and security invariants.
- Raw AI-run records restricted to server-side access.
- Seed roles and permissions.
- Schema smoke test.
- Manual RLS verification checklist.

### Architecture

- Established PostgreSQL/Supabase as the authoritative state store.
- Established project-scoped RBAC.
- Established separation between platform roles and project roles.
- Established module ownership boundaries.
- Established append-only operational audit principles.
- Established transactional outbox architecture for domain events.
- Established provenance requirements for AI-generated state.
- Established independent Project Health state and history.
- Established security invariants for Project Owner transfer.

### Verified

- Verified core Supabase migrations execute successfully.
- Verified seeded roles and permissions.
- Verified project-scoped RLS behaviour through manual testing.
- Verified permission behaviour within the same project.
- Verified baseline database schema smoke tests.
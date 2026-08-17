# Cadence Changelog

All notable changes to Cadence will be documented in this file.

Cadence was conceptualized and prepared by Ngoh Chee Hung.

## Unreleased
### VS001-09 - Complete Audit Reconstruction

#### Added

- Added independent Audit domain-event consumer `audit.domain-events.v1`.
- Added Audit projection for:
  - `MessageCreated.v1`,
  - `AIProposalCreated.v1`,
  - `AIProposalConfirmed.v1`,
  - `AIProposalEdited.v1`,
  - `AIProposalRejected.v1`,
  - `TaskCreated.v1`.
- Added idempotent `public.project_domain_event_to_audit(uuid)`.
- Added migration `20260817120000_audit_domain_event_projection.sql`.
- Added historical backfill of supported VS-001 domain events into the append-only `public.audit_events` store.
- Added Audit repository, service, domain-event handler, query repository, query service, routes, types, errors, tests, and Supabase adapter.
- Added `public.get_task_audit_journey(...)`.
- Added migration `20260817140000_audit_task_journey_reconstruction.sql`.
- Added protected Audit endpoint:
  - `GET /api/v1/projects/{projectId}/tasks/{taskId}/audit`.
- Added application-level and database-level `audit.view` authorization.
- Added Audit processing to the one-shot domain-event worker.
- Expanded the API suite to 61 passing tests.

#### Architecture

- Preserved Audit as a consumer of authoritative business records rather than a second authoritative state store.
- Business modules continue to emit domain events and do not call Audit directly.
- Audit projection is idempotent through unique `audit_events.event_id`.
- Original domain-event occurrence time is preserved when projecting historical Audit records.
- New domain-event subscriptions do not replay historical events automatically; VS001-09 therefore performs an explicit supported-event backfill.
- Audit and Team Agent process independent per-consumer delivery records.
- Task audit reconstruction follows durable provenance:
  - Task,
  - `source_links`,
  - AI proposal,
  - AI run,
  - originating domain event.
- Proposal lifecycle reconstruction uses shared AI-proposal aggregate identity.
- `TaskCreated.v1.causation_id` preserves direct causation to the successful proposal-review event.
- A complete business journey is no longer assumed to use one correlation ID.
- Correlation IDs represent truthful request or processing contexts.
- Business-journey reconstruction may span multiple correlation IDs and combines provenance, aggregate identity, causation, Audit projection, and correlation metadata.
- The correlation ID of the Audit inspection HTTP request remains separate from the historical correlations being inspected.
- Audit reads require `audit.view` through application RBAC and database revalidation for defence in depth.
- Audit reconstruction RPC execution remains restricted to trusted `service_role`.

#### Verified

- Verified `npm run typecheck` passes.
- Verified all 61 automated tests pass during VS001-09 implementation.
- Verified migration `20260817120000_audit_domain_event_projection.sql` is synchronized with the linked remote Supabase database.
- Verified migration `20260817140000_audit_task_journey_reconstruction.sql` is synchronized with the linked remote Supabase database.
- Verified 20 supported existing VS-001 domain events were projected into 20 Audit records with zero missing projections.
- Verified six active `audit.domain-events.v1` subscriptions.
- Live-verified direct database reconstruction for Task `c132b53e-e9b9-4389-81bc-6d4011bf1e2f`.
- Verified the reconstructed journey contains:
  - `MessageCreated.v1`,
  - `AIProposalCreated.v1`,
  - `AIProposalEdited.v1`,
  - `TaskCreated.v1`.
- Verified the complete journey contains 4 events across 2 truthful historical correlation IDs.
- Live-verified authenticated Audit API response returns `success = true`, 4 events, and `correlation_count = 2`.
- Verified the Audit API request correlation `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa` is not contained in the historical journey correlation set.
- Verified request-level and business-journey correlation semantics are therefore kept distinct.

#### Current Limitations

- Final VS-001 UI integration remains outstanding where required.
- External LLM invocation, assignee-name resolution, and natural-language due-date resolution remain deferred.
- The Team Agent/Audit worker remains one-shot rather than continuously hosted.
- Database-backed integration automation remains future work beyond the current live/manual verification.

### VS001-08 - My Tasks Read Model

#### Added

- Added authenticated `GET /api/v1/me/tasks`.
- Added `TasksService.listMyTasks()`.
- Extended `TasksRepository` with the authenticated-user My Tasks read contract.
- Added `SupabaseTasksRepository.listMyTasks()`.
- Added Tasks HTTP routing through `tasks.routes.ts`.
- Added server-side `public.list_my_tasks(uuid)`.
- Added migration `20260817101500_my_tasks_read_model.sql`.
- Added automated coverage for authenticated actor scoping and empty My Tasks results.
- Expanded the API suite to 53 passing tests.

#### Architecture

- My Tasks is intentionally a narrow current-actionable-task read model rather than a general Task-history API.
- User identity comes exclusively from `RequestContext.actorUserId`; callers cannot request another user's Tasks.
- Results are limited to Tasks assigned to the authenticated user with status `open` or `in_progress`.
- Current project authorization is enforced using `task.view`.
- Read authorization is enforced inside the Tasks-owned server-side database function to avoid per-Task application-layer RBAC queries.
- `public.list_my_tasks(uuid)` remains restricted to trusted `service_role` execution.
- The existing `Team Agent -> TasksService -> Tasks-owned persistence` boundary remains unchanged.
- Result ordering is deterministic by due date, creation time, and Task ID.

#### Verified

- Verified `npm run typecheck` passes.
- Verified all 53 automated tests pass.
- Verified migration `20260817101500_my_tasks_read_model.sql` is synchronized with the linked remote Supabase database.
- Verified unauthenticated `GET /api/v1/me/tasks` returns HTTP `401`.
- Verified Alice resolves through `/api/v1/me` as the authenticated Cadence actor.
- Verified Alice's existing assigned open Task is returned through `/api/v1/me/tasks`.
- Verified previously created open but unassigned authoritative Tasks are not returned through Alice's My Tasks read model.
- Live-verified fresh Discussion -> Team Agent proposal -> human edit/assignment -> authoritative Task -> My Tasks visibility.
- Fresh verification proposal `f82e2320-45d8-42b8-9dd2-e7280d857c51` was human-edited to assign Alice.
- Fresh authoritative Task `c132b53e-e9b9-4389-81bc-6d4011bf1e2f` was created through `TasksService`.
- Verified that exact Task appears through `/api/v1/me/tasks`.
- Verified returned `assigned_to` matches authenticated Alice.

#### Current Limitations

- General Task listing and Task-history APIs remain deferred.
- Completed and cancelled Tasks are outside the current My Tasks read model.
- Complete audit reconstruction remains outstanding for VS-001.
- One-correlation-ID continuity across the complete multi-request workflow still requires explicit verification or correction.
- External LLM invocation, assignee-name resolution, and natural-language due-date resolution remain deferred.
- The Team Agent worker remains one-shot rather than continuously hosted.

### VS001-07 - Authoritative Task Creation

#### Added

- Added the authoritative Tasks application boundary through `TasksService`.
- Added Tasks domain types, errors, repository contract, service, and automated tests.
- Added `SupabaseTasksRepository`.
- Added atomic `public.create_authoritative_task(...)`.
- Added migration `20260816123000_authoritative_task_creation.sql`.
- Added Tasks-specific AI-proposal idempotency protection.
- Added proposal-to-Task provenance through `public.source_links`.
- Added `TaskCreated.v1`.
- Added Team Agent reviewed-proposal materialization repository and service.
- Added authenticated materialization endpoint: `POST /api/v1/projects/{projectId}/task-proposals/{proposalId}/task`.
- Added proposal result linkage through `result_entity_type` and `result_entity_id`.
- Added materialization automated tests.
- Expanded the API suite to 51 passing tests.

#### Architecture

- Preserved the mandatory `Team Agent -> TasksService -> TasksRepository` dependency direction.
- Team Agent has no direct dependency on `TasksRepository`, `SupabaseTasksRepository`, or `public.tasks`.
- `agent.approve` remains separate from `task.create` and `task.assign`.
- `TasksService` independently enforces `task.create` and `task.assign` when required.
- Tasks persistence revalidates authorization for defence in depth.
- Authoritative Task values come from `reviewed_payload`.
- The authenticated human remains the authoritative Task creator; the AI proposal remains provenance.
- Task creation is idempotent by reviewed AI proposal.
- `TaskCreated.v1` continues the human-review event correlation and uses the human-review event as causation.
- Team Agent records the resulting Task ID only after `TasksService` has created or returned the authoritative Task.

#### Verified

- Verified `npm run typecheck` passes.
- Verified all 51 automated tests pass.
- Verified migration `20260816123000_authoritative_task_creation.sql` is synchronized with the linked remote Supabase database.
- Live-verified confirmed proposal -> authoritative Task.
- Live-verified edited proposal -> authoritative Task using human-reviewed values.
- Live-verified retry returns the same Task with `created = false` and emits no duplicate `TaskCreated.v1`.
- Live-verified `task.assign` denial with `task.create = true` and `task.assign = false`.
- Verified denied assignment produced zero Task, provenance, and `TaskCreated.v1` writes.
- Live-verified API retry returns HTTP `200` with the existing Task.
- Live-verified fresh Discussion -> Team Agent proposal -> human confirm -> authoritative Task through the API.
- Fresh first-time materialization returned HTTP `201` with `created = true`.
- Verified proposal result linkage, source provenance, event correlation, and event causation.
- Verified Team Agent source contains no direct Tasks persistence dependency.

#### Current Limitations

- `GET /me/tasks` visibility remains outstanding for VS-001.
- Complete audit reconstruction remains outstanding.
- The complete multi-request workflow has not yet been proven to use one correlation ID from the initial Discussion command through human review and Task creation.
- External LLM invocation, assignee-name resolution, and natural-language due-date resolution remain deferred.
- The Team Agent worker remains one-shot rather than continuously hosted.


### VS001-06 —Human Proposal Review
#### Added
- Added authenticated project-scoped Team Agent proposal-review endpoint:
  - `POST /api/v1/projects/{projectId}/task-proposals/{proposalId}/review`.
- Added `TeamAgentService.reviewTaskProposal()` with server-side `agent.approve` authorization.
- Added Team Agent review types, repository contract, Supabase adapter, route validation, and typed review errors.
- Added `reviewed_payload` to `public.ai_proposals` so original AI output remains preserved while final human-reviewed values are stored separately.
- Added atomic `public.review_team_agent_task_proposal(...)` persistence function.
- Added confirm, edit, and reject review outcomes.
- Added reviewer and review-timestamp persistence through `reviewed_by` and `reviewed_at`.
- Added versioned `AIProposalConfirmed.v1`, `AIProposalEdited.v1`, and `AIProposalRejected.v1` domain events.
- Added nine VS001-06 Team Agent service tests covering successful and denied review paths and review validation.
- Added migration `20260816024841_team_agent_human_proposal_review.sql`.
- Added corrective migration `20260816082249_fix_team_agent_review_column_ambiguity.sql` after live PostgreSQL verification exposed an output-variable/column-name ambiguity.
#### Architecture
- Preserved the original AI `payload` as immutable proposal provenance.
- `reviewed_payload` is populated for confirmed and edited proposals and remains null for rejected proposals.
- Confirm copies the original AI proposal into `reviewed_payload`; edit stores human-reviewed values separately; reject records no approved payload.
- Human edits cannot rewrite `source_message_id` or `source_message_version_id`.
- Review authorization uses the `agent.approve` permission code rather than hard-coded role names.
- `agent.approve` is checked in both the application service and the database persistence function for defence in depth.
- Review RPC execution remains restricted to trusted `service_role` access.
- Team Agent still does not create or modify authoritative Tasks.
- Confirmed or edited proposals remain non-authoritative until the later TasksService integration revalidates `task.create` and `task.assign` where required.
#### Verified
- Verified `npm run typecheck` passes.
- Verified all 29 automated tests pass.
- Verified both VS001-06 migrations are synchronized with the linked remote Supabase database.
- Live-verified confirm: pending proposal became `confirmed`, `reviewed_payload` matched the original AI payload, reviewer/timestamp were recorded, and `AIProposalConfirmed.v1` was emitted.
- Live-verified edit: original AI payload remained unchanged, human-reviewed title/description were stored separately, source-message provenance remained unchanged, and `AIProposalEdited.v1` was emitted.
- Live-verified reject: proposal became `rejected`, `reviewed_payload` remained null, reviewer/timestamp were recorded, and `AIProposalRejected.v1` was emitted.
- Verified the live review flow did not create a new row in `public.tasks`.
#### Current Limitations
- Proposal listing is not yet implemented.
- Confirmed/edited proposals are not yet integrated with `TasksService`.
- Authoritative Task creation from reviewed proposals is not yet implemented.
- `task.create` and `task.assign` have not yet been exercised through the reviewed-proposal-to-Task flow.
- External LLM invocation, prompt-version selection, assignee resolution, and natural-language due-date resolution remain deferred.
- The Team Agent worker remains one-shot and is not yet hosted as a continuous production worker.

### VS001-05 —Asynchronous Team Agent Task-Proposal Processing

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

- Correlation IDs identify truthful request or processing contexts; a complete business journey may span multiple correlation IDs and is reconstructed through provenance, aggregate identity, causation, Audit projection, and correlation metadata.

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
- Expanded the Audit module README to document VS001-09 projection, reconstruction, authorization, correlation semantics, worker integration, and live verification.
- Recorded VS001-09 complete Audit reconstruction in `docs/vertical-slices/VS-001.md`.
- Refined VS-001 documentation to distinguish request correlation from cross-request business-journey reconstruction.

### Current VS-001 Status

Completed:

- VS001-01 walking skeleton.
- VS001-02 authentication and identity.
- VS001-03 Project Workspace read model.
- VS001-04 Discussion message creation.
- VS001-05 asynchronous Team Agent task-proposal processing.
- VS001-06 human proposal review.
- VS001-07 authoritative Task creation from reviewed proposals.
- VS001-08 My Tasks read model.
- VS001-09 complete Audit reconstruction.
- `TasksService` ownership of authoritative Task creation.
- Independent `task.create` and conditional `task.assign` enforcement.
- Tasks-owned proposal idempotency and provenance.
- `TaskCreated.v1` creation with review-event correlation and causation.
- Authenticated `GET /api/v1/me/tasks` visibility for current actionable assigned Tasks.
- Independent Audit projection of material VS-001 domain events.
- Historical Audit backfill with zero missing supported projections.
- Protected Task audit reconstruction through `audit.view`.
- Complete Discussion-to-Task business-journey reconstruction across multiple truthful request correlations.
- Live verification that the current Audit inspection request correlation remains separate from historical journey correlations.
- 61 passing automated API tests and TypeScript type checking during VS001-09 implementation.

In progress:

- Final VS-001 UI integration where required.
- Final post-documentation/post-hardening verification and source-control checkpoint.

Next:

- Run the final TypeScript, automated-test, migration-history, staged-diff, and secret checks.
- Commit and push VS001-09.
- Continue final VS-001 UI integration without weakening established module, RBAC, provenance, event, and Audit boundaries.

### Known Limitations / Deferred Work

- Discussion message listing, individual retrieval, history retrieval, editing, deletion, reactions, mentions, and file-link handling remain deferred.
- `mention_user_ids` and `file_ids` from the broader API contract remain unimplemented.
- Discussion command idempotency remains unimplemented; automatic retries of message creation should not be introduced without an idempotency strategy.
- External LLM invocation and production model-provider integration remain deferred.
- Prompt-version selection, assignee-name resolution, natural-language due-date resolution, and AI confidence scoring remain deferred.
- General Task listing and Task-history APIs remain deferred beyond the narrow authenticated My Tasks read model.
- Final VS-001 UI integration remains outstanding where required.
- The Team Agent/Audit worker remains one-shot; continuous production worker hosting and supervision remain future work.
- Some older module test files remain lighter-weight than the newer Discussion, Team Agent, Tasks, and Audit coverage; database-backed integration automation remains future work.


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

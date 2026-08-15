# Discussion Module

## Purpose

The Discussion module provides Cadence-native project conversation and preserves discussion history as authoritative, traceable project context.

VS001-04 introduces the first implemented Discussion command:

`postMessage()`

The current implementation supports authenticated human users posting a message to a project discussion.

## Responsibilities

The Discussion module is responsible for:

- discussion messages,
- immutable message versions,
- message threading relationships,
- message-related domain events,
- Discussion-specific validation,
- Discussion permission enforcement through RBAC.

The Discussion module does not own tasks, decisions, project health, AI proposals, or audit processing.

## Data Owned

Primary Discussion state is stored in:

- `public.messages`
- `public.message_versions`
- `public.message_mentions`
- `public.message_reactions`

VS001-04 currently writes only:

- `public.messages`
- `public.message_versions`

Message-related domain events are written to:

- `public.domain_events`

as part of the same database transaction.

## Public Commands

### `postMessage()`

Implemented in VS001-04.

Application service:

`DiscussionService.postMessage()`

HTTP endpoint:

`POST /api/v1/projects/{projectId}/messages`

Required permission:

`message.create`

Current request support:

- `content`
- optional `thread_parent_id`

The broader API contract also defines `mention_user_ids` and `file_ids`, but these are not implemented in VS001-04.

## Public Queries

No Discussion query is implemented yet.

Future contract operations include:

- `getMessage()`
- `getMessageHistory()`
- `listProjectMessages()`
- `getThread()`
- `searchMessages()`

These must be implemented through the Discussion module rather than by allowing other modules to read Discussion internals directly.

## Events Emitted

### `MessageCreated.v1`

VS001-04 persists the event as:

- `event_type = MessageCreated`
- `event_version = 1`
- `aggregate_type = message`
- `aggregate_id = newly created message ID`
- `project_id = message project`
- `actor_type = human`
- `actor_id = authenticated Cadence user`
- `correlation_id = request correlation ID`
- `causation_id = null` for the current human-originated HTTP command

The event begins with:

`status = pending`

for later transactional-outbox processing.

## Events Consumed

None in VS001-04.

The Team Agent and other modules may later consume Discussion events.

They must not be embedded directly into the Discussion write transaction.

## Dependencies

The Discussion application service depends on:

- `RequestContext`
- `RbacService`
- `DiscussionRepository`

The module does not depend directly on Supabase.

The concrete database implementation is:

`SupabaseDiscussionRepository`

located under:

`src/infrastructure/database`

## Permissions

Posting a message requires:

`message.create`

Authorization follows:

```text
authenticated Cadence user
  ->
active project membership
  ->
project role
  ->
permission codes
  ->
message.create
```

If no active project membership exists, the service returns the Discussion project-not-found condition.

If an active project member lacks `message.create`, the operation is denied.

Permission decisions are based on permission codes rather than hard-coded role names.

## Validation

VS001-04 validates:

- message content must be a string at the HTTP boundary,
- trimmed message content must not be empty,
- message content must not exceed 20,000 characters,
- project IDs supplied to the route must be valid UUIDs,
- thread parent IDs must be valid UUIDs when supplied,
- a thread parent must exist,
- a thread parent must belong to the same project,
- a deleted message cannot be used as a thread parent.

Content is trimmed before persistence.

## Errors

Current Discussion errors include:

- `DiscussionProjectNotFoundError`
- `DiscussionPermissionDeniedError`
- `DiscussionValidationError`
- `DiscussionParentMessageNotFoundError`

The HTTP route maps these to the standard Cadence API error envelope.

Current mappings include:

- invalid content -> `400 VALIDATION_ERROR`
- invalid/non-existent thread parent -> `400 VALIDATION_ERROR`
- active member without `message.create` -> `403 PERMISSION_DENIED`
- unavailable project membership/resource -> `404 NOT_FOUND`

Unexpected infrastructure failures are passed to the global error-handling path.

## Persistence and Transaction Boundary

VS001-04 uses:

`public.post_discussion_message(...)`

implemented by migration:

`20260813000100_post_discussion_message.sql`

The function atomically persists:

```text
messages
  +
message_versions version 1
  +
MessageCreated.v1 domain event
```

All three writes occur in one PostgreSQL transaction.

If any part fails, the entire operation rolls back.

The API therefore does not perform three independent client-side inserts.

## Security

The HTTP endpoint is protected by Cadence authentication middleware.

`DiscussionService` performs application-level RBAC before calling the repository.

The PostgreSQL function performs a second `message.create` permission check immediately before persistence as defence in depth.

`public.post_discussion_message(...)` is:

- `SECURITY DEFINER`,
- configured with a fixed `search_path`,
- revoked from `public`,
- revoked from `anon`,
- revoked from `authenticated`,
- executable only by `service_role`.

The Supabase secret credential remains server-side.

Browser clients must not call the Discussion write RPC directly.

## Correlation and Causation

The request `correlationId` is propagated through:

```text
HTTP request
  ->
RequestContext
  ->
DiscussionService
  ->
DiscussionRepository
  ->
post_discussion_message()
  ->
domain_events.correlation_id
```

VS001-04 manually verified that the correlation ID returned in the API response matches the correlation ID stored on the resulting `MessageCreated.v1` event.

For a message posted directly by a human HTTP request:

`causation_id = null`

Future event-triggered Discussion operations may supply a causation ID when appropriate.

## Tests

VS001-04 includes six executable Discussion service unit tests covering:

- successful message creation with trimmed content,
- actor and correlation propagation,
- whitespace-only content rejection,
- content longer than 20,000 characters,
- missing project membership,
- active membership without `message.create`.

Run:

```powershell
npm run typecheck
npm test
```

At the VS001-04 verification checkpoint:

```text
Discussion tests: 6 passed
Discussion tests: 0 failed

Whole API test runner:
12 passed
0 failed
```

Some existing module `*.test.ts` files remain empty placeholders and are counted by Node as successful test files. They should not be interpreted as substantive automated coverage.

## Manually Verified in VS001-04

### Successful message creation

An authenticated authorised user successfully posted a message through:

`POST /api/v1/projects/{projectId}/messages`

The API returned the newly created message with:

- `author_type = human`
- `current_version = 1`
- `thread_parent_id = null`
- `edited_at = null`

### Atomic Persistence

The successful request created:

- one `messages` row,
- one `message_versions` row with `version_number = 1`,
- one `MessageCreated` domain event with `event_version = 1`.

The message ID matched the event aggregate ID.

The authenticated Cadence user matched the message author, version editor, and event actor.

The API response correlation ID matched `domain_events.correlation_id`.

### Invalid Content

Whitespace-only content returned:

`400 VALIDATION_ERROR`

No message was persisted.

### Invalid Thread Parent

A valid UUID referencing a non-existent parent message returned:

`400 VALIDATION_ERROR`

No partial message was persisted.

### Permission Denial

A temporary active project member assigned the normal `VIEWER` role was authenticated successfully.

Because `VIEWER` does not contain `message.create`, posting a message returned:

`403 PERMISSION_DENIED`

No message was persisted.

The temporary Auth user, Cadence user, and project membership were deleted after verification.

## Known Limitations

VS001-04 intentionally does not implement:

- listing project messages,
- retrieving an individual message,
- message history retrieval,
- editing messages,
- deleting messages,
- reactions,
- mentions,
- file attachments or file links,
- idempotency handling,
- Team Agent consumption of `MessageCreated.v1`,
- background processing of pending domain events,
- Discussion-specific audit processing.

Although the OpenAPI request contract includes `mention_user_ids` and `file_ids`, VS001-04 does not yet implement those capabilities.

Retry behaviour for state-changing Discussion commands must be addressed before relying on automatic retries because idempotency is not yet implemented.

## Internal Functions — Do Not Call Externally

The following are implementation details rather than public module contracts:

- `SupabaseDiscussionRepository`
- `public.post_discussion_message(...)`
- direct inserts into `messages`
- direct inserts into `message_versions`
- direct inserts into `domain_events`

Other application modules should interact with Discussion through documented module interfaces and events.

## Boundary Rules

Discussion owns authoritative message state and message-version history.

Editing must create a new immutable message version rather than destructively replacing historical content.

The Discussion module does not create tasks directly.

The Team Agent must consume `MessageCreated.v1` asynchronously rather than being called from `DiscussionService.postMessage()`.

A failure in the Team Agent must not prevent humans from using Discussion.

Cross-module reactions should occur after the owning Discussion transaction commits.

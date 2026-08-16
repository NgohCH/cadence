# Team Agent Module

## Ownership

The Team Agent module owns:

- AI-generated proposals
- proposal validation
- proposal review and confirmation workflow
- AI provenance related to proposals

The Team Agent module does not own Tasks.

---

## Boundary Rules

The Team Agent module must never:

- insert directly into task tables
- update task records directly
- call Tasks repositories directly
- bypass Tasks module permissions
- read Discussion persistence directly
- be called directly from the Discussion write path

When a confirmed proposal requires a Task to be created, Team Agent must call the Tasks service.

Expected future flow:

```text
TeamAgentService.confirmProposal()
  ->
RBAC checks agent.approve
  ->
TasksService.createTask()
  ->
Tasks checks task.create
  ->
Tasks checks task.assign when required
  ->
Tasks persists the authoritative Task
```

A Team Agent proposal is not an authoritative Task.

Human confirmation is required before a proposal may result in Task creation.

---

# VS001-05 - MessageCreated.v1 Consumption

VS001-05 introduces the first asynchronous Team Agent processing path.

Implemented flow:

```text
Discussion
  ->
MessageCreated.v1
  ->
domain-event fan-out
  ->
Team Agent consumer delivery
  ->
DomainEventProcessor
  ->
MessageCreatedV1Handler
  ->
DiscussionService.getMessageVersion()
  ->
TeamAgentService
  ->
AI run
  ->
pending task proposal
  ->
AIProposalCreated.v1
```

`DiscussionService.postMessage()` does not call Team Agent.

This asynchronous boundary must be preserved.

---

## Event Consumer

The Team Agent consumer is:

```text
team-agent.message-created.v1
```

It subscribes to:

```text
event_type = MessageCreated
event_version = 1
```

Subscriptions are stored in:

```text
public.domain_event_subscriptions
```

Consumer processing state is stored independently in:

```text
public.domain_event_deliveries
```

Each delivery is identified by:

```text
event_id
+
consumer_name
```

This allows multiple consumers to process the same event independently.

For example:

```text
MessageCreated.v1
        |
        +--> Team Agent
        |
        +--> Notifications
        |
        +--> Project Health
```

A failure in one consumer does not represent failure in another consumer.

---

## Domain Event Fan-Out

`public.domain_events` remains the transactional event/outbox record.

An `AFTER INSERT` trigger performs fan-out to registered consumers.

The fan-out process:

```text
domain event inserted
  ->
find active subscriptions
  ->
create consumer delivery rows
  ->
mark event fan-out complete
```

Discussion does not know which modules subscribe to its events.

The dependency direction therefore remains:

```text
Discussion
  ->
domain event
```

rather than:

```text
Discussion
  ->
Team Agent
```

---

## Domain Event Status vs Delivery Status

The status on:

```text
public.domain_events
```

represents event fan-out/infrastructure processing.

It does not represent the completion state of every downstream consumer.

Consumer processing state belongs to:

```text
public.domain_event_deliveries
```

For example:

```text
MessageCreated.v1
  domain event status = processed

Team Agent delivery
  status = processed

Notification delivery
  status = failed

Project Health delivery
  status = pending
```

Each consumer therefore has an independent lifecycle.

---

## Delivery Lifecycle

A delivery may move through:

```text
pending
  ->
processing
  ->
processed
```

or:

```text
pending
  ->
processing
  ->
failed
  ->
retry
```

Delivery records include:

```text
processing_attempts
available_at
claimed_at
claim_token
lease_expires_at
processed_at
last_error
```

---

## Delivery Claiming

Delivery claiming uses PostgreSQL:

```text
FOR UPDATE SKIP LOCKED
```

This allows multiple workers to safely claim different available deliveries.

Conceptually:

```text
Worker A
  ->
Delivery 001

Worker B
  ->
Delivery 002
```

rather than:

```text
Worker A
  ->
Delivery 001

Worker B
  ->
Delivery 001
```

The current claim function is:

```text
public.claim_domain_event_delivery()
```

The default processing lease is:

```text
900 seconds
```

---

## Claim Tokens and Leases

A successful claim includes:

```text
claim_token
claimed_at
lease_expires_at
```

The claim token protects against stale workers.

Example:

```text
Worker A claims delivery
  ->
claim token ABC

Worker A stops responding
  ->
lease expires

Worker B reclaims delivery
  ->
claim token XYZ

Worker A later attempts completion with ABC
  ->
completion rejected
```

Only the worker holding the active claim may complete or fail that delivery.

Expired processing leases may be reclaimed.

---

## Retry Behaviour

When processing fails, the delivery may be marked:

```text
status = failed
```

with:

```text
last_error
available_at
```

The delivery remains retryable.

Processing attempts are tracked through:

```text
processing_attempts
```

The originating Discussion message and domain event are not recreated during retries.

---

# Generic Event Infrastructure

Reusable event-processing infrastructure lives under:

```text
apps/api/src/infrastructure/events/
```

Current components:

```text
domain-event.ts
domain-event.handler.ts
domain-event.repository.ts
domain-event.processor.ts
domain-event.processor.test.ts
```

The processor contains no Team Agent business logic.

Normal processing:

```text
claim delivery
  ->
invoke handler
  ->
complete delivery
```

Failure processing:

```text
claim delivery
  ->
handler throws
  ->
mark delivery failed
  ->
rethrow error
```

If there is no available delivery:

```text
processNext()
  ->
false
```

---

## Domain Event Envelope

The shared domain-event structure contains:

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

This structure mirrors the metadata required for traceable asynchronous processing.

---

# MessageCreatedV1Handler

The Team Agent event handler is:

```text
apps/api/src/modules/team-agent/message-created.handler.ts
```

Consumer:

```text
team-agent.message-created.v1
```

The handler accepts:

```text
MessageCreated.v1
```

It validates:

```text
event_type = MessageCreated
event_version = 1
aggregate_type = message
```

It also verifies that:

```text
event.projectId
  =
payload.project_id
```

and:

```text
event.aggregateId
  =
payload.message_id
```

Invalid or inconsistent events are rejected.

---

## MessageCreated.v1 Payload

The current payload contains:

```text
message_id
project_id
author_user_id
thread_parent_id
version_number
```

The message body is deliberately not duplicated into the event.

Instead, Team Agent retrieves the authoritative immutable message version through the Discussion module.

---

# Discussion Boundary

Team Agent must not directly query:

```text
public.messages
public.message_versions
```

Instead it calls:

```text
DiscussionService.getMessageVersion()
```

using the exact:

```text
project_id
message_id
version_number
```

referenced by the event.

This preserves Discussion ownership of Discussion state.

---

## Why Exact Message Version Retrieval Matters

Consider:

```text
MessageCreated.v1
  ->
version_number = 1
```

If the message is later edited:

```text
current message
  ->
version 2
```

a delayed Team Agent worker must still analyse:

```text
version 1
```

because that is the immutable version referenced by the originating event.

This prevents asynchronous processing from silently changing meaning because a message was edited after the event was created.

---

# Team Agent Service

The handler passes the immutable Discussion content into:

```text
TeamAgentService.processMessageForTaskProposal()
```

Persistence is accessed through:

```text
TeamAgentRepository
```

The current Supabase implementation is:

```text
apps/api/src/infrastructure/database/supabase-team-agent.repository.ts
```

---

# VS001-05 Development Proposal Generator

VS001-05 currently uses a deterministic development generator.

Metadata:

```text
model_provider = cadence-development
model_name = deterministic-task-proposal-v1
```

This is not an external LLM integration.

Its purpose is to prove the module boundaries, asynchronous processing path, persistence, idempotency, and provenance before introducing a real model provider.

---

## Verified Example

Source message:

```text
Daniel, please finalise the syllabus by Friday.
```

The current generator produces:

```text
title       = Daniel, please finalise the syllabus by Friday.
description = Daniel, please finalise the syllabus by Friday.
assigned_to = null
due_date    = null
confidence  = null
```

These null values are intentional.

Cadence does not fabricate unsupported interpretations.

---

## Assignee Resolution

VS001-05 does not yet implement authoritative user-name resolution.

Therefore:

```text
Daniel
  ->
assigned_to = null
```

A future implementation should resolve a human-readable name against an authoritative source such as active project membership.

If the name cannot be resolved unambiguously, the proposal should remain unresolved for human review.

---

## Due-Date Resolution

VS001-05 does not yet implement natural-language date interpretation.

Therefore:

```text
Friday
  ->
due_date = null
```

A future implementation will need context including:

```text
event timestamp
project/user timezone
calendar date
locale
```

before converting a relative phrase into an authoritative due date.

Ambiguous interpretations should remain subject to human review.

---

## Confidence

The deterministic development generator does not generate an AI confidence score.

Therefore:

```text
confidence = null
```

Cadence does not invent an arbitrary confidence value.

---

# AI Run Persistence

Processing creates a record in:

```text
public.ai_runs
```

The current development run records:

```text
agent_type = team-agent
model_provider = cadence-development
model_name = deterministic-task-proposal-v1
status = completed
```

Input provenance includes references to the originating:

```text
source event
message
message version
version number
```

---

# Source-Event Idempotency

VS001-05 adds:

```text
ai_runs.source_event_id
```

The column references:

```text
public.domain_events.id
```

A unique partial index:

```text
ai_runs_source_event_uidx
```

enforces one AI run per non-null source event.

Conceptually:

```text
MessageCreated event X
  ->
AI run X
```

Retrying event X must not normally create:

```text
AI run X-2
AI run X-3
```

The database remains the final authority for this constraint.

---

## Concurrent Idempotency Protection

The persistence function also uses PostgreSQL conflict handling around:

```text
source_event_id
```

This protects against a race where:

```text
expired Worker A
+
new Worker B
```

both attempt to process the same source event.

The unique database constraint provides the final concurrency guard.

---

# AI Proposal Persistence

Human-reviewable proposals are stored in:

```text
public.ai_proposals
```

For VS001-05:

```text
proposal_type = task
status = pending
```

The proposal contains:

```text
title
description
assigned_to
due_date
source_message_id
source_message_version_id
```

A pending proposal is not an authoritative Task.

VS001-05 does not insert into:

```text
public.tasks
```

---

# Team Agent Persistence RPC

Team Agent persistence uses:

```text
public.create_team_agent_task_proposal()
```

The function validates:

- source event ID
- project ID
- message ID
- immutable message version ID
- version number
- correlation ID
- model metadata
- proposal title
- confidence range when supplied

It also verifies that the originating event is:

```text
event_type = MessageCreated
event_version = 1
aggregate_type = message
```

and that the event references the expected project and message.

---

## Transactional Proposal Creation

The persistence function creates:

```text
AI run
+
pending AI proposal
+
AIProposalCreated.v1
```

within one database operation.

This ensures Team Agent persistence and the event describing that state transition remain consistent.

---

# AIProposalCreated.v1

Successful proposal creation emits:

```text
AIProposalCreated.v1
```

The event uses:

```text
aggregate_type = ai_proposal
aggregate_id = proposal_id
```

Its payload includes references to:

```text
proposal_id
ai_run_id
proposal_type
status
source_event_id
message_id
message_version_id
```

---

# Correlation and Causation

`AIProposalCreated.v1` preserves the original:

```text
correlation_id
```

from the Discussion operation.

Its:

```text
causation_id
```

references the originating:

```text
MessageCreated.v1.event_id
```

Conceptually:

```text
Discussion request
  correlation = C1
        |
        v
MessageCreated.v1
  event = E1
  correlation = C1
        |
        v
AIProposalCreated.v1
  correlation = C1
  causation = E1
```

This provides traceability across the asynchronous module boundary.

---

# Worker

VS001-05 provides a one-shot worker:

```text
apps/api/src/worker.ts
```

Run it with:

```text
npm run worker:once
```

The worker composes:

```text
SupabaseDomainEventRepository
  ->
DomainEventProcessor
  ->
MessageCreatedV1Handler

DiscussionService
  ->
SupabaseDiscussionRepository

TeamAgentService
  ->
SupabaseTeamAgentRepository
```

The worker processes at most one available Team Agent delivery and then exits.

---

## Worker Behaviour

When work is available:

```text
Cadence worker: processed one Team Agent delivery.
```

When no work is available:

```text
Cadence worker: no pending Team Agent delivery.
```

The current one-shot worker is intended for development and controlled pilot execution.

Continuous background-worker hosting is not yet implemented.

---

# Live VS001-05 Verification

VS001-05 was manually verified against the linked Supabase environment.

## Source Event

Verified source event:

```text
event_type = MessageCreated
event_version = 1
```

Event ID:

```text
2cecb0d3-93a5-41b6-9a78-5c2fe32b5c32
```

Message ID:

```text
e2f2d384-380b-4fd0-9dca-b3049600d1b3
```

Correlation ID:

```text
0b02f7ba-649d-447d-862e-6f1f7bfd46bd
```

---

## Delivery Verification

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

---

## AI Run Verification

Created AI run:

```text
079dee92-d47f-4b66-8e24-e8f458552c70
```

Verified:

```text
status = completed
model_provider = cadence-development
model_name = deterministic-task-proposal-v1
```

---

## Proposal Verification

Created proposal:

```text
2312c92f-43aa-4584-ade7-532a49c3eb08
```

Verified:

```text
proposal_type = task
status = pending
confidence = null
assigned_to = null
due_date = null
```

Verified proposal payload:

```json
{
  "title": "Daniel, please finalise the syllabus by Friday.",
  "due_date": null,
  "assigned_to": null,
  "description": "Daniel, please finalise the syllabus by Friday.",
  "source_message_id": "e2f2d384-380b-4fd0-9dca-b3049600d1b3",
  "source_message_version_id": "fe341677-420a-4856-b833-82e5aba41223"
}
```

---

## Derived Event Verification

Created event:

```text
AIProposalCreated.v1
```

Event ID:

```text
d13d11b0-a8a2-45d4-8ac4-0012ad7f906b
```

Aggregate:

```text
aggregate_type = ai_proposal
aggregate_id = 2312c92f-43aa-4584-ade7-532a49c3eb08
```

Correlation ID:

```text
0b02f7ba-649d-447d-862e-6f1f7bfd46bd
```

Causation ID:

```text
2cecb0d3-93a5-41b6-9a78-5c2fe32b5c32
```

---

## Idempotency Verification

For source event:

```text
2cecb0d3-93a5-41b6-9a78-5c2fe32b5c32
```

verified:

```text
ai_run_count = 1
proposal_count = 1
```

A subsequent worker run returned:

```text
Cadence worker: no pending Team Agent delivery.
```

The verified source event therefore did not create duplicate AI runs or proposals.

---

# Automated Verification

Current typecheck:

```text
npm run typecheck
```

Result:

```text
pass
```

Current automated test result:

```text
tests 20
pass 20
fail 0
cancelled 0
skipped 0
todo 0
```

Coverage added during VS001-05 includes:

- successful event-delivery processing
- empty delivery queue
- handler failure
- immutable Discussion message-version retrieval
- valid `MessageCreated.v1` processing
- unsupported event-version rejection
- inconsistent project rejection
- missing immutable message-version rejection
- deterministic task-proposal generation

---

# Current Limitations

VS001-05 does not yet implement:

- external LLM invocation
- production model-provider integration
- real prompt execution
- prompt-version selection
- AI confidence scoring
- assignee name resolution
- natural-language due-date resolution
- proposal-listing API
- proposal-review API
- proposal editing
- proposal confirmation
- proposal rejection
- TasksService integration for confirmed proposals
- authoritative Task creation
- continuous worker hosting
- production worker scheduling
- production worker supervision

These are deliberate boundaries, not implicit capabilities.

---

# Next Boundary - Human Proposal Review

The next checkpoint begins with:

```text
pending task proposal
  ->
authorised human review
  ->
confirm / edit / reject
```

Confirmation must require:

```text
agent.approve
```

The permission must be checked server-side through the RBAC module.

Role names must not be hard-coded into proposal approval logic.

---

## Human Confirmation

Human approval of a proposal does not automatically grant permission to create or assign a Task.

These remain separate permissions:

```text
agent.approve
task.create
task.assign
```

Conceptually:

```text
agent.approve
  !=
task.create

agent.approve
  !=
task.assign
```

When a confirmed proposal becomes an authoritative Task, the required path is:

```text
TeamAgentService
  ->
TasksService
  ->
task.create permission check
  ->
task.assign permission check when required
  ->
Tasks-owned persistence
```

Team Agent must never write directly to:

```text
public.tasks
```

---

## Human Review Outcomes

Future proposal review should support:

```text
confirm
edit
reject
```

### Confirm

```text
pending proposal
  ->
confirmed
  ->
TasksService
  ->
authoritative Task
```

### Edit

Human changes should preserve:

```text
original AI proposal
AI provenance
human reviewer
review timestamp
final reviewed values
```

The AI-generated source must remain traceable after human modification.

### Reject

```text
pending proposal
  ->
rejected
  ->
no Task created
```

A rejected proposal should remain available for provenance and audit purposes.

---

# Future AI Integration

The deterministic generator is a development architecture probe.

A future AI provider should preserve the existing module boundary:

```text
MessageCreated.v1
  ->
MessageCreatedV1Handler
  ->
TeamAgentService
  ->
AI adapter
  ->
TeamAgentRepository
  ->
pending proposal
```

Introducing a real model must not cause Discussion to call Team Agent directly.

---

## AI Provenance Requirements

When external model integration is introduced, Cadence should retain enough information to reconstruct how a proposal was produced.

Relevant provenance includes:

```text
source message
source message version
source domain event
prompt version
model provider
model name
AI run
raw model output where appropriate
proposal
correlation ID
```

Historical provenance must not be rewritten when model or prompt configuration changes.

---

## Prompt Versioning

Cadence contains:

```text
public.ai_prompt_versions
```

VS001-05 does not yet select or execute a prompt version.

Future AI processing should record:

```text
prompt_version_id
```

on the AI run.

This allows proposals to be traced to the exact prompt configuration that produced them.

---

# Worker Hosting - Future Work

The current:

```text
npm run worker:once
```

execution model is suitable for development and controlled testing.

Production deployment must eventually define:

```text
continuous execution
polling cadence
process supervision
restart behaviour
logging
health monitoring
retry/backoff policy
deployment scaling
```

Changing the worker-hosting model should not require changing the domain-event or Team Agent module contracts.

---

# Implementation Files

## Team Agent

```text
apps/api/src/modules/team-agent/team-agent.types.ts
apps/api/src/modules/team-agent/team-agent.repository.ts
apps/api/src/modules/team-agent/team-agent.service.ts
apps/api/src/modules/team-agent/message-created.handler.ts
apps/api/src/modules/team-agent/team-agent.test.ts
apps/api/src/modules/team-agent/README.md
```

## Event Infrastructure

```text
apps/api/src/infrastructure/events/domain-event.ts
apps/api/src/infrastructure/events/domain-event.handler.ts
apps/api/src/infrastructure/events/domain-event.repository.ts
apps/api/src/infrastructure/events/domain-event.processor.ts
apps/api/src/infrastructure/events/domain-event.processor.test.ts
```

## Database Adapters

```text
apps/api/src/infrastructure/database/supabase-domain-event.repository.ts
apps/api/src/infrastructure/database/supabase-discussion.repository.ts
apps/api/src/infrastructure/database/supabase-team-agent.repository.ts
```

## Worker

```text
apps/api/src/worker.ts
```

## Database Migrations

```text
supabase/migrations/20260815200500_domain_event_deliveries.sql
supabase/migrations/20260815201000_domain_event_delivery_processing.sql
supabase/migrations/20260815202000_domain_event_subscriptions.sql
supabase/migrations/20260815203000_team_agent_task_proposals.sql
```

---

# VS001-05 Summary

VS001-05 proves the following end-to-end asynchronous flow:

```text
Discussion message
  ->
MessageCreated.v1
  ->
consumer delivery
  ->
Team Agent processing
  ->
immutable message retrieval
  ->
AI run
  ->
pending task proposal
  ->
AIProposalCreated.v1
```

The checkpoint also proves:

```text
Discussion does not call Team Agent directly
Team Agent does not read Discussion tables directly
Team Agent does not write Tasks directly
consumer retries are isolated
source-event processing is idempotent
correlation is preserved
causation is traceable
AI proposals remain non-authoritative
human confirmation remains required
```

---

## Attribution

Cadence was conceptualized and prepared by Ngoh Chee Hung.
# Audit Module

## Ownership

The Audit module owns audit projection, audit reconstruction, and audit-facing views.

It does not own authoritative business-module state.

The module is responsible for:

- projecting material domain events into the append-only `audit_events` store;
- reconstructing related activity as one business journey;
- preserving actor, correlation, causation, provenance, and event timing;
- exposing audit reconstruction through protected server APIs;
- enforcing `audit.view` before project audit history is returned.

Business modules remain responsible for their own authoritative state and domain events.

---

## Architectural Boundary

The Audit module consumes existing authoritative records.

It does not become a second source of truth for:

- Discussions;
- Messages;
- AI runs;
- AI proposals;
- Tasks;
- project membership;
- RBAC permissions.

The intended dependency direction is:

```text
Business module
    ->
domain event
    ->
domain-event delivery
    ->
Audit projection
    ->
audit_events
```

Business modules do not call Audit directly.

This avoids coupling Discussion, Team Agent, Tasks, and future modules to the Audit implementation.

---

## Domain Events vs Audit Events

Cadence treats domain events and audit events as related but distinct concepts.

### Domain events

`domain_events` represent material business transitions and software causation.

Examples:

```text
MessageCreated.v1
AIProposalCreated.v1
AIProposalConfirmed.v1
AIProposalEdited.v1
AIProposalRejected.v1
TaskCreated.v1
```

They support:

- asynchronous module coordination;
- correlation;
- causation;
- transactional-outbox delivery;
- retryable event consumers.

### Audit events

`audit_events` represent append-only accountability records.

They preserve:

- original domain-event ID;
- project;
- actor;
- entity;
- business action;
- correlation ID;
- causation source where available;
- before/after state;
- projection metadata;
- original occurrence time.

`audit_events.event_id` is unique and acts as the projection idempotency key.

Updates and deletes are prevented by the existing immutable-table trigger.

---

## VS001-09 Audit Projection

VS001-09 registers:

```text
audit.domain-events.v1
```

as an independent consumer of:

```text
MessageCreated.v1
AIProposalCreated.v1
AIProposalConfirmed.v1
AIProposalEdited.v1
AIProposalRejected.v1
TaskCreated.v1
```

Projection is performed through:

```text
public.project_domain_event_to_audit(event_id)
```

The function is callable only by `service_role`.

Projection is idempotent:

```text
domain event
    ->
audit_events.event_id UNIQUE
    ->
duplicate delivery = harmless no-op
```

The worker may therefore safely retry a delivery after Audit persistence has already succeeded.

---

## Historical Backfill

Domain-event subscriptions do not automatically replay events that existed before a new consumer was registered.

VS001-09 therefore deliberately backfills existing supported VS-001 domain events when the Audit projection migration is applied.

Backfilled audit rows retain:

```text
audit_events.created_at = domain_events.occurred_at
```

This preserves the original business-event chronology rather than recording the later projection time as though the event had just occurred.

Live verification after migration showed:

```text
supported VS-001 domain events = 20
projected audit events         = 20
missing projections            = 0
```

---

## Correlation Model

A Cadence business journey is not required to use one correlation ID.

Correlation IDs describe technical request or processing contexts.

A workflow can legitimately span separate human interactions and therefore multiple correlations.

Verified VS001-09 example:

```text
MessageCreated.v1
correlation = b1e9c88c-0b50-44fa-9392-d8ca11395a00
        |
        v
AIProposalCreated.v1
correlation = b1e9c88c-0b50-44fa-9392-d8ca11395a00

        [separate human HTTP interaction]

AIProposalEdited.v1
correlation = ea7ff31c-ad52-405c-9d1f-b2cc2f73b512
        |
        v
TaskCreated.v1
correlation = ea7ff31c-ad52-405c-9d1f-b2cc2f73b512
```

The two correlations represent truthful separate request contexts.

Cadence does not rewrite those correlations merely to make the complete workflow appear to have occurred in one request.

---

## Business-Journey Reconstruction

Audit reconstruction combines several durable relationships.

For a Task created from a Team Agent proposal:

```text
Task
  |
  v
source_links
  |
  v
AI Proposal
  |
  v
AI Run
  |
  v
source_event_id
  |
  v
MessageCreated.v1
```

The proposal aggregate also connects:

```text
AIProposalCreated.v1
        |
        | same ai_proposal aggregate
        |
        v
AIProposalConfirmed.v1
or
AIProposalEdited.v1
or
AIProposalRejected.v1
```

For successful materialization:

```text
AIProposalConfirmed.v1 / AIProposalEdited.v1
        |
        | causation_id
        |
        v
TaskCreated.v1
```

Reconstruction therefore uses:

- authoritative provenance;
- aggregate identity;
- domain-event causation;
- Audit projection;
- one or more request correlations.

It does not depend on one correlation ID being reused across unrelated HTTP requests.

---

## Task Audit Reconstruction RPC

VS001-09 provides:

```text
public.get_task_audit_journey(
  project_id,
  task_id,
  requesting_user_id
)
```

The RPC:

1. validates required references;
2. revalidates `audit.view`;
3. identifies the Task's AI-proposal source;
4. finds the AI run;
5. locates the originating `MessageCreated.v1`;
6. loads the proposal lifecycle;
7. loads the authoritative `TaskCreated.v1`;
8. joins the corresponding audit projections;
9. returns the journey in chronological order.

The function is restricted to `service_role`.

The API performs authorization before invoking it, and the database revalidates authorization as defence in depth.

---

## HTTP API

Protected endpoint:

```text
GET /api/v1/projects/:projectId/tasks/:taskId/audit
```

Required permission:

```text
audit.view
```

The endpoint returns:

```text
project_id
task_id
correlation_ids
correlation_count
events[]
```

Each event includes:

```text
audit_event_id
domain_event_id
event_type
event_version
entity_type
entity_id
action
actor_type
actor_id
correlation_id
causation_id
source_type
source_id
occurred_at
before_state
after_state
metadata
```

The correlation ID for the current HTTP request is returned separately in the standard API response `meta`.

---

## Request Correlation vs Journey Correlation

A live VS001-09 API verification deliberately supplied:

```text
HTTP request correlation
aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
```

The reconstructed business journey returned:

```text
b1e9c88c-0b50-44fa-9392-d8ca11395a00
ea7ff31c-ad52-405c-9d1f-b2cc2f73b512
```

The test:

```text
journey.correlation_ids contains meta.correlation_id
```

returned:

```text
false
```

This proves that Cadence does not confuse the request used to inspect an audit record with the historical correlations being inspected.

---

## Verified VS001-09 Journey

Live Task:

```text
c132b53e-e9b9-4389-81bc-6d4011bf1e2f
```

Project:

```text
ff571613-672d-4424-813c-5114bdca53a4
```

Reconstructed events:

```text
1. MessageCreated.v1
2. AIProposalCreated.v1
3. AIProposalEdited.v1
4. TaskCreated.v1
```

Verification:

```text
journey event count = 4
correlation count   = 2
```

All four domain events were joined to their corresponding audit projections.

---

## Authorization

Audit reconstruction requires:

```text
audit.view
```

Authorization is enforced in two places.

Application boundary:

```text
AuditQueryService
    ->
ProjectAuthorisationService.getEffectiveProjectAuthorisation(...)
    ->
audit.view
```

Persistence boundary (reconstruction only; no authorization decision):

```text
get_task_audit_journey(...)
    ->
service-role audit reconstruction
```

The application boundary protects against permission changes before the read;
the service-role RPC receives no caller authorization identity and remains an
Audit read-model reconstruction function only.

---

## Worker Integration

The worker currently processes independent Audit and Team Agent deliveries.

Conceptually:

```text
worker invocation
    |
    +-> process one Audit delivery
    |
    +-> process one Team Agent delivery
```

Each consumer owns an independent delivery record.

A Team Agent failure therefore does not erase or invalidate the fact that the originating business event occurred and may already have been successfully audited.

---

## Automated Verification

VS001-09 added automated coverage for:

- supported Audit domain-event projection;
- idempotent existing projection;
- unsupported event rejection;
- unsupported version rejection;
- missing project provenance;
- reconstruction across multiple correlation IDs;
- inaccessible project handling;
- `audit.view` enforcement;
- missing Task journey handling.

Verified automated gate during VS001-09 implementation:

```text
npm run typecheck -> pass
npm test          -> 61 tests / 61 pass / 0 fail
```

A final automated gate should be rerun before the VS001-09 commit after all documentation and route-hardening changes are staged.

---

## Design Principle

The VS001-09 correlation model can be summarized as:

```text
One business journey
    !=
One HTTP correlation

One business journey
    =
durable provenance
+ aggregate identity
+ causation
+ audit projection
+ one or more truthful request correlations
```

This model supports workflows that span minutes, hours, days, different users, background processing, and future approval stages without falsifying technical request history.

---

Cadence was conceptualized and prepared by Ngoh Chee Hung.

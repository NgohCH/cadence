# Tasks Module

## Ownership

The Tasks module owns authoritative task state and Task read models.

This includes:

- task creation;
- task assignment;
- task persistence;
- task creation validation;
- task creation idempotency;
- task provenance/source links;
- task-related domain events;
- authenticated My Tasks visibility.

Only the Tasks module may create or modify authoritative Task state.

Other modules must request authoritative Task operations through `TasksService`.

---

## Application Boundary

Current authoritative creation flow:

```text
caller
  ->
TasksService.createTask()
  ->
RbacService
  ->
TasksRepository
  ->
SupabaseTasksRepository
  ->
public.create_authoritative_task(...)
  ->
public.tasks
```

Current My Tasks read flow:

```text
authenticated caller
  ->
RequestContext.actorUserId
  ->
TasksService.listMyTasks()
  ->
TasksRepository
  ->
SupabaseTasksRepository
  ->
public.list_my_tasks(...)
  ->
public.tasks
```

The Tasks service depends on the `TasksRepository` abstraction.

The concrete Supabase adapter remains under:

```text
apps/api/src/infrastructure/database
```

Other modules must not call `SupabaseTasksRepository` directly.

---

## Authorization

### Authoritative Task Creation

Authoritative Task creation requires:

```text
task.create
```

If:

```text
assigned_to != null
```

the actor must additionally have:

```text
task.assign
```

The actor is always taken from:

```text
RequestContext.actorUserId
```

Client input does not determine the authoritative Task creator.

An authenticated project member without `task.create` is denied.

An assigned Task request without `task.assign` is denied independently.

`agent.approve` does not imply either Tasks permission.

### My Tasks

`GET /api/v1/me/tasks` is self-scoped.

The caller cannot supply another user ID.

The authenticated user is always derived from:

```text
RequestContext.actorUserId
```

A Task is visible through My Tasks only when:

```text
assigned_to = authenticated Cadence user
status IN (open, in_progress)
current project access includes task.view
```

Current project access is evaluated using the user's active project membership and current role permissions.

---

## Defence in Depth

`TasksService` performs application-level authorization for authoritative Task creation.

The Tasks-owned PostgreSQL creation function:

```text
public.create_authoritative_task(...)
```

revalidates:

```text
task.create
task.assign when required
```

immediately before persistence.

The My Tasks read model uses the Tasks-owned PostgreSQL function:

```text
public.list_my_tasks(...)
```

which restricts results to the requested authenticated user and re-evaluates:

```text
task.view
```

for each relevant project.

Both RPCs are restricted to trusted:

```text
service_role
```

execution.

Browser clients must not invoke these server-side Tasks functions directly.

---

## Validation

Current creation validation includes:

- non-empty trimmed title;
- supported priority;
- optional description normalization;
- valid due date when supplied;
- supported source type;
- non-empty source ID;
- non-empty assignee ID when supplied;
- active same-project membership for an assignee.

Current priorities:

```text
low
normal
high
critical
```

New Tasks default to:

```text
status = open
priority = normal
created_by_type = human
```

unless the creation contract explicitly supplies another supported priority.

---

## Reviewed AI Proposal Source

VS001-07 supports authoritative Task creation from:

```text
source_type = ai_proposal
```

with:

```text
source_id = reviewed proposal ID
```

For Team Agent materialization, candidate Task values are supplied by the final human-reviewed proposal payload.

Tasks does not read or interpret Team Agent persistence directly.

The caller supplies the reviewed values through the `TasksService` contract.

---

## Idempotency

One AI proposal may create at most one authoritative Task.

Tasks-owned persistence uses proposal provenance as the idempotency boundary.

The database contains a Tasks-specific partial unique index for:

```text
entity_type = task
source_type = ai_proposal
project_id + source_id
```

Normal retry behaviour:

```text
first call
  ->
new authoritative Task
created = true

same source proposal again
  ->
same authoritative Task
created = false
```

A retry does not emit another `TaskCreated.v1`.

---

## Provenance

Successful AI-proposal materialization records:

```text
public.source_links
```

with:

```text
entity_type = task
entity_id = Task ID
source_type = ai_proposal
source_id = proposal ID
```

Provenance is owned and persisted by the Tasks boundary as part of authoritative creation.

---

## TaskCreated.v1

First-time authoritative Task creation emits:

```text
TaskCreated.v1
```

with:

```text
event_type = TaskCreated
event_version = 1
aggregate_type = task
aggregate_id = Task ID
actor_type = human
actor_id = RequestContext.actorUserId
```

For reviewed Team Agent proposals, the caller may supply the human-review correlation ID and review-event ID.

The resulting Task event then uses:

```text
correlation_id = human review correlation
causation_id = human review event ID
```

This preserves the immediate business lineage from approved proposal to authoritative Task.

---

## Atomic Persistence

Authoritative creation migration:

```text
supabase/migrations/20260816123000_authoritative_task_creation.sql
```

Persistence function:

```text
public.create_authoritative_task(...)
```

The function keeps these operations atomic:

```text
authorization revalidation
  +
Task creation
  +
source provenance
  +
TaskCreated.v1
```

If authorization, validation, assignment, provenance, or event persistence fails, no partial Task creation should remain.

---

## My Tasks Read Model

VS001-08 adds:

```text
GET /api/v1/me/tasks
```

The endpoint returns the authenticated Cadence user's current actionable Tasks.

Current scope is intentionally narrow:

```text
assigned_to = authenticated user
status IN (open, in_progress)
task.view currently granted for the Task project
```

It is not a general Task-history API.

Completed and cancelled Tasks are not returned by this read model.

Ordering is deterministic:

```text
due_date ASC NULLS LAST
created_at DESC
id ASC
```

Database migration:

```text
supabase/migrations/20260817101500_my_tasks_read_model.sql
```

Read function:

```text
public.list_my_tasks(uuid)
```

The API supplies the authenticated actor ID.

The client cannot select another user's Tasks.

The function remains server-side and is executable only by:

```text
service_role
```

---

## Live VS001-07 Verification

Verified confirmed proposal:

```text
2312c92f-43aa-4584-ade7-532a49c3eb08
```

created:

```text
8e7e70dd-d650-4c7d-a605-ff6ad2a68eae
```

Retry returned the same Task with:

```text
created = false
```

and exactly one `TaskCreated.v1`.

Verified edited proposal:

```text
def8f97f-adf7-444a-a1dd-919b3467464b
```

created:

```text
4b4ed424-c4f7-4aab-bbad-138e0b609ab4
```

using the final human-reviewed title and description.

A transaction-scoped authorization test with:

```text
task.create = true
task.assign = false
```

returned:

```text
TASK_ASSIGN_PERMISSION_DENIED
```

and produced:

```text
0 Tasks
0 source links
0 TaskCreated events
```

The transaction was rolled back after verification.

Fresh API materialization created:

```text
3169f627-3fcc-4141-a3b7-c6f93cbd84b0
```

with HTTP `201` and:

```text
created = true
```

---

## Live VS001-08 Verification

Authenticated identity:

```text
Alice Test
afec9f7c-eb66-46b9-9668-cb57b26394b5
```

Anonymous access to:

```text
GET /api/v1/me/tasks
```

returned:

```text
401
```

Authenticated access initially returned Alice's existing actionable Task and correctly excluded the three previously verified VS001-07 authoritative Tasks because those Tasks were unassigned.

A fresh complete vertical-slice verification then used:

```text
Discussion message =
b6494274-379e-4347-9109-ae843cba9b9a

Team Agent proposal =
f82e2320-45d8-42b8-9dd2-e7280d857c51

authoritative Task =
c132b53e-e9b9-4389-81bc-6d4011bf1e2f
```

The deterministic Team Agent proposal initially had:

```text
assigned_to = null
status = pending
```

Human review used:

```text
action = edit
assigned_to = afec9f7c-eb66-46b9-9668-cb57b26394b5
```

and produced:

```text
status = edited
```

Materialization through the established Tasks boundary returned:

```text
created = true
status = open
assigned_to = Alice
```

The resulting authoritative Task was then retrieved through:

```text
GET /api/v1/me/tasks
```

with exact-Task visibility verified:

```text
Task ID match = true
assigned_to match = true
```

This proves:

```text
Discussion
  ->
MessageCreated.v1
  ->
Team Agent proposal
  ->
human review
  ->
TasksService
  ->
authoritative Task
  ->
GET /api/v1/me/tasks
```

---

## Automated Verification

Current gate:

```text
npm run typecheck -> pass
npm test          -> 53 tests / 53 pass / 0 fail
```

Tasks service coverage includes:

- authorized Task creation;
- membership enforcement;
- `task.create` denial;
- independent `task.assign` denial;
- assigned Task creation;
- title validation;
- description normalization;
- priority validation;
- due-date validation;
- My Tasks uses the authenticated actor identity;
- empty My Tasks result handling.

---

## Implementation Files

```text
apps/api/src/modules/tasks/tasks.types.ts
apps/api/src/modules/tasks/tasks.errors.ts
apps/api/src/modules/tasks/tasks.repository.ts
apps/api/src/modules/tasks/tasks.service.ts
apps/api/src/modules/tasks/tasks.routes.ts
apps/api/src/modules/tasks/tasks.test.ts
apps/api/src/infrastructure/database/supabase-tasks.repository.ts
apps/api/src/server.ts
supabase/migrations/20260816123000_authoritative_task_creation.sql
supabase/migrations/20260817101500_my_tasks_read_model.sql
```

---

## Current Limitations

The current Tasks capability remains intentionally narrower than a complete Task-management product.

Not yet implemented through this checkpoint:

- general Task listing/query APIs;
- completed/cancelled Task-history API;
- Task editing;
- Task status transitions;
- Task completion workflow;
- reassignment workflow;
- Task deletion/cancellation commands beyond schema-supported state;
- broader database-backed automated integration coverage.

These future capabilities must not weaken the authoritative creation or authenticated My Tasks boundaries established here.

---

## Attribution

Cadence was conceptualized and prepared by Ngoh Chee Hung.
# VS004-03B Projects and Project Health Pilot Preparation

## Audit conclusion

The first uncommitted 03B implementation incorrectly placed current
`project_health` reads and writes in the Projects preparation repository,
service, and Supabase adapter. VS-001 and the Projects README explicitly keep
Project Health outside Projects ownership. This checkpoint preserves that
frozen boundary.

Projects owns `public.projects`. A new smallest-possible Project Health
bootstrap boundary owns `public.project_health` and preserves existing
`public.project_health_history` semantics. There is no existing Project Health
application module or write contract, so this checkpoint adds only that narrow
server-side preparation boundary. It is not a general Health API or runtime
ownership transfer.

The existing schema is sufficient. `projects` has the required identity,
metadata, lifecycle, progress, owner projection, dates, and timestamps.
`project_health` has one current row per project with constrained status,
reasons, source, actor, and updated timestamp. Append-only health history is
preserved and is not rewritten by this checkpoint. No migration is required.

## Scope and exclusions

This checkpoint implements two independent, server-side, create-only
preparation contracts:

- Projects: exact `projects` read/create/reuse/conflict/postcondition behavior;
- Project Health: exact current `project_health` read/create/reuse/conflict/
  postcondition behavior.

It does not implement membership admission, role assignment, protected-role
transfer, ProjectAuthorisationService calls, Identity preparation calls, a
coordinator, a CLI/package command, a browser route, self-service project
creation, a health update workflow, a migration, or database execution.

## File and interface design

### `apps/api/src/modules/projects/pilot-preparation.types.ts`

Define constrained Project intent types using the existing
`ProjectLifecycleStatus` union. The Project intent contains:

- `manifestProjectKey`;
- exact `project` fields: id, name, nullable description/goal, lifecycle,
  progress, required `ownerUserId`, and nullable dates;
- `operatorPersonId` and `runCorrelationId` in the preparation context.

The intent contains no Health, roles, permissions, memberships, authentication
data, credentials, or secrets. Result evidence reports `CREATED` or `REUSED`
for Project, its lifecycle, identifiers, operator, and correlation ID.
Failure evidence contains only manifest key, operator, correlation ID,
category, and safe code/message.

### `apps/api/src/modules/projects/pilot-preparation.repository.ts`

Publish a narrow Projects-owned port with only:

```text
findProjectById(id)
createProject(project)
```

The port has no Health, update, delete, truncate, upsert, history rewrite,
membership, role, or authorization methods.

### `apps/api/src/modules/projects/pilot-preparation.service.ts`

Publish `ProjectsPilotPreparationService.preparePilotProject(intent, context)`
and a `ProjectsPilotPreparationError` with categories `INPUT`, `PROJECT`, and
`PERSISTENCE`. The service performs Project-only:

1. synchronous input validation;
2. read of the exact Project state;
3. absent/exact/conflict classification for Project;
4. Project creation and exact postcondition verification only when absent;
5. immediate stop on any failure, with no compensation method available;
6. immutable non-secret evidence.

The service does not make a database client available to its decision logic.
The repository port is the only mutation seam, and its mutation vocabulary is
additive create-only.

### `apps/api/src/modules/project-health/` and Health adapter

Because no authoritative Project Health application boundary exists, add the
smallest explicit bootstrap-only module:

- `pilot-preparation.types.ts` for current Health intent/record/context/evidence;
- `pilot-preparation.repository.ts` exposing only exact current Health
  read/create methods;
- `pilot-preparation.service.ts` for exact compatibility and safe resume;
- `pilot-preparation.service.test.ts` for Health behavior and ownership;
- `README.md` documenting ownership without adding a runtime API.

Add the matching thin adapter and test at:

`apps/api/src/infrastructure/database/supabase-project-health-pilot-preparation.repository.ts`

It maps only `project_health`; it never reads/writes `projects` or
`project_health_history`.

### `apps/api/src/infrastructure/database/supabase-projects-pilot-preparation.repository.ts`

Implement the Projects port with the existing Supabase client boundary. Map
camelCase Project records to the existing `projects` table. The adapter exposes
only exact Project reads and inserts and is not wired to the browser, server
routes, or coordinator.

## TDD sequence

1. Refactor the Projects tests to Project-only behavior and assert that its
   port has no Health methods.
2. Add Project Health tests first and run RED because the new Health module is
   absent.
3. Remove Health methods/types/logic from the Projects production boundary and
   run Projects tests GREEN.
4. Add the minimal Project Health module and run its tests GREEN.
5. Add Project Health adapter tests first and run RED, then implement the thin
   adapter and run both adapter suites GREEN.
6. Run Projects, Health, workspace/read, VS002 authorization, full API,
   typecheck, `git diff --check`, and ownership/scope review.

## Required behavior and failure model

Each boundary classifies only its own resource as absent, exact compatible, or
contradictory. Project compatibility includes every Project field represented
by the schema. `ownerUserId` must match the intended Owner Cadence User, but
remains a compatibility/projection field and never becomes authorization
evidence. Health compatibility includes current project ID, status, reasons,
source, and actor. Neither boundary updates or rewrites its resource.

The future coordinator sequences Project before Health because of the Health
foreign key. If Health creation or verification fails after Project creation,
the coordinator stops and never deletes or rewrites the Project. A later run
rereads both boundaries, reuses exact Project state, and creates only missing
exact Health. Project Health preparation does not write artificial history;
existing baseline creation semantics are preserved.

Each boundary distinguishes malformed input, resource conflict, read failure,
create failure, and postcondition failure. Provider or database internals are
not included in returned messages or evidence.

## Governance and closure boundary

This work advances only bounded operator-assisted preparation evidence under
C01.1/C01.3; C01 remains `OUTSTANDING` and C01.2 remains M2. It exercises and
regression-protects existing C06/C07/F03/F05/F06/F07/F08/F09/F12/F13/F15
behavior and does not alter authorization semantics. VS-001 through VS-003
behavior and fixtures remain unchanged.

## VS004-04 handoff

The next checkpoint may consume both published contracts from the coordinator
after complete VS004-02 preflight and Identity preparation have succeeded. It
must sequence Project then Health, then call canonical Project Membership
contracts for admission, ordinary roles, and protected responsibility. It must
not bypass either port or directly mutate either module's persistence.

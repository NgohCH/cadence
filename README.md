# Cadence v0.1 - Supabase/PostgreSQL Migration Package

This package turns the Cadence v0.1 database and module-boundary design into an executable migration baseline for Supabase PostgreSQL.

## Directory structure

```text
Cadence_v0.1_Supabase_Migrations/
├── supabase/
│   └── migrations/
│       ├── 20260808000100_extensions.sql
│       ├── ...
│       └── 20260808002700_seed_roles_permissions.sql
├── tests/
│   ├── schema_smoke.sql
│   └── rls_manual_test.md
├── docs/
│   └── IMPLEMENTATION_NOTES.md
├── CHANGELOG.md
└── README.md
```

## Design baseline

- PostgreSQL is the authoritative system of record.
- Cadence is a modular monolith; each module owns its domain logic.
- Project permissions are project-scoped RBAC; platform administration is separate.
- Messages, audit records, and health history preserve history rather than silently overwriting it.
- AI produces proposals; authoritative project state is created through normal module interfaces.
- Domain events implement the transactional-outbox baseline for loosely coupled modules.
- Browser clients are read-only at the database layer in v0.1. Mutations go through the Cadence server/API.
- RLS protects browser/realtime reads by project membership and permission.
- VS002-02 adds stable Person, replaceable authentication identity,
  time-varying affiliation, temporal membership, and separate project-role
  assignment persistence while retaining the VS-001 user/RBAC bridge.
- VS002-03 adds the stable Person-based Project Authorisation service,
  effective frozen-role permission evaluation, read-only Observer/Auditor
  enforcement, and an explicit VS-001 RBAC compatibility fallback.

## Supabase Auth and local pilot accounts

`public.users.auth_user_id` maps Cadence identity to `auth.users.id`. For the v0.1 pilot, credentials should be held by Supabase Auth rather than by a custom password table. `username` remains a Cadence identity field for the user-facing experience.

A later Entra ID integration should change the authentication mapping, not project membership or role relationships.

## Apply locally

Place the `supabase/migrations` directory inside a Supabase CLI project. Then use the normal Supabase local migration workflow:

```bash
supabase start
supabase migration up
```

To rebuild a local database from scratch and replay all migrations:

```bash
supabase db reset
```

## Deploy to a linked remote project

Review the migration history first, then:

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push --dry-run
supabase db push
```

Do not make production schema changes directly in the Supabase Dashboard after adopting migration-based change control. Capture every schema change in a new migration and commit it to Git.

## Run the schema smoke test

After migration, run `tests/schema_smoke.sql` against the target database. The
test confirms the required tables, baseline RBAC seed, deterministic VS-001
user-to-Person bridge, and migrated membership Person references are present.

The RLS checklist in `tests/rls_manual_test.md` should be executed with at least two real authenticated test users because correct isolation depends on JWT identity and project membership.

## Important server-side requirement

The Supabase service-role credential must remain server-side. The browser should use a publishable/anon key plus the authenticated user's session. Server mutations must independently enforce the Cadence module contract, RBAC permission, validation, idempotency, domain-event write, and audit write.

## Write transaction pattern

A material command should normally execute as one transaction:

```text
BEGIN
  validate command
  mutate owning module state
  insert domain_event
  insert required audit_event
COMMIT
```

Secondary consumers such as Notifications, Project Health, and Team Agent processing operate after the core transaction and may retry independently.

## Production caution

This is the v0.1 engineering baseline, not a substitute for a security review. Before institutional production use, run migration tests against staging, test RLS with realistic roles, review service-key handling, define backup/restore procedures, and complete the planned Entra ID transition.

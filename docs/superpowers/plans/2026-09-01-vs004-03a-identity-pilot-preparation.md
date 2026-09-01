# VS004-03A Identity-Owned Pilot Preparation

## Goal

Add a narrow server-side Identity-owned preparation contract for one validated
VS004 pilot identity. The contract establishes or verifies the relationship:

```text
provider Auth account
  -> stable Cadence Person
  -> Cadence User compatibility projection
  -> authentication identity history
```

The contract is an execution primitive for the later VS004 coordinator. It is
not a browser route, public registration flow, M2 onboarding feature, project
membership operation, role operation, or project-preparation workflow.

## Audit conclusions

- `IdentityPersistenceRepository` currently owns Person and authentication
  identity persistence, but does not publish Cadence User preparation methods.
- The VS001 authentication path is separate and must remain unchanged:
  provider subject -> `users.auth_user_id` -> Cadence User -> RequestContext.
- `AuthProvider` currently verifies access tokens only. An administrative Auth
  provider seam is required for controlled account preparation.
- Existing bootstrap scripts directly use Supabase admin operations, perform
  broad upserts, and reset passwords. They are not reusable as the application
  contract.
- The existing schema supports the contract without a migration. Identity
  persistence remains inside the Identity-owned adapter.

## Proposed boundaries

### `apps/api/src/modules/identity/pilot-preparation.types.ts`

Define the validated one-user preparation intent and non-secret result model.
The intent contains the manifest user key, stable Person ID and profile,
Cadence User ID and profile, provider/login/optional subject identity,
operator Person, and run correlation ID. It contains no project role,
permission, password, token, service-role key, or provider secret.

The result reports `CREATED` or `REUSED` per resource and includes only stable
identifiers, provider/subject metadata, operator Person, and correlation/run
evidence. It never returns credential material.

Define categorized failures for target/intent, provider, Person, Cadence User,
authentication identity, conflict, and persistence/postcondition failures.

### `apps/api/src/modules/identity/pilot-preparation.repository.ts`

Define the Identity-owned persistence port for exact reads and narrowly scoped
creates of Person, Cadence User, and authentication identity. It must not
expose broad upsert, reassignment, delete, historical update, or membership
operations.

The Cadence User methods preserve the existing `auth_user_id` and `person_id`
bridge. Authentication identity methods preserve append-only history and the
existing `AuthenticationIdentity` model.

### `apps/api/src/infrastructure/auth/administrative-auth-provider.ts`

Define a narrow server-side provider-admin port for exact account lookup and
creation. The port must not be the token-verification `AuthProvider`, must not
expose provider secrets, and must not offer password reset or arbitrary
metadata update operations. Any first-account credential is supplied only by
protected provider/runtime configuration held by the provider adapter.

### `apps/api/src/modules/identity/pilot-preparation.service.ts`

Implement the ordered workflow:

1. validate the trusted intent/context shape and require operator/correlation
   provenance;
2. inspect provider account and all relevant Identity state;
3. fail before writes on contradictions or incompatible mappings;
4. create or reuse the provider account, verifying its exact postcondition;
5. create or reuse the Person, verifying immutable identity facts;
6. create or reuse the Cadence User with exact Person/Auth mapping;
7. create or reuse the authentication identity with exact immutable/history
   facts and verify the provider subject -> Person mapping;
8. stop immediately on any failure and return categorized non-secret evidence;
9. never compensate by deleting, reassigning, ending, rewriting history, or
   resetting a password.

The coordinator and project/membership modules are not dependencies of this
service. Project authority remains outside Identity and remains owned by
`ProjectAuthorisationService` for normal application requests.

### Infrastructure adapters

Implement the provider-specific administrative Auth adapter and the
Identity-owned Supabase persistence adapter only behind the interfaces above.
Adapters must use exact reads and single-resource creates. They must not use
broad upsert semantics or direct access to Projects or membership tables.

## TDD sequence

1. Add service tests with fake provider and Identity repository; run RED.
2. Add the intent/result/error types and service contract; run GREEN.
3. Add tests for missing/exact/contradictory Person behavior; run RED then
   GREEN.
4. Add tests for missing/exact/conflicting Cadence User mappings; run RED then
   GREEN.
5. Add tests for missing/exact/conflicting provider identity mappings,
   multiple active identities, and historical/ended identity preservation; run
   RED then GREEN.
6. Add safe-resume, zero-write rerun, failure-stop, and no-compensation tests;
   run RED then GREEN.
7. Add repository/provider adapter contract tests without a live database or
   Auth account; run RED then GREEN.
8. Add secret-free evidence and operator/correlation provenance assertions.
9. Run focused tests, existing Identity persistence/provider and `/api/v1/me`
   compatibility tests, relevant VS002 identity/authorization regressions,
   full API tests because shared Identity production code is changed, API and
   affected script typechecks, `git diff --check`, and final scope review.

## Required behavior

- Missing Person may be created only for an explicitly `new` Person intent.
- Existing Person identity facts are exact and never overwritten.
- Missing Cadence User may be created only with the intended Person and Auth
  mapping.
- Existing Cadence User with a different Person or Auth subject fails closed.
- Missing authentication identity may be appended with the intended provider
  subject and Person.
- Exact active identity is reused without mutation.
- Provider subject conflicts, duplicate active identities, ended-history
  reactivation, and incompatible partial state fail closed.
- An existing provider account is never reassigned, broadly rewritten, or
  password-reset on rerun.
- Each successful step is followed by exact postcondition verification.
- A later run may reuse only exact compatible state and creates only missing
  resources.
- A failure stops later steps and never compensates with destructive actions.

## Explicit exclusions

This checkpoint must not add:

- Projects or Project Health preparation;
- memberships, ordinary roles, protected roles, or authorization calls;
- the VS004 coordinator or executable bootstrap command;
- browser/public routes or self-service onboarding;
- Entra integration;
- migrations, resets, database mutation during tests, or changes to the local
  validated runtime database;
- HANDOFF, CHANGELOG, or requirement traceability updates;
- changes to VS001, VS002, VS003, role semantics, R03 retained fields, or
  the VS003 deterministic fixture.

## Closure evidence

The checkpoint is complete only when the contract and tests demonstrate
Identity-owned persistence, provider/application separation, exact idempotent
reuse, safe resume, fail-closed conflicts, postcondition verification,
non-secret provenance evidence, and unchanged VS001/VS002 compatibility.

The implementation does not close the full C01 outcome, C06 onboarding, or
Pilot Activation. VS004-03B must be reviewed separately before any project or
coordinator work begins.

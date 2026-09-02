# VS004-04B Auth-account Operation Correction Plan

## Goal

Close the prepared-operation gap for controlled pilot Auth-account creation and
reuse. Every Identity resource—Auth account, Person, Cadence User, and
authentication identity—must have an explicit CREATE or REUSE action before
the Identity preparation service can perform any write.

## Audit finding

`apps/api/scripts/vs004-preflight.ts` currently observes `authAccounts` and
uses an existing account to plan `CREATE_AUTH_IDENTITY` or `REUSE`, but
`PilotPlanOperationKind` has no Auth-account operation and no Auth-account
resource key. The 04B executor therefore validates only three Identity
resources. The Identity service also passes the authentication-identity
action to Auth-account preparation, allowing an account write without an
Auth-account operation.

## Constraints

- Add no CLI, package command, HTTP route, migration, schema change, database
  access, or governance update.
- Do not change 04B0, Projects, Project Health, role, or membership behavior.
- Keep Auth-account authority behind the existing administrative provider
  abstraction.
- Keep all operation keys credential-free and deterministic.
- Preserve backwards compatibility for existing 03A callers where required,
  while requiring all four actions from the 04B executor.

## TDD sequence

### 1. RED regressions

Files:

- `apps/api/scripts/vs004-controlled-pilot-execution.test.ts`
- `apps/api/src/modules/identity/pilot-preparation.service.test.ts`

Add tests proving:

- a plan without an Auth-account operation is rejected before Identity;
- Auth-account REUSE plus authentication-identity CREATE cannot create an
  account or any later Identity resource.

Run the focused tests and retain the intended missing-rejection failures.

### 2. Explicit planner operation

Files:

- `apps/api/scripts/vs004-preflight.ts`
- `apps/api/scripts/vs004-preflight.test.ts`

Add `CREATE_AUTH_ACCOUNT` to the operation union. Plan either:

- `REUSE` with `auth-account:<provider>:<subject-or-login>` and the existing
  account ID when the exact active account exists; or
- `CREATE_AUTH_ACCOUNT` with the same credential-free key when absent.

Keep authentication-identity planning independent. Update topology and
operation assertions, including mixed account/identity cases.

### 3. Four-resource Identity action contract

Files:

- `apps/api/src/modules/identity/pilot-preparation.types.ts`
- `apps/api/src/modules/identity/pilot-preparation.service.ts`
- `apps/api/src/modules/identity/pilot-preparation.service.test.ts`

Include `AUTH_ACCOUNT` in `PilotIdentityResourceActions`. Pass its action to
`ensureAuthAccount()`. Validate the complete four-resource action set before
the first mutation; a missing planned REUSE target must fail STALE_PLAN.
Preserve existing default CREATE behavior only for legacy direct callers.

### 4. Executor mapping and evidence

Files:

- `apps/api/scripts/vs004-controlled-pilot-execution.ts`
- `apps/api/scripts/vs004-controlled-pilot-execution.test.ts`

Allowlist and validate `CREATE_AUTH_ACCOUNT` and Auth-account REUSE in the
Identity phase. Require exactly one action for each of the four Identity
resources per user. Pass all four actions to one Identity preparation call.
Map the returned `AUTH_ACCOUNT` evidence to exactly one prepared operation and
reject missing/wrong evidence before later phases.

### 5. Verification

Run:

- focused executor, preflight, and Identity tests;
- 04A, Projects, Project Health, and 04B0 regressions;
- membership/role, authorization, and R03 regressions;
- full API suite;
- API typecheck and explicit VS004 production script typecheck;
- `git diff --check` and scope review.

Stop before staging or committing.

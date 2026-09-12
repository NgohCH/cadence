# VS005 Deployment Runbook

The operator must use ONE reviewed real-target configuration containing only
approved non-secret environment facts. The governed Beta configuration is
`config/cadence.runtime.beta.json`; it was originally created locally under
narrow controlled-Beta bootstrap/preflight authorization, reconciled during
T15-A Task 8, and is now tracked. That history is an approved sequencing
deviation, not hosted Task 15 evidence. No script may guess the public URL,
Supabase URL or project reference, pilot project ID, or safe target marker.

This runbook documents the governed operator path. It is not authorization to
perform a hosted deployment during this checkpoint.

## Reviewed Beta target contract

The reviewed Beta target is:

```text
environment:             beta
safe target marker:       cadence-beta
Cloudflare account:       3d6a31905ac44e9563a523f9c86cbb8d
Cloudflare Worker:        mycadence
public URL:               https://mycadence.ngohch-3d6.workers.dev
Supabase display label:   cadence-beta (operator-facing only)
Supabase project ref:     pwmhasbmacmeerbsagda (machine authority)
controlled Project:       3503f8c7-1996-44d1-8b63-1fca36db89f8
```

`cadence-beta` and `mycadence` are separate concepts. The former identifies
the governed Beta environment/safe target; the latter identifies the
reviewed Cloudflare Worker. `cadence-dev` and unrelated QA projects are not
Task 15 targets.

The canonical configuration proves only the intended/reviewed target. It does
not prove Cloudflare authentication, Worker existence, Cron state, secret
binding presence, deployed release, provider fingerprint, hosted health, or
hosted API behavior. Those facts require later host-operated read-only
inspection and safe runtime verification.

## Beta release identity prerequisite

Before the governed Beta setup-check or deployment-plan command, establish
one release identity for the exact source being planned. Release identity is
metadata, not a credential, and is supplied only to the current operator
process (or by an approved CI orchestration):

```text
CADENCE_RELEASE_VERSION = beta-YYYY.MM.DD.N
CADENCE_COMMIT_SHA      = full lowercase 40-hex Git SHA
CADENCE_BUILD_ID        = manual-YYYYMMDDTHHMMSSZ-<12-char-commit-prefix>
```

`CADENCE_RELEASE_VERSION` identifies a governed Beta release candidate. `N`
starts at `1` for the UTC release-candidate date and increments for each
distinct governed candidate on that date. The first governed Beta candidate
on 2026-09-12 is `beta-2026.09.12.1`. Do not derive this value from
`package.json` (`1.0.0` is not a product release identity), use the CI-only
`0.0.0-ci` fixture, or substitute `VS005` or another vertical-slice name.
Before use, search the governed release evidence for that exact version; if
it is already associated with a different source commit, stop and obtain a
new approved release version.

`CADENCE_COMMIT_SHA` identifies the exact source state and must equal the
full SHA of the current Git `HEAD`; never shorten or substitute it.
`CADENCE_BUILD_ID` identifies this individual manually governed planning/build
execution. Its timestamp is UTC and must be generated at preparation time;
do not reuse a prior build ID. Future CI executions may use the separately
defined `ci-<provider>-<immutable-run-id>` pattern, but that convention is
not established by this runbook for manual preparation.

Set and validate the values in the current PowerShell process only. For the
first governed Beta candidate, after confirming the release-version search is
clear and confirming `git rev-parse HEAD`, use:

```powershell
$env:CADENCE_RELEASE_VERSION = "beta-2026.09.12.1"
$env:CADENCE_COMMIT_SHA = (git rev-parse HEAD).Trim().ToLowerInvariant()
$env:CADENCE_BUILD_ID = "manual-$((Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ'))-$($env:CADENCE_COMMIT_SHA.Substring(0,12))"

if ($env:CADENCE_COMMIT_SHA -notmatch '^[0-9a-f]{40}$') { throw "Invalid release commit SHA" }
if ($env:CADENCE_COMMIT_SHA -ne (git rev-parse HEAD).Trim().ToLowerInvariant()) { throw "Release SHA is not current HEAD" }
if ($env:CADENCE_RELEASE_VERSION -notmatch '^beta-\d{4}\.\d{2}\.\d{2}\.\d+$') { throw "Invalid Beta release version" }
if ($env:CADENCE_BUILD_ID -notmatch '^manual-\d{8}T\d{6}Z-[0-9a-f]{12}$') { throw "Invalid manual build ID" }
```

Use the governed command only after these checks:

```powershell
npm run cadence:deploy:plan -- `
  --config config/cadence.runtime.beta.json `
  --out .cadence/vs005/deployment-plan.json
```

Never use `setx`, persistent user or machine environment changes, `.env`
files, or configuration edits for these values. Clear the three process-local
variables after the authorized planning/verification sequence. Once a release
is promoted or deployed, its identity remains auditable and is never silently
reassigned to another source commit.

## Before deployment

Run the local/CI quality gate first:

```powershell
npm run quality
```

Authenticate Wrangler to the explicitly intended Cloudflare account, then
confirm the account identity read-only:

```powershell
npx.cmd wrangler whoami
```

Record only the safe account identifier. Never record an API token, OAuth
credential, session credential, or any other authentication material. Never
paste Cloudflare API tokens or Supabase keys into command arguments, canonical
JSON, chat, or Git.

The account check is only one provider observation. Before any hosted
mutation, the bounded read-only inspection must establish the applicable
account and Worker identity, Worker existence, relevant configuration and
bindings, Cron state, named `SUPABASE_SECRET_KEY` presence, current release,
and hostname/version facts. Unsupported or unavailable facts remain
`UNAVAILABLE` and fail closed; no provider command is inferred from this
runbook.

For first-deployment readiness, an absent Worker, absent Cron, absent named
secret, and absent prior rollback version can be valid only when the reviewed
mutation plan explicitly represents the corresponding creation/configuration.
An existing Worker requires its configuration, Cron, secret-name, and current
release observations. Rollback readiness is stricter: it requires current
release identity, explicit retained prior version A, target identity,
rollback availability, and applicable release/configuration fingerprints.

## Secret handling

If the Worker already has the `SUPABASE_SECRET_KEY` secret, leave it in
Cloudflare secret storage. A normal deployment preserves the remote secret and
does not re-upload a local value merely because one is available.

For a first deployment where the remote secret is absent, make
`SUPABASE_SECRET_KEY` available only through the current operator process or an
approved CI secret source. `cadence:deploy:apply` transports it through the
Task 12 temporary `--secrets-file` path; that file is owner-only where
supported and is deleted in a `finally` path.

For interactive PowerShell, enter it without command-history echoing:

```powershell
$secureSupabaseKey = `
  Read-Host "Supabase secret key" `
    -AsSecureString

$env:SUPABASE_SECRET_KEY = `
  [System.Net.NetworkCredential]::new(
    "",
    $secureSupabaseKey
  ).Password

# run setup / plan / apply / verify

Remove-Item `
  Env:SUPABASE_SECRET_KEY `
  -ErrorAction SilentlyContinue

$secureSupabaseKey = $null
```

Plaintext exists only in the current process memory/environment and the
short-lived Task 12 transport file. Do not echo it, put it in command history,
persist it, or commit it. Clear the process value after deployment and
verification.

## Governed deployment sequence

The operator supplies the reviewed canonical target path explicitly:

```powershell
npm run cadence:setup:check -- `
  --config config/cadence.runtime.beta.json `
  --out .cadence/vs005/setup-readiness.json

npm run cadence:deploy:plan -- `
  --config config/cadence.runtime.beta.json `
  --out .cadence/vs005/deployment-plan.json

# review .cadence/vs005/deployment-plan.json
# and the console summary before apply

npm run cadence:deploy:apply -- `
  --plan .cadence/vs005/deployment-plan.json `
  --config config/cadence.runtime.beta.json `
  --out .cadence/vs005/deployment-result.json

npm run cadence:deploy:verify -- `
  --deployment .cadence/vs005/deployment-result.json `
  --config config/cadence.runtime.beta.json `
  --out .cadence/vs005/deployment-verification.json
```

Task 14 documents this sequence; it does not execute it against a real
target. The plan must be reviewed before apply. A changed configuration or
release invalidates an old plan, and any configuration or target mismatch
fails closed.

## Optional application rollback

For an explicitly authorized application rollback, retain the prior deployment
result as explicit version A evidence and run:

```powershell
npm run cadence:rollback -- `
  --current-deployment .cadence/vs005/deployment-result.json `
  --target-deployment .cadence/vs005/previous-deployment-result.json `
  --config config/cadence.runtime.beta.json `
  --out .cadence/vs005/rollback-verification.json
```

Rollback targets one explicit prior provider version, requires the same
current canonical configuration, requires full current provider observation,
and requires post-rollback verification. It is application rollback only:

```text
Database action: NONE
Database reset: NO
Migration reversal: NO
```

Application rollback does not restore database data. VS006 owns
backup/restore/support/recovery proof.

## Consequences and stop rules

- No command in the VS005 deploy path resets the database.
- VS005 deploy does not run database migrations.
- Secret values live in provider/local secret storage, not canonical JSON.
- Deployment PASS does not authorize M1 Pilot Activation.
- Deployment readiness, deployment success, and Pilot Activation are separate concepts.
- Task 9 local readiness evidence is not hosted evidence and does not authorize
  provider inspection or remote mutation.
- A provider or health result alone is not deployment verification.
- Do not continue after a stale plan, target drift, release drift, secret drift,
  or failed verification; return to the reviewed plan boundary.

## Portability and ownership

The architecture is Cloudflare-first at the adapter boundary but provider
portable:

```text
canonical provider-neutral config
    -> generated web/provider artifacts
    -> Cloudflare runtime adapter
```

Cadence domain/application logic, Supabase persistence and authentication, the
authorization model, the event model, and persistent retry truth remain
provider-neutral. Enterprise reconstruction must not require the original
developer's personal Cloudflare or Supabase credentials. Account transfer from
the developer is not the portability mechanism; clean reconstruction under
owner-controlled infrastructure is.

## Controlled-pilot boundary

The M1 controlled-pilot assumptions are:

- 5–10 named internal users;
- business/API routes retain their existing authentication and authorization
  boundaries;
- JSON request bodies are hard-capped at 1 MiB;
- worker rounds, delivery attempts, membership-expiry attempts, and execution
  time are hard-bounded;
- persistent retry is delayed and hard-bounded;
- each worker invocation emits one bounded structured summary rather than a
  raw payload/error log stream.

VS005 introduces no Cloudflare-specific stateful rate-limit store. If anonymous
or public business traffic, or materially larger usage, is introduced, that
requires a separate rate/abuse-control design rather than silently extending
the controlled-pilot assumption.

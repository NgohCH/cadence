# VS005 Deployment Runbook

The operator must first prepare ONE reviewed real-target configuration from
`config/cadence.runtime.example.json`, replacing only values approved from
non-secret environment facts. No script may guess the public URL, Supabase
URL or project reference, pilot project ID, or safe target marker. A real
target configuration exists only after those facts are reviewed. Task 14 does
not create `config/cadence.runtime.beta.json`.

This runbook documents the governed operator path. It is not authorization to
perform a hosted deployment during this checkpoint.

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
result and run:

```powershell
npm run cadence:rollback -- `
  --current-deployment .cadence/vs005/deployment-result.json `
  --target-deployment .cadence/vs005/previous-deployment-result.json `
  --config config/cadence.runtime.beta.json `
  --out .cadence/vs005/rollback-verification.json
```

Rollback targets one explicit prior provider version, requires the same
current canonical configuration, and requires post-rollback verification. It
is application rollback only:

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

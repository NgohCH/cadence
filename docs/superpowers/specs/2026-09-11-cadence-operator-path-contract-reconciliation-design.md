# Cadence Operator Path Contract Reconciliation

**Status: APPROVED DESIGN — IMPLEMENTATION NOT STARTED**

## Context and problem

Cadence management commands are exposed from the repository root through
nested npm scripts. The root script is transport only: it invokes the API
package, whose Node process runs under the API package execution context. A
relative operator path can therefore be interpreted against npm/package or
shell state instead of the repository namespace the operator intended.

This ambiguity was observed during T15-B. The governed plan entrypoint ran the
current TypeScript source, but relative configuration and output arguments were
resolved from the nested API context. The resulting `.cadence` artifact could
land under `apps/api/.cadence` while the canonical evidence artifact is under
`<repository>/.cadence`; a prior root artifact could consequently remain
stale. The same class of ambiguity can affect setup, apply, verify, and
rollback management commands.

T15-B remains **BLOCKED**. T15-C is **NOT AUTHORIZED**. This design does not
re-observe or repair provider state.

## Goals

- Make the Cadence repository root the sole namespace for relative filesystem
  paths supplied to root-exposed `cadence:*` management CLIs.
- Preserve absolute paths exactly as absolute paths.
- Normalize operator paths immediately after argument parsing, before passing
  them to application or domain APIs.
- Use one shared resolver owned by CLI/tooling code.
- Keep canonical evidence under `<repository>/.cadence/`.
- Fail closed when the repository root cannot be established.
- Make behavior deterministic across Windows, POSIX, npm, shell, and direct
  invocation contexts.
- Keep programmatic application/domain APIs independent of operator path
  semantics.

## Non-goals

This design does not address the Cloudflare `CURRENT_DEPLOYMENT=UNAVAILABLE`
finding, Cloudflare permissions, account/Worker/origin selection, Supabase,
database or schema work, deployment authorization, rollback authority,
ProjectAuthorisationService, VS002/R03 invariants, Pilot Activation, T15-C,
or unrelated historical CLIs. It does not authorize provider requests,
database operations, deployment, mutation, clean-room work, or hosted Cadence
calls. It does not silently migrate, delete, or rewrite historical evidence.

## Architecture and ownership

The CLI/tooling boundary owns a small shared operator-path resolver. It accepts
the parsed operator path, the established Cadence repository root, and the
path's semantic kind (configuration, plan, deployment evidence, or canonical
output). It returns a normalized absolute path or a bounded failure. It does
not read provider state, load configuration contents, create directories, or
change process state.

The repository root is established by the CLI entry boundary using the
repository layout and the entrypoint's known location. If that identity cannot
be proven, resolution fails closed. `process.cwd()`, `INIT_CWD`, npm lifecycle
cwd, package cwd, and shell cwd are observations only; none is an authority.
The resolver never calls `process.chdir()`.

The downstream deploy-plan, deploy-apply, deploy-verify, rollback, and setup
APIs receive already-resolved paths. Those APIs remain usable programmatically
with caller-supplied paths and do not acquire operator-specific cwd behavior.
Root package scripts remain execution transport only and do not implement path
policy.

## Operator-path interface

The shared boundary has this semantic contract:

```text
resolveOperatorPath({ repositoryRoot, inputPath, kind })
  -> absolute normalized path
  -> bounded path-resolution failure
```

`repositoryRoot` must be an absolute directory proven to be the Cadence
repository root. `inputPath` must be a non-empty filesystem path. A relative
`inputPath` is resolved against `repositoryRoot`; an absolute `inputPath`
remains anchored to its absolute location and is normalized only for ordinary
dot-segment and separator semantics. The resolver rejects malformed path
values and refuses to manufacture a root from cwd or environment hints.

The resolver does not accept a command string, shell expression, URL, provider
response, or arbitrary executable path. It returns path data only.

## Path flow

1. A root-exposed management CLI parses its arguments.
2. The CLI establishes the Cadence repository root or fails closed.
3. Every operator filesystem argument is normalized immediately through the
   shared resolver.
4. The CLI passes only resolved paths to the existing application/tooling
   entrypoint.
5. The entrypoint performs its existing local validation and, where already
   authorized by that command, its existing operation.
6. Relative evidence paths therefore always resolve beneath the repository
   root, including `.cadence/vs005/...`.

For the initial migration boundary, the path-bearing arguments are:

| Root-exposed command | Operator paths |
|---|---|
| `cadence:setup:check` | `--config`, `--out` |
| `cadence:deploy:plan` | `--config`, `--out` |
| `cadence:deploy:apply` | `--plan`, `--config`, `--out` |
| `cadence:deploy:verify` | `--deployment`, `--config`, `--out` |
| `cadence:rollback` | `--current-deployment`, `--target-deployment`, `--config`, `--out` |

The permanent convention is that any new root-exposed `cadence:*` command with
operator filesystem paths uses this same boundary. Unrelated historical CLIs
are not retrofitted by this design.

## Error handling and compatibility

The resolver fails closed with a stable bounded error category when the root
cannot be established, the input is empty or malformed, or normalization
cannot produce a safe absolute path. It does not fall back to cwd, `INIT_CWD`,
npm prefix, shell cwd, another checkout, or `apps/api/.cadence`.

Existing absolute operator paths remain compatible. Existing relative paths keep
their intended meaning when invoked from the repository root and become
deterministic when invoked from another cwd. The normalization boundary is
applied once; downstream layers must not reinterpret the original relative
string.

No `process.chdir()` is introduced. No package script is granted path
authority. Programmatic callers that already provide absolute paths retain
their existing behavior, and their APIs do not inspect operator cwd metadata.

## Evidence treatment

`<repository>/.cadence/` is the canonical evidence root. New command output
must be resolved there when the operator supplies a relative evidence path.
`apps/api/.cadence` is non-canonical diagnostic residue. It must not become an
authoritative evidence source merely because npm execution occurs under
`apps/api`.

Historical evidence is immutable for this reconciliation. The resolver must
not silently migrate, delete, overwrite, or relabel historical artifacts.
When an old non-canonical artifact is encountered, the command reports a
bounded path/setup failure or treats it according to its existing explicit
historical-evidence contract; it does not promote it to canonical evidence.

## Testing design

Tests must exercise the resolver and each CLI boundary without provider or
database access. The matrix must prove:

- repository-root, `apps/api`, and unrelated cwd inputs resolve the same
  relative path identically;
- Windows and POSIX relative and absolute paths are handled deterministically;
- spaces and dot segments normalize correctly;
- failure to establish repository identity fails closed;
- cwd, `INIT_CWD`, npm/package cwd, and shell cwd have no authority;
- no code path calls `process.chdir()`;
- no authoritative evidence path is `apps/api/.cadence`;
- programmatic APIs remain independent of operator semantics;
- each of the five commands normalizes every listed path immediately after
  parsing and passes resolved paths downstream;
- absolute paths remain absolute and are not rebased;
- malformed, empty, traversal-sensitive, and ambiguous root inputs fail
  closed without creating output.

Tests should inspect argv/path values and bounded outcomes, not depend on a
real provider, database, shell, global executable, or network. Existing
provider and deployment safety tests remain authoritative for their own
boundaries.

## Security and governance

The resolver handles filesystem path metadata only; it does not handle tokens,
secret values, provider bodies, headers, or database credentials. It does not
introduce shell execution, command-string construction, network access, or
mutation capability. Canonical target, provider-origin, GET-only transport,
deployment gates, rollback rules, and database action rules remain unchanged.

This reconciliation advances existing deployment/tooling traceability and
reproducibility obligations without changing their intended outcome. The
governance baseline remains 44 parent commitments and 178 child traceability
records. Removed commitments: 0. No commitment is moved beyond M3.

## Implementation sequence

1. Add the shared resolver in the existing CLI/tooling boundary.
2. Add resolver unit and contract tests for the path matrix and failure cases.
3. Normalize arguments in `cadence:setup:check` and `cadence:deploy:plan`.
4. Normalize arguments in `cadence:deploy:apply`, `cadence:deploy:verify`,
   and `cadence:rollback`.
5. Add command-level assertions that downstream APIs receive resolved paths.
6. Verify canonical evidence behavior and historical-artifact preservation.
7. Run the relevant local suites and repository quality gates.
8. Reconcile handoff and traceability evidence under the applicable change
   control; do not perform provider or database work as part of this design.

## Acceptance criteria

The implementation may be considered compliant only when:

1. All five initial commands use the same shared operator-path resolver.
2. Every listed path is normalized immediately after argument parsing.
3. Relative inputs resolve from the proven repository root regardless of cwd,
   npm lifecycle state, `INIT_CWD`, or shell state.
4. Absolute inputs remain absolute.
5. Root-establishment failure blocks execution without fallback.
6. No implementation calls `process.chdir()` or treats `apps/api/.cadence`
   as canonical evidence.
7. Downstream programmatic APIs receive resolved paths and remain independent
   of operator cwd semantics.
8. Tests cover the complete Windows/POSIX, cwd, spacing, dot-segment,
   malformed-input, root-failure, and historical-evidence matrix.
9. No provider, database, deployment, hosted Cadence, rollback, clean-room,
   or Pilot Activation action is introduced by this contract.
10. T15-B remains explicitly BLOCKED until a separately authorized read-only
    provider reinspection passes; T15-C remains NOT AUTHORIZED.


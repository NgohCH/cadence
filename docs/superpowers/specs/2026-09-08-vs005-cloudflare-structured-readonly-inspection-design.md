# VS005 Cloudflare Structured Read-Only Inspection Design

**Status:** Amended design freeze for review

**Date:** 2026-09-08

**Branch:** `feature/vs-005-portable-deployment-runtime`

**Initial design checkpoint:** `d9cd51d` (`docs(vs005): design structured Cloudflare inspection`)

**First design amendment:** `8321b78` (`docs(vs005): refine structured Cloudflare inspection`)

## 1. Purpose and blocker

T15-A requires Cadence to distinguish a Worker that is proven absent from a Worker whose state could not be inspected. The current Wrangler CLI boundary cannot preserve that distinction safely. Wrangler retains Cloudflare error codes internally, but turns provider failures into human-formatted stderr and a generic non-zero process result. Cadence therefore cannot use Wrangler output to map an exact Worker-not-found response to `OBSERVED_ABSENT` without unsafe prose matching.

This design introduces a narrow, structured, read-only Cloudflare REST boundary. It preserves the provider response envelope long enough to validate the request target and classify approved error codes, then immediately reduces the response to the existing bounded VS005 provider observations.

The design does not weaken `OBSERVED_VALUE`, `OBSERVED_ABSENT`, or `UNAVAILABLE`. Uncertainty remains `UNAVAILABLE` and blocks every phase that requires the fact.

## 2. Scope and non-scope

In scope:

- structured HTTPS `GET` inspection of the Cloudflare account and exact Worker named by canonical Cadence configuration;
- bounded observations required by first-deployment, apply, verification, and rollback-readiness profiles;
- strict response allowlisting and structured provider-error classification;
- a credential-provider abstraction whose only responsibility is supplying credential material;
- integration of the structured adapter behind the existing `inspectReadOnly` boundary;
- offline, injected fixture testing of all transport and parser behavior.

Out of scope:

- live API-token creation or use during this design checkpoint;
- any live Cloudflare or Supabase request;
- deployment, rollback, Cron mutation, route mutation, binding mutation, or secret mutation;
- a generic Cloudflare API client;
- clean-room provisioning;
- database work;
- Pilot Activation;
- certificate or public-key pinning for M1.

`NEW PAID COMPONENT = NO`

`CERTIFICATE PINNING = DEFERRED`

`REMOTE OPERATION = NOT AUTHORIZED`

`REMOTE MUTATION = NOT AUTHORIZED`

`PILOT ACTIVATION = NOT AUTHORIZED`

## 3. Existing authority model

The three existing authority layers remain separate:

1. Canonical configuration states the intended target. It contains non-secret `cloudflare.accountId` and `cloudflare.workerName` values and produces the canonical configuration fingerprint.
2. An explicit target policy determines whether that intended target is authorized for a particular workflow. The Task 15 Beta policy owns the reviewed Beta tuple; generic provider code does not.
3. Provider observation records what a bounded external inspection actually established. It cannot rewrite configuration, choose an account, choose a Worker, or grant authorization.

For the reviewed Beta policy, the canonical values are account `3d6a31905ac44e9563a523f9c86cbb8d` and Worker `mycadence`. They are policy/configuration data, not constants in the generic Cloudflare adapter. `cadence-beta` remains the environment/safe-target concept and is never derived into the Worker name.

## 4. Transport trust model

The M1 transport uses built-in Node `fetch` and the fixed origin `https://api.cloudflare.com`, with Cloudflare API paths under `/client/v4`. Node and the operating system perform their normal certificate-chain and hostname validation. Cadence must not install a permissive TLS agent, disable certificate verification, or accept a caller-provided production origin.

The M1 trust assumption is explicit: the execution host, Node runtime, DNS configuration, and operating-system trust store are trusted infrastructure. Compromise of those components is outside this M1 control boundary.

The transport applies these fixed controls:

- HTTPS is mandatory and the hostname must be exactly `api.cloudflare.com`.
- Redirect handling is `manual`; every 3xx response becomes `UNAVAILABLE` and no credential is forwarded.
- The credential appears only in the `Authorization` header, never in a URL or query string.
- Target path segments are encoded independently.
- Requests have a 15-second timeout.
- A trustworthy `Content-Length` greater than 1 MiB is rejected before body consumption.
- Every non-rejected response body, including one with a trustworthy acceptable length, is consumed through a bounded reader. The reader aborts and rejects as soon as accumulated bytes exceed 1 MiB. JSON parsing begins only after a complete body has been read within the limit; unbounded `response.json()` is prohibited as the security boundary.
- No generic pagination machinery is part of M1. The deployable-versions operation uses the provider's fixed `deployable=true` query, which returns deployable versions without pagination. Every other required M1 operation is consumed as one bounded response; any indication that a result is incomplete becomes `UNAVAILABLE`.
- Raw request or response bodies are never logged.

## 5. Credential-provider abstraction

The provider boundary introduces a narrow `CloudflareCredentialProvider` contract. It supplies opaque credential material to the private read-only transport and nothing else. It cannot supply or override:

- account ID;
- Worker name;
- application environment;
- safe-target marker;
- project ID or Supabase ref;
- API origin or path;
- HTTP method.

The credential is consumed only while constructing the `Authorization: Bearer` header and is not returned in operation results, observations, errors, evidence, or logs. The abstraction prevents the transport from reading Wrangler's cached private authentication state.

`CLOUDFLARE_INSPECTION_API_TOKEN` is available only to the structured read-only inspection path. It is not a general process credential. Every deployment or mutation child process, including Wrangler, must be launched with that variable explicitly omitted from its child environment even when the parent Node process inherited it. Child-environment construction must remove the inspection token before spawn rather than relying on incidental shell or host behavior. This firewall does not change Wrangler's separately governed deployment-authentication design.

## 6. M1 credential source

The initial M1 implementation uses an explicitly supplied runtime environment credential named `CLOUDFLARE_INSPECTION_API_TOKEN`. This name identifies an external secret source; no value belongs in canonical JSON, generated Wrangler configuration, a deployment plan, a readiness artifact, or source control.

Missing, blank, malformed, or inaccessible credential material yields a bounded authentication-unavailable result before transport. The environment credential provider does not inspect unrelated environment variables and never emits an environment dump.

Wrangler deployment credentials remain separate. Supplying an inspection credential does not authorize or equip the REST adapter to mutate Cloudflare resources.

## 7. Least-privilege provider permissions strategy

The M1 inspection token uses the Cloudflare API-token permission group `Workers Scripts Read`, scoped to the exact owner-controlled account used by the separately authorized target policy. It must not deliberately include `Workers Scripts Write`, account administration, DNS edit, token management, or any other mutation permission.

Installed Wrangler 4.127.1 source confirms that the required resources are under the account-scoped Workers Scripts API family. The bundled Wrangler OAuth path requests a write-capable Workers scope, so Wrangler authentication is not reused as the read-only inspection credential.

Before a later host call is authorized, token issuance evidence must show the literal `Workers Scripts Read` permission and the exact account resource scope. If any required operation is rejected under that permission, Cadence reports the fact as `UNAVAILABLE` and returns for governance review. It must not silently add a write permission or reuse a mutation credential.

## 8. Fixed endpoint and redirect policy

Production code has no API-base parameter. The origin is a module-owned constant and named operations select from fixed path templates. A caller supplies only validated canonical target fields and, where required, a previously observed provider identifier such as a version ID.

The transport rejects:

- a non-HTTPS URL;
- a hostname other than `api.cloudflare.com`;
- credentials in URLs or query parameters;
- absolute paths supplied by a caller;
- any redirect;
- any request whose canonical account/Worker binding cannot be established.

Tests may inject a fake fetch function, not a different production API origin. This keeps tests offline without creating an operational escape hatch.

## 9. Named GET-only provider interface

The provider-facing interface is `CloudflareStructuredReadOnlyProvider`. It exposes only named operations:

- `inspectCurrentDeployment(target)`;
- `inspectWorkerSettings(target)`;
- `inspectCronSchedules(target)`;
- `inspectDeployableVersions(target)`;
- `inspectVersion(target, versionId)`;
- `inspectWorkersDevState(target)`;
- `inspectAccountWorkersDevSubdomain(target)`.

There is no public `request(method, url)` function. The private `CloudflareReadOnlyTransport` accepts an internal route descriptor whose method is not caller-configurable. It always sends the literal method `GET` and rejects any internal descriptor that is not classified read-only before invoking `fetch`.

The operation set cannot express `POST`, `PUT`, `PATCH`, or `DELETE`. It cannot express deploy, upload, rollback, secret update, trigger update, route update, or configuration update.

## 10. Canonical target binding

The reusable target is `CloudflareWorkerInspectionTarget`, produced from already validated canonical configuration. It contains:

- `accountId` from `cloudflare.accountId`;
- `workerName` from `cloudflare.workerName`;
- the canonical configuration fingerprint;
- the governed generated-config identity needed to confirm that generated `account_id` and `name` equal the canonical values.

Every Worker-scoped route embeds the exact encoded `accountId` and `workerName`. Before transport, the adapter requires:

`canonical accountId == generated account_id == request accountId`

and:

`canonical workerName == generated name == request workerName`.

A mismatch becomes `UNAVAILABLE`; the adapter does not substitute, normalize to a different target, choose an account from credential metadata, or infer a Worker from environment or safe marker.

The account-subdomain operation also accepts the complete validated target rather than a standalone account ID. It derives the account route from that target while retaining Worker and fingerprint correlation in its result envelope. Business or deployment code therefore cannot use this operation to inspect an arbitrary account detached from the governed target.

## 11. Structured error mapping

The parser accepts only a structurally valid Cloudflare envelope. A successful response must contain `success: true` and a result matching the named operation's allowlisted schema. A failed response must contain `success: false` and a bounded `errors` array with numeric codes.

The internal `CloudflareInspectionFailureKind` classification is limited to:

- `WORKER_NOT_FOUND`;
- `AUTHENTICATION_FAILED`;
- `AUTHORIZATION_FAILED`;
- `NETWORK_UNAVAILABLE`;
- `TLS_UNAVAILABLE`;
- `TIMEOUT`;
- `MALFORMED_RESPONSE`;
- `UNEXPECTED_PROVIDER_ERROR`;
- `TARGET_BINDING_MISMATCH`.

Only the classification and operation name may reach a bounded diagnostic. Raw provider messages, response bodies, headers, and exception text are discarded. HTTP 401 maps to authentication unavailable; HTTP 403 maps to authorization unavailable. Network, TLS, timeout, malformed JSON, malformed envelopes, unexpected status codes, and unexpected provider codes all map required facts to `UNAVAILABLE`.

## 12. Worker-not-found rules

Worker absence is authoritative only from the exact `inspectCurrentDeployment` request bound to the canonical account and Worker. Installed Wrangler 4.127.1 source defines Worker-not-found codes `10007` and `10090` and uses them for account-scoped Worker-script API failures. Those two codes are approved only when all of these conditions hold:

1. the request used the fixed Cloudflare API origin;
2. the request path contains the validated canonical account and Worker;
3. no redirect occurred;
4. a parseable Cloudflare envelope with `success: false` was received;
5. the structured `errors` array is non-empty;
6. every entry is well formed and every numeric error code belongs to the exact allowlist `{10007, 10090}`;
7. the response is correlated to the in-flight current-deployment operation.

Only then does Worker existence become `OBSERVED_ABSENT`. A mixed array, any additional or unknown code, a malformed entry, authentication or permission failure, or any transport ambiguity becomes `UNAVAILABLE`. Prose matching, stderr parsing, generic HTTP 404, a generic non-2xx response, empty output, an empty body, or an empty deployments list cannot prove absence.

A successful deployments response with an empty deployment list proves that the Worker-scoped endpoint was reached but does not prove a current release. Worker existence may be `OBSERVED_VALUE(true)` while `currentRelease` is `OBSERVED_ABSENT`; the applicable readiness profile then decides whether that state is acceptable.

## 13. Response allowlisting

Raw Cloudflare JSON exists only inside the operation parser. Each operation validates the envelope and extracts a dedicated bounded result. The following are discarded even when present:

- author names and email addresses;
- free-form annotations and messages;
- unrelated metadata and timestamps;
- raw binding values outside the explicit identity allowlist;
- plaintext variable values outside the explicit identity allowlist;
- authentication metadata;
- response headers and request identifiers not required for correlation;
- arbitrary nested provider fields.

Provider observations contain only account/Worker correlation, identifiers, binding names/types, schedule expressions, secret names, hostname state, and the release/config fields required by the existing Cadence contracts. The only existing plaintext identity bindings whose values may survive settings parsing are:

- `CADENCE_CONFIG_FINGERPRINT`;
- `CADENCE_RELEASE_VERSION`;
- `CADENCE_COMMIT_SHA`;
- `CADENCE_BUILD_ID`.

Each value is retained only when its binding name and Cloudflare `plain_text` type match and the value passes the existing bounded Cadence identity validation. `CADENCE_RUNTIME_CONFIG_JSON` is not required as raw provider evidence: only its binding name and type may survive. Its value is always discarded. Every other plaintext value and every secret value is discarded. A parser that encounters a missing required field, duplicate allowlisted identity binding, wrong type, invalid identity value, oversized collection, or unsupported shape returns `UNAVAILABLE` for the affected fact.

## 14. Secret presence from Worker settings

M1 has no dedicated secret-list operation and does not call the Cloudflare `/secrets` endpoint. `inspectWorkerSettings` derives required secret presence from the complete successful Worker settings binding set.

`SUPABASE_SECRET_KEY` is present only when exactly one binding has that exact name and the current Cloudflare binding type is exactly `secret_text`. A complete successful settings response with no such binding produces `OBSERVED_ABSENT` for the existing `secretNames` observation. The expected name with any other type, duplicate entries, an incomplete binding set, or malformed settings produces a bounded mismatch or `UNAVAILABLE` according to the existing observation conventions; it never becomes present.

The settings parser retains only the expected secret name and type-derived presence state. It never retains a secret value and exposes no operation capable of creating, updating, deleting, listing through a separate secret surface, or retrieving secret material. Unexpected plaintext or secret-looking fixture data must be absent from snapshots, serialized evidence, diagnostics, and captured test logs.

## 15. Required provider operations and endpoints

The fixed M1 operation-to-endpoint mapping is:

| Named operation | Fixed `GET` path under `https://api.cloudflare.com/client/v4` | Bounded purpose |
|---|---|---|
| `inspectCurrentDeployment` | `/accounts/{accountId}/workers/scripts/{workerName}/deployments` | Worker existence plus current deployment and active version IDs |
| `inspectWorkerSettings` | `/accounts/{accountId}/workers/scripts/{workerName}/settings` | Binding names/types, required secret-name/type presence, and allowlisted release/config identity values |
| `inspectCronSchedules` | `/accounts/{accountId}/workers/scripts/{workerName}/schedules` | Cron expressions and explicit empty state |
| `inspectDeployableVersions` | `/accounts/{accountId}/workers/scripts/{workerName}/versions?deployable=true` | Complete bounded deployable version IDs for rollback readiness; the provider ignores pagination for this query |
| `inspectVersion` | `/accounts/{accountId}/workers/scripts/{workerName}/versions/{versionId}` | Bounded identity/fingerprint metadata for one explicitly selected version |
| `inspectWorkersDevState` | `/accounts/{accountId}/workers/scripts/{workerName}/subdomain` | Script workers.dev enabled/state facts |
| `inspectAccountWorkersDevSubdomain` | `/accounts/{accountId}/workers/subdomain` | Account workers.dev subdomain label derived from and correlated with the complete validated target |

Installed Wrangler 4.127.1 source uses these account-scoped endpoints and treats deployments-list result index zero as the latest deployment actively serving traffic. Cadence will preserve only deployment `id` and bounded `versions[].version_id`/traffic allocation fields required by the existing release identity contract. It will not infer a rollback target from list order. No required M1 endpoint needs reusable multi-page traversal.

## 16. Observation mapping for each operation

| Operation | `OBSERVED_VALUE` | `OBSERVED_ABSENT` | `UNAVAILABLE` |
|---|---|---|---|
| Current deployment | Exact Worker request succeeds; Worker is present and bounded deployment/version identity is parsed | Worker only when approved structured code `10007`/`10090` is correlated; current release may be absent on a successful empty list | Auth, permission, network, TLS, timeout, malformed/unknown response, binding mismatch |
| Worker settings/config | Required binding names/types and allowlisted identity values parse from a complete successful result | Explicitly empty allowlisted non-secret binding set where the phase permits it | Required field missing, duplicate/wrongly typed identity, unsafe or malformed shape, any uncertain failure |
| Required secret presence from settings | Exactly one `SUPABASE_SECRET_KEY` binding has type `secret_text` | Complete successful settings contains no binding with that name | Expected name has wrong/duplicate type, settings is incomplete, or inspection fails |
| Cron schedules | Bounded schedule list parses | Successful exact response contains an empty list | Any failed or ambiguous inspection |
| Deployable versions | The fixed `deployable=true` result parses and includes the required retained version | The complete bounded result contains no eligible version only where the rollback profile defines absence | Oversized, incomplete, malformed, or failed result |
| Version detail | Exact requested version identity/fingerprint parses | Not emitted in M1; absence is established from the complete deployable-versions list | Unapproved code, missing listed version detail, malformed result, or failed request |
| Worker workers.dev state | A successful response reports `enabled: true` and hostname correlation parses | A successful response reports `enabled: false` | Any failed, missing, or malformed state |
| Account subdomain | A successful response contains a bounded, non-empty account subdomain label | Not emitted in M1 | Empty/missing label or any failed/malformed inspection |

For every phase-required fact, `UNAVAILABLE` fails closed. `OBSERVED_ABSENT` never grants mutation authority; the reviewed plan must contain the exact corresponding mutation before absence can be an acceptable precondition.

## 17. Target and evidence correlation

The adapter reuses `fingerprintCadenceRuntimeConfig`; it does not introduce signing or a second configuration fingerprint. Each safe inspection result is wrapped in a bounded correlation envelope containing:

- canonical account ID;
- canonical Worker name;
- canonical configuration fingerprint;
- fixed provider origin identity (`api.cloudflare.com`);
- inspection profile and completed named-operation set;
- observation timestamp;
- the existing safe `Vs005ProviderObservationSnapshot`.

The deployment plan captures the intended target, canonical fingerprint, required profile, and safe snapshot. Apply reloads and revalidates configuration, reruns the explicit target policy, recomputes the fingerprint, and performs a fresh structured inspection. A different account, Worker, fingerprint, profile, operation set, or relevant provider observation fails before mutation.

This correlation detects accidental cross-target evidence reuse. It is not cryptographic attestation and does not claim protection against a compromised execution host.

## 18. Integration with `inspectReadOnly`

The current `inspectReadOnly` public seam remains the deployment subsystem's provider-observation entry point. Its default implementation is migrated from authoritative Wrangler inspection to orchestration of `CloudflareStructuredReadOnlyProvider` named operations.

The migration may retain Task 1 account-membership parsing as a non-authoritative parser utility, but the governed host `inspectReadOnly` path does not execute Wrangler `whoami`. Account observation comes from a successful, exact account-scoped REST operation or a correlated structured Worker-not-found response. Wrangler output cannot satisfy Worker-scoped observation or override a structured REST result. The direct REST route target comes from the Task 2 canonical account/Worker binding helper.

`inspectReadOnly` reduces operation results to the existing tri-state snapshot and then calls `validateVs005ObservationCompleteness` for the requested phase. It cannot replace missing provider facts with canonical config values. Unsupported or unproven fields remain `UNAVAILABLE`.

The default deployment planner has a separate local-readiness defect: it currently supplies constant `generatedConfigValid: false` and `webBuildReady: false`. The implementation plan must replace those constants with deterministic local checks. `generatedConfigValid` must use the existing `buildCloudflareDeployment` output and current generated-target validation to prove that account, Worker, fingerprint, release identity, assets, Cron, required secret declaration, and other generated fields match the canonical config and release. `webBuildReady` must use the existing `buildCadencePublicWebConfig`/Beta web-build path, prove the generated public config exactly matches the canonical browser-safe projection, require the local Beta build to succeed, and verify that the resulting `apps/web/dist/index.html` and every referenced local asset exist.

These checks run locally, make no provider or hosted HTTP call, and remain separate from `Vs005ProviderObservationSnapshot`. A provider observation cannot make either boolean true, and local generated/build evidence cannot become a provider observation.

## 19. Task 6 apply reinspection

Task 6 continues to require fresh inspection immediately before the injected Wrangler mutation boundary. The apply path obtains a new credential from the credential provider, reruns the structured named operations required by the plan profile, compares the bounded result with the reviewed plan snapshot, and rejects drift before any mutation attempt.

Manual command output, a prior host-inspection artifact, or a plan-time snapshot cannot substitute for this reinspection. If the credential is unavailable, the transport cannot prove the fixed origin, any required operation is unavailable, or a precondition changed, apply returns a bounded failure and `mutationAttempted` remains false.

The REST inspection credential and adapter do not perform the later mutation. Wrangler remains behind the separately reviewed mutation boundary and may execute only the reviewed mutation envelope after every Task 6 gate passes.

Immediately before the Wrangler mutation subprocess is created, apply constructs the bounded child environment and explicitly removes `CLOUDFLARE_INSPECTION_API_TOKEN`. The mutation subprocess must not receive the inspection token through inherited parent state. Failure to prove this omission fails before spawn and keeps `mutationAttempted` false; Wrangler's independently supplied deployment authentication remains unchanged.

## 20. Post-deploy verification

Post-deployment verification calls the same structured read-only boundary again. It requires Worker presence, the expected deployment/version, config/release correlation, required Cron state, required secret-name presence, workers.dev/public-hostname consistency, and all other facts required by the verification profile.

The verifier binds the new snapshot to the same reviewed plan, apply provenance, intended target, release identity, and canonical configuration fingerprint. Required `UNAVAILABLE` or unexpected `OBSERVED_ABSENT` fails verification. Verification never deploys, repairs, retargets, changes configuration, or activates the pilot.

## 21. Rollback-readiness implications

Rollback readiness requires more than two version IDs. `inspectDeployableVersions` proves that the explicitly retained prior version A remains provider-visible; `inspectVersion` proves its bounded identity/fingerprint metadata; and `inspectCurrentDeployment` proves the current deployed version and exact account/Worker context.

The governed rollback target still comes from the reviewed prior deployment result and plan history. The adapter confirms availability but never chooses a rollback target. A missing, unavailable, or mismatched version A fails rollback readiness. Rollback remains application-only: no database rollback, migration reversal, reset, repair, or destructive SQL is permitted.

## 22. Offline TDD and fixture strategy

Implementation uses strict red-green-refactor sequencing with an injected `fetch`-compatible function and an injected credential provider. No test invokes DNS, TLS, Cloudflare, Wrangler, Supabase, or a hosted Cadence endpoint.

Fixture coverage must include:

- exact successful envelopes for every named operation;
- structured Worker-not-found codes `10007` and `10090` on the exact Worker request;
- the same codes on an uncorrelated operation, which must remain `UNAVAILABLE`;
- 401, 403, generic 404, 429, 5xx, redirect, timeout, TLS/network failure, malformed JSON, malformed envelope, empty body, and oversized body;
- complete, empty, malformed, oversized, and provider-indicated incomplete collections;
- trustworthy oversized `Content-Length`, missing/untrusted length with bounded-reader overflow, and exact-limit body handling before JSON parsing;
- account/Worker/generated-config binding mismatches;
- non-Beta account and Worker targets;
- complete settings with the exact `SUPABASE_SECRET_KEY`/`secret_text` binding, missing binding, wrong type, duplicate binding, and secret-looking values;
- exact allowlisted identity values, wrong binding types, invalid bounded identity values, and proof that `CADENCE_RUNTIME_CONFIG_JSON` content is discarded;
- Task 3 first-deployment and rollback completeness profiles;
- Task 5 plan capture, Task 6 fresh reinspection, and Task 7 verification binding;
- local `generatedConfigValid` checks against existing generator output and local `webBuildReady` checks against a successful Beta build and referenced assets, with proof that neither calls the provider;
- an inherited parent `CLOUDFLARE_INSPECTION_API_TOKEN` with an injected mutation-process spawn, proving the child environment omits that variable while leaving the separately supplied Wrangler deployment-authentication mechanism unchanged;
- proof that every constructed operation is `GET` and every mutation verb/route is inexpressible.

## 23. Secret-leakage tests

Adversarial fixtures place credential-like strings in provider messages, annotations, binding values, account metadata, version metadata, response headers, exception messages, and unrelated JSON fields. Tests serialize all returned observations, bounded errors, deployment plans, apply/verify evidence, and captured logger output and prove those strings are absent.

Separate tests prove that:

- only the name `SUPABASE_SECRET_KEY` and its type-derived presence state can survive Worker settings secret inspection;
- the inspection bearer credential never appears in argv, URLs, query strings, snapshots, errors, or logs;
- an injected/spawned Wrangler mutation child never receives `CLOUDFLARE_INSPECTION_API_TOKEN`, including when its parent environment contains the variable;
- only `CADENCE_CONFIG_FINGERPRINT`, `CADENCE_RELEASE_VERSION`, `CADENCE_COMMIT_SHA`, and `CADENCE_BUILD_ID` plaintext values can survive after name/type/value validation;
- `CADENCE_RUNTIME_CONFIG_JSON` and every other plaintext Worker variable value are discarded;
- raw response bodies are inaccessible after the parser boundary;
- malformed responses fail without embedding their content in diagnostics.

## 24. Portability and non-Beta targets

The structured adapter contains no Beta account ID, Worker name, environment, safe marker, Supabase ref, or controlled Project ID. It accepts any structurally valid `CloudflareWorkerInspectionTarget` created under a separately authorized target policy.

The Beta tuple remains in the explicit Task 15 Beta policy. A future clean-room policy can reuse the same canonical configuration, credential abstraction, GET-only transport, response parsers, observations, and plan/apply/verify integration with a different owner-controlled account and Worker. Clean-room target selection and credentials require separate authorization.

## 25. Cost and dependency impact

The design uses built-in Node `fetch`, existing canonical fingerprinting, and existing provider-observation contracts. It adds no Cloudflare SDK, third-party HTTP client, proxy, gateway, hosted service, paid secret manager, certificate-pinning service, or other infrastructure.

The only operational input is an externally supplied, least-privilege Cloudflare inspection API token under the existing secret-handling model. Therefore `NEW PAID COMPONENT = NO`.

## 26. Deferred certificate-pinning decision

Certificate/public-key pinning is deferred for M1. The fixed HTTPS origin, normal Node/OS certificate validation, disabled redirect following, no origin override, and trusted-host assumption are the approved M1 controls.

Pinning would introduce certificate-rotation and availability risks plus an operational update mechanism that the current threat model does not justify. If the threat model later requires stronger transport attestation, governance must approve the trust material, rotation process, outage behavior, and evidence model before implementation. The current adapter must not contain dormant or optional pinning bypasses.

## 27. Database and governance firewalls

This design changes provider inspection only.

- `NEW MIGRATION = NO`
- `DATABASE RESET = NO`
- `DATABASE REPAIR = NO`
- `MIGRATION REVERSAL = NO`
- `DATABASE ROLLBACK = NO`
- `AD HOC DESTRUCTIVE SQL = NO`

No Supabase network operation is part of the adapter. Existing VS005 target-policy, plan-bound apply, observation-completeness, secret-boundary, and Pilot Activation controls remain authoritative. Original governed commitments are neither removed nor moved.

## 28. Migration path from current Wrangler inspection

Migration is incremental and fail closed:

1. Add the credential-provider and fixed-origin GET-only transport with offline tests.
2. Add named deployments inspection and structured Worker-not-found mapping.
3. Add settings parsing for binding names/types, secret presence, and the four allowlisted identity values; add Cron, deployable-version, exact-version, and workers.dev operations one bounded parser at a time.
4. Compose them behind the existing `inspectReadOnly` seam and preserve unsupported facts as `UNAVAILABLE` until their parser is complete.
5. Replace the default planner's constant local readiness values with deterministic generated-config and Beta web-build checks, kept outside provider observations.
6. Bind planner, apply, verify, and rollback readiness to the structured result and target-correlation envelope.
7. Remove Wrangler CLI output as authoritative provider evidence only after the full local regression gate proves parity. Wrangler remains the mutation mechanism.
8. Produce local readiness evidence identifying every host fact as unobserved until a separately authorized host read-only inspection occurs.

At no point may CLI prose, manual evidence, or canonical config be promoted into a provider observation.

## 29. Acceptance criteria

The design is satisfied when local tests and review prove all of the following:

- production transport can address only `https://api.cloudflare.com/client/v4` and only with `GET`;
- redirects, arbitrary origins, mutation verbs, and generic provider requests are impossible or rejected before transport;
- credentials come only from `CloudflareCredentialProvider` and cannot influence target identity;
- every request is correlated to canonical account, Worker, generated target, and canonical fingerprint;
- only a correlated `success: false` envelope with a non-empty error array whose every code belongs to `{10007, 10090}` can establish Worker absence;
- every uncertain condition becomes `UNAVAILABLE`;
- all required operations produce bounded observations without raw response retention;
- response bytes are bounded to 1 MiB before JSON parsing, including when no trustworthy acceptable `Content-Length` exists;
- `SUPABASE_SECRET_KEY` presence is derived only from an exact `secret_text` binding in complete Worker settings; no M1 secret-list operation exists;
- only the four existing allowlisted plaintext identity-binding values survive settings parsing, while `CADENCE_RUNTIME_CONFIG_JSON` content and all other plaintext values are discarded;
- deployable versions use the fixed `versions?deployable=true` operation and no generic M1 pagination machinery;
- plan/apply/verify/rollback consumers reuse the existing authority and fingerprint chain;
- Task 6 always performs fresh structured reinspection before mutation;
- every deployment or mutation child process, including Wrangler, is spawned with `CLOUDFLARE_INSPECTION_API_TOKEN` explicitly omitted from its environment without changing Wrangler's separate deployment authentication;
- the default planner computes `generatedConfigValid` and `webBuildReady` from real deterministic local checks rather than constants or provider observations;
- offline adversarial tests prove credential, secret, plaintext-variable, and raw-output non-leakage;
- generic non-Beta portability remains intact;
- no dependency, paid component, database action, remote operation, or mutation is introduced by the design checkpoint.

Host inspection remains separately authorized after implementation and local review. Hosted mutation remains a later, explicit authorization gate. Pilot Activation remains a separate later authorization.

## 30. Implementation decomposition

The subsequent implementation plan should use independently reviewable commits in this order:

1. Define credential-provider, fixed target-correlation, bounded failure, GET-only transport, and pre-parse 1 MiB bounded-reader contracts with offline transport tests.
2. Implement deployments inspection, strict all-errors Worker presence/absence classification, and current deployment/version parsing with structured-code tests.
3. Implement Worker settings parsing for binding names/types, `SUPABASE_SECRET_KEY` secret-type presence, and the four allowlisted plaintext identity values, with wrong-type and value-exclusion tests.
4. Implement Cron inspection with explicit empty/unavailable semantics.
5. Implement fixed `deployable=true` versions and exact-version inspection for rollback readiness without generic pagination or automatic rollback-target selection.
6. Implement target-bound Worker and account workers.dev state inspection and public-hostname correlation.
7. Compose all operations behind `inspectReadOnly`, preserve phase completeness, and remove Wrangler CLI output from authoritative observations.
8. Replace constant `generatedConfigValid` and `webBuildReady` planner inputs with the existing deterministic local generated-config and Beta web-build checks, without provider calls.
9. Integrate structured observations and correlation into planning and Task 6 fresh apply-time reinspection; at the mutation-spawn boundary, explicitly remove `CLOUDFLARE_INSPECTION_API_TOKEN` from every Wrangler/deployment child environment and prove the omission with an offline injected-spawn test.
10. Integrate post-deployment verification and rollback-readiness checks.
11. Run the complete local T15-A regression, security, governance, and readiness-evidence gate.

Each implementation task remains local/offline until a separate host-inspection authorization. No task in that implementation plan may perform a live provider request, provider mutation, Supabase operation, hosted verification, clean-room operation, or Pilot Activation.

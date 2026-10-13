# Cadence V1.0 — Frozen workload and execution plan v1.8.0

**Approved scope freeze:** 13 October 2026 (MYT)  
**Release decision date:** 17 November 2026 (live hosted product, not just code freeze)  
**Code freeze:** 10 November 2026  
**Source:** `CADENCE_V1_0_FROZEN_PACKET_REGISTER_v1_8_0.json` SHA-256 `1c6f415b36e90ca4d5320bfdc49f0abbdaec6beec70a576f3cbb68ae18f06080`  
**Status:** Frozen *scope*, **not** implemented or deployed; external sign-offs and required credentials are separate conditions.

## 1. Fixed numbers

| Population | Packets | Estimated recorded hours | Release treatment |
|---|---:|---:|---|
| Mandatory | 63 | 236 | Required before GO |
| Conditional audio | 4 | 12 | Default DEFERRED_BY_CAP, not on critical path |
| Post-release observation | 1 | 2 | Plus 10 whole working days; not a release-day deliverable |
| **Total register** | **68** | **250** | No automatic additions |

**Sponsor-risk classification:** 7 mandatory packets / 19 registered hours. These require human decisions and sometimes engineering preparation; they must not be represented as uninterrupted automated coding.

**Total hours before feature freeze (except formal GO and deployment only):** 231h. Remaining mandatory on 16–17 November: 5h plus non-compressible approval/deployment windows. These figures are estimates, not independently measured completed task duration. Each includes coding, targeted tests, PR and evidence but excludes external waits/rework.

## 2. Workstream allocation

| Workstream | Packets | Agent-hours |
|---|---:|---:|
| Foundation/dispatch | 8 | 30 |
| Runtime and hosting | 8 | 30 |
| AI and actions | 7 | 25 |
| Projects/members/Tasks | 12 | 43 |
| Decisions & transcript | 8 | 32 |
| Audio conditional | 4 | 12 |
| Integration/pilot/release | 12 | 39 |
| UI | 3 | 11 |
| SSO | 2 | 10 |
| Budget control | 1 | 5 |
| Transcript privacy | 1 | 4 |
| Operators | 1 | 4 |
| Overnight runner | 1 | 5 |


## 3. Dependency and staffing analysis

- Dependency register: **DAG verified**, 68 distinct IDs, zero unreferenced dependencies, zero cycle, and no change to original v1.8 packet scopes.
- **Theoretical longest connected chain to actual deployment:** 62 focused packet-hours (`CAD-WP-001 → CAD-WP-002 → CAD-WP-003 → CAD-WP-063 → CAD-WP-061 → CAD-WP-027 → CAD-WP-039 → CAD-WP-040 → CAD-WP-041 → CAD-WP-066 → CAD-WP-042 → CAD-WP-043 → CAD-WP-048 → CAD-WP-055 → CAD-WP-057 → CAD-WP-058`). This is a *lower bound*, not a credible delivery forecast. It excludes any non-compressible human pilot, human decision response time, real databases and provider wait times.
- **Mode A:** only one active coding packet. Prioritise WP001/002/003/004/005/006/007/068 and only hand off when the complete safety/acceptance gate is demonstrated. The 8 gating packets contain **31h** of estimated mixed preparation/engineering, with 3 consecutive accepted engineering packets additionally required. Do not prematurely count 2-lane capacity.
- **Mode B:** at most 2 concurrent *coding writers* on disjoint modules, 1 serial integrator, automated read-only review. A shared provider/consumer file or migration remains serial. Never count an unapproved second lane.
- **Primary business-calendar constraints:** M1 pilot has 5 entire working days; WP059 has 10 working days after release. GO/NO-GO, OAuth tenant setup, HELP legal licence, people and hosting cannot be completed simply by leaving the Windows laptop on.

### Sensitivity: overnight accepted throughput, not laptop uptime

Assumption to evaluate: 14 October–9 November inclusive = 27 **calendar days**. If (and only if) exactly 7 days use one writer and remaining 20 days use two, available capacity is 7+40 = **47 agent-calendar-days**. This does not deduct provider delays, user approval, network/CI stalls or rework.

| Real accepted hours per agent-calendar-day | Capacity through 9 Nov | Against 236 mandatory hours | Interpretation |
|---:|---:|---:|---|
| 4.0h | 188h | -48h | RED by capacity alone |
| 5.0h | 235h | -1h | RED, no meaningful contingency |
| 6.0h | 282h | +46h | Possible with minimal supplier/user waiting; not a promise |
| 7.0h | 329h | +93h | Healthier but must be demonstrated from accepted work |
| 8.0h | 376h | +140h | Stretch assumption, do not use as baseline |

A fairer *pre-freeze-only* comparison is **231h** required by 10 Nov, not 236h; the difference still does not make calendar-bound pilot or actual human GO automatically pass. Even the 6h scenario depends on a rapid switch to two verified lanes.

## 4. Non-expanding dispatch workflow

1. Read *only* the frozen canonical JSON and governance freeze digest. Do not discover/create new numbered packets.
2. Choose one dependency-accepted ready packet; reject stale issue, commit, repo, GitHub user, worktree path or frozen interface SHA.
3. Resolve absolute local Windows worktree; identify existing versus planned paths; run path and scope preflight **before writes**.
4. Execute exactly the packet's allowable changes, tests, compatibility checks, negative permission tests, database migrations on disposable target (if relevant) and review evidence.
5. Submit one scoped PR, independently verify exact commit SHA and integration against `main`; issue structured formal acceptance.
6. Only after acceptance close issue and unlock dependent packets. If failed, one bounded within-packet repair; then `BLOCKED` and sponsor escalation; no automatic new issues.
7. `CADENCE PAUSE` stops dispatch/merging/deploying and verifies remote checkpoint; `CADENCE RESUME` revalidates SHA, ID, secrets and dependencies. Laptop shutdown is safe only after `PAUSED — SAFE TO SHUT DOWN`.
8. Daily 24h progress reports include **accepted** packets, actual hours, queued blockers, remote checkpoint, source and budget identity, five-project UAT, remaining critical path, code-freeze and release runway; warn if RED.

## 5. Risk and oversight prevention

| Risk | Preapproved control | Assigned packets |
|---|---|---|
| Never-ending VS005 deployment investigations | Salvage only verified worker/config/API components, standard provider tooling, exactly one fallback | 002, 008–016 |
| Missing provider-to-consumer connector / renamed variables | Lock public API/event/type/schema in 003, run targeted compatibility checks on every affected PR, comprehensive 048 gate | 003, 017–043, 048 |
| Unintended dual-agent file conflicts | Single lane first; verified worktree leases, serial integrator; revert to one lane on collision | 004–006, 068 |
| Repeated acceptance and closure disputes | Machine-readable source-SHA-bound acceptance + automatic issue state, one remedial attempt | 001, 003, 048 |
| Unsupported SSO or hidden login dependency | HELP Entra tenant, OAuth callback and Person mapping checked early; Google configurable; no local passwords | 063, 064, 028, 029 |
| AI over-budget or wrong provider | Configurable `gpt-6-luna` medium with atomic $5 reserve, provider budget caps and manual paths | 017, 021, 032, 042, 065 |
| Transcript privacy vs Decision source traceability | No raw transcript durable state; minimal approved extracted source evidence, deletion proof even on failures | 036, 038, 041–043, 066 |
| Product looks like a test page | Approve one visual system early, reuse across screen packets, real browser/mobile acceptance | 060–062 |
| Finished code but no deployable product | Hosted HTTPS, same-day release SHA check, backups/isolated restore, operator ownership, real user end-to-end | 013–016, 049–059, 067 |
| Legal/IP or licensing oversight | Document intended owner, verify existing rights and executed HELP academic grant before live use | 001, 056, 057 |
| False date or hidden missed deadline | 10 Nov freeze; 16 Nov human GO; 17 Nov live proof; otherwise honest NO-GO, not a fictional release | 055–058 |

## 6. Dated owner / action gates (Asia/Kuala_Lumpur)

| Due | Gate | Owner type |
|---|---|---|
| 13 Oct | Scope freeze, hash, repo branch/PR as applicable | Sponsor / governance maintainer |
| 16 Oct | Confirm IP/licence path; Entra application contact; OpenAI project API key budget; isolated Supabase and hosting account; pilot user pool | Sponsor / HELP service administrators |
| 20 Oct | Demonstrate stable serial accepted packets + working PAUSE/RESUME; reforecast whether 2 lanes are viable | Developer / sponsor |
| 23 Oct | Prove hosting route, AI adapter, single visual system and early connector checks | Developer / sponsor |
| 28 Oct | Preferred safe M1 pilot activation | Sponsor / pilot operator |
| 2 Nov | Latest planned M1 pilot activation; five working days complete 10 Nov if 9 Nov observed holiday | Sponsor / pilot operator |
| 6 Nov | Five-project mandatory journey integrated; audio excluded unless there is clear positive capacity | Developer / test users |
| 10 Nov | Feature and UI freeze | Developer / sponsor |
| 11–13 Nov | SSO, privacy, budget, five-project real-user company UAT and restoration, UI visual quality | Pilot users / operator |
| 16 Nov | Exact-SHA licensing, security and product GO/NO-GO | Sponsor |
| 17 Nov | Verified Cadence V1.0 deployment and genuine About released date (or honest NO-GO) | Release operator / sponsor |
| Postrelease | Ten full working days of live usage, then WP059 acceptance | HELP users / sponsor |

## 7. Acceptance coverage matrix

| Obligation | Owning packets | Existing scope coverage |
|---|---|---|
| Governance, salvage and non-expansion | 001,002,003,007,008 | Approved register, main/VS005 pin, preserved baseline and traceability |
| Dispatch/remote pause/resume/overnight runner | 004,005,006,068 | Wrong repo/branch/account fails; remote checkpoint recovery; no unsanctioned work |
| API/hosting/worker/retries/configuration | 009,010,011,012,013,014,015,016 | HTTPS + scheduled supervised worker; no unsafe migrations/deployments |
| SSO identity and account revocation | 063,064,028,029,050 | Entra live and Google configurable; canonical Person/RBAC and reject unauthorised logins |
| AI adapter/Task action + US$5 cap | 017,018,019,020,021,022,023,065 | Luna medium; grounded output; manual Task fallback; org-wide atomic cost reservations |
| Organisation/projects and Task lifecycle | 024,025,026,027,028,029,030,031,032,033,034,035 | Five independent projects and 5-10 users; self-service manual Tasks and team access |
| Decisions from text/transcript/privacy | 036,037,038,039,040,041,042,043,066 | Propose, review and approve with evidence; no raw transcripts in durable storage/logs |
| UI/visual system | 060,061,062 | Elegant UI, project picker, Decisions, tasks, accessibility desktop and mobile |
| Operators, security, backups, real users | 049,050,051,052,053,054,055,067 | Configurable operators, RLS, restore, five working-day M1 pilot and V1 actual UAT |
| Connector CI, licensing, package and release | 003,048,056,057,058 | Contract verification from first connector, licence/IP gate, 16 Nov GO and 17 Nov live release |
| Audio (explicitly optional) | 044,045,046,047 | Automatic deferral if mandatory progress at risk; no hidden audio prerequisite |
| Post-release observation | 059 | Ten full working days; not misrepresented as complete on release day |

## 8. External gates that cannot be autonomously assumed completed

- HELP University written academic licence signed by authorised party and independent check of source ownership/employment obligations.
- HELP Entra tenant registration, approved OAuth redirect URIs, tenant-restricted identity allowlist and named external contact; Google configurable adapter verified without mandating a separate Google live deployment.
- Approved hosted provider and Supabase target/backup, billing and storage permission; application and data operators configured independently of owner.
- OpenAI model entitlement and price, actual account/project API access, usage budget, organisational sharing/privacy approval. Product $5 cap does **not** cover coding-agent tool usage.
- 5–10 real SSO pilot participants and five real projects available for demonstrations/approval; without users the release is not accepted.

**The frozen plan does not assert any of these are already approved.** It specifies who must accept them and when evidence must exist.

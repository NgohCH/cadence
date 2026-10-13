# Cadence V1.0 — Fixed-Release Execution Contract and Work-Packet Register

**Status:** SCOPE FROZEN BY SPONSOR DIRECTION — implementation and GitHub enforcement not yet proven  
**Version:** 1.8.0 — SCOPE FROZEN, exact 68-packet v1.8 register unchanged  
**Prepared and scope frozen:** 13 October 2026 (Asia/Kuala_Lumpur)  
**Repository:** `NgohCH/cadence`  
**Release name:** **Cadence V1.0** / semver `1.0.0`  
**Fixed target release date:** **Tuesday, 17 November 2026, Asia/Kuala_Lumpur**  
**Final GO/NO-GO:** **Monday, 16 November 2026**  
**Operating model:** one human developer; **one active coding work packet initially**; second independent coding agent allowed only after verified stability gate  
**Fixed register:** **68 packets**, of which **63 mandatory before the release**, **4 conditional audio packets**, and **1 post-release field-acceptance packet.** No automatic additions after approval.

## 1. Governing decision

The output is a genuine, hosted, usable single-company Cadence product on **17 November 2026**. Initial operating organisation: **HELP University**, as a royalty-free academic-use licensee. Intended source copyright owner: **Ngoh Chee Hung**, subject to legal confirmation of contractual/employment IP rights; HELP owns and controls its institutional project data, not the Cadence code. It must also support a one-person/simple team context; external organisations, countries and full multinational governance are **future releases**. A completed VS005, green CI or development demonstration cannot substitute for this release.

**The release date is fixed in the plan, not a licence to bypass safety.** The engineering organisation must meet that date by progressing accepted work, selecting the pre-approved fallback and removing only *explicitly conditional* work. No agent may move the date. If a mandatory security or product gate fails, record an honest **NO-GO on 17 November**, rather than display a false version/date or expose users to an unsafe release. The sponsor must be notified early, with options, whenever the forecast goes red.

**Pilot sequencing amendment:** The controlled M1 pilot can exercise the currently implemented, explicitly-labelled deterministic proposal/review/Task flow, consistent with the original baseline pilot journey, provided the sponsor formally amends the later VS005->VS006->VS007 dependency sequence. It must **not** be described as delivering genuine AI extraction; CAD-WP-017–023 and V1.0 UAT must prove real AI before release. This avoids putting the M1 calendar entirely behind the new model integration.

**Preserve baseline scope:** Cadence's 44 parent, 178 child and 20 initiation acceptance commitments remain governed through M3 unless revised by authorised product governance; this V1.0 release does not claim complete M3 production conformity. Historic VS005 work, October laptop changes and source proof remain intact and are selectively salvaged, never wholesale merged.

## 2. What V1.0 MUST do

- Authorised individual creates a minimal project; a company can run two or more different projects with role-controlled membership and browsing.
- Users sign in with configured **Microsoft Entra ID or Google OAuth**, not a Cadence password; HELP uses its authorised Entra tenant. An authenticated email alone cannot grant project access. Approved users invite/admit internal participants without direct SQL; Person and protected-role history remain intact.
- Discussion is durable; an authorised colleague can see updates after refresh and return later to the same history.
- **Actual LLM assistance (mandatory for V1.0, but not claimed from a deterministic M1 smoke test)** proposes zero, one or several grounded action items; authorised human can edit/reject/approve; a real Task is materialised only after approval.
- Tasks can be **created manually without AI**, assigned, prioritised, progressed and completed; My Tasks and Audit remain accurate even when the AI quota is exhausted.
- Discussions can be summarised on demand, with grounded source references and permission checks. The HELP AI profile is configurable, initially **OpenAI / gpt-6-luna / medium**, with one **USD 5 monthly organisation-wide product AI limit** and manual alternatives when exhausted.
- Decisions are created manually or extracted by AI from **pasted text** and **imported .txt/.md/.vtt/.srt transcripts**. They remain proposals until human confirmation, with rationale, provenance and auditable reviewer. **The full imported transcript is discarded immediately after extraction; only approved derived information and minimal source fingerprints are retained.**
- Project workspace shows actionable project condition, pending/overdue tasks and approved Decisions.
- Hosted web/API, automatic supervised worker, secure environment/RLS, backup, isolated restore, support, safe deployment and reliable operations all pass; **primary and backup operators are configurable/audited, never hard coded**, and users can operate without routine developer repair.
- The product displays exact release version and date (see Section 8).
- **Mandatory user-facing experience:** a calm, elegant and coherent Cadence V1 interface based on a single approved design system. The release cannot look like the original VS001 test page, and non-technical users must be able to navigate project, tasks, collaboration, decisions and AI review. See Section 2A.

**Conditional only, deferred by default until mandatory UI, SSO, budget and core features are on forecast:** browser audio recording and speech-to-text. It uses the same Decision text intake pathway and has a combined **12 agent-hour ceiling** across four pre-existing packets. If there is any material schedule, privacy, cost or reliability risk, record `DEFERRED_BY_CAP` and exclude audio from V1.0 without delaying mandatory text/transcript Decisions.

**Explicitly NOT V1.0:** live audio streaming, speaker diarisation, DOCX/PDF OCR, comprehensive Decision supersession workflows, full document/files product, enterprise directory migration, external/multinational tenant governance, sophisticated analytics, unrelated VS005 deployment authority machinery or an invented development-orchestration platform.


## 2A. Mandatory V1.0 visual and interaction standard

The current VS001 test interface is **not** the release design baseline. The sponsor previously discussed Plane, Leantime, Huly and OpenProject; V1.0 will use their *publicly visible interaction patterns as benchmarks* without copying another product's code, branding or copyrighted visual assets. This is a product **acceptance requirement**, not an open-ended design exercise.

| Reference | Cadence V1 design lesson | Strict boundary |
|---|---|---|
| **Plane** (primary) | Clean SaaS composition, typography, calm spacing, compact collapsible navigation, simple task states | Do not copy product-specific screens/features or recreate Plane |
| **Leantime** | Intuitive, non-technical navigation and clearly named actions | No new strategy/whiteboard subsystem |
| **Huly** | Keep discussions, decisions, action proposals and source context connected and nearby | No full Huly messaging/docs clone |
| **OpenProject** | Clear information hierarchy for responsibility, project status and history | No complex enterprise configuration or new reporting charts |
| **UI UX Pro Max** | Optional design-system heuristics and accessibility checklist for coding agents | No new runtime dependency or unlimited UI research |

**Frozen UI contract:**

1. **Cadence identity:** elegant, modern and understated; high-quality spacing, coherent type hierarchy, subdued neutrals, one restrained accent, consistent status colours and consistent forms/buttons/cards. The default is a calm light theme; a theme-switcher is not V1 scope. Every screen must inherit the versioned master tokens and UI primitives.
2. **Navigation:** project selector and primary project sections are easy to find. Prefer a compact, responsive left navigation with a clear project header. Keep **Discussion -> Decisions -> Actions/Tasks** understandable in a single project context. Secondary AI proposal/context surfaces must be collapsible or non-obstructive; never bury the main action. No empty decorative dashboards.
3. **Usefulness:** clear next action, readable summaries, status/owner/source, consistent loading/empty/error/denied states, minimal unnecessary clicks, keyboard focus visible, text contrast suitable for WCAG 2.2 AA, no horizontal scrolling of main views at 390px. British spelling on all released screens.
4. **Evidence:** actual running screens, not design-only mock-ups, must be reviewed for **sign-in, project selection/creation, workspace, discussion/AI proposals, tasks, member access, Decisions with text/transcript import, and About** at desktop (~1440px) and narrow mobile (~390px). Verify source context and Decision review state are visible and legible.
5. **Change control:** approve one compact visual direction before the first UI implementation packet. Do not allow every feature agent to independently choose a new palette, component library, font stack or navigation model. A public interface/DOM hook can only change through its owner and regression evidence. No UI replatforming, animation framework, dark-mode project, new charts, bespoke illustrations or speculative styling tasks.
6. **Release gate:** an accepted UI direction **and** live-screen visual/interaction acceptance are mandatory for V1.0. A clean build or working API does not waive this standard. Significant navigation failures or unreadable/visually inconsistent core screens block GO; small cosmetic improvements go into a future scheduled release.

**Specific packets:** CAD-WP-060 defines the design system, CAD-WP-061 upgrades the existing login/workspace shell early, and CAD-WP-062 performs the final visual and usability pass. Subsequent UI packets (025, 027, 029, 030, 032, 035, 039, 040, 043 and 056) **must consume** that system, not invent independent styles. These three packets total **11 additional agent-hours** and therefore reduce the unverified nominal schedule slack; conditional audio is deferred first.


## 2B. Frozen HELP deployment, rights, identity, AI and data policies (v1.8)

### Ownership and academic licence

- The intended owner of the **Cadence source code, design and release rights** is **Ngoh Chee Hung**. Put a clear copyright notice and terms in the repository and released About/legal view. The existing GitHub repository is public, but no repo-root licence was found at the inspected revision; public visibility does not by itself provide a reuse grant.
- HELP University is the **initial academic institution licensee**, with an expressly documented **non-exclusive, royalty-free institutional academic-use licence**. Commercial and redistribution rights are not granted by implication. The intended licence requires written agreement/acknowledgement and an IP/employment-rights check before real HELP deployment.
- The five projects and 5-10 users define the **first-release acceptance footprint**, not hard-coded product limits. A simple single-person project remains valid and future organisational growth must not force rewrites.
- HELP is controller/operator of **HELP project content, users and institutional data**. Source ownership does not imply personal ownership of HELP data. Data processing, deletion rights, incident reporting and an administrator transfer path must be clear. The product is **not** a multi-tenant SaaS in V1.0.

### Authentication and operator identity

- Supported login types are **Microsoft Entra ID (Azure)** and **Google OAuth**, selected through approved configuration. HELP first deploys using a tenant-restricted Entra app. No local Cadence username/password is required; account recovery remains with the configured identity provider.
- Use the existing Supabase OAuth/session and Cadence stable Person/AuthenticationIdentity architecture; **authentication never confers automatic Cadence membership**. Restrict allowed organisation/tenant and approved identities, deny unmapped accounts, revoke access promptly and do not link Persons merely by matching an unverified email.
- Primary and backup **application/support operators** are configurable authorised identities or protected operator assignments, not named constants in code. Changing an operator must not implicitly confer project content access. Hosting/billing/recovery ownership is separately named during release GO.

### Configurable product AI, cost ceiling and transient transcripts

- Provider adapter is configuration-driven. The initial HELP choice is OpenAI **`gpt-6-luna`**, **`reasoning.effort=medium`**. The coding agent may separately use Luna Medium; **Codex usage is not paid out of Cadence's USD 5 product-AI allowance**.
- **Monthly cap: USD 5 per organisation, across all five projects and every AI feature.** No per-user or per-project budget multiplication. Configure a project-specific provider limit and project alerts; enforce **app-side atomic spend reservations and a safety headroom** because vendor cost reports and enforcement are not instantaneous. Stop new AI operations at the safety threshold or if budget cannot be verified; continue all manual workflows. Scope is a local calendar month in Asia/Kuala_Lumpur for the Cadence ledger, with any vendor UTC-cycle mismatch documented.
- Imported **raw transcript** and transient pasted-text extraction inputs must never be durable authoritative project content. Discard full raw input following a processing attempt (including error/retry); retain only the approved structured Decision, rationale and minimal extracted evidence/provenance. No raw transcript in SQL, object storage, logs, crash reports or backups. Native Discussion messages remain durable as separately authored project context.
- Sending content to an external OpenAI API is **not equivalent to zero external retention**. Use a provider mode such as `store:false` where supported, review the vendor retention terms, display an appropriate notice and do not promise guaranteed immediate erasure from vendor systems. Live sensitive institutional content needs authorised data-sharing approval.

### Unattended Windows development runner

- The laptop may operate continuously while connected to power and network. **Active uptime does not count as accepted throughput.** A bounded Windows runner dispatches only ready, preapproved packets; tracks retries, timeouts, lease/epoch, SHA, worktree, CLI auth, checkpoints and stop commands; never auto-bypasses review/privileged gates.
- Until CAD-WP-068 has been implemented and failure-tested, an unattended powered laptop is **not** an authorised multi-packet autonomous development runner. The first agent remains serial; a second is enabled only after the original stability gate **and** WP-068 pass.
- Overnight failures, CI queueing, auth expiry, power/sleep, token limits, loss of network and approval blocking must be recorded in the next status report. Never run provider mutations, destructive SQL or live production deployment unattended without their specific approved authority.

## 3. Packet sizing and execution discipline

1. Each work packet has **1–6 estimated focused agent-hours**: most implementation packets are 2–5h, CAD-WP-055 is an explicitly accepted 6h cross-project UAT packet, and brief formal sponsor gates may be 1h. Estimate includes coding, self-test, PR and acceptance-evidence preparation but does **not** include external latency, human availability, user pilot calendar days or contingency. This is a **pre-implementation estimate**, not a verified promise.
2. One packet = one contractually measurable output, with a named producer/consumer, exact repo navigation, code ownership, test evidence and fixed dependencies. No hidden feature work. The machine register is source for generating GitHub issues/dispatches after approval. **Numbering is identity, not execution order:** the runner dispatches by accepted dependencies and locked file scopes, never merely by ascending number.
3. A packet may be split further **only by sponsor-approved substitution of the frozen register**, with unchanged total scope, recalculated effort/dependencies and no silent date extension. Do not enlarge one packet simply to avoid the register ceiling.
4. One source-pinned branch and PR per packet by default. Routine automated review and merging only after enforceable policy guards; if auto-merge protection is not proven, code/PR work proceeds and protected merging remains supervised.
5. A failed acceptance receives **one bounded same-packet remediation/retest**; then `BLOCKED` and a decision, not an automatically created packet. All source-SHA approvals invalidate on source changes.
6. Use **British spelling**, precise provenance, no secret commits, no unauthorised hosted mutations, no direct browser access to protected business data and no unauthorised authoritative AI writes.

> Machine work-packet register SHA-256: `1c6f415b36e90ca4d5320bfdc49f0abbdaec6beec70a576f3cbb68ae18f06080` (for file `CADENCE_V1_0_FROZEN_PACKET_REGISTER_v1_8_0.json`)

## 4. Graduated concurrency — **one packet first**

**Mode A: SERIAL (default).** Only one coding agent may hold the write lease and execute one `IN_PROGRESS` packet. Start with the contract/recovery/dispatch path, not multiple branches. Record actual start, finish, tests, review and merge duration for the first three consecutive accepted **engineering** packets (not just documentation approvals).

**Second-agent enablement:** the sponsor may activate **Mode B: TWO_LANES** only when all are true:

1. At least **three consecutive engineering packets** are `ACCEPTED` at exact merge SHAs, with no hand-finished or unverified acceptance.
2. CAD-WP-003 (shared contracts), -004 (dispatch), -005 (PAUSE), -006 (RESUME/reclone) and -007 (baseline migrations/integration) have passed, even if this means more than three packets are completed before opening lane B.
3. Safe PAUSE -> remote checkpoint -> reclone -> RESUME has passed and the exact repo/account/absolute-worktree preflight works.
4. Real integration tests remain green; there is no outstanding P0/P1, stale approval or missing producer/consumer interface; the central serial integrator is effective.
5. Each agent has a separate worktree, unique branch, exclusive write lease and non-overlapping protected file ownership. A shared API, OpenAPI, app composition, migration or lockfile change requires a reserved **serial integration slot**.
6. CAD-WP-068 unattended local runner passes interruption/restart, lease and blocked-gate tests. The sponsor records a one-time **ENABLE_SECOND_AGENT** authorisation; no calendar date, pressure or agent suggestion bypasses this gate.

**Mode B:** at most **two parallel coding writers**, typically **A: runtime/AI** and **B: company/Decisions** according to eligible dependency order. A third AI process can do **read-only verification** with no merge/code-writing rights; it is not a third coding lane. Only one merger/integrator touches `main` at a time.

**Automatic fallback to SERIAL:** any shared-file collision, integration regression not corrected within the packet's allowance, stale worktree/contract, duplicated merge attempt, PAUSE/RESUME uncertainty or new P0/P1. Restore TWO_LANES only after the failure is resolved and the stability proof is rerun. A blocked lane is not permission to start unrelated tasks.

**Dispatch payload:** canonical `NgohCH/cadence` repo and verified GitHub identity, absolute laptop worktree path, `pwd`, `git rev-parse`, exact base SHA, current control epoch, packet ID, dependency SHAs, approved API and schema version, ordered *existing* source paths and symbols, separate *PLANNED* paths, allowed writes, locked shared files, precise tests, accepted effort, checkpoint branch and output manifest. Never invent a Windows path; resolve and verify it on the executing laptop. Wrong identity/path/SHA = `DISPATCH_BLOCKED`.

**Pause/resume commands:** `CADENCE PAUSE`, `CADENCE RESUME`, `CADENCE STATUS` in the authorised operator channel or a bounded local PowerShell wrapper. A graceful safe shutdown is only reported after all WIP commits/checkpoints are present and hash-verified on approved remote storage. An offline laptop, unmatched SHA or missing runner acknowledgment must show `PAUSE INCOMPLETE`; hosted Cadence continues running. These are *not operational controls yet* and are to be implemented by the early packets.

## 5. Fixed 68-work-packet register

**The frozen machine register, not numbering, controls dispatch.** The following are pre-freeze estimates. `MANDATORY` work may not be silently deferred. `CONDITIONAL` audio packets are optional; WP-059 is post-release observation.

### Foundation, governance and recovered baseline

| Packet | Specific output | Est. | Prerequisites | Status |
|---|---|---:|---|---|
| CAD-WP-001 | Freeze V1.0 product and governance | 3h | - | Required |
| CAD-WP-002 | Pin baseline and classify VS005 salvage | 3h | 001 | Required |
| CAD-WP-003 | Freeze API/event/schema/interface catalogue | 5h | 001, 002 | Required |
| CAD-WP-004 | Implement navigable packet dispatch preflight | 3h | 001 | Required |
| CAD-WP-005 | Remote PAUSE and WIP checkpoint | 4h | 004 | Required |
| CAD-WP-006 | RESUME, reclone and crash tests | 4h | 005 | Required |
| CAD-WP-007 | Reproduce integrated baseline in isolation | 4h | 002 | Required |
| CAD-WP-008 | Choose bounded hosting route | 4h | 003, 007 | Required |

### Federated sign-in and stable identity

| Packet | Specific output | Est. | Prerequisites | Status |
|---|---|---:|---|---|
| CAD-WP-063 | Configurable Entra ID and Google OAuth sign-in | 5h | 003, 007 | Required |
| CAD-WP-064 | SSO Person mapping, tenant restriction and revocation | 5h | 003, 007, 063 | Required |

### Runtime and hosting

| Packet | Specific output | Est. | Prerequisites | Status |
|---|---|---:|---|---|
| CAD-WP-009 | Compose shared API application runtime | 3h | 008 | Required |
| CAD-WP-010 | Bound worker independent jobs | 4h | 009 | Required |
| CAD-WP-011 | Persistent retry and idempotent worker delivery | 4h | 010 | Required |
| CAD-WP-012 | Safe configuration, secrets and target admission | 4h | 009 | Required |
| CAD-WP-013 | Deploy hosted HTTPS web and API | 5h | 009, 012 | Required |
| CAD-WP-014 | Schedule and inspect hosted worker | 4h | 011, 013 | Required |
| CAD-WP-015 | Provider-native app rollback and runbook | 3h | 013 | Required |
| CAD-WP-016 | Immutable release build identity and health | 3h | 009, 012 | Required |

### AI organisation spending protection

| Packet | Specific output | Est. | Prerequisites | Status |
|---|---|---:|---|---|
| CAD-WP-065 | Configurable monthly organisation AI cap | 5h | 003, 007, 017 | Required |

### Real AI and action workflow

| Packet | Specific output | Est. | Prerequisites | Status |
|---|---|---:|---|---|
| CAD-WP-017 | AI provider adapter and privacy controls | 4h | 003, 007 | Required |
| CAD-WP-018 | Structured AI output validation and parser | 3h | 017 | Required |
| CAD-WP-019 | Convert Discussion to grounded Task proposals | 4h | 018 | Required |
| CAD-WP-020 | Human review to authoritative Task integration | 4h | 019 | Required |
| CAD-WP-021 | Freeze and pass AI extraction benchmark | 4h | 020 | Required |
| CAD-WP-022 | On-demand source-grounded discussion summary | 3h | 017, 007 | Required |
| CAD-WP-023 | Hosted AI action end-to-end smoke | 3h | 014, 020, 021, 065 | Required |

### Self-service company product

| Packet | Specific output | Est. | Prerequisites | Status |
|---|---|---:|---|---|
| CAD-WP-024 | Atomic authorised project-creation API | 4h | 003, 007 | Required |
| CAD-WP-025 | Minimal project-creation browser UI | 4h | 024, 061 | Required |
| CAD-WP-026 | Authorised project-list API | 3h | 024 | Required |
| CAD-WP-027 | Project selection and scoped navigation | 3h | 026, 061 | Required |
| CAD-WP-028 | Self-service internal membership API | 4h | 024, 064 | Required |
| CAD-WP-029 | Membership onboarding browser workflow | 3h | 027, 028, 061, 063, 064 | Required |
| CAD-WP-030 | Protected role UI and same-person scenario | 3h | 028, 061 | Required |
| CAD-WP-031 | Task update/status API with permissions | 4h | 003, 007 | Required |
| CAD-WP-032 | Task lifecycle browser UI | 5h | 027, 031, 061 | Required |
| CAD-WP-033 | Synchronise My Tasks and Audit after changes | 3h | 020, 031 | Required |
| CAD-WP-034 | Workspace read model for current work | 3h | 026, 031 | Required |
| CAD-WP-035 | Company workspace UI with Decisions entry | 4h | 027, 034, 038, 061 | Required |

### Decisions from text and transcript

| Packet | Specific output | Est. | Prerequisites | Status |
|---|---|---:|---|---|
| CAD-WP-036 | Decision provenance, metadata and RLS (no raw transcripts) | 4h | 003, 007 | Required |
| CAD-WP-037 | Decision proposal, approval and Audit persistence | 5h | 036 | Required |
| CAD-WP-038 | Decision API/service and source navigation | 4h | 037 | Required |
| CAD-WP-039 | Manual Decision register/review browser UI | 4h | 027, 038, 061 | Required |
| CAD-WP-040 | Normalised pasted-text Decision intake | 3h | 036, 039, 061 | Required |
| CAD-WP-041 | Text transcript import parser | 3h | 040 | Required |
| CAD-WP-042 | Grounded AI Decision extraction | 5h | 017, 038, 040, 065, 066 | Required |
| CAD-WP-043 | End-to-end transcript/text Decision approval | 4h | 039, 041, 042, 061, 066 | Required |

### Transient transcript protection

| Packet | Specific output | Est. | Prerequisites | Status |
|---|---|---:|---|---|
| CAD-WP-066 | Transient transcript intake and deletion | 4h | 017, 036, 041 | Required |

### Configurable application operators

| Packet | Specific output | Est. | Prerequisites | Status |
|---|---|---:|---|---|
| CAD-WP-067 | Configurable primary and backup operator roles | 4h | 003, 007, 064 | Required |

### Bounded overnight coding runner

| Packet | Specific output | Est. | Prerequisites | Status |
|---|---|---:|---|---|
| CAD-WP-068 | Bounded overnight Codex runner on Windows laptop | 5h | 004, 005, 006 | Required |

### Conditional audio - never release-blocking

| Packet | Specific output | Est. | Prerequisites | Status |
|---|---|---:|---|---|
| CAD-WP-044 | Audio fast feasibility, consent/privacy gate | 2h | 017, 040 | Conditional |
| CAD-WP-045 | Browser Start/Stop/preview capture | 3h | 044 | Conditional |
| CAD-WP-046 | Server transcription adapter and disposal | 4h | 044, 017 | Conditional |
| CAD-WP-047 | Audio-to-standard Decision pipeline smoke | 3h | 043, 045, 046 | Conditional |

### V1.0 visual system and visual acceptance

| Packet | Specific output | Est. | Prerequisites | Status |
|---|---|---:|---|---|
| CAD-WP-060 | Freeze Cadence V1 visual system and screen references | 3h | 001, 007 | Required |
| CAD-WP-061 | Implement refined login and responsive workspace shell | 5h | 060, 063 | Required |
| CAD-WP-062 | Confirm V1 visual consistency and usability | 3h | 061, 025, 027, 029, 030, 032, 035, 039, 040, 043 | Required |

### Integration, real users, release and acceptance

| Packet | Specific output | Est. | Prerequisites | Status |
|---|---|---:|---|---|
| CAD-WP-048 | Continuous consumer-provider contract CI | 4h | 003, 020, 031, 038, 043 | Required |
| CAD-WP-049 | Hosted two-session M1 synthetic rehearsal | 4h | 014, 063, 064 | Required |
| CAD-WP-050 | Real PostgreSQL negative security regression | 4h | 024, 028, 031, 038, 064 | Required |
| CAD-WP-051 | Operational logs, support owner and incident runbook | 3h | 014, 015, 067 | Required |
| CAD-WP-052 | Independent isolated database restore proof | 4h | 007, 051 | Required |
| CAD-WP-053 | M1 Pilot Activation sponsor GO/NO-GO | 1h | 049, 051, 052, 063, 064, 067 | Required |
| CAD-WP-054 | Five-working-day M1 real-user pilot | 3h | 053 | Required |
| CAD-WP-055 | Five-project complete-journey company UAT | 6h | 022, 023, 025, 027, 029, 030, 032, 033, 035, 043, 048, 050, 062, 063, 064, 065, 066, 067 | Required |
| CAD-WP-056 | Signed V1.0 package, About screen and date controls | 3h | 016, 035, 061 | Required |
| CAD-WP-057 | 16 November release GO/NO-GO | 2h | 048, 050, 052, 054, 055, 056, 063, 064, 065, 066, 067 | Required |
| CAD-WP-058 | 17 November V1.0 hosted release and verification | 3h | 057 | Required |
| CAD-WP-059 | Ten-working-day post-release real-use acceptance | 2h | 058 | Post-release |


## 6. Packet-by-packet source navigation and acceptance

An unprefixed path is a file previously inspected or explicitly specified by the packet; `VS005:` is a separate historical branch; `+` means a PLANNED new file and **does not** assert it exists. Live dispatch resolves every path against the actual pinned SHA and refuses unexplained differences. Exact paths/symbols/read-write grants and tests are emitted by the verified dispatcher, not guessed here.

#### CAD-WP-001 - Freeze V1.0 product and governance

- **Bounded effort:** 3 agent-hours; **risk tier:** SPONSOR; **dependencies:** None.
- **Deliverable:** Freeze V1.0 scope, source ownership intention, HELP academic licence boundary, data ownership, complete packet register and fixed 17 November date.
- **Acceptance:** Sponsor-approved contract, 68-packet traceability, draft copyright and HELP academic licence terms, legal/IP authority checkpoint, signed scope and fixed 17 November date. Existing M3 commitments remain governed.
- **Open/inspect:** `docs/governance/CADENCE_CHANGE_CONTROL.md`; `docs/governance/CADENCE_MILESTONE_ROADMAP.md`; `+docs/legal/CADENCE_COPYRIGHT_AND_LICENCE.md`.

#### CAD-WP-002 - Pin baseline and classify VS005 salvage

- **Bounded effort:** 3 agent-hours; **risk tier:** AUTO; **dependencies:** CAD-WP-001.
- **Deliverable:** Inventory remote and any locally unpushed VS005 work as reuse/exclude candidates.
- **Acceptance:** Hashes, branch/commit inventory and KEEP/EXTRACT/REPLACE/EXCLUDE table; no automatic wholesale merge.
- **Open/inspect:** `docs/vertical-slices/VS-004.md`; `VS005:docs/vertical-slices/VS-005.md`.

#### CAD-WP-003 - Freeze API/event/schema/interface catalogue

- **Bounded effort:** 5 agent-hours; **risk tier:** REVIEW; **dependencies:** CAD-WP-001, CAD-WP-002.
- **Deliverable:** Freeze exact API/event/schema/SSO/AI-budget/transcript/operator interfaces and named owners for producer-consumer integration.
- **Acceptance:** Versioned schema registry, external provider interface contracts, budget/identity/provenance field types, connector map, test vectors and locked-file owners accepted.
- **Open/inspect:** `api/Cadence_v0.1_openapi.yaml`; `apps/api/src/modules/team-agent/team-agent.types.ts`.

#### CAD-WP-004 - Implement navigable packet dispatch preflight

- **Bounded effort:** 3 agent-hours; **risk tier:** AUTO; **dependencies:** CAD-WP-001.
- **Deliverable:** Dispatch the current packet with verified repo identity, absolute worktree, exact files/symbols and commands.
- **Acceptance:** Wrong repo/branch/SHA/login or unresolved path blocks; signed dispatch manifest prints correct cwd.
- **Open/inspect:** `+tools/cadence-dispatch.ps1`; `apps/api/src/modules/team-agent/message-created.handler.ts`.

#### CAD-WP-005 - Remote PAUSE and WIP checkpoint

- **Bounded effort:** 4 agent-hours; **risk tier:** REVIEW; **dependencies:** CAD-WP-004.
- **Deliverable:** Safely pause new dispatch and privileged actions; commit and verify allowed WIP checkpoint remotely.
- **Acceptance:** PAUSED only with verified remote SHAs and no active writer; no interruption to hosted service.
- **Open/inspect:** `+tools/cadence-control.ps1`; `+.cadence-control/control-state.json`.

#### CAD-WP-006 - RESUME, reclone and crash tests

- **Bounded effort:** 4 agent-hours; **risk tier:** AUTO; **dependencies:** CAD-WP-005.
- **Deliverable:** Resume same active packet after fresh checkout; fail closed for stale lease/offline/missing SHA.
- **Acceptance:** Reclone-resume test, no duplicated GitHub side effects, no lost accepted state; one-agent operating proof.
- **Open/inspect:** `+tools/cadence-control.ps1`; `+.cadence-control/checkpoint.schema.json`.

#### CAD-WP-007 - Reproduce integrated baseline in isolation

- **Bounded effort:** 4 agent-hours; **risk tier:** AUTO; **dependencies:** CAD-WP-002.
- **Deliverable:** Build application on clean checkout and replay migrations against disposable PostgreSQL; smoke current collaboration journey.
- **Acceptance:** Baseline tests, fresh migration/RLS tests, two-user Discussion->Task->Audit and audit of missing connectors recorded.
- **Open/inspect:** `package.json`; `supabase/migrations/20260808002600_rls.sql`.

#### CAD-WP-008 - Choose bounded hosting route

- **Bounded effort:** 4 agent-hours; **risk tier:** SPONSOR; **dependencies:** CAD-WP-003, CAD-WP-007.
- **Deliverable:** One compatibility spike selects native Cloudflare hosting or predetermined Node/static/one-shot fallback.
- **Acceptance:** Exactly one selected primary route, fallback decision and proof; stop third-provider investigation.
- **Open/inspect:** `apps/api/src/server.ts`; `VS005:apps/runtime-cloudflare/src/index.ts`.

#### CAD-WP-009 - Compose shared API application runtime

- **Bounded effort:** 3 agent-hours; **risk tier:** AUTO; **dependencies:** CAD-WP-008.
- **Deliverable:** Selectively salvage app composition without changing protected service interfaces.
- **Acceptance:** API health, auth and workspace regression tests; Node API remains runnable.
- **Open/inspect:** `apps/api/src/server.ts`; `VS005:apps/api/src/runtime/create-cadence-app.ts`.

#### CAD-WP-010 - Bound worker independent jobs

- **Bounded effort:** 4 agent-hours; **risk tier:** AUTO; **dependencies:** CAD-WP-009.
- **Deliverable:** Bound membership, audit and Team Agent consumption per cycle.
- **Acceptance:** No job starves others, deadline/backlog reported and one-shot Node mode preserved.
- **Open/inspect:** `apps/api/src/worker.ts`; `VS005:apps/api/src/runtime/cadence-worker-cycle.ts`.

#### CAD-WP-011 - Persistent retry and idempotent worker delivery

- **Bounded effort:** 4 agent-hours; **risk tier:** AUTO; **dependencies:** CAD-WP-010.
- **Deliverable:** Recover from failed deliveries without silently duplicating Tasks or Audit events.
- **Acceptance:** Failure/retry/restart and duplicate-event tests on durable delivery state pass.
- **Open/inspect:** `apps/api/src/worker.ts`; `VS005:apps/api/src/runtime/worker-retry-policy.ts`.

#### CAD-WP-012 - Safe configuration, secrets and target admission

- **Bounded effort:** 4 agent-hours; **risk tier:** REVIEW; **dependencies:** CAD-WP-009.
- **Deliverable:** Use canonical environment mapping and fail closed on wrong database/provider targets.
- **Acceptance:** Wrong-target, invalid secret, mismatched environment and no-browser-leak tests pass.
- **Open/inspect:** `apps/api/src/bootstrap/environment-safety.ts`; `VS005:apps/api/src/bootstrap/cadence-config.ts`.

#### CAD-WP-013 - Deploy hosted HTTPS web and API

- **Bounded effort:** 5 agent-hours; **risk tier:** REVIEW; **dependencies:** CAD-WP-009, CAD-WP-012.
- **Deliverable:** Provider-native build/deploy with authenticated browser->API calls and stable URLs.
- **Acceptance:** Real hosted login, health, CORS and project data read; no custom privileged VS005 controller.
- **Open/inspect:** `apps/web/package.json`; `apps/api/src/server.ts`.

#### CAD-WP-014 - Schedule and inspect hosted worker

- **Bounded effort:** 4 agent-hours; **risk tier:** REVIEW; **dependencies:** CAD-WP-011, CAD-WP-013.
- **Deliverable:** Schedule event consumer automatically and make retry/failure inspection available.
- **Acceptance:** Hosted messages yield proposals without manual worker run; one fault and recovery demonstrated.
- **Open/inspect:** `apps/api/src/worker.ts`; `VS005:apps/runtime-cloudflare/src/index.ts`.

#### CAD-WP-015 - Provider-native app rollback and runbook

- **Bounded effort:** 3 agent-hours; **risk tier:** REVIEW; **dependencies:** CAD-WP-013.
- **Deliverable:** Document and test application rollback without any implied database reset.
- **Acceptance:** Rehearse safe version rollback to known build; deployment commands and target checks captured.
- **Open/inspect:** `+docs/operations/DEPLOY.md`; `apps/api/package.json`.

#### CAD-WP-016 - Immutable release build identity and health

- **Bounded effort:** 3 agent-hours; **risk tier:** AUTO; **dependencies:** CAD-WP-009, CAD-WP-012.
- **Deliverable:** Expose commit/version/build info without secrets; distinguish candidate from released software.
- **Acceptance:** UI/API release identity matches CI manifest; must not print 17 Nov Released before actual release.
- **Open/inspect:** `apps/api/src/server.ts`; `+apps/web/src/features/about/ReleaseIdentity.tsx`.

#### CAD-WP-017 - AI provider adapter and privacy controls

- **Bounded effort:** 4 agent-hours; **risk tier:** REVIEW; **dependencies:** CAD-WP-003, CAD-WP-007.
- **Deliverable:** Implement a replaceable AI provider adapter. Initial configured provider is OpenAI, model gpt-6-luna with medium reasoning. Secrets must remain server-side.
- **Acceptance:** Validated configuration selects OpenAI and gpt-6-luna medium; structured outputs and provider errors handled; privacy checks and request store=false; no raw prompts or secrets logged; provider changes do not require business-module rewrites.
- **Open/inspect:** `apps/api/src/modules/team-agent/team-agent.service.ts`; `+apps/api/src/infrastructure/ai/provider.ts`.

#### CAD-WP-018 - Structured AI output validation and parser

- **Bounded effort:** 3 agent-hours; **risk tier:** AUTO; **dependencies:** CAD-WP-017.
- **Deliverable:** Validate zero/one/many proposed actions and uncertainty against frozen schema.
- **Acceptance:** Malformed model output fails closed; fields/provenance stable and no fabricated identities/dates.
- **Open/inspect:** `apps/api/src/modules/team-agent/team-agent.types.ts`; `+apps/api/src/infrastructure/ai/structured-output.ts`.

#### CAD-WP-019 - Convert Discussion to grounded Task proposals

- **Bounded effort:** 4 agent-hours; **risk tier:** AUTO; **dependencies:** CAD-WP-018.
- **Deliverable:** Feed immutable discussion version through AI adapter and create source-grounded candidate Tasks.
- **Acceptance:** No-action, multi-action, ambiguous text tests; message/version linkage and actual event contract pass.
- **Open/inspect:** `apps/api/src/modules/team-agent/team-agent.service.ts`; `apps/api/src/modules/team-agent/message-created.handler.ts`.

#### CAD-WP-020 - Human review to authoritative Task integration

- **Bounded effort:** 4 agent-hours; **risk tier:** AUTO; **dependencies:** CAD-WP-019.
- **Deliverable:** Preserve authorised confirm/edit/reject and idempotent Task creation for new proposal output.
- **Acceptance:** Real service connector, duplicate protection, negative authorisation and Audit provenance pass.
- **Open/inspect:** `apps/api/src/modules/team-agent/team-agent-task-materialization.service.ts`; `apps/web/src/features/team-agent/ProposalReviewPanel.tsx`.

#### CAD-WP-021 - Freeze and pass AI extraction benchmark

- **Bounded effort:** 4 agent-hours; **risk tier:** AUTO; **dependencies:** CAD-WP-020.
- **Deliverable:** Evaluate against predetermined 30-case fixture without tuning test labels after results.
- **Acceptance:** 30-case frozen fixture passes required precision/recall; cost and provider usage are recorded, budget exhaustion falls back safely and no extra unapproved model is selected.
- **Open/inspect:** `apps/api/src/modules/team-agent/team-agent.test.ts`; `+tests/ai/action-evaluation.json`.

#### CAD-WP-022 - On-demand source-grounded discussion summary

- **Bounded effort:** 3 agent-hours; **risk tier:** AUTO; **dependencies:** CAD-WP-017, CAD-WP-007.
- **Deliverable:** Provide bounded summary with source references and no source disclosure across projects.
- **Acceptance:** Test empty, multi-message, unauthorised, model failure and source-grounding behaviours.
- **Open/inspect:** `apps/api/src/modules/discussion/discussion.service.ts`; `+apps/api/src/modules/team-agent/summary.service.ts`.

#### CAD-WP-023 - Hosted AI action end-to-end smoke

- **Bounded effort:** 3 agent-hours; **risk tier:** AUTO; **dependencies:** CAD-WP-014, CAD-WP-020, CAD-WP-021, CAD-WP-065.
- **Deliverable:** Demonstrate browser Discussion->model->proposal->approval->Task->Audit on hosted target.
- **Acceptance:** Hosted real OpenAI Luna Medium requests generate reviewed tasks, correct sources and idempotent authoritative actions; monthly organisation cap and budget exhaustion are verified.
- **Open/inspect:** `apps/web/src/features/team-agent/ProposalReviewPanel.tsx`; `apps/web/src/features/discussion/DiscussionPanel.tsx`.

#### CAD-WP-024 - Atomic authorised project-creation API

- **Bounded effort:** 4 agent-hours; **risk tier:** REVIEW; **dependencies:** CAD-WP-003, CAD-WP-007.
- **Deliverable:** Create minimal project and required health/responsibility in one authorised flow.
- **Acceptance:** Transactional creation, idempotency, RBAC and same-person initial roles where policy permits.
- **Open/inspect:** `apps/api/src/modules/projects/projects.service.ts`; `apps/api/src/infrastructure/database/supabase-project-lifecycle.repository.ts`.

#### CAD-WP-025 - Minimal project-creation browser UI

- **Bounded effort:** 4 agent-hours; **risk tier:** AUTO; **dependencies:** CAD-WP-024, CAD-WP-061.
- **Deliverable:** Permit an authenticated individual to create a project without a developer.
- **Acceptance:** Browser create and reopen; no hard-coded starter project; empty/error states tested. Uses approved Cadence V1 visual and interaction standard; avoids one-off styling or inaccessible controls.
- **Open/inspect:** `apps/web/src/features/workspace/ProjectWorkspace.tsx`; `+apps/web/src/features/projects/CreateProject.tsx`.

#### CAD-WP-026 - Authorised project-list API

- **Bounded effort:** 3 agent-hours; **risk tier:** AUTO; **dependencies:** CAD-WP-024.
- **Deliverable:** List only projects accessible to effective Person membership.
- **Acceptance:** Two-project, different roles, outsider not-visible and stable paginated DTO tests.
- **Open/inspect:** `apps/api/src/modules/projects/projects.routes.ts`; `apps/api/src/modules/projects/projects.repository.ts`.

#### CAD-WP-027 - Project selection and scoped navigation

- **Bounded effort:** 3 agent-hours; **risk tier:** AUTO; **dependencies:** CAD-WP-026, CAD-WP-061.
- **Deliverable:** Replace configured fixed project ID with authorised user selection.
- **Acceptance:** Project switch, refresh/relogin and unauthorised project denial tested; stable project identity. Uses approved Cadence V1 visual and interaction standard; avoids one-off styling or inaccessible controls.
- **Open/inspect:** `apps/web/src/features/workspace/ProjectWorkspace.tsx`; `apps/web/src/features/workspace/WorkspaceShell.tsx`.

#### CAD-WP-028 - Self-service internal membership API

- **Bounded effort:** 4 agent-hours; **risk tier:** REVIEW; **dependencies:** CAD-WP-024, CAD-WP-064.
- **Deliverable:** Provide self-service invitation/admission and project membership for approved SSO identities without local Cadence passwords.
- **Acceptance:** An eligible Azure/Google identity can be admitted to the right Person and project; external/unapproved users denied; disabled and removed users fail closed; no ad hoc SQL or local password required.
- **Open/inspect:** `apps/api/src/modules/project-membership/project-member-admission.repository.ts`; `apps/api/src/modules/project-membership/project-membership.routes.ts`.

#### CAD-WP-029 - Membership onboarding browser workflow

- **Bounded effort:** 3 agent-hours; **risk tier:** AUTO; **dependencies:** CAD-WP-027, CAD-WP-028, CAD-WP-061, CAD-WP-063, CAD-WP-064.
- **Deliverable:** Let authorised manager invite/admit members through normal UI.
- **Acceptance:** Approved organisation member can be invited and admitted by authorised UI; a forbidden identity is denied; SSO sign-in, permission changes, and revocation are shown with useful states.
- **Open/inspect:** `apps/web/src/features/members/MembersPanel.tsx`; `+apps/web/src/features/members/InviteMember.tsx`.

#### CAD-WP-030 - Protected role UI and same-person scenario

- **Bounded effort:** 3 agent-hours; **risk tier:** REVIEW; **dependencies:** CAD-WP-028, CAD-WP-061.
- **Deliverable:** Allow valid initial overlapping responsibilities, manage protected role moves safely.
- **Acceptance:** Permission and succession history tests; no automatic role assumption from organisational title. Uses approved Cadence V1 visual and interaction standard; avoids one-off styling or inaccessible controls.
- **Open/inspect:** `apps/api/src/modules/project-membership/project-role-management.repository.ts`; `apps/web/src/features/members/MembersPanel.tsx`.

#### CAD-WP-031 - Task update/status API with permissions

- **Bounded effort:** 4 agent-hours; **risk tier:** REVIEW; **dependencies:** CAD-WP-003, CAD-WP-007.
- **Deliverable:** Task update/status/assignment API with permissions; retain the existing authoritative manual Task create path.
- **Acceptance:** Open/in-progress/completed/cancelled transitions, auth, optimistic concurrency/history pass.
- **Open/inspect:** `apps/api/src/modules/tasks/tasks.service.ts`; `apps/api/src/modules/tasks/tasks.routes.ts`.

#### CAD-WP-032 - Task lifecycle browser UI

- **Bounded effort:** 5 agent-hours; **risk tier:** AUTO; **dependencies:** CAD-WP-027, CAD-WP-031, CAD-WP-061.
- **Deliverable:** Usable Task lifecycle browser UI including manual Create Task, assignment, priority, status update and completion without an AI service.
- **Acceptance:** Any authorised user can manually create, edit and finish a Task while OpenAI is unavailable or the USD 5 quota is exhausted; My Tasks and Audit reflect every change.
- **Open/inspect:** `apps/web/src/features/tasks/MyTasksPanel.tsx`; `+apps/web/src/features/tasks/TaskEditor.tsx`.

#### CAD-WP-033 - Synchronise My Tasks and Audit after changes

- **Bounded effort:** 3 agent-hours; **risk tier:** AUTO; **dependencies:** CAD-WP-020, CAD-WP-031.
- **Deliverable:** Ensure human and agent Task updates remain accurately visible and auditable.
- **Acceptance:** Fresh My Tasks, cross-project isolation, created/updated/completed history and no duplicate events.
- **Open/inspect:** `apps/api/src/modules/audit/audit.service.ts`; `apps/web/src/features/tasks/useMyTasks.ts`.

#### CAD-WP-034 - Workspace read model for current work

- **Bounded effort:** 3 agent-hours; **risk tier:** AUTO; **dependencies:** CAD-WP-026, CAD-WP-031.
- **Deliverable:** Provide pending/overdue work and project condition through one consistent API.
- **Acceptance:** Current tasks and role-specific project view from real persistence, not fixtures.
- **Open/inspect:** `apps/api/src/modules/projects/projects.service.ts`; `apps/web/src/features/workspace/useProjectSummary.ts`.

#### CAD-WP-035 - Company workspace UI with Decisions entry

- **Bounded effort:** 4 agent-hours; **risk tier:** AUTO; **dependencies:** CAD-WP-027, CAD-WP-034, CAD-WP-038, CAD-WP-061.
- **Deliverable:** Show projects, responsibilities, Decisions and concise project state in coherent navigation.
- **Acceptance:** Switch between two projects and access Decision Register, with correct empty/error states. Uses approved Cadence V1 visual and interaction standard; avoids one-off styling or inaccessible controls.
- **Open/inspect:** `apps/web/src/features/workspace/WorkspaceShell.tsx`; `apps/web/src/features/workspace/ProjectWorkspace.tsx`.

#### CAD-WP-036 - Decision provenance, metadata and RLS (no raw transcripts)

- **Bounded effort:** 4 agent-hours; **risk tier:** REVIEW; **dependencies:** CAD-WP-003, CAD-WP-007.
- **Deliverable:** Persist minimal Decision-source provenance and approved extracted evidence while prohibiting retention of the full imported transcript.
- **Acceptance:** Decision source metadata, extraction time, source fingerprint and approved minimal evidence retained with RBAC/RLS; full imported transcript is not stored in the business database, storage, logs or backups.
- **Open/inspect:** `supabase/migrations/20260808001000_decisions.sql`; `+supabase/migrations/202610XXXX_decision_sources.sql`.

#### CAD-WP-037 - Decision proposal, approval and Audit persistence

- **Bounded effort:** 5 agent-hours; **risk tier:** REVIEW; **dependencies:** CAD-WP-036.
- **Deliverable:** Implement canonical proposed/confirmed/rejected decision flow and source references.
- **Acceptance:** Approved decision only after authorised human; idempotent approve, evidence/rationale, immutable audit.
- **Open/inspect:** `supabase/migrations/20260808001000_decisions.sql`; `+apps/api/src/modules/decisions/decisions.repository.ts`.

#### CAD-WP-038 - Decision API/service and source navigation

- **Bounded effort:** 4 agent-hours; **risk tier:** REVIEW; **dependencies:** CAD-WP-037.
- **Deliverable:** Expose authorised source, proposed Decision, approval and Decision Register queries.
- **Acceptance:** Decision read/write/review and source navigation resolve to retained extracted evidence and provenance, not a deleted raw transcript; RLS and authorisation pass.
- **Open/inspect:** `api/Cadence_v0.1_openapi.yaml`; `+apps/api/src/modules/decisions/decisions.routes.ts`.

#### CAD-WP-039 - Manual Decision register/review browser UI

- **Bounded effort:** 4 agent-hours; **risk tier:** AUTO; **dependencies:** CAD-WP-027, CAD-WP-038, CAD-WP-061.
- **Deliverable:** Create/view/review Decision manually with evidence and approver.
- **Acceptance:** Authorised confirm/edit/reject/defer and trace to source; no automatic approval. Uses approved Cadence V1 visual and interaction standard; avoids one-off styling or inaccessible controls.
- **Open/inspect:** `apps/web/src/features/workspace/WorkspaceShell.tsx`; `+apps/web/src/features/decisions/DecisionRegister.tsx`.

#### CAD-WP-040 - Normalised pasted-text Decision intake

- **Bounded effort:** 3 agent-hours; **risk tier:** AUTO; **dependencies:** CAD-WP-036, CAD-WP-039, CAD-WP-061.
- **Deliverable:** Enter, edit/confirm and save text source consistently across input methods.
- **Acceptance:** Pasted content is processed through transient extraction and normalised Decision intake; no automatic authoritative decision and no raw-content persistence.
- **Open/inspect:** `+apps/web/src/features/decisions/DecisionTextInput.tsx`; `+apps/api/src/modules/decisions/decision-source.service.ts`.

#### CAD-WP-041 - Text transcript import parser

- **Bounded effort:** 3 agent-hours; **risk tier:** AUTO; **dependencies:** CAD-WP-040.
- **Deliverable:** Parse .txt/.md/.vtt/.srt imported transcripts through the same transient normalisation interface, without persistent document upload.
- **Acceptance:** Valid samples produce correct text and source offsets for extraction; malformed/untrusted input bounded; transient raw input is removed after extraction attempt.
- **Open/inspect:** `+apps/web/src/features/decisions/TranscriptImport.tsx`; `+apps/api/src/modules/decisions/transcript-parser.ts`.

#### CAD-WP-042 - Grounded AI Decision extraction

- **Bounded effort:** 5 agent-hours; **risk tier:** AUTO; **dependencies:** CAD-WP-017, CAD-WP-038, CAD-WP-040, CAD-WP-065, CAD-WP-066.
- **Deliverable:** Extract zero/one/many agreed Decisions from bounded source text; do not treat suggestions as decisions.
- **Acceptance:** Grounded model extracts zero/one/multiple Decision proposals with status, reason and uncertainty; does not fabricate approval; passes source-safe transient-input and organisation-budget tests.
- **Open/inspect:** `+apps/api/src/modules/decisions/decision-extraction.service.ts`; `apps/api/src/modules/team-agent/team-agent.service.ts`.

#### CAD-WP-043 - End-to-end transcript/text Decision approval

- **Bounded effort:** 4 agent-hours; **risk tier:** AUTO; **dependencies:** CAD-WP-039, CAD-WP-041, CAD-WP-042, CAD-WP-061, CAD-WP-066.
- **Deliverable:** Join text/import->AI proposals->authorised review->Decision Register->source.
- **Acceptance:** 5-project-compatible flow covers paste and supported transcript file, AI candidate, human edit/reject/confirm, register/provenance; verify no retained raw transcript in DB, files, logs and backup.
- **Open/inspect:** `+apps/web/src/features/decisions/DecisionRegister.tsx`; `apps/api/src/modules/audit/audit.routes.ts`.

#### CAD-WP-044 - Audio fast feasibility, consent/privacy gate

- **Bounded effort:** 2 agent-hours; **risk tier:** SPONSOR; **dependencies:** CAD-WP-017, CAD-WP-040.
- **Deliverable:** Time-box audio only if provider, consent, file limits and remaining delivery capacity are proven.
- **Acceptance:** GO or DEFERRED_BY_CAP; no new feature scope or date change; prerequisites verified.
- **Open/inspect:** `+docs/decisions/audio-feasibility.md`; `apps/web/src/features/workspace/WorkspaceShell.tsx`.

#### CAD-WP-045 - Browser Start/Stop/preview capture

- **Bounded effort:** 3 agent-hours; **risk tier:** AUTO; **dependencies:** CAD-WP-044.
- **Deliverable:** Capture short audio within explicit size/duration limits, only with consent.
- **Acceptance:** Start/stop/preview/discard, permission denied and browser unsupported tests.
- **Open/inspect:** `+apps/web/src/features/decisions/AudioRecorder.tsx`; `apps/web/src/lib/api.ts`.

#### CAD-WP-046 - Server transcription adapter and disposal

- **Bounded effort:** 4 agent-hours; **risk tier:** REVIEW; **dependencies:** CAD-WP-044, CAD-WP-017.
- **Deliverable:** Transcribe bounded server-uploaded audio, discard raw media and return editable text.
- **Acceptance:** Credentials server-side, file validation, retention/consent, failures and disposal tests.
- **Open/inspect:** `+apps/api/src/modules/decisions/transcription.service.ts`; `+apps/api/src/modules/decisions/transcription.routes.ts`.

#### CAD-WP-047 - Audio-to-standard Decision pipeline smoke

- **Bounded effort:** 3 agent-hours; **risk tier:** AUTO; **dependencies:** CAD-WP-043, CAD-WP-045, CAD-WP-046.
- **Deliverable:** Pass the transcript to the same text-source service with no new Decision engine.
- **Acceptance:** Record->transcribe->edit->propose->review works; otherwise audio remains off with recorded deferral.
- **Open/inspect:** `+apps/web/src/features/decisions/AudioRecorder.tsx`; `+apps/web/src/features/decisions/DecisionTextInput.tsx`.

#### CAD-WP-048 - Continuous consumer-provider contract CI

- **Bounded effort:** 4 agent-hours; **risk tier:** AUTO; **dependencies:** CAD-WP-003, CAD-WP-020, CAD-WP-031, CAD-WP-038, CAD-WP-043.
- **Deliverable:** Complete integrated consumer-provider CI, extending the early contract checks established in CAD-WP-003.
- **Acceptance:** Cross-packet provider/consumer tests run with every affected PR from the first connector onwards; representative renamed fields and missing endpoints fail the gate; end-to-end integrated tests pass.
- **Open/inspect:** `api/Cadence_v0.1_openapi.yaml`; `.github/workflows/quality.yml`.

#### CAD-WP-049 - Hosted two-session M1 synthetic rehearsal

- **Bounded effort:** 4 agent-hours; **risk tier:** AUTO; **dependencies:** CAD-WP-014, CAD-WP-063, CAD-WP-064.
- **Deliverable:** Prove discussion reload, cross-user refresh, baseline proposal, human approval, Task, Audit and role denial hosted. The M1 rehearsal may use the existing deterministic development proposer when clearly labelled; real LLM acceptance is separately mandatory for V1.0.
- **Acceptance:** Hosted two-session login with configured Entra sign-in, durable Discussion, automatic worker, human Task review and role isolation pass; no passwords local to Cadence.
- **Open/inspect:** `apps/web/src/features/discussion/DiscussionPanel.tsx`; `apps/web/src/features/audit/TaskAuditPanel.tsx`.

#### CAD-WP-050 - Real PostgreSQL negative security regression

- **Bounded effort:** 4 agent-hours; **risk tier:** AUTO; **dependencies:** CAD-WP-024, CAD-WP-028, CAD-WP-031, CAD-WP-038, CAD-WP-064.
- **Deliverable:** Verify privileges across new project/membership/Task/Decision data against real PostgreSQL.
- **Acceptance:** Real PostgreSQL migrations, RLS denials, five-project isolation, SSO identity admission, unapproved-user rejection and Decision role checks verified on disposable database.
- **Open/inspect:** `supabase/migrations/20260808002600_rls.sql`; `tests/schema_smoke.sql`.

#### CAD-WP-051 - Operational logs, support owner and incident runbook

- **Bounded effort:** 3 agent-hours; **risk tier:** AUTO; **dependencies:** CAD-WP-014, CAD-WP-015, CAD-WP-067.
- **Deliverable:** Provide observable support, incident and recovery operations using configurable named primary and backup operators.
- **Acceptance:** Operator assignments are stored outside source code, replaceable by authorised procedure, role separation respected, runbook names active configured contacts and realistic on-call escalation.
- **Open/inspect:** `+docs/operations/SUPPORT.md`; `apps/api/src/worker.ts`.

#### CAD-WP-052 - Independent isolated database restore proof

- **Bounded effort:** 4 agent-hours; **risk tier:** REVIEW; **dependencies:** CAD-WP-007, CAD-WP-051.
- **Deliverable:** Restore selected project records and permissions into isolated target and prove usable recovery.
- **Acceptance:** Backup and isolated restore proof preserves authoritative Decisions/Tasks and operator configuration, but contains no deleted transcript raw payload or AI secrets.
- **Open/inspect:** `supabase/migrations/20260808001000_decisions.sql`; `+docs/operations/RESTORE.md`.

#### CAD-WP-053 - M1 Pilot Activation sponsor GO/NO-GO

- **Bounded effort:** 1 agent-hours; **risk tier:** SPONSOR; **dependencies:** CAD-WP-049, CAD-WP-051, CAD-WP-052, CAD-WP-063, CAD-WP-064, CAD-WP-067.
- **Deliverable:** Authorise exactly one small real-project pilot after safety/restore/support proof.
- **Acceptance:** GO only with hosted SSO, valid configured operator and backup, supervised worker, security, logs and isolated restore; no live project content before gate.
- **Open/inspect:** `docs/milestones/M1_CONTROLLED_PILOT.md`; `+docs/releases/M1_ACTIVATION.md`.

#### CAD-WP-054 - Five-working-day M1 real-user pilot

- **Bounded effort:** 3 agent-hours; **risk tier:** SPONSOR; **dependencies:** CAD-WP-053.
- **Deliverable:** Complete five-working-day controlled M1 use by 5-10 named real users, without routine developer intervention.
- **Acceptance:** Real pilot user evidence covers sign-in, membership, Discussion, deterministic-or-real-labelled Task proposal, review, worker, audit, permissions, restore and support; no false real-AI claim.
- **Open/inspect:** `docs/milestones/M1_CONTROLLED_PILOT.md`; `+docs/releases/M1_PILOT_RESULTS.md`.

#### CAD-WP-055 - Five-project complete-journey company UAT

- **Bounded effort:** 6 agent-hours; **risk tier:** AUTO; **dependencies:** CAD-WP-022, CAD-WP-023, CAD-WP-025, CAD-WP-027, CAD-WP-029, CAD-WP-030, CAD-WP-032, CAD-WP-033, CAD-WP-035, CAD-WP-043, CAD-WP-048, CAD-WP-050, CAD-WP-062, CAD-WP-063, CAD-WP-064, CAD-WP-065, CAD-WP-066, CAD-WP-067.
- **Deliverable:** Complete full company-scale hosted user acceptance: one configured organisation, 5-10 real users, exactly five active test/initial projects, secure SSO and real AI.
- **Acceptance:** All five projects are accessible to authorised members and isolated from others; each demonstrates project navigation, Discussion, AI proposal, human review, manual fallback, Decision from text/transcript, Task updates and Audit. Two or more real users run the complete journey on release-candidate SHA; USD 5 monthly cap and operator handover included.
- **Open/inspect:** `apps/web/src/features/workspace/ProjectWorkspace.tsx`; `+tests/e2e/company-journey.spec.ts`.

#### CAD-WP-056 - Signed V1.0 package, About screen and date controls

- **Bounded effort:** 3 agent-hours; **risk tier:** AUTO; **dependencies:** CAD-WP-016, CAD-WP-035, CAD-WP-061.
- **Deliverable:** Produce signed v1.0.0 package and About screen with true released_at, source copyright notice and HELP academic licence reference.
- **Acceptance:** Package hash matches source/SHA, owner and licence wording documented, application About distinguishes target from verified released date, no implied transfer of HELP data rights.
- **Open/inspect:** `+apps/web/src/features/about/AboutCadence.tsx`; `+.github/workflows/release.yml`.

#### CAD-WP-057 - 16 November release GO/NO-GO

- **Bounded effort:** 2 agent-hours; **risk tier:** SPONSOR; **dependencies:** CAD-WP-048, CAD-WP-050, CAD-WP-052, CAD-WP-054, CAD-WP-055, CAD-WP-056, CAD-WP-063, CAD-WP-064, CAD-WP-065, CAD-WP-066, CAD-WP-067.
- **Deliverable:** Approve exact release candidate and rollback/support condition after all mandatory tests.
- **Acceptance:** Sponsor GO/NO-GO on exact staging SHA includes licence/IP sign-off, Azure SSO live evidence, provider/model, USD 5 cap, transient transcript policy, operators and backup, five projects, 5-10 users and genuine real-user UAT. No waiver of P0/P1.
- **Open/inspect:** `+docs/releases/V1_GO_NO_GO.md`; `docs/governance/CADENCE_REQUIREMENT_TRACEABILITY.md`.

#### CAD-WP-058 - 17 November V1.0 hosted release and verification

- **Bounded effort:** 3 agent-hours; **risk tier:** SPONSOR; **dependencies:** CAD-WP-057.
- **Deliverable:** Deploy signed Cadence 1.0.0 to company target on 2026-11-17 local time.
- **Acceptance:** At least five configured real projects in a single organisation with 5-10 actual SSO users; live web/API, AI, Decisions, Tasks, budget enforcement, operator configuration and restore proven. About shows Released 17 Nov 2026 only after verified deployment.
- **Open/inspect:** `+docs/releases/RELEASE_MANIFEST.json`; `+apps/web/src/features/about/AboutCadence.tsx`.

#### CAD-WP-059 - Ten-working-day post-release real-use acceptance

- **Bounded effort:** 2 agent-hours; **risk tier:** SPONSOR; **dependencies:** CAD-WP-058.
- **Deliverable:** Observe 5+ users, 2+ active projects after V1.0 release and formally accept or block.
- **Acceptance:** 10 full working days, normal business activity, decision import evidence, no routine dev repair; accepted or BLOCKED.
- **Open/inspect:** `+docs/releases/V1_FIELD_ACCEPTANCE.md`; `docs/governance/CADENCE_REQUIREMENT_TRACEABILITY.md`.

#### CAD-WP-060 - Freeze Cadence V1 visual system and screen references

- **Bounded effort:** 3 agent-hours; **risk tier:** SPONSOR; **dependencies:** CAD-WP-001, CAD-WP-007.
- **Deliverable:** Establish Cadence-owned visual direction informed by Plane and Leantime, with design tokens, navigation hierarchy and minimal desktop/mobile representative states.
- **Acceptance:** One sponsor visual direction sign-off from actual Codex-produced screenshots or sketches; versioned token names; mobile/navigation/accessibility checklist; no copied code/brand assets and no scope expansion.
- **Open/inspect:** `apps/web/src/index.css`; `apps/web/src/features/workspace/WorkspaceShell.tsx`; `+docs/design/CADENCE_V1_UI_DESIGN_STANDARD.md`.

#### CAD-WP-061 - Implement refined login and responsive workspace shell

- **Bounded effort:** 5 agent-hours; **risk tier:** AUTO; **dependencies:** CAD-WP-060, CAD-WP-063.
- **Deliverable:** Apply approved styling to login, topbar, navigation, summary panels, typography, spacing, forms and core feedback states. Preserve React and existing business contracts.
- **Acceptance:** Responsive, visually cohesive login and workspace with SSO-only sign-in, project navigation, desktop/mobile accessibility, meaningful error/empty states and no fake release identity.
- **Open/inspect:** `apps/web/src/index.css`; `apps/web/src/features/auth/LoginScreen.tsx`; `apps/web/src/features/workspace/WorkspaceShell.tsx`; `apps/web/src/features/workspace/ProjectWorkspace.tsx`.

#### CAD-WP-062 - Confirm V1 visual consistency and usability

- **Bounded effort:** 3 agent-hours; **risk tier:** REVIEW; **dependencies:** CAD-WP-061, CAD-WP-025, CAD-WP-027, CAD-WP-029, CAD-WP-030, CAD-WP-032, CAD-WP-035, CAD-WP-039, CAD-WP-040, CAD-WP-043.
- **Deliverable:** Review representative actual V1.0 screens and their key interactive states for visual cohesion, easy navigation and nontechnical usability; repair only scoped visual defects.
- **Acceptance:** Actual browser screenshots and interactive sessions show Azure login (Google alternative config), five projects, Task manual create, AI quota fallback, Decision text/transcript, About/copyright, accessible desktop/mobile. No blocking UX defect.
- **Open/inspect:** `apps/web/src/index.css`; `apps/web/src/features/workspace/WorkspaceShell.tsx`; `apps/web/src/features/team-agent/ProposalReviewPanel.tsx`; `+docs/design/V1_UI_VISUAL_ACCEPTANCE.md`.

#### CAD-WP-063 - Configurable Entra ID and Google OAuth sign-in

- **Bounded effort:** 5 agent-hours; **risk tier:** REVIEW; **dependencies:** CAD-WP-003, CAD-WP-007.
- **Deliverable:** Replace Cadence email/password UI with configured Microsoft Entra or Google OAuth through existing Supabase Auth; HELP selects Entra tenant.
- **Acceptance:** Both provider adapters/configs and redirect allowlists verified with mocked flow; HELP Entra live login evidenced with approved tenant and identity-provider credentials; no local Cadence password and no unknown-account automatic access.
- **Open/inspect:** `apps/web/src/features/auth/useAuth.ts`; `apps/web/src/features/auth/LoginScreen.tsx`; `apps/web/src/lib/supabase.ts`; `+apps/web/src/lib/identity-providers.ts`.

#### CAD-WP-064 - SSO Person mapping, tenant restriction and revocation

- **Bounded effort:** 5 agent-hours; **risk tier:** REVIEW; **dependencies:** CAD-WP-003, CAD-WP-007, CAD-WP-063.
- **Deliverable:** Map approved OAuth subjects to stable Cadence Person/memberships; enforce organisation/tenant allowlist and denial/revocation without altering Person history.
- **Acceptance:** Valid tenant identity admitted only when authorised; matching emails alone never grant project authority; disabled membership/identity denied immediately; switching allowed providers does not change canonical Person or owner/sponsor/manager history.
- **Open/inspect:** `apps/api/src/infrastructure/auth/supabase-auth-provider.ts`; `apps/api/src/modules/identity/identity.service.ts`; `apps/api/src/infrastructure/database/supabase-identity-persistence.repository.ts`; `apps/api/src/modules/project-membership/project-authorisation.service.ts`.

#### CAD-WP-065 - Configurable monthly organisation AI cap

- **Bounded effort:** 5 agent-hours; **risk tier:** REVIEW; **dependencies:** CAD-WP-003, CAD-WP-007, CAD-WP-017.
- **Deliverable:** Enforce USD 5 calendar-month organisation-wide usage ceiling across Task/Decision/summary AI requests, with atomic cost reservations and safe cutoff.
- **Acceptance:** Five-project concurrent requests cannot overspend estimated cost envelope; in-app ledger and usage notifications work; requests fail closed before quota exhaustion, manual flows remain usable; provider OpenAI project hard spend limit is configured where available with a margin for delayed billing; budget editing audited.
- **Open/inspect:** `apps/api/src/modules/team-agent/team-agent.service.ts`; `apps/api/src/infrastructure/database/supabase-team-agent.repository.ts`; `+apps/api/src/modules/ai-budget/ai-budget.service.ts`; `+supabase/migrations/AI_BUDGET_PLACEHOLDER.sql`.

#### CAD-WP-066 - Transient transcript intake and deletion

- **Bounded effort:** 4 agent-hours; **risk tier:** REVIEW; **dependencies:** CAD-WP-017, CAD-WP-036, CAD-WP-041.
- **Deliverable:** Process text/transcript in bounded temporary memory, extract structured candidates, discard full raw text promptly, retain approved derived Decision evidence only.
- **Acceptance:** Success, rejection, timeout and failure paths remove raw source; raw is absent from persistence, logs, files, crash outputs and backups; provider requests request non-storage where supported; help/privacy notice differentiates app deletion from external provider retention.
- **Open/inspect:** `+apps/api/src/modules/decisions/transcript-intake.ts`; `+apps/api/src/modules/decisions/transcript-retention.test.ts`; `supabase/migrations/20260808001000_decisions.sql`.

#### CAD-WP-067 - Configurable primary and backup operator roles

- **Bounded effort:** 4 agent-hours; **risk tier:** REVIEW; **dependencies:** CAD-WP-003, CAD-WP-007, CAD-WP-064.
- **Deliverable:** Allow authorised assignment/replacement of named primary and backup operators and contact routes without application code changes; preserve least privilege.
- **Acceptance:** Operator can be replaced by approved administrative action/config, auditable Person identity, no hard-coded email or personal laptop path, no global project-reader access, operator support handover proven.
- **Open/inspect:** `apps/api/src/modules/identity/identity.types.ts`; `apps/api/src/modules/project-membership/project-permissions.ts`; `+apps/api/src/modules/operations/operator-config.ts`; `+docs/operations/OPERATOR_ASSIGNMENT.md`.

#### CAD-WP-068 - Bounded overnight Codex runner on Windows laptop

- **Bounded effort:** 5 agent-hours; **risk tier:** REVIEW; **dependencies:** CAD-WP-004, CAD-WP-005, CAD-WP-006.
- **Deliverable:** Run eligible approved work packets continuously on powered, networked laptop, preserving fixed packet scope, remote checkpoints and safe stop/resume.
- **Acceptance:** Runner auto-selects only eligible contract packets; verifies repo/account/worktree and lease; applies time/attempt/credential/CI/merge gates; restarts safely after simulated interruption; emits end-of-run status and blocks privileged actions, hosted deployments and new scopes until approvals.
- **Open/inspect:** `+tools/cadence-unattended.ps1`; `+tools/cadence-runner-status.ps1`; `+docs/development/OVERNIGHT_RUNNER.md`.


## 7. Fixed release calendar, overnight capacity and truthful forecast

**17 November 2026 is the fixed product release date, not merely a code-complete date.** This is an aggressive schedule. A secure NO-GO is mandatory if the agreed product cannot be verified, never a fictional Released label. The calendar assumes an unattended Windows runner *after* it passes its own safety acceptance; it does not magically increase productive hours.

| Date (MYT) | Mandatory decision or result |
|---|---|
| **14 October** | Begin one serial coding agent, baseline and governance freeze; start legal/IP confirmation and HELP Entra app registration request immediately |
| **20 October** | Actual accepted-packet throughput, remote PAUSE/RESUME proof, Entra provider readiness and first hosting/AI budget evidence; independently reforecast date |
| **21 October or later** | Enable second coding agent **only after all stability gates AND WP-068 unattended runner are accepted**; no date-based waiver |
| **23 October** | One visual system approved; provider/identity/cost/transcript interfaces must be pinned |
| **28 October** | Preferred controlled M1 pilot activation, after hosted SSO, worker, logs and recovery pass |
| **2 November** | Latest planned five-working-day M1 pilot activation; later requires RED escalation |
| **6 November** | Five-project company functionality integrated or RED; conditional audio automatically deferred unless ahead |
| **9 November** | Kuala Lumpur/Selangor observed holiday assumption; unattended work may proceed but **do not depend on a human approval** |
| **10 November** | Mandatory feature and UI code freeze, only release-blocker corrections after |
| **11-13 November** | Security, 5-10 real-user/5-project integrated UAT, Entra sign-in, AI monthly cap, transcript non-retention, visual/accessibility and recovery proof |
| **16 November** | Human GO/NO-GO on exact release SHA, source licence, operating identity and accepted evidence |
| **17 November** | GO => deploy and verify `Cadence v1.0.0`; About displays **Released 17 November 2026** only after proof |
| **After release** | WP-059 ten genuine working days' observation, support records and independent later acceptance |

**Updated pre-freeze workload:** 63 mandatory packets, 236 proposed focused agent-hours, plus 12 optional audio hours and 2 recorded post-release review hours. These estimates are not throughput measurements and exclude calendar waiting/real-user pilot duration.

**Laptop-continuous planning sensitivity (not guaranteed output):** From **14 October through 9 November**, there are **27 calendar dates** before the 10 November code freeze. If one lane runs for the first seven calendar days and a safe second lane becomes available for the next 20 calendar days, the theoretical ceiling is **47 lane-days**. That yields **188 / 282 / 376 accepted-agent-hours** at an actual, independently measured **4 / 6 / 8 effective hours per lane-calendar-day** respectively. The six-hour case may provide useful capacity, but the four-hour case falls short even before accounting for rework. The calendar also contains non-compressible human/provider gates and the five-workday pilot. The release is therefore **HIGH RISK until accepted throughput is proved**.

**Required forecast method:** Track 24-hour *accepted and merged* packet completion, not active Codex run time, token count, or merely green local tests. Publish daily: accepted count, remaining effort, throughput by lane, critical-path finish, unresolved external Entra/legal/provider gates, pause checkpoint SHA, remaining run budget, pilot days available, support/operator status and slack to 10/16/17 November. Forecast `RED` immediately if a mandatory gate cannot meet its calendar, not after November 10.

### Baseline estimate by phase

| Phase | Packets | Estimated agent-hours |
|---|---:|---:|
| F0 - Foundation, governance and recovered baseline | 8 | 30 |
| FSSO - Federated sign-in and stable identity | 2 | 10 |
| F1 - Runtime and hosting | 8 | 30 |
| FAI - AI organisation spending protection | 1 | 5 |
| F2 - Real AI and action workflow | 7 | 25 |
| F3 - Self-service company product | 12 | 43 |
| F4 - Decisions from text and transcript | 8 | 32 |
| FPRIV - Transient transcript protection | 1 | 4 |
| FOPS - Configurable application operators | 1 | 4 |
| FDEVOPS - Bounded overnight coding runner | 1 | 5 |
| F4A - Conditional audio - never release-blocking | 4 | 12 |
| FUI - V1.0 visual system and visual acceptance | 3 | 11 |
| F5 - Integration, real users, release and acceptance | 12 | 39 |
| **Total** | **68** | **250** |

**Scope protection:** During an overrun, conditional audio is deferred first. No source rights, SSO, required AI budget control, transcript deletion, operator configurability, essential manual functions, RLS, backup or release integrity may be waived. Nonessential post-release enhancements remain on the governed roadmap. No agent may invent work packets or alter 17 November.

## 8. Product version and visibly dated release (required)

**Released product identity:** `Cadence V1.0` / `1.0.0`. The UI must present the version and true release date in an **About** entry or footer and make the exact build fingerprint available in an admin-visible view. Release metadata must contain:

```json
{
  "product": "Cadence",
  "version": "1.0.0",
  "release_date": "2026-11-17",
  "time_zone": "Asia/Kuala_Lumpur",
  "git_commit": "<actual immutable release SHA>",
  "release_tag": "v1.0.0",
  "released_at": "<actual verified deployment timestamp>",
  "deployment_target": "<approved non-secret target identifier>",
  "contract_version": "1.8",
  "packet_register_sha256": "<verified digest>"
}
```

Prior to actual release the About page may display `Cadence V1.0 Release Candidate — Target: 17 November 2026`; it must **not** display `Released 17 November 2026` as an accomplished fact. The tag `v1.0.0`, release notes, changelog, allow-listed package contents, source SHA, migrations and accepted tests must match the live deployment. The final state changes only after the named owner verifies the live environment on **17 November local time**. A failed deployment cannot masquerade as a dated release.

**Release checkpoint:** 16 Nov signed GO; 17 Nov deploy, verify Entra login (Google provider configurable), five project creations/switches and access isolation, 5-10 users, Discussion->Luna Medium AI->Task, manual Task path, text/transcript Decision->approval with raw deletion, USD 5 monthly quota, configurable support, scheduler and recovery; record the URL, SHA and actual released_at time.

## 9. Immutable interfaces and automatic cross-packet integration

Freeze an interface catalogue from `api/Cadence_v0.1_openapi.yaml`, existing service/type names, real migration constraints, browser DTOs and worker event consumers before parallel coding. Every new DecisionSource/DecisionProposal payload, Task update, internal invite and project-navigation DTO receives one owner and named downstream consumer. A packet may not unilaterally change shared public field names, events, permissions, routes, database columns, configuration keys or model output schemas; a private variable rename is allowed. Shared symbols must have versioned/compatible changes with actual consumer tests.

**Minimum connector paths:** configured Entra/Google OAuth->Supabase session->Cadence Person->membership; browser->API->project/membership persisted state; Discussion->event->worker->AI->Task proposal->human review->Tasks->Audit; text/transcript->transient normalisation->AI quota reservation->Decision proposal->raw deletion->human approval->Decisions register->derived source evidence; Task update->My Tasks/project overview; deployment->config->hosted worker and release identity. All have integration tests; mocks alone do not close the contract.

`main` stays in buildable condition. Central merges are sequential even when coding is concurrent. Each PR must run impacted real API/consumer tests, typecheck, frontend build and the existing `npm run quality`. Hosted smoke and real DB tests are required for relevant risk tiers. One intentionally renamed DTO / missing endpoint should cause CI failure as a compatibility self-test.

## 10. Human attention and risk decisions

The proposed register classifies **36 AUTO**, **23 REVIEW** and **9 SPONSOR** packets. Even REVIEW/SPONSOR packets use autonomous coding and automated evidence preparation; the human intervenes only for the specified privileged decision or acceptance.

`AUTO`: routine isolated code, tests, approved API usage, candidate PR and guarded merge once enforced policy is proven. `REVIEW`: autonomous implementation with human authorisation for security, schema/RLS, privileged environment, user-data/AI sharing or migration-risk changes. `SPONSOR`: frozen scope, hosting primary/fallback choice, audio consent/protection, pilot activation, final release and business acceptance. A single human developer is not the independent verifier; automated source-SHA checks and real runtime/database tests are the default routine validation.

No P0/P1 may be waived, no production/student/staff data accessed without approved authority, no unrelated new features, no extra pipeline infrastructure, no blanket admin GitHub token and no merge on a stale approval. A packet blocked by an interface or environment defect may only produce a bounded remediation and recorded GO/NO-GO decision, not a new vertical slice.

## 11. Existing draft v1.5 to granular v1.6 mapping

Every original `CAD-R01...CAD-R30` scope is reconciled below; numbering is replaced because **the former register was unapproved and no execution issue is assumed to exist**. This is a traceability map, not a new feature.

| Old draft | New packets |
|---|---|
| CAD-R01 | CAD-WP-001, CAD-WP-003, CAD-WP-004, CAD-WP-005, CAD-WP-006 |
| CAD-R02 | CAD-WP-002, CAD-WP-003 |
| CAD-R03 | CAD-WP-007, CAD-WP-003, CAD-WP-006 |
| CAD-R04 | CAD-WP-008 |
| CAD-R05 | CAD-WP-009 |
| CAD-R06 | CAD-WP-010, CAD-WP-011 |
| CAD-R07 | CAD-WP-012 |
| CAD-R08 | CAD-WP-013 |
| CAD-R09 | CAD-WP-014 |
| CAD-R10 | CAD-WP-017 |
| CAD-R11 | CAD-WP-018, CAD-WP-019 |
| CAD-R12 | CAD-WP-020 |
| CAD-R13 | CAD-WP-021 |
| CAD-R14 | CAD-WP-023, CAD-WP-049 |
| CAD-R15 | CAD-WP-051, CAD-WP-015 |
| CAD-R16 | CAD-WP-052 |
| CAD-R17 | CAD-WP-053 |
| CAD-R18 | CAD-WP-054 |
| CAD-R19 | CAD-WP-024, CAD-WP-025 |
| CAD-R20 | CAD-WP-026, CAD-WP-027 |
| CAD-R21 | CAD-WP-028, CAD-WP-029, CAD-WP-030 |
| CAD-R22 | CAD-WP-031, CAD-WP-032, CAD-WP-033 |
| CAD-R23 | CAD-WP-036, CAD-WP-037, CAD-WP-038, CAD-WP-039 |
| CAD-R24 | CAD-WP-040, CAD-WP-041, CAD-WP-042, CAD-WP-043 |
| CAD-R25 | CAD-WP-044, CAD-WP-045, CAD-WP-046, CAD-WP-047 |
| CAD-R26 | CAD-WP-022 |
| CAD-R27 | CAD-WP-034, CAD-WP-035 |
| CAD-R28 | CAD-WP-048, CAD-WP-050, CAD-WP-055, CAD-WP-056 |
| CAD-R29 | CAD-WP-057, CAD-WP-058 |
| CAD-R30 | CAD-WP-059 |

### v1.7 to v1.8 explicit change register

This is a **pre-approval contract revision**, not an agent-initiated mid-release scope change. Existing packets 001/003/017/021/023/028/029/031/032/036/038/040-043/048-058/061-062 have precise acceptance amendments in Section 6. Exactly **six** newly numbered packets are WP-063 Entra/Google sign-in, WP-064 Person identity mapping, WP-065 USD 5 budget, WP-066 transient transcript disposal, WP-067 configurable operators, and WP-068 bounded unattended runner. No further packet is authorised without a new signed contract.

**Critical external prerequisites:** a HELP Entra application registration and its tenant ID/callback approvals, configured Supabase Auth provider credentials, a billed OpenAI project/API key and verified spend-limit settings, an approved Cadence source/licensing arrangement, operational hosted database and application domains, and 5-10 named pilot users. Human consent and institutional authorisation are gates, **not** autonomous coding tasks.

## 12. Effectiveness, repository state and approval

**Sponsor scope freeze was authorised on 13 October 2026.** The immutable 68-packet register is authoritative; product release, signed intellectual-property and HELP licence terms, Entra registration, provider credentials, live infrastructure and operator assignments **remain separate unfulfilled acceptance gates**. CAD-WP-001 itself is not marked ACCEPTED by merely producing this freeze file. The repository has not been mutated by generating the local file; any governance PR and subsequent acceptance must be recorded independently. GitHub branch rules and unattended merge rights must be verified before autonomous merging.

Sponsor approval of this scope freeze does not waive authorised GO gates, historical obligations, security reviews or truthful release evidence. After approval, the **fixed register digest** is the machine-readable source of truth for agent dispatch. It may be substituted or expanded only by a visible sponsor-approved contract revision that preserves the **17 November** release decision and explains capacity, acceptance and scope impacts.


---

## 13. AUTHORITATIVE FREEZE ADDENDUM — 13 October 2026 (v1.8.0)

The sponsor has approved **freezing the 68-packaged V1.0 scope**, not the assertion that any work packet has already been completed. This addendum prevails over references elsewhere in this historical contract to `DRAFT`, pending review, or future scope approval. It does **not** execute a HELP institutional licence, prove employment IP entitlement, grant credentials, activate production or waive any human GO/NO-GO.

- **Immutable canonical work register:** `CADENCE_V1_0_FROZEN_PACKET_REGISTER_v1_8_0.json` SHA-256 `1c6f415b36e90ca4d5320bfdc49f0abbdaec6beec70a576f3cbb68ae18f06080`; **68 unique IDs, 63 mandatory before release, 4 conditional audio, 1 post-release acceptance**. No IDs, dependencies, estimated efforts, acceptance conditions or product requirements have been added to/removed from the original 1.8 packet list. These package definitions are now locked. Only the explicit metadata controls changed in the JSON.
- **Workload baseline:** **236 registered agent-hours mandatory**, including **19 hours assigned to SPONSOR-risk packets (these include work/evidence and human decisions, not uninterrupted AI coding)**. Optional audio = 12h (default `DEFERRED_BY_CAP`); post-release WP059 = 2h administration **plus ten full working days**; all registered hours = 250h. **Before 10 November feature freeze:** 231 mandatory registered hours excluding only WP057 and WP058; front-loaded user pilot and real UAT also consume non-compressible calendar time.
- **Optimistic structural longest dependency chain:** 62 agent-hours through `CAD-WP-001 > CAD-WP-002 > CAD-WP-003 > CAD-WP-063 > CAD-WP-061 > CAD-WP-027 > CAD-WP-039 > CAD-WP-040 > CAD-WP-041 > CAD-WP-066 > CAD-WP-042 > CAD-WP-043 > CAD-WP-048 > CAD-WP-055 > CAD-WP-057 > CAD-WP-058`. This assumes all dependent work can be instantly scheduled and ignores code review, sponsor availability, five working-day M1 pilot, infrastructure approvals and conflicts. Do not use this as a release duration estimate.
- **Governing release target:** live, genuinely used **Cadence V1.0 on 17 November 2026**, GO/NO-GO 16 November 2026, company use at HELP for 5–10 users and 5 projects. The source owner is intended to be Ngoh Chee Hung and HELP a royalty-free academic licensee, **but legal/employment rights and written institution licence are independent release gates, not assumed signed by this freeze**.
- **Work packet containment rule:** Every defect, new connector, variable mismatch, SSO callback, retention/privacy path, manual fall-back, test fixture or admin/recovery omission uncovered before acceptance must be traced to an **existing** owner packet and resolved within its stated product/contract outcome and bounded remediation rule. It never auto-creates a new ID or feature. If the assigned packet cannot meet the agreed outcome, mark `BLOCKED` and escalate with objective evidence and choices. Sponsor-only written *replacement contract version* is the sole mechanism to substitute/re-scope work, preserving underlying parent/child commitments and a truthful forecast.
- **Release validation, not number of merges:** A packet is accepted only against exact merged SHA, independently inspectable CI/test evidence, compatibility with current accepted `main`, and a signed machine-readable acceptance record. Later integration breaks reopen the defective packet as a regression; they do not create a new project. R003 establishes consumer/producer test contracts early; R048 verifies them comprehensively (it must not be the first time connectors are checked).
- **First execution stage:** one coding writer, one work packet; full safe PAUSE/RESUME and target-authority checks. Second writer only after three consecutive accepted engineering packets **and** accepted WP003/004/005/006/007/068, separate worktree, non-overlapping owned paths, a single serial integration queue, no P0/P1, and explicit sponsor consent.
- **Unattended control:** Overnight runtime may process *only* approved, ready packets within credential/timeout/CI/permitted-file limits. No privileged environment mutation, release, approval, scope change or unsafe bypass without human authority. Uptime is not accepted throughput; daily trend uses accepted, merged packet evidence.
- **Real-life continuity:** WP032 includes manually creating Tasks while AI is unavailable; WP063/064 include approved SSO recovery via provider and revocation; WP041/066 must never retain full imported transcripts; WP055 requires **at least two real human users** performing the whole five-project release-candidate journey, not a test-only workflow; WP067 makes the application operator and backup operator configurable and audited.
- **UI/design boundary:** WP060 freezes one approved style. New screen packets consume it; no UI migration or new platform scope. WP062 signs off actual interactive app screens before GO.
- **Money and models:** Initial `gpt-6-luna`, `reasoning.effort=medium` (must be validated using the authorised OpenAI project in WP017); $5/month organisation-wide application cap including all five projects, with fail-closed reservations and manual fallback; no Codex developer token budget counted in it. Provider-side retention obligations are separately disclosed.
- **External release preconditions, not separate work packets:** HELP written academic licence/IP authority; Entra registration, tenant scope and authorised pilot identities; AI credentials and spend policy; isolated Supabase target and hosted runtime; qualified primary/backup support operators. Lack of these must appear as an early dated `BLOCKED_EXTERNAL` record rather than hidden engineering hours.
- **Forecast controls:** Report 24h accepted throughput, actual owner utilisation, single/two lane stability, long-chain completion, external gates, five-day pilot date, 10 Nov code-freeze slack and 17 Nov release slack daily. **Do not credit unattended hours, provisional PRs or simulated green checks as completion.** Any failure of critical path triggers RED and the smallest possible decision; audio is dropped first. Mandatory security, identity, privacy, correct data and truthful release cannot be waived by an agent.
- **Release identity:** `Release Candidate — Target 17 November 2026` until successful deployment and live verification. If mandatory conditions fail: honest `NO-GO` on 17 Nov, never a fake `Released` message or unsafe go-live. The sponsor controls any superseding contract and re-baselining.

### 13.1 Pre-freeze completeness mapping (no additional work packets)

| Release obligation | Existing owner packets | Frozen test of completeness |
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

### 13.2 Dated execution checkpoints

| Date (MYT) | Required evidence | Failure treatment |
|---|---|---|
| 13 Oct | Sponsor freezes 68 scope IDs and 17 Nov objective; snapshot/checksum available | This does not mark WP001 accepted without its evidence |
| 16 Oct | Confirm written owner/IP/licence pathway, Entra applicant and tenant credentials owner, AI project access, cloud/beta target and HELP pilot participants | Any missing external authorisation is immediately `BLOCKED_EXTERNAL` with named owner |
| 20 Oct | WP003–007/068 safety, acceptance throughput and real checkpoint recovery reviewed; projected feasibility of second lane | Keep single writer and issue an objective RED forecast if gate not proven |
| 23 Oct | Hosting path, AI integration proof and approved initial visual style | Escalate any critical-path provider mismatch; do not investigate third hosting route |
| 28 Oct | Target hosted M1 activation, backup/support and current pilot workflow | If not ready, prepare November 2 latest start; do not fabricate pilot results |
| 2 Nov | Latest planned M1 activation for a five-working-day pilot ending 10 Nov (9 Nov holiday assumed) | Past this date 17 Nov is RED unless sponsor explicitly resolves sequencing without waiving real-user days |
| 6 Nov | Full 5-project journey integrated; optional audio auto-deferred unless core comfortably GREEN | All core connector failures belong to existing producer/consumer packets |
| 10 Nov | Mandatory feature/UI code freeze on integrated release candidate | Only release-blocking defects, proven in-scope, may be fixed; no new features |
| 11–13 Nov | Real Entra sign-in, 5-project/2-user UAT, AI and manual fallback, privacy/quota, operator/restore/security/UI proof | Block GO on unresolved P0/P1 or missing critical journey |
| 16 Nov | Signed exact-SHA and HELP legal/operational GO/NO-GO | Only human can authorise release |
| 17 Nov | Deploy and verify `v1.0.0` in live HELP-approved environment; About date becomes actual only on successful release | NO-GO if unsafe/incomplete, no false release badge/date |
| Postrelease | WP059 ten working days of observation and field acceptance | Not falsely counted as complete on release day |

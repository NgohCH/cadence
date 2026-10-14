# Cadence copyright and HELP academic licence — draft

Status: **DRAFT FOR LEGAL/IP AND INSTITUTIONAL REVIEW — NOT EXECUTED**

Prepared for CAD-WP-001 dependency-clearance review, 14 October 2026.

Frozen scope: v1.8.0; 68 packets; release target 17 November 2026.

## Intended ownership; authority not established

The frozen V1.0 contract identifies **Ngoh Chee Hung as the intended owner**
of Cadence source code, design and release rights, subject to employment,
commissioning, contractual and other applicable IP rights. Authorship,
repository control, a copyright notice or sponsor scope approval does not
establish the necessary ownership or authority to license.

No employment agreement, institutional IP policy, assignment, waiver or legal
conclusion has been verified by this checkpoint. An authorised legal/IP
reviewer must establish the applicable rights and any required consent or
assignment before confirming ownership or approving a licence.

Proposed notice for later review: **Copyright © 2026 Ngoh Chee Hung, subject
to confirmed rights.** This is proposed wording, not a release notice or a
representation that rights have been confirmed.

## Proprietary first-party metadata; historical rights review

The Project Owner has explicitly selected **proprietary Cadence software**.
Root `package.json` and `apps/api/package.json` now declare
`"license": "UNLICENSED"` and `"private": true`; their lockfile root package
entries declare UNLICENSED consistently. The web manifest remains unchanged
with its existing `private: true`. Third-party component licences and
lockfile entries are unaffected.

HELP University remains the intended **non-exclusive, royalty-free
academic/institutional licensee under a separate written grant**. UNLICENSED
metadata is the first-party policy declaration, not that institutional grant
or confirmation of the intended owner's employment/IP rights.

[npm's package metadata guidance](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#license)
supports UNLICENSED and the private flag for this declaration and accidental
npm-publication prevention. These flags do not change repository visibility,
establish ownership or execute a licence.

At main `1058a0d96385a26630c5a9193dca6cffd4027458` and the original PR #12
head `ff414c5b1c8e759e7d6af9ad16595b2f4455c3af`, root/API metadata declared
ISC. **Historical ISC declarations, publication history, contribution terms
and any valid past grants still require legal review. Changing metadata does
not retroactively revoke rights.** This correction does not purport to revoke
an independently valid grant, rewrite that history or grant rights over
third-party materials. Ownership, authority and final HELP signing remain
pending as described below.

## Proposed non-exclusive, royalty-free academic licence

The following is a **proposed term sheet only**. It grants no present right
and is not an executed agreement.

| Term | Proposed boundary for legal and institutional approval |
|---|---|
| Parties | Confirmed rights holder(s) as licensor; the verified legal entity operating HELP University as licensee. Entity details and signatory authority remain to be established privately. |
| Grant | Non-exclusive, royalty-free institutional academic-use licence to use Cadence for HELP teaching, research, academic collaboration and related internal administration. |
| Permitted acts | Within the agreed academic scope, install, host, run and reproduce necessary build/deployment/backup copies; source access and internal maintenance/adaptation only as expressly covered by the final written grant. |
| Users and growth | Approved HELP users and authorised support operators under HELP's controls. Five initial projects and 5–10 users are acceptance evidence, not licence/product caps. |
| Consideration | No source-code royalty for the agreed academic use. Hosting, support and AI/provider costs are separate; the frozen product-AI controls still apply. |
| Reserved rights | No implied sale, commercial third-party service, redistribution, sublicensing or transfer of Cadence ownership. Commercial and third-party reuse rights remain with their actual rights holders except for independently valid grants or applicable law. |
| Ordinary academic activity | HELP's tuition-funded teaching/research is intended to fall within academic use; the precise scope and any commercial research boundary require institutional legal agreement. |
| Support/contractor access | Any access or operation by a service provider must be expressly authorised under the final licence, confidentiality and data arrangements; no blanket onward grant is created here. |
| Third-party materials | Dependency/component/provider licences and notices retain their own force. Cadence cannot grant rights it does not hold; required permissions and compatibility must be verified. |
| Duration and exit | Term, termination/notice, return/export of HELP data and permitted continuity/recovery copies require express final terms. No destructive data action or indefinite support promise is authorised by this draft. |
| Final provisions | Effective date, supported release/source pin, governing law, dispute process, warranties, liability and any obligations on maintenance/improvements require qualified review and agreement. None is settled here. |

## HELP institutional data ownership and control

The intended institutional arrangement preserves HELP's ownership/control of
its project content and operational records, subject to individuals' and
third parties' rights and applicable law. HELP determines authorised purposes,
users, operators, access, lawful retention/deletion, disclosure and transfer
of its institutional data. No personal claim over HELP data follows from
intended ownership of Cadence code.

The final agreement must identify data-controller/operator and processor
responsibilities, approved hosting/provider arrangements, privacy/incident
reporting, lawful export/deletion and an administrator transfer path.
Source access or copyright ownership never confers automatic project access.
Project permissions, history, audit, provenance and module ownership remain
mandatory. Live sensitive content or external AI data sharing requires its
separate authorised approval. Native Discussion retention and the frozen
transient-transcript disposal rule remain distinct and unchanged.

## Legal authority and signing gates

| Gate | Required human evidence | Present status |
|---|---|---|
| Draft review | Named authorised reviewer considers this term sheet and the frozen ownership/data boundaries at an exact PR/source SHA; records issues and required revisions. | PENDING |
| Legal/IP authority checkpoint | Documented employment/commissioning/IP review and chain of title; necessary consents/assignments or other authority; disposition of ISC/publication/contribution/third-party rights. A receipt of the draft alone is insufficient. | PENDING |
| CAD-WP-001 governance acceptance | Sponsor verifies the frozen scope/date, draft terms, completed legal/IP authority checkpoint and required signed scope evidence, then records a separate exact-SHA packet decision. | PENDING — not accepted |
| Final HELP licence execution | Confirmed rights holder(s) and authorised institutional signatory agree final terms and execute/acknowledge the written institutional licence; record effective date, source/release coverage and data/operator conditions. | PENDING — required before real HELP deployment |
| Live-operation/release authority | Existing pilot/release GO gates, privacy/data-sharing, identity, safety and operational conditions pass separately. | PENDING — no activation or release granted |

A draft/legal review checkpoint and an executed institutional licence are
different evidence. The frozen CAD-WP-001 acceptance calls for **draft terms
and a legal/IP authority checkpoint**, not a fabricated institutional signature.
The final executed HELP licence remains an independent live-deployment gate.
Neither distinction permits accepting CAD-WP-001 while its required authority
checkpoint is unresolved, or dispatching CAD-WP-003 without its accepted
CAD-WP-001/CAD-WP-002 dependencies.

Private employment documents, personal details and executed legal instruments
must stay in authorised restricted custody. Public governance should reference
a sanitised decision/evidence identifier, reviewing role, date, outcome and
source pin only; do not commit confidential contracts or signatures.

## Primary legal reference for the reviewer

The [MyIPO-hosted Copyright Act 1987 updated text](https://www.myipo.gov.my/wp-content/uploads/2025/02/Lampiran-A1-ENG-Akta-Hak-Cipta-setakat-22-Jun-2023.pdf)
is labelled as at 30 June 2022 and describes itself as an updated, non-authentic
text. Sections 26 and 27 address employment/commissioned-work ownership
subject to agreements and written licences. This supports requesting a
rights/authority review; it does not decide Cadence's ownership or substitute
for confirming current applicable law and the actual agreements.

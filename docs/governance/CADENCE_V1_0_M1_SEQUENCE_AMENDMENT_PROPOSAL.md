# Proposed M1 sequencing amendment for frozen Cadence V1.0

Status: **PROPOSED — SPONSOR REVIEW REQUIRED — NOT APPROVED OR APPLIED**

Source: frozen execution contract v1.8.0, section 1 and freeze addendum

Related checkpoint: [CAD-WP-002 reconciliation](CADENCE_V1_0_CAD_WP_002_VS005_RECONCILIATION.md)

## Why a separate decision is required

The Project Owner has stopped selecting VS005 for active execution.
Main's [M1 contract](../milestones/M1_CONTROLLED_PILOT.md) still assigns runtime
to VS005 and recovery/support to VS006. The preserved local VS005 contract
subsequently added VS007 before controlled rehearsal and Pilot Activation.
The frozen V1.0 contract permits a labelled deterministic M1 journey only
**provided the sponsor formally amends that later dependency sequence**.

The execution-selection decision is recorded now. The gate substitution below
is proposed only. Until approved, do not claim successor milestone acceptance,
activate the pilot or use this proposal to bypass an existing gate.
The M1 contract, frozen packet register and historical VS005 contracts are
unchanged by this PR.

## Exact amendment text proposed for sponsor approval

> For the Cadence V1.0 implementation pathway, delivery of the required M1
> intended outcomes is governed through the existing frozen v1.8.0 work packets
> instead of executing VS005, VS006 and VS007 as successive implementation
> slices. Their historical requirements, source records and unresolved evidence
> remain retained; none of those slices is declared completed or accepted.
>
> All packet dependencies and acceptance conditions remain exactly as frozen.
> CAD-WP-001 and CAD-WP-002 require formal acceptance before their dependent
> packets are dispatched. Source ownership, legal/IP, institutional licence,
> credentials and live-operation decisions remain separate gates.
>
> CAD-WP-008 owns the bounded hosting-route decision. CAD-WP-009–016 own the
> application/runtime, safe configuration, hosted web/API, supervised worker,
> rollback and release-identity outcomes. CAD-WP-063/064 own configured OAuth,
> stable Person mapping and tenant/revocation safeguards. CAD-WP-067 owns
> configurable primary/backup operators; CAD-WP-051 owns support, incident and
> recovery instructions; CAD-WP-052 must prove isolated application-data
> restore. The retained source archive is not restore evidence.
>
> CAD-WP-049 is the controlled two-session pre-activation rehearsal with
> synthetic/non-live content. It exercises sign-in, project access, durable
> Discussion/refresh/return, automatic worker, proposal review, Task creation,
> My Tasks, Audit, read-only roles, access denial and project isolation.
> The existing deterministic development proposer may be used only when
> explicitly labelled deterministic. This is not evidence of real AI.
>
> CAD-WP-053 is the sponsor Pilot Activation GO/NO-GO. Its frozen direct
> dependencies are CAD-WP-049, 051, 052, 063, 064 and 067; all their transitive
> prerequisites and all existing M1 Pilot Activation conditions must pass.
> Stable HTTPS URLs, safe CORS/secrets/targets, current verified migrations,
> prepared authoritative Person/membership/protected-role state, supervised
> worker, logs, usable backup, successful isolated restore, support/incident
> ownership, the controlled rehearsal and zero activation P0/P1 remain
> mandatory. No real project content or live pilot use begins before GO.
>
> After GO, CAD-WP-054 records five working days of controlled real use by
> 5–10 named users on one real project without routine developer intervention.
> M1 closure still requires its original automated, runtime, browser,
> operational, governance and real-user evidence; CAD-WP-053 alone is not
> M1 closure.
>
> Real LLM acceptance remains mandatory before V1.0 release through
> CAD-WP-017–023, CAD-WP-065 and the real-user CAD-WP-055 UAT. CAD-WP-057/058
> retain their separate release decisions. Neither deterministic M1 evidence,
> green CI nor a documentation merge substitutes for real AI or release GO.
>
> Every original C/F parent/child and INIT-AC obligation remains governed
> through M3. This amendment changes execution sequencing only: no milestone
> due date, scope, protected permission/history/module boundary or acceptance
> outcome is removed or weakened. No requirement is marked DELIVERED or
> INCORPORATED by approval. Full M3 production conformity is not claimed.

## Proposed successor sequence

This is a gate map, not permission to dispatch without dependencies:

```text
Accepted CAD-WP-001/002 and eligible foundation/interface/baseline packets
  -> hosting/runtime/configuration/identity/operator packets
  -> CAD-WP-049 controlled synthetic rehearsal
     + CAD-WP-051 support + CAD-WP-052 isolated restore
     + accepted CAD-WP-063/064/067 and all transitive dependencies
  -> CAD-WP-053 sponsor Pilot Activation GO/NO-GO
  -> CAD-WP-054 controlled real-user pilot and original M1 closure evidence

Separate mandatory V1.0 real AI/UAT and release gates:
CAD-WP-017–023/065 + CAD-WP-055 -> CAD-WP-057 -> CAD-WP-058
```

## Approval and recording requirements

The sponsor must explicitly approve the text above at an exact source SHA.
PR review/merge or scope-freeze approval alone must not be interpreted as that
approval unless the human decision explicitly identifies this amendment.

An approved enactment must update the M1 contract's Work Entry ownership,
capability mapping, dependency map, rehearsal/closure descriptions and related
Traceability/HANDOFF sequencing records consistently. Until that separate
disposition is recorded, the proposal remains pending and the existing M1
contract remains the governing milestone contract.

Record: approving sponsor, decision, date, exact source SHA, applicable M1
contract revision and links to the decision/evidence. No signature, approval
or date is fabricated here. Frozen v1.8.0 files and their 68-packet definitions
must remain unchanged; any actual packet substitution requires the frozen
contract's separate sponsor-approved replacement-contract process.

## Reconciliation

Previous milestone / proposed milestone: **M1 / M1**; no M3 deadline changes.

Baseline status transitions / original commitments incorporated: **None**.

Original commitments removed / moved beyond M3: **0 / 0**.

New post-initiation capabilities / new numbered packets: **0 / 0**.

Foundational security, architecture, authority, audit, provenance,
data-integrity and operations: **Preserved, evidence still required**.

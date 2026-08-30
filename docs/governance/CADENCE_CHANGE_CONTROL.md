# Cadence Change Control

Change-control version: 1.0
Scope authority: `CADENCE_PROJECT_SCOPE_BASELINE.md`
Status ledger: `CADENCE_REQUIREMENT_TRACEABILITY.md`

## 1. Governing rule

The project-initiation specification is the minimum committed Cadence product
baseline. Changes may improve or extend Cadence, but may not weaken, omit, or
silently remove an original intended outcome.

No governed baseline requirement may move beyond M3. This includes every
`INITIATION` commitment and every `APPROVED_ADDITION` accepted into governed
scope. Removal or de-scope is prohibited under the current project mandate.

## 2. Change classifications

### Enhancement

Adds capability, quality, usability, integration, or operational value without
weakening any baseline requirement. A post-initiation enhancement normally
targets M4+ unless it is required for safety, operability, compliance, or
completion of an original commitment.

### Evolution

Changes implementation, architecture, policy, or user experience while
preserving or improving the full original intended outcome. Evolution must map
the old and new behavior and provide regression evidence for the baseline.

### Incorporation

A broader implemented capability demonstrably satisfies the full intended
outcome of another baseline requirement, making a separate implementation
unnecessary. Incorporation is an evidence-backed closure status, not a synonym
for omission.

### Deferral

Changes delivery sequence or milestone within M0–M3 without changing the
commitment. Deferral must identify the reason, dependency, revised milestone,
closure path, and impact. It must update the Traceability Register.

No governed baseline requirement may be deferred beyond M3.

### Removal / de-scope

Prohibited under the current Cadence project mandate. A proposal to remove or
weaken a baseline commitment cannot be approved through ordinary slice,
roadmap, or documentation changes.

## 3. Development priority order

When work competes for priority, use this order:

1. protect foundational integrity and resolve safety/security/data risks;
2. complete original initiation commitments;
3. complete active milestone requirements;
4. implement enhancements and post-initiation capabilities.

An enhancement may move earlier only where it is necessary for safety,
operability, compliance, or completion of an original intended outcome.

## 4. Evidence required for INCORPORATED

A requirement may be marked `INCORPORATED` only when all of the following are
recorded:

1. the exact parent and child requirement IDs;
2. the original source text/section and intended outcome;
3. the broader implemented capability and its owning vertical slice;
4. an outcome-by-outcome equivalence analysis showing no lost behavior;
5. implementation references at the authoritative module/API/UI boundary;
6. automated and/or controlled runtime evidence covering every original
   acceptance condition;
7. permission, security, audit, data-integrity, and history evidence where
   applicable;
8. migration/backfill/compatibility evidence where persisted state is involved;
9. documentation and user/operational evidence needed to use the broader
   capability; and
10. an explicit closure record in the Traceability Register.

Similarity, shared tables, partial overlap, an unused schema object, or a claim
that a capability is no longer separately visible is insufficient.

## 5. Milestone change control

Any milestone assignment change must update
`CADENCE_REQUIREMENT_TRACEABILITY.md` in the same checkpoint and record:

- previous and new milestone;
- reason and dependency;
- effect on active milestone exit criteria;
- confirmed M3 closure path;
- original commitments moved beyond M3: 0.

The Milestone Roadmap may sequence work but cannot redefine the Scope Baseline.

## 6. Vertical-slice governance

Before planning a new vertical slice, maintainers and agents must read:

1. `CADENCE_GOVERNANCE_INDEX.md`;
2. `CADENCE_PROJECT_SCOPE_BASELINE.md`;
3. `CADENCE_MILESTONE_ROADMAP.md`;
4. `CADENCE_REQUIREMENT_TRACEABILITY.md`;
5. this Change Control document;
6. the applicable existing vertical-slice contracts; and
7. `HANDOFF.md`.

Every future vertical slice must explicitly reconcile against the Scope
Baseline. Work that cannot be mapped to a baseline ID or a declared new M4+
identifier is unmapped and may not close.

## 7. Mandatory future vertical-slice contract template

Every new vertical-slice contract must include the following section without
omitting fields:

```markdown
## Governance Reconciliation

Milestone:
Scope Baseline Version:
Capability IDs Advanced:
Foundational Requirements Affected:
Dependencies:
Original Commitments Incorporated:
New Post-Initiation Capabilities:
Baseline Requirements Deferred Within M0–M3:
Reason:
```

Rules:

- `Capability IDs Advanced` must reference C/F parents and affected children.
- `Original Commitments Incorporated` must be `None` or include the complete
  evidence plan required by section 4.
- `New Post-Initiation Capabilities` must be clearly separated from baseline
  delivery and must not conceal an original gap.
- Any deferral must remain within M0–M3 and update the Traceability Register.
- Foundational requirements affected by design, data, authorization,
  deployment, or operations must be named even when their status is unchanged.

## 8. Mandatory vertical-slice closure record

Every future closure must state:

```markdown
## Baseline Closure Reconciliation

Baseline status transitions:
Original commitments removed: 0
Original commitments moved beyond M3: 0
Unmapped implementation changes: 0
```

It must also provide:

- requirement-level implementation and test evidence;
- any `INCORPORATED` equivalence evidence;
- updated Traceability Register rows;
- affected milestone-exit evidence;
- foundational regression/security evidence;
- documentation and operational updates required by the checkpoint.

A slice cannot close if any of the three mandatory zero values is non-zero.

## 9. Foundation protection

Foundational commitments may not be weakened for delivery speed. In
particular, no slice may bypass:

- project-scoped access and backend permission authority;
- module ownership and public contracts;
- immutable significant history and Audit ownership;
- human authority over consequential AI state;
- migration-driven schema control;
- truthful provenance/correlation;
- secret/environment safety;
- testing and handoff obligations.

A proposed change that puts a foundation `AT RISK` must stop for explicit
governance review before implementation.

## 10. Review controls

Every governance review must confirm:

- parent count remains 44 unless an explicit additive baseline version is
  approved;
- child requirements do not inflate parent statistics;
- every child has a parent;
- all 20 `INIT-AC` criteria remain mapped;
- original core entities/capabilities remain mapped;
- unmapped initiation requirements = 0;
- original commitments removed = 0;
- original commitments targeted beyond M3 = 0.

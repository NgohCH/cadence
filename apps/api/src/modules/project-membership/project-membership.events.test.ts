import assert from "node:assert/strict";
import { test } from "node:test";

import {
  PROJECT_MEMBERSHIP_AGGREGATE_TYPE,
  PROJECT_MEMBERSHIP_EVENT_CARDINALITY,
  PROJECT_MEMBERSHIP_EVENT_NAMES,
  PROJECT_MEMBERSHIP_EVENT_TYPES,
  PROJECT_MEMBERSHIP_EVENT_VERSION,
  PROJECT_ROLE_TRANSFER_AGGREGATE_TYPE,
  isProjectMembershipEventType,
} from "./project-membership.events";

import type {
  ProjectMemberAddedV1,
  ProjectMemberRemovedV1,
  ProjectMembershipDomainEvent,
  ProjectMembershipEventState,
  ProjectMembershipExpiredV1,
  ProjectRoleAssignedV1,
  ProjectRoleAssignmentEventState,
  ProjectRoleRevokedV1,
  ProjectRoleTransferredV1,
  ProjectRoleTransferEventState,
} from "./project-membership.events";


const eventId =
  "11111111-1111-4111-8111-111111111111";
const projectId =
  "22222222-2222-4222-8222-222222222222";
const membershipId =
  "33333333-3333-4333-8333-333333333333";
const incomingMembershipId =
  "44444444-4444-4444-8444-444444444444";
const personId =
  "55555555-5555-4555-8555-555555555555";
const incomingPersonId =
  "66666666-6666-4666-8666-666666666666";
const actorPersonId =
  "77777777-7777-4777-8777-777777777777";
const correlationId =
  "88888888-8888-4888-8888-888888888888";
const assignmentId =
  "99999999-9999-4999-8999-999999999999";
const incomingAssignmentId =
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const transferId =
  "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const effectiveAt =
  "2026-08-25T08:00:00.000Z";
const occurredAt =
  "2026-08-25T08:00:01.000Z";


function membershipState(
  overrides:
    Partial<ProjectMembershipEventState> = {}
): ProjectMembershipEventState {
  return {
    membership_id:
      membershipId,
    person_id:
      personId,
    project_id:
      projectId,
    effective_from:
      "2026-08-01T00:00:00.000Z",
    effective_to:
      null,
    status:
      "ACTIVE",
    granted_by_person_id:
      actorPersonId,
    created_at:
      "2026-08-01T00:00:00.000Z",
    termination_kind:
      null,
    terminated_by_person_id:
      null,
    termination_reason:
      null,
    termination_correlation_id:
      null,
    terminated_at:
      null,
    ...overrides,
  };
}


function assignmentState(
  overrides:
    Partial<ProjectRoleAssignmentEventState> = {}
): ProjectRoleAssignmentEventState {
  return {
    assignment_id:
      assignmentId,
    project_id:
      projectId,
    membership_id:
      membershipId,
    role:
      "PROJECT_MEMBER",
    effective_from:
      "2026-08-01T00:00:00.000Z",
    effective_to:
      null,
    assigned_by_person_id:
      actorPersonId,
    change_reason:
      null,
    created_at:
      "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}


function transferState(
  overrides:
    Partial<ProjectRoleTransferEventState> = {}
): ProjectRoleTransferEventState {
  return {
    transfer_id:
      transferId,
    project_id:
      projectId,
    role:
      "PROJECT_MANAGER",
    outgoing_assignment_id:
      assignmentId,
    incoming_assignment_id:
      incomingAssignmentId,
    authorised_by_person_id:
      actorPersonId,
    reason:
      "Transfer operational responsibility.",
    correlation_id:
      correlationId,
    effective_at:
      effectiveAt,
    created_at:
      occurredAt,
    ...overrides,
  };
}


test(
  "VS002-07 freezes the six v1 event names and operation cardinality",
  () => {
    assert.equal(
      PROJECT_MEMBERSHIP_EVENT_VERSION,
      1
    );
    assert.deepEqual(
      PROJECT_MEMBERSHIP_EVENT_TYPES,
      [
        "ProjectMemberAdded",
        "ProjectMemberRemoved",
        "ProjectMembershipExpired",
        "ProjectRoleAssigned",
        "ProjectRoleRevoked",
        "ProjectRoleTransferred",
      ]
    );
    assert.deepEqual(
      PROJECT_MEMBERSHIP_EVENT_NAMES,
      PROJECT_MEMBERSHIP_EVENT_TYPES.map(
        (eventType) =>
          `${eventType}.v1`
      )
    );
    assert.deepEqual(
      PROJECT_MEMBERSHIP_EVENT_CARDINALITY,
      {
        ADMISSION: [
          "ProjectMemberAdded",
          "ProjectRoleAssigned",
        ],
        ORDINARY_REPLACEMENT: [
          "ProjectRoleRevoked",
          "ProjectRoleAssigned",
        ],
        ZERO_HISTORY_ORDINARY_CHANGE: [
          "ProjectRoleAssigned",
        ],
        PROTECTED_FIRST_APPOINTMENT: [
          "ProjectRoleAssigned",
        ],
        PROTECTED_TRANSFER: [
          "ProjectRoleTransferred",
        ],
        ADMINISTRATIVE_REMOVAL: [
          "ProjectMemberRemoved",
        ],
        EXPIRY: [
          "ProjectMembershipExpired",
        ],
        FAILED_OR_IDEMPOTENT_NO_OP: [],
      }
    );
    assert.equal(
      isProjectMembershipEventType(
        "ProjectRoleTransferred"
      ),
      true
    );
    assert.equal(
      isProjectMembershipEventType(
        "ProjectRoleChanged"
      ),
      false
    );
  }
);


test(
  "admission events use stable Person provenance and self-contained membership and initial-role state",
  () => {
    const initialAssignment =
      assignmentState();

    const memberAdded:
      ProjectMemberAddedV1 = {
        eventId,
        eventType:
          "ProjectMemberAdded",
        eventVersion: 1,
        aggregateType:
          "project_membership",
        aggregateId:
          membershipId,
        projectId,
        actorType:
          "person",
        actorId:
          actorPersonId,
        correlationId,
        occurredAt,
        payload: {
          project_id:
            projectId,
          membership_id:
            membershipId,
          affected_person_id:
            personId,
          effective_at:
            "2026-08-01T00:00:00.000Z",
          reason:
            null,
          before:
            null,
          after:
            membershipState(),
          initial_role_assignment: {
            ...initialAssignment,
            role:
              "PROJECT_MEMBER",
          },
        },
      };

    const roleAssigned:
      ProjectRoleAssignedV1 = {
        ...memberAdded,
        eventId:
          "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        eventType:
          "ProjectRoleAssigned",
        payload: {
          project_id:
            projectId,
          membership_id:
            membershipId,
          affected_person_id:
            personId,
          assignment_kind:
            "INITIAL_ORDINARY",
          effective_at:
            "2026-08-01T00:00:00.000Z",
          reason:
            null,
          previous_assignment_id:
            null,
          before:
            null,
          after: {
            ...initialAssignment,
            role:
              "PROJECT_MEMBER",
          },
          transfer:
            null,
        },
      };

    assert.equal(
      memberAdded.actorId,
      memberAdded.payload.after.granted_by_person_id
    );
    assert.equal(
      memberAdded.aggregateId,
      memberAdded.payload.membership_id
    );
    assert.equal(
      roleAssigned.correlationId,
      memberAdded.correlationId
    );
    assert.equal(
      roleAssigned.payload.after.role,
      "PROJECT_MEMBER"
    );
  }
);


test(
  "ordinary replacement carries complete before and after assignment state while zero-history stays truthful",
  () => {
    const openAssignment =
      assignmentState({
        role:
          "PROJECT_MEMBER",
      });
    const closedAssignment =
      assignmentState({
        role:
          "PROJECT_MEMBER",
        effective_to:
          effectiveAt,
      });

    const revoked:
      ProjectRoleRevokedV1 = {
        eventId,
        eventType:
          "ProjectRoleRevoked",
        eventVersion: 1,
        aggregateType:
          "project_membership",
        aggregateId:
          membershipId,
        projectId,
        actorType:
          "person",
        actorId:
          actorPersonId,
        correlationId,
        occurredAt,
        payload: {
          project_id:
            projectId,
          membership_id:
            membershipId,
          affected_person_id:
            personId,
          effective_at:
            effectiveAt,
          reason:
            "Move to observation.",
          revocation_kind:
            "ORDINARY_REPLACEMENT",
          before: {
            ...openAssignment,
            role:
              "PROJECT_MEMBER",
          },
          after: {
            ...closedAssignment,
            role:
              "PROJECT_MEMBER",
          },
          successor_assignment_id:
            incomingAssignmentId,
        },
      };

    const assigned:
      ProjectRoleAssignedV1 = {
        ...revoked,
        eventType:
          "ProjectRoleAssigned",
        payload: {
          project_id:
            projectId,
          membership_id:
            membershipId,
          affected_person_id:
            personId,
          assignment_kind:
            "ORDINARY_CHANGE",
          effective_at:
            effectiveAt,
          reason:
            "Move to observation.",
          previous_assignment_id:
            assignmentId,
          before:
            null,
          after: {
            ...assignmentState({
              assignment_id:
                incomingAssignmentId,
              role:
                "PROJECT_OBSERVER",
              effective_from:
                effectiveAt,
            }),
            role:
              "PROJECT_OBSERVER",
          },
          transfer:
            null,
        },
      };

    const zeroHistory:
      ProjectRoleAssignedV1 = {
        ...assigned,
        payload: {
          ...assigned.payload,
          previous_assignment_id:
            null,
        },
      };

    assert.equal(
      revoked.payload.before.effective_to,
      null
    );
    assert.equal(
      revoked.payload.after.effective_to,
      assigned.payload.effective_at
    );
    assert.equal(
      assigned.payload.previous_assignment_id,
      revoked.payload.before.assignment_id
    );
    assert.equal(
      zeroHistory.payload.previous_assignment_id,
      null
    );
  }
);


test(
  "protected appointment and transfer preserve ledger provenance without duplicate transfer events",
  () => {
    const appointment:
      ProjectRoleAssignedV1 = {
        eventId,
        eventType:
          "ProjectRoleAssigned",
        eventVersion: 1,
        aggregateType:
          "project_membership",
        aggregateId:
          incomingMembershipId,
        projectId,
        actorType:
          "person",
        actorId:
          actorPersonId,
        correlationId,
        occurredAt,
        payload: {
          project_id:
            projectId,
          membership_id:
            incomingMembershipId,
          affected_person_id:
            incomingPersonId,
          assignment_kind:
            "PROTECTED_APPOINTMENT",
          effective_at:
            effectiveAt,
          reason:
            "Appoint project manager.",
          previous_assignment_id:
            null,
          before:
            null,
          after: {
            ...assignmentState({
              assignment_id:
                incomingAssignmentId,
              membership_id:
                incomingMembershipId,
              role:
                "PROJECT_MANAGER",
              effective_from:
                effectiveAt,
              change_reason:
                "Appoint project manager.",
            }),
            role:
              "PROJECT_MANAGER",
          },
          transfer: {
            ...transferState({
              outgoing_assignment_id:
                null,
              reason:
                "Appoint project manager.",
            }),
            outgoing_assignment_id:
              null,
          },
        },
      };

    const transferred:
      ProjectRoleTransferredV1 = {
        eventId,
        eventType:
          "ProjectRoleTransferred",
        eventVersion: 1,
        aggregateType:
          "project_role_transfer",
        aggregateId:
          transferId,
        projectId,
        actorType:
          "person",
        actorId:
          actorPersonId,
        correlationId,
        occurredAt,
        payload: {
          project_id:
            projectId,
          outgoing_membership_id:
            membershipId,
          incoming_membership_id:
            incomingMembershipId,
          outgoing_person_id:
            personId,
          incoming_person_id:
            incomingPersonId,
          affected_person_ids: [
            personId,
            incomingPersonId,
          ],
          role:
            "PROJECT_MANAGER",
          effective_at:
            effectiveAt,
          reason:
            "Transfer operational responsibility.",
          before: {
            ...assignmentState({
              role:
                "PROJECT_MANAGER",
            }),
            role:
              "PROJECT_MANAGER",
          },
          after: {
            outgoing_assignment: {
              ...assignmentState({
                role:
                  "PROJECT_MANAGER",
                effective_to:
                  effectiveAt,
              }),
              role:
                "PROJECT_MANAGER",
            },
            incoming_assignment: {
              ...assignmentState({
                assignment_id:
                  incomingAssignmentId,
                membership_id:
                  incomingMembershipId,
                role:
                  "PROJECT_MANAGER",
                effective_from:
                  effectiveAt,
              }),
              role:
                "PROJECT_MANAGER",
            },
          },
          transfer: {
            ...transferState(),
            outgoing_assignment_id:
              assignmentId,
          },
        },
      };

    assert.equal(
      appointment.aggregateType,
      PROJECT_MEMBERSHIP_AGGREGATE_TYPE
    );
    assert.ok(
      appointment.payload.transfer
    );
    assert.equal(
      appointment.payload.transfer.outgoing_assignment_id,
      null
    );
    assert.equal(
      transferred.aggregateType,
      PROJECT_ROLE_TRANSFER_AGGREGATE_TYPE
    );
    assert.equal(
      transferred.aggregateId,
      transferred.payload.transfer.transfer_id
    );
    assert.equal(
      transferred.correlationId,
      transferred.payload.transfer.correlation_id
    );
  }
);


test(
  "removal and expiry carry ended role snapshots and distinct person/system actor provenance",
  () => {
    const closedAssignment =
      assignmentState({
        effective_to:
          effectiveAt,
      });
    const endedMembership =
      membershipState({
        effective_to:
          effectiveAt,
        status:
          "ENDED",
        termination_kind:
          "ADMINISTRATIVE_REMOVAL",
        terminated_by_person_id:
          actorPersonId,
        termination_reason:
          "No longer assigned.",
        termination_correlation_id:
          correlationId,
        terminated_at:
          effectiveAt,
      });

    const removed:
      ProjectMemberRemovedV1 = {
        eventId,
        eventType:
          "ProjectMemberRemoved",
        eventVersion: 1,
        aggregateType:
          "project_membership",
        aggregateId:
          membershipId,
        projectId,
        actorType:
          "person",
        actorId:
          actorPersonId,
        correlationId,
        occurredAt,
        payload: {
          project_id:
            projectId,
          membership_id:
            membershipId,
          affected_person_id:
            personId,
          effective_at:
            effectiveAt,
          reason:
            "No longer assigned.",
          before:
            membershipState(),
          after:
            endedMembership,
          closed_role_assignments: [
            closedAssignment,
          ],
          termination: {
            termination_kind:
              "ADMINISTRATIVE_REMOVAL",
            terminated_by_person_id:
              actorPersonId,
            termination_reason:
              "No longer assigned.",
            correlation_id:
              correlationId,
            terminated_at:
              effectiveAt,
          },
        },
      };

    const materializedAt =
      "2026-08-25T09:00:00.000Z";
    const expired:
      ProjectMembershipExpiredV1 = {
        ...removed,
        eventType:
          "ProjectMembershipExpired",
        actorType:
          "system",
        actorId:
          null,
        occurredAt:
          materializedAt,
        payload: {
          project_id:
            projectId,
          membership_id:
            membershipId,
          affected_person_id:
            personId,
          effective_at:
            effectiveAt,
          materialized_at:
            materializedAt,
          reason:
            null,
          before:
            membershipState({
              effective_to:
                effectiveAt,
            }),
          after:
            membershipState({
              effective_to:
                effectiveAt,
              status:
                "ENDED",
              termination_kind:
                "EXPIRY",
              termination_correlation_id:
                correlationId,
              terminated_at:
                materializedAt,
            }),
          ended_role_assignments: [
            closedAssignment,
          ],
          termination: {
            termination_kind:
              "EXPIRY",
            terminated_by_person_id:
              null,
            termination_reason:
              null,
            correlation_id:
              correlationId,
            terminated_at:
              materializedAt,
          },
        },
      };

    const events:
      ProjectMembershipDomainEvent[] = [
        removed,
        expired,
      ];

    assert.equal(
      events.length,
      2
    );
    assert.equal(
      removed.payload.closed_role_assignments.length,
      1
    );
    assert.equal(
      expired.payload.ended_role_assignments.length,
      1
    );
    assert.equal(
      expired.actorId,
      null
    );
    assert.notEqual(
      expired.payload.effective_at,
      expired.occurredAt
    );
    assert.equal(
      expired.payload.materialized_at,
      expired.occurredAt
    );
  }
);

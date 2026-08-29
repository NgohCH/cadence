import type {
  ProjectMembershipStatus,
} from "./project-membership.types";

import type {
  ProjectMembershipTerminationType,
} from "./project-membership-lifecycle.types";

import type {
  OrdinaryProjectRole,
  ProjectRole,
  ProtectedProjectRole,
} from "./project-role.types";


/**
 * Cadence stores the event name and version in separate envelope fields.
 * The `.v1` names below are the published contract names.
 *
 * These contracts apply prospectively when a VS002 operation commits. They
 * do not authorize historical backfill or reconstruction from persistence.
 */
export const PROJECT_MEMBERSHIP_EVENT_VERSION =
  1 as const;

export const PROJECT_MEMBERSHIP_EVENT_TYPES = [
  "ProjectMemberAdded",
  "ProjectMemberRemoved",
  "ProjectMembershipExpired",
  "ProjectRoleAssigned",
  "ProjectRoleRevoked",
  "ProjectRoleTransferred",
] as const;

export type ProjectMembershipEventType =
  typeof PROJECT_MEMBERSHIP_EVENT_TYPES[number];

export const PROJECT_MEMBERSHIP_EVENT_NAMES = [
  "ProjectMemberAdded.v1",
  "ProjectMemberRemoved.v1",
  "ProjectMembershipExpired.v1",
  "ProjectRoleAssigned.v1",
  "ProjectRoleRevoked.v1",
  "ProjectRoleTransferred.v1",
] as const;

export type ProjectMembershipEventName =
  typeof PROJECT_MEMBERSHIP_EVENT_NAMES[number];

/**
 * Frozen business-operation cardinality. These are event types, with v1
 * supplied by PROJECT_MEMBERSHIP_EVENT_VERSION in every envelope.
 */
export const PROJECT_MEMBERSHIP_EVENT_CARDINALITY = {
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
} as const satisfies Record<
  string,
  readonly ProjectMembershipEventType[]
>;

export const PROJECT_MEMBERSHIP_AGGREGATE_TYPE =
  "project_membership" as const;

export const PROJECT_ROLE_TRANSFER_AGGREGATE_TYPE =
  "project_role_transfer" as const;


/**
 * A self-contained membership snapshot for Audit projection.
 *
 * Payload fields deliberately use the existing snake_case domain-event
 * convention. Audit must not query Project Membership persistence to fill in
 * any omitted state.
 */
export interface ProjectMembershipEventState {
  membership_id: string;
  person_id: string;
  project_id: string;
  effective_from: string;
  effective_to: string | null;
  status: ProjectMembershipStatus;
  granted_by_person_id: string | null;
  created_at: string;
  termination_kind:
    ProjectMembershipTerminationType | null;
  terminated_by_person_id: string | null;
  termination_reason: string | null;
  termination_correlation_id: string | null;
  terminated_at: string | null;
}


/** A complete immutable role-assignment snapshot. */
export interface ProjectRoleAssignmentEventState {
  assignment_id: string;
  project_id: string;
  membership_id: string;
  role: ProjectRole;
  effective_from: string;
  effective_to: string | null;
  assigned_by_person_id: string;
  change_reason: string | null;
  created_at: string;
}


/** The immutable protected appointment/transfer ledger provenance. */
export interface ProjectRoleTransferEventState {
  transfer_id: string;
  project_id: string;
  role: ProtectedProjectRole;
  outgoing_assignment_id: string | null;
  incoming_assignment_id: string;
  authorised_by_person_id: string;
  reason: string;
  correlation_id: string;
  effective_at: string;
  created_at: string;
}


export interface AdministrativeTerminationEventState {
  termination_kind: "ADMINISTRATIVE_REMOVAL";
  terminated_by_person_id: string;
  termination_reason: string | null;
  correlation_id: string;
  terminated_at: string;
}


export interface ExpiryTerminationEventState {
  termination_kind: "EXPIRY";
  terminated_by_person_id: null;
  termination_reason: string | null;
  correlation_id: string;
  terminated_at: string;
}


export interface ProjectMemberAddedV1Payload {
  project_id: string;
  membership_id: string;
  affected_person_id: string;
  effective_at: string;
  reason: null;
  before: null;
  after: ProjectMembershipEventState;
  initial_role_assignment:
    ProjectRoleAssignmentEventState & {
      role: "PROJECT_MEMBER";
    };
}


export interface ProjectMemberRemovedV1Payload {
  project_id: string;
  membership_id: string;
  affected_person_id: string;
  effective_at: string;
  reason: string | null;
  before: ProjectMembershipEventState;
  after: ProjectMembershipEventState;
  closed_role_assignments:
    ProjectRoleAssignmentEventState[];
  termination:
    AdministrativeTerminationEventState;
}


export interface ProjectMembershipExpiredV1Payload {
  project_id: string;
  membership_id: string;
  affected_person_id: string;
  /** The original membership effective_to boundary. */
  effective_at: string;
  /** When the worker persisted the temporal transition as ENDED. */
  materialized_at: string;
  reason: string | null;
  before: ProjectMembershipEventState;
  after: ProjectMembershipEventState;
  ended_role_assignments:
    ProjectRoleAssignmentEventState[];
  termination:
    ExpiryTerminationEventState;
}


interface ProjectRoleAssignedV1PayloadBase {
  project_id: string;
  membership_id: string;
  affected_person_id: string;
  effective_at: string;
  before: null;
  after: ProjectRoleAssignmentEventState;
}


export type ProjectRoleAssignedV1Payload =
  | (
      ProjectRoleAssignedV1PayloadBase & {
        assignment_kind:
          "INITIAL_ORDINARY";
        reason: null;
        previous_assignment_id: null;
        transfer: null;
        after:
          ProjectRoleAssignmentEventState & {
            role: "PROJECT_MEMBER";
          };
      }
    )
  | (
      ProjectRoleAssignedV1PayloadBase & {
        assignment_kind:
          "ORDINARY_CHANGE";
        reason: string | null;
        previous_assignment_id:
          string | null;
        transfer: null;
        after:
          ProjectRoleAssignmentEventState & {
            role: OrdinaryProjectRole;
          };
      }
    )
  | (
      ProjectRoleAssignedV1PayloadBase & {
        assignment_kind:
          "PROTECTED_APPOINTMENT";
        reason: string;
        previous_assignment_id: null;
        transfer:
          ProjectRoleTransferEventState & {
            outgoing_assignment_id: null;
          };
        after:
          ProjectRoleAssignmentEventState & {
            role: ProtectedProjectRole;
          };
      }
    );


export interface ProjectRoleRevokedV1Payload {
  project_id: string;
  membership_id: string;
  affected_person_id: string;
  effective_at: string;
  reason: string | null;
  revocation_kind:
    "ORDINARY_REPLACEMENT";
  before:
    ProjectRoleAssignmentEventState & {
      role: OrdinaryProjectRole;
    };
  after:
    ProjectRoleAssignmentEventState & {
      role: OrdinaryProjectRole;
    };
  successor_assignment_id: string;
}


export interface ProjectRoleTransferredV1Payload {
  project_id: string;
  outgoing_membership_id: string;
  incoming_membership_id: string;
  outgoing_person_id: string;
  incoming_person_id: string;
  affected_person_ids: [string, string];
  role: ProtectedProjectRole;
  effective_at: string;
  reason: string;
  before:
    ProjectRoleAssignmentEventState & {
      role: ProtectedProjectRole;
    };
  after: {
    outgoing_assignment:
      ProjectRoleAssignmentEventState & {
        role: ProtectedProjectRole;
      };
    incoming_assignment:
      ProjectRoleAssignmentEventState & {
        role: ProtectedProjectRole;
      };
  };
  transfer:
    ProjectRoleTransferEventState & {
      outgoing_assignment_id: string;
    };
}


interface ProjectMembershipEventEnvelopeBase<
  TType extends ProjectMembershipEventType,
  TAggregateType extends
    | typeof PROJECT_MEMBERSHIP_AGGREGATE_TYPE
    | typeof PROJECT_ROLE_TRANSFER_AGGREGATE_TYPE,
  TPayload,
> {
  eventId: string;
  eventType: TType;
  eventVersion:
    typeof PROJECT_MEMBERSHIP_EVENT_VERSION;
  aggregateType: TAggregateType;
  aggregateId: string;
  projectId: string;
  correlationId: string;
  causationId?: string;
  occurredAt: string;
  payload: TPayload;
}


type PersonProjectMembershipEvent<
  TType extends ProjectMembershipEventType,
  TAggregateType extends
    | typeof PROJECT_MEMBERSHIP_AGGREGATE_TYPE
    | typeof PROJECT_ROLE_TRANSFER_AGGREGATE_TYPE,
  TPayload,
> =
  ProjectMembershipEventEnvelopeBase<
    TType,
    TAggregateType,
    TPayload
  > & {
    actorType: "person";
    actorId: string;
  };


type SystemProjectMembershipEvent<
  TType extends ProjectMembershipEventType,
  TPayload,
> =
  ProjectMembershipEventEnvelopeBase<
    TType,
    typeof PROJECT_MEMBERSHIP_AGGREGATE_TYPE,
    TPayload
  > & {
    actorType: "system";
    actorId: null;
  };


export type ProjectMemberAddedV1 =
  PersonProjectMembershipEvent<
    "ProjectMemberAdded",
    typeof PROJECT_MEMBERSHIP_AGGREGATE_TYPE,
    ProjectMemberAddedV1Payload
  >;

export type ProjectMemberRemovedV1 =
  PersonProjectMembershipEvent<
    "ProjectMemberRemoved",
    typeof PROJECT_MEMBERSHIP_AGGREGATE_TYPE,
    ProjectMemberRemovedV1Payload
  >;

export type ProjectMembershipExpiredV1 =
  SystemProjectMembershipEvent<
    "ProjectMembershipExpired",
    ProjectMembershipExpiredV1Payload
  >;

export type ProjectRoleAssignedV1 =
  PersonProjectMembershipEvent<
    "ProjectRoleAssigned",
    typeof PROJECT_MEMBERSHIP_AGGREGATE_TYPE,
    ProjectRoleAssignedV1Payload
  >;

export type ProjectRoleRevokedV1 =
  PersonProjectMembershipEvent<
    "ProjectRoleRevoked",
    typeof PROJECT_MEMBERSHIP_AGGREGATE_TYPE,
    ProjectRoleRevokedV1Payload
  >;

export type ProjectRoleTransferredV1 =
  PersonProjectMembershipEvent<
    "ProjectRoleTransferred",
    typeof PROJECT_ROLE_TRANSFER_AGGREGATE_TYPE,
    ProjectRoleTransferredV1Payload
  >;


export type ProjectMembershipDomainEvent =
  | ProjectMemberAddedV1
  | ProjectMemberRemovedV1
  | ProjectMembershipExpiredV1
  | ProjectRoleAssignedV1
  | ProjectRoleRevokedV1
  | ProjectRoleTransferredV1;


export function isProjectMembershipEventType(
  eventType: string
): eventType is ProjectMembershipEventType {
  return (
    PROJECT_MEMBERSHIP_EVENT_TYPES as
      readonly string[]
  ).includes(eventType);
}

import type {
  OrdinaryProjectRole,
  ProjectRoleAssignment,
  ProtectedProjectRole,
} from "./project-role.types";


export interface ChangeOrdinaryRolePersistenceInput {
  assignmentId: string;
  projectId: string;
  membershipId: string;
  role: OrdinaryProjectRole;
  effectiveAt: string;
  assignedByPersonId: string;
  changeReason: string | null;
  correlationId: string;
  createdAt: string;
}


export interface ChangeOrdinaryRolePersistenceResult {
  closedAssignment:
    ProjectRoleAssignment | null;
  roleAssignment:
    ProjectRoleAssignment;
}


export interface TransferProtectedRolePersistenceInput {
  transferId: string;
  incomingAssignmentId: string;
  projectId: string;
  incomingMembershipId: string;
  role: ProtectedProjectRole;
  effectiveAt: string;
  authorisedByPersonId: string;
  reason: string;
  correlationId: string;
  createdAt: string;
}


export interface ProjectRoleTransferRecord {
  id: string;
  projectId: string;
  role: ProtectedProjectRole;
  outgoingAssignmentId: string | null;
  incomingAssignmentId: string;
  authorisedByPersonId: string;
  reason: string;
  correlationId: string;
  effectiveAt: string;
  createdAt: string;
}


export interface TransferProtectedRolePersistenceResult {
  outgoingAssignment:
    ProjectRoleAssignment | null;
  roleAssignment:
    ProjectRoleAssignment;
  transfer:
    ProjectRoleTransferRecord;
}


/**
 * Transactional persistence boundary for immediate project-role changes.
 *
 * The caller authorises through ProjectAuthorisationService before invoking
 * this repository. Stable Person identifiers received here are provenance,
 * never authorization evidence.
 */
export interface ProjectRoleManagementRepository {
  changeOrdinaryRole(
    input: ChangeOrdinaryRolePersistenceInput
  ): Promise<ChangeOrdinaryRolePersistenceResult>;

  transferProtectedRole(
    input: TransferProtectedRolePersistenceInput
  ): Promise<TransferProtectedRolePersistenceResult>;
}

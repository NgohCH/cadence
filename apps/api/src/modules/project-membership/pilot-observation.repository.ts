import type {
  ProjectRoleTransferRecord,
} from "./project-role-management.repository";
import type {
  ProjectMembership,
} from "./project-membership.types";
import type {
  ProjectRoleAssignment,
} from "./project-role.types";


/**
 * Read-only Project Membership boundary used by controlled pilot preflight.
 * Canonical membership, assignment, and immutable protected-transfer facts
 * are observable without exposing any admission or role mutation operation.
 */
export interface ProjectMembershipPilotObservationRepository {
  listMembershipsForProject(projectId: string): Promise<ProjectMembership[]>;
  listRoleAssignmentsForProject(projectId: string): Promise<ProjectRoleAssignment[]>;
  listProtectedRoleTransfers(projectId: string): Promise<ProjectRoleTransferRecord[]>;
}

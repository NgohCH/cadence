import type {
  CreateProjectMembershipInput,
  ProjectMembership,
} from "./project-membership.types";

import type {
  ProjectRoleAssignment,
} from "./project-role.types";


/**
 * Foundational VS002-02 persistence only.
 *
 * Membership lifecycle commands, duplicate detection, protected-role
 * transfer, expiry, and authorisation remain application concerns for later
 * checkpoints.
 */
export interface ProjectMembershipRepository {
  createMembership(
    membership: CreateProjectMembershipInput
  ): Promise<ProjectMembership>;

  findMembershipById(
    membershipId: string
  ): Promise<ProjectMembership | null>;

  createRoleAssignment(
    assignment: ProjectRoleAssignment
  ): Promise<ProjectRoleAssignment>;

  listRoleAssignments(
    membershipId: string
  ): Promise<ProjectRoleAssignment[]>;
}

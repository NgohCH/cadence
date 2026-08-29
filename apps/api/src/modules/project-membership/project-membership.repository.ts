import type {
  CreateProjectMembershipInput,
  ProjectMembership,
} from "./project-membership.types";

import type {
  ProjectRoleAssignment,
} from "./project-role.types";


/**
 * Persistence boundary owned by Project Membership.
 *
 * Application services remain responsible for authorisation, lifecycle
 * decisions, duplicate-membership protection, protected-role transfer,
 * expiry behaviour, and other business rules.
 */
export interface ProjectMembershipRepository {
  createMembership(
    membership: CreateProjectMembershipInput
  ): Promise<ProjectMembership>;

  findMembershipById(
    membershipId: string
  ): Promise<ProjectMembership | null>;

  listMembershipsForProject(
    projectId: string
  ): Promise<ProjectMembership[]>;

  listMembershipsForPersonInProject(
    personId: string,
    projectId: string
  ): Promise<ProjectMembership[]>;

  createRoleAssignment(
    assignment: ProjectRoleAssignment
  ): Promise<ProjectRoleAssignment>;

  listRoleAssignments(
    membershipId: string
  ): Promise<ProjectRoleAssignment[]>;
}
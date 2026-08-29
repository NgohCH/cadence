import type {
  CreateProjectMembershipInput,
  ProjectMembership,
} from "./project-membership.types";

import type {
  ProjectRoleAssignment,
} from "./project-role.types";


export interface ProjectMemberAdmissionInput {
  correlationId: string;

  membership:
    CreateProjectMembershipInput;

  roleAssignment:
    ProjectRoleAssignment;
}


export interface ProjectMemberAdmissionResult {
  membership:
    ProjectMembership;

  roleAssignment:
    ProjectRoleAssignment;
}


/**
 * Transactional persistence boundary for admitting an ordinary project
 * member.
 *
 * Membership and the initial PROJECT_MEMBER role must either both persist
 * or neither persist. The Supabase implementation is added before the HTTP
 * POST route is enabled.
 */
export interface ProjectMemberAdmissionRepository {
  addProjectMember(
    input: ProjectMemberAdmissionInput
  ): Promise<ProjectMemberAdmissionResult>;
}

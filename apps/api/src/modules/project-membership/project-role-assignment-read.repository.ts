import type { ProjectRoleAssignment } from "./project-role.types";


/** Read-only project-wide role-assignment boundary for protected-role checks. */
export interface ProjectRoleAssignmentReadRepository {
  listRoleAssignmentsForProject(
    projectId: string,
  ): Promise<ProjectRoleAssignment[]>;
}

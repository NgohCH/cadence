import { ProjectAccess } from "./rbac.types";

export interface RbacRepository {
  getProjectAccess(
    userId: string,
    projectId: string
  ): Promise<ProjectAccess | null>;
}
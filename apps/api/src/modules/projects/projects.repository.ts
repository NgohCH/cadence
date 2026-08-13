import type { ProjectSummary } from "./projects.types";

export interface ProjectWorkspaceReadRepository {
  getSummary(
    projectId: string,
    userId: string
  ): Promise<ProjectSummary | null>;
}
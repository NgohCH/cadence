import type {
  ProjectLifecycleStatus,
} from "./projects.types";


export const PROJECT_LIFECYCLE_READ_ONLY_STATUSES = [
  "completed",
  "cancelled",
] as const satisfies readonly ProjectLifecycleStatus[];


export const PROJECT_OPERATIONAL_STATUSES = [
  "active",
  "on_hold",
] as const satisfies readonly ProjectLifecycleStatus[];


export type ProjectMembershipLifecycleClassification =
  | "MUTABLE_NON_OPERATIONAL"
  | "OPERATIONAL"
  | "LIFECYCLE_READ_ONLY";


export interface ProjectMembershipLifecycleState {
  projectId: string;
  status: ProjectLifecycleStatus;
  classification:
    ProjectMembershipLifecycleClassification;
}


/** Published Projects boundary consumed by Project Membership. */
export interface ProjectsMembershipLifecycleService {
  getMembershipLifecycleState(
    projectId: string
  ): Promise<ProjectMembershipLifecycleState | null>;
}


/** Projects-internal persistence boundary. */
export interface ProjectLifecycleReadRepository {
  findLifecycleStatus(
    projectId: string
  ): Promise<ProjectLifecycleStatus | null>;
}


export class DefaultProjectsMembershipLifecycleService
  implements ProjectsMembershipLifecycleService
{
  constructor(
    private readonly repository:
      ProjectLifecycleReadRepository
  ) {}


  async getMembershipLifecycleState(
    projectId: string
  ): Promise<ProjectMembershipLifecycleState | null> {
    if (
      typeof projectId !== "string" ||
      projectId.trim().length === 0
    ) {
      throw new Error(
        "projectId is required."
      );
    }

    const status =
      await this.repository
        .findLifecycleStatus(
          projectId
        );

    if (status === null) {
      return null;
    }

    return {
      projectId,
      status,
      classification:
        classifyProjectMembershipLifecycle(
          status
        ),
    };
  }
}


export function classifyProjectMembershipLifecycle(
  status: ProjectLifecycleStatus
): ProjectMembershipLifecycleClassification {
  if (
    (
      PROJECT_LIFECYCLE_READ_ONLY_STATUSES as
        readonly ProjectLifecycleStatus[]
    ).includes(status)
  ) {
    return "LIFECYCLE_READ_ONLY";
  }

  if (
    (
      PROJECT_OPERATIONAL_STATUSES as
        readonly ProjectLifecycleStatus[]
    ).includes(status)
  ) {
    return "OPERATIONAL";
  }

  return "MUTABLE_NON_OPERATIONAL";
}

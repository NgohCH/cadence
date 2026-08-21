export const PROJECT_MEMBERSHIP_STATUSES = [
  "ACTIVE",
  "ENDED",
] as const;

export type ProjectMembershipStatus =
  typeof PROJECT_MEMBERSHIP_STATUSES[number];


/**
 * An authorised relationship between a stable Cadence Person and a Project.
 *
 * Role is intentionally absent. Authority belongs to a separate
 * ProjectRoleAssignment and, in later checkpoints, permission evaluation.
 */
export interface ProjectMembership {
  id: string;
  personId: string;
  projectId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: ProjectMembershipStatus;
  /**
   * Null only when VS-001 did not preserve the historical grantor.
   * New VS-002 memberships always require a stable Person grantor.
   */
  grantedBy: string | null;
  createdAt: string;
  terminationReason: string | null;
}


export type CreateProjectMembershipInput =
  Omit<ProjectMembership, "grantedBy"> & {
    grantedBy: string;
  };

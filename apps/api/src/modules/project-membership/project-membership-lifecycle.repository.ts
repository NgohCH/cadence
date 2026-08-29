import type {
  ProjectMembershipTerminationResult,
} from "./project-membership-lifecycle.types";

import type {
  ProjectMembership,
} from "./project-membership.types";

import type {
  ProtectedProjectRole,
} from "./project-role.types";


export interface AdministrativeMembershipTerminationPersistenceInput {
  projectId: string;
  membershipId: string;
  effectiveAt: string;
  terminatedByPersonId: string;
  terminationReason: string | null;
  correlationId: string;
}


export interface MembershipExpiryFinalisationPersistenceInput {
  projectId: string;
  membershipId: string;
  finalisedAt: string;
  terminationReason: string | null;
  correlationId: string;
}


export interface BoundedProtectedRoleViolation {
  projectId: string;
  membershipId: string;
  assignmentId: string;
  role:
    Extract<
      ProtectedProjectRole,
      "PROJECT_OWNER" | "PROJECT_MANAGER"
    >;
  membershipEffectiveTo: string;
}


/**
 * Transactional persistence boundary for membership lifecycle transitions.
 * Authorization and Tasks responsibility checks occur before this boundary.
 */
export interface ProjectMembershipLifecycleRepository {
  listDueMemberships(
    evaluatedAt: string
  ): Promise<ProjectMembership[]>;

  terminateAdministratively(
    input: AdministrativeMembershipTerminationPersistenceInput
  ): Promise<ProjectMembershipTerminationResult>;

  finaliseExpiry(
    input: MembershipExpiryFinalisationPersistenceInput
  ): Promise<ProjectMembershipTerminationResult>;

  listBoundedProtectedRoleViolations(
    evaluatedAt: string
  ): Promise<BoundedProtectedRoleViolation[]>;
}

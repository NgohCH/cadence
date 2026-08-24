import type {
  ProjectLifecycleStatus,
} from "../projects/projects.types";

import {
  PROJECT_LIFECYCLE_READ_ONLY_STATUSES,
  PROJECT_OPERATIONAL_STATUSES,
  classifyProjectMembershipLifecycle,
} from "../projects/projects-membership-lifecycle";

import type {
  ProjectMembership,
} from "./project-membership.types";

import type {
  ProjectRoleAssignment,
  ProtectedProjectRole,
} from "./project-role.types";


/**
 * VS002-06 lifecycle transitions are temporal and historical. Later
 * persistence must close effective periods and must never delete membership
 * or role-assignment rows. Domain events remain VS002-07.
 */
export const PROJECT_MEMBERSHIP_TERMINATION_TYPES = [
  "ADMINISTRATIVE_REMOVAL",
  "EXPIRY",
] as const;

export type ProjectMembershipTerminationType =
  typeof PROJECT_MEMBERSHIP_TERMINATION_TYPES[number];


export const MEMBERSHIP_LIFECYCLE_READ_ONLY_PROJECT_STATUSES = [
  ...PROJECT_LIFECYCLE_READ_ONLY_STATUSES,
] as const;


export const OPERATIONAL_PROJECT_STATUSES = [
  ...PROJECT_OPERATIONAL_STATUSES,
] as const;


/**
 * Semantic input for the administrative removal command.
 *
 * The authenticated actor, project, correlation ID, and effective timestamp
 * come from the service boundary. VS002-06 does not define a self-leave
 * command.
 */
export interface RemoveProjectMemberInput {
  membershipId: string;
  reason: string | null;
}


/**
 * Semantic input used when a due membership is materialised as ENDED.
 * Temporal access has already ceased at the membership's effectiveTo.
 */
export interface MaterializeProjectMembershipExpiryInput {
  membershipId: string;
}


interface ProjectMembershipTerminationBase {
  projectId: string;
  membershipId: string;
  terminationReason: string | null;
  correlationId: string;
  terminatedAt: string;
}


export type ProjectMembershipTermination =
  | (
      ProjectMembershipTerminationBase & {
        type: "ADMINISTRATIVE_REMOVAL";
        terminatedByPersonId: string;
      }
    )
  | (
      ProjectMembershipTerminationBase & {
        type: "EXPIRY";
        terminatedByPersonId: null;
      }
    );


export type ProjectMembershipTerminationOutcome =
  | "ENDED"
  | "ALREADY_ENDED";


/**
 * Both a first successful materialisation and an idempotent retry return the
 * preserved membership, role history closed by the original transition, and
 * original termination provenance.
 */
export interface ProjectMembershipTerminationResult {
  outcome: ProjectMembershipTerminationOutcome;
  membership: ProjectMembership;
  closedAssignments: ProjectRoleAssignment[];
  termination: ProjectMembershipTermination;
}


export function isMembershipLifecycleReadOnlyProject(
  status: ProjectLifecycleStatus
): boolean {
  return classifyProjectMembershipLifecycle(
    status
  ) === "LIFECYCLE_READ_ONLY";
}


export function isOperationalProject(
  status: ProjectLifecycleStatus
): boolean {
  return classifyProjectMembershipLifecycle(
    status
  ) === "OPERATIONAL";
}


/**
 * Owner continuity is universal. Manager continuity is required while a
 * project is operational. Sponsor continuity is optional.
 */
export function requiresProtectedRoleContinuity(
  role: ProtectedProjectRole,
  projectStatus: ProjectLifecycleStatus
): boolean {
  if (role === "PROJECT_OWNER") {
    return true;
  }

  if (role === "PROJECT_MANAGER") {
    return isOperationalProject(
      projectStatus
    );
  }

  return false;
}


/**
 * A new Owner or Manager assignment cannot rely on a membership that will
 * expire automatically unless a continuity mechanism is established. VS002-06A
 * records the invariant only; VS002-06C must enforce it transactionally.
 */
export function requiresExpiryContinuityMechanism(
  role: ProtectedProjectRole
): boolean {
  return (
    role === "PROJECT_OWNER" ||
    role === "PROJECT_MANAGER"
  );
}

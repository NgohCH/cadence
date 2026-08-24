export const PROJECT_ROLES = [
  "PROJECT_SPONSOR",
  "PROJECT_OWNER",
  "PROJECT_MANAGER",
  "PROJECT_MEMBER",
  "PROJECT_OBSERVER",
  "PROJECT_AUDITOR",
] as const;

export type ProjectRole =
  typeof PROJECT_ROLES[number];


export const ORDINARY_PROJECT_ROLES = [
  "PROJECT_MEMBER",
  "PROJECT_OBSERVER",
  "PROJECT_AUDITOR",
] as const satisfies readonly ProjectRole[];

export type OrdinaryProjectRole =
  typeof ORDINARY_PROJECT_ROLES[number];


export const PROTECTED_PROJECT_ROLES = [
  "PROJECT_SPONSOR",
  "PROJECT_OWNER",
  "PROJECT_MANAGER",
] as const satisfies readonly ProjectRole[];

export type ProtectedProjectRole =
  typeof PROTECTED_PROJECT_ROLES[number];


export const READ_ONLY_PROJECT_ROLES = [
  "PROJECT_OBSERVER",
  "PROJECT_AUDITOR",
] as const satisfies readonly ProjectRole[];

export type ReadOnlyProjectRole =
  typeof READ_ONLY_PROJECT_ROLES[number];


export function isOrdinaryProjectRole(
  role: ProjectRole
): role is OrdinaryProjectRole {
  return (
    ORDINARY_PROJECT_ROLES as
      readonly ProjectRole[]
  ).includes(role);
}


export function isProtectedProjectRole(
  role: ProjectRole
): role is ProtectedProjectRole {
  return (
    PROTECTED_PROJECT_ROLES as
      readonly ProjectRole[]
  ).includes(role);
}


/**
 * Classifies the baseline read-only roles. Permission enforcement remains
 * owned by ProjectAuthorisationService.
 */
export function isReadOnlyProjectRole(
  role: ProjectRole
): role is ReadOnlyProjectRole {
  return (
    READ_ONLY_PROJECT_ROLES as
      readonly ProjectRole[]
  ).includes(role);
}


/**
 * A role assignment is separate from the membership that authorises a
 * Person's relationship with a Project. Assignments are historical records;
 * changing authority closes the old effective period rather than overwriting
 * or deleting the row.
 */
export interface ProjectRoleAssignment {
  id: string;
  projectId: string;
  membershipId: string;
  role: ProjectRole;
  effectiveFrom: string;
  effectiveTo: string | null;
  assignedBy: string;
  changeReason: string | null;
  createdAt: string;
}

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


export function isProtectedProjectRole(
  role: ProjectRole
): role is ProtectedProjectRole {
  return (
    PROTECTED_PROJECT_ROLES as
      readonly ProjectRole[]
  ).includes(role);
}


/**
 * Classifies the baseline read-only roles without implementing permission
 * enforcement. Project authorisation remains deferred to VS002-03.
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
 * Person's relationship with a Project. VS002-02 persists this history;
 * transfer behaviour remains deliberately deferred to VS002-05.
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

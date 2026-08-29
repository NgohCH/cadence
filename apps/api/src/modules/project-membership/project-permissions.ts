import type {
  ProjectRole,
  ProtectedProjectRole,
} from "./project-role.types";


export const ORDINARY_ROLE_CHANGE_PERMISSION =
  "member.change_role";


export const PROJECT_MEMBER_REMOVAL_PERMISSION =
  "member.remove";


export const PROTECTED_ROLE_PERMISSIONS = {
  PROJECT_MANAGER:
    "member.assign_manager",
  PROJECT_OWNER:
    "member.assign_owner",
  PROJECT_SPONSOR:
    "member.assign_sponsor",
} as const satisfies Record<
  ProtectedProjectRole,
  string
>;

export type ProtectedRolePermission =
  typeof PROTECTED_ROLE_PERMISSIONS[
    ProtectedProjectRole
  ];


export function getProtectedRolePermission(
  role: ProtectedProjectRole
): ProtectedRolePermission {
  return PROTECTED_ROLE_PERMISSIONS[
    role
  ];
}


const ordinaryReadPermissions = [
  "project.view",
  "member.view",
  "message.view",
  "topic.view",
  "decision.view",
  "task.view",
  "blocker.view",
  "milestone.view",
  "file.view",
  "project_health.view",
  "alert.view",
  "activity.view",
  "notification.view",
] as const;


const memberContributionPermissions = [
  "message.create",
  "message.edit_own",
  "message.delete_own",
  "message.react",
  "topic.create",
  "topic.update",
  "decision.propose",
  "task.create",
  "task.update_own",
  "task.complete_own",
  "blocker.create",
  "blocker.update",
  "file.upload",
  "file.link",
  "file.delete_own",
  "agent.use",
] as const;


const managerPermissions = [
  ...ordinaryReadPermissions,
  ...memberContributionPermissions,
  "project.edit",
  "project.change_lifecycle",
  "project.export",
  "member.invite",
  PROJECT_MEMBER_REMOVAL_PERMISSION,
  ORDINARY_ROLE_CHANGE_PERMISSION,
  "message.moderate",
  "topic.change_status",
  "decision.approve",
  "decision.supersede",
  "decision.withdraw",
  "task.assign",
  "task.update_any",
  "task.complete_any",
  "task.cancel_any",
  "blocker.resolve",
  "blocker.reopen",
  "milestone.create",
  "milestone.update",
  "milestone.complete",
  "file.delete_any",
  "agent.approve",
  "project_health.override",
  "alert.manage",
] as const;


const ownerPermissions = [
  ...managerPermissions,
  PROTECTED_ROLE_PERMISSIONS
    .PROJECT_MANAGER,
  PROTECTED_ROLE_PERMISSIONS
    .PROJECT_OWNER,
  PROTECTED_ROLE_PERMISSIONS
    .PROJECT_SPONSOR,
] as const;


const permissionBaseline = {
  PROJECT_SPONSOR: [
    ...ordinaryReadPermissions,
    PROTECTED_ROLE_PERMISSIONS
      .PROJECT_MANAGER,
    PROTECTED_ROLE_PERMISSIONS
      .PROJECT_OWNER,
    PROTECTED_ROLE_PERMISSIONS
      .PROJECT_SPONSOR,
  ],
  PROJECT_OWNER:
    ownerPermissions,
  PROJECT_MANAGER:
    managerPermissions,
  PROJECT_MEMBER: [
    ...ordinaryReadPermissions,
    ...memberContributionPermissions,
  ],
  PROJECT_OBSERVER:
    ordinaryReadPermissions,
  PROJECT_AUDITOR: [
    ...ordinaryReadPermissions,
    "audit.view",
  ],
} as const satisfies Record<
  ProjectRole,
  readonly string[]
>;


/**
 * Returns the frozen VS-002 baseline permissions for effective roles.
 * Keeping the decision behind this function allows a later policy-backed
 * implementation without changing consuming module contracts.
 */
export function getProjectPermissionsForRoles(
  roles: readonly ProjectRole[]
): string[] {
  const permissions =
    new Set<string>();

  for (const role of roles) {
    for (
      const permission of
        permissionBaseline[role]
    ) {
      permissions.add(permission);
    }
  }

  return [...permissions].sort();
}

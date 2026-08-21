import type {
  ProjectRole,
} from "./project-role.types";


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
  "member.remove",
  "member.change_role",
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
  "member.assign_manager",
  "member.assign_owner",
  "member.assign_sponsor",
] as const;


const permissionBaseline = {
  PROJECT_SPONSOR: [
    ...ordinaryReadPermissions,
    "member.assign_manager",
    "member.assign_owner",
    "member.assign_sponsor",
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

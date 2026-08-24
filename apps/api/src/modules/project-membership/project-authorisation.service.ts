import type {
  ProjectMembershipRepository,
} from "./project-membership.repository";

import {
  isProjectMembershipEffectiveAt,
} from "./project-membership";

import {
  getProjectPermissionsForRoles,
} from "./project-permissions";

import {
  ProjectRoleAssignmentInvalidError,
} from "./project-membership.errors";

import type {
  EffectiveProjectAuthorisation,
  ProjectAuthorisationContext,
} from "./project-authorisation.types";

import type {
  ProjectRole,
  ProjectRoleAssignment,
} from "./project-role.types";

import {
  isOrdinaryProjectRole,
} from "./project-role.types";


export interface LegacyProjectAuthorisation {
  hasPermission(
    userId: string,
    projectId: string,
    permissionCode: string
  ): Promise<boolean>;
}


export type ProjectAuthorisationClock =
  () => string;


/**
 * The single VS-002 project-authorisation decision boundary.
 *
 * Stable Person membership and frozen role history are authoritative for new
 * VS-002 access. The legacy RBAC dependency is an explicit, temporary fallback
 * for existing VS-001 memberships whose role codes cannot be truthfully
 * translated into the frozen role vocabulary.
 */
export class ProjectAuthorisationService {
  constructor(
    private readonly repository:
      ProjectMembershipRepository,
    private readonly legacyAuthorisation:
      LegacyProjectAuthorisation,
    private readonly currentTime:
      ProjectAuthorisationClock = () =>
        new Date().toISOString()
  ) {}


  async canAccessProject(
    context: ProjectAuthorisationContext,
    projectId: string
  ): Promise<boolean> {
    return this.hasProjectPermission(
      context,
      projectId,
      "project.view"
    );
  }


  async hasProjectPermission(
    context: ProjectAuthorisationContext,
    projectId: string,
    permission: string
  ): Promise<boolean> {
    const authorisation =
      await this.getEffectiveProjectAuthorisation(
        context.actorPersonId,
        projectId
      );

    if (
      authorisation.permissions.includes(
        permission
      )
    ) {
      return true;
    }

    if (authorisation.roles.length > 0) {
      return false;
    }

    return this.legacyAuthorisation
      .hasPermission(
        context.actorUserId,
        projectId,
        permission
      );
  }


  async getEffectiveProjectRoles(
    personId: string,
    projectId: string
  ): Promise<ProjectRole[]> {
    const authorisation =
      await this.getEffectiveProjectAuthorisation(
        personId,
        projectId
      );

    return authorisation.roles;
  }


  async getEffectiveProjectAuthorisation(
    personId: string,
    projectId: string
  ): Promise<EffectiveProjectAuthorisation> {
    const evaluatedAt =
      normalizeEvaluationTime(
        this.currentTime()
      );

    const memberships =
      await this.repository
        .listMembershipsForPersonInProject(
          personId,
          projectId
        );

    const effectiveMemberships =
      memberships.filter(
        (membership) =>
          membership.projectId === projectId &&
          membership.personId === personId &&
          membership.status === "ACTIVE" &&
          isProjectMembershipEffectiveAt(
            membership,
            evaluatedAt
          )
      );

    const assignments =
      await Promise.all(
        effectiveMemberships.map(
          (membership) =>
            this.repository
              .listRoleAssignments(
                membership.id
              )
        )
      );

    const effectiveAssignments =
      assignments
        .flat()
        .filter(
          (assignment) =>
            assignment.projectId === projectId &&
            effectiveMemberships.some(
              (membership) =>
                membership.id ===
                  assignment.membershipId
            ) &&
            isRoleAssignmentEffectiveAt(
              assignment,
              evaluatedAt
            )
        );

    assertOrdinaryRoleCardinality(
      effectiveAssignments
    );

    const roles =
      uniqueRoles(
        effectiveAssignments
          .map(
            (assignment) =>
              assignment.role
          )
      );

    return {
      personId,
      projectId,
      membershipIds:
        effectiveMemberships.map(
          (membership) => membership.id
        ),
      roles,
      permissions:
        getProjectPermissionsForRoles(
          roles
        ),
      evaluatedAt,
    };
  }
}


function assertOrdinaryRoleCardinality(
  assignments:
    readonly ProjectRoleAssignment[]
): void {
  const ordinaryCountsByMembership =
    new Map<string, number>();

  for (const assignment of assignments) {
    if (
      !isOrdinaryProjectRole(
        assignment.role
      )
    ) {
      continue;
    }

    const count =
      (
        ordinaryCountsByMembership.get(
          assignment.membershipId
        ) ?? 0
      ) + 1;

    if (count > 1) {
      throw new ProjectRoleAssignmentInvalidError(
        "A project membership cannot have more than one effective ordinary role."
      );
    }

    ordinaryCountsByMembership.set(
      assignment.membershipId,
      count
    );
  }
}


function isRoleAssignmentEffectiveAt(
  assignment: ProjectRoleAssignment,
  evaluatedAt: string
): boolean {
  const evaluationTime =
    Date.parse(evaluatedAt);

  const effectiveFrom =
    Date.parse(assignment.effectiveFrom);

  const effectiveTo =
    assignment.effectiveTo === null
      ? null
      : Date.parse(assignment.effectiveTo);

  return (
    Number.isFinite(effectiveFrom) &&
    (
      effectiveTo === null ||
      (
        Number.isFinite(effectiveTo) &&
        effectiveTo > effectiveFrom
      )
    ) &&
    evaluationTime >= effectiveFrom &&
    (
      effectiveTo === null ||
      evaluationTime < effectiveTo
    )
  );
}


function uniqueRoles(
  roles: readonly ProjectRole[]
): ProjectRole[] {
  return [...new Set(roles)].sort();
}


function normalizeEvaluationTime(
  value: string
): string {
  const timestamp =
    Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    throw new Error(
      "Project authorisation clock returned an invalid timestamp."
    );
  }

  return new Date(timestamp).toISOString();
}

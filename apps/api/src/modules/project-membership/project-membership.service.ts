import {
  randomUUID,
} from "node:crypto";

import type {
  IdentityPersistenceRepository,
} from "../identity/identity.repository";

import type {
  CadencePerson,
  OrganisationalAffiliation,
} from "../identity/identity.types";

import type {
  ProjectAuthorisationContext,
} from "./project-authorisation.types";

import type {
  ProjectMemberAdmissionRepository,
  ProjectMemberAdmissionResult,
} from "./project-member-admission.repository";

import {
  ProjectMemberPersonNotFoundError,
  ProjectMembershipAlreadyActiveError,
  ProjectMembershipPermissionDeniedError,
  ProjectMembershipValidationError,
  ProjectRoleAssignmentInvalidError,
  ProjectRoleTransferRequiredError,
} from "./project-membership.errors";

import type {
  ProjectMembershipRepository,
} from "./project-membership.repository";

import type {
  ProjectRoleManagementRepository,
} from "./project-role-management.repository";

import {
  createProjectMembership,
  isProjectMembershipEffectiveAt,
} from "./project-membership";

import type {
  CreateProjectMembershipInput,
  ProjectMembership,
} from "./project-membership.types";

import type {
  OrdinaryProjectRole,
  ProjectRole,
  ProjectRoleAssignment,
  ProtectedProjectRole,
} from "./project-role.types";

import {
  isOrdinaryProjectRole,
  isProtectedProjectRole,
} from "./project-role.types";

import {
  getProtectedRolePermission,
  ORDINARY_ROLE_CHANGE_PERMISSION,
} from "./project-permissions";


export interface ProjectAuthorisationPort {
  hasProjectPermission(
    context: ProjectAuthorisationContext,
    projectId: string,
    permission: string
  ): Promise<boolean>;

  getEffectiveProjectRoles(
    personId: string,
    projectId: string
  ): Promise<ProjectRole[]>;
}


export type ProjectMemberIdentityPort =
  Pick<
    IdentityPersistenceRepository,
    | "findPersonById"
    | "listOrganisationalAffiliations"
  >;


export interface AddProjectMemberInput {
  personId: string;

  /**
   * VS002-04 admits ordinary project members only.
   *
   * General role assignment and protected responsibility transfer belong
   * to VS002-05.
   */
  role: "PROJECT_MEMBER";

  effectiveFrom: string;
  effectiveTo: string | null;
}


/**
 * Immediate ordinary-role change requested through the application service.
 * The service clock supplies the effective timestamp; callers cannot schedule
 * a future transition in VS002-05.
 */
export interface ChangeOrdinaryRoleInput {
  membershipId: string;
  role: OrdinaryProjectRole;
  reason: string | null;
}


export interface ChangeOrdinaryRoleResult {
  closedAssignment:
    ProjectRoleAssignment | null;
  roleAssignment:
    ProjectRoleAssignment;
  effectiveAt: string;
}


/**
 * The same protected command covers first appointment and later transfer.
 * Persistence determines which occurred while enforcing one effective holder
 * per protected role and project.
 */
export interface TransferProtectedRoleInput {
  role: ProtectedProjectRole;
  newMembershipId: string;
  reason: string;
}


export type ProtectedRoleOperationKind =
  | "APPOINTMENT"
  | "TRANSFER";


export interface TransferProtectedRoleResult {
  operation:
    ProtectedRoleOperationKind;
  outgoingAssignment:
    ProjectRoleAssignment | null;
  roleAssignment:
    ProjectRoleAssignment;
  effectiveAt: string;
  correlationId: string;
}


/**
 * Role commands require request correlation in addition to the stable Person
 * fields used by ProjectAuthorisationService.
 */
export type ProjectRoleCommandContext =
  ProjectAuthorisationContext & {
    correlationId: string;
  };


export interface ProjectMemberView {
  membership: ProjectMembership;
  person: CadencePerson;
  roles: ProjectRole[];
  affiliation:
    OrganisationalAffiliation | null;
}


export type ProjectMembershipClock =
  () => string;

export type ProjectMembershipIdGenerator =
  () => string;


/**
 * VS002-04 application boundary for member query and ordinary admission.
 *
 * It owns:
 * - member.view enforcement;
 * - member.invite enforcement;
 * - stable Person existence validation;
 * - open-ended and time-bounded membership creation;
 * - duplicate/overlapping membership protection; and
 * - initial PROJECT_MEMBER admission.
 *
 * General role management, protected transfers, removal, expiry processing,
 * domain events, Audit projection, and frontend concerns remain outside this
 * checkpoint.
 */
export class ProjectMembershipService {
  constructor(
    private readonly authorisation:
      ProjectAuthorisationPort,

    private readonly membershipRepository:
      ProjectMembershipRepository,

    private readonly admissionRepository:
      ProjectMemberAdmissionRepository,

    private readonly identityRepository:
      ProjectMemberIdentityPort,

    private readonly roleManagementRepository:
      ProjectRoleManagementRepository,

    private readonly currentTime:
      ProjectMembershipClock = () =>
        new Date().toISOString(),

    private readonly generateId:
      ProjectMembershipIdGenerator =
        () => randomUUID()
  ) {}


  async listProjectMembers(
    context: ProjectAuthorisationContext,
    projectId: string
  ): Promise<ProjectMemberView[]> {
    await this.requirePermission(
      context,
      projectId,
      "member.view"
    );

    const evaluatedAt =
      normalizeTimestamp(
        this.currentTime(),
        "current time"
      );

    const memberships =
      await this.membershipRepository
        .listMembershipsForProject(
          projectId
        );

    const currentMemberships =
      memberships.filter(
        (membership) =>
          membership.projectId ===
            projectId &&
          membership.status ===
            "ACTIVE" &&
          isProjectMembershipEffectiveAt(
            membership,
            evaluatedAt
          )
      );

    return Promise.all(
      currentMemberships.map(
        async (
          membership
        ): Promise<ProjectMemberView> => {
          const person =
            await this.identityRepository
              .findPersonById(
                membership.personId
              );

          if (person === null) {
            throw new Error(
              `Project membership ${membership.id} references missing Person ${membership.personId}.`
            );
          }

          const [
            roles,
            affiliations,
          ] =
            await Promise.all([
              this.authorisation
                .getEffectiveProjectRoles(
                  membership.personId,
                  projectId
                ),

              this.identityRepository
                .listOrganisationalAffiliations(
                  membership.personId
                ),
            ]);

          return {
            membership,
            person,
            roles,
            affiliation:
              selectEffectiveAffiliation(
                affiliations,
                evaluatedAt
              ),
          };
        }
      )
    );
  }


  async addProjectMember(
    context: ProjectAuthorisationContext,
    projectId: string,
    input: AddProjectMemberInput
  ): Promise<ProjectMemberAdmissionResult> {
    await this.requirePermission(
      context,
      projectId,
      "member.invite"
    );

    if (
      input.role !==
      "PROJECT_MEMBER"
    ) {
      throw new ProjectMembershipValidationError(
        "VS002-04 add-member flow supports only PROJECT_MEMBER."
      );
    }

    const person =
      await this.identityRepository
        .findPersonById(
          input.personId
        );

    if (person === null) {
      throw new ProjectMemberPersonNotFoundError();
    }

    const createdAt =
      normalizeTimestamp(
        this.currentTime(),
        "current time"
      );

    const validatedMembership =
      createProjectMembership({
        id:
          this.generateId(),

        personId:
          person.id,

        projectId,

        effectiveFrom:
          input.effectiveFrom,

        effectiveTo:
          input.effectiveTo,

        status:
          "ACTIVE",

        grantedBy:
          context.actorPersonId,

        createdAt,

        terminationReason:
          null,
      });

    const existingMemberships =
      await this.membershipRepository
        .listMembershipsForPersonInProject(
          person.id,
          projectId
        );

    if (
      existingMemberships.some(
        (existing) =>
          existing.status === "ACTIVE" &&
          membershipPeriodsOverlap(
            existing,
            validatedMembership
          )
      )
    ) {
      throw new ProjectMembershipAlreadyActiveError();
    }

    const membership:
      CreateProjectMembershipInput = {
        ...validatedMembership,

        grantedBy:
          context.actorPersonId,
      };

    const roleAssignment:
      ProjectRoleAssignment = {
        id:
          this.generateId(),

        projectId,

        membershipId:
          membership.id,

        role:
          "PROJECT_MEMBER",

        effectiveFrom:
          membership.effectiveFrom,

        effectiveTo:
          membership.effectiveTo,

        assignedBy:
          context.actorPersonId,

        changeReason:
          null,

        createdAt,
      };

    return this.admissionRepository
      .addProjectMember({
        membership,
        roleAssignment,
      });
  }


  async changeOrdinaryRole(
    context: ProjectRoleCommandContext,
    projectId: string,
    input: ChangeOrdinaryRoleInput
  ): Promise<ChangeOrdinaryRoleResult> {
    assertRequiredText(
      projectId,
      "projectId"
    );
    assertRequiredText(
      input.membershipId,
      "membershipId"
    );

    if (
      isProtectedProjectRole(
        input.role as ProjectRole
      )
    ) {
      throw new ProjectRoleTransferRequiredError();
    }

    if (
      !isOrdinaryProjectRole(
        input.role as ProjectRole
      )
    ) {
      throw new ProjectRoleAssignmentInvalidError();
    }

    const reason =
      normalizeOptionalReason(
        input.reason
      );

    await this.requirePermission(
      context,
      projectId,
      ORDINARY_ROLE_CHANGE_PERMISSION
    );

    const effectiveAt =
      normalizeTimestamp(
        this.currentTime(),
        "current time"
      );

    const membership =
      await this.requireEffectiveMembership(
        input.membershipId,
        projectId,
        effectiveAt
      );

    const assignments =
      await this.membershipRepository
        .listRoleAssignments(
          membership.id
        );

    const effectiveOrdinaryAssignments =
      assignments.filter(
        (assignment) =>
          assignment.projectId === projectId &&
          isOrdinaryProjectRole(
            assignment.role
          ) &&
          isRoleAssignmentEffectiveAt(
            assignment,
            effectiveAt
          )
      );

    if (
      effectiveOrdinaryAssignments.length > 1
    ) {
      throw new ProjectRoleAssignmentInvalidError(
        "A project membership cannot have more than one effective ordinary role."
      );
    }

    if (
      effectiveOrdinaryAssignments[0]
        ?.role === input.role
    ) {
      throw new ProjectRoleAssignmentInvalidError(
        "The requested ordinary project role is already effective."
      );
    }

    const result =
      await this.mapRolePersistenceFailure(
        this.roleManagementRepository
          .changeOrdinaryRole({
          assignmentId:
            this.generateId(),
          projectId,
          membershipId:
            membership.id,
          role:
            input.role,
          effectiveAt,
          assignedByPersonId:
            context.actorPersonId,
          changeReason:
            reason,
          createdAt:
            effectiveAt,
        })
      );

    return {
      closedAssignment:
        result.closedAssignment,
      roleAssignment:
        result.roleAssignment,
      effectiveAt,
    };
  }


  async transferProtectedRole(
    context: ProjectRoleCommandContext,
    projectId: string,
    input: TransferProtectedRoleInput
  ): Promise<TransferProtectedRoleResult> {
    assertRequiredText(
      projectId,
      "projectId"
    );
    assertRequiredText(
      input.newMembershipId,
      "newMembershipId"
    );
    assertRequiredText(
      context.correlationId,
      "correlationId"
    );

    if (
      !isProtectedProjectRole(
        input.role as ProjectRole
      )
    ) {
      throw new ProjectRoleAssignmentInvalidError(
        "A protected-role operation requires Sponsor, Owner, or Manager."
      );
    }

    const reason =
      normalizeRequiredReason(
        input.reason
      );

    await this.requirePermission(
      context,
      projectId,
      getProtectedRolePermission(
        input.role
      )
    );

    const effectiveAt =
      normalizeTimestamp(
        this.currentTime(),
        "current time"
      );

    const membership =
      await this.requireEffectiveMembership(
        input.newMembershipId,
        projectId,
        effectiveAt
      );

    const result =
      await this.mapRolePersistenceFailure(
        this.roleManagementRepository
          .transferProtectedRole({
          transferId:
            this.generateId(),
          incomingAssignmentId:
            this.generateId(),
          projectId,
          incomingMembershipId:
            membership.id,
          role:
            input.role,
          effectiveAt,
          authorisedByPersonId:
            context.actorPersonId,
          reason,
          correlationId:
            context.correlationId,
          createdAt:
            effectiveAt,
        })
      );

    return {
      operation:
        result.outgoingAssignment === null
          ? "APPOINTMENT"
          : "TRANSFER",
      outgoingAssignment:
        result.outgoingAssignment,
      roleAssignment:
        result.roleAssignment,
      effectiveAt,
      correlationId:
        result.transfer.correlationId,
    };
  }


  private async requireEffectiveMembership(
    membershipId: string,
    projectId: string,
    effectiveAt: string
  ): Promise<ProjectMembership> {
    const membership =
      await this.membershipRepository
        .findMembershipById(
          membershipId
        );

    if (
      membership === null ||
      membership.projectId !== projectId ||
      membership.status !== "ACTIVE" ||
      !isProjectMembershipEffectiveAt(
        membership,
        effectiveAt
      )
    ) {
      throw new ProjectRoleAssignmentInvalidError(
        "The target project membership is not effective for this operation."
      );
    }

    return membership;
  }


  private async mapRolePersistenceFailure<T>(
    operation: Promise<T>
  ): Promise<T> {
    try {
      return await operation;
    } catch (error) {
      if (
        error instanceof
          ProjectRoleAssignmentInvalidError ||
        error instanceof
          ProjectRoleTransferRequiredError
      ) {
        throw error;
      }

      throw new ProjectRoleAssignmentInvalidError(
        "Project role persistence rejected the requested transition."
      );
    }
  }


  private async requirePermission(
    context: ProjectAuthorisationContext,
    projectId: string,
    permission: string
  ): Promise<void> {
    const allowed =
      await this.authorisation
        .hasProjectPermission(
          context,
          projectId,
          permission
        );

    if (!allowed) {
      throw new ProjectMembershipPermissionDeniedError();
    }
  }
}


function isRoleAssignmentEffectiveAt(
  assignment: ProjectRoleAssignment,
  effectiveAt: string
): boolean {
  const evaluated =
    parseTimestamp(
      effectiveAt,
      "effectiveAt"
    );
  const from =
    parseTimestamp(
      assignment.effectiveFrom,
      "role effectiveFrom"
    );
  const to =
    assignment.effectiveTo === null
      ? null
      : parseTimestamp(
          assignment.effectiveTo,
          "role effectiveTo"
        );

  return (
    evaluated >= from &&
    (to === null || evaluated < to)
  );
}


function assertRequiredText(
  value: string,
  fieldName: string
): void {
  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw new ProjectRoleAssignmentInvalidError(
      `${fieldName} is required.`
    );
  }
}


function normalizeOptionalReason(
  reason: string | null
): string | null {
  if (reason === null) {
    return null;
  }

  if (typeof reason !== "string") {
    throw new ProjectRoleAssignmentInvalidError(
      "An ordinary role-change reason must be text or null."
    );
  }

  const normalized = reason.trim();

  return normalized.length === 0
    ? null
    : normalized;
}


function normalizeRequiredReason(
  reason: string
): string {
  if (typeof reason !== "string") {
    throw new ProjectRoleAssignmentInvalidError(
      "A protected role operation requires a reason."
    );
  }

  const normalized = reason.trim();

  if (normalized.length === 0) {
    throw new ProjectRoleAssignmentInvalidError(
      "A protected role operation requires a reason."
    );
  }

  return normalized;
}


function membershipPeriodsOverlap(
  existing: ProjectMembership,
  proposed: ProjectMembership
): boolean {
  const existingFrom =
    parseTimestamp(
      existing.effectiveFrom,
      "existing effectiveFrom"
    );

  const existingTo =
    existing.effectiveTo === null
      ? Number.POSITIVE_INFINITY
      : parseTimestamp(
          existing.effectiveTo,
          "existing effectiveTo"
        );

  const proposedFrom =
    parseTimestamp(
      proposed.effectiveFrom,
      "proposed effectiveFrom"
    );

  const proposedTo =
    proposed.effectiveTo === null
      ? Number.POSITIVE_INFINITY
      : parseTimestamp(
          proposed.effectiveTo,
          "proposed effectiveTo"
        );

  return (
    existingFrom < proposedTo &&
    proposedFrom < existingTo
  );
}


function selectEffectiveAffiliation(
  affiliations:
    OrganisationalAffiliation[],
  evaluatedAt: string
): OrganisationalAffiliation | null {
  const evaluationTime =
    parseTimestamp(
      evaluatedAt,
      "evaluatedAt"
    );

  const effective =
    affiliations
      .filter(
        (affiliation) => {
          const from =
            parseTimestamp(
              affiliation.effectiveFrom,
              "affiliation effectiveFrom"
            );

          const to =
            affiliation.effectiveTo === null
              ? null
              : parseTimestamp(
                  affiliation.effectiveTo,
                  "affiliation effectiveTo"
                );

          return (
            evaluationTime >= from &&
            (
              to === null ||
              evaluationTime < to
            )
          );
        }
      )
      .sort(
        (left, right) =>
          parseTimestamp(
            right.effectiveFrom,
            "affiliation effectiveFrom"
          ) -
          parseTimestamp(
            left.effectiveFrom,
            "affiliation effectiveFrom"
          )
      );

  return effective[0] ?? null;
}


function normalizeTimestamp(
  value: string,
  fieldName: string
): string {
  return new Date(
    parseTimestamp(
      value,
      fieldName
    )
  ).toISOString();
}


function parseTimestamp(
  value: string,
  fieldName: string
): number {
  const parsed =
    Date.parse(value);

  if (!Number.isFinite(parsed)) {
    throw new ProjectMembershipValidationError(
      `${fieldName} must be a valid timestamp.`
    );
  }

  return parsed;
}

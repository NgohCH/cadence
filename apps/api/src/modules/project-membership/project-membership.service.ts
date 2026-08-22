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
} from "./project-membership.errors";

import type {
  ProjectMembershipRepository,
} from "./project-membership.repository";

import {
  createProjectMembership,
  isProjectMembershipEffectiveAt,
} from "./project-membership";

import type {
  CreateProjectMembershipInput,
  ProjectMembership,
} from "./project-membership.types";

import type {
  ProjectRole,
  ProjectRoleAssignment,
} from "./project-role.types";


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

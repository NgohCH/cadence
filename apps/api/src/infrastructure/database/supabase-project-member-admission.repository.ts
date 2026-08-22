import type {
  SupabaseClient,
} from "@supabase/supabase-js";

import {
  ProjectMemberPersonNotFoundError,
  ProjectMembershipAlreadyActiveError,
  ProjectMembershipValidationError,
} from "../../modules/project-membership/project-membership.errors";

import type {
  ProjectMemberAdmissionInput,
  ProjectMemberAdmissionRepository,
  ProjectMemberAdmissionResult,
} from "../../modules/project-membership/project-member-admission.repository";

import type {
  ProjectMembership,
} from "../../modules/project-membership/project-membership.types";

import type {
  ProjectRoleAssignment,
} from "../../modules/project-membership/project-role.types";


type ProjectMemberAdmissionRow = {
  membership_id: string;
  membership_person_id: string;
  membership_project_id: string;
  membership_effective_from: string;
  membership_effective_to: string | null;
  membership_status:
    ProjectMembership["status"];
  membership_granted_by_person_id:
    string;
  membership_created_at: string;
  membership_termination_reason:
    string | null;

  role_assignment_id: string;
  role_assignment_project_id: string;
  role_assignment_membership_id:
    string;
  role_assignment_role:
    ProjectRoleAssignment["role"];
  role_assignment_effective_from:
    string;
  role_assignment_effective_to:
    string | null;
  role_assignment_assigned_by_person_id:
    string;
  role_assignment_change_reason:
    string | null;
  role_assignment_created_at:
    string;
};


export class SupabaseProjectMemberAdmissionRepository
  implements ProjectMemberAdmissionRepository
{
  constructor(
    private readonly db: SupabaseClient
  ) {}


  async addProjectMember(
    input: ProjectMemberAdmissionInput
  ): Promise<ProjectMemberAdmissionResult> {
    assertAdmissionShape(
      input
    );

    const {
      membership,
      roleAssignment,
    } = input;

    const {
      data,
      error,
    } = await this.db.rpc(
      "add_project_member",
      {
        p_membership_id:
          membership.id,

        p_project_id:
          membership.projectId,

        p_person_id:
          membership.personId,

        p_effective_from:
          membership.effectiveFrom,

        p_effective_to:
          membership.effectiveTo,

        p_granted_by_person_id:
          membership.grantedBy,

        p_membership_created_at:
          membership.createdAt,

        p_role_assignment_id:
          roleAssignment.id,

        p_assigned_by_person_id:
          roleAssignment.assignedBy,

        p_role_created_at:
          roleAssignment.createdAt,
      }
    );

    if (error) {
      throwMappedError(
        error.message
      );
    }

    const rows =
      (data ?? []) as
        ProjectMemberAdmissionRow[];

    const row =
      rows[0];

    if (!row) {
      throw new Error(
        "Project member admission returned no row."
      );
    }

    return {
      membership: {
        id:
          row.membership_id,

        personId:
          row.membership_person_id,

        projectId:
          row.membership_project_id,

        effectiveFrom:
          row.membership_effective_from,

        effectiveTo:
          row.membership_effective_to,

        status:
          row.membership_status,

        grantedBy:
          row.membership_granted_by_person_id,

        createdAt:
          row.membership_created_at,

        terminationReason:
          row.membership_termination_reason,
      },

      roleAssignment: {
        id:
          row.role_assignment_id,

        projectId:
          row.role_assignment_project_id,

        membershipId:
          row.role_assignment_membership_id,

        role:
          row.role_assignment_role,

        effectiveFrom:
          row.role_assignment_effective_from,

        effectiveTo:
          row.role_assignment_effective_to,

        assignedBy:
          row.role_assignment_assigned_by_person_id,

        changeReason:
          row.role_assignment_change_reason,

        createdAt:
          row.role_assignment_created_at,
      },
    };
  }
}


function assertAdmissionShape(
  input: ProjectMemberAdmissionInput
): void {
  const {
    membership,
    roleAssignment,
  } = input;

  if (
    roleAssignment.role !==
      "PROJECT_MEMBER"
  ) {
    throw new ProjectMembershipValidationError(
      "VS002-04 admission requires PROJECT_MEMBER."
    );
  }

  if (
    roleAssignment.membershipId !==
      membership.id ||
    roleAssignment.projectId !==
      membership.projectId
  ) {
    throw new ProjectMembershipValidationError(
      "Initial role assignment must belong to the new membership and project."
    );
  }

  if (
    roleAssignment.effectiveFrom !==
      membership.effectiveFrom ||
    roleAssignment.effectiveTo !==
      membership.effectiveTo
  ) {
    throw new ProjectMembershipValidationError(
      "Initial PROJECT_MEMBER role period must match the membership period."
    );
  }

  if (
    roleAssignment.assignedBy !==
      membership.grantedBy
  ) {
    throw new ProjectMembershipValidationError(
      "Membership grantor and initial role assigner must be the same Person."
    );
  }
}


function throwMappedError(
  message: string
): never {
  if (
    message.includes(
      "PROJECT_MEMBERSHIP_ALREADY_ACTIVE"
    )
  ) {
    throw new ProjectMembershipAlreadyActiveError();
  }

  if (
    message.includes(
      "PROJECT_MEMBER_PERSON_NOT_FOUND"
    )
  ) {
    throw new ProjectMemberPersonNotFoundError();
  }

  if (
    message.includes(
      "PROJECT_MEMBERSHIP_PERIOD_INVALID"
    ) ||
    message.includes(
      "PROJECT_MEMBER_ADMISSION_REFERENCE_MISSING"
    ) ||
    message.includes(
      "PROJECT_MEMBER_ADMISSION_ACTOR_MISMATCH"
    ) ||
    message.includes(
      "PROJECT_MEMBER_GRANTOR_NOT_FOUND"
    )
  ) {
    throw new ProjectMembershipValidationError(
      message
    );
  }

  throw new Error(
    message
  );
}

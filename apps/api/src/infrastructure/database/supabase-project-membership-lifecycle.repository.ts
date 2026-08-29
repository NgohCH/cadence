import type {
  SupabaseClient,
} from "@supabase/supabase-js";

import {
  ActiveResponsibilitiesExistError,
  LastRequiredRoleHolderError,
  MemberRemovalNotPermittedError,
  ProjectMembershipExpiredError,
  ProjectMembershipNotFoundError,
} from "../../modules/project-membership/project-membership.errors";

import type {
  AdministrativeMembershipTerminationPersistenceInput,
  BoundedProtectedRoleViolation,
  MembershipExpiryFinalisationPersistenceInput,
  ProjectMembershipLifecycleRepository,
} from "../../modules/project-membership/project-membership-lifecycle.repository";

import type {
  ProjectMembershipTermination,
  ProjectMembershipTerminationOutcome,
  ProjectMembershipTerminationResult,
} from "../../modules/project-membership/project-membership-lifecycle.types";

import type {
  ProjectMembership,
} from "../../modules/project-membership/project-membership.types";

import type {
  ProjectRoleAssignment,
} from "../../modules/project-membership/project-role.types";


type LifecycleRow = {
  lifecycle_outcome:
    ProjectMembershipTerminationOutcome;
  result_membership_id: string;
  result_person_id: string;
  result_project_id: string;
  result_effective_from: string;
  result_effective_to: string;
  result_membership_status:
    ProjectMembership["status"];
  result_granted_by_person_id:
    string | null;
  result_created_at: string;
  result_termination_kind:
    ProjectMembershipTermination["type"];
  result_terminated_by_person_id:
    string | null;
  result_termination_reason:
    string | null;
  result_termination_correlation_id:
    string;
  result_terminated_at: string;
  closed_assignments:
    RoleAssignmentRow[];
};


type RoleAssignmentRow = {
  id: string;
  project_id: string;
  membership_id: string;
  role: ProjectRoleAssignment["role"];
  effective_from: string;
  effective_to: string | null;
  assigned_by_person_id: string;
  change_reason: string | null;
  created_at: string;
};


type ViolationRow = {
  project_id: string;
  membership_id: string;
  assignment_id: string;
  role: BoundedProtectedRoleViolation["role"];
  membership_effective_to: string;
};


type MembershipRow = {
  id: string;
  person_id: string;
  project_id: string;
  effective_from: string;
  effective_to: string | null;
  membership_status:
    ProjectMembership["status"];
  granted_by_person_id:
    string | null;
  created_at: string;
  termination_reason: string | null;
};


const membershipColumns = `
  id,
  person_id,
  project_id,
  effective_from,
  effective_to,
  membership_status,
  granted_by_person_id,
  created_at,
  termination_reason
`;


export class SupabaseProjectMembershipLifecycleRepository
  implements ProjectMembershipLifecycleRepository
{
  constructor(
    private readonly db: SupabaseClient
  ) {}


  async listDueMemberships(
    evaluatedAt: string
  ): Promise<ProjectMembership[]> {
    const { data, error } =
      await this.db
        .from("project_memberships")
        .select(membershipColumns)
        .eq("membership_status", "ACTIVE")
        .not("effective_to", "is", null)
        .lte("effective_to", evaluatedAt)
        .order("effective_to", {
          ascending: true,
        })
        .order("id", {
          ascending: true,
        });

    if (error) {
      throw new Error(
        "Membership expiry discovery failed."
      );
    }

    return (
      (data ?? []) as MembershipRow[]
    ).map(mapMembership);
  }


  async terminateAdministratively(
    input: AdministrativeMembershipTerminationPersistenceInput
  ): Promise<ProjectMembershipTerminationResult> {
    return this.executeLifecycleRpc(
      "terminate_project_membership",
      {
        p_project_id:
          input.projectId,
        p_membership_id:
          input.membershipId,
        p_effective_at:
          input.effectiveAt,
        p_terminated_by_person_id:
          input.terminatedByPersonId,
        p_termination_reason:
          input.terminationReason,
        p_correlation_id:
          input.correlationId,
      }
    );
  }


  async finaliseExpiry(
    input: MembershipExpiryFinalisationPersistenceInput
  ): Promise<ProjectMembershipTerminationResult> {
    return this.executeLifecycleRpc(
      "finalize_project_membership_expiry",
      {
        p_project_id:
          input.projectId,
        p_membership_id:
          input.membershipId,
        p_finalized_at:
          input.finalisedAt,
        p_termination_reason:
          input.terminationReason,
        p_correlation_id:
          input.correlationId,
      }
    );
  }


  async listBoundedProtectedRoleViolations(
    evaluatedAt: string
  ): Promise<BoundedProtectedRoleViolation[]> {
    const { data, error } =
      await this.db.rpc(
        "list_bounded_protected_role_violations",
        {
          p_evaluated_at:
            evaluatedAt,
        }
      );

    if (error) {
      throw new Error(error.message);
    }

    return (
      (data ?? []) as ViolationRow[]
    ).map((row) => ({
      projectId:
        row.project_id,
      membershipId:
        row.membership_id,
      assignmentId:
        row.assignment_id,
      role:
        row.role,
      membershipEffectiveTo:
        row.membership_effective_to,
    }));
  }


  private async executeLifecycleRpc(
    name: string,
    args: Record<string, unknown>
  ): Promise<ProjectMembershipTerminationResult> {
    const { data, error } =
      await this.db.rpc(name, args);

    if (error) {
      throwMappedLifecycleError(
        error.message
      );
    }

    const row =
      ((data ?? []) as LifecycleRow[])[0];

    if (!row) {
      throw new Error(
        "Membership lifecycle RPC returned no row."
      );
    }

    return mapLifecycleResult(row);
  }
}


function mapLifecycleResult(
  row: LifecycleRow
): ProjectMembershipTerminationResult {
  const termination =
    mapTermination(row);

  return {
    outcome:
      row.lifecycle_outcome,
    membership: {
      id:
        row.result_membership_id,
      personId:
        row.result_person_id,
      projectId:
        row.result_project_id,
      effectiveFrom:
        row.result_effective_from,
      effectiveTo:
        row.result_effective_to,
      status:
        row.result_membership_status,
      grantedBy:
        row.result_granted_by_person_id,
      createdAt:
        row.result_created_at,
      terminationReason:
        row.result_termination_reason,
    },
    closedAssignments:
      row.closed_assignments.map(
        mapRoleAssignment
      ),
    termination,
  };
}


function mapMembership(
  row: MembershipRow
): ProjectMembership {
  return {
    id: row.id,
    personId: row.person_id,
    projectId: row.project_id,
    effectiveFrom:
      row.effective_from,
    effectiveTo:
      row.effective_to,
    status:
      row.membership_status,
    grantedBy:
      row.granted_by_person_id,
    createdAt:
      row.created_at,
    terminationReason:
      row.termination_reason,
  };
}


function mapTermination(
  row: LifecycleRow
): ProjectMembershipTermination {
  const common = {
    projectId:
      row.result_project_id,
    membershipId:
      row.result_membership_id,
    terminationReason:
      row.result_termination_reason,
    correlationId:
      row.result_termination_correlation_id,
    terminatedAt:
      row.result_terminated_at,
  };

  if (
    row.result_termination_kind ===
      "EXPIRY"
  ) {
    if (
      row.result_terminated_by_person_id !==
      null
    ) {
      throw new Error(
        "Expiry lifecycle result contained an actor."
      );
    }

    return {
      ...common,
      type: "EXPIRY",
      terminatedByPersonId: null,
    };
  }

  if (
    row.result_terminated_by_person_id ===
    null
  ) {
    throw new Error(
      "Administrative lifecycle result omitted its actor."
    );
  }

  return {
    ...common,
    type:
      "ADMINISTRATIVE_REMOVAL",
    terminatedByPersonId:
      row.result_terminated_by_person_id,
  };
}


function mapRoleAssignment(
  row: RoleAssignmentRow
): ProjectRoleAssignment {
  return {
    id: row.id,
    projectId: row.project_id,
    membershipId:
      row.membership_id,
    role: row.role,
    effectiveFrom:
      row.effective_from,
    effectiveTo:
      row.effective_to,
    assignedBy:
      row.assigned_by_person_id,
    changeReason:
      row.change_reason,
    createdAt:
      row.created_at,
  };
}


function throwMappedLifecycleError(
  message: string
): never {
  if (
    message.includes(
      "PROJECT_MEMBERSHIP_NOT_FOUND"
    ) ||
    message.includes(
      "PROJECT_NOT_FOUND"
    )
  ) {
    throw new ProjectMembershipNotFoundError();
  }

  if (
    message.includes(
      "PROJECT_MEMBERSHIP_EXPIRED"
    )
  ) {
    throw new ProjectMembershipExpiredError();
  }

  if (
    message.includes(
      "LAST_REQUIRED_ROLE_HOLDER"
    )
  ) {
    throw new LastRequiredRoleHolderError();
  }

  if (
    message.includes(
      "ACTIVE_RESPONSIBILITIES_EXIST"
    )
  ) {
    throw new ActiveResponsibilitiesExistError();
  }

  if (
    message.includes(
      "MEMBER_REMOVAL_NOT_PERMITTED"
    ) ||
    message.includes(
      "PROJECT_MEMBERSHIP_"
    )
  ) {
    throw new MemberRemovalNotPermittedError();
  }

  throw new Error(message);
}

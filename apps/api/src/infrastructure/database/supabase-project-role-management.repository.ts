import type {
  SupabaseClient,
} from "@supabase/supabase-js";

import {
  ProjectRoleAssignmentInvalidError,
  ProjectRoleTransferRequiredError,
} from "../../modules/project-membership/project-membership.errors";

import type {
  ChangeOrdinaryRolePersistenceInput,
  ChangeOrdinaryRolePersistenceResult,
  ProjectRoleManagementRepository,
  ProjectRoleTransferRecord,
  TransferProtectedRolePersistenceInput,
  TransferProtectedRolePersistenceResult,
} from "../../modules/project-membership/project-role-management.repository";

import type {
  ProjectRoleAssignment,
} from "../../modules/project-membership/project-role.types";


type AssignmentColumns = {
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

type OrdinaryRoleChangeRow = {
  closed_assignment_id: string | null;
  closed_assignment_project_id: string | null;
  closed_assignment_membership_id: string | null;
  closed_assignment_role: ProjectRoleAssignment["role"] | null;
  closed_assignment_effective_from: string | null;
  closed_assignment_effective_to: string | null;
  closed_assignment_assigned_by_person_id: string | null;
  closed_assignment_change_reason: string | null;
  closed_assignment_created_at: string | null;
  new_assignment_id: string;
  new_assignment_project_id: string;
  new_assignment_membership_id: string;
  new_assignment_role: ProjectRoleAssignment["role"];
  new_assignment_effective_from: string;
  new_assignment_effective_to: string | null;
  new_assignment_assigned_by_person_id: string;
  new_assignment_change_reason: string | null;
  new_assignment_created_at: string;
};

type ProtectedRoleTransferRow = OrdinaryRoleChangeRow & {
  transfer_id: string;
  transfer_project_id: string;
  transfer_role: ProjectRoleTransferRecord["role"];
  transfer_outgoing_assignment_id: string | null;
  transfer_incoming_assignment_id: string;
  transfer_authorised_by_person_id: string;
  transfer_reason: string;
  transfer_correlation_id: string;
  transfer_effective_at: string;
  transfer_created_at: string;
};


export class SupabaseProjectRoleManagementRepository
  implements ProjectRoleManagementRepository
{
  constructor(
    private readonly db: SupabaseClient
  ) {}


  async changeOrdinaryRole(
    input: ChangeOrdinaryRolePersistenceInput
  ): Promise<ChangeOrdinaryRolePersistenceResult> {
    const { data, error } =
      await this.db.rpc(
        "change_project_ordinary_role",
        {
          p_assignment_id: input.assignmentId,
          p_project_id: input.projectId,
          p_membership_id: input.membershipId,
          p_role: input.role,
          p_effective_at: input.effectiveAt,
          p_assigned_by_person_id:
            input.assignedByPersonId,
          p_change_reason: input.changeReason,
          p_created_at: input.createdAt,
        }
      );

    if (error) {
      throwMappedRoleError(error.message);
    }

    const row =
      ((data ?? []) as OrdinaryRoleChangeRow[])[0];

    if (!row) {
      throw new Error(
        "Ordinary project-role change returned no row."
      );
    }

    return {
      closedAssignment:
        mapNullableClosedAssignment(row),
      roleAssignment:
        mapNewAssignment(row),
    };
  }


  async transferProtectedRole(
    input: TransferProtectedRolePersistenceInput
  ): Promise<TransferProtectedRolePersistenceResult> {
    const { data, error } =
      await this.db.rpc(
        "transfer_project_protected_role",
        {
          p_transfer_id: input.transferId,
          p_incoming_assignment_id:
            input.incomingAssignmentId,
          p_project_id: input.projectId,
          p_incoming_membership_id:
            input.incomingMembershipId,
          p_role: input.role,
          p_effective_at: input.effectiveAt,
          p_authorised_by_person_id:
            input.authorisedByPersonId,
          p_reason: input.reason,
          p_correlation_id: input.correlationId,
          p_created_at: input.createdAt,
        }
      );

    if (error) {
      throwMappedRoleError(error.message);
    }

    const row =
      ((data ?? []) as ProtectedRoleTransferRow[])[0];

    if (!row) {
      throw new Error(
        "Protected project-role transfer returned no row."
      );
    }

    return {
      outgoingAssignment:
        mapNullableClosedAssignment(row),
      roleAssignment:
        mapNewAssignment(row),
      transfer:
        mapTransfer(row),
    };
  }
}


function mapNullableClosedAssignment(
  row: OrdinaryRoleChangeRow
): ProjectRoleAssignment | null {
  if (row.closed_assignment_id === null) {
    return null;
  }

  return mapAssignment({
    id: row.closed_assignment_id,
    project_id: required(row.closed_assignment_project_id),
    membership_id: required(row.closed_assignment_membership_id),
    role: required(row.closed_assignment_role),
    effective_from: required(row.closed_assignment_effective_from),
    effective_to: row.closed_assignment_effective_to,
    assigned_by_person_id:
      required(row.closed_assignment_assigned_by_person_id),
    change_reason: row.closed_assignment_change_reason,
    created_at: required(row.closed_assignment_created_at),
  });
}


function mapNewAssignment(
  row: OrdinaryRoleChangeRow
): ProjectRoleAssignment {
  return mapAssignment({
    id: row.new_assignment_id,
    project_id: row.new_assignment_project_id,
    membership_id: row.new_assignment_membership_id,
    role: row.new_assignment_role,
    effective_from: row.new_assignment_effective_from,
    effective_to: row.new_assignment_effective_to,
    assigned_by_person_id:
      row.new_assignment_assigned_by_person_id,
    change_reason: row.new_assignment_change_reason,
    created_at: row.new_assignment_created_at,
  });
}


function mapAssignment(
  row: AssignmentColumns
): ProjectRoleAssignment {
  return {
    id: row.id,
    projectId: row.project_id,
    membershipId: row.membership_id,
    role: row.role,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    assignedBy: row.assigned_by_person_id,
    changeReason: row.change_reason,
    createdAt: row.created_at,
  };
}


function mapTransfer(
  row: ProtectedRoleTransferRow
): ProjectRoleTransferRecord {
  return {
    id: row.transfer_id,
    projectId: row.transfer_project_id,
    role: row.transfer_role,
    outgoingAssignmentId:
      row.transfer_outgoing_assignment_id,
    incomingAssignmentId:
      row.transfer_incoming_assignment_id,
    authorisedByPersonId:
      row.transfer_authorised_by_person_id,
    reason: row.transfer_reason,
    correlationId: row.transfer_correlation_id,
    effectiveAt: row.transfer_effective_at,
    createdAt: row.transfer_created_at,
  };
}


function required<T>(
  value: T | null
): T {
  if (value === null) {
    throw new Error(
      "Role-management RPC returned an incomplete assignment."
    );
  }

  return value;
}


function throwMappedRoleError(
  message: string
): never {
  if (
    message.includes(
      "PROJECT_ROLE_TRANSFER_REQUIRED"
    )
  ) {
    throw new ProjectRoleTransferRequiredError();
  }

  if (
    message.includes("PROJECT_ROLE_") ||
    message.includes("PROJECT_MEMBERSHIP_") ||
    message.includes("PROJECT_NOT_FOUND")
  ) {
    throw new ProjectRoleAssignmentInvalidError(
      message
    );
  }

  throw new Error(message);
}

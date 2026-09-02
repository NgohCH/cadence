import type { SupabaseClient } from "@supabase/supabase-js";

import type { ProjectRoleAssignmentReadRepository } from "../../modules/project-membership/project-role-assignment-read.repository";
import type { ProjectRoleTransferReadRepository } from "../../modules/project-membership/project-role-transfer-read.repository";
import type { ProjectRoleTransferRecord } from "../../modules/project-membership/project-role-management.repository";
import type { ProjectRoleAssignment } from "../../modules/project-membership/project-role.types";


type AssignmentRow = {
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


type TransferRow = {
  id: string;
  project_id: string;
  role: ProjectRoleTransferRecord["role"];
  outgoing_assignment_id: string | null;
  incoming_assignment_id: string;
  authorised_by_person_id: string;
  reason: string;
  correlation_id: string;
  effective_at: string;
  created_at: string;
};


const assignmentColumns = `
  id,
  project_id,
  membership_id,
  role,
  effective_from,
  effective_to,
  assigned_by_person_id,
  change_reason,
  created_at
`;

const transferColumns = `
  id,
  project_id,
  role,
  outgoing_assignment_id,
  incoming_assignment_id,
  authorised_by_person_id,
  reason,
  correlation_id,
  effective_at,
  created_at
`;


/**
 * Read-only infrastructure adapter for controlled membership preparation.
 * It deliberately exposes no membership, role, or transfer mutation method.
 */
export class SupabaseProjectMembershipPilotPreparationRepository
  implements ProjectRoleAssignmentReadRepository, ProjectRoleTransferReadRepository
{
  constructor(private readonly db: SupabaseClient) {}

  async listRoleAssignmentsForProject(projectId: string): Promise<ProjectRoleAssignment[]> {
    const { data, error } = await this.db
      .from("project_role_assignments")
      .select(assignmentColumns)
      .eq("project_id", projectId)
      .order("effective_from", { ascending: true });

    if (error) throw new Error("Project role assignment observation failed.");
    return ((data ?? []) as AssignmentRow[]).map(mapAssignment);
  }

  async listProtectedRoleTransfers(projectId: string): Promise<ProjectRoleTransferRecord[]> {
    const { data, error } = await this.db
      .from("project_role_transfers")
      .select(transferColumns)
      .eq("project_id", projectId)
      .order("effective_at", { ascending: true });

    if (error) throw new Error("Protected role transfer observation failed.");
    return ((data ?? []) as TransferRow[]).map(mapTransfer);
  }
}


function mapAssignment(row: AssignmentRow): ProjectRoleAssignment {
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


function mapTransfer(row: TransferRow): ProjectRoleTransferRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    role: row.role,
    outgoingAssignmentId: row.outgoing_assignment_id,
    incomingAssignmentId: row.incoming_assignment_id,
    authorisedByPersonId: row.authorised_by_person_id,
    reason: row.reason,
    correlationId: row.correlation_id,
    effectiveAt: row.effective_at,
    createdAt: row.created_at,
  };
}

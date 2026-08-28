import type {
  SupabaseClient,
} from "@supabase/supabase-js";

import type {
  ProjectMembershipRepository,
} from "../../modules/project-membership/project-membership.repository";

import type {
  CreateProjectMembershipInput,
  ProjectMembership,
} from "../../modules/project-membership/project-membership.types";

import type {
  ProjectRoleAssignment,
} from "../../modules/project-membership/project-role.types";


type ProjectMembershipRow = {
  id: string;
  person_id: string;
  project_id: string;
  effective_from: string;
  effective_to: string | null;
  membership_status:
    ProjectMembership["status"];
  granted_by_person_id: string | null;
  created_at: string;
  termination_reason: string | null;
};

type ProjectRoleAssignmentRow = {
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

const roleAssignmentColumns = `
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


export class SupabaseProjectMembershipRepository
  implements ProjectMembershipRepository
{
  constructor(
    private readonly db: SupabaseClient
  ) {}


  async createMembership(
    membership: CreateProjectMembershipInput
  ): Promise<ProjectMembership> {
    const {
      data,
      error,
    } = await this.db
      .from("project_memberships")
      .insert({
        id: membership.id,
        person_id: membership.personId,
        project_id: membership.projectId,
        effective_from:
          membership.effectiveFrom,
        effective_to: membership.effectiveTo,
        membership_status:
          membership.status,
        granted_by_person_id:
          membership.grantedBy,
        created_at: membership.createdAt,
        termination_reason:
          membership.terminationReason,
        // R03B writes only canonical membership fields. Retained VS-001
        // fields receive inert defaults and remain frozen by R03A.
      })
      .select(membershipColumns)
      .single();

    if (error) {
      throw error;
    }

    return mapMembership(
      data as ProjectMembershipRow
    );
  }


  async findMembershipById(
    membershipId: string
  ): Promise<ProjectMembership | null> {
    const {
      data,
      error,
    } = await this.db
      .from("project_memberships")
      .select(membershipColumns)
      .eq("id", membershipId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data
      ? mapMembership(
          data as ProjectMembershipRow
        )
      : null;
  }


  async listMembershipsForProject(
    projectId: string
    ): Promise<ProjectMembership[]> {
    const {
      data,
      error,
    } = await this.db
      .from("project_memberships")
      .select(membershipColumns)
      .eq("project_id", projectId)
      .order("effective_from", {
        ascending: true,
      });

    if (error) {
      throw error;
    }

    return (
      (data ?? []) as
        ProjectMembershipRow[]
    ).map(mapMembership);
  }
  async listMembershipsForPersonInProject(
    personId: string,
    projectId: string
  ): Promise<ProjectMembership[]> {
    const {
      data,
      error,
    } = await this.db
      .from("project_memberships")
      .select(membershipColumns)
      .eq("person_id", personId)
      .eq("project_id", projectId)
      .order("effective_from", {
        ascending: true,
      });

    if (error) {
      throw error;
    }

    return (
      (data ?? []) as
        ProjectMembershipRow[]
    ).map(mapMembership);
  }


  async createRoleAssignment(
    assignment: ProjectRoleAssignment
  ): Promise<ProjectRoleAssignment> {
    const {
      data,
      error,
    } = await this.db
      .from("project_role_assignments")
      .insert({
        id: assignment.id,
        project_id: assignment.projectId,
        membership_id:
          assignment.membershipId,
        role: assignment.role,
        effective_from:
          assignment.effectiveFrom,
        effective_to: assignment.effectiveTo,
        assigned_by_person_id:
          assignment.assignedBy,
        change_reason:
          assignment.changeReason,
        created_at: assignment.createdAt,
      })
      .select(roleAssignmentColumns)
      .single();

    if (error) {
      throw error;
    }

    return mapRoleAssignment(
      data as ProjectRoleAssignmentRow
    );
  }


  async listRoleAssignments(
    membershipId: string
  ): Promise<ProjectRoleAssignment[]> {
    const {
      data,
      error,
    } = await this.db
      .from("project_role_assignments")
      .select(roleAssignmentColumns)
      .eq("membership_id", membershipId)
      .order("effective_from", {
        ascending: true,
      });

    if (error) {
      throw error;
    }

    return (
      (data ?? []) as
        ProjectRoleAssignmentRow[]
    ).map(mapRoleAssignment);
  }
}


function mapMembership(
  row: ProjectMembershipRow
): ProjectMembership {
  return {
    id: row.id,
    personId: row.person_id,
    projectId: row.project_id,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    status: row.membership_status,
    grantedBy: row.granted_by_person_id,
    createdAt: row.created_at,
    terminationReason:
      row.termination_reason,
  };
}


function mapRoleAssignment(
  row: ProjectRoleAssignmentRow
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

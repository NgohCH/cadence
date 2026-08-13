import type { SupabaseClient } from "@supabase/supabase-js";

import type { RbacRepository } from "../../modules/rbac/rbac.repository";
import type { ProjectAccess } from "../../modules/rbac/rbac.types";

type PermissionMappingRow = {
  permission_id: string;
};

type PermissionRow = {
  code: string;
};

export class SupabaseRbacRepository
  implements RbacRepository
{
  constructor(
    private readonly db: SupabaseClient
  ) {}

  async getProjectAccess(
    userId: string,
    projectId: string
  ): Promise<ProjectAccess | null> {
    const {
      data: membership,
      error: membershipError,
    } = await this.db
      .from("project_memberships")
      .select(
        "id, project_id, user_id, role_id, status"
      )
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (membershipError) {
      throw membershipError;
    }

    if (!membership) {
      return null;
    }

    const {
      data: role,
      error: roleError,
    } = await this.db
      .from("roles")
      .select("id, code")
      .eq("id", membership.role_id)
      .single();

    if (roleError) {
      throw roleError;
    }

    const {
      data: mappings,
      error: mappingError,
    } = await this.db
      .from("role_permissions")
      .select("permission_id")
      .eq("role_id", membership.role_id);

    if (mappingError) {
      throw mappingError;
    }

    const permissionIds = (
      mappings ?? []
    ).map(
      (item: PermissionMappingRow) =>
        item.permission_id
    );

    let permissions: string[] = [];

    if (permissionIds.length > 0) {
      const {
        data: permissionRows,
        error: permissionError,
      } = await this.db
        .from("permissions")
        .select("code")
        .in("id", permissionIds);

      if (permissionError) {
        throw permissionError;
      }

      permissions = (
        permissionRows ?? []
      ).map(
        (item: PermissionRow) =>
          item.code
      );
    }

    return {
      membershipId: membership.id,
      projectId: membership.project_id,
      userId: membership.user_id,
      roleId: membership.role_id,
      roleCode: role.code,
      permissions,
    };
  }
}
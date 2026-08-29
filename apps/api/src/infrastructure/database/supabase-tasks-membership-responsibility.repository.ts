import type {
  SupabaseClient,
} from "@supabase/supabase-js";

import type {
  TasksMembershipResponsibilityRepository,
} from "../../modules/tasks/tasks-membership-responsibility";

import {
  ACTIONABLE_TASK_STATUSES,
} from "../../modules/tasks/tasks.types";


type UserIdentityBridgeRow = {
  id: string;
};


/**
 * Tasks owns translation from stable Person identity to the current
 * user-keyed Task assignment model.
 */
export class SupabaseTasksMembershipResponsibilityRepository
  implements TasksMembershipResponsibilityRepository
{
  constructor(
    private readonly db: SupabaseClient
  ) {}


  async hasActionableAssignedResponsibilities(
    projectId: string,
    personId: string
  ): Promise<boolean> {
    const {
      data: users,
      error: userError,
    } = await this.db
      .from("users")
      .select("id")
      .eq("person_id", personId);

    if (userError) {
      throw userError;
    }

    const userIds =
      (
        (users ?? []) as
          UserIdentityBridgeRow[]
      ).map((user) => user.id);

    if (userIds.length === 0) {
      return false;
    }

    const {
      count,
      error: taskError,
    } = await this.db
      .from("tasks")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("project_id", projectId)
      .in("assigned_to", userIds)
      .in(
        "status",
        [...ACTIONABLE_TASK_STATUSES]
      );

    if (taskError) {
      throw taskError;
    }

    return (count ?? 0) > 0;
  }
}

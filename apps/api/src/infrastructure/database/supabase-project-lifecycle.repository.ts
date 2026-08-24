import type {
  SupabaseClient,
} from "@supabase/supabase-js";

import type {
  ProjectLifecycleReadRepository,
} from "../../modules/projects/projects-membership-lifecycle";

import type {
  ProjectLifecycleStatus,
} from "../../modules/projects/projects.types";


type ProjectLifecycleRow = {
  lifecycle_status:
    ProjectLifecycleStatus;
};


export class SupabaseProjectLifecycleRepository
  implements ProjectLifecycleReadRepository
{
  constructor(
    private readonly db: SupabaseClient
  ) {}


  async findLifecycleStatus(
    projectId: string
  ): Promise<ProjectLifecycleStatus | null> {
    const {
      data,
      error,
    } = await this.db
      .from("projects")
      .select("lifecycle_status")
      .eq("id", projectId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data === null
      ? null
      : (
          data as ProjectLifecycleRow
        ).lifecycle_status;
  }
}

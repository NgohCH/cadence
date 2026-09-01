import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  PilotProjectCreateIntent,
  PilotProjectPreparationRepository,
  PilotProjectRecord,
} from "../../modules/projects/pilot-preparation.repository";


type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  goal: string | null;
  lifecycle_status: PilotProjectRecord["lifecycleStatus"];
  progress_percent: number;
  owner_user_id: string;
  start_date: string | null;
  target_date: string | null;
  created_at: string;
  updated_at: string;
};


/**
 * Projects-owned persistence adapter for controlled pilot preparation.
 * It intentionally exposes only exact Project reads and additive creates.
 */
export class SupabaseProjectsPilotPreparationRepository
  implements PilotProjectPreparationRepository
{
  constructor(
    private readonly client: SupabaseClient,
  ) {}

  async findProjectById(
    projectId: string,
  ): Promise<PilotProjectRecord | null> {
    const { data, error } = await this.client
      .from("projects")
      .select(PROJECT_SELECT)
      .eq("id", projectId)
      .maybeSingle();
    if (error) {
      throw error;
    }
    return data ? mapProject(data as ProjectRow) : null;
  }

  async createProject(
    project: PilotProjectCreateIntent,
  ): Promise<PilotProjectRecord> {
    const { data, error } = await this.client
      .from("projects")
      .insert({
        id: project.id,
        name: project.name,
        description: project.description,
        goal: project.goal,
        lifecycle_status: project.lifecycleStatus,
        progress_percent: project.progressPercent,
        owner_user_id: project.ownerUserId,
        start_date: project.startDate,
        target_date: project.targetDate,
      })
      .select(PROJECT_SELECT)
      .single();
    if (error) {
      throw error;
    }
    return mapProject(data as ProjectRow);
  }
}


const PROJECT_SELECT = `
        id,
        name,
        description,
        goal,
        lifecycle_status,
        progress_percent,
        owner_user_id,
        start_date,
        target_date,
        created_at,
        updated_at
      `;


function mapProject(row: ProjectRow): PilotProjectRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    goal: row.goal,
    lifecycleStatus: row.lifecycle_status,
    progressPercent: row.progress_percent,
    ownerUserId: row.owner_user_id,
    startDate: row.start_date,
    targetDate: row.target_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

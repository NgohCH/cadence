import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  PilotProjectHealthCreateIntent,
  PilotProjectHealthPreparationRepository,
  PilotProjectHealthRecord,
} from "../../modules/project-health/pilot-preparation.repository";


type ProjectHealthRow = {
  project_id: string;
  health_status: PilotProjectHealthRecord["healthStatus"];
  reasons: readonly string[];
  source: PilotProjectHealthRecord["source"];
  changed_by: string | null;
  updated_at: string;
};


/**
 * Project Health-owned persistence adapter for controlled pilot preparation.
 * It accesses only current Health state, never Projects or Health history.
 */
export class SupabaseProjectHealthPilotPreparationRepository
  implements PilotProjectHealthPreparationRepository
{
  constructor(
    private readonly client: SupabaseClient,
  ) {}

  async findCurrentProjectHealth(
    projectId: string,
  ): Promise<PilotProjectHealthRecord | null> {
    const { data, error } = await this.client
      .from("project_health")
      .select(HEALTH_SELECT)
      .eq("project_id", projectId)
      .maybeSingle();
    if (error) {
      throw error;
    }
    return data ? mapHealth(data as ProjectHealthRow) : null;
  }

  async createCurrentProjectHealth(
    health: PilotProjectHealthCreateIntent,
  ): Promise<PilotProjectHealthRecord> {
    const { data, error } = await this.client
      .from("project_health")
      .insert({
        project_id: health.projectId,
        health_status: health.healthStatus,
        reasons: health.reasons,
        source: health.source,
        changed_by: health.changedBy,
      })
      .select(HEALTH_SELECT)
      .single();
    if (error) {
      throw error;
    }
    return mapHealth(data as ProjectHealthRow);
  }
}


const HEALTH_SELECT = `
        project_id,
        health_status,
        reasons,
        source,
        changed_by,
        updated_at
      `;


function mapHealth(row: ProjectHealthRow): PilotProjectHealthRecord {
  return {
    projectId: row.project_id,
    healthStatus: row.health_status,
    reasons: row.reasons,
    source: row.source,
    changedBy: row.changed_by,
    updatedAt: row.updated_at,
  };
}

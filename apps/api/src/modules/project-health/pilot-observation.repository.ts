import type {
  PilotProjectHealthRecord,
} from "./pilot-preparation.types";


/**
 * Read-only Project Health boundary used by controlled pilot preflight.
 * It exposes current Health only and cannot access Projects or history writes.
 */
export interface ProjectHealthPilotObservationRepository {
  findCurrentProjectHealth(
    projectId: string,
  ): Promise<PilotProjectHealthRecord | null>;
}

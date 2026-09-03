import type {
  PilotProjectRecord,
} from "./pilot-preparation.types";


/**
 * Read-only Projects boundary used by controlled pilot preflight.
 * Project Health, membership, and mutation persistence are not exposed.
 */
export interface ProjectsPilotObservationRepository {
  findProjectById(projectId: string): Promise<PilotProjectRecord | null>;
}

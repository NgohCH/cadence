import type {
  PilotProjectHealthCreateIntent,
  PilotProjectHealthRecord,
} from "./pilot-preparation.types";


/**
 * Project Health-owned create-only port for controlled pilot preparation.
 * It does not expose Projects or historical Health mutation operations.
 */
export interface PilotProjectHealthPreparationRepository {
  findCurrentProjectHealth(
    projectId: string
  ): Promise<PilotProjectHealthRecord | null>;

  createCurrentProjectHealth(
    health: PilotProjectHealthCreateIntent
  ): Promise<PilotProjectHealthRecord>;
}


export type {
  PilotProjectHealthCreateIntent,
  PilotProjectHealthRecord,
} from "./pilot-preparation.types";

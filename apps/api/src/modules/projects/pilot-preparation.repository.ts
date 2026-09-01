import type {
  PilotProjectCreateIntent,
  PilotProjectRecord,
} from "./pilot-preparation.types";


/**
 * Projects-owned create-only persistence port for controlled pilot setup.
 * There are deliberately no update, delete, upsert, or history-rewrite
 * operations: incompatible state is reported for separately authorised
 * remediation.
 */
export interface PilotProjectPreparationRepository {
  findProjectById(
    projectId: string
  ): Promise<PilotProjectRecord | null>;

  createProject(
    project: PilotProjectCreateIntent
  ): Promise<PilotProjectRecord>;

}


export type {
  PilotProjectCreateIntent,
  PilotProjectRecord,
} from "./pilot-preparation.types";

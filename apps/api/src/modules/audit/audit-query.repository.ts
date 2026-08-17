import type {
  AuditJourneyEvent,
} from "./audit.types";


export interface AuditQueryRepository {
  getTaskJourney(
    projectId: string,
    taskId: string,
    requestingUserId: string
  ): Promise<AuditJourneyEvent[] | null>;
}
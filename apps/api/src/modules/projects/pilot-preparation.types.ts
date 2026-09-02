import type {
  ProjectLifecycleStatus,
} from "./projects.types";


export interface PilotProjectRecord {
  id: string;
  name: string;
  description: string | null;
  goal: string | null;
  lifecycleStatus: ProjectLifecycleStatus;
  progressPercent: number;
  ownerUserId: string;
  startDate: string | null;
  targetDate: string | null;
  createdAt: string;
  updatedAt: string;
}


export type PilotProjectCreateIntent = Omit<
  PilotProjectRecord,
  "createdAt" | "updatedAt"
>;


export interface PilotProjectPreparationIntent {
  manifestProjectKey: string;
  project: PilotProjectCreateIntent;
}


export interface PilotProjectPreparationContext {
  operatorPersonId: string;
  runCorrelationId: string;
}


export type PilotProjectPreparedAction = "CREATE" | "REUSE";


export type PilotProjectPreparedResource =
  | "PROJECT"
  | "PROJECT_HEALTH";


export interface PilotProjectResourceEvidence {
  resource: PilotProjectPreparedResource;
  status: "CREATED" | "REUSED";
  id: string;
}


export interface PilotProjectPreparationEvidence {
  manifestProjectKey: string;
  projectId: string;
  operatorPersonId: string;
  runCorrelationId: string;
  lifecycleStatus: ProjectLifecycleStatus;
}


export interface PilotProjectPreparationFailureEvidence {
  manifestProjectKey: string;
  operatorPersonId: string;
  runCorrelationId: string;
}


export interface PilotProjectPreparationResult {
  resources: readonly PilotProjectResourceEvidence[];
  evidence: PilotProjectPreparationEvidence;
}


export type PilotProjectPreparationErrorCategory =
  | "INPUT"
  | "PROJECT"
  | "PERSISTENCE";


export type PilotProjectPreparationErrorCode =
  | "INVALID_INPUT"
  | "ATTRIBUTE_CONFLICT"
  | "OWNER_PROJECTION_CONFLICT"
  | "CONFLICT"
  | "READ_FAILED"
  | "CREATE_FAILED"
  | "POSTCONDITION_FAILED"
  | "STALE_PLAN";

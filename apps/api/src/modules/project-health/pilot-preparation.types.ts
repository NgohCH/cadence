import type { ProjectHealthStatus } from "../projects/projects.types";


export type ProjectHealthPreparationSource =
  | "system"
  | "manual"
  | "agent";


export interface PilotProjectHealthRecord {
  projectId: string;
  healthStatus: ProjectHealthStatus;
  reasons: readonly string[];
  source: ProjectHealthPreparationSource;
  changedBy: string | null;
  updatedAt: string;
}


export type PilotProjectHealthCreateIntent = Omit<
  PilotProjectHealthRecord,
  "updatedAt"
>;


export interface PilotProjectHealthPreparationIntent
  extends PilotProjectHealthCreateIntent {
  manifestProjectKey: string;
}


export interface PilotProjectHealthPreparationContext {
  operatorPersonId: string;
  runCorrelationId: string;
}


export interface PilotProjectHealthResourceEvidence {
  resource: "PROJECT_HEALTH";
  status: "CREATED" | "REUSED";
  id: string;
}


export interface PilotProjectHealthPreparationEvidence {
  manifestProjectKey: string;
  projectId: string;
  projectHealthId: string;
  operatorPersonId: string;
  runCorrelationId: string;
  healthStatus: ProjectHealthStatus;
}


export interface PilotProjectHealthPreparationFailureEvidence {
  manifestProjectKey: string;
  operatorPersonId: string;
  runCorrelationId: string;
}


export interface PilotProjectHealthPreparationResult {
  resources: readonly PilotProjectHealthResourceEvidence[];
  evidence: PilotProjectHealthPreparationEvidence;
}


export type ProjectHealthPreparationErrorCategory =
  | "INPUT"
  | "PROJECT_HEALTH"
  | "PERSISTENCE";


export type ProjectHealthPreparationErrorCode =
  | "INVALID_INPUT"
  | "CONFLICT"
  | "READ_FAILED"
  | "CREATE_FAILED"
  | "POSTCONDITION_FAILED";

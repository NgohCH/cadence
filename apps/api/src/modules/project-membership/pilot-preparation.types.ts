import type {
  OrdinaryProjectRole,
  ProtectedProjectRole,
} from "./project-role.types";


export type PilotPreparedAction = "CREATE" | "REUSE";
export type PilotProtectedPreparedAction = "APPOINT" | "REUSE";
export type PilotPreparationResult = "CREATED" | "REUSED";


export interface PilotMembershipPreparationIntent {
  resourceKey: string;
  membershipId: string;
  projectId: string;
  personId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: "ACTIVE";
  grantedByPersonId: string;
  initialRoleAssignmentId: string;
}


export interface PilotOrdinaryRolePreparationIntent {
  resourceKey: string;
  assignmentId: string;
  projectId: string;
  membershipId: string;
  role: OrdinaryProjectRole;
  effectiveFrom: string;
  effectiveTo: string | null;
  assignedByPersonId: string;
  changeReason: string | null;
  expectedPredecessor?: PilotOrdinaryRolePredecessorIntent;
}


/** Canonical pre-state that an ordinary-role replacement is allowed to close. */
export interface PilotOrdinaryRolePredecessorIntent {
  assignmentId: string;
  projectId: string;
  membershipId: string;
  role: "PROJECT_MEMBER" | "PROJECT_OBSERVER" | "PROJECT_AUDITOR";
  effectiveFrom: string;
  effectiveTo: string | null;
  assignedByPersonId: string;
  changeReason: string | null;
}


export interface PilotProtectedRolePreparationIntent {
  resourceKey: string;
  assignmentId: string;
  transferId: string;
  projectId: string;
  membershipId: string;
  role: ProtectedProjectRole;
  effectiveAt: string;
  effectiveTo: string | null;
  authorisedByPersonId: string;
  reason: string;
}


export interface PilotPreparationContext {
  operatorPersonId: string;
  runCorrelationId: string;
}


export interface PilotMembershipPreparationRequest {
  action: PilotPreparedAction;
  intent: PilotMembershipPreparationIntent;
  context: PilotPreparationContext;
}


export interface PilotOrdinaryRolePreparationRequest {
  action: PilotPreparedAction;
  intent: PilotOrdinaryRolePreparationIntent;
  context: PilotPreparationContext;
}


export interface PilotProtectedRolePreparationRequest {
  action: PilotProtectedPreparedAction;
  intent: PilotProtectedRolePreparationIntent;
  context: PilotPreparationContext;
}


export interface PilotPreparationOutcome {
  resourceKey: string;
  plannedAction: PilotPreparedAction | PilotProtectedPreparedAction;
  actualResult: PilotPreparationResult;
  resourceId: string;
  projectId: string;
  operatorPersonId: string;
  runCorrelationId: string;
}

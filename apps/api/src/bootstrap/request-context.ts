export interface RequestContext {
  actorUserId: string;
  projectId?: string;

  correlationId: string;
  requestId: string;

  source:
    | "web"
    | "ai_proposal"
    | "api"
    | "system";

  identityProvider: string;
}
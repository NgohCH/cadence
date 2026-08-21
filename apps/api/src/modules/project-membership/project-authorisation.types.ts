import type {
  RequestContext,
} from "../../bootstrap/request-context";

import type {
  ProjectRole,
} from "./project-role.types";


/**
 * The authenticated actor fields required for a project-authorisation
 * decision. The stable Person drives VS-002 access. actorUserId is retained
 * only for the explicit VS-001 RBAC compatibility path.
 */
export type ProjectAuthorisationContext =
  Pick<
    RequestContext,
    "actorPersonId" | "actorUserId"
  >;


export interface EffectiveProjectAuthorisation {
  personId: string;
  projectId: string;
  membershipIds: string[];
  roles: ProjectRole[];
  permissions: string[];
  evaluatedAt: string;
}

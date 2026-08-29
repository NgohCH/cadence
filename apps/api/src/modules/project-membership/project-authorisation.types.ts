import type {
  RequestContext,
} from "../../bootstrap/request-context";

import type {
  ProjectRole,
} from "./project-role.types";


/**
 * Identity required for a project-authorisation decision.
 *
 * Project authority is derived only from stable Person identity.
 * The wider RequestContext may still contain actorUserId for legacy
 * application data and attribution, but it is not authorization evidence.
 */
export type ProjectAuthorisationContext =
  Pick<
    RequestContext,
    "actorPersonId"
  >;


export interface EffectiveProjectAuthorisation {
  personId: string;
  projectId: string;
  membershipIds: string[];
  roles: ProjectRole[];
  permissions: string[];
  evaluatedAt: string;
}

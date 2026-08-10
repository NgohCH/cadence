import type { RequestContext } from "../bootstrap/request-context";
import type { CadenceUser } from "../modules/identity/identity.types";

export function createRequestContext(
  user: CadenceUser,
  requestId: string,
  correlationId: string
): RequestContext {
  return {
    actorUserId: user.id,
    correlationId,
    requestId,
    source: "web",
    identityProvider: user.identityProvider
  };
}
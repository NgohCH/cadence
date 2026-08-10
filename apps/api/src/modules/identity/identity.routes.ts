import { Router } from "express";

import { success } from "../../bootstrap/api-response";
import type { AuthenticatedRequestState } from "../../middleware/authenticate";

export function createIdentityRouter(): Router {
  const router = Router();

  router.get("/me", (_req, res) => {
    const authenticated =
      res.locals.authenticated as AuthenticatedRequestState;

    const { user, context } = authenticated;

    res.status(200).json(
      success(
        {
          id: user.id,
          display_name: user.displayName,
          email: user.email,
          status: user.status,
          identity_provider: user.identityProvider
        },
        {
          correlation_id: context.correlationId,
          request_id: context.requestId,
          next_cursor: null
        }
      )
    );
  });

  return router;
}
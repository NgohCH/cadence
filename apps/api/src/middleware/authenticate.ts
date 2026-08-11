import type {
  NextFunction,
  Request,
  Response
} from "express";

import { failure } from "../bootstrap/api-response";
import type { RequestContext } from "../bootstrap/request-context";
import type { AuthProvider } from "../infrastructure/auth/auth-provider";
import type { IdentityService } from "../modules/identity/identity.service";
import type { CadenceUser } from "../modules/identity/identity.types";

import { createRequestContext } from "./request-context";

export interface AuthenticatedRequestState {
  user: CadenceUser;
  context: RequestContext;
}

export function createAuthenticateMiddleware(
  authProvider: AuthProvider,
  identityService: IdentityService
) {
  return async function authenticate(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const authorization =
      req.header("Authorization");

    if (
      !authorization ||
      !authorization.startsWith("Bearer ")
    ) {
      sendUnauthenticated(res);
      return;
    }

    const accessToken =
      authorization.slice("Bearer ".length).trim();

    if (!accessToken) {
      sendUnauthenticated(res);
      return;
    }

    try {
      const authenticatedIdentity =
        await authProvider.verifyAccessToken(
          accessToken
        );

      const user =
        await identityService.resolveAuthenticatedUser(
          authenticatedIdentity.externalUserId
        );

      const context =
        createRequestContext(
          user,
          res.locals.requestId,
          res.locals.correlationId
        );

      res.locals.authenticated = {
        user,
        context
      } satisfies AuthenticatedRequestState;

      next();
    } catch (error) {
      logAuthenticationFailure(
        error,
        res.locals.requestId,
        res.locals.correlationId
      );

      sendUnauthenticated(res);
    }
  };
}

function sendUnauthenticated(
  res: Response
): void {
  res.status(401).json(
    failure(
      "UNAUTHENTICATED",
      "Authentication is required.",
      res.locals.correlationId
    )
  );
}

function logAuthenticationFailure(
  error: unknown,
  requestId: string,
  correlationId: string
): void {
  let reason = "UNKNOWN_AUTHENTICATION_ERROR";

  if (error instanceof Error) {
    reason = error.message;
  } else if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    reason = error.message;
  }

  console.warn("Authentication failed", {
    reason,
    requestId,
    correlationId
  });
}
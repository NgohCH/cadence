import { randomUUID } from "node:crypto";
import type {
  NextFunction,
  Request,
  Response
} from "express";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

export function requestTraceMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = randomUUID();

  const suppliedCorrelationId =
    req.header("X-Correlation-ID");

  const correlationId =
    suppliedCorrelationId &&
    isUuid(suppliedCorrelationId)
      ? suppliedCorrelationId
      : randomUUID();

  res.locals.requestId = requestId;
  res.locals.correlationId = correlationId;

  res.setHeader("X-Request-ID", requestId);
  res.setHeader(
    "X-Correlation-ID",
    correlationId
  );

  next();
}
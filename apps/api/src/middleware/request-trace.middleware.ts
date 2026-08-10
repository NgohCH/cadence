import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export function requestTraceMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = randomUUID();
  const correlationId = randomUUID();

  res.locals.requestId = requestId;
  res.locals.correlationId = correlationId;

  res.setHeader("x-request-id", requestId);
  res.setHeader("x-correlation-id", correlationId);

  next();
}
export interface ApiMeta {
  correlation_id: string;
  request_id: string;
  next_cursor: string | null;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta: ApiMeta;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    correlation_id: string;
    details: Record<string, unknown>;
  };
}

export function success<T>(
  data: T,
  meta: ApiMeta
): ApiSuccess<T> {
  return {
    success: true,
    data,
    meta
  };
}

export function failure(
  code: string,
  message: string,
  correlationId: string,
  details: Record<string, unknown> = {}
): ApiError {
  return {
    success: false,
    error: {
      code,
      message,
      correlation_id: correlationId,
      details
    }
  };
}
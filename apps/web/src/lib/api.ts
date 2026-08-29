import { getBrowserEnvironment } from './env'
import { getSupabaseBrowserClient } from './supabase'

export class ApiError extends Error {
  readonly status: number
  readonly code?: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

type ApiErrorBody = {
  error?: {
    code?: string
    message?: string
  }
  message?: string
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const supabase = getSupabaseBrowserClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED')
  }

  const environment = getBrowserEnvironment()
  const headers = new Headers(init.headers)

  headers.set('Authorization', `Bearer ${session.access_token}`)

  if (init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${environment.apiBaseUrl}${path}`, {
    ...init,
    headers,
  })

  const body = (await response.json().catch(() => null)) as
    | ApiErrorBody
    | T
    | null

  if (!response.ok) {
    const errorBody = body as ApiErrorBody | null

    throw new ApiError(
      response.status,
      errorBody?.error?.message ??
        errorBody?.message ??
        `API request failed with status ${response.status}`,
      errorBody?.error?.code,
    )
  }

  return body as T
}

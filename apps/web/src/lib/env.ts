export type CadenceBrowserEnvironment = 'local' | 'qa' | 'beta'

export interface BrowserEnvironmentSource {
  VITE_CADENCE_ENV?: string
  VITE_API_BASE_URL?: string
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_PUBLIC_KEY?: string
  VITE_SUPABASE_PROJECT_REF?: string
  VITE_PROJECT_ID?: string
}

export type BrowserEnvironment = {
  cadenceEnvironment: CadenceBrowserEnvironment
  apiBaseUrl: string
  supabaseUrl: string
  supabasePublicKey: string
  supabaseProjectRef: string | null
}

function defaultBrowserEnvironmentSource(): BrowserEnvironmentSource {
  return {
    VITE_CADENCE_ENV: import.meta.env.VITE_CADENCE_ENV,
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLIC_KEY: import.meta.env.VITE_SUPABASE_PUBLIC_KEY,
    VITE_SUPABASE_PROJECT_REF: import.meta.env.VITE_SUPABASE_PROJECT_REF,
    VITE_PROJECT_ID: import.meta.env.VITE_PROJECT_ID,
  }
}

function readRequiredEnvironmentVariable(
  source: BrowserEnvironmentSource,
  name: keyof BrowserEnvironmentSource,
): string {
  const value = source[name]

  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(
      `Missing required browser environment variable: ${name}`,
    )
  }

  return value.trim()
}

function readCadenceEnvironment(
  source: BrowserEnvironmentSource,
): CadenceBrowserEnvironment {
  const value = readRequiredEnvironmentVariable(source, 'VITE_CADENCE_ENV')

  if (value !== 'local' && value !== 'qa' && value !== 'beta') {
    throw new Error(
      `Unsupported Cadence browser environment: ${value}`,
    )
  }

  return value
}

function parseUrl(name: string, value: string): URL {
  try {
    return new URL(value)
  } catch {
    throw new Error(`Invalid browser URL configuration: ${name}`)
  }
}

function isLocalApi(url: URL): boolean {
  return url.protocol === 'http:' &&
    (url.hostname === '127.0.0.1' || url.hostname === 'localhost') &&
    url.port === '3000'
}

function validateBrowserEnvironment(
  environment: BrowserEnvironment,
): void {
  const supabaseUrl = parseUrl('VITE_SUPABASE_URL', environment.supabaseUrl)

  if (environment.cadenceEnvironment === 'local') {
    const apiUrl = parseUrl('VITE_API_BASE_URL', environment.apiBaseUrl)
    const localSupabase = supabaseUrl.protocol === 'http:' &&
      (supabaseUrl.hostname === '127.0.0.1' || supabaseUrl.hostname === 'localhost') &&
      supabaseUrl.port === '54321'

    if (!localSupabase) {
      throw new Error('Local browser mode requires local Supabase on port 54321.')
    }

    if (!isLocalApi(apiUrl)) {
      throw new Error('Local browser mode requires local Cadence API on port 3000.')
    }

    if (environment.supabaseProjectRef) {
      throw new Error('Local browser mode must not declare a hosted Supabase project ref.')
    }

    return
  }

  const projectRef = environment.supabaseProjectRef

  if (!projectRef) {
    throw new Error(
      `${environment.cadenceEnvironment.toUpperCase()} browser mode requires VITE_SUPABASE_PROJECT_REF.`,
    )
  }

  if (supabaseUrl.protocol !== 'https:' || supabaseUrl.hostname !== `${projectRef}.supabase.co`) {
    throw new Error(
      `${environment.cadenceEnvironment.toUpperCase()} browser Supabase URL does not match its declared project ref.`,
    )
  }

  if (environment.apiBaseUrl !== '') {
    const apiUrl = parseUrl('VITE_API_BASE_URL', environment.apiBaseUrl)

    if (!isLocalApi(apiUrl)) {
      throw new Error(
        'Hosted browser modes require same-origin API routing or the local development API on port 3000.',
      )
    }
  }
}

export function getBrowserEnvironment(
  source: BrowserEnvironmentSource = defaultBrowserEnvironmentSource(),
): BrowserEnvironment {
  const apiBaseUrl = source.VITE_API_BASE_URL

  if (typeof apiBaseUrl !== 'string') {
    throw new Error(
      'Missing required browser environment variable: VITE_API_BASE_URL',
    )
  }

  const environment: BrowserEnvironment = {
    cadenceEnvironment: readCadenceEnvironment(source),
    apiBaseUrl: apiBaseUrl.trim().replace(/\/$/, ''),
    supabaseUrl: readRequiredEnvironmentVariable(source, 'VITE_SUPABASE_URL'),
    supabasePublicKey: readRequiredEnvironmentVariable(source, 'VITE_SUPABASE_PUBLIC_KEY'),
    supabaseProjectRef: source.VITE_SUPABASE_PROJECT_REF?.trim() || null,
  }

  validateBrowserEnvironment(environment)
  return environment
}

export function getConfiguredProjectId(
  source: BrowserEnvironmentSource = defaultBrowserEnvironmentSource(),
): string {
  return readRequiredEnvironmentVariable(source, 'VITE_PROJECT_ID')
}

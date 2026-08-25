export type CadenceBrowserEnvironment =
  | 'local'
  | 'qa'

export type BrowserEnvironment = {
  cadenceEnvironment: CadenceBrowserEnvironment
  apiBaseUrl: string
  supabaseUrl: string
  supabasePublicKey: string
  supabaseProjectRef: string | null
}

function readRequiredEnvironmentVariable(
  name: string,
): string {
  const value =
    import.meta.env[name]

  if (
    !value ||
    typeof value !== 'string'
  ) {
    throw new Error(
      `Missing required browser environment variable: ${name}`,
    )
  }

  return value.trim()
}

function readCadenceEnvironment():
  CadenceBrowserEnvironment {
  const value =
    readRequiredEnvironmentVariable(
      'VITE_CADENCE_ENV',
    )

  if (
    value !== 'local' &&
    value !== 'qa'
  ) {
    throw new Error(
      `Unsupported Cadence browser environment: ${value}`,
    )
  }

  return value
}

function parseUrl(
  name: string,
  value: string,
): URL {
  try {
    return new URL(value)
  }
  catch {
    throw new Error(
      `Invalid browser URL configuration: ${name}`,
    )
  }
}

function validateBrowserEnvironment(
  environment: BrowserEnvironment,
): void {
  const apiUrl =
    parseUrl(
      'VITE_API_BASE_URL',
      environment.apiBaseUrl,
    )

  const supabaseUrl =
    parseUrl(
      'VITE_SUPABASE_URL',
      environment.supabaseUrl,
    )

  if (
    environment.cadenceEnvironment ===
      'local'
  ) {
    const localSupabase =
      supabaseUrl.protocol === 'http:' &&
      (
        supabaseUrl.hostname ===
          '127.0.0.1' ||
        supabaseUrl.hostname ===
          'localhost'
      ) &&
      supabaseUrl.port ===
        '54321'

    const localApi =
      apiUrl.protocol === 'http:' &&
      (
        apiUrl.hostname ===
          '127.0.0.1' ||
        apiUrl.hostname ===
          'localhost'
      ) &&
      apiUrl.port ===
        '3000'

    if (!localSupabase) {
      throw new Error(
        'Local browser mode requires local Supabase on port 54321.',
      )
    }

    if (!localApi) {
      throw new Error(
        'Local browser mode requires local Cadence API on port 3000.',
      )
    }

    if (
      environment.supabaseProjectRef
    ) {
      throw new Error(
        'Local browser mode must not declare a hosted Supabase project ref.',
      )
    }

    return
  }

  const projectRef =
    environment.supabaseProjectRef

  if (!projectRef) {
    throw new Error(
      'QA browser mode requires VITE_SUPABASE_PROJECT_REF.',
    )
  }

  if (
    supabaseUrl.protocol !==
      'https:' ||
    supabaseUrl.hostname !==
      `${projectRef}.supabase.co`
  ) {
    throw new Error(
      'QA browser Supabase URL does not match its declared project ref.',
    )
  }
}

export function getBrowserEnvironment():
  BrowserEnvironment {
  const environment:
    BrowserEnvironment = {
    cadenceEnvironment:
      readCadenceEnvironment(),

    apiBaseUrl:
      readRequiredEnvironmentVariable(
        'VITE_API_BASE_URL',
      ).replace(/\/$/, ''),

    supabaseUrl:
      readRequiredEnvironmentVariable(
        'VITE_SUPABASE_URL',
      ),

    supabasePublicKey:
      readRequiredEnvironmentVariable(
        'VITE_SUPABASE_PUBLIC_KEY',
      ),

    supabaseProjectRef:
      import.meta.env
        .VITE_SUPABASE_PROJECT_REF
        ?.trim() || null,
  }

  validateBrowserEnvironment(
    environment,
  )

  return environment
}

export function getConfiguredProjectId():
  string {
  return readRequiredEnvironmentVariable(
    'VITE_PROJECT_ID',
  )
}

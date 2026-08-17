export type BrowserEnvironment = {
  apiBaseUrl: string
  supabaseUrl: string
  supabasePublicKey: string
}

function readRequiredEnvironmentVariable(name: string): string {
  const value = import.meta.env[name]

  if (!value || typeof value !== 'string') {
    throw new Error(`Missing required browser environment variable: ${name}`)
  }

  return value
}

export function getBrowserEnvironment(): BrowserEnvironment {
  return {
    apiBaseUrl:
      import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ??
      'http://localhost:3000',
    supabaseUrl: readRequiredEnvironmentVariable('VITE_SUPABASE_URL'),
    supabasePublicKey: readRequiredEnvironmentVariable(
      'VITE_SUPABASE_PUBLIC_KEY',
    ),
  }
}
export function getConfiguredProjectId(): string {
  return readRequiredEnvironmentVariable(
    'VITE_PROJECT_ID',
  )
}

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const generatedConfigPath = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '.generated/cadence-public-config.json',
)

const publicConfigKeys = [
  'cadenceEnvironment',
  'apiBaseUrl',
  'supabaseUrl',
  'supabasePublishableKey',
  'supabaseProjectRef',
  'projectId',
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function readGeneratedConfig(): Record<typeof publicConfigKeys[number], unknown> {
  if (!existsSync(generatedConfigPath)) {
    throw new Error(
      `Missing generated Cadence browser config at ${generatedConfigPath}. Run npm run config:ci (or the selected canonical config command) first.`,
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(generatedConfigPath, 'utf8'))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Invalid generated Cadence browser config: ${message}`)
  }

  const hasExactKeys =
    isRecord(parsed) &&
    Object.keys(parsed).sort().join(',') === [...publicConfigKeys].sort().join(',')
  const candidate = hasExactKeys && isRecord(parsed) ? parsed : undefined
  const hasValidShape =
    candidate !== undefined &&
    typeof candidate.cadenceEnvironment === 'string' &&
    (candidate.cadenceEnvironment === 'local' ||
      candidate.cadenceEnvironment === 'qa' ||
      candidate.cadenceEnvironment === 'beta') &&
    typeof candidate.apiBaseUrl === 'string' &&
    typeof candidate.supabaseUrl === 'string' &&
    typeof candidate.supabasePublishableKey === 'string' &&
    (typeof candidate.supabaseProjectRef === 'string' || candidate.supabaseProjectRef === null) &&
    typeof candidate.projectId === 'string'

  if (!hasValidShape) {
    throw new Error(
      `Invalid generated Cadence browser config: expected exactly ${publicConfigKeys.join(', ')}.`,
    )
  }

  return parsed as Record<typeof publicConfigKeys[number], unknown>
}

const publicConfig = readGeneratedConfig()

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_CADENCE_ENV': JSON.stringify(publicConfig.cadenceEnvironment),
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify(publicConfig.apiBaseUrl),
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(publicConfig.supabaseUrl),
    'import.meta.env.VITE_SUPABASE_PUBLIC_KEY': JSON.stringify(publicConfig.supabasePublishableKey),
    'import.meta.env.VITE_SUPABASE_PROJECT_REF': JSON.stringify(publicConfig.supabaseProjectRef ?? ''),
    'import.meta.env.VITE_PROJECT_ID': JSON.stringify(publicConfig.projectId),
  },
})

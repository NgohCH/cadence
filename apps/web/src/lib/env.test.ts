import { describe, expect, it } from 'vitest'

import {
  getBrowserEnvironment,
  getConfiguredProjectId,
} from './env'
import type { BrowserEnvironmentSource } from './env'

const hostedSource: BrowserEnvironmentSource = {
  VITE_CADENCE_ENV: 'beta',
  VITE_API_BASE_URL: '',
  VITE_SUPABASE_URL: 'https://abc123.supabase.co',
  VITE_SUPABASE_PUBLIC_KEY: 'sb_publishable_test',
  VITE_SUPABASE_PROJECT_REF: 'abc123',
  VITE_PROJECT_ID: '11111111-1111-4111-8111-111111111111',
}

const localSource: BrowserEnvironmentSource = {
  VITE_CADENCE_ENV: 'local',
  VITE_API_BASE_URL: 'http://127.0.0.1:3000',
  VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
  VITE_SUPABASE_PUBLIC_KEY: 'sb_publishable_local_test',
  VITE_SUPABASE_PROJECT_REF: '',
  VITE_PROJECT_ID: '11111111-1111-4111-8111-111111111111',
}

describe('browser environment', () => {
  it('accepts generated hosted values with same-origin API routing', () => {
    expect(getBrowserEnvironment(hostedSource).apiBaseUrl).toBe('')
  })

  it('accepts generated local API and Supabase URLs', () => {
    expect(getBrowserEnvironment(localSource)).toMatchObject({
      cadenceEnvironment: 'local',
      apiBaseUrl: 'http://127.0.0.1:3000',
      supabaseProjectRef: null,
    })
  })

  it('rejects a hosted Supabase URL and project-ref mismatch', () => {
    expect(() => getBrowserEnvironment({
      ...hostedSource,
      VITE_SUPABASE_URL: 'https://other.supabase.co',
    })).toThrow(/does not match/i)
  })

  it('fails closed when required browser public values are missing', () => {
    expect(() => getBrowserEnvironment({
      VITE_CADENCE_ENV: 'beta',
      VITE_API_BASE_URL: '',
    })).toThrow(/missing required/i)
  })

  it('does not expose a privileged browser credential path', () => {
    const environment = getBrowserEnvironment(hostedSource)
    expect(Object.keys(environment).sort()).toEqual([
      'apiBaseUrl',
      'cadenceEnvironment',
      'supabaseProjectRef',
      'supabasePublicKey',
      'supabaseUrl',
    ])
  })

  it('derives the configured project id from the injected generated value', () => {
    expect(getConfiguredProjectId(hostedSource)).toBe(
      '11111111-1111-4111-8111-111111111111',
    )
  })
})

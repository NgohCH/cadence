import { createClient } from '@supabase/supabase-js'
import { getBrowserEnvironment } from './env'

let browserClient: ReturnType<typeof createClient> | undefined

export function getSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient
  }

  const environment = getBrowserEnvironment()

  browserClient = createClient(
    environment.supabaseUrl,
    environment.supabasePublicKey,
  )

  return browserClient
}

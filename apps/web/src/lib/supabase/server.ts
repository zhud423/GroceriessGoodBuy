import { createClient } from "@supabase/supabase-js"

import { getSupabasePublicEnvironment } from "@/src/lib/env"

export function createSupabaseServerClient() {
  const { url, publishableKey } = getSupabasePublicEnvironment()

  return createClient(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  })
}

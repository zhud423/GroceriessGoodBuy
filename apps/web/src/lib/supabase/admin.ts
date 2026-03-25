import { createClient } from "@supabase/supabase-js"

import { getSupabaseServiceEnvironment } from "@/src/lib/env"

export function createSupabaseAdminClient() {
  const { url, secretKey } = getSupabaseServiceEnvironment()

  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  })
}

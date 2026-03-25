type RequiredEnvironmentKey =
  | "DATABASE_URL"
  | "DIRECT_URL"
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  | "SUPABASE_SECRET_KEY"

type SupabasePublicEnvironment = {
  url: string
  publishableKey: string
}

type SupabaseServiceEnvironment = SupabasePublicEnvironment & {
  secretKey: string
}

const isFilled = (value: string | undefined) => Boolean(value && value.trim().length > 0)

function requireEnvironment(key: RequiredEnvironmentKey) {
  const value = process.env[key]

  if (!isFilled(value)) {
    throw new Error(`Missing required environment variable: ${key}`)
  }

  return value as string
}

export function getEnvironmentSummary() {
  return {
    databaseUrl: isFilled(process.env.DATABASE_URL),
    directUrl: isFilled(process.env.DIRECT_URL),
    supabaseUrl: isFilled(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabasePublishableKey: isFilled(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    supabaseSecretKey: isFilled(process.env.SUPABASE_SECRET_KEY)
  }
}

export function getSupabasePublicEnvironment(): SupabasePublicEnvironment {
  return {
    url: requireEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    publishableKey: requireEnvironment("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
  }
}

export function getSupabaseServiceEnvironment(): SupabaseServiceEnvironment {
  return {
    ...getSupabasePublicEnvironment(),
    secretKey: requireEnvironment("SUPABASE_SECRET_KEY")
  }
}

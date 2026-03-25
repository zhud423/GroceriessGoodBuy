"use client"

import { usePathname, useRouter } from "next/navigation"
import type { ReactNode } from "react"
import { useEffect } from "react"

import { useAuth } from "@/src/providers/auth-provider"

function debugRequireAuth(event: string, details?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") {
    return
  }

  console.info("[require-auth]", event, details ?? {})
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const auth = useAuth()

  useEffect(() => {
    debugRequireAuth("effect", {
      pathname,
      isReady: auth.isReady,
      isAuthenticated: auth.isAuthenticated,
      username: auth.user?.username ?? null
    })

    if (!auth.isReady || auth.isAuthenticated) {
      return
    }

    debugRequireAuth("redirect-login", {
      pathname
    })
    router.replace(`/login?redirectTo=${encodeURIComponent(pathname)}`)
  }, [auth.isAuthenticated, auth.isReady, pathname, router])

  if (!auth.isReady) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="rounded-full border border-[color:var(--line)] bg-white/70 px-5 py-2 text-sm text-[color:var(--muted)]">
          正在恢复登录状态...
        </div>
      </div>
    )
  }

  if (!auth.isAuthenticated) {
    return null
  }

  return <>{children}</>
}

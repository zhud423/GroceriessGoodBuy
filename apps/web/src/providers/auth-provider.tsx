"use client"

import { createContext, type ReactNode, useContext, useEffect, useState } from "react"

type AuthUser = {
  id: string
  username: string
  displayName: string | null
}

type StoredAuthSession = {
  accessToken: string
  user: AuthUser
}

type AuthContextValue = {
  isReady: boolean
  isAuthenticated: boolean
  user: AuthUser | null
  accessToken: string | null
  signIn: (username: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const STORAGE_KEY = "groceries-good-buy:auth-session"
const AuthContext = createContext<AuthContextValue | null>(null)

function debugAuth(event: string, details?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") {
    return
  }

  console.info("[auth]", event, details ?? {})
}

function readStoredSession() {
  if (typeof window === "undefined") {
    debugAuth("read-stored-session-skipped", { reason: "window-undefined" })
    return null
  }

  let rawValue: string | null = null

  try {
    rawValue = window.localStorage.getItem(STORAGE_KEY)
  } catch (error) {
    console.warn("Failed to read auth session from localStorage.", error)
    debugAuth("read-stored-session-failed", {
      message: error instanceof Error ? error.message : String(error)
    })
    return null
  }

  if (!rawValue) {
    debugAuth("read-stored-session-empty")
    return null
  }

  try {
    const session = JSON.parse(rawValue) as StoredAuthSession
    debugAuth("read-stored-session-success", {
      username: session.user.username
    })

    return session
  } catch {
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      console.warn("Failed to clear invalid auth session from localStorage.", error)
    }

    debugAuth("read-stored-session-invalid-json")
    return null
  }
}

function writeStoredSession(value: StoredAuthSession | null) {
  if (typeof window === "undefined") {
    return
  }

  try {
    if (!value) {
      window.localStorage.removeItem(STORAGE_KEY)
      debugAuth("write-stored-session-cleared")
      return
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    debugAuth("write-stored-session-success", {
      username: value.user.username
    })
  } catch (error) {
    console.warn("Failed to persist auth session to localStorage.", error)
    debugAuth("write-stored-session-failed", {
      message: error instanceof Error ? error.message : String(error)
    })
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredAuthSession | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    try {
      const storedSession = readStoredSession()
      setSession(storedSession)
    } finally {
      setIsReady(true)
      debugAuth("provider-ready")
    }
  }, [])

  const value: AuthContextValue = {
    isReady,
    isAuthenticated: Boolean(session?.accessToken),
    user: session?.user ?? null,
    accessToken: session?.accessToken ?? null,
    async signIn(username, password) {
      debugAuth("sign-in-start", { username })
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username,
          password
        })
      })

      const payload = await response.json()

      if (!response.ok || payload?.ok === false) {
        debugAuth("sign-in-failed", {
          username,
          message: payload?.message ?? "登录失败。"
        })
        throw new Error(payload?.message ?? "登录失败。")
      }

      const nextSession = payload.data as StoredAuthSession
      writeStoredSession(nextSession)
      setSession(nextSession)
      debugAuth("sign-in-success", {
        username: nextSession.user.username
      })
    },
    async signOut() {
      writeStoredSession(null)
      setSession(null)
      debugAuth("sign-out")
    }
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error("useAuth must be used within AppProviders.")
  }

  return context
}

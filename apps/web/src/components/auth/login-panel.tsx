"use client"

import { startTransition, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { useAuth } from "@/src/providers/auth-provider"

export function LoginPanel() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const auth = useAuth()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const redirectTo = searchParams.get("redirectTo") || "/"

  async function handleSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      await auth.signIn(username.trim(), password)
      startTransition(() => {
        router.replace(redirectTo)
      })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "登录失败。")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-8 shadow-[0_24px_80px_rgba(108,91,69,0.12)] backdrop-blur">
      <div className="mb-8 space-y-3">
        <div className="inline-flex rounded-full border border-[color:var(--line)] bg-white/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--accent-strong)]">
          Sign In
        </div>
        <h1 className="font-display text-4xl leading-tight text-[color:var(--foreground)]">
          登录
        </h1>
        <p className="max-w-md text-sm leading-7 text-[color:var(--muted)]">
          输入账号和密码继续。
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSignIn}>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-[color:var(--foreground)]">
            账号
          </span>
          <input
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="请输入账号"
            className="w-full rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-base outline-none transition focus:border-[color:var(--accent)]"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-[color:var(--foreground)]">
            密码
          </span>
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="请输入密码"
            className="w-full rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-base outline-none transition focus:border-[color:var(--accent)]"
          />
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-2xl bg-[color:var(--accent-strong)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "登录中..." : "登录"}
        </button>
      </form>

      {errorMessage && (
        <div
          className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          {errorMessage}
        </div>
      )}
    </div>
  )
}

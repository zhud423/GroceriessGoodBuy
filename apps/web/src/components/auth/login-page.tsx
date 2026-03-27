"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect } from "react"

import { LoginPanel } from "@/src/components/auth/login-panel"
import { useAuth } from "@/src/providers/auth-provider"

export function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const auth = useAuth()

  useEffect(() => {
    if (!auth.isReady || !auth.isAuthenticated) {
      return
    }

    router.replace(searchParams.get("redirectTo") || "/")
  }, [auth.isAuthenticated, auth.isReady, router, searchParams])

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,214,153,0.4),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(164,205,176,0.35),transparent_24%),linear-gradient(180deg,#fbf6ee_0%,#f0eadf_100%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center px-4 py-8 md:px-8">
        <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="hidden rounded-[36px] border border-[color:var(--line)] bg-[color:var(--surface)] p-10 shadow-[0_24px_80px_rgba(108,91,69,0.12)] lg:block">
            <div className="inline-flex rounded-full border border-[color:var(--line)] bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">
              Groceries Good Buy
            </div>
            <h2 className="mt-6 font-display text-5xl leading-tight text-[color:var(--foreground)]">
              登录后即可管理商品库与购物记录。
            </h2>
            <p className="mt-6 max-w-xl text-base leading-8 text-[color:var(--muted)]">
              上传订单截图，系统会智能识别订单信息和商品内容，确认后即可完成导入。
            </p>
          </div>
          <div className="flex items-center">
            <LoginPanel />
          </div>
        </div>
      </div>
    </main>
  )
}

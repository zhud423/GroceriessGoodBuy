"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState, type ReactNode } from "react"

import { useAuth } from "@/src/providers/auth-provider"

const navigationItems = [
  { href: "/", label: "总览" },
  { href: "/products", label: "商品库" },
  { href: "/orders", label: "购物记录" }
] as const

export function AppShell({
  title,
  description,
  children,
  actions,
  hideWorkspaceHeader = false
}: {
  title: string
  description: string
  children: ReactNode
  actions?: ReactNode
  hideWorkspaceHeader?: boolean
}) {
  const pathname = usePathname()
  const router = useRouter()
  const auth = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  async function handleSignOut() {
    await auth.signOut()
    router.replace("/login")
  }

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,214,153,0.45),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(165,208,171,0.35),transparent_22%)]" />
      <div className="sticky top-0 z-50 border-b border-[color:var(--line)] bg-[color:var(--surface)]/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">
            Groceries Good Buy
          </div>
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((current) => !current)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--line)] bg-white/70 text-lg text-[color:var(--foreground)] transition hover:bg-white"
            aria-label={isMobileMenuOpen ? "关闭导航菜单" : "打开导航菜单"}
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>

        {isMobileMenuOpen ? (
          <div className="space-y-2 border-t border-[color:var(--line)] px-4 pb-4 pt-3">
            {navigationItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href))

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    isActive
                      ? "bg-[color:var(--accent-strong)] text-white shadow-[0_10px_30px_rgba(141,74,18,0.28)]"
                      : "bg-white/70 text-[color:var(--foreground)] hover:bg-white"
                  }`}
                >
                  <span>{item.label}</span>
                  <span className={isActive ? "text-white/70" : "text-[color:var(--muted)]"}>
                    →
                  </span>
                </Link>
              )
            })}
            <button
              type="button"
              onClick={handleSignOut}
              className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-3 text-sm font-semibold text-[color:var(--foreground)] transition hover:bg-white"
            >
              退出登录
            </button>
          </div>
        ) : null}
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-4 md:px-6 md:py-6">
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="hidden rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-[0_24px_80px_rgba(108,91,69,0.12)] backdrop-blur lg:block">
            <div className="mb-8">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">
                Groceries Good Buy
              </div>
              <h1 className="mt-4 font-display text-3xl leading-tight text-[color:var(--foreground)]">
                生活管家
              </h1>
              <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                记录买过的商品、对比最近价格、回看每次采购。
              </p>
            </div>

            <nav className="space-y-2">
              {navigationItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href))

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                      isActive
                        ? "bg-[color:var(--accent-strong)] text-white shadow-[0_10px_30px_rgba(141,74,18,0.28)]"
                        : "bg-white/70 text-[color:var(--foreground)] hover:bg-white"
                    }`}
                  >
                    <span>{item.label}</span>
                    <span className={isActive ? "text-white/70" : "text-[color:var(--muted)]"}>
                      →
                    </span>
                  </Link>
                )
              })}
            </nav>
            <button
              type="button"
              onClick={handleSignOut}
              className="mt-8 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-3 text-sm font-semibold text-[color:var(--foreground)] transition hover:bg-white"
            >
              退出登录
            </button>
          </aside>

          <div className="space-y-4">
            {!hideWorkspaceHeader ? (
              <header className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] px-6 py-5 shadow-[0_24px_80px_rgba(108,91,69,0.1)] backdrop-blur">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">
                      Workspace
                    </div>
                    <h2 className="mt-2 font-display text-4xl leading-tight text-[color:var(--foreground)]">
                      {title}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-7 text-[color:var(--muted)]">
                      {description}
                    </p>
                  </div>
                  {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
                </div>
              </header>
            ) : null}
            <main>{children}</main>
          </div>
        </div>
      </div>
    </div>
  )
}

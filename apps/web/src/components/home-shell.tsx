import { PLATFORMS } from "@life-assistant/shared"

type EnvironmentSummary = {
  databaseUrl: boolean
  directUrl: boolean
  supabaseUrl: boolean
  supabasePublishableKey: boolean
  supabaseSecretKey: boolean
}

type HomeShellProps = {
  environment: EnvironmentSummary
}

const dictionaryEndpoints = [
  {
    title: "分类字典",
    href: "/api/categories",
    description: "从 Prisma / Supabase Postgres 读取系统预设一级分类。"
  },
  {
    title: "标签字典",
    href: "/api/tags",
    description: "从 Prisma / Supabase Postgres 读取系统预设标签。"
  },
  {
    title: "平台字典",
    href: "/api/platforms",
    description: "从共享常量返回当前平台枚举与文案。"
  }
] as const

const environmentItems = [
  { key: "databaseUrl", label: "DATABASE_URL" },
  { key: "directUrl", label: "DIRECT_URL" },
  { key: "supabaseUrl", label: "NEXT_PUBLIC_SUPABASE_URL" },
  { key: "supabasePublishableKey", label: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" },
  { key: "supabaseSecretKey", label: "SUPABASE_SECRET_KEY" }
] as const

export function HomeShell({ environment }: HomeShellProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-10 md:px-10">
      <section className="overflow-hidden rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] shadow-[0_24px_80px_rgba(108,91,69,0.12)] backdrop-blur">
        <div className="grid gap-8 p-8 md:grid-cols-[1.6fr_1fr] md:p-10">
          <div className="space-y-6">
            <div className="inline-flex items-center rounded-full border border-[color:var(--line)] bg-white/55 px-3 py-1 text-sm font-medium text-[color:var(--muted)]">
              Phase 1 Bootstrap
            </div>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
                生活管家一期工程已初始化，当前聚焦数据底座与基础字典接口。
              </h1>
              <p className="max-w-2xl text-base leading-7 text-[color:var(--muted)] md:text-lg">
                当前仓库已经按 PRD、技术方案与 API contract 建立 monorepo、Next.js 15
                App Router、Prisma 访问层，以及 Supabase client 封装。下一阶段可以直接接商品与订单
                CRUD。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {PLATFORMS.map((platform) => (
                <span
                  key={platform.code}
                  className="rounded-full bg-[color:var(--surface-strong)] px-4 py-2 text-sm font-medium text-[color:var(--accent-strong)] ring-1 ring-inset ring-[color:var(--line)]"
                >
                  {platform.label}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-[color:var(--line)] bg-white/75 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">环境状态</h2>
              <span className="text-sm text-[color:var(--muted)]">仅检查是否已配置</span>
            </div>
            <div className="space-y-3">
              {environmentItems.map((item) => {
                const ready = environment[item.key]

                return (
                  <div
                    key={item.key}
                    className="flex items-center justify-between rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-3"
                  >
                    <span className="text-sm font-medium">{item.label}</span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        ready
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {ready ? "已配置" : "待配置"}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {dictionaryEndpoints.map((endpoint) => (
          <a
            key={endpoint.href}
            href={endpoint.href}
            className="group rounded-[28px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-[0_12px_40px_rgba(108,91,69,0.08)] transition hover:-translate-y-0.5 hover:bg-white"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-base font-semibold">{endpoint.title}</span>
              <span className="text-sm text-[color:var(--accent)] transition group-hover:translate-x-1">
                查看
              </span>
            </div>
            <p className="mb-6 text-sm leading-6 text-[color:var(--muted)]">
              {endpoint.description}
            </p>
            <code className="text-sm text-[color:var(--accent-strong)]">{endpoint.href}</code>
          </a>
        ))}
      </section>
    </main>
  )
}

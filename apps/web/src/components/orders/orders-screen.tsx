"use client"

import type { GetOrdersResponse, PlatformDto } from "@life-assistant/contracts"
import Link from "next/link"
import { useState } from "react"

import { EmptyState } from "@/src/components/ui/empty-state"
import { QueryState } from "@/src/components/ui/query-state"
import { apiFetch } from "@/src/lib/api-client"
import { formatDatetime } from "@/src/lib/formatters"
import { useAuthedQuery } from "@/src/hooks/use-authed-query"

export function OrdersScreen({
  initialPlatform = ""
}: {
  initialPlatform?: string
}) {
  const [platform, setPlatform] = useState(initialPlatform)
  const [draftPlatform, setDraftPlatform] = useState(initialPlatform)
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false)
  const [isPlatformPickerOpen, setIsPlatformPickerOpen] = useState(false)

  const platformsQuery = useAuthedQuery<PlatformDto[]>({
    queryKey: ["platforms"],
    queryFn: (accessToken) =>
      apiFetch("/api/platforms", {
        accessToken
      })
  })

  const ordersQuery = useAuthedQuery<GetOrdersResponse>({
    queryKey: ["orders", platform],
    queryFn: (accessToken) => {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "24"
      })

      if (platform) {
        params.set("platform", platform)
      }

      return apiFetch(`/api/orders?${params.toString()}`, {
        accessToken
      })
    }
  })

  const platformOptions = [
    { value: "", label: "全部平台" },
    ...(platformsQuery.data?.map((item) => ({ value: item.code, label: item.label })) ?? [])
  ]
  const activeFilterCount = platform ? 1 : 0
  const selectedPlatformLabel =
    platformOptions.find((item) => item.value === platform)?.label ?? "全部平台"
  const draftPlatformLabel =
    platformOptions.find((item) => item.value === draftPlatform)?.label ?? "全部平台"

  function openFilterSheet() {
    setDraftPlatform(platform)
    setIsFilterSheetOpen(true)
  }

  function closeFilterSheet() {
    setIsPlatformPickerOpen(false)
    setIsFilterSheetOpen(false)
  }

  function applyFilterSheet() {
    setPlatform(draftPlatform)
    closeFilterSheet()
  }

  function resetFilterSheet() {
    setDraftPlatform("")
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-[0_20px_70px_rgba(108,91,69,0.08)]">
        <div className="mb-4">
          <div className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">
            Order History
          </div>
          <h2 className="mt-2 font-display text-3xl leading-tight text-[color:var(--foreground)]">
            购物记录
          </h2>
          <div className="mt-2 text-sm leading-7 text-[color:var(--muted)]">
            按时间和平台浏览每次购物，快速回看采购内容。
          </div>
        </div>
        <div className="space-y-3 md:hidden">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={openFilterSheet}
              className="inline-flex items-center justify-center rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm font-semibold text-[color:var(--foreground)]"
            >
              筛选{activeFilterCount > 0 ? ` · 已筛${activeFilterCount}` : ""}
            </button>
            <Link
              href="/orders/new"
              className="inline-flex items-center justify-center rounded-2xl bg-[color:var(--accent-strong)] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(141,74,18,0.24)] transition hover:opacity-95"
            >
              手动新增订单
            </Link>
          </div>
        </div>

        <div className="hidden flex-col gap-3 md:flex md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <select
              value={platform}
              onChange={(event) => setPlatform(event.target.value)}
              className="w-full rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)] md:w-72"
            >
              <option value="">全部平台</option>
              {platformsQuery.data?.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label}
                </option>
              ))}
            </select>
            <div className="text-sm leading-7 text-[color:var(--muted)]">
              手动录入和截图导入最终都会沉淀成统一订单记录。
            </div>
          </div>
          <Link
            href="/orders/new"
            className="inline-flex items-center justify-center rounded-2xl bg-[color:var(--accent-strong)] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(141,74,18,0.24)] transition hover:opacity-95"
          >
            手动新增订单
          </Link>
        </div>
      </section>

      {isFilterSheetOpen ? (
        <div className="fixed inset-0 z-50 h-dvh overflow-hidden md:hidden">
          <button
            type="button"
            aria-label="关闭筛选弹窗"
            onClick={closeFilterSheet}
            className="absolute inset-0 bg-black/20"
          />
          <section className="absolute inset-x-0 bottom-0 max-h-[52dvh] overflow-y-auto rounded-t-[28px] border border-[color:var(--line)] bg-[rgb(255,251,245)] p-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-[0_-20px_60px_rgba(42,28,17,0.18)]">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl text-[color:var(--foreground)]">筛选</h3>
              <button
                type="button"
                onClick={closeFilterSheet}
                className="rounded-xl border border-[color:var(--line)] bg-white px-3 py-2 text-sm font-semibold text-[color:var(--foreground)]"
              >
                关闭
              </button>
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setIsPlatformPickerOpen(true)}
                className="flex w-full items-center justify-between rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-left text-sm text-[color:var(--foreground)]"
              >
                <span>{draftPlatformLabel}</span>
                <span className="text-xs text-[color:var(--muted)]">▼</span>
              </button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={resetFilterSheet}
                className="rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm font-semibold text-[color:var(--foreground)]"
              >
                重置
              </button>
              <button
                type="button"
                onClick={applyFilterSheet}
                className="rounded-2xl bg-[color:var(--accent-strong)] px-4 py-3 text-sm font-semibold text-white"
              >
                应用并关闭
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isFilterSheetOpen && isPlatformPickerOpen ? (
        <div className="fixed inset-0 z-[60] h-dvh overflow-hidden md:hidden">
          <button
            type="button"
            aria-label="关闭平台选项弹窗"
            onClick={() => setIsPlatformPickerOpen(false)}
            className="absolute inset-0 bg-black/25"
          />
          <section className="absolute inset-x-0 bottom-0 max-h-[52dvh] overflow-y-auto rounded-t-[28px] border border-[color:var(--line)] bg-[rgb(255,251,245)] p-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-[0_-20px_60px_rgba(42,28,17,0.18)]">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl text-[color:var(--foreground)]">选择平台</h3>
              <button
                type="button"
                onClick={() => setIsPlatformPickerOpen(false)}
                className="rounded-xl border border-[color:var(--line)] bg-white px-3 py-2 text-sm font-semibold text-[color:var(--foreground)]"
              >
                关闭
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {platformOptions.map((item) => {
                const selected = item.value === draftPlatform

                return (
                  <button
                    key={`order-platform-${item.value || "all"}`}
                    type="button"
                    onClick={() => {
                      setDraftPlatform(item.value)
                      setIsPlatformPickerOpen(false)
                    }}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                      selected
                        ? "border-[color:var(--accent-strong)] bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]"
                        : "border-[color:var(--line)] bg-white text-[color:var(--foreground)]"
                    }`}
                  >
                    <span>{item.label}</span>
                    {selected ? <span>✓</span> : null}
                  </button>
                )
              })}
            </div>
          </section>
        </div>
      ) : null}

      {ordersQuery.isLoading ? (
        <QueryState title="正在加载订单列表" description="正在整理最近的购物记录。" />
      ) : ordersQuery.error ? (
        <QueryState
          title="订单加载失败"
          description={ordersQuery.error instanceof Error ? ordersQuery.error.message : "请稍后重试。"}
        />
      ) : ordersQuery.data && ordersQuery.data.items.length > 0 ? (
        <>
          <div className="text-sm text-[color:var(--muted)]">
            共 {ordersQuery.data.total} 条购物记录
          </div>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {ordersQuery.data.items.map((order) => (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="rounded-[28px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-[0_20px_70px_rgba(108,91,69,0.08)] transition hover:-translate-y-0.5 hover:bg-white"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-[color:var(--foreground)]">
                      {order.platform.label}
                    </h3>
                    <p className="mt-1 text-sm text-[color:var(--muted)]">
                      {formatDatetime(order.orderedAt)}
                    </p>
                  </div>
                  <div className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
                    {order.itemCount} 件
                  </div>
                </div>
              </Link>
            ))}
          </section>
        </>
      ) : (
        <EmptyState
          title="还没有订单记录"
          description="完成一次手动录入或截图导入后，这里会沉淀每次购物的完整回看。"
        />
      )}
    </div>
  )
}

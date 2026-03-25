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

  return (
    <div className="space-y-4">
      <section className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-[0_20px_70px_rgba(108,91,69,0.08)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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

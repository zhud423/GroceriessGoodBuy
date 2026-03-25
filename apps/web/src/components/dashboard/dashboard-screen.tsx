"use client"

import type { GetOrdersResponse, GetProductsResponse } from "@life-assistant/contracts"
import Link from "next/link"

import { apiFetch } from "@/src/lib/api-client"
import { formatDatetime } from "@/src/lib/formatters"
import { useAuthedQuery } from "@/src/hooks/use-authed-query"
import { InventoryStatusBadge } from "@/src/components/ui/status-badge"
import { QueryState } from "@/src/components/ui/query-state"

export function DashboardScreen() {
  const productsQuery = useAuthedQuery<GetProductsResponse>({
    queryKey: ["dashboard", "products"],
    queryFn: (accessToken) =>
      apiFetch("/api/products?page=1&pageSize=4&sort=recent_purchased", {
        accessToken
      })
  })
  const ordersQuery = useAuthedQuery<GetOrdersResponse>({
    queryKey: ["dashboard", "orders"],
    queryFn: (accessToken) =>
      apiFetch("/api/orders?page=1&pageSize=4", {
        accessToken
      })
  })
  const lowStockQuery = useAuthedQuery<GetProductsResponse>({
    queryKey: ["dashboard", "low-stock", "LOW"],
    queryFn: (accessToken) =>
      apiFetch("/api/products?page=1&pageSize=4&sort=recent_purchased&inventoryStatus=LOW", {
        accessToken
      })
  })
  const outStockQuery = useAuthedQuery<GetProductsResponse>({
    queryKey: ["dashboard", "low-stock", "OUT"],
    queryFn: (accessToken) =>
      apiFetch("/api/products?page=1&pageSize=4&sort=recent_purchased&inventoryStatus=OUT", {
        accessToken
      })
  })

  return (
    <div className="space-y-4">
      <section className="grid gap-4 lg:grid-cols-1">
        <Link
          href="/imports/new"
          className="rounded-[28px] border border-[color:var(--line)] bg-[linear-gradient(135deg,rgba(255,240,211,0.96),rgba(255,250,242,0.92))] p-5 shadow-[0_18px_60px_rgba(108,91,69,0.08)] transition hover:-translate-y-0.5"
        >
          <div className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">
            Quick Start
          </div>
          <h3 className="mt-3 font-display text-2xl text-[color:var(--foreground)]">
            导入订单
          </h3>
          <p className="mt-2 text-sm leading-7 text-[color:var(--muted)]">
            上传订单截图后，系统会自动解析并回填订单信息和商品内容。确认一次即可完成订单导入。
          </p>
        </Link>
      </section>

      <section className="rounded-[28px] border border-[color:var(--line)] bg-[color:var(--surface)] p-4 shadow-[0_18px_60px_rgba(108,91,69,0.08)]">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[24px] border border-[color:var(--line)] bg-white/75 p-4">
            <div className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">
              商品总数
            </div>
            <div className="mt-3 text-3xl font-semibold text-[color:var(--foreground)] md:text-4xl">
              {productsQuery.data?.total ?? "—"}
            </div>
          </div>
          <div className="rounded-[24px] border border-[color:var(--line)] bg-white/75 p-4">
            <div className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">
              订单总数
            </div>
            <div className="mt-3 text-3xl font-semibold text-[color:var(--foreground)] md:text-4xl">
              {ordersQuery.data?.total ?? "—"}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-[0_24px_80px_rgba(108,91,69,0.08)]">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="font-display text-2xl text-[color:var(--foreground)]">
              最近关注的商品
            </h3>
            <Link className="text-sm font-semibold text-[color:var(--accent-strong)]" href="/products">
              查看全部
            </Link>
          </div>
          {productsQuery.isLoading ? (
            <QueryState title="正在加载商品" description="商品库预览会在这里出现。" />
          ) : productsQuery.error ? (
            <QueryState
              title="商品加载失败"
              description={productsQuery.error instanceof Error ? productsQuery.error.message : "请稍后重试。"}
            />
          ) : (
            <div className="space-y-3">
              {productsQuery.data?.items.map((product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.id}`}
                  className="block rounded-[24px] border border-[color:var(--line)] bg-white/75 p-4 transition hover:bg-white"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-[color:var(--foreground)]">
                        {product.displayName}
                      </div>
                      <div className="mt-1 text-sm text-[color:var(--muted)]">
                        {product.category.name}
                      </div>
                    </div>
                    <InventoryStatusBadge status={product.inventoryStatus} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {product.platforms.map((platform) => (
                      <span
                        key={platform.code}
                        className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700"
                      >
                        {platform.label}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-[0_24px_80px_rgba(108,91,69,0.08)]">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="font-display text-2xl text-[color:var(--foreground)]">
              最近购物记录
            </h3>
            <Link className="text-sm font-semibold text-[color:var(--accent-strong)]" href="/orders">
              查看全部
            </Link>
          </div>
          {ordersQuery.isLoading ? (
            <QueryState title="正在加载订单" description="最近几次购物会在这里出现。" />
          ) : ordersQuery.error ? (
            <QueryState
              title="订单加载失败"
              description={ordersQuery.error instanceof Error ? ordersQuery.error.message : "请稍后重试。"}
            />
          ) : (
            <div className="space-y-3">
              {ordersQuery.data?.items.map((order) => (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="block rounded-[24px] border border-[color:var(--line)] bg-white/75 p-4 transition hover:bg-white"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-base font-semibold text-[color:var(--foreground)]">
                        {order.platform.label}
                      </div>
                      <div className="mt-1 text-sm text-[color:var(--muted)]">
                        {formatDatetime(order.orderedAt)}
                      </div>
                    </div>
                    <div className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
                      {order.itemCount} 件商品
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-[0_24px_80px_rgba(108,91,69,0.08)]">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="font-display text-2xl text-[color:var(--foreground)]">
              待补货
            </h3>
            <Link
              className="text-sm font-semibold text-[color:var(--accent-strong)]"
              href="/products?inventoryStatus=LOW"
            >
              查看全部
            </Link>
          </div>
          {lowStockQuery.isLoading ? (
            <QueryState title="正在加载待补货商品" description="库存状态为“快没了”的商品会出现在这里。" />
          ) : lowStockQuery.error ? (
            <QueryState
              title="待补货商品加载失败"
              description={lowStockQuery.error instanceof Error ? lowStockQuery.error.message : "请稍后重试。"}
            />
          ) : lowStockQuery.data?.items.length ? (
            <div className="space-y-3">
              {lowStockQuery.data.items.map((product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.id}`}
                  className="block rounded-[24px] border border-[color:var(--line)] bg-white/75 p-4 transition hover:bg-white"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-[color:var(--foreground)]">
                        {product.displayName}
                      </div>
                      <div className="mt-1 text-sm text-[color:var(--muted)]">
                        {product.category.name}
                      </div>
                    </div>
                    <InventoryStatusBadge status={product.inventoryStatus} />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <QueryState title="当前没有待补货商品" description="把商品库存状态改成“快没了”后，这里会自动出现。" />
          )}
        </div>

        <div className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-[0_24px_80px_rgba(108,91,69,0.08)]">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="font-display text-2xl text-[color:var(--foreground)]">
              已用完
            </h3>
            <Link
              className="text-sm font-semibold text-[color:var(--accent-strong)]"
              href="/products?inventoryStatus=OUT"
            >
              查看全部
            </Link>
          </div>
          {outStockQuery.isLoading ? (
            <QueryState title="正在加载已用完商品" description="库存状态为“已用完”的商品会出现在这里。" />
          ) : outStockQuery.error ? (
            <QueryState
              title="已用完商品加载失败"
              description={outStockQuery.error instanceof Error ? outStockQuery.error.message : "请稍后重试。"}
            />
          ) : outStockQuery.data?.items.length ? (
            <div className="space-y-3">
              {outStockQuery.data.items.map((product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.id}`}
                  className="block rounded-[24px] border border-[color:var(--line)] bg-white/75 p-4 transition hover:bg-white"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-[color:var(--foreground)]">
                        {product.displayName}
                      </div>
                      <div className="mt-1 text-sm text-[color:var(--muted)]">
                        {product.category.name}
                      </div>
                    </div>
                    <InventoryStatusBadge status={product.inventoryStatus} />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <QueryState title="当前没有已用完商品" description="把商品库存状态改成“已用完”后，这里会进入这个系统视图。" />
          )}
        </div>
      </section>
    </div>
  )
}

"use client"

import type { ProductDetailDto } from "@life-assistant/contracts"
import Link from "next/link"

import { QueryState } from "@/src/components/ui/query-state"
import { InventoryStatusBadge } from "@/src/components/ui/status-badge"
import { apiFetch } from "@/src/lib/api-client"
import { formatCurrencyFromCent, formatDatetime } from "@/src/lib/formatters"
import { useAuthedQuery } from "@/src/hooks/use-authed-query"

export function ProductDetailScreen({ productId }: { productId: string }) {
  const productQuery = useAuthedQuery<ProductDetailDto>({
    queryKey: ["product-detail", productId],
    queryFn: (accessToken) =>
      apiFetch(`/api/products/${productId}`, {
        accessToken
      })
  })

  if (productQuery.isLoading) {
    return <QueryState title="正在加载商品详情" description="正在整理商品档案与最近价格。" />
  }

  if (productQuery.error || !productQuery.data) {
    return (
      <QueryState
        title="商品详情加载失败"
        description={productQuery.error instanceof Error ? productQuery.error.message : "请稍后重试。"}
      />
    )
  }

  const product = productQuery.data

  return (
    <div className="space-y-4">
      <section className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-[0_24px_80px_rgba(108,91,69,0.08)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="font-display text-3xl text-[color:var(--foreground)]">
              {product.displayName}
            </h3>
            <p className="mt-2 text-sm leading-7 text-[color:var(--muted)]">
              {product.category.name} · 标准化名称 {product.normalizedName}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <InventoryStatusBadge status={product.inventoryStatus} />
            <Link
              href={`/products/${product.id}/edit`}
              className="rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-sm font-semibold text-[color:var(--foreground)] transition hover:bg-white"
            >
              编辑商品
            </Link>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] bg-white/80 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              最近购买
            </div>
            <div className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">
              {formatDatetime(product.lastPurchasedAt)}
            </div>
          </div>
          <div className="rounded-[24px] bg-white/80 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              规格
            </div>
            <div className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">
              {product.specText ?? "未填写"}
            </div>
          </div>
          <div className="rounded-[24px] bg-white/80 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              平台分布
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {product.platforms.map((platform) => (
                <span
                  key={platform.code}
                  className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700"
                >
                  {platform.label}
                </span>
              ))}
            </div>
          </div>
        </div>
        {product.tags.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {product.tags.map((tag) => (
              <span
                key={tag.id}
                className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--accent-strong)]"
              >
                {tag.name}
              </span>
            ))}
          </div>
        ) : null}
        {product.note ? (
          <div className="mt-5 rounded-[24px] border border-[color:var(--line)] bg-white/70 p-4 text-sm leading-7 text-[color:var(--muted)]">
            {product.note}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-[0_24px_80px_rgba(108,91,69,0.08)]">
          <h4 className="font-display text-2xl text-[color:var(--foreground)]">
            各平台最近成交价
          </h4>
          <div className="mt-4 space-y-3">
            {product.latestPlatformPrices.length > 0 ? (
              product.latestPlatformPrices.map((item) => (
                <div
                  key={item.platform.code}
                  className="rounded-[24px] border border-[color:var(--line)] bg-white/80 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-base font-semibold text-[color:var(--foreground)]">
                      {item.platform.label}
                    </div>
                    <div className="text-sm text-[color:var(--muted)]">
                      {formatDatetime(item.latestOrderedAt)}
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <div>
                      <div className="text-xs text-[color:var(--muted)]">成交价</div>
                      <div className="mt-1 text-lg font-semibold text-[color:var(--foreground)]">
                        {formatCurrencyFromCent(item.linePriceAmount)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-[color:var(--muted)]">数量</div>
                      <div className="mt-1 text-lg font-semibold text-[color:var(--foreground)]">
                        {item.quantity}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-[color:var(--muted)]">每 100g</div>
                      <div className="mt-1 text-lg font-semibold text-[color:var(--foreground)]">
                        {formatCurrencyFromCent(item.pricePer100g)}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <QueryState title="还没有价格记录" description="等商品关联到订单后，这里会显示各平台最近成交价。" />
            )}
          </div>
        </div>

        <div className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-[0_24px_80px_rgba(108,91,69,0.08)]">
          <h4 className="font-display text-2xl text-[color:var(--foreground)]">
            最近关联订单
          </h4>
          <div className="mt-4 space-y-3">
            {product.recentOrders.length > 0 ? (
              product.recentOrders.map((order) => (
                <Link
                  key={order.orderId}
                  href={`/orders/${order.orderId}`}
                  className="block rounded-[24px] border border-[color:var(--line)] bg-white/80 p-4 transition hover:bg-white"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-[color:var(--foreground)]">
                        {order.platform.label}
                      </div>
                      <div className="mt-1 text-sm text-[color:var(--muted)]">
                        {formatDatetime(order.orderedAt)}
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-[color:var(--accent-strong)]">
                      {formatCurrencyFromCent(order.linePriceAmount)}
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <QueryState title="还没有关联订单" description="手动新建订单或完成截图导入后，这里会出现。" />
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

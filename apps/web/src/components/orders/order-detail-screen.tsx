"use client"

import type { OrderDetailDto } from "@life-assistant/contracts"
import Link from "next/link"

import { QueryState } from "@/src/components/ui/query-state"
import { apiFetch } from "@/src/lib/api-client"
import { formatCurrencyFromCent, formatDatetime } from "@/src/lib/formatters"
import { useAuthedQuery } from "@/src/hooks/use-authed-query"

export function OrderDetailScreen({ orderId }: { orderId: string }) {
  const orderQuery = useAuthedQuery<OrderDetailDto>({
    queryKey: ["order-detail", orderId],
    queryFn: (accessToken) =>
      apiFetch(`/api/orders/${orderId}`, {
        accessToken
      }),
    refetchInterval: (query) =>
      query.state.data?.importProcessing?.isPending ? 3000 : false
  })

  if (orderQuery.isLoading) {
    return <QueryState title="正在加载订单详情" description="正在整理订单商品和原始截图。" />
  }

  if (orderQuery.error || !orderQuery.data) {
    return (
      <QueryState
        title="订单详情加载失败"
        description={orderQuery.error instanceof Error ? orderQuery.error.message : "请稍后重试。"}
      />
    )
  }

  const order = orderQuery.data

  return (
    <div className="space-y-4">
      <section className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-[0_24px_80px_rgba(108,91,69,0.08)]">
        <div className="mb-5 flex items-center justify-end">
          <Link
            href={`/orders/${order.id}/edit`}
            className="rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-sm font-semibold text-[color:var(--foreground)] transition hover:bg-white"
          >
            编辑订单
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] bg-white/80 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              平台
            </div>
            <div className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">
              {order.platform.label}
            </div>
          </div>
          <div className="rounded-[24px] bg-white/80 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              下单时间
            </div>
            <div className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">
              {formatDatetime(order.orderedAt)}
            </div>
          </div>
          <div className="rounded-[24px] bg-white/80 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              商品数量
            </div>
            <div className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">
              {order.items.length} 件
            </div>
          </div>
        </div>
        {order.note ? (
          <div className="mt-5 rounded-[24px] border border-[color:var(--line)] bg-white/75 p-4 text-sm leading-7 text-[color:var(--muted)]">
            {order.note}
          </div>
        ) : null}
        {order.importProcessing?.isPending ? (
          <div className="mt-5 rounded-[24px] border border-[color:var(--line)] bg-white/75 p-4 text-sm leading-7 text-[color:var(--muted)]">
            订单已经提交，后台正在整理订单截图和商品归档信息，页面会自动刷新。
          </div>
        ) : null}
        {order.importProcessing?.errorMessage ? (
          <div className="mt-5 rounded-[24px] border border-rose-200 bg-rose-50 p-4 text-sm leading-7 text-rose-700">
            后台整理失败：{order.importProcessing.errorMessage}
          </div>
        ) : null}
        {order.importProcessing && order.importProcessing.unresolvedItemCount > 0 ? (
          <div className="mt-5 rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-800">
            还有 {order.importProcessing.unresolvedItemCount} 个商品项未归档到商品主档，但订单本身已经可用。
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-[0_24px_80px_rgba(108,91,69,0.08)]">
          <h4 className="font-display text-2xl text-[color:var(--foreground)]">订单商品</h4>
          <div className="mt-4 space-y-3">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="rounded-[24px] border border-[color:var(--line)] bg-white/80 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {item.product ? (
                      <Link
                        href={`/products/${item.product.id}`}
                        className="text-base font-semibold text-[color:var(--foreground)] transition hover:text-[color:var(--accent-strong)]"
                      >
                        {item.product.displayName}
                      </Link>
                    ) : (
                      <div className="text-base font-semibold text-[color:var(--foreground)]">
                        {item.rawName}
                      </div>
                    )}
                    <div className="mt-1 text-sm text-[color:var(--muted)]">
                      {item.product ? item.rawName : "暂未关联商品主档"}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-[color:var(--accent-strong)]">
                    {formatCurrencyFromCent(item.linePriceAmount)}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      item.resolutionStatus === "CREATED_NEW_PRODUCT"
                        ? "bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]"
                        : item.resolutionStatus === "MATCHED_EXISTING"
                          ? "bg-stone-100 text-stone-700"
                          : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {item.resolutionStatus === "CREATED_NEW_PRODUCT"
                      ? "当次新建商品"
                      : item.resolutionStatus === "MATCHED_EXISTING"
                        ? "命中已有商品"
                        : "待归档"}
                  </span>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <div>
                    <div className="text-xs text-[color:var(--muted)]">数量</div>
                    <div className="mt-1 text-sm font-semibold text-[color:var(--foreground)]">
                      {item.quantity}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[color:var(--muted)]">规格</div>
                    <div className="mt-1 text-sm font-semibold text-[color:var(--foreground)]">
                      {item.specText ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[color:var(--muted)]">重量</div>
                    <div className="mt-1 text-sm font-semibold text-[color:var(--foreground)]">
                      {item.weightGrams ? `${item.weightGrams}g` : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[color:var(--muted)]">每 100g</div>
                    <div className="mt-1 text-sm font-semibold text-[color:var(--foreground)]">
                      {formatCurrencyFromCent(item.pricePer100g)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-[0_24px_80px_rgba(108,91,69,0.08)]">
          <h4 className="font-display text-2xl text-[color:var(--foreground)]">订单截图</h4>
          <div className="mt-4 space-y-3">
            {order.images.length > 0 ? (
              order.images.map((image) => {
                const isRemote = image.imageUrl.startsWith("http")

                return (
                  <div
                    key={image.id}
                    className="rounded-[24px] border border-[color:var(--line)] bg-white/80 p-4"
                  >
                    <div className="mb-3 text-sm font-semibold text-[color:var(--foreground)]">
                      第 {image.pageIndex + 1} 页
                    </div>
                    {isRemote ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt={`订单截图 ${image.pageIndex + 1}`}
                        src={image.imageUrl}
                        className="w-full rounded-2xl border border-[color:var(--line)] object-cover"
                      />
                    ) : (
                      <div className="rounded-2xl border border-dashed border-[color:var(--line)] bg-stone-50 px-4 py-6 text-xs leading-6 text-[color:var(--muted)]">
                        当前未生成可直接访问的图片 URL。
                        <div className="mt-2 break-all font-mono">{image.imageUrl}</div>
                      </div>
                    )}
                  </div>
                )
              })
            ) : order.importProcessing?.isPending ? (
              <QueryState
                title="正在整理订单截图"
                description="订单已经创建完成，截图会在后台复制完成后自动显示。"
              />
            ) : (
              <QueryState title="还没有订单截图" description="后续从导入会话提交的订单会在这里显示原始截图。" />
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

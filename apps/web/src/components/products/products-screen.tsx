"use client"

import type {
  CategoryDto,
  GetProductsResponse,
  PlatformDto
} from "@life-assistant/contracts"
import Link from "next/link"
import { useDeferredValue, useState } from "react"

import { EmptyState } from "@/src/components/ui/empty-state"
import { QueryState } from "@/src/components/ui/query-state"
import { InventoryStatusBadge } from "@/src/components/ui/status-badge"
import { apiFetch } from "@/src/lib/api-client"
import { formatDatetime } from "@/src/lib/formatters"
import { useAuthedQuery } from "@/src/hooks/use-authed-query"

const inventoryOptions = [
  { value: "", label: "全部库存状态" },
  { value: "UNKNOWN", label: "未知" },
  { value: "SUFFICIENT", label: "充足" },
  { value: "LOW", label: "快没了" },
  { value: "OUT", label: "已用完" }
] as const

export function ProductsScreen({
  initialSearch = "",
  initialCategoryId = "",
  initialPlatform = "",
  initialInventoryStatus = ""
}: {
  initialSearch?: string
  initialCategoryId?: string
  initialPlatform?: string
  initialInventoryStatus?: string
}) {
  const [search, setSearch] = useState(initialSearch)
  const [categoryId, setCategoryId] = useState(initialCategoryId)
  const [platform, setPlatform] = useState(initialPlatform)
  const [inventoryStatus, setInventoryStatus] = useState(initialInventoryStatus)
  const deferredSearch = useDeferredValue(search)

  const categoriesQuery = useAuthedQuery<CategoryDto[]>({
    queryKey: ["categories"],
    queryFn: (accessToken) =>
      apiFetch("/api/categories", {
        accessToken
      })
  })

  const platformsQuery = useAuthedQuery<PlatformDto[]>({
    queryKey: ["platforms"],
    queryFn: (accessToken) =>
      apiFetch("/api/platforms", {
        accessToken
      })
  })

  const productsQuery = useAuthedQuery<GetProductsResponse>({
    queryKey: ["products", deferredSearch, categoryId, platform, inventoryStatus],
    queryFn: (accessToken) => {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "24",
        sort: "recent_added"
      })

      if (deferredSearch.trim()) {
        params.set("q", deferredSearch.trim())
      }

      if (categoryId) {
        params.set("categoryId", categoryId)
      }

      if (platform) {
        params.set("platform", platform)
      }

      if (inventoryStatus) {
        params.set("inventoryStatus", inventoryStatus)
      }

      return apiFetch(`/api/products?${params.toString()}`, {
        accessToken
      })
    }
  })

  return (
    <div className="space-y-4">
      <section className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-[0_20px_70px_rgba(108,91,69,0.08)]">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">
              Product Library
            </div>
            <div className="mt-2 text-sm leading-7 text-[color:var(--muted)]">
              主库负责承载长期商品对象，手动新建和订单导入都应该回到这里。
            </div>
          </div>
          <Link
            href="/products/new"
            className="inline-flex items-center justify-center rounded-2xl bg-[color:var(--accent-strong)] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(141,74,18,0.24)] transition hover:opacity-95"
          >
            手动新增商品
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索商品名"
            className="rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
          />
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className="rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
          >
            <option value="">全部分类</option>
            {categoriesQuery.data?.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            value={platform}
            onChange={(event) => setPlatform(event.target.value)}
            className="rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
          >
            <option value="">全部平台</option>
            {platformsQuery.data?.map((item) => (
              <option key={item.code} value={item.code}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            value={inventoryStatus}
            onChange={(event) => setInventoryStatus(event.target.value)}
            className="rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
          >
            {inventoryOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {productsQuery.isLoading ? (
        <QueryState title="正在加载商品库" description="正在按当前筛选条件拉取商品。" />
      ) : productsQuery.error ? (
        <QueryState
          title="商品加载失败"
          description={productsQuery.error instanceof Error ? productsQuery.error.message : "请稍后重试。"}
        />
      ) : productsQuery.data && productsQuery.data.items.length > 0 ? (
        <>
          <div className="text-sm text-[color:var(--muted)]">
            共 {productsQuery.data.total} 个商品
          </div>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {productsQuery.data.items.map((product) => (
              <Link
                key={product.id}
                href={`/products/${product.id}`}
                className="rounded-[28px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-[0_20px_70px_rgba(108,91,69,0.08)] transition hover:-translate-y-0.5 hover:bg-white"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-[color:var(--foreground)]">
                      {product.displayName}
                    </h3>
                    <p className="mt-1 text-sm text-[color:var(--muted)]">
                      {product.category.name}
                    </p>
                  </div>
                  <InventoryStatusBadge status={product.inventoryStatus} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {product.platforms.map((item) => (
                    <span
                      key={item.code}
                      className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700"
                    >
                      {item.label}
                    </span>
                  ))}
                </div>
                <div className="mt-4 text-xs text-[color:var(--muted)]">
                  最近购买：{formatDatetime(product.lastPurchasedAt)}
                </div>
              </Link>
            ))}
          </section>
        </>
      ) : (
        <EmptyState
          title="还没有符合条件的商品"
          description="先通过手动录入或截图导入沉淀商品，后面才能按分类和平台回看。"
        />
      )}
    </div>
  )
}

"use client"

import type {
  CategoryDto,
  CreateOrderRequest,
  GetProductsResponse,
  MutateOrderResponse,
  PlatformDto,
  TagDto
} from "@life-assistant/contracts"
import { calculatePricePer100g } from "@life-assistant/domain"
import { useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { QueryState } from "@/src/components/ui/query-state"
import { useAuthedMutation } from "@/src/hooks/use-authed-mutation"
import { useAuthedQuery } from "@/src/hooks/use-authed-query"
import { apiFetch } from "@/src/lib/api-client"
import {
  getFormErrorMessage,
  getFormFieldErrors,
  parseCurrencyInputToCent,
  toIsoDatetimeString
} from "@/src/lib/form-helpers"
import { formatCurrencyFromCent } from "@/src/lib/formatters"

type OrderItemFormState = {
  id: string
  mode: "existing_product" | "new_product"
  productId: string
  rawName: string
  linePriceAmount: string
  quantity: string
  specText: string
  weightGrams: string
  newProductDisplayName: string
  newProductCategoryId: string
  newProductTagIds: string[]
  newProductInventoryStatus: "UNKNOWN" | "SUFFICIENT" | "LOW" | "OUT"
  newProductNote: string
}

type OrderFormState = {
  platform: string
  orderedAt: string
  note: string
  items: OrderItemFormState[]
}

const inputClassName =
  "w-full rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"

const textareaClassName =
  "w-full rounded-3xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-sm leading-7 outline-none transition focus:border-[color:var(--accent)]"

const inventoryOptions = [
  { value: "UNKNOWN", label: "未知" },
  { value: "SUFFICIENT", label: "充足" },
  { value: "LOW", label: "快没了" },
  { value: "OUT", label: "已用完" }
] as const

function createOrderItemFormState(): OrderItemFormState {
  return {
    id: crypto.randomUUID(),
    mode: "existing_product",
    productId: "",
    rawName: "",
    linePriceAmount: "",
    quantity: "1",
    specText: "",
    weightGrams: "",
    newProductDisplayName: "",
    newProductCategoryId: "",
    newProductTagIds: [],
    newProductInventoryStatus: "UNKNOWN",
    newProductNote: ""
  }
}

function createInitialOrderFormState(): OrderFormState {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  const orderedAt = new Date(now.getTime() - offset * 60_000)
    .toISOString()
    .slice(0, 16)

  return {
    platform: "",
    orderedAt,
    note: "",
    items: [createOrderItemFormState()]
  }
}

export function OrderCreateScreen() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<OrderFormState>(createInitialOrderFormState)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const platformsQuery = useAuthedQuery<PlatformDto[]>({
    queryKey: ["platforms"],
    queryFn: (accessToken) =>
      apiFetch("/api/platforms", {
        accessToken
      })
  })

  const categoriesQuery = useAuthedQuery<CategoryDto[]>({
    queryKey: ["categories"],
    queryFn: (accessToken) =>
      apiFetch("/api/categories", {
        accessToken
      })
  })

  const tagsQuery = useAuthedQuery<TagDto[]>({
    queryKey: ["tags"],
    queryFn: (accessToken) =>
      apiFetch("/api/tags", {
        accessToken
      })
  })

  const productsQuery = useAuthedQuery<GetProductsResponse>({
    queryKey: ["order-create", "products"],
    queryFn: (accessToken) =>
      apiFetch("/api/products?page=1&pageSize=100&sort=recent_added", {
        accessToken
      })
  })

  const saveOrderMutation = useAuthedMutation<MutateOrderResponse, OrderFormState>({
    mutationFn: async (accessToken, nextForm) => {
      const items = nextForm.items.map((item, index) => {
        const linePriceAmount = parseCurrencyInputToCent(item.linePriceAmount)

        if (linePriceAmount == null) {
          throw new Error(`第 ${index + 1} 个商品项的成交价格式不正确。`)
        }

        const baseItem = {
          rawName: item.rawName.trim(),
          linePriceAmount,
          quantity: item.quantity.trim(),
          specText: item.specText.trim() ? item.specText.trim() : null,
          weightGrams: item.weightGrams.trim()
            ? Number.parseInt(item.weightGrams.trim(), 10)
            : null
        }

        if (item.mode === "existing_product") {
          return {
            mode: item.mode,
            productId: item.productId,
            ...baseItem
          } satisfies CreateOrderRequest["items"][number]
        }

        return {
          mode: item.mode,
          ...baseItem,
          newProduct: {
            displayName: item.newProductDisplayName.trim(),
            categoryId: item.newProductCategoryId,
            tagIds: item.newProductTagIds,
            inventoryStatus: item.newProductInventoryStatus,
            note: item.newProductNote.trim() ? item.newProductNote.trim() : null
          }
        } satisfies CreateOrderRequest["items"][number]
      })

      return apiFetch("/api/orders", {
        method: "POST",
        accessToken,
        body: {
          platform: nextForm.platform as CreateOrderRequest["platform"],
          orderedAt: toIsoDatetimeString(nextForm.orderedAt),
          note: nextForm.note.trim() ? nextForm.note.trim() : null,
          items
        } satisfies CreateOrderRequest
      })
    },
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      ])

      router.replace(`/orders/${data.orderId}`)
    },
    onError: (error) => {
      setSubmitError(getFormErrorMessage(error))
      setFieldErrors(getFormFieldErrors(error))
    }
  })

  const loadingError =
    platformsQuery.error ?? categoriesQuery.error ?? tagsQuery.error ?? productsQuery.error

  if (
    platformsQuery.isLoading ||
    categoriesQuery.isLoading ||
    tagsQuery.isLoading ||
    productsQuery.isLoading
  ) {
    return <QueryState title="正在准备订单表单" description="正在读取平台、分类、标签和商品列表。" />
  }

  if (loadingError) {
    return (
      <QueryState
        title="订单表单加载失败"
        description={loadingError instanceof Error ? loadingError.message : "请稍后重试。"}
      />
    )
  }

  function updateItem(
    itemId: string,
    updater: (current: OrderItemFormState) => OrderItemFormState
  ) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === itemId ? updater(item) : item))
    }))
  }

  function toggleNewProductTag(itemId: string, tagId: string) {
    updateItem(itemId, (current) => ({
      ...current,
      newProductTagIds: current.newProductTagIds.includes(tagId)
        ? current.newProductTagIds.filter((item) => item !== tagId)
        : [...current.newProductTagIds, tagId]
    }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError(null)
    setFieldErrors({})
    await saveOrderMutation.mutateAsync(form)
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <section className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-[0_24px_80px_rgba(108,91,69,0.08)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="font-display text-3xl text-[color:var(--foreground)]">
              手动新增订单
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-[color:var(--muted)]">
              当前先把“平台 + 时间 + 商品项”这条主链路补齐。订单截图凭证会在 Storage
              配置到位后再接入到同一条记录里。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/orders"
              className="rounded-2xl border border-[color:var(--line)] bg-white/75 px-4 py-3 text-sm font-semibold text-[color:var(--foreground)] transition hover:bg-white"
            >
              返回
            </Link>
            <button
              type="submit"
              disabled={saveOrderMutation.isPending}
              className="rounded-2xl bg-[color:var(--accent-strong)] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(141,74,18,0.24)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saveOrderMutation.isPending ? "保存中..." : "保存订单"}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <div className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-[0_24px_80px_rgba(108,91,69,0.08)]">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-[color:var(--foreground)]">
                  平台
                </span>
                <select
                  value={form.platform}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, platform: event.target.value }))
                  }
                  className={inputClassName}
                >
                  <option value="">请选择平台</option>
                  {platformsQuery.data?.map((platform) => (
                    <option key={platform.code} value={platform.code}>
                      {platform.label}
                    </option>
                  ))}
                </select>
                {fieldErrors.platform ? (
                  <div className="text-xs text-red-600">{fieldErrors.platform}</div>
                ) : null}
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-[color:var(--foreground)]">
                  下单时间
                </span>
                <input
                  type="datetime-local"
                  value={form.orderedAt}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, orderedAt: event.target.value }))
                  }
                  className={inputClassName}
                />
                {fieldErrors.orderedAt ? (
                  <div className="text-xs text-red-600">{fieldErrors.orderedAt}</div>
                ) : null}
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-semibold text-[color:var(--foreground)]">
                  订单备注
                </span>
                <textarea
                  value={form.note}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, note: event.target.value }))
                  }
                  rows={4}
                  placeholder="例如：这次主要是补货，山姆部分商品有活动。"
                  className={textareaClassName}
                />
              </label>
            </div>
          </div>

          <div className="space-y-4">
            {form.items.map((item, index) => {
              const previewPricePer100g = calculatePricePer100g({
                linePriceAmount: parseCurrencyInputToCent(item.linePriceAmount) ?? 0,
                quantity: item.quantity.trim() || "0",
                weightGrams: item.weightGrams.trim()
                  ? Number.parseInt(item.weightGrams.trim(), 10)
                  : null
              })

              return (
                <section
                  key={item.id}
                  className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-[0_24px_80px_rgba(108,91,69,0.08)]"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">
                        Item {index + 1}
                      </div>
                      <h4 className="mt-2 font-display text-2xl text-[color:var(--foreground)]">
                        商品项
                      </h4>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="inline-flex rounded-full border border-[color:var(--line)] bg-white/80 p-1">
                        <button
                          type="button"
                          onClick={() =>
                            updateItem(item.id, (current) => ({
                              ...current,
                              mode: "existing_product"
                            }))
                          }
                          className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                            item.mode === "existing_product"
                              ? "bg-[color:var(--accent-strong)] text-white"
                              : "text-[color:var(--muted)]"
                          }`}
                        >
                          关联已有商品
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateItem(item.id, (current) => ({
                              ...current,
                              mode: "new_product"
                            }))
                          }
                          className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                            item.mode === "new_product"
                              ? "bg-[color:var(--accent-strong)] text-white"
                              : "text-[color:var(--muted)]"
                          }`}
                        >
                          现场新建商品
                        </button>
                      </div>
                      {form.items.length > 1 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              items: current.items.filter((entry) => entry.id !== item.id)
                            }))
                          }
                          className="rounded-2xl border border-[color:var(--line)] bg-white/75 px-4 py-3 text-sm font-semibold text-[color:var(--foreground)] transition hover:bg-white"
                        >
                          删除
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {item.mode === "existing_product" ? (
                      <label className="space-y-2 md:col-span-2">
                        <span className="text-sm font-semibold text-[color:var(--foreground)]">
                          已有商品
                        </span>
                        <select
                          value={item.productId}
                          onChange={(event) =>
                            updateItem(item.id, (current) => {
                              const matchedProduct = productsQuery.data?.items.find(
                                (product) => product.id === event.target.value
                              )

                              return {
                                ...current,
                                productId: event.target.value,
                                rawName:
                                  current.rawName || !matchedProduct
                                    ? current.rawName
                                    : matchedProduct.displayName
                              }
                            })
                          }
                          className={inputClassName}
                        >
                          <option value="">请选择商品</option>
                          {productsQuery.data?.items.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.displayName} · {product.category.name}
                            </option>
                          ))}
                        </select>
                        {fieldErrors[`items.${index}.productId`] ? (
                          <div className="text-xs text-red-600">
                            {fieldErrors[`items.${index}.productId`]}
                          </div>
                        ) : null}
                      </label>
                    ) : (
                      <>
                        <label className="space-y-2">
                          <span className="text-sm font-semibold text-[color:var(--foreground)]">
                            新商品名称
                          </span>
                          <input
                            value={item.newProductDisplayName}
                            onChange={(event) =>
                              updateItem(item.id, (current) => ({
                                ...current,
                                newProductDisplayName: event.target.value,
                                rawName:
                                  current.rawName || !event.target.value.trim()
                                    ? current.rawName
                                    : event.target.value
                              }))
                            }
                            placeholder="例如：冰鲜三文鱼腩"
                            className={inputClassName}
                          />
                          {fieldErrors[`items.${index}.manualDisplayName`] ? (
                            <div className="text-xs text-red-600">
                              {fieldErrors[`items.${index}.manualDisplayName`]}
                            </div>
                          ) : null}
                        </label>

                        <label className="space-y-2">
                          <span className="text-sm font-semibold text-[color:var(--foreground)]">
                            新商品分类
                          </span>
                          <select
                            value={item.newProductCategoryId}
                            onChange={(event) =>
                              updateItem(item.id, (current) => ({
                                ...current,
                                newProductCategoryId: event.target.value
                              }))
                            }
                            className={inputClassName}
                          >
                            <option value="">请选择分类</option>
                            {categoriesQuery.data?.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                          {fieldErrors[`items.${index}.manualCategoryId`] ? (
                            <div className="text-xs text-red-600">
                              {fieldErrors[`items.${index}.manualCategoryId`]}
                            </div>
                          ) : null}
                        </label>
                      </>
                    )}

                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-[color:var(--foreground)]">
                        名称原文
                      </span>
                      <input
                        value={item.rawName}
                        onChange={(event) =>
                          updateItem(item.id, (current) => ({
                            ...current,
                            rawName: event.target.value
                          }))
                        }
                        placeholder="保留本次订单中看到的原始名称"
                        className={inputClassName}
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-[color:var(--foreground)]">
                        成交价
                      </span>
                      <input
                        value={item.linePriceAmount}
                        onChange={(event) =>
                          updateItem(item.id, (current) => ({
                            ...current,
                            linePriceAmount: event.target.value
                          }))
                        }
                        placeholder="例如：39.80"
                        className={inputClassName}
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-[color:var(--foreground)]">
                        数量
                      </span>
                      <input
                        value={item.quantity}
                        onChange={(event) =>
                          updateItem(item.id, (current) => ({
                            ...current,
                            quantity: event.target.value
                          }))
                        }
                        placeholder="例如：1 / 2 / 0.75"
                        className={inputClassName}
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-[color:var(--foreground)]">
                        规格
                      </span>
                      <input
                        value={item.specText}
                        onChange={(event) =>
                          updateItem(item.id, (current) => ({
                            ...current,
                            specText: event.target.value
                          }))
                        }
                        placeholder="例如：500g / 两盒装"
                        className={inputClassName}
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-[color:var(--foreground)]">
                        重量（g）
                      </span>
                      <input
                        value={item.weightGrams}
                        onChange={(event) =>
                          updateItem(item.id, (current) => ({
                            ...current,
                            weightGrams: event.target.value
                          }))
                        }
                        placeholder="例如：450"
                        className={inputClassName}
                      />
                    </label>

                    <div className="rounded-[24px] border border-[color:var(--line)] bg-white/80 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                        每 100g 预估
                      </div>
                      <div className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">
                        {formatCurrencyFromCent(previewPricePer100g)}
                      </div>
                      <div className="mt-2 text-xs leading-6 text-[color:var(--muted)]">
                        只有成交价、数量、重量都有效时才会写入标准化单价。
                      </div>
                    </div>
                  </div>

                  {item.mode === "new_product" ? (
                    <div className="mt-4 space-y-4 rounded-[28px] border border-[color:var(--line)] bg-white/70 p-5">
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-2">
                          <span className="text-sm font-semibold text-[color:var(--foreground)]">
                            新商品库存状态
                          </span>
                          <select
                            value={item.newProductInventoryStatus}
                            onChange={(event) =>
                              updateItem(item.id, (current) => ({
                                ...current,
                                newProductInventoryStatus: event.target
                                  .value as OrderItemFormState["newProductInventoryStatus"]
                              }))
                            }
                            className={inputClassName}
                          >
                            {inventoryOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <div>
                        <div className="mb-3 text-sm font-semibold text-[color:var(--foreground)]">
                          新商品标签
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {tagsQuery.data?.map((tag) => {
                            const isSelected = item.newProductTagIds.includes(tag.id)

                            return (
                              <label
                                key={tag.id}
                                className={`inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                                  isSelected
                                    ? "bg-[color:var(--accent-strong)] text-white"
                                    : "bg-white/80 text-[color:var(--foreground)]"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleNewProductTag(item.id, tag.id)}
                                  className="sr-only"
                                />
                                {tag.name}
                              </label>
                            )
                          })}
                        </div>
                      </div>

                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-[color:var(--foreground)]">
                          新商品备注
                        </span>
                        <textarea
                          value={item.newProductNote}
                          onChange={(event) =>
                            updateItem(item.id, (current) => ({
                              ...current,
                              newProductNote: event.target.value
                            }))
                          }
                          rows={3}
                          placeholder="例如：这次价格不错，下次可以优先看。"
                          className={textareaClassName}
                        />
                      </label>
                    </div>
                  ) : null}
                </section>
              )
            })}

            <button
              type="button"
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  items: [...current.items, createOrderItemFormState()]
                }))
              }
              className="w-full rounded-[28px] border border-dashed border-[color:var(--line)] bg-white/65 px-4 py-4 text-sm font-semibold text-[color:var(--foreground)] transition hover:bg-white"
            >
              新增一个商品项
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[32px] border border-[color:var(--line)] bg-white/75 p-6 shadow-[0_24px_80px_rgba(108,91,69,0.08)]">
            <h4 className="font-display text-2xl text-[color:var(--foreground)]">
              保存规则
            </h4>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-[color:var(--muted)]">
              <li>平台、下单时间、每个商品项的名称原文、成交价、数量都是必填链路。</li>
              <li>一个商品项要么关联已有商品，要么现场新建商品，不能两边都空。</li>
              <li>手动建单时截图不是必填，这一版先把结构化订单沉淀下来。</li>
            </ul>
            {submitError ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {submitError}
              </div>
            ) : null}
          </div>

          <div className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-[0_24px_80px_rgba(108,91,69,0.08)]">
            <h4 className="font-display text-2xl text-[color:var(--foreground)]">
              当前商品库
            </h4>
            <div className="mt-4 space-y-3">
              {productsQuery.data?.items.length ? (
                productsQuery.data.items.slice(0, 8).map((product) => (
                  <div
                    key={product.id}
                    className="rounded-[24px] border border-[color:var(--line)] bg-white/80 p-4"
                  >
                    <div className="text-sm font-semibold text-[color:var(--foreground)]">
                      {product.displayName}
                    </div>
                    <div className="mt-1 text-xs text-[color:var(--muted)]">
                      {product.category.name}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-[color:var(--line)] bg-white/70 px-4 py-6 text-sm leading-7 text-[color:var(--muted)]">
                  当前商品库还是空的。你也可以在建单过程中直接创建新商品。
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </form>
  )
}

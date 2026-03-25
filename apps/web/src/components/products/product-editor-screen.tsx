"use client"

import type {
  CategoryDto,
  CreateProductRequest,
  MutateProductResponse,
  PlatformDto,
  ProductDetailDto,
  TagDto,
  UpdateProductRequest
} from "@life-assistant/contracts"
import { useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { QueryState } from "@/src/components/ui/query-state"
import { useAuthedMutation } from "@/src/hooks/use-authed-mutation"
import { useAuthedQuery } from "@/src/hooks/use-authed-query"
import { apiFetch } from "@/src/lib/api-client"
import {
  getFormErrorMessage,
  getFormFieldErrors
} from "@/src/lib/form-helpers"

type ProductEditorScreenProps =
  | {
      mode: "create"
    }
  | {
      mode: "edit"
      productId: string
    }

type ProductFormState = {
  displayName: string
  categoryId: string
  platformCodes: string[]
  specText: string
  tagIds: string[]
  inventoryStatus: CreateProductRequest["inventoryStatus"]
  note: string
}

const inventoryOptions = [
  { value: "UNKNOWN", label: "未知" },
  { value: "SUFFICIENT", label: "充足" },
  { value: "LOW", label: "快没了" },
  { value: "OUT", label: "已用完" }
] as const

const inputClassName =
  "w-full rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"

const textareaClassName =
  "w-full rounded-3xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-sm leading-7 outline-none transition focus:border-[color:var(--accent)]"

function createEmptyFormState(): ProductFormState {
  return {
    displayName: "",
    categoryId: "",
    platformCodes: [],
    specText: "",
    tagIds: [],
    inventoryStatus: "UNKNOWN",
    note: ""
  }
}

function buildCreatePayload(form: ProductFormState): CreateProductRequest {
  return {
    displayName: form.displayName.trim(),
    categoryId: form.categoryId,
    platformCodes: form.platformCodes as CreateProductRequest["platformCodes"],
    specText: form.specText.trim() ? form.specText.trim() : null,
    tagIds: form.tagIds,
    inventoryStatus: form.inventoryStatus,
    note: form.note.trim() ? form.note.trim() : null
  }
}

function buildUpdatePayload(form: ProductFormState): UpdateProductRequest {
  return {
    displayName: form.displayName.trim(),
    categoryId: form.categoryId,
    specText: form.specText.trim() ? form.specText.trim() : null,
    tagIds: form.tagIds,
    inventoryStatus: form.inventoryStatus,
    note: form.note.trim() ? form.note.trim() : null
  }
}

export function ProductEditorScreen(props: ProductEditorScreenProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const didHydrateRef = useRef(false)
  const productId = props.mode === "edit" ? props.productId : null
  const [form, setForm] = useState<ProductFormState>(createEmptyFormState)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

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

  const platformsQuery = useAuthedQuery<PlatformDto[]>({
    queryKey: ["platforms"],
    queryFn: (accessToken) =>
      apiFetch("/api/platforms", {
        accessToken
      })
  })

  const productQuery = useAuthedQuery<ProductDetailDto>({
    queryKey: ["product-detail", productId],
    enabled: Boolean(productId),
    queryFn: (accessToken) =>
      apiFetch(`/api/products/${productId}`, {
        accessToken
      })
  })

  useEffect(() => {
    if (props.mode !== "edit" || !productQuery.data || didHydrateRef.current) {
      return
    }

    didHydrateRef.current = true
    setForm({
      displayName: productQuery.data.displayName,
      categoryId: productQuery.data.category.id,
      platformCodes: productQuery.data.platforms.map((platform) => platform.code),
      specText: productQuery.data.specText ?? "",
      tagIds: productQuery.data.tags.map((tag) => tag.id),
      inventoryStatus: productQuery.data.inventoryStatus,
      note: productQuery.data.note ?? ""
    })
  }, [productQuery.data, props.mode])

  const saveProductMutation = useAuthedMutation<
    MutateProductResponse,
    ProductFormState
  >({
    mutationFn: async (accessToken, nextForm) => {
      if (props.mode === "create") {
        return apiFetch("/api/products", {
          method: "POST",
          accessToken,
          body: buildCreatePayload(nextForm)
        })
      }

      return apiFetch(`/api/products/${props.productId}`, {
        method: "PATCH",
        accessToken,
        body: buildUpdatePayload(nextForm)
      })
    },
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["product-detail", data.productId] })
      ])

      router.replace(`/products/${data.productId}`)
    },
    onError: (error) => {
      setSubmitError(getFormErrorMessage(error))
      setFieldErrors(getFormFieldErrors(error))
    }
  })

  const dictionariesError = categoriesQuery.error ?? tagsQuery.error ?? platformsQuery.error
  const isLoadingDictionaries =
    categoriesQuery.isLoading || tagsQuery.isLoading || platformsQuery.isLoading

  if (isLoadingDictionaries || (props.mode === "edit" && productQuery.isLoading)) {
    return (
      <QueryState
        title={props.mode === "create" ? "正在准备商品表单" : "正在加载商品表单"}
        description="正在读取分类、标签和商品信息。"
      />
    )
  }

  if (dictionariesError || (props.mode === "edit" && (productQuery.error || !productQuery.data))) {
    return (
      <QueryState
        title="商品表单加载失败"
        description={
          dictionariesError instanceof Error
            ? dictionariesError.message
            : productQuery.error instanceof Error
              ? productQuery.error.message
              : "请稍后重试。"
        }
      />
    )
  }

  function toggleArrayValue(key: "platformCodes" | "tagIds", value: string) {
    setForm((current) => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key].filter((item) => item !== value)
        : [...current[key], value]
    }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError(null)
    setFieldErrors({})
    await saveProductMutation.mutateAsync(form)
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <section className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-[0_24px_80px_rgba(108,91,69,0.08)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="font-display text-3xl text-[color:var(--foreground)]">
              {props.mode === "create" ? "手动新增商品" : "维护商品档案"}
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-[color:var(--muted)]">
              {props.mode === "create"
                ? "先把商品主档补齐，后续订单和导入都会往这个主档上累积。"
                : "当前版本优先维护商品主档字段。平台出现记录仍然以历史订单自动累积为准。"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={props.mode === "create" ? "/products" : `/products/${props.productId}`}
              className="rounded-2xl border border-[color:var(--line)] bg-white/75 px-4 py-3 text-sm font-semibold text-[color:var(--foreground)] transition hover:bg-white"
            >
              返回
            </Link>
            <button
              type="submit"
              disabled={saveProductMutation.isPending}
              className="rounded-2xl bg-[color:var(--accent-strong)] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(141,74,18,0.24)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saveProductMutation.isPending ? "保存中..." : "保存商品"}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-[0_24px_80px_rgba(108,91,69,0.08)]">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-semibold text-[color:var(--foreground)]">
                  商品名称
                </span>
                <input
                  value={form.displayName}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, displayName: event.target.value }))
                  }
                  placeholder="例如：有机贝贝南瓜"
                  className={inputClassName}
                />
                {fieldErrors.displayName ? (
                  <div className="text-xs text-red-600">{fieldErrors.displayName}</div>
                ) : null}
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-[color:var(--foreground)]">
                  分类
                </span>
                <select
                  value={form.categoryId}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, categoryId: event.target.value }))
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
                {fieldErrors.categoryId ? (
                  <div className="text-xs text-red-600">{fieldErrors.categoryId}</div>
                ) : null}
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-[color:var(--foreground)]">
                  库存状态
                </span>
                <select
                  value={form.inventoryStatus}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      inventoryStatus: event.target.value as ProductFormState["inventoryStatus"]
                    }))
                  }
                  className={inputClassName}
                >
                  {inventoryOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-semibold text-[color:var(--foreground)]">
                  规格
                </span>
                <input
                  value={form.specText}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, specText: event.target.value }))
                  }
                  placeholder="例如：1kg / 6 个装"
                  className={inputClassName}
                />
              </label>
            </div>
          </div>

          <div className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-[0_24px_80px_rgba(108,91,69,0.08)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h4 className="font-display text-2xl text-[color:var(--foreground)]">
                标签
              </h4>
              <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                可多选
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {tagsQuery.data?.map((tag) => {
                const isSelected = form.tagIds.includes(tag.id)

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
                      onChange={() => toggleArrayValue("tagIds", tag.id)}
                      className="sr-only"
                    />
                    {tag.name}
                  </label>
                )
              })}
            </div>
          </div>

          <div className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-[0_24px_80px_rgba(108,91,69,0.08)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h4 className="font-display text-2xl text-[color:var(--foreground)]">
                备注
              </h4>
              <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                选填
              </div>
            </div>
            <textarea
              value={form.note}
              onChange={(event) =>
                setForm((current) => ({ ...current, note: event.target.value }))
              }
              rows={5}
              placeholder="记录口感、适合的做法、避雷点或下次复购判断。"
              className={textareaClassName}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-[0_24px_80px_rgba(108,91,69,0.08)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h4 className="font-display text-2xl text-[color:var(--foreground)]">
                平台出现记录
              </h4>
              <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                {props.mode === "create" ? "初始化" : "订单自动累积"}
              </div>
            </div>
            {props.mode === "create" ? (
              <div className="space-y-3">
                <p className="text-sm leading-7 text-[color:var(--muted)]">
                  新建商品时可以先勾一个初始平台，后续真实订单会继续补齐平台历史。
                </p>
                <div className="flex flex-wrap gap-3">
                  {platformsQuery.data?.map((platform) => {
                    const isSelected = form.platformCodes.includes(platform.code)

                    return (
                      <label
                        key={platform.code}
                        className={`inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                          isSelected
                            ? "bg-[color:var(--accent-strong)] text-white"
                            : "bg-white/80 text-[color:var(--foreground)]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleArrayValue("platformCodes", platform.code)}
                          className="sr-only"
                        />
                        {platform.label}
                      </label>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm leading-7 text-[color:var(--muted)]">
                  当前版本不直接手改平台集合。平台会随着订单归档自动累积，避免把“买过的平台”改成脱离历史事实的状态。
                </p>
                <div className="flex flex-wrap gap-2">
                  {form.platformCodes.length > 0 ? (
                    productQuery.data?.platforms.map((platform) => (
                      <span
                        key={platform.code}
                        className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-stone-700"
                      >
                        {platform.label}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-stone-500">
                      暂无平台记录
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-[32px] border border-[color:var(--line)] bg-white/75 p-6 shadow-[0_24px_80px_rgba(108,91,69,0.08)]">
            <h4 className="font-display text-2xl text-[color:var(--foreground)]">
              保存前检查
            </h4>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-[color:var(--muted)]">
              <li>商品名称和分类是必填。</li>
              <li>标签、规格、备注都允许后补。</li>
              <li>库存状态默认是“未知”，后续可在商品维护中调整。</li>
            </ul>
            {submitError ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {submitError}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </form>
  )
}

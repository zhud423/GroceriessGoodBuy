"use client"

import type {
  BulkUpdateProductTagsRequest,
  BulkUpdateProductTagsResponse,
  CategoryDto,
  CreateProductRequest,
  GetProductsResponse,
  MutateProductResponse,
  PlatformDto,
  TagDto
} from "@life-assistant/contracts"
import { useQueryClient } from "@tanstack/react-query"
import { useDeferredValue, useEffect, useState } from "react"

import { EmptyState } from "@/src/components/ui/empty-state"
import { QueryState } from "@/src/components/ui/query-state"
import { InventoryStatusBadge } from "@/src/components/ui/status-badge"
import { useAuthedMutation } from "@/src/hooks/use-authed-mutation"
import { apiFetch } from "@/src/lib/api-client"
import { getFormErrorMessage, getFormFieldErrors } from "@/src/lib/form-helpers"
import { useAuthedQuery } from "@/src/hooks/use-authed-query"

const inventoryOptions = [
  { value: "", label: "全部库存状态" },
  { value: "UNKNOWN", label: "未知" },
  { value: "SUFFICIENT", label: "充足" },
  { value: "LOW", label: "快没了" },
  { value: "OUT", label: "已用完" }
] as const

type SelectOption = {
  value: string
  label: string
}

type MobilePickerKey =
  | "filter-category"
  | "filter-platform"
  | "filter-inventory"
  | "batch-action"
  | "batch-tag"
  | "create-category"
  | "create-inventory"

type CreateProductFormState = {
  displayName: string
  categoryId: string
  specText: string
  inventoryStatus: CreateProductRequest["inventoryStatus"]
  note: string
}

function createEmptyCreateProductFormState(): CreateProductFormState {
  return {
    displayName: "",
    categoryId: "",
    specText: "",
    inventoryStatus: "UNKNOWN",
    note: ""
  }
}

function getOptionLabel(options: SelectOption[], value: string, fallback: string) {
  return options.find((item) => item.value === value)?.label ?? fallback
}

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
  const queryClient = useQueryClient()
  const [search, setSearch] = useState(initialSearch)
  const [categoryId, setCategoryId] = useState(initialCategoryId)
  const [platform, setPlatform] = useState(initialPlatform)
  const [inventoryStatus, setInventoryStatus] = useState(initialInventoryStatus)
  const [draftCategoryId, setDraftCategoryId] = useState(initialCategoryId)
  const [draftPlatform, setDraftPlatform] = useState(initialPlatform)
  const [draftInventoryStatus, setDraftInventoryStatus] = useState(initialInventoryStatus)
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false)
  const [isBatchSheetOpen, setIsBatchSheetOpen] = useState(false)
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false)
  const [activeMobilePicker, setActiveMobilePicker] = useState<MobilePickerKey | null>(null)
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [batchAction, setBatchAction] = useState<"add" | "remove">("add")
  const [batchTagId, setBatchTagId] = useState("")
  const [batchMessage, setBatchMessage] = useState<string | null>(null)
  const [createMessage, setCreateMessage] = useState<string | null>(null)
  const [createFieldErrors, setCreateFieldErrors] = useState<Record<string, string>>({})
  const [createForm, setCreateForm] = useState<CreateProductFormState>(
    createEmptyCreateProductFormState
  )
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

  const tagsQuery = useAuthedQuery<TagDto[]>({
    queryKey: ["tags"],
    queryFn: (accessToken) =>
      apiFetch("/api/tags", {
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

  const bulkTagMutation = useAuthedMutation<
    BulkUpdateProductTagsResponse,
    BulkUpdateProductTagsRequest
  >({
    mutationFn: (accessToken, body) =>
      apiFetch("/api/products/bulk-tags", {
        method: "POST",
        accessToken,
        body
      }),
    onSuccess: async (data, variables) => {
      const selectedIdSet = new Set(variables.productIds)
      const selectedTag = tagsQuery.data?.find((tag) => tag.id === variables.tagId) ?? null

      queryClient.setQueriesData<GetProductsResponse>(
        { queryKey: ["products"] },
        (current) => {
          if (!current) {
            return current
          }

          return {
            ...current,
            items: current.items.map((item) => {
              if (!selectedIdSet.has(item.id)) {
                return item
              }

              const nextTags =
                variables.action === "add"
                  ? selectedTag && !item.tags.some((tag) => tag.id === selectedTag.id)
                    ? [
                        ...item.tags,
                        {
                          id: selectedTag.id,
                          code: selectedTag.code,
                          name: selectedTag.name
                        }
                      ]
                    : item.tags
                  : item.tags.filter((tag) => tag.id !== variables.tagId)

              return {
                ...item,
                tags: nextTags
              }
            })
          }
        }
      )

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.refetchQueries({ queryKey: ["products"], type: "active" })
      ])

      setBatchMessage(
        `${variables.action === "add" ? "批量添加标签成功" : "批量移除标签成功"}，已更新 ${data.updatedCount} 个商品。`
      )
      setSelectedProductIds([])
    },
    onError: (error) => {
      setBatchMessage(getFormErrorMessage(error))
    }
  })

  const createProductMutation = useAuthedMutation<
    MutateProductResponse,
    CreateProductRequest
  >({
    mutationFn: (accessToken, body) =>
      apiFetch("/api/products", {
        method: "POST",
        accessToken,
        body
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.refetchQueries({ queryKey: ["products"], type: "active" }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      ])
      setIsCreateSheetOpen(false)
      setCreateMessage(null)
      setCreateFieldErrors({})
      setCreateForm(createEmptyCreateProductFormState())
    },
    onError: (error) => {
      setCreateMessage(getFormErrorMessage(error))
      setCreateFieldErrors(getFormFieldErrors(error))
    }
  })

  useEffect(() => {
    if (!productsQuery.data) {
      setSelectedProductIds([])
      return
    }

    const pageIds = new Set(productsQuery.data.items.map((item) => item.id))
    setSelectedProductIds((current) => current.filter((id) => pageIds.has(id)))
  }, [productsQuery.data])

  const selectedProductIdSet = new Set(selectedProductIds)
  const currentPageProductIds = productsQuery.data?.items.map((item) => item.id) ?? []
  const allCurrentPageSelected =
    currentPageProductIds.length > 0 &&
    currentPageProductIds.every((id) => selectedProductIdSet.has(id))
  const activeFilterCount = [categoryId, platform, inventoryStatus].filter(Boolean).length
  const categorySelectOptions: SelectOption[] = [
    { value: "", label: "全部分类" },
    ...(categoriesQuery.data?.map((item) => ({ value: item.id, label: item.name })) ?? [])
  ]
  const createCategorySelectOptions: SelectOption[] = [
    { value: "", label: "请选择分类" },
    ...(categoriesQuery.data?.map((item) => ({ value: item.id, label: item.name })) ?? [])
  ]
  const platformSelectOptions: SelectOption[] = [
    { value: "", label: "全部平台" },
    ...(platformsQuery.data?.map((item) => ({ value: item.code, label: item.label })) ?? [])
  ]
  const inventoryFilterSelectOptions: SelectOption[] = inventoryOptions.map((item) => ({
    value: item.value,
    label: item.label
  }))
  const inventoryCreateSelectOptions: SelectOption[] = inventoryOptions
    .filter((item) => item.value !== "")
    .map((item) => ({
      value: item.value,
      label: item.label
    }))
  const batchActionSelectOptions: SelectOption[] = [
    { value: "add", label: "批量添加标签" },
    { value: "remove", label: "批量移除标签" }
  ]
  const batchTagSelectOptions: SelectOption[] = [
    {
      value: "",
      label: tagsQuery.isLoading ? "加载标签中..." : "选择标签"
    },
    ...(tagsQuery.data?.map((tag) => ({ value: tag.id, label: tag.name })) ?? [])
  ]

  function toggleProductSelection(productId: string) {
    setBatchMessage(null)
    setSelectedProductIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId]
    )
  }

  function toggleSelectAllCurrentPage() {
    if (currentPageProductIds.length === 0) {
      return
    }

    setBatchMessage(null)
    setSelectedProductIds((current) => {
      const currentSet = new Set(current)
      const shouldUnselect = currentPageProductIds.every((id) => currentSet.has(id))

      if (shouldUnselect) {
        return current.filter((id) => !currentPageProductIds.includes(id))
      }

      return [...new Set([...current, ...currentPageProductIds])]
    })
  }

  async function handleApplyBatchTag() {
    setBatchMessage(null)

    if (selectedProductIds.length === 0 || !batchTagId) {
      return
    }

    await bulkTagMutation.mutateAsync({
      productIds: selectedProductIds,
      action: batchAction,
      tagId: batchTagId
    })
  }

  function openFilterSheet() {
    setDraftCategoryId(categoryId)
    setDraftPlatform(platform)
    setDraftInventoryStatus(inventoryStatus)
    setIsFilterSheetOpen(true)
  }

  function openCreateSheet() {
    setCreateMessage(null)
    setCreateFieldErrors({})
    setIsCreateSheetOpen(true)
  }

  function closeFilterSheet() {
    setActiveMobilePicker(null)
    setIsFilterSheetOpen(false)
  }

  function closeBatchSheet() {
    setActiveMobilePicker(null)
    setIsBatchSheetOpen(false)
  }

  function closeCreateSheet() {
    setActiveMobilePicker(null)
    setIsCreateSheetOpen(false)
  }

  async function handleCreateProductSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreateMessage(null)
    setCreateFieldErrors({})

    await createProductMutation.mutateAsync({
      displayName: createForm.displayName.trim(),
      categoryId: createForm.categoryId,
      platformCodes: [],
      specText: createForm.specText.trim() ? createForm.specText.trim() : null,
      tagIds: [],
      inventoryStatus: createForm.inventoryStatus,
      note: createForm.note.trim() ? createForm.note.trim() : null
    })
  }

  function applyFilterSheet() {
    setCategoryId(draftCategoryId)
    setPlatform(draftPlatform)
    setInventoryStatus(draftInventoryStatus)
    setIsFilterSheetOpen(false)
  }

  function resetFilterSheet() {
    setDraftCategoryId("")
    setDraftPlatform("")
    setDraftInventoryStatus("")
  }

  const activeMobilePickerConfig: {
    title: string
    options: SelectOption[]
    value: string
  } | null = (() => {
    switch (activeMobilePicker) {
      case "filter-category":
        return {
          title: "选择分类",
          options: categorySelectOptions,
          value: draftCategoryId
        }
      case "filter-platform":
        return {
          title: "选择平台",
          options: platformSelectOptions,
          value: draftPlatform
        }
      case "filter-inventory":
        return {
          title: "选择库存状态",
          options: inventoryFilterSelectOptions,
          value: draftInventoryStatus
        }
      case "batch-action":
        return {
          title: "批量操作类型",
          options: batchActionSelectOptions,
          value: batchAction
        }
      case "batch-tag":
        return {
          title: "选择标签",
          options: batchTagSelectOptions,
          value: batchTagId
        }
      case "create-category":
        return {
          title: "选择分类",
          options: createCategorySelectOptions,
          value: createForm.categoryId
        }
      case "create-inventory":
        return {
          title: "选择库存状态",
          options: inventoryCreateSelectOptions,
          value: createForm.inventoryStatus
        }
      default:
        return null
    }
  })()

  function handleMobilePickerSelect(nextValue: string) {
    switch (activeMobilePicker) {
      case "filter-category":
        setDraftCategoryId(nextValue)
        break
      case "filter-platform":
        setDraftPlatform(nextValue)
        break
      case "filter-inventory":
        setDraftInventoryStatus(nextValue)
        break
      case "batch-action":
        setBatchAction(nextValue as "add" | "remove")
        break
      case "batch-tag":
        setBatchTagId(nextValue)
        break
      case "create-category":
        setCreateForm((current) => ({
          ...current,
          categoryId: nextValue
        }))
        break
      case "create-inventory":
        setCreateForm((current) => ({
          ...current,
          inventoryStatus: nextValue as CreateProductRequest["inventoryStatus"]
        }))
        break
      default:
        break
    }

    setActiveMobilePicker(null)
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-[0_20px_70px_rgba(108,91,69,0.08)]">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted)]">
              Product Library
            </div>
            <h2 className="mt-2 font-display text-3xl leading-tight text-[color:var(--foreground)]">
              商品库
            </h2>
            <div className="mt-2 text-sm leading-7 text-[color:var(--muted)]">
              按分类、平台、标签和库存状态浏览统一商品主库。
            </div>
          </div>
          <button
            type="button"
            onClick={openCreateSheet}
            className="hidden items-center justify-center rounded-2xl bg-[color:var(--accent-strong)] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(141,74,18,0.24)] transition hover:opacity-95 md:inline-flex"
          >
            手动新增商品
          </button>
        </div>
        <div className="space-y-3 md:hidden">
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索商品名"
              className="rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
            />
            <button
              type="button"
              onClick={openFilterSheet}
              className="inline-flex items-center justify-center rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm font-semibold text-[color:var(--foreground)]"
            >
              筛选{activeFilterCount > 0 ? ` · 已筛${activeFilterCount}` : ""}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={openCreateSheet}
              className="inline-flex items-center justify-center rounded-2xl bg-[color:var(--accent-strong)] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(141,74,18,0.24)] transition hover:opacity-95"
            >
              手动新增商品
            </button>
            <button
              type="button"
              onClick={() => setIsBatchSheetOpen(true)}
              className="inline-flex items-center justify-center rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm font-semibold text-[color:var(--foreground)]"
            >
              批量操作{selectedProductIds.length > 0 ? ` · 已选${selectedProductIds.length}` : ""}
            </button>
          </div>
          {batchMessage ? (
            <div className="rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-sm text-[color:var(--muted)]">
              {batchMessage}
            </div>
          ) : null}
        </div>
        <div className="hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-4">
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
        <div className="mt-4 hidden rounded-[24px] border border-[color:var(--line)] bg-white/80 p-4 md:block">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <button
              type="button"
              onClick={toggleSelectAllCurrentPage}
              disabled={currentPageProductIds.length === 0}
              className="rounded-2xl border border-[color:var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--foreground)] transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {allCurrentPageSelected ? "取消本页全选" : "全选本页"}
            </button>
            <div className="text-sm text-[color:var(--muted)]">
              已选 {selectedProductIds.length} 项
            </div>
            <select
              value={batchAction}
              onChange={(event) => setBatchAction(event.target.value as "add" | "remove")}
              className="rounded-2xl border border-[color:var(--line)] bg-white px-4 py-2 text-sm outline-none transition focus:border-[color:var(--accent)]"
            >
              <option value="add">批量添加标签</option>
              <option value="remove">批量移除标签</option>
            </select>
            <select
              value={batchTagId}
              onChange={(event) => setBatchTagId(event.target.value)}
              className="rounded-2xl border border-[color:var(--line)] bg-white px-4 py-2 text-sm outline-none transition focus:border-[color:var(--accent)]"
            >
              <option value="">
                {tagsQuery.isLoading ? "加载标签中..." : "选择标签"}
              </option>
              {tagsQuery.data?.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleApplyBatchTag}
              disabled={selectedProductIds.length === 0 || !batchTagId || bulkTagMutation.isPending}
              className="rounded-2xl bg-[color:var(--accent-strong)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {bulkTagMutation.isPending ? "处理中..." : "执行"}
            </button>
            <button
              type="button"
              onClick={() => {
                setBatchMessage(null)
                setSelectedProductIds([])
              }}
              disabled={selectedProductIds.length === 0}
              className="rounded-2xl border border-[color:var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--foreground)] transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              清空选择
            </button>
          </div>
          {batchMessage ? (
            <div className="mt-3 text-sm text-[color:var(--muted)]">{batchMessage}</div>
          ) : null}
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
            <div className="mt-4 space-y-3">
              <button
                type="button"
                onClick={() => setActiveMobilePicker("filter-category")}
                className="flex w-full items-center justify-between rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-left text-sm text-[color:var(--foreground)]"
              >
                <span>
                  {getOptionLabel(categorySelectOptions, draftCategoryId, "全部分类")}
                </span>
                <span className="text-xs text-[color:var(--muted)]">▼</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveMobilePicker("filter-platform")}
                className="flex w-full items-center justify-between rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-left text-sm text-[color:var(--foreground)]"
              >
                <span>
                  {getOptionLabel(platformSelectOptions, draftPlatform, "全部平台")}
                </span>
                <span className="text-xs text-[color:var(--muted)]">▼</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveMobilePicker("filter-inventory")}
                className="flex w-full items-center justify-between rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-left text-sm text-[color:var(--foreground)]"
              >
                <span>
                  {getOptionLabel(
                    inventoryFilterSelectOptions,
                    draftInventoryStatus,
                    "全部库存状态"
                  )}
                </span>
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

      {isBatchSheetOpen ? (
        <div className="fixed inset-0 z-50 h-dvh overflow-hidden md:hidden">
          <button
            type="button"
            aria-label="关闭批量操作弹窗"
            onClick={closeBatchSheet}
            className="absolute inset-0 bg-black/20"
          />
          <section className="absolute inset-x-0 bottom-0 max-h-[52dvh] overflow-y-auto rounded-t-[28px] border border-[color:var(--line)] bg-[rgb(255,251,245)] p-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-[0_-20px_60px_rgba(42,28,17,0.18)]">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl text-[color:var(--foreground)]">批量操作</h3>
              <button
                type="button"
                onClick={closeBatchSheet}
                className="rounded-xl border border-[color:var(--line)] bg-white px-3 py-2 text-sm font-semibold text-[color:var(--foreground)]"
              >
                关闭
              </button>
            </div>
            <div className="mt-4 rounded-[24px] border border-[color:var(--line)] bg-white p-4">
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={toggleSelectAllCurrentPage}
                  disabled={currentPageProductIds.length === 0}
                  className="w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm font-semibold text-[color:var(--foreground)] transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {allCurrentPageSelected ? "取消本页全选" : "全选本页"}
                </button>
                <div className="text-sm text-[color:var(--muted)]">已选 {selectedProductIds.length} 项</div>
                <button
                  type="button"
                  onClick={() => setActiveMobilePicker("batch-action")}
                  className="flex w-full items-center justify-between rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-left text-sm text-[color:var(--foreground)]"
                >
                  <span>
                    {getOptionLabel(batchActionSelectOptions, batchAction, "批量添加标签")}
                  </span>
                  <span className="text-xs text-[color:var(--muted)]">▼</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMobilePicker("batch-tag")}
                  className="flex w-full items-center justify-between rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-left text-sm text-[color:var(--foreground)]"
                >
                  <span>
                    {getOptionLabel(batchTagSelectOptions, batchTagId, "选择标签")}
                  </span>
                  <span className="text-xs text-[color:var(--muted)]">▼</span>
                </button>
                <button
                  type="button"
                  onClick={handleApplyBatchTag}
                  disabled={selectedProductIds.length === 0 || !batchTagId || bulkTagMutation.isPending}
                  className="w-full rounded-2xl bg-[color:var(--accent-strong)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {bulkTagMutation.isPending ? "处理中..." : "执行"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBatchMessage(null)
                    setSelectedProductIds([])
                  }}
                  disabled={selectedProductIds.length === 0}
                  className="w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm font-semibold text-[color:var(--foreground)] transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  清空选择
                </button>
              </div>
              {batchMessage ? (
                <div className="mt-3 text-sm text-[color:var(--muted)]">{batchMessage}</div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {isCreateSheetOpen ? (
        <div className="fixed inset-0 z-50 h-dvh overflow-hidden">
          <button
            type="button"
            aria-label="关闭新增商品弹窗"
            onClick={closeCreateSheet}
            className="absolute inset-0 bg-black/20"
          />
          <section className="absolute inset-x-0 bottom-0 max-h-[72dvh] overflow-y-auto rounded-t-[28px] border border-[color:var(--line)] bg-[rgb(255,251,245)] p-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-[0_-20px_60px_rgba(42,28,17,0.18)]">
            <form className="space-y-4" onSubmit={handleCreateProductSubmit}>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-2xl text-[color:var(--foreground)]">
                  手动新增商品
                </h3>
                <button
                  type="button"
                  onClick={closeCreateSheet}
                  className="rounded-xl border border-[color:var(--line)] bg-white px-3 py-2 text-sm font-semibold text-[color:var(--foreground)]"
                >
                  关闭
                </button>
              </div>

              <div className="space-y-3">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-[color:var(--foreground)]">
                    商品名称
                  </span>
                  <input
                    value={createForm.displayName}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        displayName: event.target.value
                      }))
                    }
                    placeholder="例如：有机贝贝南瓜"
                    className="w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
                  />
                  {createFieldErrors.displayName ? (
                    <div className="text-xs text-red-600">{createFieldErrors.displayName}</div>
                  ) : null}
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-[color:var(--foreground)]">
                      分类
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveMobilePicker("create-category")}
                      className="flex w-full items-center justify-between rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-left text-sm text-[color:var(--foreground)]"
                    >
                      <span>
                        {getOptionLabel(
                          createCategorySelectOptions,
                          createForm.categoryId,
                          "请选择分类"
                        )}
                      </span>
                      <span className="text-xs text-[color:var(--muted)]">▼</span>
                    </button>
                    {createFieldErrors.categoryId ? (
                      <div className="text-xs text-red-600">{createFieldErrors.categoryId}</div>
                    ) : null}
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-[color:var(--foreground)]">
                      库存状态
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveMobilePicker("create-inventory")}
                      className="flex w-full items-center justify-between rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-left text-sm text-[color:var(--foreground)]"
                    >
                      <span>
                        {getOptionLabel(
                          inventoryCreateSelectOptions,
                          createForm.inventoryStatus,
                          "未知"
                        )}
                      </span>
                      <span className="text-xs text-[color:var(--muted)]">▼</span>
                    </button>
                  </label>
                </div>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-[color:var(--foreground)]">
                    规格
                  </span>
                  <input
                    value={createForm.specText}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        specText: event.target.value
                      }))
                    }
                    placeholder="例如：1kg / 6 个装"
                    className="w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-[color:var(--foreground)]">
                    备注
                  </span>
                  <textarea
                    value={createForm.note}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        note: event.target.value
                      }))
                    }
                    rows={4}
                    placeholder="记录口感、适合的做法、避雷点或复购判断。"
                    className="w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm leading-7 outline-none transition focus:border-[color:var(--accent)]"
                  />
                </label>
              </div>

              {createMessage ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {createMessage}
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={closeCreateSheet}
                  className="rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm font-semibold text-[color:var(--foreground)]"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={createProductMutation.isPending}
                  className="rounded-2xl bg-[color:var(--accent-strong)] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {createProductMutation.isPending ? "保存中..." : "保存商品"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {activeMobilePicker && activeMobilePickerConfig ? (
        <div className="fixed inset-0 z-[60] h-dvh overflow-hidden md:hidden">
          <button
            type="button"
            aria-label="关闭选项弹窗"
            onClick={() => setActiveMobilePicker(null)}
            className="absolute inset-0 bg-black/25"
          />
          <section className="absolute inset-x-0 bottom-0 max-h-[52dvh] overflow-y-auto rounded-t-[28px] border border-[color:var(--line)] bg-[rgb(255,251,245)] p-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-[0_-20px_60px_rgba(42,28,17,0.18)]">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl text-[color:var(--foreground)]">
                {activeMobilePickerConfig.title}
              </h3>
              <button
                type="button"
                onClick={() => setActiveMobilePicker(null)}
                className="rounded-xl border border-[color:var(--line)] bg-white px-3 py-2 text-sm font-semibold text-[color:var(--foreground)]"
              >
                关闭
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {activeMobilePickerConfig.options.map((item) => {
                const selected = item.value === activeMobilePickerConfig.value

                return (
                  <button
                    key={`${activeMobilePicker}-${item.value || "empty"}`}
                    type="button"
                    onClick={() => handleMobilePickerSelect(item.value)}
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
              <article
                key={product.id}
                className="rounded-[28px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-[0_20px_70px_rgba(108,91,69,0.08)] transition hover:-translate-y-0.5 hover:bg-white"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedProductIdSet.has(product.id)}
                      onChange={() => toggleProductSelection(product.id)}
                      className="mt-1 h-4 w-4 rounded border-[color:var(--line)] text-[color:var(--accent-strong)] focus:ring-[color:var(--accent)]"
                    />
                    <div>
                      <h3 className="text-lg font-semibold text-[color:var(--foreground)]">
                        {product.displayName}
                      </h3>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {product.tags.length > 0 ? (
                    product.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--accent-strong)]"
                      >
                        {tag.name}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-500">
                      暂无标签
                    </span>
                  )}
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-sm text-[color:var(--muted)]">{product.category.name}</p>
                  <InventoryStatusBadge status={product.inventoryStatus} />
                </div>
              </article>
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

"use client"

import type {
  CategoryDto,
  ConfirmImportSessionRequest,
  ConfirmImportSessionResponse,
  GetProductsResponse,
  ImportSessionDetailDto,
  PlatformDto,
  UpdateImportItemDraftRequest
} from "@life-assistant/contracts"
import { useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { QueryState } from "@/src/components/ui/query-state"
import { useAuthedMutation } from "@/src/hooks/use-authed-mutation"
import { useAuthedQuery } from "@/src/hooks/use-authed-query"
import { apiFetch } from "@/src/lib/api-client"
import {
  getFormErrorMessage,
  getFormFieldErrors,
  parseCurrencyInputToCent,
  toCurrencyInput,
  toDatetimeLocalValue
} from "@/src/lib/form-helpers"
import { formatCurrencyFromCent, formatDatetime } from "@/src/lib/formatters"

type DraftFormState = {
  priceAmount: string
  quantity: string
  specText: string
  weightGrams: string
  decision: "pending" | "existing" | "new"
  selectedProductId: string
  manualDisplayName: string
  manualCategoryId: string
  manualNote: string
}

const inputClassName =
  "w-full rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"

const textareaClassName =
  "w-full rounded-3xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-sm leading-7 outline-none transition focus:border-[color:var(--accent)]"

function toDraftFormState(draft: ImportSessionDetailDto["itemDrafts"][number]): DraftFormState {
  return {
    priceAmount: toCurrencyInput(draft.priceAmount),
    quantity: draft.quantity ?? "",
    specText: draft.specText ?? "",
    weightGrams: draft.weightGrams?.toString() ?? "",
    decision: draft.selectedProductId
      ? "existing"
      : draft.createNewProduct
        ? "new"
        : "pending",
    selectedProductId: draft.selectedProductId ?? "",
    manualDisplayName: draft.manualDisplayName ?? "",
    manualCategoryId: draft.manualCategoryId ?? "",
    manualNote: draft.manualNote ?? ""
  }
}

function areDraftFormsEqual(left: DraftFormState, right: DraftFormState) {
  return (
    left.priceAmount === right.priceAmount &&
    left.quantity === right.quantity &&
    left.specText === right.specText &&
    left.weightGrams === right.weightGrams &&
    left.decision === right.decision &&
    left.selectedProductId === right.selectedProductId &&
    left.manualDisplayName === right.manualDisplayName &&
    left.manualCategoryId === right.manualCategoryId &&
    left.manualNote === right.manualNote
  )
}

function toDraftUpdateBody(form: DraftFormState): UpdateImportItemDraftRequest {
  const body: UpdateImportItemDraftRequest = {
    createNewProduct: form.decision === "new",
    selectedProductId: form.decision === "existing" ? form.selectedProductId || null : null,
    manualDisplayName: form.decision === "new" ? form.manualDisplayName.trim() || null : null,
    manualCategoryId: form.decision === "new" ? form.manualCategoryId || null : null,
    manualNote: form.decision === "new" ? form.manualNote.trim() || null : null,
    specText: form.specText.trim() || null
  }

  const priceAmount = parseCurrencyInputToCent(form.priceAmount)
  const trimmedWeightGrams = form.weightGrams.trim()
  const parsedWeightGrams = trimmedWeightGrams
    ? Number.parseInt(trimmedWeightGrams, 10)
    : Number.NaN

  if (priceAmount != null) {
    body.priceAmount = priceAmount
  }

  if (form.quantity.trim()) {
    body.quantity = form.quantity.trim()
  }

  body.weightGrams = Number.isFinite(parsedWeightGrams) ? parsedWeightGrams : null

  return body
}

function isDraftFormCommitReady(form: DraftFormState) {
  const hasPrice = parseCurrencyInputToCent(form.priceAmount) != null
  const hasQuantity = form.quantity.trim().length > 0

  return hasPrice && hasQuantity
}

function hasDraftResolutionDecision(form: DraftFormState) {
  if (form.decision === "existing") {
    return Boolean(form.selectedProductId)
  }

  if (form.decision === "new") {
    return Boolean(form.manualDisplayName.trim() && form.manualCategoryId)
  }

  return false
}

export function ImportSessionScreen({
  importSessionId,
  localImagePreviewUrls = []
}: {
  importSessionId: string
  localImagePreviewUrls?: string[]
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformDto["code"] | "">("")
  const [selectedOrderedAt, setSelectedOrderedAt] = useState("")
  const [note, setNote] = useState("")
  const [draftForms, setDraftForms] = useState<Record<string, DraftFormState>>({})
  const [sessionMessage, setSessionMessage] = useState<string | null>(null)
  const [commitMessage, setCommitMessage] = useState<string | null>(null)
  const [hasRequestedAutoAnalyze, setHasRequestedAutoAnalyze] = useState(false)
  const [isPreparingCommit, setIsPreparingCommit] = useState(false)

  const importSessionQuery = useAuthedQuery<ImportSessionDetailDto>({
    queryKey: ["import-session", importSessionId],
    queryFn: (accessToken) =>
      apiFetch(`/api/import-sessions/${importSessionId}`, {
        accessToken
      }),
    refetchInterval: (query) =>
      query.state.data &&
      (query.state.data.isAnalyzing ||
        query.state.data.isPreparingCommit ||
        query.state.data.status === "PROCESSING")
        ? 3000
        : false
  })

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

  const productsQuery = useAuthedQuery<GetProductsResponse>({
    queryKey: ["import-session", importSessionId, "products"],
    queryFn: (accessToken) =>
      apiFetch("/api/products?page=1&pageSize=100&sort=recent_purchased", {
        accessToken
      })
  })

  useEffect(() => {
    if (!importSessionQuery.data) {
      return
    }

    setSelectedPlatform(importSessionQuery.data.selectedPlatform?.code ?? "")
    setSelectedOrderedAt(toDatetimeLocalValue(importSessionQuery.data.selectedOrderedAt))
    setNote(importSessionQuery.data.note ?? "")
    setDraftForms(
      Object.fromEntries(
        importSessionQuery.data.itemDrafts.map((draft) => [draft.id, toDraftFormState(draft)])
      )
    )
  }, [importSessionQuery.data?.id, importSessionQuery.data])

  const reanalyzeMutation = useAuthedMutation<
    { importSessionId: string; status: string },
    { forceReanalyze?: boolean } | void
  >({
    mutationFn: (accessToken, body) =>
      apiFetch(`/api/import-sessions/${importSessionId}/analyze`, {
        method: "POST",
        accessToken,
        body: {
          forceReanalyze: body && "forceReanalyze" in body ? body.forceReanalyze : undefined
        }
      }),
    onSuccess: (data) => {
      setSessionMessage(
        data.status === "PROCESSING"
          ? "解析已开始，后台正在整理订单信息和商品内容。"
          : "解析已完成，请确认订单内容。"
      )
      void queryClient.invalidateQueries({ queryKey: ["import-session", importSessionId] })
    },
    onError: (error) => {
      setSessionMessage(getFormErrorMessage(error))
    }
  })

  const confirmMutation = useAuthedMutation<
    ConfirmImportSessionResponse,
    ConfirmImportSessionRequest
  >({
    mutationFn: (accessToken, body) =>
      apiFetch(`/api/import-sessions/${importSessionId}/confirm`, {
        method: "POST",
        accessToken,
        body
      }),
    onSuccess: (data) => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["import-session", importSessionId] }),
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      ])

      router.replace(`/orders/${data.orderId}`)
    },
    onError: (error) => {
      const fieldErrors = Object.values(getFormFieldErrors(error))

      setCommitMessage(
        fieldErrors.length > 0
          ? `还不能导入：${fieldErrors.slice(0, 3).join("；")}`
          : getFormErrorMessage(error)
      )
    }
  })

  const sessionData = importSessionQuery.data ?? null

  useEffect(() => {
    if (
      !sessionData ||
      hasRequestedAutoAnalyze ||
      reanalyzeMutation.isPending ||
      sessionData.isAnalyzing ||
      sessionData.status !== "DRAFT" ||
      sessionData.images.length === 0 ||
      sessionData.itemDrafts.length > 0
    ) {
      return
    }

    setHasRequestedAutoAnalyze(true)
    setSessionMessage("截图已上传，正在解析订单内容。没有视觉模型时会自动回退到手动确认模式。")
    reanalyzeMutation.mutate({ forceReanalyze: false })
  }, [
    hasRequestedAutoAnalyze,
    reanalyzeMutation,
    sessionData
  ])

  if (importSessionQuery.isLoading && !importSessionQuery.data) {
    return (
      <div className="space-y-4">
        <section className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-[0_24px_80px_rgba(108,91,69,0.08)]">
          <h3 className="font-display text-3xl text-[color:var(--foreground)]">导入订单</h3>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-[color:var(--muted)]">
            当前版本会先创建导入会话、上传截图，并在上传完成后立刻启动后台分析。填好火山方舟的
            ARK_API_KEY 和 ARK_VISION_MODEL 后会走多模态识别；没配齐时会自动回退到手动确认模式，不会阻塞你继续导入。
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled
              className="rounded-2xl border border-[color:var(--line)] bg-white/75 px-4 py-3 text-sm font-semibold text-[color:var(--foreground)] opacity-60"
            >
              截图分析中
            </button>
            <button
              type="button"
              disabled
              className="rounded-2xl bg-[color:var(--accent-strong)] px-5 py-3 text-sm font-semibold text-white opacity-60"
            >
              截图分析中
            </button>
          </div>
          <div className="mt-4 rounded-[24px] border border-[color:var(--line)] bg-white/80 px-4 py-3 text-sm text-[color:var(--muted)]">
            当前阶段：截图分析中
          </div>
        </section>

        {localImagePreviewUrls.length > 0 ? (
          <section className="rounded-[32px] border border-[color:var(--line)] bg-white/75 p-6 shadow-[0_24px_80px_rgba(108,91,69,0.08)]">
            <h4 className="font-display text-2xl text-[color:var(--foreground)]">当前截图</h4>
            <div className="mt-4 space-y-3">
              {localImagePreviewUrls.map((imageUrl, index) => (
                <div
                  key={`${imageUrl}-${index}`}
                  className="rounded-[24px] border border-[color:var(--line)] bg-white/80 p-4"
                >
                  <div className="mb-3 text-sm font-semibold text-[color:var(--foreground)]">
                    第 {index + 1} 页
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={`导入截图 ${index + 1}`}
                    src={imageUrl}
                    className="w-full rounded-2xl border border-[color:var(--line)] object-cover"
                  />
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    )
  }

  if (importSessionQuery.error || !importSessionQuery.data) {
    return (
      <QueryState
        title="导入订单加载失败"
        description={
          importSessionQuery.error instanceof Error
            ? importSessionQuery.error.message
            : "请稍后重试。"
        }
      />
    )
  }

  const session = importSessionQuery.data
  const imagePreviewItems =
    session.images.length > 0
      ? session.images.map((image) => ({
          key: image.id,
          pageIndex: image.pageIndex,
          imageUrl: image.imageUrl
        }))
      : localImagePreviewUrls.map((imageUrl, index) => ({
          key: `local-${index}`,
          pageIndex: index,
          imageUrl
        }))
  const showParsedOrderSection =
    session.committedOrderId != null ||
    session.status === "READY_TO_COMMIT" ||
    session.status === "COMMITTED" ||
    session.status === "FAILED" ||
    session.isPreparingCommit ||
    session.itemDrafts.length > 0
  const loadingError = platformsQuery.error ?? categoriesQuery.error
  const platforms = platformsQuery.data ?? []
  const categories = categoriesQuery.data ?? []

  const hasUnsavedSessionChanges =
    selectedPlatform !== (session.selectedPlatform?.code ?? "") ||
    selectedOrderedAt !== toDatetimeLocalValue(session.selectedOrderedAt) ||
    note !== (session.note ?? "")
  const hasUnsavedDraftChanges = session.itemDrafts.some((draft) => {
    const form = draftForms[draft.id]

    if (!form) {
      return false
    }

    return !areDraftFormsEqual(form, toDraftFormState(draft))
  })
  const missingCoreDraftCount = session.itemDrafts.filter((draft) => {
    const form = draftForms[draft.id]

    if (!form) {
      return true
    }

    return !isDraftFormCommitReady(form)
  }).length
  const unresolvedDraftCount = session.itemDrafts.filter((draft) => {
    const form = draftForms[draft.id]

    if (!form) {
      return true
    }

    return !hasDraftResolutionDecision(form)
  }).length
  const hardCommitBlockers = [
    ...(!showParsedOrderSection ? ["截图分析中，请稍后确认"] : []),
    ...(showParsedOrderSection && (reanalyzeMutation.isPending || session.isAnalyzing)
      ? ["订单解析尚未完成，请稍等"]
      : []),
    ...(session.isPreparingCommit ? ["系统正在准备可导入订单，请稍等"] : []),
    ...(selectedPlatform ? [] : ["请选择并保存订单平台"]),
    ...(selectedOrderedAt ? [] : ["请选择并保存下单时间"]),
    ...(missingCoreDraftCount > 0
      ? [`还有 ${missingCoreDraftCount} 个商品项未补齐价格或数量`]
      : [])
  ]
  const willAutoSaveBeforeCommit = hasUnsavedSessionChanges || hasUnsavedDraftChanges
  const canCommit =
    session.status !== "COMMITTED" &&
    !isPreparingCommit &&
    !confirmMutation.isPending &&
    hardCommitBlockers.length === 0
  const commitButtonLabel =
    !showParsedOrderSection
      ? "截图分析中"
      : isPreparingCommit || confirmMutation.isPending
      ? "订单导入中"
      : session.isAnalyzing
        ? "正在解析订单..."
        : session.isPreparingCommit
          ? "订单导入中"
          : canCommit
            ? "确认订单"
            : "先补齐订单信息"
  const orderStatusSummary = session.isAnalyzing
    ? "正在解析订单"
    : session.isPreparingCommit
      ? "订单导入中"
      : session.status === "READY_TO_COMMIT"
        ? "待确认"
        : "还需补齐订单信息"
  const topActionSecondaryLabel = !showParsedOrderSection
    ? "截图分析中"
    : reanalyzeMutation.isPending
      ? "重跑中..."
      : "重新分析"
  const topActionStageLabel = !showParsedOrderSection
    ? "截图分析中"
    : isPreparingCommit || confirmMutation.isPending || session.isPreparingCommit
      ? "订单导入中"
      : session.status === "COMMITTED"
        ? "订单导入完成"
        : canCommit
          ? "待确认导入"
          : "待补齐订单信息"

  function updateDraftForm(
    draftId: string,
    updater: (current: DraftFormState) => DraftFormState
  ) {
    setDraftForms((current) => ({
      ...current,
      [draftId]: updater(current[draftId])
    }))
  }

  function getChangedDraftPayload() {
    return session.itemDrafts
      .flatMap((draft) => {
        const form = draftForms[draft.id]

        if (!form || areDraftFormsEqual(form, toDraftFormState(draft))) {
          return []
        }

        return [
          {
            id: draft.id,
            body: toDraftUpdateBody(form)
          }
        ]
      })
  }

  async function handleCommit() {
    setCommitMessage(null)

    if (hardCommitBlockers.length > 0) {
      setCommitMessage(`还不能导入：${hardCommitBlockers.join("；")}`)
      return
    }

    setIsPreparingCommit(true)

    try {
      const draftUpdates = getChangedDraftPayload()

      await confirmMutation.mutateAsync({
        ...(hasUnsavedSessionChanges
          ? {
              selectedPlatform: selectedPlatform || undefined,
              selectedOrderedAt: selectedOrderedAt
                ? new Date(selectedOrderedAt).toISOString()
                : undefined,
              note: note.trim() ? note.trim() : null
            }
          : {}),
        ...(draftUpdates.length > 0 ? { drafts: draftUpdates } : {}),
        markImportedProductsInStock: true
      })
    } catch (error) {
      if (!confirmMutation.isPending) {
        setCommitMessage(getFormErrorMessage(error))
      }
    } finally {
      setIsPreparingCommit(false)
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-[0_24px_80px_rgba(108,91,69,0.08)]">
        <h3 className="font-display text-3xl text-[color:var(--foreground)]">导入订单</h3>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[color:var(--muted)]">
          当前版本会先创建导入会话、上传截图，并在上传完成后立刻启动后台分析。填好火山方舟的
          ARK_API_KEY 和 ARK_VISION_MODEL 后会走多模态识别；没配齐时会自动回退到手动确认模式，不会阻塞你继续导入。
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => reanalyzeMutation.mutate({ forceReanalyze: true })}
            disabled={!showParsedOrderSection || reanalyzeMutation.isPending || session.status === "COMMITTED"}
            className="rounded-2xl border border-[color:var(--line)] bg-white/75 px-4 py-3 text-sm font-semibold text-[color:var(--foreground)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {topActionSecondaryLabel}
          </button>
          <button
            type="button"
            onClick={handleCommit}
            disabled={!canCommit}
            className="rounded-2xl bg-[color:var(--accent-strong)] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(141,74,18,0.24)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {commitButtonLabel}
          </button>
        </div>
        <div className="mt-4 rounded-[24px] border border-[color:var(--line)] bg-white/80 px-4 py-3 text-sm text-[color:var(--muted)]">
          当前阶段：{topActionStageLabel}
        </div>
      </section>

      <section className="rounded-[32px] border border-[color:var(--line)] bg-white/75 p-6 shadow-[0_24px_80px_rgba(108,91,69,0.08)]">
        <h4 className="font-display text-2xl text-[color:var(--foreground)]">当前截图</h4>
        {imagePreviewItems.length > 0 ? (
          <div className="mt-4 space-y-3">
            {imagePreviewItems.map((image) => (
              <div
                key={image.key}
                className="rounded-[24px] border border-[color:var(--line)] bg-white/80 p-4"
              >
                <div className="mb-3 text-sm font-semibold text-[color:var(--foreground)]">
                  第 {image.pageIndex + 1} 页
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={`导入截图 ${image.pageIndex + 1}`}
                  src={image.imageUrl}
                  className="w-full rounded-2xl border border-[color:var(--line)] object-cover"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-[24px] border border-[color:var(--line)] bg-white/80 px-4 py-3 text-sm text-[color:var(--muted)]">
            还没有可展示的截图，请重新上传。
          </div>
        )}
        {sessionMessage ? (
          <div className="mt-4 rounded-[24px] border border-[color:var(--line)] bg-white/80 px-4 py-3 text-sm text-[color:var(--muted)]">
            {sessionMessage}
          </div>
        ) : null}
        {session.status === "FAILED" && session.errorMessage ? (
          <div className="mt-4 rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            分析失败：{session.errorMessage}
          </div>
        ) : null}
      </section>

      {showParsedOrderSection ? (
        <>
          <section className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-[0_24px_80px_rgba(108,91,69,0.08)]">
            <h4 className="mb-4 font-display text-2xl text-[color:var(--foreground)]">订单信息</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-[color:var(--foreground)]">平台</span>
                <select
                  value={selectedPlatform}
                  onChange={(event) =>
                    setSelectedPlatform(event.target.value as PlatformDto["code"] | "")
                  }
                  className={inputClassName}
                >
                  <option value="">请选择平台</option>
                  {platforms.map((platform) => (
                    <option key={platform.code} value={platform.code}>
                      {platform.label}
                    </option>
                  ))}
                </select>
                {session.platformGuess ? (
                  <div className="text-xs text-[color:var(--muted)]">
                    当前猜测：{session.platformGuess.label}
                  </div>
                ) : null}
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-[color:var(--foreground)]">
                  下单时间
                </span>
                <input
                  type="datetime-local"
                  value={selectedOrderedAt}
                  onChange={(event) => setSelectedOrderedAt(event.target.value)}
                  className={inputClassName}
                />
                {session.orderedAtGuess ? (
                  <div className="text-xs text-[color:var(--muted)]">
                    当前猜测：{formatDatetime(session.orderedAtGuess)}
                  </div>
                ) : null}
              </label>
            </div>
            <label className="mt-4 block space-y-2">
              <span className="text-sm font-semibold text-[color:var(--foreground)]">备注</span>
              <textarea
                rows={4}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className={textareaClassName}
                placeholder="补充这次订单的上下文，例如是否有赠品、是否分批送达。"
              />
            </label>
            {platformsQuery.isLoading || categoriesQuery.isLoading ? (
              <div className="mt-4 rounded-[24px] border border-[color:var(--line)] bg-white/80 px-4 py-3 text-sm text-[color:var(--muted)]">
                正在加载平台和分类选项...
              </div>
            ) : null}
            {loadingError ? (
              <div className="mt-4 rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                平台或分类加载失败：{loadingError instanceof Error ? loadingError.message : "请稍后刷新重试。"}
              </div>
            ) : null}
            {session.isPreparingCommit ? (
              <div className="mt-4 rounded-[24px] border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                订单解析已经完成，系统正在后台准备导入。你可以继续调整订单信息和商品内容。
              </div>
            ) : null}
            {session.itemDrafts.length > 0 && unresolvedDraftCount > 0 ? (
              <div className="mt-4 rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                还有 {unresolvedDraftCount} 个商品暂时没决定归到哪个商品主档，但这不会阻塞先生成订单。
              </div>
            ) : null}
          </section>

          <section className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-[0_24px_80px_rgba(108,91,69,0.08)]">
            <h4 className="font-display text-2xl text-[color:var(--foreground)]">商品内容</h4>
            <div className="mt-4 space-y-4">
              {session.itemDrafts.length > 0 ? (
                session.itemDrafts.map((draft) => {
                  const form = draftForms[draft.id]

                  if (!form) {
                    return null
                  }

                  const productOptions = [
                    ...draft.candidateProducts.map((product) => ({
                      id: product.id,
                      label: `${product.displayName} · ${product.category.name}`
                    })),
                    ...(productsQuery.data?.items ?? [])
                      .filter(
                        (product) =>
                          !draft.candidateProducts.some((candidate) => candidate.id === product.id)
                      )
                      .map((product) => ({
                        id: product.id,
                        label: `${product.displayName} · ${product.category.name}`
                      }))
                  ]

                  return (
                    <div
                      key={draft.id}
                      className="rounded-[24px] border border-[color:var(--line)] bg-white/80 p-4"
                    >
                      <div className="flex flex-col gap-3">
                        <div>
                          <div className="text-base font-semibold text-[color:var(--foreground)]">
                            {draft.rawName}
                          </div>
                          <div className="mt-1 text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
                            {draft.pageIndex != null
                              ? `第 ${draft.pageIndex + 1} 页`
                              : "页码未识别"}{" "}
                            · {draft.reviewStatus}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <label className="space-y-2">
                          <span className="text-sm font-semibold text-[color:var(--foreground)]">
                            成交价
                          </span>
                          <input
                            value={form.priceAmount}
                            onChange={(event) =>
                              updateDraftForm(draft.id, (current) => ({
                                ...current,
                                priceAmount: event.target.value
                              }))
                            }
                            placeholder="例如 39.90"
                            className={inputClassName}
                          />
                        </label>

                        <label className="space-y-2">
                          <span className="text-sm font-semibold text-[color:var(--foreground)]">
                            数量
                          </span>
                          <input
                            value={form.quantity}
                            onChange={(event) =>
                              updateDraftForm(draft.id, (current) => ({
                                ...current,
                                quantity: event.target.value
                              }))
                            }
                            placeholder="例如 2 或 1.5"
                            className={inputClassName}
                          />
                        </label>

                        <label className="space-y-2">
                          <span className="text-sm font-semibold text-[color:var(--foreground)]">
                            规格
                          </span>
                          <input
                            value={form.specText}
                            onChange={(event) =>
                              updateDraftForm(draft.id, (current) => ({
                                ...current,
                                specText: event.target.value
                              }))
                            }
                            placeholder="例如 500g / 2 袋装"
                            className={inputClassName}
                          />
                        </label>

                        <label className="space-y-2">
                          <span className="text-sm font-semibold text-[color:var(--foreground)]">
                            单件重量(g)
                          </span>
                          <input
                            value={form.weightGrams}
                            onChange={(event) =>
                              updateDraftForm(draft.id, (current) => ({
                                ...current,
                                weightGrams: event.target.value
                              }))
                            }
                            placeholder="例如 500"
                            className={inputClassName}
                          />
                        </label>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-3">
                        <label className="space-y-2">
                          <span className="text-sm font-semibold text-[color:var(--foreground)]">
                            商品归档
                          </span>
                          <select
                            value={form.decision}
                            onChange={(event) =>
                              updateDraftForm(draft.id, (current) => ({
                                ...current,
                                decision: event.target.value as DraftFormState["decision"]
                              }))
                            }
                            className={inputClassName}
                          >
                            <option value="pending">导入后再说</option>
                            <option value="existing">关联已有商品</option>
                            <option value="new">新建商品</option>
                          </select>
                          <div className="text-xs text-[color:var(--muted)]">
                            这是可选增强。先生成订单时，系统会保留这条原始商品行。
                          </div>
                        </label>

                        {form.decision === "existing" ? (
                          <label className="space-y-2 md:col-span-2">
                            <span className="text-sm font-semibold text-[color:var(--foreground)]">
                              选择商品
                            </span>
                            <select
                              value={form.selectedProductId}
                              onChange={(event) =>
                                updateDraftForm(draft.id, (current) => ({
                                  ...current,
                                  selectedProductId: event.target.value
                                }))
                              }
                              className={inputClassName}
                            >
                              <option value="">请选择商品</option>
                              {productOptions.map((product) => (
                                <option key={product.id} value={product.id}>
                                  {product.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : null}
                      </div>

                      {form.decision === "new" ? (
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <label className="space-y-2">
                            <span className="text-sm font-semibold text-[color:var(--foreground)]">
                              新商品名称
                            </span>
                            <input
                              value={form.manualDisplayName}
                              onChange={(event) =>
                                updateDraftForm(draft.id, (current) => ({
                                  ...current,
                                  manualDisplayName: event.target.value
                                }))
                              }
                              className={inputClassName}
                            />
                          </label>

                          <label className="space-y-2">
                            <span className="text-sm font-semibold text-[color:var(--foreground)]">
                              分类
                            </span>
                            <select
                              value={form.manualCategoryId}
                              onChange={(event) =>
                                updateDraftForm(draft.id, (current) => ({
                                  ...current,
                                  manualCategoryId: event.target.value
                                }))
                              }
                              className={inputClassName}
                            >
                              <option value="">请选择分类</option>
                              {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                  {category.name}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="space-y-2 md:col-span-2">
                            <span className="text-sm font-semibold text-[color:var(--foreground)]">
                              商品备注
                            </span>
                            <textarea
                              rows={3}
                              value={form.manualNote}
                              onChange={(event) =>
                                updateDraftForm(draft.id, (current) => ({
                                  ...current,
                                  manualNote: event.target.value
                                }))
                              }
                              className={textareaClassName}
                            />
                          </label>
                        </div>
                      ) : null}

                      <div className="mt-4 text-xs leading-6 text-[color:var(--muted)]">
                        {draft.candidateProducts.length > 0
                          ? `当前给出了 ${draft.candidateProducts.length} 个候选商品。`
                          : "当前没有候选商品，后续可以再手工决定是否新建。"}
                        {draft.pricePer100g != null
                          ? ` 已识别每 100g 价格：${formatCurrencyFromCent(draft.pricePer100g)}。`
                          : ""}
                      </div>
                    </div>
                  )
                })
              ) : (
                <QueryState
                  title={session.isAnalyzing ? "正在解析订单" : "还没有识别到商品内容"}
                  description={
                    session.isAnalyzing
                      ? "后台正在识别平台、时间和商品项，结果会自动刷新到这里。"
                      : "可以重新解析一次；没有视觉模型 key 时会进入手动确认模式。"
                  }
                />
              )}
            </div>
          </section>
        </>
      ) : null}

      {showParsedOrderSection ? (
        <section className="rounded-[32px] border border-[color:var(--line)] bg-white/75 p-6 shadow-[0_24px_80px_rgba(108,91,69,0.08)]">
          <h4 className="font-display text-2xl text-[color:var(--foreground)]">确认摘要</h4>
          <div className="mt-4 space-y-2 text-sm leading-7 text-[color:var(--muted)]">
            <div>- 平台已确认：{selectedPlatform ? "是" : "否"}</div>
            <div>- 下单时间已确认：{selectedOrderedAt ? "是" : "否"}</div>
            <div>- 订单状态：{orderStatusSummary}</div>
            <div>- 已识别商品项：{session.itemDrafts.length} 项</div>
            <div>- 未决定商品归档：{unresolvedDraftCount} 项</div>
            <div>- 有待导入前修改：{willAutoSaveBeforeCommit ? "是，确认时会自动保存" : "否"}</div>
            {hardCommitBlockers.length > 0 ? (
              <div className="pt-2 text-rose-600">- 当前阻塞：{hardCommitBlockers.join("；")}</div>
            ) : null}
          </div>
          {commitMessage ? (
            <div className="mt-4 rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {commitMessage}
            </div>
          ) : null}
          {session.committedOrderId ? (
            <Link
              href={`/orders/${session.committedOrderId}`}
              className="mt-4 inline-flex text-sm font-semibold text-[color:var(--accent-strong)]"
            >
              查看已导入订单 →
            </Link>
          ) : null}
        </section>
      ) : null}

      {session.committedOrderId ? (
        <section className="rounded-[32px] border border-emerald-200 bg-emerald-50 p-6 shadow-[0_24px_80px_rgba(45,107,78,0.08)]">
          <h4 className="font-display text-2xl text-emerald-800">订单导入完成</h4>
          <div className="mt-3 text-sm leading-7 text-emerald-700">
            这次导入已经生成正式订单。截图复制和商品归档会继续在后台整理，不影响查看订单。
          </div>
          <Link
            href={`/orders/${session.committedOrderId}`}
            className="mt-4 inline-flex rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white"
          >
            查看订单
          </Link>
        </section>
      ) : null}
    </div>
  )
}

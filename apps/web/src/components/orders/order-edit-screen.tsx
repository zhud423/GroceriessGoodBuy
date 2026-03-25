"use client"

import type { MutateOrderResponse, OrderDetailDto } from "@life-assistant/contracts"
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
  getFormFieldErrors,
  toDatetimeLocalValue,
  toIsoDatetimeString
} from "@/src/lib/form-helpers"

type OrderEditFormState = {
  orderedAt: string
  note: string
}

const inputClassName =
  "w-full rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"

const textareaClassName =
  "w-full rounded-3xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-sm leading-7 outline-none transition focus:border-[color:var(--accent)]"

export function OrderEditScreen({ orderId }: { orderId: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const didHydrateRef = useRef(false)
  const [form, setForm] = useState<OrderEditFormState>({
    orderedAt: "",
    note: ""
  })
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const orderQuery = useAuthedQuery<OrderDetailDto>({
    queryKey: ["order-detail", orderId],
    queryFn: (accessToken) =>
      apiFetch(`/api/orders/${orderId}`, {
        accessToken
      })
  })

  useEffect(() => {
    if (!orderQuery.data || didHydrateRef.current) {
      return
    }

    didHydrateRef.current = true
    setForm({
      orderedAt: toDatetimeLocalValue(orderQuery.data.orderedAt),
      note: orderQuery.data.note ?? ""
    })
  }, [orderQuery.data])

  const saveOrderMutation = useAuthedMutation<MutateOrderResponse, OrderEditFormState>({
    mutationFn: (accessToken, nextForm) =>
      apiFetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        accessToken,
        body: {
          orderedAt: toIsoDatetimeString(nextForm.orderedAt),
          note: nextForm.note.trim() ? nextForm.note.trim() : null
        }
      }),
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["order-detail", data.orderId] }),
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

  if (orderQuery.isLoading) {
    return <QueryState title="正在加载订单表单" description="正在读取订单基础信息。" />
  }

  if (orderQuery.error || !orderQuery.data) {
    return (
      <QueryState
        title="订单表单加载失败"
        description={orderQuery.error instanceof Error ? orderQuery.error.message : "请稍后重试。"}
      />
    )
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
              编辑订单
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-[color:var(--muted)]">
              当前版本只开放订单级字段维护。商品项属于已经沉淀下来的订单事实，不在这里直接改。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/orders/${orderId}`}
              className="rounded-2xl border border-[color:var(--line)] bg-white/75 px-4 py-3 text-sm font-semibold text-[color:var(--foreground)] transition hover:bg-white"
            >
              返回
            </Link>
            <button
              type="submit"
              disabled={saveOrderMutation.isPending}
              className="rounded-2xl bg-[color:var(--accent-strong)] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(141,74,18,0.24)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saveOrderMutation.isPending ? "保存中..." : "保存修改"}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-[0_24px_80px_rgba(108,91,69,0.08)]">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[24px] border border-[color:var(--line)] bg-white/80 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                平台
              </div>
              <div className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">
                {orderQuery.data.platform.label}
              </div>
              <div className="mt-2 text-xs leading-6 text-[color:var(--muted)]">
                平台来源与价格历史会影响商品聚合，这一版不直接改。
              </div>
            </div>

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
                rows={5}
                placeholder="补充这次采购的上下文，例如活动、凑单或配送问题。"
                className={textareaClassName}
              />
            </label>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[32px] border border-[color:var(--line)] bg-white/75 p-6 shadow-[0_24px_80px_rgba(108,91,69,0.08)]">
            <h4 className="font-display text-2xl text-[color:var(--foreground)]">
              编辑边界
            </h4>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-[color:var(--muted)]">
              <li>这里允许改时间和备注，因为它们不改变商品项事实本身。</li>
              <li>商品项的价格、数量、关联商品仍以导入或手动建单时的记录为准。</li>
              <li>如果后续需要修正商品项，应该走专门的订单重整能力，而不是在详情页临时改字段。</li>
            </ul>
            {submitError ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {submitError}
              </div>
            ) : null}
          </div>

          <div className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-[0_24px_80px_rgba(108,91,69,0.08)]">
            <h4 className="font-display text-2xl text-[color:var(--foreground)]">
              当前商品项
            </h4>
            <div className="mt-4 space-y-3">
              {orderQuery.data.items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[24px] border border-[color:var(--line)] bg-white/80 p-4"
                >
                  <div className="text-sm font-semibold text-[color:var(--foreground)]">
                    {item.product?.displayName ?? item.rawName}
                  </div>
                  <div className="mt-1 text-xs text-[color:var(--muted)]">
                    {item.product ? item.rawName : "暂未关联商品主档"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </form>
  )
}

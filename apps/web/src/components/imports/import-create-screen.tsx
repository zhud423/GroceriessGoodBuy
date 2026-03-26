"use client"

import type {
  CreateImportSessionResponse,
  UploadImportImagesResponse
} from "@life-assistant/contracts"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { useAuthedMutation } from "@/src/hooks/use-authed-mutation"
import { apiFetch } from "@/src/lib/api-client"
import { getFormErrorMessage } from "@/src/lib/form-helpers"

const inputClassName =
  "w-full rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"

type ImportCreateScreenProps = {
  onUploaded?: (importSessionId: string, files: File[]) => void
  redirectOnSuccess?: boolean
}

export function ImportCreateScreen({
  onUploaded,
  redirectOnSuccess = true
}: ImportCreateScreenProps = {}) {
  const router = useRouter()
  const [files, setFiles] = useState<File[]>([])
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitStage, setSubmitStage] = useState<"idle" | "creating" | "uploading">("idle")

  const createImportMutation = useAuthedMutation<
    { importSessionId: string; files: File[] },
    { files: File[] }
  >({
    mutationFn: async (accessToken, variables) => {
      setSubmitStage("creating")
      const created = await apiFetch<CreateImportSessionResponse>("/api/import-sessions", {
        method: "POST",
        accessToken,
        body: {}
      })

      const formData = new FormData()

      variables.files.forEach((file, index) => {
        formData.append("files", file)
        formData.append("pageIndexes", String(index))
      })

      setSubmitStage("uploading")
      await apiFetch<UploadImportImagesResponse>(
        `/api/import-sessions/${created.importSessionId}/images`,
        {
          method: "POST",
          accessToken,
          body: formData
        }
      )

      return {
        importSessionId: created.importSessionId,
        files: variables.files
      }
    },
    onSuccess: (data) => {
      onUploaded?.(data.importSessionId, data.files)

      if (redirectOnSuccess) {
        router.replace(`/imports/${data.importSessionId}`)
      }
    },
    onError: (error) => {
      setSubmitStage("idle")
      setSubmitError(getFormErrorMessage(error))
    }
  })

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError(null)

    if (files.length === 0) {
      setSubmitError("请至少选择一张订单截图。")
      return
    }

    await createImportMutation.mutateAsync({
      files
    })
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <section className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-[0_24px_80px_rgba(108,91,69,0.08)]">
        <div className="flex flex-col gap-5">
          <div>
            <h3 className="font-display text-3xl text-[color:var(--foreground)]">
              导入订单
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-[color:var(--muted)]">
              上传订单截图，系统智能解析订单信息和商品内容。确认后即可完成订单导入。
            </p>
          </div>
          <div className="w-full max-w-xl space-y-3">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[color:var(--foreground)]">
                订单截图
              </span>
              <input
                multiple
                accept="image/*"
                type="file"
                onChange={(event) => {
                  setFiles(Array.from(event.target.files ?? []))
                }}
                className={inputClassName}
              />
            </label>
            <button
              type="submit"
              disabled={createImportMutation.isPending}
              className="w-full rounded-2xl bg-[color:var(--accent-strong)] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(141,74,18,0.24)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createImportMutation.isPending
                  ? submitStage === "creating"
                    ? "正在创建导入会话..."
                    : "正在上传截图..."
                  : "上传并开始导入"}
              </button>
              {files.length > 0 ? (
                <div className="rounded-2xl border border-[color:var(--line)] bg-white/75 px-4 py-3 text-sm text-[color:var(--muted)]">
                  已选 {files.length} 张截图：
                  {files.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="mt-1 truncate">
                      {index + 1}. {file.name}
                    </div>
                  ))}
                </div>
              ) : null}
              {submitError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {submitError}
                </div>
              ) : null}
              {createImportMutation.isPending ? (
                <div className="rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-sm text-[color:var(--muted)]">
                  {submitStage === "creating"
                    ? "正在创建导入会话，完成后会开始上传图片。"
                    : "截图上传完成后会展示已上传截图，后台会继续解析订单内容。"}
                </div>
              ) : null}
          </div>
        </div>
      </section>
    </form>
  )
}

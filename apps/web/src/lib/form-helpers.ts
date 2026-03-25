import { ApiClientError } from "@/src/lib/api-client"

export function getFormErrorMessage(error: unknown) {
  if (error instanceof ApiClientError || error instanceof Error) {
    return error.message
  }

  return "提交失败，请稍后重试。"
}

export function getFormFieldErrors(error: unknown) {
  if (error instanceof ApiClientError) {
    return error.fieldErrors ?? {}
  }

  return {}
}

export function parseCurrencyInputToCent(value: string) {
  const normalized = value.trim().replace(/,/g, "")

  if (!normalized) {
    return null
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null
  }

  return Math.round(Number.parseFloat(normalized) * 100)
}

export function toCurrencyInput(value: number | null | undefined) {
  if (value == null) {
    return ""
  }

  return (value / 100).toFixed(2)
}

export function toDatetimeLocalValue(value: string | Date | null | undefined) {
  if (!value) {
    return ""
  }

  const date = typeof value === "string" ? new Date(value) : value
  const offset = date.getTimezoneOffset()

  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16)
}

export function toIsoDatetimeString(value: string) {
  return new Date(value).toISOString()
}

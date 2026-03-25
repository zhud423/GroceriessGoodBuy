import type { ApiError } from "@life-assistant/contracts"

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: ApiError["code"],
    public readonly fieldErrors?: Record<string, string>
  ) {
    super(message)
  }
}

type ApiRequestInit = {
  accessToken?: string | null
  body?: unknown
  headers?: HeadersInit
} & Omit<RequestInit, "body" | "headers">

export async function apiFetch<T>(
  input: string,
  { accessToken, body, headers, ...init }: ApiRequestInit = {}
) {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData

  const response = await fetch(input, {
    ...init,
    headers: {
      ...(!isFormData && body ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers
    },
    body:
      body === undefined
        ? undefined
        : isFormData
          ? body
          : JSON.stringify(body),
    cache: "no-store"
  })

  const payload = await response.json()

  if (!response.ok || payload?.ok === false) {
    const errorPayload = payload as ApiError | undefined

    throw new ApiClientError(
      errorPayload?.message ?? "Request failed.",
      response.status,
      errorPayload?.code,
      errorPayload?.fieldErrors
    )
  }

  return payload.data as T
}

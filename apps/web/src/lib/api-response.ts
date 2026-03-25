import type { ApiError, ApiErrorCode, ApiSuccess } from "@life-assistant/contracts"
import { NextResponse } from "next/server"

export function apiOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiSuccess<T>>(
    {
      ok: true,
      data
    },
    init
  )
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  init?: ResponseInit & { fieldErrors?: Record<string, string> }
) {
  return NextResponse.json<ApiError>(
    {
      ok: false,
      code,
      message,
      fieldErrors: init?.fieldErrors
    },
    init
  )
}

export function internalServerError(error: unknown, message = "Internal server error.") {
  console.error(message, error)

  return apiError("INTERNAL_ERROR", message, { status: 500 })
}

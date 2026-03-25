import type { ApiErrorCode } from "@life-assistant/contracts"
import { ZodError } from "zod"

import { apiError, internalServerError } from "@/src/lib/api-response"

export class RouteError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status: number,
    public readonly fieldErrors?: Record<string, string>
  ) {
    super(message)
  }
}

export function createFieldErrors(error: ZodError) {
  const flattened = error.flatten().fieldErrors
  const fieldErrors: Record<string, string> = {}

  for (const [field, messages] of Object.entries(flattened)) {
    if (Array.isArray(messages) && messages.length > 0) {
      fieldErrors[field] = messages[0]
    }
  }

  return fieldErrors
}

export function createValidationError(
  message: string,
  fieldErrors?: Record<string, string>
) {
  return new RouteError("VALIDATION_ERROR", message, 400, fieldErrors)
}

export function toRouteErrorResponse(error: unknown, fallbackMessage: string) {
  if (error instanceof RouteError) {
    return apiError(error.code, error.message, {
      status: error.status,
      fieldErrors: error.fieldErrors
    })
  }

  if (error instanceof ZodError) {
    return apiError("VALIDATION_ERROR", "Request validation failed.", {
      status: 400,
      fieldErrors: createFieldErrors(error)
    })
  }

  return internalServerError(error, fallbackMessage)
}

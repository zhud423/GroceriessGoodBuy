import { z } from "zod"

export const apiErrorCodeSchema = z.enum([
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION_ERROR",
  "CONFLICT",
  "IMPORT_NOT_READY",
  "IMPORT_ALREADY_COMMITTED",
  "INTERNAL_ERROR"
])

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>

export type ApiSuccess<T> = {
  ok: true
  data: T
}

export type ApiError = {
  ok: false
  code: ApiErrorCode
  message: string
  fieldErrors?: Record<string, string>
}

export const createApiSuccessSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    ok: z.literal(true),
    data: dataSchema
  })

export const apiErrorSchema = z.object({
  ok: z.literal(false),
  code: apiErrorCodeSchema,
  message: z.string(),
  fieldErrors: z.record(z.string()).optional()
})

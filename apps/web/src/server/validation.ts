import type { z, ZodTypeAny } from "zod"

import { createFieldErrors, createValidationError } from "./route-error"

export function parseWithSchema<TSchema extends ZodTypeAny>(
  schema: TSchema,
  input: unknown
) {
  const result = schema.safeParse(input)

  if (!result.success) {
    throw createValidationError("Request validation failed.", createFieldErrors(result.error))
  }

  return result.data as z.infer<TSchema>
}

export async function parseJsonBodyWithSchema<TSchema extends ZodTypeAny>(
  request: Request,
  schema: TSchema
) {
  try {
    const input = await request.json()

    return parseWithSchema(schema, input)
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw createValidationError("Request body must be valid JSON.")
    }

    throw error
  }
}

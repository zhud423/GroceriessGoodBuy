import { z } from "zod"

import { createApiSuccessSchema } from "./api"
import { platformCodeSchema } from "./shared"

export const categoryDtoSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  sortOrder: z.number().int()
})

export type CategoryDto = z.infer<typeof categoryDtoSchema>

export const tagDtoSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  sortOrder: z.number().int()
})

export type TagDto = z.infer<typeof tagDtoSchema>

export const platformDtoSchema = z.object({
  code: platformCodeSchema,
  label: z.string()
})

export type PlatformDto = z.infer<typeof platformDtoSchema>

export const categoriesResponseSchema = createApiSuccessSchema(z.array(categoryDtoSchema))
export const tagsResponseSchema = createApiSuccessSchema(z.array(tagDtoSchema))
export const platformsResponseSchema = createApiSuccessSchema(z.array(platformDtoSchema))

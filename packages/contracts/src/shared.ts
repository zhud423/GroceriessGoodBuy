import { z } from "zod"

import {
  INVENTORY_STATUS_VALUES,
  PLATFORM_CODES
} from "@life-assistant/shared"

export const platformCodeSchema = z.enum(PLATFORM_CODES)
export const inventoryStatusSchema = z.enum(INVENTORY_STATUS_VALUES)

export const isoDatetimeStringSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid datetime string.")

export const decimalQuantityStringSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Quantity must be a positive decimal string.")

export const positiveIntSchema = z.number().int().positive()

export const categorySummarySchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string()
})

export const tagSummarySchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string()
})

export const platformSummarySchema = z.object({
  code: platformCodeSchema,
  label: z.string()
})

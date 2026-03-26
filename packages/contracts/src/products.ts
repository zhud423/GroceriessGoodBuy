import { z } from "zod"

import { createApiSuccessSchema } from "./api"
import {
  categorySummarySchema,
  inventoryStatusSchema,
  platformCodeSchema,
  platformSummarySchema,
  tagSummarySchema
} from "./shared"

const pageSchema = z.coerce.number().int().min(1).default(1)
const pageSizeSchema = z.coerce.number().int().min(1).max(100).default(20)

export const productsListQuerySchema = z.object({
  q: z.string().trim().optional(),
  categoryId: z.string().trim().optional(),
  platform: platformCodeSchema.optional(),
  tagId: z.string().trim().optional(),
  inventoryStatus: inventoryStatusSchema.optional(),
  hasOrders: z.enum(["true", "false"]).optional(),
  sort: z.enum(["recent_added", "recent_purchased"]).default("recent_added"),
  page: pageSchema,
  pageSize: pageSizeSchema
})

export type ProductsListQuery = z.infer<typeof productsListQuerySchema>

export const createProductRequestSchema = z.object({
  displayName: z.string().trim().min(1),
  categoryId: z.string().trim().min(1),
  platformCodes: z.array(platformCodeSchema).default([]),
  specText: z.string().trim().min(1).nullable().optional(),
  tagIds: z.array(z.string().trim().min(1)).default([]),
  inventoryStatus: inventoryStatusSchema.default("UNKNOWN"),
  note: z.string().trim().min(1).nullable().optional()
})

export type CreateProductRequest = z.infer<typeof createProductRequestSchema>

export const updateProductRequestSchema = z
  .object({
    displayName: z.string().trim().min(1).optional(),
    categoryId: z.string().trim().min(1).optional(),
    specText: z.string().trim().min(1).nullable().optional(),
    tagIds: z.array(z.string().trim().min(1)).optional(),
    inventoryStatus: inventoryStatusSchema.optional(),
    note: z.string().trim().min(1).nullable().optional()
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required.")

export type UpdateProductRequest = z.infer<typeof updateProductRequestSchema>

export const bulkUpdateProductTagsRequestSchema = z.object({
  productIds: z.array(z.string().trim().min(1)).min(1),
  action: z.enum(["add", "remove"]),
  tagId: z.string().trim().min(1)
})

export type BulkUpdateProductTagsRequest = z.infer<
  typeof bulkUpdateProductTagsRequestSchema
>

export const productListItemDtoSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  category: categorySummarySchema,
  platforms: z.array(platformSummarySchema),
  tags: z.array(tagSummarySchema),
  inventoryStatus: inventoryStatusSchema,
  primaryImageUrl: z.string().nullable(),
  lastPurchasedAt: z.string().nullable(),
  createdAt: z.string()
})

export type ProductListItemDto = z.infer<typeof productListItemDtoSchema>

export const getProductsResponseSchema = createApiSuccessSchema(
  z.object({
    items: z.array(productListItemDtoSchema),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int()
  })
)

export type GetProductsResponse = {
  items: ProductListItemDto[]
  page: number
  pageSize: number
  total: number
}

export const productPlatformLatestPriceDtoSchema = z.object({
  platform: platformSummarySchema,
  latestOrderedAt: z.string(),
  linePriceAmount: z.number().int(),
  quantity: z.string(),
  specText: z.string().nullable(),
  weightGrams: z.number().int().nullable(),
  pricePer100g: z.number().int().nullable()
})

export type ProductPlatformLatestPriceDto = z.infer<
  typeof productPlatformLatestPriceDtoSchema
>

export const productOrderSummaryDtoSchema = z.object({
  orderId: z.string(),
  platform: platformSummarySchema,
  orderedAt: z.string(),
  linePriceAmount: z.number().int(),
  quantity: z.string()
})

export type ProductOrderSummaryDto = z.infer<typeof productOrderSummaryDtoSchema>

export const productDetailDtoSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  normalizedName: z.string(),
  category: categorySummarySchema,
  platforms: z.array(platformSummarySchema),
  tags: z.array(tagSummarySchema),
  inventoryStatus: inventoryStatusSchema,
  specText: z.string().nullable(),
  note: z.string().nullable(),
  primaryImageUrl: z.string().nullable(),
  lastPurchasedAt: z.string().nullable(),
  latestPlatformPrices: z.array(productPlatformLatestPriceDtoSchema),
  recentOrders: z.array(productOrderSummaryDtoSchema)
})

export type ProductDetailDto = z.infer<typeof productDetailDtoSchema>

export const getProductDetailResponseSchema = createApiSuccessSchema(productDetailDtoSchema)

export const mutateProductResponseSchema = createApiSuccessSchema(
  z.object({
    productId: z.string()
  })
)

export type MutateProductResponse = {
  productId: string
}

export const bulkUpdateProductTagsResponseSchema = createApiSuccessSchema(
  z.object({
    updatedCount: z.number().int().nonnegative()
  })
)

export type BulkUpdateProductTagsResponse = {
  updatedCount: number
}

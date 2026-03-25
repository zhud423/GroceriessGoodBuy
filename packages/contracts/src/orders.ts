import { z } from "zod"

import { createApiSuccessSchema } from "./api"
import {
  categorySummarySchema,
  decimalQuantityStringSchema,
  inventoryStatusSchema,
  isoDatetimeStringSchema,
  platformCodeSchema,
  platformSummarySchema,
  tagSummarySchema
} from "./shared"

const pageSchema = z.coerce.number().int().min(1).default(1)
const pageSizeSchema = z.coerce.number().int().min(1).max(100).default(20)

export const ordersListQuerySchema = z.object({
  platform: platformCodeSchema.optional(),
  page: pageSchema,
  pageSize: pageSizeSchema
})

export type OrdersListQuery = z.infer<typeof ordersListQuerySchema>

const newProductForOrderSchema = z.object({
  displayName: z.string().trim().min(1),
  categoryId: z.string().trim().min(1),
  tagIds: z.array(z.string().trim().min(1)).default([]),
  inventoryStatus: inventoryStatusSchema.default("UNKNOWN"),
  note: z.string().trim().min(1).nullable().optional()
})

export const manualOrderItemInputSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("existing_product"),
    productId: z.string().trim().min(1),
    rawName: z.string().trim().min(1),
    linePriceAmount: z.number().int().nonnegative(),
    quantity: decimalQuantityStringSchema,
    specText: z.string().trim().min(1).nullable().optional(),
    weightGrams: z.number().int().positive().nullable().optional()
  }),
  z.object({
    mode: z.literal("new_product"),
    rawName: z.string().trim().min(1),
    linePriceAmount: z.number().int().nonnegative(),
    quantity: decimalQuantityStringSchema,
    specText: z.string().trim().min(1).nullable().optional(),
    weightGrams: z.number().int().positive().nullable().optional(),
    newProduct: newProductForOrderSchema
  })
])

export type ManualOrderItemInput = z.infer<typeof manualOrderItemInputSchema>

export const createOrderRequestSchema = z.object({
  platform: platformCodeSchema,
  orderedAt: isoDatetimeStringSchema,
  note: z.string().trim().min(1).nullable().optional(),
  items: z.array(manualOrderItemInputSchema).min(1)
})

export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>

export const updateOrderRequestSchema = z
  .object({
    orderedAt: isoDatetimeStringSchema.optional(),
    note: z.string().trim().min(1).nullable().optional()
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required.")

export type UpdateOrderRequest = z.infer<typeof updateOrderRequestSchema>

export const orderListItemDtoSchema = z.object({
  id: z.string(),
  platform: platformSummarySchema,
  orderedAt: z.string(),
  itemCount: z.number().int(),
  coverImageUrl: z.string().nullable(),
  createdAt: z.string()
})

export type OrderListItemDto = z.infer<typeof orderListItemDtoSchema>

export const getOrdersResponseSchema = createApiSuccessSchema(
  z.object({
    items: z.array(orderListItemDtoSchema),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int()
  })
)

export type GetOrdersResponse = {
  items: OrderListItemDto[]
  page: number
  pageSize: number
  total: number
}

export const orderImageDtoSchema = z.object({
  id: z.string(),
  pageIndex: z.number().int(),
  imageUrl: z.string()
})

export type OrderImageDto = z.infer<typeof orderImageDtoSchema>

export const orderItemDtoSchema = z.object({
  id: z.string(),
  product: z
    .object({
      id: z.string(),
      displayName: z.string()
    })
    .nullable(),
  rawName: z.string(),
  linePriceAmount: z.number().int(),
  quantity: z.string(),
  specText: z.string().nullable(),
  weightGrams: z.number().int().nullable(),
  pricePer100g: z.number().int().nullable(),
  resolutionStatus: z.enum(["PENDING", "MATCHED_EXISTING", "CREATED_NEW_PRODUCT"]),
  isNewProductAtImport: z.boolean()
})

export type OrderItemDto = z.infer<typeof orderItemDtoSchema>

export const orderDetailDtoSchema = z.object({
  id: z.string(),
  platform: platformSummarySchema,
  orderedAt: z.string(),
  note: z.string().nullable(),
  importProcessing: z
    .object({
      sourceImportId: z.string(),
      isPending: z.boolean(),
      errorMessage: z.string().nullable(),
      pendingImageCount: z.number().int().nonnegative(),
      unresolvedItemCount: z.number().int().nonnegative()
    })
    .nullable(),
  images: z.array(orderImageDtoSchema),
  items: z.array(orderItemDtoSchema)
})

export type OrderDetailDto = z.infer<typeof orderDetailDtoSchema>

export const getOrderDetailResponseSchema = createApiSuccessSchema(orderDetailDtoSchema)

export const mutateOrderResponseSchema = createApiSuccessSchema(
  z.object({
    orderId: z.string()
  })
)

export type MutateOrderResponse = {
  orderId: string
}

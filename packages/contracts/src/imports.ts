import { z } from "zod"

import { createApiSuccessSchema } from "./api"
import {
  categorySummarySchema,
  decimalQuantityStringSchema,
  isoDatetimeStringSchema,
  platformCodeSchema,
  platformSummarySchema
} from "./shared"

export const importSessionStatusSchema = z.enum([
  "DRAFT",
  "PROCESSING",
  "REVIEW_REQUIRED",
  "READY_TO_COMMIT",
  "COMMITTED",
  "FAILED"
])

export type ImportSessionStatus = z.infer<typeof importSessionStatusSchema>

export const draftReviewStatusSchema = z.enum([
  "PENDING_REVIEW",
  "MATCHED_EXISTING",
  "CREATE_NEW",
  "RESOLVED"
])

export type DraftReviewStatus = z.infer<typeof draftReviewStatusSchema>

export const createImportSessionRequestSchema = z.object({
  initialPlatform: platformCodeSchema.optional()
})

export type CreateImportSessionRequest = z.infer<typeof createImportSessionRequestSchema>

export const createImportSessionResponseSchema = createApiSuccessSchema(
  z.object({
    importSessionId: z.string(),
    status: z.literal("DRAFT")
  })
)

export type CreateImportSessionResponse = {
  importSessionId: string
  status: "DRAFT"
}

export const uploadImportImagesResponseSchema = createApiSuccessSchema(
  z.object({
    importSessionId: z.string(),
    status: importSessionStatusSchema,
    uploaded: z.array(
      z.object({
        imageId: z.string(),
        pageIndex: z.number().int().nonnegative(),
        imageUrl: z.string()
      })
    )
  })
)

export type UploadImportImagesResponse = {
  importSessionId: string
  status: ImportSessionStatus
  uploaded: Array<{
    imageId: string
    pageIndex: number
    imageUrl: string
  }>
}

export const analyzeImportSessionRequestSchema = z.object({
  forceReanalyze: z.boolean().optional()
})

export type AnalyzeImportSessionRequest = z.infer<typeof analyzeImportSessionRequestSchema>

export const analyzeImportSessionResponseSchema = createApiSuccessSchema(
  z.object({
    importSessionId: z.string(),
    status: importSessionStatusSchema
  })
)

export type AnalyzeImportSessionResponse = {
  importSessionId: string
  status: ImportSessionStatus
}

export const importDraftCandidateProductDtoSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  category: categorySummarySchema,
  specText: z.string().nullable(),
  primaryImageUrl: z.string().nullable()
})

export type ImportDraftCandidateProductDto = z.infer<
  typeof importDraftCandidateProductDtoSchema
>

export const importItemDraftDtoSchema = z.object({
  id: z.string(),
  pageIndex: z.number().int().nullable(),
  rawName: z.string(),
  normalizedName: z.string().nullable(),
  guessedCategory: categorySummarySchema.nullable(),
  priceAmount: z.number().int().nullable(),
  quantity: z.string().nullable(),
  specText: z.string().nullable(),
  weightGrams: z.number().int().nullable(),
  pricePer100g: z.number().int().nullable(),
  candidateProducts: z.array(importDraftCandidateProductDtoSchema),
  selectedProductId: z.string().nullable(),
  createNewProduct: z.boolean(),
  manualDisplayName: z.string().nullable(),
  manualCategoryId: z.string().nullable(),
  manualNote: z.string().nullable(),
  reviewStatus: draftReviewStatusSchema
})

export type ImportItemDraftDto = z.infer<typeof importItemDraftDtoSchema>

export const importSessionDetailDtoSchema = z.object({
  id: z.string(),
  status: importSessionStatusSchema,
  isAnalyzing: z.boolean(),
  isPreparingCommit: z.boolean(),
  errorMessage: z.string().nullable(),
  platformGuess: platformSummarySchema.nullable(),
  selectedPlatform: platformSummarySchema.nullable(),
  orderedAtGuess: z.string().nullable(),
  selectedOrderedAt: z.string().nullable(),
  note: z.string().nullable(),
  images: z.array(
    z.object({
      id: z.string(),
      pageIndex: z.number().int().nonnegative(),
      imageUrl: z.string()
    })
  ),
  itemDrafts: z.array(importItemDraftDtoSchema),
  committedOrderId: z.string().nullable()
})

export type ImportSessionDetailDto = z.infer<typeof importSessionDetailDtoSchema>

export const getImportSessionDetailResponseSchema = createApiSuccessSchema(
  importSessionDetailDtoSchema
)

export const updateImportSessionRequestSchema = z
  .object({
    selectedPlatform: platformCodeSchema.optional(),
    selectedOrderedAt: isoDatetimeStringSchema.optional(),
    note: z.string().trim().min(1).nullable().optional()
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required.")

export type UpdateImportSessionRequest = z.infer<typeof updateImportSessionRequestSchema>

export const updateImportSessionResponseSchema = createApiSuccessSchema(
  z.object({
    importSessionId: z.string()
  })
)

export type UpdateImportSessionResponse = {
  importSessionId: string
}

export const updateImportItemDraftRequestSchema = z
  .object({
    priceAmount: z.number().int().nonnegative().optional(),
    quantity: decimalQuantityStringSchema.optional(),
    specText: z.string().trim().min(1).nullable().optional(),
    weightGrams: z.number().int().positive().nullable().optional(),
    selectedProductId: z.string().trim().min(1).nullable().optional(),
    createNewProduct: z.boolean().optional(),
    manualDisplayName: z.string().trim().min(1).nullable().optional(),
    manualCategoryId: z.string().trim().min(1).nullable().optional(),
    manualNote: z.string().trim().min(1).nullable().optional()
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required.")

export type UpdateImportItemDraftRequest = z.infer<
  typeof updateImportItemDraftRequestSchema
>

export const updateImportItemDraftsRequestSchema = z.object({
  drafts: z.array(
    z.object({
      id: z.string().trim().min(1),
      body: updateImportItemDraftRequestSchema
    })
  ).min(1)
})

export type UpdateImportItemDraftsRequest = z.infer<
  typeof updateImportItemDraftsRequestSchema
>

export const updateImportItemDraftResponseSchema = createApiSuccessSchema(
  z.object({
    importItemDraftId: z.string(),
    reviewStatus: draftReviewStatusSchema,
    pricePer100g: z.number().int().nullable()
  })
)

export type UpdateImportItemDraftResponse = {
  importItemDraftId: string
  reviewStatus: DraftReviewStatus
  pricePer100g: number | null
}

export const updateImportItemDraftsResponseSchema = createApiSuccessSchema(
  z.object({
    importSessionId: z.string(),
    updatedDraftIds: z.array(z.string())
  })
)

export type UpdateImportItemDraftsResponse = {
  importSessionId: string
  updatedDraftIds: string[]
}

export const confirmImportSessionRequestSchema = z.object({
  selectedPlatform: platformCodeSchema.optional(),
  selectedOrderedAt: isoDatetimeStringSchema.optional(),
  note: z.string().trim().min(1).nullable().optional(),
  drafts: z.array(
    z.object({
      id: z.string().trim().min(1),
      body: updateImportItemDraftRequestSchema
    })
  ).optional(),
  markImportedProductsInStock: z.boolean().optional()
})

export type ConfirmImportSessionRequest = z.infer<typeof confirmImportSessionRequestSchema>

export const confirmImportSessionResponseSchema = createApiSuccessSchema(
  z.object({
    orderId: z.string(),
    importSessionId: z.string(),
    createdProductIds: z.array(z.string()),
    linkedProductIds: z.array(z.string())
  })
)

export type ConfirmImportSessionResponse = {
  orderId: string
  importSessionId: string
  createdProductIds: string[]
  linkedProductIds: string[]
}

export const commitImportSessionRequestSchema = z.object({
  markImportedProductsInStock: z.boolean().optional()
})

export type CommitImportSessionRequest = z.infer<typeof commitImportSessionRequestSchema>

export const commitImportSessionResponseSchema = createApiSuccessSchema(
  z.object({
    orderId: z.string(),
    importSessionId: z.string(),
    createdProductIds: z.array(z.string()),
    linkedProductIds: z.array(z.string())
  })
)

export type CommitImportSessionResponse = {
  orderId: string
  importSessionId: string
  createdProductIds: string[]
  linkedProductIds: string[]
}

import type {
  AnalyzeImportSessionRequest,
  ConfirmImportSessionRequest,
  CommitImportSessionRequest,
  CreateImportSessionRequest,
  DraftReviewStatus,
  ImportSessionStatus,
  UpdateImportItemDraftRequest,
  UpdateImportItemDraftsRequest,
  UpdateImportSessionRequest
} from "@life-assistant/contracts"
import { prisma, Prisma, type Platform } from "@life-assistant/db"
import { calculatePricePer100g, normalizeProductName } from "@life-assistant/domain"
import { getPlatformLabel, toPlatformOption, type PlatformCode } from "@life-assistant/shared"
import { randomUUID } from "node:crypto"

import { isBackgroundTaskRunning, startBackgroundTask } from "../background-tasks"
import { ensureActiveCategory, normalizeOptionalText } from "../catalog"
import {
  copyImportImageToOrderStorage,
  deleteOrderImagesFromStorage,
  getImportImageUrl,
  getOrderImageUrl,
  uploadImportImageFile
} from "../storage"
import { RouteError, createValidationError } from "../route-error"
import { analyzeOrderImages, getVisionExecutionMode } from "./vision"

type TransactionClient = Prisma.TransactionClient
type DatabaseClient = TransactionClient | typeof prisma

type ImportDraftState = {
  id: string
  importSessionId: string
  rawName: string
  priceAmount: number | null
  quantity: Prisma.Decimal | string | null
  specText: string | null
  weightGrams: number | null
  selectedProductId: string | null
  createNewProduct: boolean
  manualDisplayName: string | null
  manualCategoryId: string | null
  manualNote?: string | null
}

type ImportDraftReviewState = Pick<
  ImportDraftState,
  | "rawName"
  | "priceAmount"
  | "quantity"
  | "specText"
  | "weightGrams"
  | "selectedProductId"
  | "createNewProduct"
  | "manualDisplayName"
  | "manualCategoryId"
>

type CandidateMatch = {
  id: string
  score: number
  lastPurchasedAt: Date | null
}

type CandidateProductSearchRow = {
  id: string
  normalizedName: string
  lastPurchasedAt: Date | null
  aliases: Array<{
    normalizedName: string
    platform: Platform
  }>
}

const IMPORT_TRANSACTION_MAX_WAIT_MS = 5_000
const IMPORT_TRANSACTION_TIMEOUT_MS = 60_000
const IMPORT_COMMIT_TRANSACTION_TIMEOUT_MS = 180_000
const CANDIDATE_POOL_LIMIT = 120
const IMPORT_ANALYZE_TASK_PREFIX = "import-analyze"
const IMPORT_COMMIT_TASK_PREFIX = "import-commit"
const IMPORT_PREPARE_ORDER_TASK_PREFIX = "import-prepare-order"
const queuedImportTaskKeys = new Set<string>()

function getAnalyzeTaskKey(sessionId: string) {
  return `${IMPORT_ANALYZE_TASK_PREFIX}:${sessionId}`
}

function getCommitTaskKey(sessionId: string) {
  return `${IMPORT_COMMIT_TASK_PREFIX}:${sessionId}`
}

function getPrepareOrderTaskKey(sessionId: string) {
  return `${IMPORT_PREPARE_ORDER_TASK_PREFIX}:${sessionId}`
}

function getPrepareOrderCleanupTaskKey(orderId: string) {
  return `${IMPORT_PREPARE_ORDER_TASK_PREFIX}:cleanup:${orderId}`
}

function scheduleQueuedImportTask(taskKey: string, runner: () => Promise<void>) {
  const runTask = () =>
    startBackgroundTask(taskKey, async () => {
      try {
        await runner()
      } finally {
        if (queuedImportTaskKeys.delete(taskKey)) {
          scheduleQueuedImportTask(taskKey, runner)
        }
      }
    })

  if (!runTask()) {
    queuedImportTaskKeys.add(taskKey)
  }
}

function parseCandidateProductIds(value: Prisma.JsonValue | null | undefined) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === "string")
}

function toOptionalDate(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const normalized = normalizeModelDatetimeString(value)
  const date = new Date(normalized)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date
}

function normalizeModelDatetimeString(value: string) {
  const normalized = value.trim().replace(/\//g, "-")

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return `${normalized}T00:00:00+08:00`
  }

  const localDatetimeMatch = normalized.match(
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?$/
  )

  if (localDatetimeMatch) {
    return `${localDatetimeMatch[1]}T${localDatetimeMatch[2]}:${localDatetimeMatch[3] ?? "00"}+08:00`
  }

  return normalized
}

function tokenizeCandidateName(value: string) {
  return value
    .split(/[^a-z0-9\u4e00-\u9fff]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !/^\d+(?:\.\d+)?(?:g|kg|ml|l|克|千克|斤|毫升|升)?$/i.test(token))
}

function toCoreCandidateName(value: string) {
  return tokenizeCandidateName(value).join(" ")
}

function buildCandidateSearchTerms(normalizedName: string) {
  const terms = [normalizedName, toCoreCandidateName(normalizedName), ...tokenizeCandidateName(normalizedName)]

  return [...new Set(terms.filter((term) => term.length >= 2))].slice(0, 6)
}

function scoreCandidateName(targetName: string, candidateName: string) {
  if (!targetName || !candidateName) {
    return 0
  }

  if (candidateName === targetName) {
    return 100
  }

  const targetCore = toCoreCandidateName(targetName)
  const candidateCore = toCoreCandidateName(candidateName)

  if (targetCore && candidateCore && targetCore === candidateCore) {
    return 92
  }

  if (candidateName.startsWith(targetName) || targetName.startsWith(candidateName)) {
    return 82
  }

  if (
    targetCore &&
    candidateCore &&
    (candidateCore.startsWith(targetCore) || targetCore.startsWith(candidateCore))
  ) {
    return 78
  }

  if (candidateName.includes(targetName) || targetName.includes(candidateName)) {
    return 68
  }

  const targetTokens = tokenizeCandidateName(targetName)
  const candidateTokens = tokenizeCandidateName(candidateName)

  if (targetTokens.length === 0 || candidateTokens.length === 0) {
    return 0
  }

  const overlap = targetTokens.filter((token) => candidateTokens.includes(token)).length

  if (overlap === 0) {
    return 0
  }

  const overlapRatio = overlap / Math.max(targetTokens.length, candidateTokens.length)

  if (overlapRatio >= 0.85) {
    return 72
  }

  if (overlapRatio >= 0.6) {
    return 64
  }

  if (overlapRatio >= 0.4) {
    return 56
  }

  return 0
}

function toQuantityString(value: Prisma.Decimal | string | null | undefined) {
  if (value == null) {
    return null
  }

  return typeof value === "string" ? value : value.toString()
}

function resolveDraftCommittedRawName(
  draft: Pick<ImportDraftState, "rawName" | "manualDisplayName">
) {
  return normalizeOptionalText(draft.manualDisplayName) ?? normalizeOptionalText(draft.rawName)
}

function deriveDraftReviewStatus(draft: ImportDraftReviewState): DraftReviewStatus {
  if (draft.selectedProductId) {
    return "MATCHED_EXISTING"
  }

  if (draft.createNewProduct && draft.manualDisplayName && draft.manualCategoryId) {
    return "CREATE_NEW"
  }

  return "PENDING_REVIEW"
}

function isDraftReadyForCommit(draft: ImportDraftReviewState) {
  const resolvedName = resolveDraftCommittedRawName(draft)

  if (!resolvedName || draft.priceAmount == null || draft.quantity == null) {
    return false
  }

  return true
}

function resolveNextImportDraftState(
  draft: ImportDraftState,
  input: UpdateImportItemDraftRequest
) {
  const nextSelectedProductId = Object.prototype.hasOwnProperty.call(input, "selectedProductId")
    ? input.selectedProductId ?? null
    : draft.selectedProductId
  const nextCreateNewProduct = Object.prototype.hasOwnProperty.call(input, "createNewProduct")
    ? input.createNewProduct ?? false
    : draft.createNewProduct
  const nextManualDisplayName = Object.prototype.hasOwnProperty.call(input, "manualDisplayName")
    ? normalizeOptionalText(input.manualDisplayName)
    : draft.manualDisplayName
  const nextManualCategoryId = Object.prototype.hasOwnProperty.call(input, "manualCategoryId")
    ? input.manualCategoryId ?? null
    : draft.manualCategoryId
  const nextManualNote = Object.prototype.hasOwnProperty.call(input, "manualNote")
    ? normalizeOptionalText(input.manualNote)
    : draft.manualNote ?? null
  const nextPriceAmount = Object.prototype.hasOwnProperty.call(input, "priceAmount")
    ? input.priceAmount ?? null
    : draft.priceAmount
  const nextQuantity = Object.prototype.hasOwnProperty.call(input, "quantity")
    ? input.quantity ?? null
    : toQuantityString(draft.quantity)
  const nextSpecText = Object.prototype.hasOwnProperty.call(input, "specText")
    ? normalizeOptionalText(input.specText)
    : draft.specText
  const nextWeightGrams = Object.prototype.hasOwnProperty.call(input, "weightGrams")
    ? input.weightGrams ?? null
    : draft.weightGrams

  if (nextSelectedProductId && nextCreateNewProduct) {
    throw createValidationError("Request validation failed.", {
      selectedProductId: "Cannot select an existing product and create a new product at the same time.",
      createNewProduct: "Cannot create a new product while an existing product is selected."
    })
  }

  return {
    nextSelectedProductId,
    nextCreateNewProduct,
    nextManualDisplayName,
    nextManualCategoryId,
    nextManualNote,
    nextPriceAmount,
    nextQuantity,
    nextSpecText,
    nextWeightGrams
  }
}

async function applyImportDraftUpdate(
  tx: TransactionClient,
  userId: string,
  draft: ImportDraftState,
  input: UpdateImportItemDraftRequest
) {
  const next = resolveNextImportDraftState(draft, input)

  if (next.nextSelectedProductId) {
    await ensureOwnedProduct(tx, userId, next.nextSelectedProductId, "selectedProductId")
  }

  if (next.nextManualCategoryId) {
    await ensureActiveCategory(tx, next.nextManualCategoryId)
  }

  const reviewStatus = deriveDraftReviewStatus({
    rawName: draft.rawName,
    priceAmount: next.nextPriceAmount,
    quantity: next.nextQuantity,
    specText: next.nextSpecText,
    weightGrams: next.nextWeightGrams,
    selectedProductId: next.nextSelectedProductId,
    createNewProduct: next.nextCreateNewProduct,
    manualDisplayName: next.nextManualDisplayName,
    manualCategoryId: next.nextManualCategoryId
  })
  const normalizedName = normalizeProductName(next.nextManualDisplayName ?? draft.rawName)
  const pricePer100g = calculatePricePer100g({
    linePriceAmount: next.nextPriceAmount ?? 0,
    quantity: next.nextQuantity,
    weightGrams: next.nextWeightGrams
  })

  await tx.importItemDraft.update({
    where: {
      id: draft.id
    },
    data: {
      priceAmount: next.nextPriceAmount,
      quantity: next.nextQuantity == null ? null : new Prisma.Decimal(next.nextQuantity),
      specText: next.nextSpecText,
      weightGrams: next.nextWeightGrams,
      selectedProductId: next.nextSelectedProductId,
      createNewProduct: next.nextCreateNewProduct,
      manualDisplayName: next.nextManualDisplayName,
      manualCategoryId: next.nextManualCategoryId,
      manualNote: next.nextManualNote,
      normalizedName: normalizedName || null,
      pricePer100g,
      reviewStatus
    }
  })
}

async function ensureOwnedProduct(
  tx: TransactionClient,
  userId: string,
  productId: string,
  fieldPath: string
) {
  const product = await tx.product.findFirst({
    where: {
      id: productId,
      userId
    },
    select: {
      id: true
    }
  })

  if (!product) {
    throw createValidationError("Request validation failed.", {
      [fieldPath]: "Referenced product does not exist."
    })
  }

  return product
}

async function createProductInsideImportCommit(
  tx: TransactionClient,
  userId: string,
  draft: {
    manualDisplayName: string
    manualCategoryId: string
    manualNote: string | null
    specText: string | null
  },
  inventoryStatus: "UNKNOWN" | "SUFFICIENT"
) {
  await ensureActiveCategory(tx, draft.manualCategoryId)

  return tx.product.create({
    data: {
      userId,
      categoryId: draft.manualCategoryId,
      displayName: draft.manualDisplayName,
      normalizedName: normalizeProductName(draft.manualDisplayName),
      inventoryStatus,
      note: normalizeOptionalText(draft.manualNote),
      specText: normalizeOptionalText(draft.specText)
    },
    select: {
      id: true
    }
  })
}

async function upsertProductAlias(
  client: DatabaseClient,
  productId: string,
  platform: Platform,
  rawName: string
) {
  const normalizedName = normalizeProductName(rawName)

  if (!normalizedName) {
    return
  }

  await client.productAlias.upsert({
    where: {
      productId_platform_normalizedName: {
        productId,
        platform,
        normalizedName
      }
    },
    update: {
      rawName: rawName.trim()
    },
    create: {
      productId,
      platform,
      rawName: rawName.trim(),
      normalizedName
    }
  })
}

async function refreshProductOrderAggregates(
  client: DatabaseClient,
  userId: string,
  productId: string,
  platform: Platform
) {
  const latestOrderItem = await client.orderItem.findFirst({
    where: {
      productId,
      order: {
        userId,
        status: "ACTIVE"
      }
    },
    select: {
      order: {
        select: {
          orderedAt: true
        }
      }
    },
    orderBy: [
      {
        order: {
          orderedAt: "desc"
        }
      },
      {
        createdAt: "desc"
      }
    ]
  })

  await client.product.update({
    where: {
      id: productId
    },
    data: {
      lastPurchasedAt: latestOrderItem?.order.orderedAt ?? null
    }
  })

  const earliestPlatformItem = await client.orderItem.findFirst({
    where: {
      productId,
      order: {
        userId,
        platform,
        status: "ACTIVE"
      }
    },
    select: {
      order: {
        select: {
          orderedAt: true
        }
      }
    },
    orderBy: [
      {
        order: {
          orderedAt: "asc"
        }
      },
      {
        createdAt: "asc"
      }
    ]
  })

  const latestPlatformItem = await client.orderItem.findFirst({
    where: {
      productId,
      order: {
        userId,
        platform,
        status: "ACTIVE"
      }
    },
    select: {
      order: {
        select: {
          orderedAt: true
        }
      }
    },
    orderBy: [
      {
        order: {
          orderedAt: "desc"
        }
      },
      {
        createdAt: "desc"
      }
    ]
  })

  if (!earliestPlatformItem || !latestPlatformItem) {
    await client.productPlatform.deleteMany({
      where: {
        productId,
        platform
      }
    })

    return
  }

  await client.productPlatform.upsert({
    where: {
      productId_platform: {
        productId,
        platform
      }
    },
    update: {
      firstSeenAt: earliestPlatformItem.order.orderedAt,
      lastSeenAt: latestPlatformItem.order.orderedAt
    },
    create: {
      productId,
      platform,
      firstSeenAt: earliestPlatformItem.order.orderedAt,
      lastSeenAt: latestPlatformItem.order.orderedAt
    }
  })
}

function isImportSessionReadyForPreparedOrder(session: {
  selectedPlatform: PlatformCode | Platform | null
  selectedOrderedAt: Date | null
  itemDrafts: ImportDraftReviewState[]
}) {
  return (
    Boolean(session.selectedPlatform) &&
    Boolean(session.selectedOrderedAt) &&
    session.itemDrafts.length > 0 &&
    session.itemDrafts.every((draft) => isDraftReadyForCommit(draft))
  )
}

async function cleanupPreparedOrderDraft(orderId: string | null | undefined) {
  if (!orderId) {
    return
  }

  const preparedOrder = await prisma.order.findUnique({
    where: {
      id: orderId
    },
    select: {
      id: true,
      status: true,
      images: {
        select: {
          storagePath: true
        }
      }
    }
  })

  if (!preparedOrder || preparedOrder.status !== "DRAFT") {
    return
  }

  if (preparedOrder.images.length > 0) {
    await deleteOrderImagesFromStorage(preparedOrder.images.map((image) => image.storagePath))
  }

  await prisma.importSession.updateMany({
    where: {
      preparedOrderId: preparedOrder.id
    },
    data: {
      preparedOrderId: null,
      preparedOrderBuiltAt: null
    }
  })

  await prisma.order.delete({
    where: {
      id: preparedOrder.id
    }
  })
}

async function syncPreparedOrderForImportSession(userId: string, sessionId: string) {
  const session = await prisma.importSession.findFirst({
    where: {
      id: sessionId,
      userId
    },
    select: {
      id: true,
      status: true,
      note: true,
      preparedOrderId: true,
      selectedPlatform: true,
      selectedOrderedAt: true,
      preparedOrderBuiltAt: true,
      images: {
        select: {
          storagePath: true,
          pageIndex: true
        },
        orderBy: {
          pageIndex: "asc"
        }
      },
      itemDrafts: {
        select: {
          id: true,
          rawName: true,
          priceAmount: true,
          quantity: true,
          specText: true,
          weightGrams: true,
          selectedProductId: true,
          createNewProduct: true,
          manualDisplayName: true,
          manualCategoryId: true
        },
        orderBy: [
          {
            pageIndex: "asc"
          },
          {
            createdAt: "asc"
          }
        ]
      }
    }
  })

  if (!session || session.status === "COMMITTED") {
    return
  }

  if (!isImportSessionReadyForPreparedOrder(session)) {
    if (session.preparedOrderId) {
      await cleanupPreparedOrderDraft(session.preparedOrderId)
      await prisma.importSession.update({
        where: {
          id: sessionId
        },
        data: {
          preparedOrderId: null,
          preparedOrderBuiltAt: null
        }
      })
    }

    return
  }

  const selectedProductIds = [
    ...new Set(
      session.itemDrafts
        .map((draft) => draft.selectedProductId)
        .filter((productId): productId is string => Boolean(productId))
    )
  ]
  const validSelectedProductIds =
    selectedProductIds.length > 0
      ? new Set(
          (
            await prisma.product.findMany({
              where: {
                userId,
                id: {
                  in: selectedProductIds
                }
              },
              select: {
                id: true
              }
            })
          ).map((product) => product.id)
        )
      : new Set<string>()
  const preparedOrderId = session.preparedOrderId ?? randomUUID()
  const existingPreparedOrder = await prisma.order.findFirst({
    where: {
      id: preparedOrderId,
      userId,
      status: "DRAFT"
    },
    select: {
      id: true,
      images: {
        select: {
          storagePath: true
        }
      }
    }
  })
  const staleStoragePaths = existingPreparedOrder?.images.map((image) => image.storagePath) ?? []

  const copiedStoragePaths: string[] = []

  try {
    const copiedImages = await Promise.all(
      session.images.map(async (image) => {
        const storagePath = await copyImportImageToOrderStorage({
          sourceStoragePath: image.storagePath,
          userId,
          orderId: preparedOrderId,
          pageIndex: image.pageIndex
        })

        copiedStoragePaths.push(storagePath)

        return {
          orderId: preparedOrderId,
          pageIndex: image.pageIndex,
          storagePath
        }
      })
    )
    const preparedOrderItems = session.itemDrafts.map((draft) => {
      const quantity = draft.quantity?.toString()

      if (!quantity) {
        throw createValidationError("Request validation failed.", {
          [`itemDrafts.${draft.id}.quantity`]: "Quantity is required."
        })
      }

      const selectedProductId =
        draft.selectedProductId && validSelectedProductIds.has(draft.selectedProductId)
          ? draft.selectedProductId
          : null

      return {
        orderId: preparedOrderId,
        sourceImportItemDraftId: draft.id,
        productId: selectedProductId,
        rawName: draft.rawName.trim(),
        linePriceAmount: draft.priceAmount ?? 0,
        quantity: new Prisma.Decimal(quantity),
        specText: draft.specText,
        weightGrams: draft.weightGrams,
        pricePer100g: calculatePricePer100g({
          linePriceAmount: draft.priceAmount ?? 0,
          quantity,
          weightGrams: draft.weightGrams
        }),
        resolutionStatus: selectedProductId ? "MATCHED_EXISTING" as const : "PENDING" as const,
        isNewProductAtImport: false
      }
    })

    await prisma.$transaction(async (tx) => {
      const draftOrder = await tx.order.findFirst({
        where: {
          id: preparedOrderId,
          userId,
          status: "DRAFT"
        },
        select: {
          id: true
        }
      })

      if (draftOrder) {
        await tx.order.update({
          where: {
            id: preparedOrderId
          },
          data: {
            platform: session.selectedPlatform!,
            orderedAt: session.selectedOrderedAt!,
            note: normalizeOptionalText(session.note),
            status: "DRAFT"
          }
        })
        await tx.orderItem.deleteMany({
          where: {
            orderId: preparedOrderId
          }
        })
        await tx.orderImage.deleteMany({
          where: {
            orderId: preparedOrderId
          }
        })
      } else {
        await tx.order.create({
          data: {
            id: preparedOrderId,
            userId,
            status: "DRAFT",
            platform: session.selectedPlatform!,
            orderedAt: session.selectedOrderedAt!,
            note: normalizeOptionalText(session.note)
          }
        })
      }

      await tx.orderItem.createMany({
        data: preparedOrderItems
      })

      if (copiedImages.length > 0) {
        await tx.orderImage.createMany({
          data: copiedImages
        })
      }

      await tx.importSession.update({
        where: {
          id: sessionId
        },
        data: {
          preparedOrderId,
          preparedOrderBuiltAt: new Date(),
          status: "READY_TO_COMMIT"
        }
      })
    }, {
      maxWait: IMPORT_TRANSACTION_MAX_WAIT_MS,
      timeout: IMPORT_COMMIT_TRANSACTION_TIMEOUT_MS
    })

    if (staleStoragePaths.length > 0) {
      await deleteOrderImagesFromStorage(staleStoragePaths)
    }
  } catch (error) {
    if (copiedStoragePaths.length > 0) {
      await deleteOrderImagesFromStorage(copiedStoragePaths)
    }

    throw error
  }
}

function scheduleAnalyzeImportSession(userId: string, sessionId: string) {
  scheduleQueuedImportTask(getAnalyzeTaskKey(sessionId), async () => {
    await prisma.importSession.update({
      where: {
        id: sessionId
      },
      data: {
        status: "PROCESSING",
        errorMessage: null
      }
    })

    await performAnalyzeImportSessionForUser(userId, sessionId)
  })
}

function schedulePreparedOrderSync(userId: string, sessionId: string) {
  scheduleQueuedImportTask(getPrepareOrderTaskKey(sessionId), async () => {
    await syncPreparedOrderForImportSession(userId, sessionId)
  })
}

function scoreCandidateProduct(
  product: CandidateProductSearchRow,
  normalizedName: string,
  platform: PlatformCode | null
) {
  const directScore = scoreCandidateName(normalizedName, product.normalizedName)
  const aliasScores = product.aliases.map((alias) => {
    const aliasScore = scoreCandidateName(normalizedName, alias.normalizedName)

    if (aliasScore === 0) {
      return 0
    }

    return alias.platform === platform ? Math.min(aliasScore + 4, 97) : aliasScore
  })

  return Math.max(directScore, ...aliasScores, 0)
}

async function loadCandidateProductPool(
  client: DatabaseClient,
  userId: string,
  rawNames: string[],
  platform: PlatformCode | null
) {
  const searchTerms = [
    ...new Set(
      rawNames
        .map((rawName) => normalizeProductName(rawName))
        .filter((value): value is string => Boolean(value))
        .flatMap((normalizedName) => buildCandidateSearchTerms(normalizedName))
    )
  ].slice(0, 24)

  if (searchTerms.length === 0) {
    return []
  }

  const orConditions = searchTerms.flatMap((term) => [
    {
      normalizedName: {
        contains: term,
        mode: "insensitive" as const
      }
    },
    {
      aliases: {
        some: {
          normalizedName: {
            contains: term,
            mode: "insensitive" as const
          },
          ...(platform ? { platform } : {})
        }
      }
    }
  ])

  return client.product.findMany({
    where: {
      userId,
      OR: orConditions
    },
    take: CANDIDATE_POOL_LIMIT,
    select: {
      id: true,
      normalizedName: true,
      lastPurchasedAt: true,
      aliases: {
        where: platform ? { platform } : undefined,
        select: {
          normalizedName: true,
          platform: true
        }
      }
    }
  })
}

async function findCandidateMatchesForItems(
  client: DatabaseClient,
  userId: string,
  rawNames: string[],
  platform: PlatformCode | null
): Promise<CandidateMatch[][]> {
  const candidatePool = await loadCandidateProductPool(client, userId, rawNames, platform)

  return rawNames.map((rawName) => {
    const normalizedName = normalizeProductName(rawName)

    if (!normalizedName) {
      return []
    }

    return candidatePool
      .map<CandidateMatch>((product) => ({
        id: product.id,
        score: scoreCandidateProduct(product, normalizedName, platform),
        lastPurchasedAt: product.lastPurchasedAt
      }))
      .filter((product) => product.score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score
        }

        return (right.lastPurchasedAt?.getTime() ?? 0) - (left.lastPurchasedAt?.getTime() ?? 0)
      })
      .slice(0, 5)
  })
}

async function recomputeImportSessionStatus(
  tx: TransactionClient,
  sessionId: string
): Promise<ImportSessionStatus> {
  const session = await tx.importSession.findUnique({
    where: {
      id: sessionId
    },
    select: {
      status: true,
      selectedPlatform: true,
      selectedOrderedAt: true,
      preparedOrderBuiltAt: true,
      itemDrafts: {
        select: {
          rawName: true,
          priceAmount: true,
          quantity: true,
          specText: true,
          weightGrams: true,
          selectedProductId: true,
          createNewProduct: true,
          manualDisplayName: true,
          manualCategoryId: true
        }
      }
    }
  })

  if (!session) {
    throw new RouteError("NOT_FOUND", "Import session not found.", 404)
  }

  if (session.status === "COMMITTED") {
    return "COMMITTED"
  }

  let nextStatus: ImportSessionStatus = "DRAFT"

  if (session.itemDrafts.length > 0) {
    const allDraftsReady = session.itemDrafts.every((draft) =>
      isDraftReadyForCommit({
        rawName: draft.rawName,
        priceAmount: draft.priceAmount,
        quantity: draft.quantity,
        specText: draft.specText,
        weightGrams: draft.weightGrams,
        selectedProductId: draft.selectedProductId,
        createNewProduct: draft.createNewProduct,
        manualDisplayName: draft.manualDisplayName,
        manualCategoryId: draft.manualCategoryId
      })
    )

    nextStatus =
      allDraftsReady && session.selectedPlatform && session.selectedOrderedAt
        ? session.preparedOrderBuiltAt
          ? "READY_TO_COMMIT"
          : "PROCESSING"
        : "REVIEW_REQUIRED"
  }

  await tx.importSession.update({
    where: {
      id: sessionId
    },
    data: {
      status: nextStatus
    }
  })

  return nextStatus
}

async function ensureImportSessionOwned(
  client: DatabaseClient,
  userId: string,
  sessionId: string
) {
  const session = await client.importSession.findFirst({
    where: {
      id: sessionId,
      userId
    },
    select: {
      id: true,
      status: true,
      selectedPlatform: true,
      platformGuess: true,
      preparedOrderId: true
    }
  })

  if (!session) {
    throw new RouteError("NOT_FOUND", "Import session not found.", 404)
  }

  return session
}

export async function createImportSessionForUser(
  userId: string,
  input: CreateImportSessionRequest
) {
  const createSession = () =>
    prisma.importSession.create({
      data: {
        userId,
        platformGuess: input.initialPlatform ?? null,
        selectedPlatform: input.initialPlatform ?? null
      },
      select: {
        id: true,
        status: true
      }
    })

  let importSession

  try {
    importSession = await createSession()
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2024"
    ) {
      await new Promise((resolve) => setTimeout(resolve, 120))
      importSession = await createSession()
    } else {
      throw error
    }
  }

  return {
    importSessionId: importSession.id,
    status: importSession.status
  }
}

export async function uploadImportImagesForUser(
  userId: string,
  sessionId: string,
  uploads: Array<{
    file: File
    pageIndex: number
  }>
) {
  const session = await ensureImportSessionOwned(prisma, userId, sessionId)

  if (session.status === "COMMITTED") {
    throw new RouteError(
      "IMPORT_ALREADY_COMMITTED",
      "Import session has already been committed.",
      409
    )
  }

  const uniquePageIndexes = new Set<number>()

  for (const upload of uploads) {
    if (uniquePageIndexes.has(upload.pageIndex)) {
      throw createValidationError("Request validation failed.", {
        pageIndexes: "Duplicate pageIndex values are not allowed."
      })
    }

    uniquePageIndexes.add(upload.pageIndex)
  }

  const existingImages = await prisma.importImage.findMany({
    where: {
      importSessionId: sessionId,
      pageIndex: {
        in: [...uniquePageIndexes]
      }
    },
    select: {
      id: true,
      pageIndex: true,
      storagePath: true
    }
  })
  const existingByPageIndex = new Map(existingImages.map((image) => [image.pageIndex, image]))
  const uploaded = await Promise.all(
    uploads.map(async (upload) => {
      const existingImage = existingByPageIndex.get(upload.pageIndex)
      const storedImage = await uploadImportImageFile({
        userId,
        importSessionId: sessionId,
        pageIndex: upload.pageIndex,
        file: upload.file,
        previousStoragePath: existingImage?.storagePath
      })
      const imageRecord = await prisma.importImage.upsert({
        where: {
          importSessionId_pageIndex: {
            importSessionId: sessionId,
            pageIndex: upload.pageIndex
          }
        },
        update: {
          storagePath: storedImage.storagePath
        },
        create: {
          importSessionId: sessionId,
          pageIndex: upload.pageIndex,
          storagePath: storedImage.storagePath
        },
        select: {
          id: true,
          pageIndex: true
        }
      })

      return {
        imageId: imageRecord.id,
        pageIndex: imageRecord.pageIndex,
        imageUrl: storedImage.imageUrl
      }
    })
  )

  if (session.preparedOrderId) {
    await cleanupPreparedOrderDraft(session.preparedOrderId)
    await prisma.importSession.update({
      where: {
        id: sessionId
      },
      data: {
        preparedOrderId: null,
        preparedOrderBuiltAt: null
      }
    })
  }

  const analyzeResult = await analyzeImportSessionForUser(userId, sessionId, {
    forceReanalyze: true
  })

  return {
    importSessionId: sessionId,
    status: analyzeResult.status,
    uploaded
  }
}

type UploadImportImagesResult = {
  importSessionId: string
  status: ImportSessionStatus
  uploaded: Array<{
    imageId: string
    pageIndex: number
    imageUrl: string
  }>
}

export async function getImportSessionDetailForUser(userId: string, sessionId: string) {
  const session = await prisma.importSession.findFirst({
    where: {
      id: sessionId,
      userId
    },
    include: {
      images: {
        orderBy: {
          pageIndex: "asc"
        }
      },
      itemDrafts: {
        include: {
          guessedCategory: {
            select: {
              id: true,
              code: true,
              name: true
            }
          }
        },
        orderBy: [
          {
            pageIndex: "asc"
          },
          {
            createdAt: "asc"
          }
        ]
      }
    }
  })

  if (!session) {
    throw new RouteError("NOT_FOUND", "Import session not found.", 404)
  }

  const uniqueCandidateProductIds = [
    ...new Set(
      session.itemDrafts.flatMap((draft) => parseCandidateProductIds(draft.candidateProductIds))
    )
  ]
  const candidateProducts =
    uniqueCandidateProductIds.length > 0
      ? await prisma.product.findMany({
          where: {
            userId,
            id: {
              in: uniqueCandidateProductIds
            }
          },
          include: {
            category: {
              select: {
                id: true,
                code: true,
                name: true
              }
            }
          }
        })
      : []
  const candidateProductMap = new Map(
    candidateProducts.map((product) => [
      product.id,
      {
        id: product.id,
        displayName: product.displayName,
        category: product.category,
        specText: product.specText,
        primaryImageUrl: product.primaryImageUrl
      }
    ])
  )

  return {
    id: session.id,
    status: session.status,
    isAnalyzing: isBackgroundTaskRunning(getAnalyzeTaskKey(session.id)),
    isPreparingCommit: isBackgroundTaskRunning(getPrepareOrderTaskKey(session.id)),
    errorMessage: session.errorMessage,
    platformGuess: session.platformGuess ? toPlatformOption(session.platformGuess as PlatformCode) : null,
    selectedPlatform: session.selectedPlatform
      ? toPlatformOption(session.selectedPlatform as PlatformCode)
      : null,
    orderedAtGuess: session.orderedAtGuess?.toISOString() ?? null,
    selectedOrderedAt: session.selectedOrderedAt?.toISOString() ?? null,
    note: session.note,
    images: await Promise.all(
      session.images.map(async (image) => ({
        id: image.id,
        pageIndex: image.pageIndex,
        imageUrl: await getImportImageUrl(image.storagePath)
      }))
    ),
    itemDrafts: session.itemDrafts.map((draft) => ({
      id: draft.id,
      pageIndex: draft.pageIndex,
      rawName: draft.rawName,
      normalizedName: draft.normalizedName,
      guessedCategory: draft.guessedCategory,
      priceAmount: draft.priceAmount,
      quantity: toQuantityString(draft.quantity),
      specText: draft.specText,
      weightGrams: draft.weightGrams,
      pricePer100g: draft.pricePer100g,
      candidateProducts: parseCandidateProductIds(draft.candidateProductIds)
        .map((candidateId) => candidateProductMap.get(candidateId))
        .filter((item): item is NonNullable<typeof item> => Boolean(item)),
      selectedProductId: draft.selectedProductId,
      createNewProduct: draft.createNewProduct,
      manualDisplayName: draft.manualDisplayName,
      manualCategoryId: draft.manualCategoryId,
      manualNote: draft.manualNote,
      reviewStatus: draft.reviewStatus
    })),
    committedOrderId: session.committedOrderId
  }
}

export async function updateImportSessionForUser(
  userId: string,
  sessionId: string,
  input: UpdateImportSessionRequest
) {
  const session = await ensureImportSessionOwned(prisma, userId, sessionId)

  if (session.status === "COMMITTED") {
    throw new RouteError(
      "IMPORT_ALREADY_COMMITTED",
      "Import session has already been committed.",
      409
    )
  }

  await prisma.$transaction(async (tx) => {
    await tx.importSession.update({
      where: {
        id: sessionId
      },
      data: {
        ...(input.selectedPlatform ? { selectedPlatform: input.selectedPlatform } : {}),
        ...(input.selectedOrderedAt
          ? { selectedOrderedAt: new Date(input.selectedOrderedAt) }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(input, "note")
          ? { note: normalizeOptionalText(input.note) }
          : {}),
        preparedOrderBuiltAt: null
      }
    })

    await recomputeImportSessionStatus(tx, sessionId)
  }, {
    maxWait: IMPORT_TRANSACTION_MAX_WAIT_MS,
    timeout: IMPORT_TRANSACTION_TIMEOUT_MS
  })

  schedulePreparedOrderSync(userId, sessionId)

  return {
    importSessionId: sessionId
  }
}

export async function updateImportItemDraftForUser(
  userId: string,
  draftId: string,
  input: UpdateImportItemDraftRequest
) {
  const draft = await prisma.importItemDraft.findFirst({
    where: {
      id: draftId,
      importSession: {
        userId
      }
    },
    select: {
      id: true,
      importSessionId: true,
      rawName: true,
      priceAmount: true,
      quantity: true,
      specText: true,
      weightGrams: true,
      selectedProductId: true,
      createNewProduct: true,
      manualDisplayName: true,
      manualCategoryId: true,
      manualNote: true
    }
  })

  if (!draft) {
    throw new RouteError("NOT_FOUND", "Import item draft not found.", 404)
  }

  await prisma.$transaction(async (tx) => {
    await applyImportDraftUpdate(tx, userId, draft, input)
    await tx.importSession.update({
      where: {
        id: draft.importSessionId
      },
      data: {
        preparedOrderBuiltAt: null
      }
    })
    await recomputeImportSessionStatus(tx, draft.importSessionId)
  }, {
    maxWait: IMPORT_TRANSACTION_MAX_WAIT_MS,
    timeout: IMPORT_TRANSACTION_TIMEOUT_MS
  })

  schedulePreparedOrderSync(userId, draft.importSessionId)

  const refreshedDraft = await prisma.importItemDraft.findUnique({
    where: {
      id: draftId
    },
    select: {
      id: true,
      reviewStatus: true,
      pricePer100g: true
    }
  })

  if (!refreshedDraft) {
    throw new RouteError("NOT_FOUND", "Import item draft not found.", 404)
  }

  return {
    importItemDraftId: refreshedDraft.id,
    reviewStatus: refreshedDraft.reviewStatus,
    pricePer100g: refreshedDraft.pricePer100g
  }
}

export async function updateImportItemDraftsForUser(
  userId: string,
  sessionId: string,
  input: UpdateImportItemDraftsRequest
) {
  const session = await ensureImportSessionOwned(prisma, userId, sessionId)

  if (session.status === "COMMITTED") {
    throw new RouteError(
      "IMPORT_ALREADY_COMMITTED",
      "Import session has already been committed.",
      409
    )
  }

  const draftIds = [...new Set(input.drafts.map((draft) => draft.id))]
  const drafts = await prisma.importItemDraft.findMany({
    where: {
      id: {
        in: draftIds
      },
      importSessionId: sessionId,
      importSession: {
        userId
      }
    },
    select: {
      id: true,
      importSessionId: true,
      rawName: true,
      priceAmount: true,
      quantity: true,
      specText: true,
      weightGrams: true,
      selectedProductId: true,
      createNewProduct: true,
      manualDisplayName: true,
      manualCategoryId: true,
      manualNote: true
    }
  })

  if (drafts.length !== draftIds.length) {
    throw createValidationError("Request validation failed.", {
      drafts: "Some draft items no longer exist."
    })
  }

  const draftById = new Map(drafts.map((draft) => [draft.id, draft]))

  await prisma.$transaction(async (tx) => {
    for (const entry of input.drafts) {
      const draft = draftById.get(entry.id)

      if (!draft) {
        throw createValidationError("Request validation failed.", {
          [`drafts.${entry.id}`]: "Draft item does not exist."
        })
      }

      await applyImportDraftUpdate(tx, userId, draft, entry.body)
    }

    await tx.importSession.update({
      where: {
        id: sessionId
      },
      data: {
        preparedOrderBuiltAt: null
      }
    })
    await recomputeImportSessionStatus(tx, sessionId)
  }, {
    maxWait: IMPORT_TRANSACTION_MAX_WAIT_MS,
    timeout: IMPORT_TRANSACTION_TIMEOUT_MS
  })

  schedulePreparedOrderSync(userId, sessionId)

  return {
    importSessionId: sessionId,
    updatedDraftIds: draftIds
  }
}

async function performAnalyzeImportSessionForUser(userId: string, sessionId: string) {
  const session = await prisma.importSession.findFirst({
    where: {
      id: sessionId,
      userId
    },
    include: {
      images: {
        orderBy: {
          pageIndex: "asc"
        }
      },
      itemDrafts: {
        select: {
          id: true
        }
      }
    }
  })

  if (!session) {
    throw new RouteError("NOT_FOUND", "Import session not found.", 404)
  }

  if (session.status === "COMMITTED") {
    throw new RouteError(
      "IMPORT_ALREADY_COMMITTED",
      "Import session has already been committed.",
      409
    )
  }

  if (session.images.length === 0) {
    await prisma.importSession.update({
      where: {
        id: sessionId
      },
      data: {
        status: "FAILED",
        errorMessage: "Upload at least one image before running analyze."
      }
    })

    return
  }

  try {
    const visionExecutionMode = getVisionExecutionMode()
    const analysisInput = {
      images:
        visionExecutionMode === "manual"
          ? session.images.map((image) => ({
              pageIndex: image.pageIndex
            }))
          : await Promise.all(
              session.images.map(async (image) => ({
                pageIndex: image.pageIndex,
                imageUrl: await getImportImageUrl(image.storagePath)
              }))
            ),
      initialPlatform:
        (session.selectedPlatform as PlatformCode | null) ??
        (session.platformGuess as PlatformCode | null)
    }
    const analysis = await analyzeOrderImages(analysisInput)
    const orderedAtGuess = toOptionalDate(analysis.orderedAtGuess)
    const analyzedItems =
      analysis.itemDrafts.length > 0
        ? analysis.itemDrafts
        : analysisInput.images.map((image) => ({
            pageIndex: image.pageIndex,
            rawName: `截图第 ${image.pageIndex + 1} 页待人工补录商品`,
            guessedCategoryCode: null,
            priceAmount: null,
            quantity: null,
            specText: null,
            weightGrams: null
          }))
    const resolvedPlatform =
      (analysis.platformGuess as PlatformCode | null) ??
      ((session.selectedPlatform as PlatformCode | null) ??
        (session.platformGuess as PlatformCode | null))
    const candidateMatchGroups =
      visionExecutionMode === "manual"
        ? analyzedItems.map(() => [])
        : await findCandidateMatchesForItems(
            prisma,
            userId,
            analyzedItems.map((item) => item.rawName),
            resolvedPlatform
          )

    const status = await prisma.$transaction(async (tx) => {
      if (session.itemDrafts.length > 0) {
        await tx.importItemDraft.deleteMany({
          where: {
            importSessionId: sessionId
          }
        })
      }

      const categoryCodes = [
        ...new Set(
          analyzedItems
            .map((item) => item.guessedCategoryCode?.trim())
            .filter((item): item is string => Boolean(item))
        )
      ]
      const categories =
        categoryCodes.length > 0
          ? await tx.category.findMany({
              where: {
                code: {
                  in: categoryCodes
                },
                isActive: true
              },
              select: {
                id: true,
                code: true
              }
            })
          : []
      const categoryIdByCode = new Map(categories.map((category) => [category.code, category.id]))

      for (const [index, item] of analyzedItems.entries()) {
        const candidateMatches = candidateMatchGroups[index] ?? []
        const candidateProductIds = candidateMatches.map((product) => product.id)
        const guessedCategoryId =
          item.guessedCategoryCode == null
            ? null
            : (categoryIdByCode.get(item.guessedCategoryCode) ?? null)
        const autoSelectedProductId =
          candidateMatches[0] && candidateMatches[0].score >= 95
            ? candidateMatches[0].id
            : null
        const createNewProduct = !autoSelectedProductId && Boolean(guessedCategoryId)
        const manualDisplayName = createNewProduct ? item.rawName.trim() : null
        const pricePer100g =
          item.priceAmount == null
            ? null
            : calculatePricePer100g({
                linePriceAmount: item.priceAmount,
                quantity: item.quantity,
                weightGrams: item.weightGrams
              })

        await tx.importItemDraft.create({
          data: {
            importSessionId: sessionId,
            pageIndex: item.pageIndex,
            rawName: item.rawName.trim(),
            normalizedName: normalizeProductName(manualDisplayName ?? item.rawName) || null,
            guessedCategoryId,
            priceAmount: item.priceAmount,
            quantity: item.quantity == null ? null : new Prisma.Decimal(item.quantity),
            specText: normalizeOptionalText(item.specText),
            weightGrams: item.weightGrams,
            pricePer100g,
            candidateProductIds: candidateProductIds as unknown as Prisma.InputJsonValue,
            selectedProductId: autoSelectedProductId,
            createNewProduct,
            manualDisplayName,
            manualCategoryId: createNewProduct ? guessedCategoryId : null,
            reviewStatus: deriveDraftReviewStatus({
              rawName: item.rawName,
              priceAmount: item.priceAmount,
              quantity: item.quantity,
              specText: normalizeOptionalText(item.specText),
              weightGrams: item.weightGrams,
              selectedProductId: autoSelectedProductId,
              createNewProduct,
              manualDisplayName,
              manualCategoryId: createNewProduct ? guessedCategoryId : null
            })
          }
        })
      }

      await tx.importSession.update({
        where: {
          id: sessionId
        },
        data: {
          platformGuess: analysis.platformGuess,
          orderedAtGuess,
          ...(!session.selectedPlatform && analysis.platformGuess
            ? { selectedPlatform: analysis.platformGuess }
            : {}),
          ...(!session.selectedOrderedAt && orderedAtGuess
            ? { selectedOrderedAt: orderedAtGuess }
            : {}),
          rawModelResponse: analysis.rawModelResponse as Prisma.InputJsonValue,
          errorMessage: null,
          preparedOrderBuiltAt: null
        }
      })

      return recomputeImportSessionStatus(tx, sessionId)
    }, {
      maxWait: IMPORT_TRANSACTION_MAX_WAIT_MS,
      timeout: IMPORT_TRANSACTION_TIMEOUT_MS
    })

    schedulePreparedOrderSync(userId, sessionId)

    return {
      importSessionId: sessionId,
      status
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to analyze import session."

    await prisma.importSession.update({
      where: {
        id: sessionId
      },
      data: {
        status: "FAILED",
        errorMessage: message
      }
    })

    throw error
  }
}

export async function analyzeImportSessionForUser(
  userId: string,
  sessionId: string,
  input: AnalyzeImportSessionRequest
) {
  const session = await prisma.importSession.findFirst({
    where: {
      id: sessionId,
      userId
    },
    include: {
      images: {
        select: {
          id: true
        }
      },
      itemDrafts: {
        select: {
          id: true
        }
      }
    }
  })

  if (!session) {
    throw new RouteError("NOT_FOUND", "Import session not found.", 404)
  }

  if (session.status === "COMMITTED") {
    throw new RouteError(
      "IMPORT_ALREADY_COMMITTED",
      "Import session has already been committed.",
      409
    )
  }

  if (session.images.length === 0) {
    throw createValidationError("Request validation failed.", {
      images: "Upload at least one image before running analyze."
    })
  }

  if (session.itemDrafts.length > 0 && !input.forceReanalyze) {
    return {
      importSessionId: sessionId,
      status: session.status
    }
  }

  const taskKey = getAnalyzeTaskKey(sessionId)

  if (isBackgroundTaskRunning(taskKey)) {
    if (input.forceReanalyze) {
      scheduleAnalyzeImportSession(userId, sessionId)
    }

    return {
      importSessionId: sessionId,
      status: "PROCESSING" as const
    }
  }

  await prisma.importSession.update({
    where: {
      id: sessionId
    },
    data: {
      status: "PROCESSING",
      errorMessage: null
    }
  })

  scheduleAnalyzeImportSession(userId, sessionId)

  return {
    importSessionId: sessionId,
    status: "PROCESSING" as const
  }
}

async function finalizeCommittedImportSession(args: {
  userId: string
  sessionId: string
  orderId: string
  platform: Platform
  skipImageSync?: boolean
  markImportedProductsInStock: boolean
}) {
  const copiedStoragePaths: string[] = []
  let orderImagesPersisted = false

  try {
    const committedSession = await prisma.importSession.findFirst({
      where: {
        id: args.sessionId,
        userId: args.userId,
        committedOrderId: args.orderId
      },
      select: {
        images: {
          select: {
            storagePath: true,
            pageIndex: true
          },
          orderBy: {
            pageIndex: "asc"
          }
        },
        itemDrafts: {
          select: {
            id: true,
            rawName: true,
            selectedProductId: true,
            createNewProduct: true,
            manualDisplayName: true,
            manualCategoryId: true,
            manualNote: true,
            specText: true
          },
          orderBy: [
            {
              pageIndex: "asc"
            },
            {
              createdAt: "asc"
            }
          ]
        }
      }
    })

    if (!committedSession) {
      throw new RouteError("NOT_FOUND", "Committed import session not found.", 404)
    }

    if (!args.skipImageSync && committedSession.images.length > 0) {
      const copiedImages = await Promise.all(
        committedSession.images.map(async (image) => {
          const storagePath = await copyImportImageToOrderStorage({
            sourceStoragePath: image.storagePath,
            userId: args.userId,
            orderId: args.orderId,
            pageIndex: image.pageIndex
          })

          copiedStoragePaths.push(storagePath)

          return {
            orderId: args.orderId,
            pageIndex: image.pageIndex,
            storagePath
          }
        })
      )

      await prisma.orderImage.createMany({
        data: copiedImages,
        skipDuplicates: true
      })

      orderImagesPersisted = true
    }

    const committedOrderItems = await prisma.orderItem.findMany({
      where: {
        orderId: args.orderId,
        sourceImportItemDraftId: {
          in: committedSession.itemDrafts.map((draft) => draft.id)
        }
      },
      select: {
        id: true,
        sourceImportItemDraftId: true
      }
    })
    const orderItemIdByDraftId = new Map(
      committedOrderItems.flatMap((orderItem) =>
        orderItem.sourceImportItemDraftId
          ? [[orderItem.sourceImportItemDraftId, orderItem.id] as const]
          : []
      )
    )
    const resolutionResult = await prisma.$transaction(async (tx) => {
      const inventoryProductIdsToMarkInStock = new Set<string>()
      const aliasEntries = new Map<string, { productId: string; rawName: string }>()
      const touchedProductIds = new Set<string>()

      for (const draft of committedSession.itemDrafts) {
        const orderItemId = orderItemIdByDraftId.get(draft.id)

        if (!orderItemId) {
          continue
        }

        let productId: string | null = null
        let resolutionStatus: "MATCHED_EXISTING" | "CREATED_NEW_PRODUCT" | null = null
        let isNewProductAtImport = false

        if (draft.selectedProductId) {
          const product = await ensureOwnedProduct(
            tx,
            args.userId,
            draft.selectedProductId,
            `itemDrafts.${draft.id}.selectedProductId`
          )

          productId = product.id
          resolutionStatus = "MATCHED_EXISTING"

          if (args.markImportedProductsInStock) {
            inventoryProductIdsToMarkInStock.add(product.id)
          }
        } else if (draft.createNewProduct && draft.manualDisplayName && draft.manualCategoryId) {
          const product = await createProductInsideImportCommit(
            tx,
            args.userId,
            {
              manualDisplayName: draft.manualDisplayName,
              manualCategoryId: draft.manualCategoryId,
              manualNote: draft.manualNote,
              specText: draft.specText
            },
            args.markImportedProductsInStock ? "SUFFICIENT" : "UNKNOWN"
          )

          productId = product.id
          resolutionStatus = "CREATED_NEW_PRODUCT"
          isNewProductAtImport = true
        }

        if (!productId || !resolutionStatus) {
          continue
        }

        await tx.orderItem.update({
          where: {
            id: orderItemId
          },
          data: {
            productId,
            resolutionStatus,
            isNewProductAtImport
          }
        })

        touchedProductIds.add(productId)
        aliasEntries.set(`${productId}::${draft.rawName}`, {
          productId,
          rawName: draft.rawName
        })
      }

      if (inventoryProductIdsToMarkInStock.size > 0) {
        await tx.product.updateMany({
          where: {
            userId: args.userId,
            id: {
              in: [...inventoryProductIdsToMarkInStock]
            }
          },
          data: {
            inventoryStatus: "SUFFICIENT"
          }
        })
      }

      return {
        aliasEntries: [...aliasEntries.values()],
        touchedProductIds: [...touchedProductIds]
      }
    }, {
      maxWait: IMPORT_TRANSACTION_MAX_WAIT_MS,
      timeout: IMPORT_COMMIT_TRANSACTION_TIMEOUT_MS
    })

    for (const { productId, rawName } of resolutionResult.aliasEntries) {
      await upsertProductAlias(prisma, productId, args.platform, rawName)
    }

    for (const productId of resolutionResult.touchedProductIds) {
      await refreshProductOrderAggregates(prisma, args.userId, productId, args.platform)
    }

    await prisma.importSession.update({
      where: {
        id: args.sessionId
      },
      data: {
        errorMessage: null
      }
    })
  } catch (error) {
    if (!orderImagesPersisted && copiedStoragePaths.length > 0) {
      await deleteOrderImagesFromStorage(copiedStoragePaths)
    }

    await prisma.importSession.update({
      where: {
        id: args.sessionId
      },
      data: {
        errorMessage:
          error instanceof Error
            ? `Post-commit processing failed: ${error.message}`
            : "Post-commit processing failed."
      }
    })

    throw error
  }
}

export async function commitImportSessionForUser(
  userId: string,
  sessionId: string,
  input: CommitImportSessionRequest
) {
  const session = await prisma.importSession.findFirst({
    where: {
      id: sessionId,
      userId
    },
    select: {
      id: true,
      status: true,
      note: true,
      preparedOrderId: true,
      preparedOrderBuiltAt: true,
      selectedPlatform: true,
      selectedOrderedAt: true,
      _count: {
        select: {
          itemDrafts: true
        }
      }
    }
  })

  if (!session) {
    throw new RouteError("NOT_FOUND", "Import session not found.", 404)
  }

  if (session.status === "COMMITTED") {
    throw new RouteError(
      "IMPORT_ALREADY_COMMITTED",
      "Import session has already been committed.",
      409
    )
  }

  const fieldErrors: Record<string, string> = {}

  if (!session.selectedPlatform) {
    fieldErrors.selectedPlatform = "Please confirm the order platform."
  }

  if (!session.selectedOrderedAt) {
    fieldErrors.selectedOrderedAt = "Please confirm the order datetime."
  }

  if (session._count.itemDrafts === 0) {
    fieldErrors.itemDrafts = "At least one imported item is required."
  }

  if (session.status !== "READY_TO_COMMIT") {
    fieldErrors.status = "AI is still preparing the order. Please wait for analysis to finish."
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new RouteError(
      "IMPORT_NOT_READY",
      "Import session is not ready to commit.",
      409,
      fieldErrors
    )
  }

  if (!session.preparedOrderId || !session.preparedOrderBuiltAt) {
    throw new RouteError(
      "CONFLICT",
      "Prepared order is not ready yet. Refresh the import session and try again.",
      409
    )
  }

  const preparedOrderId = session.preparedOrderId
  const publishResult = await prisma.$queryRaw<
    Array<{ orderCount: number; sessionCount: number }>
  >(Prisma.sql`
    WITH updated_order AS (
      UPDATE "orders"
      SET
        "status" = CAST('ACTIVE' AS "OrderStatus"),
        "platform" = CAST(${session.selectedPlatform!} AS "Platform"),
        "orderedAt" = ${session.selectedOrderedAt!},
        "note" = ${normalizeOptionalText(session.note)},
        "updatedAt" = NOW()
      WHERE
        "id" = ${preparedOrderId}
        AND "userId" = ${userId}
        AND "status" = CAST('DRAFT' AS "OrderStatus")
      RETURNING "id"
    ),
    updated_session AS (
      UPDATE "import_sessions"
      SET
        "status" = CAST('COMMITTED' AS "ImportSessionStatus"),
        "preparedOrderId" = NULL,
        "preparedOrderBuiltAt" = NULL,
        "committedOrderId" = ${preparedOrderId},
        "errorMessage" = NULL,
        "updatedAt" = NOW()
      WHERE
        "id" = ${sessionId}
        AND "userId" = ${userId}
        AND "preparedOrderId" = ${preparedOrderId}
        AND "status" = CAST('READY_TO_COMMIT' AS "ImportSessionStatus")
      RETURNING "id"
    )
    SELECT
      (SELECT COUNT(*)::int FROM updated_order) AS "orderCount",
      (SELECT COUNT(*)::int FROM updated_session) AS "sessionCount"
  `)
  const counts = publishResult[0]

  if (!counts || Number(counts.orderCount) !== 1 || Number(counts.sessionCount) !== 1) {
    throw new RouteError(
      "CONFLICT",
      "Prepared order is no longer available. Refresh the import session and try again.",
      409
    )
  }

  startBackgroundTask(getCommitTaskKey(sessionId), async () => {
    await finalizeCommittedImportSession({
      userId,
      sessionId,
      orderId: preparedOrderId,
      platform: session.selectedPlatform!,
      skipImageSync: true,
      markImportedProductsInStock: input.markImportedProductsInStock ?? false
    })
  })

  return {
    orderId: preparedOrderId,
    importSessionId: sessionId,
    createdProductIds: [],
    linkedProductIds: []
  }
}

export async function confirmImportSessionForUser(
  userId: string,
  sessionId: string,
  input: ConfirmImportSessionRequest
) {
  const session = await ensureImportSessionOwned(prisma, userId, sessionId)

  if (session.status === "COMMITTED") {
    throw new RouteError(
      "IMPORT_ALREADY_COMMITTED",
      "Import session has already been committed.",
      409
    )
  }

  const hasSessionPatch =
    Object.prototype.hasOwnProperty.call(input, "selectedPlatform") ||
    Object.prototype.hasOwnProperty.call(input, "selectedOrderedAt") ||
    Object.prototype.hasOwnProperty.call(input, "note")
  const hasDraftPatch = (input.drafts?.length ?? 0) > 0

  if (hasSessionPatch || hasDraftPatch) {
    await prisma.$transaction(async (tx) => {
      if (hasSessionPatch) {
        await tx.importSession.update({
          where: {
            id: sessionId
          },
          data: {
            ...(Object.prototype.hasOwnProperty.call(input, "selectedPlatform")
              ? { selectedPlatform: input.selectedPlatform ?? null }
              : {}),
            ...(Object.prototype.hasOwnProperty.call(input, "selectedOrderedAt")
              ? {
                  selectedOrderedAt: input.selectedOrderedAt
                    ? new Date(input.selectedOrderedAt)
                    : null
                }
              : {}),
            ...(Object.prototype.hasOwnProperty.call(input, "note")
              ? { note: normalizeOptionalText(input.note) }
              : {}),
            preparedOrderBuiltAt: null
          }
        })
      }

      if (hasDraftPatch) {
        const draftEntries = input.drafts ?? []
        const draftIds = [...new Set(draftEntries.map((draft) => draft.id))]
        const drafts = await tx.importItemDraft.findMany({
          where: {
            id: {
              in: draftIds
            },
            importSessionId: sessionId,
            importSession: {
              userId
            }
          },
          select: {
            id: true,
            importSessionId: true,
            rawName: true,
            priceAmount: true,
            quantity: true,
            specText: true,
            weightGrams: true,
            selectedProductId: true,
            createNewProduct: true,
            manualDisplayName: true,
            manualCategoryId: true,
            manualNote: true
          }
        })

        if (drafts.length !== draftIds.length) {
          throw createValidationError("Request validation failed.", {
            drafts: "Some draft items no longer exist."
          })
        }

        const draftById = new Map(drafts.map((draft) => [draft.id, draft]))

        for (const entry of draftEntries) {
          const draft = draftById.get(entry.id)

          if (!draft) {
            throw createValidationError("Request validation failed.", {
              [`drafts.${entry.id}`]: "Draft item does not exist."
            })
          }

          await applyImportDraftUpdate(tx, userId, draft, entry.body)
        }

        if (!hasSessionPatch) {
          await tx.importSession.update({
            where: {
              id: sessionId
            },
            data: {
              preparedOrderBuiltAt: null
            }
          })
        }
      }

      await recomputeImportSessionStatus(tx, sessionId)
    }, {
      maxWait: IMPORT_TRANSACTION_MAX_WAIT_MS,
      timeout: IMPORT_TRANSACTION_TIMEOUT_MS
    })

    await syncPreparedOrderForImportSession(userId, sessionId)
  }

  return commitImportSessionForUser(userId, sessionId, {
    markImportedProductsInStock: input.markImportedProductsInStock
  })
}

export async function getCommittedOrderImagesForImportSession(userId: string, sessionId: string) {
  const session = await prisma.importSession.findFirst({
    where: {
      id: sessionId,
      userId
    },
    select: {
      committedOrder: {
        select: {
          images: {
            select: {
              id: true,
              pageIndex: true,
              storagePath: true
            },
            orderBy: {
              pageIndex: "asc"
            }
          }
        }
      }
    }
  })

  return Promise.all(
    (session?.committedOrder?.images ?? []).map(async (image) => ({
      id: image.id,
      pageIndex: image.pageIndex,
      imageUrl: await getOrderImageUrl(image.storagePath)
    }))
  )
}

import type { CreateOrderRequest, OrdersListQuery, UpdateOrderRequest } from "@life-assistant/contracts"
import { prisma, Prisma, type Platform } from "@life-assistant/db"
import { calculatePricePer100g, normalizeProductName } from "@life-assistant/domain"
import { getPlatformLabel, type PlatformCode } from "@life-assistant/shared"

import { isBackgroundTaskRunning } from "../background-tasks"
import {
  ensureActiveCategory,
  ensureActiveTagIds,
  normalizeOptionalText
} from "../catalog"
import { ensureOwnedProduct, upsertProductAlias, refreshProductOrderAggregates } from "../products/helpers"
import { RouteError, createValidationError } from "../route-error"
import { getOrderImageUrl } from "../storage"

type TransactionClient = Prisma.TransactionClient
const IMPORT_COMMIT_TASK_PREFIX = "import-commit"

function getImportCommitTaskKey(sessionId: string) {
  return `${IMPORT_COMMIT_TASK_PREFIX}:${sessionId}`
}

async function createProductInsideOrder(
  tx: TransactionClient,
  userId: string,
  input: CreateOrderRequest["items"][number] & { mode: "new_product" },
  itemIndex: number
) {
  await ensureActiveCategory(tx, input.newProduct.categoryId)
  const tagIds = await ensureActiveTagIds(tx, input.newProduct.tagIds ?? [])

  const product = await tx.product.create({
    data: {
      userId,
      categoryId: input.newProduct.categoryId,
      displayName: input.newProduct.displayName.trim(),
      normalizedName: normalizeProductName(input.newProduct.displayName),
      inventoryStatus: input.newProduct.inventoryStatus ?? "UNKNOWN",
      note: normalizeOptionalText(input.newProduct.note),
      specText: normalizeOptionalText(input.specText)
    },
    select: {
      id: true
    }
  })

  if (tagIds.length > 0) {
    await tx.productTag.createMany({
      data: tagIds.map((tagId) => ({
        productId: product.id,
        tagId
      })),
      skipDuplicates: true
    })
  }

  if (!product.id) {
    throw createValidationError("Request validation failed.", {
      [`items.${itemIndex}`]: "Failed to create product for order item."
    })
  }

  return product
}

export async function listOrdersForUser(userId: string, query: OrdersListQuery) {
  const where: Prisma.OrderWhereInput = {
    userId,
    status: "ACTIVE"
  }

  if (query.platform) {
    where.platform = query.platform
  }

  const skip = (query.page - 1) * query.pageSize

  const [total, orders] = await prisma.$transaction([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      skip,
      take: query.pageSize,
      orderBy: [
        {
          orderedAt: "desc"
        },
        {
          createdAt: "desc"
        }
      ],
      select: {
        id: true,
        platform: true,
        orderedAt: true,
        createdAt: true,
        images: {
          select: {
            storagePath: true
          },
          orderBy: {
            pageIndex: "asc"
          },
          take: 1
        },
        _count: {
          select: {
            items: true
          }
        }
      }
    })
  ])

  const items = await Promise.all(
    orders.map(async (order) => ({
      id: order.id,
      platform: {
        code: order.platform as PlatformCode,
        label: getPlatformLabel(order.platform as PlatformCode)
      },
      orderedAt: order.orderedAt.toISOString(),
      itemCount: order._count.items,
      coverImageUrl: order.images[0]
        ? await getOrderImageUrl(order.images[0].storagePath)
        : null,
      createdAt: order.createdAt.toISOString()
    }))
  )

  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    total
  }
}

export async function createOrderForUser(userId: string, input: CreateOrderRequest) {
  return prisma.$transaction(async (tx) => {
    const orderedAt = new Date(input.orderedAt)

    const order = await tx.order.create({
      data: {
        userId,
        status: "ACTIVE",
        platform: input.platform,
        orderedAt,
        note: normalizeOptionalText(input.note)
      },
      select: {
        id: true,
        platform: true
      }
    })

    const touchedProductIds = new Set<string>()

    for (const [index, item] of input.items.entries()) {
      const specText = normalizeOptionalText(item.specText)
      const quantity = new Prisma.Decimal(item.quantity)
      const pricePer100g = calculatePricePer100g({
        linePriceAmount: item.linePriceAmount,
        quantity: item.quantity,
        weightGrams: item.weightGrams ?? null
      })

      let productId: string
      let isNewProductAtImport = false

      if (item.mode === "existing_product") {
        const product = await ensureOwnedProduct(
          tx,
          userId,
          item.productId,
          `items.${index}.productId`
        )

        productId = product.id
      } else {
        const product = await createProductInsideOrder(tx, userId, item, index)
        productId = product.id
        isNewProductAtImport = true
      }

      await tx.orderItem.create({
        data: {
          orderId: order.id,
          productId,
          rawName: item.rawName.trim(),
          linePriceAmount: item.linePriceAmount,
          quantity,
          specText,
          weightGrams: item.weightGrams ?? null,
          pricePer100g,
          resolutionStatus:
            item.mode === "new_product" ? "CREATED_NEW_PRODUCT" : "MATCHED_EXISTING",
          isNewProductAtImport
        }
      })

      await upsertProductAlias(tx, productId, order.platform, item.rawName)
      touchedProductIds.add(productId)
    }

    for (const productId of touchedProductIds) {
      await refreshProductOrderAggregates(tx, userId, productId, order.platform)
    }

    return {
      orderId: order.id
    }
  })
}

export async function getOrderDetailForUser(userId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      userId,
      status: "ACTIVE"
    },
    select: {
      id: true,
      platform: true,
      orderedAt: true,
      note: true,
      sourceImport: {
        select: {
          id: true,
          errorMessage: true,
          images: {
            select: {
              id: true
            }
          }
        }
      },
      images: {
        select: {
          id: true,
          pageIndex: true,
          storagePath: true
        },
        orderBy: {
          pageIndex: "asc"
        }
      },
      items: {
        select: {
          id: true,
          rawName: true,
          linePriceAmount: true,
          quantity: true,
          specText: true,
          weightGrams: true,
          pricePer100g: true,
          resolutionStatus: true,
          isNewProductAtImport: true,
          product: {
            select: {
              id: true,
              displayName: true
            }
          }
        },
        orderBy: {
          createdAt: "asc"
        }
      }
    }
  })

  if (!order) {
    throw new RouteError("NOT_FOUND", "Order not found.", 404)
  }

  const images = await Promise.all(
    order.images.map(async (image) => ({
      id: image.id,
      pageIndex: image.pageIndex,
      imageUrl: await getOrderImageUrl(image.storagePath)
    }))
  )
  const pendingImageCount = order.sourceImport
    ? Math.max(order.sourceImport.images.length - order.images.length, 0)
    : 0
  const unresolvedItemCount = order.items.filter((item) => item.resolutionStatus === "PENDING").length
  const commitTaskRunning = order.sourceImport
    ? isBackgroundTaskRunning(getImportCommitTaskKey(order.sourceImport.id))
    : false

  return {
    id: order.id,
    platform: {
      code: order.platform as PlatformCode,
      label: getPlatformLabel(order.platform as PlatformCode)
    },
    orderedAt: order.orderedAt.toISOString(),
    note: order.note,
    importProcessing: order.sourceImport
      ? {
          sourceImportId: order.sourceImport.id,
          isPending: pendingImageCount > 0 || commitTaskRunning,
          errorMessage: order.sourceImport.errorMessage,
          pendingImageCount,
          unresolvedItemCount
        }
      : null,
    images,
    items: order.items.map((item) => ({
      id: item.id,
      product: item.product,
      rawName: item.rawName,
      linePriceAmount: item.linePriceAmount,
      quantity: item.quantity.toString(),
      specText: item.specText,
      weightGrams: item.weightGrams,
      pricePer100g: item.pricePer100g,
      resolutionStatus: item.resolutionStatus,
      isNewProductAtImport: item.isNewProductAtImport
    }))
  }
}

export async function updateOrderForUser(
  userId: string,
  orderId: string,
  input: UpdateOrderRequest
) {
  return prisma.$transaction(async (tx) => {
    const existingOrder = await tx.order.findFirst({
      where: {
        id: orderId,
        userId,
        status: "ACTIVE"
      },
      select: {
        id: true,
        platform: true,
        items: {
          select: {
            productId: true
          }
        }
      }
    })

    if (!existingOrder) {
      throw new RouteError("NOT_FOUND", "Order not found.", 404)
    }

    await tx.order.update({
      where: {
        id: orderId
      },
      data: {
        orderedAt: input.orderedAt ? new Date(input.orderedAt) : undefined,
        note:
          input.note === undefined ? undefined : normalizeOptionalText(input.note)
      }
    })

    if (input.orderedAt) {
      const touchedProductIds = [
        ...new Set(
          existingOrder.items
            .map((item) => item.productId)
            .filter((productId): productId is string => Boolean(productId))
        )
      ]

      for (const productId of touchedProductIds) {
        await refreshProductOrderAggregates(
          tx,
          userId,
          productId,
          existingOrder.platform
        )
      }
    }

    return {
      orderId
    }
  })
}

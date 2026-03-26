import { Prisma, prisma, type Platform } from "@life-assistant/db"
import { normalizeProductName } from "@life-assistant/domain"

import { createValidationError } from "../route-error"

type DatabaseClient = Prisma.TransactionClient | typeof prisma

export async function ensureOwnedProduct(
  tx: DatabaseClient,
  userId: string,
  productId: string,
  fieldPath = "productId"
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

export async function upsertProductAlias(
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

export async function refreshProductOrderAggregates(
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

  const platformAggregates = await client.orderItem.findMany({
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
    ],
    take: 1
  })

  const earliestOrderedAt = platformAggregates[0]?.order.orderedAt ?? null

  if (!earliestOrderedAt) {
    await client.productPlatform.deleteMany({
      where: {
        productId,
        platform
      }
    })

    return
  }

  const latestPlatformItems = await client.orderItem.findMany({
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
    ],
    take: 1
  })

  const latestOrderedAt = latestPlatformItems[0]?.order.orderedAt ?? earliestOrderedAt

  await client.productPlatform.upsert({
    where: {
      productId_platform: {
        productId,
        platform
      }
    },
    update: {
      firstSeenAt: earliestOrderedAt,
      lastSeenAt: latestOrderedAt
    },
    create: {
      productId,
      platform,
      firstSeenAt: earliestOrderedAt,
      lastSeenAt: latestOrderedAt
    }
  })
}

import type { CreateProductRequest, ProductsListQuery, UpdateProductRequest } from "@life-assistant/contracts"
import { prisma, type Prisma } from "@life-assistant/db"
import { normalizeProductName } from "@life-assistant/domain"
import { getPlatformLabel, toPlatformOption, type PlatformCode } from "@life-assistant/shared"

import {
  dedupeStrings,
  ensureActiveCategory,
  ensureActiveTagIds,
  normalizeOptionalText
} from "../catalog"
import { RouteError } from "../route-error"

function mapProductTags(
  productTags: Array<{
    tag: {
      id: string
      code: string
      name: string
      sortOrder: number
    }
  }>
) {
  return [...productTags]
    .sort((left, right) => left.tag.sortOrder - right.tag.sortOrder)
    .map(({ tag }) => ({
      id: tag.id,
      code: tag.code,
      name: tag.name
    }))
}

function mapProductPlatforms(
  productPlatforms: Array<{
    platform: PlatformCode
    lastSeenAt: Date
  }>
) {
  return [...productPlatforms]
    .sort((left, right) => right.lastSeenAt.getTime() - left.lastSeenAt.getTime())
    .map(({ platform }) => toPlatformOption(platform))
}

function buildProductsWhereInput(userId: string, query: ProductsListQuery): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {
    userId
  }

  if (query.q) {
    const normalizedQuery = normalizeProductName(query.q)

    where.OR = [
      {
        displayName: {
          contains: query.q,
          mode: "insensitive"
        }
      },
      {
        normalizedName: {
          contains: normalizedQuery,
          mode: "insensitive"
        }
      }
    ]
  }

  if (query.categoryId) {
    where.categoryId = query.categoryId
  }

  if (query.platform) {
    where.platforms = {
      some: {
        platform: query.platform
      }
    }
  }

  if (query.tagId) {
    where.tags = {
      some: {
        tagId: query.tagId
      }
    }
  }

  if (query.inventoryStatus) {
    where.inventoryStatus = query.inventoryStatus
  }

  if (query.hasOrders === "true") {
    where.orderItems = {
      some: {}
    }
  }

  if (query.hasOrders === "false") {
    where.orderItems = {
      none: {}
    }
  }

  return where
}

function getProductsOrderBy(query: ProductsListQuery): Prisma.ProductOrderByWithRelationInput[] {
  if (query.sort === "recent_purchased") {
    return [
      {
        lastPurchasedAt: {
          sort: "desc",
          nulls: "last"
        }
      },
      {
        createdAt: "desc"
      }
    ]
  }

  return [
    {
      createdAt: "desc"
    }
  ]
}

export async function listProductsForUser(userId: string, query: ProductsListQuery) {
  const where = buildProductsWhereInput(userId, query)
  const skip = (query.page - 1) * query.pageSize

  const [total, products] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      skip,
      take: query.pageSize,
      orderBy: getProductsOrderBy(query),
      include: {
        category: {
          select: {
            id: true,
            code: true,
            name: true
          }
        },
        platforms: {
          select: {
            platform: true,
            lastSeenAt: true
          }
        },
        tags: {
          include: {
            tag: {
              select: {
                id: true,
                code: true,
                name: true,
                sortOrder: true
              }
            }
          }
        }
      }
    })
  ])

  return {
    items: products.map((product) => ({
      id: product.id,
      displayName: product.displayName,
      category: product.category,
      platforms: mapProductPlatforms(product.platforms as Array<{ platform: PlatformCode; lastSeenAt: Date }>),
      tags: mapProductTags(product.tags),
      inventoryStatus: product.inventoryStatus,
      primaryImageUrl: product.primaryImageUrl,
      lastPurchasedAt: product.lastPurchasedAt?.toISOString() ?? null,
      createdAt: product.createdAt.toISOString()
    })),
    page: query.page,
    pageSize: query.pageSize,
    total
  }
}

export async function createProductForUser(userId: string, input: CreateProductRequest) {
  return prisma.$transaction(async (tx) => {
    await ensureActiveCategory(tx, input.categoryId)
    const tagIds = await ensureActiveTagIds(tx, input.tagIds ?? [])
    const platformCodes = dedupeStrings(input.platformCodes ?? []) as PlatformCode[]
    const now = new Date()

    const product = await tx.product.create({
      data: {
        userId,
        categoryId: input.categoryId,
        displayName: input.displayName.trim(),
        normalizedName: normalizeProductName(input.displayName),
        specText: normalizeOptionalText(input.specText),
        inventoryStatus: input.inventoryStatus ?? "UNKNOWN",
        note: normalizeOptionalText(input.note)
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

    if (platformCodes.length > 0) {
      await tx.productPlatform.createMany({
        data: platformCodes.map((platform) => ({
          productId: product.id,
          platform,
          firstSeenAt: now,
          lastSeenAt: now
        })),
        skipDuplicates: true
      })
    }

    return {
      productId: product.id
    }
  })
}

export async function getProductDetailForUser(userId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      userId
    },
    include: {
      category: {
        select: {
          id: true,
          code: true,
          name: true
        }
      },
      platforms: {
        select: {
          platform: true,
          lastSeenAt: true
        }
      },
      tags: {
        include: {
          tag: {
            select: {
              id: true,
              code: true,
              name: true,
              sortOrder: true
            }
          }
        }
      }
    }
  })

  if (!product) {
    throw new RouteError("NOT_FOUND", "Product not found.", 404)
  }

  const orderItems = await prisma.orderItem.findMany({
    where: {
      productId,
      order: {
        userId,
        status: "ACTIVE"
      }
    },
    include: {
      order: {
        select: {
          id: true,
          platform: true,
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

  const latestPlatformPrices: Array<{
    platform: { code: PlatformCode; label: string }
    latestOrderedAt: string
    linePriceAmount: number
    quantity: string
    specText: string | null
    weightGrams: number | null
    pricePer100g: number | null
  }> = []
  const seenPlatforms = new Set<PlatformCode>()

  for (const item of orderItems) {
    const platform = item.order.platform as PlatformCode

    if (seenPlatforms.has(platform)) {
      continue
    }

    seenPlatforms.add(platform)
    latestPlatformPrices.push({
      platform: {
        code: platform,
        label: getPlatformLabel(platform)
      },
      latestOrderedAt: item.order.orderedAt.toISOString(),
      linePriceAmount: item.linePriceAmount,
      quantity: item.quantity.toString(),
      specText: item.specText,
      weightGrams: item.weightGrams,
      pricePer100g: item.pricePer100g
    })
  }

  return {
    id: product.id,
    displayName: product.displayName,
    normalizedName: product.normalizedName,
    category: product.category,
    platforms: mapProductPlatforms(product.platforms as Array<{ platform: PlatformCode; lastSeenAt: Date }>),
    tags: mapProductTags(product.tags),
    inventoryStatus: product.inventoryStatus,
    specText: product.specText,
    note: product.note,
    primaryImageUrl: product.primaryImageUrl,
    lastPurchasedAt: product.lastPurchasedAt?.toISOString() ?? null,
    latestPlatformPrices,
    recentOrders: orderItems.slice(0, 10).map((item) => ({
      orderId: item.order.id,
      platform: {
        code: item.order.platform as PlatformCode,
        label: getPlatformLabel(item.order.platform as PlatformCode)
      },
      orderedAt: item.order.orderedAt.toISOString(),
      linePriceAmount: item.linePriceAmount,
      quantity: item.quantity.toString()
    }))
  }
}

export async function updateProductForUser(
  userId: string,
  productId: string,
  input: UpdateProductRequest
) {
  return prisma.$transaction(async (tx) => {
    const existingProduct = await tx.product.findFirst({
      where: {
        id: productId,
        userId
      },
      select: {
        id: true
      }
    })

    if (!existingProduct) {
      throw new RouteError("NOT_FOUND", "Product not found.", 404)
    }

    if (input.categoryId) {
      await ensureActiveCategory(tx, input.categoryId)
    }

    const tagIds = input.tagIds ? await ensureActiveTagIds(tx, input.tagIds) : undefined

    await tx.product.update({
      where: {
        id: productId
      },
      data: {
        displayName: input.displayName?.trim(),
        normalizedName: input.displayName
          ? normalizeProductName(input.displayName)
          : undefined,
        categoryId: input.categoryId,
        specText:
          input.specText === undefined
            ? undefined
            : normalizeOptionalText(input.specText),
        inventoryStatus: input.inventoryStatus,
        note:
          input.note === undefined ? undefined : normalizeOptionalText(input.note)
      }
    })

    if (tagIds !== undefined) {
      await tx.productTag.deleteMany({
        where: {
          productId
        }
      })

      if (tagIds.length > 0) {
        await tx.productTag.createMany({
          data: tagIds.map((tagId) => ({
            productId,
            tagId
          })),
          skipDuplicates: true
        })
      }
    }

    return {
      productId
    }
  })
}

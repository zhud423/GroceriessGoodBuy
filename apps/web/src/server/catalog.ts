import { Prisma, prisma } from "@life-assistant/db"

import { createValidationError } from "./route-error"

type DatabaseClient = Prisma.TransactionClient | typeof prisma

export function normalizeOptionalText(value: string | null | undefined) {
  if (value == null) {
    return null
  }

  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : null
}

export function dedupeStrings(values: string[]) {
  return [...new Set(values)]
}

export async function ensureActiveCategory(client: DatabaseClient, categoryId: string) {
  const category = await client.category.findFirst({
    where: {
      id: categoryId,
      isActive: true
    },
    select: {
      id: true
    }
  })

  if (!category) {
    throw createValidationError("Request validation failed.", {
      categoryId: "Category does not exist or is inactive."
    })
  }
}

export async function ensureActiveTagIds(client: DatabaseClient, tagIds: string[]) {
  const uniqueTagIds = dedupeStrings(tagIds)

  if (uniqueTagIds.length === 0) {
    return uniqueTagIds
  }

  const tags = await client.tag.findMany({
    where: {
      id: {
        in: uniqueTagIds
      },
      isActive: true
    },
    select: {
      id: true
    }
  })

  if (tags.length !== uniqueTagIds.length) {
    throw createValidationError("Request validation failed.", {
      tagIds: "One or more tags do not exist or are inactive."
    })
  }

  return uniqueTagIds
}

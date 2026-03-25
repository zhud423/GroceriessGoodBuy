import { prisma } from "./client"

import { DEFAULT_CATEGORIES, DEFAULT_TAGS } from "@life-assistant/shared"

async function seedCategories() {
  for (const category of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: { code: category.code },
      update: {
        name: category.name,
        sortOrder: category.sortOrder,
        isActive: true
      },
      create: {
        code: category.code,
        name: category.name,
        sortOrder: category.sortOrder,
        isActive: true
      }
    })
  }
}

async function seedTags() {
  for (const tag of DEFAULT_TAGS) {
    await prisma.tag.upsert({
      where: { code: tag.code },
      update: {
        name: tag.name,
        sortOrder: tag.sortOrder,
        isActive: true
      },
      create: {
        code: tag.code,
        name: tag.name,
        sortOrder: tag.sortOrder,
        isActive: true
      }
    })
  }
}

async function main() {
  await seedCategories()
  await seedTags()

  console.log(
    `Seeded ${DEFAULT_CATEGORIES.length} categories and ${DEFAULT_TAGS.length} tags.`
  )
}

main()
  .catch((error) => {
    console.error("Failed to seed dictionaries.", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

import { listCategories } from "@life-assistant/db"

import { apiOk, internalServerError } from "@/src/lib/api-response"

export async function GET() {
  try {
    const categories = await listCategories()

    return apiOk(categories)
  } catch (error) {
    return internalServerError(error, "Failed to load categories.")
  }
}

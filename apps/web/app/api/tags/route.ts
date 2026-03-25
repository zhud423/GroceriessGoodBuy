import { listTags } from "@life-assistant/db"

import { apiOk, internalServerError } from "@/src/lib/api-response"

export async function GET() {
  try {
    const tags = await listTags()

    return apiOk(tags)
  } catch (error) {
    return internalServerError(error, "Failed to load tags.")
  }
}

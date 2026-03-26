import { bulkUpdateProductTagsRequestSchema } from "@life-assistant/contracts"

import { apiOk } from "@/src/lib/api-response"
import { requireAppUser } from "@/src/server/auth"
import { bulkUpdateProductTagsForUser } from "@/src/server/products/service"
import { toRouteErrorResponse } from "@/src/server/route-error"
import { parseJsonBodyWithSchema } from "@/src/server/validation"

export async function POST(request: Request) {
  try {
    const auth = await requireAppUser(request)
    const input = await parseJsonBodyWithSchema(request, bulkUpdateProductTagsRequestSchema)
    const data = await bulkUpdateProductTagsForUser(auth.user.id, input)

    return apiOk(data)
  } catch (error) {
    return toRouteErrorResponse(error, "Failed to bulk update product tags.")
  }
}

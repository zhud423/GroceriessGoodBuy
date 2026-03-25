import { createImportSessionRequestSchema } from "@life-assistant/contracts"

import { apiOk } from "@/src/lib/api-response"
import { requireAppUser } from "@/src/server/auth"
import { createImportSessionForUser } from "@/src/server/imports/service"
import { toRouteErrorResponse } from "@/src/server/route-error"
import { parseJsonBodyWithSchema } from "@/src/server/validation"

export async function POST(request: Request) {
  try {
    const auth = await requireAppUser(request)
    const input = await parseJsonBodyWithSchema(request, createImportSessionRequestSchema)
    const data = await createImportSessionForUser(auth.user.id, input)

    return apiOk(data, { status: 201 })
  } catch (error) {
    return toRouteErrorResponse(error, "Failed to create import session.")
  }
}

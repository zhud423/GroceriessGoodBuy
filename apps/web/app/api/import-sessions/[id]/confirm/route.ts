import { confirmImportSessionRequestSchema } from "@life-assistant/contracts"
import { z } from "zod"

import { apiOk } from "@/src/lib/api-response"
import { requireAppUser } from "@/src/server/auth"
import { confirmImportSessionForUser } from "@/src/server/imports/service"
import { toRouteErrorResponse } from "@/src/server/route-error"
import {
  parseJsonBodyWithSchema,
  parseWithSchema
} from "@/src/server/validation"

const routeParamsSchema = z.object({
  id: z.string().trim().min(1)
})

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = await requireAppUser(request)
    const { id } = parseWithSchema(routeParamsSchema, await context.params)
    const input = await parseJsonBodyWithSchema(request, confirmImportSessionRequestSchema)
    const data = await confirmImportSessionForUser(auth.user.id, id, input)

    return apiOk(data)
  } catch (error) {
    return toRouteErrorResponse(error, "Failed to confirm import session.")
  }
}

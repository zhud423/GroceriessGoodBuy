import { updateImportSessionRequestSchema } from "@life-assistant/contracts"
import { z } from "zod"

import { apiOk } from "@/src/lib/api-response"
import { requireAppUser } from "@/src/server/auth"
import {
  getImportSessionDetailForUser,
  updateImportSessionForUser
} from "@/src/server/imports/service"
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

export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = await requireAppUser(request)
    const { id } = parseWithSchema(routeParamsSchema, await context.params)
    const data = await getImportSessionDetailForUser(auth.user.id, id)

    return apiOk(data)
  } catch (error) {
    return toRouteErrorResponse(error, "Failed to load import session.")
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const auth = await requireAppUser(request)
    const { id } = parseWithSchema(routeParamsSchema, await context.params)
    const input = await parseJsonBodyWithSchema(request, updateImportSessionRequestSchema)
    const data = await updateImportSessionForUser(auth.user.id, id, input)

    return apiOk(data)
  } catch (error) {
    return toRouteErrorResponse(error, "Failed to update import session.")
  }
}

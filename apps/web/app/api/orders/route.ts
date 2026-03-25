import {
  createOrderRequestSchema,
  ordersListQuerySchema
} from "@life-assistant/contracts"

import { apiOk } from "@/src/lib/api-response"
import { requireAppUser } from "@/src/server/auth"
import {
  createOrderForUser,
  listOrdersForUser
} from "@/src/server/orders/service"
import { toRouteErrorResponse } from "@/src/server/route-error"
import {
  parseJsonBodyWithSchema,
  parseWithSchema
} from "@/src/server/validation"

export async function GET(request: Request) {
  try {
    const auth = await requireAppUser(request)
    const query = parseWithSchema(
      ordersListQuerySchema,
      Object.fromEntries(new URL(request.url).searchParams.entries())
    )
    const data = await listOrdersForUser(auth.user.id, query)

    return apiOk(data)
  } catch (error) {
    return toRouteErrorResponse(error, "Failed to load orders.")
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAppUser(request)
    const input = await parseJsonBodyWithSchema(request, createOrderRequestSchema)
    const data = await createOrderForUser(auth.user.id, input)

    return apiOk(data, { status: 201 })
  } catch (error) {
    return toRouteErrorResponse(error, "Failed to create order.")
  }
}

import {
  createProductRequestSchema,
  productsListQuerySchema
} from "@life-assistant/contracts"

import { apiOk } from "@/src/lib/api-response"
import { requireAppUser } from "@/src/server/auth"
import {
  createProductForUser,
  listProductsForUser
} from "@/src/server/products/service"
import { toRouteErrorResponse } from "@/src/server/route-error"
import {
  parseJsonBodyWithSchema,
  parseWithSchema
} from "@/src/server/validation"

export async function GET(request: Request) {
  try {
    const auth = await requireAppUser(request)
    const query = parseWithSchema(
      productsListQuerySchema,
      Object.fromEntries(new URL(request.url).searchParams.entries())
    )
    const data = await listProductsForUser(auth.user.id, query)

    return apiOk(data)
  } catch (error) {
    return toRouteErrorResponse(error, "Failed to load products.")
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAppUser(request)
    const input = await parseJsonBodyWithSchema(request, createProductRequestSchema)
    const data = await createProductForUser(auth.user.id, input)

    return apiOk(data, { status: 201 })
  } catch (error) {
    return toRouteErrorResponse(error, "Failed to create product.")
  }
}

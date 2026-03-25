import { PLATFORMS } from "@life-assistant/shared"

import { apiOk } from "@/src/lib/api-response"

export async function GET() {
  return apiOk(PLATFORMS)
}

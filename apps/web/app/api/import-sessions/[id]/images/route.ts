import { z } from "zod"

import { apiOk } from "@/src/lib/api-response"
import { requireAppUser } from "@/src/server/auth"
import { uploadImportImagesForUser } from "@/src/server/imports/service"
import { createValidationError, toRouteErrorResponse } from "@/src/server/route-error"
import { parseWithSchema } from "@/src/server/validation"

const routeParamsSchema = z.object({
  id: z.string().trim().min(1)
})

type RouteContext = {
  params: Promise<{ id: string }>
}

function parseUploadFormData(formData: FormData) {
  const files = formData
    .getAll("files")
    .filter((item): item is File => typeof File !== "undefined" && item instanceof File)
  const pageIndexes = formData
    .getAll("pageIndexes")
    .map((item) => (typeof item === "string" ? Number.parseInt(item, 10) : Number.NaN))

  if (files.length === 0) {
    throw createValidationError("Request validation failed.", {
      files: "Upload at least one image."
    })
  }

  if (files.length !== pageIndexes.length) {
    throw createValidationError("Request validation failed.", {
      pageIndexes: "files and pageIndexes must have the same length."
    })
  }

  const uploads = files.map((file, index) => ({
    file,
    pageIndex: pageIndexes[index]
  }))

  for (const [index, upload] of uploads.entries()) {
    if (!Number.isInteger(upload.pageIndex) || upload.pageIndex < 0) {
      throw createValidationError("Request validation failed.", {
        [`pageIndexes.${index}`]: "pageIndex must be a non-negative integer."
      })
    }

    if (!upload.file.type.startsWith("image/")) {
      throw createValidationError("Request validation failed.", {
        [`files.${index}`]: "Only image files are supported."
      })
    }
  }

  return uploads
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = await requireAppUser(request)
    const { id } = parseWithSchema(routeParamsSchema, await context.params)
    const formData = await request.formData()
    const uploads = parseUploadFormData(formData)
    const data = await uploadImportImagesForUser(auth.user.id, id, uploads)

    return apiOk(data)
  } catch (error) {
    return toRouteErrorResponse(error, "Failed to upload import images.")
  }
}

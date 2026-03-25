import { createSupabaseAdminClient } from "@/src/lib/supabase/admin"
import { RouteError } from "@/src/server/route-error"

const SIGNED_URL_TTL_SECONDS = 60 * 60
const SIGNED_URL_CACHE_BUFFER_MS = 60 * 1000
type StorageBucketEnvName =
  | "SUPABASE_STORAGE_BUCKET_ORDERS"
  | "SUPABASE_STORAGE_BUCKET_IMPORTS"

type SignedUrlCacheEntry = {
  url: string
  expiresAt: number
}

const signedUrlCache = new Map<string, SignedUrlCacheEntry>()

function getConfiguredBucket(bucketEnvName: StorageBucketEnvName) {
  const bucket = process.env[bucketEnvName]?.trim()

  if (!bucket) {
    throw new RouteError(
      "INTERNAL_ERROR",
      `${bucketEnvName} is not configured.`,
      500
    )
  }

  return bucket
}

function getSafeFileExtension(fileName: string, mimeType: string) {
  const match = fileName.match(/\.([a-zA-Z0-9]+)$/)

  if (match?.[1]) {
    return `.${match[1].toLowerCase()}`
  }

  switch (mimeType) {
    case "image/jpeg":
      return ".jpg"
    case "image/png":
      return ".png"
    case "image/webp":
      return ".webp"
    case "image/heic":
      return ".heic"
    default:
      return ".bin"
  }
}

async function createSignedStorageUrl(
  bucketEnvName: StorageBucketEnvName,
  storagePath: string
) {
  const bucket = getConfiguredBucket(bucketEnvName)
  const cacheKey = `${bucket}::${storagePath}`
  const cached = signedUrlCache.get(cacheKey)

  if (cached && cached.expiresAt - SIGNED_URL_CACHE_BUFFER_MS > Date.now()) {
    return cached.url
  }

  try {
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS)

    if (error || !data?.signedUrl) {
      return storagePath
    }

    signedUrlCache.set(cacheKey, {
      url: data.signedUrl,
      expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000
    })

    return data.signedUrl
  } catch (error) {
    console.warn("Failed to create signed storage url.", error)

    return storagePath
  }
}

async function uploadToBucket(
  bucket: string,
  storagePath: string,
  fileBody: Uint8Array,
  contentType: string | undefined
) {
  const supabase = createSupabaseAdminClient()
  const { error } = await supabase.storage.from(bucket).upload(storagePath, fileBody, {
    contentType,
    upsert: true
  })

  if (error) {
    throw new RouteError(
      "INTERNAL_ERROR",
      `Failed to upload image to storage: ${error.message}`,
      500
    )
  }
}

async function deleteFromBucket(bucket: string, storagePath: string) {
  const supabase = createSupabaseAdminClient()
  const { error } = await supabase.storage.from(bucket).remove([storagePath])
  signedUrlCache.delete(`${bucket}::${storagePath}`)

  if (error) {
    console.warn("Failed to delete storage object.", error)
  }
}

async function deleteManyFromBucket(bucket: string, storagePaths: string[]) {
  if (storagePaths.length === 0) {
    return
  }

  storagePaths.forEach((storagePath) => {
    signedUrlCache.delete(`${bucket}::${storagePath}`)
  })

  const supabase = createSupabaseAdminClient()
  const { error } = await supabase.storage.from(bucket).remove(storagePaths)

  if (error) {
    console.warn("Failed to delete storage objects.", error)
  }
}

function getOrderStoragePath(userId: string, orderId: string, pageIndex: number, extension: string) {
  return `${userId}/${orderId}/page-${pageIndex}${extension}`
}

function getImportStoragePath(
  userId: string,
  importSessionId: string,
  pageIndex: number,
  extension: string
) {
  return `${userId}/${importSessionId}/page-${pageIndex}${extension}`
}

export async function uploadImportImageFile(args: {
  userId: string
  importSessionId: string
  pageIndex: number
  file: File
  previousStoragePath?: string | null
}) {
  const bucket = getConfiguredBucket("SUPABASE_STORAGE_BUCKET_IMPORTS")
  const extension = getSafeFileExtension(args.file.name, args.file.type)
  const storagePath = getImportStoragePath(
    args.userId,
    args.importSessionId,
    args.pageIndex,
    extension
  )
  const body = new Uint8Array(await args.file.arrayBuffer())

  await uploadToBucket(bucket, storagePath, body, args.file.type || undefined)
  signedUrlCache.delete(`${bucket}::${storagePath}`)

  if (args.previousStoragePath && args.previousStoragePath !== storagePath) {
    await deleteFromBucket(bucket, args.previousStoragePath)
  }

  return {
    storagePath,
    imageUrl: await createSignedStorageUrl("SUPABASE_STORAGE_BUCKET_IMPORTS", storagePath)
  }
}

export async function copyImportImageToOrderStorage(args: {
  sourceStoragePath: string
  userId: string
  orderId: string
  pageIndex: number
}) {
  const importBucket = getConfiguredBucket("SUPABASE_STORAGE_BUCKET_IMPORTS")
  const ordersBucket = getConfiguredBucket("SUPABASE_STORAGE_BUCKET_ORDERS")
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.storage
    .from(importBucket)
    .download(args.sourceStoragePath)

  if (error || !data) {
    throw new RouteError(
      "INTERNAL_ERROR",
      `Failed to read import image from storage: ${error?.message ?? "unknown error"}`,
      500
    )
  }

  const extensionMatch = args.sourceStoragePath.match(/(\.[a-zA-Z0-9]+)$/)
  const storagePath = getOrderStoragePath(
    args.userId,
    args.orderId,
    args.pageIndex,
    extensionMatch?.[1] ?? ".jpg"
  )
  const body = new Uint8Array(await data.arrayBuffer())

  await uploadToBucket(ordersBucket, storagePath, body, data.type || undefined)
  signedUrlCache.delete(`${ordersBucket}::${storagePath}`)

  return storagePath
}

export function getImportImageUrl(storagePath: string) {
  return createSignedStorageUrl("SUPABASE_STORAGE_BUCKET_IMPORTS", storagePath)
}

export function getOrderImageUrl(storagePath: string) {
  return createSignedStorageUrl("SUPABASE_STORAGE_BUCKET_ORDERS", storagePath)
}

export async function deleteOrderImagesFromStorage(storagePaths: string[]) {
  const bucket = getConfiguredBucket("SUPABASE_STORAGE_BUCKET_ORDERS")

  await deleteManyFromBucket(bucket, storagePaths)
}

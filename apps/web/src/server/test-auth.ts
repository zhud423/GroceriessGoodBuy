import { createHmac, timingSafeEqual } from "node:crypto"
import { z } from "zod"

import { RouteError } from "@/src/server/route-error"

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14
const testLoginAccountSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
  displayName: z.string().trim().min(1).optional()
})
const testLoginAccountsSchema = z.array(testLoginAccountSchema).min(1)

type AuthTokenPayload = {
  sub: string
  uid?: string
  name: string | null
  exp: number
}

type TestLoginAccount = {
  username: string
  password: string
  displayName: string | null
}

function normalizeUsername(value: string) {
  return value.trim()
}

function getSessionSecret() {
  const value = process.env.APP_SESSION_SECRET?.trim()

  if (!value) {
    throw new RouteError(
      "INTERNAL_ERROR",
      "APP_SESSION_SECRET is not configured.",
      500
    )
  }

  return value
}

export function getTestLoginAccounts() {
  const rawValue = process.env.TEST_LOGIN_ACCOUNTS?.trim()

  if (!rawValue) {
    throw new RouteError(
      "INTERNAL_ERROR",
      "TEST_LOGIN_ACCOUNTS is not configured.",
      500
    )
  }

  let parsedValue: unknown

  try {
    parsedValue = JSON.parse(rawValue)
  } catch {
    throw new RouteError(
      "INTERNAL_ERROR",
      "TEST_LOGIN_ACCOUNTS must be a valid JSON array.",
      500
    )
  }

  const result = testLoginAccountsSchema.safeParse(parsedValue)

  if (!result.success) {
    throw new RouteError(
      "INTERNAL_ERROR",
      "TEST_LOGIN_ACCOUNTS is invalid.",
      500
    )
  }

  const seenUsernames = new Set<string>()

  return result.data.map<TestLoginAccount>((account) => {
    const username = normalizeUsername(account.username)

    if (seenUsernames.has(username)) {
      throw new RouteError(
        "INTERNAL_ERROR",
        `Duplicate test login username: ${username}.`,
        500
      )
    }

    seenUsernames.add(username)

    return {
      username,
      password: account.password,
      displayName: account.displayName?.trim() || null
    }
  })
}

export function findTestLoginAccount(username: string, password: string) {
  const normalizedUsername = normalizeUsername(username)
  const passwordBuffer = Buffer.from(password)

  return (
    getTestLoginAccounts().find(
      (account) => {
        if (account.username !== normalizedUsername) {
          return false
        }

        const accountPasswordBuffer = Buffer.from(account.password)

        return (
          accountPasswordBuffer.length === passwordBuffer.length &&
          timingSafeEqual(accountPasswordBuffer, passwordBuffer)
        )
      }
    ) || null
  )
}

function signEncodedPayload(encodedPayload: string) {
  return createHmac("sha256", getSessionSecret())
    .update(encodedPayload)
    .digest("base64url")
}

export function createAppAccessToken(
  username: string,
  displayName: string | null,
  userId?: string
) {
  const payload: AuthTokenPayload = {
    sub: normalizeUsername(username),
    ...(userId ? { uid: userId } : {}),
    name: displayName,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const signature = signEncodedPayload(encodedPayload)

  return `${encodedPayload}.${signature}`
}

export function verifyAppAccessToken(token: string) {
  const [encodedPayload, signature] = token.split(".")

  if (!encodedPayload || !signature) {
    throw new RouteError("UNAUTHORIZED", "Invalid login session.", 401)
  }

  const expectedSignature = signEncodedPayload(encodedPayload)
  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    throw new RouteError("UNAUTHORIZED", "Invalid login session.", 401)
  }

  let payload: AuthTokenPayload

  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"))
  } catch {
    throw new RouteError("UNAUTHORIZED", "Invalid login session.", 401)
  }

  if (!payload.sub || payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new RouteError("UNAUTHORIZED", "Login session has expired.", 401)
  }

  return {
    username: normalizeUsername(payload.sub),
    userId: payload.uid?.trim() || null,
    displayName: payload.name
  }
}

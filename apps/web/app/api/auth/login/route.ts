import { z } from "zod"
import { prisma } from "@life-assistant/db"

import { apiOk } from "@/src/lib/api-response"
import {
  createAppAccessToken,
  findTestLoginAccount
} from "@/src/server/test-auth"
import { RouteError, toRouteErrorResponse } from "@/src/server/route-error"
import { parseJsonBodyWithSchema } from "@/src/server/validation"

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1)
})

export async function POST(request: Request) {
  try {
    const input = await parseJsonBodyWithSchema(request, loginSchema)
    const account = findTestLoginAccount(input.username, input.password)

    if (!account) {
      throw new RouteError("UNAUTHORIZED", "账号或密码错误。", 401)
    }

    const normalizedUsername = account.username.trim()
    const existingUser = await prisma.user.findFirst({
      where: {
        username: normalizedUsername
      },
      orderBy: {
        createdAt: "asc"
      },
      select: {
        id: true,
        username: true,
        displayName: true
      }
    })
    const localUser = existingUser
      ? await prisma.user.update({
          where: {
            id: existingUser.id
          },
          data: {
            username: normalizedUsername,
            displayName: account.displayName ?? account.username
          },
          select: {
            id: true,
            username: true,
            displayName: true
          }
        })
      : await prisma.user.create({
          data: {
            username: normalizedUsername,
            displayName: account.displayName ?? account.username
          },
          select: {
            id: true,
            username: true,
            displayName: true
          }
        })
    const accessToken = createAppAccessToken(
      localUser.username ?? account.username,
      localUser.displayName ?? account.displayName,
      localUser.id
    )

    return apiOk({
      accessToken,
      user: {
        id: localUser.id,
        username: localUser.username ?? account.username,
        displayName: localUser.displayName ?? account.displayName
      }
    })
  } catch (error) {
    return toRouteErrorResponse(error, "Failed to sign in.")
  }
}

import { Prisma, prisma } from "@life-assistant/db"

import { RouteError } from "./route-error"
import { verifyAppAccessToken } from "./test-auth"

function getRequestAccessToken(request: Request) {
  const authorization = request.headers.get("authorization")

  if (!authorization) {
    return null
  }

  const [type, value] = authorization.split(" ")

  if (type?.toLowerCase() !== "bearer" || !value) {
    return null
  }

  return value.trim()
}

export async function requireAppUser(request: Request) {
  const accessToken = getRequestAccessToken(request)

  if (!accessToken) {
    throw new RouteError(
      "UNAUTHORIZED",
      "Authorization bearer token is required.",
      401
    )
  }

  const authUser = verifyAppAccessToken(accessToken)
  const normalizedUsername = authUser.username.trim()
  const resolvedDisplayName = authUser.displayName ?? normalizedUsername

  if (authUser.userId) {
    const existingById = await prisma.user.findUnique({
      where: {
        id: authUser.userId
      },
      select: {
        id: true,
        username: true,
        displayName: true
      }
    })

    if (existingById) {
      return {
        accessToken,
        authUser,
        user: existingById
      }
    }

    try {
      const createdUser = await prisma.user.create({
        data: {
          id: authUser.userId,
          username: normalizedUsername,
          displayName: resolvedDisplayName
        },
        select: {
          id: true,
          username: true,
          displayName: true
        }
      })

      return {
        accessToken,
        authUser,
        user: createdUser
      }
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const racedUser = await prisma.user.findUnique({
          where: {
            id: authUser.userId
          },
          select: {
            id: true,
            username: true,
            displayName: true
          }
        })

        if (racedUser) {
          return {
            accessToken,
            authUser,
            user: racedUser
          }
        }
      }

      throw error
    }

  }

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
    ? existingUser.username === normalizedUsername &&
      existingUser.displayName === resolvedDisplayName
      ? existingUser
      : await prisma.user.update({
          where: {
            id: existingUser.id
          },
          data: {
            username: normalizedUsername,
            displayName: resolvedDisplayName
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
          displayName: resolvedDisplayName
        },
        select: {
          id: true,
          username: true,
          displayName: true
        }
      })

  return {
    accessToken,
    authUser,
    user: localUser
  }
}

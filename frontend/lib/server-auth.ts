import "server-only"

import { headers } from "next/headers"
import { cache } from "react"

import type { CurrentUser } from "@/types/auth"

const CURRENT_USER_REQUEST_TIMEOUT_MS = 8_000

const apiUrl = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4001"
).replace(/\/$/, "")

export class CurrentUserUnavailableError extends Error {
  readonly code = "CURRENT_USER_UNAVAILABLE"

  constructor(cause?: unknown) {
    super("Current user information is temporarily unavailable.", { cause })
    this.name = "CurrentUserUnavailableError"
  }
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const cookie = (await headers()).get("cookie")

  if (!cookie) {
    return null
  }

  let response: Response

  try {
    response = await fetch(`${apiUrl}/api/auth/get-session`, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        cookie,
      },
      signal: AbortSignal.timeout(CURRENT_USER_REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    throw new CurrentUserUnavailableError(error)
  }

  if (response.status === 401 || response.status === 403) {
    return null
  }

  if (!response.ok) {
    throw new CurrentUserUnavailableError(
      new Error(`Current user request failed with status ${response.status}`)
    )
  }

  let sessionData: unknown

  try {
    sessionData = await response.json()
  } catch (error) {
    throw new CurrentUserUnavailableError(error)
  }

  if (!sessionData || typeof sessionData !== "object") {
    return null
  }

  const rawUser = (sessionData as { user?: unknown }).user

  if (!rawUser || typeof rawUser !== "object") {
    return null
  }

  const user = rawUser as Record<string, unknown>

  if (
    typeof user.id !== "string" ||
    typeof user.name !== "string" ||
    typeof user.email !== "string" ||
    typeof user.emailVerified !== "boolean"
  ) {
    return null
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: typeof user.image === "string" ? user.image : null,
      createdAt:
        typeof user.createdAt === "string" || user.createdAt instanceof Date
          ? user.createdAt
          : undefined,
      updatedAt:
        typeof user.updatedAt === "string" || user.updatedAt instanceof Date
          ? user.updatedAt
          : undefined,
    },
  } satisfies CurrentUser
})

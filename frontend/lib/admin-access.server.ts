import "server-only"

import { headers } from "next/headers"
import { cache } from "react"

import type { AdminHeaderSummary } from "@/types/admin"

type AdminSession = {
  role: "ADMIN"
  user: {
    id: string
    name: string
    email: string
    image: string | null
  }
}

export type AdminAccessResult =
  | { status: "authorized"; session: AdminSession }
  | { status: "unauthenticated" }
  | { status: "forbidden" }

const ADMIN_SESSION_TIMEOUT_MS = 8_000

const apiUrl = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4001"
).replace(/\/$/, "")

export class AdminAccessUnavailableError extends Error {
  readonly code = "ADMIN_ACCESS_UNAVAILABLE"

  constructor(cause?: unknown) {
    super("Admin access information is temporarily unavailable.", { cause })
    this.name = "AdminAccessUnavailableError"
  }
}

export const getAdminAccess = cache(async (): Promise<AdminAccessResult> => {
  const cookie = (await headers()).get("cookie")
  if (!cookie) return { status: "unauthenticated" }

  let response: Response

  try {
    response = await fetch(`${apiUrl}/admin/session`, {
      cache: "no-store",
      headers: { Accept: "application/json", cookie },
      signal: AbortSignal.timeout(ADMIN_SESSION_TIMEOUT_MS),
    })
  } catch (error) {
    throw new AdminAccessUnavailableError(error)
  }

  if (response.status === 401) return { status: "unauthenticated" }
  if (response.status === 403) return { status: "forbidden" }
  if (!response.ok) {
    throw new AdminAccessUnavailableError(
      new Error(`Admin session request failed with ${response.status}`)
    )
  }

  const value: unknown = await response.json().catch((error) => {
    throw new AdminAccessUnavailableError(error)
  })

  if (!isAdminSession(value)) {
    throw new AdminAccessUnavailableError(
      new Error("Admin session response is invalid")
    )
  }

  return { status: "authorized", session: value }
})

export async function getAdminHeaderSummary(): Promise<AdminHeaderSummary> {
  const cookie = (await headers()).get("cookie")
  if (!cookie) throw new AdminAccessUnavailableError()

  let response: Response

  try {
    response = await fetch(`${apiUrl}/admin/header-summary`, {
      cache: "no-store",
      headers: { Accept: "application/json", cookie },
      signal: AbortSignal.timeout(ADMIN_SESSION_TIMEOUT_MS),
    })
  } catch (error) {
    throw new AdminAccessUnavailableError(error)
  }

  if (!response.ok) {
    throw new AdminAccessUnavailableError(
      new Error(`Admin header summary request failed with ${response.status}`)
    )
  }

  const value: unknown = await response.json().catch((error) => {
    throw new AdminAccessUnavailableError(error)
  })

  if (!isAdminHeaderSummary(value)) {
    throw new AdminAccessUnavailableError(
      new Error("Admin header summary response is invalid")
    )
  }

  return value
}

function isAdminSession(value: unknown): value is AdminSession {
  if (!value || typeof value !== "object") return false

  const candidate = value as Record<string, unknown>
  const user = candidate.user
  if (candidate.role !== "ADMIN" || !user || typeof user !== "object") {
    return false
  }

  const adminUser = user as Record<string, unknown>
  return (
    typeof adminUser.id === "string" &&
    typeof adminUser.name === "string" &&
    typeof adminUser.email === "string" &&
    (typeof adminUser.image === "string" || adminUser.image === null)
  )
}

function isAdminHeaderSummary(value: unknown): value is AdminHeaderSummary {
  if (!value || typeof value !== "object") return false

  const summary = value as Record<string, unknown>
  return (
    isNonNegativeInteger(summary.openSupportTickets) &&
    isNonNegativeInteger(summary.paymentIssues) &&
    isNonNegativeInteger(summary.activeSyncs) &&
    typeof summary.checkedAt === "string"
  )
}

function isNonNegativeInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
}

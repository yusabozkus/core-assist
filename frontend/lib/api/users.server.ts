import "server-only"

import { headers } from "next/headers"
import { cache } from "react"

import type { AccountOverview } from "@/types/user"

const ACCOUNT_REQUEST_TIMEOUT_MS = 8_000

const apiUrl = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4001"
).replace(/\/$/, "")

export const getServerAccountOverview = cache(
  async (): Promise<AccountOverview> => {
    const cookie = (await headers()).get("cookie")

    if (!cookie) {
      throw new Error("Account overview requires an authenticated session.")
    }

    const response = await fetch(`${apiUrl}/users/me/account-overview`, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        cookie,
      },
      signal: AbortSignal.timeout(ACCOUNT_REQUEST_TIMEOUT_MS),
    })

    if (!response.ok) {
      throw new Error(
        `Account overview request failed with status ${response.status}.`
      )
    }

    return (await response.json()) as AccountOverview
  }
)

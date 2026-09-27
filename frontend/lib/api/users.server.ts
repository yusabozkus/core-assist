import "server-only"
import { fetchServerApi } from "@/lib/api/server-fetch"

import { headers } from "next/headers"
import { cache } from "react"

import type { AccountOverview } from "@/types/user"

const ACCOUNT_REQUEST_TIMEOUT_MS = 8_000

export const getServerAccountOverview = cache(
  async (): Promise<AccountOverview> => {
    const cookie = (await headers()).get("cookie")

    if (!cookie) {
      throw new Error("Account overview requires an authenticated session.")
    }

    const response = await fetchServerApi(`/users/me/account-overview`, {
      cookie,
      timeoutMs: ACCOUNT_REQUEST_TIMEOUT_MS,
    })

    if (!response.ok) {
      throw new Error(
        `Account overview request failed with status ${response.status}.`
      )
    }

    return (await response.json()) as AccountOverview
  }
)

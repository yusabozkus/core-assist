import "server-only"

import { headers } from "next/headers"
import { cache } from "react"

import type { ChannelConnection } from "@/types/channel"

const CHANNELS_REQUEST_TIMEOUT_MS = 8_000

const apiUrl = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4001"
).replace(/\/$/, "")

export const getServerChannelConnections = cache(
  async (storeId: string): Promise<ChannelConnection[]> => {
    const cookie = (await headers()).get("cookie")

    if (!cookie) {
      return []
    }

    const response = await fetch(`${apiUrl}/stores/${storeId}/channels`, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        cookie,
      },
      signal: AbortSignal.timeout(CHANNELS_REQUEST_TIMEOUT_MS),
    })

    if (!response.ok) {
      throw new Error(
        `Channel connections request failed with status ${response.status}.`
      )
    }

    return (await response.json()) as ChannelConnection[]
  }
)

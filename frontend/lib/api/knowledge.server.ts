import "server-only"

import { headers } from "next/headers"
import { cache } from "react"

import type { StoreKnowledge } from "@/types/knowledge"

const REQUEST_TIMEOUT_MS = 8_000
const apiUrl = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4001"
).replace(/\/$/, "")

export const getServerStoreKnowledge = cache(
  async (storeId: string): Promise<StoreKnowledge> => {
    const cookie = (await headers()).get("cookie")
    if (!cookie) throw new Error("Oturum bilgisi bulunamadı.")

    const response = await fetch(`${apiUrl}/stores/${storeId}/knowledge`, {
      cache: "no-store",
      headers: { Accept: "application/json", cookie },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

    if (!response.ok) {
      throw new Error(
        `Bilgi tabanı isteği ${response.status} ile başarısız oldu.`
      )
    }

    return (await response.json()) as StoreKnowledge
  }
)

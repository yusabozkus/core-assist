import "server-only"
import { fetchServerApi } from "@/lib/api/server-fetch"

import { headers } from "next/headers"
import { cache } from "react"

import type { StoreKnowledge } from "@/types/knowledge"

const REQUEST_TIMEOUT_MS = 8_000
export const getServerStoreKnowledge = cache(
  async (storeId: string): Promise<StoreKnowledge> => {
    const cookie = (await headers()).get("cookie")
    if (!cookie) throw new Error("Oturum bilgisi bulunamadı.")

    const response = await fetchServerApi(`/stores/${storeId}/knowledge`, {
      cookie,
      timeoutMs: REQUEST_TIMEOUT_MS,
    })

    if (!response.ok) {
      throw new Error(
        `Bilgi tabanı isteği ${response.status} ile başarısız oldu.`
      )
    }

    return (await response.json()) as StoreKnowledge
  }
)

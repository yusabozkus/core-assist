import "server-only"
import { fetchServerApi } from "@/lib/api/server-fetch"

import { headers } from "next/headers"
import { cache } from "react"

import type { AiPerformance, AiPerformanceRange } from "@/types/ai-performance"

const REQUEST_TIMEOUT_MS = 8_000
export const getServerAiPerformance = cache(
  async (
    storeId: string,
    options: { range?: AiPerformanceRange; provider?: string } = {}
  ): Promise<AiPerformance> => {
    const cookie = (await headers()).get("cookie")
    if (!cookie) throw new Error("Oturum bilgisi bulunamadı.")

    const searchParams = new URLSearchParams({
      range: options.range ?? "30D",
    })
    if (options.provider) searchParams.set("provider", options.provider)

    const response = await fetchServerApi(
      `/stores/${storeId}/analytics/ai?${searchParams.toString()}`,
      { cookie, timeoutMs: REQUEST_TIMEOUT_MS }
    )

    if (!response.ok) {
      throw new Error(
        `AI performans isteği ${response.status} koduyla başarısız oldu.`
      )
    }

    return (await response.json()) as AiPerformance
  }
)

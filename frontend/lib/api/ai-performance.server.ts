import "server-only"

import { headers } from "next/headers"
import { cache } from "react"

import type { AiPerformance, AiPerformanceRange } from "@/types/ai-performance"

const REQUEST_TIMEOUT_MS = 8_000
const apiUrl = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4001"
).replace(/\/$/, "")

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

    const response = await fetch(
      `${apiUrl}/stores/${storeId}/analytics/ai?${searchParams.toString()}`,
      {
        cache: "no-store",
        headers: { Accept: "application/json", cookie },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      }
    )

    if (!response.ok) {
      throw new Error(
        `AI performans isteği ${response.status} koduyla başarısız oldu.`
      )
    }

    return (await response.json()) as AiPerformance
  }
)

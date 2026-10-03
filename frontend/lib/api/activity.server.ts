import "server-only"
import { fetchServerApi } from "@/lib/api/server-fetch"

import { headers } from "next/headers"
import type {
  ActivityActorFilter,
  ActivityCategory,
  ActivityPage,
  ActivityPeriod,
  ActivityPageSize,
  ActivityResultFilter,
} from "@/types/activity"

export async function getServerActivity(
  storeId: string,
  options: {
    category: ActivityCategory
    period: ActivityPeriod
    result: ActivityResultFilter
    actor: ActivityActorFilter
    limit: ActivityPageSize
    q: string
    cursor?: string
  }
): Promise<ActivityPage> {
  const cookie = (await headers()).get("cookie")
  if (!cookie) throw new Error("Oturum bulunamadı.")
  const params = new URLSearchParams({
    category: options.category,
    period: options.period,
    result: options.result,
    actor: options.actor,
    limit: String(options.limit),
  })
  if (options.q) params.set("q", options.q)
  if (options.cursor) params.set("cursor", options.cursor)

  const response = await fetchServerApi(
    `/stores/${encodeURIComponent(storeId)}/activity?${params}`,
    { cookie, timeoutMs: 8_000 }
  )
  if (!response.ok)
    throw new Error(`İşlem geçmişi yüklenemedi (${response.status}).`)
  return (await response.json()) as ActivityPage
}

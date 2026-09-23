import "server-only"

import { headers } from "next/headers"
import type {
  ActivityActorFilter,
  ActivityCategory,
  ActivityPage,
  ActivityPeriod,
  ActivityPageSize,
  ActivityResultFilter,
} from "@/types/activity"

const apiUrl = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4001"
).replace(/\/$/, "")

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

  const response = await fetch(
    `${apiUrl}/stores/${encodeURIComponent(storeId)}/activity?${params}`,
    {
      cache: "no-store",
      headers: { Accept: "application/json", cookie },
      signal: AbortSignal.timeout(8_000),
    }
  )
  if (!response.ok)
    throw new Error(`İşlem geçmişi yüklenemedi (${response.status}).`)
  return (await response.json()) as ActivityPage
}
